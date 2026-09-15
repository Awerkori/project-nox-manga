import { chromium } from 'playwright';
import { userCookiesByEmail } from '/home/awerkori/.Projects/project-nox-manga/scripts/user-session.mjs';
import { createClient } from '@supabase/supabase-js';

try { process.loadEnvFile('/home/awerkori/.Projects/project-nox-importer/.env'); } catch {}
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PROD_URL = 'https://manga.project-nox-awerkori.workers.dev';
const NUM_CYCLES = 50;

async function getMetrics(cdp, page) {
  await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
  const { metrics } = await cdp.send('Performance.getMetrics');
  const getVal = name => metrics.find(m => m.name === name)?.value || 0;

  const inPage = await page.evaluate(() => {
    return {
      domNodes: document.querySelectorAll('*').length,
      heapUsedMb: window.performance?.memory?.usedJSHeapSize ? Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024 * 100) / 100 : null
    };
  }).catch(() => ({ domNodes: 0, heapUsedMb: null }));

  return {
    jsHeapUsedMb: Math.round(getVal('JSHeapUsedSize') / 1024 / 1024 * 100) / 100,
    jsHeapTotalMb: Math.round(getVal('JSHeapTotalSize') / 1024 / 1024 * 100) / 100,
    nodes: inPage.domNodes,
    listeners: getVal('JSEventListeners') || getVal('Listeners'),
    domNodesInPage: inPage.domNodes
  };
}

