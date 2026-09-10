/**
 * POST /api/sync-rently
 * Migrated from Supabase Edge Function sync-rently.
 * Syncs reservations from the Rently API into Supabase.
 *
 * PERFORMANCE OPTIMIZATIONS (v2):
 * 1. Multi-page fetch per request: processes up to PAGES_PER_REQUEST pages in a single HTTP call
 * 2. Parallel detail enrichment: fetches booking details in parallel batches (DETAIL_CONCURRENCY)
 * 3. Smart enrichment: only enriches reservations that are new, never enriched, or have changed status
 * 4. Batched DB writes: groups inserts and updates into bulk operations
 * 5. Early termination: stops pagination when all remaining bookings are old and unchanged
 */
import type { Request, Response } from "express";
import { getCachedRentlyToken } from './rentlyClient';
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";
import { notifyOwner } from "./_core/notification";
import { releaseParkingSpotByVehicle } from "./parkingEndpoints";
import { syncSesPersonProfiles } from "./sesHospedajes/rentlyProfiles";
import { normalizeRentlyDateTimeForStorage } from './sesHospedajes/dailyReview';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * RentlyBooking — shape returned by /api/bookings/list (post-deprecation).
 * Entities are now lightweight "Description" DTOs.
 * DeliveryPlace/ReturnPlace are replaced by integer IDs.
 * Heavy fields (PriceItems, Attributes, etc.) are removed from list.
 */
interface RentlyBooking {
  Id: number;
  CreationDate?: string;
  CurrentStatus: number;
  CurrentStatusDate?: string;
  // CustomerDescription DTO (subset of full Customer)
  Customer?: {
    Name?: string;
    Firstname?: string;
    Lastname?: string;
    EmailAddress?: string;
    CellPhone?: string;
    DocumentTypeId?: number;
    DocumentType?: number | { Id?: number; Name?: string };
    DocumentId?: string;
    Birthday?: string;
    Country?: unknown;
  };
  CustomerPrice?: number;
  // CarDescription DTO (subset of full Car)
  Car?: {
    Id?: string | number;
    Plate?: string;
    CurrentPlate?: { Id?: string } | string;
    CurrentPlateId?: string;
    // ModelDescription DTO
    Model?: { Name?: string; Category?: { Name?: string } };
  };
  Model?: { Name?: string };
  Category?: { Name?: string };
  Brand?: { Name?: string };
  FromDate?: string;
  ToDate?: string;
  UpdatedOn?: string;
  TotalDays?: number;
  // New: Place IDs instead of objects (post /api/bookings/list migration)
  DeliveryPlaceId?: number | null;
  ReturnPlaceId?: number | null;
  // Legacy fields kept for backwards-compat with detail endpoint
  DeliveryPlace?: { Name?: string; Address?: string };
  ReturnPlace?: { Name?: string; Address?: string };
  DeliveryInfo?: { Date?: string; Kms?: number };
  DropoffInfo?: { Date?: string; Kms?: number };
  Origin?: { Name?: string };
  // New fields added in /api/bookings/list
  IsFullBonus?: boolean;
  FeeNoShow?: boolean;
}

export interface RentlyBookingDetail extends RentlyBooking {
  Balance?: number;
  TotalPayed?: number;
  PrepaidAmount?: number;
  PayedByAgency?: number;
  PayedByCustomer?: number;
  Currency?: string;
  SalesCommision?: number;
  IsTransfer?: boolean;
  DeliveryBranchOffice?: number | { Id?: number } | null;
  DeliveryBranchOfficeId?: number | null;
  IsQuotation?: boolean;
  Version?: string;
  DailyRate?: number;
  HourlyRate?: number;
  ExtraDayRate?: number;
  ExtraHourRate?: number;
  IlimitedKm?: boolean;
  MaxAllowedDistance?: number;
  MaxAllowedDistanceByDay?: number;
  Car?: {
    Id?: string | number;
    Plate?: string;
    CurrentPlate?: { Id?: string } | string;
    CurrentPlateId?: string;
    Kms?: number;
    CurrentKms?: number;
    FuelLevel?: number;
    Gasoline?: number;
    Color?: string;
    Year?: number;
    ChassisId?: string;
    ChassisIdentification?: string;
    FuelType?: string | { Name?: string };
    Model?: { Name?: string; Brand?: { Name?: string }; Category?: { Name?: string } };
  };
  DeliveryPlace?: { Id?: number; Name?: string; Address?: string; City?: string; Country?: unknown; Latitude?: number; Longitude?: number };
  ReturnPlace?: { Id?: number; Name?: string; Address?: string; City?: string; Country?: unknown; Latitude?: number; Longitude?: number };
  DeliveryInfo?: { Date?: string; Kms?: number };
  DropoffInfo?: { Date?: string; Kms?: number };
  Customer?: {
    Id?: number;
    Name?: string;
    Firstname?: string;
    Lastname?: string;
    EmailAddress?: string;
    CellPhone?: string;
    DocumentTypeId?: number;
    DocumentType?: number | { Id?: number; Name?: string };
    DocumentId?: string;
    DocumentIdExpiration?: string;
    DocumentIdIssuanceCountry?: unknown;
    Address?: string;
    AddressNumber?: string;
    AddressDepartment?: string;
    City?: string;
    State?: string;
    Country?: unknown;
    ZipCode?: string;
    Age?: number;
    BirthDate?: string;
    Birthday?: string;
    DriverLicenceNumber?: string;
    DriverLicenceCountry?: unknown;
    DriverLicenseNumber?: string;
    DriverLicenseCountry?: unknown;
    DriverLicenseExpiration?: string;
    DriverLicenseCategory?: string;
    Notes?: string;
  };
  PriceItems?: Array<{
    Description?: string;
    Price?: number;
    UnitPrice?: number;
    Quantity?: number;
    Type?: number;
    TypeId?: number;
    IsBookingPrice?: boolean;
    TariffName?: string | null;
  }>;
  Additionals?: Array<{
    Additional?: {
      Name?: string;
      Description?: string;
      Price?: number;
      IsPriceByDay?: boolean;
      Type?: string;
      Id?: number;
    };
    Quantity?: number;
  }>;
}

interface RentlyBookingsResponse {
  Results: RentlyBooking[];
  NextOffset?: number | null;
}

export function mapBookingToRentlyEvent(
  booking: RentlyBooking,
  organizationId: string,
  reservationId: string | null = null,
) {
  const updated = normalizeRentlyDateTimeForStorage(booking.UpdatedOn ?? null);
  const plannedFrom = normalizeRentlyDateTimeForStorage(booking.FromDate ?? null);
  const plannedTo = normalizeRentlyDateTimeForStorage(booking.ToDate ?? null);
  const delivery = normalizeRentlyDateTimeForStorage(booking.DeliveryInfo?.Date ?? null);
  const dropoff = normalizeRentlyDateTimeForStorage(booking.DropoffInfo?.Date ?? null);
  return {
    organization_id: organizationId,
    external_booking_id: booking.Id,
    ...(reservationId ? { reservation_id: reservationId } : {}),
    current_status: booking.CurrentStatus,
    updated_literal: updated.literal,
    updated_at: updated.normalizedAt,
    planned_from_literal: plannedFrom.literal,
    planned_from_at: plannedFrom.normalizedAt,
    planned_to_literal: plannedTo.literal,
    planned_to_at: plannedTo.normalizedAt,
    delivery_actual_literal: delivery.literal,
    delivery_actual_at: delivery.normalizedAt,
    dropoff_actual_literal: dropoff.literal,
    dropoff_actual_at: dropoff.normalizedAt,
    raw_event_fields: {
      hasDelivery: Boolean(delivery.literal),
      hasDropoff: Boolean(dropoff.literal),
      status: booking.CurrentStatus,
    },
  };
}

export function buildRentlyEventCoverageScope(input: {
  syncMode: 'full' | 'incremental';
  startedAt: string;
  completedAt: string;
  paginationStartOffset: number;
  paginationEndOffset: number;
  localReservationImportIncludesAllStatuses: boolean;
}) {
  const eventCoverageComplete = input.syncMode === 'full' && input.paginationStartOffset === 0;
  return {
    sourceEndpoint: '/api/bookings/list',
    allBranches: true,
    allStatuses: true,
    paginationComplete: true,
    paginationStartOffset: input.paginationStartOffset,
    paginationEndOffset: input.paginationEndOffset,
    nextOffset: null,
    unfilteredDateWindow: input.syncMode === 'full',
    bookingListEventsComplete: eventCoverageComplete,
    deliveryEventsComplete: eventCoverageComplete,
    dropoffEventsComplete: eventCoverageComplete,
    detailEnrichmentComplete: false,
    localReservationImportIncludesAllStatuses: input.localReservationImportIncludesAllStatuses,
    eventFields: ['DeliveryInfo.Date', 'DropoffInfo.Date', 'UpdatedOn', 'CurrentStatus'],
    coveredThrough: input.completedAt,
    runStartedAt: input.startedAt,
    reason: eventCoverageComplete ? null
      : input.syncMode !== 'full' ? 'El barrido incremental no acredita todo el histórico de eventos'
        : 'El barrido no comenzó en el offset cero',
  };
}

