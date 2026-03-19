import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MapPin, Clock, Car, User, FileText, Phone } from 'lucide-react';
import { OperationBadge } from './OperationBadge';
import { LegCard } from './LegCard';
import { useOperationLegs } from '@/hooks/useOperationLegs';
import { Skeleton } from '@/components/ui/skeleton';
import type { TaskWithRelations } from '@/types/tasks';
import type { OperationType, LocationType } from '@/types/operations';
import { LOCATION_TYPE_OPTIONS } from '@/types/operations';

interface OperationDetailPanelProps {
  task: TaskWithRelations & {
    operation_type?: OperationType | null;
    scheduled_at?: string | null;
    location_type?: LocationType | null;
    location_text?: string | null;
    location_notes?: string | null;
    reservation_ref?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    vehicle_out_id?: string | null;
    vehicle_in_id?: string | null;
  };
}

export function OperationDetailPanel({ task }: OperationDetailPanelProps) {
  const {
    legs,
    primaryLeg,
    supportLeg,
    isLoading,
    startLeg,
    completeLeg,
    reportIssue,
    updateChecklist,
  } = useOperationLegs(task.id);

  if (!task.operation_type) {
    return null;
  }

  const locationLabel = LOCATION_TYPE_OPTIONS.find(
    (opt) => opt.value === task.location_type
  )?.label;

  return (
    <div className="space-y-4">
      {/* Operation Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Detalles de Operación</CardTitle>
            <OperationBadge operationType={task.operation_type} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Schedule */}
          {task.scheduled_at && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Programado:</span>
              <span>
                {new Date(task.scheduled_at).toLocaleString('es-ES', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>
          )}

          {/* Location */}
          {(task.location_type || task.location_text) && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <span className="font-medium">Ubicación:</span>
                {locationLabel && (
                  <span className="ml-1 text-muted-foreground">
                    ({locationLabel})
                  </span>
                )}
                {task.location_text && (
                  <p className="text-muted-foreground">{task.location_text}</p>
                )}
                {task.location_notes && (
                  <p className="text-xs text-muted-foreground italic">
                    {task.location_notes}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Vehicles */}
          {(task.vehicle_out_id || task.vehicle_in_id) && (
            <div className="flex items-start gap-2 text-sm">
              <Car className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                {task.vehicle_out_id && (
                  <p>
                    <span className="font-medium">Vehículo a entregar:</span>{' '}
                    <span className="text-muted-foreground">
                      {task.vehicle_out_id}
                    </span>
                  </p>
                )}
                {task.vehicle_in_id && (
                  <p>
                    <span className="font-medium">Vehículo a recoger:</span>{' '}
                    <span className="text-muted-foreground">
                      {task.vehicle_in_id}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Customer */}
          {task.customer_name && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Cliente:</span>
              <span>{task.customer_name}</span>
            </div>
          )}

          {task.customer_phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Teléfono:</span>
              <span>{task.customer_phone}</span>
            </div>
          )}

          {/* Reservation */}
          {task.reservation_ref && (
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Ref. Reserva:</span>
              <span className="font-mono">{task.reservation_ref}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Legs Section */}
      <div className="space-y-4">
        <h3 className="font-semibold">Operarios</h3>
        
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        ) : legs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay operarios asignados a esta operación.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {primaryLeg && (
              <LegCard
                leg={primaryLeg}
                onStart={startLeg}
                onComplete={completeLeg}
                onReportIssue={reportIssue}
                onChecklistChange={updateChecklist}
              />
            )}
            {supportLeg && (
              <LegCard
                leg={supportLeg}
                onStart={startLeg}
                onComplete={completeLeg}
                onReportIssue={reportIssue}
                onChecklistChange={updateChecklist}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
