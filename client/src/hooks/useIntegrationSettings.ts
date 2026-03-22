import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { apiInvoke } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { IntegrationSettings, AIProvider } from '@/types/external-notifications';

export function useIntegrationSettings() {
  const { profile } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const [settings, setSettings] = useState<IntegrationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Only owner can manage integration settings (API keys are highly sensitive)
  const isOwner = hasPermission('integrations.manage_api_keys');

  const fetchSettings = useCallback(async () => {
    // Wait for permissions to load before deciding
    if (permissionsLoading) {
      return; // Don't set loading to false yet
    }
    
    if (!profile?.organization_id || !isOwner) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('integration_settings')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .maybeSingle();

      if (error) throw error;
      // Cast the ai_provider to the correct type
      if (data) {
        const mapped: IntegrationSettings = {
          id: data.id,
          organization_id: data.organization_id,
          created_at: data.created_at,
          slack_webhook_url: data.slack_webhook_url ?? undefined,
          email_from_name: data.email_from_name ?? undefined,
          email_from_address: data.email_from_address ?? undefined,
          whatsapp_phone_number_id: data.whatsapp_phone_number_id ?? undefined,
          whatsapp_access_token: data.whatsapp_access_token ?? undefined,
          whatsapp_business_account_id: data.whatsapp_business_account_id ?? undefined,
          openai_api_key: data.openai_api_key ?? undefined,
          ai_provider: (data.ai_provider as AIProvider) ?? undefined,
          ai_model: data.ai_model ?? undefined,
          ai_base_url: data.ai_base_url ?? undefined,
          rently_api_host: data.rently_api_host ?? undefined,
          rently_client_id: data.rently_client_id ?? undefined,
          rently_client_secret: data.rently_client_secret ?? undefined,
          reservations_archive_days: data.reservations_archive_days ?? undefined,
        };
        setSettings(mapped);
      } else {
        setSettings(null);
      }
    } catch (error) {
      console.error('Error fetching integration settings:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id, isOwner, permissionsLoading]);

  const updateSettings = useCallback(async (
    updates: Partial<Omit<IntegrationSettings, 'id' | 'organization_id' | 'created_at'>>
  ): Promise<boolean> => {
    if (!profile?.organization_id || !isOwner) return false;

    setSaving(true);
    try {
      if (settings) {
        // Update existing
        const { error } = await supabase
          .from('integration_settings')
          .update(updates)
          .eq('id', settings.id);

        if (error) throw error;
        setSettings(prev => prev ? { ...prev, ...updates } : null);
      } else {
        // Create new
        const { data, error } = await supabase
          .from('integration_settings')
          .insert({
            organization_id: profile.organization_id,
            ...updates,
          })
          .select()
          .single();

        if (error) throw error;
        const mapped: IntegrationSettings = {
          id: data.id,
          organization_id: data.organization_id,
          created_at: data.created_at,
          slack_webhook_url: data.slack_webhook_url ?? undefined,
          email_from_name: data.email_from_name ?? undefined,
          email_from_address: data.email_from_address ?? undefined,
          whatsapp_phone_number_id: data.whatsapp_phone_number_id ?? undefined,
          whatsapp_access_token: data.whatsapp_access_token ?? undefined,
          whatsapp_business_account_id: data.whatsapp_business_account_id ?? undefined,
          openai_api_key: data.openai_api_key ?? undefined,
          ai_provider: (data.ai_provider as AIProvider) ?? undefined,
          ai_model: data.ai_model ?? undefined,
          ai_base_url: data.ai_base_url ?? undefined,
          rently_api_host: data.rently_api_host ?? undefined,
          rently_client_id: data.rently_client_id ?? undefined,
          rently_client_secret: data.rently_client_secret ?? undefined,
          reservations_archive_days: data.reservations_archive_days ?? undefined,
        };
        setSettings(mapped);
      }
      return true;
    } catch (error) {
      console.error('Error updating integration settings:', error);
      return false;
    } finally {
      setSaving(false);
    }
  }, [profile?.organization_id, isOwner, settings]);

  const testSlackWebhook = useCallback(async (): Promise<boolean> => {
    if (!settings?.slack_webhook_url) return false;

    try {
      const response = await fetch(settings.slack_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '✅ Conexión de prueba desde PlanMint',
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Error testing Slack webhook:', error);
      return false;
    }
  }, [settings?.slack_webhook_url]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const testAIConnection = async (): Promise<{ success: boolean; error?: string }> => {
    if (!settings?.openai_api_key) {
      return { success: false, error: 'No hay API key configurada' };
    }

    try {
      const { data, error } = await apiInvoke<{ success?: boolean; error?: string }>('ai-assistant', {
        body: { type: 'connection_test' },
      });

      if (error) {
        return { success: false, error: error.message };
      }
      
      if (data?.error) {
        return { success: false, error: data.error };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Error desconocido' };
    }
  };

  // Mask API key for display (show only last 4 characters)
  const maskedAPIKey = settings?.openai_api_key
    ? `••••••••${settings.openai_api_key.slice(-4)}`
    : null;

  return {
    settings,
    loading: loading || permissionsLoading,
    saving,
    isAdmin: isOwner, // Renamed internally but kept API consistent
    updateSettings,
    testSlackWebhook,
    testAIConnection,
    refetch: fetchSettings,
    hasSlack: !!settings?.slack_webhook_url,
    hasEmail: !!settings?.email_from_address,
    hasWhatsApp: !!settings?.whatsapp_phone_number_id && !!settings?.whatsapp_access_token,
    hasAI: !!settings?.openai_api_key,
    hasRently: !!settings?.rently_client_id && !!settings?.rently_client_secret,
    maskedAPIKey,
    aiProvider: settings?.ai_provider || 'openai',
    aiModel: settings?.ai_model || 'gpt-4o-mini',
    reservationsArchiveDays: settings?.reservations_archive_days ?? 10,
  };
}
