import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { AuthError, authenticateSupabaseRequest, getServiceClient } from '../supabaseAdmin';
import { checkUserPermission } from '../permissionHelper';
import {
  mapRentlyCustomerToSesProfile,
  normalizeDocumentNumber,
  syncSesPersonProfiles,
  toIsoAlpha3,
  type RentlyCustomerForSes,
} from './rentlyProfiles';
import { validateSesDraft, type SesDraftValidationInput } from './validation';
import { generateSesXml, type SesXmlDraft } from './xml';
import { normalizeSesVehicleBrand, normalizeSesVehicleColor } from './codes';
import {
  enrichReservationsFromRentlyForSes,
  extractRentlyContractVehicleData,
  type ReservationForSesEnrichment,
} from './rentlyEnrichment';
import { calculateSesDraftContentHash, getActualChangedValues } from './draftVersioning';

const PrepareSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reservationIds: z.array(z.string().uuid()).max(500).optional(),
});

const ListSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.string().optional(),
  search: z.string().max(100).optional(),
});

const PersonUpdateSchema = z.object({
  id: z.string().uuid(),
  values: z.object({
    document_type: z.enum(['NIF', 'NIE', 'PAS', 'OTRO']).optional(),
    document_number: z.string().min(1).max(50).optional(),
    first_name: z.string().min(1).max(100).optional(),
    first_surname: z.string().min(1).max(100).optional(),
    second_surname: z.string().max(100).nullable().optional(),
    birth_date: z.string().nullable().optional(),
    nationality_code: z.string().length(3).nullable().optional(),
    sex: z.enum(['H', 'M', 'O']).nullable().optional(),
    address_line: z.string().max(200).nullable().optional(),
    address_number: z.string().max(30).nullable().optional(),
    address_complement: z.string().max(100).nullable().optional(),
    municipality_code: z.string().length(5).nullable().optional(),
    municipality_name: z.string().max(120).nullable().optional(),
    postal_code: z.string().max(12).nullable().optional(),
    country_code: z.string().length(3).nullable().optional(),
    phone: z.string().max(50).nullable().optional(),
    phone_secondary: z.string().max(50).nullable().optional(),
    email: z.string().email().nullable().optional(),
    licence_type: z.enum(['AM','AML','A1','A2','A','B','BE','C1','C1E','C','CE','D1','D1E','D','DE','LCM','LVA','ADR','PI','OT']).nullable().optional(),
    licence_valid_until: z.string().nullable().optional(),
    licence_number: z.string().max(50).nullable().optional(),
    licence_support: z.string().max(50).nullable().optional(),
    licence_country_code: z.string().length(3).nullable().optional(),
  }).strict(),
});

const PersonCreateSchema = z.object({
  draftId: z.string().uuid(),
  role: z.enum(['holder', 'primary_driver', 'secondary_driver']),
  values: PersonUpdateSchema.shape.values.extend({
    document_type: z.enum(['NIF', 'NIE', 'PAS', 'OTRO']),
    document_number: z.string().min(1).max(50),
    first_name: z.string().min(1).max(100),
    first_surname: z.string().min(1).max(100),
  }),
});

const DraftUpdateSchema = z.object({
  id: z.string().uuid(),
  values: z.object({
    reference: z.string().min(1).max(50).optional(),
    contract_date: z.string().nullable().optional(),
    pickup_at: z.string().nullable().optional(),
    return_at: z.string().nullable().optional(),
    pickup_location_id: z.string().uuid().nullable().optional(),
    return_location_id: z.string().uuid().nullable().optional(),
    holder_profile_id: z.string().uuid().nullable().optional(),
    primary_driver_profile_id: z.string().uuid().nullable().optional(),
    secondary_driver_profile_id: z.string().uuid().nullable().optional(),
    payment_type: z.enum(['DESTI','EFECT','TARJT','PLATF','TRANS','MOVIL','TREG','OTRO']).nullable().optional(),
    payment_date: z.string().nullable().optional(),
    payment_medium: z.string().max(100).nullable().optional(),
    payment_holder: z.string().max(150).nullable().optional(),
    card_expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{4}$/).nullable().optional(),
    vehicle_category: z.string().max(100).nullable().optional(),
    vehicle_type: z.enum(['FURGONETA','CAMION','AUTOBUS','TURISMO','MOTO','TRACTOR','REMOLQUE','CAMPER','CARAVANA','OTRO']).nullable().optional(),
    vehicle_brand: z.string().max(100).nullable().optional(),
    vehicle_model: z.string().max(150).nullable().optional(),
    vehicle_plate: z.string().max(20).nullable().optional(),
    vehicle_vin: z.string().max(50).nullable().optional(),
    vehicle_color: z.string().max(50).nullable().optional(),
    km_pickup: z.number().int().min(0).nullable().optional(),
    km_return: z.number().int().min(0).nullable().optional(),
    gps_data: z.string().max(200).nullable().optional(),
  }).strict(),
});

const LocationUpdateSchema = z.object({
  id: z.string().uuid(),
  values: z.object({
    name: z.string().min(1).max(150).optional(),
    use_establishment_code: z.boolean().optional(),
    establishment_code: z.string().length(10).nullable().optional(),
    address_line: z.string().max(250).nullable().optional(),
    address_complement: z.string().max(150).nullable().optional(),
    municipality_code: z.string().length(5).nullable().optional(),
    municipality_name: z.string().max(120).nullable().optional(),
    postal_code: z.string().max(12).nullable().optional(),
    country_code: z.string().length(3).optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    verified: z.boolean().optional(),
  }).strict(),
});

