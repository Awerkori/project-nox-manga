import fs from "node:fs";
import path from "node:path";

const target = path.resolve("src/worker-wrapper.js");
if (fs.existsSync(target)) {
  let content = fs.readFileSync(target, "utf8");
  if (!content.includes("AUTH_COOKIE_REGEX")) {
    const searchTarget = "var worker_default = {";
    const authLogic = `const AUTH_COOKIE_REGEX = /(?:sb-[a-z0-9_-]+-auth-token|supabase[-_]auth[-_]token|sb:token)/i;

function hasAuth(req) {
  const cookie = req.headers.get("cookie") || "";
  if (AUTH_COOKIE_REGEX.test(cookie)) return true;
  if (req.headers.has("authorization")) return true;
  return false;
}

var worker_default = {`;
    content = content.replace(searchTarget, authLogic);
    content = content.replace(
      "let res = !pragma.includes(\"no-cache\") && await r2(req);",
      "const isAuth = hasAuth(req);\n    let res = !isAuth && !pragma.includes(\"no-cache\") && await r2(req);"
    );
    content = content.replace(
      "return pragma && res.status < 400 ? c(req, res, ctx) : res;",
      "return !isAuth && pragma && res.status < 400 ? c(req, res, ctx) : res;"
    );
    fs.writeFileSync(target, content, "utf8");
    console.log("[inject-worker-auth-bypass] Injected auth bypass into src/worker-wrapper.js");
  } else {
    console.log("[inject-worker-auth-bypass] src/worker-wrapper.js already contains auth bypass");
  }
}

// Missing versioned assets must not carry the one-year immutable cache directive.
if (fs.existsSync(target)) {
  const content = fs.readFileSync(target, "utf8");
  const original = 'res = await env2.ASSETS.fetch(req);';
  if (!content.includes('ASSET_ERROR_NO_STORE')) {
    if (!content.includes(original)) throw new Error('Worker asset handler changed; inspect adapter output');
    fs.writeFileSync(target, content.replace(original, `${original}
      if (res.status >= 400) {
        // ASSET_ERROR_NO_STORE
        res = new Response(res.body, res);
        res.headers.set("cache-control", "no-store");
      }`));
  }
}
