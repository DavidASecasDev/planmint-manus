import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Shield, 
  Globe, 
  Network, 
  Share2, 
  Download, 
  Key, 
  Webhook,
  X,
  Plus,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { useEnterprisePolicies } from '@/hooks/useEnterprisePolicies';
import { Skeleton } from '@/components/ui/skeleton';

export function EnterprisePoliciesSection() {
  const {
    policies,
    isLoading,
    updateRequireSso,
    updateAllowedDomains,
    updateIpAllowlist,
    updateBlockPublicSharing,
    updateBlockExports,
    updateBlockApiKeys,
    updateBlockWebhooks,
    isSaving,
  } = useEnterprisePolicies();

  const [newDomain, setNewDomain] = useState('');
  const [newIp, setNewIp] = useState('');

  const handleAddDomain = () => {
    if (!newDomain.trim()) return;
    const currentDomains = policies?.allowed_domains || [];
    if (!currentDomains.includes(newDomain.trim())) {
      updateAllowedDomains([...currentDomains, newDomain.trim()]);
    }
    setNewDomain('');
  };

  const handleRemoveDomain = (domain: string) => {
    const currentDomains = policies?.allowed_domains || [];
    updateAllowedDomains(currentDomains.filter(d => d !== domain));
  };

  const handleAddIp = () => {
    if (!newIp.trim()) return;
    const currentIps = policies?.ip_allowlist || [];
    if (!currentIps.includes(newIp.trim())) {
      updateIpAllowlist([...currentIps, newIp.trim()]);
    }
    setNewIp('');
  };

  const handleRemoveIp = (ip: string) => {
    const currentIps = policies?.ip_allowlist || [];
    updateIpAllowlist(currentIps.filter(i => i !== ip));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Políticas Corporativas
        </CardTitle>
        <CardDescription>
          Configura restricciones de seguridad para tu organización
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Require SSO */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Requerir SSO</Label>
            <p className="text-sm text-muted-foreground">
              Bloquear inicio de sesión con contraseña (solo SAML/OAuth)
            </p>
          </div>
          <Switch
            checked={policies?.require_sso || false}
            onCheckedChange={updateRequireSso}
            disabled={isSaving}
          />
        </div>

        {policies?.require_sso && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>
                Asegúrate de que SAML esté configurado y probado antes de activar esta opción.
                Los administradores siempre pueden acceder con contraseña.
              </span>
            </div>
          </div>
        )}

        <Separator />

        {/* Allowed Domains */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Label className="text-base">Dominios permitidos</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Solo usuarios con estos dominios de email pueden unirse
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="empresa.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
            />
            <Button onClick={handleAddDomain} disabled={isSaving}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {(policies?.allowed_domains?.length || 0) > 0 && (
            <div className="flex flex-wrap gap-2">
              {policies?.allowed_domains?.map((domain) => (
                <Badge key={domain} variant="secondary" className="gap-1">
                  {domain}
                  <button
                    onClick={() => handleRemoveDomain(domain)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* IP Allowlist */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-muted-foreground" />
            <Label className="text-base">Lista de IPs permitidas</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Restringir acceso solo a estas IPs (CIDR soportado)
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="192.168.1.0/24 o 10.0.0.1"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddIp()}
            />
            <Button onClick={handleAddIp} disabled={isSaving}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {(policies?.ip_allowlist?.length || 0) > 0 && (
            <div className="flex flex-wrap gap-2">
              {policies?.ip_allowlist?.map((ip) => (
                <Badge key={ip} variant="secondary" className="gap-1 font-mono">
                  {ip}
                  <button
                    onClick={() => handleRemoveIp(ip)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Block Options */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Restricciones de funcionalidad</h4>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label>Bloquear compartir público</Label>
                <p className="text-xs text-muted-foreground">
                  Desactivar enlaces públicos y plantillas compartidas
                </p>
              </div>
            </div>
            <Switch
              checked={policies?.block_public_sharing || false}
              onCheckedChange={updateBlockPublicSharing}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label>Bloquear exportaciones</Label>
                <p className="text-xs text-muted-foreground">
                  Desactivar CSV/PDF exports (excepto admin)
                </p>
              </div>
            </div>
            <Switch
              checked={policies?.block_exports || false}
              onCheckedChange={updateBlockExports}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label>Bloquear API Keys</Label>
                <p className="text-xs text-muted-foreground">
                  Desactivar creación de claves API
                </p>
              </div>
            </div>
            <Switch
              checked={policies?.block_api_keys || false}
              onCheckedChange={updateBlockApiKeys}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Webhook className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label>Bloquear Webhooks</Label>
                <p className="text-xs text-muted-foreground">
                  Desactivar webhooks salientes
                </p>
              </div>
            </div>
            <Switch
              checked={policies?.block_webhooks || false}
              onCheckedChange={updateBlockWebhooks}
              disabled={isSaving}
            />
          </div>
        </div>

        {isSaving && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Guardando...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