const SettingsUpdateSchema = z.object({
  lessor_code: z.string().regex(/^[A-Z0-9]{10}$/).nullable().optional(),
  establishment_code: z.string().regex(/^[A-Z0-9]{10}$/).nullable().optional(),
  default_payment_type: z.enum(['DESTI','EFECT','TARJT','PLATF','TRANS','MOVIL','TREG','OTRO']).nullable().optional(),
  default_vehicle_type: z.enum(['FURGONETA','CAMION','AUTOBUS','TURISMO','MOTO','TRACTOR','REMOLQUE','CAMPER','CARAVANA','OTRO']).optional(),
}).strict();

const ExportXmlSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});

const OfficialLotCodeSchema = z.string().trim().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'El código oficial del lote no tiene un formato válido',
);

const MarkBatchUploadedSchema = z.object({
  batchId: z.string().uuid(),
  officialLotCode: OfficialLotCodeSchema,
  notes: z.string().trim().max(1000).nullable().optional(),
}).strict();

const BatchErrorSchema = z.object({
  draftId: z.string().uuid(),
  code: z.string().trim().max(100).nullable().optional(),
  message: z.string().trim().min(1).max(2000),
}).strict();

const RecordBatchResultSchema = z.object({
  batchId: z.string().uuid(),
  acceptedDraftIds: z.array(z.string().uuid()).max(500),
  errors: z.array(BatchErrorSchema).max(500),
  notes: z.string().trim().max(1000).nullable().optional(),
}).strict();

export function deriveSesBatchOutcome(itemCount: number, acceptedCount: number, errorCount: number) {
  if (itemCount <= 0 || acceptedCount < 0 || errorCount < 0 || acceptedCount + errorCount !== itemCount) {
    throw new Error('El resultado debe cubrir todos los contratos del lote');
  }
  if (errorCount === 0) return 'accepted' as const;
  if (acceptedCount === 0) return 'error' as const;
  return 'partially_accepted' as const;
}

type AuthContext = { serviceClient: SupabaseClient; userId: string; organizationId: string };

