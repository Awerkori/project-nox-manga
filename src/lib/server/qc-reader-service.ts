import { executeYugabyteSql } from '$lib/server/yugabyte';
import { resolveBotDownloadClient } from '$lib/server/storage-router';
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

const CH85_PAGE_TELEGRAM_IDS: Record<number, string> = {
  1: 'BQACAgEAAyEGAAMBCKz_hgADjWrqGtWr9NcCsA3guH6bhVXzGXXvAALKDAAC4ZBQR7-uil_2TywSPQQ',
  2: 'BQACAgEAAyEGAAMBCKz_hgADjmrqGteER-h_5u5HmyQgPqlgY9nOAALLDAAC4ZBQR6WxOEprCp6OPQQ',
  3: 'BQACAgEAAyEGAAMBCKz_hgADj2rqGtjXVs_S5zUffeyFqteAxk6OAALMDAAC4ZBQR9lpnAYYwnukPQQ',
  4: 'BQACAgEAAyEGAAMBCKz_hgADkGrqGtrh_1RTwPHd_PqIbWiNGxZcAALNDAAC4ZBQR8feH_3hkEz7PQQ',
  5: 'BQACAgEAAyEGAAMBCKz_hgADkWrqGtte5n2fJa5G1N867uzs-9pcAALODAAC4ZBQR7BbkfsTncqdPQQ',
  6: 'BQACAgEAAyEGAAMBCKz_hgADkmrqGtzpgmH21HzJMyUMQwi0-wg-AALPDAAC4ZBQR0DV6Rr_fA-NPQQ',
  7: 'BQACAgEAAyEGAAMBCKz_hgADk2rqGt5vXJIFRMPTJ1zrNpcKPiN5AALQDAAC4ZBQR-tvCxQqBeLyPQQ',
  8: 'BQACAgEAAyEGAAMBCKz_hgADlGrqGuAQCfG3tDxNnlBBQK_zGWGrAALRDAAC4ZBQR1NU62Mlzb00PQQ',
  9: 'BQACAgEAAyEGAAMBCKz_hgADlWrqGuK5QMfB-ayyj9x9Mf9AUQvXAALSDAAC4ZBQR-H0FsItiHPQPQQ',
  10: 'BQACAgEAAyEGAAMBCKz_hgADlmrqGuPiAAFkG-N-K41BNHLvzhdLGQAC0wwAAuGQUEdIJL5CLFiW5D0E',
  11: 'BQACAgEAAyEGAAMBCKz_hgADl2rqGuWPmyMa-9WT-JNi5eQhNjiwAALUDAAC4ZBQR7aswguPJEckPQQ',
  12: 'BQACAgEAAyEGAAMBCKz_hgADmGrqGub_bx8BrqiWuUAsCvUjzbNSAALVDAAC4ZBQR7TTOzWPQtHSPQQ',
  13: 'BQACAgEAAyEGAAMBCKz_hgADmWrqGugtD1-n6fLqMPNaTYEsa9myAALWDAAC4ZBQR3yVKXd0Z-pGPQQ',
  14: 'BQACAgEAAyEGAAMBCKz_hgADmmrqGuoohKBlXQPfK_mu-EYAAQE51QAC1wwAAuGQUEfQymXVu9Myrz0E',
  15: 'BQACAgEAAyEGAAMBCKz_hgADm2rqGuvz9o8j9nVMmQJsk72f54OOAALYDAAC4ZBQR2019iisRtp4PQQ',
  16: 'BQACAgEAAyEGAAMBCKz_hgADnGrqGu26aVSfosoJfVeVn1R5wUpmAALZDAAC4ZBQR8_qN4QZGJH6PQQ',
  17: 'BQACAgEAAyEGAAMBCKz_hgADnWrqGu4cFwliswZFp7Njp6DmtrpAAALaDAAC4ZBQR_q8GsKPcHdTPQQ',
  18: 'BQACAgEAAyEGAAMBCKz_hgADnmrqGvD6c9krLjt6Ds_ZJiATgfzxAALbDAAC4ZBQR2PZa_K8fSacPQQ',
  19: 'BQACAgEAAyEGAAMBCKz_hgADn2rqGvFFnGBr5u96_DZX7BegYdcTAALcDAAC4ZBQR4enuh8m2oLtPQQ',
  20: 'BQACAgEAAyEGAAMBCKz_hgADoGrqGvP1s83fmvzQFPajPB1fE4eZAALdDAAC4ZBQR91-Q8LnkljUPQQ',
  21: 'BQACAgEAAyEGAAMBCKz_hgADoWrqGvRB_rK2PpkjTtA7Hqg6dV1_AALeDAAC4ZBQRwJRyaqsKqdKPQQ',
  22: 'BQACAgEAAyEGAAMBCKz_hgADomrqGvUSRob-8pAIgBJqPsSqDzUNAALfDAAC4ZBQR_zOoBh1SVXkPQQ',
  23: 'BQACAgEAAyEGAAMBCKz_hgADo2rqGxmfoRfaK_luXWmFp0Z6lPDPAALgDAAC4ZBQR0ExfBS9WeQVPQQ',
  24: 'BQACAgEAAyEGAAMBCKz_hgADpGrqGxqBMre7kpZR1dPclixTMamaAALhDAAC4ZBQRyBzXScpf80wPQQ',
  25: 'BQACAgEAAyEGAAMBCKz_hgADpWrqGxxn_pnjinuLFrgqA9l3jpsQAALiDAAC4ZBQR9aCP1BE92SEPQQ',
  26: 'BQACAgEAAyEGAAMBCKz_hgADpmrqGx6p9NrwkDC2E_YFnbaMnavYAALjDAAC4ZBQR72AyK8tn3CLPQQ',
  27: 'BQACAgEAAyEGAAMBCKz_hgADp2rqGx_iFIJ694L7yKpr9Jo5AAGx9QAC5AwAAuGQUEcZaCzU5DbuDj0E',
  28: 'BQACAgEAAyEGAAMBCKz_hgADqGrqGyCU5XX-EkRhxnW1z9W6WT2rAALlDAAC4ZBQR_5epwKmRbK4PQQ'
};

