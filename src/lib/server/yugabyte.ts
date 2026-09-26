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
  number: number | string;
  title: string | null;
  published_at: string | null;
  views_total: number;
  work_id?: string;
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
  chapter_number: number | string;
  chapter_title: string | null;
  chapter_published_at: string;
}

const WORK_SELECT_COLUMNS = `
  id, slug, title, aliases, synopsis, description, author, artist,
  kind, status, year, age_rating, published, featured, cover_id,
  updated_at, created_at, content_rating, views_total
`;

/**
 * Fetch top published works ordered by updated_at (Novas Obras).
 */
export async function fetchHomeWorksFromYugabyte(platformEnv?: any): Promise<YugabyteWork[]> {
  return withYugabyteLkg(
    'home_works',
    async () => {
      const sql = `
        SELECT ${WORK_SELECT_COLUMNS}
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
        SELECT ${WORK_SELECT_COLUMNS}
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
      // Direct CTE query that is 100% portable and fast on Yugabyte
      let cursorClause = '';
      let kindClause = '';
      const params: any[] = [limit, chaptersPerWork];
      if (cursorTime && cursorId) {
        params.push(cursorTime, cursorId);
        cursorClause = `AND (c.published_at, w.id) < ($${params.length - 1}, $${params.length})`;
      }
      if (kind && kind.toUpperCase() !== 'ALL') {
        params.push(kind.toUpperCase());
        kindClause = `AND UPPER(w.kind) = $${params.length}`;
      }

      const sql = `
        WITH latest_works AS (
          SELECT w.id as work_id, w.slug as work_slug, w.title as work_title, w.cover_id as work_cover_id,
                 w.kind as work_kind, w.content_rating as work_content_rating,
                 MAX(c.published_at) as latest_published_at
          FROM chapters c
          JOIN works w ON c.work_id = w.id
          WHERE c.published_at IS NOT NULL AND w.published = true
            ${kindClause}
            ${cursorClause}
          GROUP BY w.id, w.slug, w.title, w.cover_id, w.kind, w.content_rating
          ORDER BY latest_published_at DESC
          LIMIT $1
        ),
        ranked_chapters AS (
          SELECT lw.work_id, lw.work_slug, lw.work_title, lw.work_cover_id, lw.work_kind, lw.work_content_rating, lw.latest_published_at,
                 c.id as chapter_id, c.number as chapter_number, c.title as chapter_title, c.published_at as chapter_published_at,
                 ROW_NUMBER() OVER (PARTITION BY lw.work_id ORDER BY c.published_at DESC, c.number::numeric DESC) as rn
          FROM latest_works lw
          JOIN chapters c ON c.work_id = lw.work_id
          WHERE c.published_at IS NOT NULL
        )
        SELECT work_id, work_slug, work_title, work_cover_id, work_kind, work_content_rating, latest_published_at,
               chapter_id, chapter_number, chapter_title, chapter_published_at
        FROM ranked_chapters
        WHERE rn <= $2
        ORDER BY latest_published_at DESC, chapter_number::numeric DESC;
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
        ? `SELECT id, number, title, published_at, views_total, work_id FROM chapters WHERE work_id = $1 ORDER BY number::numeric DESC;`
        : `SELECT id, number, title, published_at, views_total, work_id FROM chapters WHERE work_id = $1 AND published_at IS NOT NULL ORDER BY number::numeric DESC;`;

      const res = await executeYugabyteSql<YugabyteChapter>(sql, [workId], platformEnv);
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
               mime, sha256, access_class, purpose, storage_ready, status, created_by
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
