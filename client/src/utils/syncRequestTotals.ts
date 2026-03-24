import { supabase } from '@/integrations/supabase/client';
import { calculateRequestTotals } from './syncRequestTotals.pure';
import type { PricingMode } from '@/types/transfers';

// Re-export the pure function for convenience
export { calculateRequestTotals };

/**
 * Recalculates and syncs client_total, provider_cost, and internal_margin
 * on the transfer_requests row from the current transfer_items.
 *
 * This should be called after any item create/update/delete operation
 * so that the request-level financial fields stay in sync with the items.
 *
 * - client_total = sum of price_with_commission (what the client pays, sin IVA)
 * - provider_cost = sum of base_price (zone_tariff) or provider_cost (provider_quote)
 * - internal_margin = client_total - provider_cost
 */
export async function syncRequestTotals(requestId: string): Promise<void> {
  try {
    // 1. Fetch the request's pricing_mode
    const { data: request, error: reqError } = await supabase
      .from('transfer_requests')
      .select('pricing_mode')
      .eq('id', requestId)
      .single();

    if (reqError || !request) {
      console.error('syncRequestTotals: failed to fetch request', reqError);
      return;
    }

    const pricingMode: PricingMode = (request.pricing_mode as PricingMode) || 'zone_tariff';

    // 2. Fetch all items for this request
    const { data: items, error: itemsError } = await supabase
      .from('transfer_items')
      .select('price_with_commission, base_price, provider_cost')
      .eq('request_id', requestId);

    if (itemsError) {
      console.error('syncRequestTotals: failed to fetch items', itemsError);
      return;
    }

    // 3. Calculate totals using the pure function
    const totals = calculateRequestTotals(items || [], pricingMode);

    // 4. Update the request
    const { error: updateError } = await supabase
      .from('transfer_requests')
      .update({
        client_total: totals.clientTotal,
        provider_cost: totals.providerCost,
        internal_margin: totals.internalMargin,
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('syncRequestTotals: failed to update request', updateError);
    }
  } catch (err) {
    console.error('syncRequestTotals: unexpected error', err);
  }
}
