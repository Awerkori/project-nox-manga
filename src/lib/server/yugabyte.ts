import { Client } from 'pg';

export interface SqlResponse<T = any> {
  rows: T[];
  rowCount: number;
}

const DEFAULT_GATEWAY_URL = 'https://project-nox-importer-gateway.project-nox-awerkori.workers.dev';

interface LkgEntry<T> {
  data: T;
  timestamp: number;
}

const lkgStore = new Map<string, LkgEntry<any>>();

export function setLkg<T>(key: string, data: T): void {
  if (data !== null && data !== undefined) {
    lkgStore.set(key, { data, timestamp: Date.now() });
  }
}

export function getLkg<T>(key: string, maxAgeMs = 120_000): { data: T; ageSec: number } | null {
  const entry = lkgStore.get(key);
  if (!entry) return null;
  const ageMs = Date.now() - entry.timestamp;
  if (ageMs > maxAgeMs) return null;
  return { data: entry.data, ageSec: Math.round(ageMs / 1000) };
}

/**
 * Executes a resilient query against YugabyteDB with automatic Last-Known-Good (LKG) fallback.
 * Guarantees that transient database pauses or connection hiccups NEVER crash public SSR pages.
 */
export async function withYugabyteLkg<T>(
  op: string,
  fetcher: () => Promise<T>,
  fallbackDefault: T
): Promise<T> {
  const start = performance.now();
  try {
    const data = await fetcher();
    const dur = Math.round(performance.now() - start);
    console.log(`[DATA_PLANE] DATA_SOURCE=YUGABYTE DATA_STATE=LIVE op=${op} dur=${dur}ms`);
    setLkg(op, data);
    return data;
  } catch (err: any) {
    const dur = Math.round(performance.now() - start);
    const lkg = getLkg<T>(op);
    if (lkg) {
      console.warn(
        `[DATA_PLANE] DATA_SOURCE=YUGABYTE DATA_STATE=LKG op=${op} LKG_AGE_SEC=${lkg.ageSec} dur=${dur}ms error=${err?.message || err}`
      );
      return lkg.data;
    }
    console.error(
      `[DATA_PLANE] DATA_SOURCE=YUGABYTE DATA_STATE=DEGRADED op=${op} dur=${dur}ms error=${err?.message || err}`
    );
    return fallbackDefault;
  }
}

/**
 * Execute raw SQL query against authoritative YugabyteDB.
 * Strategy 1: Hyperdrive native connection via platform.env.HYPERDRIVE (sub-millisecond connection in worker)
 * Strategy 2: High-speed internal Cloudflare Worker Gateway fallback (if secret is present in environment)
 */
