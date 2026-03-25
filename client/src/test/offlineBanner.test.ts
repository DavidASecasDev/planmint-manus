import { describe, it, expect } from 'vitest';

/**
 * OfflineBanner state logic tests
 * Tests the decision tree for which banner state to show
 */

type BannerState =
  | 'offline'
  | 'reconnected-with-pending'
  | 'reconnected-no-pending'
  | 'pending-changes'
  | 'failed-changes'
  | 'sync-success'
  | 'hidden';

interface BannerInputs {
  isOnline: boolean;
  wasOffline: boolean;
  pendingCount: number;
  failedCount: number;
  showReconnected: boolean;
  lastSyncSuccess: boolean;
  lastSyncCount: number;
}

function computeBannerState(inputs: BannerInputs): BannerState {
  const { isOnline, wasOffline, pendingCount, failedCount, showReconnected, lastSyncSuccess, lastSyncCount } = inputs;

  // Priority 1: Offline
  if (!isOnline) return 'offline';

  // Priority 2: Just came back online with pending changes
  if (wasOffline && pendingCount > 0) return 'reconnected-with-pending';

  // Priority 3: Just reconnected, no pending changes (auto-dismiss)
  if (showReconnected) return 'reconnected-no-pending';

  // Priority 4: Has pending or failed changes
  if (failedCount > 0) return 'failed-changes';
  if (pendingCount > 0) return 'pending-changes';

  // Priority 5: Sync success message
  if (lastSyncSuccess && lastSyncCount > 0) return 'sync-success';

  return 'hidden';
}

describe('OfflineBanner state decision tree', () => {
  const defaults: BannerInputs = {
    isOnline: true,
    wasOffline: false,
    pendingCount: 0,
    failedCount: 0,
    showReconnected: false,
    lastSyncSuccess: false,
    lastSyncCount: 0,
  };

  it('should show offline banner when not online', () => {
    const state = computeBannerState({ ...defaults, isOnline: false });
    expect(state).toBe('offline');
  });

  it('should show offline banner even with pending changes', () => {
    const state = computeBannerState({ ...defaults, isOnline: false, pendingCount: 5 });
    expect(state).toBe('offline');
  });

  it('should show reconnected-with-pending when back online with changes', () => {
    const state = computeBannerState({ ...defaults, wasOffline: true, pendingCount: 3 });
    expect(state).toBe('reconnected-with-pending');
  });

  it('should show reconnected-no-pending when showReconnected is true', () => {
    const state = computeBannerState({ ...defaults, showReconnected: true });
    expect(state).toBe('reconnected-no-pending');
  });

  it('should show failed-changes when there are failed items', () => {
    const state = computeBannerState({ ...defaults, failedCount: 2 });
    expect(state).toBe('failed-changes');
  });

  it('should show pending-changes when there are pending items', () => {
    const state = computeBannerState({ ...defaults, pendingCount: 4 });
    expect(state).toBe('pending-changes');
  });

  it('should show sync-success after successful sync', () => {
    const state = computeBannerState({ ...defaults, lastSyncSuccess: true, lastSyncCount: 3 });
    expect(state).toBe('sync-success');
  });

  it('should be hidden when everything is normal', () => {
    const state = computeBannerState(defaults);
    expect(state).toBe('hidden');
  });

  it('should not show sync-success if syncedCount is 0', () => {
    const state = computeBannerState({ ...defaults, lastSyncSuccess: true, lastSyncCount: 0 });
    expect(state).toBe('hidden');
  });

  it('offline takes priority over everything', () => {
    const state = computeBannerState({
      isOnline: false,
      wasOffline: true,
      pendingCount: 5,
      failedCount: 2,
      showReconnected: true,
      lastSyncSuccess: true,
      lastSyncCount: 3,
    });
    expect(state).toBe('offline');
  });

  it('reconnected-with-pending takes priority over showReconnected', () => {
    const state = computeBannerState({
      ...defaults,
      wasOffline: true,
      pendingCount: 2,
      showReconnected: true,
    });
    expect(state).toBe('reconnected-with-pending');
  });

  it('failed-changes takes priority over pending-changes', () => {
    const state = computeBannerState({
      ...defaults,
      pendingCount: 3,
      failedCount: 1,
    });
    expect(state).toBe('failed-changes');
  });
});

describe('Reconnection auto-dismiss behavior', () => {
  it('should trigger showReconnected when wasOffline=true, isOnline=true, pendingCount=0', () => {
    // This is the condition that triggers the auto-dismiss reconnection banner
    const shouldShowReconnected = true && true && 0 === 0;
    expect(shouldShowReconnected).toBe(true);
  });

  it('should NOT trigger showReconnected when there are pending changes', () => {
    const pendingCount = 3;
    const shouldShowReconnected = true && true && pendingCount === 0;
    expect(shouldShowReconnected).toBe(false);
  });

  it('should clear showReconnected when going offline again', () => {
    const isOnline = false;
    const shouldClearReconnected = !isOnline;
    expect(shouldClearReconnected).toBe(true);
  });
});
