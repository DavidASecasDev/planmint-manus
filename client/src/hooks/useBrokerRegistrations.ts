import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface BrokerRegistrationRequest {
  id: string;
  organization_id: string;
  user_id: string | null;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export function useBrokerRegistrations() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Realtime subscription for broker_registration_requests changes
  useEffect(() => {
    if (!profile?.organization_id) return;

    const channel = supabase
      .channel('broker-registration-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'broker_registration_requests',
          filter: `organization_id=eq.${profile.organization_id}`
        },
        () => {
          queryClient.invalidateQueries({ 
            queryKey: ['broker-registration-requests'],
            refetchType: 'active'
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.organization_id, queryClient]);

  // Fetch pending registration requests for the organization
  const { data: pendingRequests = [], isLoading: isLoadingPending } = useQuery({
    queryKey: ['broker-registration-requests', profile?.organization_id, 'pending'],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('broker_registration_requests')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as BrokerRegistrationRequest[];
    },
    enabled: !!profile?.organization_id,
  });

  // Fetch all registration requests for the organization
  const { data: allRequests = [], isLoading: isLoadingAll } = useQuery({
    queryKey: ['broker-registration-requests', profile?.organization_id, 'all'],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('broker_registration_requests')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as BrokerRegistrationRequest[];
    },
    enabled: !!profile?.organization_id,
  });

  // Approve a registration request
  const approveRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase.rpc('approve_broker_registration', {
        p_request_id: requestId
      });
      
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; broker_id?: string };
      if (!result.success) {
        throw new Error(result.error || 'Error al aprobar la solicitud');
      }
      
      return result;
    },
    onSuccess: () => {
      toast.success('Solicitud aprobada. El broker ya puede acceder al portal.');
      queryClient.invalidateQueries({ queryKey: ['broker-registration-requests'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['transfer-brokers'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['transfer-brokers-all'], refetchType: 'active' });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al aprobar la solicitud');
    },
  });

  // Reject a registration request
  const rejectRequest = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason?: string }) => {
      const { data, error } = await supabase.rpc('reject_broker_registration', {
        p_request_id: requestId,
        p_reason: reason ?? undefined
      });
      
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Error al rechazar la solicitud');
      }
      
      return result;
    },
    onSuccess: () => {
      toast.success('Solicitud rechazada');
      queryClient.invalidateQueries({ queryKey: ['broker-registration-requests'], refetchType: 'active' });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al rechazar la solicitud');
    },
  });

  return {
    pendingRequests,
    allRequests,
    isLoadingPending,
    isLoadingAll,
    pendingCount: pendingRequests.length,
    approveRequest: approveRequest.mutate,
    rejectRequest: rejectRequest.mutate,
    isApproving: approveRequest.isPending,
    isRejecting: rejectRequest.isPending,
  };
}
