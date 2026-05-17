/**
 * Night Hours Calculator
 * 
 * Automatically calculates the number of hours that fall within the
 * LimoMallorca night fee window (1:00 – 5:00) based on the pickup time
 * and an estimated service duration.
 * 
 * The night window is 4 hours total (01:00 to 05:00).
 * We calculate the overlap between [pickupTime, pickupTime + durationMinutes]
 * and the night window [01:00, 05:00].
 */

const NIGHT_START_HOUR = 1;  // 01:00
const NIGHT_END_HOUR = 5;    // 05:00
const NIGHT_WINDOW_MINUTES = (NIGHT_END_HOUR - NIGHT_START_HOUR) * 60; // 240 min

/**
 * Parse a time string "HH:MM" into minutes since midnight.
 */
function parseTimeToMinutes(time: string): number | null {
  if (!time || !time.includes(':')) return null;
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Calculate the overlap in minutes between two time ranges,
 * where both are expressed as minutes-since-midnight.
 * Handles wrap-around midnight correctly.
 */
function overlapMinutes(
  serviceStart: number,
  serviceEnd: number,
  nightStart: number,
  nightEnd: number,
): number {
  // If service doesn't cross midnight
  if (serviceEnd >= serviceStart) {
    const overlapStart = Math.max(serviceStart, nightStart);
    const overlapEnd = Math.min(serviceEnd, nightEnd);
    return Math.max(0, overlapEnd - overlapStart);
  }

  // Service crosses midnight: split into [serviceStart, 24:00) and [00:00, serviceEnd)
  // Part 1: serviceStart to midnight
  const part1Start = Math.max(serviceStart, nightStart);
  const part1End = Math.min(24 * 60, nightEnd);
  const part1 = Math.max(0, part1End - part1Start);

  // Part 2: midnight to serviceEnd (night window is 01:00-05:00, so relevant)
  const part2Start = Math.max(0, nightStart);
  const part2End = Math.min(serviceEnd, nightEnd);
  const part2 = Math.max(0, part2End - part2Start);

  return part1 + part2;
}

/**
 * Calculate the number of night hours for a transfer service.
 * 
 * @param pickupTime - Time string in "HH:MM" format
 * @param estimatedDurationMinutes - Estimated service duration in minutes (default: 60)
 * @returns Number of night hours (0-4), rounded up to nearest hour
 */
export function calculateNightHours(
  pickupTime: string,
  estimatedDurationMinutes: number = 60,
): number {
  const startMinutes = parseTimeToMinutes(pickupTime);
  if (startMinutes === null) return 0;

  // Calculate service end time (may wrap past midnight)
  const endMinutes = (startMinutes + estimatedDurationMinutes) % (24 * 60);

  // Night window in minutes since midnight
  const nightStartMin = NIGHT_START_HOUR * 60;  // 60
  const nightEndMin = NIGHT_END_HOUR * 60;       // 300

  const overlap = overlapMinutes(startMinutes, endMinutes, nightStartMin, nightEndMin);

  if (overlap <= 0) return 0;

  // Round up to nearest hour (LimoMallorca charges per hour)
  return Math.min(4, Math.ceil(overlap / 60));
}

/**
 * Check if a given time falls within or near the night window.
 * Useful for showing a visual indicator.
 */
export function isNightTime(time: string): boolean {
  const minutes = parseTimeToMinutes(time);
  if (minutes === null) return false;
  const nightStartMin = NIGHT_START_HOUR * 60;
  const nightEndMin = NIGHT_END_HOUR * 60;
  return minutes >= nightStartMin && minutes < nightEndMin;
}

/**
 * Get a human-readable description of the night hours calculation.
 */
export function getNightHoursDescription(nightHours: number): string {
  if (nightHours === 0) return '';
  if (nightHours === 1) return '1 hora en horario nocturno (1:00–5:00)';
  return `${nightHours} horas en horario nocturno (1:00–5:00)`;
}
