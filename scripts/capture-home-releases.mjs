import { chromium } from '@playwright/test';

const PROD_URL = 'https://manga.project-nox-awerkori.workers.dev';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await context.addCookies([
    {
      name: 'nox-age-status',
      value: 'ADULT',
      domain: new URL(PROD_URL).hostname,
      path: '/'
    }
  ]);
  const page = await context.newPage();

  console.log(`Navigating to ${PROD_URL}...`);
  await page.goto(PROD_URL, { waitUntil: 'networkidle' });

  // Scroll down a bit to ensure LANÇAMENTOS section is in view
  const releasesSection = page.locator('#lancamentos, .recent-releases-container, .releases-section, h2:has-text("LANÇAMENTOS")').first();
  await releasesSection.scrollIntoViewIfNeeded().catch(() => {});

  await page.waitForTimeout(1000);

  const screenshotPath = '/home/awerkori/.Projects/project-nox-manga/scripts/evidence-home-releases.png';
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`Screenshot saved to ${screenshotPath}`);

  // Also take full page screenshot to verify overall layout
  const fullPagePath = '/home/awerkori/.Projects/project-nox-manga/scripts/evidence-home-full.png';
  await page.screenshot({ path: fullPagePath, fullPage: true });
  console.log(`Full page screenshot saved to ${fullPagePath}`);

  await browser.close();
}

main().catch(console.error);
