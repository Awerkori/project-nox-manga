import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Scan chat read-state YSQL migration', () => {
  it('creates the relation used by the YSQL chat load/action', () => {
    const migration = fs.readFileSync(
      path.resolve('yugabyte/migrations/20261003050000_scan_channel_read_states_ysql.sql'),
      'utf8'
    );
    const source = fs.readFileSync(path.resolve('src/routes/scan/+page.server.ts'), 'utf8');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.scan_channel_read_states');
    expect(migration).toContain('UNIQUE (channel_id, user_id)');
    expect(source).toContain('FROM public.scan_channel_read_states');
    expect(source).toContain('INSERT INTO public.scan_channel_read_states');
  });
});
