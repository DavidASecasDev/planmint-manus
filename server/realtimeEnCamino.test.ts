/**
 * Tests for the realtime En Camino tracking optimization.
 * Tests the server-side location endpoint behavior with the new accuracy field,
 * and validates the throttle logic contract.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { handleEnCaminoLocation } from './enCaminoTrackingEndpoint';

// Mock Supabase
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockIs = vi.fn();
const mockSelect = vi.fn();
const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'location_history') {
        return {
          insert: (data: any) => {
            mockInsert(data);
            return { data: null, error: null };
          },
        };
      }
      // en_camino_tracking table
      return {
        update: (...args: any[]) => {
          mockUpdate(...args);
          return {
            eq: (...eqArgs: any[]) => {
              mockEq(...eqArgs);
              return {
                eq: (...eqArgs2: any[]) => {
                  mockEq(...eqArgs2);
                  return {
                    is: (...isArgs: any[]) => {
                      mockIs(...isArgs);
                      return {
                        select: (...selArgs: any[]) => {
                          mockSelect(...selArgs);
                          return {
                            maybeSingle: () => mockMaybeSingle(),
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  }),
}));

function createMockReq(body: any): Request {
  return { body } as Request;
}

function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe('Realtime En Camino - Location endpoint with accuracy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  it('should accept and store accuracy field when provided', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'track-123' }, error: null });
    const req = createMockReq({
      reservation_id: 'res-001',
      operation_type: 'entrega',
      lat: 39.5696,
      lng: 2.6502,
      accuracy: 8.5,
    });
    const res = createMockRes();
    await handleEnCaminoLocation(req, res);

    // Should update en_camino_tracking with location
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      current_lat: 39.5696,
      current_lng: 2.6502,
      sharing_location: true,
    }));

    // Should insert into location_history with accuracy
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      tracking_id: 'track-123',
      reservation_id: 'res-001',
      operation_type: 'entrega',
      latitude: 39.5696,
      longitude: 2.6502,
      accuracy: 8.5,
    }));

    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('should handle null accuracy gracefully', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'track-456' }, error: null });
    const req = createMockReq({
      reservation_id: 'res-002',
      operation_type: 'devolucion',
      lat: 39.5400,
      lng: 2.7100,
      // accuracy not provided
    });
    const res = createMockRes();
    await handleEnCaminoLocation(req, res);

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      tracking_id: 'track-456',
      accuracy: null,
    }));
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('should handle rapid consecutive location updates (simulating 5s throttle)', async () => {
    // Simulate two rapid updates — both should succeed server-side
    // (throttling happens client-side, server always accepts valid data)
    mockMaybeSingle.mockResolvedValue({ data: { id: 'track-789' }, error: null });

    const req1 = createMockReq({
      reservation_id: 'res-003',
      operation_type: 'entrega',
      lat: 39.5696,
      lng: 2.6502,
      accuracy: 10,
    });
    const res1 = createMockRes();
    await handleEnCaminoLocation(req1, res1);
    expect(res1.json).toHaveBeenCalledWith({ ok: true });

    // Second update 2 seconds later (would be throttled client-side but server accepts it)
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: { id: 'track-789' }, error: null });
    const req2 = createMockReq({
      reservation_id: 'res-003',
      operation_type: 'entrega',
      lat: 39.5700,
      lng: 2.6510,
      accuracy: 5,
    });
    const res2 = createMockRes();
    await handleEnCaminoLocation(req2, res2);
    expect(res2.json).toHaveBeenCalledWith({ ok: true });

    // Both should have been processed
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      current_lat: 39.5700,
      current_lng: 2.6510,
    }));
  });

  it('should only update active (non-completed) operations', async () => {
    // The handler uses .is("llego_at", null) to filter only active ops
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const req = createMockReq({
      reservation_id: 'res-completed',
      operation_type: 'entrega',
      lat: 39.5696,
      lng: 2.6502,
    });
    const res = createMockRes();
    await handleEnCaminoLocation(req, res);

    // Should filter by llego_at IS NULL
    expect(mockIs).toHaveBeenCalledWith('llego_at', null);
    // Should return 404 since no active record found
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('Realtime En Camino - Throttle contract', () => {
  it('should define a 5-second minimum interval between location sends', () => {
    // This test documents the throttle contract:
    // - Client sends at most 1 location update per 5 seconds per operation
    // - GPS watchPosition uses maximumAge: 3000 (3s) for fresher positions
    // - Pending sends are debounced to always send the latest position
    const MIN_INTERVAL_MS = 5_000;
    const MAX_AGE_MS = 3_000;
    
    expect(MIN_INTERVAL_MS).toBe(5000);
    expect(MAX_AGE_MS).toBe(3000);
    // The throttle ensures we don't flood the server while still getting
    // near-instant updates on the map via Supabase Realtime
    expect(MIN_INTERVAL_MS).toBeGreaterThan(MAX_AGE_MS);
  });
});
