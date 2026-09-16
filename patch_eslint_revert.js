import fs from 'fs';
let content = fs.readFileSync('eslint.config.js', 'utf-8');
content = content.replace("'src/**', 'tests/**', 'scripts/**', '*.mjs', '*.ts', 'worker-wrapper.js',\n      ", "");
fs.writeFileSync('eslint.config.js', content);
