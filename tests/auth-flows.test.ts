import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
  env: { TURSO_DB_URL: 'http://localhost', TURSO_DB_TOKEN: 'mock' }
}));

const { claimInvite } = vi.hoisted(() => ({ claimInvite: vi.fn() }));
vi.mock('$lib/server/invites', () => ({ claimInvite }));

const authApi = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  forgetPassword: vi.fn(),
  changePassword: vi.fn(),
  verifyEmail: vi.fn()
}));
vi.mock('$lib/server/auth', () => ({
  auth: { api: authApi }
}));

const { safeQuerySingle } = vi.hoisted(() => ({ safeQuerySingle: vi.fn().mockResolvedValue({ data: null }) }));
vi.mock('$lib/server/db', async () => {
  const actualDb = await vi.importActual('$lib/server/db/index') as any;
  const safe = await vi.importActual('$lib/server/db/safe') as any;
  const schema = await vi.importActual('$lib/server/db/schema') as any;
  return {
    db: actualDb.db,
    schema,
    safeQuery: safe.safeQuery,
    safeQuerySingle
  };
});

import { actions, load } from '../src/routes/[auth=auth]/+page.server';
import { GET } from '../src/routes/auth/confirm/+server';

function event(mode = 'entrar', fields = { email: 'reader@example.invalid', password: 'long-password' } as Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return {
    params: { auth: mode },
    url: new URL(`https://nox.invalid/${mode}`),
    locals: { user: null },
    request: { formData: async () => form, headers: new Headers() }
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  safeQuerySingle.mockResolvedValue({ data: null });
});

describe('account actions', () => {
  it.each(['entrar', 'cadastrar', 'recuperar'])(
    'rejects invalid email for %s before calling Auth',
    async (mode) => {
      const e = event(mode, { email: 'invalid', password: 'long-password' });
      expect(await actions.default(e)).toMatchObject({ status: 400 });
      expect(authApi.signInEmail).not.toHaveBeenCalled();
      expect(authApi.signUpEmail).not.toHaveBeenCalled();
      expect(authApi.forgetPassword).not.toHaveBeenCalled();
    }
  );

  it.each(['short', 'x'.repeat(129)])('rejects password outside limits', async (password) => {
    const e = event('cadastrar', { email: 'reader@example.invalid', password });
    expect(await actions.default(e)).toMatchObject({ status: 400 });
    expect(authApi.signUpEmail).not.toHaveBeenCalled();
  });

  it('claims editorial invitation only after successful password authentication', async () => {
    const e = event();
    await expect(actions.default(e)).rejects.toMatchObject({ status: 303, location: '/biblioteca' });
    expect(authApi.signInEmail).toHaveBeenCalledWith(expect.objectContaining({
      body: { email: 'reader@example.invalid', password: 'long-password' }
    }));
    expect(claimInvite).toHaveBeenCalledWith(e.locals);
  });

  it('does not claim roles or expose provider details after invalid login', async () => {
    const e = event();
    authApi.signInEmail.mockRejectedValue(new Error('private provider detail'));
    const result = await actions.default(e);
    expect(result).toMatchObject({ status: 400 });
    expect(JSON.stringify(result)).not.toContain('private provider detail');
    expect(claimInvite).not.toHaveBeenCalled();
  });

  it('sends registration confirmation to the own origin without claiming unverified roles', async () => {
    const e = event('cadastrar', { email: 'reader@example.invalid', password: 'long-password', username: 'newuser' });
    
    expect(await actions.default(e)).toMatchObject({ success: true });
    
    expect(safeQuerySingle).toHaveBeenCalledOnce();
    const query = safeQuerySingle.mock.calls[0][0];
    const sql = query.toSQL().sql.toLowerCase();
    expect(sql).toContain('select');
    expect(sql).toContain('from "members"');
    expect(sql).toContain('username');
    expect(sql).toContain('ilike');
    
    expect(authApi.signUpEmail).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({
        email: 'reader@example.invalid',
        password: 'long-password',
        callbackURL: 'https://nox.invalid/auth/confirm'
      })
    }));
    expect(claimInvite).not.toHaveBeenCalled();
  });

  it('rejects registration if username is taken (mock Drizzle safeQuerySingle)', async () => {
    const e = event('cadastrar', { email: 'reader@example.invalid', password: 'long-password', username: 'taken' });
    safeQuerySingle.mockResolvedValueOnce({ data: { id: 'some-user-id' } }); // mock collision
    
    const result = await actions.default(e);
    expect(result).toMatchObject({ status: 400 });
    expect((result as any).data.message).toContain('@taken já está em uso');
    expect(authApi.signUpEmail).not.toHaveBeenCalled();
  });

  it('shows a safe retry message when email quota is exhausted', async () => {
    const e = event('cadastrar', { email: 'reader@example.invalid', password: 'long-password', username: 'newuser' });
    authApi.signUpEmail.mockRejectedValue(new Error('over_email_send_rate_limit'));
    expect(await actions.default(e)).toMatchObject({
      status: 400,
      data: { message: 'Não foi possível enviar a confirmação. Tente novamente mais tarde.' }
    });
  });

  it('recovery requires no password and uses a fixed reset destination', async () => {
    const e = event('recuperar', { email: 'reader@example.invalid', password: '' });
    expect(await actions.default(e)).toMatchObject({ success: true });
    expect(authApi.forgetPassword).toHaveBeenCalledWith(expect.objectContaining({
      body: {
        email: 'reader@example.invalid',
        redirectTo: 'https://nox.invalid/auth/confirm?next=/redefinir'
      }
    }));
    expect(claimInvite).not.toHaveBeenCalled();
  });

  it('does not reset a password without an authenticated session', async () => {
    const e = event('redefinir', { email: 'reader@example.invalid', password: 'long-password' });
    expect(await actions.default(e)).toMatchObject({ status: 401 });
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it('updates only the authenticated account password', async () => {
    const e = event('redefinir', { email: 'reader@example.invalid', password: 'long-password' });
    e.locals.user = { id: 'local-reader' };
    expect(await actions.default(e)).toMatchObject({ success: true });
    expect(authApi.changePassword).toHaveBeenCalledWith(expect.objectContaining({
      body: { newPassword: 'long-password' }
    }));
  });
});

