import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { writeFileSync } from 'node:fs';

const targetUrl = 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function captureAndInspect() {
  console.log('=== STARTING RAW PROVIDER INSPECTION ON PREVIEW ===');
  console.log('Target:', targetUrl);

  const cookies = await ownerCookies(targetUrl);
  cookies.push({
    name: 'nox-age-status',
    value: 'ADULT',
    url: targetUrl,
    httpOnly: false,
    sameSite: 'Lax',
    secure: targetUrl.startsWith('https:')
  });

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const inspectionResults = {};

  // 1. DESKTOP VIEWPORTS (1280, 1440, 1920) - Closed Modal
  for (const w of [1280, 1440, 1920]) {
    console.log(`\n--- Desktop ${w}x900 (Closed Modal) ---`);
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    await ctx.addCookies(cookies);
    const page = await ctx.newPage();
    await page.goto(`${targetUrl}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForSelector('.raw-provider-root', { timeout: 25000 });
    await page.waitForTimeout(1000);

    const metrics = await page.evaluate((vpW) => {
      const root = document.querySelector('.raw-provider-root');
      const header = document.querySelector('.raw-header');
      const mainGrid = document.querySelector('.raw-main-grid');
      const availSec = document.querySelector('.raw-available-section');
      const mySec = document.querySelector('.raw-my-section');
      const btnNovo = document.querySelector('.btn-novo-capitulo');

      const b = (el) => el ? {
        w: Math.round(el.getBoundingClientRect().width),
        h: Math.round(el.getBoundingClientRect().height),
        top: Math.round(el.getBoundingClientRect().top)
      } : null;

      return {
        viewportWidth: vpW,
        root: b(root),
        header: b(header),
        mainGrid: b(mainGrid),
        availSec: b(availSec),
        mySec: b(mySec),
        btnNovo: b(btnNovo),
        sideBySide: availSec && mySec ? Math.abs(availSec.getBoundingClientRect().top - mySec.getBoundingClientRect().top) < 15 : false,
        availCount: document.querySelector('.count-available')?.textContent?.trim(),
        myCount: document.querySelector('.count-mine')?.textContent?.trim()
      };
    }, w);

    console.log(`Desktop ${w}px Metrics:`, metrics);
    inspectionResults[`desktop_${w}`] = metrics;
    await page.screenshot({ path: `${artifactDir}/raw_preview_desktop_${w}_closed.png`, fullPage: false });
    if (w === 1440) {
      await page.screenshot({ path: `${artifactDir}/raw_preview_desktop_1440_full.png`, fullPage: true });
    }
    await ctx.close();
  }

  // 2. OPEN NEW CHAPTER MODAL - Desktop 1440
  console.log('\n--- Desktop 1440 (Open Modal) ---');
  const dOpenCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await dOpenCtx.addCookies(cookies);
  const dOpenPage = await dOpenCtx.newPage();
  await dOpenPage.goto(`${targetUrl}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle', timeout: 45000 });
  await dOpenPage.waitForSelector('.btn-novo-capitulo', { timeout: 25000 });
  await dOpenPage.locator('.btn-novo-capitulo').click();
  await dOpenPage.waitForSelector('.modal-card', { timeout: 5000 });
  await dOpenPage.waitForTimeout(500);

  const modalMetrics = await dOpenPage.evaluate(() => {
    const card = document.querySelector('.modal-card');
    const title = document.querySelector('.modal-title')?.textContent?.trim();
    const workSelect = document.querySelector('#new-chapter-work');
    const workOptions = workSelect ? Array.from(workSelect.querySelectorAll('option')).map(o => o.textContent?.trim()) : [];
    const numInput = document.querySelector('#new-chapter-number');
    const priorityPills = Array.from(document.querySelectorAll('.priority-radio-option')).map(p => p.textContent?.trim());
    const autoClaimBox = document.querySelector('input[name="auto_claim"]');

    const b = (el) => el ? {
      w: Math.round(el.getBoundingClientRect().width),
      h: Math.round(el.getBoundingClientRect().height)
    } : null;

    return {
      modalCard: b(card),
      title,
      workOptions,
      hasNumInput: !!numInput,
      priorityPills,
      autoClaimChecked: autoClaimBox ? autoClaimBox.checked : false
    };
  });
  console.log('Modal Metrics (Desktop 1440):', modalMetrics);
  inspectionResults.modalDesktop = modalMetrics;
  await dOpenPage.screenshot({ path: `${artifactDir}/raw_preview_desktop_1440_modal_open.png`, fullPage: false });
  await dOpenCtx.close();

  // 3. MOBILE VIEWPORTS (320, 360, 390, 430) - Closed Modal
  for (const w of [320, 360, 390, 430]) {
    console.log(`\n--- Mobile ${w}x844 (Closed Modal) ---`);
    const mCtx = await browser.newContext({
      viewport: { width: w, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    });
    await mCtx.addCookies(cookies);
    const mPage = await mCtx.newPage();
    await mPage.goto(`${targetUrl}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle', timeout: 45000 });
    await mPage.waitForSelector('.raw-provider-root', { timeout: 25000 });
    await mPage.waitForTimeout(600);

    const mMetrics = await mPage.evaluate((vpW) => {
      const root = document.querySelector('.raw-provider-root');
      const header = document.querySelector('.raw-header');
      const btnNovo = document.querySelector('.btn-novo-capitulo');
      const availSec = document.querySelector('.raw-available-section');
      const mySec = document.querySelector('.raw-my-section');

      const b = (el) => el ? {
        w: Math.round(el.getBoundingClientRect().width),
        h: Math.round(el.getBoundingClientRect().height),
        x: Math.round(el.getBoundingClientRect().x)
      } : null;

      const rootRect = b(root);
      const availRect = b(availSec);
      const myRect = b(mySec);
      const btnRect = b(btnNovo);

      return {
        viewportWidth: vpW,
        root: rootRect,
        availSec: availRect,
        mySec: myRect,
        btnNovo: btnRect,
        isSingleColumn: availRect && myRect ? myRect.h > 0 && Math.abs(availRect.x - myRect.x) < 5 : true,
        availOccupancy: availRect && rootRect ? (availRect.w / rootRect.w * 100).toFixed(1) + '%' : null
      };
    }, w);

    console.log(`Mobile ${w}px Metrics:`, mMetrics);
    inspectionResults[`mobile_${w}`] = mMetrics;
    await mPage.screenshot({ path: `${artifactDir}/raw_preview_mobile_${w}_closed.png`, fullPage: false });
    if (w === 390) {
      await mPage.screenshot({ path: `${artifactDir}/raw_preview_mobile_390_full.png`, fullPage: true });
    }
    await mCtx.close();
  }

  // 4. OPEN NEW CHAPTER MODAL - Mobile 390
  console.log('\n--- Mobile 390 (Open Modal / Drawer) ---');
  const mOpenCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  });
  await mOpenCtx.addCookies(cookies);
  const mOpenPage = await mOpenCtx.newPage();
  await mOpenPage.goto(`${targetUrl}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle', timeout: 45000 });
  await mOpenPage.waitForSelector('.btn-novo-capitulo', { timeout: 25000 });
  await mOpenPage.locator('.btn-novo-capitulo').click();
  await mOpenPage.waitForSelector('.modal-card', { timeout: 5000 });
  await mOpenPage.waitForTimeout(500);

  const mModalMetrics = await mOpenPage.evaluate(() => {
    const card = document.querySelector('.modal-card');
    const submitBtn = document.querySelector('.btn-modal-submit');
    const cancelBtn = document.querySelector('.btn-modal-cancel');
    const b = (el) => el ? {
      w: Math.round(el.getBoundingClientRect().width),
      h: Math.round(el.getBoundingClientRect().height)
    } : null;
    return {
      modalCard: b(card),
      submitBtn: b(submitBtn),
      cancelBtn: b(cancelBtn)
    };
  });
  console.log('Mobile Modal Metrics (390):', mModalMetrics);
  inspectionResults.modalMobile = mModalMetrics;
  await mOpenPage.screenshot({ path: `${artifactDir}/raw_preview_mobile_390_modal_open.png`, fullPage: false });
  await mOpenCtx.close();

  await browser.close();

  writeFileSync(`${artifactDir}/raw_preview_inspection_report.json`, JSON.stringify(inspectionResults, null, 2));
  console.log('\n=== INSPECTION COMPLETED AND REPORT GENERATED ===');
  return inspectionResults;
}

captureAndInspect().catch(console.error);
