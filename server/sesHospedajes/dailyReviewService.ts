import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchBookingDetail, getRentlyToken, type RentlyBookingDetail } from '../syncRently';
import {
  SES_REVIEW_CANDIDATE_SOURCES,
  advanceSesReviewCursor,
  buildSesReviewProgress,
  classifyDeliveryForPeriod,
  deriveSesReviewBatchStatus,
  evaluateSesReviewCoverageGuarantee,
  getMadridPeriodRange,
  getSesReviewConflictKey,
  isSesReviewConflictOpen,
  isSesReviewItemRetryable,
  mergeSesReviewItemHistory,
  missingSesReviewSources,
  normalizeRentlyDateTimeForStorage,
  shouldRediscoverSesReview,
  shiftSesReviewDate,
  type SesReviewCandidateSource,
  type SesReviewCursor,
  type SesReviewSourceStatus,
} from './dailyReview';

export const SES_REVIEW_PAGE_SIZE = 50;

export async function executeWithSesReviewLease<TBatch, TResult>(input: {
  claim: () => Promise<TBatch | null>;
  execute: (batch: TBatch) => Promise<TResult>;
}) {
  const batch = await input.claim();
  if (!batch) return { executed: false as const, result: null };
  return { executed: true as const, result: await input.execute(batch) };
}

export type SesReviewBatchRow = {
  id: string;
  organization_id: string;
  review_date: string;
  period_start: string;
  period_end: string;
  batch_kind: 'daily' | 'historical';
  source_channel: 'manual' | 'heartbeat' | 'historical';
  status: 'queued' | 'running' | 'partial' | 'completed' | 'failed' | 'cancelled';
  phase: string;
  cursor: Record<string, unknown> | null;
  progress?: Record<string, unknown> | null;
  pages_complete: boolean;
  coverage_complete: boolean;
  historical_from?: string | null;
  historical_to?: string | null;
  started_at?: string | null;
  attempt_count?: number | null;
  lease_token?: string | null;
  lease_expires_at?: string | null;
};

export type SesReviewReservationRow = Record<string, unknown> & {
  id: string | null;
  organization_id: string;
  external_reservation_id: string | number | null;
  desde?: string | null;
  hasta?: string | null;
  rently_creation_date?: string | null;
  rently_detail_synced_at?: string | null;
  rently_delivery_actual_literal?: string | null;
  rently_delivery_actual_at?: string | null;
  rently_dropoff_actual_literal?: string | null;
  rently_dropoff_actual_at?: string | null;
  rently_list_updated_literal?: string | null;
  rently_list_updated_at?: string | null;
  rently_status_code?: number | null;
  imported_by?: string | null;
};

export type SesReviewDraftResult = {
  draftId: string | null;
  appliedChanges: Record<string, unknown>;
  proposedChanges: Record<string, unknown>;
  conflicts: Array<Record<string, unknown>>;
};

export type PrepareVerifiedSesDraft = (input: {
  reservation: SesReviewReservationRow;
  detail: RentlyBookingDetail;
  assertLease: () => Promise<void>;
  batchId: string;
  leaseToken: string;
  existingConflicts: Array<Record<string, unknown>>;
}) => Promise<SesReviewDraftResult>;

export class SesReviewLeaseLostError extends Error {
  constructor() {
    super('El ejecutor perdió el lease del lote antes de guardar');
    this.name = 'SesReviewLeaseLostError';
  }
}

export function createSesReviewLeaseGuard(
  serviceClient: SupabaseClient,
  organizationId: string,
  batchId: string,
  leaseToken: string,
) {
  return async () => {
    const { data, error } = await serviceClient.rpc('renew_ses_review_batch_lease', {
      p_organization_id: organizationId,
      p_batch_id: batchId,
      p_lease_token: leaseToken,
      p_lease_seconds: 110,
    });
    if (error) throw error;
    if (data !== true) throw new SesReviewLeaseLostError();
  };
}

