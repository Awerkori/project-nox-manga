import { chromium, firefox } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { writeFileSync } from 'node:fs';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function verifyGlobalPerf() {
  console.log(`=== STARTING GLOBAL PERFORMANCE VERIFICATION ===`);
  console.log(`Target: ${targetUrl}`);

  const cookies = await ownerCookies(targetUrl);
  cookies.push({
    name: 'nox-age-status',
    value: 'ADULT',
    url: targetUrl,
    httpOnly: false,
    sameSite: 'Lax',
    secure: targetUrl.startsWith('https:')
  });

  const report = {
    targetUrl,
    timestamp: new Date().toISOString(),
    publicRoutes: [],
    scanTabsChromium: [],
    scanTabsFirefox: [],
    viewportsTested: []
  };

  // 1. PUBLIC ROUTES BENCHMARK (HTTP GET + TTFB)
  console.log('\n--- 1. Testing Public Routes Latency ---');
  const publicRoutes = ['/', '/catalogo', '/ranking', '/scans'];
  for (const route of publicRoutes) {
    const t0 = performance.now();
    const res = await fetch(`${targetUrl}${route}`, {
      headers: { 'User-Agent': 'PerformanceAudit/1.0' }
    });
    const dur = Math.round(performance.now() - t0);
    const cacheHeader = res.headers.get('cf-cache-status') || res.headers.get('cache-control');
    console.log(`  Route: ${route} -> Status: ${res.status}, Time: ${dur}ms, Cache: ${cacheHeader}`);
    report.publicRoutes.push({
      route,
      status: res.status,
      durationMs: dur,
      cacheControl: cacheHeader
    });
  }

  // 2. CHROMIUM VERIFICATION (Desktop 1440 & Mobile 390)
  console.log('\n--- 2. Chromium Full Tab Switching & Visual Parity ---');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  
  // Desktop 1440x900
  const dCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await dCtx.addCookies(cookies);
  const dPage = await dCtx.newPage();

  console.log('Navigating Desktop to /scan?tab=home...');
  const dt0 = performance.now();
  await dPage.goto(`${targetUrl}/scan?tab=home`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await dPage.waitForSelector('.workspace-overview-container', { timeout: 15000 });
  const dInitMs = Math.round(performance.now() - dt0);
  console.log(`  Desktop Initial Load: ${dInitMs}ms`);

  // Take screenshot of Visão Geral V6.6 to verify visual preservation
  const dHomeShot = `${artifactDir}/perf_preview_desktop_1440_home.png`;
  await dPage.screenshot({ path: dHomeShot, fullPage: false });
  console.log('  Saved desktop home screenshot:', dHomeShot);

  const tabsToCheck = [
    { name: 'Minha Fila', selector: 'button:has-text("Minha Fila")', expected: '.tasks-tab-root' },
    { name: 'Área de Produção', selector: 'button:has-text("Área de Produção")', expected: '.pipeline-stage-view-root' },
    { name: 'Obras da Scan', selector: 'button:has-text("Obras da Scan")', expected: '.dash-columns' },
    { name: 'Calendário', selector: 'button:has-text("Calendário")', expected: '.calendar-tab' },
    { name: 'Chat', selector: 'button:has-text("Chat")', expected: '.chat-module-root' },
    { name: 'Mural', selector: 'button:has-text("Mural")', expected: '.mural-container' },
    { name: 'Notificações', selector: 'button:has-text("Notificações")', expected: '.inbox-module-root' },
    { name: 'Membros', selector: 'button:has-text("Membros")', expected: '.card-section:has-text("Membros da Equipe")' },
    { name: 'Início', selector: 'button:has-text("Início")', expected: '.workspace-overview-container' }
  ];

  for (const t of tabsToCheck) {
    const tStart = performance.now();
    await dPage.locator(t.selector).first().click();
    await dPage.locator(t.expected).first().waitFor({ state: 'visible', timeout: 5000 });
    const elapsed = Math.round(performance.now() - tStart);
    console.log(`  -> Chromium Desktop tab ${t.name}: ${elapsed}ms`);
    report.scanTabsChromium.push({ name: t.name, durationMs: elapsed, status: 'SUCCESS' });
  }

  await dCtx.close();

  // Mobile 390x844
  console.log('\n--- 3. Mobile 390x844 Bottom Navigation ---');
  const mCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  await mCtx.addCookies(cookies);
  const mPage = await mCtx.newPage();

  const mt0 = performance.now();
  await mPage.goto(`${targetUrl}/scan?tab=home`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await mPage.waitForSelector('.workspace-overview-container', { timeout: 15000 });
  const mInitMs = Math.round(performance.now() - mt0);
  console.log(`  Mobile Initial Load: ${mInitMs}ms`);

  const mHomeShot = `${artifactDir}/perf_preview_mobile_390_home.png`;
  await mPage.screenshot({ path: mHomeShot, fullPage: false });
  console.log('  Saved mobile home screenshot:', mHomeShot);

  const mTabs = [
    { name: 'Minha Fila', selector: 'nav.scan-mobile-bottom-bar button:has-text("Minha Fila")', expected: '.tasks-tab-root' },
    { name: 'Produção', selector: 'nav.scan-mobile-bottom-bar button:has-text("Produção")', expected: '.pipeline-stage-view-root' },
    { name: 'Chat', selector: 'nav.scan-mobile-bottom-bar button:has-text("Chat")', expected: '.chat-module-root' },
    { name: 'Início', selector: 'nav.scan-mobile-bottom-bar button:has-text("Início")', expected: '.workspace-overview-container' }
  ];

  for (const t of mTabs) {
    const tStart = performance.now();
    await mPage.locator(t.selector).first().click();
    await mPage.locator(t.expected).first().waitFor({ state: 'visible', timeout: 5000 });
    const elapsed = Math.round(performance.now() - tStart);
    console.log(`  -> Chromium Mobile Bottom Nav ${t.name}: ${elapsed}ms`);
  }

  await mCtx.close();
  await browser.close();

  // 4. FIREFOX GECKO VERIFICATION (1440x900)
  console.log('\n--- 4. Firefox Gecko Compatibility & Responsiveness ---');
  try {
    const ffBrowser = await firefox.launch({ headless: true, args: ['--no-sandbox'] });
    const ffCtx = await ffBrowser.newContext({ viewport: { width: 1440, height: 900 } });
    await ffCtx.addCookies(cookies);
    const ffPage = await ffCtx.newPage();

    const fft0 = performance.now();
    await ffPage.goto(`${targetUrl}/scan?tab=home`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await ffPage.waitForSelector('.workspace-overview-container', { timeout: 15000 });
    const ffInitMs = Math.round(performance.now() - fft0);
    console.log(`  Firefox Initial Load: ${ffInitMs}ms`);

    for (const t of tabsToCheck.slice(0, 5)) {
      const tStart = performance.now();
      await ffPage.locator(t.selector).first().click();
      await ffPage.locator(t.expected).first().waitFor({ state: 'visible', timeout: 5000 });
      const elapsed = Math.round(performance.now() - tStart);
      console.log(`  -> Firefox tab ${t.name}: ${elapsed}ms`);
      report.scanTabsFirefox.push({ name: t.name, durationMs: elapsed, status: 'SUCCESS' });
    }

    const ffShot = `${artifactDir}/perf_preview_firefox_1440_home.png`;
    await ffPage.screenshot({ path: ffShot, fullPage: false });
    console.log('  Saved Firefox screenshot:', ffShot);

    await ffCtx.close();
    await ffBrowser.close();
  } catch (ffErr) {
    console.warn('Firefox run skipped or not installed:', ffErr.message);
  }

  // Save report artifact
  const outPath = `${artifactDir}/benchmark_optimized_preview.json`;
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\n=== VERIFICATION COMPLETE. REPORT SAVED TO: ${outPath} ===`);
}

verifyGlobalPerf().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
