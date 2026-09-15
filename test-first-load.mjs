import { chromium } from '/home/awerkori/.Projects/project-nox-manga/node_modules/playwright/index.mjs';

async function run() {
  const browser = await chromium.launch({ headless: true });
  let successes = 0;
  let failures = 0;
  
  for (let i = 0; i < 20; i++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      const res = await page.goto('https://project-nox.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (res && res.ok()) successes++;
      else failures++;
    } catch (e) {
      failures++;
      console.log('Failure:', e.message);
    }
    await context.close();
  }
  
  console.log(`Successes: ${successes}, Failures: ${failures}`);
  await browser.close();
}
run();
