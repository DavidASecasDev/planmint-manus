export type AreaVisibility = 'org' | 'admins' | 'custom';

export interface Area {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  is_archived: boolean;
  visibility: AreaVisibility;
  created_at: string;
}

export interface AreaAccessRule {
  id: string;
  organization_id: string;
  area_id: string;
  subject_type: 'user' | 'role' | 'team';
  subject_id: string;
  permission: 'view';
  created_at: string;
}

export interface CreateAreaData {
  name: string;
  description?: string;
  color: string;
  icon: string;
  visibility?: AreaVisibility;
}

export interface UpdateAreaData {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  is_archived?: boolean;
  visibility?: AreaVisibility;
}

export type AreaFilter = 'active' | 'archived' | 'all';

export const VISIBILITY_OPTIONS = [
  { value: 'org' as const, label: 'Todos en la organización', icon: 'users' },
  { value: 'admins' as const, label: 'Solo admins/directiva', icon: 'shield' },
  { value: 'custom' as const, label: 'Personalizado', icon: 'settings' },
] as const;

export const AREA_ICONS = [
  { name: 'folder', label: 'Carpeta' },
  { name: 'briefcase', label: 'Trabajo' },
  { name: 'home', label: 'Casa' },
  { name: 'car', label: 'Auto' },
  { name: 'heart', label: 'Salud' },
  { name: 'target', label: 'Objetivo' },
  { name: 'book', label: 'Educación' },
  { name: 'cog', label: 'Configuración' },
  { name: 'star', label: 'Favorito' },
  { name: 'wallet', label: 'Finanzas' },
  { name: 'users', label: 'Familia' },
  { name: 'plane', label: 'Viajes' },
] as const;

export const AREA_COLORS = [
  { value: '#4F46E5', label: 'Índigo' },
  { value: '#0EA5E9', label: 'Celeste' },
  { value: '#10B981', label: 'Esmeralda' },
  { value: '#F59E0B', label: 'Ámbar' },
  { value: '#EF4444', label: 'Rojo' },
  { value: '#8B5CF6', label: 'Violeta' },
  { value: '#EC4899', label: 'Rosa' },
  { value: '#06B6D4', label: 'Cian' },
  { value: '#84CC16', label: 'Lima' },
  { value: '#F97316', label: 'Naranja' },
] as const;
