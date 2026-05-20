/**
 * Automation Engine for PlanMint
 * 
 * Evaluates automation rules when transfer events occur and executes configured actions.
 * Supports throttling, condition evaluation, and multiple action types.
 */
import { getServiceClient } from './supabaseAdmin';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TransferTriggerType =
  | 'transfer_created'
  | 'transfer_status_changed'
  | 'transfer_due_soon'
  | 'transfer_completed'
  | 'transfer_cancelled';

interface TransferEventPayload {
  request_id: string;
  organization_id: string;
  trigger_type: TransferTriggerType;
  // Transfer data for condition evaluation
  status?: string;
  previous_status?: string | null;
  broker_id?: string | null;
  broker_name?: string;
  client_name?: string;
  service_type?: string;
  request_number?: string;
  // Who triggered it
  triggered_by_id?: string;
  triggered_by_name?: string;
}

interface Condition {
  field: string;
  op: string;
  value: string | string[] | number | boolean | null;
}

interface ConditionsJson {
  all?: Condition[];
  any?: Condition[];
}

interface AutomationAction {
  type: string;
  value?: string;
  target?: string;
  title?: string;
  body?: string;
}

interface ActionsJson {
  actions: AutomationAction[];
}

interface AutomationRule {
  id: string;
  organization_id: string;
  name: string;
  is_active: boolean;
  trigger_type: string;
  conditions_json: ConditionsJson;
  actions_json: ActionsJson;
  throttle_minutes: number;
}

// ─── Condition Evaluation ────────────────────────────────────────────────────

function getFieldValue(payload: TransferEventPayload, field: string): any {
  switch (field) {
    case 'transfer_status':
    case 'status':
      return payload.status;
    case 'broker_name':
      return payload.broker_name;
    case 'client_name':
      return payload.client_name;
    case 'service_type':
      return payload.service_type;
    case 'has_broker':
      return !!payload.broker_id;
    default:
      return undefined;
  }
}

function evaluateCondition(condition: Condition, payload: TransferEventPayload): boolean {
  const fieldValue = getFieldValue(payload, condition.field);
  
  switch (condition.op) {
    case 'equals':
      return fieldValue === condition.value;
    case 'not_equals':
      return fieldValue !== condition.value;
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    case 'not_in':
      return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
    case 'exists':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    case 'missing':
      return fieldValue === null || fieldValue === undefined || fieldValue === '';
    case 'contains':
      return typeof fieldValue === 'string' && typeof condition.value === 'string' 
        && fieldValue.toLowerCase().includes(condition.value.toLowerCase());
    default:
      return false;
  }
}

function evaluateConditions(conditions: ConditionsJson, payload: TransferEventPayload): boolean {
  // If no conditions, always match
  if (!conditions.all?.length && !conditions.any?.length) {
    return true;
  }

  // All conditions must match
  if (conditions.all?.length) {
    const allMatch = conditions.all.every(c => evaluateCondition(c, payload));
    if (!allMatch) return false;
  }

  // At least one condition must match
  if (conditions.any?.length) {
    const anyMatch = conditions.any.some(c => evaluateCondition(c, payload));
    if (!anyMatch) return false;
  }

  return true;
}

// ─── Throttle Check ──────────────────────────────────────────────────────────

