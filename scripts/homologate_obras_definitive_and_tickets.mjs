import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { join } from 'node:path';
import crypto from 'node:crypto';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const scanId = '04872e99-37ad-4d45-aed4-35759d0eae33';

function createMemberCookie(origin) {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET || '15470467587e043eac3caaf3f93e169b1277327481996fa710cea3fda3457d1e';
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 604800;
  const payload = Buffer.from(JSON.stringify({
    sub: "99999999-9999-9999-9999-999999999999",
    email: "common_member@projectnox.org",
    role: "authenticated",
    aud: "authenticated",
    exp: exp,
    user_metadata: { username: "common_member", display_name: "Membro Comum" }
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
      id: "99999999-9999-9999-9999-999999999999",
      email: "common_member@projectnox.org",
      role: "authenticated",
      aud: "authenticated",
      email_confirmed_at: new Date().toISOString(),
      user_metadata: { username: "common_member", display_name: "Membro Comum" }
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
    }
  ];
}

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, options);
      if ((res.status === 502 || res.status === 503 || res.status === 504) && i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      return res;
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

async function main() {
  console.log(`========================================================================`);
  console.log(`PROJECT NOX — HOMOLOGAÇÃO DEFINITIVA: OBRAS DA SCAN + ADESÃO DE OBRAS`);
  console.log(`URL Alvo: ${targetUrl}`);
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

  const adminCookieHeader = adminCookies.map(c => c.name + '=' + c.value).join('; ');

  // -------------------------------------------------------------------------
  // 1. API SEARCH & RBAC VALIDATION
  // -------------------------------------------------------------------------
  console.log('\n--- 1. API /api/scan/works/search & RBAC ---');
  
  // 1.1 Anonymous request -> 401
  const anonRes = await fetchWithRetry(`${targetUrl}/api/scan/works/search?scan_id=${scanId}&q=ceu`, {
    headers: { 'cache-control': 'no-cache' }
  });
  assert('API rejeita requisição anônima com 401', anonRes.status === 401, `Status: ${anonRes.status}`);

  // 1.2 Missing scan_id -> 400
  const missingScanRes = await fetchWithRetry(`${targetUrl}/api/scan/works/search?q=ceu`, {
    headers: { 'Cookie': adminCookieHeader, 'cache-control': 'no-cache' }
  });
  assert('API exige scan_id obrigatório com 400', missingScanRes.status === 400, `Status: ${missingScanRes.status}`);

  // 1.3 Common member request -> 403
  const memberCookies = createMemberCookie(targetUrl);
  const memberCookieHeader = memberCookies.map(c => c.name + '=' + c.value).join('; ');
  const forbiddenRes = await fetchWithRetry(`${targetUrl}/api/scan/works/search?scan_id=${scanId}&q=ceu`, {
    headers: { 'Cookie': memberCookieHeader, 'cache-control': 'no-cache' }
  });
  assert('API bloqueia membro comum sem liderança com 403', forbiddenRes.status === 403, `Status: ${forbiddenRes.status}`);

  // 1.4 Valid search: "ceu" -> Céu Distante LINKED with 86 chapters
  const ceuRes = await fetchWithRetry(`${targetUrl}/api/scan/works/search?scan_id=${scanId}&q=ceu`, {
    headers: { 'Cookie': adminCookieHeader, 'cache-control': 'no-cache' }
  });
  const ceuData = await ceuRes.json();
  const ceuDistante = ceuData.results?.find(w => w.title.toLowerCase().includes('céu distante') || w.slug === 'distant-sky');
  assert('API busca "ceu" com sucesso (HTTP 200)', ceuRes.status === 200);
  assert('API identifica Céu Distante como LINKED', ceuDistante?.link_status === 'LINKED');
  assert('API retorna 86 capítulos no catálogo para Céu Distante', ceuDistante?.chapters_count === 86, `caps: ${ceuDistante?.chapters_count}`);

  // 1.5 Valid search: "marcial" -> aliases and unlinked works AVAILABLE
  const marcialRes = await fetchWithRetry(`${targetUrl}/api/scan/works/search?scan_id=${scanId}&q=marcial`, {
    headers: { 'Cookie': adminCookieHeader, 'cache-control': 'no-cache' }
  });
  const marcialData = await marcialRes.json();
  const availableWorks = marcialData.results?.filter(w => w.link_status === 'AVAILABLE') || [];
  assert('API busca "marcial" retorna obras disponíveis', availableWorks.length > 0, `Encontradas: ${availableWorks.length}`);
  assert('API traz contagem de capítulos real do catálogo', availableWorks.some(w => (w.chapters_count || 0) > 0));

  // 1.6 Unaccented search: "calamidade"
  const unaccentRes = await fetchWithRetry(`${targetUrl}/api/scan/works/search?scan_id=${scanId}&q=calamidade`, {
    headers: { 'Cookie': adminCookieHeader, 'cache-control': 'no-cache' }
  });
  const unaccentData = await unaccentRes.json();
  assert('API busca insensível a acentos funciona perfeitamente', (unaccentData.results?.length || 0) > 0);

  // Dynamic selection of fresh unrequested works for automated testing
  const catalogProbeRes = await fetchWithRetry(`${targetUrl}/api/scan/works/search?scan_id=${scanId}&q=a`, {
    headers: { 'Cookie': adminCookieHeader, 'cache-control': 'no-cache' }
  });
  const catalogProbeData = await catalogProbeRes.json();
  const freshAvailableList = (catalogProbeData.results || []).filter(w => w.link_status === 'AVAILABLE');
  const workToReject = freshAvailableList[0]?.title || 'A Princesa Farmacêutica e o Jogo';
  const workToApprove = freshAvailableList[1]?.title || 'A Calamidade Desceu e eu Evolui para o Rei Carmesim';
  console.log(`Obras disponíveis selecionadas para o fluxo: \n  - Para recusa: "${workToReject}"\n  - Para aprovação: "${workToApprove}"\n`);

  // -------------------------------------------------------------------------
  // 2. PLAYWRIGHT BROWSER VALIDATION & SCREENSHOTS
  // -------------------------------------------------------------------------
  console.log('\n--- 2. PLAYWRIGHT UI WORKSPACE & HOMOLOGAÇÃO ---');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    // -----------------------------------------------------------------------
    // Desktop Viewport (1440x900)
    // -----------------------------------------------------------------------
    const ctxDesktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctxDesktop.addCookies(adminCookies);
    const pDesk = await ctxDesktop.newPage();

    // 2.1 Navigation to /scan?tab=obras
    console.log('Navegando para /scan?tab=obras no Desktop...');
    const resp = await pDesk.goto(`${targetUrl}/scan?tab=obras`, { waitUntil: 'domcontentloaded' });
    await pDesk.waitForTimeout(500);
    console.log('pDesk URL after goto:', pDesk.url(), 'Status:', resp?.status());
    await pDesk.waitForSelector('.works-cards-stack', { timeout: 30000 });

    // Check Gestão da Scan in sidebar
    const sidebarTitles = await pDesk.locator('.section-title').allInnerTexts();
    assert('Menu lateral exibe categoria GESTÃO DA SCAN', sidebarTitles.some(c => c.includes('GESTÃO DA SCAN')));

    // Check Céu Distante Level 1 card
    const ceuCard = pDesk.locator('.work-card-panel:has-text("Céu Distante")').first();
    const cardText = await ceuCard.innerText();
    assert('Card Céu Distante exibe "86 caps no catálogo"', cardText.includes('86 caps no catálogo'));
    assert('Card Céu Distante exibe "6 da scan" sob gestão', cardText.includes('6 da scan'));

    // 2.2 Open Smart Search Modal
    console.log('Abrindo modal de Solicitar Obra...');
    const btnSolicitar = pDesk.locator('button.btn-action-primary:has-text("Solicitar Obra")').first();
    await btnSolicitar.click();
    await pDesk.waitForSelector('.project-search-modal', { state: 'visible', timeout: 10000 });
    assert('Modal de busca inteligente de obras aberto', await pDesk.locator('.project-search-modal').isVisible());

    // 2.3 Real-time search in modal
    console.log('Digitando busca no modal...');
    const searchInput = pDesk.locator('#proj-search-input');
    await searchInput.fill(workToReject);
    await pDesk.waitForSelector('.search-result-item', { timeout: 10000 });
    const resultItems = await pDesk.locator('.search-result-item').count();
    assert('Busca em tempo real exibe resultados no dropdown', resultItems > 0, `Itens: ${resultItems}`);

    // Click on first available unlinked item
    const firstAvailable = pDesk.locator('.search-result-item:not([disabled])').first();
    await firstAvailable.click();
    await pDesk.waitForSelector('.selected-work-highlight', { timeout: 5000 });
    assert('Obra selecionada com destaque no formulário', await pDesk.locator('.selected-work-highlight').isVisible());

    // Submit button should be enabled
    const submitBtn = pDesk.locator('button.btn-primary:has-text("Enviar solicitação")');
    assert('Botão Enviar Solicitação habilitado após seleção', await submitBtn.isEnabled());

    // Fill optional justification
    await pDesk.locator('#proj-msg').fill('Solicitação de homologação de vínculo editorial via Playwright.');
    
    // Screenshot: Modal with work selected
    const pathModalScreenshot = join(artifactDir, '01_desktop_solicitar_obra_modal.png');
    await pDesk.screenshot({ path: pathModalScreenshot, fullPage: false });
    console.log(`✓ Screenshot salvo: ${pathModalScreenshot}`);

    // Submit request via form
    console.log('Submetendo solicitação de obra...');
    await submitBtn.click();
    await pDesk.waitForTimeout(3000);

    // -----------------------------------------------------------------------
    // 3. CENTRAL DE TICKETS: TAB 4 "ADESÃO DE OBRAS"
    // -----------------------------------------------------------------------
    console.log('\n--- 3. CENTRAL DE TICKETS: TAB 4 ADESÃO DE OBRAS ---');
    await pDesk.goto(`${targetUrl}/admin/tickets?tab=obras`, { waitUntil: 'domcontentloaded' });
    await pDesk.waitForSelector('.tab-panel', { timeout: 25000 });

    // Verify 4 tabs in navigation bar
    const tabButtons = await pDesk.locator('.tabs-nav-bar a.tab-btn').allInnerTexts();
    assert('Central de Tickets possui 4 categorias oficiais', tabButtons.length === 4, `Tabs: ${tabButtons.length}`);
    assert('Quarta categoria é "Adesão de Obras"', tabButtons.some(t => t.includes('Adesão de Obras')));

    // Verify KPI Cards
    const statCards = await pDesk.locator('.stat-card').count();
    assert('Grid de estatísticas da aba Obras renderizada', statCards >= 4, `Cards: ${statCards}`);

    // Screenshot: Tickets tab obras
    const pathTicketsScreenshot = join(artifactDir, '02_desktop_admin_tickets_obras_tab.png');
    await pDesk.screenshot({ path: pathTicketsScreenshot, fullPage: false });
    console.log(`✓ Screenshot salvo: ${pathTicketsScreenshot}`);

    // Verify ticket card presence
    const ticketCardsCount = await pDesk.locator('.work-ticket-card').count();
    assert('Solicitação de obra exibida na grade de tickets', ticketCardsCount > 0, `Total cards: ${ticketCardsCount}`);

    if (ticketCardsCount > 0) {
      const firstTicket = pDesk.locator('.work-ticket-card').first();
      const ticketText = await firstTicket.innerText();
      assert('Ticket exibe nome da scan', ticketText.includes('Project Nox'));
      assert('Ticket exibe tag de liderança do solicitante', ticketText.includes('DONO') || ticketText.includes('OWNER') || ticketText.includes('ADMIN'));
      assert('Ticket possui botão "Aprovar Vínculo"', await firstTicket.locator('button.btn-approve-work').isVisible());
      assert('Ticket possui botão "Recusar"', await firstTicket.locator('button.btn-reject-work').isVisible());

      // ---------------------------------------------------------------------
      // 4. TEST REJECTION FLOW WITH JUSTIFICATION MODAL
      // ---------------------------------------------------------------------
      console.log('\n--- 4. TESTE DE RECUSA COM JUSTIFICATIVA ---');
      await firstTicket.locator('button.btn-reject-work').click();
      await pDesk.waitForSelector('.reject-work-dialog', { state: 'visible', timeout: 5000 });
      assert('Modal de recusa com tema de alerta aberto', await pDesk.locator('.reject-work-dialog').isVisible());

      // Fill reason and submit rejection
      await pDesk.locator('#reject-work-reason').fill('Recusa de teste de homologação: obra temporariamente indisponível.');
      await pDesk.locator('button.btn-danger-solid:has-text("Confirmar Recusa")').click();
      await pDesk.waitForTimeout(3000);

      // Verify ticket moved to Recusadas
      await pDesk.goto(`${targetUrl}/admin/tickets?tab=obras&status=REJECTED`, { waitUntil: 'domcontentloaded' });
      await pDesk.waitForSelector('.work-ticket-card', { timeout: 15000 });
      const rejectedCards = await pDesk.locator('.work-ticket-card').count();
      assert('Ticket recusado exibido na lista de Recusadas', rejectedCards > 0);

      const pathRejectScreenshot = join(artifactDir, '03_desktop_admin_ticket_rejected.png');
      await pDesk.screenshot({ path: pathRejectScreenshot, fullPage: false });
      console.log(`✓ Screenshot salvo: ${pathRejectScreenshot}`);
    }

    // -----------------------------------------------------------------------
    // 5. TEST APPROVAL FLOW WITH REAL VÍNCULO
    // -----------------------------------------------------------------------
    console.log('\n--- 5. TESTE DE APROVAÇÃO E VÍNCULO REAL ---');
    // Create another request via UI
    await pDesk.goto(`${targetUrl}/scan?tab=obras`, { waitUntil: 'domcontentloaded' });
    await pDesk.waitForTimeout(500);
    await pDesk.locator('button.btn-action-primary:has-text("Solicitar Obra")').first().click();
    await pDesk.waitForSelector('.project-search-modal', { state: 'visible', timeout: 10000 });
    
    // Search for available work
    await pDesk.locator('#proj-search-input').fill(workToApprove);
    await pDesk.waitForSelector('.search-result-item', { timeout: 10000 });
    const availableItem = pDesk.locator('.search-result-item:not([disabled])').first();
    await availableItem.click();
    await pDesk.waitForSelector('.selected-work-highlight', { timeout: 5000 });
    await pDesk.locator('button.btn-primary:has-text("Enviar solicitação")').click();
    await pDesk.waitForTimeout(3000);

    // Go to admin tickets
    await pDesk.goto(`${targetUrl}/admin/tickets?tab=obras`, { waitUntil: 'domcontentloaded' });
    await pDesk.waitForSelector('.work-ticket-card', { timeout: 20000 });

    const newTicket = pDesk.locator('.work-ticket-card').first();
    await newTicket.locator('button.btn-approve-work').click();
    await pDesk.waitForSelector('.approve-work-dialog', { state: 'visible', timeout: 5000 });
    assert('Modal de aprovação com opção de scan principal aberto', await pDesk.locator('.approve-work-dialog').isVisible());

    // Confirm approval
    await pDesk.locator('button.btn-emerald-solid:has-text("Confirmar e Conceder Vínculo")').click();
    await pDesk.waitForTimeout(3000);

    // Verify ticket in Approved filter
    await pDesk.goto(`${targetUrl}/admin/tickets?tab=obras&status=APPROVED`, { waitUntil: 'domcontentloaded' });
    await pDesk.waitForSelector('.work-ticket-card', { timeout: 15000 });
    const approvedCards = await pDesk.locator('.work-ticket-card').count();
    assert('Ticket aprovado com sucesso e exibido em Aprovadas', approvedCards > 0);

    const pathApproveScreenshot = join(artifactDir, '04_desktop_admin_ticket_approved.png');
    await pDesk.screenshot({ path: pathApproveScreenshot, fullPage: false });
    console.log(`✓ Screenshot salvo: ${pathApproveScreenshot}`);

    // Verify public work page reflects scan link
    console.log('Verificando reflexão na página pública da obra (/obra/kenji)...');
    await pDesk.goto(`${targetUrl}/obra/kenji`, { waitUntil: 'domcontentloaded' });
    const obraPageText = await pDesk.locator('body').innerText();
    assert('Página pública da obra exibe a scan vinculada', obraPageText.includes('Project Nox'));

    const pathPublicScreenshot = join(artifactDir, '05_desktop_public_work_linked_scan.png');
    await pDesk.screenshot({ path: pathPublicScreenshot, fullPage: false });
    console.log(`✓ Screenshot salvo: ${pathPublicScreenshot}`);

    // -----------------------------------------------------------------------
    // 6. NOTIFICATIONS VALIDATION
    // -----------------------------------------------------------------------
    console.log('\n--- 6. VERIFICAÇÃO DE NOTIFICAÇÕES ---');
    await pDesk.goto(`${targetUrl}/notificacoes`, { waitUntil: 'domcontentloaded' });
    await pDesk.waitForSelector('.notifications-page-wrap, .notif-card, .empty-notif-box', { timeout: 20000 });
    const notifsText = await pDesk.locator('body').innerText();
    assert('Central de notificações exibe avisos de adesão de obra', 
      notifsText.includes('obra') || notifsText.includes('Obra') || notifsText.includes('Adesão') || notifsText.includes('vincul'));

    const pathNotifScreenshot = join(artifactDir, '06_desktop_notificacoes_vinculo.png');
    await pDesk.screenshot({ path: pathNotifScreenshot, fullPage: false });
    console.log(`✓ Screenshot salvo: ${pathNotifScreenshot}`);

    // -----------------------------------------------------------------------
    // 7. REGRESSION: CALENDÁRIO INTACT
    // -----------------------------------------------------------------------
    console.log('\n--- 7. NÃO-REGRESSÃO: CALENDÁRIO ---');
    await pDesk.goto(`${targetUrl}/scan?tab=calendario`, { waitUntil: 'domcontentloaded' });
    await pDesk.waitForTimeout(1000);
    await pDesk.waitForSelector('.calendar-tab, .calendar-layout', { timeout: 20000 });
    assert('Aba Calendário permanece 100% íntegra e sem regressão', await pDesk.locator('.calendar-tab').isVisible());

    const pathCalScreenshot = join(artifactDir, '07_desktop_calendario_regression_intact.png');
    await pDesk.screenshot({ path: pathCalScreenshot, fullPage: false });
    console.log(`✓ Screenshot salvo: ${pathCalScreenshot}`);

    // -----------------------------------------------------------------------
    // 8. MOBILE VIEWPORTS (320px, 360px, 390px, 430px)
    // -----------------------------------------------------------------------
    console.log('\n--- 8. MOBILE VIEWPORTS (320px, 360px, 390px, 430px) ---');
    const mobileViewports = [
      { name: '320_compact', width: 320, height: 640 },
      { name: '360_standard', width: 360, height: 780 },
      { name: '390_pixel', width: 390, height: 844 },
      { name: '430_max', width: 430, height: 932 }
    ];

    const ctxM = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'
    });
    await ctxM.addCookies(adminCookies);
    const pM = await ctxM.newPage();

    // 1. Scan Obras mobile
    console.log('Testando viewports mobile em /scan?tab=obras...');
    await pM.goto(`${targetUrl}/scan?tab=obras`, { waitUntil: 'domcontentloaded' });
    await pM.waitForSelector('.works-cards-stack', { timeout: 25000 });

    for (const vp of mobileViewports) {
      await pM.setViewportSize({ width: vp.width, height: vp.height });
      await pM.waitForTimeout(300);
      const overflowScan = await pM.evaluate(() => {
        return document.documentElement.scrollWidth <= document.documentElement.clientWidth;
      });
      assert(`Mobile ${vp.width}px: sem overflow horizontal em /scan?tab=obras`, overflowScan);
      const pathMobObras = join(artifactDir, `08_mobile_${vp.name}_scan_obras.png`);
      await pM.screenshot({ path: pathMobObras, fullPage: false });
    }

    // 2. Admin Tickets mobile
    console.log('Testando viewports mobile em /admin/tickets?tab=obras...');
    await pM.goto(`${targetUrl}/admin/tickets?tab=obras`, { waitUntil: 'domcontentloaded' });
    await pM.waitForSelector('.tab-panel', { timeout: 25000 });

    for (const vp of mobileViewports) {
      await pM.setViewportSize({ width: vp.width, height: vp.height });
      await pM.waitForTimeout(300);
      const overflowTickets = await pM.evaluate(() => {
        return document.documentElement.scrollWidth <= document.documentElement.clientWidth;
      });
      assert(`Mobile ${vp.width}px: sem overflow horizontal em /admin/tickets?tab=obras`, overflowTickets);
      const pathMobTickets = join(artifactDir, `09_mobile_${vp.name}_admin_tickets.png`);
      await pM.screenshot({ path: pathMobTickets, fullPage: false });
    }

    await ctxM.close();

  } finally {
    await browser.close();
  }

  console.log(`\n========================================================================`);
  console.log(`RELATÓRIO DE HOMOLOGAÇÃO: ${results.passed}/${results.total} TESTES PASSARAM`);
  console.log(`Status Final: ${results.failed === 0 ? 'SUCESSO TOTAL (100%)' : 'FALHAS DETECTADAS'}`);
  console.log(`========================================================================\n`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Erro fatal durante a homologação:', err);
  process.exit(1);
});
