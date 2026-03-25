/**
 * TransferMovementReview - Review and confirm auto-creation of movements from parsed PDF data.
 * 
 * Flow:
 * 1. Shows extracted items from PDF with editable fields
 * 2. User can assign matricula + driver to each item
 * 3. User can toggle which items should create movements
 * 4. On confirm, calls /api/create-movements-from-transfer
 */
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  AlertCircle, Check, ChevronDown, ChevronUp, Clock, Loader2,
  MapPin, Truck, Users, Car, Plane, ArrowRight, ArrowLeftRight, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiInvoke } from '@/lib/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/transferCalculations';
import { VEHICLE_TYPES } from '@/lib/transferPricing';
import type { ExtractedTransferItem, TransferDocument } from '@/types/transfers';

const MOVEMENT_TYPES = [
  { value: 'entrega', label: 'Entrega' },
  { value: 'recogida', label: 'Recogida' },
  { value: 'escoba', label: 'Escoba' },
] as const;

interface ReviewItem extends ExtractedTransferItem {
  // User-editable fields for movement creation
  matricula: string;
  create_movement: boolean;
  movement_type: 'entrega' | 'recogida' | 'escoba' | 'limpieza';
  // UI state
  expanded: boolean;
}

interface TransferMovementReviewProps {
  requestId: string;
  document: TransferDocument;
  items: ExtractedTransferItem[];
  providerCost: number | null;
  onComplete: () => void;
  onCancel: () => void;
}

