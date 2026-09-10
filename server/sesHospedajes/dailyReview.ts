export const SES_REVIEW_TIME_ZONE = 'Europe/Madrid';

export type SesReviewBatchStatus = 'queued' | 'running' | 'partial' | 'completed' | 'failed' | 'cancelled';
export type SesReviewItemStatus = 'pending' | 'verified_delivery' | 'missing_delivery_evidence' | 'outside_period' | 'date_mismatch' | 'evidence_conflict' | 'failed';
export type SesReviewSourceType = 'rently' | 'hubspot' | 'respond' | 'document';
export type SesReviewSourceStatus = 'pending' | 'consulted' | 'inaccessible';
export type SesReviewPhase = 'discover_deliveries' | 'fetch_details' | 'upsert_drafts' | 'await_external_sources' | 'completed';
export type SesReviewCandidateSource = 'event_scan' | 'actual_delivery' | 'planned_window';

export const SES_REVIEW_CANDIDATE_SOURCES: SesReviewCandidateSource[] = [
  'event_scan',
  'actual_delivery',
  'planned_window',
];

export type SesReviewCursor = { sourceIndex: number; offset: number };

export type SesDeliveryCandidate = {
  bookingId: number;
  actualDeliveryAt?: string | null;
  plannedFromAt?: string | null;
  actualDropoffAt?: string | null;
  evidenceReference?: string | null;
  evidenceGeneratedAt?: string | null;
};

const MAX_VISIBLE_EVIDENCE_DRIFT_MS = 999;

function comparableDateTime(value?: string | null) {
  if (!value) return null;
  const normalized = value.trim();
  const local = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|\s)(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?$/);
  if (local) {
    const milliseconds = Number(`0.${local[7] ?? '0'}`) * 1000;
    return {
      kind: 'local' as const,
      value: Date.UTC(Number(local[1]), Number(local[2]) - 1, Number(local[3]), Number(local[4]), Number(local[5]), Number(local[6]), Math.floor(milliseconds)),
    };
  }
  const parsed = new Date(normalized);
  return Number.isFinite(parsed.getTime()) ? { kind: 'instant' as const, value: parsed.getTime() } : null;
}

export function compareSesDeliveryEvidenceTimestamps(actualDeliveryAt?: string | null, evidenceGeneratedAt?: string | null) {
  const actual = comparableDateTime(actualDeliveryAt);
  const generated = comparableDateTime(evidenceGeneratedAt);
  if (!actual || !generated) return { consistent: false, comparable: false, driftMs: null };
  if (actual.kind !== generated.kind) return { consistent: false, comparable: false, driftMs: null };
  const driftMs = Math.abs(actual.value - generated.value);
  return { consistent: driftMs <= MAX_VISIBLE_EVIDENCE_DRIFT_MS, comparable: true, driftMs };
}

function localParts(date: Date, timeZone = SES_REVIEW_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, Number(part.value)]));
  return {
    year: parts.year, month: parts.month, day: parts.day,
    hour: parts.hour, minute: parts.minute, second: parts.second,
  };
}

function localDateString(date: Date, timeZone = SES_REVIEW_TIME_ZONE) {
  const parts = localParts(date, timeZone);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function zonedDateTimeToUtc(parts: {
  year: number; month: number; day: number; hour?: number; minute?: number; second?: number; millisecond?: number;
}, timeZone = SES_REVIEW_TIME_ZONE) {
  const millisecond = parts.millisecond ?? 0;
  const desiredUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0, 0);
  let guess = desiredUtc;
  for (let attempt = 0; attempt < 4; attempt++) {
    const observed = localParts(new Date(guess), timeZone);
    const observedAsUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute, observed.second);
    const next = guess + desiredUtc - observedAsUtc;
    if (next === guess) break;
    guess = next;
  }
  return new Date(guess + millisecond);
}

function sameLocalSecond(date: Date, expected: { year: number; month: number; day: number; hour: number; minute: number; second: number }) {
  const observed = localParts(date);
  return observed.year === expected.year && observed.month === expected.month && observed.day === expected.day
    && observed.hour === expected.hour && observed.minute === expected.minute && observed.second === expected.second;
}

