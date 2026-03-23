import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiInvoke } from '@/lib/apiClient';

export type ModuleKey = 'reservations' | 'automations' | 'reports' | 'teams' | 'templates' | 'reminders' | 'calendar' | 'time_tracking' | 'forms' | 'vehicle_status' | 'daily_tasks' | 'garatech' | 'transfers' | 'movements' | 'fleet' | 'fleet';

// Modules that can be toggled per organization (non-core)
// form_builder is now integrated into transfers module
export const OPTIONAL_MODULES: ModuleKey[] = ['reservations', 'automations', 'reports', 'templates', 'teams', 'time_tracking', 'forms', 'vehicle_status', 'daily_tasks', 'garatech', 'transfers', 'movements', 'fleet'];

// Core modules are always enabled (not in OPTIONAL_MODULES)
// reminders and calendar are core modules

export interface OrganizationModules {
  reservations: boolean;
  automations: boolean;
  reports: boolean;
  templates: boolean;
  teams: boolean;
  [key: string]: boolean;
}

// Default values for optional modules (new orgs get these defaults)
const DEFAULT_MODULES: OrganizationModules = {
  reservations: false,
  automations: true,
  reports: true,
  templates: true,
  teams: true,
  time_tracking: false,
  forms: false,
  vehicle_status: false,
  daily_tasks: true,
  garatech: false,
  transfers: false,
  movements: true,
  fleet: false,
};

export function useOrganizationModules() {
  const { profile } = useAuth();

  const { data: modules, isLoading, error, refetch } = useQuery({
    queryKey: ['organization-modules', profile?.organization_id],
    queryFn: async (): Promise<OrganizationModules> => {
      if (!profile?.organization_id) return DEFAULT_MODULES;

      // Use backend endpoint with service role key to bypass RLS
      try {
        const result = await apiInvoke<{ data: Array<{ module_key: string; enabled: boolean }>; error: string | null }>('get-org-modules', {
          body: { p_organization_id: profile.organization_id },
        });

        if (result.error || !result.data) {
          console.warn('[OrganizationModules] Error fetching:', result.error?.message);
          return DEFAULT_MODULES;
        }

        const rows = result.data.data;
        if (!rows || rows.length === 0) {
          return DEFAULT_MODULES;
        }

        // Convert array of { module_key, enabled } to record
        const modulesMap: OrganizationModules = { ...DEFAULT_MODULES };
        for (const row of rows) {
          modulesMap[row.module_key] = row.enabled;
        }

        return modulesMap;
      } catch (err) {
        console.error('[OrganizationModules] Error:', err);
        return DEFAULT_MODULES;
      }
    },
    enabled: !!profile?.organization_id,
    staleTime: 30000, // Cache for 30 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const isModuleEnabled = (moduleKey: ModuleKey): boolean => {
    // Core modules are always enabled (reminders, calendar)
    if (!OPTIONAL_MODULES.includes(moduleKey)) {
      return true;
    }
    return modules?.[moduleKey] ?? DEFAULT_MODULES[moduleKey] ?? false;
  };

  return {
    modules: modules ?? DEFAULT_MODULES,
    isLoading,
    error,
    refetch,
    isModuleEnabled,
  };
}
