export type NotificationType = 'mention' | 'assignment' | 'reminder' | 'transfer_note' | 'repair_update' | 'accident_report' | 'damage_report_update' | 'vehicle_prep_alert' | 'transfer_stale_alert' | 'invitation_sent' | 'invitation_accepted' | 'equipment_shortage' | 'en_camino_alert';
export type NotificationEntityType = 'task' | 'task_update' | 'reminder' | 'transfer_request' | 'transfer_note' | 'form_response' | 'repair' | 'accident' | 'damage_report' | 'vehicle_prep' | 'invitation' | 'equipment' | 'en_camino';

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
  // For Garatech navigation
  repair_id?: string;
  accident_id?: string;
  damage_report_id?: string;
  // For vehicle prep navigation
  vehicle_id?: string;
}
