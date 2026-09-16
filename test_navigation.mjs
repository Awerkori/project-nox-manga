import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('response', response => {
    if (response.url().includes('supabase') || response.url().includes('__data')) {
      const timing = response.request().timing();
      const duration = timing.responseEnd > 0 ? (timing.responseEnd - timing.startTime) : -1;
      console.log(`<< [RES] ${response.status()} ${response.url()} | TIME: ${duration.toFixed(2)}ms`);
    }
  });

  console.log('Navigating to HOME...');
  await page.goto('https://manga.project-nox-awerkori.workers.dev/');
  
  console.log('Clicking on CATALOGO...');
  const start = Date.now();
  await page.click('text="Catálogo"');
  await page.waitForURL('**/catalogo');
  console.log(`CATALOGO Nav Time: ${Date.now() - start}ms`);
  
  await browser.close();
})();
