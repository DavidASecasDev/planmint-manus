import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trash2, Plus, Minus } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { TaskUpdateWithUser, UPDATE_TYPE_CONFIG } from '@/types/updates';
import { ImageGallery } from './ImageGallery';
import { cn } from '@/lib/utils';

interface TimelineItemProps {
  update: TaskUpdateWithUser;
  canDelete: boolean;
  onDelete: (id: string) => void;
  goalUnit?: string;
}

export function TimelineItem({ update, canDelete, onDelete, goalUnit }: TimelineItemProps) {
  const config = UPDATE_TYPE_CONFIG[update.type] || UPDATE_TYPE_CONFIG.note;
  const isGoalIncrement = update.type === 'goal_increment';
  const value = update.goal_increment_value || 0;
  const isPositive = value >= 0;

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Parse text to highlight mentions
  const renderTextWithMentions = (text: string | null) => {
    if (!text) return null;

    // Simple regex to find @mentions
    const parts = text.split(/(@\w+(?:\s+\w+)?)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        // Check if this mention corresponds to an actual mentioned user
        const mentionName = part.slice(1);
        const isMentioned = update.mentions?.some(
          m => m.mentioned_user?.name?.toLowerCase() === mentionName.toLowerCase()
        );
        
        return (
          <span 
            key={index} 
            className={cn(
              "font-semibold px-1 py-0.5 rounded-md",
              isMentioned 
                ? "text-primary bg-primary/10" 
                : "text-primary/70"
            )}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="flex gap-3 p-3.5 rounded-xl bg-card border border-border/50 transition-all duration-200 hover:border-border hover:shadow-sm group">
      {/* Icon/Avatar area */}
      <div className="shrink-0">
        {isGoalIncrement ? (
          <div
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-full transition-transform group-hover:scale-105',
              isPositive 
                ? 'bg-green-500/15 text-green-600 dark:text-green-400' 
                : 'bg-red-500/15 text-red-600 dark:text-red-400'
            )}
          >
            {isPositive ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
          </div>
        ) : (
          <Avatar className="h-9 w-9">
            <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
              {getInitials(update.user?.name || null)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Header: user, type badge, date */}
        <div className="flex items-center flex-wrap gap-2">
          <span className="font-semibold text-sm">
            {update.user?.name || 'Usuario'}
          </span>
          <Badge 
            variant="secondary" 
            className={cn("text-xs font-medium", config.bgColor, config.color)}
          >
            {config.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {format(new Date(update.created_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
          </span>
        </div>

        {/* Goal increment value */}
        {isGoalIncrement && (
          <p className={cn(
            'font-bold text-lg',
            isPositive 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          )}>
            {isPositive ? '+' : ''}
            {value.toLocaleString('es-ES', { maximumFractionDigits: 2 })} {goalUnit || ''}
          </p>
        )}

        {/* Text content with mentions */}
        {update.text && (
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {renderTextWithMentions(update.text)}
          </p>
        )}

        {/* Image gallery */}
        {update.images && update.images.length > 0 && (
          <ImageGallery images={update.images} />
        )}
      </div>

      {/* Actions */}
      {canDelete && (
        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar actualización?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Las imágenes adjuntas también se eliminarán.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(update.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
