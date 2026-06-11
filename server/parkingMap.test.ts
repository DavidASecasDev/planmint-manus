/**
 * Tests for Parking Map view logic
 * Validates the grid layout computation and spot status classification
 */
import { describe, it, expect } from 'vitest';

// Simulate the types used in the Parking page
interface ParkingSpot {
  id: string;
  zone_id: string;
  spot_number: number;
  label: string | null;
  status: 'free' | 'occupied' | 'reserved' | 'blocked';
  vehicle_id: string | null;
  vehicle_matricula: string | null;
  occupied_at: string | null;
  occupied_by: string | null;
  grid_row: number | null;
  grid_col: number | null;
}

interface ParkingZone {
  id: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  spots: ParkingSpot[];
}

// Helper: build grid map (same logic as component)
function buildGridMap(spots: ParkingSpot[]) {
  const map = new Map<string, ParkingSpot>();
  spots.forEach(spot => {
    const key = `${spot.grid_row ?? 0}-${spot.grid_col ?? 0}`;
    map.set(key, spot);
  });
  return map;
}

// Helper: compute occupied spots list across zones
function getOccupiedSpots(zones: ParkingZone[]) {
  const spots: (ParkingSpot & { zoneName: string; zoneColor: string })[] = [];
  zones.forEach(zone => {
    zone.spots
      .filter(s => s.status === 'occupied')
      .forEach(spot => {
        spots.push({ ...spot, zoneName: zone.name, zoneColor: zone.color });
      });
  });
  return spots.sort((a, b) => a.spot_number - b.spot_number);
}

// Helper: compute time label
function computeTimeLabel(occupiedAt: string | null): string | null {
  if (!occupiedAt) return null;
  const diff = Date.now() - new Date(occupiedAt).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return '<1h';
}

function makeSpot(overrides: Partial<ParkingSpot> & { spot_number: number }): ParkingSpot {
  return {
    id: `spot-${overrides.spot_number}`,
    zone_id: 'zone-1',
    label: null,
    status: 'free',
    vehicle_id: null,
    vehicle_matricula: null,
    occupied_at: null,
    occupied_by: null,
    grid_row: 0,
    grid_col: 0,
    ...overrides,
  };
}

describe('Parking Map - Grid Layout', () => {
  it('builds correct grid map from spots with row/col', () => {
    const spots: ParkingSpot[] = [
      makeSpot({ spot_number: 1, grid_row: 0, grid_col: 0 }),
      makeSpot({ spot_number: 2, grid_row: 0, grid_col: 1 }),
      makeSpot({ spot_number: 3, grid_row: 1, grid_col: 0 }),
    ];

    const map = buildGridMap(spots);
    expect(map.size).toBe(3);
    expect(map.get('0-0')?.spot_number).toBe(1);
    expect(map.get('0-1')?.spot_number).toBe(2);
    expect(map.get('1-0')?.spot_number).toBe(3);
    expect(map.get('1-1')).toBeUndefined(); // empty cell
  });

  it('handles null grid_row/col by defaulting to 0', () => {
    const spots: ParkingSpot[] = [
      makeSpot({ spot_number: 1, grid_row: null, grid_col: null }),
    ];

    const map = buildGridMap(spots);
    expect(map.get('0-0')?.spot_number).toBe(1);
  });

  it('computes max row and col correctly', () => {
    const spots: ParkingSpot[] = [
      makeSpot({ spot_number: 1, grid_row: 0, grid_col: 0 }),
      makeSpot({ spot_number: 2, grid_row: 4, grid_col: 10 }),
    ];

    const maxRow = Math.max(...spots.map(s => s.grid_row ?? 0), 0);
    const maxCol = Math.max(...spots.map(s => s.grid_col ?? 0), 0);
    expect(maxRow).toBe(4);
    expect(maxCol).toBe(10);
  });
});

