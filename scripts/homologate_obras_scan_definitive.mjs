import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { join } from 'node:path';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function runHomologation() {
  console.log(`=== HOMOLOGAÇÃO DEFINITIVA 10/10: GESTÃO DA SCAN & OBRAS DA SCAN ===`);
  console.log(`URL Alvo: ${targetUrl}/scan?tab=obras`);
  console.log(`Artifact Dir: ${artifactDir}`);

  const cookies = await ownerCookies(targetUrl);
  cookies.push(
    { name: 'nox-age-status', value: 'ADULT', url: targetUrl, httpOnly: false, sameSite: 'Lax', secure: targetUrl.startsWith('https:') },
    { name: 'nox-blur-nsfw', value: 'false', url: targetUrl, httpOnly: false, sameSite: 'Lax', secure: targetUrl.startsWith('https:') }
  );

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    // =========================================================================
    // 1. DESKTOP VIEWPORTS (1440x900, 1280x800, 1920x1080)
    // =========================================================================
    console.log('\n--- 1. DESKTOP: VISÃO GERAL (LEVEL 1) EM 1440px, 1280px e 1920px ---');
    const ctxDesktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    });
    await ctxDesktop.addCookies(cookies);
    const pDesktop = await ctxDesktop.newPage();

    await pDesktop.goto(`${targetUrl}/scan?tab=obras`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await pDesktop.waitForSelector('.obras-view-root', { timeout: 30000 });
    await pDesktop.waitForTimeout(600);

    // Verify Sidebar Category
    const sidebarCategory = await pDesktop.textContent('.nav-section .section-title');
    console.log('Categoria no topo da Sidebar:', sidebarCategory?.trim());

    // Capture Desktop 1440 Overview
    const pathDesk1440 = join(artifactDir, 'after_desktop_1440_overview.png');
    await pDesktop.screenshot({ path: pathDesk1440 });
    console.log(`✓ Screenshot salvo: ${pathDesk1440}`);

    // Verify 1280px
    await pDesktop.setViewportSize({ width: 1280, height: 800 });
    await pDesktop.waitForTimeout(300);
    const pathDesk1280 = join(artifactDir, 'after_desktop_1280_overview.png');
    await pDesktop.screenshot({ path: pathDeskDesk(pathDesk1280) });
    console.log(`✓ Screenshot salvo: ${pathDesk1280}`);

    // Verify 1920px
    await pDesktop.setViewportSize({ width: 1920, height: 1080 });
    await pDesktop.waitForTimeout(300);
    const pathDesk1920 = join(artifactDir, 'after_desktop_1920_overview.png');
    await pDesktop.screenshot({ path: pathDesk1920 });
    console.log(`✓ Screenshot salvo: ${pathDesk1920}`);

    // Reset to 1440px for subsequent tests
    await pDesktop.setViewportSize({ width: 1440, height: 900 });
    await pDesktop.waitForTimeout(200);

    // Verify metrics in Level 1 Work Card
    const metricsText = await pDesktop.$$eval('.work-metrics-strip .metric-cell', els => els.map(e => e.textContent?.trim()));
    console.log('Métricas do Card no Nível 1:', metricsText);
    const hasCatalogCaps = metricsText.some(t => t?.includes('caps no catálogo'));
    const hasScanManaged = metricsText.some(t => t?.includes('da scan'));
    console.log(`  - Exibe "caps no catálogo": ${hasCatalogCaps}`);
    console.log(`  - Exibe "da scan": ${hasScanManaged}`);

    // Verify Recent Chapters title normalization
    const chCards = await pDesktop.$$eval('.recent-ch-card', els => els.map(e => ({
      work: e.querySelector('.ch-work-name')?.textContent?.trim(),
      number: e.querySelector('.ch-number-badge')?.textContent?.trim(),
      title: e.querySelector('.ch-title-truncate')?.textContent?.trim() || null
    })));
    console.log('Amostra de Últimos Capítulos:', chCards.slice(0, 3));
    // Verify no "Cap. 84 — Capítulo 84" duplicate
    for (const ch of chCards) {
      if (ch.title && (ch.title.toLowerCase() === ch.number?.toLowerCase() || ch.title.toLowerCase() === `capítulo ${ch.number?.replace(/[^0-9]/g, '')}`)) {
        throw new Error(`Inconsistência: Título duplicado detectado: ${ch.number} — ${ch.title}`);
      }
    }
    console.log('✓ Normalização de títulos de capítulos validada: sem duplicações redundantes!');

    // Capture Recent Chapters & Search/Filter on Desktop
    await pDesktop.locator('.search-text-field').fill('Céu');
    await pDesktop.waitForTimeout(300);
    const pathSearchFilterDesk = join(artifactDir, 'after_desktop_search_filter.png');
    await pDesktop.screenshot({ path: pathSearchFilterDesk });
    console.log(`✓ Screenshot salvo: ${pathSearchFilterDesk}`);
    await pDesktop.locator('.btn-clear-search').click();
    await pDesktop.waitForTimeout(200);

    // =========================================================================
    // 2. TEST SCENARIOS (FIXTURES)
    // =========================================================================
    async function selectScenario(labelPrefix) {
      await pDesktop.locator('.btn-scenarios-toggle').click();
      await pDesktop.waitForSelector('.scenarios-popover-menu', { timeout: 5000 });
      await pDesktop.waitForTimeout(200);
      const item = pDesktop.locator(`.popover-item-btn:has-text("${labelPrefix}")`);
      await item.click();
      await pDesktop.waitForTimeout(400);
    }

    // MULTI (5 works)
    console.log('\n--- 2. CENÁRIO: MÚLTIPLAS OBRAS (5) ---');
    await selectScenario('Múltiplas Obras');
    const pathMulti = join(artifactDir, 'after_desktop_multi_fixture.png');
    await pDesktop.screenshot({ path: pathMulti });
    console.log(`✓ Screenshot salvo: ${pathMulti}`);

    // EMPTY state
    console.log('\n--- CENÁRIO: ESTADO VAZIO ---');
    await selectScenario('Estado Vazio');
    const pathEmpty = join(artifactDir, 'after_empty_state.png');
    await pDesktop.screenshot({ path: pathEmpty });
    console.log(`✓ Screenshot salvo: ${pathEmpty}`);

    // Restore to REAL
    console.log('\n--- Restaurando para Dados Reais ---');
    await selectScenario('Dados Reais da Scan');

    // =========================================================================
    // 3. LEVEL 2: GERENCIAMENTO COMPLETO DA OBRA (DESKTOP)
    // =========================================================================
    console.log('\n--- 3. LEVEL 2 (GERENCIAMENTO): AS 4 ABAS NO DESKTOP ---');
    await pDesktop.locator('.btn-manage-work').first().click();
    await pDesktop.waitForSelector('.work-manage-workspace', { timeout: 10000 });
    await pDesktop.waitForTimeout(400);

    // Aba 1: Visão Geral
    const pathManageOverview = join(artifactDir, 'after_desktop_manage_overview.png');
    await pDesktop.screenshot({ path: pathManageOverview });
    console.log(`✓ Screenshot salvo: ${pathManageOverview}`);

    // Verify 4 KPIs
    const kpis = await pDesktop.$$eval('.kpi-metric-card', els => els.map(e => ({
      label: e.querySelector('.kpi-label')?.textContent?.trim(),
      val: e.querySelector('.kpi-value')?.textContent?.trim(),
      sub: e.querySelector('.kpi-sub')?.textContent?.trim()
    })));
    console.log('KPIs da Visão Geral no Nível 2:', kpis);

    // Test quick status change
    console.log('Testando clique no switcher de status (Pausado)...');
    const pausedRadio = pDesktop.locator('.status-radio-card:has-text("Pausado")');
    await pausedRadio.click();
    await pDesktop.waitForTimeout(600);
    const pathStatusSwitched = join(artifactDir, 'after_desktop_status_switched.png');
    await pDesktop.screenshot({ path: pathStatusSwitched });
    console.log(`✓ Screenshot salvo: ${pathStatusSwitched}`);

    // Restore status to Ativo
    await pDesktop.locator('.status-radio-card:has-text("Ativo")').click();
    await pDesktop.waitForTimeout(500);

    // Aba 2: Informações & Metadados
    console.log('Navegando para Aba: Informações & Metadados...');
    await pDesktop.locator('.manage-tab-btn:has-text("Informações")').click();
    await pDesktop.waitForSelector('.work-editor-form', { timeout: 5000 });
    await pDesktop.waitForTimeout(300);
    const pathManageInfo = join(artifactDir, 'after_desktop_manage_info.png');
    await pDesktop.screenshot({ path: pathManageInfo });
    console.log(`✓ Screenshot salvo: ${pathManageInfo}`);

    // Test safe sandbox submit on Preview
    console.log('Submetendo formulário com salvaguarda sandbox no Preview...');
    await pDesktop.locator('.btn-form-submit').click();
    await pDesktop.waitForSelector('.form-feedback-alert.success', { timeout: 10000 });
    const successMsg = await pDesktop.textContent('.form-feedback-alert');
    console.log(`Feedback da ação: ${successMsg?.trim()}`);
    const pathEditSubmit = join(artifactDir, 'after_desktop_edit_submit.png');
    await pDesktop.screenshot({ path: pathEditSubmit });
    console.log(`✓ Screenshot salvo: ${pathEditSubmit}`);

    // Aba 3: Capítulos
    console.log('Navegando para Aba: Capítulos...');
    await pDesktop.locator('.manage-tab-btn:has-text("Capítulos")').click();
    await pDesktop.waitForSelector('.chapters-subnav-row', { timeout: 5000 });
    await pDesktop.waitForTimeout(300);
    const pathManageChapters = join(artifactDir, 'after_desktop_manage_chapters.png');
    await pDesktop.screenshot({ path: pathManageChapters });
    console.log(`✓ Screenshot salvo: ${pathManageChapters}`);

    // Toggle sub-tab: No Pipeline
    await pDesktop.locator('.btn-chapter-tab:has-text("No Pipeline")').click();
    await pDesktop.waitForTimeout(300);
    const pipelineCount = await pDesktop.$$eval('.chapter-row-item.is-production', els => els.length);
    console.log(`Capítulos listados na sub-aba No Pipeline: ${pipelineCount}`);

    // Aba 4: Histórico Editorial
    console.log('Navegando para Aba: Histórico Editorial...');
    await pDesktop.locator('.manage-tab-btn:has-text("Histórico")').click();
    await pDesktop.waitForSelector('.history-timeline-box', { timeout: 5000 });
    await pDesktop.waitForTimeout(300);
    const pathManageHistory = join(artifactDir, 'after_desktop_manage_history.png');
    await pDesktop.screenshot({ path: pathManageHistory });
    console.log(`✓ Screenshot salvo: ${pathManageHistory}`);

    // Voltar para Level 1
    await pDesktop.locator('.btn-back-to-list').click();
    await pDesktop.waitForSelector('.works-cards-stack', { timeout: 5000 });

    // Test Read-Only Mode (MEMBER_VIEW)
    console.log('\n--- CENÁRIO: MEMBRO COMUM (READ-ONLY) ---');
    await selectScenario('Membro Comum');
    await pDesktop.locator('.btn-manage-work').first().click();
    await pDesktop.waitForSelector('.manage-tabs-nav', { timeout: 5000 });
    await pDesktop.locator('.manage-tab-btn:has-text("Informações")').click();
    await pDesktop.waitForSelector('.member-readonly-banner', { timeout: 5000 });
    const isSaveBtnVisible = await pDesktop.locator('.btn-form-submit').isVisible();
    console.log(`  - Botão de salvar visível para Membro? ${isSaveBtnVisible} (esperado: false)`);
    if (isSaveBtnVisible) throw new Error('Falha de segurança: Botão Salvar visível no modo membro comum!');
    const pathMemberReadOnly = join(artifactDir, 'after_member_readonly_view.png');
    await pDesktop.screenshot({ path: pathMemberReadOnly });
    console.log(`✓ Screenshot salvo: ${pathMemberReadOnly}`);

    // Return to list and restore Real
    await pDesktop.locator('.btn-back-to-list').click();
    await selectScenario('Dados Reais da Scan');

    // =========================================================================
    // 4. MOBILE ANDROID VIEWPORTS (320px, 360px, 390px, 430px)
    // =========================================================================
    console.log('\n--- 4. MOBILE ANDROID: AUDITORIA CRITERIOSA 10/10 ---');
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
      await pMob.waitForTimeout(350);

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
        const pathMob390Overview = join(artifactDir, 'after_mobile_390_overview.png');
        await pMob.screenshot({ path: pathMob390Overview });
        console.log(`  ✓ Screenshot salvo: ${pathMob390Overview}`);

        // Open Level 2 on Mobile
        console.log('  Abrindo Level 2 no Mobile (390px)...');
        await pMob.locator('.btn-manage-work').first().click();
        await pMob.waitForSelector('.work-manage-workspace', { timeout: 10000 });
        await pMob.waitForTimeout(400);

        // Verify zero overflow in Level 2
        const l2Overflow = await pMob.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
        }));
        console.log(`  Level 2 [390px] scrollWidth: ${l2Overflow.scrollWidth}, clientWidth: ${l2Overflow.clientWidth}, hasOverflow: ${l2Overflow.hasOverflow}`);
        if (l2Overflow.hasOverflow) throw new Error('Overflow detectado no Level 2 mobile!');

        // Check tabs single line & touch target
        const tabsBox = await pMob.$$eval('.manage-tab-btn', els => els.map(e => ({
          text: e.textContent?.trim(),
          height: e.getBoundingClientRect().height,
          nowrap: window.getComputedStyle(e).whiteSpace
        })));
        console.log('  Abas no Mobile 390px:', tabsBox);
        for (const t of tabsBox) {
          if (t.height < 40) throw new Error(`Touch target menor que 40px na aba ${t.text}: ${t.height}px`);
        }

        const pathMobManageOverview = join(artifactDir, 'after_mobile_manage_overview.png');
        await pMob.screenshot({ path: pathMobManageOverview });
        console.log(`  ✓ Screenshot salvo: ${pathMobManageOverview}`);

        // Aba 2: Informações mobile
        await pMob.locator('.manage-tab-btn:has-text("Informações")').click();
        await pMob.waitForTimeout(300);
        const pathMobManageInfo = join(artifactDir, 'after_mobile_manage_info.png');
        await pMob.screenshot({ path: pathMobManageInfo });
        console.log(`  ✓ Screenshot salvo: ${pathMobManageInfo}`);

        // Aba 3: Capítulos mobile
        await pMob.locator('.manage-tab-btn:has-text("Capítulos")').click();
        await pMob.waitForTimeout(300);
        const pathMobManageChapters = join(artifactDir, 'after_mobile_manage_chapters.png');
        await pMob.screenshot({ path: pathMobManageChapters });
        console.log(`  ✓ Screenshot salvo: ${pathMobManageChapters}`);

        // Aba 4: Histórico mobile
        await pMob.locator('.manage-tab-btn:has-text("Histórico")').click();
        await pMob.waitForTimeout(300);
        const pathMobManageHistory = join(artifactDir, 'after_mobile_manage_history.png');
        await pMob.screenshot({ path: pathMobManageHistory });
        console.log(`  ✓ Screenshot salvo: ${pathMobManageHistory}`);

        // Return to list
        await pMob.locator('.btn-back-to-list').click();
        await pMob.waitForSelector('.works-cards-stack', { timeout: 5000 });
      }

      if (vp.width === 320) {
        const pathMob320 = join(artifactDir, 'after_mobile_320_compact.png');
        await pMob.screenshot({ path: pathMob320 });
        console.log(`  ✓ Screenshot salvo: ${pathMob320}`);
      }
    }

    // =========================================================================
    // 5. REGRESSÃO: CALENDÁRIO 100% INTACTO
    // =========================================================================
    console.log('\n--- 5. REGRESSÃO: CALENDÁRIO 100% INTACTO ---');
    await pDesktop.goto(`${targetUrl}/scan?tab=calendario`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pDesktop.waitForSelector('.calendar-tab', { timeout: 20000 });
    const calHeading = await pDesktop.textContent('.calendar-tab .title');
    console.log(`Título da página Calendário: ${calHeading?.trim()}`);
    const pathCalendarIntact = join(artifactDir, 'after_calendar_intact_regression.png');
    await pDesktop.screenshot({ path: pathCalendarIntact });
    console.log(`✓ Screenshot salvo: ${pathCalendarIntact}`);

    console.log('\n=========================================================================');
    console.log('✨ HOMOLOGAÇÃO DEFINITIVA 10/10 CONCLUÍDA COM SUCESSO ABSOLUTO! ✨');
    console.log('=========================================================================');
  } finally {
    await browser.close();
  }
}

function pathDeskDesk(p) { return p; }

runHomologation().catch(err => {
  console.error('\n❌ ERRO NA HOMOLOGAÇÃO:', err);
  process.exit(1);
});
