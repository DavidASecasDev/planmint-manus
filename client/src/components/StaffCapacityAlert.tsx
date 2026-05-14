/**
 * StaffCapacityAlert — Visual alert showing staff capacity status for a date.
 *
 * Shows a compact banner with overall status and expandable hourly breakdown.
 * Colors: green (sufficient), amber (tight), red (deficit).
 * When deficit/tight, shows reinforcement suggestions from Mostrador team
 * with an "Asignar" button that opens the ReinforcementAssignDialog.
 */
import { useState, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Users,
  Loader2,
  ShieldPlus,
  UserPlus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useStaffCapacity,
  type HourSlot,
  type ReinforcementSuggestion,
} from "@/hooks/useStaffCapacity";
import { ReinforcementAssignDialog } from "@/components/ReinforcementAssignDialog";

interface StaffCapacityAlertProps {
  date: string | null; // YYYY-MM-DD
  compact?: boolean; // For dashboard: show minimal version
}

const STATUS_CONFIG = {
  sufficient: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-800 dark:text-emerald-200",
    icon: CheckCircle2,
    label: "Personal suficiente",
    barColor: "bg-emerald-500",
  },
  tight: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-800 dark:text-amber-200",
    icon: AlertTriangle,
    label: "Personal justo",
    barColor: "bg-amber-500",
  },
  deficit: {
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-800 dark:text-red-200",
    icon: AlertTriangle,
    label: "Déficit de personal",
    barColor: "bg-red-500",
  },
};

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

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Sub-components ─────────────────────────────────────────────────────────