export function normalizeRentlyDateTimeForStorage(value?: string | null) {
  if (!value) return { literal: null, normalizedAt: null, status: 'missing' as const };
  const literal = value.trim();
  const local = literal.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|\s)(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?$/);
  if (!local) {
    const instant = new Date(literal);
    return Number.isFinite(instant.getTime())
      ? { literal, normalizedAt: instant.toISOString(), status: 'explicit_instant' as const }
      : { literal, normalizedAt: null, status: 'invalid' as const };
  }
  const expected = {
    year: Number(local[1]), month: Number(local[2]), day: Number(local[3]),
    hour: Number(local[4]), minute: Number(local[5]), second: Number(local[6]),
  };
  const millisecond = Number(((local[7] ?? '') + '000').slice(0, 3));
  const candidate = zonedDateTimeToUtc({ ...expected, millisecond });
  if (!sameLocalSecond(candidate, expected)) {
    return { literal, normalizedAt: null, status: 'nonexistent_local_time' as const };
  }
  const alternativeBefore = new Date(candidate.getTime() - 3_600_000);
  const alternativeAfter = new Date(candidate.getTime() + 3_600_000);
  if (sameLocalSecond(alternativeBefore, expected) || sameLocalSecond(alternativeAfter, expected)) {
    return { literal, normalizedAt: null, status: 'ambiguous_local_time' as const };
  }
  return { literal, normalizedAt: candidate.toISOString(), status: 'madrid_local' as const };
}

export function assertSesReviewDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('La fecha de revisión debe usar YYYY-MM-DD');
  const [year, month, day] = value.split('-').map(Number);
  const normalized = new Date(Date.UTC(year, month - 1, day));
  if (normalized.getUTCFullYear() !== year || normalized.getUTCMonth() !== month - 1 || normalized.getUTCDate() !== day) {
    throw new Error('La fecha de revisión no es válida');
  }
  return value;
}