interface SyncStatus {
  id: string;
  organization_id: string;
  last_offset: number;
  total_fetched: number;
  total_inserted: number;
  total_duplicates: number;
  total_filtered: number;
  status: string;
  started_at: string | null;
  watermark_updated_at?: string | null;
  last_full_sync_at?: string | null;
  coverage_version?: string | null;
  coverage_scope?: Record<string, unknown> | null;
  sync_mode?: 'full' | 'incremental';
  completed_at: string | null;
  error_message: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const STATUS_MAP: Record<number, string> = {
  0: "Pendiente",
  1: "Confirmada",
  2: "En curso",
  3: "Completada",
  4: "Cancelada",
  5: "Cotizado",
};

const STATUS_PRIORITY: Record<string, number> = {
  Pendiente: 0,
  Confirmada: 1,
  "En curso": 2,
  Completada: 3,
  Cancelada: 99,
};

const DOCUMENT_TYPE_MAP: Record<number, string> = {
  1: "DNI",
  2: "Licencia de Conducir",
  3: "Pasaporte",
};

async function fetchDocumentTypeMap(host: string, token: string): Promise<Map<number, string>> {
  const fallback = new Map(Object.entries(DOCUMENT_TYPE_MAP).map(([id, name]) => [Number(id), name]));
  try {
    const response = await fetch(`https://${host}/api/configurations/documentTypes`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!response.ok) return fallback;
    const payload = await response.json() as any;
    const rows = Array.isArray(payload) ? payload : payload?.Results;
    if (!Array.isArray(rows)) return fallback;
    const catalog = new Map<number, string>();
    for (const row of rows) {
      const id = Number(row?.Id ?? row?.id);
      const name = row?.Name ?? row?.name;
      if (Number.isFinite(id) && typeof name === 'string' && name.trim()) catalog.set(id, name.trim());
    }
    return catalog.size ? catalog : fallback;
  } catch {
    return fallback;
  }
}

const EXCLUDED_NEW_STATUSES = [5]; // Cotizado
const CANCELLATION_STATUS = 4;
const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 60000;
const DETAIL_TIMEOUT_MS = 15000;

const RENTLY_ENRICHMENT_FIELDS = [
  'rently_creation_date',
  'cliente_nombre',
  'cliente_apellido',
  'email',
  'telefono',
  'tipo_documento_cliente',
  'documento_cliente',
  'cliente_direccion',
  'cliente_ciudad',
  'cliente_estado_provincia',
  'cliente_pais',
  'cliente_fecha_nacimiento',
  'cliente_carnet_numero',
  'cliente_carnet_pais',
  'cliente_carnet_expiracion',
  'categoria',
  'auto',
  'modelo',
  'marca',
  'vehiculo_color',
  'vehiculo_chasis',
  'vehiculo_kms',
] as const;

export function removeEmptyRentlyEnrichmentFields(updateData: Record<string, unknown>) {
  for (const field of RENTLY_ENRICHMENT_FIELDS) {
    const value = updateData[field];
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
      delete updateData[field];
    }
  }
  return updateData;
}

// ─── Performance tuning ─────────────────────────────────────────────────────
/** How many Rently list pages to fetch per single HTTP request from the client */
const PAGES_PER_REQUEST = 3;
/** How many detail fetches to run in parallel */
const DETAIL_CONCURRENCY = 5;
/** Max detail fetches per multi-page batch */
const MAX_DETAIL_FETCHES_PER_BATCH = 30;
/** How many consecutive pages with 0 new/changed bookings before early termination */
const EARLY_TERM_UNCHANGED_PAGES = 5;
/** Max time (ms) for a single request before we return partial results (Cloudflare 524 = 100s) */
const REQUEST_DEADLINE_MS = 75_000;

export function shouldIncludeRentlyBookingInSync(input: {
  currentStatus: number;
  existsInPlanMint: boolean;
  includeAll?: boolean;
}) {
  if (input.includeAll) return true;
  if (input.existsInPlanMint) return input.currentStatus !== 5;
  return !EXCLUDED_NEW_STATUSES.includes(input.currentStatus) && input.currentStatus !== CANCELLATION_STATUS;
}

export function deduplicateRentlyBookingsByStableId<T extends { Id: string | number }>(bookings: T[]) {
  const unique = new Map<string, T>();
  for (const booking of bookings) unique.set(String(booking.Id), booking);
  return Array.from(unique.values());
}

export type RentlySyncWriteFailure = {
  operation: 'insert' | 'update';
  externalId: string;
  code: string;
};

export function summarizeRentlySyncWriteFailures(failures: RentlySyncWriteFailure[]) {
  const codes = Array.from(new Set(failures.map((failure) => failure.code || 'UNKNOWN'))).sort();
  return `${failures.length} escritura(s) de reservas rechazadas (${codes.join(', ')})`;
}

// ─── Rently API helpers ──────────────────────────────────────────────────────

export async function getRentlyToken(host: string, clientId: string, clientSecret: string): Promise<string> {
  return getCachedRentlyToken({ host, clientId, clientSecret });
}

// ─── Places cache (resolves DeliveryPlaceId/ReturnPlaceId → Name) ────────────

interface RentlyPlaceEntry {
  Id: number;
  Name?: string;
  Address?: string;
}

const placesCache = new Map<string, Map<number, RentlyPlaceEntry>>();

async function getPlacesMap(host: string, token: string): Promise<Map<number, RentlyPlaceEntry>> {
  if (placesCache.has(host)) return placesCache.get(host)!;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`https://${host}/api/places`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      console.warn(`[sync-rently] Failed to fetch places: ${response.status}`);
      return new Map();
    }
    const data = await response.json();
    const places: RentlyPlaceEntry[] = Array.isArray(data) ? data : (data?.Results || []);
    const map = new Map<number, RentlyPlaceEntry>();
    for (const p of places) {
      if (p.Id) map.set(p.Id, p);
    }
    placesCache.set(host, map);
    console.log(`[sync-rently] Places cache loaded: ${map.size} entries`);
    return map;
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.warn(`[sync-rently] Error fetching places:`, error?.message);
    return new Map();
  }
}

/** Clear places cache (e.g. between sync sessions if needed) */
export function clearPlacesCache() {
  placesCache.clear();
}

async function fetchSinglePage(
  host: string,
  token: string,
  offset: number,
  updatedSince?: string | null,
): Promise<{ bookings: RentlyBooking[]; nextOffset: number | null; hasMore: boolean }> {
  const params = new URLSearchParams({ offset: String(offset), limit: String(PAGE_SIZE) });
  if (updatedSince) params.set('updatedSince', updatedSince);
  // Migrated from deprecated /api/bookings → /api/bookings/list (deadline: 2026-07-13)
  const url = `https://${host}/api/bookings/list?${params}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401) throw new Error("Token expired or invalid");
      const errorText = await response.text();
      throw new Error(`API Error (${response.status}): ${errorText}`);
    }

    const data: RentlyBookingsResponse = await response.json();
    const bookings = data.Results || [];
    const hasMore =
      data.NextOffset !== undefined &&
      data.NextOffset !== null &&
      data.NextOffset !== 0 &&
      bookings.length === PAGE_SIZE;
    const nextOffset = hasMore ? data.NextOffset! : null;

    return { bookings, nextOffset, hasMore };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error?.name === "AbortError") throw new Error("Timeout fetching page from Rently");
    throw error;
  }
}

export async function fetchBookingDetail(host: string, token: string, bookingId: number): Promise<RentlyBookingDetail | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DETAIL_TIMEOUT_MS);

  try {
    const response = await fetch(`https://${host}/api/booking/${bookingId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      console.warn(`[sync-rently] Detail fetch failed for booking ${bookingId}: ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.warn(`[sync-rently] Detail fetch error for booking ${bookingId}:`, error?.message || error);
    return null;
  }
}

export async function fetchBookingDrivers(
  host: string,
  token: string,
  bookingId: number
): Promise<Array<{ Name?: string; Document?: string; License?: string }>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DETAIL_TIMEOUT_MS);

  try {
    const response = await fetch(`https://${host}/api/booking/${bookingId}/drivers`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return [];
    return await response.json();
  } catch {
    clearTimeout(timeoutId);
    return [];
  }
}

// ─── Parallel fetch helper ──────────────────────────────────────────────────

/**
 * Fetch booking details in parallel with controlled concurrency.
 * Returns a Map of bookingId → { detail, drivers }.
 */
