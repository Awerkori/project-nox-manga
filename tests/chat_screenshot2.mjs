import { chromium } from '@playwright/test';
import { ownerCookies } from '../scripts/owner-session.mjs';
import path from 'path';
import fs from 'fs';
process.loadEnvFile('.env');

const DIR = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854/screenshots/chat_after';
fs.mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const oCookies = await ownerCookies('http://127.0.0.1:5173');

// Desktop
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies(oCookies);
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5173/scan?tab=chat');
await page.waitForSelector('.chat-module-root', { timeout: 10000 });
await page.waitForTimeout(1500);

const ch = page.locator('.channel-nav-item').first();
if (await ch.count() > 0) { await ch.click(); await page.waitForTimeout(600); }

// Post a clean test message to see rendering
const ta = page.locator('textarea.composer-textarea');
if (await ta.count() > 0 && !(await ta.isDisabled())) {
  await ta.fill('Mensagem de teste visual pós-correção');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
}

await page.screenshot({ path: path.join(DIR, '01_desktop_clean.png') });
console.log('01 desktop clean');

// Hover last message
const lastMsg = page.locator('.message-card').last();
if (await lastMsg.count() > 0) {
  await lastMsg.hover();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(DIR, '02_desktop_hover.png') });
  console.log('02 desktop hover');

  // Click reply (second hover btn)
  const replyBtn = lastMsg.locator('.hover-action-btn').nth(1);
  if (await replyBtn.count() > 0) {
    await replyBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(DIR, '03_reply_banner.png') });
    console.log('03 reply banner');
    
    // Send reply
    const replyTa = page.locator('textarea.composer-textarea');
    await replyTa.fill('Esta é a resposta ao teste de reply');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(DIR, '04_after_reply.png') });
    console.log('04 after reply');
  }
}

// @ mention autocomplete test
const ta2 = page.locator('textarea.composer-textarea');
if (await ta2.count() > 0) {
  await ta2.fill('@awe');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(DIR, '05_mention_autocomplete.png') });
  console.log('05 mention autocomplete');
  await ta2.press('Escape');
  await ta2.fill('');
}

await ctx.close();

// Mobile 375x812
const mCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
await mCtx.addCookies(oCookies);
const mPage = await mCtx.newPage();
await mPage.goto('http://127.0.0.1:5173/scan?tab=chat');
await mPage.waitForSelector('.chat-module-root', { timeout: 10000 });
await mPage.waitForTimeout(2000);
await mPage.screenshot({ path: path.join(DIR, '06_mobile_clean.png') });
console.log('06 mobile clean');

// Try to select channel on mobile
const mCh = mPage.locator('.channel-nav-item').first();
if (await mCh.count() > 0) { await mCh.click(); await mPage.waitForTimeout(800); }
await mPage.screenshot({ path: path.join(DIR, '07_mobile_channel_selected.png') });
console.log('07 mobile channel selected');

// Post message on mobile
const mTa = mPage.locator('textarea.composer-textarea');
if (await mTa.count() > 0 && !(await mTa.isDisabled())) {
  await mTa.fill('Teste mobile chat');
  await mPage.keyboard.press('Enter');
  await mPage.waitForTimeout(1500);
  await mPage.screenshot({ path: path.join(DIR, '08_mobile_after_post.png') });
  console.log('08 mobile after post');
}

await browser.close();
console.log('Done:', DIR);
