import { normalizeSesPlate } from './eligibility';

export type SesOfficialCommunicationStatus = 'active' | 'accepted' | 'annulled' | 'error';

export type SesOfficialCommunication = {
  official_communication_code: string;
  official_lot_code?: string | null;
  reference: string;
  communication_type: 'ALQUILER_VEHICULO';
  contract_date: string;
  normalized_plate?: string | null;
  status: SesOfficialCommunicationStatus;
};

export type SesOfficialClearance = {
  status: 'not_checked' | 'clear' | 'blocked' | 'review';
  clear: boolean;
  reasons: string[];
  matchingCommunicationCode: string | null;
};

export function evaluateOfficialClearance(input: {
  inventoryConfirmed: boolean;
  reference: string;
  contractDate?: string | null;
  vehiclePlate?: string | null;
  communications: SesOfficialCommunication[];
}): SesOfficialClearance {
  if (!input.inventoryConfirmed) {
    return {
      status: 'not_checked',
      clear: false,
      reasons: ['El inventario oficial todavía no se ha confirmado'],
      matchingCommunicationCode: null,
    };
  }

  const referenceRows = input.communications.filter((row) => row.reference === input.reference);
  if (referenceRows.length === 0) {
    return { status: 'clear', clear: true, reasons: [], matchingCommunicationCode: null };
  }

  const contractPlate = normalizeSesPlate(input.vehiclePlate);
  const exactRows = referenceRows.filter((row) => {
    const dateMatches = Boolean(input.contractDate) && row.contract_date === input.contractDate;
    const rowPlate = normalizeSesPlate(row.normalized_plate);
    const plateMatches = !rowPlate || (Boolean(contractPlate) && rowPlate === contractPlate);
    return row.communication_type === 'ALQUILER_VEHICULO' && dateMatches && plateMatches;
  });
  const blocking = exactRows.find((row) => row.status === 'active' || row.status === 'accepted');
  if (blocking) {
    return {
      status: 'blocked',
      clear: false,
      reasons: ['Existe una comunicación oficial activa o aceptada para el mismo contrato'],
      matchingCommunicationCode: blocking.official_communication_code,
    };
  }

  const reviewRow = exactRows[0] ?? referenceRows[0];
  return {
    status: 'review',
    clear: false,
    reasons: [exactRows.length
      ? 'La comunicación oficial coincidente está anulada o contiene error; requiere revisión'
      : 'La referencia existe en SES con fecha o matrícula distinta; requiere revisión'],
    matchingCommunicationCode: reviewRow?.official_communication_code ?? null,
  };
}

export function normalizeOfficialInventoryItem<T extends {
  vehicle_plate?: string | null;
  normalized_plate?: string | null;
}>(item: T) {
  return {
    ...item,
    normalized_plate: normalizeSesPlate(item.normalized_plate || item.vehicle_plate) || null,
  };
}

export function assertNonEmptyOfficialInventory(items: readonly unknown[]) {
  if (items.length === 0) {
    throw new Error('El inventario oficial no puede confirmarse con una lista vacía');
  }
}

export function assertStableOfficialCommunicationIdentity(
  existing: SesOfficialCommunication | null | undefined,
  incoming: SesOfficialCommunication,
) {
  if (!existing) return;
  const sameIdentity = existing.reference === incoming.reference
    && existing.communication_type === incoming.communication_type
    && existing.contract_date === incoming.contract_date
    && normalizeSesPlate(existing.normalized_plate) === normalizeSesPlate(incoming.normalized_plate);
  if (!sameIdentity) throw new Error('El código oficial ya pertenece a otro contrato, fecha o matrícula');
}
