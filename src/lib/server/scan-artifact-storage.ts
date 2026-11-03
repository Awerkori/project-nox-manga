type RuntimeEnv = Record<string, unknown> | undefined;

export const SCAN_ARTIFACT_STORAGE_CONFIG_MISSING = 'SCAN_ARTIFACT_STORAGE_CONFIG_MISSING';
export const SCAN_ARTIFACT_STORAGE_CONFIG_MISMATCH = 'SCAN_ARTIFACT_STORAGE_CONFIG_MISMATCH';
export const SCAN_ARTIFACT_STORAGE_URL_INVALID = 'SCAN_ARTIFACT_STORAGE_URL_INVALID';
export const SCAN_ARTIFACT_STORAGE_KEY_INVALID = 'SCAN_ARTIFACT_STORAGE_KEY_INVALID';

export interface StorageBucketClient {
  upload: (fileKey: string, body: any, opts?: { contentType?: string; upsert?: boolean }) => Promise<{ data: any; error: any }>;
  download: (fileKey: string) => Promise<{ data: Blob | null; error: any }>;
  remove: (fileKeys: string[]) => Promise<{ data: any; error: any }>;
}

export interface ScanArtifactStorageClient {
  storage: {
    from: (bucket: string) => StorageBucketClient;
  };
}

/**
 * Validates and provides access to external artifact storage when explicitly configured.
 * Strictly fails closed when credentials are missing or mismatched (Supabase Zero policy).
 */
export function getScanArtifactStorage(platformEnv?: RuntimeEnv): ScanArtifactStorageClient {
  const url = String(platformEnv?.STAFF_STORAGE_URL ?? platformEnv?.STAFF_SUPABASE_URL ?? '').trim();
  const key = String(platformEnv?.STAFF_STORAGE_KEY ?? platformEnv?.STAFF_SUPABASE_SERVICE_ROLE_KEY ?? '').trim();

  // Fail closed if not configured
  if (!url || !key) {
    const notConfiguredError = new Error(SCAN_ARTIFACT_STORAGE_CONFIG_MISSING);
    return {
      storage: {
        from: () => ({
          async upload() { return { data: null, error: notConfiguredError }; },
          async download() { return { data: null, error: notConfiguredError }; },
          async remove() { return { data: null, error: notConfiguredError }; }
        })
      }
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(SCAN_ARTIFACT_STORAGE_URL_INVALID);
  }

  // Cryptographic token validation to guard against cross-project drift
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
        iss?: unknown;
        ref?: unknown;
        role?: unknown;
      };
      const projectRef = parsed.hostname.split('.')[0];
      if (typeof payload.ref === 'string' && payload.ref !== projectRef) {
        throw new Error(SCAN_ARTIFACT_STORAGE_CONFIG_MISMATCH);
      }
      if (!payload.ref && typeof payload.iss === 'string' && payload.iss.includes('://')) {
        const issuer = new URL(payload.iss);
        if (issuer.hostname !== parsed.hostname) {
          throw new Error(SCAN_ARTIFACT_STORAGE_CONFIG_MISMATCH);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message === SCAN_ARTIFACT_STORAGE_CONFIG_MISMATCH) throw error;
      throw new Error(SCAN_ARTIFACT_STORAGE_KEY_INVALID, { cause: error });
    }
  }

  return {
    storage: {
      from: (bucket: string): StorageBucketClient => ({
        async upload(fileKey, body, opts) {
          try {
            const endpoint = `${url.replace(/\/$/, '')}/storage/v1/object/${bucket}/${encodeURIComponent(fileKey).replace(/%2F/g, '/')}`;
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${key}`,
                apikey: key,
                'Content-Type': opts?.contentType || 'application/octet-stream',
                'x-upsert': opts?.upsert ? 'true' : 'false'
              },
              body
            });
            if (!res.ok) {
              const errJson = await res.json().catch(() => ({ message: res.statusText }));
              return { data: null, error: errJson };
            }
            return { data: await res.json().catch(() => ({ Key: fileKey })), error: null };
          } catch (err) {
            return { data: null, error: err };
          }
        },
        async download(fileKey) {
          try {
            const endpoint = `${url.replace(/\/$/, '')}/storage/v1/object/${bucket}/${encodeURIComponent(fileKey).replace(/%2F/g, '/')}`;
            const res = await fetch(endpoint, {
              headers: {
                Authorization: `Bearer ${key}`,
                apikey: key
              }
            });
            if (!res.ok) {
              return { data: null, error: new Error(`Download failed with HTTP ${res.status}`) };
            }
            const blob = await res.blob();
            return { data: blob, error: null };
          } catch (err) {
            return { data: null, error: err };
          }
        },
        async remove(fileKeys) {
          try {
            const endpoint = `${url.replace(/\/$/, '')}/storage/v1/object/${bucket}`;
            const res = await fetch(endpoint, {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${key}`,
                apikey: key,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ prefixes: fileKeys })
            });
            if (!res.ok) {
              return { data: null, error: new Error(`Delete failed with HTTP ${res.status}`) };
            }
            return { data: await res.json().catch(() => ({})), error: null };
          } catch (err) {
            return { data: null, error: err };
          }
        }
      })
    }
  };
}

export async function removeScanArtifact(platformEnv: RuntimeEnv, fileKey: string): Promise<void> {
  const storage = getScanArtifactStorage(platformEnv);
  const { error } = await storage.storage.from('scan-artifacts').remove([fileKey]);
  if (error) throw error;
}
