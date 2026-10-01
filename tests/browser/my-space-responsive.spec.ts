import { test, expect } from '@playwright/test';

for (const width of [360, 390, 412, 768, 1024, 1366, 1440, 1920]) {
  test(`Meu Espaço remains usable at ${width}px`, async ({ page }, testInfo) => {
    await page.route('**/qa-my-space**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body style="margin:0;background:#07040d"><div id="my-space"></div><script>globalThis.__sveltekit_dev={env:{}};</script><script type="module" src="/tests/fixtures/my-space-entry.ts"></script></body></html>'
      })
    );
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/qa-my-space', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: /Leitor com nome/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Ver perfil público/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Visão Geral/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Visão Geral' })).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    if (width <= 412) {
      const publicLink = page.getByRole('link', { name: /Ver perfil público/i });
      const box = await publicLink.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(42);
    }

    await page.screenshot({ path: testInfo.outputPath(`my-space-${width}.png`), fullPage: true });
  });
}
