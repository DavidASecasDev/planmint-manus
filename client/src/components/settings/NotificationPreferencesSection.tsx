import { useState } from 'react';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { useSubscription } from '@/hooks/useSubscription';
import { useIntegrationFlags } from '@/hooks/useIntegrationFlags';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Bell, Mail, MessageSquare, Send, Clock, Loader2, Lock, Smartphone, AlertTriangle, Download } from 'lucide-react';
import { CHANNEL_PERMISSIONS } from '@/types/external-notifications';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { PlanType } from '@/types/subscription';
import { useNavigate } from 'react-router-dom';

export function NotificationPreferencesSection() {
  const { preferences, loading, saving, updatePreferences } = useNotificationPreferences();
  const { hasActiveSubscription, subscribe, unsubscribe, subscribing, permission, isSupported, pushStatus, isIOSNotInstalled } = usePushSubscription();
  const { currentPlan } = useSubscription();
  const { hasSlack, hasWhatsApp } = useIntegrationFlags();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [suggestedPlan, setSuggestedPlan] = useState<PlanType>('pro');
  const navigate = useNavigate();

  const channelPermissions = CHANNEL_PERMISSIONS[currentPlan];

  const handleChannelToggle = async (channel: 'push' | 'email' | 'slack' | 'whatsapp', enabled: boolean) => {
    if (!channelPermissions[channel]) {
      setSuggestedPlan(channel === 'slack' || channel === 'whatsapp' ? 'team' : 'pro');
      setShowUpgradeModal(true);
      return;
    }

    if (channel === 'push') {
      if (enabled) {
        const success = await subscribe();
        if (!success) {
          toast.error('No se pudo activar las notificaciones push');
          return;
        }
      } else {
        await unsubscribe();
      }
    }

    const success = await updatePreferences({ [`channel_${channel}`]: enabled });
    if (success) {
      toast.success(`Notificaciones ${channel} ${enabled ? 'activadas' : 'desactivadas'}`);
    } else {
      toast.error('Error al guardar preferencias');
    }
  };

  const handleEventToggle = async (event: keyof NonNullable<typeof preferences>['events_json'], enabled: boolean) => {
    if (!preferences) return;
    const newEventsJson = { ...preferences.events_json, [event]: enabled };
    const success = await updatePreferences({ events_json: newEventsJson });
    if (success) {
      toast.success('Preferencias actualizadas');
    } else {
      toast.error('Error al guardar preferencias');
    }
  };

  const handleQuietHoursChange = async (field: 'quiet_hours_start' | 'quiet_hours_end', value: string) => {
    const success = await updatePreferences({ [field]: value });
    if (!success) {
      toast.error('Error al guardar horario silencioso');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // Build push description and disabled state
  const getPushInfo = () => {
    if (isIOSNotInstalled) {
      return {
        description: 'Debes instalar la app para recibir notificaciones',
        disabled: true,
        disabledReason: 'Instala la app primero',
      };
    }
    if (!isSupported) {
      return {
        description: 'No soportado en este navegador',
        disabled: true,
        disabledReason: 'No soportado',
      };
    }
    if (permission === 'denied') {
      return {
        description: 'Permiso denegado. Reactívalo en los ajustes de tu navegador',
        disabled: true,
        disabledReason: 'Permiso denegado',
      };
    }
    if (hasActiveSubscription) {
      return {
        description: 'Activado en este dispositivo',
        disabled: false,
      };
    }
    return {
      description: 'Notificaciones en tu dispositivo',
      disabled: false,
    };
  };

  const pushInfo = getPushInfo();

  const ChannelItem = ({ 
    icon: Icon, label, description, channel, enabled, disabled = false, disabledReason 
  }: { 
    icon: typeof Bell; label: string; description: string;
    channel: 'in_app' | 'push' | 'email' | 'slack' | 'whatsapp';
    enabled: boolean; disabled?: boolean; disabledReason?: string;
  }) => {
    const isAllowed = channelPermissions[channel];
    const isDisabled = disabled || !isAllowed || (channel === 'push' && subscribing);

    return (
      <div className={`flex items-center justify-between p-3 rounded-lg border ${isDisabled ? 'opacity-60 bg-muted/30' : 'bg-background'}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isAllowed ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
            {!isAllowed ? <Lock className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
          </div>
          <div>
            <p className="font-medium text-sm">{label}</p>
            <p className="text-xs text-muted-foreground">
              {!isAllowed ? `Disponible en plan ${channel === 'slack' || channel === 'whatsapp' ? 'Team' : 'Pro'}` : disabledReason || description}
            </p>
          </div>
        </div>
        <Switch
          checked={enabled}
          disabled={isDisabled}
          onCheckedChange={(checked) => {
            if (channel === 'in_app') {
              updatePreferences({ channel_in_app: checked });
            } else {
              handleChannelToggle(channel as 'push' | 'email' | 'slack' | 'whatsapp', checked);
            }
          }}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* iOS Install Banner */}
      {isIOSNotInstalled && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-sm">Instala PlanMint para recibir notificaciones</p>
            <p className="text-xs text-muted-foreground mt-1">
              En iPhone, las notificaciones push solo funcionan si la app está instalada desde Safari. 
              Tras instalarla, abre la app y activa las notificaciones desde aquí.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => navigate('/install')}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Ver instrucciones de instalación
            </Button>
          </div>
        </div>
      )}

      {/* Channels */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Canales de notificación</Label>
        <div className="space-y-2">
          <ChannelItem
            icon={Bell}
            label="In-app"
            description="Notificaciones dentro de la aplicación"
            channel="in_app"
            enabled={preferences?.channel_in_app ?? true}
          />
          <ChannelItem
            icon={Smartphone}
            label="Push"
            description={pushInfo.description}
            channel="push"
            enabled={preferences?.channel_push ?? false}
            disabled={pushInfo.disabled}
            disabledReason={pushInfo.disabledReason}
          />
          <ChannelItem
            icon={Mail}
            label="Email"
            description="Recibe emails para eventos importantes"
            channel="email"
            enabled={preferences?.channel_email ?? false}
          />
          <ChannelItem
            icon={MessageSquare}
            label="Slack"
            description={hasSlack ? 'Conectado' : 'Requiere configuración de admin'}
            channel="slack"
            enabled={preferences?.channel_slack ?? false}
            disabled={!hasSlack}
            disabledReason={!hasSlack ? 'No configurado' : undefined}
          />
          <ChannelItem
            icon={Send}
            label="WhatsApp"
            description={hasWhatsApp ? 'Conectado' : 'Requiere configuración de admin'}
            channel="whatsapp"
            enabled={preferences?.channel_whatsapp ?? false}
            disabled={!hasWhatsApp}
            disabledReason={!hasWhatsApp ? 'No configurado' : undefined}
          />
        </div>
      </div>

      {/* Events */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Tipos de evento</Label>
        <p className="text-sm text-muted-foreground">Elige qué eventos quieres recibir</p>
        
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-4">General</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'mention', label: '@Menciones' },
            { key: 'assignment', label: 'Asignaciones' },
            { key: 'reminder', label: 'Recordatorios' },
            { key: 'ai_insight', label: 'Alertas IA' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
              <span className="text-sm font-medium">{label}</span>
              <Switch
                checked={preferences?.events_json?.[key as keyof typeof preferences.events_json] ?? false}
                onCheckedChange={(checked) => preferences && handleEventToggle(key as keyof typeof preferences.events_json, checked)}
              />
            </div>
          ))}
        </div>

        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-4">Operaciones</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'rental_assigned', label: 'Asignación Rental' },
            { key: 'escoba_assigned', label: 'Asignación Escoba' },
            { key: 'hora_confirmada', label: 'Hora Confirmada' },
            { key: 'vehiculo_listo', label: 'Vehículo Listo' },
            { key: 'shuttle_programado', label: 'Shuttle Programado' },
            { key: 'refuerzo_necesario', label: 'Refuerzo Necesario' },
            { key: 'nueva_reserva', label: 'Nueva Reserva' },
            { key: 'reserva_cancelada', label: 'Reserva Cancelada' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
              <span className="text-sm font-medium">{label}</span>
              <Switch
                checked={preferences?.events_json?.[key as keyof typeof preferences.events_json] ?? false}
                onCheckedChange={(checked) => preferences && handleEventToggle(key as keyof typeof preferences.events_json, checked)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="space-y-3">
        <Label className="text-base font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Horas silenciosas
        </Label>
        <p className="text-sm text-muted-foreground">
          Durante estas horas no recibirás notificaciones push, email, Slack ni WhatsApp (in-app siempre activo)
        </p>
        <div className="flex items-center gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Inicio</Label>
            <Input type="time" value={preferences?.quiet_hours_start ?? '22:00'} onChange={(e) => handleQuietHoursChange('quiet_hours_start', e.target.value)} className="w-32" />
          </div>
          <span className="text-muted-foreground pt-5">→</span>
          <div className="space-y-1.5">
            <Label className="text-xs">Fin</Label>
            <Input type="time" value={preferences?.quiet_hours_end ?? '08:00'} onChange={(e) => handleQuietHoursChange('quiet_hours_end', e.target.value)} className="w-32" />
          </div>
        </div>
      </div>

      {saving && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Guardando...
        </div>
      )}

      <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} suggestedPlan={suggestedPlan} limitMessage="Esta función requiere un plan superior" />
    </div>
  );
}
