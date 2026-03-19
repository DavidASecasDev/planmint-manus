export type EventType =
  | 'task_created'
  | 'task_completed'
  | 'task_deleted'
  | 'area_created'
  | 'tag_created'
  | 'kanban_viewed'
  | 'calendar_viewed'
  | 'task_list_viewed'
  | 'reminder_created'
  | 'recurring_reminder_created'
  | 'task_mentioned_user'
  | 'global_search_used'
  | 'global_search_opened'
  | 'limit_reached'
  | 'upgrade_cta_clicked'
  | 'user_feedback'
  // Growth events (Phase 22)
  | 'landing_viewed'
  | 'pricing_viewed'
  | 'cta_clicked'
  | 'lead_created'
  | 'ref_click'
  | 'signup_started'
  | 'signup_completed';

export type EntityType = 'task' | 'area' | 'tag' | 'reminder' | 'user' | 'feedback' | 'search';

export interface UsageEvent {
  id: string;
  organization_id: string;
  user_id: string;
  event_type: EventType;
  entity_type: EntityType | null;
  entity_id: string | null;
  created_at: string;
}

export interface UserFeedback {
  id: string;
  organization_id: string;
  user_id: string;
  feedback_type: 'suggestion' | 'problem' | 'other';
  message: string;
  created_at: string;
}

export interface UsageStats {
  totalTasks: number;
  tasksCreatedThisWeek: number;
  tasksCompletedThisWeek: number;
  activeUsers: number;
  kanbanViews: number;
  calendarViews: number;
  listViews: number;
  searchUsage: number;
  remindersCreated: number;
  limitReachedEvents: number;
  upgradeClicks: number;
}

export interface DailyStats {
  date: string;
  tasks_created: number;
  tasks_completed: number;
}
