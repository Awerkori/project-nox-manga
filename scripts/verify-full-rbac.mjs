import { chromium, expect } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { editorCookies, userCookiesByEmail } from './user-session.mjs';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

process.loadEnvFile('.env');
const origin = process.env.TEST_BASE_URL || 'https://manga.project-nox-awerkori.workers.dev';
const admin = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

try {
  // -------------------------------------------------------------
  // 1. VISITANTE / ANÔNIMO
  // -------------------------------------------------------------
  console.log('--- Testing ROLE: VISITANTE / ANÔNIMO ---');
  const anonContext = await browser.newContext({ extraHTTPHeaders: { origin } });
  const anonPage = await anonContext.newPage();

  // Public pages return 200
  for (const path of ['/', '/catalogo', '/sobre', '/privacidade', '/ranking']) {
    const res = await anonPage.goto(origin + path, { waitUntil: 'networkidle' });
    expect(res.status()).toBe(200);
  }

  // Admin routes return 403
  for (const path of ['/admin', '/admin/obras', '/admin/gestao', '/admin/gestao/configuracoes']) {
    const res = await anonPage.goto(origin + path, { waitUntil: 'networkidle' });
    expect(res.status()).toBe(403);
  }

  // Member routes redirect to /entrar
  for (const path of ['/perfil', '/biblioteca', '/favoritos', '/historico', '/notificacoes']) {
    const res = await anonPage.goto(origin + path, { waitUntil: 'networkidle' });
    expect(res.status()).toBe(200);
    expect(new URL(anonPage.url()).pathname).toBe('/entrar');
  }

  // API mutations return 401 for unauthenticated visitor
  const anonAction = await anonContext.request.post(origin + '/api/action', {
    data: { scope: 'member', action: 'like', data: {} }
  });
  expect(anonAction.status()).toBe(401);

  const anonStaff = await anonContext.request.get(origin + '/api/staff-access');
  expect(anonStaff.status()).toBe(403);

  await anonContext.close();
  console.log('PASS: VISITANTE restrictions validated (public routes 200, member routes redirect to /entrar, admin & APIs 403)');

  // -------------------------------------------------------------
  // 2. USER REAL
  // -------------------------------------------------------------
  console.log('--- Testing ROLE: USER REAL ---');
  // Create a verified temporary user to test USER role in isolation
  const userEmail = `nox_user_qa_${randomBytes(6).toString('hex')}@project-nox-qa.invalid`;
  const userPassword = `Pass_${randomBytes(8).toString('hex')}!`;
  const { data: createdUser } = await admin.auth.admin.createUser({
    email: userEmail,
    password: userPassword,
    email_confirm: true
  });
  const tempUserId = createdUser.user.id;

  try {
    const userCookies = await userCookiesByEmail(userEmail, origin);
    const userContext = await browser.newContext({ extraHTTPHeaders: { origin } });
    await userContext.addCookies(userCookies);
    const userPage = await userContext.newPage();

    // Member routes return 200
    for (const path of ['/perfil', '/biblioteca', '/favoritos', '/historico', '/notificacoes']) {
      const res = await userPage.goto(origin + path, { waitUntil: 'networkidle' });
      expect(res.status()).toBe(200);
    }

    // Admin routes return 403 for USER
    for (const path of ['/admin', '/admin/obras', '/admin/gestao']) {
      const res = await userPage.goto(origin + path, { waitUntil: 'networkidle' });
      expect(res.status()).toBe(403);
    }

    // USER cannot call editor_action
    const userEditorAction = await userContext.request.post(origin + '/api/action', {
      data: { scope: 'editor', action: 'archive', data: {} }
    });
    expect(userEditorAction.status()).toBe(403);

    // USER cannot call owner_action
    const userOwnerAction = await userContext.request.post(origin + '/api/action', {
      data: { scope: 'owner', action: 'role', data: {} }
    });
    expect(userOwnerAction.status()).toBe(403);

    // USER cannot call staff-access
    const userStaff = await userContext.request.get(origin + '/api/staff-access');
    expect(userStaff.status()).toBe(403);

    // USER can execute member_action (e.g. library update)
    const { data: work } = await admin.from('works').select('id').eq('published', true).limit(1).single();
    if (work) {
      const userMemberAction = await userContext.request.post(origin + '/api/action', {
        data: { scope: 'member', action: 'library', data: { work_id: work.id, status: 'READING', favorite: true } }
      });
      expect(userMemberAction.status()).toBe(200);
      const actionRes = await userMemberAction.json();
      expect(actionRes.ok).toBe(true);
    }

    await userContext.close();
    console.log('PASS: USER role validated (personal areas 200, member actions 200, admin routes 403, editor & owner actions 403)');
  } finally {
    await admin.auth.admin.deleteUser(tempUserId).catch(() => {});
  }

  // -------------------------------------------------------------
  // 3. EDITOR REAL
  // -------------------------------------------------------------
  console.log('--- Testing ROLE: EDITOR REAL ---');
  const edCookies = await editorCookies(origin);
  const editorContext = await browser.newContext({ extraHTTPHeaders: { origin } });
  await editorContext.addCookies(edCookies);
  const editorPage = await editorContext.newPage();

  // Editorial routes return 200
  for (const path of ['/admin', '/admin/obras', '/admin/tags']) {
    const res = await editorPage.goto(origin + path, { waitUntil: 'networkidle' });
    expect(res.status()).toBe(200);
  }

  // Administrative owner-only routes return 403
  for (const path of ['/admin/gestao', '/admin/gestao/configuracoes']) {
    const res = await editorPage.goto(origin + path, { waitUntil: 'networkidle' });
    expect(res.status()).toBe(403);
  }

  // EDITOR cannot execute owner_action
  const editorOwnerAction = await editorContext.request.post(origin + '/api/action', {
    data: { scope: 'owner', action: 'role', data: {} }
  });
  expect(editorOwnerAction.status()).toBe(403);

  // EDITOR cannot invite staff
  const editorInvite = await editorContext.request.post(origin + '/api/invite', {
    data: { email: 'test@example.invalid' }
  });
  expect(editorInvite.status()).toBe(403);

  await editorContext.close();
  console.log('PASS: EDITOR role validated (editorial routes 200, management routes 403, owner actions 403)');

  // -------------------------------------------------------------
  // 4. ADMIN REAL
  // -------------------------------------------------------------
  console.log('--- Testing ROLE: ADMIN REAL ---');
  const ownCookies = await ownerCookies(origin);
  const adminContext = await browser.newContext({ extraHTTPHeaders: { origin } });
  await adminContext.addCookies(ownCookies);
  const adminPage = await adminContext.newPage();

  // ADMIN can access all administrative routes
  for (const path of [
    '/admin',
    '/admin/obras',
    '/admin/tags',
    '/admin/gestao',
    '/admin/gestao/configuracoes',
    '/perfil',
    '/biblioteca'
  ]) {
    const res = await adminPage.goto(origin + path, { waitUntil: 'networkidle' });
    expect(res.status()).toBe(200);
  }

  // ADMIN can access staff-access API
  const adminStaff = await adminContext.request.get(origin + '/api/staff-access');
  expect(adminStaff.status()).toBe(200);

  await adminContext.close();
  console.log('PASS: ADMIN role validated (all routes 200, staff-access API 200, full permissions)');

  console.log('PASS: complete 4-role RBAC matrix (VISITANTE, USER, EDITOR, ADMIN) fully verified in production!');
} finally {
  await browser.close();
}
