/*
 * Azul Cars Brand — Broker Notification Bell
 * Uses semantic CSS tokens for dark/light mode compatibility
 * Bell: white on navy header | Badge: gold primary
 * Popover: bg-popover with border-border
 */
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
import { cn } from '@/lib/utils';

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
              className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full flex items-center justify-center text-[10px] bg-primary text-primary-foreground"
              style={{
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
        className="w-80 p-0 bg-popover border-border shadow-lg"
        align="end"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h4
            className="text-foreground"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 700,
              fontSize: '11px',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
            }}
          >
            Notificaciones
          </h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead()}
              className="h-7 text-xs text-primary hover:bg-accent"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[350px]">
          {loading ? (
            <div className="flex items-center justify-center h-20">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
            </div>
          ) : recentNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Bell className="h-8 w-8 mb-2 text-muted-foreground/40" />
              <p
                className="text-sm text-muted-foreground"
                style={{ fontFamily: 'Barlow, sans-serif' }}
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
                  className={cn(
                    "w-full text-left px-4 py-3 transition-colors border-b border-border",
                    "hover:bg-accent/50",
                    !notification.is_read && "bg-primary/[0.04]"
                  )}
                >
                  <div className="flex gap-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                        !notification.is_read ? "bg-muted" : "bg-muted/50"
                      )}
                    >
                      <MessageSquare
                        className={cn(
                          "h-4 w-4",
                          !notification.is_read ? "text-foreground" : "text-muted-foreground"
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "text-sm truncate",
                            !notification.is_read ? "text-foreground font-semibold" : "text-muted-foreground"
                          )}
                          style={{ fontFamily: 'Barlow, sans-serif' }}
                        >
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <span className="h-2 w-2 rounded-full flex-shrink-0 mt-1.5 bg-primary" />
                        )}
                      </div>
                      <p
                        className="text-sm line-clamp-2 mt-0.5 text-muted-foreground"
                        style={{ fontFamily: 'Barlow, sans-serif' }}
                      >
                        {notification.body}
                      </p>
                      <p
                        className="text-xs mt-1 text-muted-foreground/70"
                        style={{ fontFamily: 'Barlow, sans-serif' }}
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
