import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deduplicateRentlyBookingsByStableId, shouldIncludeRentlyBookingInSync } from './syncRently';

describe('sincronización Rently iniciada desde SES', () => {
  it('incluye todos los estados cuando SES solicita una sincronización completa', () => {
    for (const currentStatus of [0, 1, 2, 3, 4, 5]) {
      expect(shouldIncludeRentlyBookingInSync({ currentStatus, existsInPlanMint: false, includeAll: true })).toBe(true);
    }
  });

  it('conserva los filtros históricos de la sincronización general', () => {
    expect(shouldIncludeRentlyBookingInSync({ currentStatus: 4, existsInPlanMint: false })).toBe(false);
    expect(shouldIncludeRentlyBookingInSync({ currentStatus: 5, existsInPlanMint: false })).toBe(false);
    expect(shouldIncludeRentlyBookingInSync({ currentStatus: 4, existsInPlanMint: true })).toBe(true);
  });

  it('deduplica la misma reserva por su identificador estable antes del upsert', () => {
    const first = { Id: 65001, value: 'primera versión' };
    const latest = { Id: 65001, value: 'versión actualizada' };
    const unique = deduplicateRentlyBookingsByStableId([first, latest, { Id: 65002, value: 'otra' }]);
    expect(unique).toHaveLength(2);
    expect(unique.find((booking) => booking.Id === 65001)?.value).toBe('versión actualizada');
  });

  it('mantiene la sincronización completa independiente del corte temprano histórico', () => {
    const source = readFileSync(new URL('./syncRently.ts', import.meta.url), 'utf8');
    expect(source).toContain('!includeAllForRun && consecutiveUnchangedPages >= EARLY_TERM_UNCHANGED_PAGES');
    expect(source).toContain('onConflict: "organization_id,external_reservation_id"');
  });
});
