import { useFormContext } from 'react-hook-form';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Truck, Package, Repeat } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  OPERATION_TYPE_OPTIONS,
  LOCATION_TYPE_OPTIONS,
  type OperationType,
} from '@/types/operations';

interface OperationFormSectionProps {
  members: { id: string; name: string | null }[];
}

export function OperationFormSection({ members }: OperationFormSectionProps) {
  const form = useFormContext();
  const operationType = form.watch('operation_type') as OperationType | undefined;
  const hasSupport = form.watch('has_support_leg');

  const showVehicleOut = operationType === 'delivery' || operationType === 'swap';
  const showVehicleIn = operationType === 'pickup' || operationType === 'swap';

  return (
    <div className="space-y-6">
      {/* Operation Type */}
      <FormField
        control={form.control}
        name="operation_type"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tipo de operación *</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {OPERATION_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      {opt.value === 'delivery' && <Truck className="h-4 w-4" />}
                      {opt.value === 'pickup' && <Package className="h-4 w-4" />}
                      {opt.value === 'swap' && <Repeat className="h-4 w-4" />}
                      {opt.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Scheduled At */}
      <FormField
        control={form.control}
        name="scheduled_at"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Fecha y hora programada</FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full pl-3 text-left font-normal',
                      !field.value && 'text-muted-foreground'
                    )}
                  >
                    {field.value ? (
                      format(new Date(field.value), 'PPP HH:mm', { locale: es })
                    ) : (
                      <span>Selecciona fecha y hora</span>
                    )}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={field.value ? new Date(field.value) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      const existing = field.value ? new Date(field.value) : new Date();
                      date.setHours(existing.getHours(), existing.getMinutes());
                      field.onChange(date.toISOString());
                    }
                  }}
                  locale={es}
                  initialFocus
                />
                <div className="p-3 border-t">
                  <Input
                    type="time"
                    value={
                      field.value
                        ? format(new Date(field.value), 'HH:mm')
                        : ''
                    }
                    onChange={(e) => {
                      const [hours, minutes] = e.target.value.split(':');
                      const date = field.value
                        ? new Date(field.value)
                        : new Date();
                      date.setHours(parseInt(hours), parseInt(minutes));
                      field.onChange(date.toISOString());
                    }}
                  />
                </div>
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Location */}
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="location_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de ubicación</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {LOCATION_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="location_text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dirección / Nombre</FormLabel>
              <FormControl>
                <Input placeholder="Hotel Marriott, Sala A..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="location_notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notas de ubicación</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Instrucciones adicionales..."
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Vehicles */}
      {(showVehicleOut || showVehicleIn) && (
        <div className="grid gap-4 md:grid-cols-2">
          {showVehicleOut && (
            <FormField
              control={form.control}
              name="vehicle_out_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Vehículo a entregar *
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="ID o matrícula" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {showVehicleIn && (
            <FormField
              control={form.control}
              name="vehicle_in_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Vehículo a recoger *
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="ID o matrícula" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
      )}

      {/* Customer Info */}
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="customer_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del cliente</FormLabel>
              <FormControl>
                <Input placeholder="Juan García" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="customer_phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Teléfono del cliente</FormLabel>
              <FormControl>
                <Input placeholder="+34 600 000 000" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="reservation_ref"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Referencia de reserva</FormLabel>
            <FormControl>
              <Input placeholder="RES-2024-001" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Primary Leg - Assignee */}
      <div className="border-t pt-4">
        <h4 className="font-medium mb-4">Operario Principal *</h4>
        <FormField
          control={form.control}
          name="primary_assignee_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Asignar a</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona operario" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name || 'Sin nombre'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Support Leg Toggle */}
      <div className="border-t pt-4">
        <FormField
          control={form.control}
          name="has_support_leg"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">
                  ¿Hace falta recoger/llevar al compañero?
                </FormLabel>
                <p className="text-sm text-muted-foreground">
                  Activa esta opción si necesitas un segundo operario
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      {/* Support Leg - Assignee */}
      {hasSupport && (
        <div className="pl-4 border-l-2 border-muted">
          <h4 className="font-medium mb-4">Operario de Apoyo</h4>
          <FormField
            control={form.control}
            name="support_assignee_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Asignar a</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona operario" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name || 'Sin nombre'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  );
}
