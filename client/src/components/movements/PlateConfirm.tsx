import { useState, useEffect, forwardRef } from 'react';
import { Check, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface PlateConfirmProps {
  detectedPlate: string;
  onConfirm: (plate: string) => void;
  ocrSuccess: boolean;
}

export const PlateConfirm = forwardRef<HTMLDivElement, PlateConfirmProps>(
  function PlateConfirm({ detectedPlate, onConfirm, ocrSuccess }, ref) {
    const [plate, setPlate] = useState(detectedPlate);
    const [isEditing, setIsEditing] = useState(!ocrSuccess);

    // Sync internal state when props change (e.g. after restoration)
    useEffect(() => {
      setPlate(detectedPlate);
      setIsEditing(!ocrSuccess);
    }, [detectedPlate, ocrSuccess]);

    return (
      <div ref={ref} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Matrícula detectada</h3>
          {ocrSuccess ? (
            <Badge variant="secondary" className="text-xs">OCR automático</Badge>
          ) : (
            <Badge variant="destructive" className="text-xs">Entrada manual</Badge>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <Input
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="Ej: 1234 ABC"
              className="text-center text-2xl font-mono font-bold tracking-[0.2em] h-16 border-2"
              autoFocus
            />
            <Button
              type="button"
              onClick={() => {
                if (plate.trim()) {
                  onConfirm(plate.trim());
                }
              }}
              className="w-full h-12"
              disabled={!plate.trim()}
            >
              <Check className="h-4 w-4 mr-2" />
              Confirmar matrícula
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-stretch rounded-lg border-2 border-primary overflow-hidden bg-background mx-auto max-w-xs">
              <div className="w-10 bg-primary flex items-center justify-center shrink-0">
                <span className="text-primary-foreground text-xs font-bold">E</span>
              </div>
              <div className="flex-1 flex items-center justify-center py-3 px-4">
                <span className="text-2xl font-mono font-bold tracking-[0.15em]">{plate}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setIsEditing(true)} className="flex-1 h-12">
                <Edit2 className="h-4 w-4 mr-2" />
                Corregir
              </Button>
              <Button type="button" onClick={() => onConfirm(plate)} className="flex-1 h-12">
                <Check className="h-4 w-4 mr-2" />
                Confirmar
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }
);
