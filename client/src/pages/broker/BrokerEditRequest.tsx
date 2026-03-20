import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBrokerRequests, useBrokerRequestDetail, UpdateBrokerRequestData } from '@/hooks/useBrokerRequests';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  TransferItemFormCard,
  TransferItemFormData,
  createEmptyItem,
  serializeItems,
} from '@/components/broker/TransferItemFormCard';
import { ArrowLeft, Plus, Loader2, AlertCircle } from 'lucide-react';

/*
 * Azul Cars Brand – Edit Request
 * Navy: #001321 | Gold: oklch(0.72 0.10 80) | Warm bg: #F5F3EF
 * Cards: #FFFFFF | Headings: Montserrat | Body: Barlow
 */

const navy = '#001321';
const gold = 'oklch(0.72 0.10 80)';

export default function BrokerEditRequest() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { broker } = useBrokerAuth();
  const { data: request, isLoading: isLoadingDetail } = useBrokerRequestDetail(id);
  const { updateRequest, isUpdating } = useBrokerRequests();

  const [clientName, setClientName] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<TransferItemFormData[]>([createEmptyItem()]);
  const [initialized, setInitialized] = useState(false);

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
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: navy }} />
      </div>
    );
  }

  // Guard: not pending or not own request
  if (request && (request.status !== 'pendiente' || broker?.id !== request.broker_id)) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-20">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h2
            className="text-xl mb-2"
            style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: '#111827' }}
          >
            No se puede editar esta solicitud
          </h2>
          <p className="mb-4" style={{ color: '#6B7280', fontFamily: 'Barlow, sans-serif' }}>
            Solo se pueden editar solicitudes en estado pendiente que sean tuyas.
          </p>
          <button
            onClick={() => navigate(`/broker/request/${id}`)}
            className="text-sm hover:underline"
            style={{ color: navy, fontFamily: 'Barlow, sans-serif', fontWeight: 500 }}
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

  const handleItemChange = (itemId: string, field: keyof TransferItemFormData, value: any) => {
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
      items: serializeItems(items),
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
          style={{ color: navy, fontFamily: 'Barlow, sans-serif', fontWeight: 500 }}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al detalle
        </button>

        <h1
          className="text-2xl mb-2"
          style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: navy }}
        >
          Editar Solicitud {request?.request_number}
        </h1>
        <div
          className="w-16 h-1 rounded"
          style={{ background: `linear-gradient(90deg, ${gold}, transparent)` }}
        />
      </div>

      <form onSubmit={handleSubmit}>
        {/* Client Info */}
        <div
          className="rounded-lg p-6 mb-6"
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E2DB',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <h2
            className="mb-4"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 700,
              fontSize: '11px',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              color: '#9CA3AF',
            }}
          >
            Información del Cliente
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label
                htmlFor="client_name"
                style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500, color: '#374151' }}
              >
                Nombre del cliente *
              </Label>
              <Input
                id="client_name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ej: Sr. García y familia"
                required
                className="mt-1.5"
                style={{ backgroundColor: '#FFFFFF', color: '#111827', borderColor: '#D1D5DB' }}
              />
            </div>

            <div className="sm:col-span-2">
              <Label
                htmlFor="notes"
                style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500, color: '#374151' }}
              >
                Notas generales
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Instrucciones especiales, preferencias del cliente..."
                className="mt-1.5"
                rows={3}
                style={{ backgroundColor: '#FFFFFF', color: '#111827', borderColor: '#D1D5DB' }}
              />
            </div>
          </div>
        </div>

        {/* Transfer Items */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <h2
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                fontSize: '11px',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: '#9CA3AF',
              }}
            >
              Trayectos ({items.length})
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              className="gap-1"
              style={{
                borderColor: navy,
                color: navy,
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                fontSize: '11px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              <Plus className="h-4 w-4" />
              Añadir trayecto
            </Button>
          </div>

          {items.map((item, index) => (
            <TransferItemFormCard
              key={item.id}
              item={item}
              index={index}
              canRemove={items.length > 1}
              onChange={(field, value) => handleItemChange(item.id, field, value)}
              onRemove={() => handleRemoveItem(item.id)}
              isDark={false}
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
            style={{
              borderColor: '#D1D5DB',
              color: '#6B7280',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 600,
              fontSize: '12px',
            }}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isUpdating || !clientName.trim()}
            className="hover:brightness-110"
            style={{
              backgroundColor: navy,
              color: '#FFFFFF',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 700,
              fontSize: '12px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
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
