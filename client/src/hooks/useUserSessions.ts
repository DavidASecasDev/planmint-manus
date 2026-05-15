import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { UserSession } from '@/types/enterprise';
import { toast } from 'sonner';
import { parseUserAgent } from '@/lib/sessionUtils';

export function useUserSessions() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['user-sessions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabaseQuery
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('last_seen_at', { ascending: false });

      if (error) throw error;
      return data as UserSession[];
    },
    enabled: !!user?.id,
  });

  const createSession = useMutation({
    mutationFn: async () => {
      if (!user?.id || !profile?.organization_id) throw new Error('No user');

      const { error } = await supabaseQuery.from('user_sessions').insert({
        user_id: user.id,
        organization_id: profile.organization_id,
        user_agent: navigator.userAgent,
        device_name: parseUserAgent(navigator.userAgent),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-sessions'] });
    },
  });

  const revokeSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabaseQuery
        .from('user_sessions')
        .update({ is_active: false })
        .eq('id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-sessions'] });
      toast.success('Sesión cerrada correctamente');
    },
    onError: () => {
      toast.error('Error al cerrar la sesión');
    },
  });

  const revokeAllSessions = useMutation({
    mutationFn: async (exceptCurrent?: string) => {
      if (!user?.id) throw new Error('No user');

      let query = supabaseQuery
        .from('user_sessions')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (exceptCurrent) {
        query = query.neq('id', exceptCurrent);
      }

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-sessions'] });
      toast.success('Todas las sesiones han sido cerradas');
    },
    onError: () => {
      toast.error('Error al cerrar las sesiones');
    },
  });

  const updateLastSeen = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabaseQuery
        .from('user_sessions')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) throw error;
    },
  });

  // Periodically update last_seen_at for current session (every 5 minutes)
  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id');
    if (!sessionId || !user?.id) return;

    // Update immediately on mount
    updateLastSeen.mutate(sessionId);

    const interval = setInterval(() => {
      updateLastSeen.mutate(sessionId);
    }, 5 * 60 * 1000); // every 5 minutes

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return {
    sessions,
    isLoading,
    createSession: createSession.mutate,
    revokeSession: revokeSession.mutate,
    revokeAllSessions: revokeAllSessions.mutate,
    updateLastSeen: updateLastSeen.mutate,
    isRevoking: revokeSession.isPending,
    isRevokingAll: revokeAllSessions.isPending,
    parseUserAgent,
  };
}
