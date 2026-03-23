import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiInvoke } from '@/lib/apiClient';

export interface IntegrationFlags {
  has_rently: boolean;
  has_ai: boolean;
  has_slack: boolean;
  has_whatsapp: boolean;
  reservations_archive_days: number;
  ai_provider: string;
  ai_model: string;
}

const DEFAULT_FLAGS: IntegrationFlags = {
  has_rently: false,
  has_ai: false,
  has_slack: false,
  has_whatsapp: false,
  reservations_archive_days: 10,
  ai_provider: 'openai',
  ai_model: 'gpt-4o-mini',
};

/**
 * Hook that provides integration configuration flags without exposing sensitive credentials.
 * This allows non-owner users to check if integrations are configured while keeping API keys secure.
 * Uses SECURITY DEFINER RPC to bypass RLS on integration_settings.
 */
export function useIntegrationFlags() {
  const { profile } = useAuth();
  const [flags, setFlags] = useState<IntegrationFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    if (!profile?.organization_id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error: rpcError } = await apiInvoke<IntegrationFlags>('get-org-integration-flags', {
        body: { p_organization_id: profile.organization_id },
      });

      if (rpcError) {
        console.error('Error fetching integration flags:', rpcError);
        setError(rpcError.message);
        setFlags(DEFAULT_FLAGS);
      } else if (data && typeof data === 'object') {
        setFlags(data as IntegrationFlags);
      } else {
        setFlags(DEFAULT_FLAGS);
      }
    } catch (err) {
      console.error('Error fetching integration flags:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setFlags(DEFAULT_FLAGS);
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  return {
    loading,
    error,
    hasRently: flags?.has_rently ?? false,
    hasAI: flags?.has_ai ?? false,
    hasSlack: flags?.has_slack ?? false,
    hasWhatsApp: flags?.has_whatsapp ?? false,
    reservationsArchiveDays: flags?.reservations_archive_days ?? 10,
    aiProvider: flags?.ai_provider ?? 'openai',
    aiModel: flags?.ai_model ?? 'gpt-4o-mini',
    refetch: fetchFlags,
  };
}
