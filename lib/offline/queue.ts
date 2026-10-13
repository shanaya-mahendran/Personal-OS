/**
 * Offline capture queue (spec §17).
 *
 * While offline, captures are queued in IndexedDB; when the browser fires
 * `online` (or the service worker's sync event) the queue is flushed and
 * /process-capture runs afterwards via the normal server action path.
 *
 * Provenance rule: nothing is dropped — a failed flush stays queued.
 */

export interface QueuedCapture {
  id: string;
  raw_text: string;
  input_type: 'text' | 'paste';
  created_at: string;
}

const DB_NAME = 'shanaya-os';
const STORE = 'capture-queue';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open queue'));
  });
}

export async function enqueueCapture(rawText: string): Promise<QueuedCapture> {
  const db = await openDb();
  const entry: QueuedCapture = {
    id: crypto.randomUUID(),
    raw_text: rawText,
    input_type: 'text',
    created_at: new Date().toISOString(),
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Queue write failed'));
  });
  db.close();
  return entry;
}

export async function listQueuedCaptures(): Promise<QueuedCapture[]> {
  try {
    const db = await openDb();
    const entries = await new Promise<QueuedCapture[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result ?? []) as QueuedCapture[]);
      req.onerror = () => reject(req.error ?? new Error('Queue read failed'));
    });
    db.close();
    return entries.sort((a, b) => a.created_at.localeCompare(b.created_at));
  } catch {
    return [];
  }
}

export async function removeQueuedCapture(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Queue delete failed'));
  });
  db.close();
}

/**
 * Flush the queue: each entry is submitted; successful ones are removed,
 * failures stay for the next attempt.
 */
export async function flushQueue(
  submit: (rawText: string) => Promise<{ ok: boolean }>,
): Promise<{ flushed: number; remaining: number }> {
  const queued = await listQueuedCaptures();
  let flushed = 0;
  for (const entry of queued) {
    try {
      const res = await submit(entry.raw_text);
      if (res.ok) {
        await removeQueuedCapture(entry.id);
        flushed += 1;
      }
    } catch {
      // keep the entry queued; try again later
    }
  }
  const remaining = (await listQueuedCaptures()).length;
  return { flushed, remaining };
}

/** True when the browser reports offline. */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
