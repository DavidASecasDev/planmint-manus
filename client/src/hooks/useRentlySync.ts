import { useRentlySyncContext } from '@/contexts/RentlySyncContext';
export type { SyncProgress } from '@/contexts/RentlySyncContext';

/**
 * Thin wrapper over the global RentlySyncContext.
 * Keeps the same API so existing consumers don't need changes.
 */
export function useRentlySync() {
  return useRentlySyncContext();
}
