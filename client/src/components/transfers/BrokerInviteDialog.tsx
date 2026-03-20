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
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Check, Link2, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { buildBrokerInviteLink } from '@/lib/brokerInvite';
import { toast } from 'sonner';

interface BrokerInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BrokerInviteDialog({ open, onOpenChange }: BrokerInviteDialogProps) {
  const { organization } = useAuth();
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    if (!organization?.id) {
      toast.error('No se pudo obtener la organización');
      return;
    }

    const link = buildBrokerInviteLink(organization.id);
    setInviteLink(link);
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success('Enlace copiado al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = inviteLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      toast.success('Enlace copiado');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setInviteLink(null);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
        } else {
          onOpenChange(true);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invitar Broker
          </DialogTitle>
          <DialogDescription>
            Genera un enlace de invitación para que un nuevo broker pueda solicitar acceso
            a <strong>{organization?.name || 'tu organización'}</strong>.
          </DialogDescription>
        </DialogHeader>

        {!inviteLink ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border p-4 space-y-2" style={{ backgroundColor: '#FAFAF8' }}>
              <p className="text-sm text-muted-foreground">
                Al generar el enlace, el broker podrá:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Rellenar un formulario de solicitud de acceso</li>
                <li>La solicitud aparecerá en la pestaña "Solicitudes" para su revisión</li>
                <li>Podrás aprobar o rechazar la solicitud desde aquí</li>
              </ul>
            </div>

            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleGenerate}>
                <Link2 className="h-4 w-4 mr-2" />
                Generar Enlace
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                Enlace de invitación generado para <strong>{organization?.name}</strong>.
                Compártelo con el broker que deseas invitar.
              </AlertDescription>
            </Alert>

            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={inviteLink}
                className="font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              El enlace es válido mientras la organización esté activa. Cada broker que lo use
              deberá ser aprobado manualmente.
            </p>

            <DialogFooter>
              <Button onClick={handleClose}>Cerrar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
