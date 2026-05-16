import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTransferChangeHistory } from '@/hooks/useTransferChangeHistory';
import type { TransferChangeHistoryEntry, FieldChange } from '@/types/transferChangeHistory';
import {
  History,
  Loader2,
  PlusCircle,
  Pencil,
  ArrowRightLeft,
  Layers,
  User,
  Shield,
  Bot,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState } from 'react';

/*
 * Azul Cars Brand – Change History Timeline
 * Card: #FFFFFF | Navy: #001321 | Gold: oklch(0.72 0.10 80)
 * Headings: Montserrat | Body: Barlow
 */

const CHANGE_TYPE_CONFIG: Record<string, {
  icon: React.ElementType;
  color: string;
  label: string;
}> = {
  created:        { icon: PlusCircle,     color: '#065F46', label: 'Creación' },
  updated:        { icon: Pencil,         color: '#1E40AF', label: 'Edición' },
  status_change:  { icon: ArrowRightLeft, color: '#C2410C', label: 'Cambio de estado' },
  items_updated:  { icon: Layers,         color: '#7C3AED', label: 'Trayectos actualizados' },
};

const ACTOR_ICONS: Record<string, React.ElementType> = {
  admin: Shield,
  broker: User,
  system: Bot,
};

const ACTOR_LABELS: Record<string, string> = {
  admin: 'Admin',
  broker: 'Broker',
  system: 'Sistema',
};

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return value.toString();
  return String(value);
}

function ChangeDetail({ change }: { change: FieldChange }) {
  return (
    <div className="flex items-start gap-2 text-xs py-1" style={{ fontFamily: 'Barlow, sans-serif' }}>
      <span className="font-medium text-gray-700 min-w-[120px] shrink-0">{change.label}:</span>
      <span className="text-red-600 line-through opacity-60">{formatFieldValue(change.old_value)}</span>
      <span className="text-gray-400">→</span>
      <span className="text-emerald-700 font-medium">{formatFieldValue(change.new_value)}</span>
    </div>
  );
}

function ChangeEntry({ entry, isLast }: { entry: TransferChangeHistoryEntry; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const typeConf = CHANGE_TYPE_CONFIG[entry.change_type] || CHANGE_TYPE_CONFIG.updated;
  const TypeIcon = typeConf.icon;
  const iconColor = typeConf.color;
  const ActorIcon = ACTOR_ICONS[entry.changed_by_type] || User;
  const actorLabel = ACTOR_LABELS[entry.changed_by_type] || entry.changed_by_type;

  // Parse changes - handle both string and array
  let changes: FieldChange[] = [];
  try {
    if (typeof entry.changes === 'string') {
      changes = JSON.parse(entry.changes);
    } else if (Array.isArray(entry.changes)) {
      changes = entry.changes;
    }
  } catch {
    changes = [];
  }

  const hasDetails = changes.length > 0;

  return (
    <div className="relative flex gap-4">
      {/* Vertical line */}
      {!isLast && (
        <div
          className="absolute left-[15px] top-[32px] w-[2px]"
          style={{ backgroundColor: '#E5E2DB', bottom: 0 }}
        />
      )}

      {/* Icon circle */}
      <div
        className="relative z-10 flex-shrink-0 w-[32px] h-[32px] rounded-full flex items-center justify-center"
        style={{
          backgroundColor: `${iconColor}15`,
          border: `2px solid ${iconColor}`,
        }}
      >
        <TypeIcon className="h-4 w-4" style={{ color: iconColor }} />
      </div>

      {/* Content */}
      <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-6'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Type badge + summary */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  backgroundColor: `${iconColor}15`,
                  color: iconColor,
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 700,
                }}
              >
                {typeConf.label}
              </span>
              {entry.summary && (
                <span className="text-xs text-gray-600 truncate" style={{ fontFamily: 'Barlow, sans-serif' }}>
                  {entry.summary}
                </span>
              )}
            </div>

            {/* Actor info */}
            <div className="flex items-center gap-1.5 mt-1.5">
              <ActorIcon className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-600" style={{ fontFamily: 'Barlow, sans-serif' }}>
                {entry.changed_by_name || actorLabel}
              </span>
              <span className="text-xs text-gray-400" style={{ fontFamily: 'Barlow, sans-serif' }}>
                ({actorLabel})
              </span>
            </div>

            {/* Expandable details */}
            {hasDetails && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 mt-2 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500 }}
              >
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {expanded ? 'Ocultar detalles' : `Ver ${changes.length} cambio(s)`}
              </button>
            )}

            {expanded && hasDetails && (
              <div className="mt-2 p-3 rounded-md bg-gray-50 border border-gray-100">
                {changes.map((change, idx) => (
                  <ChangeDetail key={idx} change={change} />
                ))}
              </div>
            )}
          </div>

          {/* Timestamp */}
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-gray-400" style={{ fontFamily: 'Barlow, sans-serif' }}>
              {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: es })}
            </div>
            <div className="text-[10px] mt-0.5 text-gray-400" style={{ fontFamily: 'Barlow, sans-serif' }}>
              {format(new Date(entry.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ChangeHistoryTimelineProps {
  requestId: string | undefined;
}

export function ChangeHistoryTimeline({ requestId }: ChangeHistoryTimelineProps) {
  const { changeHistory, isLoading } = useTransferChangeHistory(requestId);

  const cardBg = '#FFFFFF';
  const cardBorder = '#E5E2DB';
  const textMuted = '#9CA3AF';

  if (isLoading) {
    return (
      <div className="rounded-lg p-6 mb-6" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center gap-2 mb-4">
          <History className="h-4 w-4" style={{ color: textMuted }} />
          <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: textMuted }}>
            Historial de cambios
          </h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: textMuted }} />
        </div>
      </div>
    );
  }

  if (changeHistory.length === 0) {
    return (
      <div className="rounded-lg p-6 mb-6" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center gap-2 mb-4">
          <History className="h-4 w-4" style={{ color: textMuted }} />
          <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: textMuted }}>
            Historial de cambios
          </h3>
        </div>
        <p className="text-sm text-center py-6" style={{ color: textMuted, fontFamily: 'Barlow, sans-serif' }}>
          No hay cambios registrados aún.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-6 mb-6" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center gap-2 mb-6">
        <History className="h-4 w-4" style={{ color: textMuted }} />
        <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: textMuted }}>
          Historial de cambios
        </h3>
        <span
          className="text-xs px-2 py-0.5 rounded-full ml-auto"
          style={{
            backgroundColor: '#F5F3EF',
            color: '#6B7280',
            fontFamily: 'Barlow, sans-serif',
          }}
        >
          {changeHistory.length} {changeHistory.length === 1 ? 'cambio' : 'cambios'}
        </span>
      </div>

      <div className="relative">
        {changeHistory.map((entry, index) => (
          <ChangeEntry
            key={entry.id}
            entry={entry}
            isLast={index === changeHistory.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
