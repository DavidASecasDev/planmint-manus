import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Archive, RotateCcw, Trash2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import type { Vehicle } from '@/types/vehicles';

interface ArchivedVehiclesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: Vehicle[];
  onRestore: (vehicleId: string) => void;
  onDelete: (vehicleId: string) => void;
  isRestoring: boolean;
  isDeleting: boolean;
}

export function ArchivedVehiclesSheet({
  open,
  onOpenChange,
  vehicles,
  onRestore,
  onDelete,
  isRestoring,
  isDeleting,
}: ArchivedVehiclesSheetProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), "d MMM yyyy", { locale: es });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-muted-foreground" />
            Vehículos Archivados
          </SheetTitle>
          <SheetDescription>
            Estos vehículos no aparecen en el Kanban operacional.
            Puedes restaurarlos o eliminarlos permanentemente.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="mt-6 h-[calc(100vh-200px)]">
          {vehicles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Archive className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No hay vehículos archivados</p>
              <p className="text-sm">Los vehículos que archives aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-3 pr-4">
              {vehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-mono font-semibold text-sm">
                        {vehicle.matricula}
                      </h4>
                      <p className="text-xs text-muted-foreground truncate">
                        {vehicle.modelo || 'Sin modelo'}
                        {vehicle.categoria && ` • ${vehicle.categoria}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Archivado: {formatDate(vehicle.archived_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRestore(vehicle.id)}
                        disabled={isRestoring || isDeleting}
                        title="Restaurar"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            disabled={isRestoring || isDeleting}
                            title="Eliminar permanentemente"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar vehículo?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción eliminará permanentemente el vehículo{' '}
                              <strong>{vehicle.matricula}</strong> y todo su historial de tareas.
                              Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => onDelete(vehicle.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
