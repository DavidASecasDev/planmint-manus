/**
 * Pure calculation function (no DB calls) for testing and reuse.
 * Given items, returns the totals that would be written.
 */
export function calculateRequestTotals(
  items: Array<{
    price_with_commission: number | null;
    base_price: number | null;
    provider_cost: number | null;
  }>
) {
  const clientTotal = items.reduce(
    (sum, it) => sum + (it.price_with_commission || it.base_price || 0),
    0
  );

  const providerCost = items.reduce((sum, it) => sum + (it.base_price || 0), 0);

  const internalMargin = clientTotal - providerCost;

  return {
    clientTotal: Math.round(clientTotal * 100) / 100,
    providerCost: Math.round(providerCost * 100) / 100,
    internalMargin: Math.round(internalMargin * 100) / 100,
  };
}
