import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { CustomRole, RolePermissions, DEFAULT_ROLE_PERMISSIONS } from '@/types/enterprise';
import { toast } from 'sonner';
import { apiInvoke } from '@/lib/apiClient';

export function useCustomRoles() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['custom-roles', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const result = await apiInvoke<{ data: any[]; error: string | null }>('get-org-custom-roles', {
        body: { p_organization_id: profile.organization_id },
      });

      if (result.error || !result.data) {
        console.error('Error fetching custom roles:', result.error?.message);
        return [];
      }

      return (result.data.data || []).map(role => ({
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

      const result = await apiInvoke<{ success?: boolean; error?: string; code?: string }>('manage-custom-role', {
        body: {
          action: 'create',
          p_organization_id: profile.organization_id,
          p_name: name,
          p_description: description,
          p_permissions_json: permissions || DEFAULT_ROLE_PERMISSIONS,
        },
      });

      if (result.error) {
        const err: any = new Error(result.error.message);
        // Check if the backend returned a code for duplicate name
        err.code = (result.data as any)?.code;
        throw err;
      }
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
      const result = await apiInvoke('manage-custom-role', {
        body: {
          action: 'update',
          p_role_id: id,
          p_name: name,
          p_description: description,
          p_permissions_json: permissions,
        },
      });

      if (result.error) throw new Error(result.error.message);
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
      const result = await apiInvoke('manage-custom-role', {
        body: {
          action: 'delete',
          p_role_id: id,
        },
      });

      if (result.error) throw new Error(result.error.message);
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
    updateRoleAsync: updateRole.mutateAsync,
    deleteRole: deleteRole.mutate,
    isCreating: createRole.isPending,
    isUpdating: updateRole.isPending,
  };
}
