import { test, expect } from '@playwright/test';
import * as fs from 'fs';

const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854';
const SCREENSHOT_DIR = process.env.AUDIT_MODE === 'after'
  ? `${ARTIFACT_DIR}/screenshots/after`
  : `${ARTIFACT_DIR}/screenshots/before`;

const VIEWPORTS = [
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-412', width: 412, height: 915 },
  { name: 'desktop-1366', width: 1366, height: 768 },
  { name: 'desktop-1920', width: 1920, height: 1080 }
];

async function setupRoutes(page: any) {
  // Set age cookies so AgeGateModal is bypassed
  await page.context().addCookies([
    { name: 'nox-age-status', value: 'ADULT', domain: '127.0.0.1', path: '/' },
    { name: 'nox-blur-nsfw', value: 'false', domain: '127.0.0.1', path: '/' }
  ]);

  await page.addInitScript(() => {
    try {
      localStorage.setItem('nox-age-status', 'ADULT');
      localStorage.setItem('nox-blur-nsfw', 'false');
    } catch (e) {}
  });

  // Admin preview route
  await page.route('**/preview-admin*', (route: any) => {
    route.fulfill({
      contentType: 'text/html',
      body: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Preview</title>
</head>
<body style="margin:0; background:#07040d;">
  <div id="preview-root"></div>
  <script type="module" src="/tests/fixtures/admin-preview-entry.ts"></script>
</body>
</html>`
    });
  });

  // Member QA route
  await page.route('**/qa-member*', (route: any) => {
    route.fulfill({
      contentType: 'text/html',
      body: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Member Preview</title>
</head>
<body style="margin:0; background:#07040d;">
  <div id="member"></div>
  <script type="module" src="/tests/fixtures/member-entry.ts"></script>
</body>
</html>`
    });
  });
}

test('audit visual layout and detect horizontal overflows across viewports', async ({ page }) => {
  test.setTimeout(180000);
  await setupRoutes(page);

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const pagesToAudit = [
    { id: 'home', path: '/', selector: 'main' },
    { id: 'obra', path: '/obra/vinganca-do-cao-de-caca', selector: '.work-page-container' },
    { id: 'admin-dashboard', path: '/preview-admin?view=dashboard&role=ADMIN', selector: '.editorial-workspace' },
    { id: 'admin-obras', path: '/preview-admin?view=obras&role=ADMIN', selector: '.works-manager-shell' },
    { id: 'admin-importer', path: '/preview-admin?view=importer&role=ADMIN', selector: '.importer-dashboard' },
    { id: 'notificacoes', path: '/qa-member?area=notificacoes', selector: '#member' }
  ];

  const auditReport: Array<{ page: string; viewport: string; overflow: boolean; scrollWidth: number; innerWidth: number; offenders: any[] }> = [];

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    for (const item of pagesToAudit) {
      try {
        await page.goto(item.path, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector(item.selector, { timeout: 10000 });

        // Let layout settle
        await page.waitForTimeout(400);

        // Check horizontal overflow
        const overflowData = await page.evaluate(() => {
          const docEl = document.documentElement;
          const body = document.body;
          const scrollWidth = Math.max(docEl.scrollWidth, body ? body.scrollWidth : 0);
          const innerWidth = window.innerWidth;
          const hasOverflow = scrollWidth > innerWidth;

          let offenders: Array<{ tag: string; id: string; className: string; right: number; width: number }> = [];
          if (hasOverflow) {
            const allElements = Array.from(document.querySelectorAll('*'));
            offenders = allElements
              .map(el => {
                const rect = el.getBoundingClientRect();
                return {
                  tag: el.tagName.toLowerCase(),
                  id: el.id,
                  className: typeof el.className === 'string' ? el.className.trim() : '',
                  right: Math.round(rect.right),
                  width: Math.round(rect.width)
                };
              })
              .filter(o => o.right > innerWidth + 1)
              .slice(0, 10);
          }

          return { hasOverflow, scrollWidth, innerWidth, offenders };
        });

        auditReport.push({
          page: item.id,
          viewport: vp.name,
          overflow: overflowData.hasOverflow,
          scrollWidth: overflowData.scrollWidth,
          innerWidth: overflowData.innerWidth,
          offenders: overflowData.offenders
        });

        // 1. Capture top of page / main view
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/${item.id}-${vp.name}-top.png`,
          fullPage: false
        });

        // 2. Scroll to bottom and capture footer / bottom nav
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(300);
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/${item.id}-${vp.name}-bottom.png`,
          fullPage: false
        });

      } catch (err: any) {
        console.error(`Error auditing ${item.id} at ${vp.name}:`, err.message);
      }
    }
  }

  const reportPath = `${SCREENSHOT_DIR}/audit-report.json`;
  fs.writeFileSync(reportPath, JSON.stringify(auditReport, null, 2));
  console.log('AUDIT_REPORT_SUMMARY:');
  const overflows = auditReport.filter(r => r.overflow);
  console.log(`Total checked: ${auditReport.length}, Overflows found: ${overflows.length}`);
  for (const o of overflows) {
    console.log(`- OVERFLOW in ${o.page} at ${o.viewport}: scrollWidth=${o.scrollWidth} > innerWidth=${o.innerWidth}`);
    if (o.offenders.length) {
      console.log(`  Offenders: ${JSON.stringify(o.offenders.slice(0, 3))}`);
    }
  }
});
