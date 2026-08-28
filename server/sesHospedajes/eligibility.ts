export const SES_MAX_DATE_RANGE_DAYS = 93;
export const SES_RENTLY_DELIVERED_STATUS = 2;
export const SES_RENTLY_TERMINATED_STATUS = 3;
export const SES_DELIVERY_BRANCH_OFFICE_ID = 1;

export type SesEligibilityReasonCode =
  | 'not_delivered'
  | 'terminated_never_reported'
  | 'transfer'
  | 'other_branch'
  | 'missing_actual_delivery'
  | 'future_actual_delivery'
  | 'booking_mismatch'
  | 'plate_mismatch'
  | 'missing_rently_detail';

export type SesEligibilityIssue = {
  code: SesEligibilityReasonCode;
  message: string;
  reviewRequired: boolean;
};

export type SesEligibilityInput = {
  visibleStatus?: string | null;
  rentlyStatusCode?: number | null;
  isTransfer?: boolean | null;
  deliveryBranchOfficeId?: number | null;
  actualDeliveryAt?: string | null;
  externalBookingId?: string | number | null;
  detailBookingId?: string | number | null;
  reservationPlate?: string | null;
  detailVehiclePlate?: string | null;
};

function normalizeText(value: unknown) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

export function normalizeSesPlate(value: unknown) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function validateSesDateRange(dateFrom: string, dateTo: string, maxDays = SES_MAX_DATE_RANGE_DAYS) {
  const from = new Date(`${dateFrom}T00:00:00Z`);
  const to = new Date(`${dateTo}T00:00:00Z`);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) {
    return { valid: false, message: 'Las fechas del periodo no son válidas' } as const;
  }
  if (from.getTime() > to.getTime()) {
    return { valid: false, message: 'La fecha inicial no puede ser posterior a la fecha final' } as const;
  }
  const days = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (days > maxDays) {
    return { valid: false, message: `El periodo máximo permitido es de ${maxDays} días` } as const;
  }
  return { valid: true, days } as const;
}

export async function collectAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 500,
) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) {
    throw new Error('El tamaño de página no es válido');
  }
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export function evaluateSesEligibility(input: SesEligibilityInput, now = new Date()) {
  const issues: SesEligibilityIssue[] = [];
  const statusLabel = normalizeText(input.visibleStatus);
  const delivered = ['entregado', 'en curso'].includes(statusLabel) && input.rentlyStatusCode === SES_RENTLY_DELIVERED_STATUS;
  const terminated = ['terminada', 'completada'].includes(statusLabel) || input.rentlyStatusCode === SES_RENTLY_TERMINATED_STATUS;

  if (terminated) {
    issues.push({
      code: 'terminated_never_reported',
      message: 'La reserva está Terminada y no consta como comunicada: requiere revisión manual',
      reviewRequired: true,
    });
  } else if (!delivered) {
    issues.push({ code: 'not_delivered', message: 'La reserva todavía no figura como Entregada en Rently', reviewRequired: false });
  }
  if (input.isTransfer === true) {
    issues.push({ code: 'transfer', message: 'Las transferencias no se comunican como alquiler de vehículo', reviewRequired: false });
  }
  if (input.deliveryBranchOfficeId !== SES_DELIVERY_BRANCH_OFFICE_ID) {
    issues.push({ code: 'other_branch', message: 'La entrega pertenece a una sucursal distinta de la configurada', reviewRequired: false });
  }
  if (!input.actualDeliveryAt) {
    issues.push({ code: 'missing_actual_delivery', message: 'Rently no contiene una fecha real de entrega', reviewRequired: false });
  } else {
    const deliveryTime = new Date(input.actualDeliveryAt).getTime();
    if (!Number.isFinite(deliveryTime)) {
      issues.push({ code: 'missing_actual_delivery', message: 'La fecha real de entrega no es válida', reviewRequired: false });
    } else if (deliveryTime > now.getTime()) {
      issues.push({ code: 'future_actual_delivery', message: 'La fecha real de entrega todavía es futura', reviewRequired: false });
    }
  }

  const externalId = String(input.externalBookingId ?? '').trim();
  const detailId = String(input.detailBookingId ?? '').trim();
  if (!externalId || !detailId) {
    issues.push({ code: 'missing_rently_detail', message: 'No se pudo confirmar el detalle contractual de Rently', reviewRequired: false });
  } else if (externalId !== detailId) {
    issues.push({ code: 'booking_mismatch', message: 'El identificador de la reserva no coincide con el detalle de Rently', reviewRequired: true });
  }

  const reservationPlate = normalizeSesPlate(input.reservationPlate);
  const detailPlate = normalizeSesPlate(input.detailVehiclePlate);
  if (!reservationPlate || !detailPlate || reservationPlate !== detailPlate) {
    issues.push({ code: 'plate_mismatch', message: 'La matrícula de PlanMint no coincide exactamente con la del contrato Rently', reviewRequired: true });
  }

  return {
    eligible: issues.length === 0,
    requiresReview: issues.some((issue) => issue.reviewRequired),
    issues,
  };
}