async function fetchDetailsInParallel(
  host: string,
  token: string,
  bookingIds: number[],
  concurrency: number
): Promise<Map<number, { detail: RentlyBookingDetail; drivers: Array<{ Name?: string; Document?: string; License?: string }> }>> {
  const results = new Map<number, { detail: RentlyBookingDetail; drivers: Array<{ Name?: string; Document?: string; License?: string }> }>();

  // Process in chunks of `concurrency`
  for (let i = 0; i < bookingIds.length; i += concurrency) {
    const chunk = bookingIds.slice(i, i + concurrency);
    const promises = chunk.map(async (id) => {
      const detail = await fetchBookingDetail(host, token, id);
      if (!detail) return null;
      const drivers = await fetchBookingDrivers(host, token, id);
      return { id, detail, drivers };
    });

    const settled = await Promise.allSettled(promises);
    for (const result of settled) {
      if (result.status === "fulfilled" && result.value) {
        results.set(result.value.id, { detail: result.value.detail, drivers: result.value.drivers });
      }
    }
  }

  return results;
}

// ─── Mapping helpers ─────────────────────────────────────────────────────────

export function resolveRentlyCarPlate(car: RentlyBooking['Car'] | RentlyBookingDetail['Car'] | null | undefined) {
  if (!car) return null;
  // En el tenant de Azul Cars, Car.Id contiene la matrícula legal (p. ej. 1892MSD),
  // mientras que CurrentPlate.Id puede ser un alias operativo (p. ej. MINI1-9).
  // Los IDs numéricos siguen rechazados porque son identificadores internos opacos.
  if (typeof car.Id === 'string' && car.Id.trim()) return car.Id.trim();
  const expandedPlate = typeof car.CurrentPlate === 'string'
    ? car.CurrentPlate
    : car.CurrentPlate?.Id;
  const candidates = [expandedPlate, car.CurrentPlateId, car.Plate];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}

export function mapBookingToReservation(
  booking: RentlyBooking,
  organizationId: string,
  userId: string,
  placesMap?: Map<number, RentlyPlaceEntry>,
  documentTypeMap: Map<number, string> = new Map(Object.entries(DOCUMENT_TYPE_MAP).map(([id, name]) => [Number(id), name])),
): Record<string, unknown> {
  const customer = booking.Customer || {};
  const car = booking.Car || {};
  const carModel = car.Model || {};
  const category = booking.Category || carModel.Category || {};
  const documentTypeId = customer.DocumentTypeId
    ?? (typeof customer.DocumentType === 'number' ? customer.DocumentType : customer.DocumentType?.Id);
  const plate = resolveRentlyCarPlate(car);

  // Resolve places: prefer legacy objects (detail endpoint), fall back to ID lookup
  const deliveryPlace = booking.DeliveryPlace || (booking.DeliveryPlaceId && placesMap?.get(booking.DeliveryPlaceId)) || {};
  const returnPlace = booking.ReturnPlace || (booking.ReturnPlaceId && placesMap?.get(booking.ReturnPlaceId)) || {};
  const dropoffInfo = booking.DropoffInfo || {};
  const deliveryInfo = booking.DeliveryInfo || {};
  const origin = booking.Origin || {};
  const deliveryEvent = normalizeRentlyDateTimeForStorage(deliveryInfo.Date ?? null);
  const dropoffEvent = normalizeRentlyDateTimeForStorage(dropoffInfo.Date ?? null);
  const listUpdatedOn = normalizeRentlyDateTimeForStorage(booking.UpdatedOn ?? null);

  return {
    organization_id: organizationId,
    imported_by: userId,
    external_reservation_id: String(booking.Id),
    rently_creation_date: booking.CreationDate || null,
    estado: STATUS_MAP[booking.CurrentStatus] || `Status ${booking.CurrentStatus}`,
    rently_status_code: booking.CurrentStatus,
    rently_status_date: booking.CurrentStatusDate || null,
    rently_list_updated_literal: listUpdatedOn.literal,
    rently_list_updated_at: listUpdatedOn.normalizedAt,
    rently_delivery_actual_literal: deliveryEvent.literal,
    rently_delivery_actual_at: deliveryEvent.normalizedAt,
    rently_dropoff_actual_literal: dropoffEvent.literal,
    rently_dropoff_actual_at: dropoffEvent.normalizedAt,
    cliente_nombre: customer.Name || customer.Firstname || null,
    cliente_apellido: customer.Lastname || null,
    email: customer.EmailAddress || null,
    telefono: customer.CellPhone || null,
    tipo_documento_cliente: documentTypeId
      ? documentTypeMap.get(documentTypeId) || null
      : null,
    documento_cliente: customer.DocumentId || null,
    modelo: booking.Model?.Name || carModel.Name || null,
    marca: booking.Brand?.Name || null,
    auto: plate,
    categoria: category.Name || null,
    desde: booking.FromDate || null,
    hasta: booking.ToDate || null,
    devolucion: dropoffInfo.Date || null,
    // Hora confirmada: se inicializa con las fechas de Rently en la primera inserción,
    // nunca se sobreescribe en syncs posteriores (delete en statusUpdates)
    confirmed_entrega_datetime: booking.FromDate || null,
    confirmed_devolucion_datetime: booking.ToDate || null,
    lugar_entrega: deliveryPlace.Name || null,
    lugar_devolucion: returnPlace.Name || null,
    // Mirror columns: always reflect the latest Rently values for comparison
    rently_lugar_entrega: deliveryPlace.Name || null,
    rently_lugar_devolucion: returnPlace.Name || null,
    precio: booking.CustomerPrice || null,
    origen_reserva: origin.Name || null,
    duracion: booking.TotalDays ? String(booking.TotalDays) : null,
  };
}

export function enrichReservationWithDetail(
  reservation: Record<string, unknown>,
  detail: RentlyBookingDetail,
  drivers: Array<{ Name?: string; Document?: string; License?: string }>,
  documentTypeMap: Map<number, string> = new Map(Object.entries(DOCUMENT_TYPE_MAP).map(([id, name]) => [Number(id), name])),
): Record<string, unknown> {
  const car = detail.Car || {};
  const customer = detail.Customer || {};
  const deliveryPlace = detail.DeliveryPlace || {};
  const returnPlace = detail.ReturnPlace || {};

  return {
    ...reservation,
    cliente_nombre: customer.Name || customer.Firstname || reservation.cliente_nombre || null,
    cliente_apellido: customer.Lastname || reservation.cliente_apellido || null,
    email: customer.EmailAddress || reservation.email || null,
    telefono: customer.CellPhone || reservation.telefono || null,
    tipo_documento_cliente: customer.DocumentTypeId
      ? documentTypeMap.get(customer.DocumentTypeId) || reservation.tipo_documento_cliente || null
      : reservation.tipo_documento_cliente || null,
    documento_cliente: customer.DocumentId || reservation.documento_cliente || null,
    balance: detail.Balance ?? null,
    total_pagado_rently: detail.TotalPayed ?? null,
    prepago: detail.PrepaidAmount ?? null,
    pagado_por_agencia: detail.PayedByAgency ?? null,
    pagado_por_cliente: detail.PayedByCustomer ?? null,
    moneda: detail.Currency || null,
    comision_ventas: detail.SalesCommision ?? null,
    vehiculo_kms: car.CurrentKms ?? car.Kms ?? null,
    vehiculo_combustible: car.Gasoline ?? car.FuelLevel ?? null,
    vehiculo_color: car.Color || null,
    vehiculo_anio: car.Year ?? null,
    vehiculo_chasis: car.ChassisIdentification || car.ChassisId || null,
    vehiculo_tipo_combustible: typeof car.FuelType === 'string' ? car.FuelType : car.FuelType?.Name || null,
    tarifa_diaria: detail.DailyRate ?? null,
    tarifa_hora: detail.HourlyRate ?? null,
    tarifa_dia_extra: detail.ExtraDayRate ?? null,
    tarifa_hora_extra: detail.ExtraHourRate ?? null,
    km_ilimitados: detail.IlimitedKm ?? null,
    km_max_permitidos: detail.MaxAllowedDistance ?? null,
    km_max_por_dia: detail.MaxAllowedDistanceByDay ?? null,
    rently_status_code: detail.CurrentStatus,
    rently_status_date: detail.CurrentStatusDate || null,
    es_transferencia: detail.IsTransfer ?? false,
    rently_delivery_branch_office_id: typeof detail.DeliveryBranchOffice === 'number'
      ? detail.DeliveryBranchOffice
      : detail.DeliveryBranchOffice?.Id ?? detail.DeliveryBranchOfficeId ?? null,
    rently_delivery_actual_at: detail.DeliveryInfo?.Date || null,
    rently_detail_booking_id: detail.Id,
    rently_detail_vehicle_plate: resolveRentlyCarPlate(car),
    auto: resolveRentlyCarPlate(car) || reservation.auto || null,
    modelo: detail.Model?.Name || car.Model?.Name || reservation.modelo || null,
    marca: detail.Brand?.Name || car.Model?.Brand?.Name || reservation.marca || null,
    categoria: detail.Category?.Name || car.Model?.Category?.Name || reservation.categoria || null,
    es_cotizacion: detail.IsQuotation ?? false,
    rently_version: detail.Version || null,
    lugar_entrega_direccion: deliveryPlace.Address || null,
    lugar_entrega_ciudad: deliveryPlace.City || null,
    lugar_devolucion_direccion: returnPlace.Address || null,
    lugar_devolucion_ciudad: returnPlace.City || null,
    // Mirror columns: always reflect the latest Rently values for comparison
    rently_lugar_entrega_direccion: deliveryPlace.Address || null,
    rently_lugar_devolucion_direccion: returnPlace.Address || null,
    cliente_direccion: customer.Address || null,
    cliente_ciudad: customer.City || null,
    cliente_estado_provincia: customer.State || null,
    cliente_pais: customer.Country || null,
    cliente_edad: customer.Age ?? null,
    cliente_fecha_nacimiento: customer.Birthday || customer.BirthDate || null,
    cliente_carnet_numero: customer.DriverLicenceNumber || customer.DriverLicenseNumber || null,
    cliente_carnet_pais: typeof customer.DriverLicenceCountry === 'string'
      ? customer.DriverLicenceCountry
      : (typeof customer.DriverLicenseCountry === 'string' ? customer.DriverLicenseCountry : null),
    cliente_carnet_expiracion: customer.DriverLicenseExpiration || null,
    cliente_notas: customer.Notes || null,
    extras_contratados:
      detail.Additionals && detail.Additionals.length > 0
        ? JSON.stringify(detail.Additionals.map((a) => ({
            nombre: a.Additional?.Name || null,
            precio: a.Additional?.Price ?? null,
            cantidad: a.Quantity ?? 1,
            tipo: a.Additional?.Type || null,
            por_dia: a.Additional?.IsPriceByDay ?? false,
          })))
        : null,
    desglose_precios:
      detail.PriceItems && detail.PriceItems.length > 0
        ? JSON.stringify(detail.PriceItems.map((p) => ({ descripcion: p.Description, importe: p.Price, precio_unitario: p.UnitPrice, cantidad: p.Quantity, tipo: p.Type })))
        : null,
    conductores_adicionales:
      drivers.length > 0
        ? JSON.stringify(drivers.map((d) => ({ nombre: d.Name, documento: d.Document, carnet: d.License })))
        : null,
    rently_detail_synced_at: new Date().toISOString(),
  };
}

