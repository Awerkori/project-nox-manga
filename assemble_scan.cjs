const fs = require('fs');

const loadChunk = fs.readFileSync('/tmp/scan_load.ts', 'utf8');

let fullCode = loadChunk + '\n\nexport const actions: Actions = {\n';

for (let i = 0; i < 4; i++) {
  const actionFile = fs.readFileSync(`/tmp/scan_action_${i}.ts`, 'utf8');
  // Remove the fake imports added by split_actions.cjs
  const lines = actionFile.split('\n');
  const cleanLines = lines.filter(line => 
    !line.startsWith('import { db, schema') && 
    !line.startsWith('import { eq, or')
  );
  fullCode += cleanLines.join('\n') + '\n';
}

// Ensure the actions object is closed properly.
// The split script might have left the final `};` in the last chunk, let's check.
fs.writeFileSync('src/routes/scan/+page.server.ts', fullCode);
