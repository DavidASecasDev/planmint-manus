import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

// Mock supabaseAdmin
vi.mock("./supabaseAdmin", () => ({
  getServiceClient: vi.fn(),
}));

// Mock notificationHelper
vi.mock("./notificationHelper", () => ({
  sendOperationalNotification: vi.fn(),
}));

// Mock sdk
vi.mock("./_core/sdk", () => ({
  sdk: {
    authenticateRequest: vi.fn().mockResolvedValue({ isCron: true, taskUid: "test-uid" }),
  },
}));

import { handleScheduledMorningSummary } from "./scheduledMorningSummary";
import { getServiceClient } from "./supabaseAdmin";
import { sendOperationalNotification } from "./notificationHelper";

function mockReq(headers: Record<string, string> = {}): Partial<Request> {
  return {
    headers: { "x-manus-cron-task-uid": "test-task-uid", ...headers },
    originalUrl: "/api/scheduled/morning-summary",
  };
}

function mockRes(): Partial<Response> & { _status: number; _json: any } {
  const res: any = { _status: 200, _json: null };
  res.status = (code: number) => { res._status = code; return res; };
  res.json = (data: any) => { res._json = data; return res; };
  return res;
}

describe("scheduledMorningSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when not a cron call", async () => {
    vi.mocked(await import("./_core/sdk")).sdk.authenticateRequest = vi.fn().mockResolvedValue({ isCron: false });
    
    const req = mockReq({ "x-manus-cron-task-uid": "" }) as any;
    delete req.headers["x-manus-cron-task-uid"];
    const res = mockRes();

    await handleScheduledMorningSummary(req as Request, res as unknown as Response);

    expect(res._status).toBe(403);
    expect(res._json.error).toBe("cron-only");
  });

  it("skips when no organizations exist", async () => {
    const mockSb = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    vi.mocked(getServiceClient).mockReturnValue(mockSb as any);

    const req = mockReq();
    const res = mockRes();

    await handleScheduledMorningSummary(req as Request, res as unknown as Response);

    expect(res._status).toBe(200);
    expect(res._json.ok).toBe(true);
    expect(res._json.skipped).toBe("no-organizations");
  });

  it("sends notification when transfers and reservations exist", async () => {
    const mockFrom = vi.fn();
    const mockSb = { from: mockFrom };

    // organizations query
    mockFrom.mockImplementationOnce(() => ({
      select: vi.fn().mockResolvedValue({
        data: [{ id: "org-1", name: "Test Org" }],
        error: null,
      }),
    }));

    // transfer_items count
    mockFrom.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({ count: 3, error: null }),
          }),
        }),
      }),
    }));

    // reservations pickup count
    mockFrom.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              neq: vi.fn().mockResolvedValue({ count: 2, error: null }),
            }),
          }),
        }),
      }),
    }));

    // reservations return count
    mockFrom.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              neq: vi.fn().mockResolvedValue({ count: 1, error: null }),
            }),
          }),
        }),
      }),
    }));

    vi.mocked(getServiceClient).mockReturnValue(mockSb as any);

    const req = mockReq();
    const res = mockRes();

    await handleScheduledMorningSummary(req as Request, res as unknown as Response);

    expect(res._status).toBe(200);
    expect(res._json.ok).toBe(true);
    expect(res._json.results[0].transfers).toBe(3);
    expect(res._json.results[0].reservations).toBe(3);
    expect(res._json.results[0].notified).toBe(1);
    expect(sendOperationalNotification).toHaveBeenCalledTimes(1);

    const notifCall = vi.mocked(sendOperationalNotification).mock.calls[0];
    expect(notifCall[1].organizationId).toBe("org-1");
    expect(notifCall[1].title).toContain("Resumen del día");
    expect(notifCall[1].body).toContain("3 transfers");
    expect(notifCall[1].body).toContain("3 reservas");
  });

  it("does not send notification when no transfers or reservations", async () => {
    const mockFrom = vi.fn();
    const mockSb = { from: mockFrom };

    // organizations query
    mockFrom.mockImplementationOnce(() => ({
      select: vi.fn().mockResolvedValue({
        data: [{ id: "org-1", name: "Test Org" }],
        error: null,
      }),
    }));

    // transfer_items count = 0
    mockFrom.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({ count: 0, error: null }),
          }),
        }),
      }),
    }));

    // reservations pickup count = 0
    mockFrom.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              neq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }),
        }),
      }),
    }));

    // reservations return count = 0
    mockFrom.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              neq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }),
        }),
      }),
    }));

    vi.mocked(getServiceClient).mockReturnValue(mockSb as any);

    const req = mockReq();
    const res = mockRes();

    await handleScheduledMorningSummary(req as Request, res as unknown as Response);

    expect(res._status).toBe(200);
    expect(res._json.ok).toBe(true);
    expect(res._json.results[0].notified).toBe(0);
    expect(sendOperationalNotification).not.toHaveBeenCalled();
  });
});
