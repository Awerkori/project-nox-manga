import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ids = {
  scan: '70000000-0000-4000-8000-000000000001',
  member: '70000000-0000-4000-8000-000000000002',
  inactive: '70000000-0000-4000-8000-000000000003'
};

describe('scan workspace membership YSQL read', () => {
  it('returns every scan membership for the authenticated member', async () => {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE public.scans (
        id uuid PRIMARY KEY, name text NOT NULL, status text NOT NULL,
        is_official boolean NOT NULL DEFAULT false
      );
      CREATE TABLE public.scan_members (
        scan_id uuid NOT NULL, user_id uuid NOT NULL, role text NOT NULL,
        PRIMARY KEY (scan_id, user_id)
      );
      INSERT INTO public.scans (id, name, status, is_official) VALUES
        ('${ids.scan}', 'QA Scan', 'ACTIVE', true),
        ('${ids.inactive}', 'Archived Scan', 'ARCHIVED', false);
      INSERT INTO public.scan_members (scan_id, user_id, role) VALUES
        ('${ids.scan}', '${ids.member}', 'OWNER'),
        ('${ids.inactive}', '${ids.member}', 'MEMBER');
    `);

    const result = await db.query<any>(`
      SELECT scan_member.role, scan_member.scan_id, to_jsonb(scan) AS scans
      FROM public.scan_members scan_member
      JOIN public.scans scan ON scan.id = scan_member.scan_id
      WHERE scan_member.user_id = $1
      ORDER BY scan.is_official DESC, scan.name ASC
    `, [ids.member]);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ role: 'OWNER', scan_id: ids.scan });
    expect(result.rows[0].scans).toMatchObject({ id: ids.scan, name: 'QA Scan' });
  });

  it('keeps a bounded legacy fallback instead of making PostgREST the primary read', () => {
    const workspace = readFileSync(resolve('src/routes/scan/+page.server.ts'), 'utf8');
    expect(workspace).toContain("'scan_member_rows_ysql'");
    expect(workspace).toContain("'scan_member_rows_legacy_fallback'");
    expect(workspace).toContain('FROM public.scan_members scan_member');
    expect(workspace).toContain('ORDER BY scan.is_official DESC, scan.name ASC');
  });
});
