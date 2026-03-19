import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Camera, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { VehicleCroquis } from './VehicleCroquis';
import { FLEET_DAMAGE_PIECES, DAMAGE_ZONES } from '@/types/fleet';
import type { FleetDamageOrigin } from '@/types/fleet';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AddDamageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fleetVehicleId: string;
  organizationId: string;
  onSubmit: (damage: any) => Promise<void>;
  vehiclePlate?: string;
}

interface ReservationOption {
  id: string;
  external_reservation_id: string | null;
  cliente_nombre: string | null;
  cliente_apellido: string | null;
  desde: string | null;
  hasta: string | null;
}

export function AddDamageDialog({ open, onOpenChange, fleetVehicleId, organizationId, onSubmit, vehiclePlate }: AddDamageDialogProps) {
  const { profile } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    zona: '',
    pieza: '',
    descripcion: '',
    severidad: 'leve',
    origin_type: 'reserva' as FleetDamageOrigin,
    reservation_id: '',
    has_premium_coverage: false,
    croquis_x: null as number | null,
    croquis_y: null as number | null,
    photo_url: '',
  });

  // Reservation search state
  const [reservationSearch, setReservationSearch] = useState('');
  const [reservations, setReservations] = useState<ReservationOption[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);

  // Load reservations when step 3 is reached and origin is reserva
  useEffect(() => {
    if (step !== 3 || form.origin_type !== 'reserva') return;

    const fetchReservations = async () => {
      setLoadingReservations(true);
      try {
        let query = supabase
          .from('reservations')
          .select('id, external_reservation_id, cliente_nombre, cliente_apellido, desde, hasta, auto')
          .eq('organization_id', organizationId)
          .order('desde', { ascending: false })
          .limit(50);

        if (vehiclePlate) {
          query = query.eq('auto', vehiclePlate);
        }

        const { data, error } = await query;
        if (error) throw error;
        setReservations((data as ReservationOption[]) ?? []);
      } catch {
        setReservations([]);
      } finally {
        setLoadingReservations(false);
      }
    };

    fetchReservations();
  }, [step, form.origin_type, organizationId, vehiclePlate]);

  const filteredReservations = reservations.filter(r => {
    if (!reservationSearch) return true;
    const search = reservationSearch.toLowerCase();
    return (
      r.external_reservation_id?.toLowerCase().includes(search) ||
      r.cliente_nombre?.toLowerCase().includes(search) ||
      r.cliente_apellido?.toLowerCase().includes(search)
    );
  });

  const selectedReservation = reservations.find(r => r.id === form.reservation_id);

  const resetForm = () => {
    setForm({
      zona: '', pieza: '', descripcion: '', severidad: 'leve',
      origin_type: 'reserva', reservation_id: '', has_premium_coverage: false,
      croquis_x: null, croquis_y: null, photo_url: '',
    });
    setReservationSearch('');
    setStep(1);
  };

  const handleZoneClick = (x: number, y: number, zona: string) => {
    setForm(f => ({ ...f, croquis_x: Math.round(x * 10) / 10, croquis_y: Math.round(y * 10) / 10, zona }));
    setStep(2);
  };

  const availablePieces = FLEET_DAMAGE_PIECES.find(z => z.zona === form.zona)?.piezas || [];

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${organizationId}/${fleetVehicleId}/damages/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('fleet-vehicle-photos').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('fleet-vehicle-photos').getPublicUrl(path);
      setForm(f => ({ ...f, photo_url: publicUrl }));
    } catch (err: any) {
      toast.error(err.message || 'Error al subir la foto');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.zona) { toast.error('Selecciona una zona en el croquis'); return; }
    setSubmitting(true);
    try {
      await onSubmit({
        fleet_vehicle_id: fleetVehicleId,
        organization_id: organizationId,
        zona: form.zona,
        pieza: form.pieza || null,
        descripcion: form.descripcion || null,
        severidad: form.severidad,
        photo_url: form.photo_url || null,
        origin_type: form.origin_type,
        reservation_id: form.reservation_id || null,
        has_premium_coverage: form.origin_type === 'reserva' ? form.has_premium_coverage : false,
        status: 'pendiente',
        croquis_x: form.croquis_x,
        croquis_y: form.croquis_y,
        reported_by: profile?.id || null,
        repair_id: null,
        damage_report_id: null,
      });
      resetForm();
      onOpenChange(false);
    } catch {
      // handled in hook
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Daño</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Toca en el croquis la zona donde está el daño
            </p>
            <VehicleCroquis
              damages={[]}
              interactive
              onZoneClick={handleZoneClick}
            />
            <div className="grid grid-cols-2 gap-2">
              {DAMAGE_ZONES.map(z => (
                <Button
                  key={z.key}
                  variant={form.zona === z.key ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-xl text-xs"
                  onClick={() => { setForm(f => ({ ...f, zona: z.key })); setStep(2); }}
                >
                  {z.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="text-sm font-medium text-center capitalize">
              Zona: {DAMAGE_ZONES.find(z => z.key === form.zona)?.label || form.zona}
            </div>

            {/* Pieza */}
            {availablePieces.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Pieza (opcional)</Label>
                <Select value={form.pieza} onValueChange={v => setForm(f => ({ ...f, pieza: v }))}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Seleccionar pieza" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePieces.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Severidad */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Severidad</Label>
              <Select value={form.severidad} onValueChange={v => setForm(f => ({ ...f, severidad: v }))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leve">Leve</SelectItem>
                  <SelectItem value="moderado">Moderado</SelectItem>
                  <SelectItem value="grave">Grave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Photo */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Foto del daño</Label>
              {form.photo_url ? (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={form.photo_url} alt="Daño" className="w-full h-32 object-cover" />
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute bottom-2 right-2 rounded-lg text-xs"
                    onClick={() => setForm(f => ({ ...f, photo_url: '' }))}
                  >
                    Cambiar
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 h-20 rounded-xl border-2 border-dashed border-border cursor-pointer hover:bg-muted/30 transition-colors">
                  <Camera className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {uploading ? 'Subiendo...' : 'Capturar foto'}
                  </span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} disabled={uploading} />
                </label>
              )}
            </div>

            {/* Descripcion */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Descripción (opcional)</Label>
              <Textarea
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Describe el daño..."
                className="rounded-xl resize-none min-h-[60px]"
              />
            </div>

            <Button className="w-full rounded-2xl h-11" onClick={() => setStep(3)}>
              Continuar
            </Button>
            <Button variant="ghost" className="w-full rounded-2xl" onClick={() => setStep(1)}>
              ← Volver al croquis
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-center">¿Cuándo ocurrió este daño?</p>

            {/* Origin type */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={form.origin_type === 'reserva' ? 'default' : 'outline'}
                className="rounded-xl h-12"
                onClick={() => setForm(f => ({ ...f, origin_type: 'reserva' }))}
              >
                Durante reserva
              </Button>
              <Button
                variant={form.origin_type === 'movimiento_empleado' ? 'default' : 'outline'}
                className="rounded-xl h-12"
                onClick={() => setForm(f => ({ ...f, origin_type: 'movimiento_empleado', has_premium_coverage: false, reservation_id: '' }))}
              >
                Movimiento empleado
              </Button>
            </div>

            {/* Reservation selector */}
            {form.origin_type === 'reserva' && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Vincular reserva (API sincronizada)</Label>
                
                {selectedReservation ? (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Nº {selectedReservation.external_reservation_id || '—'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setForm(f => ({ ...f, reservation_id: '' }))}
                      >
                        Cambiar
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[selectedReservation.cliente_nombre, selectedReservation.cliente_apellido].filter(Boolean).join(' ')}
                    </div>
                    {selectedReservation.desde && (
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(selectedReservation.desde), 'dd MMM yyyy', { locale: es })}
                        {selectedReservation.hasta && ` — ${format(new Date(selectedReservation.hasta), 'dd MMM yyyy', { locale: es })}`}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={reservationSearch}
                        onChange={e => setReservationSearch(e.target.value)}
                        placeholder="Buscar por nº reserva o cliente..."
                        className="rounded-xl pl-9"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-border divide-y divide-border/50">
                      {loadingReservations ? (
                        <div className="text-xs text-muted-foreground text-center py-4">Cargando reservas...</div>
                      ) : filteredReservations.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-4">No se encontraron reservas</div>
                      ) : (
                        filteredReservations.map(r => (
                          <button
                            key={r.id}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                            onClick={() => setForm(f => ({ ...f, reservation_id: r.id }))}
                          >
                            <div className="text-sm font-medium">Nº {r.external_reservation_id || '—'}</div>
                            <div className="text-xs text-muted-foreground">
                              {[r.cliente_nombre, r.cliente_apellido].filter(Boolean).join(' ')}
                              {r.desde && ` · ${format(new Date(r.desde), 'dd MMM', { locale: es })}`}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Premium coverage */}
            {form.origin_type === 'reserva' && (
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-muted/30 border border-border/50">
                <Label className="text-sm">¿Cubierto por Premium?</Label>
                <Switch
                  checked={form.has_premium_coverage}
                  onCheckedChange={v => setForm(f => ({ ...f, has_premium_coverage: v }))}
                />
              </div>
            )}

            {form.origin_type === 'reserva' && !form.has_premium_coverage && (
              <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-xl px-3 py-2">
                ⚠️ Al guardar, podrás generar un informe de cobro para el cliente.
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 rounded-2xl h-11" onClick={() => setStep(2)}>
                Atrás
              </Button>
              <Button className="flex-1 rounded-2xl h-11" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Guardando...' : 'Registrar Daño'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