async function isThrottled(ruleId: string, entityId: string, throttleMinutes: number): Promise<boolean> {
  if (throttleMinutes <= 0) return false;

  const supabase = getServiceClient();
  const cutoff = new Date(Date.now() - throttleMinutes * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('automation_runs')
    .select('id')
    .eq('rule_id', ruleId)
    .eq('entity_id', entityId)
    .gte('created_at', cutoff)
    .limit(1);

  return (data?.length || 0) > 0;
}

// ─── Action Execution ────────────────────────────────────────────────────────

async function executeAction(
  action: AutomationAction,
  payload: TransferEventPayload,
  rule: AutomationRule
): Promise<{ success: boolean; message: string }> {
  const supabase = getServiceClient();

  switch (action.type) {
    case 'create_in_app_notification': {
      // Determine target user(s)
      const targets = await resolveNotificationTargets(action.target, payload);
      for (const userId of targets) {
        await supabase.from('notifications').insert({
          organization_id: payload.organization_id,
          user_id: userId,
          type: 'assignment', // Generic notification type
          title: interpolateTemplate(action.title || `Automatización: ${rule.name}`, payload),
          body: interpolateTemplate(action.body || `Se ha activado la regla "${rule.name}"`, payload),
          entity_type: 'transfer_request',
          entity_id: payload.request_id,
          is_read: false,
        });
      }
      return { success: true, message: `Notificación enviada a ${targets.length} usuario(s)` };
    }

    case 'notify_broker': {
      if (!payload.broker_id) {
        return { success: false, message: 'No hay broker asignado' };
      }
      // Look up broker's user_id
      const { data: broker } = await supabase
        .from('transfer_brokers')
        .select('user_id, name')
        .eq('id', payload.broker_id)
        .single();

      if (!broker?.user_id) {
        return { success: false, message: 'Broker no tiene acceso al portal' };
      }

      await supabase.from('notifications').insert({
        organization_id: payload.organization_id,
        user_id: broker.user_id,
        type: 'transfer_status_change',
        title: interpolateTemplate(action.title || `${payload.request_number || 'Solicitud'} — Actualización`, payload),
        body: interpolateTemplate(action.body || `Tu solicitud ha sido actualizada.`, payload),
        entity_type: 'transfer_request',
        entity_id: payload.request_id,
        is_read: false,
      });
      return { success: true, message: `Notificación enviada al broker ${broker.name}` };
    }

    case 'set_transfer_status': {
      if (!action.value) {
        return { success: false, message: 'No se especificó el nuevo estado' };
      }
      await supabase
        .from('transfer_requests')
        .update({ status: action.value })
        .eq('id', payload.request_id);
      return { success: true, message: `Estado cambiado a ${action.value}` };
    }

    case 'create_task_from_transfer': {
      // Create a task linked to this transfer
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('organization_id', payload.organization_id)
        .eq('role', 'admin')
        .limit(1);

      const assignTo = profiles?.[0]?.id || payload.triggered_by_id;

      await supabase.from('tasks').insert({
        organization_id: payload.organization_id,
        title: interpolateTemplate(action.title || `Seguimiento: ${payload.request_number || 'Transfer'}`, payload),
        description: interpolateTemplate(action.body || `Tarea creada automáticamente por la regla "${rule.name}"`, payload),
        status: 'todo',
        priority: 'medium',
        type: 'task',
        created_by: payload.triggered_by_id || assignTo,
        assigned_to: assignTo,
      });
      return { success: true, message: 'Tarea de seguimiento creada' };
    }

    case 'send_push': {
      // Push notifications via existing system
      const targets = await resolveNotificationTargets(action.target, payload);
      for (const userId of targets) {
        await supabase.from('notifications').insert({
          organization_id: payload.organization_id,
          user_id: userId,
          type: 'assignment',
          title: interpolateTemplate(action.title || `Automatización: ${rule.name}`, payload),
          body: interpolateTemplate(action.body || `Se ha activado la regla "${rule.name}"`, payload),
          entity_type: 'transfer_request',
          entity_id: payload.request_id,
          is_read: false,
        });
      }
      return { success: true, message: `Push enviado a ${targets.length} usuario(s)` };
    }

    default:
      return { success: false, message: `Acción no soportada: ${action.type}` };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function interpolateTemplate(template: string, payload: TransferEventPayload): string {
  return template
    .replace(/\{\{request_number\}\}/g, payload.request_number || '')
    .replace(/\{\{client_name\}\}/g, payload.client_name || '')
    .replace(/\{\{broker_name\}\}/g, payload.broker_name || '')
    .replace(/\{\{status\}\}/g, payload.status || '')
    .replace(/\{\{previous_status\}\}/g, payload.previous_status || '')
    .replace(/\{\{service_type\}\}/g, payload.service_type || '');
}

async function resolveNotificationTargets(
  target: string | undefined,
  payload: TransferEventPayload
): Promise<string[]> {
  const supabase = getServiceClient();

  if (!target) {
    // Default: notify all admins in the organization
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('organization_id', payload.organization_id)
      .in('role', ['admin', 'manager']);
    return (data || []).map(p => p.id);
  }

  if (target.startsWith('role:')) {
    const role = target.replace('role:', '');
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('organization_id', payload.organization_id)
      .eq('role', role);
    return (data || []).map(p => p.id);
  }

  if (target === 'created_by' && payload.triggered_by_id) {
    return [payload.triggered_by_id];
  }

  // Assume it's a specific user_id
  return [target];
}

// ─── Main Engine Entry Point ─────────────────────────────────────────────────

export async function fireTransferAutomation(payload: TransferEventPayload): Promise<void> {
  const supabase = getServiceClient();

  try {
    // 1. Fetch active rules for this organization and trigger type
    const { data: rules, error } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('organization_id', payload.organization_id)
      .eq('trigger_type', payload.trigger_type)
      .eq('is_active', true);

    if (error || !rules?.length) return;

    // 2. Evaluate each rule
    for (const ruleData of rules) {
      const rule: AutomationRule = {
        ...ruleData,
        conditions_json: (ruleData.conditions_json || {}) as ConditionsJson,
        actions_json: (ruleData.actions_json || { actions: [] }) as ActionsJson,
      };

      // Check throttle
      const throttled = await isThrottled(rule.id, payload.request_id, rule.throttle_minutes);
      if (throttled) {
        await logRun(supabase, rule, payload, 'skipped', 'Throttled: ejecutada recientemente');
        continue;
      }

      // Evaluate conditions
      const conditionsMet = evaluateConditions(rule.conditions_json, payload);
      if (!conditionsMet) {
        await logRun(supabase, rule, payload, 'skipped', 'Condiciones no cumplidas');
        continue;
      }

      // Execute actions
      const results: string[] = [];
      let allSuccess = true;

      for (const action of rule.actions_json.actions) {
        try {
          const result = await executeAction(action, payload, rule);
          results.push(`${action.type}: ${result.message}`);
          if (!result.success) allSuccess = false;
        } catch (actionErr: any) {
          results.push(`${action.type}: ERROR - ${actionErr.message}`);
          allSuccess = false;
        }
      }

      await logRun(
        supabase,
        rule,
        payload,
        allSuccess ? 'success' : 'failed',
        results.join(' | ')
      );
    }
  } catch (err) {
    console.error('[AutomationEngine] Error processing transfer automation:', err);
  }
}

async function logRun(
  supabase: any,
  rule: AutomationRule,
  payload: TransferEventPayload,
  status: 'success' | 'skipped' | 'failed',
  message: string
): Promise<void> {
  try {
    await supabase.from('automation_runs').insert({
      organization_id: payload.organization_id,
      rule_id: rule.id,
      trigger_type: payload.trigger_type,
      entity_type: 'transfer_request',
      entity_id: payload.request_id,
      status,
      message,
    });
  } catch (err) {
    console.error('[AutomationEngine] Failed to log run:', err);
  }
}

// ─── Convenience wrappers for common trigger points ──────────────────────────

export async function onTransferCreated(params: {
  request_id: string;
  organization_id: string;
  status: string;
  broker_id?: string | null;
  broker_name?: string;
  client_name?: string;
  service_type?: string;
  request_number?: string;
  triggered_by_id?: string;
  triggered_by_name?: string;
}): Promise<void> {
  await fireTransferAutomation({
    ...params,
    trigger_type: 'transfer_created',
  });
}

export async function onTransferStatusChanged(params: {
  request_id: string;
  organization_id: string;
  status: string;
  previous_status?: string | null;
  broker_id?: string | null;
  broker_name?: string;
  client_name?: string;
  service_type?: string;
  request_number?: string;
  triggered_by_id?: string;
  triggered_by_name?: string;
}): Promise<void> {
  // Fire the generic status_changed trigger
  await fireTransferAutomation({
    ...params,
    trigger_type: 'transfer_status_changed',
  });

  // Also fire specific triggers for completed/cancelled
  if (params.status === 'completado') {
    await fireTransferAutomation({
      ...params,
      trigger_type: 'transfer_completed',
    });
  } else if (params.status === 'cancelado') {
    await fireTransferAutomation({
      ...params,
      trigger_type: 'transfer_cancelled',
    });
  }
}
