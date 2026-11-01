import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { join } from 'node:path';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function main() {
  console.log('Capturing expanded workspace screenshots...');
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

  try {
    // 1. DESKTOP EXPANDED TYPESET (Shows Dual Inputs + Delivery)
    console.log('Capturing Typeset Desktop expanded...');
    const deskCtx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await deskCtx.addCookies(cookies);
    const deskPage = await deskCtx.newPage();

    await deskPage.goto(`${targetUrl}/scan?tab=pipeline&stage=typeset`, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(2000);

    // Click Continuar to expand workspace
    const continueBtn = await deskPage.waitForSelector('.btn-toggle-workspace', { state: 'visible', timeout: 10000 });
    await continueBtn.click();
    await deskPage.waitForTimeout(1000);

    await deskPage.screenshot({ path: join(artifactDir, 'preview_typeset_desktop_expanded.png'), fullPage: false });

    // 2. ANDROID EXPANDED TYPESET (Shows mobile accordions)
    console.log('Capturing Typeset Android 390 expanded...');
    const mobCtx = await browser.newContext({
      viewport: { width: 390, height: 950 },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
    });
    await mobCtx.addCookies(cookies);
    const mobPage = await mobCtx.newPage();

    await mobPage.goto(`${targetUrl}/scan?tab=pipeline&stage=typeset`, { waitUntil: 'networkidle', timeout: 35000 });
    await mobPage.waitForTimeout(2000);

    const mobContinueBtn = await mobPage.waitForSelector('.btn-toggle-workspace', { state: 'visible', timeout: 10000 });
    await mobContinueBtn.click();
    await mobPage.waitForTimeout(1000);

    await mobPage.screenshot({ path: join(artifactDir, 'preview_typeset_android_expanded.png'), fullPage: false });

    // 3. DESKTOP EXPANDED TRADUÇÃO (Shows RAW input + Deliverable upload)
    console.log('Capturing Tradução Desktop expanded...');
    await deskPage.goto(`${targetUrl}/scan?tab=pipeline&stage=traducao`, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(2000);

    const tradContinueBtn = await deskPage.waitForSelector('.btn-toggle-workspace', { state: 'visible', timeout: 10000 });
    await tradContinueBtn.click();
    await deskPage.waitForTimeout(1000);

    await deskPage.screenshot({ path: join(artifactDir, 'preview_traducao_desktop_expanded.png'), fullPage: false });

    // 4. ANDROID EXPANDED TRADUÇÃO
    console.log('Capturing Tradução Android 390 expanded...');
    await mobPage.goto(`${targetUrl}/scan?tab=pipeline&stage=traducao`, { waitUntil: 'networkidle', timeout: 35000 });
    await mobPage.waitForTimeout(2000);

    const tradMobContinueBtn = await mobPage.waitForSelector('.btn-toggle-workspace', { state: 'visible', timeout: 10000 });
    await tradMobContinueBtn.click();
    await mobPage.waitForTimeout(1000);

    await mobPage.screenshot({ path: join(artifactDir, 'preview_traducao_android_expanded.png'), fullPage: false });

    await deskCtx.close();
    await mobCtx.close();
    console.log('Expanded workspace captures finished successfully!');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Expanded capture failed:', err);
  process.exit(1);
});
