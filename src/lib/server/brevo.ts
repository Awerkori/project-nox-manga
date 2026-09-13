import { env as privateEnv } from '$env/dynamic/private';

export interface SendBrevoEmailParams {
  toEmail: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  fromEmail?: string;
  fromName?: string;
  customHeaders?: Record<string, string>;
  tags?: string[];
}

export interface SendBrevoEmailResult {
  success: boolean;
  status: number;
  messageId?: string;
  error?: string;
  isRateLimit?: boolean;
  retryAfterSeconds?: number;
  isPermanentFailure?: boolean;
}

export async function sendBrevoEmail({
  toEmail,
  toName,
  subject,
  htmlContent,
  fromEmail,
  fromName,
  customHeaders,
  tags
}: SendBrevoEmailParams): Promise<SendBrevoEmailResult> {
  const apiKey = privateEnv.BREVO_API_KEY || process.env.BREVO_API_KEY;
  const senderEmail = fromEmail || privateEnv.BREVO_FROM_EMAIL || process.env.BREVO_FROM_EMAIL || 'awerkori@gmail.com';
  const senderName = fromName || privateEnv.BREVO_FROM_NAME || process.env.BREVO_FROM_NAME || 'Project Nox';

  if (!apiKey) {
    console.error('[BREVO] BREVO_API_KEY não configurada no ambiente.');
    return { success: false, status: 500, error: 'Chave API da Brevo ausente', isPermanentFailure: false };
  }

  const payload: any = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: toEmail, name: toName || toEmail }],
    subject,
    htmlContent
  };

  if (customHeaders && Object.keys(customHeaders).length > 0) {
    payload.headers = customHeaders;
  }
  if (tags && tags.length > 0) {
    payload.tags = tags;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    const data: any = await res.json().catch(() => ({}));

    if (res.status === 201 || res.status === 200) {
      return {
        success: true,
        status: res.status,
        messageId: data?.messageId || undefined
      };
    } else if (res.status === 429) {
      const retryAfterHeader = res.headers.get('retry-after');
      const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
      const errMsg = data?.message || 'Rate limit temporário excedido na API da Brevo (HTTP 429)';
      console.warn(`[BREVO_429] Rate limit atingido. Retry-After: ${retryAfterSeconds}s`);
      return {
        success: false,
        status: 429,
        error: errMsg,
        isRateLimit: true,
        retryAfterSeconds: isNaN(retryAfterSeconds) ? 60 : retryAfterSeconds,
        isPermanentFailure: false
      };
    } else {
      const errMsg = data?.message || data?.code || JSON.stringify(data);
      console.error(`[BREVO_ERROR] HTTP ${res.status}:`, errMsg);
      // Status 400 (ex: email com formato inválido, blocked, unverified domain) são permanentes
      const isPermanent = res.status === 400 || res.status === 401;
      return {
        success: false,
        status: res.status,
        error: errMsg,
        isPermanentFailure: isPermanent
      };
    }
  } catch (err: any) {
    console.error('[BREVO_EXCEPTION]', err?.message || err);
    return {
      success: false,
      status: 500,
      error: err?.name === 'AbortError' ? 'Timeout na conexão com a Brevo' : err?.message || 'Falha de rede'
    };
  }
}

export interface BrevoEventRecord {
  email: string;
  date: string;
  messageId: string;
  event: string;
  subject: string;
  from?: string;
  ip?: string;
}

export async function queryBrevoEvents({
  email,
  startDate,
  endDate,
  limit = 20
}: {
  email?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<BrevoEventRecord[]> {
  const apiKey = privateEnv.BREVO_API_KEY || process.env.BREVO_API_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams();
  if (email) params.set('email', email);
  if (startDate && endDate) {
    params.set('startDate', startDate.slice(0, 10));
    params.set('endDate', endDate.slice(0, 10));
  }
  params.set('limit', String(limit));
  params.set('sort', 'desc');

  try {
    const res = await fetch(`https://api.brevo.com/v3/smtp/statistics/events?${params.toString()}`, {
      headers: {
        'accept': 'application/json',
        'api-key': apiKey
      }
    });
    if (!res.ok) {
      console.warn('[BREVO_EVENTS_QUERY_FAILED]', res.status);
      return [];
    }
    const data: any = await res.json().catch(() => ({}));
    return Array.isArray(data?.events) ? data.events : [];
  } catch (err: any) {
    console.error('[BREVO_EVENTS_QUERY_ERROR]', err?.message || err);
    return [];
  }
}

