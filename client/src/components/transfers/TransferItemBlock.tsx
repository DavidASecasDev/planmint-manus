import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, Trash2, User, Users, MapPin, Euro, RefreshCw, AlertTriangle, Plus, Car } from 'lucide-react';
import { useTransferItems } from '@/hooks/useTransferItems';
import { useTransferItemVehicles } from '@/hooks/useTransferItemVehicles';
import { TransferStatusBadge } from './TransferStatusBadge';
import { TransferItemVehicleCard } from './TransferItemVehicleCard';
import { usePermissions } from '@/hooks/usePermissions';
import {
  TRANSFER_ZONES,
  VEHICLE_TYPES,
  getBasePrice,
  calculatePriceWithCommission,
  getCommissionAmount,
} from '@/lib/transferPricing';
import type { TransferItem, TransferItemStatus } from '@/types/transfers';
import { RouteMapPreview } from './RouteMapPreview';

interface TransferItemBlockProps {
  item: TransferItem;
  index: number;
  requestId: string;
}

const ITEM_STATUS_OPTIONS: { value: TransferItemStatus; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'completado', label: 'Completado' },
  { value: 'cancelado', label: 'Cancelado' },
];

// Debounce delay in ms
const DEBOUNCE_DELAY = 500;

// Fields managed with local state to prevent re-render lag
const LOCAL_TEXT_FIELDS = [
  'pickup_location', 'dropoff_location', 'zone_address',
  'driver_name', 'driver_phone', 'notes',
] as const;

type LocalTextFieldKey = typeof LOCAL_TEXT_FIELDS[number];

function getLocalFieldsFromItem(item: TransferItem): Record<LocalTextFieldKey, string> {
  return LOCAL_TEXT_FIELDS.reduce((acc, field) => {
    acc[field] = (item[field] as string) || '';
    return acc;
  }, {} as Record<LocalTextFieldKey, string>);
}

