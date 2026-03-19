import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  eventType: string;
}

export const useActivationChecklist = () => {
  const { user, profile } = useAuth();

  const { data: checklist, isLoading } = useQuery({
    queryKey: ['activation-checklist', user?.id],
    queryFn: async () => {
      if (!user?.id || !profile?.organization_id) {
        return null;
      }

      // Check which events the user has completed
      const { data: events, error } = await supabase
        .from('usage_events')
        .select('event_type')
        .eq('user_id', user.id)
        .in('event_type', [
          'task_created',
          'area_created',
          'kanban_viewed',
          'reminder_created',
          'global_search_opened',
        ]);

      if (error) throw error;

      const completedEvents = new Set(events?.map(e => e.event_type) || []);

      const items: ChecklistItem[] = [
        {
          id: 'task',
          label: 'Crear tu primera tarea',
          completed: completedEvents.has('task_created'),
          eventType: 'task_created',
        },
        {
          id: 'area',
          label: 'Crear tu primera área',
          completed: completedEvents.has('area_created'),
          eventType: 'area_created',
        },
        {
          id: 'kanban',
          label: 'Probar el tablero Kanban',
          completed: completedEvents.has('kanban_viewed'),
          eventType: 'kanban_viewed',
        },
        {
          id: 'reminder',
          label: 'Crear un recordatorio',
          completed: completedEvents.has('reminder_created'),
          eventType: 'reminder_created',
        },
        {
          id: 'search',
          label: 'Probar búsqueda ⌘K',
          completed: completedEvents.has('global_search_opened'),
          eventType: 'global_search_opened',
        },
      ];

      return items;
    },
    enabled: !!user?.id && !!profile?.organization_id,
  });

  const completedCount = checklist?.filter(item => item.completed).length || 0;
  const totalCount = checklist?.length || 5;
  const isComplete = completedCount >= 4; // Complete when 4/5 done
  const progress = (completedCount / totalCount) * 100;

  return {
    checklist,
    isLoading,
    completedCount,
    totalCount,
    isComplete,
    progress,
  };
};
