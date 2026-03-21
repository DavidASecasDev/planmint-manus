import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useFleetVehicle, useFleetVehicles } from '@/hooks/useFleetVehicles';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Camera, Car, Loader2, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { FLEET_STATUS_OPTIONS } from '@/types/fleet';
import type { FleetVehicleStatus } from '@/types/fleet';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
        {title}
      </h3>
      <div className="rounded-2xl bg-card border border-border/50 shadow-sm divide-y divide-border/50">
        {children}
      </div>
    </div>
  );
}

function FormRow({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <Label htmlFor={htmlFor} className="text-sm text-muted-foreground w-28 shrink-0">
        {label}
      </Label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export default function FleetEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: vehicle, isLoading: vehicleLoading } = useFleetVehicle(id);
  const { updateVehicle, deleteVehicle } = useFleetVehicles();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const [form, setForm] = useState({
    matricula: '',
    modelo: '',
    categoria: '',
    proveedor: '',
    numero_contrato: '',
    numero_bastidor: '',
    fecha_inicio_contrato: '',
    fecha_fin_contrato: '',
    km_recogida: '',
    km_devolucion: '',
    status: 'activo' as FleetVehicleStatus,
    notas: '',
    marca: '',
    color: '',
    combustible: '',
    hibrido: false,
    motor: '',
    cv: '',
  });

  useEffect(() => {
    if (vehicle) {
      setForm({
        matricula: vehicle.matricula || '',
        modelo: vehicle.modelo || '',
        categoria: vehicle.categoria || '',
        proveedor: vehicle.proveedor || '',
        numero_contrato: vehicle.numero_contrato || '',
        numero_bastidor: vehicle.numero_bastidor || '',
        fecha_inicio_contrato: vehicle.fecha_inicio_contrato || '',
        fecha_fin_contrato: vehicle.fecha_fin_contrato || '',
        km_recogida: vehicle.km_recogida != null ? String(vehicle.km_recogida) : '',
        km_devolucion: vehicle.km_devolucion != null ? String(vehicle.km_devolucion) : '',
        status: vehicle.status as FleetVehicleStatus,
        notas: vehicle.notas || '',
        marca: vehicle.marca || '',
        color: vehicle.color || '',
        combustible: vehicle.combustible || '',
        hibrido: vehicle.hibrido ?? false,
        motor: vehicle.motor || '',
        cv: vehicle.cv != null ? String(vehicle.cv) : '',
      });
      setPhotoUrl((vehicle as any).photo_url || null);
    }
  }, [vehicle]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile || !id) return;

    setUploading(true);
    try {
      const compressed = await compressImage(rawFile, { maxDimension: 1200, quality: 0.82 });
      const file = compressed.file;
      const ext = file.name.split('.').pop();
      const path = `${profile?.organization_id}/${id}/profile.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('fleet-vehicle-photos')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('fleet-vehicle-photos')
        .getPublicUrl(path);

      // Add cache buster
      const url = `${publicUrl}?t=${Date.now()}`;
      setPhotoUrl(url);

      // Save to DB immediately
      await updateVehicle.mutateAsync({ id, photo_url: url } as any);
      toast.success('Foto actualizada');
    } catch (err: any) {
      toast.error(err.message || 'Error al subir la foto');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    await updateVehicle.mutateAsync({
      id,
      matricula: form.matricula,
      modelo: form.modelo || null,
      categoria: form.categoria || null,
      proveedor: form.proveedor || null,
      numero_contrato: form.numero_contrato || null,
      numero_bastidor: form.numero_bastidor || null,
      fecha_inicio_contrato: form.fecha_inicio_contrato || null,
      fecha_fin_contrato: form.fecha_fin_contrato || null,
      km_recogida: form.km_recogida ? parseInt(form.km_recogida) : null,
      km_devolucion: form.km_devolucion ? parseInt(form.km_devolucion) : null,
      status: form.status,
      notas: form.notas || null,
      marca: form.marca || null,
      color: form.color || null,
      combustible: form.combustible || null,
      hibrido: form.hibrido,
      motor: form.motor || null,
      cv: form.cv ? parseInt(form.cv) : null,
    } as any);
    navigate(`/fleet/${id}`);
  };

  if (vehicleLoading) {
    return (
      <AppLayout title="Editar Vehículo">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!vehicle) {
    return (
      <AppLayout title="Vehículo no encontrado">
        <div className="text-center py-16">
          <p className="text-muted-foreground">El vehículo no existe.</p>
          <Button variant="outline" onClick={() => navigate('/fleet')} className="mt-4 rounded-xl">Volver</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Editar Vehículo">
      <div className="max-w-2xl mx-auto pb-8">
        <Button variant="ghost" onClick={() => navigate(`/fleet/${id}`)} className="mb-4 rounded-xl -ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {vehicle.matricula}
        </Button>

        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          {/* Photo Avatar */}
          <div className="flex flex-col items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative group"
              disabled={uploading}
            >
              <Avatar className="h-24 w-24 border-2 border-border">
                {photoUrl ? (
                  <AvatarImage src={photoUrl} alt={vehicle.matricula} />
                ) : null}
                <AvatarFallback className="bg-muted/60">
                  <Car className="h-10 w-10 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </div>
            </button>
            <p className="text-xs text-muted-foreground mt-2">Toca para cambiar la foto</p>
          </div>

          <FormSection title="Identificación">
            <FormRow label="Matrícula *" htmlFor="matricula">
              <Input
                id="matricula"
                required
                value={form.matricula}
                onChange={e => setForm(f => ({ ...f, matricula: e.target.value }))}
                className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0 font-mono tracking-wider"
              />
            </FormRow>
            <FormRow label="Modelo" htmlFor="modelo">
              <Input
                id="modelo"
                value={form.modelo}
                onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))}
                className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
              />
            </FormRow>
            <FormRow label="Grupo">
              <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                <SelectTrigger className="border-0 bg-transparent p-0 h-auto focus:ring-0 shadow-none">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {['1', '2', '3', '4', '5'].map(n => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormRow>
            <FormRow label="Nº Bastidor" htmlFor="vin">
              <Input
                id="vin"
                value={form.numero_bastidor}
                onChange={e => setForm(f => ({ ...f, numero_bastidor: e.target.value }))}
                placeholder="WDB1234567F123456"
                className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0 font-mono text-xs tracking-wider"
              />
            </FormRow>
            <FormRow label="Estado">
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as FleetVehicleStatus }))}>
                <SelectTrigger className="border-0 bg-transparent p-0 h-auto focus:ring-0 shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FLEET_STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormRow>
          </FormSection>

          <FormSection title="Contrato">
            <FormRow label="Proveedor" htmlFor="proveedor">
              <Input
                id="proveedor"
                value={form.proveedor}
                onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))}
                className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
              />
            </FormRow>
            <FormRow label="Nº Contrato" htmlFor="contrato">
              <Input
                id="contrato"
                value={form.numero_contrato}
                onChange={e => setForm(f => ({ ...f, numero_contrato: e.target.value }))}
                className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
              />
            </FormRow>
            <FormRow label="Inicio" htmlFor="fecha_inicio">
              <Input
                id="fecha_inicio"
                type="date"
                value={form.fecha_inicio_contrato}
                onChange={e => setForm(f => ({ ...f, fecha_inicio_contrato: e.target.value }))}
                className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
              />
            </FormRow>
            <FormRow label="Fin" htmlFor="fecha_fin">
              <Input
                id="fecha_fin"
                type="date"
                value={form.fecha_fin_contrato}
                onChange={e => setForm(f => ({ ...f, fecha_fin_contrato: e.target.value }))}
                className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
              />
            </FormRow>
          </FormSection>

          <FormSection title="Detalles Vehículo">
            <FormRow label="Marca" htmlFor="marca">
              <Input
                id="marca"
                value={form.marca}
                onChange={e => setForm(f => ({ ...f, marca: e.target.value }))}
                placeholder="Mercedes-Benz"
                className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
              />
            </FormRow>
            <FormRow label="Color" htmlFor="color">
              <Input
                id="color"
                value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                placeholder="Blanco"
                className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
              />
            </FormRow>
            <FormRow label="Combustible">
              <Select value={form.combustible} onValueChange={v => setForm(f => ({ ...f, combustible: v }))}>
                <SelectTrigger className="border-0 bg-transparent p-0 h-auto focus:ring-0 shadow-none">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gasolina">Gasolina</SelectItem>
                  <SelectItem value="Diésel">Diésel</SelectItem>
                  <SelectItem value="Híbrido">Híbrido</SelectItem>
                  <SelectItem value="Eléctrico">Eléctrico</SelectItem>
                </SelectContent>
              </Select>
            </FormRow>
            <FormRow label="Híbrido">
              <Switch
                checked={form.hibrido}
                onCheckedChange={v => setForm(f => ({ ...f, hibrido: v }))}
              />
            </FormRow>
            <FormRow label="Motor" htmlFor="motor">
              <Input
                id="motor"
                value={form.motor}
                onChange={e => setForm(f => ({ ...f, motor: e.target.value }))}
                placeholder="2.0 TDI"
                className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
              />
            </FormRow>
            <FormRow label="CV" htmlFor="cv">
              <Input
                id="cv"
                type="number"
                value={form.cv}
                onChange={e => setForm(f => ({ ...f, cv: e.target.value }))}
                placeholder="150"
                className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
              />
            </FormRow>
          </FormSection>

          <FormSection title="Kilómetros">
            <FormRow label="Km Recogida" htmlFor="km_recogida">
              <Input
                id="km_recogida"
                type="number"
                value={form.km_recogida}
                onChange={e => setForm(f => ({ ...f, km_recogida: e.target.value }))}
                className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
              />
            </FormRow>
            <FormRow label="Km Devolución" htmlFor="km_devolucion">
              <Input
                id="km_devolucion"
                type="number"
                value={form.km_devolucion}
                onChange={e => setForm(f => ({ ...f, km_devolucion: e.target.value }))}
                className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
              />
            </FormRow>
          </FormSection>

          <FormSection title="Notas">
            <div className="p-4">
              <Textarea
                value={form.notas}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Observaciones adicionales..."
                className="border-0 bg-transparent p-0 focus-visible:ring-0 resize-none min-h-[80px]"
              />
            </div>
          </FormSection>

          <div className="flex gap-3 pt-2 pb-4">
            <Button type="button" variant="outline" onClick={() => navigate(`/fleet/${id}`)} className="flex-1 rounded-2xl h-12">
              Cancelar
            </Button>
            <Button type="submit" disabled={updateVehicle.isPending} className="flex-1 rounded-2xl h-12 text-base">
              {updateVehicle.isPending ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>

          {/* Danger Zone */}
          <div className="space-y-1 mt-4">
            <h3 className="text-xs font-semibold text-destructive uppercase tracking-wider px-1 mb-2">
              Zona de peligro
            </h3>
            <div className="rounded-2xl bg-card border border-destructive/30 shadow-sm p-4">
              <p className="text-sm text-muted-foreground mb-3">
                Eliminar este vehículo permanentemente junto con todas sus inspecciones, fotos y daños.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" type="button" className="w-full rounded-2xl h-12 border-destructive/50 text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar Vehículo
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar {vehicle.matricula}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se eliminarán todas las inspecciones, fotos y daños asociados a este vehículo. Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async () => {
                        await deleteVehicle.mutateAsync(id!);
                        navigate('/fleet');
                      }}
                    >
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </motion.form>
      </div>
    </AppLayout>
  );
}
