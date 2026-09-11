import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { TaskForm, type TaskFormData } from '@/components/tasks/TaskForm';
import { TaskDetail } from '@/components/tasks/TaskDetail';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { TaskWorkspace } from '@/features/tasks/TaskWorkspace';
import { TaskQuickCreateSheet, type TaskQuickCreateValues } from '@/features/tasks/TaskQuickCreateSheet';
import { madridLocalDateTimeToIso, type WorkspaceTask } from '@/features/tasks/taskWorkspaceDomain';
import { useTaskWorkspaceCapabilities, useTaskWorkspaceWorkflow } from '@/features/tasks/useTaskWorkspaceWorkflow';
import type { TaskWorkflowEditValues } from '@/features/tasks/TaskWorkflowPanel';
import { useTasks } from '@/hooks/useTasks';
import { useAreas } from '@/hooks/useAreas';
import { useTags } from '@/hooks/useTags';
import { useOrganizationMembers, usePermissions } from '@/hooks/usePermissions';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { useUsageTracking } from '@/hooks/useUsageTracking';
import { useTaskAssignees } from '@/hooks/useTaskAssignees';
import { useDailyTasks } from '@/hooks/useDailyTasks';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { TaskWithRelations } from '@/types/tasks';

export default function Tasks() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const {
    tasks,
    loading,
    createTask,
    updateTask,
    archiveTask,
    deleteTask,
    canCreate,
    canEditTask,
    canDeleteTask,
    canChangeStatus,
    refetch,
  } = useTasks();
  const { areas } = useAreas();
  const { tags } = useTags();
  const { members } = useOrganizationMembers();
  const { role } = usePermissions();
  const { canCreateTask, isLoading: isLimitsLoading } = usePlanLimits();
  const { trackTaskListViewed, trackLimitReached } = useUsageTracking();
  const { setAssignees } = useTaskAssignees();
  const dailyTasks = useDailyTasks(new Date());
  const capabilities = useTaskWorkspaceCapabilities();
  const workflow = useTaskWorkspaceWorkflow(profile?.organization_id);

  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [fullFormOpen, setFullFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [limitMessage, setLimitMessage] = useState('');
  const [isQuickSaving, setIsQuickSaving] = useState(false);

  const actorId = user?.id || profile?.id || '';
  const memberOptions = useMemo(
    () => members
      .map(member => ({ id: member.user_id || member.id || '', name: member.name?.trim() || 'Sin nombre' }))
      .filter(member => Boolean(member.id)),
    [members],
  );

  useEffect(() => {
    trackTaskListViewed();
  }, [trackTaskListViewed]);

  useEffect(() => {
    const taskIdFromUrl = searchParams.get('task');
    if (!taskIdFromUrl || loading) return;
    const taskToOpen = tasks.find(task => task.id === taskIdFromUrl);
    if (taskToOpen) {
      setSelectedTask(taskToOpen);
      setDetailOpen(true);
    } else if (tasks.length > 0) {
      toast.error('La tarea no se encontró o no tienes acceso a ella');
    }
    searchParams.delete('task');
    setSearchParams(searchParams, { replace: true });
  }, [loading, searchParams, setSearchParams, tasks]);

  const checkCreateLimit = useCallback(() => {
    const result = canCreateTask();
    if (result.message === 'loading' || isLimitsLoading) {
      toast.info('Cargando información del plan…');
      return false;
    }
    if (!result.allowed) {
      setLimitMessage(result.message);
      setUpgradeModalOpen(true);
      trackLimitReached('task');
      return false;
    }
    return true;
  }, [canCreateTask, isLimitsLoading, trackLimitReached]);

  const handleOpenQuickCreate = useCallback(() => {
    if (checkCreateLimit()) setQuickCreateOpen(true);
  }, [checkCreateLimit]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key.toLowerCase() === 'n' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        handleOpenQuickCreate();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [handleOpenQuickCreate]);

  const handleOpenFullCreate = useCallback(() => {
    if (!checkCreateLimit()) return;
    setQuickCreateOpen(false);
    setSelectedTask(null);
    setIsEditing(false);
    setFullFormOpen(true);
  }, [checkCreateLimit]);

  const handleView = useCallback((task: TaskWithRelations) => {
    setSelectedTask(task);
    setDetailOpen(true);
  }, []);

  const handleEdit = useCallback((task: TaskWithRelations) => {
    setSelectedTask(task);
    setIsEditing(true);
    setDetailOpen(false);
    setFullFormOpen(true);
  }, []);

  const handleQuickCreate = useCallback(async (values: TaskQuickCreateValues) => {
    if (!actorId) return;
    setIsQuickSaving(true);
    try {
      const created = await createTask({
        title: values.title,
        description: values.description,
        type: 'simple',
        status: 'pending',
        priority: values.priority,
        assigned_to: values.assignedTo,
        due_date: values.dueDate,
        area_ids: values.areaIds,
        tag_ids: [],
      });
      if (!created) return;

      if (values.collaboratorIds.length > 0) {
        await setAssignees({ taskId: created.id, userIds: values.collaboratorIds, teamIds: [] });
      }
      if (values.subtasks.length > 0) {
        const { error } = await supabase.from('task_subtasks').insert(values.subtasks.map((title, index) => ({ task_id: created.id, title, sort_order: index })));
        if (error) throw error;
      }

      if (capabilities.data?.workflowV1) {
        await workflow.updateWorkflowFields.mutateAsync({
          taskId: created.id,
          values: {
            commissioned_at: values.assignedTo !== actorId ? new Date().toISOString() : null,
            next_follow_up_at: values.nextFollowUpAt ? madridLocalDateTimeToIso(values.nextFollowUpAt) : null,
            supervisor_id: values.reviewRequired ? values.supervisorId : null,
            review_required: values.reviewRequired,
            review_state: values.reviewRequired ? null : 'not_required',
            project_name: values.projectName,
          },
        });
      } else if (values.reviewRequired || values.nextFollowUpAt || values.supervisorId || values.projectName) {
        toast.info('La tarea se creó con el esquema actual. Los datos avanzados se activarán al aplicar la migración propuesta.');
      }

      setQuickCreateOpen(false);
      await refetch();
    } catch (error) {
      console.error('[tasks-workspace] quick create failed', error);
      toast.error('La tarea se creó parcialmente. Revisa sus detalles antes de continuar.');
    } finally {
      setIsQuickSaving(false);
    }
  }, [actorId, capabilities.data?.workflowV1, createTask, refetch, setAssignees, workflow.updateWorkflowFields]);

  const handleFullFormSubmit = useCallback(async (data: TaskFormData) => {
    const formattedData = { ...data, due_date: data.due_date ? format(data.due_date, 'yyyy-MM-dd') : null };
    if (isEditing && selectedTask) {
      await updateTask(selectedTask.id, formattedData);
      await setAssignees({ taskId: selectedTask.id, userIds: data.assigned_user_ids || [], teamIds: data.assigned_team_ids || [] });
    } else {
      const created = await createTask(formattedData);
      if (created) await setAssignees({ taskId: created.id, userIds: data.assigned_user_ids || [], teamIds: data.assigned_team_ids || [] });
    }
  }, [createTask, isEditing, selectedTask, setAssignees, updateTask]);

  const handleRequestCompletion = useCallback(async (task: WorkspaceTask) => {
    if (task.review_required) {
      if (!capabilities.data?.workflowV1) {
        toast.error('La revisión opcional requiere aplicar primero la migración aditiva propuesta.');
        return;
      }
      await workflow.requestCompletion.mutateAsync(task.id);
      toast.success('Tarea terminada y enviada a revisión.');
      return;
    }
    await updateTask(task.id, { status: 'completed' });
    toast.success('Tarea completada', {
      action: {
        label: 'Deshacer',
        onClick: () => void updateTask(task.id, { status: task.status }),
      },
    });
  }, [capabilities.data?.workflowV1, updateTask, workflow.requestCompletion]);

  const handleReview = useCallback(async (task: WorkspaceTask, decision: 'approve' | 'return', reason?: string) => {
    if (!capabilities.data?.workflowV1) return;
    await workflow.reviewCompletion.mutateAsync({ taskId: task.id, decision, reason });
    toast.success(decision === 'approve' ? 'Tarea validada y cerrada.' : 'Tarea devuelta a la persona responsable.');
  }, [capabilities.data?.workflowV1, workflow.reviewCompletion]);

  const handleUndoCompletion = useCallback(async (task: WorkspaceTask) => {
    if (capabilities.data?.workflowV1) await workflow.undoCompletion.mutateAsync(task.id);
    else await updateTask(task.id, { status: 'in_progress' });
    toast.success('Cierre deshecho.');
  }, [capabilities.data?.workflowV1, updateTask, workflow.undoCompletion]);

  const routines = dailyTasks.tasks.map(routine => ({
    id: routine.id,
    title: routine.title,
    assignedTo: routine.assigned_to,
    completed: Boolean(routine.todayCompletion),
  }));

  return (
    <AppLayout title="Tareas">
      <TaskWorkspace
        tasks={tasks as WorkspaceTask[]}
        routines={routines}
        loading={loading || dailyTasks.isLoading}
        actorId={actorId}
        actorRole={role}
        members={memberOptions}
        areas={areas}
        canCreate={canCreate}
        workflowAvailable={capabilities.data?.workflowV1 === true}
        workflowUnavailableReason={capabilities.data?.reason}
        onCreate={handleOpenQuickCreate}
        onOpenTask={handleView}
        onNavigateCalendar={() => navigate('/tasks/calendar')}
        onNavigateKanban={() => navigate('/tasks/kanban')}
        onNavigateRoutines={() => navigate('/tasks/daily')}
        onNavigateReminders={() => navigate('/reminders')}
        onRequestCompletion={handleRequestCompletion}
        onReview={handleReview}
        onUndoCompletion={handleUndoCompletion}
        onToggleRoutine={routine => {
          const source = dailyTasks.tasks.find(item => item.id === routine.id);
          if (!source || !dailyTasks.canComplete) return;
          if (source.todayCompletion) dailyTasks.uncompleteTask(source.todayCompletion.id);
          else dailyTasks.completeTask({ templateId: source.id });
        }}
      />

      <TaskQuickCreateSheet
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        members={memberOptions}
        areas={areas}
        isSaving={isQuickSaving}
        onSubmit={handleQuickCreate}
        onOpenFullForm={handleOpenFullCreate}
      />

      <TaskForm
        open={fullFormOpen}
        onOpenChange={setFullFormOpen}
        task={isEditing ? selectedTask : null}
        areas={areas}
        tags={tags}
        members={members}
        onSubmit={handleFullFormSubmit}
      />

      <TaskDetail
        open={detailOpen}
        onOpenChange={setDetailOpen}
        task={selectedTask}
        onEdit={() => selectedTask && handleEdit(selectedTask)}
        onArchive={async () => { if (selectedTask) await archiveTask(selectedTask.id, !selectedTask.is_archived); }}
        onDelete={async () => { if (selectedTask) { await deleteTask(selectedTask.id); setDetailOpen(false); } }}
        onStatusChange={async status => {
          if (!selectedTask) return;
          if (status === 'completed') await handleRequestCompletion(selectedTask as WorkspaceTask);
          else await updateTask(selectedTask.id, { status: status as any });
        }}
        canEdit={selectedTask ? canEditTask(selectedTask) : false}
        canDelete={selectedTask ? canDeleteTask(selectedTask) : false}
        canChangeStatus={canChangeStatus && selectedTask?.review_state !== 'pending_review'}
        onMilestoneChange={refetch}
        workflowAvailable={capabilities.data?.workflowV1 === true}
        workflowMembers={memberOptions}
        onWorkflowUpdate={async (values: TaskWorkflowEditValues) => {
          if (!selectedTask) return;
          const dueDateSaved = await updateTask(selectedTask.id, { due_date: values.dueDate });
          if (!dueDateSaved) throw new Error('due_date_update_failed');
          if (capabilities.data?.workflowV1) {
            await workflow.updateWorkflowFields.mutateAsync({
              taskId: selectedTask.id,
              values: {
                next_follow_up_at: values.nextFollowUpAt ? madridLocalDateTimeToIso(values.nextFollowUpAt) : null,
                project_name: values.projectName,
                review_required: values.reviewRequired,
                supervisor_id: values.reviewRequired ? values.supervisorId : null,
                review_state: values.reviewRequired ? null : 'not_required',
                review_requested_at: null,
                reviewed_at: null,
                reviewed_by: null,
                review_return_reason: null,
              },
            });
          }
        }}
      />

      <UpgradeModal open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen} limitMessage={limitMessage} />
    </AppLayout>
  );
}
