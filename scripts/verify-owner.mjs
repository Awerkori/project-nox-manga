import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const origin = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies(await ownerCookies(origin));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const route of [
    '/admin',
    '/admin/obras',
    '/admin/obras/nova',
    '/admin/tags',
    '/admin/gestao',
    '/admin/gestao/configuracoes',
    '/perfil',
    '/biblioteca',
    '/favoritos',
    '/historico',
    '/notificacoes'
  ]) {
    const response = await page.goto(origin + route, { waitUntil: 'networkidle' });
    console.log(JSON.stringify({ route, status: response.status(), errors }));
    if (errors.length) throw new Error(`JavaScript error on owner route: ${route}`);
    if (response.status() !== 200) throw new Error(`Owner route failed: ${route}`);
    await page.screenshot({ path: `artifacts/owner-${route.replaceAll('/', '-')}.png`, fullPage: true });
  }
  await page.goto(origin + '/admin/obras', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Importar obras da central' }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('[role=status]')?.textContent?.includes('rascunho') ||
      document.querySelector('[role=status]')?.textContent?.includes('sincronizado')
  );
  console.log('PASS: catálogo real da central importado como rascunho.');
  await page.getByRole('button', { name: 'Importar obras da central' }).click();
  await page.waitForFunction(() =>
    document.querySelector('[role=status]')?.textContent?.includes('duplicado')
  );
  console.log('PASS: reimportação idempotente.');
  const status = await page.evaluate(async () => {
    const r = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: '<svg><script>alert(1)</script></svg>'
    });
    return r.status;
  });
  if (status !== 400) throw new Error(`Malicious upload accepted: ${status}`);
  console.log('PASS: SVG/script disfarçado de PNG bloqueado no upload real.');
  const staff = await context.request.get(origin + '/api/staff-access');
  if (staff.status() !== 200) throw new Error(`Staff bridge failed: ${staff.status()}`);
  const team = await staff.json();
  if (!Array.isArray(team.members) || team.members.some((m) => Object.keys(m).some((k) => !['user_id', 'display_name', 'github_login'].includes(k)))) throw new Error('Staff listing exposed unexpected fields');
  console.log('PASS: integração limitada retorna somente a listagem autorizada, sem e-mails ou secrets.');
  await context.close();
} finally {
  await browser.close();
}
