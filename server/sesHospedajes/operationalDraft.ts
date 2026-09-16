import type { SesValidationIssue } from './validation';
import { isSesDraftLocked } from './readiness';
import { deriveSesCancellationDisposition, type SesCancellationDisposition } from './cancellation';

export type SesOperationalStatus =
  | 'incomplete' | 'ready' | 'xml_generated'
  | 'cancelled_not_applicable' | 'cancellation_review' | 'source_check_required';
export type SesFieldSource = 'manual' | 'rently' | 'derived';

export type SesSyncConflict = {
  field: string;
  keptSource: 'manual';
  incomingSource: 'rently' | 'derived';
  existingValue: unknown;
  incomingValue: unknown;
};

function hasValue(value: unknown) {
  return value !== null && value !== undefined && !(typeof value === 'string' && value.trim() === '');
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export function splitSesValidationIssues(issues: SesValidationIssue[]) {
  return {
    missingFields: issues.filter((issue) => issue.code === 'required'),
    invalidFields: issues.filter((issue) => issue.code !== 'required'),
  };
}

export function dedupeSharedPersonIssues(issues: SesValidationIssue[], sharedProfile: boolean) {
  if (!sharedProfile) return issues;
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const canonicalPath = issue.path.replace(/^(holder|primary_driver)\./, 'holder_driver.');
    const key = `${canonicalPath}:${issue.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function deriveSesOperationalState(input: {
  validationIssues: SesValidationIssue[];
  historicalStatus?: unknown;
  blockingConflictCount?: number;
  cancellationDisposition?: SesCancellationDisposition | null;
}) {
  const { missingFields, invalidFields } = splitSesValidationIssues(input.validationIssues);
  const disposition = input.cancellationDisposition;
  const locked = isSesDraftLocked(input.historicalStatus);
  if (!locked && disposition?.kind === 'cancelled_not_applicable') {
    return { status: 'cancelled_not_applicable' as const, readyForXml: false, missingFields: [], invalidFields: [] };
  }
  if (!locked && disposition?.kind === 'cancelled_requires_review') {
    return { status: 'cancellation_review' as const, readyForXml: false, missingFields: [], invalidFields: [] };
  }
  if (!locked && disposition?.kind === 'source_status_unknown') {
    return { status: 'source_check_required' as const, readyForXml: false, missingFields, invalidFields };
  }
  const readyForXml = missingFields.length === 0 && invalidFields.length === 0
    && (input.blockingConflictCount ?? 0) === 0 && !disposition?.blocksXml;
  const status: SesOperationalStatus = isSesDraftLocked(input.historicalStatus)
    ? 'xml_generated'
    : readyForXml ? 'ready' : 'incomplete';
  return { status, readyForXml, missingFields, invalidFields };
}

export function mergeSesRentlyFields(input: {
  existing?: Record<string, unknown> | null;
  incoming: Record<string, unknown>;
  manualFields?: string[] | null;
  derivedFields?: string[];
}) {
  const existing = input.existing ?? {};
  const manualFields = new Set(input.manualFields ?? []);
  const derivedFields = new Set(input.derivedFields ?? []);
  const values: Record<string, unknown> = {};
  const sourceByField: Record<string, SesFieldSource> = {};
  const syncConflicts: SesSyncConflict[] = [];

  for (const [field, incomingValue] of Object.entries(input.incoming)) {
    const existingValue = existing[field];
    const incomingSource = derivedFields.has(field) ? 'derived' as const : 'rently' as const;
    if (manualFields.has(field)) {
      values[field] = existingValue;
      sourceByField[field] = 'manual';
      if (hasValue(incomingValue) && !sameValue(existingValue, incomingValue)) {
        syncConflicts.push({
          field,
          keptSource: 'manual',
          incomingSource,
          existingValue,
          incomingValue,
        });
      }
      continue;
    }
    if (hasValue(incomingValue)) {
      values[field] = incomingValue;
      sourceByField[field] = incomingSource;
    } else {
      values[field] = existingValue ?? null;
      if (hasValue(existingValue)) sourceByField[field] = 'rently';
    }
  }

  return { values, sourceByField, syncConflicts };
}

export function buildSesDuplicateWarning(status: unknown, reasons: unknown) {
  if (status === 'blocked') {
    return {
      level: 'warning' as const,
      message: 'SES contiene una comunicación activa o aceptada para esta identidad contractual. Revisa antes de descargar otro XML.',
      reasons: Array.isArray(reasons) ? reasons.map(String) : [],
    };
  }
  if (status === 'review') {
    return {
      level: 'warning' as const,
      message: 'La comprobación SES encontró una versión distinta, anulada o con error. Revisa la evidencia antes de continuar.',
      reasons: Array.isArray(reasons) ? reasons.map(String) : [],
    };
  }
  return null;
}

export function projectSesOperationalDraft(draft: Record<string, any>) {
  const rawValidationIssues = Array.isArray(draft.validation_errors) ? draft.validation_errors : [];
  const validationIssues = dedupeSharedPersonIssues(
    rawValidationIssues,
    Boolean(draft.holder?.id && draft.holder.id === draft.primary_driver?.id),
  );
  const snapshot = draft.eligibility_snapshot && typeof draft.eligibility_snapshot === 'object'
    ? draft.eligibility_snapshot : {};
  const reservation = Array.isArray(draft.reservation) ? draft.reservation[0] : draft.reservation;
  const hasAccreditedStatus = Boolean(reservation && Object.prototype.hasOwnProperty.call(reservation, 'rently_status_code'));
  const cancellationDisposition = hasAccreditedStatus
    ? deriveSesCancellationDisposition({
      rentlyStatusCode: reservation?.rently_status_code,
      actualDeliveryAt: reservation?.rently_delivery_actual_literal ?? reservation?.rently_delivery_actual_at,
      deliveryEvidenceReference: snapshot.delivery_evidence_reference,
      officialCommunicationCount: Number(draft.__official_communication_count ?? 0),
      hasHistoricalBatchItem: Number(draft.__historical_batch_item_count ?? 0) > 0 || isSesDraftLocked(draft.status),
    })
    : null;
  const reviewConflicts = Array.isArray(snapshot.daily_review_conflicts) ? snapshot.daily_review_conflicts : [];
  const operational = deriveSesOperationalState({
    validationIssues,
    historicalStatus: draft.status,
    blockingConflictCount: reviewConflicts.length,
    cancellationDisposition,
  });
  const sourceByField: Record<string, SesFieldSource> = {
    ...(snapshot.source_by_field && typeof snapshot.source_by_field === 'object' ? snapshot.source_by_field : {}),
  };
  for (const field of Array.isArray(draft.manual_fields) ? draft.manual_fields : []) {
    sourceByField[field] = 'manual';
  }
  for (const [relation, entity] of [
    ['holder', draft.holder],
    ['primary_driver', draft.primary_driver],
    ['secondary_driver', draft.secondary_driver],
    ['pickup_location', draft.pickup_location],
    ['return_location', draft.return_location],
  ] as const) {
    if (!entity || typeof entity !== 'object') continue;
    const manualFields = new Set(Array.isArray(entity.manual_fields) ? entity.manual_fields : []);
    for (const [field, value] of Object.entries(entity)) {
      if (!hasValue(value) || ['id', 'organization_id', 'created_at', 'updated_at'].includes(field)) continue;
      sourceByField[`${relation}.${field}`] = manualFields.has(field) ? 'manual' : 'rently';
    }
  }
  return {
    ...draft,
    operationalStatus: operational.status,
    readyForXml: operational.readyForXml,
    missingFields: operational.missingFields,
    invalidFields: operational.invalidFields,
    reviewConflicts,
    cancellationDisposition,
    sourceByField,
    syncConflicts: Array.isArray(snapshot.sync_conflicts) ? snapshot.sync_conflicts : [],
    sesDuplicateWarning: buildSesDuplicateWarning(draft.official_check_status, snapshot.official_reasons),
  };
}
