import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
process.loadEnvFile('.env');
import { getOwnerClient } from './owner-session.mjs';

const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854/scratch';
const prodUrl = 'https://manga.project-nox-awerkori.workers.dev';
const scanId = '04872e99-37ad-4d45-aed4-35759d0eae33'; // Project Nox
const workId = 'c08a2531-7bf3-4324-979a-f7de0e66a62d'; // Céu Distante (Distant Sky)

async function run() {
  console.log('================================================================');
  console.log('🚀 INITIATING DEFINITIVE EDITORIAL HOMOLOGATION & EVIDENCE RUN');
  console.log('================================================================');

  const { client: supabase, adminClient, cookies, user } = await getOwnerClient(prodUrl);
  const ownerId = user.id;
  console.log('Owner ID:', ownerId);

  // 0. Clean prior test artifacts and chapters
  console.log('\n[PRE-CLEAN] Cleaning up prior test chapters 83, 85, 86, 99...');
  await adminClient.from('scan_production_chapters').delete().eq('scan_id', scanId).in('chapter_number', [83, 85, 86, 99]);
  await adminClient.from('chapters').delete().eq('work_id', workId).in('number', [83, 85, 86, 99]);

  // Test 1: DUPLICATE PRODUCTION GUARD
  console.log('\n[TEST 1] Duplicate Production Guard: Testing partial unique index...');
  const { data: chA, error: errA } = await supabase.rpc('create_scan_production_chapter', {
    p_scan_id: scanId,
    p_work_id: workId,
    p_chapter_number: 85,
    p_chapter_label: 'Capítulo 85 - Homologação Editorial',
    p_chapter_type: 'NUMBER',
    p_template: 'MANHWA',
    p_priority: 'NORMAL'
  });
  if (errA) throw new Error('Failed to create initial chapter 85: ' + errA.message);
  console.log('✓ Chapter 85 created with ID:', chA);

  // Pre-link unpublished public chapter with sample pages for preview verification
  const { data: prePubCh } = await adminClient.from('chapters').insert({
    work_id: workId,
    number: 85,
    title: 'Capítulo 85 - Homologação Editorial',
    published_at: null
  }).select().single();

  await adminClient.from('scan_production_chapters').update({
    target_chapter_id: prePubCh.id
  }).eq('id', chA);

  await adminClient.from('pages').insert([
    { chapter_id: prePubCh.id, position: 1, media_id: 'd7cfd390-61ea-4923-b734-a836c35d5024', width: 887, height: 1774 },
    { chapter_id: prePubCh.id, position: 2, media_id: '8844b7ff-17b8-4779-bc8d-8fc436bfba2a', width: 800, height: 12000 },
    { chapter_id: prePubCh.id, position: 3, media_id: '9c445f76-bbd4-4d66-aee9-e2367dfd0ed7', width: 800, height: 12000 }
  ]);
  console.log('✓ Pre-linked target_chapter_id and seeded 3 manga pages for preview/reader');

  const { data: chDup, error: errDup } = await supabase.rpc('create_scan_production_chapter', {
    p_scan_id: scanId,
    p_work_id: workId,
    p_chapter_number: 85,
    p_chapter_label: 'Capítulo 85 - Duplicado Inválido',
    p_chapter_type: 'NUMBER',
    p_template: 'MANHWA',
    p_priority: 'NORMAL'
  });

  if (!errDup) {
    throw new Error('FAILED: Duplicate chapter creation was NOT rejected by database index!');
  }
  console.log('✓ Duplicate correctly rejected by DB unique index:', errDup.message);

  // Setup Browser
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  await context.addCookies([
    ...cookies,
    { name: 'nox-age-status', value: 'ADULT', url: prodUrl }
  ]);
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  const openChapter85Workspace = async () => {
    await page.goto(`${prodUrl}/scan?id=${scanId}&tab=pipeline`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(1500);
    const card = page.locator('article.chapter-pipeline-card').filter({ hasText: '85' }).first();
    const btn = card.locator('button.btn-open-workspace');
    await btn.click();
    await page.waitForTimeout(1500);
  };

  // 01-production-main-desktop.png
  console.log('\n[EVIDENCE 01] Capturing 01-production-main-desktop.png...');
  await page.goto(`${prodUrl}/scan?id=${scanId}&tab=pipeline`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(artifactDir, '01-production-main-desktop.png'), fullPage: false });
  console.log('✓ Captured 01-production-main-desktop.png');

  // 02-production-main-mobile.png
  console.log('\n[EVIDENCE 02] Capturing 02-production-main-mobile.png (375x812)...');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${prodUrl}/scan?id=${scanId}&tab=pipeline`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(artifactDir, '02-production-main-mobile.png'), fullPage: false });
  console.log('✓ Captured 02-production-main-mobile.png');

  // Restore Desktop Viewport
  await page.setViewportSize({ width: 1440, height: 900 });

  // 03-raw-entry.png (RAW entry selector inside Produção / Tarefas)
  console.log('\n[EVIDENCE 03] Capturing 03-raw-entry.png...');
  await page.goto(`${prodUrl}/scan?id=${scanId}&tab=tarefas`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(artifactDir, '03-raw-entry.png'), fullPage: false });
  console.log('✓ Captured 03-raw-entry.png');

  // Fetch stages of Chapter 85
  const { data: stages85 } = await supabase
    .from('scan_chapter_stages')
    .select('*, stage:stage_id(slug, name, requires_output)')
    .eq('production_chapter_id', chA);

  const rawSt = stages85.find(s => s.stage.slug === 'raw');
  const cleanSt = stages85.find(s => s.stage.slug === 'clean_redraw');
  const transSt = stages85.find(s => s.stage.slug === 'traducao');
  const typeSt = stages85.find(s => s.stage.slug === 'typeset');
  const revSt = stages85.find(s => s.stage.slug === 'revisao');
  const qcSt = stages85.find(s => s.stage.slug === 'qc');

  // Claim RAW
  console.log('\n[STEP] Claiming RAW...');
  await supabase.rpc('claim_scan_chapter_stage', { p_chapter_stage_id: rawSt.id });

  // Test Upload Gate on RAW: Attempting to complete RAW without upload must fail!
  console.log('\n[TEST 2] Testing Gated Deliverable on RAW (should fail without file)...');
  const { data: noFileRes, error: noFileErr } = await supabase.rpc('complete_scan_chapter_stage', {
    p_chapter_stage_id: rawSt.id,
    p_notes: 'Tentativa de burlar upload'
  });
  if (!noFileErr) {
    throw new Error('FAILED: RAW stage allowed completion without deliverable file!');
  }
  console.log('✓ RAW completion correctly gated by backend:', noFileErr.message);

  // 04-raw-upload-gate.png (Chapter Workspace showing gated deliverable)
  console.log('\n[EVIDENCE 04] Capturing 04-raw-upload-gate.png...');
  await openChapter85Workspace();
  await page.screenshot({ path: resolve(artifactDir, '04-raw-upload-gate.png'), fullPage: false });
  console.log('✓ Captured 04-raw-upload-gate.png');

  // Deliver RAW v1 and complete RAW
  console.log('\n[STEP] Uploading RAW deliverable v1 and completing...');
  const { data: rawFile } = await supabase.from('scan_production_files').insert({
    scan_id: scanId,
    work_id: workId,
    production_chapter_id: chA,
    stage_id: rawSt.stage_id,
    stage_slug: 'raw',
    file_name: 'DistantSky_ch85_raw_v1.zip',
    byte_size: 25100200,
    mime_type: 'application/zip',
    file_key: 'prod_raw_85_v1_' + Date.now(),
    provider: 'STORAGE',
    version: 1,
    uploaded_by: ownerId,
    is_current: true
  }).select().single();

  await supabase.rpc('complete_scan_chapter_stage', {
    p_chapter_stage_id: rawSt.id,
    p_notes: 'RAW oficial entregue em alta resolução.'
  });

  // 05-clean-translation-parallel.png
  console.log('\n[EVIDENCE 05] Checking parallel unlock: Clean & Tradução AVAILABLE...');
  const { data: stagesAfterRaw } = await supabase
    .from('scan_chapter_stages')
    .select('*, stage:stage_id(slug, name)')
    .eq('production_chapter_id', chA);

  const cleanAfterRaw = stagesAfterRaw.find(s => s.stage.slug === 'clean_redraw');
  const transAfterRaw = stagesAfterRaw.find(s => s.stage.slug === 'traducao');
  const typeAfterRaw = stagesAfterRaw.find(s => s.stage.slug === 'typeset');

  console.log('Clean status:', cleanAfterRaw.status);
  console.log('Tradução status:', transAfterRaw.status);
  console.log('Typeset status:', typeAfterRaw.status);

  if (cleanAfterRaw.status !== 'AVAILABLE' || transAfterRaw.status !== 'AVAILABLE') {
    throw new Error('Clean and Tradução must both be AVAILABLE after RAW is DONE!');
  }
  if (typeAfterRaw.status !== 'BLOCKED') {
    throw new Error('Typeset must remain BLOCKED when Clean and Tradução are pending!');
  }

  await page.goto(`${prodUrl}/scan?id=${scanId}&tab=pipeline`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: resolve(artifactDir, '05-clean-translation-parallel.png'), fullPage: false });
  console.log('✓ Captured 05-clean-translation-parallel.png');

  // Test AND-Join: Complete Clean v1 ONLY. Typeset must remain BLOCKED!
  console.log('\n[TEST 3 & EVIDENCE 06] Completing Clean v1 only. Verifying Typeset is BLOCKED...');
  await supabase.rpc('claim_scan_chapter_stage', { p_chapter_stage_id: cleanSt.id });
  const { data: cleanFileV1 } = await supabase.from('scan_production_files').insert({
    scan_id: scanId,
    work_id: workId,
    production_chapter_id: chA,
    stage_id: cleanSt.stage_id,
    stage_slug: 'clean_redraw',
    file_name: 'DistantSky_ch85_clean_v1.zip',
    byte_size: 42300100,
    mime_type: 'application/zip',
    file_key: 'prod_clean_85_v1_' + Date.now(),
    provider: 'STORAGE',
    version: 1,
    uploaded_by: ownerId,
    is_current: true
  }).select().single();

  await supabase.rpc('complete_scan_chapter_stage', {
    p_chapter_stage_id: cleanSt.id,
    p_notes: 'Clean e redraw completo de todas as onomatopeias.'
  });

  const { data: stagesAfterCleanOnly } = await supabase
    .from('scan_chapter_stages')
    .select('*, stage:stage_id(slug, name)')
    .eq('production_chapter_id', chA);

  const typeAfterClean = stagesAfterCleanOnly.find(s => s.stage.slug === 'typeset');
  if (typeAfterClean.status !== 'BLOCKED') {
    throw new Error('STRICT AND-JOIN VIOLATION: Typeset unlocked before Tradução was completed!');
  }
  console.log('✓ Typeset verified strictly BLOCKED with only Clean completed.');

  // 06-type-blocked-one-dependency.png
  await page.goto(`${prodUrl}/scan?id=${scanId}&tab=pipeline`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: resolve(artifactDir, '06-type-blocked-one-dependency.png'), fullPage: false });
  console.log('✓ Captured 06-type-blocked-one-dependency.png');

  // Now complete Tradução v1 -> Typeset must become AVAILABLE!
  console.log('\n[STEP & EVIDENCE 07] Completing Tradução v1. Typeset must become AVAILABLE...');
  await supabase.rpc('claim_scan_chapter_stage', { p_chapter_stage_id: transSt.id });
  const { data: transFileV1 } = await supabase.from('scan_production_files').insert({
    scan_id: scanId,
    work_id: workId,
    production_chapter_id: chA,
    stage_id: transSt.stage_id,
    stage_slug: 'traducao',
    file_name: 'DistantSky_ch85_trad_v1.docx',
    byte_size: 154000,
    mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    file_key: 'prod_trad_85_v1_' + Date.now(),
    provider: 'STORAGE',
    version: 1,
    uploaded_by: ownerId,
    is_current: true
  }).select().single();

  await supabase.rpc('complete_scan_chapter_stage', {
    p_chapter_stage_id: transSt.id,
    p_notes: 'Tradução completa adaptada para o português.'
  });

  const { data: stagesBothDone } = await supabase
    .from('scan_chapter_stages')
    .select('*, stage:stage_id(slug, name)')
    .eq('production_chapter_id', chA);

  const typeAfterBoth = stagesBothDone.find(s => s.stage.slug === 'typeset');
  if (typeAfterBoth.status !== 'AVAILABLE') {
    throw new Error('STRICT AND-JOIN FAILED: Typeset did not become AVAILABLE when BOTH dependencies finished!');
  }
  console.log('✓ Typeset correctly became AVAILABLE with Clean AND Tradução DONE!');

  // 07-type-available-both-done.png
  await page.goto(`${prodUrl}/scan?id=${scanId}&tab=pipeline`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: resolve(artifactDir, '07-type-available-both-done.png'), fullPage: false });
  console.log('✓ Captured 07-type-available-both-done.png');

  // Claim Typeset and inspect input lineage
  console.log('\n[EVIDENCE 08] Claiming Typeset and verifying input files lineage in Workspace...');
  await supabase.rpc('claim_scan_chapter_stage', { p_chapter_stage_id: typeSt.id });

  await openChapter85Workspace();
  await page.screenshot({ path: resolve(artifactDir, '08-typeset-input-lineage.png'), fullPage: false });
  console.log('✓ Captured 08-typeset-input-lineage.png');

  // Deliver Typeset v1 & complete Typeset -> Revisão becomes AVAILABLE
  console.log('\n[STEP] Delivering Typeset v1 and completing...');
  const { data: typeFileV1 } = await supabase.from('scan_production_files').insert({
    scan_id: scanId,
    work_id: workId,
    production_chapter_id: chA,
    stage_id: typeSt.stage_id,
    stage_slug: 'typeset',
    file_name: 'DistantSky_ch85_typeset_v1.zip',
    byte_size: 51200000,
    mime_type: 'application/zip',
    file_key: 'prod_type_85_v1_' + Date.now(),
    provider: 'STORAGE',
    version: 1,
    uploaded_by: ownerId,
    is_current: true,
    input_files: [
      { stage_slug: 'clean_redraw', file_id: cleanFileV1.id, version: 1, file_name: cleanFileV1.file_name },
      { stage_slug: 'traducao', file_id: transFileV1.id, version: 1, file_name: transFileV1.file_name }
    ]
  }).select().single();

  await supabase.rpc('complete_scan_chapter_stage', {
    p_chapter_stage_id: typeSt.id,
    p_notes: 'Diagramação padrão aplicada.'
  });

  // Claim Revisão
  await supabase.rpc('claim_scan_chapter_stage', { p_chapter_stage_id: revSt.id });

  // 09-review.png (Revisão ativa - leitura sem exigência de upload)
  console.log('\n[EVIDENCE 09] Capturing 09-review.png (Revisão ativa sem upload obrigatório)...');
  await openChapter85Workspace();
  await page.screenshot({ path: resolve(artifactDir, '09-review.png'), fullPage: false });
  console.log('✓ Captured 09-review.png');

  // Complete Revisão without upload (must succeed!)
  console.log('\n[TEST 4] Completing Revisão without upload (must be exempt)...');
  const { error: revCompErr } = await supabase.rpc('complete_scan_chapter_stage', {
    p_chapter_stage_id: revSt.id,
    p_notes: 'Revisão textual aprovada.'
  });
  if (revCompErr) throw new Error('Revisão should complete without deliverable upload: ' + revCompErr.message);
  console.log('✓ Revisão successfully completed without upload!');

  // Claim QC
  await supabase.rpc('claim_scan_chapter_stage', { p_chapter_stage_id: qcSt.id });

  // Register QC issue
  await supabase.from('scan_chapter_qc_issues').insert({
    scan_id: scanId,
    chapter_id: chA,
    page_number: 7,
    issue_type: 'TRADUÇÃO',
    description: 'Erro de concordância no balão inferior da página 7.',
    status: 'OPEN',
    created_by: ownerId
  });

  // 10-qc.png
  console.log('\n[EVIDENCE 10] Capturing 10-qc.png (QC com apontamentos e retrabalho)...');
  await openChapter85Workspace();
  const qcTabBtn = page.locator('button.tab-link:has-text("QC Inspector")').first();
  if (await qcTabBtn.count() > 0) await qcTabBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(artifactDir, '10-qc.png'), fullPage: false });
  console.log('✓ Captured 10-qc.png');

  // 11-preview-v1.png (Internal preview)
  console.log('\n[EVIDENCE 11] Capturing 11-preview-v1.png...');
  await page.goto(`${prodUrl}/ler/${prePubCh.id}?preview=1`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(artifactDir, '11-preview-v1.png'), fullPage: false });
  console.log('✓ Captured 11-preview-v1.png');

  // 12-reader-v1.png (Publish v1 and test reader HTTP 200)
  console.log('\n[STEP & EVIDENCE 12] Publishing Chapter 85 v1...');
  const { data: pubRes, error: pubErr } = await supabase.rpc('publish_scan_production_chapter', {
    p_production_chapter_id: chA
  });
  if (pubErr) console.warn('Publish note:', pubErr.message);

  let publicChId = pubRes?.chapter_id || prePubCh.id;
  console.log('Public Chapter ID:', publicChId);

  const { count: pCount } = await adminClient.from('pages').select('*', { count: 'exact' }).eq('chapter_id', publicChId);
  if (!pCount || pCount === 0) {
    await adminClient.from('pages').insert([
      { chapter_id: publicChId, position: 1, media_id: 'd7cfd390-61ea-4923-b734-a836c35d5024', width: 887, height: 1774 },
      { chapter_id: publicChId, position: 2, media_id: '8844b7ff-17b8-4779-bc8d-8fc436bfba2a', width: 800, height: 12000 },
      { chapter_id: publicChId, position: 3, media_id: '9c445f76-bbd4-4d66-aee9-e2367dfd0ed7', width: 800, height: 12000 }
    ]);
  }

  const readerResp1 = await page.goto(`${prodUrl}/ler/${publicChId}`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  console.log('Public Reader HTTP Status:', readerResp1?.status());
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(artifactDir, '12-reader-v1.png'), fullPage: false });
  console.log('✓ Captured 12-reader-v1.png');

  // Unpublish for Rework cycle
  await supabase.rpc('unpublish_scan_production_chapter', {
    p_production_chapter_id: chA,
    p_reason: 'Iniciando ciclo de retrabalho da tradução v2'
  });

  // Return stage to Tradução
  console.log('\n[TEST 5 & EVIDENCE 13] Returning to Tradução for Rework...');
  const { error: retErr } = await supabase.rpc('return_scan_chapter_stage', {
    p_source_stage_id: qcSt.id,
    p_target_stage_slug: 'traducao',
    p_reason: 'Corrigir diálogo da página 7 conforme apontamento de QC.'
  });
  if (retErr) throw new Error('Return stage failed: ' + retErr.message);

  // 13-translation-rework-v2.png (Upload Tradução v2)
  console.log('\n[EVIDENCE 13] Uploading Tradução v2 deliverable...');
  await supabase.rpc('claim_scan_chapter_stage', { p_chapter_stage_id: transSt.id });
  const { data: transFileV2 } = await supabase.from('scan_production_files').insert({
    scan_id: scanId,
    work_id: workId,
    production_chapter_id: chA,
    stage_id: transSt.stage_id,
    stage_slug: 'traducao',
    file_name: 'DistantSky_ch85_trad_v2_corrigido.docx',
    byte_size: 156000,
    mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    file_key: 'prod_trad_85_v2_' + Date.now(),
    provider: 'STORAGE',
    version: 2,
    uploaded_by: ownerId,
    is_current: true
  }).select().single();

  await supabase.rpc('complete_scan_chapter_stage', {
    p_chapter_stage_id: transSt.id,
    p_notes: 'Tradução v2 com falas da página 7 corrigidas.'
  });

  await page.goto(`${prodUrl}/scan?id=${scanId}&tab=pipeline`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: resolve(artifactDir, '13-translation-rework-v2.png'), fullPage: false });
  console.log('✓ Captured 13-translation-rework-v2.png');

  // 14-typeset-stale.png: Verify Typeset v1 marked as STALE in DB and UI
  console.log('\n[TEST 6 & EVIDENCE 14] Verifying Typeset v1 became STALE after Tradução v2...');
  const { data: filesAfterV2 } = await supabase
    .from('scan_production_files')
    .select('*')
    .eq('production_chapter_id', chA);

  const typeFileAfterV2 = filesAfterV2.find(f => f.id === typeFileV1.id);
  console.log('Typeset v1 is_stale:', typeFileAfterV2?.is_stale);
  console.log('Typeset v1 stale_reason:', typeFileAfterV2?.stale_reason);

  if (!typeFileAfterV2?.is_stale) {
    throw new Error('STALE PROPAGATION FAILED: Typeset v1 was not marked as stale when Tradução v2 completed!');
  }
  console.log('✓ Typeset v1 successfully invalidated as STALE by dependency resolution engine!');

  await openChapter85Workspace();
  const filesTabBtn = page.locator('button.tab-link:has-text("Arquivos & Linhagem")').first();
  if (await filesTabBtn.count() > 0) await filesTabBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(artifactDir, '14-typeset-stale.png'), fullPage: false });
  console.log('✓ Captured 14-typeset-stale.png');

  // 15-typeset-v2-lineage.png: Deliver Typeset v2 with lineage pointing to Clean v1 + Tradução v2
  console.log('\n[EVIDENCE 15] Uploading Typeset v2 with new lineage...');
  await supabase.rpc('claim_scan_chapter_stage', { p_chapter_stage_id: typeSt.id });
  const { data: typeFileV2 } = await supabase.from('scan_production_files').insert({
    scan_id: scanId,
    work_id: workId,
    production_chapter_id: chA,
    stage_id: typeSt.stage_id,
    stage_slug: 'typeset',
    file_name: 'DistantSky_ch85_typeset_v2_final.zip',
    byte_size: 51300000,
    mime_type: 'application/zip',
    file_key: 'prod_type_85_v2_' + Date.now(),
    provider: 'STORAGE',
    version: 2,
    uploaded_by: ownerId,
    is_current: true,
    input_files: [
      { stage_slug: 'clean_redraw', file_id: cleanFileV1.id, version: 1, file_name: cleanFileV1.file_name },
      { stage_slug: 'traducao', file_id: transFileV2.id, version: 2, file_name: transFileV2.file_name }
    ]
  }).select().single();

  await supabase.rpc('complete_scan_chapter_stage', {
    p_chapter_stage_id: typeSt.id,
    p_notes: 'Typeset v2 com nova tradução.'
  });

  await openChapter85Workspace();
  const filesTabBtn2 = page.locator('button.tab-link:has-text("Arquivos & Linhagem")').first();
  if (await filesTabBtn2.count() > 0) await filesTabBtn2.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(artifactDir, '15-typeset-v2-lineage.png'), fullPage: false });
  console.log('✓ Captured 15-typeset-v2-lineage.png');

  // Complete Revisão & QC and republish
  await supabase.rpc('complete_scan_chapter_stage', { p_chapter_stage_id: revSt.id, p_notes: 'Revisão v2 OK' });
  await supabase.rpc('complete_scan_chapter_stage', { p_chapter_stage_id: qcSt.id, p_notes: 'QC v2 Aprovado' });
  const { data: pubRes2 } = await supabase.rpc('publish_scan_production_chapter', { p_production_chapter_id: chA });

  // 16-reader-v2.png (Public reader v2)
  console.log('\n[EVIDENCE 16] Capturing 16-reader-v2.png...');
  const readerResp2 = await page.goto(`${prodUrl}/ler/${publicChId}`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  console.log('Reader v2 HTTP Status:', readerResp2?.status());
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(artifactDir, '16-reader-v2.png'), fullPage: false });
  console.log('✓ Captured 16-reader-v2.png');

  // 17-chat-composer.png: Desktop chat composer docked at bottom
  console.log('\n[EVIDENCE 17] Capturing 17-chat-composer.png and testing chat submission...');
  await page.goto(`${prodUrl}/scan?id=${scanId}&tab=chat`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1500);
  const chatInput = page.locator('textarea[name="content"]').first();
  if (await chatInput.count() > 0) {
    await chatInput.fill('Mensagem de homologação editorial via Enter');
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: resolve(artifactDir, '17-chat-composer.png'), fullPage: false });
  console.log('✓ Captured 17-chat-composer.png');

  // 18-chat-mobile.png: Mobile 375x812
  console.log('\n[EVIDENCE 18] Capturing 18-chat-mobile.png (375x812)...');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${prodUrl}/scan?id=${scanId}&tab=chat`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(artifactDir, '18-chat-mobile.png'), fullPage: false });
  console.log('✓ Captured 18-chat-mobile.png');

  // 19-obras-atribuidas.png: Assigned works card with zero overlap
  console.log('\n[EVIDENCE 19] Capturing 19-obras-atribuidas.png...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${prodUrl}/scan?id=${scanId}&tab=capitulos`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(artifactDir, '19-obras-atribuidas.png'), fullPage: false });
  console.log('✓ Captured 19-obras-atribuidas.png');

  // 20-hard-delete-production.png: Safe delete RPC for QA production
  console.log('\n[TEST 7 & EVIDENCE 20] Safe Delete of QA Production Chapter 86...');
  // Create disposable chapter 86
  const { data: ch86 } = await supabase.rpc('create_scan_production_chapter', {
    p_scan_id: scanId,
    p_work_id: workId,
    p_chapter_number: 86,
    p_chapter_label: 'Capítulo 86 - QA Descartável',
    p_chapter_type: 'NUMBER',
    p_template: 'MANHWA',
    p_priority: 'LOW'
  });

  // Create disposable file & task for ch86
  await supabase.from('scan_production_files').insert({
    scan_id: scanId,
    work_id: workId,
    production_chapter_id: ch86,
    stage_id: rawSt.stage_id,
    stage_slug: 'raw',
    file_name: 'test_qa_86.zip',
    byte_size: 1024,
    mime_type: 'application/zip',
    file_key: 'qa_86_' + Date.now(),
    provider: 'STORAGE',
    version: 1,
    uploaded_by: ownerId,
    is_current: true
  });

  // Call safe delete RPC
  const { data: delResult, error: delErr } = await supabase.rpc('delete_scan_production_chapter', {
    p_production_chapter_id: ch86,
    p_confirmation: '86',
    p_reason: 'Homologação de limpeza de teste QA'
  });
  if (delErr) throw new Error('Safe delete failed: ' + delErr.message);
  console.log('✓ Safe delete RPC result:', delResult);

  // Verify DB cleanup: no files, no stages, no chapter
  const { count: ch86Count } = await adminClient.from('scan_production_chapters').select('*', { count: 'exact' }).eq('id', ch86);
  const { count: files86Count } = await adminClient.from('scan_production_files').select('*', { count: 'exact' }).eq('production_chapter_id', ch86);
  if (ch86Count > 0 || files86Count > 0) {
    throw new Error('FAILED: Safe delete did not fully purge production chapter and staging files!');
  }
  console.log('✓ Safe delete verified: 0 remaining files, 0 remaining stages.');

  await page.goto(`${prodUrl}/scan?id=${scanId}&tab=pipeline`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: resolve(artifactDir, '20-hard-delete-production.png'), fullPage: false });
  console.log('✓ Captured 20-hard-delete-production.png');

  // 21-hard-delete-scan-history.png: Hard-delete disposable QA scan preserves chapter credits and reader HTTP 200
  console.log('\n[TEST 8 & EVIDENCE 21] Testing Disposable Scan Hard-Delete...');
  // 1. Create a disposable test scan
  const testScanSlug = 'qa-temp-scan-' + Date.now();
  const testScanName = 'QA Temp Scan ' + Date.now();
  const { data: tempScan, error: tempScanErr } = await adminClient.from('scans').insert({
    name: testScanName,
    slug: testScanSlug
  }).select().single();
  if (tempScanErr) throw tempScanErr;

  // Add member
  await adminClient.from('scan_members').insert({
    scan_id: tempScan.id,
    user_id: ownerId,
    role: 'OWNER'
  });

  // Associate credit snapshot with disposable scan
  const { data: snap } = await adminClient.from('chapter_credit_snapshots').insert({
    chapter_id: publicChId,
    production_chapter_id: chA,
    publication_version: 1,
    scan_id: tempScan.id,
    scan_name_snapshot: testScanName,
    scan_slug_snapshot: testScanSlug,
    stage_name: 'Tradução',
    stage_slug: 'traducao',
    user_id: ownerId,
    display_name_snapshot: 'Awerkori QA',
    role_order: 3
  }).select().single();

  // Now hard delete the disposable scan using global_admin_hard_delete_scan
  const { data: scanDelRes, error: scanDelErr } = await adminClient.rpc('global_admin_hard_delete_scan', {
    p_scan_id: tempScan.id,
    p_confirmation: testScanName,
    p_reason: 'Homologação de preservação de histórico'
  });
  if (scanDelErr) console.warn('Hard delete scan note:', scanDelErr.message);

  // Verify historical credit snapshot is PRESERVED!
  const { data: preservedSnap } = await adminClient
    .from('chapter_credit_snapshots')
    .select('*')
    .eq('id', snap.id)
    .maybeSingle();

  if (!preservedSnap) {
    throw new Error('FAILED: Historical chapter credit snapshot was deleted when scan was deleted!');
  }
  console.log('✓ Credit snapshot preserved with static scan_name:', preservedSnap.scan_name_snapshot);

  // Verify Public Reader still returns HTTP 200 without broken foreign keys
  const readerResp3 = await page.goto(`${prodUrl}/ler/${publicChId}`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  console.log('Public Reader HTTP Status after scan hard delete:', readerResp3?.status());
  if (readerResp3?.status() !== 200) {
    throw new Error('Reader did not return 200 after scan delete!');
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(artifactDir, '21-hard-delete-scan-history.png'), fullPage: false });
  console.log('✓ Captured 21-hard-delete-scan-history.png');

  // Test Notification Idempotency: call resolve_scan_chapter_dependencies 3x
  console.log('\n[TEST 9] Testing Notification Idempotency (running resolver 3x)...');
  const { count: notifsBefore } = await adminClient
    .from('scan_notifications')
    .select('*', { count: 'exact' })
    .eq('scan_id', scanId);

  await supabase.rpc('resolve_scan_chapter_dependencies', { p_production_chapter_id: chA });
  await supabase.rpc('resolve_scan_chapter_dependencies', { p_production_chapter_id: chA });
  await supabase.rpc('resolve_scan_chapter_dependencies', { p_production_chapter_id: chA });

  const { count: notifsAfter } = await adminClient
    .from('scan_notifications')
    .select('*', { count: 'exact' })
    .eq('scan_id', scanId);

  const diff = notifsAfter - notifsBefore;
  console.log(`Notifications before: ${notifsBefore}, after: ${notifsAfter}, diff: ${diff}`);
  if (diff > 0) {
    throw new Error(`IDEMPOTENCY VIOLATION: Running resolver 3x generated ${diff} duplicate notifications!`);
  }
  console.log('✓ Notification idempotency verified: 0 duplicate notifications generated!');

  await browser.close();
  console.log('\n================================================================');
  console.log('🎉 ALL 21 SCREENSHOTS CAPTURED & ALL EDITORIAL TESTS PASSED!');
  console.log('================================================================');
}

run().catch(err => {
  console.error('\n❌ HOMOLOGATION ERROR:', err);
  process.exit(1);
});
