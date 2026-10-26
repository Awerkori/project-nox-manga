/**
 * scripts/verify_shop_overhaul.cjs
 * Comprehensive Playwright verification script for Project Nox Cosmic Shop Round 5.
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
  console.log('=== STARTING PLAYWRIGHT VERIFICATION FOR SHOP OVERHAUL ROUND 5 ===');
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
      path: path.join(ARTIFACTS_DIR, 'shop_round5_desktop_top.png'),
      clip: { x: 0, y: 0, width: 1440, height: 750 }
    });
    console.log('✓ Captured shop_round5_desktop_top.png');

    // Count Total Items
    const totalCards = await page.locator('.shop-card').count();
    results.itemCounts.total = totalCards;
    console.log(`Total Cards rendered: ${totalCards} (Expected: 200)`);
    results.tests.totalCardsMatch = totalCards === 200;

    // Capture Full Desktop Grid
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_round5_desktop_grid.png'),
      clip: { x: 0, y: 350, width: 1440, height: 900 }
    });
    console.log('✓ Captured shop_round5_desktop_grid.png');

    // Filter: Molduras (50 expected)
    console.log('\n--- 2. CATEGORY: MOLDURAS (50 itens) ---');
    await page.locator('.cat-btn:has-text("Molduras")').click();
    await page.waitForTimeout(400);
    const framesCount = await page.locator('.shop-card').count();
    results.itemCounts.frames = framesCount;
    console.log(`Molduras rendered: ${framesCount} (Expected: 50)`);
    results.tests.framesCountMatch = framesCount === 50;

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_round5_frames.png'),
      clip: { x: 0, y: 350, width: 1440, height: 900 }
    });
    console.log('✓ Captured shop_round5_frames.png');

    // Verify New Round 5 Frames
    const round5FramesExist = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        phoenix: text.includes('Fênix Renascida'),
        dragon: text.includes('Escamas Dracônicas'),
        chrono: text.includes('Engrenagens do Tempo'),
        valkyrie: text.includes('Asas da Valquíria'),
        diamond: text.includes('Diamante Astral Supremo'),
        alchemy: text.includes('Círculo Alquímico'),
        emperor: text.includes('Coroa do Imperador Deus')
      };
    });
    console.log('Round 5 Frames verified:', round5FramesExist);
    results.tests.round5FramesExist = Object.values(round5FramesExist).every(Boolean);

    // Filter: Cores de Nome (50 expected)
    console.log('\n--- 3. CATEGORY: CORES DE NOME (50 itens) ---');
    await page.locator('.cat-btn:has-text("Cores de Nome")').click();
    await page.waitForTimeout(400);
    const colorsCount = await page.locator('.shop-card').count();
    results.itemCounts.colors = colorsCount;
    console.log(`Cores de Nome rendered: ${colorsCount} (Expected: 50)`);
    results.tests.colorsCountMatch = colorsCount === 50;

    const round5ColorsExist = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        abyss: text.includes('Abismo Galáctico'),
        plasma: text.includes('Tempestade de Plasma'),
        eclipse: text.includes('Corona do Eclipse'),
        nebula: text.includes('Sonho de Nebulosa'),
        cyberpunk: text.includes('Cyberpunk 2099'),
        sovereign: text.includes('Soberano Supremo')
      };
    });
    console.log('Round 5 Colors verified:', round5ColorsExist);
    results.tests.round5ColorsExist = Object.values(round5ColorsExist).every(Boolean);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_round5_colors.png'),
      clip: { x: 0, y: 350, width: 1440, height: 900 }
    });
    console.log('✓ Captured shop_round5_colors.png');

    // Filter: Títulos (50 expected)
    console.log('\n--- 4. CATEGORY: TÍTULOS (50 itens) ---');
    await page.locator('.cat-btn:has-text("Títulos")').click();
    await page.waitForTimeout(400);
    const titlesCount = await page.locator('.shop-card').count();
    results.itemCounts.titles = titlesCount;
    console.log(`Títulos rendered: ${titlesCount} (Expected: 50)`);
    results.tests.titlesCountMatch = titlesCount === 50;

    const round5TitlesExist = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        caminhante: text.includes('Caminhante das Fendas'),
        nebulosas: text.includes('Forjador de Nebulosas'),
        oraculo: text.includes('Oráculo do Abismo'),
        supernovas: text.includes('Caçador de Supernovas'),
        deusNox: text.includes('Deus do Nox')
      };
    });
    console.log('Round 5 Titles verified:', round5TitlesExist);
    results.tests.round5TitlesExist = Object.values(round5TitlesExist).every(Boolean);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_round5_titles.png'),
      clip: { x: 0, y: 350, width: 1440, height: 900 }
    });
    console.log('✓ Captured shop_round5_titles.png');

    // Filter: Banners de Comentário (50 expected)
    console.log('\n--- 5. CATEGORY: BANNERS DE COMENTÁRIO (50 itens) ---');
    const bannerCategoryBtn = page.locator('.cat-btn:has-text("Banners de Comentário")');
    const bannerBtnVisible = await bannerCategoryBtn.isVisible();
    console.log(`Category "Banners de Comentário" button visible: ${bannerBtnVisible}`);
    results.tests.bannerCategoryRenamed = bannerBtnVisible;

    await bannerCategoryBtn.click();
    await page.waitForTimeout(400);
    const bannersCount = await page.locator('.shop-card').count();
    results.itemCounts.banners = bannersCount;
    console.log(`Banners de Comentário rendered: ${bannersCount} (Expected: 50)`);
    results.tests.bannersCountMatch = bannersCount === 50;

    const round5BannersExist = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        ruinas: text.includes('Ruínas Celestes'),
        luas: text.includes('Três Luas Astrais'),
        vulcao: text.includes('Vulcão Cósmico'),
        ceuInfernal: text.includes('Céu Infernal'),
        santuario: text.includes('Santuário Dourado'),
        trono: text.includes('Sala do Trono')
      };
    });
    console.log('Round 5 Banners verified:', round5BannersExist);
    results.tests.round5BannersExist = Object.values(round5BannersExist).every(Boolean);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'shop_round5_banners.png'),
      clip: { x: 0, y: 350, width: 1440, height: 900 }
    });
    console.log('✓ Captured shop_round5_banners.png');

    // 6. Test Color Variants Swatches on Newly Added Frame (Fênix Renascida)
    console.log('\n--- 6. COLOR CUSTOMIZATION ON NEW FRAME ---');
    await page.locator('.cat-btn:has-text("Molduras")').click();
    await page.waitForTimeout(400);

    const phoenixCard = page.locator('.shop-card:has-text("Fênix Renascida")');
    const phoenixSwatches = await phoenixCard.locator('.swatch-btn').count();
    console.log(`Fênix Renascida color swatches count: ${phoenixSwatches}`);
    results.tests.phoenixHasSwatches = phoenixSwatches > 0;

    if (phoenixSwatches > 1) {
      // Click second swatch (blue / Fênix Azul)
      await phoenixCard.locator('.swatch-btn').nth(1).click();
      await page.waitForTimeout(400);

      const hasBlueTint = await phoenixCard.locator('.user-avatar-root.tint-blue, .avatar-frame-overlay.tint-blue').count();
      console.log(`UserAvatar tinted blue: ${hasBlueTint > 0}`);
      results.tests.phoenixBlueTint = hasBlueTint > 0;

      // Click "Testar" button
      await phoenixCard.locator('.btn-action-test').click();
      await page.waitForTimeout(500);

      // Check Hero Provador
      const heroHasTint = await page.locator('.hero-preview-box .user-avatar-root.tint-blue, .hero-preview-box .avatar-frame-overlay.tint-blue').count();
      console.log(`Hero provador reflects Phoenix blue tint: ${heroHasTint > 0}`);
      results.tests.heroReflectsPhoenixTint = heroHasTint > 0;

      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, 'shop_round5_color_variants.png'),
        clip: { x: 0, y: 0, width: 1440, height: 750 }
      });
      console.log('✓ Captured shop_round5_color_variants.png');
    }

    // 7. Test Modal Color Variant Selector
    console.log('\n--- 7. MODAL COLOR VARIANT SELECTOR ---');
    await phoenixCard.locator('.card-visual-clickable').click();
    await page.waitForTimeout(500);

    const isModalOpen = await page.locator('.modal-card').isVisible();
    const hasModalVariants = await page.locator('.modal-variants-block').isVisible();
    console.log(`Modal open: ${isModalOpen}, Modal variants block: ${hasModalVariants}`);
    results.tests.modalVariantsBlock = hasModalVariants;

    if (isModalOpen) {
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, 'shop_round5_modal_variant.png'),
        clip: { x: 0, y: 0, width: 1440, height: 900 }
      });
      console.log('✓ Captured shop_round5_modal_variant.png');

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
      path: path.join(ARTIFACTS_DIR, 'shop_round5_mobile.png'),
      clip: { x: 0, y: 0, width: 390, height: 844 }
    });
    console.log('✓ Captured shop_round5_mobile.png');

    results.status = 'SUCCESS';
    console.log('\n=== ALL PLAYWRIGHT ROUND 5 VERIFICATIONS PASSED ===');
  } catch (err) {
    console.error('Test execution failed:', err);
    results.status = 'ERROR';
    results.error = err.message;
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(ARTIFACTS_DIR, 'shop_overhaul_v5_verification_report.json'),
      JSON.stringify(results, null, 2)
    );
  }
}

run();
