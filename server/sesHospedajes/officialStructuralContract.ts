import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { SES_VEHICLE_BRANDS, SES_VEHICLE_COLORS } from './codes';

export const SES_OFFICIAL_CONTRACT_VERSION = '1.2.0';
export const SES_OFFICIAL_XML_NAMESPACE = 'http://www.neg.hospedajes.mir.es/altaAlquilerVehiculo';

const DOCUMENT_TYPES = new Set(['NIF', 'NIE', 'PAS', 'OTRO']);
const PAYMENT_TYPES = new Set(['DESTI', 'EFECT', 'TARJT', 'PLATF', 'TRANS', 'MOVIL', 'TREG', 'OTRO']);
const VEHICLE_TYPES = new Set(['FURGONETA', 'CAMION', 'AUTOBUS', 'TURISMO', 'MOTO', 'TRACTOR', 'REMOLQUE', 'CAMPER', 'CARAVANA', 'OTRO']);
const LICENCE_TYPES = new Set(['AM', 'AML', 'A1', 'A2', 'A', 'B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE', 'LCM', 'LVA', 'ADR', 'PI', 'OT']);
const SEX_CODES = new Set(['H', 'M', 'O']);

export type SesStructuralValidationResult = {
  valid: boolean;
  mode: 'official_contract';
  contractVersion: string;
  namespace: string;
  communicationCount: number;
  errors: string[];
};

function arrayOf<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function requireString(errors: string[], path: string, value: unknown, maxLength: number) {
  const normalized = text(value);
  if (!normalized) errors.push(`${path}: obligatorio`);
  else if (normalized.length > maxLength) errors.push(`${path}: supera ${maxLength} caracteres`);
  return normalized;
}

function optionalString(errors: string[], path: string, value: unknown, maxLength: number) {
  const normalized = text(value);
  if (normalized.length > maxLength) errors.push(`${path}: supera ${maxLength} caracteres`);
  return normalized;
}

function requireEnum(errors: string[], path: string, value: unknown, allowed: Set<string>, maxLength: number) {
  const normalized = requireString(errors, path, value, maxLength).toUpperCase();
  if (normalized && !allowed.has(normalized)) errors.push(`${path}: valor no admitido`);
  return normalized;
}

function requireDate(errors: string[], path: string, value: unknown, dateTime: boolean) {
  const normalized = text(value);
  const pattern = dateTime
    ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/
    : /^\d{4}-\d{2}-\d{2}(?:Z|[+-]\d{2}:\d{2})?$/;
  if (!normalized) errors.push(`${path}: obligatorio`);
  else if (!pattern.test(normalized) || Number.isNaN(new Date(normalized.slice(0, 10)).getTime())) {
    errors.push(`${path}: formato de fecha no válido`);
  }
  return normalized;
}

function validateAddress(errors: string[], path: string, address: Record<string, unknown> | undefined) {
  if (!address || typeof address !== 'object') {
    errors.push(`${path}: bloque obligatorio`);
    return;
  }
  requireString(errors, `${path}.direccion`, address.direccion, 100);
  optionalString(errors, `${path}.direccionComplementaria`, address.direccionComplementaria, 100);
  const country = requireString(errors, `${path}.pais`, address.pais, 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(country)) errors.push(`${path}.pais: debe ser ISO-3`);
  const postal = requireString(errors, `${path}.codigoPostal`, address.codigoPostal, 11);
  if (country === 'ESP') {
    if (!/^\d{5}$/.test(text(address.codigoMunicipio))) errors.push(`${path}.codigoMunicipio: debe tener 5 dígitos para ESP`);
    if (!/^\d{5}$/.test(postal)) errors.push(`${path}.codigoPostal: debe tener 5 dígitos para ESP`);
    if (text(address.nombreMunicipio)) errors.push(`${path}.nombreMunicipio: no debe enviarse junto con codigoMunicipio para ESP`);
  } else {
    requireString(errors, `${path}.nombreMunicipio`, address.nombreMunicipio, 100);
    if (text(address.codigoMunicipio)) errors.push(`${path}.codigoMunicipio: no debe enviarse para países distintos de ESP`);
  }
}

function validateOperationLocation(
  errors: string[],
  path: string,
  contract: Record<string, any>,
  addressKey: 'direccionRecogida' | 'direccionDevolucion',
  establishmentKey: 'codigoEstablecimientoRecogida' | 'codigoEstablecimientoDevolucion',
) {
  const address = contract[addressKey];
  const establishment = text(contract[establishmentKey]);
  if (Boolean(address) === Boolean(establishment)) {
    errors.push(`${path}: debe informarse exactamente dirección o código de establecimiento`);
    return;
  }
  if (establishment && !/^[A-Z0-9]{10}$/.test(establishment)) errors.push(`${path}.${establishmentKey}: debe tener 10 caracteres`);
  if (address) validateAddress(errors, `${path}.${addressKey}`, address);
}

