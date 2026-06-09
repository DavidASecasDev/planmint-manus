import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

interface DamageReportFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * This dialog now redirects to the full wizard page for creating damage reports,
 * which includes the before/after photo steps.
 */
export function DamageReportFormDialog({ open, onOpenChange }: DamageReportFormDialogProps) {
  const navigate = useNavigate();

  const handleGoToWizard = () => {
    onOpenChange(false);
    navigate('/garatech/damages/new');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nuevo Informe de Daños</DialogTitle>
          <DialogDescription>
            El formulario de creación incluye pasos para subir fotos del antes y después del daño.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center py-4 gap-3">
          <FileText className="h-10 w-10 text-primary" />
          <p className="text-sm text-muted-foreground text-center">
            Se abrirá el asistente completo con todos los pasos necesarios.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleGoToWizard}>Continuar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
