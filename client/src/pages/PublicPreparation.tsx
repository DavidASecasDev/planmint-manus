import { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshCw,
  AlertTriangle,
  Clock,
  Car,
  CheckCircle2,
  Loader2,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Trophy,
} from "lucide-react";

// ─── Corporate Colors ───────────────────────────────────────────────────────
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

// ─── Urgency styles (high contrast for TV) ──────────────────────────────────
const URGENCY_CONFIG = {
  critical: {
    bg: "#fef2f2",
    border: "#fca5a5",
    barColor: "#dc2626",
    text: "#991b1b",
    label: "URGENTE",
    pulse: true,
  },
  high: {
    bg: "#fff7ed",
    border: "#fdba74",
    barColor: "#ea580c",
    text: "#9a3412",
    label: "ALTA",
    pulse: false,
  },
  medium: {
    bg: "#fffbeb",
    border: "#fcd34d",
    barColor: "#d97706",
    text: "#92400e",
    label: "MEDIA",
    pulse: false,
  },
  low: {
    bg: "#f9fafb",
    border: "#d1d5db",
    barColor: "#6b7280",
    text: "#374151",
    label: "NORMAL",
    pulse: false,
  },
};

interface PreparationItem {
  id: string;
  matricula: string;
  modelo: string | null;
  deadline_at: string;
  notes: string | null;
  urgency: "critical" | "high" | "medium" | "low";
  total_tasks: number;
  completed_tasks: number;
}

function formatDeadlineTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

function formatDeadlineLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffMin = Math.round(diffMs / 60000);

    if (diffMin < 0) return "¡PASADO!";
    if (diffMin < 60) return `${diffMin} min`;
    if (diffMin < 1440) return `${Math.round(diffMin / 60)}h`;
    return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });
  } catch {
    return "";
  }
}

