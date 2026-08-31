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
import { validateSesDraft, type SesDraftValidationInput, type SesValidationIssue } from './validation';
import { generateSesXml, type SesXmlDraft } from './xml';
import { normalizeSesVehicleBrand, normalizeSesVehicleColor } from './codes';
import {
  enrichReservationsFromRentlyForSes,
  extractRentlyContractVehicleData,
  loadRentlyDeliveredCandidatesForSes,
  type ReservationForSesEnrichment,
} from './rentlyEnrichment';
import { intersectRentlyPlanMintCandidates } from './candidateIntersection';
import { calculateSesDraftContentHash, getActualChangedValues } from './draftVersioning';
import {
  mergeSesFilterPreferences,
  readSesFilterPreferences,
  SesFilterPreferencesSchema,
} from './filterPreferences';
import {
  collectAllPages,
  evaluateSesEligibility,
  validateSesDateRange,
  type SesEligibilityIssue,
  type SesManualEligibilityException,
} from './eligibility';
import {
  assertNonEmptyOfficialInventory,
  assertStableOfficialCommunicationIdentity,
  buildOfficialIdentityHash,
  evaluateOfficialClearance,
  normalizeOfficialInventoryItem,
  type SesOfficialClearance,
  type SesOfficialCommunication,
} from './officialInventory';
import { assertUniqueSesExportSelection, deriveSesGateState, isSesDraftLocked } from './readiness';
import { buildSesHistoricalSnapshots, calculateSesPayloadSnapshotHash } from './historicalSnapshots';
import { buildSesFieldAuditRows, persistSesFieldAudit } from './fieldAudit';
import { storagePut } from '../storage';
import { sha256Utf8 } from './xsdValidation';
import {
  SES_OFFICIAL_CONTRACT_VERSION,
  validateSesXmlAgainstOfficialContract,
} from './officialStructuralContract';
import { deriveSesOperationalState, mergeSesRentlyFields, projectSesOperationalDraft } from './operationalDraft';
import { mapStoredRentlyDriverToCustomer, parseStoredRentlyDrivers } from './additionalDrivers';
import {
  assertSesHardeningSchema,
  assertSesEligibilityExceptionSchema,
  isSesSchemaCompatibilityError,
  withLegacyBatchFields,
  withLegacyDraftGates,
} from './schemaCompatibility';

const PrepareSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reservationIds: z.array(z.string().uuid()).max(500).optional(),
});

const SyncDraftsSchema = z.object({
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(50),
}).strict();

const ListSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.string().optional(),
  search: z.string().max(100).optional(),
  searchMode: z.enum(['exact', 'contains']).default('exact'),
  limit: z.number().int().min(1).max(500).default(200),
  offset: z.number().int().min(0).default(0),
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

const AcceptedBatchItemSchema = z.object({
  draftId: z.string().uuid(),
  officialCommunicationCode: OfficialLotCodeSchema,
}).strict();

const RecordBatchResultSchema = z.object({
  batchId: z.string().uuid(),
  accepted: z.array(AcceptedBatchItemSchema).max(500),
  errors: z.array(BatchErrorSchema).max(500),
  notes: z.string().trim().max(1000).nullable().optional(),
}).strict();

const OfficialCommunicationImportSchema = z.object({
  officialCommunicationCode: OfficialLotCodeSchema,
  officialLotCode: OfficialLotCodeSchema.nullable().optional(),
  reference: z.string().trim().min(1).max(50),
  communicationType: z.literal('ALQUILER_VEHICULO').default('ALQUILER_VEHICULO'),
  contractDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vehiclePlate: z.string().trim().max(20).nullable().optional(),
  status: z.enum(['active','accepted','annulled','error']),
  notes: z.string().trim().max(1000).nullable().optional(),
}).strict();

const ImportOfficialInventorySchema = z.object({
  sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  confirmedComplete: z.boolean().optional(),
  items: z.array(OfficialCommunicationImportSchema).min(1).max(5000),
}).strict();

const CheckOfficialCommunicationSchema = z.object({
  draftId: z.string().uuid(),
  outcome: z.enum(['not_found', 'found']),
  communication: OfficialCommunicationImportSchema.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.outcome === 'found' && !value.communication) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['communication'], message: 'Debes indicar la comunicación encontrada' });
  }
  if (value.outcome === 'not_found' && value.communication) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['communication'], message: 'No debes adjuntar una comunicación si no se encontró resultado' });
  }
});

const CreateEligibilityExceptionSchema = z.object({
  draftId: z.string().uuid(),
  protocolReference: z.string().trim().min(3).max(120),
  reason: z.string().trim().min(10).max(1000),
  expiresAt: z.string().datetime({ offset: true }),
}).strict();

const RevokeEligibilityExceptionSchema = z.object({
  exceptionId: z.string().uuid(),
  reason: z.string().trim().min(10).max(1000),
}).strict();

const ListOfficialInventorySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['all','active','accepted','annulled','error']).default('all'),
  limit: z.number().int().min(1).max(500).default(100),
  offset: z.number().int().min(0).default(0),
}).strict();

