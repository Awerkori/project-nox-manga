import { db, schema, safeQuery } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export async function toggle_user_scan_privacy(showScans: boolean, mode: string, userId: string) {
  const { error } = await safeQuery(db.update(schema.members).set({ privacyShowScans: showScans ? 1 : 0, privacyScanMode: mode } as any).where(eq(schema.members.id, userId)));
  return { error };
}

export async function admin_moderate_user_scans(targetUserId: string, hideBadges: boolean, isAdmin: boolean) {
  if (!isAdmin) return { error: { message: 'Não autorizado' } };
  const { error } = await safeQuery(db.update(schema.members).set({ adminHideScanBadges: hideBadges ? 1 : 0 } as any).where(eq(schema.members.id, targetUserId)));
  return { error };
}
