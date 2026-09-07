import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';

// Real owner session; client-only edits. Never saves or publishes test content.
const origin = process.env.TEST_BASE_URL;
if (!origin) throw new Error('TEST_BASE_URL is required');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const context = await browser.newContext();
  await context.addCookies(await ownerCookies(origin));
  const page = await context.newPage();
  let jsErrors = 0;
  page.on('pageerror', () => jsErrors++);
  await page.goto(origin + '/admin/obras', { waitUntil: 'networkidle' });
  const workPath = await page.locator('a[href^="/admin/obras/"]').evaluateAll((links) =>
    links.map((link) => link.getAttribute('href')).find((href) =>
      /^\/admin\/obras\/[0-9a-f-]{36}$/.test(href)
    )
  );
  if (!workPath) throw new Error('A real draft work is required');
  for (const width of [390, 768, 1366, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const response = await page.goto(origin + workPath + '/capitulos/novo', { waitUntil: 'networkidle' });
    if (response.status() !== 200) throw new Error('Editor failed to load');
    await page.getByLabel('Título opcional').fill('Rascunho não salvo');
    const back = page.locator('.breadcrumb a');
    const cancelled = page.waitForEvent('dialog');
    const click = back.click();
    await (await cancelled).dismiss();
    await click;
    if (!page.url().endsWith('/capitulos/novo')) throw new Error('Cancelled navigation discarded edits');
    if (await page.getByLabel('Título opcional').inputValue() !== 'Rascunho não salvo')
      throw new Error('Unsaved title was lost');
    await page.screenshot({ path: `artifacts/live-editor-${width}.png`, fullPage: true });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
      const overflow = await page.evaluate(() => [...document.querySelectorAll('main *')]
        .filter((node) => node.getBoundingClientRect().right > innerWidth)
        .map((node) => ({ tag: node.tagName, class: node.className, width: node.getBoundingClientRect().width })));
      console.log(JSON.stringify({ overflow }));
      throw new Error(`Editor overflow at ${width}`);
    }
    const accepted = page.waitForEvent('dialog');
    const leave = back.click();
    await (await accepted).accept();
    await leave;
    await page.waitForURL(origin + workPath);
    console.log(`PASS: editor ${width}px; cancel preserves edits, confirmation permits leaving`);
  }
  if (jsErrors) throw new Error(`Editor JavaScript errors: ${jsErrors}`);
  await context.close();
} finally {
  await browser.close();
}
