import { error } from '@sveltejs/kit';

export const SMALL_REQUEST_LIMIT = 65_536;

function validateDeclaredLength(request: Request, maxBytes: number): void {
  const raw = request.headers.get('content-length');
  if (raw === null) return;
  if (!/^\d+$/.test(raw)) error(400, 'Content-Length inválido');
  const declared = Number(raw);
  if (!Number.isSafeInteger(declared)) error(400, 'Content-Length inválido');
  if (declared > maxBytes) error(413, 'Arquivo ou solicitação acima do limite');
}

export async function readRequestBytes(request: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  validateDeclaredLength(request, maxBytes);
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // The limit is already enforced; stream cancellation is best effort.
      }
      error(413, 'Arquivo ou solicitação acima do limite');
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readRequestText(request: Request, maxBytes = SMALL_REQUEST_LIMIT): Promise<string> {
  return new TextDecoder().decode(await readRequestBytes(request, maxBytes));
}

export async function readRequestJson<T = unknown>(
  request: Request,
  maxBytes = SMALL_REQUEST_LIMIT
): Promise<T> {
  const text = await readRequestText(request, maxBytes);
  try {
    return JSON.parse(text) as T;
  } catch {
    error(400, 'Solicitação inválida');
  }
}

export async function readRequestFormData(
  request: Request,
  maxBytes = SMALL_REQUEST_LIMIT
): Promise<FormData> {
  const bytes = await readRequestBytes(request, maxBytes);
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  const bounded = new Request(request.url, {
    method: request.method,
    headers,
    body: bytes as unknown as BodyInit
  });
  try {
    return await bounded.formData();
  } catch {
    error(400, 'Formulário inválido');
  }
}
