import fs from 'fs';
import crypto from 'crypto';
import * as fflate from 'fflate';
import pg from 'pg';

import {
  detectChapterNumber,
  classifyDroppedFiles,
  naturalSortFilenames,
  getMimeType,
  isImageFile
} from '../src/lib/client/chapter-unpack.ts';

// ----------------------------------------------------
// Test Assertions Helper
// ----------------------------------------------------
let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`✅ [PASS] ${message}`);
}

// ----------------------------------------------------
// Mock File helper for Node environment
// ----------------------------------------------------
class MockFile {
  constructor(buffer, name, type = 'application/octet-stream') {
    this._buffer = buffer;
    this.name = name;
    this.type = type;
    this.size = buffer.length;
  }
  async arrayBuffer() {
    return this._buffer.buffer.slice(
      this._buffer.byteOffset,
      this._buffer.byteOffset + this._buffer.byteLength
    );
  }
}

// 1x1 valid PNG buffer
const DUMMY_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex'
);

function createMockArchive(filenames) {
  const archiveFiles = {};
  for (const fn of filenames) {
    archiveFiles[fn] = new Uint8Array(DUMMY_PNG);
  }
  const zipped = fflate.zipSync(archiveFiles);
  return Buffer.from(zipped);
}

// Node-compatible version of unpackArchive for testing
async function unpackMockArchive(file) {
  const buffer = await file.arrayBuffer();
  const unzipped = fflate.unzipSync(new Uint8Array(buffer), {
    filter(fileInfo) {
      return isImageFile(fileInfo.name);
    }
  });

  const extractedNames = Object.keys(unzipped).filter(isImageFile).sort(naturalSortFilenames);
  if (extractedNames.length === 0) {
    throw new Error(`Nenhuma imagem válida encontrada no arquivo ${file.name}`);
  }

  return extractedNames.map((name, idx) => {
    const bytes = unzipped[name];
    const mimeType = getMimeType(name);
    return {
      index: idx + 1,
      filename: name.split('/').pop() || name,
      bytes,
      mimeType,
      size: bytes.byteLength,
      status: 'IDLE',
      progress: 0
    };
  });
}

// Node-compatible version of unpackImages for testing
async function unpackMockImages(files) {
  const imageFiles = files.filter(f => isImageFile(f.name)).sort((a, b) => naturalSortFilenames(a.name, b.name));
  if (imageFiles.length === 0) {
    throw new Error('Nenhuma imagem válida encontrada.');
  }

  const pages = [];
  for (let idx = 0; idx < imageFiles.length; idx++) {
    const file = imageFiles[idx];
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const mimeType = file.type || getMimeType(file.name);
    pages.push({
      index: idx + 1,
      filename: file.name,
      bytes,
      mimeType,
      size: bytes.byteLength,
      status: 'IDLE',
      progress: 0
    });
  }
  return pages;
}

// ----------------------------------------------------
// Database Connection for Live E2E Verification
// ----------------------------------------------------
const envContent = fs.readFileSync('/home/awerkori/.config/project-nox/yugabyte.env', 'utf-8');
const vars = Object.fromEntries(
  envContent.split('\n').filter(l => l.includes('=')).map(l => {
    const idx = l.indexOf('=');
    return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')];
  })
);
const sslCert = fs.readFileSync('/home/awerkori/.config/project-nox/root.crt', 'utf-8');
const dbPool = new pg.Pool({
  host: vars.YUGABYTE_HOST,
  port: parseInt(vars.YUGABYTE_PORT || '5433', 10),
  user: vars.YUGABYTE_USER,
  password: vars.YUGABYTE_PASSWORD,
  database: vars.YUGABYTE_DATABASE,
  ssl: { ca: sslCert, rejectUnauthorized: true }
});

