export type AIFeature = 'task_summary' | 'weekly_digest' | 'insights' | 'ai_alerts';

export interface AIFeatureAccess {
  taskSummary: boolean;
  weeklyDigest: boolean;
  insights: boolean;
  aiAlerts: boolean;
}

export interface Insight {
  id: string;
  type: 'blocked_task' | 'stale_goal' | 'expired_reminders' | 'general';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
}
