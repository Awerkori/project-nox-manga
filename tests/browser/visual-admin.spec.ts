import { test, expect } from '@playwright/test';

const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854';

async function setupPreviewRoute(page: any) {
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
}

test('capture admin visual pages across viewports', async ({ page }) => {
  await setupPreviewRoute(page);

  // 1. Dashboard Desktop (1440px)
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('/preview-admin?view=dashboard&role=ADMIN');
  await page.waitForSelector('.dashboard-shell');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin-dashboard-desktop.png`, fullPage: true });

  // 2. Dashboard Tablet (768px)
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/preview-admin?view=dashboard&role=ADMIN');
  await page.waitForSelector('.dashboard-shell');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin-dashboard-tablet.png`, fullPage: true });

  // 3. Dashboard Mobile (390px)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/preview-admin?view=dashboard&role=ADMIN');
  await page.waitForSelector('.dashboard-shell');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin-dashboard-mobile.png`, fullPage: true });

  // 4. Catalog Desktop (1440px)
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('/preview-admin?view=obras&role=ADMIN');
  await page.waitForSelector('.works-manager-shell');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin-catalog-desktop.png`, fullPage: true });

  // 5. Catalog Mobile (390px)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/preview-admin?view=obras&role=ADMIN');
  await page.waitForSelector('.works-manager-shell');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin-catalog-mobile.png`, fullPage: true });

  // 6. Tags 2-Column Desktop (1440px)
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('/preview-admin?view=tags&role=ADMIN');
  await page.waitForSelector('.tags-view');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin-tags-desktop.png`, fullPage: true });

  // 7. Gestão Desktop (1440px)
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('/preview-admin?view=gestao&role=ADMIN');
  await page.waitForSelector('.gestao-view');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin-gestao-desktop.png`, fullPage: true });

  // 8. Gestão Mobile (390px)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/preview-admin?view=gestao&role=ADMIN');
  await page.waitForSelector('.gestao-view');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin-gestao-mobile.png`, fullPage: true });

  // 9. Configurações Desktop (1440px)
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('/preview-admin?view=configuracoes&role=ADMIN');
  await page.waitForSelector('.config-view');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin-config-desktop.png`, fullPage: true });

  // 10. Chapter Editor Desktop (1440px)
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('/preview-admin?view=capitulo&role=ADMIN');
  await page.waitForSelector('.chapter-editor-view');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin-chapter-editor-desktop.png`, fullPage: true });

  // 11. Role EDITOR Desktop (1440px - verify EDITOR does NOT see Gestão or Configurações in sidebar)
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('/preview-admin?view=dashboard&role=EDITOR');
  await page.waitForSelector('.dashboard-shell');
  await expect(page.locator('.operator-badge')).toContainText('EDITOR');
  await expect(page.locator('.nav-group:has-text("Gestão do Sistema")')).toHaveCount(0);
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin-editor-role-desktop.png`, fullPage: true });
});
