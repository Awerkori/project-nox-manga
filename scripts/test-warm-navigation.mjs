import { chromium } from '@playwright/test';

const PROD_URL = 'https://manga.project-nox-awerkori.workers.dev';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    { name: 'nox-age-status', value: 'ADULT', url: PROD_URL, httpOnly: false, sameSite: 'Lax', secure: true }
  ]);
  const page = await context.newPage();

  console.log('Loading Home...');
  await page.goto(PROD_URL + '/', { waitUntil: 'networkidle' });

  const routes = [
    { name: 'Loja', selector: 'nav.desktop-nav a[href="/loja"]', url: '**/loja' },
    { name: 'Início', selector: 'nav.desktop-nav a[href="/"]', url: PROD_URL + '/' },
    { name: 'Ranking', selector: 'nav.desktop-nav a[href="/ranking"]', url: '**/ranking' },
    { name: 'Catálogo', selector: 'nav.desktop-nav a[href="/catalogo"]', url: '**/catalogo' },
    { name: 'Início', selector: 'nav.desktop-nav a[href="/"]', url: PROD_URL + '/' }
  ];

  for (const r of routes) {
    const link = page.locator(r.selector);
    await link.hover();
    await page.waitForTimeout(60); // Realistic human hover delay before click
    const t0 = performance.now();
    await Promise.all([
      page.waitForURL(r.url),
      link.click()
    ]);
    const duration = Math.round(performance.now() - t0);
    console.log(`⚡ Warm click navigation to [${r.name}]: ${duration}ms`);
  }

  await browser.close();
}

main().catch(console.error);
