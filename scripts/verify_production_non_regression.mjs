import { chromium } from 'playwright';
import { ownerCookies } from './owner-session.mjs';

const targetUrl = process.env.TARGET_URL || 'https://manga.project-nox-awerkori.workers.dev';

async function main() {
  console.log(`=== PROJECT NOX: PRODUCTION NON-REGRESSION VERIFICATION ===`);
  console.log(`Target: ${targetUrl}`);

  const cookies = await ownerCookies(targetUrl);
  cookies.push({
    name: 'nox-age-status',
    value: 'ADULT',
    url: targetUrl,
    httpOnly: false,
    sameSite: 'Lax',
    secure: targetUrl.startsWith('https:')
  });
  cookies.push({
    name: 'nox-blur-nsfw',
    value: 'false',
    url: targetUrl,
    httpOnly: false,
    sameSite: 'Lax',
    secure: targetUrl.startsWith('https:')
  });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies(cookies);
  const page = await context.newPage();

  const report = {};

  // 1. Home
  console.log('\n[1] Verifying Public Homepage...');
  const homeRes = await page.goto(`${targetUrl}/`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  report.homeHttpStatus = homeRes.status();
  report.homeTitle = await page.title();
  const homeHeroOrNav = await page.locator('nav, header, .hero, .site-header').first().isVisible().catch(() => false);
  report.homeOk = homeRes.status() === 200 && homeHeroOrNav;
  console.log(`Public Home: HTTP ${homeRes.status()} - OK: ${report.homeOk}`);

  // 2. Catalog (/catalogo)
  console.log('\n[2] Verifying Public Catalog (/catalogo)...');
  const catalogRes = await page.goto(`${targetUrl}/catalogo`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  report.catalogHttpStatus = catalogRes.status();
  await page.waitForSelector('a[href^="/obra/"]', { timeout: 15000 }).catch(() => {});
  const worksCardsCount = await page.locator('a[href^="/obra/"]').count().catch(() => 0);
  report.catalogWorksFound = worksCardsCount;
  report.catalogOk = catalogRes.status() === 200 && worksCardsCount > 0;
  console.log(`Public Catalog: HTTP ${catalogRes.status()} - Found ${worksCardsCount} works - OK: ${report.catalogOk}`);

  // 3. Work Detail (/obra/ponto-maligno)
  console.log('\n[3] Verifying Work Detail (/obra/ponto-maligno)...');
  const workRes = await page.goto(`${targetUrl}/obra/ponto-maligno`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  report.workHttpStatus = workRes.status();
  await page.waitForSelector('a[href^="/ler/"]', { timeout: 15000 }).catch(() => {});
  const chaptersCount = await page.locator('a[href^="/ler/"]').count().catch(() => 0);
  report.workChaptersFound = chaptersCount;
  report.workOk = workRes.status() === 200 && chaptersCount > 0;
  console.log(`Work Detail: HTTP ${workRes.status()} - Found ${chaptersCount} chapter links - OK: ${report.workOk}`);

  // 4. Public Reader (/ler/887226bc-5b89-596d-9d30-6283a63b8457)
  console.log('\n[4] Verifying Public Reader (/ler/887226bc-5b89-596d-9d30-6283a63b8457)...');
  const readerRes = await page.goto(`${targetUrl}/ler/887226bc-5b89-596d-9d30-6283a63b8457`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  report.readerHttpStatus = readerRes.status();
  await page.waitForSelector('.reader-container, .reader-pages, img', { timeout: 15000 }).catch(() => {});
  const readerPageVisible = await page.locator('.reader-container, .reader-pages, img').first().isVisible().catch(() => false);
  report.readerOk = readerRes.status() === 200 && readerPageVisible;
  console.log(`Public Reader: HTTP ${readerRes.status()} - OK: ${report.readerOk}`);

  // 5. Scan Panel - Início
  console.log('\n[5] Verifying Scan Panel: Início (/scan)...');
  const scanHomeRes = await page.goto(`${targetUrl}/scan`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  report.scanHomeStatus = scanHomeRes.status();
  await page.waitForSelector('.scan-nav-card, .scan-shell, .nav-item', { timeout: 15000 }).catch(() => {});
  const scanHeaderVisible = await page.locator('.scan-header, .scan-shell, nav').first().isVisible().catch(() => false);
  report.scanHomeOk = scanHomeRes.status() === 200 && scanHeaderVisible;
  console.log(`Scan Início: HTTP ${scanHomeRes.status()} - OK: ${report.scanHomeOk}`);

  // 6. Scan Panel - Minha Fila (/scan?tab=minha_fila)
  console.log('\n[6] Verifying Scan Panel: Minha Fila (/scan?tab=minha_fila)...');
  const filaRes = await page.goto(`${targetUrl}/scan?tab=minha_fila`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  report.filaHttpStatus = filaRes.status();
  await page.waitForSelector('.tasks-tab-root, .queue-tabs-grid, .scan-shell', { timeout: 15000 }).catch(() => {});
  const filaVisible = await page.locator('.tasks-tab-root, .queue-tabs-grid, .scan-shell').first().isVisible().catch(() => false);
  report.filaOk = filaRes.status() === 200 && filaVisible;
  console.log(`Scan Minha Fila: HTTP ${filaRes.status()} - OK: ${report.filaOk}`);

  // 7. Scan Panel - Raw Provider
  console.log('\n[7] Verifying Scan Stage: Raw Provider (/scan?tab=pipeline&stage=raw_provider)...');
  const rawRes = await page.goto(`${targetUrl}/scan?tab=pipeline&stage=raw_provider`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  report.rawHttpStatus = rawRes.status();
  await page.waitForSelector('.raw-provider-root', { timeout: 15000 }).catch(() => {});
  const rawWorkspace = await page.locator('.raw-provider-root').first().isVisible().catch(() => false);
  report.rawOk = rawRes.status() === 200 && rawWorkspace;
  console.log(`Scan Raw Provider: HTTP ${rawRes.status()} - OK: ${report.rawOk}`);

  // 8. Scan Panel - Tradução
  console.log('\n[8] Verifying Scan Stage: Tradução (/scan?tab=pipeline&stage=traducao)...');
  const tradRes = await page.goto(`${targetUrl}/scan?tab=pipeline&stage=traducao`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  report.tradHttpStatus = tradRes.status();
  await page.waitForSelector('.editorial-workspace-root', { timeout: 15000 }).catch(() => {});
  const tradWorkspace = await page.locator('.editorial-workspace-root').first().isVisible().catch(() => false);
  report.tradOk = tradRes.status() === 200 && tradWorkspace;
  console.log(`Scan Tradução: HTTP ${tradRes.status()} - OK: ${report.tradOk}`);

  // 9. Scan Panel - Clean/Redraw
  console.log('\n[9] Verifying Scan Stage: Clean/Redraw (/scan?tab=pipeline&stage=clean_redraw)...');
  const cleanRes = await page.goto(`${targetUrl}/scan?tab=pipeline&stage=clean_redraw`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  report.cleanHttpStatus = cleanRes.status();
  await page.waitForSelector('.editorial-workspace-root', { timeout: 15000 }).catch(() => {});
  const cleanWorkspace = await page.locator('.editorial-workspace-root').first().isVisible().catch(() => false);
  report.cleanOk = cleanRes.status() === 200 && cleanWorkspace;
  console.log(`Scan Clean/Redraw: HTTP ${cleanRes.status()} - OK: ${report.cleanOk}`);

  // 10. Scan Panel - Typeset
  console.log('\n[10] Verifying Scan Stage: Typeset (/scan?tab=pipeline&stage=typeset)...');
  const typeRes = await page.goto(`${targetUrl}/scan?tab=pipeline&stage=typeset`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  report.typeHttpStatus = typeRes.status();
  await page.waitForSelector('.editorial-workspace-root', { timeout: 15000 }).catch(() => {});
  const typeWorkspace = await page.locator('.editorial-workspace-root').first().isVisible().catch(() => false);
  report.typeOk = typeRes.status() === 200 && typeWorkspace;
  console.log(`Scan Typeset: HTTP ${typeRes.status()} - OK: ${report.typeOk}`);

  // 11. Scan Panel - Pré-aprovado
  console.log('\n[11] Verifying Scan Stage: Pré-aprovado (/scan?tab=pipeline&stage=pre_aprovado)...');
  const preRes = await page.goto(`${targetUrl}/scan?tab=pipeline&stage=pre_aprovado`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  report.preHttpStatus = preRes.status();
  await page.waitForSelector('.pipeline-stage-view-root', { timeout: 15000 }).catch(() => {});
  const preWorkspace = await page.locator('.pipeline-stage-view-root').first().isVisible().catch(() => false);
  report.preOk = preRes.status() === 200 && preWorkspace;
  console.log(`Scan Pré-aprovado: HTTP ${preRes.status()} - OK: ${report.preOk}`);

  await browser.close();

  console.log('\n=== NON-REGRESSION RESULTS ===');
  console.log(JSON.stringify(report, null, 2));

  const allPassed = Object.keys(report).filter(k => k.endsWith('Ok')).every(k => report[k] === true);
  if (!allPassed) {
    console.error('Some non-regression checks failed!');
    process.exit(1);
  }
  console.log('✓ ALL 11 NON-REGRESSION CHECKS PASSED 100%!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
