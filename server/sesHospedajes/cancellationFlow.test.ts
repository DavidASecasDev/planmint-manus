import { describe, expect, it } from 'vitest';
import {
  buildSesCancellationReconciliation,
  deriveSesCancellationDisposition,
  findSesCancellationXmlBlocks,
} from './cancellation';
import { deriveSesOperationalState, projectSesOperationalDraft } from './operationalDraft';
import { deriveSesReviewBatchCounts } from './dailyReviewService';

const existingDraft = {
  id: 'draft-synthetic',
  status: 'incomplete',
  is_eligible: true,
  ready_for_xml: false,
  manual_fields: ['pickup_at', 'vehicle_plate'],
  pickup_at: '2026-09-10T15:30:00',
  vehicle_plate: 'MANUAL-001',
  validation_errors: [{ path: 'holder.postal_code', code: 'required', message: 'Falta CP' }],
  eligibility_snapshot: { source_by_field: { vehicle_plate: 'manual' } },
};

describe('flujo SES de cancelaciones', () => {
  it('reclasifica una reserva cancelada después de importarla sin borrar contenido manual', () => {
    const result = buildSesCancellationReconciliation({
      existing: existingDraft,
      rentlyStatusCode: 4,
      actualDeliveryAt: null,
      checkedAt: '2026-09-16T10:00:00.000Z',
    });
    expect(result.values).toMatchObject({
      status: 'incomplete', is_eligible: false, ready_for_xml: false,
      manual_fields: ['pickup_at', 'vehicle_plate'],
      validation_errors: existingDraft.validation_errors,
    });
    expect(existingDraft).toMatchObject({ pickup_at: '2026-09-10T15:30:00', vehicle_plate: 'MANUAL-001' });
  });

  it('conserva una cancelación con entrega real o comunicación previa como revisión específica', () => {
    expect(deriveSesCancellationDisposition({ rentlyStatusCode: 4, actualDeliveryAt: '2026-09-10T15:31:00' }))
      .toMatchObject({ kind: 'cancelled_requires_review', blocksXml: true, reasonCode: 'cancelled_with_delivery' });
    expect(deriveSesCancellationDisposition({ rentlyStatusCode: 4, officialCommunicationCount: 1 }))
      .toMatchObject({ kind: 'cancelled_requires_review', blocksXml: true, reasonCode: 'cancelled_with_official_history' });
  });

  it('no duplica ni incrementa versión en una sincronización repetida sin cambios', () => {
    const first = buildSesCancellationReconciliation({
      existing: existingDraft, rentlyStatusCode: 4, checkedAt: '2026-09-16T10:00:00.000Z',
    });
    const second = buildSesCancellationReconciliation({
      existing: { ...existingDraft, ...first.values }, rentlyStatusCode: 4, checkedAt: '2026-09-16T10:05:00.000Z',
    });
    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
  });

  it('permite volver a evaluar una reactivada sin arrastrar la exclusión cancelada', () => {
    const reactivated = projectSesOperationalDraft({
      ...existingDraft,
      validation_errors: [],
      eligibility_snapshot: { ...existingDraft.eligibility_snapshot, cancellation: { kind: 'cancelled_not_applicable' } },
      reservation: { rently_status_code: 2, rently_delivery_actual_at: '2026-09-16T09:00:00' },
    });
    expect(reactivated).toMatchObject({
      operationalStatus: 'ready', readyForXml: true,
      cancellationDisposition: { kind: 'active_or_reactivated' },
    });
  });

  it('mantiene desconocido como pendiente de comprobar y nunca como cancelado supuesto', () => {
    const disposition = deriveSesCancellationDisposition({ rentlyStatusCode: null });
    expect(disposition).toMatchObject({ kind: 'source_status_unknown', cancelled: false, blocksXml: true });
    expect(deriveSesOperationalState({ validationIssues: [], cancellationDisposition: disposition }))
      .toMatchObject({ status: 'source_check_required', readyForXml: false });
  });

  it('excluye canceladas no aplicables de pendientes diarios y mantiene revisiones abiertas', () => {
    expect(deriveSesReviewBatchCounts([
      { status: 'outside_period', draft_id: 'cancelled-5592', conflicts: [] },
      { status: 'evidence_conflict', draft_id: 'cancelled-with-delivery', conflicts: [] },
    ], [])).toMatchObject({ candidateCount: 2, pendingCount: 1, errorCount: 0 });
  });

  it('mantiene los registros históricos bloqueados pero impide un XML nuevo', () => {
    const historical = projectSesOperationalDraft({
      id: 'historical', status: 'accepted', validation_errors: [], eligibility_snapshot: {},
      reservation: { rently_status_code: 4, rently_delivery_actual_at: null },
      __official_communication_count: 1,
    });
    expect(historical).toMatchObject({
      operationalStatus: 'xml_generated', readyForXml: false,
      cancellationDisposition: { kind: 'cancelled_requires_review', blocksXml: true },
    });
  });

  it('bloquea XML funcionalmente antes de cualquier efecto lateral', () => {
    let sideEffects = 0;
    const cancelled = deriveSesCancellationDisposition({ rentlyStatusCode: 4 });
    const preflight = (drafts: Array<{ id: string; reference: string; cancellationDisposition: typeof cancelled }>) => {
      const blocks = findSesCancellationXmlBlocks(drafts);
      if (blocks.length) return { status: 422, blocks };
      sideEffects += 1;
      return { status: 200, blocks: [] };
    };
    const result = preflight([{ id: 'draft-5592', reference: '5592', cancellationDisposition: cancelled }]);
    expect(result).toMatchObject({ status: 422, blocks: [{ reference: '5592' }] });
    expect(sideEffects).toBe(0);
  });
});
