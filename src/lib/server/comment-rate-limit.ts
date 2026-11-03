type CommentRateLimiter = {
  limit(input: { key: string }): Promise<{ success: boolean }>;
};

/**
 * A Cloudflare rate-limit binding is a shared, approximate per-location guard,
 * not a strict global 30-second lock. Never treat KV as an atomic counter.
 * Missing or failing infrastructure must not silently allow comment flooding.
 */
export async function checkCommentPostLimit(env: any, userId: string): Promise<'allowed' | 'limited' | 'unavailable'> {
  const limiter = env?.COMMENT_POST_RATE_LIMITER as CommentRateLimiter | undefined;
  if (!limiter || typeof limiter.limit !== 'function' || !userId) return 'unavailable';
  try {
    const result = await limiter.limit({ key: `comment:user:${userId}` });
    if (result?.success === true) return 'allowed';
    if (result?.success === false) return 'limited';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}
