/** Runtime registry for uploaded avatar frames, kept separate from the shop catalog. */
export interface FrameConfig {
  asset_url: string;
  style_data: {
    frame_scale?: number;
    frame_offset_x?: number;
    frame_offset_y?: number;
    frame_fit?: 'contain' | 'cover';
    [key: string]: any;
  };
}

// The current curated catalog has no image-backed items. Keep this small map
// in sync if one is added; the catalog consistency test enforces that invariant.
export const CURATED_IMAGE_FRAMES: ReadonlyMap<string, FrameConfig> = new Map();

const dynamicFramesRegistry = new Map<string, FrameConfig>();

export function registerDynamicFrame(id: string, config: FrameConfig) {
  if (id && config) dynamicFramesRegistry.set(id, config);
}

export function getFrameConfig(frameId: string | null | undefined): FrameConfig | null {
  if (!frameId) return null;
  const cleanId = frameId.split(':')[0];
  const registered = dynamicFramesRegistry.get(cleanId);
  if (registered) return registered;
  const curated = CURATED_IMAGE_FRAMES.get(cleanId);
  if (curated) return curated;
  if (
    cleanId.startsWith('/media/') ||
    cleanId.startsWith('/cosmetics/') ||
    cleanId.startsWith('http') ||
    cleanId.startsWith('data:')
  ) {
    return {
      asset_url: cleanId,
      style_data: { frame_scale: 1.25, frame_offset_x: 0, frame_offset_y: 0, frame_fit: 'contain' }
    };
  }
  return null;
}
