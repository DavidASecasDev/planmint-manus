import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Plus, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useReservations } from '@/hooks/useReservations';
import { apiInvoke } from '@/lib/apiClient';
import { toast } from 'sonner';

type TipoOperacion = 'Entrega' | 'Devolución' | 'Transfer';

export function AddReservationDialog() {
  const { createReservation } = useReservations();
  const [open, setOpen] = useState(false);
  
  // Form state
  const [tipoOperacion, setTipoOperacion] = useState<TipoOperacion>('Entrega');
  const [fecha, setFecha] = useState<Date | undefined>(undefined);
  const [hora, setHora] = useState('10:00');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteApellido, setClienteApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [modelo, setModelo] = useState('');
  const [auto, setAuto] = useState('');
  const [lugar, setLugar] = useState('');
  const [notas, setNotas] = useState('');
  const [tiempoTrayecto, setTiempoTrayecto] = useState<string>('');

  const resetForm = () => {
    setTipoOperacion('Entrega');
    setFecha(undefined);
    setHora('10:00');
    setClienteNombre('');
    setClienteApellido('');
    setTelefono('');
    setEmail('');
    setModelo('');
    setAuto('');
    setLugar('');
    setNotas('');
    setTiempoTrayecto('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fecha) {
      toast.error('Selecciona una fecha');
      return;
    }

    // Construir ISO string manual para preservar la hora local (sin conversión UTC)
    const [hours, minutes] = hora.split(':').map(Number);
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    const h = String(hours).padStart(2, '0');
    const m = String(minutes).padStart(2, '0');
    const fechaISO = `${year}-${month}-${day}T${h}:${m}:00+00:00`;

    // Generar ID único para reserva manual
    const manualId = `MANUAL-${Date.now()}`;

    // Parse travel time for Transfer
    const travelMinutes = tipoOperacion === 'Transfer' && tiempoTrayecto
      ? parseInt(tiempoTrayecto, 10)
      : null;

    // Determine the lugar value — for Transfers with manual travel time,
    // ensure lugar is set so staffCapacity can look it up in travel_time_cache
    const lugarValue = lugar || undefined;

    createReservation.mutate({
      external_reservation_id: manualId,
      tipo_actividad: tipoOperacion,
      cliente_nombre: clienteNombre || undefined,
      cliente_apellido: clienteApellido || undefined,
      telefono: telefono || undefined,
      email: email || undefined,
      modelo: modelo || undefined,
      auto: auto || undefined,
      desde: tipoOperacion === 'Entrega' || tipoOperacion === 'Transfer' ? fechaISO : undefined,
      hasta: tipoOperacion === 'Devolución' ? fechaISO : undefined,
      lugar_entrega: tipoOperacion === 'Entrega' || tipoOperacion === 'Transfer' ? lugarValue : undefined,
      lugar_devolucion: tipoOperacion === 'Devolución' ? lugarValue : undefined,
      notas: notas || undefined,
      origen_reserva: 'Manual',
    }, {
      onSuccess: async () => {
        // If Transfer with manual travel time, save it to travel_time_cache
        if (tipoOperacion === 'Transfer' && travelMinutes && travelMinutes > 0 && lugarValue) {
          try {
            await apiInvoke('travel-time-overrides/upsert', {
              body: {
                destination: lugarValue,
                travelMinutes: travelMinutes,
              },
            });
            // Trigger capacity refresh so the travel time appears immediately
            window.dispatchEvent(new Event('capacity-refresh-needed'));
          } catch (err) {
            console.error('[AddReservationDialog] Error saving travel time override:', err);
            // Don't block the success flow — reservation was created successfully
            toast.warning('Reserva creada, pero no se pudo guardar el tiempo de trayecto');
          }
        }
        toast.success('Reserva creada correctamente');
        resetForm();
        setOpen(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          Añadir manual
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva reserva manual</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo de operación */}
          <div className="space-y-2">
            <Label>Tipo de operación *</Label>
            <Select value={tipoOperacion} onValueChange={(v) => setTipoOperacion(v as TipoOperacion)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Entrega">Entrega</SelectItem>
                <SelectItem value="Devolución">Devolución</SelectItem>
                <SelectItem value="Transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fecha y hora */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Fecha *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !fecha && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fecha ? format(fecha, "dd/MM/yyyy") : "Seleccionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fecha}
                    onSelect={setFecha}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Hora</Label>
              <Input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
              />
            </div>
          </div>

          {/* Cliente */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                placeholder="Nombre"
              />
            </div>
            <div className="space-y-2">
              <Label>Apellido</Label>
              <Input
                value={clienteApellido}
                onChange={(e) => setClienteApellido(e.target.value)}
                placeholder="Apellido"
              />
            </div>
          </div>

          {/* Contacto */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+34..."
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@ejemplo.com"
              />
            </div>
          </div>

          {/* Vehículo - Matrícula primero para evitar confusión */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Matrícula *</Label>
              <Input
                value={auto}
                onChange={(e) => setAuto(e.target.value.toUpperCase().trim())}
                placeholder="ej. 1234ABC"
              />
            </div>
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Input
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                placeholder="ej. Mercedes GLA"
              />
            </div>
          </div>

          {/* Lugar */}
          <div className="space-y-2">
            <Label>Lugar</Label>
            <Input
              value={lugar}
              onChange={(e) => setLugar(e.target.value)}
              placeholder="Lugar de la operación"
            />
          </div>

          {/* Tiempo de trayecto — solo para Transfer */}
          {tipoOperacion === 'Transfer' && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Tiempo de trayecto (min)
              </Label>
              <Input
                type="number"
                min="0"
                max="300"
                value={tiempoTrayecto}
                onChange={(e) => setTiempoTrayecto(e.target.value)}
                placeholder="ej. 15"
              />
              <p className="text-xs text-muted-foreground">
                Tiempo estimado de ida en minutos. Se mostrará en la columna de desplazamiento.
              </p>
            </div>
          )}

          {/* Notas */}
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas adicionales..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createReservation.isPending}>
              {createReservation.isPending ? 'Creando...' : 'Crear reserva'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
