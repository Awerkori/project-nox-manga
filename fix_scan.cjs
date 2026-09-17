const fs = require('fs');
let file = 'src/lib/server/scan-global-actions.ts';
let code = fs.readFileSync(file, 'utf8');
code = code.replace(/\.values\(\{([^]+?)\}\)/g, '.values({$1} as any)');
code = code.replace(/\.set\(\{([^]+?)\}\)/g, '.set({$1} as any)');
fs.writeFileSync(file, code);
