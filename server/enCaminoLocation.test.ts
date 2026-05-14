import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { handleEnCaminoLocation, handleEnCaminoLocationStop } from './enCaminoTrackingEndpoint';

// Mock Supabase
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockIs = vi.fn();
const mockSelect = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
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
    }),
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

  it('should update location successfully', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: '123' }, error: null });
    const req = createMockReq({ reservation_id: 'abc', operation_type: 'entrega', lat: 39.5696, lng: 2.6502 });
    const res = createMockRes();
    await handleEnCaminoLocation(req, res);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      current_lat: 39.5696,
      current_lng: 2.6502,
      sharing_location: true,
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
    // The last eq returns the result
    mockEq.mockReturnValueOnce({
      eq: () => ({ data: null, error: null }),
    });
    // Simplified: just check that update is called with sharing_location: false
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
