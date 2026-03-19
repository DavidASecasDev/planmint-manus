import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Monitor, 
  Smartphone, 
  Laptop, 
  LogOut, 
  Loader2,
  Globe,
  Clock
} from 'lucide-react';
import { useUserSessions } from '@/hooks/useUserSessions';
import { useSubscription } from '@/hooks/useSubscription';
import { UserSession } from '@/types/enterprise';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { EmptyState } from '@/components/ui/empty-state';
import { useState } from 'react';

function getDeviceIcon(deviceName: string | null) {
  if (!deviceName) return Monitor;
  const name = deviceName.toLowerCase();
  if (name.includes('android') || name.includes('ios') || name.includes('móvil')) {
    return Smartphone;
  }
  if (name.includes('mac') || name.includes('windows') || name.includes('linux')) {
    return Laptop;
  }
  return Monitor;
}

export function SessionsSection() {
  const { sessions, isLoading, revokeSession, revokeAllSessions, isRevoking, isRevokingAll } = useUserSessions();
  const { isTeamPlan } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  if (!isTeamPlan) {
    return (
      <Card>
        <CardContent className="py-12">
          <EmptyState
            icon={Monitor}
            title="Gestión de sesiones"
            description="Actualiza a Team para ver y gestionar tus sesiones activas"
            action={{
              label: 'Actualizar a Team',
              onClick: () => setShowUpgradeModal(true),
            }}
          />
          <UpgradeModal
            open={showUpgradeModal}
            onOpenChange={setShowUpgradeModal}
            limitMessage="Actualiza a Team para gestionar sesiones"
            suggestedPlan="team"
          />
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Sort sessions - most recent first, current session at top
  const sortedSessions = [...sessions].sort((a, b) => {
    return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
  });

  // Assume first session is current (most recently seen)
  const currentSessionId = sortedSessions[0]?.id;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary" />
              <CardTitle>Sesiones activas</CardTitle>
            </div>
            {sessions.length > 1 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => revokeAllSessions(currentSessionId)}
                disabled={isRevokingAll}
              >
                {isRevokingAll ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4 mr-2" />
                )}
                Cerrar otras sesiones
              </Button>
            )}
          </div>
          <CardDescription>
            Dispositivos donde has iniciado sesión
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <EmptyState
              icon={Globe}
              title="Sin sesiones activas"
              description="No tienes sesiones registradas"
            />
          ) : (
            <div className="space-y-3">
              {sortedSessions.map((session) => {
                const DeviceIcon = getDeviceIcon(session.device_name);
                const isCurrentSession = session.id === currentSessionId;

                return (
                  <div
                    key={session.id}
                    className={`flex items-center gap-4 p-4 border rounded-lg ${
                      isCurrentSession ? 'bg-primary/5 border-primary/20' : ''
                    }`}
                  >
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <DeviceIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {session.device_name || 'Dispositivo desconocido'}
                        </span>
                        {isCurrentSession && (
                          <Badge variant="default" className="text-xs">
                            Sesión actual
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        {session.ip_address && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {session.ip_address}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Última actividad:{' '}
                          {formatDistanceToNow(new Date(session.last_seen_at), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                      </div>
                    </div>

                    {!isCurrentSession && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeSession(session.id)}
                        disabled={isRevoking}
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Cerrar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security tip */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Consejo de seguridad:</strong>{' '}
            Si ves una sesión que no reconoces, ciérrala inmediatamente y cambia tu contraseña.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
