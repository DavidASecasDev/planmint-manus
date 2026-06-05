/**
 * Tests for the scheduled Rently enrichment handler.
 * Validates the handler's auth check and basic response structure.
 */
import { describe, it, expect, vi } from "vitest";

describe("scheduledRentlyEnrich", () => {
  it("should reject requests without x-manus-cron-task-uid header", async () => {
    // Dynamically import to avoid module-level side effects
    const { handleScheduledRentlyEnrich } = await import("./scheduledRentlyEnrich");

    const req = {
      headers: {},
      body: {},
      originalUrl: "/api/scheduled/rently-enrich",
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;

    await handleScheduledRentlyEnrich(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "cron-only" });
  });

  it("should accept requests with valid x-manus-cron-task-uid header", async () => {
    // Mock the supabaseAdmin module to avoid real DB calls
    vi.mock("./supabaseAdmin", () => ({
      getServiceClient: () => ({
        from: () => ({
          select: () => ({
            not: () => ({
              not: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      }),
    }));

    const { handleScheduledRentlyEnrich } = await import("./scheduledRentlyEnrich");

    const req = {
      headers: { "x-manus-cron-task-uid": "test-task-uid-123" },
      body: {},
      originalUrl: "/api/scheduled/rently-enrich",
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;

    await handleScheduledRentlyEnrich(req, res);

    // Should not return 403
    expect(res.status).not.toHaveBeenCalledWith(403);
    // Should return a success response
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true })
    );

    vi.restoreAllMocks();
  });

  it("should handle the case where no organizations have Rently configured", async () => {
    vi.mock("./supabaseAdmin", () => ({
      getServiceClient: () => ({
        from: () => ({
          select: () => ({
            not: () => ({
              not: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      }),
    }));

    const { handleScheduledRentlyEnrich } = await import("./scheduledRentlyEnrich");

    const req = {
      headers: { "x-manus-cron-task-uid": "test-task-uid-456" },
      body: {},
      originalUrl: "/api/scheduled/rently-enrich",
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;

    await handleScheduledRentlyEnrich(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        message: "No organizations with Rently configured",
        enriched: 0,
      })
    );

    vi.restoreAllMocks();
  });
});
