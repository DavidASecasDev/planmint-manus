import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { Reminder, ReminderWithTask, RecurrenceType } from '@/types/reminders';
import { toast } from 'sonner';
import { useState } from 'react';
import { createLogger } from '@/lib/logger';

const log = createLogger({ context: 'Reminders' });

interface CreateReminderData {
  task_id: string;
  remind_at: string;
  recurrence_type: RecurrenceType;
  recurrence_interval?: number;
  timezone?: string;
}

interface UpdateReminderData {
  remind_at?: string;
  recurrence_type?: RecurrenceType;
  recurrence_interval?: number;
  is_active?: boolean;
}

export function useReminders(taskId?: string) {
  const queryClient = useQueryClient();

  // Fetch reminders with React Query
  const { data: reminders = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['reminders', taskId],
    queryFn: async (): Promise<Reminder[]> => {
      if (!taskId) return [];

      const { data, error } = await supabaseQuery
        .from('reminders')
        .select('*')
        .eq('task_id', taskId)
        .order('remind_at', { ascending: true });

      if (error) {
        log.error('Error fetching reminders:', error);
        throw error;
      }
      
      return (data || []) as Reminder[];
    },
    enabled: !!taskId,
  });

  // Create reminder mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateReminderData): Promise<Reminder> => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      const { data: newReminder, error } = await supabaseQuery
        .from('reminders')
        .insert({
          task_id: data.task_id,
          remind_at: data.remind_at,
          recurrence_type: data.recurrence_type,
          recurrence_interval: data.recurrence_type === 'once' ? null : (data.recurrence_interval || 1),
          timezone: data.timezone || timezone,
        })
        .select()
        .single();

      if (error) throw error;
      return newReminder as Reminder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', taskId] });
      toast.success('Recordatorio creado');
    },
    onError: (error) => {
      log.error('Error creating reminder:', error);
      toast.error('Error al crear recordatorio');
    },
  });

  // Update reminder mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateReminderData }): Promise<void> => {
      const updateData: Record<string, unknown> = {};
      
      if (data.remind_at !== undefined) updateData.remind_at = data.remind_at;
      if (data.recurrence_type !== undefined) updateData.recurrence_type = data.recurrence_type;
      if (data.recurrence_interval !== undefined) updateData.recurrence_interval = data.recurrence_interval;
      if (data.is_active !== undefined) updateData.is_active = data.is_active;

      const { error } = await supabaseQuery
        .from('reminders')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', taskId] });
      toast.success('Recordatorio actualizado');
    },
    onError: (error) => {
      log.error('Error updating reminder:', error);
      toast.error('Error al actualizar recordatorio');
    },
  });

  // Delete reminder mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabaseQuery
        .from('reminders')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', taskId] });
      toast.success('Recordatorio eliminado');
    },
    onError: (error) => {
      log.error('Error deleting reminder:', error);
      toast.error('Error al eliminar recordatorio');
    },
  });

  // Helper functions that maintain the original API
  const createReminder = async (data: CreateReminderData): Promise<Reminder | null> => {
    try {
      return await createMutation.mutateAsync(data);
    } catch {
      return null;
    }
  };

  const updateReminder = async (id: string, data: UpdateReminderData): Promise<boolean> => {
    try {
      await updateMutation.mutateAsync({ id, data });
      return true;
    } catch {
      return false;
    }
  };

  const toggleReminder = async (id: string, isActive: boolean): Promise<boolean> => {
    return updateReminder(id, { is_active: isActive });
  };

  const deleteReminder = async (id: string): Promise<boolean> => {
    try {
      await deleteMutation.mutateAsync(id);
      return true;
    } catch {
      return false;
    }
  };

  return {
    reminders,
    loading,
    createReminder,
    updateReminder,
    toggleReminder,
    deleteReminder,
    refetch,
  };
}

export function useAllReminders() {
  const { profile } = useAuth();
  const [filters, setFilters] = useState({
    activeOnly: true,
    recurrenceType: 'all' as 'all' | RecurrenceType,
    myTasksOnly: false,
  });

  // Fetch all reminders with React Query
  const { data: reminders = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['all-reminders', profile?.organization_id, profile?.id, filters],
    queryFn: async (): Promise<ReminderWithTask[]> => {
      if (!profile?.organization_id) return [];

      let query = supabaseQuery
        .from('reminders')
        .select(`
          *,
          task:tasks!inner(id, title, status, type, priority, created_by, assigned_to, organization_id)
        `)
        .eq('task.organization_id', profile.organization_id)
        .order('remind_at', { ascending: true });

      if (filters.activeOnly) {
        query = query.eq('is_active', true);
      }

      if (filters.recurrenceType !== 'all') {
        query = query.eq('recurrence_type', filters.recurrenceType);
      }

      const { data, error } = await query;

      if (error) {
        log.error('Error fetching all reminders:', error);
        throw error;
      }

      let filteredData = (data || []) as unknown as ReminderWithTask[];

      if (filters.myTasksOnly && profile.id) {
        filteredData = filteredData.filter(
          (r) => r.task.created_by === profile.id || r.task.assigned_to === profile.id
        );
      }

      return filteredData;
    },
    enabled: !!profile?.organization_id,
  });

  return {
    reminders,
    loading,
    filters,
    setFilters,
    refetch,
  };
}
