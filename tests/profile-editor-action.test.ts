import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  db: null as any,
  storeImage: vi.fn(),
  invalidate: vi.fn()
}));

vi.mock('$lib/server/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/lib/server/db')>();
  return { ...original, privileged: () => state.db };
});

vi.mock('$lib/server/media', () => ({
  storeImage: state.storeImage,
  RateLimitError: class RateLimitError extends Error {
    constructor(readonly retryAfter: number) {
      super('rate limited');
    }
  }
}));

vi.mock('$lib/server/session-cache', () => ({ invalidateUserSession: state.invalidate }));

function commitDatabase() {
  const query: any = {
    update: vi.fn(() => query),
    eq: vi.fn(() => query),
    select: vi.fn(() => query),
    maybeSingle: vi.fn(() => Promise.resolve({
      data: { id: 'member-1', avatar_id: 'avatar-new', banner_id: 'banner-new' },
      error: null
    }))
  };
  return { from: vi.fn(() => query), query };
}

async function submit(values: Record<string, string | Blob>) {
  const form = new FormData();
  form.set('display_name', 'Leitor QA');
  form.set('bio', 'Bio QA');
  for (const [key, value] of Object.entries(values)) {
    if (value instanceof Blob) form.set(key, value, `${key}.gif`);
    else form.set(key, value);
  }
  const { actions } = await import('../src/routes/me/+page.server');
  return actions.updateProfile({
    request: new Request('https://projectnox.test/me?/updateProfile', { method: 'POST', body: form }),
    locals: { user: { id: 'member-1' } }
  } as any);
}

describe('profile editor canonical commit', () => {
  it('stages both uploads before a single member activation and clears the header cache', async () => {
    const db = commitDatabase();
    state.db = db;
    state.storeImage.mockReset()
      .mockResolvedValueOnce({ id: 'avatar-new' })
      .mockResolvedValueOnce({ id: 'banner-new' });
    state.invalidate.mockReset();

    const result = await submit({
      avatar_file: new Blob(['avatar'], { type: 'image/gif' }),
      banner_file: new Blob(['banner'], { type: 'image/gif' }),
      avatar_crop: JSON.stringify({ x: 0, y: 40, zoom: 1.2 }),
      banner_crop: JSON.stringify({ x: 55, y: 20, zoom: 1.4 })
    });

    expect(state.storeImage).toHaveBeenNthCalledWith(1, expect.any(FormData), 'member-1', 'avatar');
    expect(state.storeImage).toHaveBeenNthCalledWith(2, expect.any(FormData), 'member-1', 'banner');
    expect(db.query.update).toHaveBeenCalledWith(expect.objectContaining({
      avatar_id: 'avatar-new',
      banner_id: 'banner-new',
      avatar_crop: { x: 0, y: 40, zoom: 1.2 }
    }));
    expect(state.invalidate).toHaveBeenCalledWith('member-1');
    expect(result).toMatchObject({ success: true, action: 'profile' });
  });

  it('does not activate either asset or clear the cache when staging another asset fails', async () => {
    const db = commitDatabase();
    state.db = db;
    state.storeImage.mockReset()
      .mockResolvedValueOnce({ id: 'avatar-new' })
      .mockRejectedValueOnce(new Error('storage unavailable'));
    state.invalidate.mockReset();

    const result = await submit({
      avatar_file: new Blob(['avatar'], { type: 'image/gif' }),
      banner_file: new Blob(['banner'], { type: 'image/gif' })
    });

    expect(db.query.update).not.toHaveBeenCalled();
    expect(state.invalidate).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: 502 });
  });
});
