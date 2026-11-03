import { describe, expect, it } from 'vitest';
import { CURATED_COSMETIC_ITEMS, getFrameConfig as catalogGet, registerDynamicFrame as catalogRegister } from '../src/lib/cosmetics-catalog';
import { CURATED_IMAGE_FRAMES, getFrameConfig, registerDynamicFrame } from '../src/lib/frame-config';

describe('lightweight frame registry', () => {
  it('keeps curated image-backed assets in sync with the shop catalog', () => {
    const expected = CURATED_COSMETIC_ITEMS.filter(item => item.asset_url).map(item => [
      item.id, { asset_url: item.asset_url, style_data: item.style_data || {} }
    ]);
    expect([...CURATED_IMAGE_FRAMES.entries()]).toEqual(expected);
  });

  it('shares the dynamic registry with catalog consumers and preserves URL resolution', () => {
    const config = { asset_url: '/media/custom-frame', style_data: { frame_scale: 1.2 } };
    registerDynamicFrame('test-custom-frame', config);
    expect(catalogGet('test-custom-frame:gold')).toEqual(config);
    catalogRegister('test-catalog-frame', config);
    expect(getFrameConfig('test-catalog-frame')).toEqual(config);
    expect(getFrameConfig('/media/frame')).toEqual({ asset_url: '/media/frame', style_data: { frame_scale: 1.25, frame_offset_x: 0, frame_offset_y: 0, frame_fit: 'contain' } });
    expect(getFrameConfig('frame_cosmic_nox')).toBeNull();
  });
});