export async function executeYugabyteSql<T = any>(
  query: string,
  params: any[] = [],
  platformEnv?: any
): Promise<SqlResponse<T>> {
  // Strategy 1: Hyperdrive native pooled connection if available
  const hyperdrive = platformEnv?.HYPERDRIVE;
  if (hyperdrive?.connectionString) {
    const connectStart = performance.now();
    try {
      const client = new Client({
        connectionString: hyperdrive.connectionString,
        connectionTimeoutMillis: 1500
      });
      await client.connect();
      const connectDur = Math.round(performance.now() - connectStart);
      try {
        const queryStart = performance.now();
        const res = await client.query(query, params);
        const queryDur = Math.round(performance.now() - queryStart);
        if (queryDur > 500) {
          console.warn(`[YUGABYTE_SLOW_QUERY] connect=${connectDur}ms query=${queryDur}ms`);
        }
        return {
          rows: res.rows || [],
          rowCount: res.rowCount ?? (res.rows ? res.rows.length : 0)
        };
      } finally {
        await client.end().catch(() => {});
      }
    } catch (hdErr: any) {
      console.warn('[YUGABYTE_HYPERDRIVE_FALLBACK]', hdErr?.message || hdErr);
    }
  }

  // Strategy 2: Internal Cloudflare Worker Gateway fallback (ONLY if secret token is configured)
  const token = platformEnv?.NOX_STORAGE_BRIDGE_TOKEN || (typeof process !== 'undefined' ? process.env?.NOX_STORAGE_BRIDGE_TOKEN : '');
  if (!token) {
    throw new Error('Hyperdrive failed and NOX_STORAGE_BRIDGE_TOKEN is not configured for fallback');
  }

  const gatewayUrl = platformEnv?.NOX_IMPORTER_GATEWAY_URL || DEFAULT_GATEWAY_URL;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(`${gatewayUrl}/api/internal/importer/sql`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, params }),
      signal: controller.signal
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gateway SQL error (${res.status}): ${errText}`);
    }

    const json: any = await res.json();
    if (!json.success) {
      throw new Error(json.error || 'Gateway SQL query failed');
    }

    return {
      rows: json.rows || [],
      rowCount: json.rowCount ?? (json.rows ? json.rows.length : 0)
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Run a small authoritative operation in one Hyperdrive-backed YSQL
 * transaction.  Unlike executeYugabyteSql this deliberately does not fall
 * back to the HTTP gateway: BEGIN/COMMIT semantics cannot be preserved across
 * independent gateway requests.
 */
export async function withYugabyteTransaction<T>(
  platformEnv: any,
  operation: (client: Client) => Promise<T>
): Promise<T> {
  const connectionString = platformEnv?.HYPERDRIVE?.connectionString;
  if (!connectionString) throw new Error('YUGABYTE_TRANSACTION_UNAVAILABLE');

  const client = new Client({ connectionString, connectionTimeoutMillis: 1_500 });
  await client.connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
}

// ============================================================
// EXPLICIT, TYPED YUGABYTE PUBLIC READ HELPERS
// ============================================================

export interface YugabyteWork {
  id: string;
  slug: string;
  title: string;
  aliases: string[] | null;
  synopsis: string | null;
  description: string | null;
  author: string | null;
  artist: string | null;
  kind: string;
  status: string;
  year: number | null;
  age_rating: string | null;
  published: boolean;
  featured: boolean;
  cover_id: string | null;
  updated_at: string;
  created_at: string;
  content_rating: string | null;
  views_total: number;
}

export interface YugabyteChapter {
  id: string;
  // Kept for clients which still consume the legacy numeric field. It is not
  // an identity and can be null for title-only specials.
  number: number | string | null;
  display_number: string | null;
  canonical_chapter_key: string | null;
  chapter_order_key: string | null;
  chapter_kind: string | null;
  edition: string | null;
  language: string | null;
  title: string | null;
  published_at: string | null;
  views_total: number;
  work_id?: string;
}

export interface YugabyteTag {
  id: string;
  name: string;
  slug: string;
  kind: string;
}

export interface YugabyteReleaseRow {
  work_id: string;
  work_slug: string;
  work_title: string;
  work_cover_id: string | null;
  work_kind: string;
  work_content_rating: string | null;
  latest_published_at: string;
  chapter_id: string;
  chapter_number: number | string | null;
  chapter_display_number: string | null;
  canonical_chapter_key: string | null;
  chapter_order_key: string | null;
  chapter_kind: string | null;
  chapter_edition: string | null;
  chapter_language: string | null;
  chapter_title: string | null;
  chapter_published_at: string;
}

const WORK_SELECT_COLUMNS = `
  id, slug, title, aliases, synopsis, description, author, artist,
  kind, status, year, age_rating, published, featured, cover_id,
  updated_at, created_at, content_rating, views_total
`;

// Home SSR serializes these rows into the document. Keep this deliberately
// small: detail-only fields such as aliases and description can otherwise add
// substantial CPU and response size to every cold public Home render.
const HOME_WORK_SELECT_COLUMNS = `
  id, slug, title, LEFT(COALESCE(synopsis, ''), 1200) AS synopsis,
  author, artist, kind, status, featured, cover_id, content_rating, views_total
`;

const HOME_MOST_READ_SELECT_COLUMNS = `
  id, slug, title, author, kind, status, featured, cover_id, content_rating, views_total
