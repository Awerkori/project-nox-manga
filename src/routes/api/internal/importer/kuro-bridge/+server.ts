import { json, error, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

function safeTokenCompare(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const a = encoder.encode(provided);
  const b = encoder.encode(expected);
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export const POST: RequestHandler = async ({ request }) => {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    error(401, 'Unauthorized');
  }

  const token = authHeader.slice(7).trim();
  const expectedToken = env.NOX_STORAGE_BRIDGE_TOKEN;
  if (!expectedToken || !safeTokenCompare(token, expectedToken)) {
    error(401, 'Unauthorized');
  }

  const { url, method = 'GET', headers = {}, body } = await request.json();

  if (!url || typeof url !== 'string' || (!url.startsWith('https://kuromangas.com') && !url.startsWith('https://cdn.kuromangas.com'))) {
    error(400, 'Invalid target URL');
  }

  try {
    const upstreamRes = await fetch(url, {
      method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        ...headers
      },
      body: body ? (typeof body === 'object' ? JSON.stringify(body) : body) : undefined
    });

    const contentType = upstreamRes.headers.get('content-type') || '';
    const resHeaders: Record<string, string> = {
      'content-type': contentType
    };

    const setCookies: string[] = [];
    if (typeof (upstreamRes.headers as any).getSetCookie === 'function') {
      setCookies.push(...(upstreamRes.headers as any).getSetCookie());
    } else {
      const c = upstreamRes.headers.get('set-cookie');
      if (c) setCookies.push(c);
    }

    const dataKey = upstreamRes.headers.get('x-kuro-datakey');
    if (dataKey) {
      resHeaders['x-kuro-datakey'] = dataKey;
    }

    if (contentType.includes('application/json')) {
      const data = await upstreamRes.json();
      return json({
        status: upstreamRes.status,
        statusText: upstreamRes.statusText,
        headers: resHeaders,
        cookies: setCookies,
        data
      });
    }

    if (contentType.startsWith('image/')) {
      const buffer = await upstreamRes.arrayBuffer();
      return new Response(buffer, {
        status: upstreamRes.status,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(buffer.byteLength)
        }
      });
    }

    const text = await upstreamRes.text();
    return json({
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: resHeaders,
      cookies: setCookies,
      text
    });
  } catch (err: any) {
    return json({
      status: 500,
      error: err?.message || 'Proxy error'
    }, { status: 500 });
  }
};
