import { test, expect } from '@playwright/test';

for (const width of [390, 768, 1366, 1440])
  test(`chapter changes preserve independent progress at ${width}px`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('nox-page:qa-first', '3'));
    await page.route('**/media/qa-*', (route) =>
      route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
          'base64'
        )
      })
    );
    await page.route('**/qa-reader', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `
    <html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0"><div id="reader"></div><script type="module" src="/tests/fixtures/reader-entry.ts"></script></body></html>`
      })
    );
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/qa-reader');
    await expect
      .poll(async () => ({ errors, reader: await page.locator('.reader-tools').count() }))
      .toEqual({ errors: [], reader: 1 });
    await expect(page.locator('.reader-tools > span')).toHaveText('3/3');
    await page.evaluate(() => (window as any).readerHarness.next());
    await expect(page.locator('.reader-tools > span')).toHaveText('1/2');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('nox-page:qa-second'))).toBe('1');
    expect(await page.evaluate(() => localStorage.getItem('nox-page:qa-first'))).toBe('3');
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('reader.png'), fullPage: true });
  });
