/**
 * Inspection draft persistence using IndexedDB for photos and localStorage for metadata.
 * Mirrors the pattern from movementDraftStorage.ts — survives WebView/process kills on mobile.
 */

const DB_NAME = 'fleet_inspection_drafts';
const DB_VERSION = 1;
const STORE_NAME = 'photos';
const META_KEY_PREFIX = 'fleet_insp_draft_';
const DRAFT_TTL_MS = 60 * 60 * 1000; // 60 min

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

function metaKey(vehicleId: string) {
  return `${META_KEY_PREFIX}${vehicleId}`;
}

function photosKey(vehicleId: string) {
  return `photos_${vehicleId}`;
}

// ── File ↔ base64 helpers ─────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
  });
}

function base64ToFile(base64: string, name: string): File {
  const [header, data] = base64.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

// ── Metadata (localStorage — synchronous) ─────────────────────────────

export interface InspectionDraftMeta {
  step: number;
  form: Record<string, any>;
  damages: Array<{
    zona: string;
    pieza: string;
    descripcion: string;
    severidad: string;
    photoCount: number; // track how many photos each damage had
  }>;
  generalPhotoCount: number;
  savedAt: number;
}

export function saveDraftMeta(vehicleId: string, meta: InspectionDraftMeta): void {
  try {
    localStorage.setItem(metaKey(vehicleId), JSON.stringify(meta));
  } catch { /* quota exceeded */ }
}

export function loadDraftMeta(vehicleId: string): InspectionDraftMeta | null {
  try {
    const raw = localStorage.getItem(metaKey(vehicleId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InspectionDraftMeta;
    if (Date.now() - (parsed.savedAt ?? 0) > DRAFT_TTL_MS) {
      localStorage.removeItem(metaKey(vehicleId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraftMeta(vehicleId: string): void {
  try { localStorage.removeItem(metaKey(vehicleId)); } catch { /* ignore */ }
}

// ── Photos (IndexedDB — async, survives process kill) ─────────────────

interface StoredPhotos {
  general: Array<{ base64: string; category: string; description: string }>;
  damages: Array<Array<{ base64: string }>>;
}

export async function saveDraftPhotos(
  vehicleId: string,
  generalPhotos: Array<{ file: File; category: string; description: string }>,
  damagePhotos: Array<Array<{ file: File }>>,
): Promise<void> {
  try {
    const general = await Promise.all(
      generalPhotos.map(async (p) => ({
        base64: await fileToBase64(p.file),
        category: p.category,
        description: p.description,
      })),
    );
    const damages = await Promise.all(
      damagePhotos.map(async (photos) =>
        Promise.all(photos.map(async (p) => ({ base64: await fileToBase64(p.file) }))),
      ),
    );
    const data: StoredPhotos = { general, damages };
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(data, photosKey(vehicleId));
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.error('[InspectionDraft] Failed to save photos to IndexedDB', err);
  }
}

export async function loadDraftPhotos(vehicleId: string): Promise<{
  general: Array<{ file: File; category: string; description: string; preview: string }>;
  damages: Array<Array<{ file: File; preview: string }>>;
} | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(photosKey(vehicleId));
    const data = await new Promise<StoredPhotos | undefined>((res) => {
      req.onsuccess = () => res(req.result as StoredPhotos | undefined);
      req.onerror = () => res(undefined);
    });
    if (!data) return null;

    const general = data.general.map((p, i) => {
      const file = base64ToFile(p.base64, `restored_${i}.jpg`);
      return { file, category: p.category, description: p.description, preview: URL.createObjectURL(file) };
    });

    const damages = data.damages.map((photos) =>
      photos.map((p, i) => {
        const file = base64ToFile(p.base64, `restored_dmg_${i}.jpg`);
        return { file, preview: URL.createObjectURL(file) };
      }),
    );

    return { general, damages };
  } catch {
    return null;
  }
}

export async function clearDraftPhotos(vehicleId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(photosKey(vehicleId));
  } catch { /* ignore */ }
}

export async function clearAllInspectionDraft(vehicleId: string): Promise<void> {
  clearDraftMeta(vehicleId);
  await clearDraftPhotos(vehicleId);
  // Clean old sessionStorage format
  try { sessionStorage.removeItem(`inspection-draft-${vehicleId}`); } catch { /* ignore */ }
}
