import { readPreference, savePreference } from './preferences';

export type ReadingMode = 'webtoon' | 'paginated';
export type PageFitMode = 'container' | 'full' | 'custom';
export type ReaderTheme = 'dark' | 'oled' | 'sepia';
export type ProgressPosition = 'bottom' | 'top';
export type ProgressDisplay = 'percent' | 'pages' | 'both';

export interface ReaderSettings {
  mode: ReadingMode;
  fit: PageFitMode;
  width: number;
  gap: boolean;
  theme: ReaderTheme;
  progressBar: boolean;
  progressPosition: ProgressPosition;
  progressDisplay: ProgressDisplay;
  preload: 'full' | 'off';
  autoHideControls: boolean;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  mode: 'webtoon',
  fit: 'custom',
  width: 850,
  gap: false,
  theme: 'dark',
  progressBar: true,
  progressPosition: 'bottom',
  progressDisplay: 'percent',
  preload: 'full',
  autoHideControls: true
};

const PREFS_KEY = 'nox-reader-settings-v2';

let memoryStore: Record<string, string> = {};

export function resetReaderSettingsMemory(): void {
  memoryStore = {};
}

export function loadReaderSettings(): ReaderSettings {
  try {
    const raw = (typeof window !== 'undefined' ? readPreference(PREFS_KEY) : null) || memoryStore[PREFS_KEY] || readPreference(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        mode: parsed.mode === 'paginated' ? 'paginated' : 'webtoon',
        fit: parsed.fit === 'full' || parsed.fit === 'container' ? parsed.fit : 'custom',
        width: Math.min(1400, Math.max(400, Number(parsed.width) || 850)),
        gap: Boolean(parsed.gap),
        theme: parsed.theme === 'oled' || parsed.theme === 'sepia' ? parsed.theme : 'dark',
        progressBar: parsed.progressBar !== false,
        progressPosition: parsed.progressPosition === 'top' ? 'top' : 'bottom',
        progressDisplay:
          parsed.progressDisplay === 'pages' || parsed.progressDisplay === 'both'
            ? parsed.progressDisplay
            : 'percent',
        preload: parsed.preload === 'off' ? 'off' : 'full',
        autoHideControls: parsed.autoHideControls !== false
      };
    }

    // Migration from v1 legacy 'nox-reader'
    const legacyRaw = (typeof window !== 'undefined' ? readPreference('nox-reader') : null) || memoryStore['nox-reader'] || readPreference('nox-reader');
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      return {
        ...DEFAULT_READER_SETTINGS,
        width: Math.min(1400, Math.max(400, Number(legacy.width) || 850)),
        gap: Boolean(legacy.gap),
        preload: legacy.preload === 'off' ? 'off' : 'full'
      };
    }
  } catch {
    // Return defaults if parsing fails
  }

  return { ...DEFAULT_READER_SETTINGS };
}

export function saveReaderSettings(settings: ReaderSettings): void {
  try {
    const serialized = JSON.stringify(settings);
    memoryStore[PREFS_KEY] = serialized;
    savePreference(PREFS_KEY, serialized);

    const legacy = JSON.stringify({
      width: settings.width,
      gap: settings.gap,
      preload: settings.preload
    });
    memoryStore['nox-reader'] = legacy;
    savePreference('nox-reader', legacy);
  } catch {
    // Silent fallback
  }
}
