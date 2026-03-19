import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { Tag, CreateTagData, UpdateTagData } from '@/types/tags';

export function useTags() {
  const { profile } = useAuth();
  const { hasPermission, isAdmin, isLoading: permissionsLoading } = usePermissions();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  // Use specific permission check for managing tags - wait for permissions to load
  const canManageTags = !permissionsLoading && (isAdmin || hasPermission('tasks.create'));

  const fetchTags = useCallback(async () => {
    if (!profile?.organization_id) {
      setTags([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('name');

      if (error) throw error;

      setTags(data || []);
    } catch (error: any) {
      console.error('Error fetching tags:', error);
      toast.error('Error al cargar las etiquetas');
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const createTag = async (data: CreateTagData): Promise<Tag | null> => {
    if (!profile?.organization_id) {
      toast.error('No se pudo crear la etiqueta');
      return null;
    }

    try {
      const { data: newTag, error } = await supabase
        .from('tags')
        .insert({
          organization_id: profile.organization_id,
          name: data.name,
          color: data.color,
          icon: data.icon,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('Ya existe una etiqueta con ese nombre en tu organización');
          return null;
        }
        throw error;
      }

      toast.success('Etiqueta creada correctamente');
      setTags(prev => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
      return newTag;
    } catch (error: any) {
      console.error('Error creating tag:', error);
      toast.error('Error al crear la etiqueta');
      return null;
    }
  };

  const updateTag = async (id: string, data: UpdateTagData): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('tags')
        .update(data)
        .eq('id', id);

      if (error) {
        if (error.code === '23505') {
          toast.error('Ya existe una etiqueta con ese nombre en tu organización');
          return false;
        }
        throw error;
      }

      toast.success('Etiqueta actualizada correctamente');
      setTags(prev =>
        prev
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
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Etiqueta eliminada correctamente');
      setTags(prev => prev.filter(t => t.id !== id));
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
