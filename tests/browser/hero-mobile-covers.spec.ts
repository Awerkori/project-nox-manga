import { expect, test } from '@playwright/test';

for (const width of [390, 768]) test(`does not eagerly download the hidden previous hero cover at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  const imageRequests: string[] = [];
  await page.route('**/hero-mobile-fixture', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><div id="app"></div><script type="module" src="/tests/fixtures/hero-carousel-entry.ts"></script>'
  }));
  await page.route('**/fixture-*.svg', (route) => {
    imageRequests.push(new URL(route.request().url()).pathname);
    return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>' });
  });
  await page.goto('/hero-mobile-fixture');
  await expect(page.locator('.cover-img')).toBeVisible();
  await expect(page.locator('.deck-prev')).toBeHidden();
  await expect(page.locator('.cover-img')).toHaveJSProperty('complete', true);
  expect(imageRequests).toContain('/fixture-active.svg');
  expect(imageRequests).not.toContain('/fixture-previous.svg');
});

test('loads the previous cover when the desktop deck is visible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/hero-desktop-fixture', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><div id="app"></div><script type="module" src="/tests/fixtures/hero-carousel-entry.ts"></script>'
  }));
  await page.route('**/fixture-*.svg', (route) => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>'
  }));
  await page.goto('/hero-desktop-fixture');
  const previous = page.locator('.deck-prev img');
  await expect(previous).toBeVisible();
  await expect(previous).toHaveJSProperty('naturalWidth', 20);
});
