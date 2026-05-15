import { useOperationalDashboard, VehiclePrepItem, TodayOperationRow } from '@/hooks/useOperationalDashboard';
import { useRentlySyncContextSafe } from '@/contexts/RentlySyncContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonTransition } from '@/components/ui/skeleton-transition';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import {
  Car, CalendarCheck, ArrowRightLeft, Wrench, ClipboardList,
  ArrowRight, RefreshCw, AlertTriangle, ArrowDownToLine, ArrowUpFromLine,
  Clock, FileWarning, ChevronRight, User, Baby, Repeat,
} from 'lucide-react';

const BABY_SEAT_KEYWORDS = ['silla', 'sillita', 'baby', 'child', 'booster', 'infant', 'bebé', 'bebe', 'infante', 'elevador', 'recién nacido', 'recien nacido', 'newborn', 'niño', 'nino'];

function hasBabySeatExtras(extrasRaw: string | null): { has: boolean; count: number; types: string[] } {
  if (!extrasRaw) return { has: false, count: 0, types: [] };
  try {
    const extras = typeof extrasRaw === 'string' ? JSON.parse(extrasRaw) : (Array.isArray(extrasRaw) ? extrasRaw : []);
    let count = 0;
    const types: string[] = [];
    for (const e of extras) {
      const name = (e.nombre || e.name || '').toLowerCase();
      if (BABY_SEAT_KEYWORDS.some(kw => name.includes(kw))) {
        count += e.cantidad ?? e.quantity ?? 1;
        types.push(e.nombre || e.name || 'Sillita');
      }
    }
    return { has: count > 0, count, types };
  } catch { return { has: false, count: 0, types: [] }; }
}

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

const URGENCY_STYLES: Record<VehiclePrepItem['urgency'], { bg: string; text: string; border: string; label: string }> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-600', border: 'border-red-500/30', label: 'Urgente' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-600', border: 'border-orange-500/30', label: 'Hoy' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/30', label: 'Próximo' },
  low: { bg: 'bg-muted/30', text: 'text-muted-foreground', border: 'border-border/50', label: 'Sin reserva' },
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

