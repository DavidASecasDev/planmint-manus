import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';
import { useUsageTracking } from '@/hooks/useUsageTracking';
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfWeek,
  parseISO,
  isWithinInterval,
  isSameDay,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, List, Calendar as CalendarIcon } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { CalendarFilters } from '@/components/calendar/CalendarFilters';
import { CalendarMonthView } from '@/components/calendar/CalendarMonthView';
import { CalendarWeekView } from '@/components/calendar/CalendarWeekView';
import { CalendarDayView } from '@/components/calendar/CalendarDayView';
import { CalendarRangeView } from '@/components/calendar/CalendarRangeView';
import { TaskDetail } from '@/components/tasks/TaskDetail';
import { TaskForm } from '@/components/tasks/TaskForm';
import { useTasks } from '@/hooks/useTasks';
import { useTaskAssignees } from '@/hooks/useTaskAssignees';
import { useAreas } from '@/hooks/useAreas';
import { useTags } from '@/hooks/useTags';
import { useOrganizationMembers } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { CalendarViewMode, CalendarFilters as CalendarFiltersType, DEFAULT_CALENDAR_FILTERS } from '@/types/calendar';
import { TaskWithRelations } from '@/types/tasks';

export default function Calendar() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { tasks, updateTask, archiveTask, deleteTask, canEditTask, canDeleteTask, refetch: refetchTasks } = useTasks();
  const { setAssignees } = useTaskAssignees();
  const { trackCalendarViewed } = useUsageTracking();

  // Track calendar view on mount
  useEffect(() => {
    trackCalendarViewed();
  }, [trackCalendarViewed]);
  const { areas } = useAreas();
  const { tags } = useTags();
  const { members } = useOrganizationMembers();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [urlState, setUrlState] = usePersistedFilters({
    viewMode: 'month' as string,
    search: '',
    status: 'all' as string,
    priority: 'all' as string,
    type: 'all' as string,
  });
  const viewMode = urlState.viewMode as CalendarViewMode;
  const setViewMode = (v: CalendarViewMode) => setUrlState(prev => ({ ...prev, viewMode: v }));

  // Full calendar filters: URL-persisted fields + local-only fields
  const [localFilters, setLocalFilters] = useState<Pick<CalendarFiltersType, 'areaIds' | 'tagIds' | 'assigneeId' | 'onlyMine' | 'dateFrom' | 'dateTo'>>({
    areaIds: [],
    tagIds: [],
    assigneeId: null,
    onlyMine: false,
    dateFrom: null,
    dateTo: null,
  });

  const filters: CalendarFiltersType = useMemo(() => ({
    search: urlState.search,
    status: urlState.status as CalendarFiltersType['status'],
    priority: urlState.priority as CalendarFiltersType['priority'],
    type: urlState.type as CalendarFiltersType['type'],
    ...localFilters,
  }), [urlState, localFilters]);

  const setFilters = useCallback((update: CalendarFiltersType | ((prev: CalendarFiltersType) => CalendarFiltersType)) => {
    const newFilters = typeof update === 'function' ? update(filters) : update;
    setUrlState(prev => ({
      ...prev,
      search: newFilters.search,
      status: newFilters.status,
      priority: newFilters.priority,
      type: newFilters.type,
    }));
    setLocalFilters({
      areaIds: newFilters.areaIds,
      tagIds: newFilters.tagIds,
      assigneeId: newFilters.assigneeId,
      onlyMine: newFilters.onlyMine,
      dateFrom: newFilters.dateFrom,
      dateTo: newFilters.dateTo,
    });
  }, [filters, setUrlState]);
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Filter tasks based on criteria
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Only tasks with due_date
      if (!task.due_date) return false;

      // Date range filter (if set)
      if (filters.dateFrom && filters.dateTo) {
        const taskDate = parseISO(task.due_date);
        if (!isWithinInterval(taskDate, { start: filters.dateFrom, end: filters.dateTo })) {
          return false;
        }
      } else if (filters.dateFrom) {
        const taskDate = parseISO(task.due_date);
        if (taskDate < filters.dateFrom) return false;
      } else if (filters.dateTo) {
        const taskDate = parseISO(task.due_date);
        if (taskDate > filters.dateTo) return false;
      }

      // Status filter
      if (filters.status !== 'all' && task.status !== filters.status) return false;

      // Priority filter
      if (filters.priority !== 'all' && task.priority !== filters.priority) return false;

      // Type filter
      if (filters.type !== 'all' && task.type !== filters.type) return false;

      // Assignee filter
      if (filters.assigneeId && task.assigned_to !== filters.assigneeId) return false;

      // Only mine filter
      if (filters.onlyMine) {
        if (task.created_by !== profile?.id && task.assigned_to !== profile?.id) return false;
      }

      // Area filter
      if (filters.areaIds.length > 0) {
        const taskAreaIds = task.areas?.map((a) => a.id) || [];
        if (!filters.areaIds.some((id) => taskAreaIds.includes(id))) return false;
      }

      // Tag filter
      if (filters.tagIds.length > 0) {
        const taskTagIds = task.tags?.map((t) => t.id) || [];
        if (!filters.tagIds.some((id) => taskTagIds.includes(id))) return false;
      }

      return true;
    });
  }, [tasks, filters, profile?.id]);

  // Check if we should show range view
  const showRangeView = filters.dateFrom !== null && filters.dateTo !== null;

  const handlePrevious = () => {
    switch (viewMode) {
      case 'month':
        setCurrentDate(subMonths(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(subWeeks(currentDate, 1));
        break;
      case 'day':
        setCurrentDate(subDays(currentDate, 1));
        break;
    }
  };

  const handleNext = () => {
    switch (viewMode) {
      case 'month':
        setCurrentDate(addMonths(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(addWeeks(currentDate, 1));
        break;
      case 'day':
        setCurrentDate(addDays(currentDate, 1));
        break;
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleTaskClick = (task: TaskWithRelations) => {
    setSelectedTask(task);
    setDetailOpen(true);
  };

  const handleEdit = useCallback(() => {
    setDetailOpen(false);
    setIsEditing(true);
    setFormOpen(true);
  }, []);

  const handleArchive = useCallback(async () => {
    if (selectedTask) {
      await archiveTask(selectedTask.id, !selectedTask.is_archived);
      setDetailOpen(false);
      refetchTasks();
    }
  }, [selectedTask, archiveTask, refetchTasks]);

  const handleDelete = useCallback(async () => {
    if (selectedTask) {
      await deleteTask(selectedTask.id);
      setDetailOpen(false);
      refetchTasks();
    }
  }, [selectedTask, deleteTask, refetchTasks]);

  const handleFormSubmit = useCallback(async (data: any) => {
    if (isEditing && selectedTask) {
      await updateTask(selectedTask.id, data);
      // Save assignees (users and teams)
      if (data.assigned_user_ids || data.assigned_team_ids) {
        await setAssignees({
          taskId: selectedTask.id,
          userIds: data.assigned_user_ids || [],
          teamIds: data.assigned_team_ids || [],
        });
      }
    }
    setFormOpen(false);
    setIsEditing(false);
    setSelectedTask(null);
    refetchTasks();
  }, [isEditing, selectedTask, updateTask, setAssignees, refetchTasks]);

  const getHeaderTitle = () => {
    // If range mode is active
    if (showRangeView && filters.dateFrom && filters.dateTo) {
      return `${format(filters.dateFrom, "d MMM", { locale: es })} - ${format(filters.dateTo, "d MMM yyyy", { locale: es })}`;
    }
    
    switch (viewMode) {
      case 'month':
        return format(currentDate, "MMMM 'de' yyyy", { locale: es });
      case 'week':
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        return `Semana del ${format(weekStart, "d 'de' MMMM", { locale: es })}`;
      case 'day':
        return format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
      default:
        return format(currentDate, "MMMM 'de' yyyy", { locale: es });
    }
  };

  return (
    <AppLayout title="Calendario">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <PageHeader
            icon={CalendarIcon}
            title="Calendario"
            description="Visualiza tus tareas y objetivos en el tiempo."
          />
          <Button variant="outline" onClick={() => navigate('/tasks')} className="gap-2 shrink-0">
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Ver lista</span>
          </Button>
        </div>

        <div className="flex flex-col" style={{ height: 'calc(100vh - 260px)' }}>
          {/* Calendar controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleToday} className="font-medium">
                Hoy
              </Button>
              <div className="flex items-center rounded-lg border border-border/50 bg-card">
                <Button variant="ghost" size="icon" onClick={handlePrevious} className="rounded-r-none">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleNext} className="rounded-l-none">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <h2 className="text-lg font-semibold capitalize ml-2">
                {getHeaderTitle()}
              </h2>
            </div>

            <Tabs
              value={viewMode}
              onValueChange={(value) => setViewMode(value as CalendarViewMode)}
            >
              <TabsList className="bg-muted/50">
                <TabsTrigger value="month">Mes</TabsTrigger>
                <TabsTrigger value="week">Semana</TabsTrigger>
                <TabsTrigger value="day">Día</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Filters */}
          <CalendarFilters
            filters={filters}
            onFiltersChange={setFilters}
            areas={areas}
            tags={tags}
            members={members}
          />

          {/* Calendar view */}
          <div className="flex-1 min-h-0 mt-4">
            {showRangeView && filters.dateFrom && filters.dateTo ? (
              <CalendarRangeView
                dateFrom={filters.dateFrom}
                dateTo={filters.dateTo}
                tasks={filteredTasks}
                onTaskClick={handleTaskClick}
              />
            ) : (
              <>
                {viewMode === 'month' && (
                  <CalendarMonthView
                    currentDate={currentDate}
                    tasks={filteredTasks}
                    onTaskClick={handleTaskClick}
                  />
                )}
                {viewMode === 'week' && (
                  <CalendarWeekView
                    currentDate={currentDate}
                    tasks={filteredTasks}
                    onTaskClick={handleTaskClick}
                  />
                )}
                {viewMode === 'day' && (
                  <CalendarDayView
                    currentDate={currentDate}
                    tasks={filteredTasks}
                    onTaskClick={handleTaskClick}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Task detail */}
      <TaskDetail
        task={selectedTask}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={handleEdit}
        onArchive={handleArchive}
        onDelete={handleDelete}
        canEdit={selectedTask ? canEditTask(selectedTask) : false}
        canDelete={selectedTask ? canDeleteTask(selectedTask) : false}
        onMilestoneChange={refetchTasks}
      />

      {/* Task form */}
      <TaskForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setIsEditing(false);
            setSelectedTask(null);
          }
        }}
        onSubmit={handleFormSubmit}
        areas={areas}
        tags={tags}
        members={members}
        task={isEditing ? selectedTask : null}
      />
    </AppLayout>
  );
}
