import { chromium, expect } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';

// Uses the real Manga owner. Never creates accounts/content or accesses the staff project.
// Marking existing notifications read is explicitly opt-in.
const origin = process.env.TEST_BASE_URL;
if (!origin) throw new Error('TEST_BASE_URL is required');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const context = await browser.newContext();
  await context.addCookies(await ownerCookies(origin));
  const page = await context.newPage();
  let jsErrors = 0;
  let staffRequests = 0;
  let serverErrors = 0;
  page.on('pageerror', () => jsErrors++);
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/staff')) staffRequests++;
  });
  page.on('response', (response) => {
    if (response.url().startsWith(origin + '/') && response.status() >= 500) serverErrors++;
  });
  for (const width of [390, 768, 1366, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const area of ['biblioteca', 'favoritos', 'historico', 'notificacoes', 'perfil']) {
      const response = await page.goto(`${origin}/${area}`, { waitUntil: 'networkidle' });
      expect(response.status()).toBe(200);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      if (area === 'perfil') {
        await expect(page.getByText('Obras na biblioteca', { exact: true })).toBeVisible();
        await expect(page.getByText('Obras concluídas', { exact: true })).toBeVisible();
        await page.screenshot({ path: `artifacts/live-member-profile-${width}.png`, fullPage: true });
      }
    }
    console.log(`PASS: five real member pages at ${width}px`);
  }
  for (const path of [
    '/biblioteca?pagina=9999',
    '/biblioteca?status=PLANNED&pagina=9999',
    '/historico?pagina=9999',
    '/notificacoes?filtro=nao-lidas&pagina=9999'
  ]) {
    const response = await page.goto(origin + path, { waitUntil: 'networkidle' });
    expect(response.status()).toBe(200);
    expect(new URL(page.url()).searchParams.get('pagina')).not.toBe('9999');
    const source = new URL(origin + path);
    for (const filter of ['status', 'filtro'])
      expect(new URL(page.url()).searchParams.get(filter)).toBe(source.searchParams.get(filter));
  }
  console.log('PASS: invalid pages redirect safely and preserve filters');
  await page.goto(origin + '/biblioteca?status=READING', { waitUntil: 'networkidle' });
  await expect(page.locator('a[href="/obra/distant-sky"]').first()).toBeVisible();
  await page.goto(origin + '/biblioteca?status=PLANNED', { waitUntil: 'networkidle' });
  await expect(page.getByText('Nenhuma obra nesta lista.', { exact: true })).toBeVisible();
  console.log('PASS: real library status filters');
  if (process.env.NOX_MARK_NOTIFICATIONS_READ === '1') {
    await page.goto(origin + '/notificacoes?filtro=nao-lidas', { waitUntil: 'networkidle' });
    const read = page.getByRole('button', { name: 'Marcar todas como lidas' });
    if (await read.count()) {
      await expect(read).toBeEnabled();
      await read.click();
      await expect(page.getByRole('status')).toHaveText('Notificações marcadas como lidas.');
      await expect(page.getByText('Tudo em dia por aqui.', { exact: true })).toBeVisible();
      await page.reload({ waitUntil: 'networkidle' });
      await expect(page.getByText('Tudo em dia por aqui.', { exact: true })).toBeVisible();
      await page.getByRole('link', { name: 'Ver todas as notificações', exact: true }).click();
      await expect(page.locator('.stack > a.panel').first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Marcar todas como lidas' })).toBeDisabled();
      console.log('PASS: existing notification marked read, persisted and retained in all notifications');
    } else console.log('SKIP: no unread notification exists');
  }
  expect(jsErrors).toBe(0);
  expect(serverErrors).toBe(0);
  expect(staffRequests).toBe(0);
  console.log('PASS: no JavaScript/server errors or staff requests');
  await context.close();
} finally {
  await browser.close();
}
