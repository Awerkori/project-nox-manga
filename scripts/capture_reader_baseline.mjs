import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const PROD_URL = 'https://manga.project-nox-awerkori.workers.dev';
const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

for (const envPath of ['.dev.vars.deploy', '.dev.vars.preview_full', '.env']) {
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const l of lines) {
      const idx = l.indexOf('=');
      if (idx !== -1) {
        const k = l.slice(0, idx).trim();
        let v = l.slice(idx + 1).trim();
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        if (!process.env[k] && v) process.env[k] = v;
      }
    }
  }
}

const { ownerCookies } = await import('./owner-session.mjs');
const cookies = await ownerCookies(PROD_URL);

async function main() {
  console.log('=== CAPTURING BASELINE SCREENSHOTS OF CURRENT READER BEFORE REDESIGN ===');
  const browser = await chromium.launch({ headless: true });

  // Desktop Context
  const deskCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1
  });
  await deskCtx.addCookies([
    ...cookies,
    { name: 'nox-age-status', value: 'ADULT', url: PROD_URL }
  ]);
  const page = await deskCtx.newPage();

  // Navigate to real chapter
  const sampleChapterId = '9eb85b97-e6f9-407a-acb8-7a9c056727e5';
  console.log('Navigating to chapter:', `${PROD_URL}/ler/${sampleChapterId}`);
  await page.goto(`${PROD_URL}/ler/${sampleChapterId}`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);

  // 1. Top of reader with header and controls
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_reader_before_redesign_desktop_1440px.png') });
  console.log('Captured: 01_reader_before_redesign_desktop_1440px.png');

  // Open settings in current reader
  const settingsBtn = await page.$('button[aria-label="Ajustes de leitura"]');
  if (settingsBtn) {
    await settingsBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_reader_before_settings_desktop.png') });
    console.log('Captured: 01_reader_before_settings_desktop.png');
    await settingsBtn.click();
    await page.waitForTimeout(300);
  }

  // 2. End of chapter (celebration seal, reactions, navigation)
  const endSection = await page.$('.reader-end');
  if (endSection) {
    await endSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_reader_before_end_of_chapter_desktop.png') });
    console.log('Captured: 01_reader_before_end_of_chapter_desktop.png');
  }

  // 3. Chapter Comments
  const commentsSection = await page.$('.reader-comments');
  if (commentsSection) {
    await commentsSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_reader_before_comments_chapter_desktop.png') });
    console.log('Captured: 01_reader_before_comments_chapter_desktop.png');
  }

  // 4. Work page comments
  console.log('Navigating to work page: /obra/one-piece-ptbr');
  await page.goto(`${PROD_URL}/obra/one-piece-ptbr`, { waitUntil: 'networkidle', timeout: 20000 });
  const workComments = await page.$('.comments');
  if (workComments) {
    await workComments.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_reader_before_comments_work_desktop.png') });
    console.log('Captured: 01_reader_before_comments_work_desktop.png');
  }

  await deskCtx.close();

  // Mobile Context 390px
  const mobCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  await mobCtx.addCookies([
    ...cookies,
    { name: 'nox-age-status', value: 'ADULT', url: PROD_URL }
  ]);
  const mobPage = await mobCtx.newPage();
  await mobPage.goto(`${PROD_URL}/ler/${sampleChapterId}`, { waitUntil: 'networkidle', timeout: 20000 });
  await mobPage.waitForTimeout(1000);
  await mobPage.screenshot({ path: path.join(ARTIFACT_DIR, '01_reader_before_redesign_mobile_390px.png') });
  console.log('Captured: 01_reader_before_redesign_mobile_390px.png');

  await mobCtx.close();
  await browser.close();
  console.log('=== BASELINE SCREENSHOT CAPTURE COMPLETE ===');
}

main().catch(err => {
  console.error('Error capturing baseline:', err);
  process.exit(1);
});
