import { chromium } from '@playwright/test';
import { ownerCookies } from '../scripts/owner-session.mjs';
import path from 'path';
import fs from 'fs';
process.loadEnvFile('.env');

const DIR = '/home/awerkori/.gemini/antigravity-cli/brain/77ca9c93-730c-4572-bdd3-2f5c6d80e854/screenshots/chat_deletion_homolog';
fs.mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const oCookies = await ownerCookies('http://127.0.0.1:5173');

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies(oCookies);
const page = await ctx.newPage();

await page.goto('http://127.0.0.1:5173/scan?tab=chat');
await page.waitForSelector('.chat-module-root', { timeout: 15000 });
await page.waitForTimeout(2000);

// 1. Digitar @ para abrir autocomplete e capturar evidencia
const ta = page.locator('textarea.composer-textarea');
if (await ta.count() > 0) {
  await ta.fill('@awe');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(DIR, '01_mention_autocomplete_awe.png') });
  console.log('Saved 01_mention_autocomplete_awe.png');

  // Limpar composer
  await ta.fill('');
}

// 2. Postar mensagem normal para deletar
await ta.fill('Esta mensagem será excluída pelo modal customizado.');
await page.keyboard.press('Enter');
await page.waitForTimeout(2000);

// Localizar a última mensagem
const lastMsg = page.locator('.message-card').last();
await lastMsg.hover();
await page.waitForTimeout(400);

// 3. Clicar no botão 'Mais opções'
const moreBtn = lastMsg.locator('button[title="Mais opções"]').first();
if (await moreBtn.count() > 0) {
  await moreBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(DIR, '02_dropdown_menu.png') });
  console.log('Saved 02_dropdown_menu.png');

  // 4. Clicar em 'Excluir mensagem'
  const deleteMenuItem = page.locator('.hover-dropdown-menu button.danger').first();
  if (await deleteMenuItem.count() > 0) {
    await deleteMenuItem.click();
    await page.waitForTimeout(500);

    // 5. Screenshot do modal de confirmação customizado!
    await page.screenshot({ path: path.join(DIR, '03_custom_delete_modal.png') });
    console.log('Saved 03_custom_delete_modal.png');

    // 6. Clicar em 'Excluir mensagem' no modal
    const confirmBtn = page.locator('.chat-modal-actions button.btn-danger').first();
    if (await confirmBtn.count() > 0) {
      await confirmBtn.click();
      await page.waitForTimeout(2500);

      // 7. Screenshot da mensagem excluída na lista
      await page.screenshot({ path: path.join(DIR, '04_after_soft_delete.png') });
      console.log('Saved 04_after_soft_delete.png');
    }
  }
}

// 8. Teste mobile com viewport menor
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(DIR, '05_mobile_view.png') });
console.log('Saved 05_mobile_view.png');

await browser.close();
console.log('Finished visual validation.');
