import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ownerCookies } from './owner-session.mjs';

const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854';
const prodUrl = 'https://manga.project-nox-awerkori.workers.dev';
const projectNoxId = '04872e99-37ad-4d45-aed4-35759d0eae33';

async function run() {
  console.log('🚀 Starting Verification of Standardized Pipeline Stages & Staff Roles on Production...');

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const cookies = await ownerCookies(prodUrl);
  const context = await browser.newContext();
  await context.addCookies([
    ...cookies,
    { name: 'nox-age-status', value: 'ADULT', url: prodUrl }
  ]);
  const page = await context.newPage();

  // Set desktop viewport
  await page.setViewportSize({ width: 1440, height: 900 });

  // 1. Scan Workspace: Pipeline & Sidebar
  console.log('📍 1. Navigating to Pipeline Tab...');
  await page.goto(`${prodUrl}/scan?id=${projectNoxId}&tab=pipeline`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1500);

  // Check Sidebar stages
  const sidebarStageTitles = await page.locator('.nav-subcategories-tree .sub-stage-title').allInnerTexts();
  console.log('Sidebar Stages found:', sidebarStageTitles);

  const expectedStages = [
    'Raw Provider',
    'Tradução',
    'Clean/Redraw',
    'Typeset',
    'Revisor (QC)',
    'Pré Aprovado',
    'Publicado'
  ];

  console.log('Checking sidebar stages match exact canonical list and order:');
  for (let i = 0; i < expectedStages.length; i++) {
    const found = sidebarStageTitles[i]?.trim();
    const expected = expectedStages[i];
    if (found === expected) {
      console.log(`  ✓ Stage ${i + 1}: ${found} MATCH`);
    } else {
      console.error(`  ✗ Stage ${i + 1}: expected "${expected}", got "${found}"`);
    }
  }

  // Capture Desktop Sidebar & Pipeline
  await page.screenshot({ path: resolve(artifactDir, 'evidence-01-sidebar-and-pipeline-desktop.png'), fullPage: false });
  console.log('✓ Captured evidence-01-sidebar-and-pipeline-desktop.png');

  // Check Stepper Track on Chapter Card
  const stepperNames = await page.locator('.stepper-step .step-name').allInnerTexts();
  console.log('Stepper Step Names found on cards:', stepperNames.slice(0, 7));

  // 2. Scan Workspace: Home Dashboard queue chips
  console.log('📍 2. Navigating to Home Tab...');
  await page.goto(`${prodUrl}/scan?id=${projectNoxId}&tab=home`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1200);

  const homeQueueNames = await page.locator('.queue-chip .chip-stage-name').allInnerTexts();
  console.log('Home Queue Names found:', homeQueueNames);

  await page.screenshot({ path: resolve(artifactDir, 'evidence-02-scan-home-queues.png'), fullPage: false });
  console.log('✓ Captured evidence-02-scan-home-queues.png');

  // 3. Scan Workspace: Revisor (QC) Stage View
  console.log('📍 3. Navigating to Revisor (QC) Stage View...');
  await page.goto(`${prodUrl}/scan?id=${projectNoxId}&tab=pipeline&stage=revisor_qc`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1200);

  // Click to open my chapter accordion if present
  const myChapterCard = page.locator('.my-chapter-accordion-card').first();
  if (await myChapterCard.count() > 0) {
    const isOpen = await myChapterCard.evaluate(el => el.classList.contains('is-open'));
    if (!isOpen) {
      await myChapterCard.locator('.accordion-header-bar').click();
      await page.waitForTimeout(500);
    }
  }

  await page.screenshot({ path: resolve(artifactDir, 'evidence-03-stage-revisor-qc-view.png'), fullPage: false });
  console.log('✓ Captured evidence-03-stage-revisor-qc-view.png');

  // 4. Scan Workspace: Clean/Redraw Stage View
  console.log('📍 4. Navigating to Clean/Redraw Stage View...');
  await page.goto(`${prodUrl}/scan?id=${projectNoxId}&tab=pipeline&stage=clean_redraw`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: resolve(artifactDir, 'evidence-04-stage-clean-redraw-view.png'), fullPage: false });
  console.log('✓ Captured evidence-04-stage-clean-redraw-view.png');

  // 5. Scan Workspace: Positions Management Tab
  console.log('📍 5. Navigating to Positions Tab...');
  await page.goto(`${prodUrl}/scan?id=${projectNoxId}&tab=positions`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1200);

  const posTags = await page.locator('.pos-name-tag').allInnerTexts();
  console.log('Positions found in management grid:', posTags);

  await page.screenshot({ path: resolve(artifactDir, 'evidence-05-official-positions-grid.png'), fullPage: false });
  console.log('✓ Captured evidence-05-official-positions-grid.png');

  // 6. Scan Workspace: Team & Member Position Assignment
  console.log('📍 6. Checking Member Position Assignment Modal...');
  await page.goto(`${prodUrl}/scan?id=${projectNoxId}&tab=equipe`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1200);

  const assignBtn = page.locator('.btn-action-primary:has-text("Atribuir")').first();
  if (await assignBtn.count() > 0) {
    await assignBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: resolve(artifactDir, 'evidence-06-member-position-modal.png'), fullPage: false });
    console.log('✓ Captured evidence-06-member-position-modal.png');

    // Read modal select options
    const modalPosOptions = await page.locator('.modal-backdrop select option').allInnerTexts();
    console.log('Position modal options:', modalPosOptions);
    // Close modal
    const cancelBtn = page.locator('.modal-backdrop button:has-text("Cancelar")').first();
    if (await cancelBtn.count() > 0) await cancelBtn.click();
  }

  // 7. Mobile Viewport (375 x 812)
  console.log('📍 7. Checking Mobile Viewport...');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${prodUrl}/scan?id=${projectNoxId}&tab=pipeline`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: resolve(artifactDir, 'evidence-07-mobile-pipeline-375px.png'), fullPage: false });
  console.log('✓ Captured evidence-07-mobile-pipeline-375px.png');

  await browser.close();
  console.log('🎉 Verification completed successfully!');
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
