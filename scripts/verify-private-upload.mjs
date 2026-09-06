import { chromium } from '@playwright/test';
import { ownerCookies } from './owner-session.mjs';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
const origin = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const format = process.env.TEST_UPLOAD_MIME || 'image/png';
if (!['image/png', 'image/webp'].includes(format)) throw new Error('Unsupported verification image format');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const context = await browser.newContext();
  await context.addCookies(await ownerCookies(origin));
  const page = await context.newPage();
  await page.goto(origin + '/admin', { waitUntil: 'networkidle' });
  // Use the project's own brand artwork. Do not create fake works, chapters or accounts.
  const result = await page.evaluate(async (format) => {
    const image = new Image();
    image.src = '/favicon.svg';
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    canvas.getContext('2d').drawImage(image, 0, 0, 128, 128);
    const imageFile = await new Promise((resolve) => canvas.toBlob(resolve, format, 0.92));
    if (imageFile.type !== format) throw new Error('Browser cannot generate the requested format');
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': format },
      body: imageFile
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || 'Upload failed');
    return body;
  }, format);
  if (result.mime !== format || result.width !== 128 || result.height !== 128)
    throw new Error('Stored image metadata mismatch');
  // Read only the new public project's record; never use a staff administrative key.
  const db = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: stored, error: lookupError } = await db
    .from('media')
    .select('provider,sha256,storage_ready')
    .eq('id', result.id)
    .single();
  if (lookupError || !stored?.storage_ready) throw new Error('Upload was not committed');
  if (process.env.EXPECTED_MEDIA_PROVIDER && stored.provider !== process.env.EXPECTED_MEDIA_PROVIDER)
    throw new Error('Unexpected storage provider');
  const media = await context.request.get(origin + '/media/' + result.id);
  if (media.status() !== 200 || media.headers()['content-type'] !== format)
    throw new Error('Owner cannot read private upload');
  if (!media.headers()['cache-control']?.includes('private'))
    throw new Error('Private image cache is unsafe');
  const downloaded = await media.body();
  if (
    downloaded.length !== result.bytes ||
    createHash('sha256').update(downloaded).digest('hex') !== stored.sha256
  )
    throw new Error('Downloaded bytes differ from the uploaded image');
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
      format,
      provider: stored.provider,
      purpose: 'Private Project Nox brand asset, not a chapter'
    })
  );
  await anonymous.close();
  await context.close();
} finally {
  await browser.close();
}
