export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  organization_id: string | null;
  plan: string | null;
  rollout_percentage: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type FeatureFlagKey = 
  | 'ai_assistant'
  | 'advanced_exports'
  | 'pdf_exports'
  | 'api_access'
  | 'sso_saml'
  | 'scim_provisioning'
  | 'webhooks'
  | 'custom_branding'
  | 'priority_support';

export const FEATURE_FLAG_DISPLAY: Record<FeatureFlagKey, { icon: string; color: string }> = {
  ai_assistant: { icon: 'Brain', color: 'text-purple-500' },
  advanced_exports: { icon: 'FileDown', color: 'text-blue-500' },
  pdf_exports: { icon: 'FileText', color: 'text-red-500' },
  api_access: { icon: 'Code', color: 'text-green-500' },
  sso_saml: { icon: 'Shield', color: 'text-amber-500' },
  scim_provisioning: { icon: 'Users', color: 'text-indigo-500' },
  webhooks: { icon: 'Webhook', color: 'text-pink-500' },
  custom_branding: { icon: 'Palette', color: 'text-orange-500' },
  priority_support: { icon: 'Headphones', color: 'text-cyan-500' },
};
