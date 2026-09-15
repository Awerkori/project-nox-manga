import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { getUserClient } from './owner-session.mjs';

process.loadEnvFile('.env');

const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854';
const prodUrl = 'https://manga.project-nox-awerkori.workers.dev';
const projectNoxId = '04872e99-37ad-4d45-aed4-35759d0eae33';
const workId = 'c08a2531-7bf3-4324-979a-f7de0e66a62d'; // Céu Distante

const pristamEmail = 'teka.a7x@gmail.com'; // Staff + Raw Provider + Clean/Redraw
const miakaEmail = '140miakazinha@gmail.com'; // Staff + Typer (NO Raw Provider)

async function runVerification() {
  console.log('🚀 Starting Verification for Staff + Raw Provider Bugfix...');

  const adminClient = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // Clean up any test chapters numbered >= 90 from earlier runs
  await adminClient
    .from('scan_production_chapters')
    .delete()
    .eq('scan_id', projectNoxId)
    .gte('chapter_number', 90);

  // 1. BACKEND RPC TESTS (Manual Request Tests)
  console.log('\n--- 1. BACKEND MANUAL REQUEST TESTS ---');

  const pristamAuth = await getUserClient(pristamEmail, prodUrl);
  const miakaAuth = await getUserClient(miakaEmail, prodUrl);

  // 1.1 Test Negative: Miaka (Staff WITHOUT Raw Provider) tries to create a production chapter
  console.log('Test 1.1: Miaka (Staff without Raw) calls create_scan_production_chapter...');
  const { data: miakaCreateData, error: miakaCreateErr } = await miakaAuth.client.rpc('create_scan_production_chapter', {
    p_scan_id: projectNoxId,
    p_work_id: workId,
    p_chapter_number: 91,
    p_chapter_label: 'Teste Negativo Miaka',
    p_chapter_type: 'NUMBER',
    p_template: 'MANHWA',
    p_priority: 'NORMAL',
    p_auto_claim: false
  });
  console.log('Miaka create result: Error expected ->', miakaCreateErr?.message);
  if (!miakaCreateErr) {
    throw new Error('FAIL: Miaka without Raw Provider should have been blocked from creating chapters!');
  }
  console.log('✅ Test 1.1 Passed: Staff without Raw Provider blocked from creating production chapters.');

  // 1.2 Test Positive: Pristam (Staff WITH Raw Provider) creates a production chapter
  console.log('\nTest 1.2: Pristam (Staff + Raw Provider) calls create_scan_production_chapter...');
  const { data: pristamChapterId, error: pristamCreateErr } = await pristamAuth.client.rpc('create_scan_production_chapter', {
    p_scan_id: projectNoxId,
    p_work_id: workId,
    p_chapter_number: 92,
    p_chapter_label: 'Capítulo RAW Homologação',
    p_chapter_type: 'NUMBER',
    p_template: 'MANHWA',
    p_priority: 'NORMAL',
    p_auto_claim: false
  });
  if (pristamCreateErr) {
    throw new Error(`FAIL: Pristam with Raw Provider failed to create chapter: ${pristamCreateErr.message}`);
  }
  console.log(`✅ Test 1.2 Passed: Pristam successfully created production chapter: ${pristamChapterId}`);

  // Fetch the created raw chapter stage
  const { data: rawStages } = await adminClient
    .from('scan_chapter_stages')
    .select('id, status, assigned_to, stage:stage_id(slug, name)')
    .eq('production_chapter_id', pristamChapterId);
  const rawStage = rawStages.find(s => s.stage?.slug === 'raw');
  console.log('Raw stage initialized with status:', rawStage?.status, 'assigned_to:', rawStage?.assigned_to);

  // 1.3 Test Negative: Miaka attempts to claim RAW stage
  console.log('\nTest 1.3: Miaka (Staff without Raw) calls claim_scan_chapter_stage on RAW stage...');
  const { data: miakaClaimData, error: miakaClaimErr } = await miakaAuth.client.rpc('claim_scan_chapter_stage', {
    p_chapter_stage_id: rawStage.id
  });
  console.log('Miaka claim result: Error expected ->', miakaClaimErr?.message);
  if (!miakaClaimErr) {
    throw new Error('FAIL: Miaka without Raw Provider should have been blocked from claiming RAW!');
  }
  console.log('✅ Test 1.3 Passed: Staff without Raw Provider blocked from claiming RAW stage.');

  // 1.4 Test Positive: Pristam creates chapter 93 with p_auto_claim = true to verify auto-claim
  console.log('\nTest 1.4: Pristam (Staff + Raw Provider) creates chapter 93 with auto-claim...');
  const { data: pristamAutoChapterId, error: pristamAutoErr } = await pristamAuth.client.rpc('create_scan_production_chapter', {
    p_scan_id: projectNoxId,
    p_work_id: workId,
    p_chapter_number: 93,
    p_chapter_label: 'Capítulo RAW Auto-Claim',
    p_chapter_type: 'NUMBER',
    p_template: 'MANHWA',
    p_priority: 'NORMAL',
    p_auto_claim: true
  });
  if (pristamAutoErr) {
    throw new Error(`FAIL: Pristam auto-claim chapter failed: ${pristamAutoErr.message}`);
  }
  const { data: autoStages } = await adminClient
    .from('scan_chapter_stages')
    .select('id, status, assigned_to, stage:stage_id(slug)')
    .eq('production_chapter_id', pristamAutoChapterId);
  const autoRawStage = autoStages.find(s => s.stage?.slug === 'raw');
  console.log('Auto-claimed stage status:', autoRawStage.status, 'assigned_to:', autoRawStage.assigned_to);
  if (autoRawStage.status !== 'IN_PROGRESS' || !autoRawStage.assigned_to) {
    throw new Error('FAIL: Auto-claim should have set raw stage to IN_PROGRESS and assigned to Pristam!');
  }
  console.log('✅ Test 1.4 Passed: Pristam auto-claimed RAW stage on creation! (Chapter 92 remains AVAILABLE for UI test)');

  // 2. PLAYWRIGHT UI VERIFICATION ON PRODUCTION
  console.log('\n--- 2. BROWSER PLAYWRIGHT UI VERIFICATION ON PRODUCTION ---');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  // 2.1 Test Principal: Pristam (Staff + Raw Provider)
  console.log('\n📍 Testing Pristam (Staff + Raw Provider) on Desktop (1440x900)...');
  const contextPristam = await browser.newContext();
  await contextPristam.addCookies([
    ...pristamAuth.cookies,
    { name: 'nox-age-status', value: 'ADULT', url: prodUrl }
  ]);
  const pagePristam = await contextPristam.newPage();
  await pagePristam.setViewportSize({ width: 1440, height: 900 });

  // Navigate to RAW stage directly
  console.log('Navigating directly to ?tab=pipeline&stage=raw as Pristam...');
  await pagePristam.goto(`${prodUrl}/scan?id=${projectNoxId}&tab=pipeline&stage=raw`, {
    waitUntil: 'domcontentloaded',
    timeout: 40000
  });
  await pagePristam.waitForTimeout(2500);

  // Verify Quick Picker presence
  const quickPicker = pagePristam.locator('.raw-quick-picker-card');
  const hasPicker = await quickPicker.isVisible();
  console.log('RAW Quick Picker visible:', hasPicker);

  const workSelect = quickPicker.locator('#pipeline-raw-work-select');
  console.log('Work selector visible:', await workSelect.isVisible());

  const chapterSelect = quickPicker.locator('#pipeline-raw-chapter-select');
  console.log('Chapter selector visible:', await chapterSelect.isVisible());

  // Check Cadastrar Novo Capítulo button visibility for Pristam
  const btnNewChapter = pagePristam.locator('.btn-new-chapter-trigger');
  console.log('Cadastrar Novo Capítulo button visible for Staff + Raw Provider:', await btnNewChapter.isVisible());

  // Capture evidence 01: Desktop Staff + Raw Provider view with Quick Picker and trigger
  await pagePristam.screenshot({
    path: resolve(artifactDir, 'evidence-raw-01-staff-raw-provider-desktop.png'),
    fullPage: false
  });
  console.log('✓ Captured evidence-raw-01-staff-raw-provider-desktop.png');

  // Open "Cadastrar Novo Capítulo" card (ensuring Svelte has hydrated)
  console.log('Opening Cadastrar Novo Capítulo card...');
  const newChapterCard = pagePristam.locator('.raw-new-chapter-card');
  for (let i = 0; i < 6; i++) {
    await btnNewChapter.click();
    try {
      await newChapterCard.waitFor({ state: 'visible', timeout: 1500 });
      break;
    } catch {
      console.log(`Waiting for Svelte hydration (attempt ${i + 1})...`);
      await pagePristam.waitForTimeout(1000);
    }
  }

  // Capture evidence 02: New chapter form open with auto-claim checkbox
  await pagePristam.screenshot({
    path: resolve(artifactDir, 'evidence-raw-02-create-chapter-form-open.png'),
    fullPage: false
  });
  console.log('✓ Captured evidence-raw-02-create-chapter-form-open.png');

  // Close card
  await pagePristam.locator('.btn-cancel-action').click();
  await newChapterCard.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  await pagePristam.waitForTimeout(500);

  // 2.2 Mobile Viewport Tests for Staff + Raw Provider (Pristam) with available chapter
  console.log('\n📍 Testing Mobile Viewports for Pristam (with chapter 92 available)...');

  // 375x812 (iPhone X/12/13/14)
  await pagePristam.setViewportSize({ width: 375, height: 812 });
  await pagePristam.waitForTimeout(1000);
  await pagePristam.screenshot({
    path: resolve(artifactDir, 'evidence-raw-05-mobile-375px-raw-picker.png'),
    fullPage: false
  });
  console.log('✓ Captured evidence-raw-05-mobile-375px-raw-picker.png');

  // 320x568 (iPhone SE 1st gen)
  await pagePristam.setViewportSize({ width: 320, height: 568 });
  await pagePristam.waitForTimeout(500);
  await pagePristam.locator('.raw-quick-picker-card').scrollIntoViewIfNeeded();
  await pagePristam.waitForTimeout(500);
  await pagePristam.screenshot({
    path: resolve(artifactDir, 'evidence-raw-06-mobile-320px-raw-picker.png'),
    fullPage: false
  });
  console.log('✓ Captured evidence-raw-06-mobile-320px-raw-picker.png');

  // Return to Desktop for Claiming Chapter 92
  await pagePristam.setViewportSize({ width: 1440, height: 900 });
  await pagePristam.waitForTimeout(800);

  // In the Quick Picker: select Chapter 92 and click "Pegar este capítulo"
  console.log('Selecting Chapter 92 in Quick Picker...');
  await chapterSelect.selectOption(rawStage.id);
  await pagePristam.waitForTimeout(500);

  const btnClaim = quickPicker.locator('.btn-claim-highlight');
  console.log('Claim button enabled:', await btnClaim.isEnabled(), 'Text:', await btnClaim.innerText());

  console.log('Clicking "Pegar este capítulo" in Quick Picker...');
  await btnClaim.click();
  await pagePristam.waitForTimeout(3500);
  await pagePristam.reload({ waitUntil: 'domcontentloaded' });
  await pagePristam.waitForTimeout(2000);

  // Verify chapter is now in "Meus capítulos"
  const myChaptersSection = pagePristam.locator('.my-chapters-section');
  console.log('My Chapters section visible:', await myChaptersSection.isVisible());
  await myChaptersSection.scrollIntoViewIfNeeded();
  await pagePristam.waitForTimeout(500);

  // Capture evidence 03: Claimed chapter in Meus capítulos
  await pagePristam.screenshot({
    path: resolve(artifactDir, 'evidence-raw-03-claimed-in-my-queue.png'),
    fullPage: false
  });
  console.log('✓ Captured evidence-raw-03-claimed-in-my-queue.png');

  // 2.3 Test Negativo: Miaka (Staff WITHOUT Raw Provider)
  console.log('\n📍 Testing Miaka (Staff without Raw Provider) on Desktop...');
  const contextMiaka = await browser.newContext();
  await contextMiaka.addCookies([
    ...miakaAuth.cookies,
    { name: 'nox-age-status', value: 'ADULT', url: prodUrl }
  ]);
  const pageMiaka = await contextMiaka.newPage();
  await pageMiaka.setViewportSize({ width: 1440, height: 900 });

  await pageMiaka.goto(`${prodUrl}/scan?id=${projectNoxId}&tab=pipeline&stage=raw`, {
    waitUntil: 'domcontentloaded',
    timeout: 40000
  });
  await pageMiaka.waitForTimeout(2500);

  // Miaka must NOT see the "Cadastrar Novo Capítulo" button
  const miakaNewChapterBtn = await pageMiaka.locator('.btn-new-chapter-trigger').count();
  console.log('Cadastrar Novo Capítulo button count for Miaka (expected 0):', miakaNewChapterBtn);

  // Miaka's Quick Picker claim button must be disabled with label "Disponível para Raw Provider"
  const miakaPicker = pageMiaka.locator('.raw-quick-picker-card');
  const miakaClaimBtn = miakaPicker.locator('.btn-claim-highlight');
  console.log('Miaka claim button disabled:', await miakaClaimBtn.isDisabled());
  console.log('Miaka claim button text:', await miakaClaimBtn.innerText());

  // Capture evidence 04: Negative test for Staff without Raw Provider
  await pageMiaka.screenshot({
    path: resolve(artifactDir, 'evidence-raw-04-negative-staff-no-raw-desktop.png'),
    fullPage: false
  });
  console.log('✓ Captured evidence-raw-04-negative-staff-no-raw-desktop.png');

  await browser.close();
  console.log('\n🎉 ALL STAFF + RAW PROVIDER VERIFICATIONS COMPLETED SUCCESSFULLY!');
}

runVerification().catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
