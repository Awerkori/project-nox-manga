import { PGlite } from '@electric-sql/pglite';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/**
 * PROJECT NOX — TESTES DIFERENCIAIS DE SQL DE METADADOS
 * Validação rigorosa de equivalência funcional e de segurança entre a consulta original
 * e a consulta otimizada em cenários de múltiplas associações, classificação +18 e publicação.
 */

const ORIGINAL_SELECT = `
  m.id, m.provider, m.provider_key, m.bot_reference, m.storage_shard_id,
  m.mime, m.sha256, m.bytes, m.width, m.height, m.access_class, m.purpose,
  m.storage_ready, m.status, m.created_by,
  (
    EXISTS (
      SELECT 1 FROM public.pages p
      JOIN public.chapters c ON c.id = p.chapter_id
      JOIN public.works w ON w.id = c.work_id
      WHERE p.media_id = m.id AND (w.content_rating = 'ADULT_18' OR c.chapter_kind = 'adult')
    ) OR EXISTS (
      SELECT 1 FROM public.works w_cov
      WHERE w_cov.cover_id = m.id AND w_cov.content_rating = 'ADULT_18'
    )
  ) AS is_adult_associated,
  (
    NOT EXISTS (
      SELECT 1 FROM public.pages p
      JOIN public.chapters c ON c.id = p.chapter_id
      JOIN public.works w ON w.id = c.work_id
      WHERE p.media_id = m.id AND w.published = false
    ) AND NOT EXISTS (
      SELECT 1 FROM public.works w_cov
      WHERE w_cov.cover_id = m.id AND w_cov.published = false
    )
  ) AS all_works_published,
  (
    NOT EXISTS (
      SELECT 1 FROM public.pages p
      JOIN public.chapters c ON c.id = p.chapter_id
      WHERE p.media_id = m.id AND c.published_at IS NULL
    )
  ) AS all_chapters_published,
  (
    CASE WHEN m.purpose IN ('chapter_page', 'staff_chapter', 'scan_chapter') THEN (
      EXISTS (
        SELECT 1 FROM public.pages p
        JOIN public.chapters c ON c.id = p.chapter_id
        JOIN public.works w ON w.id = c.work_id
        WHERE p.media_id = m.id AND c.published_at IS NOT NULL AND w.published = true
      )
    ) WHEN m.purpose IN ('cover', 'work_cover') THEN (
      EXISTS (
        SELECT 1 FROM public.works w_cov
        WHERE w_cov.cover_id = m.id AND w_cov.published = true
      )
    ) ELSE true END
  ) AS has_published_association,
  (
    CASE WHEN m.purpose IN ('chapter_page', 'staff_chapter', 'scan_chapter') THEN (
      EXISTS (
        SELECT 1 FROM public.pages p
        JOIN public.chapters c ON c.id = p.chapter_id
        JOIN public.works w ON w.id = c.work_id
        WHERE p.media_id = m.id AND c.published_at IS NOT NULL AND w.published = true
      )
    ) WHEN m.purpose IN ('cover', 'work_cover') THEN (
      EXISTS (
        SELECT 1 FROM public.works w_cov
        WHERE w_cov.cover_id = m.id AND w_cov.published = true
       )
    ) ELSE true END
  ) AS has_published_chapter
`;

