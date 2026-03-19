import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useFeedback } from '@/hooks/useFeedback';
import { MessageSquare, Loader2 } from 'lucide-react';

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const [feedbackType, setFeedbackType] = useState<'suggestion' | 'problem' | 'other'>('suggestion');
  const [message, setMessage] = useState('');
  const { submitFeedback } = useFeedback();

  const handleSubmit = async () => {
    if (!message.trim()) return;

    await submitFeedback.mutateAsync({ feedbackType, message });
    setMessage('');
    setFeedbackType('suggestion');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Enviar feedback
          </DialogTitle>
          <DialogDescription>
            Tu opinión nos ayuda a mejorar la aplicación
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="feedback-type">Tipo de feedback</Label>
            <Select
              value={feedbackType}
              onValueChange={(value: 'suggestion' | 'problem' | 'other') =>
                setFeedbackType(value)
              }
            >
              <SelectTrigger id="feedback-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="suggestion">💡 Sugerencia</SelectItem>
                <SelectItem value="problem">🐛 Problema</SelectItem>
                <SelectItem value="other">💬 Otra cosa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensaje</Label>
            <Textarea
              id="message"
              placeholder="Cuéntanos qué piensas..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!message.trim() || submitFeedback.isPending}
          >
            {submitFeedback.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Enviar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
