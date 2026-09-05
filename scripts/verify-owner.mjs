import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies(await ownerCookies());
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
    const response = await page.goto('http://127.0.0.1:5173' + route, { waitUntil: 'networkidle' });
    console.log(JSON.stringify({ route, status: response.status(), errors: errors.splice(0) }));
    if (response.status() !== 200) throw new Error(`Owner route failed: ${route}`);
    await page.screenshot({ path: `artifacts/owner-${route.replaceAll('/', '-')}.png`, fullPage: true });
  }
  await page.goto('http://127.0.0.1:5173/admin/obras', { waitUntil: 'networkidle' });
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
  await context.close();
} finally {
  await browser.close();
}
