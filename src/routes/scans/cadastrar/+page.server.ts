import { fail } from '@sveltejs/kit';
import { parsePartnerRequestMeta, type ScanPartnerRequestMeta } from '$lib/scans';
import { executeYugabyteSql, withYugabyteReadSession } from '$lib/server/yugabyte';
import { notifyAdminsForScanApplication } from '$lib/server/notifications';
import { invalidateAdminScansCache, invalidateAdminTicketsCache } from '$lib/server/admin-cache';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
  if (!locals.user) {
    return {
      isAuthenticated: false,
      user: null,
      activeRequest: null,
      pastRequests: [],
      userScans: []
    };
  }

  return withYugabyteReadSession(platform?.env, async (sessionEnv) => {
    let rawRequests: any[] = [];
    try {
      const reqRes = await executeYugabyteSql<any>(
        `SELECT *
         FROM public.scan_partner_requests
         WHERE user_id = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [locals.user!.id],
        sessionEnv
      );
      rawRequests = reqRes.rows || [];
    } catch (reqErr: any) {
      console.warn('Failed to load user scan partner requests:', reqErr?.message);
    }

    const requests = rawRequests.map((r: any) => ({
      ...r,
      meta: parsePartnerRequestMeta(r.sample_links)
    }));

    const activeRequest = requests.find((r: any) => r.status === 'PENDING') || null;

    // 2. Reuse verified sessionCache.userScans when present to avoid a duplicate DB round-trip
    let userScans: any[] = [];
    if (Array.isArray(locals.sessionCache?.userScans)) {
      userScans = locals.sessionCache.userScans;
    } else {
      try {
        const memberRes = await executeYugabyteSql<any>(
          `SELECT sm.role, s.id, s.name, s.slug, s.logo_id, s.status
           FROM public.scan_members sm
           JOIN public.scans s ON s.id = sm.scan_id
           WHERE sm.user_id = $1`,
          [locals.user!.id],
          sessionEnv
        );
        userScans = memberRes.rows || [];
      } catch (memberErr: any) {
        console.warn('Failed to load user scans on /scans/cadastrar:', memberErr?.message);
      }
    }

    return {
      isAuthenticated: true,
      user: locals.user,
      activeRequest,
      pastRequests: requests,
      userScans
    };
  });
};

export const actions: Actions = {
  submitApplication: async ({ request, locals, platform }) => {
    if (!locals.user) {
      return fail(401, { message: 'Conecte-se em uma conta para enviar a candidatura da sua scan.' });
    }

    const formData = await request.formData();
    const name = (formData.get('name') as string)?.trim() || '';
    const slug = (formData.get('slug') as string)?.trim().toLowerCase() || '';
    const description = (formData.get('description') as string)?.trim() || '';
    const discord = (formData.get('discord') as string)?.trim() || '';
    const fluxer = (formData.get('fluxer') as string)?.trim() || '';
    const website = (formData.get('website') as string)?.trim() || '';
    const logoId = (formData.get('logo_id') as string)?.trim() || null;
    const bannerId = (formData.get('banner_id') as string)?.trim() || null;
    const bannerCropMode = (formData.get('banner_crop_mode') as string)?.trim() || 'preserve_original';
    const bannerCropX = Number(formData.get('banner_crop_x')) || 50;
    const bannerCropY = Number(formData.get('banner_crop_y')) || 50;
    const bannerCropZoom = Number(formData.get('banner_crop_zoom')) || 1;
    const sampleLinks = (formData.get('sample_links') as string)?.trim() || '';
    const extraInfo = (formData.get('extra_info') as string)?.trim() || '';
    const message = (formData.get('message') as string)?.trim() || '';

    // Validations
    if (name.length < 2 || name.length > 100) {
      return fail(400, { message: 'O nome da scan deve ter entre 2 e 100 caracteres.' });
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 2 || slug.length > 60) {
      return fail(400, {
        message: 'O identificador (slug) deve conter apenas letras minúsculas, números e hífens (ex: imperador-scans).'
      });
    }

    if (description.length > 2000) {
      return fail(400, { message: 'A descrição da scan não pode ultrapassar 2.000 caracteres.' });
    }

    if (discord.length > 255 || fluxer.length > 255 || website.length > 255) {
      return fail(400, { message: 'Os links de redes sociais não podem ultrapassar 255 caracteres.' });
    }

    try {
      const checkRes = await executeYugabyteSql<{ slug_taken: boolean; has_pending: boolean }>(
        `SELECT
           EXISTS (SELECT 1 FROM public.scans WHERE slug = $1) AS slug_taken,
           EXISTS (SELECT 1 FROM public.scan_partner_requests WHERE user_id = $2 AND status = 'PENDING' AND deleted_at IS NULL) AS has_pending`,
        [slug, locals.user.id],
        platform?.env
      );

      if (checkRes.rows[0]?.slug_taken) {
        return fail(400, { message: 'Este identificador (slug) já está em uso por outra scan no Project Nox.' });
      }

      if (checkRes.rows[0]?.has_pending) {
        return fail(400, { message: 'Você já possui uma solicitação em análise pela equipe.' });
      }
    } catch (checkErr: any) {
      console.error('Failed to validate scan_partner_request prerequisites:', checkErr?.message);
      return fail(500, { message: 'Não foi possível validar sua solicitação no momento. Tente novamente.' });
    }

    const meta: ScanPartnerRequestMeta = {
      logo_id: logoId,
      banner_id: bannerId,
      banner_crop_mode: (bannerCropMode === 'custom_crop' ? 'custom_crop' : 'preserve_original'),
      banner_crop_x: bannerCropX,
      banner_crop_y: bannerCropY,
      banner_crop_zoom: bannerCropZoom,
      extra_info: extraInfo,
      message: message,
      sample_links: sampleLinks
    };

    const serializedMeta = JSON.stringify(meta);

    try {
      await executeYugabyteSql(
        `INSERT INTO public.scan_partner_requests
           (user_id, scan_name, scan_slug, description, discord, fluxer, website, sample_links, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')`,
        [locals.user.id, name, slug, description, discord, fluxer, website, serializedMeta],
        platform?.env
      );
    } catch (insertErr: any) {
      console.error('Failed to insert scan_partner_request:', insertErr?.message);
      return fail(500, { message: 'Não foi possível registrar sua solicitação no momento. Tente novamente.' });
    }

    // Dispatch real-time in-app & transactional email notification to Admins
    try {
      const applicantName = (locals.user as any)?.display_name || (locals.user as any)?.username || 'Candidato';
      await notifyAdminsForScanApplication({
        scanName: name,
        applicantName,
        scanSlug: slug,
        platform
      });
    } catch (notifErr: any) {
      console.warn('[NOTIF] Erro ao disparar notificação de inscrição de scan:', notifErr?.message);
    }

    invalidateAdminTicketsCache();
    invalidateAdminScansCache();
    return { success: true, submitted: true };
  },

  cancelApplication: async ({ request, locals, platform }) => {
    if (!locals.user) {
      return fail(401, { message: 'Não autenticado.' });
    }

    const formData = await request.formData();
    const requestId = formData.get('request_id') as string;

    if (!requestId) {
      return fail(400, { message: 'Identificador da solicitação inválido.' });
    }

    try {
      const delRes = await executeYugabyteSql(
        `DELETE FROM public.scan_partner_requests WHERE id = $1 AND user_id = $2 AND status = 'PENDING'`,
        [requestId, locals.user.id],
        platform?.env
      );
      if (delRes.rowCount === 0) {
        return fail(404, { message: 'Solicitação não encontrada ou já processada.' });
      }
    } catch (e: any) {
      console.warn('YSQL cancel error:', e?.message);
      return fail(500, { message: 'Erro ao cancelar a solicitação.' });
    }

    invalidateAdminTicketsCache();
    invalidateAdminScansCache();
    return { success: true, cancelled: true };
  }
};