function HourSlotBar({ slot }: { slot: HourSlot }) {
  const config = STATUS_CONFIG[slot.status];
  const pct = Math.min(slot.utilizationPct, 100);

  const totalStaff =
    slot.availableStaff.rentals.length +
    slot.availableStaff.preparacion.length +
    slot.availableStaff.mostrador.length;

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-28 text-xs font-medium text-muted-foreground shrink-0">
        {slot.label}
      </span>
      <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden relative">
        <div
          className={`h-full rounded-full transition-all duration-500 ${config.barColor}`}
          style={{ width: `${pct}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700 dark:text-gray-300">
          {slot.utilizationPct}%
        </span>
      </div>
      <div className="flex items-center gap-1.5 w-20 shrink-0">
        <Users className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{totalStaff}</span>
        <span className="text-[10px] text-muted-foreground/60">pers.</span>
      </div>
      <div className="flex items-center gap-1 w-16 shrink-0">
        <span className="text-xs font-medium">{slot.operations.length}</span>
        <span className="text-[10px] text-muted-foreground">ops</span>
      </div>
      {slot.reinforcements && slot.reinforcements.length > 0 && (
        <div className="flex items-center gap-1 shrink-0" title={`Refuerzos: ${slot.reinforcements.map((r) => r.name).join(", ")}`}>
          <UserPlus className="h-3 w-3 text-blue-500" />
          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
            +{slot.reinforcements.length}
          </span>
        </div>
      )}
    </div>
  );
}

function OperationDetail({
  slot,
  date,
  onOpenAssignDialog,
}: {
  slot: HourSlot;
  date: string;
  onOpenAssignDialog: (hour: number, r: ReinforcementSuggestion) => void;
}) {
  if (slot.operations.length === 0 && (!slot.reinforcements || slot.reinforcements.length === 0))
    return null;

  return (
    <div className="ml-28 pl-3 border-l-2 border-gray-200 dark:border-gray-700 mb-2">
      {slot.operations.map((op, i) => (
        <div
          key={`${op.reservationId}-${i}`}
          className="flex items-center gap-2 py-0.5 text-[11px] text-muted-foreground"
        >
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              op.type === "Entrega"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : op.type === "Devolución"
                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            }`}
          >
            {op.type}
          </span>
          {op.location && (
            <span className="flex items-center gap-0.5">
              <MapPin className="h-2.5 w-2.5" />
              <span className="truncate max-w-[180px]">{op.location}</span>
            </span>
          )}
          {!op.isAtBase && (
            <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
              <Clock className="h-2.5 w-2.5" />
              {op.travelMinutesOneWay} min ida
            </span>
          )}
          <span className="ml-auto">
            {op.peopleNeeded}p × {Math.round(op.personMinutes / op.peopleNeeded)} min
          </span>
        </div>
      ))}
      {/* Reinforcement suggestions for this slot — with Asignar button */}
      {slot.reinforcements && slot.reinforcements.length > 0 && (
        <div className="mt-1 pt-1 border-t border-blue-200/50 dark:border-blue-800/50">
          {slot.reinforcements.map((r) => (
            <div
              key={r.userId}
              className="flex items-center gap-2 py-0.5 text-[11px] text-blue-600 dark:text-blue-400"
            >
              <UserPlus className="h-2.5 w-2.5" />
              <span className="font-medium">{r.name}</span>
              <span className="text-blue-500/70 dark:text-blue-400/70">
                ({r.teamName})
              </span>
              <span className="text-[10px] text-blue-500/60 dark:text-blue-400/60">
                {r.shiftStart} - {r.shiftEnd}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto h-5 px-2 text-[10px] border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/50"
                onClick={() => onOpenAssignDialog(slot.hour, r)}
              >
                <UserPlus className="h-2.5 w-2.5 mr-1" />
                Asignar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReinforcementPanel({
  reinforcements,
  date,
  deficitHours,
  onOpenAssignDialog,
}: {
  reinforcements: ReinforcementSuggestion[];
  date: string;
  deficitHours: number[];
  onOpenAssignDialog: (hour: number, r: ReinforcementSuggestion) => void;
}) {
  if (!reinforcements || reinforcements.length === 0) return null;

  return (
    <div className="mt-3 p-3 rounded-lg bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-2 mb-2">
        <ShieldPlus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <h5 className="text-xs font-semibold text-blue-800 dark:text-blue-200 uppercase tracking-wider">
          Refuerzos sugeridos de Mostrador
        </h5>
      </div>
      <div className="space-y-1.5">
        {reinforcements.map((r) => {
          // Pick the first deficit hour this employee can cover
          const firstCoverableHour = r.availableHours.find((h) =>
            deficitHours.includes(h)
          ) ?? r.availableHours[0] ?? 0;

          return (
            <div
              key={r.userId}
              className="flex items-center gap-3 py-1.5 px-2 rounded-md bg-white/60 dark:bg-gray-900/40"
            >
              <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">
                  {r.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {r.name}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                    {r.teamName}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Clock className="h-2.5 w-2.5 text-blue-500/60" />
                  <span className="text-[10px] text-blue-600/70 dark:text-blue-400/70">
                    Turno {r.shiftStart} - {r.shiftEnd}
                  </span>
                  <span className="text-[10px] text-blue-500/50">·</span>
                  <span className="text-[10px] text-blue-600/70 dark:text-blue-400/70">
                    Puede cubrir franjas: {r.availableHours.map((h) => `${String(h).padStart(2, "0")}:00`).join(", ")}
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/50 shrink-0"
                onClick={() => onOpenAssignDialog(firstCoverableHour, r)}
              >
                <UserPlus className="h-3 w-3 mr-1" />
                Asignar
              </Button>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-blue-600/60 dark:text-blue-400/60 mt-2 italic">
        Estos empleados de Mostrador podrían apoyar como refuerzo en las franjas con mayor carga.
      </p>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function StaffCapacityAlert({ date, compact = false }: StaffCapacityAlertProps) {
  const { data, loading, error, lastUpdated, refetch } = useStaffCapacity(date);
  const [expanded, setExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(INITIAL_DIALOG);
  const [, setTick] = useState(0);

  // Re-render every 30s to update the relative time display
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const openAssignDialog = (hour: number, r: ReinforcementSuggestion) => {
    if (!date) return;
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

  if (!date) return null;
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Calculando capacidad del equipo...</span>
      </div>
    );
  }

  if (error || !data) return null;
  if (data.totalOperations === 0 && data.hourSlots.length === 0) return null;

  const config = STATUS_CONFIG[data.overallStatus];
  const StatusIcon = config.icon;
  const hasReinforcements = data.reinforcements && data.reinforcements.length > 0;

  // Compact mode for dashboard
  if (compact) {
    return (
      <div className="space-y-2">
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${config.bg} ${config.border}`}
        >
          <StatusIcon className={`h-5 w-5 shrink-0 ${config.text}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${config.text}`}>
                {config.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {data.overallUtilization}% carga
              </span>
              {hasReinforcements && (
                <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                  <UserPlus className="h-3 w-3" />
                  {data.reinforcements.length} refuerzo(s)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {data.summary}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-bold tabular-nums">{data.totalOperations}</div>
            <div className="text-[10px] text-muted-foreground">operaciones</div>
          </div>
        </div>
        {/* Show reinforcement names in compact mode too */}
        {hasReinforcements && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50">
            <ShieldPlus className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <span className="text-[11px] text-blue-700 dark:text-blue-300">
              Refuerzos: {data.reinforcements.map((r) => r.name).join(", ")}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Full mode for reservations page
  return (
    <>
      <div
        className={`rounded-lg border ${config.bg} ${config.border} overflow-hidden transition-all`}
      >
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:opacity-90 transition-opacity"
        >
          <StatusIcon
            className={`h-5 w-5 shrink-0 ${config.text} ${
              data.overallStatus === "deficit" ? "animate-pulse" : ""
            }`}
          />
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-semibold ${config.text}`}>
                {config.label}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.bg} ${config.text} border ${config.border}`}>
                {data.overallUtilization}% carga
              </span>
              {data.deficitHours.length > 0 && (
                <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                  {data.deficitHours.length} franja(s) con déficit
                </span>
              )}
              {data.tightHours.length > 0 && data.deficitHours.length === 0 && (
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  {data.tightHours.length} franja(s) ajustada(s)
                </span>
              )}
              {hasReinforcements && (
                <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                  <UserPlus className="h-3 w-3" />
                  {data.reinforcements.length} refuerzo(s) disponible(s)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.summary}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-lg font-bold tabular-nums">{data.totalOperations}</div>
              <div className="text-[10px] text-muted-foreground">ops pendientes</div>
            </div>
            {lastUpdated && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70" title={`Última actualización: ${lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}>
                <RefreshCw className="h-3 w-3" />
                <span>{formatRelativeTime(lastUpdated)}</span>
              </div>
            )}
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Expanded: hourly breakdown */}
        {expanded && (
          <div className="px-4 pb-4 border-t border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center justify-between mt-3 mb-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Desglose por franja horaria
              </h4>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-primary hover:underline"
              >
                {showDetails ? "Ocultar detalle" : "Ver detalle operaciones"}
              </button>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> &lt;70% Suficiente
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> 70-85% Justo
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" /> &gt;85% Déficit
              </span>
              <span className="flex items-center gap-1">
                <UserPlus className="h-2.5 w-2.5 text-blue-500" /> Refuerzo disponible
              </span>
            </div>

            <div className="space-y-0.5">
              {data.hourSlots
                .filter((s) => s.operations.length > 0 || s.availablePersonMinutes > 0)
                .map((slot) => (
                  <div key={slot.hour}>
                    <HourSlotBar slot={slot} />
                    {showDetails && (
                      <OperationDetail
                        slot={slot}
                        date={date}
                        onOpenAssignDialog={openAssignDialog}
                      />
                    )}
                  </div>
                ))}
            </div>

            {/* Reinforcement suggestions panel */}
            {hasReinforcements && (
              <ReinforcementPanel
                reinforcements={data.reinforcements}
                date={date}
                deficitHours={data.deficitHours}
                onOpenAssignDialog={openAssignDialog}
              />
            )}

            {/* Summary stats */}
            <div className="flex items-center gap-6 mt-4 pt-3 border-t border-gray-200/50 dark:border-gray-700/50 text-xs text-muted-foreground">
              <span>
                <strong className="text-foreground">{Math.round(data.totalPersonMinutesNeeded / 60)}h</strong>{" "}
                persona-horas necesarias
              </span>
              <span>
                <strong className="text-foreground">{Math.round(data.totalPersonMinutesAvailable / 60)}h</strong>{" "}
                persona-horas disponibles
              </span>
            </div>
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
