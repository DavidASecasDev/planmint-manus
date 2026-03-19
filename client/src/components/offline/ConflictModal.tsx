import { AlertTriangle, Cloud, Smartphone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConflictInfo, ConflictResolution } from '@/hooks/useSyncEngine';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ConflictModalProps {
  conflict: ConflictInfo | null;
  onResolve: (resolution: ConflictResolution) => void;
  onClose: () => void;
}

export const ConflictModal = ({ conflict, onResolve, onClose }: ConflictModalProps) => {
  if (!conflict) return null;

  const getEntityTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      task: 'Tarea',
      area: 'Área',
      tag: 'Etiqueta',
      subtask: 'Subtarea',
      milestone: 'Hito',
    };
    return labels[type] || type;
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "d 'de' MMMM, HH:mm", { locale: es });
  };

  const getDisplayValue = (data: Record<string, unknown>, key: string) => {
    const value = data[key];
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Find different fields
  const allKeys = new Set([
    ...Object.keys(conflict.localData),
    ...Object.keys(conflict.serverData),
  ]);
  
  const differentFields = Array.from(allKeys).filter(key => {
    const localVal = JSON.stringify(conflict.localData[key]);
    const serverVal = JSON.stringify(conflict.serverData[key]);
    return localVal !== serverVal && !['updated_at', 'created_at', 'id'].includes(key);
  });

  return (
    <Dialog open={!!conflict} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Conflicto detectado
          </DialogTitle>
          <DialogDescription>
            Esta {getEntityTypeLabel(conflict.entityType).toLowerCase()} fue modificada mientras estabas offline.
            Elige qué versión quieres mantener.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 my-4">
          <Card className="border-primary/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Tu versión (local)
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Modificada: {formatDate(conflict.localUpdatedAt)}
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {differentFields.map(key => (
                <div key={key} className="text-sm">
                  <span className="font-medium text-muted-foreground">{key}: </span>
                  <span className="text-primary">{getDisplayValue(conflict.localData, key)}</span>
                </div>
              ))}
              {differentFields.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin cambios visibles</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-blue-500/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Cloud className="h-4 w-4" />
                Versión del servidor
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Modificada: {formatDate(conflict.serverUpdatedAt)}
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {differentFields.map(key => (
                <div key={key} className="text-sm">
                  <span className="font-medium text-muted-foreground">{key}: </span>
                  <span className="text-blue-600">{getDisplayValue(conflict.serverData, key)}</span>
                </div>
              ))}
              {differentFields.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin cambios visibles</p>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onResolve('server')}
            className="gap-2"
          >
            <Cloud className="h-4 w-4" />
            Usar versión del servidor
          </Button>
          <Button
            onClick={() => onResolve('local')}
            className="gap-2"
          >
            <Smartphone className="h-4 w-4" />
            Usar mi versión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
