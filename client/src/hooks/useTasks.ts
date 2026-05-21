import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { ERROR_MESSAGES, createErrorHandler } from '@/lib/errorHandler';
import { apiInvoke } from '@/lib/apiClient';
import {
  Task,
  TaskWithRelations,
  CreateTaskData,
  UpdateTaskData,
  TaskFilters,
} from '@/types/tasks';

const errorHandler = createErrorHandler('useTasks');

// ─── Query key factory ────────────────────────────────────────────────────────
const taskKeys = {
  all: (orgId: string | null | undefined) => ['tasks', orgId] as const,
  list: (orgId: string | null | undefined, filters: TaskFilters) => ['tasks', orgId, filters] as const,
  detail: (id: string) => ['tasks', 'detail', id] as const,
};

// ─── Fetch helpers (extracted from the old monolithic fetchTasks) ─────────────

async function fetchTaskAssigneeIds(
  orgId: string,
  userId: string,
  filters: TaskFilters
): Promise<Set<string> | null> {
  if (!filters.onlyMine) return null;

  // Get user's team IDs
  const { data: userTeams } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId);

  const userTeamIds = userTeams?.map(t => t.team_id) || [];

  // Get task IDs from task_assignees where user or their teams are assigned
  let assigneesQuery = supabase
    .from('task_assignees')
    .select('task_id')
    .eq('organization_id', orgId);

  if (userTeamIds.length > 0) {
    assigneesQuery = assigneesQuery.or(`user_id.eq.${userId},team_id.in.(${userTeamIds.join(',')})`);
  } else {
    assigneesQuery = assigneesQuery.eq('user_id', userId);
  }

  const { data: assignees } = await assigneesQuery;
  return new Set(assignees?.map(a => a.task_id) || []);
}

async function fetchMemberAssignedTaskIds(
  orgId: string,
  assigneeId: string
): Promise<Set<string>> {
  // 1. Get teams the selected member belongs to
  const { data: memberTeams } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', assigneeId);

  const memberTeamIds = memberTeams?.map(t => t.team_id) || [];

  // 2. Get task IDs assigned directly to the member
  const { data: directAssignees } = await supabase
    .from('task_assignees')
    .select('task_id')
    .eq('organization_id', orgId)
    .eq('user_id', assigneeId);

  // 3. Get task IDs assigned to teams the member belongs to
  let teamAssignees: { task_id: string }[] = [];
  if (memberTeamIds.length > 0) {
    const { data } = await supabase
      .from('task_assignees')
      .select('task_id')
      .eq('organization_id', orgId)
      .in('team_id', memberTeamIds);
    teamAssignees = data || [];
  }

  return new Set([
    ...(directAssignees?.map(a => a.task_id) || []),
    ...(teamAssignees.map(a => a.task_id)),
  ]);
}

