import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTransferStatusHistory } from '@/hooks/useTransferStatusHistory';
import type { TransferRequestStatus } from '@/types/transfers';
import {
  Clock,
  FileSearch,
  Send,
  CheckCircle2,
  Trophy,
  XCircle,
  Loader2,
  History,
  User,
  Shield,
  Bot,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, {
  icon: React.ElementType;
  color: string;
  colorDark: string;
  label: string;
}> = {
  pendiente: {
    icon: Clock,
    color: '#92400e',
    colorDark: '#fbbf24',
    label: 'Pendiente',
  },
  en_gestion: {
    icon: FileSearch,
    color: '#1e40af',
    colorDark: '#60A5FA',
    label: 'En gestión',
  },
  presupuesto_enviado: {
    icon: Send,
    color: '#c2410c',
    colorDark: '#fb923c',
    label: 'Ppto. Enviado',
  },
  confirmado: {
    icon: CheckCircle2,
    color: '#065f46',
    colorDark: '#34d399',
    label: 'Confirmado',
  },
  completado: {
    icon: Trophy,
    color: '#3730a3',
    colorDark: '#a5b4fc',
    label: 'Completado',
  },
  cancelado: {
    icon: XCircle,
    color: '#991b1b',
    colorDark: '#f87171',
    label: 'Cancelado',
  },
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

interface StatusTimelineProps {
  requestId: string | undefined;
  isDark: boolean;
}

export function StatusTimeline({ requestId, isDark }: StatusTimelineProps) {
  const { history, isLoading } = useTransferStatusHistory(requestId);

  const cardBg = isDark ? '#161B22' : '#ffffff';
  const cardBorder = isDark ? 'rgba(163, 230, 53, 0.12)' : '#e2e8f0';
  const titleColor = isDark ? '#E6EDF3' : '#1a365d';
  const textPrimary = isDark ? '#E6EDF3' : '#111827';
  const textSecondary = isDark ? 'rgba(230, 237, 243, 0.5)' : '#6b7280';
  const textMuted = isDark ? 'rgba(230, 237, 243, 0.35)' : '#9ca3af';
  const lineBg = isDark ? 'rgba(163, 230, 53, 0.1)' : '#e2e8f0';

  if (isLoading) {
    return (
      <div
        className="rounded-lg border p-6"
        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
      >
        <div className="flex items-center gap-2 mb-4">
          <History className="h-5 w-5" style={{ color: titleColor }} />
          <h3 className="text-base font-semibold" style={{ color: titleColor }}>
            Historial de estados
          </h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: textMuted }} />
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div
        className="rounded-lg border p-6"
        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
      >
        <div className="flex items-center gap-2 mb-4">
          <History className="h-5 w-5" style={{ color: titleColor }} />
          <h3 className="text-base font-semibold" style={{ color: titleColor }}>
            Historial de estados
          </h3>
        </div>
        <p className="text-sm text-center py-6" style={{ color: textMuted }}>
          No hay cambios de estado registrados aún.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border p-6"
      style={{ backgroundColor: cardBg, borderColor: cardBorder }}
    >
      <div className="flex items-center gap-2 mb-6">
        <History className="h-5 w-5" style={{ color: titleColor }} />
        <h3 className="text-base font-semibold" style={{ color: titleColor }}>
          Historial de estados
        </h3>
        <span
          className="text-xs px-2 py-0.5 rounded-full ml-auto"
          style={{
            backgroundColor: isDark ? 'rgba(163, 230, 53, 0.08)' : '#f1f5f9',
            color: textSecondary,
          }}
        >
          {history.length} {history.length === 1 ? 'cambio' : 'cambios'}
        </span>
      </div>

      <div className="relative">
        {history.map((entry, index) => {
          const isLast = index === history.length - 1;
          const statusConf = STATUS_CONFIG[entry.new_status] || STATUS_CONFIG.pendiente;
          const StatusIcon = statusConf.icon;
          const iconColor = isDark ? statusConf.colorDark : statusConf.color;
          const ActorIcon = ACTOR_ICONS[entry.changed_by_type] || User;
          const actorLabel = ACTOR_LABELS[entry.changed_by_type] || entry.changed_by_type;

          const prevConf = entry.previous_status
            ? STATUS_CONFIG[entry.previous_status]
            : null;

          return (
            <div key={entry.id} className="relative flex gap-4">
              {/* Vertical line */}
              {!isLast && (
                <div
                  className="absolute left-[15px] top-[32px] w-[2px]"
                  style={{
                    backgroundColor: lineBg,
                    bottom: 0,
                  }}
                />
              )}

              {/* Icon circle */}
              <div
                className="relative z-10 flex-shrink-0 w-[32px] h-[32px] rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: isDark
                    ? `${iconColor}20`
                    : `${iconColor}15`,
                  border: `2px solid ${iconColor}`,
                }}
              >
                <StatusIcon className="h-4 w-4" style={{ color: iconColor }} />
              </div>

              {/* Content */}
              <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-6'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {prevConf && (
                        <>
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: isDark
                                ? `${isDark ? prevConf.colorDark : prevConf.color}15`
                                : `${prevConf.color}12`,
                              color: isDark ? prevConf.colorDark : prevConf.color,
                            }}
                          >
                            {prevConf.label}
                          </span>
                          <span className="text-xs" style={{ color: textMuted }}>→</span>
                        </>
                      )}
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: isDark
                            ? `${iconColor}20`
                            : `${iconColor}12`,
                          color: iconColor,
                        }}
                      >
                        {statusConf.label}
                      </span>
                    </div>

                    {/* Actor info */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <ActorIcon className="h-3 w-3" style={{ color: textMuted }} />
                      <span className="text-xs" style={{ color: textSecondary }}>
                        {entry.changed_by_name || actorLabel}
                      </span>
                      <span className="text-xs" style={{ color: textMuted }}>
                        ({actorLabel})
                      </span>
                    </div>

                    {/* Note */}
                    {entry.note && (
                      <p
                        className="text-xs mt-1.5 italic"
                        style={{ color: textSecondary }}
                      >
                        "{entry.note}"
                      </p>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs" style={{ color: textMuted }}>
                      {formatDistanceToNow(new Date(entry.created_at), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: textMuted }}>
                      {format(new Date(entry.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
