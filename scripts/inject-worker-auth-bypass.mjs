import fs from "node:fs";
import path from "node:path";

const target = path.resolve("src/worker-wrapper.js");
if (fs.existsSync(target)) {
  let content = fs.readFileSync(target, "utf8");
  const generatedLintDisable = "/* eslint-disable @typescript-eslint/no-unused-expressions, @typescript-eslint/no-unused-vars, no-empty */\n";
  // The adapter emits minified generated glue which deliberately uses all
  // three patterns. Reapply this file-level marker on every build, rather
  // than allowing generated code to make the focused CI lint nondeterministic.
  if (!content.startsWith(generatedLintDisable)) {
    content = generatedLintDisable + content;
    fs.writeFileSync(target, content, "utf8");
  }
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

// Ensure functional scheduled handler is exported to process email outbox during crons
if (fs.existsSync(target)) {
  let content = fs.readFileSync(target, "utf8");
  const scheduledHandler = `  async scheduled(event, env2, ctx) {
    ctx.waitUntil((async () => {
      try {
        await initialized;
        const targetUrl = (origin || "https://manga.project-nox-awerkori.workers.dev") + "/api/internal/email-processor?limit=25";
        const token = env2?.NOX_STORAGE_BRIDGE_TOKEN || "";
        const req = new Request(targetUrl, {
          method: "GET",
          headers: {
            "authorization": token ? \`Bearer \${token}\` : "",
            "x-internal-cron": "true"
          }
        });
        const res = await server.respond(req, {
          platform: {
            env: env2,
            ctx,
            context: ctx,
            caches,
            cf: {}
          },
          getClientAddress() {
            return "127.0.0.1";
          }
        });
        const body = await res.text().catch(() => "");
        console.log(\`[CRON_EMAIL_PROCESSOR] Status \${res.status}: \${body}\`);
        // Cover warming is event-driven at publication time. Do not poll KV,
        // Yugabyte, or Telegram from this frequent email cron.
      } catch (err) {
        console.error("[CRON_EMAIL_PROCESSOR_ERROR]", err);
      }
    })());
  },`;

  if (content.includes("async scheduled(event, env, ctx) {}")) {
    content = content.replace("async scheduled(event, env, ctx) {},", scheduledHandler);
    fs.writeFileSync(target, content, "utf8");
    console.log("[inject-worker-auth-bypass] Replaced empty scheduled handler with functional outbox cron in src/worker-wrapper.js");
  } else if (!content.includes("async scheduled(")) {
    content = content.replace("var worker_default = {", `var worker_default = {\n${scheduledHandler}\n`);
    fs.writeFileSync(target, content, "utf8");
    console.log("[inject-worker-auth-bypass] Injected functional scheduled cron handler into src/worker-wrapper.js");
  }
}
