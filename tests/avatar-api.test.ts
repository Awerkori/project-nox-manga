import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const mocks = vi.hoisted(() => ({
  storeImage: vi.fn(),
  update: vi.fn(),
  eq: vi.fn()
}));

vi.mock('$lib/server/db', () => ({
  member: () => 'member-1',
  privileged: () => ({ from: () => ({ update: mocks.update }) })
}));

vi.mock('$lib/server/media', () => ({
  storeImage: mocks.storeImage,
  RateLimitError: class RateLimitError extends Error {}
}));

import { POST } from '../src/routes/api/avatar/+server';

describe('avatar upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eq.mockResolvedValue({ error: null });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.storeImage.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', mime: 'image/gif' });
  });

  it('forwards GIF bytes unchanged to storage and persists a zero crop position', async () => {
    const original = readFileSync(new URL('./fixtures/test-animated.gif', import.meta.url));
    const originalHash = createHash('sha256').update(original).digest('hex');
    const form = new FormData();
    form.append('file', new Blob([original], { type: 'image/gif' }), 'animated.gif');
    form.append('crop_x', '0');
    form.append('crop_y', '0');
    form.append('crop_zoom', '1.75');

    const response = await POST({
      request: new Request('https://nox.invalid/api/avatar', { method: 'POST', body: form }),
      locals: {}
    } as any);

    expect(response.status).toBe(200);
    const storageForm = mocks.storeImage.mock.calls[0][0] as FormData;
    const storedFile = storageForm.get('file') as File;
    const storedBytes = Buffer.from(await storedFile.arrayBuffer());
    expect(storedFile.type).toBe('image/gif');
    expect(createHash('sha256').update(storedBytes).digest('hex')).toBe(originalHash);
    expect(mocks.update).toHaveBeenCalledWith({
      avatar_id: '11111111-1111-4111-8111-111111111111',
      avatar_crop: { x: 0, y: 0, zoom: 1.75 }
    });
  });
});
