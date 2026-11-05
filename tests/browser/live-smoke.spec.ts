import { test, expect } from '@playwright/test';

const LIVE_URL = process.env.PUBLIC_SITE_URL || 'https://projectnox.org';
const LIVE_DOMAIN = new URL(LIVE_URL).hostname;

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

async function dismissAgeGate(page: import('@playwright/test').Page) {
  const adult = page.getByRole('button', { name: 'Sim, tenho 18 anos ou mais' });
  if (await adult.isVisible().catch(() => false)) {
    await adult.click();
    await page.getByRole('button', { name: 'Confirmar e Continuar' }).click();
    await page.locator('[role="dialog"]').waitFor({ state: 'hidden' });
  }
}

test.describe('Production Live Smoke Tests', () => {
  test('Live Home page renders clean footer, canvas snow, and no explore banner', async ({ page }) => {
    await page.context().addCookies([
      { name: 'nox-age-status', value: 'ADULT', domain: LIVE_DOMAIN, path: '/' }
    ]);

    const res = await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    await dismissAgeGate(page);

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

  test('Live Work page renders a readable CTA and contextual comments', async ({ page }) => {
    await page.context().addCookies([
      { name: 'nox-age-status', value: 'ADULT', domain: LIVE_DOMAIN, path: '/' }
    ]);

    // Test Desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    const res = await page.goto(`${LIVE_URL}/obra/cronicas-do-demonio-de-sangue`, { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    await dismissAgeGate(page);

    const readCta = page.getByRole('link', { name: /começar a ler|continuar leitura/i });
    await expect(readCta).toBeVisible();

    // Contextual comments
    await expect(page.getByRole('heading', { name: 'Comentários sobre a Obra' })).toBeVisible();

    // Test Mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await expect(readCta).toBeVisible();
  });

  test('Live Reader page renders navigation, completion and reactions', async ({ page }) => {
    await page.context().addCookies([
      { name: 'nox-age-status', value: 'ADULT', domain: LIVE_DOMAIN, path: '/' }
    ]);

    const res = await gotoLiveReader(page);
    expect(res?.status()).toBe(200);
    await dismissAgeGate(page);

    await expect(page.getByRole('link', { name: /voltar para a obra/i })).toBeVisible();

    // Scroll to end
    await page.evaluate(() => {
      document.querySelector('#chapter-end')?.scrollIntoView({ behavior: 'instant' });
    });
    await page.waitForTimeout(400);

    // Verify reactions
    await expect(page.getByRole('heading', { name: 'Qual foi a vibe da leitura?' })).toBeVisible();

    // Verify Reader comments
    await expect(page.getByRole('heading', { name: 'Comentários deste Capítulo' })).toBeVisible();
  });
});
