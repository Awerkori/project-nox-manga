import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('.env');

const PROD_URL = 'https://manga.project-nox-awerkori.workers.dev';
const sb = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function select20DiverseChapters() {
  const { data: chapters, error } = await sb
    .from('chapters')
    .select(`
      id,
      number,
      title,
      published_at,
      created_at,
      work_id,
      works!inner(id, title, slug),
      pages(position, media_id, width, height)
    `)
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(200);

  if (error) throw error;

  const valid = chapters.filter(c => c.pages && c.pages.length > 0);

  // Group by work to ensure diversity
  const byWork = new Map();
  for (const c of valid) {
    if (!byWork.has(c.work_id)) byWork.set(c.work_id, []);
    byWork.get(c.work_id).push(c);
  }

  const selected = [];
  
  // 1. First add the large page count chapters (80+ pages)
  const largeChapters = valid.filter(c => c.pages.length >= 40);
  for (const lc of largeChapters.slice(0, 3)) {
    selected.push(lc);
  }

  // 2. Add chapters from each unique work
  for (const [wId, chs] of byWork.entries()) {
    for (const ch of chs) {
      if (!selected.some(s => s.id === ch.id)) {
        selected.push(ch);
        break;
      }
    }
  }

  // 3. Fill up to 20 with varied sizes and dates
  for (const ch of valid) {
    if (selected.length >= 20) break;
    if (!selected.some(s => s.id === ch.id)) {
      selected.push(ch);
    }
  }

  return selected.slice(0, 20);
}

