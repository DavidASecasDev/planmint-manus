import { Bell, AtSign, UserCheck, Clock, Check, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

const TYPE_ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  mention: AtSign,
  assignment: UserCheck,
  reminder: Clock,
};

const TYPE_COLORS: Record<NotificationType, string> = {
  mention: 'text-blue-500',
  assignment: 'text-green-500',
  reminder: 'text-orange-500',
};

export function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, fetchNotifications } = useNotifications();
  
  // Initialize reminder checking
  useReminderNotifications();

  const handleNotificationClick = async (notification: NotificationWithDetails) => {
    // Mark as read
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Navigate to the appropriate page
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
        <Button variant="ghost" size="icon" className="relative">
          <Bell className={cn("h-5 w-5", unreadCount > 0 && "animate-[wiggle_0.5s_ease-in-out]")} />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs animate-pulse"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notificaciones</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="h-8 text-xs"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>

        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-20">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : recentNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No hay notificaciones</p>
            </div>
          ) : (
            <div className="divide-y">
              {recentNotifications.map((notification) => {
                const Icon = TYPE_ICONS[notification.type];
                return (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      'w-full text-left p-4 hover:bg-muted/50 transition-colors',
                      !notification.is_read && 'bg-primary/5'
                    )}
                  >
                    <div className="flex gap-3">
                      <div className={cn('mt-0.5', TYPE_COLORS[notification.type])}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm truncate">
                            {notification.title}
                          </p>
                          {!notification.is_read && (
                            <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                          {notification.body}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
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

        <Separator />
        <div className="p-2">
          <Button
            variant="ghost"
            className="w-full justify-center text-sm"
            onClick={handleViewAll}
          >
            Ver todas las notificaciones
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
