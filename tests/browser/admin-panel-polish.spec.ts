import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-412', width: 412, height: 915 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'tablet-1024', width: 1024, height: 768 },
  { name: 'desktop-1366', width: 1366, height: 768 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1920', width: 1920, height: 1080 }
];

async function preview(page: any) {
  await page.route('**/preview-admin*', (route: any) => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#07040d"><div id="preview-root"></div><script type="module" src="/tests/fixtures/admin-preview-entry.ts"></script></body></html>`
  }));
}

test('Scan actions remain fully reachable at every supported viewport', async ({ page }) => {
  await preview(page);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/preview-admin?view=scans&role=ADMIN');
    await expect(page.locator('.scan-card').nth(1)).toBeVisible();
    await expect(page.locator('.scan-card').nth(1).locator('.footer-actions .btn-icon')).toHaveCount(4);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `${viewport.name} must not have accidental horizontal overflow`).toBe(false);

    for (const label of [/alterar status/i, /liderança/i, /editar/i, /excluir/i]) {
      await expect(page.locator('.scan-card').nth(1).getByRole('button', { name: label })).toBeVisible();
    }

    await page.screenshot({ path: `test-results/admin-panel-polish/scans-${viewport.name}.png`, fullPage: true });
  }

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/preview-admin?view=scans&role=ADMIN');
  await page.getByRole('button', { name: /editar scan parceiros da aurora editorial/i }).click();
  await expect(page.getByRole('dialog', { name: /editar scan/i })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.mouse.click(5, 5);
  await expect(page.getByRole('dialog', { name: /editar scan/i })).toHaveCount(0);
});

test('Importer tabs are shallow and the mobile drawer exposes every destination', async ({ page }) => {
  await preview(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/preview-admin?view=importer&role=ADMIN');
  await expect(page.locator('.importer-dashboard')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  let importerRouteRequest = false;
  page.on('request', (request) => {
    if (request.url().includes('/admin/importer?tab=')) importerRouteRequest = true;
  });
  const tabSwitchStartedAt = performance.now();
  await page.locator('.importer-tabs-nav button').nth(1).click();
  await expect(page.locator('.sources-panel, .sources-list')).toBeVisible();
  const tabSwitchMs = performance.now() - tabSwitchStartedAt;
  await expect(page.locator('.importer-tabs-nav button.active')).toContainText('Fontes');
  expect(importerRouteRequest).toBe(false);
  expect(tabSwitchMs, 'a loaded snapshot must switch tabs without a server wait').toBeLessThan(200);
  console.log(`Importer shallow tab switch: ${Math.round(tabSwitchMs)}ms`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/admin-panel-polish/importer-mobile-fontes.png', fullPage: true });

  await page.getByRole('button', { name: /Menu do painel/i }).click();
  await expect(page.locator('.admin-sidebar.open')).toBeVisible();
  await expect.poll(async () => page.locator('.admin-sidebar').evaluate((element) => Math.round(element.getBoundingClientRect().left))).toBe(0);
  await expect(page.locator('.admin-sidebar').getByText('Capítulos Faltando')).toBeVisible();
  await expect(page.locator('.admin-sidebar').getByText('Configurações')).toBeVisible();
  await page.screenshot({ path: 'test-results/admin-panel-polish/importer-mobile-drawer.png', fullPage: false });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/preview-admin?view=importer&role=ADMIN');
  await expect(page.locator('.importer-dashboard')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('.importer-tabs-nav').getByRole('button', { name: 'Capítulos Faltando' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/admin-panel-polish/importer-desktop-resumo.png', fullPage: false });
});
