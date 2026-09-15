import { chromium } from '@playwright/test';
import { ownerCookies } from '../scripts/owner-session.mjs';
import path from 'path';
import fs from 'fs';
process.loadEnvFile('.env');

const DIR = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854/screenshots/chat_final';
fs.mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const oCookies = await ownerCookies('http://127.0.0.1:5173');

// Desktop 1440x900
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies(oCookies);
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5173/scan?tab=chat');
await page.waitForSelector('.chat-module-root', { timeout: 12000 });
await page.waitForTimeout(1500);

// Select #geral channel (CHAT type)
const chItems = page.locator('.channel-nav-item-wrapper');
const chCount = await chItems.count();
for (let i = 0; i < chCount; i++) {
  const txt = await chItems.nth(i).textContent();
  if (txt && txt.toLowerCase().includes('geral')) {
    await chItems.nth(i).locator('.channel-nav-item').click();
    await page.waitForTimeout(700);
    break;
  }
}

// Test @awerkori autocomplete
const ta = page.locator('textarea.composer-textarea');
if (await ta.count() > 0) {
  await ta.fill('@awk');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(DIR, '01_mention_awk.png') });
  console.log('01 @awk autocomplete');
  
  await ta.fill('@mi');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(DIR, '02_mention_mi.png') });
  console.log('02 @mi autocomplete');
  
  await ta.fill('@');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(DIR, '03_mention_all.png') });
  console.log('03 @all autocomplete');
  await page.keyboard.press('Escape');
  await ta.fill('');
}

// Full clean desktop view with messages
await page.screenshot({ path: path.join(DIR, '04_desktop_full.png') });
console.log('04 desktop full');

// Hover action bar test
const lastMsg = page.locator('.message-card').last();
if (await lastMsg.count() > 0) {
  await lastMsg.hover();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(DIR, '05_hover_bar.png') });
  console.log('05 hover bar');
}

// Mobile 375x812
await ctx.close();
const mCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
await mCtx.addCookies(oCookies);
const mPage = await mCtx.newPage();
await mPage.goto('http://127.0.0.1:5173/scan?tab=chat');
await mPage.waitForSelector('.chat-module-root', { timeout: 12000 });
await mPage.waitForTimeout(2000);
await mPage.screenshot({ path: path.join(DIR, '06_mobile_clean.png') });
console.log('06 mobile clean');

// Select geral on mobile
const mChs = mPage.locator('.channel-nav-item-wrapper');
for (let i = 0; i < await mChs.count(); i++) {
  const txt = await mChs.nth(i).textContent();
  if (txt && txt.toLowerCase().includes('geral')) {
    await mChs.nth(i).locator('.channel-nav-item').click();
    await mPage.waitForTimeout(800);
    break;
  }
}
await mPage.screenshot({ path: path.join(DIR, '07_mobile_geral.png') });
console.log('07 mobile geral');

await browser.close();
console.log('Screenshots em:', DIR);
