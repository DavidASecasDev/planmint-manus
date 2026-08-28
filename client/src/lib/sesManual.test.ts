import { describe, expect, it } from 'vitest';
import {
  SES_AUTOMATIC_DATA, SES_GOLDEN_RULES, SES_MANUAL_DATA, SES_MANUAL_STATUSES,
  SES_MANUAL_STEPS,
} from './sesManual';

describe('manual operativo SES.HOSPEDAJES', () => {
  it('explica el flujo completo y ordenado desde configuración hasta conciliación', () => {
    expect(SES_MANUAL_STEPS.map((step) => step.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(SES_MANUAL_STEPS[4].action).toContain('Generar XML');
    expect(SES_MANUAL_STEPS[5].warning).toContain('mismo XML');
    expect(SES_MANUAL_STEPS[6].action).toContain('Mis comunicaciones → Lote');
  });

  it('distingue datos automáticos de los que requieren confirmación humana', () => {
    expect(SES_AUTOMATIC_DATA.join(' ')).toContain('bastidor');
    expect(SES_MANUAL_DATA.join(' ')).toContain('Tipo de pago real');
    expect(SES_MANUAL_DATA.join(' ')).toContain('Categoría del permiso');
  });

  it('cubre todos los estados operativos y las protecciones críticas', () => {
    expect(SES_MANUAL_STATUSES.map((item) => item.status)).toEqual([
      'Incompleto', 'Listo', 'En lote', 'Subido · pendiente', 'Aceptado', 'Error', 'Requiere revisión',
      'Revisión obligatoria',
    ]);
    expect(SES_GOLDEN_RULES.some((rule) => rule.includes('nunca envía automáticamente'))).toBe(true);
    expect(SES_GOLDEN_RULES.some((rule) => rule.includes('no equivale a una aceptación'))).toBe(true);
    expect(SES_GOLDEN_RULES.some((rule) => rule.includes('XSD oficial'))).toBe(true);
    expect(SES_GOLDEN_RULES.some((rule) => rule.includes('snapshots'))).toBe(true);
  });
});
