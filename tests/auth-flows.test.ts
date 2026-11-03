import { beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_SECRET = 'auth-flow-test-secret-at-least-32-chars-long';
process.env.AUTH_SECRET = TEST_SECRET;

const mocks = vi.hoisted(() => ({
  claimInvite: vi.fn(),
  authenticateWithYugabyte: vi.fn(),
  registerWithYugabyte: vi.fn(),
  setAuthCookie: vi.fn(),
  sendBrevoEmail: vi.fn(),
  executeYugabyteSql: vi.fn()
}));

vi.mock('$lib/server/invites', () => ({ claimInvite: mocks.claimInvite }));
vi.mock('$lib/server/brevo', () => ({ sendBrevoEmail: mocks.sendBrevoEmail }));
vi.mock('$lib/server/yugabyte', () => ({ executeYugabyteSql: mocks.executeYugabyteSql }));
vi.mock('$lib/server/yugabyte-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/server/yugabyte-auth')>();
  return {
    ...actual,
    authenticateWithYugabyte: mocks.authenticateWithYugabyte,
    registerWithYugabyte: mocks.registerWithYugabyte,
    setAuthCookie: mocks.setAuthCookie
  };
});

import { signSessionJwt } from '../src/lib/server/yugabyte-auth';
import { actions, load } from '../src/routes/[auth=auth]/+page.server';
import { GET } from '../src/routes/auth/confirm/+server';

function event(mode = 'entrar', fields: Record<string, string> = { email: 'reader@example.invalid', password: 'long-password' }) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return {
    params: { auth: mode },
    url: new URL(`https://nox.invalid/${mode}`),
    locals: { user: null },
    cookies: { set: vi.fn(), get: vi.fn() },
    request: { formData: async () => form }
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticateWithYugabyte.mockResolvedValue({
    success: true,
    session: {
      user: { id: '11111111-1111-1111-1111-111111111111', email: 'reader@example.invalid', role: 'USER' },
      access_token: 'valid-token',
      token_type: 'bearer',
      expires_in: 3600
    }
  });
  mocks.registerWithYugabyte.mockResolvedValue({
    success: true,
    user: { id: '11111111-1111-1111-1111-111111111111', email: 'reader@example.invalid', role: 'USER' }
  });
  mocks.executeYugabyteSql.mockResolvedValue({ rows: [] });
});

