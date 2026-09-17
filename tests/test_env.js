const fs = require('fs');
let content = fs.readFileSync('tests/auth-flows.test.ts', 'utf8');
content = `vi.mock('$env/dynamic/private', () => ({ env: { TURSO_DB_URL: 'http://localhost', TURSO_DB_TOKEN: 'mock' } }));\n` + content;
fs.writeFileSync('tests/auth-flows.test.ts', content);
