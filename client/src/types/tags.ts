export interface Tag {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  icon: string;
  created_at: string;
}

export interface CreateTagData {
  name: string;
  color: string;
  icon: string;
}

export interface UpdateTagData {
  name?: string;
  color?: string;
  icon?: string;
}

export const TAG_ICONS = [
  'tag',
  'star',
  'briefcase',
  'home',
  'car',
  'heart',
  'alert-circle',
  'check',
  'calendar',
  'target',
  'flag',
  'bookmark',
  'zap',
  'clock',
  'users',
] as const;

export const TAG_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#64748b', // slate
] as const;
