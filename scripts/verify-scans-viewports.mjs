import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ownerCookies } from './owner-session.mjs';

const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854/scratch';
const prodUrl = 'https://manga.project-nox-awerkori.workers.dev';

// Exactly the 7 required viewports
const viewports = [
  { label: 'desktop-1920x1080', width: 1920, height: 1080 },
  { label: 'desktop-1440x900', width: 1440, height: 900 },
  { label: 'desktop-1366x768', width: 1366, height: 768 },
  { label: 'tablet-768x1024', width: 768, height: 1024 },
  { label: 'mobile-390x844', width: 390, height: 844 },
  { label: 'mobile-375x812', width: 375, height: 812 },
  { label: 'mobile-360x800', width: 360, height: 800 }
];

const publicRoutes = [
  { name: 'scans-directory', path: '/scans' },
  { name: 'nexus-toons-profile', path: '/scans/nexus-toons' },
  { name: 'obra-the-last-real-man', path: '/obra/the-last-real-man' },
  { name: 'user-profile-yuuki', path: '/u/yuuki_cordeiro' }
];

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const auditResults = [];

console.log('=== 1. AUDITING PUBLIC ROUTES ACROSS 7 VIEWPORTS ===');
const publicContext = await browser.newContext();
await publicContext.addCookies([
  { name: 'nox-age-status', value: 'ADULT', url: prodUrl }
]);

const page = await publicContext.newPage();

for (const vp of viewports) {
  await page.setViewportSize({ width: vp.width, height: vp.height });

  for (const r of publicRoutes) {
    const targetUrl = `${prodUrl}${r.path}`;
    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 35000 });
      await page.waitForTimeout(600);

      const metrics = await page.evaluate(() => {
        const body = document.body;
        const html = document.documentElement;
        const overflow = html.scrollWidth > window.innerWidth || body.scrollWidth > window.innerWidth;
        return {
          overflow,
          scrollWidth: Math.max(html.scrollWidth, body.scrollWidth),
          innerWidth: window.innerWidth
        };
      });

      const fileName = `${r.name}-${vp.label}.png`;
      const outPath = resolve(artifactDir, fileName);
      await page.screenshot({ path: outPath, fullPage: false });

      auditResults.push({
        route: r.name,
        viewport: vp.label,
        width: vp.width,
        height: vp.height,
        overflow: metrics.overflow,
        scrollWidth: metrics.scrollWidth,
        path: outPath
      });
      console.log(`  [${vp.label}] ${r.name} -> overflow: ${metrics.overflow} (${metrics.scrollWidth}px vs ${metrics.innerWidth}px)`);
    } catch (err) {
      console.error(`  [${vp.label}] ✗ Error on ${r.name}:`, err.message);
      auditResults.push({
        route: r.name,
        viewport: vp.label,
        width: vp.width,
        height: vp.height,
        error: err.message
      });
    }
  }
}

