import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ownerCookies } from './owner-session.mjs';

const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854/scratch';
const prodUrl = 'https://manga.project-nox-awerkori.workers.dev';

const viewports = [
  { label: 'desktop-1920x1080', width: 1920, height: 1080 },
  { label: 'desktop-1440x900', width: 1440, height: 900 },
  { label: 'desktop-1366x768', width: 1366, height: 768 },
  { label: 'tablet-768x1024', width: 768, height: 1024 },
  { label: 'mobile-390x844', width: 390, height: 844 },
  { label: 'mobile-375x812', width: 375, height: 812 },
  { label: 'mobile-360x800', width: 360, height: 800 }
];

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const sessionCookies = await ownerCookies(prodUrl);

console.log('=== STARTING COMPLETE SCANS ECOSYSTEM VERIFICATION ===');
console.log(`Production URL: ${prodUrl}`);

// Setup authenticated context
const authContext = await browser.newContext();
await authContext.addCookies([
  ...sessionCookies,
  { name: 'nox-age-status', value: 'ADULT', url: prodUrl }
]);
const page = await authContext.newPage();

// 1. Verify /scans/[slug]/painel redirect
console.log('\n--- 1. Testing /scans/nexus-toons/painel Redirect ---');
await page.goto(`${prodUrl}/scans/nexus-toons/painel`, { waitUntil: 'networkidle', timeout: 35000 });
const finalUrl = page.url();
console.log(`Redirected to: ${finalUrl}`);
if (!finalUrl.includes('/scan?id=')) {
  console.error(`FAIL: Expected redirect to /scan?id=..., got ${finalUrl}`);
} else {
  console.log('PASS: Correctly redirected to mini-backoffice /scan?id=...');
}

// 2. Test Global Admin /admin/scans
console.log('\n--- 2. Testing Global Admin (/admin/scans) ---');
await page.goto(`${prodUrl}/admin/scans`, { waitUntil: 'networkidle', timeout: 35000 });
await page.waitForTimeout(1000);

// Check tabs in global admin
const adminTabs = await page.$$eval('.admin-tab-btn', btns => btns.map(b => b.textContent.trim()));
console.log(`Admin Tabs detected: ${JSON.stringify(adminTabs)}`);

// Take full page screenshot of /admin/scans
await page.setViewportSize({ width: 1440, height: 900 });
await page.screenshot({ path: resolve(artifactDir, 'admin-scans-overview-1440x900.png') });

// Click on Audit Log tab
console.log('Clicking on Auditoria Global tab...');
await page.click('button:has-text("Auditoria Global")');
await page.waitForTimeout(600);
await page.screenshot({ path: resolve(artifactDir, 'admin-scans-audit-log-tab.png') });

// 3. Test Scan Backoffice (/scan) & Categories
console.log('\n--- 3. Testing Scan Backoffice (/scan) Tabs & Subcomponents ---');
const scanUrl = `${prodUrl}/scan?id=6c9b238c-4796-40a2-ae4a-6cad7cd4e378`;
await page.goto(scanUrl, { waitUntil: 'networkidle', timeout: 35000 });
await page.waitForTimeout(1000);

// Screenshot Visão Geral
await page.screenshot({ path: resolve(artifactDir, 'scan-bo-visao-geral.png') });

// Switch to Analytics subtab
console.log('Clicking on Métricas & Analytics...');
await page.click('button:has-text("Métricas & Analytics")');
await page.waitForTimeout(600);
await page.screenshot({ path: resolve(artifactDir, 'scan-bo-analytics.png') });

// Switch to Produção & Pipeline category
console.log('Switching category to Produção & Pipeline...');
await page.click('button:has-text("Produção & Pipeline")');
await page.waitForTimeout(600);
await page.screenshot({ path: resolve(artifactDir, 'scan-bo-pipeline.png') });

