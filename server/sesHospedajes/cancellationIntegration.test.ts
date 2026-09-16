import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const endpoints = fs.readFileSync(path.join(root, 'server/sesHospedajes/sesEndpoints.ts'), 'utf8');
const service = fs.readFileSync(path.join(root, 'server/sesHospedajes/dailyReviewService.ts'), 'utf8');

describe('contrato integrado de cancelaciones SES', () => {
  it('protege organización y permisos en listado, sync y XML sin cambiar RLS', () => {
    expect(endpoints).toContain("authorize(req, 'ses_hospedajes.edit')");
    expect(endpoints).toContain("authorize(req, 'ses_hospedajes.export')");
    expect(endpoints).toContain("authorize(req, 'ses_hospedajes.view')");
    expect(endpoints).toContain(".eq('organization_id', ctx.organizationId)");
  });

  it('bloquea canceladas en XML antes de generar el payload y no las elimina', () => {
    const cancellationGuard = endpoints.indexOf('const cancellationBlocked');
    const xmlGeneration = endpoints.indexOf('const xml = generateSesXml(payloads)');
    expect(cancellationGuard).toBeGreaterThan(0);
    expect(cancellationGuard).toBeLessThan(xmlGeneration);
    expect(endpoints).not.toMatch(/delete\(\).*ses_contract_drafts|from\('ses_contract_drafts'\)\.delete/);
  });

  it('reconcilia por upsert y conserva campos manuales con auditoría', () => {
    expect(endpoints).toContain("onConflict: 'organization_id,reservation_id'");
    expect(endpoints).toContain('preserved_manual_fields');
    expect(endpoints).toContain('rently_cancellation_reconciled');
  });

  it('no inicializa fuentes externas para cancelación o estado desconocido en revisión diaria', () => {
    expect(service).toContain("cancellationDisposition.kind === 'active_or_reactivated'");
    expect(service).toContain("status: 'outside_period'");
  });
});
