import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

type RuntimeEnv = Record<string, unknown> | undefined;

/**
 * Resolve the private artifact-storage project from the Worker runtime.
 *
 * This intentionally has no project/credential fallback. A URL and a
 * service-role key from different projects produce opaque storage signature
 * failures, so continuing with a guessed value is worse than failing closed.
 */
export function getScanArtifactStorage(platformEnv?: RuntimeEnv): SupabaseClient {
  const url = String(platformEnv?.STAFF_SUPABASE_URL ?? env.STAFF_SUPABASE_URL ?? '').trim();
  const key = String(platformEnv?.STAFF_SUPABASE_SERVICE_ROLE_KEY ?? env.STAFF_SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !key) throw new Error('SCAN_ARTIFACT_STORAGE_CONFIG_MISSING');

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('SCAN_ARTIFACT_STORAGE_URL_INVALID');
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) {
    throw new Error('SCAN_ARTIFACT_STORAGE_URL_INVALID');
  }

  // Supabase service-role keys are JWTs. Check the issuer host without ever
  // logging or returning the token. This catches URL/key cross-project drift
  // before the storage API returns "signature verification failed".
  const parts = key.split('.');
  if (parts.length !== 3) throw new Error('SCAN_ARTIFACT_STORAGE_KEY_INVALID');
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { iss?: unknown };
    if (typeof payload.iss === 'string') {
      const issuer = new URL(payload.iss);
      if (issuer.hostname !== parsed.hostname) throw new Error('SCAN_ARTIFACT_STORAGE_CONFIG_MISMATCH');
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'SCAN_ARTIFACT_STORAGE_CONFIG_MISMATCH') throw error;
    throw new Error('SCAN_ARTIFACT_STORAGE_KEY_INVALID', { cause: error });
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}

export async function removeScanArtifact(platformEnv: RuntimeEnv, fileKey: string): Promise<void> {
  const storage = getScanArtifactStorage(platformEnv);
  const { error } = await storage.storage.from('scan-artifacts').remove([fileKey]);
  if (error) throw error;
}
