import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBrokerRequests, useBrokerRequestDetail, UpdateBrokerRequestData } from '@/hooks/useBrokerRequests';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';
import { useBrokerTheme } from '@/contexts/BrokerThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VEHICLE_TYPES } from '@/lib/transferPricing';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Loader2,
  Clock,
  Users,
  RotateCcw,
  Car,
  AlertCircle
} from 'lucide-react';

interface TransferItemForm {
  id: string;
  transfer_date: string;
  pickup_enabled: boolean;
  pickup_location: string;
  pickup_time: string;
  dropoff_enabled: boolean;
  dropoff_location: string;
  dropoff_time: string;
  has_return: boolean;
  return_pickup_enabled: boolean;
  return_pickup_location: string;
  return_pickup_time: string;
  return_dropoff_enabled: boolean;
  return_dropoff_location: string;
  return_dropoff_time: string;
  pax_count: string;
  vehicle_type: string;
  notes: string;
}

const createEmptyItem = (): TransferItemForm => ({
  id: crypto.randomUUID(),
  transfer_date: '',
  pickup_enabled: true,
  pickup_location: '',
  pickup_time: '',
  dropoff_enabled: true,
  dropoff_location: '',
  dropoff_time: '',
  has_return: false,
  return_pickup_enabled: false,
  return_pickup_location: '',
  return_pickup_time: '',
  return_dropoff_enabled: false,
  return_dropoff_location: '',
  return_dropoff_time: '',
  pax_count: '',
  vehicle_type: 'v_class',
  notes: '',
});

