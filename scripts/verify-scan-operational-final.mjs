import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ownerCookies } from './owner-session.mjs';

const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854/scratch';
const prodUrl = 'https://manga.project-nox-awerkori.workers.dev';
const nexusScanId = '6c9b238c-4796-40a2-ae4a-6cad7cd4e378';

const viewports = [
  { label: '360px', width: 360, height: 800 },
  { label: '390px', width: 390, height: 844 },
  { label: '412px', width: 412, height: 915 },
  { label: '768px', width: 768, height: 1024 },
  { label: '1024px', width: 1024, height: 768 },
  { label: '1280px', width: 1280, height: 800 },
  { label: '1920px', width: 1920, height: 1080 }
];

async function checkOverflow(page) {
  return await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const scrollW = Math.max(html.scrollWidth, body.scrollWidth);
    const innerW = window.innerWidth;
    return {
      overflow: scrollW > innerW,
      scrollW,
      innerW
    };
  });
}

async function run() {
  console.log('=== STARTING SUPREME SCAN OPERATIONAL VERIFICATION ===');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const cookies = await ownerCookies(prodUrl);

  const context = await browser.newContext();
  await context.addCookies([
    ...cookies,
    { name: 'nox-age-status', value: 'ADULT', url: prodUrl }
  ]);
  const page = await context.newPage();

  const auditResults = [];

  // 1. Test Scan Workspace Tabs across 7 Viewports
  const scanTabs = [
    { id: 'home', name: 'Home' },
    { id: 'minha_fila', name: 'Minha Fila' },
    { id: 'chat', name: 'Chat Realtime' },
    { id: 'tutoriais', name: 'Academia & Tutoriais' },
    { id: 'settings', name: 'Branding & Configurações' }
  ];

  console.log('\n--- 1. Testing Scan Workspace Tabs across 7 Viewports ---');
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const tab of scanTabs) {
      const url = `${prodUrl}/scan?id=${nexusScanId}&tab=${tab.id}`;
      try {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
        await page.waitForTimeout(600);

        const status = resp ? resp.status() : 'unknown';
        const ofMetrics = await checkOverflow(page);

        const screenshotName = `scan-${tab.id}-${vp.label}.png`;
        const screenshotPath = resolve(artifactDir, screenshotName);
        await page.screenshot({ path: screenshotPath, fullPage: false });

        auditResults.push({
          area: 'scan-workspace',
          tab: tab.id,
          viewport: vp.label,
          width: vp.width,
          status,
          overflow: ofMetrics.overflow,
          scrollW: ofMetrics.scrollW,
          innerW: ofMetrics.innerW,
          screenshot: screenshotName
        });

        console.log(`  [${vp.label}] Tab "${tab.id}": HTTP ${status} | Overflow: ${ofMetrics.overflow} (${ofMetrics.scrollW}px / ${ofMetrics.innerW}px)`);
      } catch (err) {
        console.error(`  [${vp.label}] Tab "${tab.id}" ERROR:`, err.message);
        auditResults.push({
          area: 'scan-workspace',
          tab: tab.id,
          viewport: vp.label,
          error: err.message
        });
      }
    }
  }

  // 2. Test Global Admin /admin/scans across Viewports
  console.log('\n--- 2. Testing Global Admin (/admin/scans) and Supreme Delete Modal ---');
  for (const vp of [viewports[0], viewports[3], viewports[6]]) { // 360px, 768px, 1920px
    await page.setViewportSize({ width: vp.width, height: vp.height });
    try {
      const resp = await page.goto(`${prodUrl}/admin/scans`, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await page.waitForTimeout(600);
      const ofMetrics = await checkOverflow(page);
      const screenshotName = `admin-scans-${vp.label}.png`;
      await page.screenshot({ path: resolve(artifactDir, screenshotName), fullPage: false });
      console.log(`  [${vp.label}] /admin/scans: HTTP ${resp?.status()} | Overflow: ${ofMetrics.overflow}`);
    } catch (err) {
      console.error(`  [${vp.label}] /admin/scans ERROR:`, err.message);
    }
  }

  // Open Supreme Delete Modal on Desktop
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${prodUrl}/admin/scans`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(600);

  // Find delete button for Nexus Toons (class btn-icon delete or title containing Exclusão)
  const deleteBtn = page.locator('button.btn-icon.delete, button[title*="Exclusão Definitiva"]').first();
  if (await deleteBtn.count() > 0) {
    console.log('  Found Supreme Delete button, clicking to trigger confirmation modal...');
    await deleteBtn.click();
    await page.waitForTimeout(600);
    const modalScreenshot = resolve(artifactDir, 'admin-supreme-delete-modal.png');
    await page.screenshot({ path: modalScreenshot, fullPage: false });
    console.log(`  Modal opened and captured -> admin-supreme-delete-modal.png`);
  } else {
    console.warn('  ⚠️ Supreme Delete button not found on /admin/scans');
  }

  // 3. Test Specific Features in Workspace
  // 3a. Chat tab composer and elements
  console.log('\n--- 3. Testing Workspace Features Detail ---');
  await page.goto(`${prodUrl}/scan?id=${nexusScanId}&tab=chat`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(800);
  const composerExists = await page.locator('textarea.composer-textarea').count() > 0;
  const attachBtnExists = await page.locator('label.btn-composer-tool[title*="Anexar"]').count() > 0;
  const mentionBtnExists = await page.locator('button.btn-composer-tool[title*="Mencionar"]').count() > 0;
  console.log(`  Chat Composer (textarea.composer-textarea): ${composerExists ? 'PASS' : 'FAIL'}`);
  console.log(`  Chat Attachment button (label[title*="Anexar"]): ${attachBtnExists ? 'PASS' : 'FAIL'}`);
  console.log(`  Chat Mention button (button[title*="Mencionar"]): ${mentionBtnExists ? 'PASS' : 'FAIL'}`);
  await page.screenshot({ path: resolve(artifactDir, 'scan-chat-composer-verified.png'), fullPage: false });

  // 3b. Minha Fila queue selector
  await page.goto(`${prodUrl}/scan?id=${nexusScanId}&tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(600);
  const queueTabs = await page.$$eval('button:has-text("Disponíveis"), button:has-text("Meus Trabalhos"), button:has-text("Aguardando"), button:has-text("Visão Geral")', btns => btns.map(b => b.textContent.trim()));
  console.log(`  Pipeline Queue Tabs detected: ${JSON.stringify(queueTabs)}`);
  await page.screenshot({ path: resolve(artifactDir, 'scan-minha-fila-queues.png'), fullPage: false });

  // 3c. Academia formatting toolbar
  await page.goto(`${prodUrl}/scan?id=${nexusScanId}&tab=tutoriais`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(600);
  const newTutorialBtn = page.locator('button:has-text("Novo Tutorial")').first();
  if (await newTutorialBtn.count() > 0) {
    await newTutorialBtn.click();
    await page.waitForTimeout(500);
    const toolbarButtons = await page.$$eval('.editor-toolbar-row button', btns => btns.map(b => b.getAttribute('title') || b.textContent.trim()));
    console.log(`  Tutorial Formatting Toolbar buttons: ${JSON.stringify(toolbarButtons)}`);
    await page.screenshot({ path: resolve(artifactDir, 'scan-tutorial-editor.png'), fullPage: false });
    console.log('  Tutorial Editor opened and captured -> scan-tutorial-editor.png');
  }

  // 3d. Settings Branding Preview
  await page.goto(`${prodUrl}/scan?id=${nexusScanId}&tab=settings`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(600);
  const brandingSection = await page.locator('.branding-card').count() > 0;
  console.log(`  Branding Section Card detected: ${brandingSection ? 'PASS' : 'FAIL'}`);
  await page.screenshot({ path: resolve(artifactDir, 'scan-branding-settings.png'), fullPage: false });
  console.log('  Branding settings captured -> scan-branding-settings.png');

  // 4. Test Public Reader Before Deletion
  console.log('\n--- 4. Checking Public Reader Integrity Before Deletion ---');
  const obraResp = await page.goto(`${prodUrl}/obra/the-last-real-man`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  console.log(`  /obra/the-last-real-man: HTTP ${obraResp?.status()}`);

  // Find a chapter link
  const chapterLink = page.locator('a[href*="/ler/"]').first();
  let sampleChapterUrl = null;
  if (await chapterLink.count() > 0) {
    sampleChapterUrl = await chapterLink.getAttribute('href');
    if (!sampleChapterUrl.startsWith('http')) {
      sampleChapterUrl = `${prodUrl}${sampleChapterUrl}`;
    }
    const readerResp = await page.goto(sampleChapterUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    console.log(`  Public Reader ${sampleChapterUrl}: HTTP ${readerResp?.status()}`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: resolve(artifactDir, 'public-reader-before-delete.png'), fullPage: false });
  }

  // 5. Perform Supreme Delete of Nexus Toons
  console.log('\n--- 5. Executing Supreme Hard Delete of Scan "Nexus Toons" ---');
  await page.goto(`${prodUrl}/admin/scans`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(600);

  // Click Excluir Scan button
  const delBtn = page.locator('button.btn-icon.delete, button[title*="Exclusão Definitiva"]').first();
  if (await delBtn.count() > 0) {
    await delBtn.click();
    await page.waitForTimeout(500);

    // Fill exact scan name
    const confirmInput = page.locator('#hd-confirm');
    await confirmInput.fill('Nexus Toons');
    await page.waitForTimeout(300);

    // Reason input
    const reasonInput = page.locator('#hd-reason');
    if (await reasonInput.count() > 0) {
      await reasonInput.fill('Homologação final de exclusão definitiva sem impacto público');
    }

    await page.screenshot({ path: resolve(artifactDir, 'admin-delete-modal-filled.png'), fullPage: false });

    // Click confirm deletion button
    const confirmBtn = page.locator('button.btn-danger-confirm');
    console.log('  Submitting Supreme Hard Delete...');
    await confirmBtn.click();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: resolve(artifactDir, 'admin-scans-post-delete.png'), fullPage: false });
    console.log('  Hard delete submitted and page updated.');
  }

  // 6. Verify Public Reader AFTER Deletion (Must have 0 500 errors)
  console.log('\n--- 6. Verifying Public Reader Integrity AFTER Deletion ---');
  const obraAfterResp = await page.goto(`${prodUrl}/obra/the-last-real-man`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  console.log(`  /obra/the-last-real-man post-delete: HTTP ${obraAfterResp?.status()}`);
  await page.screenshot({ path: resolve(artifactDir, 'public-obra-after-delete.png'), fullPage: false });

  if (sampleChapterUrl) {
    const readerAfterResp = await page.goto(sampleChapterUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    console.log(`  Public Reader ${sampleChapterUrl} post-delete: HTTP ${readerAfterResp?.status()}`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: resolve(artifactDir, 'public-reader-after-delete.png'), fullPage: false });
  }

  await browser.close();

  console.log('\n================ SUMMARY ================');
  const overflows = auditResults.filter(r => r.overflow);
  console.log(`Total tab/viewport audits: ${auditResults.length}`);
  console.log(`Horizontal Overflows: ${overflows.length}`);
  if (overflows.length > 0) {
    console.warn('⚠️ Overflows found:', overflows);
  } else {
    console.log('✅ ZERO HORIZONTAL OVERFLOW ACROSS ALL 7 VIEWPORTS!');
  }
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
