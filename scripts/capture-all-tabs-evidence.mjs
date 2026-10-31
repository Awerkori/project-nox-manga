import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';

const targetUrl = process.env.BENCHMARK_TARGET_URL || 'https://home-preview-manga.project-nox-awerkori.workers.dev';
const artifactDir = '/home/awerkori/.gemini/antigravity-cli/brain/fa6d1923-db0b-428b-bc07-4973adaffd49';

async function captureEvidence() {
  console.log('=== CAPTURING EVIDENCE ACROSS KEY TABS ===');
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

  await page.goto(`${targetUrl}/scan?tab=home`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.workspace-overview-container', { timeout: 15000 });

  const tabs = [
    { id: 'home', name: 'Início', selector: 'button:has-text("Início")', check: '.workspace-overview-container' },
    { id: 'minha_fila', name: 'Minha Fila', selector: 'button:has-text("Minha Fila")', check: '.tasks-tab-root' },
    { id: 'pipeline', name: 'Área de Produção', selector: 'button:has-text("Área de Produção")', check: '.pipeline-stage-view-root' },
    { id: 'obras', name: 'Obras da Scan', selector: 'button:has-text("Obras da Scan")', check: '.dash-columns' },
    { id: 'mural', name: 'Mural', selector: 'button:has-text("Mural")', check: '.mural-container' },
    { id: 'chat', name: 'Chat', selector: 'button:has-text("Chat")', check: '.chat-module-root' }
  ];

  for (const t of tabs) {
    console.log(`Capturing tab: ${t.name}...`);
    await page.locator(t.selector).first().click();
    await page.locator(t.check).first().waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(400);
    const path = `${artifactDir}/perf_evidence_desktop_${t.id}.png`;
    await page.screenshot({ path, fullPage: false });
    console.log(`Saved: ${path}`);
  }

  await ctx.close();
  await browser.close();
  console.log('All evidence captured.');
}

captureEvidence().catch(console.error);