function normalizeSearch(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function sendError(res: Response, error: unknown, context: string) {
  if (error instanceof AuthError) return res.status(error.status).json({ data: null, error: error.message });
  const status = typeof error === 'object' && error && 'status' in error ? Number((error as any).status) : 500;
  const message = error instanceof z.ZodError
    ? error.issues.map((issue) => issue.message).join('. ')
    : status < 500 && error instanceof Error ? error.message : 'Error interno';
  console.error(`[ses-hospedajes:${context}]`, error);
  return res.status(status).json({ data: null, error: message });
}

async function authorize(req: Request, permission: string): Promise<AuthContext> {
  const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
  const serviceClient = getServiceClient();
  const { allowed } = await checkUserPermission(serviceClient, organizationId, userId, permission);
  if (!allowed) {
    const error = new Error('No tienes permiso para realizar esta acción') as Error & { status?: number };
    error.status = 403;
    throw error;
  }
  return { serviceClient, userId, organizationId };
}

function mapReservationDocumentType(value?: string | null): 'NIF' | 'NIE' | 'PAS' | 'OTRO' {
  const normalized = normalizeSearch(value || '');
  if (normalized.includes('nie')) return 'NIE';
  if (normalized.includes('pasaporte')) return 'PAS';
  if (normalized.includes('dni') || normalized.includes('nif')) return 'NIF';
  return 'OTRO';
}

async function deriveMunicipality(
  serviceClient: SupabaseClient,
  city?: string | null,
  postalCode?: string | null,
) {
  if (!city) return null;
  let query = serviceClient.from('ses_municipalities')
    .select('code,name,province_code,province_name')
    .eq('active', true)
    .eq('normalized_name', normalizeSearch(city));
  if (postalCode && /^\d{2}/.test(postalCode)) query = query.eq('province_code', postalCode.slice(0, 2));
  const { data, error } = await query.limit(2);
  if (error || !data || data.length !== 1) return null;
  return data[0];
}

export function resolveKnownSesLocation(name?: string | null, _defaultEstablishmentCode?: string | null) {
  const normalized = normalizeSearch(name || '');
  const isCurrentOffice = normalized.includes('son malferit')
    || normalized === 'oficina azul cars'
    || normalized === 'oficina azul'
    || normalized === 'base';
  if (isCurrentOffice) {
    return {
      use_establishment_code: false,
      establishment_code: null,
      address_line: 'Carrer Son Malferit, 18, Llevant',
      address_complement: 'Azul Cars',
      municipality_code: '07040',
      municipality_name: 'Palma',
      postal_code: '07007',
      country_code: 'ESP',
      verified: true,
    };
  }
  if (normalized.includes('aeropuerto') && normalized.includes('palma')) {
    return {
      use_establishment_code: false,
      establishment_code: null,
      address_line: 'Districte de Llevant de Palma',
      address_complement: 'Aeropuerto de Palma',
      municipality_code: '07040',
      municipality_name: 'Palma',
      postal_code: '07611',
      country_code: 'ESP',
      verified: true,
    };
  }
  if (normalized.includes('terminal') && normalized.includes('cruceros') && normalized.includes('palma')) {
    return {
      use_establishment_code: false,
      establishment_code: null,
      address_line: 'Avinguda de Gabriel Roca, 44D',
      address_complement: 'Terminal de cruceros de Palma',
      municipality_code: '07040',
      municipality_name: 'Palma',
      postal_code: '07015',
      country_code: 'ESP',
      verified: true,
    };
  }
  return null;
}

async function ensurePersonFromReservation(
  ctx: AuthContext,
  reservation: Record<string, any>,
) {
  const normalizedDocument = normalizeDocumentNumber(reservation.documento_cliente);
  if (normalizedDocument) {
    const { data: existingProfile } = await ctx.serviceClient.from('ses_person_profiles').select('*')
      .eq('organization_id', ctx.organizationId)
      .eq('document_number', normalizedDocument)
      .limit(1).maybeSingle();
    if (existingProfile) {
      if (!existingProfile.municipality_code && existingProfile.municipality_name) {
        const municipality = await deriveMunicipality(
          ctx.serviceClient,
          existingProfile.municipality_name,
          existingProfile.postal_code,
        );
        if (municipality) {
          const { data: updated } = await ctx.serviceClient.from('ses_person_profiles')
            .update({ municipality_code: municipality.code, municipality_name: municipality.name })
            .eq('id', existingProfile.id).eq('organization_id', ctx.organizationId).select('*').single();
          return updated ?? existingProfile;
        }
      }
      return existingProfile;
    }
  }

  const customer: RentlyCustomerForSes = {
    Firstname: reservation.cliente_nombre,
    Lastname: reservation.cliente_apellido,
    DocumentTypeId: undefined,
    DocumentId: reservation.documento_cliente,
    EmailAddress: reservation.email,
    CellPhone: reservation.telefono,
    Address: reservation.cliente_direccion,
    City: reservation.cliente_ciudad,
    State: reservation.cliente_estado_provincia,
    Country: reservation.cliente_pais,
    BirthDate: reservation.cliente_fecha_nacimiento,
    DriverLicenceNumber: reservation.cliente_carnet_numero,
    DriverLicenceCountry: reservation.cliente_carnet_pais,
    DriverLicenseExpiration: reservation.cliente_carnet_expiracion,
  };
  const mapped = mapRentlyCustomerToSesProfile(customer, ctx.organizationId, ctx.userId);
  if (!mapped) return null;
  mapped.document_type = mapReservationDocumentType(reservation.tipo_documento_cliente);

  const { data: exact } = await ctx.serviceClient.from('ses_person_profiles').select('*')
    .eq('organization_id', ctx.organizationId)
    .eq('document_type', mapped.document_type)
    .eq('document_number', mapped.document_number)
    .maybeSingle();
  let data = exact;
  if (!data) {
    const { data: sameDocument } = await ctx.serviceClient.from('ses_person_profiles').select('*')
      .eq('organization_id', ctx.organizationId)
      .eq('document_number', mapped.document_number)
      .limit(1).maybeSingle();
    data = sameDocument;
  }
  if (!data) {
    const { data: inserted, error } = await ctx.serviceClient.from('ses_person_profiles').upsert({
      ...mapped,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    }, { onConflict: 'organization_id,document_type,document_number' }).select('*').single();
    if (error) throw error;
    return inserted;
  }

  if (!data.municipality_code && data.municipality_name) {
    const municipality = await deriveMunicipality(ctx.serviceClient, data.municipality_name, data.postal_code);
    if (municipality) {
      const { data: updated } = await ctx.serviceClient.from('ses_person_profiles')
        .update({ municipality_code: municipality.code, municipality_name: municipality.name })
        .eq('id', data.id).eq('organization_id', ctx.organizationId).select('*').single();
      return updated ?? data;
    }
  }
  return data;
}

async function ensureLocation(
  ctx: AuthContext,
  name?: string | null,
  address?: string | null,
  city?: string | null,
  defaultEstablishmentCode?: string | null,
) {
  if (!name && !address) return null;
  const key = normalizeSearch([name, address, city].filter(Boolean).join('|'));
  const { data: existing } = await ctx.serviceClient.from('ses_locations').select('*')
    .eq('organization_id', ctx.organizationId).eq('normalized_key', key).maybeSingle();
  const known = resolveKnownSesLocation(name || address, defaultEstablishmentCode);
  if (existing) {
    if (known && !(existing.manual_fields ?? []).length) {
      const { data: updated } = await ctx.serviceClient.from('ses_locations').update({
        ...known,
        updated_by: ctx.userId,
      }).eq('id', existing.id).eq('organization_id', ctx.organizationId).select('*').single();
      return updated ?? existing;
    }
    return existing;
  }

  const municipality = await deriveMunicipality(ctx.serviceClient, city, null);
  const { data, error } = await ctx.serviceClient.from('ses_locations').insert({
    organization_id: ctx.organizationId,
    normalized_key: key,
    name: name || address,
    address_line: address || name,
    municipality_code: municipality?.code ?? null,
    municipality_name: municipality?.name ?? city ?? null,
    country_code: 'ESP',
    ...(known ?? {}),
    created_by: ctx.userId,
    updated_by: ctx.userId,
  }).select('*').single();
  if (error) throw error;
  return data;
}

function buildValidationInput(draft: Record<string, any>): SesDraftValidationInput {
  return {
    ...draft,
    holder: draft.holder ?? null,
    primary_driver: draft.primary_driver ?? null,
    secondary_driver: draft.secondary_driver ?? null,
    pickup_location: draft.pickup_location ?? null,
    return_location: draft.return_location ?? null,
  };
}

const DRAFT_RELATIONS = `
  *,
  reservation:reservations!ses_contract_drafts_reservation_id_fkey(id,external_reservation_id,cliente_nombre,cliente_apellido),
  holder:ses_person_profiles!ses_contract_drafts_holder_profile_id_fkey(*),
  primary_driver:ses_person_profiles!ses_contract_drafts_primary_driver_profile_id_fkey(*),
  secondary_driver:ses_person_profiles!ses_contract_drafts_secondary_driver_profile_id_fkey(*),
  pickup_location:ses_locations!ses_contract_drafts_pickup_location_id_fkey(*),
  return_location:ses_locations!ses_contract_drafts_return_location_id_fkey(*)
`;

async function validateAndPersistDraft(ctx: AuthContext, draftId: string) {
  const { data: draft, error } = await ctx.serviceClient.from('ses_contract_drafts')
    .select(DRAFT_RELATIONS).eq('id', draftId).eq('organization_id', ctx.organizationId).single();
  if (error) throw error;
  const issues = validateSesDraft(buildValidationInput(draft));
  const locked = ['batched', 'uploaded_pending_result', 'accepted'].includes(draft.status);
  const nextStatus = locked ? draft.status : issues.length === 0 ? 'ready' : 'incomplete';
  const { data: updated, error: updateError } = await ctx.serviceClient.from('ses_contract_drafts')
    .update({ validation_errors: issues, status: nextStatus, last_prepared_at: new Date().toISOString() })
    .eq('id', draftId).eq('organization_id', ctx.organizationId).select('*').single();
  if (updateError) throw updateError;
  return { draft: updated, issues };
}

async function audit(
  ctx: AuthContext,
  entityType: string,
  entityId: string,
  action: string,
  changedFields: string[],
  metadata: Record<string, unknown> = {},
) {
  await ctx.serviceClient.from('ses_audit_events').insert({
    organization_id: ctx.organizationId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    changed_fields: changedFields,
    metadata,
    performed_by: ctx.userId,
  });
}

export async function handleSesPrepare(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.edit');
    const input = PrepareSchema.parse(req.body);
    let query = ctx.serviceClient.from('reservations').select(`
      id,organization_id,external_reservation_id,rently_creation_date,estado,desde,hasta,
      cliente_nombre,cliente_apellido,email,telefono,tipo_documento_cliente,documento_cliente,
      cliente_direccion,cliente_ciudad,cliente_estado_provincia,cliente_pais,cliente_fecha_nacimiento,
      cliente_carnet_numero,cliente_carnet_pais,cliente_carnet_expiracion,
      lugar_entrega,lugar_entrega_direccion,lugar_entrega_ciudad,
      lugar_devolucion,lugar_devolucion_direccion,lugar_devolucion_ciudad,
      modelo,auto,categoria,vehiculo_color,vehiculo_chasis,vehiculo_kms,
      rently_detail_synced_at,imported_by
    `).eq('organization_id', ctx.organizationId)
      .gte('desde', `${input.dateFrom}T00:00:00`)
      .lte('desde', `${input.dateTo}T23:59:59`)
      .neq('estado', 'Cancelada')
      .order('desde', { ascending: true }).limit(500);
    if (input.reservationIds?.length) query = query.in('id', input.reservationIds);
    const { data: reservations, error } = await query;
    if (error) throw error;

    let detailsByReservationId = new Map<string, import('../syncRently').RentlyBookingDetail>();
    try {
      const enrichment = await enrichReservationsFromRentlyForSes({
        serviceClient: ctx.serviceClient,
        organizationId: ctx.organizationId,
        reservations: (reservations ?? []) as ReservationForSesEnrichment[],
        actorUserId: ctx.userId,
        maxReservations: 50,
      });
      detailsByReservationId = enrichment.detailsByReservationId;
    } catch (enrichmentError) {
      console.warn('[ses-hospedajes] Rently detail enrichment failed (non-blocking):', enrichmentError);
    }

    const plates = Array.from(new Set((reservations ?? []).map((row) => row.auto).filter(Boolean)));
    const { data: fleetVehicles } = plates.length
      ? await ctx.serviceClient.from('fleet_vehicles').select('*')
          .eq('organization_id', ctx.organizationId).in('matricula', plates)
      : { data: [] as any[] };
    const fleetMap = new Map((fleetVehicles ?? []).map((vehicle) => [vehicle.matricula, vehicle]));
    const { data: settings } = await ctx.serviceClient.from('ses_settings').select('*')
      .eq('organization_id', ctx.organizationId).maybeSingle();
    const { data: existingDrafts } = await ctx.serviceClient.from('ses_contract_drafts').select('*')
      .eq('organization_id', ctx.organizationId)
      .in('reservation_id', (reservations ?? []).map((row) => row.id));
    const existingMap = new Map((existingDrafts ?? []).map((draft) => [draft.reservation_id, draft]));

    let created = 0;
    let updated = 0;
    let skippedLocked = 0;
    const draftIds: string[] = [];

    for (const reservation of reservations ?? []) {
      const existing = existingMap.get(reservation.id);
      if (existing && ['batched', 'uploaded_pending_result', 'accepted'].includes(existing.status)) {
        skippedLocked++;
        draftIds.push(existing.id);
        continue;
      }

      const person = await ensurePersonFromReservation(ctx, reservation);
      const pickupLocation = await ensureLocation(ctx, reservation.lugar_entrega, reservation.lugar_entrega_direccion, reservation.lugar_entrega_ciudad, settings?.establishment_code);
      const returnLocation = await ensureLocation(ctx, reservation.lugar_devolucion, reservation.lugar_devolucion_direccion, reservation.lugar_devolucion_ciudad, settings?.establishment_code);
      const fleet = fleetMap.get(reservation.auto) as Record<string, any> | undefined;
      const detail = detailsByReservationId.get(reservation.id);
      const contractVehicle = detail ? extractRentlyContractVehicleData(detail) : null;

      const automatic = {
        organization_id: ctx.organizationId,
        reservation_id: reservation.id,
        external_booking_id: Number(reservation.external_reservation_id) || null,
        reference: String(reservation.external_reservation_id || reservation.id).slice(0, 50),
        contract_date: reservation.rently_creation_date?.slice(0, 10) || null,
        pickup_at: reservation.desde,
        return_at: reservation.hasta,
        pickup_location_id: pickupLocation?.id ?? null,
        return_location_id: returnLocation?.id ?? null,
        holder_profile_id: person?.id ?? null,
        primary_driver_profile_id: person?.id ?? null,
        payment_type: settings?.default_payment_type ?? null,
        vehicle_category: fleet?.categoria ?? reservation.categoria ?? null,
        vehicle_type: settings?.default_vehicle_type ?? 'TURISMO',
        vehicle_brand: normalizeSesVehicleBrand(fleet?.marca),
        vehicle_model: fleet?.modelo ?? reservation.modelo ?? null,
        vehicle_plate: fleet?.matricula ?? reservation.auto ?? null,
        vehicle_vin: fleet?.numero_bastidor ?? contractVehicle?.vehicleVin ?? reservation.vehiculo_chasis ?? null,
        vehicle_color: normalizeSesVehicleColor(fleet?.color ?? reservation.vehiculo_color),
        km_pickup: fleet?.km_recogida ?? contractVehicle?.pickupKm ?? reservation.vehiculo_kms ?? null,
        km_return: fleet?.km_devolucion ?? contractVehicle?.returnKm ?? null,
        last_prepared_at: new Date().toISOString(),
        updated_by: ctx.userId,
      };
      const manualFields = new Set<string>(Array.isArray(existing?.manual_fields) ? existing.manual_fields : []);
      const merged: Record<string, any> = { ...automatic };
      if (existing) {
        for (const field of Array.from(manualFields)) merged[field] = existing[field];
        merged.manual_fields = Array.from(manualFields);
      } else {
        merged.manual_fields = [];
        merged.created_by = ctx.userId;
      }
      const nextContentHash = calculateSesDraftContentHash(merged);
      const contentChanged = !existing || existing.content_hash !== nextContentHash;
      merged.draft_version = existing ? existing.draft_version + (contentChanged ? 1 : 0) : 1;
      merged.content_hash = nextContentHash;

      const validationInput: SesDraftValidationInput = {
        ...merged,
        holder: person,
        primary_driver: person,
        pickup_location: pickupLocation,
        return_location: returnLocation,
      };
      const issues = validateSesDraft(validationInput);
      merged.validation_errors = issues;
      merged.status = issues.length === 0 ? 'ready' : 'incomplete';

      const { data: saved, error: saveError } = await ctx.serviceClient.from('ses_contract_drafts')
        .upsert(merged, { onConflict: 'organization_id,reservation_id' }).select('id').single();
      if (saveError) throw saveError;
      draftIds.push(saved.id);
      existing ? updated++ : created++;
    }

    return res.json({ data: { total: reservations?.length ?? 0, created, updated, skippedLocked, draftIds }, error: null });
  } catch (error) {
    return sendError(res, error, 'prepare');
  }
}

