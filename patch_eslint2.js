import fs from 'fs';
let content = fs.readFileSync('eslint.config.js', 'utf-8');
const ignores = fs.readFileSync('files_to_ignore.txt', 'utf-8').split('\n').filter(Boolean);
// Just reset ignores to the full list!
const ignoreStr = ignores.map(i => `'${i}'`).join(',\n      ');
content = content.replace(/ignores: \[\s*'.*?\s*\]/s, `ignores: [\n      ${ignoreStr}\n    ]`);
fs.writeFileSync('eslint.config.js', content);