// ─── Alert Sound Generator (Web Audio API) ──────────────────────────────────
// Loud, penetrating sounds designed for noisy workshop environments
function playAlertSound(urgency: "critical" | "high" | "medium" | "low") {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

    if (urgency === "critical") {
      // CRITICAL: Loud alarm siren - 5 rapid beeps at max volume, high-pitched
      const playBeep = (startTime: number, freq: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = "square"; // Square wave is harsher/louder
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(1.0, startTime); // MAX volume
        gain.gain.setValueAtTime(1.0, startTime + duration * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      const now = audioCtx.currentTime;
      // 5 rapid beeps alternating frequencies for attention
      playBeep(now, 1000, 0.25);
      playBeep(now + 0.3, 1400, 0.25);
      playBeep(now + 0.6, 1000, 0.25);
      playBeep(now + 0.9, 1400, 0.25);
      playBeep(now + 1.2, 1600, 0.4);
    } else if (urgency === "high") {
      // HIGH: 3 strong beeps, sawtooth wave for cutting through noise
      const playBeep = (startTime: number, freq: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = "sawtooth"; // Sawtooth is very audible
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.8, startTime); // High volume
        gain.gain.setValueAtTime(0.8, startTime + duration * 0.6);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      const now = audioCtx.currentTime;
      playBeep(now, 800, 0.3);
      playBeep(now + 0.4, 1000, 0.3);
      playBeep(now + 0.8, 1200, 0.4);
    } else {
      // MEDIUM/LOW: 2 clear chimes, still loud enough to hear
      const playBeep = (startTime: number, freq: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.6, startTime); // Moderate-high volume
        gain.gain.setValueAtTime(0.6, startTime + duration * 0.5);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      const now = audioCtx.currentTime;
      playBeep(now, 660, 0.35);
      playBeep(now + 0.45, 880, 0.4);
    }
  } catch {
    // Web Audio API not available - silently fail
  }
}

// ─── Main Page (TV-optimized) ───────────────────────────────────────────────
export default function PublicPreparation() {
  const [items, setItems] = useState<PreparationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [completedToday, setCompletedToday] = useState(0);
  const previousItemIdsRef = useRef<Set<string>>(new Set());
  const isFirstFetchRef = useRef(true);

  // Add noindex meta tag
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
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
      const res = await fetch("/api/public/preparacion");
      if (!res.ok) throw new Error("Error al cargar datos");
      const json = await res.json();
      if (!json.ok) throw new Error("Error al cargar datos");

      const fetchedItems: PreparationItem[] = json.items || [];
      const currentIds = new Set(fetchedItems.map((i) => i.id));

      // Update completed today counter
      if (typeof json.completed_today === "number") {
        setCompletedToday(json.completed_today);
      }

      // Detect new items (not in previous fetch)
      if (!isFirstFetchRef.current) {
        const newIds = new Set<string>();
        let highestNewUrgency: "critical" | "high" | "medium" | "low" | null = null;
        const urgencyPriority = { critical: 4, high: 3, medium: 2, low: 1 };

        for (const item of fetchedItems) {
          if (!previousItemIdsRef.current.has(item.id)) {
            newIds.add(item.id);
            if (!highestNewUrgency || urgencyPriority[item.urgency] > urgencyPriority[highestNewUrgency]) {
              highestNewUrgency = item.urgency;
            }
          }
        }

        if (newIds.size > 0) {
          setNewItemIds(newIds);
          if (soundEnabled && highestNewUrgency) {
            playAlertSound(highestNewUrgency);
          }
          setTimeout(() => setNewItemIds(new Set()), 10000);
        }
      }

      isFirstFetchRef.current = false;
      previousItemIdsRef.current = currentIds;
      setItems(fetchedItems);
      setError(null);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [soundEnabled]);

  // Initial fetch + auto-refresh every 15 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleEnableSound = () => {
    setSoundEnabled(true);
    playAlertSound("low");
  };

  if (error && items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.beige }}>
        <div className="text-center p-12">
          <AlertTriangle className="w-20 h-20 mx-auto mb-6" style={{ color: COLORS.gold }} />
          <h2 className="text-4xl font-bold mb-4" style={{ color: COLORS.navy }}>Error al cargar datos</h2>
          <p className="text-2xl" style={{ color: COLORS.textLight }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.beige }}>
      {/* ─── Header (compact for TV - maximize content space) ──────────── */}
      <header className="sticky top-0 z-50 shadow-md" style={{ backgroundColor: COLORS.navy }}>
        <div className="max-w-[1800px] mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-3xl font-bold tracking-tight" style={{ color: COLORS.white }}>AZUL</span>
            <span className="text-3xl font-light" style={{ color: COLORS.gold }}>Cars</span>
            <div className="h-8 w-px bg-white/30 mx-2" />
            <div className="flex items-center gap-3">
              <Car className="w-7 h-7" style={{ color: COLORS.gold }} />
              <span className="text-2xl font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>
                Preparación
              </span>
            </div>
          </div>

          <div className="flex items-center gap-5">
            {/* Completed today counter */}
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{ backgroundColor: "rgba(16,185,129,0.15)" }}
              title="Completados hoy"
            >
              <Trophy className="w-6 h-6" style={{ color: "#10b981" }} />
              <span className="text-2xl font-bold" style={{ color: "#10b981" }}>
                {completedToday}
              </span>
              <span className="text-sm font-medium" style={{ color: "rgba(16,185,129,0.8)" }}>
                hoy
              </span>
            </div>

            {/* Pending count */}
            {items.length > 0 && (
              <span
                className="text-3xl font-bold px-5 py-2 rounded-xl"
                style={{ backgroundColor: COLORS.gold, color: COLORS.white }}
              >
                {items.length} pendiente{items.length !== 1 ? "s" : ""}
              </span>
            )}

            {lastUpdated && (
              <span className="text-lg" style={{ color: "rgba(255,255,255,0.6)" }}>
                {lastUpdated.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}

            {/* Sound toggle */}
            <button
              onClick={() => {
                if (!soundEnabled) {
                  handleEnableSound();
                } else {
                  setSoundEnabled(false);
                }
              }}
              className="p-3 rounded-xl transition-all hover:opacity-80"
              style={{ backgroundColor: soundEnabled ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.1)" }}
              title={soundEnabled ? "Sonido activado" : "Sonido desactivado"}
            >
              {soundEnabled ? (
                <Volume2 className="w-6 h-6" style={{ color: "#10b981" }} />
              ) : (
                <VolumeX className="w-6 h-6" style={{ color: "rgba(255,255,255,0.5)" }} />
              )}
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
              <RefreshCw className={`w-6 h-6 ${loading ? "animate-spin" : ""}`} style={{ color: COLORS.gold }} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-8 py-6">
        {/* ─── Loading state ───────────────────────────────────────────── */}
        {loading && items.length === 0 && (
          <div className="flex items-center justify-center" style={{ minHeight: "calc(100vh - 120px)" }}>
            <div className="text-center">
              <Loader2 className="w-16 h-16 mx-auto mb-6 animate-spin" style={{ color: COLORS.gold }} />
              <p className="text-3xl font-medium" style={{ color: COLORS.textLight }}>Cargando lista...</p>
            </div>
          </div>
        )}

        {/* ─── Empty state ─────────────────────────────────────────────── */}
        {!loading && items.length === 0 && (
          <div className="flex items-center justify-center" style={{ minHeight: "calc(100vh - 120px)" }}>
            <div className="text-center">
              <CheckCircle2 className="w-28 h-28 mx-auto mb-8" style={{ color: "#10b981" }} />
              <h2 className="text-5xl font-bold mb-4" style={{ color: COLORS.navy }}>
                ¡Todo listo!
              </h2>
              <p className="text-3xl" style={{ color: COLORS.textLight }}>
                No hay vehículos pendientes de preparar
              </p>
              {completedToday > 0 && (
                <div className="mt-8 flex items-center justify-center gap-3">
                  <Trophy className="w-10 h-10" style={{ color: COLORS.gold }} />
                  <span className="text-4xl font-bold" style={{ color: COLORS.gold }}>
                    {completedToday} completado{completedToday !== 1 ? "s" : ""} hoy
                  </span>
                </div>
              )}
              <p className="text-xl mt-6" style={{ color: COLORS.textMuted }}>
                Se actualiza automáticamente cada 15 segundos
              </p>
            </div>
          </div>
        )}

        {/* ─── Vehicle cards (TV-optimized: large, high contrast, clear priority) ─ */}
        {items.length > 0 && (
          <div className="flex flex-col gap-4">
            {items.map((item, index) => {
              const config = URGENCY_CONFIG[item.urgency];
              const timeLabel = formatDeadlineLabel(item.deadline_at);
              const timeStr = formatDeadlineTime(item.deadline_at);
              const isNew = newItemIds.has(item.id);
              const isFirst = index === 0;
              const isTop3 = index < 3;

              return (
                <div
                  key={item.id}
                  className={`rounded-2xl overflow-hidden transition-all ${config.pulse ? "animate-pulse" : ""}`}
                  style={{
                    backgroundColor: config.bg,
                    borderLeft: `8px solid ${config.barColor}`,
                    borderTop: `2px solid ${isNew ? config.barColor : config.border}`,
                    borderRight: `2px solid ${isNew ? config.barColor : config.border}`,
                    borderBottom: `2px solid ${isNew ? config.barColor : config.border}`,
                    boxShadow: isNew
                      ? `0 0 20px ${config.barColor}40, 0 0 40px ${config.barColor}20`
                      : isFirst
                        ? `0 4px 20px ${config.barColor}30`
                        : "0 2px 8px rgba(0,0,0,0.06)",
                    animation: isNew ? "slideInLeft 0.6s ease-out" : undefined,
                  }}
                >
                  <div className={`flex items-center ${isFirst ? "px-8 py-6" : isTop3 ? "px-7 py-5" : "px-6 py-4"} gap-5`}>
                    {/* Priority number - large and prominent */}
                    <div
                      className={`flex items-center justify-center flex-shrink-0 rounded-xl font-black ${isFirst ? "h-20 w-20 text-4xl" : isTop3 ? "h-16 w-16 text-3xl" : "h-14 w-14 text-2xl"}`}
                      style={{
                        backgroundColor: config.barColor,
                        color: "#ffffff",
                        boxShadow: `0 3px 10px ${config.barColor}50`,
                      }}
                    >
                      {index + 1}
                    </div>

                    {/* Urgency badge - very visible */}
                    <div
                      className={`flex-shrink-0 flex flex-col items-center justify-center rounded-xl ${isFirst ? "px-5 py-3" : "px-4 py-2"}`}
                      style={{
                        backgroundColor: `${config.barColor}15`,
                        border: `3px solid ${config.barColor}`,
                      }}
                    >
                      {item.urgency === "critical" ? (
                        <AlertTriangle className={`${isFirst ? "h-8 w-8" : "h-6 w-6"} mb-1`} style={{ color: config.barColor }} />
                      ) : (
                        <Clock className={`${isFirst ? "h-8 w-8" : "h-6 w-6"} mb-1`} style={{ color: config.barColor }} />
                      )}
                      <span
                        className={`font-black uppercase ${isFirst ? "text-base" : "text-xs"}`}
                        style={{ color: config.text }}
                      >
                        {config.label}
                      </span>
                    </div>

                    {/* Vehicle info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span
                          className={`font-black tracking-wider ${isFirst ? "text-4xl" : isTop3 ? "text-3xl" : "text-2xl"}`}
                          style={{ color: COLORS.navy }}
                        >
                          {item.matricula}
                        </span>
                        {isNew && (
                          <span
                            className="text-xs font-bold uppercase px-2 py-1 rounded-md"
                            style={{
                              backgroundColor: "#10b981",
                              color: "#ffffff",
                              animation: "slideInRight 0.5s ease-out",
                            }}
                          >
                            NUEVO
                          </span>
                        )}
                      </div>
                      {item.modelo && (
                        <p className={`font-medium truncate ${isFirst ? "text-xl" : "text-lg"}`} style={{ color: COLORS.textLight }}>
                          {item.modelo}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-base mt-1 truncate italic" style={{ color: COLORS.textMuted }}>
                          {item.notes}
                        </p>
                      )}
                      {/* Task progress bar */}
                      {item.total_tasks > 0 && (
                        <div className="mt-2 flex items-center gap-3">
                          <div
                            className={`flex-1 rounded-full overflow-hidden ${isFirst ? "h-3" : "h-2.5"}`}
                            style={{ backgroundColor: `${config.barColor}20` }}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${item.total_tasks > 0 ? (item.completed_tasks / item.total_tasks) * 100 : 0}%`,
                                backgroundColor: item.completed_tasks === item.total_tasks ? "#10b981" : config.barColor,
                              }}
                            />
                          </div>
                          <span
                            className={`font-bold flex-shrink-0 ${isFirst ? "text-base" : "text-sm"}`}
                            style={{ color: item.completed_tasks === item.total_tasks ? "#10b981" : config.text }}
                          >
                            {item.completed_tasks}/{item.total_tasks}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Deadline (large for TV) */}
                    <div className="flex-shrink-0 text-right">
                      <p
                        className={`font-bold ${isFirst ? "text-4xl" : isTop3 ? "text-3xl" : "text-2xl"}`}
                        style={{ color: config.text }}
                      >
                        {timeLabel}
                      </p>
                      <p className={`font-medium mt-1 ${isFirst ? "text-xl" : "text-lg"}`} style={{ color: COLORS.textMuted }}>
                        {timeStr}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
