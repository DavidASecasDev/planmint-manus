import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CustomRole, RolePermissions, DEFAULT_ROLE_PERMISSIONS } from '@/types/enterprise';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

export function useCustomRoles() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['custom-roles', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('custom_roles')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('is_system', { ascending: false })
        .order('name');

      if (error) throw error;
      return data.map(role => ({
        ...role,
        permissions_json: role.permissions_json as unknown as RolePermissions
      })) as CustomRole[];
    },
    enabled: !!profile?.organization_id,
  });

  const createRole = useMutation({
    mutationFn: async ({
      name,
      description,
      permissions,
    }: {
      name: string;
      description?: string;
      permissions?: RolePermissions;
    }) => {
      if (!profile?.organization_id) throw new Error('No organization');

      const { error } = await supabase.from('custom_roles').insert({
        organization_id: profile.organization_id,
        name,
        description,
        permissions_json: (permissions || DEFAULT_ROLE_PERMISSIONS) as unknown as Json,
        is_system: false,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-roles'] });
      toast.success('Rol creado correctamente');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Ya existe un rol con ese nombre');
      } else {
        toast.error('Error al crear el rol');
      }
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({
      id,
      name,
      description,
      permissions,
    }: {
      id: string;
      name?: string;
      description?: string;
      permissions?: RolePermissions;
    }) => {
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (permissions !== undefined) updates.permissions_json = permissions as unknown as Json;

      const { error } = await supabase
        .from('custom_roles')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-roles'] });
      toast.success('Rol actualizado correctamente');
    },
    onError: () => {
      toast.error('Error al actualizar el rol');
    },
  });

  const deleteRole = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_roles')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-roles'] });
      toast.success('Rol eliminado correctamente');
    },
    onError: () => {
      toast.error('Error al eliminar el rol');
    },
  });

  const systemRoles = roles.filter((r) => r.is_system);
  const customRoles = roles.filter((r) => !r.is_system);

  return {
    roles,
    systemRoles,
    customRoles,
    isLoading,
    createRole: createRole.mutate,
    updateRole: updateRole.mutate,
    deleteRole: deleteRole.mutate,
    isCreating: createRole.isPending,
    isUpdating: updateRole.isPending,
  };
}
