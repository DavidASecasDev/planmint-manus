import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, Truck, Package, Car, Sparkles, User, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { VehicleMovement, MovementType } from '@/hooks/useMovements';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const TYPE_CONFIG: Record<MovementType, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  entrega: { label: 'Entrega', icon: Truck, color: 'text-primary', bgColor: 'bg-primary/10' },
  recogida: { label: 'Recogida', icon: Package, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/10' },
  escoba: { label: 'Escoba', icon: Car, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10' },
  limpieza: { label: 'Limpieza', icon: Sparkles, color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-500/10' },
};

interface MovementKanbanCardProps {
  movement: VehicleMovement;
  canDrag: boolean;
}

export function MovementKanbanCard({ movement, canDrag }: MovementKanbanCardProps) {
  const navigate = useNavigate();
  const typeConf = TYPE_CONFIG[movement.movement_type];
  const TypeIcon = typeConf.icon;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: movement.id,
    data: { movement },
    disabled: !canDrag,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'cursor-pointer border hover-lift',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary/30'
      )}
      onClick={() => navigate(`/movements/${movement.id}`)}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          {canDrag && (
            <div
              {...attributes}
              {...listeners}
              className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4" />
            </div>
          )}
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', typeConf.bgColor)}>
            <TypeIcon className={cn('h-4 w-4', typeConf.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-sm tracking-wider text-foreground">
                {movement.matricula}
              </span>
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                {typeConf.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
              <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {format(new Date(movement.started_at), "dd MMM HH:mm", { locale: es })}
              </span>
              {movement.driver?.name && (
                <span className="flex items-center gap-0.5 truncate">
                  <User className="h-3 w-3 shrink-0" />
                  {movement.driver.name}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
