const fs = require('fs');
const { execSync } = require('child_process');

const files = execSync('find src/routes -type f -name "*.ts"').toString().split('\n').filter(Boolean);

for (const file of files) {
  let code = fs.readFileSync(file, 'utf8');
  if (code.includes('locals.user.id')) {
    // If it's `locals.user.id`, let's just assert `locals.user!.id` 
    // because usually they have auth guards before!
    code = code.replace(/locals\.user\.id/g, 'locals.user!.id');
    fs.writeFileSync(file, code);
  }
}
