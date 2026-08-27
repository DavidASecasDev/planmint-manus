import { createHash } from 'node:crypto';

const DRAFT_CONTENT_FIELDS = [
  'reference', 'contract_date', 'pickup_at', 'return_at',
  'pickup_location_id', 'return_location_id',
  'holder_profile_id', 'primary_driver_profile_id', 'secondary_driver_profile_id',
  'payment_type', 'payment_date', 'payment_medium', 'payment_holder', 'card_expiry',
  'vehicle_category', 'vehicle_type', 'vehicle_brand', 'vehicle_model', 'vehicle_plate',
  'vehicle_vin', 'vehicle_color', 'km_pickup', 'km_return', 'gps_data', 'manual_fields',
] as const;

const DATE_TIME_FIELDS = new Set(['pickup_at', 'return_at']);

function comparableValue(field: string, value: unknown): unknown {
  if (value === undefined || value === null || value === '') return null;
  if (DATE_TIME_FIELDS.has(field) && typeof value === 'string') {
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? value : new Date(timestamp).toISOString();
  }
  if (field === 'manual_fields' && Array.isArray(value)) {
    return Array.from(new Set(value.map(String))).sort();
  }
  return value;
}

export function getActualChangedValues(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(incoming).filter(([field, value]) => (
    JSON.stringify(comparableValue(field, current[field])) !== JSON.stringify(comparableValue(field, value))
  )));
}

export function calculateSesDraftContentHash(draft: Record<string, unknown>): string {
  const content = Object.fromEntries(DRAFT_CONTENT_FIELDS.map((field) => [
    field,
    comparableValue(field, draft[field]),
  ]));
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}
