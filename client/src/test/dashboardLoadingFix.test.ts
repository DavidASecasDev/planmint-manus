/**
 * Regression tests for dashboard loading fix.
 *
 * Original problem: Dashboard stayed in skeleton state for ~40 seconds because
 * hooks fired Supabase queries before the session was ready, causing 401 errors
 * and React Query retries with exponential backoff.
 *
 * Fix v1: Added `sessionReady` gate and `waitForSession()` to hooks.
 * Fix v2 (current): Migrated hooks to use backend proxy with service role key,
 * eliminating RLS/session dependency for data queries. Hooks that still use
 * Supabase directly (realtime, storage, auth) retain waitForSession.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Helper to read source files
function readSource(relativePath: string): string {
  const fullPath = path.resolve(__dirname, '..', relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

describe('Dashboard Loading Fix - Proxy Migration', () => {
  describe('useEquipmentInventory (useEquipment.ts)', () => {
    const source = readSource('hooks/useEquipment.ts');

    it('should use supabaseQuery proxy instead of direct supabase client for data queries', () => {
      expect(source).toContain('supabaseQuery');
    });

    it('should destructure sessionReady from useAuth', () => {
      expect(source).toContain('sessionReady');
      expect(source).toMatch(/useAuth\(\)/);
    });

    it('should gate equipment-inventory query on sessionReady', () => {
      expect(source).toMatch(/enabled:\s*!!orgId\s*&&\s*sessionReady/);
    });

    it('should NOT need waitForSession since proxy uses service role key', () => {
      // The proxy endpoint uses the service role key which bypasses RLS,
      // so waitForSession is no longer needed for data queries
      // (it may still be present if the hook also uses supabase.storage or realtime)
      const hasDirectSupabaseFrom = source.match(/\bsupabase\.from\(/);
      if (!hasDirectSupabaseFrom) {
        // If no direct supabase.from() calls, waitForSession is unnecessary
        expect(source).not.toContain('await waitForSession()');
      }
    });
  });

  describe('EquipmentStockWidget', () => {
    const source = readSource('components/dashboard/EquipmentStockWidget.tsx');

    it('should import supabaseQuery or waitForSession', () => {
      const usesProxy = source.includes('supabaseQuery');
      const usesWaitForSession = source.includes('waitForSession');
      expect(usesProxy || usesWaitForSession).toBe(true);
    });

    it('should destructure sessionReady from useAuth', () => {
      expect(source).toMatch(/\{\s*[^}]*sessionReady[^}]*\}\s*=\s*useAuth\(\)/);
    });

    it('should gate equipment-today-demand query on sessionReady', () => {
      expect(source).toMatch(/enabled:\s*!!profile\?\.organization_id\s*&&\s*sessionReady/);
    });

    it('should handle inventory errors gracefully instead of infinite skeleton', () => {
      expect(source).toContain('inventoryError');
      expect(source).toContain('No se pudo cargar el stock');
    });
  });

  describe('useNotifications', () => {
    const source = readSource('hooks/useNotifications.ts');

    it('should use supabaseQuery proxy for data queries', () => {
      expect(source).toContain('supabaseQuery');
    });

    it('should destructure sessionReady from useAuth', () => {
      expect(source).toContain('sessionReady');
    });

    it('should gate notifications query on sessionReady', () => {
      // Both the notifications list and unread count queries should be gated
      const matches = source.match(/enabled:\s*!!organizationId\s*&&\s*sessionReady/g);
      expect(matches).toBeTruthy();
      expect(matches!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('useReminderNotifications', () => {
    const source = readSource('hooks/useReminderNotifications.ts');

    it('should use supabaseQuery proxy for data queries', () => {
      expect(source).toContain('supabaseQuery');
    });
  });

  describe('useOperationalDashboard', () => {
    const source = readSource('hooks/useOperationalDashboard.ts');

    it('should NOT have redundant waitForSession inside queryFn (sessionReady already gates)', () => {
      expect(source).not.toContain('await waitForSession()');
    });

    it('should gate query on sessionReady', () => {
      expect(source).toMatch(/enabled:\s*!!orgId\s*&&\s*sessionReady/);
    });

    it('should use retry: 1 (not 2+) since sessionReady ensures valid token', () => {
      expect(source).toMatch(/retry:\s*1/);
    });

    it('should use simple retryDelay (not exponential backoff)', () => {
      expect(source).toMatch(/retryDelay:\s*1000/);
    });
  });

  describe('waitForSession timeout', () => {
    const source = readSource('integrations/supabase/client.ts');

    it('should have a safety timeout of 3 seconds (not 5)', () => {
      expect(source).toMatch(/setTimeout\(\(\)\s*=>\s*\{[\s\S]*?\},\s*3000\)/);
    });
  });
});
