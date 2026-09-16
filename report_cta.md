PROJECT NOX — CTA RELEASES REAL FIX

ROOT CAUSE:
The codebase uses `wrangler deploy` to deploy to Cloudflare Workers, not Cloudflare Pages automatic GitHub integration. When I previously merged the `fix-home-releases-inline-expansion` branch into `main` and pushed to GitHub, the new code never actually deployed to production because there is no GitHub Action to auto-deploy it. Cloudflare Workers require a manual CLI deploy. Thus, the production edge nodes were still running the old worker build which contained the hardcoded CTA link to the catalog.

============================================================

OLD CTA FOUND AT:

File:
`src/lib/components/RecentReleases.svelte`

Line:
Was around line 81 prior to commit `e9d9514`.

Imported by:
`src/routes/+page.svelte` (The Home page)

============================================================

WHY PREVIOUS FIX DIDN’T AFFECT PROD:
The previous fix successfully updated the source code on `main` (commit `e9d9514`), but the compiled bundle was never pushed to the Cloudflare Worker via `wrangler deploy`. The edge node continued executing the old worker version.

============================================================

MAIN:

Commit:
`e9d9514` (feat(home): replace catalog link with inline load-more for recent releases)

Contains old CTA:
NO

Contains new CTA:
YES

============================================================

BUILD:

Old CTA:
0 ocorrências no diretório `.svelte-kit/output/`

New CTA:
`Ver mais lançamentos` presente no bundle SSR e JS do client.

============================================================

PRODUCTION HTML:

Old CTA:
0 ocorrências (Não foi encontrado via requisição HTTP direta).

New CTA:
`Ver mais lançamentos` presente.

============================================================

PRODUCTION UI:

Visible CTA:
`Ver mais lançamentos`

Click behavior:
INLINE EXPANSION (Expande os cards no mesmo local sem recarregar)

URL changed:
NO

============================================================

FINAL:

CTA:
FIXED

EXPANSION:
WORKING

CATALOG NAVIGATION:
REMOVED

PRODUCTION:
VALIDATED

STATUS:
DONE