export function TransferItemBlock({ item, index, requestId }: TransferItemBlockProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { updateItem, updateItemStatus, deleteItem } = useTransferItems(requestId);
  const { vehicles, addVehicle, updateVehicle, deleteVehicle } = useTransferItemVehicles(item.id);
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const canEditPrice = !permissionsLoading && (hasPermission('transfers.manage_pricing') || hasPermission('transfers.manage'));

  // Local state for text fields - decoupled from server props
  const [localFields, setLocalFields] = useState<Record<LocalTextFieldKey, string>>(
    () => getLocalFieldsFromItem(item)
  );
  const lastSyncedId = useRef(item.id);

  // Only reset local state when the item identity changes (different item)
  useEffect(() => {
    if (item.id !== lastSyncedId.current) {
      lastSyncedId.current = item.id;
      setLocalFields(getLocalFieldsFromItem(item));
    }
  }, [item.id]);

  // Debounce refs for batching updates
  const pendingUpdates = useRef<Partial<TransferItem>>({});
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const isSubmitting = useRef(false);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // Flush pending updates immediately
  const flushUpdates = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    
    if (Object.keys(pendingUpdates.current).length > 0 && !isSubmitting.current) {
      isSubmitting.current = true;
      updateItem({ id: item.id, ...pendingUpdates.current });
      pendingUpdates.current = {};
      // Reset submitting flag after a short delay
      setTimeout(() => {
        isSubmitting.current = false;
      }, 100);
    }
  }, [item.id, updateItem]);

  // Debounced field change handler
  const handleFieldChange = useCallback((field: keyof TransferItem, value: unknown) => {
    // Update local state immediately for text fields
    if (LOCAL_TEXT_FIELDS.includes(field as LocalTextFieldKey)) {
      setLocalFields(prev => ({ ...prev, [field]: (value as string) || '' }));
    }

    // Accumulate updates for server
    pendingUpdates.current = { ...pendingUpdates.current, [field]: value };
    
    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // Set new timer
    debounceTimer.current = setTimeout(() => {
      flushUpdates();
    }, DEBOUNCE_DELAY);
  }, [flushUpdates]);

  // Immediate update for selects and checkboxes (no debounce needed)
  const handleImmediateChange = useCallback((field: keyof TransferItem, value: unknown) => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    updateItem({ id: item.id, [field]: value });
    setTimeout(() => {
      isSubmitting.current = false;
    }, 100);
  }, [item.id, updateItem]);

  const handleStatusChange = (status: TransferItemStatus) => {
    updateItemStatus({ id: item.id, status });
  };

  const handleDelete = () => {
    if (confirm('¿Eliminar este transfer?')) {
      deleteItem(item.id);
    }
  };

  // Handle zone change - recalculate price if not manually set
  const handleZoneChange = (zone: string) => {
    const vehicleType = item.vehicle_type || 'v_class';
    const basePrice = getBasePrice(zone, vehicleType);
    
    if (basePrice !== null && !item.price_manually_set) {
      const priceWithCommission = calculatePriceWithCommission(basePrice);
      if (isSubmitting.current) return;
      isSubmitting.current = true;
      updateItem({
        id: item.id,
        zone,
        base_price: basePrice,
        price_with_commission: priceWithCommission,
      });
      setTimeout(() => {
        isSubmitting.current = false;
      }, 100);
    } else {
      handleImmediateChange('zone', zone);
    }
  };

  // Handle vehicle type change - recalculate price if not manually set
  const handleVehicleChange = (vehicleType: string) => {
    const zone = item.zone;
    if (zone) {
      const basePrice = getBasePrice(zone, vehicleType);
      
      if (basePrice !== null && !item.price_manually_set) {
        const priceWithCommission = calculatePriceWithCommission(basePrice);
        if (isSubmitting.current) return;
        isSubmitting.current = true;
        updateItem({
          id: item.id,
          vehicle_type: vehicleType,
          base_price: basePrice,
          price_with_commission: priceWithCommission,
        });
        setTimeout(() => {
          isSubmitting.current = false;
        }, 100);
      } else {
        handleImmediateChange('vehicle_type', vehicleType);
      }
    } else {
      handleImmediateChange('vehicle_type', vehicleType);
    }
  };

  // Handle manual price change
  const handlePriceChange = (newPrice: number) => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    updateItem({
      id: item.id,
      price_with_commission: newPrice,
      price_manually_set: true,
    });
    setTimeout(() => {
      isSubmitting.current = false;
    }, 100);
  };

  // Recalculate price from zone and vehicle
  const handleRecalculatePrice = () => {
    if (item.zone && item.vehicle_type) {
      const basePrice = getBasePrice(item.zone, item.vehicle_type);
      if (basePrice !== null) {
        const priceWithCommission = calculatePriceWithCommission(basePrice);
        if (isSubmitting.current) return;
        isSubmitting.current = true;
        updateItem({
          id: item.id,
          base_price: basePrice,
          price_with_commission: priceWithCommission,
          price_manually_set: false,
        });
        setTimeout(() => {
          isSubmitting.current = false;
        }, 100);
      }
    }
  };

  // Handle provider cost change per item (provider_quote mode)
  const handleProviderCostChange = (cost: number) => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    // Calculate client price from provider cost: cost + 50% commission
    const clientPrice = Math.round(cost * 1.5 * 100) / 100;
    updateItem({
      id: item.id,
      provider_cost: cost,
      base_price: cost,
      price_with_commission: item.price_manually_set ? (item.price_with_commission ?? clientPrice) : clientPrice,
    });
    setTimeout(() => {
      isSubmitting.current = false;
    }, 100);
  };

  // Calculate display values
  const basePrice = item.base_price ?? 0;
  const commissionAmount = getCommissionAmount(basePrice);
  const displayPrice = item.price_with_commission ?? 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">Transfer {index + 1}</CardTitle>
                <TransferStatusBadge status={item.status} type="item" />
                {item.transfer_date && (
                  <span className="text-sm text-muted-foreground">
                    {new Date(item.transfer_date).toLocaleDateString('es-ES')}
                  </span>
                )}
                {item.pax_count && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> {item.pax_count}
                  </span>
                )}
                {displayPrice > 0 && (
                  <span className="text-sm font-medium text-primary flex items-center gap-1">
                    <Euro className="h-3 w-3" /> {displayPrice}€
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Select value={item.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-[130px] h-8 text-xs" onClick={(e) => e.stopPropagation()}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            {/* Basic Info */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={item.transfer_date || ''}
                  onChange={(e) => handleImmediateChange('transfer_date', e.target.value || null)}
                />
              </div>
              <div className="space-y-2">
                <Label>PAX</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={item.pax_count || 1}
                  onChange={(e) => handleFieldChange('pax_count', parseInt(e.target.value) || 1)}
                  onBlur={flushUpdates}
                />
              </div>
            </div>

            {/* Zone and Pricing Section */}
            <div className="space-y-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
              <h4 className="font-medium flex items-center gap-2 text-primary">
                <MapPin className="h-4 w-4" /> Zona y Precio
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Zona</Label>
                  <Select 
                    value={item.zone || ''} 
                    onValueChange={handleZoneChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar zona..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSFER_ZONES.map((zone) => (
                        <SelectItem key={zone.key} value={zone.key}>
                          {zone.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Vehículo</Label>
                  <Select 
                    value={item.vehicle_type || 'v_class'} 
                    onValueChange={handleVehicleChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
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
              </div>

              <div className="space-y-2">
                <Label>Dirección específica</Label>
                <Input
                  value={localFields.zone_address}
                  onChange={(e) => handleFieldChange('zone_address', e.target.value || null)}
                  onBlur={flushUpdates}
                  placeholder="Nombre del hotel, dirección exacta..."
                />
              </div>

              {/* Price Display Box */}
              <div className="mt-4 p-4 rounded-lg bg-background border">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-medium flex items-center gap-2">
                    <Euro className="h-4 w-4" /> Precio
                  </h5>
                  {item.price_manually_set && canEditPrice && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRecalculatePrice}
                      className="h-7 text-xs"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Recalcular
                    </Button>
                  )}
                </div>
                
                <div className="space-y-2 text-sm">
                  {item.zone && (
                    <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Precio proveedor (tarifa zona):</span>
                        <span>{basePrice} €</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>+ Comisión (50%):</span>
                        <span>{commissionAmount} €</span>
                      </div>
                    </>
                  )}



                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">PRECIO CLIENTE (sin IVA):</span>
                      <div className="flex items-center gap-2">
                        {canEditPrice ? (
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={displayPrice || ''}
                            onChange={(e) => handlePriceChange(parseFloat(e.target.value) || 0)}
                            className={`w-24 h-8 text-right font-bold ${
                              item.price_manually_set ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20' : ''
                            }`}
                          />
                        ) : (
                          <span className="font-bold text-lg">{displayPrice}</span>
                        )}
                        <span className="font-bold">€</span>
                      </div>
                    </div>
                  </div>
                  
                  {displayPrice > 0 && (
                    <div className="mt-2 pt-2 border-t border-dashed">
                      <div className="flex justify-between text-muted-foreground">
                        <span>IVA 21%:</span>
                        <span>{new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(displayPrice * 0.21)} €</span>
                      </div>
                      <div className="flex justify-between font-bold text-primary mt-1">
                        <span>TOTAL CON IVA:</span>
                        <span>{new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(displayPrice * 1.21)} €</span>
                      </div>
                    </div>
                  )}
                  
                  {item.price_manually_set && (
                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs mt-2">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Precio modificado manualmente</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Additional Vehicles */}
            {vehicles.length > 0 && (
              <div className="space-y-3 p-4 rounded-lg border border-dashed border-primary/30">
                <h4 className="font-medium flex items-center gap-2 text-sm">
                  <Car className="h-4 w-4" /> Vehículos adicionales ({vehicles.length})
                </h4>
                <div className="space-y-2">
                  {vehicles.map((v) => (
                    <TransferItemVehicleCard
                      key={v.id}
                      vehicle={v}
                      onUpdate={updateVehicle}
                      onDelete={deleteVehicle}
                    />
                  ))}
                </div>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => addVehicle({ vehicle_type: 'v_class' })}
            >
              <Plus className="h-4 w-4 mr-2" />
              Añadir vehículo adicional
            </Button>

            {/* Outbound - Pickup */}
            <div className="space-y-3 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Checkbox
                  id={`pickup-${item.id}`}
                  checked={item.pickup_enabled}
                  onCheckedChange={(checked) => handleImmediateChange('pickup_enabled', !!checked)}
                />
                <Label htmlFor={`pickup-${item.id}`} className="font-medium cursor-pointer">
                  Recogida
                </Label>
              </div>
              {item.pickup_enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  <div className="space-y-2">
                    <Label>Lugar</Label>
                    <Input
                      value={localFields.pickup_location}
                      onChange={(e) => handleFieldChange('pickup_location', e.target.value || null)}
                      onBlur={flushUpdates}
                      placeholder="Lugar de recogida"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora</Label>
                    <Input
                      type="time"
                      value={item.pickup_time || ''}
                      onChange={(e) => handleImmediateChange('pickup_time', e.target.value || null)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Outbound - Dropoff */}
            <div className="space-y-3 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Checkbox
                  id={`dropoff-${item.id}`}
                  checked={item.dropoff_enabled}
                  onCheckedChange={(checked) => handleImmediateChange('dropoff_enabled', !!checked)}
                />
                <Label htmlFor={`dropoff-${item.id}`} className="font-medium cursor-pointer">
                  Llegada
                </Label>
              </div>
              {item.dropoff_enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  <div className="space-y-2">
                    <Label>Lugar</Label>
                    <Input
                      value={localFields.dropoff_location}
                      onChange={(e) => handleFieldChange('dropoff_location', e.target.value || null)}
                      onBlur={flushUpdates}
                      placeholder="Lugar de llegada"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora</Label>
                    <Input
                      type="time"
                      value={item.dropoff_time || ''}
                      onChange={(e) => handleImmediateChange('dropoff_time', e.target.value || null)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Route Map Preview */}
            {item.pickup_enabled && item.dropoff_enabled && localFields.pickup_location && localFields.dropoff_location && (
              <div className="relative">
                <RouteMapPreview
                  pickupLocation={localFields.pickup_location}
                  dropoffLocation={localFields.dropoff_location}
                  height="180px"
                />
              </div>
            )}

            {/* Driver Info */}
            <div className="space-y-4 p-4 rounded-lg border">
              <h4 className="font-medium flex items-center gap-2">
                <User className="h-4 w-4" /> Conductor
              </h4>
              
              <div className="flex items-center gap-3">
                <Checkbox
                  id={`driver-pending-${item.id}`}
                  checked={item.driver_pending}
                  onCheckedChange={(checked) => handleImmediateChange('driver_pending', !!checked)}
                />
                <Label htmlFor={`driver-pending-${item.id}`} className="cursor-pointer">
                  Conductor pendiente de asignar
                </Label>
              </div>

              {!item.driver_pending && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input
                      value={localFields.driver_name}
                      onChange={(e) => handleFieldChange('driver_name', e.target.value || null)}
                      onBlur={flushUpdates}
                      placeholder="Nombre del conductor"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input
                      value={localFields.driver_phone}
                      onChange={(e) => handleFieldChange('driver_phone', e.target.value || null)}
                      onBlur={flushUpdates}
                      placeholder="Teléfono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notas del transfer</Label>
              <Textarea
                value={localFields.notes}
                onChange={(e) => handleFieldChange('notes', e.target.value || null)}
                onBlur={flushUpdates}
                placeholder="Notas adicionales..."
                rows={2}
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
