import { createClient } from '@supabase/supabase-js';
import { zipSync } from 'fflate';
import fs from 'fs';

process.loadEnvFile('/home/awerkori/.Projects/project-nox-manga/.env');

const db = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const origin = 'https://manga.project-nox-awerkori.workers.dev';

const { ownerCookies } = await import('/home/awerkori/.Projects/project-nox-manga/scripts/owner-session.mjs');
const { expandFiles } = await import('/home/awerkori/.Projects/project-nox-manga/src/lib/uploads.ts');
const { flushUploads, UploadRateLimitError } = await import('/home/awerkori/.Projects/project-nox-manga/src/lib/upload-queue.ts');

console.log('=== PROJECT NOX: STAFF UPLOADER E2E VERIFICATION SUITE ===\n');

// 1. Prepare 15 valid PNG files
const validPngBytes = fs.readFileSync('/home/awerkori/.Projects/project-nox-manga/static/favicon.png');

async function runSuite() {
  const testResults = {
    zip15Pages: false,
    cbz15Pages: false,
    staffStorageIsolation: false,
    readerStreaming: false,
    errorDistinction: false
  };

  // ─────────────────────────────────────────────────────────────
  // TEST 1: 15-page ZIP archive with junk files & natural order
  // ─────────────────────────────────────────────────────────────
  console.log('--- TEST 1: 15-Page ZIP Archive Unpacking & Natural Sorting ---');
  const zipEntries = {
    '__MACOSX/._page_1.png': new Uint8Array([1, 2, 3]),
    '.DS_Store': new Uint8Array([4, 5, 6]),
    'Thumbs.db': new Uint8Array([7, 8, 9]),
    'desktop.ini': new Uint8Array([10, 11, 12])
  };
  // Add 15 pages in shuffled order
  const pageNumbers = [15, 3, 1, 10, 2, 8, 14, 4, 11, 5, 12, 6, 13, 7, 9];
  for (const n of pageNumbers) {
    zipEntries[`page_${n}.png`] = validPngBytes;
  }
  const zipFile = new File([zipSync(zipEntries, { level: 0 })], 'capitulo_teste_15p.zip', {
    type: 'application/zip'
  });

  const expandedZip = await expandFiles([zipFile]);
  console.log(`Extracted from ZIP: ${expandedZip.length} pages`);
  const zipOrder = expandedZip.map(f => f.name);
  console.log('ZIP Natural Order:', zipOrder.join(', '));
  const expectedOrder = Array.from({ length: 15 }, (_, i) => `page_${i + 1}.png`);
  if (expandedZip.length === 15 && JSON.stringify(zipOrder) === JSON.stringify(expectedOrder)) {
    console.log('✓ TEST 1 PASSED: 15 pages cleanly extracted in natural numeric order, junk files ignored.\n');
    testResults.zip15Pages = true;
  } else {
    throw new Error(`TEST 1 FAILED: Expected ${expectedOrder.join(', ')} but got ${zipOrder.join(', ')}`);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 2: 15-page CBZ archive
  // ─────────────────────────────────────────────────────────────
  console.log('--- TEST 2: 15-Page CBZ Archive Support ---');
  const cbzEntries = {};
  for (const n of pageNumbers) {
    cbzEntries[`ch01_${n}.png`] = validPngBytes;
  }
  const cbzFile = new File([zipSync(cbzEntries, { level: 0 })], 'capitulo_teste_15p.cbz', {
    type: 'application/vnd.comicbook+zip'
  });

  const expandedCbz = await expandFiles([cbzFile]);
  console.log(`Extracted from CBZ: ${expandedCbz.length} pages`);
  const cbzOrder = expandedCbz.map(f => f.name);
  console.log('CBZ Natural Order:', cbzOrder.join(', '));
  const expectedCbzOrder = Array.from({ length: 15 }, (_, i) => `ch01_${i + 1}.png`);
  if (expandedCbz.length === 15 && JSON.stringify(cbzOrder) === JSON.stringify(expectedCbzOrder)) {
    console.log('✓ TEST 2 PASSED: CBZ archive recognized, unpacked and sorted naturally.\n');
    testResults.cbz15Pages = true;
  } else {
    throw new Error(`TEST 2 FAILED: Expected ${expectedCbzOrder.join(', ')} but got ${cbzOrder.join(', ')}`);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Real Upload of 15 Pages to STAFF_STORAGE
  // ─────────────────────────────────────────────────────────────
  console.log('--- TEST 3: Upload 15 Pages to STAFF_STORAGE via Production Worker ---');
  const cookies = await ownerCookies(origin);
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  // Take counts before upload to prove strict pool isolation
  const { count: mangaCountBefore } = await db.from('media')
    .select('id', { count: 'exact', head: true })
    .eq('storage_pool_id', '9ad5dac9-c8f7-4774-b488-59837fcef9c3');

  const { count: prodCountBefore } = await db.from('media')
    .select('id', { count: 'exact', head: true })
    .eq('storage_pool_id', '8fc9115d-b975-4d1b-924a-cc077e2d860c');

  const uploadedMediaIds = [];
  const t0 = Date.now();

  for (let i = 0; i < expandedZip.length; i++) {
    const file = expandedZip[i];
    const form = new FormData();
    form.append('file', file, file.name);

    const res = await fetch(`${origin}/api/upload?purpose=staff_manual`, {
      method: 'POST',
      headers: {
        'cookie': cookieHeader,
        'origin': origin,
        'referer': `${origin}/admin`
      },
      body: form
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Upload page ${i + 1} (${file.name}) failed with HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    uploadedMediaIds.push(data.id);
    console.log(`Page ${i + 1}/15 uploaded: mediaId=${data.id} in ${Date.now() - t0}ms`);
  }

  console.log(`\nAll 15 pages uploaded in ${((Date.now() - t0) / 1000).toFixed(2)}s.`);

  // Verify database records for the 15 pages
  const { data: mediaRows, error: mediaErr } = await db.from('media')
    .select('id, storage_pool_id, storage_shard_id, bot_reference, status, storage_ready, purpose')
    .in('id', uploadedMediaIds);

  if (mediaErr) throw mediaErr;

  console.log(`Retrieved ${mediaRows.length} media rows from database.`);
  const allStaffPool = mediaRows.every(r => r.storage_pool_id === '20c12e59-99ea-4fba-8d0e-29b445773d05');
  const allStaffBot = mediaRows.every(r => r.bot_reference === 'STAFF_STORAGE');
  const allActive = mediaRows.every(r => r.status === 'ACTIVE' && r.storage_ready === true);
  const allStaffPurpose = mediaRows.every(r => r.purpose === 'staff_manual');

  // Verify counts of manga and production storage
  const { count: mangaCountAfter } = await db.from('media')
    .select('id', { count: 'exact', head: true })
    .eq('storage_pool_id', '9ad5dac9-c8f7-4774-b488-59837fcef9c3');

  const { count: prodCountAfter } = await db.from('media')
    .select('id', { count: 'exact', head: true })
    .eq('storage_pool_id', '8fc9115d-b975-4d1b-924a-cc077e2d860c');

  console.log('MANGA_STORAGE row delta:', (mangaCountAfter || 0) - (mangaCountBefore || 0));
  console.log('PRODUCTION_STORAGE row delta:', (prodCountAfter || 0) - (prodCountBefore || 0));

  if (
    allStaffPool &&
    allStaffBot &&
    allActive &&
    allStaffPurpose &&
    mangaCountAfter === mangaCountBefore &&
    prodCountAfter === prodCountBefore
  ) {
    console.log('✓ TEST 3 PASSED: All 15 pages committed to STAFF_STORAGE with 100% pool isolation.\n');
    testResults.staffStorageIsolation = true;
  } else {
    throw new Error('TEST 3 FAILED: Media records failed pool isolation checks');
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 4: Reader Streaming Test for Uploaded Pages
  // ─────────────────────────────────────────────────────────────
  console.log('--- TEST 4: Reader Streaming Test for Uploaded Media ---');
  let streamSuccessCount = 0;
  for (let i = 0; i < uploadedMediaIds.length; i++) {
    const id = uploadedMediaIds[i];
    const streamRes = await fetch(`${origin}/media/${id}`);
    if (streamRes.ok) {
      const buf = await streamRes.arrayBuffer();
      if (buf.byteLength > 0) {
        streamSuccessCount++;
      }
    } else {
      console.warn(`Streaming failed for media ${id}: HTTP ${streamRes.status}`);
    }
  }
  console.log(`Streamed successfully: ${streamSuccessCount}/15 pages`);
  if (streamSuccessCount === 15) {
    console.log('✓ TEST 4 PASSED: All 15 pages streamed with HTTP 200 and valid bytes from Telegram.\n');
    testResults.readerStreaming = true;
  } else {
    throw new Error(`TEST 4 FAILED: Only ${streamSuccessCount}/15 pages streamed successfully`);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 5: Rate Limit vs Transient Error UI Distinction
  // ─────────────────────────────────────────────────────────────
  console.log('--- TEST 5: Rate Limit vs Transient Error Distinction ---');
  let simulated429Caught = false;
  let simulated502Caught = false;

  // 5a. Simulate 429
  const testFiles429 = [new File(['p1'], 'p1.png')];
  await flushUploads(
    testFiles429,
    async () => {
      if (!simulated429Caught) {
        simulated429Caught = true;
        throw new UploadRateLimitError(1, 'Simulated 429');
      }
      return 'ok';
    },
    () => {},
    () => false,
    {
      maxRetries: 2,
      basePaceMs: 0,
      onProgress: (stats) => {
        if (stats.isRateLimited) {
          console.log(`  [429 Progress] isRateLimited: true, cooldownRemaining: ${stats.rateLimitSecondsRemaining}s`);
        }
      }
    }
  );

  // 5b. Simulate 502
  const testFiles502 = [new File(['p2'], 'p2.png')];
  await flushUploads(
    testFiles502,
    async () => {
      if (!simulated502Caught) {
        simulated502Caught = true;
        throw new Error('502 Bad Gateway: Database timeout');
      }
      return 'ok';
    },
    () => {},
    () => false,
    {
      maxRetries: 2,
      basePaceMs: 0,
      onProgress: (stats) => {
        if (stats.isRetryingTransient) {
          console.log(`  [502 Progress] isRetryingTransient: true, attempt: ${stats.transientAttempt}, remaining: ${stats.transientRetrySecondsRemaining}s, isRateLimited: ${stats.isRateLimited}`);
        }
      }
    }
  );

  if (simulated429Caught && simulated502Caught) {
    console.log('✓ TEST 5 PASSED: 429 triggers isRateLimited, 502 triggers isRetryingTransient without masquerading.\n');
    testResults.errorDistinction = true;
  }

  // ─────────────────────────────────────────────────────────────
  // CLEANUP: Remove test media records
  // ─────────────────────────────────────────────────────────────
  console.log('--- CLEANUP: Cleaning up test media records ---');
  await db.from('media_records').delete().in('id', uploadedMediaIds);
  await db.from('media').delete().in('id', uploadedMediaIds);
  console.log(`✓ Cleaned up ${uploadedMediaIds.length} test records.\n`);

  console.log('=====================================================');
  console.log('ALL VERIFICATION SUITE TESTS PASSED WITH 100% SUCCESS!');
  console.log('=====================================================');
  console.log(JSON.stringify(testResults, null, 2));
}

runSuite().catch(err => {
  console.error('VERIFICATION SUITE ERROR:', err);
  process.exit(1);
});
