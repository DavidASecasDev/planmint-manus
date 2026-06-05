import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  AlertTriangle,
  Clock,
  Car,
  CheckCircle2,
  Loader2,
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

// ─── Main Page (TV-optimized) ───────────────────────────────────────────────
export default function PublicPreparation() {
  const [items, setItems] = useState<PreparationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Add noindex meta tag
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/public/preparacion");
      if (!res.ok) throw new Error("Error al cargar datos");
      const json = await res.json();
      if (!json.ok) throw new Error("Error al cargar datos");
      setItems(json.items || []);
      setError(null);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + auto-refresh every 30 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

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

          <div className="flex items-center gap-6">
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
              <p className="text-xl mt-6" style={{ color: COLORS.textMuted }}>
                Se actualiza automáticamente cada 30 segundos
              </p>
            </div>
          </div>
        )}

        {/* ─── Vehicle cards (TV-optimized: large, high contrast) ───────── */}
        {items.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {items.map((item) => {
              const config = URGENCY_CONFIG[item.urgency];
              const timeLabel = formatDeadlineLabel(item.deadline_at);
              const timeStr = formatDeadlineTime(item.deadline_at);

              return (
                <div
                  key={item.id}
                  className={`rounded-2xl shadow-sm border-2 overflow-hidden transition-all ${config.pulse ? "animate-pulse" : ""}`}
                  style={{
                    backgroundColor: config.bg,
                    borderColor: config.border,
                  }}
                >
                  <div className="flex items-stretch">
                    {/* Urgency color bar (thick for TV visibility) */}
                    <div
                      className="w-3 flex-shrink-0"
                      style={{ backgroundColor: config.barColor }}
                    />

                    <div className="flex-1 px-6 py-5 flex items-center gap-5">
                      {/* Urgency icon */}
                      <div
                        className="flex items-center justify-center h-16 w-16 rounded-2xl flex-shrink-0"
                        style={{ backgroundColor: `${config.barColor}20` }}
                      >
                        {item.urgency === "critical" ? (
                          <AlertTriangle className="h-9 w-9" style={{ color: config.barColor }} />
                        ) : (
                          <Clock className="h-9 w-9" style={{ color: config.barColor }} />
                        )}
                      </div>

                      {/* Vehicle info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span
                            className="font-black text-3xl tracking-wider"
                            style={{ color: COLORS.navy }}
                          >
                            {item.matricula}
                          </span>
                          <span
                            className="text-sm font-bold uppercase px-3 py-1 rounded-lg"
                            style={{
                              backgroundColor: `${config.barColor}20`,
                              color: config.text,
                              border: `2px solid ${config.border}`,
                            }}
                          >
                            {config.label}
                          </span>
                        </div>
                        {item.modelo && (
                          <p className="text-xl font-medium truncate" style={{ color: COLORS.textLight }}>
                            {item.modelo}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-lg mt-1 truncate italic" style={{ color: COLORS.textMuted }}>
                            {item.notes}
                          </p>
                        )}
                      </div>

                      {/* Deadline (large for TV) */}
                      <div className="flex-shrink-0 text-right">
                        <p
                          className="text-3xl font-bold"
                          style={{ color: config.text }}
                        >
                          {timeLabel}
                        </p>
                        <p className="text-xl font-medium mt-1" style={{ color: COLORS.textMuted }}>
                          {timeStr}
                        </p>
                      </div>
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
