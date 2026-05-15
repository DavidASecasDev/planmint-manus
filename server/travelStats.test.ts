/**
 * Tests for en-camino-tracking/stats endpoint logic
 * and useLocationTrail trail management
 */
import { describe, it, expect } from 'vitest';

// ── Stats KPI calculation logic ──
describe('Travel Stats KPI calculations', () => {
  // Simulate the same logic used by the stats endpoint
  function computeKPIs(trips: Array<{
    en_camino_at: string;
    llego_at: string | null;
    estimated_minutes: number | null;
    real_minutes: number | null;
    operation_type: string;
  }>) {
    const total_trips = trips.length;
    const completed = trips.filter(t => t.llego_at != null).length;
    const with_estimate = trips.filter(t => t.estimated_minutes != null && t.llego_at != null).length;

    let on_time = 0;
    let late = 0;
    let very_late = 0;
    let totalReal = 0;
    let totalEstimated = 0;
    let totalDiff = 0;
    let entregas = 0;
    let devoluciones = 0;

    for (const t of trips) {
      if (t.operation_type === 'entrega') entregas++;
      else devoluciones++;

      if (t.real_minutes != null) totalReal += t.real_minutes;
      if (t.estimated_minutes != null) totalEstimated += t.estimated_minutes;

      if (t.estimated_minutes != null && t.real_minutes != null) {
        const diff = t.real_minutes - t.estimated_minutes;
        totalDiff += diff;
        if (diff <= 10) on_time++;
        else if (diff <= 20) late++;
        else very_late++;
      }
    }

    const on_time_percent = with_estimate > 0 ? Math.round((on_time / with_estimate) * 100) : 0;
    const avg_real = completed > 0 ? Math.round(totalReal / completed) : 0;
    const avg_estimated = with_estimate > 0 ? Math.round(totalEstimated / with_estimate) : 0;
    const avg_diff = with_estimate > 0 ? Math.round(totalDiff / with_estimate) : 0;

    return {
      total_trips,
      completed,
      with_estimate,
      on_time,
      late,
      very_late,
      on_time_percent,
      avg_real_minutes: avg_real,
      avg_estimated_minutes: avg_estimated,
      avg_diff_minutes: avg_diff,
      entregas,
      devoluciones,
    };
  }

  it('should compute correct KPIs for mixed trips', () => {
    const trips = [
      { en_camino_at: '2025-01-15T10:00:00Z', llego_at: '2025-01-15T10:25:00Z', estimated_minutes: 20, real_minutes: 25, operation_type: 'entrega' },
      { en_camino_at: '2025-01-15T11:00:00Z', llego_at: '2025-01-15T11:45:00Z', estimated_minutes: 15, real_minutes: 45, operation_type: 'devolucion' },
      { en_camino_at: '2025-01-15T12:00:00Z', llego_at: '2025-01-15T12:15:00Z', estimated_minutes: 20, real_minutes: 15, operation_type: 'entrega' },
      { en_camino_at: '2025-01-15T13:00:00Z', llego_at: null, estimated_minutes: 20, real_minutes: null, operation_type: 'entrega' },
    ];

    const kpis = computeKPIs(trips);

    expect(kpis.total_trips).toBe(4);
    expect(kpis.completed).toBe(3);
    expect(kpis.with_estimate).toBe(3);
    expect(kpis.on_time).toBe(2); // 25-20=5 (on_time), 45-15=30 (very_late), 15-20=-5 (on_time)
    expect(kpis.late).toBe(0);
    expect(kpis.very_late).toBe(1);
    expect(kpis.on_time_percent).toBe(67); // 2/3 = 66.7 -> 67
    expect(kpis.entregas).toBe(3);
    expect(kpis.devoluciones).toBe(1);
  });

  it('should handle empty trips', () => {
    const kpis = computeKPIs([]);
    expect(kpis.total_trips).toBe(0);
    expect(kpis.on_time_percent).toBe(0);
    expect(kpis.avg_real_minutes).toBe(0);
  });

  it('should handle all on-time trips', () => {
    const trips = [
      { en_camino_at: '2025-01-15T10:00:00Z', llego_at: '2025-01-15T10:20:00Z', estimated_minutes: 20, real_minutes: 20, operation_type: 'entrega' },
      { en_camino_at: '2025-01-15T11:00:00Z', llego_at: '2025-01-15T11:15:00Z', estimated_minutes: 20, real_minutes: 15, operation_type: 'devolucion' },
    ];
    const kpis = computeKPIs(trips);
    expect(kpis.on_time_percent).toBe(100);
    expect(kpis.on_time).toBe(2);
    expect(kpis.late).toBe(0);
    expect(kpis.very_late).toBe(0);
  });

  it('should handle trips without estimates', () => {
    const trips = [
      { en_camino_at: '2025-01-15T10:00:00Z', llego_at: '2025-01-15T10:25:00Z', estimated_minutes: null, real_minutes: 25, operation_type: 'entrega' },
    ];
    const kpis = computeKPIs(trips);
    expect(kpis.with_estimate).toBe(0);
    expect(kpis.on_time_percent).toBe(0);
    expect(kpis.completed).toBe(1);
  });
});

