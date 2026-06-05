import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the supabaseAdmin module
vi.mock("./supabaseAdmin", () => ({
  getServiceClient: vi.fn(),
}));

import { getServiceClient } from "./supabaseAdmin";
import { handlePublicPreparation } from "./publicPreparationEndpoint";

function createMockReqRes() {
  const req = {} as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  return { req, res };
}

describe("handlePublicPreparation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty items array when no pending preparation items exist", async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    (getServiceClient as any).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    });

    const { req, res } = createMockReqRes();
    await handlePublicPreparation(req, res);

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      items: [],
      count: 0,
    });
  });

  it("returns items with urgency levels calculated from deadline", async () => {
    const now = Date.now();
    const mockItems = [
      {
        id: "item-1",
        matricula: "1234ABC",
        modelo: "Mercedes GLA",
        deadline_at: new Date(now - 3600000).toISOString(), // 1 hour ago -> critical
        notes: "Urgente",
        status: "pending",
        created_at: new Date().toISOString(),
      },
      {
        id: "item-2",
        matricula: "5678DEF",
        modelo: "BMW X3",
        deadline_at: new Date(now + 2 * 3600000).toISOString(), // 2 hours from now -> high
        notes: null,
        status: "pending",
        created_at: new Date().toISOString(),
      },
      {
        id: "item-3",
        matricula: "9012GHI",
        modelo: null,
        deadline_at: new Date(now + 6 * 3600000).toISOString(), // 6 hours from now -> medium
        notes: null,
        status: "pending",
        created_at: new Date().toISOString(),
      },
      {
        id: "item-4",
        matricula: "3456JKL",
        modelo: "Porsche Cayenne",
        deadline_at: new Date(now + 24 * 3600000).toISOString(), // 24 hours from now -> low
        notes: "Mañana",
        status: "pending",
        created_at: new Date().toISOString(),
      },
    ];

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockItems, error: null }),
        }),
      }),
    });

    (getServiceClient as any).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    });

    const { req, res } = createMockReqRes();
    await handlePublicPreparation(req, res);

    expect(res.json).toHaveBeenCalledTimes(1);
    const response = res.json.mock.calls[0][0];
    expect(response.ok).toBe(true);
    expect(response.count).toBe(4);
    expect(response.items).toHaveLength(4);

    // Check urgency levels
    expect(response.items[0].urgency).toBe("critical");
    expect(response.items[1].urgency).toBe("high");
    expect(response.items[2].urgency).toBe("medium");
    expect(response.items[3].urgency).toBe("low");

    // Check data shape (no sensitive fields exposed)
    expect(response.items[0]).toEqual({
      id: "item-1",
      matricula: "1234ABC",
      modelo: "Mercedes GLA",
      deadline_at: mockItems[0].deadline_at,
      notes: "Urgente",
      urgency: "critical",
    });
  });

  it("returns 500 on database error", async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: "DB connection failed" } }),
        }),
      }),
    });

    (getServiceClient as any).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    });

    const { req, res } = createMockReqRes();
    await handlePublicPreparation(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });

  it("queries the correct table with correct filters", async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEqStatus = vi.fn().mockReturnValue({ order: mockOrder });
    const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqStatus });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqOrg });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    (getServiceClient as any).mockReturnValue({ from: mockFrom });

    const { req, res } = createMockReqRes();
    await handlePublicPreparation(req, res);

    // Verify correct table
    expect(mockFrom).toHaveBeenCalledWith("preparation_list");
    // Verify correct select fields
    expect(mockSelect).toHaveBeenCalledWith("id, matricula, modelo, deadline_at, notes, status, created_at");
    // Verify org filter (Azul Cars)
    expect(mockEqOrg).toHaveBeenCalledWith("organization_id", "a23a0d42-5af7-4cda-9955-569c10cc6714");
    // Verify status filter
    expect(mockEqStatus).toHaveBeenCalledWith("status", "pending");
    // Verify ordering
    expect(mockOrder).toHaveBeenCalledWith("deadline_at", { ascending: true });
  });
});
