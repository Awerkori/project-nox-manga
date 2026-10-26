const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const envDeployPath = path.join(__dirname, '../.dev.vars.deploy');
if (fs.existsSync(envDeployPath)) {
  const envContent = fs.readFileSync(envDeployPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
}

const PREVIEW_URL = 'https://home-preview-manga.project-nox-awerkori.workers.dev';

async function testLikeDetailed() {
  const { ownerCookies } = await import('./owner-session.mjs');
  const cookies = await ownerCookies(PREVIEW_URL);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addCookies(cookies);
  await ctx.addCookies([
    { name: 'nox-age-status', value: 'ADULT', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' },
    { name: 'nox-blur-nsfw', value: 'false', domain: 'home-preview-manga.project-nox-awerkori.workers.dev', path: '/' }
  ]);

  const page = await ctx.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('response', res => {
    if (res.url().includes('/api/action')) {
      console.log('ACTION RESPONSE:', res.status());
      res.text().then(t => console.log('ACTION BODY:', t)).catch(() => {});
    }
  });

  await page.goto(`${PREVIEW_URL}/obra/minha-nova-familia-me-trata-muito-bem`, { waitUntil: 'networkidle' });

  const continueBtn = await page.$('button:has-text("Continuar"), button:has-text("Sim"), .age-gate-btn-confirm');
  if (continueBtn) await continueBtn.click().catch(() => {});

  const likeBtn = await page.$('.btn-action-control.btn-like');
  console.log('Found like button:', Boolean(likeBtn));

  const initialLikeCount = await likeBtn.$eval('span', el => el.textContent.trim());
  const initialIsActive = await likeBtn.evaluate(el => el.classList.contains('is-active'));
  console.log(`Initial state: count=${initialLikeCount}, is-active=${initialIsActive}`);

  // Click 1: Toggle
  console.log('Clicking Like button...');
  await likeBtn.click();
  await page.waitForTimeout(1000);

  const countAfter1 = await likeBtn.$eval('span', el => el.textContent.trim());
  const isActiveAfter1 = await likeBtn.evaluate(el => el.classList.contains('is-active'));
  console.log(`State after click 1: count=${countAfter1}, is-active=${isActiveAfter1}`);

  // Reload page
  console.log('Reloading page...');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const likeBtn2 = await page.$('.btn-action-control.btn-like');
  const countReload = await likeBtn2.$eval('span', el => el.textContent.trim());
  const isActiveReload = await likeBtn2.evaluate(el => el.classList.contains('is-active'));
  console.log(`State after reload: count=${countReload}, is-active=${isActiveReload}`);

  // Click 2: Untoggle
  console.log('Clicking Like button again to untoggle...');
  await likeBtn2.click();
  await page.waitForTimeout(1000);

  const countAfter2 = await likeBtn2.$eval('span', el => el.textContent.trim());
  const isActiveAfter2 = await likeBtn2.evaluate(el => el.classList.contains('is-active'));
  console.log(`State after click 2 (untoggle): count=${countAfter2}, is-active=${isActiveAfter2}`);

  // Reload page again
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const likeBtn3 = await page.$('.btn-action-control.btn-like');
  const countReload2 = await likeBtn3.$eval('span', el => el.textContent.trim());
  const isActiveReload2 = await likeBtn3.evaluate(el => el.classList.contains('is-active'));
  console.log(`State after 2nd reload: count=${countReload2}, is-active=${isActiveReload2}`);

  await browser.close();
}

testLikeDetailed().catch(console.error);
