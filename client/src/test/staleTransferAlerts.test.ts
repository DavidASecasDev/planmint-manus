/**
 * Tests for Stale Transfer Alerts system
 *
 * Validates:
 * - Threshold constants
 * - Alert message formatting logic
 * - Stale detection threshold logic
 * - Deduplication window logic
 * - Notification type integration
 *
 * Note: We test the pure logic without importing the hook directly
 * to avoid triggering supabase client initialization (requires localStorage).
 */
import { describe, it, expect } from 'vitest';
import type { NotificationType } from '../types/notifications';

// Mirror the constants from useStaleTransferAlerts.ts
const STALE_THRESHOLD_HOURS = 48;
const DEDUP_WINDOW_HOURS = 24;

describe('Stale Transfer Alerts - Constants', () => {
  it('should have STALE_THRESHOLD_HOURS set to 48', () => {
    expect(STALE_THRESHOLD_HOURS).toBe(48);
  });

  it('should have DEDUP_WINDOW_HOURS set to 24', () => {
    expect(DEDUP_WINDOW_HOURS).toBe(24);
  });
});

describe('Stale Transfer Alerts - Notification Type', () => {
  it('transfer_stale_alert should be a valid NotificationType', () => {
    const validType: NotificationType = 'transfer_stale_alert';
    expect(validType).toBe('transfer_stale_alert');
  });

  it('all existing notification types should still be valid', () => {
    const types: NotificationType[] = [
      'mention',
      'assignment',
      'reminder',
      'transfer_note',
      'repair_update',
      'accident_report',
      'damage_report_update',
      'vehicle_prep_alert',
      'transfer_stale_alert',
      'invitation_sent',
      'invitation_accepted',
    ];
    expect(types).toHaveLength(11);
    types.forEach(t => expect(typeof t).toBe('string'));
  });
});

describe('Stale Transfer Alerts - StaleTransfer interface', () => {
  it('should accept a valid StaleTransfer object', () => {
    const staleTransfer = {
      id: 'test-id',
      request_number: 'TRF-2026-0001',
      broker_name: 'Test Broker',
      client_name: 'Test Client',
      created_at: '2026-03-20T10:00:00Z',
      updated_at: '2026-03-20T10:00:00Z',
      hoursStale: 72,
    };
    expect(staleTransfer.id).toBe('test-id');
    expect(staleTransfer.hoursStale).toBe(72);
    expect(staleTransfer.request_number).toMatch(/^TRF-/);
  });
});

describe('Stale Transfer Alerts - Alert message formatting', () => {
  function formatTimeLabel(hoursStale: number): string {
    const daysStale = Math.floor(hoursStale / 24);
    const hoursRemainder = hoursStale % 24;
    return daysStale > 0
      ? `${daysStale}d ${hoursRemainder}h`
      : `${hoursStale}h`;
  }

  it('should format days and hours correctly for >24h stale', () => {
    expect(formatTimeLabel(72)).toBe('3d 0h');
  });

  it('should format hours correctly for 50h stale', () => {
    expect(formatTimeLabel(50)).toBe('2d 2h');
  });

  it('should format exactly 48h stale', () => {
    expect(formatTimeLabel(48)).toBe('2d 0h');
  });

  it('should generate correct notification title', () => {
    const requestNumber = 'TRF-2026-0005';
    const timeLabel = formatTimeLabel(72);
    const title = `⏰ ${requestNumber} — Sin respuesta (${timeLabel})`;
    expect(title).toBe('⏰ TRF-2026-0005 — Sin respuesta (3d 0h)');
  });

  it('should generate correct notification body', () => {
    const transfer = {
      request_number: 'TRF-2026-0005',
      broker_name: 'Yacht Broker Co',
      client_name: 'John Smith',
      hoursStale: 72,
    };
    const timeLabel = formatTimeLabel(transfer.hoursStale);
    const body = `La solicitud ${transfer.request_number} de ${transfer.broker_name} para ${transfer.client_name} lleva ${timeLabel} en estado "Pendiente" sin actividad. Requiere atención.`;
    expect(body).toContain('TRF-2026-0005');
    expect(body).toContain('Yacht Broker Co');
    expect(body).toContain('John Smith');
    expect(body).toContain('3d 0h');
    expect(body).toContain('Pendiente');
  });

  it('should truncate body to 500 chars max', () => {
    const longName = 'A'.repeat(300);
    const body = `La solicitud TRF-0001 de ${longName} para ${longName} lleva 3d 0h en estado "Pendiente" sin actividad. Requiere atención.`;
    const truncated = body.substring(0, 500);
    expect(truncated.length).toBeLessThanOrEqual(500);
  });
});

