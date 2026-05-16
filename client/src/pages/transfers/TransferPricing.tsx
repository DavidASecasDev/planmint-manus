/**
 * Azul Cars Brand — Transfer Pricing Admin Panel
 * CRUD for transfer_pricing table: manage tariffs by zone, vehicle type, service type
 */
import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, DollarSign, MapPin, Car, Clock } from 'lucide-react';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { VEHICLE_TYPES, TRANSFER_ZONES, PACK_DURATIONS } from '@/lib/transferPricing';

// Types
interface TransferPricingRow {
  id: string;
  organization_id: string;
  zone_key: string;
  zone_label: string;
  vehicle_type: string | null;
  base_price: number;
  commission_price: number;
  service_type: string;
  pack_duration: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PricingFormData {
  zone_key: string;
  zone_label: string;
  vehicle_type: string;
  base_price: string;
  commission_price: string;
  service_type: string;
  pack_duration: string;
  is_active: boolean;
}

const EMPTY_FORM: PricingFormData = {
  zone_key: '',
  zone_label: '',
  vehicle_type: 'v_class',
  base_price: '0',
  commission_price: '0',
  service_type: 'point_to_point',
  pack_duration: '',
  is_active: true,
};

export default function TransferPricing() {
  const { organization } = useAuth();
  const [pricingRows, setPricingRows] = useState<TransferPricingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<TransferPricingRow | null>(null);
  const [form, setForm] = useState<PricingFormData>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  // Filters
  const [filterServiceType, setFilterServiceType] = useState<string>('all');
  const [filterVehicle, setFilterVehicle] = useState<string>('all');

  // Fetch pricing data
  const fetchPricing = async () => {
    if (!organization?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabaseQuery
        .from('transfer_pricing')
        .select('*')
        .eq('organization_id', organization.id)
        .order('zone_key', { ascending: true });

      if (error) throw error;
      setPricingRows(data || []);
    } catch (err: any) {
      toast.error('Error al cargar tarifas: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPricing();
  }, [organization?.id]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return pricingRows.filter(row => {
      if (filterServiceType !== 'all' && row.service_type !== filterServiceType) return false;
      if (filterVehicle !== 'all' && row.vehicle_type !== filterVehicle) return false;
      return true;
    });
  }, [pricingRows, filterServiceType, filterVehicle]);

  // Open dialog for new/edit
  const openNewDialog = () => {
    setEditingRow(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (row: TransferPricingRow) => {
    setEditingRow(row);
    setForm({
      zone_key: row.zone_key,
      zone_label: row.zone_label || '',
      vehicle_type: row.vehicle_type || 'v_class',
      base_price: String(row.base_price),
      commission_price: String(row.commission_price),
      service_type: row.service_type,
      pack_duration: row.pack_duration || '',
      is_active: row.is_active,
    });
    setDialogOpen(true);
  };

  // Save (create or update)
  const handleSave = async () => {
    if (!organization?.id) return;
    if (!form.zone_key.trim() || !form.vehicle_type) {
      toast.error('Zona y tipo de vehículo son obligatorios');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        organization_id: organization.id,
        zone_key: form.zone_key.trim(),
        zone_label: form.zone_label.trim() || form.zone_key.trim(),
        vehicle_type: form.vehicle_type,
        base_price: parseFloat(form.base_price) || 0,
        commission_price: parseFloat(form.commission_price) || 0,
        service_type: form.service_type,
        pack_duration: form.service_type === 'pack' ? form.pack_duration : null,
        is_active: form.is_active,
      };

      if (editingRow) {
        // Update
        const { error } = await supabaseQuery
          .from('transfer_pricing')
          .update(payload)
          .eq('id', editingRow.id);
        if (error) throw error;
        toast.success('Tarifa actualizada');
      } else {
        // Insert
        const { error } = await supabaseQuery
          .from('transfer_pricing')
          .insert([payload]);
        if (error) throw error;
        toast.success('Tarifa creada');
      }

      setDialogOpen(false);
      fetchPricing();
    } catch (err: any) {
      toast.error('Error: ' + (err.message || 'No se pudo guardar'));
    } finally {
      setIsSaving(false);
    }
  };

  // Delete
  const handleDelete = async (row: TransferPricingRow) => {
    if (!confirm(`¿Eliminar tarifa "${row.zone_label}" - ${row.vehicle_type}?`)) return;
    try {
      const { error } = await supabaseQuery
        .from('transfer_pricing')
        .delete()
        .eq('id', row.id);
      if (error) throw error;
      toast.success('Tarifa eliminada');
      fetchPricing();
    } catch (err: any) {
      toast.error('Error al eliminar: ' + (err.message || 'Error'));
    }
  };

  // Toggle active
  const handleToggleActive = async (row: TransferPricingRow) => {
    try {
      const { error } = await supabaseQuery
        .from('transfer_pricing')
        .update({ is_active: !row.is_active })
        .eq('id', row.id);
      if (error) throw error;
      fetchPricing();
    } catch (err: any) {
      toast.error('Error al cambiar estado');
    }
  };

  // Helper: get vehicle label
  const getVehicleLabel = (key: string | null) => {
    if (!key) return '—';
    const v = VEHICLE_TYPES.find(vt => vt.key === key);
    return v ? v.label : key;
  };

  return (
    <AppLayout title="Tarifas de Transfers">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1
              className="text-2xl text-foreground"
              style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}
            >
              Tarifas de Transfers
            </h1>
            <p className="text-sm text-muted-foreground mt-1" style={{ fontFamily: 'Barlow, sans-serif' }}>
              Configura los precios por zona, tipo de vehículo y tipo de servicio. Los cambios se aplican inmediatamente al wizard de solicitudes.
            </p>
          </div>
          <Button onClick={openNewDialog} className="bg-[#C9A96E] hover:bg-[#B8944D] text-white">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Tarifa
          </Button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-[#C9A96E]" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>Total</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{pricingRows.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-4 w-4 text-violet-500" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>Punto a punto</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{pricingRows.filter(r => r.service_type === 'point_to_point').length}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>Packs</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{pricingRows.filter(r => r.service_type === 'pack').length}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Car className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>Activas</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{pricingRows.filter(r => r.is_active).length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={filterServiceType} onValueChange={setFilterServiceType}>
            <SelectTrigger className="w-[180px] bg-card border-border">
              <SelectValue placeholder="Tipo de servicio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los servicios</SelectItem>
              <SelectItem value="point_to_point">Punto a punto</SelectItem>
              <SelectItem value="pack">Pack por horas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterVehicle} onValueChange={setFilterVehicle}>
            <SelectTrigger className="w-[180px] bg-card border-border">
              <SelectValue placeholder="Tipo de vehículo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los vehículos</SelectItem>
              {VEHICLE_TYPES.map(v => (
                <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="p-12 text-center">
                <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
                  No hay tarifas configuradas. Crea la primera para empezar.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs uppercase tracking-wider" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>Zona</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>Vehículo</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>Servicio</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-right" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>Precio Base (B2B)</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-right" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>Precio Comisión</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-center" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>Activa</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-right" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map(row => (
                      <TableRow key={row.id} className={!row.is_active ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">{row.zone_label || row.zone_key}</TableCell>
                        <TableCell>{getVehicleLabel(row.vehicle_type)}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                            row.service_type === 'point_to_point'
                              ? 'bg-violet-500/10 text-violet-600'
                              : 'bg-amber-500/10 text-amber-600'
                          }`}>
                            {row.service_type === 'point_to_point' ? 'Punto a punto' : `Pack ${row.pack_duration || ''}`}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">{row.base_price.toFixed(2)} €</TableCell>
                        <TableCell className="text-right font-mono">{row.commission_price.toFixed(2)} €</TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={row.is_active}
                            onCheckedChange={() => handleToggleActive(row)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(row)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(row)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info card */}
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-blue-700" style={{ fontFamily: 'Barlow, sans-serif' }}>
              <strong>Precio Base (B2B):</strong> Precio que se muestra a clientes Isle Of Mallorca (sin comisión).
              <br />
              <strong>Precio Comisión:</strong> Precio que se muestra a clientes directos (incluye margen de beneficio).
              <br />
              <span className="text-xs text-blue-600/70 mt-1 block">
                Los precios configurados aquí se usarán automáticamente en el wizard de solicitudes del portal de brokers.
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
              {editingRow ? 'Editar Tarifa' : 'Nueva Tarifa'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Service Type */}
            <div className="space-y-2">
              <Label style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '12px' }}>
                Tipo de servicio
              </Label>
              <Select value={form.service_type} onValueChange={(v) => setForm(prev => ({ ...prev, service_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="point_to_point">Punto a punto</SelectItem>
                  <SelectItem value="pack">Pack por horas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Zone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '12px' }}>
                  Clave de zona
                </Label>
                <Select value={form.zone_key} onValueChange={(v) => {
                  const zone = TRANSFER_ZONES.find(z => z.key === v);
                  setForm(prev => ({ ...prev, zone_key: v, zone_label: zone?.label || v }));
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSFER_ZONES.map(z => (
                      <SelectItem key={z.key} value={z.key}>{z.label}</SelectItem>
                    ))}
                    <SelectItem value="custom">Personalizada...</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '12px' }}>
                  Etiqueta zona
                </Label>
                <Input
                  value={form.zone_label}
                  onChange={(e) => setForm(prev => ({ ...prev, zone_label: e.target.value }))}
                  placeholder="Ej: Aeropuerto → Palma"
                />
              </div>
            </div>

            {/* Vehicle Type */}
            <div className="space-y-2">
              <Label style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '12px' }}>
                Tipo de vehículo
              </Label>
              <Select value={form.vehicle_type} onValueChange={(v) => setForm(prev => ({ ...prev, vehicle_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map(v => (
                    <SelectItem key={v.key} value={v.key}>{v.label} ({v.capacity} pax)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pack Duration (only for pack service type) */}
            {form.service_type === 'pack' && (
              <div className="space-y-2">
                <Label style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '12px' }}>
                  Duración del pack
                </Label>
                <Select value={form.pack_duration} onValueChange={(v) => setForm(prev => ({ ...prev, pack_duration: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar duración..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PACK_DURATIONS.map(d => (
                      <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Prices */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '12px' }}>
                  Precio Base (B2B) €
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.base_price}
                  onChange={(e) => setForm(prev => ({ ...prev, base_price: e.target.value }))}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">Para clientes Isle Of Mallorca</p>
              </div>
              <div className="space-y-2">
                <Label style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '12px' }}>
                  Precio Comisión €
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.commission_price}
                  onChange={(e) => setForm(prev => ({ ...prev, commission_price: e.target.value }))}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">Para clientes directos (con margen)</p>
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '12px' }}>
                  Tarifa activa
                </Label>
                <p className="text-xs text-muted-foreground">Las tarifas inactivas no aparecen en el wizard</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_active: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#C9A96E] hover:bg-[#B8944D] text-white"
            >
              {isSaving ? 'Guardando...' : editingRow ? 'Actualizar' : 'Crear Tarifa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
