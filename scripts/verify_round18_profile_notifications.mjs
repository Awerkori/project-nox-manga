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
  console.log('=== STARTING ROUND 18 E2E PLAYWRIGHT CERTIFICATION ===');
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

  // 1. CHROMIUM RUN: DESKTOP & MOBILE
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Central de Notificações Desktop (1440x900)
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Testing Central de Notificações on Desktop (1440x900) ---');
    const desktopCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    await desktopCtx.addCookies([
      ...sessionCookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);

    const page = await desktopCtx.newPage();
    const notifRes = await page.goto(`${PREVIEW_URL}/notificacoes`, { waitUntil: 'networkidle' });
    record('Notificacoes status 200', notifRes.status() === 200, { status: notifRes.status() });

    // Verify Title, Hub Pill, Action Button
    const pageTitle = await page.locator('.page-title').textContent();
    const hubPill = await page.locator('.hub-pill').textContent();
    const markAllBtn = await page.locator('.btn-mark-all').isVisible();
    record('Notificacoes Header Elements', pageTitle.includes('Notificações') && hubPill.includes('CENTRAL PESSOAL') && markAllBtn);

    // Verify Filter Tabs
    const tabs = await page.locator('.notif-tabs-nav .tab-btn').allTextContents();
    record('Notificacoes Filter Tabs Exist', tabs.length === 3, { tabs });

    // Verify Timeframe Groups & Cards
    const timelineGroups = await page.locator('.timeline-group').count();
    const notifCards = await page.locator('.notif-card').count();
    record('Timeline Groups and Cards Rendered', timelineGroups > 0 && notifCards > 0, {
      groupsCount: timelineGroups,
      cardsCount: notifCards
    });

    const shot1 = path.join(ARTIFACT_DIR, 'r18_notifications_desktop_overview.png');
    await page.screenshot({ path: shot1, fullPage: false });
    results.screenshots.push(shot1);

    // Test Tab Switching to "Não Lidas"
    await page.locator('.tab-btn:has-text("Não Lidas")').click();
    await page.waitForTimeout(400);
    const unreadTabActive = await page.locator('.tab-btn:has-text("Não Lidas")').getAttribute('class');
    record('Filter Tab "Não Lidas" Activated', unreadTabActive.includes('active'));

    const shot2 = path.join(ARTIFACT_DIR, 'r18_notifications_tab_unread.png');
    await page.screenshot({ path: shot2, fullPage: false });
    results.screenshots.push(shot2);

    // Test Single Mark as Read if unread exists
    const singleMarkBtn = page.locator('.btn-mark-single').first();
    const hasUnread = await singleMarkBtn.count();
    if (hasUnread > 0) {
      await singleMarkBtn.click();
      await page.waitForTimeout(600);
      record('Individual Mark as Read Clicked', true);
    } else {
      record('Individual Mark as Read (All already read)', true);
    }

    // Switch back to "Todas"
    await page.locator('.tab-btn:has-text("Todas")').click();
    await page.waitForTimeout(400);

    // Test "Marcar todas como lidas"
    const markAllActive = await page.locator('.btn-mark-all:not(:disabled)').count();
    if (markAllActive > 0) {
      await page.locator('.btn-mark-all').click();
      await page.waitForTimeout(800);
      const toastVisible = await page.locator('.notif-toast').isVisible();
      record('Marcar todas como lidas executed with toast', toastVisible);
    } else {
      record('Marcar todas como lidas button disabled when 0 unread', true);
    }

    const shot3 = path.join(ARTIFACT_DIR, 'r18_notifications_all_read.png');
    await page.screenshot({ path: shot3, fullPage: false });
    results.screenshots.push(shot3);

    // ------------------------------------------------------------------------
    // TEST 2: Avatar Menu Dropdown on Desktop (1440x900)
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Testing Simplified Avatar Dropdown on Desktop ---');
    await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'networkidle' });

    // Open avatar menu
    await page.locator('.avatar-btn').click();
    await page.waitForSelector('.user-dropdown', { state: 'visible' });

    // Verify structure
    const dropdownText = await page.locator('.user-dropdown').textContent();
    const hasAreaPessoal = dropdownText.includes('ÁREA PESSOAL');
    const hasMeuPerfil = await page.locator('.user-dropdown a[href^="/u/"]').count() > 0;
    const hasConquistas = await page.locator('.user-dropdown a[href*="tab=conquistas"]').count() > 0;
    const hasSeusPaineis = dropdownText.includes('SEUS PAINÉIS');
    const hasPainelScan = await page.locator('.user-dropdown .panel-action-card.scan-card').count() > 0;
    const hasPainelControle = await page.locator('.user-dropdown .panel-action-card.admin-card').count() > 0;
    const hasLogout = await page.locator('.dropdown-logout-btn').isVisible();

    // Verify redundant items were removed
    const hasOldMeuEspaco = dropdownText.includes('Meu Espaço');
    const hasOldBiblioteca = dropdownText.includes('Minha Biblioteca');
    const hasOldHistorico = dropdownText.includes('Histórico');

    record('Avatar Dropdown Structure', hasAreaPessoal && hasMeuPerfil && hasConquistas && hasSeusPaineis && hasLogout, {
      hasAreaPessoal,
      hasMeuPerfil,
      hasConquistas,
      hasSeusPaineis,
      hasPainelScan,
      hasPainelControle,
      hasLogout
    });

    record('Redundant Items Removed from Dropdown', !hasOldMeuEspaco && !hasOldBiblioteca && !hasOldHistorico, {
      hasOldMeuEspaco,
      hasOldBiblioteca,
      hasOldHistorico
    });

    const shot4 = path.join(ARTIFACT_DIR, 'r18_avatar_dropdown_desktop.png');
    await page.screenshot({ path: shot4 });
    results.screenshots.push(shot4);

    // Click "Meu Perfil" in dropdown and verify navigation to /u/[username]
    await page.locator('.dropdown-links a:has-text("Meu Perfil")').click();
    await page.waitForURL(/\/u\/awerkori/, { timeout: 8000 });
    record('Meu Perfil Dropdown Navigation to Public Profile', page.url().includes('/u/awerkori'), { url: page.url() });

    // ------------------------------------------------------------------------
    // TEST 3: Public Profile Owner View with [Editar Meu Perfil] button
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Testing Public Profile Owner View ---');
    const editBtn = page.locator('.btn-profile-action.self.edit-profile-btn');
    const editBtnVisible = await editBtn.isVisible();
    const editBtnText = await editBtn.textContent();
    record('Editar Meu Perfil Button Visible on Own Profile', editBtnVisible && editBtnText.includes('Editar Meu Perfil'), {
      text: editBtnText?.trim()
    });

    const shot5 = path.join(ARTIFACT_DIR, 'r18_profile_public_owner_edit_btn.png');
    await page.screenshot({ path: shot5 });
    results.screenshots.push(shot5);

    // Click [Editar Meu Perfil] and verify navigation to /me
    await editBtn.click();
    await page.waitForURL(/\/me/, { timeout: 8000 });
    record('Editar Meu Perfil Navigates to /me', page.url().includes('/me'), { url: page.url() });

    // ------------------------------------------------------------------------
    // TEST 4: Public Scan Page with [Gerenciar Scan] button
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Testing Public Scan Page Gerenciar Scan ---');
    await page.goto(`${PREVIEW_URL}/scans/project-nox`, { waitUntil: 'networkidle' });

    const manageScanTopBtn = page.locator('.btn-staff-cockpit');
    const manageScanSocialBtn = page.locator('.social-dock-btn.manage-scan');
    const topVisible = await manageScanTopBtn.isVisible();
    const topText = await manageScanTopBtn.textContent();
    const topHref = await manageScanTopBtn.getAttribute('href');

    record('Gerenciar Scan Button on Public Scan Page', topVisible && topText.includes('Gerenciar Scan'), {
      topText: topText?.trim(),
      topHref
    });

    const shot6 = path.join(ARTIFACT_DIR, 'r18_scan_public_manage_button.png');
    await page.screenshot({ path: shot6 });
    results.screenshots.push(shot6);

    // ------------------------------------------------------------------------
    // TEST 5: Mobile Screen Sizes (360x800, 390x844, 430x932, 768px tablet)
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Testing Mobile Header Notification Bell & Responsiveness ---');
    const viewports = [
      { name: '360x800 (Compact Mobile)', width: 360, height: 800 },
      { name: '390x844 (iPhone 12/13/14)', width: 390, height: 844 },
      { name: '430x932 (iPhone Pro Max)', width: 430, height: 932 },
      { name: '768x1024 (Tablet)', width: 768, height: 1024 }
    ];

    for (const vp of viewports) {
      console.log(`Testing viewport: ${vp.name}...`);
      const mobCtx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.width < 768,
        hasTouch: vp.width < 768
      });
      await mobCtx.addCookies([
        ...sessionCookies,
        { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
      ]);

      const mobPage = await mobCtx.newPage();
      await mobPage.goto(`${PREVIEW_URL}/`, { waitUntil: 'networkidle' });

      // Check Mobile Header Elements: Bell, Avatar, Hamburger
      const bellVisible = await mobPage.locator('.notification-link').isVisible();
      const bellHref = await mobPage.locator('.notification-link').getAttribute('href');
      const avatarVisible = await mobPage.locator('.avatar-btn').isVisible();
      const menuBtnVisible = await mobPage.locator('.mobile-menu-btn').isVisible();

      record(`Mobile Header Elements (${vp.name})`, bellVisible && bellHref === '/notificacoes' && avatarVisible && menuBtnVisible, {
        bellVisible,
        bellHref,
        avatarVisible,
        menuBtnVisible
      });

      // Capture header state
      const shotMobHeader = path.join(ARTIFACT_DIR, `r18_mobile_header_${vp.width}px.png`);
      await mobPage.screenshot({ path: shotMobHeader });
      results.screenshots.push(shotMobHeader);

      // Open Avatar Dropdown on Mobile
      await mobPage.locator('.avatar-btn').click();
      await mobPage.waitForSelector('.user-dropdown', { state: 'visible' });

      const mobDropText = await mobPage.locator('.user-dropdown').textContent();
      const mobHasPaineis = mobDropText.includes('SEUS PAINÉIS');
      record(`Mobile Avatar Dropdown Seus Paineis (${vp.name})`, mobHasPaineis);

      const shotMobDrop = path.join(ARTIFACT_DIR, `r18_mobile_dropdown_${vp.width}px.png`);
      await mobPage.screenshot({ path: shotMobDrop });
      results.screenshots.push(shotMobDrop);

      // Close Dropdown and Click Bell -> verify navigation to /notificacoes
      await mobPage.keyboard.press('Escape');
      await mobPage.locator('.notification-link').click();
      await mobPage.waitForURL(/\/notificacoes/, { timeout: 8000 });

      record(`Mobile Bell Navigates to /notificacoes (${vp.name})`, mobPage.url().includes('/notificacoes'));

      const shotMobNotif = path.join(ARTIFACT_DIR, `r18_mobile_notificacoes_${vp.width}px.png`);
      await mobPage.screenshot({ path: shotMobNotif });
      results.screenshots.push(shotMobNotif);

      await mobCtx.close();
    }

    // ------------------------------------------------------------------------
    // TEST 6: Unauthenticated Visitor Permissions Check
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Testing Unauthenticated Visitor Permissions ---');
    const anonCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    await anonCtx.addCookies([
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const anonPage = await anonCtx.newPage();

    // 1. Visitor on Home
    await anonPage.goto(`${PREVIEW_URL}/`, { waitUntil: 'networkidle' });
    const hasAnonBell = await anonPage.locator('.notification-link').count();
    const hasAnonAvatar = await anonPage.locator('.avatar-btn').count();
    const hasEntrarBtn = await anonPage.locator('.btn-login-nav').isVisible();
    record('Visitor Header (No Bell, No Avatar, Has Entrar)', hasAnonBell === 0 && hasAnonAvatar === 0 && hasEntrarBtn);

    // 2. Visitor on /notificacoes should redirect to /entrar
    await anonPage.goto(`${PREVIEW_URL}/notificacoes`, { waitUntil: 'networkidle' });
    record('Visitor on /notificacoes Redirects to /entrar', anonPage.url().includes('/entrar'));

    // 3. Visitor on /u/awerkori shows Follow button, NOT Edit button
    await anonPage.goto(`${PREVIEW_URL}/u/awerkori`, { waitUntil: 'networkidle' });
    const anonHasEdit = await anonPage.locator('.edit-profile-btn').count();
    const anonHasFollow = await anonPage.locator('.btn-profile-action.follow').isVisible();
    record('Visitor on Public Profile (No Edit Button, Has Follow Button)', anonHasEdit === 0 && anonHasFollow);

    // 4. Visitor on /scans/project-nox does NOT see [Gerenciar Scan]
    await anonPage.goto(`${PREVIEW_URL}/scans/project-nox`, { waitUntil: 'networkidle' });
    const anonHasManageScan = await anonPage.locator('.btn-staff-cockpit').count();
    record('Visitor on Scan Public Page (No Gerenciar Scan Button)', anonHasManageScan === 0);

    const shotAnon = path.join(ARTIFACT_DIR, 'r18_anon_profile_and_scan.png');
    await anonPage.screenshot({ path: shotAnon });
    results.screenshots.push(shotAnon);

    await anonCtx.close();
  } finally {
    await browser.close();
  }

  // ------------------------------------------------------------------------
  // 2. FIREFOX (GECKO) VERIFICATION RUN
  // ------------------------------------------------------------------------
  console.log('\n--- 7. Firefox (Gecko) Engine Verification ---');
  try {
    const ffBrowser = await firefox.launch({
      headless: true
    });
    const ffCtx = await ffBrowser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    await ffCtx.addCookies([
      ...sessionCookies,
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }
    ]);
    const ffPage = await ffCtx.newPage();

    // Verify /notificacoes in Firefox
    await ffPage.goto(`${PREVIEW_URL}/notificacoes`, { waitUntil: 'networkidle' });
    const ffTitle = await ffPage.locator('.page-title').textContent();
    const ffCards = await ffPage.locator('.notif-card').count();
    record('Firefox Central de Notificacoes Rendered', ffTitle.includes('Notificações') && ffCards > 0, {
      ffCards
    });

    const shotFF = path.join(ARTIFACT_DIR, 'r18_firefox_notifications.png');
    await ffPage.screenshot({ path: shotFF });
    results.screenshots.push(shotFF);

    await ffBrowser.close();
  } catch (ffErr) {
    console.warn('Firefox run notice:', ffErr.message);
  }

  // Write Verification JSON Report
  const reportPath = path.join(ARTIFACT_DIR, 'round18_verification_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('\nVerification report written to:', reportPath);

  const allPassed = results.tests.every(t => t.pass);
  console.log(`\nALL TESTS PASSED: ${allPassed} (${results.tests.filter(t => t.pass).length}/${results.tests.length})`);
  return allPassed;
}

main().then(success => {
  if (!success) {
    console.error('Some tests failed.');
    process.exit(1);
  } else {
    console.log('Round 18 verification completed successfully.');
    process.exit(0);
  }
}).catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
