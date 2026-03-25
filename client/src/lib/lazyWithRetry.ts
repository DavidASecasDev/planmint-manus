import { lazy, ComponentType } from 'react';

/**
 * Wraps React.lazy() with automatic retry and cache-busting for failed dynamic imports.
 *
 * After a new deployment, the old JS chunk hashes no longer exist on the server.
 * The server returns the SPA fallback (index.html with text/html MIME type) instead,
 * causing "Failed to fetch dynamically imported module" errors.
 *
 * This wrapper:
 * 1. Retries the import up to `maxRetries` times with exponential backoff
 * 2. On retry, appends a cache-busting query param to force a fresh fetch
 * 3. On final failure, triggers a full page reload (which fetches the new index.html
 *    with updated chunk references)
 *
 * @param importFn - The dynamic import function, e.g. () => import('./pages/Fleet')
 * @param maxRetries - Maximum number of retries (default: 2)
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  maxRetries = 2
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
      // All retries exhausted — check if we've already tried reloading
      const hasReloaded = sessionStorage.getItem('chunk-reload');
      if (!hasReloaded) {
        sessionStorage.setItem('chunk-reload', '1');
        // Full reload to get the new index.html with updated chunk references
        window.location.reload();
        // Return a never-resolving promise to prevent React from rendering an error
        return new Promise(() => {});
      }
      // Already reloaded once — throw the original error to show ErrorBoundary
      sessionStorage.removeItem('chunk-reload');
      throw error;
    }

    // Wait with exponential backoff before retrying
    const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
    await new Promise(resolve => setTimeout(resolve, delay));

    return retryImport(importFn, retriesLeft - 1, attempt + 1);
  }
}

// Clear the reload flag on successful page load
// This ensures the reload mechanism works again on the next deployment
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    sessionStorage.removeItem('chunk-reload');
  });
}
