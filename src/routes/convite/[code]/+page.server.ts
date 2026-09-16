import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db, schema, safeQuerySingle } from '$lib/server/db';
import { eq, and, sql } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, locals }) => {
  const code = params.code?.trim();
  if (!code) {
    return { status: 'INVALID', invite: null, user: null };
  }

  const { data: invite, error: invErr } = await safeQuerySingle(
    db.select({
      id: schema.scanInvites.id,
      code: schema.scanInvites.code,
      role: schema.scanInvites.role,
      expiresAt: schema.scanInvites.expiresAt,
      usedAt: schema.scanInvites.usedAt,
      revoked: schema.scanInvites.revoked,
      createdAt: schema.scanInvites.createdAt,
      scan: {
        id: schema.scans.id,
        name: schema.scans.name,
        slug: schema.scans.slug,
        description: schema.scans.description,
        logoId: schema.scans.logoId,
        bannerId: schema.scans.bannerId,
        isOfficial: schema.scans.isOfficial
      }
    })
    .from(schema.scanInvites)
    .innerJoin(schema.scans, eq(schema.scanInvites.scanId, schema.scans.id))
    .where(eq(schema.scanInvites.code, code))
  );

  if (invErr || !invite) {
    return { status: 'NOT_FOUND', invite: null, user: null };
  }

  const isRevoked = Boolean(invite.revoked);
  const isUsed = Boolean(invite.usedAt);
  const isExpired = new Date(invite.expiresAt).getTime() <= Date.now();

  let alreadyMember = false;
  if (locals.user) {
    const { data: existingMember } = await safeQuerySingle(
      db.select({ role: schema.scanMembers.role })
        .from(schema.scanMembers)
        .where(and(eq(schema.scanMembers.scanId, invite.scan.id), eq(schema.scanMembers.userId, locals.user!.id)))
    );

    if (existingMember) {
      alreadyMember = true;
    }
  }

  let status: 'VALID' | 'REVOKED' | 'ALREADY_USED' | 'EXPIRED' | 'ALREADY_MEMBER' = 'VALID';
  if (isRevoked) status = 'REVOKED';
  else if (isUsed) status = 'ALREADY_USED';
  else if (isExpired) status = 'EXPIRED';
  else if (alreadyMember) status = 'ALREADY_MEMBER';

  return {
    status,
    code,
    invite: {
      id: invite.id,
      code: invite.code,
      role: invite.role,
      expiresAt: invite.expiresAt,
      scan: invite.scan
    },
    user: locals.user ? { id: locals.user!.id } : null
  };
};

export const actions: Actions = {
  claim: async ({ params, locals }) => {
    if (!locals.user) {
      throw redirect(303, `/entrar?redirect=/convite/${params.code}`);
    }

    const code = params.code?.trim();
    if (!code) return fail(400, { message: 'Código de convite inválido.' });

    const { data, error: rpcErr } = await safeQuerySingle(
      db.execute(sql`SELECT * FROM claim_scan_invite(${code})`)
    );

    if (rpcErr) {
      return fail(400, { message: rpcErr.message });
    }

    const scanId = (data as any)?.scanId ?? (data as any)?.scan_id;
    throw redirect(303, `/scan${scanId ? `?id=${scanId}` : ''}`);
  }
};
