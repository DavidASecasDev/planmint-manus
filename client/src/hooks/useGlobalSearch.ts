import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SearchResult {
  id: string;
  type: 'task' | 'area' | 'tag' | 'subtask' | 'milestone' | 'update' | 'repair' | 'workshop' | 'accident';
  title: string;
  subtitle?: string;
  metadata?: {
    taskId?: string;
    taskTitle?: string;
    status?: string;
    priority?: string;
    taskType?: string;
    color?: string;
    icon?: string;
    authorName?: string;
    createdAt?: string;
    repairType?: string;
    severity?: string;
    matricula?: string;
  };
}

interface UseGlobalSearchReturn {
  results: SearchResult[];
  loading: boolean;
  search: (query: string) => Promise<void>;
  clearResults: () => void;
}

export function useGlobalSearch(): UseGlobalSearchReturn {
  const { profile } = useAuth();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query.trim() || !profile?.organization_id) {
      setResults([]);
      return;
    }

    setLoading(true);
    const searchTerm = `%${query.trim()}%`;
    const allResults: SearchResult[] = [];

    try {
      // Search tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, description, status, priority, type, assigned_to')
        .eq('organization_id', profile.organization_id)
        .eq('is_archived', false)
        .or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`)
        .limit(5);

      if (tasks) {
        tasks.forEach(task => {
          allResults.push({
            id: task.id,
            type: 'task',
            title: task.title,
            subtitle: task.description?.substring(0, 60) || undefined,
            metadata: {
              status: task.status,
              priority: task.priority,
              taskType: task.type,
            },
          });
        });
      }

      // Search areas
      const { data: areas } = await supabase
        .from('areas')
        .select('id, name, description, color, icon')
        .eq('organization_id', profile.organization_id)
        .eq('is_archived', false)
        .or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
        .limit(5);

      if (areas) {
        areas.forEach(area => {
          allResults.push({
            id: area.id,
            type: 'area',
            title: area.name,
            subtitle: area.description || undefined,
            metadata: {
              color: area.color || undefined,
              icon: area.icon || undefined,
            },
          });
        });
      }

      // Search tags
      const { data: tags } = await supabase
        .from('tags')
        .select('id, name, color, icon')
        .eq('organization_id', profile.organization_id)
        .ilike('name', searchTerm)
        .limit(5);

      if (tags) {
        tags.forEach(tag => {
          allResults.push({
            id: tag.id,
            type: 'tag',
            title: tag.name,
            metadata: {
              color: tag.color,
              icon: tag.icon,
            },
          });
        });
      }

      // Search subtasks - need to join with tasks to filter by organization
      const { data: subtasks } = await supabase
        .from('task_subtasks')
        .select(`
          id, 
          title, 
          task_id,
          tasks!inner(id, title, organization_id)
        `)
        .eq('tasks.organization_id', profile.organization_id)
        .ilike('title', searchTerm)
        .limit(5);

      if (subtasks) {
        subtasks.forEach((subtask: any) => {
          allResults.push({
            id: subtask.id,
            type: 'subtask',
            title: subtask.title,
            subtitle: `Tarea: ${subtask.tasks?.title}`,
            metadata: {
              taskId: subtask.task_id,
              taskTitle: subtask.tasks?.title,
            },
          });
        });
      }

      // Search milestones
      const { data: milestones } = await supabase
        .from('task_milestones')
        .select(`
          id, 
          title, 
          description,
          task_id,
          parent_milestone_id,
          tasks!inner(id, title, organization_id)
        `)
        .eq('tasks.organization_id', profile.organization_id)
        .or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`)
        .limit(5);

      if (milestones) {
        milestones.forEach((milestone: any) => {
          const isSubMilestone = !!milestone.parent_milestone_id;
          allResults.push({
            id: milestone.id,
            type: 'milestone',
            title: milestone.title,
            subtitle: isSubMilestone 
              ? `Sub-hito de tarea: ${milestone.tasks?.title}` 
              : `Tarea: ${milestone.tasks?.title}`,
            metadata: {
              taskId: milestone.task_id,
              taskTitle: milestone.tasks?.title,
            },
          });
        });
      }

      // Search updates
      const { data: updates } = await supabase
        .from('task_updates')
        .select(`
          id, 
          text, 
          created_at,
          user_id,
          task_id,
          tasks!inner(id, title, organization_id),
          profiles:user_id(name)
        `)
        .eq('tasks.organization_id', profile.organization_id)
        .not('text', 'is', null)
        .ilike('text', searchTerm)
        .order('created_at', { ascending: false })
        .limit(5);

      if (updates) {
        updates.forEach((update: any) => {
          allResults.push({
            id: update.id,
            type: 'update',
            title: update.text?.substring(0, 80) || 'Actualización',
            subtitle: `Tarea: ${update.tasks?.title}`,
            metadata: {
              taskId: update.task_id,
              taskTitle: update.tasks?.title,
              authorName: update.profiles?.name,
              createdAt: update.created_at,
            },
          });
        });
      }

      // Search repairs (Garatech)
      const { data: repairs } = await supabase
        .from('repairs')
        .select('id, repair_number, description, status, repair_type, vehicle:vehicles(matricula, modelo), workshop:workshops(name)')
        .eq('organization_id', profile.organization_id)
        .or(`repair_number.ilike.${searchTerm},description.ilike.${searchTerm}`)
        .order('created_at', { ascending: false })
        .limit(5);

      if (repairs) {
        repairs.forEach((repair: any) => {
          allResults.push({
            id: repair.id,
            type: 'repair',
            title: repair.repair_number || 'Reparación',
            subtitle: repair.description?.substring(0, 60) || undefined,
            metadata: {
              status: repair.status,
              repairType: repair.repair_type,
              matricula: repair.vehicle?.matricula,
            },
          });
        });
      }

      // Search workshops (Garatech)
      const { data: workshops } = await supabase
        .from('workshops')
        .select('id, name, city, phone')
        .eq('organization_id', profile.organization_id)
        .or(`name.ilike.${searchTerm},city.ilike.${searchTerm}`)
        .limit(5);

      if (workshops) {
        workshops.forEach((workshop: any) => {
          allResults.push({
            id: workshop.id,
            type: 'workshop',
            title: workshop.name,
            subtitle: [workshop.city, workshop.phone].filter(Boolean).join(' · ') || undefined,
          });
        });
      }

      // Search accidents (Garatech)
      const { data: accidents } = await supabase
        .from('accidents')
        .select('id, accident_number, description, severity, status, vehicle:vehicles(matricula)')
        .eq('organization_id', profile.organization_id)
        .or(`accident_number.ilike.${searchTerm},description.ilike.${searchTerm}`)
        .order('accident_date', { ascending: false })
        .limit(5);

      if (accidents) {
        accidents.forEach((accident: any) => {
          allResults.push({
            id: accident.id,
            type: 'accident',
            title: accident.accident_number || 'Accidente',
            subtitle: accident.description?.substring(0, 60) || undefined,
            metadata: {
              status: accident.status,
              severity: accident.severity,
              matricula: accident.vehicle?.matricula,
            },
          });
        });
      }

      setResults(allResults);
    } catch (error) {
      console.error('Error searching:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id]);

  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  return { results, loading, search, clearResults };
}
