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
});