`;

/**
 * Fetch top published works ordered by updated_at (Novas Obras).
 */
export async function fetchHomeWorksFromYugabyte(platformEnv?: any): Promise<YugabyteWork[]> {
  return withYugabyteLkg(
    'home_works',
    async () => {
      const sql = `
        SELECT ${HOME_WORK_SELECT_COLUMNS}
        FROM works
        WHERE published = true
        ORDER BY updated_at DESC
        LIMIT 16;
      `;
      const res = await executeYugabyteSql<YugabyteWork>(sql, [], platformEnv);
      return res.rows;
    },
    []
  );
}

/**
 * Fetch top published works ordered by views_total (Mais Lidos).
 */
export async function fetchMostReadFromYugabyte(platformEnv?: any): Promise<YugabyteWork[]> {
  return withYugabyteLkg(
    'home_most_read',
    async () => {
      const sql = `
        SELECT ${HOME_MOST_READ_SELECT_COLUMNS}
        FROM works
        WHERE published = true
        ORDER BY views_total DESC
        LIMIT 16;
      `;
      const res = await executeYugabyteSql<YugabyteWork>(sql, [], platformEnv);
      return res.rows;
    },
    []
  );
}

/**
 * Fetch recent releases with their latest chapters.
 */
export async function fetchRecentReleasesFromYugabyte(
  limit = 15,
  chaptersPerWork = 4,
  cursorTime?: string | null,
  cursorId?: string | null,
  platformEnv?: any,
  kind?: string | null
): Promise<YugabyteReleaseRow[]> {
  const opKey = `recent_releases_${limit}_${chaptersPerWork}_${cursorTime || 'top'}_${cursorId || 'top'}_${kind || 'all'}`;
  return withYugabyteLkg(
    opKey,
    async () => {
      // The publication transaction maintains this frontier. Use existing
      // works/latest and chapters/work/published indexes, not a catalogue-wide GROUP BY.
      let cursorClause = '';
      let kindClause = '';
      const params: any[] = [limit, chaptersPerWork];
      if (cursorTime && cursorId) {
        params.push(cursorTime, cursorId);
        cursorClause = `AND (w.latest_chapter_published_at, w.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
      }
      if (kind && kind.toUpperCase() !== 'ALL') {
        params.push(kind.toUpperCase());
        kindClause = `AND UPPER(w.kind) = $${params.length}`;
      }

      const sql = `
        WITH latest_works AS MATERIALIZED (
          SELECT w.id as work_id, w.slug as work_slug, w.title as work_title, w.cover_id as work_cover_id,
                 w.kind as work_kind, w.content_rating as work_content_rating,
                 w.latest_chapter_published_at as latest_published_at
          FROM works w
          WHERE w.latest_chapter_published_at IS NOT NULL AND w.published = true
            ${kindClause}
            ${cursorClause}
          ORDER BY w.latest_chapter_published_at DESC
          LIMIT $1
        )
        SELECT lw.work_id, lw.work_slug, lw.work_title, lw.work_cover_id, lw.work_kind, lw.work_content_rating,
               lw.latest_published_at,
               c.id AS chapter_id, c.number AS chapter_number, c.display_number AS chapter_display_number,
               c.canonical_chapter_key, c.chapter_order_key, c.chapter_kind,
               c.edition AS chapter_edition, c.language AS chapter_language,
               c.title AS chapter_title, c.published_at AS chapter_published_at
        FROM latest_works lw
        CROSS JOIN LATERAL (
          SELECT id, number, display_number, canonical_chapter_key, chapter_order_key,
                 chapter_kind, edition, language, title, published_at
          FROM chapters
          WHERE work_id = lw.work_id AND published_at IS NOT NULL
          ORDER BY published_at DESC
          LIMIT $2
        ) c
        ORDER BY lw.latest_published_at DESC, c.published_at DESC;
      `;

      const res = await executeYugabyteSql<YugabyteReleaseRow>(sql, params, platformEnv);
      return res.rows;
    },
    []
  );
}

