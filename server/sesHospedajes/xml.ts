import type { SesDraftValidationInput, SesLocationSnapshot, SesPersonSnapshot } from './validation';
import { XMLValidator } from 'fast-xml-parser';

export interface SesXmlPerson extends SesPersonSnapshot {
  second_surname?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  municipality_name?: string | null;
  phone_secondary?: string | null;
  licence_support?: string | null;
}

export interface SesXmlLocation extends SesLocationSnapshot {
  address_complement?: string | null;
  municipality_name?: string | null;
}

export interface SesXmlDraft extends SesDraftValidationInput {
  id: string;
  payment_date?: string | null;
  payment_medium?: string | null;
  payment_holder?: string | null;
  card_expiry?: string | null;
  vehicle_category?: string | null;
  vehicle_color?: string | null;
  km_pickup?: number | null;
  km_return?: number | null;
  gps_data?: string | null;
  holder: SesXmlPerson;
  primary_driver: SesXmlPerson;
  secondary_driver?: SesXmlPerson | null;
  pickup_location: SesXmlLocation;
  return_location: SesXmlLocation;
}

const XML_NAMESPACE = 'http://www.neg.hospedajes.mir.es/altaAlquilerVehiculo';

export function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function tag(name: string, value: unknown, required = false): string {
  if (value === null || value === undefined || value === '') {
    if (required) throw new Error(`Falta el campo obligatorio ${name}`);
    return '';
  }
  return `<${name}>${escapeXml(value)}</${name}>`;
}

function dateOnly(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function madridDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Fecha y hora inválida: ${value}`);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).reduce<Record<string, string>>((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});
  const utcEquivalent = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  const offsetMinutes = Math.round((utcEquivalent - date.getTime()) / 60_000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  const offset = `${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}

function addressXml(location: SesXmlLocation, rootTag = 'direccion'): string {
  const country = (location.country_code || '').toUpperCase();
  return [
    `<${rootTag}>`,
    tag('direccion', location.address_line, true),
    tag('direccionComplementaria', location.address_complement),
    country === 'ESP'
      ? tag('codigoMunicipio', location.municipality_code, true)
      : tag('nombreMunicipio', location.municipality_name, true),
    tag('codigoPostal', location.postal_code, true),
    tag('pais', country, true),
    `</${rootTag}>`,
  ].join('');
}

function operationLocationXml(
  addressTag: 'direccionRecogida' | 'direccionDevolucion',
  establishmentTag: 'codigoEstablecimientoRecogida' | 'codigoEstablecimientoDevolucion',
  location: SesXmlLocation,
): string {
  if (location.use_establishment_code && location.establishment_code) {
    return tag(establishmentTag, location.establishment_code, true);
  }
  return addressXml(location, addressTag);
}

function personXml(role: 'TI' | 'CP' | 'CS', person: SesXmlPerson): string {
  const country = (person.country_code || '').toUpperCase();
  const streetAddress = [person.address_line, person.address_number].filter(Boolean).join(', ');
  const data = [
    '<datosPersona>',
    tag('rol', role, true),
    tag('nombre', person.first_name, true),
    tag('apellido1', person.first_surname, true),
    tag('apellido2', person.second_surname),
    tag('tipoDocumento', person.document_type, true),
    tag('numeroDocumento', person.document_number, true),
    tag('fechaNacimiento', dateOnly(person.birth_date)),
    tag('nacionalidad', person.nationality_code),
    tag('sexo', person.sex),
    '<direccion>',
    tag('direccion', streetAddress, true),
    tag('direccionComplementaria', person.address_complement),
    country === 'ESP'
      ? tag('codigoMunicipio', person.municipality_code, true)
      : tag('nombreMunicipio', person.municipality_name, true),
    tag('codigoPostal', person.postal_code, true),
    tag('pais', country, true),
    '</direccion>',
    tag('telefono', person.phone),
    tag('telefono2', person.phone_secondary),
    tag('correo', person.email),
    '</datosPersona>',
  ];
  if (role !== 'TI') {
    data.push(
      '<permisoConducir>',
      tag('tipo', person.licence_type, true),
      tag('validez', dateOnly(person.licence_valid_until), true),
      tag('numero', person.licence_number, true),
      tag('soporte', person.licence_support),
      '</permisoConducir>',
    );
  }
  return `<persona>${data.join('')}</persona>`;
}

export function communicationXml(draft: SesXmlDraft): string {
  const contract = [
    '<contrato>',
    tag('referencia', draft.reference, true),
    tag('fechaContrato', dateOnly(draft.contract_date), true),
    tag('fechaRecogida', madridDateTime(draft.pickup_at), true),
    operationLocationXml('direccionRecogida', 'codigoEstablecimientoRecogida', draft.pickup_location),
    operationLocationXml('direccionDevolucion', 'codigoEstablecimientoDevolucion', draft.return_location),
    tag('fechaDevolucion', madridDateTime(draft.return_at), true),
    '<pago>',
    tag('tipoPago', draft.payment_type, true),
    tag('fechaPago', dateOnly(draft.payment_date)),
    tag('medioPago', draft.payment_medium),
    tag('titular', draft.payment_holder),
    tag('caducidadTarjeta', draft.card_expiry),
    '</pago>',
    '</contrato>',
  ].join('');
  const vehicle = [
    '<vehiculo>',
    tag('categoria', draft.vehicle_category),
    tag('tipo', draft.vehicle_type, true),
    tag('marca', draft.vehicle_brand, true),
    tag('modelo', draft.vehicle_model, true),
    tag('matricula', draft.vehicle_plate, true),
    tag('numeroBastidor', draft.vehicle_vin, true),
    tag('color', draft.vehicle_color),
    tag('kmRecogida', draft.km_pickup),
    tag('kmDevolucion', draft.km_return),
    tag('datosGps', draft.gps_data),
    '</vehiculo>',
  ].join('');
  const people = [
    personXml('TI', draft.holder),
    personXml('CP', draft.primary_driver),
    draft.secondary_driver ? personXml('CS', draft.secondary_driver) : '',
  ].join('');
  return `<solicitud><comunicacion>${contract}${vehicle}${people}</comunicacion></solicitud>`;
}

export function generateSesXml(drafts: SesXmlDraft[]): string {
  if (drafts.length === 0) throw new Error('El lote no contiene contratos');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<ns2:peticion xmlns:ns2="${XML_NAMESPACE}">${drafts.map(communicationXml).join('')}</ns2:peticion>`;
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    const message = typeof validation === 'object' && validation.err?.msg ? validation.err.msg : 'XML no válido';
    throw new Error(`No se pudo construir un XML bien formado: ${message}`);
  }
  return xml;
}
