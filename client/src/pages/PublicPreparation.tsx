import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  AlertTriangle,
  Clock,
  Car,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";

// ─── Corporate Colors (same as PublicOperations) ────────────────────────────
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

// ─── Urgency styles ─────────────────────────────────────────────────────────
const URGENCY_CONFIG = {
  critical: {
    bg: "rgba(239, 68, 68, 0.08)",
    border: "rgba(239, 68, 68, 0.3)",
    text: "#dc2626",
    icon: "#dc2626",
    label: "Urgente",
    pulse: true,
  },
  high: {
    bg: "rgba(249, 115, 22, 0.08)",
    border: "rgba(249, 115, 22, 0.3)",
    text: "#ea580c",
    icon: "#ea580c",
    label: "Alta",
    pulse: false,
  },
  medium: {
    bg: "rgba(245, 158, 11, 0.06)",
    border: "rgba(245, 158, 11, 0.25)",
    text: "#d97706",
    icon: "#d97706",
    label: "Media",
    pulse: false,
  },
  low: {
    bg: "rgba(107, 114, 128, 0.04)",
    border: "rgba(107, 114, 128, 0.15)",
    text: "#6b7280",
    icon: "#6b7280",
    label: "Normal",
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

    if (diffMin < 0) return "¡Pasado!";
    if (diffMin < 60) return `${diffMin} min`;
    if (diffMin < 1440) return `${Math.round(diffMin / 60)}h`;
    return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });
  } catch {
    return "";
  }
}

// ─── Main Page ──────────────────────────────────────────────────────────────
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
        <div className="max-w-md w-full mx-4 bg-white rounded-2xl shadow-lg p-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: COLORS.gold }} />
          <h2 className="text-lg font-semibold mb-2" style={{ color: COLORS.navy }}>Error al cargar datos</h2>
          <p style={{ color: COLORS.textLight }}>{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: COLORS.gold, color: COLORS.navy }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.beige }}>
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 shadow-sm" style={{ backgroundColor: COLORS.navy }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight" style={{ color: COLORS.white }}>AZUL</span>
              <span className="text-xl font-light" style={{ color: COLORS.gold }}>Cars</span>
            </div>
            <div className="h-6 w-px bg-white/20" />
            <p className="text-sm font-light" style={{ color: "rgba(255,255,255,0.7)" }}>
              Preparación
            </p>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: COLORS.gold, color: COLORS.navy }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* ─── Status bar ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="w-5 h-5" style={{ color: COLORS.gold }} />
            <h1 className="text-lg font-semibold" style={{ color: COLORS.navy }}>
              Lista de preparación
            </h1>
            {items.length > 0 && (
              <span
                className="inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-full text-xs font-bold"
                style={{ backgroundColor: COLORS.gold, color: COLORS.white }}
              >
                {items.length}
              </span>
            )}
          </div>
          {lastUpdated && (
            <p className="text-xs" style={{ color: COLORS.textMuted }}>
              Actualizado: {lastUpdated.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>

        {/* ─── Loading state ───────────────────────────────────────────── */}
        {loading && items.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" style={{ color: COLORS.gold }} />
            <p className="text-sm" style={{ color: COLORS.textLight }}>Cargando lista...</p>
          </div>
        )}

        {/* ─── Empty state ─────────────────────────────────────────────── */}
        {!loading && items.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: "#10b981" }} />
            <h2 className="text-lg font-semibold mb-1" style={{ color: COLORS.navy }}>
              ¡Todo listo!
            </h2>
            <p className="text-sm" style={{ color: COLORS.textLight }}>
              No hay vehículos pendientes de preparar
            </p>
            <div className="flex items-center justify-center gap-1 mt-3">
              <Sparkles className="w-4 h-4" style={{ color: COLORS.gold }} />
              <span className="text-xs" style={{ color: COLORS.textMuted }}>
                Se actualiza automáticamente cada 30 segundos
              </span>
            </div>
          </div>
        )}

        {/* ─── Vehicle cards ───────────────────────────────────────────── */}
        {items.length > 0 && (
          <div className="space-y-3">
            {items.map((item) => {
              const config = URGENCY_CONFIG[item.urgency];
              const timeLabel = formatDeadlineLabel(item.deadline_at);
              const timeStr = formatDeadlineTime(item.deadline_at);

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl shadow-sm border overflow-hidden transition-all hover:shadow-md"
                  style={{ borderColor: config.border }}
                >
                  <div className="flex items-stretch">
                    {/* Urgency color bar */}
                    <div
                      className="w-1.5 flex-shrink-0"
                      style={{ backgroundColor: config.icon }}
                    />

                    <div className="flex-1 px-4 py-3 flex items-center gap-3">
                      {/* Urgency icon */}
                      <div
                        className={`flex items-center justify-center h-10 w-10 rounded-full flex-shrink-0 ${config.pulse ? "animate-pulse" : ""}`}
                        style={{ backgroundColor: config.bg }}
                      >
                        {item.urgency === "critical" ? (
                          <AlertTriangle className="h-5 w-5" style={{ color: config.icon }} />
                        ) : (
                          <Clock className="h-5 w-5" style={{ color: config.icon }} />
                        )}
                      </div>

                      {/* Vehicle info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-bold text-sm sm:text-base tracking-wide"
                            style={{ color: COLORS.navy }}
                          >
                            {item.matricula}
                          </span>
                          <span
                            className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: config.bg,
                              color: config.text,
                              border: `1px solid ${config.border}`,
                            }}
                          >
                            {config.label}
                          </span>
                        </div>
                        {item.modelo && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: COLORS.textLight }}>
                            {item.modelo}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-[11px] mt-0.5 truncate italic" style={{ color: COLORS.textMuted }}>
                            {item.notes}
                          </p>
                        )}
                      </div>

                      {/* Deadline */}
                      <div className="flex-shrink-0 text-right">
                        <p className="text-sm font-semibold" style={{ color: config.text }}>
                          {timeLabel}
                        </p>
                        <p className="text-xs" style={{ color: COLORS.textMuted }}>
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

        {/* ─── Footer ──────────────────────────────────────────────────── */}
        <div className="text-center pt-4 pb-8">
          <p className="text-xs" style={{ color: COLORS.textMuted }}>
            Vista de solo lectura · Se actualiza automáticamente
          </p>
        </div>
      </main>
    </div>
  );
}
