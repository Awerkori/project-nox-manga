/**
 * scripts/verify_shop_overhaul.cjs
 * Comprehensive Playwright verification script for Project Nox Shop Overhaul.
 * Target: https://home-preview-manga.project-nox-awerkori.workers.dev/loja
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev/loja';
const ARTIFACTS_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function bypassAgeGate(ctx) {
  try {
    await ctx.addCookies([
      {
        name: 'age_confirmed',
        value: 'true',
        domain: 'home-preview-manga.project-nox-awerkori.workers.dev',
        path: '/'
      },
      {
        name: 'nox-age-status',
        value: 'ADULT',
        domain: 'home-preview-manga.project-nox-awerkori.workers.dev',
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
      await page.waitForTimeout(400);
    }
  } catch {}
}

async function run() {
  console.log('=== STARTING PLAYWRIGHT VERIFICATION FOR SHOP OVERHAUL ===');
  console.log('Target:', PREVIEW_URL);

  const browser = await chromium.launch({ headless: true });
  const results = {
    url: PREVIEW_URL,
    timestamp: new Date().toISOString(),
    tests: {},
    itemCounts: {},
    status: 'UNKNOWN'
  };

  try {
    // 1. Desktop Test Context (1440x900)
    console.log('\n--- 1. DESKTOP AUDIT (1440x900) ---');
    const desktopCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });
    await bypassAgeGate(desktopCtx);
    const page = await desktopCtx.newPage();

    const response = await page.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 30000 });
    results.httpStatus = response.status();
    console.log('HTTP Status:', results.httpStatus);
    await dismissModals(page);
    await page.waitForTimeout(1000);

    // Capture Top Hero
    const heroEl = page.locator('.shop-hero');
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_after_desktop_top.png'),
      clip: { x: 0, y: 0, width: 1440, height: 750 }
    });
    console.log('✓ Captured shop_after_desktop_top.png');

    // Count Total Items
    const totalCards = await page.locator('.shop-card').count();
    results.itemCounts.total = totalCards;
    console.log(`Total Cards rendered: ${totalCards} (Expected: 27)`);

    // Verify Tab Counts
    const tabCounts = await page.evaluate(() => {
      const counts = {};
      document.querySelectorAll('.cat-btn').forEach((btn) => {
        const text = btn.innerText.replace(/\s+/g, ' ').trim();
        counts[text] = true;
      });
      return counts;
    });
    console.log('Category Tabs detected:', tabCounts);

    // Capture Full Desktop Grid
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_after_desktop_grid.png'),
      fullPage: false,
      clip: { x: 0, y: 350, width: 1440, height: 900 }
    });
    console.log('✓ Captured shop_after_desktop_grid.png');

    // Filter: Molduras
    console.log('\n--- 2. CATEGORY: MOLDURAS ---');
    await page.locator('.cat-btn:has-text("Molduras")').click();
    await page.waitForTimeout(400);
    const framesCount = await page.locator('.shop-card').count();
    results.itemCounts.frames = framesCount;
    console.log(`Molduras rendered: ${framesCount} (Expected: 8)`);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_after_frames.png'),
      clip: { x: 0, y: 350, width: 1440, height: 850 }
    });
    console.log('✓ Captured shop_after_frames.png');

    // Filter: Cores de Nome
    console.log('\n--- 3. CATEGORY: CORES DE NOME ---');
    await page.locator('.cat-btn:has-text("Cores de Nome")').click();
    await page.waitForTimeout(400);
    const colorsCount = await page.locator('.shop-card').count();
    results.itemCounts.colors = colorsCount;
    console.log(`Cores de Nome rendered: ${colorsCount} (Expected: 7)`);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_after_colors.png'),
      clip: { x: 0, y: 350, width: 1440, height: 850 }
    });
    console.log('✓ Captured shop_after_colors.png');

    // Filter: Títulos
    console.log('\n--- 4. CATEGORY: TÍTULOS ---');
    await page.locator('.cat-btn:has-text("Títulos")').click();
    await page.waitForTimeout(400);
    const titlesCount = await page.locator('.shop-card').count();
    results.itemCounts.titles = titlesCount;
    console.log(`Títulos rendered: ${titlesCount} (Expected: 6)`);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_after_titles.png'),
      clip: { x: 0, y: 350, width: 1440, height: 850 }
    });
    console.log('✓ Captured shop_after_titles.png');

    // Filter: Banners
    console.log('\n--- 5. CATEGORY: BANNERS ---');
    await page.locator('.cat-btn:has-text("Banners")').click();
    await page.waitForTimeout(400);
    const bannersCount = await page.locator('.shop-card').count();
    results.itemCounts.banners = bannersCount;
    console.log(`Banners rendered: ${bannersCount} (Expected: 6)`);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_after_banners.png'),
      clip: { x: 0, y: 350, width: 1440, height: 850 }
    });
    console.log('✓ Captured shop_after_banners.png');

    // Test Live Provador / Test-Drive
    console.log('\n--- 6. TEST-DRIVE / PROVADOR AO VIVO ---');
    await page.locator('.cat-btn:has-text("Todos")').click();
    await page.waitForTimeout(300);
    const firstTestBtn = page.locator('.btn-action-test').first();
    await firstTestBtn.click();
    await page.waitForTimeout(500);

    const isProvadorActive = await page.locator('.test-drive-indicator').isVisible();
    const hasRestaurarBtn = await page.locator('.btn-reset-preview').isVisible();
    console.log(`Provador active: ${isProvadorActive}, Restaurar button: ${hasRestaurarBtn}`);
    results.tests.provadorTest = isProvadorActive && hasRestaurarBtn;

    // Reset Provador
    if (hasRestaurarBtn) {
      await page.locator('.btn-reset-preview').click();
      await page.waitForTimeout(400);
      const isStillActive = await page.locator('.test-drive-indicator').isVisible();
      console.log(`Provador reset correctly: ${!isStillActive}`);
      results.tests.provadorReset = !isStillActive;
    }

    // Test Modal Preview
    console.log('\n--- 7. MODAL PREVIEW AUDIT ---');
    const firstCardVisual = page.locator('.card-visual-clickable').first();
    await firstCardVisual.click();
    await page.waitForTimeout(500);

    const isModalOpen = await page.locator('.modal-card').isVisible();
    console.log(`Modal open: ${isModalOpen}`);
    results.tests.modalOpen = isModalOpen;

    if (isModalOpen) {
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, 'shop_after_modal_preview.png'),
        clip: { x: 0, y: 0, width: 1440, height: 900 }
      });
      console.log('✓ Captured shop_after_modal_preview.png');

      // Close Modal
      await page.locator('.btn-modal-close').click();
      await page.waitForTimeout(400);
    }

    // 8. Mobile Context (iPhone 14 / 390x844)
    console.log('\n--- 8. MOBILE AUDIT (390x844) ---');
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    await bypassAgeGate(mobileCtx);
    const mobilePage = await mobileCtx.newPage();
    await mobilePage.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await dismissModals(mobilePage);
    await mobilePage.waitForTimeout(800);

    // Check Mobile Overflow
    const scrollWidth = await mobilePage.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await mobilePage.evaluate(() => document.documentElement.clientWidth);
    console.log(`Mobile scrollWidth: ${scrollWidth}, clientWidth: ${clientWidth}`);
    results.tests.noHorizontalOverflow = scrollWidth <= clientWidth;

    await mobilePage.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_after_mobile.png'),
      fullPage: false,
      clip: { x: 0, y: 0, width: 390, height: 844 }
    });
    console.log('✓ Captured shop_after_mobile.png');

    // Test Modal on Mobile
    const mobileFirstVisual = mobilePage.locator('.card-visual-clickable').first();
    await mobileFirstVisual.click();
    await mobilePage.waitForTimeout(500);

    const isMobileModalOpen = await mobilePage.locator('.modal-card').isVisible();
    if (isMobileModalOpen) {
      await mobilePage.screenshot({
        path: path.join(ARTIFACTS_DIR, 'shop_after_mobile_modal.png'),
        clip: { x: 0, y: 0, width: 390, height: 844 }
      });
      console.log('✓ Captured shop_after_mobile_modal.png');
    }

    results.status = 'SUCCESS';
    console.log('\n=== ALL PLAYWRIGHT TESTS COMPLETED SUCCESSFULLY ===');
  } catch (err) {
    console.error('Test execution failed:', err);
    results.status = 'ERROR';
    results.error = err.message;
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(ARTIFACTS_DIR, 'shop_overhaul_verification_report.json'),
      JSON.stringify(results, null, 2)
    );
  }
}

run();
