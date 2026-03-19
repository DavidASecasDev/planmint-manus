/**
 * Movement draft persistence using IndexedDB for images and localStorage for metadata.
 * Survives WebView recreation on mobile (camera open/close cycle).
 */

import { createLogger } from '@/lib/logger';

const log = createLogger({ context: 'DraftStorage' });

const DB_NAME = 'movement_drafts';
const DB_VERSION = 1;
const STORE_NAME = 'images';
const META_KEY_PREFIX = 'mvmt_draft_';
const DRAFT_TTL_MS = 60 * 60 * 1000; // 60 min

export interface DraftMeta {
  step: 'type' | 'camera' | 'confirm' | 'saving';
  movementType: string | null;
  detectedPlate: string;
  ocrSuccess: boolean;
  notes: string;
  hasImage: boolean;
  savedAt: number;
}

// ── IndexedDB helpers ─────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function scopedKey(userId: string, orgId: string) {
  return `${META_KEY_PREFIX}${userId}_${orgId}`;
}

// ── Public API ────────────────────────────────────────────────────────

export async function saveDraftImage(userId: string, orgId: string, base64: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(base64, scopedKey(userId, orgId));
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    log.debug('Image saved to IndexedDB');
  } catch (err) {
    log.error('Failed to save image to IndexedDB', err);
  }
}

export async function loadDraftImage(userId: string, orgId: string): Promise<string | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(scopedKey(userId, orgId));
    return new Promise((res) => {
      req.onsuccess = () => res((req.result as string) ?? null);
      req.onerror = () => res(null);
    });
  } catch {
    return null;
  }
}

export async function clearDraftImage(userId: string, orgId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(scopedKey(userId, orgId));
  } catch { /* ignore */ }
}

export function saveDraftMeta(userId: string, orgId: string, meta: Partial<DraftMeta>, current?: DraftMeta): DraftMeta {
  const base: DraftMeta = current ?? {
    step: 'type', movementType: null, detectedPlate: '', ocrSuccess: false,
    notes: '', hasImage: false, savedAt: Date.now(),
  };
  const updated: DraftMeta = { ...base, ...meta, savedAt: Date.now() };
  try {
    localStorage.setItem(scopedKey(userId, orgId), JSON.stringify(updated));
  } catch (err) {
    log.error('localStorage save failed', err);
  }
  return updated;
}

export function loadDraftMeta(userId: string, orgId: string): DraftMeta | null {
  try {
    const raw = localStorage.getItem(scopedKey(userId, orgId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftMeta;
    if (Date.now() - (parsed.savedAt ?? 0) > DRAFT_TTL_MS) {
      localStorage.removeItem(scopedKey(userId, orgId));
      return null;
    }
    if (!parsed.step || !['type', 'camera', 'confirm', 'saving'].includes(parsed.step)) {
      localStorage.removeItem(scopedKey(userId, orgId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraftMeta(userId: string, orgId: string): void {
  try { localStorage.removeItem(scopedKey(userId, orgId)); } catch { /* ignore */ }
}

export async function clearAllDraft(userId: string, orgId: string): Promise<void> {
  clearDraftMeta(userId, orgId);
  await clearDraftImage(userId, orgId);
  // Also clean old format
  try { localStorage.removeItem('movement_draft_v2'); } catch { /* ignore */ }
}
