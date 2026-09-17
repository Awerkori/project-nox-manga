const fs = require('fs');

const mockBlock = `vi.mock('$lib/server/db', async (importOriginal) => {
  const { drizzle } = await import('drizzle-orm/libsql');
  const { createClient } = await import('@libsql/client');
  const schema = await import('$lib/server/db/schema');
  
  const client = createClient({ url: 'file:test.db' });
  // For in-memory testing we ideally run push or migrate, but tests usually mock the output.
  // Instead of full db, we can just mock the specific queries.
  // Actually, providing a proxy schema is easier:
  const proxySchema = new Proxy({}, {
    get(target, prop) {
      if (schema[prop]) return schema[prop];
      return new Proxy({}, { get(t, p) { return p; } });
    }
  });

  return {
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({}),
      get: vi.fn().mockResolvedValue({}),
      all: vi.fn().mockResolvedValue([]),
    },
    schema: proxySchema,
    safeQuery: vi.fn().mockResolvedValue({ data: [], error: null }),
    safeQuerySingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    WORK_FIELDS: '*',
    check: (r) => { if (r.error) throw new Error('Database unavailable'); }
  };
});`;

const files = [
  'tests/member-pagination.test.ts',
  'tests/public-comments.test.ts',
  'tests/auth-flows.test.ts',
  'tests/public-content-parity.test.ts',
  'tests/media-streaming.test.ts',
  'tests/security.test.ts'
];

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  let code = fs.readFileSync(f, 'utf8');
  code = code.replace(/vi\.mock\('\$lib\/server\/db'[\s\S]*?\)\);/, mockBlock);
  fs.writeFileSync(f, code);
}
