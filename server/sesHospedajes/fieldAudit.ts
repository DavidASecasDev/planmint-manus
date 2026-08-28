import type { SupabaseClient } from '@supabase/supabase-js';

export type SesAuditSource = 'rently' | 'respond' | 'manual';

export function buildSesFieldAuditRows(input: {
  organizationId: string;
  entityType: 'person' | 'location' | 'draft' | 'reservation' | 'settings';
  entityId: string;
  source: SesAuditSource;
  actorUserId?: string | null;
  previous: Record<string, unknown>;
  changes: Record<string, unknown>;
  reason: string;
}) {
  return Object.entries(input.changes)
    .filter(([field, value]) => JSON.stringify(input.previous[field] ?? null) !== JSON.stringify(value ?? null))
    .map(([field, value]) => ({
      organization_id: input.organizationId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      field_name: field,
      source: input.source,
      previous_value: input.previous[field] === undefined ? null : input.previous[field],
      new_value: value === undefined ? null : value,
      reason: input.reason,
      performed_by: input.actorUserId ?? null,
    }));
}

export async function persistSesFieldAudit(
  serviceClient: SupabaseClient,
  rows: ReturnType<typeof buildSesFieldAuditRows>,
) {
  if (rows.length === 0) return;
  const { error } = await serviceClient.from('ses_field_audit_events').insert(rows);
  if (error) throw error;
}