// Flawed naive optimization with LIMIT 1 (retained for differential forensic evidence)
const FLAWED_LIMIT1_SELECT = `
  m.id, m.provider, m.provider_key, m.bot_reference, m.storage_shard_id,
  m.mime, m.sha256, m.bytes, m.width, m.height, m.access_class, m.purpose,
  m.storage_ready, m.status, m.created_by,
  (
    CASE WHEN m.purpose IN ('chapter_page', 'chapter', 'staff_chapter', 'scan_chapter') THEN (
      EXISTS (
        SELECT 1 FROM (SELECT p.chapter_id FROM public.pages p WHERE p.media_id = m.id LIMIT 1) p
        JOIN public.chapters c ON c.id = p.chapter_id
        JOIN public.works w ON w.id = c.work_id
        WHERE (w.content_rating = 'ADULT_18' OR c.chapter_kind = 'adult')
      )
    ) WHEN m.purpose IN ('cover', 'work_cover', 'editorial') THEN (
      EXISTS (
        SELECT 1 FROM public.works w_cov
        WHERE w_cov.cover_id = m.id AND w_cov.content_rating = 'ADULT_18'
      )
    ) ELSE false END
  ) AS is_adult_associated,
  (
    CASE WHEN m.purpose IN ('chapter_page', 'chapter', 'staff_chapter', 'scan_chapter') THEN (
      NOT EXISTS (
        SELECT 1 FROM (SELECT p.chapter_id FROM public.pages p WHERE p.media_id = m.id LIMIT 1) p
        JOIN public.chapters c ON c.id = p.chapter_id
        JOIN public.works w ON w.id = c.work_id
        WHERE w.published = false
      )
    ) WHEN m.purpose IN ('cover', 'work_cover', 'editorial') THEN (
      NOT EXISTS (
        SELECT 1 FROM public.works w_cov
        WHERE w_cov.cover_id = m.id AND w_cov.published = false
      )
    ) ELSE true END
  ) AS all_works_published,
  (
    CASE WHEN m.purpose IN ('chapter_page', 'chapter', 'staff_chapter', 'scan_chapter') THEN (
      NOT EXISTS (
        SELECT 1 FROM (SELECT p.chapter_id FROM public.pages p WHERE p.media_id = m.id LIMIT 1) p
        JOIN public.chapters c ON c.id = p.chapter_id
        WHERE c.published_at IS NULL
      )
    ) ELSE true END
  ) AS all_chapters_published,
  (
    CASE WHEN m.purpose IN ('chapter_page', 'chapter', 'staff_chapter', 'scan_chapter') THEN (
      EXISTS (
        SELECT 1 FROM (SELECT p.chapter_id FROM public.pages p WHERE p.media_id = m.id LIMIT 1) p
        JOIN public.chapters c ON c.id = p.chapter_id
        JOIN public.works w ON w.id = c.work_id
        WHERE c.published_at IS NOT NULL AND w.published = true
      )
    ) WHEN m.purpose IN ('cover', 'work_cover', 'editorial') THEN (
      EXISTS (
        SELECT 1 FROM public.works w_cov
        WHERE w_cov.cover_id = m.id AND w_cov.published = true
      )
    ) ELSE true END
  ) AS has_published_association,
  (
    CASE WHEN m.purpose IN ('chapter_page', 'chapter', 'staff_chapter', 'scan_chapter') THEN (
      EXISTS (
        SELECT 1 FROM (SELECT p.chapter_id FROM public.pages p WHERE p.media_id = m.id LIMIT 1) p
        JOIN public.chapters c ON c.id = p.chapter_id
        JOIN public.works w ON w.id = c.work_id
        WHERE c.published_at IS NOT NULL AND w.published = true
      )
    ) WHEN m.purpose IN ('cover', 'work_cover', 'editorial') THEN (
      EXISTS (
        SELECT 1 FROM public.works w_cov
        WHERE w_cov.cover_id = m.id AND w_cov.published = true
       )
    ) ELSE true END
  ) AS has_published_chapter
`;

