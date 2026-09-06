// Provider credentials and Telegram URLs never leave this server-only module.
const unavailable = () => new Error('Armazenamento temporariamente indisponível. Tente novamente.');

export function telegramStorage(token: string, chatId: string, transport: typeof fetch = fetch) {
  async function api(method: 'sendDocument' | 'getFile', body: BodyInit, headers?: HeadersInit) {
    try {
      const response = await transport(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        body,
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(60_000)
      });
      if (!response.ok) throw unavailable();
      const payload = await response.json();
      if (!payload?.ok || !payload.result) throw unavailable();
      return payload.result;
    } catch {
      // Network errors may contain the credential-bearing URL. Never forward them.
      throw unavailable();
    }
  }

  return {
    async upload(bytes: Uint8Array<ArrayBuffer>, mime: string, id: string): Promise<string> {
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('document', new Blob([bytes], { type: mime }), `${id}.${mime.split('/')[1]}`);
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
          redirect: 'error',
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
