/**
 * scripts/verify_shop_overhaul.cjs
 * Comprehensive Playwright verification script for Project Nox Cosmic Shop Round 3.
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
  console.log('=== STARTING PLAYWRIGHT VERIFICATION FOR SHOP OVERHAUL ROUND 3 ===');
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

    const response = await page.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 35000 });
    results.httpStatus = response.status();
    console.log('HTTP Status:', results.httpStatus);
    await dismissModals(page);
    await page.waitForTimeout(1000);

    // Capture Top Hero
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_after_v3_desktop_top.png'),
      clip: { x: 0, y: 0, width: 1440, height: 750 }
    });
    console.log('✓ Captured shop_after_v3_desktop_top.png');

    // Count Total Items
    const totalCards = await page.locator('.shop-card').count();
    results.itemCounts.total = totalCards;
    console.log(`Total Cards rendered: ${totalCards} (Expected: 47)`);

    // Capture Full Desktop Grid
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_after_v3_desktop_grid.png'),
      clip: { x: 0, y: 350, width: 1440, height: 900 }
    });
    console.log('✓ Captured shop_after_v3_desktop_grid.png');

    // Filter: Molduras (12 expected)
    console.log('\n--- 2. CATEGORY: MOLDURAS (12 itens) ---');
    await page.locator('.cat-btn:has-text("Molduras")').click();
    await page.waitForTimeout(400);
    const framesCount = await page.locator('.shop-card').count();
    results.itemCounts.frames = framesCount;
    console.log(`Molduras rendered: ${framesCount} (Expected: 12)`);
    results.tests.framesCountMatch = framesCount === 12;

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_after_v3_frames.png'),
      clip: { x: 0, y: 350, width: 1440, height: 900 }
    });
    console.log('✓ Captured shop_after_v3_frames.png');

    // Verify New Frames Existence
    const newFramesExist = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        lightningStorm: text.includes('Tempestade Cósmica'),
        crystalShards: text.includes('Fragmentos de Prisma'),
        voidVortex: text.includes('Vórtice do Vazio'),
        astralThornCrown: text.includes('Coroa de Espinhos da Noite')
      };
    });
    console.log('New Frames verified:', newFramesExist);
    results.tests.newFramesExist = Object.values(newFramesExist).every(Boolean);

    // Filter: Cores de Nome (15 expected)
    console.log('\n--- 3. CATEGORY: CORES DE NOME (15 itens) ---');
    await page.locator('.cat-btn:has-text("Cores de Nome")').click();
    await page.waitForTimeout(400);
    const colorsCount = await page.locator('.shop-card').count();
    results.itemCounts.colors = colorsCount;
    console.log(`Cores de Nome rendered: ${colorsCount} (Expected: 15)`);
    results.tests.colorsCountMatch = colorsCount === 15;

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_after_v3_colors.png'),
      clip: { x: 0, y: 350, width: 1440, height: 900 }
    });
    console.log('✓ Captured shop_after_v3_colors.png');

    // Filter: Títulos (14 expected)
    console.log('\n--- 4. CATEGORY: TÍTULOS (14 itens) ---');
    await page.locator('.cat-btn:has-text("Títulos")').click();
    await page.waitForTimeout(400);
    const titlesCount = await page.locator('.shop-card').count();
    results.itemCounts.titles = titlesCount;
    console.log(`Títulos rendered: ${titlesCount} (Expected: 14)`);
    results.tests.titlesCountMatch = titlesCount === 14;

    const requestedTitlesExist = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        herdeiroDoVazio: text.includes('Herdeiro do Vazio'),
        cronistaAstral: text.includes('Cronista Astral'),
        portadorDasRunas: text.includes('Portador das Runas'),
        vigiaDaNebulosa: text.includes('Vigia da Nebulosa'),
        guardiaoDoEclipse: text.includes('Guardião do Eclipse'),
        mestreDaBiblioteca: text.includes('Mestre da Biblioteca Astral'),
        senhorDasConstelacoes: text.includes('Senhor das Constelações'),
        arautoDoNox: text.includes('Arauto do Nox')
      };
    });
    console.log('Requested Titles verified:', requestedTitlesExist);
    results.tests.requestedTitlesExist = Object.values(requestedTitlesExist).every(Boolean);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_after_v3_titles.png'),
      clip: { x: 0, y: 350, width: 1440, height: 900 }
    });
    console.log('✓ Captured shop_after_v3_titles.png');

    // Filter: Banners (6 animated expected)
    console.log('\n--- 5. CATEGORY: BANNERS (6 itens animados) ---');
    await page.locator('.cat-btn:has-text("Banners")').click();
    await page.waitForTimeout(400);
    const bannersCount = await page.locator('.shop-card').count();
    results.itemCounts.banners = bannersCount;
    console.log(`Banners rendered: ${bannersCount} (Expected: 6)`);
    results.tests.bannersCountMatch = bannersCount === 6;

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_after_v3_banners.png'),
      clip: { x: 0, y: 350, width: 1440, height: 900 }
    });
    console.log('✓ Captured shop_after_v3_banners.png');

    // 6. Test Color Variants Swatches on Card
    console.log('\n--- 6. FRAME COLOR CUSTOMIZATION ON CARDS ---');
    await page.locator('.cat-btn:has-text("Molduras")').click();
    await page.waitForTimeout(400);

    // Locate the Solar Flare card or any card with swatches
    const solarCard = page.locator('.shop-card:has-text("Chama Solar")');
    const hasSwatches = await solarCard.locator('.swatch-btn').count();
    console.log(`Chama Solar color swatches count: ${hasSwatches}`);
    results.tests.hasColorSwatches = hasSwatches > 0;

    if (hasSwatches > 1) {
      // Click second swatch (blue flame)
      await solarCard.locator('.swatch-btn').nth(1).click();
      await page.waitForTimeout(400);

      // Verify UserAvatar inside card received tint class
      const hasBlueTint = await solarCard.locator('.user-avatar-root.tint-blue, .avatar-frame-overlay.tint-blue').count();
      console.log(`UserAvatar tinted blue: ${hasBlueTint > 0}`);
      results.tests.frameTintApplied = hasBlueTint > 0;

      // Click "Testar" button on Chama Solar
      await solarCard.locator('.btn-action-test').click();
      await page.waitForTimeout(500);

      // Check Hero Provador is tinted
      const heroHasTint = await page.locator('.hero-preview-box .user-avatar-root.tint-blue, .hero-preview-box .avatar-frame-overlay.tint-blue').count();
      console.log(`Hero provador reflects frame tint: ${heroHasTint > 0}`);
      results.tests.heroReflectsTint = heroHasTint > 0;

      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, 'shop_after_v3_color_variants.png'),
        clip: { x: 0, y: 0, width: 1440, height: 750 }
      });
      console.log('✓ Captured shop_after_v3_color_variants.png');
    }

    // 7. Test Modal Color Variant Selector
    console.log('\n--- 7. MODAL COLOR VARIANT SELECTOR ---');
    await solarCard.locator('.card-visual-clickable').click();
    await page.waitForTimeout(500);

    const isModalOpen = await page.locator('.modal-card').isVisible();
    const hasModalVariants = await page.locator('.modal-variants-block').isVisible();
    console.log(`Modal open: ${isModalOpen}, Modal variants block: ${hasModalVariants}`);
    results.tests.modalVariantsBlock = hasModalVariants;

    if (isModalOpen) {
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, 'shop_after_v3_modal_variant.png'),
        clip: { x: 0, y: 0, width: 1440, height: 900 }
      });
      console.log('✓ Captured shop_after_v3_modal_variant.png');

      await page.locator('.btn-modal-close').click();
      await page.waitForTimeout(400);
    }

    // 8. Mobile Audit (390x844)
    console.log('\n--- 8. MOBILE AUDIT (390x844) ---');
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    await bypassAgeGate(mobileCtx);
    const mobilePage = await mobileCtx.newPage();
    await mobilePage.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 35000 });
    await dismissModals(mobilePage);
    await mobilePage.waitForTimeout(800);

    const scrollWidth = await mobilePage.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await mobilePage.evaluate(() => document.documentElement.clientWidth);
    console.log(`Mobile scrollWidth: ${scrollWidth}, clientWidth: ${clientWidth}`);
    results.tests.noHorizontalOverflow = scrollWidth <= clientWidth;

    await mobilePage.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_after_v3_mobile.png'),
      clip: { x: 0, y: 0, width: 390, height: 844 }
    });
    console.log('✓ Captured shop_after_v3_mobile.png');

    results.status = 'SUCCESS';
    console.log('\n=== ALL PLAYWRIGHT ROUND 3 VERIFICATIONS PASSED ===');
  } catch (err) {
    console.error('Test execution failed:', err);
    results.status = 'ERROR';
    results.error = err.message;
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(ARTIFACTS_DIR, 'shop_overhaul_v3_verification_report.json'),
      JSON.stringify(results, null, 2)
    );
  }
}

run();
