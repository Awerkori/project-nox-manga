import { expect, test } from '@playwright/test';

test('the particle animation reuses the stationary cursor gradient and refreshes it on movement', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.createRadialGradient;
    (window as any).gradientCalls = 0;
    CanvasRenderingContext2D.prototype.createRadialGradient = function (...args) {
      (window as any).gradientCalls++;
      return original.apply(this, args);
    };
  });
  await page.route('**/particle-preview', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><div id="particle"></div><script type="module" src="/tests/fixtures/particle-entry.ts"></script>'
  }));
  await page.goto('/particle-preview');
  await page.locator('canvas').waitFor();
  await page.mouse.move(300, 200);
  await expect.poll(() => page.evaluate(() => (window as any).gradientCalls)).toBe(1);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => (window as any).gradientCalls)).toBe(1);
  await page.mouse.move(400, 250);
  await expect.poll(() => page.evaluate(() => (window as any).gradientCalls)).toBe(2);
});
