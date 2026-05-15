import { useState, useCallback } from 'react';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { TaskUpdate } from '@/types/tasks';

interface CreateTaskUpdateData {
  task_id: string;
  text?: string;
  goal_increment_value: number;
}

export function useTaskUpdates(taskId: string | null) {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchUpdates = useCallback(async () => {
    if (!taskId) {
      setUpdates([]);
      setTotalValue(0);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabaseQuery
        .from('task_updates')
        .select('*, profiles:user_id(id, name)')
        .eq('task_id', taskId)
        .eq('type', 'goal_increment')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedUpdates: TaskUpdate[] = (data || []).map((u: any) => ({
        id: u.id,
        task_id: u.task_id,
        user_id: u.user_id,
        text: u.text,
        type: u.type,
        goal_increment_value: u.goal_increment_value,
        created_at: u.created_at,
        user: u.profiles,
      }));

      setUpdates(formattedUpdates);

      // Calculate total
      const total = formattedUpdates.reduce(
        (sum, u) => sum + (u.goal_increment_value || 0),
        0
      );
      setTotalValue(total);
    } catch (error: any) {
      console.error('Error fetching task updates:', error);
      toast.error('Error al cargar los aportes');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const addUpdate = async (data: CreateTaskUpdateData): Promise<boolean> => {
    if (!user?.id) {
      toast.error('No se pudo añadir el aporte');
      return false;
    }

    try {
      const { error } = await supabaseQuery.from('task_updates').insert({
        task_id: data.task_id,
        user_id: user.id,
        text: data.text || null,
        type: 'goal_increment',
        goal_increment_value: data.goal_increment_value,
      });

      if (error) throw error;

      toast.success('Aporte añadido correctamente');
      await fetchUpdates();
      return true;
    } catch (error: any) {
      console.error('Error adding task update:', error);
      toast.error('Error al añadir el aporte');
      return false;
    }
  };

  const deleteUpdate = async (updateId: string): Promise<boolean> => {
    try {
      const { error } = await supabaseQuery
        .from('task_updates')
        .delete()
        .eq('id', updateId);

      if (error) throw error;

      toast.success('Aporte eliminado correctamente');
      await fetchUpdates();
      return true;
    } catch (error: any) {
      console.error('Error deleting task update:', error);
      toast.error('Error al eliminar el aporte');
      return false;
    }
  };

  return {
    updates,
    totalValue,
    loading,
    fetchUpdates,
    addUpdate,
    deleteUpdate,
  };
}
