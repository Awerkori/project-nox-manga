import { db } from './index';
import * as schema from './schema';
import { eq, and, or, inArray, desc, asc, sql } from 'drizzle-orm';

// A dynamic wrapper that implements Supabase's PostgREST interface on top of Drizzle
export function createPostgrestWrapper(userId?: string, role?: string) {
  const isStaff = ['STAFF_SITE', 'ADMIN', 'EDITOR'].includes(role || '');

  return {
    from: (tableName: string) => {
      const table = (schema as any)[
        tableName.replace(/_([a-z])/g, (g) => g[1].toUpperCase())
      ];
      if (!table) throw new Error(`Table ${tableName} not found in Drizzle schema`);

      let queryType: 'select' | 'insert' | 'update' | 'delete' = 'select';
      let selectedCols: any = undefined;
      let wheres: any[] = [];
      let orderByCol: string | null = null;
      let orderAsc = true;
      let limitNum: number | null = null;
      let values: any = null;

      // Automatic RLS
      if (!isStaff && table.userId && userId) {// Enforce userId = current user
        wheres.push(eq(table.userId, userId));}

      const applyEq = (colName: string, val: any) => {
        const camelCol = colName.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        if (table[camelCol]) wheres.push(eq(table[camelCol], val));
        else if (table[colName]) wheres.push(eq(table[colName], val));
      };

      const chain = {
        select: (cols?: string) => { queryType = 'select'; selectedCols = cols; return chain; },
        insert: (vals: any) => { queryType = 'insert'; values = vals; return chain; },
        update: (vals: any) => { queryType = 'update'; values = vals; return chain; },
        delete: () => { queryType = 'delete'; return chain; },
        eq: (col: string, val: any) => { applyEq(col, val); return chain; },
        not: (col: string, op: string, val: any) => { /* TODO */ return chain; },
        in: (col: string, arr: any[]) => {
          const camelCol = col.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
          if (table[camelCol]) wheres.push(inArray(table[camelCol], arr));
          return chain;
        },
        order: (col: string, opts: { ascending?: boolean } = {}) => {
          orderByCol = col.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
          orderAsc = opts.ascending ?? true;
          return chain;
        },
        limit: (n: number) => { limitNum = n; return chain; },
        
        async maybeSingle() {
          limitNum = 1;
          const { data, error } = await this.execute();
          return { data: data && data.length > 0 ? data[0] : null, error };
        },
        async single() {
          limitNum = 1;
          const { data, error } = await this.execute();
          return { data: data && data.length > 0 ? data[0] : null, error };
        },
        async execute() {
          try {
            let conditions = wheres.length > 1 ? and(...wheres) : wheres[0];
            if (queryType === 'select') {
              let q = db.select().from(table);
              if (conditions) q = q.where(conditions) as any;
              if (orderByCol && table[orderByCol]) {
                 q = q.orderBy(orderAsc ? asc(table[orderByCol]) : desc(table[orderByCol])) as any;
              }
              if (limitNum) q = q.limit(limitNum) as any;
              const res = await q;
              return { data: res, error: null };
            } else if (queryType === 'update') {
               let q = db.update(table).set(values);
               if (conditions) q = q.where(conditions) as any;
               await q;
               return { data: null, error: null };
            } else if (queryType === 'delete') {
               let q = db.delete(table);
               if (conditions) q = q.where(conditions) as any;
               await q;
               return { data: null, error: null };
            } else if (queryType === 'insert') {
               await db.insert(table).values(values);
               return { data: null, error: null };
            }
          } catch(e) {
            return { data: null, error: e };
          }
        }
      };

      // Ensure chain is thenable like Supabase queries
      (chain as any).then = (resolve: any, reject: any) => {
        chain.execute().then(resolve).catch(reject);
      };

      return chain;
    }
  };
}
