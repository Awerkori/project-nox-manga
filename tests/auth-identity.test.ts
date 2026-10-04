import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('src/routes/[auth=auth]/+page.svelte', 'utf8');
const server = readFileSync('src/routes/[auth=auth]/+page.server.ts', 'utf8');
const migration = readFileSync('yugabyte/migrations/20261004020000_auth_handles_ysql.sql', 'utf8');
const authMigration = readFileSync('supabase/migrations/20261004030000_auth_handle_strict.sql', 'utf8');

describe('Project Nox account identity', () => {
  it('requires @handle with a debounced availability hint', () => {
    expect(page).toContain('setTimeout(async () =>');
    expect(page).toContain('/api/auth/check-username?username=');
    expect(page).toContain('<span>@Handle</span>');
    expect(page).toContain('placeholder="@seuusuario"');
    expect(page).toContain('Obrigatório · 3–30 caracteres');
    expect(page).toContain('usernameStatus === \'available\'');
    expect(server).toContain("Informe um @handle para criar sua conta.");
    expect(server).toContain('username: rawUsername');
    expect(server).not.toContain('RESERVED_HANDLES.has(rawUsername)');
  });

  it('keeps the race-safe case-insensitive uniqueness constraint in YSQL', () => {
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS members_username_lower_unique');
    expect(migration).toContain('lower(username)');
    expect(migration).toContain('reserved_handles');
  });

  it('rejects duplicate or reserved handles in the auth trigger too', () => {
    expect(authMigration).toContain('AUTH_HANDLE_TAKEN');
    expect(authMigration).toContain('AUTH_HANDLE_RESERVED');
    expect(authMigration).toContain('members_username_lower_unique');
  });

  it('uses the canonical Worker origin for production auth callbacks', () => {
    expect(server).toContain('manga.project-nox-awerkori.workers.dev');
    expect(server).toContain('emailRedirectTo: `${redirectOrigin}/auth/confirm`');
    expect(server).not.toContain('projectnox.com');
  });
});
