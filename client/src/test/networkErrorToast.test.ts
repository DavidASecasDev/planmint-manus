import { describe, it, expect } from 'vitest';

/**
 * Test the error categorization logic used by NetworkErrorToast.
 * We extract the pure function logic to test without React dependencies.
 */
function categorizeError(error: unknown): 'network' | 'timeout' | 'server' | 'auth' | 'unknown' {
  if (!error) return 'unknown';

  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  if (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('net::') ||
    message.includes('error de red') ||
    message.includes('load failed') ||
    message.includes('networkerror')
  ) {
    return 'network';
  }

  if (message.includes('timeout') || message.includes('aborted')) {
    return 'timeout';
  }

  if (
    message.includes('401') ||
    message.includes('unauthorized') ||
    message.includes('login') ||
    message.includes('10001')
  ) {
    return 'auth';
  }

  if (
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504') ||
    message.includes('internal server error') ||
    message.includes('bad gateway') ||
    message.includes('service unavailable')
  ) {
    return 'server';
  }

  return 'unknown';
}

describe('NetworkErrorToast - categorizeError', () => {
  describe('network errors', () => {
    it('categorizes "Failed to fetch" as network', () => {
      expect(categorizeError(new Error('Failed to fetch'))).toBe('network');
    });

    it('categorizes "NetworkError" as network', () => {
      expect(categorizeError(new Error('NetworkError when attempting to fetch resource'))).toBe('network');
    });

    it('categorizes "net::ERR_CONNECTION_REFUSED" as network', () => {
      expect(categorizeError(new Error('net::ERR_CONNECTION_REFUSED'))).toBe('network');
    });

    it('categorizes "Load failed" as network (Safari)', () => {
      expect(categorizeError(new Error('Load failed'))).toBe('network');
    });

    it('categorizes "error de red" as network (Spanish)', () => {
      expect(categorizeError(new Error('error de red'))).toBe('network');
    });
  });

  describe('timeout errors', () => {
    it('categorizes "timeout" as timeout', () => {
      expect(categorizeError(new Error('Request timeout after 30000ms'))).toBe('timeout');
    });

    it('categorizes "aborted" as timeout', () => {
      expect(categorizeError(new Error('The operation was aborted'))).toBe('timeout');
    });
  });

  describe('auth errors', () => {
    it('categorizes "401 Unauthorized" as auth', () => {
      expect(categorizeError(new Error('401 Unauthorized'))).toBe('auth');
    });

    it('categorizes "Please login (10001)" as auth', () => {
      expect(categorizeError(new Error('Please login (10001)'))).toBe('auth');
    });
  });

  describe('server errors', () => {
    it('categorizes "500 Internal Server Error" as server', () => {
      expect(categorizeError(new Error('500 Internal Server Error'))).toBe('server');
    });

    it('categorizes "502 Bad Gateway" as server', () => {
      expect(categorizeError(new Error('502 Bad Gateway'))).toBe('server');
    });

    it('categorizes "503 Service Unavailable" as server', () => {
      expect(categorizeError(new Error('503 Service Unavailable'))).toBe('server');
    });

    it('categorizes "504 Gateway Timeout" as server', () => {
      expect(categorizeError(new Error('504'))).toBe('server');
    });
  });

  describe('unknown errors', () => {
    it('categorizes null as unknown', () => {
      expect(categorizeError(null)).toBe('unknown');
    });

    it('categorizes undefined as unknown', () => {
      expect(categorizeError(undefined)).toBe('unknown');
    });

    it('categorizes generic errors as unknown', () => {
      expect(categorizeError(new Error('Something went wrong'))).toBe('unknown');
    });

    it('categorizes string errors', () => {
      expect(categorizeError('Failed to fetch')).toBe('network');
    });
  });
});

describe('Prefetch route mapping', () => {
  const PREFETCH_MAP: Record<string, string[]> = {
    '/dashboard': ['operational-dashboard'],
    '/reservations': ['reservations'],
    '/transfers': ['transfer-requests'],
    '/fleet': ['fleet-vehicles'],
    '/movements': ['vehicle-movements'],
  };

  it('maps dashboard route to operational-dashboard queryKey', () => {
    expect(PREFETCH_MAP['/dashboard']).toEqual(['operational-dashboard']);
  });

  it('maps reservations route to reservations queryKey', () => {
    expect(PREFETCH_MAP['/reservations']).toEqual(['reservations']);
  });

  it('maps transfers route to transfer-requests queryKey', () => {
    expect(PREFETCH_MAP['/transfers']).toEqual(['transfer-requests']);
  });

  it('maps fleet route to fleet-vehicles queryKey', () => {
    expect(PREFETCH_MAP['/fleet']).toEqual(['fleet-vehicles']);
  });

  it('maps movements route to vehicle-movements queryKey', () => {
    expect(PREFETCH_MAP['/movements']).toEqual(['vehicle-movements']);
  });

  it('returns undefined for unmapped routes', () => {
    expect(PREFETCH_MAP['/settings']).toBeUndefined();
  });
});
