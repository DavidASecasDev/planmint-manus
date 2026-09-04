import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { summarizeRentlySyncWriteFailures } from './syncRently';

describe('seguridad de escritura de la sincronización Rently', () => {
  it('resume fallos sin incluir cuerpos ni datos de clientes', () => {
    expect(summarizeRentlySyncWriteFailures([
      { operation: 'insert', externalId: 'SYNTH-1', code: 'PGRST204' },
      { operation: 'update', externalId: 'SYNTH-2', code: 'PGRST204' },
    ])).toBe('2 escritura(s) de reservas rechazadas (PGRST204)');
  });

  it('marca el estado como error y lanza antes de acumular o avanzar la página', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'server/syncRently.ts'), 'utf8');
    const failureGuard = source.indexOf("if (pageWriteFailures.length > 0)");
    const totals = source.indexOf('totalInsertedCount += insertedCount', failureGuard);
    const offset = source.indexOf('currentOffset = nextOffset', failureGuard);
    expect(failureGuard).toBeGreaterThan(0);
    expect(source.slice(failureGuard, totals)).toContain("status: 'error'");
    expect(source.slice(failureGuard, totals)).toContain("title: 'Error crítico en sincronización Rently'");
    expect(source.slice(failureGuard, totals)).toContain('throw new Error(failureSummary)');
    expect(failureGuard).toBeLessThan(totals);
    expect(failureGuard).toBeLessThan(offset);
  });

  it('incluye una migración aditiva para la columna marca que originó el rechazo', () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260904110500_reservations_brand_and_sync_safety.sql'),
      'utf8',
    );
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS marca text');
    expect(migration).not.toMatch(/\b(DROP|TRUNCATE|DELETE)\b/i);
  });
});
