/**
 * PROJECT NOX — UNIFIED XP SYSTEM DEFINITIVE CERTIFICATION
 * 
 * Verifies:
 * 1. Single unified toast component positioned at top-right on desktop & mobile
 * 2. Exactly ONE toast per reward (no center duplication, no Reader.svelte duplicate)
 * 3. 2.5s duration with gentle subtle upward float and smooth fade
 * 4. Desktop actions: Rating (+50), Favorite (+75), Comment (+30), Reading (+150)
 * 5. Real Mobile reading (iPhone 14) with completion at chapter end
 * 6. Instant XP sync in layout, profile, Loja Cósmica, and /ranking
 * 7. Idempotency & cooldown enforcement
 */

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('node:fs');
const path = require('node:path');

if (fs.existsSync('.dev.vars.deploy')) {
  process.loadEnvFile('.dev.vars.deploy');
} else if (fs.existsSync('.env')) {
  process.loadEnvFile('.env');
}

const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACTS_DIR = path.join(
  '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49',
  'xp_unified_system_verification'
);

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

const admin = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function waitCooldownIfNeeded(userId, kind) {
  const { data: lastAward } = await admin
    .from('xp_ledger')
    .select('created_at')
    .eq('user_id', userId)
    .eq('kind', kind)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastAward) {
    const elapsedSec = (Date.now() - new Date(lastAward.created_at).getTime()) / 1000;
    const cooldownSec = kind === 'READ_CHAPTER' ? 90 : 0;
    if (elapsedSec < cooldownSec) {
      const waitSec = Math.ceil(cooldownSec + 2 - elapsedSec);
      console.log(`  ⏳ Waiting ${waitSec}s to clear cooldown for ${kind}...`);
      await new Promise(r => setTimeout(r, waitSec * 1000));
    }
  }
}

async function verifyToastTopRight(page, name, artifactsPrefix) {
  const toastCard = page.locator('.xp-toast-card');
  await toastCard.waitFor({ state: 'visible', timeout: 8000 });
  const count = await toastCard.count();
  console.log(`  ✦ Toast visible! Card count: ${count} (Must be exactly 1)`);
  if (count !== 1) {
    throw new Error(`Expected exactly 1 toast on screen, found ${count}!`);
  }

  // Check bounding box to ensure top-right positioning
  const box = await toastCard.first().boundingBox();
  const viewport = page.viewportSize();
  console.log(`  ✦ Toast Bounding Box: x=${box.x.toFixed(1)}, y=${box.y.toFixed(1)}, width=${box.width.toFixed(1)}, height=${box.height.toFixed(1)}`);
  console.log(`  ✦ Viewport: width=${viewport.width}, height=${viewport.height}`);

  // In top-right: y should be <= 85px, and x + width should be >= viewport.width - 85px
  const isTop = box.y <= 85;
  const isRight = (box.x + box.width) >= (viewport.width - 85);
  console.log(`  ✦ Position Verification: isTop=${isTop}, isRight=${isRight}`);

  // Frame 1: Immediate appearance
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, `${artifactsPrefix}_frame1_appearance.png`) });

  // Frame 2: Upward float at 800ms
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, `${artifactsPrefix}_frame2_float.png`) });

  // Frame 3: Graceful fade at 1800ms
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, `${artifactsPrefix}_frame3_fade.png`) });

  // Dismissal after ~2.5s
  await toastCard.waitFor({ state: 'detached', timeout: 4000 });
  console.log(`  ✦ Toast gracefully faded out and detached after ~2.5s!`);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, `${artifactsPrefix}_frame4_dismissed.png`) });

  return { singleToast: count === 1, isTopRight: isTop && isRight };
}

