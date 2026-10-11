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

for (const width of [360, 1440]) {
  test(`profile media remains a local draft at ${width}px`, async ({ page }, testInfo) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.route('**/qa-my-space**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body style="margin:0;background:#07040d"><div id="my-space"></div><script>globalThis.__sveltekit_dev={env:{}};</script><script type="module" src="/tests/fixtures/my-space-entry.ts"></script></body></html>'
      })
    );
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/qa-my-space', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Editar Perfil/i }).click();
    await expect(page.getByRole('heading', { name: 'Editar Perfil' })).toBeVisible();

    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'avatar.gif',
      mimeType: 'image/gif',
      buffer: gif
    });
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /Salvar Enquadramento/i }).click();
    await expect(page.getByText(/pronto para prévia/i)).toBeVisible();
    await expect(page.locator('img[src^="blob:"]')).toBeVisible();
    expect(requests.some((url) => /\/api\/(avatar|banner)/.test(url))).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`profile-draft-${width}.png`), fullPage: true });

    await page.getByRole('button', { name: /Cancelar alterações/i }).click();
    await expect(page.getByText(/perfil oficial não foi modificado/i)).toBeVisible();
    await expect(page.locator('img[src^="blob:"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
