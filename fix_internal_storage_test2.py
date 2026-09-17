import re

with open('tests/internal-storage.test.ts', 'r') as f:
    content = f.read()

mock_code = """
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('../src/lib/server/db', () => ({
      db: {
        execute: vi.fn().mockResolvedValue([{ reference: 'MANGA_STORAGE_01', type: 'TELEGRAM', secret_chat_id: '-100123', secret_token: 'tok' }]),
        insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => [{ id: 'mocked-id' }]) })) })),
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => [{ id: 'mocked' }]) })) }))
      },
      schema: {}
    }));
  });
"""
content = re.sub(r"  beforeEach\(\(\) => \{\n    vi.resetModules\(\);\n  \}\);", mock_code, content)

with open('tests/internal-storage.test.ts', 'w') as f:
    f.write(content)
