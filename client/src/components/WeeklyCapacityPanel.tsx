/**
 * WeeklyCapacityPanel — Heatmap-style panel showing 7 days of staff capacity.
 * Designed to integrate into the Schedules (Horarios) page.
 * Includes "Asignar" button per reinforcement suggestion that opens the
 * ReinforcementAssignDialog to assign a Mostrador employee to unassigned operations.
 */
import { useState, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  TrendingUp,
  Users,
  Calendar,
  ShieldPlus,
  Clock,
  UserPlus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useWeeklyCapacity,
  type DaySummary,
  type ReinforcementSuggestion,
} from "@/hooks/useWeeklyCapacity";
import { ReinforcementAssignDialog } from "@/components/ReinforcementAssignDialog";

interface WeeklyCapacityPanelProps {
  /** Monday of the week in YYYY-MM-DD format */
  weekStartDate: string | null;
}

const STATUS_CONFIG = {
  sufficient: {
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
    bgHover: "hover:bg-emerald-200 dark:hover:bg-emerald-900/60",
    border: "border-emerald-300 dark:border-emerald-700",
    text: "text-emerald-800 dark:text-emerald-200",
    dot: "bg-emerald-500",
    barColor: "bg-emerald-500",
    label: "Suficiente",
  },
  tight: {
    bg: "bg-amber-100 dark:bg-amber-900/40",
    bgHover: "hover:bg-amber-200 dark:hover:bg-amber-900/60",
    border: "border-amber-300 dark:border-amber-700",
    text: "text-amber-800 dark:text-amber-200",
    dot: "bg-amber-500",
    barColor: "bg-amber-500",
    label: "Justo",
  },
  deficit: {
    bg: "bg-red-100 dark:bg-red-900/40",
    bgHover: "hover:bg-red-200 dark:hover:bg-red-900/60",
    border: "border-red-300 dark:border-red-700",
    text: "text-red-800 dark:text-red-200",
    dot: "bg-red-500",
    barColor: "bg-red-500",
    label: "Déficit",
  },
};

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function formatDateShort(dateStr: string): string {
  const parts = dateStr.split("-");
  return `${parseInt(parts[2])}/${parseInt(parts[1])}`;
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return 'ahora';
  if (diffSec < 60) return `hace ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  return `hace ${diffHr}h`;
}

// ─── Dialog state type ──────────────────────────────────────────────────────

interface DialogState {
  open: boolean;
  date: string;
  hour: number;
  employee: {
    userId: string;
    name: string;
    team: string;
    shiftStart: string;
    shiftEnd: string;
    availableHours: number;
  };
}

const INITIAL_DIALOG: DialogState = {
  open: false,
  date: "",
  hour: 0,
  employee: {
    userId: "",
    name: "",
    team: "",
    shiftStart: "",
    shiftEnd: "",
    availableHours: 0,
  },
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function DayCard({
  day,
  dayIndex,
  isSelected,
  onClick,
}: {
  day: DaySummary;
  dayIndex: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const config = STATUS_CONFIG[day.overallStatus];
  const pct = Math.min(day.overallUtilization, 100);

  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-col items-center p-3 rounded-xl border-2 transition-all duration-200
        ${config.bg} ${config.bgHover} 
        ${isSelected ? `${config.border} ring-2 ring-offset-1 ring-${day.overallStatus === "sufficient" ? "emerald" : day.overallStatus === "tight" ? "amber" : "red"}-400/50 scale-[1.02]` : "border-transparent"}
        min-w-[85px] cursor-pointer
      `}
    >
      {/* Day name */}
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
        {DAY_NAMES[dayIndex]}
      </span>

      {/* Date */}
      <span className="text-xs text-muted-foreground mt-0.5">
        {formatDateShort(day.date)}
      </span>

      {/* Utilization circle */}
      <div className="relative w-12 h-12 mt-2">
        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-gray-200 dark:text-gray-700"
          />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            strokeWidth="3"
            strokeDasharray={`${pct} ${100 - pct}`}
            strokeLinecap="round"
            className={
              day.overallStatus === "sufficient"
                ? "stroke-emerald-500"
                : day.overallStatus === "tight"
                  ? "stroke-amber-500"
                  : "stroke-red-500"
            }
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
          {day.overallUtilization}%
        </span>
      </div>

      {/* Operations count */}
      <div className="flex items-center gap-1 mt-2">
        <span className="text-sm font-bold">{day.totalOperations}</span>
        <span className="text-[10px] text-muted-foreground">ops</span>
      </div>

      {/* Status dot */}
      <div className="flex items-center gap-1 mt-1">
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        <span className={`text-[10px] font-medium ${config.text}`}>
          {config.label}
        </span>
      </div>

      {/* Deficit indicator */}
      {day.deficitHours.length > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
          {day.deficitHours.length}
        </span>
      )}
    </button>
  );
}

