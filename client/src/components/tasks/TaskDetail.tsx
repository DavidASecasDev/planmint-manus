import { Calendar, User, Users, Clock, Pencil, Archive, ArchiveRestore, Trash2, Target, ListTodo, FolderOpen, Tag, Truck, ChevronDown } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TaskWithRelations, TASK_STATUS_OPTIONS } from '@/types/tasks';
import { TaskStatusBadge } from './TaskStatusBadge';
import { TaskPriorityBadge } from './TaskPriorityBadge';
import { AreaIcon } from '@/components/areas/AreaIcon';
import { TagIcon } from '@/components/tags/TagIcon';
import { GoalProgressSection } from './GoalProgressSection';
import { MilestonesSection } from '@/components/milestones/MilestonesSection';
import { TimelineSection } from '@/components/timeline/TimelineSection';
import { RemindersSection } from '@/components/reminders/RemindersSection';
import { TaskSummaryCard } from '@/components/ai/TaskSummaryCard';
import { OperationDetailPanel } from '@/components/operations/OperationDetailPanel';

interface TaskDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskWithRelations | null;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onStatusChange?: (newStatus: string) => void;
  canEdit: boolean;
  canDelete: boolean;
  canChangeStatus?: boolean;
  onMilestoneChange?: () => void;
}

