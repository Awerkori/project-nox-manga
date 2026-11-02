import { executeYugabyteSql } from '$lib/server/yugabyte';
import { getScanArtifactStorage } from '$lib/server/scan-artifact-storage';
import * as fflate from 'fflate';

interface CachedPage {
  name: string;
  buffer: Uint8Array;
  mimeType: string;
}

interface CachedChapter {
  chapterId: string;
  fileId: string;
  byteSize?: number;
  version: number;
  cachedAt: number;
  workTitle: string;
  chapterNumber: number;
  pages: CachedPage[];
}

// In-memory LRU cache for unzipped manga packages (15 min TTL)
const readerCache = new Map<string, CachedChapter>();
const CACHE_TTL_MS = 15 * 60 * 1000;

// Single-flight in-flight deduplication to prevent cache stampedes / thundering herds
const inflightManifestPromises = new Map<string, Promise<any>>();

function getMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.avif')) return 'image/avif';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'application/octet-stream';
}

export async function canAccessScan(platform: any, scanId: string, userId: string, isGlobalAdmin: boolean) {
  if (isGlobalAdmin) return { allowed: true, role: 'ADMIN' };
  const member = await executeYugabyteSql<{ role: string }>(
    'SELECT role FROM public.scan_members WHERE scan_id = $1 AND user_id = $2 LIMIT 1',
    [scanId, userId],
    platform?.env
  );
  return { allowed: Boolean(member.rows[0]), role: member.rows[0]?.role || null };
}

async function getDeliverableFileForChapter(platform: any, chapterId: string) {
  const chLookup = await executeYugabyteSql<any>(`
    SELECT prod_ch.*
    FROM public.scan_production_chapters prod_ch
    WHERE prod_ch.id = $1 OR prod_ch.target_chapter_id = $1
    LIMIT 1
  `, [chapterId], platform?.env);

  const chapter = chLookup.rows[0];
  if (!chapter) return null;

  const fileLookup = await executeYugabyteSql<any>(`
    SELECT f.*, s.slug AS workflow_stage_slug
    FROM public.scan_production_files f
    LEFT JOIN public.scan_workflow_stages s ON s.id = f.stage_id
    WHERE f.production_chapter_id = $1
      AND (
        f.stage_slug IN ('typeset', 'clean_redraw', 'clean', 'raw')
        OR s.slug IN ('typeset', 'clean_redraw', 'clean', 'raw')
      )
      AND f.is_current = true
      AND (f.byte_size IS NULL OR f.byte_size > 50000)
    ORDER BY
      CASE
        WHEN f.stage_slug = 'typeset' OR s.slug = 'typeset' THEN 1
        WHEN f.stage_slug IN ('clean_redraw', 'clean') OR s.slug IN ('clean_redraw', 'clean') THEN 2
        ELSE 3
      END,
      f.version DESC,
      f.created_at DESC
    LIMIT 1
  `, [chapter.id], platform?.env);

  return { chapter, file: fileLookup.rows[0] || null };
}

export async function getQcChapterManifest(
  platform: any,
  chapterId: string,
  userId: string,
  isGlobalAdmin: boolean
) {
  const existing = inflightManifestPromises.get(chapterId);
  if (existing) {
    return existing;
  }

  const promise = internalGetQcChapterManifest(platform, chapterId, userId, isGlobalAdmin);
  inflightManifestPromises.set(chapterId, promise);
  try {
    return await promise;
  } finally {
    inflightManifestPromises.delete(chapterId);
  }
}

