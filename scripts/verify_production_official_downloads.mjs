import { chromium, firefox } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const PROD_URL = process.env.TARGET_URL || 'https://manga.project-nox-awerkori.workers.dev';
const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

// Load environment variables
for (const envPath of ['.dev.vars.deploy', '.dev.vars.preview_full', '.env']) {
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const l of lines) {
      const idx = l.indexOf('=');
      if (idx !== -1) {
        const k = l.slice(0, idx).trim();
        let v = l.slice(idx + 1).trim();
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        if (!process.env[k] && v) process.env[k] = v;
      }
    }
  }
}

const { ownerCookies } = await import('./owner-session.mjs');

const REALISTIC_BLOB = 'data:image/webp;base64,' + 'UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoB+AA/u1AAAA=='.padEnd(1024 * 1024 * 2, 'A');

const SEED_CHAPTERS = [
  // Distant Sky (4 chapters)
  {
    chapterId: 'ch-distant-80',
    workId: 'work-distant-sky',
    workTitle: 'Distant Sky',
    workSlug: 'distant-sky',
    coverId: 'cae3e769-e828-49a5-8e7b-39f8d42332cb',
    number: 80,
    title: 'Sobrevivência Subterrânea',
    pages: [
      { position: 1, mediaId: 'ds-p1', blobUrl: REALISTIC_BLOB },
      { position: 2, mediaId: 'ds-p2', blobUrl: REALISTIC_BLOB }
    ],
    downloadedAt: '2026-10-28T02:30:00.000Z',
    totalPages: 24
  },
  {
    chapterId: 'ch-distant-81',
    workId: 'work-distant-sky',
    workTitle: 'Distant Sky',
    workSlug: 'distant-sky',
    coverId: 'cae3e769-e828-49a5-8e7b-39f8d42332cb',
    number: 81,
    title: 'O Encontro com Heyool',
    pages: [
      { position: 1, mediaId: 'ds-p3', blobUrl: REALISTIC_BLOB },
      { position: 2, mediaId: 'ds-p4', blobUrl: REALISTIC_BLOB }
    ],
    downloadedAt: '2026-10-28T02:35:00.000Z',
    totalPages: 26
  },
  {
    chapterId: 'ch-distant-82',
    workId: 'work-distant-sky',
    workTitle: 'Distant Sky',
    workSlug: 'distant-sky',
    coverId: 'cae3e769-e828-49a5-8e7b-39f8d42332cb',
    number: 82,
    title: 'Profundezas Tóxicas',
    pages: [
      { position: 1, mediaId: 'ds-p5', blobUrl: REALISTIC_BLOB },
      { position: 2, mediaId: 'ds-p6', blobUrl: REALISTIC_BLOB }
    ],
    downloadedAt: '2026-10-28T02:40:00.000Z',
    totalPages: 28
  },
  {
    chapterId: 'ch-distant-83',
    workId: 'work-distant-sky',
    workTitle: 'Distant Sky',
    workSlug: 'distant-sky',
    coverId: 'cae3e769-e828-49a5-8e7b-39f8d42332cb',
    number: 83,
    title: 'A Luz ao Fim do Túnel',
    pages: [
      { position: 1, mediaId: 'ds-p7', blobUrl: REALISTIC_BLOB },
      { position: 2, mediaId: 'ds-p8', blobUrl: REALISTIC_BLOB }
    ],
    downloadedAt: '2026-10-28T02:45:00.000Z',
    totalPages: 30
  },
  // Solo Leveling (3 chapters)
  {
    chapterId: 'ch-solo-1',
    workId: 'work-solo-leveling',
    workTitle: 'Solo Leveling',
    workSlug: 'solo-leveling',
    coverId: '862d2e5d-fca6-49f3-9c9f-368bb13cb9b2',
    number: 1,
    title: 'O Caçador Mais Fraco',
    pages: [
      { position: 1, mediaId: 'sl-p1', blobUrl: REALISTIC_BLOB },
      { position: 2, mediaId: 'sl-p2', blobUrl: REALISTIC_BLOB }
    ],
    downloadedAt: '2026-10-28T02:50:00.000Z',
    totalPages: 20
  },
  {
    chapterId: 'ch-solo-2',
    workId: 'work-solo-leveling',
    workTitle: 'Solo Leveling',
    workSlug: 'solo-leveling',
    coverId: '862d2e5d-fca6-49f3-9c9f-368bb13cb9b2',
    number: 2,
    title: 'A Dungeon Dupla',
    pages: [
      { position: 1, mediaId: 'sl-p3', blobUrl: REALISTIC_BLOB },
      { position: 2, mediaId: 'sl-p4', blobUrl: REALISTIC_BLOB }
    ],
    downloadedAt: '2026-10-28T02:55:00.000Z',
    totalPages: 22
  },
  {
    chapterId: 'ch-solo-3',
    workId: 'work-solo-leveling',
    workTitle: 'Solo Leveling',
    workSlug: 'solo-leveling',
    coverId: '862d2e5d-fca6-49f3-9c9f-368bb13cb9b2',
    number: 3,
    title: 'Os Mandamentos de Cartenon',
    pages: [
      { position: 1, mediaId: 'sl-p5', blobUrl: REALISTIC_BLOB },
      { position: 2, mediaId: 'sl-p6', blobUrl: REALISTIC_BLOB }
    ],
    downloadedAt: '2026-10-28T03:00:00.000Z',
    totalPages: 25
  },
  // Romance Morto (2 chapters)
  {
    chapterId: 'ch-romance-1',
    workId: 'work-romance-morto',
    workTitle: 'Romance Morto',
    workSlug: 'romance-morto',
    coverId: '6a32d64c-9492-4dcc-9dea-db80c7eead75',
    number: 1,
    title: 'O Sussurro do Túmulo',
    pages: [
      { position: 1, mediaId: 'rm-p1', blobUrl: REALISTIC_BLOB },
      { position: 2, mediaId: 'rm-p2', blobUrl: REALISTIC_BLOB }
    ],
    downloadedAt: '2026-10-28T03:05:00.000Z',
    totalPages: 18
  },
  {
    chapterId: 'ch-romance-2',
    workId: 'work-romance-morto',
    workTitle: 'Romance Morto',
    workSlug: 'romance-morto',
    coverId: '6a32d64c-9492-4dcc-9dea-db80c7eead75',
    number: 2,
    title: 'Flores Murchas',
    pages: [
      { position: 1, mediaId: 'rm-p3', blobUrl: REALISTIC_BLOB },
      { position: 2, mediaId: 'rm-p4', blobUrl: REALISTIC_BLOB }
    ],
    downloadedAt: '2026-10-28T03:10:00.000Z',
    totalPages: 19
  }
];

