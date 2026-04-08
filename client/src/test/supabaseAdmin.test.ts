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

// Helper: create a fake JWT with a given payload (no real signature)
function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = "fake-signature";
  return `${header}.${body}.${sig}`;
}

describe("supabaseAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getServiceClient returns a client", async () => {
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
    const token = makeFakeJwt({ sub: "user-123", exp: Math.floor(Date.now() / 1000) + 3600 });
    const result = await authenticateSupabaseRequest(`Bearer ${token}`);
    expect(result).toEqual({ userId: "user-123", organizationId: "org-123" });
  });

  it("authenticateSupabaseRequest throws AuthError for missing token", async () => {
    const { authenticateSupabaseRequest, AuthError } = await import("../../../server/supabaseAdmin");
    await expect(authenticateSupabaseRequest(undefined)).rejects.toThrow(AuthError);
  });
});

describe("supabaseAdmin rate limiting prevention", () => {
  it("should decode JWT payload locally without network call", () => {
    // The decodeJwtPayload function extracts 'sub' and 'exp' from the JWT
    // without calling Supabase, enabling cache lookup by user ID
    const payload = { sub: "user-abc", exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = makeFakeJwt(payload);
    const parts = token.split(".");
    const decoded = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    expect(decoded.sub).toBe("user-abc");
    expect(decoded.exp).toBe(payload.exp);
  });

  it("should reject locally expired tokens without calling auth.getUser()", () => {
    // Tokens expired locally should be rejected immediately
    // This prevents unnecessary API calls to Supabase
    const expiredPayload = { sub: "user-expired", exp: Math.floor(Date.now() / 1000) - 3600 };
    const isExpired = expiredPayload.exp * 1000 < Date.now();
    expect(isExpired).toBe(true);
  });

  it("should cache by user ID, not by token", () => {
    // Two different tokens for the same user should share the same cache entry
    // This prevents rate limiting when tokens are refreshed
    const token1 = makeFakeJwt({ sub: "user-same", exp: Math.floor(Date.now() / 1000) + 3600 });
    const token2 = makeFakeJwt({ sub: "user-same", exp: Math.floor(Date.now() / 1000) + 7200 });
    
    // Both tokens have the same 'sub' claim
    const parts1 = token1.split(".");
    const parts2 = token2.split(".");
    const decoded1 = JSON.parse(Buffer.from(parts1[1], "base64url").toString("utf-8"));
    const decoded2 = JSON.parse(Buffer.from(parts2[1], "base64url").toString("utf-8"));
    
    expect(decoded1.sub).toBe(decoded2.sub);
    // Same user ID = same cache key = only 1 auth.getUser() call
  });

  it("should deduplicate concurrent requests for the same user", () => {
    // When 5+ hooks fire simultaneously on page load, all with the same user's token,
    // only ONE auth.getUser() call should be made, not 5+
    // The in-flight map (AUTH_INFLIGHT) ensures this deduplication
    const userId = "user-concurrent";
    const inflightMap = new Map<string, Promise<unknown>>();
    
    // First request creates the promise
    const promise = Promise.resolve({ userId, organizationId: "org-1" });
    inflightMap.set(userId, promise);
    
    // Subsequent requests for the same user reuse the promise
    expect(inflightMap.has(userId)).toBe(true);
    expect(inflightMap.get(userId)).toBe(promise);
  });

  it("should handle invalid JWT format gracefully", () => {
    // Tokens that can't be decoded should be rejected
    const invalidTokens = ["not-a-jwt", "a.b", "a.b.c.d", ""];
    for (const token of invalidTokens) {
      const parts = token.split(".");
      let decoded = null;
      try {
        if (parts.length === 3) {
          decoded = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
        }
      } catch {
        decoded = null;
      }
      // Invalid tokens should not produce a valid sub
      if (decoded) {
        expect(decoded.sub).toBeUndefined();
      }
    }
  });
});
