import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, FileText, LinkIcon, Loader2, ShieldAlert, Camera, X, ImageIcon, CheckCircle2 } from 'lucide-react';
import { useAllVehiclesForSelect } from '@/hooks/useAllVehiclesForSelect';
import { VehicleSelect } from '@/components/garatech/VehicleSelect';
import { useDamageReports } from '@/hooks/useDamageReports';
import { useAuth } from '@/contexts/AuthContext';
import { compressImage } from '@/lib/imageCompression';
import type { DamageReportFormData } from '@/types/garatech';

type Step = 1 | 2 | 3;

const STEP_TITLES: Record<Step, string> = {
  1: 'Datos del Informe',
  2: 'Fotos del Vehículo',
  3: 'Confirmar y Crear',
};

export default function DamageReportNew() {
  const navigate = useNavigate();
  const { vehicles } = useAllVehiclesForSelect();
  const { createReport, canManage, permissionsLoading } = useDamageReports();
  const { profile } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<DamageReportFormData>({
    vehicle_id: '',
    damage_date: new Date().toISOString().slice(0, 10),
    customer_name: '',
    customer_document: '',
    notes: '',
    photos_before: [],
    photos_after: [],
  });

  const [uploadingBefore, setUploadingBefore] = useState(false);
  const [uploadingAfter, setUploadingAfter] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputBeforeRef = useRef<HTMLInputElement>(null);
  const fileInputAfterRef = useRef<HTMLInputElement>(null);

  if (permissionsLoading) {
    return (
      <AppLayout title="Nuevo Informe de Daños">
        <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  if (!canManage) {
    return (
      <AppLayout title="Nuevo Informe de Daños">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acceso denegado</h2>
          <p className="text-muted-foreground mb-4">No tienes permiso para crear informes de daños</p>
          <Button variant="outline" onClick={() => navigate('/garatech/damages?tab=informes')}>Volver al listado</Button>
        </div>
      </AppLayout>
    );
  }

  // Fetch reservations for the selected vehicle
  const { data: vehicleReservations = [] } = useQuery({
    queryKey: ['vehicle-reservations-for-damage', form.vehicle_id],
    queryFn: async () => {
      if (!form.vehicle_id || !profile?.organization_id) return [];
      const vehicle = vehicles.find(v => v.id === form.vehicle_id);
      if (!vehicle) return [];

      const { data, error } = await supabase
        .from('reservations')
        .select('id, external_reservation_id, codigo, cliente_nombre, cliente_apellido, documento_cliente, desde, hasta, auto')
        .eq('organization_id', profile.organization_id)
        .eq('auto', vehicle.matricula)
        .order('desde', { ascending: false })
        .limit(20);

      if (error) return [];
      return data || [];
    },
    enabled: !!form.vehicle_id && !!profile?.organization_id,
  });

  const handleReservationSelect = (reservationId: string) => {
    const reservation = vehicleReservations.find(r => r.id === reservationId);
    if (!reservation) return;

    const vehicle = vehicles.find(v => v.id === form.vehicle_id);
    const clientName = [reservation.cliente_nombre, reservation.cliente_apellido].filter(Boolean).join(' ');

    setForm(prev => ({
      ...prev,
      reservation_id: reservationId,
      customer_name: clientName || prev.customer_name,
      customer_document: reservation.documento_cliente || prev.customer_document,
      external_reservation_number: reservation.external_reservation_id || reservation.codigo || undefined,
      contract_start_date: reservation.desde || undefined,
      contract_end_date: reservation.hasta || undefined,
      vehicle_plate: vehicle?.matricula || undefined,
      vehicle_model: vehicle?.modelo || undefined,
    }));
  };

  const handlePhotoUpload = async (
    files: FileList | null,
    type: 'before' | 'after'
  ) => {
    if (!files || files.length === 0 || !profile?.organization_id) return;

    const setUploading = type === 'before' ? setUploadingBefore : setUploadingAfter;
    setUploading(true);
    const newUrls: string[] = [];

    try {
      for (const rawFile of Array.from(files)) {
        const compressed = await compressImage(rawFile, { maxDimension: 1200, quality: 0.82 });
        const file = compressed.file;
        const ext = file.name.split('.').pop();
        const path = `${profile.organization_id}/reports/${type}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('damage-report-photos')
          .upload(path, file, { upsert: true });

        if (uploadError) {
          toast.error(`Error al subir ${rawFile.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('damage-report-photos')
          .getPublicUrl(path);

        newUrls.push(urlData.publicUrl);
      }

      if (type === 'before') {
        setForm(f => ({ ...f, photos_before: [...(f.photos_before || []), ...newUrls] }));
      } else {
        setForm(f => ({ ...f, photos_after: [...(f.photos_after || []), ...newUrls] }));
      }
    } catch (error) {
      toast.error('Error al subir fotos');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (type: 'before' | 'after', index: number) => {
    if (type === 'before') {
      setForm(f => ({ ...f, photos_before: (f.photos_before || []).filter((_, i) => i !== index) }));
    } else {
      setForm(f => ({ ...f, photos_after: (f.photos_after || []).filter((_, i) => i !== index) }));
    }
  };

  const handleSubmit = async () => {
    if (!form.vehicle_id || !form.damage_date) return;
    setSubmitting(true);
    try {
      const result = await createReport.mutateAsync(form);
      navigate(`/garatech/reports/${result.id}`);
    } catch (error) {
      toast.error('Error al crear el parte de daños');
      console.error('[DamageReportNew] Create failed:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const canProceedStep1 = !!form.vehicle_id && !!form.damage_date;

  const selectedVehicle = vehicles.find(v => v.id === form.vehicle_id);

  return (
    <AppLayout title="Nuevo Informe de Daños">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/garatech/damages?tab=informes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Nuevo Informe de Daños</h1>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 max-w-2xl">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                step === s
                  ? 'bg-primary text-primary-foreground'
                  : step > s
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
              </div>
              <span className={`text-sm hidden sm:inline ${step === s ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                {STEP_TITLES[s]}
              </span>
              {s < 3 && <div className={`flex-1 h-px ${step > s ? 'bg-primary/40' : 'bg-border'}`} />}
            </div>
          ))}
        </div>

        <div className="grid gap-6 max-w-2xl">
          {/* Step 1: Report Data */}
          {step === 1 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Datos del Informe</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Vehículo *</Label>
                    <VehicleSelect
                      value={form.vehicle_id}
                      onValueChange={(v) => setForm({ ...form, vehicle_id: v, reservation_id: undefined })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha del daño *</Label>
                    <Input type="date" value={form.damage_date} onChange={(e) => setForm({ ...form, damage_date: e.target.value })} />
                  </div>
                </div>

                {/* Reservation selector */}
                {form.vehicle_id && vehicleReservations.length > 0 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <LinkIcon className="h-3.5 w-3.5" />
                      Vincular a reserva (opcional)
                    </Label>
                    <Select value={form.reservation_id || ''} onValueChange={handleReservationSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar reserva para auto-rellenar datos..." />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicleReservations.map((r) => {
                          const label = [
                            r.external_reservation_id || r.codigo,
                            r.cliente_nombre,
                            r.desde ? `desde ${r.desde.slice(0, 10)}` : null,
                          ].filter(Boolean).join(' · ');
                          return <SelectItem key={r.id} value={r.id}>{label}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                    {form.reservation_id && (
                      <p className="text-xs text-muted-foreground">
                        Datos del cliente y contrato auto-rellenados desde la reserva
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre cliente</Label>
                    <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Documento cliente</Label>
                    <Input value={form.customer_document} onChange={(e) => setForm({ ...form, customer_document: e.target.value })} />
                  </div>
                </div>

                {/* Contract dates (auto-filled or manual) */}
                {(form.contract_start_date || form.contract_end_date || form.external_reservation_number) && (
                  <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
                    {form.external_reservation_number && (
                      <div className="space-y-1">
                        <Label className="text-xs">Nº Reserva</Label>
                        <p className="text-sm font-medium">{form.external_reservation_number}</p>
                      </div>
                    )}
                    {form.contract_start_date && (
                      <div className="space-y-1">
                        <Label className="text-xs">Inicio contrato</Label>
                        <p className="text-sm font-medium">{form.contract_start_date.slice(0, 10)}</p>
                      </div>
                    )}
                    {form.contract_end_date && (
                      <div className="space-y-1">
                        <Label className="text-xs">Fin contrato</Label>
                        <p className="text-sm font-medium">{form.contract_end_date.slice(0, 10)}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Before/After Photos */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Before Photos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Camera className="h-4 w-4 text-blue-500" />
                    Fotos ANTES del daño
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Sube fotos del estado del vehículo antes del daño (inicio del contrato, entrega al cliente, etc.)
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {(form.photos_before || []).map((url, idx) => (
                      <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border group">
                        <img src={url} alt={`Antes ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto('before', idx)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => fileInputBeforeRef.current?.click()}
                      disabled={uploadingBefore}
                      className="w-24 h-24 rounded-lg border-2 border-dashed border-blue-300 hover:border-blue-500 dark:border-blue-700 dark:hover:border-blue-500 flex flex-col items-center justify-center gap-1 transition-colors"
                    >
                      {uploadingBefore ? (
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Camera className="h-6 w-6 text-blue-500" />
                          <span className="text-[10px] text-muted-foreground">Añadir</span>
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    ref={fileInputBeforeRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(e.target.files, 'before')}
                  />
                  {(form.photos_before || []).length === 0 && (
                    <p className="text-xs text-muted-foreground mt-3 italic">
                      No hay fotos de antes. Puedes continuar sin ellas o añadirlas después.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* After Photos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Camera className="h-4 w-4 text-orange-500" />
                    Fotos DESPUÉS del daño
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Sube fotos del estado del vehículo después del daño (devolución, inspección post-daño, etc.)
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {(form.photos_after || []).map((url, idx) => (
                      <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border group">
                        <img src={url} alt={`Después ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto('after', idx)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => fileInputAfterRef.current?.click()}
                      disabled={uploadingAfter}
                      className="w-24 h-24 rounded-lg border-2 border-dashed border-orange-300 hover:border-orange-500 dark:border-orange-700 dark:hover:border-orange-500 flex flex-col items-center justify-center gap-1 transition-colors"
                    >
                      {uploadingAfter ? (
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Camera className="h-6 w-6 text-orange-500" />
                          <span className="text-[10px] text-muted-foreground">Añadir</span>
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    ref={fileInputAfterRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(e.target.files, 'after')}
                  />
                  {(form.photos_after || []).length === 0 && (
                    <p className="text-xs text-muted-foreground mt-3 italic">
                      No hay fotos de después. Puedes continuar sin ellas o añadirlas después.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Resumen del Informe</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Vehículo</p>
                    <p className="font-medium">{selectedVehicle?.matricula || '--'}</p>
                    {selectedVehicle?.modelo && <p className="text-xs text-muted-foreground">{selectedVehicle.modelo}</p>}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fecha del daño</p>
                    <p className="font-medium">{form.damage_date}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cliente</p>
                    <p className="font-medium">{form.customer_name || '--'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Documento</p>
                    <p className="font-medium">{form.customer_document || '--'}</p>
                  </div>
                </div>

                {form.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Notas</p>
                    <p className="text-sm">{form.notes}</p>
                  </div>
                )}

                {/* Photo summary */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-blue-500" />
                      <p className="text-sm font-medium">Fotos antes: {(form.photos_before || []).length}</p>
                    </div>
                    {(form.photos_before || []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(form.photos_before || []).slice(0, 4).map((url, idx) => (
                          <img key={idx} src={url} alt={`Antes ${idx + 1}`} className="w-12 h-12 rounded object-cover border" />
                        ))}
                        {(form.photos_before || []).length > 4 && (
                          <div className="w-12 h-12 rounded border flex items-center justify-center bg-muted">
                            <span className="text-xs text-muted-foreground">+{(form.photos_before || []).length - 4}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-orange-500" />
                      <p className="text-sm font-medium">Fotos después: {(form.photos_after || []).length}</p>
                    </div>
                    {(form.photos_after || []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(form.photos_after || []).slice(0, 4).map((url, idx) => (
                          <img key={idx} src={url} alt={`Después ${idx + 1}`} className="w-12 h-12 rounded object-cover border" />
                        ))}
                        {(form.photos_after || []).length > 4 && (
                          <div className="w-12 h-12 rounded border flex items-center justify-center bg-muted">
                            <span className="text-xs text-muted-foreground">+{(form.photos_after || []).length - 4}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between gap-3">
            <div>
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep((step - 1) as Step)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Anterior
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate('/garatech/damages?tab=informes')}>Cancelar</Button>
              {step < 3 ? (
                <Button
                  onClick={() => setStep((step + 1) as Step)}
                  disabled={step === 1 && !canProceedStep1}
                >
                  Siguiente
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Crear Informe
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