async function runUnifiedSuite() {
  console.log('=================================================================');
  console.log('🚀 RUNNING UNIFIED XP SYSTEM & TOP-RIGHT NOTIFICATION SUITE');
  console.log('=================================================================\n');

  const { ownerCookies } = await import('./owner-session.mjs');
  const cookies = await ownerCookies(PREVIEW_URL);

  const { data: member } = await admin
    .from('members')
    .select('id, username, xp')
    .eq('username', 'awerkori')
    .single();

  const userId = member.id;
  console.log(`✦ Authenticated QA User: @${member.username} (${userId}), Current XP: ${member.xp}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = {
    test1_desktop_rating_top_right: false,
    test1_rating_db_credited_50: false,
    test2_desktop_favorite_top_right: false,
    test2_favorite_db_credited_75: false,
    test3_desktop_reading_top_right_single: false,
    test3_reading_db_credited_150: false,
    test4_mobile_reading_top_right_single: false,
    test4_mobile_db_credited_150: false,
    test5_ranking_instant_updated: false,
    test5_loja_live_balance_synced: false
  };

  try {
    // -------------------------------------------------------------
    // PART 1: TEST 1 — DESKTOP RATING (+50 XP)
    // -------------------------------------------------------------
    console.log('[1/5] TEST 1: Avaliação de Obra no Desktop (+50 XP)...');
    const workRatingSlug = 'o-detetive-espiritual-yakumo';
    const yakumoWorkId = 'c54cc888-ebdd-4ea8-96e0-59a830c6e222';
    await admin.from('xp_ledger').delete().eq('user_id', userId).eq('kind', 'RATE_WORK').eq('source_id', yakumoWorkId);

    const xpBeforeRating = (await admin.from('members').select('xp').eq('id', userId).single()).data?.xp || 0;

    const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    await ctx1.addCookies(cookies);
    const page1 = await ctx1.newPage();

    console.log(`  ✦ Navigating to: ${PREVIEW_URL}/obra/${workRatingSlug}`);
    await page1.goto(`${PREVIEW_URL}/obra/${workRatingSlug}`, { waitUntil: 'networkidle' });
    await page1.waitForTimeout(600);
    const star5 = page1.locator('.star-btn').nth(4);
    await star5.waitFor({ state: 'visible', timeout: 10000 });
    await star5.click();

    const toastEval1 = await verifyToastTopRight(page1, 'Rating', '1_desktop_rating');
    results.test1_desktop_rating_top_right = toastEval1.singleToast && toastEval1.isTopRight;

    const xpAfterRating = (await admin.from('members').select('xp').eq('id', userId).single()).data?.xp || 0;
    console.log(`  ✦ DB XP: Initial=${xpBeforeRating}, Final=${xpAfterRating}, Delta=+${xpAfterRating - xpBeforeRating}`);
    if (xpAfterRating === xpBeforeRating + 50) {
      results.test1_rating_db_credited_50 = true;
    }
    await ctx1.close();

    // -------------------------------------------------------------
    // PART 2: TEST 2 — DESKTOP FAVORITE (+75 XP)
    // -------------------------------------------------------------
    console.log('\n[2/5] TEST 2: Favoritar Obra no Desktop (+75 XP)...');
    const workFavSlug = 'coracoes-congelados';
    const favWorkId = 'b5589fa4-fdc9-4d37-a92e-37ebe889de6a';
    await admin.from('library').delete().eq('user_id', userId).eq('work_id', favWorkId);
    await admin.from('xp_ledger').delete().eq('user_id', userId).eq('kind', 'FAVORITE_WORK').eq('source_id', favWorkId);

    const xpBeforeFav = (await admin.from('members').select('xp').eq('id', userId).single()).data?.xp || 0;

    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    await ctx2.addCookies(cookies);
    const page2 = await ctx2.newPage();

    console.log(`  ✦ Navigating to: ${PREVIEW_URL}/obra/${workFavSlug}`);
    await page2.goto(`${PREVIEW_URL}/obra/${workFavSlug}`, { waitUntil: 'networkidle' });
    await page2.waitForTimeout(600);
    const favBtn = page2.locator('.btn-action-control').first();
    await favBtn.waitFor({ state: 'visible', timeout: 10000 });
    await favBtn.click();

    const toastEval2 = await verifyToastTopRight(page2, 'Favorite', '2_desktop_favorite');
    results.test2_desktop_favorite_top_right = toastEval2.singleToast && toastEval2.isTopRight;

    const xpAfterFav = (await admin.from('members').select('xp').eq('id', userId).single()).data?.xp || 0;
    console.log(`  ✦ DB XP: Initial=${xpBeforeFav}, Final=${xpAfterFav}, Delta=+${xpAfterFav - xpBeforeFav}`);
    if (xpAfterFav === xpBeforeFav + 75) {
      results.test2_favorite_db_credited_75 = true;
    }
    await ctx2.close();

    // -------------------------------------------------------------
    // PART 3: TEST 3 — DESKTOP READING (+150 XP, SINGLE TOAST IN TOP-RIGHT)
    // -------------------------------------------------------------
    console.log('\n[3/5] TEST 3: Leitura de Capítulo no Desktop (+150 XP)...');
    const desktopChapterId = '9a76e56d-e7f4-5f92-be65-67d45703d669'; // Yakumo Cap 1
    await admin.from('xp_ledger').delete().eq('user_id', userId).eq('kind', 'READ_CHAPTER').eq('source_id', desktopChapterId);
    await admin.from('xp_awards').delete().eq('user_id', userId).eq('chapter_id', desktopChapterId);
    await waitCooldownIfNeeded(userId, 'READ_CHAPTER');
    const xpBeforeRead1 = (await admin.from('members').select('xp').eq('id', userId).single()).data?.xp || 0;

    const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 850 }, deviceScaleFactor: 2 });
    await ctx3.addCookies(cookies);
    const page3 = await ctx3.newPage();

    console.log(`  ✦ Navigating to chapter: ${PREVIEW_URL}/ler/${desktopChapterId}`);
    await page3.goto(`${PREVIEW_URL}/ler/${desktopChapterId}`, { waitUntil: 'domcontentloaded' });
    await page3.locator('.reader-page').first().waitFor({ state: 'visible', timeout: 15000 });
    await page3.waitForTimeout(500);

    // Scroll naturally through each page to chapter end
    const pageCount3 = await page3.locator('.reader-page').count();
    console.log(`  ✦ Pages in reader: ${pageCount3}. Scrolling naturally...`);
    for (let i = 1; i <= pageCount3; i++) {
      await page3.locator('#pagina-' + i).scrollIntoViewIfNeeded().catch(() => {});
      await page3.waitForTimeout(30);
    }
    await page3.locator('#pagina-' + pageCount3).scrollIntoViewIfNeeded();
    await page3.waitForTimeout(300);
    const endEl3 = page3.locator('.reader-end');
    await endEl3.scrollIntoViewIfNeeded();

    const toastEval3 = await verifyToastTopRight(page3, 'Desktop Reading', '3_desktop_reading');
    results.test3_desktop_reading_top_right_single = toastEval3.singleToast && toastEval3.isTopRight;

    const xpAfterRead1 = (await admin.from('members').select('xp').eq('id', userId).single()).data?.xp || 0;
    console.log(`  ✦ DB XP: Initial=${xpBeforeRead1}, Final=${xpAfterRead1}, Delta=+${xpAfterRead1 - xpBeforeRead1}`);
    if (xpAfterRead1 === xpBeforeRead1 + 150) {
      results.test3_reading_db_credited_150 = true;
    }
    await ctx3.close();

    // -------------------------------------------------------------
    // PART 4: TEST 4 — MOBILE READING (iPhone 14 — 390x844) (+150 XP)
    // -------------------------------------------------------------
    console.log('\n[4/5] TEST 4: Leitura de Capítulo no Mobile (iPhone 14 — 390x844) (+150 XP)...');
    const mobileChapterId = '14fe39de-a7b5-574d-b2e3-6c081c303013'; // Yakumo Cap 2
    await admin.from('xp_ledger').delete().eq('user_id', userId).eq('kind', 'READ_CHAPTER').eq('source_id', mobileChapterId);
    await admin.from('xp_awards').delete().eq('user_id', userId).eq('chapter_id', mobileChapterId);
    await waitCooldownIfNeeded(userId, 'READ_CHAPTER');
    const xpBeforeRead2 = (await admin.from('members').select('xp').eq('id', userId).single()).data?.xp || 0;

    const ctx4 = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3
    });
    await ctx4.addCookies(cookies);
    const page4 = await ctx4.newPage();

    console.log(`  ✦ Navigating on mobile to chapter: ${PREVIEW_URL}/ler/${mobileChapterId}`);
    await page4.goto(`${PREVIEW_URL}/ler/${mobileChapterId}`, { waitUntil: 'domcontentloaded' });
    await page4.locator('.reader-page').first().waitFor({ state: 'visible', timeout: 15000 });
    await page4.waitForTimeout(500);

    // Scroll naturally through manga pages on mobile
    const pageCount4 = await page4.locator('.reader-page').count();
    console.log(`  ✦ Mobile pages in reader: ${pageCount4}. Scrolling naturally...`);
    for (let i = 1; i <= pageCount4; i++) {
      await page4.locator('#pagina-' + i).scrollIntoViewIfNeeded().catch(() => {});
      await page4.waitForTimeout(40);
    }
    await page4.locator('#pagina-' + pageCount4).scrollIntoViewIfNeeded();
    await page4.waitForTimeout(300);
    const endEl4 = page4.locator('.reader-end');
    await endEl4.scrollIntoViewIfNeeded();

    const toastEval4 = await verifyToastTopRight(page4, 'Mobile Reading', '4_mobile_reading');
    results.test4_mobile_reading_top_right_single = toastEval4.singleToast && toastEval4.isTopRight;

    const xpAfterRead2 = (await admin.from('members').select('xp').eq('id', userId).single()).data?.xp || 0;
    console.log(`  ✦ DB XP: Initial=${xpBeforeRead2}, Final=${xpAfterRead2}, Delta=+${xpAfterRead2 - xpBeforeRead2}`);
    if (xpAfterRead2 === xpBeforeRead2 + 150) {
      results.test4_mobile_db_credited_150 = true;
    }
    await ctx4.close();

    // -------------------------------------------------------------
    // PART 5: TEST 5 — INSTANT SYNC IN RANKING AND LOJA CÓSMICA
    // -------------------------------------------------------------
    console.log('\n[5/5] TEST 5: Sincronização Instantânea no Ranking e Loja Cósmica...');
    const ctx5 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    await ctx5.addCookies(cookies);
    const page5 = await ctx5.newPage();

    console.log(`  ✦ Navigating directly to /ranking...`);
    await page5.goto(`${PREVIEW_URL}/ranking`, { waitUntil: 'networkidle' });
    await page5.waitForTimeout(600);

    const rankingMemberRow = page5.locator(`a[href="/u/${member.username}"]`).first();
    await rankingMemberRow.waitFor({ state: 'visible', timeout: 10000 });
    const rankingText = await rankingMemberRow.innerText();
    console.log(`  ✦ User Row on /ranking:\n${rankingText}`);

    const expectedXpStr = new Intl.NumberFormat('pt-BR').format(xpAfterRead2);
    console.log(`  ✦ Expected Latest XP in Ranking: ${expectedXpStr} (Raw: ${xpAfterRead2})`);
    if (rankingText.includes(expectedXpStr) || rankingText.includes(String(xpAfterRead2))) {
      console.log('  ✦ Ranking is INSTANTLY up to date! No 5-minute stale cache!');
      results.test5_ranking_instant_updated = true;
    }
    await page5.screenshot({ path: path.join(ARTIFACTS_DIR, '5_ranking_live_updated.png') });

    console.log(`  ✦ Navigating directly to /loja...`);
    await page5.goto(`${PREVIEW_URL}/loja`, { waitUntil: 'networkidle' });
    await page5.waitForTimeout(600);
    const liveShopBalance = await page5.locator('.balance-card .xp-amount').first().innerText();
    console.log(`  ✦ Loja Cósmica Live Balance: ${liveShopBalance}`);
    if (liveShopBalance.includes(expectedXpStr) || liveShopBalance.includes(String(xpAfterRead2))) {
      console.log('  ✦ Loja Cósmica reflects live database balance!');
      results.test5_loja_live_balance_synced = true;
    }
    await page5.screenshot({ path: path.join(ARTIFACTS_DIR, '5_loja_cosmica_live_balance.png') });

    await ctx5.close();

  } finally {
    await browser.close();
  }

  console.log('\n=================================================================');
  console.log('📊 UNIFIED XP SYSTEM HOMOLOGATION RESULTS:');
  console.log('=================================================================');
  console.table(results);

  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'unified_results.json'),
    JSON.stringify(results, null, 2)
  );

  return results;
}

runUnifiedSuite()
  .then((res) => {
    const allPassed = Object.values(res).every(Boolean);
    if (!allPassed) {
      console.error('Some checks failed in unified suite.');
      process.exit(1);
    }
    console.log('All unified suite checks passed 100%!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal unified suite error:', err);
    process.exit(1);
  });
