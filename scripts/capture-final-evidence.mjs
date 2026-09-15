import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ownerCookies } from './owner-session.mjs';

const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854/scratch';
const prodUrl = 'https://manga.project-nox-awerkori.workers.dev';

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const cookies = await ownerCookies(prodUrl);
  const context = await browser.newContext();
  await context.addCookies([
    ...cookies,
    { name: 'nox-age-status', value: 'ADULT', url: prodUrl }
  ]);
  const page = await context.newPage();

  // 1. Admin Scans (Nexus Toons should no longer appear, only Project Nox)
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${prodUrl}/admin/scans`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: resolve(artifactDir, 'final-admin-scans.png'), fullPage: false });
  console.log('✓ Captured final-admin-scans.png');

  // Click on Auditoria Global tab
  const auditBtn = page.locator('button:has-text("Auditoria Global")').first();
  if (await auditBtn.count() > 0) {
    await auditBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: resolve(artifactDir, 'final-admin-audit-log.png'), fullPage: false });
    console.log('✓ Captured final-admin-audit-log.png');
  }

  // 2. Public Scans Directory
  await page.goto(`${prodUrl}/scans`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(artifactDir, 'final-public-scans.png'), fullPage: false });
  console.log('✓ Captured final-public-scans.png');

  // 3. Public Obra (The Last Real Man)
  await page.goto(`${prodUrl}/obra/the-last-real-man`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(artifactDir, 'final-public-obra.png'), fullPage: false });
  console.log('✓ Captured final-public-obra.png');

  // 4. Public Reader
  await page.goto(`${prodUrl}/ler/2c688944-b84c-4506-aa1e-6ec1c506ce7e`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: resolve(artifactDir, 'final-public-reader.png'), fullPage: false });
  console.log('✓ Captured final-public-reader.png');

  // 5. Official Scan Workspace (Project Nox) - Home, Minha Fila, Chat, Tutoriais, Branding
  const projectNoxId = '04872e99-37ad-4d45-aed4-35759d0eae33';
  await page.goto(`${prodUrl}/scan?id=${projectNoxId}&tab=home`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(artifactDir, 'final-projectnox-home.png'), fullPage: false });
  console.log('✓ Captured final-projectnox-home.png');

  await page.goto(`${prodUrl}/scan?id=${projectNoxId}&tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(artifactDir, 'final-projectnox-minha-fila.png'), fullPage: false });
  console.log('✓ Captured final-projectnox-minha-fila.png');

  await page.goto(`${prodUrl}/scan?id=${projectNoxId}&tab=chat`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(artifactDir, 'final-projectnox-chat.png'), fullPage: false });
  console.log('✓ Captured final-projectnox-chat.png');

  await page.goto(`${prodUrl}/scan?id=${projectNoxId}&tab=tutoriais`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(artifactDir, 'final-projectnox-tutoriais.png'), fullPage: false });
  console.log('✓ Captured final-projectnox-tutoriais.png');

  await page.goto(`${prodUrl}/scan?id=${projectNoxId}&tab=settings`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(artifactDir, 'final-projectnox-settings-branding.png'), fullPage: false });
  console.log('✓ Captured final-projectnox-settings-branding.png');

  await browser.close();
  console.log('=== ALL FINAL SCREENSHOTS CAPTURED SUCCESSFULLY ===');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
