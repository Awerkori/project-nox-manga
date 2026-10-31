import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';

const targetUrl = 'https://home-preview-manga.project-nox-awerkori.workers.dev';

async function diagnose() {
  const cookies = await ownerCookies(targetUrl);
  cookies.push({
    name: 'nox-age-status',
    value: 'ADULT',
    url: targetUrl,
    httpOnly: false,
    sameSite: 'Lax',
    secure: true
  });

  const browser = await chromium.launch();

  for (const vp of [{ w: 1440, h: 900 }, { w: 1680, h: 1050 }, { w: 1920, h: 1080 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    await ctx.addCookies(cookies);
    const page = await ctx.newPage();
    await page.goto(`${targetUrl}/scan?tab=minha_fila`);
    await page.waitForSelector('.tasks-tab-root');

    const data = await page.evaluate(() => {
      const root = document.querySelector('.tasks-tab-root');
      const cs = window.getComputedStyle(root);
      const rect = root.getBoundingClientRect();
      const parentRect = root.parentElement.getBoundingClientRect();
      const parentCs = window.getComputedStyle(root.parentElement);
      const sidebar = document.querySelector('.workspace-sidebar') || document.querySelector('aside');
      const sideRect = sidebar ? sidebar.getBoundingClientRect() : null;
      const cards = Array.from(document.querySelectorAll('.task-compact-card'));
      const header = document.querySelector('.queue-header-bar');
      const nav = document.querySelector('.queue-nav-strip');
      const filters = document.querySelector('.filter-controls-row');

      return {
        viewportWidth: window.innerWidth,
        devicePixelRatio: window.devicePixelRatio,
        sidebarWidth: sideRect?.width,
        parentWidth: parentRect.width,
        parentPaddingLeft: parentCs.paddingLeft,
        parentPaddingRight: parentCs.paddingRight,
        rootWidth: rect.width,
        rootLeft: rect.left,
        rootRight: rect.right,
        rootMaxWidth: cs.maxWidth,
        rootMargin: cs.margin,
        headerWidth: header?.getBoundingClientRect().width,
        navWidth: nav?.getBoundingClientRect().width,
        filtersWidth: filters?.getBoundingClientRect().width,
        cardWidths: cards.map(c => c.getBoundingClientRect().width),
        unoccupiedRightSpace: window.innerWidth - rect.right
      };
    });

    console.log(`Viewport ${vp.w}x${vp.h}:`, JSON.stringify(data, null, 2));
    await ctx.close();
  }

  await browser.close();
}

diagnose();