const UploadOfficialXsdSchema = z.object({
  fileName: z.string().trim().regex(/\.xsd$/i).max(120),
  version: z.string().trim().min(1).max(50),
  content: z.string().min(100).max(2_000_000),
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

type SesEligibilityExceptionRow = {
  id: string;
  organization_id: string;
  draft_id: string;
  reservation_id: string;
  kind: 'terminated_not_reported';
  protocol_reference: string;
  reason: string;
  approved_by: string;
  approved_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_by?: string | null;
  revocation_reason?: string | null;
};

function toManualEligibilityException(row: SesEligibilityExceptionRow | null | undefined): SesManualEligibilityException | null {
  if (!row) return null;
  return {
    kind: row.kind,
    protocolReference: row.protocol_reference,
    reason: row.reason,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

async function loadActiveEligibilityExceptions(ctx: AuthContext, reservationIds: string[]) {
  const byReservationId = new Map<string, SesEligibilityExceptionRow>();
  if (reservationIds.length === 0) return byReservationId;
  const { data, error } = await ctx.serviceClient.from('ses_eligibility_exceptions')
    .select('id,organization_id,draft_id,reservation_id,kind,protocol_reference,reason,approved_by,approved_at,expires_at,revoked_at,revoked_by,revocation_reason')
    .eq('organization_id', ctx.organizationId)
    .in('reservation_id', reservationIds)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('approved_at', { ascending: false });
  if (error) {
    if (isSesSchemaCompatibilityError(error)) return byReservationId;
    throw error;
  }
  for (const row of (data ?? []) as SesEligibilityExceptionRow[]) {
    if (!byReservationId.has(row.reservation_id)) byReservationId.set(row.reservation_id, row);
  }
  return byReservationId;
}

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
  reservation:reservations!ses_contract_drafts_reservation_id_fkey(
    id,external_reservation_id,cliente_nombre,cliente_apellido,estado,auto,
    rently_status_code,es_transferencia,rently_delivery_branch_office_id,
    rently_delivery_actual_at,rently_detail_booking_id,rently_detail_vehicle_plate
  ),
  holder:ses_person_profiles!ses_contract_drafts_holder_profile_id_fkey(*),
  primary_driver:ses_person_profiles!ses_contract_drafts_primary_driver_profile_id_fkey(*),
  secondary_driver:ses_person_profiles!ses_contract_drafts_secondary_driver_profile_id_fkey(*),
  pickup_location:ses_locations!ses_contract_drafts_pickup_location_id_fkey(*),
  return_location:ses_locations!ses_contract_drafts_return_location_id_fkey(*)
`;

const LEGACY_DRAFT_RELATIONS = `
  *,
  reservation:reservations!ses_contract_drafts_reservation_id_fkey(
    id,external_reservation_id,cliente_nombre,cliente_apellido
  ),
  holder:ses_person_profiles!ses_contract_drafts_holder_profile_id_fkey(*),
  primary_driver:ses_person_profiles!ses_contract_drafts_primary_driver_profile_id_fkey(*),
  secondary_driver:ses_person_profiles!ses_contract_drafts_secondary_driver_profile_id_fkey(*),
  pickup_location:ses_locations!ses_contract_drafts_pickup_location_id_fkey(*),
  return_location:ses_locations!ses_contract_drafts_return_location_id_fkey(*)
`;

async function calculateCurrentDraftGates(ctx: AuthContext, draft: Record<string, any>) {
  const issues = validateSesDraft(buildValidationInput(draft));
  const officialStatus: SesOfficialClearance['status'] = ['clear', 'blocked', 'review'].includes(draft.official_check_status)
    ? draft.official_check_status
    : 'not_checked';
  const officialClearance: SesOfficialClearance = {
    status: officialStatus,
    clear: officialStatus === 'clear',
    reasons: [],
    matchingCommunicationCode: null,
  };
  return {
    issues,
    officialClearance,
    gates: deriveSesGateState({
      validationIssueCount: issues.length,
      officialClearance,
    }),
  };
}

async function validateAndPersistDraft(ctx: AuthContext, draftId: string) {
  const { data: draft, error } = await ctx.serviceClient.from('ses_contract_drafts')
    .select(DRAFT_RELATIONS).eq('id', draftId).eq('organization_id', ctx.organizationId).single();
  if (error) throw error;
  const locked = isSesDraftLocked(draft.status);
  if (locked) return { draft, issues: draft.validation_errors ?? [] };
  const { issues, officialClearance, gates } = await calculateCurrentDraftGates(ctx, draft);
  const { data: updated, error: updateError } = await ctx.serviceClient.from('ses_contract_drafts')
    .update({
      validation_errors: issues,
      eligibility_errors: [],
      is_complete: gates.isComplete,
      is_eligible: true,
      is_officially_clear: gates.isOfficiallyClear,
      ready_for_xml: gates.readyForXml,
      status: gates.status,
      last_prepared_at: new Date().toISOString(),
    })
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

export async function handleSesSyncDrafts(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.edit');
    await assertSesHardeningSchema(ctx.serviceClient);
    const input = SyncDraftsSchema.parse(req.body ?? {});
    const { data, error, count } = await ctx.serviceClient.from('reservations').select(`
      id,organization_id,external_reservation_id,rently_creation_date,estado,desde,hasta,
      cliente_nombre,cliente_apellido,email,telefono,tipo_documento_cliente,documento_cliente,
      cliente_direccion,cliente_ciudad,cliente_estado_provincia,cliente_pais,cliente_fecha_nacimiento,
      cliente_carnet_numero,cliente_carnet_pais,cliente_carnet_expiracion,
      lugar_entrega,lugar_entrega_direccion,lugar_entrega_ciudad,
      lugar_devolucion,lugar_devolucion_direccion,lugar_devolucion_ciudad,
      modelo,auto,categoria,vehiculo_color,vehiculo_chasis,vehiculo_kms,conductores_adicionales,imported_by
    `, { count: 'exact' })
      .eq('organization_id', ctx.organizationId)
      .order('external_reservation_id', { ascending: true })
      .range(input.offset, input.offset + input.limit - 1);
    if (error) throw error;
    const reservations = (data ?? []) as Array<Record<string, any>>;
    const total = count ?? input.offset + reservations.length;
    if (!reservations.length) {
      return res.json({ data: { processed: 0, created: 0, updated: 0, unchanged: 0, skippedLocked: 0, total, nextOffset: null, hasMore: false }, error: null });
    }

    const reservationIds = reservations.map((row) => row.id);
    const { data: existingDrafts, error: existingError } = await ctx.serviceClient.from('ses_contract_drafts').select('*')
      .eq('organization_id', ctx.organizationId).in('reservation_id', reservationIds);
    if (existingError) throw existingError;
    const existingMap = new Map((existingDrafts ?? []).map((draft) => [draft.reservation_id, draft]));
    const plates = Array.from(new Set(reservations.map((row) => row.auto).filter(Boolean)));
    const { data: fleetVehicles } = plates.length
      ? await ctx.serviceClient.from('fleet_vehicles').select('*').eq('organization_id', ctx.organizationId).in('matricula', plates)
      : { data: [] as any[] };
    const fleetMap = new Map((fleetVehicles ?? []).map((vehicle) => [vehicle.matricula, vehicle]));
    const { data: settings } = await ctx.serviceClient.from('ses_settings').select('*')
      .eq('organization_id', ctx.organizationId).maybeSingle();
    const additionalCustomers = reservations.flatMap((reservation) =>
      parseStoredRentlyDrivers(reservation.conductores_adicionales)
        .map(mapStoredRentlyDriverToCustomer)
        .filter((customer): customer is RentlyCustomerForSes => Boolean(customer)),
    );
    if (additionalCustomers.length) {
      await syncSesPersonProfiles(ctx.serviceClient, ctx.organizationId, ctx.userId, additionalCustomers);
    }
    const additionalDocuments = Array.from(new Set(
      additionalCustomers.map((customer) => normalizeDocumentNumber(customer.DocumentId)).filter(Boolean),
    )) as string[];
    const { data: additionalProfiles } = additionalDocuments.length
      ? await ctx.serviceClient.from('ses_person_profiles').select('*')
        .eq('organization_id', ctx.organizationId).in('document_number', additionalDocuments)
      : { data: [] as any[] };
    const additionalProfileMap = new Map(
      (additionalProfiles ?? []).map((profile) => [normalizeDocumentNumber(profile.document_number), profile]),
    );
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let skippedLocked = 0;

    for (const reservation of reservations) {
      const existing = existingMap.get(reservation.id) as Record<string, any> | undefined;
      if (existing && isSesDraftLocked(existing.status)) {
        skippedLocked++;
        continue;
      }
      const person = await ensurePersonFromReservation(ctx, reservation);
      const pickupLocation = await ensureLocation(ctx, reservation.lugar_entrega, reservation.lugar_entrega_direccion, reservation.lugar_entrega_ciudad, settings?.establishment_code);
      const returnLocation = await ensureLocation(ctx, reservation.lugar_devolucion, reservation.lugar_devolucion_direccion, reservation.lugar_devolucion_ciudad, settings?.establishment_code);
      const fleet = fleetMap.get(reservation.auto) as Record<string, any> | undefined;
      const firstAdditionalDriver = mapStoredRentlyDriverToCustomer(
        parseStoredRentlyDrivers(reservation.conductores_adicionales)[0] ?? {},
      );
      const secondaryDocument = normalizeDocumentNumber(firstAdditionalDriver?.DocumentId);
      const secondaryProfile = secondaryDocument ? additionalProfileMap.get(secondaryDocument) : null;
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
        secondary_driver_profile_id: secondaryProfile?.id ?? null,
        payment_type: settings?.default_payment_type ?? null,
        vehicle_category: fleet?.categoria ?? reservation.categoria ?? null,
        vehicle_type: settings?.default_vehicle_type ?? 'TURISMO',
        vehicle_brand: normalizeSesVehicleBrand(fleet?.marca),
        vehicle_model: fleet?.modelo ?? reservation.modelo ?? null,
        vehicle_plate: fleet?.matricula ?? reservation.auto ?? null,
        vehicle_vin: fleet?.numero_bastidor ?? reservation.vehiculo_chasis ?? null,
        vehicle_color: normalizeSesVehicleColor(fleet?.color ?? reservation.vehiculo_color),
        km_pickup: fleet?.km_recogida ?? reservation.vehiculo_kms ?? null,
        km_return: fleet?.km_devolucion ?? null,
        updated_by: ctx.userId,
      };
      const manualFields = Array.isArray(existing?.manual_fields) ? existing.manual_fields : [];
      const mergedRently = mergeSesRentlyFields({
        existing,
        incoming: automatic,
        manualFields,
        derivedFields: ['payment_type', 'vehicle_type'],
      });
      const merged: Record<string, any> = {
        ...mergedRently.values,
        manual_fields: manualFields,
        ...(existing ? {} : { created_by: ctx.userId }),
      };
      const issues = validateSesDraft({
        ...merged,
        holder: person,
        primary_driver: person,
        secondary_driver: secondaryProfile ?? null,
        pickup_location: pickupLocation,
        return_location: returnLocation,
      });
      const operational = deriveSesOperationalState({ validationIssues: issues });
      const previousSnapshot = existing?.eligibility_snapshot && typeof existing.eligibility_snapshot === 'object'
        ? existing.eligibility_snapshot : {};
      merged.validation_errors = issues;
      merged.is_complete = operational.readyForXml;
      merged.is_eligible = true;
      merged.eligibility_errors = [];
      merged.ready_for_xml = operational.readyForXml;
      merged.status = operational.status;
      merged.eligibility_snapshot = {
        ...previousSnapshot,
        source_by_field: mergedRently.sourceByField,
        sync_conflicts: mergedRently.syncConflicts,
        rently_synced_at: new Date().toISOString(),
      };
      merged.last_prepared_at = new Date().toISOString();
      const nextContentHash = calculateSesDraftContentHash(merged);
      const contentChanged = !existing || existing.content_hash !== nextContentHash;
      merged.draft_version = existing ? existing.draft_version + (contentChanged ? 1 : 0) : 1;
      merged.content_hash = nextContentHash;
      if (existing && !contentChanged && mergedRently.syncConflicts.length === 0) {
        unchanged++;
        continue;
      }
      const { error: saveError } = await ctx.serviceClient.from('ses_contract_drafts')
        .upsert(merged, { onConflict: 'organization_id,reservation_id' });
      if (saveError) throw saveError;
      existing ? updated++ : created++;
    }

    const nextOffset = input.offset + reservations.length < total ? input.offset + reservations.length : null;
    return res.json({
      data: { processed: reservations.length, created, updated, unchanged, skippedLocked, total, nextOffset, hasMore: nextOffset !== null },
      error: null,
    });
  } catch (error) {
    return sendError(res, error, 'sync-drafts');
  }
}

export async function handleSesPrepare(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.edit');
    await assertSesHardeningSchema(ctx.serviceClient);
    const input = PrepareSchema.parse(req.body);
    const period = validateSesDateRange(input.dateFrom, input.dateTo);
    if (!period.valid) {
      const invalidRange = new Error(period.message) as Error & { status?: number };
      invalidRange.status = 422;
      throw invalidRange;
    }
    const reservations = await collectAllPages<Record<string, any>>(async (from, to) => {
      let query = ctx.serviceClient.from('reservations').select(`
        id,organization_id,external_reservation_id,rently_creation_date,estado,desde,hasta,
        cliente_nombre,cliente_apellido,email,telefono,tipo_documento_cliente,documento_cliente,
        cliente_direccion,cliente_ciudad,cliente_estado_provincia,cliente_pais,cliente_fecha_nacimiento,
        cliente_carnet_numero,cliente_carnet_pais,cliente_carnet_expiracion,
        lugar_entrega,lugar_entrega_direccion,lugar_entrega_ciudad,
        lugar_devolucion,lugar_devolucion_direccion,lugar_devolucion_ciudad,
        modelo,auto,categoria,vehiculo_color,vehiculo_chasis,vehiculo_kms,
        rently_detail_synced_at,imported_by,rently_status_code,es_transferencia,
        rently_delivery_branch_office_id,rently_delivery_actual_at,
        rently_detail_booking_id,rently_detail_vehicle_plate
      `).eq('organization_id', ctx.organizationId)
        .gte('desde', `${input.dateFrom}T00:00:00`)
        .lte('desde', `${input.dateTo}T23:59:59`)
        .order('desde', { ascending: true })
        .range(from, to);
      if (input.reservationIds?.length) query = query.in('id', input.reservationIds);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    });

    const rentlyList = await loadRentlyDeliveredCandidatesForSes({
      serviceClient: ctx.serviceClient,
      organizationId: ctx.organizationId,
    });
    const intersection = intersectRentlyPlanMintCandidates({
      rentlyCandidates: rentlyList.candidates,
      planMintReservations: reservations as Array<Record<string, any> & {
        id: string;
        external_reservation_id?: string | number | null;
        auto?: string | null;
      }>,
    });
    const activeExceptions = await loadActiveEligibilityExceptions(ctx, reservations.map((row) => row.id));
    const exactIntersectionIds = new Set(intersection.matches.map((entry) => entry.reservation.id));
    const candidateReservations = [
      ...intersection.matches.map((entry) => entry.reservation),
      ...reservations.filter((row) => activeExceptions.has(row.id) && !exactIntersectionIds.has(row.id)),
    ] as Array<Record<string, any>>;

    let detailsByReservationId = new Map<string, import('../syncRently').RentlyBookingDetail>();
    try {
      const enrichment = await enrichReservationsFromRentlyForSes({
        serviceClient: ctx.serviceClient,
        organizationId: ctx.organizationId,
        reservations: candidateReservations as ReservationForSesEnrichment[],
        actorUserId: ctx.userId,
        credentials: rentlyList.credentials,
        maxReservations: candidateReservations.length,
        forceEnrichment: true,
      });
      detailsByReservationId = enrichment.detailsByReservationId;
    } catch (enrichmentError) {
      console.warn('[ses-hospedajes] Rently detail enrichment failed (non-blocking):', enrichmentError);
    }

    const plates = Array.from(new Set(candidateReservations.map((row) => row.auto).filter(Boolean)));
    const { data: fleetVehicles } = plates.length
      ? await ctx.serviceClient.from('fleet_vehicles').select('*')
          .eq('organization_id', ctx.organizationId).in('matricula', plates)
      : { data: [] as any[] };
    const fleetMap = new Map((fleetVehicles ?? []).map((vehicle) => [vehicle.matricula, vehicle]));
    const { data: settings } = await ctx.serviceClient.from('ses_settings').select('*')
      .eq('organization_id', ctx.organizationId).maybeSingle();
    const { data: existingDrafts } = await ctx.serviceClient.from('ses_contract_drafts').select('*')
      .eq('organization_id', ctx.organizationId)
      .in('reservation_id', reservations.map((row) => row.id));
    const existingMap = new Map((existingDrafts ?? []).map((draft) => [draft.reservation_id, draft]));
    const references = Array.from(new Set(candidateReservations.map((row) => String(row.external_reservation_id || row.id))));
    const officialRows: SesOfficialCommunication[] = [];
    for (let index = 0; index < references.length; index += 250) {
      const { data, error: officialError } = await ctx.serviceClient.from('ses_official_communications')
        .select('official_communication_code,official_lot_code,reference,communication_type,contract_date,normalized_plate,status')
        .eq('organization_id', ctx.organizationId)
        .in('reference', references.slice(index, index + 250));
      if (officialError) throw officialError;
      officialRows.push(...((data ?? []) as SesOfficialCommunication[]));
    }
    const officialByReference = new Map<string, SesOfficialCommunication[]>();
    for (const item of officialRows) {
      const current = officialByReference.get(item.reference) ?? [];
      current.push(item);
      officialByReference.set(item.reference, current);
    }
    let created = 0;
    let updated = 0;
    let skippedLocked = 0;
    const draftIds: string[] = [];
    const exclusions: Array<{ reservationId: string; reference: string; reasons: SesEligibilityIssue[] }> = [];

    for (const exclusion of intersection.exclusions) {
      if (!exclusion.reservationId) continue;
      if (activeExceptions.has(exclusion.reservationId)) continue;
      const existing = existingMap.get(exclusion.reservationId);
      if (!existing || ['batched', 'uploaded_pending_result', 'accepted'].includes(existing.status)) continue;
      const issue: SesEligibilityIssue = {
        code: exclusion.code === 'plate_mismatch' ? 'plate_mismatch' : 'not_in_rently_intersection',
        message: exclusion.message,
        reviewRequired: exclusion.code === 'plate_mismatch' || exclusion.code === 'ambiguous_planmint_booking',
      };
      const { error: exclusionError } = await ctx.serviceClient.from('ses_contract_drafts').update({
        is_eligible: false,
        eligibility_errors: [issue],
        eligibility_snapshot: {
          ...(existing.eligibility_snapshot && typeof existing.eligibility_snapshot === 'object' ? existing.eligibility_snapshot : {}),
          in_exact_rently_intersection: false,
          rently_list_checked_at: new Date().toISOString(),
          rently_list_filters: { CurrentStatus: 2, IsTransfer: false, DeliveryBranchOffice: 1 },
        },
        last_eligibility_checked_at: new Date().toISOString(),
        ready_for_xml: false,
        status: issue.reviewRequired ? 'needs_revision' : 'incomplete',
        updated_by: ctx.userId,
      }).eq('id', existing.id).eq('organization_id', ctx.organizationId);
      if (exclusionError) throw exclusionError;
    }

    for (const reservation of candidateReservations) {
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
      const reference = String(reservation.external_reservation_id || reservation.id).slice(0, 50);
      const contractDate = reservation.rently_creation_date?.slice(0, 10) || null;
      const visibleStatus = detail?.CurrentStatus === 2
        ? 'Entregado'
        : detail?.CurrentStatus === 3 ? 'Terminada' : reservation.estado;
      const detailBranchOfficeId = typeof detail?.DeliveryBranchOffice === 'number'
        ? detail.DeliveryBranchOffice
        : detail?.DeliveryBranchOffice?.Id ?? detail?.DeliveryBranchOfficeId ?? null;
      const manualException = toManualEligibilityException(activeExceptions.get(reservation.id));
      const eligibility = evaluateSesEligibility({
        visibleStatus,
        rentlyStatusCode: detail?.CurrentStatus ?? null,
        isTransfer: detail?.IsTransfer ?? null,
        deliveryBranchOfficeId: detailBranchOfficeId,
        actualDeliveryAt: detail?.DeliveryInfo?.Date ?? null,
        externalBookingId: reservation.external_reservation_id,
        detailBookingId: detail?.Id ?? null,
        reservationPlate: reservation.auto,
        detailVehiclePlate: detail?.Car?.Plate ?? null,
        inExactRentlyIntersection: exactIntersectionIds.has(reservation.id),
        manualException,
      });
      const officialIdentityHash = buildOfficialIdentityHash({
        reference,
        contractDate,
        vehiclePlate: fleet?.matricula ?? reservation.auto ?? null,
      });
      const existingSnapshot = existing?.eligibility_snapshot && typeof existing.eligibility_snapshot === 'object'
        ? existing.eligibility_snapshot : {};
      const checked = (officialByReference.get(reference) ?? []).length > 0
        || (existingSnapshot.official_identity_hash === officialIdentityHash
          && ['clear', 'blocked', 'review'].includes(existing?.official_check_status));
      const officialClearance = evaluateOfficialClearance({
        checked,
        reference,
        contractDate,
        vehiclePlate: fleet?.matricula ?? reservation.auto ?? null,
        communications: officialByReference.get(reference) ?? [],
      });
      if (!eligibility.eligible) {
        exclusions.push({
          reservationId: reservation.id,
          reference: String(reservation.external_reservation_id || reservation.id),
          reasons: eligibility.issues,
        });
      }

      const automatic = {
        organization_id: ctx.organizationId,
        reservation_id: reservation.id,
        external_booking_id: Number(reservation.external_reservation_id) || null,
        reference,
        contract_date: contractDate,
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
        is_eligible: eligibility.eligible,
        eligibility_errors: eligibility.issues,
        eligibility_snapshot: {
          visible_status: visibleStatus,
          rently_status_code: detail?.CurrentStatus ?? null,
          is_transfer: detail?.IsTransfer ?? null,
          delivery_branch_office_id: detailBranchOfficeId,
          actual_delivery_at: detail?.DeliveryInfo?.Date ?? null,
          detail_booking_id: detail?.Id ?? null,
          detail_vehicle_plate: detail?.Car?.Plate ?? null,
          in_exact_rently_intersection: exactIntersectionIds.has(reservation.id),
          rently_list_checked_at: new Date().toISOString(),
          rently_list_filters: { CurrentStatus: 2, IsTransfer: false, DeliveryBranchOffice: 1 },
          manual_exception_id: activeExceptions.get(reservation.id)?.id ?? null,
          manual_exception_applied: eligibility.manualExceptionApplied,
          official_identity_hash: officialIdentityHash,
          official_checked_at: checked ? existingSnapshot.official_checked_at ?? new Date().toISOString() : null,
          official_status: officialClearance.status,
          official_reasons: officialClearance.reasons,
        },
        last_eligibility_checked_at: new Date().toISOString(),
        official_check_status: officialClearance.status,
        is_officially_clear: officialClearance.clear,
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
      const gates = deriveSesGateState({
        validationIssueCount: issues.length,
        eligible: eligibility.eligible,
        eligibilityRequiresReview: eligibility.requiresReview,
        officialClearance,
      });
      merged.validation_errors = issues;
      merged.is_complete = gates.isComplete;
      merged.is_eligible = gates.isEligible;
      merged.is_officially_clear = gates.isOfficiallyClear;
      merged.ready_for_xml = gates.readyForXml;
      merged.status = gates.status;

      const { data: saved, error: saveError } = await ctx.serviceClient.from('ses_contract_drafts')
        .upsert(merged, { onConflict: 'organization_id,reservation_id' }).select('id').single();
      if (saveError) throw saveError;
      draftIds.push(saved.id);
      existing ? updated++ : created++;
    }

    return res.json({
      data: {
        total: candidateReservations.length,
        rentlyCandidates: intersection.rentlyCandidateCount,
        planMintReservations: intersection.planMintReservationCount,
        intersectionMatches: intersection.matches.length,
        manualExceptions: candidateReservations.filter((row) => activeExceptions.has(row.id)).length,
        eligible: candidateReservations.length - exclusions.length,
        excluded: intersection.exclusions.length + exclusions.length,
        created,
        updated,
        skippedLocked,
        exclusions: [
          ...intersection.exclusions.map((item) => ({
            reservationId: item.reservationId ?? '',
            reference: item.externalBookingId,
            reasons: [{
              code: item.code === 'plate_mismatch' ? 'plate_mismatch' : 'not_in_rently_intersection',
              message: item.message,
              reviewRequired: item.code === 'plate_mismatch' || item.code === 'ambiguous_planmint_booking',
            }],
          })),
          ...exclusions,
        ],
        draftIds,
      },
      error: null,
    });
  } catch (error) {
    return sendError(res, error, 'prepare');
  }
}

export async function handleSesListDrafts(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.view');
    const input = ListSchema.parse(req.body ?? {});
    if (input.dateFrom && input.dateTo) {
      const period = validateSesDateRange(input.dateFrom, input.dateTo);
      if (!period.valid) {
        const invalidRange = new Error(period.message) as Error & { status?: number };
        invalidRange.status = 422;
        throw invalidRange;
      }
    }
    const applyFilters = (query: any): any => {
      let filtered = query;
      if (input.dateFrom) filtered = filtered.gte('pickup_at', `${input.dateFrom}T00:00:00`);
      if (input.dateTo) filtered = filtered.lte('pickup_at', `${input.dateTo}T23:59:59`);
      if (input.status && input.status !== 'all') {
        filtered = input.status === 'xml_generated'
          ? filtered.in('status', ['batched', 'uploaded_pending_result', 'accepted'])
          : filtered.eq('status', input.status);
      }
      if (input.search?.trim()) {
        const search = input.search.trim().replace(/[%_,]/g, '');
        const plate = search.toUpperCase().replace(/[^A-Z0-9]/g, '');
        filtered = input.searchMode === 'exact'
          ? filtered.or(`reference.eq.${search},vehicle_plate.eq.${plate}`)
          : filtered.or(`reference.ilike.%${search}%,vehicle_plate.ilike.%${plate}%`);
      }
      return filtered;
    };
    const runDraftQuery = async (relations: string) => {
      let query = ctx.serviceClient.from('ses_contract_drafts').select(relations, { count: 'exact' })
        .eq('organization_id', ctx.organizationId).order('pickup_at', { ascending: true })
        .range(input.offset, input.offset + input.limit - 1);
      query = applyFilters(query);
      return query;
    };
    let { data, error, count } = await runDraftQuery(DRAFT_RELATIONS);
    let schemaMigrationRequired = false;
    if (error && isSesSchemaCompatibilityError(error)) {
      const legacyResult = await runDraftQuery(LEGACY_DRAFT_RELATIONS);
      data = legacyResult.data;
      error = legacyResult.error;
      count = legacyResult.count;
      schemaMigrationRequired = true;
    }
    if (error) throw error;
    const statusRows = await collectAllPages<{ status: string; validation_errors: unknown[] | null }>(async (from, to) => {
      let statusQuery = ctx.serviceClient.from('ses_contract_drafts').select('status,validation_errors')
        .eq('organization_id', ctx.organizationId).order('pickup_at', { ascending: true }).range(from, to);
      statusQuery = applyFilters(statusQuery);
      const { data: page, error: pageError } = await statusQuery;
      if (pageError) throw pageError;
      return page ?? [];
    });
    const summary = statusRows.reduce((acc: Record<string, number>, draft) => {
      const operational = deriveSesOperationalState({
        historicalStatus: draft.status,
        validationIssues: Array.isArray(draft.validation_errors) ? draft.validation_errors as SesValidationIssue[] : [],
      });
      acc[operational.status] = (acc[operational.status] ?? 0) + 1;
      return acc;
    }, {});
    const compatibleDrafts = schemaMigrationRequired
      ? (data ?? []).map((draft) => withLegacyDraftGates(draft as Record<string, any>))
      : (data ?? []);
    const normalizedDrafts = compatibleDrafts.map((draft) => projectSesOperationalDraft(draft as Record<string, any>));
    return res.json({
      data: {
        drafts: normalizedDrafts, summary, total: count ?? statusRows.length,
        pageCount: normalizedDrafts.length, limit: input.limit, offset: input.offset,
        schemaMigrationRequired,
      },
      error: null,
    });
  } catch (error) {
    return sendError(res, error, 'list');
  }
}

export async function handleSesUpdatePerson(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.edit');
    await assertSesHardeningSchema(ctx.serviceClient);
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
    await persistSesFieldAudit(ctx.serviceClient, buildSesFieldAuditRows({
      organizationId: ctx.organizationId, entityType: 'person', entityId: input.id,
      source: 'manual', actorUserId: ctx.userId, previous: current, changes: changedValues,
      reason: 'Actualización manual desde el editor SES',
    }));

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
    await assertSesHardeningSchema(ctx.serviceClient);
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
    const { data: currentDraft, error: draftError } = await ctx.serviceClient.from('ses_contract_drafts')
      .select('manual_fields').eq('id', input.draftId).eq('organization_id', ctx.organizationId).single();
    if (draftError) throw draftError;
    const draftManualFields = Array.from(new Set([...(currentDraft.manual_fields ?? []), field]));
    const { error: attachError } = await ctx.serviceClient.from('ses_contract_drafts')
      .update({ [field]: person.id, manual_fields: draftManualFields, updated_by: ctx.userId })
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
    await assertSesHardeningSchema(ctx.serviceClient);
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
    const invalidatesOfficialCheck = changedFields.some((field) => ['reference', 'contract_date', 'vehicle_plate'].includes(field));
    const { error } = await ctx.serviceClient.from('ses_contract_drafts').update({
      ...changedValues,
      manual_fields: manualFields,
      draft_version: current.draft_version + 1,
      content_hash: nextContentHash,
      ...(invalidatesOfficialCheck ? {
        official_check_status: 'not_checked',
        is_officially_clear: false,
        ready_for_xml: false,
      } : {}),
      updated_by: ctx.userId,
    }).eq('id', input.id).eq('organization_id', ctx.organizationId);
    if (error) throw error;
    await audit(ctx, 'draft', input.id, 'manual_update', changedFields);
    await persistSesFieldAudit(ctx.serviceClient, buildSesFieldAuditRows({
      organizationId: ctx.organizationId, entityType: 'draft', entityId: input.id,
      source: 'manual', actorUserId: ctx.userId, previous: current, changes: changedValues,
      reason: 'Actualización manual desde el editor SES',
    }));
    const result = await validateAndPersistDraft(ctx, input.id);
    return res.json({ data: result, error: null });
  } catch (error) {
    return sendError(res, error, 'update-draft');
  }
}

export async function handleSesUpdateLocation(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.edit');
    await assertSesHardeningSchema(ctx.serviceClient);
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
    await persistSesFieldAudit(ctx.serviceClient, buildSesFieldAuditRows({
      organizationId: ctx.organizationId, entityType: 'location', entityId: input.id,
      source: 'manual', actorUserId: ctx.userId, previous: current, changes: changedValues,
      reason: 'Actualización manual desde el editor SES',
    }));
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
    await assertSesHardeningSchema(ctx.serviceClient);
    const input = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(req.body);
    const { data: drafts, error: draftsError } = await ctx.serviceClient.from('ses_contract_drafts')
      .select(DRAFT_RELATIONS).eq('organization_id', ctx.organizationId).in('id', input.ids);
    if (draftsError) throw draftsError;
    const reservations = (drafts ?? []).flatMap((draft: Record<string, any>) => {
      const reservation = Array.isArray(draft.reservation) ? draft.reservation[0] : draft.reservation;
      return reservation ? [reservation] : [];
    });
    const rentlyList = await loadRentlyDeliveredCandidatesForSes({
      serviceClient: ctx.serviceClient,
      organizationId: ctx.organizationId,
    });
    const intersection = intersectRentlyPlanMintCandidates({
      rentlyCandidates: rentlyList.candidates,
      planMintReservations: reservations,
    });
    const exactReservationIds = new Set(intersection.matches.map((entry) => entry.reservation.id));
    const activeExceptions = await loadActiveEligibilityExceptions(ctx, reservations.map((row) => row.id));
    const detailCandidates = reservations.filter((row) => exactReservationIds.has(row.id) || activeExceptions.has(row.id));
    await enrichReservationsFromRentlyForSes({
      serviceClient: ctx.serviceClient,
      organizationId: ctx.organizationId,
      reservations: detailCandidates as ReservationForSesEnrichment[],
      actorUserId: ctx.userId,
      credentials: rentlyList.credentials,
      maxReservations: detailCandidates.length,
      forceEnrichment: true,
    });
    const checkedAt = new Date().toISOString();
    for (const draft of (drafts ?? []) as Array<Record<string, any>>) {
      if (isSesDraftLocked(draft.status)) continue;
      const reservation = Array.isArray(draft.reservation) ? draft.reservation[0] : draft.reservation;
      const previousSnapshot = draft.eligibility_snapshot && typeof draft.eligibility_snapshot === 'object'
        ? draft.eligibility_snapshot : {};
      const { error: snapshotError } = await ctx.serviceClient.from('ses_contract_drafts').update({
        eligibility_snapshot: {
          ...previousSnapshot,
          in_exact_rently_intersection: Boolean(reservation && exactReservationIds.has(reservation.id)),
          rently_list_checked_at: checkedAt,
          rently_list_filters: { CurrentStatus: 2, IsTransfer: false, DeliveryBranchOffice: 1 },
          manual_exception_id: reservation ? activeExceptions.get(reservation.id)?.id ?? null : null,
        },
      }).eq('organization_id', ctx.organizationId).eq('id', draft.id);
      if (snapshotError) throw snapshotError;
    }
    const results = [];
    for (const id of input.ids) results.push(await validateAndPersistDraft(ctx, id));
    return res.json({ data: { results, rentlyCandidates: intersection.rentlyCandidateCount, intersectionMatches: intersection.matches.length }, error: null });
  } catch (error) {
    return sendError(res, error, 'revalidate');
  }
}

export async function handleSesGetSettings(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.view');
    let { data, error } = await ctx.serviceClient.from('ses_settings').select(`
      organization_id,lessor_code,establishment_code,default_payment_type,
      default_vehicle_type,government_service_enabled,updated_at,
      official_xsd_hash,official_xsd_version,official_xsd_uploaded_at,
      official_inventory_confirmed_at,official_inventory_source_date
    `).eq('organization_id', ctx.organizationId).maybeSingle();
    let schemaMigrationRequired = false;
    if (error && isSesSchemaCompatibilityError(error)) {
      const legacy = await ctx.serviceClient.from('ses_settings').select(`
        organization_id,lessor_code,establishment_code,default_payment_type,
        default_vehicle_type,government_service_enabled,updated_at
      `).eq('organization_id', ctx.organizationId).maybeSingle();
      data = legacy.data ? {
        ...legacy.data,
        official_xsd_hash: null,
        official_xsd_version: null,
        official_xsd_uploaded_at: null,
        official_inventory_confirmed_at: null,
        official_inventory_source_date: null,
      } as any : null;
      error = legacy.error;
      schemaMigrationRequired = true;
    }
    if (error) throw error;
    return res.json({
      data: data ? { ...data, schema_migration_required: schemaMigrationRequired } : null,
      error: null,
    });
  } catch (error) {
    return sendError(res, error, 'get-settings');
  }
}

export async function handleSesUploadOfficialXsd(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.manage_settings');
    await assertSesHardeningSchema(ctx.serviceClient);
    const input = UploadOfficialXsdSchema.parse(req.body);
    if (!/<(?:xs|xsd):schema\b/.test(input.content)) {
      const invalid = new Error('El archivo no contiene un esquema XSD reconocible') as Error & { status?: number };
      invalid.status = 422;
      throw invalid;
    }
    const hash = sha256Utf8(input.content);
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `ses/${ctx.organizationId}/xsd/${hash.slice(0, 16)}-${safeName}`;
    const stored = await storagePut(key, input.content, 'application/xml; charset=utf-8');
    const now = new Date().toISOString();
    const { error } = await ctx.serviceClient.from('ses_settings').upsert({
      organization_id: ctx.organizationId,
      official_xsd_storage_key: stored.key,
      official_xsd_url: stored.url,
      official_xsd_hash: hash,
      official_xsd_version: input.version,
      official_xsd_uploaded_at: now,
      official_xsd_uploaded_by: ctx.userId,
      updated_by: ctx.userId,
    }, { onConflict: 'organization_id' });
    if (error) throw error;
    await audit(ctx, 'xsd', ctx.organizationId, 'official_xsd_uploaded', [
      'official_xsd_hash', 'official_xsd_version', 'official_xsd_storage_key',
    ], { file_name: safeName, hash, version: input.version });
    return res.json({ data: { hash, version: input.version, uploadedAt: now }, error: null });
  } catch (error) {
    return sendError(res, error, 'upload-official-xsd');
  }
}

export async function handleSesGetFilterPreferences(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.view');
    const { data, error } = await ctx.serviceClient.auth.admin.getUserById(ctx.userId);
    if (error) throw error;
    return res.json({ data: readSesFilterPreferences(data.user?.user_metadata), error: null });
  } catch (error) {
    return sendError(res, error, 'filter-preferences');
  }
}

export async function handleSesUpdateFilterPreferences(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.view');
    const input = SesFilterPreferencesSchema.parse(req.body);
    const { data: current, error: readError } = await ctx.serviceClient.auth.admin.getUserById(ctx.userId);
    if (readError) throw readError;
    if (!current.user) throw new Error('No se encontró la cuenta de usuario');

    const { error: updateError } = await ctx.serviceClient.auth.admin.updateUserById(ctx.userId, {
      user_metadata: mergeSesFilterPreferences(current.user.user_metadata, input),
    });
    if (updateError) throw updateError;
    return res.json({ data: input, error: null });
  } catch (error) {
    return sendError(res, error, 'filter-preferences-update');
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
    let { data, error } = await ctx.serviceClient.from('ses_batches').select(`
      id,status,schema_version,file_name,xml_hash,item_count,accepted_count,error_count,
      generated_at,downloaded_at,uploaded_at,result_recorded_at,notes,official_lot_code,
      document_version,xsd_version,xsd_hash,xsd_validated_at,
      items:ses_batch_items(
        id,draft_id,item_order,draft_version,result_status,result_code,result_message,official_communication_code,
        payload_snapshot,snapshot_version,snapshot_hash,
        draft:ses_contract_drafts!ses_batch_items_draft_id_fkey(id,reference,status)
      )
    `).eq('organization_id', ctx.organizationId).order('generated_at', { ascending: false }).limit(50);
    if (error && isSesSchemaCompatibilityError(error)) {
      const legacy = await ctx.serviceClient.from('ses_batches').select(`
        id,status,schema_version,file_name,xml_hash,item_count,accepted_count,error_count,
        generated_at,downloaded_at,uploaded_at,result_recorded_at,notes,
        items:ses_batch_items(
          id,draft_id,item_order,draft_version,result_status,result_code,result_message,
          payload_snapshot,draft:ses_contract_drafts!ses_batch_items_draft_id_fkey(id,reference,status)
        )
      `).eq('organization_id', ctx.organizationId).order('generated_at', { ascending: false }).limit(50);
      data = (legacy.data ?? []).map((batch) => withLegacyBatchFields(batch as Record<string, any>)) as any;
      error = legacy.error;
    }
    if (error) throw error;
    return res.json({ data: data ?? [], error: null });
  } catch (error) {
    return sendError(res, error, 'list-batches');
  }
}

export async function handleSesListOfficialInventory(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.view');
    const input = ListOfficialInventorySchema.parse(req.body ?? {});
    let query = ctx.serviceClient.from('ses_official_communications').select('*', { count: 'exact' })
      .eq('organization_id', ctx.organizationId)
      .order('recorded_at', { ascending: false })
      .range(input.offset, input.offset + input.limit - 1);
    if (input.status !== 'all') query = query.eq('status', input.status);
    if (input.search) {
      const search = input.search.replace(/[%_,]/g, '');
      const plate = search.toUpperCase().replace(/[^A-Z0-9]/g, '');
      query = query.or(`reference.eq.${search},normalized_plate.eq.${plate},official_communication_code.eq.${search}`);
    }
    const { data, count, error } = await query;
    if (error && isSesSchemaCompatibilityError(error)) {
      return res.json({
        data: { items: [], total: 0, mode: 'exact_on_demand', schemaMigrationRequired: true },
        error: null,
      });
    }
    if (error) throw error;
    return res.json({ data: { items: data ?? [], total: count ?? 0, mode: 'exact_on_demand' }, error: null });
  } catch (error) {
    return sendError(res, error, 'list-official-inventory');
  }
}

export async function handleSesImportOfficialInventory(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.export');
    await assertSesHardeningSchema(ctx.serviceClient);
    const input = ImportOfficialInventorySchema.parse(req.body);
    assertNonEmptyOfficialInventory(input.items);
    const now = new Date().toISOString();
    const rows = input.items.map((item) => normalizeOfficialInventoryItem({
      organization_id: ctx.organizationId,
      official_communication_code: item.officialCommunicationCode,
      official_lot_code: item.officialLotCode ?? null,
      reference: item.reference,
      communication_type: item.communicationType,
      contract_date: item.contractDate,
      vehicle_plate: item.vehiclePlate ?? null,
      status: item.status,
      source: 'manual_import' as const,
      recorded_by: ctx.userId,
      recorded_at: now,
      notes: item.notes ?? null,
    }));
    const codes = rows.map((row) => row.official_communication_code);
    const { data: existingRows, error: existingError } = codes.length
      ? await ctx.serviceClient.from('ses_official_communications').select('*')
          .eq('organization_id', ctx.organizationId).in('official_communication_code', codes)
      : { data: [], error: null };
    if (existingError) throw existingError;
    const existingByCode = new Map((existingRows ?? []).map((row: any) => [row.official_communication_code, row]));
    for (const row of rows) assertStableOfficialCommunicationIdentity(existingByCode.get(row.official_communication_code), row);
    for (let index = 0; index < rows.length; index += 250) {
      const { error } = await ctx.serviceClient.from('ses_official_communications').upsert(
        rows.slice(index, index + 250),
        { onConflict: 'organization_id,official_communication_code' },
      );
      if (error) throw error;
    }
    await audit(ctx, 'official_communication', ctx.organizationId, 'official_inventory_imported', [
      'ses_official_communications',
    ], { item_count: rows.length, source_date: input.sourceDate ?? null, mode: 'additive_optional' });
    return res.json({ data: { imported: rows.length, mode: 'additive_optional' }, error: null });
  } catch (error) {
    return sendError(res, error, 'import-official-inventory');
  }
}

export async function handleSesCheckOfficialCommunication(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.export');
    await assertSesHardeningSchema(ctx.serviceClient);
    const input = CheckOfficialCommunicationSchema.parse(req.body);
    const { data: draft, error: draftError } = await ctx.serviceClient.from('ses_contract_drafts')
      .select(DRAFT_RELATIONS).eq('organization_id', ctx.organizationId).eq('id', input.draftId).single();
    if (draftError) throw draftError;
    if (isSesDraftLocked(draft.status)) {
      const locked = new Error('El contrato ya pertenece a un lote o fue aceptado y no puede volver a conciliarse') as Error & { status?: number };
      locked.status = 409;
      throw locked;
    }

    const expectedHash = buildOfficialIdentityHash({
      reference: draft.reference,
      contractDate: draft.contract_date,
      vehiclePlate: draft.vehicle_plate,
    });
    if (input.communication && input.communication.reference !== draft.reference) {
      const mismatch = new Error('La comunicación oficial no corresponde a la referencia consultada') as Error & { status?: number };
      mismatch.status = 422;
      throw mismatch;
    }

    if (input.communication) {
      const now = new Date().toISOString();
      const row = normalizeOfficialInventoryItem({
        organization_id: ctx.organizationId,
        official_communication_code: input.communication.officialCommunicationCode,
        official_lot_code: input.communication.officialLotCode ?? null,
        reference: input.communication.reference,
        communication_type: input.communication.communicationType,
        contract_date: input.communication.contractDate,
        vehicle_plate: input.communication.vehiclePlate ?? null,
        status: input.communication.status,
        source: 'manual_import' as const,
        recorded_by: ctx.userId,
        recorded_at: now,
        notes: input.communication.notes ?? null,
      });
      const { data: existing, error: existingError } = await ctx.serviceClient.from('ses_official_communications')
        .select('*').eq('organization_id', ctx.organizationId)
        .eq('official_communication_code', row.official_communication_code).maybeSingle();
      if (existingError) throw existingError;
      assertStableOfficialCommunicationIdentity(existing as SesOfficialCommunication | null, row as SesOfficialCommunication);
      const { error: upsertError } = await ctx.serviceClient.from('ses_official_communications')
        .upsert(row, { onConflict: 'organization_id,official_communication_code' });
      if (upsertError) throw upsertError;
    }

    const { data: officialRows, error: officialError } = await ctx.serviceClient.from('ses_official_communications')
      .select('official_communication_code,official_lot_code,reference,communication_type,contract_date,normalized_plate,status')
      .eq('organization_id', ctx.organizationId).eq('reference', draft.reference);
    if (officialError) throw officialError;
    const officialClearance = evaluateOfficialClearance({
      checked: true,
      reference: draft.reference,
      contractDate: draft.contract_date,
      vehiclePlate: draft.vehicle_plate,
      communications: (officialRows ?? []) as SesOfficialCommunication[],
    });
    const previousSnapshot = draft.eligibility_snapshot && typeof draft.eligibility_snapshot === 'object'
      ? draft.eligibility_snapshot : {};
    const checkedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await ctx.serviceClient.from('ses_contract_drafts').update({
      official_check_status: officialClearance.status,
      is_officially_clear: officialClearance.clear,
      eligibility_snapshot: {
        ...previousSnapshot,
        official_identity_hash: expectedHash,
        official_checked_at: checkedAt,
        official_status: officialClearance.status,
        official_reasons: officialClearance.reasons,
      },
      updated_by: ctx.userId,
    }).eq('organization_id', ctx.organizationId).eq('id', draft.id).select('*').single();
    if (updateError) throw updateError;
    await audit(ctx, 'draft', draft.id, 'official_exact_check_recorded', [
      'official_check_status', 'is_officially_clear', 'eligibility_snapshot',
    ], { outcome: input.outcome, official_status: officialClearance.status, checked_at: checkedAt });
    return res.json({ data: { draft: updated, officialClearance, checkedAt }, error: null });
  } catch (error) {
    return sendError(res, error, 'check-official-communication');
  }
}

export async function handleSesCreateEligibilityException(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.export');
    await assertSesHardeningSchema(ctx.serviceClient);
    await assertSesEligibilityExceptionSchema(ctx.serviceClient);
    const input = CreateEligibilityExceptionSchema.parse(req.body);
    const now = new Date();
    const expiresAt = new Date(input.expiresAt);
    if (expiresAt.getTime() <= now.getTime() || expiresAt.getTime() > now.getTime() + 7 * 86_400_000) {
      const invalidExpiry = new Error('La excepción debe caducar en el futuro y no puede superar 7 días') as Error & { status?: number };
      invalidExpiry.status = 422;
      throw invalidExpiry;
    }

    const { data: draft, error: draftError } = await ctx.serviceClient.from('ses_contract_drafts')
      .select(DRAFT_RELATIONS).eq('organization_id', ctx.organizationId).eq('id', input.draftId).single();
    if (draftError) throw draftError;
    if (isSesDraftLocked(draft.status)) {
      const locked = new Error('El contrato ya pertenece a un lote o fue aceptado y no admite excepciones') as Error & { status?: number };
      locked.status = 409;
      throw locked;
    }
    const reservation = Array.isArray(draft.reservation) ? draft.reservation[0] : draft.reservation;
    if (!reservation || reservation.rently_status_code !== 3) {
      const invalidStatus = new Error('La excepción solo se admite para una reserva Terminada en Rently y no comunicada') as Error & { status?: number };
      invalidStatus.status = 422;
      throw invalidStatus;
    }

    const { data: existingException, error: existingExceptionError } = await ctx.serviceClient.from('ses_eligibility_exceptions')
      .select('*').eq('organization_id', ctx.organizationId).eq('draft_id', draft.id).is('revoked_at', null).maybeSingle();
    if (existingExceptionError) throw existingExceptionError;
    if (existingException && new Date(existingException.expires_at).getTime() > now.getTime()) {
      const duplicate = new Error('Este contrato ya tiene una excepción manual activa') as Error & { status?: number };
      duplicate.status = 409;
      throw duplicate;
    }
    if (existingException) {
      const { error: expireError } = await ctx.serviceClient.from('ses_eligibility_exceptions').update({
        revoked_at: now.toISOString(),
        revoked_by: ctx.userId,
        revocation_reason: 'Caducada automáticamente antes de registrar una nueva excepción',
      }).eq('organization_id', ctx.organizationId).eq('id', existingException.id);
      if (expireError) throw expireError;
      await audit(ctx, 'eligibility_exception', existingException.id, 'manual_exception_expired', [
        'revoked_at', 'revoked_by', 'revocation_reason',
      ], { draft_id: draft.id, reservation_id: reservation.id });
    }

    const row = {
      organization_id: ctx.organizationId,
      draft_id: draft.id,
      reservation_id: reservation.id,
      kind: 'terminated_not_reported',
      protocol_reference: input.protocolReference,
      reason: input.reason,
      approved_by: ctx.userId,
      approved_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };
    const { data: exception, error: insertError } = await ctx.serviceClient.from('ses_eligibility_exceptions')
      .insert(row).select('*').single();
    if (insertError) throw insertError;
    await audit(ctx, 'eligibility_exception', exception.id, 'manual_exception_created', [
      'kind', 'protocol_reference', 'reason', 'approved_by', 'approved_at', 'expires_at',
    ], { draft_id: draft.id, reservation_id: reservation.id });
    const revalidated = await validateAndPersistDraft(ctx, draft.id);
    return res.json({ data: { exception, revalidated }, error: null });
  } catch (error) {
    return sendError(res, error, 'create-eligibility-exception');
  }
}

export async function handleSesRevokeEligibilityException(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.export');
    await assertSesHardeningSchema(ctx.serviceClient);
    await assertSesEligibilityExceptionSchema(ctx.serviceClient);
    const input = RevokeEligibilityExceptionSchema.parse(req.body);
    const { data: current, error: currentError } = await ctx.serviceClient.from('ses_eligibility_exceptions')
      .select('*').eq('organization_id', ctx.organizationId).eq('id', input.exceptionId).is('revoked_at', null).single();
    if (currentError) throw currentError;
    const revokedAt = new Date().toISOString();
    const { data: exception, error: revokeError } = await ctx.serviceClient.from('ses_eligibility_exceptions').update({
      revoked_at: revokedAt,
      revoked_by: ctx.userId,
      revocation_reason: input.reason,
    }).eq('organization_id', ctx.organizationId).eq('id', input.exceptionId).select('*').single();
    if (revokeError) throw revokeError;
    await audit(ctx, 'eligibility_exception', exception.id, 'manual_exception_revoked', [
      'revoked_at', 'revoked_by', 'revocation_reason',
    ], { draft_id: current.draft_id, reservation_id: current.reservation_id });
    const revalidated = await validateAndPersistDraft(ctx, current.draft_id);
    return res.json({ data: { exception, revalidated }, error: null });
  } catch (error) {
    return sendError(res, error, 'revoke-eligibility-exception');
  }
}

export async function handleSesMarkBatchUploaded(req: Request, res: Response) {
  try {
    const ctx = await authorize(req, 'ses_hospedajes.export');
    await assertSesHardeningSchema(ctx.serviceClient);
    const input = MarkBatchUploadedSchema.parse(req.body);
    const { data: batch, error: batchError } = await ctx.serviceClient.from('ses_batches')
      .select('id,status,notes,official_lot_code')
      .eq('id', input.batchId)
      .eq('organization_id', ctx.organizationId)
      .single();
    if (batchError) throw batchError;
    if (!['downloaded', 'uploaded_pending_result'].includes(batch.status)) {
      const conflict = new Error('Solo se puede registrar la subida de un lote descargado o pendiente') as Error & { status?: number };
      conflict.status = 409;
      throw conflict;
    }

    if (batch.official_lot_code && batch.official_lot_code !== input.officialLotCode) {
      const conflict = new Error('Este lote ya tiene un código oficial distinto') as Error & { status?: number };
      conflict.status = 409;
      throw conflict;
    }
    const notes = [batch.notes, input.notes].filter(Boolean).join('\n') || null;
    const now = new Date().toISOString();
    const { data: updated, error } = await ctx.serviceClient.from('ses_batches').update({
      status: 'uploaded_pending_result',
      uploaded_at: now,
      official_lot_code: input.officialLotCode,
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

    await audit(ctx, 'batch', input.batchId, 'manual_upload_receipt_recorded', ['status', 'uploaded_at', 'official_lot_code', 'notes'], {
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
    await assertSesHardeningSchema(ctx.serviceClient);
    const input = RecordBatchResultSchema.parse(req.body);
    const { data: batch, error: batchError } = await ctx.serviceClient.from('ses_batches')
      .select(`
        id,status,item_count,notes,official_lot_code,
        items:ses_batch_items(
          id,draft_id,
          draft:ses_contract_drafts!ses_batch_items_draft_id_fkey(
            id,reference,contract_date,vehicle_plate
          )
        )
      `)
      .eq('id', input.batchId)
      .eq('organization_id', ctx.organizationId)
      .single();
    if (batchError) throw batchError;
    if (!['uploaded_pending_result', 'partially_accepted', 'accepted', 'error'].includes(batch.status)) {
      const conflict = new Error('Registra primero el acuse de subida del lote') as Error & { status?: number };
      conflict.status = 409;
      throw conflict;
    }

    if (!batch.official_lot_code) {
      const conflict = new Error('El lote no tiene código oficial estructurado') as Error & { status?: number };
      conflict.status = 409;
      throw conflict;
    }
    const batchDraftIds = new Set((batch.items ?? []).map((item: { draft_id: string }) => item.draft_id));
    const acceptedIds = Array.from(new Set(input.accepted.map((item) => item.draftId)));
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

    const officialCodes = input.accepted.map((item) => item.officialCommunicationCode);
    if (new Set(officialCodes).size !== officialCodes.length) {
      const duplicate = new Error('Cada comunicación aceptada debe tener un código oficial único') as Error & { status?: number };
      duplicate.status = 422;
      throw duplicate;
    }
    const { data: registeredCodes, error: registeredCodesError } = officialCodes.length
      ? await ctx.serviceClient.from('ses_official_communications').select('*')
          .eq('organization_id', ctx.organizationId).in('official_communication_code', officialCodes)
      : { data: [], error: null };
    if (registeredCodesError) throw registeredCodesError;
    const registeredByCode = new Map((registeredCodes ?? []).map((row: any) => [row.official_communication_code, row]));
    const outcome = deriveSesBatchOutcome(batch.item_count, acceptedIds.length, input.errors.length);
    const now = new Date().toISOString();
    if (acceptedIds.length) {
      for (const accepted of input.accepted) {
        const { error } = await ctx.serviceClient.from('ses_batch_items').update({
          result_status: 'accepted', result_code: null, result_message: null,
          official_communication_code: accepted.officialCommunicationCode,
        }).eq('batch_id', input.batchId).eq('draft_id', accepted.draftId);
        if (error) throw error;
        const batchItem = (batch.items ?? []).find((item: any) => item.draft_id === accepted.draftId);
        const draft = Array.isArray(batchItem?.draft) ? batchItem.draft[0] : batchItem?.draft;
        if (!draft) throw new Error('No se pudo resolver el contrato aceptado');
        const official = normalizeOfficialInventoryItem({
          organization_id: ctx.organizationId,
          official_communication_code: accepted.officialCommunicationCode,
          official_lot_code: batch.official_lot_code,
          reference: draft.reference,
          communication_type: 'ALQUILER_VEHICULO' as const,
          contract_date: draft.contract_date,
          vehicle_plate: draft.vehicle_plate,
          status: 'accepted' as const,
          source: 'portal_result' as const,
          draft_id: accepted.draftId,
          batch_id: input.batchId,
          recorded_by: ctx.userId,
          recorded_at: now,
        });
        try {
          assertStableOfficialCommunicationIdentity(registeredByCode.get(accepted.officialCommunicationCode), official);
        } catch (error) {
          (error as Error & { status?: number }).status = 409;
          throw error;
        }
        const { error: officialError } = await ctx.serviceClient.from('ses_official_communications').upsert(
          official,
          { onConflict: 'organization_id,official_communication_code' },
        );
        if (officialError) throw officialError;
      }
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
    await assertSesHardeningSchema(ctx.serviceClient);
    const input = ExportXmlSchema.parse(req.body);
    try {
      assertUniqueSesExportSelection(input.ids);
    } catch (error) {
      (error as Error & { status?: number }).status = 422;
      throw error;
    }
    for (const id of input.ids) await validateAndPersistDraft(ctx, id);
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
    const alreadyGenerated = drafts.filter((draft) => isSesDraftLocked(draft.status));
    if (alreadyGenerated.length) {
      const conflict = new Error('La selección contiene contratos que ya forman parte del historial XML') as Error & { status?: number };
      conflict.status = 409;
      throw conflict;
    }
    const references = drafts.map((draft) => draft.reference);
    try {
      assertUniqueSesExportSelection(input.ids, references);
    } catch (error) {
      (error as Error & { status?: number }).status = 422;
      throw error;
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
    const xmlHash = sha256Utf8(xml);
    const validationMode = 'official_contract' as const;
    const validationVersion = SES_OFFICIAL_CONTRACT_VERSION;
    const structuralValidation = validateSesXmlAgainstOfficialContract(xml);
    const validationHash = sha256Utf8(`SES:${structuralValidation.contractVersion}:${structuralValidation.namespace}`);
    if (!structuralValidation.valid) {
      return res.status(422).json({
        data: { validationMode, structuralErrors: structuralValidation.errors },
        error: 'El XML no cumple la plantilla y las Instrucciones oficiales vigentes',
      });
    }
    const { data: duplicateBatch, error: duplicateBatchError } = await ctx.serviceClient.from('ses_batches')
      .select('id,status,file_name').eq('organization_id', ctx.organizationId).eq('xml_hash', xmlHash)
      .order('generated_at', { ascending: false }).limit(1).maybeSingle();
    if (duplicateBatchError) throw duplicateBatchError;
    if (duplicateBatch) {
      const duplicateXml = new Error(`Ya existe un lote idéntico (${duplicateBatch.file_name || duplicateBatch.id})`) as Error & { status?: number };
      duplicateXml.status = 409;
      throw duplicateXml;
    }
    const documentVersions = Array.from(new Set(drafts.map((draft) => draft.document_version || '1.2.0')));
    if (documentVersions.length !== 1) {
      const mixedVersions = new Error('Todos los contratos del lote deben usar la misma versión documental') as Error & { status?: number };
      mixedVersions.status = 409;
      throw mixedVersions;
    }
    const stamp = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).format(new Date()).replace(/[-: ]/g, '');
    const fileName = `SES_ALQUILERES_${stamp}.xml`;
    const now = new Date().toISOString();

    const { data: batch, error: batchError } = await ctx.serviceClient.from('ses_batches').insert({
      organization_id: ctx.organizationId,
      status: 'downloaded',
      schema_version: 'official-contract',
      document_version: documentVersions[0],
      xsd_version: null,
      xsd_hash: null,
      xsd_validated_at: null,
      file_name: fileName,
      xml_hash: xmlHash,
      item_count: drafts.length,
      generated_by: ctx.userId,
      generated_at: now,
      downloaded_at: now,
    }).select('id').single();
    if (batchError) throw batchError;
    batchId = batch.id;

    const { data: batchItems, error: itemsError } = await ctx.serviceClient.from('ses_batch_items').insert(
      drafts.map((draft, index) => ({
        batch_id: batch.id,
        draft_id: draft.id,
        item_order: index + 1,
        draft_version: draft.draft_version,
        payload_snapshot: payloads[index],
        snapshot_version: 1,
        snapshot_hash: calculateSesPayloadSnapshotHash(payloads[index]),
      })),
    ).select('id,draft_id');
    if (itemsError) throw itemsError;

    const draftMap = new Map(drafts.map((draft) => [draft.id, draft]));
    const historicalSnapshots = (batchItems ?? []).flatMap((item) => {
      const draft = draftMap.get(item.draft_id);
      return draft ? buildSesHistoricalSnapshots({
        organizationId: ctx.organizationId,
        batchItemId: item.id,
        draft,
      }) : [];
    });
    if (historicalSnapshots.length) {
      const { error: snapshotsError } = await ctx.serviceClient.from('ses_historical_snapshots').insert(historicalSnapshots);
      if (snapshotsError) throw snapshotsError;
    }

    const { error: lockError } = await ctx.serviceClient.from('ses_contract_drafts').update({
      status: 'batched',
      updated_by: ctx.userId,
    }).eq('organization_id', ctx.organizationId).in('id', input.ids);
    if (lockError) throw lockError;

    await audit(ctx, 'batch', batch.id, 'xml_generated_and_downloaded', [
      'file_name', 'xml_hash', 'item_count', 'document_version', 'schema_version',
    ], { validation_mode: validationMode, validation_version: validationVersion, validation_hash: validationHash });
    return res.json({
      data: {
        batchId: batch.id, fileName, xml, xmlHash, itemCount: drafts.length,
        documentVersion: documentVersions[0], validationMode, validationVersion, validationHash,
        xsdVersion: null,
        xsdHash: null,
      },
      error: null,
    });
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
