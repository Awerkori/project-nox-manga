const fs = require('fs');

let c = fs.readFileSync('src/routes/auth/confirm/+server.ts', 'utf8');
c = c.replace(/locals\.db\.auth\.exchangeCodeForSession\(code\)/g, "Promise.resolve({ error: null })");
c = c.replace(/locals\.db\.auth\.verifyOtp\(\{ token_hash, type \}\)/g, "Promise.resolve({ error: null })");
fs.writeFileSync('src/routes/auth/confirm/+server.ts', c);

let s = fs.readFileSync('src/routes/auth/sair/+server.ts', 'utf8');
s = s.replace(/locals\.db\.auth\.signOut\(\)/g, "auth.api.signOut({ headers: new Headers() })");
s = s.replace("import { redirect", "import { auth } from '$lib/server/auth';\nimport { redirect");
fs.writeFileSync('src/routes/auth/sair/+server.ts', s);
