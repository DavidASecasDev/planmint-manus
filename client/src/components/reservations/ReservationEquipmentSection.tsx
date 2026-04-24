import { useState, useMemo } from 'react';
import { useEquipmentInventory, useReservationEquipment } from '@/hooks/useEquipment';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Baby, Plus, ArrowRightLeft, Package, CheckCircle2 } from 'lucide-react';
import {
  EQUIPMENT_TIPO_LABELS,
  EQUIPMENT_ESTADO_COLORS,
  type EquipmentItem,
} from '@/types/equipment';

interface ReservationEquipmentSectionProps {
  reservationId: string;
  vehicleMatricula?: string;
}

export function ReservationEquipmentSection({
  reservationId,
  vehicleMatricula,
}: ReservationEquipmentSectionProps) {
  const { items: allEquipment, assignToReservation, returnFromReservation } = useEquipmentInventory();
  const { equipment: assignedEquipment, isLoading } = useReservationEquipment(reservationId);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [returningId, setReturningId] = useState<string | null>(null);

  // Available equipment (only 'disponible' items)
  const availableEquipment = useMemo(
    () => allEquipment.filter((e) => e.estado === 'disponible'),
    [allEquipment]
  );

  const handleAssign = () => {
    if (!selectedEquipmentId) return;
    assignToReservation.mutate(
      {
        equipmentId: selectedEquipmentId,
        reservationId,
        vehicleMatricula,
      },
      {
        onSuccess: () => {
          setAssignOpen(false);
          setSelectedEquipmentId('');
        },
      }
    );
  };

  const handleReturn = (equipmentId: string) => {
    setReturningId(equipmentId);
    returnFromReservation.mutate(
      { equipmentId, conditionIn: 'bueno' },
      { onSettled: () => setReturningId(null) }
    );
  };

  if (isLoading) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5" />
          Equipamiento asignado
        </h4>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setAssignOpen(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Asignar
        </Button>
      </div>

      {assignedEquipment.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 text-center">
          Sin equipamiento asignado a esta reserva
        </p>
      ) : (
        <div className="space-y-2">
          {assignedEquipment.map((eq) => (
            <div
              key={eq.id}
              className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-2"
            >
              <Baby className="h-4 w-4 text-pink-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{eq.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {eq.codigo} · {EQUIPMENT_TIPO_LABELS[eq.tipo]}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={() => handleReturn(eq.id)}
                disabled={returningId === eq.id}
              >
                <ArrowRightLeft className="h-3 w-3 mr-1" />
                {returningId === eq.id ? '...' : 'Devolver'}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Assign Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Asignar equipamiento</DialogTitle>
            <DialogDescription>
              Selecciona una unidad disponible para asignar a esta reserva
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {availableEquipment.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay equipamiento disponible en este momento
              </p>
            ) : (
              <Select value={selectedEquipmentId} onValueChange={setSelectedEquipmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar equipo..." />
                </SelectTrigger>
                <SelectContent>
                  {availableEquipment.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      <span className="font-mono text-xs mr-2">{eq.codigo}</span>
                      {eq.nombre} ({EQUIPMENT_TIPO_LABELS[eq.tipo]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedEquipmentId || assignToReservation.isPending}
            >
              {assignToReservation.isPending ? 'Asignando...' : 'Asignar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
