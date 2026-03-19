export type MilestoneStatus = 'pending' | 'in_progress' | 'done';
export type MilestoneAssigneeType = 'user' | 'team' | null;

export interface Milestone {
  id: string;
  task_id: string;
  parent_milestone_id: string | null;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  sort_order: number;
  due_date: string | null;
  created_at: string;
  assignee_type: MilestoneAssigneeType;
  assignee_id: string | null;
  children?: Milestone[];
}

export interface MilestoneWithAssignee extends Milestone {
  assignee?: {
    id: string;
    name: string | null;
    type: 'user' | 'team';
  };
}

export interface CreateMilestoneData {
  task_id: string;
  parent_milestone_id?: string | null;
  title: string;
  description?: string;
  due_date?: string | null;
  assignee_type?: MilestoneAssigneeType;
  assignee_id?: string | null;
}

export interface UpdateMilestoneData {
  title?: string;
  description?: string | null;
  status?: MilestoneStatus;
  due_date?: string | null;
  sort_order?: number;
  parent_milestone_id?: string | null;
  assignee_type?: MilestoneAssigneeType;
  assignee_id?: string | null;
}

export const MILESTONE_STATUS_OPTIONS: { value: MilestoneStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Por hacer', color: 'bg-muted text-muted-foreground' },
  { value: 'in_progress', label: 'En progreso', color: 'bg-blue-100 text-blue-700' },
  { value: 'done', label: 'Completado', color: 'bg-green-100 text-green-700' },
];

// KPI stats for responsables view
export interface MilestoneAssigneeStats {
  assigneeId: string;
  assigneeType: 'user' | 'team';
  assigneeName: string;
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
  milestones: Milestone[];
}
