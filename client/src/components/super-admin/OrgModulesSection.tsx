import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { CarFront, Zap, BarChart3, Users, LayoutTemplate, Bell, CalendarDays, Timer, FileText, Ship } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface OrgModulesSectionProps {
  organizationId: string;
}

interface OrgModule {
  id: string;
  module_key: string;
  enabled: boolean;
  enabled_at: string | null;
  enabled_by: string | null;
}

const MODULE_META: Record<string, { label: string; description: string; icon: React.ElementType }> = {
  reservations: {
    label: 'Reservas',
    description: 'Gestión de reservas y operaciones para rent-a-car',
    icon: CarFront,
  },
  automations: {
    label: 'Automatizaciones',
    description: 'Reglas automáticas y flujos de trabajo',
    icon: Zap,
  },
  reports: {
    label: 'Reportes',
    description: 'Informes y analíticas avanzadas',
    icon: BarChart3,
  },
  teams: {
    label: 'Teams',
    description: 'Gestión de equipos y grupos',
    icon: Users,
  },
  templates: {
    label: 'Plantillas',
    description: 'Plantillas de tareas y áreas',
    icon: LayoutTemplate,
  },
  reminders: {
    label: 'Recordatorios',
    description: 'Sistema de recordatorios y notificaciones',
    icon: Bell,
  },
  calendar: {
    label: 'Calendario',
    description: 'Vista de calendario para tareas',
    icon: CalendarDays,
  },
  time_tracking: {
    label: 'Control de Tiempo',
    description: 'Temporizador y registro de horas por tarea',
    icon: Timer,
  },
  forms: {
    label: 'Formularios (legacy)',
    description: 'Formularios básicos - deprecado',
    icon: FileText,
  },
  form_builder: {
    label: 'Form Builder',
    description: 'Constructor de formularios con auto-creación de tareas',
    icon: FileText,
  },
  vehicle_status: {
    label: 'Estado Coches',
    description: 'Kanban de estado y limpieza de vehículos de la flota',
    icon: CarFront,
  },
  transfers: {
    label: 'Transfers',
    description: 'Gestión de traslados para brokers de yates',
    icon: Ship,
  },
  movements: {
    label: 'Movimientos',
    description: 'Registro de entregas, recogidas y movimientos de vehículos con trazabilidad GPS y OCR',
    icon: CarFront,
  },
};

// All optional modules that can be toggled per organization
const OPTIONAL_MODULES = ['reservations', 'automations', 'reports', 'templates', 'teams', 'time_tracking', 'forms', 'form_builder', 'vehicle_status', 'transfers', 'movements'];

export function OrgModulesSection({ organizationId }: OrgModulesSectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [togglingModule, setTogglingModule] = useState<string | null>(null);

  const { data: modules, isLoading } = useQuery({
    queryKey: ['org-modules-admin', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_modules')
        .select('*')
        .eq('organization_id', organizationId);

      if (error) throw error;
      return data as OrgModule[];
    },
    enabled: !!organizationId,
  });

  const toggleModule = useMutation({
    mutationFn: async ({ moduleKey, enabled }: { moduleKey: string; enabled: boolean }) => {
      // Check if module row exists
      const existing = modules?.find(m => m.module_key === moduleKey);

      if (existing) {
        const { error } = await supabase
          .from('organization_modules')
          .update({
            enabled,
            enabled_at: enabled ? new Date().toISOString() : null,
            enabled_by: enabled ? user?.id : null,
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('organization_modules')
          .insert({
            organization_id: organizationId,
            module_key: moduleKey,
            enabled,
            enabled_at: enabled ? new Date().toISOString() : null,
            enabled_by: enabled ? user?.id : null,
          });

        if (error) throw error;
      }

      // Log to super_admin_actions for history
      await supabase
        .from('super_admin_actions')
        .insert({
          actor_user_id: user!.id,
          action: 'module_toggle',
          entity_type: 'organization',
          entity_id: organizationId,
          reason: `Módulo ${moduleKey} ${enabled ? 'activado' : 'desactivado'}`,
          metadata_json: {
            module_key: moduleKey,
            enabled,
          },
        });

      // Clear vertical_preset when manually toggling (no longer matches preset)
      // Using type assertion since column was just added
      await supabase
        .from('organizations')
        .update({ vertical_preset: null } as any)
        .eq('id', organizationId);

      return { moduleKey, enabled };
    },
    onSuccess: (_, { enabled }) => {
      queryClient.invalidateQueries({ queryKey: ['org-modules-admin', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['module-history', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['organization-details', organizationId] });
      toast.success(`Módulo ${enabled ? 'activado' : 'desactivado'}`);
    },
    onError: (error) => {
      console.error('Error toggling module:', error);
      toast.error('Error al cambiar el estado del módulo');
    },
    onSettled: () => {
      setTogglingModule(null);
    },
  });

  const handleToggle = (moduleKey: string, newValue: boolean) => {
    setTogglingModule(moduleKey);
    toggleModule.mutate({ moduleKey, enabled: newValue });
  };

  const getModuleState = (moduleKey: string): boolean => {
    const mod = modules?.find(m => m.module_key === moduleKey);
    return mod?.enabled ?? false;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Módulos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Módulos Opcionales
        </CardTitle>
        <CardDescription>
          Activa o desactiva módulos para esta organización
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {OPTIONAL_MODULES.map((moduleKey) => {
          const meta = MODULE_META[moduleKey];
          const isEnabled = getModuleState(moduleKey);
          const Icon = meta?.icon || Zap;

          return (
            <div
              key={moduleKey}
              className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`module-${moduleKey}`} className="font-medium cursor-pointer">
                      {meta?.label || moduleKey}
                    </Label>
                    <Badge variant={isEnabled ? 'default' : 'secondary'} className="text-xs">
                      {isEnabled ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {meta?.description || 'Módulo opcional'}
                  </p>
                </div>
              </div>
              <Switch
                id={`module-${moduleKey}`}
                checked={isEnabled}
                onCheckedChange={(checked) => handleToggle(moduleKey, checked)}
                disabled={togglingModule === moduleKey}
              />
            </div>
          );
        })}

        {OPTIONAL_MODULES.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-4">
            No hay módulos opcionales configurados
          </p>
        )}
      </CardContent>
    </Card>
  );
}
