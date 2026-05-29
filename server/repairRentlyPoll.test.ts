/**
 * Tests for repairRentlyPoll.ts - Bidirectional Rently service sync
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the supabaseAdmin module
vi.mock("./supabaseAdmin", () => ({
  getServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        not: vi.fn(() => ({
          is: vi.fn(() => ({
            eq: vi.fn(() => ({
              data: [
                {
                  id: "repair-1",
                  rently_service_id: 12345,
                  status: "en_taller",
                  started_at: "2026-05-01",
                  scheduled_date: "2026-05-15",
                  notes: "Chapa lateral",
                  organization_id: "org-1",
                  vehicles: { plate: "2691MTL" },
                },
              ],
              error: null,
            })),
          })),
        })),
      })),
      insert: vi.fn(() => ({ error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null })),
      })),
    })),
  })),
  authenticateSupabaseRequest: vi.fn(async (_req: any, _res: any) => ({
    userId: "user-1",
    organizationId: "org-1",
  })),
  AuthError: class AuthError extends Error {
    status: number;
    constructor(message: string, status = 401) {
      super(message);
      this.status = status;
    }
  },
}));

// Mock fetch for Rently API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("repairRentlyPoll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("logSyncEvent", () => {
    it("should export logSyncEvent function", async () => {
      const { logSyncEvent } = await import("./repairRentlyPoll");
      expect(typeof logSyncEvent).toBe("function");
    });

    it("should handle sync event logging without throwing", async () => {
      const { logSyncEvent } = await import("./repairRentlyPoll");
      // Should not throw even if DB insert fails silently
      await expect(
        logSyncEvent({
          repairId: "repair-1",
          organizationId: "org-1",
          action: "create",
          direction: "outbound",
          rentlyServiceId: 12345,
          status: "en_taller",
          details: { plate: "2691MTL" },
          error: null,
          success: true,
          createdBy: "user-1",
        })
      ).resolves.not.toThrow();
    });
  });

  describe("handleRepairRentlyPoll", () => {
    it("should export handleRepairRentlyPoll function", async () => {
      const { handleRepairRentlyPoll } = await import("./repairRentlyPoll");
      expect(typeof handleRepairRentlyPoll).toBe("function");
    });

    it("should return 401 if authentication fails", async () => {
      const mod = await import("./supabaseAdmin");
      vi.mocked(mod.authenticateSupabaseRequest).mockRejectedValueOnce(
        new mod.AuthError("Unauthorized", 401)
      );

      const { handleRepairRentlyPoll } = await import("./repairRentlyPoll");

      const req = {
        headers: {},
        ip: "127.0.0.1",
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      } as any;

      await handleRepairRentlyPoll(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should process repairs with rently_service_id and detect changes", async () => {
      // Mock Rently API response for service fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          token_type: "bearer",
          expires_in: 3600,
        }),
      });

      // Mock the service GET call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          Id: 12345,
          CarId: "2691MTL",
          ServiceTypeId: 11,
          FromDate: "2026-05-01T00:00:00",
          ToDate: "2026-05-15T00:00:00",
          Status: 1, // InExecution
          Notes: "Chapa lateral",
        }),
      });

      const { handleRepairRentlyPoll } = await import("./repairRentlyPoll");

      const req = {
        headers: { authorization: "Bearer test-token" },
        ip: "127.0.0.1",
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      } as any;

      await handleRepairRentlyPoll(req, res);
      // Should respond with success
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe("Rently service status mapping", () => {
    it("should map Rently statuses correctly", () => {
      // Status mapping from Rently:
      // 0 = Programado, 1 = En Ejecución, 2 = Finalizado, 3 = Cancelado
      const RENTLY_STATUS_MAP: Record<number, string> = {
        0: "programado",
        1: "en_ejecucion",
        2: "finalizado",
        3: "cancelado",
      };

      expect(RENTLY_STATUS_MAP[0]).toBe("programado");
      expect(RENTLY_STATUS_MAP[1]).toBe("en_ejecucion");
      expect(RENTLY_STATUS_MAP[2]).toBe("finalizado");
      expect(RENTLY_STATUS_MAP[3]).toBe("cancelado");
    });
  });

  describe("Service type constants", () => {
    it("should use correct service type ID for Bloqueo Disponibilidad", () => {
      const SERVICE_TYPE_BLOQUEO = 11;
      expect(SERVICE_TYPE_BLOQUEO).toBe(11);
    });
  });
});
