/**
 * Fleet Status Dashboard
 * Shows a comprehensive overview of all GPS-tracked vehicles with:
 * - Battery level indicators
 * - Last report time (with freshness color coding)
 * - Total km traveled (odometer)
 * - Online/offline status
 * - Summary KPI cards at the top
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { apiInvoke } from '@/lib/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Battery, BatteryLow, BatteryMedium, BatteryFull, BatteryCharging,
  Wifi, WifiOff, Clock, MapPin, Car, RefreshCw, Search,
  AlertTriangle, Activity, Gauge, Navigation, Signal, SignalLow
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, LineChart, Line,
} from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// Helper to format ISO date string to short display format
function formatChartDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${day}/${month}`;
}

// Chart color palette for multi-vehicle line chart
const CHART_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#EC4899',
];
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ── Types ──
interface VehicleStatus {
  id: string;
  matricula: string;
  marca: string;
  modelo: string;
  categoria: string;
  deviceName: string;
  status: string;
  lastUpdate: string | null;
  minutesSinceUpdate: number | null;
  batteryLevel: number | null;
  totalDistanceKm: number;
  speedKmh: number;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  isOnline: boolean;
  isLowBattery: boolean;
  hasNoReport24h: boolean;
}

interface FleetSummary {
  total: number;
  online: number;
  offline: number;
  lowBattery: number;
  noReport24h: number;
}

// ── Helpers ──
function formatLastUpdate(minutesSinceUpdate: number | null): string {
  if (minutesSinceUpdate === null) return 'Sin datos';
  if (minutesSinceUpdate < 1) return 'Ahora mismo';
  if (minutesSinceUpdate < 60) return `Hace ${minutesSinceUpdate} min`;
  const hours = Math.floor(minutesSinceUpdate / 60);
  if (hours < 24) return `Hace ${hours}h ${minutesSinceUpdate % 60}min`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d ${hours % 24}h`;
}

function getLastUpdateColor(minutesSinceUpdate: number | null): string {
  if (minutesSinceUpdate === null) return 'text-gray-400';
  if (minutesSinceUpdate < 5) return 'text-emerald-600';
  if (minutesSinceUpdate < 30) return 'text-emerald-500';
  if (minutesSinceUpdate < 120) return 'text-amber-500';
  if (minutesSinceUpdate < 1440) return 'text-orange-500';
  return 'text-red-500';
}

function getBatteryIcon(level: number | null) {
  if (level === null) return <Battery className="h-4 w-4 text-gray-400" />;
  if (level > 80) return <BatteryFull className="h-4 w-4 text-emerald-500" />;
  if (level > 50) return <BatteryMedium className="h-4 w-4 text-emerald-500" />;
  if (level > 20) return <BatteryMedium className="h-4 w-4 text-amber-500" />;
  return <BatteryLow className="h-4 w-4 text-red-500" />;
}

function getBatteryColor(level: number | null): string {
  if (level === null) return 'text-gray-400';
  if (level > 80) return 'text-emerald-600';
  if (level > 50) return 'text-emerald-500';
  if (level > 20) return 'text-amber-500';
  return 'text-red-500';
}

function formatDistance(km: number): string {
  if (km === 0) return '—';
  if (km < 1000) return `${km} km`;
  return `${(km / 1000).toFixed(1)}k km`;
}

// ── Sort options ──
type SortField = 'matricula' | 'battery' | 'lastUpdate' | 'distance' | 'status';
type SortDir = 'asc' | 'desc';

export default function FleetStatusPage() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const [vehicles, setVehicles] = useState<VehicleStatus[]>([]);
  const [summary, setSummary] = useState<FleetSummary>({ total: 0, online: 0, offline: 0, lowBattery: 0, noReport24h: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filter, setFilter] = useState<'all' | 'online' | 'offline' | 'lowBattery' | 'noReport'>('all');
  const [chartPeriod, setChartPeriod] = useState<'7' | '14' | '30'>('7');
  const [chartVehicle, setChartVehicle] = useState<string>('all');
  const [chartData, setChartData] = useState<Array<{ date: string; vehicleId: string; matricula: string; km: number }>>([]);
  const [chartLoading, setChartLoading] = useState(false);

  const fetchFleetStatus = useCallback(async (showRefreshing = false) => {
    if (!orgId) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      const resp = await apiInvoke<{
        ok: boolean;
        vehicles: VehicleStatus[];
        summary: FleetSummary;
      }>('traccar/fleet-status', { body: { organization_id: orgId } });

      if (resp.data && resp.data.ok) {
        setVehicles(resp.data.vehicles);
        setSummary(resp.data.summary);
      }
    } catch (err) {
      console.error('Error fetching fleet status:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchFleetStatus();
  }, [fetchFleetStatus]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => fetchFleetStatus(true), 30000);
    return () => clearInterval(interval);
  }, [fetchFleetStatus]);

  // Fetch chart data
  const fetchChartData = useCallback(async () => {
    if (!orgId) return;
    setChartLoading(true);
    try {
      const body: Record<string, unknown> = { organization_id: orgId, days: Number(chartPeriod) };
      if (chartVehicle !== 'all') {
        const v = vehicles.find(veh => veh.id === chartVehicle);
        if (v) body.device_id = v.id; // We'll filter client-side instead
      }
      const resp = await apiInvoke<{
        ok: boolean;
        data: Array<{ date: string; vehicleId: string; matricula: string; km: number }>;
      }>('traccar/fleet-daily-km', { body });
      if (resp.data && resp.data.ok) {
        setChartData(resp.data.data);
      }
    } catch (err) {
      console.error('Error fetching chart data:', err);
    } finally {
      setChartLoading(false);
    }
  }, [orgId, chartPeriod, vehicles, chartVehicle]);

  useEffect(() => {
    if (vehicles.length > 0) fetchChartData();
  }, [fetchChartData, vehicles.length]);

  // Process chart data for Recharts
  const processedChartData = useMemo(() => {
    if (chartData.length === 0) return [];

    // Filter by selected vehicle if needed
    const filtered = chartVehicle === 'all'
      ? chartData
      : chartData.filter(d => d.vehicleId === chartVehicle);

    if (chartVehicle !== 'all') {
      // Single vehicle: simple date → km
      return filtered.map(d => ({
        date: formatChartDate(d.date),
        km: d.km,
      }));
    }

    // All vehicles: aggregate total km per day
    const dayMap = new Map<string, number>();
    for (const d of filtered) {
      dayMap.set(d.date, (dayMap.get(d.date) || 0) + d.km);
    }
    return Array.from(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, km]) => ({ date: formatChartDate(date), km: Math.round(km * 10) / 10 }));
  }, [chartData, chartVehicle]);

  // Per-vehicle breakdown for multi-line chart
  const perVehicleChartData = useMemo(() => {
    if (chartData.length === 0 || chartVehicle !== 'all') return null;
    // Get unique vehicles (top 10 by total km)
    const vehicleKmTotals = new Map<string, { matricula: string; total: number }>();
    for (const d of chartData) {
      const existing = vehicleKmTotals.get(d.vehicleId) || { matricula: d.matricula, total: 0 };
      existing.total += d.km;
      vehicleKmTotals.set(d.vehicleId, existing);
    }
    const topVehicles = Array.from(vehicleKmTotals.entries())
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 8);

    // Build date-indexed data
    const dates = Array.from(new Set(chartData.map(d => d.date))).sort();
    return {
      vehicles: topVehicles.map(([id, v]) => ({ id, matricula: v.matricula })),
      data: dates.map(date => {
        const row: Record<string, unknown> = { date: formatChartDate(date) };
        for (const [vId, vInfo] of topVehicles) {
          const entry = chartData.find(d => d.date === date && d.vehicleId === vId);
          row[vInfo.matricula] = entry ? Math.round(entry.km * 10) / 10 : 0;
        }
        return row;
      }),
    };
  }, [chartData, chartVehicle]);

  // Filter and sort
  const filteredVehicles = vehicles
    .filter(v => {
      if (filter === 'online') return v.isOnline;
      if (filter === 'offline') return !v.isOnline;
      if (filter === 'lowBattery') return v.isLowBattery;
      if (filter === 'noReport') return v.hasNoReport24h;
      return true;
    })
    .filter(v => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        v.matricula?.toLowerCase().includes(q) ||
        v.marca?.toLowerCase().includes(q) ||
        v.modelo?.toLowerCase().includes(q) ||
        v.deviceName?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'matricula':
          cmp = (a.matricula || '').localeCompare(b.matricula || '');
          break;
        case 'battery':
          cmp = (a.batteryLevel ?? -1) - (b.batteryLevel ?? -1);
          break;
        case 'lastUpdate':
          cmp = (a.minutesSinceUpdate ?? 99999) - (b.minutesSinceUpdate ?? 99999);
          break;
        case 'distance':
          cmp = a.totalDistanceKm - b.totalDistanceKm;
          break;
        case 'status':
          // Online first, then by last update
          if (a.isOnline !== b.isOnline) cmp = a.isOnline ? -1 : 1;
          else cmp = (a.minutesSinceUpdate ?? 99999) - (b.minutesSinceUpdate ?? 99999);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  return (
    <AppLayout title="Estado de Flota" fullWidth>
      <div className="space-y-6">
        {/* ── KPI Summary Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPICard
            label="Total Rastreados"
            value={summary.total}
            icon={<Car className="h-5 w-5 text-blue-600" />}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <KPICard
            label="En Línea"
            value={summary.online}
            icon={<Wifi className="h-5 w-5 text-emerald-600" />}
            color="emerald"
            active={filter === 'online'}
            onClick={() => setFilter('online')}
          />
          <KPICard
            label="Desconectados"
            value={summary.offline}
            icon={<WifiOff className="h-5 w-5 text-gray-500" />}
            color="gray"
            active={filter === 'offline'}
            onClick={() => setFilter('offline')}
          />
          <KPICard
            label="Batería Baja"
            value={summary.lowBattery}
            icon={<BatteryLow className="h-5 w-5 text-red-500" />}
            color="red"
            active={filter === 'lowBattery'}
            onClick={() => setFilter('lowBattery')}
          />
          <KPICard
            label="Sin Reporte 24h"
            value={summary.noReport24h}
            icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
            color="orange"
            active={filter === 'noReport'}
            onClick={() => setFilter('noReport')}
          />
        </div>

        {/* ── Controls ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por matrícula, marca, modelo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchFleetStatus(true)}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            Actualizar
          </Button>
        </div>

        {/* ── Table ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 rounded-full border-[3px] border-gray-200 border-t-blue-600 animate-spin" />
              <p className="text-sm text-gray-500">Cargando estado de flota...</p>
            </div>
          </div>
        ) : vehicles.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Car className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-lg font-semibold text-gray-600">Sin vehículos rastreados</p>
              <p className="text-sm text-gray-400 mt-1">
                Vincula dispositivos GPS a tus vehículos desde la sección GPS Flota
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/80">
                    <SortableHeader field="status" current={sortField} dir={sortDir} onClick={handleSort}>
                      Estado
                    </SortableHeader>
                    <SortableHeader field="matricula" current={sortField} dir={sortDir} onClick={handleSort}>
                      Vehículo
                    </SortableHeader>
                    <SortableHeader field="battery" current={sortField} dir={sortDir} onClick={handleSort}>
                      Batería
                    </SortableHeader>
                    <SortableHeader field="lastUpdate" current={sortField} dir={sortDir} onClick={handleSort}>
                      Último Reporte
                    </SortableHeader>
                    <SortableHeader field="distance" current={sortField} dir={sortDir} onClick={handleSort}>
                      Km Totales
                    </SortableHeader>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Velocidad</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Ubicación</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.map(v => (
                    <VehicleRow key={v.id} vehicle={v} />
                  ))}
                </tbody>
              </table>
            </div>
            {filteredVehicles.length === 0 && (
              <div className="py-8 text-center text-sm text-gray-400">
                No se encontraron vehículos con los filtros aplicados
              </div>
            )}
          </Card>
        )}

        {/* ── Daily Km Chart Section ── */}
        {vehicles.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Kilómetros Diarios</CardTitle>
                  <CardDescription>
                    {chartVehicle === 'all'
                      ? 'Km totales de la flota por día'
                      : `Km recorridos por ${vehicles.find(v => v.id === chartVehicle)?.matricula || 'vehículo'}`}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={chartPeriod} onValueChange={(v) => setChartPeriod(v as '7' | '14' | '30')}>
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Última semana</SelectItem>
                      <SelectItem value="14">Últimos 14 días</SelectItem>
                      <SelectItem value="30">Último mes</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={chartVehicle} onValueChange={setChartVehicle}>
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {vehicles.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.matricula}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {chartLoading ? (
                <div className="h-72 flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : processedChartData.length === 0 ? (
                <div className="h-72 flex flex-col items-center justify-center text-gray-400">
                  <Activity className="h-10 w-10 mb-2" />
                  <p className="text-sm">Sin datos de recorrido para este período</p>
                </div>
              ) : chartVehicle !== 'all' ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={processedChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                      <YAxis className="text-xs" tick={{ fontSize: 11 }} unit=" km" />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(value: number) => [`${value} km`, 'Distancia']}
                      />
                      <Bar
                        dataKey="km"
                        name="Km recorridos"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : perVehicleChartData ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={perVehicleChartData.data}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                      <YAxis className="text-xs" tick={{ fontSize: 11 }} unit=" km" />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      {perVehicleChartData.vehicles.map((v, i) => (
                        <Line
                          key={v.id}
                          type="monotone"
                          dataKey={v.matricula}
                          stroke={CHART_COLORS[i % CHART_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={processedChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                      <YAxis className="text-xs" tick={{ fontSize: 11 }} unit=" km" />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(value: number) => [`${value} km`, 'Total Flota']}
                      />
                      <Bar
                        dataKey="km"
                        name="Km totales"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

// ── Sub-components ──

function KPICard({
  label,
  value,
  icon,
  color = 'blue',
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        active && "ring-2 ring-blue-500 shadow-md"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-gray-50 flex items-center justify-center">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SortableHeader({
  field,
  current,
  dir,
  onClick,
  children,
}: {
  field: SortField;
  current: SortField;
  dir: SortDir;
  onClick: (f: SortField) => void;
  children: React.ReactNode;
}) {
  const isActive = current === field;
  return (
    <th
      className="px-4 py-3 text-left font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none"
      onClick={() => onClick(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {isActive && (
          <span className="text-blue-600">{dir === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  );
}

function VehicleRow({ vehicle: v }: { vehicle: VehicleStatus }) {
  return (
    <TooltipProvider delayDuration={200}>
      <tr className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
        {/* Status */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={cn(
              "h-2.5 w-2.5 rounded-full",
              v.isOnline ? "bg-emerald-500 animate-pulse" : "bg-gray-300"
            )} />
            <span className={cn(
              "text-xs font-medium",
              v.isOnline ? "text-emerald-600" : "text-gray-400"
            )}>
              {v.isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </td>

        {/* Vehicle */}
        <td className="px-4 py-3">
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900">{v.matricula}</span>
            <span className="text-xs text-gray-500">{v.marca} {v.modelo}</span>
          </div>
        </td>

        {/* Battery */}
        <td className="px-4 py-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                {getBatteryIcon(v.batteryLevel)}
                <span className={cn("text-xs font-medium", getBatteryColor(v.batteryLevel))}>
                  {v.batteryLevel !== null ? `${Math.round(v.batteryLevel)}%` : '—'}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {v.batteryLevel !== null
                ? `Batería: ${Math.round(v.batteryLevel)}%${v.isLowBattery ? ' ⚠️ Baja' : ''}`
                : 'Sin datos de batería'}
            </TooltipContent>
          </Tooltip>
        </td>

        {/* Last Update */}
        <td className="px-4 py-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <Clock className={cn("h-3.5 w-3.5", getLastUpdateColor(v.minutesSinceUpdate))} />
                <span className={cn("text-xs font-medium", getLastUpdateColor(v.minutesSinceUpdate))}>
                  {formatLastUpdate(v.minutesSinceUpdate)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {v.lastUpdate
                ? `Último reporte: ${new Date(v.lastUpdate).toLocaleString('es-ES')}`
                : 'Sin datos de reporte'}
            </TooltipContent>
          </Tooltip>
        </td>

        {/* Total Distance */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Navigation className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs font-medium text-gray-700">
              {formatDistance(v.totalDistanceKm)}
            </span>
          </div>
        </td>

        {/* Speed */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Gauge className="h-3.5 w-3.5 text-gray-400" />
            <span className={cn(
              "text-xs font-medium",
              v.speedKmh > 0 ? "text-blue-600" : "text-gray-400"
            )}>
              {v.speedKmh > 0 ? `${v.speedKmh} km/h` : 'Parado'}
            </span>
          </div>
        </td>

        {/* Location */}
        <td className="px-4 py-3 max-w-[200px]">
          {v.address ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-600 truncate">{v.address}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{v.address}</TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </td>
      </tr>
    </TooltipProvider>
  );
}
