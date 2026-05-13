import { describe, it, expect } from 'vitest';

// ─── Pure helper functions extracted for testing ────────────────────────────

function calcShiftHours(shift: { is_day_off: boolean; start_time: string | null; end_time: string | null } | null): number {
  if (!shift || shift.is_day_off || !shift.start_time || !shift.end_time) return 0;
  const [sh, sm] = shift.start_time.split(':').map(Number);
  const [eh, em] = shift.end_time.split(':').map(Number);
  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) endMin += 24 * 60;
  return (endMin - startMin) / 60;
}

function formatHours(h: number): string {
  if (h === 0) return '0h';
  if (Number.isInteger(h)) return `${h}h`;
  return `${h.toFixed(1)}h`;
}

function getWeekDates(weekOffset: number): Date[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDateISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('calcShiftHours', () => {
  it('returns 0 for null shift', () => {
    expect(calcShiftHours(null)).toBe(0);
  });

  it('returns 0 for day off', () => {
    expect(calcShiftHours({ is_day_off: true, start_time: '07:00', end_time: '15:00' })).toBe(0);
  });

  it('returns 0 when start_time is null', () => {
    expect(calcShiftHours({ is_day_off: false, start_time: null, end_time: '15:00' })).toBe(0);
  });

  it('returns 0 when end_time is null', () => {
    expect(calcShiftHours({ is_day_off: false, start_time: '07:00', end_time: null })).toBe(0);
  });

  it('calculates 8 hours for 07:00-15:00', () => {
    expect(calcShiftHours({ is_day_off: false, start_time: '07:00', end_time: '15:00' })).toBe(8);
  });

  it('calculates 7.5 hours for 07:30-15:00', () => {
    expect(calcShiftHours({ is_day_off: false, start_time: '07:30', end_time: '15:00' })).toBe(7.5);
  });

  it('calculates 4 hours for 09:00-13:00', () => {
    expect(calcShiftHours({ is_day_off: false, start_time: '09:00', end_time: '13:00' })).toBe(4);
  });

  it('handles overnight shift 22:00-06:00 = 8 hours', () => {
    expect(calcShiftHours({ is_day_off: false, start_time: '22:00', end_time: '06:00' })).toBe(8);
  });

  it('handles overnight shift 23:00-07:00 = 8 hours', () => {
    expect(calcShiftHours({ is_day_off: false, start_time: '23:00', end_time: '07:00' })).toBe(8);
  });

  it('handles full day 00:00-24:00 edge case', () => {
    // 00:00 to 00:00 would be treated as overnight → 24h
    expect(calcShiftHours({ is_day_off: false, start_time: '00:00', end_time: '00:00' })).toBe(24);
  });
});

describe('formatHours', () => {
  it('formats 0 as "0h"', () => {
    expect(formatHours(0)).toBe('0h');
  });

  it('formats integer hours without decimals', () => {
    expect(formatHours(8)).toBe('8h');
    expect(formatHours(40)).toBe('40h');
  });

  it('formats fractional hours with one decimal', () => {
    expect(formatHours(7.5)).toBe('7.5h');
    expect(formatHours(3.25)).toBe('3.3h'); // toFixed(1) rounds
  });
});

describe('getWeekDates', () => {
  it('returns 7 dates', () => {
    const dates = getWeekDates(0);
    expect(dates).toHaveLength(7);
  });

  it('starts on Monday', () => {
    const dates = getWeekDates(0);
    expect(dates[0].getDay()).toBe(1); // Monday = 1
  });

  it('ends on Sunday', () => {
    const dates = getWeekDates(0);
    expect(dates[6].getDay()).toBe(0); // Sunday = 0
  });

  it('previous week is 7 days before current week', () => {
    const current = getWeekDates(0);
    const prev = getWeekDates(-1);
    const diffMs = current[0].getTime() - prev[0].getTime();
    const diffDays = diffMs / (24 * 60 * 60 * 1000);
    expect(diffDays).toBe(7);
  });

  it('next week is 7 days after current week', () => {
    const current = getWeekDates(0);
    const next = getWeekDates(1);
    const diffMs = next[0].getTime() - current[0].getTime();
    const diffDays = diffMs / (24 * 60 * 60 * 1000);
    expect(diffDays).toBe(7);
  });
});

describe('Copy week logic', () => {
  it('maps previous week entries to current week by day offset', () => {
    const prevWeekDates = getWeekDates(-1);
    const currentWeekDates = getWeekDates(0);

    // Simulate a schedule entry on previous Monday
    const prevMonday = formatDateISO(prevWeekDates[0]);
    const prevEntry = {
      user_id: 'user-1',
      date: prevMonday,
      shift_template_id: 'shift-1',
      team_id: null,
    };

    // Map to current week
    const prevDate = new Date(prevEntry.date + 'T00:00:00');
    const prevMondayDate = new Date(prevWeekDates[0]);
    const dayOffset = Math.round((prevDate.getTime() - prevMondayDate.getTime()) / (24 * 60 * 60 * 1000));

    expect(dayOffset).toBe(0); // Monday = offset 0
    const targetDate = formatDateISO(currentWeekDates[dayOffset]);
    expect(targetDate).toBe(formatDateISO(currentWeekDates[0])); // Current Monday
  });

  it('maps previous Friday (offset 4) to current Friday', () => {
    const prevWeekDates = getWeekDates(-1);
    const currentWeekDates = getWeekDates(0);

    const prevFriday = formatDateISO(prevWeekDates[4]);
    const prevDate = new Date(prevFriday + 'T00:00:00');
    const prevMondayDate = new Date(prevWeekDates[0]);
    const dayOffset = Math.round((prevDate.getTime() - prevMondayDate.getTime()) / (24 * 60 * 60 * 1000));

    expect(dayOffset).toBe(4); // Friday = offset 4
    const targetDate = formatDateISO(currentWeekDates[dayOffset]);
    expect(targetDate).toBe(formatDateISO(currentWeekDates[4])); // Current Friday
  });

  it('maps previous Sunday (offset 6) to current Sunday', () => {
    const prevWeekDates = getWeekDates(-1);
    const currentWeekDates = getWeekDates(0);

    const prevSunday = formatDateISO(prevWeekDates[6]);
    const prevDate = new Date(prevSunday + 'T00:00:00');
    const prevMondayDate = new Date(prevWeekDates[0]);
    const dayOffset = Math.round((prevDate.getTime() - prevMondayDate.getTime()) / (24 * 60 * 60 * 1000));

    expect(dayOffset).toBe(6); // Sunday = offset 6
    const targetDate = formatDateISO(currentWeekDates[dayOffset]);
    expect(targetDate).toBe(formatDateISO(currentWeekDates[6])); // Current Sunday
  });
});

describe('Weekly hours calculation', () => {
  it('sums hours across multiple shifts for one member', () => {
    const shifts = [
      { is_day_off: false, start_time: '07:00', end_time: '15:00' }, // 8h
      { is_day_off: false, start_time: '07:00', end_time: '15:00' }, // 8h
      { is_day_off: false, start_time: '07:00', end_time: '15:00' }, // 8h
      { is_day_off: true, start_time: null, end_time: null },         // 0h (day off)
      { is_day_off: false, start_time: '09:00', end_time: '13:00' }, // 4h
    ];

    const total = shifts.reduce((sum, s) => sum + calcShiftHours(s), 0);
    expect(total).toBe(28);
    expect(formatHours(total)).toBe('28h');
  });

  it('returns 0h when all days are off', () => {
    const shifts = Array(5).fill({ is_day_off: true, start_time: null, end_time: null });
    const total = shifts.reduce((sum, s) => sum + calcShiftHours(s), 0);
    expect(total).toBe(0);
    expect(formatHours(total)).toBe('0h');
  });

  it('handles mixed shifts with fractional hours', () => {
    const shifts = [
      { is_day_off: false, start_time: '07:30', end_time: '15:00' }, // 7.5h
      { is_day_off: false, start_time: '08:00', end_time: '14:30' }, // 6.5h
    ];

    const total = shifts.reduce((sum, s) => sum + calcShiftHours(s), 0);
    expect(total).toBe(14);
    expect(formatHours(total)).toBe('14h');
  });
});
