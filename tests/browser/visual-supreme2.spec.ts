import { test, expect } from '@playwright/test';
import * as fs from 'fs';

const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854';
const SCREENSHOT_DIR = `${ARTIFACT_DIR}/screenshots/supreme2`;

const VIEWPORTS = [
  { name: 'mobile-360x800', width: 360, height: 800 },
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'mobile-412x915', width: 412, height: 915 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'tablet-820x1180', width: 820, height: 1180 },
  { name: 'desktop-1366x768', width: 1366, height: 768 },
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'desktop-1920x1080', width: 1920, height: 1080 }
];

async function setupPreviewRoutes(page: any) {
  await page.context().addCookies([
    { name: 'nox-age-status', value: 'ADULT', domain: '127.0.0.1', path: '/' },
    { name: 'nox-blur-nsfw', value: 'false', domain: '127.0.0.1', path: '/' }
  ]);

  await page.addInitScript(() => {
    try {
      localStorage.setItem('nox-age-status', 'ADULT');
      localStorage.setItem('nox-blur-nsfw', 'false');
    } catch (e) {}
  });

  // 1. Admin Preview Route
  await page.route('**/preview-admin*', (route: any) => {
    route.fulfill({
      contentType: 'text/html',
      body: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Preview</title>
</head>
<body style="margin:0; background:#07040d;">
  <div id="preview-root"></div>
  <script type="module" src="/tests/fixtures/admin-preview-entry.ts"></script>
</body>
</html>`
    });
  });

  // 2. Reader Route
  await page.route('**/qa-reader*', (route: any) => {
    route.fulfill({
      contentType: 'text/html',
      body: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reader Preview</title>
</head>
<body style="margin:0; background:#06070c;">
  <div id="reader"></div>
  <script type="module" src="/tests/fixtures/reader-entry.ts"></script>
</body>
</html>`
    });
  });

  // Mock reactions API
  await page.route('**/api/chapter-reactions*', (route: any) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        counts: { heart: 42, fire: 89, cry: 7, shock: 15, laugh: 23 },
        userReactions: ['fire']
      })
    });
  });

  // Mock media placeholders
  await page.route('**/media/**', (route: any) => {
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
        'base64'
      )
    });
  });
}

test.describe('Supreme 2 Visual & Responsive Audit', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  });

  // 1. WORK PAGE
  test('1. Work Page visual layout, reading CTAs, and contextual comments', async ({ page }) => {
    test.setTimeout(120000);
    await setupPreviewRoutes(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/obra/cronicas-do-demonio-de-sangue', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.work-page-container', { timeout: 15000 });
      await page.waitForTimeout(200);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow, `Horizontal overflow on Work page at ${vp.name}`).toBe(false);

      if (vp.width <= 860) {
        const mobileCta = page.locator('.btn-read-hero.mobile-only');
        await expect(mobileCta).toBeVisible();
        const box = await mobileCta.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThan(180);

        const desktopCta = page.locator('.btn-read-chapters-desktop');
        await expect(desktopCta).toBeHidden();
      } else {
        const desktopCta = page.locator('.btn-read-chapters-desktop');
        await expect(desktopCta).toBeVisible();

        const mobileCta = page.locator('.btn-read-hero.mobile-only');
        await expect(mobileCta).toBeHidden();
      }

      const commentsHeading = page.locator('.comments .section-heading h2');
      await expect(commentsHeading).toContainText('O que você achou desta obra?');
      const commentsEyebrow = page.locator('.comments .section-heading .eyebrow');
      await expect(commentsEyebrow).toContainText('AVALIAÇÕES & DISCUSSÃO');

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/work-hero-${vp.name}.png`,
        fullPage: false
      });
    }
  });

  // 2. READER
  test('2. Reader UI controls sync and end screen', async ({ page }) => {
    test.setTimeout(120000);
    await setupPreviewRoutes(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/qa-reader');
      await page.waitForSelector('.reader-end', { timeout: 15000 });
      await page.waitForTimeout(200);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow, `Horizontal overflow on Reader at ${vp.name}`).toBe(false);

      const backTop = page.locator('.back-top');
      await expect(backTop).toBeAttached();
      await expect(backTop).not.toHaveClass(/ui-hidden/);

      await page.evaluate(() => {
        document.querySelector('.reader-end')?.scrollIntoView({ behavior: 'instant' });
      });
      await page.waitForTimeout(200);

      const readerEndEyebrow = page.locator('.reader-comments .comments .section-heading .eyebrow');
      await expect(readerEndEyebrow).toContainText('DEPOIS DA ÚLTIMA PÁGINA');
      const readerEndHeading = page.locator('.reader-comments .comments .section-heading h2');
      await expect(readerEndHeading).toContainText('O que você achou deste capítulo?');

      await expect(page.locator('.chapter-reactions-cluster')).toBeVisible();

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/reader-end-supreme-${vp.name}.png`,
        fullPage: false
      });
    }
  });

  // 3. ADMIN DASHBOARD & MOBILE DRAWER
  test('3. Admin Dashboard layout, mobile thumb FAB, and clean triage', async ({ page }) => {
    test.setTimeout(120000);
    await setupPreviewRoutes(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/preview-admin?view=dashboard&role=ADMIN');
      await page.waitForSelector('.editorial-workspace', { timeout: 15000 });
      await page.waitForTimeout(200);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow, `Horizontal overflow on Admin Dashboard at ${vp.name}`).toBe(false);

      const duplicateBar = page.locator('.admin-mobile-bar');
      expect(await duplicateBar.count()).toBe(0);

      if (vp.width <= 950) {
        const fab = page.locator('.mobile-admin-fab');
        await expect(fab).toBeVisible();

        await fab.click();
        await page.waitForSelector('.admin-sidebar.open', { timeout: 5000 });
        const drawerClose = page.locator('.drawer-close-btn');
        await expect(drawerClose).toBeVisible();

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/admin-drawer-open-${vp.name}.png`,
          fullPage: false
        });

        await drawerClose.click();
        await page.waitForTimeout(200);
      } else {
        const fab = page.locator('.mobile-admin-fab');
        await expect(fab).toBeHidden();
      }

      const triage = page.locator('.triage-section');
      await expect(triage).toBeVisible();
      await expect(page.locator('.triage-alert-banner')).toBeHidden();

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/admin-dashboard-triage-${vp.name}.png`,
        fullPage: false
      });
    }
  });

  // 4. HOME PAGE
  test('4. Home page canvas snow, 2-column footer, and banner removal', async ({ page }) => {
    test.setTimeout(120000);
    await setupPreviewRoutes(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('main', { timeout: 15000 });
      await page.waitForTimeout(200);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow, `Horizontal overflow on Home page at ${vp.name}`).toBe(false);

      const snowCanvas = page.locator('canvas.particle-canvas');
      await expect(snowCanvas).toBeAttached();
      await expect(snowCanvas).toBeVisible();

      const universeBanner = page.locator('.explore-catalog-banner');
      expect(await universeBanner.count()).toBe(0);

      const footerCommunity = page.locator('.footer-community');
      expect(await footerCommunity.count()).toBe(0);

      const footer = page.locator('.site-footer');
      await expect(footer).toBeVisible();

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/home-hero-${vp.name}.png`,
        fullPage: false
      });

      await page.evaluate(() => {
        document.querySelector('.site-footer')?.scrollIntoView({ behavior: 'instant' });
      });
      await page.waitForTimeout(200);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/home-footer-${vp.name}.png`,
        fullPage: false
      });
    }
  });
});
