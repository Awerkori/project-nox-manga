import { chromium } from '@playwright/test';
import { ownerCookies, userCookies } from './owner-session.mjs';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const targetUrl = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function runFullScenarioSuite() {
  console.log('=== RUNNING FULL RAW PROVIDER SCENARIO & HOMOLOGATION SUITE ===');

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

  const availableChapter = {
    id: 'mock-ch-avail-94',
    scan_id: '04872e99-37ad-4d45-aed4-35759d0eae33',
    work_id: 'c08a2531-7bf3-4324-979a-f7de0e66a62d',
    chapter_number: '94',
    chapter_label: 'A Fortaleza Desperta',
    priority: 'URGENT',
    status: 'PRODUCTION'
  };

  const availableStage = {
    id: 'mock-cs-avail-94',
    scan_id: '04872e99-37ad-4d45-aed4-35759d0eae33',
    chapter_id: null,
    stage_id: 'stage-raw-id',
    status: 'AVAILABLE',
    assigned_to: null,
    production_chapter_id: 'mock-ch-avail-94',
    stage: { id: 'stage-raw-id', name: 'Raw Provider', slug: 'raw' }
  };

  const myChapter = {
    id: 'mock-ch-my-92',
    scan_id: '04872e99-37ad-4d45-aed4-35759d0eae33',
    work_id: 'c08a2531-7bf3-4324-979a-f7de0e66a62d',
    chapter_number: '92',
    chapter_label: '',
    priority: 'NORMAL',
    status: 'PRODUCTION'
  };

  const myStage = {
    id: 'mock-cs-my-92',
    scan_id: '04872e99-37ad-4d45-aed4-35759d0eae33',
    chapter_id: null,
    stage_id: 'stage-raw-id',
    status: 'IN_PROGRESS',
    assigned_to: '732fbe87-5040-41fb-9983-0aedb2af44c8', // current owner
    production_chapter_id: 'mock-ch-my-92',
    stage: { id: 'stage-raw-id', name: 'Raw Provider', slug: 'raw' }
  };

  const myFile = {
    id: 'mock-file-92',
    production_chapter_id: 'mock-ch-my-92',
    stage_id: 'stage-raw-id',
    stage_slug: 'raw',
    file_name: 'ceu_distante_cap92_raw.zip',
    file_size: 38400000,
    is_current: true
  };

  function setupRoute(page) {
    return page.route('**/scan?tab=pipeline&stage=raw*', async (route) => {
      const response = await route.fetch();
      let text = await response.text();

      text = text.replace('productionChapters:[', 'productionChapters:[' + JSON.stringify(availableChapter) + ',' + JSON.stringify(myChapter) + ',');
      text = text.replace('chapterStages:[', 'chapterStages:[' + JSON.stringify(availableStage) + ',' + JSON.stringify(myStage) + ',');
      text = text.replace('productionFiles:[', 'productionFiles:[' + JSON.stringify(myFile) + ',');

      await route.fulfill({
        response,
        body: text,
        headers: { ...response.headers(), 'content-type': 'text/html' }
      });
    });
  }

  // -------------------------------------------------------------
  // 1. DESKTOP 1440 - Both Sections Populated (Scenarios B, C, E)
  // -------------------------------------------------------------
  console.log('\n--- 1. Desktop 1440 with Populated Data ---');
  const dCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await dCtx.addCookies(cookies);
  const dPage = await dCtx.newPage();
  await setupRoute(dPage);
  await dPage.goto(`${targetUrl}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle', timeout: 45000 });
  await dPage.waitForSelector('.raw-provider-root', { timeout: 25000 });
  await dPage.waitForTimeout(1000);

  const desktopPopulatedMetrics = await dPage.evaluate(() => {
    const availCard = document.querySelector('.available-card')?.getBoundingClientRect();
    const myCard = document.querySelector('.my-card')?.getBoundingClientRect();
    const header = document.querySelector('.raw-header')?.getBoundingClientRect();
    const btnNovo = document.querySelector('.btn-novo-capitulo')?.getBoundingClientRect();

    return {
      headerH: header ? Math.round(header.height) : 0,
      btnNovoW: btnNovo ? Math.round(btnNovo.width) : 0,
      availCardW: availCard ? Math.round(availCard.width) : 0,
      myCardW: myCard ? Math.round(myCard.width) : 0,
      sideBySide: availCard && myCard ? Math.abs(availCard.top - myCard.top) < 15 : false
    };
  });
  console.log('Desktop Populated Metrics:', desktopPopulatedMetrics);
  await dPage.screenshot({ path: `${artifactDir}/raw_desktop_1440_both_sections_populated.png`, fullPage: false });

  // Expand Upload Accordion in Desktop
  const dUploadBtn = dPage.locator('.my-card').first().locator('.btn-toggle-upload');
  if (await dUploadBtn.count() > 0) {
    await dUploadBtn.click();
    await dPage.waitForTimeout(600);
    await dPage.screenshot({ path: `${artifactDir}/raw_desktop_1440_upload_accordion_expanded.png`, fullPage: false });
  }
  await dCtx.close();

  // -------------------------------------------------------------
  // 2. MOBILE 390 - Both Sections Populated (Scenarios B, C, E)
  // -------------------------------------------------------------
  console.log('\n--- 2. Mobile 390 with Populated Data ---');
  const mCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  });
  await mCtx.addCookies(cookies);
  const mPage = await mCtx.newPage();
  await setupRoute(mPage);
  await mPage.goto(`${targetUrl}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle', timeout: 45000 });
  await mPage.waitForSelector('.raw-provider-root', { timeout: 25000 });
  await mPage.waitForTimeout(1000);

  const mobilePopulatedMetrics = await mPage.evaluate(() => {
    const root = document.querySelector('.raw-provider-root')?.getBoundingClientRect();
    const availCard = document.querySelector('.available-card')?.getBoundingClientRect();
    const myCard = document.querySelector('.my-card')?.getBoundingClientRect();
    const btnNovo = document.querySelector('.btn-novo-capitulo')?.getBoundingClientRect();

    return {
      rootW: root ? Math.round(root.width) : 0,
      availCardW: availCard ? Math.round(availCard.width) : 0,
      myCardW: myCard ? Math.round(myCard.width) : 0,
      btnNovoH: btnNovo ? Math.round(btnNovo.height) : 0,
      availOccupancy: availCard && root ? (availCard.width / root.width * 100).toFixed(1) + '%' : null,
      myOccupancy: myCard && root ? (myCard.width / root.width * 100).toFixed(1) + '%' : null
    };
  });
  console.log('Mobile Populated Metrics:', mobilePopulatedMetrics);
  await mPage.screenshot({ path: `${artifactDir}/raw_mobile_390_both_sections_populated.png`, fullPage: false });
  await mPage.screenshot({ path: `${artifactDir}/raw_mobile_390_both_sections_full.png`, fullPage: true });

  // Expand Upload Accordion in Mobile
  const mUploadBtn = mPage.locator('.my-card').first().locator('.btn-toggle-upload');
  if (await mUploadBtn.count() > 0) {
    await mUploadBtn.click();
    await mPage.waitForTimeout(600);
    await mPage.screenshot({ path: `${artifactDir}/raw_mobile_390_upload_accordion_expanded.png`, fullPage: false });
  }
  await mCtx.close();

  // -------------------------------------------------------------
  // 3. GENERATE EVIDENCE CROPS (FOR COMPARISON & ARTICULATION)
  // -------------------------------------------------------------
  console.log('\n--- 3. Generating Visual Crops with Sharp ---');
  const dPopPath = `${artifactDir}/raw_desktop_1440_both_sections_populated.png`;
  const dExpPath = `${artifactDir}/raw_desktop_1440_upload_accordion_expanded.png`;
  const mPopPath = `${artifactDir}/raw_mobile_390_both_sections_populated.png`;

  // Crop Desktop Header
  await sharp(dPopPath)
    .extract({ left: 240, top: 20, width: 1160, height: 160 })
    .toFile(`${artifactDir}/raw_crop_desktop_header_compact.png`);

  // Crop Desktop Available Card
  await sharp(dPopPath)
    .extract({ left: 240, top: 220, width: 575, height: 180 })
    .toFile(`${artifactDir}/raw_crop_desktop_available_card.png`);

  // Crop Desktop My Card with files badge
  await sharp(dPopPath)
    .extract({ left: 825, top: 220, width: 575, height: 180 })
    .toFile(`${artifactDir}/raw_crop_desktop_my_card_with_files.png`);

  // Crop Desktop Accordion Dropzone
  await sharp(dExpPath)
    .extract({ left: 825, top: 220, width: 575, height: 380 })
    .toFile(`${artifactDir}/raw_crop_desktop_accordion_dropzone.png`);

  // Crop Mobile Header & Novo Capítulo Button
  await sharp(mPopPath)
    .extract({ left: 0, top: 0, width: 390, height: 260 })
    .toFile(`${artifactDir}/raw_crop_mobile_header_and_action.png`);

  await browser.close();

  const finalSummary = {
    desktopPopulatedMetrics,
    mobilePopulatedMetrics
  };

  writeFileSync(`${artifactDir}/raw_scenarios_summary.json`, JSON.stringify(finalSummary, null, 2));
  console.log('=== FULL RAW PROVIDER HOMOLOGATION SUITE FINISHED SUCCESSFULLY ===');
}

runFullScenarioSuite().catch(console.error);
