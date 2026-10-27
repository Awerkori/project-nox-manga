const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const BASE_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';

async function dismissAgeGate(page) {
  try {
    const ageBtn = await page.$('.btn-adult, button:has-text("Sim, sou maior de 18")');
    if (ageBtn) {
      await ageBtn.click();
      await page.waitForTimeout(300);
      const confBtn = await page.$('.btn-complete, button:has-text("Concluir")');
      if (confBtn) {
        await confBtn.click();
        await page.waitForTimeout(300);
      }
    }
  } catch (_) {}
}

async function createContextWithAdultCookie(browser, options = {}) {
  const context = await browser.newContext(options);
  await context.addCookies([
    {
      name: 'nox-age-status',
      value: 'ADULT',
      domain: 'home-preview-manga.project-nox-awerkori.workers.dev',
      path: '/'
    },
    {
      name: 'nox-blur-nsfw',
      value: 'false',
      domain: 'home-preview-manga.project-nox-awerkori.workers.dev',
      path: '/'
    }
  ]);
  return context;
}

async function runVerification() {
  console.log('--- STARTING COMPREHENSIVE ROUND 7 VERIFICATION ---');
  const browser = await chromium.launch({ headless: true });
  const results = {
    timestamp: new Date().toISOString(),
    desktopPodiumOlympic: false,
    mobilePodiumOrdered: false,
    headerActionsBalanced: false,
    rulesModalWorks: false,
    rulesModalEscapeCloses: false,
    shopVariantsReactive: false,
    shopModalVariantsReactive: false
  };

  try {
    // -------------------------------------------------------------
    // TEST 1: DESKTOP PODIUM OLYMPIC ORDER & HEADER ACTIONS
    // -------------------------------------------------------------
    const desktopContext = await createContextWithAdultCookie(browser, { viewport: { width: 1280, height: 900 } });
    const desktopPage = await desktopContext.newPage();

    console.log('Navigating to Desktop Ranking:', `${BASE_URL}/ranking`);
    await desktopPage.goto(`${BASE_URL}/ranking`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await dismissAgeGate(desktopPage);
    await desktopPage.waitForSelector('.podium-grid', { timeout: 15000 });

    // Verify Header Actions: Hall da Fama and Regras do Ciclo
    const hofBtn = await desktopPage.$('.header-action-btn.btn-hall-fame');
    const rulesBtn = await desktopPage.$('.header-action-btn.btn-rules');
    if (hofBtn && rulesBtn) {
      const hofBox = await hofBtn.boundingBox();
      const rulesBox = await rulesBtn.boundingBox();
      console.log(`Header buttons: HoF height=${hofBox.height}px, Rules height=${rulesBox.height}px`);
      if (Math.abs(hofBox.height - rulesBox.height) <= 3) {
        results.headerActionsBalanced = true;
      }
    }

    const headerEl = await desktopPage.$('.ranking-header');
    if (headerEl) {
      await headerEl.screenshot({ path: path.join(ARTIFACT_DIR, 'round7_3_header_actions_balanced.png') });
    }

    // Measure podium boxes horizontal order on Desktop
    const goldBoxEl = await desktopPage.$('.gold-tier');
    const silverBoxEl = await desktopPage.$('.silver-tier');
    const bronzeBoxEl = await desktopPage.$('.bronze-tier');

    if (goldBoxEl && silverBoxEl && bronzeBoxEl) {
      const gBox = await goldBoxEl.boundingBox();
      const sBox = await silverBoxEl.boundingBox();
      const bBox = await bronzeBoxEl.boundingBox();

      console.log(`Desktop Podium X coordinates: Silver=${sBox.x}, Gold=${gBox.x}, Bronze=${bBox.x}`);
      if (sBox.x < gBox.x && gBox.x < bBox.x) {
        results.desktopPodiumOlympic = true;
        console.log('✓ Desktop Podium is Olympic layout: 2º (Silver) | 1º (Gold) | 3º (Bronze)');
      } else {
        console.error('✗ Desktop Podium horizontal alignment failed!');
      }

      const podiumSection = await desktopPage.$('.podium-section');
      if (podiumSection) {
        await podiumSection.screenshot({ path: path.join(ARTIFACT_DIR, 'round7_1_top3_podium_desktop.png') });
      }
    }

    // -------------------------------------------------------------
    // TEST 2: REGRAS DO CICLO MODAL (DESKTOP)
    // -------------------------------------------------------------
    console.log('Testing Regras do Ciclo Modal...');
    await rulesBtn.click();
    await desktopPage.waitForSelector('.modal-box-rules', { timeout: 5000 });
    const modalEl = await desktopPage.$('.modal-box-rules');
    if (modalEl) {
      results.rulesModalWorks = true;
      await desktopPage.screenshot({ path: path.join(ARTIFACT_DIR, 'round7_4_regras_do_ciclo_modal_desktop.png') });
      console.log('✓ Regras do Ciclo modal opened cleanly.');

      // Test Escape key closes modal
      await desktopPage.keyboard.press('Escape');
      await desktopPage.waitForTimeout(500);
      const isVisible = await desktopPage.$('.modal-box-rules');
      if (!isVisible) {
        results.rulesModalEscapeCloses = true;
        console.log('✓ Escape key successfully closed the modal!');
      }
    }

    await desktopContext.close();

    // -------------------------------------------------------------
    // TEST 3: MOBILE PODIUM ORDER (1º Gold -> 2º Silver -> 3º Bronze)
    // -------------------------------------------------------------
    console.log('Testing Mobile Podium...');
    const mobileContext = await createContextWithAdultCookie(browser, {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`${BASE_URL}/ranking`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await dismissAgeGate(mobilePage);
    await mobilePage.waitForSelector('.podium-grid', { timeout: 15000 });

    const mGold = await mobilePage.$('.gold-tier');
    const mSilver = await mobilePage.$('.silver-tier');
    const mBronze = await mobilePage.$('.bronze-tier');

    if (mGold && mSilver && mBronze) {
      const gBox = await mGold.boundingBox();
      const sBox = await mSilver.boundingBox();
      const bBox = await mBronze.boundingBox();

      console.log(`Mobile Podium Y coordinates: Gold=${gBox.y}, Silver=${sBox.y}, Bronze=${bBox.y}`);
      if (gBox.y < sBox.y && sBox.y < bBox.y) {
        results.mobilePodiumOrdered = true;
        console.log('✓ Mobile Podium is strictly ordered: 1º (Gold) -> 2º (Silver) -> 3º (Bronze)!');
      } else {
        console.error('✗ Mobile Podium vertical ordering failed!');
      }

      const mPodiumSection = await mobilePage.$('.podium-section');
      if (mPodiumSection) {
        await mPodiumSection.screenshot({ path: path.join(ARTIFACT_DIR, 'round7_2_top3_podium_mobile_ordered.png') });
      }
    }

    // Test Mobile Regras do Ciclo modal
    const mRulesBtn = await mobilePage.$('.header-action-btn.btn-rules');
    if (mRulesBtn) {
      await mRulesBtn.click();
      await mobilePage.waitForSelector('.modal-box-rules', { timeout: 5000 });
      await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'round7_5_regras_do_ciclo_modal_mobile.png') });
      console.log('✓ Mobile Regras do Ciclo modal rendered and captured.');
      const doneBtn = await mobilePage.$('.btn-modal-done');
      if (doneBtn) await doneBtn.click();
    }

    await mobileContext.close();

    // -------------------------------------------------------------
    // TEST 4: LOJA CÓSMICA COLOR VARIANTS REACTIVITY
    // -------------------------------------------------------------
    console.log('Testing Loja Cósmica Color Variants...');
    const shopContext = await createContextWithAdultCookie(browser, { viewport: { width: 1280, height: 900 } });
    const shopPage = await shopContext.newPage();
    await shopPage.goto(`${BASE_URL}/loja`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await dismissAgeGate(shopPage);
    await shopPage.waitForSelector('.shop-card', { timeout: 15000 });

    // Find the first card with .swatches-list
    const cardWithSwatches = await shopPage.$('.shop-card:has(.swatches-list)');
    if (cardWithSwatches) {
      console.log('Found shop card with color variants swatches.');
      // Get initial class on avatar root inside this card
      const avatarEl = await cardWithSwatches.$('.user-avatar-root');
      const initialClass = await avatarEl.getAttribute('class');
      console.log('Initial avatar classes:', initialClass);

      // Click second swatch button (e.g. gold or cyan)
      const swatches = await cardWithSwatches.$$('.swatch-btn');
      if (swatches.length >= 2) {
        await swatches[1].click();
        await shopPage.waitForTimeout(300);
        const updatedClass = await avatarEl.getAttribute('class');
        console.log('Updated avatar classes after swatch click:', updatedClass);

        if (updatedClass !== initialClass && updatedClass.includes('tint-')) {
          results.shopVariantsReactive = true;
          console.log('✓ Card avatar successfully reacted to variant swatch click with tint class!');
        }

        await cardWithSwatches.screenshot({ path: path.join(ARTIFACT_DIR, 'round7_6_loja_variant_swatches_card.png') });
      }

      // Now click "Visualizar" button to open the modal
      const viewBtn = await cardWithSwatches.$('.btn-action-view');
      if (viewBtn) {
        await viewBtn.click();
        await shopPage.waitForSelector('.modal-card', { timeout: 5000 });
        const modalAvatar = await shopPage.$('.modal-card .user-avatar-root');
        const modalSwatches = await shopPage.$$('.modal-swatch-chip');

        if (modalAvatar && modalSwatches.length >= 3) {
          const mInitialClass = await modalAvatar.getAttribute('class');
          console.log('Modal initial avatar classes:', mInitialClass);
          // Click 3rd swatch chip in modal
          await modalSwatches[2].click();
          await shopPage.waitForTimeout(300);
          const mUpdatedClass = await modalAvatar.getAttribute('class');
          console.log('Modal updated avatar classes:', mUpdatedClass);

          if (mUpdatedClass !== mInitialClass && mUpdatedClass.includes('tint-')) {
            results.shopModalVariantsReactive = true;
            console.log('✓ Modal preview avatar successfully updated color variant tint!');
          }

          const modalEl = await shopPage.$('.modal-card');
          if (modalEl) {
            await modalEl.screenshot({ path: path.join(ARTIFACT_DIR, 'round7_7_loja_variant_swatches_modal.png') });
          }
        }
      }
    } else {
      console.error('No card with .swatches-list found on /loja!');
    }

    await shopContext.close();

    fs.writeFileSync(path.join(ARTIFACT_DIR, 'round7_results.json'), JSON.stringify(results, null, 2));
    console.log('--- ROUND 7 VERIFICATION FINISHED ---');
    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await browser.close();
  }
}

runVerification();
