import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  SyncQueueItem,
  LocalEntity,
  updateSyncItemStatus,
  addTempIdMapping,
  updateReferencesWithRealId,
  getRealIdFromTemp,
  isTempId,
  getFromStore,
  putToStore,
  deleteFromStore,
} from '@/lib/offlineDb';
import { useOfflineStorage } from './useOfflineStorage';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  conflicts: ConflictInfo[];
}

export interface ConflictInfo {
  syncItemId: string;
  entityType: LocalEntity['entity_type'];
  entityId: string;
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  localUpdatedAt: string;
  serverUpdatedAt: string;
}

export type ConflictResolution = 'local' | 'server';

export const useSyncEngine = () => {
  const { user, organization } = useAuth();
  const { getPendingItems, removeFromSyncQueue, refreshCounts, saveEntityLocally } = useOfflineStorage();
  const [isSyncing, setIsSyncing] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  // Check if user has permission for the entity
  const checkPermission = useCallback(async (
    entityType: LocalEntity['entity_type'],
    action: SyncQueueItem['action']
  ): Promise<boolean> => {
    if (!user || !organization) return false;
    
    // For now, basic check - user is authenticated and belongs to org
    // More granular checks could be added based on role
    return true;
  }, [user, organization]);

  // Sync a single create action
  const syncCreate = useCallback(async (
    item: SyncQueueItem
  ): Promise<{ success: boolean; realId?: string; error?: string }> => {
    const { entity_type, payload, temp_id } = item;
    
    try {
      // Resolve any temp IDs in the payload
      const resolvedPayload = { ...payload };
      for (const [key, value] of Object.entries(resolvedPayload)) {
        if (typeof value === 'string' && isTempId(value)) {
          const realId = await getRealIdFromTemp(value);
          if (realId) {
            resolvedPayload[key] = realId;
          } else {
            // Parent entity not yet synced, skip for now
            return { success: false, error: 'Parent entity not yet synced' };
          }
        }
      }

      let result;
      
      switch (entity_type) {
        case 'task':
          result = await supabase.from('tasks').insert(resolvedPayload as any).select().single();
          break;
        case 'area':
          result = await supabase.from('areas').insert(resolvedPayload as any).select().single();
          break;
        case 'tag':
          result = await supabase.from('tags').insert(resolvedPayload as any).select().single();
          break;
        case 'subtask':
          result = await supabase.from('task_subtasks').insert(resolvedPayload as any).select().single();
          break;
        case 'milestone':
          result = await supabase.from('task_milestones').insert(resolvedPayload as any).select().single();
          break;
        case 'update':
          result = await supabase.from('task_updates').insert(resolvedPayload as any).select().single();
          break;
        case 'reminder':
          result = await supabase.from('reminders').insert(resolvedPayload as any).select().single();
          break;
        default:
          return { success: false, error: `Unknown entity type: ${entity_type}` };
      }

      if (result.error) {
        return { success: false, error: result.error.message };
      }

      const realId = result.data.id;

      // If this was a temp entity, map the IDs
      if (temp_id && isTempId(temp_id)) {
        await addTempIdMapping({ temp_id, real_id: realId, entity_type });
        await updateReferencesWithRealId(temp_id, realId, entity_type);
      }

      return { success: true, realId };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, []);

  // Sync a single update action
  const syncUpdate = useCallback(async (
    item: SyncQueueItem
  ): Promise<{ success: boolean; conflict?: ConflictInfo; error?: string }> => {
    const { entity_type, entity_id, payload } = item;
    
    try {
      // Resolve entity_id if it's a temp ID
      let realEntityId = entity_id;
      if (isTempId(entity_id)) {
        const resolved = await getRealIdFromTemp(entity_id);
        if (!resolved) {
          return { success: false, error: 'Entity not yet synced' };
        }
        realEntityId = resolved;
      }

      // First, fetch current server state to check for conflicts
      let serverResult;
      switch (entity_type) {
        case 'task':
          serverResult = await supabase.from('tasks').select('*').eq('id', realEntityId).maybeSingle();
          break;
        case 'area':
          serverResult = await supabase.from('areas').select('*').eq('id', realEntityId).maybeSingle();
          break;
        case 'tag':
          serverResult = await supabase.from('tags').select('*').eq('id', realEntityId).maybeSingle();
          break;
        case 'subtask':
          serverResult = await supabase.from('task_subtasks').select('*').eq('id', realEntityId).maybeSingle();
          break;
        case 'milestone':
          serverResult = await supabase.from('task_milestones').select('*').eq('id', realEntityId).maybeSingle();
          break;
        default:
          return { success: false, error: `Update not supported for type: ${entity_type}` };
      }

      if (serverResult.error) {
        return { success: false, error: serverResult.error.message };
      }

      // Entity no longer exists on server
      if (!serverResult.data) {
        return { success: false, error: 'Entity no longer exists on server' };
      }

      const serverData = serverResult.data;
      const localEntity = await getFromStore<LocalEntity>('local_entities', `${entity_type}_${entity_id}`);
      
      // Check for conflict
      if (localEntity && serverData.updated_at) {
        const serverUpdatedAt = new Date(serverData.updated_at).getTime();
        const lastSyncedAt = localEntity.last_synced_at 
          ? new Date(localEntity.last_synced_at).getTime() 
          : 0;
        
        if (serverUpdatedAt > lastSyncedAt) {
          // Conflict detected
          const conflict: ConflictInfo = {
            syncItemId: item.id,
            entityType: entity_type,
            entityId: realEntityId,
            localData: payload,
            serverData,
            localUpdatedAt: localEntity.updated_at,
            serverUpdatedAt: serverData.updated_at,
          };
          return { success: false, conflict };
        }
      }

      // No conflict, proceed with update
      let updateResult;
      switch (entity_type) {
        case 'task':
          updateResult = await supabase.from('tasks').update(payload as any).eq('id', realEntityId);
          break;
        case 'area':
          updateResult = await supabase.from('areas').update(payload as any).eq('id', realEntityId);
          break;
        case 'tag':
          updateResult = await supabase.from('tags').update(payload as any).eq('id', realEntityId);
          break;
        case 'subtask':
          updateResult = await supabase.from('task_subtasks').update(payload as any).eq('id', realEntityId);
          break;
        case 'milestone':
          updateResult = await supabase.from('task_milestones').update(payload as any).eq('id', realEntityId);
          break;
      }

      if (updateResult?.error) {
        return { success: false, error: updateResult.error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, []);

  // Sync a single delete action
  const syncDelete = useCallback(async (
    item: SyncQueueItem
  ): Promise<{ success: boolean; error?: string }> => {
    const { entity_type, entity_id } = item;
    
    try {
      let realEntityId = entity_id;
      if (isTempId(entity_id)) {
        const resolved = await getRealIdFromTemp(entity_id);
        if (!resolved) {
          // Entity was never synced, just remove from queue
          return { success: true };
        }
        realEntityId = resolved;
      }

      let result;
      switch (entity_type) {
        case 'task':
          result = await supabase.from('tasks').delete().eq('id', realEntityId);
          break;
        case 'area':
          result = await supabase.from('areas').delete().eq('id', realEntityId);
          break;
        case 'tag':
          result = await supabase.from('tags').delete().eq('id', realEntityId);
          break;
        case 'subtask':
          result = await supabase.from('task_subtasks').delete().eq('id', realEntityId);
          break;
        case 'milestone':
          result = await supabase.from('task_milestones').delete().eq('id', realEntityId);
          break;
        case 'reminder':
          result = await supabase.from('reminders').delete().eq('id', realEntityId);
          break;
        default:
          return { success: false, error: `Delete not supported for type: ${entity_type}` };
      }

      if (result?.error) {
        return { success: false, error: result.error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, []);

  // Main sync function
  const sync = useCallback(async (): Promise<SyncResult> => {
    if (isSyncing) {
      return { success: false, syncedCount: 0, failedCount: 0, conflicts: [] };
    }

    setIsSyncing(true);
    const detectedConflicts: ConflictInfo[] = [];
    let syncedCount = 0;
    let failedCount = 0;

    try {
      const pendingItems = await getPendingItems();
      
      for (const item of pendingItems) {
        // Check permission
        const hasPermission = await checkPermission(item.entity_type, item.action);
        if (!hasPermission) {
          await updateSyncItemStatus(item.id, 'failed', 'Ya no tienes permisos para esta acción');
          failedCount++;
          continue;
        }

        await updateSyncItemStatus(item.id, 'syncing');

        let result;
        switch (item.action) {
          case 'create':
            result = await syncCreate(item);
            break;
          case 'update':
            result = await syncUpdate(item);
            if (result.conflict) {
              detectedConflicts.push(result.conflict);
              await updateSyncItemStatus(item.id, 'pending'); // Keep pending for conflict resolution
              continue;
            }
            break;
          case 'delete':
            result = await syncDelete(item);
            break;
        }

        if (result.success) {
          // Update local entity with synced status
          if (item.action !== 'delete') {
            const localEntity = await getFromStore<LocalEntity>(
              'local_entities',
              `${item.entity_type}_${item.entity_id}`
            );
            if (localEntity) {
              localEntity.last_synced_at = new Date().toISOString();
              localEntity.is_temp = false;
              if (result.realId && item.temp_id) {
                // Update the entity ID
                await deleteFromStore('local_entities', `${item.entity_type}_${item.entity_id}`);
                localEntity.id = `${item.entity_type}_${result.realId}`;
                localEntity.entity_id = result.realId;
              }
              await putToStore('local_entities', localEntity);
            }
          } else {
            // Delete was successful, remove local entity
            await deleteFromStore('local_entities', `${item.entity_type}_${item.entity_id}`);
          }
          
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else {
          await updateSyncItemStatus(item.id, 'failed', result.error);
          failedCount++;
        }
      }

      setConflicts(detectedConflicts);
      await refreshCounts();

      const syncResult: SyncResult = {
        success: failedCount === 0 && detectedConflicts.length === 0,
        syncedCount,
        failedCount,
        conflicts: detectedConflicts,
      };
      
      setLastSyncResult(syncResult);
      return syncResult;
    } catch (error) {
      console.error('Sync error:', error);
      const syncResult: SyncResult = {
        success: false,
        syncedCount,
        failedCount: failedCount + 1,
        conflicts: detectedConflicts,
      };
      setLastSyncResult(syncResult);
      return syncResult;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, getPendingItems, checkPermission, syncCreate, syncUpdate, syncDelete, removeFromSyncQueue, refreshCounts]);

  // Resolve a conflict
  const resolveConflict = useCallback(async (
    conflict: ConflictInfo,
    resolution: ConflictResolution
  ): Promise<boolean> => {
    try {
      if (resolution === 'local') {
        // Apply local changes to server
        const item = await getFromStore<SyncQueueItem>('sync_queue', conflict.syncItemId);
        if (!item) return false;

        let result;
        switch (conflict.entityType) {
          case 'task':
            result = await supabase.from('tasks').update(conflict.localData).eq('id', conflict.entityId);
            break;
          case 'area':
            result = await supabase.from('areas').update(conflict.localData).eq('id', conflict.entityId);
            break;
          // Add other types as needed
        }

        if (result?.error) {
          console.error('Error resolving conflict with local:', result.error);
          return false;
        }

        // Remove from queue
        await removeFromSyncQueue(conflict.syncItemId);
      } else {
        // Use server version - update local with server data
        await saveEntityLocally(
          conflict.entityType,
          conflict.entityId,
          conflict.serverData,
          false
        );
        
        // Remove from queue
        await removeFromSyncQueue(conflict.syncItemId);
      }

      // Remove this conflict from the list
      setConflicts(prev => prev.filter(c => c.syncItemId !== conflict.syncItemId));
      await refreshCounts();
      
      return true;
    } catch (error) {
      console.error('Error resolving conflict:', error);
      return false;
    }
  }, [removeFromSyncQueue, saveEntityLocally, refreshCounts]);

  // Retry failed items
  const retryFailed = useCallback(async (): Promise<void> => {
    const { getFailedItems } = await import('./useOfflineStorage').then(m => ({ getFailedItems: async () => {
      const { getFailedSyncItems } = await import('@/lib/offlineDb');
      return getFailedSyncItems();
    }}));
    
    const failedItems = await getFailedItems();
    
    for (const item of failedItems) {
      await updateSyncItemStatus(item.id, 'pending');
    }
    
    await refreshCounts();
  }, [refreshCounts]);

  return {
    isSyncing,
    conflicts,
    lastSyncResult,
    sync,
    resolveConflict,
    retryFailed,
  };
};
