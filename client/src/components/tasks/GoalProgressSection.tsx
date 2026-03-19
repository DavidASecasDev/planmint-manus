import { useState, useEffect } from 'react';
import { Target, Plus, Minus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { TaskWithRelations, TaskUpdate } from '@/types/tasks';
import { useTaskUpdates } from '@/hooks/useTaskUpdates';
import { cn } from '@/lib/utils';

interface GoalProgressSectionProps {
  task: TaskWithRelations;
  canEdit: boolean;
}

export function GoalProgressSection({ task, canEdit }: GoalProgressSectionProps) {
  const { updates, totalValue, loading, fetchUpdates, addUpdate, deleteUpdate } = useTaskUpdates(task.id);
  const [incrementValue, setIncrementValue] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  if (task.type !== 'goal_numeric' || !task.goal_target_value || !task.goal_unit) {
    return null;
  }

  const targetValue = task.goal_target_value;
  const unit = task.goal_unit;
  const remaining = targetValue - totalValue;
  const progressPercent = Math.min(100, Math.max(0, (totalValue / targetValue) * 100));
  const isCompleted = totalValue >= targetValue;

  const handleAddUpdate = async () => {
    const value = parseFloat(incrementValue);
    if (isNaN(value) || value === 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await addUpdate({
        task_id: task.id,
        text: note || undefined,
        goal_increment_value: value,
      });
      setIncrementValue('');
      setNote('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatValue = (value: number) => {
    return value.toLocaleString('es-ES', { maximumFractionDigits: 2 });
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5 text-primary" />
          Objetivo numérico
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Summary */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progreso</span>
            <span className="font-medium">
              {progressPercent.toFixed(1)}%
              {isCompleted && (
                <Badge variant="default" className="ml-2 bg-green-600">
                  ¡Superado!
                </Badge>
              )}
            </span>
          </div>
          <Progress value={progressPercent} className="h-3" />
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-md bg-background p-2">
              <p className="text-muted-foreground text-xs">Objetivo</p>
              <p className="font-semibold text-primary">
                {formatValue(targetValue)} {unit}
              </p>
            </div>
            <div className="rounded-md bg-background p-2">
              <p className="text-muted-foreground text-xs">Acumulado</p>
              <p className="font-semibold text-green-600">
                {formatValue(totalValue)} {unit}
              </p>
            </div>
            <div className="rounded-md bg-background p-2">
              <p className="text-muted-foreground text-xs">Restante</p>
              <p className={cn('font-semibold', remaining <= 0 ? 'text-green-600' : 'text-orange-600')}>
                {formatValue(Math.max(0, remaining))} {unit}
              </p>
            </div>
          </div>
        </div>

        {/* Add Update Form */}
        {canEdit && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Añadir aporte</h4>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type="number"
                    step="any"
                    placeholder="Cantidad"
                    value={incrementValue}
                    onChange={(e) => setIncrementValue(e.target.value)}
                    className="pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    {unit}
                  </span>
                </div>
              </div>
              <Textarea
                placeholder="Nota opcional (ej: Nómina de diciembre)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="resize-none"
              />
              <Button
                onClick={handleAddUpdate}
                disabled={isSubmitting || !incrementValue}
                size="sm"
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Añadiendo...' : 'Añadir aporte'}
              </Button>
            </div>
          </>
        )}

        {/* Updates History */}
        {updates.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Historial de aportes</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {updates.map((update) => (
                  <UpdateItem
                    key={update.id}
                    update={update}
                    unit={unit}
                    canDelete={canEdit}
                    onDelete={deleteUpdate}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {!loading && updates.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Aún no hay aportes registrados
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface UpdateItemProps {
  update: TaskUpdate;
  unit: string;
  canDelete: boolean;
  onDelete: (id: string) => void;
}

function UpdateItem({ update, unit, canDelete, onDelete }: UpdateItemProps) {
  const value = update.goal_increment_value || 0;
  const isPositive = value >= 0;

  return (
    <div className="flex items-start gap-2 p-2 rounded-md bg-background text-sm">
      <div
        className={cn(
          'flex items-center justify-center h-6 w-6 rounded-full shrink-0',
          isPositive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
        )}
      >
        {isPositive ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('font-medium', isPositive ? 'text-green-600' : 'text-red-600')}>
            {isPositive ? '+' : ''}
            {value.toLocaleString('es-ES', { maximumFractionDigits: 2 })} {unit}
          </span>
          <span className="text-muted-foreground text-xs">
            · {format(new Date(update.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
          </span>
        </div>
        {update.text && <p className="text-muted-foreground truncate">{update.text}</p>}
        <p className="text-xs text-muted-foreground">{update.user?.name || 'Usuario'}</p>
      </div>
      {canDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
              <Trash2 className="h-3 w-3 text-muted-foreground" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar aporte?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará el aporte de {value.toLocaleString('es-ES')} {unit}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(update.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
