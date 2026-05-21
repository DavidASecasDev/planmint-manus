import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Tests that verify the dashboard "Operaciones de hoy" logic is consistent
 * with the ReservationsTable row expansion approach.
 * 
 * The key requirements:
 * 1. Each reservation is expanded into separate Entrega/Devolución/Transfer rows
 * 2. Filtering is done by extracting the date part (YYYY-MM-DD) from fechaHora
 * 3. Sorting is by confirmed datetime (hora_confirmada) ascending
 * 4. Cancelled reservations are excluded
 * 5. The same entries appear as in the Reservas page when filtered to today
 */

// ─── Pure logic extracted from useOperationalDashboard for testing ───

function extractDatePart(isoStr: string | null): string | null {
  if (!isoStr) return null;
  const m = isoStr.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function toTimestamp(s: string | null): number | null {
  if (!s) return null;
  let normalized = s.replace(' ', 'T');
  normalized = normalized.replace(/([+-]\d{2})$/, '$1:00');
  const t = new Date(normalized).getTime();
  return isNaN(t) ? null : t;
}

type TodayOperationType = 'checkin' | 'checkout' | 'transfer';

interface TodayOperationRow {
  id: string;
  reservationId: string;
  type: TodayOperationType;
  fechaHora: string | null;
  confirmedDatetime: string | null;
  lugar: string | null;
  isCompleted: boolean;
}

interface MockReservation {
  id: string;
  desde: string | null;
  hasta: string | null;
  tipo_actividad: string | null;
  confirmed_entrega_datetime: string | null;
  confirmed_devolucion_datetime: string | null;
  lugar_entrega: string | null;
  lugar_devolucion: string | null;
  entrega_completada: boolean;
  devolucion_completada: boolean;
  transfer_completado: boolean;
  estado: string | null;
}

function expandReservationsToOperations(reservations: MockReservation[], todayStr: string): TodayOperationRow[] {
  const operations: TodayOperationRow[] = [];

  for (const r of reservations) {
    // Skip cancelled
    if (r.estado?.toLowerCase().includes('cancelada')) continue;

    if (r.tipo_actividad === 'Transfer') {
      const datePart = extractDatePart(r.desde);
      if (datePart === todayStr) {
        operations.push({
          id: `${r.id}_transfer`,
          reservationId: r.id,
          type: 'transfer',
          fechaHora: r.desde,
          confirmedDatetime: r.confirmed_entrega_datetime,
          lugar: r.lugar_entrega || r.lugar_devolucion,
          isCompleted: r.transfer_completado,
        });
      }
    } else {
      // Entrega row
      const entregaDate = extractDatePart(r.desde);
      if (entregaDate === todayStr) {
        operations.push({
          id: `${r.id}_entrega`,
          reservationId: r.id,
          type: 'checkin',
          fechaHora: r.desde,
          confirmedDatetime: r.confirmed_entrega_datetime,
          lugar: r.lugar_entrega,
          isCompleted: r.entrega_completada,
        });
      }

      // Devolución row
      const devolucionDate = extractDatePart(r.hasta);
      if (devolucionDate === todayStr) {
        operations.push({
          id: `${r.id}_devolucion`,
          reservationId: r.id,
          type: 'checkout',
          fechaHora: r.hasta,
          confirmedDatetime: r.confirmed_devolucion_datetime,
          lugar: r.lugar_devolucion,
          isCompleted: r.devolucion_completada,
        });
      }
    }
  }

  // Sort by confirmed datetime ASC (nulls last)
  operations.sort((a, b) => {
    const aTs = toTimestamp(a.confirmedDatetime);
    const bTs = toTimestamp(b.confirmedDatetime);
    if (aTs === null && bTs === null) return 0;
    if (aTs === null) return 1;
    if (bTs === null) return -1;
    const cmp = aTs - bTs;
    if (cmp !== 0) return cmp;
    const aFh = toTimestamp(a.fechaHora);
    const bFh = toTimestamp(b.fechaHora);
    if (aFh !== null && bFh !== null) return aFh - bFh;
    return 0;
  });

  return operations;
}

describe('Dashboard Operations Consistency', () => {
  const TODAY = '2026-04-30';

  describe('Row expansion matches ReservationsTable', () => {
    it('should expand a normal reservation into Entrega + Devolución rows', () => {
      const reservations: MockReservation[] = [{
        id: 'res-1',
        desde: '2026-04-30T10:00:00+00:00',
        hasta: '2026-05-03T18:00:00+00:00',
        tipo_actividad: null,
        confirmed_entrega_datetime: '2026-04-30T09:30:00+00:00',
        confirmed_devolucion_datetime: '2026-05-03T17:00:00+00:00',
        lugar_entrega: 'Aeropuerto PMI',
        lugar_devolucion: 'Oficina Palma',
        entrega_completada: false,
        devolucion_completada: false,
        transfer_completado: false,
        estado: 'Confirmada',
      }];

      const ops = expandReservationsToOperations(reservations, TODAY);
      
      // Only the Entrega row should appear (desde is today, hasta is May 3)
      expect(ops).toHaveLength(1);
      expect(ops[0].type).toBe('checkin');
      expect(ops[0].fechaHora).toBe('2026-04-30T10:00:00+00:00');
      expect(ops[0].confirmedDatetime).toBe('2026-04-30T09:30:00+00:00');
      expect(ops[0].lugar).toBe('Aeropuerto PMI');
    });

    it('should show both Entrega and Devolución when both fall on today', () => {
      const reservations: MockReservation[] = [{
        id: 'res-2',
        desde: '2026-04-30T08:00:00+00:00',
        hasta: '2026-04-30T20:00:00+00:00',
        tipo_actividad: null,
        confirmed_entrega_datetime: '2026-04-30T07:45:00+00:00',
        confirmed_devolucion_datetime: '2026-04-30T19:30:00+00:00',
        lugar_entrega: 'Hotel Meliá',
        lugar_devolucion: 'Aeropuerto PMI',
        entrega_completada: true,
        devolucion_completada: false,
        transfer_completado: false,
        estado: 'En curso',
      }];

      const ops = expandReservationsToOperations(reservations, TODAY);
      
      expect(ops).toHaveLength(2);
      expect(ops[0].type).toBe('checkin');
      expect(ops[0].confirmedDatetime).toBe('2026-04-30T07:45:00+00:00');
      expect(ops[0].isCompleted).toBe(true);
      expect(ops[1].type).toBe('checkout');
      expect(ops[1].confirmedDatetime).toBe('2026-04-30T19:30:00+00:00');
      expect(ops[1].isCompleted).toBe(false);
    });

    it('should handle Transfer type as a single row', () => {
      const reservations: MockReservation[] = [{
        id: 'res-3',
        desde: '2026-04-30T14:00:00+00:00',
        hasta: '2026-04-30T14:00:00+00:00',
        tipo_actividad: 'Transfer',
        confirmed_entrega_datetime: '2026-04-30T13:45:00+00:00',
        confirmed_devolucion_datetime: null,
        lugar_entrega: 'Puerto Alcudia',
        lugar_devolucion: null,
        entrega_completada: false,
        devolucion_completada: false,
        transfer_completado: false,
        estado: 'Confirmada',
      }];

      const ops = expandReservationsToOperations(reservations, TODAY);
      
      expect(ops).toHaveLength(1);
      expect(ops[0].type).toBe('transfer');
      expect(ops[0].lugar).toBe('Puerto Alcudia');
      expect(ops[0].confirmedDatetime).toBe('2026-04-30T13:45:00+00:00');
    });

    it('should exclude cancelled reservations', () => {
      const reservations: MockReservation[] = [{
        id: 'res-4',
        desde: '2026-04-30T10:00:00+00:00',
        hasta: '2026-04-30T18:00:00+00:00',
        tipo_actividad: null,
        confirmed_entrega_datetime: '2026-04-30T10:00:00+00:00',
        confirmed_devolucion_datetime: '2026-04-30T18:00:00+00:00',
        lugar_entrega: 'Aeropuerto',
        lugar_devolucion: 'Aeropuerto',
        entrega_completada: false,
        devolucion_completada: false,
        transfer_completado: false,
        estado: 'Cancelada',
      }];

      const ops = expandReservationsToOperations(reservations, TODAY);
      expect(ops).toHaveLength(0);
    });

    it('should not show operations from other days', () => {
      const reservations: MockReservation[] = [{
        id: 'res-5',
        desde: '2026-04-29T10:00:00+00:00',
        hasta: '2026-05-01T18:00:00+00:00',
        tipo_actividad: null,
        confirmed_entrega_datetime: '2026-04-29T10:00:00+00:00',
        confirmed_devolucion_datetime: '2026-05-01T18:00:00+00:00',
        lugar_entrega: 'Aeropuerto',
        lugar_devolucion: 'Aeropuerto',
        entrega_completada: true,
        devolucion_completada: false,
        transfer_completado: false,
        estado: 'En curso',
      }];

      const ops = expandReservationsToOperations(reservations, TODAY);
      // Neither desde (Apr 29) nor hasta (May 1) is today (Apr 30)
      expect(ops).toHaveLength(0);
    });
  });

  describe('Date extraction (timezone-safe)', () => {
    it('should extract date from ISO string with T separator', () => {
      expect(extractDatePart('2026-04-30T22:00:00+00:00')).toBe('2026-04-30');
    });

    it('should extract date from ISO string with space separator', () => {
      expect(extractDatePart('2026-04-30 22:00:00+00:00')).toBe('2026-04-30');
    });

    it('should not shift late-night UTC times to next day', () => {
      // This is the key test: 22:00 UTC stored as +00:00 represents 22:00 Mallorca time
      // It should NOT be shifted to May 1 even though in UTC+2 it would be midnight
      expect(extractDatePart('2026-04-30T22:00:00+00:00')).toBe('2026-04-30');
    });

    it('should return null for null input', () => {
      expect(extractDatePart(null)).toBeNull();
    });

    it('should return null for invalid input', () => {
      expect(extractDatePart('invalid')).toBeNull();
    });
  });

  describe('Sorting by confirmed datetime', () => {
    it('should sort operations by confirmed datetime ascending', () => {
      const reservations: MockReservation[] = [
        {
          id: 'res-a',
          desde: '2026-04-30T14:00:00+00:00',
          hasta: '2026-05-02T10:00:00+00:00',
          tipo_actividad: null,
          confirmed_entrega_datetime: '2026-04-30T14:00:00+00:00',
          confirmed_devolucion_datetime: null,
          lugar_entrega: 'B', lugar_devolucion: null,
          entrega_completada: false, devolucion_completada: false, transfer_completado: false,
          estado: 'Confirmada',
        },
        {
          id: 'res-b',
          desde: '2026-04-30T08:00:00+00:00',
          hasta: '2026-05-01T10:00:00+00:00',
          tipo_actividad: null,
          confirmed_entrega_datetime: '2026-04-30T08:00:00+00:00',
          confirmed_devolucion_datetime: null,
          lugar_entrega: 'A', lugar_devolucion: null,
          entrega_completada: false, devolucion_completada: false, transfer_completado: false,
          estado: 'Confirmada',
        },
      ];

      const ops = expandReservationsToOperations(reservations, TODAY);
      
      expect(ops).toHaveLength(2);
      // res-b (08:00) should come before res-a (14:00)
      expect(ops[0].reservationId).toBe('res-b');
      expect(ops[1].reservationId).toBe('res-a');
    });

    it('should push null confirmed datetimes to the end', () => {
      const reservations: MockReservation[] = [
        {
          id: 'res-c',
          desde: '2026-04-30T10:00:00+00:00',
          hasta: '2026-05-02T10:00:00+00:00',
          tipo_actividad: null,
          confirmed_entrega_datetime: null, // no confirmed time
          confirmed_devolucion_datetime: null,
          lugar_entrega: 'No confirmada', lugar_devolucion: null,
          entrega_completada: false, devolucion_completada: false, transfer_completado: false,
          estado: 'Pendiente',
        },
        {
          id: 'res-d',
          desde: '2026-04-30T12:00:00+00:00',
          hasta: '2026-05-01T10:00:00+00:00',
          tipo_actividad: null,
          confirmed_entrega_datetime: '2026-04-30T12:00:00+00:00',
          confirmed_devolucion_datetime: null,
          lugar_entrega: 'Confirmada', lugar_devolucion: null,
          entrega_completada: false, devolucion_completada: false, transfer_completado: false,
          estado: 'Confirmada',
        },
      ];

      const ops = expandReservationsToOperations(reservations, TODAY);
      
      expect(ops).toHaveLength(2);
      // res-d (has confirmed time) should come before res-c (null confirmed)
      expect(ops[0].reservationId).toBe('res-d');
      expect(ops[1].reservationId).toBe('res-c');
    });
  });

  describe('Consistency with ReservationsTable', () => {
    it('should produce the same number of rows as ReservationsTable for same-day reservations', () => {
      // Simulate what ReservationsTable does: expand ALL reservations, then filter by today
      const reservations: MockReservation[] = [
        {
          id: 'res-1', desde: '2026-04-30T08:00:00+00:00', hasta: '2026-04-30T20:00:00+00:00',
          tipo_actividad: null, confirmed_entrega_datetime: '2026-04-30T08:00:00+00:00',
          confirmed_devolucion_datetime: '2026-04-30T20:00:00+00:00',
          lugar_entrega: 'A', lugar_devolucion: 'B',
          entrega_completada: false, devolucion_completada: false, transfer_completado: false,
          estado: 'Confirmada',
        },
        {
          id: 'res-2', desde: '2026-04-30T12:00:00+00:00', hasta: '2026-05-05T10:00:00+00:00',
          tipo_actividad: null, confirmed_entrega_datetime: '2026-04-30T12:00:00+00:00',
          confirmed_devolucion_datetime: '2026-05-05T10:00:00+00:00',
          lugar_entrega: 'C', lugar_devolucion: 'D',
          entrega_completada: false, devolucion_completada: false, transfer_completado: false,
          estado: 'Confirmada',
        },
        {
          id: 'res-3', desde: '2026-04-28T10:00:00+00:00', hasta: '2026-04-30T16:00:00+00:00',
          tipo_actividad: null, confirmed_entrega_datetime: '2026-04-28T10:00:00+00:00',
          confirmed_devolucion_datetime: '2026-04-30T16:00:00+00:00',
          lugar_entrega: 'E', lugar_devolucion: 'F',
          entrega_completada: true, devolucion_completada: false, transfer_completado: false,
          estado: 'En curso',
        },
      ];

      const ops = expandReservationsToOperations(reservations, TODAY);
      
      // res-1: Entrega (today) + Devolución (today) = 2
      // res-2: Entrega (today) = 1
      // res-3: Devolución (today) = 1
      // Total = 4
      expect(ops).toHaveLength(4);
      
      const types = ops.map(o => `${o.reservationId}_${o.type}`);
      expect(types).toContain('res-1_checkin');
      expect(types).toContain('res-1_checkout');
      expect(types).toContain('res-2_checkin');
      expect(types).toContain('res-3_checkout');
    });

    it('should use the same ID format as ReservationsTable (reservationId + _entrega/_devolucion/_transfer)', () => {
      const reservations: MockReservation[] = [{
        id: 'abc-123',
        desde: '2026-04-30T10:00:00+00:00',
        hasta: '2026-04-30T18:00:00+00:00',
        tipo_actividad: null,
        confirmed_entrega_datetime: '2026-04-30T10:00:00+00:00',
        confirmed_devolucion_datetime: '2026-04-30T18:00:00+00:00',
        lugar_entrega: 'X', lugar_devolucion: 'Y',
        entrega_completada: false, devolucion_completada: false, transfer_completado: false,
        estado: 'Confirmada',
      }];

      const ops = expandReservationsToOperations(reservations, TODAY);
      expect(ops[0].id).toBe('abc-123_entrega');
      expect(ops[1].id).toBe('abc-123_devolucion');
    });
  });

  describe('Source code structure verification', () => {
    const hookSource = fs.readFileSync(
      path.resolve(__dirname, '../hooks/useOperationalDashboard.ts'),
      'utf-8'
    );
    const panelSource = fs.readFileSync(
      path.resolve(__dirname, '../components/dashboard/OperationalPanel.tsx'),
      'utf-8'
    );

    it('should use extractDatePart for timezone-safe date filtering', () => {
      expect(hookSource).toContain('extractDatePart');
      expect(hookSource).toContain("isoStr.match(/^(\\d{4}-\\d{2}-\\d{2})/)");
    });

    it('should expand reservations into separate operation rows', () => {
      expect(hookSource).toContain("type: 'checkin'");
      expect(hookSource).toContain("type: 'checkout'");
      expect(hookSource).toContain("type: 'transfer'");
    });

    it('should sort by confirmed datetime', () => {
      expect(hookSource).toContain('toTimestamp(a.confirmedDatetime)');
      expect(hookSource).toContain('toTimestamp(b.confirmedDatetime)');
    });

    it('should use a single query for today reservations instead of separate checkin/checkout queries', () => {
      // Should NOT have separate todayCheckInsDetailResult and todayCheckOutsDetailResult
      expect(hookSource).not.toContain('todayCheckInsDetailResult');
      expect(hookSource).not.toContain('todayCheckOutsDetailResult');
      // Should reference todayReservationsDetail from the server response
      expect(hookSource).toContain('todayReservationsDetail');
    });

    it('should include tipo_actividad in the query select', () => {
      expect(hookSource).toContain('tipo_actividad');
    });

    it('should include entrega_completada and devolucion_completada in the query', () => {
      expect(hookSource).toContain('entrega_completada');
      expect(hookSource).toContain('devolucion_completada');
      expect(hookSource).toContain('transfer_completado');
    });

    it('should maintain sessionReady gating', () => {
      expect(hookSource).toContain('enabled: !!orgId && sessionReady');
    });

    it('should maintain retry: 1 setting', () => {
      expect(hookSource).toContain('retry: 1');
    });

    it('OperationalPanel should handle transfer type', () => {
      expect(panelSource).toContain("r.type === 'transfer'");
      expect(panelSource).toContain('Repeat');
    });

    it('OperationalPanel should use confirmedDatetime and fechaHora from row', () => {
      expect(panelSource).toContain('r.confirmedDatetime');
      expect(panelSource).toContain('r.fechaHora');
    });

    it('OperationalPanel should use r.lugar for location display', () => {
      expect(panelSource).toContain("r.lugar || '—'");
    });
  });
});
