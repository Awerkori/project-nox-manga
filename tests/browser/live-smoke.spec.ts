import { test, expect } from '@playwright/test';

const LIVE_URL = 'https://manga.project-nox-awerkori.workers.dev';

/**
 * Production is a real distributed dependency, not the local Vite server.
 * A cold Worker/database hop can very occasionally return a transient 503.
 * Retrying that status twice keeps the smoke meaningful: it still fails for
 * every non-200 response that does not recover promptly.
 */
async function gotoLiveReader(page: import('@playwright/test').Page) {
  let response: Awaited<ReturnType<typeof page.goto>> = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    response = await page.goto(`${LIVE_URL}/ler/a12eebc6-691e-4fff-b699-70bc5350a5e3`, {
      waitUntil: 'domcontentloaded'
    });

    if (response?.status() === 200 || response?.status() !== 503 || attempt === 3) break;
    console.warn(`Reader returned transient 503 (attempt ${attempt}/3); retrying.`);
    await page.waitForTimeout(250 * attempt);
  }

  return response;
}

test.describe('Production Live Smoke Tests', () => {
  test('Live Home page renders clean footer, canvas snow, and no explore banner', async ({ page }) => {
    await page.context().addCookies([
      { name: 'nox-age-status', value: 'ADULT', domain: 'manga.project-nox-awerkori.workers.dev', path: '/' }
    ]);

    const res = await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);

    // 1. Particle canvas exists
    const snowCanvas = page.locator('canvas.particle-canvas');
    await expect(snowCanvas).toBeAttached();

    // 2. Banner "TODO O UNIVERSO NOX" is gone
    const banner = page.locator('.explore-catalog-banner');
    expect(await banner.count()).toBe(0);

    // 3. Clean 2-column footer
    const footer = page.locator('.site-footer');
    await expect(footer).toBeVisible();
    const footerCommunity = page.locator('.footer-community');
    expect(await footerCommunity.count()).toBe(0);
  });

  test('Live Work page renders desktop/mobile CTAs and contextual comments', async ({ page }) => {
    await page.context().addCookies([
      { name: 'nox-age-status', value: 'ADULT', domain: 'manga.project-nox-awerkori.workers.dev', path: '/' }
    ]);

    // Test Desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    const res = await page.goto(`${LIVE_URL}/obra/cronicas-do-demonio-de-sangue`, { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);

    // Desktop CTA visible in chapters header
    const desktopCta = page.locator('.btn-read-chapters-desktop');
    await expect(desktopCta).toBeVisible();
    const mobileCta = page.locator('.btn-read-hero.mobile-only');
    await expect(mobileCta).toBeHidden();

    // Contextual comments
    const commentsEyebrow = page.locator('.comments .section-heading .eyebrow');
    await expect(commentsEyebrow).toContainText('AVALIAÇÕES & DISCUSSÃO');

    // Test Mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await expect(mobileCta).toBeVisible();
    await expect(desktopCta).toBeHidden();
  });

  test('Live Reader page renders navigation, scroll controls, and reactions', async ({ page }) => {
    await page.context().addCookies([
      { name: 'nox-age-status', value: 'ADULT', domain: 'manga.project-nox-awerkori.workers.dev', path: '/' }
    ]);

    const res = await gotoLiveReader(page);
    expect(res?.status()).toBe(200);

    await expect(page.getByRole('button', { name: 'Voltar ao topo' })).toBeAttached();

    // Scroll to end
    await page.evaluate(() => {
      document.querySelector('.reader-end')?.scrollIntoView({ behavior: 'instant' });
    });
    await page.waitForTimeout(400);

    // Verify reactions
    const reactions = page.locator('.chapter-reactions-cluster');
    await expect(reactions).toBeVisible();

    // Verify Reader comments
    const readerEyebrow = page.locator('.reader-comments .comments .section-heading .eyebrow');
    await expect(readerEyebrow).toContainText('DEPOIS DA ÚLTIMA PÁGINA');
  });
});
