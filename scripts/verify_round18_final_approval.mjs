import { chromium, firefox } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const PREVIEW_URL = process.env.TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';

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
  console.log('=== STARTING ROUND 18 FINAL APPROVAL PLAYWRIGHT CERTIFICATION ===');
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
    // 1. DESKTOP 1440px and 1920px
    // Top search retained, painel button absent, avatar dropdown has Seus Painéis
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

      // Confirm Painel Pill is Absent
      const panelPillCount = await page.locator('.header-actions a[href="/admin"], .header-actions a[href^="/scan"]').count();
      const headerText = await page.locator('.site-header').innerText();
      const hasPainelTextInHeader = headerText.includes('Painel');
      record(`Desktop ${width}px: Botão Painel Ausente do Cabeçalho`, panelPillCount === 0 && !hasPainelTextInHeader, {
        panelPillCount,
        hasPainelTextInHeader
      });

      // Confirm Top Search Button IS Visible on Desktop
      const searchVisible = await page.locator('.header-search-btn').isVisible();
      record(`Desktop ${width}px: Lupa de Busca Visível no Cabeçalho Desktop`, searchVisible, { searchVisible });

      // Confirm Other Desktop Controls
      const fluxerVisible = await page.locator('.header-community-btn.fluxer-btn').isVisible();
      const discordVisible = await page.locator('.header-community-btn.discord-btn').isVisible();
      const bellVisible = await page.locator('.notification-link').isVisible();
      const avatarVisible = await page.locator('.avatar-btn').isVisible();
      const navVisible = await page.locator('.desktop-nav').isVisible();

      record(`Desktop ${width}px: Controles Desktop Completos (Fluxer, Discord, Bell, Avatar, Nav)`,
        fluxerVisible && discordVisible && bellVisible && avatarVisible && navVisible, {
          fluxerVisible,
          discordVisible,
          bellVisible,
          avatarVisible,
          navVisible
        }
      );

      // Capture desktop screenshot
      const shotDesktop = path.join(ARTIFACT_DIR, `r18_final_desktop_header_${width}px.png`);
      await page.screenshot({ path: shotDesktop });
      results.screenshots.push(shotDesktop);

      // Verify Avatar Menu Dropdown
      await page.locator('.avatar-btn').click();
      await page.waitForSelector('.user-dropdown', { state: 'visible' });
      const dropText = await page.locator('.user-dropdown').textContent();
      const hasSeusPaineis = dropText.includes('SEUS PAINÉIS');
      const hasScanPanel = (await page.locator('.user-dropdown .scan-card').count()) > 0;
      const hasAdminPanel = (await page.locator('.user-dropdown .admin-card').count()) > 0;

      record(`Desktop ${width}px: Menu do Avatar Preserva Seus Painéis`, hasSeusPaineis && hasScanPanel && hasAdminPanel, {
        hasSeusPaineis,
        hasScanPanel,
        hasAdminPanel
      });

      const shotDrop = path.join(ARTIFACT_DIR, `r18_final_desktop_dropdown_${width}px.png`);
      await page.screenshot({ path: shotDrop });
      results.screenshots.push(shotDrop);

      await desktopCtx.close();
    }

    // =========================================================================
    // 2. MOBILE VIEWPORTS: 360px, 390px, 430px
    // Lupa removida, hambúrguer removido, exatamente 4 controles (Fluxer, Discord, Bell, Avatar)
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

      // 1. Verify Search Button is NOT visible in Mobile Header
      const search = mobPage.locator('.header-search-btn');
      const searchVisible = await search.isVisible();
      record(`Mobile ${vp.name}: Lupa de Busca Excluída do Cabeçalho Mobile`, !searchVisible, {
        searchVisible
      });

      // 2. Verify Hamburger Menu Button is NOT visible in Mobile Header
      const hamburger = mobPage.locator('.mobile-menu-btn');
      const hamburgerVisible = await hamburger.isVisible();
      record(`Mobile ${vp.name}: Menu Hambúrguer Removido do Cabeçalho Mobile`, !hamburgerVisible, {
        hamburgerVisible
      });

      // 3. Verify exactly the 4 required controls are visible: Fluxer, Discord, Bell, Avatar
      const fluxer = mobPage.locator('.header-community-btn.fluxer-btn');
      const discord = mobPage.locator('.header-community-btn.discord-btn');
      const bell = mobPage.locator('.notification-link');
      const avatar = mobPage.locator('.avatar-btn');

      const fluxerVisible = await fluxer.isVisible();
      const discordVisible = await discord.isVisible();
      const bellVisible = await bell.isVisible();
      const avatarVisible = await avatar.isVisible();

      record(`Mobile ${vp.name}: Exatamente 4 Controles Visíveis (Fluxer, Discord, Sino, Avatar)`,
        fluxerVisible && discordVisible && bellVisible && avatarVisible, {
          fluxerVisible,
          discordVisible,
          bellVisible,
          avatarVisible
        }
      );

      // 4. Verify Brand Title "PROJECT NOX" is visible in the header
      const brandProject = mobPage.locator('.site-header .brand-project');
      const brandNox = mobPage.locator('.site-header .brand-nox');
      const projectVisible = await brandProject.isVisible();
      const noxVisible = await brandNox.isVisible();
      record(`Mobile ${vp.name}: Logo Completo PROJECT NOX Visível`, projectVisible && noxVisible, {
        projectVisible,
        noxVisible
      });

      // 5. Verify No Horizontal Overflow
      const overflow = await mobPage.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          hasOverflow: document.documentElement.scrollWidth > window.innerWidth
        };
      });
      record(`Mobile ${vp.name}: Sem Scroll Horizontal (scrollWidth <= innerWidth)`, !overflow.hasOverflow, overflow);

      // 6. Verify No Overlapping Between the 4 Header Buttons
      const buttonBoxes = await mobPage.evaluate(() => {
        const selectors = [
          '.header-community-btn.fluxer-btn',
          '.header-community-btn.discord-btn',
          '.notification-link',
          '.avatar-btn'
        ];
        return selectors.map(s => {
          const el = document.querySelector(s);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            selector: s,
            left: r.left,
            right: r.right,
            width: r.width,
            height: r.height
          };
        });
      });

      let hasCollision = false;
      const collisionDetails = [];
      for (let i = 0; i < buttonBoxes.length - 1; i++) {
        const a = buttonBoxes[i];
        const b = buttonBoxes[i + 1];
        if (!a || !b) continue;
        if (a.right > b.left + 0.5) {
          hasCollision = true;
          collisionDetails.push({ buttonA: a.selector, buttonB: b.selector, diff: a.right - b.left });
        }
      }
      record(`Mobile ${vp.name}: Zero Colisão Entre Botões de Ação`, !hasCollision, {
        buttonBoxes,
        collisionDetails
      });

      // 7. Verify Bottom Navigation Bar is Present and Complete
      const bottomNav = mobPage.locator('.mobile-bottom');
      const bottomNavVisible = await bottomNav.isVisible();
      const bottomLinks = await mobPage.evaluate(() => {
        const links = Array.from(document.querySelectorAll('.mobile-bottom a'));
        return links.map(l => ({
          href: l.getAttribute('href'),
          text: l.innerText.trim()
        }));
      });

      const hasHome = bottomLinks.some(l => l.href === '/' && l.text.includes('Início'));
      const hasCatalogo = bottomLinks.some(l => l.href?.startsWith('/catalogo') && l.text.includes('Catálogo'));
      const hasRanking = bottomLinks.some(l => l.href === '/ranking' && l.text.includes('Ranking'));
      const hasScans = bottomLinks.some(l => l.href?.startsWith('/scans') && l.text.includes('Scans'));
      const hasLoja = bottomLinks.some(l => l.href?.startsWith('/loja') && l.text.includes('Loja'));

      record(`Mobile ${vp.name}: Navegação Inferior Completa (Início, Catálogo, Ranking, Scans, Loja)`,
        bottomNavVisible && hasHome && hasCatalogo && hasRanking && hasScans && hasLoja, {
          bottomNavVisible,
          bottomLinks
        }
      );

      // Capture Mobile Header Screenshot
      const shotMob = path.join(ARTIFACT_DIR, `r18_final_mobile_header_${vp.width}px.png`);
      await mobPage.screenshot({ path: shotMob });
      results.screenshots.push(shotMob);

      // 8. Verify Avatar Menu Dropdown on Mobile
      await avatar.click();
      await mobPage.waitForSelector('.user-dropdown', { state: 'visible' });
      const dropContent = await mobPage.locator('.user-dropdown').textContent();
      const mobHasSeusPaineis = dropContent.includes('SEUS PAINÉIS');
      const mobHasScan = (await mobPage.locator('.user-dropdown .scan-card').count()) > 0;
      const mobHasAdmin = (await mobPage.locator('.user-dropdown .admin-card').count()) > 0;

      record(`Mobile ${vp.name}: Menu da Conta Abre com Seus Painéis`,
        mobHasSeusPaineis && mobHasScan && mobHasAdmin, {
          mobHasSeusPaineis,
          mobHasScan,
          mobHasAdmin
        }
      );

      const shotMobDrop = path.join(ARTIFACT_DIR, `r18_final_mobile_dropdown_${vp.width}px.png`);
      await mobPage.screenshot({ path: shotMobDrop });
      results.screenshots.push(shotMobDrop);

      await mobCtx.close();
    }

  } finally {
    await browser.close();
  }

  // =========================================================================
  // 3. CROSS-BROWSER: FIREFOX (GECKO)
  // =========================================================================
  console.log('\n--- 3. Testing Firefox (Gecko Engine) ---');
  const ffBrowser = await firefox.launch({
    headless: true,
    args: ['--no-sandbox']
  });

  try {
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

    const ffDeskSearch = await ffDeskPage.locator('.header-search-btn').isVisible();
    const ffDeskFluxer = await ffDeskPage.locator('.header-community-btn.fluxer-btn').isVisible();
    const ffDeskDiscord = await ffDeskPage.locator('.header-community-btn.discord-btn').isVisible();
    const ffDeskAvatar = await ffDeskPage.locator('.avatar-btn').isVisible();
    const ffDeskPainelCount = await ffDeskPage.locator('.header-actions a[href="/admin"], .header-actions a[href^="/scan"]').count();

    record('Firefox Desktop 1440px: Lupa Visível e Painel Ausente no Topo',
      ffDeskSearch && ffDeskFluxer && ffDeskDiscord && ffDeskAvatar && ffDeskPainelCount === 0, {
        ffDeskSearch,
        ffDeskFluxer,
        ffDeskDiscord,
        ffDeskAvatar,
        ffDeskPainelCount
      }
    );

    const shotFfDesk = path.join(ARTIFACT_DIR, 'r18_final_firefox_desktop_1440px.png');
    await ffDeskPage.screenshot({ path: shotFfDesk });
    results.screenshots.push(shotFfDesk);
    await ffDeskCtx.close();

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

    const ffMobSearch = await ffMobPage.locator('.header-search-btn').isVisible();
    const ffMobMenu = await ffMobPage.locator('.mobile-menu-btn').isVisible();
    const ffMobFluxer = await ffMobPage.locator('.header-community-btn.fluxer-btn').isVisible();
    const ffMobDiscord = await ffMobPage.locator('.header-community-btn.discord-btn').isVisible();
    const ffMobBell = await ffMobPage.locator('.notification-link').isVisible();
    const ffMobAvatar = await ffMobPage.locator('.avatar-btn').isVisible();
    const ffMobBottom = await ffMobPage.locator('.mobile-bottom').isVisible();

    record('Firefox Mobile 390px: Lupa e Menu Removidos, 4 Ações e Bottom Nav Visíveis',
      !ffMobSearch && !ffMobMenu && ffMobFluxer && ffMobDiscord && ffMobBell && ffMobAvatar && ffMobBottom, {
        searchExcluded: !ffMobSearch,
        menuExcluded: !ffMobMenu,
        ffMobFluxer,
        ffMobDiscord,
        ffMobBell,
        ffMobAvatar,
        ffMobBottom
      }
    );

    const shotFfMob = path.join(ARTIFACT_DIR, 'r18_final_firefox_mobile_390px.png');
    await ffMobPage.screenshot({ path: shotFfMob });
    results.screenshots.push(shotFfMob);
    await ffMobCtx.close();

  } finally {
    await ffBrowser.close();
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  const total = results.tests.length;
  const passed = results.tests.filter(t => t.pass).length;
  const failed = total - passed;

  console.log(`\n==================================================`);
  console.log(`FINAL CERTIFICATION RESULT: ${passed}/${total} TESTS PASSED (${failed} FAILED)`);
  console.log(`==================================================`);

  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'round18_final_approval_report.json'),
    JSON.stringify(results, null, 2)
  );

  if (failed > 0) {
    console.error('Certification failed.');
    process.exit(1);
  } else {
    console.log('ALL ROUND 18 FINAL POLISH REQUIREMENTS VALIDATED SUCCESSFULLY!');
  }
}

main().catch(err => {
  console.error('Fatal certification error:', err);
  process.exit(1);
});
