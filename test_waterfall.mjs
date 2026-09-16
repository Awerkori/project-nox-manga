import { chromium } from 'playwright';

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('request', request => console.log(`>> [REQ] ${request.method()} ${request.url()}`));
  page.on('response', response => {
    const timing = response.request().timing();
    const duration = timing.responseEnd > 0 ? (timing.responseEnd - timing.startTime) : -1;
    console.log(`<< [RES] ${response.status()} ${response.url()} | TIME: ${duration.toFixed(2)}ms`);
  });

  const start = Date.now();
  console.log('Navigating to HOME...');
  await page.goto('https://manga.project-nox-awerkori.workers.dev/', { waitUntil: 'networkidle' });
  console.log(`HOME Load Time: ${Date.now() - start}ms`);
  
  await browser.close();
})();
