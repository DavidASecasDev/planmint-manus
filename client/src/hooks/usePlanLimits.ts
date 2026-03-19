import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEntitlements } from './useEntitlements';
import { PlanType } from '@/types/subscription';

export interface UsageStats {
  users: number;
  tasks: number;
  areas: number;
  tags: number;
}

// Interfaz de compatibilidad para componentes existentes
export interface LegacyLimits {
  maxUsers: number | null;
  maxTasks: number | null;
  maxAreas: number | null;
  maxTags: number | null;
  allowRecurringReminders: boolean;
  allowTeams: boolean;
  prioritySupport: boolean;
}

export const usePlanLimits = () => {
  const { profile } = useAuth();
  const { entitlements, isLoading: entitlementsLoading } = useEntitlements();

  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ['usage-stats', profile?.organization_id],
    queryFn: async (): Promise<UsageStats> => {
      if (!profile?.organization_id) {
        return { users: 0, tasks: 0, areas: 0, tags: 0 };
      }

      const [usersResult, tasksResult, areasResult, tagsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id),
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('is_archived', false),
        supabase
          .from('areas')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('is_archived', false),
        supabase
          .from('tags')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id),
      ]);

      return {
        users: usersResult.count || 0,
        tasks: tasksResult.count || 0,
        areas: areasResult.count || 0,
        tags: tagsResult.count || 0,
      };
    },
    enabled: !!profile?.organization_id,
  });

  // Mapear entitlements a formato legacy para compatibilidad
  const limits: LegacyLimits = {
    maxUsers: entitlements.limits.seats_total,
    maxTasks: entitlements.limits.tasks_limit,
    maxAreas: entitlements.limits.areas_limit,
    maxTags: entitlements.limits.tags_limit,
    allowRecurringReminders: entitlements.plan !== 'free',
    allowTeams: entitlements.plan !== 'free',
    prioritySupport: entitlements.plan === 'team',
  };

  const currentPlan: PlanType = entitlements.plan;

  const checkLimit = (resource: keyof UsageStats): { allowed: boolean; message: string } => {
    // Guard: si los entitlements aún están cargando, indicar estado de loading
    // El frontend debe manejar este estado especial mostrando feedback apropiado
    if (entitlementsLoading) {
      return { allowed: false, message: 'loading' };
    }
    
    if (!usage) return { allowed: true, message: '' };

    const limitMap: Record<keyof UsageStats, number | null> = {
      users: limits.maxUsers,
      tasks: limits.maxTasks,
      areas: limits.maxAreas,
      tags: limits.maxTags,
    };

    const maxValue = limitMap[resource];
    if (maxValue === null) return { allowed: true, message: '' };

    const currentValue = usage[resource];
    if (currentValue >= maxValue) {
      const resourceNames: Record<keyof UsageStats, string> = {
        users: 'usuarios',
        tasks: 'tareas',
        areas: 'áreas',
        tags: 'etiquetas',
      };
      return {
        allowed: false,
        message: `Has alcanzado el límite de ${maxValue} ${resourceNames[resource]} del plan ${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}.`,
      };
    }

    return { allowed: true, message: '' };
  };

  const canCreateUser = () => checkLimit('users');
  const canCreateTask = () => checkLimit('tasks');
  const canCreateArea = () => checkLimit('areas');
  const canCreateTag = () => checkLimit('tags');

  const canUseRecurringReminders = () => {
    if (limits.allowRecurringReminders) return { allowed: true, message: '' };
    return {
      allowed: false,
      message: 'Los recordatorios recurrentes están disponibles en el plan Pro.',
    };
  };

  return {
    usage: usage || { users: 0, tasks: 0, areas: 0, tags: 0 },
    limits,
    currentPlan,
    isLoading: entitlementsLoading || usageLoading,
    checkLimit,
    canCreateUser,
    canCreateTask,
    canCreateArea,
    canCreateTag,
    canUseRecurringReminders,
  };
};
