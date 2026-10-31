import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';

async function inspectZoomAndScale() {
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
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  await page.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });

  const metrics = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const sidebar = document.querySelector('.workspace-sidebar');
    const content = document.querySelector('.workspace-view-content');
    const root = document.querySelector('.tasks-tab-root');
    const headerTitle = document.querySelector('.tab-title');
    const workTitle = document.querySelector('.task-work-name');
    const tabButtons = Array.from(document.querySelectorAll('.queue-tab-btn'));
    const filterInput = document.querySelector('.filter-input');
    const filterSelect = document.querySelector('.filter-select');
    const card = document.querySelector('.task-compact-card');
    const cover = document.querySelector('.card-visual-col');
    const continueBtn = document.querySelector('.btn-action-continue');
    const filesBtn = document.querySelector('.btn-toggle-expand');

    return {
      windowInnerWidth: window.innerWidth,
      windowInnerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      visualViewportScale: window.visualViewport ? window.visualViewport.scale : null,
      htmlFontSize: window.getComputedStyle(html).fontSize,
      htmlZoom: window.getComputedStyle(html).zoom,
      bodyFontSize: window.getComputedStyle(body).fontSize,
      bodyZoom: window.getComputedStyle(body).zoom,
      sidebarWidth: sidebar ? sidebar.offsetWidth : null,
      contentPadding: content ? window.getComputedStyle(content).padding : null,
      rootWidth: root ? root.offsetWidth : null,
      headerTitle: {
        text: headerTitle ? headerTitle.textContent.trim() : null,
        fontSize: headerTitle ? window.getComputedStyle(headerTitle).fontSize : null,
        lineHeight: headerTitle ? window.getComputedStyle(headerTitle).lineHeight : null,
        height: headerTitle ? headerTitle.offsetHeight : null
      },
      workTitle: {
        text: workTitle ? workTitle.textContent.trim() : null,
        fontSize: workTitle ? window.getComputedStyle(workTitle).fontSize : null,
        fontWeight: workTitle ? window.getComputedStyle(workTitle).fontWeight : null,
        lineHeight: workTitle ? window.getComputedStyle(workTitle).lineHeight : null
      },
      categoryTabs: tabButtons.map(b => ({
        label: b.textContent.replace(/\s+/g, ' ').trim(),
        fontSize: window.getComputedStyle(b).fontSize,
        height: b.offsetHeight
      })),
      controls: {
        filterInputFontSize: filterInput ? window.getComputedStyle(filterInput).fontSize : null,
        filterInputHeight: filterInput ? filterInput.offsetHeight : null,
        filterSelectFontSize: filterSelect ? window.getComputedStyle(filterSelect).fontSize : null,
        filterSelectHeight: filterSelect ? filterSelect.offsetHeight : null
      },
      card: {
        width: card ? card.offsetWidth : null,
        height: card ? card.offsetHeight : null,
        coverSize: cover ? `${cover.offsetWidth}x${cover.offsetHeight}` : null,
        continueBtn: continueBtn ? `${continueBtn.offsetWidth}x${continueBtn.offsetHeight}` : null,
        continueBtnFontSize: continueBtn ? window.getComputedStyle(continueBtn).fontSize : null,
        filesBtn: filesBtn ? `${filesBtn.offsetWidth}x${filesBtn.offsetHeight}` : null,
        filesBtnFontSize: filesBtn ? window.getComputedStyle(filesBtn).fontSize : null
      }
    };
  });

  console.log('=== ZOOM, DPR & SCALE AUDIT ===');
  console.log(JSON.stringify(metrics, null, 2));

  await browser.close();
}

inspectZoomAndScale().catch(err => {
  console.error(err);
  process.exit(1);
});
