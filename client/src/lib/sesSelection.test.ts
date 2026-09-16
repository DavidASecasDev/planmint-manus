import { describe, expect, it } from 'vitest';
import { canSelectSesDraftForXml } from './sesSelection';

describe('selección manual SES', () => {
  it('permite seleccionar un borrador listo aunque tenga aviso de posible duplicado', () => {
    expect(canSelectSesDraftForXml({
      operationalStatus: 'ready', readyForXml: true,
      sesDuplicateWarning: { level: 'warning', message: 'Posible comunicación previa', reasons: ['accepted'] },
    })).toBe(true);
  });

  it('rechaza un borrador si falta o es inválido algún campo', () => {
    expect(canSelectSesDraftForXml({ operationalStatus: 'incomplete', readyForXml: false, sesDuplicateWarning: null })).toBe(false);
  });

  it('rechaza canceladas aunque un valor histórico readyForXml estuviera obsoleto', () => {
    expect(canSelectSesDraftForXml({
      operationalStatus: 'cancelled_not_applicable', readyForXml: true, sesDuplicateWarning: null,
      cancellationDisposition: {
        kind: 'cancelled_not_applicable', cancelled: true, notApplicableToDelivery: true,
        requiresReview: false, blocksXml: true, suppressMissingFields: true,
        reasonCode: 'cancelled_without_delivery', label: 'Cancelada · no aplicable a entrega',
      },
    })).toBe(false);
    expect(canSelectSesDraftForXml({
      operationalStatus: 'source_check_required', readyForXml: true, sesDuplicateWarning: null,
    })).toBe(false);
  });
});
