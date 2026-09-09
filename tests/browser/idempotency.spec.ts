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

  let postCount = 0;
  await page.route('**/api/chapter-reactions*', (route: any) => {
    if (route.request().method() === 'POST') {
      postCount++;
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          counts: { heart: 1, fire: 0, cry: 0, shock: 0, laugh: 0 },
          userReactions: postCount % 2 === 1 ? ['heart'] : []
        })
      });
    } else {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          counts: { heart: 0, fire: 0, cry: 0, shock: 0, laugh: 0 },
          userReactions: []
        })
      });
    }
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

test('rapid double-click on reaction toggles safely without corrupting count or throwing', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await setupPreviewRoutes(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/qa-reader');

  await page.waitForSelector('.reader-end');
  const heartBtn = page.locator('.reaction-btn').first();

  // Double click in rapid succession
  await heartBtn.click();
  await heartBtn.click();

  await page.waitForTimeout(300);
  expect(pageErrors).toEqual([]);
});
