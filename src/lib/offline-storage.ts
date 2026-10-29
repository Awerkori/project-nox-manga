/**
 * Project Nox — Offline Reading & Storage Engine
 * Utilizes IndexedDB to cache chapters, pages, and queue offline reading events for idempotent sync.
 */

import { chapterOrderKey } from '$lib/chapter-identity';

const DB_NAME = 'nox_offline_v1';
const DB_VERSION = 1;
const SYNC_CHANNEL_NAME = 'nox_offline_sync';

export function broadcastOfflineChange(
  action: 'save' | 'delete' | 'delete_all',
  chapterId?: string,
  workId?: string
): void {
  if (typeof window === 'undefined') return;
  const payload = { action, chapterId, workId, timestamp: Date.now() };
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
      bc.postMessage(payload);
      bc.close();
    }
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent('nox-offline-change', { detail: payload }));
  } catch {}
}

export function subscribeOfflineChanges(
  callback: (event: { action: 'save' | 'delete' | 'delete_all'; chapterId?: string; workId?: string }) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  let bc: BroadcastChannel | null = null;
  const onCustomEvent = (e: any) => {
    if (e?.detail) callback(e.detail);
  };
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
      bc.onmessage = (e) => {
        if (e?.data) callback(e.data);
      };
    }
  } catch {}
  window.addEventListener('nox-offline-change', onCustomEvent);

  return () => {
    if (bc) {
      try {
        bc.close();
      } catch {}
      bc = null;
    }
    window.removeEventListener('nox-offline-change', onCustomEvent);
  };
}

export type OfflineChapter = {
  chapterId: string;
  workId: string;
  workTitle: string;
  workSlug: string;
  coverId?: string | null;
  coverBlobUrl?: string | null;
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

export type DownloadedWorkGroup = {
  workId: string;
  workTitle: string;
  workSlug: string;
  coverId?: string | null;
  coverBlobUrl?: string | null;
  chaptersCount: number;
  totalStorageBytes: number;
  latestDownloadedAt: string;
  isFullyDownloaded: boolean;
  hasIncomplete: boolean;
  chapters: OfflineChapter[];
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

  // Attempt to cache cover image offline as base64 (best effort, non-blocking)
  let coverBlobUrl: string | null = null;
  if (work.cover_id) {
    try {
      const coverRes = await fetch(`/media/${work.cover_id}?size=thumb&v=3`, { signal });
      if (coverRes.ok) {
        const coverBlob = await coverRes.blob();
        coverBlobUrl = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onloadend = () => resolve((r.result as string) || '');
          r.onerror = () => resolve('');
          r.readAsDataURL(coverBlob);
        });
      }
    } catch {
      // Cover download is optional; chapter reading is unaffected
    }
  }

  const record: OfflineChapter = {
    chapterId: chapter.id,
    workId: chapter.work_id,
    workTitle: work.title,
    workSlug: work.slug,
    coverId: work.cover_id,
    coverBlobUrl: coverBlobUrl || null,
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

    req.onsuccess = () => {
      broadcastOfflineChange('save', chapter.id, chapter.work_id);
      resolve();
    };
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

    req.onsuccess = () => {
      broadcastOfflineChange('delete', chapterId);
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Removes all downloaded chapters belonging to a specific work.
 * Returns the count of deleted chapters.
 */
export async function removeOfflineWork(workIdOrSlug: string): Promise<number> {
  if (!isOfflineSupported()) return 0;
  const allChapters = await getOfflineChapters();
  const toDelete = allChapters.filter(
    (c) => c.workId === workIdOrSlug || c.workSlug === workIdOrSlug
  );
  if (!toDelete.length) return 0;

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chapters', 'readwrite');
    const store = tx.objectStore('chapters');
    for (const ch of toDelete) {
      store.delete(ch.chapterId);
    }
    tx.oncomplete = () => {
      broadcastOfflineChange('delete_all', undefined, workIdOrSlug);
      resolve(toDelete.length);
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Clears all downloaded offline chapters from storage.
 */
export async function clearAllOfflineDownloads(): Promise<void> {
  if (!isOfflineSupported()) return;
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('chapters', 'readwrite');
    const store = tx.objectStore('chapters');
    const req = store.clear();
    req.onsuccess = () => {
      broadcastOfflineChange('delete_all');
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Estimates storage size of a chapter in bytes based on base64 content.
 */
export function estimateChapterStorageBytes(chapter: OfflineChapter): number {
  let bytes = 0;
  if (chapter.coverBlobUrl) {
    bytes += Math.round(chapter.coverBlobUrl.length * 0.75);
  }
  if (chapter.pages && Array.isArray(chapter.pages)) {
    for (const p of chapter.pages) {
      if (p.blobUrl) {
        bytes += Math.round(p.blobUrl.length * 0.75);
      }
    }
  }
  return bytes;
}

/**
 * Human-readable format for byte sizes (B, KB, MB, GB).
 */
export function formatStorageBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Groups a flat list of OfflineChapters by work, sorting chapters numerically
 * and calculating aggregated storage metrics.
 */
export function groupOfflineChaptersByWork(chapters: OfflineChapter[]): DownloadedWorkGroup[] {
  const map = new Map<string, DownloadedWorkGroup>();

  for (const ch of chapters) {
    const workKey = ch.workId || ch.workSlug || 'unknown';
    let group = map.get(workKey);
    if (!group) {
      group = {
        workId: ch.workId,
        workTitle: ch.workTitle || 'Obra Desconhecida',
        workSlug: ch.workSlug || '',
        coverId: ch.coverId || null,
        coverBlobUrl: ch.coverBlobUrl || null,
        chaptersCount: 0,
        totalStorageBytes: 0,
        latestDownloadedAt: ch.downloadedAt,
        isFullyDownloaded: true,
        hasIncomplete: false,
        chapters: []
      };
      map.set(workKey, group);
    }

    if (ch.coverBlobUrl && !group.coverBlobUrl) {
      group.coverBlobUrl = ch.coverBlobUrl;
    }

    group.chapters.push(ch);
    group.chaptersCount++;

    const chBytes = estimateChapterStorageBytes(ch);
    group.totalStorageBytes += chBytes;

    if (new Date(ch.downloadedAt).getTime() > new Date(group.latestDownloadedAt).getTime()) {
      group.latestDownloadedAt = ch.downloadedAt;
    }

    const isIncomplete =
      !ch.pages || ch.pages.length === 0 || ch.pages.some((p) => !p.blobUrl);
    if (isIncomplete) {
      group.hasIncomplete = true;
      group.isFullyDownloaded = false;
    }
  }

  const groups = Array.from(map.values());

  // Sort chapters inside each group in correct numerical order (ascending)
  for (const g of groups) {
    g.chapters.sort((a, b) => {
      const orderA = chapterOrderKey({ displayNumber: a.number, title: a.title });
      const orderB = chapterOrderKey({ displayNumber: b.number, title: b.title });
      return orderA.localeCompare(orderB);
    });
  }

  // Sort groups by latestDownloadedAt descending (most recent first)
  groups.sort(
    (a, b) =>
      new Date(b.latestDownloadedAt).getTime() - new Date(a.latestDownloadedAt).getTime()
  );

  return groups;
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

    req.onsuccess = () => {
      broadcastOfflineChange('save', chapter.id, chapter.work_id);
      resolve();
    };
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
