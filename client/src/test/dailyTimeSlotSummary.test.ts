import { describe, it, expect } from 'vitest';

// ─── Helpers extracted from DailyTimeSlotSummary ───

function extractHour(isoStr: string): number | null {
  const match = isoStr.match(/T(\d{2}):\d{2}/);
  return match ? parseInt(match[1], 10) : null;
}

function extractTime(isoStr: string): string {
  const match = isoStr.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : '--:--';
}

function extractDatePart(isoStr: string): string | null {
  const match = isoStr.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function formatDayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const d = new Date(year, month - 1, day, 12, 0, 0);
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${dayNames[d.getDay()]} ${day} de ${monthNames[d.getMonth()]}`;
}

interface TimeSlot {
  id: string;
  label: string;
  startHour: number;
  endHour: number;
}

const TIME_SLOTS: TimeSlot[] = [
  { id: 'morning', label: 'Mañana', startHour: 6, endHour: 12 },
  { id: 'midday', label: 'Mediodía', startHour: 12, endHour: 16 },
  { id: 'evening', label: 'Tarde / Noche', startHour: 16, endHour: 24 },
];

function getSlotForHour(hour: number): TimeSlot | null {
  return TIME_SLOTS.find(s => hour >= s.startHour && hour < s.endHour) || null;
}

// ─── Tests ───

describe('DailyTimeSlotSummary helpers', () => {
  describe('extractHour', () => {
    it('extracts hour from ISO string with T separator', () => {
      expect(extractHour('2026-04-09T08:30:00+00:00')).toBe(8);
      expect(extractHour('2026-04-09T14:00:00+00:00')).toBe(14);
      expect(extractHour('2026-04-09T22:00:00+00:00')).toBe(22);
      expect(extractHour('2026-04-09T00:00:00+00:00')).toBe(0);
    });

    it('extracts hour from ISO string with space separator', () => {
      expect(extractHour('2026-04-09 08:30:00+00')).toBe(null); // no T separator
    });

    it('returns null for invalid strings', () => {
      expect(extractHour('invalid')).toBe(null);
      expect(extractHour('')).toBe(null);
    });
  });

  describe('extractTime', () => {
    it('extracts HH:MM from ISO string', () => {
      expect(extractTime('2026-04-09T08:30:00+00:00')).toBe('08:30');
      expect(extractTime('2026-04-09T14:00:00+00:00')).toBe('14:00');
      expect(extractTime('2026-04-09T22:45:00+00:00')).toBe('22:45');
    });

    it('returns --:-- for invalid strings', () => {
      expect(extractTime('invalid')).toBe('--:--');
      expect(extractTime('')).toBe('--:--');
    });
  });

  describe('extractDatePart', () => {
    it('extracts YYYY-MM-DD from ISO string', () => {
      expect(extractDatePart('2026-04-09T08:30:00+00:00')).toBe('2026-04-09');
      expect(extractDatePart('2026-04-13T22:00:00+00:00')).toBe('2026-04-13');
    });

    it('returns null for invalid strings', () => {
      expect(extractDatePart('invalid')).toBe(null);
      expect(extractDatePart('')).toBe(null);
    });
  });

  describe('formatDayLabel', () => {
    it('formats date key to Spanish day label', () => {
      // April 9, 2026 is a Thursday
      expect(formatDayLabel('2026-04-09')).toBe('Jueves 9 de Abril');
      // April 13, 2026 is a Monday
      expect(formatDayLabel('2026-04-13')).toBe('Lunes 13 de Abril');
      // April 14, 2026 is a Tuesday
      expect(formatDayLabel('2026-04-14')).toBe('Martes 14 de Abril');
    });
  });

  describe('Time slot assignment', () => {
    it('assigns morning slot for hours 6-11', () => {
      expect(getSlotForHour(6)?.id).toBe('morning');
      expect(getSlotForHour(8)?.id).toBe('morning');
      expect(getSlotForHour(11)?.id).toBe('morning');
    });

    it('assigns midday slot for hours 12-15', () => {
      expect(getSlotForHour(12)?.id).toBe('midday');
      expect(getSlotForHour(13)?.id).toBe('midday');
      expect(getSlotForHour(15)?.id).toBe('midday');
    });

    it('assigns evening slot for hours 16-23', () => {
      expect(getSlotForHour(16)?.id).toBe('evening');
      expect(getSlotForHour(19)?.id).toBe('evening');
      expect(getSlotForHour(22)?.id).toBe('evening');
      expect(getSlotForHour(23)?.id).toBe('evening');
    });

    it('returns null for hours before 6 (early morning)', () => {
      expect(getSlotForHour(0)).toBe(null);
      expect(getSlotForHour(3)).toBe(null);
      expect(getSlotForHour(5)).toBe(null);
    });

    it('boundary: hour 12 is midday not morning', () => {
      expect(getSlotForHour(12)?.id).toBe('midday');
    });

    it('boundary: hour 16 is evening not midday', () => {
      expect(getSlotForHour(16)?.id).toBe('evening');
    });
  });

  describe('Timezone-safe day grouping', () => {
    it('groups late-night UTC operations under the correct day', () => {
      // 22:00 UTC stored as 2026-04-13T22:00:00+00:00
      // Should stay under April 13, NOT shift to April 14
      const dateStr = '2026-04-13T22:00:00+00:00';
      const dayKey = extractDatePart(dateStr);
      expect(dayKey).toBe('2026-04-13');
    });

    it('groups 23:30 UTC operations under the correct day', () => {
      const dateStr = '2026-04-13T23:30:00+00:00';
      const dayKey = extractDatePart(dateStr);
      expect(dayKey).toBe('2026-04-13');
    });

    it('groups midnight operations under the correct day', () => {
      const dateStr = '2026-04-14T00:00:00+00:00';
      const dayKey = extractDatePart(dateStr);
      expect(dayKey).toBe('2026-04-14');
    });
  });

  describe('Confirmed datetime priority', () => {
    it('uses confirmed datetime when available for slot assignment', () => {
      // Original: 11:00 (morning), Confirmed: 12:50 (midday)
      const original = '2026-04-09T11:00:00+00:00';
      const confirmed = '2026-04-09T12:50:00+00:00';
      
      const dateStr = confirmed || original;
      const hour = extractHour(dateStr);
      expect(hour).toBe(12);
      expect(getSlotForHour(hour!)?.id).toBe('midday');
    });

    it('falls back to original datetime when no confirmed time', () => {
      const original = '2026-04-09T08:00:00+00:00';
      const confirmed = null;
      
      const dateStr = confirmed || original;
      const hour = extractHour(dateStr);
      expect(hour).toBe(8);
      expect(getSlotForHour(hour!)?.id).toBe('morning');
    });
  });

  describe('Multi-day grouping', () => {
    it('groups operations from different days separately', () => {
      const ops = [
        '2026-04-09T08:00:00+00:00',
        '2026-04-09T14:00:00+00:00',
        '2026-04-10T09:00:00+00:00',
        '2026-04-10T17:00:00+00:00',
      ];

      const byDay = new Map<string, string[]>();
      for (const op of ops) {
        const dayKey = extractDatePart(op);
        if (!dayKey) continue;
        if (!byDay.has(dayKey)) byDay.set(dayKey, []);
        byDay.get(dayKey)!.push(op);
      }

      expect(byDay.size).toBe(2);
      expect(byDay.get('2026-04-09')?.length).toBe(2);
      expect(byDay.get('2026-04-10')?.length).toBe(2);
    });

    it('sorts days chronologically', () => {
      const days = ['2026-04-11', '2026-04-09', '2026-04-10'];
      const sorted = days.sort();
      expect(sorted).toEqual(['2026-04-09', '2026-04-10', '2026-04-11']);
    });
  });
});
