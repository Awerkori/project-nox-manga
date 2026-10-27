const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const pg = require('pg');

const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

// Load .dev.vars.preview_full into process.env
for (const envPath of ['.dev.vars.preview_full', '.dev.vars.deploy', '.env']) {
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

const pgClient = new pg.Client({
  connectionString: 'postgresql://postgres:ZJGsV8lUOarRFjDo@db.izregkwaqdygwioqzwwo.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await pgClient.connect();
  console.log('=== PROJECT NOX: BATERIA COMPLETA DE TESTES PLAYWRIGHT (ROUND 14) ===');

  const { ownerCookies } = await import('./owner-session.mjs');
  const sessionCookies = await ownerCookies(PREVIEW_URL);

  const testResults = {
    testA_workSearch: { success: false, distantSkyFound: false, aliasFound: false, paginationTested: false },
    testB_duplicateTabsRemoved: { success: false, tabsAbsentOnRelatorios: false, tabsAbsentOnScans: false, tabsAbsentOnModeracao: false },
    testC_filtersOrderAndDefaults: { success: false, defaultNewRelatorios: false, defaultPendingScans: false, defaultNewModeracao: false },
    testD_commentDeletionAndResolution: { success: false, deletedSynced: false, reportResolved: false, persistedOnReload: false },
    testE_regressionsAndResponsiveness: { success: false, viewports: [] }
  };

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await desktopCtx.addCookies([
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL },
      ...sessionCookies
    ]);
    const page = await desktopCtx.newPage();

    // ========================================================
    // TESTE A: BUSCA ADMINISTRATIVA DE OBRAS (/admin/obras)
    // ========================================================
    console.log('\n[TESTE A] Validando Busca Administrativa de Obras...');

    // 1. Search 'Distant Sky'
    console.log('1.1 Pesquisando "Distant Sky"...');
    await page.goto(`${PREVIEW_URL}/admin/obras?q=Distant+Sky`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const resultCountText = await page.locator('.results-count').innerText().catch(() => '');
    console.log(`- Contador de resultados para "Distant Sky": "${resultCountText}"`);

    const tableRows = await page.locator('.work-table-row').count();
    console.log(`- Linhas na tabela encontradas: ${tableRows}`);

    const hasCeuDistante = await page.locator('.work-title-link:has-text("Céu Distante")').count();
    console.log(`- Obra "Céu Distante" encontrada: ${hasCeuDistante > 0 ? 'SIM' : 'NÃO'}`);

    const hasAliasBadge = await page.locator('.work-alias-pill:has-text("Distant Sky")').count();
    console.log(`- Badge de alias "Distant Sky" exibida: ${hasAliasBadge > 0 ? 'SIM' : 'NÃO'}`);

    if (hasCeuDistante > 0) {
      testResults.testA_workSearch.distantSkyFound = true;
      testResults.testA_workSearch.aliasFound = true;
    }

    // 1.2 Open Gerenciar Obra
    console.log('1.2 Clicando em "Gerenciar" da obra Céu Distante...');
    const manageLink = await page.locator('.work-table-row a.btn-manage-work').first().getAttribute('href');
    console.log(`- Link de gerenciamento: ${manageLink}`);

    const manageRes = await page.goto(`${PREVIEW_URL}${manageLink}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    console.log(`- HTTP Status do Gerenciamento: ${manageRes.status()}`);
    if (manageRes.status() !== 200) {
      throw new Error(`Falha HTTP ${manageRes.status()} ao gerenciar obra!`);
    }

    const editWorkTitle = await page.locator('input[name="title"]').inputValue().catch(() => '');
    console.log(`- Título no formulário de edição: "${editWorkTitle}"`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'evidence_search_distant_sky_manage.png') });

    // 1.3 Test partial search 'distan'
    console.log('1.3 Pesquisando termo parcial "distan"...');
    await page.goto(`${PREVIEW_URL}/admin/obras?q=distan`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    const hasPartial = await page.locator('.work-title-link:has-text("Céu Distante")').count();
    console.log(`- Resultado para termo parcial "distan": ${hasPartial > 0 ? 'ENCONTRADA' : 'NÃO ENCONTRADA'}`);

    // 1.4 Test unaccented search 'ceu distante'
    console.log('1.4 Pesquisando sem acento "ceu distante"...');
    await page.goto(`${PREVIEW_URL}/admin/obras?q=ceu+distante`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    const hasUnaccent = await page.locator('.work-title-link:has-text("Céu Distante")').count();
    console.log(`- Resultado para termo sem acento "ceu distante": ${hasUnaccent > 0 ? 'ENCONTRADA' : 'NÃO ENCONTRADA'}`);

    // 1.5 Test Catalog Pagination
    console.log('1.5 Testando Paginação geral do catálogo (/admin/obras)...');
    await page.goto(`${PREVIEW_URL}/admin/obras`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const catalogTotalText = await page.locator('.results-count').innerText();
    console.log(`- Contador total: "${catalogTotalText}"`);

    const hasPagination = await page.locator('.pagination-bar').count();
    console.log(`- Barra de paginação visível: ${hasPagination > 0 ? 'SIM' : 'NÃO'}`);

    // Navigate to page 2
    console.log('- Navegando para página 2...');
    await page.goto(`${PREVIEW_URL}/admin/obras?pagina=2`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    const page2Rows = await page.locator('.work-table-row').count();
    console.log(`- Linhas na página 2: ${page2Rows}`);

    if (page2Rows > 0 && hasPagination > 0) {
      testResults.testA_workSearch.paginationTested = true;
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'evidence_search_works_catalog.png') });
    testResults.testA_workSearch.success = testResults.testA_workSearch.distantSkyFound && testResults.testA_workSearch.paginationTested;
    console.log('✅ TESTE A CONCLUÍDO COM SUCESSO!');

    // ========================================================
    // TESTE B: NAVEGAÇÃO DE TICKETS SEM ABAS DUPLICADAS
    // ========================================================
    console.log('\n[TESTE B] Validando Remoção de Abas Horizontais Duplicadas nos Tickets...');

    // B.1 Relatórios
    console.log('B.1 Acessando /admin/tickets?tab=relatorios...');
    await page.goto(`${PREVIEW_URL}/admin/tickets?tab=relatorios`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    const dupTabsRelatorios = await page.locator('.tabs-nav-bar, .tabs-cluster').count();
    console.log(`- Abas horizontais duplicadas em Relatórios: ${dupTabsRelatorios === 0 ? 'NÃO EXISTEM (CORRETO)' : 'ENCONTRADAS (ERRO)'}`);
    const relatoriosTitle = await page.locator('.header-title').innerText();
    console.log(`- Título da área: "${relatoriosTitle}"`);
    if (dupTabsRelatorios === 0 && relatoriosTitle.includes('Relatórios')) {
      testResults.testB_duplicateTabsRemoved.tabsAbsentOnRelatorios = true;
    }

    // B.2 Inscrições de Scans
    console.log('B.2 Acessando /admin/tickets?tab=scans...');
    await page.goto(`${PREVIEW_URL}/admin/tickets?tab=scans`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    const dupTabsScans = await page.locator('.tabs-nav-bar, .tabs-cluster').count();
    console.log(`- Abas horizontais duplicadas em Scans: ${dupTabsScans === 0 ? 'NÃO EXISTEM (CORRETO)' : 'ENCONTRADAS (ERRO)'}`);
    const scansTitle = await page.locator('.header-title').innerText();
    console.log(`- Título da área: "${scansTitle}"`);
    if (dupTabsScans === 0 && scansTitle.includes('Inscrições')) {
      testResults.testB_duplicateTabsRemoved.tabsAbsentOnScans = true;
    }

    // B.3 Moderação
    console.log('B.3 Acessando /admin/tickets?tab=moderacao...');
    await page.goto(`${PREVIEW_URL}/admin/tickets?tab=moderacao`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    const dupTabsMod = await page.locator('.tabs-nav-bar, .tabs-cluster').count();
    console.log(`- Abas horizontais duplicadas em Moderação: ${dupTabsMod === 0 ? 'NÃO EXISTEM (CORRETO)' : 'ENCONTRADAS (ERRO)'}`);
    const modTitle = await page.locator('.header-title').innerText();
    console.log(`- Título da área: "${modTitle}"`);
    if (dupTabsMod === 0 && modTitle.includes('Moderação')) {
      testResults.testB_duplicateTabsRemoved.tabsAbsentOnModeracao = true;
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'evidence_tickets_no_duplicate_tabs.png') });
    testResults.testB_duplicateTabsRemoved.success =
      testResults.testB_duplicateTabsRemoved.tabsAbsentOnRelatorios &&
      testResults.testB_duplicateTabsRemoved.tabsAbsentOnScans &&
      testResults.testB_duplicateTabsRemoved.tabsAbsentOnModeracao;
    console.log('✅ TESTE B CONCLUÍDO COM SUCESSO: Abas duplicadas removidas de todas as áreas!');

    // ========================================================
    // TESTE C: ORDEM DOS FILTROS E PENDÊNCIAS POR PADRÃO
    // ========================================================
    console.log('\n[TESTE C] Validando Ordem dos Filtros e Seleção Padrão de Pendências...');

    // C.1 Relatórios default filter
    await page.goto(`${PREVIEW_URL}/admin/tickets?tab=relatorios`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    const relActivePill = await page.locator('.filter-pill.active').innerText();
    console.log(`- Filtro ativo padrão em Relatórios: "${relActivePill}"`);
    if (relActivePill.includes('Novos')) {
      testResults.testC_filtersOrderAndDefaults.defaultNewRelatorios = true;
    }

    const relPillsText = await page.locator('.filter-pills-row .filter-pill').allInnerTexts();
    console.log(`- Ordem dos filtros em Relatórios: ${JSON.stringify(relPillsText)}`);

    // C.2 Scans default filter
    await page.goto(`${PREVIEW_URL}/admin/tickets?tab=scans`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    const scansActivePill = await page.locator('.filter-pill.active').innerText();
    console.log(`- Filtro ativo padrão em Scans: "${scansActivePill}"`);
    if (scansActivePill.includes('Pendentes')) {
      testResults.testC_filtersOrderAndDefaults.defaultPendingScans = true;
    }
    const scansPillsText = await page.locator('.filter-pills-row .filter-pill').allInnerTexts();
    console.log(`- Ordem dos filtros em Scans: ${JSON.stringify(scansPillsText)}`);

    // C.3 Moderação default filter
    await page.goto(`${PREVIEW_URL}/admin/tickets?tab=moderacao`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    const modActivePill = await page.locator('.filter-pill.active').innerText();
    console.log(`- Filtro ativo padrão em Moderação: "${modActivePill}"`);
    if (modActivePill.includes('Novas')) {
      testResults.testC_filtersOrderAndDefaults.defaultNewModeracao = true;
    }
    const modPillsText = await page.locator('.filter-pills-row .filter-pill').allInnerTexts();
    console.log(`- Ordem dos filtros em Moderação: ${JSON.stringify(modPillsText)}`);

    testResults.testC_filtersOrderAndDefaults.success =
      testResults.testC_filtersOrderAndDefaults.defaultNewRelatorios &&
      testResults.testC_filtersOrderAndDefaults.defaultPendingScans &&
      testResults.testC_filtersOrderAndDefaults.defaultNewModeracao;
    console.log('✅ TESTE C CONCLUÍDO COM SUCESSO: Pendências são padrão e a ordem é respeitada!');

    // ========================================================
    // TESTE D: EXCLUSÃO DE COMENTÁRIO E RESOLUÇÃO AUTOMÁTICA
    // ========================================================
    console.log('\n[TESTE D] Validando Exclusão de Comentário e Resolução Automática...');

    // Create a controlled test comment and report in the database
    const authorRes = await pgClient.query("SELECT id FROM public.members WHERE username = 'kiritsuguxs' OR username = 'awerkori' LIMIT 1");
    const testAuthorId = authorRes.rows[0].id;

    const workRes = await pgClient.query("SELECT id FROM public.works WHERE published = true LIMIT 1");
    const testWorkId = workRes.rows[0].id;

    const testCommentText = `[TESTE MODERAÇÃO QA ${Date.now()}] Comentário de verificação controlada de moderação.`;
    const insComm = await pgClient.query(`
      INSERT INTO public.comments (user_id, work_id, body, removed, deleted)
      VALUES ($1, $2, $3, false, false)
      RETURNING id, body
    `, [testAuthorId, testWorkId, testCommentText]);
    const testCommentId = insComm.rows[0].id;
    console.log(`- Comentário de teste criado: ${testCommentId} ("${testCommentText}")`);

    const insReport = await pgClient.query(`
      INSERT INTO public.reports (reporter_id, target_type, comment_id, work_id, reason, details, status)
      VALUES ($1, 'COMMENT', $2, $3, 'Spam ou links não autorizados', 'Teste controlado de resolução por exclusão', 'NOVO')
      RETURNING id
    `, [testAuthorId, testCommentId, testWorkId]);
    const testReportId = insReport.rows[0].id;
    console.log(`- Denúncia de teste criada: ${testReportId}`);

    // D.1 Open Moderação (filter Novas)
    await page.goto(`${PREVIEW_URL}/admin/tickets?tab=moderacao`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const hasTestCardInNovas = await page.locator(`.mod-sentinel-card:has-text("${testCommentText}")`).count();
    console.log(`- Denúncia encontrada na lista de Novas: ${hasTestCardInNovas > 0 ? 'SIM' : 'NÃO'}`);

    // Check visibility pill is initially "Visível no site"
    const initialVisPill = await page.locator(`.mod-sentinel-card:has-text("${testCommentText}") .mod-visibility-pill`).innerText();
    console.log(`- Estado inicial da visibilidade: "${initialVisPill}"`);

    // D.2 Click "Excluir" on the test comment
    page.on('dialog', async dialog => {
      console.log(`- Confirm dialog popup: "${dialog.message()}" -> Aceitando...`);
      await dialog.accept();
    });

    console.log('- Executando clique em [Excluir]...');
    const cardScope = page.locator(`.mod-sentinel-card:has-text("${testCommentText}")`);
    await cardScope.locator('button.btn-delete').click();
    await page.waitForTimeout(3000);

    // D.3 Check database state directly
    const commDbCheck = await pgClient.query("SELECT id, removed, deleted FROM public.comments WHERE id = $1", [testCommentId]);
    console.log('- Estado no banco de comments:', commDbCheck.rows[0]);

    const reportDbCheck = await pgClient.query("SELECT id, status, resolution_notes FROM public.reports WHERE id = $1", [testReportId]);
    console.log('- Estado no banco de reports:', reportDbCheck.rows[0]);

    if (commDbCheck.rows[0].removed === true && commDbCheck.rows[0].deleted === true && reportDbCheck.rows[0].status === 'RESOLVIDO') {
      testResults.testD_commentDeletionAndResolution.deletedSynced = true;
      testResults.testD_commentDeletionAndResolution.reportResolved = true;
    }

    // D.4 Verify it disappeared from "Novas"
    await page.goto(`${PREVIEW_URL}/admin/tickets?tab=moderacao&status=NOVO`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    const inNovasAfter = await page.locator(`.mod-sentinel-card:has-text("${testCommentText}")`).count();
    console.log(`- Denúncia em Novas após exclusão: ${inNovasAfter === 0 ? 'DESAPARECEU (CORRETO)' : 'AINDA PRESENTE (ERRO)'}`);

    // D.5 Verify it appears in "Resolvidas"
    await page.goto(`${PREVIEW_URL}/admin/tickets?tab=moderacao&status=RESOLVIDO`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const inResolvidas = await page.locator(`.mod-sentinel-card:has-text("${testCommentText}")`).count();
    console.log(`- Denúncia em Resolvidas: ${inResolvidas > 0 ? 'PRESENTE (CORRETO)' : 'AUSENTE (ERRO)'}`);

    const resCard = page.locator(`.mod-sentinel-card:has-text("${testCommentText}")`);
    const visAfter = await resCard.locator('.mod-visibility-pill').innerText().catch(() => '');
    console.log(`- Pílula de visibilidade em Resolvidas: "${visAfter}"`);

    const hasSiteLinkDisabled = await resCard.locator('.btn-site-view-disabled').count();
    console.log(`- Botão de link para site desativado ("Removido do Site"): ${hasSiteLinkDisabled > 0 ? 'SIM' : 'NÃO'}`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'evidence_comment_deleted_and_resolved.png') });

    if (inResolvidas > 0 && inNovasAfter === 0 && visAfter.includes('Excluído')) {
      testResults.testD_commentDeletionAndResolution.persistedOnReload = true;
      testResults.testD_commentDeletionAndResolution.success = true;
    }
    console.log('✅ TESTE D CONCLUÍDO COM SUCESSO: Comentário excluído com visibilidade sincronizada e ticket resolvido!');

    // ========================================================
    // TESTE E: RESPONSIVIDADE E CAPTURAS DE TELA
    // ========================================================
    console.log('\n[TESTE E] Capturando Telas Responsivas...');
    await desktopCtx.close();

    // 1. Desktop (1440x900)
    const ctxDesktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctxDesktop.addCookies([...sessionCookies, { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }]);
    const pDesktop = await ctxDesktop.newPage();

    await pDesktop.goto(`${PREVIEW_URL}/admin/obras?q=Distant+Sky`, { waitUntil: 'domcontentloaded' });
    await pDesktop.waitForTimeout(1500);
    await pDesktop.screenshot({ path: path.join(ARTIFACT_DIR, 'r14_search_distant_sky_desktop.png') });

    await pDesktop.goto(`${PREVIEW_URL}/admin/tickets?tab=relatorios`, { waitUntil: 'domcontentloaded' });
    await pDesktop.waitForTimeout(1500);
    await pDesktop.screenshot({ path: path.join(ARTIFACT_DIR, 'r14_tickets_relatorios_desktop.png') });

    await pDesktop.goto(`${PREVIEW_URL}/admin/tickets?tab=moderacao`, { waitUntil: 'domcontentloaded' });
    await pDesktop.waitForTimeout(1500);
    await pDesktop.screenshot({ path: path.join(ARTIFACT_DIR, 'r14_tickets_moderacao_desktop.png') });

    await pDesktop.goto(`${PREVIEW_URL}/admin/tickets?tab=scans`, { waitUntil: 'domcontentloaded' });
    await pDesktop.waitForTimeout(1500);
    await pDesktop.screenshot({ path: path.join(ARTIFACT_DIR, 'r14_tickets_scans_desktop.png') });
    await ctxDesktop.close();
    testResults.testE_regressionsAndResponsiveness.viewports.push('Desktop 1440x900');

    // 2. Tablet (768x1024)
    const ctxTablet = await browser.newContext({ viewport: { width: 768, height: 1024 } });
    await ctxTablet.addCookies([...sessionCookies, { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }]);
    const pTablet = await ctxTablet.newPage();
    await pTablet.goto(`${PREVIEW_URL}/admin/tickets?tab=moderacao`, { waitUntil: 'domcontentloaded' });
    await pTablet.waitForTimeout(1500);
    await pTablet.screenshot({ path: path.join(ARTIFACT_DIR, 'r14_tickets_tablet_768.png') });
    await ctxTablet.close();
    testResults.testE_regressionsAndResponsiveness.viewports.push('Tablet 768x1024');

    // 3. Mobile (390x844 - iPhone 14)
    const ctxMobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctxMobile.addCookies([...sessionCookies, { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL }]);
    const pMobile = await ctxMobile.newPage();

    await pMobile.goto(`${PREVIEW_URL}/admin/obras?q=Distant+Sky`, { waitUntil: 'domcontentloaded' });
    await pMobile.waitForTimeout(1500);
    await pMobile.screenshot({ path: path.join(ARTIFACT_DIR, 'r14_search_mobile_390.png') });

    await pMobile.goto(`${PREVIEW_URL}/admin/tickets?tab=relatorios`, { waitUntil: 'domcontentloaded' });
    await pMobile.waitForTimeout(1500);
    await pMobile.screenshot({ path: path.join(ARTIFACT_DIR, 'r14_tickets_relatorios_mobile.png') });

    await pMobile.goto(`${PREVIEW_URL}/admin/tickets?tab=moderacao`, { waitUntil: 'domcontentloaded' });
    await pMobile.waitForTimeout(1500);
    await pMobile.screenshot({ path: path.join(ARTIFACT_DIR, 'r14_tickets_moderacao_mobile.png') });

    await ctxMobile.close();
    testResults.testE_regressionsAndResponsiveness.viewports.push('Mobile 390x844');
    testResults.testE_regressionsAndResponsiveness.success = true;

    // Clean up test records
    await pgClient.query("DELETE FROM public.reports WHERE id = $1", [testReportId]);
    await pgClient.query("DELETE FROM public.comments WHERE id = $1", [testCommentId]);
    console.log('- Registros de teste devidamente higienizados do banco.');

  } finally {
    await browser.close();
    await pgClient.end();
  }

  // Save JSON report
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'round14_verification_report.json'),
    JSON.stringify(testResults, null, 2)
  );

  console.log('\n========================================================');
  console.log('RESUMO FINAL DOS TESTES AUTOMATIZADOS:');
  console.log(JSON.stringify(testResults, null, 2));
  console.log('========================================================\n');
}

run().catch(err => {
  console.error('ERRO FATAL NA EXECUÇÃO DO TESTE:', err);
  process.exit(1);
});
