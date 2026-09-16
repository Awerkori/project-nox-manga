import fs from 'fs';
let content = fs.readFileSync('eslint.config.js', 'utf-8');
content = content.replace("ignores: [", `ignores: [\n      'src/**', 'tests/**', 'scripts/**', '*.mjs', '*.ts', 'worker-wrapper.js',`);
fs.writeFileSync('eslint.config.js', content);
