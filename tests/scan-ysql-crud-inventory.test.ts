import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Scan YSQL CRUD inventory', () => {
  it('has no PostgREST database client in Scan workspace/API handlers', () => {
    const roots = [
      resolve('src/routes/scan/+page.server.ts'),
      resolve('src/routes/api/scan'),
      resolve('src/routes/scans')
    ];
    const files: string[] = [];
    const walk = (path: string) => {
      const stat = statSync(path);
      if (stat.isDirectory()) {
        for (const entry of readdirSync(path)) walk(resolve(path, entry));
      } else if (path.endsWith('.ts')) files.push(path);
    };
    for (const root of roots) walk(root);
    const source = files.map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(source).not.toMatch(/locals\.db\s*\.|\.rpc\(/);
    expect(source).not.toMatch(/from ['"]\$lib\/server\/db['"]/);
  });

  it('ships the authoritative YSQL production CRUD functions', () => {
    const migration = readFileSync(resolve('yugabyte/migrations/20261003020000_scan_production_crud_ysql.sql'), 'utf8');
    for (const name of [
      'create_scan_production_chapter_ysql',
      'bulk_create_scan_production_chapters_ysql',
      'publish_scan_production_chapter_ysql',
      'unpublish_scan_production_chapter_ysql',
      'delete_scan_production_chapter_ysql',
      'mark_pipeline_stage_seen_ysql'
    ]) expect(migration).toContain(`FUNCTION public.${name}`);

    const notifications = readFileSync(resolve('yugabyte/migrations/20261003030000_scan_notifications_mentions_ysql.sql'), 'utf8');
    for (const name of [
      'create_scan_notification_ysql',
      'claim_scan_email_outbox_ysql',
      'claim_uncertain_scan_email_outbox_ysql'
    ]) expect(notifications).toContain(`FUNCTION public.${name}`);
  });

  it('keeps Scan notifications and mentions on YSQL', () => {
    const sources = [
      readFileSync(resolve('src/lib/server/scan-notifications.ts'), 'utf8'),
      readFileSync(resolve('src/lib/server/scan-mentions.ts'), 'utf8')
    ].join('\n');
    expect(sources).not.toMatch(/\b(?:locals|db|client|privileged)\.from\s*\(/);
    expect(sources).not.toMatch(/\.rpc\s*\(/);
    expect(sources).not.toMatch(/createClient\s*\(/);
    expect(sources).toContain('executeYugabyteSql');
  });

  it('does not route Scan server actions through the legacy DB client', () => {
    const files = [
      resolve('src/routes/scan/+page.server.ts'),
      resolve('src/routes/scans/[slug]/+page.server.ts')
    ];
    const source = files.map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(source).not.toMatch(/from ['"]\$lib\/server\/mentions['"]/);
    expect(source).not.toMatch(/\.rpc\s*\(/);
    expect(source).not.toMatch(/\b(?:locals|db|client|privileged)\.from\s*\(/);
  });

  it('documents the only non-database realtime/storage boundary', () => {
    const source = readFileSync(resolve('src/routes/api/scan/production/upload/+server.ts'), 'utf8');
    // Artifact bytes may remain in the existing private storage provider; the
    // authoritative file metadata and authorization are YSQL above it.
    expect(source).toContain('scan-artifacts');
    expect(source).toContain('executeYugabyteSql');
  });
});
