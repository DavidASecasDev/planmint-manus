import { Car, Wrench, Calendar, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Repair } from '@/types/garatech';
import { REPAIR_STATUS_LABELS, REPAIR_STATUS_COLORS, REPAIR_TYPE_LABELS } from '@/types/garatech';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RepairDetailHeaderProps {
  repair: Repair;
  onEdit: () => void;
}

export function RepairDetailHeader({ repair, onEdit }: RepairDetailHeaderProps) {
  return (
    <SheetHeader className="space-y-4 pb-4 border-b">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Wrench className="h-5 w-5 text-primary" />
            {repair.repair_number || `Reparación #${repair.id.slice(0, 8)}`}
          </SheetTitle>
          {repair.vehicle && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Car className="h-4 w-4" />
              <span className="font-medium">{repair.vehicle.matricula}</span>
              <span>·</span>
              <span>{repair.vehicle.modelo}</span>
            </div>
          )}
          {repair.workshop && (
            <div className="text-sm text-muted-foreground">
              🏭 {repair.workshop.name}
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onEdit} className="gap-2">
          <Edit2 className="h-4 w-4" />
          Editar
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge className={REPAIR_STATUS_COLORS[repair.status]}>
          {REPAIR_STATUS_LABELS[repair.status]}
        </Badge>
        <Badge variant="outline">
          {REPAIR_TYPE_LABELS[repair.repair_type]}
        </Badge>
        {repair.scheduled_date && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {format(new Date(repair.scheduled_date), 'dd MMM yyyy', { locale: es })}
          </div>
        )}
      </div>
    </SheetHeader>
  );
}
