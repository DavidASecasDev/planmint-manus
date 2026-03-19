import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Users, Building2, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { ApplyPresetDialog } from './ApplyPresetDialog';
import { 
  VERTICAL_PRESETS, 
  VerticalPresetKey,
  MODULE_DISPLAY_NAMES,
} from '@/lib/verticalPresets';

interface OrgPresetSectionProps {
  organizationId: string;
  organizationName: string;
  currentModules: Record<string, boolean>;
}

const PRESET_ICONS: Record<VerticalPresetKey, React.ElementType> = {
  internal_teams: Users,
  agencies: Building2,
  operations: BarChart3,
};

export function OrgPresetSection({ 
  organizationId, 
  organizationName,
  currentModules 
}: OrgPresetSectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const applyPreset = useMutation({
    mutationFn: async ({ presetKey, reason }: { presetKey: VerticalPresetKey; reason: string }) => {
      const preset = VERTICAL_PRESETS[presetKey];
      const modulesToActivate: string[] = [];

      // Find modules that need to be activated
      for (const [moduleKey, shouldBeEnabled] of Object.entries(preset.modules)) {
        if (shouldBeEnabled && !currentModules[moduleKey]) {
          modulesToActivate.push(moduleKey);
        }
      }

      if (modulesToActivate.length === 0) {
        throw new Error('No hay módulos para activar');
      }

      // Activate each module
      for (const moduleKey of modulesToActivate) {
        const { error } = await supabase
          .from('organization_modules')
          .upsert({
            organization_id: organizationId,
            module_key: moduleKey,
            enabled: true,
            enabled_at: new Date().toISOString(),
            enabled_by: user?.id,
          }, {
            onConflict: 'organization_id,module_key',
          });

        if (error) throw error;
      }

      // Update organization with vertical_preset using raw update
      // Using type assertion since column was just added
      await supabase
        .from('organizations')
        .update({ vertical_preset: presetKey } as any)
        .eq('id', organizationId)
        .then(({ error: orgError }) => {
          if (orgError) {
            console.error('Error updating vertical preset:', orgError);
          }
        });

      // Log to super_admin_actions
      const { error: auditError } = await supabase
        .from('super_admin_actions')
        .insert({
          actor_user_id: user!.id,
          action: 'preset_apply',
          entity_type: 'organization',
          entity_id: organizationId,
          reason,
          metadata_json: {
            preset_key: presetKey,
            preset_name: preset.name,
            modules_activated: modulesToActivate,
          },
        });

      if (auditError) {
        console.error('Error logging audit:', auditError);
      }

      return { modulesToActivate, presetKey };
    },
    onSuccess: ({ modulesToActivate, presetKey }) => {
      queryClient.invalidateQueries({ queryKey: ['org-modules-admin', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['organization-modules'] });
      queryClient.invalidateQueries({ queryKey: ['organization-details', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['module-history', organizationId] });
      
      const moduleNames = modulesToActivate.map(m => MODULE_DISPLAY_NAMES[m] || m).join(', ');
      toast.success(
        `Preset "${VERTICAL_PRESETS[presetKey].name}" aplicado. Módulos activados: ${moduleNames}`
      );
      setDialogOpen(false);
    },
    onError: (error) => {
      console.error('Error applying preset:', error);
      toast.error('Error al aplicar el preset');
    },
  });

  const handleApplyPreset = (presetKey: VerticalPresetKey, reason: string) => {
    applyPreset.mutate({ presetKey, reason });
  };

  // Determine which preset best matches current state (if any)
  const matchingPreset = Object.values(VERTICAL_PRESETS).find(preset => {
    const presetModules = Object.entries(preset.modules).filter(([_, enabled]) => enabled);
    return presetModules.every(([key]) => currentModules[key]);
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Preset de Vertical
          </CardTitle>
          <CardDescription>
            Aplica una configuración predefinida de módulos según el tipo de negocio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              {matchingPreset ? (
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = PRESET_ICONS[matchingPreset.key];
                    return <Icon className="h-5 w-5 text-primary" />;
                  })()}
                  <span className="font-medium">{matchingPreset.name}</span>
                  <Badge variant="secondary">Activo</Badge>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-muted-foreground">Personalizado</span>
                  <Badge variant="outline">Sin preset</Badge>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {matchingPreset 
                  ? matchingPreset.description 
                  : 'Los módulos tienen una configuración personalizada'}
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              Aplicar preset
            </Button>
          </div>
        </CardContent>
      </Card>

      <ApplyPresetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        organizationName={organizationName}
        currentModules={currentModules}
        onConfirm={handleApplyPreset}
        isLoading={applyPreset.isPending}
      />
    </>
  );
}
