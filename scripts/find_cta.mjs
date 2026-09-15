import fs from 'fs';
const html = fs.readFileSync('prod.html', 'utf-8');

const idx1 = html.indexOf('Ver catálogo completo');
if (idx1 !== -1) {
  console.log("FOUND EXACT 'Ver catálogo completo' at", idx1);
  console.log("Context:", html.substring(idx1 - 100, idx1 + 100));
}

const idx2 = html.indexOf('Ver mais lançamentos');
if (idx2 !== -1) {
  console.log("FOUND 'Ver mais lançamentos' at", idx2);
}
