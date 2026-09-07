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
  expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow');
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
test('account forms are not indexed and published catalog remains indexable', async ({ request }) => {
  for (const path of ['/entrar', '/cadastrar', '/recuperar']) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow');
  }
  const catalog = await request.get('/catalogo');
  expect(catalog.status()).toBe(200);
  expect(catalog.headers()['x-robots-tag']).toBeUndefined();
});
test('published content has a readable cover, chapter API and progressive reader', async ({
  page,
  request
}) => {
  test.setTimeout(90000);
  const catalog = await (await request.get('/api/v1/works')).json();
  const work = catalog.data[0];
  test.skip(!work, 'No published work available for the content-dependent smoke test');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const width of [390, 768, 1366, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/obra/${work.slug}`, { waitUntil: 'networkidle' });
    const cover = page.getByAltText(`Capa de ${work.title}`);
    await expect(cover).toBeVisible();
    const box = await cover.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width / box!.height).toBeCloseTo(5 / 7, 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const chapters = await (await request.get(`/api/v1/works/${work.slug}/chapters`)).json();
  expect(chapters.data.length).toBeGreaterThan(0);
  const chapter = chapters.data[0];
  const manifest = await (await request.get(`/api/v1/chapters/${chapter.id}/pages`)).json();
  expect(manifest.data.length).toBeGreaterThan(0);
  for (const entry of manifest.data) {
    expect(Object.keys(entry).sort()).toEqual(['height', 'position', 'url', 'width']);
    expect(new URL(entry.url).pathname).toMatch(/^\/media\/[0-9a-f-]{36}$/);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/ler/${chapter.id}`, { waitUntil: 'networkidle' });
  await expect
    .poll(
      () =>
        page
          .locator('#pagina-1 img')
          .evaluateAll((images) =>
            images.some(
              (image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0
            )
          ),
      { timeout: 30000 }
    )
    .toBe(true);
  if (manifest.data.length > 3)
    expect(await page.locator('.reader-page img').count()).toBeLessThan(manifest.data.length);
  expect(errors).toEqual([]);
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
