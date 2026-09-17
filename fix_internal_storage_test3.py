with open('tests/internal-storage.test.ts', 'r') as f:
    content = f.read()

mock_code = """
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('../src/lib/server/db', () => ({
      db: {
        execute: vi.fn().mockResolvedValue([{ id: '935e146d-de3f-4a8e-b393-692944c716fa', reference: 'MANGA_STORAGE_01', type: 'TELEGRAM', secret_chat_id: '-1004353931378', secret_token: 'super-secret-token', display_name: 'Nox Mangá' }]),
        insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => [{ id: 'mocked-id' }]) })) })),
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => [{ id: 'mocked' }]) })) }))
      },
      schema: {}
    }));
  });
"""
import re
content = re.sub(r"  beforeEach\(\(\) => \{\n    vi.resetModules\(\);\n    vi.doMock.*?\n    \}\)\);\n  \}\);", mock_code, content, flags=re.DOTALL)

content = content.replace("botReference: 'MANGA_STORAGE_01',", "botReference: 'MANGA_STORAGE_01', channelId: '-1004353931378', displayName: 'Nox Mangá', shardId: '935e146d-de3f-4a8e-b393-692944c716fa',")

with open('tests/internal-storage.test.ts', 'w') as f:
    f.write(content)
