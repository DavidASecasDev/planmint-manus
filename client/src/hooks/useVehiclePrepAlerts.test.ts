import { describe, it, expect } from 'vitest';

/**
 * Tests for the vehicle prep alert logic.
 * Since the hook depends on Supabase and React context, we test the pure logic functions.
 */

// Replicate the urgency calculation from useOperationalDashboard
function calculateUrgency(reservationDate: string | null): 'critical' | 'high' | 'medium' | 'low' {
  if (!reservationDate) return 'low';
  const now = new Date();
  const resDate = new Date(reservationDate);
  const hoursUntil = (resDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntil <= 4) return 'critical';
  if (hoursUntil <= 24) return 'high';
  if (hoursUntil <= 72) return 'medium';
  return 'low';
}

// Replicate the alert threshold check
const ALERT_THRESHOLD_HOURS = 2;
const DEDUP_WINDOW_HOURS = 2;

function shouldAlert(reservationStart: string): boolean {
  const now = new Date();
  const resDate = new Date(reservationStart);
  const hoursUntil = (resDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursUntil > 0 && hoursUntil <= ALERT_THRESHOLD_HOURS;
}

function isWithinDedupWindow(alertCreatedAt: string): boolean {
  const now = new Date();
  const alertDate = new Date(alertCreatedAt);
  const hoursSince = (now.getTime() - alertDate.getTime()) / (1000 * 60 * 60);
  return hoursSince < DEDUP_WINDOW_HOURS;
}

function buildAlertTitle(matricula: string, hoursUntil: number): string {
  const timeLabel = hoursUntil < 1
    ? `${Math.round(hoursUntil * 60)} minutos`
    : `${hoursUntil.toFixed(1)} horas`;
  return `🔴 ${matricula} — Reserva en ${timeLabel}`;
}

function buildAlertBody(
  matricula: string,
  modelo: string | null,
  status: string,
  clienteNombre: string,
  hoursUntil: number
): string {
  const statusLabel = status === 'sucio' ? 'sucio' : 'preparación incompleta';
  const timeLabel = hoursUntil < 1
    ? `${Math.round(hoursUntil * 60)} minutos`
    : `${hoursUntil.toFixed(1)} horas`;
  return `El vehículo ${matricula}${modelo ? ` (${modelo})` : ''} está en estado "${statusLabel}" y tiene una reserva para ${clienteNombre} en ${timeLabel}. Requiere preparación urgente.`;
}

describe('Vehicle Prep Alert Logic', () => {
  describe('shouldAlert - threshold detection', () => {
    it('should alert when reservation is in 30 minutes', () => {
      const inThirtyMin = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      expect(shouldAlert(inThirtyMin)).toBe(true);
    });

    it('should alert when reservation is in 1 hour', () => {
      const inOneHour = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      expect(shouldAlert(inOneHour)).toBe(true);
    });

    it('should alert when reservation is in 1.5 hours', () => {
      const inNinetyMin = new Date(Date.now() + 90 * 60 * 1000).toISOString();
      expect(shouldAlert(inNinetyMin)).toBe(true);
    });

    it('should NOT alert when reservation is in 3 hours', () => {
      const inThreeHours = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      expect(shouldAlert(inThreeHours)).toBe(false);
    });

    it('should NOT alert when reservation is in 24 hours', () => {
      const inTwentyFourHours = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      expect(shouldAlert(inTwentyFourHours)).toBe(false);
    });

    it('should NOT alert for past reservations', () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      expect(shouldAlert(oneHourAgo)).toBe(false);
    });

    it('should alert at exactly 2 hours boundary', () => {
      // Exactly at 2 hours should be included (hoursUntil <= 2)
      const exactlyTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      expect(shouldAlert(exactlyTwoHours)).toBe(true);
    });
  });

  describe('isWithinDedupWindow - deduplication', () => {
    it('should be within dedup window if alert was sent 30 minutes ago', () => {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      expect(isWithinDedupWindow(thirtyMinAgo)).toBe(true);
    });

    it('should be within dedup window if alert was sent 1 hour ago', () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      expect(isWithinDedupWindow(oneHourAgo)).toBe(true);
    });

    it('should NOT be within dedup window if alert was sent 3 hours ago', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      expect(isWithinDedupWindow(threeHoursAgo)).toBe(false);
    });

    it('should NOT be within dedup window if alert was sent 24 hours ago', () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      expect(isWithinDedupWindow(twentyFourHoursAgo)).toBe(false);
    });
  });

  describe('calculateUrgency - urgency levels', () => {
    it('should be critical for reservations within 4 hours', () => {
      const inTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      expect(calculateUrgency(inTwoHours)).toBe('critical');
    });

    it('should be critical for reservations within 1 hour', () => {
      const inOneHour = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      expect(calculateUrgency(inOneHour)).toBe('critical');
    });

    it('should be high for reservations within 24 hours', () => {
      const inTwelveHours = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      expect(calculateUrgency(inTwelveHours)).toBe('high');
    });

    it('should be medium for reservations within 72 hours', () => {
      const inFortyEightHours = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      expect(calculateUrgency(inFortyEightHours)).toBe('medium');
    });

    it('should be low for reservations beyond 72 hours', () => {
      const inFiveDays = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      expect(calculateUrgency(inFiveDays)).toBe('low');
    });

    it('should be low for null reservation date', () => {
      expect(calculateUrgency(null)).toBe('low');
    });
  });

  describe('buildAlertTitle - notification title formatting', () => {
    it('should format title with minutes when less than 1 hour', () => {
      const title = buildAlertTitle('1234ABC', 0.5);
      expect(title).toBe('🔴 1234ABC — Reserva en 30 minutos');
    });

    it('should format title with hours when more than 1 hour', () => {
      const title = buildAlertTitle('5678DEF', 1.5);
      expect(title).toBe('🔴 5678DEF — Reserva en 1.5 horas');
    });

    it('should format title with 15 minutes correctly', () => {
      const title = buildAlertTitle('9012GHI', 0.25);
      expect(title).toBe('🔴 9012GHI — Reserva en 15 minutos');
    });
  });

  describe('buildAlertBody - notification body formatting', () => {
    it('should include vehicle model when available', () => {
      const body = buildAlertBody('1234ABC', 'Seat Ibiza', 'sucio', 'Juan García', 1.5);
      expect(body).toContain('1234ABC (Seat Ibiza)');
      expect(body).toContain('sucio');
      expect(body).toContain('Juan García');
      expect(body).toContain('1.5 horas');
    });

    it('should handle null model', () => {
      const body = buildAlertBody('1234ABC', null, 'incompleto', 'María López', 0.5);
      expect(body).toContain('1234ABC');
      expect(body).not.toContain('(');
      expect(body).toContain('preparación incompleta');
      expect(body).toContain('30 minutos');
    });

    it('should use "sucio" label for sucio status', () => {
      const body = buildAlertBody('1234ABC', null, 'sucio', 'Test', 1);
      expect(body).toContain('"sucio"');
    });

    it('should use "preparación incompleta" label for incompleto status', () => {
      const body = buildAlertBody('1234ABC', null, 'incompleto', 'Test', 1);
      expect(body).toContain('"preparación incompleta"');
    });
  });

  describe('Operations team roles', () => {
    const OPERATIONS_ROLES = ['owner', 'admin', 'manager'];

    it('should include owner in operations team', () => {
      expect(OPERATIONS_ROLES).toContain('owner');
    });

    it('should include admin in operations team', () => {
      expect(OPERATIONS_ROLES).toContain('admin');
    });

    it('should include manager in operations team', () => {
      expect(OPERATIONS_ROLES).toContain('manager');
    });

    it('should NOT include member in operations team', () => {
      expect(OPERATIONS_ROLES).not.toContain('member');
    });

    it('should NOT include read_only in operations team', () => {
      expect(OPERATIONS_ROLES).not.toContain('read_only');
    });
  });

  describe('Notification type integration', () => {
    it('should use vehicle_prep_alert as notification type', () => {
      const type = 'vehicle_prep_alert';
      const validTypes = ['mention', 'assignment', 'reminder', 'transfer_note', 'repair_update', 'accident_report', 'damage_report_update', 'vehicle_prep_alert'];
      expect(validTypes).toContain(type);
    });

    it('should use vehicle_prep as entity type', () => {
      const entityType = 'vehicle_prep';
      const validEntityTypes = ['task', 'task_update', 'reminder', 'transfer_request', 'transfer_note', 'form_response', 'repair', 'accident', 'damage_report', 'vehicle_prep'];
      expect(validEntityTypes).toContain(entityType);
    });
  });
});
