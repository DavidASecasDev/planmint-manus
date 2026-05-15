import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { OrgSecuritySettings } from '@/types/enterprise';
import { toast } from 'sonner';

export function useSecuritySettings() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['security-settings', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;

      const { data, error } = await supabaseQuery
        .from('org_security_settings')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .maybeSingle();

      if (error) throw error;
      return data as OrgSecuritySettings | null;
    },
    enabled: !!profile?.organization_id,
  });

  const upsertSettings = useMutation({
    mutationFn: async (updates: Partial<OrgSecuritySettings>) => {
      if (!profile?.organization_id) throw new Error('No organization');

      if (settings?.id) {
        // Update existing
        const { error } = await supabaseQuery
          .from('org_security_settings')
          .update(updates)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabaseQuery
          .from('org_security_settings')
          .insert({
            organization_id: profile.organization_id,
            ...updates,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-settings'] });
      toast.success('Configuración guardada correctamente');
    },
    onError: () => {
      toast.error('Error al guardar la configuración');
    },
  });

  const updateAllowedDomains = (domains: string[]) => {
    upsertSettings.mutate({
      allowed_domains: domains.length > 0 ? domains : null,
    });
  };

  const toggleRequireSSO = () => {
    upsertSettings.mutate({
      require_sso: !settings?.require_sso,
    });
  };

  const updateSessionTimeout = (minutes: number) => {
    upsertSettings.mutate({
      session_timeout_minutes: minutes,
    });
  };

  const updateAuditRetention = (days: number) => {
    upsertSettings.mutate({
      audit_retention_days: days,
    });
  };

  return {
    settings,
    isLoading,
    upsertSettings: upsertSettings.mutate,
    updateAllowedDomains,
    toggleRequireSSO,
    updateSessionTimeout,
    updateAuditRetention,
    isSaving: upsertSettings.isPending,
  };
}
