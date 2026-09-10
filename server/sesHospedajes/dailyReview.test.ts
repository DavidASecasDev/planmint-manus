import { describe, expect, it } from 'vitest';
import {
  advanceSesReviewCursor,
  analyzeSesIdentityLicenceContradictions,
  assertSesReviewProposalTarget,
  buildSesReviewProgress,
  canApplySesReviewField,
  classifyDeliveryForPeriod,
  classifyDeliveryForReview,
  compareSesDeliveryEvidenceTimestamps,
  dedupeDeliveryCandidates,
  deriveSesReviewBatchStatus,
  evaluateSesPickupAtMigration,
  evaluateSesReviewFieldUpdate,
  evaluateSesReviewCoverageGuarantee,
  getMadridDayRange,
  getMadridPeriodRange,
  getSesReviewConflictKey,
  isSesReviewConflictOpen,
  isSesReviewItemRetryable,
  mergeSesReviewItemHistory,
  missingSesReviewSources,
  normalizeRentlyDateTimeForStorage,
  planSesReviewProposalApplication,
  projectSesDraftPersistence,
  previousMadridDate,
  resolveSesReviewConflictHistory,
  shiftSesReviewDate,
  shouldRediscoverSesReview,
} from './dailyReview';

describe('SES daily review domain', () => {
  it('uses the real delivery date for synthetic case 5578 even when FromDate differs', () => {
    const result = classifyDeliveryForReview({
      bookingId: 5578,
      plannedFromAt: '2026-09-09T18:00:00',
      actualDeliveryAt: '2026-09-09T17:56:39.05',
      evidenceReference: 'Delivery 5578.pdf',
      evidenceGeneratedAt: '2026-09-09T17:56:39',
    }, '2026-09-09');
    expect(result).toMatchObject({
      include: true,
      status: 'verified_delivery',
      plannedDate: '2026-09-09',
      actualDeliveryAt: '2026-09-09T17:56:39.05',
      evidenceGeneratedAt: '2026-09-09T17:56:39',
    });
  });

  it('keeps synthetic case 5582 in the previous day by DeliveryInfo even when FromDate is the next day', () => {
    const result = classifyDeliveryForReview({
      bookingId: 5582,
      plannedFromAt: '2026-09-10T10:00:00',
      actualDeliveryAt: '2026-09-09T23:05:19.643',
      actualDropoffAt: '2026-09-12T10:00:00',
    }, '2026-09-09');
    expect(result.include).toBe(true);
    expect(result).toMatchObject({
      status: 'missing_delivery_evidence',
      plannedDate: '2026-09-10',
      actualDeliveryAt: '2026-09-09T23:05:19.643',
      actualDropoffAt: '2026-09-12T10:00:00',
    });
  });

  it('keeps missing or contradictory evidence pending instead of calling data absent', () => {
    expect(classifyDeliveryForReview({ bookingId: 1 }, '2026-09-09')).toMatchObject({
      include: false, status: 'missing_delivery_evidence', actualDeliveryAt: null,
    });
    expect(classifyDeliveryForReview({ bookingId: 2, actualDeliveryAt: '2026-09-08T08:00:00Z' }, '2026-09-09'))
      .toMatchObject({ include: false, status: 'date_mismatch' });
    expect(classifyDeliveryForReview({ bookingId: 3, actualDeliveryAt: '2026-09-09T08:00:00Z' }, '2026-09-09'))
      .toMatchObject({ include: true, status: 'missing_delivery_evidence', evidenceReference: null });
  });

  it('classifies every real delivery date inside an explicit historical period', () => {
    const historical = classifyDeliveryForPeriod({
      bookingId: 7001,
      actualDeliveryAt: '2026-09-03T11:00:00',
      evidenceReference: 'Delivery 7001.pdf',
      evidenceGeneratedAt: '2026-09-03T11:00:00',
    }, '2026-09-01', '2026-09-09');
    expect(historical).toMatchObject({ include: true, status: 'verified_delivery' });
  });

  it('excludes an accredited delivery outside the period without treating it as missing or contradictory', () => {
    const outside = classifyDeliveryForPeriod({
      bookingId: 5582,
      plannedFromAt: '2026-09-10T10:00:00',
      actualDeliveryAt: '2026-09-09T23:05:19.643',
      evidenceReference: 'Delivery 5582.pdf',
      evidenceGeneratedAt: '2026-09-09T23:05:19',
    }, '2026-09-10', '2026-09-10');
    expect(outside).toMatchObject({ include: false, status: 'outside_period', actualDeliveryAt: '2026-09-09T23:05:19.643', evidenceReference: 'Delivery 5582.pdf' });
    expect(outside.reason).toContain('fuera del periodo');
  });

  it('accepts second-rounded visible generation but preserves and flags temporal discrepancies', () => {
    expect(compareSesDeliveryEvidenceTimestamps(
      '2026-09-09T17:56:39.05',
      '2026-09-09T17:56:39',
    )).toEqual({ consistent: true, comparable: true, driftMs: 50 });

    const conflict = classifyDeliveryForReview({
      bookingId: 9001,
      actualDeliveryAt: '2026-09-09T17:56:39.050',
      evidenceReference: 'Delivery 9001.pdf',
      evidenceGeneratedAt: '2026-09-10T17:56:39',
    }, '2026-09-09');
    expect(conflict).toMatchObject({
      include: true,
      status: 'evidence_conflict',
      actualDeliveryAt: '2026-09-09T17:56:39.050',
      evidenceGeneratedAt: '2026-09-10T17:56:39',
      evidenceDriftMs: 86_399_950,
    });
  });

  it('computes Europe/Madrid day bounds correctly across daylight saving changes', () => {
    expect(getMadridDayRange('2026-03-29')).toEqual({
      start: '2026-03-28T23:00:00.000Z', end: '2026-03-29T22:00:00.000Z',
    });
    expect(getMadridDayRange('2026-10-25')).toEqual({
      start: '2026-10-24T22:00:00.000Z', end: '2026-10-25T23:00:00.000Z',
    });
    expect(previousMadridDate(new Date('2026-09-10T01:00:00Z'))).toBe('2026-09-09');
    expect(shiftSesReviewDate('2026-03-29', 1)).toBe('2026-03-30');
    expect(getMadridPeriodRange('2026-03-28', '2026-03-29')).toEqual({
      start: '2026-03-27T23:00:00.000Z', end: '2026-03-29T22:00:00.000Z',
    });
  });

  it('deduplicates every paginated candidate without trusting a widget total', () => {
    const pages = [
      Array.from({ length: 100 }, (_, index) => ({ bookingId: index + 1 })),
      Array.from({ length: 100 }, (_, index) => ({ bookingId: index + 101 })),
      Array.from({ length: 6 }, (_, index) => ({ bookingId: index + 200 })),
    ];
    const result = dedupeDeliveryCandidates(pages);
    expect(result).toHaveLength(205);
    expect(result.at(-1)?.bookingId).toBe(205);
    expect(advanceSesReviewCursor({ cursor: { sourceIndex: 0, offset: 0 }, pageLength: 100, pageSize: 100 }))
      .toEqual({ cursor: { sourceIndex: 0, offset: 100 }, complete: false });
    expect(advanceSesReviewCursor({ cursor: { sourceIndex: 2, offset: 200 }, pageLength: 5, pageSize: 100 }))
      .toEqual({ cursor: { sourceIndex: 3, offset: 0 }, complete: true });
  });

  it('never overwrites a protected manual field and ignores empty incoming values', () => {
    expect(canApplySesReviewField({ field: 'vehicle_plate', manualFields: ['vehicle_plate'], currentValue: '1234ABC', incomingValue: '9999XYZ' })).toBe(false);
    expect(canApplySesReviewField({ field: 'payment_type', manualFields: [], currentValue: 'TARJT', incomingValue: '' })).toBe(false);
    expect(canApplySesReviewField({ field: 'payment_type', manualFields: [], currentValue: null, incomingValue: 'TARJT' })).toBe(true);
    expect(canApplySesReviewField({ field: 'vehicle_brand', manualFields: [], currentValue: 'BMW', incomingValue: 'MINI' })).toBe(false);
    expect(evaluateSesReviewFieldUpdate({
      field: 'vehicle_brand', manualFields: [], currentValue: 'BMW', incomingValue: 'MINI',
    })).toEqual({
      action: 'conflict',
      conflict: { field: 'vehicle_brand', currentValue: 'BMW', proposedValue: 'MINI', protectedManual: false },
    });
    expect(evaluateSesReviewFieldUpdate({
      field: 'vehicle_plate', manualFields: ['vehicle_plate'], currentValue: '1234ABC', incomingValue: '9999XYZ',
    }).action).toBe('conflict');
  });

  it('migrates the existing 5582-style planned pickup only when automatic provenance is demonstrated', () => {
    expect(evaluateSesPickupAtMigration({
      currentPickupAt: '2026-09-10T12:00:00',
      reservationPlannedAt: '2026-09-10T12:00:00',
      rentlyPlannedAt: '2026-09-10T10:00:00',
      actualDeliveryAt: '2026-09-09T23:05:19.643',
      manualFields: [],
    })).toMatchObject({ action: 'apply_actual_delivery', provedBy: 'planned_value_match' });
    expect(evaluateSesPickupAtMigration({
      currentPickupAt: '2026-09-10T12:00:00',
      reservationPlannedAt: '2026-09-10T12:00:00',
      actualDeliveryAt: '2026-09-09T23:05:19.643',
      manualFields: ['pickup_at'],
    })).toMatchObject({ action: 'conflict', reason: 'manual' });
    expect(evaluateSesPickupAtMigration({
      currentPickupAt: '2026-09-10T11:15:00',
      reservationPlannedAt: '2026-09-10T12:00:00',
      rentlyPlannedAt: '2026-09-10T10:00:00',
      actualDeliveryAt: '2026-09-09T23:05:19.643',
      manualFields: [],
    })).toMatchObject({ action: 'conflict', reason: 'unknown_provenance' });
  });

  it('corrects a shifted inherited planned return only when automatic provenance is demonstrated', () => {
    expect(evaluateSesPickupAtMigration({
      field: 'return_at', currentPickupAt: '2026-09-10T18:00:00.000Z',
      rentlyPlannedAt: '2026-09-10T16:00:00.000Z', actualDeliveryAt: '2026-09-10T16:00:00.000Z',
      currentSource: 'rently_planned', manualFields: [],
    })).toMatchObject({ action: 'apply_actual_delivery', provedBy: 'source' });
    expect(evaluateSesPickupAtMigration({
      field: 'return_at', currentPickupAt: '2026-09-10T18:00:00.000Z',
      rentlyPlannedAt: '2026-09-10T16:00:00.000Z', actualDeliveryAt: '2026-09-10T16:00:00.000Z',
      currentSource: null, manualFields: ['return_at'],
    })).toMatchObject({ action: 'conflict', reason: 'manual' });
  });

  it('flags the pre-existing 5582-style identity and licence contradictions without inferring a licence', () => {
    const result = analyzeSesIdentityLicenceContradictions({
      current: {
        document_type: 'OTRO', document_number: 'P123456A',
        first_name: 'NOMBRE COMPLETO', first_surname: 'NOMBRE COMPLETO',
        licence_number: 'P123456A', licence_type: null,
      },
      proposed: {
        document_type: 'PAS', document_number: 'P123456B',
        first_name: 'NOMBRE', first_surname: 'APELLIDO', licence_number: 'LIC-9000',
      },
      source: 'hubspot',
      manualFields: ['document_number'],
    });
    expect(result.blocksReadyForXml).toBe(true);
    expect(result.missingFields).toContain('licence_type');
    expect(result.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'document_type', code: 'accredited_value_mismatch', source: 'hubspot' }),
      expect.objectContaining({ field: 'first_surname', code: 'duplicated_full_name' }),
      expect.objectContaining({ field: 'licence_number', code: 'identity_document_copied_as_licence', proposedValue: 'LIC-9000' }),
      expect.objectContaining({ field: 'document_number', code: 'single_character_document_mismatch', protectedManual: true }),
    ]));
    const noLicenceProposal = analyzeSesIdentityLicenceContradictions({
      current: { document_type: 'OTRO', document_number: 'P123456A', licence_number: 'P123456A' },
      proposed: { document_type: 'PAS', document_number: 'P123456B' },
      source: 'rently',
    });
    expect(noLicenceProposal.conflicts.find((conflict) => conflict.field === 'licence_number')?.proposedValue).toBeNull();
  });

  it('projects only persisted draft columns and verifies typed proposal targets', () => {
    expect(projectSesDraftPersistence({
      id: 'draft-1', reference: '5582', pickup_at: '2026-09-09T21:05:19.643Z',
      holder: { id: 'person-1' }, reservation: { id: 'reservation-1' }, unknown: 'discarded',
    })).toEqual({ id: 'draft-1', reference: '5582', pickup_at: '2026-09-09T21:05:19.643Z' });
    const draft = {
      id: 'draft-1', holder_profile_id: 'person-1', primary_driver_profile_id: 'person-1',
      secondary_driver_profile_id: null, pickup_location_id: 'pickup-1', return_location_id: 'return-1',
    };
    expect(assertSesReviewProposalTarget({ targetType: 'person', targetId: 'person-1', draft })).toContain('licence_number');
    expect(assertSesReviewProposalTarget({ targetType: 'pickup_location', targetId: 'pickup-1', draft })).toContain('postal_code');
    expect(() => assertSesReviewProposalTarget({ targetType: 'return_location', targetId: 'pickup-1', draft })).toThrow('no está vinculado');
  });

  it('applies proposal values only to empty allowed fields and returns every discrepancy', () => {
    expect(planSesReviewProposalApplication({
      currentValues: { vehicle_brand: 'BMW', vehicle_vin: null, vehicle_plate: '1234ABC' },
      proposedValues: { vehicle_brand: 'MINI', vehicle_vin: 'VIN123', vehicle_plate: '9999XYZ', unexpected: 'no' },
      manualFields: ['vehicle_plate'],
      allowedFields: ['vehicle_brand', 'vehicle_vin', 'vehicle_plate'],
    })).toEqual({
      appliedChanges: { vehicle_vin: 'VIN123' },
      conflicts: [
        { field: 'vehicle_brand', currentValue: 'BMW', proposedValue: 'MINI', protectedManual: false },
        { field: 'vehicle_plate', currentValue: '1234ABC', proposedValue: '9999XYZ', protectedManual: true },
      ],
      ignoredFields: ['unexpected'],
    });
  });

  it('fills an empty address but keeps an obsolete copied licence as an explicit conflict on an existing person', () => {
    const currentPerson = {
      document_type: 'OTRO', document_number: 'P123456A', first_name: 'NOMBRE COMPLETO',
      first_surname: 'NOMBRE COMPLETO', address_line: null, postal_code: null,
      licence_number: 'P123456A', manual_fields: ['document_number'],
    };
    const proposed = {
      document_type: 'PAS', document_number: 'P123456B', first_name: 'NOMBRE', first_surname: 'APELLIDO',
      address_line: 'CALLE SINTÉTICA', postal_code: '07000', licence_number: 'LIC-9000', licence_valid_until: '2030-01-01',
    };
    const plan = planSesReviewProposalApplication({
      currentValues: currentPerson,
      proposedValues: proposed,
      manualFields: currentPerson.manual_fields,
      allowedFields: assertSesReviewProposalTarget({
        targetType: 'person', targetId: 'person-1',
        draft: { id: 'draft-1', holder_profile_id: 'person-1', primary_driver_profile_id: 'person-1' },
      }),
    });
    const identity = analyzeSesIdentityLicenceContradictions({
      current: currentPerson, proposed, source: 'hubspot', manualFields: currentPerson.manual_fields,
    });
    expect(plan.appliedChanges).toMatchObject({ address_line: 'CALLE SINTÉTICA', postal_code: '07000', licence_valid_until: '2030-01-01' });
    expect(plan.appliedChanges).not.toHaveProperty('licence_number');
    expect([...plan.conflicts, ...identity.conflicts]).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'licence_number', currentValue: 'P123456A', proposedValue: 'LIC-9000' }),
      expect.objectContaining({ field: 'document_number', protectedManual: true }),
    ]));
  });

  it('normalizes planned and actual return literals in Madrid without adding a default Z', () => {
    expect(normalizeRentlyDateTimeForStorage('2026-09-10T18:00:00')).toEqual({
      literal: '2026-09-10T18:00:00', normalizedAt: '2026-09-10T16:00:00.000Z', status: 'madrid_local',
    });
    expect(evaluateSesPickupAtMigration({
      field: 'return_at', currentPickupAt: '2026-09-10T18:00:00',
      reservationPlannedAt: '2026-09-10T18:00:00', actualDeliveryAt: '2026-09-10T20:05:00', manualFields: [],
    })).toMatchObject({ action: 'apply_actual_delivery', provedBy: 'planned_value_match' });
  });

  it('preserves historical item changes and initializes only missing sources on repeated processing', () => {
    expect(mergeSesReviewItemHistory({
      existingApplied: { vehicle_vin: 'VIN-OLD' },
      existingProposed: { vehicle_brand: 'MINI' },
      existingConflicts: [{ field: 'vehicle_brand', currentValue: 'BMW', proposedValue: 'MINI' }],
      incomingApplied: { km_pickup: 123 },
      incomingProposed: { payment_type: 'TARJT' },
      incomingConflicts: [{ field: 'vehicle_brand', currentValue: 'BMW', proposedValue: 'MINI' }],
    })).toEqual({
      appliedChanges: { vehicle_vin: 'VIN-OLD', km_pickup: 123 },
      proposedChanges: { vehicle_brand: 'MINI', payment_type: 'TARJT' },
      conflicts: [{
        field: 'vehicle_brand', currentValue: 'BMW', proposedValue: 'MINI',
        conflictKey: '[null,null,"vehicle_brand",null,"BMW","MINI",null,null]', status: 'open',
      }],
    });
    expect(missingSesReviewSources(['rently', 'hubspot'])).toEqual(['respond', 'document']);
    expect(missingSesReviewSources(['rently', 'hubspot', 'respond', 'document'])).toEqual([]);
  });

  it('resolves a corrected conflict with audit metadata and does not revive it without new evidence', () => {
    const incoming = {
      targetType: 'person', targetId: '10000000-0000-4000-8000-000000000001',
      field: 'licence_number', code: 'accredited_value_mismatch',
      currentValue: 'OLD-001', proposedValue: 'NEW-001', source: 'hubspot', evidenceReference: 'HS-1',
    };
    const initial = mergeSesReviewItemHistory({ incomingConflicts: [incoming] });
    const conflictKey = getSesReviewConflictKey(incoming);
    const resolved = resolveSesReviewConflictHistory({
      conflicts: initial.conflicts, conflictKey, currentValue: 'NEW-001',
      actorId: '20000000-0000-4000-8000-000000000001', reason: 'Permiso comprobado',
      evidenceReference: 'HS-1', resolvedAt: '2026-09-10T12:00:00.000Z',
    });
    expect(resolved.openConflicts).toEqual([]);
    expect(resolved.conflicts[0]).toMatchObject({
      conflictKey, status: 'resolved', resolvedValue: 'NEW-001',
      resolutionReason: 'Permiso comprobado', resolutionEvidenceReference: 'HS-1',
    });
    const resumed = mergeSesReviewItemHistory({ existingConflicts: resolved.conflicts, incomingConflicts: [incoming] });
    expect(resumed.conflicts).toHaveLength(1);
    expect(resumed.conflicts.filter(isSesReviewConflictOpen)).toHaveLength(0);
    const newEvidence = mergeSesReviewItemHistory({
      existingConflicts: resolved.conflicts,
      incomingConflicts: [{ ...incoming, proposedValue: 'NEW-002', evidenceReference: 'HS-2' }],
    });
    expect(newEvidence.conflicts.filter(isSesReviewConflictOpen)).toHaveLength(1);
  });

  it('normalizes naive Rently time only with explicit Madrid semantics while preserving the literal', () => {
    expect(normalizeRentlyDateTimeForStorage('2026-09-09T23:05:19.643')).toEqual({
      literal: '2026-09-09T23:05:19.643', normalizedAt: '2026-09-09T21:05:19.643Z', status: 'madrid_local',
    });
    expect(normalizeRentlyDateTimeForStorage('2026-09-09T17:56:39.05')).toEqual({
      literal: '2026-09-09T17:56:39.05', normalizedAt: '2026-09-09T15:56:39.050Z', status: 'madrid_local',
    });
    expect(normalizeRentlyDateTimeForStorage('2026-03-29T02:30:00')).toMatchObject({
      literal: '2026-03-29T02:30:00', normalizedAt: null, status: 'nonexistent_local_time',
    });
    expect(normalizeRentlyDateTimeForStorage('2026-10-25T02:30:00')).toMatchObject({
      literal: '2026-10-25T02:30:00', normalizedAt: null, status: 'ambiguous_local_time',
    });
  });

  it('does not declare full coverage while pages or sources remain pending', () => {
    expect(buildSesReviewProgress({ phase: 'discover_deliveries', discovered: 100, processed: 100, total: 205, cursor: 100, pagesComplete: false }).coverageComplete).toBe(false);
    expect(deriveSesReviewBatchStatus({ pagesComplete: true, unresolvedItems: 0, sources: [{ status: 'inaccessible' }] })).toBe('partial');
    expect(deriveSesReviewBatchStatus({ pagesComplete: true, unresolvedItems: 0, sources: [{ status: 'consulted' }] })).toBe('completed');
    const incomplete = evaluateSesReviewCoverageGuarantee({
      syncStatus: 'completed', coverageVersion: 'sync-v1', coverageScope: { paginationComplete: true }, periodEnd: '2026-09-09T22:00:00Z',
    });
    expect(incomplete.complete).toBe(false);
    expect(incomplete.reason).toContain('listado oficial');
    expect(shouldRediscoverSesReview({
      pagesComplete: true,
      coverageComplete: true,
      previousCoverageToken: 'sync-v1',
      currentCoverageToken: 'sync-v2',
    })).toBe(true);
    expect(evaluateSesReviewCoverageGuarantee({
      syncStatus: 'completed', coverageVersion: 'sync-v2', coverageScope: {
        sourceEndpoint: '/api/bookings/list', allBranches: true, allStatuses: true,
        paginationComplete: true, paginationStartOffset: 0, nextOffset: null,
        unfilteredDateWindow: true, bookingListEventsComplete: true,
        deliveryEventsComplete: true, dropoffEventsComplete: true,
        coveredThrough: '2026-09-10T04:00:00Z',
      }, periodEnd: '2026-09-09T22:00:00Z',
    }).complete).toBe(true);
    expect(evaluateSesReviewCoverageGuarantee({
      syncStatus: 'completed', coverageVersion: 'sync-v3', coverageScope: {
        sourceEndpoint: '/api/bookings/list', allBranches: true, allStatuses: true,
        paginationComplete: true, paginationStartOffset: 0, nextOffset: null,
        unfilteredDateWindow: true, bookingListEventsComplete: false,
        deliveryEventsComplete: true, dropoffEventsComplete: true,
        coveredThrough: '2026-09-10T04:00:00Z',
      }, periodEnd: '2026-09-09T22:00:00Z',
    })).toMatchObject({ complete: false, reason: expect.stringContaining('eventos') });
  });

  it('retries expired failures and newly accredited evidence without requiring cursor reset', () => {
    expect(isSesReviewItemRetryable({
      status: 'failed', nextRetryAt: '2026-09-10T03:59:59Z', now: Date.parse('2026-09-10T04:00:00Z'),
    })).toBe(true);
    expect(isSesReviewItemRetryable({
      status: 'failed', nextRetryAt: '2026-09-10T04:01:00Z', now: Date.parse('2026-09-10T04:00:00Z'),
    })).toBe(false);
    expect(isSesReviewItemRetryable({
      status: 'missing_delivery_evidence', evidenceReference: 'Delivery 5582.pdf', evidenceGeneratedLiteral: '2026-09-09T23:05:19',
    })).toBe(true);
    expect(isSesReviewItemRetryable({ status: 'missing_delivery_evidence' })).toBe(false);
  });
});
