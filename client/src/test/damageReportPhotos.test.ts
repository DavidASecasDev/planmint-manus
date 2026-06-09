import { describe, it, expect } from 'vitest';
import type { DamageReport, DamageReportFormData } from '../types/garatech';

describe('Damage Report Photos - Types and Data', () => {
  it('DamageReportFormData should include photos_before and photos_after fields', () => {
    const form: DamageReportFormData = {
      vehicle_id: 'vehicle-123',
      damage_date: '2026-06-09',
      customer_name: 'Test Client',
      customer_document: 'ABC123',
      notes: 'Test notes',
      photos_before: ['https://example.com/before1.jpg', 'https://example.com/before2.jpg'],
      photos_after: ['https://example.com/after1.jpg'],
    };

    expect(form.photos_before).toHaveLength(2);
    expect(form.photos_after).toHaveLength(1);
    expect(form.photos_before![0]).toContain('before1');
    expect(form.photos_after![0]).toContain('after1');
  });

  it('DamageReportFormData should work without photos (backward compatible)', () => {
    const form: DamageReportFormData = {
      vehicle_id: 'vehicle-123',
      damage_date: '2026-06-09',
    };

    // photos_before and photos_after are optional
    expect(form.photos_before).toBeUndefined();
    expect(form.photos_after).toBeUndefined();
  });

  it('DamageReport interface should include photos_before and photos_after', () => {
    const report: DamageReport = {
      id: 'report-1',
      organization_id: 'org-1',
      report_number: 'DR-001',
      damage_date: '2026-06-09',
      status: 'borrador',
      total_amount: 0,
      created_at: '2026-06-09T10:00:00Z',
      updated_at: '2026-06-09T10:00:00Z',
      photos_before: ['https://example.com/before.jpg'],
      photos_after: ['https://example.com/after.jpg'],
    };

    expect(report.photos_before).toHaveLength(1);
    expect(report.photos_after).toHaveLength(1);
  });

  it('DamageReport should handle null photos (existing reports without photos)', () => {
    const report: DamageReport = {
      id: 'report-2',
      organization_id: 'org-1',
      report_number: 'DR-002',
      damage_date: '2026-06-09',
      status: 'finalizado',
      total_amount: 150,
      created_at: '2026-06-09T10:00:00Z',
      updated_at: '2026-06-09T10:00:00Z',
      photos_before: null,
      photos_after: null,
    };

    expect(report.photos_before).toBeNull();
    expect(report.photos_after).toBeNull();
  });

  it('should correctly identify empty photo arrays vs null', () => {
    const reportWithEmpty: DamageReport = {
      id: 'report-3',
      organization_id: 'org-1',
      report_number: 'DR-003',
      damage_date: '2026-06-09',
      status: 'borrador',
      total_amount: 0,
      created_at: '2026-06-09T10:00:00Z',
      updated_at: '2026-06-09T10:00:00Z',
      photos_before: [],
      photos_after: [],
    };

    // Empty arrays should not trigger photo display
    const hasBeforePhotos = reportWithEmpty.photos_before && reportWithEmpty.photos_before.length > 0;
    const hasAfterPhotos = reportWithEmpty.photos_after && reportWithEmpty.photos_after.length > 0;

    expect(hasBeforePhotos).toBeFalsy();
    expect(hasAfterPhotos).toBeFalsy();
  });

  it('form data should spread correctly into insert payload', () => {
    const form: DamageReportFormData = {
      vehicle_id: 'vehicle-123',
      damage_date: '2026-06-09',
      photos_before: ['url1', 'url2'],
      photos_after: ['url3'],
    };

    const insertPayload = {
      ...form,
      organization_id: 'org-1',
      reported_by: 'user-1',
      status: 'borrador',
      report_number: '',
    };

    expect(insertPayload.photos_before).toEqual(['url1', 'url2']);
    expect(insertPayload.photos_after).toEqual(['url3']);
    expect(insertPayload.organization_id).toBe('org-1');
  });
});
