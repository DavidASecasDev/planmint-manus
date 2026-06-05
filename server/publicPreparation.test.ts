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

// Helper to create a mock supabase client that handles both queries
function createMockClient(pendingResult: any, completedCountResult?: any) {
  const completedCount = completedCountResult ?? { count: 0, error: null };

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "preparation_list") {
      // Track call count to differentiate between the two queries
      const callIndex = mockFrom.mock.calls.filter((c: any) => c[0] === "preparation_list").length;

      if (callIndex <= 1) {
        // First call: pending items query
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue(pendingResult),
              }),
            }),
          }),
        };
      } else {
        // Second call: completed today count query
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue(completedCount),
              }),
            }),
          }),
        };
      }
    }
    return { select: vi.fn() };
  });

  return { from: mockFrom };
}

describe("handlePublicPreparation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty items array when no pending preparation items exist", async () => {
    const mockClient = createMockClient({ data: [], error: null }, { count: 3, error: null });
    (getServiceClient as any).mockReturnValue(mockClient);

    const { req, res } = createMockReqRes();
    await handlePublicPreparation(req, res);

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      items: [],
      count: 0,
      completed_today: 3,
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

    const mockClient = createMockClient({ data: mockItems, error: null }, { count: 5, error: null });
    (getServiceClient as any).mockReturnValue(mockClient);

    const { req, res } = createMockReqRes();
    await handlePublicPreparation(req, res);

    expect(res.json).toHaveBeenCalledTimes(1);
    const response = res.json.mock.calls[0][0];
    expect(response.ok).toBe(true);
    expect(response.count).toBe(4);
    expect(response.items).toHaveLength(4);
    expect(response.completed_today).toBe(5);

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
    const mockClient = createMockClient({ data: null, error: { message: "DB connection failed" } });
    (getServiceClient as any).mockReturnValue(mockClient);

    const { req, res } = createMockReqRes();
    await handlePublicPreparation(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });

  it("returns completed_today as 0 when count query fails", async () => {
    const mockClient = createMockClient(
      { data: [], error: null },
      { count: null, error: { message: "Count query failed" } }
    );
    (getServiceClient as any).mockReturnValue(mockClient);

    const { req, res } = createMockReqRes();
    await handlePublicPreparation(req, res);

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      items: [],
      count: 0,
      completed_today: 0,
    });
  });
});
