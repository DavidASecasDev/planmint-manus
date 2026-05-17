/**
 * PlanMint Pricing Engine
 * 
 * Calculates transfer pricing with full breakdown:
 * - Base price from zone/vehicle tariff (LimoMallorca B2B 2026)
 * - Supplements: airport pickup, night fee, extra hours
 * - Provider cost: base + supplements (what we pay LimoMallorca)
 * - Provider IVA: 10% on provider cost (transporte)
 * - Commission: 50% on provider cost incl. IVA
 * - Client price: provider cost + commission
 * - Client IVA: 21% on client price (intermediación)
 * 
 * INTERNAL: Provider cost, commission, margin → only visible to Azul Cars team
 * CLIENT: Service price + 21% IVA → what the client sees on invoice
 */

import {
  getBasePrice,
  getPackBasePrice,
  EXTRA_PRICES,
  COMMISSION_RATE,
  type VehicleTypeKey,
} from './transferPricing';

// ── Constants ────────────────────────────────────────────────────────

export const VAT_PROVIDER = 0.10;  // 10% IVA transporte (lo que pagamos a LimoMallorca)
export const VAT_CLIENT = 0.21;    // 21% IVA intermediación (lo que cobra Azul Cars al cliente)
export { COMMISSION_RATE } from './transferPricing';

// ── Types ────────────────────────────────────────────────────────────

export interface SupplementConfig {
  /** Recogida en aeropuerto */
  airportPickup: boolean;
  /** Número de horas en horario nocturno (1:00-5:00) */
  nightHours: number;
  /** Horas extra (solo para packs) */
  extraHours: number;
}

export interface PricingBreakdown {
  // ── Base ──
  /** Precio base de la tarifa (zona o pack) */
  basePrice: number;

  // ── Suplementos ──
  /** Suplemento recogida aeropuerto */
  airportPickupFee: number;
  /** Suplemento nocturno total */
  nightFee: number;
  /** Coste horas extra total */
  extraHoursFee: number;
  /** Total suplementos */
  totalSupplements: number;

  // ── Proveedor (INTERNO) ──
  /** Coste neto proveedor = base + suplementos */
  providerNet: number;
  /** IVA 10% proveedor */
  providerVat: number;
  /** Total proveedor con IVA */
  providerTotal: number;

  // ── Comisión (INTERNO) ──
  /** Comisión Azul Cars = 50% sobre providerTotal */
  commissionAmount: number;

  // ── Cliente ──
  /** Precio servicio al cliente (sin IVA) = providerNet + comisión */
  clientNet: number;
  /** IVA 21% cliente */
  clientVat: number;
  /** Total cliente con IVA */
  clientTotal: number;

  // ── Margen (INTERNO) ──
  /** Beneficio bruto = comisión */
  profitMargin: number;
  /** Porcentaje de margen sobre coste proveedor */
  marginPercent: number;
}

// ── Helper ───────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Main calculation ─────────────────────────────────────────────────

/**
 * Calculate full pricing breakdown for a transfer service.
 * 
 * @param basePrice - The base tariff price (from zone lookup or pack)
 * @param vehicleType - Vehicle type key for supplement lookup
 * @param supplements - Which supplements apply
 * @returns Full pricing breakdown with internal and client-facing amounts
 */
export function calculatePricingBreakdown(
  basePrice: number,
  vehicleType: string,
  supplements: Partial<SupplementConfig> = {},
): PricingBreakdown {
  const extras = EXTRA_PRICES[vehicleType] || EXTRA_PRICES['v_class'];
  const { airportPickup = false, nightHours = 0, extraHours = 0 } = supplements;

  // Supplements
  const airportPickupFee = airportPickup ? extras.airport_pickup : 0;
  const nightFee = nightHours > 0 ? nightHours * extras.night_fee_per_hour : 0;
  const extraHoursFee = extraHours > 0 ? extraHours * extras.extra_hour : 0;
  const totalSupplements = airportPickupFee + nightFee + extraHoursFee;

  // Provider cost (what we pay LimoMallorca)
  const providerNet = basePrice + totalSupplements;
  const providerVat = round2(providerNet * VAT_PROVIDER);
  const providerTotal = round2(providerNet + providerVat);

  // Commission (50% on provider total incl. IVA)
  const commissionAmount = round2(providerTotal * COMMISSION_RATE);

  // Client price
  const clientNet = round2(providerNet + commissionAmount);
  const clientVat = round2(clientNet * VAT_CLIENT);
  const clientTotal = round2(clientNet + clientVat);

  // Margin
  const profitMargin = commissionAmount;
  const marginPercent = providerTotal > 0 ? round2((commissionAmount / providerTotal) * 100) : 0;

  return {
    basePrice: round2(basePrice),
    airportPickupFee: round2(airportPickupFee),
    nightFee: round2(nightFee),
    extraHoursFee: round2(extraHoursFee),
    totalSupplements: round2(totalSupplements),
    providerNet: round2(providerNet),
    providerVat,
    providerTotal,
    commissionAmount,
    clientNet,
    clientVat,
    clientTotal,
    profitMargin,
    marginPercent,
  };
}

/**
 * Calculate pricing for a point-to-point transfer.
 */
export function calculatePointToPointPricing(
  zone: string,
  vehicleType: string,
  supplements: Partial<SupplementConfig> = {},
): PricingBreakdown | null {
  const base = getBasePrice(zone, vehicleType);
  if (base === null) return null;
  return calculatePricingBreakdown(base, vehicleType, supplements);
}

/**
 * Calculate pricing for a pack (hours) transfer.
 */
export function calculatePackPricing(
  vehicleType: string,
  packDuration: string,
  supplements: Partial<SupplementConfig> = {},
): PricingBreakdown | null {
  const base = getPackBasePrice(vehicleType, packDuration);
  if (base === null) return null;
  return calculatePricingBreakdown(base, vehicleType, supplements);
}

/**
 * Quick estimate: returns only the client-facing price (sin IVA) for display.
 * This is what the broker sees as "estimated price" in the wizard.
 */
export function getQuickEstimate(
  zone: string | null,
  vehicleType: string,
  serviceType: 'point_to_point' | 'pack',
  packDuration?: string,
  clientType: 'external_client' | 'broker_client' = 'external_client',
  supplements: Partial<SupplementConfig> = {},
): number | null {
  let breakdown: PricingBreakdown | null = null;

  if (serviceType === 'point_to_point' && zone) {
    breakdown = calculatePointToPointPricing(zone, vehicleType, supplements);
  } else if (serviceType === 'pack' && packDuration) {
    breakdown = calculatePackPricing(vehicleType, packDuration, supplements);
  }

  if (!breakdown) return null;

  // broker_client sees the provider net price (B2B tariff + supplements)
  // external_client sees the client net price (with commission, sin IVA)
  return clientType === 'broker_client' ? breakdown.providerNet : breakdown.clientNet;
}

/**
 * Format a PricingBreakdown into a summary object for display.
 */
export function formatBreakdownSummary(b: PricingBreakdown) {
  return {
    // What the client sees on invoice
    clientService: b.clientNet,
    clientIva: b.clientVat,
    clientTotal: b.clientTotal,
    // Internal only
    providerCost: b.providerTotal,
    commission: b.commissionAmount,
    profit: b.profitMargin,
    marginPct: b.marginPercent,
  };
}