function DayDetail({
  day,
  onOpenAssignDialog,
}: {
  day: DaySummary;
  onOpenAssignDialog: (date: string, hour: number, r: ReinforcementSuggestion) => void;
}) {
  const config = STATUS_CONFIG[day.overallStatus];
  const StatusIcon =
    day.overallStatus === "sufficient" ? CheckCircle2 : AlertTriangle;

  const hoursNeeded = Math.round(day.totalPersonMinutesNeeded / 60);
  const hoursAvailable = Math.round(day.totalPersonMinutesAvailable / 60);

  return (
    <div
      className={`mt-4 p-4 rounded-xl border ${config.bg} ${config.border} transition-all duration-300`}
    >
      <div className="flex items-start gap-3">
        <StatusIcon className={`h-5 w-5 mt-0.5 shrink-0 ${config.text}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${config.text}`}>
              {config.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {day.overallUtilization}% carga
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{day.summary}</p>

          {/* Stats row */}
          <div className="flex items-center gap-6 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              <strong className="text-foreground">{hoursNeeded}h</strong>
              necesarias
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              <strong className="text-foreground">{hoursAvailable}h</strong>
              disponibles
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <strong className="text-foreground">{day.totalOperations}</strong>
              operaciones
            </span>
          </div>

          {/* Deficit/tight hours */}
          {day.deficitHours.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                Déficit:
              </span>
              {day.deficitHours.map((h) => (
                <span
                  key={h}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-red-200/60 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-medium"
                >
                  {String(h).padStart(2, "0")}:00
                </span>
              ))}
            </div>
          )}
          {day.tightHours.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                Ajustado:
              </span>
              {day.tightHours.map((h) => (
                <span
                  key={h}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200/60 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-medium"
                >
                  {String(h).padStart(2, "0")}:00
                </span>
              ))}
            </div>
          )}

          {/* Reinforcement suggestions — with Asignar button */}
          {day.reinforcements && day.reinforcements.length > 0 && (
            <div className="mt-3 p-2.5 rounded-lg bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldPlus className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-[11px] font-semibold text-blue-800 dark:text-blue-200 uppercase tracking-wider">
                  Refuerzos sugeridos
                </span>
              </div>
              <div className="space-y-1">
                {day.reinforcements.map((r) => {
                  // Pick the first deficit hour this employee can cover
                  const firstCoverableHour = r.availableHours.find((h) =>
                    day.deficitHours.includes(h)
                  ) ?? r.availableHours[0] ?? 0;

                  return (
                    <div
                      key={r.userId}
                      className="flex items-center gap-2 py-1 px-2 rounded bg-white/60 dark:bg-gray-900/40"
                    >
                      <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-blue-700 dark:text-blue-300">
                          {r.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-blue-900 dark:text-blue-100">
                        {r.name}
                      </span>
                      <span className="text-[10px] px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                        {r.teamName}
                      </span>
                      <span className="flex items-center gap-0.5 text-[10px] text-blue-500/70">
                        <Clock className="h-2.5 w-2.5" />
                        {r.shiftStart}-{r.shiftEnd}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto h-5 px-2 text-[10px] border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/50 shrink-0"
                        onClick={() => onOpenAssignDialog(day.date, firstCoverableHour, r)}
                      >
                        <UserPlus className="h-2.5 w-2.5 mr-1" />
                        Asignar
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function WeeklyCapacityPanel({
  weekStartDate,
}: WeeklyCapacityPanelProps) {
  const { data, loading, error, lastUpdated, refetch } = useWeeklyCapacity(weekStartDate);
  const [expanded, setExpanded] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [dialog, setDialog] = useState<DialogState>(INITIAL_DIALOG);
  const [, setTick] = useState(0);

  // Re-render every 30s to update the relative time display
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const openAssignDialog = (date: string, hour: number, r: ReinforcementSuggestion) => {
    setDialog({
      open: true,
      date,
      hour,
      employee: {
        userId: r.userId,
        name: r.name,
        team: r.teamName,
        shiftStart: r.shiftStart,
        shiftEnd: r.shiftEnd,
        availableHours: r.availableHours.length,
      },
    });
  };

  if (!weekStartDate) return null;

  // Overall week status
  const weekStatus = data
    ? data.some((d) => d.overallStatus === "deficit")
      ? "deficit"
      : data.some((d) => d.overallStatus === "tight")
        ? "tight"
        : "sufficient"
    : "sufficient";

  const weekConfig = STATUS_CONFIG[weekStatus];
  const WeekIcon =
    weekStatus === "sufficient" ? CheckCircle2 : AlertTriangle;

  const totalOps = data
    ? data.reduce((s, d) => s + d.totalOperations, 0)
    : 0;
  const avgUtil = data && data.length > 0
    ? Math.round(data.reduce((s, d) => s + d.overallUtilization, 0) / data.length)
    : 0;

  return (
    <>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4.5 w-4.5 text-muted-foreground" />
            <span className="text-sm font-semibold">Carga Semanal</span>
          </div>

          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-2" />
          ) : data ? (
            <div className="flex items-center gap-3 ml-2">
              <span className={`flex items-center gap-1.5 text-xs font-medium ${weekConfig.text}`}>
                <span className={`w-2 h-2 rounded-full ${weekConfig.dot}`} />
                {weekConfig.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {avgUtil}% media · {totalOps} ops
              </span>
            </div>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            {lastUpdated && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  refetch();
                }}
                className="flex items-center gap-1 text-[10px] text-muted-foreground/70 hover:text-foreground transition-colors cursor-pointer"
                title={`Última actualización: ${lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}. Clic para actualizar ahora.`}
              >
                <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
                {formatRelativeTime(lastUpdated)}
              </button>
            )}
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Content */}
        {expanded && (
          <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800">
            {loading && (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Calculando carga semanal...
                </span>
              </div>
            )}

            {error && (
              <div className="py-4 text-center text-sm text-red-500">
                {error}
              </div>
            )}

            {data && !loading && (
              <>
                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 mb-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> &lt;70%
                    Suficiente
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> 70-85%
                    Justo
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500" /> &gt;85%
                    Déficit
                  </span>
                </div>

                {/* Day cards grid */}
                <div className="grid grid-cols-7 gap-2">
                  {data.map((day, i) => (
                    <DayCard
                      key={day.date}
                      day={day}
                      dayIndex={i}
                      isSelected={selectedDayIndex === i}
                      onClick={() =>
                        setSelectedDayIndex(
                          selectedDayIndex === i ? null : i
                        )
                      }
                    />
                  ))}
                </div>

                {/* Selected day detail */}
                {selectedDayIndex !== null && data[selectedDayIndex] && (
                  <DayDetail
                    day={data[selectedDayIndex]}
                    onOpenAssignDialog={openAssignDialog}
                  />
                )}

                {/* Week summary bar */}
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <WeekIcon className={`h-3.5 w-3.5 ${weekConfig.text}`} />
                    <span>
                      Semana:{" "}
                      <strong className="text-foreground">{totalOps}</strong>{" "}
                      operaciones totales ·{" "}
                      <strong className="text-foreground">{avgUtil}%</strong>{" "}
                      carga media ·{" "}
                      <strong className="text-foreground">
                        {data.filter((d) => d.overallStatus === "deficit").length}
                      </strong>{" "}
                      días con déficit
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Reinforcement assign dialog */}
      <ReinforcementAssignDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
        date={dialog.date}
        hour={dialog.hour}
        employee={dialog.employee}
        onAssigned={() => refetch()}
      />
    </>
  );
}
