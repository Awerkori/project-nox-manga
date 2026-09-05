import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const routes = [
  '/',
  '/catalogo',
  '/entrar',
  '/cadastrar',
  '/recuperar',
  '/ranking',
  '/sobre',
  '/privacidade',
  '/admin'
];
for (const width of [1440, 768, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const route of routes) {
    const response = await page.goto('http://127.0.0.1:5173' + route, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    console.log(
      JSON.stringify({ width, route, status: response.status(), overflow, errors: errors.splice(0) })
    );
    await page.screenshot({
      path: `artifacts/${width}-${route.replaceAll('/', '') || 'home'}.png`,
      fullPage: true
    });
  }
  await page.close();
}
await browser.close();
