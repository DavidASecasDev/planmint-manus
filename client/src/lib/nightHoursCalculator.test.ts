import { describe, it, expect } from 'vitest';
import { calculateNightHours, isNightTime, getNightHoursDescription } from './nightHoursCalculator';

describe('nightHoursCalculator', () => {
  describe('calculateNightHours', () => {
    it('returns 0 for daytime pickups', () => {
      expect(calculateNightHours('10:00')).toBe(0);
      expect(calculateNightHours('14:30')).toBe(0);
      expect(calculateNightHours('18:00')).toBe(0);
      expect(calculateNightHours('08:00')).toBe(0);
    });

    it('returns 0 for pickup at 05:00 (end of night window)', () => {
      expect(calculateNightHours('05:00', 60)).toBe(0);
    });

    it('returns 1 for pickup at 04:00 with 60min duration', () => {
      // 04:00 to 05:00 → 1 hour overlap with 01:00-05:00
      expect(calculateNightHours('04:00', 60)).toBe(1);
    });

    it('returns 2 for pickup at 03:00 with 60min duration', () => {
      // 03:00 to 04:00 → 1 hour overlap, but ceil(60/60) = 1
      // Actually: 03:00 to 04:00 is fully in night window = 60 min = 1 hour
      expect(calculateNightHours('03:00', 60)).toBe(1);
    });

    it('returns 2 for pickup at 02:00 with 120min duration', () => {
      // 02:00 to 04:00 → 2 hours overlap
      expect(calculateNightHours('02:00', 120)).toBe(2);
    });

    it('returns 4 for pickup at 01:00 with 240min duration', () => {
      // 01:00 to 05:00 → full 4 hours
      expect(calculateNightHours('01:00', 240)).toBe(4);
    });

    it('returns max 4 even for longer services', () => {
      // 01:00 to 07:00 → only 4 hours in night window
      expect(calculateNightHours('01:00', 360)).toBe(4);
    });

    it('handles midnight crossing: pickup at 23:00 with 3h duration', () => {
      // 23:00 to 02:00 → overlap with 01:00-05:00 = 01:00-02:00 = 1 hour
      expect(calculateNightHours('23:00', 180)).toBe(1);
    });

    it('handles midnight crossing: pickup at 00:00 with 6h duration', () => {
      // 00:00 to 06:00 → overlap with 01:00-05:00 = 4 hours
      expect(calculateNightHours('00:00', 360)).toBe(4);
    });

    it('handles pickup at 00:30 with 90min duration', () => {
      // 00:30 to 02:00 → overlap with 01:00-05:00 = 01:00-02:00 = 60 min = 1 hour
      expect(calculateNightHours('00:30', 90)).toBe(1);
    });

    it('rounds up partial hours', () => {
      // 04:30 to 05:00 → 30 min overlap → ceil(30/60) = 1 hour
      expect(calculateNightHours('04:30', 60)).toBe(1);
    });

    it('returns 0 for invalid time strings', () => {
      expect(calculateNightHours('')).toBe(0);
      expect(calculateNightHours('invalid')).toBe(0);
      expect(calculateNightHours('25:00')).toBe(0);
    });

    it('returns 0 for 0 duration', () => {
      expect(calculateNightHours('02:00', 0)).toBe(0);
    });
  });

  describe('isNightTime', () => {
    it('returns true for times within night window', () => {
      expect(isNightTime('01:00')).toBe(true);
      expect(isNightTime('02:30')).toBe(true);
      expect(isNightTime('04:59')).toBe(true);
    });

    it('returns false for times outside night window', () => {
      expect(isNightTime('00:00')).toBe(false);
      expect(isNightTime('00:59')).toBe(false);
      expect(isNightTime('05:00')).toBe(false);
      expect(isNightTime('12:00')).toBe(false);
    });

    it('returns false for invalid times', () => {
      expect(isNightTime('')).toBe(false);
      expect(isNightTime('invalid')).toBe(false);
    });
  });

  describe('getNightHoursDescription', () => {
    it('returns empty string for 0 hours', () => {
      expect(getNightHoursDescription(0)).toBe('');
    });

    it('returns singular for 1 hour', () => {
      expect(getNightHoursDescription(1)).toBe('1 hora en horario nocturno (1:00–5:00)');
    });

    it('returns plural for multiple hours', () => {
      expect(getNightHoursDescription(3)).toBe('3 horas en horario nocturno (1:00–5:00)');
    });
  });
});
