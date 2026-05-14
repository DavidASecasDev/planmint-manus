import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { handleEnCaminoLocation, handleEnCaminoLocationStop, handleEnCaminoLocationHistory } from './enCaminoTrackingEndpoint';

// Mock Supabase
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockIs = vi.fn();
const mockSelect = vi.fn();
const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();
const mockOrder = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'location_history') {
        return {
          insert: (data: any) => {
            mockInsert(data);
            return { data: null, error: null };
          },
          select: (cols: string) => {
            mockSelect(cols);
            return {
              order: (col: string, opts: any) => {
                mockOrder(col, opts);
                return {
                  eq: (col2: string, val2: any) => {
                    mockEq(col2, val2);
                    return {
                      eq: (col3: string, val3: any) => {
                        mockEq(col3, val3);
                        return {
                          data: [
                            { latitude: 39.55, longitude: 2.73, accuracy: 10, recorded_at: '2026-05-14T10:00:00Z' },
                            { latitude: 39.56, longitude: 2.74, accuracy: 8, recorded_at: '2026-05-14T10:00:15Z' },
                          ],
                          error: null,
                        };
                      },
                    };
                  },
                };
              },
            };
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

describe('handleEnCaminoLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  it('should return 400 if reservation_id is missing', async () => {
    const req = createMockReq({ operation_type: 'entrega', lat: 39.5, lng: 2.7 });
    const res = createMockRes();
    await handleEnCaminoLocation(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  it('should return 400 if lat/lng are missing', async () => {
    const req = createMockReq({ reservation_id: 'abc', operation_type: 'entrega' });
    const res = createMockRes();
    await handleEnCaminoLocation(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false, error: 'lat and lng are required as numbers' }));
  });

  it('should return 400 for invalid coordinates', async () => {
    const req = createMockReq({ reservation_id: 'abc', operation_type: 'entrega', lat: 100, lng: 2.7 });
    const res = createMockRes();
    await handleEnCaminoLocation(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invalid coordinates' }));
  });

  it('should update location and insert history on valid request', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: '123' }, error: null });
    const req = createMockReq({ reservation_id: 'abc', operation_type: 'entrega', lat: 39.5696, lng: 2.6502, accuracy: 15 });
    const res = createMockRes();
    await handleEnCaminoLocation(req, res);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      current_lat: 39.5696,
      current_lng: 2.6502,
      sharing_location: true,
    }));
    // Should also insert into location_history
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      tracking_id: '123',
      reservation_id: 'abc',
      operation_type: 'entrega',
      latitude: 39.5696,
      longitude: 2.6502,
      accuracy: 15,
    }));
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('should return 404 if no active record found', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const req = createMockReq({ reservation_id: 'abc', operation_type: 'entrega', lat: 39.5696, lng: 2.6502 });
    const res = createMockRes();
    await handleEnCaminoLocation(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('handleEnCaminoLocationStop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  it('should return 400 if reservation_id is missing', async () => {
    const req = createMockReq({ operation_type: 'entrega' });
    const res = createMockRes();
    await handleEnCaminoLocationStop(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should stop location sharing successfully', async () => {
    mockEq.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValueOnce({
      eq: () => ({ data: null, error: null }),
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const req = createMockReq({ reservation_id: 'abc', operation_type: 'entrega' });
    const res = createMockRes();
    await handleEnCaminoLocationStop(req, res);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      sharing_location: false,
      current_lat: null,
      current_lng: null,
      location_updated_at: null,
    }));
  });
});

describe('handleEnCaminoLocationHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  it('should return 400 if reservation_id is missing', async () => {
    const req = createMockReq({ operation_type: 'entrega' });
    const res = createMockRes();
    await handleEnCaminoLocationHistory(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  it('should return 400 if operation_type is missing', async () => {
    const req = createMockReq({ reservation_id: 'abc' });
    const res = createMockRes();
    await handleEnCaminoLocationHistory(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should return positions for a valid request', async () => {
    const req = createMockReq({ reservation_id: 'abc', operation_type: 'entrega' });
    const res = createMockRes();
    await handleEnCaminoLocationHistory(req, res);

    expect(mockSelect).toHaveBeenCalled();
    expect(mockOrder).toHaveBeenCalledWith('recorded_at', { ascending: true });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      positions: expect.arrayContaining([
        expect.objectContaining({ lat: 39.55, lng: 2.73, accuracy: 10 }),
        expect.objectContaining({ lat: 39.56, lng: 2.74, accuracy: 8 }),
      ]),
    }));
  });
});
