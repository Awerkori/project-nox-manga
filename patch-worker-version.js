import fs from 'fs';
let code = fs.readFileSync('src/worker-wrapper.js', 'utf8');

if (!code.includes('WORKER_VERSION')) {
  code = code.replace(
    'return !isAuth && pragma && res.status < 400 ? c(req, res, ctx) : res;',
    `res = new Response(res.body, res);
    res.headers.set("X-Worker-Version", "v2-debug");
    return !isAuth && pragma && res.status < 400 ? c(req, res, ctx) : res;`
  );
  fs.writeFileSync('src/worker-wrapper.js', code);
}