function formatTimeUntil(dateStr: string | null): string {
  if (!dateStr) return '';
  const now = new Date();
  const target = new Date(dateStr);
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) return 'Ya';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) {
    const mins = Math.floor(diffMs / (1000 * 60));
    return `${mins}min`;
  }
  if (hours < 24) return `${hours}h`;
  if (days === 1) return 'Mañana';
  return `${days} días`;
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function OperationalPanel() {
  const { stats, isLoading, error, refetch } = useOperationalDashboard();
  const rentlyCtx = useRentlySyncContextSafe();
  const navigate = useNavigate();

  const needsPrep = stats ? stats.vehiclesByStatus.sucio + stats.vehiclesByStatus.incompleto : 0;
  const vehiclesWithReservations = stats ? stats.vehiclesNeedingPrep.filter(v => v.nextReservationAt) : [];
  const hasAlerts = stats ? (stats.contractsExpiringSoon > 0 || stats.pendingTasksHigh > 0) : false;

  const dashboardSkeleton = (
    <div className="space-y-5 sm:space-y-6">
      {/* Fleet Status Bar skeleton */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-7 w-16" />
          </div>
          <Skeleton className="h-3 w-full rounded-full mb-3" />
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-1.5">
                <Skeleton className="h-2.5 w-2.5 rounded-full" />
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-3 w-5" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* KPI Grid skeleton */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map(i => (
          <Card key={i} className="border-border/50 shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-4 w-4 rounded" />
                {i <= 2 && <Skeleton className="h-4 w-16 rounded-full" />}
              </div>
              <Skeleton className="h-7 w-10 mb-1" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Today's Operations skeleton */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-7 w-20" />
          </div>
          <div className="divide-y divide-border/50">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 flex-1 max-w-[120px]" />
                <Skeleton className="h-3 w-20 hidden sm:block" />
                <Skeleton className="h-4 w-16 rounded-full hidden sm:block" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Access skeleton */}
      <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map(i => (
          <Card key={i} className="border-border/50 shadow-sm">
            <CardContent className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
              <Skeleton className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg" />
              <Skeleton className="h-3.5 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  // Show error state with retry button instead of infinite skeleton
  if (error && !isLoading && !stats) {
    return (
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No se pudieron cargar los datos del dashboard</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <SkeletonTransition isLoading={isLoading} skeleton={dashboardSkeleton}>
    {stats && <div className="space-y-5 sm:space-y-6">
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
                  {stats.todayReservations.length} mov.
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
                      : r.type === 'transfer'
                        ? 'bg-indigo-500/10 text-indigo-600'
                        : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    {r.type === 'checkin'
                      ? <ArrowDownToLine className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      : r.type === 'transfer'
                        ? <Repeat className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        : <ArrowUpFromLine className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    }
                  </div>

                  {/* Time - show confirmed hour if available, with indicator */}
                  <span className="text-xs font-mono w-10 sm:w-12 flex-shrink-0" title={
                    r.confirmedDatetime
                      ? `Confirmada: ${formatTime(r.confirmedDatetime)} (original: ${formatTime(r.fechaHora)})`
                      : `Programada: ${formatTime(r.fechaHora)}`
                  }>
                    <span className={
                      r.confirmedDatetime
                        ? 'text-foreground font-semibold'
                        : 'text-muted-foreground'
                    }>
                      {formatTime(r.confirmedDatetime || r.fechaHora)}
                    </span>
                  </span>

                  {/* Client + baby seat indicator */}
                  <span className="font-medium text-foreground truncate min-w-0 flex-1 text-xs sm:text-sm flex items-center gap-1">
                    {[r.cliente_nombre, r.cliente_apellido].filter(Boolean).join(' ') || 'Sin nombre'}
                    {(() => {
                      const seats = hasBabySeatExtras(r.extras_contratados);
                      if (!seats.has) return null;
                      return (
                        <span
                          className="inline-flex items-center gap-0.5 flex-shrink-0"
                          title={`${seats.types.join(', ')} (${seats.count})`}
                        >
                          <Baby className="h-3.5 w-3.5 text-pink-500" />
                          {seats.count > 1 && (
                            <span className="text-[10px] font-bold text-pink-500">{seats.count}</span>
                          )}
                        </span>
                      );
                    })()}
                  </span>

                  {/* Vehicle - hidden on very small screens */}
                  <span className="text-xs text-muted-foreground truncate max-w-[80px] sm:max-w-[120px] flex-shrink-0 hidden xs:block">
                    {r.auto || r.modelo || '—'}
                  </span>

                  {/* Location - hidden on mobile */}
                  <span className="text-xs text-muted-foreground truncate max-w-[100px] flex-shrink-0 hidden md:block">
                    {r.lugar || '—'}
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

      {/* ─── Vehicles Needing Preparation (Dynamic) ─── */}
      {stats.vehiclesNeedingPrep.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2 px-4 sm:px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                <span className="truncate">
                  Vehículos por preparar
                  {vehiclesWithReservations.length > 0 && (
                    <span className="text-orange-500 font-semibold"> · {vehiclesWithReservations.length} con reserva</span>
                  )}
                </span>
              </CardTitle>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                  {stats.totalDirtyVehicles} total
                </Badge>
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => navigate('/vehicles')}>
                  <span className="hidden sm:inline">Estado Coches</span>
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-3 px-4 sm:px-6">
            <div className="divide-y divide-border/50">
              {stats.vehiclesNeedingPrep.map((v) => {
                const style = URGENCY_STYLES[v.urgency];
                const timeUntil = formatTimeUntil(v.nextReservationAt);

                return (
                  <div
                    key={v.id}
                    className="flex items-center gap-2 sm:gap-3 py-2 sm:py-2.5 cursor-pointer hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
                    onClick={() => navigate('/vehicles')}
                  >
                    {/* Urgency indicator */}
                    <div className={`flex items-center justify-center h-6 w-6 sm:h-7 sm:w-7 rounded-full flex-shrink-0 ${style.bg}`}>
                      {v.urgency === 'critical' ? (
                        <AlertTriangle className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${style.text}`} />
                      ) : v.nextReservationAt ? (
                        <Clock className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${style.text}`} />
                      ) : (
                        <Car className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                      )}
                    </div>

                    {/* Time until delivery */}
                    <span className={`text-xs font-semibold w-14 sm:w-16 flex-shrink-0 ${style.text}`}>
                      {timeUntil || '—'}
                    </span>

                    {/* Plate + Model */}
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground text-xs sm:text-sm">{v.matricula}</span>
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 flex-shrink-0 ${
                          v.status === 'sucio' ? 'text-red-500 border-red-500/30' : 'text-orange-500 border-orange-500/30'
                        }`}>
                          {STATUS_LABELS[v.status]}
                        </Badge>
                      </div>
                      {v.modelo && (
                        <span className="text-[11px] text-muted-foreground truncate">{v.modelo}</span>
                      )}
                    </div>

                    {/* Next reservation info */}
                    {v.nextReservationAt ? (
                      <div className="flex flex-col items-end flex-shrink-0 text-right">
                        <div className="flex items-center gap-1 text-xs text-foreground">
                          <User className="h-3 w-3 text-muted-foreground hidden sm:block" />
                          <span className="truncate max-w-[80px] sm:max-w-[120px] font-medium">
                            {v.nextReservationCliente}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground hidden sm:block">
                          {formatShortDate(v.nextReservationAt)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground flex-shrink-0 hidden sm:block">
                        Sin reserva próxima
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {stats.totalDirtyVehicles > stats.vehiclesNeedingPrep.length && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                +{stats.totalDirtyVehicles - stats.vehiclesNeedingPrep.length} vehículos más sin reserva próxima
              </p>
            )}
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
    </div>}
    </SkeletonTransition>
  );
}
