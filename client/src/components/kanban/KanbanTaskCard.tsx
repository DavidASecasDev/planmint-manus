import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Target, ListTodo, CheckSquare, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TaskWithRelations } from '@/types/tasks';
import { TaskPriorityBadge } from '@/components/tasks/TaskPriorityBadge';
import { cn } from '@/lib/utils';

interface KanbanTaskCardProps {
  task: TaskWithRelations;
  onClick: () => void;
  isDraggable: boolean;
}

export function KanbanTaskCard({ task, onClick, isDraggable }: KanbanTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: !isDraggable,
    data: {
      type: 'task',
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getTypeIcon = () => {
    switch (task.type) {
      case 'goal_numeric':
        return <Target className="h-3 w-3" />;
      case 'goal_milestones':
        return <ListTodo className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getTypeLabel = () => {
    switch (task.type) {
      case 'goal_numeric':
        return 'Numérico';
      case 'goal_milestones':
        return 'Hitos';
      default:
        return null;
    }
  };

  const getProgress = () => {
    if (task.type === 'goal_numeric' && task.goal_target_value) {
      const current = task.goalCurrentValue || 0;
      const percentage = Math.min(100, Math.round((current / task.goal_target_value) * 100));
      return `${percentage}%`;
    }
    if (task.type === 'goal_milestones' && task.milestoneCount) {
      return `${task.milestoneCompleted || 0}/${task.milestoneCount}`;
    }
    return null;
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const displayedAreas = task.areas.slice(0, 2);
  const remainingAreas = task.areas.length - 2;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(isDraggable ? listeners : {})}
      className={cn(
        "mb-2 border-border/50 bg-card transition-all duration-200",
        "hover:shadow-md hover:border-border hover:-translate-y-0.5",
        isDraggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary/50 rotate-1"
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Tarea: ${task.title}`}
    >
      <CardContent className="p-3.5 space-y-2.5">
        {/* Title */}
        <h4 className="font-medium text-sm leading-snug line-clamp-2">{task.title}</h4>

        {/* Type and Priority */}
        <div className="flex flex-wrap items-center gap-1.5">
          {getTypeIcon() && (
            <Badge variant="outline" className="text-xs gap-1 py-0.5 px-2 font-normal">
              {getTypeIcon()}
              {getTypeLabel()}
            </Badge>
          )}
          <TaskPriorityBadge priority={task.priority} />
          {getProgress() && (
            <Badge variant="secondary" className="text-xs py-0.5 px-2 font-medium bg-primary/10 text-primary">
              {getProgress()}
            </Badge>
          )}
        </div>

        {/* Areas */}
        {displayedAreas.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {displayedAreas.map((area) => (
              <span
                key={area.id}
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: `${area.color}15`,
                  color: area.color || undefined,
                }}
              >
                {area.name}
              </span>
            ))}
            {remainingAreas > 0 && (
              <span className="text-xs text-muted-foreground font-medium">+{remainingAreas}</span>
            )}
          </div>
        )}

        {/* Subtasks progress */}
        {(task.subtaskCount ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckSquare className="h-3.5 w-3.5" />
            <span className="font-medium">{task.subtaskCompleted}/{task.subtaskCount}</span>
          </div>
        )}

        {/* Footer: Assignees and Due Date */}
        <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
          {task.assignees && (task.assignees.users.length > 0 || task.assignees.teams.length > 0) ? (() => {
            const allUsers = task.assignees!.users;
            const allTeams = task.assignees!.teams;
            const maxAvatars = 3;
            const displayedUsers = allUsers.slice(0, maxAvatars);
            const remaining = Math.max(0, allUsers.length - maxAvatars);
            return (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center -space-x-3">
                  {displayedUsers.map((user) => (
                    <Avatar key={user.id} className="h-12 w-12 border-2 border-card" title={user.name || undefined}>
                      {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name || ''} />}
                      <AvatarFallback className="text-sm bg-primary/10 text-primary font-medium">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                {allTeams.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
                    style={{ backgroundColor: `${team.color}20`, color: team.color }}
                  >
                    <Users className="h-3 w-3" />
                    {team.name}
                  </div>
                ))}
                {remaining > 0 && (
                  <span className="text-[10px] text-muted-foreground">+{remaining}</span>
                )}
              </div>
            );
          })() : task.assignee ? (
            <div className="flex items-center gap-1.5">
            <Avatar className="h-12 w-12" title={task.assignee.name || undefined}>
              {task.assignee.avatar_url && <AvatarImage src={task.assignee.avatar_url} alt={task.assignee.name || ''} />}
              <AvatarFallback className="text-sm bg-primary/10 text-primary font-medium">
                  {getInitials(task.assignee.name)}
                </AvatarFallback>
              </Avatar>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground/60">Sin asignar</span>
          )}

          {task.due_date && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(task.due_date), 'd MMM', { locale: es })}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
