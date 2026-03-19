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
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, Eye, CheckCircle, Trash2, Clock, Building2, User } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface FeedbackDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feedback: {
    id: string;
    message: string;
    feedback_type: string;
    created_at: string;
    read_at?: string | null;
    resolved_at?: string | null;
    internal_notes?: string | null;
    profiles?: { name: string | null } | null;
    organizations?: { name: string } | null;
  } | null;
  onMarkRead: () => void;
  onMarkResolved: () => void;
  onUpdateNotes: (notes: string) => void;
  onDelete: () => void;
  isLoading?: boolean;
}

export function FeedbackDetailDialog({
  open,
  onOpenChange,
  feedback,
  onMarkRead,
  onMarkResolved,
  onUpdateNotes,
  onDelete,
  isLoading,
}: FeedbackDetailDialogProps) {
  const [notes, setNotes] = useState(feedback?.internal_notes || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!feedback) return null;

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'bug':
        return <Badge variant="destructive">Bug</Badge>;
      case 'suggestion':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Sugerencia</Badge>;
      case 'question':
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">Pregunta</Badge>;
      case 'praise':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Elogio</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const handleSaveNotes = () => {
    if (notes !== feedback.internal_notes) {
      onUpdateNotes(notes);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">
                Detalle de Feedback
                {getTypeBadge(feedback.feedback_type)}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <Clock className="h-3 w-3" />
                {format(new Date(feedback.created_at), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status badges */}
          <div className="flex gap-2">
            {feedback.read_at ? (
              <Badge variant="outline" className="gap-1">
                <Eye className="h-3 w-3" /> Leído
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">Nuevo</Badge>
            )}
            {feedback.resolved_at && (
              <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/20">
                <CheckCircle className="h-3 w-3" /> Resuelto
              </Badge>
            )}
          </div>

          {/* Meta info */}
          <div className="flex gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              {feedback.organizations?.name || 'Org desconocida'}
            </div>
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {feedback.profiles?.name || 'Usuario desconocido'}
            </div>
          </div>

          <Separator />

          {/* Message */}
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-sm whitespace-pre-wrap">{feedback.message}</p>
          </div>

          <Separator />

          {/* Internal notes */}
          <div className="space-y-2">
            <Label>Notas internas (solo visibles para super admins)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Añade notas sobre este feedback..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 flex-1">
            {!feedback.read_at && (
              <Button variant="outline" size="sm" onClick={onMarkRead} disabled={isLoading}>
                <Eye className="h-4 w-4 mr-1" />
                Marcar leído
              </Button>
            )}
            {!feedback.resolved_at && (
              <Button variant="outline" size="sm" onClick={onMarkResolved} disabled={isLoading}>
                <CheckCircle className="h-4 w-4 mr-1" />
                Resolver
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {showDeleteConfirm ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                  Cancelar
                </Button>
                <Button variant="destructive" size="sm" onClick={onDelete} disabled={isLoading}>
                  Confirmar eliminar
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button onClick={handleSaveNotes} disabled={isLoading || notes === feedback.internal_notes}>
                  {isLoading ? 'Guardando...' : 'Guardar notas'}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
