import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrokerRequests, CreateBrokerRequestData } from '@/hooks/useBrokerRequests';
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
import { ArrowLeft, Plus, Loader2 } from 'lucide-react';

/*
 * Azul Cars Brand – New Request
 * Navy: #001321 | Gold: oklch(0.72 0.10 80) | Warm bg: #F5F3EF
 * Cards: #FFFFFF | Headings: Montserrat | Body: Barlow
 */

const navy = '#001321';
const gold = 'oklch(0.72 0.10 80)';

export default function BrokerNewRequest() {
  const navigate = useNavigate();
  const { createRequest, isCreating } = useBrokerRequests();

  const [clientName, setClientName] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<TransferItemFormData[]>([createEmptyItem()]);

  const handleAddItem = () => {
    setItems(prev => [...prev, createEmptyItem()]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof TransferItemFormData, value: any) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;

    const data: CreateBrokerRequestData = {
      client_name: clientName.trim(),
      notes: notes.trim() || undefined,
      items: serializeItems(items),
    };

    try {
      await createRequest(data);
      navigate('/broker');
    } catch (error) {
      // Error handled by hook
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/broker')}
          className="flex items-center gap-2 text-sm mb-4 hover:opacity-80 transition-opacity"
          style={{ color: navy, fontFamily: 'Barlow, sans-serif', fontWeight: 500 }}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al listado
        </button>

        <h1
          className="text-2xl mb-2"
          style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: navy }}
        >
          Nueva Solicitud de Transfer
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
            onClick={() => navigate('/broker')}
            disabled={isCreating}
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
            disabled={isCreating || !clientName.trim()}
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
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              'Crear Solicitud'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
