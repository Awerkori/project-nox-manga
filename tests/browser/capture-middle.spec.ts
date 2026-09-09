import { test } from '@playwright/test';
const ARTIFACT_DIR = process.env.AUDIT_MODE === 'after'
  ? '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854/screenshots/after'
  : '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854/screenshots/before';

test('capture middle and full details of key pages', async ({ page }) => {
  page.on('pageerror', err => console.error('PAGE_ERROR:', err.message));
  page.on('console', msg => console.log('PAGE_LOG:', msg.text()));

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
      body: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#07040d;"><div id="preview-root"></div><script type="module" src="/tests/fixtures/admin-preview-entry.ts"></script></body></html>`
    });
  });

  // Member QA route
  await page.route('**/qa-member*', (route: any) => {
    route.fulfill({
      contentType: 'text/html',
      body: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#07040d;"><div id="member"></div><script type="module" src="/tests/fixtures/member-entry.ts"></script></body></html>`
    });
  });

  // 1. Obra mobile middle
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/obra/vinganca-do-cao-de-caca', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.work-page-container', { timeout: 10000 });
  await page.waitForTimeout(400);

  // Scroll to Informações card
  const infoEl = await page.$('.work-metadata-card.mobile-info');
  if (infoEl) {
    await infoEl.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${ARTIFACT_DIR}/obra-mobile-360-info.png` });
  }

  // Scroll to Actions and Reading button
  const actionEl = await page.$('.work-actions-block');
  if (actionEl) {
    await actionEl.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${ARTIFACT_DIR}/obra-mobile-360-actions.png` });
  }

  // Full page screenshot of Obra
  await page.screenshot({ path: `${ARTIFACT_DIR}/obra-mobile-360-fullpage.png`, fullPage: true });

  // 2. Notificações mobile
  await page.goto('/qa-member?area=notificacoes', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#member', { timeout: 10000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${ARTIFACT_DIR}/notificacoes-mobile-360-fullpage.png`, fullPage: true });

  // 3. Admin dashboard full page
  await page.goto('/preview-admin?view=dashboard&role=ADMIN', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.editorial-workspace', { timeout: 10000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin-dashboard-mobile-360-fullpage.png`, fullPage: true });

  // 4. Admin obras full page
  await page.goto('/preview-admin?view=obras&role=ADMIN', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.works-manager-shell', { timeout: 10000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin-obras-mobile-360-fullpage.png`, fullPage: true });

  // 5. Admin importer
  await page.goto('/preview-admin?view=importer&role=ADMIN', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${ARTIFACT_DIR}/admin-importer-mobile-360-preview.png` });
});
