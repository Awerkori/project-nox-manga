/**
 * Project Nox — Offline Reading & Storage Engine
 * Utilizes IndexedDB to cache chapters, pages, and queue offline reading events for idempotent sync.
 */

const DB_NAME = 'nox_offline_v1';
const DB_VERSION = 1;

export type OfflineChapter = {
  chapterId: string;
  workId: string;
  workTitle: string;
  workSlug: string;
  coverId?: string | null;
  // Old IndexedDB records can contain numbers; new records preserve display
  // text so 12.10 is not normalised to 12.1 offline.
  number: number | string;
  title: string | null;
  pages: Array<{
    position: number;
    mediaId: string;
    blobUrl?: string;
  }>;
  downloadedAt: string;
  totalPages: number;
};

export type OfflineEvent = {
  id?: number;
  type: 'READ_PAGE' | 'CLAIM_XP';
  chapterId: string;
  workId: string;
  page?: number;
  timestamp: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB indisponível'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('chapters')) {
        db.createObjectStore('chapters', { keyPath: 'chapterId' });
      }
      if (!db.objectStoreNames.contains('events')) {
        db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function isOfflineSupported(): boolean {
  return typeof window !== 'undefined' && !!window.indexedDB;
}

// In-memory registry of active download controllers to support real-time cancellation
const activeDownloadControllers = new Map<string, AbortController>();

export function registerDownloadController(chapterId: string, controller: AbortController): void {
  activeDownloadControllers.set(chapterId, controller);
}

export function cancelChapterDownload(chapterId: string): boolean {
  const controller = activeDownloadControllers.get(chapterId);
  if (controller) {
    controller.abort();
    activeDownloadControllers.delete(chapterId);
    return true;
  }
  return false;
}

export function unregisterDownloadController(chapterId: string): void {
  activeDownloadControllers.delete(chapterId);
}

export function isDownloadActive(chapterId: string): boolean {
  return activeDownloadControllers.has(chapterId);
}

export async function saveChapterOffline(
  chapter: { id: string; work_id: string; number: number | string; title: string | null },
  work: { title: string; slug: string; cover_id?: string | null },
  pages: Array<{ position: number; media_id: string }>,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<void> {
  if (signal?.aborted) {
    throw new DOMException('Download cancelado pelo usuário', 'AbortError');
  }

  const db = await openDb();

  // Fetch all media blobs with abort support
  const fetchedPages: OfflineChapter['pages'] = [];
  let completed = 0;

  for (const page of pages) {
    if (signal?.aborted) {
      await removeOfflineChapter(chapter.id).catch(() => {});
      throw new DOMException('Download cancelado pelo usuário', 'AbortError');
    }

    try {
      const res = await fetch(`/media/${page.media_id}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();

      if (signal?.aborted) {
        await removeOfflineChapter(chapter.id).catch(() => {});
        throw new DOMException('Download cancelado pelo usuário', 'AbortError');
      }

      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        const onAbort = () => {
          try {
            reader.abort();
          } catch (_e) {
            void _e;
          }
          reject(new DOMException('Download cancelado pelo usuário', 'AbortError'));
        };

        if (signal?.aborted) return onAbort();
        signal?.addEventListener('abort', onAbort, { once: true });

        reader.onloadend = () => {
          signal?.removeEventListener('abort', onAbort);
          if (reader.result) resolve(reader.result as string);
          else reject(new Error('Falha ao ler blob da imagem'));
        };
        reader.onerror = () => {
          signal?.removeEventListener('abort', onAbort);
          reject(reader.error);
        };
        reader.readAsDataURL(blob);
      });

      fetchedPages.push({
        position: page.position,
        mediaId: page.media_id,
        blobUrl: base64Data
      });
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) {
        await removeOfflineChapter(chapter.id).catch(() => {});
        throw new DOMException('Download cancelado pelo usuário', 'AbortError');
      }
      // Strict rule: Any page failure aborts the download and prevents saving incomplete chapters
      throw new Error(`Falha ao baixar a página ${page.position}. Download incompleto não foi salvo.`, { cause: err });
    }

    completed++;
    onProgress?.(completed, pages.length);
  }

  if (signal?.aborted) {
    await removeOfflineChapter(chapter.id).catch(() => {});
    throw new DOMException('Download cancelado pelo usuário', 'AbortError');
  }

  const record: OfflineChapter = {
    chapterId: chapter.id,
    workId: chapter.work_id,
    workTitle: work.title,
    workSlug: work.slug,
    coverId: work.cover_id,
    number: chapter.number,
    title: chapter.title,
    pages: fetchedPages,
    downloadedAt: new Date().toISOString(),
    totalPages: fetchedPages.length
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('chapters', 'readwrite');
    const store = tx.objectStore('chapters');
    const req = store.put(record);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getOfflineChapters(): Promise<OfflineChapter[]> {
  if (!isOfflineSupported()) return [];
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('chapters', 'readonly');
    const store = tx.objectStore('chapters');
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getOfflineChapter(chapterId: string): Promise<OfflineChapter | null> {
  if (!isOfflineSupported()) return null;
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('chapters', 'readonly');
    const store = tx.objectStore('chapters');
    const req = store.get(chapterId);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function isChapterDownloaded(chapterId: string): Promise<boolean> {
  const chapter = await getOfflineChapter(chapterId);
  return chapter !== null && (chapter.pages?.length || 0) > 0;
}

export async function removeOfflineChapter(chapterId: string): Promise<void> {
  if (!isOfflineSupported()) return;
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('chapters', 'readwrite');
    const store = tx.objectStore('chapters');
    const req = store.delete(chapterId);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function queueOfflineEvent(event: Omit<OfflineEvent, 'id' | 'timestamp'>): Promise<void> {
  if (!isOfflineSupported()) return;
  const db = await openDb();

  const record: OfflineEvent = {
    ...event,
    timestamp: Date.now()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('events', 'readwrite');
    const store = tx.objectStore('events');
    const req = store.add(record);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function syncOfflineEvents(): Promise<number> {
  if (!isOfflineSupported() || typeof navigator !== 'undefined' && !navigator.onLine) return 0;
  const db = await openDb();

  const events: OfflineEvent[] = await new Promise((resolve, reject) => {
    const tx = db.transaction('events', 'readonly');
    const store = tx.objectStore('events');
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  if (!events.length) return 0;

  let syncedCount = 0;
  for (const ev of events) {
    try {
      const res = await fetch('/api/v1/events/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workId: ev.workId,
          chapterId: ev.chapterId,
          page: ev.page,
          completed: ev.type === 'CLAIM_XP'
        })
      });

      if (res.ok && ev.id) {
        // Delete synced event
        await new Promise<void>((resolve) => {
          const tx = db.transaction('events', 'readwrite');
          tx.objectStore('events').delete(ev.id!);
          tx.oncomplete = () => resolve();
        });
        syncedCount++;
      }
    } catch {
      // Retain in queue for next sync opportunity
      break;
    }
  }

  return syncedCount;
}
