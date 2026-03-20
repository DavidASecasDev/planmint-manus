import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrokerRequests, CreateBrokerRequestData } from '@/hooks/useBrokerRequests';
import { useBrokerTheme } from '@/contexts/BrokerThemeContext';
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

export default function BrokerNewRequest() {
  const navigate = useNavigate();
  const { createRequest, isCreating } = useBrokerRequests();
  const { resolvedTheme } = useBrokerTheme();
  const isDark = resolvedTheme === 'dark';

  const [clientName, setClientName] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<TransferItemFormData[]>([createEmptyItem()]);

  // Azul Cars brand
  const cardBg = isDark ? '#161B22' : '#ffffff';
  const cardBorder = isDark ? 'rgba(163, 230, 53, 0.12)' : '#e2e8f0';
  const titleColor = isDark ? '#E6EDF3' : '#1a365d';
  const accentColor = isDark ? '#A3E635' : '#b8860b';
  const inputStyle = !isDark
    ? { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#d1d5db' }
    : { backgroundColor: '#0D1117', color: '#E6EDF3', borderColor: 'rgba(163, 230, 53, 0.2)' };

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
          style={{ color: accentColor }}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al listado
        </button>

        <h1
          className="text-2xl font-bold uppercase tracking-wider mb-1"
          style={{ color: titleColor }}
        >
          Nueva Solicitud de Transfer
        </h1>
        <div
          className="w-20 h-[2px] rounded"
          style={{ background: `linear-gradient(90deg, ${accentColor}, transparent)` }}
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
              style={{ borderColor: accentColor, color: accentColor }}
            >
              <Plus className="h-4 w-4 mr-1" />
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
              isDark={isDark}
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
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isCreating || !clientName.trim()}
            className="font-bold uppercase text-sm tracking-wider hover:brightness-110"
            style={{ backgroundColor: '#A3E635', color: '#0D1117' }}
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
