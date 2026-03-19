import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/loading-skeleton';
import { Input } from '@/components/ui/input';
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
} from '@/components/ui/alert-dialog';
import { Trash2, Search, AlertTriangle } from 'lucide-react';
import { DeletedTaskCard } from '@/components/tasks/DeletedTaskCard';
import { useDeletedTasks } from '@/hooks/useDeletedTasks';

export default function TasksTrash() {
  const { 
    deletedTasks, 
    loading, 
    search, 
    setSearch,
    canAccessTrash,
    restoreTask, 
    permanentlyDeleteTask,
    emptyTrash 
  } = useDeletedTasks();
  
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const [isEmptying, setIsEmptying] = useState(false);

  if (!canAccessTrash) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleEmptyTrash = async () => {
    setIsEmptying(true);
    await emptyTrash();
    setIsEmptying(false);
    setShowEmptyConfirm(false);
  };

  return (
    <AppLayout title="Papelera de tareas">
      <div className="space-y-6">
        <PageHeader
          title="Papelera de tareas"
          description="Las tareas eliminadas se borran permanentemente después de 30 días."
          icon={Trash2}
          actions={
            deletedTasks.length > 0 && (
              <Button 
                variant="destructive" 
                onClick={() => setShowEmptyConfirm(true)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Vaciar papelera
              </Button>
            )
          }
        />

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar tareas eliminadas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Content */}
        {loading ? (
          <ListSkeleton count={3} />
        ) : deletedTasks.length === 0 ? (
          <EmptyState
            icon={Trash2}
            title={search ? 'No se encontraron tareas' : 'La papelera está vacía'}
            description={
              search
                ? 'Prueba con otros términos de búsqueda.'
                : 'Las tareas que elimines aparecerán aquí durante 30 días antes de ser eliminadas permanentemente.'
            }
          />
        ) : (
          <div className="space-y-3">
            {deletedTasks.map((task) => (
              <DeletedTaskCard
                key={task.id}
                task={task}
                onRestore={restoreTask}
                onPermanentDelete={permanentlyDeleteTask}
              />
            ))}
          </div>
        )}
      </div>

      {/* Empty Trash Confirmation */}
      <AlertDialog open={showEmptyConfirm} onOpenChange={setShowEmptyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              ¿Vaciar la papelera?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente {deletedTasks.length} tarea(s) y todos sus datos 
              relacionados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEmptyTrash}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isEmptying ? 'Vaciando...' : 'Vaciar papelera'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
