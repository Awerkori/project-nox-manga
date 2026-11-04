import { test, expect } from '@playwright/test';

const LIVE_URL = process.env.PUBLIC_SITE_URL || 'https://projectnox.org';
const LIVE_DOMAIN = new URL(LIVE_URL).hostname;

async function dismissAgeGate(page: import('@playwright/test').Page) {
  const adult = page.getByRole('button', { name: 'Sim, tenho 18 anos ou mais' });
  if (await adult.isVisible().catch(() => false)) {
    await adult.click();
    await page.getByRole('button', { name: 'Confirmar e Continuar' }).click();
    await page.locator('[role="dialog"]').waitFor({ state: 'hidden' });
  }
}

test('verify obra page has single og:image and single twitter:image', async ({ page }) => {
  // Set age cookies so AgeGateModal is bypassed
  await page.context().addCookies([
    { name: 'nox-age-status', value: 'ADULT', domain: LIVE_DOMAIN, path: '/' },
    { name: 'nox-blur-nsfw', value: 'false', domain: LIVE_DOMAIN, path: '/' }
  ]);

  await page.goto(`${LIVE_URL}/obra/cronicas-do-demonio-de-sangue`, { waitUntil: 'domcontentloaded' });
  await dismissAgeGate(page);
  await page.waitForSelector('main.work-page-root');

  const metaData = await page.evaluate(() => {
    const ogImages = Array.from(document.querySelectorAll('meta[property="og:image"]')).map(el => el.getAttribute('content'));
    const twImages = Array.from(document.querySelectorAll('meta[name="twitter:image"]')).map(el => el.getAttribute('content'));
    const twCard = Array.from(document.querySelectorAll('meta[name="twitter:card"]')).map(el => el.getAttribute('content'));
    return { ogImages, twImages, twCard };
  });

  console.log('OPEN GRAPH CHECK:', metaData);
  expect(metaData.ogImages.length).toBe(1);
  expect(metaData.twImages.length).toBe(1);
  expect(metaData.ogImages[0]).toContain('/media/');
  expect(metaData.twImages[0]).toContain('/media/');
  expect(metaData.twCard[0]).toBe('summary_large_image');
});

test('verify home page has default brand logo', async ({ page }) => {
  await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded' });

  const metaData = await page.evaluate(() => {
    const ogImages = Array.from(document.querySelectorAll('meta[property="og:image"]')).map(el => el.getAttribute('content'));
    const twImages = Array.from(document.querySelectorAll('meta[name="twitter:image"]')).map(el => el.getAttribute('content'));
    return { ogImages, twImages };
  });

  console.log('HOME OPEN GRAPH CHECK:', metaData);
  expect(metaData.ogImages.length).toBe(1);
  expect(metaData.twImages.length).toBe(1);
  expect(metaData.ogImages[0]).toContain('/brand/nox-symbol-256.webp');
});
