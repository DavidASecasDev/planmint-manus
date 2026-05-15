import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { OrgSecuritySettings } from '@/types/enterprise';
import { toast } from 'sonner';

export function useEnterprisePolicies() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: policies, isLoading } = useQuery({
    queryKey: ['enterprise-policies', profile?.organization_id],
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

  const updatePolicies = useMutation({
    mutationFn: async (updates: Partial<OrgSecuritySettings>) => {
      if (!profile?.organization_id) throw new Error('No organization');

      if (policies?.id) {
        const { error } = await supabaseQuery
          .from('org_security_settings')
          .update(updates)
          .eq('id', policies.id);

        if (error) throw error;
      } else {
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
      queryClient.invalidateQueries({ queryKey: ['enterprise-policies'] });
      queryClient.invalidateQueries({ queryKey: ['security-settings'] });
      toast.success('Políticas actualizadas');
    },
    onError: () => {
      toast.error('Error al actualizar las políticas');
    },
  });

  // Specific update functions
  const updateRequireSso = (value: boolean) => {
    updatePolicies.mutate({ require_sso: value });
  };

  const updateAllowedDomains = (domains: string[]) => {
    updatePolicies.mutate({ allowed_domains: domains.length > 0 ? domains : null });
  };

  const updateIpAllowlist = (ips: string[]) => {
    updatePolicies.mutate({ ip_allowlist: ips.length > 0 ? ips : null });
  };

  const updateBlockPublicSharing = (value: boolean) => {
    updatePolicies.mutate({ block_public_sharing: value });
  };

  const updateBlockExports = (value: boolean) => {
    updatePolicies.mutate({ block_exports: value });
  };

  const updateBlockApiKeys = (value: boolean) => {
    updatePolicies.mutate({ block_api_keys: value });
  };

  const updateBlockWebhooks = (value: boolean) => {
    updatePolicies.mutate({ block_webhooks: value });
  };

  return {
    policies,
    isLoading,
    updatePolicies: updatePolicies.mutate,
    updateRequireSso,
    updateAllowedDomains,
    updateIpAllowlist,
    updateBlockPublicSharing,
    updateBlockExports,
    updateBlockApiKeys,
    updateBlockWebhooks,
    isSaving: updatePolicies.isPending,
  };
}
