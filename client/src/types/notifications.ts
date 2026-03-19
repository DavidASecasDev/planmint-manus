export type NotificationType = 'mention' | 'assignment' | 'reminder';
export type NotificationEntityType = 'task' | 'task_update' | 'reminder' | 'transfer_request' | 'form_response';

export interface Notification {
  id: string;
  organization_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  entity_type: NotificationEntityType;
  entity_id: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationWithDetails extends Notification {
  // For navigation - we'll resolve task_id for task_update and reminder types
  task_id?: string;
  // For transfer_request navigation
  transfer_request_id?: string;
}
