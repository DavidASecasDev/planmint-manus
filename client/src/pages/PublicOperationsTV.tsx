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
  ArrowRightLeft,
  MapPin,
  Navigation,
  User,
  Users,
  Sunrise,
  Sun,
  Sunset,
  Sparkles,
  Droplets,
  CircleDashed,
  Wrench,
  Bus,
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
  type: "entrega" | "devolucion" | "transfer";
  time: string;
  location: string;
  address: string | null;
  modelo: string;
  auto: string;
  completed: boolean;
  assignedRentalName: string | null;
  assignedEscobaName: string | null;
  isTeamRental?: boolean;
  isTeamEscoba?: boolean;
  clientName: string | null;
  enCamino: boolean;
  enCaminoAt: string | null;
  vehicleStatus: string | null;
  isManualVehicle?: boolean;
  isShuttle?: boolean;
}

interface OperationsData {
  date: string;
  summary: {
    totalOperations: number;
    totalEntregas: number;
    totalDevoluciones: number;
    totalTransfers?: number;
    completedOps: number;
    pendingOps: number;
  };
  operations: OperationItem[];
}

type TimeSlot = "manana" | "mediodia" | "tarde";

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

const TIME_SLOT_CONFIG: Record<TimeSlot, { label: string; icon: typeof Sunrise; range: string }> = {
  manana: { label: "Mañana", icon: Sunrise, range: "07:00 – 12:59" },
  mediodia: { label: "Mediodía", icon: Sun, range: "13:00 – 16:59" },
  tarde: { label: "Tarde", icon: Sunset, range: "17:00 – 22:00" },
};

