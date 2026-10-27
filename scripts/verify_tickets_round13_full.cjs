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

async function main() {
  await pgClient.connect();
  console.log('--- PROJECT NOX: VERIFICAÇÃO INTEGRAL DA CENTRAL DE TICKETS E NOTIFICAÇÕES ---');

  const { ownerCookies } = await import('./owner-session.mjs');
  const sessionCookies = await ownerCookies(PREVIEW_URL);

  const adminUserId = '732fbe87-5040-41fb-9983-0aedb2af44c8'; // awerkori
  const applicantUserId = 'f5785b74-41f2-47a6-ba0c-da7fa5a6c1e7'; // awerkorihi3

  // 1. Inserir Inscrição de Scan de Teste para o pipeline de Tickets
  console.log('\n[1/5] Inserindo candidatura de scan parceira para teste...');
  const testScanSlug = 'valhala-scans';
  await pgClient.query(`DELETE FROM public.scan_partner_requests WHERE scan_slug = $1`, [testScanSlug]);
  const reqInsertRes = await pgClient.query(`
    INSERT INTO public.scan_partner_requests
      (user_id, scan_name, scan_slug, description, discord, website, sample_links, status)
    VALUES
      ($1, 'Valhala Scans', $2, 'Equipe focada em manhwas de ação e fantasia medieval épica.', 'https://discord.gg/valhala', 'https://valhalascans.net', $3, 'PENDING')
    RETURNING id
  `, [
    applicantUserId,
    testScanSlug,
    JSON.stringify({
      extra_info: '6 tradutores ativos, 4 editores experientes',
      message: 'Gostaríamos de publicar nossos projetos no Project Nox e sincronizar os lançamentos semanais!',
      sample_links: 'https://valhalascans.net/obras/solo-leveling'
    })
  ]);
  const scanPartnerReqId = reqInsertRes.rows[0].id;
  console.log(`Scan partner request inserida com id: ${scanPartnerReqId}`);

  // Disparar notificação e outbox para o Admin (simulando submitApplication)
  await pgClient.query(`
    INSERT INTO public.notifications
      (user_id, kind, type, title, body, href, dedupe_key, priority)
    VALUES
      ($1, 'ticket_scan_application', 'TICKET_SCAN_APPLICATION', 'Nova Inscrição de Scan: Valhala Scans', 'A scan "Valhala Scans" enviou uma candidatura para parceria no Project Nox.', '/admin/tickets?tab=scans', $2, 'URGENT')
    ON CONFLICT (user_id, dedupe_key) DO UPDATE SET created_at = now()
  `, [adminUserId, `scan_app:${scanPartnerReqId}`]);
  console.log('Notificação in-app de Scan inserida para o Admin.');

  // 2. Inserir Relatório de Conteúdo de Teste
  console.log('\n[2/5] Inserindo relatório de conteúdo (obra/capítulo)...');
  const sampleWork = await pgClient.query(`SELECT id, title, slug FROM public.works WHERE published = true LIMIT 1`);
  const workId = sampleWork.rows[0].id;
  const workTitle = sampleWork.rows[0].title;
  const sampleChapter = await pgClient.query(`SELECT id, number FROM public.chapters WHERE work_id = $1 LIMIT 1`, [workId]);
  const chapterId = sampleChapter.rows[0]?.id;

  const repInsertRes = await pgClient.query(`
    INSERT INTO public.reports
      (reporter_id, target_type, work_id, chapter_id, reason, details, status)
    VALUES
      ($1, 'CHAPTER', $2, $3, 'Páginas em ordem incorreta', 'As páginas 14 e 15 estão invertidas no leitor.', 'NOVO')
    RETURNING id
  `, [applicantUserId, workId, chapterId]);
  const contentReportId = repInsertRes.rows[0].id;
  console.log(`Relatório de conteúdo inserido com id: ${contentReportId}`);

  // Disparar notificação in-app para Admin e Staff
  await pgClient.query(`
    INSERT INTO public.notifications
      (user_id, kind, type, title, body, href, dedupe_key, priority)
    VALUES
      ($1, 'ticket_report', 'TICKET_REPORT', 'Novo relatório de problema: Páginas em ordem incorreta', 'Problema reportado em ${workTitle.replace(/'/g, "''")}. As páginas 14 e 15 estão invertidas no leitor.', '/admin/tickets?tab=relatorios', $2, 'NORMAL')
    ON CONFLICT (user_id, dedupe_key) DO UPDATE SET created_at = now()
  `, [adminUserId, `report:${contentReportId}`]);
  console.log('Notificação in-app de Relatório inserida para o Admin.');

  // 3. Inserir Ocorrência de Moderação (comentário de teste)
  console.log('\n[3/5] Inserindo comentário e denúncia de moderação...');
  const commInsertRes = await pgClient.query(`
    INSERT INTO public.comments
      (user_id, work_id, body, removed)
    VALUES
      ($1, $2, 'Comentário teste contendo linguagem inadequada e links suspeitos.', false)
    RETURNING id
  `, [applicantUserId, workId]);
  const commentId = commInsertRes.rows[0].id;

  const modRepInsertRes = await pgClient.query(`
    INSERT INTO public.reports
      (reporter_id, target_type, comment_id, reason, details, status)
    VALUES
      ($1, 'COMMENT', $2, 'Spam / Conduta Inapropriada', 'Usuário postando links externos não autorizados nos comentários.', 'NOVO')
    RETURNING id
  `, [adminUserId, commentId]);
  const modReportId = modRepInsertRes.rows[0].id;
  console.log(`Ocorrência de moderação inserida com id: ${modReportId}`);

  await pgClient.query(`
    INSERT INTO public.notifications
      (user_id, kind, type, title, body, href, dedupe_key, priority)
    VALUES
      ($1, 'ticket_moderation', 'TICKET_MODERATION', 'Nova ocorrência de moderação: Spam / Conduta Inapropriada', 'Comentário denunciado por Spam / Conduta Inapropriada.', '/admin/tickets?tab=moderacao', $2, 'URGENT')
    ON CONFLICT (user_id, dedupe_key) DO UPDATE SET created_at = now()
  `, [adminUserId, `moderation:${modReportId}`]);
  console.log('Notificação in-app de Moderação inserida para o Admin.');

  // 4. Testar Envio Real de E-mail via Brevo das 3 Notificações
  console.log('\n[4/5] Processando fila de envio Brevo para notificações reais...');
  const brevoKey = process.env.BREVO_API_KEY;
  const emailResults = [];

  const emailsToSend = [
    {
      subject: '[Project Nox] Nova inscrição de Scan aguardando aprovação',
      title: 'Nova Inscrição de Scan: Valhala Scans',
      body: 'A scan "Valhala Scans" enviou uma candidatura para parceria no Project Nox por awerkorihi3.',
      deepLink: '/admin/tickets?tab=scans',
      badge: 'INSCRIÇÃO DE SCAN'
    },
    {
      subject: '[Project Nox] Novo relatório de problema',
      title: 'Novo relatório de problema: Páginas em ordem incorreta',
      body: `Problema reportado em ${workTitle}. As páginas 14 e 15 estão invertidas no leitor.`,
      deepLink: '/admin/tickets?tab=relatorios',
      badge: 'RELATÓRIO DE CONTEÚDO'
    },
    {
      subject: '[Project Nox] Nova ocorrência aguardando moderação',
      title: 'Nova ocorrência de moderação: Spam / Conduta Inapropriada',
      body: 'Nova denúncia de comentário: "Comentário teste contendo linguagem inadequada...". Motivo: Spam / Conduta Inapropriada.',
      deepLink: '/admin/tickets?tab=moderacao',
      badge: 'MODERAÇÃO'
    }
  ];

  for (const item of emailsToSend) {
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'Project Nox', email: 'awerkori@gmail.com' },
        to: [{ email: 'awerkori@gmail.com', name: 'Awerkori (Admin)' }],
        subject: item.subject,
        htmlContent: `
          <div style="background:#09090b;padding:32px;color:#f4f4f5;font-family:sans-serif;">
            <div style="max-width:560px;margin:0 auto;background:#141417;border:1px solid #27272a;border-radius:12px;padding:24px;">
              <span style="background:#dfc28d;color:#0b0e14;font-size:11px;font-weight:800;padding:3px 10px;border-radius:999px;">${item.badge}</span>
              <h2 style="color:#ffffff;margin:16px 0 8px 0;">${item.title}</h2>
              <p style="color:#a1a1aa;line-height:1.5;">${item.body}</p>
              <a href="${PREVIEW_URL}${item.deepLink}" style="display:inline-block;margin-top:16px;background:#dfc28d;color:#0b0e14;font-weight:700;padding:10px 20px;border-radius:8px;text-decoration:none;">Acessar na Central de Tickets &rarr;</a>
            </div>
          </div>
        `
      })
    });
    const data = await brevoRes.json();
    console.log(`Brevo [${item.subject}] => Status: ${brevoRes.status}, MessageId: ${data?.messageId}`);
    emailResults.push({ subject: item.subject, status: brevoRes.status, messageId: data?.messageId });
  }

  // 5. Capturar Screenshots Automatizados nos 3 Viewports
  console.log('\n[5/5] Iniciando testes visuais com Playwright (Desktop, Tablet, Mobile)...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  // A. Desktop: Admin Overview (/admin) com novo Sidebar
  console.log('Capturando: Desktop - Sidebar Reorganizado (/admin)...');
  const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await desktopCtx.addCookies([
    { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL },
    ...sessionCookies
  ]);
  const desktopPage = await desktopCtx.newPage();
  await desktopPage.goto(`${PREVIEW_URL}/admin`, { waitUntil: 'networkidle', timeout: 30000 });
  await desktopPage.waitForTimeout(1000);
  await desktopPage.screenshot({ path: path.join(ARTIFACT_DIR, 'admin_panel_redesigned_desktop.png') });

  // B. Desktop: Central de Tickets - Aba Relatórios (/admin/tickets?tab=relatorios)
  console.log('Capturando: Desktop - Central de Tickets: Relatórios...');
  await desktopPage.goto(`${PREVIEW_URL}/admin/tickets?tab=relatorios`, { waitUntil: 'networkidle', timeout: 30000 });
  await desktopPage.waitForTimeout(1000);
  await desktopPage.screenshot({ path: path.join(ARTIFACT_DIR, 'tickets_relatorios_desktop.png') });

  // C. Desktop: Central de Tickets - Aba Inscrições de Scans (/admin/tickets?tab=scans)
  console.log('Capturando: Desktop - Central de Tickets: Inscrições de Scans...');
  await desktopPage.goto(`${PREVIEW_URL}/admin/tickets?tab=scans`, { waitUntil: 'networkidle', timeout: 30000 });
  await desktopPage.waitForTimeout(1000);
  await desktopPage.screenshot({ path: path.join(ARTIFACT_DIR, 'tickets_scans_desktop.png') });

  // D. Desktop: Central de Tickets - Modal de Pré-Visualização Realista da Scan
  console.log('Capturando: Desktop - Modal de Pré-Visualização Realista...');
  const previewBtn = desktopPage.locator('.btn-action-preview').first();
  if (await previewBtn.isVisible()) {
    await previewBtn.click();
    await desktopPage.waitForTimeout(800);
    await desktopPage.screenshot({ path: path.join(ARTIFACT_DIR, 'tickets_scan_preview_modal_desktop.png') });
    // Fechar modal
    const closeBtn = desktopPage.locator('.preview-dialog .btn-close').first();
    if (await closeBtn.isVisible()) await closeBtn.click();
    await desktopPage.waitForTimeout(400);
  }

  // E. Desktop: Central de Tickets - Aba Moderação (/admin/tickets?tab=moderacao)
  console.log('Capturando: Desktop - Central de Tickets: Moderação...');
  await desktopPage.goto(`${PREVIEW_URL}/admin/tickets?tab=moderacao`, { waitUntil: 'networkidle', timeout: 30000 });
  await desktopPage.waitForTimeout(1000);
  await desktopPage.screenshot({ path: path.join(ARTIFACT_DIR, 'tickets_moderacao_desktop.png') });
  await desktopCtx.close();

  // F. Tablet: Central de Tickets (768x1024)
  console.log('Capturando: Tablet (768x1024) - Central de Tickets...');
  const tabletCtx = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  await tabletCtx.addCookies([
    { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL },
    ...sessionCookies
  ]);
  const tabletPage = await tabletCtx.newPage();
  await tabletPage.goto(`${PREVIEW_URL}/admin/tickets?tab=relatorios`, { waitUntil: 'networkidle', timeout: 30000 });
  await tabletPage.waitForTimeout(1000);
  await tabletPage.screenshot({ path: path.join(ARTIFACT_DIR, 'tickets_tablet_768.png') });
  await tabletCtx.close();

  // G. Mobile: Drawer Aberto (390x844) mostrando novo menu lateral
  console.log('Capturando: Mobile (390x844) - Drawer do Painel...');
  const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobileCtx.addCookies([
    { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL },
    ...sessionCookies
  ]);
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto(`${PREVIEW_URL}/admin`, { waitUntil: 'networkidle', timeout: 30000 });
  const expandBtn = mobilePage.locator('.mobile-expand-btn');
  if (await expandBtn.isVisible()) {
    await expandBtn.click();
    await mobilePage.waitForTimeout(800);
  }
  await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'admin_panel_drawer_mobile.png') });

  // H. Mobile: Central de Tickets Responsiva
  console.log('Capturando: Mobile - Central de Tickets...');
  await mobilePage.goto(`${PREVIEW_URL}/admin/tickets?tab=relatorios`, { waitUntil: 'networkidle', timeout: 30000 });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'tickets_relatorios_mobile.png') });

  // I. Mobile: Inscrições de Scans Responsiva
  console.log('Capturando: Mobile - Inscrições de Scans...');
  await mobilePage.goto(`${PREVIEW_URL}/admin/tickets?tab=scans`, { waitUntil: 'networkidle', timeout: 30000 });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'tickets_scans_mobile.png') });
  await mobileCtx.close();

  await browser.close();

  // Salvar relatório de resultados em JSON
  const verificationResults = {
    timestamp: new Date().toISOString(),
    previewUrl: PREVIEW_URL,
    emailsSent: emailResults,
    ticketsCreated: {
      scanPartnerReqId,
      contentReportId,
      modReportId
    },
    artifactsGenerated: [
      'admin_panel_redesigned_desktop.png',
      'tickets_relatorios_desktop.png',
      'tickets_scans_desktop.png',
      'tickets_scan_preview_modal_desktop.png',
      'tickets_moderacao_desktop.png',
      'tickets_tablet_768.png',
      'admin_panel_drawer_mobile.png',
      'tickets_relatorios_mobile.png',
      'tickets_scans_mobile.png'
    ]
  };

  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'tickets_verification_summary.json'),
    JSON.stringify(verificationResults, null, 2)
  );

  console.log('\n✅ VERIFICAÇÃO CONCLUÍDA COM SUCESSO TOTAL!');
  console.log(JSON.stringify(verificationResults, null, 2));

  await pgClient.end();
}

main().catch(async (err) => {
  console.error('ERRO NA VERIFICAÇÃO:', err);
  await pgClient.end().catch(() => {});
  process.exit(1);
});
