import { error } from '@sveltejs/kit';
import { db, schema, safeQuerySingle } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';

export function requireUser(locals: App.Locals): string {
  if (!locals.user || !locals.user.id) {
    error(401, 'Autenticação necessária.');
  }
  return locals.user.id;
}

export function requireRole(locals: App.Locals, allowedRoles: string[]) {
  const userId = requireUser(locals);
  if (!allowedRoles.includes(locals.role || '')) {
    error(403, 'Você não tem permissão para realizar esta ação.');
  }
  return userId;
}

export function requireAdmin(locals: App.Locals) {
  return requireRole(locals, ['ADMIN', 'STAFF_SITE']);
}

export function requireEditor(locals: App.Locals) {
  return requireRole(locals, ['ADMIN', 'STAFF_SITE', 'EDITOR']);
}

export async function requireScanMember(locals: App.Locals, scanId: string, allowedRoles?: string[]) {
  const userId = requireUser(locals);
  
  // Platform owners/admins bypass scan checks
  if (['ADMIN', 'STAFF_SITE'].includes(locals.role || '')) return userId;

  const { data: member, error: dbErr } = await safeQuerySingle(
    db.select({ role: schema.scanMembers.role })
      .from(schema.scanMembers)
      .where(and(
        eq(schema.scanMembers.scanId, scanId),
        eq(schema.scanMembers.userId, userId)
      ))
  );

  if (dbErr || !member) {
    error(403, 'Você não é membro desta scan.');
  }

  if (allowedRoles && !allowedRoles.includes(member.role)) {
    error(403, 'Você não tem o cargo necessário nesta scan.');
  }

  return userId;
}

export async function requireScanLeader(locals: App.Locals, scanId: string) {
  return requireScanMember(locals, scanId, ['LEADER', 'OWNER']);
}

export function requireOwnership(locals: App.Locals, ownerId: string) {
  const userId = requireUser(locals);
  if (userId !== ownerId && !['ADMIN', 'STAFF_SITE'].includes(locals.role || '')) {
    error(403, 'Você não tem permissão para alterar este recurso.');
  }
  return userId;
}
