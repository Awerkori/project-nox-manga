import { chromium } from '@playwright/test';
import { ownerCookies } from '../scripts/owner-session.mjs';
import path from 'path';
import fs from 'fs';
process.loadEnvFile('.env');

const DIR = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854/screenshots/chat_inspect';
fs.mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

// Screenshot de DEV local
const oCookies = await ownerCookies('http://127.0.0.1:5173');
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies(oCookies);
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5173/scan?tab=chat');
await page.waitForSelector('.chat-module-root', { timeout: 10000 });
await page.waitForTimeout(2000);

// Click first CHAT channel
const ch = page.locator('.channel-nav-item').first();
if (await ch.count() > 0) { await ch.click(); await page.waitForTimeout(800); }

await page.screenshot({ path: path.join(DIR, '01_chat_full_view.png'), fullPage: false });
console.log('Screenshot 1: chat full view');

// Zoom in on messages area
const msgsFeed = page.locator('.messages-list');
if (await msgsFeed.count() > 0) {
  const box = await msgsFeed.boundingBox();
  if (box) {
    await page.screenshot({ path: path.join(DIR, '02_messages_area.png'), clip: box });
    console.log('Screenshot 2: messages area');
  }
}

// Post a test message to see how it renders
const ta = page.locator('textarea.composer-textarea');
if (await ta.count() > 0 && !(await ta.isDisabled())) {
  await ta.fill('Mensagem de inspecao visual');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(DIR, '03_after_post.png') });
  console.log('Screenshot 3: after posting');

  // Check for hover action bar
  const lastMsg = page.locator('.message-card').last();
  if (await lastMsg.count() > 0) {
    await lastMsg.hover();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(DIR, '04_hover_state.png') });
    console.log('Screenshot 4: hover state');

    const box2 = await lastMsg.boundingBox();
    if (box2) {
      await page.screenshot({ path: path.join(DIR, '05_message_closeup.png'), clip: { x: box2.x, y: box2.y - 10, width: box2.width, height: box2.height + 20 } });
      console.log('Screenshot 5: message closeup');
    }
  }
}

// Mobile view
await ctx.close();
const mCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
await mCtx.addCookies(oCookies);
const mPage = await mCtx.newPage();
await mPage.goto('http://127.0.0.1:5173/scan?tab=chat');
await mPage.waitForSelector('.chat-module-root', { timeout: 10000 });
await mPage.waitForTimeout(2000);
await mPage.screenshot({ path: path.join(DIR, '06_mobile_chat.png') });
console.log('Screenshot 6: mobile chat');

await browser.close();
console.log('Done. Screenshots em:', DIR);
