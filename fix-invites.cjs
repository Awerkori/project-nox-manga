const fs = require('fs');
let file = 'src/lib/server/invites.ts';
if (fs.existsSync(file)) {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(/\.values\(\{([^]+?)\}\)/g, '.values({$1} as any)');
  fs.writeFileSync(file, code);
}
