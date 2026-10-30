import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const PREVIEW_ORIGIN = 'https://home-preview-manga.project-nox-awerkori.workers.dev';

// Verified live production chapters
const CHAPTER_SMALL = {
  id: '00bbe943-3005-5478-8345-57425b157537',
  label: 'Capítulo 51 (Pequeno — 10 páginas)',
  expectedPages: 10
};

const CHAPTER_MEDIUM = {
  id: '148f05f2-1d12-5cf5-895f-7a3581af47b8',
  label: 'Capítulo 66 (Médio — 22 páginas)',
  expectedPages: 22
};

const CHAPTER_LARGE = {
  id: '0dfe20b3-7bf7-57dd-8ffd-c33ae756e84f',
  label: 'Capítulo 49 (Grande — 38 páginas)',
  expectedPages: 38
};

async function run() {
  console.log('================================================================');
  console.log('       PROJECT NOX — BENCHMARK OFICIAL TURBO ENGINE V5          ');
  console.log('================================================================');
  console.log(`Preview Origin: ${PREVIEW_ORIGIN}`);
  console.log(`Small Chapter:  ${CHAPTER_SMALL.label} [${CHAPTER_SMALL.id}]`);
  console.log(`Medium Chapter: ${CHAPTER_MEDIUM.label} [${CHAPTER_MEDIUM.id}]`);
  console.log(`Large Chapter:  ${CHAPTER_LARGE.label} [${CHAPTER_LARGE.id}]`);

  const results = {
    small: {},
    medium: {},
    large: {},
    mobile: {},
    jumpTest: {},
    memory: {}
  };

  const browser = await chromium.launch({
    headless: true,
    args: ['--js-flags=--expose-gc', '--enable-precise-memory-info']
  });

  // -------------------------------------------------------------
  // TEST 1: SMALL CHAPTER (Cold vs Warm Cache)
  // -------------------------------------------------------------
  console.log('\n>>> BENCHMARK 1: SMALL CHAPTER (10 páginas) <<<');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(`${PREVIEW_ORIGIN}/ler/${CHAPTER_SMALL.id}`, { waitUntil: 'domcontentloaded' });
    
    // Wait for Turbo metrics
    await page.waitForFunction(() => window.__nox_turbo_metrics && window.__nox_turbo_metrics.preloadedCount >= 1, { timeout: 20000 });
    await page.waitForFunction(() => window.__nox_turbo_metrics && (window.__nox_turbo_metrics.finished || window.__nox_turbo_metrics.preloadedCount >= window.__nox_turbo_metrics.totalPages), { timeout: 30000 }).catch(() => {});
    
    const coldMetrics = await page.evaluate(() => window.__nox_turbo_metrics);
    results.small.cold = coldMetrics;
    console.log('Small (Cold Access):', coldMetrics);

    // Reload page for warm cache access
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__nox_turbo_metrics && (window.__nox_turbo_metrics.finished || window.__nox_turbo_metrics.preloadedCount >= window.__nox_turbo_metrics.totalPages), { timeout: 15000 }).catch(() => {});
    const warmMetrics = await page.evaluate(() => window.__nox_turbo_metrics);
    results.small.warm = warmMetrics;
    console.log('Small (Warm Cached Access):', warmMetrics);

    await context.close();
  }

  // -------------------------------------------------------------
  // TEST 2: MEDIUM CHAPTER (Cold vs Warm Cache)
  // -------------------------------------------------------------
  console.log('\n>>> BENCHMARK 2: MEDIUM CHAPTER (22 páginas) <<<');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(`${PREVIEW_ORIGIN}/ler/${CHAPTER_MEDIUM.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__nox_turbo_metrics && window.__nox_turbo_metrics.preloadedCount >= 1, { timeout: 20000 });
    await page.waitForFunction(() => window.__nox_turbo_metrics && (window.__nox_turbo_metrics.finished || window.__nox_turbo_metrics.preloadedCount >= window.__nox_turbo_metrics.totalPages), { timeout: 40000 }).catch(() => {});
    
    const coldMetrics = await page.evaluate(() => window.__nox_turbo_metrics);
    results.medium.cold = coldMetrics;
    console.log('Medium (Cold Access):', coldMetrics);

    // Warm reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__nox_turbo_metrics && (window.__nox_turbo_metrics.finished || window.__nox_turbo_metrics.preloadedCount >= window.__nox_turbo_metrics.totalPages), { timeout: 15000 }).catch(() => {});
    const warmMetrics = await page.evaluate(() => window.__nox_turbo_metrics);
    results.medium.warm = warmMetrics;
    console.log('Medium (Warm Cached Access):', warmMetrics);

    await context.close();
  }

  // -------------------------------------------------------------
  // TEST 3: LARGE CHAPTER (38 páginas — Fast Scroll & Jump Test)
  // -------------------------------------------------------------
  console.log('\n>>> BENCHMARK 3: LARGE CHAPTER (38 páginas — Scroll & Jump) <<<');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(`${PREVIEW_ORIGIN}/ler/${CHAPTER_LARGE.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__nox_turbo_metrics && window.__nox_turbo_metrics.preloadedCount >= 1, { timeout: 20000 });
    
    // Check initial 5 pages time
    await page.waitForFunction(() => window.__nox_turbo_metrics && window.__nox_turbo_metrics.preloadedCount >= Math.min(5, window.__nox_turbo_metrics.totalPages), { timeout: 25000 }).catch(() => {});

    // Fast scroll down to simulate rapid reader progression
    for (let scrollStep = 1; scrollStep <= 5; scrollStep++) {
      await page.mouse.wheel(0, 1500);
      await page.waitForTimeout(250);
    }

    // Direct jump simulation: jump to page 25
    console.log('Testing direct jump to page 25 on 38-page chapter...');
    await page.evaluate(() => {
      const el = document.getElementById('pagina-25');
      if (el) el.scrollIntoView({ behavior: 'instant' });
    });
    await page.waitForTimeout(800);

    const jumpMetrics = await page.evaluate(() => {
      const p25 = document.getElementById('pagina-25');
      const img = p25 ? p25.querySelector('img') : null;
      return {
        metrics: window.__nox_turbo_metrics,
        page25Present: Boolean(p25),
        page25HasImg: Boolean(img),
        page25ImgComplete: Boolean(img && img.complete),
        page25ImgSrc: img?.getAttribute('src') || null
      };
    });
    results.jumpTest = jumpMetrics;
    console.log('Jump to page 25 result:', jumpMetrics);

    // Wait for full chapter preload completion
    await page.waitForFunction(() => window.__nox_turbo_metrics && (window.__nox_turbo_metrics.finished || window.__nox_turbo_metrics.preloadedCount >= window.__nox_turbo_metrics.totalPages), { timeout: 50000 }).catch(() => {});

    const largeColdMetrics = await page.evaluate(() => window.__nox_turbo_metrics);
    results.large.cold = largeColdMetrics;
    console.log('Large Chapter (Cold Access):', largeColdMetrics);

    // Measure memory via CDP
    try {
      const client = await context.newCDPSession(page);
      const perfMetrics = await client.send('Performance.getMetrics');
      const jsHeapUsedSize = perfMetrics.metrics.find(m => m.name === 'JSHeapUsedSize')?.value || 0;
      const jsHeapTotalSize = perfMetrics.metrics.find(m => m.name === 'JSHeapTotalSize')?.value || 0;
      results.memory.jsHeapUsedMB = Math.round((jsHeapUsedSize / (1024 * 1024)) * 10) / 10;
      results.memory.jsHeapTotalMB = Math.round((jsHeapTotalSize / (1024 * 1024)) * 10) / 10;
      console.log(`Memory Used: ${results.memory.jsHeapUsedMB} MB (Total Heap: ${results.memory.jsHeapTotalMB} MB)`);
    } catch (e) {
      console.log('CDP performance metrics not available:', e.message);
    }

    // Warm reload of large chapter
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__nox_turbo_metrics && (window.__nox_turbo_metrics.finished || window.__nox_turbo_metrics.preloadedCount >= window.__nox_turbo_metrics.totalPages), { timeout: 15000 }).catch(() => {});
    const largeWarmMetrics = await page.evaluate(() => window.__nox_turbo_metrics);
    results.large.warm = largeWarmMetrics;
    console.log('Large Chapter (Warm Cached Access):', largeWarmMetrics);

    // Screenshot of large chapter reader
    await page.screenshot({ path: `${ARTIFACT_DIR}/v20_turbo_large_chapter_desktop.png` });

    await context.close();
  }

  // -------------------------------------------------------------
  // TEST 4: MOBILE EMULATION BENCHMARK (Android / iPhone 13)
  // -------------------------------------------------------------
  console.log('\n>>> BENCHMARK 4: MOBILE EMULATION BENCHMARK <<<');
  {
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
      isMobile: true,
      hasTouch: true
    });
    const page = await mobileContext.newPage();

    await page.goto(`${PREVIEW_ORIGIN}/ler/${CHAPTER_MEDIUM.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__nox_turbo_metrics && window.__nox_turbo_metrics.preloadedCount >= 1, { timeout: 20000 });
    await page.waitForFunction(() => window.__nox_turbo_metrics && (window.__nox_turbo_metrics.finished || window.__nox_turbo_metrics.preloadedCount >= window.__nox_turbo_metrics.totalPages), { timeout: 40000 }).catch(() => {});

    const mobileMetrics = await page.evaluate(() => window.__nox_turbo_metrics);
    results.mobile = mobileMetrics;
    console.log('Mobile (Medium Chapter):', mobileMetrics);

    await page.screenshot({ path: `${ARTIFACT_DIR}/v20_turbo_mobile_reader.png` });
    await mobileContext.close();
  }

  await browser.close();

  console.log('\n================================================================');
  console.log('            BENCHMARK RESULTS SUMMARY                           ');
  console.log('================================================================');
  console.log(JSON.stringify(results, null, 2));

  fs.writeFileSync(
    `${ARTIFACT_DIR}/scratch/turbo_v5_benchmark_results.json`,
    JSON.stringify(results, null, 2)
  );
  console.log('\nBenchmark data saved successfully.');
}

run().catch(err => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
