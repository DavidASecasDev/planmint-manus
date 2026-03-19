import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useFleetVehicles } from '@/hooks/useFleetVehicles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft } from 'lucide-react';
import { FLEET_STATUS_OPTIONS } from '@/types/fleet';
import type { FleetVehicleStatus } from '@/types/fleet';
import { motion } from 'framer-motion';

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

export default function FleetNew() {
  const navigate = useNavigate();
  const { createVehicle } = useFleetVehicles();
  const [form, setForm] = useState({
    matricula: '',
    modelo: '',
    categoria: '',
    proveedor: 'Mercedes Autovidal',
    numero_contrato: '',
    numero_bastidor: '',
    fecha_inicio_contrato: '',
    fecha_fin_contrato: '',
    km_recogida: '',
    status: 'activo' as FleetVehicleStatus,
    notas: '',
    marca: '',
    color: '',
    combustible: '',
    hibrido: false,
    motor: '',
    cv: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createVehicle.mutateAsync({
      matricula: form.matricula,
      modelo: form.modelo || null,
      categoria: form.categoria || null,
      proveedor: form.proveedor || null,
      numero_contrato: form.numero_contrato || null,
      numero_bastidor: form.numero_bastidor || null,
      fecha_inicio_contrato: form.fecha_inicio_contrato || null,
      fecha_fin_contrato: form.fecha_fin_contrato || null,
      km_recogida: form.km_recogida ? parseInt(form.km_recogida) : null,
      km_devolucion: null,
      status: form.status,
      notas: form.notas || null,
      photo_url: null,
      marca: form.marca || null,
      color: form.color || null,
      combustible: form.combustible || null,
      hibrido: form.hibrido,
      motor: form.motor || null,
      cv: form.cv ? parseInt(form.cv) : null,
    });
    navigate('/fleet');
  };

  return (
    <AppLayout title="Nuevo Vehículo">
      <div className="max-w-2xl mx-auto pb-8">
        <Button variant="ghost" onClick={() => navigate('/fleet')} className="mb-4 rounded-xl -ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Flota
        </Button>

        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <FormSection title="Identificación">
            <FormRow label="Matrícula *" htmlFor="matricula">
              <Input
                id="matricula"
                required
                value={form.matricula}
                onChange={e => setForm(f => ({ ...f, matricula: e.target.value }))}
                placeholder="1234 ABC"
                className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0 font-mono tracking-wider"
              />
            </FormRow>
            <FormRow label="Modelo" htmlFor="modelo">
              <Input
                id="modelo"
                value={form.modelo}
                onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))}
                placeholder="Mercedes Clase A"
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
            <FormRow label="Km Recogida" htmlFor="km">
              <Input
                id="km"
                type="number"
                value={form.km_recogida}
                onChange={e => setForm(f => ({ ...f, km_recogida: e.target.value }))}
                placeholder="0"
                className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
              />
            </FormRow>
          </FormSection>

          <FormSection title="Notas">
            <div className="p-4">
              <Textarea
                id="notas"
                value={form.notas}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Observaciones adicionales..."
                className="border-0 bg-transparent p-0 focus-visible:ring-0 resize-none min-h-[80px]"
              />
            </div>
          </FormSection>

          {/* Sticky footer */}
          <div className="flex gap-3 pt-2 pb-4">
            <Button type="button" variant="outline" onClick={() => navigate('/fleet')} className="flex-1 rounded-2xl h-12">
              Cancelar
            </Button>
            <Button type="submit" disabled={createVehicle.isPending} className="flex-1 rounded-2xl h-12 text-base">
              {createVehicle.isPending ? 'Creando...' : 'Crear Vehículo'}
            </Button>
          </div>
        </motion.form>
      </div>
    </AppLayout>
  );
}
