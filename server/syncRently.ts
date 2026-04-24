/**
 * POST /api/sync-rently
 * Migrated from Supabase Edge Function sync-rently.
 * Syncs reservations from the Rently API into Supabase.
 */
import type { Request, Response } from "express";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RentlyBooking {
  Id: number;
  CreationDate?: string;
  CurrentStatus: number;
  Customer?: {
    Firstname?: string;
    Lastname?: string;
    EmailAddress?: string;
    CellPhone?: string;
    DocumentTypeId?: number;
    DocumentId?: string;
  };
  CustomerPrice?: number;
  Car?: {
    Id?: number;
    Plate?: string;
    Model?: { Name?: string; Category?: { Name?: string } };
  };
  FromDate?: string;
  ToDate?: string;
  TotalDays?: number;
  DeliveryPlace?: { Name?: string; Address?: string };
  ReturnPlace?: { Name?: string; Address?: string };
  DropoffInfo?: { Date?: string };
  Origin?: { Name?: string };
}

interface RentlyBookingDetail extends RentlyBooking {
  Balance?: number;
  TotalPayed?: number;
  PrepaidAmount?: number;
  PayedByAgency?: number;
  PayedByCustomer?: number;
  // Currency is a top-level string (e.g. "EUR"), NOT an object
  Currency?: string;
  // Note: API typo — single 's' in "SalesCommision"
  SalesCommision?: number;
  IsTransfer?: boolean;
  IsQuotation?: boolean;
  Version?: string;
  // Rate fields are at the top level, not nested in a Rate object
  DailyRate?: number;
  HourlyRate?: number;
  ExtraDayRate?: number;
  ExtraHourRate?: number;
  IlimitedKm?: boolean;
  MaxAllowedDistance?: number;
  MaxAllowedDistanceByDay?: number;
  Car?: {
    Id?: number;
    Plate?: string;
    Kms?: number;
    FuelLevel?: number;
    Color?: string;
    Year?: number;
    ChassisId?: string;
    FuelType?: { Name?: string };
    Model?: { Name?: string; Category?: { Name?: string } };
  };
  DeliveryPlace?: { Name?: string; Address?: string; City?: string };
  ReturnPlace?: { Name?: string; Address?: string; City?: string };
  Customer?: {
    Firstname?: string;
    Lastname?: string;
    EmailAddress?: string;
    CellPhone?: string;
    DocumentTypeId?: number;
    DocumentId?: string;
    Address?: string;
    City?: string;
    State?: string;
    Country?: string;
    Age?: number;
    BirthDate?: string;
    DriverLicenseNumber?: string;
    DriverLicenseCountry?: string;
    DriverLicenseExpiration?: string;
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
  completed_at: string | null;
  error_message: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_MAP: Record<number, string> = {
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

const EXCLUDED_NEW_STATUSES = [5]; // Cotizado
const CANCELLATION_STATUS = 4;
const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 45000;
const DETAIL_TIMEOUT_MS = 15000;
const MAX_DETAIL_FETCHES_PER_PAGE = 50;

// ─── Rently API helpers ──────────────────────────────────────────────────────

async function getRentlyToken(host: string, clientId: string, clientSecret: string): Promise<string> {
  console.log(`[sync-rently] Getting Rently token from ${host}...`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`https://${host}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Auth failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log("[sync-rently] Rently token obtained successfully");
    return data.access_token;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error?.name === "AbortError") throw new Error("Timeout obteniendo token de Rently");
    throw error;
  }
}

async function fetchSinglePage(
  host: string,
  token: string,
  offset: number
): Promise<{ bookings: RentlyBooking[]; nextOffset: number | null; hasMore: boolean }> {
  const params = new URLSearchParams({ offset: String(offset), limit: String(PAGE_SIZE) });
  const url = `https://${host}/api/bookings?${params}`;
  console.log(`[sync-rently] Fetching page at offset ${offset}...`);

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

    console.log(`[sync-rently] Page fetched: ${bookings.length} bookings, nextOffset: ${nextOffset}, hasMore: ${hasMore}`);
    return { bookings, nextOffset, hasMore };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error?.name === "AbortError") throw new Error("Timeout fetching page from Rently");
    throw error;
  }
}

async function fetchBookingDetail(host: string, token: string, bookingId: number): Promise<RentlyBookingDetail | null> {
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

async function fetchBookingDrivers(
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

// ─── Mapping helpers ─────────────────────────────────────────────────────────

function mapBookingToReservation(
  booking: RentlyBooking,
  organizationId: string,
  userId: string
): Record<string, unknown> {
  const customer = booking.Customer || {};
  const car = booking.Car || {};
  const carModel = car.Model || {};
  const category = carModel.Category || {};
  const deliveryPlace = booking.DeliveryPlace || {};
  const returnPlace = booking.ReturnPlace || {};
  const dropoffInfo = booking.DropoffInfo || {};
  const origin = booking.Origin || {};

  return {
    organization_id: organizationId,
    imported_by: userId,
    external_reservation_id: String(booking.Id),
    estado: STATUS_MAP[booking.CurrentStatus] || `Status ${booking.CurrentStatus}`,
    rently_status_code: booking.CurrentStatus,
    cliente_nombre: customer.Firstname || null,
    cliente_apellido: customer.Lastname || null,
    email: customer.EmailAddress || null,
    telefono: customer.CellPhone || null,
    tipo_documento_cliente: customer.DocumentTypeId
      ? DOCUMENT_TYPE_MAP[customer.DocumentTypeId] || null
      : null,
    documento_cliente: customer.DocumentId || null,
    modelo: carModel.Name || null,
    auto: car.Plate || (car.Id ? String(car.Id) : null),
    categoria: category.Name || null,
    desde: booking.FromDate || null,
    hasta: booking.ToDate || null,
    devolucion: dropoffInfo.Date || null,
    // Hora confirmada: se establece solo en la primera inserción, nunca se sobreescribe en syncs posteriores
    confirmed_entrega_datetime: booking.FromDate || null,
    confirmed_devolucion_datetime: booking.ToDate || null,
    duracion: booking.TotalDays ? String(booking.TotalDays) : null,
    lugar_entrega: deliveryPlace.Name || null,
    lugar_devolucion: returnPlace.Name || null,
    precio: booking.CustomerPrice || null,
    origen_reserva: origin.Name || null,
  };
}

function enrichReservationWithDetail(
  reservation: Record<string, unknown>,
  detail: RentlyBookingDetail,
  drivers: Array<{ Name?: string; Document?: string; License?: string }>
): Record<string, unknown> {
  const car = detail.Car || {};
  const customer = detail.Customer || {};
  const deliveryPlace = detail.DeliveryPlace || {};
  const returnPlace = detail.ReturnPlace || {};

  return {
    ...reservation,
    balance: detail.Balance ?? null,
    total_pagado_rently: detail.TotalPayed ?? null,
    prepago: detail.PrepaidAmount ?? null,
    pagado_por_agencia: detail.PayedByAgency ?? null,
    pagado_por_cliente: detail.PayedByCustomer ?? null,
    moneda: detail.Currency || null, // Currency is a top-level string (e.g. "EUR")
    comision_ventas: detail.SalesCommision ?? null, // API typo: single 's'
    vehiculo_kms: car.Kms ?? null,
    vehiculo_combustible: car.FuelLevel ?? null,
    vehiculo_color: car.Color || null,
    vehiculo_anio: car.Year ?? null,
    vehiculo_chasis: car.ChassisId || null,
    vehiculo_tipo_combustible: car.FuelType?.Name || null,
    // Rate fields are at the top level of the detail, not nested
    tarifa_diaria: detail.DailyRate ?? null,
    tarifa_hora: detail.HourlyRate ?? null,
    tarifa_dia_extra: detail.ExtraDayRate ?? null,
    tarifa_hora_extra: detail.ExtraHourRate ?? null,
    km_ilimitados: detail.IlimitedKm ?? null,
    km_max_permitidos: detail.MaxAllowedDistance ?? null,
    km_max_por_dia: detail.MaxAllowedDistanceByDay ?? null,
    rently_status_code: detail.CurrentStatus,
    rently_status_date: new Date().toISOString(),
    es_transferencia: detail.IsTransfer ?? false,
    es_cotizacion: detail.IsQuotation ?? false,
    rently_version: detail.Version || null,
    lugar_entrega_direccion: deliveryPlace.Address || null,
    lugar_entrega_ciudad: deliveryPlace.City || null,
    lugar_devolucion_direccion: returnPlace.Address || null,
    lugar_devolucion_ciudad: returnPlace.City || null,
    cliente_direccion: customer.Address || null,
    cliente_ciudad: customer.City || null,
    cliente_estado_provincia: customer.State || null,
    cliente_pais: customer.Country || null,
    cliente_edad: customer.Age ?? null,
    cliente_fecha_nacimiento: customer.BirthDate || null,
    cliente_carnet_numero: customer.DriverLicenseNumber || null,
    cliente_carnet_pais: customer.DriverLicenseCountry || null,
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

/**
 * Reconcile vehicle statuses with their linked reservations.
 * Vehicles with status='alquilado' whose reservation is 'Completada' or 'Cancelada'
 * should be released back to 'sucio' (ready for cleaning cycle).
 * Also handles setting vehicles to 'alquilado' for active reservations.
 */
async function syncVehicleStatuses(
  serviceClient: ReturnType<typeof getServiceClient>,
  organizationId: string
): Promise<{ released: number; rented: number; errors: number }> {
  let released = 0;
  let rented = 0;
  let errors = 0;

  try {
    // 1. Find all vehicles currently marked as 'alquilado' with a current_reservation_id
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
      // Get the reservation statuses
      const reservationIds = rentedVehicles.map(v => v.current_reservation_id).filter(Boolean) as string[];
      const { data: reservations } = await serviceClient
        .from("reservations")
        .select("id, estado")
        .in("id", reservationIds);

      const reservationMap = new Map<string, string>();
      if (reservations) {
        reservations.forEach(r => reservationMap.set(r.id, r.estado || ""));
      }

      // Release vehicles whose reservation is completed or cancelled
      for (const vehicle of rentedVehicles) {
        const resStatus = reservationMap.get(vehicle.current_reservation_id!);
        if (resStatus === "Completada" || resStatus === "Cancelada") {
          try {
            // Reset cleaning tasks
            await serviceClient
              .from("vehicle_cleaning_tasks")
              .update({
                completed: false,
                completed_at: null,
                completed_by: null,
              })
              .eq("vehicle_id", vehicle.id);

            // Update vehicle status to sucio and clear reservation link
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

    // 2. Find active reservations (En curso) that should mark vehicles as alquilado
    const now = new Date().toISOString();
    const { data: activeReservations } = await serviceClient
      .from("reservations")
      .select("id, auto, cliente_nombre, cliente_apellido")
      .eq("organization_id", organizationId)
      .eq("estado", "En curso")
      .not("auto", "is", null);

    if (activeReservations && activeReservations.length > 0) {
      for (const res of activeReservations) {
        if (!res.auto) continue;

        // Check if the vehicle exists and is not already alquilado
        const { data: vehicle } = await serviceClient
          .from("vehicles")
          .select("id, status, current_reservation_id")
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
          }
        } else if (vehicle && vehicle.status === "alquilado" && vehicle.current_reservation_id !== res.id) {
          // Update the reservation link if it points to a different reservation
          await serviceClient
            .from("vehicles")
            .update({ current_reservation_id: res.id })
            .eq("id", vehicle.id);
        }
      }
    }

    // 3. Detect orphaned vehicles: still marked 'alquilado' but the linked reservation's
    //    'auto' field no longer matches their matricula (vehicle swap in Rently).
    //    This handles the case where a reservation changed its vehicle (e.g., 5078LVJ → 4005NLH)
    //    but the old vehicle still shows as 'alquilado' because the reservation is still 'En curso'.
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
        if (!linkedRes) continue; // reservation not found, skip (handled by step 1 if needed)

        // If the reservation's auto no longer matches this vehicle's matricula,
        // the vehicle was swapped out → release it
        if (linkedRes.auto && linkedRes.auto !== vehicle.matricula) {
          try {
            // Reset cleaning tasks
            await serviceClient
              .from("vehicle_cleaning_tasks")
              .update({
                completed: false,
                completed_at: null,
                completed_by: null,
              })
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
              console.log(`[sync-vehicles] Released swapped vehicle ${vehicle.matricula} (reservation auto changed to ${linkedRes.auto})`);
              released++;
            }
          } catch (err) {
            console.error(`[sync-vehicles] Exception releasing swapped vehicle ${vehicle.matricula}:`, err);
            errors++;
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

export async function handleSyncRently(req: Request, res: Response) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Authenticate user via Supabase JWT
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    const serviceClient = getServiceClient();

    // Get Rently credentials from integration_settings
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

    const { continue_sync, reset, test_only, action } = req.body || {};

    // Handle sync_vehicles action separately (no Rently API needed)
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

    const shouldReset =
      reset || !syncStatus || syncStatus.status === "completed" || syncStatus.status === "error" || syncStatus.status === "idle";

    if (shouldReset) {
      const newStatus = {
        organization_id: organizationId,
        last_offset: 0,
        total_fetched: 0,
        total_inserted: 0,
        total_duplicates: 0,
        total_filtered: 0,
        status: "running",
        started_at: new Date().toISOString(),
        completed_at: null,
        error_message: null,
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

    // Fetch ONE page from Rently
    const currentOffset = syncStatus.last_offset;
    const currentPage = Math.floor(currentOffset / PAGE_SIZE) + 1;
    console.log(`[sync-rently] Processing page ${currentPage} (offset: ${currentOffset})`);

    const { bookings, nextOffset, hasMore } = await fetchSinglePage(host, rentlyToken, currentOffset);

    // Check which bookings already exist in DB
    const allExternalIds = bookings.map((b) => String(b.Id));
    const { data: existingInDb } = await serviceClient
      .from("reservations")
      .select("external_reservation_id, rently_detail_synced_at")
      .eq("organization_id", organizationId)
      .in("external_reservation_id", allExternalIds);

    const existingIdsSet = new Set(existingInDb?.map((r) => r.external_reservation_id) || []);
    const detailSyncedMap = new Map<string, string | null>();
    if (existingInDb) {
      existingInDb.forEach((r) => {
        detailSyncedMap.set(r.external_reservation_id, r.rently_detail_synced_at);
      });
    }

    // Filter bookings
    const validBookings = bookings.filter((b) => {
      const extId = String(b.Id);
      if (existingIdsSet.has(extId)) {
        return b.CurrentStatus !== 5; // Existing: allow Cancelada, exclude only Cotizado
      } else {
        return !EXCLUDED_NEW_STATUSES.includes(b.CurrentStatus) && b.CurrentStatus !== CANCELLATION_STATUS;
      }
    });
    const filteredCount = bookings.length - validBookings.length;

    // Map to reservations
    let reservations = validBookings.map((b) => mapBookingToReservation(b, organizationId, userId));

    // Fetch detailed data for bookings that need it
    let detailsFetched = 0;
    const enrichedReservations: Record<string, unknown>[] = [];

    for (let i = 0; i < reservations.length; i++) {
      const reservation = reservations[i];
      const extId = reservation.external_reservation_id as string;
      const bookingId = parseInt(extId);
      const isNew = !existingIdsSet.has(extId);
      const hasDetail = detailSyncedMap.get(extId);
      const currentStatus = (reservation as Record<string, unknown>).rently_status_code as number | undefined;
      const isActiveStatus = currentStatus !== undefined && currentStatus <= 2;
      const needsDetail = isNew || !hasDetail || isActiveStatus;

      if (detailsFetched < MAX_DETAIL_FETCHES_PER_PAGE && needsDetail) {
        try {
          const detail = await fetchBookingDetail(host, rentlyToken, bookingId);
          if (detail) {
            const drivers = await fetchBookingDrivers(host, rentlyToken, bookingId);
            enrichedReservations.push(enrichReservationWithDetail(reservation, detail, drivers));
            detailsFetched++;
            continue;
          }
        } catch (err: any) {
          console.warn(`[sync-rently] Failed to enrich booking ${bookingId}:`, err);
        }
      }
      enrichedReservations.push(reservation);
    }

    reservations = enrichedReservations;
    console.log(`[sync-rently] Enriched ${detailsFetched} bookings with detail data`);

    // Get existing reservations for this batch
    const externalIds = reservations.map((r) => r.external_reservation_id as string);
    const { data: existingReservations } = await serviceClient
      .from("reservations")
      .select("id, external_reservation_id, estado")
      .eq("organization_id", organizationId)
      .in("external_reservation_id", externalIds);

    const existingMap = new Map<string, { id: string; estado: string }>();
    if (existingReservations) {
      existingReservations.forEach((r) => {
        existingMap.set(r.external_reservation_id, { id: r.id, estado: r.estado || "" });
      });
    }

    // Separate new vs existing
    const newReservations: Record<string, unknown>[] = [];
    const statusUpdates: { id: string; newStatus: string; fullData: Record<string, unknown> }[] = [];

    for (const reservation of reservations) {
      const extId = reservation.external_reservation_id as string;
      const newStatus = reservation.estado as string;
      const existing = existingMap.get(extId);

      if (!existing) {
        newReservations.push(reservation);
      } else {
        const currentPriority = STATUS_PRIORITY[existing.estado] ?? -1;
        const newPriority = STATUS_PRIORITY[newStatus] ?? -1;

        if (newStatus === "Cancelada" || newPriority > currentPriority) {
          statusUpdates.push({ id: existing.id, newStatus, fullData: reservation });
        } else {
          statusUpdates.push({ id: existing.id, newStatus: existing.estado, fullData: reservation });
        }
      }
    }

    // Insert new reservations
    let insertedCount = 0;
    let duplicateCount = 0;

    if (newReservations.length > 0) {
      const { data: insertedData, error: insertError } = await serviceClient
        .from("reservations")
        .upsert(newReservations, { onConflict: "organization_id,external_reservation_id", ignoreDuplicates: true })
        .select("id");

      if (insertError) {
        console.error("[sync-rently] Insert error:", insertError);
        for (const reservation of newReservations) {
          const { error: singleError } = await serviceClient.from("reservations").insert(reservation);
          if (singleError) {
            if (singleError.code === "23505") duplicateCount++;
            else console.error("[sync-rently] Single insert error:", singleError);
          } else {
            insertedCount++;
          }
        }
      } else {
        insertedCount = insertedData?.length || 0;
        duplicateCount = newReservations.length - insertedCount;
      }
    }

    // Apply status updates and sync enriched fields
    for (const update of statusUpdates) {
      const updateData: Record<string, unknown> = { ...update.fullData, estado: update.newStatus };
      delete updateData.organization_id;
      delete updateData.imported_by;
      delete updateData.external_reservation_id;
      // NEVER overwrite confirmed datetimes on sync - these are manually managed
      delete updateData.confirmed_entrega_datetime;
      delete updateData.confirmed_devolucion_datetime;

      if (update.newStatus === "Completada") {
        updateData.estado_terminada_at = new Date().toISOString();
      }
      if (update.newStatus === "Cancelada") {
        console.log(`[sync-rently] Updating reservation to Cancelada: ${update.id}`);
        updateData.estado_entrega = "Cancelada";
        updateData.estado_devolucion = "Cancelada";
      }

      await serviceClient.from("reservations").update(updateData).eq("id", update.id);
    }

    // Update sync status
    const newTotalFetched = syncStatus.total_fetched + bookings.length;
    const newTotalInserted = syncStatus.total_inserted + insertedCount;
    const newTotalDuplicates = syncStatus.total_duplicates + duplicateCount;
    const newTotalFiltered = syncStatus.total_filtered + filteredCount;
    const finalStatus = hasMore ? "running" : "completed";
    const completedAt = hasMore ? null : new Date().toISOString();
    const newOffset = nextOffset || currentOffset + bookings.length;

    await serviceClient
      .from("rently_sync_status")
      .update({
        last_offset: newOffset,
        total_fetched: newTotalFetched,
        total_inserted: newTotalInserted,
        total_duplicates: newTotalDuplicates,
        total_filtered: newTotalFiltered,
        status: finalStatus,
        completed_at: completedAt,
      })
      .eq("id", syncStatus.id);

    console.log(
      `[sync-rently] Page ${currentPage} complete: ${insertedCount} inserted, ${duplicateCount} duplicates, ${detailsFetched} enriched, hasMore: ${hasMore}`
    );

    // Archive old reservations and sync vehicle statuses if sync is complete
    let archivedCount = 0;
    let vehicleSyncResult = { released: 0, rented: 0, errors: 0 };
    if (!hasMore) {
      try {
        console.log("[sync-rently] Sync complete, archiving old reservations...");
        const { data: archiveResult, error: archiveError } = await serviceClient.rpc(
          "archive_old_reservations",
          { org_id: organizationId }
        );
        if (!archiveError && archiveResult) {
          archivedCount = typeof archiveResult === "number" ? archiveResult : 0;
          console.log(`[sync-rently] Archive result: ${archivedCount} reservations archived`);
        }
      } catch (archiveError) {
        console.error("[sync-rently] Error archiving:", archiveError);
      }

      // Sync vehicle statuses after all reservations are updated
      try {
        console.log("[sync-rently] Syncing vehicle statuses...");
        vehicleSyncResult = await syncVehicleStatuses(serviceClient, organizationId);
      } catch (vehicleSyncError) {
        console.error("[sync-rently] Error syncing vehicle statuses:", vehicleSyncError);
      }
    }

    // Calculate date range
    const allDates = bookings
      .map((b) => b.FromDate)
      .filter(Boolean)
      .map((d) => new Date(d!).getTime());
    const dateRangeInData =
      allDates.length > 0
        ? { oldest: new Date(Math.min(...allDates)).toISOString(), newest: new Date(Math.max(...allDates)).toISOString() }
        : null;

    return res.json({
      success: true,
      hasMore,
      page: currentPage,
      progress: {
        fetched: bookings.length,
        inserted: insertedCount,
        duplicates: duplicateCount,
        filtered: filteredCount,
        enriched: detailsFetched,
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
