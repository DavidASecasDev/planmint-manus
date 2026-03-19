import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { 
  TimeEntryWithRelations, 
  CreateTimeEntryData, 
  UpdateTimeEntryData,
  TimeTrackingFilters,
  TimerState
} from '@/types/timeTracking';
import { createLogger } from '@/lib/logger';

const log = createLogger({ context: 'TimeTracking' });

export function useTimeTracking(filters?: TimeTrackingFilters) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  // Timer state
  const [timerState, setTimerState] = useState<TimerState>({
    isRunning: false,
    activeEntryId: null,
    startTime: null,
    elapsed: 0,
  });

  // Fetch time entries
  const { data: entries = [], isLoading, refetch } = useQuery({
    queryKey: ['time-entries', profile?.organization_id, filters],
    queryFn: async (): Promise<TimeEntryWithRelations[]> => {
      if (!profile?.organization_id) return [];

      let query = supabase
        .from('time_entries')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('start_time', { ascending: false });

      if (filters?.user_id) {
        query = query.eq('user_id', filters.user_id);
      }
      if (filters?.task_id) {
        query = query.eq('task_id', filters.task_id);
      }
      if (filters?.start_date) {
        query = query.gte('start_time', filters.start_date);
      }
      if (filters?.end_date) {
        query = query.lte('start_time', filters.end_date);
      }
      if (filters?.is_billable !== undefined) {
        query = query.eq('is_billable', filters.is_billable);
      }

      const { data, error } = await query.limit(500);

      if (error) {
        log.error('Error fetching entries:', error);
        throw error;
      }

      const entriesData = (data || []) as TimeEntryWithRelations[];
      
      // Get unique task and user IDs
      const taskIds = [...new Set(entriesData.map(e => e.task_id).filter(Boolean))];
      const userIds = [...new Set(entriesData.map(e => e.user_id))];

      // Fetch tasks
      let tasksMap: Record<string, { id: string; title: string }> = {};
      if (taskIds.length > 0) {
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, title')
          .in('id', taskIds as string[]);
        tasksMap = Object.fromEntries((tasks || []).map(t => [t.id, t]));
      }

      // Fetch users
      let usersMap: Record<string, { id: string; name: string | null }> = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);
        usersMap = Object.fromEntries((users || []).map(u => [u.id, u]));
      }

      // Combine data
      return entriesData.map(entry => ({
        ...entry,
        task: entry.task_id ? tasksMap[entry.task_id] || null : null,
        user: usersMap[entry.user_id] ? { ...usersMap[entry.user_id], avatar_url: null } : null,
      }));
    },
    enabled: !!profile?.organization_id,
  });

  // Check for active timer on mount
  useEffect(() => {
    const checkActiveTimer = async () => {
      if (!profile?.id) return;

      const { data } = await supabase
        .from('time_entries')
        .select('id, start_time')
        .eq('user_id', profile.id)
        .eq('is_running', true)
        .maybeSingle();

      if (data) {
        const startTime = new Date(data.start_time);
        const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
        setTimerState({
          isRunning: true,
          activeEntryId: data.id,
          startTime,
          elapsed,
        });
      }
    };

    checkActiveTimer();
  }, [profile?.id]);

  // Update elapsed time
  useEffect(() => {
    if (!timerState.isRunning || !timerState.startTime) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - timerState.startTime!.getTime()) / 1000);
      setTimerState(prev => ({ ...prev, elapsed }));
    }, 1000);

    return () => clearInterval(interval);
  }, [timerState.isRunning, timerState.startTime]);

  // Start timer mutation
  const startTimerMutation = useMutation({
    mutationFn: async (data: CreateTimeEntryData) => {
      if (!profile?.organization_id || !profile?.id) {
        throw new Error('No organization');
      }

      // Stop any running timer first
      await supabase
        .from('time_entries')
        .update({ 
          is_running: false,
          end_time: new Date().toISOString(),
          duration_minutes: Math.floor(timerState.elapsed / 60)
        })
        .eq('user_id', profile.id)
        .eq('is_running', true);

      const { data: entry, error } = await supabase
        .from('time_entries')
        .insert({
          organization_id: profile.organization_id,
          user_id: profile.id,
          task_id: data.task_id || null,
          description: data.description || null,
          start_time: new Date().toISOString(),
          is_billable: data.is_billable ?? true,
          hourly_rate: data.hourly_rate || null,
          is_running: true,
        })
        .select()
        .single();

      if (error) throw error;
      return entry as { id: string; start_time: string };
    },
    onSuccess: (entry) => {
      setTimerState({
        isRunning: true,
        activeEntryId: entry.id,
        startTime: new Date(entry.start_time),
        elapsed: 0,
      });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      toast.success('Temporizador iniciado');
    },
    onError: (error) => {
      log.error('Error starting timer:', error);
      toast.error('Error al iniciar el temporizador');
    },
  });

  // Stop timer mutation
  const stopTimerMutation = useMutation({
    mutationFn: async () => {
      if (!timerState.activeEntryId) {
        throw new Error('No active timer');
      }

      const durationMinutes = Math.max(1, Math.floor(timerState.elapsed / 60));

      const { data, error } = await supabase
        .from('time_entries')
        .update({
          is_running: false,
          end_time: new Date().toISOString(),
          duration_minutes: durationMinutes,
        })
        .eq('id', timerState.activeEntryId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setTimerState({
        isRunning: false,
        activeEntryId: null,
        startTime: null,
        elapsed: 0,
      });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      toast.success('Tiempo registrado');
    },
    onError: (error) => {
      log.error('Error stopping timer:', error);
      toast.error('Error al detener el temporizador');
    },
  });

  // Create manual entry mutation
  const createEntryMutation = useMutation({
    mutationFn: async (data: CreateTimeEntryData) => {
      if (!profile?.organization_id || !profile?.id) {
        throw new Error('No organization');
      }

      const { data: entry, error } = await supabase
        .from('time_entries')
        .insert({
          organization_id: profile.organization_id,
          user_id: profile.id,
          task_id: data.task_id || null,
          description: data.description || null,
          start_time: data.start_time || new Date().toISOString(),
          end_time: data.end_time || null,
          duration_minutes: data.duration_minutes || null,
          is_billable: data.is_billable ?? true,
          hourly_rate: data.hourly_rate || null,
          is_running: false,
        })
        .select()
        .single();

      if (error) throw error;
      return entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      toast.success('Tiempo registrado');
    },
    onError: (error) => {
      log.error('Error creating entry:', error);
      toast.error('Error al registrar tiempo');
    },
  });

  // Update entry mutation
  const updateEntryMutation = useMutation({
    mutationFn: async (data: UpdateTimeEntryData) => {
      const { id, ...updateData } = data;

      const { data: entry, error } = await supabase
        .from('time_entries')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      toast.success('Entrada actualizada');
    },
    onError: (error) => {
      log.error('Error updating entry:', error);
      toast.error('Error al actualizar');
    },
  });

  // Delete entry mutation
  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      toast.success('Entrada eliminada');
    },
    onError: (error) => {
      log.error('Error deleting entry:', error);
      toast.error('Error al eliminar');
    },
  });

  // Format elapsed time
  const formatElapsed = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Calculate summary
  const summary = {
    total_minutes: entries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0),
    billable_minutes: entries.filter(e => e.is_billable).reduce((sum, e) => sum + (e.duration_minutes || 0), 0),
    total_entries: entries.length,
  };

  return {
    entries,
    isLoading,
    refetch,
    timerState,
    summary,
    formatElapsed,
    startTimer: startTimerMutation.mutate,
    stopTimer: stopTimerMutation.mutate,
    createEntry: createEntryMutation.mutate,
    updateEntry: updateEntryMutation.mutate,
    deleteEntry: deleteEntryMutation.mutate,
    isStartingTimer: startTimerMutation.isPending,
    isStoppingTimer: stopTimerMutation.isPending,
  };
}
