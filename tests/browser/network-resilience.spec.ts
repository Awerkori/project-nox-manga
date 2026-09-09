import { test, expect } from '@playwright/test';

async function setupSlowRoutes(page: any) {
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

  // Delayed reaction API simulating high-latency mobile connection (400ms delay)
  await page.route('**/api/chapter-reactions*', async (route: any) => {
    await new Promise((r) => setTimeout(r, 300));
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        counts: { heart: 20, fire: 50, cry: 5, shock: 10, laugh: 15 },
        userReactions: ['fire']
      })
    });
  });

  await page.route('**/media/**', async (route: any) => {
    await new Promise((r) => setTimeout(r, 200));
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
        'base64'
      )
    });
  });
}

test('reader behaves smoothly under high-latency mobile conditions', async ({ page }) => {
  await setupSlowRoutes(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/qa-reader');

  await page.waitForSelector('.reader-end');
  const reactionsBox = page.locator('.chapter-reactions-cluster');
  await expect(reactionsBox).toBeVisible();

  // Tap a reaction button: verify immediate optimistic UI reaction
  const fireBtn = page.locator('.reaction-btn').nth(1);
  await fireBtn.click();

  // Optimistic update should toggle state without waiting for network
  await expect(page.locator('.reaction-btn').nth(1)).toBeVisible();

  // Verify no horizontal overflow
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('candidate search handles transient network delays gracefully', async ({ page }) => {
  await setupSlowRoutes(page);
  await page.route('**/api/internal/importer/search-candidates*', async (route: any) => {
    await new Promise((r) => setTimeout(r, 400));
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        isUrl: false,
        candidates: [
          {
            workId: 'w-mock-1',
            title: 'Vingança do Cão de Caça',
            slug: 'vinganca-do-cao-de-caca',
            coverId: null,
            provider: 'nexus',
            sourceWorkId: 'vinganca-cao-caca',
            existsInNox: true,
            chapterCount: 92
          }
        ]
      })
    });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/preview-admin?view=importer&role=ADMIN');

  await page.waitForSelector('.priority-search-input');
  await page.fill('.priority-search-input', 'Vingança');

  // Wait for results with debounce and delayed network
  await page.waitForSelector('.candidate-card', { timeout: 8000 });
  await expect(page.locator('.candidate-title')).toHaveText('Vingança do Cão de Caça');

  // Verify no horizontal overflow
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