// Switch to Tasks subtab
console.log('Clicking on Central de Tarefas...');
await page.click('button:has-text("Central de Tarefas")');
await page.waitForTimeout(600);
await page.screenshot({ path: resolve(artifactDir, 'scan-bo-tasks.png') });

// Switch to Calendário subtab
console.log('Clicking on Calendário & Prazos...');
await page.click('button:has-text("Calendário & Prazos")');
await page.waitForTimeout(600);
await page.screenshot({ path: resolve(artifactDir, 'scan-bo-calendar.png') });

// Switch to Equipe & Vagas category
console.log('Switching category to Equipe & Vagas...');
await page.click('button:has-text("Equipe & Vagas")');
await page.waitForTimeout(600);
await page.screenshot({ path: resolve(artifactDir, 'scan-bo-team.png') });

// Switch to Onboarding subtab
console.log('Clicking on Onboarding Staff...');
await page.click('button:has-text("Onboarding Staff")');
await page.waitForTimeout(600);
await page.screenshot({ path: resolve(artifactDir, 'scan-bo-onboarding.png') });

// Switch to Recursos & Wiki category
console.log('Switching category to Recursos & Wiki...');
await page.click('button:has-text("Recursos & Wiki")');
await page.waitForTimeout(600);
await page.screenshot({ path: resolve(artifactDir, 'scan-bo-glossary.png') });

// Switch to Referências & Raws
console.log('Clicking on Referências & Raws...');
await page.click('button:has-text("Referências & Raws")');
await page.waitForTimeout(600);
await page.screenshot({ path: resolve(artifactDir, 'scan-bo-references.png') });

// Switch to Wiki Interna
console.log('Clicking on Wiki Interna...');
await page.click('button:has-text("Wiki Interna")');
await page.waitForTimeout(600);
await page.screenshot({ path: resolve(artifactDir, 'scan-bo-wiki.png') });

// Switch to Gestão & Modos category
console.log('Switching category to Gestão & Modos...');
await page.click('button:has-text("Gestão & Modos")');
await page.waitForTimeout(600);
await page.screenshot({ path: resolve(artifactDir, 'scan-bo-settings.png') });

// 4. Test 7 Viewports on Backoffice and Admin Scans
console.log('\n--- 4. Testing 7 Viewports Overflow Verification ---');
const testPages = [
  { name: 'scan-backoffice', url: scanUrl },
  { name: 'admin-scans', url: `${prodUrl}/admin/scans` }
];

const overflowAudit = [];
for (const vp of viewports) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  for (const tp of testPages) {
    await page.goto(tp.url, { waitUntil: 'networkidle', timeout: 35000 });
    await page.waitForTimeout(600);

    const metrics = await page.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;
      const scrollWidth = Math.max(html.scrollWidth, body.scrollWidth);
      const innerWidth = window.innerWidth;
      const overflow = scrollWidth > innerWidth + 1;
      return { overflow, scrollWidth, innerWidth };
    });

    const shotName = `${tp.name}-${vp.label}.png`;
    await page.screenshot({ path: resolve(artifactDir, shotName) });

    overflowAudit.push({
      page: tp.name,
      viewport: vp.label,
      width: vp.width,
      scrollWidth: metrics.scrollWidth,
      overflow: metrics.overflow
    });

    console.log(`Viewport ${vp.label} on ${tp.name}: innerWidth=${vp.width}, scrollWidth=${metrics.scrollWidth}, overflow=${metrics.overflow ? 'FAIL' : 'OK'}`);
  }
}

await browser.close();

console.log('\n=== SUMMARY OF OVERFLOW AUDIT ===');
const failedOverflows = overflowAudit.filter(a => a.overflow);
if (failedOverflows.length === 0) {
  console.log(`ALL ${overflowAudit.length} VIEWPORT TESTS PASSED WITH ZERO HORIZONTAL OVERFLOW!`);
} else {
  console.error(`FAILED OVERFLOW ON:`, failedOverflows);
}
