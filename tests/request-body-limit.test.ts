import { describe, expect, it } from 'vitest';
import {
  readRequestBytes,
  readRequestFormData,
  readRequestJson,
  readRequestText
} from '../src/lib/server/request-body';

function streamingRequest(chunks: string[], headers: HeadersInit = {}): Request {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    }
  });
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers,
    body,
    duplex: 'half'
  } as RequestInit & { duplex: 'half' });
}

describe('bounded request body readers', () => {
  it('counts actual streamed bytes when Content-Length is absent', async () => {
    const request = streamingRequest(['1234', '5678']);
    await expect(readRequestBytes(request, 7)).rejects.toMatchObject({ status: 413 });
  });

  it('does not trust a Content-Length smaller than the real body', async () => {
    const request = streamingRequest(['1234', '5678'], { 'content-length': '1' });
    await expect(readRequestBytes(request, 7)).rejects.toMatchObject({ status: 413 });
  });

  it('rejects an oversized declared length before parsing', async () => {
    const request = streamingRequest(['{}'], { 'content-length': '1000' });
    await expect(readRequestJson(request, 64)).rejects.toMatchObject({ status: 413 });
  });

  it('measures UTF-8 bytes instead of JavaScript characters', async () => {
    const request = streamingRequest(['éééé']);
    await expect(readRequestText(request, 7)).rejects.toMatchObject({ status: 413 });
  });

  it('parses a valid bounded JSON body and rejects malformed JSON', async () => {
    const valid = streamingRequest(['{"ok":true}'], { 'content-type': 'application/json' });
    await expect(readRequestJson(valid, 32)).resolves.toEqual({ ok: true });

    const invalid = streamingRequest(['{"ok":'], { 'content-type': 'application/json' });
    await expect(readRequestJson(invalid, 32)).rejects.toMatchObject({ status: 400 });
  });

  it('reconstructs and parses bounded multipart form data', async () => {
    const source = new FormData();
    source.set('name', 'Nox');
    const original = new Request('http://localhost/form', { method: 'POST', body: source });
    const parsed = await readRequestFormData(original, 1024);
    expect(parsed.get('name')).toBe('Nox');
  });
});