const RESERVATION_FIELDS = [
  'id', 'organization_id', 'external_reservation_id', 'rently_creation_date', 'estado', 'desde', 'hasta',
  'cliente_nombre', 'cliente_apellido', 'email', 'telefono', 'tipo_documento_cliente', 'documento_cliente',
  'cliente_direccion', 'cliente_ciudad', 'cliente_estado_provincia', 'cliente_pais', 'cliente_fecha_nacimiento',
  'cliente_carnet_numero', 'cliente_carnet_pais', 'cliente_carnet_expiracion', 'conductores_adicionales',
  'lugar_entrega', 'lugar_entrega_direccion', 'lugar_entrega_ciudad',
  'lugar_devolucion', 'lugar_devolucion_direccion', 'lugar_devolucion_ciudad',
  'modelo', 'auto', 'categoria', 'vehiculo_color', 'vehiculo_chasis', 'vehiculo_kms', 'imported_by',
  'rently_status_code', 'es_transferencia', 'rently_delivery_branch_office_id',
  'rently_delivery_actual_literal', 'rently_delivery_actual_at',
  'rently_dropoff_actual_literal', 'rently_dropoff_actual_at',
  'rently_list_updated_literal', 'rently_list_updated_at',
  'rently_detail_booking_id', 'rently_detail_vehicle_plate', 'rently_detail_synced_at',
].join(',');

function parseCursor(raw: Record<string, unknown> | null | undefined): SesReviewCursor {
  const sourceIndex = Number(raw?.sourceIndex ?? 0);
  const offset = Number(raw?.offset ?? 0);
  return {
    sourceIndex: Number.isInteger(sourceIndex) && sourceIndex >= 0 ? sourceIndex : 0,
    offset: Number.isInteger(offset) && offset >= 0 ? offset : 0,
  };
}

export function buildSesReviewCandidateWindow(batch: SesReviewBatchRow) {
  const dateFrom = batch.batch_kind === 'historical' && batch.historical_from
    ? batch.historical_from
    : batch.review_date;
  const dateTo = batch.batch_kind === 'historical' && batch.historical_to
    ? batch.historical_to
    : batch.review_date;
  return {
    dateFrom,
    dateTo,
    planned: getMadridPeriodRange(shiftSesReviewDate(dateFrom, -1), shiftSesReviewDate(dateTo, 2)),
  };
}