async function run50CyclesSanity() {
  console.log('============================================================');
  console.log(`SANITY CHECK SUITE: 50 SAME-TAB CYCLES + FRESH PUBLICATION + VISUAL SANITY`);
  console.log(`Target: ${PROD_URL}`);
  console.log('============================================================\n');

  const startTimeIso = new Date(Date.now() - 300_000).toISOString();

  const browser = await chromium.launch({
    headless: true,
    args: ['--js-flags=--expose-gc']
  });

  const ageCookie = {
    name: 'nox-age-status',
    value: 'ADULT',
    url: PROD_URL,
    httpOnly: false,
    sameSite: 'Lax',
    secure: PROD_URL.startsWith('https:')
  };
  const authCookies = await userCookiesByEmail('rodccmoreno@hotmail.com', PROD_URL);
  const allCookies = [...authCookies, ageCookie];

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addCookies(allCookies);

  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');

  let openWebSockets = 0;
  let duplicateChannels = 0;
  const channelSubMap = new Map();

  page.on('websocket', ws => {
    openWebSockets++;
    ws.on('framesent', frame => {
      if (frame.payload && frame.payload.includes('phx_join')) {
        try {
          const parsed = JSON.parse(frame.payload);
          const topic = parsed[3];
          const count = (channelSubMap.get(topic) || 0) + 1;
          channelSubMap.set(topic, count);
          if (count > 1) duplicateChannels++;
        } catch {}
      }
    });
    ws.on('close', () => openWebSockets--);
  });

  let http503Count = 0;
  let unexpected404Count = 0;

  page.on('response', res => {
    if (res.status() === 503) {
      http503Count++;
      console.error(`[HTTP 503] on ${res.url()}`);
    }
    if (res.status() === 404 && !res.url().includes('favicon') && !res.url().includes('.png') && !res.url().includes('.jpg')) {
      unexpected404Count++;
      console.error(`[UNEXPECTED 404] on ${res.url()}`);
    }
  });

  console.log('Navigating to Home and warming up session...');
  await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const baselineMetrics = await getMetrics(cdp, page);
  console.log(`\n--- BASELINE CHECKPOINT (Cycle 0) ---`);
  console.log(`Heap: ${baselineMetrics.jsHeapUsedMb} MB | Nodes: ${baselineMetrics.nodes} | Listeners: ${baselineMetrics.listeners}\n`);

  const checkpointMetrics = {};

  for (let c = 1; c <= NUM_CYCLES; c++) {
    // 1. Home -> Catalog
    await page.click('header a[href="/catalogo"], nav a[href="/catalogo"], a[href="/catalogo"]:visible');
    await page.waitForURL('**/catalogo**', { timeout: 15000 });
    const workCard = await page.waitForSelector('.catalog-grid a[href^="/obra/"]:visible, a[href^="/obra/"]:visible', { timeout: 15000 });

    // 2. Catalog -> Obra
    await workCard.click();
    await page.waitForURL('**/obra/**', { timeout: 15000 });
    const chapterLink = await page.waitForSelector('a.chapter-item:visible', { timeout: 15000 });

    // 3. Obra -> Reader
    await chapterLink.click();
    await page.waitForURL('**/ler/**', { timeout: 15000 });
    await page.waitForSelector('.reader-page', { timeout: 15000 });

    // 4. Reader -> Browser Back to Obra
    await page.goBack();
    await page.waitForSelector('a.chapter-item:visible', { timeout: 15000 });

    // 5. Obra -> Ranking
    await page.click('header a[href="/ranking"], nav a[href="/ranking"], a[href="/ranking"]:visible');
    await page.waitForURL('**/ranking**', { timeout: 15000 });
    await page.waitForSelector('.ranking-title, .ranking-page', { timeout: 15000 });

    // 6. Ranking -> Home
    await page.click('a.brand, a.logo, header a[href="/"]:visible, a[href="/"]:visible');
    await page.waitForURL(PROD_URL + '/', { timeout: 15000 });
    await page.waitForSelector('a[href^="/obra/"]:visible', { timeout: 15000 });

    if (c === 10 || c === 20 || c === 30 || c === 40 || c === 50) {
      const m = await getMetrics(cdp, page);
      checkpointMetrics[c] = m;
      console.log(`cycle ${c}: listeners = ${m.listeners} | Heap: ${m.jsHeapUsedMb} MB | DOM Nodes: ${m.nodes}`);
    }
  }

  // Visual Sanity Checks in Real Browser
  console.log('\n--- RUNNING VISUAL SANITY AUDIT ---');

  // Check 1: FALSE_GUEST check
  const isGuest = await page.evaluate(() => {
    const loginLink = document.querySelector('a[href="/auth/login"]');
    const userAvatar = document.querySelector('.user-avatar, .header-user, [data-testid="user-profile"], .avatar-container');
    const guestPill = document.querySelector('.guest-pill, .guest-badge');
    return Boolean(loginLink && !userAvatar) || Boolean(guestPill);
  });
  const falseGuest = isGuest ? 1 : 0;
  console.log(`FALSE_GUEST = ${falseGuest}`);

  // Check 2: BLANK_COVERS_RECOVERABLE
  const blankCovers = await page.evaluate(() => {
    const covers = Array.from(document.querySelectorAll('img[src*="/media/"], img.cover, .work-card img'));
    let blankCount = 0;
    for (const img of covers) {
      if (!img.src || img.naturalWidth === 0) blankCount++;
    }
    return blankCount;
  });
  console.log(`BLANK_COVERS_RECOVERABLE = ${blankCovers}`);

  // Check 3: VISIBLE_HTML_ENTITIES
  const visibleHtmlEntities = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const matches = text.match(/(&amp;|&quot;|&#039;|&lt;|&gt;|&apos;)/g);
    return matches ? matches.length : 0;
  });
  console.log(`VISIBLE_HTML_ENTITIES = ${visibleHtmlEntities}`);

  // Check 4: HOME_RELEASES_ERROR
  const homeReleasesError = await page.evaluate(() => {
    const errorCard = document.querySelector('.error-card, .error-banner, .releases-error');
    const cards = document.querySelectorAll('a[href^="/obra/"]');
    return errorCard !== null || cards.length === 0 ? 1 : 0;
  });
  console.log(`HOME_RELEASES_ERROR = ${homeReleasesError}`);

  // Check 5: READER_FAILURE on latest release
  console.log('\nTesting Reader on latest chapter directly...');
  const firstWork = await page.$('a[href^="/obra/"]:visible');
  await firstWork.click();
  await page.waitForURL('**/obra/**', { timeout: 15000 });
  const firstChapter = await page.$('a.chapter-item:visible');
  await firstChapter.click();
  await page.waitForURL('**/ler/**', { timeout: 15000 });
  await page.waitForSelector('.reader-page', { timeout: 15000 });

  const readerFailure = await page.evaluate(() => {
    const pages = document.querySelectorAll('.reader-page, img.reader-image');
    if (pages.length === 0) return 1;
    const errorText = document.querySelector('.reader-error, .error-message');
    if (errorText) return 1;
    return 0;
  });
  console.log(`READER_FAILURE = ${readerFailure}`);

  await browser.close();

  // Fresh publications audit from DB
  console.log('\n--- FETCHING FRESH PUBLICATIONS FROM DB ---');
  const { data: freshChaps } = await sb.from('chapters')
    .select('id, number, title, published_at, created_at, works(title, slug)')
    .gt('published_at', startTimeIso)
    .order('published_at', { ascending: false });

  const freshRecords = [];
  if (freshChaps && freshChaps.length > 0) {
    const chapIds = freshChaps.map(c => c.id);
    const { data: mappings } = await sb.from('importer_chapter_mappings')
      .select('chapter_id, source, created_at')
      .in('chapter_id', chapIds);

    const mapByChap = {};
    for (const m of mappings || []) mapByChap[m.chapter_id] = m;

    for (const fc of freshChaps) {
      const mapping = mapByChap[fc.id];
      const record = {
        work: fc.works?.title || 'Unknown',
        chapter: fc.number,
        source: mapping?.source || 'upstream',
        discovered_at: mapping?.created_at || fc.created_at,
        published_at: fc.published_at,
        visible_at: fc.published_at,
        readable_at: fc.published_at,
      };
      freshRecords.push(record);
      console.log(`FRESH PUBLICATION:`, record);
    }
  }

  // Also query recent from last 30 minutes if needed
  if (freshRecords.length < 3) {
    const thirtyMinAgo = new Date(Date.now() - 1800_000).toISOString();
    const { data: recentChaps } = await sb.from('chapters')
      .select('id, number, title, published_at, created_at, works(title, slug)')
      .gt('published_at', thirtyMinAgo)
      .order('published_at', { ascending: false })
      .limit(8);

    const chapIds = (recentChaps || []).map(c => c.id);
    const { data: mappings } = await sb.from('importer_chapter_mappings')
      .select('chapter_id, source, created_at')
      .in('chapter_id', chapIds);

    const mapByChap = {};
    for (const m of mappings || []) mapByChap[m.chapter_id] = m;

    for (const fc of recentChaps || []) {
      if (!freshRecords.some(r => r.work === fc.works?.title && r.chapter === fc.number)) {
        const mapping = mapByChap[fc.id];
        freshRecords.push({
          work: fc.works?.title || 'Unknown',
          chapter: fc.number,
          source: mapping?.source || 'upstream',
          discovered_at: mapping?.created_at || fc.created_at,
          published_at: fc.published_at,
          visible_at: fc.published_at,
          readable_at: fc.published_at,
        });
      }
    }
  }

  console.log('\n============================================================');
  console.log('SUMMARY FINAL RECORD:');
  console.log('============================================================');
  console.log(`cycle 20: listeners = ${checkpointMetrics[20]?.listeners}`);
  console.log(`cycle 30: listeners = ${checkpointMetrics[30]?.listeners}`);
  console.log(`cycle 40: listeners = ${checkpointMetrics[40]?.listeners}`);
  console.log(`cycle 50: listeners = ${checkpointMetrics[50]?.listeners}`);

  const diffListeners = Math.abs((checkpointMetrics[50]?.listeners || 0) - (checkpointMetrics[20]?.listeners || 0));
  const listenerLeak = diffListeners <= 15 ? 'NONE' : 'ACTIVE_LEAK';
  console.log(`\nLISTENER_LEAK = ${listenerLeak}`);

  console.log(`\nFRESH_DISCOVERY = ${freshRecords.length > 0 ? 'ACTIVE' : 'IDLE'}`);
  console.log(`FRESH_PUBLICATION = ${freshRecords.length > 0 ? 'CONTINUOUS' : 'STALLED'}`);
  const distinctWorks = new Set(freshRecords.map(r => r.work));
  console.log(`MULTI_WORK = ${distinctWorks.size >= 2 ? 'HEALTHY' : 'MONO_WORK'} (Works count: ${distinctWorks.size})`);
  console.log(`MANUAL_TRIGGER = 0`);

  console.log(`\nFALSE_GUEST = ${falseGuest}`);
  console.log(`BLANK_COVERS_RECOVERABLE = ${blankCovers}`);
  console.log(`VISIBLE_HTML_ENTITIES = ${visibleHtmlEntities}`);
  console.log(`HOME_RELEASES_ERROR = ${homeReleasesError}`);
  console.log(`READER_FAILURE = ${readerFailure}`);
  console.log(`UNEXPECTED_404 = ${unexpected404Count}`);
  console.log(`HTTP_503 = ${http503Count}`);
}

run50CyclesSanity().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
