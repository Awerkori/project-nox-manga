import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { writeFileSync } from 'node:fs';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function runBaselineBenchmark() {
  console.log(`=== RUNNING PERFORMANCE BASELINE BENCHMARK ===`);
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
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  const results = {
    targetUrl,
    timestamp: new Date().toISOString(),
    desktop: {},
    mobile: {}
  };

  // 1. DESKTOP BENCHMARK (1440x900)
  console.log('\n--- Running Desktop Benchmark (1440x900) ---');
  const dCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await dCtx.addCookies(cookies);
  const dPage = await dCtx.newPage();

  // Capture network requests and console errors
  const serverLoadRequests = [];
  dPage.on('request', req => {
    if (req.url().includes('/scan') || req.url().includes('/api/')) {
      serverLoadRequests.push({ url: req.url(), method: req.method(), start: performance.now() });
    }
  });

  // Measure initial page load to /scan?tab=home
  console.log('Navigating to /scan?tab=home...');
  const t0 = performance.now();
  const resp = await dPage.goto(`${targetUrl}/scan?tab=home`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const dclTime = performance.now() - t0;
  
  await dPage.waitForSelector('.workspace-overview-container, .workspace-app-shell', { timeout: 25000 });
  const interactiveTime = performance.now() - t0;
  const status = resp?.status();

  console.log(`Initial Load /scan?tab=home -> Status: ${status}, DCL: ${Math.round(dclTime)}ms, Interactive: ${Math.round(interactiveTime)}ms`);

  results.desktop.initialLoad = {
    status,
    domContentLoadedMs: Math.round(dclTime),
    interactiveMs: Math.round(interactiveTime)
  };

  // Now measure tab transitions
  // List of tabs / sub-stages to test in sequence
  const tabsToTest = [
    { name: 'Minha Fila', selector: 'button:has-text("Minha Fila")', expectedSelector: '.tasks-tab-root' },
    { name: 'Área de Produção (clean_redraw)', selector: 'button:has-text("Área de Produção")', expectedSelector: '.pipeline-stage-view-root' },
    { name: 'RAW Provider', selector: 'button:has-text("Raw Provider"), button:has-text("RAW")', expectedSelector: '.pipeline-stage-view-root' },
    { name: 'Tradução', selector: 'button:has-text("Tradução")', expectedSelector: '.pipeline-stage-view-root' },
    { name: 'Clean/Redraw', selector: 'button:has-text("Clean/Redraw"), button:has-text("Clean & Redraw")', expectedSelector: '.pipeline-stage-view-root' },
    { name: 'Typeset', selector: 'button:has-text("Typeset")', expectedSelector: '.pipeline-stage-view-root' },
    { name: 'Revisor (QC)', selector: 'button:has-text("Revisor (QC)"), button:has-text("Revisor")', expectedSelector: '.pipeline-stage-view-root' },
    { name: 'Pré Aprovado', selector: 'button:has-text("Pré Aprovado"), button:has-text("Pré-Aprovado")', expectedSelector: '.pipeline-stage-view-root' },
    { name: 'Publicado', selector: 'button:has-text("Publicado")', expectedSelector: '.pipeline-stage-view-root' },
    { name: 'Obras da Scan', selector: 'button:has-text("Obras da Scan")', expectedSelector: '.dash-columns, .card-section:has-text("Obras da Scan")' },
    { name: 'Calendário', selector: 'button:has-text("Calendário")', expectedSelector: '.calendar-tab' },
    { name: 'Chat', selector: 'button:has-text("Chat")', expectedSelector: '.chat-module-root' },
    { name: 'Mural', selector: 'button:has-text("Mural")', expectedSelector: '.mural-container' },
    { name: 'Notificações', selector: 'button:has-text("Notificações")', expectedSelector: '.inbox-module-root' },
    { name: 'Membros', selector: 'button:has-text("Membros")', expectedSelector: '.card-section:has-text("Membros da Equipe")' },
    { name: 'Início (Visão Geral)', selector: 'button:has-text("Início")', expectedSelector: '.workspace-overview-container' }
  ];

  results.desktop.transitions = [];

  for (const tab of tabsToTest) {
    console.log(`Testing transition to: ${tab.name}...`);
    try {
      // Find button
      const btn = dPage.locator(tab.selector).first();
      const count = await btn.count();
      if (count === 0) {
        console.warn(`  Selector not found for tab: ${tab.name}`);
        results.desktop.transitions.push({ name: tab.name, status: 'NOT_FOUND', durationMs: null });
        continue;
      }

      // Check if button is visible, if not expand accordion if needed
      const isVis = await btn.isVisible();
      if (!isVis && tab.name.includes('RAW') || tab.name.includes('Tradução') || tab.name.includes('Clean') || tab.name.includes('Typeset') || tab.name.includes('Revisor') || tab.name.includes('Pré') || tab.name.includes('Publicado')) {
        // May need to expand pipeline accordion
        const accordionBtn = dPage.locator('button.nav-chevron-toggle-btn').first();
        if (await accordionBtn.isVisible()) {
          await accordionBtn.click();
          await dPage.waitForTimeout(300);
        }
      }

      const clickStart = performance.now();
      await btn.click({ timeout: 5000 });

      // Measure time until expected selector is visible
      const expLocator = dPage.locator(tab.expectedSelector).first();
      await expLocator.waitFor({ state: 'visible', timeout: 8000 });
      const transitionDuration = Math.round(performance.now() - clickStart);

      console.log(`  -> Switched to ${tab.name} in ${transitionDuration}ms`);
      results.desktop.transitions.push({
        name: tab.name,
        status: 'SUCCESS',
        durationMs: transitionDuration
      });
    } catch (err) {
      console.error(`  -> Failed or timed out switching to ${tab.name}:`, err.message);
      results.desktop.transitions.push({
        name: tab.name,
        status: 'ERROR',
        error: err.message,
        durationMs: null
      });
    }
    await dPage.waitForTimeout(300);
  }

  await dCtx.close();

  // 2. MOBILE BENCHMARK (390x844)
  console.log('\n--- Running Mobile Benchmark (390x844) ---');
  const mCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  await mCtx.addCookies(cookies);
  const mPage = await mCtx.newPage();

  const mt0 = performance.now();
  const mResp = await mPage.goto(`${targetUrl}/scan?tab=home`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const mDclTime = performance.now() - mt0;
  await mPage.waitForSelector('.workspace-overview-container, .workspace-app-shell', { timeout: 25000 });
  const mInteractiveTime = performance.now() - mt0;

  console.log(`Mobile Initial Load /scan?tab=home -> Status: ${mResp?.status()}, DCL: ${Math.round(mDclTime)}ms, Interactive: ${Math.round(mInteractiveTime)}ms`);

  results.mobile.initialLoad = {
    status: mResp?.status(),
    domContentLoadedMs: Math.round(mDclTime),
    interactiveMs: Math.round(mInteractiveTime)
  };

  // Test mobile bottom nav switching
  const mobileNavTabs = [
    { name: 'Minha Fila (Bottom Nav)', selector: 'nav.scan-mobile-bottom-bar button:has-text("Minha Fila")', expectedSelector: '.tasks-tab-root' },
    { name: 'Produção (Bottom Nav)', selector: 'nav.scan-mobile-bottom-bar button:has-text("Produção")', expectedSelector: '.pipeline-stage-view-root' },
    { name: 'Chat (Bottom Nav)', selector: 'nav.scan-mobile-bottom-bar button:has-text("Chat")', expectedSelector: '.chat-module-root' },
    { name: 'Início (Bottom Nav)', selector: 'nav.scan-mobile-bottom-bar button:has-text("Início")', expectedSelector: '.workspace-overview-container' }
  ];

  results.mobile.bottomNavTransitions = [];
  for (const tab of mobileNavTabs) {
    console.log(`Testing mobile bottom nav transition to: ${tab.name}...`);
    try {
      const btn = mPage.locator(tab.selector).first();
      const clickStart = performance.now();
      await btn.click({ timeout: 5000 });
      const expLocator = mPage.locator(tab.expectedSelector).first();
      await expLocator.waitFor({ state: 'visible', timeout: 8000 });
      const duration = Math.round(performance.now() - clickStart);
      console.log(`  -> Switched mobile bottom nav to ${tab.name} in ${duration}ms`);
      results.mobile.bottomNavTransitions.push({
        name: tab.name,
        status: 'SUCCESS',
        durationMs: duration
      });
    } catch (err) {
      console.error(`  -> Mobile bottom nav switch to ${tab.name} failed:`, err.message);
      results.mobile.bottomNavTransitions.push({
        name: tab.name,
        status: 'ERROR',
        error: err.message,
        durationMs: null
      });
    }
    await mPage.waitForTimeout(300);
  }

  await mCtx.close();
  await browser.close();

  // Save baseline results to file
  const outPath = `${artifactDir}/benchmark_baseline_raw.json`;
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n=== BASELINE BENCHMARK COMPLETE ===`);
  console.log(`Saved baseline results to: ${outPath}`);
  console.log(JSON.stringify(results, null, 2));
}

runBaselineBenchmark().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
