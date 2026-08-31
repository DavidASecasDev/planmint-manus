import { describe, expect, it } from 'vitest';
import {
  SES_AUTOMATIC_DATA, SES_GOLDEN_RULES, SES_MANUAL_DATA, SES_MANUAL_STATUSES,
  SES_MANUAL_STEPS,
} from './sesManual';

describe('manual operativo SES.HOSPEDAJES', () => {
  it('explica el flujo simplificado completo y ordenado', () => {
    expect(SES_MANUAL_STEPS.map((step) => step.number)).toEqual([1, 2, 3, 4, 5]);
    expect(SES_MANUAL_STEPS[0].action).toContain('Sincronizar Rently');
    expect(SES_MANUAL_STEPS[1].title).toContain('Completa');
    expect(SES_MANUAL_STEPS[3].action).toContain('Comprobar SES');
    expect(SES_MANUAL_STEPS[4].action).toContain('Descargar XML');
  });

  it('distingue datos automáticos de los que requieren confirmación humana', () => {
    expect(SES_AUTOMATIC_DATA.join(' ')).toContain('bastidor');
    expect(SES_MANUAL_DATA.join(' ')).toContain('Tipo de pago real');
    expect(SES_MANUAL_DATA.join(' ')).toContain('Categoría del permiso');
  });

  it('cubre únicamente los tres estados operativos y las protecciones críticas', () => {
    expect(SES_MANUAL_STATUSES.map((item) => item.status)).toEqual(['Incompleta', 'Listo', 'XML generado']);
    expect(SES_GOLDEN_RULES.some((rule) => rule.includes('nunca envía automáticamente'))).toBe(true);
    expect(SES_GOLDEN_RULES.some((rule) => rule.includes('nunca bloquea'))).toBe(true);
    expect(SES_GOLDEN_RULES.some((rule) => rule.includes('snapshots'))).toBe(true);
  });
});
