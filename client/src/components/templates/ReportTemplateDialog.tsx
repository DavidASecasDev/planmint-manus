// Phase 29: Report Template Dialog
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { ReportReason, REPORT_REASON_LABELS } from '@/types/userTemplates';

interface ReportTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: ReportReason, details?: string) => void;
  isSubmitting?: boolean;
}

export const ReportTemplateDialog = ({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: ReportTemplateDialogProps) => {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');

  const handleSubmit = () => {
    if (reason) {
      onSubmit(reason, details.trim() || undefined);
      setReason('');
      setDetails('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Reportar plantilla
          </DialogTitle>
          <DialogDescription>
            Ayúdanos a mantener la comunidad segura reportando contenido inapropiado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo del reporte</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as ReportReason)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un motivo" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {REPORT_REASON_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details">Detalles adicionales (opcional)</Label>
            <Textarea
              id="details"
              placeholder="Describe el problema con más detalle..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!reason || isSubmitting}
            variant="destructive"
          >
            {isSubmitting ? 'Enviando...' : 'Enviar reporte'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
