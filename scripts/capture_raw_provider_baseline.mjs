import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function captureBaseline() {
  console.log('=== CAPTURING RAW PROVIDER BASELINE ===');
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

  // 1. Desktop 1440
  const dCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await dCtx.addCookies(cookies);
  const dPage = await dCtx.newPage();
  await dPage.goto(`${targetUrl}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle', timeout: 45000 });
  await dPage.waitForSelector('.pipeline-stage-view-root', { timeout: 25000 });
  await dPage.waitForTimeout(1000);
  await dPage.screenshot({ path: `${artifactDir}/raw_baseline_desktop_1440.png`, fullPage: false });
  await dPage.screenshot({ path: `${artifactDir}/raw_baseline_desktop_1440_full.png`, fullPage: true });
  await dCtx.close();

  // 2. Mobile 390
  const mCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  });
  await mCtx.addCookies(cookies);
  const mPage = await mCtx.newPage();
  await mPage.goto(`${targetUrl}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle', timeout: 45000 });
  await mPage.waitForSelector('.pipeline-stage-view-root', { timeout: 25000 });
  await mPage.waitForTimeout(1000);
  await mPage.screenshot({ path: `${artifactDir}/raw_baseline_mobile_390.png`, fullPage: false });
  await mPage.screenshot({ path: `${artifactDir}/raw_baseline_mobile_390_full.png`, fullPage: true });
  await mCtx.close();

  await browser.close();
  console.log('=== BASELINE CAPTURED SUCCESSFULLY ===');
}

captureBaseline().catch(console.error);
