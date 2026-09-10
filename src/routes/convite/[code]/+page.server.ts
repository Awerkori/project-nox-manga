import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { privileged } from '$lib/server/db';

export const load: PageServerLoad = async ({ params, locals }) => {
  const code = params.code?.trim();
  if (!code) {
    return { status: 'INVALID', invite: null, user: null };
  }

  const db = privileged();

  const { data: invite, error: invErr } = await db
    .from('scan_invites')
    .select(`
      id,
      code,
      role,
      expires_at,
      used_at,
      revoked,
      created_at,
      scans!inner(
        id,
        name,
        slug,
        description,
        logo_id,
        banner_id,
        is_official
      )
    `)
    .eq('code', code)
    .maybeSingle();

  if (invErr || !invite) {
    return { status: 'NOT_FOUND', invite: null, user: null };
  }

  const isRevoked = Boolean(invite.revoked);
  const isUsed = Boolean(invite.used_at);
  const isExpired = new Date(invite.expires_at).getTime() <= Date.now();

  let alreadyMember = false;
  if (locals.user) {
    const { data: existingMember } = await db
      .from('scan_members')
      .select('role')
      .eq('scan_id', (invite.scans as any).id)
      .eq('user_id', locals.user.id)
      .maybeSingle();

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
      expiresAt: invite.expires_at,
      scan: invite.scans
    },
    user: locals.user ? { id: locals.user.id } : null
  };
};

export const actions: Actions = {
  claim: async ({ params, locals }) => {
    if (!locals.user) {
      throw redirect(303, `/entrar?redirect=/convite/${params.code}`);
    }

    const code = params.code?.trim();
    if (!code) return fail(400, { message: 'Código de convite inválido.' });

    const { data, error: rpcErr } = await locals.db.rpc('claim_scan_invite', {
      p_code: code
    });

    if (rpcErr) {
      return fail(400, { message: rpcErr.message });
    }

    const scanId = (data as any)?.scan_id;
    throw redirect(303, `/scan${scanId ? `?id=${scanId}` : ''}`);
  }
};
