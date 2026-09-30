export type AvatarCrop = {
  x: number;
  y: number;
  zoom: number;
};

const finite = (value: unknown, fallback: number) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Cropping is presentation metadata. Keep this small parser shared by the
 * editor, server actions and every avatar renderer so a persisted zero never
 * silently becomes the default centre position.
 */
export function normalizeAvatarCrop(value: unknown): AvatarCrop {
  let raw: any = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }

  return {
    x: clamp(finite(raw?.x, 50), 0, 100),
    y: clamp(finite(raw?.y, 50), 0, 100),
    zoom: clamp(finite(raw?.zoom, 1), 1, 3)
  };
}

export function avatarCropStyle(value: unknown): string {
  const crop = normalizeAvatarCrop(value);
  return `object-position: ${crop.x}% ${crop.y}%; transform: scale(${crop.zoom}); transform-origin: center center;`;
}
