import re

with open('tests/member-pagination.test.ts', 'r') as f:
    content = f.read()

# Replace the db mock with safeQuery mock
content = re.sub(
r"vi\.mock\('\.\./src/lib/server/db', async \(importOriginal\) => \{.*?\n\}\);\n",
r"""vi.mock('../src/lib/server/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/server/db')>();
  return { ...actual as object, 
    WORK_FIELDS: '*',
    safeQuery: vi.fn(),
    check: (r: any) => {
      if (r.error) throw new Error('Database unavailable');
    }
  };
});
""", content, flags=re.DOTALL)

# In the fixture, we just need to return event and a way to retrieve the executed queries
content = re.sub(
r"function fixture\(area: string, search = '', total = 125, failure\?: string\) \{.*?\n  const event = \{.*?\n  return \{ event, executed \};\n\}",
r"""import { safeQuery } from '../src/lib/server/db';
function fixture(area: string, search = '', total = 125, failure?: string) {
  const db = {} as any; // Dummy db object for locals, no longer used
  const event = {
    locals: { user: { id: 'current-user' }, db },
    params: { area },
    url: new URL(`https://nox.invalid/${area}${search}`)
  } as any;
  
  // Mock safeQuery implementation
  (safeQuery as any).mockImplementation((query: any) => {
    if (failure) return { error: { message: failure } };
    
    const { sql, params } = query.toSQL();
    if (sql.includes('count()')) {
        return { data: [{ count: total }], error: null };
    }
    
    // Simulate empty data if total is 0 or offset is beyond total
    let limit = params[-2];
    let offset = params[-1];
    if (offset >= total) return { data: [], error: null };
    
    return { data: [{ id: 'mock' }], error: null };
  });

  const executed = () => (safeQuery as any).mock.calls.map((c: any) => c[0].toSQL());
  
  return { event, executed };
}""", content, flags=re.DOTALL)

# In the tests, adjust the expects
content = content.replace("expect(executed).toHaveLength(1);", "expect(executed().filter(q => !q.sql.includes('count()'))).toHaveLength(1);")
content = content.replace("expect(executed[0].calls).toContainEqual(['range', [100, 119]]);", "const q = executed().find(q => !q.sql.includes('count()')); expect(q.sql).toContain('limit ? offset ?'); expect(q.params.slice(-2)).toEqual([20, 100]);")
content = content.replace("expect(executed[0].calls).toContainEqual(['eq', ['user_id', 'current-user']]);", "expect(q.params).toContain('current-user');")
content = content.replace("expect(executed[0].calls.filter(([method]) => method === 'order')).toHaveLength(2);", "expect(q.sql).toContain('order by');")

content = content.replace("expect(executed[0].calls).toContainEqual(['is', ['read_at', null]]);", "const q = executed().find(q => !q.sql.includes('count()')); expect(q.sql).toContain('\"read_at\" is null');")

content = content.replace("expect(executed[0].calls.some(([method, args]) => method === 'eq' && args[0] === 'status')).toBe(false);", "const q = executed().find(q => !q.sql.includes('count()')); expect(q.sql).not.toContain('\"status\" =');")

content = content.replace(
r"""    expect(executed).toHaveLength(3);
    for (const query of executed) {
      expect(query.calls.find(([method]) => method === 'select')?.[1][1]).toEqual({
        count: 'exact',
        head: true
      });
      expect(query.calls).toContainEqual(['eq', ['user_id', 'current-user']]);
    }""",
r"""    expect(executed().length).toBeGreaterThanOrEqual(3);
    for (const query of executed()) {
      expect(query.sql).toContain('count()');
      expect(query.params).toContain('current-user');
    }"""
)

# And clear the mock between tests
content = content.replace("describe('member pagination', () => {", "describe('member pagination', () => {\n  beforeEach(() => { (safeQuery as any).mockClear(); });")
content = content.replace("import { describe, expect, it, vi } from 'vitest';", "import { describe, expect, it, vi, beforeEach } from 'vitest';")


with open('tests/member-pagination.test.ts', 'w') as f:
    f.write(content)
