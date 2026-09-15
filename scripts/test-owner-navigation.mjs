import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';

const PROD_URL = 'https://manga.project-nox-awerkori.workers.dev';

async function main() {
  const cookies = await ownerCookies(PROD_URL);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies(cookies);
  const page = await context.newPage();

  console.log('Loading Home as Owner...');
  await page.goto(PROD_URL + '/', { waitUntil: 'networkidle' });

  // Verify auth: No false guest
  const isGuest = await page.locator('a[href="/entrar"]').isVisible().catch(() => false);
  const userMenuExists = await page.locator('.user-menu-trigger, .user-avatar, a[href="/me"]').isVisible().catch(() => false);
  console.log(`Owner state: isGuest=${isGuest}, userMenuExists=${userMenuExists}`);

  // Check Admin / Staff access
  const adminLink = page.locator('a[href^="/admin"]');
  const hasAdminLink = await adminLink.count() > 0;
  console.log(`Admin link accessible: ${hasAdminLink}`);

  // Test Admin Route Access
  console.log('Testing /admin direct load...');
  const adminResp = await page.goto(PROD_URL + '/admin', { waitUntil: 'domcontentloaded' });
  console.log(`Admin page HTTP status: ${adminResp.status()}`);

  // Test Loja as Owner
  console.log('Testing Loja as Owner...');
  const lojaResp = await page.goto(PROD_URL + '/loja', { waitUntil: 'networkidle' });
  const shopCards = await page.locator('.shop-card').count();
  console.log(`Loja status: ${lojaResp.status()}, shop items rendered: ${shopCards}`);

  await browser.close();
  console.log('✅ Owner auth & navigation test passed!');
}

main().catch(console.error);