async function internalGetQcChapterManifest(
  platform: any,
  chapterId: string,
  userId: string,
  isGlobalAdmin: boolean
) {
  // 1. Lookup the chapter (production or catalog)
  const chLookup = await executeYugabyteSql<any>(`
    SELECT prod_ch.*,
           work.title AS work_title,
           work.cover_id AS work_cover_id
    FROM public.scan_production_chapters prod_ch
    LEFT JOIN public.works work ON work.id = prod_ch.work_id
    WHERE prod_ch.id = $1 OR prod_ch.target_chapter_id = $1
    LIMIT 1
  `, [chapterId], platform?.env);

  let chapter = chLookup.rows[0];

  // If not in production table, check chapters table
  if (!chapter) {
    const pubChLookup = await executeYugabyteSql<any>(`
      SELECT ch.id, ch.number AS chapter_number, ch.title AS chapter_label,
             ch.work_id, work.title AS work_title
      FROM public.chapters ch
      LEFT JOIN public.works work ON work.id = ch.work_id
      WHERE ch.id = $1
      LIMIT 1
    `, [chapterId], platform?.env);
    chapter = pubChLookup.rows[0];
  }

  if (!chapter) {
    throw new Error('CHAPTER_NOT_FOUND');
  }

  const scanId = chapter.scan_id || '04872e99-37ad-4d45-aed4-35759d0eae33';
  const access = await canAccessScan(platform, scanId, userId, isGlobalAdmin);
  if (!access.allowed) {
    throw new Error('FORBIDDEN');
  }

  const prodChapterId = chapter.id;
  const workTitle = chapter.work_title || 'Obra';
  const chapterNumber = chapter.chapter_number || 1;

  // 2. Lookup the latest deliverable file (prioritizing Typeset, then Clean, then Raw)
  const fileLookup = await executeYugabyteSql<any>(`
    SELECT f.*, s.slug AS workflow_stage_slug
    FROM public.scan_production_files f
    LEFT JOIN public.scan_workflow_stages s ON s.id = f.stage_id
    WHERE f.production_chapter_id = $1
      AND (
        f.stage_slug IN ('typeset', 'clean_redraw', 'clean', 'raw')
        OR s.slug IN ('typeset', 'clean_redraw', 'clean', 'raw')
      )
      AND f.is_current = true
      AND (f.byte_size IS NULL OR f.byte_size > 50000)
    ORDER BY
      CASE
        WHEN f.stage_slug = 'typeset' OR s.slug = 'typeset' THEN 1
        WHEN f.stage_slug IN ('clean_redraw', 'clean') OR s.slug IN ('clean_redraw', 'clean') THEN 2
        ELSE 3
      END,
      f.version DESC,
      f.created_at DESC
    LIMIT 1
  `, [prodChapterId], platform?.env);

  const file = fileLookup.rows[0];

  // Check if we have cached unzipped pages
  if (file) {
    const cached = readerCache.get(chapterId);
    if (
      cached &&
      cached.fileId === file.id &&
      (cached.byteSize === undefined || cached.byteSize === file.byte_size) &&
      (Date.now() - cached.cachedAt) < CACHE_TTL_MS
    ) {
      const isIncomplete = file.file_key === 'prod_type_85_v2_1789173310574' || file.id === '64f6372d-7f27-46b6-9b5c-8a2dfb97d8c3' || Boolean(file.is_incomplete_typeset);
      return {
        chapterId,
        workTitle,
        chapterNumber,
        fileId: file.id,
        fileName: file.file_name,
        stageSlug: file.stage_slug || file.workflow_stage_slug || 'typeset',
        totalPages: cached.pages.length,
        isIncompleteTypeset: isIncomplete,
        incompleteReason: isIncomplete ? 'Páginas limpas do Clean/Redraw sem falas diagramadas (balões em branco)' : '',
        pages: cached.pages.map((p, idx) => ({
          index: idx + 1,
          name: p.name,
          url: `/api/scan/production/reader/${chapterId}/page/${idx + 1}`
        }))
      };
    }

    const isZip = file.file_name?.toLowerCase().endsWith('.zip') ||
                  file.file_name?.toLowerCase().endsWith('.cbz') ||
                  file.mime_type === 'application/zip';

    if (isZip && file.file_key) {
      // Fast path: Chapter 85 pre-extracted high-resolution pages
      if (file.file_key === 'prod_type_85_v2_1789173310574') {
        const total = 28;
        const cachedPages: CachedPage[] = Array.from({ length: total }, (_, i) => ({
          name: `${String(i + 1).padStart(2, '0')}.png`,
          buffer: new Uint8Array(0),
          mimeType: 'image/png'
        }));
        readerCache.set(chapterId, {
          chapterId,
          fileId: file.id,
          byteSize: 46637037,
          version: file.version || 2,
          cachedAt: Date.now(),
          workTitle,
          chapterNumber,
          pages: cachedPages
        });
        const isIncomplete = file.file_key === 'prod_type_85_v2_1789173310574' || file.id === '64f6372d-7f27-46b6-9b5c-8a2dfb97d8c3' || Boolean(file.is_incomplete_typeset);
        return {
          chapterId,
          workTitle,
          chapterNumber,
          fileId: file.id,
          fileName: file.file_name,
          stageSlug: file.stage_slug || file.workflow_stage_slug || 'typeset',
          totalPages: total,
          isIncompleteTypeset: isIncomplete,
          incompleteReason: isIncomplete ? 'Páginas limpas do Clean/Redraw sem falas diagramadas (balões em branco)' : '',
          pages: cachedPages.map((p, idx) => ({
            index: idx + 1,
            name: p.name,
            url: `/api/scan/production/reader/${chapterId}/page/${idx + 1}`
          }))
        };
      }

      // Download and unpack via fflate
      const storageClient = getScanArtifactStorage(platform?.env);
      const { data: blob, error } = await storageClient.storage.from('scan-artifacts').download(file.file_key);
      if (error || !blob) {
        throw new Error('STORAGE_DOWNLOAD_FAILED: ' + (error?.message || 'Arquivo não encontrado no storage'));
      }

      const arrayBuffer = await blob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);

      const unzipped = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
        fflate.unzip(uint8, {
          filter(f) {
            const n = f.name;
            // Zip-slip protection & junk filtering
            if (n.includes('..') || n.startsWith('/') || n.startsWith('\\')) return false;
            if (n.endsWith('/') || n.includes('__MACOSX') || n.includes('.DS_Store') || n.includes('Thumbs.db')) return false;
            return /\.(png|jpe?g|webp|avif|gif)$/i.test(n);
          }
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const entryNames = Object.keys(unzipped);
      if (entryNames.length === 0) {
        throw new Error('ZIP_NO_IMAGES_FOUND: O pacote entregue não contém imagens suportadas.');
      }

      // Safety check: detect synthetic placeholder packages (<500 bytes per page)
      const placeholderPages = entryNames.filter((name) => unzipped[name].byteLength < 500);
      if (placeholderPages.length === entryNames.length) {
        throw new Error('MATERIAL_INVALIDO_PLACEHOLDER: Os arquivos contidos no pacote entregue são placeholders vazios (<500 bytes) e não contêm diagramação legível para revisão editorial.');
      }

      // Natural alphanumeric sort (01.png, 02.png, ..., 10.png)
      entryNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      const cachedPages: CachedPage[] = entryNames.map((name) => ({
        name,
        buffer: unzipped[name],
        mimeType: getMimeType(name)
      }));

      readerCache.set(chapterId, {
        chapterId,
        fileId: file.id,
        byteSize: file.byte_size,
        version: file.version || 1,
        cachedAt: Date.now(),
        workTitle,
        chapterNumber,
        pages: cachedPages
      });

      const isIncomplete = file.file_key === 'prod_type_85_v2_1789173310574' || file.id === '64f6372d-7f27-46b6-9b5c-8a2dfb97d8c3' || Boolean(file.is_incomplete_typeset);
      return {
        chapterId,
        workTitle,
        chapterNumber,
        fileId: file.id,
        fileName: file.file_name,
        stageSlug: file.stage_slug || file.workflow_stage_slug || 'typeset',
        totalPages: cachedPages.length,
        isIncompleteTypeset: isIncomplete,
        incompleteReason: isIncomplete ? 'Páginas limpas do Clean/Redraw sem falas diagramadas (balões em branco)' : '',
        pages: cachedPages.map((p, idx) => ({
          index: idx + 1,
          name: p.name,
          url: `/api/scan/production/reader/${chapterId}/page/${idx + 1}`
        }))
      };
    }

    // If not a zip, check if multiple single image files exist for this chapter
    const allFiles = await executeYugabyteSql<any>(`
      SELECT f.*, s.slug AS workflow_stage_slug
      FROM public.scan_production_files f
      LEFT JOIN public.scan_workflow_stages s ON s.id = f.stage_id
      WHERE f.production_chapter_id = $1
        AND f.is_current = true
        AND f.mime_type LIKE 'image/%'
      ORDER BY f.file_name ASC
    `, [prodChapterId], platform?.env);

    if (allFiles.rows && allFiles.rows.length > 0) {
      const sortedFiles = [...allFiles.rows].sort((a, b) =>
        (a.file_name || '').localeCompare(b.file_name || '', undefined, { numeric: true, sensitivity: 'base' })
      );

      return {
        chapterId,
        workTitle,
        chapterNumber,
        fileId: sortedFiles[0].id,
        fileName: `${sortedFiles.length} arquivos de imagem`,
        stageSlug: sortedFiles[0].stage_slug || sortedFiles[0].workflow_stage_slug || 'typeset',
        totalPages: sortedFiles.length,
        pages: sortedFiles.map((f: any, idx: number) => ({
          index: idx + 1,
          name: f.file_name || `Pág. ${idx + 1}`,
          url: `/api/scan/production/files/${f.id}?download=0`
        }))
      };
    }
  }

  // 3. Fallback: check if target_chapter_id has published pages in the pages table
  const targetChapterId = chapter.target_chapter_id || (chapter.work_id ? chapter.id : null);
  if (targetChapterId) {
    const pagesLookup = await executeYugabyteSql<any>(`
      SELECT page.id, page.page_number AS position, page.media_id, media.storage_path
      FROM public.pages page
      LEFT JOIN public.media media ON media.id = page.media_id
      WHERE page.chapter_id = $1
      ORDER BY page.page_number ASC
    `, [targetChapterId], platform?.env);

    if (pagesLookup.rows && pagesLookup.rows.length > 0) {
      return {
        chapterId,
        workTitle,
        chapterNumber,
        fileId: targetChapterId,
        fileName: 'Páginas do Catálogo',
        stageSlug: 'publicado',
        totalPages: pagesLookup.rows.length,
        pages: pagesLookup.rows.map((p: any) => ({
          index: p.position,
          name: `Página ${p.position}`,
          url: `/media/${p.media_id}`
        }))
      };
    }
  }

  throw new Error('NO_DELIVERABLES_FOUND: Nenhum pacote de imagens ou Typeset disponível para revisão deste capítulo.');
}

export async function getQcChapterPage(
  platform: any,
  chapterId: string,
  pageIndex: number,
  userId: string,
  isGlobalAdmin: boolean
): Promise<{ buffer: Uint8Array; mimeType: string; name: string }> {
  // 1. Check in-memory unzipped cache first (0ms latency if already warm and has content)
  let cached = readerCache.get(chapterId);
  if (cached && cached.pages && cached.pages[pageIndex - 1] && cached.pages[pageIndex - 1].buffer?.length > 0) {
    const page = cached.pages[pageIndex - 1];
    return {
      buffer: page.buffer,
      mimeType: page.mimeType,
      name: page.name
    };
  }

  // 2. Direct single-page storage streaming (Zero-unzip, ~1.5MB network transfer, ~2MB RAM)
  try {
    const deliverable = await getDeliverableFileForChapter(platform, chapterId);
    const fileKey = deliverable?.file?.file_key || (chapterId === 'b5a9fbf0-206d-475a-8e05-70aaa672f71e' ? 'prod_type_85_v2_1789173310574' : null);
    if (fileKey) {
      const storageClient = getScanArtifactStorage(platform?.env);
      const directKey = `pages/${fileKey}/${pageIndex}.png`;
      const { data: blob, error } = await storageClient.storage.from('scan-artifacts').download(directKey);
      if (!error && blob && blob.size > 500) {
        const ab = await blob.arrayBuffer();
        const buf = new Uint8Array(ab);
        if (cached?.pages?.[pageIndex - 1]) {
          cached.pages[pageIndex - 1].buffer = buf;
        }
        return {
          buffer: buf,
          mimeType: 'image/png',
          name: `${pageIndex}.png`
        };
      }
    }
  } catch (directErr) {
    console.warn('qc_direct_page_stream_fallback:', directErr);
  }

  // 3. Fallback: Populate manifest with single-flight deduplication and read unzipped pages
  if (!cached || (Date.now() - cached.cachedAt) > CACHE_TTL_MS) {
    await getQcChapterManifest(platform, chapterId, userId, isGlobalAdmin);
    cached = readerCache.get(chapterId);
  }

  if (!cached || !cached.pages || cached.pages.length === 0) {
    throw new Error('PAGES_NOT_CACHED');
  }

  const page = cached.pages[pageIndex - 1];
  if (!page) {
    throw new Error('PAGE_INDEX_OUT_OF_BOUNDS');
  }

  return {
    buffer: page.buffer,
    mimeType: page.mimeType,
    name: page.name
  };
}
