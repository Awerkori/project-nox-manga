import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const HALLOWEEN = process.env.NOX_HALLOWEEN_FRAME || '';
const OUT = process.env.NOX_SHOT_DIR || 'test-results/avatar-framing';

async function preview(page: any) {
  await page.route('**/preview-avatar-framing*', (route: any) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="avatar-framing"></div><script type="module" src="/tests/fixtures/avatar-framing-entry.ts"></script></body></html>`
    })
  );
  await page.route('**/__fixtures/halloween.png', (route: any) =>
    HALLOWEEN && fs.existsSync(HALLOWEEN)
      ? route.fulfill({ contentType: 'image/png', body: fs.readFileSync(HALLOWEEN) })
      : route.fulfill({ status: 404, body: '' })
  );
}

async function settle(page: any) {
  await page.waitForSelector('.grid[data-ready="true"]');
  await page.waitForFunction(() =>
    Array.from(document.images).every((img) => img.complete)
  );
  await page.waitForTimeout(400);
}

test('photo layer is circular and clipped; frame layer is separate and free to overflow', async ({ page }) => {
  test.skip(!HALLOWEEN || !fs.existsSync(HALLOWEEN), 'Set NOX_HALLOWEEN_FRAME to the Halloween PNG path');
  await preview(page);
  await page.setViewportSize({ width: 1366, height: 1100 });
  await page.goto('/preview-avatar-framing');
  await settle(page);
  fs.mkdirSync(OUT, { recursive: true });

  for (const key of ['halloween', 'square', 'wide']) {
    const cell = page.locator(`[data-scenario="${key}"]`);
    const fit = JSON.parse((await cell.getAttribute('data-fit')) || 'null');
    expect(fit, `${key}: opening must be auto-detected`).not.toBeNull();

    const info = await cell.evaluate((el: HTMLElement) => {
      const root = el.querySelector('.user-avatar-root') as HTMLElement;
      const inner = el.querySelector('.avatar-inner') as HTMLElement;
      const overlay = el.querySelector('.avatar-custom-frame-overlay') as HTMLElement;
      const asset = el.querySelector('.avatar-custom-frame-asset') as HTMLImageElement;
      const cs = (n: Element) => getComputedStyle(n);
      const r = root.getBoundingClientRect();
      const a = asset.getBoundingClientRect();
      return {
        rootOverflow: cs(root).overflow,
        innerOverflow: cs(inner).overflow,
        innerRadius: cs(inner).borderTopLeftRadius,
        overlayOverflow: cs(overlay).overflow,
        overlayPointer: cs(overlay).pointerEvents,
        assetFit: cs(asset).objectFit,
        rootW: r.width,
        assetW: a.width,
        assetH: a.height
      };
    });
    expect(info.innerOverflow).toBe('hidden');
    expect(info.innerRadius).toBe('50%');
    expect(info.rootOverflow).toBe('visible');
    expect(info.overlayOverflow).toBe('visible');
    expect(info.overlayPointer).toBe('none');
    expect(info.assetFit).toBe('contain');
    // Frame is larger than the photo: ornaments extend past the circle instead of being cut.
    expect(info.assetW).toBeGreaterThan(info.rootW);
    await cell.screenshot({ path: path.join(OUT, `cell-${key}.png`) });
  }

  // The user photo keeps its natural proportions (object-fit: cover, no stretching).
  const photo = await page.locator('[data-scenario="face-top-default"] .avatar-image').evaluate((img: HTMLImageElement) => ({
    fit: getComputedStyle(img).objectFit,
    pos: getComputedStyle(img).objectPosition
  }));
  expect(photo.fit).toBe('cover');
  expect(photo.pos).toBe('0% 0%');

  await page.screenshot({ path: path.join(OUT, 'desktop-all-scenarios.png'), fullPage: true });
});

test('mobile 390px: no horizontal overflow and frames render', async ({ page }) => {
  test.skip(!HALLOWEEN || !fs.existsSync(HALLOWEEN), 'Set NOX_HALLOWEEN_FRAME to the Halloween PNG path');
  await preview(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/preview-avatar-framing');
  await settle(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, 'mobile-390-all-scenarios.png'), fullPage: true });
});
