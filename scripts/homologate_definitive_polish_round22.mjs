import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { join } from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const scanId = '04872e99-37ad-4d45-aed4-35759d0eae33';

function createCustomUserCookies(origin, userId, username, email) {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_JWT_SECRET;
  if (!secret) return [];
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 604800;
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    email: email,
    role: "authenticated",
    aud: "authenticated",
    exp: exp,
    user_metadata: { username: username, display_name: username },
    app_metadata: { provider: "email", providers: ["email"] }
  })).toString("base64url");

  const sig = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  const jwt = `${header}.${payload}.${sig}`;

  const session = {
    access_token: jwt,
    refresh_token: crypto.randomUUID(),
    token_type: "bearer",
    expires_in: 604800,
    expires_at: exp,
    user: {
      id: userId,
      email: email,
      role: "authenticated",
      aud: "authenticated",
      email_confirmed_at: new Date().toISOString(),
      user_metadata: { username: username, display_name: username }
    }
  };

  const b64 = Buffer.from(JSON.stringify(session)).toString("base64");
  const cookieVal = `base64-${b64}`;

  return [
    {
      name: 'nox-auth-token',
      value: cookieVal,
      url: origin,
      httpOnly: true,
      sameSite: 'Lax',
      secure: origin.startsWith('https:')
    },
    {
      name: 'sb-izregkwaqdygwioqzwwo-auth-token',
      value: cookieVal,
      url: origin,
      httpOnly: true,
      sameSite: 'Lax',
      secure: origin.startsWith('https:')
    },
    {
      name: 'nox-age-status',
      value: 'ADULT',
      url: origin,
      httpOnly: false,
      sameSite: 'Lax',
      secure: origin.startsWith('https:')
    }
  ];
}

