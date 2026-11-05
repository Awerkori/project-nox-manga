import { expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('$env/dynamic/public', () => ({ env: {} }));

import * as yugabyte from '../src/lib/server/yugabyte';
import { GET } from '../src/routes/api/releases/+server';

it('keeps every timeline chapter for a work and cursors from the final chapter', async () => {
  const rows = Array.from({ length: 5 }, (_, index) => ({
    work_id: '11111111-1111-4111-8111-111111111111',
    work_slug: 'one-piece',
    work_title: 'One Piece',
    work_cover_id: null,
    work_kind: 'MANGA',
    work_content_rating: 'GENERAL',
    latest_published_at: `2026-09-28T00:0${5 - index}:00Z`,
    chapter_id: `00000000-0000-4000-8000-00000000000${index + 1}`,
    chapter_number: index + 1,
    chapter_display_number: String(index + 1),
    canonical_chapter_key: `default:${index + 1}`,
    chapter_order_key: String(index + 1),
    chapter_kind: 'CHAPTER',
    chapter_edition: null,
    chapter_language: 'pt-BR',
    chapter_title: null,
    chapter_published_at: `2026-09-28T00:0${5 - index}:00Z`
  }));
  vi.spyOn(yugabyte, 'fetchRecentReleaseTimelineFromYugabyte').mockResolvedValue(rows as any);

  const response = await GET({
    url: new URL('https://manga.project-nox.test/api/releases?limit=5'),
    platform: { env: {} }
  } as any);
  const json = await response.json();

  expect(json.releases).toHaveLength(1);
  expect(json.releases[0].chapters).toHaveLength(5);
  expect(json.hasMore).toBe(true);
  expect(json.nextCursorTime).toBe(rows[4].chapter_published_at);
  expect(json.nextCursorId).toBe(rows[4].chapter_id);
});

it('bounds cache growth, preserves cache hits within capacity, and evicts oldest entries', async () => {
  const fetchSpy = vi.spyOn(yugabyte, 'fetchRecentReleaseTimelineFromYugabyte').mockResolvedValue([]);

  // Populate 120 unique keys (capacity is 100)
  for (let i = 0; i < 120; i++) {
    await GET({
      url: new URL(`https://manga.project-nox.test/api/releases?cursorId=uuid-${i}&cursorTime=2026-11-05T00:00:${String(i % 60).padStart(2, '0')}Z&limit=10`),
      platform: { env: {} }
    } as any);
  }

  expect(fetchSpy).toHaveBeenCalledTimes(120);

  // Calling a recent key (e.g. uuid-115) should be a CACHE HIT (no extra fetch)
  await GET({
    url: new URL(`https://manga.project-nox.test/api/releases?cursorId=uuid-115&cursorTime=2026-11-05T00:00:${String(115 % 60).padStart(2, '0')}Z&limit=10`),
    platform: { env: {} }
  } as any);
  expect(fetchSpy).toHaveBeenCalledTimes(120);

  // Calling an early key (uuid-0, evicted because capacity is 100) triggers a re-fetch
  await GET({
    url: new URL(`https://manga.project-nox.test/api/releases?cursorId=uuid-0&cursorTime=2026-11-05T00:00:00Z&limit=10`),
    platform: { env: {} }
  } as any);
  expect(fetchSpy).toHaveBeenCalledTimes(121);
});