// ─── Vehicle Status Sync ────────────────────────────────────────────────────

async function syncVehicleStatuses(
  serviceClient: ReturnType<typeof getServiceClient>,
  organizationId: string
): Promise<{ released: number; rented: number; errors: number }> {
  let released = 0;
  let rented = 0;
  let errors = 0;

  try {
    // 1. Release vehicles whose reservation is completed or cancelled
    const { data: rentedVehicles, error: vehError } = await serviceClient
      .from("vehicles")
      .select("id, matricula, current_reservation_id")
      .eq("organization_id", organizationId)
      .eq("status", "alquilado")
      .eq("is_archived", false)
      .not("current_reservation_id", "is", null);

    if (vehError) {
      console.error("[sync-vehicles] Error fetching rented vehicles:", vehError);
      return { released: 0, rented: 0, errors: 1 };
    }

    if (rentedVehicles && rentedVehicles.length > 0) {
      const reservationIds = rentedVehicles.map(v => v.current_reservation_id).filter(Boolean) as string[];
      const { data: reservations } = await serviceClient
        .from("reservations")
        .select("id, estado")
        .in("id", reservationIds);

      const reservationMap = new Map<string, string>();
      if (reservations) {
        reservations.forEach(r => reservationMap.set(r.id, r.estado || ""));
      }

      for (const vehicle of rentedVehicles) {
        const resStatus = reservationMap.get(vehicle.current_reservation_id!);
        if (resStatus === "Completada" || resStatus === "Cancelada") {
          try {
            await serviceClient
              .from("vehicle_cleaning_tasks")
              .update({ completed: false, completed_at: null, completed_by: null })
              .eq("vehicle_id", vehicle.id);

            const { error: updateErr } = await serviceClient
              .from("vehicles")
              .update({
                status: "sucio",
                current_reservation_id: null,
                last_status_change: new Date().toISOString(),
                cleaned_by: null,
                cleaned_at: null,
              })
              .eq("id", vehicle.id);

            if (updateErr) {
              console.error(`[sync-vehicles] Error releasing ${vehicle.matricula}:`, updateErr);
              errors++;
            } else {
              console.log(`[sync-vehicles] Released ${vehicle.matricula} (reservation ${resStatus})`);
              released++;
            }
          } catch (err) {
            console.error(`[sync-vehicles] Exception releasing ${vehicle.matricula}:`, err);
            errors++;
          }
        }
      }
    }

    // 2. Set vehicles to alquilado for active reservations
    //    Also handles: unarchiving archived vehicles and creating missing vehicles
    const { data: activeReservations } = await serviceClient
      .from("reservations")
      .select("id, auto, modelo, categoria, cliente_nombre, cliente_apellido")
      .eq("organization_id", organizationId)
      .eq("estado", "En curso")
      .not("auto", "is", null);

    if (activeReservations && activeReservations.length > 0) {
      for (const res of activeReservations) {
        if (!res.auto) continue;

        // First try to find a non-archived vehicle
        const { data: vehicle } = await serviceClient
          .from("vehicles")
          .select("id, status, current_reservation_id, is_archived")
          .eq("organization_id", organizationId)
          .eq("matricula", res.auto)
          .eq("is_archived", false)
          .single();

        if (vehicle && vehicle.status !== "alquilado" && vehicle.status !== "en_servicio") {
          const { error: updateErr } = await serviceClient
            .from("vehicles")
            .update({
              status: "alquilado",
              current_reservation_id: res.id,
              last_status_change: new Date().toISOString(),
            })
            .eq("id", vehicle.id);
          if (!updateErr) {
            console.log(`[sync-vehicles] Set ${res.auto} to alquilado (reservation ${res.id})`);
            rented++;
            // Auto-release parking spot when vehicle goes to alquilado
            try {
              await releaseParkingSpotByVehicle(organizationId, res.auto, "system_sync_rently");
            } catch (e) {
              console.error(`[sync-vehicles] Error releasing parking for ${res.auto}:`, e);
            }
          }
        } else if (vehicle && vehicle.status === "alquilado" && vehicle.current_reservation_id !== res.id) {
          await serviceClient
            .from("vehicles")
            .update({ current_reservation_id: res.id })
            .eq("id", vehicle.id);
        } else if (!vehicle) {
          // Vehicle not found as non-archived. Check if it exists but is archived.
          const { data: archivedVehicle } = await serviceClient
            .from("vehicles")
            .select("id, status")
            .eq("organization_id", organizationId)
            .eq("matricula", res.auto)
            .eq("is_archived", true)
            .single();

          if (archivedVehicle) {
            // Unarchive and set to alquilado
            const { error: unarchiveErr } = await serviceClient
              .from("vehicles")
              .update({
                is_archived: false,
                archived_at: null,
                archived_by: null,
                status: "alquilado",
                current_reservation_id: res.id,
                last_status_change: new Date().toISOString(),
              })
              .eq("id", archivedVehicle.id);
            if (!unarchiveErr) {
              console.log(`[sync-vehicles] Unarchived and set ${res.auto} to alquilado (reservation ${res.id})`);
              rented++;
            } else {
              console.error(`[sync-vehicles] Error unarchiving ${res.auto}:`, unarchiveErr);
              errors++;
            }
          } else {
            // Vehicle doesn't exist at all — create it
            const { error: createErr } = await serviceClient
              .from("vehicles")
              .insert({
                organization_id: organizationId,
                matricula: res.auto.trim().toUpperCase(),
                modelo: res.modelo || null,
                categoria: res.categoria || null,
                status: "alquilado",
                current_reservation_id: res.id,
                is_archived: false,
                last_status_change: new Date().toISOString(),
              });
            if (!createErr) {
              console.log(`[sync-vehicles] Created vehicle ${res.auto} and set to alquilado (reservation ${res.id})`);
              rented++;
            } else {
              console.error(`[sync-vehicles] Error creating vehicle ${res.auto}:`, createErr);
              errors++;
            }
          }
        }
      }
    }

    // 3. Detect orphaned vehicles (vehicle swap in Rently)
    const { data: allRentedVehicles, error: allRentedErr } = await serviceClient
      .from("vehicles")
      .select("id, matricula, current_reservation_id")
      .eq("organization_id", organizationId)
      .eq("status", "alquilado")
      .eq("is_archived", false)
      .not("current_reservation_id", "is", null);

    if (!allRentedErr && allRentedVehicles && allRentedVehicles.length > 0) {
      const allResIds = allRentedVehicles.map(v => v.current_reservation_id).filter(Boolean) as string[];
      const { data: linkedReservations } = await serviceClient
        .from("reservations")
        .select("id, auto, estado")
        .in("id", allResIds);

      const linkedResMap = new Map<string, { auto: string | null; estado: string | null }>();
      if (linkedReservations) {
        linkedReservations.forEach(r => linkedResMap.set(r.id, { auto: r.auto, estado: r.estado }));
      }

      for (const vehicle of allRentedVehicles) {
        const linkedRes = linkedResMap.get(vehicle.current_reservation_id!);
        if (!linkedRes) continue;
        if (linkedRes.auto && linkedRes.auto !== vehicle.matricula) {
          try {
            await serviceClient
              .from("vehicle_cleaning_tasks")
              .update({ completed: false, completed_at: null, completed_by: null })
              .eq("vehicle_id", vehicle.id);

            const { error: updateErr } = await serviceClient
              .from("vehicles")
              .update({
                status: "sucio",
                current_reservation_id: null,
                last_status_change: new Date().toISOString(),
                cleaned_by: null,
                cleaned_at: null,
              })
              .eq("id", vehicle.id);

            if (updateErr) {
              console.error(`[sync-vehicles] Error releasing swapped vehicle ${vehicle.matricula}:`, updateErr);
              errors++;
            } else {
              console.log(`[sync-vehicles] Released swapped vehicle ${vehicle.matricula}`);
              released++;
            }
          } catch (err) {
            console.error(`[sync-vehicles] Exception releasing swapped vehicle ${vehicle.matricula}:`, err);
            errors++;
          }
        }
      }
    }

    // 4. Ensure every active vehicle has a fleet_vehicles record
    const { data: orphanedVehicles } = await serviceClient
      .from("vehicles")
      .select("id, matricula, modelo, categoria")
      .eq("organization_id", organizationId)
      .eq("is_archived", false)
      .is("fleet_vehicle_id", null);

    if (orphanedVehicles && orphanedVehicles.length > 0) {
      const { data: existingFleet } = await serviceClient
        .from("fleet_vehicles")
        .select("id, matricula")
        .eq("organization_id", organizationId);
      const fleetByPlate = new Map<string, string>();
      (existingFleet || []).forEach(f => fleetByPlate.set(f.matricula.toUpperCase(), f.id));

      for (const v of orphanedVehicles) {
        const existingFleetId = fleetByPlate.get(v.matricula.toUpperCase());
        if (existingFleetId) {
          await serviceClient.from("vehicles").update({ fleet_vehicle_id: existingFleetId }).eq("id", v.id);
        } else {
          const { data: newFleet } = await serviceClient
            .from("fleet_vehicles")
            .insert({
              organization_id: organizationId,
              matricula: v.matricula,
              modelo: v.modelo || null,
              categoria: v.categoria || null,
            })
            .select("id")
            .single();
          if (newFleet) {
            await serviceClient.from("vehicles").update({ fleet_vehicle_id: newFleet.id }).eq("id", v.id);
          }
        }
      }
    }

    console.log(`[sync-vehicles] Done: ${released} released, ${rented} rented, ${errors} errors`);
  } catch (err) {
    console.error("[sync-vehicles] Unexpected error:", err);
    errors++;
  }

  return { released, rented, errors };
}

