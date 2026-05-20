export type TriggerType = 
  | 'task_created'
  | 'task_updated'
  | 'task_status_changed'
  | 'task_assigned'
  | 'task_due_soon'
  | 'task_overdue'
  | 'goal_no_progress'
  | 'transfer_created'
  | 'transfer_status_changed'
  | 'transfer_due_soon'
  | 'transfer_completed'
  | 'transfer_cancelled';

export type ConditionOperator = 
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'not_in'
  | 'exists'
  | 'missing'
  | 'contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte';

export type ConditionField = 
  | 'status'
  | 'priority'
  | 'assigned_to'
  | 'has_tag'
  | 'has_area'
  | 'type'
  | 'due_date'
  | 'is_overdue'
  | 'progress_percent'
  | 'milestones_completed_percent'
  // Transfer-specific condition fields
  | 'transfer_status'
  | 'broker_name'
  | 'client_name'
  | 'service_type'
  | 'has_broker';

export interface Condition {
  field: ConditionField;
  op: ConditionOperator;
  value: string | string[] | number | boolean | null;
}

export interface ConditionsJson {
  all?: Condition[];
  any?: Condition[];
}

export type ActionType = 
  | 'set_status'
  | 'set_priority'
  | 'assign_to'
  | 'add_tag'
  | 'add_area'
  | 'create_subtask'
  | 'create_update'
  | 'create_in_app_notification'
  | 'send_push'
  | 'send_email'
  | 'send_slack'
  | 'send_whatsapp'
  // Transfer-specific actions
  | 'set_transfer_status'
  | 'notify_broker'
  | 'create_task_from_transfer';

export type NotificationTarget = 
  | 'assigned_to'
  | 'created_by'
  | 'role:admin'
  | 'role:manager'
  | string; // specific user_id

export interface AutomationAction {
  type: ActionType;
  value?: string;
  target?: NotificationTarget;
  title?: string;
  body?: string;
}

export interface ActionsJson {
  actions: AutomationAction[];
}

export interface AutomationRule {
  id: string;
  organization_id: string;
  name: string;
  is_active: boolean;
  trigger_type: TriggerType;
  conditions_json: ConditionsJson;
  actions_json: ActionsJson;
  throttle_minutes: number;
  created_by: string;
  created_at: string;
}

export interface AutomationRun {
  id: string;
  organization_id: string;
  rule_id: string;
  trigger_type: string;
  entity_type: string;
  entity_id: string;
  status: 'success' | 'skipped' | 'failed' | 'pending';
  message: string | null;
  created_at: string;
  rule?: AutomationRule;
}

export interface CreateAutomationRuleData {
  name: string;
  trigger_type: TriggerType;
  conditions_json: ConditionsJson;
  actions_json: ActionsJson;
  throttle_minutes?: number;
  is_active?: boolean;
}

export interface UpdateAutomationRuleData {
  name?: string;
  trigger_type?: TriggerType;
  conditions_json?: ConditionsJson;
  actions_json?: ActionsJson;
  throttle_minutes?: number;
  is_active?: boolean;
}

// NOTA: Los límites de automatización ahora vienen de la base de datos via useEntitlements
// Ver: billing_products.metadata_json.automations_limit y get_organization_entitlements()

// Trigger options
export const TRIGGER_OPTIONS: { value: TriggerType; label: string; description: string; category?: 'tasks' | 'transfers' }[] = [
  // Task triggers
  { value: 'task_created', label: 'Tarea creada', description: 'Cuando se crea una nueva tarea', category: 'tasks' },
  { value: 'task_updated', label: 'Tarea actualizada', description: 'Cuando se modifica una tarea', category: 'tasks' },
  { value: 'task_status_changed', label: 'Estado cambiado', description: 'Cuando cambia el estado de una tarea', category: 'tasks' },
  { value: 'task_assigned', label: 'Tarea asignada', description: 'Cuando se asigna una tarea a alguien', category: 'tasks' },
  { value: 'task_due_soon', label: 'Vencimiento próximo', description: '24 horas antes de la fecha de vencimiento', category: 'tasks' },
  { value: 'task_overdue', label: 'Tarea vencida', description: 'Cuando pasa la fecha de vencimiento', category: 'tasks' },
  { value: 'goal_no_progress', label: 'Objetivo sin progreso', description: 'Cuando un objetivo no tiene avance en X días', category: 'tasks' },
  // Transfer triggers
  { value: 'transfer_created', label: 'Solicitud creada', description: 'Cuando se crea una nueva solicitud de transfer', category: 'transfers' },
  { value: 'transfer_status_changed', label: 'Estado de transfer cambiado', description: 'Cuando cambia el estado de una solicitud', category: 'transfers' },
  { value: 'transfer_due_soon', label: 'Transfer próximo', description: '24 horas antes de la fecha del primer transfer', category: 'transfers' },
  { value: 'transfer_completed', label: 'Transfer completado', description: 'Cuando una solicitud pasa a estado Completado', category: 'transfers' },
  { value: 'transfer_cancelled', label: 'Transfer cancelado', description: 'Cuando una solicitud se cancela', category: 'transfers' },
];

