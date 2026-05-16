/*
 * Azul Cars Brand — Transfer Item Form Card
 * Uses semantic CSS tokens for dark/light mode compatibility
 * isDark prop drives conditional styling
 */
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VEHICLE_TYPES } from '@/lib/transferPricing';
import {
  Trash2,
  Clock,
  Users,
  RotateCcw,
  Car,
} from 'lucide-react';

// ── Shared types & helpers ──────────────────────────────────────────

export interface TransferItemFormData {
  id: string;
  transfer_date: string;
  pickup_enabled: boolean;
  pickup_location: string;
  pickup_time: string;
  dropoff_enabled: boolean;
  dropoff_location: string;
  dropoff_time: string;
  has_return: boolean;
  return_pickup_enabled: boolean;
  return_pickup_location: string;
  return_pickup_time: string;
  return_dropoff_enabled: boolean;
  return_dropoff_location: string;
  return_dropoff_time: string;
  pax_count: string;
  vehicle_type: string;
  flight_number: string;
  notes: string;
}

export const createEmptyItem = (): TransferItemFormData => ({
  id: crypto.randomUUID(),
  transfer_date: '',
  pickup_enabled: true,
  pickup_location: '',
  pickup_time: '',
  dropoff_enabled: true,
  dropoff_location: '',
  dropoff_time: '',
  has_return: false,
  return_pickup_enabled: false,
  return_pickup_location: '',
  return_pickup_time: '',
  return_dropoff_enabled: false,
  return_dropoff_location: '',
  return_dropoff_time: '',
  pax_count: '',
  vehicle_type: 'v_class',
  flight_number: '',
  notes: '',
});

/** Convert form items to the payload shape expected by useBrokerRequests */
export function serializeItems(items: TransferItemFormData[]) {
  return items.map(item => ({
    transfer_date: item.transfer_date || null,
    pickup_enabled: item.pickup_enabled,
    pickup_location: item.pickup_location || null,
    pickup_time: item.pickup_time || null,
    dropoff_enabled: item.dropoff_enabled,
    dropoff_location: item.dropoff_location || null,
    dropoff_time: item.dropoff_time || null,
    has_return: item.has_return,
    return_pickup_enabled: item.return_pickup_enabled,
    return_pickup_location: item.return_pickup_location || null,
    return_pickup_time: item.return_pickup_time || null,
    return_dropoff_enabled: item.return_dropoff_enabled,
    return_dropoff_location: item.return_dropoff_location || null,
    return_dropoff_time: item.return_dropoff_time || null,
    pax_count: item.pax_count ? parseInt(item.pax_count) : null,
    vehicle_type: item.vehicle_type || null,
    flight_number: item.flight_number || null,
    notes: item.notes || null,
  }));
}

// ── Component ───────────────────────────────────────────────────────

interface TransferItemFormCardProps {
  item: TransferItemFormData;
  index: number;
  canRemove: boolean;
  onChange: (field: keyof TransferItemFormData, value: any) => void;
  onRemove: () => void;
  isDark: boolean;
  /** Hide the vehicle type selector (when selected globally in the wizard) */
  hideVehicleType?: boolean;
}

