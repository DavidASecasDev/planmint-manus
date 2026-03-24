import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { parseUserAgent } from '@/lib/sessionUtils';


const log = createLogger({ context: 'Auth' });

export type AppRole = 'owner' | 'admin' | 'manager' | 'member' | 'read_only';

export interface Profile {
  id: string;
  name: string | null;
  organization_id: string | null;
  role: AppRole;
  theme_pref: 'system' | 'light' | 'dark';
  avatar_url: string | null;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  organization: Organization | null;
  loading: boolean;
  profileLoading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Fetch profile via our Express backend (bypasses RLS).
 * Falls back to direct Supabase query if the backend call fails.
 */
async function fetchProfileViaBackend(accessToken: string): Promise<Profile | null> {
  try {
    const response = await fetch('/api/get-my-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      log.warn('Backend profile fetch failed with status:', response.status);
      return null;
    }

    const result = await response.json();
    if (result.error) {
      log.warn('Backend profile fetch error:', result.error);
      return null;
    }

    return result.data as Profile | null;
  } catch (err) {
    log.error('Backend profile fetch exception:', err);
    return null;
  }
}

/**
 * Fetch organization via our Express backend (bypasses RLS).
 * Falls back to direct Supabase query if the backend call fails.
 */
async function fetchOrganizationViaBackend(accessToken: string, orgId: string): Promise<Organization | null> {
  try {
    const response = await fetch('/api/get-my-organization', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ organization_id: orgId }),
    });

    if (!response.ok) {
      log.warn('Backend organization fetch failed with status:', response.status);
      return null;
    }

    const result = await response.json();
    if (result.error) {
      log.warn('Backend organization fetch error:', result.error);
      return null;
    }

    return result.data as Organization | null;
  } catch (err) {
    log.error('Backend organization fetch exception:', err);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const isInitialLoad = useRef(true);
  
  // Deduplication: track in-flight profile fetch to prevent double calls
  const profileFetchInFlight = useRef<Promise<void> | null>(null);
  const lastFetchedUserId = useRef<string | null>(null);

  const fetchProfileData = useCallback(async (userId: string, accessToken?: string): Promise<Profile | null> => {
    // Try backend first (bypasses RLS)
    if (accessToken) {
      const backendProfile = await fetchProfileViaBackend(accessToken);
      if (backendProfile) return backendProfile;
    }

    // Fallback to direct Supabase query (may be blocked by RLS for non-owner users)
    log.warn('Falling back to direct Supabase profile query for user:', userId);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      log.error('Error fetching profile:', error);
      return null;
    }

    return data as Profile | null;
  }, []);

  const fetchOrganizationData = useCallback(async (orgId: string, accessToken?: string): Promise<Organization | null> => {
    // Try backend first (bypasses RLS)
    if (accessToken) {
      const backendOrg = await fetchOrganizationViaBackend(accessToken, orgId);
      if (backendOrg) return backendOrg;
    }

    // Fallback to direct Supabase query (may be blocked by RLS for non-owner users)
    log.warn('Falling back to direct Supabase organization query for org:', orgId);
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle();

    if (error) {
      log.error('Error fetching organization:', error);
      return null;
    }

    return data as Organization | null;
  }, []);

  /**
   * Load profile + organization for a given user, with deduplication.
   * If a fetch for the same user is already in-flight, reuse it.
   */
  const loadUserData = useCallback(async (
    userId: string,
    accessToken: string | undefined,
    event: string | null,
    sessionObj: Session | null,
  ) => {
    // Deduplicate: if we're already fetching for this user, return the existing promise
    if (lastFetchedUserId.current === userId && profileFetchInFlight.current) {
      return profileFetchInFlight.current;
    }

    lastFetchedUserId.current = userId;

    const fetchPromise = (async () => {
      try {
        setProfileLoading(true);

        const profileData = await fetchProfileData(userId, accessToken);
        setProfile(profileData);

        // If user exists in auth but has no profile, allow navigation
        if (!profileData) {
          log.warn('User has session but no profile — allowing onboarding flow');
          setLoading(false);
          setProfileLoading(false);
          return;
        }

        if (profileData.organization_id) {
          const orgData = await fetchOrganizationData(profileData.organization_id, accessToken);
          setOrganization(orgData);
        } else {
          setOrganization(null);
        }

        // Create a session record only on real logins, not session restores
        if (event === 'SIGNED_IN' && !isInitialLoad.current && profileData.organization_id && sessionObj?.user) {
          const existingSessionId = localStorage.getItem('current_session_id');
          if (!existingSessionId) {
            supabase.from('user_sessions').insert({
              user_id: sessionObj.user.id,
              organization_id: profileData.organization_id,
              user_agent: navigator.userAgent,
              device_name: parseUserAgent(navigator.userAgent),
            }).select('id').single().then(({ data: sessionData }) => {
              if (sessionData?.id) {
                localStorage.setItem('current_session_id', sessionData.id);
              }
            }, () => {
              // Silently ignore session creation errors — auth still works
            });
          }
        }

        // Mark initial load as done after first event
        if (isInitialLoad.current) {
          isInitialLoad.current = false;
        }
      } catch (err) {
        log.error('Error loading user data:', err);
      } finally {
        setLoading(false);
        setProfileLoading(false);
        profileFetchInFlight.current = null;
      }
    })();

    profileFetchInFlight.current = fetchPromise;
    return fetchPromise;
  }, [fetchProfileData, fetchOrganizationData]);

  const refreshProfile = async () => {
    if (!user) return;
    
    // Force a fresh fetch by clearing the deduplication state
    lastFetchedUserId.current = null;
    profileFetchInFlight.current = null;
    
    // Get fresh access token for backend calls
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    
    await loadUserData(user.id, accessToken, null, sessionData?.session ?? null);
  };

  useEffect(() => {
    let initialSessionHandled = false;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          // If this is the INITIAL_SESSION event triggered by getSession(),
          // we already handle it below — skip to avoid double fetch
          if (event === 'INITIAL_SESSION') {
            // Let the getSession() handler below take care of this
            return;
          }

          const accessToken = currentSession.access_token;
          
          // Defer to prevent Supabase auth deadlock
          setTimeout(() => {
            loadUserData(currentSession.user.id, accessToken, event, currentSession);
          }, 0);
        } else {
          setProfile(null);
          setOrganization(null);
          setLoading(false);
          setProfileLoading(false);
          localStorage.removeItem('current_session_id');
        }
      }
    );

    // THEN check for existing session (this is the single source of truth for initial load)
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (initialSessionHandled) return;
      initialSessionHandled = true;

      setSession(existingSession);
      setUser(existingSession?.user ?? null);

      if (existingSession?.user) {
        const accessToken = existingSession.access_token;
        loadUserData(existingSession.user.id, accessToken, null, existingSession);
      } else {
        setLoading(false);
        setProfileLoading(false);
      }
    });

    // Proactively refresh session when app returns from background
    // This only refreshes the Supabase auth token, NOT the full profile
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadUserData]);

  const signUp = async (email: string, password: string, name: string) => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { name }
      }
    });

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    return { error };
  };

  const signOut = async () => {
    // Mark current session as inactive before clearing
    const currentSessionId = localStorage.getItem('current_session_id');
    if (currentSessionId) {
      await supabase.from('user_sessions')
        .update({ is_active: false })
        .eq('id', currentSessionId)
        .then(() => {}, () => {});
    }
    
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setOrganization(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });

    return { error };
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      organization,
      loading,
      profileLoading,
      signUp,
      signIn,
      signOut,
      resetPassword,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
