import { describe, it, expect } from 'vitest';

describe('Environment Validation', () => {
  it('should have fallback values for Supabase configuration', async () => {
    // In test environment, env vars may not be set.
    // The app uses fallbacks in lib/env.ts, so we validate those work correctly.
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('@/lib/env');
    expect(SUPABASE_URL).toBeDefined();
    expect(SUPABASE_URL).toMatch(/^https:\/\/.*\.supabase\.co$/);
    expect(SUPABASE_ANON_KEY).toBeDefined();
    expect(SUPABASE_ANON_KEY.length).toBeGreaterThan(0);
  });
});

describe('Logger Utility', () => {
  it('should create logger with context', async () => {
    const { createLogger } = await import('@/lib/logger');
    const log = createLogger({ context: 'Test' });
    
    expect(log).toHaveProperty('debug');
    expect(log).toHaveProperty('info');
    expect(log).toHaveProperty('warn');
    expect(log).toHaveProperty('error');
  });
});
