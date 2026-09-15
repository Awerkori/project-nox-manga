import { test, expect } from '@playwright/test';
import * as fs from 'fs';

const ARTIFACT_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854';
const SCREENSHOT_DIR = `${ARTIFACT_DIR}/screenshots/homologation`;

test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

async function setupScanHarness(page: any) {
  await page.route('**/qa-scan-proof*', (route: any) => {
    route.fulfill({
      contentType: 'text/html',
      body: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scan Homologation Proof</title>
  <script>
    window.__sveltekit_dev = { env: { PUBLIC_SUPABASE_URL: 'https://test.supabase.co', PUBLIC_SUPABASE_ANON_KEY: 'test' } };
  </script>
</head>
<body style="margin:0; background:#08060f;">
  <div id="preview-root"></div>
  <script type="module" src="/tests/fixtures/scan-proof-entry.ts"></script>
</body>
</html>`
    });
  });
}

const VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'desktop-1280x800', width: 1280, height: 800 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'mobile-412x915', width: 412, height: 915 },
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'mobile-360x800', width: 360, height: 800 },
  { name: 'mobile-320x568', width: 320, height: 568 }
];

test.describe('Scan / Produção Homologation & Responsive Verification', () => {
  test('1. Pipeline Accordions, Modals, and Dynamic Counters on Desktop', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await setupScanHarness(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/qa-scan-proof?tab=pipeline&stage=clean_redraw');
    await page.waitForSelector('.pipeline-stage-view-root');

    // Verify parent Pipeline badge has count 3
    const pipelineBadge = page.locator('.total-pipeline-badge');
    await expect(pipelineBadge).toBeVisible();
    await expect(pipelineBadge).toContainText('3');

    // Verify sub-stage badge for Clean has 1
    const cleanSubBadge = page.locator('.nav-sub-btn.active .nav-sub-badge');
    await expect(cleanSubBadge).toBeVisible();
    await expect(cleanSubBadge).toContainText('1');

    // Available chapter accordion exists
    const availableAccordion = page.locator('.available-accordion-card').first();
    await expect(availableAccordion).toBeVisible();
    await expect(availableAccordion.locator('.chapter-number-title')).toContainText('Capítulo #1');

    // Click to expand available accordion
    await availableAccordion.locator('.accordion-header-bar').click();
    await expect(availableAccordion.locator('.accordion-expanded-body')).toBeVisible();

    // Verify prominent claim CTA and admin buttons
    await expect(availableAccordion.locator('.btn-claim-prominent')).toBeVisible();
    const editBtn = availableAccordion.locator('.btn-action-ghost', { hasText: 'Editar Capítulo' });
    await expect(editBtn).toBeVisible();

    // Open Edit Chapter Modal
    await editBtn.click();
    const editModal = page.locator('.standard-modal-dialog', { hasText: 'Editar Capítulo em Produção' });
    await expect(editModal).toBeVisible();
    await expect(editModal.locator('input[name="chapter_label"]')).toHaveValue('O Despertar');

    // Close edit modal
    await editModal.locator('.btn-cancel-action').click();
    await expect(editModal).toBeHidden();

    // Open Delete Production Chapter Modal
    const deleteBtn = availableAccordion.locator('.btn-action-ghost.danger', { hasText: 'Excluir Produção' });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    const deleteModal = page.locator('.delete-dialog');
    await expect(deleteModal).toBeVisible();
    await expect(deleteModal.locator('.delete-warning-box')).toBeVisible();
    await deleteModal.locator('.btn-cancel-action').click();
    await expect(deleteModal).toBeHidden();

    // Capture screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01_pipeline_clean_desktop.png`,
      fullPage: true
    });

    expect(errors).toEqual([]);
  });

  test('2. Pipeline Typeset Stage with Upstream Files & Completion Actions', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await setupScanHarness(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/qa-scan-proof?tab=pipeline&stage=typeset');
    await page.waitForSelector('.pipeline-stage-view-root');

    // Typeset has Meus Capítulos for pch-1 (assigned to user-awerkori)
    const myAccordion = page.locator('.my-chapter-accordion-card').first();
    await expect(myAccordion).toBeVisible();
    await expect(myAccordion.locator('.chapter-number-title')).toContainText('Capítulo #1');

    // Steps container
    const stepsContainer = myAccordion.locator('.card-steps-container');
    await expect(stepsContainer).toBeVisible();

    // Step 1: Upstream dual downloads (Clean & Tradução separated)
    const cleanDownload = stepsContainer.locator('.btn-download-pill', { hasText: 'Baixar Clean' });
    const tradDownload = stepsContainer.locator('.btn-download-pill', { hasText: 'Baixar Tradução' });
    await expect(cleanDownload).toBeVisible();
    await expect(tradDownload).toBeVisible();

    // Step 3: Devolver à fila and Concluir Etapa
    const abandonBtn = stepsContainer.locator('.btn-abandon-queue');
    await expect(abandonBtn).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02_pipeline_typeset_desktop.png`,
      fullPage: true
    });

    expect(errors).toEqual([]);
  });

  test('3. ScanHome 9 Canonical Stages & Unified Active Demands', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await setupScanHarness(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/qa-scan-proof?tab=home');
    await page.waitForSelector('.scan-home-layout');

    // 9 canonical stages in queue grid
    const queueCards = page.locator('.queues-grid .queue-card');
    await expect(queueCards).toHaveCount(9);

    // Click Typeset queue card -> should navigate to Pipeline
    const typesetQueueCard = queueCards.nth(3); // 0=raw, 1=clean, 2=traducao, 3=typeset
    await typesetQueueCard.click();
    await expect(page.locator('.pipeline-stage-view-root')).toBeVisible();

    // Return to home
    await page.goto('/qa-scan-proof?tab=home');
    await page.waitForSelector('.scan-home-layout');

    // Minhas Demandas Ativas should display Céu Distante #1 · Typeset
    const myDemand = page.locator('.task-entry-card.editorial').first();
    await expect(myDemand).toBeVisible();
    await expect(myDemand).toContainText('Céu Distante');
    await expect(myDemand).toContainText('#1');
    await expect(myDemand).toContainText('Typeset');

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/03_scan_home_desktop.png`,
      fullPage: true
    });

    expect(errors).toEqual([]);
  });

  test('4. WorkloadTab Crash-Free & Keyed Runes Verification', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await setupScanHarness(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/qa-scan-proof?tab=workload');
    await page.waitForSelector('.workload-module-root');

    // Verify member cards render without duplicate key crashes
    const memberCards = page.locator('.workload-card');
    await expect(memberCards).toHaveCount(2);
    await expect(memberCards.first()).toContainText('Awerkori');
    await expect(memberCards.nth(1)).toContainText('Lucas Tradutor');

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/04_workload_tab.png`,
      fullPage: true
    });

    expect(errors).toEqual([]);
  });

  test('5. ChatTab Sticky Composer & Channel Reorder Controls', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await setupScanHarness(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/qa-scan-proof?tab=chat');
    await page.waitForSelector('.chat-module-root');

    // Message feed and composer are visible
    const messageFeed = page.locator('.messages-feed-viewport');
    const composer = page.locator('.composer-textarea');
    await expect(messageFeed).toBeVisible();
    await expect(composer).toBeVisible();

    // Admin channel reorder controls
    const channelWrapper = page.locator('.channel-nav-item-wrapper').first();
    await channelWrapper.hover();
    const reorderArrows = page.locator('.btn-order-arrow');
    await expect(reorderArrows.first()).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/05_chat_tab.png`,
      fullPage: true
    });

    expect(errors).toEqual([]);
  });

  for (const vp of VIEWPORTS) {
    test(`6. Zero Horizontal Overflow across viewports: ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await setupScanHarness(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/qa-scan-proof?tab=pipeline&stage=clean_redraw');
      await page.waitForSelector('.pipeline-stage-view-root');

      // Expand accordion
      const accordion = page.locator('.available-accordion-card').first();
      if (await accordion.isVisible()) {
        await accordion.locator('.accordion-header-bar').click();
      }

      // Check overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const innerWidth = await page.evaluate(() => window.innerWidth);
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth);

      // Screenshot responsive view
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/overflow_${vp.name}.png`,
        fullPage: true
      });

      expect(errors).toEqual([]);
    });
  }
});
