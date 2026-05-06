import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { usePublicOperations, HourlyData, ModelAvailability } from "@/hooks/usePublicOperations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Car,
  Clock,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  CalendarDays,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  TrendingUp,
  Sparkles,
} from "lucide-react";

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

function getLoadColor(load: string): string {
  switch (load) {
    case "libre": return "bg-gray-100 text-gray-400 border-gray-200";
    case "baja": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "media": return "bg-amber-50 text-amber-700 border-amber-200";
    case "alta": return "bg-red-50 text-red-700 border-red-200";
    default: return "bg-gray-100 text-gray-500 border-gray-200";
  }
}

function getLoadBgBar(load: string): string {
  switch (load) {
    case "libre": return "bg-gray-200";
    case "baja": return "bg-emerald-400";
    case "media": return "bg-amber-400";
    case "alta": return "bg-red-400";
    default: return "bg-gray-200";
  }
}

function getLoadLabel(load: string): string {
  switch (load) {
    case "libre": return "Libre";
    case "baja": return "Baja";
    case "media": return "Media";
    case "alta": return "Alta";
    default: return "";
  }
}

// ─── Timeline Row Component ──────────────────────────────────────────────────
function TimelineRow({ hourData, maxOps }: { hourData: HourlyData; maxOps: number }) {
  const barWidth = maxOps > 0 ? (hourData.total / maxOps) * 100 : 0;

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${getLoadColor(hourData.load)}`}>
      <span className="text-sm font-mono font-semibold w-12 shrink-0">
        {formatHour(hourData.hour)}
      </span>

      <div className="flex-1 min-w-0">
        <div className="h-6 bg-white/60 rounded-full overflow-hidden relative">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getLoadBgBar(hourData.load)}`}
            style={{ width: `${barWidth}%` }}
          />
          {hourData.total > 0 && (
            <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-800">
              {hourData.total} op{hourData.total !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 text-xs">
        {hourData.entregas > 0 && (
          <span className="flex items-center gap-0.5 text-blue-600">
            <ArrowDownToLine className="w-3 h-3" />
            {hourData.entregas}
          </span>
        )}
        {hourData.devoluciones > 0 && (
          <span className="flex items-center gap-0.5 text-purple-600">
            <ArrowUpFromLine className="w-3 h-3" />
            {hourData.devoluciones}
          </span>
        )}
      </div>

      <span className="text-[10px] font-medium uppercase tracking-wide w-10 text-center shrink-0">
        {getLoadLabel(hourData.load)}
      </span>
    </div>
  );
}

// ─── Model Availability Card ─────────────────────────────────────────────────
function ModelCard({ model }: { model: ModelAvailability }) {
  const availablePercent = model.total > 0 ? (model.limpios / model.total) * 100 : 0;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-white hover:shadow-sm transition-shadow">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">{model.modelo}</p>
        {model.categoria && (
          <p className="text-xs text-gray-500 truncate">{model.categoria}</p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-3">
        <div className="text-center">
          <p className="text-sm font-bold text-emerald-600">{model.limpios}</p>
          <p className="text-[10px] text-gray-500">Limpios</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-amber-600">{model.pendientes}</p>
          <p className="text-[10px] text-gray-500">Pend.</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-gray-400">{model.no_disponibles}</p>
          <p className="text-[10px] text-gray-500">No disp.</p>
        </div>
        <div className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center">
          <span className="text-xs font-bold" style={{ color: availablePercent > 50 ? '#10b981' : availablePercent > 0 ? '#f59e0b' : '#ef4444' }}>
            {model.total}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ─────────────────────────────────────────────────────
export default function PublicOperations() {
  const { slug } = useParams<{ slug: string }>();

  // Add noindex meta tag to prevent search engine indexing
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().split("T")[0];
  });
  const [selectedLocation, setSelectedLocation] = useState("all");

  const { data, loading, error, refetch } = usePublicOperations(
    slug || "",
    selectedDate,
    selectedLocation
  );

  // Date navigation
  const goToDay = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  const maxOps = useMemo(() => {
    if (!data) return 1;
    return Math.max(...data.hourly.map(h => h.total), 1);
  }, [data]);

  // Filter models with at least 1 clean vehicle
  const modelsWithAvailability = useMemo(() => {
    if (!data) return [];
    return data.fleet.byModel.filter(m => m.limpios > 0);
  }, [data]);

  const modelsWithoutAvailability = useMemo(() => {
    if (!data) return [];
    return data.fleet.byModel.filter(m => m.limpios === 0 && m.total > 0);
  }, [data]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <Car className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Panel de Operaciones</h1>
              <p className="text-xs text-gray-500">Vista comercial</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Date & Location Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1">
            <Button variant="ghost" size="sm" onClick={() => goToDay(-1)} className="h-8 px-2">
              ←
            </Button>
            <div className="flex items-center gap-1.5 px-2">
              <CalendarDays className="w-4 h-4 text-gray-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-sm font-medium bg-transparent border-none outline-none cursor-pointer"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => goToDay(1)} className="h-8 px-2">
              →
            </Button>
            {!isToday && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])} className="h-8 px-2 text-blue-600">
                Hoy
              </Button>
            )}
          </div>

          {data && data.filters.locations.length > 0 && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-gray-500" />
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger className="w-[200px] h-8 text-sm">
                  <SelectValue placeholder="Todas las ubicaciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las ubicaciones</SelectItem>
                  {data.filters.locations.map((loc) => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : data ? (
          <>
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border-0 shadow-sm bg-white">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{data.summary.totalOperations}</p>
                  <p className="text-xs text-gray-500 mt-1">Operaciones</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-white">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{data.summary.totalEntregas}</p>
                  <p className="text-xs text-gray-500 mt-1">Entregas</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-white">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-purple-600">{data.summary.totalDevoluciones}</p>
                  <p className="text-xs text-gray-500 mt-1">Devoluciones</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-white">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{data.summary.completedOps}</p>
                  <p className="text-xs text-gray-500 mt-1">Completadas</p>
                </CardContent>
              </Card>
            </div>

            {/* Main Grid: Timeline + Fleet */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Timeline (2/3 width) */}
              <div className="lg:col-span-2 space-y-4">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      Carga por Hora
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {data.hourly.map((h) => (
                      <TimelineRow key={h.hour} hourData={h} maxOps={maxOps} />
                    ))}
                  </CardContent>
                </Card>

                {/* Recommended Slots */}
                {data.recommendedSlots.length > 0 && (
                  <Card className="border-0 shadow-sm border-l-4 border-l-emerald-400">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-emerald-700">
                        <Sparkles className="w-4 h-4" />
                        Franjas Recomendadas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {data.recommendedSlots.map((slot) => (
                          <span
                            key={slot.hour}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium border border-emerald-200"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {formatHour(slot.hour)}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Estas franjas tienen poca carga operativa — ideales para programar nuevas entregas o devoluciones.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Saturated Slots Warning */}
                {data.saturatedSlots.length > 0 && (
                  <Card className="border-0 shadow-sm border-l-4 border-l-red-400">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                        <AlertTriangle className="w-4 h-4" />
                        Franjas Saturadas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {data.saturatedSlots.map((slot) => (
                          <span
                            key={slot.hour}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-50 text-red-700 text-sm font-medium border border-red-200"
                          >
                            {formatHour(slot.hour)} ({slot.total} ops)
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Evitar programar operaciones en estas franjas si es posible.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Fleet Status Sidebar (1/3 width) */}
              <div className="space-y-4">
                {/* Fleet Status Summary */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                      Estado de Flota
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                        <p className="text-xl font-bold text-emerald-600">{data.fleet.status.limpio}</p>
                        <p className="text-[10px] text-emerald-700 font-medium uppercase">Limpios</p>
                      </div>
                      <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-center">
                        <p className="text-xl font-bold text-red-600">{data.fleet.status.sucio}</p>
                        <p className="text-[10px] text-red-700 font-medium uppercase">Sucios</p>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-center">
                        <p className="text-xl font-bold text-amber-600">{data.fleet.status.incompleto}</p>
                        <p className="text-[10px] text-amber-700 font-medium uppercase">Incompletos</p>
                      </div>
                      <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-center">
                        <p className="text-xl font-bold text-purple-600">{data.fleet.status.en_servicio}</p>
                        <p className="text-[10px] text-purple-700 font-medium uppercase">En Servicio</p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-center">
                      <p className="text-xl font-bold text-blue-600">{data.fleet.status.alquilado}</p>
                      <p className="text-[10px] text-blue-700 font-medium uppercase">Alquilados</p>
                    </div>

                    {/* Visual bar */}
                    <div className="h-3 rounded-full overflow-hidden flex bg-gray-100">
                      {data.fleet.status.total > 0 && (
                        <>
                          <div className="bg-emerald-400 transition-all" style={{ width: `${(data.fleet.status.limpio / data.fleet.status.total) * 100}%` }} />
                          <div className="bg-red-400 transition-all" style={{ width: `${(data.fleet.status.sucio / data.fleet.status.total) * 100}%` }} />
                          <div className="bg-amber-400 transition-all" style={{ width: `${(data.fleet.status.incompleto / data.fleet.status.total) * 100}%` }} />
                          <div className="bg-purple-400 transition-all" style={{ width: `${(data.fleet.status.en_servicio / data.fleet.status.total) * 100}%` }} />
                          <div className="bg-blue-400 transition-all" style={{ width: `${(data.fleet.status.alquilado / data.fleet.status.total) * 100}%` }} />
                        </>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 text-center">
                      {data.fleet.status.total} vehículos en total
                    </p>
                  </CardContent>
                </Card>

                {/* Models with availability */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Disponibles por Modelo
                    </CardTitle>
                    <p className="text-xs text-gray-500">Modelos con al menos 1 vehículo limpio</p>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
                    {modelsWithAvailability.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No hay modelos disponibles</p>
                    ) : (
                      modelsWithAvailability.map((m) => (
                        <ModelCard key={m.modelo} model={m} />
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Models without availability */}
                {modelsWithoutAvailability.length > 0 && (
                  <Card className="border-0 shadow-sm opacity-75">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2 text-gray-500">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Sin Disponibilidad
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1.5 max-h-[300px] overflow-y-auto">
                      {modelsWithoutAvailability.map((m) => (
                        <div key={m.modelo} className="flex items-center justify-between px-3 py-2 rounded border border-gray-100 bg-gray-50 text-sm">
                          <span className="text-gray-600 truncate">{m.modelo}</span>
                          <span className="text-xs text-gray-400 shrink-0 ml-2">{m.total} total</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-12 py-4">
        <p className="text-center text-xs text-gray-400">
          Datos actualizados en tiempo real · Solo lectura
        </p>
      </footer>
    </div>
  );
}
