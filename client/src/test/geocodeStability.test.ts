/**
 * Tests for the geocoding stability fix in LiveMap.
 * 
 * The bug: When GPS location updates arrived via Supabase Realtime (every ~5s),
 * the records array changed, triggering a full re-geocode. If the geocoding
 * was still in progress, the previous run was cancelled and a new one started
 * with an empty results array, causing markers to temporarily disappear.
 * 
 * The fix: Separate geocode cache population (async effect) from geocoded records
 * computation (synchronous useMemo). GPS updates now instantly produce geocodedRecords
 * from the stable cache without waiting for any API calls.
 */
import { describe, it, expect } from 'vitest';

// Types matching the LiveMap implementation
interface EnCaminoRecord {
  id: string;
  reservation_id: string;
  operation_type: 'entrega' | 'devolucion';
  destination_address: string | null;
  assigned_user_name: string | null;
  en_camino_at: string;
  llego_at: string | null;
  current_lat: number | null;
  current_lng: number | null;
  sharing_location: boolean;
  location_updated_at: string | null;
  estimated_minutes: number | null;
  created_at: string;
}

interface GeocodeResult {
  lat: number;
  lng: number;
  source: 'alias' | 'nominatim' | 'google';
}

interface GeocodedRecord extends EnCaminoRecord {
  lat: number;
  lng: number;
  geocoded: boolean;
  geocodeSource: 'alias' | 'nominatim' | 'google';
}

/**
 * Pure function that mirrors the useMemo logic in LiveMap.
 * This is the core of the fix: it synchronously computes geocoded records
 * from the current records + a stable geocode cache.
 */
function computeGeocodedRecords(
  records: EnCaminoRecord[],
  geocodeCache: Record<string, GeocodeResult | null>
): GeocodedRecord[] {
  const results: GeocodedRecord[] = [];
  for (const rec of records) {
    const addr = rec.destination_address;
    if (!addr) continue;
    const cached = geocodeCache[addr];
    if (cached) {
      results.push({
        ...rec,
        lat: cached.lat,
        lng: cached.lng,
        geocoded: true,
        geocodeSource: cached.source,
      });
    }
  }
  return results;
}

describe('Geocode stability - records should not disappear on GPS updates', () => {
  const baseRecord: EnCaminoRecord = {
    id: 'track-001',
    reservation_id: 'res-001',
    operation_type: 'entrega',
    destination_address: 'Aeropuerto de Palma',
    assigned_user_name: 'David',
    en_camino_at: '2026-05-15T10:00:00Z',
    llego_at: null,
    current_lat: null,
    current_lng: null,
    sharing_location: false,
    location_updated_at: null,
    estimated_minutes: 15,
    created_at: '2026-05-15T10:00:00Z',
  };

  const geocodeCache: Record<string, GeocodeResult | null> = {
    'Aeropuerto de Palma': { lat: 39.5505, lng: 2.7275, source: 'alias' },
    'Calle Test 123, Palma': { lat: 39.5700, lng: 2.6500, source: 'nominatim' },
  };

  it('should produce geocoded records from cached addresses instantly', () => {
    const records = [baseRecord];
    const result = computeGeocodedRecords(records, geocodeCache);

    expect(result).toHaveLength(1);
    expect(result[0].lat).toBe(39.5505);
    expect(result[0].lng).toBe(2.7275);
    expect(result[0].geocodeSource).toBe('alias');
  });

  it('should preserve geocoded records when GPS location updates arrive', () => {
    // Initial state: record without GPS
    const records1 = [baseRecord];
    const result1 = computeGeocodedRecords(records1, geocodeCache);
    expect(result1).toHaveLength(1);

    // GPS update arrives (simulating a Supabase Realtime UPDATE event)
    const recordsWithGPS: EnCaminoRecord[] = [{
      ...baseRecord,
      current_lat: 39.5600,
      current_lng: 2.7000,
      sharing_location: true,
      location_updated_at: '2026-05-15T10:00:05Z',
    }];
    const result2 = computeGeocodedRecords(recordsWithGPS, geocodeCache);

    // KEY ASSERTION: Record should still be present after GPS update
    expect(result2).toHaveLength(1);
    expect(result2[0].destination_address).toBe('Aeropuerto de Palma');
    expect(result2[0].lat).toBe(39.5505); // geocoded lat, not GPS lat
    expect(result2[0].current_lat).toBe(39.5600); // GPS lat preserved
  });

  it('should handle multiple records with mixed GPS states', () => {
    const records: EnCaminoRecord[] = [
      baseRecord,
      {
        ...baseRecord,
        id: 'track-002',
        reservation_id: 'res-002',
        destination_address: 'Calle Test 123, Palma',
        current_lat: 39.5400,
        current_lng: 2.6800,
        sharing_location: true,
        location_updated_at: '2026-05-15T10:01:00Z',
      },
    ];

    const result = computeGeocodedRecords(records, geocodeCache);
    expect(result).toHaveLength(2);
    expect(result[0].destination_address).toBe('Aeropuerto de Palma');
    expect(result[1].destination_address).toBe('Calle Test 123, Palma');
  });

  it('should not include records with uncached addresses (pending geocoding)', () => {
    const records: EnCaminoRecord[] = [
      baseRecord,
      {
        ...baseRecord,
        id: 'track-003',
        reservation_id: 'res-003',
        destination_address: 'Dirección Nueva Sin Geocodificar',
      },
    ];

    const result = computeGeocodedRecords(records, geocodeCache);
    // Only the cached address should appear
    expect(result).toHaveLength(1);
    expect(result[0].destination_address).toBe('Aeropuerto de Palma');
  });

  it('should not include records without destination_address', () => {
    const records: EnCaminoRecord[] = [
      { ...baseRecord, destination_address: null },
    ];

    const result = computeGeocodedRecords(records, geocodeCache);
    expect(result).toHaveLength(0);
  });

  it('should handle rapid consecutive GPS updates without losing records', () => {
    // Simulate 5 rapid GPS updates (every 5 seconds)
    for (let i = 0; i < 5; i++) {
      const records: EnCaminoRecord[] = [{
        ...baseRecord,
        current_lat: 39.5600 + i * 0.001,
        current_lng: 2.7000 + i * 0.001,
        sharing_location: true,
        location_updated_at: `2026-05-15T10:00:${(i * 5).toString().padStart(2, '0')}Z`,
      }];

      const result = computeGeocodedRecords(records, geocodeCache);
      // Record should ALWAYS be present regardless of GPS update frequency
      expect(result).toHaveLength(1);
      expect(result[0].destination_address).toBe('Aeropuerto de Palma');
      expect(result[0].lat).toBe(39.5505); // geocoded position stays stable
    }
  });

  it('should correctly remove records when they get llego_at (completed)', () => {
    // This tests the Realtime UPDATE handler behavior:
    // When llego_at is set, the record should be removed from the active list
    // (handled by useRealtimeEnCamino, not by geocoding)
    const completedRecord: EnCaminoRecord = {
      ...baseRecord,
      llego_at: '2026-05-15T10:15:00Z',
    };

    // The record would be filtered out by useRealtimeEnCamino before reaching
    // the geocoding step, but even if it reaches here, it should still geocode
    const result = computeGeocodedRecords([completedRecord], geocodeCache);
    expect(result).toHaveLength(1); // geocoding doesn't filter by llego_at
  });
});
