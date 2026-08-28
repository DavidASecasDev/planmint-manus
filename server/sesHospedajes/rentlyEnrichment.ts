import type { SupabaseClient } from '@supabase/supabase-js';
import {
  enrichReservationWithDetail,
  fetchBookingDetail,
  fetchBookingDrivers,
  getRentlyToken,
  type RentlyBookingDetail,
} from '../syncRently';
import { syncSesPersonProfiles, type RentlyCustomerForSes } from './rentlyProfiles';

const DETAIL_FIELDS = [
  'cliente_nombre', 'cliente_apellido', 'email', 'telefono',
  'tipo_documento_cliente', 'documento_cliente',
  'extras_contratados', 'desglose_precios', 'conductores_adicionales',
  'cliente_direccion', 'cliente_ciudad', 'cliente_estado_provincia', 'cliente_pais',
  'cliente_fecha_nacimiento', 'cliente_carnet_numero', 'cliente_carnet_pais',
  'cliente_carnet_expiracion', 'cliente_notas', 'vehiculo_kms', 'vehiculo_combustible',
  'vehiculo_color', 'vehiculo_anio', 'vehiculo_chasis', 'vehiculo_tipo_combustible',
  'balance', 'total_pagado_rently', 'prepago', 'pagado_por_agencia',
  'pagado_por_cliente', 'moneda', 'comision_ventas', 'tarifa_diaria', 'tarifa_hora',
  'tarifa_dia_extra', 'tarifa_hora_extra', 'km_ilimitados', 'km_max_permitidos',
  'km_max_por_dia', 'rently_detail_synced_at',
  'rently_delivery_branch_office_id', 'rently_delivery_actual_at',
  'rently_detail_booking_id', 'rently_detail_vehicle_plate',
] as const;

export interface ReservationForSesEnrichment extends Record<string, unknown> {
  id: string;
  external_reservation_id: string | null;
  auto?: string | null;
  imported_by?: string | null;
  rently_detail_synced_at?: string | null;
  vehiculo_chasis?: string | null;
  vehiculo_kms?: number | null;
  cliente_fecha_nacimiento?: string | null;
  cliente_direccion?: string | null;
  cliente_pais?: unknown;
  cliente_carnet_numero?: string | null;
  cliente_carnet_expiracion?: string | null;
  estado?: string | null;
  rently_status_code?: number | null;
  es_transferencia?: boolean | null;
  rently_delivery_branch_office_id?: number | null;
  rently_delivery_actual_at?: string | null;
  rently_detail_booking_id?: number | null;
  rently_detail_vehicle_plate?: string | null;
}

export function needsRentlySesEnrichment(reservation: ReservationForSesEnrichment) {
  return !reservation.vehiculo_chasis
    || reservation.vehiculo_kms === null
    || reservation.vehiculo_kms === undefined
    || !reservation.cliente_fecha_nacimiento
    || !reservation.cliente_direccion
    || !reservation.cliente_pais
    || !reservation.cliente_carnet_numero
    || !reservation.cliente_carnet_expiracion;
}

export function shouldRetryRentlySesEnrichment(
  reservation: ReservationForSesEnrichment,
  now = Date.now(),
) {
  if (!needsRentlySesEnrichment(reservation)) return false;
  if (!reservation.rently_detail_synced_at) return true;
  const lastSync = new Date(reservation.rently_detail_synced_at).getTime();
  return !Number.isFinite(lastSync) || now - lastSync >= 24 * 60 * 60 * 1000;
}

export function buildRentlyDetailUpdateFields(detail: RentlyBookingDetail, drivers: Array<{ Name?: string; Document?: string; License?: string }>) {
  const enriched = enrichReservationWithDetail({}, detail, drivers);
  const fields: Record<string, unknown> = {};
  for (const key of DETAIL_FIELDS) {
    const value = enriched[key];
    if (value !== null && value !== undefined && value !== '') fields[key] = value;
  }
  return fields;
}