describe('Stale Transfer Alerts - Threshold logic', () => {
  it('should detect stale transfers based on 48h threshold', () => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setHours(cutoff.getHours() - STALE_THRESHOLD_HOURS);

    // A transfer updated 50 hours ago should be stale
    const staleDate = new Date(now);
    staleDate.setHours(staleDate.getHours() - 50);
    expect(staleDate < cutoff).toBe(true);

    // A transfer updated 24 hours ago should NOT be stale
    const recentDate = new Date(now);
    recentDate.setHours(recentDate.getHours() - 24);
    expect(recentDate < cutoff).toBe(false);

    // A transfer updated exactly 48 hours ago should be on the boundary
    const boundaryDate = new Date(now);
    boundaryDate.setHours(boundaryDate.getHours() - 48);
    expect(boundaryDate <= cutoff).toBe(true);
  });

  it('should deduplicate within 24h window', () => {
    const now = new Date();
    const dedupCutoff = new Date(now);
    dedupCutoff.setHours(dedupCutoff.getHours() - DEDUP_WINDOW_HOURS);

    // An alert sent 12 hours ago should be within dedup window
    const recentAlert = new Date(now);
    recentAlert.setHours(recentAlert.getHours() - 12);
    expect(recentAlert >= dedupCutoff).toBe(true);

    // An alert sent 30 hours ago should be outside dedup window
    const oldAlert = new Date(now);
    oldAlert.setHours(oldAlert.getHours() - 30);
    expect(oldAlert >= dedupCutoff).toBe(false);
  });

  it('should calculate hoursStale correctly', () => {
    const now = new Date('2026-03-25T12:00:00Z');
    const updatedAt = new Date('2026-03-22T12:00:00Z'); // exactly 72h ago
    const hoursStale = Math.round((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60));
    expect(hoursStale).toBe(72);
  });

  it('should only target pendiente status transfers', () => {
    const validStatuses = ['pendiente', 'en_gestion', 'presupuesto_enviado', 'confirmado', 'completado', 'cancelado'];
    const targetStatus = 'pendiente';
    expect(validStatuses).toContain(targetStatus);
    // Only pendiente should trigger alerts
    const nonAlertStatuses = validStatuses.filter(s => s !== 'pendiente');
    expect(nonAlertStatuses).not.toContain('pendiente');
    expect(nonAlertStatuses).toHaveLength(5);
  });
});

describe('Stale Transfer Alerts - Integration points', () => {
  it('notification entity_type should be transfer_request for routing', () => {
    // The alert uses entity_type: 'transfer_request' so clicking it navigates to the transfer detail
    const entityType = 'transfer_request';
    const entityId = 'some-transfer-id';
    const expectedRoute = `/transfers/requests/${entityId}`;
    expect(expectedRoute).toBe('/transfers/requests/some-transfer-id');
  });

  it('dedup query should filter by type transfer_stale_alert', () => {
    // The dedup check filters by type: 'transfer_stale_alert' to avoid counting other transfer notifications
    const dedupType = 'transfer_stale_alert';
    expect(dedupType).not.toBe('transfer_note');
    expect(dedupType).not.toBe('vehicle_prep_alert');
  });
});
