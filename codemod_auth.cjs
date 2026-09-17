const fs = require('fs');
let code = fs.readFileSync('src/routes/[auth=auth]/+page.server.ts', 'utf8');

// The file probably has `import { fail, redirect } from '@sveltejs/kit';`
code = code.replace(/locals\.db\.auth\.signInWithPassword\(\{ email, password \}\)/g, "auth.api.signInEmail({ body: { email, password }, asResponse: false, headers: new Headers() })");
code = code.replace(/locals\.db\.auth\.signUp\(\{[\s\S]*?\}\)/g, "auth.api.signUpEmail({ body: { email, password, name: username }, asResponse: false, headers: new Headers() })");
code = code.replace(/locals\.db\.auth\.resetPasswordForEmail[\s\S]*?\)/g, "auth.api.forgetPassword({ body: { email }, asResponse: false, headers: new Headers() })");
code = code.replace(/locals\.db\.auth\.updateUser\(\{ password \}\)/g, "auth.api.resetPassword({ body: { newPassword: password }, asResponse: false, headers: new Headers() })");
code = code.replace(/locals\.db\.auth\.signOut\(\)/g, "auth.api.signOut({ headers: new Headers() })");

// Insert auth import
code = code.replace("import { fail, redirect", "import { auth } from '$lib/server/auth';\nimport { fail, redirect");

fs.writeFileSync('src/routes/[auth=auth]/+page.server.ts', code);
