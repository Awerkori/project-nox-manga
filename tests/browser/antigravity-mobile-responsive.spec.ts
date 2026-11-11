import { test, expect } from '@playwright/test';

const LIVE_URL = process.env.PUBLIC_SITE_URL || process.env.TEST_BASE_URL || 'https://projectnox.org';
const LIVE_DOMAIN = new URL(LIVE_URL).hostname;

const MOBILE_VIEWPORTS = [
  { name: 'iPhone 14 (390x844)', width: 390, height: 844 },
  { name: 'Pixel 7 (412x915)', width: 412, height: 915 },
  { name: 'Tablet (768x1024)', width: 768, height: 1024 },
];

/**
 * Production is a distributed edge deployment. A cold Worker isolate or
 * cold database connection hop can occasionally return a transient 503/504.
 * Retrying those transient statuses up to 3 times keeps production smoke tests
 * reliable and prevents false-alarm CI failures while strictly requiring a 200.
 */
async function gotoLivePage(page: import('@playwright/test').Page, path: string) {
  const url = path.startsWith('http') ? path : `${LIVE_URL}${path}`;
  let response: Awaited<ReturnType<typeof page.goto>> = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    const status = response?.status();

    if (status === 200 || (status !== 503 && status !== 504) || attempt === 3) break;
    console.warn(`[RETRY] ${url} returned transient ${status} (attempt ${attempt}/3); retrying.`);
    await page.waitForTimeout(1000 * attempt);
  }

  return response;
}

async function dismissAgeGate(page: import('@playwright/test').Page) {
  const adult = page.getByRole('button', { name: 'Sim, tenho 18 anos ou mais' });
  if (await adult.isVisible().catch(() => false)) {
    await adult.click();
    const confirm = page.getByRole('button', { name: 'Confirmar e Continuar' });
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
    }
    await page.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  }
}

test.describe('Antigravity Mobile & Responsive Production Audit', () => {
  for (const vp of MOBILE_VIEWPORTS) {
    test(`Home Page Mobile Responsiveness & Layout Integrity [${vp.name}]`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.context().addCookies([
        { name: 'nox-age-status', value: 'ADULT', domain: LIVE_DOMAIN, path: '/' }
      ]);

      const res = await gotoLivePage(page, LIVE_URL);
      expect(res?.status()).toBe(200);
      await dismissAgeGate(page);

      // Verify no horizontal overflow (critical mobile bug check)
      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(hasHorizontalScroll).toBe(false);

      // Header exists and is responsive
      const header = page.locator('header');
      await expect(header).toBeVisible();

      // Navigation bar adapts to viewport (bottom bar on mobile <= 760, desktop nav on tablet/desktop)
      if (vp.width <= 760) {
        await expect(page.locator('nav.mobile-bottom')).toBeVisible();
      } else {
        await expect(page.locator('header .brand')).toBeVisible();
      }

      // Home wrapper and hero section exist and render smoothly
      await expect(page.locator('.home-wrapper')).toBeVisible();
      await expect(page.locator('.site-footer')).toBeVisible();
    });

    test(`Catalog & Search Page Mobile Responsiveness [${vp.name}]`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.context().addCookies([
        { name: 'nox-age-status', value: 'ADULT', domain: LIVE_DOMAIN, path: '/' }
      ]);

      const res = await gotoLivePage(page, '/catalogo?q=leveling');
      expect(res?.status()).toBe(200);
      await dismissAgeGate(page);

      // Check overflow
      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(hasHorizontalScroll).toBe(false);

      // Verify work cards or results list exists
      const worksList = page.locator('a[href*="/obra/"]');
      if (await page.locator('.empty-state, [data-testid="empty-catalog"]').isVisible().catch(() => false)) {
        await page.waitForTimeout(1000);
        await gotoLivePage(page, '/catalogo?q=leveling');
      }
      await expect(worksList.first()).toBeAttached({ timeout: 10000 });
    });

    test(`Releases Page Mobile Responsiveness [${vp.name}]`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.context().addCookies([
        { name: 'nox-age-status', value: 'ADULT', domain: LIVE_DOMAIN, path: '/' }
      ]);

      const res = await gotoLivePage(page, '/lancamentos');
      expect(res?.status()).toBe(200);
      await dismissAgeGate(page);

      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(hasHorizontalScroll).toBe(false);

      // Verify releases items exist
      const releaseLinks = page.locator('a[href*="/obra/"], a[href*="/ler/"]');
      if (await page.locator('.empty-box').isVisible().catch(() => false)) {
        await page.waitForTimeout(1000);
        await gotoLivePage(page, '/lancamentos');
      }
      await expect(releaseLinks.first()).toBeAttached({ timeout: 10000 });
    });

    test(`Work Detail Page Mobile Layout [${vp.name}]`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.context().addCookies([
        { name: 'nox-age-status', value: 'ADULT', domain: LIVE_DOMAIN, path: '/' }
      ]);

      const res = await gotoLivePage(page, '/obra/solo-leveling');
      expect(res?.status()).toBe(200);
      await dismissAgeGate(page);

      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(hasHorizontalScroll).toBe(false);

      // Verify start reading CTA and chapter links
      const readBtn = page.getByRole('link', { name: /começar a ler|continuar leitura/i });
      await expect(readBtn).toBeVisible({ timeout: 5000 });

      // Verify chapter list items
      const chapterItems = page.locator('a[href*="/ler/"]');
      expect(await chapterItems.count()).toBeGreaterThan(0);
    });
  }

  test('Mobile Reader Experience & Smooth Transitions', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.context().addCookies([
      { name: 'nox-age-status', value: 'ADULT', domain: LIVE_DOMAIN, path: '/' }
    ]);

    const res = await gotoLivePage(page, '/ler/ebbd3e27-7b00-4a06-bbd4-405a0ce9917c');
    expect(res?.status()).toBe(200);
    await dismissAgeGate(page);

    // Verify reader container exists and has zero horizontal overflow
    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(hasHorizontalScroll).toBe(false);

    // Verify back to work link is visible
    const backBtn = page.getByRole('link', { name: /voltar para a obra|voltar/i });
    await expect(backBtn).toBeVisible({ timeout: 10000 });

    // Verify reader page images exist or canvas/container
    const pageContainer = page.locator('main, [class*="reader"], [id*="reader"]');
    await expect(pageContainer.first()).toBeVisible();
  });
});
