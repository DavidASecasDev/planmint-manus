import React, { createContext, useContext, ReactNode, useState, useCallback, useEffect } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';
import { useSyncEngine, SyncResult, ConflictInfo, ConflictResolution } from '@/hooks/useSyncEngine';
import { useSubscription } from '@/hooks/useSubscription';
import { SyncQueueItem } from '@/lib/offlineDb';

interface OfflineContextType {
  // Status
  isOnline: boolean;
  wasOffline: boolean;
  isReady: boolean;
  pendingCount: number;
  failedCount: number;
  
  // Sync
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;
  conflicts: ConflictInfo[];
  
  // Actions
  sync: () => Promise<SyncResult>;
  resolveConflict: (conflict: ConflictInfo, resolution: ConflictResolution) => Promise<boolean>;
  retryFailed: () => Promise<void>;
  clearWasOffline: () => void;
  
  // Offline operations
  canDoOffline: (action: 'create' | 'update' | 'delete', entityType: string) => boolean;
  saveOffline: (
    entityType: SyncQueueItem['entity_type'],
    entityId: string,
    action: SyncQueueItem['action'],
    data: Record<string, unknown>,
    tempId?: string
  ) => Promise<void>;
  
  // Storage helpers
  getPendingItems: () => Promise<SyncQueueItem[]>;
  getFailedItems: () => Promise<SyncQueueItem[]>;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return context;
};

interface OfflineProviderProps {
  children: ReactNode;
}

export const OfflineProvider = ({ children }: OfflineProviderProps) => {
  const { isOnline, wasOffline, clearWasOffline } = useOnlineStatus();
  const { subscription } = useSubscription();
  const {
    isReady,
    pendingCount,
    failedCount,
    saveEntityLocally,
    addToSyncQueue,
    getPendingItems,
    getFailedItems,
    generateTempId,
    refreshCounts,
  } = useOfflineStorage();
  
  const {
    isSyncing,
    conflicts,
    lastSyncResult,
    sync,
    resolveConflict,
    retryFailed,
  } = useSyncEngine();

  // Determine what actions are allowed offline based on plan
  const canDoOffline = useCallback((
    action: 'create' | 'update' | 'delete',
    entityType: string
  ): boolean => {
    const plan = subscription?.plan || 'free';
    
    // Free plan: limited offline actions
    if (plan === 'free') {
      // Only allow status changes and subtask toggling
      if (action === 'update') {
        return ['subtask', 'task'].includes(entityType);
      }
      return false;
    }
    
    // Pro and Team: full offline support
    return true;
  }, [subscription]);

  // Save data for offline use and queue for sync
  const saveOffline = useCallback(async (
    entityType: SyncQueueItem['entity_type'],
    entityId: string,
    action: SyncQueueItem['action'],
    data: Record<string, unknown>,
    tempId?: string
  ): Promise<void> => {
    // Save entity locally
    const isTemp = action === 'create' && !!tempId;
    await saveEntityLocally(entityType, entityId, data, isTemp);
    
    // Add to sync queue
    await addToSyncQueue(entityType, entityId, action, data, tempId);
  }, [saveEntityLocally, addToSyncQueue]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        wasOffline,
        isReady,
        pendingCount,
        failedCount,
        isSyncing,
        lastSyncResult,
        conflicts,
        sync,
        resolveConflict,
        retryFailed,
        clearWasOffline,
        canDoOffline,
        saveOffline,
        getPendingItems,
        getFailedItems,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
};
