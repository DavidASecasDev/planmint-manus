import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface TransferProvider {
  id: string;
  organization_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export function useTransferProviders() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['transfer-providers', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];

      const { data, error } = await supabaseQuery
        .from('transfer_providers')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as TransferProvider[];
    },
    enabled: !!organization?.id,
  });

  const { data: allProviders = [], isLoading: isLoadingAll } = useQuery({
    queryKey: ['transfer-providers-all', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];

      const { data, error } = await supabaseQuery
        .from('transfer_providers')
        .select('*')
        .eq('organization_id', organization.id)
        .order('name');

      if (error) throw error;
      return data as TransferProvider[];
    },
    enabled: !!organization?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!organization?.id) throw new Error('No organization');

      const { data, error } = await supabaseQuery
        .from('transfer_providers')
        .insert({ organization_id: organization.id, name })
        .select()
        .single();

      if (error) throw error;
      return data as TransferProvider;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-providers'] });
      toast.success('Proveedor añadido');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Ya existe un proveedor con ese nombre');
      } else {
        toast.error('Error al crear proveedor');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabaseQuery
        .from('transfer_providers')
        .update({ name })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-providers'] });
      toast.success('Proveedor actualizado');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Ya existe un proveedor con ese nombre');
      } else {
        toast.error('Error al actualizar proveedor');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseQuery
        .from('transfer_providers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-providers'] });
      toast.success('Proveedor eliminado');
    },
    onError: () => {
      toast.error('Error al eliminar proveedor');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabaseQuery
        .from('transfer_providers')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-providers'] });
    },
  });

  return {
    providers,
    allProviders,
    isLoading,
    isLoadingAll,
    createProvider: createMutation.mutateAsync,
    updateProvider: updateMutation.mutate,
    deleteProvider: deleteMutation.mutate,
    toggleActive: toggleActiveMutation.mutate,
    isCreating: createMutation.isPending,
  };
}