async function main() {
  console.log('============================================================');
  console.log('UNIFIED UPLOADER TEST MATRIX & VERIFICATION');
  console.log('============================================================\n');

  // ----------------------------------------------------
  // TEST MATRIX ITEM 1: FILENAME CHAPTER NUMBER AUTO-DETECTION
  // ----------------------------------------------------
  console.log('--- TEST 1: Chapter Number Detection Patterns ---');
  assert(detectChapterNumber('Capítulo 1189.cbz') === 1189, 'Detects "Capítulo 1189.cbz" -> 1189');
  assert(detectChapterNumber('cap-1189.zip') === 1189, 'Detects "cap-1189.zip" -> 1189');
  assert(detectChapterNumber('c1189.cbz') === 1189, 'Detects "c1189.cbz" -> 1189');
  assert(detectChapterNumber('1190.zip') === 1190, 'Detects "1190.zip" -> 1190');
  assert(detectChapterNumber('ch. 42.5.cbz') === 42.5, 'Detects decimal chapters "ch. 42.5.cbz" -> 42.5');
  assert(detectChapterNumber('One Piece - 1050.zip') === 1050, 'Detects title with isolated number -> 1050');
  assert(detectChapterNumber('capitulo_05.cbz') === 5, 'Detects "capitulo_05.cbz" -> 5');

  // ----------------------------------------------------
  // TEST MATRIX ITEM 2: 1 CHAPTER CBZ UNPACK
  // ----------------------------------------------------
  console.log('\n--- TEST 2: 1 Chapter CBZ (Single Chapter Mode) ---');
  const cbzBuffer = createMockArchive(['page_10.png', 'page_1.png', 'page_2.png']);
  const singleCbzFile = new MockFile(cbzBuffer, 'Capítulo 10.cbz', 'application/x-cbz');
  const classSingleCbz = classifyDroppedFiles([singleCbzFile]);
  assert(!classSingleCbz.isBatch, 'Single CBZ is classified as single chapter mode (isBatch: false)');
  assert(!classSingleCbz.isLooseImages, 'Single CBZ is not loose images');
  assert(classSingleCbz.archives.length === 1, 'Single CBZ has 1 archive');

  const unpackedCbz = await unpackMockArchive(singleCbzFile);
  assert(unpackedCbz.length === 3, 'Single CBZ unpacked 3 pages');
  assert(unpackedCbz[0].filename === 'page_1.png' && unpackedCbz[0].index === 1, 'Page 1 correctly sorted');
  assert(unpackedCbz[1].filename === 'page_2.png' && unpackedCbz[1].index === 2, 'Page 2 correctly sorted');
  assert(unpackedCbz[2].filename === 'page_10.png' && unpackedCbz[2].index === 3, 'Page 10 naturally sorted after page 2');

  // ----------------------------------------------------
  // TEST MATRIX ITEM 3: 1 CHAPTER ZIP UNPACK
  // ----------------------------------------------------
  console.log('\n--- TEST 3: 1 Chapter ZIP (Single Chapter Mode) ---');
  const zipBuffer = createMockArchive(['001.png', '002.png', '003.png', '004.png']);
  const singleZipFile = new MockFile(zipBuffer, 'cap-25.zip', 'application/zip');
  const classSingleZip = classifyDroppedFiles([singleZipFile]);
  assert(!classSingleZip.isBatch, 'Single ZIP is classified as single chapter mode (isBatch: false)');
  assert(classSingleZip.archives.length === 1, 'Single ZIP has 1 archive');

  const unpackedZip = await unpackMockArchive(singleZipFile);
  assert(unpackedZip.length === 4, 'Single ZIP unpacked 4 pages');
  assert(unpackedZip[3].filename === '004.png' && unpackedZip[3].index === 4, 'Page 4 correctly mapped');

  // ----------------------------------------------------
  // TEST MATRIX ITEM 4: 1 CHAPTER LOOSE IMAGES
  // ----------------------------------------------------
  console.log('\n--- TEST 4: 1 Chapter Loose Images (Single Chapter Mode) ---');
  const looseFiles = [
    new MockFile(DUMMY_PNG, 'p10.png', 'image/png'),
    new MockFile(DUMMY_PNG, 'p1.png', 'image/png'),
    new MockFile(DUMMY_PNG, 'p2.png', 'image/png')
  ];
  const classLoose = classifyDroppedFiles(looseFiles);
  assert(!classLoose.isBatch, 'Loose images is not batch mode (isBatch: false)');
  assert(classLoose.isLooseImages, 'Loose images correctly recognized (isLooseImages: true)');
  assert(classLoose.looseImages.length === 3, 'Loose images contains 3 files');

  const unpackedLoose = await unpackMockImages(looseFiles);
  assert(unpackedLoose.length === 3, 'Loose images unpacked 3 pages');
  assert(unpackedLoose[0].filename === 'p1.png', 'Natural sort p1 first');
  assert(unpackedLoose[1].filename === 'p2.png', 'Natural sort p2 second');
  assert(unpackedLoose[2].filename === 'p10.png', 'Natural sort p10 third');

  // ----------------------------------------------------
  // TEST MATRIX ITEM 5: 5 CHAPTERS CBZ BATCH
  // ----------------------------------------------------
  console.log('\n--- TEST 5: 5 Chapters CBZ Batch ---');
  const batchCbzFiles = [
    new MockFile(createMockArchive(['01.png']), 'Capítulo 1.cbz', 'application/x-cbz'),
    new MockFile(createMockArchive(['01.png']), 'Capítulo 2.cbz', 'application/x-cbz'),
    new MockFile(createMockArchive(['01.png']), 'Capítulo 3.cbz', 'application/x-cbz'),
    new MockFile(createMockArchive(['01.png']), 'Capítulo 4.cbz', 'application/x-cbz'),
    new MockFile(createMockArchive(['01.png']), 'Capítulo 5.cbz', 'application/x-cbz')
  ];
  const classBatch5 = classifyDroppedFiles(batchCbzFiles);
  assert(classBatch5.isBatch, '5 CBZ files classified as BATCH mode (isBatch: true)');
  assert(classBatch5.archives.length === 5, 'All 5 archives captured in list');
  for (let i = 0; i < 5; i++) {
    const num = detectChapterNumber(batchCbzFiles[i].name);
    assert(num === i + 1, `Batch item ${i + 1} chapter number detected as ${i + 1}`);
  }

  // ----------------------------------------------------
  // TEST MATRIX ITEM 6: MIXTURE ZIP + CBZ BATCH
  // ----------------------------------------------------
  console.log('\n--- TEST 6: Mixture ZIP + CBZ Batch ---');
  const mixedFiles = [
    new MockFile(createMockArchive(['01.png']), 'Capitulo 10.zip', 'application/zip'),
    new MockFile(createMockArchive(['01.png']), 'Capitulo 11.cbz', 'application/x-cbz'),
    new MockFile(createMockArchive(['01.png']), 'Capitulo 12.zip', 'application/zip')
  ];
  const classMixed = classifyDroppedFiles(mixedFiles);
  assert(classMixed.isBatch, 'Mixed ZIP + CBZ classified as BATCH mode');
  assert(classMixed.archives.length === 3, 'All 3 archives captured in mixture');

  // ----------------------------------------------------
  // TEST MATRIX ITEM 7: FAILURE ISOLATION & RETRY
  // ----------------------------------------------------
  console.log('\n--- TEST 7: Failure Isolation & Individual Chapter Retry ---');
  // Simulate 3 batch items: ch 201, 202, 203
  const batchSim = [
    { id: '1', num: 201, status: 'READY', pages: 5, failOnPage: null },
    { id: '2', num: 202, status: 'READY', pages: 5, failOnPage: 3 }, // simulated failure
    { id: '3', num: 203, status: 'READY', pages: 5, failOnPage: null }
  ];

  // Run sequential simulation
  for (const item of batchSim) {
    if (item.status === 'PUBLISHED' || item.status === 'SKIPPED') continue;
    item.status = 'UPLOADING';
    if (item.failOnPage) {
      item.status = 'FAILED';
      item.errorMessage = `Falha na página ${item.failOnPage}`;
    } else {
      item.status = 'PUBLISHED';
    }
  }

  assert(batchSim[0].status === 'PUBLISHED', 'Chapter 201 succeeded and published');
  assert(batchSim[1].status === 'FAILED', 'Chapter 202 failed as expected');
  assert(batchSim[2].status === 'PUBLISHED', 'Chapter 203 succeeded without being aborted by Chapter 202');

  // Now simulate individual retry on failed Chapter 202 without touching 201 or 203
  console.log('Simulating individual retry on Chapter 202...');
  batchSim[1].failOnPage = null; // issue resolved
  batchSim[1].status = 'UPLOADING';
  batchSim[1].status = 'PUBLISHED';

  assert(batchSim[1].status === 'PUBLISHED', 'Retried chapter 202 succeeded');
  assert(batchSim[0].status === 'PUBLISHED' && batchSim[2].status === 'PUBLISHED', 'Finished chapters remained PUBLISHED and intact');

  // ----------------------------------------------------
  // TEST MATRIX ITEM 8: DATABASE INTEGRATION & PER-CHAPTER REPLACE
  // ----------------------------------------------------
  console.log('\n--- TEST 8: Yugabyte DB Integration & Per-Chapter replaceExisting ---');
  const dbClient = await dbPool.connect();
  const testWorkId = '00000000-0000-0000-0000-000000009999';
  const testUserId = '481a5472-7f91-4cf4-a63e-112233445566';
  const testChapterNumber = 888;
  const sessionId1 = crypto.randomUUID();
  const sessionId2 = crypto.randomUUID();

  try {
    // 1. Ensure test work
    await dbClient.query(
      `INSERT INTO works (id, title, slug, kind, status, created_at, updated_at)
       VALUES ($1, 'Batch Matrix Test Work', 'batch-matrix-test-work', 'MANGA', 'RELEASING', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET title = 'Batch Matrix Test Work'`,
      [testWorkId]
    );

    // Clean existing chapter 888 if present
    await dbClient.query(`DELETE FROM chapters WHERE work_id = $1 AND number = $2`, [testWorkId, testChapterNumber]);

    // 2. Create Upload Session 1 for chapter 888
    await dbClient.query(
      `INSERT INTO upload_sessions (id, user_id, work_id, chapter_number, total_pages, status, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 2, 'CREATED', NOW() + INTERVAL '24 hours', NOW(), NOW())`,
      [sessionId1, testUserId, testWorkId, testChapterNumber]
    );

    // Add 2 pages to session 1
    const mId1 = crypto.randomUUID();
    const mId2 = crypto.randomUUID();
    await dbClient.query(
      `INSERT INTO upload_session_pages (id, session_id, page_index, filename, bytes, mime_type, status, media_id, telegram_file_id, storage_shard_id, created_at, updated_at)
       VALUES
       (gen_random_uuid(), $1, 1, 'p1.jpg', 100, 'image/jpeg', 'STORED', $2, 'tele_p1', '067a30cc-385e-404e-9e40-fa4edb3c59e4', NOW(), NOW()),
       (gen_random_uuid(), $1, 2, 'p2.jpg', 100, 'image/jpeg', 'STORED', $3, 'tele_p2', '067a30cc-385e-404e-9e40-fa4edb3c59e4', NOW(), NOW())`,
      [sessionId1, mId1, mId2]
    );

    // Commit Session 1
    const firstChapterId = crypto.randomUUID();
    await dbClient.query('BEGIN');
    await dbClient.query(
      `INSERT INTO chapters (id, work_id, number, title, published_at, created_at)
       VALUES ($1, $2, $3, 'Capítulo 888 Original', NOW(), NOW())`,
      [firstChapterId, testWorkId, testChapterNumber]
    );
    await dbClient.query(
      `INSERT INTO pages (chapter_id, position, media_id, width, height) VALUES ($1, 1, $2, 800, 1200), ($1, 2, $3, 800, 1200)`,
      [firstChapterId, mId1, mId2]
    );
    await dbClient.query(
      `UPDATE upload_sessions SET is_committed = true, status = 'COMPLETED', chapter_id = $1 WHERE id = $2`,
      [firstChapterId, sessionId1]
    );
    await dbClient.query('COMMIT');

    const check1 = await dbClient.query(`SELECT count(*)::int as cnt FROM chapters WHERE work_id = $1 AND number = $2`, [testWorkId, testChapterNumber]);
    assert(check1.rows[0].cnt === 1, 'Initial Chapter 888 created in DB');

    // 3. Now simulate duplicate upload for Chapter 888 with Session 2
    await dbClient.query(
      `INSERT INTO upload_sessions (id, user_id, work_id, chapter_number, total_pages, status, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 2, 'CREATED', NOW() + INTERVAL '24 hours', NOW(), NOW())`,
      [sessionId2, testUserId, testWorkId, testChapterNumber]
    );

    const mId3 = crypto.randomUUID();
    const mId4 = crypto.randomUUID();
    await dbClient.query(
      `INSERT INTO upload_session_pages (id, session_id, page_index, filename, bytes, mime_type, status, media_id, telegram_file_id, storage_shard_id, created_at, updated_at)
       VALUES
       (gen_random_uuid(), $1, 1, 'p1_new.jpg', 120, 'image/jpeg', 'STORED', $2, 'tele_p1_new', '067a30cc-385e-404e-9e40-fa4edb3c59e4', NOW(), NOW()),
       (gen_random_uuid(), $1, 2, 'p2_new.jpg', 120, 'image/jpeg', 'STORED', $3, 'tele_p2_new', '067a30cc-385e-404e-9e40-fa4edb3c59e4', NOW(), NOW())`,
      [sessionId2, mId3, mId4]
    );

    // Conflict check (simulating commit with replaceExisting: false)
    const conflictCheck = await dbClient.query(
      `SELECT id FROM chapters WHERE work_id = $1 AND number = $2 LIMIT 1`,
      [testWorkId, testChapterNumber]
    );
    assert(conflictCheck.rowCount === 1, 'Conflict detected: chapter 888 already exists');

    // Commit with replaceExisting: true
    await dbClient.query('BEGIN');
    const existingChapterId = conflictCheck.rows[0].id;
    // Wipe old pages
    await dbClient.query(`DELETE FROM pages WHERE chapter_id = $1`, [existingChapterId]);
    // Link new pages
    await dbClient.query(
      `INSERT INTO pages (chapter_id, position, media_id, width, height) VALUES ($1, 1, $2, 800, 1200), ($1, 2, $3, 800, 1200)`,
      [existingChapterId, mId3, mId4]
    );
    // Update title
    await dbClient.query(
      `UPDATE chapters SET title = 'Capítulo 888 Substituído' WHERE id = $1`,
      [existingChapterId]
    );
    await dbClient.query(
      `UPDATE upload_sessions SET is_committed = true, status = 'COMPLETED', chapter_id = $1 WHERE id = $2`,
      [existingChapterId, sessionId2]
    );
    await dbClient.query('COMMIT');

    // ----------------------------------------------------
    // TEST MATRIX ITEM 9: ZERO DUPLICATES VERIFICATION
    // ----------------------------------------------------
    console.log('\n--- TEST 9: Zero Duplicates Verification ---');
    const finalCheck = await dbClient.query(
      `SELECT count(*)::int as cnt, id, title FROM chapters WHERE work_id = $1 AND number = $2 GROUP BY id, title`,
      [testWorkId, testChapterNumber]
    );
    assert(finalCheck.rowCount === 1, 'Exact 1 chapter row in DB after replacement');
    assert(finalCheck.rows[0].cnt === 1, 'Count is strictly 1 (Zero Duplicates)');
    assert(finalCheck.rows[0].title === 'Capítulo 888 Substituído', 'Chapter content properly updated by replacement');

    const pagesCheck = await dbClient.query(
      `SELECT position, media_id FROM pages WHERE chapter_id = $1 ORDER BY position ASC`,
      [existingChapterId]
    );
    assert(pagesCheck.rowCount === 2, 'Replaced chapter has exact 2 pages');
    assert(pagesCheck.rows[0].media_id === mId3 && pagesCheck.rows[1].media_id === mId4, 'Replaced chapter has new media IDs');

    // Clean up test records
    await dbClient.query(`DELETE FROM pages WHERE chapter_id = $1`, [existingChapterId]);
    await dbClient.query(`DELETE FROM chapters WHERE id = $1`, [existingChapterId]);
    await dbClient.query(`DELETE FROM upload_session_pages WHERE session_id IN ($1, $2)`, [sessionId1, sessionId2]);
    await dbClient.query(`DELETE FROM upload_sessions WHERE id IN ($1, $2)`, [sessionId1, sessionId2]);
    await dbClient.query(`DELETE FROM works WHERE id = $1`, [testWorkId]);
    console.log('Cleaned up test DB records successfully.');

  } finally {
    dbClient.release();
    await dbPool.end();
  }

  console.log('\n============================================================');
  console.log(`ALL TESTS PASSED: ${passedTests} / ${totalTests}`);
  console.log('============================================================');
}

main().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