export default function BrokerEditRequest() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { broker } = useBrokerAuth();
  const { resolvedTheme } = useBrokerTheme();
  const isDark = resolvedTheme === 'dark';
  const { data: request, isLoading: isLoadingDetail } = useBrokerRequestDetail(id);
  const { updateRequest, isUpdating } = useBrokerRequests();
  
  const [clientName, setClientName] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<TransferItemForm[]>([createEmptyItem()]);
  const [initialized, setInitialized] = useState(false);

  // Paleta Nautical Luxury
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const titleColor = isDark ? '#93c5fd' : '#1a365d';
  const textPrimary = isDark ? '#e2e8f0' : '#111827';
  const textSecondary = isDark ? '#94a3b8' : '#6b7280';
  const inputStyle = !isDark
    ? { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#d1d5db' }
    : { backgroundColor: '#0f172a', color: '#e2e8f0', borderColor: '#334155' };

  // Pre-fill form when data loads
  useEffect(() => {
    if (request && !initialized) {
      setClientName(request.client_name || '');
      setNotes(request.notes || '');
      
      if (request.items && request.items.length > 0) {
        setItems(request.items.map(item => ({
          id: crypto.randomUUID(),
          transfer_date: item.transfer_date || '',
          pickup_enabled: item.pickup_enabled ?? true,
          pickup_location: item.pickup_location || '',
          pickup_time: item.pickup_time || '',
          dropoff_enabled: item.dropoff_enabled ?? true,
          dropoff_location: item.dropoff_location || '',
          dropoff_time: item.dropoff_time || '',
          has_return: item.has_return ?? false,
          return_pickup_enabled: item.return_pickup_enabled ?? false,
          return_pickup_location: item.return_pickup_location || '',
          return_pickup_time: item.return_pickup_time || '',
          return_dropoff_enabled: item.return_dropoff_enabled ?? false,
          return_dropoff_location: item.return_dropoff_location || '',
          return_dropoff_time: item.return_dropoff_time || '',
          pax_count: item.pax_count?.toString() || '',
          vehicle_type: item.vehicle_type || 'v_class',
          notes: item.notes || '',
        })));
      }
      setInitialized(true);
    }
  }, [request, initialized]);

  if (isLoadingDetail) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: titleColor }} />
      </div>
    );
  }

  // Guard: not pending or not own request
  if (request && (request.status !== 'pendiente' || broker?.id !== request.broker_id)) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-20">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-semibold mb-2" style={{ color: textPrimary }}>
            No se puede editar esta solicitud
          </h2>
          <p className="mb-4" style={{ color: textSecondary }}>
            Solo se pueden editar solicitudes en estado pendiente que sean tuyas.
          </p>
          <button
            onClick={() => navigate(`/broker/request/${id}`)}
            className="text-sm hover:underline"
            style={{ color: titleColor }}
          >
            Volver al detalle
          </button>
        </div>
      </div>
    );
  }

  const handleAddItem = () => {
    setItems(prev => [...prev, createEmptyItem()]);
  };

  const handleRemoveItem = (itemId: string) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleItemChange = (itemId: string, field: keyof TransferItemForm, value: any) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !id) return;

    const data: UpdateBrokerRequestData = {
      id,
      client_name: clientName.trim(),
      notes: notes.trim() || undefined,
      items: items.map(item => ({
        transfer_date: item.transfer_date || null,
        pickup_enabled: item.pickup_enabled,
        pickup_location: item.pickup_location || null,
        pickup_time: item.pickup_time || null,
        dropoff_enabled: item.dropoff_enabled,
        dropoff_location: item.dropoff_location || null,
        dropoff_time: item.dropoff_time || null,
        has_return: item.has_return,
        return_pickup_enabled: item.return_pickup_enabled,
        return_pickup_location: item.return_pickup_location || null,
        return_pickup_time: item.return_pickup_time || null,
        return_dropoff_enabled: item.return_dropoff_enabled,
        return_dropoff_location: item.return_dropoff_location || null,
        return_dropoff_time: item.return_dropoff_time || null,
        pax_count: item.pax_count ? parseInt(item.pax_count) : null,
        vehicle_type: item.vehicle_type || null,
        notes: item.notes || null,
      })),
    };

    try {
      await updateRequest(data);
      navigate(`/broker/request/${id}`);
    } catch (error) {
      // Error handled by hook
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button 
          onClick={() => navigate(`/broker/request/${id}`)}
          className="flex items-center gap-2 text-sm mb-4 hover:opacity-80 transition-opacity"
          style={{ color: titleColor }}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al detalle
        </button>
        
        <h1 
          className="text-2xl font-bold mb-1"
          style={{ color: titleColor }}
        >
          Editar Solicitud {request?.request_number}
        </h1>
        <div 
          className="w-20 h-1 rounded"
          style={{ backgroundColor: '#b8860b' }}
        />
      </div>

      <form onSubmit={handleSubmit}>
        {/* Client Info */}
        <div
          className="rounded-lg border p-6 mb-6"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
        >
          <h2 
            className="text-lg font-semibold mb-4"
            style={{ color: titleColor }}
          >
            Información del Cliente
          </h2>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="client_name">Nombre del cliente *</Label>
              <Input
                id="client_name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ej: Sr. García y familia"
                required
                className="mt-1.5"
                style={inputStyle}
              />
            </div>
            
            <div className="sm:col-span-2">
              <Label htmlFor="notes">Notas generales</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Instrucciones especiales, preferencias del cliente..."
                className="mt-1.5"
                rows={3}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Transfer Items */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <h2 
              className="text-lg font-semibold"
              style={{ color: titleColor }}
            >
              Trayectos ({items.length})
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              style={{ borderColor: '#b8860b', color: '#b8860b' }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Añadir trayecto
            </Button>
          </div>

          {items.map((item, index) => (
            <TransferItemCard
              key={item.id}
              item={item}
              index={index}
              canRemove={items.length > 1}
              onChange={(field, value) => handleItemChange(item.id, field, value)}
              onRemove={() => handleRemoveItem(item.id)}
              isDark={isDark}
            />
          ))}
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/broker/request/${id}`)}
            disabled={isUpdating}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isUpdating || !clientName.trim()}
            style={{ backgroundColor: '#b8860b', color: 'white' }}
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar cambios'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

interface TransferItemCardProps {
  item: TransferItemForm;
  index: number;
  canRemove: boolean;
  onChange: (field: keyof TransferItemForm, value: any) => void;
  onRemove: () => void;
  isDark: boolean;
}

function TransferItemCard({ item, index, canRemove, onChange, onRemove, isDark }: TransferItemCardProps) {
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const headerBg = isDark ? '#0f172a' : '#f8fafc';
  const titleColor = isDark ? '#93c5fd' : '#1a365d';
  const textLabel = isDark ? '#94a3b8' : '#374151';
  const dividerColor = isDark ? '#334155' : '#e2e8f0';
  const inputStyle = !isDark
    ? { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#d1d5db' }
    : { backgroundColor: '#0f172a', color: '#e2e8f0', borderColor: '#334155' };

  return (
    <div 
      className="rounded-lg border overflow-hidden"
      style={{ 
        backgroundColor: cardBg,
        borderColor: cardBorder,
        borderLeft: '4px solid #b8860b',
      }}
    >
      <div 
        className="px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: headerBg, borderBottom: `1px solid ${dividerColor}` }}
      >
        <span className="font-medium" style={{ color: titleColor }}>
          Trayecto {index + 1}
        </span>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Date, Pax & Vehicle */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label className="flex items-center gap-1.5" style={{ color: textLabel }}>
              <Clock className="h-3.5 w-3.5" style={{ color: isDark ? '#64748b' : '#6b7280' }} />
              Fecha
            </Label>
            <Input
              type="date"
              value={item.transfer_date}
              onChange={(e) => onChange('transfer_date', e.target.value)}
              className="mt-1.5"
              style={inputStyle}
            />
          </div>
          <div>
            <Label className="flex items-center gap-1.5" style={{ color: textLabel }}>
              <Users className="h-3.5 w-3.5" style={{ color: isDark ? '#64748b' : '#6b7280' }} />
              Pasajeros
            </Label>
            <Input
              type="number"
              min="1"
              value={item.pax_count}
              onChange={(e) => onChange('pax_count', e.target.value)}
              placeholder="Nº de pax"
              className="mt-1.5"
              style={inputStyle}
            />
          </div>
          <div>
            <Label className="flex items-center gap-1.5" style={{ color: textLabel }}>
              <Car className="h-3.5 w-3.5" style={{ color: isDark ? '#64748b' : '#6b7280' }} />
              Tipo de vehículo
            </Label>
            <Select
              value={item.vehicle_type}
              onValueChange={(value) => onChange('vehicle_type', value)}
            >
              <SelectTrigger className="mt-1.5" style={inputStyle}>
                <SelectValue placeholder="Seleccionar vehículo" />
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

        {/* Pickup */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`pickup-${item.id}`}
              checked={item.pickup_enabled}
              onCheckedChange={(checked) => onChange('pickup_enabled', checked)}
            />
            <Label htmlFor={`pickup-${item.id}`} className="font-medium cursor-pointer">
              Recogida
            </Label>
          </div>
          {item.pickup_enabled && (
            <div className="grid gap-3 sm:grid-cols-2 pl-6">
              <div>
                <Label className="text-xs" style={{ color: textLabel }}>Ubicación</Label>
                <Input
                  value={item.pickup_location}
                  onChange={(e) => onChange('pickup_location', e.target.value)}
                  placeholder="Ej: Puerto de Palma"
                  className="mt-1"
                  style={inputStyle}
                />
              </div>
              <div>
                <Label className="text-xs" style={{ color: textLabel }}>Hora</Label>
                <Input
                  type="time"
                  value={item.pickup_time}
                  onChange={(e) => onChange('pickup_time', e.target.value)}
                  className="mt-1"
                  style={inputStyle}
                />
              </div>
            </div>
          )}
        </div>

        {/* Dropoff */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`dropoff-${item.id}`}
              checked={item.dropoff_enabled}
              onCheckedChange={(checked) => onChange('dropoff_enabled', checked)}
            />
            <Label htmlFor={`dropoff-${item.id}`} className="font-medium cursor-pointer">
              Llegada / Destino
            </Label>
          </div>
          {item.dropoff_enabled && (
            <div className="grid gap-3 sm:grid-cols-2 pl-6">
              <div>
                <Label className="text-xs" style={{ color: textLabel }}>Ubicación</Label>
                <Input
                  value={item.dropoff_location}
                  onChange={(e) => onChange('dropoff_location', e.target.value)}
                  placeholder="Ej: Aeropuerto PMI"
                  className="mt-1"
                  style={inputStyle}
                />
              </div>
              <div>
                <Label className="text-xs" style={{ color: textLabel }}>Hora</Label>
                <Input
                  type="time"
                  value={item.dropoff_time}
                  onChange={(e) => onChange('dropoff_time', e.target.value)}
                  className="mt-1"
                  style={inputStyle}
                />
              </div>
            </div>
          )}
        </div>

        {/* Return Trip */}
        <div 
          className="pt-4 space-y-3"
          style={{ borderTop: `1px dashed ${dividerColor}` }}
        >
          <div className="flex items-center gap-2">
            <Checkbox
              id={`return-${item.id}`}
              checked={item.has_return}
              onCheckedChange={(checked) => onChange('has_return', checked)}
            />
            <Label htmlFor={`return-${item.id}`} className="font-medium cursor-pointer flex items-center gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Viaje de vuelta
            </Label>
          </div>

          {item.has_return && (
            <div className="pl-6 space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`return-pickup-${item.id}`}
                    checked={item.return_pickup_enabled}
                    onCheckedChange={(checked) => onChange('return_pickup_enabled', checked)}
                  />
                  <Label htmlFor={`return-pickup-${item.id}`} className="text-sm cursor-pointer">
                    Recogida vuelta
                  </Label>
                </div>
                {item.return_pickup_enabled && (
                  <div className="grid gap-3 sm:grid-cols-2 pl-6">
                    <div>
                      <Label className="text-xs" style={{ color: textLabel }}>Ubicación</Label>
                      <Input
                        value={item.return_pickup_location}
                        onChange={(e) => onChange('return_pickup_location', e.target.value)}
                        placeholder="Ubicación recogida vuelta"
                        className="mt-1"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <Label className="text-xs" style={{ color: textLabel }}>Hora</Label>
                      <Input
                        type="time"
                        value={item.return_pickup_time}
                        onChange={(e) => onChange('return_pickup_time', e.target.value)}
                        className="mt-1"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`return-dropoff-${item.id}`}
                    checked={item.return_dropoff_enabled}
                    onCheckedChange={(checked) => onChange('return_dropoff_enabled', checked)}
                  />
                  <Label htmlFor={`return-dropoff-${item.id}`} className="text-sm cursor-pointer">
                    Llegada vuelta
                  </Label>
                </div>
                {item.return_dropoff_enabled && (
                  <div className="grid gap-3 sm:grid-cols-2 pl-6">
                    <div>
                      <Label className="text-xs" style={{ color: textLabel }}>Ubicación</Label>
                      <Input
                        value={item.return_dropoff_location}
                        onChange={(e) => onChange('return_dropoff_location', e.target.value)}
                        placeholder="Ubicación llegada vuelta"
                        className="mt-1"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <Label className="text-xs" style={{ color: textLabel }}>Hora</Label>
                      <Input
                        type="time"
                        value={item.return_dropoff_time}
                        onChange={(e) => onChange('return_dropoff_time', e.target.value)}
                        className="mt-1"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <Label className="text-xs" style={{ color: textLabel }}>Notas del trayecto</Label>
          <Textarea
            value={item.notes}
            onChange={(e) => onChange('notes', e.target.value)}
            placeholder="Notas adicionales para este trayecto..."
            className="mt-1"
            rows={2}
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  );
}
