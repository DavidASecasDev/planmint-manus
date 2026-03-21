/*
 * Azul Cars Brand — New Request
 * Uses semantic CSS tokens for dark/light mode compatibility
 * bg-background | bg-card | text-foreground | text-muted-foreground
 */
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
          className="flex items-center gap-2 text-sm mb-4 hover:opacity-80 transition-opacity text-foreground"
          style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500 }}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al listado
        </button>

        <h1
          className="text-2xl mb-2 text-foreground"
          style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}
        >
          Nueva Solicitud de Transfer
        </h1>
        <div
          className="w-16 h-1 rounded"
          style={{ background: 'linear-gradient(90deg, oklch(0.72 0.10 80), transparent)' }}
        />
      </div>

      <form onSubmit={handleSubmit}>
        {/* Client Info */}
        <div className="rounded-lg p-6 mb-6 bg-card border border-border">
          <h2
            className="mb-4 text-muted-foreground"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 700,
              fontSize: '11px',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
            }}
          >
            Información del Cliente
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label
                htmlFor="client_name"
                className="text-foreground"
                style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500 }}
              >
                Nombre del cliente *
              </Label>
              <Input
                id="client_name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ej: Sr. García y familia"
                required
                className="mt-1.5 bg-background border-input text-foreground"
              />
            </div>

            <div className="sm:col-span-2">
              <Label
                htmlFor="notes"
                className="text-foreground"
                style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500 }}
              >
                Notas generales
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Instrucciones especiales, preferencias del cliente..."
                className="mt-1.5 bg-background border-input text-foreground"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Transfer Items */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <h2
              className="text-muted-foreground"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                fontSize: '11px',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
              }}
            >
              Trayectos ({items.length})
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              className="gap-1 border-foreground text-foreground"
              style={{
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
            className="border-border text-muted-foreground"
            style={{
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
            className="hover:brightness-110 bg-foreground text-background"
            style={{
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
