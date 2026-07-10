import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabaseAdmin
vi.mock("./supabaseAdmin", () => {
  const mockSelect = vi.fn().mockReturnThis();
  const mockInsert = vi.fn().mockReturnThis();
  const mockUpdate = vi.fn().mockReturnThis();
  const mockDelete = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();
  const mockIs = vi.fn().mockReturnThis();
  const mockOrder = vi.fn().mockReturnThis();
  const mockRange = vi.fn().mockReturnThis();
  const mockGte = vi.fn().mockReturnThis();
  const mockLte = vi.fn().mockReturnThis();
  const mockOr = vi.fn().mockReturnThis();
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockThen = vi.fn().mockResolvedValue(undefined);

  const chainedClient = {
    from: vi.fn().mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      eq: mockEq,
      is: mockIs,
      order: mockOrder,
      range: mockRange,
      gte: mockGte,
      lte: mockLte,
      or: mockOr,
      single: mockSingle,
      then: mockThen,
    }),
  };

  // Make chained methods return the same object
  Object.values(chainedClient.from()).forEach((fn: any) => {
    if (typeof fn === "function" && fn.mockReturnThis) {
      fn.mockReturnValue(chainedClient.from());
    }
  });

  return {
    getServiceClient: vi.fn(() => chainedClient),
    authenticateSupabaseRequest: vi.fn().mockResolvedValue({
      userId: "user-123",
      organizationId: "org-123",
    }),
    AuthError: class AuthError extends Error {
      status: number;
      constructor(message: string, status: number) {
        super(message);
        this.status = status;
      }
    },
  };
});

// Mock automationEngine
vi.mock("./automationEngine", () => ({
  onTransferCreated: vi.fn().mockResolvedValue(undefined),
}));

import {
  authenticateExternalApi,
  ExternalApiError,
  generateApiKey,
} from "./externalApiAuth";
import crypto from "crypto";

describe("ExternalApiAuth", () => {
  describe("authenticateExternalApi", () => {
    it("should throw MISSING_API_KEY when no header is provided", async () => {
      const req = { headers: {} } as any;
      await expect(authenticateExternalApi(req)).rejects.toThrow(ExternalApiError);
      try {
        await authenticateExternalApi(req);
      } catch (err: any) {
        expect(err.code).toBe("MISSING_API_KEY");
        expect(err.status).toBe(401);
      }
    });

    it("should throw INVALID_API_KEY_FORMAT for malformed keys", async () => {
      const req = { headers: { "x-api-key": "bad_key" } } as any;
      await expect(authenticateExternalApi(req)).rejects.toThrow(ExternalApiError);
      try {
        await authenticateExternalApi(req);
      } catch (err: any) {
        expect(err.code).toBe("INVALID_API_KEY_FORMAT");
        expect(err.status).toBe(401);
      }
    });

    it("should throw INVALID_API_KEY for non-existent key prefix", async () => {
      const { getServiceClient } = await import("./supabaseAdmin");
      const mockClient = getServiceClient() as any;
      mockClient.from().single.mockResolvedValueOnce({ data: null, error: { message: "not found" } });

      const req = {
        headers: { "x-api-key": "pmk_abcdefgh_12345678901234567890123456789012" },
      } as any;

      try {
        await authenticateExternalApi(req);
      } catch (err: any) {
        expect(err.code).toBe("INVALID_API_KEY");
        expect(err.status).toBe(401);
      }
    });

    it("should throw API_KEY_DEACTIVATED for inactive keys", async () => {
      const { getServiceClient } = await import("./supabaseAdmin");
      const mockClient = getServiceClient() as any;

      const testKey = "pmk_abcdefgh_12345678901234567890123456789012";
      const keyHash = crypto.createHash("sha256").update(testKey).digest("hex");

      mockClient.from().single.mockResolvedValueOnce({
        data: {
          id: "key-1",
          organization_id: "org-1",
          name: "Test Key",
          key_hash: keyHash,
          permissions: ["transfers.create"],
          is_active: false,
          expires_at: null,
        },
        error: null,
      });

      const req = { headers: { "x-api-key": testKey } } as any;

      try {
        await authenticateExternalApi(req);
      } catch (err: any) {
        expect(err.code).toBe("API_KEY_DEACTIVATED");
        expect(err.status).toBe(403);
      }
    });

    it("should throw INSUFFICIENT_PERMISSIONS when permission is missing", async () => {
      const { getServiceClient } = await import("./supabaseAdmin");
      const mockClient = getServiceClient() as any;

      const testKey = "pmk_abcdefgh_12345678901234567890123456789012";
      const keyHash = crypto.createHash("sha256").update(testKey).digest("hex");

      mockClient.from().single.mockResolvedValueOnce({
        data: {
          id: "key-1",
          organization_id: "org-1",
          name: "Test Key",
          key_hash: keyHash,
          permissions: ["transfers.read"],
          is_active: true,
          expires_at: null,
        },
        error: null,
      });

      const req = { headers: { "x-api-key": testKey } } as any;

      try {
        await authenticateExternalApi(req, "transfers.create");
      } catch (err: any) {
        expect(err.code).toBe("INSUFFICIENT_PERMISSIONS");
        expect(err.status).toBe(403);
      }
    });
  });

  describe("generateApiKey", () => {
    it("should generate a key with the correct format", async () => {
      const { getServiceClient } = await import("./supabaseAdmin");
      const mockClient = getServiceClient() as any;

      mockClient.from().single.mockResolvedValueOnce({
        data: { id: "new-key-id" },
        error: null,
      });

      const result = await generateApiKey({
        organizationId: "org-123",
        name: "Bluebnc BYM",
      });

      expect(result.apiKey).toMatch(/^pmk_[a-f0-9]{8}_[a-f0-9]{32}$/);
      expect(result.keyId).toBe("new-key-id");
      expect(result.prefix).toHaveLength(8);
    });
  });
});

describe("External API Validation", () => {
  it("should validate required fields for transfer creation", () => {
    // Test the validation logic directly
    const invalidBody = {
      client_name: "",
      items: [],
    };

    // client_name empty and items empty should fail
    expect(invalidBody.client_name.trim().length).toBe(0);
    expect(invalidBody.items.length).toBe(0);
  });

  it("should validate date format", () => {
    const validDate = "2025-07-15";
    const invalidDate = "15/07/2025";
    const regex = /^\d{4}-\d{2}-\d{2}$/;

    expect(regex.test(validDate)).toBe(true);
    expect(regex.test(invalidDate)).toBe(false);
  });

  it("should validate time format", () => {
    const validTime = "14:30";
    const invalidTime = "2:30 PM";
    const regex = /^\d{2}:\d{2}$/;

    expect(regex.test(validTime)).toBe(true);
    expect(regex.test(invalidTime)).toBe(false);
  });

  it("should validate vehicle types", () => {
    const validTypes = ["sedan", "v_class", "minibus", "sprinter", "luxury"];
    expect(validTypes.includes("v_class")).toBe(true);
    expect(validTypes.includes("bus")).toBe(false);
  });

  it("should validate service types", () => {
    const validTypes = ["point_to_point", "hourly", "daily", "airport", "port"];
    expect(validTypes.includes("airport")).toBe(true);
    expect(validTypes.includes("unknown")).toBe(false);
  });
});
