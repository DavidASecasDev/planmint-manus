import { SES_VEHICLE_BRANDS, SES_VEHICLE_COLORS } from './codes';

export interface SesValidationIssue {
  path: string;
  code: 'required' | 'invalid' | 'inconsistent';
  message: string;
}

export interface SesPersonSnapshot {
  document_type?: string | null;
  document_number?: string | null;
  first_name?: string | null;
  first_surname?: string | null;
  second_surname?: string | null;
  birth_date?: string | null;
  nationality_code?: string | null;
  sex?: string | null;
  address_line?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  municipality_code?: string | null;
  municipality_name?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  phone?: string | null;
  phone_secondary?: string | null;
  email?: string | null;
  licence_type?: string | null;
  licence_valid_until?: string | null;
  licence_number?: string | null;
  licence_support?: string | null;
  licence_country_code?: string | null;
}

export interface SesLocationSnapshot {
  use_establishment_code?: boolean | null;
  establishment_code?: string | null;
  address_line?: string | null;
  address_complement?: string | null;
  municipality_code?: string | null;
  municipality_name?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  verified?: boolean | null;
}

export interface SesDraftValidationInput {
  reference?: string | null;
  contract_date?: string | null;
  pickup_at?: string | null;
  return_at?: string | null;
  payment_type?: string | null;
  vehicle_category?: string | null;
  vehicle_type?: string | null;
  vehicle_brand?: string | null;
  vehicle_model?: string | null;
  vehicle_plate?: string | null;
  vehicle_vin?: string | null;
  vehicle_color?: string | null;
  km_pickup?: number | null;
  holder?: SesPersonSnapshot | null;
  primary_driver?: SesPersonSnapshot | null;
  secondary_driver?: SesPersonSnapshot | null;
  pickup_location?: SesLocationSnapshot | null;
  return_location?: SesLocationSnapshot | null;
}

const DOCUMENT_TYPES = new Set(['NIF', 'NIE', 'PAS', 'OTRO']);
const PAYMENT_TYPES = new Set(['DESTI', 'EFECT', 'TARJT', 'PLATF', 'TRANS', 'MOVIL', 'TREG', 'OTRO']);
const VEHICLE_TYPES = new Set(['FURGONETA', 'CAMION', 'AUTOBUS', 'TURISMO', 'MOTO', 'TRACTOR', 'REMOLQUE', 'CAMPER', 'CARAVANA', 'OTRO']);
const LICENCE_TYPES = new Set(['AM','AML','A1','A2','A','B','BE','C1','C1E','C','CE','D1','D1E','D','DE','LCM','LVA','ADR','PI','OT']);
const SEX_CODES = new Set(['H', 'M', 'O']);

function required(issues: SesValidationIssue[], path: string, value: unknown, message: string) {
  if (value === null || value === undefined || value === '') {
    issues.push({ path, code: 'required', message });
  }
}

function allowed(issues: SesValidationIssue[], path: string, value: unknown, values: Set<string>, message: string) {
  if (typeof value === 'string' && value && !values.has(value)) {
    issues.push({ path, code: 'invalid', message });
  }
}

function isoCountry(issues: SesValidationIssue[], path: string, value?: string | null) {
  if (value && !/^[A-Z]{3}$/.test(value)) {
    issues.push({ path, code: 'invalid', message: 'El país debe usar un código ISO alfa-3' });
  }
}

function validDate(issues: SesValidationIssue[], path: string, value?: string | null) {
  if (value && Number.isNaN(new Date(value).getTime())) {
    issues.push({ path, code: 'invalid', message: 'Fecha no válida' });
  }
}

function validatePerson(
  issues: SesValidationIssue[],
  prefix: string,
  person: SesPersonSnapshot | null | undefined,
  driver: boolean,
) {
  if (!person) {
    issues.push({ path: prefix, code: 'required', message: 'Falta la persona asociada' });
    return;
  }
  required(issues, `${prefix}.document_type`, person.document_type, 'Falta el tipo de documento');
  allowed(issues, `${prefix}.document_type`, person.document_type, DOCUMENT_TYPES, 'Tipo de documento no admitido');
  required(issues, `${prefix}.document_number`, person.document_number, 'Falta el número de documento');
  required(issues, `${prefix}.first_name`, person.first_name, 'Falta el nombre');
  required(issues, `${prefix}.first_surname`, person.first_surname, 'Falta el primer apellido');
  if (person.document_type === 'NIF') {
    required(issues, `${prefix}.second_surname`, person.second_surname, 'El segundo apellido es obligatorio para NIF');
  }
  validDate(issues, `${prefix}.birth_date`, person.birth_date);
  isoCountry(issues, `${prefix}.nationality_code`, person.nationality_code);
  allowed(issues, `${prefix}.sex`, person.sex, SEX_CODES, 'Código de sexo no admitido');
  required(issues, `${prefix}.address_line`, person.address_line, 'Falta el domicilio');
  if ((person.country_code || '').toUpperCase() === 'ESP') {
    required(issues, `${prefix}.municipality_code`, person.municipality_code, 'Falta el código INE del municipio');
    if (person.municipality_code && !/^\d{5}$/.test(person.municipality_code)) {
      issues.push({ path: `${prefix}.municipality_code`, code: 'invalid', message: 'El código INE debe tener 5 dígitos' });
    }
  } else {
    required(issues, `${prefix}.municipality_name`, person.municipality_name, 'Falta el nombre del municipio');
  }
  required(issues, `${prefix}.postal_code`, person.postal_code, 'Falta el código postal');
  required(issues, `${prefix}.country_code`, person.country_code, 'Falta el país de residencia');
  isoCountry(issues, `${prefix}.country_code`, person.country_code);
  if (!person.phone && !person.phone_secondary && !person.email) {
    issues.push({ path: `${prefix}.contact`, code: 'required', message: 'Falta teléfono o correo electrónico' });
  }
  if (driver) {
    required(issues, `${prefix}.licence_type`, person.licence_type, 'Falta el tipo de permiso de conducir');
    allowed(issues, `${prefix}.licence_type`, person.licence_type, LICENCE_TYPES, 'Tipo de permiso no admitido');
    required(issues, `${prefix}.licence_valid_until`, person.licence_valid_until, 'Falta la validez del permiso');
    validDate(issues, `${prefix}.licence_valid_until`, person.licence_valid_until);
    required(issues, `${prefix}.licence_number`, person.licence_number, 'Falta el número del permiso');
  }
}

