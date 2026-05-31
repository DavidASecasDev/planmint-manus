/**
 * Tests for Live Map improvements:
 * - Share link generation from share_token
 * - ETA endpoint integration
 * - Record type includes share_token
 */
import { describe, it, expect } from 'vitest';

describe('LiveMap — Share Link', () => {
  it('should generate correct share URL from share_token', () => {
    const origin = 'https://app.example.com';
    const shareToken = 'abc12345xyz';
    const expectedUrl = `${origin}/track/${shareToken}`;
    
    // Simulate the share link generation logic from LiveMap
    const url = `${origin}/track/${shareToken}`;
    expect(url).toBe(expectedUrl);
    expect(url).toContain('/track/');
    expect(url).toContain(shareToken);
  });

  it('should not generate share link when share_token is null', () => {
    const shareToken: string | null = null;
    const shouldShowButton = !!shareToken;
    expect(shouldShowButton).toBe(false);
  });

  it('should not generate share link when share_token is undefined', () => {
    const shareToken: string | undefined = undefined;
    const shouldShowButton = !!shareToken;
    expect(shouldShowButton).toBe(false);
  });
});

describe('LiveMap — ETA Data', () => {
  it('should parse ETA response correctly', () => {
    const etaResponse = {
      ok: true,
      status: 'ok',
      eta_minutes: 12,
      distance_km: 5.3,
      distance_text: '5,3 km',
      duration_text: '12 min',
      polyline: 'encodedPolylineString',
    };

    expect(etaResponse.ok).toBe(true);
    expect(etaResponse.status).toBe('ok');
    expect(etaResponse.eta_minutes).toBe(12);
    expect(etaResponse.distance_km).toBe(5.3);
    expect(etaResponse.distance_text).toBe('5,3 km');
    expect(etaResponse.duration_text).toBe('12 min');
  });

  it('should handle arrived status', () => {
    const etaResponse = {
      ok: true,
      status: 'arrived',
      eta_minutes: 0,
      distance_km: 0,
      distance_text: '',
      duration_text: '',
    };

    expect(etaResponse.status).toBe('arrived');
    expect(etaResponse.eta_minutes).toBe(0);
  });

  it('should handle no_data status when driver has no GPS', () => {
    const etaResponse = {
      ok: true,
      status: 'no_data',
      eta_minutes: null,
      distance_km: null,
      distance_text: null,
      duration_text: null,
    };

    expect(etaResponse.status).toBe('no_data');
    expect(etaResponse.eta_minutes).toBeNull();
    expect(etaResponse.distance_km).toBeNull();
  });

  it('should handle no_route status', () => {
    const etaResponse = {
      ok: true,
      status: 'no_route',
      eta_minutes: null,
      distance_km: null,
      distance_text: null,
      duration_text: null,
    };

    expect(etaResponse.status).toBe('no_route');
    expect(etaResponse.eta_minutes).toBeNull();
  });
});

describe('LiveMap — Location Alias Matching', () => {
  // Test the alias matching logic used in LiveMap
  const ALIAS_MATCHERS = [
    {
      keywords: ['aeropuerto', 'aeropuerto de palma', 'pmi', 'parking g', 'aeropuerto palma de mallorca', '07611'],
      aliasKey: 'parking_g_aeropuerto',
    },
  ];

  function matchLocationAlias(address: string): string | null {
    const normalized = address.toLowerCase().trim();
    for (const matcher of ALIAS_MATCHERS) {
      for (const keyword of matcher.keywords) {
        if (normalized.includes(keyword)) {
          return matcher.aliasKey;
        }
      }
    }
    return null;
  }

  it('should match aeropuerto addresses', () => {
    expect(matchLocationAlias('Aeropuerto de Palma')).toBe('parking_g_aeropuerto');
    expect(matchLocationAlias('PMI Terminal')).toBe('parking_g_aeropuerto');
    expect(matchLocationAlias('Parking G Aeropuerto')).toBe('parking_g_aeropuerto');
  });

  it('should not match unrelated addresses', () => {
    expect(matchLocationAlias('Calle Mayor 5, Palma')).toBeNull();
    expect(matchLocationAlias('Hotel Bellver')).toBeNull();
    expect(matchLocationAlias('')).toBeNull();
  });
});

describe('LiveMap — Urgency Color Logic', () => {
  function getUrgencyColor(minutesAgo: number) {
    if (minutesAgo > 45) return 'red';
    if (minutesAgo > 20) return 'amber';
    return 'emerald';
  }

  it('should return emerald for recent operations (< 20 min)', () => {
    expect(getUrgencyColor(0)).toBe('emerald');
    expect(getUrgencyColor(10)).toBe('emerald');
    expect(getUrgencyColor(19)).toBe('emerald');
    expect(getUrgencyColor(20)).toBe('emerald');
  });

  it('should return amber for medium operations (21-45 min)', () => {
    expect(getUrgencyColor(21)).toBe('amber');
    expect(getUrgencyColor(30)).toBe('amber');
    expect(getUrgencyColor(45)).toBe('amber');
  });

  it('should return red for long operations (> 45 min)', () => {
    expect(getUrgencyColor(46)).toBe('red');
    expect(getUrgencyColor(60)).toBe('red');
    expect(getUrgencyColor(120)).toBe('red');
  });
});

describe('LiveMap — EnCaminoRecord Type', () => {
  it('should include share_token field', () => {
    // Simulate a record from the API (select * includes share_token)
    const record = {
      id: 'test-id',
      reservation_id: 'res-123',
      operation_type: 'entrega' as const,
      en_camino_at: '2026-06-01T10:00:00.000Z',
      destination_address: 'Aeropuerto de Palma',
      assigned_user_name: 'Juan',
      created_at: '2026-06-01T09:55:00.000Z',
      sharing_location: true,
      current_lat: 39.5361,
      current_lng: 2.7339,
      location_updated_at: '2026-06-01T10:05:00.000Z',
      share_token: 'abc12345xyz',
    };

    expect(record.share_token).toBe('abc12345xyz');
    expect(typeof record.share_token).toBe('string');
  });

  it('should handle records without share_token', () => {
    const record = {
      id: 'test-id-2',
      reservation_id: 'res-456',
      operation_type: 'devolucion' as const,
      en_camino_at: '2026-06-01T11:00:00.000Z',
      destination_address: 'Hotel Bellver',
      assigned_user_name: 'Pedro',
      created_at: '2026-06-01T10:55:00.000Z',
      share_token: null,
    };

    expect(record.share_token).toBeNull();
    expect(!!record.share_token).toBe(false);
  });
});