/**
 * Fetch the public releases timeline by chapter rather than by work.
 *
 * The Home intentionally shows a small, grouped preview per work. The
 * releases page is different: it is the public publication timeline, so a
 * burst from one work must not make otherwise valid published chapters
 * invisible merely because that work already has four entries in the list.
 *
 * Cursoring on the immutable chapter publication tuple keeps pagination
 * stable when several chapters share a publication timestamp.
 */
export async function fetchRecentReleaseTimelineFromYugabyte(
  limit = 24,
  cursorTime?: string | null,
  cursorId?: string | null,
  platformEnv?: any,
  kind?: string | null
): Promise<YugabyteReleaseRow[]> {
  const opKey = `recent_release_timeline_${limit}_${cursorTime || 'top'}_${cursorId || 'top'}_${kind || 'all'}`;
  return withYugabyteLkg(
    opKey,
    async () => {
      let cursorClause = '';
      let kindClause = '';
      const params: any[] = [limit];
      if (cursorTime && cursorId) {
        params.push(cursorTime, cursorId);
        cursorClause = `AND (c.published_at, c.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
      }
      if (kind && kind.toUpperCase() !== 'ALL') {
        params.push(kind.toUpperCase());
        kindClause = `AND UPPER(w.kind) = $${params.length}`;
      }

      const sql = `
        SELECT w.id AS work_id, w.slug AS work_slug, w.title AS work_title,
               w.cover_id AS work_cover_id, w.kind AS work_kind,
               w.content_rating AS work_content_rating,
               c.published_at AS latest_published_at,
               c.id AS chapter_id, c.number AS chapter_number,
               c.display_number AS chapter_display_number,
               c.canonical_chapter_key, c.chapter_order_key, c.chapter_kind,
               c.edition AS chapter_edition, c.language AS chapter_language,
               c.title AS chapter_title, c.published_at AS chapter_published_at
        FROM chapters c
        INNER JOIN works w ON w.id = c.work_id
        WHERE c.published_at IS NOT NULL
          AND w.published = true
          ${kindClause}
          ${cursorClause}
        ORDER BY c.published_at DESC, c.id DESC
        LIMIT $1;
      `;

      const res = await executeYugabyteSql<YugabyteReleaseRow>(sql, params, platformEnv);
      return res.rows;
    },
    []
  );
}

/**
 * Fetch a single work by slug or id from Yugabyte.
 */
export async function fetchWorkFromYugabyte(
  slugOrId: string,
  platformEnv?: any
): Promise<YugabyteWork | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
  return withYugabyteLkg(
    `work_${slugOrId}`,
    async () => {
      const sql = isUuid
        ? `SELECT ${WORK_SELECT_COLUMNS} FROM works WHERE id = $1 AND published = true LIMIT 1;`
        : `SELECT ${WORK_SELECT_COLUMNS} FROM works WHERE slug = $1 AND published = true LIMIT 1;`;

      const res = await executeYugabyteSql<YugabyteWork>(sql, [slugOrId], platformEnv);
      return res.rows[0] || null;
    },
    null
  );
}

export interface YugabyteCatalogOptions {
  q?: string;
  tag?: string;
  kind?: string;
  status?: string;
  contentRating?: string;
  sort?: 'recentes' | 'titulo' | 'views' | 'updated_at';
  limit?: number;
  offset?: number;
}

export type YugabyteWorkSearchOptions = YugabyteCatalogOptions;

let cachedPublishedCount: { timestamp: number; count: number } | null = null;
const PUBLISHED_COUNT_TTL_MS = 600_000;

/**
 * Fetch total number of published works from authoritative YugabyteDB.
 * Cached in-memory with LKG fallback to avoid full table scans on every catalog page load.
 */
export async function fetchPublishedWorksCountFromYugabyte(platformEnv?: any): Promise<number> {
  if (cachedPublishedCount && Date.now() - cachedPublishedCount.timestamp < PUBLISHED_COUNT_TTL_MS) {
    return cachedPublishedCount.count;
  }
  return withYugabyteLkg(
    'published_works_count',
    async () => {
      const res = await executeYugabyteSql<{ count: string }>(
        'SELECT COUNT(*)::int AS count FROM works WHERE published = true;',
        [],
        platformEnv
      );
      const count = parseInt(res.rows[0]?.count || '0', 10);
      if (count > 0) {
        cachedPublishedCount = { timestamp: Date.now(), count };
      }
      return count || 9430;
    },
    cachedPublishedCount?.count || 9430
  );
}

let cachedAllTags: { timestamp: number; tags: YugabyteTag[] } | null = null;
const ALL_TAGS_TTL_MS = 600_000;
const CATALOG_TAGS_CACHE_URL = 'https://edge-cache.project-nox.internal/catalog-filter-tags-v1';
const CATALOG_TAGS_EDGE_TTL_S = 6 * 60 * 60;
const CATALOG_TAG_MIN_WORKS = 10;

async function computeCatalogFilterTags(platformEnv?: any): Promise<YugabyteTag[]> {
  try {
    const res = await executeYugabyteSql<YugabyteTag>(
      `SELECT id, name, slug, kind FROM catalog_filter_tags ORDER BY name ASC;`,
      [],
      platformEnv
    );
    if (res.rows.length > 0) {
      cachedAllTags = { timestamp: Date.now(), tags: res.rows };
      return res.rows;
    }
  } catch {
    /* fallback to dynamic aggregate if table missing */
  }

  const res = await executeYugabyteSql<YugabyteTag>(
    `SELECT t.id, t.name, t.slug, t.kind
       FROM tags t
       JOIN (SELECT tag_id FROM work_tags GROUP BY tag_id HAVING count(*) >= $1) used ON used.tag_id = t.id
      ORDER BY t.name ASC;`,
    [CATALOG_TAG_MIN_WORKS],
    platformEnv
  );
  if (res.rows.length > 0) {
    cachedAllTags = { timestamp: Date.now(), tags: res.rows };
    try {
      const cache = (globalThis as any).caches?.default;
      await cache?.put(
        CATALOG_TAGS_CACHE_URL,
        new Response(JSON.stringify(res.rows), {
          headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${CATALOG_TAGS_EDGE_TTL_S}` }
        })
      );
    } catch {
      /* edge cache is best-effort */
    }
  }
  return res.rows;
}

