const fs = require('fs');

const code = fs.readFileSync('src/routes/scan/+page.server.ts', 'utf8');

const loadMatch = code.indexOf('export const actions: Actions = {');

const loadChunk = code.substring(0, loadMatch);
fs.writeFileSync('/tmp/scan_load.ts', loadChunk);

const actionsChunk = code.substring(loadMatch);
const actionRegex = /^  [a-zA-Z0-9_]+: async \(/gm;

let match;
const actionIndices = [];
while ((match = actionRegex.exec(actionsChunk)) !== null) {
  actionIndices.push(match.index);
}

const numChunks = 4;
const chunkSize = Math.ceil(actionIndices.length / numChunks);

for (let i = 0; i < numChunks; i++) {
  const startIdx = actionIndices[i * chunkSize];
  const endIdx = i === numChunks - 1 ? actionsChunk.length : actionIndices[(i + 1) * chunkSize];
  
  let chunkStr = actionsChunk.substring(startIdx, endIdx);
  // Add necessary context so it compiles
  chunkStr = `import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';\nimport { eq, or, and, isNull, isNotNull, gt, lt, desc, asc, inArray, sql } from 'drizzle-orm';\n` + chunkStr;
  
  fs.writeFileSync(`/tmp/scan_action_${i}.ts`, chunkStr);
}

