import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the auth cache and deduplication logic in supabaseAdmin.ts.
 * We test the caching behavior by mocking the Supabase client calls.
 *
 * IMPORTANT: Since the new auth code decodes JWTs locally to extract the 'sub'
 * claim for caching, all test tokens must be valid JWT format (header.payload.signature).
 */

// Helper: create a fake JWT with a given payload (no real signature)
function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = "fake-signature";
  return `${header}.${body}.${sig}`;
}

// Standard test tokens with proper JWT format
// NOTE: sub must match what mockGetUser returns ("user-123") for cache tests to work,
// since the cache stores by verifiedUserId from auth.getUser(), but looks up by sub from JWT.
// In production these always match; in tests we must keep them consistent.
const VALID_TOKEN = makeFakeJwt({ sub: "user-123", exp: Math.floor(Date.now() / 1000) + 3600 });
const CACHED_TOKEN = makeFakeJwt({ sub: "user-123", exp: Math.floor(Date.now() / 1000) + 3600 });
const CONCURRENT_TOKEN = makeFakeJwt({ sub: "user-123", exp: Math.floor(Date.now() / 1000) + 3600 });
const INVALID_USER_TOKEN = makeFakeJwt({ sub: "user-invalid", exp: Math.floor(Date.now() / 1000) + 3600 });

// Mock the ENV module
vi.mock('../../../server/_core/env', () => ({
  ENV: {
    supabaseUrl: 'https://test.supabase.co',
    supabaseServiceRoleKey: 'test-service-role-key',
    supabaseAnonKey: 'test-anon-key',
  },
}));

// Track how many times getUser and from().select() are called
let getUserCallCount = 0;
let profileQueryCallCount = 0;

const mockGetUser = vi.fn().mockImplementation(async () => {
  getUserCallCount++;
  return {
    data: { user: { id: 'user-123' } },
    error: null,
  };
});

const mockSingle = vi.fn().mockImplementation(async () => {
  profileQueryCallCount++;
  return {
    data: { organization_id: 'org-456' },
    error: null,
  };
});

const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

// Import after mocks are set up
const { authenticateSupabaseRequest, AuthError, _clearAuthCacheForTesting } = await import('../../../server/supabaseAdmin');

describe('authenticateSupabaseRequest', () => {
  beforeEach(() => {
    getUserCallCount = 0;
    profileQueryCallCount = 0;
    mockGetUser.mockClear();
    mockSingle.mockClear();
    _clearAuthCacheForTesting();
  });

  it('should throw AuthError when no token is provided', async () => {
    await expect(authenticateSupabaseRequest(undefined)).rejects.toThrow(AuthError);
    await expect(authenticateSupabaseRequest('')).rejects.toThrow(AuthError);
    await expect(authenticateSupabaseRequest('NotBearer token')).rejects.toThrow(AuthError);
  });

  it('should throw AuthError for non-JWT format tokens', async () => {
    await expect(authenticateSupabaseRequest('Bearer not-a-jwt')).rejects.toThrow(AuthError);
  });

  it('should throw AuthError for locally expired tokens without calling Supabase', async () => {
    const expiredToken = makeFakeJwt({ sub: "user-expired", exp: Math.floor(Date.now() / 1000) - 3600 });
    const countBefore = getUserCallCount;
    await expect(authenticateSupabaseRequest(`Bearer ${expiredToken}`)).rejects.toThrow(AuthError);
    expect(getUserCallCount - countBefore).toBe(0);
  });

  it('should return userId and organizationId for valid token', async () => {
    const result = await authenticateSupabaseRequest(`Bearer ${VALID_TOKEN}`);
    expect(result).toEqual({
      userId: 'user-123',
      organizationId: 'org-456',
    });
  });

  it('should cache results by user ID and not call Supabase again within TTL', async () => {
    // First call - should hit Supabase
    const countBefore = getUserCallCount;
    await authenticateSupabaseRequest(`Bearer ${CACHED_TOKEN}`);
    const callsAfterFirst = getUserCallCount - countBefore;
    expect(callsAfterFirst).toBe(1);

    // Second call with same token - should use cache (same user ID)
    const countBefore2 = getUserCallCount;
    const result2 = await authenticateSupabaseRequest(`Bearer ${CACHED_TOKEN}`);
    const callsAfterSecond = getUserCallCount - countBefore2;
    expect(callsAfterSecond).toBe(0); // No new Supabase call
    expect(result2).toEqual({
      userId: 'user-123',
      organizationId: 'org-456',
    });
  });

  it('should deduplicate concurrent requests for the same user', async () => {
    const countBefore = getUserCallCount;
    
    // Fire 5 concurrent requests with the same token (same user)
    const promises = Array.from({ length: 5 }, () =>
      authenticateSupabaseRequest(`Bearer ${CONCURRENT_TOKEN}`)
    );
    
    const results = await Promise.all(promises);
    
    // All should return the same result
    for (const result of results) {
      expect(result).toEqual({
        userId: 'user-123',
        organizationId: 'org-456',
      });
    }
    
    // Should only have called getUser once (deduplication by user ID)
    const callsAfter = getUserCallCount - countBefore;
    expect(callsAfter).toBe(1);
  });

  it('should throw AuthError when Supabase rejects the token', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid token' },
    });

    await expect(
      authenticateSupabaseRequest(`Bearer ${INVALID_USER_TOKEN}`)
    ).rejects.toThrow(AuthError);
  });
});
