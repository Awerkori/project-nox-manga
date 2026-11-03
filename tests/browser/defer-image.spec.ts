import { expect, test } from '@playwright/test';

test('loads covers near the viewport and defers distant covers until scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.route('**/deferred-preview', (route) => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><img id="near" width="20" height="20" data-cover="/near.svg">
      <div style="height:3000px"></div><img id="far" width="20" height="20" data-cover="/far.svg">
      <script type="module" src="/tests/fixtures/defer-image-entry.ts"></script>`
  }));
  await page.route('**/*.svg', (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }));
  await page.goto('/deferred-preview');
  await expect(page.locator('#near')).toHaveAttribute('src', '/near.svg');
  await expect(page.locator('#far')).not.toHaveAttribute('src', /.+/);
  await page.locator('#far').scrollIntoViewIfNeeded();
  await expect(page.locator('#far')).toHaveAttribute('src', '/far.svg');
  await page.locator('#far').evaluate((image) => image.dispatchEvent(new CustomEvent('cover-change', { detail: '/updated.svg' })));
  await expect(page.locator('#far')).toHaveAttribute('src', '/updated.svg');
});
