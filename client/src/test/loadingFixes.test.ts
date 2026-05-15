import { describe, it, expect } from 'vitest';

/**
 * Tests for the loading reliability fixes:
 * 1. QueryClient defaults (refetchOnReconnect, retry logic)
 * 2. Schedules loading guard (permissionsLoading included)
 * 3. Visibility recovery hook logic
 */

describe('QueryClient default configuration', () => {
  it('should have refetchOnReconnect enabled', async () => {
    // Read the App.tsx to verify the configuration
    const fs = await import('fs');
    const appContent = fs.readFileSync('client/src/App.tsx', 'utf-8');
    
    expect(appContent).toContain('refetchOnReconnect: true');
    expect(appContent).not.toContain('refetchOnReconnect: false');
  });

  it('should have smart retry logic that skips auth errors', async () => {
    const fs = await import('fs');
    const appContent = fs.readFileSync('client/src/App.tsx', 'utf-8');
    
    // Should use a function for retry, not a fixed number
    expect(appContent).toContain('retry: (failureCount, error)');
    expect(appContent).toContain('AuthExpiredError');
    expect(appContent).toContain('failureCount < 2');
  });

  it('should import and use useVisibilityRecovery', async () => {
    const fs = await import('fs');
    const appContent = fs.readFileSync('client/src/App.tsx', 'utf-8');
    
    expect(appContent).toContain("import { useVisibilityRecovery }");
    expect(appContent).toContain('useVisibilityRecovery(5 * 60 * 1000)');
  });
});

describe('Schedules loading guard', () => {
  it('should include permissionsLoading in isLoading check', async () => {
    const fs = await import('fs');
    const schedulesContent = fs.readFileSync('client/src/pages/Schedules.tsx', 'utf-8');
    
    // Should destructure isLoading from usePermissions
    expect(schedulesContent).toContain('isLoading: permissionsLoading');
    
    // Should include permissionsLoading in the combined isLoading
    expect(schedulesContent).toContain('permissionsLoading');
    expect(schedulesContent).toMatch(/const isLoading\s*=.*permissionsLoading/);
  });

  it('should gate queries with sessionReady', async () => {
    const fs = await import('fs');
    const schedulesContent = fs.readFileSync('client/src/pages/Schedules.tsx', 'utf-8');
    
    // Should import sessionReady from useAuth
    expect(schedulesContent).toContain('sessionReady');
    
    // Both queries should be gated by sessionReady
    const enabledMatches = schedulesContent.match(/enabled:\s*!!orgId\s*&&\s*sessionReady/g);
    expect(enabledMatches).not.toBeNull();
    expect(enabledMatches!.length).toBeGreaterThanOrEqual(2);
  });
});

describe('useVisibilityRecovery hook', () => {
  it('should export the hook function', async () => {
    const fs = await import('fs');
    const hookContent = fs.readFileSync('client/src/hooks/useVisibilityRecovery.ts', 'utf-8');
    
    expect(hookContent).toContain('export function useVisibilityRecovery');
    expect(hookContent).toContain('visibilitychange');
    expect(hookContent).toContain('invalidateQueries');
  });

  it('should have a configurable threshold with 5min default', async () => {
    const fs = await import('fs');
    const hookContent = fs.readFileSync('client/src/hooks/useVisibilityRecovery.ts', 'utf-8');
    
    // Default threshold of 5 minutes
    expect(hookContent).toContain('thresholdMs = 5 * 60 * 1000');
    // Should track hidden timestamp
    expect(hookContent).toContain('hiddenAtRef');
    // Should check elapsed time before invalidating
    expect(hookContent).toContain('Date.now() - hiddenAt > thresholdMs');
  });
});
