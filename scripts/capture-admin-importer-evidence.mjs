import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';

const BASE_URL = 'https://manga.project-nox-awerkori.workers.dev';

async function main() {
  console.log('=== CAPTURING ADMIN IMPORTER EVIDENCE (LIVE) ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });

  const cookies = await ownerCookies(BASE_URL);
  await context.addCookies(cookies);

  const page = await context.newPage();
  console.log(`Navigating to ${BASE_URL}/admin/importer...`);
  await page.goto(`${BASE_URL}/admin/importer`, { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for provider blockers container or sources in DOM
  await page.waitForSelector('.provider-blockers-container, .sources-list', { state: 'attached', timeout: 20000 });
  console.log('DOM ready with provider blockers / sources list.');

  // Extract panel subtitle
  const subtitle = await page.textContent('.panel-card .panel-sub');
  console.log(`\nPanel Subtitle:\n  ${subtitle?.replace(/\s+/g, ' ').trim()}`);

  // Extract blocker cards
  const blockerCards = await page.$$eval('.provider-blocker-card', cards => {
    return cards.map(c => {
      const name = c.querySelector('.blocker-name')?.textContent?.trim();
      const badge = c.querySelector('.blocker-badge')?.textContent?.trim();
      const jobsTag = c.querySelector('.blocker-jobs-tag')?.textContent?.trim();
      const leadText = c.querySelector('.blocker-lead-text')?.textContent?.trim();
      return { name, badge, jobsTag, leadText };
    });
  });

  console.log(`\nFound ${blockerCards.length} blocker cards in UI:`);
  for (const b of blockerCards) {
    console.log(`- ${b.name.padEnd(25)} | ${b.jobsTag} | ${b.badge}`);
  }

  // Extract from policy list
  const policyItems = await page.$$eval('.policy-group', groups => {
    return groups.map(g => {
      const title = g.querySelector('h4')?.textContent?.trim();
      const items = Array.from(g.querySelectorAll('div > div')).map(row => row.textContent?.replace(/\s+/g, ' ').trim());
      return { title, items };
    });
  });

  console.log(`\nPolicy groups rendered:`);
  for (const p of policyItems) {
    console.log(`Group: ${p.title}`);
    for (const item of p.items) {
      if (item) console.log(`  - ${item}`);
    }
  }

  // Scroll to section to ensure full visibility in screenshot
  const section = page.locator('.panel-card:has(.provider-blockers-container)');
  if (await section.count() > 0) {
    await section.scrollIntoViewIfNeeded();
  }

  const screenshotPath = '/home/awerkori/.gemini/antigravity-cli/brain/95c47e53-0595-4b82-8dd6-842c33cdedc3/admin-importer-fixed-counts.png';
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`\nSaved screenshot to: ${screenshotPath}`);

  await browser.close();
}

main().catch(console.error);
