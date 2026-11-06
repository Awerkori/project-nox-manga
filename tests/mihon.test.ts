import { describe, it, expect } from 'vitest';
import { hashToken, matchesETag } from '../src/lib/server/mihon';

describe('Mihon API & Security Helpers', () => {
  it('hashes token consistently with SHA-256', async () => {
    const token = 'nox_mh_0123456789abcdef';
    const hash1 = await hashToken(token);
    const hash2 = await hashToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hashes for different tokens', async () => {
    const hashA = await hashToken('nox_mh_token_a');
    const hashB = await hashToken('nox_mh_token_b');
    expect(hashA).not.toBe(hashB);
  });

  it('matches strong and weak ETags per RFC 9110 weak comparison', () => {
    const etag = '"chapter-123-20-abc"';
    expect(matchesETag(etag, etag)).toBe(true);
    expect(matchesETag(`W/${etag}`, etag)).toBe(true);
    expect(matchesETag(etag, `W/${etag}`)).toBe(true);
    expect(matchesETag(`W/${etag}`, `W/${etag}`)).toBe(true);
    expect(matchesETag('"other-tag", ' + etag, etag)).toBe(true);
    expect(matchesETag('"other-tag", W/' + etag, etag)).toBe(true);
    expect(matchesETag('*', etag)).toBe(true);
    expect(matchesETag('"different-tag"', etag)).toBe(false);
    expect(matchesETag(null, etag)).toBe(false);
    expect(matchesETag('', etag)).toBe(false);
  });
});
