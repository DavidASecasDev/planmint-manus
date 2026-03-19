import { useState, useMemo, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useUsageTracking } from '@/hooks/useUsageTracking';
import { usePlanLimits } from '@/hooks/usePlanLimits';

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { List, Settings2, Filter, LayoutGrid, Users, Plus } from 'lucide-react';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { KanbanSkeleton } from '@/components/ui/loading-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/hooks/useTasks';
import { useTaskAssignees } from '@/hooks/useTaskAssignees';
import { useAreas } from '@/hooks/useAreas';
import { useTags } from '@/hooks/useTags';
import { useOrganizationMembers, usePermissions } from '@/hooks/usePermissions';
import { useKanbanColumns } from '@/hooks/useKanbanColumns';
import { KanbanColumnComponent } from '@/components/kanban/KanbanColumn';
import { KanbanTaskCard } from '@/components/kanban/KanbanTaskCard';
import { KanbanConfigDialog } from '@/components/kanban/KanbanConfigDialog';
import { TaskDetail } from '@/components/tasks/TaskDetail';
import { TaskForm, TaskFormData } from '@/components/tasks/TaskForm';
import { TaskWithRelations, TaskStatus, TASK_TYPE_OPTIONS } from '@/types/tasks';
import { toast } from 'sonner';
import { canFilterOtherMembers, getMembersBelow, getRoleLabel } from '@/lib/roleHierarchy';

