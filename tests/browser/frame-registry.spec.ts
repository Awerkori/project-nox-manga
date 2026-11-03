import { expect, test } from '@playwright/test';

test('custom and curated avatar frames render after separating the registry', async ({ page }) => {
  await page.route('**/frame-registry-preview', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><div id="app"></div><script type="module" src="/tests/fixtures/frame-registry-entry.ts"></script>'
  }));
  await page.route('**/__fixture-frame.svg', route => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>'
  }));
  await page.goto('/frame-registry-preview');
  await expect(page.locator('.avatar-custom-frame-asset')).toHaveAttribute('src', '/__fixture-frame.svg');
  await expect(page.locator('.user-avatar-root').nth(1)).toHaveClass(/frame-cosmic/);
});
