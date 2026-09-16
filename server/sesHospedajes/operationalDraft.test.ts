import { describe, expect, it } from 'vitest';
import {
  buildSesDuplicateWarning,
  deriveSesOperationalState,
  dedupeSharedPersonIssues,
  mergeSesRentlyFields,
  projectSesOperationalDraft,
  splitSesValidationIssues,
} from './operationalDraft';
import { deriveSesCancellationDisposition } from './cancellation';

const required = { path: 'vehicle_vin', code: 'required' as const, message: 'Falta bastidor' };
const invalid = { path: 'holder.postal_code', code: 'invalid' as const, message: 'Código postal no válido' };

describe('modelo operativo SES simplificado', () => {
  it('deriva readyForXml solo de campos ausentes o inválidos', () => {
    expect(deriveSesOperationalState({ validationIssues: [] })).toEqual({
      status: 'ready', readyForXml: true, missingFields: [], invalidFields: [],
    });
    expect(deriveSesOperationalState({ validationIssues: [required, invalid] })).toMatchObject({
      status: 'incomplete', readyForXml: false,
      missingFields: [required], invalidFields: [invalid],
    });
  });

  it('separa contradicciones de faltantes y bloquea Listo para XML', () => {
    expect(deriveSesOperationalState({ validationIssues: [], blockingConflictCount: 1 })).toEqual({
      status: 'incomplete', readyForXml: false, missingFields: [], invalidFields: [],
    });
    const projected = projectSesOperationalDraft({
      id: 'existing-5582', status: 'ready', validation_errors: [], manual_fields: [],
      eligibility_snapshot: { daily_review_conflicts: [{ field: 'licence_number', source: 'hubspot' }] },
    });
    expect(projected).toMatchObject({
      operationalStatus: 'incomplete', readyForXml: false, missingFields: [], invalidFields: [],
      reviewConflicts: [{ field: 'licence_number', source: 'hubspot' }],
    });
  });

  it('mantiene el historial generado fuera de los tres estados editables', () => {
    expect(deriveSesOperationalState({ validationIssues: [], historicalStatus: 'accepted' })).toMatchObject({
      status: 'xml_generated', readyForXml: true,
    });
  });

  it('proyecta 5592 como cancelada no aplicable sin faltantes ni XML', () => {
    const projected = projectSesOperationalDraft({
      id: 'draft-5592', reference: '5592', status: 'incomplete', ready_for_xml: false,
      validation_errors: [required, invalid], manual_fields: [], eligibility_snapshot: {},
      reservation: { rently_status_code: 4, rently_delivery_actual_at: null },
      __official_communication_count: 0,
      __historical_batch_item_count: 0,
    });
    expect(projected).toMatchObject({
      operationalStatus: 'cancelled_not_applicable', readyForXml: false,
      missingFields: [], invalidFields: [],
      cancellationDisposition: { kind: 'cancelled_not_applicable' },
    });
  });

  it('conserva cancelaciones con entrega o comunicación para revisión específica', () => {
    expect(deriveSesOperationalState({
      validationIssues: [required],
      cancellationDisposition: deriveSesCancellationDisposition({ rentlyStatusCode: 4, actualDeliveryAt: '2026-09-10T10:00:00' }),
    })).toMatchObject({ status: 'cancellation_review', readyForXml: false, missingFields: [], invalidFields: [] });
    const accepted = projectSesOperationalDraft({
      id: 'accepted-cancelled', status: 'accepted', validation_errors: [], eligibility_snapshot: {},
      reservation: { rently_status_code: 4, rently_delivery_actual_at: null },
      __official_communication_count: 1,
    });
    expect(accepted).toMatchObject({
      operationalStatus: 'xml_generated', readyForXml: false,
      cancellationDisposition: { kind: 'cancelled_requires_review', reasonCode: 'cancelled_with_official_history' },
    });
  });

  it('recupera la proyección normal al reactivarse con un estado Rently acreditado', () => {
    const reactivated = projectSesOperationalDraft({
      id: 'reactivated', status: 'incomplete', validation_errors: [],
      eligibility_snapshot: { cancellation: { kind: 'cancelled_not_applicable' } },
      reservation: { rently_status_code: 2, rently_delivery_actual_at: '2026-09-16T09:00:00' },
    });
    expect(reactivated).toMatchObject({ operationalStatus: 'ready', readyForXml: true,
      cancellationDisposition: { kind: 'active_or_reactivated' } });
  });

  it('separa campos ausentes de formatos o incoherencias', () => {
    expect(splitSesValidationIssues([required, invalid])).toEqual({ missingFields: [required], invalidFields: [invalid] });
  });

  it('preserva cualquier corrección manual y registra el conflicto sin bloquear', () => {
    const result = mergeSesRentlyFields({
      existing: { vehicle_plate: 'MANUAL-1', vehicle_model: 'Anterior', payment_type: 'TARJT' },
      incoming: { vehicle_plate: 'RENTLY-2', vehicle_model: 'Actual', payment_type: 'DESTI' },
      manualFields: ['vehicle_plate'],
      derivedFields: ['payment_type'],
    });
    expect(result.values).toEqual({ vehicle_plate: 'MANUAL-1', vehicle_model: 'Actual', payment_type: 'DESTI' });
    expect(result.sourceByField).toEqual({ vehicle_plate: 'manual', vehicle_model: 'rently', payment_type: 'derived' });
    expect(result.syncConflicts).toEqual([expect.objectContaining({ field: 'vehicle_plate', existingValue: 'MANUAL-1', incomingValue: 'RENTLY-2' })]);
  });

  it('preserva el segundo conductor enlazado manualmente frente a otro valor de Rently', () => {
    const result = mergeSesRentlyFields({
      existing: { secondary_driver_profile_id: 'manual-driver' },
      incoming: { secondary_driver_profile_id: 'rently-driver' },
      manualFields: ['secondary_driver_profile_id'],
    });
    expect(result.values.secondary_driver_profile_id).toBe('manual-driver');
    expect(result.sourceByField.secondary_driver_profile_id).toBe('manual');
    expect(result.syncConflicts).toEqual([expect.objectContaining({ field: 'secondary_driver_profile_id' })]);
  });

  it('no borra un valor existente cuando Rently devuelve vacío', () => {
    expect(mergeSesRentlyFields({ existing: { vehicle_vin: 'SYNTHETICVIN00001' }, incoming: { vehicle_vin: null } }).values.vehicle_vin)
      .toBe('SYNTHETICVIN00001');
  });

  it('convierte la evidencia SES en aviso, no en puerta de disponibilidad', () => {
    expect(buildSesDuplicateWarning('blocked', ['accepted'])).toMatchObject({ level: 'warning' });
    expect(buildSesDuplicateWarning('review', ['annulled'])).toMatchObject({ level: 'warning' });
    expect(buildSesDuplicateWarning('not_checked', [])).toBeNull();
    expect(buildSesDuplicateWarning('clear', [])).toBeNull();
  });

  it('expone el contrato mínimo operativo sin borrar los campos históricos', () => {
    const result = projectSesOperationalDraft({
      id: 'synthetic', status: 'needs_revision', validation_errors: [required],
      manual_fields: ['vehicle_plate'], official_check_status: 'blocked',
      eligibility_snapshot: { official_reasons: ['accepted'], sync_conflicts: [{ field: 'vehicle_plate' }] },
      holder: { first_name: 'Persona', manual_fields: ['first_name'] },
    });
    expect(result).toMatchObject({
      operationalStatus: 'incomplete', readyForXml: false,
      missingFields: [required], invalidFields: [],
      sourceByField: { vehicle_plate: 'manual', 'holder.first_name': 'manual' },
      syncConflicts: [{ field: 'vehicle_plate' }],
      sesDuplicateWarning: { level: 'warning' },
    });
  });

  it('no duplica un mismo pendiente cuando titular y conductor son el mismo perfil', () => {
    const duplicated = [
      { path: 'holder.birth_date', code: 'required' as const, message: 'Falta nacimiento' },
      { path: 'primary_driver.birth_date', code: 'required' as const, message: 'Falta nacimiento' },
      { path: 'primary_driver.licence_number', code: 'required' as const, message: 'Falta permiso' },
    ];
    expect(dedupeSharedPersonIssues(duplicated, true)).toHaveLength(2);
    expect(dedupeSharedPersonIssues(duplicated, false)).toHaveLength(3);
  });
});
