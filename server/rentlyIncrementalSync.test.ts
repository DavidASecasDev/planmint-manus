import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve('server/syncRently.ts'), 'utf8');
const migration = fs.readFileSync(path.resolve('supabase/migrations/20260903111500_rently_incremental_sync_watermark.sql'), 'utf8');

describe('sincronización híbrida Rently', () => {
  it('usa updatedSince con solapamiento y conserva el cursor oficial', () => {
    expect(source).toContain("params.set('updatedSince', updatedSince)");
    expect(source).toContain('10 * 60 * 1000');
    expect(source).toContain('data.NextOffset');
  });

  it('fuerza una reconciliación completa al menos cada 24 horas', () => {
    expect(source).toContain('24 * 60 * 60 * 1000');
    expect(source).toContain("syncMode: 'full' | 'incremental'");
  });

  it('propone únicamente columnas aditivas y una restricción de modo', () => {
    expect(migration).toContain('add column if not exists watermark_updated_at');
    expect(migration).not.toMatch(/\b(delete from|truncate table)\b/i);
  });
});
