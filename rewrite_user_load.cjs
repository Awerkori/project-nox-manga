const fs = require('fs');
let code = fs.readFileSync('src/routes/u/[username]/+page.server.ts', 'utf8');

// Replace standard imports
code = code.replace(
  "import { NOX_TITLES } from '$lib/levels';",
  "import { db, schema, safeQuerySingle, safeQuery } from '$lib/server/db';\nimport { eq, and, desc, count } from 'drizzle-orm';\nimport { NOX_TITLES } from '$lib/levels';"
);

fs.writeFileSync('src/routes/u/[username]/+page.server.ts', code);