/**
 * Catalogue filter tags (fast indexed read from catalog_filter_tags, ~1.8ms).
 * Cached in-memory for 10 minutes with LKG fallback.
 */
export async function fetchTagsFromYugabyte(platformEnv?: any): Promise<YugabyteTag[]> {
  if (cachedAllTags && Date.now() - cachedAllTags.timestamp < ALL_TAGS_TTL_MS && cachedAllTags.tags.length > 0) {
    return cachedAllTags.tags;
  }
  return withYugabyteLkg('all_tags', () => computeCatalogFilterTags(platformEnv), cachedAllTags?.tags || []);
}

/**
 * Authoritative catalog search and listing from YugabyteDB.
 * Handles both unfiltered catalog pagination and multi-facet filtering (search, tag, kind, status).
 */
export async function fetchCatalogFromYugabyte(
  options: YugabyteCatalogOptions = {},
  platformEnv?: any
): Promise<{ works: YugabyteWork[]; total: number }> {
  const limit = Math.max(1, Math.min(100, Math.floor(options.limit ?? 20)));
  const offset = Math.max(0, Math.floor(options.offset ?? 0));
  const sort = options.sort || 'recentes';
  const sortCol = sort === 'titulo' ? 'title' : sort === 'views' ? 'views_total' : 'updated_at';
  const sortAsc = sort === 'titulo';

  const rawQ = options.q !== undefined ? options.q.trim() : '';
  const q = rawQ.slice(0, 100).replace(/[%_\\]/g, '').trim();
  if (rawQ.length > 0 && q.length === 0) {
    return { works: [], total: 0 };
  }

  const kind = (options.kind || '').trim().toUpperCase();
  const status = (options.status || '').trim().toUpperCase();
  const contentRating = (options.contentRating || '').trim().toUpperCase();
  const tag = (options.tag || '').trim().toLowerCase();

  const isUnfiltered = !q && !kind && !status && !contentRating && !tag;

  const cacheKey = `catalog_${isUnfiltered ? 'unfiltered' : `${q}_${kind}_${status}_${contentRating}_${tag}`}_${sort}_${limit}_${offset}`;

  return withYugabyteLkg(
    cacheKey,
    async () => {
      if (isUnfiltered) {
        // Fast path for unfiltered default catalog: avoid distributed window count scan
        const [worksRes, totalCount] = await Promise.all([
          executeYugabyteSql<YugabyteWork>(
            `SELECT ${WORK_SELECT_COLUMNS}
             FROM works
             WHERE published = true
             ORDER BY ${sortCol} ${sortAsc ? 'ASC' : 'DESC'}
             LIMIT $1 OFFSET $2;`,
            [limit, offset],
            platformEnv
          ),
          fetchPublishedWorksCountFromYugabyte(platformEnv)
        ]);
        return {
          works: worksRes.rows,
          total: totalCount
        };
      }

      // Filtered path
      const params: any[] = [];
      const where: string[] = ['published = true'];

      if (q) {
        params.push(`%${q}%`);
        const qParamIdx = params.length;

        if (kind) {
          params.push(kind);
          where.push(`kind = $${params.length}`);
        }
        if (['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED'].includes(status)) {
          params.push(status);
          where.push(`status = $${params.length}`);
        }
        if (contentRating) {
          params.push(contentRating);
          where.push(`content_rating = $${params.length}`);
        }
        if (tag) {
          params.push(tag);
          where.push(`EXISTS (
        SELECT 1 FROM work_tags wt JOIN tags t ON t.id=wt.tag_id
        WHERE wt.work_id=works.id AND t.slug=$${params.length}
      )`);
        }

        params.push(limit);
        const limitIdx = params.length;
        params.push(offset);
        const offsetIdx = params.length;

        const buildSql = (searchExpr: string) => `SELECT ${WORK_SELECT_COLUMNS}, COUNT(*) OVER()::int AS total_count
    FROM works WHERE ${[...where.slice(0, 1), searchExpr, ...where.slice(1)].join(' AND ')}
    ORDER BY ${sortCol} ${sortAsc ? 'ASC' : 'DESC'}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}`;

        // 1. Try search_text first (fast indexed path)
        let res = await executeYugabyteSql<YugabyteWork & { total_count: number }>(
          buildSql(`search_text ILIKE $${qParamIdx}`),
          params,
          platformEnv
        );

        // 2. If 0 rows, fall back to alias and accent-insensitive scan
        if (res.rows.length === 0) {
          res = await executeYugabyteSql<YugabyteWork & { total_count: number }>(
            buildSql(`(
              title ILIKE $${qParamIdx} OR EXISTS (
                SELECT 1 FROM unnest(COALESCE(works.aliases, ARRAY[]::text[])) AS work_alias(alias_text)
                WHERE work_alias.alias_text ILIKE $${qParamIdx}
              ) OR translate(lower(COALESCE(works.search_text, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') LIKE translate(lower($${qParamIdx}), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')
            )`),
            params,
            platformEnv
          );
        }

        const total = res.rows.length > 0 ? Number(res.rows[0].total_count) : 0;
        return {
          works: res.rows.map(({ total_count: _t, ...w }: any) => w),
          total
        };
      }

      // Filtered without q (e.g. tag, kind, status)
      if (kind) {
        params.push(kind);
        where.push(`kind = $${params.length}`);
      }
      if (['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED'].includes(status)) {
        params.push(status);
        where.push(`status = $${params.length}`);
      }
      if (contentRating) {
        params.push(contentRating);
        where.push(`content_rating = $${params.length}`);
      }
      if (tag) {
        params.push(tag);
        where.push(`EXISTS (
        SELECT 1 FROM work_tags wt JOIN tags t ON t.id=wt.tag_id
        WHERE wt.work_id=works.id AND t.slug=$${params.length}
      )`);
      }
      params.push(limit);
      const limitIdx = params.length;
      params.push(offset);
      const offsetIdx = params.length;

      const res = await executeYugabyteSql<YugabyteWork & { total_count: number }>(
        `SELECT ${WORK_SELECT_COLUMNS}, COUNT(*) OVER()::int AS total_count
         FROM works
         WHERE ${where.join(' AND ')}
         ORDER BY ${sortCol} ${sortAsc ? 'ASC' : 'DESC'}
         LIMIT $${limitIdx} OFFSET $${offsetIdx};`,
        params,
        platformEnv
      );

      const total = res.rows.length > 0 ? Number(res.rows[0].total_count) : 0;
      return {
        works: res.rows.map(({ total_count: _t, ...w }: any) => w),
        total
      };
    },
    { works: [], total: 0 }
  );
}