// ─── Main handler ────────────────────────────────────────────────────────────

type RentlySyncExecutionOptions = {
  scheduled?: boolean;
};

export async function handleSyncRently(
  req: Request,
  res: Response,
  execution: RentlySyncExecutionOptions = {},
) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const serviceClient = getServiceClient();
    let userId: string;
    let organizationId: string;

    if (execution.scheduled) {
      const { sdk } = await import('./_core/sdk');
      const cronUser = await sdk.authenticateRequest(req) as { isCron?: boolean; taskUid?: string };
      if (!cronUser.isCron || !cronUser.taskUid) {
        return res.status(403).json({ success: false, error: 'cron-only' });
      }
      const { data: scheduledStatus, error: scheduledStatusError } = await serviceClient
        .from('rently_sync_status')
        .select('organization_id')
        .eq('schedule_cron_task_uid', cronUser.taskUid)
        .limit(1)
        .maybeSingle();
      if (scheduledStatusError) throw scheduledStatusError;
      if (!scheduledStatus?.organization_id) {
        return res.json({ success: true, skipped: 'orphan' });
      }
      organizationId = scheduledStatus.organization_id;
      const { data: syncActor, error: syncActorError } = await serviceClient
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organizationId)
        .in('role', ['owner', 'admin'])
        .limit(1)
        .maybeSingle();
      if (syncActorError) throw syncActorError;
      if (!syncActor?.user_id) throw new Error('No hay un actor administrativo activo para la sincronización Rently');
      userId = syncActor.user_id;
    } else {
      const authenticated = await authenticateSupabaseRequest(req.headers.authorization);
      userId = authenticated.userId;
      organizationId = authenticated.organizationId;
    }

    // Get Rently credentials
    const { data: settings, error: settingsError } = await serviceClient
      .from("integration_settings")
      .select("rently_api_host, rently_client_id, rently_client_secret")
      .eq("organization_id", organizationId)
      .single();

    if (settingsError || !settings?.rently_client_id || !settings?.rently_client_secret) {
      return res.status(400).json({
        success: false,
        error: "Rently no está configurado. Configura tus credenciales en Ajustes → Integraciones.",
      });
    }

    const host = settings.rently_api_host || "azul.rently.com.ar";
    const clientId = settings.rently_client_id;
    const clientSecret = settings.rently_client_secret;

    let { continue_sync } = req.body || {};
    const { reset, test_only, action, include_all } = req.body || {};

    // Handle sync_vehicles action separately
    if (action === "sync_vehicles") {
      const result = await syncVehicleStatuses(serviceClient, organizationId);
      return res.json({
        success: true,
        vehicles_created: 0,
        vehicles_updated: result.rented,
        vehicles_released: result.released,
        errors: result.errors,
      });
    }

    // Get OAuth token from Rently
    const rentlyToken = await getRentlyToken(host, clientId, clientSecret);

    // Test connection only
    if (test_only) {
      return res.json({ success: true, message: "Conexión exitosa" });
    }

    // Get or create sync status
    let syncStatus: SyncStatus | null = null;

    const { data: existingStatus } = await serviceClient
      .from("rently_sync_status")
      .select("*")
      .eq("organization_id", organizationId)
      .single();

    if (existingStatus) {
      syncStatus = existingStatus as SyncStatus;
    }

    if (execution.scheduled) {
      continue_sync = syncStatus?.status === 'running';
    }

    const previousWatermark = syncStatus?.watermark_updated_at || syncStatus?.completed_at || null;
    const previousFullSync = syncStatus?.last_full_sync_at || null;
    const fullSyncDue = !previousFullSync || Date.now() - new Date(previousFullSync).getTime() >= 24 * 60 * 60 * 1000;
    const syncMode: 'full' | 'incremental' = reset || fullSyncDue ? 'full' : 'incremental';
    const incrementalSince = syncMode === 'incremental' && previousWatermark
      ? new Date(new Date(previousWatermark).getTime() - 10 * 60 * 1000).toISOString()
      : null;

    const shouldReset =
      reset || !syncStatus || syncStatus.status === "completed" || syncStatus.status === "error" || syncStatus.status === "idle";

    if (shouldReset) {
      const startedAt = new Date().toISOString();
      const newStatus = {
        organization_id: organizationId,
        last_offset: 0,
        total_fetched: 0,
        total_inserted: 0,
        total_duplicates: 0,
        total_filtered: 0,
        status: "running",
        started_at: startedAt,
        completed_at: null,
        error_message: null,
        sync_mode: syncMode,
        coverage_version: null,
        coverage_scope: {
          runStartedAt: startedAt,
          paginationStartOffset: 0,
          runAllStatuses: include_all === true,
          sourceEndpoint: '/api/bookings/list',
        },
      };

      if (syncStatus) {
        const { data: updated, error: updateError } = await serviceClient
          .from("rently_sync_status")
          .update(newStatus)
          .eq("id", syncStatus.id)
          .select()
          .single();
        if (updateError) throw new Error(`Failed to reset sync status: ${updateError.message}`);
        syncStatus = updated as SyncStatus;
      } else {
        const { data: inserted, error: insertError } = await serviceClient
          .from("rently_sync_status")
          .insert(newStatus)
          .select()
          .single();
        if (insertError) throw new Error(`Failed to create sync status: ${insertError.message}`);
        syncStatus = inserted as SyncStatus;
      }
      console.log("[sync-rently] Sync status reset/created");
    } else if (syncStatus && syncStatus.status !== "running") {
      await serviceClient.from("rently_sync_status").update({ status: "running" }).eq("id", syncStatus.id);
      syncStatus.status = "running";
    }

    if (!syncStatus) throw new Error("Failed to initialize sync status");
    const includeAllForRun = include_all === true
      || (continue_sync === true && syncStatus.coverage_scope?.runAllStatuses === true);

    // ─── Load places cache for resolving DeliveryPlaceId/ReturnPlaceId ────────
    const placesMap = await getPlacesMap(host, rentlyToken);
    const documentTypeMap = await fetchDocumentTypeMap(host, rentlyToken);

    // ─── MULTI-PAGE LOOP ─────────────────────────────────────────────────────
    // Process up to PAGES_PER_REQUEST pages in a single HTTP request
    const requestStartTime = Date.now();
    let currentOffset = syncStatus.last_offset;
    let totalBookingsFetched = 0;
    let totalInsertedCount = 0;
    let totalDuplicateCount = 0;
    let totalFilteredCount = 0;
    let totalDetailsFetched = 0;
    let hasMore = true;
    let lastPage = Math.floor(currentOffset / PAGE_SIZE);
    let consecutiveUnchangedPages = 0;
    let dateRangeInData: { oldest: string; newest: string } | null = null;

    for (let pageIdx = 0; pageIdx < PAGES_PER_REQUEST && hasMore; pageIdx++) {
      // Safety: abort before Cloudflare's 100s timeout
      if (Date.now() - requestStartTime > REQUEST_DEADLINE_MS) {
        console.log(`[sync-rently] Approaching timeout (${Math.round((Date.now() - requestStartTime) / 1000)}s), returning partial results`);
        break;
      }
      const currentPage = Math.floor(currentOffset / PAGE_SIZE) + 1;
      console.log(`[sync-rently] Processing page ${currentPage} (offset: ${currentOffset}, batch page ${pageIdx + 1}/${PAGES_PER_REQUEST})`);

      const pageResult = await fetchSinglePage(host, rentlyToken, currentOffset, incrementalSince);
      const { bookings, nextOffset } = pageResult;
      hasMore = pageResult.hasMore;

      if (bookings.length === 0) {
        hasMore = false;
        break;
      }

      totalBookingsFetched += bookings.length;
      lastPage = currentPage;

      const eventRows = deduplicateRentlyBookingsByStableId(bookings)
        .map((booking) => mapBookingToRentlyEvent(booking, organizationId));
      const { error: eventWriteError } = await serviceClient.from('rently_booking_events')
        .upsert(eventRows, { onConflict: 'organization_id,external_booking_id' });
      if (eventWriteError) {
        throw new Error(`No se pudieron conservar los eventos del listado Rently (${eventWriteError.code ?? 'UNKNOWN'})`);
      }

      // Track date range
      const pageDates = bookings.map(b => b.FromDate).filter(Boolean).map(d => new Date(d!).getTime());
      if (pageDates.length > 0) {
        const pageOldest = Math.min(...pageDates);
        const pageNewest = Math.max(...pageDates);
        if (!dateRangeInData) {
          dateRangeInData = { oldest: new Date(pageOldest).toISOString(), newest: new Date(pageNewest).toISOString() };
        } else {
          if (pageOldest < new Date(dateRangeInData.oldest).getTime()) dateRangeInData.oldest = new Date(pageOldest).toISOString();
          if (pageNewest > new Date(dateRangeInData.newest).getTime()) dateRangeInData.newest = new Date(pageNewest).toISOString();
        }
      }

      // Check which bookings already exist in DB
      const allExternalIds = bookings.map((b) => String(b.Id));
      const { data: existingInDb } = await serviceClient
        .from("reservations")
        .select("external_reservation_id, rently_detail_synced_at, rently_status_code")
        .eq("organization_id", organizationId)
        .in("external_reservation_id", allExternalIds);

      const existingIdsSet = new Set(existingInDb?.map((r) => r.external_reservation_id) || []);
      const detailSyncedMap = new Map<string, string | null>();
      const existingStatusMap = new Map<string, number | null>();
      if (existingInDb) {
        existingInDb.forEach((r) => {
          detailSyncedMap.set(r.external_reservation_id, r.rently_detail_synced_at);
          existingStatusMap.set(r.external_reservation_id, r.rently_status_code);
        });
      }

      // Filter bookings
      const validBookings = deduplicateRentlyBookingsByStableId(bookings).filter((b) => {
        const extId = String(b.Id);
        return shouldIncludeRentlyBookingInSync({
          currentStatus: b.CurrentStatus,
          existsInPlanMint: existingIdsSet.has(extId),
          includeAll: includeAllForRun,
        });
      });
      const filteredCount = bookings.length - validBookings.length;
      totalFilteredCount += filteredCount;

      // Map to reservations
      const reservations = validBookings.map((b) => mapBookingToReservation(b, organizationId, userId, placesMap, documentTypeMap));

      // ─── SMART ENRICHMENT ──────────────────────────────────────────────
      // Only enrich bookings that are: new, never enriched, status changed, or active (status <= 2)
      const bookingIdsToEnrich: number[] = [];
      for (const reservation of reservations) {
        const extId = reservation.external_reservation_id as string;
        const bookingId = parseInt(extId);
        const isNew = !existingIdsSet.has(extId);
        const hasDetail = detailSyncedMap.get(extId);
        const currentStatus = reservation.rently_status_code as number | undefined;
        const previousStatus = existingStatusMap.get(extId);
        const isActiveStatus = currentStatus !== undefined && currentStatus <= 2;
        const statusChanged = previousStatus !== undefined && previousStatus !== null && previousStatus !== currentStatus;

        // Only enrich if: new, never had detail, status changed, or still active
        if (isNew || !hasDetail || statusChanged || isActiveStatus) {
          if (bookingIdsToEnrich.length < MAX_DETAIL_FETCHES_PER_BATCH) {
            bookingIdsToEnrich.push(bookingId);
          }
        }
      }

      // Fetch details in parallel (skip if approaching deadline)
      let detailsMap = new Map<number, { detail: RentlyBookingDetail; drivers: Array<{ Name?: string; Document?: string; License?: string }> }>();
      const timeRemaining = REQUEST_DEADLINE_MS - (Date.now() - requestStartTime);
      if (bookingIdsToEnrich.length > 0 && timeRemaining > 20_000) {
        detailsMap = await fetchDetailsInParallel(host, rentlyToken, bookingIdsToEnrich, DETAIL_CONCURRENCY);
        totalDetailsFetched += detailsMap.size;
        console.log(`[sync-rently] Page ${currentPage}: enriched ${detailsMap.size}/${bookingIdsToEnrich.length} bookings in parallel`);

        try {
          const customers = Array.from(detailsMap.values())
            .map(({ detail }) => detail.Customer)
            .filter((customer): customer is NonNullable<RentlyBookingDetail['Customer']> => Boolean(customer));
          const sesProfiles = await syncSesPersonProfiles(serviceClient, organizationId, userId, customers);
          console.log(`[sync-rently] SES profiles: ${sesProfiles.synced} synced, ${sesProfiles.skipped} skipped`);
        } catch (sesError) {
          console.error('[sync-rently] SES profile enrichment failed (non-blocking):', sesError);
        }
      } else if (bookingIdsToEnrich.length > 0) {
        console.log(`[sync-rently] Page ${currentPage}: skipping ${bookingIdsToEnrich.length} detail fetches (only ${Math.round(timeRemaining / 1000)}s remaining)`);
      }

      // Apply enrichment
      const enrichedReservations = reservations.map((reservation) => {
        const extId = reservation.external_reservation_id as string;
        const bookingId = parseInt(extId);
        const detailData = detailsMap.get(bookingId);
        if (detailData) {
          return enrichReservationWithDetail(reservation, detailData.detail, detailData.drivers, documentTypeMap);
        }
        return reservation;
      });

      // ─── DB WRITES ─────────────────────────────────────────────────────
      // Get existing reservations for this batch
      const externalIds = enrichedReservations.map((r) => r.external_reservation_id as string);
      const { data: existingReservations } = await serviceClient
        .from("reservations")
        .select("id, external_reservation_id, estado, confirmed_entrega_datetime, confirmed_devolucion_datetime, desde, hasta")
        .eq("organization_id", organizationId)
        .in("external_reservation_id", externalIds);

      const existingMap = new Map<string, { id: string; estado: string; confirmed_entrega_datetime: string | null; confirmed_devolucion_datetime: string | null; desde: string | null; hasta: string | null }>();
      if (existingReservations) {
        existingReservations.forEach((r) => {
          existingMap.set(r.external_reservation_id, {
            id: r.id,
            estado: r.estado || "",
            confirmed_entrega_datetime: r.confirmed_entrega_datetime || null,
            desde: r.desde || null,
            confirmed_devolucion_datetime: r.confirmed_devolucion_datetime || null,
            hasta: r.hasta || null,
          });
        });
      }

      // Separate new vs existing
      const newReservations: Record<string, unknown>[] = [];
      const statusUpdates: { id: string; newStatus: string; fullData: Record<string, unknown> }[] = [];

      for (const reservation of enrichedReservations) {
        const extId = reservation.external_reservation_id as string;
        const newStatus = reservation.estado as string;
        const existing = existingMap.get(extId);

        if (!existing) {
          newReservations.push(reservation);
        } else {
          const currentPriority = STATUS_PRIORITY[existing.estado] ?? -1;
          const newPriority = STATUS_PRIORITY[newStatus] ?? -1;

          // Allow status change if:
          // 1. New status is Cancelada (always allow cancellation from Rently)
          // 2. New priority is higher than current (normal forward progression)
          // 3. Current status is Cancelada but Rently now shows an active status
          //    (reservation was reactivated in Rently — trust Rently as source of truth)
          const isReactivation = existing.estado === "Cancelada" && newStatus !== "Cancelada";
          if (newStatus === "Cancelada" || newPriority > currentPriority || isReactivation) {
            statusUpdates.push({ id: existing.id, newStatus, fullData: reservation });
          } else {
            statusUpdates.push({ id: existing.id, newStatus: existing.estado, fullData: reservation });
          }
        }
      }

      // Track if this page had any new or changed bookings
      const pageHadChanges = newReservations.length > 0 || statusUpdates.some(u => u.newStatus !== existingMap.get(
        (u.fullData.external_reservation_id as string))?.estado
      );

      if (!pageHadChanges && detailsMap.size === 0) {
        consecutiveUnchangedPages++;
        if (!includeAllForRun && consecutiveUnchangedPages >= EARLY_TERM_UNCHANGED_PAGES && hasMore) {
          console.log(`[sync-rently] Early termination: ${consecutiveUnchangedPages} consecutive unchanged pages, skipping remaining old bookings`);
          // Don't set hasMore = false — we still want to mark sync as running
          // but we break out of the multi-page loop to return faster
          break;
        }
      } else {
        consecutiveUnchangedPages = 0;
      }

      // Insert new reservations (batch upsert)
      let insertedCount = 0;
      let duplicateCount = 0;
      const pageWriteFailures: RentlySyncWriteFailure[] = [];

      if (newReservations.length > 0) {
        const { data: insertedData, error: insertError } = await serviceClient
          .from("reservations")
          .upsert(newReservations, { onConflict: "organization_id,external_reservation_id", ignoreDuplicates: true })
          .select("id");

        if (insertError) {
          console.error("[sync-rently] Batch insert error, falling back to individual:", insertError);
          for (const reservation of newReservations) {
            const { error: singleError } = await serviceClient.from("reservations").insert(reservation);
            if (singleError) {
              if (singleError.code === "23505") duplicateCount++;
              else {
                pageWriteFailures.push({
                  operation: 'insert',
                  externalId: String(reservation.external_reservation_id ?? 'unknown'),
                  code: String(singleError.code ?? 'UNKNOWN'),
                });
                console.error("[sync-rently] Single insert rejected:", {
                  externalId: reservation.external_reservation_id,
                  code: singleError.code ?? 'UNKNOWN',
                });
              }
            } else {
              insertedCount++;
            }
          }
        } else {
          insertedCount = insertedData?.length || 0;
          duplicateCount = newReservations.length - insertedCount;
        }
      }

      // Apply status updates
      for (const update of statusUpdates) {
        const updateData: Record<string, unknown> = { ...update.fullData, estado: update.newStatus };
        delete updateData.organization_id;
        delete updateData.imported_by;
        delete updateData.external_reservation_id;

        // ─── SMART CONFIRMED DATETIME UPDATE ─────────────────────────────
        // RULE: If the user has manually edited the confirmed datetime (i.e. it
        // differs from the current desde/hasta), NEVER overwrite it — the user
        // intentionally moved the operation to a different time/day.
        // Only update confirmed datetime if it currently matches desde/hasta
        // (meaning the user hasn't touched it) AND Rently changed the date.
        const existingForConfirmed = existingMap.get(update.fullData.external_reservation_id as string);
        const newDesde = updateData.desde as string | null;
        const newHasta = updateData.hasta as string | null;
        const currentConfirmedEntrega = existingForConfirmed?.confirmed_entrega_datetime;
        const currentConfirmedDevolucion = existingForConfirmed?.confirmed_devolucion_datetime;

        // Helper: extract date portion (YYYY-MM-DD) from an ISO datetime string
        const getDatePortion = (dt: string): string => dt.substring(0, 10);

        // For entrega: check if user manually edited the confirmed datetime
        // by comparing it to the CURRENT desde (before this sync update)
        const currentDesde = existingForConfirmed?.desde || null;
        const currentHasta = existingForConfirmed?.hasta || null;

        if (newDesde && currentConfirmedEntrega) {
          // Was the confirmed datetime manually edited by the user?
          // If confirmed !== current desde, the user changed it → protect it
          const userEditedEntrega = currentDesde && currentConfirmedEntrega !== currentDesde;
          if (userEditedEntrega) {
            // User manually edited → NEVER overwrite
            delete updateData.confirmed_entrega_datetime;
          } else {
            // User hasn't touched it (confirmed === desde) → safe to update with new Rently date
            updateData.confirmed_entrega_datetime = newDesde;
          }
        } else {
          delete updateData.confirmed_entrega_datetime;
        }

        if (newHasta && currentConfirmedDevolucion) {
          // Was the confirmed datetime manually edited by the user?
          const userEditedDevolucion = currentHasta && currentConfirmedDevolucion !== currentHasta;
          if (userEditedDevolucion) {
            // User manually edited → NEVER overwrite
            delete updateData.confirmed_devolucion_datetime;
          } else {
            // User hasn't touched it (confirmed === hasta) → safe to update with new Rently date
            updateData.confirmed_devolucion_datetime = newHasta;
          }
        } else {
          delete updateData.confirmed_devolucion_datetime;
        }

        // ─── PROTECT USER-EDITABLE FIELDS ─────────────────────────────────
        // These fields can be manually edited by users in the reservations table.
        // The sync must NOT overwrite them with Rently data, because:
        // 1. Users may have corrected/customized addresses (e.g. "Parking G Aeropuerto")
        // 2. Users may have assigned a different vehicle than what Rently shows
        // 3. Rently data for these fields is often incomplete or null
        // The initial values are set when the reservation is first inserted (upsert).
        // Subsequent syncs only update Rently-sourced metadata (status, pricing, etc.)
        //
        // However, we DO always update the rently_* mirror columns so the UI can
        // show "edited manually" indicators and offer a "Restore from Rently" button.
        updateData.rently_lugar_entrega = updateData.lugar_entrega ?? null;
        updateData.rently_lugar_devolucion = updateData.lugar_devolucion ?? null;
        updateData.rently_lugar_entrega_direccion = updateData.lugar_entrega_direccion ?? null;
        updateData.rently_lugar_devolucion_direccion = updateData.lugar_devolucion_direccion ?? null;

        delete updateData.lugar_entrega;
        delete updateData.lugar_devolucion;
        delete updateData.lugar_entrega_direccion;
        delete updateData.lugar_devolucion_direccion;
        delete updateData.lugar_entrega_ciudad;
        delete updateData.lugar_devolucion_ciudad;

        // ─── PROTECT OPERATIONAL FIELDS (Programación) ─────────────────────
        // These fields are managed exclusively by users in the Programación view.
        // Rently never provides them, but we delete them defensively to ensure
        // they are never accidentally overwritten by future mapping changes.
        delete updateData.checkin;
        delete updateData.checkin_entrega;
        delete updateData.checkin_devolucion;
        delete updateData.pagado;
        delete updateData.pagado_entrega;
        delete updateData.pagado_devolucion;
        delete updateData.hosp;
        delete updateData.hosp_entrega;
        delete updateData.hosp_devolucion;
        delete updateData.contacto;
        delete updateData.contacto_entrega;
        delete updateData.contacto_devolucion;
        delete updateData.notas;
        delete updateData.notas_entrega;
        delete updateData.notas_devolucion;

        // The list endpoint returns a lightweight customer/car DTO. Never let
        // missing values from that summary erase richer data previously loaded
        // from /api/booking/{id} and /api/customer/{id} for SES.HOSPEDAJES.
        removeEmptyRentlyEnrichmentFields(updateData);

        // Note: auto, modelo, notas_internas are also user-editable but we keep
        // syncing them from Rently because vehicle assignment changes in Rently
        // should be reflected. Users rarely change these manually.

        if (update.newStatus === "Completada") {
          updateData.estado_terminada_at = new Date().toISOString();
        }
        if (update.newStatus === "Cancelada") {
          updateData.estado_entrega = "Cancelada";
          updateData.estado_devolucion = "Cancelada";
        }

        // Undo cancellation side-effects when a reservation is reactivated
        const existingEntry = existingMap.get(update.fullData.external_reservation_id as string);
        if (existingEntry?.estado === "Cancelada" && update.newStatus !== "Cancelada") {
          // Clear the cancellation markers on sub-statuses
          updateData.estado_entrega = null;
          updateData.estado_devolucion = null;
          console.log(`[sync-rently] Reactivated reservation ${update.fullData.external_reservation_id}: ${existingEntry.estado} → ${update.newStatus}`);

          // ─── LOG REACTIVATION EVENT ─────────────────────────────────────
          const clienteName = [update.fullData.cliente_nombre, update.fullData.cliente_apellido].filter(Boolean).join(' ') || 'Sin nombre';
          const vehiclePlate = (update.fullData.auto as string) || 'N/A';
          try {
            await serviceClient.from('reservation_status_history').insert({
              organization_id: organizationId,
              reservation_id: existingEntry.id,
              external_reservation_id: update.fullData.external_reservation_id as string,
              old_status: existingEntry.estado,
              new_status: update.newStatus,
              change_type: 'reactivation_auto',
              changed_by_name: 'Sistema (Sync Rently)',
              notes: `Reserva reactivada automáticamente desde Rently. Cliente: ${clienteName}, Vehículo: ${vehiclePlate}`,
            });
          } catch (logErr) {
            console.error('[sync-rently] Failed to insert reactivation log:', logErr);
          }

          // ─── NOTIFY ADMIN ──────────────────────────────────────────────
          try {
            await notifyOwner({
              title: '⚠️ Reserva reactivada automáticamente',
              content: `La reserva #${update.fullData.external_reservation_id} (${clienteName} — ${vehiclePlate}) pasó de Cancelada a ${update.newStatus} tras sincronizar con Rently.`,
            });
          } catch (notifyErr) {
            console.error('[sync-rently] Failed to notify owner about reactivation:', notifyErr);
          }
        }

        // ─── LOG ALL STATUS CHANGES FROM SYNC ─────────────────────────────
        const existingStatus = existingEntry?.estado || null;
        if (existingStatus !== update.newStatus) {
          // Only log if not already logged as reactivation above
          const isReactivation = existingStatus === "Cancelada" && update.newStatus !== "Cancelada";
          if (!isReactivation) {
            try {
              await serviceClient.from('reservation_status_history').insert({
                organization_id: organizationId,
                reservation_id: update.id,
                external_reservation_id: update.fullData.external_reservation_id as string,
                old_status: existingStatus,
                new_status: update.newStatus,
                change_type: 'sync_rently',
                changed_by_name: 'Sistema (Sync Rently)',
                notes: `Cambio de estado automático desde Rently: ${existingStatus || '(nuevo)'} → ${update.newStatus}`,
              });
            } catch (logErr) {
              // Non-critical, don't break sync
              console.error('[sync-rently] Failed to log status change:', logErr);
            }
          }
        }

        const { error: updateError } = await serviceClient.from("reservations").update(updateData).eq("id", update.id);
        if (updateError) {
          pageWriteFailures.push({
            operation: 'update',
            externalId: String(update.fullData.external_reservation_id ?? 'unknown'),
            code: String(updateError.code ?? 'UNKNOWN'),
          });
          console.error('[sync-rently] Reservation update rejected:', {
            externalId: update.fullData.external_reservation_id,
            code: updateError.code ?? 'UNKNOWN',
          });
        }
      }

      if (pageWriteFailures.length > 0) {
        const failureSummary = summarizeRentlySyncWriteFailures(pageWriteFailures);
        await serviceClient.from('rently_sync_status').update({
          status: 'error',
          error_message: failureSummary,
          updated_at: new Date().toISOString(),
        }).eq('id', syncStatus.id);
        try {
          await notifyOwner({
            title: 'Error crítico en sincronización Rently',
            content: `${failureSummary}. El cursor y el watermark no han avanzado; revisa la sincronización antes de continuar.`,
          });
        } catch (notificationError) {
          console.error('[sync-rently] Failed to notify owner about write rejection:', notificationError);
        }
        throw new Error(failureSummary);
      }

      totalInsertedCount += insertedCount;
      totalDuplicateCount += duplicateCount;

      console.log(`[sync-rently] Page ${currentPage}: ${insertedCount} inserted, ${duplicateCount} dupes, ${detailsMap.size} enriched`);

      // Advance offset
      currentOffset = nextOffset || currentOffset + bookings.length;
    }

    // ─── UPDATE SYNC STATUS ──────────────────────────────────────────────
    const newTotalFetched = syncStatus.total_fetched + totalBookingsFetched;
    const newTotalInserted = syncStatus.total_inserted + totalInsertedCount;
    const newTotalDuplicates = syncStatus.total_duplicates + totalDuplicateCount;
    const newTotalFiltered = syncStatus.total_filtered + totalFilteredCount;
    const finalStatus = hasMore ? "running" : "completed";
    const completedAt = hasMore ? null : new Date().toISOString();

    const syncStatusUpdate: Record<string, unknown> = {
      last_offset: currentOffset,
      total_fetched: newTotalFetched,
      total_inserted: newTotalInserted,
      total_duplicates: newTotalDuplicates,
      total_filtered: newTotalFiltered,
      status: finalStatus,
      completed_at: completedAt,
    };
    if (!hasMore) {
      syncStatusUpdate.watermark_updated_at = syncStatus.started_at || completedAt;
      if (syncMode === 'full') syncStatusUpdate.last_full_sync_at = completedAt;
      const startedAt = syncStatus.started_at || completedAt;
      syncStatusUpdate.coverage_version = `${startedAt}:${completedAt}:${currentOffset}`;
      syncStatusUpdate.coverage_scope = buildRentlyEventCoverageScope({
        syncMode,
        startedAt: startedAt!,
        completedAt: completedAt!,
        paginationStartOffset: Number(syncStatus.coverage_scope?.paginationStartOffset ?? 0),
        paginationEndOffset: currentOffset,
        localReservationImportIncludesAllStatuses: includeAllForRun,
      });
    }

    await serviceClient
      .from("rently_sync_status")
      .update(syncStatusUpdate)
      .eq("id", syncStatus.id);

    console.log(
      `[sync-rently] Batch complete: pages ${Math.floor(syncStatus.last_offset / PAGE_SIZE) + 1}-${lastPage}, ${totalInsertedCount} inserted, ${totalDetailsFetched} enriched, hasMore: ${hasMore}`
    );

    // Archive and sync vehicles if complete
    let archivedCount = 0;
    let vehicleSyncResult = { released: 0, rented: 0, errors: 0 };
    if (!hasMore && !includeAllForRun) {
      try {
        console.log("[sync-rently] Sync complete, archiving old reservations...");
        const { data: archiveResult, error: archiveError } = await serviceClient.rpc(
          "archive_old_reservations",
          { org_id: organizationId }
        );
        if (!archiveError && archiveResult) {
          archivedCount = typeof archiveResult === "number" ? archiveResult : 0;
        }
      } catch (archiveError) {
        console.error("[sync-rently] Error archiving:", archiveError);
      }

      try {
        console.log("[sync-rently] Syncing vehicle statuses...");
        vehicleSyncResult = await syncVehicleStatuses(serviceClient, organizationId);
      } catch (vehicleSyncError) {
        console.error("[sync-rently] Error syncing vehicle statuses:", vehicleSyncError);
      }
    }

    return res.json({
      success: true,
      hasMore,
      page: lastPage,
      progress: {
        fetched: totalBookingsFetched,
        inserted: totalInsertedCount,
        duplicates: totalDuplicateCount,
        filtered: totalFilteredCount,
        enriched: totalDetailsFetched,
        totalFetched: newTotalFetched,
        totalInserted: newTotalInserted,
        totalDuplicates: newTotalDuplicates,
      },
      archived: archivedCount,
      date_range_in_data: dateRangeInData,
    });
  } catch (error: any) {
    console.error("[sync-rently] Error:", error);
    const status = error instanceof AuthError ? error.status : 500;
    return res.status(status).json({
      success: false,
      hasMore: false,
      page: 0,
      progress: {
        fetched: 0,
        inserted: 0,
        duplicates: 0,
        filtered: 0,
        enriched: 0,
        totalFetched: 0,
        totalInserted: 0,
        totalDuplicates: 0,
      },
      error: error?.message || "Error desconocido",
    });
  }
}
