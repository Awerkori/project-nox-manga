const fs = require('fs');
let code = fs.readFileSync('src/routes/scan/+page.server.ts', 'utf8');

// Replace standard imports
code = code.replace(
  "import { WORK_FIELDS } from '$lib/server/db';",
  "import { WORK_FIELDS, db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';\nimport { requireScanMember, requireScanLeader } from '$lib/server/authorization';\nimport { eq, inArray, and, desc, asc } from 'drizzle-orm';"
);

// We'll replace locals.db.rpc with actionsApi
code = code.replace(
  "import { fail, redirect } from '@sveltejs/kit';",
  "import { fail, redirect } from '@sveltejs/kit';\nimport * as actionsApi from '$lib/server/scan-private-actions';"
);

fs.writeFileSync('src/routes/scan/+page.server.ts', code);
