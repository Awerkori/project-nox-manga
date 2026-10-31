import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function main() {
  console.log(`Starting Rodada 21 Final Polish Captures on ${targetUrl}...`);
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
  const report = { checks: {}, captured: [] };

  try {
    // ========================================================================
    // 1. MOBILE TESTS (390px Pixel 8 / iPhone 14 style)
    // ========================================================================
    console.log('--- 1. Testing Mobile (390px) ---');
    const mobCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
    });
    await mobCtx.addCookies(cookies);
    const mobPage = await mobCtx.newPage();

    // 1.1 Tradução Collapsed
    await mobPage.goto(`${targetUrl}/scan?tab=pipeline&stage=traducao`, { waitUntil: 'networkidle', timeout: 35000 });
    await mobPage.waitForTimeout(1500);
    const p1 = join(artifactDir, 'polish_traducao_mob_collapsed.png');
    await mobPage.screenshot({ path: p1 });
    report.captured.push('polish_traducao_mob_collapsed.png');

    // 1.2 Tradução Expanded (Toggle "Abrir trabalho")
    const openBtn = mobPage.locator('.btn-action-open-work').first();
    if (await openBtn.count() > 0) {
      await openBtn.click();
      await mobPage.waitForTimeout(1200);
      const p2 = join(artifactDir, 'polish_traducao_mob_expanded_top.png');
      await mobPage.screenshot({ path: p2 });
      report.captured.push('polish_traducao_mob_expanded_top.png');

      // Scroll to bottom of expanded card to verify clearance over bottom nav
      await mobPage.evaluate(() => {
        const footer = document.querySelector('.workspace-actions-footer');
        if (footer) footer.scrollIntoView({ block: 'center' });
      });
      await mobPage.waitForTimeout(1000);
      const p3 = join(artifactDir, 'polish_traducao_mob_expanded_bottom_scroll.png');
      await mobPage.screenshot({ path: p3 });
      report.captured.push('polish_traducao_mob_expanded_bottom_scroll.png');

      // Measure clearance between bottom button and bottom nav
      const clearance = await mobPage.evaluate(() => {
        const btn = document.querySelector('.btn-concluir-workspace') || document.querySelector('.btn-release-queue');
        const nav = document.querySelector('.scan-mobile-bottom-bar');
        if (!btn || !nav) return null;
        const btnRect = btn.getBoundingClientRect();
        const navRect = nav.getBoundingClientRect();
        return {
          btnBottom: btnRect.bottom,
          navTop: navRect.top,
          clearancePixels: navRect.top - btnRect.bottom
        };
      });
      report.checks.mobileBottomClearance = clearance;
      console.log('Mobile Bottom Clearance:', clearance);

      // Collapse back
      const collapseBtn = mobPage.locator('.btn-action-open-work').first();
      await collapseBtn.click();
      await mobPage.waitForTimeout(600);
    }

    // 1.3 Chapter Details - Overview
    await mobPage.goto(`${targetUrl}/scan?tab=capitulo&stage=traducao&id=9cb8d2dd-d009-478f-ad0f-01db3661a1dd&from_stage=traducao`, { waitUntil: 'networkidle', timeout: 35000 });
    await mobPage.waitForTimeout(1500);
    const p4 = join(artifactDir, 'polish_chapter_details_mob_overview.png');
    await mobPage.screenshot({ path: p4 });
    report.captured.push('polish_chapter_details_mob_overview.png');

    // 1.4 Chapter Details - Equipe
    await mobPage.locator('.details-tab-btn', { hasText: 'Equipe' }).click();
    await mobPage.waitForTimeout(800);
    const p5 = join(artifactDir, 'polish_chapter_details_mob_team.png');
    await mobPage.screenshot({ path: p5 });
    report.captured.push('polish_chapter_details_mob_team.png');

    // 1.5 Chapter Details - Comentários (COMPACT CARDS VERIFICATION)
    await mobPage.locator('.details-tab-btn', { hasText: 'Comentários' }).click();
    await mobPage.waitForTimeout(800);
    const p6 = join(artifactDir, 'polish_chapter_details_mob_comments.png');
    await mobPage.screenshot({ path: p6 });
    report.captured.push('polish_chapter_details_mob_comments.png');

    // Measure comment card height on mobile
    const commentHeights = await mobPage.evaluate(() => {
      return Array.from(document.querySelectorAll('.comment-card')).map(c => c.getBoundingClientRect().height);
    });
    report.checks.commentHeights = commentHeights;
    console.log('Comment card heights:', commentHeights);

    // 1.6 Mobile 360px and 320px narrow checks
    await mobPage.setViewportSize({ width: 360, height: 780 });
    await mobPage.waitForTimeout(500);
    const p7 = join(artifactDir, 'polish_chapter_details_mob_360.png');
    await mobPage.screenshot({ path: p7 });
    report.captured.push('polish_chapter_details_mob_360.png');

    await mobPage.setViewportSize({ width: 320, height: 640 });
    await mobPage.waitForTimeout(500);
    const p8 = join(artifactDir, 'polish_chapter_details_mob_320.png');
    await mobPage.screenshot({ path: p8 });
    report.captured.push('polish_chapter_details_mob_320.png');

    // ========================================================================
    // 2. DESKTOP TESTS (1440px)
    // ========================================================================
    console.log('--- 2. Testing Desktop (1440px) ---');
    const deskCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await deskCtx.addCookies(cookies);
    const deskPage = await deskCtx.newPage();

    // 2.1 Tradução Desktop (Proportional Card)
    await deskPage.goto(`${targetUrl}/scan?tab=pipeline&stage=traducao`, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(1500);
    const p9 = join(artifactDir, 'polish_traducao_desk_collapsed.png');
    await deskPage.screenshot({ path: p9 });
    report.captured.push('polish_traducao_desk_collapsed.png');

    // 2.2 Tradução Desktop Expanded (Full Width Grid Span)
    const deskOpenBtn = deskPage.locator('.btn-action-open-work').first();
    if (await deskOpenBtn.count() > 0) {
      await deskOpenBtn.click();
      await deskPage.waitForTimeout(1200);
      const p10 = join(artifactDir, 'polish_traducao_desk_expanded.png');
      await deskPage.screenshot({ path: p10 });
      report.captured.push('polish_traducao_desk_expanded.png');
    }

    // 2.3 Clean / Redraw Desktop
    await deskPage.goto(`${targetUrl}/scan?tab=pipeline&stage=clean`, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(1500);
    const p11 = join(artifactDir, 'polish_clean_desk.png');
    await deskPage.screenshot({ path: p11 });
    report.captured.push('polish_clean_desk.png');

    // 2.4 Typeset Desktop
    await deskPage.goto(`${targetUrl}/scan?tab=pipeline&stage=typeset`, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(1500);
    const p12 = join(artifactDir, 'polish_typeset_desk.png');
    await deskPage.screenshot({ path: p12 });
    report.captured.push('polish_typeset_desk.png');

    // 2.5 Chapter Details Desktop - Overview Flow (7 Nodes)
    await deskPage.goto(`${targetUrl}/scan?tab=capitulo&stage=traducao&id=9cb8d2dd-d009-478f-ad0f-01db3661a1dd&from_stage=traducao`, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(1500);
    const p13 = join(artifactDir, 'polish_chapter_details_desk_overview.png');
    await deskPage.screenshot({ path: p13 });
    report.captured.push('polish_chapter_details_desk_overview.png');

    // 2.6 Chapter Details Desktop - Comments
    await deskPage.locator('.details-tab-btn', { hasText: 'Comentários' }).click();
    await deskPage.waitForTimeout(800);
    const p14 = join(artifactDir, 'polish_chapter_details_desk_comments.png');
    await deskPage.screenshot({ path: p14 });
    report.captured.push('polish_chapter_details_desk_comments.png');

    // ========================================================================
    // 3. SANITY VERIFICATION (Visão Geral V6.6, Minha Fila, Raw Provider)
    // ========================================================================
    console.log('--- 3. Sanity Checks ---');
    await deskPage.goto(`${targetUrl}/scan?tab=home`, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(1200);
    await deskPage.screenshot({ path: join(artifactDir, 'sanity_v6_6_home.png') });

    await deskPage.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(1200);
    await deskPage.screenshot({ path: join(artifactDir, 'sanity_minha_fila_v21.png') });

    await deskPage.goto(`${targetUrl}/scan?tab=pipeline&stage=raw`, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(1200);
    await deskPage.screenshot({ path: join(artifactDir, 'sanity_raw_provider_v21.png') });

    report.status = 'SUCCESS';
    console.log('All captures and verifications completed successfully!');
  } catch (err) {
    console.error('Error in capture suite:', err);
    report.status = 'ERROR';
    report.error = String(err?.message || err);
  } finally {
    await browser.close();
  }

  writeFileSync(join(artifactDir, 'polish_rodada21_report.json'), JSON.stringify(report, null, 2));
}

main().catch(console.error);
