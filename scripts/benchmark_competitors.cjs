const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function run() {
  const browser = await chromium.launch({ headless: true });

  // 1. Mobile Webtoon
  const mPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  try {
    await mPage.goto('https://www.webtoons.com/en/fantasy/tower-of-god/list?title_no=95', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await mPage.waitForTimeout(2000);
    await mPage.screenshot({ path: path.join(ARTIFACTS_DIR, 'benchmark_webtoon_mobile.png'), fullPage: false });
    console.log('Saved benchmark_webtoon_mobile.png');
  } catch (e) {
    console.log('Mobile Webtoon error:', e.message);
  }
  await mPage.close();

  // 2. Desktop Nexus Mangas
  const dPage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  try {
    await dPage.goto('https://www.nexusmangas.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await dPage.waitForTimeout(2500);
    const links = await dPage.$$eval('a', as => as.map(a => a.href).filter(h => h.includes('/obra/') || h.includes('/manga/')));
    console.log('Nexus links found:', links.slice(0, 3));
    if (links.length > 0) {
      await dPage.goto(links[0], { waitUntil: 'domcontentloaded', timeout: 15000 });
      await dPage.waitForTimeout(2500);
      await dPage.screenshot({ path: path.join(ARTIFACTS_DIR, 'benchmark_nexus_desktop.png'), fullPage: false });
      console.log('Saved benchmark_nexus_desktop.png');
    }
  } catch (e) {
    console.log('Nexus error:', e.message);
  }

  // 3. MangaToon
  try {
    await dPage.goto('https://mangatoon.mobi/en/detail/1004', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await dPage.waitForTimeout(2000);
    await dPage.screenshot({ path: path.join(ARTIFACTS_DIR, 'benchmark_mangatoon_desktop.png'), fullPage: false });
    console.log('Saved benchmark_mangatoon_desktop.png');
  } catch (e) {
    console.log('MangaToon error:', e.message);
  }

  await browser.close();
  console.log('All benchmark captures finished!');
}

run();
