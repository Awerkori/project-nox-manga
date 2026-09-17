import { db, schema, safeQuery, safeQuerySingle } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { error } from '@sveltejs/kit';

export async function inviteEditor(locals: App.Locals, email: string) {
  if (locals.role !== 'ADMIN') error(403, 'Somente administradores');
  if (!locals.user) error(401, 'Entre novamente para autorizar a staff.');
  
  try {
    await db.insert(schema.editorInvites).values({
      email,
      createdBy: locals.user.id,
      createdAt: new Date().toISOString()
    });
  } catch (err: any) {
    error(400, (err as any).message);
  }
}

export async function claimInvite(locals: App.Locals) {
  if (!locals.user) return;
  
  try {
    const invite = await db.select().from(schema.editorInvites).where(eq(schema.editorInvites.email, locals.user.email)).limit(1);
    if (invite.length > 0) {
      await db.insert(schema.accessRoles).values({
        userId: locals.user.id,
        role: 'EDITOR',
        suspended: false
      }).onConflictDoNothing();
      await db.delete(schema.editorInvites).where(eq(schema.editorInvites.email, locals.user.email));
    }
  } catch (err: any) {
    console.error('Editor invite could not be checked:', (err as any).message);
  }
}
