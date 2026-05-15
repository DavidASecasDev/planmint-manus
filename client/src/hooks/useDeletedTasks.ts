import { useState, useEffect, useCallback } from 'react';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { differenceInDays } from 'date-fns';

export interface DeletedTask {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  created_by: string;
  created_at: string;
  deleted_at: string;
  deleted_by: string;
  deleter?: {
    id: string;
    name: string | null;
  };
  daysUntilPermanentDelete: number;
}

export function useDeletedTasks() {
  const { user, profile } = useAuth();
  const { role } = usePermissions();
  const [deletedTasks, setDeletedTasks] = useState<DeletedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const canAccessTrash = role === 'owner' || role === 'admin';

  const fetchDeletedTasks = useCallback(async () => {
    if (!profile?.organization_id || !canAccessTrash) {
      setDeletedTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabaseQuery
        .from('tasks')
        .select('id, organization_id, title, description, type, status, priority, created_by, created_at, deleted_at, deleted_by')
        .eq('organization_id', profile.organization_id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (search) {
        query = query.ilike('title', `%${search}%`);
      }

      const { data: tasksData, error: tasksError } = await query;

      if (tasksError) throw tasksError;

      if (!tasksData || tasksData.length === 0) {
        setDeletedTasks([]);
        setLoading(false);
        return;
      }

      // Fetch deleter profiles
      const deleterIds = Array.from(new Set(tasksData.map((t: any) => t.deleted_by).filter((id: any): id is string => !!id)));
      
      let profilesMap = new Map<string, { id: string; name: string | null }>();
      
      if (deleterIds.length > 0) {
        const { data: profilesData } = await supabaseQuery
          .from('profiles')
          .select('id, name')
          .in('id', deleterIds);
        
        profilesMap = new Map(profilesData?.map((p: any) => [p.id, p]) || []);
      }

      const now = new Date();
      const tasksWithMetadata: DeletedTask[] = tasksData.map((task: any) => {
        const deletedDate = new Date(task.deleted_at!);
        const daysSinceDeleted = differenceInDays(now, deletedDate);
        const daysUntilPermanentDelete = Math.max(0, 30 - daysSinceDeleted);
        
        return {
          ...task,
          deleted_at: task.deleted_at!,
          deleted_by: task.deleted_by!,
          deleter: task.deleted_by ? profilesMap.get(task.deleted_by) : undefined,
          daysUntilPermanentDelete,
        };
      });

      setDeletedTasks(tasksWithMetadata);
    } catch (error) {
      console.error('Error fetching deleted tasks:', error);
      toast.error('Error al cargar las tareas eliminadas');
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id, canAccessTrash, search]);

  useEffect(() => {
    fetchDeletedTasks();
  }, [fetchDeletedTasks]);

  const restoreTask = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabaseQuery
        .from('tasks')
        .update({
          deleted_at: null,
          deleted_by: null,
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Tarea restaurada correctamente');
      await fetchDeletedTasks();
      return true;
    } catch (error) {
      console.error('Error restoring task:', error);
      toast.error('Error al restaurar la tarea');
      return false;
    }
  };

  const permanentlyDeleteTask = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabaseQuery
        .from('tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Tarea eliminada permanentemente');
      await fetchDeletedTasks();
      return true;
    } catch (error) {
      console.error('Error permanently deleting task:', error);
      toast.error('Error al eliminar la tarea permanentemente');
      return false;
    }
  };

  const emptyTrash = async (): Promise<boolean> => {
    if (!profile?.organization_id) return false;

    try {
      const { error } = await supabaseQuery
        .from('tasks')
        .delete()
        .eq('organization_id', profile.organization_id)
        .not('deleted_at', 'is', null);

      if (error) throw error;

      toast.success('Papelera vaciada correctamente');
      await fetchDeletedTasks();
      return true;
    } catch (error) {
      console.error('Error emptying trash:', error);
      toast.error('Error al vaciar la papelera');
      return false;
    }
  };

  return {
    deletedTasks,
    loading,
    search,
    setSearch,
    canAccessTrash,
    restoreTask,
    permanentlyDeleteTask,
    emptyTrash,
    refetch: fetchDeletedTasks,
  };
}
