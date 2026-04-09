import { describe, it, expect } from 'vitest';

/**
 * Tests for the reservation table sorting logic.
 * Extracted from ReservationsTable.tsx to validate the sort algorithm independently.
 */

interface MockOperationRow {
  id: string;
  fechaHora: string | null;
  confirmedDatetime: string | null;
  tipoOperacion: string;
  lugar: string | null;
}

// Helper to parse datetime string to timestamp (mirrors the production code)
const toTimestamp = (s: string | null): number | null => {
  if (!s) return null;
  // Handle both 'T' and space separators in ISO strings
  let normalized = s.replace(' ', 'T');
  // Ensure timezone offset has colon: +00 -> +00:00, -05 -> -05:00
  normalized = normalized.replace(/([+-]\d{2})$/, '$1:00');
  const t = new Date(normalized).getTime();
  return isNaN(t) ? null : t;
};

// Sort function extracted from ReservationsTable (mirrors the production code)
function sortOperationRows(
  rows: MockOperationRow[],
  sortKey: string,
  sortDir: 'asc' | 'desc'
): MockOperationRow[] {
  const result = [...rows];

  result.sort((a, b) => {
    let comparison = 0;

    if (sortKey === 'fecha_hora' || sortKey === 'hora_confirmada') {
      const aRaw = sortKey === 'fecha_hora' ? a.fechaHora : a.confirmedDatetime;
      const bRaw = sortKey === 'fecha_hora' ? b.fechaHora : b.confirmedDatetime;
      const aTs = toTimestamp(aRaw);
      const bTs = toTimestamp(bRaw);

      if (aTs === null && bTs === null) return 0;
      if (aTs === null) return 1;
      if (bTs === null) return -1;

      comparison = aTs - bTs;

      // Secondary sort
      if (comparison === 0) {
        const aSecondary = toTimestamp(sortKey === 'fecha_hora' ? a.confirmedDatetime : a.fechaHora);
        const bSecondary = toTimestamp(sortKey === 'fecha_hora' ? b.confirmedDatetime : b.fechaHora);
        if (aSecondary !== null && bSecondary !== null) {
          comparison = aSecondary - bSecondary;
        }
      }
    } else {
      let aVal: string | null = null;
      let bVal: string | null = null;

      if (sortKey === 'tipo_actividad') {
        aVal = a.tipoOperacion;
        bVal = b.tipoOperacion;
      } else if (sortKey === 'lugar') {
        aVal = a.lugar;
        bVal = b.lugar;
      }

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      comparison = aVal.localeCompare(bVal);
    }

    return sortDir === 'asc' ? comparison : -comparison;
  });

  return result;
}