// ─── Main TV Dashboard Page ─────────────────────────────────────────────────
export default function PublicOperationsTV() {
  const [data, setData] = useState<OperationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(formatCurrentTime());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const scrollAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Auto-scroll: smoothly scroll down, pause at bottom, then jump back to top
  useEffect(() => {
    if (!autoScroll) {
      if (scrollAnimRef.current) {
        clearInterval(scrollAnimRef.current);
        scrollAnimRef.current = null;
      }
      return;
    }

    const TICK_MS = 30; // interval in ms (~33fps)
    const PAUSE_AT_BOTTOM_MS = 4000; // pause 4s at bottom before resetting
    const PAUSE_AT_TOP_MS = 3000; // pause 3s at top before scrolling again
    let paused = false;

    scrollAnimRef.current = setInterval(() => {
      const el = mainRef.current;
      if (!el || paused) return;

      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll <= 0) return; // Content fits, no scroll needed

      // Adaptive speed: more content = faster scroll (target ~25s full cycle)
      const speed = Math.max(1, Math.min(4, Math.ceil(maxScroll / 800)));

      if (el.scrollTop >= maxScroll - 2) {
        // Reached bottom: pause, then reset to top
        paused = true;
        setTimeout(() => {
          if (el) el.scrollTop = 0;
          // Pause at top before resuming
          setTimeout(() => { paused = false; }, PAUSE_AT_TOP_MS);
        }, PAUSE_AT_BOTTOM_MS);
      } else {
        el.scrollTop += speed;
      }
    }, TICK_MS);

    return () => {
      if (scrollAnimRef.current) {
        clearInterval(scrollAnimRef.current);
        scrollAnimRef.current = null;
      }
    };
  }, [autoScroll]);

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

  // Organize operations
  const { enCaminoOps, overdueOps, slotGroups, completedOps, pendingCount } = useMemo(() => {
    if (!data) return { enCaminoOps: [], overdueOps: [], slotGroups: [] as { slot: TimeSlot; ops: OperationItem[] }[], completedOps: [], pendingCount: 0 };

    const pending = data.operations.filter((op) => !op.completed);
    const completed = data.operations.filter((op) => op.completed);
    const enCamino = pending.filter((op) => op.enCamino);
    const overdue = pending.filter((op) => !op.enCamino && getTimeStatus(op.time) === "past");
    const remaining = pending.filter((op) => !op.enCamino && getTimeStatus(op.time) !== "past");

    // Group remaining by time slot
    const slotMap: Record<TimeSlot, OperationItem[]> = { manana: [], mediodia: [], tarde: [] };
    for (const op of remaining) {
      slotMap[getTimeSlot(op.time)].push(op);
    }

    const groups = (["manana", "mediodia", "tarde"] as TimeSlot[])
      .filter((s) => slotMap[s].length > 0)
      .map((s) => ({ slot: s, ops: slotMap[s] }));

    return { enCaminoOps: enCamino, overdueOps: overdue, slotGroups: groups, completedOps: completed, pendingCount: pending.length };
  }, [data]);

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
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: COLORS.navy }}>
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
        <div className="max-w-[1920px] mx-auto px-8 py-4 flex items-center justify-between">
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
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                    style={{ backgroundColor: "rgba(59,130,246,0.15)" }}
                  >
                    <Navigation className="w-5 h-5 animate-pulse" style={{ color: "#3b82f6" }} />
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
                    {pendingCount}
                  </span>
                </div>
              </div>
            )}

            {/* Auto-scroll toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className="p-3 rounded-xl transition-all hover:opacity-80"
              style={{ backgroundColor: autoScroll ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.1)" }}
              title={autoScroll ? "Pausar auto-scroll" : "Activar auto-scroll"}
            >
              <svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke={autoScroll ? "#34d399" : COLORS.gold}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </button>

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

      {/* ─── Progress Bar ─────────────────────────────────────────────────── */}
      {data && data.operations.length > 0 && (() => {
        const total = data.operations.length;
        const completed = completedOps.length;
        const pct = Math.round((completed / total) * 100);
        return (
          <div className="flex-shrink-0 px-8 py-2" style={{ backgroundColor: "rgba(0,0,0,0.2)" }}>
            <div className="max-w-[1920px] mx-auto flex items-center gap-4">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.5)" }}>
                Progreso del día
              </span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: pct === 100 ? "#10b981" : COLORS.gold,
                  }}
                />
              </div>
              <span className="text-sm font-bold tabular-nums" style={{ color: pct === 100 ? "#10b981" : COLORS.gold }}>
                {completed}/{total} ({pct}%)
              </span>
            </div>
          </div>
        );
      })()}

      {/* ─── Fixed Column Header ────────────────────────────────────────────── */}
      {data && data.operations.length > 0 && (() => {
        const totalOps = data.operations.length;
        const compact = totalOps > 20;
        return (
          <div
            className={`flex-shrink-0 max-w-[1920px] mx-auto w-full grid gap-4 ${compact ? "px-11 py-1.5 text-[10px]" : "px-16 py-2.5 text-xs"} font-semibold uppercase tracking-wider`}
            style={{
              gridTemplateColumns: compact ? "60px 85px 85px 1fr 130px 100px 100px 1fr" : "70px 100px 100px 1fr 150px 120px 120px 1fr",
              color: "rgba(255,255,255,0.5)",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              backgroundColor: "rgba(0,0,0,0.3)",
            }}
          >
            <span>Hora</span>
            <span>Tipo</span>
            <span>Estado</span>
            <span>Vehículo</span>
            <span>Cliente</span>
            <span>Rental</span>
            <span>Escoba</span>
            <span>Dirección</span>
          </div>
        );
      })()}

      {/* ─── Scrollable Rows (flat list, all operations sorted by time) ─── */}
      <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" style={{ scrollBehavior: "auto" }}>
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
        ) : (() => {
          const totalOps = (data?.operations || []).length;
          const compact = totalOps > 20;
          // Flat sorted list: all operations by time
          const allOps = [...(data?.operations || [])].sort((a, b) => a.time.localeCompare(b.time));
          return (
          <div className="max-w-[1920px] mx-auto">
            {allOps.map((op, idx) => (
              <OperationRow key={idx} op={op} variant={op.completed ? "completed" : op.enCamino ? "enCamino" : getTimeStatus(op.time) === "past" ? "overdue" : "normal"} isLast={idx === allOps.length - 1} borderColor="rgba(255,255,255,0.06)" compact={compact} />
            ))}
          </div>
          );
        })()}
      </main>

      {/* ─── Footer ───────────────────────────────────────────────────────── */}
      <footer className="flex-shrink-0 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <div className="max-w-[1920px] mx-auto px-8 py-3 flex items-center justify-between">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            Actualización automática cada 60 segundos
          </p>

          {/* Vehicle status legend */}
          <div className="flex items-center gap-4">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>Estado limpieza:</span>
            <div className="flex items-center gap-1">
              <Sparkles className="w-3 h-3" style={{ color: "#34d399" }} />
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>Limpio</span>
            </div>
            <div className="flex items-center gap-1">
              <Droplets className="w-3 h-3" style={{ color: "#ef4444" }} />
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>Sucio</span>
            </div>
            <div className="flex items-center gap-1">
              <CircleDashed className="w-3 h-3" style={{ color: "#f59e0b" }} />
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>Incompleto</span>
            </div>

          </div>

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

