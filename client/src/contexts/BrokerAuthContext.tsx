import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import type { User } from '@supabase/supabase-js';

const log = createLogger({ context: 'BrokerAuth' });

export interface BrokerProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  organization_id: string;
  organization_name: string;
  organization_logo: string | null;
  is_active: boolean;
  user_id: string;
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
      
      const profile = data as unknown as BrokerProfile;
      if (profile && typeof profile === 'object' && 'id' in profile) {
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
      
      // Si hay error de sesión inválida, limpiar
      if (error) {
        log.warn('Invalid broker session, clearing:', error.message);
        try {
          await supabase.auth.signOut();
        } catch (e) {
          // Ignorar errores de signOut
        }
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
        // Query broker_registrations table directly instead of broken RPC
        let status: { has_request: boolean; status?: string; rejection_reason?: string } | null = null;
        try {
          const { data: regData } = await (supabase as any)
            .from('broker_registrations')
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
        
        await supabase.auth.signOut();
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
        
        return { error: 'No tienes acceso al portal de brokers' };
      }
      
      if (!profile.is_active) {
        await supabase.auth.signOut();
        setLoading(false);
        return { error: 'Tu cuenta de broker está desactivada' };
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
