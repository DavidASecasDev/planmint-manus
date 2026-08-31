import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SesDraftActions } from './SesDraftActions';
import type { SesContractDraft } from '@/types/sesHospedajes';

function draft(status: SesContractDraft['status'], complete = false): SesContractDraft {
  return { id: 'draft-synthetic', reference: 'SYNTHETIC-1', status, is_complete: complete, is_eligible: false,
    is_officially_clear: false, ready_for_xml: false, official_check_status: 'not_checked', eligibility_errors: [],
    validation_errors: [], manual_fields: [], draft_version: 1, updated_at: '2026-08-28T00:00:00Z',
    operationalStatus: status === 'accepted' ? 'xml_generated' : complete ? 'ready' : 'incomplete', readyForXml: complete,
    missingFields: [], invalidFields: [], sourceByField: {}, syncConflicts: [], sesDuplicateWarning: null } as unknown as SesContractDraft;
}

describe('acciones operativas por contrato SES', () => {
  it.each([['incomplete', false], ['pending_sync', false]] as const)('muestra Comprobar SES antes de Completar para %s', (status, complete) => {
    const html = renderToStaticMarkup(<SesDraftActions draft={draft(status, complete)} canExport schemaMigrationRequired={false} checking={false} onCheck={() => undefined} onComplete={() => undefined} />);
    expect(html).toContain('Comprobar SES');
    expect(html.indexOf('Comprobar SES')).toBeLessThan(html.indexOf('Completar'));
  });

  it('no ofrece una nueva comprobación para un contrato histórico bloqueado', () => {
    const html = renderToStaticMarkup(<SesDraftActions draft={draft('accepted', true)} canExport schemaMigrationRequired={false} checking={false} onCheck={() => undefined} onComplete={() => undefined} />);
    expect(html).not.toContain('Comprobar SES');
    expect(html).toContain('Histórico');
  });
});
