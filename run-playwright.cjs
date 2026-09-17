const { chromium } = require('playwright');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];

  const urls = [
    'http://localhost:5173/',
    'http://localhost:5173/catalogo',
    // We'll test with the test database loaded
  ];

  for (const url of urls) {
    try {
      console.log(`Testing ${url}...`);
      const response = await page.goto(url, { waitUntil: 'networkidle' });
      
      if (!response.ok()) {
         errors.push(`URL ${url} returned ${response.status()}`);
         continue;
      }

      // Check for undefined
      const text = await page.evaluate(() => document.body.innerText);
      if (text.includes('undefined')) {
         errors.push(`URL ${url} rendered "undefined" text`);
      }
      
      // Check for console errors
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(`Console Error on ${url}: ${msg.text()}`);
      });

    } catch (e) {
      errors.push(`Failed to load ${url}: ${e.message}`);
    }
  }

  await browser.close();

  if (errors.length > 0) {
    console.error("Playwright Smoke Tests Failed:");
    console.error(errors.join('\n'));
    process.exit(1);
  } else {
    console.log("Playwright Smoke Tests Passed.");
  }
})();