export function TransferMovementReview({
  requestId,
  document,
  items,
  providerCost,
  onComplete,
  onCancel,
}: TransferMovementReviewProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);

  // Initialize review items from extracted data
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>(() =>
    items.map((item) => ({
      ...item,
      // Default new fields that might be missing from legacy parsing
      dropoff_time: item.dropoff_time ?? null,
      flight_number: item.flight_number ?? null,
      has_return: item.has_return ?? false,
      return_pickup_location: item.return_pickup_location ?? null,
      return_dropoff_location: item.return_dropoff_location ?? null,
      return_pickup_time: item.return_pickup_time ?? null,
      return_date: item.return_date ?? null,
      driver_name: item.driver_name ?? null,
      driver_phone: item.driver_phone ?? null,
      confidence: item.confidence ?? null,
      // Movement fields
      matricula: '',
      create_movement: false, // Default off - user opts in
      movement_type: 'entrega',
      expanded: false,
    }))
  );

  const updateItem = (index: number, updates: Partial<ReviewItem>) => {
    setReviewItems(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  const toggleAllMovements = (checked: boolean) => {
    setReviewItems(prev => prev.map(item => ({ ...item, create_movement: checked })));
  };

  const toggleAllExpanded = () => {
    const newState = !allExpanded;
    setAllExpanded(newState);
    setReviewItems(prev => prev.map(item => ({ ...item, expanded: newState })));
  };

  const movementCount = useMemo(() => reviewItems.filter(i => i.create_movement).length, [reviewItems]);
  const totalAmount = useMemo(() => reviewItems.reduce((sum, i) => sum + (i.amount || 0), 0), [reviewItems]);

  // Validation
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    reviewItems.forEach((item, i) => {
      if (item.create_movement && !item.matricula.trim()) {
        errors.push(`Trayecto ${i + 1}: Matrícula requerida para crear movimiento`);
      }
    });
    return errors;
  }, [reviewItems]);

  const canSubmit = validationErrors.length === 0 && reviewItems.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);

    try {
      const payload = {
        request_id: requestId,
        document_id: document.id,
        items: reviewItems.map(item => ({
          transfer_date: item.date,
          pickup_time: item.pickup_time,
          pickup_location: item.pickup_location,
          dropoff_location: item.dropoff_location,
          dropoff_time: item.dropoff_time,
          vehicle_type: item.vehicle_type,
          pax_count: item.pax_count,
          amount: item.amount,
          notes: item.notes,
          has_return: item.has_return,
          return_pickup_location: item.return_pickup_location,
          return_dropoff_location: item.return_dropoff_location,
          return_pickup_time: item.return_pickup_time,
          return_date: item.return_date,
          matricula: item.matricula || null,
          driver_name: item.driver_name,
          driver_phone: item.driver_phone,
          create_movement: item.create_movement,
          movement_type: item.movement_type,
        })),
        provider_cost: providerCost,
      };

      const { data, error } = await apiInvoke<{
        success: boolean;
        created_items: number;
        created_movements: number;
        errors?: string[];
      }>('create-movements-from-transfer', { body: payload });

      if (error) throw new Error(error.message);

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['transfer-request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['transfer-requests'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-movements'] });

      const result = data!;
      const parts: string[] = [];
      if (result.created_items > 0) {
        parts.push(`${result.created_items} trayecto${result.created_items !== 1 ? 's' : ''} creado${result.created_items !== 1 ? 's' : ''}`);
      }
      if (result.created_movements > 0) {
        parts.push(`${result.created_movements} movimiento${result.created_movements !== 1 ? 's' : ''} generado${result.created_movements !== 1 ? 's' : ''}`);
      }

      toast.success(parts.join(' y ') || 'Operación completada');

      if (result.errors && result.errors.length > 0) {
        toast.warning(`${result.errors.length} advertencia${result.errors.length !== 1 ? 's' : ''}: ${result.errors[0]}`);
      }

      onComplete();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getConfidenceBadge = (confidence: number | null) => {
    if (confidence === null) return null;
    if (confidence >= 0.8) return <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20"><Shield className="h-3 w-3 mr-1" />Alta</Badge>;
    if (confidence >= 0.5) return <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><AlertCircle className="h-3 w-3 mr-1" />Media</Badge>;
    return <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/20"><AlertCircle className="h-3 w-3 mr-1" />Baja</Badge>;
  };

  const getVehicleLabel = (key: string | null) => {
    if (!key) return '—';
    return VEHICLE_TYPES.find(v => v.key === key)?.label || key;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Revisión de presupuesto</h3>
          <p className="text-sm text-muted-foreground">
            {items.length} trayecto{items.length !== 1 ? 's' : ''} detectado{items.length !== 1 ? 's' : ''}
            {providerCost ? ` · Total proveedor: ${formatCurrency(providerCost)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={toggleAllExpanded}>
            {allExpanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
            {allExpanded ? 'Colapsar' : 'Expandir'}
          </Button>
        </div>
      </div>

      {/* Global confidence */}
      {document.ai_raw_data?.confidence != null && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Confianza de extracción:</span>
          {getConfidenceBadge(document.ai_raw_data.confidence)}
          {document.ai_raw_data.confidence < 0.5 && (
            <span className="text-xs text-destructive">Revisa los datos cuidadosamente</span>
          )}
        </div>
      )}

      {/* Items list */}
      <div className="space-y-3">
        {reviewItems.map((item, index) => (
          <Card key={index} className={cn(
            'transition-all',
            item.create_movement && 'ring-1 ring-primary/30 bg-primary/[0.02]'
          )}>
            {/* Compact header - always visible */}
            <div
              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => updateItem(index, { expanded: !item.expanded })}
            >
              <span className="text-sm font-medium text-muted-foreground w-6 shrink-0">
                #{index + 1}
              </span>

              <div className="flex items-center gap-2 min-w-0 flex-1">
                {item.date && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    {new Date(item.date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                  </Badge>
                )}
                {item.pickup_time && (
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5 shrink-0">
                    <Clock className="h-3 w-3" />{item.pickup_time}
                  </span>
                )}
                <span className="text-sm truncate">
                  {item.pickup_location || '?'} <ArrowRight className="h-3 w-3 inline" /> {item.dropoff_location || '?'}
                </span>
                {item.has_return && (
                  <span title="Ida y vuelta"><ArrowLeftRight className="h-3.5 w-3.5 text-blue-500 shrink-0" /></span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {item.pax_count && (
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <Users className="h-3 w-3" />{item.pax_count}
                  </span>
                )}
                {item.amount != null && (
                  <span className="text-sm font-medium">{formatCurrency(item.amount)}</span>
                )}
                {getConfidenceBadge(item.confidence)}
                {item.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>

            {/* Expanded details */}
            {item.expanded && (
              <CardContent className="pt-0 pb-4 space-y-4">
                <Separator />

                {/* Route details - editable */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Fecha</Label>
                    <Input
                      type="date"
                      value={item.date || ''}
                      onChange={e => updateItem(index, { date: e.target.value || null })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Hora recogida</Label>
                    <Input
                      type="time"
                      value={item.pickup_time || ''}
                      onChange={e => updateItem(index, { pickup_time: e.target.value || null })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Hora llegada</Label>
                    <Input
                      type="time"
                      value={item.dropoff_time || ''}
                      onChange={e => updateItem(index, { dropoff_time: e.target.value || null })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-1">
                    <Label className="text-xs text-muted-foreground">Recogida</Label>
                    <Input
                      value={item.pickup_location || ''}
                      onChange={e => updateItem(index, { pickup_location: e.target.value || null })}
                      className="h-8 text-sm"
                      placeholder="Lugar de recogida"
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-1">
                    <Label className="text-xs text-muted-foreground">Destino</Label>
                    <Input
                      value={item.dropoff_location || ''}
                      onChange={e => updateItem(index, { dropoff_location: e.target.value || null })}
                      className="h-8 text-sm"
                      placeholder="Lugar de destino"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Tipo vehículo</Label>
                    <Select
                      value={item.vehicle_type || ''}
                      onValueChange={v => updateItem(index, { vehicle_type: v || null })}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {VEHICLE_TYPES.map(vt => (
                          <SelectItem key={vt.key} value={vt.key}>{vt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">PAX</Label>
                    <Input
                      type="number"
                      min={1}
                      value={item.pax_count ?? ''}
                      onChange={e => updateItem(index, { pax_count: e.target.value ? parseInt(e.target.value) : null })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Importe (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.amount ?? ''}
                      onChange={e => updateItem(index, { amount: e.target.value ? parseFloat(e.target.value) : null })}
                      className="h-8 text-sm"
                    />
                  </div>
                  {item.flight_number && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Vuelo</Label>
                      <Input
                        value={item.flight_number || ''}
                        onChange={e => updateItem(index, { flight_number: e.target.value || null })}
                        className="h-8 text-sm"
                        placeholder="Ej: IB3456"
                      />
                    </div>
                  )}
                </div>

                {/* Return trip */}
                {item.has_return && (
                  <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                      <ArrowLeftRight className="h-4 w-4" />
                      Vuelta
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Fecha vuelta</Label>
                        <Input
                          type="date"
                          value={item.return_date || item.date || ''}
                          onChange={e => updateItem(index, { return_date: e.target.value || null })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Hora vuelta</Label>
                        <Input
                          type="time"
                          value={item.return_pickup_time || ''}
                          onChange={e => updateItem(index, { return_pickup_time: e.target.value || null })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Recogida vuelta</Label>
                        <Input
                          value={item.return_pickup_location || ''}
                          onChange={e => updateItem(index, { return_pickup_location: e.target.value || null })}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Movement creation section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`create-movement-${index}`}
                      checked={item.create_movement}
                      onCheckedChange={(checked) => updateItem(index, { create_movement: !!checked })}
                    />
                    <Label htmlFor={`create-movement-${index}`} className="text-sm font-medium cursor-pointer flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Crear movimiento automáticamente
                    </Label>
                  </div>

                  {item.create_movement && (
                    <div className="pl-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Matrícula *</Label>
                        <Input
                          value={item.matricula}
                          onChange={e => updateItem(index, { matricula: e.target.value.toUpperCase() })}
                          className={cn('h-8 text-sm uppercase', !item.matricula.trim() && 'border-destructive')}
                          placeholder="Ej: 1234ABC"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Tipo movimiento</Label>
                        <Select
                          value={item.movement_type}
                          onValueChange={v => updateItem(index, { movement_type: v as any })}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MOVEMENT_TYPES.map(mt => (
                              <SelectItem key={mt.value} value={mt.value}>{mt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Conductor</Label>
                        <Input
                          value={item.driver_name || ''}
                          onChange={e => updateItem(index, { driver_name: e.target.value || null })}
                          className="h-8 text-sm"
                          placeholder="Nombre conductor"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Summary & Actions */}
      <Card className="bg-muted/30">
        <CardContent className="p-4 space-y-3">
          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-1">
              {validationErrors.map((err, i) => (
                <p key={i} className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" /> {err}
                </p>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <div className="space-y-1">
              <p>
                <span className="font-medium">{reviewItems.length}</span> trayecto{reviewItems.length !== 1 ? 's' : ''} a crear
                {movementCount > 0 && (
                  <> · <span className="font-medium text-primary">{movementCount}</span> movimiento{movementCount !== 1 ? 's' : ''}</>
                )}
              </p>
              {totalAmount > 0 && (
                <p className="text-muted-foreground">
                  Total proveedor: <span className="font-medium text-foreground">{formatCurrency(totalAmount)}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 mr-4">
                <Checkbox
                  id="toggle-all-movements"
                  checked={movementCount === reviewItems.length && reviewItems.length > 0}
                  onCheckedChange={(checked) => toggleAllMovements(!!checked)}
                />
                <Label htmlFor="toggle-all-movements" className="text-xs text-muted-foreground cursor-pointer">
                  Crear todos los movimientos
                </Label>
              </div>
              <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting} className="gap-2">
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Confirmar y crear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
