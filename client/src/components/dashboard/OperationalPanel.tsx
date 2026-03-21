import { useOperationalDashboard } from '@/hooks/useOperationalDashboard';
import { useRentlySyncContextSafe } from '@/contexts/RentlySyncContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import {
  Car, CalendarCheck, ArrowRightLeft, Wrench, ClipboardList,
  ArrowRight, RefreshCw, AlertTriangle, ArrowDownToLine, ArrowUpFromLine,
  Clock, FileWarning, ChevronRight,
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

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '--:--';
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

export function OperationalPanel() {
  const { stats, isLoading } = useOperationalDashboard();
  const rentlyCtx = useRentlySyncContextSafe();
  const navigate = useNavigate();

  if (isLoading || !stats) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  const needsPrep = stats.vehiclesByStatus.sucio + stats.vehiclesByStatus.incompleto;
  const hasAlerts = stats.contractsExpiringSoon > 0 || needsPrep > 3 || stats.pendingTasksHigh > 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ─── Fleet Status Bar ─── */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3 px-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Car className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Estado de Flota · {stats.totalVehicles} vehículos</span>
            </CardTitle>
            <div className="flex items-center gap-2 flex-shrink-0">
              {rentlyCtx?.isConfigured && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  onClick={() => rentlyCtx.syncRently(false)}
                  disabled={rentlyCtx.syncing}
                >
                  <RefreshCw className={`h-3 w-3 ${rentlyCtx.syncing ? 'animate-spin' : ''}`} />
                  <span className="hidden xs:inline">Sync</span>
                </Button>
              )}
              <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => navigate('/vehicles')}>
                <span className="hidden sm:inline">Detalle</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-4 px-4 sm:px-6">
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
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 sm:gap-x-4">
            {Object.entries(stats.vehiclesByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs">
                <div className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[status]} flex-shrink-0`} />
                <span className="text-muted-foreground">{STATUS_LABELS[status]}</span>
                <span className="font-semibold text-foreground">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── KPI Grid ─── */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {/* Available */}
        <Card
          className="border-border/50 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => navigate('/vehicles')}
        >
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <Car className="h-4 w-4 text-green-500" />
              {needsPrep > 0 && (
                <Badge variant="outline" className="text-orange-500 border-orange-500/30 text-[10px] px-1.5 py-0 hidden sm:flex">
                  {needsPrep} preparar
                </Badge>
              )}
            </div>
            <div className="text-xl sm:text-2xl font-bold text-foreground">{stats.vehiclesByStatus.limpio}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Disponibles</p>
            {needsPrep > 0 && (
              <p className="text-[10px] text-orange-500 mt-1 sm:hidden">{needsPrep} por preparar</p>
            )}
          </CardContent>
        </Card>

        {/* Active Reservations */}
        <Card
          className="border-border/50 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => navigate('/reservations')}
        >
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <CalendarCheck className="h-4 w-4 text-blue-500" />
              <div className="flex gap-1">
                {stats.todayCheckIns > 0 && (
                  <Badge variant="outline" className="text-green-600 border-green-500/30 text-[10px] px-1 sm:px-1.5 py-0">
                    <ArrowDownToLine className="h-2.5 w-2.5 sm:mr-0.5" />
                    <span className="hidden sm:inline">{stats.todayCheckIns}</span>
                  </Badge>
                )}
                {stats.todayCheckOuts > 0 && (
                  <Badge variant="outline" className="text-amber-600 border-amber-500/30 text-[10px] px-1 sm:px-1.5 py-0">
                    <ArrowUpFromLine className="h-2.5 w-2.5 sm:mr-0.5" />
                    <span className="hidden sm:inline">{stats.todayCheckOuts}</span>
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-foreground">{stats.activeReservations}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Reservas activas</p>
            {(stats.todayCheckIns > 0 || stats.todayCheckOuts > 0) && (
              <p className="text-[10px] text-muted-foreground mt-1 sm:hidden">
                {stats.todayCheckIns > 0 && `${stats.todayCheckIns} entrada${stats.todayCheckIns !== 1 ? 's' : ''}`}
                {stats.todayCheckIns > 0 && stats.todayCheckOuts > 0 && ' · '}
                {stats.todayCheckOuts > 0 && `${stats.todayCheckOuts} salida${stats.todayCheckOuts !== 1 ? 's' : ''}`}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Movements */}
        <Card
          className="border-border/50 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => navigate('/movements')}
        >
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <ArrowRightLeft className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-foreground">{stats.activeMovements}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Movimientos</p>
          </CardContent>
        </Card>

        {/* Repairs */}
        <Card
          className="border-border/50 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => navigate('/garatech')}
        >
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <Wrench className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-foreground">{stats.activeRepairs}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Reparaciones</p>
          </CardContent>
        </Card>

        {/* Pending Tasks */}
        <Card
          className="border-border/50 shadow-sm hover:shadow-md transition-shadow cursor-pointer col-span-2 sm:col-span-1"
          onClick={() => navigate('/tasks')}
        >
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <ClipboardList className="h-4 w-4 text-rose-500" />
              {stats.pendingTasksHigh > 0 && (
                <Badge variant="outline" className="text-red-500 border-red-500/30 text-[10px] px-1.5 py-0">
                  {stats.pendingTasksHigh} urgente{stats.pendingTasksHigh !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <div className="text-xl sm:text-2xl font-bold text-foreground">{stats.pendingTasksTotal}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Tareas pendientes</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Today's Operations ─── */}
      {stats.todayReservations.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2 px-4 sm:px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">
                  <span className="hidden sm:inline">Operaciones de hoy · </span>
                  <span className="sm:hidden">Hoy · </span>
                  {stats.todayCheckIns + stats.todayCheckOuts} mov.
                </span>
              </CardTitle>
              <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 flex-shrink-0" onClick={() => navigate('/reservations')}>
                <span className="hidden sm:inline">Ver todas</span>
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pb-3 px-4 sm:px-6">
            <div className="divide-y divide-border/50">
              {stats.todayReservations.slice(0, 8).map((r) => (
                <div
                  key={`${r.id}-${r.type}`}
                  className="flex items-center gap-2 sm:gap-3 py-2 sm:py-2.5 text-sm cursor-pointer hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
                  onClick={() => navigate('/reservations')}
                >
                  {/* Type indicator */}
                  <div className={`flex items-center justify-center h-6 w-6 sm:h-7 sm:w-7 rounded-full flex-shrink-0 ${
                    r.type === 'checkin'
                      ? 'bg-green-500/10 text-green-600'
                      : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    {r.type === 'checkin'
                      ? <ArrowDownToLine className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      : <ArrowUpFromLine className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    }
                  </div>

                  {/* Time */}
                  <span className="text-xs font-mono text-muted-foreground w-10 sm:w-12 flex-shrink-0">
                    {formatTime(r.type === 'checkin' ? r.desde : r.hasta)}
                  </span>

                  {/* Client */}
                  <span className="font-medium text-foreground truncate min-w-0 flex-1 text-xs sm:text-sm">
                    {[r.cliente_nombre, r.cliente_apellido].filter(Boolean).join(' ') || 'Sin nombre'}
                  </span>

                  {/* Vehicle - hidden on very small screens */}
                  <span className="text-xs text-muted-foreground truncate max-w-[80px] sm:max-w-[120px] flex-shrink-0 hidden xs:block">
                    {r.auto || r.modelo || '—'}
                  </span>

                  {/* Location - hidden on mobile */}
                  <span className="text-xs text-muted-foreground truncate max-w-[100px] flex-shrink-0 hidden md:block">
                    {(r.type === 'checkin' ? r.lugar_entrega : r.lugar_devolucion) || '—'}
                  </span>

                  {/* Status badge - hidden on very small screens */}
                  {r.estado && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0 hidden sm:flex">
                      {r.estado}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
            {stats.todayReservations.length > 8 && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                +{stats.todayReservations.length - 8} más
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Vehicles Needing Preparation ─── */}
      {stats.vehiclesNeedingPrep.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2 px-4 sm:px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                <span className="truncate">Vehículos por preparar · {needsPrep}</span>
              </CardTitle>
              <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 flex-shrink-0" onClick={() => navigate('/vehicles')}>
                <span className="hidden sm:inline">Estado Coches</span>
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pb-3 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
              {stats.vehiclesNeedingPrep.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/50 bg-muted/20 text-sm cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => navigate('/vehicles')}
                >
                  <div className={`h-2 w-2 rounded-full ${STATUS_COLORS[v.status]} flex-shrink-0`} />
                  <span className="font-medium text-foreground">{v.matricula}</span>
                  {v.modelo && (
                    <span className="text-xs text-muted-foreground truncate">{v.modelo}</span>
                  )}
                  <Badge variant="outline" className={`text-[10px] px-1 py-0 flex-shrink-0 ${
                    v.status === 'sucio' ? 'text-red-500 border-red-500/30' : 'text-orange-500 border-orange-500/30'
                  }`}>
                    {STATUS_LABELS[v.status]}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Alerts Section ─── */}
      {hasAlerts && (
        <Card className="border-amber-500/20 shadow-sm bg-amber-500/5">
          <CardContent className="p-3 sm:p-4">
            <h4 className="text-sm font-medium text-foreground mb-2 sm:mb-2.5 flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-amber-500 flex-shrink-0" />
              Atención
            </h4>
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3 text-sm">
              {stats.contractsExpiringSoon > 0 && (
                <div
                  className="flex items-center gap-2 px-3 py-2 sm:py-1.5 rounded-lg bg-background border border-border/50 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => navigate('/fleet')}
                >
                  <FileWarning className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                  <span className="flex-1 text-xs sm:text-sm">
                    <strong>{stats.contractsExpiringSoon}</strong> contrato{stats.contractsExpiringSoon !== 1 ? 's' : ''} expirando en 30 días
                  </span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                </div>
              )}
              {stats.pendingTasksHigh > 0 && (
                <div
                  className="flex items-center gap-2 px-3 py-2 sm:py-1.5 rounded-lg bg-background border border-border/50 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => navigate('/tasks')}
                >
                  <ClipboardList className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                  <span className="flex-1 text-xs sm:text-sm">
                    <strong>{stats.pendingTasksHigh}</strong> tarea{stats.pendingTasksHigh !== 1 ? 's' : ''} urgente{stats.pendingTasksHigh !== 1 ? 's' : ''} pendiente{stats.pendingTasksHigh !== 1 ? 's' : ''}
                  </span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                </div>
              )}
              {stats.upcomingReservations > 0 && (
                <div
                  className="flex items-center gap-2 px-3 py-2 sm:py-1.5 rounded-lg bg-background border border-border/50 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => navigate('/reservations')}
                >
                  <CalendarCheck className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                  <span className="flex-1 text-xs sm:text-sm">
                    <strong>{stats.upcomingReservations}</strong> reserva{stats.upcomingReservations !== 1 ? 's' : ''} en los próximos 7 días
                  </span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Quick Access ─── */}
      <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { title: 'Reservas', icon: CalendarCheck, href: '/reservations', color: 'text-blue-500 bg-blue-500/10' },
          { title: 'Estado Coches', icon: Car, href: '/vehicles', color: 'text-green-500 bg-green-500/10' },
          { title: 'Movimientos', icon: ArrowRightLeft, href: '/movements', color: 'text-indigo-500 bg-indigo-500/10' },
          { title: 'Flota', icon: Car, href: '/fleet', color: 'text-purple-500 bg-purple-500/10' },
          { title: 'Garatech', icon: Wrench, href: '/garatech', color: 'text-amber-500 bg-amber-500/10' },
        ].map((item, idx) => (
          <Card
            key={item.title}
            className={`border-border/50 shadow-sm hover:shadow-md transition-shadow cursor-pointer group ${
              idx === 4 ? 'col-span-2 sm:col-span-1' : ''
            }`}
            onClick={() => navigate(item.href)}
          >
            <CardContent className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
              <div className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg ${item.color} flex-shrink-0`}>
                <item.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                {item.title}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
