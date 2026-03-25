/*
 * Azul Cars Brand — Notification Bell
 * Uses semantic tokens for dark/light mode compatibility
 * Bell icon: muted-foreground | Badge: gold accent
 * Popover: popover bg | foreground text
 */
import { Bell, AtSign, UserCheck, Clock, Check, CheckCheck, MessageSquare, Wrench, AlertTriangle, FileWarning, Car, Mail, UserPlus, Timer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import { useReminderNotifications } from '@/hooks/useReminderNotifications';
import { NotificationWithDetails, NotificationType } from '@/types/notifications';
import { cn } from '@/lib/utils';

const TYPE_ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  mention: AtSign,
  assignment: UserCheck,
  reminder: Clock,
  transfer_note: MessageSquare,
  repair_update: Wrench,
  accident_report: AlertTriangle,
  damage_report_update: FileWarning,
  vehicle_prep_alert: Car,
  transfer_stale_alert: Timer,
  invitation_sent: Mail,
  invitation_accepted: UserPlus,
};

const TYPE_COLORS: Record<NotificationType, string> = {
  mention: '#3B82F6',
  assignment: '#22C55E',
  reminder: '#F97316',
  transfer_note: 'oklch(0.72 0.10 80)',
  repair_update: '#6366F1',
  accident_report: '#EF4444',
  damage_report_update: '#F43F5E',
  vehicle_prep_alert: '#EF4444',
  transfer_stale_alert: '#F59E0B',
  invitation_sent: '#A855F7',
  invitation_accepted: '#10B981',
};

export function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, fetchNotifications } = useNotifications();
  
  useReminderNotifications();

  const handleNotificationClick = async (notification: NotificationWithDetails) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    // Navigate based on entity type
    const { entity_type, entity_id } = notification;
    const routes: Record<string, string> = {
      task: `/tasks?task=${entity_id}`,
      task_update: `/tasks`,
      reminder: `/tasks`,
      transfer_request: `/transfers/requests/${entity_id}`,
      transfer_note: `/transfers/requests/${entity_id}`,
      repair: `/garatech/repairs/${entity_id}`,
      accident: `/garatech/accidents/${entity_id}`,
      damage_report: `/garatech/reports/${entity_id}`,
      invitation: `/admin/members`,
    };
    const route = routes[entity_type];
    if (route) {
      navigate(route);
    } else if (notification.task_id) {
      navigate(`/tasks?task=${notification.task_id}`);
    } else if (notification.transfer_request_id) {
      navigate(`/transfers/${notification.transfer_request_id}`);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const handleViewAll = () => {
    navigate('/notifications');
  };

  const recentNotifications = notifications.slice(0, 10);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-muted-foreground"
        >
          <Bell className={cn("h-5 w-5", unreadCount > 0 && "animate-[wiggle_0.5s_ease-in-out]")} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 h-5 min-w-[20px] flex items-center justify-center rounded-full text-[10px] font-bold px-1"
              style={{
                backgroundColor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
                fontFamily: 'Montserrat, sans-serif',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 bg-popover border-border"
        align="end"
      >
        <div
          className="flex items-center justify-between p-4 border-b border-border"
        >
          <h4
            className="text-foreground"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 700,
              fontSize: '14px',
            }}
          >
            Notificaciones
          </h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="h-8 text-xs text-primary"
              style={{
                fontFamily: 'Barlow, sans-serif',
                fontWeight: 600,
              }}
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>

        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-20">
              <div
                className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"
              />
            </div>
          ) : recentNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20">
              <Bell className="h-8 w-8 mb-2 opacity-30 text-muted-foreground" />
              <p className="text-sm text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
                No hay notificaciones
              </p>
            </div>
          ) : (
            <div>
              {recentNotifications.map((notification) => {
                const Icon = TYPE_ICONS[notification.type];
                const iconColor = TYPE_COLORS[notification.type];
                return (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "w-full text-left p-4 transition-colors border-b border-border",
                      "hover:bg-accent/50",
                      !notification.is_read && "bg-primary/[0.04]"
                    )}
                    style={{ fontFamily: 'Barlow, sans-serif' }}
                  >
                    <div className="flex gap-3">
                      <div className="mt-0.5" style={{ color: iconColor }}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className="text-sm truncate text-foreground"
                            style={{ fontWeight: 600 }}
                          >
                            {notification.title}
                          </p>
                          {!notification.is_read && (
                            <span
                              className="h-2 w-2 rounded-full flex-shrink-0 mt-1.5 bg-primary"
                            />
                          )}
                        </div>
                        <p className="text-sm line-clamp-2 mt-0.5 text-muted-foreground">
                          {notification.body}
                        </p>
                        <p className="text-xs mt-1 text-muted-foreground/70">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="p-2 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-center text-sm text-primary"
            onClick={handleViewAll}
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 600,
              fontSize: '12px',
              letterSpacing: '0.05em',
            }}
          >
            Ver todas las notificaciones
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