export function TransferItemFormCard({
  item,
  index,
  canRemove,
  onChange,
  onRemove,
  isDark,
  hideVehicleType = false,
}: TransferItemFormCardProps) {
  return (
    <div
      className="rounded-lg border overflow-hidden bg-card border-border"
      style={{
        borderLeft: '4px solid oklch(0.72 0.10 80)',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between border-b border-border bg-muted/50"
      >
        <span
          className="text-foreground"
          style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '14px' }}
        >
          Trayecto {index + 1}
        </span>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Date, Pax & Vehicle */}
        <div className={`grid gap-4 ${hideVehicleType ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
          <div>
            <Label className="flex items-center gap-1.5 text-foreground">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              Fecha
            </Label>
            <Input
              type="date"
              value={item.transfer_date}
              onChange={(e) => onChange('transfer_date', e.target.value)}
              className="mt-1.5 bg-background border-input text-foreground"
            />
          </div>
          <div>
            <Label className="flex items-center gap-1.5 text-foreground">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              Pasajeros
            </Label>
            <Input
              type="number"
              min="1"
              value={item.pax_count}
              onChange={(e) => onChange('pax_count', e.target.value)}
              placeholder="Nº de pax"
              className="mt-1.5 bg-background border-input text-foreground"
            />
          </div>
          {!hideVehicleType && (
            <div>
              <Label className="flex items-center gap-1.5 text-foreground">
                <Car className="h-3.5 w-3.5 text-muted-foreground" />
                Tipo de vehículo
              </Label>
              <Select
                value={item.vehicle_type}
                onValueChange={(value) => onChange('vehicle_type', value)}
              >
                <SelectTrigger className="mt-1.5 bg-background border-input text-foreground">
                  <SelectValue placeholder="Seleccionar vehículo" />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((vehicle) => (
                    <SelectItem key={vehicle.key} value={vehicle.key}>
                      {vehicle.label} ({vehicle.capacity} pax)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Pickup */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`pickup-${item.id}`}
              checked={item.pickup_enabled}
              onCheckedChange={(checked) => onChange('pickup_enabled', checked)}
            />
            <Label htmlFor={`pickup-${item.id}`} className="font-medium cursor-pointer text-foreground">
              Recogida
            </Label>
          </div>

          {item.pickup_enabled && (
            <div className="grid gap-3 sm:grid-cols-2 pl-6">
              <div>
                <Label className="text-xs text-muted-foreground">Ubicación</Label>
                <Input
                  value={item.pickup_location}
                  onChange={(e) => onChange('pickup_location', e.target.value)}
                  placeholder="Ej: Puerto de Palma"
                  className="mt-1 bg-background border-input text-foreground"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Hora</Label>
                <Input
                  type="time"
                  value={item.pickup_time}
                  onChange={(e) => onChange('pickup_time', e.target.value)}
                  className="mt-1 bg-background border-input text-foreground"
                />
              </div>
            </div>
          )}
        </div>

        {/* Dropoff */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`dropoff-${item.id}`}
              checked={item.dropoff_enabled}
              onCheckedChange={(checked) => onChange('dropoff_enabled', checked)}
            />
            <Label htmlFor={`dropoff-${item.id}`} className="font-medium cursor-pointer text-foreground">
              Llegada / Destino
            </Label>
          </div>

          {item.dropoff_enabled && (
            <div className="grid gap-3 sm:grid-cols-2 pl-6">
              <div>
                <Label className="text-xs text-muted-foreground">Ubicación</Label>
                <Input
                  value={item.dropoff_location}
                  onChange={(e) => onChange('dropoff_location', e.target.value)}
                  placeholder="Ej: Aeropuerto PMI"
                  className="mt-1 bg-background border-input text-foreground"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Hora</Label>
                <Input
                  type="time"
                  value={item.dropoff_time}
                  onChange={(e) => onChange('dropoff_time', e.target.value)}
                  className="mt-1 bg-background border-input text-foreground"
                />
              </div>
            </div>
          )}
        </div>

        {/* Return Trip */}
        <div className="space-y-2">
          <div
            className="pt-3 mt-1 border-t border-border"
          >
            <div className="flex items-center gap-2">
              <Checkbox
                id={`return-${item.id}`}
                checked={item.has_return}
                onCheckedChange={(checked) => {
                  onChange('has_return', !!checked);
                  if (checked) {
                    onChange('return_pickup_enabled', true);
                    onChange('return_dropoff_enabled', true);
                  }
                }}
              />
              <Label
                htmlFor={`return-${item.id}`}
                className="font-medium cursor-pointer flex items-center gap-1.5 text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                Viaje de vuelta
              </Label>
            </div>
          </div>

          {item.has_return && (
            <div className="pl-6 space-y-3">
              {/* Return Pickup */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`return-pickup-${item.id}`}
                    checked={item.return_pickup_enabled}
                    onCheckedChange={(checked) => onChange('return_pickup_enabled', !!checked)}
                  />
                  <Label htmlFor={`return-pickup-${item.id}`} className="text-sm cursor-pointer text-foreground">
                    Recogida (vuelta)
                  </Label>
                </div>
                {item.return_pickup_enabled && (
                  <div className="grid gap-3 sm:grid-cols-2 pl-6">
                    <div>
                      <Label className="text-xs text-muted-foreground">Ubicación</Label>
                      <Input
                        value={item.return_pickup_location}
                        onChange={(e) => onChange('return_pickup_location', e.target.value)}
                        placeholder="Ej: Hotel Son Vida"
                        className="mt-1 bg-background border-input text-foreground"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Hora</Label>
                      <Input
                        type="time"
                        value={item.return_pickup_time}
                        onChange={(e) => onChange('return_pickup_time', e.target.value)}
                        className="mt-1 bg-background border-input text-foreground"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Return Dropoff */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`return-dropoff-${item.id}`}
                    checked={item.return_dropoff_enabled}
                    onCheckedChange={(checked) => onChange('return_dropoff_enabled', !!checked)}
                  />
                  <Label htmlFor={`return-dropoff-${item.id}`} className="text-sm cursor-pointer text-foreground">
                    Destino (vuelta)
                  </Label>
                </div>
                {item.return_dropoff_enabled && (
                  <div className="grid gap-3 sm:grid-cols-2 pl-6">
                    <div>
                      <Label className="text-xs text-muted-foreground">Ubicación</Label>
                      <Input
                        value={item.return_dropoff_location}
                        onChange={(e) => onChange('return_dropoff_location', e.target.value)}
                        placeholder="Ej: Puerto de Palma"
                        className="mt-1 bg-background border-input text-foreground"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Hora</Label>
                      <Input
                        type="time"
                        value={item.return_dropoff_time}
                        onChange={(e) => onChange('return_dropoff_time', e.target.value)}
                        className="mt-1 bg-background border-input text-foreground"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Flight / Ferry Number */}
        <div>
          <Label className="flex items-center gap-1.5 text-sm text-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>
            Nº Vuelo / Ferry (opcional)
          </Label>
          <Input
            value={item.flight_number}
            onChange={(e) => onChange('flight_number', e.target.value.toUpperCase())}
            placeholder="Ej: FR1234, VY3456, Balearia 09:00"
            className="mt-1.5 bg-background border-input text-foreground"
          />
        </div>

        {/* Notes */}
        <div>
          <Label className="text-sm text-foreground">Notas del trayecto</Label>
          <Textarea
            value={item.notes}
            onChange={(e) => onChange('notes', e.target.value)}
            placeholder="Instrucciones especiales para este trayecto..."
            className="mt-1.5 bg-background border-input text-foreground"
            rows={2}
          />
        </div>
      </div>
    </div>
  );
}
