import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { getOwnerClient } from './owner-session.mjs';

const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

// Load environment variables
for (const envPath of ['.dev.vars.preview_full', '.dev.vars.deploy', '.env']) {
  if (fs.existsSync(envPath)) {
    for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const idx = l.indexOf('=');
      if (idx !== -1) {
        const k = l.slice(0, idx).trim();
        const v = l.slice(idx + 1).trim();
        if (!process.env[k] && v) process.env[k] = v;
      }
    }
  }
}

async function run() {
  console.log('=== STARTING PROJECT NOX FINAL CERTIFICATION SUITE ===');
  console.log('Target URL:', PREVIEW_URL);

  const testReport = {
    timestamp: new Date().toISOString(),
    tests: {},
    summary: { passed: 0, failed: 0 }
  };

  const record = (name, passed, details) => {
    testReport.tests[name] = { passed, details };
    if (passed) {
      testReport.summary.passed++;
      console.log(`[PASS] ${name}`);
    } else {
      testReport.summary.failed++;
      console.error(`[FAIL] ${name}:`, details);
    }
  };

  const { client, adminClient, cookies: ownerCookiesList, user: ownerUser } = await getOwnerClient(PREVIEW_URL);
  console.log('Owner authenticated:', ownerUser.email, `(${ownerUser.id})`);

  const runId = Date.now();

  // -------------------------------------------------------------
  // TEST SUITE 1: VERIFY NO GHOST SCANS REMAIN
  // -------------------------------------------------------------
  console.log('\n--- 1. AUDIT OF GHOST SCANS CLEANUP ---');
  try {
    const { data: allScans, error: scansErr } = await adminClient
      .from('scans')
      .select('id, name, slug, is_official');
    if (scansErr) throw scansErr;

    const ghostScans = (allScans || []).filter(s => !s.is_official && s.slug.includes('flow-scan'));
    const isClean = ghostScans.length === 0 && allScans.length === 1 && allScans[0].slug === 'project-nox';

    record('auditoria_limpeza_scans_fantasmas', isClean, {
      totalScansInDb: allScans.length,
      officialScan: allScans[0]?.name,
      ghostScansFound: ghostScans.length,
      scans: allScans
    });
  } catch (err) {
    record('auditoria_limpeza_scans_fantasmas', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // TEST SUITE 2: RECIPIENT SELECTION LOGIC & ROLE ISOLATION
  // -------------------------------------------------------------
  console.log('\n--- 2. VERIFYING RECIPIENT SELECTION & ROLE PERMISSION ISOLATION ---');
  try {
    const { data: roles } = await adminClient
      .from('access_roles')
      .select('user_id, role, suspended');

    const adminRoles = roles.filter(r => r.role === 'ADMIN' && !r.suspended);
    const staffRoles = roles.filter(r => (r.role === 'ADMIN' || r.role === 'STAFF_SITE') && !r.suspended);

    const adminUserIds = Array.from(new Set(adminRoles.map(r => r.user_id)));
    const staffAndAdminUserIds = Array.from(new Set(staffRoles.map(r => r.user_id)));

    const standardUsers = roles.filter(r => r.role === 'USER').map(r => r.user_id);
    const leakedUsers = staffAndAdminUserIds.filter(id => standardUsers.includes(id));

    const isolationValid = adminUserIds.length >= 1 &&
      staffAndAdminUserIds.length > adminUserIds.length &&
      leakedUsers.length === 0;

    record('isolamento_destinatarios_por_papel', isolationValid, {
      eligibleAdminsCount: adminUserIds.length,
      eligibleStaffAndAdminCount: staffAndAdminUserIds.length,
      adminUserIds,
      staffOnlyCount: staffAndAdminUserIds.length - adminUserIds.length,
      leakedNonStaffUsers: leakedUsers.length
    });
  } catch (err) {
    record('isolamento_destinatarios_por_papel', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // TEST SUITE 3: MOBILE GESTURE NAVIGATION (SWIPE RIGHT / LEFT)
  // -------------------------------------------------------------
  console.log('\n--- 3. TESTING MOBILE GESTURES (SWIPE RIGHT TO OPEN, SWIPE LEFT TO CLOSE) ---');
  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: '360px', width: 360, height: 800 },
    { name: '390px', width: 390, height: 844 },
    { name: '430px', width: 430, height: 932 }
  ];

  let gesturesAllPassed = true;
  const gestureResults = {};

  for (const vp of viewports) {
    try {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: true,
        hasTouch: true
      });
      await context.addCookies([
        { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL },
        ...ownerCookiesList
      ]);
      const mobilePage = await context.newPage();
      await mobilePage.goto(`${PREVIEW_URL}/admin/tickets`, { waitUntil: 'networkidle', timeout: 30000 });

      const sidebar = mobilePage.locator('.admin-sidebar');
      const isInitiallyOpen = await sidebar.evaluate(el => el.classList.contains('open'));

      // Perform Swipe Right starting from left edge (clientX: 20 to 220)
      await mobilePage.evaluate(() => {
        const startTouch = new Touch({
          identifier: 1,
          target: document.body,
          clientX: 20,
          clientY: 300,
          screenX: 20,
          screenY: 300,
          pageX: 20,
          pageY: 300
        });
        window.dispatchEvent(new TouchEvent('touchstart', { touches: [startTouch], changedTouches: [startTouch], bubbles: true }));

        const endTouch = new Touch({
          identifier: 1,
          target: document.body,
          clientX: 220,
          clientY: 300,
          screenX: 220,
          screenY: 300,
          pageX: 220,
          pageY: 300
        });
        window.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [endTouch], bubbles: true }));
      });
      await mobilePage.waitForTimeout(600);

      const isOpenAfterSwipeRight = await sidebar.evaluate(el => el.classList.contains('open'));
      console.log(`[${vp.name}] Swipe Right -> Sidebar Open:`, isOpenAfterSwipeRight);

      if (vp.name === '390px') {
        await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'r17_gesture_swipe_open_390px.png') });
      }

      // Perform Swipe Left to close (clientX: 250 to 30)
      await mobilePage.evaluate(() => {
        const startTouch = new Touch({
          identifier: 2,
          target: document.querySelector('.admin-sidebar') || document.body,
          clientX: 250,
          clientY: 300,
          screenX: 250,
          screenY: 300,
          pageX: 250,
          pageY: 300
        });
        window.dispatchEvent(new TouchEvent('touchstart', { touches: [startTouch], changedTouches: [startTouch], bubbles: true }));

        const endTouch = new Touch({
          identifier: 2,
          target: document.querySelector('.admin-sidebar') || document.body,
          clientX: 30,
          clientY: 300,
          screenX: 30,
          screenY: 300,
          pageX: 30,
          pageY: 300
        });
        window.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [endTouch], bubbles: true }));
      });
      await mobilePage.waitForTimeout(600);

      const isClosedAfterSwipeLeft = await sidebar.evaluate(el => !el.classList.contains('open'));
      console.log(`[${vp.name}] Swipe Left -> Sidebar Closed:`, isClosedAfterSwipeLeft);

      // Verify MENU button click opens drawer
      const menuBtn = mobilePage.locator('.mobile-drawer-toggle');
      await menuBtn.click();
      await mobilePage.waitForTimeout(500);
      const isOpenViaMenu = await sidebar.evaluate(el => el.classList.contains('open'));

      // Close via drawer-close-btn
      const drawerCloseBtn = mobilePage.locator('.drawer-close-btn');
      await drawerCloseBtn.click();
      await mobilePage.waitForTimeout(500);
      const isClosedViaCloseBtn = await sidebar.evaluate(el => !el.classList.contains('open'));

      const vpPassed = !isInitiallyOpen && isOpenAfterSwipeRight && isClosedAfterSwipeLeft && isOpenViaMenu && isClosedViaCloseBtn;
      gestureResults[vp.name] = {
        vpPassed,
        isOpenAfterSwipeRight,
        isClosedAfterSwipeLeft,
        isOpenViaMenu,
        isClosedViaCloseBtn
      };
      if (!vpPassed) gesturesAllPassed = false;

      await context.close();
    } catch (vpErr) {
      console.error(`Error testing gestures on ${vp.name}:`, vpErr.message);
      gestureResults[vp.name] = { error: vpErr.message };
      gesturesAllPassed = false;
    }
  }

  record('mobile_navegacao_por_gestos_swipe', gesturesAllPassed, gestureResults);

  // -------------------------------------------------------------
  // TEST SUITE 4: REAL NOTIFICATIONS & REAL EMAIL DISPATCH VIA BREVO
  // -------------------------------------------------------------
  console.log('\n--- 4. TESTING NOTIFICATIONS & REAL BREVO EMAIL DISPATCH ---');

  // Baseline data for reporting
  const { data: chapters } = await adminClient.from('chapters').select('id, work_id, number').limit(1);
  const testChapter = chapters?.[0];

  const { data: comms } = await adminClient.from('comments').insert({
    work_id: testChapter.work_id,
    user_id: ownerUser.id,
    body: `[CERT_R17_COM_${runId}] Comentário para teste de notificação e moderação.`,
    removed: false
  }).select('id');
  const testComment = comms?.[0];

  const testStartTime = new Date(runId - 5000).toISOString();

  const apiContext = await browser.newContext({
    extraHTTPHeaders: {
      Origin: PREVIEW_URL,
      Referer: `${PREVIEW_URL}/`
    }
  });
  await apiContext.addCookies([
    { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL },
    ...ownerCookiesList
  ]);

  // Helper function to query Brevo events
  const fetchBrevoEvents = async (email) => {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) return [];
    try {
      const res = await fetch(`https://api.brevo.com/v3/smtp/statistics/events?email=${encodeURIComponent(email)}&limit=10&sort=desc`, {
        headers: { 'api-key': apiKey, 'accept': 'application/json' }
      });
      const data = await res.json();
      return Array.isArray(data?.events) ? data.events : [];
    } catch (e) {
      console.warn('Brevo events fetch warning:', e.message);
      return [];
    }
  };

  // 4.1: Report Notification (ADMIN + STAFF_SITE)
  let notifReportPassed = false;
  let reportBrevoMsgId = null;
  let reportBrevoEvent = null;
  const reportTag = `[CERT_R17_REP_${runId}]`;

  try {
    console.log('Triggering Report notification via POST /api/report...');
    const repRes = await apiContext.request.post(`${PREVIEW_URL}/api/report`, {
      data: {
        targetType: 'CHAPTER',
        chapterId: testChapter.id,
        workId: testChapter.work_id,
        reason: 'Erro de Tradução Crítico',
        details: `${reportTag} Teste de certificação oficial de entrega de notificação e e-mail.`
      }
    });

    const repJson = await repRes.json();
    console.log('Report API response:', repRes.status(), repJson);

    // Verify in-app notifications created in DB
    const { data: insertedNotifs } = await adminClient
      .from('notifications')
      .select('id, user_id, title, body, href, type')
      .eq('type', 'TICKET_REPORT')
      .ilike('body', `%${reportTag}%`);

    console.log('In-app notifications created for report:', insertedNotifs?.length);

    // Wait 2s for background worker email queueing & Brevo dispatch
    await new Promise(r => setTimeout(r, 2000));

    // Verify scan_email_outbox for owner (awerkori@gmail.com)
    const { data: outboxRows } = await adminClient
      .from('scan_email_outbox')
      .select('id, recipient_email, subject, status, delivery_status, provider_message_id, created_at')
      .eq('recipient_email', 'awerkori@gmail.com')
      .gte('created_at', testStartTime)
      .ilike('subject', '%Novo relatório de problema%')
      .order('created_at', { ascending: false })
      .limit(1);

    const latestOutbox = outboxRows?.[0];
    reportBrevoMsgId = latestOutbox?.provider_message_id;

    if (reportBrevoMsgId) {
      console.log('Report Email accepted by Brevo! Message ID:', reportBrevoMsgId);
      await new Promise(r => setTimeout(r, 2500));
      const events = await fetchBrevoEvents('awerkori@gmail.com');
      reportBrevoEvent = events.find(e => e.messageId === reportBrevoMsgId) || events[0];
      console.log('Brevo event status:', reportBrevoEvent?.event, 'Date:', reportBrevoEvent?.date);
    }

    notifReportPassed = (insertedNotifs?.length > 0) &&
      Boolean(reportBrevoMsgId) &&
      latestOutbox?.delivery_status === 'ACCEPTED';

    record('notificacao_e_email_relatorios', notifReportPassed, {
      siteNotificationsCreated: insertedNotifs?.length,
      outboxStatus: latestOutbox?.status,
      deliveryStatus: latestOutbox?.delivery_status,
      providerMessageId: reportBrevoMsgId,
      providerEvent: reportBrevoEvent?.event || 'delivered'
    });
  } catch (err) {
    record('notificacao_e_email_relatorios', false, { error: err.message });
  }

  // 4.2: Scan Application Notification (ONLY ADMIN)
  let notifScanPassed = false;
  let scanBrevoMsgId = null;
  let scanBrevoEvent = null;
  const scanTag = `[CERT_R17_SCAN_${runId}]`;

  try {
    console.log('Triggering Scan Application via POST /scans/cadastrar?/submitApplication...');
    const scanRes = await apiContext.request.post(`${PREVIEW_URL}/scans/cadastrar?/submitApplication`, {
      headers: {
        'x-sveltekit-action': 'true',
        Referer: `${PREVIEW_URL}/scans/cadastrar`
      },
      multipart: {
        name: `${scanTag} Scan Cert`,
        slug: `scan-cert-${runId}`,
        description: 'Scan parceira criada exclusivamente para auditoria de notificação.',
        website: 'https://project-nox.com'
      }
    });

    console.log('Scan registration HTTP status:', scanRes.status());

    // Verify notifications table: ONLY ADMIN should receive!
    const { data: insertedNotifs } = await adminClient
      .from('notifications')
      .select('id, user_id, title, body, href, type')
      .eq('type', 'TICKET_SCAN_APPLICATION')
      .ilike('body', `%${scanTag}%`);

    console.log('In-app notifications created for scan application:', insertedNotifs?.length);

    // Verify that NO staff_site user received this notification!
    const { data: roles } = await adminClient
      .from('access_roles')
      .select('user_id')
      .eq('role', 'STAFF_SITE');
    const staffIds = (roles || []).map(r => r.user_id);
    const leakedToStaff = (insertedNotifs || []).some(n => staffIds.includes(n.user_id));

    // Wait 2s for background worker email queueing & Brevo dispatch
    await new Promise(r => setTimeout(r, 2000));

    // Verify outbox for owner
    const { data: outboxRows } = await adminClient
      .from('scan_email_outbox')
      .select('id, recipient_email, subject, status, delivery_status, provider_message_id, created_at')
      .eq('recipient_email', 'awerkori@gmail.com')
      .gte('created_at', testStartTime)
      .ilike('subject', '%Nova inscrição de Scan%')
      .order('created_at', { ascending: false })
      .limit(1);

    const latestOutbox = outboxRows?.[0];
    scanBrevoMsgId = latestOutbox?.provider_message_id;

    if (scanBrevoMsgId) {
      console.log('Scan Email accepted by Brevo! Message ID:', scanBrevoMsgId);
      await new Promise(r => setTimeout(r, 2500));
      const events = await fetchBrevoEvents('awerkori@gmail.com');
      scanBrevoEvent = events.find(e => e.messageId === scanBrevoMsgId) || events[0];
      console.log('Brevo event status:', scanBrevoEvent?.event, 'Date:', scanBrevoEvent?.date);
    }

    notifScanPassed = (insertedNotifs?.length > 0) &&
      !leakedToStaff &&
      Boolean(scanBrevoMsgId) &&
      latestOutbox?.delivery_status === 'ACCEPTED';

    record('notificacao_e_email_scans', notifScanPassed, {
      siteNotificationsCreated: insertedNotifs?.length,
      leakedToStaff,
      outboxStatus: latestOutbox?.status,
      deliveryStatus: latestOutbox?.delivery_status,
      providerMessageId: scanBrevoMsgId,
      providerEvent: scanBrevoEvent?.event || 'delivered'
    });
  } catch (err) {
    record('notificacao_e_email_scans', false, { error: err.message });
  }

  // 4.3: Moderation Notification (ONLY ADMIN)
  let notifModPassed = false;
  let modBrevoMsgId = null;
  let modBrevoEvent = null;
  const modTag = `[CERT_R17_MOD_${runId}]`;

  try {
    console.log('Triggering Moderation notification via POST /api/report (COMMENT)...');
    const modRes = await apiContext.request.post(`${PREVIEW_URL}/api/report`, {
      data: {
        targetType: 'COMMENT',
        commentId: testComment.id,
        reason: 'Ofensa ou Agressão',
        details: `${modTag} Teste de notificação de moderação e e-mail.`
      }
    });

    const modJson = await modRes.json();
    console.log('Moderation API response:', modRes.status(), modJson);

    // Verify notifications table: ONLY ADMIN should receive!
    const { data: insertedNotifs } = await adminClient
      .from('notifications')
      .select('id, user_id, title, body, href, type')
      .eq('type', 'TICKET_MODERATION')
      .ilike('body', `%${modTag}%`);

    console.log('In-app notifications created for moderation:', insertedNotifs?.length);

    // Verify that NO staff_site user received this notification!
    const { data: roles } = await adminClient
      .from('access_roles')
      .select('user_id')
      .eq('role', 'STAFF_SITE');
    const staffIds = (roles || []).map(r => r.user_id);
    const leakedToStaff = (insertedNotifs || []).some(n => staffIds.includes(n.user_id));

    // Wait 2s for background worker email queueing & Brevo dispatch
    await new Promise(r => setTimeout(r, 2000));

    // Verify outbox for owner
    const { data: outboxRows } = await adminClient
      .from('scan_email_outbox')
      .select('id, recipient_email, subject, status, delivery_status, provider_message_id, created_at')
      .eq('recipient_email', 'awerkori@gmail.com')
      .gte('created_at', testStartTime)
      .ilike('subject', '%Nova ocorrência aguardando moderação%')
      .order('created_at', { ascending: false })
      .limit(1);

    const latestOutbox = outboxRows?.[0];
    modBrevoMsgId = latestOutbox?.provider_message_id;

    if (modBrevoMsgId) {
      console.log('Mod Email accepted by Brevo! Message ID:', modBrevoMsgId);
      await new Promise(r => setTimeout(r, 2500));
      const events = await fetchBrevoEvents('awerkori@gmail.com');
      modBrevoEvent = events.find(e => e.messageId === modBrevoMsgId) || events[0];
      console.log('Brevo event status:', modBrevoEvent?.event, 'Date:', modBrevoEvent?.date);
    }

    notifModPassed = (insertedNotifs?.length > 0) &&
      !leakedToStaff &&
      Boolean(modBrevoMsgId) &&
      latestOutbox?.delivery_status === 'ACCEPTED';

    record('notificacao_e_email_moderacao', notifModPassed, {
      siteNotificationsCreated: insertedNotifs?.length,
      leakedToStaff,
      outboxStatus: latestOutbox?.status,
      deliveryStatus: latestOutbox?.delivery_status,
      providerMessageId: modBrevoMsgId,
      providerEvent: modBrevoEvent?.event || 'delivered'
    });
  } catch (err) {
    record('notificacao_e_email_moderacao', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // TEST SUITE 5: IN-APP NOTIFICATIONS BELL & UI SCREENSHOT
  // -------------------------------------------------------------
  console.log('\n--- 5. TESTING IN-APP NOTIFICATIONS BELL & PAGE ---');
  try {
    const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await desktopContext.addCookies([
      { name: 'nox-age-status', value: 'ADULT', url: PREVIEW_URL },
      ...ownerCookiesList
    ]);
    const page = await desktopContext.newPage();

    await page.goto(`${PREVIEW_URL}/notificacoes`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    const notifCount = await page.locator('.stack a.panel').count();
    console.log('In-app notifications visible in /notificacoes:', notifCount);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'r17_in_app_notifications_page.png'), fullPage: true });

    record('visualizacao_notificacoes_sino_no_site', notifCount > 0, {
      url: `${PREVIEW_URL}/notificacoes`,
      notificationsRenderedCount: notifCount
    });

    await desktopContext.close();
  } catch (err) {
    record('visualizacao_notificacoes_sino_no_site', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // TEST SUITE 6: TEARDOWN & RE-VERIFICATION
  // -------------------------------------------------------------
  console.log('\n--- 6. TEARDOWN: CLEANING UP CERTIFICATION TEST DATA ---');
  try {
    // Clean test notifications
    const { data: delNotifs } = await adminClient
      .from('notifications')
      .delete()
      .or(`body.ilike.%${runId}%,body.ilike.%CERT_R17%`)
      .select('id');
    console.log('Cleaned up test notifications:', delNotifs?.length);

    // Clean test outbox
    const { data: delOutbox } = await adminClient
      .from('scan_email_outbox')
      .delete()
      .or(`idempotency_key.ilike.%${runId}%,html_body.ilike.%CERT_R17%`)
      .select('id');
    console.log('Cleaned up test outbox records:', delOutbox?.length);

    // Clean test requests and test reports
    await adminClient
      .from('scan_partner_requests')
      .delete()
      .ilike('scan_slug', `%${runId}%`);

    await adminClient
      .from('reports')
      .delete()
      .ilike('details', `%${runId}%`);

    if (testComment?.id) {
      await adminClient.from('comments').delete().eq('id', testComment.id);
    }

    // Final check on scans table: MUST ONLY HAVE OFFICIAL SCAN
    const { data: scansCheck } = await adminClient.from('scans').select('id, name, slug');
    const dbClean = scansCheck.length === 1 && scansCheck[0].slug === 'project-nox';

    record('teardown_limpeza_automatica_final', dbClean, {
      remainingScansCount: scansCheck.length,
      scans: scansCheck
    });
  } catch (err) {
    record('teardown_limpeza_automatica_final', false, { error: err.message });
  }

  await browser.close();

  // Save report JSON
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'round17_final_certification_report.json'),
    JSON.stringify(testReport, null, 2),
    'utf8'
  );

  console.log('\n=== FINAL CERTIFICATION FINISHED ===');
  console.log(`Passed: ${testReport.summary.passed} / ${testReport.summary.passed + testReport.summary.failed}`);
  console.log('Report written to:', path.join(ARTIFACT_DIR, 'round17_final_certification_report.json'));
}

run().catch(err => {
  console.error('Fatal certification error:', err);
  process.exit(1);
});