/** Search the authoritative catalog, delegating to fetchCatalogFromYugabyte. */
export async function searchWorksFromYugabyte(
  search: string,
  options: YugabyteWorkSearchOptions,
  platformEnv?: any
): Promise<{ works: YugabyteWork[]; total: number }> {
  return fetchCatalogFromYugabyte({ ...options, q: search }, platformEnv);
}

/**
 * Fetch chapters for a given work from Yugabyte.
 */
export async function fetchWorkChaptersFromYugabyte(
  workId: string,
  preview = false,
  platformEnv?: any
): Promise<YugabyteChapter[]> {
  return withYugabyteLkg(
    `work_chapters_${workId}_${preview}`,
    async () => {
      const sql = preview
        ? `SELECT id, number, display_number, canonical_chapter_key, chapter_order_key, chapter_kind, edition, language,
                  title, published_at, views_total, work_id
             FROM chapters WHERE work_id = $1
             ORDER BY chapter_order_key DESC, canonical_chapter_key DESC, id DESC;`
        : `SELECT id, number, display_number, canonical_chapter_key, chapter_order_key, chapter_kind, edition, language,
                  title, published_at, views_total, work_id
             FROM chapters WHERE work_id = $1 AND published_at IS NOT NULL
             ORDER BY chapter_order_key DESC, canonical_chapter_key DESC, id DESC;`;

      const res = await executeYugabyteSql<YugabyteChapter>(sql, [workId], platformEnv);
      return res.rows;
    },
    []
  );
}

