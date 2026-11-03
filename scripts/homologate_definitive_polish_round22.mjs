import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { join } from 'node:path';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const scanId = '04872e99-37ad-4d45-aed4-35759d0eae33';

async function main() {
  console.log(`========================================================================`);
  console.log(`PROJECT NOX — RODADA 22: POLIMENTO VISUAL DEFINITIVO (10/10)`);
  console.log(`URL Alvo: ${targetUrl}`);
  console.log(`Artifact Dir: ${artifactDir}`);
  console.log(`========================================================================\n`);

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };

  function assert(title, condition, extra = '') {
    results.total++;
    if (condition) {
      results.passed++;
      console.log(`  ✓ [PASS] ${title} ${extra ? `(${extra})` : ''}`);
      results.tests.push({ title, status: 'PASS', extra });
    } else {
      results.failed++;
      console.error(`  ✗ [FAIL] ${title} ${extra ? `(${extra})` : ''}`);
      results.tests.push({ title, status: 'FAIL', extra });
    }
  }

  const adminCookies = await ownerCookies(targetUrl);
  adminCookies.push(
    { name: 'nox-age-status', value: 'ADULT', url: targetUrl, httpOnly: false, sameSite: 'Lax', secure: targetUrl.startsWith('https:') },
    { name: 'nox-blur-nsfw', value: 'false', url: targetUrl, httpOnly: false, sameSite: 'Lax', secure: targetUrl.startsWith('https:') }
  );

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    // -------------------------------------------------------------------------
    // 1. DESKTOP: VALIDAÇÃO DA LUPA E MODAL DE SOLICITAÇÃO (1440x900)
    // -------------------------------------------------------------------------
    console.log('\n--- 1. DESKTOP: MODAL SOLICITAR OBRA & CORREÇÃO DA LUPA ---');
    const ctxDesktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctxDesktop.addCookies(adminCookies);
    const pDesk = await ctxDesktop.newPage();

    await pDesk.goto(`${targetUrl}/scan?tab=obras`, { waitUntil: 'domcontentloaded' });
    await pDesk.waitForSelector('.works-cards-stack', { timeout: 30000 });
    await pDesk.waitForTimeout(1500);

    // Open Modal
    await pDesk.locator('.btn-action-primary:has-text("Solicitar Obra")').first().click();
    await pDesk.waitForSelector('.project-search-modal', { state: 'visible', timeout: 15000 });

    const searchInput = pDesk.locator('#proj-search-input');
    await searchInput.waitFor({ state: 'visible' });

    // Measure bounding box of search icon vs input left padding
    const inputMetrics = await pDesk.evaluate(() => {
      const input = document.querySelector('#proj-search-input');
      const icon = document.querySelector('.search-input-wrap .search-icon');
      const inputStyle = window.getComputedStyle(input);
      const iconRect = icon.getBoundingClientRect();
      const inputRect = input.getBoundingClientRect();

      return {
        paddingLeft: parseFloat(inputStyle.paddingLeft),
        iconLeftOffset: iconRect.left - inputRect.left,
        iconWidth: iconRect.width,
        iconRightOffset: (iconRect.left - inputRect.left) + iconRect.width,
        pointerEvents: window.getComputedStyle(icon).pointerEvents,
        borderColor: inputStyle.borderColor
      };
    });

    console.log('Métricas do Input e Lupa no Desktop:', inputMetrics);
    assert('Padding esquerdo do input é >= 40px', inputMetrics.paddingLeft >= 40, `${inputMetrics.paddingLeft}px`);
    assert('Lupa termina antes de 32px da borda esquerda', inputMetrics.iconRightOffset <= 32, `${inputMetrics.iconRightOffset}px`);
    assert('Espaço livre garantido entre lupa e texto digitado >= 8px', (inputMetrics.paddingLeft - inputMetrics.iconRightOffset) >= 8, `${inputMetrics.paddingLeft - inputMetrics.iconRightOffset}px`);
    assert('Lupa possui pointer-events: none (não bloqueia cliques)', inputMetrics.pointerEvents === 'none');

    // Type query "solo"
    await searchInput.fill('solo');
    await pDesk.waitForTimeout(500);

    // Check focus border
    const focusBorder = await pDesk.evaluate(() => {
      const input = document.querySelector('#proj-search-input');
      return window.getComputedStyle(input).borderColor;
    });
    console.log('Cor da borda em foco:', focusBorder);
    assert('Borda de foco do input é roxa (#8b5cf6 / rgb(139, 92, 246))', focusBorder.includes('139, 92, 246') || focusBorder.includes('139,92,246') || focusBorder.includes('rgb(139, 92, 246)'));

    // Capture screenshot of query "solo" with no overlap
    const shotLupaDesk = join(artifactDir, 'polish_01_desktop_lupa_solo_sem_sobreposicao.png');
    await pDesk.screenshot({ path: shotLupaDesk });
    console.log(`  ✓ Screenshot salvo: ${shotLupaDesk}`);

    // Type query "céu distante"
    await searchInput.fill('céu distante');
    await pDesk.waitForTimeout(600);
    const shotLupaCeu = join(artifactDir, 'polish_01_desktop_lupa_ceu_sem_sobreposicao.png');
    await pDesk.screenshot({ path: shotLupaCeu });
    console.log(`  ✓ Screenshot salvo: ${shotLupaCeu}`);

    // -------------------------------------------------------------------------
    // 2. VERIFICAÇÃO DE CAPAS E FALLBACKS NOS RESULTADOS
    // -------------------------------------------------------------------------
    console.log('\n--- 2. VERIFICAÇÃO DE CAPAS E FALLBACKS NOS RESULTADOS ---');
    await searchInput.fill('a');
    await pDesk.waitForSelector('.search-result-item', { timeout: 20000 });
    await pDesk.waitForTimeout(500);

    const coversCheck = await pDesk.evaluate(() => {
      const results = Array.from(document.querySelectorAll('.search-result-item'));
      return results.map(r => {
        const title = r.querySelector('.result-title')?.textContent?.trim();
        const img = r.querySelector('.result-cover-img');
        const fallback = r.querySelector('.result-cover-fallback');
        const imgStyle = img ? window.getComputedStyle(img) : null;
        const altTextHiddenByCss = imgStyle ? (parseFloat(imgStyle.fontSize) === 0 || imgStyle.color === 'transparent' || imgStyle.color.includes(', 0)')) : true;
        const altTextVisible = img ? (img.offsetWidth > 0 && img.naturalWidth === 0 && !altTextHiddenByCss) : false;
        return {
          title,
          hasImg: Boolean(img),
          hasFallback: Boolean(fallback),
          aspectRatio: window.getComputedStyle(r.querySelector('.result-cover-box')).aspectRatio,
          altTextVisible
        };
      });
    });

    console.log(`Total de resultados inspecionados: ${coversCheck.length}`);
    assert('Resultados possuem miniatura 3:4', coversCheck.every(c => c.aspectRatio.includes('3 / 4') || c.aspectRatio.includes('3/4') || c.aspectRatio === '0.75'));
    assert('Nenhuma miniatura exibe texto alternativo cortado', coversCheck.every(c => !c.altTextVisible));

    const shotResultsCovers = join(artifactDir, 'polish_02_desktop_resultados_capas_e_status.png');
    await pDesk.screenshot({ path: shotResultsCovers });
    console.log(`  ✓ Screenshot salvo: ${shotResultsCovers}`);

    // Close modal
    await pDesk.locator('.project-search-modal .btn-close-modal').click();
    await pDesk.waitForSelector('.project-search-modal', { state: 'hidden', timeout: 5000 });

    // -------------------------------------------------------------------------
    // 3. DESKTOP: FILTROS E ORDENAÇÃO COMPACTA (1440x900)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. DESKTOP: FILTROS E ORDENAÇÃO COMPACTA ---');
    const toolbarLayoutDesk = await pDesk.evaluate(() => {
      const tb = document.querySelector('.obras-filter-toolbar');
      const searchBox = document.querySelector('.search-input-box');
      const pills = document.querySelector('.status-pills-strip');
      const sorter = document.querySelector('.sorter-select-box');
      const tbRect = tb.getBoundingClientRect();
      const sRect = searchBox.getBoundingClientRect();
      const pRect = pills.getBoundingClientRect();
      const sortRect = sorter.getBoundingClientRect();

      return {
        isSingleRow: Math.abs(sRect.top - pRect.top) < 15 && Math.abs(pRect.top - sortRect.top) < 15,
        tbWidth: tbRect.width
      };
    });

    assert('Desktop organiza pesquisa, filtros e ordenação horizontalmente compactos', toolbarLayoutDesk.isSingleRow);
    const shotToolbarDesk = join(artifactDir, 'polish_03_desktop_toolbar_filtros_ordenacao.png');
    await pDesk.screenshot({ path: shotToolbarDesk });
    console.log(`  ✓ Screenshot salvo: ${shotToolbarDesk}`);

    // -------------------------------------------------------------------------
    // 4. LEVEL 2 MANAGEMENT: DESKTOP (1440x900)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. LEVEL 2: GERENCIAMENTO DE OBRA NO DESKTOP ---');
    await pDesk.locator('.btn-manage-work').first().click();
    await pDesk.waitForSelector('.work-manage-workspace', { timeout: 10000 });
    await pDesk.waitForTimeout(400);

    const kpiDesk = await pDesk.evaluate(() => {
      const grid = document.querySelector('.kpi-metrics-grid');
      const cards = Array.from(document.querySelectorAll('.kpi-metric-card'));
      return {
        columnsCount: window.getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        cardsCount: cards.length
      };
    });

    assert('Desktop exibe os 4 indicadores em linha única (4 colunas)', kpiDesk.columnsCount === 4 && kpiDesk.cardsCount === 4);
    const shotManageDesk = join(artifactDir, 'polish_04_desktop_manage_4_kpis_horizontal.png');
    await pDesk.screenshot({ path: shotManageDesk });
    console.log(`  ✓ Screenshot salvo: ${shotManageDesk}`);

    // Back to list
    await pDesk.locator('.btn-back-to-list').click();
    await pDesk.waitForSelector('.works-cards-stack', { timeout: 10000 });
    await pDesk.waitForTimeout(300);

    // -------------------------------------------------------------------------
    // 5. MOBILE ANDROID VIEWPORTS (320px, 360px, 390px, 430px)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. MOBILE ANDROID: VIEWPORTS E TESTES ERGONÔMICOS ---');
    const mobileViewports = [
      { name: '320px (Compact Fold)', width: 320, height: 650 },
      { name: '360px (Standard Android)', width: 360, height: 780 },
      { name: '390px (Pixel/iPhone Standard)', width: 390, height: 844 },
      { name: '430px (Max Flagship)', width: 430, height: 932 }
    ];

    for (const vp of mobileViewports) {
      console.log(`\nTestando Mobile ${vp.name}...`);
      await pDesk.setViewportSize({ width: vp.width, height: vp.height });
      await pDesk.waitForTimeout(500);

      // 5.1 Main list & 3-tier filter toolbar
      const overflowList = await pDesk.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      }));
      assert(`Mobile ${vp.width}px: zero overflow horizontal na listagem principal`, !overflowList.hasOverflow);

      // Verify 3-tier mobile toolbar: Row 1 = search, Row 2 = pills, Row 3 = sorter
      const toolbarMobile = await pDesk.evaluate(() => {
        const searchBox = document.querySelector('.search-input-box');
        const pills = document.querySelector('.status-pills-strip');
        const sorter = document.querySelector('.sorter-select-box');
        const sRect = searchBox.getBoundingClientRect();
        const pRect = pills.getBoundingClientRect();
        const sortRect = sorter.getBoundingClientRect();

        return {
          row1BeforeRow2: sRect.bottom <= pRect.top + 5,
          row2BeforeRow3: pRect.bottom <= sortRect.top + 5,
          sorterWidth: sortRect.width
        };
      });

      assert(`Mobile ${vp.width}px: Toolbar organizada em 3 linhas separadas (Busca -> Pílulas -> Ordenação)`, toolbarMobile.row1BeforeRow2 && toolbarMobile.row2BeforeRow3);

      const shotListMob = join(artifactDir, `polish_05_mobile_${vp.width}_listagem_toolbar_3_linhas.png`);
      await pDesk.screenshot({ path: shotListMob });
      console.log(`  ✓ Screenshot salvo: ${shotListMob}`);

      // 5.2 Modal Solicitar Obra on Mobile
      await pDesk.locator('.btn-action-primary:has-text("Solicitar Obra")').first().click();
      await pDesk.waitForSelector('.project-search-modal', { state: 'visible', timeout: 15000 });
      await pDesk.waitForTimeout(500);

      // Measure mobile search input & lupa
      const mobInputMetrics = await pDesk.evaluate(() => {
        const input = document.querySelector('#proj-search-input');
        const icon = document.querySelector('.search-input-wrap .search-icon');
        const inputStyle = window.getComputedStyle(input);
        const iconRect = icon.getBoundingClientRect();
        const inputRect = input.getBoundingClientRect();

        return {
          paddingLeft: parseFloat(inputStyle.paddingLeft),
          iconRightOffset: (iconRect.left - inputRect.left) + iconRect.width,
          gap: parseFloat(inputStyle.paddingLeft) - ((iconRect.left - inputRect.left) + iconRect.width),
          modalHeight: document.querySelector('.project-search-modal').offsetHeight,
          viewportHeight: window.innerHeight
        };
      });

      assert(`Mobile ${vp.width}px: Input possui padding esquerdo >= 40px`, mobInputMetrics.paddingLeft >= 40, `${mobInputMetrics.paddingLeft}px`);
      assert(`Mobile ${vp.width}px: Lupa não sobrepõe texto (gap >= 8px)`, mobInputMetrics.gap >= 8, `${mobInputMetrics.gap}px`);
      assert(`Mobile ${vp.width}px: Modal cabe perfeitamente na viewport`, mobInputMetrics.modalHeight <= mobInputMetrics.viewportHeight);

      // Type "solo" on mobile and wait for search results
      await pDesk.locator('#proj-search-input').fill('solo');
      await pDesk.waitForSelector('.search-result-item', { timeout: 25000 });
      await pDesk.waitForTimeout(400);

      const shotModalMobSolo = join(artifactDir, `polish_06_mobile_${vp.width}_modal_lupa_solo.png`);
      await pDesk.screenshot({ path: shotModalMobSolo });
      console.log(`  ✓ Screenshot salvo: ${shotModalMobSolo}`);

      const mobResultsMetrics = await pDesk.evaluate(() => {
        const item = document.querySelector('.search-result-item');
        const title = item?.querySelector('.result-title');
        const badge = item?.querySelector('.result-badge');
        const info = item?.querySelector('.result-info-box');
        const tRect = title?.getBoundingClientRect();
        const bRect = badge?.getBoundingClientRect();
        const iRect = info?.getBoundingClientRect();

        return {
          titleWidth: tRect?.width || 0,
          infoWidth: iRect?.width || 0,
          badgeBelowTitle: bRect ? (bRect.top >= (tRect?.bottom || 0) - 2) : false
        };
      });

      console.log(`Mobile ${vp.width}px resultados: titleWidth=${mobResultsMetrics.titleWidth}px, infoWidth=${mobResultsMetrics.infoWidth}px, badgeBelow=${mobResultsMetrics.badgeBelowTitle}`);
      assert(`Mobile ${vp.width}px: Título não é esmagado pelo badge (wrap inteligente ativo)`, mobResultsMetrics.badgeBelowTitle || mobResultsMetrics.titleWidth >= 120);

      const shotModalMobResults = join(artifactDir, `polish_07_mobile_${vp.width}_modal_resultados_wrap.png`);
      await pDesk.screenshot({ path: shotModalMobResults });
      console.log(`  ✓ Screenshot salvo: ${shotModalMobResults}`);

      // Close modal
      await pDesk.locator('.project-search-modal .btn-close-modal').click();
      await pDesk.waitForSelector('.project-search-modal', { state: 'hidden', timeout: 5000 });

      // 5.3 Level 2 Management on Mobile: 2x2 KPIs & 2x2 Status Options
      await pDesk.locator('.btn-manage-work').first().click();
      await pDesk.waitForSelector('.work-manage-workspace', { timeout: 10000 });
      await pDesk.waitForTimeout(400);

      const mobManageLayout = await pDesk.evaluate(() => {
        const kpiGrid = document.querySelector('.kpi-metrics-grid');
        const statusGrid = document.querySelector('.status-options-grid');
        const radioCards = Array.from(document.querySelectorAll('.status-radio-card'));

        const kpiCols = window.getComputedStyle(kpiGrid).gridTemplateColumns.split(' ').length;
        const statusCols = window.getComputedStyle(statusGrid).gridTemplateColumns.split(' ').length;

        const touchTargetsOk = radioCards.every(r => r.getBoundingClientRect().height >= 43.5);

        return {
          kpiCols,
          statusCols,
          touchTargetsOk,
          radioHeights: radioCards.map(r => r.getBoundingClientRect().height)
        };
      });

      assert(`Mobile ${vp.width}px: 4 KPIs distribuídos em grade 2 colunas x 2 linhas`, mobManageLayout.kpiCols === 2);
      assert(`Mobile ${vp.width}px: 4 Opções de status distribuídas em grade 2x2 visíveis integralmente`, mobManageLayout.statusCols === 2);
      assert(`Mobile ${vp.width}px: Controles de status possuem touch target >= 44px`, mobManageLayout.touchTargetsOk);

      const shotManageMob = join(artifactDir, `polish_08_mobile_${vp.width}_manage_kpis_status_2x2.png`);
      await pDesk.screenshot({ path: shotManageMob });
      console.log(`  ✓ Screenshot salvo: ${shotManageMob}`);

      // Back to list
      await pDesk.locator('.btn-back-to-list').click();
      await pDesk.waitForSelector('.works-cards-stack', { timeout: 10000 });
      await pDesk.waitForTimeout(400);
    }

    // -------------------------------------------------------------------------
    // 6. VALIDAÇÃO DE PERMISSÕES & GESTÃO DA SCAN
    // -------------------------------------------------------------------------
    console.log('\n--- 6. VALIDAÇÃO DE PERMISSÕES & GERENTE DO SITE ---');
    const pAdmin = await ctxDesktop.newPage();
    await pAdmin.goto(`${targetUrl}/admin/tickets?tab=obras`, { waitUntil: 'domcontentloaded' });
    await pAdmin.waitForSelector('.tab-panel', { timeout: 15000 });

    const adminTicketsView = await pAdmin.evaluate(() => {
      const activeTabBtn = document.querySelector('.tab-btn.active');
      const statsCards = document.querySelectorAll('.stat-card');
      const filterPills = document.querySelectorAll('.tab-panel .filter-pill');

      return {
        activeTabTitle: activeTabBtn?.textContent?.trim(),
        statsCount: statsCards.length,
        pillsCount: filterPills.length
      };
    });

    assert('Central de Tickets abre aba Adesão de Obras para liderança do site', adminTicketsView.activeTabTitle?.includes('Adesão de Obras'));
    assert('Grid de estatísticas de Adesão de Obras possui 4 cards', adminTicketsView.statsCount === 4);
    assert('Filtros rápidos (Pendentes, Aprovadas, Recusadas, Todas) presentes', adminTicketsView.pillsCount === 4);

    const shotAdminTicketsPolish = join(artifactDir, 'polish_09_desktop_admin_tickets_obras_tab.png');
    await pAdmin.screenshot({ path: shotAdminTicketsPolish });
    console.log(`  ✓ Screenshot salvo: ${shotAdminTicketsPolish}`);

    console.log(`\n========================================================================`);
    console.log(`RELATÓRIO DE HOMOLOGAÇÃO DO POLIMENTO DEFINITIVO`);
    console.log(`Total de testes: ${results.total}`);
    console.log(`Passaram: ${results.passed}`);
    console.log(`Falharam: ${results.failed}`);
    console.log(`Taxa de Sucesso: ${((results.passed / results.total) * 100).toFixed(1)}%`);
    console.log(`========================================================================\n`);

    if (results.failed > 0) {
      process.exit(1);
    }
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Erro fatal na homologação do polimento:', err);
  process.exit(1);
});