describe('Parking Map - Occupied Spots List', () => {
  it('collects only occupied spots across zones', () => {
    const zones: ParkingZone[] = [
      {
        id: 'z1', name: 'Principal', description: null, color: '#22c55e', sort_order: 0,
        spots: [
          makeSpot({ spot_number: 1, status: 'occupied', vehicle_matricula: '1234ABC' }),
          makeSpot({ spot_number: 2, status: 'free' }),
        ],
      },
      {
        id: 'z2', name: 'Central', description: null, color: '#3b82f6', sort_order: 1,
        spots: [
          makeSpot({ spot_number: 44, status: 'occupied', vehicle_matricula: '5678DEF' }),
          makeSpot({ spot_number: 45, status: 'blocked' }),
        ],
      },
    ];

    const occupied = getOccupiedSpots(zones);
    expect(occupied).toHaveLength(2);
    expect(occupied[0].spot_number).toBe(1);
    expect(occupied[0].vehicle_matricula).toBe('1234ABC');
    expect(occupied[0].zoneName).toBe('Principal');
    expect(occupied[1].spot_number).toBe(44);
    expect(occupied[1].vehicle_matricula).toBe('5678DEF');
    expect(occupied[1].zoneName).toBe('Central');
  });

  it('returns empty array when no spots are occupied', () => {
    const zones: ParkingZone[] = [
      {
        id: 'z1', name: 'Principal', description: null, color: '#22c55e', sort_order: 0,
        spots: [
          makeSpot({ spot_number: 1, status: 'free' }),
          makeSpot({ spot_number: 2, status: 'blocked' }),
        ],
      },
    ];

    const occupied = getOccupiedSpots(zones);
    expect(occupied).toHaveLength(0);
  });

  it('sorts occupied spots by spot_number', () => {
    const zones: ParkingZone[] = [
      {
        id: 'z1', name: 'Test', description: null, color: '#000', sort_order: 0,
        spots: [
          makeSpot({ spot_number: 50, status: 'occupied', vehicle_matricula: 'AAA' }),
          makeSpot({ spot_number: 10, status: 'occupied', vehicle_matricula: 'BBB' }),
          makeSpot({ spot_number: 30, status: 'occupied', vehicle_matricula: 'CCC' }),
        ],
      },
    ];

    const occupied = getOccupiedSpots(zones);
    expect(occupied.map(s => s.spot_number)).toEqual([10, 30, 50]);
  });
});

describe('Parking Map - Time Labels', () => {
  it('returns null for null occupied_at', () => {
    expect(computeTimeLabel(null)).toBeNull();
  });

  it('returns <1h for recent occupation', () => {
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    expect(computeTimeLabel(thirtyMinAgo)).toBe('<1h');
  });

  it('returns hours for occupation within same day', () => {
    const now = new Date();
    const fiveHoursAgo = new Date(now.getTime() - 5 * 3600 * 1000).toISOString();
    expect(computeTimeLabel(fiveHoursAgo)).toBe('5h');
  });

  it('returns days for multi-day occupation', () => {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 3600 * 1000).toISOString();
    expect(computeTimeLabel(threeDaysAgo)).toBe('3d');
  });
});

describe('Parking Map - Spot Status Classification', () => {
  it('correctly identifies free vs occupied vs blocked counts', () => {
    const spots: ParkingSpot[] = [
      makeSpot({ spot_number: 1, status: 'free' }),
      makeSpot({ spot_number: 2, status: 'free' }),
      makeSpot({ spot_number: 3, status: 'occupied', vehicle_matricula: 'ABC' }),
      makeSpot({ spot_number: 4, status: 'blocked' }),
      makeSpot({ spot_number: 5, status: 'reserved' }),
    ];

    const freeCount = spots.filter(s => s.status === 'free').length;
    const occupiedCount = spots.filter(s => s.status === 'occupied').length;
    const blockedCount = spots.filter(s => s.status === 'blocked').length;

    expect(freeCount).toBe(2);
    expect(occupiedCount).toBe(1);
    expect(blockedCount).toBe(1);
  });
});