/**
 * Fetch the editorial taxonomy from the same authoritative data plane as the
 * work and its chapters. Tags must never silently fall back to the legacy
 * Supabase copy: imports persist work_tags in Yugabyte.
 */
export async function fetchWorkTagsFromYugabyte(
  workId: string,
  platformEnv?: any
): Promise<YugabyteTag[]> {
  return withYugabyteLkg(
    `work_tags_${workId}`,
    async () => {
      const sql = `
        SELECT t.id, t.name, t.slug, t.kind
        FROM work_tags wt
        INNER JOIN tags t ON t.id = wt.tag_id
        WHERE wt.work_id = $1
        ORDER BY t.kind ASC, t.name ASC;
      `;
      const res = await executeYugabyteSql<YugabyteTag>(sql, [workId], platformEnv);
      return res.rows;
    },
    []
  );
}

/**
 * Fetch media metadata for media delivery from Yugabyte.
 */
export async function fetchMediaMetadataFromYugabyte(
  mediaId: string,
  platformEnv?: any
): Promise<any | null> {
  return withYugabyteLkg(
    `media_${mediaId}`,
    async () => {
      const sql = `
        SELECT id, provider, provider_key, bot_reference, storage_shard_id,
               mime, sha256, bytes, width, height, access_class, purpose,
               storage_ready, status, created_by
        FROM media
        WHERE id = $1
        LIMIT 1;
      `;
      const res = await executeYugabyteSql(sql, [mediaId], platformEnv);
      return res.rows[0] || null;
    },
    null
  );
}
