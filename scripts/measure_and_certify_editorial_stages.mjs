import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function main() {
  console.log('Running comprehensive certification suite for Editorial Stages...');
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
  const report = {
    targetUrl,
    stages: {},
    responsiveMatrix: {},
    sanityChecks: {}
  };

  try {
    // 1. TEST "AMBOS" TAB & SWITCHING ON DESKTOP
    console.log('Testing "Ambos" tab on Tradução desktop...');
    const deskCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await deskCtx.addCookies(cookies);
    const deskPage = await deskCtx.newPage();

    await deskPage.goto(`${targetUrl}/scan?tab=pipeline&stage=traducao`, { waitUntil: 'networkidle', timeout: 35000 });
    await deskPage.waitForTimeout(1500);

    // Click "Ambos" tab
    const ambosBtn = await deskPage.waitForSelector('button[role="tab"]:has-text("Ambos")', { state: 'visible', timeout: 5000 });
    await ambosBtn.click();
    await deskPage.waitForTimeout(1000);
    await deskPage.screenshot({ path: join(artifactDir, 'preview_traducao_desktop_ambos.png') });

    // Click "Disponíveis" tab
    const dispBtn = await deskPage.waitForSelector('button[role="tab"]:has-text("Disponíveis")', { state: 'visible', timeout: 5000 });
    await dispBtn.click();
    await deskPage.waitForTimeout(1000);
    await deskPage.screenshot({ path: join(artifactDir, 'preview_traducao_desktop_disponiveis_empty.png') });

    // 2. MEASURE RESPONSIVE MATRIX ON ALL THREE STAGES
    const viewports = [
      { width: 320, height: 640, isMobile: true, label: '320px (Mobile Mini)' },
      { width: 360, height: 780, isMobile: true, label: '360px (Standard Android)' },
      { width: 390, height: 844, isMobile: true, label: '390px (iPhone/Pixel)' },
      { width: 430, height: 932, isMobile: true, label: '430px (Large Mobile)' },
      { width: 768, height: 1024, isMobile: false, label: '768px (Tablet)' },
      { width: 1024, height: 768, isMobile: false, label: '1024px (Small Desktop)' },
      { width: 1280, height: 800, isMobile: false, label: '1280px (Standard Desktop)' },
      { width: 1440, height: 900, isMobile: false, label: '1440px (Mac/FHD)' },
      { width: 1920, height: 1080, isMobile: false, label: '1920px (Full HD+)' }
    ];

    for (const stage of ['traducao', 'clean_redraw', 'typeset']) {
      report.stages[stage] = {};

      for (const vp of viewports) {
        const ctx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          userAgent: vp.isMobile
            ? 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
            : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
        });
        await ctx.addCookies(cookies);
        const page = await ctx.newPage();

        await page.goto(`${targetUrl}/scan?tab=pipeline&stage=${stage}`, { waitUntil: 'networkidle', timeout: 35000 });
        await page.waitForTimeout(1000);

        const measurements = await page.evaluate(() => {
          const docEl = document.documentElement;
          const body = document.body;
          const root = document.querySelector('.editorial-workspace-root');
          const header = document.querySelector('.editorial-header');
          const title = document.querySelector('.editorial-title');
          const navBar = document.querySelector('.editorial-nav-bar');
          const contentArea = document.querySelector('.editorial-content-area');
          const emptyCard = document.querySelector('.editorial-empty-card');
          const cards = Array.from(document.querySelectorAll('.editorial-card'));

          const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
          const clientWidth = docEl.clientWidth;
          const hasHorizontalOverflow = scrollWidth > clientWidth + 1;

          return {
            clientWidth,
            scrollWidth,
            hasHorizontalOverflow,
            headerHeight: header ? Math.round(header.getBoundingClientRect().height) : null,
            headerTitleFontSize: title ? window.getComputedStyle(title).fontSize : null,
            navBarHeight: navBar ? Math.round(navBar.getBoundingClientRect().height) : null,
            contentAreaWidth: contentArea ? Math.round(contentArea.getBoundingClientRect().width) : null,
            emptyCardHeight: emptyCard ? Math.round(emptyCard.getBoundingClientRect().height) : null,
            cardCount: cards.length,
            firstCardWidth: cards[0] ? Math.round(cards[0].getBoundingClientRect().width) : null
          };
        });

        report.stages[stage][vp.label] = measurements;
        await ctx.close();
      }
    }

    // Save summary report
    writeFileSync(join(artifactDir, 'editorial_stages_certification_summary.json'), JSON.stringify(report, null, 2));
    console.log('Certification summary generated successfully!');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Certification failed:', err);
  process.exit(1);
});
