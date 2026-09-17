const fs = require('fs');

const mockBlock = `vi.mock('$lib/server/db', async (importOriginal) => {
  const proxySchema = new Proxy({}, {
    get(target, prop) { return new Proxy({}, { get(t, p) { return p; } }); }
  });

  const chain = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.offset = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.rightJoin = vi.fn(() => chain);
  chain.fullJoin = vi.fn(() => chain);
  chain.groupBy = vi.fn(() => chain);
  chain.having = vi.fn(() => chain);
  chain.execute = vi.fn().mockResolvedValue({});
  chain.get = vi.fn().mockResolvedValue({});
  chain.all = vi.fn().mockResolvedValue([]);

  return {
    db: chain,
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
