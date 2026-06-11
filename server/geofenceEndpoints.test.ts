/**
 * Tests for geofence endpoints — validates request/response handling
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track calls
const mockFrom = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

function createChainedClient() {
  return {
    from: (...args: any[]) => {
      mockFrom(...args);
      return {
        select: () => ({
          eq: () => ({
            order: () => ({ data: [], error: null }),
            select: () => ({
              single: () => ({ data: { id: 'test-id', name: 'Updated Zone' }, error: null }),
            }),
          }),
        }),
        insert: (...a: any[]) => {
          mockInsert(...a);
          return {
            select: () => ({
              single: () => ({ data: { id: 'test-id', name: 'Test Zone' }, error: null }),
            }),
          };
        },
        update: (...a: any[]) => {
          mockUpdate(...a);
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({
                  single: () => ({ data: { id: 'test-id', name: 'Updated Zone' }, error: null }),
                }),
              }),
            }),
          };
        },
        delete: () => {
          mockDelete();
          return {
            eq: () => ({
              eq: () => ({ error: null }),
            }),
          };
        },
      };
    },
  };
}

vi.mock('./supabaseAdmin', () => ({
  AuthError: class AuthError extends Error {
    constructor(msg: string) { super(msg); this.name = 'AuthError'; }
  },
  getServiceClient: () => createChainedClient(),
  authenticateSupabaseRequest: vi.fn().mockResolvedValue({
    userId: 'user-123',
    organizationId: 'org-456',
  }),
}));

vi.mock('./permissionHelper', () => ({
  checkUserPermission: vi.fn().mockResolvedValue({ allowed: true, role: 'admin', memberStatus: 'active' }),
}));

import {
  handleListGeofences,
  handleCreateGeofence,
  handleUpdateGeofence,
  handleDeleteGeofence,
} from './geofenceEndpoints';

function createMockReqRes(body: any = {}) {
  const req = { body, headers: { authorization: 'Bearer test-token' } } as any;
  const res = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  } as any;
  return { req, res };
}

describe('Geofence Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleListGeofences', () => {
    it('should return geofences for valid org', async () => {
      const { req, res } = createMockReqRes({ organization_id: 'org-456' });
      await handleListGeofences(req, res);
      expect(mockFrom).toHaveBeenCalledWith('geofences');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, geofences: [] }));
    });
  });

  describe('handleCreateGeofence', () => {
    it('should require name', async () => {
      const { req, res } = createMockReqRes({
        organization_id: 'org-456',
        type: 'circle',
      });
      await handleCreateGeofence(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should create a circle geofence', async () => {
      const { req, res } = createMockReqRes({
        organization_id: 'org-456',
        name: 'Test Zone',
        type: 'circle',
        center_lat: 39.57,
        center_lng: 2.65,
        radius_meters: 500,
        color: '#3B82F6',
        opacity: 0.2,
        is_active: true,
        alert_on_enter: true,
        alert_on_exit: false,
      });
      await handleCreateGeofence(req, res);
      expect(mockInsert).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    it('should create a polygon geofence', async () => {
      const { req, res } = createMockReqRes({
        organization_id: 'org-456',
        name: 'Polygon Zone',
        type: 'polygon',
        coordinates: [
          { lat: 39.57, lng: 2.65 },
          { lat: 39.58, lng: 2.66 },
          { lat: 39.56, lng: 2.67 },
        ],
        color: '#22c55e',
        opacity: 0.2,
        is_active: true,
        alert_on_enter: false,
        alert_on_exit: true,
      });
      await handleCreateGeofence(req, res);
      expect(mockInsert).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });
  });

  describe('handleUpdateGeofence', () => {
    it('should require id', async () => {
      const { req, res } = createMockReqRes({ organization_id: 'org-456' });
      await handleUpdateGeofence(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should update geofence fields', async () => {
      const { req, res } = createMockReqRes({
        id: 'test-id',
        organization_id: 'org-456',
        name: 'Updated Zone',
        is_active: false,
      });
      await handleUpdateGeofence(req, res);
      expect(mockUpdate).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });
  });

  describe('handleDeleteGeofence', () => {
    it('should require id', async () => {
      const { req, res } = createMockReqRes({ organization_id: 'org-456' });
      await handleDeleteGeofence(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should delete a geofence', async () => {
      const { req, res } = createMockReqRes({ id: 'test-id', organization_id: 'org-456' });
      await handleDeleteGeofence(req, res);
      expect(mockDelete).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });
  });
});
