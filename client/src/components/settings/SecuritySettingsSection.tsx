import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Shield, Globe, Clock, Trash2, Plus, AlertTriangle, Loader2 } from 'lucide-react';
import { useSecuritySettings } from '@/hooks/useSecuritySettings';
import { useSubscription } from '@/hooks/useSubscription';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';

export function SecuritySettingsSection() {
  const { settings, isLoading, upsertSettings, isSaving } = useSecuritySettings();
  const { currentPlan, isTeamPlan } = useSubscription();
  
  const [newDomain, setNewDomain] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const allowedDomains = settings?.allowed_domains || [];

  const handleAddDomain = () => {
    if (!newDomain.trim()) return;
    
    if (!isTeamPlan) {
      setShowUpgradeModal(true);
      return;
    }

    const domain = newDomain.trim().toLowerCase();
    if (!allowedDomains.includes(domain)) {
      upsertSettings({
        allowed_domains: [...allowedDomains, domain],
      });
    }
    setNewDomain('');
  };

  const handleRemoveDomain = (domain: string) => {
    upsertSettings({
      allowed_domains: allowedDomains.filter((d) => d !== domain),
    });
  };

  const handleToggleSSO = () => {
    if (!isTeamPlan) {
      setShowUpgradeModal(true);
      return;
    }
    upsertSettings({
      require_sso: !settings?.require_sso,
    });
  };

  const handleSessionTimeout = (value: string) => {
    upsertSettings({
      session_timeout_minutes: parseInt(value, 10),
    });
  };

  const handleRetentionDays = (value: string) => {
    upsertSettings({
      audit_retention_days: parseInt(value, 10),
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* SSO Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle>Single Sign-On (SSO)</CardTitle>
            {!isTeamPlan && <Badge variant="secondary">Team</Badge>}
          </div>
          <CardDescription>
            Configura el inicio de sesión único para tu organización
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Requerir SSO</Label>
              <p className="text-sm text-muted-foreground">
                Los usuarios solo pueden iniciar sesión con Google o Microsoft
              </p>
            </div>
            <Switch
              checked={settings?.require_sso || false}
              onCheckedChange={handleToggleSSO}
              disabled={!isTeamPlan || isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label>Dominios permitidos</Label>
            <p className="text-sm text-muted-foreground">
              Solo usuarios con estos dominios de email pueden acceder
            </p>
            
            <div className="flex gap-2">
              <Input
                placeholder="empresa.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                disabled={!isTeamPlan}
              />
              <Button
                onClick={handleAddDomain}
                disabled={!isTeamPlan || !newDomain.trim() || isSaving}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {allowedDomains.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {allowedDomains.map((domain) => (
                  <Badge key={domain} variant="secondary" className="gap-1">
                    {domain}
                    <button
                      onClick={() => handleRemoveDomain(domain)}
                      className="ml-1 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Session Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle>Sesiones</CardTitle>
          </div>
          <CardDescription>
            Configura el tiempo de expiración de las sesiones
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tiempo de sesión</Label>
            <Select
              value={String(settings?.session_timeout_minutes || 43200)}
              onValueChange={handleSessionTimeout}
              disabled={isSaving}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1440">1 día</SelectItem>
                <SelectItem value="10080">7 días</SelectItem>
                <SelectItem value="21600">15 días</SelectItem>
                <SelectItem value="43200">30 días</SelectItem>
                <SelectItem value="86400">60 días</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Retention */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Retención de auditoría</CardTitle>
          </div>
          <CardDescription>
            Tiempo que se conservan los registros de auditoría
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Días de retención</Label>
            <Select
              value={String(settings?.audit_retention_days || 90)}
              onValueChange={handleRetentionDays}
              disabled={isSaving}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7" disabled={!isTeamPlan && currentPlan !== 'pro'}>
                  7 días {currentPlan === 'free' && '(Pro)'}
                </SelectItem>
                <SelectItem value="30" disabled={!isTeamPlan}>
                  30 días {!isTeamPlan && '(Team)'}
                </SelectItem>
                <SelectItem value="90" disabled={!isTeamPlan}>
                  90 días {!isTeamPlan && '(Team)'}
                </SelectItem>
                <SelectItem value="180" disabled={!isTeamPlan}>
                  180 días {!isTeamPlan && '(Team)'}
                </SelectItem>
                <SelectItem value="365" disabled={!isTeamPlan}>
                  365 días {!isTeamPlan && '(Team)'}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Los registros más antiguos se eliminan automáticamente
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Warning for SSO */}
      {settings?.require_sso && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-400">
                SSO obligatorio activado
              </p>
              <p className="text-sm text-muted-foreground">
                Los usuarios solo podrán iniciar sesión con Google o Microsoft.
                Asegúrate de tener al menos un administrador con acceso SSO.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        limitMessage="Actualiza a Team para configurar SSO y dominios permitidos"
        suggestedPlan="team"
      />
    </div>
  );
}
