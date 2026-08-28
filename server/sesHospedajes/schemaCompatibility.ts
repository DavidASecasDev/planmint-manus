import type { SupabaseClient } from '@supabase/supabase-js';

export const SES_SCHEMA_MIGRATION = '20260828143000_ses_hospedajes_compatibility_restore.sql';

const POSTGRES_UNDEFINED_OBJECT_CODES = new Set(['42P01', '42703']);

export function isSesSchemaCompatibilityError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = String((error as { code?: unknown }).code ?? '');
  const message = String((error as { message?: unknown }).message ?? '').toLowerCase();
  return POSTGRES_UNDEFINED_OBJECT_CODES.has(code)
    || message.includes('does not exist')
    || message.includes('could not find the table')
    || message.includes('schema cache');
}

export function createSesMigrationRequiredError(cause?: unknown) {
  const error = new Error(
    `El esquema SES requiere la migración compatible ${SES_SCHEMA_MIGRATION}. No se ha modificado ningún dato.`,
  ) as Error & { status?: number; cause?: unknown };
  error.status = 503;
  error.cause = cause;
  return error;
}

export async function assertSesHardeningSchema(serviceClient: SupabaseClient): Promise<void> {
  const { error } = await serviceClient.from('ses_contract_drafts')
    .select('is_complete,is_eligible,is_officially_clear,ready_for_xml,official_check_status')
    .limit(1);
  if (error) throw createSesMigrationRequiredError(error);
}

export function parseLegacyOfficialLotCode(notes: unknown): string | null {
  const match = String(notes ?? '').match(/Código oficial de lote:\s*([0-9a-f-]{36})/i);
  return match?.[1] ?? null;
}

export function withLegacyDraftGates<T extends Record<string, any>>(draft: T): T & {
  is_complete: boolean;
  is_eligible: boolean;
  is_officially_clear: boolean;
  ready_for_xml: boolean;
  eligibility_errors: unknown[];
  official_check_status: string;
  document_version: string;
} {
  const accepted = draft.status === 'accepted';
  const legacyReady = draft.status === 'ready';
  const complete = accepted || legacyReady || ['batched', 'uploaded_pending_result'].includes(draft.status)
    || (Array.isArray(draft.validation_errors) && draft.validation_errors.length === 0);
  return {
    ...draft,
    is_complete: Boolean(draft.is_complete ?? complete),
    is_eligible: Boolean(draft.is_eligible ?? false),
    is_officially_clear: Boolean(draft.is_officially_clear ?? accepted),
    ready_for_xml: false,
    eligibility_errors: Array.isArray(draft.eligibility_errors) ? draft.eligibility_errors : [],
    official_check_status: String(draft.official_check_status ?? (accepted ? 'clear' : 'not_checked')),
    document_version: String(draft.document_version ?? '1.2.0'),
  };
}

export function withLegacyBatchFields<T extends Record<string, any>>(batch: T) {
  return {
    ...batch,
    official_lot_code: batch.official_lot_code ?? parseLegacyOfficialLotCode(batch.notes),
    document_version: batch.document_version ?? batch.schema_version ?? '1.2.0',
    xsd_version: batch.xsd_version ?? null,
    xsd_hash: batch.xsd_hash ?? null,
    xsd_validated_at: batch.xsd_validated_at ?? null,
    items: (batch.items ?? []).map((item: Record<string, any>) => ({
      ...item,
      official_communication_code: item.official_communication_code ?? item.result_code ?? null,
      snapshot_version: item.snapshot_version ?? item.draft_version ?? 1,
      snapshot_hash: item.snapshot_hash ?? null,
    })),
  };
}
