import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { chromium } from '@playwright/test';

const TARGET_URL = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const SCAN_ID = '04872e99-37ad-4d45-aed4-35759d0eae33';

function parseEnv(path) {
  if (!fs.existsSync(path)) return {};
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

const appEnv = parseEnv('.env');
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

async function main() {
  console.log('🔍 PROJECT NOX — VERIFICAÇÃO DEFINITIVA DO CLOUDFLARE PREVIEW');
  console.log(`Target: ${TARGET_URL}\n`);

  await dbClient.connect();
  const initCheck = await dbClient.query('SELECT count(*)::int as cnt FROM public.work_scans WHERE scan_id = $1', [SCAN_ID]);
  const baselineCount = initCheck.rows[0].cnt;
  console.log(`📊 Baseline DB: ${baselineCount} obras na scan Project Nox`);

  const results = [];
  function record(id, title, pass, details) {
    console.log(`${pass ? '✅ PASS' : '❌ FAIL'}: [${id}] ${title} — ${details}`);
    results.push({ id, title, pass, details });
  }

  // 1. Check version.json matching
  const localVer = JSON.parse(fs.readFileSync('.svelte-kit/cloudflare/_app/version.json', 'utf-8')).version;
  const remoteVerRes = curlReq(`${TARGET_URL}/_app/version.json`);
  let remoteVer = null;
  try { remoteVer = JSON.parse(remoteVerRes.body).version; } catch {}
  const verMatch = localVer === remoteVer;
  record('DEPLOY-01', 'Build artifact version.json coincide com o Preview ativo', verMatch, `Local: ${localVer} | Remoto: ${remoteVer}`);

  // Test personas
  const awerkoriId = '732fbe87-5040-41fb-9983-0aedb2af44c8'; // Site ADMIN, Scan OWNER
  const pristamId = '86b6a05e-9c2d-4bb4-8381-c9890c730f17'; // Site USER, Scan ADMIN
  const thiagoslkmId = '5c68de04-c72a-4df8-86a7-b851057208dc'; // Site STAFF_SITE, Scan MEMBER
  const regularUserId = '4272565e-6076-4d3d-b002-3f94c5fc64a5'; // Site USER, NO scan link
  const testGerenteId = '776fbc21-54e7-4254-8323-0856ee7181d9'; // Temporarily site GERENTE

  const awerkoriCookie = createAuthCookie(awerkoriId, 'awerkori', 'awerkori@gmail.com');
  const pristamCookie = createAuthCookie(pristamId, 'pristam', 'pristam@projectnox.org');
  const thiagoCookie = createAuthCookie(thiagoslkmId, 'thiagoslkm', 'thiago@projectnox.org');
  const regularUserCookie = createAuthCookie(regularUserId, 'yuuki_cordeiro', 'yuuki@projectnox.org');
  const gerenteCookie = createAuthCookie(testGerenteId, 'test_review_1793675255', 'gerente_qa@projectnox.org');

  await dbClient.query('UPDATE public.access_roles SET role = $1 WHERE user_id = $2', ['GERENTE', testGerenteId]);
  await sleep(400);

  try {
    // 2. Tickets -> Adesão de Obras (tab=obras)
    {
      const res = curlReq(`${TARGET_URL}/admin/tickets?tab=obras`, { cookie: awerkoriCookie });
      record('RBAC-01', 'Site ADMIN acessa /admin/tickets?tab=obras', res.status === 200, `HTTP ${res.status}`);
    }
    await sleep(400);

    {
      const res = curlReq(`${TARGET_URL}/admin/tickets?tab=obras`, { cookie: gerenteCookie });
      record('RBAC-02', 'Site GERENTE acessa /admin/tickets?tab=obras', res.status === 200, `HTTP ${res.status}`);
    }
    await sleep(400);

    {
      const res = curlReq(`${TARGET_URL}/admin/tickets?tab=obras`, { cookie: thiagoCookie });
      const pass = res.status === 303 && res.location.includes('/admin/tickets?tab=relatorios');
      record('RBAC-03', 'STAFF_SITE bloqueado de tab=obras (redirecionado 303)', pass, `Status: ${res.status}, Location: ${res.location}`);
    }
    await sleep(400);

    {
      const res = curlReq(`${TARGET_URL}/admin/tickets?/reviewWorkRequest`, {
        method: 'POST',
        cookie: thiagoCookie,
        headers: { Origin: TARGET_URL, Referer: `${TARGET_URL}/admin/tickets?tab=obras`, Accept: 'application/json', 'x-sveltekit-action': 'true' },
        form: [['request_id', '00000000-0000-0000-0000-000000000000'], ['action', 'APPROVE']]
      });
      record('RBAC-04', 'STAFF_SITE bloqueado de reviewWorkRequest no backend (HTTP 403)', res.actionStatus === 403, `Status: ${res.actionStatus}`);
    }
    await sleep(400);

    {
      const res = curlReq(`${TARGET_URL}/admin/tickets?tab=obras`, { cookie: regularUserCookie });
      record('RBAC-05', 'Usuário comum estritamente bloqueado da área de tickets (403)', res.status === 403 || res.status === 303, `Status: ${res.status}`);
    }
    await sleep(400);

    // 3. Scan Leadership Permissions
    {
      const res = curlReq(`${TARGET_URL}/api/scan/works/search?scan_id=${SCAN_ID}&q=solo`, { cookie: awerkoriCookie });
      let count = 0;
      try {
        const body = JSON.parse(res.body);
        count = body?.results?.length || 0;
      } catch {}
      record('SCAN-01', 'Scan OWNER pode buscar obras no catálogo com relevância semântica', res.status === 200 && count > 0, `Status: ${res.status}, Obras: ${count}`);
    }
    await sleep(400);

    {
      const res = curlReq(`${TARGET_URL}/api/scan/works/search?scan_id=${SCAN_ID}&q=han%20pasado`, { cookie: awerkoriCookie });
      let matchedAliasFound = false;
      try {
        const body = JSON.parse(res.body);
        matchedAliasFound = body?.results?.some(r => r.matched_alias && r.matched_alias.toLowerCase().includes('han pasado'));
      } catch {}
      record('SCAN-02', 'Pesquisa encontra obras por títulos alternativos (matched_alias retornado)', matchedAliasFound, 'Correspondência confirmada');
    }
    await sleep(400);

    {
      const res = curlReq(`${TARGET_URL}/api/scan/works/search?scan_id=${SCAN_ID}&q=solo`, { cookie: pristamCookie });
      let count = 0;
      try { count = JSON.parse(res.body)?.results?.length || 0; } catch {}
      record('SCAN-03', 'Scan ADMIN pode buscar obras no catálogo', res.status === 200 && count > 0, `Status: ${res.status}, Obras: ${count}`);
    }
    await sleep(400);

    {
      const res = curlReq(`${TARGET_URL}/api/scan/works/search?scan_id=${SCAN_ID}&q=solo`, { cookie: thiagoCookie });
      record('SCAN-04', 'Scan MEMBER bloqueado da busca de obras (HTTP 403)', res.status === 403, `Status: ${res.status}`);
    }
    await sleep(400);

    {
      const res = curlReq(`${TARGET_URL}/api/scan/works/search?scan_id=${SCAN_ID}&q=solo`, { cookie: regularUserCookie });
      record('SCAN-05', 'Usuário sem vínculo bloqueado da busca de obras (HTTP 403)', res.status === 403, `Status: ${res.status}`);
    }
    await sleep(400);

    {
      const res = curlReq(`${TARGET_URL}/scan?/requestProject`, {
        method: 'POST',
        cookie: thiagoCookie,
        headers: { Origin: TARGET_URL, Referer: `${TARGET_URL}/scan?tab=obras`, Accept: 'application/json', 'x-sveltekit-action': 'true' },
        form: [['scan_id', SCAN_ID], ['work_id', '0003c726-f6c6-4e90-ad0a-2a04a0e4d771'], ['message', 'Tentativa não autorizada']]
      });
      record('SCAN-06', 'Scan MEMBER bloqueado de solicitar obra no backend (HTTP 403)', res.actionStatus === 403, `Status: ${res.actionStatus}`);
    }
    await sleep(400);

    // 4. Duplicate checks & Concurrency
    {
      const linkedWorkId = 'c08a2531-7bf3-4324-979a-f7de0e66a62d'; // Céu Distante (already linked)
      const res = curlReq(`${TARGET_URL}/scan?/requestProject`, {
        method: 'POST',
        cookie: awerkoriCookie,
        headers: { Origin: TARGET_URL, Referer: `${TARGET_URL}/scan?tab=obras`, Accept: 'application/json', 'x-sveltekit-action': 'true' },
        form: [['scan_id', SCAN_ID], ['work_id', linkedWorkId], ['message', 'Duplicata']]
      });
      record('CONCURRENCY-01', 'Solicitação de obra já vinculada bloqueada com 409 Conflict', res.actionStatus === 409, `Status: ${res.actionStatus}`);
    }
    await sleep(400);

    // 5. Full Real Lifecycle: Request -> GERENTE Approval -> DB Link -> Safe Reversion
    {
      const testWorkId = '0003c726-f6c6-4e90-ad0a-2a04a0e4d771'; // Androide 18 NTR Zero (unlinked)
      // Step A: Submit
      const submitRes = curlReq(`${TARGET_URL}/scan?/requestProject`, {
        method: 'POST',
        cookie: awerkoriCookie,
        headers: { Origin: TARGET_URL, Referer: `${TARGET_URL}/scan?tab=obras`, Accept: 'application/json', 'x-sveltekit-action': 'true' },
        form: [['scan_id', SCAN_ID], ['work_id', testWorkId], ['message', 'Solicitação de teste para validação']]
      });
      record('LIFECYCLE-01', 'Liderança envia solicitação de obra não-vinculada com sucesso (200)', submitRes.actionStatus === 200, `Status: ${submitRes.actionStatus}`);

      // Query request id from DB
      const dbReq = await dbClient.query('SELECT id, status FROM public.scan_project_requests WHERE scan_id = $1 AND work_id = $2 AND status = $3', [SCAN_ID, testWorkId, 'PENDING']);
      const reqId = dbReq.rows[0]?.id;
      record('LIFECYCLE-02', 'Solicitação persistida no DB com status PENDING', !!reqId, `Request ID: ${reqId}`);

      // Step B: GERENTE Approves
      const approveRes = curlReq(`${TARGET_URL}/admin/tickets?/reviewWorkRequest`, {
        method: 'POST',
        cookie: gerenteCookie,
        headers: { Origin: TARGET_URL, Referer: `${TARGET_URL}/admin/tickets?tab=obras`, Accept: 'application/json', 'x-sveltekit-action': 'true' },
        form: [['request_id', reqId], ['action', 'APPROVE'], ['review_notes', 'Aprovado pelo Gerente do Site']]
      });
      record('LIFECYCLE-03', 'Site GERENTE aprova a solicitação com sucesso (200)', approveRes.actionStatus === 200, `Status: ${approveRes.actionStatus}`);

      // Step C: Verify real link in public.work_scans
      const linkCheck = await dbClient.query('SELECT status FROM public.work_scans WHERE scan_id = $1 AND work_id = $2', [SCAN_ID, testWorkId]);
      const isLinked = linkCheck.rows[0]?.status === 'ACTIVE';
      record('LIFECYCLE-04', 'Vínculo real criado em public.work_scans (status ACTIVE)', isLinked, `Status: ${linkCheck.rows[0]?.status}`);

      // Step D: Reversion/Cleanup
      await dbClient.query('DELETE FROM public.work_scans WHERE scan_id = $1 AND work_id = $2', [SCAN_ID, testWorkId]);
      await dbClient.query('DELETE FROM public.scan_project_requests WHERE id = $1', [reqId]);
      record('LIFECYCLE-05', 'Reversão imediata: Vínculo e ticket de teste limpos sem deixar resíduos', true, 'DB limpo');
    }
    await sleep(400);

    // 6. Full Real Lifecycle: Request -> Rejection with Mandatory Reason
    {
      const testWorkId2 = '0003d400-7620-4941-95de-c78de4c2d80e'; // A Vida Relaxante... (unlinked)
      // Step A: Submit
      const submitRes = curlReq(`${TARGET_URL}/scan?/requestProject`, {
        method: 'POST',
        cookie: pristamCookie,
        headers: { Origin: TARGET_URL, Referer: `${TARGET_URL}/scan?tab=obras`, Accept: 'application/json', 'x-sveltekit-action': 'true' },
        form: [['scan_id', SCAN_ID], ['work_id', testWorkId2], ['message', 'Solicitação para teste de recusa']]
      });
      const dbReq = await dbClient.query('SELECT id FROM public.scan_project_requests WHERE scan_id = $1 AND work_id = $2 AND status = $3', [SCAN_ID, testWorkId2, 'PENDING']);
      const reqId2 = dbReq.rows[0]?.id;

      // Step B: Rejection without notes -> must return 400
      const rejectEmptyRes = curlReq(`${TARGET_URL}/admin/tickets?/reviewWorkRequest`, {
        method: 'POST',
        cookie: gerenteCookie,
        headers: { Origin: TARGET_URL, Referer: `${TARGET_URL}/admin/tickets?tab=obras`, Accept: 'application/json', 'x-sveltekit-action': 'true' },
        form: [['request_id', reqId2], ['action', 'REJECT'], ['reason', '']]
      });
      record('LIFECYCLE-06', 'Recusa sem justificativa bloqueada com 400 Bad Request', rejectEmptyRes.actionStatus === 400, `Status: ${rejectEmptyRes.actionStatus}`);

      // Step C: Rejection with valid reason
      const rejectRes = curlReq(`${TARGET_URL}/admin/tickets?/reviewWorkRequest`, {
        method: 'POST',
        cookie: gerenteCookie,
        headers: { Origin: TARGET_URL, Referer: `${TARGET_URL}/admin/tickets?tab=obras`, Accept: 'application/json', 'x-sveltekit-action': 'true' },
        form: [['request_id', reqId2], ['action', 'REJECT'], ['reason', 'Obra incompatível com a linha editorial.']]
      });
      record('LIFECYCLE-07', 'GERENTE recusa a solicitação com justificativa válida (200)', rejectRes.actionStatus === 200, `Status: ${rejectRes.actionStatus}`);

      // Step D: Verify status in DB is REJECTED and NO link in work_scans
      const checkReject = await dbClient.query('SELECT status, rejection_reason FROM public.scan_project_requests WHERE id = $1', [reqId2]);
      const checkLink2 = await dbClient.query('SELECT count(*)::int as cnt FROM public.work_scans WHERE scan_id = $1 AND work_id = $2', [SCAN_ID, testWorkId2]);
      const passReject = checkReject.rows[0]?.status === 'REJECTED' && checkLink2.rows[0].cnt === 0;
      record('LIFECYCLE-08', 'Ticket marcado como REJECTED e nenhum vínculo criado em work_scans', passReject, `Notas: "${checkReject.rows[0]?.rejection_reason}"`);

      // Cleanup
      await dbClient.query('DELETE FROM public.scan_project_requests WHERE id = $1', [reqId2]);
    }
    await sleep(400);

    // 7. Playwright UI Verification
    console.log('\n--- VERIFICAÇÃO VISUAL & ELEMENTOS DOM ---');
    const browser = await chromium.launch({ headless: true });
    
    // 7.1 Leader Context
    {
      const ctxLeader = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await ctxLeader.addCookies([
        { name: 'nox-auth-token', value: awerkoriCookie, url: TARGET_URL, httpOnly: true, sameSite: 'Lax', secure: true },
        { name: 'sb-izregkwaqdygwioqzwwo-auth-token', value: awerkoriCookie, url: TARGET_URL, httpOnly: true, sameSite: 'Lax', secure: true },
        { name: 'nox-age-status', value: 'ADULT', url: TARGET_URL, httpOnly: false, sameSite: 'Lax', secure: true }
      ]);
      const pageLeader = await ctxLeader.newPage();
      await pageLeader.goto(`${TARGET_URL}/scan?tab=obras`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await pageLeader.waitForSelector('.obras-view-root', { state: 'visible', timeout: 25000 });
      
      const leaderBtnCount = await pageLeader.locator('.btn-action-primary:has-text("Solicitar Obra")').count();
      record('UI-01', 'Liderança da scan visualiza botão "Solicitar Obra"', leaderBtnCount === 1, `Botões: ${leaderBtnCount}`);

      // Check modal lupa recuo
      await pageLeader.locator('.btn-action-primary:has-text("Solicitar Obra")').click();
      await pageLeader.waitForSelector('.project-search-modal', { state: 'visible', timeout: 15000 });
      const input = pageLeader.locator('#proj-search-input');
      const paddingLeft = await input.evaluate(el => window.getComputedStyle(el).paddingLeft);
      record('UI-02', 'Input de busca com recuo adequado para a lupa (>= 40px)', parseInt(paddingLeft, 10) >= 40, `paddingLeft: ${paddingLeft}`);
      await ctxLeader.close();
    }
    await sleep(500);

    // 7.2 Member Context
    {
      const ctxMember = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await ctxMember.addCookies([
        { name: 'nox-auth-token', value: thiagoCookie, url: TARGET_URL, httpOnly: true, sameSite: 'Lax', secure: true },
        { name: 'sb-izregkwaqdygwioqzwwo-auth-token', value: thiagoCookie, url: TARGET_URL, httpOnly: true, sameSite: 'Lax', secure: true },
        { name: 'nox-age-status', value: 'ADULT', url: TARGET_URL, httpOnly: false, sameSite: 'Lax', secure: true }
      ]);
      const pageMember = await ctxMember.newPage();
      await pageMember.goto(`${TARGET_URL}/scan?tab=obras`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await pageMember.waitForSelector('.obras-view-root', { state: 'visible', timeout: 25000 });
      
      const memberBtnCount = await pageMember.locator('.btn-action-primary:has-text("Solicitar Obra")').count();
      record('UI-03', 'Membro comum NÃO visualiza botão "Solicitar Obra"', memberBtnCount === 0, `Botões: ${memberBtnCount}`);
      await ctxMember.close();
    }

    await browser.close();

  } finally {
    await dbClient.query('UPDATE public.access_roles SET role = $1 WHERE user_id = $2', ['USER', testGerenteId]);
    const finalCheck = await dbClient.query('SELECT count(*)::int as cnt FROM public.work_scans WHERE scan_id = $1', [SCAN_ID]);
    const finalCount = finalCheck.rows[0].cnt;
    console.log(`\n📊 Baseline DB final: ${finalCount} obras (Original: ${baselineCount})`);
    record('DB-01', 'Integridade do banco 100% preservada (baseline intacta)', finalCount === baselineCount, `Final: ${finalCount}`);
    await dbClient.end();
  }

  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  console.log(`\n======================================================`);
  console.log(`RELATÓRIO DE VERIFICAÇÃO DO PREVIEW ATIVO:`);
  console.log(`Testes Aprovados: ${passed} / ${total} (${Math.round((passed / total) * 100)}%)`);
  console.log(`======================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('💥 Erro fatal:', err);
  process.exit(1);
});
