import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  RefreshCw,
  AlertTriangle,
  Clock,
  Car,
  CheckCircle2,
  Loader2,
  Maximize,
  Minimize,
  ArrowDownToLine,
  ArrowUpFromLine,
  MapPin,
  Navigation,
  User,
  Sunrise,
  Sun,
  Sunset,
} from "lucide-react";

// ─── Corporate Colors (Azul Cars) ──────────────────────────────────────────
const COLORS = {
  navy: "#1a2332",
  navyLight: "#2a3a4e",
  gold: "#c9a96e",
  goldLight: "#d4b87a",
  beige: "#f8f5f0",
  white: "#ffffff",
  text: "#1a1a1a",
  textLight: "#4a5568",
  textMuted: "#718096",
};

interface OperationItem {
  type: "entrega" | "devolucion";
  time: string;
  location: string;
  modelo: string;
  auto: string;
  completed: boolean;
  assignedRentalName: string | null;
  enCamino: boolean;
  enCaminoAt: string | null;
}

interface OperationsData {
  date: string;
  summary: {
    totalOperations: number;
    totalEntregas: number;
    totalDevoluciones: number;
    completedOps: number;
    pendingOps: number;
  };
  operations: OperationItem[];
}

type TimeSlot = "manana" | "mediodia" | "tarde";

interface TimeSlotGroup {
  slot: TimeSlot;
  label: string;
  icon: typeof Sunrise;
  operations: OperationItem[];
  range: string;
}

function getTimeSlot(timeStr: string): TimeSlot {
  const hour = parseInt(timeStr.split(":")[0], 10);
  if (hour < 13) return "manana";
  if (hour < 17) return "mediodia";
  return "tarde";
}