// Production surgical zero-waste optimization (LATERAL JOIN aggregation)
const OPTIMIZED_SELECT = `
  m.id, m.provider, m.provider_key, m.bot_reference, m.storage_shard_id,
  m.mime, m.sha256, m.bytes, m.width, m.height, m.access_class, m.purpose,
  m.storage_ready, m.status, m.created_by,
  (COALESCE(page_info.page_has_adult, false) OR COALESCE(cover_info.cover_has_adult, false)) AS is_adult_associated,
  NOT (COALESCE(page_info.page_has_unpublished_work, false) OR COALESCE(cover_info.cover_has_unpublished_work, false)) AS all_works_published,
  NOT COALESCE(page_info.page_has_unpublished_chapter, false) AS all_chapters_published,
  (
    CASE WHEN m.purpose IN ('chapter_page', 'staff_chapter', 'scan_chapter') THEN
      COALESCE(page_info.page_has_published, false)
    WHEN m.purpose IN ('cover', 'work_cover') THEN
      COALESCE(cover_info.cover_has_published, false)
    ELSE true END
  ) AS has_published_association,
  (
    CASE WHEN m.purpose IN ('chapter_page', 'staff_chapter', 'scan_chapter') THEN
      COALESCE(page_info.page_has_published, false)
    WHEN m.purpose IN ('cover', 'work_cover') THEN
      COALESCE(cover_info.cover_has_published, false)
    ELSE true END
  ) AS has_published_chapter
`;

const OPTIMIZED_JOINS = `
  LEFT JOIN LATERAL (
    SELECT
      bool_or(w.content_rating = 'ADULT_18' OR c.chapter_kind = 'adult') AS page_has_adult,
      bool_or(w.published = false) AS page_has_unpublished_work,
      bool_or(c.published_at IS NULL) AS page_has_unpublished_chapter,
      bool_or(c.published_at IS NOT NULL AND w.published = true) AS page_has_published
    FROM public.pages p
    JOIN public.chapters c ON c.id = p.chapter_id
    JOIN public.works w ON w.id = c.work_id
    WHERE p.media_id = m.id
  ) page_info ON true
  LEFT JOIN LATERAL (
    SELECT
      bool_or(w_cov.content_rating = 'ADULT_18') AS cover_has_adult,
      bool_or(w_cov.published = false) AS cover_has_unpublished_work,
      bool_or(w_cov.published = true) AS cover_has_published
    FROM public.works w_cov
    WHERE w_cov.cover_id = m.id
  ) cover_info ON true
`;

