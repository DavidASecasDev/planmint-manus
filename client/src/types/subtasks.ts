export type SubtaskStatus = 'pending' | 'done';

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  status: SubtaskStatus;
  sort_order: number;
  created_at: string;
}

export interface CreateSubtaskData {
  task_id: string;
  title: string;
}

export interface UpdateSubtaskData {
  title?: string;
  status?: SubtaskStatus;
  sort_order?: number;
}
