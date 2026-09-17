import fs from 'fs';
import { execSync } from 'child_process';

const out = execSync('grep -rl "\\\\.from([\'\\"\\\`]" src/routes/ src/lib/server/ | grep -v "safe.ts" | grep -v "schema.ts" | grep -v "db.ts" | grep -v "postgrest.ts" | grep -v "importerQueue" | grep -v "authorization.ts"').toString();

const files = out.split('\n').filter(Boolean);

const critical = [];
const high = [];
const low = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const isAdmin = file.includes('/admin/') || file.includes('staff');
  const hasDeleteUpdate = content.includes('.update(') || content.includes('.delete(') || content.includes('.insert(') || content.includes('.upsert(');
  
  if (isAdmin || file.includes('role') || file.includes('permission') || (hasDeleteUpdate && (file.includes('scan') || file.includes('user') || file.includes('auth')))) {
    critical.push(file);
  } else if (hasDeleteUpdate) {
    high.push(file);
  } else {
    low.push(file);
  }
}

fs.writeFileSync('migration_critical.txt', critical.join('\n'));
fs.writeFileSync('migration_high.txt', high.join('\n'));
fs.writeFileSync('migration_low.txt', low.join('\n'));

console.log(`CRITICAL: ${critical.length}`);
console.log(`HIGH: ${high.length}`);
console.log(`LOW: ${low.length}`);
