import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Car, Calendar, Wrench } from 'lucide-react';
import type { Workshop, Repair } from '@/types/garatech';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface WorkshopHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workshop: Workshop | null;
  repairs: Repair[];
}

const STATUS_LABELS: Record<string, string> = {
  pendiente_aprobacion: 'Pendiente',
  en_taller: 'En Taller',
  esperando_piezas: 'Esperando',
  listo_recoger: 'Listo',
  finalizado: 'Finalizado',
};

const STATUS_COLORS: Record<string, string> = {
  pendiente_aprobacion: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  en_taller: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  esperando_piezas: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  listo_recoger: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  finalizado: 'bg-muted text-muted-foreground',
};

const TYPE_LABELS: Record<string, string> = {
  mantenimiento: 'Mantenimiento',
  reparacion: 'Reparación',
  revision: 'Revisión',
  itv: 'ITV',
  accidente: 'Accidente',
};

export function WorkshopHistorySheet({ 
  open, 
  onOpenChange, 
  workshop, 
  repairs 
}: WorkshopHistorySheetProps) {
  if (!workshop) return null;

  const workshopRepairs = repairs
    .filter(r => r.workshop_id === workshop.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Historial: {workshop.name}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 mt-4 -mx-6 px-6">
          {workshopRepairs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wrench className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Sin reparaciones</p>
              <p className="text-sm">Este taller no tiene reparaciones registradas</p>
            </div>
          ) : (
            <div className="space-y-3 pb-6">
              {workshopRepairs.map((repair) => (
                <div 
                  key={repair.id} 
                  className="p-4 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">
                        {repair.vehicle?.matricula || 'Sin vehículo'}
                      </span>
                    </div>
                    <Badge className={`text-xs ${STATUS_COLORS[repair.status] || ''}`}>
                      {STATUS_LABELS[repair.status] || repair.status}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                    {repair.description}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(repair.created_at), "d MMM yyyy", { locale: es })}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {TYPE_LABELS[repair.repair_type] || repair.repair_type}
                      </Badge>
                    </div>
                    {(repair.cost_final || repair.cost_estimate) && (
                      <span className="font-medium text-foreground">
                        {(repair.cost_final || repair.cost_estimate)?.toLocaleString()}€
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
