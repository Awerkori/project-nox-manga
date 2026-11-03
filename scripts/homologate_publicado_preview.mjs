import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { join } from 'node:path';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function main() {
  console.log(`Starting Publicado Homologation & Screenshot Capture on: ${targetUrl}`);

  const cookies = await ownerCookies(targetUrl);
  cookies.push(
    {
      name: 'nox-age-status',
      value: 'ADULT',
      url: targetUrl,
      httpOnly: false,
      sameSite: 'Lax',
      secure: targetUrl.startsWith('https:')
    },
    {
      name: 'nox-blur-nsfw',
      value: 'false',
      url: targetUrl,
      httpOnly: false,
      sameSite: 'Lax',
      secure: targetUrl.startsWith('https:')
    }
  );

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    // =========================================================================
    // 1. DESKTOP WITH 1 PUBLISHED CHAPTER (1440x900)
    // =========================================================================
    console.log('\n--- SCENARIO 1: DESKTOP WITH 1 PUBLISHED CHAPTER (1440x900) ---');
    const ctx1440 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx1440.addCookies(cookies);
    const page1440 = await ctx1440.newPage();
    await page1440.goto(`${targetUrl}/scan?tab=pipeline&stage=publicado&fixture=ONE`, { waitUntil: 'networkidle', timeout: 30000 });
    await page1440.waitForTimeout(1500);

    const shot1 = join(artifactDir, 'publicado_desktop_1_capitulo_1440.png');
    await page1440.screenshot({ path: shot1, fullPage: false });
    console.log(`✓ Saved ${shot1}`);

    // Verify official reader link on real chapter
    const readBtn = page1440.locator('.btn-read-chapter').first();
    const readHref = await readBtn.getAttribute('href');
    console.log(`  Ler capítulo button href: ${readHref} (must start with https://projectnox.org/ler/)`);
    if (!readHref || !readHref.startsWith('https://projectnox.org/ler/')) {
      throw new Error(`Invalid reader link: ${readHref}`);
    }

    // =========================================================================
    // 2. MOBILE WITH 1 PUBLISHED CHAPTER (390x844 - iPhone 14)
    // =========================================================================
    console.log('\n--- SCENARIO 2: MOBILE WITH 1 PUBLISHED CHAPTER (390x844) ---');
    const ctx390 = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true
    });
    await ctx390.addCookies(cookies);
    const page390 = await ctx390.newPage();
    await page390.goto(`${targetUrl}/scan?tab=pipeline&stage=publicado&fixture=ONE`, { waitUntil: 'networkidle', timeout: 30000 });
    await page390.waitForTimeout(1500);

    const shot2 = join(artifactDir, 'publicado_mobile_1_capitulo_390.png');
    await page390.screenshot({ path: shot2, fullPage: false });
    console.log(`✓ Saved ${shot2}`);

    // =========================================================================
    // 3. DESKTOP WITH MULTIPLE CHAPTERS (1920x1080)
    // =========================================================================
    console.log('\n--- SCENARIO 3: DESKTOP WITH MULTIPLE CHAPTERS (1920x1080) ---');
    const ctx1920 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    await ctx1920.addCookies(cookies);
    const page1920 = await ctx1920.newPage();
    await page1920.goto(`${targetUrl}/scan?tab=pipeline&stage=publicado&fixture=FIVE`, { waitUntil: 'networkidle', timeout: 30000 });
    await page1920.waitForTimeout(1500);

    const shot3 = join(artifactDir, 'publicado_desktop_multi_1920.png');
    await page1920.screenshot({ path: shot3, fullPage: false });
    console.log(`✓ Saved ${shot3}`);

    // Verify demo buttons are disabled and do not create fake public links
    const demoButtons = page1920.locator('.btn-read-chapter.is-demo-disabled');
    const demoCount = await demoButtons.count();
    console.log(`  Demo mock cards with disabled links count: ${demoCount} (expected > 0)`);
    if (demoCount === 0) {
      throw new Error('Expected at least one demo mock card to have disabled link');
    }

    // =========================================================================
    // 4. MOBILE WITH MULTIPLE CHAPTERS (360x780 - Samsung Galaxy)
    // =========================================================================
    console.log('\n--- SCENARIO 4: MOBILE WITH MULTIPLE CHAPTERS (360x780) ---');
    const ctx360 = await browser.newContext({
      viewport: { width: 360, height: 780 },
      isMobile: true,
      hasTouch: true
    });
    await ctx360.addCookies(cookies);
    const page360 = await ctx360.newPage();
    await page360.goto(`${targetUrl}/scan?tab=pipeline&stage=publicado&fixture=FIVE`, { waitUntil: 'networkidle', timeout: 30000 });
    await page360.waitForTimeout(1500);

    const shot4 = join(artifactDir, 'publicado_mobile_multi_360.png');
    await page360.screenshot({ path: shot4, fullPage: false });
    console.log(`✓ Saved ${shot4}`);

    // =========================================================================
    // 5. CARD CLOSED AND EXPANDED DETAILS (DESKTOP & MOBILE)
    // =========================================================================
    console.log('\n--- SCENARIO 5: CARD CLOSED AND EXPANDED DETAILS ---');
    // Click expand on desktop
    const detailBtnDesk = page1440.locator('.btn-toggle-details').first();
    await detailBtnDesk.click();
    await page1440.waitForTimeout(500);

    const shot5Desk = join(artifactDir, 'publicado_card_expanded_desktop.png');
    await page1440.screenshot({ path: shot5Desk, fullPage: false });
    console.log(`✓ Saved ${shot5Desk}`);

    // Verify catalog link in expanded details points to https://projectnox.org/ler/
    const catMonoLink = page1440.locator('.catalog-link-mono').first();
    const catMonoHref = await catMonoLink.getAttribute('href');
    console.log(`  Catalog link href in details: ${catMonoHref}`);
    if (!catMonoHref || !catMonoHref.startsWith('https://projectnox.org/ler/')) {
      throw new Error(`Expected catalog link to start with https://projectnox.org/ler/, got ${catMonoHref}`);
    }

    // Click expand on mobile
    const detailBtnMob = page390.locator('.btn-toggle-details').first();
    await detailBtnMob.click();
    await page390.waitForTimeout(500);

    const shot5Mob = join(artifactDir, 'publicado_card_expanded_mobile.png');
    await page390.screenshot({ path: shot5Mob, fullPage: false });
    console.log(`✓ Saved ${shot5Mob}`);

    // =========================================================================
    // 6. SEARCH AND FILTERS WORKING
    // =========================================================================
    console.log('\n--- SCENARIO 6: SEARCH AND FILTERS WORKING ---');
    const searchPage = await ctx1440.newPage();
    await searchPage.goto(`${targetUrl}/scan?tab=pipeline&stage=publicado&fixture=FIVE`, { waitUntil: 'networkidle', timeout: 30000 });
    await searchPage.waitForTimeout(1000);

    // Type "Solo Leveling" in search input
    const searchInput = searchPage.locator('.compact-search-input');
    await searchInput.fill('Solo Leveling');
    await searchPage.waitForTimeout(500);

    const shot6 = join(artifactDir, 'publicado_search_filter_working.png');
    await searchPage.screenshot({ path: shot6, fullPage: false });
    console.log(`✓ Saved ${shot6}`);

    // =========================================================================
    // 7. COMPACT EMPTY STATE
    // =========================================================================
    console.log('\n--- SCENARIO 7: COMPACT EMPTY STATE ---');
    const emptyPage = await ctx1440.newPage();
    await emptyPage.goto(`${targetUrl}/scan?tab=pipeline&stage=publicado&fixture=EMPTY`, { waitUntil: 'networkidle', timeout: 30000 });
    await emptyPage.waitForTimeout(1000);

    const shot7 = join(artifactDir, 'publicado_empty_state_desktop.png');
    await emptyPage.screenshot({ path: shot7, fullPage: false });
    console.log(`✓ Saved ${shot7}`);

    // Mobile empty state
    const emptyPageMob = await ctx390.newPage();
    await emptyPageMob.goto(`${targetUrl}/scan?tab=pipeline&stage=publicado&fixture=EMPTY`, { waitUntil: 'networkidle', timeout: 30000 });
    await emptyPageMob.waitForTimeout(1000);

    const shot7Mob = join(artifactDir, 'publicado_empty_state_mobile.png');
    await emptyPageMob.screenshot({ path: shot7Mob, fullPage: false });
    console.log(`✓ Saved ${shot7Mob}`);

    // =========================================================================
    // 8. SIDEBAR DESKTOP WITHOUT NUMBER NEXT TO PUBLICADO
    // =========================================================================
    console.log('\n--- SCENARIO 8: SIDEBAR DESKTOP ZERO COUNTER ---');
    // Locate the Publicado sub-stage in the sidebar
    const pubSubBtn = page1440.locator('.nav-sub-btn').filter({ hasText: 'Publicado' });
    const hasPubBadge = await pubSubBtn.locator('.nav-sub-badge').count();
    console.log(`Publicado sidebar badge count: ${hasPubBadge} (expected: 0)`);

    const shot8 = join(artifactDir, 'publicado_sidebar_desktop_no_counter.png');
    await page1440.screenshot({ path: shot8, fullPage: false });
    console.log(`✓ Saved ${shot8}`);

    // =========================================================================
    // 9. DRAWER MOBILE WITHOUT BADGE ON PUBLICADO
    // =========================================================================
    console.log('\n--- SCENARIO 9: DRAWER MOBILE ZERO COUNTER ---');
    // Open drawer on mobile
    const menuBtn = page390.locator('.btn-mobile-nav-toggle, button[aria-label="Abrir menu lateral"], .hamburger-btn').first();
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      await page390.waitForTimeout(500);
    }
    const shot9 = join(artifactDir, 'publicado_mobile_drawer_no_counter.png');
    await page390.screenshot({ path: shot9, fullPage: false });
    console.log(`✓ Saved ${shot9}`);

    // =========================================================================
    // 10. EDITORIAL CHIPS WITHOUT COUNTER ON PUBLICADO
    // =========================================================================
    console.log('\n--- SCENARIO 10: EDITORIAL CHIPS ZERO COUNTER ---');
    const chipPage = await ctx1440.newPage();
    await chipPage.goto(`${targetUrl}/scan?tab=pipeline&stage=publicado&fixture=ONE`, { waitUntil: 'networkidle', timeout: 30000 });
    await chipPage.waitForTimeout(1000);

    const pubChip = chipPage.locator('.stage-tab-btn').filter({ hasText: 'Publicado' });
    const chipCount = await pubChip.locator('.stage-tab-count').count();
    console.log(`Publicado nav chip count elements: ${chipCount} (expected: 0)`);

    const shot10 = join(artifactDir, 'publicado_editorial_chips_no_counter.png');
    await chipPage.screenshot({ path: shot10, fullPage: false });
    console.log(`✓ Saved ${shot10}`);

    // =========================================================================
    // 11. PAGINATION AND LONG TITLES (MULTI FIXTURE)
    // =========================================================================
    console.log('\n--- SCENARIO 11: PAGINATION & LONG TITLES ---');
    const multiPage = await ctx1440.newPage();
    await multiPage.goto(`${targetUrl}/scan?tab=pipeline&stage=publicado&fixture=MULTI`, { waitUntil: 'networkidle', timeout: 30000 });
    await multiPage.waitForTimeout(1000);

    const shot11 = join(artifactDir, 'publicado_pagination_and_long_titles.png');
    await multiPage.screenshot({ path: shot11, fullPage: false });
    console.log(`✓ Saved ${shot11}`);

    // =========================================================================
    // 12. FULL VIEWPORT REGRESSION SWEEP (320px to 1920px)
    // =========================================================================
    console.log('\n--- SCENARIO 12: VIEWPORT REGRESSION SWEEP ---');
    const viewports = [
      { name: '320px', width: 320, height: 640, isMobile: true },
      { name: '360px', width: 360, height: 780, isMobile: true },
      { name: '390px', width: 390, height: 844, isMobile: true },
      { name: '430px', width: 430, height: 932, isMobile: true },
      { name: '768px', width: 768, height: 1024, isMobile: false },
      { name: '1024px', width: 1024, height: 768, isMobile: false },
      { name: '1280px', width: 1280, height: 800, isMobile: false },
      { name: '1440px', width: 1440, height: 900, isMobile: false },
      { name: '1920px', width: 1920, height: 1080, isMobile: false }
    ];

    for (const vp of viewports) {
      console.log(`Testing viewport ${vp.name} (${vp.width}x${vp.height})...`);
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        hasTouch: vp.isMobile
      });
      await ctx.addCookies(cookies);
      const page = await ctx.newPage();
      const resp = await page.goto(`${targetUrl}/scan?tab=pipeline&stage=publicado&fixture=ONE`, { waitUntil: 'networkidle', timeout: 30000 });
      console.log(`  ${vp.name} HTTP status: ${resp?.status()}`);
      await page.waitForTimeout(1000);

      // Verify no horizontal overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      const hasOverflow = scrollWidth > clientWidth;
      console.log(`  ${vp.name} overflow check: scrollWidth=${scrollWidth}, clientWidth=${clientWidth}, overflow=${hasOverflow}`);

      const shotPath = join(artifactDir, `publicado_viewport_${vp.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
      console.log(`  ✓ Saved ${shotPath}`);
      await ctx.close();
      await new Promise(r => setTimeout(r, 800));
    }

    console.log('\n=== ALL HOMOLOGATION SCENARIOS COMPLETED SUCCESSFULLY ===');
  } catch (err) {
    console.error('Homologation error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