// ─── Section Header ─────────────────────────────────────────────────────────
function SectionHeader({
  icon,
  label,
  count,
  color,
  pulse,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
  pulse?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 mb-2 py-1">
      {pulse && (
        <div
          className="w-2.5 h-2.5 rounded-full animate-pulse"
          style={{ backgroundColor: color }}
        />
      )}
      {icon}
      <h2 className="text-lg font-semibold uppercase tracking-wider" style={{ color }}>
        {label}
      </h2>
      <span
        className="text-sm font-bold px-3 py-1 rounded-full"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {count}
      </span>
    </div>
  );
}

// ─── Operation Rows (only rows, no header) ───────────────────────────────────
function OperationRows({
  ops,
  variant,
  compact = false,
}: {
  ops: OperationItem[];
  variant: "enCamino" | "overdue" | "normal" | "completed";
  compact?: boolean;
}) {
  const getBorderColor = () => {
    switch (variant) {
      case "enCamino": return "rgba(59,130,246,0.3)";
      case "overdue": return "rgba(239,68,68,0.3)";
      case "completed": return "rgba(16,185,129,0.15)";
      default: return "rgba(255,255,255,0.08)";
    }
  };

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: getBorderColor() }}>
      {ops.map((op, idx) => (
        <OperationRow key={idx} op={op} variant={variant} isLast={idx === ops.length - 1} borderColor={getBorderColor()} compact={compact} />
      ))}
    </div>
  );
}

