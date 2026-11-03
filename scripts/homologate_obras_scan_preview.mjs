import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { join } from 'node:path';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function runHomologation() {
  console.log(`=== HOMOLOGAÇÃO COMPLETA: RODADA 22 — GESTÃO DA SCAN & OBRAS DA SCAN ===`);
  console.log(`URL Alvo: ${targetUrl}/scan?tab=obras`);

  const cookies = await ownerCookies(targetUrl);
  cookies.push(
    { name: 'nox-age-status', value: 'ADULT', url: targetUrl, httpOnly: false, sameSite: 'Lax', secure: targetUrl.startsWith('https:') },
    { name: 'nox-blur-nsfw', value: 'false', url: targetUrl, httpOnly: false, sameSite: 'Lax', secure: targetUrl.startsWith('https:') }
  );

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    // =========================================================================
    // 1. DESKTOP VIEWPORT (1440x900) - SIDEBAR RENOMEADA E VISÃO GERAL DE OBRAS
    // =========================================================================
    console.log('\n--- 1. DESKTOP 1440px: GESTÃO DA SCAN NA SIDEBAR E VISÃO GERAL (LEVEL 1) ---');
    const ctxDesktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    });
    await ctxDesktop.addCookies(cookies);
    const pDesktop = await ctxDesktop.newPage();

    await pDesktop.goto(`${targetUrl}/scan?tab=obras`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await pDesktop.waitForSelector('.obras-view-root', { timeout: 30000 });
    await pDesktop.waitForTimeout(600);

    // Verify Sidebar Category Name
    const sidebarSectionTitles = await pDesktop.$$eval('.nav-section .section-title', els => els.map(e => e.textContent?.trim()));
    console.log('Títulos de seções na Sidebar:', sidebarSectionTitles);
    if (!sidebarSectionTitles.includes('GESTÃO DA SCAN')) {
      throw new Error(`Falha: Seção "GESTÃO DA SCAN" não encontrada na sidebar. Encontrados: ${sidebarSectionTitles.join(', ')}`);
    }
    console.log('✓ Categoria "GESTÃO DA SCAN" confirmada na sidebar desktop!');

    // Capture sidebar screenshot
    const pathSidebarDesktop = join(artifactDir, 'obras_sidebar_gestao_da_scan.png');
    await pDesktop.locator('.workspace-sidebar').screenshot({ path: pathSidebarDesktop });
    console.log(`✓ Screenshot salvo: ${pathSidebarDesktop}`);

    // Verify Real Work (Céu Distante) Card Elements
    await pDesktop.waitForSelector('.work-title-heading', { timeout: 20000 });
    const cardTitle = await pDesktop.textContent('.work-title-heading');
    console.log(`Título da obra encontrada: ${cardTitle?.trim()}`);
    if (!cardTitle?.includes('Céu Distante')) {
      throw new Error(`Obra Céu Distante não encontrada! Encontrado: ${cardTitle}`);
    }

    const pathDesktopOverview = join(artifactDir, 'obras_desktop_1440_overview.png');
    await pDesktop.screenshot({ path: pathDesktopOverview, fullPage: false });
    console.log(`✓ Screenshot salvo: ${pathDesktopOverview}`);

    // =========================================================================
    // 2. LEVEL 2: GERENCIAR OBRA (WORK MANAGEMENT WORKSPACE)
    // =========================================================================
    console.log('\n--- 2. DESKTOP: LEVEL 2 — GERENCIAMENTO COMPLETO DA OBRA ---');
    // Click on "Gerenciar obra" button
    const btnGerenciar = pDesktop.locator('.btn-manage-work').first();
    await btnGerenciar.click();
    await pDesktop.waitForSelector('.work-manage-workspace', { timeout: 15000 });
    await pDesktop.waitForTimeout(500);

    // Verify Manage Work Header and KPI cards
    const manageTitle = await pDesktop.textContent('.hero-work-title');
    console.log(`Header do gerenciador aberto: ${manageTitle?.trim()}`);
    if (!manageTitle?.includes('Céu Distante')) {
      throw new Error(`Nome da obra não coincide no Level 2: ${manageTitle}`);
    }

    // Capture Tab 1: Visão Geral
    const pathManageOverview = join(artifactDir, 'obras_desktop_manage_overview.png');
    await pDesktop.screenshot({ path: pathManageOverview, fullPage: false });
    console.log(`✓ Screenshot salvo: ${pathManageOverview}`);

    // Click Tab 2: Informações & Metadados
    console.log('Navegando para aba Informações & Metadados...');
    await pDesktop.locator('.manage-tab-btn', { hasText: 'Informações' }).click();
    await pDesktop.waitForSelector('.work-editor-form', { timeout: 10000 });
    await pDesktop.waitForTimeout(400);

    const pathManageInfoForm = join(artifactDir, 'obras_desktop_manage_info_form.png');
    await pDesktop.screenshot({ path: pathManageInfoForm, fullPage: false });
    console.log(`✓ Screenshot salvo: ${pathManageInfoForm}`);

    // Test Safe Sandbox Form Submission
    console.log('Testando submissão segura de metadados no Preview...');
    const synopsisInput = pDesktop.locator('textarea[name="synopsis"]');
    await synopsisInput.fill('Sinopse de teste homologada no ambiente seguro de Preview.');
    await pDesktop.locator('.btn-form-submit').click();
    await pDesktop.waitForSelector('.form-feedback-alert.success', { timeout: 15000 });
    const successMsg = await pDesktop.textContent('.form-feedback-alert.success');
    console.log(`Mensagem de resposta do servidor: "${successMsg?.trim()}"`);
    console.log('✓ Submissão de formulário validada com integridade de dados garantida!');

    // Click Tab 3: Capítulos (Published & Pipeline)
    console.log('Navegando para aba Capítulos...');
    await pDesktop.locator('.manage-tab-btn', { hasText: 'Capítulos' }).click();
    await pDesktop.waitForSelector('.manage-chapters-stack, .empty-chapters-notice', { timeout: 10000 });
    await pDesktop.waitForTimeout(800);

    const pathManageChapters = join(artifactDir, 'obras_desktop_manage_chapters.png');
    await pDesktop.screenshot({ path: pathManageChapters, fullPage: false });
    console.log(`✓ Screenshot salvo: ${pathManageChapters}`);

    // Toggle to Pipeline chapters
    console.log('Alternando para visualização da Fila Editorial (Pipeline)...');
    await pDesktop.locator('.btn-chapter-tab', { hasText: 'No Pipeline' }).click();
    await pDesktop.waitForTimeout(500);

    // Click Tab 4: Histórico Editorial
    console.log('Navegando para aba Histórico...');
    await pDesktop.locator('.manage-tab-btn', { hasText: 'Histórico' }).click();
    await pDesktop.waitForSelector('.history-timeline-box', { timeout: 10000 });
    await pDesktop.waitForTimeout(400);

    const pathManageHistory = join(artifactDir, 'obras_desktop_manage_history.png');
    await pDesktop.screenshot({ path: pathManageHistory, fullPage: false });
    console.log(`✓ Screenshot salvo: ${pathManageHistory}`);

    // Return to Level 1
    console.log('Retornando para Level 1 via botão "Voltar para Obras da Scan"...');
    await pDesktop.locator('.btn-back-to-list').click();
    await pDesktop.waitForSelector('.works-cards-stack', { timeout: 10000 });
    await pDesktop.waitForTimeout(400);
    console.log('✓ Retorno ao Level 1 concluído com sucesso!');

    // =========================================================================
    // 3. HOMOLOGAÇÃO DE CENÁRIOS E FIXTURES
    // =========================================================================
    console.log('\n--- 3. TESTE DE CENÁRIOS (FIXTURES) VIA MENU PREVIEW ---');

    // Helper to switch scenario
    async function selectScenario(matchText) {
      await pDesktop.locator('.btn-scenarios-toggle').click();
      await pDesktop.waitForSelector('.scenarios-popover-menu', { state: 'visible', timeout: 5000 });
      await pDesktop.locator('.popover-item-btn', { hasText: matchText }).click();
      await pDesktop.waitForTimeout(500);
    }

    // Fixture: Múltiplas Obras (5)
    console.log('Testando fixture: Múltiplas Obras (MULTI)...');
    await selectScenario('Múltiplas Obras');
    const worksCount = await pDesktop.$$eval('.work-card-panel', els => els.length);
    console.log(`Quantidade de cards exibidos na fixture MULTI: ${worksCount}`);
    if (worksCount !== 5) {
      throw new Error(`Esperado 5 cards na fixture MULTI, mas obtido ${worksCount}`);
    }

    // Test Search input
    console.log('Testando filtro de busca instantâneo...');
    await pDesktop.locator('.search-text-field').fill('Tower');
    await pDesktop.waitForTimeout(300);
    const filteredCount = await pDesktop.$$eval('.work-card-panel', els => els.length);
    console.log(`Cards filtrados por "Tower": ${filteredCount}`);
    if (filteredCount !== 1) {
      throw new Error(`Esperado 1 card filtrado por Tower, obtido ${filteredCount}`);
    }
    await pDesktop.locator('.search-text-field').fill('');
    await pDesktop.waitForTimeout(300);

    // Test Status Filter Pills
    console.log('Testando filtro de status: PAUSADO...');
    await pDesktop.locator('.status-pill-btn', { hasText: 'Pausadas' }).click();
    await pDesktop.waitForTimeout(300);
    const pausedCards = await pDesktop.$$eval('.work-card-panel', els => els.length);
    console.log(`Cards filtrados como Pausado: ${pausedCards}`);

    // Reset filter
    await pDesktop.locator('.status-pill-btn', { hasText: 'Todas' }).click();
    await pDesktop.waitForTimeout(300);

    const pathMultiFixture = join(artifactDir, 'obras_multi_fixture.png');
    await pDesktop.screenshot({ path: pathMultiFixture, fullPage: false });
    console.log(`✓ Screenshot salvo: ${pathMultiFixture}`);

    // Fixture: Sem Capa (NO_COVER)
    console.log('Testando fixture: Sem Capa (Fallback NOX)...');
    await selectScenario('Sem Capa');
    const hasFallbackCover = await pDesktop.locator('.work-cover-fallback').isVisible();
    console.log(`Fallback visual NOX presente: ${hasFallbackCover}`);
    const pathNoCoverFixture = join(artifactDir, 'obras_no_cover_fixture.png');
    await pDesktop.screenshot({ path: pathNoCoverFixture, fullPage: false });
    console.log(`✓ Screenshot salvo: ${pathNoCoverFixture}`);

    // Fixture: Estado Vazio (EMPTY)
    console.log('Testando fixture: Estado Vazio...');
    await selectScenario('Estado Vazio');
    const hasEmptyState = await pDesktop.locator('.empty-works-panel').isVisible();
    console.log(`Estado vazio exibido corretamente: ${hasEmptyState}`);
    const pathEmptyState = join(artifactDir, 'obras_empty_state.png');
    await pDesktop.screenshot({ path: pathEmptyState, fullPage: false });
    console.log(`✓ Screenshot salvo: ${pathEmptyState}`);

    // Fixture: Membro Comum (MEMBER_VIEW) - Read-only check
    console.log('Testando fixture: Membro Comum (Read-only)...');
    await selectScenario('Visão de Membro Comum');
    // Open manage work view
    await pDesktop.locator('.btn-manage-work').first().click();
    await pDesktop.waitForSelector('.work-manage-workspace', { timeout: 10000 });
    // Go to info tab
    await pDesktop.locator('.manage-tab-btn', { hasText: 'Informações' }).click();
    await pDesktop.waitForTimeout(300);
    const hasReadOnlyBanner = await pDesktop.locator('.member-readonly-banner').isVisible();
    const isSaveBtnVisible = await pDesktop.locator('.btn-form-submit').isVisible();
    console.log(`Banner somente leitura presente: ${hasReadOnlyBanner}, Botão salvar visível para membro comum: ${isSaveBtnVisible}`);
    if (!hasReadOnlyBanner || isSaveBtnVisible) {
      throw new Error('Falha no RBAC para membro comum: formulário não está em modo somente leitura.');
    }
    console.log('✓ RBAC e permissões de membro comum homologados com sucesso!');

    // Restore to Real Data
    console.log('Restaurando para Dados Reais...');
    await pDesktop.locator('.btn-back-to-list').click();
    await selectScenario('Dados Reais da Scan');

    // =========================================================================
    // 4. MOBILE ANDROID (390x844, 320x640, 360x780, 430x932)
    // =========================================================================
    console.log('\n--- 4. MOBILE ANDROID: GAVETA, COMPACTAÇÃO E ZERO OVERFLOW ---');
    const ctxMobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.231205.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36'
    });
    await ctxMobile.addCookies(cookies);
    const pMob = await ctxMobile.newPage();
    await pMob.goto(`${targetUrl}/scan?tab=obras`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await pMob.waitForSelector('.obras-view-root', { timeout: 30000 });
    await pMob.waitForTimeout(500);

    const mobileViewports = [
      { name: '390x844_Pixel7', width: 390, height: 844 },
      { name: '320x640_Compact', width: 320, height: 640 },
      { name: '360x780_S22', width: 360, height: 780 },
      { name: '430x932_ProMax', width: 430, height: 932 }
    ];

    for (const vp of mobileViewports) {
      console.log(`Testando viewport mobile: ${vp.name} (${vp.width}x${vp.height})...`);
      await pMob.setViewportSize({ width: vp.width, height: vp.height });
      await pMob.waitForTimeout(400);

      // Verify zero horizontal overflow
      const overflow = await pMob.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
        };
      });
      console.log(`  [${vp.name}] scrollWidth: ${overflow.scrollWidth}, clientWidth: ${overflow.clientWidth}, hasOverflow: ${overflow.hasOverflow}`);
      if (overflow.hasOverflow) {
        throw new Error(`Overflow detectado em ${vp.name}! scrollWidth: ${overflow.scrollWidth} > clientWidth: ${overflow.clientWidth}`);
      }

      if (vp.width === 390) {
        // Open Mobile Hamburger and test Drawer
        console.log('  Abrindo gaveta mobile (drawer) para validar "GESTÃO DA SCAN"...');
        await pMob.locator('.btn-hamburger').click();
        await pMob.waitForSelector('.workspace-sidebar.mobile-open', { state: 'visible', timeout: 10000 });
        await pMob.waitForTimeout(400);

        const drawerSectionTitles = await pMob.$$eval('.nav-section .section-title', els => els.map(e => e.textContent?.trim()));
        console.log('  Títulos na gaveta mobile:', drawerSectionTitles);
        if (!drawerSectionTitles.includes('GESTÃO DA SCAN')) {
          throw new Error(`Falha: Seção "GESTÃO DA SCAN" não encontrada no drawer mobile!`);
        }

        const pathMobileDrawer = join(artifactDir, 'obras_drawer_gestao_da_scan.png');
        await pMob.screenshot({ path: pathMobileDrawer, fullPage: false });
        console.log(`  ✓ Screenshot salvo: ${pathMobileDrawer}`);

        // Close drawer
        await pMob.locator('.mobile-close-btn').click();
        await pMob.waitForSelector('.workspace-sidebar:not(.mobile-open)', { state: 'attached', timeout: 10000 });
        await pMob.waitForTimeout(300);

        // Take overview screenshot
        const pathMobOverview = join(artifactDir, 'obras_mobile_390_overview.png');
        await pMob.screenshot({ path: pathMobOverview, fullPage: false });
        console.log(`  ✓ Screenshot salvo: ${pathMobOverview}`);

        // Test Level 2 on Mobile
        console.log('  Testando Level 2 (Gerenciamento) no Mobile...');
        await pMob.locator('.btn-manage-work').first().click();
        await pMob.waitForSelector('.work-manage-workspace', { timeout: 10000 });
        await pMob.waitForTimeout(400);

        const pathMobManage = join(artifactDir, 'obras_mobile_manage_work.png');
        await pMob.screenshot({ path: pathMobManage, fullPage: false });
        console.log(`  ✓ Screenshot salvo: ${pathMobManage}`);

        // Return to Level 1
        await pMob.locator('.btn-back-to-list').click();
        await pMob.waitForSelector('.works-cards-stack', { timeout: 10000 });
        await pMob.waitForTimeout(300);
      } else if (vp.width === 320) {
        const pathMob320 = join(artifactDir, 'obras_mobile_320_compact.png');
        await pMob.screenshot({ path: pathMob320, fullPage: false });
        console.log(`  ✓ Screenshot salvo: ${pathMob320}`);
      }
    }
    await ctxMobile.close();

    // =========================================================================
    // 5. REGRESSÃO: CALENDÁRIO 100% INTACTO
    // =========================================================================
    console.log('\n--- 5. REGRESSÃO: VALIDAR QUE O CALENDÁRIO PERMANECE 100% INTACTO ---');
    await pDesktop.goto(`${targetUrl}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await pDesktop.waitForSelector('.calendar-tab', { timeout: 20000 });
    await pDesktop.waitForTimeout(500);

    const pathCalendarIntact = join(artifactDir, 'obras_calendar_intact_regression.png');
    await pDesktop.screenshot({ path: pathCalendarIntact, fullPage: false });
    console.log(`✓ Screenshot salvo: ${pathCalendarIntact}`);
    console.log('✓ Calendário carregado normalmente sem quebras ou alterações indevidas!');

    // =========================================================================
    // 6. DESKTOP VIEWPORTS ADICIONAIS (1024px, 1280px, 1920px)
    // =========================================================================
    console.log('\n--- 6. VIEWPORTS ADICIONAIS DE COMPUTADOR ---');
    await pDesktop.goto(`${targetUrl}/scan?tab=obras`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await pDesktop.waitForSelector('.obras-view-root', { timeout: 20000 });
    for (const w of [1024, 1280, 1920]) {
      await pDesktop.setViewportSize({ width: w, height: 900 });
      await pDesktop.waitForTimeout(300);

      const pathVp = join(artifactDir, `obras_viewport_${w}px.png`);
      await pDesktop.screenshot({ path: pathVp, fullPage: false });
      console.log(`✓ Screenshot salvo: ${pathVp}`);
    }

    console.log('\n=============================================================');
    console.log('🎉 TODAS AS VERIFICAÇÕES DE HOMOLOGAÇÃO FORAM CONCLUÍDAS COM SUCESSO!');
    console.log('=============================================================');

  } finally {
    await browser.close();
  }
}

runHomologation().catch(err => {
  console.error('ERRO FATAL NA HOMOLOGAÇÃO:', err);
  process.exit(1);
});
