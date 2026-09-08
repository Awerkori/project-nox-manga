// Provider credentials and Telegram URLs never leave this server-only module.
export class TelegramStorageError extends Error {
  constructor(
    readonly stage: 'http' | 'payload' | 'network' | 'file' = 'file',
    readonly status?: number,
    readonly retryAfter?: number
  ) {
    super('Armazenamento temporariamente indisponível. Tente novamente.');
  }
}
const unavailable = () => new TelegramStorageError();

export function telegramStorage(token: string, chatId: string, transport: typeof fetch = fetch) {
  async function api(method: 'sendDocument' | 'getFile', body: BodyInit, headers?: HeadersInit) {
    try {
      const response = await transport(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        body,
        headers,
        // workerd only supports follow/manual; non-2xx statuses are rejected below.
        redirect: 'manual',
        signal: AbortSignal.timeout(60_000)
      });
      if (!response.ok) {
        let retryAfter: number | undefined;
        if (response.status === 429) {
          const header = response.headers?.get?.('retry-after');
          if (header) {
            const parsed = parseInt(header, 10);
            if (!isNaN(parsed) && parsed > 0) retryAfter = parsed;
          }
          try {
            const body = await response.json().catch(() => null);
            if (body?.parameters?.retry_after && typeof body.parameters.retry_after === 'number') {
              retryAfter = body.parameters.retry_after;
            }
          } catch {}
        }
        throw new TelegramStorageError('http', response.status, retryAfter);
      }
      const payload = await response.json().catch(() => {
        throw new TelegramStorageError('payload');
      });
      if (!payload?.ok || !payload.result) throw new TelegramStorageError('payload');
      return payload.result;
    } catch (failure) {
      // Network errors may contain the credential-bearing URL. Never forward them.
      throw failure instanceof TelegramStorageError ? failure : new TelegramStorageError('network');
    }
  }

  return {
    async upload(bytes: Uint8Array<ArrayBuffer>, _mime: string, id: string): Promise<string> {
      const form = new FormData();
      form.append('chat_id', chatId);
      // Preserve the exact validated bytes; don't let Telegram turn WebP pages into stickers.
      // The original MIME remains in our private media record, not in the storage filename.
      form.append('document', new Blob([bytes], { type: 'application/octet-stream' }), `${id}.bin`);
      form.append('disable_content_type_detection', 'true');
      form.append('disable_notification', 'true');
      const result = await api('sendDocument', form);
      const fileId = result.document?.file_id;
      if (typeof fileId !== 'string' || !/^[A-Za-z0-9_-]{1,512}$/.test(fileId)) throw unavailable();
      return fileId;
    },
    async download(fileId: string): Promise<ReadableStream<Uint8Array>> {
      const result = await api('getFile', JSON.stringify({ file_id: fileId }), {
        'Content-Type': 'application/json'
      });
      const path = result.file_path;
      if (typeof path !== 'string' || !/^documents\/[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(path))
        throw unavailable();
      if (typeof result.file_size !== 'number' || result.file_size <= 0 || result.file_size > 19_000_000)
        throw unavailable();
      try {
        const response = await transport(`https://api.telegram.org/file/bot${token}/${path}`, {
          redirect: 'manual',
          signal: AbortSignal.timeout(60_000)
        });
        if (!response.ok || !response.body) throw unavailable();
        // Bound the stream and sanitize failures after the response headers too.
        const reader = response.body.getReader();
        let size = 0;
        return new ReadableStream<Uint8Array>({
          async pull(controller) {
            try {
              const { done, value } = await reader.read();
              if (done) {
                if (size !== result.file_size) throw unavailable();
                controller.close();
                return;
              }
              size += value.byteLength;
              if (size > result.file_size) throw unavailable();
              controller.enqueue(value);
            } catch {
              await reader.cancel().catch(() => {});
              controller.error(unavailable());
            }
          },
          async cancel() {
            await reader.cancel().catch(() => {});
          }
        });
      } catch {
        throw unavailable();
      }
    }
  };
}
