import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import type { User } from '@supabase/supabase-js';

const log = createLogger({ context: 'BrokerAuth' });

export interface BrokerProfile {
  /** The broker's ID in transfer_brokers table (used for request ownership) */
  id: string;
  /** The broker_profiles row ID (internal, rarely needed) */
  profile_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  organization_id: string;
  organization_name: string;
  organization_logo: string | null;
  is_active: boolean;
  user_id: string;
  /** Same as id, explicit FK to transfer_brokers */
  broker_id: string | null;
}

interface BrokerAuthContextType {
  user: User | null;
  broker: BrokerProfile | null;
  loading: boolean;
  isBroker: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  refreshBrokerProfile: () => Promise<void>;
}

const BrokerAuthContext = createContext<BrokerAuthContextType | undefined>(undefined);

export function BrokerAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [broker, setBroker] = useState<BrokerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBrokerProfile = useCallback(async (userId: string) => {
    try {
      // Query broker_profiles table directly instead of broken RPC
      const { data, error } = await (supabase as any)
        .from('broker_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) {
        log.error('Error fetching broker profile:', error);
        return null;
      }
      
      if (!data) {
        return null;
      }
      
      // Remap: broker.id should be broker_profiles.broker_id (FK to transfer_brokers)
      // so that broker.id matches transfer_requests.broker_id for ownership checks
      const raw = data as any;
      if (raw && typeof raw === 'object' && 'id' in raw) {
        const profile: BrokerProfile = {
          // CRITICAL: id = broker_id (FK to transfer_brokers), NOT broker_profiles.id
          id: raw.broker_id || raw.id,
          profile_id: raw.id,
          name: raw.name || '',
          email: raw.email || null,
          phone: raw.phone || null,
          company: raw.company || null,
          organization_id: raw.organization_id,
          organization_name: raw.organization_name || '',
          organization_logo: raw.organization_logo || null,
          is_active: raw.is_active ?? true,
          user_id: raw.user_id,
          broker_id: raw.broker_id || null,
        };
        return profile;
      }
      
      return null;
    } catch (err) {
      log.error('Error in fetchBrokerProfile:', err);
      return null;
    }
  }, []);

  const refreshBrokerProfile = useCallback(async () => {
    if (!user) return;
    const profile = await fetchBrokerProfile(user.id);
    setBroker(profile);
  }, [user, fetchBrokerProfile]);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const initAuth = async () => {
      // Verificar si hay una sesión válida antes de configurar listeners
      const { data: { session }, error } = await supabase.auth.getSession();
      
      // If there's a session error, just clear local broker state.
      // Do NOT call signOut() as it would destroy a valid PlanMint session.
      if (error) {
        log.warn('Invalid/expired session for broker context:', error.message);
        setUser(null);
        setBroker(null);
        setLoading(false);
        return;
      }

      // Establecer estado inicial
      setUser(session?.user ?? null);
      if (session?.user) {
        const profile = await fetchBrokerProfile(session.user.id);
        setBroker(profile);
      }
      setLoading(false);

      // Configurar listener DESPUÉS de verificar sesión
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const profile = await fetchBrokerProfile(session.user.id);
          setBroker(profile);
        } else {
          setBroker(null);
        }
        
        setLoading(false);
      });
      
      subscription = data.subscription;
    };

    initAuth();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [fetchBrokerProfile]);

  const login = async (email: string, password: string): Promise<{ error?: string }> => {
    setLoading(true);
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      setLoading(false);
      return { error: error.message };
    }
    
    if (data.user) {
      const profile = await fetchBrokerProfile(data.user.id);
      
      if (!profile) {
        // Check if user has a pending/rejected registration request
        let status: { has_request: boolean; status?: string; rejection_reason?: string } | null = null;
        try {
          const { data: regData } = await (supabase as any)
            .from('broker_registration_requests')
            .select('status, rejection_reason')
            .eq('user_id', data.user.id)
            .maybeSingle();
          if (regData) {
            status = { has_request: true, status: regData.status, rejection_reason: regData.rejection_reason };
          } else {
            status = { has_request: false };
          }
        } catch {
          status = { has_request: false };
        }
        
        // DO NOT sign out — the user may have a valid PlanMint session.
        // Just report the error without destroying their auth state.
        setLoading(false);
        
        if (status?.has_request) {
          if (status.status === 'pending') {
            return { error: 'Tu solicitud está pendiente de aprobación. Te notificaremos cuando sea revisada.' };
          }
          if (status.status === 'rejected') {
            const reason = status.rejection_reason 
              ? `Tu solicitud fue rechazada: ${status.rejection_reason}` 
              : 'Tu solicitud de acceso fue rechazada.';
            return { error: reason };
          }
        }
        
        return { error: 'No tienes acceso al portal de brokers. Contacta con tu administrador.' };
      }
      
      if (!profile.is_active) {
        // Inactive broker — also don't sign out, just report
        setLoading(false);
        return { error: 'Tu cuenta de broker está desactivada' };
      }

      // Check if the profile has organization_id (required for API calls)
      if (!profile.organization_id) {
        setLoading(false);
        return { error: 'Tu perfil no está vinculado a ninguna organización. Contacta con tu administrador para que lo corrija.' };
      }
      
      setBroker(profile);
    }
    
    setLoading(false);
    return {};
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      log.error('Error during logout:', error);
    } finally {
      // Siempre limpiar el estado local, incluso si signOut falla
      setBroker(null);
      setUser(null);
    }
  };

  return (
    <BrokerAuthContext.Provider
      value={{
        user,
        broker,
        loading,
        isBroker: !!broker && broker.is_active,
        login,
        logout,
        refreshBrokerProfile,
      }}
    >
      {children}
    </BrokerAuthContext.Provider>
  );
}

export function useBrokerAuth() {
  const context = useContext(BrokerAuthContext);
  if (context === undefined) {
    throw new Error('useBrokerAuth must be used within a BrokerAuthProvider');
  }
  return context;
}
