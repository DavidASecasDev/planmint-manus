export const SES_RENTLY_CANCELLED_STATUS = 4;

export type SesCancellationDispositionKind =
  | 'active_or_reactivated'
  | 'cancelled_not_applicable'
  | 'cancelled_requires_review'
  | 'source_status_unknown';

export type SesCancellationDisposition = {
  kind: SesCancellationDispositionKind;
  cancelled: boolean;
  notApplicableToDelivery: boolean;
  requiresReview: boolean;
  blocksXml: boolean;
  suppressMissingFields: boolean;
  reasonCode:
    | 'not_cancelled'
    | 'cancelled_without_delivery'
    | 'cancelled_with_delivery'
    | 'cancelled_with_official_history'
    | 'unknown_source_status';
  label: string;
};

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function normalizeStatusCode(value: unknown) {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

/**
 * A cancellation is derived only from an accredited Rently status code. A label
 * or a failed/unknown source never becomes a cancellation by assumption.
 */
export function deriveSesCancellationDisposition(input: {
  rentlyStatusCode?: unknown;
  actualDeliveryAt?: unknown;
  deliveryEvidenceReference?: unknown;
  officialCommunicationCount?: number | null;
  hasHistoricalBatchItem?: boolean;
}): SesCancellationDisposition {
  const statusCode = normalizeStatusCode(input.rentlyStatusCode);
  if (statusCode === null) {
    return {
      kind: 'source_status_unknown', cancelled: false, notApplicableToDelivery: false,
      requiresReview: true, blocksXml: true, suppressMissingFields: false,
      reasonCode: 'unknown_source_status',
      label: 'Estado Rently pendiente de comprobar',
    };
  }
  if (statusCode !== SES_RENTLY_CANCELLED_STATUS) {
    return {
      kind: 'active_or_reactivated', cancelled: false, notApplicableToDelivery: false,
      requiresReview: false, blocksXml: false, suppressMissingFields: false,
      reasonCode: 'not_cancelled', label: 'Flujo de entrega aplicable',
    };
  }

  const hasDeliveryFact = hasValue(input.actualDeliveryAt) || hasValue(input.deliveryEvidenceReference);
  const hasOfficialHistory = Number(input.officialCommunicationCount ?? 0) > 0 || input.hasHistoricalBatchItem === true;
  if (hasOfficialHistory) {
    return {
      kind: 'cancelled_requires_review', cancelled: true, notApplicableToDelivery: false,
      requiresReview: true, blocksXml: true, suppressMissingFields: true,
      reasonCode: 'cancelled_with_official_history',
      label: 'Cancelada · revisar resultado oficial',
    };
  }
  if (hasDeliveryFact) {
    return {
      kind: 'cancelled_requires_review', cancelled: true, notApplicableToDelivery: false,
      requiresReview: true, blocksXml: true, suppressMissingFields: true,
      reasonCode: 'cancelled_with_delivery',
      label: 'Cancelada · revisar entrega acreditada',
    };
  }
  return {
    kind: 'cancelled_not_applicable', cancelled: true, notApplicableToDelivery: true,
    requiresReview: false, blocksXml: true, suppressMissingFields: true,
    reasonCode: 'cancelled_without_delivery',
    label: 'Cancelada · no aplicable a entrega',
  };
}

export function mergeSesCancellationSnapshot(
  snapshot: Record<string, unknown> | null | undefined,
  disposition: SesCancellationDisposition,
  checkedAt: string,
) {
  return {
    ...(snapshot ?? {}),
    cancellation: {
      kind: disposition.kind,
      reason_code: disposition.reasonCode,
      label: disposition.label,
      checked_at: checkedAt,
    },
  };
}

export function buildSesCancellationReconciliation(input: {
  existing?: Record<string, any> | null;
  rentlyStatusCode?: unknown;
  actualDeliveryAt?: unknown;
  deliveryEvidenceReference?: unknown;
  officialCommunicationCount?: number | null;
  hasHistoricalBatchItem?: boolean;
  checkedAt: string;
}) {
  const disposition = deriveSesCancellationDisposition(input);
  if (disposition.kind === 'active_or_reactivated') return { disposition, changed: false, values: null };
  const existing = input.existing ?? null;
  const previousSnapshot = existing?.eligibility_snapshot && typeof existing.eligibility_snapshot === 'object'
    ? existing.eligibility_snapshot : {};
  const previousCancellation = previousSnapshot.cancellation && typeof previousSnapshot.cancellation === 'object'
    ? previousSnapshot.cancellation : {};
  const status = disposition.requiresReview ? 'needs_revision' : 'incomplete';
  const changed = !existing
    || previousCancellation.kind !== disposition.kind
    || previousCancellation.reason_code !== disposition.reasonCode
    || existing.is_eligible !== false
    || existing.ready_for_xml !== false
    || existing.status !== status;
  return {
    disposition,
    changed,
    values: {
      validation_errors: existing?.validation_errors ?? [],
      eligibility_snapshot: mergeSesCancellationSnapshot(previousSnapshot, disposition, input.checkedAt),
      is_complete: false,
      is_eligible: false,
      ready_for_xml: false,
      status,
      manual_fields: existing?.manual_fields ?? [],
      last_eligibility_checked_at: input.checkedAt,
      last_prepared_at: input.checkedAt,
    },
  };
}

export function findSesCancellationXmlBlocks<T extends {
  id?: unknown;
  reference?: unknown;
  cancellationDisposition?: SesCancellationDisposition | null;
}>(drafts: T[]) {
  return drafts.flatMap((draft) => draft.cancellationDisposition?.blocksXml ? [{
    id: draft.id ?? null,
    reference: draft.reference ?? null,
    disposition: draft.cancellationDisposition,
  }] : []);
}
