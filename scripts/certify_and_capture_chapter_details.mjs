import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function main() {
  console.log(`Starting Chapter Details Certification on ${targetUrl}...`);
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
  const results = {
    checks: {},
    screenshots: []
  };

  try {
    // ------------------------------------------------------------------------
    // 1. DESKTOP WORKSPACE & DETAILS NAVIGATION
    // ------------------------------------------------------------------------
    console.log('Testing Desktop 1440x900...');
    const deskCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await deskCtx.addCookies(cookies);
    const deskPage = await deskCtx.newPage();

    // Go to Tradução
    await deskPage.goto(`${targetUrl}/scan?tab=pipeline&stage=traducao`, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(2000);

    // Capture Tradução stage view showing the cards with "Ver detalhes →"
    const traducaoCardScreenshot = join(artifactDir, 'preview_traducao_desktop_with_details_btn.png');
    await deskPage.screenshot({ path: traducaoCardScreenshot, fullPage: false });
    results.screenshots.push('preview_traducao_desktop_with_details_btn.png');
    console.log('Captured preview_traducao_desktop_with_details_btn.png');

    // Find and click "Ver detalhes" button on first card
    const detailsBtn = deskPage.locator('.btn-action-view-details').first();
    const hasDetailsBtn = await detailsBtn.count() > 0;
    results.checks.hasDetailsBtnOnCard = hasDetailsBtn;
    console.log(`Has "Ver detalhes" button on card: ${hasDetailsBtn}`);

    if (hasDetailsBtn) {
      await detailsBtn.click();
      await deskPage.waitForTimeout(1500);
    }

    const currentUrlAfterClick = deskPage.url();
    results.checks.urlAfterClick = currentUrlAfterClick;
    console.log(`URL after clicking "Ver detalhes": ${currentUrlAfterClick}`);
    const hasCapituloTab = currentUrlAfterClick.includes('tab=capitulo');
    results.checks.hasCapituloTab = hasCapituloTab;

    // Capture Desktop Chapter Details - Tab 1: Visão Geral
    const detailsOverviewScreenshot = join(artifactDir, 'preview_chapter_details_desktop_overview.png');
    await deskPage.screenshot({ path: detailsOverviewScreenshot, fullPage: false });
    results.screenshots.push('preview_chapter_details_desktop_overview.png');
    console.log('Captured preview_chapter_details_desktop_overview.png');

    // Click Tab 2: Créditos e Equipe
    const teamTabBtn = deskPage.locator('.details-tab-btn', { hasText: 'Créditos e Equipe' });
    if (await teamTabBtn.count() > 0) {
      await teamTabBtn.click();
      await deskPage.waitForTimeout(800);
      const detailsTeamScreenshot = join(artifactDir, 'preview_chapter_details_desktop_team.png');
      await deskPage.screenshot({ path: detailsTeamScreenshot, fullPage: false });
      results.screenshots.push('preview_chapter_details_desktop_team.png');
      console.log('Captured preview_chapter_details_desktop_team.png');

      // Test Copy Credits Button
      const copyBtn = deskPage.locator('.btn-copy-credits');
      if (await copyBtn.count() > 0) {
        await copyBtn.click();
        await deskPage.waitForTimeout(500);
        results.checks.copiedCreditsFeedback = await deskPage.locator('.btn-copy-credits').innerText();
      }
    }

    // Click Tab 3: Comentários
    const commentsTabBtn = deskPage.locator('.details-tab-btn', { hasText: 'Comentários' });
    if (await commentsTabBtn.count() > 0) {
      await commentsTabBtn.click();
      await deskPage.waitForTimeout(800);

      // Post a test internal observation
      const textarea = deskPage.locator('#chapter-note-input');
      if (await textarea.count() > 0) {
        await textarea.fill('Na página 12 deixei uma anotação de tradução ambígua para conferência no Typeset.');
        const selectKind = deskPage.locator('#chapter-note-kind');
        if (await selectKind.count() > 0) {
          await selectKind.selectOption('IMPORTANT');
        }
        const sendBtn = deskPage.locator('.btn-send-note');
        await sendBtn.click();
        await deskPage.waitForTimeout(2000);
      }

      const detailsCommentsScreenshot = join(artifactDir, 'preview_chapter_details_desktop_comments.png');
      await deskPage.screenshot({ path: detailsCommentsScreenshot, fullPage: false });
      results.screenshots.push('preview_chapter_details_desktop_comments.png');
      console.log('Captured preview_chapter_details_desktop_comments.png');
    }

    // Test Back button
    const backBtn = deskPage.locator('.btn-back-stage');
    if (await backBtn.count() > 0) {
      await backBtn.click();
      await deskPage.waitForTimeout(1500);
      results.checks.urlAfterBack = deskPage.url();
      console.log(`URL after clicking Back button: ${deskPage.url()}`);
    }

    // ------------------------------------------------------------------------
    // 2. ANDROID MOBILE TESTING (390px, 360px, 320px)
    // ------------------------------------------------------------------------
    console.log('Testing Android Mobile...');
    const mobCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
    });
    await mobCtx.addCookies(cookies);
    const mobPage = await mobCtx.newPage();

    // Visit Tradução mobile
    await mobPage.goto(`${targetUrl}/scan?tab=pipeline&stage=traducao`, { waitUntil: 'networkidle', timeout: 35000 });
    await mobPage.waitForTimeout(2000);

    const mobCardScreenshot = join(artifactDir, 'preview_traducao_android_with_details_btn.png');
    await mobPage.screenshot({ path: mobCardScreenshot, fullPage: false });
    results.screenshots.push('preview_traducao_android_with_details_btn.png');
    console.log('Captured preview_traducao_android_with_details_btn.png');

    // Click "Ver detalhes" on mobile
    const mobDetailsBtn = mobPage.locator('.btn-action-view-details').first();
    if (await mobDetailsBtn.count() > 0) {
      await mobDetailsBtn.click();
      await mobPage.waitForTimeout(1500);
    }

    // Mobile Chapter Details - Tab 1: Visão Geral (Vertical Timeline)
    const mobOverviewScreenshot = join(artifactDir, 'preview_chapter_details_android_overview.png');
    await mobPage.screenshot({ path: mobOverviewScreenshot, fullPage: false });
    results.screenshots.push('preview_chapter_details_android_overview.png');
    console.log('Captured preview_chapter_details_android_overview.png');

    // Mobile Chapter Details - Tab 2: Equipe
    const mobTeamTab = mobPage.locator('.details-tab-btn', { hasText: 'Equipe' });
    if (await mobTeamTab.count() > 0) {
      await mobTeamTab.click();
      await mobPage.waitForTimeout(800);
      const mobTeamScreenshot = join(artifactDir, 'preview_chapter_details_android_team.png');
      await mobPage.screenshot({ path: mobTeamScreenshot, fullPage: false });
      results.screenshots.push('preview_chapter_details_android_team.png');
      console.log('Captured preview_chapter_details_android_team.png');
    }

    // Mobile Chapter Details - Tab 3: Comentários
    const mobCommentsTab = mobPage.locator('.details-tab-btn', { hasText: 'Comentários' });
    if (await mobCommentsTab.count() > 0) {
      await mobCommentsTab.click();
      await mobPage.waitForTimeout(800);
      const mobCommentsScreenshot = join(artifactDir, 'preview_chapter_details_android_comments.png');
      await mobPage.screenshot({ path: mobCommentsScreenshot, fullPage: false });
      results.screenshots.push('preview_chapter_details_android_comments.png');
      console.log('Captured preview_chapter_details_android_comments.png');

      // Focus textarea to simulate virtual keyboard active area
      const mobTextarea = mobPage.locator('#chapter-note-input');
      if (await mobTextarea.count() > 0) {
        await mobTextarea.focus();
        await mobPage.waitForTimeout(500);
        const mobActiveInputScreenshot = join(artifactDir, 'preview_chapter_details_android_active_composer.png');
        await mobPage.screenshot({ path: mobActiveInputScreenshot, fullPage: false });
        results.screenshots.push('preview_chapter_details_android_active_composer.png');
        console.log('Captured preview_chapter_details_android_active_composer.png');
      }
    }

    // Test Android 360px and 320px viewports
    await mobPage.setViewportSize({ width: 360, height: 780 });
    await mobPage.waitForTimeout(500);
    await mobPage.screenshot({ path: join(artifactDir, 'preview_chapter_details_android_360.png'), fullPage: false });
    results.screenshots.push('preview_chapter_details_android_360.png');

    await mobPage.setViewportSize({ width: 320, height: 640 });
    await mobPage.waitForTimeout(500);
    await mobPage.screenshot({ path: join(artifactDir, 'preview_chapter_details_android_320.png'), fullPage: false });
    results.screenshots.push('preview_chapter_details_android_320.png');

    // ------------------------------------------------------------------------
    // 3. SANITY CHECK: Visão Geral V6.6, Minha Fila, Raw Provider
    // ------------------------------------------------------------------------
    console.log('Sanity verification...');
    await deskPage.goto(`${targetUrl}/scan?tab=home`, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(1500);
    await deskPage.screenshot({ path: join(artifactDir, 'sanity_v6_6_home.png'), fullPage: false });
    results.screenshots.push('sanity_v6_6_home.png');

    await deskPage.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(1500);
    await deskPage.screenshot({ path: join(artifactDir, 'sanity_minha_fila_v21.png'), fullPage: false });
    results.screenshots.push('sanity_minha_fila_v21.png');

    await deskPage.goto(`${targetUrl}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(1500);
    await deskPage.screenshot({ path: join(artifactDir, 'sanity_raw_provider_v21.png'), fullPage: false });
    results.screenshots.push('sanity_raw_provider_v21.png');

    results.status = 'SUCCESS';
  } catch (err) {
    console.error('Error during certification:', err);
    results.status = 'ERROR';
    results.error = String(err?.message || err);
  } finally {
    await browser.close();
  }

  writeFileSync(join(artifactDir, 'chapter_details_certification.json'), JSON.stringify(results, null, 2));
  console.log('Certification complete. Results saved.');
}

main().catch(console.error);
