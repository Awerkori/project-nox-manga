import { expect, it } from 'vitest';
import { threadComments } from '../src/lib/comments';
it('keeps parents before replies and orders replies chronologically', () => {
  const comments = [
    { id: 'reply2', parent_id: 'root', created_at: '2026-09-05T12:02:00Z' },
    { id: 'reply1', parent_id: 'root', created_at: '2026-09-05T12:01:00Z' },
    { id: 'root', parent_id: null, created_at: '2026-09-05T12:00:00Z' }
  ];
  expect(threadComments(comments).map((c) => c.id)).toEqual(['root', 'reply1', 'reply2']);
});
it('preserves replies whose original comment is outside the current page', () => {
  const orphan = { id: 'reply', parent_id: 'older', created_at: '2026-09-05' };
  expect(threadComments([orphan])).toEqual([orphan]);
});

it('correctly parses [spoiler] tags into interactive chunks', async () => {
  const { parseCommentBody } = await import('../src/lib/comments');
  const parsed = parseCommentBody('Início [spoiler]o vilão morre[/spoiler] e fim.');
  expect(parsed).toEqual([
    { type: 'text', content: 'Início ' },
    { type: 'spoiler', content: 'o vilão morre' },
    { type: 'text', content: ' e fim.' }
  ]);
});