export function extractRentlyContractVehicleData(detail: RentlyBookingDetail) {
  return {
    vehicleVin: detail.Car?.ChassisIdentification || detail.Car?.ChassisId || null,
    currentKm: detail.Car?.CurrentKms ?? detail.Car?.Kms ?? null,
    pickupKm: detail.DeliveryInfo?.Kms ?? null,
    returnKm: detail.DropoffInfo?.Kms ?? null,
  };
}

type RentlyCredentials = { host: string; clientId: string; clientSecret: string };

export async function enrichReservationsFromRentlyForSes(options: {
  serviceClient: SupabaseClient;
  organizationId: string;
  reservations: ReservationForSesEnrichment[];
  actorUserId?: string | null;
  credentials?: RentlyCredentials;
  maxReservations?: number;
  forceEnrichment?: boolean;
}) {
  const {
    serviceClient,
    organizationId,
    reservations,
    actorUserId = null,
    maxReservations = 50,
    forceEnrichment = false,
  } = options;
  const candidates = reservations
    .filter((row) => row.external_reservation_id && (forceEnrichment || needsRentlySesEnrichment(row)))
    .sort((a, b) => Number(!b.vehiculo_chasis) - Number(!a.vehiculo_chasis))
    .slice(0, maxReservations);
  if (candidates.length === 0) return { enriched: 0, failed: 0, detailsByReservationId: new Map<string, RentlyBookingDetail>() };

  let credentials = options.credentials;
  if (!credentials) {
    const { data: settings, error } = await serviceClient.from('integration_settings')
      .select('rently_api_host,rently_client_id,rently_client_secret')
      .eq('organization_id', organizationId).maybeSingle();
    if (error || !settings?.rently_client_id || !settings?.rently_client_secret) {
      return { enriched: 0, failed: candidates.length, detailsByReservationId: new Map<string, RentlyBookingDetail>() };
    }
    credentials = {
      host: settings.rently_api_host || 'azul.rently.com.ar',
      clientId: settings.rently_client_id,
      clientSecret: settings.rently_client_secret,
    };
  }

  const token = await getRentlyToken(credentials.host, credentials.clientId, credentials.clientSecret);
  const detailsByReservationId = new Map<string, RentlyBookingDetail>();
  const profilesByUser = new Map<string, RentlyCustomerForSes[]>();
  let enrichedCount = 0;
  let failed = 0;

  for (let index = 0; index < candidates.length; index += 5) {
    const chunk = candidates.slice(index, index + 5);
    const settled = await Promise.allSettled(chunk.map(async (reservation) => {
      const bookingId = Number(reservation.external_reservation_id);
      if (!Number.isFinite(bookingId)) throw new Error('Identificador Rently inválido');
      const detail = await fetchBookingDetail(credentials!.host, token, bookingId);
      if (!detail) throw new Error('Rently no devolvió detalle');
      const drivers = await fetchBookingDrivers(credentials!.host, token, bookingId);
      const updateFields = buildRentlyDetailUpdateFields(detail, drivers);
      const { error } = await serviceClient.from('reservations').update(updateFields)
        .eq('id', reservation.id).eq('organization_id', organizationId);
      if (error) throw error;
      Object.assign(reservation, updateFields);
      detailsByReservationId.set(reservation.id, detail);

      const contractVehicle = extractRentlyContractVehicleData(detail);
      if (reservation.auto && contractVehicle.vehicleVin) {
        await serviceClient.from('fleet_vehicles').update({ numero_bastidor: contractVehicle.vehicleVin })
          .eq('organization_id', organizationId)
          .eq('matricula', reservation.auto)
          .is('numero_bastidor', null);
      }

      const profileUserId = reservation.imported_by || actorUserId;
      if (detail.Customer && profileUserId) {
        const current = profilesByUser.get(profileUserId) ?? [];
        current.push(detail.Customer as RentlyCustomerForSes);
        profilesByUser.set(profileUserId, current);
      }
    }));
    for (const result of settled) result.status === 'fulfilled' ? enrichedCount++ : failed++;
  }

  for (const [userId, customers] of Array.from(profilesByUser.entries())) {
    await syncSesPersonProfiles(serviceClient, organizationId, userId, customers);
  }

  return { enriched: enrichedCount, failed, detailsByReservationId };
}
