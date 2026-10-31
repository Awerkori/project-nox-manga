import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const targetUrl = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function inspectAndCompareConcepts() {
  console.log('=== STARTING VISUAL INSPECTION & COMPARISON OF CONCEPTS A & B ===');
  console.log(`Target: ${targetUrl}`);

  const cookies = await ownerCookies(targetUrl);
  cookies.push({
    name: 'nox-age-status',
    value: 'ADULT',
    url: targetUrl,
    httpOnly: false,
    sameSite: 'Lax',
    secure: true
  });

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  // Populated mock data
  const sampleWork = {
    id: 'c08a2531-7bf3-4324-979a-f7de0e66a62d',
    title: 'Céu Distante',
    cover_url: 'https://manga.project-nox-awerkori.workers.dev/cdn-cgi/image/w=300,q=85/covers/ceu_distante.webp'
  };

  const chAvail1 = {
    id: 'mock-ch-avail-94',
    scan_id: '04872e99-37ad-4d45-aed4-35759d0eae33',
    work_id: sampleWork.id,
    chapter_number: '94',
    chapter_label: 'A Fortaleza Desperta',
    priority: 'URGENT',
    status: 'PRODUCTION'
  };

  const chAvail2 = {
    id: 'mock-ch-avail-95',
    scan_id: '04872e99-37ad-4d45-aed4-35759d0eae33',
    work_id: sampleWork.id,
    chapter_number: '95',
    chapter_label: 'O Limiar do Abismo',
    priority: 'HIGH',
    status: 'PRODUCTION'
  };

  const stageAvail1 = {
    id: 'mock-cs-avail-94',
    scan_id: '04872e99-37ad-4d45-aed4-35759d0eae33',
    stage_id: 'stage-raw-id',
    status: 'AVAILABLE',
    assigned_to: null,
    production_chapter_id: 'mock-ch-avail-94',
    stage: { id: 'stage-raw-id', name: 'Raw Provider', slug: 'raw' }
  };

  const stageAvail2 = {
    id: 'mock-cs-avail-95',
    scan_id: '04872e99-37ad-4d45-aed4-35759d0eae33',
    stage_id: 'stage-raw-id',
    status: 'AVAILABLE',
    assigned_to: null,
    production_chapter_id: 'mock-ch-avail-95',
    stage: { id: 'stage-raw-id', name: 'Raw Provider', slug: 'raw' }
  };

  const chMine = {
    id: 'mock-ch-my-92',
    scan_id: '04872e99-37ad-4d45-aed4-35759d0eae33',
    work_id: sampleWork.id,
    chapter_number: '92',
    chapter_label: 'Retorno das Sombras',
    priority: 'NORMAL',
    status: 'PRODUCTION'
  };

  const stageMine = {
    id: 'mock-cs-my-92',
    scan_id: '04872e99-37ad-4d45-aed4-35759d0eae33',
    stage_id: 'stage-raw-id',
    status: 'IN_PROGRESS',
    assigned_to: '732fbe87-5040-41fb-9983-0aedb2af44c8',
    production_chapter_id: 'mock-ch-my-92',
    stage: { id: 'stage-raw-id', name: 'Raw Provider', slug: 'raw' }
  };

  const deliverableZip = {
    id: 'mock-file-92-zip',
    production_chapter_id: 'mock-ch-my-92',
    stage_id: 'stage-raw-id',
    stage_slug: 'raw',
    file_name: 'ceu_distante_cap92_raw.zip',
    file_size: 38400000,
    is_current: true
  };

  function setupRoute(page, { chapters = [], stages = [], files = [] }) {
    return page.route('**/scan?tab=pipeline&stage=raw*', async (route) => {
      const response = await route.fetch();
      let text = await response.text();

      if (chapters.length) {
        text = text.replace('productionChapters:[', 'productionChapters:[' + chapters.map(c => JSON.stringify(c)).join(',') + ',');
      }
      if (stages.length) {
        text = text.replace('chapterStages:[', 'chapterStages:[' + stages.map(s => JSON.stringify(s)).join(',') + ',');
      }
      if (files.length) {
        text = text.replace('productionFiles:[', 'productionFiles:[' + files.map(f => JSON.stringify(f)).join(',') + ',');
      }

      await route.fulfill({
        response,
        body: text,
        headers: { ...response.headers(), 'content-type': 'text/html' }
      });
    });
  }

  // =========================================================================
  // 1. CONCEPT A (SPLIT PANELS VIA ?variant=split)
  // =========================================================================
  console.log('\n--- 1. Capturing Concept A (Split Panels) ---');
  // Desktop Concept A Empty
  const dACtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await dACtx.addCookies(cookies);
  const dAPage = await dACtx.newPage();
  await dAPage.goto(`${targetUrl}/scan?tab=pipeline&stage=raw&variant=split`, { waitUntil: 'networkidle' });
  await dAPage.waitForSelector('.raw-provider-root');
  await dAPage.screenshot({ path: `${artifactDir}/concept_a_desktop_1440_empty.png`, fullPage: false });
  await dACtx.close();

  // Mobile Concept A Empty
  const mACtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mACtx.addCookies(cookies);
  const mAPage = await mACtx.newPage();
  await mAPage.goto(`${targetUrl}/scan?tab=pipeline&stage=raw&variant=split`, { waitUntil: 'networkidle' });
  await mAPage.waitForSelector('.raw-provider-root');
  await mAPage.screenshot({ path: `${artifactDir}/concept_a_mobile_390_empty.png`, fullPage: false });
  await mACtx.close();

  // =========================================================================
  // 2. CONCEPT B (WORKSPACE UNIFICADO - DEFAULT URL)
  // =========================================================================
  console.log('\n--- 2. Capturing Concept B (Workspace Unificado) ---');
  // Desktop Concept B Empty
  const dBCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await dBCtx.addCookies(cookies);
  const dBPage = await dBCtx.newPage();
  await dBPage.goto(`${targetUrl}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle' });
  await dBPage.waitForSelector('.raw-workspace-container');
  await dBPage.screenshot({ path: `${artifactDir}/concept_b_desktop_1440_empty.png`, fullPage: false });

  const dMetrics = await dBPage.evaluate(() => {
    const header = document.querySelector('.raw-header')?.getBoundingClientRect();
    const nav = document.querySelector('.workspace-nav-bar')?.getBoundingClientRect();
    const empty = document.querySelector('.workspace-empty-card')?.getBoundingClientRect();
    return {
      headerH: header ? Math.round(header.height) : 0,
      navH: nav ? Math.round(nav.height) : 0,
      emptyH: empty ? Math.round(empty.height) : 0
    };
  });
  console.log('Concept B Desktop Empty Metrics:', dMetrics);
  await dBCtx.close();

  // Mobile Concept B Empty
  const mBCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  await mBCtx.addCookies(cookies);
  const mBPage = await mBCtx.newPage();
  await mBPage.goto(`${targetUrl}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle' });
  await mBPage.waitForSelector('.raw-workspace-container');

  const mMetrics = await mBPage.evaluate(() => {
    const header = document.querySelector('.raw-header')?.getBoundingClientRect();
    const nav = document.querySelector('.segmented-control')?.getBoundingClientRect();
    const empty = document.querySelector('.workspace-empty-card')?.getBoundingClientRect();
    return {
      headerH: header ? Math.round(header.height) : 0,
      navW: nav ? Math.round(nav.width) : 0,
      navH: nav ? Math.round(nav.height) : 0,
      emptyH: empty ? Math.round(empty.height) : 0
    };
  });
  console.log('Concept B Mobile Empty Metrics:', mMetrics);
  await mBPage.screenshot({ path: `${artifactDir}/concept_b_mobile_390_empty.png`, fullPage: false });

  // Switch to "Meus capítulos" tab in empty state
  await mBPage.locator('.segment-btn').nth(1).click();
  await mBPage.waitForTimeout(400);
  await mBPage.screenshot({ path: `${artifactDir}/concept_b_mobile_390_empty_mine_tab.png`, fullPage: false });
  await mBCtx.close();

  // =========================================================================
  // 3. CONCEPT B WITH POPULATED DATA
  // =========================================================================
  console.log('\n--- 3. Capturing Concept B with Populated Data ---');
  // Desktop Populated
  const dPopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await dPopCtx.addCookies(cookies);
  const dPopPage = await dPopCtx.newPage();
  await setupRoute(dPopPage, {
    chapters: [chAvail1, chAvail2, chMine],
    stages: [stageAvail1, stageAvail2, stageMine],
    files: [deliverableZip]
  });
  await dPopPage.goto(`${targetUrl}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle' });
  await dPopPage.waitForSelector('.raw-workspace-container');
  await dPopPage.waitForTimeout(500);

  // Tab 1: Disponíveis (2 chapters)
  await dPopPage.screenshot({ path: `${artifactDir}/concept_b_desktop_1440_pop_available.png`, fullPage: false });

  // Tab 2: Meus capítulos (1 chapter with deliverable files)
  await dPopPage.locator('.segment-btn').nth(1).click();
  await dPopPage.waitForTimeout(400);
  await dPopPage.screenshot({ path: `${artifactDir}/concept_b_desktop_1440_pop_mine.png`, fullPage: false });

  // Tab 3: Ambos (side-by-side view on desktop)
  await dPopPage.locator('.segment-btn').nth(2).click();
  await dPopPage.waitForTimeout(400);
  await dPopPage.screenshot({ path: `${artifactDir}/concept_b_desktop_1440_pop_both.png`, fullPage: false });

  // Expand Upload Accordion in Desktop
  const btnUpload = dPopPage.locator('.my-card').first().locator('.btn-toggle-upload');
  await btnUpload.click();
  await dPopPage.waitForTimeout(500);
  await dPopPage.screenshot({ path: `${artifactDir}/concept_b_desktop_1440_pop_both_upload_open.png`, fullPage: false });
  await dPopCtx.close();

  // Mobile Populated
  const mPopCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mPopCtx.addCookies(cookies);
  const mPopPage = await mPopCtx.newPage();
  await setupRoute(mPopPage, {
    chapters: [chAvail1, chAvail2, chMine],
    stages: [stageAvail1, stageAvail2, stageMine],
    files: [deliverableZip]
  });
  await mPopPage.goto(`${targetUrl}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle' });
  await mPopPage.waitForSelector('.raw-workspace-container');
  await mPopPage.waitForTimeout(500);

  // Mobile: Disponíveis Tab
  await mPopPage.screenshot({ path: `${artifactDir}/concept_b_mobile_390_pop_available.png`, fullPage: false });

  // Mobile: Meus capítulos Tab
  await mPopPage.locator('.segment-btn').nth(1).click();
  await mPopPage.waitForTimeout(400);
  await mPopPage.screenshot({ path: `${artifactDir}/concept_b_mobile_390_pop_mine.png`, fullPage: false });

  // Mobile: Upload Open
  const mBtnUpload = mPopPage.locator('.my-card').first().locator('.btn-toggle-upload');
  await mBtnUpload.click();
  await mPopPage.waitForTimeout(500);
  await mPopPage.screenshot({ path: `${artifactDir}/concept_b_mobile_390_pop_upload_open.png`, fullPage: false });
  await mPopCtx.close();

  // =========================================================================
  // 4. RESPONSIVE RESOLUTIONS MATRIX FOR CONCEPT B
  // =========================================================================
  console.log('\n--- 4. Testing Responsive Resolutions ---');
  // Desktop: 1280, 1440, 1920
  const dRespCtx = await browser.newContext();
  await dRespCtx.addCookies(cookies);
  const dRespPage = await dRespCtx.newPage();

  for (const [w, h] of [[1280, 800], [1440, 900], [1920, 1080]]) {
    await dRespPage.setViewportSize({ width: w, height: h });
    await dRespPage.goto(`${targetUrl}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle' });
    await dRespPage.waitForSelector('.raw-workspace-container');
    await dRespPage.screenshot({ path: `${artifactDir}/concept_b_desktop_${w}_res.png`, fullPage: false });
  }
  await dRespCtx.close();

  // Android: 320, 360, 390, 430
  const mRespCtx = await browser.newContext({ isMobile: true, hasTouch: true });
  await mRespCtx.addCookies(cookies);
  const mRespPage = await mRespCtx.newPage();

  for (const [w, h] of [[320, 640], [360, 780], [390, 844], [430, 932]]) {
    await mRespPage.setViewportSize({ width: w, height: h });
    await mRespPage.goto(`${targetUrl}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle' });
    await mRespPage.waitForSelector('.raw-workspace-container');
    await mRespPage.screenshot({ path: `${artifactDir}/concept_b_mobile_${w}_res.png`, fullPage: false });
  }
  await mRespCtx.close();

  // =========================================================================
  // 5. SHARP CROPS: COMPARISONS FOR ARTICULATION & REPORT
  // =========================================================================
  console.log('\n--- 5. Generating Visual Proof Crops with Sharp ---');
  const mOldPath = `${artifactDir}/audit_current_mobile_390_empty.png`;
  const mNewPath = `${artifactDir}/concept_b_mobile_390_empty.png`;
  const dNewPopBothPath = `${artifactDir}/concept_b_desktop_1440_pop_both.png`;

  // Mobile Header Comparison: Before vs Concept B
  await sharp(mOldPath)
    .extract({ left: 10, top: 107, width: 370, height: 160 })
    .toFile(`${artifactDir}/crop_mobile_header_before_154px.png`);

  await sharp(mNewPath)
    .extract({ left: 10, top: 107, width: 370, height: 75 })
    .toFile(`${artifactDir}/crop_mobile_header_after_68px.png`);

  // Mobile Empty State Comparison: Before (stacked boxes) vs Concept B (unified card)
  await sharp(mOldPath)
    .extract({ left: 10, top: 275, width: 370, height: 320 })
    .toFile(`${artifactDir}/crop_mobile_empty_before_stacked.png`);

  await sharp(mNewPath)
    .extract({ left: 10, top: 240, width: 370, height: 210 })
    .toFile(`${artifactDir}/crop_mobile_empty_after_unified.png`);

  // Mobile Segmented Control Crop
  await sharp(mNewPath)
    .extract({ left: 10, top: 185, width: 370, height: 50 })
    .toFile(`${artifactDir}/crop_mobile_segmented_nav.png`);

  // Desktop Workspace Toolbar & Side-by-side Cards Crop
  await sharp(dNewPopBothPath)
    .extract({ left: 240, top: 100, width: 1160, height: 380 })
    .toFile(`${artifactDir}/crop_desktop_workspace_toolbar_and_both.png`);

  await browser.close();

  const finalSummary = {
    conceptBDesktopMetrics: dMetrics,
    conceptBMobileMetrics: mMetrics,
    workerVersion: '420eb0bc-b42e-4751-9e22-ef789d979484'
  };

  writeFileSync(`${artifactDir}/raw_concepts_comparison_summary.json`, JSON.stringify(finalSummary, null, 2));
  console.log('=== VISUAL COMPARISON SUITE COMPLETED SUCCESSFULLY ===');
  console.log(JSON.stringify(finalSummary, null, 2));
}

inspectAndCompareConcepts().catch(console.error);
