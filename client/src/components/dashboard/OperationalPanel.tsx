import { useOperationalDashboard } from '@/hooks/useOperationalDashboard';
import { useRentlySyncContextSafe } from '@/contexts/RentlySyncContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import {
  Car, CalendarCheck, ArrowRightLeft, Wrench, FileText,
  ArrowRight, RefreshCw, TrendingUp, TrendingDown, AlertTriangle,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  sucio: 'bg-red-500',
  incompleto: 'bg-orange-500',
  limpio: 'bg-green-500',
  en_servicio: 'bg-purple-500',
  alquilado: 'bg-blue-500',
};

const STATUS_LABELS: Record<string, string> = {
  sucio: 'Sucio',
  incompleto: 'Incompleto',
  limpio: 'Limpio',
  en_servicio: 'En Servicio',
  alquilado: 'Alquilado',
};

export function OperationalPanel() {
  const { stats, isLoading } = useOperationalDashboard();
  const rentlyCtx = useRentlySyncContextSafe();
  const navigate = useNavigate();

  if (isLoading || !stats) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  const availableVehicles = stats.vehiclesByStatus.limpio;
  const needsPrep = stats.vehiclesByStatus.sucio + stats.vehiclesByStatus.incompleto;

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Panel Operativo
        </h3>
        {rentlyCtx?.isConfigured && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => rentlyCtx.syncRently(false)}
            disabled={rentlyCtx.syncing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${rentlyCtx.syncing ? 'animate-spin' : ''}`} />
            Sincronizar Rently
          </Button>
        )}
      </div>

      {/* Vehicle Status Bar */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Estado de Flota · {stats.totalVehicles} vehículos
            </CardTitle>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => navigate('/vehicle-status')}>
              Ver detalle <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          {/* Status bar */}
          {stats.totalVehicles > 0 && (
            <div className="flex h-3 rounded-full overflow-hidden mb-3">
              {Object.entries(stats.vehiclesByStatus).map(([status, count]) => {
                if (count === 0) return null;
                const pct = (count / stats.totalVehicles) * 100;
                return (
                  <div
                    key={status}
                    className={`${STATUS_COLORS[status]} transition-all`}
                    style={{ width: `${pct}%` }}
                    title={`${STATUS_LABELS[status]}: ${count}`}
                  />
                );
              })}
            </div>
          )}
          {/* Status legend */}
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.vehiclesByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs">
                <div className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[status]}`} />
                <span className="text-muted-foreground">{STATUS_LABELS[status]}</span>
                <span className="font-semibold text-foreground">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Available Vehicles */}
        <Card
          className="border-border/50 shadow-sm hover-lift cursor-pointer"
          onClick={() => navigate('/vehicle-status')}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <Car className="h-5 w-5 text-green-500" />
              {needsPrep > 0 && (
                <Badge variant="outline" className="text-orange-500 border-orange-500/30 text-[10px] px-1.5">
                  {needsPrep} por preparar
                </Badge>
              )}
            </div>
            <div className="text-2xl font-bold text-foreground">{availableVehicles}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Vehículos disponibles</p>
          </CardContent>
        </Card>

        {/* Active Reservations */}
        <Card
          className="border-border/50 shadow-sm hover-lift cursor-pointer"
          onClick={() => navigate('/reservations')}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <CalendarCheck className="h-5 w-5 text-blue-500" />
              <div className="flex gap-1.5">
                {stats.todayCheckIns > 0 && (
                  <Badge variant="outline" className="text-green-500 border-green-500/30 text-[10px] px-1.5">
                    {stats.todayCheckIns} entrada{stats.todayCheckIns !== 1 ? 's' : ''}
                  </Badge>
                )}
                {stats.todayCheckOuts > 0 && (
                  <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-[10px] px-1.5">
                    {stats.todayCheckOuts} salida{stats.todayCheckOuts !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground">{stats.activeReservations}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Reservas activas</p>
          </CardContent>
        </Card>

        {/* Active Movements */}
        <Card
          className="border-border/50 shadow-sm hover-lift cursor-pointer"
          onClick={() => navigate('/movements')}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <ArrowRightLeft className="h-5 w-5 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">{stats.activeMovements}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Movimientos en curso</p>
          </CardContent>
        </Card>

        {/* Active Repairs */}
        <Card
          className="border-border/50 shadow-sm hover-lift cursor-pointer"
          onClick={() => navigate('/garatech')}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <Wrench className="h-5 w-5 text-amber-500" />
              {stats.contractsExpiringSoon > 0 && (
                <Badge variant="outline" className="text-red-500 border-red-500/30 text-[10px] px-1.5">
                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                  {stats.contractsExpiringSoon} contrato{stats.contractsExpiringSoon !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <div className="text-2xl font-bold text-foreground">{stats.activeRepairs}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Reparaciones activas</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Operations Summary */}
      {(stats.todayCheckIns > 0 || stats.todayCheckOuts > 0 || stats.upcomingReservations > 0) && (
        <Card className="border-border/50 shadow-sm bg-muted/20">
          <CardContent className="p-5">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Resumen del día</h4>
            <div className="flex flex-wrap gap-4 text-sm">
              {stats.todayCheckIns > 0 && (
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span><strong>{stats.todayCheckIns}</strong> entrada{stats.todayCheckIns !== 1 ? 's' : ''} hoy</span>
                </div>
              )}
              {stats.todayCheckOuts > 0 && (
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-amber-500" />
                  <span><strong>{stats.todayCheckOuts}</strong> salida{stats.todayCheckOuts !== 1 ? 's' : ''} hoy</span>
                </div>
              )}
              {stats.upcomingReservations > 0 && (
                <div className="flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-blue-500" />
                  <span><strong>{stats.upcomingReservations}</strong> reservas próximos 7 días</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
