// Transfer billing calculations
// Internal logic: Client sees ONLY total, margin is internal

const VAT_TRANSPORT = 0.10;    // 10% IVA transporte
const VAT_COMMISSION = 0.21;   // 21% IVA comisión
const COMMISSION_RATE = 0.50;  // 50% comisión sobre coste proveedor

export interface ClientInvoiceCalculation {
  // Internal breakdown (not shown to client)
  transport: {
    base: number;
    vat: number;
    subtotal: number;
  };
  commission: {
    base: number;
    vat: number;
    subtotal: number;
  };
  // Client-facing
  clientTotal: number;
  // Internal margin
  profitMargin: number;
  // For PDF: we show a single line with reverse-calculated base
  displayBase: number;
  displayVat: number;
  displayVatRate: number;
}

/**
 * Calculate client invoice amounts from provider cost
 * 
 * Internal logic:
 * - Transport: providerCost + 10% IVA
 * - Commission: 50% of providerCost + 21% IVA
 * - Client Total: sum of both
 * 
 * @param providerCost - The cost from the external provider
 * @returns Full calculation breakdown
 */
export function calculateClientInvoice(providerCost: number): ClientInvoiceCalculation {
  // Transport (passed to client at cost + VAT)
  const transportBase = providerCost;
  const transportVat = transportBase * VAT_TRANSPORT;
  const transportSubtotal = transportBase + transportVat;

  // Commission (our margin)
  const commissionBase = providerCost * COMMISSION_RATE;
  const commissionVat = commissionBase * VAT_COMMISSION;
  const commissionSubtotal = commissionBase + commissionVat;

  // Client total
  const clientTotal = transportSubtotal + commissionSubtotal;

  // Profit margin (commission base before VAT)
  const profitMargin = commissionBase;

  // For PDF display: reverse calculate a single line item
  // We show the total as if it were a single service with 21% VAT (client-facing)
  const displayVatRate = 0.21;
  const displayBase = clientTotal / (1 + displayVatRate);
  const displayVat = clientTotal - displayBase;

  return {
    transport: {
      base: roundCurrency(transportBase),
      vat: roundCurrency(transportVat),
      subtotal: roundCurrency(transportSubtotal),
    },
    commission: {
      base: roundCurrency(commissionBase),
      vat: roundCurrency(commissionVat),
      subtotal: roundCurrency(commissionSubtotal),
    },
    clientTotal: roundCurrency(clientTotal),
    profitMargin: roundCurrency(profitMargin),
    displayBase: roundCurrency(displayBase),
    displayVat: roundCurrency(displayVat),
    displayVatRate,
  };
}

/**
 * Round to 2 decimal places for currency
 */
function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

/**
 * Calculate margin percentage
 */
export function calculateMarginPercentage(providerCost: number, clientTotal: number): number {
  if (providerCost === 0) return 0;
  return Math.round(((clientTotal - providerCost) / providerCost) * 100);
}
