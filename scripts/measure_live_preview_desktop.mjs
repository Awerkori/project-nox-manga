import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';

async function measureLive() {
  const cookies = await ownerCookies(targetUrl);
  cookies.push({
    name: 'nox-age-status',
    value: 'ADULT',
    url: targetUrl,
    httpOnly: false,
    sameSite: 'Lax',
    secure: targetUrl.startsWith('https:')
  });

  const viewports = [
    { width: 1280, height: 800, label: '1280x800' },
    { width: 1366, height: 768, label: '1366x768' },
    { width: 1440, height: 900, label: '1440x900' },
    { width: 1792, height: 900, label: '1792x900' },
    { width: 1920, height: 1080, label: '1920x1080' },
  ];

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await ctx.addCookies(cookies);
    const page = await ctx.newPage();
    await page.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.tasks-tab-root', { state: 'visible', timeout: 15000 });

    const m = await page.evaluate(() => {
      const sidebar = document.querySelector('.workspace-sidebar');
      const content = document.querySelector('.workspace-view-content');
      const root = document.querySelector('.tasks-tab-root');
      const cardList = document.querySelector('.cards-vertical-list');
      const cards = Array.from(document.querySelectorAll('.task-compact-card'));
      const header = document.querySelector('.queue-header-bar');
      const navStrip = document.querySelector('.queue-nav-strip');
      const searchBox = document.querySelector('.desktop-search');
      const filters = document.querySelector('.desktop-filters');

      const sRect = sidebar ? sidebar.getBoundingClientRect() : { width: 0, right: 0 };
      const cRect = content ? content.getBoundingClientRect() : { width: 0, left: 0, right: 0 };
      const rRect = root ? root.getBoundingClientRect() : { width: 0, left: 0, right: 0 };
      const lRect = cardList ? cardList.getBoundingClientRect() : { width: 0, left: 0, right: 0 };

      const cardDetails = cards.map((c, i) => {
        const rect = c.getBoundingClientRect();
        const titleEl = c.querySelector('.task-work-name');
        const coverEl = c.querySelector('.card-visual-col');
        const continueBtn = c.querySelector('.btn-action-continue');
        const filesBtn = c.querySelector('.btn-toggle-expand');
        const pills = Array.from(c.querySelectorAll('.meta-pill')).map(p => p.textContent.trim());

        return {
          index: i,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          title: titleEl ? titleEl.textContent.trim() : null,
          titleFontSize: titleEl ? window.getComputedStyle(titleEl).fontSize : null,
          coverSize: coverEl ? `${coverEl.offsetWidth}x${coverEl.offsetHeight}` : null,
          continueBtnSize: continueBtn ? `${continueBtn.offsetWidth}x${continueBtn.offsetHeight}` : null,
          filesBtnSize: filesBtn ? `${filesBtn.offsetWidth}x${filesBtn.offsetHeight}` : null,
          pills
        };
      });

      return {
        viewportWidth: window.innerWidth,
        devicePixelRatio: window.devicePixelRatio,
        sidebarWidth: Math.round(sRect.width),
        availableAfterSidebar: Math.round(window.innerWidth - sRect.right),
        contentPadding: content ? window.getComputedStyle(content).padding : null,
        rootWidth: Math.round(rRect.width),
        rootLeft: Math.round(rRect.left),
        rootRight: Math.round(rRect.right),
        emptySpaceRight: Math.round(window.innerWidth - rRect.right),
        cardListDisplay: cardList ? window.getComputedStyle(cardList).display : null,
        cardListCols: cardList ? window.getComputedStyle(cardList).gridTemplateColumns : null,
        headerHeight: header ? Math.round(header.offsetHeight) : null,
        cardsCount: cards.length,
        cards: cardDetails
      };
    });

    console.log(`\n=== Viewport: ${vp.label} ===`);
    console.log(JSON.stringify(m, null, 2));

    await ctx.close();
  }

  await browser.close();
}

measureLive().catch(err => {
  console.error(err);
  process.exit(1);
});