// ─── Operation Row ──────────────────────────────────────────────────────────
function OperationRow({
  op,
  variant,
  isLast,
  borderColor,
  compact = false,
}: {
  op: OperationItem;
  variant: "enCamino" | "overdue" | "normal" | "completed";
  isLast: boolean;
  borderColor: string;
  compact?: boolean;
}) {
  const isEntrega = op.type === "entrega";
  const isTransfer = op.type === "transfer";
  const isCompleted = variant === "completed";
  const textOpacity = isCompleted ? "0.5" : "0.9";

  return (
    <div
      className={`grid gap-4 ${compact ? "px-11 py-3" : "px-16 py-5"} items-center transition-colors hover:bg-white/[0.02]`}
      style={{
        gridTemplateColumns: compact ? "60px 85px 85px 1fr 130px 100px 100px 1fr" : "70px 100px 100px 1fr 150px 120px 120px 1fr",
        borderBottom: isLast ? "none" : `1px solid ${borderColor}`,
      }}
    >
      {/* Time */}
      <div className="flex flex-col">
        <span
          className={`${compact ? "text-base" : "text-xl"} font-mono font-bold tabular-nums`}
          style={{
            color: variant === "enCamino"
              ? "#60a5fa"
              : variant === "overdue"
                ? "#ef4444"
                : isCompleted
                  ? "rgba(255,255,255,0.4)"
                  : COLORS.white,
          }}
        >
          {op.time}
        </span>
        {!isCompleted && !op.enCamino && (() => {
          const now = new Date();
          const [h, m] = op.time.split(":").map(Number);
          const opDate = new Date();
          opDate.setHours(h, m, 0, 0);
          const diffMin = Math.round((opDate.getTime() - now.getTime()) / 60000);
          if (diffMin > 0 && diffMin <= 120) {
            return (
              <span
                className={`${compact ? "text-[9px]" : "text-[10px]"} font-semibold`}
                style={{ color: diffMin <= 15 ? "#fbbf24" : "rgba(255,255,255,0.45)" }}
              >
                en {diffMin} min
              </span>
            );
          }
          return null;
        })()}
      </div>

      {/* Type */}
      <div className="flex items-center">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase"
          style={{
            backgroundColor: isTransfer ? "rgba(99,102,241,0.15)" : isEntrega ? "rgba(22,163,74,0.15)" : "rgba(234,88,12,0.15)",
            color: isTransfer ? "#a5b4fc" : isEntrega ? "#4ade80" : "#fb923c",
            opacity: isCompleted ? 0.6 : 1,
          }}
        >
          {isTransfer ? (
            <ArrowRightLeft className="w-3 h-3" />
          ) : isEntrega ? (
            <ArrowDownToLine className="w-3 h-3" />
          ) : (
            <ArrowUpFromLine className="w-3 h-3" />
          )}
          {isTransfer ? "Transfer" : isEntrega ? "Entrega" : "Devol."}
        </span>
        {variant === "enCamino" && (
          <span
            className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase animate-pulse"
            style={{ backgroundColor: "rgba(59,130,246,0.2)", color: "#60a5fa" }}
          >
            <Navigation className="w-2.5 h-2.5" />
            {formatEnCaminoTime(op.enCaminoAt) || "EN RUTA"}
          </span>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center">
        {op.completed ? (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold"
            style={{ backgroundColor: "rgba(16,185,129,0.15)", color: "#34d399" }}
          >
            <CheckCircle2 className="w-3 h-3" />
            Hecha
          </span>
        ) : op.enCamino ? (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold animate-pulse"
            style={{ backgroundColor: "rgba(59,130,246,0.15)", color: "#60a5fa" }}
          >
            <Navigation className="w-3 h-3" />
            En ruta
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold"
            style={{ backgroundColor: "rgba(251,191,36,0.15)", color: "#fbbf24" }}
          >
            <Clock className="w-3 h-3" />
            Pendiente
          </span>
        )}
      </div>

      {/* Vehicle */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {/* Fixed-width slot for status icon to keep matriculas aligned */}
          <span className={`flex-shrink-0 flex items-center justify-center ${compact ? "w-3.5" : "w-4"}`}>
            {(op.type === "entrega" || op.type === "transfer") ? <VehicleStatusIcon status={op.vehicleStatus} completed={isCompleted} compact={compact} /> : null}
          </span>
          <p
            className={`${compact ? "text-sm" : "text-base"} font-bold truncate`}
            style={{ color: `rgba(255,255,255,${textOpacity})` }}
          >
            {op.auto || op.modelo}
          </p>
          {op.isManualVehicle && (
            <span className="flex-shrink-0" title="Vehículo manual (no en flota)">
              <Wrench className={`${compact ? "w-3 h-3" : "w-3.5 h-3.5"}`} style={{ color: isCompleted ? "rgba(251,191,36,0.4)" : "#fbbf24" }} />
            </span>
          )}
        </div>
        {op.auto && op.modelo && (
          <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)", marginLeft: compact ? "20px" : "24px" }}>
            {op.modelo}
          </p>
        )}
      </div>

      {/* Client Name */}
      <div className="flex items-center gap-1.5 min-w-0">
        {op.clientName ? (
          <>
            <User className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isCompleted ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.6)" }} />
            <span
              className="text-sm font-medium truncate"
              style={{ color: `rgba(255,255,255,${isCompleted ? "0.4" : "0.85"})` }}
            >
              {op.clientName}
            </span>
          </>
        ) : (
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            —
          </span>
        )}
      </div>

      {/* Assigned Rental */}
      <div className="flex items-center gap-1.5 min-w-0">
        {op.isShuttle ? (
          <>
            <Bus className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isCompleted ? "rgba(245,158,11,0.5)" : "#f59e0b" }} />
            <span
              className="text-sm font-semibold truncate"
              style={{ color: isCompleted ? "rgba(252,211,77,0.5)" : "#fcd34d" }}
            >
              Shuttle
            </span>
          </>
        ) : op.assignedRentalName ? (
          <>
            {op.isTeamRental ? (
              <Users className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isCompleted ? "rgba(167,139,250,0.5)" : "#a78bfa" }} />
            ) : (
              <User className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isCompleted ? "rgba(167,139,250,0.5)" : "#a78bfa" }} />
            )}
            <span
              className="text-sm font-semibold truncate"
              style={{ color: isCompleted ? "rgba(196,181,253,0.5)" : "#c4b5fd" }}
            >
              {op.assignedRentalName}
            </span>
          </>
        ) : (
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            Sin asignar
          </span>
        )}
      </div>

      {/* Assigned Escoba */}
      <div className="flex items-center gap-1.5 min-w-0">
        {op.assignedEscobaName ? (
          <>
            {op.isTeamEscoba ? (
              <Users className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isCompleted ? "rgba(52,211,153,0.5)" : "#34d399" }} />
            ) : (
              <Car className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isCompleted ? "rgba(52,211,153,0.5)" : "#34d399" }} />
            )}
            <span
              className="text-sm font-semibold truncate"
              style={{ color: isCompleted ? "rgba(110,231,183,0.5)" : "#6ee7b7" }}
            >
              {op.assignedEscobaName}
            </span>
          </>
        ) : (
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            —
          </span>
        )}
      </div>

      {/* Address */}
      <div className="flex items-center gap-1.5 min-w-0">
        <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isCompleted ? "rgba(201,169,110,0.4)" : COLORS.gold }} />
        <span
          className="text-sm truncate"
          style={{ color: `rgba(255,255,255,${isCompleted ? "0.35" : "0.7"})` }}
        >
          {op.address || op.location}
        </span>
      </div>
    </div>
  );
}

