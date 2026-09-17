const fs = require('fs');

const mockBlock = `vi.mock('$lib/server/db', () => {
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
    schema: {},
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
  // replace the old mock
  code = code.replace(/vi\.mock\('\$lib\/server\/db'[\s\S]*?\)\);/, mockBlock);
  fs.writeFileSync(f, code);
}
