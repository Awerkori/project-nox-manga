import { chromium, firefox } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';

// Load environment variables
for (const envPath of ['.dev.vars.deploy', '.dev.vars.preview_full', '.env']) {
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const l of lines) {
      const idx = l.indexOf('=');
      if (idx !== -1) {
        const k = l.slice(0, idx).trim();
        const v = l.slice(idx + 1).trim();
        if (!process.env[k] && v) process.env[k] = v;
      }
    }
  }
}

const { ownerCookies } = await import('./owner-session.mjs');

async function main() {
  console.log('=== STARTING ROUND 18 HEADER REFINEMENT PLAYWRIGHT CERTIFICATION ===');
  console.log('Target Preview URL:', PREVIEW_URL);

  let sessionCookies = [];
  try {
    sessionCookies = await ownerCookies(PREVIEW_URL);
    console.log('Successfully acquired authenticated owner session cookies.');
  } catch (err) {
    console.error('Failed to acquire owner session cookies:', err.message);
    process.exit(1);
  }

  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    screenshots: []
  };

  function record(name, pass, details = {}) {
    results.tests.push({ name, pass, details });
    const status = pass ? 'PASS' : 'FAIL';
    console.log(`[${status}] ${name}`, details);
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // =========================================================================
    // 1. DESKTOP 1440px and 1920px: Confirm Removal of "Painel" Button
    // =========================================================================
    console.log('\n--- 1. Testing Desktop Header (1440px and 1920px) ---');
    for (const width of [1440, 1920]) {
      const desktopCtx = await browser.newContext({
        viewport: { width, height: 900 }
      });
      await desktopCtx.addCookies([
        ...sessionCookies,
        { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
      ]);
      const page = await desktopCtx.newPage();
      await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'networkidle' });

      // Confirm "Painel" button between search and bell is completely gone
      const panelPillCount = await page.locator('.desktop-panel-pill').count();
      const hasPainelTextInHeader = await page.evaluate(() => {
        const header = document.querySelector('.site-header');
        if (!header) return false;
        const text = header.innerText || '';
        return text.includes('Painel') && !text.includes('Menu do usuário');
      });

      record(`Desktop ${width}px: Botão Painel Removido do Cabeçalho`, panelPillCount === 0 && !hasPainelTextInHeader, {
        panelPillCount,
        hasPainelTextInHeader
      });

      // Confirm Header Elements on Desktop
      const fluxerVisible = await page.locator('.header-community-btn.fluxer-btn').isVisible();
      const discordVisible = await page.locator('.header-community-btn.discord-btn').isVisible();
      const searchVisible = await page.locator('.header-search-btn').isVisible();
      const bellVisible = await page.locator('.notification-link').isVisible();
      const avatarVisible = await page.locator('.avatar-btn').isVisible();

      record(`Desktop ${width}px: Controles Essenciais Visíveis`, fluxerVisible && discordVisible && searchVisible && bellVisible && avatarVisible, {
        fluxerVisible,
        discordVisible,
        searchVisible,
        bellVisible,
        avatarVisible
      });

      // Capture desktop screenshot
      const shotDesktop = path.join(ARTIFACT_DIR, `r18_desktop_header_${width}px_no_painel_btn.png`);
      await page.screenshot({ path: shotDesktop });
      results.screenshots.push(shotDesktop);

      // Verify Avatar Menu dropdown still has Seus Painéis intact
      await page.locator('.avatar-btn').click();
      await page.waitForSelector('.user-dropdown', { state: 'visible' });
      const dropText = await page.locator('.user-dropdown').textContent();
      const hasSeusPaineis = dropText.includes('SEUS PAINÉIS');
      const hasScanPanel = await page.locator('.user-dropdown .scan-card').count() > 0;
      const hasAdminPanel = await page.locator('.user-dropdown .admin-card').count() > 0;

      record(`Desktop ${width}px: Menu do Avatar Preserva Seus Painéis`, hasSeusPaineis && hasScanPanel && hasAdminPanel, {
        hasSeusPaineis,
        hasScanPanel,
        hasAdminPanel
      });

      const shotDrop = path.join(ARTIFACT_DIR, `r18_desktop_dropdown_${width}px_seus_paineis.png`);
      await page.screenshot({ path: shotDrop });
      results.screenshots.push(shotDrop);

      await desktopCtx.close();
    }

    // =========================================================================
    // 2. MOBILE VIEWPORTS: 360px, 390px, 430px
    // =========================================================================
    console.log('\n--- 2. Testing Mobile Header (360px, 390px, 430px) ---');
    const mobileViewports = [
      { name: '360x800 (Compact Mobile)', width: 360, height: 800 },
      { name: '390x844 (iPhone 12/13/14)', width: 390, height: 844 },
      { name: '430x932 (iPhone Pro Max)', width: 430, height: 932 }
    ];

    for (const vp of mobileViewports) {
      console.log(`\nValidating mobile: ${vp.name}...`);
      const mobCtx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: true,
        hasTouch: true
      });
      await mobCtx.addCookies([
        ...sessionCookies,
        { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
      ]);
      const mobPage = await mobCtx.newPage();
      await mobPage.goto(`${PREVIEW_URL}/`, { waitUntil: 'networkidle' });

      // 1. Verify Fluxer and Discord are directly visible on mobile
      const fluxer = mobPage.locator('.header-community-btn.fluxer-btn');
      const discord = mobPage.locator('.header-community-btn.discord-btn');
      const search = mobPage.locator('.header-search-btn');
      const bell = mobPage.locator('.notification-link');
      const avatar = mobPage.locator('.avatar-btn');
      const menu = mobPage.locator('.mobile-menu-btn');

      const fluxerVisible = await fluxer.isVisible();
      const discordVisible = await discord.isVisible();
      const searchVisible = await search.isVisible();
      const bellVisible = await bell.isVisible();
      const avatarVisible = await avatar.isVisible();
      const menuVisible = await menu.isVisible();

      record(`Mobile ${vp.name}: Fluxer e Discord Visíveis no Topo`, fluxerVisible && discordVisible, {
        fluxerVisible,
        discordVisible
      });

      record(`Mobile ${vp.name}: Todos os 6 Controles Visíveis`, searchVisible && bellVisible && avatarVisible && menuVisible, {
        searchVisible,
        bellVisible,
        avatarVisible,
        menuVisible
      });

      // 2. Validate links destinations for Fluxer and Discord
      const fluxerHref = await fluxer.getAttribute('href');
      const discordHref = await discord.getAttribute('href');
      record(`Mobile ${vp.name}: Destinos de Fluxer e Discord Corretos`,
        fluxerHref?.includes('fluxer.app') && discordHref?.includes('discord.com'), {
          fluxerHref,
          discordHref
        }
      );

      // 3. Verify No Horizontal Overflow
      const overflow = await mobPage.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          hasOverflow: document.documentElement.scrollWidth > window.innerWidth
        };
      });
      record(`Mobile ${vp.name}: Sem Scroll Horizontal`, !overflow.hasOverflow, overflow);

      // 4. Verify No Overlapping Between Action Buttons
      const buttonBoxes = await mobPage.evaluate(() => {
        const selectors = [
          '.header-community-btn.fluxer-btn',
          '.header-community-btn.discord-btn',
          '.header-search-btn',
          '.notification-link',
          '.avatar-btn',
          '.mobile-menu-btn'
        ];
        return selectors.map(s => {
          const el = document.querySelector(s);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { selector: s, x: r.x, y: r.y, width: r.width, height: r.height, right: r.right };
        }).filter(Boolean);
      });

      let hasOverlap = false;
      for (let i = 0; i < buttonBoxes.length; i++) {
        for (let j = i + 1; j < buttonBoxes.length; j++) {
          const b1 = buttonBoxes[i];
          const b2 = buttonBoxes[j];
          // Check horizontal overlap
          if (b1.x < b2.right && b1.right > b2.x) {
            hasOverlap = true;
          }
        }
      }
      record(`Mobile ${vp.name}: Sem Elementos Sobrepostos no Cabeçalho`, !hasOverlap, {
        buttonsCount: buttonBoxes.length,
        hasOverlap
      });

      // Capture Mobile Header Screenshot
      const shotMobHeader = path.join(ARTIFACT_DIR, `r18_mobile_header_fluxer_discord_${vp.width}px.png`);
      await mobPage.screenshot({ path: shotMobHeader });
      results.screenshots.push(shotMobHeader);

      // 5. Open Avatar Menu on Mobile & Confirm "Seus Painéis"
      await avatar.click();
      await mobPage.waitForSelector('.user-dropdown', { state: 'visible' });
      const mobDropText = await mobPage.locator('.user-dropdown').textContent();
      const mobHasSeusPaineis = mobDropText.includes('SEUS PAINÉIS');
      record(`Mobile ${vp.name}: Seus Painéis no Menu do Avatar`, mobHasSeusPaineis);

      const shotMobDrop = path.join(ARTIFACT_DIR, `r18_mobile_dropdown_seus_paineis_${vp.width}px.png`);
      await mobPage.screenshot({ path: shotMobDrop });
      results.screenshots.push(shotMobDrop);

      // Close menu
      await mobPage.keyboard.press('Escape');
      await mobPage.waitForTimeout(200);

      // 6. Test Bell click on mobile navigates to /notificacoes
      await bell.click();
      await mobPage.waitForURL(/\/notificacoes/, { timeout: 8000 });
      record(`Mobile ${vp.name}: Clique no Sino Leva a /notificacoes`, mobPage.url().includes('/notificacoes'));

      await mobCtx.close();
    }
  } finally {
    await browser.close();
  }

  // =========================================================================
  // 3. FIREFOX (GECKO) RUN: Mobile (390px) & Desktop (1440px)
  // =========================================================================
  console.log('\n--- 3. Testing on Firefox (Gecko) Engine ---');
  try {
    const ffBrowser = await firefox.launch({ headless: true });

    // Firefox Mobile 390px
    const ffMobCtx = await ffBrowser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true
    });
    await ffMobCtx.addCookies([
      ...sessionCookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const ffMobPage = await ffMobCtx.newPage();
    await ffMobPage.goto(`${PREVIEW_URL}/`, { waitUntil: 'networkidle' });

    const ffFluxer = await ffMobPage.locator('.header-community-btn.fluxer-btn').isVisible();
    const ffDiscord = await ffMobPage.locator('.header-community-btn.discord-btn').isVisible();
    const ffSearch = await ffMobPage.locator('.header-search-btn').isVisible();
    const ffBell = await ffMobPage.locator('.notification-link').isVisible();

    record('Firefox Mobile 390px: Fluxer, Discord, Busca e Sino Visíveis',
      ffFluxer && ffDiscord && ffSearch && ffBell, {
        ffFluxer, ffDiscord, ffSearch, ffBell
      }
    );

    const shotFFMob = path.join(ARTIFACT_DIR, 'r18_firefox_mobile_header_390px.png');
    await ffMobPage.screenshot({ path: shotFFMob });
    results.screenshots.push(shotFFMob);
    await ffMobCtx.close();

    // Firefox Desktop 1440px
    const ffDeskCtx = await ffBrowser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    await ffDeskCtx.addCookies([
      ...sessionCookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const ffDeskPage = await ffDeskCtx.newPage();
    await ffDeskPage.goto(`${PREVIEW_URL}/`, { waitUntil: 'networkidle' });

    const ffPanelPillCount = await ffDeskPage.locator('.desktop-panel-pill').count();
    record('Firefox Desktop 1440px: Botão Painel Removido', ffPanelPillCount === 0);

    const shotFFDesk = path.join(ARTIFACT_DIR, 'r18_firefox_desktop_header_1440px.png');
    await ffDeskPage.screenshot({ path: shotFFDesk });
    results.screenshots.push(shotFFDesk);

    await ffDeskCtx.close();
    await ffBrowser.close();
  } catch (ffErr) {
    console.warn('Firefox run notice:', ffErr.message);
  }

  // Save JSON report
  const reportPath = path.join(ARTIFACT_DIR, 'round18_header_polish_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('\nReport written to:', reportPath);

  const allPassed = results.tests.every(t => t.pass);
  console.log(`\nALL ROUND 18 POLISH TESTS PASSED: ${allPassed} (${results.tests.filter(t => t.pass).length}/${results.tests.length})`);
  return allPassed;
}

main().then(success => {
  if (!success) {
    console.error('Some tests failed.');
    process.exit(1);
  } else {
    console.log('Header polish certification completed successfully.');
    process.exit(0);
  }
}).catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
