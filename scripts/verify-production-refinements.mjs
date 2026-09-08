import { chromium } from '@playwright/test';
import { copyFile, mkdir } from 'node:fs/promises';

const BASE_URL = process.env.TEST_BASE_URL || 'https://manga.project-nox-awerkori.workers.dev';
const ARTIFACTS_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854';

await mkdir('artifacts/refinements', { recursive: true });

console.log(`Verifying production refinements on: ${BASE_URL}`);

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext();
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

try {
  // 1. HOME TEST
  console.log('--- Testing Home ---');
  await page.setViewportSize({ width: 1366, height: 900 });
  const homeRes = await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  if (!homeRes || homeRes.status() >= 400) throw new Error(`Home failed with ${homeRes?.status()}`);

  // Assert genre strip is gone
  const genreStripCount = await page.locator('.genre-strip').count();
  if (genreStripCount > 0) throw new Error('FAIL: .genre-strip is still present on Home!');
  console.log('PASS: .genre-strip is completely removed.');

  // Assert Continue Reading has no duplicate works
  const continueCards = await page.locator('.continue-card').count();
  console.log(`Found ${continueCards} continue reading cards.`);
  if (continueCards > 0) {
    const titles = await page.locator('.continue-card strong').allInnerTexts();
    const uniqueTitles = new Set(titles);
    if (uniqueTitles.size !== titles.length) {
      throw new Error(`FAIL: Duplicate works in Continue Reading: ${titles.join(', ')}`);
    }
    console.log(`PASS: All continue reading cards are unique per work (${titles.join(', ')}).`);
  }

  // 2. RANKING TEST
  console.log('--- Testing Ranking (Desktop) ---');
  await page.goto(`${BASE_URL}/ranking`, { waitUntil: 'networkidle' });

  const badgeText = await page.locator('.badge-tag span').innerText();
  if (!badgeText.includes('CLASSIFICAÇÃO OFICIAL')) {
    throw new Error(`FAIL: Expected CLASSIFICAÇÃO OFICIAL badge, got: ${badgeText}`);
  }
  console.log('PASS: Ranking badge is CLASSIFICAÇÃO OFICIAL.');

  // Check desktop table is visible, mobile list is hidden
  const desktopVisible = await page.locator('.desktop-only').isVisible();
  const mobileVisible = await page.locator('.mobile-only').isVisible();
  if (!desktopVisible || mobileVisible) {
    throw new Error(`FAIL: Desktop ranking visibility incorrect. desktop: ${desktopVisible}, mobile: ${mobileVisible}`);
  }
  console.log('PASS: Desktop table is displayed and mobile cards are hidden on 1366px.');

  await page.screenshot({ path: 'artifacts/refinements/ranking-desktop.png' });
  await copyFile('artifacts/refinements/ranking-desktop.png', `${ARTIFACTS_DIR}/prod-ranking-desktop.png`);

  // Mobile Ranking test
  console.log('--- Testing Ranking (Mobile 390px) ---');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/ranking`, { waitUntil: 'networkidle' });

  const desktopMobileCheck = await page.locator('.desktop-only').isVisible();
  const mobileListCheck = await page.locator('.mobile-only').isVisible();
  if (desktopMobileCheck || !mobileListCheck) {
    throw new Error(`FAIL: Mobile ranking visibility incorrect. desktop: ${desktopMobileCheck}, mobile: ${mobileListCheck}`);
  }
  console.log('PASS: Mobile ranking cards are displayed and desktop table is hidden on 390px.');

  // Check overflow on 390px
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (hasOverflow) throw new Error('FAIL: Horizontal overflow detected on mobile ranking!');
  console.log('PASS: Zero horizontal overflow on mobile ranking (390px).');

  await page.screenshot({ path: 'artifacts/refinements/ranking-mobile.png' });
  await copyFile('artifacts/refinements/ranking-mobile.png', `${ARTIFACTS_DIR}/prod-ranking-mobile.png`);

  // 3. PUBLIC PROFILE TEST
  console.log('--- Testing Public Profile ---');
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${BASE_URL}/u/awerkori`, { waitUntil: 'networkidle' });

  const profileBadge = await page.locator('.badge-tag span').innerText();
  if (!profileBadge.includes('LEITOR NOX')) {
    throw new Error(`FAIL: Expected LEITOR NOX badge on public profile, got: ${profileBadge}`);
  }
  console.log('PASS: Public profile badge is LEITOR NOX.');

  const avatarFallback = page.locator('.profile-avatar-fallback');
  if (await avatarFallback.count() > 0) {
    const initialText = await avatarFallback.innerText();
    console.log(`Avatar initial on public profile: "${initialText}"`);
    if (initialText !== 'A') {
      console.warn(`Note: Initial is ${initialText}`);
    }
  }

  await page.screenshot({ path: 'artifacts/refinements/profile-public.png' });
  await copyFile('artifacts/refinements/profile-public.png', `${ARTIFACTS_DIR}/prod-profile-public.png`);

  // 4. MULTI-VIEWPORT OVERFLOW VALIDATION (390, 768, 1366, 1440)
  console.log('--- Testing Viewports for 0 Overflow ---');
  for (const w of [390, 768, 1366, 1440]) {
    await page.setViewportSize({ width: w, height: 900 });
    for (const p of ['/', '/catalogo', '/ranking']) {
      await page.goto(`${BASE_URL}${p}`, { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      if (overflow) {
        throw new Error(`FAIL: Overflow on ${p} at ${w}px!`);
      }
    }
  }
  console.log('PASS: Zero overflow verified across 390px, 768px, 1366px, 1440px on all primary pages.');

  if (errors.length > 0) {
    console.error('Page errors encountered:', errors);
    throw new Error('Errors encountered on pages.');
  }

  console.log('ALL PRODUCTION REFINEMENT CHECKS PASSED SUCCESSFULLY!');
} finally {
  await browser.close();
}