export function previousMadridDate(now = new Date()) {
  const current = assertSesReviewDate(localDateString(now));
  const [year, month, day] = current.split('-').map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}-${String(previous.getUTCDate()).padStart(2, '0')}`;
}

export function shiftSesReviewDate(reviewDate: string, days: number) {
  assertSesReviewDate(reviewDate);
  if (!Number.isInteger(days)) throw new Error('El desplazamiento de fecha debe ser entero');
  const [year, month, day] = reviewDate.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

export function getMadridDayRange(reviewDate: string) {
  assertSesReviewDate(reviewDate);
  const [year, month, day] = reviewDate.split('-').map(Number);
  const start = zonedDateTimeToUtc({ year, month, day });
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
  const end = zonedDateTimeToUtc({
    year: nextDate.getUTCFullYear(), month: nextDate.getUTCMonth() + 1, day: nextDate.getUTCDate(),
  });
  return { start: start.toISOString(), end: end.toISOString() };
}

export function getMadridPeriodRange(dateFrom: string, dateTo: string) {
  assertSesReviewDate(dateFrom);
  assertSesReviewDate(dateTo);
  if (dateTo < dateFrom) throw new Error('La fecha final no puede ser anterior a la inicial');
  return { start: getMadridDayRange(dateFrom).start, end: getMadridDayRange(dateTo).end };
}

export function madridDateOf(value?: string | null) {
  if (!value) return null;
  const normalized = value.trim();
  const localDateTime = normalized.match(/^(\d{4}-\d{2}-\d{2})(?:T|\s)\d{2}:\d{2}:\d{2}(?:\.\d+)?$/);
  if (localDateTime) return assertSesReviewDate(localDateTime[1]);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return assertSesReviewDate(normalized);
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? localDateString(date) : null;
}

export function classifyDeliveryForReview(candidate: SesDeliveryCandidate, reviewDate: string) {
  assertSesReviewDate(reviewDate);
  const actualDate = madridDateOf(candidate.actualDeliveryAt);
  if (!actualDate) {
    return {
      status: 'missing_delivery_evidence' as const,
      include: false,
      actualDeliveryAt: null,
      plannedDate: madridDateOf(candidate.plannedFromAt),
      actualDropoffAt: candidate.actualDropoffAt ?? null,
      evidenceReference: candidate.evidenceReference ?? null,
      evidenceGeneratedAt: candidate.evidenceGeneratedAt ?? null,
      reason: 'Rently no acredita DeliveryInfo.Date',
    };
  }
  if (actualDate !== reviewDate) {
    return {
      status: 'date_mismatch' as const,
      include: false,
      actualDeliveryAt: candidate.actualDeliveryAt ?? null,
      plannedDate: madridDateOf(candidate.plannedFromAt),
      actualDropoffAt: candidate.actualDropoffAt ?? null,
      evidenceReference: candidate.evidenceReference ?? null,
      evidenceGeneratedAt: candidate.evidenceGeneratedAt ?? null,
      reason: `La entrega real corresponde a ${actualDate}, no a ${reviewDate}`,
    };
  }
  const evidenceReference = candidate.evidenceReference?.trim() || null;
  const evidenceGeneratedAt = candidate.evidenceGeneratedAt ?? null;
  if (!evidenceReference || !evidenceGeneratedAt) {
    return {
      status: 'missing_delivery_evidence' as const,
      include: true,
      actualDeliveryAt: candidate.actualDeliveryAt ?? null,
      plannedDate: madridDateOf(candidate.plannedFromAt),
      actualDropoffAt: candidate.actualDropoffAt ?? null,
      evidenceReference,
      evidenceGeneratedAt,
      reason: 'DeliveryInfo.Date coincide, pero falta acreditar la referencia y generación del justificante Delivery',
    };
  }
  const timestampComparison = compareSesDeliveryEvidenceTimestamps(candidate.actualDeliveryAt, evidenceGeneratedAt);
  if (!timestampComparison.consistent) {
    return {
      status: 'evidence_conflict' as const,
      include: true,
      actualDeliveryAt: candidate.actualDeliveryAt ?? null,
      plannedDate: madridDateOf(candidate.plannedFromAt),
      actualDropoffAt: candidate.actualDropoffAt ?? null,
      evidenceReference,
      evidenceGeneratedAt,
      evidenceDriftMs: timestampComparison.driftMs,
      reason: timestampComparison.comparable
        ? 'La generación del justificante no coincide con la entrega real acreditada'
        : 'La generación del justificante y la entrega real no tienen marcas temporales comparables',
    };
  }
  return {
    status: 'verified_delivery' as const,
    include: true,
    actualDeliveryAt: candidate.actualDeliveryAt ?? null,
    plannedDate: madridDateOf(candidate.plannedFromAt),
    actualDropoffAt: candidate.actualDropoffAt ?? null,
    evidenceReference,
    evidenceGeneratedAt,
    evidenceDriftMs: timestampComparison.driftMs,
    reason: null,
  };
}

export function classifyDeliveryForPeriod(candidate: SesDeliveryCandidate, dateFrom: string, dateTo: string) {
  assertSesReviewDate(dateFrom);
  assertSesReviewDate(dateTo);
  const actualDate = madridDateOf(candidate.actualDeliveryAt);
  if (!actualDate) return classifyDeliveryForReview(candidate, dateTo);
  if (actualDate < dateFrom || actualDate > dateTo) {
    return {
      status: 'outside_period' as const,
      include: false,
      actualDeliveryAt: candidate.actualDeliveryAt ?? null,
      plannedDate: madridDateOf(candidate.plannedFromAt),
      actualDropoffAt: candidate.actualDropoffAt ?? null,
      evidenceReference: candidate.evidenceReference?.trim() || null,
      evidenceGeneratedAt: candidate.evidenceGeneratedAt ?? null,
      reason: `La entrega real ${actualDate} queda fuera del periodo ${dateFrom}–${dateTo}`,
    };
  }
  return classifyDeliveryForReview(candidate, actualDate);
}

export function dedupeDeliveryCandidates<T extends { bookingId: number }>(pages: T[][]) {
  const unique = new Map<number, T>();
  for (const page of pages) for (const candidate of page) unique.set(candidate.bookingId, candidate);
  return Array.from(unique.values());
}

export function advanceSesReviewCursor(input: {
  cursor: SesReviewCursor;
  pageLength: number;
  pageSize: number;
  sourceCount?: number;
}) {
  const sourceCount = input.sourceCount ?? SES_REVIEW_CANDIDATE_SOURCES.length;
  if (input.pageLength >= input.pageSize) {
    return { cursor: { sourceIndex: input.cursor.sourceIndex, offset: input.cursor.offset + input.pageLength }, complete: false };
  }
  const nextSource = input.cursor.sourceIndex + 1;
  return {
    cursor: { sourceIndex: nextSource, offset: 0 },
    complete: nextSource >= sourceCount,
  };
}

export function canApplySesReviewField(input: {
  field: string;
  manualFields?: string[] | null;
  currentValue: unknown;
  incomingValue: unknown;
}) {
  if (input.manualFields?.includes(input.field)) return false;
  if (input.incomingValue === null || input.incomingValue === undefined || input.incomingValue === '') return false;
  return input.currentValue === null || input.currentValue === undefined || input.currentValue === '';
}

export function evaluateSesReviewFieldUpdate(input: {
  field: string;
  manualFields?: string[] | null;
  currentValue: unknown;
  incomingValue: unknown;
}) {
  const incomingEmpty = input.incomingValue === null || input.incomingValue === undefined || input.incomingValue === '';
  if (incomingEmpty) return { action: 'ignored_empty' as const, conflict: null };
  if (input.currentValue === input.incomingValue) return { action: 'unchanged' as const, conflict: null };
  const currentEmpty = input.currentValue === null || input.currentValue === undefined || input.currentValue === '';
  if (currentEmpty && !input.manualFields?.includes(input.field)) return { action: 'apply' as const, conflict: null };
  return {
    action: 'conflict' as const,
    conflict: {
      field: input.field,
      currentValue: input.currentValue,
      proposedValue: input.incomingValue,
      protectedManual: Boolean(input.manualFields?.includes(input.field)),
    },
  };
}

function sameDateTimeValue(left?: unknown, right?: unknown) {
  if (left === null || left === undefined || right === null || right === undefined) return false;
  if (String(left) === String(right)) return true;
  const leftTime = new Date(String(left)).getTime();
  const rightTime = new Date(String(right)).getTime();
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

export function evaluateSesPickupAtMigration(input: {
  field?: 'pickup_at' | 'return_at';
  currentPickupAt?: unknown;
  reservationPlannedAt?: unknown;
  rentlyPlannedAt?: unknown;
  actualDeliveryAt?: unknown;
  manualFields?: string[] | null;
  currentSource?: string | null;
}) {
  if (input.actualDeliveryAt === null || input.actualDeliveryAt === undefined || input.actualDeliveryAt === '') {
    return { action: 'missing_actual_delivery' as const, previousValue: input.currentPickupAt ?? null };
  }
  if (sameDateTimeValue(input.currentPickupAt, input.actualDeliveryAt)) {
    return { action: 'unchanged' as const, previousValue: input.currentPickupAt ?? null };
  }
  const field = input.field ?? 'pickup_at';
  if (input.manualFields?.includes(field)) {
    return { action: 'conflict' as const, reason: 'manual', previousValue: input.currentPickupAt ?? null };
  }
  const currentEmpty = input.currentPickupAt === null || input.currentPickupAt === undefined || input.currentPickupAt === '';
  const explicitAutomaticSource = ['rently_planned', 'reservation_planned', 'rently_detail'].includes(input.currentSource ?? '');
  const matchesAutomaticPlan = sameDateTimeValue(input.currentPickupAt, input.reservationPlannedAt)
    || sameDateTimeValue(input.currentPickupAt, input.rentlyPlannedAt);
  if (currentEmpty || explicitAutomaticSource || matchesAutomaticPlan) {
    return {
      action: 'apply_actual_delivery' as const,
      previousValue: input.currentPickupAt ?? null,
      provedBy: currentEmpty ? 'empty' : explicitAutomaticSource ? 'source' : 'planned_value_match',
    };
  }
  return { action: 'conflict' as const, reason: 'unknown_provenance', previousValue: input.currentPickupAt ?? null };
}

const SES_IDENTITY_LICENCE_FIELDS = [
  'document_type', 'document_number', 'first_name', 'first_surname',
  'licence_type', 'licence_number', 'licence_valid_until', 'licence_country_code',
] as const;

function normalizedComparable(value: unknown) {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function analyzeSesIdentityLicenceContradictions(input: {
  current: Record<string, unknown>;
  proposed?: Record<string, unknown> | null;
  source: 'rently' | 'hubspot' | 'respond' | 'document';
  manualFields?: string[] | null;
}) {
  const proposed = input.proposed ?? {};
  const manual = new Set(input.manualFields ?? []);
  const missingFields: string[] = [];
  const conflicts: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  const addConflict = (conflict: Record<string, unknown>) => {
    const key = `${conflict.field}:${conflict.code}:${normalizedComparable(conflict.proposedValue)}`;
    if (!seen.has(key)) {
      seen.add(key);
      conflicts.push(conflict);
    }
  };

  for (const field of SES_IDENTITY_LICENCE_FIELDS) {
    const currentValue = input.current[field];
    const proposedValue = proposed[field];
    if (!normalizedComparable(currentValue)) missingFields.push(field);
    if (normalizedComparable(currentValue) && normalizedComparable(proposedValue)
      && normalizedComparable(currentValue) !== normalizedComparable(proposedValue)) {
      addConflict({
        field,
        code: 'accredited_value_mismatch',
        currentValue,
        proposedValue,
        source: input.source,
        protectedManual: manual.has(field),
      });
    }
  }

  if (normalizedComparable(input.current.first_name)
    && normalizedComparable(input.current.first_name) === normalizedComparable(input.current.first_surname)) {
    addConflict({
      field: 'first_surname',
      code: 'duplicated_full_name',
      currentValue: input.current.first_surname,
      proposedValue: proposed.first_surname ?? null,
      source: input.source,
      protectedManual: manual.has('first_surname'),
    });
  }

  if (normalizedComparable(input.current.document_number)
    && normalizedComparable(input.current.document_number) === normalizedComparable(input.current.licence_number)) {
    addConflict({
      field: 'licence_number',
      code: 'identity_document_copied_as_licence',
      currentValue: input.current.licence_number,
      proposedValue: proposed.licence_number ?? null,
      source: input.source,
      protectedManual: manual.has('licence_number'),
    });
  }

  const currentDocument = normalizedComparable(input.current.document_number);
  const proposedDocument = normalizedComparable(proposed.document_number);
  if (currentDocument && proposedDocument && currentDocument.length === proposedDocument.length) {
    const differences = currentDocument.split('').filter((character, index) => character !== proposedDocument[index]).length;
    if (differences === 1) {
      addConflict({
        field: 'document_number',
        code: 'single_character_document_mismatch',
        currentValue: input.current.document_number,
        proposedValue: proposed.document_number,
        source: input.source,
        protectedManual: manual.has('document_number'),
      });
    }
  }

  return { missingFields: Array.from(new Set(missingFields)), conflicts, blocksReadyForXml: conflicts.length > 0 };
}

export const SES_REVIEW_PROPOSAL_FIELDS = {
  draft: [
    'reference', 'contract_date', 'pickup_at', 'return_at', 'payment_type', 'payment_date',
    'payment_medium', 'payment_holder', 'card_expiry', 'vehicle_category', 'vehicle_type',
    'vehicle_brand', 'vehicle_model', 'vehicle_plate', 'vehicle_vin', 'vehicle_color',
    'km_pickup', 'km_return', 'gps_data',
  ],
  person: [
    'document_type', 'document_number', 'first_name', 'first_surname', 'second_surname',
    'birth_date', 'nationality_code', 'sex', 'address_line', 'address_number',
    'address_complement', 'municipality_code', 'municipality_name', 'postal_code',
    'country_code', 'phone', 'phone_secondary', 'email', 'licence_type',
    'licence_valid_until', 'licence_number', 'licence_support', 'licence_country_code',
  ],
  pickup_location: [
    'name', 'use_establishment_code', 'establishment_code', 'address_line', 'address_complement',
    'municipality_code', 'municipality_name', 'postal_code', 'country_code', 'latitude', 'longitude', 'verified',
  ],
  return_location: [
    'name', 'use_establishment_code', 'establishment_code', 'address_line', 'address_complement',
    'municipality_code', 'municipality_name', 'postal_code', 'country_code', 'latitude', 'longitude', 'verified',
  ],
} as const;

export type SesReviewProposalTargetType = keyof typeof SES_REVIEW_PROPOSAL_FIELDS;

export function assertSesReviewProposalTarget(input: {
  targetType: SesReviewProposalTargetType;
  targetId: string;
  draft: Record<string, unknown>;
}) {
  const expected = input.targetType === 'draft' ? input.draft.id
    : input.targetType === 'person'
      ? [input.draft.holder_profile_id, input.draft.primary_driver_profile_id, input.draft.secondary_driver_profile_id]
      : input.targetType === 'pickup_location' ? input.draft.pickup_location_id : input.draft.return_location_id;
  const linked = Array.isArray(expected) ? expected.includes(input.targetId) : expected === input.targetId;
  if (!linked) throw new Error('El destinatario de la propuesta no está vinculado al expediente SES');
  return SES_REVIEW_PROPOSAL_FIELDS[input.targetType];
}

const SES_DRAFT_PERSISTED_COLUMNS = [
  'id', 'organization_id', 'reservation_id', 'external_booking_id', 'reference', 'status',
  'contract_date', 'pickup_at', 'return_at', 'pickup_location_id', 'return_location_id',
  'holder_profile_id', 'primary_driver_profile_id', 'secondary_driver_profile_id',
  'payment_type', 'payment_date', 'payment_medium', 'payment_holder', 'card_expiry',
  'vehicle_category', 'vehicle_type', 'vehicle_brand', 'vehicle_model', 'vehicle_plate',
  'vehicle_vin', 'vehicle_color', 'km_pickup', 'km_return', 'gps_data', 'validation_errors',
  'content_hash', 'draft_version', 'manual_fields', 'last_prepared_at', 'accepted_at',
  'created_by', 'updated_by', 'created_at', 'updated_at', 'is_complete', 'is_eligible',
  'is_officially_clear', 'ready_for_xml', 'eligibility_errors', 'eligibility_snapshot',
  'official_check_status', 'last_eligibility_checked_at', 'document_version',
  'planned_pickup_literal', 'planned_pickup_at', 'actual_delivery_literal', 'actual_delivery_at',
  'pickup_at_source', 'planned_return_literal', 'planned_return_at', 'actual_dropoff_literal',
  'actual_dropoff_at', 'return_at_source',
] as const;

export function projectSesDraftPersistence(input?: Record<string, unknown> | null) {
  const result: Record<string, unknown> = {};
  if (!input) return result;
  for (const column of SES_DRAFT_PERSISTED_COLUMNS) {
    if (Object.prototype.hasOwnProperty.call(input, column)) result[column] = input[column];
  }
  return result;
}

export function planSesReviewProposalApplication(input: {
  currentValues: Record<string, unknown>;
  proposedValues: Record<string, unknown>;
  manualFields?: string[] | null;
  allowedFields: readonly string[];
}) {
  const appliedChanges: Record<string, unknown> = {};
  const conflicts: Array<Record<string, unknown>> = [];
  const ignoredFields: string[] = [];
  for (const field of Object.keys(input.proposedValues)) {
    if (!input.allowedFields.includes(field)) {
      ignoredFields.push(field);
      continue;
    }
    const decision = evaluateSesReviewFieldUpdate({
      field,
      manualFields: input.manualFields,
      currentValue: input.currentValues[field],
      incomingValue: input.proposedValues[field],
    });
    if (decision.action === 'apply') appliedChanges[field] = input.proposedValues[field];
    else if (decision.action === 'conflict' && decision.conflict) conflicts.push(decision.conflict);
    else if (decision.action === 'ignored_empty') ignoredFields.push(field);
  }
  return { appliedChanges, conflicts, ignoredFields };
}

export function getSesReviewConflictKey(conflict: Record<string, unknown>) {
  if (typeof conflict.conflictKey === 'string' && conflict.conflictKey) return conflict.conflictKey;
  const targetId = conflict.targetType === 'draft' ? null : conflict.targetId ?? null;
  return JSON.stringify([
    conflict.targetType ?? null,
    targetId,
    conflict.field ?? null,
    conflict.code ?? null,
    conflict.currentValue ?? null,
    conflict.proposedValue ?? null,
    conflict.source ?? null,
    conflict.evidenceReference ?? null,
  ]);
}

export function isSesReviewConflictOpen(conflict: Record<string, unknown>) {
  return conflict.status !== 'resolved';
}

export function resolveSesReviewConflictHistory(input: {
  conflicts: Array<Record<string, unknown>>;
  conflictKey: string;
  currentValue: unknown;
  actorId: string;
  reason: string;
  evidenceReference?: string | null;
  resolvedAt: string;
}) {
  let resolved = false;
  const conflicts = input.conflicts.map((raw) => {
    const conflict: Record<string, unknown> = {
      ...raw,
      conflictKey: getSesReviewConflictKey(raw),
      status: raw.status ?? 'open',
    };
    if (conflict.conflictKey !== input.conflictKey || !isSesReviewConflictOpen(conflict)) return conflict;
    if (!normalizedComparable(input.currentValue)) throw new Error('El valor actual sigue vacío y no permite resolver la contradicción');
    if (normalizedComparable(input.currentValue) === normalizedComparable(conflict.currentValue)) {
      throw new Error('El valor actual no ha cambiado desde que se detectó la contradicción');
    }
    resolved = true;
    return {
      ...conflict,
      status: 'resolved',
      resolvedValue: input.currentValue,
      resolvedAt: input.resolvedAt,
      resolvedBy: input.actorId,
      resolutionReason: input.reason,
      resolutionEvidenceReference: input.evidenceReference ?? null,
    };
  });
  if (!resolved) throw new Error('La contradicción abierta no existe o ya fue resuelta');
  return { conflicts, openConflicts: conflicts.filter(isSesReviewConflictOpen) };
}

export function mergeSesReviewItemHistory(input: {
  existingApplied?: Record<string, unknown> | null;
  existingProposed?: Record<string, unknown> | null;
  existingConflicts?: Array<Record<string, unknown>> | null;
  incomingApplied?: Record<string, unknown> | null;
  incomingProposed?: Record<string, unknown> | null;
  incomingConflicts?: Array<Record<string, unknown>> | null;
}) {
  const conflictMap = new Map<string, Record<string, unknown>>();
  for (const rawConflict of input.existingConflicts ?? []) {
    const conflict = {
      ...rawConflict,
      conflictKey: getSesReviewConflictKey(rawConflict),
      status: rawConflict.status ?? 'open',
    };
    conflictMap.set(conflict.conflictKey as string, conflict);
  }
  for (const rawConflict of input.incomingConflicts ?? []) {
    const conflict = {
      ...rawConflict,
      conflictKey: getSesReviewConflictKey(rawConflict),
      status: rawConflict.status ?? 'open',
    };
    const existing = conflictMap.get(conflict.conflictKey as string);
    if (existing?.status === 'resolved') continue;
    conflictMap.set(conflict.conflictKey as string, conflict);
  }
  return {
    appliedChanges: { ...(input.existingApplied ?? {}), ...(input.incomingApplied ?? {}) },
    proposedChanges: { ...(input.existingProposed ?? {}), ...(input.incomingProposed ?? {}) },
    conflicts: Array.from(conflictMap.values()),
  };
}

export function missingSesReviewSources(existingSources: readonly string[]) {
  const existing = new Set(existingSources);
  return (['rently', 'hubspot', 'respond', 'document'] as const).filter((source) => !existing.has(source));
}

export function evaluateSesReviewCoverageGuarantee(input: {
  syncStatus?: string | null;
  coverageVersion?: string | null;
  coverageScope?: Record<string, unknown> | null;
  periodEnd: string;
}) {
  if (input.syncStatus !== 'completed') {
    return { complete: false, token: input.coverageVersion ?? 'no-coverage-version', reason: 'La sincronización Rently no ha terminado' };
  }
  const scope = input.coverageScope ?? {};
  const guarantees = [
    ['sourceEndpoint', 'La cobertura no procede del listado oficial de reservas Rently'],
    ['allBranches', 'No se han acreditado todas las sedes'],
    ['allStatuses', 'No se han acreditado todos los estados'],
    ['paginationComplete', 'No se ha acreditado el final de la paginación'],
  ] as const;
  for (const [key, reason] of guarantees) {
    const expected = key === 'sourceEndpoint' ? '/api/bookings/list' : true;
    if (scope[key] !== expected) return { complete: false, token: input.coverageVersion ?? 'no-coverage-version', reason };
  }
  if (scope.unfilteredDateWindow !== true) {
    return { complete: false, token: input.coverageVersion ?? 'no-coverage-version', reason: 'La ventana temporal del listado estaba filtrada' };
  }
  if (scope.bookingListEventsComplete !== true || scope.deliveryEventsComplete !== true || scope.dropoffEventsComplete !== true) {
    return { complete: false, token: input.coverageVersion ?? 'no-coverage-version', reason: 'No se han acreditado todos los eventos de entrega y devolución del listado' };
  }
  if (Number(scope.paginationStartOffset) !== 0 || scope.nextOffset !== null) {
    return { complete: false, token: input.coverageVersion ?? 'no-coverage-version', reason: 'La paginación acreditada no recorre el listado completo desde el offset cero' };
  }
  const coveredThrough = typeof scope.coveredThrough === 'string' ? Date.parse(scope.coveredThrough) : Number.NaN;
  if (!Number.isFinite(coveredThrough) || coveredThrough < Date.parse(input.periodEnd)) {
    return { complete: false, token: input.coverageVersion ?? 'no-coverage-version', reason: 'El alcance acreditado no cubre el final del periodo revisado' };
  }
  return { complete: true, token: input.coverageVersion ?? 'coverage-without-version', reason: null };
}

export function shouldRediscoverSesReview(input: {
  pagesComplete: boolean;
  coverageComplete: boolean;
  previousCoverageToken?: string | null;
  currentCoverageToken: string;
}) {
  return input.pagesComplete
    && input.previousCoverageToken !== input.currentCoverageToken;
}

export function isSesReviewItemRetryable(input: {
  status: SesReviewItemStatus;
  nextRetryAt?: string | null;
  evidenceReference?: string | null;
  evidenceGeneratedLiteral?: string | null;
  now?: number;
}) {
  if (input.status === 'failed') {
    if (!input.nextRetryAt) return true;
    const retryAt = new Date(input.nextRetryAt).getTime();
    return Number.isFinite(retryAt) && retryAt <= (input.now ?? Date.now());
  }
  return ['missing_delivery_evidence', 'evidence_conflict'].includes(input.status)
    && Boolean(input.evidenceReference?.trim())
    && Boolean(input.evidenceGeneratedLiteral?.trim());
}

export function deriveSesReviewBatchStatus(input: {
  pagesComplete: boolean;
  unresolvedItems: number;
  sources: Array<{ status: SesReviewSourceStatus }>;
  failed?: boolean;
}): SesReviewBatchStatus {
  if (input.failed) return 'failed';
  if (!input.pagesComplete) return 'running';
  if (input.unresolvedItems > 0 || input.sources.some((source) => source.status !== 'consulted')) return 'partial';
  return 'completed';
}

export function buildSesReviewProgress(input: {
  phase: SesReviewPhase;
  discovered: number;
  processed: number;
  total: number | null;
  cursor: number | null;
  pagesComplete: boolean;
}) {
  const boundedProcessed = input.total === null ? input.processed : Math.min(input.processed, input.total);
  return {
    phase: input.phase,
    discovered: Math.max(0, input.discovered),
    processed: Math.max(0, boundedProcessed),
    total: input.total,
    cursor: input.cursor,
    pagesComplete: input.pagesComplete,
    coverageComplete: input.pagesComplete && input.total !== null && boundedProcessed >= input.total,
  };
}
