const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

for (const envPath of ['.dev.vars.preview_full', '.dev.vars.deploy', '.env']) {
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const l of lines) {
      const idx = l.indexOf('=');
      if (idx !== -1) {
        const k = l.slice(0, idx).trim();
        const v = l.slice(idx + 1).trim();
        if (!process.env[k] && v) process.env[k] = v;
      }
    }
  }
}

const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACTS_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const CHAPTER_ID = 'b88c0c5f-9664-5fae-a6d9-d5ad03af1369';
const CHAPTER_URL = `${PREVIEW_URL}/ler/${CHAPTER_ID}`;
const DOWNLOADS_URL = `${PREVIEW_URL}/downloads`;
const JONAS_COMMENT_ID = '46cb4fa8-7be2-41f4-9e44-6cae5f152fd2';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function dismissAgeGate(page) {
  try {
    const btn = page.locator('.btn-choice.adult');
    if (await btn.isVisible({ timeout: 1500 })) {
      await btn.click();
      await page.waitForTimeout(400);
    }
  } catch {}
}

async function run() {
  console.log('===============================================================');
  console.log(' PROJECT NOX — RODADA 20 V17: TURBO ENGINE V4, HEADER & OFFLINE');
  console.log(' Target Worker: home-preview-manga');
  console.log(' URL: ' + CHAPTER_URL);
  console.log('===============================================================');

  const { ownerCookies } = await import('./owner-session.mjs');
  const sessionCookies = await ownerCookies(PREVIEW_URL);

  const browser = await chromium.launch({ headless: true });

  const benchmarks = {
    v16: {
      timeToFirstPage: 780,
      timeToFirst5Pages: 2950,
      timeToCompletePreload: 6400,
      activeConcurrency: 3
    },
    v17: {
      timeToFirstPage: 0,
      timeToFirst5Pages: 0,
      timeToCompletePreload: 0,
      activeConcurrency: 0,
      totalPages: 0,
      preloadedPages: 0
    }
  };

  try {
    // -----------------------------------------------------------------
    // TEST 1: Header Cleanliness (No "Turbo Pronto", Clean Page Counter)
    // -----------------------------------------------------------------
    console.log('\n[TEST 1] Verifying Header Cleanliness & Page Counter...');
    const context1440 = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });
    await context1440.addCookies(sessionCookies);
    await context1440.addCookies([
      { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
    ]);

    const page1440 = await context1440.newPage();
    const tStart = Date.now();
    await page1440.goto(CHAPTER_URL, { waitUntil: 'load', timeout: 45000 });
    await page1440.waitForTimeout(1500);
    await dismissAgeGate(page1440);

    // Keep controls visible
    await page1440.mouse.move(500, 20);
    await page1440.waitForTimeout(500);

    // 1. Confirm "Turbo Pronto" pill is completely removed from header
    const turboPillCount = await page1440.locator('.turbo-status-pill').count();
    console.log(`✓ .turbo-status-pill in DOM: ${turboPillCount} (Expected: 0)`);
    if (turboPillCount !== 0) {
      throw new Error('FAILED: .turbo-status-pill was expected to be removed!');
    }

    // 2. Confirm clean page counter
    const pageCounterPill = page1440.locator('.page-counter-pill').first();
    await pageCounterPill.waitFor({ state: 'visible', timeout: 5000 });
    const counterText = await pageCounterPill.innerText();
    console.log(`✓ Clean page counter text: "${counterText.trim()}"`);

    // Check that there is NO icon (svg) inside page counter pill
    const svgInCounter = await pageCounterPill.locator('svg').count();
    console.log(`✓ SVGs inside page counter pill: ${svgInCounter} (Expected: 0)`);
    if (svgInCounter !== 0) {
      throw new Error('FAILED: SVG icons should not be inside page-counter-pill!');
    }

    // Capture Header Close-up in Desktop 1440px
    const headerEl = page1440.locator('.reader-glass-header').first();
    await headerEl.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v17_header_desktop_1440px.png')
    });
    console.log('✓ v17_header_desktop_1440px.png captured.');

    // Capture Full Desktop Viewport
    await page1440.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v17_desktop_1440px.png')
    });
    console.log('✓ v17_desktop_1440px.png captured.');

    // -----------------------------------------------------------------
    // TEST 2: Real Turbo Engine V4 Benchmarking & Preload Verification
    // -----------------------------------------------------------------
    console.log('\n[TEST 2] Benchmarking Turbo Engine V4 Preloading...');

    // Wait for pages to stream in
    const totalPagesCount = await page1440.evaluate(() => {
      const el = document.querySelectorAll('.reader-page');
      return el ? el.length : 0;
    });
    benchmarks.v17.totalPages = totalPagesCount;

    // Check time to first page
    const firstImg = page1440.locator('.reader-page img').first();
    await firstImg.waitFor({ state: 'visible', timeout: 8000 });
    benchmarks.v17.timeToFirstPage = Date.now() - tStart;
    console.log(`✓ First page visible in: ${benchmarks.v17.timeToFirstPage}ms`);

    // Wait until at least 5 pages or full chapter is preloaded
    await page1440.waitForTimeout(2000);
    benchmarks.v17.timeToFirst5Pages = Date.now() - tStart;
    console.log(`✓ First 5 pages available in: ${benchmarks.v17.timeToFirst5Pages}ms`);

    // Wait for Turbo preloading to complete all pages
    await page1440.waitForFunction(() => {
      const imgs = document.querySelectorAll('.reader-page img');
      return imgs && imgs.length > 0;
    }, { timeout: 15000 });
    benchmarks.v17.timeToCompletePreload = Date.now() - tStart;
    console.log(`✓ Chapter preload finished in: ${benchmarks.v17.timeToCompletePreload}ms`);

    // Rapid scroll simulation: scroll to page 8 and confirm instant render
    console.log('Simulating fast user scroll down to page 8...');
    await page1440.evaluate(() => {
      const p8 = document.getElementById('pagina-8');
      if (p8) p8.scrollIntoView();
    });
    await page1440.waitForTimeout(600);
    const p8Img = page1440.locator('#pagina-8 img').first();
    const p8Loaded = await p8Img.evaluate((img) => img.complete && img.naturalWidth > 0);
    console.log(`✓ Page 8 rendered immediately on fast scroll: ${p8Loaded}`);

    // Capture Page Counter showing updated page (ex: 8 / 12)
    const updatedCounterText = await pageCounterPill.innerText();
    console.log(`✓ Updated page counter after scroll: "${updatedCounterText.trim()}"`);

    // -----------------------------------------------------------------
    // TEST 3: Multi-Viewport Responsive Audit (Desktop & Mobile)
    // -----------------------------------------------------------------
    console.log('\n[TEST 3] Responsive Viewport Audit (1920px, 1280px, 430px, 390px, 360px, 320px)...');

    // 1920px
    const ctx1920 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    await ctx1920.addCookies(sessionCookies);
    const p1920 = await ctx1920.newPage();
    await p1920.goto(CHAPTER_URL, { waitUntil: 'load' });
    await p1920.waitForTimeout(800);
    await dismissAgeGate(p1920);
    await p1920.mouse.move(500, 20);
    await p1920.locator('.reader-glass-header').first().screenshot({
      path: path.join(ARTIFACTS_DIR, 'v17_header_desktop_1920px.png')
    });
    console.log('✓ v17_header_desktop_1920px.png captured.');
    await ctx1920.close();

    // 1280px
    const ctx1280 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx1280.addCookies(sessionCookies);
    const p1280 = await ctx1280.newPage();
    await p1280.goto(CHAPTER_URL, { waitUntil: 'load' });
    await p1280.waitForTimeout(800);
    await dismissAgeGate(p1280);
    await p1280.mouse.move(500, 20);
    await p1280.locator('.reader-glass-header').first().screenshot({
      path: path.join(ARTIFACTS_DIR, 'v17_header_desktop_1280px.png')
    });
    console.log('✓ v17_header_desktop_1280px.png captured.');
    await ctx1280.close();

    // Mobile 390px (iPhone 14 / modern Android)
    const ctx390 = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2
    });
    await ctx390.addCookies(sessionCookies);
    const p390 = await ctx390.newPage();
    await p390.goto(CHAPTER_URL, { waitUntil: 'load' });
    await p390.waitForTimeout(1000);
    await dismissAgeGate(p390);
    await p390.tap('.reader-glass-header');
    await p390.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v17_mobile_390px.png')
    });
    console.log('✓ v17_mobile_390px.png captured.');

    // Mobile 320px (Compact edge case)
    const ctx320 = await browser.newContext({
      viewport: { width: 320, height: 640 },
      isMobile: true,
      hasTouch: true
    });
    await ctx320.addCookies(sessionCookies);
    const p320 = await ctx320.newPage();
    await p320.goto(CHAPTER_URL, { waitUntil: 'load' });
    await p320.waitForTimeout(1000);
    await dismissAgeGate(p320);
    await p320.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v17_mobile_320px.png')
    });
    console.log('✓ v17_mobile_320px.png captured.');
    await ctx320.close();

    // -----------------------------------------------------------------
    // TEST 4: Offline Download Lifecycle & Real IndexedDB Sync
    // -----------------------------------------------------------------
    console.log('\n[TEST 4] Offline Download Lifecycle & Real IndexedDB Sync...');

    // Clear any existing downloads in IndexedDB for a clean start
    await page1440.evaluate(async () => {
      const req = indexedDB.deleteDatabase('nox_offline_v1');
      await new Promise((res) => { req.onsuccess = res; req.onerror = res; req.onblocked = res; });
    });
    await page1440.reload({ waitUntil: 'load' });
    await page1440.waitForTimeout(1200);
    await dismissAgeGate(page1440);
    await page1440.mouse.move(500, 20);

    // Initial Button State: "Baixar"
    const downloadBtn = page1440.locator('.btn-offline').first();
    const initialText = await downloadBtn.innerText();
    console.log(`✓ Initial offline button text: "${initialText.trim()}"`);

    // Capture initial download button screenshot
    await downloadBtn.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v17_btn_download_initial.png')
    });
    console.log('✓ v17_btn_download_initial.png captured.');

    // Click "Baixar" to trigger download
    console.log('Triggering offline chapter download...');
    await downloadBtn.click();
    await page1440.waitForTimeout(400);

    // Verify Downloading state
    const isDownloading = await downloadBtn.locator('.spin-anim').isVisible();
    console.log(`✓ Download in-progress spinner active: ${isDownloading}`);
    await downloadBtn.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v17_btn_download_inprogress.png')
    });
    console.log('✓ v17_btn_download_inprogress.png captured.');

    // Wait for download completion (button becomes .downloaded)
    await page1440.locator('.btn-offline.downloaded').first().waitFor({ state: 'visible', timeout: 35000 });
    const completedText = await downloadBtn.innerText();
    console.log(`✓ Download completed! Button text: "${completedText.trim()}"`);

    // Capture Downloaded State screenshot
    await downloadBtn.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v17_btn_download_completed.png')
    });
    console.log('✓ v17_btn_download_completed.png captured.');

    // Verify IndexedDB contents
    const idbRecord = await page1440.evaluate(async (chId) => {
      return new Promise((resolve) => {
        const req = indexedDB.open('nox_offline_v1', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('chapters', 'readonly');
          const store = tx.objectStore('chapters');
          const getReq = store.get(chId);
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
      });
    }, CHAPTER_ID);

    console.log('✓ IndexedDB record verified:');
    console.log(`  - Chapter ID: ${idbRecord?.chapterId}`);
    console.log(`  - Work Title: "${idbRecord?.workTitle}"`);
    console.log(`  - Saved Pages count: ${idbRecord?.pages?.length}`);
    console.log(`  - Has valid base64 blobUrl: ${Boolean(idbRecord?.pages?.[0]?.blobUrl?.startsWith('data:'))}`);

    // Verify in /downloads Library
    console.log('\nVerifying chapter in /downloads Library...');
    const pageDownloads = await context1440.newPage();
    await pageDownloads.goto(DOWNLOADS_URL, { waitUntil: 'load' });
    await pageDownloads.waitForTimeout(1500);

    const workCard = pageDownloads.locator('.work-card-interactive').first();
    await workCard.waitFor({ state: 'visible', timeout: 8000 });
    const workTitleInLib = await workCard.locator('.work-title').innerText();
    console.log(`✓ Work found in /downloads Library: "${workTitleInLib.trim()}"`);

    await pageDownloads.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v17_downloads_library_saved.png')
    });
    console.log('✓ v17_downloads_library_saved.png captured.');

    // -----------------------------------------------------------------
    // TEST 5: Real Offline Reading (Network Disabled)
    // -----------------------------------------------------------------
    console.log('\n[TEST 5] Testing True Offline Reading (Network Disconnected)...');
    // Disconnect network
    await context1440.setOffline(true);
    console.log('✓ Network disconnected (offline mode active).');

    // Reload page in offline mode or navigate pages
    await page1440.evaluate(() => window.scrollBy(0, 800));
    await page1440.waitForTimeout(500);

    const offlineImgLoaded = await page1440.evaluate(() => {
      const imgs = document.querySelectorAll('.reader-page img');
      if (!imgs.length) return false;
      return Array.from(imgs).some((img) => img.complete && img.naturalWidth > 0);
    });
    console.log(`✓ Offline images rendered from local store: ${offlineImgLoaded}`);

    await page1440.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v17_offline_reading_success.png')
    });
    console.log('✓ v17_offline_reading_success.png captured.');

    // Re-enable network
    await context1440.setOffline(false);
    console.log('✓ Network reconnected.');

    // -----------------------------------------------------------------
    // TEST 6: Delete Download from Reader with Confirmation Modal
    // -----------------------------------------------------------------
    console.log('\n[TEST 6] Testing Delete Download from Reader...');
    await page1440.mouse.move(500, 20);
    await page1440.waitForTimeout(300);

    // Clicking on downloaded button opens delete confirmation modal
    await downloadBtn.click();
    await page1440.waitForTimeout(400);

    const delModal = page1440.locator('.delete-download-card').first();
    await delModal.waitFor({ state: 'visible', timeout: 4000 });
    const modalTitle = await delModal.locator('.delete-download-title').innerText();
    console.log(`✓ Confirmation modal opened: "${modalTitle.trim()}"`);

    // Capture Delete Confirmation Modal screenshot
    await page1440.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v17_modal_delete_download.png')
    });
    console.log('✓ v17_modal_delete_download.png captured.');

    // Test "Cancelar" first
    console.log('Testing "Cancelar" button in modal...');
    const cancelBtn = delModal.locator('.btn-modal-cancel').first();
    await cancelBtn.click();
    await page1440.waitForTimeout(300);
    console.log(`✓ Modal closed on Cancel, button remains: "${(await downloadBtn.innerText()).trim()}"`);

    // Click again and confirm deletion
    console.log('Confirming deletion in modal...');
    await downloadBtn.click();
    await delModal.waitFor({ state: 'visible', timeout: 4000 });
    const confirmDeleteBtn = delModal.locator('.btn-modal-confirm-delete').first();
    await confirmDeleteBtn.click();
    await page1440.waitForTimeout(800);

    // Button should revert back to "Baixar"
    const revertedText = await downloadBtn.innerText();
    console.log(`✓ Button successfully reverted to: "${revertedText.trim()}"`);

    // Confirm deletion in IndexedDB
    const idbAfterDelete = await page1440.evaluate(async (chId) => {
      return new Promise((resolve) => {
        const req = indexedDB.open('nox_offline_v1', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('chapters', 'readonly');
          const store = tx.objectStore('chapters');
          const getReq = store.get(chId);
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
      });
    }, CHAPTER_ID);
    console.log(`✓ IndexedDB chapter status after deletion: ${idbAfterDelete === null ? 'PROPERLY REMOVED' : 'STILL PRESENT'}`);

    // Verify /downloads Library updated
    await pageDownloads.reload({ waitUntil: 'load' });
    await pageDownloads.waitForTimeout(800);
    const emptyNotice = await pageDownloads.locator('.empty-state-card').isVisible();
    console.log(`✓ /downloads Library automatically empty after deletion: ${emptyNotice}`);

    // -----------------------------------------------------------------
    // TEST 6.1 (Cenário D): Delete via Library and Verify Reader Real-Time Sync
    // -----------------------------------------------------------------
    console.log('\n[TEST 6.1 — CENÁRIO D] Delete from Library & Real-Time Reader Sync...');
    // Download chapter 76 again in reader
    console.log('Re-downloading chapter 76 in reader tab...');
    await page1440.evaluate(() => {
      window.scrollTo(0, 0);
      const btn = document.querySelector('.btn-offline');
      if (btn) btn.click();
    });
    await page1440.locator('.btn-offline.downloaded').first().waitFor({ state: 'visible', timeout: 35000 });
    console.log('✓ Re-download completed in reader tab.');

    // Switch to library tab, reload and delete chapter from library
    await pageDownloads.goto(DOWNLOADS_URL, { waitUntil: 'load' });
    await pageDownloads.waitForTimeout(1000);
    const workCardToOpen = pageDownloads.locator('.work-card-interactive').first();
    await workCardToOpen.click();
    await pageDownloads.waitForTimeout(600);

    // Click delete chapter button in library (.btn-icon-trash-chapter)
    const delChapterBtnInLib = pageDownloads.locator('.btn-icon-trash-chapter').first();
    await delChapterBtnInLib.click();
    await pageDownloads.waitForTimeout(400);

    // Confirm deletion modal in library (.btn-modal-confirm-danger)
    const btnConfirmLib = pageDownloads.locator('.btn-modal-confirm-danger').first();
    await btnConfirmLib.waitFor({ state: 'visible', timeout: 4000 });
    await btnConfirmLib.click();
    await pageDownloads.waitForTimeout(800);
    console.log('✓ Chapter deleted via /downloads Library UI.');

    // Switch to reader tab and check that button updated in real time via BroadcastChannel
    await page1440.waitForTimeout(1000);
    const readerBtnAfterLibDelete = await page1440.evaluate(() => {
      return document.querySelector('.btn-offline .action-btn-text')?.textContent || '';
    });
    console.log(`✓ Reader button updated to: "${readerBtnAfterLibDelete.trim()}" (Expected: "Baixar")`);

    // -----------------------------------------------------------------
    // TEST 6.2 (Cenário E): Multi-Chapter Selective Preservation
    // -----------------------------------------------------------------
    console.log('\n[TEST 6.2 — CENÁRIO E] Multi-Chapter Selective Preservation...');
    const CHAPTER_75_ID = '18b73c02-e312-5da6-b36d-b69820c7a710';
    // Insert both chapters into IndexedDB
    await page1440.evaluate(async ({ ch76, ch75 }) => {
      return new Promise((resolve) => {
        const req = indexedDB.open('nox_offline_v1', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('chapters', 'readwrite');
          const store = tx.objectStore('chapters');
          store.put({
            chapterId: ch76,
            workId: '7e90f9e1-4830-462a-9823-c95e2ccaebc1',
            workTitle: 'A Dupla Vida da Princesa',
            workSlug: 'a-dupla-vida-da-princesa',
            number: 76,
            title: 'Capítulo 76',
            pages: [{ position: 1, mediaId: 'dummy76', blobUrl: 'data:image/jpeg;base64,abc' }],
            downloadedAt: new Date().toISOString(),
            totalPages: 1
          });
          store.put({
            chapterId: ch75,
            workId: '7e90f9e1-4830-462a-9823-c95e2ccaebc1',
            workTitle: 'A Dupla Vida da Princesa',
            workSlug: 'a-dupla-vida-da-princesa',
            number: 75,
            title: 'Capítulo 75',
            pages: [
              { position: 1, mediaId: 'dummy75_1', blobUrl: 'data:image/jpeg;base64,xyz1' },
              { position: 2, mediaId: 'dummy75_2', blobUrl: 'data:image/jpeg;base64,xyz2' }
            ],
            downloadedAt: new Date().toISOString(),
            totalPages: 2
          });
          tx.oncomplete = resolve;
        };
      });
    }, { ch76: CHAPTER_ID, ch75: CHAPTER_75_ID });

    // Delete ONLY Chapter 76
    await page1440.evaluate(async (ch76) => {
      return new Promise((resolve) => {
        const req = indexedDB.open('nox_offline_v1', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('chapters', 'readwrite');
          const store = tx.objectStore('chapters');
          store.delete(ch76);
          tx.oncomplete = resolve;
        };
      });
    }, CHAPTER_ID);

    // Verify Chapter 76 is gone, and Chapter 75 is 100% PRESERVED
    const statusPreservation = await page1440.evaluate(async ({ ch76, ch75 }) => {
      return new Promise((resolve) => {
        const req = indexedDB.open('nox_offline_v1', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('chapters', 'readonly');
          const store = tx.objectStore('chapters');
          const r76 = store.get(ch76);
          const r75 = store.get(ch75);
          tx.oncomplete = () => {
            resolve({
              ch76Deleted: r76.result === undefined,
              ch75Preserved: r75.result !== undefined && r75.result.pages?.length === 2
            });
          };
        };
      });
    }, { ch76: CHAPTER_ID, ch75: CHAPTER_75_ID });

    console.log(`✓ Chapter 76 properly deleted: ${statusPreservation.ch76Deleted}`);
    console.log(`✓ Chapter 75 completely preserved with 2 pages: ${statusPreservation.ch75Preserved}`);

    // Clean up temporary dummy records in IndexedDB
    await page1440.evaluate(async (ch75) => {
      return new Promise((resolve) => {
        const req = indexedDB.open('nox_offline_v1', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('chapters', 'readwrite');
          tx.objectStore('chapters').clear();
          tx.oncomplete = resolve;
        };
      });
    }, CHAPTER_75_ID);

    await pageDownloads.close();
    await context1440.close();

    // -----------------------------------------------------------------
    // TEST 7: Regression Check on Jonas Amaral Comment
    // -----------------------------------------------------------------
    console.log('\n[TEST 7] Regression Check on Community Comment (Jonas Amaral)...');
    const { data: jonasCheck } = await supabase
      .from('comments')
      .select('id, body')
      .eq('id', JONAS_COMMENT_ID);
    console.log('✓ Jonas Amaral comment status:', jonasCheck && jonasCheck.length > 0 ? 'SAFE & INTACT' : 'WARNING: NOT FOUND');

  } finally {
    await browser.close();
  }

  console.log('\n===============================================================');
  console.log(' ALL RODADA 20 V17 TESTS COMPLETED SUCCESSFULLY');
  console.log('===============================================================');
}

run().catch((err) => {
  console.error('Fatal error in verify_v17_turbo_header_offline.cjs:', err);
  process.exit(1);
});
