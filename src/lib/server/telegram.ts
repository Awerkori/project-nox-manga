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

const filePathCache = new Map<string, { path: string; fileSize: number }>();
const MAX_FILE_PATH_CACHE = 10_000;

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
        let errorDetails = '';
        try {
          const body = await response.json().catch(() => null);
          if (body?.parameters?.retry_after && typeof body.parameters.retry_after === 'number') {
            retryAfter = body.parameters.retry_after;
          }
          if (body?.description) {
            errorDetails = body.description;
          }
        } catch {}
        if (response.status === 429 && !retryAfter) {
          const header = response.headers?.get?.('retry-after');
          if (header) {
            const parsed = parseInt(header, 10);
            if (!isNaN(parsed) && parsed > 0) retryAfter = parsed;
          }
        }
        console.error('TELEGRAM_HTTP_ERROR:', { status: response.status, description: errorDetails });
        throw new TelegramStorageError('http', response.status, retryAfter);
      }
      const payload = await response.json().catch(() => {
        throw new TelegramStorageError('payload');
      });
      if (!payload?.ok || !payload.result) throw new TelegramStorageError('payload');
      return payload.result;
    } catch (failure) {
      if (failure instanceof TelegramStorageError) {
        console.error('TELEGRAM_STORAGE_ERROR:', failure.stage, failure.status, failure.retryAfter);
        throw failure;
      }
      console.error('TELEGRAM_FETCH_EXCEPTION:', (failure as Error)?.name, (failure as Error)?.message);
      // Network errors may contain the credential-bearing URL. Never forward them.
      throw new TelegramStorageError('network');
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
      let path: string;
      let fileSize: number;

      const cached = filePathCache.get(fileId);
      if (cached) {
        path = cached.path;
        fileSize = cached.fileSize;
      } else {
        const result = await api('getFile', JSON.stringify({ file_id: fileId }), {
          'Content-Type': 'application/json'
        });
        path = result.file_path;
        if (typeof path !== 'string' || !/^(documents|photos|thumbnails)\/[a-zA-Z0-9_-]+(\.[a-zA-Z0-9]+)?$/.test(path))
          throw unavailable();
        if (typeof result.file_size !== 'number' || result.file_size <= 0 || result.file_size > 20_971_520)
          throw unavailable();
        fileSize = result.file_size;

        if (filePathCache.size >= MAX_FILE_PATH_CACHE) {
          const oldest = filePathCache.keys().next().value;
          if (oldest) filePathCache.delete(oldest);
        }
        filePathCache.set(fileId, { path, fileSize });
      }
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
                if (size !== fileSize) throw unavailable();
                controller.close();
                return;
              }
              size += value.byteLength;
              if (size > fileSize) throw unavailable();
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
