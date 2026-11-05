import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

describe('YSQL & Site Performance Lock invariants', () => {
  it('restores event.platform.env in hooks.server.ts and guards against closed YugabyteReadSession reuse', () => {
    const hooks = readRepoFile('src/hooks.server.ts');
    const yugabyte = readRepoFile('src/lib/server/yugabyte.ts');

    expect(hooks).toContain('const previousEnv = platform?.env;');
    expect(hooks).toContain('platform.env = previousEnv;');
    expect(yugabyte).toContain('YUGABYTE_BASE_ENV_KEY');
    expect(yugabyte).toContain('existingSession && !existingSession.isClosed()');
    expect(yugabyte).toContain("throw new Error('YUGABYTE_READ_SESSION_CLOSED')");
  });

  it('keeps two-stage materialized CTEs for catalog search fallback and tag filtering without scanning search_text in stage 2', () => {
    const yugabyte = readRepoFile('src/lib/server/yugabyte.ts');

    expect(yugabyte).toContain('const buildFallbackSql = (searchExpr: string) => `WITH matched AS MATERIALIZED');
    expect(yugabyte).toContain("concat_ws(' ', works.title, works.author, works.artist, array_to_string(COALESCE(works.aliases, ARRAY[]::text[]), ' '))");
    expect(yugabyte).not.toContain("translate(lower(COALESCE(works.search_text, ''))");
    expect(yugabyte).toContain('works.id = ANY(ARRAY(');
  });

  it('prevents redundant SQL round-trips on /obra/[slug], /ler/[id], and reading-history routes', () => {
    const obraServer = readRepoFile('src/routes/obra/[slug]/+page.server.ts');
    const lerServer = readRepoFile('src/routes/ler/[id]/+page.server.ts');
    const homeServer = readRepoFile('src/routes/+page.server.ts');
    const meServer = readRepoFile('src/routes/me/+page.server.ts');
    const memberServer = readRepoFile('src/routes/[area=member]/+page.server.ts');
    const profileServer = readRepoFile('src/routes/u/[username]/+page.server.ts');

    expect(obraServer).toContain('work.published === true ? Number(metrics?.likes ?? 0)');
    expect(lerServer).toContain('AND NOT EXISTS (SELECT 1 FROM cs)');
    expect(profileServer).toContain('COUNT(DISTINCT c.work_id) FILTER (WHERE r.completed_at IS NOT NULL) AS completed_works');

    for (const src of [homeServer, meServer, memberServer, profileServer]) {
      expect(src).toContain('AS chapter_catalog_id');
      expect(src).toContain('AS work_slug');
      expect(src).not.toContain('r.work_id');
    }
  });
});
