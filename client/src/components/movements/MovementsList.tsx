import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MapPin, Clock, ArrowRight, Truck, Package, Car, Route, Sparkles, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { VehicleMovement, MovementType, MovementStatus } from '@/hooks/useMovements';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const TYPE_CONFIG: Record<MovementType, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  entrega: { label: 'Entrega', icon: Truck, color: 'text-primary', bgColor: 'bg-primary/10' },
  recogida: { label: 'Recogida', icon: Package, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/10' },
  escoba: { label: 'Escoba', icon: Car, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10' },
  limpieza: { label: 'Limpieza', icon: Sparkles, color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-500/10' },
};

const STATUS_CONFIG: Record<MovementStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  en_curso: { label: 'En curso', variant: 'default' },
  completado: { label: 'Completado', variant: 'secondary' },
  cancelado: { label: 'Cancelado', variant: 'destructive' },
};

interface MovementsListProps {
  movements: VehicleMovement[];
  isLoading: boolean;
}

export function MovementsList({ movements, isLoading }: MovementsListProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-xl border border-border bg-muted/20 h-[76px]" />
        ))}
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
          <Route className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-foreground">Sin movimientos</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Crea tu primer movimiento para empezar a registrar entregas y recogidas
          </p>
        </div>
        <Button onClick={() => navigate('/movements/new')} size="sm">
          Nuevo movimiento
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {movements.map((m) => {
        const typeConf = TYPE_CONFIG[m.movement_type];
        const statusConf = STATUS_CONFIG[m.status];
        const TypeIcon = typeConf.icon;

        return (
          <Card
            key={m.id}
            className="cursor-pointer hover-lift border"
            onClick={() => navigate(`/movements/${m.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                  typeConf.bgColor
                )}>
                  <TypeIcon className={cn('h-5 w-5', typeConf.color)} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-base tracking-wider text-foreground">
                      {m.matricula}
                    </span>
                    <Badge variant={statusConf.variant} className="text-[10px] px-1.5 py-0">
                      {statusConf.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(m.started_at), "dd MMM HH:mm", { locale: es })}
                    </span>
                    {m.ended_at && (
                      <>
                        <ArrowRight className="h-3 w-3" />
                        <span>{format(new Date(m.ended_at), "HH:mm", { locale: es })}</span>
                      </>
                    )}
                    {m.driver?.name && (
                      <span className="flex items-center gap-1 truncate max-w-[120px]">
                        <User className="h-3 w-3 shrink-0" />
                        {m.driver.name}
                      </span>
                    )}
                    {m.start_lat && (
                      <MapPin className="h-3 w-3 shrink-0" />
                    )}
                  </div>
                </div>

                <Badge variant="outline" className="text-xs shrink-0 hidden sm:flex">
                  {typeConf.label}
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