console.log('\n=== 2. AUDITING INTERACTIVE TABS ON PUBLIC SCAN PROFILE ===');
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${prodUrl}/scans/nexus-toons`, { waitUntil: 'networkidle', timeout: 35000 });
await page.waitForTimeout(600);

const tabsToTest = [
  { id: 'obras', selector: 'button:has-text("Obras")' },
  { id: 'capitulos', selector: 'button:has-text("Capítulos")' },
  { id: 'equipe', selector: 'button:has-text("Equipe")' },
  { id: 'recrutamento', selector: 'button:has-text("Recrutamento")' },
  { id: 'comentarios', selector: 'button:has-text("Comentários")' }
];

for (const t of tabsToTest) {
  try {
    const tabBtn = page.locator(t.selector).first();
    if (await tabBtn.count() > 0) {
      await tabBtn.click();
      await page.waitForTimeout(500);
      const fileName = `nexus-toons-tab-${t.id}.png`;
      const outPath = resolve(artifactDir, fileName);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`  ✓ Clicked tab "${t.id}" -> saved screenshot: ${fileName}`);
    }
  } catch (err) {
    console.error(`  ✗ Error testing tab ${t.id}:`, err.message);
  }
}

await publicContext.close();

console.log('\n=== 3. AUDITING AUTHENTICATED SCAN DASHBOARD ACROSS KEY VIEWPORTS ===');
try {
  const cookies = await ownerCookies(prodUrl);
  const authContext = await browser.newContext();
  await authContext.addCookies([
    ...cookies,
    { name: 'nox-age-status', value: 'ADULT', url: prodUrl }
  ]);
  const authPage = await authContext.newPage();

  const dashboardUrl = `${prodUrl}/scan?id=6c9b238c-4796-40a2-ae4a-6cad7cd4e378`;
  for (const vp of [
    { label: 'desktop-1920x1080', width: 1920, height: 1080 },
    { label: 'desktop-1440x900', width: 1440, height: 900 },
    { label: 'tablet-768x1024', width: 768, height: 1024 },
    { label: 'mobile-390x844', width: 390, height: 844 },
    { label: 'mobile-360x800', width: 360, height: 800 }
  ]) {
    await authPage.setViewportSize({ width: vp.width, height: vp.height });
    await authPage.goto(dashboardUrl, { waitUntil: 'networkidle', timeout: 35000 });
    await authPage.waitForTimeout(800);

    const metrics = await authPage.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      return {
        overflow: html.scrollWidth > window.innerWidth || body.scrollWidth > window.innerWidth,
        scrollWidth: Math.max(html.scrollWidth, body.scrollWidth),
        innerWidth: window.innerWidth
      };
    });

    const fileName = `scan-dashboard-${vp.label}.png`;
    const outPath = resolve(artifactDir, fileName);
    await authPage.screenshot({ path: outPath, fullPage: false });
    console.log(`  [${vp.label}] Scan Dashboard -> overflow: ${metrics.overflow} (${metrics.scrollWidth}px vs ${metrics.innerWidth}px)`);

    auditResults.push({
      route: 'scan-dashboard',
      viewport: vp.label,
      width: vp.width,
      height: vp.height,
      overflow: metrics.overflow,
      path: outPath
    });
  }

  // Also test Staff Notes (Mural da Staff) tab screenshot on desktop
  await authPage.setViewportSize({ width: 1440, height: 900 });
  const staffNotesTab = authPage.locator('button:has-text("Mural"), button:has-text("Staff")').first();
  if (await staffNotesTab.count() > 0) {
    await staffNotesTab.click();
    await authPage.waitForTimeout(500);
    const outPath = resolve(artifactDir, 'scan-dashboard-mural-staff.png');
    await authPage.screenshot({ path: outPath, fullPage: false });
    console.log('  ✓ Mural da Staff tab captured -> scan-dashboard-mural-staff.png');
  }

  // Also test Equipe tab screenshot on desktop
  const equipeTab = authPage.locator('button:has-text("Equipe")').first();
  if (await equipeTab.count() > 0) {
    await equipeTab.click();
    await authPage.waitForTimeout(500);
    const outPath = resolve(artifactDir, 'scan-dashboard-equipe-visibility.png');
    await authPage.screenshot({ path: outPath, fullPage: false });
    console.log('  ✓ Equipe tab captured -> scan-dashboard-equipe-visibility.png');
  }

  await authContext.close();
} catch (e) {
  console.error('Error auditing authenticated dashboard:', e.message);
}

await browser.close();

console.log('\n================ AUDIT SUMMARY ================');
const total = auditResults.length;
const overflows = auditResults.filter(r => r.overflow);
const errors = auditResults.filter(r => r.error);
console.log(`Total test passes: ${total}`);
console.log(`Horizontal Overflows: ${overflows.length}`);
console.log(`Page Load Errors: ${errors.length}`);

if (overflows.length > 0) {
  console.warn('⚠️ Horizontal overflow detected in:');
  for (const o of overflows) {
    console.warn(` - ${o.route} @ ${o.viewport}`);
  }
} else {
  console.log('🎉 PERFECT! 0 horizontal overflows detected across all tested viewports!');
}

