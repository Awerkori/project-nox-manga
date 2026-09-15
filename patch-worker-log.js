import fs from 'fs';
let code = fs.readFileSync('src/worker-wrapper.js', 'utf8');

code = code.replace(
  'return !isAuth && pragma && res.status < 400 ? c(req, res, ctx) : res;',
  `console.log("[WORKER-RETURN]", req.url, "=>", res.status, res.headers.get("content-type"));
  return !isAuth && pragma && res.status < 400 ? c(req, res, ctx) : res;`
);

fs.writeFileSync('src/worker-wrapper.js', code);