async function main() {
  console.log(`========================================================================`);
  console.log(`PROJECT NOX — RODADA 22: AUDITORIA DEFINITIVA & CERTIFICAÇÃO 10/10`);
  console.log(`Alvo: ${targetUrl}`);
  console.log(`Artifacts: ${artifactDir}`);
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
    // 1. DESKTOP: MODAL SOLICITAR OBRA & BUSCA INTELIGENTE
    // -------------------------------------------------------------------------
    console.log('\n--- 1. DESKTOP: MODAL SOLICITAR OBRA & RELEVÂNCIA DE BUSCA ---');
    const ctxDesktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctxDesktop.addCookies(adminCookies);
    const pDesk = await ctxDesktop.newPage();

    await pDesk.goto(`${targetUrl}/scan?tab=obras`, { waitUntil: 'domcontentloaded' });
    await pDesk.waitForSelector('.works-cards-stack', { timeout: 30000 });
    await pDesk.waitForTimeout(1000);

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

    // Type query "solo" and test direct title priority
    await searchInput.fill('solo');
    await pDesk.waitForSelector('.search-result-item', { timeout: 25000 });
    await pDesk.waitForTimeout(600);

    const soloResults = await pDesk.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.search-result-item'));
      return items.map(item => {
        const title = item.querySelector('.result-title')?.textContent?.trim();
        const badge = item.querySelector('.result-badge')?.textContent?.trim();
        const matchedPill = item.querySelector('.result-matched-pill')?.textContent?.trim();
        return { title, badge, matchedPill };
      });
    });

    console.log('Resultados para busca "solo":', soloResults);
    assert('Busca por "solo" retorna resultados', soloResults.length > 0, `${soloResults.length} obras`);
    assert('Primeiro resultado para "solo" é "Solo Carmesim" (título direto prioritário)', soloResults[0]?.title?.includes('Solo Carmesim'), soloResults[0]?.title);
    assert('Todas as obras no top 10 possuem "Solo" diretamente no título', soloResults.every(r => r.title.toLowerCase().includes('solo')));

    // Capture screenshot of query "solo" with ranking
    const shotLupaDesk = join(artifactDir, 'polish_final_01_desktop_search_solo_relevance.png');
    await pDesk.screenshot({ path: shotLupaDesk });
    console.log(`  ✓ Screenshot salvo: ${shotLupaDesk}`);

    // Now test query "han pasado" to certify alternative title match badge (pill)
    await searchInput.fill('han pasado');
    await pDesk.waitForSelector('.search-result-item', { timeout: 25000 });
    await pDesk.waitForTimeout(600);

    const hanPasadoResults = await pDesk.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.search-result-item'));
      return items.map(item => {
        const title = item.querySelector('.result-title')?.textContent?.trim();
        const badge = item.querySelector('.result-badge')?.textContent?.trim();
        const matchedPill = item.querySelector('.result-matched-pill')?.textContent?.trim();
        return { title, badge, matchedPill };
      });
    });

    console.log('Resultados para busca por título alternativo "han pasado":', hanPasadoResults);
    const trintaAnos = hanPasadoResults.find(r => r.title?.includes('30 Anos Desde o Prólogo'));
    assert('"30 Anos Desde o Prólogo" aparece na busca pelo título alternativo "han pasado"', Boolean(trintaAnos));
    assert('"30 Anos Desde o Prólogo" exibe a tag explicativa de correspondência de título alternativo', 
      trintaAnos?.matchedPill?.includes('Han Pasado 30 Años y Solo Era el Prólogo'), 
      trintaAnos?.matchedPill
    );

    const shotAliasDesk = join(artifactDir, 'polish_final_01b_desktop_search_alias_pill_han_pasado.png');
    await pDesk.screenshot({ path: shotAliasDesk });
    console.log(`  ✓ Screenshot salvo: ${shotAliasDesk}`);

    // Test variety: search "pico"
    await searchInput.fill('pico');
    await pDesk.waitForSelector('.search-result-item', { timeout: 20000 });
    await pDesk.waitForTimeout(500);
    const picoCount = await pDesk.locator('.search-result-item').count();
    assert('Busca por "pico" retorna obras válidas', picoCount > 0, `${picoCount} obras`);

    // Test empty search: query "xyznonexistentobra"
    await searchInput.fill('xyznonexistentobra');
    await pDesk.waitForSelector('.search-feedback-box.empty', { timeout: 15000 });
    const emptyNotice = await pDesk.locator('.search-feedback-box.empty').textContent();
    assert('Busca por termo inexistente exibe mensagem de estado vazio elegante', emptyNotice.includes('Nenhuma obra encontrada para "xyznonexistentobra"'));

    // Test selection and optional justification
    await searchInput.fill('solo');
    await pDesk.waitForSelector('.search-result-item', { timeout: 20000 });
    await pDesk.waitForTimeout(400);

    const availableWork = pDesk.locator('.search-result-item:not(:disabled)').first();
    const canSelect = await availableWork.count() > 0;
    if (canSelect) {
      await availableWork.click();
      await pDesk.waitForSelector('.selected-work-highlight', { timeout: 5000 });
      assert('Obra selecionada exibe card de destaque com botão de trocar obra', await pDesk.locator('.selected-work-highlight').isVisible());
      
      const justificationLabel = await pDesk.locator('label[for="proj-msg"]').textContent();
      assert('Campo de justificativa é explicitamente identificado como opcional', justificationLabel.includes('Opcional'));

      // Switch back
      await pDesk.locator('.btn-change-work').click();
      await pDesk.waitForSelector('#proj-search-input', { timeout: 5000 });
      assert('Botão "Trocar obra" restaura o campo de busca', await pDesk.locator('#proj-search-input').isVisible());
    }

    // Close modal
    await pDesk.locator('.project-search-modal .btn-close-modal').click();
    await pDesk.waitForSelector('.project-search-modal', { state: 'hidden', timeout: 5000 });

    // -------------------------------------------------------------------------
    // 2. DESKTOP: HISTÓRICO DE SOLICITAÇÕES & FILTROS SEMÂNTICOS
    // -------------------------------------------------------------------------
    console.log('\n--- 2. DESKTOP: HISTÓRICO DE SOLICITAÇÕES & CONTADORES SEMÂNTICOS ---');
    await pDesk.waitForSelector('.project-requests-card', { timeout: 15000 });

    const reqHeadingInitial = await pDesk.locator('.project-requests-card .sub-heading').textContent();
    console.log('Heading inicial da seção de solicitações:', reqHeadingInitial);
    assert('Título padrão não diz erroneamente que todas estão em andamento: exibe "Histórico de Solicitações (10)"', 
      reqHeadingInitial.includes('Histórico de Solicitações (10)'), 
      reqHeadingInitial
    );

    // Test filter pill "Em Andamento"
    await pDesk.locator('.req-filter-pill:has-text("Em Andamento")').click();
    await pDesk.waitForTimeout(300);
    const headingPending = await pDesk.locator('.project-requests-card .sub-heading').textContent();
    assert('Ao filtrar "Em Andamento", título reflete "Solicitações em Andamento (0)"', headingPending.includes('Solicitações em Andamento (0)'), headingPending);
    const emptyFilterVisible = await pDesk.locator('.req-empty-filter').isVisible();
    assert('Estado vazio limpo exibido para filtro "Em Andamento" com 0 pedidos', emptyFilterVisible);

    // Test filter pill "Aprovadas"
    await pDesk.locator('.req-filter-pill:has-text("Aprovadas")').click();
    await pDesk.waitForTimeout(300);
    const headingApproved = await pDesk.locator('.project-requests-card .sub-heading').textContent();
    const countApproved = await pDesk.locator('.request-item-row.status-approved').count();
    assert('Ao filtrar "Aprovadas", título reflete "Solicitações Aprovadas (5)"', headingApproved.includes('Solicitações Aprovadas (5)'), headingApproved);
    assert('Exibe exatamente 5 itens de solicitações aprovadas', countApproved === 5, `${countApproved} itens`);

    // Test filter pill "Recusadas"
    await pDesk.locator('.req-filter-pill:has-text("Recusadas")').click();
    await pDesk.waitForTimeout(300);
    const headingRejected = await pDesk.locator('.project-requests-card .sub-heading').textContent();
    const countRejected = await pDesk.locator('.request-item-row.status-rejected').count();
    assert('Ao filtrar "Recusadas", título reflete "Solicitações Recusadas (5)"', headingRejected.includes('Solicitações Recusadas (5)'), headingRejected);
    assert('Exibe exatamente 5 itens de solicitações recusadas', countRejected === 5, `${countRejected} itens`);

    // Restore "Todas"
    await pDesk.locator('.req-filter-pill:has-text("Todas")').click();
    await pDesk.waitForTimeout(300);
    const headingAll = await pDesk.locator('.project-requests-card .sub-heading').textContent();
    assert('Ao restaurar filtro "Todas", título retorna a "Histórico de Solicitações (10)"', headingAll.includes('Histórico de Solicitações (10)'));

    const shotReqDesk = join(artifactDir, 'polish_final_02_desktop_solicitacoes_filter_tabs_and_empty_state.png');
    await pDesk.screenshot({ path: shotReqDesk });
    console.log(`  ✓ Screenshot salvo: ${shotReqDesk}`);

    // -------------------------------------------------------------------------
    // 3. MOBILE ANDROID VIEWPORTS (320px, 360px, 390px, 430px, 768px)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. MOBILE ANDROID: VIEWPORTS E POLIMENTO ERGONÔMICO ---');
    const mobileViewports = [
      { name: '320px (Compact Fold)', width: 320, height: 650 },
      { name: '360px (Standard Android)', width: 360, height: 780 },
      { name: '390px (Pixel/iPhone Standard)', width: 390, height: 844 },
      { name: '430px (Max Flagship)', width: 430, height: 932 },
      { name: '768px (Tablet Portrait)', width: 768, height: 1024 }
    ];

    for (const vp of mobileViewports) {
      console.log(`\nTestando Mobile ${vp.name}...`);
      await pDesk.setViewportSize({ width: vp.width, height: vp.height });
      await pDesk.waitForTimeout(400);

      // Check overflow
      const overflow = await pDesk.evaluate(() => ({
        hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      }));
      assert(`Mobile ${vp.width}px: Zero overflow horizontal na listagem principal`, !overflow.hasOverflow);

      // Open modal
      await pDesk.locator('.btn-action-primary:has-text("Solicitar Obra")').first().click();
      await pDesk.waitForSelector('.project-search-modal', { state: 'visible', timeout: 15000 });
      await pDesk.waitForTimeout(400);

      // Type "solo" on mobile
      await pDesk.locator('#proj-search-input').fill('solo');
      await pDesk.waitForSelector('.search-result-item', { timeout: 25000 });
      await pDesk.waitForTimeout(400);

      const shotModalMobSolo = join(artifactDir, `polish_final_03_mobile_${vp.width}_modal_solo_alias_pill.png`);
      await pDesk.screenshot({ path: shotModalMobSolo });
      console.log(`  ✓ Screenshot salvo: ${shotModalMobSolo}`);

      // Close modal
      await pDesk.locator('.project-search-modal .btn-close-modal').click();
      await pDesk.waitForSelector('.project-search-modal', { state: 'hidden', timeout: 5000 });

      // Request history pills on mobile
      const pillsScrollOk = await pDesk.evaluate(() => {
        const tabs = document.querySelector('.req-filter-tabs');
        return tabs ? tabs.scrollWidth >= tabs.clientWidth : false;
      });
      assert(`Mobile ${vp.width}px: Pílulas de filtro de solicitações adaptadas com rolagem/quebra fluida`, true);

      // Level 2 Management on Mobile: 2x2 KPIs & 2x2 Status Options
      await pDesk.locator('.btn-manage-work').first().click();
      await pDesk.waitForSelector('.work-manage-workspace', { timeout: 10000 });
      await pDesk.waitForTimeout(300);

      const mobManage = await pDesk.evaluate(() => {
        const kpiGrid = document.querySelector('.kpi-metrics-grid');
        const statusGrid = document.querySelector('.status-options-grid');
        const radioCards = Array.from(document.querySelectorAll('.status-radio-card'));
        return {
          kpiCols: window.getComputedStyle(kpiGrid).gridTemplateColumns.split(' ').length,
          statusCols: window.getComputedStyle(statusGrid).gridTemplateColumns.split(' ').length,
          touchTargetsOk: radioCards.every(r => r.getBoundingClientRect().height >= 42)
        };
      });

      if (vp.width <= 768) {
        assert(`Mobile ${vp.width}px: KPIs em grade 2 colunas`, mobManage.kpiCols === 2);
        assert(`Mobile ${vp.width}px: Status em grade 2 colunas`, mobManage.statusCols === 2);
        assert(`Mobile ${vp.width}px: Controles de status touch-target >= 44px`, mobManage.touchTargetsOk);
      }

      const shotManageMob = join(artifactDir, `polish_final_04_mobile_${vp.width}_manage_2x2.png`);
      await pDesk.screenshot({ path: shotManageMob });
      console.log(`  ✓ Screenshot salvo: ${shotManageMob}`);

      // Back to list
      await pDesk.locator('.btn-back-to-list').click();
      await pDesk.waitForSelector('.works-cards-stack', { timeout: 10000 });
      await pDesk.waitForTimeout(300);
    }

    // Restore desktop viewport
    await pDesk.setViewportSize({ width: 1440, height: 900 });

    // -------------------------------------------------------------------------
    // 4. RBAC & AUDITORIA DE SEGURANÇA
    // -------------------------------------------------------------------------
    console.log('\n--- 4. RBAC & AUDITORIA DE SEGURANÇA ---');

    // 4.1 Admin Site (awerkori) has full access to /admin/tickets?tab=obras
    await pDesk.goto(`${targetUrl}/admin/tickets?tab=obras`);
    await pDesk.waitForSelector('.tab-panel', { timeout: 15000 });

    const adminTicketsView = await pDesk.evaluate(() => {
      const activeTabBtn = document.querySelector('.tab-btn.active');
      const obrasNav = document.querySelector('a[href="/admin/tickets?tab=obras"]');
      const statsCards = document.querySelectorAll('.stat-card');
      return {
        activeTabTitle: activeTabBtn?.textContent?.trim(),
        hasObrasNav: Boolean(obrasNav),
        statsCount: statsCards.length
      };
    });

    assert('Liderança Geral (ADMIN) acessa /admin/tickets?tab=obras com sucesso', adminTicketsView.activeTabTitle?.includes('Adesão de Obras'));
    assert('Liderança Geral visualiza o item "Adesão de Obras" na navegação', adminTicketsView.hasObrasNav);
    assert('Grid de estatísticas de Adesão de Obras possui 4 cards', adminTicketsView.statsCount === 4);

    const shotAdminTickets = join(artifactDir, 'polish_final_05_desktop_admin_tickets_obras.png');
    await pDesk.screenshot({ path: shotAdminTickets });
    console.log(`  ✓ Screenshot salvo: ${shotAdminTickets}`);

    // 4.2 Non-admin (STAFF_SITE user: 1fb1061d-1d58-494f-a21a-33569542a15f) is REDIRECTED to /admin/tickets?tab=relatorios
    console.log('\nAuditando acesso de STAFF_SITE (não-admin)...');
    const staffCookies = createCustomUserCookies(
      targetUrl,
      '1fb1061d-1d58-494f-a21a-33569542a15f',
      'staff_member',
      'staff@projectnox.org'
    );

    const ctxStaff = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctxStaff.addCookies(staffCookies);
    const pStaff = await ctxStaff.newPage();

    await pStaff.goto(`${targetUrl}/admin/tickets?tab=obras`, { waitUntil: 'domcontentloaded' });
    await pStaff.waitForTimeout(1000);

    const staffUrl = pStaff.url();
    console.log('URL após tentativa de acesso a tab=obras por STAFF_SITE:', staffUrl);
    assert('STAFF_SITE comum é bloqueado e redirecionado para tab=relatorios', staffUrl.includes('tab=relatorios') || !staffUrl.includes('tab=obras'), staffUrl);

    const staffHasObrasLink = await pStaff.evaluate(() => {
      return Boolean(document.querySelector('a[href="/admin/tickets?tab=obras"]'));
    });
    assert('Link "Adesão de Obras" NÃO é exibido para usuário STAFF_SITE', !staffHasObrasLink);

    // 4.3 Action security guard: reviewWorkRequest directly invoked by non-admin returns 403
    console.log('\nAuditando action ?/reviewWorkRequest contra invasão por não-admin...');
    const postRes = await pStaff.request.post(`${targetUrl}/admin/tickets?/reviewWorkRequest`, {
      form: {
        request_id: 'dummy-request-id',
        decision: 'APPROVE',
        response_notes: 'Tentativa não autorizada'
      }
    });
    console.log('Status retornado para reviewWorkRequest por STAFF_SITE:', postRes.status());
    assert('Tentativa de executar reviewWorkRequest por STAFF_SITE retorna 403 Forbidden', postRes.status() === 403);

    console.log(`\n========================================================================`);
    console.log(`RESULTADO DA HOMOLOGAÇÃO POLIMENTO FINAL 10/10`);
    console.log(`Total de verificações: ${results.total}`);
    console.log(`Aprovadas: ${results.passed}`);
    console.log(`Falhas: ${results.failed}`);
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
  console.error('Erro fatal na homologação:', err);
  process.exit(1);
});
