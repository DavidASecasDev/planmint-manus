import { Bell, MessageSquare, CheckCheck } from 'lucide-react';
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
import { useBrokerNotifications } from '@/hooks/useBrokerNotifications';
import type { NotificationWithDetails } from '@/types/notifications';

/*
 * Azul Cars Brand – Notification Bell
 * Bell icon: white on navy header | Badge: gold oklch(0.72 0.10 80)
 * Popover: white bg | Navy text
 */

export function BrokerNotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } =
    useBrokerNotifications();

  const handleClick = async (notification: NotificationWithDetails) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    if (notification.entity_id) {
      navigate(`/broker/request/${notification.entity_id}`);
    }
  };

  const recentNotifications = notifications.slice(0, 15);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 transition-colors hover:bg-white/10"
          style={{ color: 'rgba(255,255,255,0.8)' }}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full flex items-center justify-center text-[10px]"
              style={{
                backgroundColor: 'oklch(0.72 0.10 80)',
                color: '#001321',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="end"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E2DB',
          boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid #E5E2DB' }}
        >
          <h4
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 700,
              fontSize: '11px',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              color: '#001321',
            }}
          >
            Notificaciones
          </h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead()}
              className="h-7 text-xs hover:bg-gray-100"
              style={{ color: 'oklch(0.55 0.10 80)' }}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[350px]">
          {loading ? (
            <div className="flex items-center justify-center h-20">
              <div
                className="animate-spin rounded-full h-5 w-5 border-b-2"
                style={{ borderColor: 'oklch(0.72 0.10 80)' }}
              />
            </div>
          ) : recentNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Bell className="h-8 w-8 mb-2" style={{ color: '#D1D5DB' }} />
              <p
                className="text-sm"
                style={{ color: '#9CA3AF', fontFamily: 'Barlow, sans-serif' }}
              >
                Sin notificaciones
              </p>
            </div>
          ) : (
            <div>
              {recentNotifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleClick(notification)}
                  className="w-full text-left px-4 py-3 transition-colors hover:bg-gray-50"
                  style={{
                    backgroundColor: !notification.is_read ? '#FEFCE8' : 'transparent',
                    borderBottom: '1px solid #F3F4F6',
                  }}
                >
                  <div className="flex gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        backgroundColor: !notification.is_read
                          ? 'rgba(0,19,33,0.08)'
                          : '#F3F4F6',
                      }}
                    >
                      <MessageSquare
                        className="h-4 w-4"
                        style={{
                          color: !notification.is_read ? '#001321' : '#9CA3AF',
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className="text-sm truncate"
                          style={{
                            color: !notification.is_read ? '#001321' : '#6B7280',
                            fontFamily: 'Barlow, sans-serif',
                            fontWeight: !notification.is_read ? 600 : 400,
                          }}
                        >
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <span
                            className="h-2 w-2 rounded-full flex-shrink-0 mt-1.5"
                            style={{ backgroundColor: 'oklch(0.72 0.10 80)' }}
                          />
                        )}
                      </div>
                      <p
                        className="text-sm line-clamp-2 mt-0.5"
                        style={{ color: '#6B7280', fontFamily: 'Barlow, sans-serif' }}
                      >
                        {notification.body}
                      </p>
                      <p
                        className="text-xs mt-1"
                        style={{ color: '#9CA3AF', fontFamily: 'Barlow, sans-serif' }}
                      >
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
