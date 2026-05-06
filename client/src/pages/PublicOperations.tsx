import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { usePublicOperations, HourlyData, ModelAvailability } from "@/hooks/usePublicOperations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Clock,
  Sparkles,
  Car,
  CalendarDays,
} from "lucide-react";

// ─── Corporate Colors ───────────────────────────────────────────────────────
const COLORS = {
  navy: "#1a2332",
  navyLight: "#2a3a4e",
  gold: "#c9a96e",
  goldLight: "#d4b87a",
  goldDark: "#b8944f",
  beige: "#f8f5f0",
  beigeDark: "#ede8e0",
  white: "#ffffff",
  text: "#2d3748",
  textLight: "#718096",
  textMuted: "#a0aec0",
};

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

function getLoadInfo(load: string): { label: string; color: string; bg: string; bar: string } {
  switch (load) {
    case "libre": return { label: "Libre", color: COLORS.textMuted, bg: "bg-gray-50", bar: "bg-gray-200" };
    case "baja": return { label: "Baja", color: "#059669", bg: "bg-emerald-50/50", bar: "bg-emerald-400" };
    case "media": return { label: "Media", color: "#d97706", bg: "bg-amber-50/50", bar: "bg-amber-400" };
    case "alta": return { label: "Alta", color: "#dc2626", bg: "bg-red-50/50", bar: "bg-red-400" };
    default: return { label: "", color: COLORS.textMuted, bg: "bg-gray-50", bar: "bg-gray-200" };
  }
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
  const formatted = d.toLocaleDateString("es-ES", options);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

// ─── Timeline Row ───────────────────────────────────────────────────────────
function TimelineRow({ hourData, maxOps }: { hourData: HourlyData; maxOps: number }) {
  const barWidth = maxOps > 0 ? (hourData.total / maxOps) * 100 : 0;
  const loadInfo = getLoadInfo(hourData.load);
  const isEmpty = hourData.total === 0;

  return (
    <div className={`flex items-center gap-4 py-2.5 px-4 rounded-lg transition-all ${isEmpty ? "opacity-50" : "hover:bg-white/80"}`}>
      <span className="text-sm font-medium w-12 shrink-0" style={{ color: isEmpty ? COLORS.textMuted : COLORS.navy, fontFamily: "'Inter', sans-serif" }}>
        {formatHour(hourData.hour)}
      </span>

      <div className="flex-1 min-w-0">
        <div className="h-7 bg-gray-100/80 rounded overflow-hidden relative">
          {hourData.total > 0 && (
            <div
              className={`h-full rounded transition-all duration-700 ease-out ${loadInfo.bar}`}
              style={{ width: `${Math.max(barWidth, 8)}%`, opacity: 0.85 }}
            />
          )}
          {hourData.total > 0 && (
            <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold" style={{ color: COLORS.navy }}>
              {hourData.total} {hourData.total === 1 ? "operación" : "operaciones"}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 text-xs w-20 justify-end">
        {hourData.entregas > 0 && (
          <span className="flex items-center gap-0.5" style={{ color: "#2563eb" }}>
            <ArrowDownToLine className="w-3.5 h-3.5" />
            {hourData.entregas}
          </span>
        )}
        {hourData.devoluciones > 0 && (
          <span className="flex items-center gap-0.5" style={{ color: "#7c3aed" }}>
            <ArrowUpFromLine className="w-3.5 h-3.5" />
            {hourData.devoluciones}
          </span>
        )}
      </div>

      <span
        className="text-[11px] font-semibold uppercase tracking-wider w-12 text-right shrink-0"
        style={{ color: loadInfo.color }}
      >
        {loadInfo.label}
      </span>
    </div>
  );
}

// ─── Model Availability Row ─────────────────────────────────────────────────
function ModelRow({ model }: { model: ModelAvailability }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-gray-100 last:border-0 hover:bg-white/60 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate" style={{ color: COLORS.navy }}>{model.modelo}</p>
        {model.categoria && (
          <p className="text-xs mt-0.5" style={{ color: COLORS.textLight }}>{model.categoria}</p>
        )}
      </div>
      <div className="flex items-center gap-4 shrink-0 ml-4">
        <div className="text-center w-12">
          <p className="text-sm font-bold text-emerald-600">{model.limpios}</p>
          <p className="text-[9px] uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Listos</p>
        </div>
        <div className="text-center w-12">
          <p className="text-sm font-bold text-amber-500">{model.pendientes}</p>
          <p className="text-[9px] uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Pend.</p>
        </div>
        <div className="text-center w-12">
          <p className="text-sm font-bold" style={{ color: COLORS.textMuted }}>{model.no_disponibles}</p>
          <p className="text-[9px] uppercase tracking-wide" style={{ color: COLORS.textMuted }}>En uso</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function PublicOperations() {
  const { slug } = useParams<{ slug: string }>();

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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.beige }}>
        <div className="max-w-md w-full mx-4 bg-white rounded-2xl shadow-lg p-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: COLORS.gold }} />
          <h2 className="text-lg font-semibold mb-2" style={{ color: COLORS.navy }}>Error al cargar datos</h2>
          <p style={{ color: COLORS.textLight }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.beige }}>
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 shadow-sm" style={{ backgroundColor: COLORS.navy }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight" style={{ color: COLORS.white }}>AZUL</span>
              <span className="text-xl font-light" style={{ color: COLORS.gold }}>Cars</span>
            </div>
            <div className="hidden sm:block h-6 w-px bg-white/20" />
            <p className="hidden sm:block text-sm font-light" style={{ color: "rgba(255,255,255,0.7)" }}>
              Panel de Operaciones
            </p>
          </div>

          <button
            onClick={() => refetch()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: COLORS.gold, color: COLORS.navy }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ─── Date & Filters ───────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToDay(-1)}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-white"
              style={{ color: COLORS.navy }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2.5 shadow-sm border border-gray-100">
              <CalendarDays className="w-4 h-4" style={{ color: COLORS.gold }} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-sm font-medium bg-transparent border-none outline-none cursor-pointer"
                style={{ color: COLORS.navy }}
              />
            </div>

            <button
              onClick={() => goToDay(1)}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-white"
              style={{ color: COLORS.navy }}
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {!isToday && (
              <button
                onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
                className="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-white"
                style={{ color: COLORS.gold }}
              >
                Hoy
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <p className="text-sm font-medium hidden lg:block" style={{ color: COLORS.navy }}>
              {formatDateDisplay(selectedDate)}
            </p>

            {data && data.filters.locations.length > 0 && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" style={{ color: COLORS.gold }} />
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="w-[220px] h-9 text-sm bg-white border-gray-200 rounded-lg">
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
        </div>

        {loading && !data ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: COLORS.gold }} />
            <p className="text-sm" style={{ color: COLORS.textLight }}>Cargando datos...</p>
          </div>
        ) : data ? (
          <>
            {/* ─── KPIs ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { value: data.summary.totalOperations, label: "Operaciones", icon: Car },
                { value: data.summary.totalEntregas, label: "Entregas", icon: ArrowDownToLine },
                { value: data.summary.totalDevoluciones, label: "Devoluciones", icon: ArrowUpFromLine },
                { value: data.summary.completedOps, label: "Completadas", icon: CheckCircle2 },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-center">
                  <kpi.icon className="w-5 h-5 mx-auto mb-2" style={{ color: COLORS.gold }} />
                  <p className="text-3xl font-bold" style={{ color: COLORS.navy }}>{kpi.value}</p>
                  <p className="text-xs mt-1 font-medium uppercase tracking-wide" style={{ color: COLORS.textLight }}>{kpi.label}</p>
                </div>
              ))}
            </div>

            {/* ─── Main Grid ────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Timeline (2/3) */}
              <div className="lg:col-span-2 space-y-5">
                {/* Hourly Timeline */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                    <Clock className="w-4 h-4" style={{ color: COLORS.gold }} />
                    <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: COLORS.navy }}>
                      Carga Operativa por Hora
                    </h2>
                  </div>
                  <div className="py-2 divide-y divide-gray-50">
                    {data.hourly.map((h) => (
                      <TimelineRow key={h.hour} hourData={h} maxOps={maxOps} />
                    ))}
                  </div>
                </div>

                {/* Recommended Slots */}
                {data.recommendedSlots.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" style={{ color: COLORS.gold }} />
                      <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: COLORS.navy }}>
                        Franjas Recomendadas
                      </h2>
                    </div>
                    <div className="p-5">
                      <div className="flex flex-wrap gap-2">
                        {data.recommendedSlots.map((slot) => (
                          <span
                            key={slot.hour}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border"
                            style={{ backgroundColor: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {formatHour(slot.hour)}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs mt-3" style={{ color: COLORS.textLight }}>
                        Franjas con baja carga operativa — ideales para programar nuevas entregas o devoluciones.
                      </p>
                    </div>
                  </div>
                )}

                {/* Saturated Slots */}
                {data.saturatedSlots.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-red-100 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-red-700">
                        Franjas Saturadas
                      </h2>
                    </div>
                    <div className="p-5">
                      <div className="flex flex-wrap gap-2">
                        {data.saturatedSlots.map((slot) => (
                          <span
                            key={slot.hour}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-red-50 border border-red-200 text-red-700"
                          >
                            {formatHour(slot.hour)} ({slot.total} ops)
                          </span>
                        ))}
                      </div>
                      <p className="text-xs mt-3 text-red-600/70">
                        Evitar programar operaciones en estas franjas si es posible.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Fleet Sidebar (1/3) */}
              <div className="space-y-5">
                {/* Fleet Status */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                    <Car className="w-4 h-4" style={{ color: COLORS.gold }} />
                    <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: COLORS.navy }}>
                      Estado de Flota
                    </h2>
                  </div>
                  <div className="p-5 space-y-4">
                    {/* Status Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "#f0fdf4" }}>
                        <p className="text-2xl font-bold text-emerald-600">{data.fleet.status.limpio}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 mt-1">Limpios</p>
                      </div>
                      <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "#fef2f2" }}>
                        <p className="text-2xl font-bold text-red-500">{data.fleet.status.sucio}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-red-600 mt-1">Sucios</p>
                      </div>
                      <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "#fffbeb" }}>
                        <p className="text-2xl font-bold text-amber-500">{data.fleet.status.incompleto}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 mt-1">Incompletos</p>
                      </div>
                      <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "#faf5ff" }}>
                        <p className="text-2xl font-bold text-purple-500">{data.fleet.status.en_servicio}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-600 mt-1">En Servicio</p>
                      </div>
                    </div>

                    {/* Alquilados - full width */}
                    <div className="rounded-xl p-4 text-center" style={{ backgroundColor: COLORS.beigeDark }}>
                      <p className="text-2xl font-bold" style={{ color: COLORS.navy }}>{data.fleet.status.alquilado}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.navyLight }}>Alquilados</p>
                    </div>

                    {/* Bar */}
                    <div className="h-2.5 rounded-full overflow-hidden flex bg-gray-100">
                      {data.fleet.status.total > 0 && (
                        <>
                          <div className="bg-emerald-400" style={{ width: `${(data.fleet.status.limpio / data.fleet.status.total) * 100}%` }} />
                          <div className="bg-red-400" style={{ width: `${(data.fleet.status.sucio / data.fleet.status.total) * 100}%` }} />
                          <div className="bg-amber-400" style={{ width: `${(data.fleet.status.incompleto / data.fleet.status.total) * 100}%` }} />
                          <div className="bg-purple-400" style={{ width: `${(data.fleet.status.en_servicio / data.fleet.status.total) * 100}%` }} />
                          <div style={{ width: `${(data.fleet.status.alquilado / data.fleet.status.total) * 100}%`, backgroundColor: COLORS.navyLight }} />
                        </>
                      )}
                    </div>
                    <p className="text-xs text-center" style={{ color: COLORS.textMuted }}>
                      {data.fleet.status.total} vehículos en total
                    </p>
                  </div>
                </div>

                {/* Available Models */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: COLORS.navy }}>
                        Disponibles
                      </h2>
                    </div>
                    <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
                      Modelos con vehículos listos para entregar
                    </p>
                  </div>
                  <div className="max-h-[380px] overflow-y-auto">
                    {modelsWithAvailability.length === 0 ? (
                      <p className="text-sm text-center py-8" style={{ color: COLORS.textMuted }}>
                        No hay modelos disponibles
                      </p>
                    ) : (
                      modelsWithAvailability.map((m) => (
                        <ModelRow key={m.modelo} model={m} />
                      ))
                    )}
                  </div>
                </div>

                {/* Unavailable Models */}
                {modelsWithoutAvailability.length > 0 && (
                  <div className="bg-white/70 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: COLORS.textLight }}>
                        Sin Disponibilidad
                      </h2>
                    </div>
                    <div className="max-h-[250px] overflow-y-auto divide-y divide-gray-50">
                      {modelsWithoutAvailability.map((m) => (
                        <div key={m.modelo} className="flex items-center justify-between px-5 py-2.5">
                          <span className="text-sm truncate" style={{ color: COLORS.textLight }}>{m.modelo}</span>
                          <span className="text-xs shrink-0 ml-2" style={{ color: COLORS.textMuted }}>{m.total} uds</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </main>

      {/* ─── Footer ─────────────────────────────────────────────────────── */}
      <footer className="mt-12 py-6 border-t" style={{ borderColor: COLORS.beigeDark }}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: COLORS.navy }}>AZUL</span>
            <span className="text-sm" style={{ color: COLORS.gold }}>Cars</span>
          </div>
          <p className="text-xs" style={{ color: COLORS.textMuted }}>
            Datos en tiempo real · Solo lectura
          </p>
        </div>
      </footer>
    </div>
  );
}
