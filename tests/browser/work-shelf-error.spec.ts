import { expect, test } from '@playwright/test';

test('shows a recoverable error when loading more works fails', async ({ page }) => {
  await page.route('**/shelf-error-fixture', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><div id="app"></div><script type="module" src="/tests/fixtures/work-shelf-entry.ts"></script>'
  }));
  let attempts = 0;
  await page.route('**/api/works?*', route => {
    expect(new URL(route.request().url()).searchParams.get('include_total')).toBe('false');
    attempts++;
    return attempts === 1
      ? route.fulfill({ status: 503, json: { error: 'Indisponível' } })
      : route.fulfill({ json: { works: [{ id: 'two', slug: 'two', title: 'Segunda história', kind: 'MANGA' }], hasMore: false } });
  });
  await page.goto('/shelf-error-fixture');
  await page.getByRole('button', { name: 'Expandir histórias' }).click();
  await expect(page.getByRole('status')).toContainText('Não foi possível carregar mais obras');
  await page.getByRole('button', { name: 'Carregar mais em Histórias' }).click();
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByText('Segunda história')).toBeVisible();
  expect(attempts).toBe(2);
});
