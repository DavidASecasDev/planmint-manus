import { useState, useEffect, useCallback } from 'react';
import {
  LocalEntity,
  SyncQueueItem,
  openDB,
  putToStore,
  getFromStore,
  getAllFromStore,
  deleteFromStore,
  getByIndex,
  getPendingSyncItems,
  getFailedSyncItems,
  generateTempId,
  isTempId,
} from '@/lib/offlineDb';

export const useOfflineStorage = () => {
  const [isReady, setIsReady] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  // Initialize DB
  useEffect(() => {
    const init = async () => {
      try {
        await openDB();
        setIsReady(true);
        await refreshCounts();
      } catch (error) {
        console.error('Failed to initialize offline DB:', error);
      }
    };
    init();
  }, []);

  const refreshCounts = useCallback(async () => {
    try {
      const pending = await getPendingSyncItems();
      const failed = await getFailedSyncItems();
      setPendingCount(pending.length);
      setFailedCount(failed.length);
    } catch (error) {
      console.error('Error refreshing counts:', error);
    }
  }, []);

  // Save entity locally
  const saveEntityLocally = useCallback(async (
    entityType: LocalEntity['entity_type'],
    entityId: string,
    data: Record<string, unknown>,
    isTemp = false
  ): Promise<LocalEntity> => {
    const entity: LocalEntity = {
      id: `${entityType}_${entityId}`,
      entity_type: entityType,
      entity_id: entityId,
      data,
      last_synced_at: isTemp ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_temp: isTemp,
    };
    
    await putToStore('local_entities', entity);
    return entity;
  }, []);

  // Get entity from local storage
  const getLocalEntity = useCallback(async (
    entityType: LocalEntity['entity_type'],
    entityId: string
  ): Promise<LocalEntity | undefined> => {
    return getFromStore<LocalEntity>('local_entities', `${entityType}_${entityId}`);
  }, []);

  // Get all entities of a type
  const getLocalEntitiesByType = useCallback(async (
    entityType: LocalEntity['entity_type']
  ): Promise<LocalEntity[]> => {
    return getByIndex<LocalEntity>('local_entities', 'by_type', entityType);
  }, []);

  // Add action to sync queue
  const addToSyncQueue = useCallback(async (
    entityType: LocalEntity['entity_type'],
    entityId: string,
    action: SyncQueueItem['action'],
    payload: Record<string, unknown>,
    tempId?: string
  ): Promise<SyncQueueItem> => {
    const item: SyncQueueItem = {
      id: crypto.randomUUID(),
      entity_type: entityType,
      entity_id: entityId,
      action,
      payload,
      created_at: new Date().toISOString(),
      status: 'pending',
      error_message: null,
      temp_id: tempId,
    };
    
    await putToStore('sync_queue', item);
    await refreshCounts();
    return item;
  }, [refreshCounts]);

  // Get pending sync items
  const getPendingItems = useCallback(async (): Promise<SyncQueueItem[]> => {
    return getPendingSyncItems();
  }, []);

  // Get failed sync items
  const getFailedItems = useCallback(async (): Promise<SyncQueueItem[]> => {
    return getFailedSyncItems();
  }, []);

  // Remove from sync queue
  const removeFromSyncQueue = useCallback(async (id: string): Promise<void> => {
    await deleteFromStore('sync_queue', id);
    await refreshCounts();
  }, [refreshCounts]);

  // Delete local entity
  const deleteLocalEntity = useCallback(async (
    entityType: LocalEntity['entity_type'],
    entityId: string
  ): Promise<void> => {
    await deleteFromStore('local_entities', `${entityType}_${entityId}`);
  }, []);

  return {
    isReady,
    pendingCount,
    failedCount,
    saveEntityLocally,
    getLocalEntity,
    getLocalEntitiesByType,
    addToSyncQueue,
    getPendingItems,
    getFailedItems,
    removeFromSyncQueue,
    deleteLocalEntity,
    refreshCounts,
    generateTempId,
    isTempId,
  };
};
