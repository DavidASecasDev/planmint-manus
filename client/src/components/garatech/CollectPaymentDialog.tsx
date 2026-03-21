import { useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDamageReports } from '@/hooks/useDamageReports';
import type { DamageReport } from '@/types/garatech';

interface CollectPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: DamageReport;
}

export function CollectPaymentDialog({ open, onOpenChange, report }: CollectPaymentDialogProps) {
  const { collectPayment } = useDamageReports();
  const [amount, setAmount] = useState(report.total_amount?.toString() || '0');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [gateway, setGateway] = useState<'stripe' | 'redsys' | ''>('');
  const [paymentRef, setPaymentRef] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gateway || !paymentRef.trim()) return;
    
    await collectPayment.mutateAsync({
      id: report.id,
      data: {
        amount_collected: parseFloat(amount) || 0,
        collected_at: date,
        collection_notes: notes || undefined,
        payment_gateway: gateway,
        payment_reference: paymentRef.trim(),
      },
    });

    onOpenChange(false);
  };

  const difference = (report.total_amount || 0) - (parseFloat(amount) || 0);
  const isFormValid = !!gateway && !!paymentRef.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Cobro</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-muted rounded-lg text-sm">
            <p className="text-muted-foreground">Informe: <span className="font-mono font-medium text-foreground">{report.report_number}</span></p>
            <p className="text-muted-foreground">Total a cobrar: <span className="font-mono font-medium text-foreground">{(report.total_amount || 0).toLocaleString('es-ES')}€</span></p>
          </div>

          <div className="space-y-2">
            <Label>Pasarela de pago</Label>
            <ToggleGroup
              type="single"
              value={gateway}
              onValueChange={(val) => { if (val) setGateway(val as 'stripe' | 'redsys'); }}
              className="justify-start"
            >
              <ToggleGroupItem value="stripe" className="px-5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                Stripe
              </ToggleGroupItem>
              <ToggleGroupItem value="redsys" className="px-5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                Redsys
              </ToggleGroupItem>
            </ToggleGroup>
            {!gateway && <p className="text-xs text-muted-foreground">Selecciona la pasarela utilizada</p>}
          </div>

          {gateway && (
            <div className="space-y-2">
              <Label htmlFor="paymentRef">
                {gateway === 'stripe' ? 'ID de pago (Payment Intent)' : 'Código de autorización'}
              </Label>
              <Input
                id="paymentRef"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder={gateway === 'stripe' ? 'pi_3Abc123...' : 'Ej: 123456'}
                className="font-mono"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">Monto cobrado (€)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono"
            />
            {difference !== 0 && (
              <p className={`text-xs ${difference > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                {difference > 0 
                  ? `Descuento de ${difference.toLocaleString('es-ES')}€`
                  : `Sobrecargo de ${Math.abs(difference).toLocaleString('es-ES')}€`
                }
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Fecha del cobro</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones adicionales..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={collectPayment.isPending || !isFormValid}>
              {collectPayment.isPending ? 'Guardando...' : 'Registrar Cobro'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
