// Time Tracking module types

export interface TimeEntry {
  id: string;
  organization_id: string;
  task_id: string | null;
  user_id: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  is_billable: boolean;
  hourly_rate: number | null;
  is_running: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimeEntryWithRelations extends TimeEntry {
  task?: {
    id: string;
    title: string;
  } | null;
  user?: {
    id: string;
    name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface CreateTimeEntryData {
  task_id?: string | null;
  description?: string | null;
  start_time?: string;
  end_time?: string | null;
  duration_minutes?: number | null;
  is_billable?: boolean;
  hourly_rate?: number | null;
  is_running?: boolean;
}

export interface UpdateTimeEntryData extends Partial<CreateTimeEntryData> {
  id: string;
}

export interface TimeTrackingFilters {
  user_id?: string;
  task_id?: string;
  start_date?: string;
  end_date?: string;
  is_billable?: boolean;
}

export interface TimeTrackingSummary {
  total_minutes: number;
  billable_minutes: number;
  total_entries: number;
  by_user: {
    user_id: string;
    user_name: string | null;
    minutes: number;
  }[];
  by_task: {
    task_id: string;
    task_title: string;
    minutes: number;
  }[];
}

// Timer state for active tracking
export interface TimerState {
  isRunning: boolean;
  activeEntryId: string | null;
  startTime: Date | null;
  elapsed: number; // seconds
}
