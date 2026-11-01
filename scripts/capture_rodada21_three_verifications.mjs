import { existsSync } from 'node:fs';
if (existsSync('/home/awerkori/.Projects/project-nox-manga/.dev.vars.preview_full')) {
  process.loadEnvFile('/home/awerkori/.Projects/project-nox-manga/.dev.vars.preview_full');
}
import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function main() {
  console.log(`Starting Rodada 21 Three Final Verifications on ${targetUrl}...`);
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
  const results = { checks: {}, captured: [] };

  try {
    // ========================================================================
    // 1. DESKTOP EXPANDED PROPORTIONS (1440px)
    // ========================================================================
    console.log('--- 1. Desktop Expanded Proportions (1440px) ---');
    const deskCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await deskCtx.addCookies(cookies);
    const deskPage = await deskCtx.newPage();

    await deskPage.goto(`${targetUrl}/scan?tab=pipeline&stage=traducao`, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(1500);

    // Expand chapter
    const deskOpenBtn = deskPage.locator('.btn-action-open-work').first();
    if (await deskOpenBtn.count() > 0) {
      await deskOpenBtn.click();
      await deskPage.waitForTimeout(1500);
    }

    const deskCardMetrics = await deskPage.evaluate(() => {
      const card = document.querySelector('.editorial-card.is-expanded');
      const footer = document.querySelector('.workspace-actions-footer');
      const fileRow = document.querySelector('.delivery-file-row');
      const dropzone = document.querySelector('.delivery-dropzone');
      return {
        cardWidth: card ? card.getBoundingClientRect().width : null,
        footerWidth: footer ? footer.getBoundingClientRect().width : null,
        fileRowWidth: fileRow ? fileRow.getBoundingClientRect().width : null,
        dropzoneWidth: dropzone ? dropzone.getBoundingClientRect().width : null
      };
    });
    results.checks.desktopProportions = deskCardMetrics;
    console.log('Desktop Expanded Metrics:', deskCardMetrics);

    const pDesk = join(artifactDir, 'verify_desktop_expanded_proportions.png');
    await deskPage.screenshot({ path: pDesk });
    results.captured.push('verify_desktop_expanded_proportions.png');

    // ========================================================================
    // 2. PIPELINE STATES VERIFICATION (DESKTOP + MOBILE)
    // ========================================================================
    console.log('--- 2. Pipeline States Verification (Chapter 84) ---');
    const chapterUrl = `${targetUrl}/scan?tab=capitulo&stage=traducao&id=9cb8d2dd-d009-478f-ad0f-01db3661a1dd&from_stage=traducao`;
    await deskPage.goto(chapterUrl, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(1500);

    const pipelineNodesDesk = await deskPage.evaluate(() => {
      return Array.from(document.querySelectorAll('.flow-stage-node')).map(el => ({
        step: el.querySelector('.node-step-tag')?.textContent?.trim(),
        title: el.querySelector('.node-title')?.textContent?.trim(),
        status: el.querySelector('.node-status-pill')?.textContent?.trim(),
        assignee: el.querySelector('.node-assignee')?.textContent?.trim()
      }));
    });
    results.checks.pipelineNodes = pipelineNodesDesk;
    console.log('Desktop Pipeline Nodes:', pipelineNodesDesk);

    const pNodesDesk = join(artifactDir, 'verify_pipeline_states_chapter84_desk.png');
    await deskPage.screenshot({ path: pNodesDesk });
    results.captured.push('verify_pipeline_states_chapter84_desk.png');

    // ========================================================================
    // 3. ANDROID MOBILE EXPANDED BOTTOM CLEARANCE (390px)
    // ========================================================================
    console.log('--- 3. Android Mobile Expanded Bottom Clearance (390px) ---');
    const mobCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
    });
    await mobCtx.addCookies(cookies);
    const mobPage = await mobCtx.newPage();

    // 3.1 Mobile Pipeline States
    await mobPage.goto(chapterUrl, { waitUntil: 'networkidle', timeout: 35000 });
    await mobPage.waitForTimeout(1500);
    const pNodesMob = join(artifactDir, 'verify_pipeline_states_chapter84_mob.png');
    await mobPage.screenshot({ path: pNodesMob });
    results.captured.push('verify_pipeline_states_chapter84_mob.png');

    // 3.2 Mobile Expanded Work & Bottom Nav Clearance
    await mobPage.goto(`${targetUrl}/scan?tab=pipeline&stage=traducao`, { waitUntil: 'networkidle', timeout: 35000 });
    await mobPage.waitForTimeout(1500);

    const mobOpenBtn = mobPage.locator('.btn-action-open-work').first();
    await mobOpenBtn.click();
    await mobPage.waitForTimeout(1500);

    // Scroll the app shell scroll container (.workspace-main-area) to the bottom
    const mobScrollResult = await mobPage.evaluate(() => {
      const mainArea = document.querySelector('.workspace-main-area');
      if (mainArea) {
        mainArea.scrollTo({ top: mainArea.scrollHeight, behavior: 'instant' });
      }

      const concludeBtn = document.querySelector('.btn-concluir-workspace');
      const releaseBtn = document.querySelector('.btn-release-queue');
      const bottomNav = document.querySelector('.scan-mobile-bottom-bar');

      return {
        scrollTop: mainArea ? mainArea.scrollTop : 0,
        scrollHeight: mainArea ? mainArea.scrollHeight : 0,
        clientHeight: mainArea ? mainArea.clientHeight : 0,
        release: releaseBtn ? releaseBtn.getBoundingClientRect() : null,
        conclude: concludeBtn ? concludeBtn.getBoundingClientRect() : null,
        bottomNav: bottomNav ? bottomNav.getBoundingClientRect() : null,
        clearancePixels: (bottomNav && concludeBtn) ? bottomNav.getBoundingClientRect().top - concludeBtn.getBoundingClientRect().bottom : null
      };
    });
    results.checks.androidClearance = mobScrollResult;
    console.log('Mobile Main Area Scroll Result:', mobScrollResult);

    await mobPage.waitForTimeout(1000);
    const pMobBottom = join(artifactDir, 'verify_android_expanded_bottom_clearance.png');
    await mobPage.screenshot({ path: pMobBottom });
    results.captured.push('verify_android_expanded_bottom_clearance.png');

    results.status = 'SUCCESS';
  } catch (err) {
    console.error('Error during verifications:', err);
    results.status = 'ERROR';
    results.error = err.message;
  } finally {
    writeFileSync(join(artifactDir, 'verify_rodada21_three_points.json'), JSON.stringify(results, null, 2));
    await browser.close();
  }
}

main().catch(console.error);
