import { beforeEach, describe, expect, it, vi } from 'vitest';

const { claimInvite } = vi.hoisted(() => ({ claimInvite: vi.fn() }));
vi.mock('$lib/server/invites', () => ({ claimInvite }));
import { actions, load } from '../src/routes/[auth=auth]/+page.server';
import { GET } from '../src/routes/auth/confirm/+server';

// Only local provider doubles: no accounts, email messages or sessions are created remotely.
function event(mode = 'entrar', fields = { email: 'reader@example.invalid', password: 'long-password' }) {
  const auth = {
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ error: null }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null })
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return {
    params: { auth: mode },
    url: new URL(`https://nox.invalid/${mode}`),
    locals: { db: { auth }, user: null },
    request: { formData: async () => form }
  } as any;
}
beforeEach(() => vi.clearAllMocks());

describe('account actions', () => {
  it.each(['entrar', 'cadastrar', 'recuperar'])(
    'rejects invalid email for %s before calling Auth',
    async (mode) => {
      const e = event(mode, { email: 'invalid', password: 'long-password' });
      expect(await actions.default(e)).toMatchObject({ status: 400 });
      for (const fn of Object.values(e.locals.db.auth)) expect(fn).not.toHaveBeenCalled();
    }
  );
  it.each(['short', 'x'.repeat(129)])('rejects password outside limits', async (password) => {
    const e = event('cadastrar', { email: 'reader@example.invalid', password });
    expect(await actions.default(e)).toMatchObject({ status: 400 });
    expect(e.locals.db.auth.signUp).not.toHaveBeenCalled();
  });
  it('claims editorial invitation only after successful password authentication', async () => {
    const e = event();
    await expect(actions.default(e)).rejects.toMatchObject({ status: 303, location: '/biblioteca' });
    expect(e.locals.db.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'reader@example.invalid',
      password: 'long-password'
    });
    expect(claimInvite).toHaveBeenCalledWith(e.locals);
    expect(e.locals.db.auth.signInWithPassword.mock.invocationCallOrder[0]).toBeLessThan(
      claimInvite.mock.invocationCallOrder[0]
    );
  });
  it('does not claim roles or expose provider details after invalid login', async () => {
    const e = event();
    e.locals.db.auth.signInWithPassword.mockResolvedValue({ error: { message: 'private provider detail' } });
    const result = await actions.default(e);
    expect(result).toMatchObject({ status: 400 });
    expect(JSON.stringify(result)).not.toContain('private provider detail');
    expect(claimInvite).not.toHaveBeenCalled();
  });
  it('sends registration confirmation to the own origin without claiming unverified roles', async () => {
    const e = event('cadastrar');
    expect(await actions.default(e)).toMatchObject({ success: true });
    expect(e.locals.db.auth.signUp).toHaveBeenCalledWith({
      email: 'reader@example.invalid',
      password: 'long-password',
      options: { emailRedirectTo: 'https://nox.invalid/auth/confirm' }
    });
    expect(claimInvite).not.toHaveBeenCalled();
  });
  it('shows a safe retry message when email quota is exhausted', async () => {
    const e = event('cadastrar');
    e.locals.db.auth.signUp.mockResolvedValue({ error: { code: 'over_email_send_rate_limit' } });
    expect(await actions.default(e)).toMatchObject({
      status: 400,
      data: { message: 'Limite de envio atingido. Tente novamente mais tarde.' }
    });
  });
  it('recovery requires no password and uses a fixed reset destination', async () => {
    const e = event('recuperar', { email: 'reader@example.invalid', password: '' });
    expect(await actions.default(e)).toMatchObject({ success: true });
    expect(e.locals.db.auth.resetPasswordForEmail).toHaveBeenCalledWith('reader@example.invalid', {
      redirectTo: 'https://nox.invalid/auth/confirm?next=/redefinir'
    });
    expect(claimInvite).not.toHaveBeenCalled();
  });
  it('does not reset a password without an authenticated session', async () => {
    const e = event('redefinir');
    expect(await actions.default(e)).toMatchObject({ status: 401 });
    expect(e.locals.db.auth.updateUser).not.toHaveBeenCalled();
  });
  it('updates only the authenticated account password', async () => {
    const e = event('redefinir');
    e.locals.user = { id: 'local-reader' };
    expect(await actions.default(e)).toMatchObject({ success: true });
    expect(e.locals.db.auth.updateUser).toHaveBeenCalledWith({ password: 'long-password' });
  });
});

describe('confirmation callback', () => {
  it.each(['signup', 'email', 'recovery'])('validates %s OTP before claiming an invitation', async (type) => {
    const e = event();
    e.url = new URL(
      `https://nox.invalid/auth/confirm?token_hash=local-test-token&type=${type}&next=https://attacker.invalid`
    );
    await expect(GET(e)).rejects.toMatchObject({
      status: 303,
      location: type === 'recovery' ? '/redefinir' : '/biblioteca'
    });
    expect(e.locals.db.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'local-test-token', type });
    expect(e.locals.db.auth.verifyOtp.mock.invocationCallOrder[0]).toBeLessThan(
      claimInvite.mock.invocationCallOrder[0]
    );
  });
  it('exchanges a PKCE code and allows only the internal reset path', async () => {
    const e = event();
    e.url = new URL('https://nox.invalid/auth/confirm?code=local-code&next=/redefinir');
    await expect(GET(e)).rejects.toMatchObject({ status: 303, location: '/redefinir' });
    expect(e.locals.db.auth.exchangeCodeForSession).toHaveBeenCalledWith('local-code');
    expect(claimInvite).toHaveBeenCalledOnce();
  });
  it.each(['//attacker.invalid', '/admin', '/redefinir?redirect=https://attacker.invalid'])(
    'rejects callback redirect %s',
    async (next) => {
      const e = event();
      e.url = new URL('https://nox.invalid/auth/confirm?code=local-code');
      e.url.searchParams.set('next', next);
      await expect(GET(e)).rejects.toMatchObject({ status: 303, location: '/biblioteca' });
    }
  );
  it('rejects unsupported token types before calling provider or claiming roles', async () => {
    const e = event();
    e.url = new URL('https://nox.invalid/auth/confirm?token_hash=local-test-token&type=invite');
    await expect(GET(e)).rejects.toMatchObject({ status: 303, location: '/entrar?erro=link-expirado' });
    expect(e.locals.db.auth.verifyOtp).not.toHaveBeenCalled();
    expect(claimInvite).not.toHaveBeenCalled();
  });
  it('expired confirmation never claims roles or returns the token', async () => {
    const e = event();
    e.url = new URL('https://nox.invalid/auth/confirm?token_hash=local-test-token&type=signup');
    e.locals.db.auth.verifyOtp.mockResolvedValue({ error: { message: 'expired' } });
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
