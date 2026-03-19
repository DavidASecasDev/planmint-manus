import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trash2, AlertTriangle, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { InactiveVehicle } from '@/types/vehicles';

interface FleetCleanupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inactiveVehicles: InactiveVehicle[];
  onArchive: (vehicleIds: string[]) => void;
  isArchiving: boolean;
}

export function FleetCleanupDialog({
  open,
  onOpenChange,
  inactiveVehicles,
  onArchive,
  isArchiving,
}: FleetCleanupDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = (vehicleId: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(vehicleId)) {
      newSelection.delete(vehicleId);
    } else {
      newSelection.add(vehicleId);
    }
    setSelectedIds(newSelection);
  };

  const toggleAll = () => {
    if (selectedIds.size === inactiveVehicles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(inactiveVehicles.map(v => v.vehicle_id)));
    }
  };

  const handleArchive = () => {
    onArchive(Array.from(selectedIds));
    setSelectedIds(new Set());
    onOpenChange(false);
  };

  const formatLastActivity = (dateString: string | null) => {
    if (!dateString) return 'Sin reservas';
    return format(new Date(dateString), "MMM yyyy", { locale: es });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-muted-foreground" />
            Limpieza de Flota
          </DialogTitle>
          <DialogDescription>
            Se detectaron {inactiveVehicles.length} vehículos que podrían no estar activos.
            Archivarlos los ocultará del Kanban pero mantendrá su historial.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[300px] -mx-6 px-6">
          <div className="space-y-2">
            {inactiveVehicles.map((vehicle) => (
              <div
                key={vehicle.vehicle_id}
                onClick={() => toggleSelection(vehicle.vehicle_id)}
                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={selectedIds.has(vehicle.vehicle_id)}
                  className="pointer-events-none"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-sm">
                      {vehicle.matricula}
                    </span>
                    {vehicle.is_suspicious && (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Sospechoso
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {vehicle.modelo || 'Sin modelo'}
                    {vehicle.categoria && ` • ${vehicle.categoria}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formatLastActivity(vehicle.last_reservation_date)}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-center gap-2 pt-2 border-t">
          <Checkbox
            id="select-all"
            checked={selectedIds.size === inactiveVehicles.length && inactiveVehicles.length > 0}
            onCheckedChange={toggleAll}
          />
          <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
            Seleccionar todos
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleArchive}
            disabled={selectedIds.size === 0 || isArchiving}
          >
            {isArchiving ? 'Archivando...' : `Archivar seleccionados (${selectedIds.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
