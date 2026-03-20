import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTransferStatusHistory } from '@/hooks/useTransferStatusHistory';
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

/*
 * Azul Cars Brand – Status Timeline
 * Card: #FFFFFF | Navy: #001321 | Gold: oklch(0.72 0.10 80)
 * Headings: Montserrat | Body: Barlow
 */

const STATUS_CONFIG: Record<string, {
  icon: React.ElementType;
  color: string;
  label: string;
}> = {
  pendiente:           { icon: Clock,        color: '#92400E', label: 'Pendiente' },
  en_gestion:          { icon: FileSearch,   color: '#1E40AF', label: 'En gestión' },
  presupuesto_enviado: { icon: Send,         color: '#C2410C', label: 'Ppto. Enviado' },
  confirmado:          { icon: CheckCircle2, color: '#065F46', label: 'Confirmado' },
  completado:          { icon: Trophy,       color: '#3730A3', label: 'Completado' },
  cancelado:           { icon: XCircle,      color: '#991B1B', label: 'Cancelado' },
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

export function StatusTimeline({ requestId }: StatusTimelineProps) {
  const { history, isLoading } = useTransferStatusHistory(requestId);

  const cardBg = '#FFFFFF';
  const cardBorder = '#E5E2DB';
  const textMuted = '#9CA3AF';
  const textSecondary = '#6B7280';

  if (isLoading) {
    return (
      <div className="rounded-lg p-6 mb-6" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center gap-2 mb-4">
          <History className="h-4 w-4" style={{ color: textMuted }} />
          <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: textMuted }}>
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
      <div className="rounded-lg p-6 mb-6" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center gap-2 mb-4">
          <History className="h-4 w-4" style={{ color: textMuted }} />
          <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: textMuted }}>
            Historial de estados
          </h3>
        </div>
        <p className="text-sm text-center py-6" style={{ color: textMuted, fontFamily: 'Barlow, sans-serif' }}>
          No hay cambios de estado registrados aún.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-6 mb-6" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center gap-2 mb-6">
        <History className="h-4 w-4" style={{ color: textMuted }} />
        <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: textMuted }}>
          Historial de estados
        </h3>
        <span
          className="text-xs px-2 py-0.5 rounded-full ml-auto"
          style={{
            backgroundColor: '#F5F3EF',
            color: textSecondary,
            fontFamily: 'Barlow, sans-serif',
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
          const iconColor = statusConf.color;
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
                            className="text-xs px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: `${prevConf.color}12`,
                              color: prevConf.color,
                              fontFamily: 'Montserrat, sans-serif',
                              fontWeight: 600,
                            }}
                          >
                            {prevConf.label}
                          </span>
                          <span className="text-xs" style={{ color: textMuted }}>→</span>
                        </>
                      )}
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: `${iconColor}15`,
                          color: iconColor,
                          fontFamily: 'Montserrat, sans-serif',
                          fontWeight: 700,
                        }}
                      >
                        {statusConf.label}
                      </span>
                    </div>

                    {/* Actor info */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <ActorIcon className="h-3 w-3" style={{ color: textMuted }} />
                      <span className="text-xs" style={{ color: textSecondary, fontFamily: 'Barlow, sans-serif' }}>
                        {entry.changed_by_name || actorLabel}
                      </span>
                      <span className="text-xs" style={{ color: textMuted, fontFamily: 'Barlow, sans-serif' }}>
                        ({actorLabel})
                      </span>
                    </div>

                    {/* Note */}
                    {entry.note && (
                      <p className="text-xs mt-1.5 italic" style={{ color: textSecondary, fontFamily: 'Barlow, sans-serif' }}>
                        "{entry.note}"
                      </p>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs" style={{ color: textMuted, fontFamily: 'Barlow, sans-serif' }}>
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: es })}
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: textMuted, fontFamily: 'Barlow, sans-serif' }}>
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
