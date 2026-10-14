import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'mobile-320', width: 320, height: 700 },
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1366', width: 1366, height: 900 },
  { name: 'desktop-1920', width: 1920, height: 1080 }
];

async function preview(page: any) {
  await page.route('**/preview-work', (route: any) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#07040d"><div id="preview-root"></div><script type="module" src="/tests/fixtures/work-page-preview-entry.ts"></script></body></html>'
  }));
}

test('work redesign remains intentional and usable from 320px through desktop', async ({ page }) => {
  await preview(page);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/preview-work');
    await expect(page.locator('.work-hero')).toBeVisible();
    await expect(page.getByRole('heading', { name: /títulos alternativos/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /gêneros e tags/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^capítulos$/i })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${viewport.name} has horizontal overflow`).toBe(true);
    await page.screenshot({ path: `test-results/work-page-redesign/${viewport.name}.png`, fullPage: true });
  }
});

test('alternative titles expand and chapter labels omit the site-default language', async ({ page }) => {
  await preview(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/preview-work');
  await expect(page.getByRole('button', { name: /ver todos/i })).toBeVisible();
  await page.getByRole('button', { name: /ver todos/i }).click();
  await expect(page.getByText('Romanized Alternate Title')).toBeVisible();
  await expect(page.locator('.chapter-name').first()).toHaveText('Capítulo 1');
  await expect(page.getByText('Capítulo 5 · en', { exact: true })).toBeVisible();
  await expect(page.getByText('Capítulo 12.10', { exact: true })).toBeVisible();
  await expect(page.getByText('Capítulo 7 · collector', { exact: true })).toBeVisible();
  await expect(page.locator('.chapter-list')).not.toContainText('pt-BR');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
