import type { SesContractDraft, SesValidationIssue } from '@/types/sesHospedajes';

export type SesIssueSection = 'contract' | 'person' | 'locations';

export interface SesActionableIssue extends SesValidationIssue {
  canonicalPath: string;
  label: string;
  section: SesIssueSection;
  sourcePaths: string[];
}

const FIELD_LABELS: Record<string, string> = {
  reference: 'Referencia del contrato',
  contract_date: 'Fecha del contrato',
  pickup_at: 'Fecha y hora de recogida',
  return_at: 'Fecha y hora de devolución',
  payment_type: 'Tipo de pago',
  vehicle_category: 'Categoría de empresa',
  vehicle_type: 'Tipo de vehículo',
  vehicle_brand: 'Marca',
  vehicle_model: 'Modelo',
  vehicle_plate: 'Matrícula',
  vehicle_vin: 'Número de bastidor',
  vehicle_color: 'Color',
  km_pickup: 'Km en recogida',
  document_type: 'Tipo de documento',
  document_number: 'Número de documento',
  first_name: 'Nombre',
  first_surname: 'Primer apellido',
  second_surname: 'Segundo apellido',
  birth_date: 'Fecha de nacimiento',
  nationality_code: 'Nacionalidad',
  sex: 'Sexo',
  address_line: 'Domicilio o dirección',
  municipality_code: 'Código INE del municipio',
  municipality_name: 'Municipio',
  postal_code: 'Código postal',
  country_code: 'País',
  contact: 'Teléfono o correo electrónico',
  licence_type: 'Tipo de permiso',
  licence_valid_until: 'Validez del permiso',
  licence_number: 'Número del permiso',
  establishment_code: 'Código de establecimiento',
};

function issueSection(path: string): SesIssueSection {
  if (path.startsWith('holder') || path.startsWith('primary_driver') || path.startsWith('secondary_driver')) return 'person';
  if (path.startsWith('pickup_location') || path.startsWith('return_location')) return 'locations';
  return 'contract';
}

function roleLabel(path: string, holderIsDriver: boolean): string {
  if (path.startsWith('holder')) return holderIsDriver ? 'Titular y conductor principal' : 'Titular';
  if (path.startsWith('primary_driver')) return holderIsDriver ? 'Titular y conductor principal' : 'Conductor principal';
  if (path.startsWith('secondary_driver')) return 'Conductor secundario';
  if (path.startsWith('pickup_location')) return 'Lugar de recogida';
  if (path.startsWith('return_location')) return 'Lugar de devolución';
  return 'Contrato';
}

function canonicalPath(path: string, holderIsDriver: boolean): string {
  if (!holderIsDriver) return path;
  if (path.startsWith('holder.')) return `holder_driver.${path.slice('holder.'.length)}`;
  if (path.startsWith('primary_driver.')) return `holder_driver.${path.slice('primary_driver.'.length)}`;
  if (path === 'holder' || path === 'primary_driver') return 'holder_driver';
  return path;
}

function issueLabel(path: string, holderIsDriver: boolean): string {
  const field = path.split('.').at(-1) ?? path;
  return `${roleLabel(path, holderIsDriver)} · ${FIELD_LABELS[field] ?? field}`;
}

export function getSesFieldLabel(path: string, holderIsDriver = false) {
  return issueLabel(path, holderIsDriver);
}

export function getActionableSesIssues(draft: SesContractDraft): SesActionableIssue[] {
  const holderIsDriver = Boolean(draft.holder?.id && draft.holder.id === draft.primary_driver?.id);
  const deduplicated = new Map<string, SesActionableIssue>();

  for (const issue of draft.validation_errors) {
    const canonical = canonicalPath(issue.path, holderIsDriver);
    const key = `${canonical}|${issue.code}|${issue.message}`;
    const existing = deduplicated.get(key);
    if (existing) {
      existing.sourcePaths.push(issue.path);
      continue;
    }
    deduplicated.set(key, {
      ...issue,
      canonicalPath: canonical,
      label: issueLabel(issue.path, holderIsDriver),
      section: issueSection(issue.path),
      sourcePaths: [issue.path],
    });
  }

  return Array.from(deduplicated.values());
}

export function countActionableSesIssues(draft: SesContractDraft): number {
  return getActionableSesIssues(draft).length;
}
