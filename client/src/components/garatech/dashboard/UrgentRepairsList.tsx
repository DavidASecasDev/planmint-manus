import { useNavigate } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import { AlertCircle, Car, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { REPAIR_STATUS_LABELS, type Repair } from '@/types/garatech';

interface UrgentRepairsListProps {
  repairs: Repair[];
}

export function UrgentRepairsList({ repairs }: UrgentRepairsListProps) {
  const navigate = useNavigate();

  if (repairs.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Reparaciones Urgentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">No hay reparaciones urgentes</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          Reparaciones Urgentes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {repairs.map((repair) => {
          const daysWaiting = differenceInDays(new Date(), new Date(repair.created_at));
          return (
            <div
              key={repair.id}
              className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
              onClick={() => navigate('/garatech/repairs')}
            >
              <Car className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {repair.vehicle?.matricula || 'Sin vehículo'}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-xs">
                    {REPAIR_STATUS_LABELS[repair.status]}
                  </Badge>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {daysWaiting} días
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
