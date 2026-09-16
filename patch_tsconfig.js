import fs from 'fs';
let content = fs.readFileSync('tsconfig.json', 'utf-8');
const data = JSON.parse(content);
data.exclude = ["tests/**", "scripts/**"];
fs.writeFileSync('tsconfig.json', JSON.stringify(data, null, 2));
