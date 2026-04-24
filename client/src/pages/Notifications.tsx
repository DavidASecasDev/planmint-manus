import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, AtSign, UserCheck, Clock, Check, CheckCheck, Trash2, MessageSquare, Wrench, AlertTriangle, FileWarning, Car, Mail, UserPlus, Timer, Baby } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/loading-skeleton';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationWithDetails, NotificationType } from '@/types/notifications';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  equipment_shortage: Baby,
  invitation_sent: Mail,
  invitation_accepted: UserPlus,
};

const TYPE_COLORS: Record<NotificationType, string> = {
  mention: 'text-blue-500 bg-blue-500/10',
  assignment: 'text-green-500 bg-green-500/10',
  reminder: 'text-orange-500 bg-orange-500/10',
  transfer_note: 'text-amber-600 bg-amber-500/10',
  repair_update: 'text-indigo-500 bg-indigo-500/10',
  accident_report: 'text-red-500 bg-red-500/10',
  damage_report_update: 'text-rose-500 bg-rose-500/10',
  vehicle_prep_alert: 'text-red-600 bg-red-500/10',
  transfer_stale_alert: 'text-amber-500 bg-amber-500/10',
  equipment_shortage: 'text-pink-500 bg-pink-500/10',
  invitation_sent: 'text-purple-500 bg-purple-500/10',
  invitation_accepted: 'text-emerald-500 bg-emerald-500/10',
};

const TYPE_LABELS: Record<NotificationType, string> = {
  mention: 'Mención',
  assignment: 'Asignación',
  reminder: 'Recordatorio',
  transfer_note: 'Nota de Transfer',
  repair_update: 'Reparación',
  accident_report: 'Accidente',
  damage_report_update: 'Informe Daños',
  vehicle_prep_alert: 'Preparación Vehículo',
  transfer_stale_alert: 'Transfer Sin Respuesta',
  equipment_shortage: 'Stock Equipamiento',
  invitation_sent: 'Invitación Enviada',
  invitation_accepted: 'Invitación Aceptada',
};

export default function Notifications() {
  const navigate = useNavigate();
  const { 
    notifications, 
    unreadCount, 
    loading, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification 
  } = useNotifications();
  const [activeTab, setActiveTab] = useState<'unread' | 'all'>('unread');

  const filteredNotifications = activeTab === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const handleNotificationClick = async (notification: NotificationWithDetails) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Navigate to the appropriate page based on entity type
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

  const handleMarkAsRead = async (e: React.MouseEvent, notification: NotificationWithDetails) => {
    e.stopPropagation();
    if (!notification.is_read) {
      await markAsRead(notification.id);
      toast.success('Notificación marcada como leída');
    }
  };

  const handleDelete = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    const success = await deleteNotification(notificationId);
    if (success) {
      toast.success('Notificación eliminada');
    }
  };

  const handleMarkAllAsRead = async () => {
    const success = await markAllAsRead();
    if (success) {
      toast.success('Todas las notificaciones marcadas como leídas');
    }
  };

  return (
    <AppLayout title="Notificaciones">
      <div className="max-w-3xl mx-auto">
        <PageHeader
          title="Notificaciones"
          description="Gestiona tus notificaciones y mantente al día con tu equipo."
          icon={Bell}
          actions={
            unreadCount > 0 && (
              <Button onClick={handleMarkAllAsRead} variant="outline" className="gap-2">
                <CheckCheck className="h-4 w-4" />
                Marcar todas como leídas
              </Button>
            )
          }
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'unread' | 'all')}>
          <TabsList className="mb-6">
            <TabsTrigger value="unread" className="gap-2">
              No leídas
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            {loading ? (
              <ListSkeleton count={3} />
            ) : filteredNotifications.length === 0 ? (
              <EmptyState
                icon={Bell}
                title={activeTab === 'unread' ? 'No tienes notificaciones sin leer' : 'No tienes notificaciones'}
                description={
                  activeTab === 'unread'
                    ? '¡Estás al día! Las nuevas notificaciones aparecerán aquí.'
                    : 'Las notificaciones de menciones, asignaciones y recordatorios aparecerán aquí.'
                }
              />
            ) : (
              <div className="space-y-3">
                {filteredNotifications.map((notification) => {
                  const Icon = TYPE_ICONS[notification.type];
                  return (
                    <Card
                      key={notification.id}
                      className={cn(
                        'cursor-pointer transition-all duration-200 hover-lift border-border/50',
                        !notification.is_read && 'ring-1 ring-primary/20 bg-primary/[0.02]'
                      )}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <CardContent className="p-5">
                        <div className="flex gap-4">
                          <div
                            className={cn(
                              'h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0',
                              TYPE_COLORS[notification.type]
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-semibold text-foreground truncate">
                                    {notification.title}
                                  </p>
                                  <Badge variant="outline" className="text-xs font-medium">
                                    {TYPE_LABELS[notification.type]}
                                  </Badge>
                                  {!notification.is_read && (
                                    <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">
                                  {notification.body}
                                </p>
                                <p className="text-xs text-muted-foreground mt-2">
                                  {format(new Date(notification.created_at), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
                                  {' · '}
                                  {formatDistanceToNow(new Date(notification.created_at), {
                                    addSuffix: true,
                                    locale: es,
                                  })}
                                </p>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                {!notification.is_read && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                    onClick={(e) => handleMarkAsRead(e, notification)}
                                    title="Marcar como leída"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={(e) => handleDelete(e, notification.id)}
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
