import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadReaderSettings,
  saveReaderSettings,
  resetReaderSettingsMemory,
  DEFAULT_READER_SETTINGS,
  type ReaderSettings
} from '../src/lib/reader-settings';
import { parseCommentBody, threadComments } from '../src/lib/comments';

describe('Reader Settings Engine', () => {
  beforeEach(() => {
    resetReaderSettingsMemory();
    // Clear localStorage mockup
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('loads default reader settings when nothing is stored', () => {
    const settings = loadReaderSettings();
    expect(settings.mode).toBe('webtoon');
    expect(settings.width).toBe(850);
    expect(settings.progressBar).toBe(true);
    expect(settings.progressPosition).toBe('bottom');
    expect(settings.progressDisplay).toBe('percent');
    expect(settings.theme).toBe('dark');
  });

  it('saves and reloads custom reader settings cleanly', () => {
    const custom: ReaderSettings = {
      mode: 'paginated',
      fit: 'container',
      width: 1050,
      gap: true,
      theme: 'oled',
      progressBar: true,
      progressPosition: 'top',
      progressDisplay: 'pages',
      preload: 'off',
      autoHideControls: false
    };

    saveReaderSettings(custom);
    const reloaded = loadReaderSettings();

    expect(reloaded.mode).toBe('paginated');
    expect(reloaded.fit).toBe('container');
    expect(reloaded.width).toBe(1050);
    expect(reloaded.gap).toBe(true);
    expect(reloaded.theme).toBe('oled');
    expect(reloaded.progressPosition).toBe('top');
    expect(reloaded.progressDisplay).toBe('pages');
    expect(reloaded.preload).toBe('off');
    expect(reloaded.autoHideControls).toBe(false);
  });

  it('bounds custom width within safe bounds [400, 1400]', () => {
    saveReaderSettings({
      ...DEFAULT_READER_SETTINGS,
      width: 3000
    });
    const reloaded = loadReaderSettings();
    expect(reloaded.width).toBe(1400);
  });
});

describe('Comments Parsing & Spoilers', () => {
  it('parses inline spoilers and plain text', () => {
    const text = 'Olha esse final! [spoiler]Ele é o vilão secreto![/spoiler] Não esperava.';
    const chunks = parseCommentBody(text);

    expect(chunks.length).toBe(3);
    expect(chunks[0]).toEqual({ type: 'text', content: 'Olha esse final! ' });
    expect(chunks[1]).toEqual({ type: 'spoiler', content: 'Ele é o vilão secreto!' });
    expect(chunks[2]).toEqual({ type: 'text', content: ' Não esperava.' });
  });

  it('parses @mentions correctly', () => {
    const text = 'Fala @Preston, você viu o capítulo? @Yakumo';
    const chunks = parseCommentBody(text);

    const mentions = chunks.filter((c) => c.type === 'mention');
    expect(mentions.length).toBe(2);
    expect(mentions[0].content).toBe('Preston');
    expect(mentions[1].content).toBe('Yakumo');
  });
});
