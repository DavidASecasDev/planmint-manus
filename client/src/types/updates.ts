export type UpdateType = 
  | 'note' 
  | 'progress' 
  | 'blocker' 
  | 'info' 
  | 'status_change' 
  | 'goal_increment' 
  | 'milestone_completed';

export interface TaskUpdateImage {
  id: string;
  storage_path: string;
  file_name: string;
  file_size: number;
}

export interface TaskUpdateWithUser {
  id: string;
  task_id: string;
  user_id: string;
  text: string | null;
  type: UpdateType;
  goal_increment_value: number | null;
  created_at: string;
  user: {
    id: string;
    name: string | null;
  } | null;
  mentions?: {
    id: string;
    mentioned_user_id: string;
    mentioned_user: {
      id: string;
      name: string | null;
    } | null;
  }[];
  images?: TaskUpdateImage[];
}

export interface TaskUpdateMention {
  id: string;
  update_id: string;
  mentioned_user_id: string;
}

export const UPDATE_TYPE_OPTIONS: { value: UpdateType; label: string }[] = [
  { value: 'note', label: 'Nota' },
  { value: 'progress', label: 'Avance' },
  { value: 'blocker', label: 'Bloqueo' },
  { value: 'info', label: 'Información' },
];

export const UPDATE_TYPE_CONFIG: Record<UpdateType, { label: string; color: string; bgColor: string }> = {
  note: { label: 'Nota', color: 'text-muted-foreground', bgColor: 'bg-muted' },
  progress: { label: 'Avance', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  blocker: { label: 'Bloqueo', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  info: { label: 'Info', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  status_change: { label: 'Estado', color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
  goal_increment: { label: 'Aporte', color: 'text-green-600', bgColor: 'bg-green-100' },
  milestone_completed: { label: 'Hito', color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
};
