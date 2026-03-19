export type NotificationChannel = 'in_app' | 'push' | 'email' | 'slack' | 'whatsapp';
export type OutboundStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface PushSubscription {
  id: string;
  organization_id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  id: string;
  organization_id: string;
  user_id: string;
  channel_in_app: boolean;
  channel_push: boolean;
  channel_email: boolean;
  channel_slack: boolean;
  channel_whatsapp: boolean;
  events_json: {
    mention: boolean;
    assignment: boolean;
    reminder: boolean;
    ai_insight: boolean;
  };
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string | null;
  created_at: string;
}

export type AIProvider = 'openai' | 'azure' | 'anthropic';

export interface IntegrationSettings {
  id: string;
  organization_id: string;
  slack_webhook_url?: string;
  email_from_name?: string;
  email_from_address?: string;
  whatsapp_phone_number_id?: string;
  whatsapp_access_token?: string;
  whatsapp_business_account_id?: string;
  // AI configuration
  openai_api_key?: string;
  ai_provider?: AIProvider;
  ai_model?: string;
  ai_base_url?: string;
  // Rently integration
  rently_api_host?: string;
  rently_client_id?: string;
  rently_client_secret?: string;
  // Reservations archiving
  reservations_archive_days?: number;
  created_at: string;
}

export interface OutboundNotification {
  id: string;
  organization_id: string;
  user_id: string;
  source_notification_id?: string;
  channel: NotificationChannel;
  status: OutboundStatus;
  payload: Record<string, unknown>;
  error_message?: string;
  created_at: string;
}

// Integration flags returned by get_org_integration_flags RPC
export interface IntegrationFlags {
  has_rently: boolean;
  has_ai: boolean;
  has_slack: boolean;
  has_whatsapp: boolean;
  reservations_archive_days: number;
  ai_provider: string;
  ai_model: string;
}

// Plan-based channel permissions
export const CHANNEL_PERMISSIONS = {
  free: {
    in_app: true,
    push: false,
    email: false,
    slack: false,
    whatsapp: false,
  },
  pro: {
    in_app: true,
    push: true,
    email: true,
    slack: false,
    whatsapp: false,
  },
  team: {
    in_app: true,
    push: true,
    email: true,
    slack: true,
    whatsapp: true,
  },
} as const;