export default function Kanban() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { hasPermission, role, isLoading: permissionsLoading } = usePermissions();
  const { trackKanbanViewed } = useUsageTracking();

  // Track kanban view on mount
  useEffect(() => {
    trackKanbanViewed();
  }, [trackKanbanViewed]);
  const { tasks, loading: tasksLoading, createTask, updateTask, archiveTask, deleteTask, canEditTask, canDeleteTask, canChangeStatus, refetch: refetchTasks } = useTasks();
  const { setAssignees } = useTaskAssignees();
  const { areas } = useAreas();
  const { tags } = useTags();
  const { members } = useOrganizationMembers();
  const { columns, loading: columnsLoading, canManageColumns, updateColumn, reorderColumns, getVisibleColumns } = useKanbanColumns();

  const { canCreateTask } = usePlanLimits();
  const [configOpen, setConfigOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<TaskWithRelations | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editTask, setEditTask] = useState<TaskWithRelations | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [limitMessage, setLimitMessage] = useState('');

  // Filters
  const [filters, setFilters] = useState({
    areaId: 'all',
    tagId: 'all',
    assignedTo: 'all',
    type: 'all',
    myTasksOnly: false,
  });

  // Fetch user's team memberships for myTasksOnly filter
  const [userTeamIds, setUserTeamIds] = useState<string[]>([]);
  const [myAssignedTaskIds, setMyAssignedTaskIds] = useState<Set<string>>(new Set());
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);

  // Fetch assignments for the selected member filter (assignedTo)
  const [filteredMemberTaskIds, setFilteredMemberTaskIds] = useState<Set<string>>(new Set());
  const [filteredMemberLoading, setFilteredMemberLoading] = useState(false);

  useEffect(() => {
    const fetchUserAssignments = async () => {
      if (!profile?.id || !profile?.organization_id) {
        setAssignmentsLoading(false);
        return;
      }

      setAssignmentsLoading(true);

      try {
        // Get user's teams
        const { data: userTeams } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', profile.id);
        
        const teamIds = userTeams?.map(t => t.team_id) || [];
        setUserTeamIds(teamIds);

        // Get task IDs assigned directly to user
        const { data: directAssignments } = await supabase
          .from('task_assignees')
          .select('task_id')
          .eq('organization_id', profile.organization_id)
          .eq('user_id', profile.id);
        
        let allTaskIds = directAssignments?.map(a => a.task_id) || [];

        // Get task IDs assigned to user's teams (separate query)
        if (teamIds.length > 0) {
          const { data: teamAssignments } = await supabase
            .from('task_assignees')
            .select('task_id')
            .eq('organization_id', profile.organization_id)
            .in('team_id', teamIds);
          
          allTaskIds = [...allTaskIds, ...(teamAssignments?.map(a => a.task_id) || [])];
        }

        setMyAssignedTaskIds(new Set(allTaskIds));
      } finally {
        setAssignmentsLoading(false);
      }
    };

    fetchUserAssignments();
  }, [profile?.id, profile?.organization_id]);

  // Fetch assignments for the selected member in "Assigned to" filter
  useEffect(() => {
    const fetchFilteredMemberAssignments = async () => {
      if (filters.assignedTo === 'all' || !profile?.organization_id) {
        setFilteredMemberTaskIds(new Set());
        setFilteredMemberLoading(false);
        return;
      }

      setFilteredMemberLoading(true);

      try {
        // Get teams the selected member belongs to
        const { data: memberTeams } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', filters.assignedTo);
        
        const memberTeamIds = memberTeams?.map(t => t.team_id) || [];

        // Get task IDs assigned directly to the member
        const { data: directAssignees } = await supabase
          .from('task_assignees')
          .select('task_id')
          .eq('organization_id', profile.organization_id)
          .eq('user_id', filters.assignedTo);
        
        let allTaskIds = directAssignees?.map(a => a.task_id) || [];

        // Get task IDs assigned to teams the member belongs to
        if (memberTeamIds.length > 0) {
          const { data: teamAssignees } = await supabase
            .from('task_assignees')
            .select('task_id')
            .eq('organization_id', profile.organization_id)
            .in('team_id', memberTeamIds);
          
          allTaskIds = [...allTaskIds, ...(teamAssignees?.map(a => a.task_id) || [])];
        }

        setFilteredMemberTaskIds(new Set(allTaskIds));
      } finally {
        setFilteredMemberLoading(false);
      }
    };

    fetchFilteredMemberAssignments();
  }, [filters.assignedTo, profile?.organization_id]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Use permission system instead of direct role checks for authorization
  const canDragTask = (task: TaskWithRelations): boolean => {
    // Use the tasks.update permission from the centralized permission system
    if (hasPermission('tasks.update')) return true;
    // Members with tasks.change_status can also drag cards between columns
    if (hasPermission('tasks.change_status')) return true;
    // Fallback: allow editing own tasks if not explicitly granted update permission
    return canEditTask(task);
  };

  // Get subordinate members for managers+
  const canFilterSubordinates = canFilterOtherMembers(role ?? undefined);
  const subordinateMembers = useMemo(() => {
    if (!canFilterSubordinates) return [];
    return getMembersBelow(role ?? undefined, members);
  }, [canFilterSubordinates, role, members]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (task.is_archived) return false;

      if (filters.areaId !== 'all') {
        if (!task.areas.some((a) => a.id === filters.areaId)) return false;
      }

      if (filters.tagId !== 'all') {
        if (!task.tags?.some((t) => t.id === filters.tagId)) return false;
      }

      if (filters.assignedTo !== 'all') {
        if (filteredMemberLoading) return false;
        
        const isDirectlyAssigned = task.assigned_to === filters.assignedTo;
        const isAssignedViaTaskAssignees = filteredMemberTaskIds.has(task.id);
        if (!isDirectlyAssigned && !isAssignedViaTaskAssignees) return false;
      }

      if (filters.type !== 'all') {
        if (task.type !== filters.type) return false;
      }

      // myTasksOnly: ONLY show tasks assigned to user (directly or via teams)
      // Do NOT include tasks the user created but is not assigned to
      if (filters.myTasksOnly && profile?.id) {
        // Wait until assignments are loaded
        if (assignmentsLoading) return false;
        
        const isDirectlyAssigned = task.assigned_to === profile.id;
        const isAssignedViaTaskAssignees = myAssignedTaskIds.has(task.id);
        if (!isDirectlyAssigned && !isAssignedViaTaskAssignees) return false;
      }

      return true;
    });
  }, [tasks, filters, profile?.id, myAssignedTaskIds, assignmentsLoading, filteredMemberTaskIds, filteredMemberLoading]);

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, TaskWithRelations[]> = {};
    getVisibleColumns().forEach((col) => {
      grouped[col.status] = filteredTasks.filter((t) => t.status === col.status);
    });
    return grouped;
  }, [filteredTasks, getVisibleColumns]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = filteredTasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);

    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const task = filteredTasks.find((t) => t.id === taskId);
    if (!task) return;

    // Check permissions
    if (!canDragTask(task)) {
      toast.error('No tienes permisos para mover esta tarea');
      return;
    }

    // Get the target column status
    const overData = over.data.current;
    let newStatus: TaskStatus | null = null;

    if (overData?.type === 'column') {
      newStatus = overData.column.status;
    } else if (overData?.type === 'task') {
      // Dropped on another task, get its column
      const overTask = filteredTasks.find((t) => t.id === over.id);
      if (overTask) newStatus = overTask.status;
    } else {
      // Check if dropped directly on a column by ID
      const column = getVisibleColumns().find((c) => c.status === over.id);
      if (column) newStatus = column.status;
    }

    if (!newStatus || newStatus === task.status) return;

    // Update the task status
    const success = await updateTask(task.id, { status: newStatus });
    if (success) {
      toast.success(`Tarea movida a "${getVisibleColumns().find((c) => c.status === newStatus)?.label}"`);
      refetchTasks();
    }
  };

  const handleTaskClick = (task: TaskWithRelations) => {
    setSelectedTask(task);
    setDetailOpen(true);
  };

  const handleEditTask = useCallback(() => {
    if (selectedTask) {
      setEditTask(selectedTask);
      setDetailOpen(false);
      setFormOpen(true);
    }
  }, [selectedTask]);

  const handleCreateNew = useCallback(() => {
    const limitCheck = canCreateTask();
    if (!limitCheck.allowed) {
      setLimitMessage(limitCheck.message);
      setUpgradeModalOpen(true);
      return;
    }
    setEditTask(null);
    setFormOpen(true);
  }, [canCreateTask]);

  

  const handleFormSubmit = useCallback(
    async (data: TaskFormData) => {
      const formattedData = {
        ...data,
        due_date: data.due_date ? format(data.due_date, 'yyyy-MM-dd') : null,
      };

      if (editTask) {
        await updateTask(editTask.id, formattedData);
        // Actualizar asignados
        await setAssignees({
          taskId: editTask.id,
          userIds: data.assigned_user_ids || [],
          teamIds: data.assigned_team_ids || [],
        });
      } else {
        const newTask = await createTask(formattedData);
        // Guardar asignados para nueva tarea
        if (newTask) {
          await setAssignees({
            taskId: newTask.id,
            userIds: data.assigned_user_ids || [],
            teamIds: data.assigned_team_ids || [],
          });

        }
      }
      setFormOpen(false);
      setEditTask(null);
      refetchTasks();
    },
    [editTask, createTask, updateTask, setAssignees, refetchTasks]
  );

  const handleArchiveTask = async () => {
    if (selectedTask) {
      await archiveTask(selectedTask.id, !selectedTask.is_archived);
      setDetailOpen(false);
      refetchTasks();
    }
  };

  const handleDeleteTask = async () => {
    if (selectedTask) {
      await deleteTask(selectedTask.id);
      setDetailOpen(false);
      refetchTasks();
    }
  };

  const loading = tasksLoading || columnsLoading || permissionsLoading;
  const visibleColumns = getVisibleColumns();
  const hasNoTasks = !loading && filteredTasks.length === 0;

  return (
    <AppLayout title="Tablero Kanban">
      <div className="space-y-6 h-full">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <PageHeader
            icon={LayoutGrid}
            title="Tablero Kanban"
            description="Organiza tus tareas arrastrándolas entre columnas según su estado."
          />
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={() => navigate('/tasks')} className="gap-2">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Ver lista</span>
            </Button>
            {canManageColumns && (
              <Button variant="outline" onClick={() => setConfigOpen(true)} className="gap-2">
                <Settings2 className="h-4 w-4" />
                <span className="hidden sm:inline">Configurar</span>
              </Button>
            )}
            {!permissionsLoading && hasPermission('tasks.create') && (
              <Button onClick={handleCreateNew} className="gap-2 shadow-sm">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nueva tarea</span>
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card className="border-border/50">
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filtros:</span>
              </div>

              <Select
                value={filters.areaId}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, areaId: value }))}
              >
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Área" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las áreas</SelectItem>
                  {areas.filter((a) => !a.is_archived).map((area) => (
                    <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.tagId}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, tagId: value }))}
              >
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Etiqueta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las etiquetas</SelectItem>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Subordinate filter for managers+ */}
              {canFilterSubordinates && subordinateMembers.length > 0 && (
                <Select
                  value={filters.assignedTo}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, assignedTo: value }))}
                >
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Users className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Ver tareas de..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los miembros</SelectItem>
                    {subordinateMembers.map((member) => (
                      <SelectItem key={member.user_id || member.id} value={member.user_id || member.id}>
                        {member.name || 'Sin nombre'} ({getRoleLabel(member.role || 'member')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select
                value={filters.type}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {TASK_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Switch
                  id="my-tasks"
                  checked={filters.myTasksOnly}
                  onCheckedChange={(checked) => setFilters((prev) => ({ ...prev, myTasksOnly: checked }))}
                />
                <Label htmlFor="my-tasks" className="text-sm cursor-pointer">Solo mis tareas</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Kanban Board */}
        {loading ? (
          <KanbanSkeleton columns={4} />
        ) : hasNoTasks ? (
          <EmptyState
            icon={LayoutGrid}
            title="Sin tareas para mostrar"
            description="No hay tareas que coincidan con los filtros seleccionados, o aún no tienes tareas creadas."
            actionLabel="Ver lista de tareas"
            onAction={() => navigate('/tasks')}
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <ScrollArea className="w-full">
              <div className="flex gap-4 pb-4">
                {visibleColumns.map((column) => (
                  <KanbanColumnComponent
                    key={column.id}
                    column={column}
                    tasks={tasksByStatus[column.status] || []}
                    onTaskClick={handleTaskClick}
                    canDragTask={canDragTask}
                  />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            <DragOverlay>
              {activeTask && (
                <div className="w-72">
                  <KanbanTaskCard
                    task={activeTask}
                    onClick={() => {}}
                    isDraggable={false}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {/* Config Dialog */}
        <KanbanConfigDialog
          open={configOpen}
          onOpenChange={setConfigOpen}
          columns={columns}
          onUpdateColumn={updateColumn}
          onReorderColumns={reorderColumns}
        />

        {/* Task Detail */}
        <TaskDetail
          open={detailOpen}
          onOpenChange={setDetailOpen}
          task={selectedTask}
          onEdit={handleEditTask}
          onArchive={handleArchiveTask}
          onDelete={handleDeleteTask}
          onStatusChange={async (newStatus) => {
            if (selectedTask) {
              await updateTask(selectedTask.id, { status: newStatus as any });
              refetchTasks();
            }
          }}
          canEdit={selectedTask ? canEditTask(selectedTask) : false}
          canDelete={selectedTask ? canDeleteTask(selectedTask) : false}
          canChangeStatus={canChangeStatus}
          onMilestoneChange={refetchTasks}
        />

        {/* Task Form */}
        <TaskForm
          open={formOpen}
          onOpenChange={setFormOpen}
          task={editTask}
          areas={areas}
          tags={tags}
          members={members}
          onSubmit={handleFormSubmit}
        />

        {/* Upgrade Modal */}
        <UpgradeModal
          open={upgradeModalOpen}
          onOpenChange={setUpgradeModalOpen}
          limitMessage={limitMessage}
        />
      </div>
    </AppLayout>
  );
}
