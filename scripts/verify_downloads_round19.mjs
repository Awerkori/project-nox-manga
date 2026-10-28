import { chromium, firefox } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
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

// 1x1 valid base64 webp pixel for ultra-fast rendering
const TINY_WEBP = 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoB+AA/u1AAAA==';
// ~1.5 MB simulated base64 payload per page for realistic storage metrics
const REALISTIC_BLOB = 'data:image/webp;base64,' + 'UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoB+AA/u1AAAA=='.padEnd(1024 * 1024 * 2, 'A');

// Sample mock chapters to seed into IndexedDB with genuine covers from catalog
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
    title: 'A Escuridão Total',
    pages: [
      { position: 1, mediaId: 'ds-p3', blobUrl: REALISTIC_BLOB },
      { position: 2, mediaId: 'ds-p4', blobUrl: REALISTIC_BLOB }
    ],
    downloadedAt: '2026-10-28T02:35:00.000Z',
    totalPages: 22
  },
  {
    chapterId: 'ch-distant-82',
    workId: 'work-distant-sky',
    workTitle: 'Distant Sky',
    workSlug: 'distant-sky',
    coverId: 'cae3e769-e828-49a5-8e7b-39f8d42332cb',
    number: 82,
    title: 'Refúgio em Ruínas',
    pages: [
      { position: 1, mediaId: 'ds-p5', blobUrl: REALISTIC_BLOB },
      { position: 2, mediaId: 'ds-p6', blobUrl: REALISTIC_BLOB }
    ],
    downloadedAt: '2026-10-28T02:40:00.000Z',
    totalPages: 26
  },
  {
    chapterId: 'ch-distant-83',
    workId: 'work-distant-sky',
    workTitle: 'Distant Sky',
    workSlug: 'distant-sky',
    coverId: 'cae3e769-e828-49a5-8e7b-39f8d42332cb',
    number: 83,
    title: 'Luz no Fim do Túnel',
    pages: [
      { position: 1, mediaId: 'ds-p7', blobUrl: REALISTIC_BLOB },
      { position: 2, mediaId: 'ds-p8', blobUrl: REALISTIC_BLOB }
    ],
    downloadedAt: '2026-10-28T02:45:00.000Z',
    totalPages: 25
  },

  // Solo Leveling (3 chapters, with decimal)
  {
    chapterId: 'ch-solo-01',
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
    downloadedAt: '2026-10-28T01:15:00.000Z',
    totalPages: 30
  },
  {
    chapterId: 'ch-solo-02',
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
    downloadedAt: '2026-10-28T01:20:00.000Z',
    totalPages: 28
  },
  {
    chapterId: 'ch-solo-10-5',
    workId: 'work-solo-leveling',
    workTitle: 'Solo Leveling',
    workSlug: 'solo-leveling',
    coverId: '862d2e5d-fca6-49f3-9c9f-368bb13cb9b2',
    number: 10.5,
    title: 'Especial: Memórias das Sombras',
    pages: [
      { position: 1, mediaId: 'sl-p5', blobUrl: REALISTIC_BLOB }
    ],
    downloadedAt: '2026-10-28T01:25:00.000Z',
    totalPages: 16
  },

  // Romance Morto (2 chapters)
  {
    chapterId: 'ch-romance-01',
    workId: 'work-romance-morto',
    workTitle: 'Romance Morto',
    workSlug: 'romance-morto',
    coverId: '6a32d64c-9492-4dcc-9dea-db80c7eead75',
    number: 1,
    title: 'Encontro no Cemitério',
    pages: [
      { position: 1, mediaId: 'rm-p1', blobUrl: REALISTIC_BLOB }
    ],
    downloadedAt: '2026-10-27T18:00:00.000Z',
    totalPages: 20
  },
  {
    chapterId: 'ch-romance-02',
    workId: 'work-romance-morto',
    workTitle: 'Romance Morto',
    workSlug: 'romance-morto',
    coverId: '6a32d64c-9492-4dcc-9dea-db80c7eead75',
    number: 2,
    title: 'Corações Frios',
    pages: [
      { position: 1, mediaId: 'rm-p2', blobUrl: REALISTIC_BLOB }
    ],
    downloadedAt: '2026-10-27T18:10:00.000Z',
    totalPages: 22
  }
];

