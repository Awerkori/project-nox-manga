import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
it('counts all blocked jobs by source beyond the API row limit', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE importer_queue(source text,status text,updated_at timestamptz);
      INSERT INTO importer_queue SELECT 'source_a','BLOCKED_BY_UPSTREAM',now() FROM generate_series(1,1005);
      INSERT INTO importer_queue VALUES('source_b','BLOCKED_BY_UPSTREAM',now()),('source_b','COMPLETED',now());`);
    await db.exec(readFileSync(new URL('../supabase/migrations/20260914164500_admin_queue_source_counts.sql', import.meta.url), 'utf8'));
    const { rows } = await db.query('SELECT admin_importer_queue_counts() AS counts');
    expect(rows[0].counts).toMatchObject({ blocked: 1006, blockedBySource: { source_a: 1005, source_b: 1 }, completed: 1, queued: 0 });
  } finally { await db.close(); }
}, 15000);
