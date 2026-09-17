import { vi } from 'vitest';
vi.mock('$env/dynamic/private', () => ({
  env: { TURSO_DB_URL: 'http://localhost:8080', TURSO_DB_TOKEN: 'mock' }
}));
