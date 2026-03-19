import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const isInitialLoad = useRef(true);

  const fetchProfile = async (userId: string) => {
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
  };

  const fetchOrganization = async (orgId: string) => {
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
  };

  const refreshProfile = async () => {
    if (!user) return;
    
    setProfileLoading(true);
    const profileData = await fetchProfile(user.id);
    setProfile(profileData);

    if (profileData?.organization_id) {
      const orgData = await fetchOrganization(profileData.organization_id);
      setOrganization(orgData);
    } else {
      setOrganization(null);
    }
    setProfileLoading(false);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Indicate profile is loading when auth changes
          setProfileLoading(true);
          
          // Defer profile fetch with setTimeout to prevent deadlock
          setTimeout(() => {
            fetchProfile(session.user.id).then((profileData) => {
              setProfile(profileData);

              // If user exists in auth but has no profile, allow navigation
              // (the create-org RPC will self-heal the profile)
              if (!profileData) {
                log.warn('User has session but no profile — allowing onboarding flow');
                setProfileLoading(false);
                return;
              }

              if (profileData?.organization_id) {
                fetchOrganization(profileData.organization_id).then((org) => {
                  setOrganization(org);
                  setProfileLoading(false);
                });
              } else {
                setOrganization(null);
                setProfileLoading(false);
              }

              // Create a session record only on real logins, not session restores
              if (event === 'SIGNED_IN' && !isInitialLoad.current && profileData?.organization_id) {
                const existingSessionId = localStorage.getItem('current_session_id');
                if (!existingSessionId) {
                  supabase.from('user_sessions').insert({
                    user_id: session.user.id,
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
            }, () => {
              setProfileLoading(false);
            });
          }, 0);
        } else {
          setProfile(null);
          setOrganization(null);
          setProfileLoading(false);
          localStorage.removeItem('current_session_id');
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id).then((profileData) => {
          setProfile(profileData);
          if (profileData?.organization_id) {
            fetchOrganization(profileData.organization_id).then((org) => {
              setOrganization(org);
              setLoading(false);
              setProfileLoading(false);
            });
          } else {
            setLoading(false);
            setProfileLoading(false);
          }
        }).catch(() => {
          setLoading(false);
          setProfileLoading(false);
        });
      } else {
        setLoading(false);
        setProfileLoading(false);
      }
    });

    // Proactively refresh session when app returns from background
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
  }, []);

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
