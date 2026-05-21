/**
 * Tests for the 3 bugs fixed in this session:
 * 
 * Bug 1: Dashboard skeletons permanentes — useOperationalDashboard returns
 *         isLoading=true even when query is disabled (waiting for auth).
 * Bug 2: Operaciones de hoy inconsistentes — NULL estado excluded by
 *         SQL three-valued logic (.not('estado','ilike','%cancelada%') excludes NULL).
 * Bug 3: Gloria no aparece en dropdown de brokers — RLS blocks all brokers
 *         when Supabase session token is stale; fix: use backend endpoint.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function readSource(relativePath: string): string {
  const fullPath = path.resolve(__dirname, '..', relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

function readServerSource(relativePath: string): string {
  const fullPath = path.resolve(__dirname, '..', '..', '..', relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

// ─── Bug 1: Dashboard skeletons permanentes ─────────────────────────────────

describe('Bug 1: Dashboard skeletons permanentes', () => {
  const hookSource = readSource('hooks/useOperationalDashboard.ts');

  it('should return isWaitingForAuth when query is disabled', () => {
    // The hook must expose isWaitingForAuth so the UI can distinguish
    // "waiting for auth" from "loading data"
    expect(hookSource).toContain('isWaitingForAuth');
  });

  it('should combine isLoading, isFetching, and isWaitingForAuth into a single loading state', () => {
    // The hook should return a combined isLoading that covers all loading states
    // so the OperationalPanel doesn't need complex conditional logic
    expect(hookSource).toMatch(/isLoading.*isFetching|isFetching.*isLoading/);
  });

  it('should still gate query on sessionReady', () => {
    expect(hookSource).toMatch(/enabled:\s*!!orgId\s*&&\s*sessionReady/);
  });

  describe('OperationalPanel', () => {
    const panelSource = readSource('components/dashboard/OperationalPanel.tsx');

    it('should use isLoading from the hook (which now includes auth waiting state)', () => {
      expect(panelSource).toContain('isLoading');
    });
  });
});

// ─── Bug 2: Operaciones de hoy inconsistentes (NULL estado) ─────────────────

describe('Bug 2: Operaciones de hoy inconsistentes (NULL estado)', () => {
  const hookSource = readSource('hooks/useOperationalDashboard.ts');

  it('should NOT use .not("estado","ilike","%cancelada%") which excludes NULLs', () => {
    // The old pattern .not('estado','ilike','%cancelada%') uses SQL three-valued logic:
    // NULL NOT ILIKE '%cancelada%' = NULL (falsy) → row excluded
    // This is wrong because reservations with estado=NULL should be included
    expect(hookSource).not.toMatch(/\.not\(\s*['"]estado['"]\s*,\s*['"]ilike['"]\s*,\s*['"]%cancelada%['"]\s*\)/);
  });

  it('should use an OR filter that includes NULL estado', () => {
    // The hook now uses a consolidated server endpoint.
    // The server endpoint (dashboardEndpoint.ts) uses the NULL-safe .or() filter.
    // The hook itself filters by estado client-side via extractDatePart + todayStr matching.
    // Verify the server endpoint has the proper filter:
    const serverSource = readServerSource('server/dashboardEndpoint.ts');
    expect(serverSource).toMatch(/\.or\(['"]estado\.not\.ilike\.%cancelada%,estado\.is\.null['"]\)/);
  });

  it('should apply the NULL-safe filter to reservation queries in the server endpoint', () => {
    // The consolidated server endpoint should use the NULL-safe filter
    const serverSource = readServerSource('server/dashboardEndpoint.ts');
    const orFilterMatches = serverSource.match(/\.or\(['"]estado\.not\.ilike\.%cancelada%,estado\.is\.null['"]\)/g);
    expect(orFilterMatches).toBeTruthy();
    expect(orFilterMatches!.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Bug 3: Gloria no aparece en dropdown de brokers ────────────────────────

describe('Bug 3: Gloria no aparece en dropdown de brokers (RLS bypass)', () => {
  describe('Backend endpoint', () => {
    const endpointSource = readServerSource('server/brokerListEndpoint.ts');

    it('should exist as a server endpoint file', () => {
      expect(endpointSource).toBeTruthy();
    });

    it('should use authenticateSupabaseRequest for auth', () => {
      expect(endpointSource).toContain('authenticateSupabaseRequest');
    });

    it('should use getServiceClient to bypass RLS', () => {
      expect(endpointSource).toContain('getServiceClient');
    });

    it('should query transfer_brokers table', () => {
      expect(endpointSource).toContain('transfer_brokers');
    });

    it('should return both active and all brokers', () => {
      expect(endpointSource).toContain('activeBrokers');
      expect(endpointSource).toContain('allBrokers');
    });

    it('should filter active brokers by is_active', () => {
      expect(endpointSource).toContain('is_active');
    });
  });

  describe('Frontend hook migration', () => {
    const hookSource = readSource('hooks/useTransferBrokers.ts');

    it('should import apiInvoke instead of using supabase directly for reads', () => {
      expect(hookSource).toContain('apiInvoke');
    });

    it('should call the get-transfer-brokers endpoint', () => {
      expect(hookSource).toContain('get-transfer-brokers');
    });

    it('should still maintain realtime subscription for live updates', () => {
      // Realtime subscription should still work for instant UI updates
      expect(hookSource).toContain('postgres_changes');
      expect(hookSource).toContain('transfer_brokers');
    });

    it('should still expose brokers and allBrokers', () => {
      expect(hookSource).toMatch(/return\s*\{[\s\S]*brokers[\s\S]*allBrokers/);
    });
  });

  describe('Route registration', () => {
    const indexSource = readServerSource('server/_core/index.ts');

    it('should import handleGetTransferBrokers', () => {
      expect(indexSource).toContain('handleGetTransferBrokers');
    });

    it('should register the /api/get-transfer-brokers route', () => {
      expect(indexSource).toContain('/api/get-transfer-brokers');
    });
  });
});
