import { Plus, ClipboardList, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { TaskCard } from './TaskCard';
import { TaskFilters } from './TaskFilters';
import { TaskWithRelations, TaskFilters as TaskFiltersType } from '@/types/tasks';
import { Area } from '@/types/areas';
import { Tag } from '@/types/tags';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/loading-skeleton';

interface OrganizationMember {
  id?: string;
  user_id?: string;
  name?: string | null;
  role?: string;
}

interface TaskListProps {
  tasks: TaskWithRelations[];
  loading: boolean;
  filters: TaskFiltersType;
  onFiltersChange: (filters: TaskFiltersType) => void;
  areas: Area[];
  tags: Tag[];
  members?: OrganizationMember[];
  currentUserRole?: string;
  canCreate: boolean;
  canEditTask: (task: TaskWithRelations) => boolean;
  canDeleteTask: (task: TaskWithRelations) => boolean;
  onCreateNew: () => void;
  onView: (task: TaskWithRelations) => void;
  onEdit: (task: TaskWithRelations) => void;
  onArchive: (task: TaskWithRelations) => void;
  onDelete: (task: TaskWithRelations) => void;
  canAccessTrash?: boolean;
}

export function TaskList({
  tasks,
  loading,
  filters,
  onFiltersChange,
  areas,
  tags,
  members,
  currentUserRole,
  canCreate,
  canEditTask,
  canDeleteTask,
  onCreateNew,
  onView,
  onEdit,
  onArchive,
  onDelete,
  canAccessTrash = false,
}: TaskListProps) {
  const hasActiveFilters = filters.search || filters.status !== 'all' || filters.priority !== 'all' || filters.areaIds.length > 0 || filters.onlyMine || filters.assigneeId !== 'all';

  return (
    <div>
      <PageHeader
        title="Tareas"
        description="Gestiona tus tareas y trabajo diario. Organiza por estado, prioridad y áreas."
        icon={ClipboardList}
        actions={
          <div className="flex items-center gap-2">
            {canAccessTrash && (
              <Button variant="outline" size="lg" asChild className="gap-2">
                <Link to="/settings/admin/trash">
                  <Trash2 className="h-4 w-4" />
                  Papelera
                </Link>
              </Button>
            )}
            {canCreate && (
              <Button onClick={onCreateNew} size="lg" className="gap-2 shadow-sm">
                <Plus className="h-4 w-4" />
                Nueva tarea
              </Button>
            )}
          </div>
        }
      />

      {/* Filters */}
      <TaskFilters 
        filters={filters} 
        onFiltersChange={onFiltersChange} 
        areas={areas} 
        tags={tags}
        members={members}
        currentUserRole={currentUserRole}
      />

      {/* Content */}
      {loading ? (
        <ListSkeleton count={4} />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={hasActiveFilters ? 'No se encontraron tareas' : 'Aún no tienes tareas'}
          description={
            hasActiveFilters
              ? 'Prueba ajustando los filtros de búsqueda para encontrar lo que buscas.'
              : 'Crea tu primera tarea para empezar a organizar tu trabajo. Puedes crear tareas simples o con objetivos.'
          }
          action={
            canCreate && !hasActiveFilters
              ? {
                  label: 'Crear mi primera tarea',
                  onClick: onCreateNew,
                  icon: Plus,
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onView={onView}
              onEdit={onEdit}
              onArchive={onArchive}
              onDelete={onDelete}
              canEdit={canEditTask(task)}
              canDelete={canDeleteTask(task)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
