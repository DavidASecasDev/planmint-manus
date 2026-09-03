import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildSesFieldAuditRows, persistSesFieldAudit } from './fieldAudit';

export interface RentlyCustomerForSes {
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
  BirthDate?: string;
  Birthday?: string;
  DriverLicenceNumber?: string;
  DriverLicenceCountry?: unknown;
  DriverLicenseExpiration?: string;
  DriverLicenseCategory?: string;
}

const COUNTRY_ALIASES: Record<string, string> = {
  ES: 'ESP', ESP: 'ESP', SPAIN: 'ESP', ESPANA: 'ESP', ESPAÑA: 'ESP',
  GB: 'GBR', GBR: 'GBR', UK: 'GBR', 'UNITED KINGDOM': 'GBR', 'REINO UNIDO': 'GBR',
  DE: 'DEU', DEU: 'DEU', GERMANY: 'DEU', ALEMANIA: 'DEU',
  FR: 'FRA', FRA: 'FRA', FRANCE: 'FRA', FRANCIA: 'FRA',
  IT: 'ITA', ITA: 'ITA', ITALY: 'ITA', ITALIA: 'ITA',
  PT: 'PRT', PRT: 'PRT', PORTUGAL: 'PRT',
  NL: 'NLD', NLD: 'NLD', NETHERLANDS: 'NLD', 'PAISES BAJOS': 'NLD', 'PAÍSES BAJOS': 'NLD',
  BE: 'BEL', BEL: 'BEL', BELGIUM: 'BEL', BELGICA: 'BEL', BÉLGICA: 'BEL',
  CH: 'CHE', CHE: 'CHE', SWITZERLAND: 'CHE', SUIZA: 'CHE',
  AT: 'AUT', AUT: 'AUT', AUSTRIA: 'AUT',
  IE: 'IRL', IRL: 'IRL', IRELAND: 'IRL', IRLANDA: 'IRL',
  US: 'USA', USA: 'USA', 'UNITED STATES': 'USA', 'ESTADOS UNIDOS': 'USA',
  AR: 'ARG', ARG: 'ARG', ARGENTINA: 'ARG',
  KW: 'KWT', KWT: 'KWT', KUWAIT: 'KWT',
  SA: 'SAU', SAU: 'SAU', 'SAUDI ARABIA': 'SAU', 'ARABIA SAUDITA': 'SAU',
  AE: 'ARE', ARE: 'ARE', 'UNITED ARAB EMIRATES': 'ARE', 'EMIRATOS ARABES UNIDOS': 'ARE',
  CA: 'CAN', CAN: 'CAN', CANADA: 'CAN',
  AU: 'AUS', AUS: 'AUS', AUSTRALIA: 'AUS',
  BR: 'BRA', BRA: 'BRA', BRAZIL: 'BRA', BRASIL: 'BRA',
  PY: 'PRY', PRY: 'PRY', PARAGUAY: 'PRY',
  UA: 'UKR', UKR: 'UKR', UKRAINE: 'UKR', UCRANIA: 'UKR',
  AF: 'AFG', AFG: 'AFG', AFGHANISTAN: 'AFG', AFGANISTAN: 'AFG',
  HR: 'HRV', HRV: 'HRV', CROATIA: 'HRV', CROACIA: 'HRV',
  HK: 'HKG', HKG: 'HKG', 'HONG KONG': 'HKG',
  LU: 'LUX', LUX: 'LUX', LUXEMBOURG: 'LUX', LUXEMBURGO: 'LUX',
  NG: 'NGA', NGA: 'NGA', NIGERIA: 'NGA',
  NO: 'NOR', NOR: 'NOR', NORWAY: 'NOR', NORUEGA: 'NOR',
  RU: 'RUS', RUS: 'RUS', RUSSIA: 'RUS', RUSIA: 'RUS',
  SG: 'SGP', SGP: 'SGP', SINGAPORE: 'SGP', SINGAPUR: 'SGP',
  DK: 'DNK', DNK: 'DNK', DENMARK: 'DNK', DINAMARCA: 'DNK',
  GE: 'GEO', GEO: 'GEO', GEORGIA: 'GEO',
  MA: 'MAR', MAR: 'MAR', MOROCCO: 'MAR', MARRUECOS: 'MAR',
  MX: 'MEX', MEX: 'MEX', MEXICO: 'MEX',
  PL: 'POL', POL: 'POL', POLAND: 'POL', POLONIA: 'POL',
  RO: 'ROU', ROU: 'ROU', ROMANIA: 'ROU', RUMANIA: 'ROU',
  MC: 'MCO', MCO: 'MCO', MONACO: 'MCO',
  'UNITED KINGDOM OF GREAT BRITAIN AND NORTHERN IRELAND': 'GBR',
};

function normalizedKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function extractText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['Code', 'IsoCode', 'ISOCode', 'Alpha3', 'Name', 'Description']) {
      if (typeof record[key] === 'string' && record[key]!.trim()) return record[key]!.trim();
    }
  }
  return null;
}

export function toIsoAlpha3(value: unknown): string | null {
  const text = extractText(value);
  if (!text) return null;
  const key = normalizedKey(text);
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  return /^[A-Z]{3}$/.test(key) ? key : null;
}

export function toDateOnly(value?: string): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function normalizeDocumentNumber(value?: string): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '');
  return normalized || null;
}

export function mapRentlyDocumentType(value?: number | { Id?: number; Name?: string }): 'NIF' | 'NIE' | 'PAS' | 'OTRO' {
  const id = typeof value === 'number' ? value : value?.Id;
  const name = typeof value === 'object' ? normalizedKey(value?.Name || '') : '';
  if (name.includes('NIE')) return 'NIE';
  if (name.includes('PASAPORTE') || name.includes('PASSPORT')) return 'PAS';
  if (name.includes('NIF') || name.includes('DNI')) return 'NIF';
  if (id === 1) return 'NIF';
  if (id === 3) return 'PAS';
  return 'OTRO';
}