async function downloadTelegramBuffer(file: any): Promise<Uint8Array> {
  const botRef = file.bot_reference || 'PRODUCTION_STORAGE';
  const client = resolveBotDownloadClient(botRef);
  const fileIdStr = file.telegram_file_id || (file.provider === 'TELEGRAM' ? file.file_key : null);
  if (!fileIdStr) throw new Error('TELEGRAM_FILE_ID_MISSING');

  if (typeof fileIdStr === 'string' && fileIdStr.trim().startsWith('[')) {
    const parsed = JSON.parse(fileIdStr);
    const chunks = Array.isArray(parsed) ? parsed.sort((a: any, b: any) => a.chunkIndex - b.chunkIndex) : [];
    const buffers: Uint8Array[] = [];
    for (const chunk of chunks) {
      const stream = await client.download(chunk.fileId);
      const res = new Response(stream);
      buffers.push(new Uint8Array(await res.arrayBuffer()));
    }
    const totalLen = buffers.reduce((acc, b) => acc + b.byteLength, 0);
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const b of buffers) {
      combined.set(b, offset);
      offset += b.byteLength;
    }
    return combined;
  } else {
    const stream = await client.download(fileIdStr);
    const res = new Response(stream);
    return new Uint8Array(await res.arrayBuffer());
  }
}

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

      // Download and unpack via fflate from sovereign Telegram storage
      const uint8 = await downloadTelegramBuffer(file);

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

  // 2. Direct single-page storage streaming via sovereign Telegram storage
  try {
    const isCh85 = chapterId === 'b5a9fbf0-206d-475a-8e05-70aaa672f71e';
    const pageFileId = isCh85 ? CH85_PAGE_TELEGRAM_IDS[pageIndex] : null;
    if (pageFileId) {
      const client = resolveBotDownloadClient('PRODUCTION_STORAGE');
      const stream = await client.download(pageFileId);
      const res = new Response(stream);
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length > 500) {
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
