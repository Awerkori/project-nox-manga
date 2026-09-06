import { test, expect } from '@playwright/test';
import { zipSync } from 'fflate';

for (const width of [390, 768, 1366, 1440])
  test(`editor resumes ZIP and reorders pages at ${width}px`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const png = Buffer.from(
      await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 24;
        canvas.getContext('2d')!.fillRect(0, 0, 16, 24);
        return canvas.toDataURL('image/png').split(',')[1];
      }),
      'base64'
    );
    let uploads = 0;
    await page.route('**/api/staff?*', (route) => route.fulfill({ json: { chapters: [] } }));
    await page.route('**/api/upload', (route) => {
      uploads++;
      return route.fulfill(
        uploads === 2
          ? { status: 502, json: { message: 'Conexão interrompida.' } }
          : { json: { id: `qa-upload-${uploads}` } }
      );
    });
    await page.route('**/media/qa-*', (route) => route.fulfill({ contentType: 'image/png', body: png }));
    await page.route('**/qa-editor', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `
    <html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body><div id="editor"></div><script type="module" src="/tests/fixtures/editor-entry.ts"></script></body></html>`
      })
    );
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/qa-editor');
    await expect(page.getByRole('heading', { name: 'Uma página de cada vez.' })).toBeVisible();
    const zip = Buffer.from(zipSync({ '10.png': png, '2.png': png, '1.png': png }, { level: 0 }));
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'local-test.zip', mimeType: 'application/zip', buffer: zip });
    await expect(page.getByRole('status')).toContainText('As páginas já enviadas foram preservadas');
    await expect(page.locator('.page-tile')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled();
    await page.getByRole('button', { name: 'Continuar envio' }).click();
    await expect(page.locator('.page-tile')).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Salvar rascunho' })).toBeEnabled();
    expect(uploads).toBe(4);
    await expect(page.locator('.page-tile > div > span')).toHaveText(['1.png', '2.png', '10.png']);
    await page.getByRole('button', { name: 'Mover página 3 para antes', exact: true }).click();
    await expect(page.locator('.page-tile > div > span')).toHaveText(['1.png', '10.png', '2.png']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('editor.png'), fullPage: true });
  });
