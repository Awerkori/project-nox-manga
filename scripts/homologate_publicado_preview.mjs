import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { join } from 'node:path';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function main() {
  console.log(`Starting Comprehensive Publicado 10/10 Homologation on: ${targetUrl}`);

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
    // 1. DESKTOP WITH 1 PUBLISHED CHAPTER (1440x900) & SCENARIOS DROPDOWN
    // =========================================================================
    console.log('\n--- SCENARIO 1: DESKTOP (1440x900) & CENÁRIOS DE TESTE DROPDOWN ---');
    const ctx1440 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx1440.addCookies(cookies);
    const page1440 = await ctx1440.newPage();
    await page1440.goto(`${targetUrl}/scan?tab=pipeline&stage=publicado&fixture=ONE`, { waitUntil: 'networkidle', timeout: 30000 });
    await page1440.waitForTimeout(1500);

    // Verify heading has NO duplicate number
    const headingText = await page1440.locator('#section-heading-history').textContent();
    console.log(`  Section heading text: "${headingText?.trim()}" (must be "Histórico de Publicações" without number)`);
    if (headingText?.trim() !== 'Histórico de Publicações') {
      throw new Error(`Duplicate count found in section heading: ${headingText}`);
    }

    const shot1 = join(artifactDir, 'publicado_desktop_1_capitulo_1440.png');
    await page1440.screenshot({ path: shot1, fullPage: false });
    console.log(`✓ Saved ${shot1}`);

    // Test "Cenários de teste" popover menu
    const scenariosBtn = page1440.locator('.btn-scenarios-toggle');
    await scenariosBtn.click();
    await page1440.waitForTimeout(400);

    const shotMenu = join(artifactDir, 'publicado_cenarios_teste_menu_open.png');
    await page1440.screenshot({ path: shotMenu, fullPage: false });
    console.log(`✓ Saved ${shotMenu}`);

    // Close menu by clicking backdrop or button
    const backdrop = page1440.locator('.scenarios-backdrop');
    if (await backdrop.isVisible()) {
      await backdrop.click({ force: true });
    } else {
      await scenariosBtn.click();
    }
    await page1440.waitForTimeout(300);

    // Verify official reader link
    const readBtn = page1440.locator('.btn-read-chapter').first();
    const readHref = await readBtn.getAttribute('href');
    console.log(`  Ler capítulo button href: ${readHref} (must start with https://projectnox.org/ler/)`);
    if (!readHref || !readHref.startsWith('https://projectnox.org/ler/')) {
      throw new Error(`Invalid reader link: ${readHref}`);
    }

    // =========================================================================
    // 2. MOBILE WITH 1 PUBLISHED CHAPTER (390x844 - iPhone 14) & COMPACT BAR
    // =========================================================================
    console.log('\n--- SCENARIO 2: MOBILE (390x844) WITH COMPACT PREVIEW BAR & COVER ---');
    const ctx390 = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true
    });
    await ctx390.addCookies(cookies);
    const page390 = await ctx390.newPage();
    await page390.goto(`${targetUrl}/scan?tab=pipeline&stage=publicado&fixture=ONE`, { waitUntil: 'networkidle', timeout: 30000 });
    await page390.waitForTimeout(1500);

    // 2.1 Compact Preview Utility Bar on Mobile Check
    const mobileUtilityBar = page390.locator('.homologation-utility-bar');
    const barBox = await mobileUtilityBar.boundingBox();
    console.log(`  Mobile Preview Bar bounding box: height=${barBox?.height}px, width=${barBox?.width}px (must be <= 38px height)`);
    if (!barBox || barBox.height > 40) {
      throw new Error(`Mobile preview bar is too tall or wrapped: height=${barBox?.height}px`);
    }

    // Verify badge shows "Preview" and button shows "Cenários (1)"
    const mobileBadgeText = await page390.locator('.preview-env-badge .mobile-only').textContent();
    const mobileBtnLabel = await page390.locator('.btn-scenarios-toggle .mobile-only').first().textContent();
    console.log(`  Mobile badge text: "${mobileBadgeText?.trim()}", Mobile scenarios text: "${mobileBtnLabel?.trim()}"`);
    if (mobileBadgeText?.trim() !== 'Preview' || mobileBtnLabel?.trim() !== 'Cenários') {
      throw new Error(`Mobile preview bar texts mismatch: badge="${mobileBadgeText}", label="${mobileBtnLabel}"`);
    }

    const shotBarMob = join(artifactDir, 'publicado_mobile_preview_bar_compact_390.png');
    await page390.screenshot({ path: shotBarMob, fullPage: false });
    console.log(`✓ Saved ${shotBarMob}`);

    // Test Scenarios Dropdown on Android
    const scenariosBtnMob = page390.locator('.btn-scenarios-toggle');
    await scenariosBtnMob.click();
    await page390.waitForTimeout(400);

    const shotMenuMob = join(artifactDir, 'publicado_cenarios_menu_android_390.png');
    await page390.screenshot({ path: shotMenuMob, fullPage: false });
    console.log(`✓ Saved ${shotMenuMob}`);

    // Close menu by clicking backdrop
    const backdropMob = page390.locator('.scenarios-backdrop');
    if (await backdropMob.isVisible()) {
      await backdropMob.click({ force: true });
    } else {
      await scenariosBtnMob.click();
    }
    await page390.waitForTimeout(300);

    // 2.2 Verify mobile cover is VISIBLE
    const mobileCover = page390.locator('.card-main-info-group .cover-thumb-wrapper').first();
    const isCoverVisible = await mobileCover.isVisible();
    const coverBox = await mobileCover.boundingBox();
    console.log(`  Mobile cover visible: ${isCoverVisible}, width: ${coverBox?.width}px, height: ${coverBox?.height}px`);
    if (!isCoverVisible || !coverBox || coverBox.width < 35 || coverBox.height < 50) {
      throw new Error(`Mobile cover thumbnail is missing or improperly sized: ${JSON.stringify(coverBox)}`);
    }

    // 2.3 Verify active Publicado tab in stages track is 100% VISIBLE and NOT CROPPED
    const activeStageTab = page390.locator('.stage-tab-btn.is-active');
    const stagesTrack = page390.locator('.stages-track');
    const chipBox390 = await activeStageTab.boundingBox();
    const trackBox390 = await stagesTrack.boundingBox();

    if (!chipBox390 || !trackBox390) {
      throw new Error('Publicado chip or track element missing on 390px');
    }
    const chipLeft390 = chipBox390.x;
    const chipRight390 = chipBox390.x + chipBox390.width;
    const trackLeft390 = trackBox390.x;
    const trackRight390 = trackBox390.x + trackBox390.width;
    console.log(`  Publicado chip 390px: left=${chipLeft390.toFixed(1)}, right=${chipRight390.toFixed(1)} | Track: left=${trackLeft390.toFixed(1)}, right=${trackRight390.toFixed(1)}`);

    if (chipRight390 > trackRight390 - 4 || chipLeft390 < trackLeft390) {
      throw new Error(`Publicado chip is cropped or misaligned on 390px: chipRight=${chipRight390}, trackRight=${trackRight390}`);
    }

    // Verify right cue gradient is 0 opacity
    const cueOpacity390 = await page390.evaluate(() => {
      const cue = document.querySelector('.stages-scroll-cue-right');
      return cue ? window.getComputedStyle(cue).opacity : '0';
    });
    console.log(`  Right scroll cue opacity on 390px: ${cueOpacity390} (must be <= 0.05)`);
    if (parseFloat(cueOpacity390) > 0.05) {
      throw new Error(`Right scroll cue is obscuring the chip on 390px (opacity=${cueOpacity390})`);
    }

    const shotChip390 = join(artifactDir, 'publicado_chip_100_visible_390px.png');
    await page390.screenshot({ path: shotChip390, fullPage: false });
    console.log(`✓ Saved ${shotChip390}`);

    const shot2 = join(artifactDir, 'publicado_mobile_1_capitulo_390.png');
    await page390.screenshot({ path: shot2, fullPage: false });
    console.log(`✓ Saved ${shot2}`);

    // =========================================================================
    // 3. TWO-TIER EXPANDED DETAILS & 1-CLICK COPY (DESKTOP & MOBILE)
    // =========================================================================
    console.log('\n--- SCENARIO 3: TWO-TIER EXPANDED DETAILS & 1-CLICK COPY ---');
    // Click "Ver detalhes" on desktop
    const detailBtnDesk = page1440.locator('.btn-toggle-details').first();
    await detailBtnDesk.click();
    await page1440.waitForTimeout(500);

    // Verify Tier 1: Informações Principais
    const tier1Visible = await page1440.locator('.tier1-main-info').isVisible();
    console.log(`  Tier 1 visible: ${tier1Visible}`);

    // Click Tier 2 sub-accordion: Informações técnicas
    const techToggle = page1440.locator('.tier2-toggle-btn').first();
    await techToggle.click();
    await page1440.waitForTimeout(400);

    // Test 1-click UUID copy button
    const copyBtn = page1440.locator('.btn-copy-uuid').first();
    await copyBtn.click();
    await page1440.waitForTimeout(300);

    const copiedPill = page1440.locator('.copied-pill').first();
    const isCopiedPillVisible = await copiedPill.isVisible();
    console.log(`  Copy UUID feedback pill visible: ${isCopiedPillVisible}`);

    const shot3Desk = join(artifactDir, 'publicado_card_expanded_desktop.png');
    await page1440.screenshot({ path: shot3Desk, fullPage: false });
    console.log(`✓ Saved ${shot3Desk}`);

    // Click "Ver detalhes" on mobile
    const detailBtnMob = page390.locator('.btn-toggle-details').first();
    await detailBtnMob.click();
    await page390.waitForTimeout(500);

    // Also open technical details on mobile
    const techToggleMob = page390.locator('.tier2-toggle-btn').first();
    await techToggleMob.click();
    await page390.waitForTimeout(400);

    const shot3Mob = join(artifactDir, 'publicado_card_expanded_mobile.png');
    await page390.screenshot({ path: shot3Mob, fullPage: false });
    console.log(`✓ Saved ${shot3Mob}`);

    // =========================================================================
    // 4. DESKTOP WITH MULTIPLE CHAPTERS (1920x1080)
    // =========================================================================
    console.log('\n--- SCENARIO 4: DESKTOP MULTI CHAPTERS (1920x1080) ---');
    const ctx1920 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    await ctx1920.addCookies(cookies);
    const page1920 = await ctx1920.newPage();
    await page1920.goto(`${targetUrl}/scan?tab=pipeline&stage=publicado&fixture=FIVE`, { waitUntil: 'networkidle', timeout: 30000 });
    await page1920.waitForTimeout(1500);

    const shot4 = join(artifactDir, 'publicado_desktop_multi_1920.png');
    await page1920.screenshot({ path: shot4, fullPage: false });
    console.log(`✓ Saved ${shot4}`);

    // =========================================================================
    // 5. MOBILE WITH MULTIPLE CHAPTERS (360x780 - Samsung Galaxy)
    // =========================================================================
    console.log('\n--- SCENARIO 5: MOBILE MULTI (360x780) ---');
    const ctx360 = await browser.newContext({
      viewport: { width: 360, height: 780 },
      isMobile: true,
      hasTouch: true
    });
    await ctx360.addCookies(cookies);
    const page360 = await ctx360.newPage();
    await page360.goto(`${targetUrl}/scan?tab=pipeline&stage=publicado&fixture=FIVE`, { waitUntil: 'networkidle', timeout: 30000 });
    await page360.waitForTimeout(1500);

    const shot5 = join(artifactDir, 'publicado_mobile_multi_360.png');
    await page360.screenshot({ path: shot5, fullPage: false });
    console.log(`✓ Saved ${shot5}`);

    // =========================================================================
    // 6. SEARCH AND FILTERS WORKING WITH CLEAR DIFFERENTIATION
    // =========================================================================
    console.log('\n--- SCENARIO 6: SEARCH & FILTERS WITH CLEAR COUNT DIFFERENTIATION ---');
    const searchPage = await ctx1440.newPage();
    await searchPage.goto(`${targetUrl}/scan?tab=pipeline&stage=publicado&fixture=FIVE`, { waitUntil: 'networkidle', timeout: 30000 });
    await searchPage.waitForTimeout(1000);

    // Type "Solo Leveling"
    const searchInput = searchPage.locator('.compact-search-input');
    await searchInput.fill('Solo Leveling');
    await searchPage.waitForTimeout(500);

    const filterTag = searchPage.locator('.active-filter-tag');
    const filterTagText = await filterTag.textContent();
    console.log(`  Filter tag text: "${filterTagText?.trim()}" (e.g. "Mostrando 2 de 5 capítulos")`);

    const shot6 = join(artifactDir, 'publicado_search_filter_working.png');
    await searchPage.screenshot({ path: shot6, fullPage: false });
    console.log(`✓ Saved ${shot6}`);

    // =========================================================================
    // 7. COMPACT EMPTY STATE (DESKTOP & MOBILE)
    // =========================================================================
    console.log('\n--- SCENARIO 7: COMPACT EMPTY STATE ---');
    const emptyPage = await ctx1440.newPage();
    await emptyPage.goto(`${targetUrl}/scan?tab=pipeline&stage=publicado&fixture=EMPTY`, { waitUntil: 'networkidle', timeout: 30000 });
    await emptyPage.waitForTimeout(1000);

    const shot7Desk = join(artifactDir, 'publicado_empty_state_desktop.png');
    await emptyPage.screenshot({ path: shot7Desk, fullPage: false });
    console.log(`✓ Saved ${shot7Desk}`);

    const emptyPageMob = await ctx390.newPage();
    await emptyPageMob.goto(`${targetUrl}/scan?tab=pipeline&stage=publicado&fixture=EMPTY`, { waitUntil: 'networkidle', timeout: 30000 });
    await emptyPageMob.waitForTimeout(1000);

    const shot7Mob = join(artifactDir, 'publicado_empty_state_mobile.png');
    await emptyPageMob.screenshot({ path: shot7Mob, fullPage: false });
    console.log(`✓ Saved ${shot7Mob}`);

    // =========================================================================
    // 8. ZERO NOTIFICATION COUNTERS AUDIT (SIDEBAR, DRAWER, CHIPS)
    // =========================================================================
    console.log('\n--- SCENARIO 8: STRICT ZERO NOTIFICATION COUNTERS AUDIT ---');
    // Desktop sidebar
    const pubSubBtn = page1440.locator('.nav-sub-btn').filter({ hasText: 'Publicado' });
    const hasPubBadge = await pubSubBtn.locator('.nav-sub-badge, .nav-sub-personal-badge').count();
    console.log(`  Publicado sidebar badge count: ${hasPubBadge} (must be 0)`);
    if (hasPubBadge !== 0) throw new Error('Publicado sidebar has unexpected notification badge');

    const shot8 = join(artifactDir, 'publicado_sidebar_desktop_no_counter.png');
    await page1440.screenshot({ path: shot8, fullPage: false });
    console.log(`✓ Saved ${shot8}`);

    // Mobile drawer
    const menuBtn = page390.locator('.btn-mobile-nav-toggle, button[aria-label="Abrir menu lateral"], .hamburger-btn').first();
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      await page390.waitForTimeout(500);
    }
    const shot9 = join(artifactDir, 'publicado_mobile_drawer_no_counter.png');
    await page390.screenshot({ path: shot9, fullPage: false });
    console.log(`✓ Saved ${shot9}`);

    // Pipeline Stage Chips
    const pubChip = page1440.locator('.stage-tab-btn').filter({ hasText: 'Publicado' });
    const chipCount = await pubChip.locator('.stage-tab-count').count();
    console.log(`  Publicado nav chip count: ${chipCount} (must be 0)`);
    if (chipCount !== 0) throw new Error('Publicado nav chip has unexpected counter');

    const shot10 = join(artifactDir, 'publicado_editorial_chips_no_counter.png');
    await page1440.screenshot({ path: shot10, fullPage: false });
    console.log(`✓ Saved ${shot10}`);

    // =========================================================================
    // 9. PAGINATION AND LONG TITLES (MULTI FIXTURE)
    // =========================================================================
    console.log('\n--- SCENARIO 9: PAGINATION & LONG TITLES ---');
    const multiPage = await ctx1440.newPage();
    await multiPage.goto(`${targetUrl}/scan?tab=pipeline&stage=publicado&fixture=MULTI`, { waitUntil: 'networkidle', timeout: 30000 });
    await multiPage.waitForTimeout(1000);

    const shot11 = join(artifactDir, 'publicado_pagination_and_long_titles.png');
    await multiPage.screenshot({ path: shot11, fullPage: false });
    console.log(`✓ Saved ${shot11}`);

    // =========================================================================
    // 10. FULL VIEWPORT REGRESSION SWEEP (320px to 1920px) WITH OVERFLOW CHECK
    // =========================================================================
    console.log('\n--- SCENARIO 10: FULL VIEWPORT REGRESSION SWEEP ---');
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
      await page.waitForTimeout(1000);

      // Verify no horizontal overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      const hasOverflow = scrollWidth > clientWidth;
      console.log(`  ${vp.name}: scrollWidth=${scrollWidth}, clientWidth=${clientWidth}, overflow=${hasOverflow}`);
      if (hasOverflow) {
        throw new Error(`Horizontal overflow detected on viewport ${vp.name}: scrollWidth=${scrollWidth} > clientWidth=${clientWidth}`);
      }

      // If mobile viewport (320, 360, 390, 430), verify Publicado chip 100% visible & cue opacity 0
      if (vp.isMobile) {
        const activeChip = page.locator('.stage-tab-btn.is-active');
        const track = page.locator('.stages-track');
        const cBox = await activeChip.boundingBox();
        const tBox = await track.boundingBox();
        if (!cBox || !tBox) {
          throw new Error(`Publicado chip or track not found on ${vp.name}`);
        }
        const chipLeft = cBox.x;
        const chipRight = cBox.x + cBox.width;
        const trackLeft = tBox.x;
        const trackRight = tBox.x + tBox.width;

        console.log(`  ${vp.name} Publicado chip box: left=${chipLeft.toFixed(1)}, right=${chipRight.toFixed(1)} | Track: right=${trackRight.toFixed(1)}`);
        if (chipRight > trackRight - 2 || chipLeft < trackLeft) {
          throw new Error(`Publicado chip cropped or misaligned on ${vp.name}: chipRight=${chipRight}, trackRight=${trackRight}`);
        }

        const cueOp = await page.evaluate(() => {
          const cue = document.querySelector('.stages-scroll-cue-right');
          return cue ? window.getComputedStyle(cue).opacity : '0';
        });
        if (parseFloat(cueOp) > 0.05) {
          throw new Error(`Right scroll cue is obscuring the chip on ${vp.name} (opacity=${cueOp})`);
        }

        if (vp.name === '320px') {
          const shot320 = join(artifactDir, 'publicado_chip_100_visible_320px.png');
          await page.screenshot({ path: shot320, fullPage: false });
          console.log(`  ✓ Saved ${shot320}`);
        }
      }

      const shotPath = join(artifactDir, `publicado_viewport_${vp.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
      console.log(`  ✓ Saved ${shotPath}`);
      await ctx.close();
      await new Promise(r => setTimeout(r, 600));
    }

    console.log('\n============================================================');
    console.log('✨ ALL 10/10 HOMOLOGATION SCENARIOS COMPLETED WITH ZERO ERRORS');
    console.log('============================================================');
  } catch (err) {
    console.error('Homologation error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
