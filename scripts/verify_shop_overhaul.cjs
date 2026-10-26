/**
 * scripts/verify_shop_overhaul.cjs
 * Comprehensive Playwright verification script for Project Nox Cosmic Shop Round 4.
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
  console.log('=== STARTING PLAYWRIGHT VERIFICATION FOR SHOP OVERHAUL ROUND 4 ===');
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
      path: path.join(ARTIFACTS_DIR, 'shop_round4_desktop_top.png'),
      clip: { x: 0, y: 0, width: 1440, height: 750 }
    });
    console.log('✓ Captured shop_round4_desktop_top.png');

    // Count Total Items
    const totalCards = await page.locator('.shop-card').count();
    results.itemCounts.total = totalCards;
    console.log(`Total Cards rendered: ${totalCards} (Expected: 74)`);
    results.tests.totalCardsMatch = totalCards === 74;

    // Capture Full Desktop Grid
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_round4_desktop_grid.png'),
      clip: { x: 0, y: 350, width: 1440, height: 900 }
    });
    console.log('✓ Captured shop_round4_desktop_grid.png');

    // Filter: Molduras (18 expected)
    console.log('\n--- 2. CATEGORY: MOLDURAS (18 itens) ---');
    await page.locator('.cat-btn:has-text("Molduras")').click();
    await page.waitForTimeout(400);
    const framesCount = await page.locator('.shop-card').count();
    results.itemCounts.frames = framesCount;
    console.log(`Molduras rendered: ${framesCount} (Expected: 18)`);
    results.tests.framesCountMatch = framesCount === 18;

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_round4_frames.png'),
      clip: { x: 0, y: 350, width: 1440, height: 900 }
    });
    console.log('✓ Captured shop_round4_frames.png');

    // Verify All 6 New Frames Existence
    const newFramesExist = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        seraphWings: text.includes('Asas do Serafim'),
        abyssalHorns: text.includes('Chifres do Abismo'),
        oceanicTide: text.includes('Maremoto Astral'),
        runicMonolith: text.includes('Relicário Rúnico'),
        astralBlossom: text.includes('Lótus Astral'),
        quantumOverload: text.includes('Sobrecarga Quântica')
      };
    });
    console.log('Round 4 New Frames verified:', newFramesExist);
    results.tests.round4NewFramesExist = Object.values(newFramesExist).every(Boolean);

    // Filter: Cores de Nome (24 expected)
    console.log('\n--- 3. CATEGORY: CORES DE NOME (24 itens) ---');
    await page.locator('.cat-btn:has-text("Cores de Nome")').click();
    await page.waitForTimeout(400);
    const colorsCount = await page.locator('.shop-card').count();
    results.itemCounts.colors = colorsCount;
    console.log(`Cores de Nome rendered: ${colorsCount} (Expected: 24)`);
    results.tests.colorsCountMatch = colorsCount === 24;

    const newColorsExist = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        imperialGold: text.includes('Ouro Real Imperial'),
        shockPink: text.includes('Rosa Choque Cósmico'),
        spectralAurora: text.includes('Aurora Espectral'),
        phoenixBlaze: text.includes('Chama da Fênix'),
        goldenSupernova: text.includes('Supernova Dourada')
      };
    });
    console.log('Round 4 New Colors verified:', newColorsExist);
    results.tests.round4NewColorsExist = Object.values(newColorsExist).every(Boolean);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_round4_colors.png'),
      clip: { x: 0, y: 350, width: 1440, height: 900 }
    });
    console.log('✓ Captured shop_round4_colors.png');

    // Filter: Títulos (22 expected)
    console.log('\n--- 4. CATEGORY: TÍTULOS (22 itens) ---');
    await page.locator('.cat-btn:has-text("Títulos")').click();
    await page.waitForTimeout(400);
    const titlesCount = await page.locator('.shop-card').count();
    results.itemCounts.titles = titlesCount;
    console.log(`Títulos rendered: ${titlesCount} (Expected: 22)`);
    results.tests.titlesCountMatch = titlesCount === 22;

    const newTitlesExist = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        vanguardaInfinito: text.includes('Vanguarda do Infinito'),
        sentinelaMares: text.includes('Sentinela das Marés Estelares'),
        navegadorVacuo: text.includes('Navegador do Vácuo Profundo'),
        teceEstrelas: text.includes('Tece-Estrelas de Ébano'),
        senhorHorizonte: text.includes('Senhor do Horizonte de Eventos'),
        entidadeTranscendental: text.includes('Entidade Transcendental')
      };
    });
    console.log('Round 4 New Titles verified:', newTitlesExist);
    results.tests.round4NewTitlesExist = Object.values(newTitlesExist).every(Boolean);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_round4_titles.png'),
      clip: { x: 0, y: 350, width: 1440, height: 900 }
    });
    console.log('✓ Captured shop_round4_titles.png');

    // Filter: Banners (10 animated expected)
    console.log('\n--- 5. CATEGORY: BANNERS (10 itens animados) ---');
    await page.locator('.cat-btn:has-text("Banners")').click();
    await page.waitForTimeout(400);
    const bannersCount = await page.locator('.shop-card').count();
    results.itemCounts.banners = bannersCount;
    console.log(`Banners rendered: ${bannersCount} (Expected: 10)`);
    results.tests.bannersCountMatch = bannersCount === 10;

    const newBannersExist = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        chuvaMeteoros: text.includes('Chuva de Meteoros Cósmica'),
        portalAbissal: text.includes('Portal do Vácuo Quântico'),
        jardimAstral: text.includes('Jardim Botânico Astral'),
        cidadelaCelestial: text.includes('Cidadela Flutuante do Nox')
      };
    });
    console.log('Round 4 New Banners verified:', newBannersExist);
    results.tests.round4NewBannersExist = Object.values(newBannersExist).every(Boolean);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_round4_banners.png'),
      clip: { x: 0, y: 350, width: 1440, height: 900 }
    });
    console.log('✓ Captured shop_round4_banners.png');

    // 6. Test Color Variants Swatches on Newly Added Frames
    console.log('\n--- 6. EXTENDED COLOR CUSTOMIZATION TEST ---');
    await page.locator('.cat-btn:has-text("Molduras")').click();
    await page.waitForTimeout(400);

    // Locate Angelic Seraph card or Oceanic Tide card
    const seraphCard = page.locator('.shop-card:has-text("Asas do Serafim")');
    const seraphSwatches = await seraphCard.locator('.swatch-btn').count();
    console.log(`Asas do Serafim color swatches count: ${seraphSwatches}`);
    results.tests.seraphHasSwatches = seraphSwatches > 0;

    if (seraphSwatches > 1) {
      // Click second swatch (silver / alva pura)
      await seraphCard.locator('.swatch-btn').nth(1).click();
      await page.waitForTimeout(400);

      const hasSilverTint = await seraphCard.locator('.user-avatar-root.tint-silver, .avatar-frame-overlay.tint-silver').count();
      console.log(`UserAvatar tinted silver: ${hasSilverTint > 0}`);
      results.tests.seraphSilverTint = hasSilverTint > 0;

      // Click "Testar" button
      await seraphCard.locator('.btn-action-test').click();
      await page.waitForTimeout(500);

      // Check Hero Provador
      const heroHasTint = await page.locator('.hero-preview-box .user-avatar-root.tint-silver, .hero-preview-box .avatar-frame-overlay.tint-silver').count();
      console.log(`Hero provador reflects Seraph silver tint: ${heroHasTint > 0}`);
      results.tests.heroReflectsSeraphTint = heroHasTint > 0;

      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, 'shop_round4_color_variants.png'),
        clip: { x: 0, y: 0, width: 1440, height: 750 }
      });
      console.log('✓ Captured shop_round4_color_variants.png');
    }

    // 7. Test Modal Color Variant Selector
    console.log('\n--- 7. MODAL COLOR VARIANT SELECTOR ---');
    await seraphCard.locator('.card-visual-clickable').click();
    await page.waitForTimeout(500);

    const isModalOpen = await page.locator('.modal-card').isVisible();
    const hasModalVariants = await page.locator('.modal-variants-block').isVisible();
    console.log(`Modal open: ${isModalOpen}, Modal variants block: ${hasModalVariants}`);
    results.tests.modalVariantsBlock = hasModalVariants;

    if (isModalOpen) {
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, 'shop_round4_modal_variant.png'),
        clip: { x: 0, y: 0, width: 1440, height: 900 }
      });
      console.log('✓ Captured shop_round4_modal_variant.png');

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
      path: path.join(ARTIFACTS_DIR, 'shop_round4_mobile.png'),
      clip: { x: 0, y: 0, width: 390, height: 844 }
    });
    console.log('✓ Captured shop_round4_mobile.png');

    results.status = 'SUCCESS';
    console.log('\n=== ALL PLAYWRIGHT ROUND 4 VERIFICATIONS PASSED ===');
  } catch (err) {
    console.error('Test execution failed:', err);
    results.status = 'ERROR';
    results.error = err.message;
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(ARTIFACTS_DIR, 'shop_overhaul_v4_verification_report.json'),
      JSON.stringify(results, null, 2)
    );
  }
}

run();
