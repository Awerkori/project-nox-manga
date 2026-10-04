import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('admin panel polish regressions', () => {
  const scansPage = source('src/routes/admin/scans/+page.svelte');
  const scansServer = source('src/routes/admin/scans/+page.server.ts');
  const adminLayout = source('src/routes/admin/+layout.svelte');
  const importerPage = source('src/routes/admin/importer/+page.svelte');

  it('keeps every Scan card action in an adaptive grid instead of clipping a single row', () => {
    expect(scansPage).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(scansPage).toContain('flex: 1 1 100%');
    expect(scansPage).toContain('<span>Editar</span>');
    expect(scansPage).toContain('<span>Excluir</span>');
  });

  it('renders definitive delete only for non-official Scans and keeps the server ADMIN guard', () => {
    expect(scansPage).toMatch(/\{#if !scan\.is_official\}[\s\S]*?hardDeleteModalScan = scan/);
    expect(scansServer).toMatch(/hardDelete:[\s\S]*?locals\.role !== 'ADMIN'/);
    expect(scansServer).toContain('withYugabyteTransaction');
    expect(scansServer).toContain('platform?.env');
    expect(scansServer).not.toContain("rpc('global_admin_hard_delete_scan'");
    expect(scansServer).toContain('SCAN_CONFIRMATION_INVALID');
    expect(scansServer).toContain('public_content_preserved');
  });

  it('creates Scans in the same YSQL transaction used by deletion', () => {
    expect(scansServer).toMatch(/createScan:[\s\S]*?withYugabyteTransaction/);
    expect(scansServer).toMatch(/createScan:[\s\S]*?INSERT INTO public\.scans/);
    expect(scansServer).toMatch(/createScan:[\s\S]*?INSERT INTO public\.scan_members/);
    expect(scansServer).toMatch(/createScan:[\s\S]*?SCAN_SLUG_EXISTS/);
    expect(scansPage).toContain("fetch('/admin/scans?/createScan'");
    expect(scansPage).toMatch(/if \(!editingScan\)[\s\S]*?createScan[\s\S]*?else \{[\s\S]*?action\('editor', 'scan'/);
  });

  it('uses the canonical avatar renderer and persisted crop in admin chrome', () => {
    expect(adminLayout).toContain("import UserAvatar from '$lib/components/UserAvatar.svelte'");
    expect(adminLayout).toContain('crop={data.profile?.avatar_crop}');
    expect(scansPage).toContain('crop={scan.owner.avatar_crop}');
    expect(scansPage).toContain('delete-impact-list');
  });

  it('switches importer tabs through shallow history rather than route navigation', () => {
    expect(importerPage).toContain("import { pushState } from '$app/navigation'");
    expect(importerPage).toContain('pushState(`${url.pathname}${url.search}`, page.state)');
    expect(importerPage).toContain("<button type=\"button\" class=\"importer-tab-link\"");
    expect(importerPage).not.toContain('href="/admin/importer?tab=fontes" class="importer-tab-link"');
  });
});
