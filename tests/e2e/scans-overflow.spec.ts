import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1366', width: 1366, height: 768 },
  { name: 'desktop-1024', width: 1024, height: 768 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-360', width: 360, height: 800 }
];

for (const vp of viewports) {
  test(`/scans has no horizontal overflow on ${vp.name} (${vp.width}x${vp.height})`, async ({ page, context }) => {
    await context.addCookies([
      { name: 'nox-age-status', value: 'ADULT', domain: '127.0.0.1', path: '/' },
      { name: 'nox-age-status', value: 'ADULT', domain: 'localhost', path: '/' }
    ]);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/scans');
    await page.waitForLoadState('networkidle');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const innerWidth = await page.evaluate(() => window.innerWidth);

    console.log(`[${vp.name}] scrollWidth: ${scrollWidth}, innerWidth: ${innerWidth}`);
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);

    await page.screenshot({
      path: `/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854/screenshots/scans/scans_${vp.name}.png`,
      fullPage: true
    });
  });
}

