import type { OperationType, LocationType } from './operations';

export type TaskType = 'simple' | 'goal_numeric' | 'goal_milestones' | 'operation';
export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  created_by: string;
  assigned_to: string | null;
  due_date: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  goal_target_value: number | null;
  goal_unit: string | null;
  // Operation fields
  operation_type: OperationType | null;
  scheduled_at: string | null;
  location_type: LocationType | null;
  location_text: string | null;
  location_notes: string | null;
  reservation_ref: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  vehicle_out_id: string | null;
  vehicle_in_id: string | null;
  // Soft-delete fields
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface TaskWithRelations extends Task {
  areas: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
  }[];
  tags: {
    id: string;
    name: string;
    color: string;
    icon: string;
  }[];
  creator?: {
    id: string;
    name: string | null;
  };
  assignee?: {
    id: string;
    name: string | null;
    avatar_url?: string | null;
  } | null;
  assignees?: {
    users: { id: string; name: string | null; avatar_url?: string | null }[];
    teams: { id: string; name: string; color: string }[];
  };
  subtaskCount?: number;
  subtaskCompleted?: number;
  goalCurrentValue?: number;
  milestoneCount?: number;
  milestoneCompleted?: number;
}

export interface TaskUpdate {
  id: string;
  task_id: string;
  user_id: string;
  text: string | null;
  type: string;
  goal_increment_value: number | null;
  created_at: string;
  user?: {
    id: string;
    name: string | null;
  };
}

export interface CreateTaskData {
  title: string;
  description?: string;
  type?: TaskType;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigned_to?: string | null;
  due_date?: string | null;
  area_ids: string[];
  tag_ids?: string[];
  goal_target_value?: number | null;
  goal_unit?: string | null;
  // Operation fields
  operation_type?: OperationType | null;
  scheduled_at?: string | null;
  location_type?: LocationType | null;
  location_text?: string | null;
  location_notes?: string | null;
  reservation_ref?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  vehicle_out_id?: string | null;
  vehicle_in_id?: string | null;
  primary_assignee_id?: string | null;
  has_support_leg?: boolean;
  support_assignee_id?: string | null;
}

export interface UpdateTaskData {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigned_to?: string | null;
  due_date?: string | null;
  is_archived?: boolean;
  area_ids?: string[];
  tag_ids?: string[];
}

export interface TaskFilters {
  status: TaskStatus | 'all';
  priority: TaskPriority | 'all';
  type: TaskType | 'all';
  areaIds: string[];
  tagIds: string[];
  onlyMine: boolean;
  showArchived: boolean;
  search: string;
  assigneeId: string; // 'all' or user_id of member to filter by
}

export const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'simple', label: 'Tarea simple' },
  { value: 'goal_numeric', label: 'Objetivo numérico' },
  { value: 'goal_milestones', label: 'Objetivo por hitos' },
  { value: 'operation', label: 'Operación' },
];

export const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pendiente', color: 'bg-yellow-500' },
  { value: 'in_progress', label: 'En progreso', color: 'bg-blue-500' },
  { value: 'blocked', label: 'Bloqueado', color: 'bg-red-500' },
  { value: 'completed', label: 'Completado', color: 'bg-green-500' },
];

export const TASK_PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Baja', color: 'bg-slate-400' },
  { value: 'medium', label: 'Media', color: 'bg-yellow-500' },
  { value: 'high', label: 'Alta', color: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgente', color: 'bg-red-500' },
];
