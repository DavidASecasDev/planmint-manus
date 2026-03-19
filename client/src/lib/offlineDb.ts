// IndexedDB wrapper for offline storage
const DB_NAME = 'areas-goals-offline';
const DB_VERSION = 1;

export interface LocalEntity {
  id: string;
  entity_type: 'task' | 'area' | 'tag' | 'subtask' | 'milestone' | 'update' | 'reminder';
  entity_id: string;
  data: Record<string, unknown>;
  last_synced_at: string | null;
  updated_at: string;
  is_temp: boolean;
}

export interface SyncQueueItem {
  id: string;
  entity_type: LocalEntity['entity_type'];
  entity_id: string;
  action: 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  created_at: string;
  status: 'pending' | 'syncing' | 'failed';
  error_message: string | null;
  temp_id?: string;
}

export interface TempIdMapping {
  temp_id: string;
  real_id: string;
  entity_type: LocalEntity['entity_type'];
}

let dbPromise: Promise<IDBDatabase> | null = null;

export const openDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Local entities store
      if (!db.objectStoreNames.contains('local_entities')) {
        const entitiesStore = db.createObjectStore('local_entities', { keyPath: 'id' });
        entitiesStore.createIndex('by_type', 'entity_type', { unique: false });
        entitiesStore.createIndex('by_entity_id', 'entity_id', { unique: false });
      }

      // Sync queue store
      if (!db.objectStoreNames.contains('sync_queue')) {
        const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
        queueStore.createIndex('by_status', 'status', { unique: false });
        queueStore.createIndex('by_created_at', 'created_at', { unique: false });
      }

      // Temp ID mappings store
      if (!db.objectStoreNames.contains('temp_id_mappings')) {
        const mappingsStore = db.createObjectStore('temp_id_mappings', { keyPath: 'temp_id' });
        mappingsStore.createIndex('by_real_id', 'real_id', { unique: false });
      }
    };
  });

  return dbPromise;
};

// Generic CRUD operations
export const addToStore = async <T>(storeName: string, data: T): Promise<T> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(data);
    request.onsuccess = () => resolve(data);
    request.onerror = () => reject(request.error);
  });
};

export const putToStore = async <T>(storeName: string, data: T): Promise<T> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve(data);
    request.onerror = () => reject(request.error);
  });
};

export const getFromStore = async <T>(storeName: string, key: string): Promise<T | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getAllFromStore = async <T>(storeName: string): Promise<T[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteFromStore = async (storeName: string, key: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getByIndex = async <T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const clearStore = async (storeName: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Specific helpers for sync queue
export const getPendingSyncItems = async (): Promise<SyncQueueItem[]> => {
  const items = await getByIndex<SyncQueueItem>('sync_queue', 'by_status', 'pending');
  return items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
};

export const getFailedSyncItems = async (): Promise<SyncQueueItem[]> => {
  return getByIndex<SyncQueueItem>('sync_queue', 'by_status', 'failed');
};

export const updateSyncItemStatus = async (
  id: string,
  status: SyncQueueItem['status'],
  errorMessage?: string
): Promise<void> => {
  const item = await getFromStore<SyncQueueItem>('sync_queue', id);
  if (item) {
    item.status = status;
    item.error_message = errorMessage || null;
    await putToStore('sync_queue', item);
  }
};

// Temp ID mapping helpers
export const addTempIdMapping = async (mapping: TempIdMapping): Promise<void> => {
  await putToStore('temp_id_mappings', mapping);
};

export const getRealIdFromTemp = async (tempId: string): Promise<string | null> => {
  const mapping = await getFromStore<TempIdMapping>('temp_id_mappings', tempId);
  return mapping?.real_id || null;
};

export const updateReferencesWithRealId = async (
  tempId: string,
  realId: string,
  entityType: LocalEntity['entity_type']
): Promise<void> => {
  // Update local entities that reference this temp ID
  const allEntities = await getAllFromStore<LocalEntity>('local_entities');
  
  for (const entity of allEntities) {
    let updated = false;
    const data = { ...entity.data };
    
    // Check common reference fields
    if (data.task_id === tempId) {
      data.task_id = realId;
      updated = true;
    }
    if (data.area_id === tempId) {
      data.area_id = realId;
      updated = true;
    }
    if (data.parent_milestone_id === tempId) {
      data.parent_milestone_id = realId;
      updated = true;
    }
    
    if (updated) {
      entity.data = data;
      await putToStore('local_entities', entity);
    }
  }
  
  // Update sync queue items that reference this temp ID
  const queueItems = await getAllFromStore<SyncQueueItem>('sync_queue');
  
  for (const item of queueItems) {
    let updated = false;
    const payload = { ...item.payload };
    
    if (payload.task_id === tempId) {
      payload.task_id = realId;
      updated = true;
    }
    if (payload.area_id === tempId) {
      payload.area_id = realId;
      updated = true;
    }
    if (payload.parent_milestone_id === tempId) {
      payload.parent_milestone_id = realId;
      updated = true;
    }
    
    if (updated) {
      item.payload = payload;
      await putToStore('sync_queue', item);
    }
  }
};

// Generate temporary ID
export const generateTempId = (): string => {
  return `temp_${crypto.randomUUID()}`;
};

export const isTempId = (id: string): boolean => {
  return id.startsWith('temp_');
};
