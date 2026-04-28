/**
 * Regression tests for dashboard loading fix.
 *
 * Problem: Dashboard stayed in skeleton state for ~40 seconds because several
 * hooks/components fired Supabase queries before the session was ready, causing
 * 401 errors and React Query retries with exponential backoff.
 *
 * Fix: Added `sessionReady` gate and `waitForSession()` to all hooks that
 * query Supabase directly, so queries only fire after the token is valid.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Helper to read source files
function readSource(relativePath: string): string {
  const fullPath = path.resolve(__dirname, '..', relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

describe('Dashboard Loading Fix - Session Gating', () => {
  describe('useEquipmentInventory (useEquipment.ts)', () => {
    const source = readSource('hooks/useEquipment.ts');

    it('should import waitForSession from supabase client', () => {
      expect(source).toContain('waitForSession');
      expect(source).toMatch(/import\s+\{[^}]*waitForSession[^}]*\}\s+from\s+['"]@\/integrations\/supabase\/client['"]/);
    });

    it('should destructure sessionReady from useAuth', () => {
      expect(source).toContain('sessionReady');
      expect(source).toMatch(/useAuth\(\)/);
    });

    it('should gate equipment-inventory query on sessionReady', () => {
      expect(source).toMatch(/enabled:\s*!!orgId\s*&&\s*sessionReady/);
    });

    it('should call waitForSession inside queryFn', () => {
      // The queryFn should await waitForSession before querying Supabase
      const queryFnMatch = source.match(/queryFn:\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)enabled:/);
      expect(queryFnMatch).toBeTruthy();
      expect(queryFnMatch![1]).toContain('await waitForSession()');
    });
  });

  describe('EquipmentStockWidget', () => {
    const source = readSource('components/dashboard/EquipmentStockWidget.tsx');

    it('should import waitForSession from supabase client', () => {
      expect(source).toContain('waitForSession');
    });

    it('should destructure sessionReady from useAuth', () => {
      expect(source).toMatch(/\{\s*[^}]*sessionReady[^}]*\}\s*=\s*useAuth\(\)/);
    });

    it('should gate equipment-today-demand query on sessionReady', () => {
      expect(source).toMatch(/enabled:\s*!!profile\?\.organization_id\s*&&\s*sessionReady/);
    });

    it('should call waitForSession inside demand queryFn', () => {
      expect(source).toContain('await waitForSession()');
    });

    it('should handle inventory errors gracefully instead of infinite skeleton', () => {
      expect(source).toContain('inventoryError');
      expect(source).toContain('No se pudo cargar el stock');
    });
  });

  describe('useNotifications', () => {
    const source = readSource('hooks/useNotifications.ts');

    it('should import waitForSession from supabase client', () => {
      expect(source).toContain('waitForSession');
      expect(source).toMatch(/import\s+\{[^}]*waitForSession[^}]*\}\s+from\s+['"]@\/integrations\/supabase\/client['"]/);
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

    it('should call waitForSession inside notifications queryFn', () => {
      // Count occurrences of waitForSession in queryFn contexts
      const waitCalls = source.match(/await waitForSession\(\)/g);
      expect(waitCalls).toBeTruthy();
      expect(waitCalls!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('useReminderNotifications', () => {
    const source = readSource('hooks/useReminderNotifications.ts');

    it('should import waitForSession from supabase client', () => {
      expect(source).toContain('waitForSession');
    });

    it('should call waitForSession before querying reminders', () => {
      expect(source).toContain('await waitForSession()');
    });
  });

  describe('useOperationalDashboard', () => {
    const source = readSource('hooks/useOperationalDashboard.ts');

    it('should NOT have redundant waitForSession inside queryFn (sessionReady already gates)', () => {
      // The query is already gated by `enabled: !!orgId && sessionReady`
      // so waitForSession inside queryFn is redundant and adds latency
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