function validateLocation(
  issues: SesValidationIssue[],
  prefix: string,
  location: SesLocationSnapshot | null | undefined,
) {
  if (!location) {
    issues.push({ path: prefix, code: 'required', message: 'Falta el lugar de la operación' });
    return;
  }
  if (location.use_establishment_code) {
    required(issues, `${prefix}.establishment_code`, location.establishment_code, 'Falta el código de establecimiento');
    if (location.establishment_code && !/^[A-Z0-9]{10}$/.test(location.establishment_code)) {
      issues.push({ path: `${prefix}.establishment_code`, code: 'invalid', message: 'El código de establecimiento debe tener 10 caracteres' });
    }
    return;
  }
  required(issues, `${prefix}.address_line`, location.address_line, 'Falta la dirección del lugar');
  if ((location.country_code || '').toUpperCase() === 'ESP') {
    required(issues, `${prefix}.municipality_code`, location.municipality_code, 'Falta el código INE del municipio');
    if (location.municipality_code && !/^\d{5}$/.test(location.municipality_code)) {
      issues.push({ path: `${prefix}.municipality_code`, code: 'invalid', message: 'El código INE debe tener 5 dígitos' });
    }
  } else {
    required(issues, `${prefix}.municipality_name`, location.municipality_name, 'Falta el nombre del municipio');
  }
  required(issues, `${prefix}.postal_code`, location.postal_code, 'Falta el código postal');
  required(issues, `${prefix}.country_code`, location.country_code, 'Falta el país del lugar');
  isoCountry(issues, `${prefix}.country_code`, location.country_code);
}

export function validateSesDraft(input: SesDraftValidationInput): SesValidationIssue[] {
  const issues: SesValidationIssue[] = [];
  required(issues, 'reference', input.reference, 'Falta la referencia del contrato');
  required(issues, 'contract_date', input.contract_date, 'Falta la fecha del contrato');
  validDate(issues, 'contract_date', input.contract_date);
  required(issues, 'pickup_at', input.pickup_at, 'Falta la fecha y hora de recogida');
  validDate(issues, 'pickup_at', input.pickup_at);
  required(issues, 'return_at', input.return_at, 'Falta la fecha y hora de devolución');
  validDate(issues, 'return_at', input.return_at);
  required(issues, 'payment_type', input.payment_type, 'Falta el tipo de pago');
  allowed(issues, 'payment_type', input.payment_type, PAYMENT_TYPES, 'Tipo de pago no admitido');
  required(issues, 'vehicle_category', input.vehicle_category, 'Falta la categoría interna del vehículo');
  required(issues, 'vehicle_type', input.vehicle_type, 'Falta el tipo de vehículo');
  allowed(issues, 'vehicle_type', input.vehicle_type, VEHICLE_TYPES, 'Tipo de vehículo no admitido');
  required(issues, 'vehicle_brand', input.vehicle_brand, 'Falta la marca del vehículo');
  allowed(issues, 'vehicle_brand', input.vehicle_brand, SES_VEHICLE_BRANDS, 'Marca de vehículo no admitida');
  required(issues, 'vehicle_model', input.vehicle_model, 'Falta el modelo del vehículo');
  required(issues, 'vehicle_plate', input.vehicle_plate, 'Falta la matrícula del vehículo');
  required(issues, 'vehicle_vin', input.vehicle_vin, 'Falta el número de bastidor');
  required(issues, 'vehicle_color', input.vehicle_color, 'Falta el color del vehículo');
  allowed(issues, 'vehicle_color', input.vehicle_color, SES_VEHICLE_COLORS, 'Color de vehículo no admitido');
  required(issues, 'km_pickup', input.km_pickup, 'Faltan los kilómetros en la recogida');
  if (input.km_pickup !== null && input.km_pickup !== undefined && (!Number.isFinite(input.km_pickup) || input.km_pickup < 0)) {
    issues.push({ path: 'km_pickup', code: 'invalid', message: 'Los kilómetros de recogida deben ser un número no negativo' });
  }

  validateLocation(issues, 'pickup_location', input.pickup_location);
  validateLocation(issues, 'return_location', input.return_location);
  validatePerson(issues, 'holder', input.holder, false);
  validatePerson(issues, 'primary_driver', input.primary_driver, true);
  if (input.secondary_driver) validatePerson(issues, 'secondary_driver', input.secondary_driver, true);

  if (input.pickup_at && input.return_at && new Date(input.return_at) <= new Date(input.pickup_at)) {
    issues.push({ path: 'return_at', code: 'inconsistent', message: 'La devolución debe ser posterior a la recogida' });
  }
  return issues;
}
