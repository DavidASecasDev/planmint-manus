import { useState } from 'react';
import { useSuperAdminFeatureFlags } from '@/hooks/useSuperAdminFeatureFlags';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Brain, 
  FileDown, 
  Code, 
  Shield, 
  Users, 
  Webhook, 
  Palette, 
  Headphones,
  Settings,
  Plus,
  X,
  Flag,
} from 'lucide-react';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FeatureFlag } from '@/types/featureFlags';

const ICON_MAP: Record<string, React.ElementType> = {
  ai_assistant: Brain,
  advanced_exports: FileDown,
  api_access: Code,
  sso_saml: Shield,
  scim_provisioning: Users,
  webhooks: Webhook,
  custom_branding: Palette,
  priority_support: Headphones,
};

interface OrgFeatureFlagsProps {
  organizationId: string;
  organizationName: string;
}

export function OrgFeatureFlagsSection({ organizationId, organizationName }: OrgFeatureFlagsProps) {
  const { 
    globalFlags, 
    useOrgFeatureFlags, 
    createOrgOverride, 
    deleteOrgOverride,
    toggleGlobalFlag,
  } = useSuperAdminFeatureFlags();
  
  const { data: orgFlags = [], isLoading } = useOrgFeatureFlags(organizationId);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedFlagKey, setSelectedFlagKey] = useState<string>('');

  // Get flags that can be added as overrides (not already overridden)
  const availableForOverride = globalFlags.filter(
    gf => !orgFlags.some(of => of.key === gf.key)
  );

  const handleAddOverride = () => {
    const globalFlag = globalFlags.find(f => f.key === selectedFlagKey);
    if (!globalFlag) return;

    createOrgOverride.mutate({
      organizationId,
      key: globalFlag.key,
      name: globalFlag.name,
      description: globalFlag.description,
      enabled: true, // Enable by default when adding override
    });
    setShowAddDialog(false);
    setSelectedFlagKey('');
  };

  const handleRemoveOverride = (flag: FeatureFlag) => {
    deleteOrgOverride.mutate({ 
      flagId: flag.id, 
      organizationId 
    });
  };

  const handleToggleOverride = (flag: FeatureFlag) => {
    // For org-specific flags, we need to update directly
    toggleGlobalFlag.mutate({ 
      flagId: flag.id, 
      enabled: !flag.enabled 
    });
  };

  // Merge global and org flags for display
  const mergedFlags = globalFlags.map(globalFlag => {
    const orgOverride = orgFlags.find(of => of.key === globalFlag.key);
    return {
      ...globalFlag,
      override: orgOverride,
      effectiveEnabled: orgOverride ? orgOverride.enabled : globalFlag.enabled,
    };
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Feature Flags
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Flag className="h-5 w-5" />
              Feature Flags
            </CardTitle>
            <CardDescription>
              Overrides específicos para {organizationName}
            </CardDescription>
          </div>
          
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={availableForOverride.length === 0}>
                <Plus className="h-4 w-4 mr-1" />
                Añadir Override
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Añadir Override de Feature Flag</DialogTitle>
                <DialogDescription>
                  Selecciona un feature flag para habilitar específicamente para esta organización
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-4">
                <Label>Feature Flag</Label>
                <Select value={selectedFlagKey} onValueChange={setSelectedFlagKey}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Seleccionar flag..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableForOverride.map((flag) => {
                      const Icon = ICON_MAP[flag.key] || Settings;
                      return (
                        <SelectItem key={flag.key} value={flag.key}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {flag.name}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleAddOverride} 
                  disabled={!selectedFlagKey || createOrgOverride.isPending}
                >
                  Añadir Override
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {mergedFlags.map((flag) => {
            const Icon = ICON_MAP[flag.key] || Settings;
            const hasOverride = !!flag.override;

            return (
              <div 
                key={flag.key}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  hasOverride ? 'border-primary/30 bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded ${flag.effectiveEnabled ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Icon className={`h-4 w-4 ${flag.effectiveEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{flag.name}</span>
                      {hasOverride && (
                        <Badge variant="outline" className="text-xs">
                          Override
                        </Badge>
                      )}
                      {!hasOverride && !flag.enabled && (
                        <Badge variant="secondary" className="text-xs">
                          Global: Off
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{flag.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {hasOverride ? (
                    <>
                      <Switch
                        checked={flag.override!.enabled}
                        onCheckedChange={() => handleToggleOverride(flag.override!)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveOverride(flag.override!)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Badge variant={flag.enabled ? "default" : "secondary"} className="text-xs">
                      {flag.enabled ? 'Habilitado' : 'Deshabilitado'}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {orgFlags.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay overrides configurados. Esta organización usa la configuración global.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
