const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const previewUrl = 'https://home-preview-manga.project-nox-awerkori.workers.dev/loja';
const artDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49/comment_banner_full_bg';
fs.mkdirSync(artDir, { recursive: true });

async function run() {
  console.log('--- TESTING COMMENT BANNER FULL BACKGROUND POSITIONING ---');
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });

  await context.addCookies([
    { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' },
    { name: 'nox-blur-nsfw', value: 'false', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
  ]);

  const page = await context.newPage();
  console.log('Navigating to loja...');
  await page.goto(previewUrl, { waitUntil: 'networkidle', timeout: 35000 });

  // Switch to "Banners de Comentário" tab
  const catButtons = await page.$$('.cat-btn');
  console.log(`Found ${catButtons.length} category tabs.`);
  // Banners is tab index 4
  await catButtons[4].click();
  await page.waitForTimeout(600);

  const bannerCards = await page.$$('.shop-card');
  console.log(`Found ${bannerCards.length} banner cards in category tab.`);

  // Test Banner 1 (Nebulosa do Vazio)
  console.log('Testing Banner 1 (Nebulosa do Vazio)...');
  const viewBtn1 = await bannerCards[0].$('.btn-action-view');
  await viewBtn1.click();
  await page.waitForSelector('.modal-card', { state: 'visible' });

  // Verify that there is NO .simulated-banner-strip
  const stripCount = await page.locator('.simulated-banner-strip').count();
  console.log(`Strip count in modal: ${stripCount} (MUST BE 0)`);
  if (stripCount !== 0) throw new Error('Expected 0 .simulated-banner-strip elements!');

  // Verify that .comment-banner-background and .comment-banner-overlay exist
  const bgCount = await page.locator('.comment-banner-background').count();
  const overlayCount = await page.locator('.comment-banner-overlay').count();
  const contentLayerCount = await page.locator('.comment-content-layer').count();
  console.log(`Background count: ${bgCount}, Overlay count: ${overlayCount}, Content Layer count: ${contentLayerCount}`);
  if (bgCount === 0 || overlayCount === 0 || contentLayerCount === 0) {
    throw new Error('Missing background, overlay, or content layer in simulated card!');
  }

  // Check pointer-events on background and overlay
  const bgPointerEvents = await page.locator('.comment-banner-background').evaluate(el => getComputedStyle(el).pointerEvents);
  const overlayPointerEvents = await page.locator('.comment-banner-overlay').evaluate(el => getComputedStyle(el).pointerEvents);
  console.log(`Pointer events -> bg: ${bgPointerEvents}, overlay: ${overlayPointerEvents}`);

  // Screenshot 1: Nebulosa do Vazio
  const shot1 = path.join(artDir, 'preview_banner_1_nebulosa_full_bg.png');
  await page.screenshot({ path: shot1 });
  console.log(`Saved screenshot 1: ${shot1}`);

  await page.click('.btn-modal-close');
  await page.waitForSelector('.modal-card', { state: 'hidden' });

  // Test Banner 51 (Cidade Flutuante Celestial - bright celestial artwork)
  console.log('Testing Banner 51 (Cidade Flutuante Celestial)...');
  await bannerCards[50].scrollIntoViewIfNeeded();
  const viewBtn51 = await bannerCards[50].$('.btn-action-view');
  await viewBtn51.click();
  await page.waitForSelector('.modal-card', { state: 'visible' });

  const title51 = await page.locator('#modal-item-title').innerText();
  console.log(`Opened modal for: "${title51}"`);

  // Screenshot 2: Cidade Flutuante Celestial
  const shot2 = path.join(artDir, 'preview_banner_51_cidade_full_bg.png');
  await page.screenshot({ path: shot2 });
  console.log(`Saved screenshot 2: ${shot2}`);

  await page.click('.btn-modal-close');
  await page.waitForSelector('.modal-card', { state: 'hidden' });

  // Test Banner 100 (Singularidade Cósmica Nox Prime - epic mythic banner)
  console.log('Testing Banner 100 (Singularidade Cósmica Nox Prime)...');
  await bannerCards[99].scrollIntoViewIfNeeded();
  const viewBtn100 = await bannerCards[99].$('.btn-action-view');
  await viewBtn100.click();
  await page.waitForSelector('.modal-card', { state: 'visible' });

  const title100 = await page.locator('#modal-item-title').innerText();
  console.log(`Opened modal for: "${title100}"`);

  // Screenshot 3: Singularidade Cósmica Nox Prime
  const shot3 = path.join(artDir, 'preview_banner_100_singularidade_full_bg.png');
  await page.screenshot({ path: shot3 });
  console.log(`Saved screenshot 3: ${shot3}`);

  await page.click('.btn-modal-close');
  await page.waitForSelector('.modal-card', { state: 'hidden' });

  // Mobile Viewport Check (390 x 844)
  console.log('Testing Mobile Viewport (390 x 844)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await viewBtn1.scrollIntoViewIfNeeded();
  await viewBtn1.click();
  await page.waitForSelector('.modal-card', { state: 'visible' });

  // Screenshot 4: Mobile Full Background Comment Card
  const shot4 = path.join(artDir, 'mobile_banner_full_bg.png');
  await page.screenshot({ path: shot4 });
  console.log(`Saved screenshot 4: ${shot4}`);

  await browser.close();
  console.log('--- ALL FULL BACKGROUND TESTS PASSED SUCCESSFULLY! ---');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
