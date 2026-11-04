import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { testArtifactDir } from '../test-artifacts';

const SCREENSHOT_DIR = testArtifactDir('scan-homologation');

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

async function setupPublicScanHarness(page: any) {
  await page.route('**/qa-scan-public-proof*', (route: any) => {
    route.fulfill({
      contentType: 'text/html',
      body: `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Public Scan Proof</title></head>
<body style="margin:0; background:#08060f;"><div id="preview-root"></div><script type="module" src="/tests/fixtures/scan-public-proof-entry.ts"></script></body>
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
  test('0. Public Scan recruitment deep link opens the vacancy view on desktop and mobile', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await setupPublicScanHarness(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/qa-scan-public-proof#recrutamento');
    await expect(page.getByRole('heading', { name: 'Faça parte da equipe Nebula Scans' })).toBeVisible();
    await expect(page.getByText('2 posições', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Entrar para Candidatar-se/ }).first()).toHaveAttribute('href', /redirect=.*%23recrutamento/);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/00_public_scan_recruitment_desktop.png`, fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/00_public_scan_recruitment_mobile.png`, fullPage: true });

    await page.getByRole('button', { name: 'Obras 0' }).click();
    await expect(page.getByRole('heading', { name: 'Nenhuma obra associada' })).toBeVisible();
    expect(new URL(page.url()).hash).toBe('');
    await page.getByRole('button', { name: 'Comentários 0' }).click();
    await expect(page.getByRole('heading', { name: 'Mural da Comunidade' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('1. Pipeline Accordions, Modals, and Dynamic Counters on Desktop', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await setupScanHarness(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/qa-scan-proof?tab=pipeline&stage=clean_redraw');
    await expect(page.locator('.editorial-workspace-root')).toBeVisible();

    // The editorial workspace superseded the old accordion implementation.
    // Preserve the operational contract: the stage summary reports the work
    // that is actually available and the matching stage action is reachable.
    const stageSummary = page.locator('.header-stat-pill');
    await expect(stageSummary).toContainText('1 disponíveis');

    const availableCard = page.locator('.editorial-card.available-card').first();
    await expect(availableCard).toBeVisible();
    await expect(availableCard).toContainText('Cap. #1');
    await expect(availableCard).toContainText('O Despertar');
    await expect(availableCard.getByRole('button', { name: 'Assumir Clean/Redraw' })).toBeVisible();
    await expect(availableCard.getByRole('button', { name: 'Ver detalhes' })).toBeVisible();

    // Capture screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01_pipeline_clean_desktop.png`,
      fullPage: true
    });

    expect(errors).toEqual([]);
  });

  test('1b. Canonical Pipeline stages remain fully accessible without a hidden strip', async ({ page }) => {
    await setupScanHarness(page);

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 }
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/qa-scan-proof?tab=pipeline&stage=clean_redraw');
      await expect(page.locator('.editorial-workspace-root')).toBeVisible();

      const navigation = page.getByRole('navigation', { name: 'Navegação do workspace' });
      const stages = ['Raw Provider', 'Tradução', 'Clean/Redraw', 'Typeset', 'Revisor (QC)', 'Pré-aprovado', 'Publicado'];
      for (const stage of stages) {
        await expect(navigation.getByRole('button', { name: stage, exact: false })).toBeVisible();
      }

      const layout = await navigation.evaluate((element) => {
        return {
          pageOverflow: document.documentElement.scrollWidth > window.innerWidth
        };
      });

      expect(layout).toEqual({ pageOverflow: false });
    }
  });

  test('2. Pipeline Typeset Stage with Upstream Files & Completion Actions', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await setupScanHarness(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/qa-scan-proof?tab=pipeline&stage=typeset');
    await expect(page.locator('.editorial-workspace-root')).toBeVisible();

    // Typeset has Meus Capítulos for pch-1 (assigned to user-awerkori)
    await page.getByRole('tab', { name: /Meus capítulos 1/ }).click();
    const myCard = page.locator('.editorial-card.my-work-card').first();
    await expect(myCard).toBeVisible();
    await expect(myCard).toContainText('Cap. #1');

    await myCard.getByRole('button', { name: 'Abrir trabalho' }).click();
    const workspace = myCard.locator('.editorial-expanded-workspace');
    await expect(workspace).toBeVisible();

    // The expanded workspace keeps both upstream inputs distinguishable.
    await expect(workspace.getByText('Ceu_Distante_Cap01_Clean.zip')).toBeVisible();
    await expect(workspace.getByText('Ceu_Distante_Cap01_Traducao.docx')).toBeVisible();
    await expect(myCard.getByRole('button', { name: 'Recolher trabalho' })).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02_pipeline_typeset_desktop.png`,
      fullPage: true
    });

    expect(errors).toEqual([]);
  });

  test('2b. Pipeline accepts a multi-file delivery and exposes per-file replacement controls', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    let uploadCount = 0;

    await setupScanHarness(page);
    await page.route('**/api/scan/production/upload', (route: any) => {
      uploadCount += 1;
      // One item fails independently. The two completed siblings remain in
      // place and only the failed item is retried.
      if (uploadCount === 3) {
        return route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'Storage temporariamente indisponível' }) });
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, version: uploadCount }) });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/qa-scan-proof?tab=pipeline&stage=typeset');
    await page.getByRole('tab', { name: /Meus capítulos 1/ }).click();
    const myCard = page.locator('.editorial-card.my-work-card').first();
    await myCard.getByRole('button', { name: 'Abrir trabalho' }).click();
    const delivery = page.locator('.deliverable-upload');
    await expect(delivery).toBeVisible();
    await expect(delivery.getByText('Ceu_Distante_Cap01_Typeset.zip')).toBeVisible();
    await expect(delivery.getByRole('button', { name: /Substituir/i })).toBeVisible();

    await delivery.locator('input[type="file"][multiple]').setInputFiles([
      { name: 'Capitulo_84_Parte_1.txt', mimeType: 'text/plain', buffer: Buffer.from('parte 1') },
      { name: 'Capitulo_84_Parte_2.txt', mimeType: 'text/plain', buffer: Buffer.from('parte 2') },
      { name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('notas') }
    ]);

    await expect(delivery.locator('.upload-row')).toHaveCount(3);
    await expect(delivery.getByText('Capitulo_84_Parte_1.txt')).toBeVisible();
    await expect(delivery.getByText('Capitulo_84_Parte_2.txt')).toBeVisible();
    await expect.poll(() => uploadCount).toBe(3);
    await expect(delivery.locator('.success-icon')).toHaveCount(2);
    await expect(delivery.getByRole('button', { name: /Tentar novamente/i })).toBeVisible();
    await delivery.getByRole('button', { name: /Tentar novamente/i }).click();
    await expect.poll(() => uploadCount).toBe(4);
    await expect(delivery.locator('.success-icon')).toHaveCount(3);

    // Drag-and-drop accepts another batch without replacing the successful
    // files already in this delivery.
    await delivery.locator('.delivery-dropzone').evaluate((element) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(['drag one'], 'referencia_1.png', { type: 'image/png' }));
      transfer.items.add(new File(['drag two'], 'referencia_2.png', { type: 'image/png' }));
      element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });
    await expect(delivery.locator('.upload-row')).toHaveCount(5);
    await expect.poll(() => uploadCount).toBe(6);
    await expect(delivery.locator('.success-icon')).toHaveCount(5);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02b_pipeline_multifile_mobile.png`, fullPage: true });
    expect(errors).toEqual([]);
  });

  test('3. ScanHome canonical queues & unified active demands', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await setupScanHarness(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/qa-scan-proof?tab=home');
    await expect(page.locator('.workspace-overview-container')).toBeVisible();

    // The overview exposes only stages with work available, rather than seven
    // inert queue chips. Each advertised stage must remain actionable.
    const availableStages = page.locator('.available-stage-pill');
    await expect(availableStages).toHaveCount(3);

    // Click an available editorial stage -> should navigate to its workspace.
    await availableStages.filter({ hasText: 'Clean / Redraw' }).click();
    await expect(page.locator('.editorial-workspace-root')).toBeVisible();

    // Return to home
    await page.goto('/qa-scan-proof?tab=home');
    await expect(page.locator('.workspace-overview-container')).toBeVisible();

    // The active work card retains the work, chapter and stage identity.
    const myDemand = page.locator('.task-compact-card').first();
    await expect(myDemand).toBeVisible();
    await expect(myDemand).toContainText('Céu Distante');
    await expect(myDemand).toContainText('Capítulo 1');
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

  test('5b. Mobile navigation drawer is reachable, closes after navigation, and never overflows', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await setupScanHarness(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/qa-scan-proof?tab=pipeline&stage=typeset&drawer=1');
    const drawer = page.locator('.workspace-sidebar');
    await expect(drawer).toHaveClass(/mobile-open/);
    await expect(drawer.getByText('Project Nox', { exact: true })).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05b_mobile_drawer.png`, fullPage: true });

    await drawer.getByRole('button', { name: 'Chat', exact: true }).click();
    await expect(drawer).not.toHaveClass(/mobile-open/);
    await expect(page.locator('.chat-module-root')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    expect(errors).toEqual([]);
  });

  for (const vp of VIEWPORTS) {
    test(`6. Zero Horizontal Overflow across viewports: ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await setupScanHarness(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/qa-scan-proof?tab=pipeline&stage=clean_redraw');
      await expect(page.locator('.editorial-workspace-root')).toBeVisible();
      await expect(page.locator('.editorial-card.available-card').first()).toBeVisible();

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
