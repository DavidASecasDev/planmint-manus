import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Shield, 
  Key, 
  Users, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw
} from 'lucide-react';
import { useEnterpriseStatus } from '@/hooks/useEnterpriseStatus';
import { useSubscription } from '@/hooks/useSubscription';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

export function EnterpriseStatusSection() {
  const { status, isLoading } = useEnterpriseStatus();
  const { subscription } = useSubscription();

  const isTeamPlan = subscription?.plan === 'team';

  if (!isTeamPlan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Enterprise Features
          </CardTitle>
          <CardDescription>
            Las funciones Enterprise están disponibles en el plan Team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline">Actualizar a Team</Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {/* SAML Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                SAML SSO
              </span>
              <Badge variant={status.saml.active ? 'default' : 'secondary'}>
                {status.saml.active ? 'Activo' : 'Inactivo'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              {status.saml.configured ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              <span>{status.saml.configured ? 'Configurado' : 'No configurado'}</span>
            </div>
            {status.saml.connectionName && (
              <div className="text-sm text-muted-foreground">
                Conexión: {status.saml.connectionName}
              </div>
            )}
            {status.saml.lastTested && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Probado {formatDistanceToNow(new Date(status.saml.lastTested), { 
                  addSuffix: true, 
                  locale: es 
                })}
              </div>
            )}
            {!status.saml.lastTested && status.saml.configured && (
              <div className="flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                No probado aún
              </div>
            )}
          </CardContent>
        </Card>

        {/* SCIM Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                SCIM Provisioning
              </span>
              <Badge variant={status.scim.active ? 'default' : 'secondary'}>
                {status.scim.active ? 'Activo' : 'Inactivo'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              {status.scim.configured ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              <span>
                {status.scim.tokenCount > 0 
                  ? `${status.scim.tokenCount} token${status.scim.tokenCount > 1 ? 's' : ''} activo${status.scim.tokenCount > 1 ? 's' : ''}`
                  : 'Sin tokens activos'}
              </span>
            </div>
            {status.scim.lastUsed ? (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <RefreshCw className="h-3 w-3" />
                Último uso {formatDistanceToNow(new Date(status.scim.lastUsed), { 
                  addSuffix: true, 
                  locale: es 
                })}
              </div>
            ) : status.scim.configured ? (
              <div className="flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                Token no usado en 30+ días
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Policies Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Políticas
              </span>
              <Badge variant={status.policies.requireSso ? 'default' : 'outline'}>
                {status.policies.requireSso ? 'SSO requerido' : 'Flexible'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <PolicyItem 
              label="Dominios permitidos" 
              active={status.policies.allowedDomains.length > 0}
              count={status.policies.allowedDomains.length}
            />
            <PolicyItem 
              label="IP Allowlist" 
              active={status.policies.ipAllowlist.length > 0}
              count={status.policies.ipAllowlist.length}
            />
            <PolicyItem 
              label="Bloquear compartir público" 
              active={status.policies.blockPublicSharing}
            />
            <PolicyItem 
              label="Bloquear exportaciones" 
              active={status.policies.blockExports}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PolicyItem({ 
  label, 
  active, 
  count 
}: { 
  label: string; 
  active: boolean; 
  count?: number;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      {active ? (
        <span className="flex items-center gap-1 text-green-600">
          <CheckCircle className="h-3 w-3" />
          {count !== undefined ? count : 'Sí'}
        </span>
      ) : (
        <span className="text-muted-foreground">No</span>
      )}
    </div>
  );
}
