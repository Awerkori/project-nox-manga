import { describe, it, expect } from 'vitest';
import {
  classifyData,
  enforceSieveSqlWrite,
  enforceSieveSqlParams,
  TABLE_CLASSIFICATIONS,
  MAX_INLINE_SQL_BLOB_BYTES,
  type SieveEntity,
} from '$lib/server/data-sieve';

describe('Project Nox — Data Classification Sieve (Etapa 2)', () => {
  it('classifies essential relational entities as CATEGORY_A_SQL', () => {
    const workMeta: SieveEntity = {
      type: 'work_metadata',
      table: 'works',
      payload: { title: 'Solo Leveling', slug: 'solo-leveling' },
    };
    const decision = classifyData(workMeta);
    expect(decision.category).toBe('CATEGORY_A_SQL');
    expect(decision.target).toBe('YUGABYTEDB');
    expect(decision.allowSqlStorage).toBe(true);
    expect(decision.allowTelegramStorage).toBe(false);
    expect(decision.isSafeToPurge).toBe(false);
  });

  it('classifies chapter metadata and page pointers as CATEGORY_A_SQL', () => {
    const chapterMeta: SieveEntity = {
      type: 'chapter_metadata',
      table: 'chapters',
      payload: { chapter_number: 10, title: 'Chapter 10' },
    };
    const decision = classifyData(chapterMeta);
    expect(decision.category).toBe('CATEGORY_A_SQL');
    expect(decision.target).toBe('YUGABYTEDB');
    expect(decision.allowSqlStorage).toBe(true);
  });

  it('classifies raw images and archive ZIPs as CATEGORY_B_TELEGRAM', () => {
    const imageAsset: SieveEntity = {
      type: 'image_binary',
      sizeBytes: 250_000,
      mimeType: 'image/webp',
      sha256: 'abc123456789def',
    };
    const decision = classifyData(imageAsset);
    expect(decision.category).toBe('CATEGORY_B_TELEGRAM');
    expect(decision.target).toBe('TELEGRAM_STORAGE');
    expect(decision.allowSqlStorage).toBe(false);
    expect(decision.allowTelegramStorage).toBe(true);
    expect(decision.deduplicationKey).toBe('abc123456789def');
  });

  it('classifies large payload binaries (>64KB) as CATEGORY_B_TELEGRAM', () => {
    const largeFile: SieveEntity = {
      type: 'generic',
      sizeBytes: MAX_INLINE_SQL_BLOB_BYTES + 1024,
    };
    const decision = classifyData(largeFile);
    expect(decision.category).toBe('CATEGORY_B_TELEGRAM');
    expect(decision.target).toBe('TELEGRAM_STORAGE');
  });

  it('classifies caches and ephemeral tokens as CATEGORY_C_CACHE_TTL with bounded expiration', () => {
    const searchCache: SieveEntity = {
      type: 'search_cache',
      payload: [{ id: 1, title: 'Results' }],
    };
    const decision = classifyData(searchCache);
    expect(decision.category).toBe('CATEGORY_C_CACHE_TTL');
    expect(decision.target).toBe('LOCAL_CACHE');
    expect(decision.ttlSeconds).toBe(60);
    expect(decision.allowSqlStorage).toBe(false);
  });

  it('classifies release cache as CATEGORY_C_CACHE_TTL with 300s TTL', () => {
    const releaseCache: SieveEntity = {
      type: 'release_cache',
      payload: { items: [] },
    };
    const decision = classifyData(releaseCache);
    expect(decision.category).toBe('CATEGORY_C_CACHE_TTL');
    expect(decision.target).toBe('LOCAL_CACHE');
    expect(decision.ttlSeconds).toBe(300);
  });

  it('classifies duplicates as CATEGORY_D_DISPOSABLE and routes to PURGE', () => {
    const duplicateRecord: SieveEntity = {
      type: 'duplicate_record',
      isDuplicate: true,
      sha256: 'hash-xyz',
    };
    const decision = classifyData(duplicateRecord);
    expect(decision.category).toBe('CATEGORY_D_DISPOSABLE');
    expect(decision.target).toBe('PURGE');
    expect(decision.isSafeToPurge).toBe(true);
    expect(decision.allowSqlStorage).toBe(false);
    expect(decision.allowTelegramStorage).toBe(false);
  });

  it('classifies expired/dead orphan records as CATEGORY_D_DISPOSABLE', () => {
    const deadRecord: SieveEntity = {
      type: 'dead_orphan_record',
      isExpired: true,
    };
    const decision = classifyData(deadRecord);
    expect(decision.category).toBe('CATEGORY_D_DISPOSABLE');
    expect(decision.target).toBe('PURGE');
    expect(decision.isSafeToPurge).toBe(true);
  });

  it('enforceSieveSqlWrite rejects direct insertion of base64 data URIs into SQL', () => {
    const payload = {
      id: 'media-1',
      cover_data: 'data:image/webp;base64,UklGRmQAAABXRUJQVlA4T...',
    };
    const check = enforceSieveSqlWrite('works', payload);
    expect(check.ok).toBe(false);
    expect(check.error).toContain('DATA_SIEVE_VIOLATION');
  });

  it('enforceSieveSqlWrite rejects large raw binary buffers in SQL writes', () => {
    const payload = {
      id: 'media-2',
      raw_bytes: new Uint8Array(8192),
    };
    const check = enforceSieveSqlWrite('media', payload);
    expect(check.ok).toBe(false);
    expect(check.error).toContain('DATA_SIEVE_VIOLATION');
  });

  it('enforceSieveSqlWrite permits normal SQL records with metadata and Telegram references', () => {
    const payload = {
      id: '00000000-0000-0000-0000-000000000001',
      provider: 'telegram',
      provider_key: 'BQACAgEAAxkBA...',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      bytes: 154200,
      width: 1200,
      height: 1800,
      mime: 'image/webp',
    };
    const check = enforceSieveSqlWrite('media', payload);
    expect(check.ok).toBe(true);
  });

  it('enforceSieveSqlParams intercepts and rejects dangerous writes in SQL execution layer', () => {
    // 1. Rejects base64 data URIs
    const base64Res = enforceSieveSqlParams(
      'UPDATE works SET cover_url = $1 WHERE id = $2;',
      ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE...', '123']
    );
    expect(base64Res.ok).toBe(false);
    expect(base64Res.error).toContain('DATA_SIEVE_VIOLATION');

    // 2. Rejects raw large buffers (>4KB)
    const bufferRes = enforceSieveSqlParams(
      'INSERT INTO media (id, raw) VALUES ($1, $2);',
      ['id-1', new Uint8Array(8192)]
    );
    expect(bufferRes.ok).toBe(false);
    expect(bufferRes.error).toContain('DATA_SIEVE_VIOLATION');

    // 3. Rejects illegal inline provider on media table
    const providerRes = enforceSieveSqlParams(
      'INSERT INTO public.media (id, provider) VALUES ($1, $2);',
      ['id-1', 'inline']
    );
    expect(providerRes.ok).toBe(false);
    expect(providerRes.error).toContain('DATA_SIEVE_VIOLATION');

    // 4. Passes normal queries
    const validRes = enforceSieveSqlParams(
      'INSERT INTO public.media (id, provider, access_class) VALUES ($1, $2, $3);',
      ['id-1', 'telegram', 'PUBLIC']
    );
    expect(validRes.ok).toBe(true);

    // 5. Ignores SELECT queries
    const selectRes = enforceSieveSqlParams(
      'SELECT * FROM media WHERE provider = $1;',
      ['inline']
    );
    expect(selectRes.ok).toBe(true);
  });

  it('validates canonical table classifications dictionary', () => {
    expect(TABLE_CLASSIFICATIONS['works']).toBe('CATEGORY_A_SQL');
    expect(TABLE_CLASSIFICATIONS['chapters']).toBe('CATEGORY_A_SQL');
    expect(TABLE_CLASSIFICATIONS['pages']).toBe('CATEGORY_A_SQL');
    expect(TABLE_CLASSIFICATIONS['importer_lite_uploads']).toBe('CATEGORY_C_CACHE_TTL');
    expect(TABLE_CLASSIFICATIONS['importer_telemetry']).toBe('CATEGORY_D_DISPOSABLE');
    expect(TABLE_CLASSIFICATIONS['importer_job_metrics']).toBe('CATEGORY_D_DISPOSABLE');
    expect(TABLE_CLASSIFICATIONS['importer_queue']).toBe('CATEGORY_D_DISPOSABLE');
  });
});

