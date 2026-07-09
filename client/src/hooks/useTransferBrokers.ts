import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { apiInvoke } from '@/lib/apiClient';
import { toast } from 'sonner';

export interface TransferBroker {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  user_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface CreateBrokerData {
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface UpdateBrokerFullData {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface SetupPortalAccessData {
  brokerId: string;
  email: string;
}

interface SetupPortalResponse {
  success: boolean;
  already_linked?: boolean;
  error?: string;
}

export function useTransferBrokers() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();

  // Realtime subscription for transfer_brokers changes
  useEffect(() => {
    if (!organization?.id) return;

    const channel = supabase
      .channel('transfer-brokers-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transfer_brokers',
          filter: `organization_id=eq.${organization.id}`
        },
        () => {
          queryClient.invalidateQueries({ 
            queryKey: ['transfer-brokers'],
            refetchType: 'active'
          });
          queryClient.invalidateQueries({ 
            queryKey: ['transfer-brokers-all'],
            refetchType: 'active'
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organization?.id, queryClient]);

  // Fetch brokers via backend endpoint (bypasses RLS — fixes Bug 3)
  const { data: brokerData, isLoading } = useQuery({
    queryKey: ['transfer-brokers', organization?.id],
    queryFn: async () => {
      const result = await apiInvoke<{ data: { brokers: TransferBroker[]; allBrokers: TransferBroker[] }; error: string | null }>('get-transfer-brokers');
      if (result.error) {
        console.error('[useTransferBrokers] Backend error:', result.error);
        throw new Error(result.error.message);
      }
      // Server returns { data: { brokers, allBrokers }, error: null }
      // apiInvoke wraps it again: result.data = { data: { brokers, allBrokers }, error: null }
      const serverResponse = result.data;
      return serverResponse?.data ?? { brokers: [], allBrokers: [] };
    },
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes - broker list rarely changes
  });

  const brokers = brokerData?.brokers ?? [];
  const allBrokers = brokerData?.allBrokers ?? [];

  const createMutation = useMutation({
    mutationFn: async (data: CreateBrokerData) => {
      if (!organization?.id) throw new Error('No organization');

      const { data: result, error } = await supabase
        .from('transfer_brokers')
        .insert({
          organization_id: organization.id,
          name: data.name,
          company: data.company,
          email: data.email,
          phone: data.phone,
        })
        .select()
        .single();

      if (error) throw error;
      return result as TransferBroker;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-brokers'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['transfer-brokers-all'], refetchType: 'active' });
      toast.success('Broker creado correctamente');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Ya existe un broker con ese nombre');
      } else {
        toast.error('Error al crear broker');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from('transfer_brokers')
        .update({ name })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-brokers'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['transfer-brokers-all'], refetchType: 'active' });
      toast.success('Broker actualizado');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Ya existe un broker con ese nombre');
      } else {
        toast.error('Error al actualizar broker');
      }
    },
  });

  const updateFullMutation = useMutation({
    mutationFn: async (data: UpdateBrokerFullData) => {
      const { error } = await supabase
        .from('transfer_brokers')
        .update({
          name: data.name,
          company: data.company,
          email: data.email,
          phone: data.phone,
        })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-brokers'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['transfer-brokers-all'], refetchType: 'active' });
      toast.success('Broker actualizado correctamente');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Ya existe un broker con ese nombre');
      } else {
        toast.error('Error al actualizar broker');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiInvoke<{ success: boolean; error?: string }>('delete-broker', { body: { brokerId: id } });
      if (result.error) throw new Error(result.error.message || 'Error al eliminar broker');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-brokers'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['transfer-brokers-all'], refetchType: 'active' });
      toast.success('Broker eliminado completamente');
    },
    onError: () => {
      toast.error('Error al eliminar broker');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('transfer_brokers')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transfer-brokers'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['transfer-brokers-all'], refetchType: 'active' });
      toast.success(variables.is_active ? 'Broker activado' : 'Broker desactivado');
    },
  });

  const setupPortalMutation = useMutation({
    mutationFn: async (data: SetupPortalAccessData): Promise<SetupPortalResponse> => {
      // Setup broker portal access:
      // 1. Find the Supabase Auth user by email
      // 2. Update transfer_brokers.user_id to link the broker to the auth user
      // 3. Create/update broker_profiles for portal access
      try {
        // Update the broker record with the email (actual column that exists)
        const { error } = await (supabase as any)
          .from('transfer_brokers')
          .update({ email: data.email })
          .eq('id', data.brokerId);

        if (error) throw error;
        return { success: true } as SetupPortalResponse;
      } catch (err: any) {
        throw new Error(err?.message || 'Error al configurar acceso al portal');
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['transfer-brokers'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['transfer-brokers-all'], refetchType: 'active' });
      if (result.success && !result.already_linked) {
        toast.success('Acceso al portal configurado');
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al configurar acceso');
    },
  });

  return {
    brokers,
    allBrokers,
    isLoading,
    isLoadingAll: isLoading,
    createBroker: createMutation.mutateAsync,
    updateBroker: updateMutation.mutate,
    updateBrokerFull: updateFullMutation.mutateAsync,
    deleteBroker: deleteMutation.mutate,
    toggleActive: toggleActiveMutation.mutate,
    setupPortalAccess: setupPortalMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateFullMutation.isPending,
    isSettingUpPortal: setupPortalMutation.isPending,
  };
}
