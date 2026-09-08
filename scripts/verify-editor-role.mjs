import { chromium, expect } from '@playwright/test';
import { editorCookies } from './user-session.mjs';

// Comprehensive live verification of real EDITOR role on production.
// Confirms that the editor can manage editorial content and is strictly forbidden from admin/owner features.
const origin = process.env.TEST_BASE_URL || 'https://manga.project-nox-awerkori.workers.dev';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies(await editorCookies(origin));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // 1. Allowed routes return 200 and display the editorial interface
  for (const route of ['/admin', '/admin/obras', '/admin/obras/nova', '/admin/tags']) {
    const response = await page.goto(origin + route, { waitUntil: 'networkidle' });
    console.log(JSON.stringify({ role: 'EDITOR', route, status: response.status() }));
    expect(response.status()).toBe(200);
    expect(errors.length).toBe(0);
  }
  console.log('PASS: EDITOR can access /admin, /admin/obras, /admin/obras/nova, /admin/tags');

  // Verify editorial sidebar: shows editorial navigation, hides administrative areas
  await page.goto(origin + '/admin', { waitUntil: 'networkidle' });
  await expect(page.getByText('Publicação e conteúdo')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Obras e capítulos' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Gêneros e tags' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Usuários e moderação' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Configurações' })).toHaveCount(0);
  console.log('PASS: editorial sidebar correctly hides administrative options');

  // 2. Forbidden administrative routes return 403
  for (const forbidden of ['/admin/gestao', '/admin/gestao/configuracoes']) {
    const response = await page.goto(origin + forbidden, { waitUntil: 'networkidle' });
    console.log(JSON.stringify({ role: 'EDITOR', forbidden, status: response.status() }));
    expect(response.status()).toBe(403);
  }
  console.log('PASS: EDITOR is blocked from /admin/gestao and /admin/gestao/configuracoes with HTTP 403');

  // 3. API endpoints requiring ADMIN role reject EDITOR calls with 403
  const apiRole = await context.request.post(origin + '/api/action', {
    data: { scope: 'owner', action: 'role', data: { id: '00000000-0000-4000-8000-000000000000', role: 'ADMIN' } }
  });
  expect(apiRole.status()).toBe(403);

  const apiDeleteWork = await context.request.post(origin + '/api/action', {
    data: { scope: 'owner', action: 'delete_work', data: { id: '00000000-0000-4000-8000-000000000000' } }
  });
  expect(apiDeleteWork.status()).toBe(403);

  const apiStaff = await context.request.get(origin + '/api/staff-access');
  expect(apiStaff.status()).toBe(403);

  const apiInvite = await context.request.post(origin + '/api/invite', {
    data: { email: 'forbidden@example.invalid' }
  });
  expect(apiInvite.status()).toBe(403);
  console.log('PASS: EDITOR cannot execute owner_action, delete_work, staff-access or invite RPCs (all 403)');

  // 4. Inspect work edit page: DeleteContent component is NOT rendered for EDITOR
  await page.goto(origin + '/admin/obras', { waitUntil: 'networkidle' });
  const workLink = await page.locator('a[href^="/admin/obras/"]').evaluateAll((links) =>
    links.map((l) => l.getAttribute('href')).find((href) => /^\/admin\/obras\/[0-9a-f-]{36}$/.test(href))
  );
  if (workLink) {
    await page.goto(origin + workLink, { waitUntil: 'networkidle' });
    await expect(page.getByText('Remoção definitiva — somente admin')).toHaveCount(0);
    console.log('PASS: DeleteContent component is completely hidden from EDITOR');
  }

  // 5. Test responsiveness in 4 resolutions for EDITOR without overflow
  for (const width of [390, 768, 1366, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const res = await page.goto(origin + '/admin', { waitUntil: 'networkidle' });
    expect(res.status()).toBe(200);
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(hasOverflow).toBe(false);
  }
  console.log('PASS: EDITOR admin interface responsive across 390px, 768px, 1366px, 1440px with no overflow');

  expect(errors.length).toBe(0);
  console.log('PASS: real EDITOR account fully validated in production!');
  await context.close();
} finally {
  await browser.close();
}
