import { createHash } from 'node:crypto';

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function hashJson(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

export function buildSesHistoricalSnapshots(input: {
  organizationId: string;
  batchItemId: string;
  draft: Record<string, any>;
}) {
  const { draft } = input;
  const common = {
    organization_id: input.organizationId,
    batch_item_id: input.batchItemId,
    draft_id: draft.id,
    entity_version: draft.draft_version,
  };
  const entities = [
    {
      entity_kind: 'contract', entity_role: '', entity_id: draft.id,
      snapshot_data: {
        reference: draft.reference, external_booking_id: draft.external_booking_id,
        contract_date: draft.contract_date, pickup_at: draft.pickup_at, return_at: draft.return_at,
        payment_type: draft.payment_type, payment_date: draft.payment_date,
        payment_medium: draft.payment_medium, payment_holder: draft.payment_holder,
        card_expiry: draft.card_expiry, document_version: draft.document_version,
      },
    },
    {
      entity_kind: 'vehicle', entity_role: '', entity_id: draft.id,
      snapshot_data: {
        vehicle_category: draft.vehicle_category, vehicle_type: draft.vehicle_type,
        vehicle_brand: draft.vehicle_brand, vehicle_model: draft.vehicle_model,
        vehicle_plate: draft.vehicle_plate, vehicle_vin: draft.vehicle_vin,
        vehicle_color: draft.vehicle_color, km_pickup: draft.km_pickup,
        km_return: draft.km_return, gps_data: draft.gps_data,
      },
    },
    { entity_kind: 'person', entity_role: 'holder', entity_id: draft.holder?.id ?? null, snapshot_data: draft.holder },
    { entity_kind: 'person', entity_role: 'primary_driver', entity_id: draft.primary_driver?.id ?? null, snapshot_data: draft.primary_driver },
    ...(draft.secondary_driver
      ? [{ entity_kind: 'person', entity_role: 'secondary_driver', entity_id: draft.secondary_driver.id, snapshot_data: draft.secondary_driver }]
      : []),
    { entity_kind: 'location', entity_role: 'pickup', entity_id: draft.pickup_location?.id ?? null, snapshot_data: draft.pickup_location },
    { entity_kind: 'location', entity_role: 'return', entity_id: draft.return_location?.id ?? null, snapshot_data: draft.return_location },
  ];
  return entities.map((entity) => {
    const snapshotData = cloneJson(entity.snapshot_data ?? null);
    return { ...common, ...entity, snapshot_data: snapshotData, snapshot_hash: hashJson(snapshotData) };
  });
}

export function calculateSesPayloadSnapshotHash(payload: unknown) {
  return hashJson(cloneJson(payload));
}

