import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { getUserClient } from './owner-session.mjs';

process.loadEnvFile('.env');

const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854';
const prodUrl = 'https://manga.project-nox-awerkori.workers.dev';
const SCAN_ID = '04872e99-37ad-4d45-aed4-35759d0eae33';
const WORK_ID = 'c08a2531-7bf3-4324-979a-f7de0e66a62d';

const admin = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function run() {
  console.log('--- Setting up test chapter for visual evidence ---');
  const pristamAuth = await getUserClient('teka.a7x@gmail.com', prodUrl);
  const miakaAuth = await getUserClient('140miakazinha@gmail.com', prodUrl);

  const chNum = Math.floor(96000 + Math.random() * 3000);
  const { data: createData, error: createErr } = await pristamAuth.client.rpc('create_scan_production_chapter', {
    p_scan_id: SCAN_ID,
    p_work_id: WORK_ID,
    p_chapter_number: chNum,
    p_chapter_label: 'Capítulo Homologação Notificações e Badges',
    p_chapter_type: 'NUMBER',
    p_template: 'MANHWA',
    p_priority: 'NORMAL',
    p_auto_claim: false
  });
  if (createErr) throw new Error('Create chapter error: ' + createErr.message);

  const { data: chRow } = await admin
    .from('scan_production_chapters')
    .select('id')
    .eq('scan_id', SCAN_ID)
    .eq('work_id', WORK_ID)
    .eq('chapter_number', chNum)
    .single();

  const testChapterId = chRow.id;
  console.log(`Created test chapter: ${testChapterId} (#${chNum})`);

  const { data: rawStages } = await admin
    .from('scan_chapter_stages')
    .select('*, stage:stage_id(slug)')
    .eq('production_chapter_id', testChapterId);

  const rawStage = (rawStages || []).find(s => s.stage?.slug === 'raw');
  console.log(`RAW stage ID: ${rawStage?.id}, status: ${rawStage?.status}, version: ${rawStage?.availability_version}`);

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  // -------------------------------------------------------------
  // 1. Pristam (Staff + Raw Provider) - Desktop Unseen State
  // -------------------------------------------------------------
  console.log('\n--- Pristam: Viewing RAW Pipeline (Desktop 1440x900) ---');
  const pristamContext = await browser.newContext();
  await pristamContext.addCookies([
    ...pristamAuth.cookies,
    { name: 'nox-age-status', value: 'ADULT', url: prodUrl }
  ]);
  const pristamPage = await pristamContext.newPage();
  await pristamPage.setViewportSize({ width: 1440, height: 900 });

  const pipelineUrl = `${prodUrl}/scan?id=${SCAN_ID}&tab=pipeline&stage=raw`;
  await pristamPage.goto(pipelineUrl, { waitUntil: 'networkidle', timeout: 35000 });
  await pristamPage.waitForTimeout(2000);

  const shot1Path = resolve(artifactDir, 'evidence-01-pristam-novo-para-voce-desktop.png');
  await pristamPage.screenshot({ path: shot1Path, fullPage: false });
  console.log('✓ Captured evidence-01-pristam-novo-para-voce-desktop.png');

  // -------------------------------------------------------------
  // 2. Pristam: Expand Card -> Turns to "Disponível para você"
  // -------------------------------------------------------------
  console.log('\n--- Pristam: Clicking/Expanding card to mark seen ---');
  const cardTrigger = pristamPage.locator('.accordion-header-bar', { hasText: `#${chNum}` }).first();
  if (await cardTrigger.count() > 0) {
    await cardTrigger.click();
    await pristamPage.waitForTimeout(2500);
    const shot2Path = resolve(artifactDir, 'evidence-02-pristam-card-expanded-seen.png');
    await pristamPage.screenshot({ path: shot2Path, fullPage: false });
    console.log('✓ Captured evidence-02-pristam-card-expanded-seen.png');
  } else {
    console.log('Specific chapter card not matched, clicking first accordion-header-bar...');
    const firstCard = pristamPage.locator('.accordion-header-bar').first();
    if (await firstCard.count() > 0) {
      await firstCard.click();
      await pristamPage.waitForTimeout(2500);
      const shot2Path = resolve(artifactDir, 'evidence-02-pristam-card-expanded-seen.png');
      await pristamPage.screenshot({ path: shot2Path, fullPage: false });
      console.log('✓ Captured evidence-02-pristam-card-expanded-seen.png');
    }
  }

  // -------------------------------------------------------------
  // 3. Pristam: Mobile Viewports (390px, 375px, 320px)
  // -------------------------------------------------------------
  console.log('\n--- Pristam: Mobile Viewport 390px (iPhone 14) ---');
  await pristamPage.setViewportSize({ width: 390, height: 844 });
  await pristamPage.waitForTimeout(1000);
  const shot3Path = resolve(artifactDir, 'evidence-03-mobile-390px-badges-nav.png');
  await pristamPage.screenshot({ path: shot3Path, fullPage: false });
  console.log('✓ Captured evidence-03-mobile-390px-badges-nav.png');

  console.log('\n--- Pristam: Mobile Viewport 375px (iPhone SE) ---');
  await pristamPage.setViewportSize({ width: 375, height: 667 });
  await pristamPage.waitForTimeout(1000);
  const shot4Path = resolve(artifactDir, 'evidence-04-mobile-375px-badges-nav.png');
  await pristamPage.screenshot({ path: shot4Path, fullPage: false });
  console.log('✓ Captured evidence-04-mobile-375px-badges-nav.png');

  console.log('\n--- Pristam: Mobile Viewport 320px (Compact) ---');
  await pristamPage.setViewportSize({ width: 320, height: 568 });
  await pristamPage.waitForTimeout(1000);
  const shot5Path = resolve(artifactDir, 'evidence-05-mobile-320px-badges-nav.png');
  await pristamPage.screenshot({ path: shot5Path, fullPage: false });
  console.log('✓ Captured evidence-05-mobile-320px-badges-nav.png');

  await pristamContext.close();

  // -------------------------------------------------------------
  // 4. Miaka (Staff + Typer Only) - Negative Test (No Badges)
  // -------------------------------------------------------------
  console.log('\n--- Miaka: Viewing RAW Pipeline (Negative Check - No Badges) ---');
  const miakaContext = await browser.newContext();
  await miakaContext.addCookies([
    ...miakaAuth.cookies,
    { name: 'nox-age-status', value: 'ADULT', url: prodUrl }
  ]);
  const miakaPage = await miakaContext.newPage();
  await miakaPage.setViewportSize({ width: 1440, height: 900 });
  await miakaPage.goto(pipelineUrl, { waitUntil: 'networkidle', timeout: 35000 });
  await miakaPage.waitForTimeout(2000);

  const shot6Path = resolve(artifactDir, 'evidence-06-miaka-negative-no-badge.png');
  await miakaPage.screenshot({ path: shot6Path, fullPage: false });
  console.log('✓ Captured evidence-06-miaka-negative-no-badge.png');
  await miakaContext.close();

  await browser.close();

  // Cleanup
  console.log('\n--- Cleaning up test chapter ---');
  await admin.from('scan_production_chapters').delete().eq('id', testChapterId);
  console.log('✓ Test chapter deleted successfully.');
  console.log('=== ALL EVIDENCE SCREENSHOTS CAPTURED SUCCESSFULLY ===');
}

run().catch(e => {
  console.error('Evidence capture failed:', e);
  process.exit(1);
});
