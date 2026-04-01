import { lazy, ComponentType } from 'react';

/**
 * Wraps React.lazy() with automatic retry for failed dynamic imports.
 *
 * After a new deployment, the old JS chunk hashes no longer exist on the server.
 * The server returns the SPA fallback (index.html with text/html MIME type) instead,
 * causing "Failed to fetch dynamically imported module" errors.
 *
 * This wrapper:
 * 1. Retries the import up to `maxRetries` times with short delays
 * 2. On final failure, throws the error to be caught by ErrorBoundary
 *    (NEVER auto-reloads — that would interrupt user work mid-task)
 *
 * @param importFn - The dynamic import function, e.g. () => import('./pages/Fleet')
 * @param maxRetries - Maximum number of retries (default: 3)
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  maxRetries = 3
) {
  return lazy(() => retryImport(importFn, maxRetries));
}

async function retryImport<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  retriesLeft: number,
  attempt = 0
): Promise<{ default: T }> {
  try {
    return await importFn();
  } catch (error) {
    if (retriesLeft <= 0) {
      // All retries exhausted.
      // IMPORTANT: Do NOT auto-reload the page here.
      // Auto-reloading interrupts user work (form data, unsaved changes).
      // Instead, let the error propagate to ErrorBoundary which shows
      // a "Reintentar" button the user can click when ready.
      console.error('[LazyLoad] Failed to load chunk after retries:', error);
      throw error;
    }

    // Short delays between retries: 200ms, 400ms, 800ms
    const delay = Math.min(200 * Math.pow(2, attempt), 1000);
    await new Promise(resolve => setTimeout(resolve, delay));
    return retryImport(importFn, retriesLeft - 1, attempt + 1);
  }
}