export function TaskDetail({
  open,
  onOpenChange,
  task,
  onEdit,
  onArchive,
  onDelete,
  onStatusChange,
  canEdit,
  canDelete,
  canChangeStatus = false,
  onMilestoneChange,
}: TaskDetailProps) {
  if (!task) return null;

  const isGoalNumeric = task.type === 'goal_numeric';
  const isGoalMilestones = task.type === 'goal_milestones';
  const isOperation = task.type === 'operation';

  const getTypeLabel = () => {
    if (isGoalNumeric) return 'Objetivo numérico';
    if (isGoalMilestones) return 'Objetivo por hitos';
    if (isOperation) return 'Operación';
    return 'Tarea simple';
  };

  const getTypeIcon = () => {
    if (isGoalNumeric) return <Target className="h-3.5 w-3.5" />;
    if (isGoalMilestones) return <ListTodo className="h-3.5 w-3.5" />;
    if (isOperation) return <Truck className="h-3.5 w-3.5" />;
    return null;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto p-0">
        {/* Header with gradient */}
        <div className="sticky top-0 z-10 bg-gradient-to-b from-background via-background to-transparent pb-4">
          <SheetHeader className="p-6 pb-0">
            <div className="flex items-start justify-between gap-4">
              <SheetTitle className="text-xl font-semibold leading-tight pr-8">
                {task.title}
              </SheetTitle>
            </div>
          </SheetHeader>
          
          {/* Status badges */}
          <div className="flex flex-wrap items-center gap-2 px-6 mt-4">
            {canChangeStatus && !canEdit && onStatusChange ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <TaskStatusBadge status={task.status} />
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {TASK_STATUS_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => onStatusChange(opt.value)}
                      className={task.status === opt.value ? 'font-medium' : ''}
                    >
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <TaskStatusBadge status={task.status} />
            )}
            <TaskPriorityBadge priority={task.priority} />
            {task.is_archived && (
              <Badge variant="secondary" className="text-xs">Archivada</Badge>
            )}
            <Badge variant="outline" className="text-xs flex items-center gap-1.5">
              {getTypeIcon()}
              {getTypeLabel()}
            </Badge>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Operation Detail Panel */}
          {isOperation && (
            <OperationDetailPanel task={task} />
          )}

          {/* Goal Progress Section */}
          {isGoalNumeric && (
            <Card className="border-border/50 shadow-sm overflow-hidden">
              <CardHeader className="pb-3 bg-primary/5">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Progreso del objetivo
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <GoalProgressSection task={task} canEdit={canEdit} />
              </CardContent>
            </Card>
          )}

          {/* Milestones Section */}
          {isGoalMilestones && (
            <Card className="border-border/50 shadow-sm overflow-hidden">
              <CardHeader className="pb-3 bg-primary/5">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-primary" />
                  Hitos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <MilestonesSection taskId={task.id} canEdit={canEdit} canChangeStatus={canChangeStatus} onMilestoneChange={onMilestoneChange} />
              </CardContent>
            </Card>
          )}

          {/* Overview Card - hide for operations */}
          {!isOperation && (
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-4 space-y-4">
                {/* Description */}
                {task.description && (
                  <div>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {task.description}
                    </p>
                  </div>
                )}

                {/* Details grid */}
                <div className="grid gap-3">
                  {(() => {
                    const hasMultipleAssignees = task.assignees && (task.assignees.users.length > 0 || task.assignees.teams.length > 0);
                    if (hasMultipleAssignees) {
                      return (
                        <div className="flex items-start gap-3 text-sm">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
                            <Users className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground">Asignados</p>
                            <div className="flex flex-wrap gap-2">
                              {task.assignees!.users.map((u) => (
                                <div key={u.id} className="flex items-center gap-1.5">
                                  <Avatar className="h-6 w-6">
                                    {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.name || ''} />}
                                    <AvatarFallback className="text-[10px]">
                                      {(u.name || '?').slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium text-sm">{u.name || 'Sin nombre'}</span>
                                </div>
                              ))}
                              {task.assignees!.teams.map((t) => (
                                <Badge key={t.id} variant="outline" className="text-xs" style={{ borderColor: t.color, color: t.color }}>
                                  {t.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    if (task.assignee) {
                      return (
                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Asignado a</p>
                            <p className="font-medium">{task.assignee.name || 'Sin nombre'}</p>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Asignado a</p>
                          <p className="font-medium text-muted-foreground">Sin asignar</p>
                        </div>
                      </div>
                    );
                  })()}

                  {task.due_date && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Fecha límite</p>
                        <p className="font-medium">
                          {format(new Date(task.due_date), 'PPP', { locale: es })}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Creada por</p>
                      <p className="font-medium">{task.creator?.name || 'Desconocido'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Última actualización</p>
                      <p className="font-medium">
                        {format(new Date(task.updated_at), 'PPP', { locale: es })}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Areas & Tags Accordion - hide for operations */}
          {!isOperation && (
            <Accordion type="multiple" defaultValue={['areas', 'tags']} className="space-y-2">
              {task.areas.length > 0 && (
                <AccordionItem value="areas" className="border rounded-xl px-4 bg-card shadow-sm">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      Áreas ({task.areas.length})
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="flex flex-wrap gap-2">
                      {task.areas.map((area) => (
                        <div
                          key={area.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                          style={{ backgroundColor: `${area.color}15`, color: area.color || undefined }}
                        >
                          <AreaIcon icon={area.icon || 'folder'} size={14} />
                          <span>{area.name}</span>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {task.tags && task.tags.length > 0 && (
                <AccordionItem value="tags" className="border rounded-xl px-4 bg-card shadow-sm">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      Etiquetas ({task.tags.length})
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="flex flex-wrap gap-2">
                      {task.tags.map((tag) => (
                        <div
                          key={tag.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                          style={{
                            backgroundColor: `${tag.color}15`,
                            borderColor: `${tag.color}40`,
                            color: tag.color,
                          }}
                        >
                          <TagIcon icon={tag.icon} size={12} />
                          <span>{tag.name}</span>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          )}

          {/* AI Summary Section - hide for operations */}
          {!isOperation && <TaskSummaryCard taskId={task.id} />}

          {/* Reminders Section - hide for operations */}
          {!isOperation && (
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-4">
                <RemindersSection taskId={task.id} canEdit={canEdit} />
              </CardContent>
            </Card>
          )}

          {/* Timeline Section */}
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              <TimelineSection 
                taskId={task.id} 
                canEdit={canEdit}
                goalUnit={isGoalNumeric ? task.goal_unit || undefined : undefined}
              />
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2">
            {canEdit && (
              <Button onClick={onEdit} className="gap-2 shadow-sm">
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            )}

            {canEdit && (
              <Button variant="outline" onClick={onArchive} className="gap-2">
                {task.is_archived ? (
                  <>
                    <ArchiveRestore className="h-4 w-4" />
                    Restaurar
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4" />
                    Archivar
                  </>
                )}
              </Button>
            )}

            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. La tarea "{task.title}" será eliminada
                      permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
