const fs = require('fs');
const file = '/home/awerkori/.gemini/antigravity-cli/brain/5d61e219-dd57-465c-984c-744efa0ed4d3/migration-report.md';
let data = fs.readFileSync(file, 'utf8');

data = data.replace('- **Phase 6 (Backend Drizzle)**: 100% complete.', '- **Phase 6 (Backend Drizzle)**: 95% complete. 48 files were discovered to still use `locals.db.from()`. 10 subagents spawned to finish them.');

fs.writeFileSync(file, data);
