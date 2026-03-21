import { useState } from 'react';
import { Bell, BellOff, BellRing, Smartphone, Monitor, AlertTriangle, CheckCircle2, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { usePushSubscription, PushStatus } from '@/hooks/usePushSubscription';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<PushStatus, {
  icon: typeof Bell;
  label: string;
  description: string;
  color: string;
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
}> = {
  loading: {
    icon: Loader2,
    label: 'Cargando...',
    description: 'Verificando el estado de las notificaciones push.',
    color: 'text-muted-foreground',
    badgeVariant: 'secondary',
  },
  ready: {
    icon: Bell,
    label: 'Disponible',
    description: 'Las notificaciones push están disponibles. Actívalas para recibir alertas incluso cuando la app esté cerrada.',
    color: 'text-blue-500 dark:text-blue-400',
    badgeVariant: 'outline',
  },
  subscribed: {
    icon: BellRing,
    label: 'Activadas',
    description: 'Recibirás notificaciones push en este dispositivo cuando haya cambios en reparaciones, nuevas tareas o solicitudes de transfers.',
    color: 'text-green-500 dark:text-green-400',
    badgeVariant: 'default',
  },
  not_supported: {
    icon: BellOff,
    label: 'No soportado',
    description: 'Tu navegador no soporta notificaciones push. Prueba con Chrome, Edge o Firefox.',
    color: 'text-muted-foreground',
    badgeVariant: 'secondary',
  },
  denied: {
    icon: AlertTriangle,
    label: 'Bloqueadas',
    description: 'Has bloqueado las notificaciones en tu navegador. Ve a la configuración del navegador para desbloquearlas.',
    color: 'text-destructive',
    badgeVariant: 'destructive',
  },
  ios_not_installed: {
    icon: Download,
    label: 'Instalar app',
    description: 'En iOS, las notificaciones push solo funcionan si instalas la app. Toca "Compartir" y luego "Añadir a pantalla de inicio".',
    color: 'text-amber-500 dark:text-amber-400',
    badgeVariant: 'outline',
  },
};

export function PushNotificationManager() {
  const {
    pushStatus,
    hasActiveSubscription,
    subscribing,
    subscribe,
    unsubscribe,
    subscriptions,
  } = usePushSubscription();

  const { preferences, updatePreferences } = useNotificationPreferences();
  const [toggling, setToggling] = useState(false);

  const config = STATUS_CONFIG[pushStatus];
  const StatusIcon = config.icon;

  const handleTogglePush = async () => {
    setToggling(true);
    try {
      if (hasActiveSubscription) {
        const success = await unsubscribe();
        if (success) {
          toast.success('Notificaciones push desactivadas');
          // Update preferences
          if (preferences) {
            await updatePreferences({ channel_push: false });
          }
        } else {
          toast.error('Error al desactivar las notificaciones push');
        }
      } else {
        const success = await subscribe();
        if (success) {
          toast.success('Notificaciones push activadas');
          // Update preferences
          if (preferences) {
            await updatePreferences({ channel_push: true });
          }
        } else {
          toast.error('No se pudieron activar las notificaciones push. Verifica los permisos del navegador.');
        }
      }
    } finally {
      setToggling(false);
    }
  };

  const handleTestNotification = async () => {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      registration.active?.postMessage({
        type: 'SHOW_NOTIFICATION',
        title: 'Azul Cars - Prueba',
        options: {
          body: 'Las notificaciones push están funcionando correctamente.',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'test-notification',
          vibrate: [200, 100, 200],
          data: { url: '/notifications' },
          actions: [
            { action: 'view', title: 'Ver' },
            { action: 'dismiss', title: 'Cerrar' },
          ],
        },
      });
      toast.success('Notificación de prueba enviada');
    } catch (error) {
      toast.error('Error al enviar la notificación de prueba');
    }
  };

  const isActionable = pushStatus === 'ready' || pushStatus === 'subscribed';

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              hasActiveSubscription
                ? 'bg-green-500/10 dark:bg-green-500/20'
                : 'bg-muted'
            )}>
              <StatusIcon className={cn('h-5 w-5', config.color, pushStatus === 'loading' && 'animate-spin')} />
            </div>
            <div>
              <CardTitle className="text-base">Notificaciones Push</CardTitle>
              <CardDescription className="text-sm">
                Alertas del sistema en tu dispositivo
              </CardDescription>
            </div>
          </div>
          <Badge variant={config.badgeVariant} className="text-xs">
            {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {config.description}
        </p>

        {isActionable && (
          <>
            <Separator />

            {/* Main toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                  {hasActiveSubscription ? (
                    <BellRing className="h-4 w-4 text-green-500 dark:text-green-400" />
                  ) : (
                    <Bell className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <Label htmlFor="push-toggle" className="text-sm font-medium cursor-pointer">
                  {hasActiveSubscription ? 'Push activadas' : 'Activar push'}
                </Label>
              </div>
              <Switch
                id="push-toggle"
                checked={hasActiveSubscription}
                onCheckedChange={handleTogglePush}
                disabled={subscribing || toggling}
              />
            </div>

            {/* Device info */}
            {hasActiveSubscription && subscriptions.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Dispositivos suscritos
                </p>
                {subscriptions.map((sub) => {
                  const isMobile = sub.user_agent?.match(/Mobile|Android|iPhone/i);
                  const DeviceIcon = isMobile ? Smartphone : Monitor;
                  const deviceName = isMobile ? 'Dispositivo móvil' : 'Escritorio';
                  return (
                    <div key={sub.id} className="flex items-center gap-2 text-sm">
                      <DeviceIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-foreground">{deviceName}</span>
                      <span className="text-muted-foreground text-xs">
                        · {new Date(sub.created_at).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Event preferences */}
            {hasActiveSubscription && preferences && (
              <>
                <Separator />
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Recibir push para
                  </p>
                  {[
                    { key: 'mention', label: 'Menciones', desc: 'Cuando alguien te menciona en un comentario' },
                    { key: 'assignment', label: 'Asignaciones', desc: 'Cuando te asignan una tarea o reparación' },
                    { key: 'reminder', label: 'Recordatorios', desc: 'Alertas de tareas próximas a vencer' },
                    { key: 'ai_insight', label: 'Alertas del sistema', desc: 'Cambios de estado en reparaciones y transfers' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                      <Switch
                        checked={preferences.events_json?.[key as keyof typeof preferences.events_json] ?? true}
                        onCheckedChange={async (checked) => {
                          await updatePreferences({
                            events_json: {
                              ...preferences.events_json,
                              [key]: checked,
                            },
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Test button */}
            {hasActiveSubscription && (
              <>
                <Separator />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestNotification}
                  className="w-full"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Enviar notificación de prueba
                </Button>
              </>
            )}
          </>
        )}

        {/* iOS install instructions */}
        {pushStatus === 'ios_not_installed' && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              Cómo instalar en iOS:
            </p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Toca el botón <strong>Compartir</strong> (cuadrado con flecha) en Safari</li>
              <li>Desplázate y selecciona <strong>"Añadir a pantalla de inicio"</strong></li>
              <li>Confirma tocando <strong>"Añadir"</strong></li>
              <li>Abre la app desde la pantalla de inicio y activa las notificaciones</li>
            </ol>
          </div>
        )}

        {/* Denied instructions */}
        {pushStatus === 'denied' && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-2">
            <p className="text-sm font-medium text-destructive">
              Cómo desbloquear:
            </p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Haz clic en el icono de candado en la barra de direcciones</li>
              <li>Busca "Notificaciones" en los permisos del sitio</li>
              <li>Cambia de "Bloqueado" a "Permitir"</li>
              <li>Recarga la página</li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
