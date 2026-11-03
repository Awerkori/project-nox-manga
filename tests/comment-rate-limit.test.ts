import { describe, expect, it, vi } from 'vitest';
import { checkCommentPostLimit } from '../src/lib/server/comment-rate-limit';
import { POST } from '../src/routes/api/action/+server';
import * as yugabyte from '../src/lib/server/yugabyte';

describe('comment post guard', () => {
  it('uses the authenticated identity and distinguishes success and denial', async () => {
    const limit = vi.fn().mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false });
    const env = { COMMENT_POST_RATE_LIMITER: { limit } };
    expect(await checkCommentPostLimit(env, 'reader-1')).toBe('allowed');
    expect(await checkCommentPostLimit(env, 'reader-1')).toBe('limited');
    expect(limit).toHaveBeenCalledWith({ key: 'comment:user:reader-1' });
  });

  it('fails closed if the binding is missing, rejects, or returns an invalid result', async () => {
    expect(await checkCommentPostLimit({}, 'reader-1')).toBe('unavailable');
    expect(await checkCommentPostLimit({ COMMENT_POST_RATE_LIMITER: { limit: vi.fn().mockRejectedValue(new Error('offline')) } }, 'reader-1')).toBe('unavailable');
    expect(await checkCommentPostLimit({ COMMENT_POST_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({}) } }, 'reader-1')).toBe('unavailable');
  });

  it.each([
    [{ COMMENT_POST_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: false }) } }, 429],
    [{}, 503]
  ])('blocks before chapter lookup or any SQL when denied or unavailable', async (env, status) => {
    const sql = vi.spyOn(yugabyte, 'executeYugabyteSql');
    const request = new Request('https://projectnox.org/api/action', {
      method: 'POST',
      body: JSON.stringify({ scope: 'member', action: 'comment', data: { body: 'hello', chapter_id: 'chapter' } })
    });
    await expect(POST({ request, locals: { user: { id: 'reader-1' }, role: 'USER' }, platform: { env } })).rejects.toMatchObject({ status });
    expect(sql).not.toHaveBeenCalled();
    sql.mockRestore();
  });

  it('preserves posting when the limiter allows the authenticated reader', async () => {
    const sql = vi.spyOn(yugabyte, 'executeYugabyteSql').mockResolvedValue({
      rows: [{ id: 'comment-1', user_id: 'reader-1', work_id: 'work-1', body: 'hello' }],
      rowCount: 1
    });
    const limit = vi.fn().mockResolvedValue({ success: true });
    const request = new Request('https://projectnox.org/api/action', {
      method: 'POST',
      body: JSON.stringify({ scope: 'member', action: 'comment', data: { body: 'hello', work_id: 'work-1' } })
    });
    const response = await POST({ request, locals: { user: { id: 'reader-1' }, role: 'USER' }, platform: { env: { COMMENT_POST_RATE_LIMITER: { limit } } } });
    expect(response.status).toBe(200);
    expect(sql.mock.calls.some(([query]) => /INSERT INTO comments/i.test(query))).toBe(true);
    expect(limit).toHaveBeenCalledWith({ key: 'comment:user:reader-1' });
    sql.mockRestore();
  });
});
