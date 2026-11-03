import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const load: PageServerLoad = async ({ params, locals, platform }) => {
  const code = params.code?.trim();
  if (!code) {
    return { status: 'INVALID', invite: null, user: null };
  }

  const inviteRes = await executeYugabyteSql(
    `SELECT 
      si.id,
      si.code,
      si.role,
      si.expires_at,
      si.used_at,
      si.revoked,
      si.created_at,
      s.id AS scan_id,
      s.name AS scan_name,
      s.slug AS scan_slug,
      s.description AS scan_description,
      s.logo_id,
      s.banner_id,
      s.is_official
    FROM scan_invites si
    JOIN scans s ON s.id = si.scan_id
    WHERE si.code = $1
    LIMIT 1;`,
    [code],
    platform?.env
  );

  const inviteRow = inviteRes.rows[0];
  if (!inviteRow) {
    return { status: 'NOT_FOUND', invite: null, user: null };
  }

  const isRevoked = Boolean(inviteRow.revoked);
  const isUsed = Boolean(inviteRow.used_at);
  const isExpired = new Date(inviteRow.expires_at).getTime() <= Date.now();

  let alreadyMember = false;
  if (locals.user) {
    const memberRes = await executeYugabyteSql(
      `SELECT role FROM scan_members WHERE scan_id = $1 AND user_id = $2 LIMIT 1;`,
      [inviteRow.scan_id, locals.user.id],
      platform?.env
    );
    if (memberRes.rows.length > 0) {
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
      id: inviteRow.id,
      code: inviteRow.code,
      role: inviteRow.role,
      expiresAt: inviteRow.expires_at,
      scan: {
        id: inviteRow.scan_id,
        name: inviteRow.scan_name,
        slug: inviteRow.scan_slug,
        description: inviteRow.scan_description,
        logo_id: inviteRow.logo_id,
        banner_id: inviteRow.banner_id,
        is_official: inviteRow.is_official
      }
    },
    user: locals.user ? { id: locals.user.id } : null
  };
};

export const actions: Actions = {
  claim: async ({ params, locals, platform }) => {
    if (!locals.user) {
      throw redirect(303, `/entrar?redirect=/convite/${params.code}`);
    }

    const code = params.code?.trim();
    if (!code) return fail(400, { message: 'Código de convite inválido.' });

    try {
      const inviteRes = await executeYugabyteSql(
        `SELECT id, scan_id, role, expires_at, used_at, revoked 
         FROM scan_invites 
         WHERE code = $1 
         LIMIT 1;`,
        [code],
        platform?.env
      );

      const invite = inviteRes.rows[0];
      if (!invite) {
        return fail(400, { message: 'Convite inválido ou não encontrado.' });
      }
      if (invite.revoked) {
        return fail(400, { message: 'Este convite foi revogado pela scan.' });
      }
      if (invite.used_at) {
        return fail(400, { message: 'Este convite já foi utilizado.' });
      }
      if (new Date(invite.expires_at).getTime() <= Date.now()) {
        return fail(400, { message: 'Este convite expirou.' });
      }

      const scanRes = await executeYugabyteSql(
        `SELECT id, name, status FROM scans WHERE id = $1 LIMIT 1;`,
        [invite.scan_id],
        platform?.env
      );
      const scan = scanRes.rows[0];
      if (!scan || scan.status !== 'ACTIVE') {
        return fail(400, { message: 'A scan associada não está ativa.' });
      }

      const memberRes = await executeYugabyteSql(
        `SELECT 1 FROM scan_members WHERE scan_id = $1 AND user_id = $2 LIMIT 1;`,
        [invite.scan_id, locals.user.id],
        platform?.env
      );
      if (memberRes.rows.length > 0) {
        return fail(400, { message: 'Você já é membro desta scan.' });
      }

      await executeYugabyteSql(
        `INSERT INTO scan_members (scan_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (scan_id, user_id) DO UPDATE SET role = EXCLUDED.role;`,
        [invite.scan_id, locals.user.id, invite.role],
        platform?.env
      );

      await executeYugabyteSql(
        `UPDATE scan_invites
         SET used_at = now(), used_by = $1
         WHERE id = $2;`,
        [locals.user.id, invite.id],
        platform?.env
      );

      throw redirect(303, `/scan${invite.scan_id ? `?id=${invite.scan_id}` : ''}`);
    } catch (err: any) {
      if (err?.status === 303 || err?.location) throw err;
      return fail(400, { message: err?.message || 'Erro ao resgatar convite.' });
    }
  }
};