function formatCurrentTime(): string {
  return new Date().toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatCurrentDate(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  const formatted = now.toLocaleDateString("es-ES", options);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function getTimeStatus(timeStr: string): "past" | "current" | "upcoming" {
  const now = new Date();
  const [hours, minutes] = timeStr.split(":").map(Number);
  const opTime = new Date();
  opTime.setHours(hours, minutes, 0, 0);

  const diffMinutes = (opTime.getTime() - now.getTime()) / 60000;

  if (diffMinutes < -30) return "past";
  if (diffMinutes <= 30) return "current";
  return "upcoming";
}

function formatEnCaminoTime(enCaminoAt: string | null): string {
  if (!enCaminoAt) return "";
  try {
    const date = new Date(enCaminoAt);
    return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// ─── Main TV Dashboard Page ─────────────────────────────────────────────────
export default function PublicOperationsTV() {
  const [data, setData] = useState<OperationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(formatCurrentTime());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Add noindex meta tag
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  // Update clock every second
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(formatCurrentTime());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen not supported or denied
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const now = new Date();
      const madridDate = now.toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });

      const res = await fetch(`/api/public/operations/azul-ops?date=${madridDate}`);
      if (!res.ok) throw new Error("Error al cargar datos");
      const json = await res.json();
      setData(json);
      setError(null);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + auto-refresh every 60 seconds
  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 60000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  // Group operations by time slot
  const timeSlotGroups = useMemo((): TimeSlotGroup[] => {
    if (!data) return [];

    const pendingOps = data.operations.filter((op) => !op.completed);

    const groups: TimeSlotGroup[] = [
      { slot: "manana", label: "Mañana", icon: Sunrise, operations: [], range: "07:00 – 12:59" },
      { slot: "mediodia", label: "Mediodía", icon: Sun, operations: [], range: "13:00 – 16:59" },
      { slot: "tarde", label: "Tarde", icon: Sunset, operations: [], range: "17:00 – 22:00" },
    ];

    for (const op of pendingOps) {
      const slot = getTimeSlot(op.time);
      const group = groups.find((g) => g.slot === slot);
      if (group) group.operations.push(op);
    }

    return groups.filter((g) => g.operations.length > 0);
  }, [data]);

  const enCaminoOps = useMemo(() => {
    if (!data) return [];
    return data.operations.filter((op) => op.enCamino && !op.completed);
  }, [data]);

  const completedOps = useMemo(() => {
    if (!data) return [];
    return data.operations.filter((op) => op.completed);
  }, [data]);

  const pendingOps = useMemo(() => {
    if (!data) return [];
    return data.operations.filter((op) => !op.completed);
  }, [data]);

  const overdueOps = useMemo(() => {
    return pendingOps.filter((op) => getTimeStatus(op.time) === "past" && !op.enCamino);
  }, [pendingOps]);

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.navy }}>
        <div className="text-center p-12">
          <AlertTriangle className="w-20 h-20 mx-auto mb-6" style={{ color: COLORS.gold }} />
          <h2 className="text-4xl font-bold mb-4" style={{ color: COLORS.white }}>
            Error al cargar datos
          </h2>
          <p className="text-2xl" style={{ color: "rgba(255,255,255,0.6)" }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: COLORS.navy }}>
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
        <div className="max-w-[1920px] mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold tracking-tight" style={{ color: COLORS.white }}>
                AZUL
              </span>
              <span className="text-3xl font-light" style={{ color: COLORS.gold }}>
                Cars
              </span>
            </div>
            <div className="h-8 w-px" style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
            <div className="flex items-center gap-3">
              <Car className="w-7 h-7" style={{ color: COLORS.gold }} />
              <span className="text-2xl font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>
                Operaciones del Día
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Live clock */}
            <div className="flex flex-col items-end">
              <span
                className="text-4xl font-mono font-bold tabular-nums"
                style={{ color: COLORS.white }}
              >
                {currentTime}
              </span>
              <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
                {formatCurrentDate()}
              </span>
            </div>

            {/* KPI pills */}
            {data && (
              <div className="flex items-center gap-3">
                {enCaminoOps.length > 0 && (
                  <div
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl animate-pulse"
                    style={{ backgroundColor: "rgba(59,130,246,0.15)" }}
                  >
                    <Navigation className="w-5 h-5" style={{ color: "#3b82f6" }} />
                    <span className="text-xl font-bold" style={{ color: "#3b82f6" }}>
                      {enCaminoOps.length}
                    </span>
                  </div>
                )}
                <div
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                  style={{ backgroundColor: "rgba(16,185,129,0.15)" }}
                >
                  <CheckCircle2 className="w-5 h-5" style={{ color: "#10b981" }} />
                  <span className="text-xl font-bold" style={{ color: "#10b981" }}>
                    {completedOps.length}
                  </span>
                </div>
                <div
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                  style={{ backgroundColor: "rgba(201,169,110,0.15)" }}
                >
                  <Clock className="w-5 h-5" style={{ color: COLORS.gold }} />
                  <span className="text-xl font-bold" style={{ color: COLORS.gold }}>
                    {pendingOps.length}
                  </span>
                </div>
              </div>
            )}

            {/* Fullscreen toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-3 rounded-xl transition-all hover:opacity-80"
              style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
              title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            >
              {isFullscreen ? (
                <Minimize className="w-6 h-6" style={{ color: COLORS.gold }} />
              ) : (
                <Maximize className="w-6 h-6" style={{ color: COLORS.gold }} />
              )}
            </button>

            {/* Refresh button */}
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-3 rounded-xl transition-all hover:opacity-80 disabled:opacity-50"
              style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            >
              <RefreshCw
                className={`w-6 h-6 ${loading ? "animate-spin" : ""}`}
                style={{ color: COLORS.gold }}
              />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Content ──────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden">
        {loading && !data ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-16 h-16 mx-auto mb-6 animate-spin" style={{ color: COLORS.gold }} />
              <p className="text-2xl font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
                Cargando programación...
              </p>
            </div>
          </div>
        ) : data && data.operations.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <CheckCircle2 className="w-28 h-28 mx-auto mb-8" style={{ color: "#10b981" }} />
              <h2 className="text-5xl font-bold mb-4" style={{ color: COLORS.white }}>
                Sin operaciones hoy
              </h2>
              <p className="text-2xl" style={{ color: "rgba(255,255,255,0.5)" }}>
                No hay entregas ni devoluciones programadas
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-[1920px] mx-auto px-8 py-6 h-full flex flex-col gap-5 overflow-y-auto">
            {/* ─── En Camino Section (always on top when active) ──────────── */}
            {enCaminoOps.length > 0 && (
              <section className="flex-shrink-0">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-3 h-3 rounded-full animate-pulse"
                    style={{ backgroundColor: "#3b82f6" }}
                  />
                  <Navigation className="w-5 h-5" style={{ color: "#3b82f6" }} />
                  <h2 className="text-xl font-semibold uppercase tracking-wider" style={{ color: "#60a5fa" }}>
                    En Camino
                  </h2>
                  <span
                    className="text-sm font-bold px-3 py-1 rounded-full"
                    style={{ backgroundColor: "rgba(59,130,246,0.15)", color: "#60a5fa" }}
                  >
                    {enCaminoOps.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {enCaminoOps.map((op, idx) => (
                    <OperationCard key={`encamino-${idx}`} op={op} highlight />
                  ))}
                </div>
              </section>
            )}

            {/* ─── Overdue Section ───────────────────────────────────────── */}
            {overdueOps.length > 0 && (
              <section className="flex-shrink-0">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-3 h-3 rounded-full animate-pulse"
                    style={{ backgroundColor: "#ef4444" }}
                  />
                  <h2 className="text-xl font-semibold uppercase tracking-wider" style={{ color: "#f87171" }}>
                    Atención — Operaciones retrasadas
                  </h2>
                  <span
                    className="text-sm font-bold px-3 py-1 rounded-full"
                    style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#f87171" }}
                  >
                    {overdueOps.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {overdueOps.map((op, idx) => (
                    <OperationCard key={`overdue-${idx}`} op={op} highlight />
                  ))}
                </div>
              </section>
            )}

            {/* ─── Time Slot Groups ──────────────────────────────────────── */}
            {timeSlotGroups.map((group) => {
              const Icon = group.icon;
              // Filter out en_camino and overdue ops (already shown above)
              const groupOps = group.operations.filter(
                (op) => !op.enCamino && getTimeStatus(op.time) !== "past"
              );
              if (groupOps.length === 0) return null;

              return (
                <section key={group.slot} className="flex-shrink-0">
                  {/* Time slot separator */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <Icon className="w-6 h-6" style={{ color: COLORS.gold }} />
                      <h2 className="text-xl font-semibold uppercase tracking-wider" style={{ color: COLORS.gold }}>
                        {group.label}
                      </h2>
                      <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
                        {group.range}
                      </span>
                    </div>
                    <div className="flex-1 h-px" style={{ backgroundColor: "rgba(201,169,110,0.2)" }} />
                    <span
                      className="text-sm font-bold px-3 py-1 rounded-full"
                      style={{ backgroundColor: "rgba(201,169,110,0.1)", color: COLORS.gold }}
                    >
                      {groupOps.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {groupOps.map((op, idx) => (
                      <OperationCard key={`${group.slot}-${idx}`} op={op} />
                    ))}
                  </div>
                </section>
              );
            })}

            {/* ─── Completed Operations (compact) ────────────────────────── */}
            {completedOps.length > 0 && (
              <section className="flex-shrink-0">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="w-5 h-5" style={{ color: "#10b981" }} />
                  <h2
                    className="text-lg font-semibold uppercase tracking-wider"
                    style={{ color: "rgba(16,185,129,0.7)" }}
                  >
                    Completadas hoy
                  </h2>
                  <span
                    className="text-sm font-bold px-3 py-1 rounded-full"
                    style={{ backgroundColor: "rgba(16,185,129,0.15)", color: "#10b981" }}
                  >
                    {completedOps.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {completedOps.map((op, idx) => (
                    <CompletedChip key={`done-${idx}`} op={op} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* ─── Footer (subtle) ───────────────────────────────────────────────── */}
      <footer className="flex-shrink-0 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <div className="max-w-[1920px] mx-auto px-8 py-3 flex items-center justify-between">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            Actualización automática cada 60 segundos
          </p>
          {lastUpdated && (
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              Última actualización: {lastUpdated.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}

// ─── Operation Card Component ───────────────────────────────────────────────
function OperationCard({ op, highlight }: { op: OperationItem; highlight?: boolean }) {
  const isEntrega = op.type === "entrega";
  const status = getTimeStatus(op.time);
  const isOverdue = status === "past" && !op.enCamino;

  const borderColor = op.enCamino
    ? "#3b82f6"
    : isOverdue
      ? "#ef4444"
      : highlight
        ? COLORS.gold
        : "rgba(255,255,255,0.1)";

  const bgColor = op.enCamino
    ? "rgba(59,130,246,0.08)"
    : isOverdue
      ? "rgba(239,68,68,0.08)"
      : highlight
        ? "rgba(201,169,110,0.06)"
        : "rgba(255,255,255,0.03)";

  return (
    <div
      className="rounded-2xl border-2 overflow-hidden transition-all"
      style={{
        borderColor,
        backgroundColor: bgColor,
        boxShadow: op.enCamino
          ? "0 0 20px rgba(59,130,246,0.15)"
          : isOverdue
            ? "0 0 20px rgba(239,68,68,0.15)"
            : undefined,
      }}
    >
      <div className="flex items-stretch">
        {/* Type color bar */}
        <div
          className="w-2 flex-shrink-0"
          style={{
            backgroundColor: op.enCamino
              ? "#3b82f6"
              : isEntrega
                ? "#16a34a"
                : "#ea580c",
          }}
        />

        <div className="flex-1 px-5 py-4 flex items-center gap-4">
          {/* Time */}
          <div className="flex-shrink-0 text-center" style={{ minWidth: "70px" }}>
            <p
              className="text-3xl font-mono font-bold"
              style={{ color: op.enCamino ? "#60a5fa" : isOverdue ? "#ef4444" : COLORS.white }}
            >
              {op.time}
            </p>
            {op.enCamino && (
              <p className="text-xs font-semibold mt-1 animate-pulse" style={{ color: "#60a5fa" }}>
                EN CAMINO
              </p>
            )}
            {isOverdue && !op.enCamino && (
              <p className="text-xs font-semibold mt-1" style={{ color: "#ef4444" }}>
                RETRASADA
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-14 flex-shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {/* Type badge */}
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase"
                style={{
                  backgroundColor: isEntrega ? "rgba(22,163,74,0.15)" : "rgba(234,88,12,0.15)",
                  color: isEntrega ? "#4ade80" : "#fb923c",
                }}
              >
                {isEntrega ? (
                  <ArrowDownToLine className="w-3 h-3" />
                ) : (
                  <ArrowUpFromLine className="w-3 h-3" />
                )}
                {isEntrega ? "Entrega" : "Devolución"}
              </span>

              {/* En Camino badge */}
              {op.enCamino && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold uppercase animate-pulse"
                  style={{ backgroundColor: "rgba(59,130,246,0.2)", color: "#60a5fa" }}
                >
                  <Navigation className="w-3 h-3" />
                  {formatEnCaminoTime(op.enCaminoAt) && `desde ${formatEnCaminoTime(op.enCaminoAt)}`}
                </span>
              )}
            </div>

            {/* Vehicle */}
            <p className="text-xl font-bold truncate" style={{ color: COLORS.white }}>
              {op.auto || op.modelo}
            </p>
            {op.auto && op.modelo && (
              <p className="text-sm truncate" style={{ color: "rgba(255,255,255,0.5)" }}>
                {op.modelo}
              </p>
            )}
          </div>

          {/* Right side: Location + Assigned */}
          <div className="flex-shrink-0 text-right max-w-[220px] flex flex-col gap-1.5">
            {/* Assigned rental */}
            {op.assignedRentalName && (
              <div className="flex items-center gap-1.5 justify-end">
                <User className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#a78bfa" }} />
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: "#c4b5fd" }}
                >
                  {op.assignedRentalName}
                </p>
              </div>
            )}
            {/* Location */}
            <div className="flex items-center gap-1.5 justify-end">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: COLORS.gold }} />
              <p
                className="text-sm font-medium truncate"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                {op.location}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Completed Chip Component ───────────────────────────────────────────────
function CompletedChip({ op }: { op: OperationItem }) {
  const isEntrega = op.type === "entrega";
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}
    >
      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#10b981" }} />
      <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
        {op.time}
      </span>
      <span
        className="text-xs font-bold"
        style={{ color: isEntrega ? "#4ade80" : "#fb923c" }}
      >
        {isEntrega ? "E" : "D"}
      </span>
      <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>
        {op.auto || op.modelo}
      </span>
      {op.assignedRentalName && (
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          · {op.assignedRentalName}
        </span>
      )}
    </div>
  );
}
