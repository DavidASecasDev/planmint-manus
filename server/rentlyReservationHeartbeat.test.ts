import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Heartbeat de reservas Rently', () => {
  const syncSource = fs.readFileSync(path.join(process.cwd(), 'server/syncRently.ts'), 'utf8');
  const indexSource = fs.readFileSync(path.join(process.cwd(), 'server/_core/index.ts'), 'utf8');

  it('se monta bajo /api/scheduled y marca la ejecución como programada', () => {
    expect(indexSource).toContain('app.post("/api/scheduled/rently-reservations"');
    expect(indexSource).toContain('handleSyncRently(req, res, { scheduled: true })');
  });

  it('autentica identidad cron y resuelve la organización solo por task_uid persistido', () => {
    expect(syncSource).toContain('sdk.authenticateRequest(req)');
    expect(syncSource).toContain(".eq('schedule_cron_task_uid', cronUser.taskUid)");
    expect(syncSource).toContain(".in('role', ['owner', 'admin'])");
    expect(syncSource).toContain("skipped: 'orphan'");
    expect(syncSource).not.toContain('req.body.organizationId');
  });

  it('continúa un ciclo en marcha y no depende de un navegador abierto', () => {
    expect(syncSource).toContain("continue_sync = syncStatus?.status === 'running'");
  });

  it('incluye columna e índice parciales para el identificador Heartbeat', () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260904112500_rently_reservation_sync_heartbeat.sql'),
      'utf8',
    );
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS schedule_cron_task_uid varchar(65)');
    expect(migration).toContain('idx_rently_sync_status_schedule_task_uid');
    expect(migration).not.toMatch(/\b(DROP|TRUNCATE|DELETE)\b/i);
  });
});