export function mapRentlyCustomerToSesProfile(
  customer: RentlyCustomerForSes,
  organizationId: string,
  userId: string,
) {
  const documentNumber = normalizeDocumentNumber(customer.DocumentId);
  const firstName = customer.Name?.trim() || customer.Firstname?.trim() || '';
  const firstSurname = customer.Lastname?.trim() || '';
  if (!documentNumber || !firstName || !firstSurname) return null;

  return {
    organization_id: organizationId,
    rently_customer_id: customer.Id ?? null,
    document_type: mapRentlyDocumentType(customer.DocumentType ?? customer.DocumentTypeId),
    document_number: documentNumber,
    first_name: firstName,
    first_surname: firstSurname,
    birth_date: toDateOnly(customer.Birthday || customer.BirthDate),
    address_line: customer.Address?.trim() || null,
    address_number: customer.AddressNumber?.trim() || null,
    address_complement: customer.AddressDepartment?.trim() || null,
    municipality_name: customer.City?.trim() || null,
    postal_code: customer.ZipCode?.trim() || null,
    nationality_code: toIsoAlpha3(customer.Country),
    phone: customer.CellPhone?.trim() || null,
    email: customer.EmailAddress?.trim() || null,
    licence_type: customer.DriverLicenseCategory?.trim().toUpperCase() || null,
    licence_valid_until: toDateOnly(customer.DriverLicenseExpiration),
    licence_number: normalizeDocumentNumber(customer.DriverLicenceNumber),
    licence_country_code: toIsoAlpha3(customer.DriverLicenceCountry),
    last_rently_sync_at: new Date().toISOString(),
    updated_by: userId,
  };
}

const PROTECTED_PROFILE_FIELDS = [
  'document_type', 'document_number', 'first_name', 'first_surname', 'second_surname',
  'birth_date', 'nationality_code', 'sex', 'address_line', 'address_number',
  'address_complement', 'municipality_code', 'municipality_name', 'postal_code',
  'country_code', 'phone', 'phone_secondary', 'email', 'licence_type',
  'licence_valid_until', 'licence_number', 'licence_support', 'licence_country_code',
] as const;

export function buildNewSesProfileRow<T extends Record<string, unknown>>(incoming: T, userId: string) {
  const now = new Date().toISOString();
  return {
    ...incoming,
    id: randomUUID(),
    created_by: userId,
    created_at: now,
    updated_at: now,
    manual_fields: [] as string[],
  };
}

export async function syncSesPersonProfiles(
  serviceClient: SupabaseClient,
  organizationId: string,
  userId: string,
  customers: RentlyCustomerForSes[],
): Promise<{ synced: number; skipped: number }> {
  const mapped = customers
    .map((customer) => mapRentlyCustomerToSesProfile(customer, organizationId, userId))
    .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile));

  if (mapped.length === 0) return { synced: 0, skipped: customers.length };

  const unique = new Map(mapped.map((profile) => [
    `${profile.document_type}:${profile.document_number}`,
    profile,
  ]));
  const documentNumbers = Array.from(new Set(
    Array.from(unique.values()).map((profile) => profile.document_number),
  ));
  const { data: existing, error: existingError } = await serviceClient
    .from('ses_person_profiles')
    .select('*')
    .eq('organization_id', organizationId)
    .in('document_number', documentNumbers);
  if (existingError) throw existingError;

  const existingMap = new Map((existing ?? []).map((profile) => [
    `${profile.document_type}:${profile.document_number}`,
    profile as Record<string, unknown>,
  ]));

  const rows = Array.from(unique.entries()).map(([key, incoming]) => {
    const current = existingMap.get(key);
    if (!current) return buildNewSesProfileRow(incoming, userId);

    const manualFields = new Set(Array.isArray(current.manual_fields) ? current.manual_fields as string[] : []);
    const merged: Record<string, unknown> = { ...current, ...incoming, manual_fields: Array.from(manualFields) };
    for (const field of PROTECTED_PROFILE_FIELDS) {
      const currentValue = current[field];
      const incomingValue = incoming[field as keyof typeof incoming];
      if (manualFields.has(field) || incomingValue === null || incomingValue === undefined || incomingValue === '') {
        merged[field] = currentValue ?? incomingValue ?? null;
      }
    }
    return merged;
  });

  const { error } = await serviceClient
    .from('ses_person_profiles')
    .upsert(rows, { onConflict: 'organization_id,document_type,document_number' });
  if (error) throw error;

  const auditRows = Array.from(unique.entries()).flatMap(([key, incoming]) => {
    const current = existingMap.get(key) ?? {};
    const saved = rows.find((row) => `${row.document_type}:${row.document_number}` === key) ?? incoming;
    const savedRecord = saved as Record<string, unknown>;
    const changes = Object.fromEntries(
      ['rently_customer_id', ...PROTECTED_PROFILE_FIELDS]
        .filter((field) => Object.prototype.hasOwnProperty.call(incoming, field))
        .map((field) => [field, savedRecord[field]]),
    );
    return buildSesFieldAuditRows({
      organizationId,
      entityType: 'person',
      entityId: String(savedRecord.id),
      source: 'rently',
      actorUserId: userId,
      previous: current,
      changes,
      reason: 'Enriquecimiento automático desde el detalle contractual de Rently',
    });
  });
  await persistSesFieldAudit(serviceClient, auditRows);

  return { synced: rows.length, skipped: customers.length - rows.length };
}
