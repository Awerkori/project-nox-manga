const fs = require('fs');
const { execSync } = require('child_process');

const map = JSON.parse(fs.readFileSync('snake-map.json', 'utf8'));

function applySvelteCodemod(filePath) {
    if (!fs.existsSync(filePath)) return;
    let code = fs.readFileSync(filePath, 'utf8');
    
    // property access: .snake_case or ?.snake_case
    for (const [snake, camel] of Object.entries(map)) {
        code = code.replace(new RegExp(`\\.\\b${snake}\\b`, 'g'), `.${camel}`);
        // optional chaining
        code = code.replace(new RegExp(`\\?\\.\\b${snake}\\b`, 'g'), `?.${camel}`);
        
        // Let's also do destructuring BUT carefully:
        // We look for `{ ..., snake_case, ... } =` 
        // We just do it for standard destructing in script tags
        code = code.replace(new RegExp(`\\{\\s*([^}]*?)\\b${snake}\\b([^}]*?)\\s*\\}\\s*=`, 'g'), `{$1${camel}$2} =`);
    }
    
    fs.writeFileSync(filePath, code);
}

const files = execSync('find src -type f -name "*.svelte"').toString().split('\n').filter(Boolean);
for (const file of files) {
   applySvelteCodemod(file);
}
