import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
const origin = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const context = await browser.newContext();
  await context.addCookies(await ownerCookies(origin));
  const page = await context.newPage();
  await page.goto(origin + '/admin', { waitUntil: 'networkidle' });
  // Use the project's own brand artwork. Do not create fake works, chapters or accounts.
  const result = await page.evaluate(async () => {
    const image = new Image();
    image.src = '/favicon.svg';
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    canvas.getContext('2d').drawImage(image, 0, 0, 128, 128);
    const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: png
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || 'Upload failed');
    return body;
  });
  if (result.mime !== 'image/png' || result.width !== 128 || result.height !== 128)
    throw new Error('Stored image metadata mismatch');
  const media = await context.request.get(origin + '/media/' + result.id);
  if (media.status() !== 200 || media.headers()['content-type'] !== 'image/png')
    throw new Error('Owner cannot read private upload');
  if (!media.headers()['cache-control']?.includes('private'))
    throw new Error('Private image cache is unsafe');
  const anonymous = await browser.newContext();
  const hidden = await anonymous.request.get(origin + '/media/' + result.id);
  if (hidden.status() !== 404) throw new Error('Unpublished image leaked');
  const conditional = await anonymous.request.get(origin + '/media/' + result.id, {
    headers: { 'If-None-Match': media.headers().etag }
  });
  if (conditional.status() !== 404) throw new Error('Conditional caching bypassed publication check');
  console.log(
    JSON.stringify({
      result: 'PASS: real upload and authenticated download; anonymous and conditional requests denied',
      asset: result.id,
      bytes: result.bytes,
      purpose: 'Private Project Nox brand asset, not a chapter'
    })
  );
  await anonymous.close();
  await context.close();
} finally {
  await browser.close();
}
