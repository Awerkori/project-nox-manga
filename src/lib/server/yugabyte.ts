import { Client } from 'pg';

export interface SqlResponse<T = any> {
  rows: T[];
  rowCount: number;
}

const DEFAULT_GATEWAY_URL = 'https://project-nox-importer-gateway.project-nox-awerkori.workers.dev';
const DEFAULT_GATEWAY_TOKEN = '97c17bd54b085c5cace7f415f31644baa3f935018b7ad8568f1947eddf6cf50cae2d64bc71507bf3901d3db808b4cecb9819870457482f638f242087624d9959';

/**
 * Execute raw SQL query against authoritative YugabyteDB.
 * Strategy:
 * 1. Hyperdrive native connection via platform.env.HYPERDRIVE (sub-millisecond connection in worker)
 * 2. High-speed internal Cloudflare Worker Gateway fallback
 */
export async function executeYugabyteSql<T = any>(
  query: string,
  params: any[] = [],
  platformEnv?: any
): Promise<SqlResponse<T>> {
  // Strategy 1: Hyperdrive native pooled connection if available
  const hyperdrive = platformEnv?.HYPERDRIVE;
  if (hyperdrive?.connectionString) {
    try {
      const client = new Client({
        connectionString: hyperdrive.connectionString,
        connectionTimeoutMillis: 3500
      });
      await client.connect();
      try {
        const res = await client.query(query, params);
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

  // Strategy 2: Internal Cloudflare Worker Gateway fallback
  const gatewayUrl = platformEnv?.NOX_IMPORTER_GATEWAY_URL || DEFAULT_GATEWAY_URL;
  const token = platformEnv?.NOX_STORAGE_BRIDGE_TOKEN || DEFAULT_GATEWAY_TOKEN;

  const res = await fetch(`${gatewayUrl}/api/internal/importer/sql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, params })
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
}

export interface PostgrestResponse<T = any> {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number | null;
  status?: number;
}

export class YugabyteQueryBuilder<T = any> implements PromiseLike<PostgrestResponse<T>> {
  private table: string;
  private selectedCols: string = '*';
  private filters: Array<{ col: string; op: string; val: any }> = [];
  private orderCol: string | null = null;
  private orderAsc: boolean = true;
  private limitCount: number | null = null;
  private isSingle: boolean = false;
  private isMaybeSingle: boolean = false;
  private platformEnv?: any;

  constructor(table: string, platformEnv?: any) {
    this.table = table;
    this.platformEnv = platformEnv;
  }

  select(columns: string = '*'): this {
    this.selectedCols = columns;
    return this;
  }

  eq(col: string, val: any): this {
    this.filters.push({ col, op: '=', val });
    return this;
  }

  neq(col: string, val: any): this {
    this.filters.push({ col, op: '!=', val });
    return this;
  }

  gt(col: string, val: any): this {
    this.filters.push({ col, op: '>', val });
    return this;
  }

  gte(col: string, val: any): this {
    this.filters.push({ col, op: '>=', val });
    return this;
  }

  lt(col: string, val: any): this {
    this.filters.push({ col, op: '<', val });
    return this;
  }

  lte(col: string, val: any): this {
    this.filters.push({ col, op: '<=', val });
    return this;
  }

  in(col: string, vals: any[]): this {
    this.filters.push({ col, op: 'IN', val: vals });
    return this;
  }

  is(col: string, val: any): this {
    this.filters.push({ col, op: val === null ? 'IS NULL' : 'IS NOT NULL', val });
    return this;
  }

  ilike(col: string, pattern: string): this {
    this.filters.push({ col, op: 'ILIKE', val: pattern });
    return this;
  }

  like(col: string, pattern: string): this {
    this.filters.push({ col, op: 'LIKE', val: pattern });
    return this;
  }

  not(col: string, op: string, val: any): this {
    if (op === 'is' && val === null) {
      this.filters.push({ col, op: 'IS NOT NULL', val });
    } else if (op === 'in') {
      this.filters.push({ col, op: 'NOT IN', val });
    } else {
      this.filters.push({ col, op: '!=', val });
    }
    return this;
  }

  order(col: string, options?: { ascending?: boolean }): this {
    this.orderCol = col;
    this.orderAsc = options?.ascending ?? true;
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  single(): this {
    this.isSingle = true;
    this.limitCount = 1;
    return this;
  }

  maybeSingle(): this {
    this.isMaybeSingle = true;
    this.limitCount = 1;
    return this;
  }

  private cleanSelectedColumns(): { cols: string; hasWorkScans: boolean; hasChapterScans: boolean } {
    const raw = this.selectedCols.trim();
    if (raw === '*') return { cols: '*', hasWorkScans: false, hasChapterScans: false };

    const hasWorkScans = raw.includes('work_scans');
    const hasChapterScans = raw.includes('chapter_scans');

    // Balance-aware parenthesis stripper for PostgREST nested relations
    let result = '';
    let depth = 0;
    let inRelation = false;

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '(') {
        depth++;
      } else if (ch === ')') {
        depth--;
        if (depth === 0 && inRelation) {
          inRelation = false;
          continue;
        }
      } else if (depth === 0) {
        const rest = raw.slice(i);
        if (
          rest.startsWith('work_scans') ||
          rest.startsWith('chapter_scans') ||
          rest.startsWith('scans') ||
          rest.startsWith('tags') ||
          rest.startsWith('members!')
        ) {
          inRelation = true;
          continue;
        }
      }
      if (!inRelation && depth === 0) {
        result += ch;
      }
    }

    const cleaned = result
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
      .filter((c) => !['work_scans', 'chapter_scans', 'scans', 'tags'].includes(c))
      .join(', ');

    return { cols: cleaned || '*', hasWorkScans, hasChapterScans };
  }

  async execute(): Promise<PostgrestResponse<T>> {
    try {
      // Special PostgREST join mapping: work_tags -> tags
      if (this.table === 'work_tags' && this.selectedCols.includes('tags(')) {
        const workIdFilter = this.filters.find((f) => f.col === 'work_id');
        if (workIdFilter) {
          const sql = `
            SELECT json_build_object('id', t.id, 'name', t.name, 'slug', t.slug, 'kind', t.kind) as tags
            FROM work_tags wt
            JOIN tags t ON t.id = wt.tag_id
            WHERE wt.work_id = $1
          `;
          const res = await executeYugabyteSql(sql, [workIdFilter.val], this.platformEnv);
          return { data: res.rows as any, error: null, count: res.rows.length, status: 200 };
        }
      }

      // Special PostgREST join mapping: reading -> chapters -> works
      if (this.table === 'reading' && this.selectedCols.includes('chapters!inner')) {
        let sql = `
          SELECT r.chapter_id, r.page, r.max_page, r.completed_at, r.updated_at,
                 json_build_object(
                   'id', c.id, 'number', c.number, 'work_id', c.work_id, 'published_at', c.published_at,
                   'works', json_build_object('id', w.id, 'slug', w.slug, 'title', w.title, 'cover_id', w.cover_id, 'published', w.published, 'content_rating', w.content_rating)
                 ) as chapters
          FROM reading r
          JOIN chapters c ON c.id = r.chapter_id
          JOIN works w ON w.id = c.work_id
          WHERE c.published_at IS NOT NULL AND w.published = true
        `;
        const userFilter = this.filters.find((f) => f.col === 'user_id');
        const params: any[] = [];
        if (userFilter) {
          sql += ` AND r.user_id = $1`;
          params.push(userFilter.val);
        }
        if (this.orderCol) {
          sql += ` ORDER BY r."${this.orderCol}" ${this.orderAsc ? 'ASC' : 'DESC'}`;
        }
        if (this.limitCount !== null) {
          sql += ` LIMIT ${this.limitCount}`;
        }
        const res = await executeYugabyteSql(sql, params, this.platformEnv);
        for (const row of res.rows) {
          if (row.chapters?.number) {
            row.chapters.number = parseFloat(row.chapters.number);
          }
        }
        return { data: res.rows as any, error: null, count: res.rows.length, status: 200 };
      }

      const { cols, hasWorkScans, hasChapterScans } = this.cleanSelectedColumns();
      const params: any[] = [];
      let pIdx = 1;
      const clauses: string[] = [];

      for (const f of this.filters) {
        const colRef = `"${f.col}"`;
        if (f.op === 'IS NULL' || f.op === 'IS NOT NULL') {
          clauses.push(`${colRef} ${f.op}`);
        } else if (f.op === 'IN') {
          if (Array.isArray(f.val) && f.val.length === 0) {
            clauses.push('FALSE');
          } else {
            params.push(f.val);
            clauses.push(`${colRef} = ANY($${pIdx++})`);
          }
        } else if (f.op === 'NOT IN') {
          if (Array.isArray(f.val) && f.val.length === 0) {
            clauses.push('TRUE');
          } else {
            params.push(f.val);
            clauses.push(`NOT (${colRef} = ANY($${pIdx++}))`);
          }
        } else {
          params.push(f.val);
          clauses.push(`${colRef} ${f.op} $${pIdx++}`);
        }
      }

      let sql = `SELECT ${cols} FROM "${this.table}"`;
      if (clauses.length > 0) {
        sql += ` WHERE ${clauses.join(' AND ')}`;
      }
      if (this.orderCol) {
        sql += ` ORDER BY "${this.orderCol}" ${this.orderAsc ? 'ASC' : 'DESC'}`;
      }
      if (this.limitCount !== null) {
        sql += ` LIMIT ${this.limitCount}`;
      }

      const res = await executeYugabyteSql(sql, params, this.platformEnv);
      const rows = res.rows;

      // Post-process rows for semantic parity
      for (const row of rows) {
        // Parse numeric chapter number to float for clean display (e.g. 1012 instead of '1012.00')
        if (row.number !== undefined && row.number !== null) {
          row.number = parseFloat(row.number);
        }
        if (row.views_total !== undefined && row.views_total !== null) {
          row.views_total = Number(row.views_total);
        }
        if (hasWorkScans) {
          row.work_scans = [];
        }
        if (hasChapterScans) {
          row.chapter_scans = [];
        }
      }

      if (this.isSingle) {
        if (rows.length === 0) {
          return { data: null, error: { message: 'Row not found' }, count: 0, status: 404 };
        }
        return { data: rows[0] as any, error: null, count: 1, status: 200 };
      }

      if (this.isMaybeSingle) {
        return { data: (rows[0] ?? null) as any, error: null, count: rows.length, status: 200 };
      }

      return { data: rows as any, error: null, count: rows.length, status: 200 };
    } catch (err: any) {
      return { data: null, error: { message: err?.message || 'Database query error' }, status: 500 };
    }
  }

  then<TResult1 = PostgrestResponse<T>, TResult2 = never>(
    onfulfilled?: ((value: PostgrestResponse<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

/**
 * Authoritative Yugabyte client exposing PostgREST-like from() and rpc() APIs.
 */
export function createYugabyteClient(platformEnv?: any) {
  return {
    from<T = any>(table: string): YugabyteQueryBuilder<T> {
      return new YugabyteQueryBuilder<T>(table, platformEnv);
    },

    async rpc<T = any>(fn: string, args: Record<string, any> = {}): Promise<PostgrestResponse<T>> {
      try {
        if (fn === 'get_recent_releases') {
          const limit = args.p_limit ?? 16;
          const chaptersPerWork = args.p_chapters_per_work ?? 3;
          const cursorTime = args.p_cursor_time ?? null;
          const cursorId = args.p_cursor_id ?? null;
          const kind = args.p_kind ?? null;

          const sql = `
            SELECT * FROM public.get_recent_releases(
              p_limit := $1,
              p_chapters_per_work := $2,
              p_cursor_time := $3,
              p_cursor_id := $4,
              p_kind := $5
            )
          `;
          const res = await executeYugabyteSql(sql, [limit, chaptersPerWork, cursorTime, cursorId, kind], platformEnv);
          const rows = res.rows.map((r: any) => ({
            ...r,
            chapter_number: r.chapter_number !== null ? parseFloat(r.chapter_number) : null
          }));
          return { data: rows as any, error: null, count: rows.length, status: 200 };
        }

        // Generic RPC invocation
        const paramKeys = Object.keys(args);
        const placeholders = paramKeys.map((k, i) => `${k} := $${i + 1}`).join(', ');
        const sql = `SELECT * FROM public."${fn}"(${placeholders})`;
        const params = paramKeys.map((k) => args[k]);
        const res = await executeYugabyteSql(sql, params, platformEnv);
        return { data: res.rows as any, error: null, count: res.rowCount, status: 200 };
      } catch (err: any) {
        return { data: null, error: { message: err?.message || `RPC ${fn} failed` }, status: 500 };
      }
    }
  };
}
