import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadReaderSettings,
  saveReaderSettings,
  resetReaderSettingsMemory,
  DEFAULT_READER_SETTINGS,
  type ReaderSettings
} from '../src/lib/reader-settings';
import { parseCommentBody, stripSpoilers, threadComments } from '../src/lib/comments';
import { chapterIdentityLabel } from '../src/lib/chapter-identity';

describe('Reader Settings Engine', () => {
  beforeEach(() => {
    resetReaderSettingsMemory();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('loads default reader settings when nothing is stored with progressPosition off', () => {
    const settings = loadReaderSettings();
    expect(settings.mode).toBe('webtoon');
    expect(settings.width).toBe(850);
    expect(settings.progressPosition).toBe('off');
    expect(settings.progressDisplay).toBe('percent');
    expect(settings.preloadMode).toBe('turbo');
    expect(settings.theme).toBe('dark');
  });

  it('saves and reloads custom reader settings cleanly', () => {
    const custom: ReaderSettings = {
      mode: 'paginated',
      pagedDirection: 'rtl',
      fit: 'container',
      width: 1050,
      gap: true,
      theme: 'oled',
      progressPosition: 'left',
      progressDisplay: 'pages',
      preloadMode: 'eco',
      autoHideControls: false
    };

    saveReaderSettings(custom);
    const reloaded = loadReaderSettings();

    expect(reloaded.mode).toBe('paginated');
    expect(reloaded.pagedDirection).toBe('rtl');
    expect(reloaded.fit).toBe('container');
    expect(reloaded.width).toBe(1050);
    expect(reloaded.gap).toBe(true);
    expect(reloaded.theme).toBe('oled');
    expect(reloaded.progressPosition).toBe('left');
    expect(reloaded.progressDisplay).toBe('pages');
    expect(reloaded.preloadMode).toBe('eco');
    expect(reloaded.autoHideControls).toBe(false);
  });

  it('supports all 4 mandatory progress positions: bottom, left, right, off', () => {
    for (const pos of ['bottom', 'left', 'right', 'off'] as const) {
      saveReaderSettings({
        ...DEFAULT_READER_SETTINGS,
        progressPosition: pos
      });
      const reloaded = loadReaderSettings();
      expect(reloaded.progressPosition).toBe(pos);
    }
  });

  it('supports turbo and eco preloading modes', () => {
    saveReaderSettings({ ...DEFAULT_READER_SETTINGS, preloadMode: 'turbo' });
    expect(loadReaderSettings().preloadMode).toBe('turbo');

    saveReaderSettings({ ...DEFAULT_READER_SETTINGS, preloadMode: 'eco' });
    expect(loadReaderSettings().preloadMode).toBe('eco');
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

describe('Chapter Identity Presentation', () => {
  it('strips redundant pt-BR language qualifiers from chapter presentations', () => {
    expect(chapterIdentityLabel({ number: 76, display_number: '76', language: 'pt-BR' })).toBe('76');
    expect(chapterIdentityLabel({ number: 76, display_number: '76', language: 'pt' })).toBe('76');
    expect(chapterIdentityLabel({ number: 76, display_number: '76', language: 'und' })).toBe('76');
    expect(chapterIdentityLabel({ number: 76, display_number: '76', language: 'default' })).toBe('76');
  });

  it('preserves non-default language or edition qualifiers when legitimately required', () => {
    expect(chapterIdentityLabel({ number: 76, display_number: '76', edition: 'extra', language: 'pt-BR' })).toBe('76 · extra');
    expect(chapterIdentityLabel({ number: 76, display_number: '76', language: 'en' })).toBe('76 · en');
  });
});

describe('Comments Parsing & Spoilers', () => {
  it('parses inline spoilers and plain text with BBCode', () => {
    const text = 'Olha esse final! [spoiler]Ele é o vilão secreto![/spoiler] Não esperava.';
    const chunks = parseCommentBody(text);

    expect(chunks.length).toBe(3);
    expect(chunks[0]).toEqual({ type: 'text', content: 'Olha esse final! ' });
    expect(chunks[1]).toEqual({ type: 'spoiler', content: 'Ele é o vilão secreto!' });
    expect(chunks[2]).toEqual({ type: 'text', content: ' Não esperava.' });
  });

  it('parses Discord style ||spoiler|| syntax seamlessly', () => {
    const text = 'O protagonista ||descobriu a verdade sobre o clã|| no final!';
    const chunks = parseCommentBody(text);

    expect(chunks.length).toBe(3);
    expect(chunks[0]).toEqual({ type: 'text', content: 'O protagonista ' });
    expect(chunks[1]).toEqual({ type: 'spoiler', content: 'descobriu a verdade sobre o clã' });
    expect(chunks[2]).toEqual({ type: 'text', content: ' no final!' });
  });

  it('supports both Discord and BBCode spoilers simultaneously', () => {
    const text = '||spoiler discord|| e [spoiler]spoiler bbcode[/spoiler]';
    const chunks = parseCommentBody(text);

    expect(chunks.length).toBe(3);
    expect(chunks[0]).toEqual({ type: 'spoiler', content: 'spoiler discord' });
    expect(chunks[1]).toEqual({ type: 'text', content: ' e ' });
    expect(chunks[2]).toEqual({ type: 'spoiler', content: 'spoiler bbcode' });
  });

  it('parses embedded media markdown tags and marks GIFs and spoilers accurately', () => {
    const text = 'Olha esse meme: ![meme](https://nox.site/media/cat.gif) e ||![cena secreta](https://nox.site/media/death.png)||';
    const chunks = parseCommentBody(text);

    const media = chunks.filter((c) => c.type === 'media');
    expect(media.length).toBe(2);

    expect(media[0]).toEqual({
      type: 'media',
      content: 'https://nox.site/media/cat.gif',
      mediaUrl: 'https://nox.site/media/cat.gif',
      mediaAlt: 'meme',
      isSpoiler: false,
      isGif: true
    });

    expect(media[1]).toEqual({
      type: 'media',
      content: 'https://nox.site/media/death.png',
      mediaUrl: 'https://nox.site/media/death.png',
      mediaAlt: 'cena secreta',
      isSpoiler: true,
      isGif: false
    });
  });

  it('strips spoilers and media tags cleanly to avoid leaking in notifications', () => {
    const text = 'Oi @joao! Olha ||isso aqui é muito secreto|| e veja ![foto](https://img.com/a.png)';
    const clean = stripSpoilers(text);
    expect(clean).toBe('Oi @joao! Olha [spoiler oculto] e veja [mídia]');
    expect(clean.includes('secreto')).toBe(false);
  });

  it('parses @mentions correctly', () => {
    const text = 'Fala @Preston, você viu o capítulo? @Yakumo';
    const chunks = parseCommentBody(text);

    const mentions = chunks.filter((c) => c.type === 'mention');
    expect(mentions.length).toBe(2);
    expect(mentions[0].content).toBe('Preston');
    expect(mentions[1].content).toBe('Yakumo');
  });

  it('parses standalone image, GIF, and Giphy URLs accurately', () => {
    const text = 'Reação: https://media.giphy.com/media/test1234/giphy.gif e https://site.com/image.webp';
    const chunks = parseCommentBody(text);

    const media = chunks.filter((c) => c.type === 'media');
    expect(media.length).toBe(2);
    expect(media[0].isGif).toBe(true);
    expect(media[1].isGif).toBe(false);
  });
});
