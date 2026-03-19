import { useState } from 'react';
import { SuperAdminLayout } from './SuperAdminLayout';
import { useSuperAdminFeatureFlags } from '@/hooks/useSuperAdminFeatureFlags';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
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
  ChevronDown,
  ChevronUp,
  Flag,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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

const PLAN_OPTIONS = [
  { value: 'all', label: 'Todos los planes' },
  { value: 'free', label: 'Free' },
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

export default function FeatureFlags() {
  const { globalFlags, isLoading, toggleGlobalFlag, updateFlag } = useSuperAdminFeatureFlags();
  const [expandedFlag, setExpandedFlag] = useState<string | null>(null);

  const handleToggle = (flag: FeatureFlag) => {
    toggleGlobalFlag.mutate({ flagId: flag.id, enabled: !flag.enabled });
  };

  const handleUpdatePlan = (flagId: string, plan: string) => {
    updateFlag.mutate({ 
      flagId, 
      updates: { plan: plan === 'all' ? null : plan } 
    });
  };

  const handleUpdateRollout = (flagId: string, percentage: number) => {
    updateFlag.mutate({ 
      flagId, 
      updates: { rollout_percentage: percentage } 
    });
  };

  return (
    <SuperAdminLayout title="Feature Flags">
      <div className="space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Flag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Gestión de Feature Flags</CardTitle>
                <CardDescription>
                  Controla las capacidades disponibles globalmente o por plan/rollout
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Flags Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {globalFlags.map((flag) => {
              const Icon = ICON_MAP[flag.key] || Settings;
              const isExpanded = expandedFlag === flag.id;

              return (
                <Card key={flag.id} className="overflow-hidden">
                  <Collapsible open={isExpanded} onOpenChange={() => setExpandedFlag(isExpanded ? null : flag.id)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${flag.enabled ? 'bg-primary/10' : 'bg-muted'}`}>
                            <Icon className={`h-5 w-5 ${flag.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-base">{flag.name}</CardTitle>
                              {flag.plan && (
                                <Badge variant="outline" className="text-xs">
                                  {flag.plan}
                                </Badge>
                              )}
                              {flag.rollout_percentage < 100 && (
                                <Badge variant="secondary" className="text-xs">
                                  {flag.rollout_percentage}%
                                </Badge>
                              )}
                            </div>
                            <CardDescription className="text-xs">
                              {flag.description}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={flag.enabled}
                            onCheckedChange={() => handleToggle(flag)}
                            disabled={toggleGlobalFlag.isPending}
                          />
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>
                    </CardHeader>

                    <CollapsibleContent>
                      <CardContent className="pt-0 border-t">
                        <div className="pt-4 space-y-4">
                          {/* Plan Restriction */}
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">
                              Restricción por plan
                            </Label>
                            <Select
                              value={flag.plan || 'all'}
                              onValueChange={(value) => handleUpdatePlan(flag.id, value)}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PLAN_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Rollout Percentage */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-muted-foreground">
                                Rollout gradual
                              </Label>
                              <span className="text-sm font-medium">
                                {flag.rollout_percentage}%
                              </span>
                            </div>
                            <Slider
                              value={[flag.rollout_percentage]}
                              onValueCommit={(value) => handleUpdateRollout(flag.id, value[0])}
                              max={100}
                              step={5}
                              className="py-2"
                            />
                            <p className="text-xs text-muted-foreground">
                              {flag.rollout_percentage === 100 
                                ? 'Disponible para todas las organizaciones'
                                : `Solo el ${flag.rollout_percentage}% de las organizaciones tendrán acceso`
                              }
                            </p>
                          </div>

                          {/* Key for reference */}
                          <div className="pt-2 border-t">
                            <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                              {flag.key}
                            </code>
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
