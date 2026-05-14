import { useState, useEffect, useCallback } from 'react';
import { ReportsLayout } from '@/components/reports/ReportsLayout';
import { apiInvoke } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { format, subDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Navigation, Clock, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight,
  User, MapPin, ArrowRight, TrendingUp, Calendar, RefreshCw, Route
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RouteReplaySheet } from '@/components/reports/RouteReplaySheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Trip {
  id: string;
  reservation_id: string;
  operation_type: string;
  destination_address: string | null;
  started_by: string | null;
  arrived_by: string | null;
  en_camino_at: string;
  llego_at: string | null;
  estimated_minutes: number | null;
  real_minutes: number | null;
  diff_minutes: number | null;
  status: 'on_time' | 'late' | 'very_late' | 'en_route';
}

interface UserSummary {
  name: string;
  trips: number;
  avg_real_minutes: number;
  avg_estimated_minutes: number;
  on_time: number;
  late: number;
  on_time_percent: number;
}

interface HistoryData {
  date: string;
  trips: Trip[];
  user_summary: UserSummary[];
  totals: {
    total_trips: number;
    completed: number;
    en_route: number;
    on_time: number;
    late: number;
  };
}

export default function ReportsTravel() {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [replayTrip, setReplayTrip] = useState<Trip | null>(null);
  const [replayOpen, setReplayOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await apiInvoke<{ ok: boolean } & HistoryData>(
        'en-camino-tracking/history',
        { body: { date } }
      );
      if (resp.data?.ok) {
        setData(resp.data);
      }
    } catch (err) {
      console.error('[travel-report] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const goToDay = (offset: number) => {
    const current = new Date(date + 'T12:00:00');
    const next = offset > 0 ? addDays(current, offset) : subDays(current, Math.abs(offset));
    setDate(next.toISOString().split('T')[0]);
  };

  const statusConfig = {
    on_time: { label: 'A tiempo', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
    late: { label: 'Tarde', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: AlertTriangle },
    very_late: { label: 'Muy tarde', color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: AlertTriangle },
    en_route: { label: 'En camino', color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200', icon: Navigation },
  };

  const formattedDate = format(new Date(date + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es });

  return (
    <ReportsLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10">
              <Navigation className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Reporte de Trayectos</h1>
              <p className="text-sm text-muted-foreground">Historial diario de entregas y devoluciones</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
            Actualizar
          </Button>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => goToDay(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-card">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium capitalize">{formattedDate}</span>
          </div>
          <Button variant="outline" size="icon" onClick={() => goToDay(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDate(new Date().toISOString().split('T')[0])}>
            Hoy
          </Button>
        </div>

        {/* KPI Cards */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{data.totals.total_trips}</p>
                <p className="text-xs text-muted-foreground">Total trayectos</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">{data.totals.completed}</p>
                <p className="text-xs text-muted-foreground">Completados</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">{data.totals.on_time}</p>
                <p className="text-xs text-muted-foreground">A tiempo</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className={cn("text-2xl font-bold", data.totals.late > 0 ? "text-amber-600" : "text-muted-foreground")}>{data.totals.late}</p>
                <p className="text-xs text-muted-foreground">Tarde</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className={cn("text-2xl font-bold", data.totals.en_route > 0 ? "text-sky-600" : "text-muted-foreground")}>{data.totals.en_route}</p>
                <p className="text-xs text-muted-foreground">En camino</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Per-user summary */}
        {data && data.user_summary.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Resumen por conductor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Conductor</th>
                      <th className="pb-2 font-medium text-center">Trayectos</th>
                      <th className="pb-2 font-medium text-center">Promedio real</th>
                      <th className="pb-2 font-medium text-center">Promedio estimado</th>
                      <th className="pb-2 font-medium text-center">A tiempo</th>
                      <th className="pb-2 font-medium text-center">Tarde</th>
                      <th className="pb-2 font-medium text-center">Puntualidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.user_summary.map((user) => (
                      <tr key={user.name} className="border-b last:border-0">
                        <td className="py-2.5 font-medium">{user.name}</td>
                        <td className="py-2.5 text-center">{user.trips}</td>
                        <td className="py-2.5 text-center">{user.avg_real_minutes} min</td>
                        <td className="py-2.5 text-center text-muted-foreground">{user.avg_estimated_minutes} min</td>
                        <td className="py-2.5 text-center text-emerald-600">{user.on_time}</td>
                        <td className="py-2.5 text-center text-amber-600">{user.late}</td>
                        <td className="py-2.5 text-center">
                          <Badge variant="outline" className={cn(
                            "text-xs",
                            user.on_time_percent >= 80 ? "border-emerald-200 text-emerald-700 bg-emerald-50" :
                            user.on_time_percent >= 50 ? "border-amber-200 text-amber-700 bg-amber-50" :
                            "border-red-200 text-red-700 bg-red-50"
                          )}>
                            {user.on_time_percent}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trip list */}
        {data && data.trips.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Detalle de trayectos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Hora</th>
                      <th className="pb-2 font-medium">Tipo</th>
                      <th className="pb-2 font-medium">Destino</th>
                      <th className="pb-2 font-medium">Conductor</th>
                      <th className="pb-2 font-medium text-center">Estimado</th>
                      <th className="pb-2 font-medium text-center">Real</th>
                      <th className="pb-2 font-medium text-center">Diferencia</th>
                      <th className="pb-2 font-medium text-center">Estado</th>
                      <th className="pb-2 font-medium text-center">Recorrido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trips.map((trip) => {
                      const config = statusConfig[trip.status];
                      const StatusIcon = config.icon;
                      return (
                        <tr key={trip.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 tabular-nums text-muted-foreground">
                            {format(new Date(trip.en_camino_at), 'HH:mm')}
                          </td>
                          <td className="py-2.5">
                            <Badge variant="outline" className={cn(
                              "text-xs capitalize",
                              trip.operation_type === 'entrega' ? "border-blue-200 text-blue-700 bg-blue-50" : "border-orange-200 text-orange-700 bg-orange-50"
                            )}>
                              {trip.operation_type === 'entrega' ? 'Entrega' : 'Devolución'}
                            </Badge>
                          </td>
                          <td className="py-2.5 max-w-[200px] truncate" title={trip.destination_address || ''}>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                              {trip.destination_address || 'Sin dirección'}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3 text-muted-foreground" />
                                    {trip.started_by || '—'}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {trip.started_by && <p>Inició: {trip.started_by}</p>}
                                  {trip.arrived_by && <p>Llegó: {trip.arrived_by}</p>}
                                  {!trip.started_by && !trip.arrived_by && <p>Sin asignar</p>}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </td>
                          <td className="py-2.5 text-center tabular-nums text-muted-foreground">
                            {trip.estimated_minutes != null ? `${trip.estimated_minutes} min` : '—'}
                          </td>
                          <td className="py-2.5 text-center tabular-nums font-medium">
                            {trip.real_minutes != null ? `${trip.real_minutes} min` : '—'}
                          </td>
                          <td className="py-2.5 text-center tabular-nums">
                            {trip.diff_minutes != null ? (
                              <span className={cn(
                                "font-medium",
                                trip.diff_minutes <= 0 ? 'text-emerald-600' :
                                trip.diff_minutes <= 5 ? 'text-amber-600' : 'text-red-600'
                              )}>
                                {trip.diff_minutes > 0 ? '+' : ''}{trip.diff_minutes} min
                              </span>
                            ) : '—'}
                          </td>
                          <td className="py-2.5 text-center">
                            <span className={cn("inline-flex items-center gap-1 text-xs font-medium", config.color)}>
                              <StatusIcon className="h-3.5 w-3.5" />
                              {config.label}
                            </span>
                          </td>
                          <td className="py-2.5 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                setReplayTrip(trip);
                                setReplayOpen(true);
                              }}
                              title="Ver recorrido en el mapa"
                            >
                              <Route className="h-3.5 w-3.5 mr-1" />
                              Ver
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {data && data.trips.length === 0 && !loading && (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <Navigation className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg font-medium text-muted-foreground">Sin trayectos registrados</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                No hay operaciones "En camino" registradas para este día.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {loading && (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <RefreshCw className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3 animate-spin" />
              <p className="text-sm text-muted-foreground">Cargando datos...</p>
            </CardContent>
          </Card>
        )}
      </div>
      <RouteReplaySheet
        open={replayOpen}
        onOpenChange={setReplayOpen}
        trip={replayTrip}
      />
    </ReportsLayout>
  );
}
