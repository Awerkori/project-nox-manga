import { test, expect } from '@playwright/test';

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
        counts: { heart: 12, fire: 34, cry: 2, shock: 5, laugh: 8 },
        userReactions: ['heart']
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

test.describe('Cross-Browser Validation: Chromium & Firefox', () => {
  test('reader layout, reactions & drawer render without horizontal overflow', async ({ page }) => {
    await setupPreviewRoutes(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/qa-reader');

    await page.waitForSelector('.reader-end');
    const isOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflow).toBe(false);

    // Click to open drawer
    const drawerBtn = page.locator('.btn-nav-drawer').first();
    if (await drawerBtn.isVisible()) {
      await drawerBtn.click();
      await page.waitForSelector('.drawer-panel');
      const drawerOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(drawerOverflow).toBe(false);
      await page.locator('.btn-drawer-close').click();
    }
  });

  test('admin importer search & priority hero card render cleanly', async ({ page }) => {
    await setupPreviewRoutes(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/preview-admin?view=importer&role=ADMIN');

    await page.waitForSelector('.priority-hero-card');
    await page.waitForSelector('.priority-entry-card');

    const isOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflow).toBe(false);
  });

  test('admin staff management workspace renders cleanly', async ({ page }) => {
    await setupPreviewRoutes(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/preview-admin?view=staff&role=ADMIN');

    await page.waitForSelector('.staff-workspace');

    const isOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflow).toBe(false);
  });
});
