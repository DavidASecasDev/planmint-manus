import { useIntegrationSettings } from './useIntegrationSettings';
import { useIntegrationFlags } from './useIntegrationFlags';
import { AIFeatureAccess } from '@/types/ai';

/**
 * Hook that determines AI feature access based on whether the organization
 * has configured their own AI API key. This replaces the old plan-based and
 * feature flag logic with a simpler model: if API key is configured, AI is available.
 * 
 * Uses useIntegrationSettings for owners (who can see credentials) and falls back
 * to useIntegrationFlags (SECURITY DEFINER RPC) for other users.
 */
export function useAIFeatures(): AIFeatureAccess & { 
  isLoading: boolean;
  hasAPIKey: boolean;
  provider: string;
  model: string;
} {
  // Owner can see actual settings
  const { settings, loading: settingsLoading } = useIntegrationSettings();
  // All authenticated users can see flags (via SECURITY DEFINER RPC)
  const { hasAI, aiProvider, aiModel, loading: flagsLoading } = useIntegrationFlags();

  // Owner uses settings directly, others use flags
  const hasAPIKey = settings 
    ? !!settings.openai_api_key 
    : hasAI;

  const provider = settings?.ai_provider || aiProvider;
  const model = settings?.ai_model || aiModel;

  return {
    taskSummary: hasAPIKey,
    weeklyDigest: hasAPIKey,
    insights: hasAPIKey,
    aiAlerts: hasAPIKey,
    isLoading: settingsLoading || flagsLoading,
    hasAPIKey,
    provider,
    model,
  };
}
