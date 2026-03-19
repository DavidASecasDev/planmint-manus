// Transfer Pricing System - Based on LimoMallorca 2026 B2B Tariff

export const TRANSFER_ZONES = [
  { key: 'alaro', label: 'Alaró' },
  { key: 'alcudia', label: 'Alcudia' },
  { key: 'algaida', label: 'Algaida' },
  { key: 'andratx', label: 'Andratx' },
  { key: 'cala_dor', label: "Cala d'Or" },
  { key: 'cala_millor', label: 'Cala Millor' },
  { key: 'cala_ratjada', label: 'Cala Ratjada' },
  { key: 'deia', label: 'Deia' },
  { key: 'formentor', label: 'Formentor' },
  { key: 'illetas', label: 'Illetas' },
  { key: 'inca', label: 'Inca' },
  { key: 'llucmajor', label: 'Llucmajor' },
  { key: 'magaluf', label: 'Magaluf' },
  { key: 'manacor', label: 'Manacor' },
  { key: 'marratxi', label: 'Marratxí' },
  { key: 'palma', label: 'Palma' },
  { key: 'palmanova', label: 'Palmanova' },
  { key: 'pollenca', label: 'Pollença' },
  { key: 'portals', label: 'Portals' },
  { key: 'porto_colom', label: 'Porto Colom' },
  { key: 'porto_cristo', label: 'Porto Cristo' },
  { key: 'puigpunyent', label: 'Puigpunyent' },
  { key: 'sa_pobla', label: 'Sa Pobla' },
  { key: 'santa_eugenia', label: 'Santa Eugenia' },
  { key: 'sta_margalida', label: 'Sta. Margalida' },
  { key: 'santa_maria', label: 'Santa Maria' },
  { key: 'santa_ponca', label: 'Santa Ponça' },
  { key: 'soller', label: 'Sóller' },
  { key: 'valldemossa', label: 'Valldemossa' },
] as const;

export type TransferZoneKey = (typeof TRANSFER_ZONES)[number]['key'];

export const VEHICLE_TYPES = [
  { key: 'mb_eqe', label: 'MB EQE (Premium)', capacity: 3 },
  { key: 's_class', label: 'MB S Class (VIP)', capacity: 3 },
  { key: 'v_class', label: 'MB V Class (Minivan)', capacity: 7 },
  { key: 'iv_class', label: 'MB IV Class (XL Van)', capacity: 10 },
  { key: 'sprinter', label: 'MB Sprinter (Minibus)', capacity: 20 },
] as const;

export type VehicleTypeKey = (typeof VEHICLE_TYPES)[number]['key'];

// Price matrix: zone -> vehicle_type -> base price in EUR
// Source: TARIFAS_TRANSFERS_B2B_2026-2.pdf
export const ZONE_PRICES: Record<string, Record<string, number>> = {
  alaro:         { mb_eqe: 132, s_class: 150, v_class: 150, iv_class: 150, sprinter: 352 },
  alcudia:       { mb_eqe: 167, s_class: 196, v_class: 196, iv_class: 196, sprinter: 374 },
  algaida:       { mb_eqe: 97,  s_class: 123, v_class: 123, iv_class: 123, sprinter: 330 },
  andratx:       { mb_eqe: 132, s_class: 161, v_class: 161, iv_class: 161, sprinter: 341 },
  cala_dor:      { mb_eqe: 163, s_class: 189, v_class: 189, iv_class: 189, sprinter: 385 },
  cala_millor:   { mb_eqe: 176, s_class: 207, v_class: 207, iv_class: 207, sprinter: 407 },
  cala_ratjada:  { mb_eqe: 189, s_class: 218, v_class: 218, iv_class: 218, sprinter: 424 },
  deia:          { mb_eqe: 141, s_class: 169, v_class: 169, iv_class: 169, sprinter: 358 },
  formentor:     { mb_eqe: 194, s_class: 231, v_class: 231, iv_class: 231, sprinter: 440 },
  illetas:       { mb_eqe: 97,  s_class: 121, v_class: 121, iv_class: 121, sprinter: 297 },
  inca:          { mb_eqe: 132, s_class: 154, v_class: 154, iv_class: 154, sprinter: 325 },
  llucmajor:     { mb_eqe: 92,  s_class: 123, v_class: 123, iv_class: 123, sprinter: 297 },
  magaluf:       { mb_eqe: 110, s_class: 136, v_class: 136, iv_class: 136, sprinter: 297 },
  manacor:       { mb_eqe: 145, s_class: 176, v_class: 176, iv_class: 176, sprinter: 341 },
  marratxi:      { mb_eqe: 88,  s_class: 117, v_class: 117, iv_class: 117, sprinter: 275 },
  palma:         { mb_eqe: 79,  s_class: 112, v_class: 112, iv_class: 112, sprinter: 253 },
  palmanova:     { mb_eqe: 106, s_class: 132, v_class: 132, iv_class: 132, sprinter: 308 },
  pollenca:      { mb_eqe: 172, s_class: 200, v_class: 200, iv_class: 200, sprinter: 391 },
  portals:       { mb_eqe: 88,  s_class: 123, v_class: 123, iv_class: 123, sprinter: 286 },
  porto_colom:   { mb_eqe: 145, s_class: 172, v_class: 172, iv_class: 172, sprinter: 380 },
  porto_cristo:  { mb_eqe: 158, s_class: 183, v_class: 183, iv_class: 183, sprinter: 385 },
  puigpunyent:   { mb_eqe: 123, s_class: 147, v_class: 147, iv_class: 147, sprinter: 286 },
  sa_pobla:      { mb_eqe: 141, s_class: 163, v_class: 163, iv_class: 163, sprinter: 341 },
  santa_eugenia: { mb_eqe: 132, s_class: 152, v_class: 152, iv_class: 152, sprinter: 330 },
  sta_margalida: { mb_eqe: 172, s_class: 198, v_class: 198, iv_class: 198, sprinter: 402 },
  santa_maria:   { mb_eqe: 123, s_class: 147, v_class: 147, iv_class: 147, sprinter: 303 },
  santa_ponca:   { mb_eqe: 114, s_class: 141, v_class: 141, iv_class: 141, sprinter: 319 },
  soller:        { mb_eqe: 141, s_class: 167, v_class: 167, iv_class: 167, sprinter: 341 },
  valldemossa:   { mb_eqe: 132, s_class: 158, v_class: 158, iv_class: 158, sprinter: 330 },
};

