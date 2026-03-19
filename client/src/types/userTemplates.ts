// Phase 29: User-Generated Templates Types

export type TemplateVisibility = 'private' | 'org' | 'public';
export type TemplateStatus = 'active' | 'hidden' | 'removed';
export type ReportReason = 'spam' | 'copyright' | 'sensitive_data' | 'other';
export type ReportStatus = 'open' | 'reviewing' | 'resolved';

export interface UserTemplate {
  id: string;
  organization_id: string;
  created_by: string;
  name: string;
  slug: string;
  visibility: TemplateVisibility;
  description: string;
  long_description: string | null;
  icon: string | null;
  color: string | null;
  is_pack: boolean;
  industry: string | null;
  version: string;
  config_json: UserTemplateConfig;
  share_code: string;
  installs_count: number;
  favorites_count: number;
  rating_avg: number;
  rating_count: number;
  status: TemplateStatus;
  created_at: string;
  // Joined fields
  creator_name?: string;
  organization_name?: string;
}

export interface UserTemplateConfig {
  areas: UserTemplateArea[];
  tags: UserTemplateTag[];
  kanban_columns: UserTemplateKanbanColumn[];
  tasks: UserTemplateTask[];
  automations: UserTemplateAutomation[];
}

export interface UserTemplateArea {
  name: string;
  icon: string;
  color: string;
}

export interface UserTemplateTag {
  name: string;
  icon: string;
  color: string;
}

export interface UserTemplateKanbanColumn {
  label: string;
  status: string;
  color: string;
}

export interface UserTemplateTask {
  title: string;
  type: 'simple' | 'goal_numeric' | 'goal_milestones';
  status: string;
  priority: string;
  areas?: string[];
  tags?: string[];
  goal_target_value?: number;
  goal_unit?: string;
  milestones?: { title: string }[];
  subtasks?: { title: string }[];
}

export interface UserTemplateAutomation {
  name: string;
  trigger_type: string;
  conditions: { all?: any[]; any?: any[] };
  actions: { actions: any[] };
  throttle_minutes: number;
}

export interface TemplateInstall {
  id: string;
  template_id: string;
  organization_id: string;
  installed_by: string;
  installed_at: string;
}

export interface TemplateFavorite {
  id: string;
  template_id: string;
  user_id: string;
  created_at: string;
}

export interface TemplateRating {
  id: string;
  template_id: string;
  user_id: string;
  rating: number;
  review: string | null;
  created_at: string;
  // Joined
  user_name?: string;
}

export interface TemplateReport {
  id: string;
  template_id: string;
  reported_by: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  created_at: string;
}

export interface CreateUserTemplateData {
  name: string;
  slug: string;
  visibility: TemplateVisibility;
  description: string;
  long_description?: string;
  icon?: string;
  color?: string;
  is_pack?: boolean;
  industry?: string;
  config_json: UserTemplateConfig;
}

export interface ExportOptions {
  areas: boolean;
  tags: boolean;
  kanban_columns: boolean;
  tasks: boolean;
  automations: boolean;
}

export const VISIBILITY_LABELS: Record<TemplateVisibility, string> = {
  private: 'Privada',
  org: 'Organización',
  public: 'Pública',
};

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam',
  copyright: 'Derechos de autor',
  sensitive_data: 'Datos sensibles',
  other: 'Otro',
};
