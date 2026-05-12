/**
 * usePlanLimits — NEUTRALIZED (internal app, no billing limits)
 * Always returns unlimited access. No plan restrictions.
 */
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
  const limits: LegacyLimits = {
    maxUsers: null,
    maxTasks: null,
    maxAreas: null,
    maxTags: null,
    allowRecurringReminders: true,
    allowTeams: true,
    prioritySupport: true,
  };

  const currentPlan: PlanType = 'team';

  const checkLimit = (_resource: keyof UsageStats) => ({ allowed: true, message: '' });
  const canCreateUser = () => ({ allowed: true, message: '' });
  const canCreateTask = () => ({ allowed: true, message: '' });
  const canCreateArea = () => ({ allowed: true, message: '' });
  const canCreateTag = () => ({ allowed: true, message: '' });
  const canUseRecurringReminders = () => ({ allowed: true, message: '' });

  return {
    usage: { users: 0, tasks: 0, areas: 0, tags: 0 },
    limits,
    currentPlan,
    isLoading: false,
    checkLimit,
    canCreateUser,
    canCreateTask,
    canCreateArea,
    canCreateTag,
    canUseRecurringReminders,
  };
};
