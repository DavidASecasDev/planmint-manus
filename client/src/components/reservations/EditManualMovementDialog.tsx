import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Pencil } from 'lucide-react';
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
import { toast } from 'sonner';
import { Reservation } from '@/types/reservations';

type TipoOperacion = 'Entrega' | 'Devolución' | 'Transfer';

interface EditManualMovementDialogProps {
  reservation: Reservation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditManualMovementDialog({ reservation, open, onOpenChange }: EditManualMovementDialogProps) {
  const { updateReservation } = useReservations();

  // Determine the current tipo based on reservation data
  const getCurrentTipo = (): TipoOperacion => {
    if (reservation.tipo_actividad === 'Transfer') return 'Transfer';
    if (reservation.tipo_actividad === 'Devolución') return 'Devolución';
    return 'Entrega';
  };

  // Extract date and time from the reservation
  const getDateAndTime = () => {
    // For Entrega/Transfer, the date is in 'desde'; for Devolución, in 'hasta'
    const tipo = getCurrentTipo();
    const dateStr = tipo === 'Devolución' ? reservation.hasta : reservation.desde;
    if (!dateStr) return { date: undefined as Date | undefined, time: '10:00' };
    
    try {
      const parsed = parseISO(dateStr);
      return {
        date: parsed,
        time: format(parsed, 'HH:mm'),
      };
    } catch {
      return { date: undefined as Date | undefined, time: '10:00' };
    }
  };

  const getLugar = (): string => {
    const tipo = getCurrentTipo();
    if (tipo === 'Devolución') return reservation.lugar_devolucion || '';
    return reservation.lugar_entrega || '';
  };

  // Form state
  const [tipoOperacion, setTipoOperacion] = useState<TipoOperacion>(getCurrentTipo());
  const [fecha, setFecha] = useState<Date | undefined>(getDateAndTime().date);
  const [hora, setHora] = useState(getDateAndTime().time);
  const [clienteNombre, setClienteNombre] = useState(reservation.cliente_nombre || '');
  const [clienteApellido, setClienteApellido] = useState(reservation.cliente_apellido || '');
  const [telefono, setTelefono] = useState(reservation.telefono || '');
  const [email, setEmail] = useState(reservation.email || '');
  const [modelo, setModelo] = useState(reservation.modelo || '');
  const [auto, setAuto] = useState(reservation.auto || '');
  const [lugar, setLugar] = useState(getLugar());
  const [notas, setNotas] = useState(reservation.notas || '');

  // Reset form when reservation changes
  useEffect(() => {
    if (open) {
      const { date, time } = getDateAndTime();
      setTipoOperacion(getCurrentTipo());
      setFecha(date);
      setHora(time);
      setClienteNombre(reservation.cliente_nombre || '');
      setClienteApellido(reservation.cliente_apellido || '');
      setTelefono(reservation.telefono || '');
      setEmail(reservation.email || '');
      setModelo(reservation.modelo || '');
      setAuto(reservation.auto || '');
      setLugar(getLugar());
      setNotas(reservation.notas || '');
    }
  }, [open, reservation.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fecha) {
      toast.error('Selecciona una fecha');
      return;
    }

    // Build ISO string preserving local time (no UTC conversion)
    const [hours, minutes] = hora.split(':').map(Number);
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    const h = String(hours).padStart(2, '0');
    const m = String(minutes).padStart(2, '0');
    const fechaISO = `${year}-${month}-${day}T${h}:${m}:00+00:00`;

    // Build the update data based on tipo
    const updateData: Record<string, unknown> = {
      tipo_actividad: tipoOperacion,
      cliente_nombre: clienteNombre || null,
      cliente_apellido: clienteApellido || null,
      telefono: telefono || null,
      email: email || null,
      modelo: modelo || null,
      auto: auto || null,
      notas: notas || null,
    };

    // Set date fields based on tipo
    if (tipoOperacion === 'Entrega' || tipoOperacion === 'Transfer') {
      updateData.desde = fechaISO;
      updateData.hasta = null;
      updateData.lugar_entrega = lugar || null;
      updateData.lugar_devolucion = null;
    } else {
      // Devolución
      updateData.hasta = fechaISO;
      updateData.desde = null;
      updateData.lugar_entrega = null;
      updateData.lugar_devolucion = lugar || null;
    }

    updateReservation.mutate(
      { id: reservation.id, data: updateData as any },
      {
        onSuccess: () => {
          toast.success('Movimiento actualizado correctamente');
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : 'Error al actualizar');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Editar movimiento manual
          </DialogTitle>
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

          {/* Vehículo */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Matrícula</Label>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateReservation.isPending}>
              {updateReservation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
