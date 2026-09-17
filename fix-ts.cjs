const fs = require('fs');

const map = JSON.parse(fs.readFileSync('snake-map.json', 'utf8'));

// Regex replace specifically for Property Access and Destructuring in .ts files
function applyTsCodemod(filePath) {
    if (!fs.existsSync(filePath)) return;
    let code = fs.readFileSync(filePath, 'utf8');
    
    // property access: .snake_case
    for (const [snake, camel] of Object.entries(map)) {
        code = code.replace(new RegExp(`\\.\\b${snake}\\b`, 'g'), `.${camel}`);
        // destructuring: { snake_case }
        code = code.replace(new RegExp(`\\{\\s*([^}]*?)\\b${snake}\\b([^}]*?)\\s*\\}`, 'g'), `{$1${camel}$2}`);
        // optional chaining
        code = code.replace(new RegExp(`\\?\\.\\b${snake}\\b`, 'g'), `?.${camel}`);
    }
    
    fs.writeFileSync(filePath, code);
}

// Find all ts files in src
const { execSync } = require('child_process');
const files = execSync('find src -type f -name "*.ts"').toString().split('\n').filter(Boolean);

for (const file of files) {
   applyTsCodemod(file);
}
