import { useState } from 'react';
import { MoreHorizontal, Eye, Pencil, Archive, ArchiveRestore, Trash2, Calendar, User, Target, ListTodo, Truck, Clock, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { TaskWithRelations } from '@/types/tasks';
import { TaskStatusBadge } from './TaskStatusBadge';
import { TaskPriorityBadge } from './TaskPriorityBadge';
import { AreaIcon } from '@/components/areas/AreaIcon';
import { TagBadge } from '@/components/tags/TagBadge';
import { SubtaskProgress } from '@/components/subtasks/SubtaskProgress';
import { GoalProgressBadge } from './GoalProgressBadge';
import { MilestoneProgressBadge } from '@/components/milestones/MilestoneProgressBadge';
import { OperationBadge } from '@/components/operations/OperationBadge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: TaskWithRelations;
  onView: (task: TaskWithRelations) => void;
  onEdit: (task: TaskWithRelations) => void;
  onArchive: (task: TaskWithRelations) => void;
  onDelete: (task: TaskWithRelations) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export function TaskCard({
  task,
  onView,
  onEdit,
  onArchive,
  onDelete,
  canEdit,
  canDelete,
}: TaskCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const isGoalNumeric = task.type === 'goal_numeric';
  const isGoalMilestones = task.type === 'goal_milestones';
  const isOperation = task.type === 'operation';

  return (
    <>
      <Card className={cn(
        "group transition-all duration-200 hover-lift cursor-pointer",
        "border-border/50 shadow-sm hover:shadow-md",
        task.is_archived && "opacity-60"
      )}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div
              className="flex-1 min-w-0"
              onClick={() => onView(task)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onView(task);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Ver tarea: ${task.title}`}
            >
              <div className="flex items-center gap-2.5 mb-3">
                {isGoalNumeric && (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                    <Target className="h-4 w-4 text-primary" />
                  </div>
                )}
                {isGoalMilestones && (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                    <ListTodo className="h-4 w-4 text-primary" />
                  </div>
                )}
                {isOperation && (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                    <Truck className="h-4 w-4 text-primary" />
                  </div>
                )}
                <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                  {task.title}
                </h3>
                {task.is_archived && (
                  <Badge variant="secondary" className="text-xs font-medium">
                    Archivada
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                <TaskStatusBadge status={task.status} />
                <TaskPriorityBadge priority={task.priority} />
                {isOperation && task.operation_type && (
                  <OperationBadge operationType={task.operation_type} />
                )}
              </div>

              {/* Goal Progress for goal_numeric tasks */}
              {isGoalNumeric && task.goal_target_value && task.goal_unit && (
                <div className="mb-4">
                  <GoalProgressBadge
                    currentValue={task.goalCurrentValue || 0}
                    targetValue={task.goal_target_value}
                    unit={task.goal_unit}
                    showBar
                  />
                </div>
              )}

              {/* Milestone Progress for goal_milestones tasks */}
              {isGoalMilestones && (
                <div className="mb-4">
                  <MilestoneProgressBadge
                    completed={task.milestoneCompleted || 0}
                    total={task.milestoneCount || 0}
                    showBar
                  />
                </div>
              )}

              {/* Operation scheduled time */}
              {isOperation && task.scheduled_at && (
                <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {format(new Date(task.scheduled_at), 'dd MMM yyyy HH:mm', { locale: es })}
                  </span>
                </div>
              )}

              {task.areas.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {task.areas.map((area) => (
                    <div
                      key={area.id}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                      style={{ backgroundColor: `${area.color}15`, color: area.color || undefined }}
                    >
                      <AreaIcon icon={area.icon || 'folder'} size={12} />
                      <span>{area.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {task.tags && task.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {task.tags.map((tag) => (
                    <TagBadge key={tag.id} tag={tag} size="sm" />
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                {task.assignees && (task.assignees.users.length > 0 || task.assignees.teams.length > 0) ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    {task.assignees.users.map((user) => (
                      <div key={user.id} className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        <span className="font-medium">{user.name || 'Sin nombre'}</span>
                      </div>
                    ))}
                    {task.assignees.teams.map((team) => (
                      <Badge
                        key={team.id}
                        variant="outline"
                        className="gap-1 text-xs py-0.5"
                        style={{ backgroundColor: `${team.color}15`, borderColor: team.color, color: team.color }}
                      >
                        <Users className="h-3 w-3" />
                        {team.name}
                      </Badge>
                    ))}
                  </div>
                ) : task.assignee ? (
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    <span className="font-medium">{task.assignee.name || 'Sin nombre'}</span>
                  </div>
                ) : null}
                {task.due_date && !isOperation && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{format(new Date(task.due_date), 'dd MMM yyyy', { locale: es })}</span>
                  </div>
                )}
                {!isGoalNumeric && !isOperation && task.subtaskCount !== undefined && task.subtaskCount > 0 && (
                  <SubtaskProgress
                    completed={task.subtaskCompleted || 0}
                    total={task.subtaskCount}
                    showBar
                  />
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onView(task)} className="gap-2.5 cursor-pointer">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  Ver detalle
                </DropdownMenuItem>
                {canEdit && (
                  <DropdownMenuItem onClick={() => onEdit(task)} className="gap-2.5 cursor-pointer">
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                    Editar
                  </DropdownMenuItem>
                )}
                {canEdit && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onArchive(task)} className="gap-2.5 cursor-pointer">
                      {task.is_archived ? (
                        <>
                          <ArchiveRestore className="h-4 w-4 text-muted-foreground" />
                          Desarchivar
                        </>
                      ) : (
                        <>
                          <Archive className="h-4 w-4 text-muted-foreground" />
                          Archivar
                        </>
                      )}
                    </DropdownMenuItem>
                  </>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="gap-2.5 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La tarea "{task.title}" será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="mt-0">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete(task);
                setShowDeleteDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
