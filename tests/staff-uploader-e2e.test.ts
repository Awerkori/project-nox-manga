import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { zipSync } from 'fflate';
import fs from 'fs';
import { expandFiles } from '../src/lib/uploads';
import { flushUploads, UploadRateLimitError, _resetAdaptiveStateForTesting } from '../src/lib/upload-queue';
import { ownerCookies } from '../scripts/owner-session.mjs';

const prodUrl = 'https://manga.project-nox-awerkori.workers.dev';
const STAFF_POOL_ID = '20c12e59-99ea-4fba-8d0e-29b445773d05';
const MANGA_POOL_ID = '9ad5dac9-c8f7-4774-b488-59837fcef9c3';
const PROD_POOL_ID = '8fc9115d-b975-4d1b-924a-cc077e2d860c';

describe('Staff Manual Uploader & STAFF_STORAGE E2E Homologation', () => {
  beforeEach(() => {
    _resetAdaptiveStateForTesting();
  });

  const validPngBytes = fs.readFileSync('static/favicon.png');

  it('unpacks 15-page ZIP archive, ignores OS junk, and strictly enforces natural sorting', async () => {
    const zipEntries: Record<string, Uint8Array> = {
      '__MACOSX/._page_1.png': new Uint8Array([1, 2, 3]),
      '.DS_Store': new Uint8Array([4, 5, 6]),
      'Thumbs.db': new Uint8Array([7, 8, 9]),
      'desktop.ini': new Uint8Array([10, 11, 12])
    };
    // 15 pages in shuffled order
    const pageNumbers = [15, 3, 1, 10, 2, 8, 14, 4, 11, 5, 12, 6, 13, 7, 9];
    for (const n of pageNumbers) {
      zipEntries[`page_${n}.png`] = validPngBytes;
    }

    const zipFile = new File([zipSync(zipEntries, { level: 0 })], 'chapter_test_15p.zip', {
      type: 'application/zip'
    });

    const pages = await expandFiles([zipFile]);
    expect(pages.length).toBe(15);
    const names = pages.map((p) => p.name);
    const expected = Array.from({ length: 15 }, (_, i) => `page_${i + 1}.png`);
    expect(names).toEqual(expected);
  });

  it('unpacks 15-page CBZ archive with natural order', async () => {
    const cbzEntries: Record<string, Uint8Array> = {};
    const pageNumbers = [15, 3, 1, 10, 2, 8, 14, 4, 11, 5, 12, 6, 13, 7, 9];
    for (const n of pageNumbers) {
      cbzEntries[`ch01_${n}.png`] = validPngBytes;
    }

    const cbzFile = new File([zipSync(cbzEntries, { level: 0 })], 'chapter_test_15p.cbz', {
      type: 'application/vnd.comicbook+zip'
    });

    const pages = await expandFiles([cbzFile]);
    expect(pages.length).toBe(15);
    const names = pages.map((p) => p.name);
    const expected = Array.from({ length: 15 }, (_, i) => `ch01_${i + 1}.png`);
    expect(names).toEqual(expected);
  });

  it('strictly isolates rate limit 429 cooldown from transient 502 backoff', async () => {
    // 1. Transient 502 test
    const transientProgress: any[] = [];
    let caught502 = false;
    const testFile502 = [new File(['p1'], 'p1.png')];
    await flushUploads(
      testFile502,
      async () => {
        if (!caught502) {
          caught502 = true;
          throw new Error('502 Bad Gateway: Database timeout');
        }
        return 'ok';
      },
      () => {},
      () => false,
      {
        maxRetries: 2,
        basePaceMs: 0,
        onProgress: (s) => transientProgress.push({ ...s })
      }
    );
    expect(caught502).toBe(true);
    // 502 must never set isRateLimited or inCooldown
    expect(transientProgress.some((p) => p.isRateLimited || p.inCooldown)).toBe(false);
    expect(transientProgress.some((p) => p.isRetryingTransient)).toBe(true);

    // 2. Rate limit 429 test
    const rateLimitProgress: any[] = [];
    let caught429 = false;
    const testFile429 = [new File(['p2'], 'p2.png')];
    await flushUploads(
      testFile429,
      async () => {
        if (!caught429) {
          caught429 = true;
          throw new UploadRateLimitError(0.05, 'Simulated 429');
        }
        return 'ok';
      },
      () => {},
      () => false,
      {
        maxRetries: 2,
        basePaceMs: 0,
        onProgress: (s) => rateLimitProgress.push({ ...s })
      }
    );
    expect(caught429).toBe(true);
    expect(rateLimitProgress.some((p) => p.isRateLimited && p.inCooldown)).toBe(true);
  });

  it('performs live 15-page upload to STAFF_STORAGE with 100% pool isolation and reader stream verification', async () => {
    if (!process.env.PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return;
    }
    const admin = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const cookies = await ownerCookies(prodUrl);
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const uploadedIds: string[] = [];

    const testFiles = Array.from({ length: 15 }, (_, i) => new File([validPngBytes], `page_${i + 1}.png`, { type: 'image/png' }));
    const pending = [...testFiles];

    await flushUploads(
      pending,
      async (file) => {
        const form = new FormData();
        form.append('file', file, file.name);
        const res = await fetch(`${prodUrl}/api/upload?purpose=staff_manual`, {
          method: 'POST',
          headers: {
            cookie: cookieHeader,
            origin: prodUrl,
            referer: `${prodUrl}/admin`
          },
          body: form
        });
        expect(res.status).toBe(200);
        return await res.json();
      },
      (result) => {
        uploadedIds.push(result.id);
      },
      () => false,
      {
        concurrency: 2,
        basePaceMs: 250,
        maxRetries: 3
      }
    );

    expect(uploadedIds.length).toBe(15);

    try {
      // Verify database records
      const { data: mediaRows, error: mediaErr } = await admin
        .from('media')
        .select('id, storage_pool_id, storage_shard_id, bot_reference, status, storage_ready, purpose')
        .in('id', uploadedIds);

      expect(mediaErr).toBeNull();
      expect(mediaRows?.length).toBe(15);

      for (const row of mediaRows!) {
        expect(row.storage_pool_id).toBe(STAFF_POOL_ID);
        expect(row.bot_reference).toBe('STAFF_STORAGE');
        expect(row.status).toBe('ACTIVE');
        expect(row.storage_ready).toBe(true);
        expect(row.purpose).toBe('staff_manual');
      }

      // Verify ZERO impact on MANGA_STORAGE and PRODUCTION_STORAGE
      for (const row of mediaRows!) {
        expect(row.storage_pool_id).not.toBe(MANGA_POOL_ID);
        expect(row.storage_pool_id).not.toBe(PROD_POOL_ID);
      }

      // Verify Reader streaming for all 15 pages
      for (const id of uploadedIds) {
        const streamRes = await fetch(`${prodUrl}/media/${id}`, {
          headers: { Cookie: cookieHeader }
        });
        expect(streamRes.status).toBe(200);
        const buf = await streamRes.arrayBuffer();
        expect(buf.byteLength).toBeGreaterThan(0);
      }
    } finally {
      // Cleanup
      await admin.from('media_records').delete().in('id', uploadedIds);
      await admin.from('media').delete().in('id', uploadedIds);
    }
  }, 180_000);
});
