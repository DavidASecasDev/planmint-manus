import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { EnterpriseStatus } from '@/types/enterprise';

export function useEnterpriseStatus() {
  const { profile } = useAuth();

  const { data: status, isLoading } = useQuery({
    queryKey: ['enterprise-status', profile?.organization_id],
    queryFn: async (): Promise<EnterpriseStatus> => {
      if (!profile?.organization_id) {
        return getDefaultStatus();
      }

      // Fetch SAML connections
      const { data: samlConnections } = await supabase
        .from('saml_connections')
        .select('*')
        .eq('organization_id', profile.organization_id);

      // Fetch SCIM tokens
      const { data: scimTokens } = await supabase
        .from('scim_tokens')
        .select('*')
        .eq('organization_id', profile.organization_id);

      // Fetch policies
      const { data: policies } = await supabase
        .from('org_security_settings')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .maybeSingle();

      const activeConnection = samlConnections?.find(c => c.is_active);
      const activeTokens = scimTokens?.filter(t => t.is_active) || [];
      const lastUsedToken = activeTokens
        .filter(t => t.last_used_at)
        .sort((a, b) => new Date(b.last_used_at!).getTime() - new Date(a.last_used_at!).getTime())[0];

      return {
        saml: {
          configured: (samlConnections?.length || 0) > 0,
          active: !!activeConnection,
          lastTested: activeConnection?.last_tested_at || null,
          connectionName: activeConnection?.name || null,
        },
        scim: {
          configured: (scimTokens?.length || 0) > 0,
          active: activeTokens.length > 0,
          lastUsed: lastUsedToken?.last_used_at || null,
          tokenCount: activeTokens.length,
        },
        policies: {
          requireSso: policies?.require_sso || false,
          allowedDomains: policies?.allowed_domains || [],
          ipAllowlist: policies?.ip_allowlist || [],
          blockPublicSharing: policies?.block_public_sharing || false,
          blockExports: policies?.block_exports || false,
          blockApiKeys: policies?.block_api_keys || false,
          blockWebhooks: policies?.block_webhooks || false,
        },
      };
    },
    enabled: !!profile?.organization_id,
  });

  return {
    status: status || getDefaultStatus(),
    isLoading,
  };
}

function getDefaultStatus(): EnterpriseStatus {
  return {
    saml: {
      configured: false,
      active: false,
      lastTested: null,
      connectionName: null,
    },
    scim: {
      configured: false,
      active: false,
      lastUsed: null,
      tokenCount: 0,
    },
    policies: {
      requireSso: false,
      allowedDomains: [],
      ipAllowlist: [],
      blockPublicSharing: false,
      blockExports: false,
      blockApiKeys: false,
      blockWebhooks: false,
    },
  };
}
