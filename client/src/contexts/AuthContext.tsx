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

export type OrganizationVertical = 'rent_a_car' | 'accommodation' | 'transfers' | 'general';

export interface Organization {
  id: string;
  name: string;
  created_at: string;
  vertical_preset?: OrganizationVertical | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  organization: Organization | null;
  loading: boolean;
  profileLoading: boolean;
  /** True once the Supabase session has been fully validated/refreshed AND profile loaded.
   *  Use this to gate data-fetching queries that depend on a valid auth token. */
  sessionReady: boolean;
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
    const doFetch = (token: string) => fetch('/api/get-my-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    let response = await doFetch(accessToken);

    // On 401, attempt to refresh the session and retry once
    if (response.status === 401) {
      log.warn('Backend profile fetch got 401 — attempting session refresh');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData.session) {
        log.error('Session refresh failed during profile fetch:', refreshError?.message);
        // Session is truly expired — sign out to force re-login
        await supabase.auth.signOut();
        window.location.href = '/login';
        return null;
      }
      // Retry with the fresh token
      response = await doFetch(refreshData.session.access_token);
    }

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
    const doFetch = (token: string) => fetch('/api/get-my-organization', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ organization_id: orgId }),
    });

    let response = await doFetch(accessToken);

    // On 401, attempt to refresh the session and retry once
    if (response.status === 401) {
      log.warn('Backend organization fetch got 401 — attempting session refresh');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData.session) {
        log.error('Session refresh failed during org fetch:', refreshError?.message);
        return null;
      }
      response = await doFetch(refreshData.session.access_token);
    }

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
  const [sessionReady, setSessionReady] = useState(false);
  const isInitialLoad = useRef(true);
  
  // Deduplication: track in-flight profile fetch to prevent double calls
  const profileFetchInFlight = useRef<Promise<void> | null>(null);
  const lastFetchedUserId = useRef<string | null>(null);
  // Track whether initial data has been loaded (persists across useEffect re-runs)
  const hasLoadedInitialDataRef = useRef(false);
  const hasCompletedFirstLoadRef = useRef(false);


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
        // CRITICAL: Only show the full-screen loading spinner on the FIRST load.
        // hasCompletedFirstLoadRef is a ref (not state) so it's always current inside
        // this useCallback closure without needing to be in the dependency array.
        // After the first successful load, subsequent calls (e.g., from tab visibility
        // SIGNED_IN events that somehow bypass the guard) will NOT show the spinner,
        // preventing ProtectedRoute from unmounting all child components.
        if (!hasCompletedFirstLoadRef.current) {
          setProfileLoading(true);
        }

        const profileData = await fetchProfileData(userId, accessToken);
        setProfile(profileData);

        // If user exists in auth but has no profile, allow navigation
        if (!profileData) {
          log.warn('User has session but no profile — allowing onboarding flow');
          setLoading(false);
          setProfileLoading(false);
          // Still mark session as ready so queries can attempt (they'll be gated by orgId)
          setSessionReady(true);
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
        // Session is fully ready: token validated + profile loaded
        setSessionReady(true);
        // Mark that we've completed at least one full profile load.
        // This ref is used to prevent showing the full-screen spinner on
        // subsequent loads (e.g., if a SIGNED_IN event somehow bypasses guards).
        hasCompletedFirstLoadRef.current = true;
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
    // Use a single handler for all auth events including INITIAL_SESSION.
    // NOTE: hasLoadedInitialDataRef persists across useEffect re-runs to prevent
    // the guard from being bypassed when loadUserData changes reference.

    const handleSession = (
      event: string,
      currentSession: Session | null,
    ) => {
      // Always update the session/user objects (they contain the fresh token)
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        // TOKEN_REFRESHED fires every ~1 hour when Supabase auto-refreshes the JWT.
        // We MUST NOT trigger a full profile reload on TOKEN_REFRESHED because:
        // 1. setProfileLoading(true) causes components to show skeletons
        // 2. This interrupts users mid-task (e.g., filling forms, creating tasks)
        // 3. The profile data hasn't changed — only the JWT token has been renewed
        // The session/user objects above already have the fresh token, which is enough.
        if (event === 'TOKEN_REFRESHED') {
          console.log('[Auth] Token refreshed silently — no profile reload needed');
          return;
        }

        // CRITICAL FIX: The Supabase SDK (@supabase/auth-js) fires a SIGNED_IN event
        // every time the browser tab becomes visible (via its own visibilitychange handler
        // in _recoverAndRefresh). This is NOT a real sign-in — it's just the SDK
        // re-notifying subscribers about the existing session.
        // If we already have the same user loaded, skip the profile reload to prevent:
        // 1. setProfileLoading(true) → ProtectedRoute shows full-screen spinner
        // 2. All child components unmount → form state is destroyed
        // 3. Profile reloads → components remount from scratch (user loses work)
        if (event === 'SIGNED_IN' && hasLoadedInitialDataRef.current && lastFetchedUserId.current === currentSession.user.id) {
          console.log('[Auth] SIGNED_IN for same user (tab visibility recovery) — skipping profile reload');
          return;
        }

        // For INITIAL_SESSION and getSession: only load once (whichever fires first)
        if (event === 'INITIAL_SESSION' || event === '__GET_SESSION__') {
          if (hasLoadedInitialDataRef.current) return;
        }

        // Mark as loaded for ALL events that proceed past the guards above.
        // This ensures that subsequent SIGNED_IN events from tab visibility
        // changes are always caught by the guard, regardless of which event
        // type loaded the data first (INITIAL_SESSION, __GET_SESSION__, or SIGNED_IN).
        hasLoadedInitialDataRef.current = true;

        const accessToken = currentSession.access_token;

        // Defer to prevent Supabase auth deadlock (only for listener events)
        if (event !== '__GET_SESSION__') {
          setTimeout(() => {
            loadUserData(currentSession.user.id, accessToken, event, currentSession);
          }, 0);
        } else {
          loadUserData(currentSession.user.id, accessToken, null, currentSession);
        }
      } else {
        setProfile(null);
        setOrganization(null);
        setLoading(false);
        setProfileLoading(false);
        setSessionReady(true); // No user = session check complete
        localStorage.removeItem('current_session_id');
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        handleSession(event, currentSession);
      }
    );

    // Also check for existing session as a fallback
    // (handles the case where onAuthStateChange hasn't fired yet)
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      handleSession('__GET_SESSION__', existingSession);
    });

    // NOTE: We intentionally do NOT add our own visibilitychange handler here.
    // The Supabase SDK (@supabase/auth-js) already has a built-in visibilitychange
    // listener that calls _recoverAndRefresh() when the tab becomes visible.
    // That handler checks if the token is expired and refreshes it if needed,
    // then fires SIGNED_IN (which we now correctly skip for same-user recovery above).
    // Adding our own refreshSession() call on top of the SDK's would cause:
    // 1. Double token refresh requests
    // 2. Additional auth state change events
    // 3. Potential race conditions between the two refresh paths

    return () => {
      subscription.unsubscribe();
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
    
    setSessionReady(false);
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
      sessionReady,
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
