import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SCIMIdentity, SCIMGroup, SCIMGroupMembership, SCIMGroupMapping } from '@/types/enterprise';
import { toast } from 'sonner';

export function useSCIMProvisioning() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // SCIM Identities
  const { data: identities = [], isLoading: isLoadingIdentities } = useQuery({
    queryKey: ['scim-identities', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('scim_identities')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SCIMIdentity[];
    },
    enabled: !!profile?.organization_id,
  });

  // SCIM Groups
  const { data: groups = [], isLoading: isLoadingGroups } = useQuery({
    queryKey: ['scim-groups', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('scim_groups')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('display_name', { ascending: true });

      if (error) throw error;
      return data as SCIMGroup[];
    },
    enabled: !!profile?.organization_id,
  });

  // SCIM Group Memberships
  const { data: memberships = [], isLoading: isLoadingMemberships } = useQuery({
    queryKey: ['scim-group-memberships', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('scim_group_memberships')
        .select('*')
        .eq('organization_id', profile.organization_id);

      if (error) throw error;
      return data as SCIMGroupMembership[];
    },
    enabled: !!profile?.organization_id,
  });

  // SCIM Group Mappings
  const { data: mappings = [], isLoading: isLoadingMappings } = useQuery({
    queryKey: ['scim-group-mappings', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('scim_group_mappings')
        .select('*')
        .eq('organization_id', profile.organization_id);

      if (error) throw error;
      return data as SCIMGroupMapping[];
    },
    enabled: !!profile?.organization_id,
  });

  // Create/Update Group Mapping
  const upsertMapping = useMutation({
    mutationFn: async (input: {
      scim_group_id: string;
      map_to_type: 'role' | 'team';
      map_to_id: string;
      priority?: number;
    }) => {
      if (!profile?.organization_id) throw new Error('No organization');

      const existing = mappings.find(m => m.scim_group_id === input.scim_group_id);

      if (existing) {
        const { error } = await supabase
          .from('scim_group_mappings')
          .update({
            map_to_type: input.map_to_type,
            map_to_id: input.map_to_id,
            priority: input.priority ?? 0,
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('scim_group_mappings')
          .insert({
            organization_id: profile.organization_id,
            scim_group_id: input.scim_group_id,
            map_to_type: input.map_to_type,
            map_to_id: input.map_to_id,
            priority: input.priority ?? 0,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scim-group-mappings'] });
      toast.success('Mapeo de grupo actualizado');
    },
    onError: () => {
      toast.error('Error al actualizar el mapeo de grupo');
    },
  });

  // Delete Group Mapping
  const deleteMapping = useMutation({
    mutationFn: async (scimGroupId: string) => {
      const { error } = await supabase
        .from('scim_group_mappings')
        .delete()
        .eq('scim_group_id', scimGroupId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scim-group-mappings'] });
      toast.success('Mapeo de grupo eliminado');
    },
    onError: () => {
      toast.error('Error al eliminar el mapeo de grupo');
    },
  });

  // Deactivate SCIM User
  const deactivateUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('scim_identities')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('organization_id', profile?.organization_id ?? '');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scim-identities'] });
      toast.success('Usuario SCIM desactivado');
    },
    onError: () => {
      toast.error('Error al desactivar el usuario SCIM');
    },
  });

  // Get group members count
  const getGroupMembersCount = (groupId: string) => {
    return memberships.filter(m => m.scim_group_id === groupId).length;
  };

  // Get mapping for a group
  const getGroupMapping = (groupId: string) => {
    return mappings.find(m => m.scim_group_id === groupId);
  };

  return {
    identities,
    groups,
    memberships,
    mappings,
    isLoading: isLoadingIdentities || isLoadingGroups || isLoadingMemberships || isLoadingMappings,
    upsertMapping: upsertMapping.mutate,
    deleteMapping: deleteMapping.mutate,
    deactivateUser: deactivateUser.mutate,
    getGroupMembersCount,
    getGroupMapping,
    isUpdating: upsertMapping.isPending,
    isDeleting: deleteMapping.isPending,
  };
}