// ── Trail management logic ──
describe('Location trail management', () => {
  interface TrailPosition {
    lat: number;
    lng: number;
    accuracy: number | null;
    time: string;
  }

  type TrailMap = Record<string, TrailPosition[]>;

  // Simulate the trail update logic from useLocationTrail
  function applyNewPosition(trails: TrailMap, trackingId: string, newPos: TrailPosition): TrailMap {
    const existing = trails[trackingId];
    if (!existing) return trails; // Only update trails we're tracking
    return {
      ...trails,
      [trackingId]: [...existing, newPos],
    };
  }

  function cleanupTrails(trails: TrailMap, activeIds: Set<string>): TrailMap {
    const next: TrailMap = {};
    for (const [id, positions] of Object.entries(trails)) {
      if (activeIds.has(id)) {
        next[id] = positions;
      }
    }
    return next;
  }

  it('should append new position to existing trail', () => {
    const trails: TrailMap = {
      'track-1': [
        { lat: 39.57, lng: 2.65, accuracy: 10, time: '2025-01-15T10:00:00Z' },
      ],
    };

    const newPos: TrailPosition = { lat: 39.58, lng: 2.66, accuracy: 8, time: '2025-01-15T10:00:05Z' };
    const updated = applyNewPosition(trails, 'track-1', newPos);

    expect(updated['track-1']).toHaveLength(2);
    expect(updated['track-1'][1].lat).toBe(39.58);
  });

  it('should not add position for unknown tracking id', () => {
    const trails: TrailMap = {
      'track-1': [{ lat: 39.57, lng: 2.65, accuracy: 10, time: '2025-01-15T10:00:00Z' }],
    };

    const newPos: TrailPosition = { lat: 39.58, lng: 2.66, accuracy: 8, time: '2025-01-15T10:00:05Z' };
    const updated = applyNewPosition(trails, 'track-unknown', newPos);

    expect(updated).toBe(trails); // Same reference, no change
    expect(updated['track-1']).toHaveLength(1);
  });

  it('should cleanup trails for inactive records', () => {
    const trails: TrailMap = {
      'track-1': [{ lat: 39.57, lng: 2.65, accuracy: 10, time: '2025-01-15T10:00:00Z' }],
      'track-2': [{ lat: 39.58, lng: 2.66, accuracy: 8, time: '2025-01-15T10:00:05Z' }],
      'track-3': [{ lat: 39.59, lng: 2.67, accuracy: 12, time: '2025-01-15T10:00:10Z' }],
    };

    const activeIds = new Set(['track-1', 'track-3']);
    const cleaned = cleanupTrails(trails, activeIds);

    expect(Object.keys(cleaned)).toHaveLength(2);
    expect(cleaned['track-1']).toBeDefined();
    expect(cleaned['track-2']).toBeUndefined();
    expect(cleaned['track-3']).toBeDefined();
  });

  it('should preserve trail order (oldest first)', () => {
    let trails: TrailMap = {
      'track-1': [],
    };

    const positions = [
      { lat: 39.57, lng: 2.65, accuracy: 10, time: '2025-01-15T10:00:00Z' },
      { lat: 39.58, lng: 2.66, accuracy: 8, time: '2025-01-15T10:00:05Z' },
      { lat: 39.59, lng: 2.67, accuracy: 12, time: '2025-01-15T10:00:10Z' },
    ];

    for (const pos of positions) {
      trails = applyNewPosition(trails, 'track-1', pos);
    }

    expect(trails['track-1']).toHaveLength(3);
    expect(trails['track-1'][0].time).toBe('2025-01-15T10:00:00Z');
    expect(trails['track-1'][2].time).toBe('2025-01-15T10:00:10Z');
  });
});

