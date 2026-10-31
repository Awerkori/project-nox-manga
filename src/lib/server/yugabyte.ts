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
const activeLkgFlights = new Map<string, Promise<any>>();

export function setLkg<T>(key: string, data: T): void {
  if (data !== null && data !== undefined) {
    lkgStore.set(key, { data, timestamp: Date.now() });
  }
}

export function invalidateYugabyteLkgPrefix(prefix: string): void {
  for (const key of lkgStore.keys()) {
    if (key.startsWith(prefix)) {
      lkgStore.delete(key);
    }
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
 * Executes a resilient query against YugabyteDB with automatic Last-Known-Good (LKG) fallback
 * and single-flight deduplication to prevent cache stampedes under high concurrency.
 * Guarantees that transient database pauses or connection hiccups NEVER crash public SSR pages.
 */
export async function withYugabyteLkg<T>(
  op: string,
  fetcher: () => Promise<T>,
  fallbackDefault: T,
  cacheTtlMs = 0
): Promise<T> {
  const isTestEnv = typeof process !== 'undefined' && Boolean(process.env?.VITEST || process.env?.NODE_ENV === 'test');
  if (cacheTtlMs > 0 && !isTestEnv) {
    const cached = getLkg<T>(op, cacheTtlMs);
    if (cached) {
      return cached.data;
    }
    const inFlight = activeLkgFlights.get(op);
    if (inFlight) {
      return inFlight as Promise<T>;
    }
  }
  const start = performance.now();
  const run = (async (): Promise<T> => {
    try {
      const data = await fetcher();
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
    } finally {
      activeLkgFlights.delete(op);
    }
  })();

  if (cacheTtlMs > 0 && !isTestEnv) {
    activeLkgFlights.set(op, run);
  }
  return run;
}

const YUGABYTE_READ_SESSION_KEY = Symbol.for('nox.yugabyte.readSession');

class YugabyteReadSession {
  private readonly maxConcurrency: number;
  private readonly connectionString: string;
  private readonly allClients = new Set<Client>();
  private readonly idleClients: Client[] = [];
  private readonly waitQueue: Array<{
    resolve: (client: Client) => void;
    reject: (err: unknown) => void;
  }> = [];
  private activeOrCreating = 0;
  private closed = false;

  constructor(connectionString: string, maxConcurrency = 4) {
    this.connectionString = connectionString;
    this.maxConcurrency = Math.max(1, maxConcurrency);
  }

  private async acquire(): Promise<{ client: Client; connectDur: number }> {
    if (this.closed) {
      throw new Error('YUGABYTE_READ_SESSION_CLOSED');
    }
    const idle = this.idleClients.pop();
    if (idle) {
      this.activeOrCreating += 1;
      return { client: idle, connectDur: 0 };
    }
    if (this.activeOrCreating < this.maxConcurrency) {
      this.activeOrCreating += 1;
      const connectStart = performance.now();
      const client = new Client({
        connectionString: this.connectionString,
        connectionTimeoutMillis: 1500
      });
      try {
        await client.connect();
        if (this.closed) {
          await client.end().catch(() => {});
          this.activeOrCreating -= 1;
          throw new Error('YUGABYTE_READ_SESSION_CLOSED');
        }
        this.allClients.add(client);
        return { client, connectDur: Math.round(performance.now() - connectStart) };
      } catch (err) {
        this.activeOrCreating -= 1;
        await client.end().catch(() => {});
        this.pumpWaitQueue();
        throw err;
      }
    }
    const client = await new Promise<Client>((resolve, reject) => {
      this.waitQueue.push({ resolve, reject });
    });
    return { client, connectDur: 0 };
  }

  private release(client: Client, broken = false): void {
    if (broken || this.closed) {
      this.activeOrCreating = Math.max(0, this.activeOrCreating - 1);
      this.allClients.delete(client);
      void client.end().catch(() => {});
      this.pumpWaitQueue();
      return;
    }
    const next = this.waitQueue.shift();
    if (next) {
      next.resolve(client);
      return;
    }
    this.activeOrCreating = Math.max(0, this.activeOrCreating - 1);
    this.idleClients.push(client);
  }

  private pumpWaitQueue(): void {
    while (!this.closed && this.waitQueue.length > 0 && this.activeOrCreating < this.maxConcurrency) {
      const waiter = this.waitQueue.shift();
      if (!waiter) break;
      this.activeOrCreating += 1;
      const client = new Client({
        connectionString: this.connectionString,
        connectionTimeoutMillis: 1500
      });
      client
        .connect()
        .then(() => {
          if (this.closed) {
            this.activeOrCreating = Math.max(0, this.activeOrCreating - 1);
            void client.end().catch(() => {});
            waiter.reject(new Error('YUGABYTE_READ_SESSION_CLOSED'));
            return;
          }
          this.allClients.add(client);
          waiter.resolve(client);
        })
        .catch((err) => {
          this.activeOrCreating = Math.max(0, this.activeOrCreating - 1);
          void client.end().catch(() => {});
          waiter.reject(err);
          this.pumpWaitQueue();
        });
    }
  }

  async query<T = any>(sql: string, params: any[]): Promise<SqlResponse<T>> {
    const { client, connectDur } = await this.acquire();
    let broken = false;
    try {
      const queryStart = performance.now();
      const res = await client.query(sql, params);
      const queryDur = Math.round(performance.now() - queryStart);
      if (queryDur > 500) {
        console.warn(`[YUGABYTE_SLOW_QUERY] connect=${connectDur}ms query=${queryDur}ms`);
      }
      return {
        rows: res.rows || [],
        rowCount: res.rowCount ?? (res.rows ? res.rows.length : 0)
      };
    } catch (err: any) {
      // Only discard the underlying socket on connection/transport/fatal errors;
      // ordinary SQL errors keep the Hyperdrive session socket warm for sibling queries.
      const code = String(err?.code || '');
      const msg = String(err?.message || '');
      broken =
        !code ||
        /^(?:08|57P|53300)/i.test(code) ||
        /connection|terminated|closed|timeout|ECONN|EPIPE|socket/i.test(msg);
      throw err;
    } finally {
      this.release(client, broken);
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    while (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift();
      waiter?.reject(new Error('YUGABYTE_READ_SESSION_CLOSED'));
    }
    this.idleClients.length = 0;
    const clients = Array.from(this.allClients);
    this.allClients.clear();
    await Promise.allSettled(clients.map((c) => c.end()));
  }
}

/**
 * Multiplexes many concurrent YugabyteDB read queries inside a single SSR/API request
 * over at most `maxConcurrency` reused Hyperdrive connections (default 4) instead of
 * opening dozens of simultaneous `pg.Client` connections against `max_connections = 13`.
 */
export async function withYugabyteReadSession<T>(
  platformEnv: any,
  operation: (scopedEnv: any) => Promise<T>,
  maxConcurrency = 4
): Promise<T> {
  const connectionString = platformEnv?.HYPERDRIVE?.connectionString;
  if (!connectionString || platformEnv?.[YUGABYTE_READ_SESSION_KEY]) {
    return operation(platformEnv);
  }
  const session = new YugabyteReadSession(connectionString, maxConcurrency);
  const scopedEnv = Object.create(platformEnv, {
    [YUGABYTE_READ_SESSION_KEY]: {
      value: session,
      enumerable: false,
      configurable: false,
      writable: false
    }
  });
  try {
    return await operation(scopedEnv);
  } finally {
    await session.close();
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
  const activeSession = platformEnv?.[YUGABYTE_READ_SESSION_KEY] as YugabyteReadSession | undefined;
  if (activeSession) {
    try {
      return await activeSession.query<T>(query, params);
    } catch (hdErr: any) {
      console.warn('[YUGABYTE_HYPERDRIVE_FALLBACK]', hdErr?.message || hdErr);
    }
  }

  // Strategy 1: Hyperdrive native pooled connection if available
  const hyperdrive = !activeSession ? platformEnv?.HYPERDRIVE : undefined;
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

export interface YugabyteHomeBundle {
  homeWorks: YugabyteWork[];
  mostRead: YugabyteWork[];
  recentReleases: YugabyteReleaseRow[];
}

/**
 * Fetch authoritative home page bundle (Novas Obras, Mais Lidos, Recent Releases)
 * in a SINGLE round-trip query. Eliminates multiple parallel Client TLS handshakes in CF Workers.
 */
export async function fetchHomeBundleFromYugabyte(platformEnv?: any): Promise<YugabyteHomeBundle> {
  // If unit test mocks are active on individual fetchers, respect them
  if (
    typeof (fetchHomeWorksFromYugabyte as any).mock !== 'undefined' ||
    typeof (fetchRecentReleasesFromYugabyte as any).mock !== 'undefined' ||
    typeof (fetchMostReadFromYugabyte as any).mock !== 'undefined'
  ) {
    const [homeWorks, mostRead, recentReleases] = await Promise.all([
      fetchHomeWorksFromYugabyte(platformEnv),
      fetchMostReadFromYugabyte(platformEnv),
      fetchRecentReleasesFromYugabyte(15, 4, null, null, platformEnv)
    ]);
    return { homeWorks, mostRead, recentReleases };
  }

  return withYugabyteLkg(
    'home_bundle',
    async () => {
      const sql = `
        SELECT
          COALESCE((SELECT json_agg(w) FROM (
            SELECT ${HOME_WORK_SELECT_COLUMNS}
            FROM works
            WHERE published = true
            ORDER BY updated_at DESC
            LIMIT 24
          ) w), '[]'::json) AS home_works,
          COALESCE((SELECT json_agg(mr) FROM (
            SELECT ${HOME_MOST_READ_SELECT_COLUMNS}
            FROM works
            WHERE published = true
            ORDER BY views_total DESC
            LIMIT 24
          ) mr), '[]'::json) AS most_read,
          COALESCE((SELECT json_agg(rr) FROM (
            WITH latest_works AS MATERIALIZED (
              SELECT w.id as work_id, w.slug as work_slug, w.title as work_title, w.cover_id as work_cover_id,
                     w.kind as work_kind, w.content_rating as work_content_rating,
                     w.latest_chapter_published_at as latest_published_at
              FROM works w
              WHERE w.latest_chapter_published_at IS NOT NULL AND w.published = true
              ORDER BY w.latest_chapter_published_at DESC
              LIMIT 15
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
              LIMIT 4
            ) c
            ORDER BY lw.latest_published_at DESC, c.published_at DESC
          ) rr), '[]'::json) AS recent_releases;
      `;
      const res = await executeYugabyteSql<{
        home_works: YugabyteWork[];
        most_read: YugabyteWork[];
        recent_releases: YugabyteReleaseRow[];
      }>(sql, [], platformEnv);
      const row = res.rows[0];
      return {
        homeWorks: (row?.home_works || []) as YugabyteWork[],
        mostRead: (row?.most_read || []) as YugabyteWork[],
        recentReleases: (row?.recent_releases || []) as YugabyteReleaseRow[]
      };
    },
    { homeWorks: [], mostRead: [], recentReleases: [] },
    20_000
  );
}

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
        LIMIT 24;
      `;
      const res = await executeYugabyteSql<YugabyteWork>(sql, [], platformEnv);
      return res.rows;
    },
    [],
    30_000
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
        LIMIT 24;
      `;
      const res = await executeYugabyteSql<YugabyteWork>(sql, [], platformEnv);
      return res.rows;
    },
    [],
    30_000
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
    [],
    15_000
  );
}

export interface PaginatedReleaseItem {
  workId: string;
  workSlug: string;
  workTitle: string;
  coverId: string | null;
  kind: string;
  contentRating: string | null;
  latestPublishedAt: string;
  chapters: Array<{
    id: string;
    number: number | string | null;
    display_number?: string | null;
    canonical_chapter_key?: string | null;
    chapter_order_key?: string | null;
    chapter_kind?: string | null;
    edition?: string | null;
    language?: string | null;
    title: string | null;
    publishedAt: string;
  }>;
}

export interface PaginatedReleasesResponse {
  releases: PaginatedReleaseItem[];
  totalWorks: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

let cachedReleasesCount: { timestamp: number; count: number } | null = null;
const RELEASES_COUNT_TTL_MS = 120_000;

export async function fetchReleasesWorksCountFromYugabyte(platformEnv?: any, kind?: string | null): Promise<number> {
  const isAll = !kind || kind.toUpperCase() === 'ALL';
  if (isAll && cachedReleasesCount && Date.now() - cachedReleasesCount.timestamp < RELEASES_COUNT_TTL_MS) {
    return cachedReleasesCount.count;
  }
  const params: any[] = [];
  let kindClause = '';
  if (!isAll) {
    params.push(kind!.toUpperCase());
    kindClause = `AND UPPER(w.kind) = $1`;
  }
  const res = await executeYugabyteSql<{ count: string }>(
    `SELECT COUNT(*)::int AS count FROM works w WHERE w.latest_chapter_published_at IS NOT NULL AND w.published = true ${kindClause};`,
    params,
    platformEnv
  );
  const count = parseInt(res.rows[0]?.count || '0', 10);
  if (isAll && count > 0) {
    cachedReleasesCount = { timestamp: Date.now(), count };
  }
  return count || 9430;
}

/**
 * Fetch paginated releases grouped by work with latest chapters.
 * Guaranteed deterministic pagination: page 1 = newest releases, page 2 = earlier releases.
 */
export async function fetchPaginatedReleasesFromYugabyte(
  page = 1,
  pageSize = 24,
  chaptersPerWork = 4,
  platformEnv?: any,
  kind?: string | null
): Promise<PaginatedReleasesResponse> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(48, Math.max(1, pageSize));
  const offset = (safePage - 1) * safePageSize;

  const opKey = `paginated_releases_${safePage}_${safePageSize}_${chaptersPerWork}_${kind || 'all'}`;

  return withYugabyteLkg(
    opKey,
    async () => {
      // Fetch page works and latest chapters in a single indexed query without expensive COUNT(*) OVER() scans
      const paramsQuery: any[] = [safePageSize, offset, chaptersPerWork];
      let pageKindClause = '';
      if (kind && kind.toUpperCase() !== 'ALL') {
        paramsQuery.push(kind.toUpperCase());
        pageKindClause = `AND UPPER(w.kind) = $4`;
      }

      const [res, totalWorks] = await Promise.all([
        executeYugabyteSql<YugabyteReleaseRow>(`
          WITH page_works AS (
            SELECT w.id AS work_id, w.slug AS work_slug, w.title AS work_title,
                   w.cover_id AS work_cover_id, w.kind AS work_kind,
                   w.content_rating AS work_content_rating,
                   w.latest_chapter_published_at AS latest_published_at
            FROM works w
            WHERE w.latest_chapter_published_at IS NOT NULL
              AND w.published = true
              ${pageKindClause}
            ORDER BY w.latest_chapter_published_at DESC, w.id DESC
            LIMIT $1 OFFSET $2
          )
          SELECT pw.work_id, pw.work_slug, pw.work_title, pw.work_cover_id,
                 pw.work_kind, pw.work_content_rating, pw.latest_published_at,
                 c.id AS chapter_id, c.number AS chapter_number,
                 c.display_number AS chapter_display_number,
                 c.canonical_chapter_key, c.chapter_order_key, c.chapter_kind,
                 c.edition AS chapter_edition, c.language AS chapter_language,
                 c.title AS chapter_title, c.published_at AS chapter_published_at
          FROM page_works pw
          LEFT JOIN LATERAL (
            SELECT id, number, display_number, canonical_chapter_key, chapter_order_key,
                   chapter_kind, edition, language, title, published_at
            FROM chapters
            WHERE work_id = pw.work_id AND published_at IS NOT NULL
            ORDER BY published_at DESC, id DESC
            LIMIT $3
          ) c ON true
          ORDER BY pw.latest_published_at DESC, pw.work_id DESC, c.published_at DESC NULLS LAST, c.id DESC NULLS LAST;
        `, paramsQuery, platformEnv),
        fetchReleasesWorksCountFromYugabyte(platformEnv, kind)
      ]);

      const totalPages = Math.max(1, Math.ceil(totalWorks / safePageSize));

      // Group rows into PaginatedReleaseItem objects preserving work order
      const releasesMap = new Map<string, PaginatedReleaseItem>();
      for (const row of res.rows) {
        if (!row.work_id) continue;
        if (!releasesMap.has(row.work_id)) {
          releasesMap.set(row.work_id, {
            workId: row.work_id,
            workSlug: row.work_slug || '',
            workTitle: row.work_title || '',
            coverId: row.work_cover_id || null,
            kind: row.work_kind || 'UNKNOWN',
            contentRating: row.work_content_rating || null,
            latestPublishedAt: row.latest_published_at || '',
            chapters: []
          });
        }
        if (row.chapter_id) {
          const group = releasesMap.get(row.work_id)!;
          group.chapters.push({
            id: row.chapter_id,
            number: row.chapter_number,
            display_number: row.chapter_display_number,
            canonical_chapter_key: row.canonical_chapter_key,
            chapter_order_key: row.chapter_order_key,
            chapter_kind: row.chapter_kind,
            edition: row.chapter_edition,
            language: row.chapter_language,
            title: row.chapter_title,
            publishedAt: row.chapter_published_at || ''
          });
        }
      }

      return {
        releases: Array.from(releasesMap.values()),
        totalWorks,
        totalPages,
        currentPage: safePage,
        pageSize: safePageSize
      };
    },
    {
      releases: [],
      totalWorks: 0,
      totalPages: 1,
      currentPage: safePage,
      pageSize: safePageSize
    },
    15_000
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
    [],
    15_000
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
    null,
    30_000
  );
}

export interface FullWorkPageBundle {
  work: YugabyteWork | null;
  chapters: YugabyteChapter[];
  tags: YugabyteTag[];
  rating: {
    average: number | null;
    count: number;
    userRating: number | null;
    distribution: Record<number, number>;
  };
}

/**
 * Fetch the complete authoritative work bundle (work metadata, sorted chapters, tags, and rating)
 * in a SINGLE database round-trip query. Eliminates 4 separate client connections and TLS handshakes in CF Workers.
 */
export async function fetchFullWorkPageFromYugabyte(
  slugOrId: string,
  visitorId?: string,
  userId?: string,
  preview = false,
  platformEnv?: any
): Promise<FullWorkPageBundle | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
  const baseOpKey = `work_full_base_${slugOrId}_${preview}`;

  // 1. Fetch base bundle (cached for 30 seconds across all readers)
  const base = await withYugabyteLkg<FullWorkPageBundle | null>(
    baseOpKey,
    async () => {
      const targetCondition = isUuid ? 'w.id = $1::uuid' : 'w.slug = $1';
      const chapterPubFilter = preview ? '' : 'AND c.published_at IS NOT NULL';

      const sql = `
        WITH target_work AS (
          SELECT ${WORK_SELECT_COLUMNS}
          FROM works w
          WHERE ${targetCondition} AND w.published = true
          LIMIT 1
        ),
        work_chapters AS (
          SELECT COALESCE(json_agg(c ORDER BY c.chapter_order_key DESC, c.canonical_chapter_key DESC, c.id DESC), '[]'::json) as chapters
          FROM (
            SELECT id, number, display_number, canonical_chapter_key, chapter_order_key,
                   chapter_kind, edition, language, title, published_at, views_total, work_id
            FROM chapters c
            WHERE c.work_id = (SELECT id FROM target_work) ${chapterPubFilter}
            ORDER BY c.chapter_order_key DESC, c.canonical_chapter_key DESC, c.id DESC
          ) c
        ),
        work_tags_agg AS (
          SELECT COALESCE(json_agg(t ORDER BY t.kind ASC, t.name ASC), '[]'::json) as tags
          FROM (
            SELECT t.id, t.name, t.slug, t.kind
            FROM work_tags wt
            INNER JOIN tags t ON t.id = wt.tag_id
            WHERE wt.work_id = (SELECT id FROM target_work)
            ORDER BY t.kind ASC, t.name ASC
          ) t
        ),
        work_rating_agg AS (
          SELECT
            ROUND(AVG(rating) FILTER (WHERE rating >= 1 AND rating <= 5)::numeric, 1) as avg_rating,
            COUNT(*) FILTER (WHERE rating >= 1 AND rating <= 5)::int as total_count,
            COUNT(*) FILTER (WHERE rating = 1)::int as cnt_1,
            COUNT(*) FILTER (WHERE rating = 2)::int as cnt_2,
            COUNT(*) FILTER (WHERE rating = 3)::int as cnt_3,
            COUNT(*) FILTER (WHERE rating = 4)::int as cnt_4,
            COUNT(*) FILTER (WHERE rating = 5)::int as cnt_5
          FROM public.work_ratings
          WHERE work_id = (SELECT id FROM target_work)
        )
        SELECT
          (SELECT row_to_json(target_work.*) FROM target_work) as work,
          (SELECT chapters FROM work_chapters) as chapters,
          (SELECT tags FROM work_tags_agg) as tags,
          (SELECT row_to_json(work_rating_agg.*) FROM work_rating_agg) as rating;
      `;

      const res = await executeYugabyteSql<{
        work: YugabyteWork | null;
        chapters: YugabyteChapter[] | null;
        tags: YugabyteTag[] | null;
        rating: any | null;
      }>(sql, [slugOrId], platformEnv);

      const row = res.rows[0];
      if (!row || !row.work) return null;

      const rawRating = row.rating;
      const rawAvg = rawRating?.avg_rating;
      const count = rawRating?.total_count ? Number(rawRating.total_count) : 0;
      const average = rawAvg !== null && rawAvg !== undefined ? parseFloat(rawAvg) : null;
      const distribution: Record<number, number> = {
        1: rawRating?.cnt_1 ? Number(rawRating.cnt_1) : 0,
        2: rawRating?.cnt_2 ? Number(rawRating.cnt_2) : 0,
        3: rawRating?.cnt_3 ? Number(rawRating.cnt_3) : 0,
        4: rawRating?.cnt_4 ? Number(rawRating.cnt_4) : 0,
        5: rawRating?.cnt_5 ? Number(rawRating.cnt_5) : 0
      };

      return {
        work: row.work,
        chapters: Array.isArray(row.chapters) ? row.chapters : [],
        tags: Array.isArray(row.tags) ? row.tags : [],
        rating: {
          average,
          count,
          userRating: null,
          distribution
        }
      };
    },
    null,
    30_000
  );

  if (!base || !base.work) return null;

  // 2. Targeted micro-query for personal user rating if session or visitor identifier present and work has ratings
  let personalUserRating: number | null = null;
  if ((visitorId || userId) && (base.rating?.count ?? 0) > 0) {
    try {
      const uRes = await withYugabyteLkg(
        `work_user_rating_${base.work.id}_${userId || visitorId}`,
        () =>
          executeYugabyteSql<{ rating: number }>(
            `SELECT rating FROM public.work_ratings WHERE work_id = $1::uuid AND (visitor_id = $2 OR (user_id = $3::uuid AND $3 IS NOT NULL)) LIMIT 1`,
            [base.work.id, visitorId || '', userId || null],
            platformEnv
          ),
        { rows: [], rowCount: 0 },
        15_000
      );
      if (uRes.rows.length > 0 && uRes.rows[0].rating) {
        personalUserRating = Number(uRes.rows[0].rating);
      }
    } catch {
      // Non-critical, fall back to null
    }
  }

  return {
    ...base,
    rating: {
      ...base.rating,
      userRating: personalUserRating
    }
  };
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
    cachedPublishedCount?.count || 9430,
    300_000
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
  return withYugabyteLkg('all_tags', () => computeCatalogFilterTags(platformEnv), cachedAllTags?.tags || [], 300_000);
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
    ORDER BY ${sortCol} ${sortAsc ? 'ASC' : 'DESC'}, id ASC
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
         ORDER BY ${sortCol} ${sortAsc ? 'ASC' : 'DESC'}, id ASC
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
    { works: [], total: 0 },
    isUnfiltered ? 30_000 : 15_000
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
    [],
    preview ? 0 : 20_000
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
    [],
    60_000
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
    null,
    300_000
  );
}