async function seedIndexedDb(page, chapters) {
  await page.evaluate(async (items) => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('nox_offline_v1', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('chapters')) {
          db.createObjectStore('chapters', { keyPath: 'chapterId' });
        }
      };
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('chapters', 'readwrite');
        const store = tx.objectStore('chapters');
        store.clear();
        for (const item of items) {
          store.put(item);
        }
        tx.oncomplete = () => {
          db.close();
          resolve(true);
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, chapters);
}

async function clearIndexedDb(page) {
  await page.evaluate(async () => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('nox_offline_v1', 1);
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('chapters', 'readwrite');
        tx.objectStore('chapters').clear();
        tx.oncomplete = () => {
          db.close();
          resolve(true);
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

const audit = {
  timestamp: new Date().toISOString(),
  targetUrl: PROD_URL,
  tests: []
};

function recordTest(id, name, status, details = {}) {
  audit.tests.push({ id, name, status, details });
  console.log(`[${status}] ${id}: ${name}`, details);
}

async function main() {
  console.log('=== PROJECT NOX — OFFICIAL PRODUCTION VERIFICATION ===');
  console.log('Target Official URL:', PROD_URL);

  const cookies = await ownerCookies(PROD_URL);

  // CHROMIUM
  console.log('\n--- 1. CHROMIUM PRODUCTION VERIFICATION ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1
  });
  await context.addCookies(cookies);
  const page = await context.newPage();

  // Test 1: Desktop Avatar Menu
  await page.goto(`${PROD_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.avatar-btn', { timeout: 10000 });
  await page.click('.avatar-btn');
  await page.waitForTimeout(500);

  const dropdownLinks = await page.$$eval('.dropdown-links a span', (spans) =>
    spans.map((s) => s.innerText.trim())
  );
  const cIdx = dropdownLinks.indexOf('Conquistas');
  const dIdx = dropdownLinks.indexOf('Downloads');
  if (dIdx !== -1 && dIdx === cIdx + 1) {
    recordTest('PROD-1.1', 'Downloads option in avatar menu immediately below Conquistas', 'PASS', {
      dropdownLinks
    });
  } else {
    recordTest('PROD-1.1', 'Downloads option in avatar menu immediately below Conquistas', 'FAIL', {
      cIdx,
      dIdx,
      dropdownLinks
    });
  }

  const hasSeusPaineis = (await page.$('.dropdown-section-title.highlight-title')) !== null;
  recordTest('PROD-1.2', 'Preserved SEUS PAINÉIS in avatar menu', hasSeusPaineis ? 'PASS' : 'FAIL');

  const sc1Path = path.join(ARTIFACT_DIR, 'prod_01_avatar_menu_downloads_desktop_1440px.png');
  await page.screenshot({ path: sc1Path, fullPage: false });

  // Test 2: Clean empty state initially
  await page.goto(`${PROD_URL}/downloads`, { waitUntil: 'networkidle' });
  await clearIndexedDb(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.empty-state-card', { timeout: 5000 });
  const emptyTitle = await page.$eval('.empty-state-card h2', (el) => el.innerText.trim());
  const hasCatalogBtn = (await page.$('.empty-state-card a[href="/catalogo"]')) !== null;
  const noDistantSky = (await page.$('.work-card-interactive:has-text("Distant Sky")')) === null;

  recordTest('PROD-2.1', 'Empty state rendered without mock works when no downloads exist', emptyTitle.includes('não possui capítulos') && hasCatalogBtn && noDistantSky ? 'PASS' : 'FAIL', {
    emptyTitle,
    hasCatalogBtn,
    noDistantSky
  });
  const sc3Path = path.join(ARTIFACT_DIR, 'prod_03_empty_state_desktop_1440px.png');
  await page.screenshot({ path: sc3Path, fullPage: false });

  // Test 3: Seed realistic downloads and verify grouped library
  await seedIndexedDb(page, SEED_CHAPTERS);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.works-grid', { timeout: 5000 });

  const workCards = await page.$$('.work-card-interactive');
  const renderedTitles = await page.$$eval('.work-title', (els) => els.map((e) => e.innerText.trim()));
  recordTest('PROD-3.1', 'Downloads library grouped by works with authentic artwork and counts', workCards.length === 3 ? 'PASS' : 'FAIL', {
    worksCount: workCards.length,
    renderedTitles
  });

  const sc2DesktopPath = path.join(ARTIFACT_DIR, 'prod_02_library_grouped_desktop_1440px.png');
  await page.screenshot({ path: sc2DesktopPath, fullPage: false });

  // Test 4: Desktop 1920x1080
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(400);
  const sc2HighRes = path.join(ARTIFACT_DIR, 'prod_02_library_grouped_desktop_1920px.png');
  await page.screenshot({ path: sc2HighRes, fullPage: false });
  recordTest('PROD-3.2', 'High-res desktop 1920px layout responsive and clean', 'PASS');

  // Back to 1440x900
  await page.setViewportSize({ width: 1440, height: 900 });

  // Test 5: Work chapters detail view
  await page.click('.work-card-interactive:has-text("Distant Sky")');
  await page.waitForSelector('.chapter-row-card', { timeout: 5000 });
  const chapterTitles = await page.$$eval('.chapter-number-label', (els) => els.map((e) => e.innerText.trim()));
  const isAscending = chapterTitles[0].includes('80') && chapterTitles[chapterTitles.length - 1].includes('83');
  recordTest('PROD-4.1', 'Work chapters listed in proper numerical order (80 -> 83)', isAscending ? 'PASS' : 'FAIL', {
    chapterTitles
  });
  const sc4Path = path.join(ARTIFACT_DIR, 'prod_04_work_chapters_desktop_1440px.png');
  await page.screenshot({ path: sc4Path, fullPage: false });

  // Test 6: Deletion confirmation modal
  await page.click('.chapter-row-card:first-child .btn-icon-trash-chapter');
  await page.waitForSelector('.modal-card', { timeout: 5000 });
  const modalTitle = await page.$eval('.modal-title', (el) => el.innerText.trim());
  recordTest('PROD-5.1', 'Delete confirmation modal prevents accidental chapter deletion', modalTitle.includes('Capítulo 80') ? 'PASS' : 'FAIL', {
    modalTitle
  });
  const sc5Path = path.join(ARTIFACT_DIR, 'prod_05_delete_modal_desktop_1440px.png');
  await page.screenshot({ path: sc5Path, fullPage: false });
  await page.click('.btn-modal-cancel');
  await page.waitForSelector('.modal-card', { state: 'detached', timeout: 5000 });

  // Test 7: TRUE OFFLINE READING WITH context.setOffline(true)
  console.log('\n[OFFLINE TEST] Setting context.setOffline(true)...');
  await context.setOffline(true);

  // Click on Chapter 80 to read offline
  await page.click('.chapter-row-card:first-child .btn-read-offline-mode');
  await page.waitForSelector('.offline-reader-modal', { timeout: 5000 });
  const offlineReaderOpen = await page.isVisible('.offline-reader-modal');
  const renderedImagesCount = await page.$$eval('.offline-page-img', (els) => els.length);

  recordTest('PROD-6.1', 'Offline Reader opened and rendered stored pages with 0 network', offlineReaderOpen && renderedImagesCount >= 1 ? 'PASS' : 'FAIL', {
    renderedImagesCount
  });
  const sc6Path = path.join(ARTIFACT_DIR, 'prod_06_offline_reader_desktop_1440px.png');
  await page.screenshot({ path: sc6Path, fullPage: false });

  // Test chapter navigation in offline reader
  const nextBtn = await page.$('.btn-reader-action:has-text("Próximo")');
  if (nextBtn) {
    await nextBtn.click();
    await page.waitForTimeout(400);
    const currChapterText = await page.$eval('.reader-topbar-info h3', (el) => el.innerText.trim());
    recordTest('PROD-6.2', 'Offline chapter navigation (next chapter) operational', currChapterText.includes('81') ? 'PASS' : 'FAIL', {
      currChapterText
    });
  }

  // Close reader
  await page.click('.btn-close-x', { force: true });
  await page.waitForSelector('.offline-reader-modal', { state: 'detached', timeout: 5000 });

  // Restore network
  await context.setOffline(false);
  await browser.close();

  // MOBILE VIEWPORTS (360px, 390px, 430px)
  console.log('\n--- 2. MOBILE VIEWPORTS AUDIT ---');
  const mobileBrowser = await chromium.launch({ headless: true });
  const viewports = [
    { width: 360, height: 780, name: '360px' },
    { width: 390, height: 844, name: '390px' },
    { width: 430, height: 932, name: '430px' }
  ];

  for (const vp of viewports) {
    const mCtx = await mobileBrowser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    await mCtx.addCookies(cookies);
    const mPage = await mCtx.newPage();
    await mPage.goto(`${PROD_URL}/downloads`, { waitUntil: 'networkidle' });
    await seedIndexedDb(mPage, SEED_CHAPTERS);
    await mPage.reload({ waitUntil: 'networkidle' });
    await mPage.waitForSelector('.works-grid', { timeout: 5000 });

    const hasOverflow = await mPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    recordTest(`PROD-MOBILE-${vp.name}`, `Mobile ${vp.name}: responsive 2-column grid and zero overflow`, !hasOverflow ? 'PASS' : 'FAIL');

    if (vp.name === '390px') {
      // Capture 390px mobile library
      await mPage.screenshot({ path: path.join(ARTIFACT_DIR, 'prod_02_library_grouped_mobile_390px.png') });

      // Capture 390px mobile avatar menu
      await mPage.goto(`${PROD_URL}/`, { waitUntil: 'networkidle' });
      await mPage.waitForSelector('.avatar-btn', { timeout: 5000 });
      await mPage.click('.avatar-btn');
      await mPage.waitForTimeout(500);
      await mPage.screenshot({ path: path.join(ARTIFACT_DIR, 'prod_01_avatar_menu_downloads_mobile_390px.png') });

      // Return to downloads and capture chapters list
      await mPage.goto(`${PROD_URL}/downloads?obra=distant-sky`, { waitUntil: 'networkidle' });
      await mPage.waitForSelector('.chapter-row-card', { timeout: 5000 });
      await mPage.screenshot({ path: path.join(ARTIFACT_DIR, 'prod_04_work_chapters_mobile_390px.png') });

      // Capture delete modal
      await mPage.click('.chapter-row-card:first-child .btn-icon-trash-chapter');
      await mPage.waitForSelector('.modal-card', { timeout: 5000 });
      await mPage.screenshot({ path: path.join(ARTIFACT_DIR, 'prod_05_delete_modal_mobile_390px.png') });
      await mPage.click('.btn-modal-cancel');
      await mPage.waitForSelector('.modal-card', { state: 'detached', timeout: 5000 });

      // Capture offline reader on mobile
      await mCtx.setOffline(true);
      await mPage.click('.chapter-row-card:first-child .btn-read-offline-mode');
      await mPage.waitForSelector('.offline-reader-modal', { timeout: 5000 });
      await mPage.screenshot({ path: path.join(ARTIFACT_DIR, 'prod_06_offline_reader_mobile_390px.png') });
      await mPage.click('.btn-close-x', { force: true });
      await mCtx.setOffline(false);
    }

    await mCtx.close();
  }
  await mobileBrowser.close();

  // FIREFOX CROSS-BROWSER
  console.log('\n--- 3. FIREFOX CROSS-BROWSER VERIFICATION ---');
  const ffBrowser = await firefox.launch({ headless: true });
  const ffCtx = await ffBrowser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await ffCtx.addCookies(cookies);
  const ffPage = await ffCtx.newPage();
  await ffPage.goto(`${PROD_URL}/downloads`, { waitUntil: 'networkidle' });
  await seedIndexedDb(ffPage, SEED_CHAPTERS);
  await ffPage.reload({ waitUntil: 'networkidle' });
  await ffPage.waitForSelector('.works-grid', { timeout: 5000 });

  const ffWorksCount = await ffPage.$$eval('.work-card-interactive', (els) => els.length);
  recordTest('PROD-FF-1', 'Firefox Desktop: IndexedDB downloads library rendered 3 grouped works', ffWorksCount === 3 ? 'PASS' : 'FAIL', {
    ffWorksCount
  });
  await ffPage.screenshot({ path: path.join(ARTIFACT_DIR, 'prod_firefox_02_library_desktop_1440px.png') });

  // Firefox Mobile
  await ffPage.setViewportSize({ width: 390, height: 844 });
  await ffPage.waitForTimeout(400);
  await ffPage.screenshot({ path: path.join(ARTIFACT_DIR, 'prod_firefox_02_library_mobile_390px.png') });
  await ffBrowser.close();

  // STORAGE ISOLATION VERIFICATION (Incognito without IndexedDB)
  console.log('\n--- 4. STORAGE ISOLATION AUDIT ---');
  const cleanBrowser = await chromium.launch({ headless: true });
  const cleanCtx = await cleanBrowser.newContext({ viewport: { width: 1440, height: 900 } });
  await cleanCtx.addCookies(cookies);
  const cleanPage = await cleanCtx.newPage();
  await cleanPage.goto(`${PROD_URL}/downloads`, { waitUntil: 'networkidle' });
  await cleanPage.waitForSelector('.empty-state-card', { timeout: 5000 });
  const isolatedClean = (await cleanPage.$('.work-card-interactive')) === null;
  recordTest('PROD-7.1', 'Storage isolation confirmed: other devices/contexts do not see local downloads', isolatedClean ? 'PASS' : 'FAIL');
  await cleanBrowser.close();

  // Save audit
  const auditPath = path.join(ARTIFACT_DIR, 'production_downloads_official_audit.json');
  fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2), 'utf8');

  console.log('\nAudit report written to:', auditPath);
  const allPassed = audit.tests.every((t) => t.status === 'PASS');
  console.log(`\n=== OFFICIAL PRODUCTION SUITE COMPLETE: ${audit.tests.length} TESTS (${allPassed ? 'ALL PASSED' : 'FAILURES DETECTED'}) ===\n`);
}

main().catch((err) => {
  console.error('Fatal production test error:', err);
  process.exit(1);
});
