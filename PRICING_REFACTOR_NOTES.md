# Pricing Refactor Notes

## Current Architecture

### DB columns added
- `transfer_requests.pricing_mode` TEXT DEFAULT 'zone_tariff'
- `transfer_items.provider_cost` NUMERIC DEFAULT NULL

### Pricing Modes
1. **zone_tariff** (default): Uses ZONE_PRICES matrix → base_price → +50% commission → price_with_commission
2. **provider_quote**: Uses uploaded document → provider_cost → calculateClientInvoice() → client_total

### Current Flow - Zone Tariff (per item)
- TransferItemBlock: zone + vehicle_type → getBasePrice() → calculatePriceWithCommission(base * 1.5) → price_with_commission
- price_with_commission is the CLIENT price (sin IVA)
- IVA 21% shown separately in UI
- Total Summary: sum of all items' price_with_commission + 21% IVA

### Current Flow - Provider Quote (request level)
- Upload doc → AI extracts providerCost → applyProviderCost()
- calculateClientInvoice(providerCost): transport(base+10%IVA) + commission(50%+21%IVA) = clientTotal
- Stored in transfer_requests: provider_cost, client_total, internal_margin
- TransferFinancialSummary shows this (internal view)

### Key Files
- `client/src/utils/transferCalculations.ts` - Provider quote formula
- `client/src/lib/transferPricing.ts` - Zone tariff matrix + helpers
- `client/src/components/transfers/TransferItemBlock.tsx` - Per-item pricing UI
- `client/src/components/transfers/TransferFinancialSummary.tsx` - Request-level financial summary
- `client/src/pages/transfers/TransferDetail.tsx` - Main detail page with total summary
- `client/src/hooks/useTransferDocuments.ts` - applyProviderCost mutation
- `client/src/hooks/useTransferRequests.ts` - Request CRUD, total_amount computed from items
- `client/src/types/transfers.ts` - TypeScript types

### What Needs to Change
1. Add `pricing_mode` to TransferRequest type
2. Add `provider_cost` to TransferItem type  
3. In TransferDetail: add pricing mode selector
4. When mode=provider_quote: item prices come from applyProviderCost (distributed per item)
5. When mode=zone_tariff: item prices come from zone matrix (current behavior)
6. Make price_with_commission always editable (already partially done with canEditPrice)
7. Unify total summary to always use sum of items' price_with_commission
8. TransferFinancialSummary should work for both modes
