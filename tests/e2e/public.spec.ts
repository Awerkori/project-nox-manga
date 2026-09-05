import { test, expect } from '@playwright/test';
test('visitor cannot enter any administrative route or modify the API', async ({ request }) => {
  for (const path of ['/admin', '/admin/obras', '/admin/gestao'])
    expect((await request.get(path)).status()).toBe(403);
  expect(
    (await request.post('/api/action', { data: { scope: 'owner', action: 'role', data: {} } })).status()
  ).toBe(403);
  expect((await request.get('/api/staff?work=00000000-0000-4000-8000-000000000000')).status()).toBe(401);
  expect((await request.get('/api/staff-access')).status()).toBe(403);
  expect(
    (
      await request.post('/api/staff-access', { data: { id: '00000000-0000-4000-8000-000000000000' } })
    ).status()
  ).toBe(403);
  expect((await request.get('/media/00000000-0000-4000-8000-000000000000')).status()).toBe(404);
});
test('public catalog is read-only and has no provider or staff fields', async ({ request }) => {
  const response = await request.get('/api/v1/works');
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(Array.isArray(body.data)).toBe(true);
  for (const work of body.data) {
    expect(work.published).toBe(true);
    expect(work).not.toHaveProperty('source_id');
    expect(work).not.toHaveProperty('provider_key');
  }
  expect(
    (await request.post('/api/v1/works', { data: { title: 'unauthorized' } })).status()
  ).toBeGreaterThanOrEqual(400);
});
for (const width of [390, 768, 1440])
  test(`navigation and layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('link', { name: 'Encontrar minha próxima leitura' }).click();
    await expect(page).toHaveURL(/catalogo/);
    await page.getByLabel('Título da obra').fill('Uma busca sem resultado');
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Nenhuma história com esses filtros.' })).toBeVisible();
    expect(errors).toEqual([]);
  });