// ── Daily trend aggregation ──
describe('Daily trend aggregation', () => {
  function aggregateDailyTrend(trips: Array<{
    date: string;
    llego_at: string | null;
    estimated_minutes: number | null;
    real_minutes: number | null;
  }>) {
    const byDate: Record<string, typeof trips> = {};
    for (const t of trips) {
      if (!byDate[t.date]) byDate[t.date] = [];
      byDate[t.date].push(t);
    }

    return Object.entries(byDate).map(([date, dayTrips]) => {
      const total = dayTrips.length;
      const completed = dayTrips.filter(t => t.llego_at != null).length;
      const withEstimate = dayTrips.filter(t => t.estimated_minutes != null && t.real_minutes != null);
      const on_time = withEstimate.filter(t => (t.real_minutes! - t.estimated_minutes!) <= 10).length;
      const late = total - on_time;
      const on_time_percent = withEstimate.length > 0 ? Math.round((on_time / withEstimate.length) * 100) : 0;
      const avg_real = completed > 0 ? Math.round(dayTrips.filter(t => t.real_minutes != null).reduce((s, t) => s + t.real_minutes!, 0) / completed) : 0;
      const avg_estimated = withEstimate.length > 0 ? Math.round(withEstimate.reduce((s, t) => s + t.estimated_minutes!, 0) / withEstimate.length) : 0;

      return { date, total, completed, on_time, late, on_time_percent, avg_real, avg_estimated };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }

  it('should aggregate trips by date correctly', () => {
    const trips = [
      { date: '2025-01-15', llego_at: '2025-01-15T10:25:00Z', estimated_minutes: 20, real_minutes: 25 },
      { date: '2025-01-15', llego_at: '2025-01-15T11:45:00Z', estimated_minutes: 15, real_minutes: 45 },
      { date: '2025-01-16', llego_at: '2025-01-16T10:15:00Z', estimated_minutes: 20, real_minutes: 15 },
    ];

    const trend = aggregateDailyTrend(trips);

    expect(trend).toHaveLength(2);
    expect(trend[0].date).toBe('2025-01-15');
    expect(trend[0].total).toBe(2);
    expect(trend[1].date).toBe('2025-01-16');
    expect(trend[1].total).toBe(1);
    expect(trend[1].on_time_percent).toBe(100);
  });

  it('should sort dates chronologically', () => {
    const trips = [
      { date: '2025-01-17', llego_at: 'x', estimated_minutes: 10, real_minutes: 10 },
      { date: '2025-01-15', llego_at: 'x', estimated_minutes: 10, real_minutes: 10 },
      { date: '2025-01-16', llego_at: 'x', estimated_minutes: 10, real_minutes: 10 },
    ];

    const trend = aggregateDailyTrend(trips);
    expect(trend[0].date).toBe('2025-01-15');
    expect(trend[1].date).toBe('2025-01-16');
    expect(trend[2].date).toBe('2025-01-17');
  });
});
