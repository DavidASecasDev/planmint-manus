export type TemplateCategory = 'personal' | 'team' | 'industry';

export interface Template {
  id: string;
  name: string;
  slug: string;
  category: TemplateCategory;
  industry: string | null;
  description: string;
  long_description: string | null;
  icon: string;
  color: string;
  is_featured: boolean;
  created_at: string;
}

export interface TemplateVersion {
  id: string;
  template_id: string;
  version: string;
  config_json: TemplateConfig;
  created_at: string;
}

export interface TemplateConfig {
  areas: TemplateArea[];
  tags: TemplateTag[];
  kanban_columns: TemplateKanbanColumn[];
  tasks: TemplateTask[];
  automations: TemplateAutomation[];
}

export interface TemplateArea {
  name: string;
  icon: string;
  color: string;
}

export interface TemplateTag {
  name: string;
  icon: string;
  color: string;
}

export interface TemplateKanbanColumn {
  label: string;
  status: string;
  color: string;
}

export interface TemplateTask {
  title: string;
  type: 'simple' | 'goal_numeric' | 'goal_milestones';
  status: string;
  priority: string;
  areas?: string[];
  tags?: string[];
  goal_target_value?: number;
  goal_unit?: string;
  milestones?: TemplateMilestone[];
  updates?: TemplateUpdate[];
}

export interface TemplateMilestone {
  title: string;
}

export interface TemplateUpdate {
  text: string;
  type: string;
}

export interface TemplateAutomation {
  name: string;
  trigger_type: string;
  conditions: { all?: any[]; any?: any[] };
  actions: { actions: any[] };
  throttle_minutes: number;
}

export interface TemplateApply {
  id: string;
  organization_id: string;
  template_id: string;
  template_version_id: string;
  applied_by: string;
  status: 'success' | 'failed';
  applied_entities_json: AppliedEntities;
  created_at: string;
}

export interface AppliedEntities {
  areas?: { id: string; reused: boolean }[];
  tags?: { id: string; reused: boolean }[];
  kanban_columns?: { id: string; reused: boolean }[];
  tasks?: { id: string }[];
  automations?: { id: string }[];
}

export interface ApplyOptions {
  areas: boolean;
  tags: boolean;
  kanban_columns: boolean;
  tasks: boolean;
  automations: boolean;
}

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  personal: 'Personal',
  team: 'Equipos',
  industry: 'Industria',
};

export const INDUSTRY_LABELS: Record<string, string> = {
  fleet: 'Flotas / Rent a Car',
  agency: 'Agencias',
  workshop: 'Talleres',
};