async function fetchTasksWithRelations(
  orgId: string,
  userId: string,
  filters: TaskFilters
): Promise<TaskWithRelations[]> {
  // Pre-fetch assignee IDs if needed
  const myAssignedTaskIds = await fetchTaskAssigneeIds(orgId, userId, filters);

  // Build main query
  let query = supabase
    .from('tasks')
    .select('*')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (!filters.showArchived) {
    query = query.eq('is_archived', false);
  }
  if (filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters.priority !== 'all') {
    query = query.eq('priority', filters.priority);
  }
  if (filters.search) {
    query = query.ilike('title', `%${filters.search}%`);
  }
  if (filters.type !== 'all') {
    query = query.eq('type', filters.type);
  }

  const { data: tasksData, error: tasksError } = await query;
  if (tasksError) throw tasksError;

  // Apply onlyMine filter client-side
  let filteredTasksData = tasksData || [];
  if (filters.onlyMine && myAssignedTaskIds) {
    filteredTasksData = filteredTasksData.filter(task =>
      task.assigned_to === userId || myAssignedTaskIds.has(task.id)
    );
  }

  // Apply assigneeId filter
  if (filters.assigneeId && filters.assigneeId !== 'all') {
    const memberAssignedTaskIds = await fetchMemberAssignedTaskIds(orgId, filters.assigneeId);
    filteredTasksData = filteredTasksData.filter(task =>
      task.assigned_to === filters.assigneeId || memberAssignedTaskIds.has(task.id)
    );
  }

  if (filteredTasksData.length === 0) return [];

  const taskIds = filteredTasksData.map(t => t.id);

  // Parallel fetch of all relations
  const [
    taskAreasResult,
    taskTagsResult,
    subtasksResult,
    taskAssigneesResult,
  ] = await Promise.all([
    supabase.from('task_areas').select('task_id, area_id, areas(id, name, color, icon)').in('task_id', taskIds),
    supabase.from('task_tags').select('task_id, tag_id, tags(id, name, color, icon)').in('task_id', taskIds),
    supabase.from('task_subtasks').select('task_id, status').in('task_id', taskIds),
    supabase.from('task_assignees').select(`
      task_id, user_id, team_id,
      user:profiles!task_assignees_user_id_fkey(id, name, avatar_url),
      team:teams!task_assignees_team_id_fkey(id, name, color)
    `).in('task_id', taskIds),
  ]);

  if (taskAreasResult.error) throw taskAreasResult.error;
  if (taskTagsResult.error) throw taskTagsResult.error;
  if (subtasksResult.error) throw subtasksResult.error;

  // Fetch goal updates for goal_numeric tasks
  const goalTaskIds = filteredTasksData.filter(t => t.type === 'goal_numeric').map(t => t.id);
  const goalTotalsMap = new Map<string, number>();
  if (goalTaskIds.length > 0) {
    const { data: updatesData, error: updatesError } = await supabase
      .from('task_updates')
      .select('task_id, goal_increment_value')
      .in('task_id', goalTaskIds)
      .eq('type', 'goal_increment');
    if (updatesError) throw updatesError;
    updatesData?.forEach((u: any) => {
      goalTotalsMap.set(u.task_id, (goalTotalsMap.get(u.task_id) || 0) + (u.goal_increment_value || 0));
    });
  }

  // Fetch milestone counts for goal_milestones tasks
  const milestoneTaskIds = filteredTasksData.filter(t => t.type === 'goal_milestones').map(t => t.id);
  const milestoneTotalsMap = new Map<string, { total: number; completed: number }>();
  if (milestoneTaskIds.length > 0) {
    const { data: milestonesData, error: milestonesError } = await supabase
      .from('task_milestones')
      .select('task_id, status')
      .in('task_id', milestoneTaskIds);
    if (milestonesError) throw milestonesError;
    milestonesData?.forEach((m: any) => {
      if (!milestoneTotalsMap.has(m.task_id)) {
        milestoneTotalsMap.set(m.task_id, { total: 0, completed: 0 });
      }
      const counts = milestoneTotalsMap.get(m.task_id)!;
      counts.total++;
      if (m.status === 'done') counts.completed++;
    });
  }

  // Fetch profiles
  const profileIds = new Set<string>();
  filteredTasksData.forEach(t => {
    profileIds.add(t.created_by);
    if (t.assigned_to) profileIds.add(t.assigned_to);
  });
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', Array.from(profileIds));
  if (profilesError) throw profilesError;
  const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

  // Build maps
  const taskAreasMap = new Map<string, { id: string; name: string; color: string | null; icon: string | null }[]>();
  taskAreasResult.data?.forEach((ta: any) => {
    if (!taskAreasMap.has(ta.task_id)) taskAreasMap.set(ta.task_id, []);
    if (ta.areas) taskAreasMap.get(ta.task_id)!.push(ta.areas);
  });

  const taskTagsMap = new Map<string, { id: string; name: string; color: string; icon: string }[]>();
  taskTagsResult.data?.forEach((tt: any) => {
    if (!taskTagsMap.has(tt.task_id)) taskTagsMap.set(tt.task_id, []);
    if (tt.tags) taskTagsMap.get(tt.task_id)!.push(tt.tags);
  });

  const subtaskCountsMap = new Map<string, { total: number; completed: number }>();
  subtasksResult.data?.forEach((s: any) => {
    if (!subtaskCountsMap.has(s.task_id)) subtaskCountsMap.set(s.task_id, { total: 0, completed: 0 });
    const counts = subtaskCountsMap.get(s.task_id)!;
    counts.total++;
    if (s.status === 'done') counts.completed++;
  });

  const taskAssigneesMap = new Map<string, { users: { id: string; name: string | null; avatar_url?: string | null }[]; teams: { id: string; name: string; color: string }[] }>();
  taskAssigneesResult.data?.forEach((ta: any) => {
    if (!taskAssigneesMap.has(ta.task_id)) taskAssigneesMap.set(ta.task_id, { users: [], teams: [] });
    const assignees = taskAssigneesMap.get(ta.task_id)!;
    if (ta.user) assignees.users.push(ta.user);
    if (ta.team) assignees.teams.push(ta.team);
  });

  // Filter by area if needed
  let finalTasks = filteredTasksData;
  if (filters.areaIds.length > 0) {
    finalTasks = finalTasks.filter(t => {
      const taskAreas = taskAreasMap.get(t.id) || [];
      return filters.areaIds.every(areaId => taskAreas.some(a => a.id === areaId));
    });
  }

  // Filter by tags if needed (AND logic)
  if (filters.tagIds.length > 0) {
    finalTasks = finalTasks.filter(t => {
      const taskTags = taskTagsMap.get(t.id) || [];
      return filters.tagIds.every(tagId => taskTags.some(tag => tag.id === tagId));
    });
  }

  // Combine data
  return finalTasks.map(task => {
    const subtaskCounts = subtaskCountsMap.get(task.id);
    const milestoneCounts = milestoneTotalsMap.get(task.id);
    const assigneesData = taskAssigneesMap.get(task.id) || { users: [], teams: [] };
    return {
      ...task,
      type: task.type as TaskWithRelations['type'],
      status: task.status as TaskWithRelations['status'],
      priority: task.priority as TaskWithRelations['priority'],
      operation_type: task.operation_type as TaskWithRelations['operation_type'],
      location_type: task.location_type as TaskWithRelations['location_type'],
      areas: taskAreasMap.get(task.id) || [],
      tags: taskTagsMap.get(task.id) || [],
      creator: profilesMap.get(task.created_by),
      assignee: task.assigned_to ? profilesMap.get(task.assigned_to) : null,
      assignees: assigneesData,
      subtaskCount: subtaskCounts?.total || 0,
      subtaskCompleted: subtaskCounts?.completed || 0,
      goalCurrentValue: goalTotalsMap.get(task.id) || 0,
      milestoneCount: milestoneCounts?.total || 0,
      milestoneCompleted: milestoneCounts?.completed || 0,
    } as TaskWithRelations;
  });
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export function useTasks() {
  const { user, profile } = useAuth();
  const { hasPermission, role, isLoading: permissionsLoading } = usePermissions();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<TaskFilters>({
    status: 'all',
    priority: 'all',
    type: 'all',
    areaIds: [],
    tagIds: [],
    onlyMine: false,
    showArchived: false,
    search: '',
    assigneeId: 'all',
  });

  // Use permissions from RPC - only evaluate when permissions are loaded
  const canCreate = !permissionsLoading && hasPermission('tasks.create');
  const canEditAny = !permissionsLoading && hasPermission('tasks.update');
  const canDeleteAny = !permissionsLoading && hasPermission('tasks.delete');
  const canChangeStatus = !permissionsLoading && hasPermission('tasks.change_status');

  const orgId = profile?.organization_id;
  const userId = user?.id;

  // ─── Main query (replaces useState + useEffect + fetchTasks) ────────────────
  const {
    data: tasks = [],
    isLoading: queryLoading,
    refetch,
  } = useQuery({
    queryKey: taskKeys.list(orgId, filters),
    queryFn: () => fetchTasksWithRelations(orgId!, userId!, filters),
    enabled: !!orgId && !!userId,
    staleTime: 3 * 60_000, // 3 minutes
    retry: 1,
    retryDelay: 1000,
  });

  // Combined loading state
  const loading = queryLoading || permissionsLoading;

  // Helper: check if user is a participant of a task
  const isTaskParticipant = useCallback(
    (task: TaskWithRelations | Task) => {
      if (!userId) return false;
      if (task.created_by === userId) return true;
      if (task.assigned_to === userId) return true;
      if ('assignees' in task && task.assignees) {
        return task.assignees.users?.some((u: { id: string }) => u.id === userId) ?? false;
      }
      return false;
    },
    [userId]
  );

  const canEditTask = useCallback(
    (task: TaskWithRelations | Task) => {
      if (['owner', 'admin', 'manager'].includes(role || '')) return true;
      if (canEditAny) return isTaskParticipant(task);
      return isTaskParticipant(task);
    },
    [canEditAny, role, isTaskParticipant]
  );

  const canDeleteTask = useCallback(
    (task: TaskWithRelations | Task) => {
      if (['owner', 'admin', 'manager'].includes(role || '')) return true;
      if (canDeleteAny) return isTaskParticipant(task);
      return task.created_by === userId;
    },
    [canDeleteAny, role, userId, isTaskParticipant]
  );

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const invalidateTasks = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }, [queryClient]);

  const createTask = async (data: CreateTaskData): Promise<Task | null> => {
    if (!orgId || !userId) {
      toast.error('No se pudo crear la tarea: perfil no cargado');
      return null;
    }

    // Verify session is active
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user?.id || session.user.id !== userId) {
      toast.error('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.');
      return null;
    }

    try {
      const taskType = data.type || 'simple';
      const insertData: any = {
        organization_id: orgId,
        title: data.title,
        description: data.description || null,
        type: taskType,
        status: data.status || 'pending',
        priority: data.priority || 'medium',
        created_by: userId,
        assigned_to: data.assigned_to || null,
        due_date: data.due_date || null,
      };

      // Add goal fields for goal_numeric type
      if (taskType === 'goal_numeric') {
        insertData.goal_target_value = data.goal_target_value;
        insertData.goal_unit = data.goal_unit;
      }

      // Add operation fields for operation type
      if (taskType === 'operation') {
        insertData.operation_type = data.operation_type || null;
        insertData.scheduled_at = data.scheduled_at || null;
        insertData.location_type = data.location_type || null;
        insertData.location_text = data.location_text || null;
        insertData.location_notes = data.location_notes || null;
        insertData.reservation_ref = data.reservation_ref || null;
        insertData.customer_name = data.customer_name || null;
        insertData.customer_phone = data.customer_phone || null;
        insertData.vehicle_out_id = data.vehicle_out_id || null;
        insertData.vehicle_in_id = data.vehicle_in_id || null;
        insertData.assigned_to = data.primary_assignee_id || null;
      }

      // Use Express endpoint to bypass potential RLS timing issues
      const { data: taskJson, error: rpcError } = await apiInvoke<Task>('create-task-secure', {
        body: {
          p_title: insertData.title,
          p_description: insertData.description,
          p_type: insertData.type,
          p_status: insertData.status,
          p_priority: insertData.priority,
          p_assigned_to: insertData.assigned_to,
          p_due_date: insertData.due_date,
          p_goal_target_value: insertData.goal_target_value || null,
          p_goal_unit: insertData.goal_unit || null,
          p_operation_type: insertData.operation_type || null,
          p_scheduled_at: insertData.scheduled_at || null,
          p_location_type: insertData.location_type || null,
          p_location_text: insertData.location_text || null,
          p_location_notes: insertData.location_notes || null,
          p_reservation_ref: insertData.reservation_ref || null,
          p_customer_name: insertData.customer_name || null,
          p_customer_phone: insertData.customer_phone || null,
          p_vehicle_out_id: insertData.vehicle_out_id || null,
          p_vehicle_in_id: insertData.vehicle_in_id || null,
        },
      });

      if (rpcError) throw new Error(rpcError.message);

      const newTask = taskJson as Task;

      // Create operation legs for operation type
      if (taskType === 'operation') {
        const primaryLegData = {
          organization_id: orgId,
          task_id: newTask.id,
          leg_type: 'primary',
          assignee_id: data.primary_assignee_id || null,
          status: 'pending',
          scheduled_at: data.scheduled_at || null,
          checklist_json: {},
        };

        const { error: primaryLegError } = await supabase
          .from('operation_legs')
          .insert(primaryLegData);
        if (primaryLegError) throw primaryLegError;

        // Create support leg if requested
        if (data.has_support_leg && data.support_assignee_id) {
          const supportLegData = {
            organization_id: orgId,
            task_id: newTask.id,
            leg_type: 'support',
            assignee_id: data.support_assignee_id,
            status: 'pending',
            scheduled_at: data.scheduled_at || null,
            checklist_json: {},
          };

          const { error: supportLegError } = await supabase
            .from('operation_legs')
            .insert(supportLegData);
          if (supportLegError) throw supportLegError;

          // Notify support assignee
          if (data.support_assignee_id !== userId) {
            await supabase.from('notifications').insert({
              organization_id: orgId,
              user_id: data.support_assignee_id,
              type: 'assignment',
              title: 'Te asignaron como apoyo en una operación',
              body: data.title,
              entity_type: 'task',
              entity_id: newTask.id,
            });
          }
        }

        // Notify primary assignee
        if (data.primary_assignee_id && data.primary_assignee_id !== userId) {
          await supabase.from('notifications').insert({
            organization_id: orgId,
            user_id: data.primary_assignee_id,
            type: 'assignment',
            title: 'Te asignaron una operación',
            body: data.title,
            entity_type: 'task',
            entity_id: newTask.id,
          });
        }
      } else {
        // Insert task_areas (not for operations)
        if (data.area_ids.length > 0) {
          const taskAreasInsert = data.area_ids.map(area_id => ({
            task_id: newTask.id,
            area_id,
          }));
          const { error: areasError } = await supabase.from('task_areas').insert(taskAreasInsert);
          if (areasError) throw areasError;
        }

        // Insert task_tags
        if (data.tag_ids && data.tag_ids.length > 0) {
          const taskTagsInsert = data.tag_ids.map(tag_id => ({
            task_id: newTask.id,
            tag_id,
          }));
          const { error: tagsError } = await supabase.from('task_tags').insert(taskTagsInsert);
          if (tagsError) throw tagsError;
        }

        // Create assignment notification if assigned to someone else
        if (data.assigned_to && data.assigned_to !== userId) {
          await supabase.from('notifications').insert({
            organization_id: orgId,
            user_id: data.assigned_to,
            type: 'assignment',
            title: 'Te asignaron una tarea',
            body: data.title,
            entity_type: 'task',
            entity_id: newTask.id,
          });
        }
      }

      toast.success(taskType === 'operation' ? 'Operación creada correctamente' : 'Tarea creada correctamente');
      invalidateTasks();
      return newTask as Task;
    } catch (error: unknown) {
      errorHandler.log('Error creating task', error);
      toast.error(ERROR_MESSAGES.tasks.createError.description);
      return null;
    }
  };

  const updateTask = async (id: string, data: UpdateTaskData): Promise<boolean> => {
    if (!orgId || !userId) {
      toast.error('No se pudo actualizar la tarea');
      return false;
    }

    try {
      // Get current task to check for assignment changes
      let previousAssignedTo: string | null = null;
      let taskTitle = '';

      if (data.assigned_to !== undefined) {
        const { data: currentTask } = await supabase
          .from('tasks')
          .select('assigned_to, title')
          .eq('id', id)
          .maybeSingle();
        previousAssignedTo = currentTask?.assigned_to || null;
        taskTitle = currentTask?.title || '';
      }

      const updateData: any = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.assigned_to !== undefined) updateData.assigned_to = data.assigned_to;
      if (data.due_date !== undefined) updateData.due_date = data.due_date;
      if (data.is_archived !== undefined) updateData.is_archived = data.is_archived;

      if (Object.keys(updateData).length > 0) {
        const { error: taskError } = await supabase
          .from('tasks')
          .update(updateData)
          .eq('id', id);
        if (taskError) throw taskError;
      }

      // Update task_areas if provided
      if (data.area_ids !== undefined) {
        const { error: deleteAreasError } = await supabase
          .from('task_areas')
          .delete()
          .eq('task_id', id);
        if (deleteAreasError) throw deleteAreasError;

        if (data.area_ids.length > 0) {
          const taskAreasInsert = data.area_ids.map(area_id => ({
            task_id: id,
            area_id,
          }));
          const { error: insertAreasError } = await supabase
            .from('task_areas')
            .insert(taskAreasInsert);
          if (insertAreasError) throw insertAreasError;
        }
      }

      // Update task_tags if provided
      if (data.tag_ids !== undefined) {
        const { error: deleteTagsError } = await supabase
          .from('task_tags')
          .delete()
          .eq('task_id', id);
        if (deleteTagsError) throw deleteTagsError;

        if (data.tag_ids.length > 0) {
          const taskTagsInsert = data.tag_ids.map(tag_id => ({
            task_id: id,
            tag_id,
          }));
          const { error: insertTagsError } = await supabase
            .from('task_tags')
            .insert(taskTagsInsert);
          if (insertTagsError) throw insertTagsError;
        }
      }

      // Create assignment notification if assigned to a different user
      if (
        data.assigned_to !== undefined &&
        data.assigned_to !== null &&
        data.assigned_to !== previousAssignedTo &&
        data.assigned_to !== userId
      ) {
        await supabase.from('notifications').insert({
          organization_id: orgId,
          user_id: data.assigned_to,
          type: 'assignment',
          title: 'Te asignaron una tarea',
          body: data.title || taskTitle,
          entity_type: 'task',
          entity_id: id,
        });
      }

      toast.success('Tarea actualizada correctamente');
      invalidateTasks();
      return true;
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast.error('Error al actualizar la tarea');
      return false;
    }
  };

  const archiveTask = async (id: string, archive: boolean): Promise<boolean> => {
    return updateTask(id, { is_archived: archive });
  };

  const deleteTask = async (id: string): Promise<boolean> => {
    if (!userId) {
      toast.error('No se pudo eliminar la tarea');
      return false;
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Tarea movida a la papelera');
      invalidateTasks();
      return true;
    } catch (error: any) {
      console.error('Error deleting task:', error);
      toast.error('Error al eliminar la tarea');
      return false;
    }
  };

  const getTaskById = async (id: string): Promise<TaskWithRelations | null> => {
    try {
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (taskError) throw taskError;
      if (!task) return null;

      // Fetch areas
      const { data: taskAreasData, error: taskAreasError } = await supabase
        .from('task_areas')
        .select('area_id, areas(id, name, color, icon)')
        .eq('task_id', id);
      if (taskAreasError) throw taskAreasError;

      // Fetch tags
      const { data: taskTagsData, error: taskTagsError } = await supabase
        .from('task_tags')
        .select('tag_id, tags(id, name, color, icon)')
        .eq('task_id', id);
      if (taskTagsError) throw taskTagsError;

      // Fetch subtask counts
      const { data: subtasksData, error: subtasksError } = await supabase
        .from('task_subtasks')
        .select('status')
        .eq('task_id', id);
      if (subtasksError) throw subtasksError;

      // Fetch profiles
      const profileIds = [task.created_by];
      if (task.assigned_to) profileIds.push(task.assigned_to);

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', profileIds);
      if (profilesError) throw profilesError;

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      const subtaskCount = subtasksData?.length || 0;
      const subtaskCompleted = subtasksData?.filter((s: any) => s.status === 'done').length || 0;

      return {
        ...task,
        type: task.type as TaskWithRelations['type'],
        status: task.status as TaskWithRelations['status'],
        priority: task.priority as TaskWithRelations['priority'],
        areas: taskAreasData?.map((ta: any) => ta.areas).filter(Boolean) || [],
        tags: taskTagsData?.map((tt: any) => tt.tags).filter(Boolean) || [],
        creator: profilesMap.get(task.created_by),
        assignee: task.assigned_to ? profilesMap.get(task.assigned_to) : null,
        subtaskCount,
        subtaskCompleted,
      } as TaskWithRelations;
    } catch (error: any) {
      console.error('Error fetching task:', error);
      return null;
    }
  };

  return {
    tasks,
    loading,
    filters,
    setFilters,
    createTask,
    updateTask,
    archiveTask,
    deleteTask,
    getTaskById,
    canCreate,
    canEditTask,
    canDeleteTask,
    canChangeStatus,
    refetch,
  };
}
