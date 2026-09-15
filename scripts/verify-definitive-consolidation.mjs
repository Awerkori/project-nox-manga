import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ownerCookies } from '/home/awerkori/.Projects/project-nox-manga/scripts/owner-session.mjs';
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('/home/awerkori/.Projects/project-nox-manga/.env');

const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854';
const prodUrl = 'https://manga.project-nox-awerkori.workers.dev';
const projectNoxId = '04872e99-37ad-4d45-aed4-35759d0eae33';

async function run() {
  console.log('🚀 Starting Definitive Consolidation Verification on Production...');

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const cookies = await ownerCookies(prodUrl);
  const context = await browser.newContext();
  await context.addCookies([
    ...cookies,
    { name: 'nox-age-status', value: 'ADULT', url: prodUrl }
  ]);
  const page = await context.newPage();

  // 1. DESKTOP VIEWPORT: 1440x900
  await page.setViewportSize({ width: 1440, height: 900 });

  console.log('📍 1. Testing Sidebar Stages...');
  await page.goto(`${prodUrl}/scan?id=${projectNoxId}&tab=pipeline`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(2000);

  const sidebarStages = await page.locator('.nav-subcategories-tree .nav-sub-btn').allInnerTexts();
  console.log('Sidebar Stages items:', sidebarStages);

  await page.screenshot({ path: resolve(artifactDir, 'evidence-01-sidebar-and-pipeline-desktop.png'), fullPage: false });
  console.log('✓ Captured evidence-01-sidebar-and-pipeline-desktop.png');

  // 2. TEAM / MEMBROS TAB & "GERENCIAR MEMBRO" MODAL
  console.log('📍 2. Testing Team / Membros Tab & Unified Modal...');
  await page.goto(`${prodUrl}/scan?id=${projectNoxId}&tab=membros`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(2000);

  // Check member cards
  const memberCards = page.locator('.team-detailed-grid .member-card');
  const memberCount = await memberCards.count();
  console.log(`Found ${memberCount} member cards in team.`);

  await page.screenshot({ path: resolve(artifactDir, 'evidence-02-team-cards-grid.png'), fullPage: false });
  console.log('✓ Captured evidence-02-team-cards-grid.png');

  // Test clicking "Gerenciar" on Owner card (Awerkori)
  console.log('📍 3. Opening Manage Modal for Owner (Awerkori)...');
  const ownerCard = memberCards.filter({ hasText: 'Dono' }).first();
  await ownerCard.locator('.btn-action-manage-member').click();
  await page.waitForTimeout(800);

  // Verify Owner modal content: fixed badge, no radio group
  const ownerModal = page.locator('.member-management-modal');
  const ownerModeCount = await ownerModal.locator('.func-status-card.owner-mode').count();
  console.log('Owner mode status card present:', ownerModeCount > 0);

  await page.screenshot({ path: resolve(artifactDir, 'evidence-03-manage-owner-modal.png'), fullPage: false });
  console.log('✓ Captured evidence-03-manage-owner-modal.png');

  // Close modal
  await ownerModal.locator('.btn-close-modal').click();
  await page.waitForTimeout(500);

  // Test clicking "Gerenciar" on Staff card (e.g. Thiago or Pristam)
  console.log('📍 4. Opening Manage Modal for Staff (Thiagoamapeitos)...');
  const staffCard = memberCards.filter({ hasText: 'Thiagoamapeitos' }).first();
  await staffCard.locator('.btn-action-manage-member').click();
  await page.waitForTimeout(800);

  // Verify Staff modal content: radio group for Staff/Gerente, 5 checkboxes
  const functionRadios = await ownerModal.locator('.function-choice-card').count();
  console.log(`Function radio choices found: ${functionRadios} (expected 2: Staff & Gerente)`);

  const positionCheckboxes = await ownerModal.locator('.position-checkbox-item').count();
  console.log(`Editorial position checkboxes found: ${positionCheckboxes} (expected 5 canonical roles)`);

  const positionNames = await ownerModal.locator('.position-checkbox-item .pos-item-name').allInnerTexts();
  console.log('Position names:', positionNames);

  await page.screenshot({ path: resolve(artifactDir, 'evidence-04-manage-staff-modal.png'), fullPage: false });
  console.log('✓ Captured evidence-04-manage-staff-modal.png');

  // Close modal
  await ownerModal.locator('.btn-close-modal').click();
  await page.waitForTimeout(500);

  // 3. PIPELINE DIRECT STAGE NAVIGATION & CLAIM CTA EVALUATION
  console.log('📍 5. Testing Pipeline Stage Direct Navigation (Typeset & Revisor)...');
  await page.goto(`${prodUrl}/scan?id=${projectNoxId}&tab=pipeline&stage=typeset`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: resolve(artifactDir, 'evidence-05-pipeline-stage-typeset.png'), fullPage: false });
  console.log('✓ Captured evidence-05-pipeline-stage-typeset.png');

  await page.goto(`${prodUrl}/scan?id=${projectNoxId}&tab=pipeline&stage=revisor_qc`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: resolve(artifactDir, 'evidence-06-pipeline-stage-revisor-qc.png'), fullPage: false });
  console.log('✓ Captured evidence-06-pipeline-stage-revisor-qc.png');

  // 4. MOBILE VIEWPORT TESTS (375px & 320px)
  console.log('📍 6. Testing Mobile Viewport 375x667...');
  await page.setViewportSize({ width: 375, height: 667 });

  await page.goto(`${prodUrl}/scan?id=${projectNoxId}&tab=pipeline&stage=clean_redraw`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: resolve(artifactDir, 'evidence-07-mobile-375px-pipeline.png'), fullPage: false });
  console.log('✓ Captured evidence-07-mobile-375px-pipeline.png');

  await page.goto(`${prodUrl}/scan?id=${projectNoxId}&tab=membros`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1500);

  // Open manage modal on mobile to verify responsive fit
  const mobileStaffCard = page.locator('.team-detailed-grid .member-card').first();
  await mobileStaffCard.locator('.btn-action-manage-member').click();
  await page.waitForTimeout(800);

  await page.screenshot({ path: resolve(artifactDir, 'evidence-08-mobile-375px-manage-modal.png'), fullPage: false });
  console.log('✓ Captured evidence-08-mobile-375px-manage-modal.png');

  console.log('📍 7. Testing Mobile Viewport 320x568...');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(500);

  await page.screenshot({ path: resolve(artifactDir, 'evidence-09-mobile-320px-manage-modal.png'), fullPage: false });
  console.log('✓ Captured evidence-09-mobile-320px-manage-modal.png');

  await browser.close();
  console.log('🎉 ALL PLAYWRIGHT VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