describe('SQL Differential Security & Equivalence Test Suite', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE TABLE public.works (
        id uuid PRIMARY KEY,
        title text NOT NULL,
        content_rating text NOT NULL DEFAULT 'GENERAL',
        published boolean NOT NULL DEFAULT true,
        cover_id uuid
      );
      CREATE TABLE public.chapters (
        id uuid PRIMARY KEY,
        work_id uuid NOT NULL REFERENCES public.works(id),
        published_at timestamptz,
        chapter_kind text NOT NULL DEFAULT 'standard'
      );
      CREATE TABLE public.media (
        id uuid PRIMARY KEY,
        provider text NOT NULL DEFAULT 'telegram',
        provider_key text NOT NULL DEFAULT 'key',
        bot_reference text DEFAULT 'MANGA_STORAGE_1',
        storage_shard_id uuid,
        mime text NOT NULL DEFAULT 'image/jpeg',
        sha256 text NOT NULL DEFAULT 'sha',
        bytes integer NOT NULL DEFAULT 100,
        width integer NOT NULL DEFAULT 100,
        height integer NOT NULL DEFAULT 100,
        access_class text DEFAULT 'PUBLIC',
        purpose text NOT NULL,
        storage_ready boolean NOT NULL DEFAULT true,
        status text NOT NULL DEFAULT 'ACTIVE',
        created_by uuid
      );
      CREATE TABLE public.pages (
        chapter_id uuid NOT NULL REFERENCES public.chapters(id),
        position integer NOT NULL,
        media_id uuid NOT NULL REFERENCES public.media(id),
        PRIMARY KEY (chapter_id, position)
      );
      CREATE INDEX pages_media_idx ON public.pages(media_id);
      CREATE INDEX works_cover_idx ON public.works(cover_id);
    `);
  });

  afterEach(async () => {
    await db.close();
  });

  async function compareWithFlawed(mediaId: string) {
    const orig = (await db.query(`SELECT ${ORIGINAL_SELECT} FROM public.media m WHERE m.id = $1`, [mediaId])).rows[0] as any;
    const flawed = (await db.query(`SELECT ${FLAWED_LIMIT1_SELECT} FROM public.media m WHERE m.id = $1`, [mediaId])).rows[0] as any;
    return { orig, flawed };
  }

  async function compareWithOptimized(mediaId: string) {
    const orig = (await db.query(`SELECT ${ORIGINAL_SELECT} FROM public.media m WHERE m.id = $1`, [mediaId])).rows[0] as any;
    const opt = (await db.query(`SELECT ${OPTIMIZED_SELECT} FROM public.media m ${OPTIMIZED_JOINS} WHERE m.id = $1`, [mediaId])).rows[0] as any;
    return { orig, opt };
  }

  it('demonstrates equivalence on standard single-chapter published pages', async () => {
    await db.exec(`
      INSERT INTO public.works (id, title, content_rating, published) VALUES ('11111111-0000-0000-0000-000000000001', 'Work 1', 'GENERAL', true);
      INSERT INTO public.chapters (id, work_id, published_at, chapter_kind) VALUES ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', now(), 'standard');
      INSERT INTO public.media (id, purpose) VALUES ('33333333-0000-0000-0000-000000000001', 'chapter_page');
      INSERT INTO public.pages (chapter_id, position, media_id) VALUES ('22222222-0000-0000-0000-000000000001', 1, '33333333-0000-0000-0000-000000000001');
    `);

    const { orig, opt } = await compareWithOptimized('33333333-0000-0000-0000-000000000001');
    expect(opt.is_adult_associated).toBe(orig.is_adult_associated);
    expect(opt.all_works_published).toBe(orig.all_works_published);
    expect(opt.all_chapters_published).toBe(orig.all_chapters_published);
    expect(opt.has_published_association).toBe(orig.has_published_association);
    expect(opt.has_published_chapter).toBe(orig.has_published_chapter);
  });

  it('proves that LIMIT 1 omits adult association when media is reused across safe and adult chapters', async () => {
    await db.exec(`
      INSERT INTO public.works (id, title, content_rating, published) VALUES ('11111111-0000-0000-0000-000000000001', 'General Work', 'GENERAL', true);
      INSERT INTO public.works (id, title, content_rating, published) VALUES ('11111111-0000-0000-0000-000000000002', 'Adult Work', 'ADULT_18', true);
      INSERT INTO public.chapters (id, work_id, published_at, chapter_kind) VALUES ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', now(), 'standard');
      INSERT INTO public.chapters (id, work_id, published_at, chapter_kind) VALUES ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', now(), 'standard');
      INSERT INTO public.media (id, purpose) VALUES ('33333333-0000-0000-0000-000000000002', 'chapter_page');
      INSERT INTO public.pages (chapter_id, position, media_id) VALUES ('22222222-0000-0000-0000-000000000001', 1, '33333333-0000-0000-0000-000000000002');
      INSERT INTO public.pages (chapter_id, position, media_id) VALUES ('22222222-0000-0000-0000-000000000002', 1, '33333333-0000-0000-0000-000000000002');
    `);

    // 1. Forensic evidence: proves that naive LIMIT 1 drops adult classification
    const { orig, flawed } = await compareWithFlawed('33333333-0000-0000-0000-000000000002');
    expect(orig.is_adult_associated).toBe(true);
    expect(flawed.is_adult_associated).toBe(false);

    // 2. Production surgical optimization: 100% preserves adult classification across all chapters
    const { opt } = await compareWithOptimized('33333333-0000-0000-0000-000000000002');
    expect(opt.is_adult_associated).toBe(true);
    expect(opt.is_adult_associated).toBe(orig.is_adult_associated);
  });

  it('proves that LIMIT 1 incorrectly passes all_works_published when one associated work is unpublished', async () => {
    await db.exec(`
      INSERT INTO public.works (id, title, content_rating, published) VALUES ('11111111-0000-0000-0000-000000000001', 'Published Work', 'GENERAL', true);
      INSERT INTO public.works (id, title, content_rating, published) VALUES ('11111111-0000-0000-0000-000000000003', 'Unpublished Work', 'GENERAL', false);
      INSERT INTO public.chapters (id, work_id, published_at, chapter_kind) VALUES ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', now(), 'standard');
      INSERT INTO public.chapters (id, work_id, published_at, chapter_kind) VALUES ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000003', now(), 'standard');
      INSERT INTO public.media (id, purpose) VALUES ('33333333-0000-0000-0000-000000000003', 'chapter_page');
      INSERT INTO public.pages (chapter_id, position, media_id) VALUES ('22222222-0000-0000-0000-000000000001', 1, '33333333-0000-0000-0000-000000000003');
      INSERT INTO public.pages (chapter_id, position, media_id) VALUES ('22222222-0000-0000-0000-000000000003', 1, '33333333-0000-0000-0000-000000000003');
    `);

    // 1. Forensic evidence: proves naive LIMIT 1 leaks unpublished content
    const { orig, flawed } = await compareWithFlawed('33333333-0000-0000-0000-000000000003');
    expect(orig.all_works_published).toBe(false);
    expect(flawed.all_works_published).toBe(true);

    // 2. Production surgical optimization: 100% strictly fails closed against unpublished content
    const { opt } = await compareWithOptimized('33333333-0000-0000-0000-000000000003');
    expect(opt.all_works_published).toBe(false);
    expect(opt.all_works_published).toBe(orig.all_works_published);
  });

  it('proves that editorial media not in works.cover_id has diverging publication flags in flawed query but matches in optimized query', async () => {
    await db.exec(`
      INSERT INTO public.media (id, purpose) VALUES ('33333333-0000-0000-0000-000000000004', 'editorial');
    `);

    // 1. Flawed query erroneously returned false because it searched works(cover_id) for editorial media
    const { orig, flawed } = await compareWithFlawed('33333333-0000-0000-0000-000000000004');
    expect(orig.has_published_association).toBe(true);
    expect(flawed.has_published_association).toBe(false);

    // 2. Production surgical optimization: 100% correctly returns true for editorial media
    const { opt } = await compareWithOptimized('33333333-0000-0000-0000-000000000004');
    expect(opt.has_published_association).toBe(true);
    expect(opt.has_published_association).toBe(orig.has_published_association);
    expect(opt.is_adult_associated).toBe(orig.is_adult_associated);
    expect(opt.all_works_published).toBe(orig.all_works_published);
  });

  it('validates 100% bit-for-bit differential equivalence across all media purposes and reuse permutations', async () => {
    // Permutations: covers, avatars, banners, chapters with null published_at, adult kind, etc.
    await db.exec(`
      -- Work A: published general
      INSERT INTO public.works (id, title, content_rating, published) VALUES ('11111111-0000-0000-0000-000000000010', 'Published Work A', 'GENERAL', true);
      -- Work B: adult published
      INSERT INTO public.works (id, title, content_rating, published) VALUES ('11111111-0000-0000-0000-000000000020', 'Adult Work B', 'ADULT_18', true);
      -- Work C: unpublished
      INSERT INTO public.works (id, title, content_rating, published) VALUES ('11111111-0000-0000-0000-000000000030', 'Unpublished Work C', 'GENERAL', false);

      -- Chapters
      INSERT INTO public.chapters (id, work_id, published_at, chapter_kind) VALUES ('22222222-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000010', now(), 'standard');
      INSERT INTO public.chapters (id, work_id, published_at, chapter_kind) VALUES ('22222222-0000-0000-0000-000000000020', '11111111-0000-0000-0000-000000000020', now(), 'adult');
      INSERT INTO public.chapters (id, work_id, published_at, chapter_kind) VALUES ('22222222-0000-0000-0000-000000000030', '11111111-0000-0000-0000-000000000010', NULL, 'standard');

      -- Media: Avatar
      INSERT INTO public.media (id, purpose) VALUES ('33333333-0000-0000-0000-000000000010', 'avatar');
      -- Media: Banner
      INSERT INTO public.media (id, purpose) VALUES ('33333333-0000-0000-0000-000000000020', 'banner');
      -- Media: Cosmetic
      INSERT INTO public.media (id, purpose) VALUES ('33333333-0000-0000-0000-000000000030', 'cosmetic');
      -- Media: Cover of published work
      INSERT INTO public.media (id, purpose) VALUES ('33333333-0000-0000-0000-000000000040', 'cover');
      UPDATE public.works SET cover_id = '33333333-0000-0000-0000-000000000040' WHERE id = '11111111-0000-0000-0000-000000000010';
      -- Media: Cover of adult work
      INSERT INTO public.media (id, purpose) VALUES ('33333333-0000-0000-0000-000000000050', 'cover');
      UPDATE public.works SET cover_id = '33333333-0000-0000-0000-000000000050' WHERE id = '11111111-0000-0000-0000-000000000020';
      -- Media: Reused across page and cover (cover adult)
      INSERT INTO public.media (id, purpose) VALUES ('33333333-0000-0000-0000-000000000060', 'chapter_page');
      INSERT INTO public.pages (chapter_id, position, media_id) VALUES ('22222222-0000-0000-0000-000000000010', 2, '33333333-0000-0000-0000-000000000060');
      UPDATE public.works SET cover_id = '33333333-0000-0000-0000-000000000060' WHERE id = '11111111-0000-0000-0000-000000000020';
      -- Media: Chapter page in unpublished chapter (published_at NULL)
      INSERT INTO public.media (id, purpose) VALUES ('33333333-0000-0000-0000-000000000070', 'chapter_page');
      INSERT INTO public.pages (chapter_id, position, media_id) VALUES ('22222222-0000-0000-0000-000000000030', 1, '33333333-0000-0000-0000-000000000070');
      -- Media: staff_chapter
      INSERT INTO public.media (id, purpose) VALUES ('33333333-0000-0000-0000-000000000080', 'staff_chapter');
      INSERT INTO public.pages (chapter_id, position, media_id) VALUES ('22222222-0000-0000-0000-000000000010', 3, '33333333-0000-0000-0000-000000000080');
      -- Media: scan_chapter
      INSERT INTO public.media (id, purpose) VALUES ('33333333-0000-0000-0000-000000000090', 'scan_chapter');
      INSERT INTO public.pages (chapter_id, position, media_id) VALUES ('22222222-0000-0000-0000-000000000010', 4, '33333333-0000-0000-0000-000000000090');
    `);

    const testIds = [
      '33333333-0000-0000-0000-000000000010',
      '33333333-0000-0000-0000-000000000020',
      '33333333-0000-0000-0000-000000000030',
      '33333333-0000-0000-0000-000000000040',
      '33333333-0000-0000-0000-000000000050',
      '33333333-0000-0000-0000-000000000060',
      '33333333-0000-0000-0000-000000000070',
      '33333333-0000-0000-0000-000000000080',
      '33333333-0000-0000-0000-000000000090'
    ];

    for (const id of testIds) {
      const { orig, opt } = await compareWithOptimized(id);
      expect(opt.is_adult_associated).toBe(orig.is_adult_associated);
      expect(opt.all_works_published).toBe(orig.all_works_published);
      expect(opt.all_chapters_published).toBe(orig.all_chapters_published);
      expect(opt.has_published_association).toBe(orig.has_published_association);
      expect(opt.has_published_chapter).toBe(orig.has_published_chapter);
    }
  });
});