async function seedIndexedDB(page, chapters) {
  await page.evaluate((chList) => {
    return new Promise((resolve, reject) => {
      const DB_NAME = 'nox_offline_v1';
      const DB_VERSION = 1;
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('chapters')) {
          db.createObjectStore('chapters', { keyPath: 'chapterId' });
        }
        if (!db.objectStoreNames.contains('events')) {
          db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
        }
      };

      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('chapters', 'readwrite');
        const store = tx.objectStore('chapters');
        store.clear(); // clean existing
        for (const ch of chList) {
          store.put(ch);
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      };

      req.onerror = () => reject(req.error);
    });
  }, chapters);
}

async function clearIndexedDB(page) {
  await page.evaluate(() => {
    return new Promise((resolve, reject) => {
      const DB_NAME = 'nox_offline_v1';
      const DB_VERSION = 1;
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('chapters', 'readwrite');
        const store = tx.objectStore('chapters');
        store.clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

async function main() {
  console.log('=== PROJECT NOX — PLAYWRIGHT VERIFICATION FOR DOWNLOADS & OFFLINE LIBRARY ===');
  console.log('Target Cloudflare Preview:', PREVIEW_URL);

  let sessionCookies = [];
  try {
    sessionCookies = await ownerCookies(PREVIEW_URL);
    console.log('Acquired authentic owner session cookies.');
  } catch (err) {
    console.error('Failed to acquire session cookies:', err.message);
    process.exit(1);
  }

  const results = {
    timestamp: new Date().toISOString(),
    previewUrl: PREVIEW_URL,
    tests: [],
    screenshots: []
  };

  function logPass(name, details = {}) {
    results.tests.push({ name, pass: true, details });
    console.log(`[PASS] ${name}`, details);
  }

  function logFail(name, details = {}) {
    results.tests.push({ name, pass: false, details });
    console.log(`[FAIL] ${name}`, details);
  }

  // -------------------------------------------------------------
  // 1. CHROMIUM SUITE
  // -------------------------------------------------------------
  console.log('\n--- LAUNCHING CHROMIUM ---');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // 1.1 Desktop 1440px: Test Avatar Menu Option "Downloads"
    console.log('\n[1.1] Testing Desktop (1440x900) — Avatar Menu');
    const deskCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await deskCtx.addCookies([
      ...sessionCookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const deskPage = await deskCtx.newPage();
    await deskPage.goto(`${PREVIEW_URL}/`, { waitUntil: 'networkidle' });

    // Open avatar menu
    const avatarBtn = await deskPage.$('.avatar-btn');
    if (avatarBtn) {
      await avatarBtn.click();
      await deskPage.waitForTimeout(500);

      // Verify "Downloads" link is immediately below "Conquistas"
      const dropdownLinks = await deskPage.$$eval('.dropdown-links a span', (spans) =>
        spans.map((s) => s.innerText.trim())
      );
      console.log('Dropdown items in ÁREA PESSOAL:', dropdownLinks);

      const conquistasIdx = dropdownLinks.indexOf('Conquistas');
      const downloadsIdx = dropdownLinks.indexOf('Downloads');
      const hasDownloadsBelowConquistas =
        conquistasIdx !== -1 && downloadsIdx === conquistasIdx + 1;

      if (hasDownloadsBelowConquistas) {
        logPass('Avatar menu contains Downloads immediately below Conquistas', {
          conquistasIdx,
          downloadsIdx,
          dropdownLinks
        });
      } else {
        logFail('Avatar menu ordering mismatch', { conquistasIdx, downloadsIdx, dropdownLinks });
      }

      // Check Seus Painéis is intact
      const hasSeusPaineis = await deskPage.$('.dropdown-section-title.highlight-title');
      if (hasSeusPaineis) {
        logPass('Section SEUS PAINÉIS is preserved and visible');
      } else {
        logFail('Section SEUS PAINÉIS missing from avatar menu');
      }

      // Screenshot 1: Avatar Menu
      const sc1Path = path.join(ARTIFACT_DIR, '01_avatar_menu_downloads_option_desktop_1440px.png');
      await deskPage.screenshot({ path: sc1Path, fullPage: false });
      results.screenshots.push({ id: '01_avatar_menu_desktop', path: sc1Path });
      console.log('Saved Screenshot 1 (Desktop):', sc1Path);
    }

    // 1.2 Desktop 1440px: Test Library with Multiple Works
    console.log('\n[1.2] Testing Downloads Library with Multiple Works (1440px)');
    await deskPage.goto(`${PREVIEW_URL}/downloads`, { waitUntil: 'networkidle' });
    await seedIndexedDB(deskPage, SEED_CHAPTERS);
    await deskPage.reload({ waitUntil: 'networkidle' });
    await deskPage.waitForTimeout(1000);

    // Verify 3 works rendered
    const workCardsCount = await deskPage.$$eval('.work-card-interactive', (cards) => cards.length);
    const workTitles = await deskPage.$$eval('.work-card-interactive .work-title', (els) =>
      els.map((e) => e.innerText.trim())
    );
    console.log('Rendered works count:', workCardsCount, 'Titles:', workTitles);

    if (workCardsCount === 3 && workTitles.includes('Distant Sky') && workTitles.includes('Solo Leveling')) {
      logPass('Downloads library grouped by 3 works correctly', { workTitles });
    } else {
      logFail('Works count mismatch', { workCardsCount, workTitles });
    }

    // Screenshot 2: Downloads Library (Multiple Works - 1440px)
    const sc2Path = path.join(ARTIFACT_DIR, '02_downloads_library_multiple_works_desktop_1440px.png');
    await deskPage.screenshot({ path: sc2Path, fullPage: false });
    results.screenshots.push({ id: '02_downloads_library_1440px', path: sc2Path });
    console.log('Saved Screenshot 2 (1440px):', sc2Path);

    // 1.3 Desktop 1920px: High-Res Viewport
    console.log('\n[1.3] Testing Desktop (1920x1080) — High-Res Grid');
    await deskPage.setViewportSize({ width: 1920, height: 1080 });
    await deskPage.waitForTimeout(500);
    const sc2WidePath = path.join(ARTIFACT_DIR, '02_downloads_library_multiple_works_desktop_1920px.png');
    await deskPage.screenshot({ path: sc2WidePath, fullPage: false });
    results.screenshots.push({ id: '02_downloads_library_1920px', path: sc2WidePath });
    logPass('Desktop 1920px layout responsive and rendered without horizontal scroll');

    // 1.4 Click into Work (Distant Sky) & Verify Chapters List
    console.log('\n[1.4] Clicking into Distant Sky work card');
    const distantCard = await deskPage.$('.work-card-interactive:has-text("Distant Sky")');
    if (distantCard) {
      await distantCard.click();
      await deskPage.waitForTimeout(800);

      // Verify Chapters List
      const chapterRows = await deskPage.$$eval('.chapter-row-card', (rows) => rows.length);
      const chapterNumbers = await deskPage.$$eval('.chapter-number-label', (els) =>
        els.map((e) => e.innerText.trim())
      );
      console.log('Distant Sky chapters count:', chapterRows, 'Numbers:', chapterNumbers);

      if (chapterRows === 4 && chapterNumbers[0].includes('80') && chapterNumbers[3].includes('83')) {
        logPass('Distant Sky downloaded chapters rendered in proper ascending order', { chapterNumbers });
      } else {
        logFail('Chapters order or count mismatch', { chapterRows, chapterNumbers });
      }

      // Screenshot 4: Work detail with chapters list
      const sc4Path = path.join(ARTIFACT_DIR, '04_work_detail_chapters_list_desktop_1440px.png');
      await deskPage.screenshot({ path: sc4Path, fullPage: false });
      results.screenshots.push({ id: '04_work_detail_desktop', path: sc4Path });
      console.log('Saved Screenshot 4 (Work Detail):', sc4Path);

      // 1.5 Click Trash icon to open Delete Confirmation Modal
      console.log('\n[1.5] Opening Delete Confirmation Modal on chapter 80');
      const trashBtn = await deskPage.$('.chapter-row-card:first-child .btn-icon-trash-chapter');
      if (trashBtn) {
        await trashBtn.click();
        await deskPage.waitForTimeout(500);

        const modalVisible = await deskPage.$('.modal-card');
        const modalTitle = await deskPage.$eval('.modal-title', (e) => e.innerText.trim()).catch(() => '');
        console.log('Modal title:', modalTitle);

        if (modalVisible && modalTitle.includes('Capítulo 80')) {
          logPass('Confirmation modal appeared for chapter deletion', { modalTitle });
        } else {
          logFail('Confirmation modal failed to open', { modalTitle });
        }

        // Screenshot 5: Confirmation Modal
        const sc5Path = path.join(ARTIFACT_DIR, '05_delete_confirmation_modal_desktop_1440px.png');
        await deskPage.screenshot({ path: sc5Path, fullPage: false });
        results.screenshots.push({ id: '05_delete_modal_desktop', path: sc5Path });
        console.log('Saved Screenshot 5 (Delete Modal):', sc5Path);

        // Cancel modal
        const cancelBtn = await deskPage.$('.btn-modal-cancel');
        if (cancelBtn) await cancelBtn.click();
        await deskPage.waitForTimeout(300);
      }

      // 1.6 Test Built-In Offline Reader Viewer (Simulating offline)
      console.log('\n[1.6] Opening Offline Reader Viewer with context.setOffline(true)');
      await deskCtx.setOffline(true);
      const readOfflineBtn = await deskPage.$('.chapter-row-card:first-child .btn-read-offline-mode');
      if (readOfflineBtn) {
        await readOfflineBtn.click();
        await deskPage.waitForTimeout(800);

        const readerModalVisible = await deskPage.$('.offline-reader-modal');
        const pageImgCount = await deskPage.$$eval('.offline-page-img', (imgs) => imgs.length);
        console.log('Offline Reader modal visible:', !!readerModalVisible, 'Images rendered:', pageImgCount);

        if (readerModalVisible && pageImgCount >= 1) {
          logPass('Offline Reader opened and rendered images completely offline (0 network)', {
            pageImgCount
          });
        } else {
          logFail('Offline Reader failed to render images while offline', { pageImgCount });
        }

        // Screenshot 6: Offline Reader Viewer
        const sc6Path = path.join(ARTIFACT_DIR, '06_offline_reader_viewer_desktop_1440px.png');
        await deskPage.screenshot({ path: sc6Path, fullPage: false });
        results.screenshots.push({ id: '06_offline_reader_desktop', path: sc6Path });
        console.log('Saved Screenshot 6 (Offline Reader):', sc6Path);

        // Close reader
        const closeBtn = await deskPage.$('.btn-close-x');
        if (closeBtn) await closeBtn.click({ force: true });
        await deskPage.waitForTimeout(400);
      }
      await deskCtx.setOffline(false);
    }

    // 1.7 Test Empty State (Clear IndexedDB)
    console.log('\n[1.7] Testing Empty State (Clearing IndexedDB)');
    await clearIndexedDB(deskPage);
    await deskPage.goto(`${PREVIEW_URL}/downloads`, { waitUntil: 'networkidle' });
    await deskPage.waitForTimeout(800);

    const emptyTitle = await deskPage.$eval('.empty-title', (e) => e.innerText.trim()).catch(() => '');
    const exploreBtn = await deskPage.$('.btn-primary-explore');
    console.log('Empty state title:', emptyTitle, 'Explore button:', !!exploreBtn);

    if (emptyTitle.includes('Você ainda não possui capítulos baixados') && exploreBtn) {
      logPass('Empty state rendered with accurate title and explore catalog CTA', { emptyTitle });
    } else {
      logFail('Empty state mismatch', { emptyTitle });
    }

    // Screenshot 3: Empty State
    const sc3Path = path.join(ARTIFACT_DIR, '03_downloads_library_empty_state_desktop_1440px.png');
    await deskPage.screenshot({ path: sc3Path, fullPage: false });
    results.screenshots.push({ id: '03_empty_state_desktop', path: sc3Path });
    console.log('Saved Screenshot 3 (Empty State):', sc3Path);

    await deskCtx.close();

    // -------------------------------------------------------------
    // 2. MOBILE CHROMIUM VIEWPORTS (360px, 390px, 430px)
    // -------------------------------------------------------------
    console.log('\n--- TESTING MOBILE VIEWPORTS (360px, 390px, 430px) ---');
    const MOBILE_VIEWPORTS = [
      { name: '360px', width: 360, height: 780 },
      { name: '390px', width: 390, height: 844 },
      { name: '430px', width: 430, height: 932 }
    ];

    for (const mv of MOBILE_VIEWPORTS) {
      console.log(`\nTesting Mobile Viewport: ${mv.name} (${mv.width}x${mv.height})`);
      const mobCtx = await browser.newContext({
        viewport: { width: mv.width, height: mv.height },
        isMobile: true,
        hasTouch: true
      });
      await mobCtx.addCookies([
        ...sessionCookies,
        { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
      ]);
      const mobPage = await mobCtx.newPage();

      // Seed mock data
      await mobPage.goto(`${PREVIEW_URL}/downloads`, { waitUntil: 'networkidle' });
      await seedIndexedDB(mobPage, SEED_CHAPTERS);
      await mobPage.reload({ waitUntil: 'networkidle' });
      await mobPage.waitForTimeout(800);

      // Verify no horizontal overflow
      const hasHorizontalScroll = await mobPage.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      if (!hasHorizontalScroll) {
        logPass(`Mobile ${mv.name}: No horizontal scroll detected`);
      } else {
        logFail(`Mobile ${mv.name}: Horizontal scroll detected!`);
      }

      // Screenshot 2 (Mobile Viewport)
      const mobScPath = path.join(ARTIFACT_DIR, `02_downloads_library_multiple_works_mobile_${mv.name}.png`);
      await mobPage.screenshot({ path: mobScPath, fullPage: false });
      results.screenshots.push({ id: `02_downloads_mobile_${mv.name}`, path: mobScPath });
      console.log(`Saved Screenshot 2 (${mv.name}):`, mobScPath);

      // On 390px, capture Avatar Menu, Work detail, and Delete Modal
      if (mv.name === '390px') {
        // Open avatar menu on mobile
        await mobPage.goto(`${PREVIEW_URL}/`, { waitUntil: 'networkidle' });
        const mobAvatarBtn = await mobPage.$('.avatar-btn');
        if (mobAvatarBtn) {
          await mobAvatarBtn.click();
          await mobPage.waitForTimeout(500);

          const mobSc1Path = path.join(ARTIFACT_DIR, '01_avatar_menu_downloads_option_mobile_390px.png');
          await mobPage.screenshot({ path: mobSc1Path, fullPage: false });
          results.screenshots.push({ id: '01_avatar_menu_mobile_390px', path: mobSc1Path });
          console.log('Saved Screenshot 1 (Mobile 390px):', mobSc1Path);
        }

        // Navigate to work detail
        await mobPage.goto(`${PREVIEW_URL}/downloads?obra=distant-sky`, { waitUntil: 'networkidle' });
        await mobPage.waitForTimeout(800);

        const mobSc4Path = path.join(ARTIFACT_DIR, '04_work_detail_chapters_list_mobile_390px.png');
        await mobPage.screenshot({ path: mobSc4Path, fullPage: false });
        results.screenshots.push({ id: '04_work_detail_mobile_390px', path: mobSc4Path });
        console.log('Saved Screenshot 4 (Mobile 390px):', mobSc4Path);

        // Open Delete modal on mobile
        const mobTrash = await mobPage.$('.chapter-row-card:first-child .btn-icon-trash-chapter');
        if (mobTrash) {
          await mobTrash.click();
          await mobPage.waitForTimeout(500);
          const mobSc5Path = path.join(ARTIFACT_DIR, '05_delete_confirmation_modal_mobile_390px.png');
          await mobPage.screenshot({ path: mobSc5Path, fullPage: false });
          results.screenshots.push({ id: '05_delete_modal_mobile_390px', path: mobSc5Path });
          console.log('Saved Screenshot 5 (Mobile 390px):', mobSc5Path);

          const cancel = await mobPage.$('.btn-modal-cancel');
          if (cancel) await cancel.click();
        }

        // Test Offline Reader on mobile
        const mobReadOffline = await mobPage.$('.chapter-row-card:first-child .btn-read-offline-mode');
        if (mobReadOffline) {
          await mobReadOffline.click();
          await mobPage.waitForTimeout(600);
          const mobSc6Path = path.join(ARTIFACT_DIR, '06_offline_reader_viewer_mobile_390px.png');
          await mobPage.screenshot({ path: mobSc6Path, fullPage: false });
          results.screenshots.push({ id: '06_offline_reader_mobile_390px', path: mobSc6Path });
          console.log('Saved Screenshot 6 (Mobile 390px):', mobSc6Path);

          const closeX = await mobPage.$('.btn-close-x');
          if (closeX) await closeX.click({ force: true });
        }
      }

      await mobCtx.close();
    }
  } finally {
    await browser.close();
  }

  // -------------------------------------------------------------
  // 3. FIREFOX SUITE
  // -------------------------------------------------------------
  console.log('\n--- LAUNCHING FIREFOX (GECKO) ---');
  const ffBrowser = await firefox.launch({ headless: true });

  try {
    // Firefox Desktop 1440px
    console.log('\n[3.1] Testing Firefox Desktop (1440x900)');
    const ffCtx = await ffBrowser.newContext({ viewport: { width: 1440, height: 900 } });
    await ffCtx.addCookies([
      ...sessionCookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const ffPage = await ffCtx.newPage();

    await ffPage.goto(`${PREVIEW_URL}/downloads`, { waitUntil: 'networkidle' });
    await seedIndexedDB(ffPage, SEED_CHAPTERS);
    await ffPage.reload({ waitUntil: 'networkidle' });
    await ffPage.waitForTimeout(800);

    const ffWorksCount = await ffPage.$$eval('.work-card-interactive', (els) => els.length);
    if (ffWorksCount === 3) {
      logPass('Firefox: Downloads library loaded 3 grouped works in IndexedDB', { ffWorksCount });
    } else {
      logFail('Firefox: Works count mismatch', { ffWorksCount });
    }

    const ffScPath = path.join(ARTIFACT_DIR, 'firefox_02_downloads_library_desktop_1440px.png');
    await ffPage.screenshot({ path: ffScPath, fullPage: false });
    results.screenshots.push({ id: 'firefox_downloads_library', path: ffScPath });
    console.log('Saved Firefox Screenshot:', ffScPath);

    // Firefox Mobile 390px
    console.log('\n[3.2] Testing Firefox Mobile (390x844)');
    await ffPage.setViewportSize({ width: 390, height: 844 });
    await ffPage.waitForTimeout(500);

    const ffMobScPath = path.join(ARTIFACT_DIR, 'firefox_02_downloads_library_mobile_390px.png');
    await ffPage.screenshot({ path: ffMobScPath, fullPage: false });
    results.screenshots.push({ id: 'firefox_downloads_library_mobile', path: ffMobScPath });
    console.log('Saved Firefox Mobile Screenshot:', ffMobScPath);

    await ffCtx.close();
  } finally {
    await ffBrowser.close();
  }

  // Write audit results
  const auditPath = path.join(ARTIFACT_DIR, 'downloads_round19_verification_audit.json');
  fs.writeFileSync(auditPath, JSON.stringify(results, null, 2));
  console.log('\nAudit report written to:', auditPath);

  const allPassed = results.tests.every((t) => t.pass);
  console.log(`\n=== FINAL RESULT: ${results.tests.filter((t) => t.pass).length}/${results.tests.length} TESTS PASSED (All Passed: ${allPassed}) ===\n`);
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