// Pack prices: vehicle_type -> pack_duration -> price in EUR
// Source: TARIFAS_TRANSFERS_B2B_2026-2.pdf
// Note: Packs for destinations >40km from Palma add +1 hour
export const PACK_PRICES: Record<string, Record<string, number>> = {
  mb_eqe:   { '2h': 220, '4h': 374, '8h': 682,  '12h': 959 },
  s_class:  { '2h': 253, '4h': 462, '8h': 843,  '12h': 1085 },
  v_class:  { '2h': 253, '4h': 462, '8h': 843,  '12h': 1085 },
  iv_class: { '2h': 253, '4h': 462, '8h': 843,  '12h': 1085 },
  sprinter: { '2h': 440, '4h': 853, '8h': 1309, '12h': 1859 },
};

// Extra pricing per vehicle type in EUR
// Source: TARIFAS_TRANSFERS_B2B_2026-2.pdf
// Note: All prices exclude 10% IVA
export const EXTRA_PRICES: Record<string, {
  extra_hour: number;
  night_fee_per_hour: number;
  airport_pickup: number;
}> = {
  mb_eqe:   { extra_hour: 87,  night_fee_per_hour: 20, airport_pickup: 20 },
  s_class:  { extra_hour: 106, night_fee_per_hour: 20, airport_pickup: 20 },
  v_class:  { extra_hour: 106, night_fee_per_hour: 20, airport_pickup: 20 },
  sprinter: { extra_hour: 176, night_fee_per_hour: 40, airport_pickup: 25 },
};

// Commission rate (50%)
export const COMMISSION_RATE = 0.5;

/**
 * Get the base price for a zone and vehicle type
 */
export function getBasePrice(zone: string, vehicleType: string): number | null {
  return ZONE_PRICES[zone]?.[vehicleType] ?? null;
}

/**
 * Calculate price with commission added (base price * 1.5)
 */
export function calculatePriceWithCommission(basePrice: number): number {
  return Math.round(basePrice * (1 + COMMISSION_RATE));
}

/**
 * Get the commission amount from base price
 */
export function getCommissionAmount(basePrice: number): number {
  return Math.round(basePrice * COMMISSION_RATE);
}

/**
 * Get zone label by key
 */
export function getZoneLabel(key: string): string {
  return TRANSFER_ZONES.find(z => z.key === key)?.label ?? key;
}

/**
 * Get vehicle type info by key
 */
export function getVehicleInfo(key: string): { label: string; capacity: number } | null {
  const vehicle = VEHICLE_TYPES.find(v => v.key === key);
  return vehicle ? { label: vehicle.label, capacity: vehicle.capacity } : null;
}
