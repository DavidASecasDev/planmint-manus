import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Wrench, AlertTriangle, Calendar, Euro, Building, ExternalLink } from 'lucide-react';
import { REPAIR_STATUS_LABELS, REPAIR_STATUS_COLORS, REPAIR_TYPE_LABELS } from '@/types/garatech';
import type { RepairStatus, RepairType } from '@/types/garatech';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface VehicleRepairSummaryProps {
  vehicleId: string;
}

interface VehicleRepair {
  id: string;
  repair_number: string | null;
  status: RepairStatus;
  repair_type: RepairType;
  description: string;
  cost_estimate: number | null;
  cost_final: number | null;
  created_at: string;
  completed_at: string | null;
  workshop: { name: string } | null;
}

interface VehicleAccident {
  id: string;
  accident_number: string | null;
  accident_date: string;
  severity: string;
  status: string;
  description: string;
}

export function VehicleRepairSummary({ vehicleId }: VehicleRepairSummaryProps) {
  const { profile } = useAuth();
  const { hasPermission, isLoading: permLoading } = usePermissions();
  const canViewGaratech = !permLoading && hasPermission('garatech.view');
  const orgId = profile?.organization_id;

  const { data: repairs = [], isLoading: repairsLoading } = useQuery({
    queryKey: ['vehicle-repairs', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('repairs')
        .select('id, repair_number, status, repair_type, description, cost_estimate, cost_final, created_at, completed_at, workshop:workshops(name)')
        .eq('vehicle_id', vehicleId)
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || []) as VehicleRepair[];
    },
    enabled: !!vehicleId && !!orgId && canViewGaratech,
  });

  const { data: accidents = [], isLoading: accidentsLoading } = useQuery({
    queryKey: ['vehicle-accidents', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accidents')
        .select('id, accident_number, accident_date, severity, status, description')
        .eq('vehicle_id', vehicleId)
        .eq('organization_id', orgId!)
        .order('accident_date', { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || []) as VehicleAccident[];
    },
    enabled: !!vehicleId && !!orgId && canViewGaratech,
  });

  if (!canViewGaratech) return null;

  const isLoading = repairsLoading || accidentsLoading;
  const hasData = repairs.length > 0 || accidents.length > 0;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <Wrench className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Sin historial de reparaciones o accidentes</p>
      </div>
    );
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'leve':
        return <Badge variant="outline" className="text-xs border-green-500/30 text-green-600 dark:text-green-400">Leve</Badge>;
      case 'moderado':
        return <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-600 dark:text-amber-400">Moderado</Badge>;
      case 'grave':
        return <Badge variant="outline" className="text-xs border-red-500/30 text-red-600 dark:text-red-400">Grave</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{severity}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Repairs */}
      {repairs.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-medium">Reparaciones ({repairs.length})</h4>
          </div>
          <div className="space-y-2">
            {repairs.map((repair) => {
              const cost = repair.cost_final || repair.cost_estimate;
              return (
                <a
                  key={repair.id}
                  href={`/garatech/repairs/${repair.id}`}
                  className={cn(
                    'block p-3 rounded-lg border border-border/50 bg-card',
                    'hover:bg-muted/30 hover:border-border transition-colors group'
                  )}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {repair.repair_number && (
                        <span className="text-xs font-mono text-muted-foreground">{repair.repair_number}</span>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {REPAIR_TYPE_LABELS[repair.repair_type]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge className={cn('text-xs', REPAIR_STATUS_COLORS[repair.status])}>
                        {REPAIR_STATUS_LABELS[repair.status]}
                      </Badge>
                      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1 mb-1.5">{repair.description}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(repair.created_at), 'd MMM yyyy', { locale: es })}
                    </span>
                    {repair.workshop?.name && (
                      <span className="flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        {repair.workshop.name}
                      </span>
                    )}
                    {cost != null && cost > 0 && (
                      <span className="flex items-center gap-1 font-mono">
                        <Euro className="h-3 w-3" />
                        {cost.toLocaleString('es-ES')}€
                      </span>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {repairs.length > 0 && accidents.length > 0 && <Separator />}

      {/* Accidents */}
      {accidents.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h4 className="text-sm font-medium">Accidentes ({accidents.length})</h4>
          </div>
          <div className="space-y-2">
            {accidents.map((accident) => (
              <a
                key={accident.id}
                href={`/garatech/accidents/${accident.id}`}
                className={cn(
                  'block p-3 rounded-lg border border-border/50 bg-card',
                  'hover:bg-muted/30 hover:border-border transition-colors group'
                )}
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    {accident.accident_number && (
                      <span className="text-xs font-mono text-muted-foreground">{accident.accident_number}</span>
                    )}
                    {getSeverityBadge(accident.severity)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs capitalize">{accident.status}</Badge>
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1 mb-1.5">{accident.description}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(accident.accident_date), 'd MMM yyyy', { locale: es })}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
