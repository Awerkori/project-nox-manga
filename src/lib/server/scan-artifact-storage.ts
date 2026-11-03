type RuntimeEnv = Record<string, unknown> | undefined;

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

export function getScanArtifactStorage(platformEnv?: RuntimeEnv): ScanArtifactStorageClient {
  const url = String(platformEnv?.STAFF_SUPABASE_URL ?? '').trim();
  const key = String(platformEnv?.STAFF_SUPABASE_SERVICE_ROLE_KEY ?? '').trim();

  return {
    storage: {
      from: (bucket: string): StorageBucketClient => ({
        async upload(fileKey, body, opts) {
          if (!url || !key) {
            return { data: null, error: new Error('SCAN_ARTIFACT_STORAGE_NOT_CONFIGURED') };
          }
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
          if (!url || !key) {
            return { data: null, error: new Error('SCAN_ARTIFACT_STORAGE_NOT_CONFIGURED') };
          }
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
          if (!url || !key) {
            return { data: null, error: new Error('SCAN_ARTIFACT_STORAGE_NOT_CONFIGURED') };
          }
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