async function fetchCandidatePage(
  serviceClient: SupabaseClient,
  batch: SesReviewBatchRow,
  source: SesReviewCandidateSource,
  offset: number,
  pageSize = SES_REVIEW_PAGE_SIZE,
) {
  const window = buildSesReviewCandidateWindow(batch);
  if (source === 'event_scan') {
    const { data, error } = await serviceClient.from('rently_booking_events').select([
      'external_booking_id', 'reservation_id', 'current_status', 'updated_literal', 'updated_at',
      'planned_from_literal', 'planned_from_at', 'planned_to_literal', 'planned_to_at',
      'delivery_actual_literal', 'delivery_actual_at', 'dropoff_actual_literal', 'dropoff_actual_at',
    ].join(','))
      .eq('organization_id', batch.organization_id)
      .gte('delivery_actual_at', batch.period_start).lt('delivery_actual_at', batch.period_end)
      .order('external_booking_id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const events = (data ?? []) as unknown as Array<Record<string, unknown>>;
    const externalIds = events.map((event) => String(event.external_booking_id));
    const { data: linkedData, error: linkedError } = externalIds.length
      ? await serviceClient.from('reservations').select(RESERVATION_FIELDS)
        .eq('organization_id', batch.organization_id).in('external_reservation_id', externalIds)
      : { data: [], error: null };
    if (linkedError) throw linkedError;
    const linkedByExternalId = new Map(((linkedData ?? []) as unknown as SesReviewReservationRow[])
      .map((reservation) => [String(reservation.external_reservation_id), reservation]));
    return events.map((event) => ({
      ...(linkedByExternalId.get(String(event.external_booking_id)) ?? {}),
      id: linkedByExternalId.get(String(event.external_booking_id))?.id ?? event.reservation_id ?? null,
      organization_id: batch.organization_id,
      external_reservation_id: event.external_booking_id,
      desde: event.planned_from_literal ?? event.planned_from_at ?? null,
      hasta: event.planned_to_literal ?? event.planned_to_at ?? null,
      rently_status_code: event.current_status ?? null,
      rently_delivery_actual_literal: event.delivery_actual_literal ?? null,
      rently_delivery_actual_at: event.delivery_actual_at ?? null,
      rently_dropoff_actual_literal: event.dropoff_actual_literal ?? null,
      rently_dropoff_actual_at: event.dropoff_actual_at ?? null,
      rently_list_updated_literal: event.updated_literal ?? null,
      rently_list_updated_at: event.updated_at ?? null,
    })) as SesReviewReservationRow[];
  }
  let query = serviceClient.from('reservations').select(RESERVATION_FIELDS)
    .eq('organization_id', batch.organization_id)
    .not('external_reservation_id', 'is', null)
    .order('external_reservation_id', { ascending: true })
    .range(offset, offset + pageSize - 1);

  if (source === 'actual_delivery') {
    query = query.gte('rently_delivery_actual_at', batch.period_start).lt('rently_delivery_actual_at', batch.period_end);
  } else {
    query = query.gte('desde', window.planned.start).lt('desde', window.planned.end);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as SesReviewReservationRow[];
}

async function loadRentlyCredentials(serviceClient: SupabaseClient, organizationId: string) {
  const { data, error } = await serviceClient.from('integration_settings')
    .select('rently_api_host,rently_client_id,rently_client_secret')
    .eq('organization_id', organizationId).maybeSingle();
  if (error || !data?.rently_client_id || !data?.rently_client_secret) {
    throw new Error('No se puede continuar la revisión: la integración Rently de la organización no está disponible');
  }
  return {
    host: data.rently_api_host || 'azul.rently.com.ar',
    clientId: data.rently_client_id,
    clientSecret: data.rently_client_secret,
  };
}

type ExistingReviewSource = {
  source: 'rently' | 'hubspot' | 'respond' | 'document';
  status: SesReviewSourceStatus;
  evidence_reference: string | null;
  observed_at: string | null;
  proposed_changes: Record<string, unknown> | null;
  error_summary: string | null;
};

type ExistingReviewItem = {
  id: string;
  evidence_reference: string | null;
  evidence_generated_literal: string | null;
  evidence_generated_at: string | null;
  delivery_actual_literal: string | null;
  draft_id: string | null;
  proposed_changes: Record<string, unknown> | null;
  applied_changes: Record<string, unknown> | null;
  conflicts: Array<Record<string, unknown>> | null;
  retry_count: number | null;
  sources: ExistingReviewSource[] | null;
};

async function writeSource(input: {
  serviceClient: SupabaseClient;
  organizationId: string;
  batchId: string;
  itemId: string;
  source: 'rently' | 'hubspot' | 'respond' | 'document';
  status: SesReviewSourceStatus;
  observedAt?: string | null;
  evidenceReference?: string | null;
  errorSummary?: string | null;
  updatedBy?: string | null;
}) {
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    batch_id: input.batchId,
    item_id: input.itemId,
    source: input.source,
    status: input.status,
    updated_by: input.updatedBy ?? null,
  };
  if (input.observedAt !== undefined) row.observed_at = input.observedAt;
  if (input.evidenceReference !== undefined) row.evidence_reference = input.evidenceReference;
  if (input.errorSummary !== undefined) row.error_summary = input.errorSummary;
  const { error } = await input.serviceClient.from('ses_review_item_sources').upsert(row, { onConflict: 'item_id,source' });
  if (error) throw error;
}

async function initializeMissingSources(input: {
  serviceClient: SupabaseClient;
  organizationId: string;
  batchId: string;
  itemId: string;
  existingSources: ExistingReviewSource[];
  updatedBy: string | null;
}) {
  const missing = missingSesReviewSources(input.existingSources.map((source) => source.source));
  if (!missing.length) return;
  const { error } = await input.serviceClient.from('ses_review_item_sources').insert(missing.map((source) => ({
    organization_id: input.organizationId,
    batch_id: input.batchId,
    item_id: input.itemId,
    source,
    status: 'pending',
    updated_by: input.updatedBy,
  })));
  if (error) throw error;
}

async function existingEvidence(serviceClient: SupabaseClient, batchId: string, bookingId: number) {
  const { data, error } = await serviceClient.from('ses_review_items')
    .select(`
      id,evidence_reference,evidence_generated_literal,evidence_generated_at,delivery_actual_literal,draft_id,
      proposed_changes,applied_changes,conflicts,retry_count,
      sources:ses_review_item_sources(source,status,evidence_reference,observed_at,proposed_changes,error_summary)
    `)
    .eq('batch_id', batchId).eq('external_booking_id', bookingId).maybeSingle();
  if (error) throw error;
  return data as unknown as ExistingReviewItem | null;
}

async function saveReviewItem(
  serviceClient: SupabaseClient,
  existing: ExistingReviewItem | null,
  values: Record<string, unknown>,
) {
  if (existing) {
    const { data, error } = await serviceClient.from('ses_review_items').update(values).eq('id', existing.id).select('id').single();
    if (error) throw error;
    return data as { id: string };
  }
  const { data, error } = await serviceClient.from('ses_review_items').insert(values).select('id').single();
  if (error) throw error;
  return data as { id: string };
}

async function processCandidate(input: {
  serviceClient: SupabaseClient;
  batch: SesReviewBatchRow;
  reservation: SesReviewReservationRow;
  host: string;
  token: string;
  actorUserId: string | null;
  prepareVerifiedDraft?: PrepareVerifiedSesDraft;
  assertLease: () => Promise<void>;
  leaseToken: string;
}) {
  const bookingId = Number(input.reservation.external_reservation_id);
  if (!Number.isSafeInteger(bookingId) || bookingId <= 0) return { processed: false, verified: false };
  const existing = await existingEvidence(input.serviceClient, input.batch.id, bookingId);
  const observedAt = new Date().toISOString();
  const planned = normalizeRentlyDateTimeForStorage(input.reservation.desde ?? null);
  const delivery = normalizeRentlyDateTimeForStorage(
    input.reservation.rently_delivery_actual_literal ?? input.reservation.rently_delivery_actual_at ?? null,
  );
  const dropoff = normalizeRentlyDateTimeForStorage(
    input.reservation.rently_dropoff_actual_literal ?? input.reservation.rently_dropoff_actual_at ?? null,
  );
  const evidence = classifyDeliveryForPeriod({
    bookingId,
    plannedFromAt: planned.literal,
    actualDeliveryAt: delivery.literal,
    actualDropoffAt: dropoff.literal,
    evidenceReference: existing?.evidence_reference ?? null,
    evidenceGeneratedAt: existing?.evidence_generated_literal ?? null,
  },
  input.batch.batch_kind === 'historical' && input.batch.historical_from ? input.batch.historical_from : input.batch.review_date,
  input.batch.batch_kind === 'historical' && input.batch.historical_to ? input.batch.historical_to : input.batch.review_date);
  const deliveryNormalizationConflict = ['invalid', 'nonexistent_local_time', 'ambiguous_local_time'].includes(delivery.status);
  const needsDetail = evidence.status === 'verified_delivery' && Boolean(input.prepareVerifiedDraft);
  const missingReservation = !input.reservation.id;
  const detail = needsDetail ? await fetchBookingDetail(input.host, input.token, bookingId) : null;
  if (needsDetail && !detail) {
    await input.assertLease();
    const item = await saveReviewItem(input.serviceClient, existing, {
      organization_id: input.batch.organization_id,
      batch_id: input.batch.id,
      external_booking_id: bookingId,
      reservation_id: input.reservation.id,
      draft_id: existing?.draft_id ?? null,
      status: 'failed',
      planned_from_literal: planned.literal,
      planned_from_at: planned.normalizedAt,
      delivery_actual_literal: delivery.literal,
      delivery_actual_at: delivery.normalizedAt,
      dropoff_actual_literal: dropoff.literal,
      dropoff_actual_at: dropoff.normalizedAt,
      rently_status_code: input.reservation.rently_status_code ?? null,
      last_error: 'Los eventos del listado están acreditados, pero Rently no devolvió el detalle del expediente',
      next_action: 'Reintentar la lectura del detalle Rently',
      retry_count: (existing?.retry_count ?? 0) + 1,
      last_attempt_at: observedAt,
      next_retry_at: new Date(Date.now() + 60_000).toISOString(),
    });
    await input.assertLease();
    await initializeMissingSources({
      serviceClient: input.serviceClient,
      organizationId: input.batch.organization_id,
      batchId: input.batch.id,
      itemId: item.id,
      existingSources: existing?.sources ?? [],
      updatedBy: input.actorUserId,
    });
    await input.assertLease();
    await writeSource({ ...input, organizationId: input.batch.organization_id, batchId: input.batch.id, itemId: item.id,
      source: 'rently', status: 'consulted', observedAt, evidenceReference: `booking-list:${bookingId}:events`,
      errorSummary: 'Eventos del listado conservados; detalle contractual no disponible', updatedBy: input.actorUserId });
    return { processed: true, verified: false };
  }

  const detailBookingId = detail ? Number(detail.Id) : bookingId;
  const identityMatches = !detail || (Number.isSafeInteger(detailBookingId) && detailBookingId === bookingId);
  const itemStatus = missingReservation && evidence.status === 'verified_delivery'
    ? 'failed'
    : identityMatches ? (deliveryNormalizationConflict ? 'evidence_conflict' : evidence.status) : 'failed';
  let draftResult: SesReviewDraftResult = {
    draftId: existing?.draft_id ?? null,
    appliedChanges: {},
    proposedChanges: {},
    conflicts: [],
  };
  if (!missingReservation && identityMatches && detail && evidence.status === 'verified_delivery' && input.prepareVerifiedDraft) {
    await input.assertLease();
    draftResult = await input.prepareVerifiedDraft({
      reservation: input.reservation,
      detail,
      assertLease: input.assertLease,
      batchId: input.batch.id,
      leaseToken: input.leaseToken,
      existingConflicts: existing?.conflicts ?? [],
    });
  }

  const nextAction = missingReservation
    ? 'Sincronizar la reserva en PlanMint antes de completar el expediente SES'
    : !identityMatches
    ? 'Revisar la identidad contractual devuelta por Rently'
    : evidence.status === 'verified_delivery'
      ? 'Revisar datos pendientes del expediente SES'
      : evidence.status === 'missing_delivery_evidence'
        ? 'Acreditar referencia y generación del justificante Delivery'
        : evidence.status === 'evidence_conflict'
          ? 'Resolver la discrepancia entre entrega real y generación del justificante'
          : evidence.status === 'outside_period'
            ? 'Conservar para el periodo de la entrega real acreditada'
            : 'Revisar la contradicción de fecha real';
  const branchOfficeId = typeof detail?.DeliveryBranchOffice === 'number'
    ? detail.DeliveryBranchOffice
    : detail?.DeliveryBranchOffice?.Id ?? detail?.DeliveryBranchOfficeId ?? input.reservation.rently_delivery_branch_office_id ?? null;
  const history = mergeSesReviewItemHistory({
    existingApplied: existing?.applied_changes,
    existingProposed: existing?.proposed_changes,
    existingConflicts: existing?.conflicts,
    incomingApplied: draftResult.appliedChanges,
    incomingProposed: draftResult.proposedChanges,
    incomingConflicts: draftResult.conflicts,
  });
  const evidenceGenerated = normalizeRentlyDateTimeForStorage(evidence.evidenceGeneratedAt);
  await input.assertLease();
  const item = await saveReviewItem(input.serviceClient, existing, {
    organization_id: input.batch.organization_id,
    batch_id: input.batch.id,
    external_booking_id: bookingId,
    reservation_id: input.reservation.id,
    draft_id: draftResult.draftId,
    status: itemStatus,
    planned_from_literal: planned.literal,
    planned_from_at: planned.normalizedAt,
    delivery_actual_literal: delivery.literal,
    delivery_actual_at: delivery.normalizedAt,
    dropoff_actual_literal: dropoff.literal,
    dropoff_actual_at: dropoff.normalizedAt,
    evidence_reference: evidence.evidenceReference,
    evidence_generated_literal: evidenceGenerated.literal,
    evidence_generated_at: evidenceGenerated.normalizedAt,
    evidence_observed_at: observedAt,
    rently_status_code: detail?.CurrentStatus ?? input.reservation.rently_status_code ?? null,
    delivery_branch_office_id: branchOfficeId,
    is_transfer: detail?.IsTransfer ?? input.reservation.es_transferencia ?? null,
    proposed_changes: history.proposedChanges,
    applied_changes: history.appliedChanges,
    conflicts: history.conflicts,
    next_action: nextAction,
    last_error: missingReservation ? 'El evento Rently no tiene todavía una reserva PlanMint vinculada'
      : identityMatches ? evidence.reason : 'El detalle Rently no coincide con la reserva solicitada',
    last_attempt_at: observedAt,
    next_retry_at: null,
  });

  await input.assertLease();
  if (itemStatus !== 'outside_period') {
    await initializeMissingSources({
      serviceClient: input.serviceClient,
      organizationId: input.batch.organization_id,
      batchId: input.batch.id,
      itemId: item.id,
      existingSources: existing?.sources ?? [],
      updatedBy: input.actorUserId,
    });
  }
  await input.assertLease();
  await writeSource({ ...input, organizationId: input.batch.organization_id, batchId: input.batch.id, itemId: item.id,
    source: 'rently', status: 'consulted', observedAt, evidenceReference: `booking-list:${bookingId}:events`, updatedBy: input.actorUserId });
  if (evidence.evidenceReference && evidence.evidenceGeneratedAt) {
    await input.assertLease();
    await writeSource({ ...input, organizationId: input.batch.organization_id, batchId: input.batch.id, itemId: item.id,
      source: 'document', status: 'consulted', observedAt: evidenceGenerated.normalizedAt,
      evidenceReference: evidence.evidenceReference, updatedBy: input.actorUserId });
  }
  return { processed: true, verified: itemStatus === 'verified_delivery' };
}

async function readBatchCounts(serviceClient: SupabaseClient, batchId: string) {
  const { data, error } = await serviceClient.from('ses_review_items').select('status,draft_id,conflicts').eq('batch_id', batchId);
  if (error) throw error;
  const rows = data ?? [];
  const draftIds = Array.from(new Set(rows.map((row) => row.draft_id).filter((id): id is string => Boolean(id))));
  let readyDraftIds: string[] = [];
  if (draftIds.length) {
    const { data: readyDrafts, error: draftsError } = await serviceClient.from('ses_contract_drafts')
      .select('id').in('id', draftIds).eq('ready_for_xml', true);
    if (draftsError) throw draftsError;
    readyDraftIds = (readyDrafts ?? []).map((draft) => draft.id);
  }
  return deriveSesReviewBatchCounts(rows, readyDraftIds);
}

export function deriveSesReviewBatchCounts(
  rows: Array<{ status: string; draft_id: string | null; conflicts?: unknown }>,
  readyDraftIds: string[],
) {
  const ready = new Set(readyDraftIds);
  const isOpenConflict = (row: { conflicts?: unknown }) => Array.isArray(row.conflicts)
    && row.conflicts.some((conflict) => conflict && typeof conflict === 'object'
      && isSesReviewConflictOpen(conflict as Record<string, unknown>));
  const isExcluded = (row: { status: string }) => row.status === 'outside_period';
  const isNotReady = (row: { status: string; draft_id: string | null }) => !isExcluded(row) && (!row.draft_id || !ready.has(row.draft_id));
  const isPending = (row: { status: string; draft_id: string | null; conflicts?: unknown }) =>
    row.status !== 'failed' && !isExcluded(row) && (
      ['pending', 'missing_delivery_evidence', 'date_mismatch', 'evidence_conflict'].includes(row.status)
      || isOpenConflict(row)
      || isNotReady(row)
    );
  const pendingCount = rows.filter(isPending).length;
  const errorCount = rows.filter((row) => row.status === 'failed').length;
  return {
    candidateCount: rows.length,
    processedCount: rows.length,
    verifiedCount: rows.filter((row) => row.status === 'verified_delivery').length,
    pendingCount,
    errorCount,
    readyForXml: ready.size,
    openConflictCount: rows.filter(isOpenConflict).length,
    draftNotReadyCount: rows.filter(isNotReady).length,
    unresolvedCount: pendingCount + errorCount,
  };
}

async function readSourceStates(serviceClient: SupabaseClient, batchId: string) {
  const { data, error } = await serviceClient.from('ses_review_item_sources').select('status').eq('batch_id', batchId);
  if (error) throw error;
  return (data ?? []) as Array<{ status: SesReviewSourceStatus }>;
}

async function retryReadySesReviewItems(input: {
  serviceClient: SupabaseClient;
  batch: SesReviewBatchRow;
  actorUserId: string | null;
  prepareVerifiedDraft?: PrepareVerifiedSesDraft;
  assertLease: () => Promise<void>;
  leaseToken: string;
}) {
  const fields = 'id,reservation_id,status,next_retry_at,evidence_reference,evidence_generated_literal';
  const [failedResult, accreditedResult] = await Promise.all([
    input.serviceClient.from('ses_review_items').select(fields).eq('batch_id', input.batch.id)
      .eq('status', 'failed').order('last_attempt_at', { ascending: true }).limit(10),
    input.serviceClient.from('ses_review_items').select(fields).eq('batch_id', input.batch.id)
      .in('status', ['missing_delivery_evidence', 'evidence_conflict'])
      .not('evidence_reference', 'is', null).not('evidence_generated_literal', 'is', null)
      .order('last_attempt_at', { ascending: true }).limit(10),
  ]);
  if (failedResult.error) throw failedResult.error;
  if (accreditedResult.error) throw accreditedResult.error;
  const retryRows = [...(failedResult.data ?? []), ...(accreditedResult.data ?? [])]
    .filter((row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index)
    .filter((row) => isSesReviewItemRetryable({
      status: row.status,
      nextRetryAt: row.next_retry_at,
      evidenceReference: row.evidence_reference,
      evidenceGeneratedLiteral: row.evidence_generated_literal,
    }));
  const reservationIds = retryRows.map((row) => row.reservation_id).filter((id): id is string => Boolean(id));
  if (!reservationIds.length) return 0;
  const { data: reservations, error } = await input.serviceClient.from('reservations').select(RESERVATION_FIELDS)
    .eq('organization_id', input.batch.organization_id).in('id', reservationIds);
  if (error) throw error;
  if (!reservations?.length) return 0;
  const credentials = await loadRentlyCredentials(input.serviceClient, input.batch.organization_id);
  const token = await getRentlyToken(credentials.host, credentials.clientId, credentials.clientSecret);
  for (let index = 0; index < reservations.length; index += 5) {
    await input.assertLease();
    const chunk = (reservations as unknown as SesReviewReservationRow[]).slice(index, index + 5);
    await Promise.all(chunk.map((reservation) => processCandidate({
      ...input,
      reservation,
      host: credentials.host,
      token,
    })));
  }
  return reservations.length;
}

export async function runSesReviewBatchStep(input: {
  serviceClient: SupabaseClient;
  organizationId: string;
  batchId: string;
  actorUserId: string | null;
  prepareVerifiedDraft?: PrepareVerifiedSesDraft;
  pageSize?: number;
}) {
  const leaseToken = randomUUID();
  const leased = await executeWithSesReviewLease({
    claim: async () => {
      const { data, error } = await input.serviceClient.rpc('acquire_ses_review_batch_lease', {
        p_organization_id: input.organizationId,
        p_batch_id: input.batchId,
        p_lease_token: leaseToken,
        p_lease_seconds: 110,
      });
      if (error) throw error;
      const batch = Array.isArray(data) ? data[0] : data;
      return batch?.id ? batch as SesReviewBatchRow : null;
    },
    execute: async (batch) => {
      const assertLease = createSesReviewLeaseGuard(input.serviceClient, batch.organization_id, batch.id, leaseToken);
      await assertLease();
      const startedAt = batch.started_at ?? new Date().toISOString();
      const cursor = parseCursor(batch.cursor);
      const source = SES_REVIEW_CANDIDATE_SOURCES[cursor.sourceIndex];
      if (!source) {
        await retryReadySesReviewItems({ ...input, batch, assertLease, leaseToken });
        return finalizeSesReviewBatch(input.serviceClient, batch, cursor, true, leaseToken);
      }
      try {
    const pageSize = input.pageSize ?? SES_REVIEW_PAGE_SIZE;
    const reservations = await fetchCandidatePage(input.serviceClient, { ...batch, started_at: startedAt }, source, cursor.offset, pageSize);
    if (reservations.length) {
      const credentials = await loadRentlyCredentials(input.serviceClient, batch.organization_id);
      const token = await getRentlyToken(credentials.host, credentials.clientId, credentials.clientSecret);
      for (let index = 0; index < reservations.length; index += 5) {
        await assertLease();
        const chunk = reservations.slice(index, index + 5);
        await Promise.all(chunk.map((reservation) => processCandidate({
          ...input, batch, reservation, host: credentials.host, token, assertLease, leaseToken,
        })));
        await assertLease();
      }
    }
    const advanced = advanceSesReviewCursor({ cursor, pageLength: reservations.length, pageSize });
        return finalizeSesReviewBatch(input.serviceClient, batch, advanced.cursor, advanced.complete, leaseToken);
      } catch (cause) {
    await input.serviceClient.from('ses_review_batches').update({
      status: 'failed', error_summary: 'La revisión se interrumpió y puede reanudarse',
      next_retry_at: new Date(Date.now() + 60_000).toISOString(),
      lease_token: null, lease_expires_at: null,
    }).eq('id', batch.id).eq('organization_id', batch.organization_id).eq('lease_token', leaseToken);
        throw cause;
      }
    },
  });
  if (!leased.executed) return { batch: null, skipped: true, busy: true };
  return leased.result;
}

async function finalizeSesReviewBatch(
  serviceClient: SupabaseClient,
  batch: SesReviewBatchRow,
  cursor: SesReviewCursor,
  pagesComplete: boolean,
  leaseToken: string,
) {
  const counts = await readBatchCounts(serviceClient, batch.id);
  const sources = await readSourceStates(serviceClient, batch.id);
  const { data: syncStatus } = await serviceClient.from('rently_sync_status')
    .select('status,coverage_version,coverage_scope').eq('organization_id', batch.organization_id).maybeSingle();
  const coverage = evaluateSesReviewCoverageGuarantee({
    syncStatus: syncStatus?.status,
    coverageVersion: syncStatus?.coverage_version,
    coverageScope: syncStatus?.coverage_scope as Record<string, unknown> | null,
    periodEnd: batch.period_end,
  });
  const rediscover = shouldRediscoverSesReview({
    pagesComplete,
    coverageComplete: coverage.complete,
    previousCoverageToken: typeof batch.progress?.coverageToken === 'string' ? batch.progress.coverageToken : null,
    currentCoverageToken: coverage.token,
  });
  const persistedCursor = rediscover ? { sourceIndex: 0, offset: 0 } : cursor;
  const persistedPagesComplete = rediscover ? false : pagesComplete;
  const coverageComplete = persistedPagesComplete && coverage.complete;
  const unresolved = counts.unresolvedCount;
  const status = deriveSesReviewBatchStatus({ pagesComplete: coverageComplete, unresolvedItems: unresolved, sources });
  const phase = persistedPagesComplete ? 'await_external_sources' : 'discover_deliveries';
  const progress = {
    ...buildSesReviewProgress({
      phase,
      discovered: counts.candidateCount,
      processed: counts.processedCount,
      total: persistedPagesComplete ? counts.candidateCount : null,
      cursor: persistedCursor.offset,
      pagesComplete: persistedPagesComplete,
    }),
    readyForXml: counts.readyForXml,
    openConflictCount: counts.openConflictCount,
    draftNotReadyCount: counts.draftNotReadyCount,
    coverageComplete,
    coverageToken: coverage.token,
    coverageReason: coverage.reason,
    rediscoveryQueued: rediscover,
  };
  const { data: updated, error } = await serviceClient.from('ses_review_batches').update({
    status,
    phase,
    cursor: persistedCursor,
    progress,
    pages_complete: persistedPagesComplete,
    coverage_complete: coverageComplete,
    candidate_count: counts.candidateCount,
    processed_count: counts.processedCount,
    verified_count: counts.verifiedCount,
    pending_count: counts.pendingCount,
    error_count: counts.errorCount,
    next_retry_at: null,
    completed_at: status === 'completed' ? new Date().toISOString() : null,
    lease_token: null,
    lease_expires_at: null,
  }).eq('id', batch.id).eq('organization_id', batch.organization_id).eq('lease_token', leaseToken).select('*').single();
  if (error) throw error;
  return { batch: updated, counts, skipped: false };
}

export async function getSesReviewBatchDetail(serviceClient: SupabaseClient, organizationId: string, batchId: string) {
  const { data, error } = await serviceClient.from('ses_review_batches').select(`
    *,
    items:ses_review_items(
      id,external_booking_id,reservation_id,draft_id,status,planned_from_literal,planned_from_at,
      delivery_actual_literal,delivery_actual_at,dropoff_actual_literal,dropoff_actual_at,
      evidence_reference,evidence_generated_literal,evidence_generated_at,evidence_observed_at,
      rently_status_code,delivery_branch_office_id,is_transfer,applied_changes,proposed_changes,conflicts,
      retry_count,last_attempt_at,next_retry_at,next_action,last_error,
      draft:ses_contract_drafts!ses_review_items_draft_id_fkey(
        id,validation_errors,manual_fields,eligibility_snapshot,
        holder_profile_id,primary_driver_profile_id,secondary_driver_profile_id,pickup_location_id,return_location_id,
        holder:ses_person_profiles!ses_contract_drafts_holder_profile_id_fkey(*),
        primary_driver:ses_person_profiles!ses_contract_drafts_primary_driver_profile_id_fkey(*),
        secondary_driver:ses_person_profiles!ses_contract_drafts_secondary_driver_profile_id_fkey(*),
        pickup_location:ses_locations!ses_contract_drafts_pickup_location_id_fkey(*),
        return_location:ses_locations!ses_contract_drafts_return_location_id_fkey(*)
      ),
      sources:ses_review_item_sources(id,source,status,evidence_reference,observed_at,error_summary),
      proposals:ses_review_evidence_proposals(id,source,external_submission_id,status,payload,target_type,target_id,target_updated_at,created_at,decided_at,decision_reason)
    )
  `).eq('id', batchId).eq('organization_id', organizationId).single();
  if (error) throw error;
  const normalized = data as unknown as Record<string, any>;
  normalized.items = Array.isArray(normalized.items) ? normalized.items.map((item: Record<string, any>) => ({
    ...item,
    conflicts: Array.isArray(item.conflicts) ? item.conflicts.map((conflict: Record<string, unknown>) => ({
      ...conflict,
      conflictKey: getSesReviewConflictKey(conflict),
      status: conflict.status ?? 'open',
    })) : [],
  })) : [];
  return normalized;
}