async function runReaderHomologation() {
  console.log('============================================================');
  console.log('READER 20-CHAPTER FULL INTEGRITY & RENDERING HOMOLOGATION');
  console.log(`Target: ${PROD_URL}`);
  console.log('============================================================\n');

  const chapters = await select20DiverseChapters();
  console.log(`Selected ${chapters.length} diverse chapters for real-browser testing:\n`);
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i];
    console.log(`  [${i + 1}] "${c.works.title}" Cap ${c.number} (${c.pages.length} pages, pub: ${c.published_at?.slice(0, 10)}) - ID: ${c.id}`);
  }
  console.log();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  
  // Set adult age gate cookie so reader opens directly
  await context.addCookies([{
    name: 'nox-age-status',
    value: 'ADULT',
    url: PROD_URL,
    httpOnly: false,
    sameSite: 'Lax',
    secure: PROD_URL.startsWith('https:')
  }]);

  const page = await context.newPage();

  // Metrics trackers
  let totalChaptersTested = 0;
  let totalPagesTested = 0;
  let page404Count = 0;
  let page403Count = 0;
  let page5xxCount = 0;
  let brokenMediaCount = 0;
  let missingPagesCount = 0;
  let duplicatePagesCount = 0;
  let invalidMimeCount = 0;
  let htmlAsImageCount = 0;
  let clientRenderFailureCount = 0;

  const chapterReports = [];

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const expectedPageCount = ch.pages.length;
    const chUrl = `${PROD_URL}/ler/${ch.id}`;
    totalChaptersTested++;

    console.log(`>>> [Chapter ${i + 1}/20] Testing "${ch.works.title}" Cap ${ch.number} (${expectedPageCount} pages)...`);

    const networkErrors = [];
    const responseHandler = res => {
      const url = res.url();
      if (url.includes('/media/')) {
        const status = res.status();
        const ct = res.headers()['content-type'] || '';

        if (status === 404) page404Count++;
        else if (status === 403) page403Count++;
        else if (status >= 500) page5xxCount++;

        if (ct.includes('text/html')) htmlAsImageCount++;
        else if (!ct.startsWith('image/') && status === 200) invalidMimeCount++;

        if (!res.ok()) {
          networkErrors.push({ url, status, ct });
        }
      }
    };

    page.on('response', responseHandler);

    try {
      const t0 = Date.now();
      await page.goto(chUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.reader-page', { timeout: 15000 });
      const loadTime = Date.now() - t0;

      // Scroll smoothly through all pages to trigger IntersectionObserver
      const pageContainers = await page.$$('.reader-page');
      for (let pIdx = 0; pIdx < pageContainers.length; pIdx++) {
        await pageContainers[pIdx].scrollIntoViewIfNeeded();
        if (pIdx % 10 === 0) await page.waitForTimeout(50);
      }

      // Deterministic wait: wait for all images to complete loading in browser
      await page.waitForFunction((expected) => {
        const imgs = Array.from(document.querySelectorAll('.reader-page img'));
        return imgs.length === expected && imgs.every(img => img.complete && img.naturalWidth > 0);
      }, expectedPageCount, { timeout: 25000 });

      // Inspect all pages rendered in DOM
      const evalResult = await page.evaluate(() => {
        const domPages = Array.from(document.querySelectorAll('.reader-page'));
        return domPages.map(p => {
          const img = p.querySelector('img');
          const isRetry = !!p.querySelector('.page-retry');
          const pageNum = parseInt(p.id.replace('pagina-', ''), 10);
          return {
            id: p.id,
            pageNum,
            hasImg: !!img,
            complete: img ? img.complete : false,
            naturalWidth: img ? img.naturalWidth : 0,
            naturalHeight: img ? img.naturalHeight : 0,
            isRetry
          };
        });
      });

      // Verification of sequence
      const positions = evalResult.map(p => p.pageNum).sort((a, b) => a - b);
      const uniquePositions = new Set(positions);
      if (uniquePositions.size !== positions.length) {
        duplicatePagesCount += (positions.length - uniquePositions.size);
      }

      // Check missing pages in sequence
      for (let p = 1; p <= expectedPageCount; p++) {
        if (!uniquePositions.has(p)) {
          missingPagesCount++;
        }
      }

      let chapterRenderFailures = 0;
      for (const p of evalResult) {
        totalPagesTested++;
        const isOk = p.hasImg && p.complete && p.naturalWidth > 0 && !p.isRetry;
        if (!isOk) {
          chapterRenderFailures++;
          clientRenderFailureCount++;
          brokenMediaCount++;
        }
      }

      const chapterPass = chapterRenderFailures === 0 && networkErrors.length === 0 && evalResult.length === expectedPageCount;
      console.log(`    Result: ${chapterPass ? 'PASS' : 'FAIL'} | Rendered: ${evalResult.length - chapterRenderFailures}/${expectedPageCount} | Load: ${loadTime}ms | NetworkErrors: ${networkErrors.length}`);

      chapterReports.push({
        index: i + 1,
        work: ch.works.title,
        chapter: ch.number,
        id: ch.id,
        expected: expectedPageCount,
        rendered: evalResult.length - chapterRenderFailures,
        pass: chapterPass,
        loadTime
      });

    } catch (err) {
      console.error(`    ERROR testing chapter ${ch.id}: ${err.message}`);
      chapterReports.push({
        index: i + 1,
        work: ch.works.title,
        chapter: ch.number,
        id: ch.id,
        expected: expectedPageCount,
        rendered: 0,
        pass: false,
        error: err.message
      });
      clientRenderFailureCount += expectedPageCount;
      brokenMediaCount += expectedPageCount;
    } finally {
      page.off('response', responseHandler);
    }
  }

  await browser.close();

  const allPassed = chapterReports.every(r => r.pass);

  console.log('\n============================================================');
  console.log('READER HOMOLOGATION FINAL METRICS:');
  console.log('============================================================');
  console.log(`CHAPTERS TESTED:         ${totalChaptersTested}`);
  console.log(`TOTAL PAGES TESTED:      ${totalPagesTested}`);
  console.log(`PAGE_404:                ${page404Count}`);
  console.log(`PAGE_403:                ${page403Count}`);
  console.log(`PAGE_5XX:                ${page5xxCount}`);
  console.log(`BROKEN_MEDIA:            ${brokenMediaCount}`);
  console.log(`MISSING_PAGES:           ${missingPagesCount}`);
  console.log(`DUPLICATE_PAGES:         ${duplicatePagesCount}`);
  console.log(`INVALID_MIME:            ${invalidMimeCount}`);
  console.log(`HTML_AS_IMAGE:           ${htmlAsImageCount}`);
  console.log(`CLIENT_RENDER_FAILURE:   ${clientRenderFailureCount}`);
  console.log(`ALL_PAGES_RENDERED:      ${allPassed && brokenMediaCount === 0 ? 'YES' : 'NO'}`);
  console.log(`READER STATUS:           ${allPassed && brokenMediaCount === 0 ? 'HEALTHY' : 'UNHEALTHY'}`);
  console.log('============================================================\n');

  return {
    totalChaptersTested,
    totalPagesTested,
    page404Count,
    page403Count,
    page5xxCount,
    brokenMediaCount,
    missingPagesCount,
    duplicatePagesCount,
    invalidMimeCount,
    htmlAsImageCount,
    clientRenderFailureCount,
    allPassed,
    chapterReports
  };
}

runReaderHomologation().then(res => {
  if (!res.allPassed || res.brokenMediaCount > 0 || res.missingPagesCount > 0) {
    process.exit(1);
  }
}).catch(err => {
  console.error('Fatal error in Reader Homologation:', err);
  process.exit(1);
});
