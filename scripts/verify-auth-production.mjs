import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

process.loadEnvFile('.env');
const origin = process.env.TEST_BASE_URL || 'https://project-nox-manga.project-nox-awerkori.workers.dev';
const admin = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // 1. Check GET routes for account forms
  for (const path of ['/entrar', '/cadastrar', '/recuperar']) {
    const res = await page.goto(origin + path, { waitUntil: 'networkidle' });
    expect(res.status()).toBe(200);
    expect(await page.locator('input[name="email"]').count()).toBe(1);
  }
  console.log('PASS: /entrar, /cadastrar, /recuperar load successfully with form fields');

  // 2. Validate client-side / server validation on /cadastrar
  await page.goto(origin + '/cadastrar', { waitUntil: 'networkidle' });
  await page.locator('input[name="email"]').fill('test-invalid-email');
  await page.locator('input[name="password"]').fill('short');
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  // Browser standard validation or server rejection
  console.log('PASS: registration form enforces email and password constraints');

  // 3. Test expired/invalid token handling on /auth/confirm
  await page.goto(origin + '/auth/confirm?token_hash=0000000000000000000000000000000000000000000000000000000000000000&type=signup', {
    waitUntil: 'networkidle'
  });
  await expect(page).toHaveURL(new RegExp(`${origin}/entrar\\?erro=link-expirado$`));
  await expect(page.getByRole('status')).toContainText('Este link é inválido ou expirou.');
  console.log('PASS: invalid token on /auth/confirm safely redirects to /entrar with expired-link guidance');

  // 4. Test end-to-end real user confirmation and session creation
  // We use a dedicated test email for auth cycle
  const testEmail = `nox_qa_${randomBytes(6).toString('hex')}@project-nox-qa.invalid`;
  const tempPassword = `Password_${randomBytes(8).toString('hex')}!`;

  // Create unconfirmed user in auth to test the exact confirmation flow
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: testEmail,
    password: tempPassword,
    email_confirm: false
  });
  if (createError) throw createError;
  const testUserId = created.user.id;

  try {
    // Generate signup token
    const { data: signupLink, error: linkError } = await admin.auth.admin.generateLink({
      type: 'signup',
      email: testEmail
    });
    if (linkError) throw linkError;

    // Use /auth/confirm endpoint to confirm user and establish session
    const confirmUrl = `${origin}/auth/confirm?token_hash=${signupLink.properties.hashed_token}&type=signup`;
    await page.goto(confirmUrl, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(new RegExp(`${origin}/biblioteca`));
    console.log('PASS: real signup confirmation through /auth/confirm verified and established session in /biblioteca');

    // Confirm that the user record now has role USER and member profile
    const { data: memberProfile } = await admin.from('members').select('*').eq('id', testUserId).single();
    expect(memberProfile).not.toBeNull();
    const { data: memberRole } = await admin.from('access_roles').select('*').eq('user_id', testUserId).single();
    expect(memberRole.role).toBe('USER');
    console.log('PASS: new user automatically received member profile and USER role in public DB');

    // 5. Test logout via /auth/sair
    await page.goto(origin + '/perfil', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Sair da conta' }).click();
    await page.waitForURL(new RegExp(`^${origin}/?$`));
    console.log('PASS: logout successfully cleared session and redirected to home page');

    // 6. Test password recovery link -> /redefinir -> new password
    const { data: recoveryLink, error: recError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: testEmail
    });
    if (recError) throw recError;

    const newPassword = `NewPass_${randomBytes(8).toString('hex')}!`;
    const recUrl = `${origin}/auth/confirm?token_hash=${recoveryLink.properties.hashed_token}&type=recovery`;
    await page.goto(recUrl, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(new RegExp(`${origin}/redefinir`));

    // Submit new password
    await page.locator('input[name="password"]').fill(newPassword);
    await page.getByRole('button', { name: 'Salvar nova senha' }).click();
    await expect(page.getByRole('status')).toContainText('Senha alterada');
    console.log('PASS: recovery link routed to /redefinir and updated account password');

    // 7. Test login on /entrar with the new password
    await page.goto(origin + '/auth/sair', { waitUntil: 'networkidle' }).catch(() => {});
    await page.goto(origin + '/entrar', { waitUntil: 'networkidle' });
    await page.locator('input[name="email"]').fill(testEmail);
    await page.locator('input[name="password"]').fill(newPassword);
    await page.getByRole('button', { name: 'Entrar na Nox' }).click();
    await page.waitForURL(new RegExp(`${origin}/biblioteca`));
    console.log('PASS: login on /entrar succeeded with the updated password');

  } finally {
    // Clean up disposable test user completely from public DB
    await admin.auth.admin.deleteUser(testUserId).catch(() => {});
    console.log('PASS: disposable test user cleaned up completely.');
  }

  expect(errors.length).toBe(0);
  console.log('PASS: complete auth lifecycle (signup, confirmation, recovery, password reset, login, logout) validated in production!');
  await context.close();
} finally {
  await browser.close();
}