describe('confirmation callback', () => {
  it.each(['signup', 'email'])('validates %s OTP before claiming an invitation', async (type) => {
    const e = event();
    e.url = new URL(
      `https://nox.invalid/auth/confirm?token_hash=local-test-token&type=${type}&next=https://attacker.invalid`
    );
    await expect(GET(e)).rejects.toMatchObject({
      status: 303,
      location: '/biblioteca'
    });
    expect(authApi.verifyEmail).toHaveBeenCalledWith(expect.objectContaining({
      query: { token: 'local-test-token' }
    }));
  });

  it('validates recovery OTP and redirects to redefinir', async () => {
    const e = event();
    e.url = new URL(
      `https://nox.invalid/auth/confirm?token_hash=local-test-token&type=recovery`
    );
    await expect(GET(e)).rejects.toMatchObject({
      status: 303,
      location: '/redefinir?token=local-test-token'
    });
    expect(authApi.verifyEmail).not.toHaveBeenCalled();
  });

  it('exchanges a PKCE code and redirects safely', async () => {
    const e = event();
    e.url = new URL('https://nox.invalid/auth/confirm?code=local-code&next=/redefinir');
    await expect(GET(e)).rejects.toMatchObject({ status: 303, location: '/redefinir' });
  });

  it('rejects unsupported token types before calling provider or claiming roles', async () => {
    const e = event();
    e.url = new URL('https://nox.invalid/auth/confirm?token_hash=local-test-token&type=invite');
    await expect(GET(e)).rejects.toMatchObject({ status: 303, location: '/entrar?erro=link-expirado' });
    expect(authApi.verifyEmail).not.toHaveBeenCalled();
    expect(claimInvite).not.toHaveBeenCalled();
  });

  it('expired confirmation never claims roles or returns the token', async () => {
    const e = event();
    e.url = new URL('https://nox.invalid/auth/confirm?token_hash=local-test-token&type=signup');
    authApi.verifyEmail.mockRejectedValue(new Error('expired'));
    await expect(GET(e)).rejects.toMatchObject({ status: 303, location: '/entrar?erro=link-expirado' });
    expect(claimInvite).not.toHaveBeenCalled();
  });

  it('shows expired-link guidance without reflecting arbitrary query text', () => {
    const e = event();
    e.url.searchParams.set('erro', 'link-expirado');
    expect(load(e).error).toContain('expirou');
    e.url.searchParams.set('erro', '<script>alert(1)</script>');
    expect(load(e).error).toBe('');
  });
});
