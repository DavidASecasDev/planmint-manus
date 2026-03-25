import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for the auth cache and deduplication logic in supabaseAdmin.ts.
 * We test the caching behavior by mocking the Supabase client calls.
 */

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
const { authenticateSupabaseRequest, AuthError } = await import('../../../server/supabaseAdmin');

describe('authenticateSupabaseRequest', () => {
  beforeEach(() => {
    getUserCallCount = 0;
    profileQueryCallCount = 0;
    mockGetUser.mockClear();
    mockSingle.mockClear();
  });

  it('should throw AuthError when no token is provided', async () => {
    await expect(authenticateSupabaseRequest(undefined)).rejects.toThrow(AuthError);
    await expect(authenticateSupabaseRequest('')).rejects.toThrow(AuthError);
    await expect(authenticateSupabaseRequest('NotBearer token')).rejects.toThrow(AuthError);
  });

  it('should return userId and organizationId for valid token', async () => {
    const result = await authenticateSupabaseRequest('Bearer valid-token-fresh');
    expect(result).toEqual({
      userId: 'user-123',
      organizationId: 'org-456',
    });
  });

  it('should cache results and not call Supabase again for same token within TTL', async () => {
    // First call - should hit Supabase
    const countBefore = getUserCallCount;
    await authenticateSupabaseRequest('Bearer cached-token-test');
    const callsAfterFirst = getUserCallCount - countBefore;
    expect(callsAfterFirst).toBe(1);

    // Second call with same token - should use cache
    const countBefore2 = getUserCallCount;
    const result2 = await authenticateSupabaseRequest('Bearer cached-token-test');
    const callsAfterSecond = getUserCallCount - countBefore2;
    expect(callsAfterSecond).toBe(0); // No new Supabase call
    expect(result2).toEqual({
      userId: 'user-123',
      organizationId: 'org-456',
    });
  });

  it('should deduplicate concurrent requests for the same token', async () => {
    const countBefore = getUserCallCount;
    
    // Fire 5 concurrent requests with the same token
    const promises = Array.from({ length: 5 }, () =>
      authenticateSupabaseRequest('Bearer concurrent-token-test')
    );
    
    const results = await Promise.all(promises);
    
    // All should return the same result
    for (const result of results) {
      expect(result).toEqual({
        userId: 'user-123',
        organizationId: 'org-456',
      });
    }
    
    // Should only have called getUser once (deduplication)
    const callsAfter = getUserCallCount - countBefore;
    expect(callsAfter).toBe(1);
  });

  it('should throw AuthError for invalid token', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid token' },
    });

    await expect(
      authenticateSupabaseRequest('Bearer invalid-token-unique')
    ).rejects.toThrow(AuthError);
  });
});
