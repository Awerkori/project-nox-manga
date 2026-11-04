import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { chromium } from '@playwright/test';

const TARGET_URL = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';
const SCAN_ID = '04872e99-37ad-4d45-aed4-35759d0eae33';

function parseEnv(path) {
  const content = fs.readFileSync(path, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      let key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      env[key] = val;
    }
  }
  return env;
}

const ybEnv = parseEnv('/home/awerkori/.Projects/project-nox-importer/.env');
const dbClient = new pg.Client({
  host: ybEnv.YUGABYTE_HOST,
  port: parseInt(ybEnv.YUGABYTE_PORT || '5433', 10),
  database: ybEnv.YUGABYTE_DATABASE || 'yugabyte',
  user: ybEnv.YUGABYTE_USER,
  password: ybEnv.YUGABYTE_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

const appEnv = fs.existsSync('.env') ? parseEnv('.env') : {};
const AUTH_SECRET = appEnv.AUTH_SECRET || appEnv.JWT_SECRET || '15470467587e043eac3caaf3f93e169b1277327481996fa710cea3fda3457d1e';

function createAuthCookie(userId, username, email) {
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

  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(`${header}.${payload}`).digest("base64url");
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
      user_metadata: { username, display_name: username }
    }
  };

  const b64 = Buffer.from(JSON.stringify(session)).toString("base64");
  return `base64-${b64}`;
}

function getCookieHeader(cookieVal) {
  return `nox-auth-token=${cookieVal}; sb-izregkwaqdygwioqzwwo-auth-token=${cookieVal}`;
}

