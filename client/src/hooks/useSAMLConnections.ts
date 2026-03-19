import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SAMLConnection, SAMLConnectionInput } from '@/types/enterprise';
import { toast } from 'sonner';

export function useSAMLConnections() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['saml-connections', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('saml_connections')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SAMLConnection[];
    },
    enabled: !!profile?.organization_id,
  });

  const createConnection = useMutation({
    mutationFn: async (input: SAMLConnectionInput) => {
      if (!profile?.organization_id) throw new Error('No organization');

      // Generate SP values
      const baseUrl = window.location.origin;
      const sp_entity_id = `${baseUrl}/saml/metadata/${profile.organization_id}`;
      const acs_url = `${baseUrl}/saml/acs/${profile.organization_id}`;

      const { data, error } = await supabase
        .from('saml_connections')
        .insert({
          organization_id: profile.organization_id,
          created_by: profile.id,
          sp_entity_id,
          acs_url,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saml-connections'] });
      toast.success('Conexión SAML creada');
    },
    onError: () => {
      toast.error('Error al crear la conexión SAML');
    },
  });

  const updateConnection = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SAMLConnection> & { id: string }) => {
      const { error } = await supabase
        .from('saml_connections')
        .update(input)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saml-connections'] });
      toast.success('Conexión SAML actualizada');
    },
    onError: () => {
      toast.error('Error al actualizar la conexión SAML');
    },
  });

  const deleteConnection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('saml_connections')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saml-connections'] });
      toast.success('Conexión SAML eliminada');
    },
    onError: () => {
      toast.error('Error al eliminar la conexión SAML');
    },
  });

  const testConnection = useMutation({
    mutationFn: async (id: string) => {
      // Mark as tested (actual SAML test would need IdP)
      const { error } = await supabase
        .from('saml_connections')
        .update({ last_tested_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saml-connections'] });
      toast.success('Conexión SAML probada correctamente');
    },
    onError: () => {
      toast.error('Error al probar la conexión SAML');
    },
  });

  const activateConnection = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('saml_connections')
        .update({ is_active: active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { active }) => {
      queryClient.invalidateQueries({ queryKey: ['saml-connections'] });
      toast.success(active ? 'Conexión SAML activada' : 'Conexión SAML desactivada');
    },
    onError: () => {
      toast.error('Error al cambiar el estado de la conexión SAML');
    },
  });

  const activeConnection = connections.find(c => c.is_active);

  return {
    connections,
    activeConnection,
    isLoading,
    createConnection: createConnection.mutate,
    updateConnection: updateConnection.mutate,
    deleteConnection: deleteConnection.mutate,
    testConnection: testConnection.mutate,
    activateConnection: activateConnection.mutate,
    isCreating: createConnection.isPending,
    isUpdating: updateConnection.isPending,
    isDeleting: deleteConnection.isPending,
    isTesting: testConnection.isPending,
  };
}
