import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { RotateCcw, Trash2, Clock, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DeletedTask } from '@/hooks/useDeletedTasks';

interface DeletedTaskCardProps {
  task: DeletedTask;
  onRestore: (id: string) => Promise<boolean>;
  onPermanentDelete: (id: string) => Promise<boolean>;
}

export function DeletedTaskCard({ task, onRestore, onPermanentDelete }: DeletedTaskCardProps) {
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleRestore = async () => {
    setIsRestoring(true);
    await onRestore(task.id);
    setIsRestoring(false);
  };

  const handlePermanentDelete = async () => {
    setIsDeleting(true);
    await onPermanentDelete(task.id);
    setIsDeleting(false);
    setShowDeleteConfirm(false);
  };

  const deletedTimeAgo = formatDistanceToNow(new Date(task.deleted_at), {
    addSuffix: true,
    locale: es,
  });

  return (
    <>
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-foreground truncate">{task.title}</h3>
              
              <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  <span>Eliminada por {task.deleter?.name || 'Usuario desconocido'}</span>
                </div>
                <span>•</span>
                <span>{deletedTimeAgo}</span>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
                  <Clock className="h-3 w-3 mr-1" />
                  {task.daysUntilPermanentDelete > 0
                    ? `Se borrará en ${task.daysUntilPermanentDelete} días`
                    : 'Se borrará pronto'}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestore}
                disabled={isRestoring}
                className="gap-1.5"
              >
                <RotateCcw className="h-4 w-4" />
                Restaurar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La tarea "{task.title}" y todos sus datos relacionados 
              (subtareas, comentarios, etc.) serán eliminados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar permanentemente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
