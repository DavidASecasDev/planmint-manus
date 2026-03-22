import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the ENV module
vi.mock("../../../server/_core/env", () => ({
  ENV: {
    supabaseUrl: "https://exayzwdudssyegxjiyrk.supabase.co",
    supabaseAnonKey: "test-anon-key",
    supabaseServiceRoleKey: "test-service-role-key",
  },
}));

// Mock @supabase/supabase-js
const mockFrom = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { organization_id: "org-123" }, error: null }),
    }),
  }),
});

const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: "user-123" } },
  error: null,
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
    auth: { getUser: mockGetUser },
  })),
}));

describe("supabaseAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getServiceClient returns a client", async () => {
    // Re-import to get fresh module
    const { getServiceClient } = await import("../../../server/supabaseAdmin");
    const client = getServiceClient();
    expect(client).toBeDefined();
    expect(client.from).toBeDefined();
  });

  it("getUserClient returns a client scoped to a token", async () => {
    const { getUserClient } = await import("../../../server/supabaseAdmin");
    const client = getUserClient("test-jwt-token");
    expect(client).toBeDefined();
    expect(client.from).toBeDefined();
  });

  it("extractBearerToken extracts token from valid header", async () => {
    const { extractBearerToken } = await import("../../../server/supabaseAdmin");
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken("Basic abc123")).toBeNull();
    expect(extractBearerToken("")).toBeNull();
  });

  it("authenticateSupabaseRequest returns userId and organizationId", async () => {
    const { authenticateSupabaseRequest } = await import("../../../server/supabaseAdmin");
    const result = await authenticateSupabaseRequest("Bearer test-token");
    expect(result).toEqual({ userId: "user-123", organizationId: "org-123" });
  });

  it("authenticateSupabaseRequest throws AuthError for missing token", async () => {
    const { authenticateSupabaseRequest, AuthError } = await import("../../../server/supabaseAdmin");
    await expect(authenticateSupabaseRequest(undefined)).rejects.toThrow(AuthError);
  });
});
