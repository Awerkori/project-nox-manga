import { describe, expect, it, vi } from 'vitest';
import { telegramStorage } from '../src/lib/server/telegram';

// Deliberately invalid, noncredential value, never contacts the real provider.
const token = 'test-placeholder';
const metadata = (extra = {}) =>
  Response.json({
    ok: true,
    result: {
      file_path: 'documents/file_1.png',
      file_size: 3,
      ...extra
    }
  });

describe('private Telegram provider', () => {
  it('rejects redirects for both upload and download instead of forwarding credentials', async () => {
    const redirect = () =>
      new Response(null, { status: 302, headers: { Location: 'https://example.invalid' } });
    const upload = vi.fn<typeof fetch>().mockResolvedValue(redirect());
    await expect(
      telegramStorage(token, 'chat', upload).upload(new Uint8Array(3), 'image/png', 'page')
    ).rejects.toThrow('indisponível');
    expect(upload).toHaveBeenCalledTimes(1);
    const download = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(metadata())
      .mockResolvedValueOnce(redirect());
    await expect(telegramStorage(token, '', download).download('id')).rejects.toThrow('indisponível');
    expect(download).toHaveBeenCalledTimes(2);
  });
  it('sends documents silently, without following redirects or enabling paid broadcasts', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        ok: true,
        result: { document: { file_id: 'opaque_file_id' } }
      })
    );
    expect(
      await telegramStorage(token, '-100123', transport).upload(new Uint8Array(3), 'image/png', 'page')
    ).toBe('opaque_file_id');
    const options = transport.mock.calls[0][1]!;
    expect(options.redirect).toBe('manual');
    expect(options.signal).toBeInstanceOf(AbortSignal);
    const form = options.body as FormData;
    expect(form.get('chat_id')).toBe('-100123');
    expect(form.get('disable_notification')).toBe('true');
    expect(form.get('disable_content_type_detection')).toBe('true');
    expect((form.get('document') as File).name).toBe('page.bin');
    expect((form.get('document') as File).type).toBe('application/octet-stream');
    expect(form.has('allow_paid_broadcast')).toBe(false);
  });

  it.each(['network', 'json', 'rejected'])('does not expose %s error details', async (kind) => {
    const transport = vi.fn<typeof fetch>();
    if (kind === 'network')
      transport.mockRejectedValue(new Error(`Failed https://api.telegram.org/bot${token}/sendDocument`));
    if (kind === 'json') transport.mockResolvedValue(new Response(`<error>${token}</error>`));
    if (kind === 'rejected') transport.mockResolvedValue(Response.json({ ok: false, description: token }));
    await expect(
      telegramStorage(token, 'chat', transport).upload(new Uint8Array(3), 'image/png', 'page')
    ).rejects.toThrow(/^Armazenamento temporariamente indisponível\. Tente novamente\.$/);
  });

  it.each([
    '../secrets',
    'documents/../../secret.png',
    'https://example.com/file',
    'documents/a.png?token=x'
  ])('rejects unexpected download path %s before a second request', async (file_path) => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(metadata({ file_path }));
    await expect(telegramStorage(token, '', transport).download('id')).rejects.toThrow('indisponível');
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it.each([0, -1, 19_000_001, null])('rejects invalid file size %s', async (file_size) => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(metadata({ file_size }));
    await expect(telegramStorage(token, '', transport).download('id')).rejects.toThrow('indisponível');
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('streams valid pages without returning upstream headers or URLs', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(metadata())
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
    const stream = await telegramStorage(token, '', transport).download('id');
    expect(Array.from(new Uint8Array(await new Response(stream).arrayBuffer()))).toEqual([1, 2, 3]);
    expect(transport.mock.calls[1][1]?.redirect).toBe('manual');
  });

  it.each([2, 4])('rejects mismatched streamed size %s', async (length) => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(metadata())
      .mockResolvedValueOnce(new Response(new Uint8Array(length)));
    const stream = await telegramStorage(token, '', transport).download('id');
    await expect(new Response(stream).arrayBuffer()).rejects.toThrow('indisponível');
  });

  it('sanitizes errors during streaming', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(metadata())
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream({
            pull(controller) {
              controller.error(new Error(token));
            }
          })
        )
      );
    const stream = await telegramStorage(token, '', transport).download('id');
    await expect(new Response(stream).arrayBuffer()).rejects.toThrow(
      /^Armazenamento temporariamente indisponível\. Tente novamente\.$/
    );
  });
});