function validatePerson(errors: string[], path: string, person: Record<string, any>) {
  const data = person?.datosPersona;
  if (!data || typeof data !== 'object') {
    errors.push(`${path}.datosPersona: bloque obligatorio`);
    return '';
  }
  const role = requireString(errors, `${path}.rol`, data.rol, 2).toUpperCase();
  if (!['TI', 'CP', 'CS'].includes(role)) errors.push(`${path}.rol: valor no admitido`);
  requireString(errors, `${path}.nombre`, data.nombre, 50);
  requireString(errors, `${path}.apellido1`, data.apellido1, 50);
  const documentType = requireEnum(errors, `${path}.tipoDocumento`, data.tipoDocumento, DOCUMENT_TYPES, 5);
  optionalString(errors, `${path}.apellido2`, data.apellido2, 50);
  if (documentType === 'NIF' && !text(data.apellido2)) errors.push(`${path}.apellido2: obligatorio para NIF`);
  requireString(errors, `${path}.numeroDocumento`, data.numeroDocumento, 15);
  if (text(data.fechaNacimiento)) requireDate(errors, `${path}.fechaNacimiento`, data.fechaNacimiento, false);
  if (text(data.nacionalidad) && !/^[A-Z]{3}$/.test(text(data.nacionalidad))) errors.push(`${path}.nacionalidad: debe ser ISO-3`);
  if (text(data.sexo) && !SEX_CODES.has(text(data.sexo))) errors.push(`${path}.sexo: valor no admitido`);
  validateAddress(errors, `${path}.direccion`, data.direccion);
  optionalString(errors, `${path}.telefono`, data.telefono, 20);
  optionalString(errors, `${path}.telefono2`, data.telefono2, 20);
  optionalString(errors, `${path}.correo`, data.correo, 250);
  if (![data.telefono, data.telefono2, data.correo].some((value) => text(value))) errors.push(`${path}.contacto: debe informarse teléfono, teléfono2 o correo`);

  const licence = person.permisoConducir;
  if (role === 'CP' || role === 'CS') {
    if (!licence || typeof licence !== 'object') errors.push(`${path}.permisoConducir: bloque obligatorio para ${role}`);
    else {
      requireEnum(errors, `${path}.permisoConducir.tipo`, licence.tipo, LICENCE_TYPES, 5);
      requireDate(errors, `${path}.permisoConducir.validez`, licence.validez, false);
      requireString(errors, `${path}.permisoConducir.numero`, licence.numero, 25);
      optionalString(errors, `${path}.permisoConducir.soporte`, licence.soporte, 25);
    }
  } else if (licence) {
    errors.push(`${path}.permisoConducir: no debe enviarse para TI`);
  }
  return role;
}

