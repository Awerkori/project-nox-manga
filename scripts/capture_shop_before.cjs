/**
 * scripts/capture_shop_before.cjs
 * Captures BEFORE state of the Project Nox shop (/loja)
 * Target: https://manga.project-nox-awerkori.workers.dev/loja
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL = 'https://manga.project-nox-awerkori.workers.dev/loja';
const ARTIFACTS_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function bypassAgeGate(ctx) {
  try {
    await ctx.addCookies([
      {
        name: 'age_confirmed',
        value: 'true',
        domain: 'manga.project-nox-awerkori.workers.dev',
        path: '/'
      },
      {
        name: 'nox-age-status',
        value: 'ADULT',
        domain: 'manga.project-nox-awerkori.workers.dev',
        path: '/'
      }
    ]);
  } catch (e) {}
}

async function dismissModals(page) {
  try {
    const ageBtn = page.locator('button:has-text("Sim, tenho 18 anos ou mais"), button:has-text("Tenho mais de 18 anos"), button:has-text("Confirmar Maioridade"), button:has-text("Sim, sou maior"), .btn-choice.adult');
    if (await ageBtn.count() > 0 && await ageBtn.first().isVisible()) {
      await ageBtn.first().click({ force: true });
      await page.waitForTimeout(300);
    }
  } catch {}
}

async function run() {
  console.log('=== CAPTURING SHOP BEFORE STATE ===');
  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Desktop Context
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });
    await bypassAgeGate(ctx);
    const page = await ctx.newPage();

    console.log('Navigating to:', TARGET_URL);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    await dismissModals(page);
    await page.waitForTimeout(1000);

    // Extract item data from DOM or state
    const itemsData = await page.evaluate(() => {
      const cards = document.querySelectorAll('.shop-card');
      const items = [];
      cards.forEach((c, idx) => {
        const titleEl = c.querySelector('.card-title');
        const rarityEl = c.querySelector('.rarity-badge');
        const priceEl = c.querySelector('.price-tag');
        const previewEl = c.querySelector('.preview-box');
        const kindBadge = c.querySelector('.kind-badge') || c.querySelector('.type-tag');
        const hasImg = previewEl ? previewEl.querySelector('img') !== null : false;
        const imgUrl = hasImg ? previewEl.querySelector('img').src : null;
        const hasBorder = previewEl ? previewEl.querySelector('.frame-preview') !== null : false;
        const hasCustomColor = previewEl ? previewEl.querySelector('.name-preview') !== null : false;

        items.push({
          index: idx + 1,
          title: titleEl ? titleEl.textContent.trim() : 'N/A',
          rarity: rarityEl ? rarityEl.textContent.trim() : 'N/A',
          price: priceEl ? priceEl.textContent.trim() : 'N/A',
          hasImg,
          imgUrl,
          hasBorder,
          hasCustomColor,
          htmlPreview: previewEl ? previewEl.innerHTML.slice(0, 150) : ''
        });
      });
      return items;
    });

    console.log(`Extracted ${itemsData.length} items from the page`);

    // Screenshot 1: Desktop Shop Top
    const shotTop = path.join(ARTIFACTS_DIR, 'shop_before_desktop_top.png');
    await page.screenshot({ path: shotTop, clip: { x: 0, y: 0, width: 1440, height: 1000 } });
    console.log('Captured shop_before_desktop_top.png');

    // Screenshot 2: Desktop Shop Grid
    const gridEl = page.locator('.shop-grid, .items-grid, .card-container, main');
    const shotGrid = path.join(ARTIFACTS_DIR, 'shop_before_desktop_grid.png');
    if (await gridEl.count() > 0) {
      await gridEl.first().screenshot({ path: shotGrid });
      console.log('Captured shop_before_desktop_grid.png');
    }

    // Screenshot 3: Frames filter
    const frameTab = page.locator('button:has-text("Molduras"), .tab:has-text("Moldura")');
    if (await frameTab.count() > 0) {
      await frameTab.first().click();
      await page.waitForTimeout(500);
      const shotFrames = path.join(ARTIFACTS_DIR, 'shop_before_frames.png');
      await page.screenshot({ path: shotFrames, clip: { x: 0, y: 350, width: 1440, height: 750 } });
      console.log('Captured shop_before_frames.png');
    }

    // Screenshot 4: Colors filter
    const colorTab = page.locator('button:has-text("Cores"), .tab:has-text("Cores")');
    if (await colorTab.count() > 0) {
      await colorTab.first().click();
      await page.waitForTimeout(500);
      const shotColors = path.join(ARTIFACTS_DIR, 'shop_before_colors.png');
      await page.screenshot({ path: shotColors, clip: { x: 0, y: 350, width: 1440, height: 750 } });
      console.log('Captured shop_before_colors.png');
    }

    // Screenshot 5: Titles filter
    const titleTab = page.locator('button:has-text("Títulos"), .tab:has-text("Títulos")');
    if (await titleTab.count() > 0) {
      await titleTab.first().click();
      await page.waitForTimeout(500);
      const shotTitles = path.join(ARTIFACTS_DIR, 'shop_before_titles.png');
      await page.screenshot({ path: shotTitles, clip: { x: 0, y: 350, width: 1440, height: 750 } });
      console.log('Captured shop_before_titles.png');
    }

    // Screenshot 6: Banners filter
    const bannerTab = page.locator('button:has-text("Banners"), .tab:has-text("Banners")');
    if (await bannerTab.count() > 0) {
      await bannerTab.first().click();
      await page.waitForTimeout(500);
      const shotBanners = path.join(ARTIFACTS_DIR, 'shop_before_banners.png');
      await page.screenshot({ path: shotBanners, clip: { x: 0, y: 350, width: 1440, height: 750 } });
      console.log('Captured shop_before_banners.png');
    }

    await page.close();
    await ctx.close();

    // 2. Mobile Context (iPhone 390x844)
    const ctxMobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true
    });
    await bypassAgeGate(ctxMobile);
    const mPage = await ctxMobile.newPage();
    await mPage.goto(TARGET_URL, { waitUntil: 'networkidle' });
    await dismissModals(mPage);
    await mPage.waitForTimeout(800);

    const shotMobile = path.join(ARTIFACTS_DIR, 'shop_before_mobile.png');
    await mPage.screenshot({ path: shotMobile, clip: { x: 0, y: 0, width: 390, height: 844 } });
    console.log('Captured shop_before_mobile.png');

    await mPage.close();
    await ctxMobile.close();

    // Save extracted items to json
    fs.writeFileSync(
      path.join(ARTIFACTS_DIR, 'shop_items_before_audit.json'),
      JSON.stringify(itemsData, null, 2)
    );
    console.log('Saved shop_items_before_audit.json');

  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('Capture Before failed:', err);
  process.exit(1);
});
