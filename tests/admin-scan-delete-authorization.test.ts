import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('global Scan deletion authorization contract', () => {
  const action = source('src/routes/admin/scans/+page.server.ts');
  const migration = source('supabase/migrations/20260915190000_guard_official_scan_hard_delete.sql');

  it('rejects non-global-admin actions before reading the destructive payload or calling the DB transaction', () => {
    const guard = "if (locals.role !== 'ADMIN') return fail(403, { message: 'Acesso negado. Apenas ADMIN global.' });";
    const actionStart = action.indexOf('hardDelete: async');
    const guardOffset = action.indexOf(guard, actionStart);
    const dbOffset = action.indexOf("withYugabyteTransaction", actionStart);

    expect(actionStart).toBeGreaterThanOrEqual(0);
    expect(guardOffset).toBeGreaterThan(actionStart);
    expect(dbOffset).toBeGreaterThan(guardOffset);
  });

  it('enforces the official-scan guard inside the database function', () => {
    expect(migration).toContain('v_scan_is_official boolean;');
    expect(migration).toMatch(/SELECT name, is_official[\s\S]*INTO v_scan_name, v_scan_is_official/);
    expect(migration).toMatch(/IF v_scan_is_official THEN[\s\S]*A scan oficial Project Nox não pode ser removida\./);
  });

  it('keeps exact-name confirmation before any destructive delete', () => {
    const confirmation = migration.indexOf('IF trim(p_confirmation) IS NULL');
    const firstDelete = migration.indexOf('DELETE FROM public.chapter_scans');

    expect(confirmation).toBeGreaterThanOrEqual(0);
    expect(firstDelete).toBeGreaterThan(confirmation);
  });

  it('keeps published content preservation explicit', () => {
    expect(migration).toContain('DELETE FROM public.chapter_scans WHERE scan_id = p_scan_id;');
    expect(migration).toContain('DELETE FROM public.work_scans WHERE scan_id = p_scan_id;');
    expect(migration).not.toMatch(/DELETE FROM public\.(works|chapters)\b/);
  });
});