export function validateSesXmlAgainstOfficialContract(xml: string): SesStructuralValidationResult {
  const errors: string[] = [];
  const wellFormed = XMLValidator.validate(xml);
  if (wellFormed !== true) {
    const message = typeof wellFormed === 'object' && wellFormed.err?.msg ? wellFormed.err.msg : 'XML no bien formado';
    return { valid: false, mode: 'official_contract', contractVersion: SES_OFFICIAL_CONTRACT_VERSION, namespace: SES_OFFICIAL_XML_NAMESPACE, communicationCount: 0, errors: [message] };
  }

  const parsed = new XMLParser({ ignoreAttributes: false, removeNSPrefix: false, parseTagValue: false, trimValues: true }).parse(xml);
  const root = parsed['ns2:peticion'];
  if (!root || typeof root !== 'object') errors.push('peticion: falta el elemento raíz ns2:peticion');
  if (text(root?.['@_xmlns:ns2']) !== SES_OFFICIAL_XML_NAMESPACE) errors.push('peticion: namespace oficial no válido');
  const solicitudes = arrayOf(root?.solicitud);
  if (solicitudes.length !== 1) errors.push('peticion.solicitud: debe existir exactamente un bloque solicitud');
  const communications = solicitudes.flatMap((request: any) => arrayOf(request?.comunicacion));
  if (communications.length < 1) errors.push('solicitud.comunicacion: debe existir al menos una comunicación');

  communications.forEach((communication: any, index) => {
    const base = `comunicacion[${index}]`;
    const contracts = arrayOf(communication?.contrato);
    const vehicles = arrayOf(communication?.vehiculo);
    const people = arrayOf<Record<string, any>>(communication?.persona);
    if (contracts.length !== 1) errors.push(`${base}.contrato: debe existir exactamente uno`);
    if (vehicles.length !== 1) errors.push(`${base}.vehiculo: debe existir exactamente uno`);
    if (people.length < 2 || people.length > 3) errors.push(`${base}.persona: debe contener entre 2 y 3 personas`);

    const contract = contracts[0] as Record<string, any> | undefined;
    if (contract) {
      requireString(errors, `${base}.contrato.referencia`, contract.referencia, 50);
      requireDate(errors, `${base}.contrato.fechaContrato`, contract.fechaContrato, false);
      const pickup = requireDate(errors, `${base}.contrato.fechaRecogida`, contract.fechaRecogida, true);
      const returned = requireDate(errors, `${base}.contrato.fechaDevolucion`, contract.fechaDevolucion, true);
      if (pickup && returned && new Date(returned).getTime() <= new Date(pickup).getTime()) errors.push(`${base}.contrato.fechaDevolucion: debe ser posterior a fechaRecogida`);
      validateOperationLocation(errors, `${base}.contrato.recogida`, contract, 'direccionRecogida', 'codigoEstablecimientoRecogida');
      validateOperationLocation(errors, `${base}.contrato.devolucion`, contract, 'direccionDevolucion', 'codigoEstablecimientoDevolucion');
      if (!contract.pago || typeof contract.pago !== 'object') errors.push(`${base}.contrato.pago: bloque obligatorio`);
      else {
        requireEnum(errors, `${base}.contrato.pago.tipoPago`, contract.pago.tipoPago, PAYMENT_TYPES, 5);
        if (text(contract.pago.fechaPago)) requireDate(errors, `${base}.contrato.pago.fechaPago`, contract.pago.fechaPago, false);
        optionalString(errors, `${base}.contrato.pago.medioPago`, contract.pago.medioPago, 50);
        optionalString(errors, `${base}.contrato.pago.titular`, contract.pago.titular, 100);
        if (text(contract.pago.caducidadTarjeta) && !/^(0[1-9]|1[0-2])\/\d{4}$/.test(text(contract.pago.caducidadTarjeta))) errors.push(`${base}.contrato.pago.caducidadTarjeta: debe usar MM/AAAA`);
      }
    }

    const vehicle = vehicles[0] as Record<string, any> | undefined;
    if (vehicle) {
      requireString(errors, `${base}.vehiculo.categoria`, vehicle.categoria, 50);
      requireEnum(errors, `${base}.vehiculo.tipo`, vehicle.tipo, VEHICLE_TYPES, 10);
      requireEnum(errors, `${base}.vehiculo.marca`, vehicle.marca, SES_VEHICLE_BRANDS, 10);
      requireString(errors, `${base}.vehiculo.modelo`, vehicle.modelo, 50);
      requireString(errors, `${base}.vehiculo.matricula`, vehicle.matricula, 25);
      const vin = requireString(errors, `${base}.vehiculo.numeroBastidor`, vehicle.numeroBastidor, 17);
      if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) errors.push(`${base}.vehiculo.numeroBastidor: formato no válido`);
      if (text(vehicle.color)) requireEnum(errors, `${base}.vehiculo.color`, vehicle.color, SES_VEHICLE_COLORS, 10);
      const pickupKm = Number(text(vehicle.kmRecogida));
      if (!text(vehicle.kmRecogida) || !Number.isFinite(pickupKm) || pickupKm < 0) errors.push(`${base}.vehiculo.kmRecogida: número no negativo obligatorio`);
      if (text(vehicle.kmDevolucion)) {
        const returnKm = Number(text(vehicle.kmDevolucion));
        if (!Number.isFinite(returnKm) || returnKm < pickupKm) errors.push(`${base}.vehiculo.kmDevolucion: no puede ser inferior a kmRecogida`);
      }
    }

    const roles = people.map((person, personIndex) => validatePerson(errors, `${base}.persona[${personIndex}]`, person));
    if (roles.filter((role) => role === 'TI').length !== 1) errors.push(`${base}.persona: debe contener exactamente un TI`);
    if (roles.filter((role) => role === 'CP').length !== 1) errors.push(`${base}.persona: debe contener exactamente un CP`);
    if (roles.filter((role) => role === 'CS').length > 1) errors.push(`${base}.persona: solo puede contener un CS`);
  });

  return {
    valid: errors.length === 0,
    mode: 'official_contract',
    contractVersion: SES_OFFICIAL_CONTRACT_VERSION,
    namespace: SES_OFFICIAL_XML_NAMESPACE,
    communicationCount: communications.length,
    errors,
  };
}