describe('account actions', () => {
  it.each([
    { code: 'email_not_confirmed' },
    { status: 400, message: 'Email not confirmed' }
  ])('preserves unconfirmed-account handling for provider error variants', async (error) => {
    mocks.authenticateWithYugabyte.mockResolvedValueOnce({ success: false, error });
    expect(await actions.default(event())).toMatchObject({ status: 400, data: { unconfirmed: true } });
    expect(mocks.claimInvite).not.toHaveBeenCalled();
  });
  it.each([
    ['entrar', {}],
    ['cadastrar', { username: 'reader_qa' }],
    ['recuperar', {}],
    ['entrar', { intent: 'resend_confirmation' }]
  ])('blocks rate-limited %s requests before querying the database', async (mode, extra) => {
    const e = event(mode, { email: 'reader@example.invalid', password: 'long-password', ...extra });
    e.request.headers = new Headers({ 'cf-connecting-ip': '203.0.113.8' });
    e.platform = { env: {
      AUTH_SECRET: TEST_SECRET,
      AUTH_ORIGIN_RATE_LIMIT: { limit: vi.fn().mockResolvedValue({ success: false }) },
      AUTH_IDENTITY_RATE_LIMIT: { limit: vi.fn().mockResolvedValue({ success: true }) }
    } };
    expect(await actions.default(e)).toMatchObject({ status: 429 });
    expect(mocks.authenticateWithYugabyte).not.toHaveBeenCalled();
    expect(mocks.registerWithYugabyte).not.toHaveBeenCalled();
    expect(mocks.executeYugabyteSql).not.toHaveBeenCalled();
    expect(mocks.sendBrevoEmail).not.toHaveBeenCalled();
  });
  it.each(['entrar', 'cadastrar', 'recuperar'])(
    'rejects invalid email for %s before calling Auth',
    async (mode) => {
      const e = event(mode, { email: 'invalid', password: 'long-password' });
      expect(await actions.default(e)).toMatchObject({ status: 400 });
      expect(mocks.authenticateWithYugabyte).not.toHaveBeenCalled();
      expect(mocks.registerWithYugabyte).not.toHaveBeenCalled();
    }
  );

  it.each(['short', 'x'.repeat(129)])('rejects password outside limits', async (password) => {
    const e = event('cadastrar', { email: 'reader@example.invalid', password });
    expect(await actions.default(e)).toMatchObject({ status: 400 });
    expect(mocks.registerWithYugabyte).not.toHaveBeenCalled();
  });

  it('claims editorial invitation only after successful password authentication', async () => {
    const e = event();
    await expect(actions.default(e)).rejects.toMatchObject({ status: 303, location: '/biblioteca' });
    expect(mocks.authenticateWithYugabyte).toHaveBeenCalledWith('reader@example.invalid', 'long-password', undefined);
    expect(mocks.claimInvite).toHaveBeenCalledWith(e.locals);
    expect(mocks.authenticateWithYugabyte.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.claimInvite.mock.invocationCallOrder[0]
    );
  });

  it('does not claim roles or expose provider details after invalid login', async () => {
    mocks.authenticateWithYugabyte.mockResolvedValueOnce({
      success: false,
      error: { message: 'private provider detail' }
    });
    const e = event();
    const result = await actions.default(e);
    expect(result).toMatchObject({ status: 400 });
    expect(mocks.claimInvite).not.toHaveBeenCalled();
  });

  it('guides an existing unconfirmed account without exposing provider details', async () => {
    mocks.authenticateWithYugabyte.mockResolvedValueOnce({
      success: false,
      error: { unconfirmed: true, message: 'Verifique seu e-mail para continuar.' }
    });
    const e = event();
    const result = await actions.default(e);
    expect(result).toMatchObject({
      status: 400,
      data: {
        message: 'Verifique seu e-mail para continuar.',
        unconfirmed: true,
        email: 'reader@example.invalid'
      }
    });
    expect(mocks.claimInvite).not.toHaveBeenCalled();
  });

  it('sends registration confirmation without claiming unverified roles', async () => {
    const e = event('cadastrar', {
      username: 'reader_qa',
      email: 'reader@example.invalid',
      password: 'long-password'
    });
    expect(await actions.default(e)).toMatchObject({ success: true });
    expect(mocks.registerWithYugabyte).toHaveBeenCalledWith(
      'reader@example.invalid',
      'long-password',
      'reader_qa',
      '',
      undefined
    );
    expect(mocks.claimInvite).not.toHaveBeenCalled();
  });

  it('requires a username before attempting registration', async () => {
    const missing = event('cadastrar', { email: 'reader@example.invalid', password: 'long-password' });
    expect(await actions.default(missing)).toMatchObject({
      status: 400,
      data: { message: 'Informe um @handle para criar sua conta.' }
    });
    expect(mocks.registerWithYugabyte).not.toHaveBeenCalled();
  });

  it('shows expired-link guidance without reflecting arbitrary query text', () => {
    const e = event();
    e.url.searchParams.set('erro', 'link-expirado');
    expect(load(e).error).toContain('expirou');
    e.url.searchParams.set('erro', '<script>alert(1)</script>');
    expect(load(e).error).toBe('');
  });
});

describe('confirmation callback', () => {
  it.each(['signup', 'recovery'])('validates %s token and redirects safely', async (type) => {
    const e = event();
    const token = await signSessionJwt(
      {
        sub: '11111111-1111-1111-1111-111111111111',
        email: 'reader@example.invalid',
        type,
        fp: 'initial',
        exp: Math.floor(Date.now() / 1000) + 3600
      },
      TEST_SECRET
    );
    mocks.executeYugabyteSql.mockResolvedValueOnce({
      rows: [{ id: '11111111-1111-1111-1111-111111111111', encrypted_password: null, updated_at: 'initial' }]
    });
    e.url = new URL(
      `https://nox.invalid/auth/confirm?token_hash=${token}&type=${type}&next=https://attacker.invalid`
    );
    await expect(GET(e)).rejects.toMatchObject({
      status: 303,
      location: type === 'recovery' ? '/redefinir' : '/biblioteca'
    });
  });

  it('rejects legacy code query param with link-expirado', async () => {
    const e = event();
    e.url = new URL('https://nox.invalid/auth/confirm?code=legacy-pkce-code');
    await expect(GET(e)).rejects.toMatchObject({
      status: 303,
      location: '/entrar?erro=link-expirado'
    });
  });

  it('rejects unsupported token types', async () => {
    const e = event();
    e.url = new URL('https://nox.invalid/auth/confirm?token_hash=some-token&type=invite');
    await expect(GET(e)).rejects.toMatchObject({
      status: 303,
      location: '/entrar?erro=link-expirado'
    });
  });

  it('expired confirmation redirects to link-expirado', async () => {
    const e = event();
    const expiredToken = await signSessionJwt(
      {
        sub: '11111111-1111-1111-1111-111111111111',
        type: 'signup',
        exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
      },
      TEST_SECRET
    );
    e.url = new URL(`https://nox.invalid/auth/confirm?token_hash=${expiredToken}&type=signup`);
    await expect(GET(e)).rejects.toMatchObject({
      status: 303,
      location: '/entrar?erro=link-expirado'
    });
  });
});
