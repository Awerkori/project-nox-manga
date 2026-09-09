import { test, expect } from '@playwright/test';

test('verify obra page has single og:image and single twitter:image', async ({ page }) => {
  // Set age cookies so AgeGateModal is bypassed
  await page.context().addCookies([
    { name: 'nox-age-status', value: 'ADULT', domain: '127.0.0.1', path: '/' },
    { name: 'nox-blur-nsfw', value: 'false', domain: '127.0.0.1', path: '/' }
  ]);

  await page.goto('/obra/vinganca-do-cao-de-caca', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.work-page-container');

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
  await page.goto('/', { waitUntil: 'domcontentloaded' });

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