export async function handleSesListDrafts(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.view');
    const input = ListSchema.parse(req.body ?? {});
    let query = ctx.serviceClient.from('ses_contract_drafts').select(DRAFT_RELATIONS)
      .eq('organization_id', ctx.organizationId).order('pickup_at', { ascending: true }).limit(500);
    if (input.dateFrom) query = query.gte('pickup_at', `${input.dateFrom}T00:00:00`);
    if (input.dateTo) query = query.lte('pickup_at', `${input.dateTo}T23:59:59`);
    if (input.status && input.status !== 'all') query = query.eq('status', input.status);
    if (input.search?.trim()) {
      const search = input.search.trim().replace(/[%_,]/g, '');
      query = query.or(`reference.ilike.%${search}%,vehicle_plate.ilike.%${search}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    const summary = (data ?? []).reduce((acc: Record<string, number>, draft: any) => {
      acc[draft.status] = (acc[draft.status] ?? 0) + 1;
      return acc;
    }, {});
    return res.json({ data: { drafts: data ?? [], summary, total: data?.length ?? 0 }, error: null });
  } catch (error) {
    return sendError(res, error, 'list');
  }
}

export async function handleSesUpdatePerson(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.edit');
    const input = PersonUpdateSchema.parse(req.body);
    const { data: current, error: currentError } = await ctx.serviceClient.from('ses_person_profiles')
      .select('*').eq('id', input.id).eq('organization_id', ctx.organizationId).single();
    if (currentError) throw currentError;
    const normalizedValues = Object.fromEntries(Object.entries(input.values).map(([key, value]) => [
      key,
      key.endsWith('_code') && typeof value === 'string' ? value.toUpperCase() : value,
    ]));
    const changedValues = getActualChangedValues(current, normalizedValues);
    const changedFields = Object.keys(changedValues);
    if (changedFields.length === 0) return res.json({ data: current, error: null });
    const manualFields = Array.from(new Set([...(current.manual_fields ?? []), ...changedFields]));
    const { data, error } = await ctx.serviceClient.from('ses_person_profiles').update({
      ...changedValues, manual_fields: manualFields, updated_by: ctx.userId,
    }).eq('id', input.id).eq('organization_id', ctx.organizationId).select('*').single();
    if (error) throw error;
    await audit(ctx, 'person', input.id, 'manual_update', changedFields);

    const { data: affected } = await ctx.serviceClient.from('ses_contract_drafts').select('id')
      .eq('organization_id', ctx.organizationId)
      .or(`holder_profile_id.eq.${input.id},primary_driver_profile_id.eq.${input.id},secondary_driver_profile_id.eq.${input.id}`);
    for (const draft of affected ?? []) await validateAndPersistDraft(ctx, draft.id);
    return res.json({ data, error: null });
  } catch (error) {
    return sendError(res, error, 'update-person');
  }
}

export async function handleSesCreatePerson(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.edit');
    const input = PersonCreateSchema.parse(req.body);
    const values = Object.fromEntries(Object.entries(input.values).map(([key, value]) => [
      key,
      key.endsWith('_code') && typeof value === 'string' ? value.toUpperCase() : value,
    ]));
    const { data: person, error } = await ctx.serviceClient.from('ses_person_profiles').upsert({
      ...values,
      organization_id: ctx.organizationId,
      manual_fields: Object.keys(input.values),
      created_by: ctx.userId,
      updated_by: ctx.userId,
    }, { onConflict: 'organization_id,document_type,document_number' }).select('*').single();
    if (error) throw error;
    const field = input.role === 'holder' ? 'holder_profile_id'
      : input.role === 'primary_driver' ? 'primary_driver_profile_id' : 'secondary_driver_profile_id';
    const { error: attachError } = await ctx.serviceClient.from('ses_contract_drafts')
      .update({ [field]: person.id, updated_by: ctx.userId })
      .eq('id', input.draftId).eq('organization_id', ctx.organizationId);
    if (attachError) throw attachError;
    await audit(ctx, 'person', person.id, 'created_manually', Object.keys(input.values));
    await validateAndPersistDraft(ctx, input.draftId);
    return res.json({ data: person, error: null });
  } catch (error) {
    return sendError(res, error, 'create-person');
  }
}

export async function handleSesUpdateDraft(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.edit');
    const input = DraftUpdateSchema.parse(req.body);
    const { data: current, error: currentError } = await ctx.serviceClient.from('ses_contract_drafts')
      .select('*').eq('id', input.id).eq('organization_id', ctx.organizationId).single();
    if (currentError) throw currentError;
    if (['batched', 'uploaded_pending_result', 'accepted'].includes(current.status)) {
      const error = new Error('El borrador está bloqueado por formar parte de un lote') as Error & { status?: number };
      error.status = 409;
      throw error;
    }
    const changedValues = getActualChangedValues(current, input.values);
    const changedFields = Object.keys(changedValues);
    if (changedFields.length === 0) {
      const result = await validateAndPersistDraft(ctx, input.id);
      return res.json({ data: result, error: null });
    }
    const manualFields = Array.from(new Set([...(current.manual_fields ?? []), ...changedFields]));
    const nextContentHash = calculateSesDraftContentHash({ ...current, ...changedValues, manual_fields: manualFields });
    const { error } = await ctx.serviceClient.from('ses_contract_drafts').update({
      ...changedValues,
      manual_fields: manualFields,
      draft_version: current.draft_version + 1,
      content_hash: nextContentHash,
      updated_by: ctx.userId,
    }).eq('id', input.id).eq('organization_id', ctx.organizationId);
    if (error) throw error;
    await audit(ctx, 'draft', input.id, 'manual_update', changedFields);
    const result = await validateAndPersistDraft(ctx, input.id);
    return res.json({ data: result, error: null });
  } catch (error) {
    return sendError(res, error, 'update-draft');
  }
}

export async function handleSesUpdateLocation(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.edit');
    const input = LocationUpdateSchema.parse(req.body);
    const { data: current, error: currentError } = await ctx.serviceClient.from('ses_locations')
      .select('*').eq('id', input.id).eq('organization_id', ctx.organizationId).single();
    if (currentError) throw currentError;
    const normalizedValues = Object.fromEntries(Object.entries(input.values).map(([key, value]) => [
      key,
      key.endsWith('_code') && typeof value === 'string' ? value.toUpperCase() : value,
    ]));
    const changedValues = getActualChangedValues(current, normalizedValues);
    const changedFields = Object.keys(changedValues);
    if (changedFields.length === 0) return res.json({ data: current, error: null });
    const manualFields = Array.from(new Set([...(current.manual_fields ?? []), ...changedFields]));
    const { data, error } = await ctx.serviceClient.from('ses_locations').update({
      ...changedValues, manual_fields: manualFields, updated_by: ctx.userId,
    }).eq('id', input.id).eq('organization_id', ctx.organizationId).select('*').single();
    if (error) throw error;
    await audit(ctx, 'location', input.id, 'manual_update', changedFields);
    const { data: affected } = await ctx.serviceClient.from('ses_contract_drafts').select('id')
      .eq('organization_id', ctx.organizationId)
      .or(`pickup_location_id.eq.${input.id},return_location_id.eq.${input.id}`);
    for (const draft of affected ?? []) await validateAndPersistDraft(ctx, draft.id);
    return res.json({ data, error: null });
  } catch (error) {
    return sendError(res, error, 'update-location');
  }
}

export async function handleSesSearchMunicipalities(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.view');
    const search = z.object({ query: z.string().min(2).max(100), provinceCode: z.string().length(2).optional() }).parse(req.body);
    let query = ctx.serviceClient.from('ses_municipalities')
      .select('code,name,province_code,province_name')
      .eq('active', true).ilike('normalized_name', `%${normalizeSearch(search.query)}%`)
      .order('name').limit(25);
    if (search.provinceCode) query = query.eq('province_code', search.provinceCode);
    const { data, error } = await query;
    if (error) throw error;
    return res.json({ data: data ?? [], error: null });
  } catch (error) {
    return sendError(res, error, 'municipalities');
  }
}

export async function handleSesRevalidate(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.edit');
    const input = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(req.body);
    const results = [];
    for (const id of input.ids) results.push(await validateAndPersistDraft(ctx, id));
    return res.json({ data: results, error: null });
  } catch (error) {
    return sendError(res, error, 'revalidate');
  }
}

export async function handleSesGetSettings(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.view');
    const { data, error } = await ctx.serviceClient.from('ses_settings').select(`
      organization_id,lessor_code,establishment_code,default_payment_type,
      default_vehicle_type,government_service_enabled,updated_at
    `).eq('organization_id', ctx.organizationId).maybeSingle();
    if (error) throw error;
    return res.json({ data: data ?? null, error: null });
  } catch (error) {
    return sendError(res, error, 'get-settings');
  }
}

export async function handleSesUpdateSettings(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.manage_settings');
    const input = SettingsUpdateSchema.parse(req.body);
    const { data, error } = await ctx.serviceClient.from('ses_settings').upsert({
      organization_id: ctx.organizationId,
      ...input,
      updated_by: ctx.userId,
    }, { onConflict: 'organization_id' }).select(`
      organization_id,lessor_code,establishment_code,default_payment_type,
      default_vehicle_type,government_service_enabled,updated_at
    `).single();
    if (error) throw error;
    await audit(ctx, 'settings', ctx.organizationId, 'manual_update', Object.keys(input));
    return res.json({ data, error: null });
  } catch (error) {
    return sendError(res, error, 'update-settings');
  }
}

export async function handleSesListBatches(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.view');
    const { data, error } = await ctx.serviceClient.from('ses_batches').select(`
      id,status,schema_version,file_name,xml_hash,item_count,accepted_count,error_count,
      generated_at,downloaded_at,uploaded_at,result_recorded_at,notes,
      items:ses_batch_items(
        id,draft_id,item_order,draft_version,result_status,result_code,result_message,
        draft:ses_contract_drafts!ses_batch_items_draft_id_fkey(id,reference,status)
      )
    `).eq('organization_id', ctx.organizationId).order('generated_at', { ascending: false }).limit(50);
    if (error) throw error;
    return res.json({ data: data ?? [], error: null });
  } catch (error) {
    return sendError(res, error, 'list-batches');
  }
}

export async function handleSesMarkBatchUploaded(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.export');
    const input = MarkBatchUploadedSchema.parse(req.body);
    const { data: batch, error: batchError } = await ctx.serviceClient.from('ses_batches')
      .select('id,status,notes')
      .eq('id', input.batchId)
      .eq('organization_id', ctx.organizationId)
      .single();
    if (batchError) throw batchError;
    if (!['downloaded', 'uploaded_pending_result'].includes(batch.status)) {
      const conflict = new Error('Solo se puede registrar la subida de un lote descargado o pendiente') as Error & { status?: number };
      conflict.status = 409;
      throw conflict;
    }

    const lotNote = `Código oficial de lote: ${input.officialLotCode}`;
    const notes = [lotNote, input.notes].filter(Boolean).join('\n');
    const now = new Date().toISOString();
    const { data: updated, error } = await ctx.serviceClient.from('ses_batches').update({
      status: 'uploaded_pending_result',
      uploaded_at: now,
      notes,
    }).eq('id', input.batchId).eq('organization_id', ctx.organizationId).select('*').single();
    if (error) throw error;

    const { data: items, error: itemsError } = await ctx.serviceClient.from('ses_batch_items')
      .select('draft_id').eq('batch_id', input.batchId);
    if (itemsError) throw itemsError;
    const draftIds = (items ?? []).map((item) => item.draft_id);
    if (draftIds.length) {
      const { error: draftsError } = await ctx.serviceClient.from('ses_contract_drafts').update({
        status: 'uploaded_pending_result',
        updated_by: ctx.userId,
      }).eq('organization_id', ctx.organizationId).in('id', draftIds);
      if (draftsError) throw draftsError;
    }

    await audit(ctx, 'batch', input.batchId, 'manual_upload_receipt_recorded', ['status', 'uploaded_at', 'notes'], {
      official_lot_code: input.officialLotCode,
    });
    return res.json({ data: updated, error: null });
  } catch (error) {
    return sendError(res, error, 'mark-batch-uploaded');
  }
}

export async function handleSesRecordBatchResult(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.export');
    const input = RecordBatchResultSchema.parse(req.body);
    const { data: batch, error: batchError } = await ctx.serviceClient.from('ses_batches')
      .select('id,status,item_count,notes,items:ses_batch_items(id,draft_id)')
      .eq('id', input.batchId)
      .eq('organization_id', ctx.organizationId)
      .single();
    if (batchError) throw batchError;
    if (!['uploaded_pending_result', 'partially_accepted', 'accepted', 'error'].includes(batch.status)) {
      const conflict = new Error('Registra primero el acuse de subida del lote') as Error & { status?: number };
      conflict.status = 409;
      throw conflict;
    }

    const batchDraftIds = new Set((batch.items ?? []).map((item: { draft_id: string }) => item.draft_id));
    const acceptedIds = Array.from(new Set(input.acceptedDraftIds));
    const errorIds = input.errors.map((item) => item.draftId);
    const submittedIds = [...acceptedIds, ...errorIds];
    const uniqueSubmittedIds = new Set(submittedIds);
    const coversBatch = uniqueSubmittedIds.size === batchDraftIds.size
      && submittedIds.length === uniqueSubmittedIds.size
      && Array.from(uniqueSubmittedIds).every((id) => batchDraftIds.has(id));
    if (!coversBatch) {
      const invalid = new Error('El resultado debe incluir una sola vez todos los contratos del lote') as Error & { status?: number };
      invalid.status = 422;
      throw invalid;
    }

    const outcome = deriveSesBatchOutcome(batch.item_count, acceptedIds.length, input.errors.length);
    const now = new Date().toISOString();
    if (acceptedIds.length) {
      const { error } = await ctx.serviceClient.from('ses_batch_items').update({
        result_status: 'accepted', result_code: null, result_message: null,
      }).eq('batch_id', input.batchId).in('draft_id', acceptedIds);
      if (error) throw error;
      const { error: draftError } = await ctx.serviceClient.from('ses_contract_drafts').update({
        status: 'accepted', accepted_at: now, updated_by: ctx.userId,
      }).eq('organization_id', ctx.organizationId).in('id', acceptedIds);
      if (draftError) throw draftError;
    }
    for (const item of input.errors) {
      const { error } = await ctx.serviceClient.from('ses_batch_items').update({
        result_status: 'error',
        result_code: item.code || null,
        result_message: item.message,
      }).eq('batch_id', input.batchId).eq('draft_id', item.draftId);
      if (error) throw error;
      const { error: draftError } = await ctx.serviceClient.from('ses_contract_drafts').update({
        status: 'needs_revision', accepted_at: null, updated_by: ctx.userId,
      }).eq('organization_id', ctx.organizationId).eq('id', item.draftId);
      if (draftError) throw draftError;
    }

    const notes = input.notes ? [batch.notes, input.notes].filter(Boolean).join('\n') : batch.notes;
    const { data: updated, error } = await ctx.serviceClient.from('ses_batches').update({
      status: outcome,
      accepted_count: acceptedIds.length,
      error_count: input.errors.length,
      result_recorded_at: now,
      notes,
    }).eq('id', input.batchId).eq('organization_id', ctx.organizationId).select('*').single();
    if (error) throw error;
    await audit(ctx, 'batch', input.batchId, 'portal_result_reconciled', [
      'status', 'accepted_count', 'error_count', 'result_recorded_at',
    ], { accepted_count: acceptedIds.length, error_count: input.errors.length });
    return res.json({ data: updated, error: null });
  } catch (error) {
    return sendError(res, error, 'record-batch-result');
  }
}

export async function handleSesExportXml(req: Request, res: Response) {
  let batchId: string | null = null;
  try {
    const ctx = await authorize(req, 'ses_hospedajes.export');
    const input = ExportXmlSchema.parse(req.body);
    const { data: drafts, error } = await ctx.serviceClient.from('ses_contract_drafts')
      .select(DRAFT_RELATIONS)
      .eq('organization_id', ctx.organizationId)
      .in('id', input.ids)
      .order('pickup_at', { ascending: true });
    if (error) throw error;
    if (!drafts || drafts.length !== input.ids.length) {
      const notFound = new Error('Alguno de los contratos no existe o no pertenece a tu organización') as Error & { status?: number };
      notFound.status = 404;
      throw notFound;
    }
    const notReady = drafts.filter((draft) => draft.status !== 'ready');
    if (notReady.length) {
      const conflict = new Error('Solo se pueden exportar contratos en estado Listo; recarga y revisa la selección') as Error & { status?: number };
      conflict.status = 409;
      throw conflict;
    }

    const invalid = drafts.map((draft) => ({
      id: draft.id,
      reference: draft.reference,
      issues: validateSesDraft(buildValidationInput(draft)),
    })).filter((result) => result.issues.length > 0);
    if (invalid.length) {
      return res.status(422).json({
        data: { invalid },
        error: `${invalid.length} contrato(s) todavía contienen datos obligatorios pendientes`,
      });
    }

    const payloads = drafts.map((draft) => ({
      ...draft,
      holder: draft.holder,
      primary_driver: draft.primary_driver,
      secondary_driver: draft.secondary_driver,
      pickup_location: draft.pickup_location,
      return_location: draft.return_location,
    })) as unknown as SesXmlDraft[];
    const xml = generateSesXml(payloads);
    const xmlHash = createHash('sha256').update(xml, 'utf8').digest('hex');
    const stamp = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).format(new Date()).replace(/[-: ]/g, '');
    const fileName = `SES_ALQUILERES_${stamp}.xml`;
    const now = new Date().toISOString();

    const { data: batch, error: batchError } = await ctx.serviceClient.from('ses_batches').insert({
      organization_id: ctx.organizationId,
      status: 'downloaded',
      schema_version: '1.2.0',
      file_name: fileName,
      xml_hash: xmlHash,
      item_count: drafts.length,
      generated_by: ctx.userId,
      generated_at: now,
      downloaded_at: now,
    }).select('id').single();
    if (batchError) throw batchError;
    batchId = batch.id;

    const { error: itemsError } = await ctx.serviceClient.from('ses_batch_items').insert(
      drafts.map((draft, index) => ({
        batch_id: batch.id,
        draft_id: draft.id,
        item_order: index + 1,
        draft_version: draft.draft_version,
        payload_snapshot: payloads[index],
      })),
    );
    if (itemsError) throw itemsError;

    const { error: lockError } = await ctx.serviceClient.from('ses_contract_drafts').update({
      status: 'batched',
      updated_by: ctx.userId,
    }).eq('organization_id', ctx.organizationId).in('id', input.ids);
    if (lockError) throw lockError;

    await audit(ctx, 'batch', batch.id, 'xml_generated_and_downloaded', ['file_name', 'xml_hash', 'item_count']);
    return res.json({ data: { batchId: batch.id, fileName, xml, xmlHash, itemCount: drafts.length }, error: null });
  } catch (error) {
    if (batchId) {
      try {
        const serviceClient = getServiceClient();
        await serviceClient.from('ses_contract_drafts').update({ status: 'ready' }).eq('status', 'batched').in('id', req.body?.ids || []);
        await serviceClient.from('ses_batches').delete().eq('id', batchId);
      } catch { /* best-effort rollback */ }
    }
    return sendError(res, error, 'export-xml');
  }
}
