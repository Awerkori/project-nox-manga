import { chromium, firefox } from '@playwright/test';

const BASE_URL = 'https://manga.project-nox-awerkori.workers.dev';

async function runBrowserBenchmarks(browserType, browserName) {
  console.log(`\n==================================================`);
  console.log(`BENCHMARKING BROWSER: ${browserName}`);
  console.log(`==================================================`);

  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  // Set cookies to bypass age gate so test measures actual application navigation
  await context.addCookies([
    { name: 'nox-age-status', value: 'ADULT', domain: 'manga.project-nox-awerkori.workers.dev', path: '/' },
    { name: 'nox-blur-nsfw', value: 'false', domain: 'manga.project-nox-awerkori.workers.dev', path: '/' }
  ]);

  const page = await context.newPage();

  // Helper to measure click to content paint
  async function measureClickToPaint(clickSelector, targetSelector, routeLabel) {
    const clickStart = performance.now();
    await page.locator(clickSelector).first().click();
    await page.waitForSelector(targetSelector, { state: 'visible', timeout: 15000 });
    const elapsed = Math.round(performance.now() - clickStart);
    return elapsed;
  }

  // Initial cold visit to Home
  const coldHomeStart = performance.now();
  await page.goto(BASE_URL, { waitUntil: 'load' });
  await page.waitForSelector('.shelf-card, .editorial-card, .release-row-card', { state: 'visible' });
  const coldHomeTime = Math.round(performance.now() - coldHomeStart);
  console.log(`[${browserName}] Cold Home First Load: ${coldHomeTime}ms`);

  const routes = [
    { from: 'Home', to: 'Loja', click: 'a[href="/loja"]', target: '.shop-card, .shop-grid, h1:has-text("Loja")', name: 'Home -> Loja' },
    { from: 'Loja', to: 'Home', click: 'a[href="/"]', target: '.shelf-card, .hero-slide, h2:has-text("Novas Obras")', name: 'Loja -> Home' },
    { from: 'Home', to: 'Ranking', click: 'a[href="/ranking"]', target: '.podium-item, .rank-row, h1:has-text("Mestres")', name: 'Home -> Ranking' },
    { from: 'Ranking', to: 'Home', click: 'a[href="/"]', target: '.shelf-card, .hero-slide, h2:has-text("Novas Obras")', name: 'Ranking -> Home' },
    { from: 'Home', to: 'Catálogo', click: 'a[href="/catalogo"]', target: '.editorial-card, h1:has-text("Explorar")', name: 'Home -> Catálogo' },
    { from: 'Catálogo', to: 'Obra', click: 'a[href^="/obra/"]:visible', target: '.work-hero, .chapter-list, h1', name: 'Catálogo -> Obra' },
    { from: 'Obra', to: 'Reader', click: 'a.chapter-item:visible, a.btn-read-chapters-desktop:visible', target: '.reader-page-img, .reader-toolbar, .chapter-select, a.btn-nav-work', name: 'Obra -> Reader' },
    { from: 'Reader', to: 'Obra', click: 'a.btn-nav-work:visible', target: '.work-hero, h1', name: 'Reader -> Obra' }
  ];

  const results = {};

  // Cold samples (first run through flow)
  console.log(`\n--- Running Flow (Round 1) ---`);
  for (const r of routes) {
    try {
      const ms = await measureClickToPaint(r.click, r.target, r.name);
      results[r.name] = results[r.name] || [];
      results[r.name].push(ms);
      console.log(`  ${r.name}: ${ms}ms`);
    } catch (err) {
      console.warn(`  ${r.name} failed: ${err.message}`);
    }
  }

  // Warm samples (Round 2, 3)
  for (let round = 2; round <= 3; round++) {
    console.log(`\n--- Running Flow (Round ${round}) ---`);
    for (const r of routes) {
      try {
        const ms = await measureClickToPaint(r.click, r.target, r.name);
        results[r.name] = results[r.name] || [];
        results[r.name].push(ms);
        console.log(`  ${r.name}: ${ms}ms`);
      } catch (err) {
        console.warn(`  ${r.name} failed round ${round}: ${err.message}`);
      }
    }
  }

  await browser.close();

  // Calculate statistics
  const summary = {};
  for (const [name, times] of Object.entries(results)) {
    const sorted = [...times].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
    const max = sorted[sorted.length - 1];
    summary[name] = { samples: times, median, p95, max };
  }

  return summary;
}

async function main() {
  console.log("Starting Definitive P1.3 Browser Benchmarks on Production...");
  console.log("Target: " + BASE_URL);

  const ffResults = await runBrowserBenchmarks(firefox, 'Firefox Linux');
  const chrResults = await runBrowserBenchmarks(chromium, 'Chromium Linux');

  console.log("\n==================================================");
  console.log("FINAL NAVIGATION SUMMARY (CLICK -> CONTENT PAINT)");
  console.log("==================================================");
  console.log("\nFIREFOX LINUX:");
  console.table(ffResults);

  console.log("\nCHROMIUM LINUX:");
  console.table(chrResults);
}

main().catch(err => {
  console.error("Benchmark error:", err);
  process.exit(1);
});
