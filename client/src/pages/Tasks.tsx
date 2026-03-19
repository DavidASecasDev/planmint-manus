import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTasks } from '@/hooks/useTasks';
import { useAreas } from '@/hooks/useAreas';
import { useTags } from '@/hooks/useTags';
import { useOrganizationMembers, usePermissions } from '@/hooks/usePermissions';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { useUsageTracking } from '@/hooks/useUsageTracking';
import { AppLayout } from '@/components/layout/AppLayout';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskForm, TaskFormData } from '@/components/tasks/TaskForm';
import { TaskDetail } from '@/components/tasks/TaskDetail';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { TaskWithRelations } from '@/types/tasks';
import { useTaskAssignees } from '@/hooks/useTaskAssignees';

import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Tasks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    tasks,
    loading,
    filters,
    setFilters,
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

  // Track task list view on mount
  useEffect(() => {
    trackTaskListViewed();
  }, [trackTaskListViewed]);

  // Open task from URL query param (e.g., from notifications)
  useEffect(() => {
    const taskIdFromUrl = searchParams.get('task');
    if (taskIdFromUrl && !loading && tasks.length > 0) {
      const taskToOpen = tasks.find(t => t.id === taskIdFromUrl);
      if (taskToOpen) {
        setSelectedTask(taskToOpen);
        setDetailOpen(true);
        // Clear the query param to avoid reopening on re-renders
        searchParams.delete('task');
        setSearchParams(searchParams, { replace: true });
      } else {
        // Task not found in current list - show error
        toast.error('La tarea no se encontró o no tienes acceso a ella');
        searchParams.delete('task');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [tasks, loading, searchParams, setSearchParams]);

  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [limitMessage, setLimitMessage] = useState('');

  const handleCreateNew = useCallback(() => {
    const limitCheck = canCreateTask();
    
    // Manejar estado de carga explícitamente
    if (limitCheck.message === 'loading' || isLimitsLoading) {
      toast.info('Cargando información del plan...');
      return;
    }
    
    if (!limitCheck.allowed) {
      setLimitMessage(limitCheck.message);
      setUpgradeModalOpen(true);
      trackLimitReached('task');
      return;
    }
    setSelectedTask(null);
    setIsEditing(false);
    setFormOpen(true);
  }, [canCreateTask, trackLimitReached, isLimitsLoading]);

  const handleView = useCallback((task: TaskWithRelations) => {
    setSelectedTask(task);
    setDetailOpen(true);
  }, []);

  const handleEdit = useCallback((task: TaskWithRelations) => {
    setSelectedTask(task);
    setIsEditing(true);
    setFormOpen(true);
    setDetailOpen(false);
  }, []);

  const handleArchive = useCallback(
    async (task: TaskWithRelations) => {
      await archiveTask(task.id, !task.is_archived);
      if (detailOpen && selectedTask?.id === task.id) {
        setSelectedTask({ ...task, is_archived: !task.is_archived });
      }
    },
    [archiveTask, detailOpen, selectedTask]
  );

  const handleDelete = useCallback(
    async (task: TaskWithRelations) => {
      await deleteTask(task.id);
      setDetailOpen(false);
      setSelectedTask(null);
    },
    [deleteTask]
  );

  const handleStatusChange = useCallback(
    async (task: TaskWithRelations, newStatus: string) => {
      await updateTask(task.id, { status: newStatus as any });
      setSelectedTask({ ...task, status: newStatus as any });
    },
    [updateTask]
  );

  const { setAssignees } = useTaskAssignees();
  

  const handleFormSubmit = useCallback(
    async (data: TaskFormData) => {
      const formattedData = {
        ...data,
        due_date: data.due_date ? format(data.due_date, 'yyyy-MM-dd') : null,
      };

      if (isEditing && selectedTask) {
        await updateTask(selectedTask.id, formattedData);
        // Update multiple assignees
        if (data.assigned_user_ids || data.assigned_team_ids) {
          await setAssignees({
            taskId: selectedTask.id,
            userIds: data.assigned_user_ids || [],
            teamIds: data.assigned_team_ids || [],
          });
        }
      } else {
        const newTask = await createTask(formattedData);
        // Set multiple assignees for new task
        if (newTask && (data.assigned_user_ids?.length || data.assigned_team_ids?.length)) {
          await setAssignees({
            taskId: newTask.id,
            userIds: data.assigned_user_ids || [],
            teamIds: data.assigned_team_ids || [],
          });

        }
      }
    },
    [isEditing, selectedTask, createTask, updateTask, setAssignees]
  );

  return (
    <AppLayout title="Tareas">
      <div className="max-w-6xl mx-auto">
        <TaskList
          tasks={tasks}
          loading={loading}
          filters={filters}
          onFiltersChange={setFilters}
          areas={areas}
          tags={tags}
          members={members}
          currentUserRole={role ?? undefined}
          canCreate={canCreate}
          canEditTask={canEditTask}
          canDeleteTask={canDeleteTask}
          onCreateNew={handleCreateNew}
          onView={handleView}
          onEdit={handleEdit}
          onArchive={handleArchive}
          onDelete={handleDelete}
          canAccessTrash={role === 'owner' || role === 'admin'}
        />

        <TaskForm
          open={formOpen}
          onOpenChange={setFormOpen}
          task={isEditing ? selectedTask : null}
          areas={areas}
          tags={tags}
          members={members}
          onSubmit={handleFormSubmit}
        />

        <TaskDetail
          open={detailOpen}
          onOpenChange={setDetailOpen}
          task={selectedTask}
          onEdit={() => handleEdit(selectedTask!)}
          onArchive={() => handleArchive(selectedTask!)}
          onDelete={() => handleDelete(selectedTask!)}
          onStatusChange={(newStatus) => handleStatusChange(selectedTask!, newStatus)}
          canEdit={selectedTask ? canEditTask(selectedTask) : false}
          canDelete={selectedTask ? canDeleteTask(selectedTask) : false}
          canChangeStatus={canChangeStatus}
          onMilestoneChange={refetch}
        />

        <UpgradeModal
          open={upgradeModalOpen}
          onOpenChange={setUpgradeModalOpen}
          limitMessage={limitMessage}
        />
      </div>
    </AppLayout>
  );
}
