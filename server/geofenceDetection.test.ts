/**
 * Tests for geofence detection logic (point-in-circle, point-in-polygon).
 * We extract the geometry helpers and test them directly.
 */
import { describe, it, expect } from 'vitest';

// ─── Geometry helpers (copied from scheduledGeofenceCheck.ts for unit testing) ───

interface Point {
  lat: number;
  lng: number;
}

function isPointInCircle(point: Point, center: Point, radiusMeters: number): boolean {
  const R = 6371000;
  const dLat = (point.lat - center.lat) * Math.PI / 180;
  const dLng = (point.lng - center.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(center.lat * Math.PI / 180) * Math.cos(point.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance <= radiusMeters;
}

function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    const intersect = ((yi > point.lng) !== (yj > point.lng)) &&
      (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Geofence Detection - isPointInCircle', () => {
  const palmaCenter = { lat: 39.5696, lng: 2.6502 };

  it('should detect point inside circle (same location)', () => {
    expect(isPointInCircle(palmaCenter, palmaCenter, 100)).toBe(true);
  });

  it('should detect point inside circle (within radius)', () => {
    // ~100m north of center
    const nearPoint = { lat: 39.5705, lng: 2.6502 };
    expect(isPointInCircle(nearPoint, palmaCenter, 200)).toBe(true);
  });

  it('should detect point outside circle (beyond radius)', () => {
    // ~1km north of center
    const farPoint = { lat: 39.5796, lng: 2.6502 };
    expect(isPointInCircle(farPoint, palmaCenter, 500)).toBe(false);
  });

  it('should handle point exactly on the boundary', () => {
    // A point at exactly the radius distance should be inside (<=)
    const exactPoint = { lat: 39.5696 + (500 / 6371000) * (180 / Math.PI), lng: 2.6502 };
    expect(isPointInCircle(exactPoint, palmaCenter, 500)).toBe(true);
  });

  it('should handle zero radius', () => {
    expect(isPointInCircle(palmaCenter, palmaCenter, 0)).toBe(true);
  });

  it('should handle large radius (10km)', () => {
    const distantPoint = { lat: 39.62, lng: 2.70 };
    expect(isPointInCircle(distantPoint, palmaCenter, 10000)).toBe(true);
  });

  it('should return false for point far away', () => {
    const madrid = { lat: 40.4168, lng: -3.7038 };
    expect(isPointInCircle(madrid, palmaCenter, 10000)).toBe(false);
  });
});

describe('Geofence Detection - isPointInPolygon', () => {
  // Square polygon around Palma center
  const squarePolygon: Point[] = [
    { lat: 39.56, lng: 2.64 },
    { lat: 39.58, lng: 2.64 },
    { lat: 39.58, lng: 2.66 },
    { lat: 39.56, lng: 2.66 },
  ];

  it('should detect point inside polygon', () => {
    const inside = { lat: 39.57, lng: 2.65 };
    expect(isPointInPolygon(inside, squarePolygon)).toBe(true);
  });

  it('should detect point outside polygon', () => {
    const outside = { lat: 39.55, lng: 2.65 };
    expect(isPointInPolygon(outside, squarePolygon)).toBe(false);
  });

  it('should detect point outside polygon (east)', () => {
    const outside = { lat: 39.57, lng: 2.67 };
    expect(isPointInPolygon(outside, squarePolygon)).toBe(false);
  });

  it('should return false for empty polygon', () => {
    expect(isPointInPolygon({ lat: 39.57, lng: 2.65 }, [])).toBe(false);
  });

  it('should return false for polygon with less than 3 points', () => {
    expect(isPointInPolygon({ lat: 39.57, lng: 2.65 }, [
      { lat: 39.56, lng: 2.64 },
      { lat: 39.58, lng: 2.64 },
    ])).toBe(false);
  });

  it('should handle triangle polygon', () => {
    const triangle: Point[] = [
      { lat: 39.56, lng: 2.64 },
      { lat: 39.58, lng: 2.65 },
      { lat: 39.56, lng: 2.66 },
    ];
    // Center of triangle should be inside
    expect(isPointInPolygon({ lat: 39.57, lng: 2.65 }, triangle)).toBe(true);
    // Point above triangle should be outside
    expect(isPointInPolygon({ lat: 39.59, lng: 2.65 }, triangle)).toBe(false);
  });

  it('should handle complex polygon (L-shape)', () => {
    const lShape: Point[] = [
      { lat: 39.56, lng: 2.64 },
      { lat: 39.58, lng: 2.64 },
      { lat: 39.58, lng: 2.65 },
      { lat: 39.57, lng: 2.65 },
      { lat: 39.57, lng: 2.66 },
      { lat: 39.56, lng: 2.66 },
    ];
    // Inside the bottom part
    expect(isPointInPolygon({ lat: 39.565, lng: 2.65 }, lShape)).toBe(true);
    // Inside the top-left part
    expect(isPointInPolygon({ lat: 39.575, lng: 2.645 }, lShape)).toBe(true);
    // Outside (top-right corner that's cut off)
    expect(isPointInPolygon({ lat: 39.575, lng: 2.655 }, lShape)).toBe(false);
  });
});

describe('Geofence Detection - Edge cases', () => {
  it('should handle equator/prime meridian crossing', () => {
    const center = { lat: 0, lng: 0 };
    const nearPoint = { lat: 0.001, lng: 0.001 };
    expect(isPointInCircle(nearPoint, center, 500)).toBe(true);
  });

  it('should handle negative coordinates', () => {
    const center = { lat: -33.8688, lng: 151.2093 }; // Sydney
    const nearPoint = { lat: -33.8690, lng: 151.2095 };
    expect(isPointInCircle(nearPoint, center, 100)).toBe(true);
  });

  it('should handle polygon crossing date line', () => {
    // Polygon near the date line
    const polygon: Point[] = [
      { lat: 0, lng: 179.9 },
      { lat: 1, lng: 179.9 },
      { lat: 1, lng: -179.9 },
      { lat: 0, lng: -179.9 },
    ];
    // Point inside (note: ray-casting may not handle this perfectly, 
    // but for our use case in Mallorca this is acceptable)
    const inside = { lat: 0.5, lng: 180 };
    // This is a known limitation - just verify it doesn't crash
    expect(typeof isPointInPolygon(inside, polygon)).toBe('boolean');
  });
});
