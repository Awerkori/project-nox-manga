import { test, expect } from '@playwright/test';

for (const width of [390, 768, 1366, 1440])
  test(`member pages and pagination at ${width}px`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/qa-member?*', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="member"></div><script type="module" src="/tests/fixtures/member-entry.ts"></script></body></html>'
      })
    );
    await page.setViewportSize({ width, height: 900 });
    for (const area of ['biblioteca', 'favoritos', 'historico', 'notificacoes', 'perfil']) {
      await page.goto(`/qa-member?area=${area}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (area !== 'perfil') {
        const pagination = page.getByRole('navigation', { name: 'Paginação' });
        await expect(pagination).toContainText('Página 6 de 7');
        const filter =
          area === 'biblioteca' ? 'status=READING&' : area === 'notificacoes' ? 'filtro=nao-lidas&' : '';
        await expect(pagination.getByRole('link', { name: 'Anterior' })).toHaveAttribute(
          'href',
          `/${area}?${filter}pagina=5`
        );
        await expect(pagination.getByRole('link', { name: 'Próxima' })).toHaveAttribute(
          'href',
          `/${area}?${filter}pagina=7`
        );
      } else {
        await expect(page.getByRole('navigation', { name: 'Paginação' })).toHaveCount(0);
        await expect(page.getByText('Obras na biblioteca', { exact: true })).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath('profile.png') });
      }
    }
    expect(errors).toEqual([]);
  });
