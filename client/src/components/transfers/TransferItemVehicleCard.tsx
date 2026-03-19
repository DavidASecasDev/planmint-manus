import { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Car } from 'lucide-react';
import { VEHICLE_TYPES } from '@/lib/transferPricing';
import type { TransferItemVehicle } from '@/types/transfers';

interface TransferItemVehicleCardProps {
  vehicle: TransferItemVehicle;
  onUpdate: (data: Partial<TransferItemVehicle> & { id: string }) => void;
  onDelete: (id: string) => void;
}

const DEBOUNCE_DELAY = 500;

export function TransferItemVehicleCard({ vehicle, onUpdate, onDelete }: TransferItemVehicleCardProps) {
  const [localDriverName, setLocalDriverName] = useState(vehicle.driver_name || '');
  const [localDriverPhone, setLocalDriverPhone] = useState(vehicle.driver_phone || '');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastId = useRef(vehicle.id);

  useEffect(() => {
    if (vehicle.id !== lastId.current) {
      lastId.current = vehicle.id;
      setLocalDriverName(vehicle.driver_name || '');
      setLocalDriverPhone(vehicle.driver_phone || '');
    }
  }, [vehicle.id, vehicle.driver_name, vehicle.driver_phone]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const debouncedUpdate = useCallback((field: string, value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdate({ id: vehicle.id, [field]: value || null });
    }, DEBOUNCE_DELAY);
  }, [vehicle.id, onUpdate]);

  const flushUpdates = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    // Flush current local state
    const updates: Partial<TransferItemVehicle> & { id: string } = { id: vehicle.id };
    if (localDriverName !== (vehicle.driver_name || '')) updates.driver_name = localDriverName || null;
    if (localDriverPhone !== (vehicle.driver_phone || '')) updates.driver_phone = localDriverPhone || null;
    if (Object.keys(updates).length > 1) onUpdate(updates);
  }, [vehicle, localDriverName, localDriverPhone, onUpdate]);

  const vehicleLabel = VEHICLE_TYPES.find(v => v.key === vehicle.vehicle_type)?.label || vehicle.vehicle_type;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
      <Car className="h-4 w-4 mt-2 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Vehículo</Label>
          <Select
            value={vehicle.vehicle_type}
            onValueChange={(v) => onUpdate({ id: vehicle.id, vehicle_type: v })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VEHICLE_TYPES.map((vt) => (
                <SelectItem key={vt.key} value={vt.key}>
                  {vt.label} ({vt.capacity} pax)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Conductor</Label>
          <Input
            className="h-8 text-sm"
            value={localDriverName}
            onChange={(e) => {
              setLocalDriverName(e.target.value);
              debouncedUpdate('driver_name', e.target.value);
            }}
            onBlur={flushUpdates}
            placeholder="Nombre"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Teléfono</Label>
          <Input
            className="h-8 text-sm"
            value={localDriverPhone}
            onChange={(e) => {
              setLocalDriverPhone(e.target.value);
              debouncedUpdate('driver_phone', e.target.value);
            }}
            onBlur={flushUpdates}
            placeholder="Teléfono"
          />
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0 mt-5"
        onClick={() => {
          if (confirm('¿Eliminar este vehículo adicional?')) {
            onDelete(vehicle.id);
          }
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
