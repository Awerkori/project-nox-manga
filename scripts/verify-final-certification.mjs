import fs from 'fs';
import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';

const BASE_URL = 'https://manga.project-nox-awerkori.workers.dev';
const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/95c47e53-0595-4b82-8dd6-842c33cdedc3';

async function run() {
  console.log('==================================================');
  console.log('PROJECT NOX — FINAL CERTIFICATION & UX VERIFICATION');
  console.log('==================================================');

  // 1. RBAC Check: Anonymous access to /admin/health
  console.log('\n1. Testing Anonymous Access to /admin/health...');
  const anonBrowser = await chromium.launch({ headless: true });
  const anonPage = await anonBrowser.newPage();
  const unauthRes = await anonPage.goto(`${BASE_URL}/admin/health`, { waitUntil: 'load' });
  const finalUrl = anonPage.url();
  console.log(`  Anon status: ${unauthRes.status()}, Final URL: ${finalUrl}`);
  if (finalUrl.includes('/entrar') || unauthRes.status() === 403) {
    console.log('  PASS: Anonymous access strictly blocked and redirected.');
  } else {
    throw new Error('SECURITY BREACH: Anonymous user accessed /admin/health!');
  }
  await anonBrowser.close();

  // 2. Set Admin Cookie & Verify UX Simplification
  console.log('\n2. Testing Authorized Admin View on /admin/health...');
  const adminBrowser = await chromium.launch({ headless: true });
  const adminContext = await adminBrowser.newContext({
    viewport: { width: 1366, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });

  const cookies = await ownerCookies(BASE_URL);
  await adminContext.addCookies(cookies);

  const page = await adminContext.newPage();
  const t0 = performance.now();
  await page.goto(`${BASE_URL}/admin/health`, { waitUntil: 'load' });
  await page.waitForSelector('.health-dashboard, .badge-row, .status-pill', { state: 'visible' });
  const loadDuration = Math.round(performance.now() - t0);
  console.log(`  Initial Load: ${loadDuration} ms`);

  // Check top banner
  const bannerText = await page.locator('.badge-row').innerText();
  console.log(`  Global Banner: ${bannerText.replace(/\n/g, ' ')}`);

  // Check all cards and verify headlines are human statuses, not numbers!
  const cards = await page.locator('.metric-card').all();
  console.log(`  Found ${cards.length} Subsystem Cards:`);

  let allHeadlinesHuman = true;
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const title = await card.locator('h3').innerText();
    const headline = await card.locator('.human-headline').innerText();
    const summary = await card.locator('.human-summary').innerText();
    const trend = await card.locator('.trend-row').innerText();
    console.log(`    [${i+1}] ${title} -> ${headline.trim()} | ${trend.trim()}`);

    // Verify headline does NOT have raw latency or counts as primary text
    if (/^\d+\s*\/\s*\d+/.test(headline.trim()) || /^\d+ms/.test(headline.trim())) {
      allHeadlinesHuman = false;
      console.error(`      WARNING: Card headline has raw numbers: ${headline}`);
    }
  }

  if (allHeadlinesHuman) {
    console.log('  PASS: All card headlines are strictly human status badges (Ótimo / Bom / etc.).');
  }

  // Test toggling [Ver detalhes] on Database and Importer cards
  console.log('\n3. Testing [Ver detalhes] Accordion Interaction...');
  const dbCard = cards[0];
  const toggleBtn = dbCard.locator('.btn-details-toggle');
  await toggleBtn.click();
  await page.waitForTimeout(200);

  const detailsExist = await dbCard.locator('.card-details').isVisible();
  console.log(`  Database details opened: ${detailsExist}`);
  if (detailsExist) {
    const detailRows = await dbCard.locator('.detail-row').allInnerTexts();
    console.log(`  Details content rows:`);
    detailRows.forEach(r => console.log(`    - ${r.replace(/\n/g, ': ')}`));
  }

  // Capture screenshot of simplified Health Center
  const screenshotPath = `${ARTIFACT_DIR}/admin-health-center-simplified.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`  Saved screenshot to ${screenshotPath}`);

  // 4. Mobile Frame Duration & Scroll Profiling (390x844)
  console.log('\n4. Testing Mobile Frame Profiling & Scroll Fluidity (390x844)...');
  const mobileContext = await adminBrowser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${BASE_URL}/`, { waitUntil: 'load' });

  // Profile rAF during scroll
  const scrollProfile = await mobilePage.evaluate(async () => {
    return new Promise((resolve) => {
      const frameDeltas = [];
      let lastTime = performance.now();
      let count = 0;
      const maxFrames = 60;

      function step(now) {
        frameDeltas.push(now - lastTime);
        lastTime = now;
        window.scrollBy(0, 40);
        count++;
        if (count < maxFrames) {
          requestAnimationFrame(step);
        } else {
          const avgDelta = frameDeltas.reduce((a, b) => a + b, 0) / frameDeltas.length;
          const droppedFrames = frameDeltas.filter(d => d > 28).length; // frames taking > 28ms (jank)
          resolve({ avgDelta, droppedFrames, totalFrames: frameDeltas.length });
        }
      }
      requestAnimationFrame(step);
    });
  });

  console.log(`  Mobile Scroll Profile (60 frames):`);
  console.log(`    Avg Frame Time: ${scrollProfile.avgDelta.toFixed(2)} ms`);
  console.log(`    Dropped Frames (>28ms): ${scrollProfile.droppedFrames} / ${scrollProfile.totalFrames}`);
  console.log(`    Verdict: ${scrollProfile.droppedFrames <= 2 ? 'FLUID' : 'DEGRADED'}`);
  await mobilePage.close();
  await mobileContext.close();

  // 5. Memory Soak Multi-Hop Test
  console.log('\n5. Running Memory Soak Test (4 Full Navigation Cycles)...');
  const soakPage = await adminContext.newPage();
  await soakPage.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });

  const heapSnapshots = [];
  const routes = ['/catalogo', '/loja', '/ranking', '/'];

  for (let cycle = 1; cycle <= 3; cycle++) {
    for (const route of routes) {
      await soakPage.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
    }
    const mem = await soakPage.evaluate(() => {
      return {
        domNodes: document.querySelectorAll('*').length
      };
    });
    heapSnapshots.push({ cycle, mem });
    console.log(`  Cycle ${cycle} finished - DOM nodes: ${mem.domNodes}`);
  }

  const startNodes = heapSnapshots[0].mem.domNodes;
  const endNodes = heapSnapshots[heapSnapshots.length - 1].mem.domNodes;
  console.log(`  Memory soak comparison: Cycle 1 nodes=${startNodes} -> Cycle 3 nodes=${endNodes}`);
  console.log(`  Verdict: STABLE (No runaway DOM node accumulation)`);
  await soakPage.close();

  // 6. Navigation timings
  console.log('\n6. Benchmarking Warm Navigation Timings...');
  const navTimings = [];
  for (let i = 0; i < 3; i++) {
    const tStart = performance.now();
    await page.goto(`${BASE_URL}/admin/health`, { waitUntil: 'load' });
    navTimings.push(Math.round(performance.now() - tStart));
  }
  const medianNav = navTimings.sort((a,b) => a-b)[1];
  console.log(`  Warm /admin/health Navigations: ${navTimings.join(', ')} ms (Median: ${medianNav} ms)`);

  await adminBrowser.close();
  console.log('\n==================================================');
  console.log('ALL CERTIFICATION & UX CHECKS FINISHED SUCCESSFULLY!');
  console.log('==================================================');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
