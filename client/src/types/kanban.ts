import { TaskStatus } from '@/types/tasks';

export interface KanbanColumn {
  id: string;
  organization_id: string;
  status: TaskStatus;
  label: string;
  color: string;
  sort_order: number;
  is_visible: boolean;
  created_at: string;
}

export const DEFAULT_KANBAN_COLUMNS: Omit<KanbanColumn, 'id' | 'organization_id' | 'created_at'>[] = [
  { status: 'pending', label: 'Pendiente', color: '#6b7280', sort_order: 0, is_visible: true },
  { status: 'in_progress', label: 'En progreso', color: '#3b82f6', sort_order: 1, is_visible: true },
  { status: 'blocked', label: 'Bloqueado', color: '#ef4444', sort_order: 2, is_visible: true },
  { status: 'completed', label: 'Completada', color: '#22c55e', sort_order: 3, is_visible: true },
];
