/**
 * Comprehensive End-to-End Verification Suite for Project Nox:
 * ETAPA 1: Views, History, and Chapter Completion
 * ETAPA 2: Balanced XP Economy & Anti-Abuse
 * ETAPA 3: Floating RPG / Solo Leveling Progression Toasts
 * ETAPA 4: "✦ Como ganhar XP" section in Loja Cósmica
 * ETAPA 5: Full verification on Cloudflare Preview
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACTS_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49/xp_progression_verification';

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function runVerification() {
  console.log('--- STARTING PROJECT NOX XP & PROGRESSION COMPREHENSIVE AUDIT ---');

  const results = {
    step1_views_live_counted: false,
    step1_views_anti_inflation_dedupe: false,
    step2_loja_xp_section_desktop: false,
    step2_loja_xp_section_mobile: false,
    step3_loja_detailed_rules_toggle: false,
    step4_cosmetics_catalog_preserved_400: false,
    step5_floating_xp_toast_solo_leveling: false,
    step6_reader_shell_and_page_stack: false,
    step7_reader_end_and_completion_seal: false
  };

  // 1. LIVE VIEW & DEDUPLICATION AUDIT
  console.log('\n[1/6] Testing Live Views and Anti-Inflation Deduplication...');
  const testChapId = 'c2b454a0-c636-50c7-bc3f-7dc9160997f5';

  // Request 1: Should be counted or deduplicated cleanly
  const res1 = await fetch(`${PREVIEW_URL}/api/chapters/${testChapId}/view`, {
    method: 'POST',
    headers: {
      Origin: PREVIEW_URL,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestBrowser/1.0',
      Cookie: 'nox-vid=audit-visitor-unique-uuid-123'
    }
  });
  const data1 = await res1.json();
  console.log('✦ View Request 1 Response:', data1);

  // Request 2: Immediate duplicate with exact same visitor should return deduplicated
  const res2 = await fetch(`${PREVIEW_URL}/api/chapters/${testChapId}/view`, {
    method: 'POST',
    headers: {
      Origin: PREVIEW_URL,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestBrowser/1.0',
      Cookie: 'nox-vid=audit-visitor-unique-uuid-123'
    }
  });
  const data2 = await res2.json();
  console.log('✦ View Request 2 Response (Immediate Re-read):', data2);

  if (data1.counted || data1.reason === 'deduplicated') {
    results.step1_views_live_counted = true;
  }
  if (data2.counted === false && data2.reason === 'deduplicated') {
    results.step1_views_anti_inflation_dedupe = true;
  }

  // 2. BROWSER TESTS WITH PLAYWRIGHT
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  // 2.1 DESKTOP AUDIT: /loja
  console.log('\n[2/6] Testing /loja on Desktop (1440x900)...');
  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await desktopCtx.addCookies([
    { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' },
    { name: 'nox-blur-nsfw', value: 'false', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
  ]);

  const page = await desktopCtx.newPage();
  await page.goto(`${PREVIEW_URL}/loja`, { waitUntil: 'networkidle', timeout: 35000 });
  await page.waitForTimeout(2000);

  // Check "✦ Como ganhar XP" Section
  const xpSectionExists = await page.$eval('.how-to-earn-xp-section', el => Boolean(el)).catch(() => false);
  const xpTitle = await page.$eval('.xp-section-title', el => el.innerText.trim()).catch(() => '');
  console.log('✦ "Como ganhar XP" section present:', xpSectionExists, `(${xpTitle})`);

  // Check 6 Activity Cards
  const activityCards = await page.$$eval('.xp-activity-card', els => els.map(el => {
    const name = el.querySelector('.activity-name')?.innerText?.trim() || '';
    const reward = el.querySelector('.activity-reward-badge')?.innerText?.trim() || '';
    const desc = el.querySelector('.activity-desc')?.innerText?.trim() || '';
    return { name, reward, desc };
  }));
  console.log('✦ Activity Cards count:', activityCards.length);
  console.table(activityCards);

  if (activityCards.length === 6 && activityCards[0].reward === '+150 XP') {
    results.step2_loja_xp_section_desktop = true;
  }

  // Test Toggle Detailed Rules Accordion
  console.log('\n[3/6] Testing Detailed Rules & Transparency Toggle...');
  const toggleBtn = await page.$('.btn-toggle-xp-rules');
  if (toggleBtn) {
    await toggleBtn.click();
    await page.waitForTimeout(500);
    const panelVisible = await page.$eval('.xp-detailed-rules-panel', el => Boolean(el)).catch(() => false);
    const rulesCount = await page.$$eval('.rule-box', els => els.length).catch(() => 0);
    console.log('✦ Detailed rules panel opened:', panelVisible, `(${rulesCount} rule boxes)`);
    if (panelVisible && rulesCount === 4) {
      results.step3_loja_detailed_rules_toggle = true;
    }
  }

  // Capture Desktop Screenshot
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'desktop_loja_xp_section.png'), fullPage: false });
  console.log('📸 Saved desktop_loja_xp_section.png');

  // Verify 400 Cosmetics Catalog is 100% intact
  const catalogCountText = await page.$eval('.cat-count', el => el.innerText.trim()).catch(() => '0');
  console.log('✦ Catalog total count badge:', catalogCountText);
  if (parseInt(catalogCountText, 10) === 400) {
    results.step4_cosmetics_catalog_preserved_400 = true;
  }

  // 2.2 MOBILE AUDIT: /loja (390x844 iPhone 14)
  console.log('\n[4/6] Testing /loja on Mobile (390x844)...');
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true
  });
  await mobileCtx.addCookies([
    { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' },
    { name: 'nox-blur-nsfw', value: 'false', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
  ]);
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto(`${PREVIEW_URL}/loja`, { waitUntil: 'networkidle', timeout: 35000 });
  await mobilePage.waitForTimeout(2000);

  const mobileXpExists = await mobilePage.$eval('.how-to-earn-xp-section', el => Boolean(el)).catch(() => false);
  if (mobileXpExists) {
    results.step2_loja_xp_section_mobile = true;
  }
  await mobilePage.screenshot({ path: path.join(ARTIFACTS_DIR, 'mobile_loja_xp_section.png'), fullPage: false });
  console.log('📸 Saved mobile_loja_xp_section.png');

  // 2.3 SOLO LEVELING PROGRESSION TOAST TEST
  console.log('\n[5/6] Testing Floating RPG / Solo Leveling Progression Toast...');
  // Dispatch custom event in browser context
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('nox-xp-awarded', {
      detail: {
        amount: 150,
        title: 'Capítulo concluído',
        kind: 'READ_CHAPTER'
      }
    }));
  });
  await page.waitForTimeout(600);

  const toastVisible = await page.$eval('.xp-toast-card', el => Boolean(el)).catch(() => false);
  const toastText = await page.$eval('.xp-toast-card', el => el.innerText.trim()).catch(() => '');
  console.log('✦ Floating XP Toast visible:', toastVisible, `Text: "${toastText.replace(/\n+/g, ' ')}"`);

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'solo_leveling_xp_toast.png') });
  console.log('📸 Saved solo_leveling_xp_toast.png');
  if (toastVisible && toastText.includes('+150 XP')) {
    results.step5_floating_xp_toast_solo_leveling = true;
  }

  // 2.4 READER VIEW & COMPLETION TEST
  console.log('\n[6/6] Testing Reader Shell & Page Stack on Witch Craft Works #104...');
  const readerPage = await desktopCtx.newPage();
  await readerPage.goto(`${PREVIEW_URL}/ler/c2b454a0-c636-50c7-bc3f-7dc9160997f5`, { waitUntil: 'networkidle', timeout: 35000 });
  await readerPage.waitForTimeout(2500);

  const readerShell = await readerPage.$eval('.reader-shell', el => Boolean(el)).catch(() => false);
  const pageStack = await readerPage.$eval('.page-stack', el => Boolean(el)).catch(() => false);
  console.log('✦ Reader Shell rendered:', readerShell);
  console.log('✦ Page Stack rendered:', pageStack);

  if (readerShell && pageStack) {
    results.step6_reader_shell_and_page_stack = true;
  }

  // Scroll to chapter end
  await readerPage.evaluate(() => {
    const endEl = document.querySelector('.reader-end');
    if (endEl) endEl.scrollIntoView({ behavior: 'instant' });
  });
  await readerPage.waitForTimeout(2000);

  const endSeal = await readerPage.$eval('.celebration-seal', el => Boolean(el)).catch(() => false);
  console.log('✦ Celebration Seal at Chapter End rendered:', endSeal);
  if (endSeal) {
    results.step7_reader_end_and_completion_seal = true;
  }

  await readerPage.screenshot({ path: path.join(ARTIFACTS_DIR, 'reader_progression_proof.png') });
  console.log('📸 Saved reader_progression_proof.png');

  await browser.close();

  console.log('\n================ AUDIT SUMMARY ================');
  console.table(results);
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'verification_results.json'), JSON.stringify(results, null, 2));

  const allPassed = Object.values(results).every(v => v === true);
  console.log('ALL PHASES VALIDATED:', allPassed ? '✅ YES' : '❌ NO');
  return results;
}

runVerification().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
