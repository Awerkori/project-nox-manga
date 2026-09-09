import { test, expect } from '@playwright/test';
import * as fs from 'fs';

const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854';
const SCREENSHOT_DIR = `${ARTIFACT_DIR}/screenshots/evolution`;

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

  await page.route('**/api/chapter-reactions*', (route: any) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        counts: { heart: 42, fire: 89, cry: 7, shock: 15, laugh: 23 },
        userReactions: ['fire']
      })
    });
  });

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

test('visual audit evolution features and verify zero horizontal overflow', async ({ page }) => {
  test.setTimeout(180000);
  await setupPreviewRoutes(page);

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  // 1. Audit Reader End Screen & Reactions
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/qa-reader');
    await page.waitForSelector('.reader-end');

    await page.evaluate(() => {
      const el = document.querySelector('.reader-end');
      el?.scrollIntoView({ behavior: 'instant' });
    });
    await page.waitForTimeout(400);

    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasOverflow, `Overflow in Reader at ${vp.name}`).toBe(false);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/reader-end-${vp.name}.png`,
      fullPage: false
    });

    const drawerBtn = page.locator('.btn-nav-drawer').first();
    if (await drawerBtn.isVisible()) {
      await drawerBtn.click();
      await page.waitForSelector('.drawer-panel');
      await page.waitForTimeout(300);

      const drawerOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(drawerOverflow, `Drawer overflow in Reader at ${vp.name}`).toBe(false);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/reader-drawer-${vp.name}.png`,
        fullPage: false
      });

      await page.locator('.btn-drawer-close').click();
      await page.waitForTimeout(200);
    }
  }

  // 2. Audit Importer Priority Hero Banner
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/preview-admin?view=importer&role=ADMIN');
    await page.waitForSelector('.priority-hero-card');

    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasOverflow, `Overflow in Importer at ${vp.name}`).toBe(false);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/admin-importer-hero-${vp.name}.png`,
      fullPage: false
    });
  }

  // 3. Audit Staff Management Page
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/preview-admin?view=staff&role=ADMIN');
    await page.waitForSelector('.staff-workspace');

    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasOverflow, `Overflow in Staff at ${vp.name}`).toBe(false);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/admin-staff-${vp.name}.png`,
      fullPage: false
    });
  }

  // 4. Audit Admin Dashboard Triage Section
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/preview-admin?view=dashboard&role=ADMIN');
    await page.waitForSelector('.triage-section');

    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasOverflow, `Overflow in Dashboard at ${vp.name}`).toBe(false);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/admin-dashboard-triage-${vp.name}.png`,
      fullPage: false
    });
  }
});