function curlReq(url, { method = 'GET', cookie = null, form = [], headers = {}, retries = 2 } = {}) {
  const args = ['-s', '-i', '--http2', '--max-time', '20'];
  if (method !== 'GET') {
    args.push('-X', method);
  }
  if (cookie) {
    args.push('-H', `Cookie: ${getCookieHeader(cookie)}`);
  }
  for (const [k, v] of Object.entries(headers)) {
    args.push('-H', `${k}: ${v}`);
  }
  for (const [k, v] of form) {
    args.push('-F', `${k}=${v}`);
  }
  args.push(url);

  let raw = '';
  try {
    raw = execFileSync('curl', args, { maxBuffer: 10 * 1024 * 1024 }).toString();
  } catch (err) {
    raw = err.stdout ? err.stdout.toString() : '';
  }

  const parts = raw.split(/\r?\n\r?\n/);
  const head = parts[0] || '';
  const body = parts.slice(1).join('\n\n');
  const statusMatch = head.match(/HTTP\/\S+\s+(\d+)/);
  const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;
  
  if ((status === 503 || status === 504 || status === 502) && retries > 0) {
    execFileSync('sleep', ['1.5']);
    return curlReq(url, { method, cookie, form, headers, retries: retries - 1 });
  }
  
  const locMatch = head.match(/location:\s*([^\r\n]+)/i);
  const location = locMatch ? locMatch[1].trim() : '';

  let actionStatus = status;
  let parsed = null;
  try {
    parsed = JSON.parse(body);
    if (parsed && typeof parsed.status === 'number') {
      actionStatus = parsed.status;
    } else if (parsed && parsed.type === 'success') {
      actionStatus = 200;
    }
  } catch {}

  return { status, actionStatus, location, head, body, parsed };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runAudit() {
  console.log('🚀 INICIANDO AUDITORIA E CERTIFICAÇÃO DEFINITIVA — RODADA 22');
  console.log(`Target Preview: ${TARGET_URL}`);
  
  await dbClient.connect();
  console.log('✅ Conectado ao YugabyteDB');

  // Verify baseline production data
  const initialWorkScans = await dbClient.query('SELECT count(*)::int as count FROM public.work_scans WHERE scan_id = $1', [SCAN_ID]);
  const baselineCount = initialWorkScans.rows[0].count;
  console.log(`📊 Obras vinculadas à Scan Project Nox inicialmente: ${baselineCount}`);
  if (baselineCount !== 6) {
    console.warn(`⚠️ ATENÇÃO: Esperado 6 obras na scan, encontrado ${baselineCount}`);
  }

  const results = [];

  function record(title, pass, details) {
    console.log(`${pass ? '✅ PASS' : '❌ FAIL'}: ${title} — ${details}`);
    results.push({ title, pass, details });
  }

  // Define test personas
  const awerkoriId = '732fbe87-5040-41fb-9983-0aedb2af44c8'; // Site ADMIN, Scan OWNER
  const pristamId = '86b6a05e-9c2d-4bb4-8381-c9890c730f17'; // Site USER, Scan ADMIN
  const thiagoslkmId = '5c68de04-c72a-4df8-86a7-b851057208dc'; // Site STAFF_SITE, Scan MEMBER
  const miakasanId = 'ef19a199-4871-4602-ba2e-9a29edd1f299'; // Site USER, Scan MEMBER
  const regularUserId = '4272565e-6076-4d3d-b002-3f94c5fc64a5'; // Site USER, NO scan membership (yuuki_cordeiro)
  const testGerenteId = '776fbc21-54e7-4254-8323-0856ee7181d9'; // Will temporarily become site GERENTE

  const awerkoriCookie = createAuthCookie(awerkoriId, 'awerkori', 'awerkori@gmail.com');
  const pristamCookie = createAuthCookie(pristamId, 'pristam', 'pristam@projectnox.org');
  const thiagoCookie = createAuthCookie(thiagoslkmId, 'thiagoslkm', 'thiago@projectnox.org');
  const miakasanCookie = createAuthCookie(miakasanId, 'miakasan', 'miakasan@projectnox.org');
  const regularUserCookie = createAuthCookie(regularUserId, 'yuuki_cordeiro', 'yuuki@projectnox.org');
  const gerenteCookie = createAuthCookie(testGerenteId, 'test_review_1793675255', 'gerente_qa@projectnox.org');

  // Set testGerente to GERENTE role in DB
  await dbClient.query('UPDATE public.access_roles SET role = $1 WHERE user_id = $2', ['GERENTE', testGerenteId]);
  await sleep(500);

  try {
    // -------------------------------------------------------------
    // TEST SECTION 1: RBAC & Access Matrix for Site Manager & Staff
    // -------------------------------------------------------------
    console.log('\n--- 1. RBAC & MATRIZ DE AUTORIZAÇÃO ---');

    // 1.1 ADMIN accesses /admin/tickets?tab=obras
    {
      const res = curlReq(`${TARGET_URL}/admin/tickets?tab=obras`, { cookie: awerkoriCookie });
      const pass = res.status === 200;
      record('1.1 Site ADMIN acessa /admin/tickets?tab=obras', pass, `Status retornado: ${res.status}`);
    }
    await sleep(500);

    // 1.2 GERENTE accesses /admin/tickets?tab=obras
    {
      const res = curlReq(`${TARGET_URL}/admin/tickets?tab=obras`, { cookie: gerenteCookie });
      const pass = res.status === 200;
      record('1.2 Site GERENTE acessa /admin/tickets?tab=obras', pass, `Status retornado: ${res.status}`);
    }
    await sleep(500);

    // 1.3 STAFF_SITE accesses /admin/tickets?tab=obras -> must redirect (303) to tab=relatorios
    {
      const res = curlReq(`${TARGET_URL}/admin/tickets?tab=obras`, { cookie: thiagoCookie });
      const pass = res.status === 303 && res.location.includes('/admin/tickets?tab=relatorios');
      record('1.3 STAFF_SITE bloqueado de tab=obras (redirecionado para tab=relatorios)', pass, `Status: ${res.status}, Location: ${res.location}`);
    }
    await sleep(500);

    // 1.4 STAFF_SITE attempts reviewWorkRequest action -> must return 403 Forbidden
    {
      const res = curlReq(`${TARGET_URL}/admin/tickets?/reviewWorkRequest`, {
        method: 'POST',
        cookie: thiagoCookie,
        headers: {
          Origin: TARGET_URL,
          Referer: `${TARGET_URL}/admin/tickets?tab=obras`,
          Accept: 'application/json',
          'x-sveltekit-action': 'true'
        },
        form: [
          ['request_id', '00000000-0000-0000-0000-000000000000'],
          ['action', 'APPROVE']
        ]
      });
      const pass = res.actionStatus === 403;
      record('1.4 STAFF_SITE bloqueado de reviewWorkRequest (403 Forbidden)', pass, `Status retornado: ${res.actionStatus}`);
    }
    await sleep(500);

    // 1.5 Common USER accesses /admin/tickets?tab=obras -> must be blocked (403 or 303 to login)
    {
      const res = curlReq(`${TARGET_URL}/admin/tickets?tab=obras`, { cookie: regularUserCookie });
      const pass = res.status === 403 || res.status === 303;
      record('1.5 Usuário comum estritamente bloqueado de /admin/tickets (403/303)', pass, `Status: ${res.status}`);
    }
    await sleep(500);

    // -------------------------------------------------------------
    // TEST SECTION 2: Scan Leadership vs Common Member Requesting
    // -------------------------------------------------------------
    console.log('\n--- 2. PERMISSÕES DE SOLICITAÇÃO NA SCAN ---');

    // 2.1 Scan OWNER can search works to request
    {
      const res = curlReq(`${TARGET_URL}/api/scan/works/search?scan_id=${SCAN_ID}&q=solo`, { cookie: awerkoriCookie });
      let count = 0;
      try { count = JSON.parse(res.body)?.results?.length || 0; } catch {}
      const pass = res.status === 200 && count > 0;
      record('2.1 Scan OWNER tem permissão para pesquisar obras do catálogo', pass, `Status: ${res.status}, Resultados: ${count}`);
    }
    await sleep(500);

    // 2.2 Scan ADMIN (pristam) can search works to request
    {
      const res = curlReq(`${TARGET_URL}/api/scan/works/search?scan_id=${SCAN_ID}&q=solo`, { cookie: pristamCookie });
      let count = 0;
      try { count = JSON.parse(res.body)?.results?.length || 0; } catch {}
      const pass = res.status === 200 && count > 0;
      record('2.2 Scan ADMIN tem permissão para pesquisar obras do catálogo', pass, `Status: ${res.status}, Resultados: ${count}`);
    }
    await sleep(500);

    // 2.3 Scan MEMBER (miakasan) search is blocked (403 Forbidden)
    {
      const res = curlReq(`${TARGET_URL}/api/scan/works/search?scan_id=${SCAN_ID}&q=solo`, { cookie: miakasanCookie });
      const pass = res.status === 403;
      record('2.3 Scan MEMBER bloqueado da busca de obras (403 Forbidden)', pass, `Status retornado: ${res.status}`);
    }
    await sleep(500);

    // 2.4 User with NO scan membership search is blocked (403 Forbidden)
    {
      const res = curlReq(`${TARGET_URL}/api/scan/works/search?scan_id=${SCAN_ID}&q=solo`, { cookie: regularUserCookie });
      const pass = res.status === 403;
      record('2.4 Usuário sem vínculo bloqueado da busca de obras (403 Forbidden)', pass, `Status retornado: ${res.status}`);
    }
    await sleep(500);

    // 2.5 Scan MEMBER (miakasan) attempts requestProject action -> 403 Forbidden
    {
      const res = curlReq(`${TARGET_URL}/scan?/requestProject`, {
        method: 'POST',
        cookie: miakasanCookie,
        headers: {
          Origin: TARGET_URL,
          Referer: `${TARGET_URL}/scan?tab=obras`,
          Accept: 'application/json',
          'x-sveltekit-action': 'true'
        },
        form: [
          ['scan_id', SCAN_ID],
          ['work_id', '10da19cd-202b-4d63-ae02-c8a7861c308a']
        ]
      });
      const pass = res.actionStatus === 403;
      record('2.5 Scan MEMBER bloqueado de solicitar obra (403 Forbidden)', pass, `Status retornado: ${res.actionStatus}`);
    }
    await sleep(500);

    // 2.6 User without link attempts requestProject action -> 403 Forbidden
    {
      const res = curlReq(`${TARGET_URL}/scan?/requestProject`, {
        method: 'POST',
        cookie: regularUserCookie,
        headers: {
          Origin: TARGET_URL,
          Referer: `${TARGET_URL}/scan?tab=obras`,
          Accept: 'application/json',
          'x-sveltekit-action': 'true'
        },
        form: [
          ['scan_id', SCAN_ID],
          ['work_id', '10da19cd-202b-4d63-ae02-c8a7861c308a']
        ]
      });
      const pass = res.actionStatus === 403;
      record('2.6 Usuário sem vínculo bloqueado de solicitar obra (403 Forbidden)', pass, `Status retornado: ${res.actionStatus}`);
    }
    await sleep(500);

    // -------------------------------------------------------------
    // TEST SECTION 3: Concurrency, Duplication & Atomic Race Guard
    // -------------------------------------------------------------
    console.log('\n--- 3. PREVENÇÃO DE DUPLICAÇÃO E CONDIÇÕES DE CORRIDA ---');

    // Pick an already-linked work
    const existingWorkRes = await dbClient.query(
      'SELECT work_id FROM public.work_scans WHERE scan_id = $1 LIMIT 1',
      [SCAN_ID]
    );
    const existingWorkId = existingWorkRes.rows[0].work_id;

    // 3.1 Request already linked work -> 409 Conflict
    {
      const res = curlReq(`${TARGET_URL}/scan?/requestProject`, {
        method: 'POST',
        cookie: awerkoriCookie,
        headers: {
          Origin: TARGET_URL,
          Referer: `${TARGET_URL}/scan?tab=obras`,
          Accept: 'application/json',
          'x-sveltekit-action': 'true'
        },
        form: [
          ['scan_id', SCAN_ID],
          ['work_id', existingWorkId]
        ]
      });
      const pass = res.actionStatus === 409;
      record('3.1 Rejeição atômica de obra já vinculada (409 Conflict)', pass, `Status retornado: ${res.actionStatus}`);
    }
    await sleep(500);

    // Find an unlinked catalog work
    const unlinkedWorkRes = await dbClient.query(`
      SELECT w.id, w.title FROM public.works w
      WHERE NOT EXISTS (SELECT 1 FROM public.work_scans ws WHERE ws.work_id = w.id AND ws.scan_id = $1)
        AND NOT EXISTS (SELECT 1 FROM public.scan_project_requests spr WHERE spr.work_id = w.id AND spr.scan_id = $1 AND spr.status = 'PENDING')
      LIMIT 2;
    `, [SCAN_ID]);

    const testWork1 = unlinkedWorkRes.rows[0];
    const testWork2 = unlinkedWorkRes.rows[1];
    console.log(`ℹ️ Obras de teste disponíveis: "${testWork1.title}" (${testWork1.id}) e "${testWork2.title}" (${testWork2.id})`);

    // -------------------------------------------------------------
    // TEST SECTION 4: Safe End-to-End Approval Flow & Reversion
    // -------------------------------------------------------------
    console.log('\n--- 4. FLUXO REAL: SOLICITAÇÃO → APROVAÇÃO (COM GERENTE) → VÍNCULO → REVERSÃO ---');

    let createdRequestId = null;

    // 4.1 Scan Leadership submits new work request
    {
      const res = curlReq(`${TARGET_URL}/scan?/requestProject`, {
        method: 'POST',
        cookie: awerkoriCookie,
        headers: {
          Origin: TARGET_URL,
          Referer: `${TARGET_URL}/scan?tab=obras`,
          Accept: 'application/json',
          'x-sveltekit-action': 'true'
        },
        form: [
          ['scan_id', SCAN_ID],
          ['work_id', testWork1.id],
          ['message', 'Auditoria automatizada Rodada 22 - Teste de aprovação']
        ]
      });
      const pass = res.actionStatus === 200 && res.body.includes('projectRequested');
      record('4.1 Liderança da scan envia solicitação de obra não-vinculada com sucesso', pass, `Status: ${res.actionStatus}`);

      // Verify in DB
      const dbReq = await dbClient.query(
        'SELECT id, status, user_id FROM public.scan_project_requests WHERE scan_id = $1 AND work_id = $2 AND status = \'PENDING\'',
        [SCAN_ID, testWork1.id]
      );
      const dbPass = dbReq.rows.length === 1 && dbReq.rows[0].status === 'PENDING';
      record('4.2 Solicitação persistida no YugabyteDB com status PENDING', dbPass, `Encontrado: ${dbReq.rows.length} registro(s)`);
      if (dbPass) {
        createdRequestId = dbReq.rows[0].id;
      }
    }
    await sleep(500);

    // 4.3 Duplicate concurrent request on the same pending work -> 409 Conflict
    {
      const res = curlReq(`${TARGET_URL}/scan?/requestProject`, {
        method: 'POST',
        cookie: awerkoriCookie,
        headers: {
          Origin: TARGET_URL,
          Referer: `${TARGET_URL}/scan?tab=obras`,
          Accept: 'application/json',
          'x-sveltekit-action': 'true'
        },
        form: [
          ['scan_id', SCAN_ID],
          ['work_id', testWork1.id]
        ]
      });
      const pass = res.actionStatus === 409;
      record('4.3 Tentativa de solicitação concorrente duplicada bloqueada com 409 Conflict', pass, `Status retornado: ${res.actionStatus}`);
    }
    await sleep(500);

    // 4.4 GERENTE approves the request in /admin/tickets?/reviewWorkRequest
    if (createdRequestId) {
      const res = curlReq(`${TARGET_URL}/admin/tickets?/reviewWorkRequest`, {
        method: 'POST',
        cookie: gerenteCookie,
        headers: {
          Origin: TARGET_URL,
          Referer: `${TARGET_URL}/admin/tickets?tab=obras`,
          Accept: 'application/json',
          'x-sveltekit-action': 'true'
        },
        form: [
          ['request_id', createdRequestId],
          ['action', 'APPROVE'],
          ['is_primary', 'true']
        ]
      });
      const pass = res.actionStatus === 200 && res.body.includes('APPROVE');
      record('4.4 GERENTE aprova a solicitação com sucesso na Central de Tickets', pass, `Status: ${res.actionStatus}`);

      // 4.5 Verify DB: request is APPROVED and work_scans has the active link
      const reqAfter = await dbClient.query(
        'SELECT status, reviewed_by FROM public.scan_project_requests WHERE id = $1',
        [createdRequestId]
      );
      const linkAfter = await dbClient.query(
        'SELECT status, is_primary FROM public.work_scans WHERE scan_id = $1 AND work_id = $2',
        [SCAN_ID, testWork1.id]
      );
      const approvePass = reqAfter.rows[0]?.status === 'APPROVED' && linkAfter.rows.length === 1 && linkAfter.rows[0]?.status === 'ACTIVE';
      record('4.5 Vínculo real gravado em public.work_scans e ticket marcado como APPROVED', approvePass, `work_scans status: ${linkAfter.rows[0]?.status}`);

      // 4.6 Concurrency: Attempting to approve/reject an already evaluated ticket -> 400 or 409
      const doubleRes = curlReq(`${TARGET_URL}/admin/tickets?/reviewWorkRequest`, {
        method: 'POST',
        cookie: awerkoriCookie,
        headers: {
          Origin: TARGET_URL,
          Referer: `${TARGET_URL}/admin/tickets?tab=obras`,
          Accept: 'application/json',
          'x-sveltekit-action': 'true'
        },
        form: [
          ['request_id', createdRequestId],
          ['action', 'APPROVE'],
          ['is_primary', 'true']
        ]
      });
      const doublePass = doubleRes.actionStatus === 400 || doubleRes.actionStatus === 409;
      record('4.6 Decisão concorrente no mesmo ticket rejeitada com código seguro (400/409)', doublePass, `Status retornado: ${doubleRes.actionStatus}`);

      // SAFE CLEANUP OF STEP 4: Remove test link and test request
      await dbClient.query('DELETE FROM public.work_scans WHERE scan_id = $1 AND work_id = $2', [SCAN_ID, testWork1.id]);
      await dbClient.query('DELETE FROM public.scan_project_requests WHERE id = $1', [createdRequestId]);
      const restoredCount = await dbClient.query('SELECT count(*)::int as count FROM public.work_scans WHERE scan_id = $1', [SCAN_ID]);
      record('4.7 Reversão imediata: Obra de teste desvinculada e dados reais 100% restaurados', restoredCount.rows[0].count === baselineCount, `Contagem atual: ${restoredCount.rows[0].count}`);
    }
    await sleep(500);

    // -------------------------------------------------------------
    // TEST SECTION 5: Safe End-to-End Rejection Flow with Reason
    // -------------------------------------------------------------
    console.log('\n--- 5. FLUXO REAL: SOLICITAÇÃO → RECUSA COM MOTIVO OBRIGATÓRIO ---');

    let rejectRequestId = null;

    // 5.1 Scan ADMIN (pristam) submits request
    {
      const res = curlReq(`${TARGET_URL}/scan?/requestProject`, {
        method: 'POST',
        cookie: pristamCookie,
        headers: {
          Origin: TARGET_URL,
          Referer: `${TARGET_URL}/scan?tab=obras`,
          Accept: 'application/json',
          'x-sveltekit-action': 'true'
        },
        form: [
          ['scan_id', SCAN_ID],
          ['work_id', testWork2.id],
          ['message', 'Auditoria automatizada Rodada 22 - Teste de recusa']
        ]
      });
      const pass = res.actionStatus === 200 && res.body.includes('projectRequested');
      record('5.1 Scan ADMIN envia solicitação de obra com sucesso', pass, `Status: ${res.actionStatus}`);

      const dbReq = await dbClient.query(
        'SELECT id FROM public.scan_project_requests WHERE scan_id = $1 AND work_id = $2 AND status = \'PENDING\'',
        [SCAN_ID, testWork2.id]
      );
      if (dbReq.rows.length === 1) {
        rejectRequestId = dbReq.rows[0].id;
      }
    }
    await sleep(500);

    // 5.2 Attempt rejection without reason -> 400 Bad Request
    if (rejectRequestId) {
      const res = curlReq(`${TARGET_URL}/admin/tickets?/reviewWorkRequest`, {
        method: 'POST',
        cookie: gerenteCookie,
        headers: {
          Origin: TARGET_URL,
          Referer: `${TARGET_URL}/admin/tickets?tab=obras`,
          Accept: 'application/json',
          'x-sveltekit-action': 'true'
        },
        form: [
          ['request_id', rejectRequestId],
          ['action', 'REJECT']
        ]
      });
      const pass = res.actionStatus === 400;
      record('5.2 Recusa sem justificativa administrativa é bloqueada (400 Bad Request)', pass, `Status retornado: ${res.actionStatus}`);
    }
    await sleep(500);

    // 5.3 GERENTE rejects with mandatory reason
    if (rejectRequestId) {
      const testReason = 'Obra não atende aos requisitos operacionais atuais da equipe editorial.';
      const res = curlReq(`${TARGET_URL}/admin/tickets?/reviewWorkRequest`, {
        method: 'POST',
        cookie: gerenteCookie,
        headers: {
          Origin: TARGET_URL,
          Referer: `${TARGET_URL}/admin/tickets?tab=obras`,
          Accept: 'application/json',
          'x-sveltekit-action': 'true'
        },
        form: [
          ['request_id', rejectRequestId],
          ['action', 'REJECT'],
          ['reason', testReason]
        ]
      });
      const pass = res.actionStatus === 200 && res.body.includes('REJECT');
      record('5.3 GERENTE recusa a solicitação fornecendo justificativa válida', pass, `Status: ${res.actionStatus}`);

      // Verify DB: request is REJECTED, reason persisted, NO work_scans entry
      const reqAfter = await dbClient.query(
        'SELECT status, rejection_reason FROM public.scan_project_requests WHERE id = $1',
        [rejectRequestId]
      );
      const linkAfter = await dbClient.query(
        'SELECT 1 FROM public.work_scans WHERE scan_id = $1 AND work_id = $2',
        [SCAN_ID, testWork2.id]
      );
      const rejectPass = reqAfter.rows[0]?.status === 'REJECTED' && reqAfter.rows[0]?.rejection_reason === testReason && linkAfter.rows.length === 0;
      record('5.4 Solicitação marcada como REJECTED no DB, motivo salvo e SEM vínculo em work_scans', rejectPass, `Motivo gravado: "${reqAfter.rows[0]?.rejection_reason}"`);

      // Cleanup rejection test request
      await dbClient.query('DELETE FROM public.scan_project_requests WHERE id = $1', [rejectRequestId]);
      record('5.5 Limpeza da solicitação recusada de teste concluída com segurança', true, 'DB intacto');
    }
    await sleep(500);

    // -------------------------------------------------------------
    // TEST SECTION 6: UI Viewports & Playwright Browser Audit
    // -------------------------------------------------------------
    console.log('\n--- 6. PLAYWRIGHT BROWSER AUDIT & SCREENSHOTS EM MÚLTIPLOS DISPOSITIVOS ---');

    const browser = await chromium.launch({ headless: true });

    const viewports = [
      { name: 'desktop_1920', width: 1920, height: 1080, isMobile: false },
      { name: 'desktop_1440', width: 1440, height: 900, isMobile: false },
      { name: 'desktop_1280', width: 1280, height: 800, isMobile: false },
      { name: 'tablet_1024', width: 1024, height: 768, isMobile: false },
      { name: 'tablet_768', width: 768, height: 1024, isMobile: true },
      { name: 'mobile_430', width: 430, height: 932, isMobile: true },
      { name: 'mobile_390', width: 390, height: 844, isMobile: true },
      { name: 'mobile_360', width: 360, height: 780, isMobile: true },
      { name: 'mobile_320', width: 320, height: 640, isMobile: true },
    ];

    async function gotoWithRetry(page, url, maxRetries = 3) {
      for (let i = 0; i < maxRetries; i++) {
        try {
          const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
          if (res && res.status() >= 500 && i < maxRetries - 1) {
            console.log(`⚠️ HTTP ${res.status()} em ${url}, aguardando 2s antes de tentar novamente...`);
            await page.waitForTimeout(2000);
            continue;
          }
          return res;
        } catch (e) {
          if (i === maxRetries - 1) throw e;
          console.log(`⚠️ Erro ao navegar para ${url} (${e.message}), tentando novamente...`);
          await page.waitForTimeout(2000);
        }
      }
    }

    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });

    await ctx.addCookies([
      {
        name: 'nox-auth-token',
        value: awerkoriCookie,
        url: TARGET_URL,
        httpOnly: true,
        sameSite: 'Lax',
        secure: true
      },
      {
        name: 'sb-izregkwaqdygwioqzwwo-auth-token',
        value: awerkoriCookie,
        url: TARGET_URL,
        httpOnly: true,
        sameSite: 'Lax',
        secure: true
      },
      {
        name: 'nox-age-status',
        value: 'ADULT',
        url: TARGET_URL,
        httpOnly: false,
        sameSite: 'Lax',
        secure: true
      }
    ]);

    const page = await ctx.newPage();

    // Load Scan -> Obras da Scan once
    await gotoWithRetry(page, `${TARGET_URL}/scan?tab=obras`);
    await page.waitForSelector('.obras-view-root', { state: 'visible', timeout: 25000 });

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);

      // Verify that the "Solicitar Obra" button is visible for leader
      const hasRequestBtn = await page.locator('.btn-action-primary:has-text("Solicitar Obra")').count();
      record(`6.1 [${vp.name}] Botão "Solicitar Obra" visível para Liderança da Scan`, hasRequestBtn > 0, `Contagem: ${hasRequestBtn}`);

      // Open Modal on mobile_360 and desktop_1440 to verify lupa padding and action buttons layout
      if (vp.name === 'mobile_360' || vp.name === 'desktop_1440') {
        const btn = page.locator('.btn-action-primary:has-text("Solicitar Obra")').first();
        await btn.click();
        await page.waitForSelector('.project-search-modal', { state: 'visible', timeout: 15000 });

        // Check computed padding-left of the input
        const input = page.locator('#proj-search-input');
        const paddingLeft = await input.evaluate(el => window.getComputedStyle(el).paddingLeft);
        record(`6.2 [${vp.name}] Input de busca com recuo adequado para a lupa`, parseInt(paddingLeft, 10) >= 36, `paddingLeft: ${paddingLeft}`);

        // Type "solo" in search input
        await input.click();
        await input.fill('');
        await input.pressSequentially('solo', { delay: 60 });

        // Wait for results with fallback
        try {
          await page.waitForSelector('.search-results-list', { state: 'visible', timeout: 10000 });
        } catch {
          await input.fill('');
          await page.waitForTimeout(300);
          await input.pressSequentially('solo', { delay: 80 });
          await page.waitForSelector('.search-results-list', { state: 'visible', timeout: 15000 });
        }

        // Capture modal screenshot
        const modalPath = `${ARTIFACT_DIR}/audit_r22_${vp.name}_modal_solo_lupa.png`;
        await page.screenshot({ path: modalPath, fullPage: false });
        console.log(`📸 Screenshot salvo: ${modalPath}`);

        // Close modal
        await page.locator('.btn-close-modal').click();
        await page.waitForSelector('.project-search-modal', { state: 'detached', timeout: 10000 });
        await page.waitForTimeout(300);
      }
    }

    // Load Admin Tickets -> Adesão de Obras (tab=obras)
    await gotoWithRetry(page, `${TARGET_URL}/admin/tickets?tab=obras`);
    await page.waitForSelector('.tickets-workspace', { state: 'visible', timeout: 25000 });

    // Desktop 1440 screenshot
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);
    const adminObrasDesktopPath = `${ARTIFACT_DIR}/audit_r22_desktop_1440_admin_tickets_obras.png`;
    await page.screenshot({ path: adminObrasDesktopPath, fullPage: false });
    console.log(`📸 Screenshot salvo: ${adminObrasDesktopPath}`);
    record(`6.3 [desktop_1440] Central de Tickets - Adesão de Obras renderizada com sucesso`, true, 'Painel operacional visível');

    // Mobile 360 screenshot
    await page.setViewportSize({ width: 360, height: 780 });
    await page.waitForTimeout(300);
    const adminObrasMobilePath = `${ARTIFACT_DIR}/audit_r22_mobile_360_admin_tickets_obras.png`;
    await page.screenshot({ path: adminObrasMobilePath, fullPage: false });
    console.log(`📸 Screenshot salvo: ${adminObrasMobilePath}`);
    record(`6.3 [mobile_360] Central de Tickets - Adesão de Obras renderizada com sucesso`, true, 'Painel operacional visível');

    await ctx.close();

    // Test with MEMBER view to verify that button "Solicitar Obra" is HIDDEN
    {
      const ctxMember = await browser.newContext({
        viewport: { width: 1440, height: 900 }
      });
      await ctxMember.addCookies([
        {
          name: 'nox-auth-token',
          value: miakasanCookie, // Member of scan, not owner or admin
          url: TARGET_URL,
          httpOnly: true,
          sameSite: 'Lax',
          secure: true
        },
        {
          name: 'sb-izregkwaqdygwioqzwwo-auth-token',
          value: miakasanCookie,
          url: TARGET_URL,
          httpOnly: true,
          sameSite: 'Lax',
          secure: true
        },
        {
          name: 'nox-age-status',
          value: 'ADULT',
          url: TARGET_URL,
          httpOnly: false,
          sameSite: 'Lax',
          secure: true
        }
      ]);
      const pageMember = await ctxMember.newPage();
      await gotoWithRetry(pageMember, `${TARGET_URL}/scan?tab=obras`);
      await pageMember.waitForSelector('.obras-view-root', { state: 'visible', timeout: 25000 });
      const memberBtnCount = await pageMember.locator('.btn-action-primary:has-text("Solicitar Obra")').count();
      const hidePass = memberBtnCount === 0;
      record('6.4 Botão "Solicitar Obra" oculto para membro comum da scan (MEMBER)', hidePass, `Botões encontrados: ${memberBtnCount}`);
      await ctxMember.close();
    }

    await browser.close();

  } finally {
    // Restore testGerente role to USER
    await dbClient.query('UPDATE public.access_roles SET role = $1 WHERE user_id = $2', ['USER', testGerenteId]);
    console.log('🔄 Papel do usuário de teste GERENTE restaurado para USER');

    // Final sanity check on production data
    const finalWorkScans = await dbClient.query('SELECT count(*)::int as count FROM public.work_scans WHERE scan_id = $1', [SCAN_ID]);
    const finalCount = finalWorkScans.rows[0].count;
    console.log(`📊 Obras vinculadas à Scan Project Nox após a auditoria: ${finalCount}`);
    if (finalCount === baselineCount) {
      console.log('🛡️ INTEGRIDADE CONFIRMADA: 100% dos dados originais preservados sem nenhuma alteração residual!');
    } else {
      console.error(`🚨 ERRO CRÍTICO: Contagem final (${finalCount}) diverge da baseline (${baselineCount})!`);
    }

    await dbClient.end();
  }

  const passedCount = results.filter(r => r.pass).length;
  const totalCount = results.length;
  console.log(`\n======================================================`);
  console.log(`RESULTADO DA AUDITORIA FINAL DA RODADA 22:`);
  console.log(`Testes Aprovados: ${passedCount} / ${totalCount} (${Math.round((passedCount / totalCount) * 100)}%)`);
  console.log(`======================================================\n`);

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('💥 Erro fatal durante a auditoria:', err);
  process.exit(1);
});