// ─── Vehicle Cleanliness Status Icon ────────────────────────────────────────
function VehicleStatusIcon({
  status,
  completed,
  compact = false,
}: {
  status: string | null;
  completed: boolean;
  compact?: boolean;
}) {
  const size = compact ? "w-3.5 h-3.5" : "w-4 h-4";
  const opacity = completed ? 0.4 : 1;

  if (!status) {
    // Unknown status - show nothing
    return null;
  }

  switch (status) {
    case "limpio":
      return (
        <span className="flex-shrink-0" title="Limpio" style={{ opacity }}>
          <Sparkles className={size} style={{ color: "#34d399" }} />
        </span>
      );
    case "sucio":
      return (
        <span className="flex-shrink-0" title="Sucio" style={{ opacity }}>
          <Droplets className={size} style={{ color: "#ef4444" }} />
        </span>
      );
    case "incompleto":
      return (
        <span className="flex-shrink-0" title="Incompleto" style={{ opacity }}>
          <CircleDashed className={size} style={{ color: "#f59e0b" }} />
        </span>
      );
    case "alquilado":
      return (
        <span className="flex-shrink-0" title="Alquilado" style={{ opacity }}>
          <Car className={size} style={{ color: "#60a5fa" }} />
        </span>
      );
    case "en_servicio":
      return (
        <span className="flex-shrink-0" title="En servicio" style={{ opacity }}>
          <Car className={size} style={{ color: "#a78bfa" }} />
        </span>
      );
    default:
      return null;
  }
}
