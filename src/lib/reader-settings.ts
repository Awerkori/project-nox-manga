import { readPreference, savePreference } from './preferences';

export type ReadingMode = 'webtoon' | 'paginated';
export type PagedDirection = 'ltr' | 'rtl';
export type PageFitMode = 'container' | 'full' | 'custom';
export type ReaderTheme = 'dark' | 'oled' | 'sepia';
export type ProgressPosition = 'bottom' | 'left' | 'right' | 'off';
export type ProgressDisplay = 'percent' | 'pages' | 'both' | 'none';
export type PreloadMode = 'turbo' | 'eco';

export interface ReaderSettings {
  mode: ReadingMode;
  pagedDirection: PagedDirection;
  fit: PageFitMode;
  width: number;
  gap: boolean;
  theme: ReaderTheme;
  progressPosition: ProgressPosition;
  progressDisplay: ProgressDisplay;
  preloadMode: PreloadMode;
  autoHideControls: boolean;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  mode: 'webtoon',
  pagedDirection: 'ltr',
  fit: 'custom',
  width: 850,
  gap: false,
  theme: 'dark',
  progressPosition: 'bottom',
  progressDisplay: 'percent',
  preloadMode: 'turbo',
  autoHideControls: true
};

const PREFS_KEY = 'nox-reader-settings-v3';

let memoryStore: Record<string, string> = {};

export function resetReaderSettingsMemory(): void {
  memoryStore = {};
}

export function loadReaderSettings(): ReaderSettings {
  try {
    const raw = (typeof window !== 'undefined' ? readPreference(PREFS_KEY) : null) || memoryStore[PREFS_KEY] || readPreference(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return sanitizeSettings(parsed);
    }

    // Migration from v2
    const v2Raw = (typeof window !== 'undefined' ? readPreference('nox-reader-settings-v2') : null) || memoryStore['nox-reader-settings-v2'] || readPreference('nox-reader-settings-v2');
    if (v2Raw) {
      const v2 = JSON.parse(v2Raw);
      return sanitizeSettings({
        ...DEFAULT_READER_SETTINGS,
        ...v2,
        progressPosition: v2.progressBar === false ? 'off' : (v2.progressPosition === 'left' || v2.progressPosition === 'right' ? v2.progressPosition : 'bottom'),
        preloadMode: v2.preload === 'off' ? 'eco' : 'turbo'
      });
    }

    // Migration from v1 legacy 'nox-reader'
    const legacyRaw = (typeof window !== 'undefined' ? readPreference('nox-reader') : null) || memoryStore['nox-reader'] || readPreference('nox-reader');
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      return {
        ...DEFAULT_READER_SETTINGS,
        width: Math.min(1400, Math.max(400, Number(legacy.width) || 850)),
        gap: Boolean(legacy.gap),
        preloadMode: legacy.preload === 'off' ? 'eco' : 'turbo'
      };
    }
  } catch {
    // Return defaults if parsing fails
  }

  return { ...DEFAULT_READER_SETTINGS };
}

function sanitizeSettings(parsed: any): ReaderSettings {
  const validPositions: ProgressPosition[] = ['bottom', 'left', 'right', 'off'];
  const validDisplays: ProgressDisplay[] = ['percent', 'pages', 'both', 'none'];
  const validThemes: ReaderTheme[] = ['dark', 'oled', 'sepia'];

  return {
    mode: parsed.mode === 'paginated' ? 'paginated' : 'webtoon',
    pagedDirection: parsed.pagedDirection === 'rtl' ? 'rtl' : 'ltr',
    fit: parsed.fit === 'full' || parsed.fit === 'container' ? parsed.fit : 'custom',
    width: Math.min(1400, Math.max(400, Number(parsed.width) || 850)),
    gap: Boolean(parsed.gap),
    theme: validThemes.includes(parsed.theme) ? parsed.theme : 'dark',
    progressPosition: validPositions.includes(parsed.progressPosition) ? parsed.progressPosition : 'bottom',
    progressDisplay: validDisplays.includes(parsed.progressDisplay) ? parsed.progressDisplay : 'percent',
    preloadMode: parsed.preloadMode === 'eco' ? 'eco' : 'turbo',
    autoHideControls: parsed.autoHideControls !== false
  };
}

export function saveReaderSettings(settings: ReaderSettings): void {
  try {
    const sanitized = sanitizeSettings(settings);
    const serialized = JSON.stringify(sanitized);
    memoryStore[PREFS_KEY] = serialized;
    savePreference(PREFS_KEY, serialized);

    // Keep v2 key in sync for backward compatibility
    savePreference(
      'nox-reader-settings-v2',
      JSON.stringify({
        mode: sanitized.mode,
        fit: sanitized.fit,
        width: sanitized.width,
        gap: sanitized.gap,
        theme: sanitized.theme,
        progressBar: sanitized.progressPosition !== 'off',
        progressPosition: sanitized.progressPosition,
        progressDisplay: sanitized.progressDisplay,
        preload: sanitized.preloadMode === 'turbo' ? 'full' : 'off',
        autoHideControls: sanitized.autoHideControls
      })
    );
  } catch {
    // Silent fallback
  }
}
