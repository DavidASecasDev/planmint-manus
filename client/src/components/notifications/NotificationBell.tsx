/*
 * Azul Cars Brand — Notification Bell
 * Bell icon: #52555B on warm header | Badge: gold oklch(0.72 0.10 80)
 * Popover: white bg | Navy text
 * Headings: Montserrat | Body: Barlow
 */
import { Bell, AtSign, UserCheck, Clock, Check, CheckCheck, MessageSquare } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { useNotifications } from '@/hooks/useNotifications';
import { useReminderNotifications } from '@/hooks/useReminderNotifications';
import { NotificationWithDetails, NotificationType } from '@/types/notifications';
import { cn } from '@/lib/utils';

const brand = {
  navy: '#001321',
  gold: 'oklch(0.72 0.10 80)',
  textDark: '#0F1216',
  textMuted: '#52555B',
  warmBg: '#F5F3EF',
  borderLight: 'rgba(0,19,33,0.08)',
};

const TYPE_ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  mention: AtSign,
  assignment: UserCheck,
  reminder: Clock,
  transfer_note: MessageSquare,
};

const TYPE_COLORS: Record<NotificationType, string> = {
  mention: '#3B82F6',
  assignment: '#22C55E',
  reminder: '#F97316',
  transfer_note: 'oklch(0.72 0.10 80)',
};

export function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, fetchNotifications } = useNotifications();
  
  useReminderNotifications();

  const handleNotificationClick = async (notification: NotificationWithDetails) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    if (notification.task_id) {
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
          className="relative h-9 w-9"
          style={{ color: brand.textMuted }}
        >
          <Bell className={cn("h-5 w-5", unreadCount > 0 && "animate-[wiggle_0.5s_ease-in-out]")} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 h-5 min-w-[20px] flex items-center justify-center rounded-full text-[10px] font-bold px-1"
              style={{
                backgroundColor: brand.gold,
                color: brand.navy,
                fontFamily: 'Montserrat, sans-serif',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="end"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: brand.borderLight,
        }}
      >
        <div
          className="flex items-center justify-between p-4"
          style={{ borderBottom: `1px solid ${brand.borderLight}` }}
        >
          <h4
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 700,
              fontSize: '14px',
              color: brand.textDark,
            }}
          >
            Notificaciones
          </h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="h-8 text-xs"
              style={{
                color: brand.gold,
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
                className="animate-spin rounded-full h-6 w-6 border-b-2"
                style={{ borderColor: brand.gold }}
              />
            </div>
          ) : recentNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20">
              <Bell className="h-8 w-8 mb-2 opacity-30" style={{ color: brand.textMuted }} />
              <p className="text-sm" style={{ color: brand.textMuted, fontFamily: 'Barlow, sans-serif' }}>
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
                    className="w-full text-left p-4 transition-colors"
                    style={{
                      backgroundColor: !notification.is_read ? 'rgba(201,169,110,0.04)' : 'transparent',
                      borderBottom: `1px solid ${brand.borderLight}`,
                      fontFamily: 'Barlow, sans-serif',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,19,33,0.03)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = !notification.is_read ? 'rgba(201,169,110,0.04)' : 'transparent'; }}
                  >
                    <div className="flex gap-3">
                      <div className="mt-0.5" style={{ color: iconColor }}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className="text-sm truncate"
                            style={{
                              fontWeight: 600,
                              color: brand.textDark,
                            }}
                          >
                            {notification.title}
                          </p>
                          {!notification.is_read && (
                            <span
                              className="h-2 w-2 rounded-full flex-shrink-0 mt-1.5"
                              style={{ backgroundColor: brand.gold }}
                            />
                          )}
                        </div>
                        <p
                          className="text-sm line-clamp-2 mt-0.5"
                          style={{ color: brand.textMuted }}
                        >
                          {notification.body}
                        </p>
                        <p
                          className="text-xs mt-1"
                          style={{ color: brand.textMuted, opacity: 0.7 }}
                        >
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

        <div
          className="p-2"
          style={{ borderTop: `1px solid ${brand.borderLight}` }}
        >
          <Button
            variant="ghost"
            className="w-full justify-center text-sm"
            onClick={handleViewAll}
            style={{
              color: brand.gold,
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
