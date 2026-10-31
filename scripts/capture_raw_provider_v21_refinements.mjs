import { chromium } from '@playwright/test';
import { ownerCookies, userCookies } from './owner-session.mjs';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const targetUrl = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function runRefinementInspection() {
  console.log('=== STARTING RAW PROVIDER V21 REFINEMENT INSPECTION ===');
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

  // Mock data definitions for Scenarios
  const sampleWork = {
    id: 'c08a2531-7bf3-4324-979a-f7de0e66a62d',
    title: 'Céu Distante',
    cover_url: 'https://manga.project-nox-awerkori.workers.dev/cdn-cgi/image/w=300,q=85/covers/ceu_distante.webp'
  };

  const chAvail = {
    id: 'mock-ch-avail-94',
    scan_id: '04872e99-37ad-4d45-aed4-35759d0eae33',
    work_id: sampleWork.id,
    chapter_number: '94',
    chapter_label: 'A Fortaleza Desperta',
    priority: 'URGENT',
    status: 'PRODUCTION'
  };

  const stageAvail = {
    id: 'mock-cs-avail-94',
    scan_id: '04872e99-37ad-4d45-aed4-35759d0eae33',
    chapter_id: null,
    stage_id: 'stage-raw-id',
    status: 'AVAILABLE',
    assigned_to: null,
    production_chapter_id: 'mock-ch-avail-94',
    stage: { id: 'stage-raw-id', name: 'Raw Provider', slug: 'raw' }
  };

  const chClaimedNoFiles = {
    id: 'mock-ch-my-92',
    scan_id: '04872e99-37ad-4d45-aed4-35759d0eae33',
    work_id: sampleWork.id,
    chapter_number: '92',
    chapter_label: 'O Retorno',
    priority: 'NORMAL',
    status: 'PRODUCTION'
  };

  const stageClaimedNoFiles = {
    id: 'mock-cs-my-92',
    scan_id: '04872e99-37ad-4d45-aed4-35759d0eae33',
    chapter_id: null,
    stage_id: 'stage-raw-id',
    status: 'IN_PROGRESS',
    assigned_to: '732fbe87-5040-41fb-9983-0aedb2af44c8',
    production_chapter_id: 'mock-ch-my-92',
    stage: { id: 'stage-raw-id', name: 'Raw Provider', slug: 'raw' }
  };

  const chWithFiles = {
    id: 'mock-ch-my-93',
    scan_id: '04872e99-37ad-4d45-aed4-35759d0eae33',
    work_id: sampleWork.id,
    chapter_number: '93',
    chapter_label: 'Confronto em Sombras',
    priority: 'HIGH',
    status: 'PRODUCTION'
  };

  const stageWithFiles = {
    id: 'mock-cs-my-93',
    scan_id: '04872e99-37ad-4d45-aed4-35759d0eae33',
    chapter_id: null,
    stage_id: 'stage-raw-id',
    status: 'IN_PROGRESS',
    assigned_to: '732fbe87-5040-41fb-9983-0aedb2af44c8',
    production_chapter_id: 'mock-ch-my-93',
    stage: { id: 'stage-raw-id', name: 'Raw Provider', slug: 'raw' }
  };

  const deliverableZip = {
    id: 'mock-file-93-zip',
    production_chapter_id: 'mock-ch-my-93',
    stage_id: 'stage-raw-id',
    stage_slug: 'raw',
    file_name: 'ceu_distante_cap93_raw.cbz',
    file_size: 45200000,
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
  // 1. ANDROID 390 & 360 - CENÁRIO A: LISTAS VAZIAS (VERIFICAR FIM DO VÃO 129px)
  // =========================================================================
  console.log('\n--- 1. Android Empty Lists Gap Verification (390px) ---');
  const m390Ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  });
  await m390Ctx.addCookies(cookies);
  const m390Page = await m390Ctx.newPage();
  await m390Page.goto(`${targetUrl}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle', timeout: 45000 });
  await m390Page.waitForSelector('.raw-provider-root', { timeout: 25000 });
  await m390Page.waitForTimeout(800);

  const m390EmptyMetrics = await m390Page.evaluate(() => {
    const avail = document.querySelector('.raw-available-section')?.getBoundingClientRect();
    const my = document.querySelector('.raw-my-section')?.getBoundingClientRect();
    const grid = document.querySelector('.raw-main-grid')?.getBoundingClientRect();

    return {
      availBottom: avail ? Math.round(avail.bottom) : 0,
      myTop: my ? Math.round(my.top) : 0,
      gapBetweenCards: avail && my ? Math.round(my.top - avail.bottom) : 0,
      gridHeight: grid ? Math.round(grid.height) : 0
    };
  });
  console.log('Mobile 390 Empty State Metrics:', m390EmptyMetrics);
  await m390Page.screenshot({ path: `${artifactDir}/raw_refine_mobile_390_empty_no_gap.png`, fullPage: false });
  await m390Page.screenshot({ path: `${artifactDir}/raw_refine_mobile_390_full_empty.png`, fullPage: true });

  // Android 360px Full Screenshot (Scenario A Empty)
  console.log('\n--- 1b. Android 360px Full Screenshot ---');
  await m390Page.setViewportSize({ width: 360, height: 780 });
  await m390Page.waitForTimeout(500);
  const m360EmptyMetrics = await m390Page.evaluate(() => {
    const avail = document.querySelector('.raw-available-section')?.getBoundingClientRect();
    const my = document.querySelector('.raw-my-section')?.getBoundingClientRect();
    return {
      gapBetweenCards: avail && my ? Math.round(my.top - avail.bottom) : 0
    };
  });
  console.log('Mobile 360 Empty State Metrics:', m360EmptyMetrics);
  await m390Page.screenshot({ path: `${artifactDir}/raw_refine_mobile_360_full.png`, fullPage: true });
  await m390Page.screenshot({ path: `${artifactDir}/raw_refine_mobile_360_viewport.png`, fullPage: false });
  await m390Ctx.close();

  // =========================================================================
  // 2. ANDROID 390 - MODAL ABERTO & MODAL COM TECLADO VIRTUAL (VIEWPORT 500px)
  // =========================================================================
  console.log('\n--- 2. Android Modal & Virtual Keyboard Verification ---');
  const mModalCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  await mModalCtx.addCookies(cookies);
  const mModalPage = await mModalCtx.newPage();
  await mModalPage.goto(`${targetUrl}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle' });
  await mModalPage.waitForSelector('.btn-novo-capitulo');
  await mModalPage.click('.btn-novo-capitulo');
  await mModalPage.waitForSelector('.modal-card', { state: 'visible' });
  await mModalPage.waitForTimeout(500);

  // Normal Mobile Modal Open
  await mModalPage.screenshot({ path: `${artifactDir}/raw_refine_mobile_390_modal_open.png`, fullPage: false });

  // Fill in form to test dirty state
  await mModalPage.fill('#new-chapter-number', '95.5');
  await mModalPage.fill('#new-chapter-label', 'Capítulo Especial de Transição');

  // Simulate Virtual Keyboard Open (viewport height shrinks to 480px)
  console.log('Simulating virtual keyboard open (height: 480px)...');
  await mModalPage.setViewportSize({ width: 390, height: 480 });
  await mModalPage.waitForTimeout(500);

  const keyboardModalMetrics = await mModalPage.evaluate(() => {
    const card = document.querySelector('.modal-card');
    const btnSubmit = document.querySelector('.btn-modal-submit');
    const btnCancel = document.querySelector('.btn-modal-cancel');

    // Scroll to bottom of modal
    if (card) card.scrollTop = card.scrollHeight;

    const rSubmit = btnSubmit ? btnSubmit.getBoundingClientRect() : null;
    const rCancel = btnCancel ? btnCancel.getBoundingClientRect() : null;

    return {
      modalScrollHeight: card ? card.scrollHeight : 0,
      modalClientHeight: card ? card.clientHeight : 0,
      submitH: rSubmit ? Math.round(rSubmit.height) : 0,
      cancelH: rCancel ? Math.round(rCancel.height) : 0,
      submitVisible: rSubmit ? rSubmit.bottom <= window.innerHeight && rSubmit.top >= 0 : false
    };
  });
  console.log('Virtual Keyboard Modal Metrics:', keyboardModalMetrics);
  await mModalPage.screenshot({ path: `${artifactDir}/raw_refine_mobile_390_modal_keyboard.png`, fullPage: false });

  // Test accidental tap outside protection
  console.log('Testing dirty tap outside protection...');
  let confirmDialogTriggered = false;
  mModalPage.on('dialog', async (dialog) => {
    confirmDialogTriggered = true;
    console.log(`Intercepted dialog: "${dialog.message()}"`);
    await dialog.dismiss(); // user dismisses / cancels discard
  });

  // Click on modal backdrop outside card
  await mModalPage.mouse.click(10, 10);
  await mModalPage.waitForTimeout(400);

  const stillOpen = await mModalPage.locator('.modal-card').isVisible();
  console.log(`Protected against accidental dismissal? modal still open = ${stillOpen}`);

  await mModalCtx.close();

  // =========================================================================
  // 3. DESKTOP 1440 & 1920 - NORMAL & MODAL PROPORCIONAL (540px)
  // =========================================================================
  console.log('\n--- 3. Desktop 1440 & 1920 Proportional Modal Verification ---');
  const dCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await dCtx.addCookies(cookies);
  const dPage = await dCtx.newPage();
  await dPage.goto(`${targetUrl}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle' });
  await dPage.waitForSelector('.raw-provider-root');
  await dPage.waitForTimeout(500);

  // Desktop 1440 Normal
  await dPage.screenshot({ path: `${artifactDir}/raw_refine_desktop_1440_normal.png`, fullPage: false });

  // Desktop 1920 Normal
  await dPage.setViewportSize({ width: 1920, height: 1080 });
  await dPage.waitForTimeout(500);
  await dPage.screenshot({ path: `${artifactDir}/raw_refine_desktop_1920_normal.png`, fullPage: false });

  // Desktop Modal Open (Check width 540px)
  await dPage.setViewportSize({ width: 1440, height: 900 });
  await dPage.click('.btn-novo-capitulo');
  await dPage.waitForSelector('.modal-card', { state: 'visible' });
  await dPage.waitForTimeout(500);

  const dModalMetrics = await dPage.evaluate(() => {
    const card = document.querySelector('.modal-card')?.getBoundingClientRect();
    const form = document.querySelector('.modal-form')?.getBoundingClientRect();
    const btnSubmit = document.querySelector('.btn-modal-submit')?.getBoundingClientRect();
    return {
      cardWidth: card ? Math.round(card.width) : 0,
      cardHeight: card ? Math.round(card.height) : 0,
      formWidth: form ? Math.round(form.width) : 0,
      btnSubmitH: btnSubmit ? Math.round(btnSubmit.height) : 0
    };
  });
  console.log('Desktop 1440 Modal Metrics:', dModalMetrics);
  await dPage.screenshot({ path: `${artifactDir}/raw_refine_desktop_1440_modal_open.png`, fullPage: false });
  await dCtx.close();

  // =========================================================================
  // 4. SCENARIOS B, C, D, E - POPULATED STATES & RAW UPLOAD ACCORDION
  // =========================================================================
  console.log('\n--- 4. Populated Scenarios (Available, Claimed, With Files, Upload Error) ---');
  const popCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await popCtx.addCookies(cookies);
  const popPage = await popCtx.newPage();

  // Setup Scenarios B, C, D
  await setupRoute(popPage, {
    chapters: [chAvail, chClaimedNoFiles, chWithFiles],
    stages: [stageAvail, stageClaimedNoFiles, stageWithFiles],
    files: [deliverableZip]
  });

  await popPage.goto(`${targetUrl}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle' });
  await popPage.waitForSelector('.available-card');
  await popPage.waitForSelector('.my-card');
  await popPage.waitForTimeout(800);

  // Desktop 1440 with Card in Progress and Card with Files
  await popPage.screenshot({ path: `${artifactDir}/raw_refine_desktop_1440_cards_in_progress.png`, fullPage: false });

  // Expand Upload Accordion on Desktop for Chapter 92 (no files yet - CTA state)
  const btnToggleUploadNoFiles = popPage.locator('.my-card').first().locator('.btn-toggle-upload');
  await btnToggleUploadNoFiles.click();
  await popPage.waitForTimeout(600);
  await popPage.screenshot({ path: `${artifactDir}/raw_refine_desktop_1440_upload_accordion_expanded.png`, fullPage: false });

  // Now Test Android 390 with Populated Scenarios & Upload Open
  console.log('\n--- 4b. Mobile 390 with Populated Scenarios & Upload Open ---');
  await popCtx.close();

  const mPopCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  await mPopCtx.addCookies(cookies);
  const mPopPage = await mPopCtx.newPage();
  await setupRoute(mPopPage, {
    chapters: [chAvail, chClaimedNoFiles, chWithFiles],
    stages: [stageAvail, stageClaimedNoFiles, stageWithFiles],
    files: [deliverableZip]
  });

  await mPopPage.goto(`${targetUrl}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle' });
  await mPopPage.waitForSelector('.available-card');
  await mPopPage.waitForSelector('.my-card');
  await mPopPage.waitForTimeout(800);

  // Android Available & My Chapters Populated
  await mPopPage.screenshot({ path: `${artifactDir}/raw_refine_mobile_390_populated.png`, fullPage: false });
  await mPopPage.screenshot({ path: `${artifactDir}/raw_refine_mobile_390_populated_full.png`, fullPage: true });

  // Expand Upload Accordion on Mobile
  const mToggleUpload = mPopPage.locator('.my-card').first().locator('.btn-toggle-upload');
  await mToggleUpload.click();
  await mPopPage.waitForTimeout(600);
  await mPopPage.screenshot({ path: `${artifactDir}/raw_refine_mobile_390_upload_accordion_open.png`, fullPage: false });
  await mPopPage.screenshot({ path: `${artifactDir}/raw_refine_mobile_390_upload_accordion_full.png`, fullPage: true });

  await mPopCtx.close();

  // =========================================================================
  // 5. SHARP CROPS FOR VISUAL COMPARISON BEFORE / AFTER
  // =========================================================================
  console.log('\n--- 5. Generating Precise Visual Comparison Crops with Sharp ---');
  const mEmptyPath = `${artifactDir}/raw_refine_mobile_390_empty_no_gap.png`;
  const dModalPath = `${artifactDir}/raw_refine_desktop_1440_modal_open.png`;
  const dUploadPath = `${artifactDir}/raw_refine_desktop_1440_upload_accordion_expanded.png`;
  const mPopPath = `${artifactDir}/raw_refine_mobile_390_populated.png`;

  // Crop Android Gap Comparison (Area between Available and My sections)
  await sharp(mEmptyPath)
    .extract({ left: 10, top: 260, width: 370, height: 350 })
    .toFile(`${artifactDir}/raw_crop_mobile_gap_fixed_16px.png`);

  // Crop Desktop Modal (Full modal dialog)
  await sharp(dModalPath)
    .extract({ left: 440, top: 120, width: 560, height: 580 })
    .toFile(`${artifactDir}/raw_crop_desktop_modal_540px.png`);

  // Crop Upload Dropzone & Instructions
  await sharp(dUploadPath)
    .extract({ left: 825, top: 220, width: 575, height: 420 })
    .toFile(`${artifactDir}/raw_crop_upload_dropzone_and_hints.png`);

  await browser.close();

  const report = {
    m390EmptyMetrics,
    m360EmptyMetrics,
    keyboardModalMetrics,
    dModalMetrics,
    workerVersion: 'd00c06a6-a47e-4be3-be07-35e1ae2f3bdd'
  };

  writeFileSync(`${artifactDir}/raw_refinements_summary.json`, JSON.stringify(report, null, 2));
  console.log('=== INSPECTION COMPLETED SUCCESSFULLY ===');
  console.log(JSON.stringify(report, null, 2));
}

runRefinementInspection().catch(console.error);
