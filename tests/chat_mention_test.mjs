import { chromium } from '@playwright/test';
import { ownerCookies } from '../scripts/owner-session.mjs';
import path from 'path';
import fs from 'fs';
process.loadEnvFile('.env');

const DIR = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854/screenshots/chat_final';
fs.mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const oCookies = await ownerCookies('http://127.0.0.1:5173');

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies(oCookies);
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5173/scan?tab=chat');
await page.waitForSelector('.chat-module-root', { timeout: 12000 });
await page.waitForTimeout(1500);

// Select geral
const chItems = page.locator('.channel-nav-item-wrapper');
for (let i = 0; i < await chItems.count(); i++) {
  const txt = await chItems.nth(i).textContent();
  if (txt && txt.toLowerCase().includes('geral')) {
    await chItems.nth(i).locator('.channel-nav-item').click();
    await page.waitForTimeout(600);
    break;
  }
}

const ta = page.locator('textarea.composer-textarea');
await ta.click();

// Type char by char to trigger oninput events
await ta.pressSequentially('@aw');
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(DIR, '08_mention_typing_aw.png') });
console.log('Typing @aw — dropdown?', await page.locator('.mention-autocomplete-menu').isVisible());

await ta.pressSequentially('e');
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(DIR, '09_mention_typing_awe.png') });
console.log('Typing @awe — dropdown?', await page.locator('.mention-autocomplete-menu').isVisible());
const candidates = page.locator('.mention-candidate-item');
console.log('Candidates:', await candidates.count());
for (let i = 0; i < await candidates.count(); i++) {
  console.log(' -', await candidates.nth(i).textContent());
}

await browser.close();
