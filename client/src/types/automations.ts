export type TriggerType = 
  | 'task_created'
  | 'task_updated'
  | 'task_status_changed'
  | 'task_assigned'
  | 'task_due_soon'
  | 'task_overdue'
  | 'goal_no_progress';

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
  | 'milestones_completed_percent';

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
  | 'send_whatsapp';

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
export const TRIGGER_OPTIONS: { value: TriggerType; label: string; description: string }[] = [
  { value: 'task_created', label: 'Tarea creada', description: 'Cuando se crea una nueva tarea' },
  { value: 'task_updated', label: 'Tarea actualizada', description: 'Cuando se modifica una tarea' },
  { value: 'task_status_changed', label: 'Estado cambiado', description: 'Cuando cambia el estado de una tarea' },
  { value: 'task_assigned', label: 'Tarea asignada', description: 'Cuando se asigna una tarea a alguien' },
  { value: 'task_due_soon', label: 'Vencimiento próximo', description: '24 horas antes de la fecha de vencimiento' },
  { value: 'task_overdue', label: 'Tarea vencida', description: 'Cuando pasa la fecha de vencimiento' },
  { value: 'goal_no_progress', label: 'Objetivo sin progreso', description: 'Cuando un objetivo no tiene avance en X días' },
];

// Condition field options
export const CONDITION_FIELD_OPTIONS: { value: ConditionField; label: string }[] = [
  { value: 'status', label: 'Estado' },
  { value: 'priority', label: 'Prioridad' },
  { value: 'assigned_to', label: 'Asignado a' },
  { value: 'has_tag', label: 'Tiene etiqueta' },
  { value: 'has_area', label: 'En área' },
  { value: 'type', label: 'Tipo de tarea' },
  { value: 'due_date', label: 'Fecha de vencimiento' },
  { value: 'is_overdue', label: 'Está vencida' },
  { value: 'progress_percent', label: '% de progreso' },
  { value: 'milestones_completed_percent', label: '% de hitos completados' },
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
export const ACTION_TYPE_OPTIONS: { value: ActionType; label: string; description: string; requiresPlan?: 'pro' | 'team' }[] = [
  { value: 'set_status', label: 'Cambiar estado', description: 'Cambia el estado de la tarea' },
  { value: 'set_priority', label: 'Cambiar prioridad', description: 'Cambia la prioridad de la tarea' },
  { value: 'assign_to', label: 'Asignar a', description: 'Asigna la tarea a un usuario' },
  { value: 'add_tag', label: 'Añadir etiqueta', description: 'Añade una etiqueta a la tarea' },
  { value: 'add_area', label: 'Añadir área', description: 'Añade la tarea a un área' },
  { value: 'create_subtask', label: 'Crear subtarea', description: 'Añade una subtarea a la tarea' },
  { value: 'create_update', label: 'Crear actualización', description: 'Añade una entrada en el timeline' },
  { value: 'create_in_app_notification', label: 'Notificación in-app', description: 'Envía una notificación dentro de la app' },
  { value: 'send_push', label: 'Notificación push', description: 'Envía una notificación push', requiresPlan: 'pro' },
  { value: 'send_email', label: 'Enviar email', description: 'Envía un correo electrónico', requiresPlan: 'pro' },
  { value: 'send_slack', label: 'Enviar a Slack', description: 'Envía un mensaje a Slack', requiresPlan: 'team' },
  { value: 'send_whatsapp', label: 'Enviar WhatsApp', description: 'Envía un mensaje de WhatsApp', requiresPlan: 'team' },
];