describe('Reservation Sorting', () => {
  // Simulates the exact scenario from the user's bug report:
  // One row has confirmed time 12:50 but original time 11:00
  const rows: MockOperationRow[] = [
    { id: '1', fechaHora: '2026-04-09T06:00:00+00:00', confirmedDatetime: '2026-04-09T06:00:00+00:00', tipoOperacion: 'Entrega', lugar: 'Aeropuerto' },
    { id: '2', fechaHora: '2026-04-09T06:00:00+00:00', confirmedDatetime: '2026-04-09T06:00:00+00:00', tipoOperacion: 'Devolución', lugar: 'Hotel' },
    { id: '3', fechaHora: '2026-04-09T07:00:00+00:00', confirmedDatetime: '2026-04-09T07:00:00+00:00', tipoOperacion: 'Entrega', lugar: 'Oficina' },
    { id: '4', fechaHora: '2026-04-09T08:00:00+00:00', confirmedDatetime: '2026-04-09T08:00:00+00:00', tipoOperacion: 'Entrega', lugar: 'Aeropuerto' },
    { id: '5', fechaHora: '2026-04-09T11:00:00+00:00', confirmedDatetime: '2026-04-09T11:00:00+00:00', tipoOperacion: 'Entrega', lugar: 'Hotel' },
    { id: '6', fechaHora: '2026-04-09T11:00:00+00:00', confirmedDatetime: '2026-04-09T11:00:00+00:00', tipoOperacion: 'Devolución', lugar: 'Aeropuerto' },
    // THE KEY ROW: original time 11:00, confirmed time 12:50
    { id: '7_edited', fechaHora: '2026-04-09T11:00:00+00:00', confirmedDatetime: '2026-04-09T12:50:00+00:00', tipoOperacion: 'Entrega', lugar: 'Puerto' },
    { id: '8', fechaHora: '2026-04-09T12:00:00+00:00', confirmedDatetime: '2026-04-09T12:00:00+00:00', tipoOperacion: 'Entrega', lugar: 'Hotel' },
    { id: '9', fechaHora: '2026-04-09T12:00:00+00:00', confirmedDatetime: '2026-04-09T12:00:00+00:00', tipoOperacion: 'Devolución', lugar: 'Oficina' },
    { id: '10', fechaHora: '2026-04-09T13:30:00+00:00', confirmedDatetime: '2026-04-09T13:30:00+00:00', tipoOperacion: 'Entrega', lugar: 'Aeropuerto' },
    { id: '11', fechaHora: '2026-04-09T15:00:00+00:00', confirmedDatetime: '2026-04-09T15:00:00+00:00', tipoOperacion: 'Entrega', lugar: 'Hotel' },
    { id: '12', fechaHora: '2026-04-09T17:00:00+00:00', confirmedDatetime: '2026-04-09T17:00:00+00:00', tipoOperacion: 'Devolución', lugar: 'Aeropuerto' },
  ];

  it('sorts by fecha_hora ASC correctly', () => {
    const sorted = sortOperationRows(rows, 'fecha_hora', 'asc');
    const times = sorted.map(r => r.fechaHora!.substring(11, 16));
    expect(times).toEqual(['06:00', '06:00', '07:00', '08:00', '11:00', '11:00', '11:00', '12:00', '12:00', '13:30', '15:00', '17:00']);
  });

  it('sorts by hora_confirmada ASC and places edited row (12:50) after 12:00 rows', () => {
    const sorted = sortOperationRows(rows, 'hora_confirmada', 'asc');
    const confirmedTimes = sorted.map(r => r.confirmedDatetime!.substring(11, 16));
    
    // The 12:50 row should appear AFTER the 12:00 rows and BEFORE 13:30
    expect(confirmedTimes).toEqual([
      '06:00', '06:00', '07:00', '08:00',
      '11:00', '11:00',
      '12:00', '12:00',
      '12:50',  // <-- The edited row should be here, not among 11:00 rows
      '13:30', '15:00', '17:00'
    ]);
  });

  it('sorts by hora_confirmada DESC correctly', () => {
    const sorted = sortOperationRows(rows, 'hora_confirmada', 'desc');
    const confirmedTimes = sorted.map(r => r.confirmedDatetime!.substring(11, 16));
    
    // Reverse of ASC
    expect(confirmedTimes).toEqual([
      '17:00', '15:00', '13:30',
      '12:50',
      '12:00', '12:00',
      '11:00', '11:00',
      '08:00', '07:00', '06:00', '06:00'
    ]);
  });

  it('handles null confirmedDatetime by pushing to end in ASC', () => {
    const rowsWithNull: MockOperationRow[] = [
      { id: '1', fechaHora: '2026-04-09T08:00:00+00:00', confirmedDatetime: '2026-04-09T08:00:00+00:00', tipoOperacion: 'Entrega', lugar: 'A' },
      { id: '2', fechaHora: '2026-04-09T06:00:00+00:00', confirmedDatetime: null, tipoOperacion: 'Entrega', lugar: 'B' },
      { id: '3', fechaHora: '2026-04-09T10:00:00+00:00', confirmedDatetime: '2026-04-09T10:00:00+00:00', tipoOperacion: 'Entrega', lugar: 'C' },
    ];

    const sorted = sortOperationRows(rowsWithNull, 'hora_confirmada', 'asc');
    expect(sorted.map(r => r.id)).toEqual(['1', '3', '2']); // null goes to end
  });

  it('handles mixed timestamp formats (space vs T separator)', () => {
    const mixedRows: MockOperationRow[] = [
      { id: '1', fechaHora: '2026-04-09 11:00:00+00', confirmedDatetime: '2026-04-09 11:00:00+00', tipoOperacion: 'Entrega', lugar: 'A' },
      { id: '2', fechaHora: '2026-04-09T08:00:00+00:00', confirmedDatetime: '2026-04-09T08:00:00+00:00', tipoOperacion: 'Entrega', lugar: 'B' },
      { id: '3', fechaHora: '2026-04-09 15:00:00+00:00', confirmedDatetime: '2026-04-09T12:50:00+00:00', tipoOperacion: 'Entrega', lugar: 'C' },
    ];

    const sorted = sortOperationRows(mixedRows, 'hora_confirmada', 'asc');
    expect(sorted.map(r => r.id)).toEqual(['2', '1', '3']); // 08:00, 11:00, 12:50
  });

  it('sorts by fecha_hora ASC and uses confirmedDatetime as secondary sort', () => {
    const tiedRows: MockOperationRow[] = [
      { id: '1', fechaHora: '2026-04-09T11:00:00+00:00', confirmedDatetime: '2026-04-09T14:00:00+00:00', tipoOperacion: 'Entrega', lugar: 'A' },
      { id: '2', fechaHora: '2026-04-09T11:00:00+00:00', confirmedDatetime: '2026-04-09T11:00:00+00:00', tipoOperacion: 'Entrega', lugar: 'B' },
      { id: '3', fechaHora: '2026-04-09T11:00:00+00:00', confirmedDatetime: '2026-04-09T12:30:00+00:00', tipoOperacion: 'Entrega', lugar: 'C' },
    ];

    const sorted = sortOperationRows(tiedRows, 'fecha_hora', 'asc');
    // All have same fechaHora, so secondary sort by confirmedDatetime
    expect(sorted.map(r => r.id)).toEqual(['2', '3', '1']); // 11:00, 12:30, 14:00
  });
});

describe('toTimestamp helper', () => {
  it('parses ISO string with T separator', () => {
    const ts = toTimestamp('2026-04-09T12:50:00+00:00');
    expect(ts).not.toBeNull();
    expect(ts).toBeGreaterThan(0);
  });

  it('parses ISO string with space separator', () => {
    const ts = toTimestamp('2026-04-09 12:50:00+00');
    expect(ts).not.toBeNull();
    expect(ts).toBeGreaterThan(0);
  });

  it('returns same timestamp for equivalent formats', () => {
    const tsT = toTimestamp('2026-04-09T12:50:00+00:00');
    const tsSpace = toTimestamp('2026-04-09 12:50:00+00:00');
    expect(tsT).toEqual(tsSpace);
  });

  it('returns null for null input', () => {
    expect(toTimestamp(null)).toBeNull();
  });

  it('returns null for invalid string', () => {
    expect(toTimestamp('not-a-date')).toBeNull();
  });

  it('correctly orders different times on same day', () => {
    const t1 = toTimestamp('2026-04-09T11:00:00+00:00')!;
    const t2 = toTimestamp('2026-04-09T12:50:00+00:00')!;
    const t3 = toTimestamp('2026-04-09T12:00:00+00:00')!;
    expect(t1).toBeLessThan(t3);
    expect(t3).toBeLessThan(t2);
    expect(t1).toBeLessThan(t2);
  });
});
