import { getAuthSecret } from '$lib/server/yugabyte-auth';

type Limiter = { limit(input: { key: string }): Promise<{ success: boolean }> };
type Decision = 'allow' | 'limited' | 'unavailable';

/**
 * Optional Cloudflare rate-limit bindings. These counters are approximate and
 * local to each Cloudflare location; they are not a global security boundary.
 * Configure both bindings together only after choosing and verifying limits.
 */
export async function checkAuthRateLimit(
  request: Request,
  env: any,
  mode: string,
  email: string
): Promise<Decision> {
  const origin: Limiter | undefined = env?.AUTH_ORIGIN_RATE_LIMIT;
  const identity: Limiter | undefined = env?.AUTH_IDENTITY_RATE_LIMIT;
  // Local development may not provide a platform environment. A deployed
  // Worker must not silently lose its abuse guard if bindings are absent.
  if (!origin && !identity) return env ? 'unavailable' : 'allow';
  if (typeof origin?.limit !== 'function' || typeof identity?.limit !== 'function') return 'unavailable';

  // Cloudflare supplies this header. Do not trust X-Forwarded-For, which a
  // client may control. A missing trusted origin must not silently disable a
  // configured limiter.
  const ip = request.headers?.get('cf-connecting-ip')?.trim();
  if (!ip || ip.length > 64 || email.length > 1024 || mode.length > 64) return 'unavailable';

  try {
    const secret = getAuthSecret(env);
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const digest = async (value: string) => {
      const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
      return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    };
    // Bind account attempts to origin to avoid an attacker locking out a
    // victim across all networks. The independent origin budget helps bound
    // attempts against many accounts. Raw IPs and emails never become keys.
    const originKey = await digest(`auth-origin\0${ip}`);
    const subjectKey = await digest(`auth-subject\0${mode}\0${ip}\0${email.trim().toLowerCase()}`);
    const first = await origin.limit({ key: originKey });
    if (first?.success === false) return 'limited';
    if (first?.success !== true) return 'unavailable';
    const second = await identity.limit({ key: subjectKey });
    if (second?.success === false) return 'limited';
    return second?.success === true ? 'allow' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}