// Condition field options (for tasks)
export const CONDITION_FIELD_OPTIONS: { value: ConditionField; label: string; category?: 'tasks' | 'transfers' }[] = [
  { value: 'status', label: 'Estado', category: 'tasks' },
  { value: 'priority', label: 'Prioridad', category: 'tasks' },
  { value: 'assigned_to', label: 'Asignado a', category: 'tasks' },
  { value: 'has_tag', label: 'Tiene etiqueta', category: 'tasks' },
  { value: 'has_area', label: 'En área', category: 'tasks' },
  { value: 'type', label: 'Tipo de tarea', category: 'tasks' },
  { value: 'due_date', label: 'Fecha de vencimiento', category: 'tasks' },
  { value: 'is_overdue', label: 'Está vencida', category: 'tasks' },
  { value: 'progress_percent', label: '% de progreso', category: 'tasks' },
  { value: 'milestones_completed_percent', label: '% de hitos completados', category: 'tasks' },
  // Transfer condition fields
  { value: 'transfer_status', label: 'Estado del transfer', category: 'transfers' },
  { value: 'broker_name', label: 'Broker', category: 'transfers' },
  { value: 'client_name', label: 'Cliente', category: 'transfers' },
  { value: 'service_type', label: 'Tipo de servicio', category: 'transfers' },
  { value: 'has_broker', label: 'Tiene broker asignado', category: 'transfers' },
];

// Operator options
export const OPERATOR_OPTIONS: { value: ConditionOperator; label: string }[] = [
  { value: 'equals', label: 'Es igual a' },
  { value: 'not_equals', label: 'No es igual a' },
  { value: 'in', label: 'Está en' },
  { value: 'not_in', label: 'No está en' },
  { value: 'exists', label: 'Existe' },
  { value: 'missing', label: 'No existe' },
  { value: 'gt', label: 'Mayor que' },
  { value: 'gte', label: 'Mayor o igual' },
  { value: 'lt', label: 'Menor que' },
  { value: 'lte', label: 'Menor o igual' },
];

// Action type options
export const ACTION_TYPE_OPTIONS: { value: ActionType; label: string; description: string; requiresPlan?: 'pro' | 'team'; category?: 'tasks' | 'transfers' | 'general' }[] = [
  // Task-specific actions
  { value: 'set_status', label: 'Cambiar estado', description: 'Cambia el estado de la tarea', category: 'tasks' },
  { value: 'set_priority', label: 'Cambiar prioridad', description: 'Cambia la prioridad de la tarea', category: 'tasks' },
  { value: 'assign_to', label: 'Asignar a', description: 'Asigna la tarea a un usuario', category: 'tasks' },
  { value: 'add_tag', label: 'Añadir etiqueta', description: 'Añade una etiqueta a la tarea', category: 'tasks' },
  { value: 'add_area', label: 'Añadir área', description: 'Añade la tarea a un área', category: 'tasks' },
  { value: 'create_subtask', label: 'Crear subtarea', description: 'Añade una subtarea a la tarea', category: 'tasks' },
  { value: 'create_update', label: 'Crear actualización', description: 'Añade una entrada en el timeline', category: 'tasks' },
  // General actions (work for both tasks and transfers)
  { value: 'create_in_app_notification', label: 'Notificación in-app', description: 'Envía una notificación dentro de la app', category: 'general' },
  { value: 'send_push', label: 'Notificación push', description: 'Envía una notificación push', category: 'general' },
  { value: 'send_email', label: 'Enviar email', description: 'Envía un correo electrónico', category: 'general' },
  { value: 'send_slack', label: 'Enviar a Slack', description: 'Envía un mensaje a Slack', category: 'general' },
  { value: 'send_whatsapp', label: 'Enviar WhatsApp', description: 'Envía un mensaje de WhatsApp', category: 'general' },
  // Transfer-specific actions
  { value: 'set_transfer_status', label: 'Cambiar estado transfer', description: 'Cambia el estado de la solicitud', category: 'transfers' },
  { value: 'notify_broker', label: 'Notificar al broker', description: 'Envía notificación al broker asignado', category: 'transfers' },
  { value: 'create_task_from_transfer', label: 'Crear tarea', description: 'Crea una tarea de seguimiento automáticamente', category: 'transfers' },
];

// Helper: determine if a trigger is transfer-related
export function isTransferTrigger(triggerType: TriggerType): boolean {
  return triggerType.startsWith('transfer_');
}

// Helper: get the category of a trigger
export function getTriggerCategory(triggerType: TriggerType): 'tasks' | 'transfers' {
  return isTransferTrigger(triggerType) ? 'transfers' : 'tasks';
}

// Transfer status options for conditions
export const TRANSFER_STATUS_OPTIONS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_gestion', label: 'En gestión' },
  { value: 'presupuesto_enviado', label: 'Ppto. Enviado' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'completado', label: 'Completado' },
  { value: 'cancelado', label: 'Cancelado' },
];
