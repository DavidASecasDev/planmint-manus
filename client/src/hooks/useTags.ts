import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { Tag, CreateTagData, UpdateTagData } from '@/types/tags';

export function useTags() {
  const { profile } = useAuth();
  const { hasPermission, isAdmin, isLoading: permissionsLoading } = usePermissions();
  const queryClient = useQueryClient();

  const orgId = profile?.organization_id;

  // Use specific permission check for managing tags - wait for permissions to load
  const canManageTags = !permissionsLoading && (isAdmin || hasPermission('tasks.create'));

  const { data: tags = [], isLoading: loading, refetch: fetchTags } = useQuery({
    queryKey: ['tags', orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabaseQuery
        .from('tags')
        .select('*')
        .eq('organization_id', orgId)
        .order('name');

      if (error) throw error;
      return (data || []) as Tag[];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes - tags rarely change
  });

  const createTag = async (data: CreateTagData): Promise<Tag | null> => {
    if (!orgId) {
      toast.error('No se pudo crear la etiqueta');
      return null;
    }

    try {
      const { data: newTag, error } = await supabaseQuery
        .from('tags')
        .insert({
          organization_id: orgId,
          name: data.name,
          color: data.color,
          icon: data.icon,
        })
        .select()
        .single();

      if (error) {
        if ((error as any).code === '23505') {
          toast.error('Ya existe una etiqueta con ese nombre en tu organización');
          return null;
        }
        throw error;
      }

      toast.success('Etiqueta creada correctamente');
      // Optimistic update: add to cache
      queryClient.setQueryData(['tags', orgId], (old: Tag[] | undefined) =>
        [...(old || []), newTag].sort((a, b) => a.name.localeCompare(b.name))
      );
      return newTag;
    } catch (error: any) {
      console.error('Error creating tag:', error);
      toast.error('Error al crear la etiqueta');
      return null;
    }
  };

  const updateTag = async (id: string, data: UpdateTagData): Promise<boolean> => {
    try {
      const { error } = await supabaseQuery
        .from('tags')
        .update(data)
        .eq('id', id);

      if (error) {
        if ((error as any).code === '23505') {
          toast.error('Ya existe una etiqueta con ese nombre en tu organización');
          return false;
        }
        throw error;
      }

      toast.success('Etiqueta actualizada correctamente');
      // Optimistic update: modify in cache
      queryClient.setQueryData(['tags', orgId], (old: Tag[] | undefined) =>
        (old || [])
          .map(t => (t.id === id ? { ...t, ...data } : t))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      return true;
    } catch (error: any) {
      console.error('Error updating tag:', error);
      toast.error('Error al actualizar la etiqueta');
      return false;
    }
  };

  const deleteTag = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabaseQuery
        .from('tags')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Etiqueta eliminada correctamente');
      // Optimistic update: remove from cache
      queryClient.setQueryData(['tags', orgId], (old: Tag[] | undefined) =>
        (old || []).filter(t => t.id !== id)
      );
      return true;
    } catch (error: any) {
      console.error('Error deleting tag:', error);
      toast.error('Error al eliminar la etiqueta');
      return false;
    }
  };

  return {
    tags,
    loading,
    canManageTags,
    fetchTags,
    createTag,
    updateTag,
    deleteTag,
  };
}
