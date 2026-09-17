import re

with open('tests/internal-storage.test.ts', 'r') as f:
    content = f.read()

content = re.sub(
    r"env: \{ NOX_STORAGE_BRIDGE_TOKEN",
    r"env: { TURSO_DB_URL: 'libsql://dummy.turso.io', TURSO_DB_TOKEN: 'dummy', NOX_STORAGE_BRIDGE_TOKEN",
    content
)

with open('tests/internal-storage.test.ts', 'w') as f:
    f.write(content)
