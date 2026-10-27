import { error, fail } from '@sveltejs/kit';
import { parsePartnerRequestMeta, type ScanPartnerRequestMeta } from '$lib/scans';
import { executeYugabyteSql } from '$lib/server/yugabyte';
import { notifyAdminsForScanApplication } from '$lib/server/notifications';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    return {
      isAuthenticated: false,
      user: null,
      activeRequest: null,
      pastRequests: [],
      userScans: []
    };
  }

  // 1. Fetch user's existing scan partner applications
  const { data: rawRequests, error: reqErr } = await locals.db
    .from('scan_partner_requests')
    .select('*')
    .eq('user_id', locals.user.id)
    .order('created_at', { ascending: false });

  if (reqErr) {
    console.warn('Failed to load user scan partner requests:', reqErr.message);
  }

  const requests = (rawRequests || []).map((r: any) => ({
    ...r,
    meta: parsePartnerRequestMeta(r.sample_links)
  }));

  const activeRequest = requests.find((r: any) => r.status === 'PENDING') || null;

  // 2. Fetch scans where user is already an OWNER or ADMIN
  const { data: memberRows } = await locals.db
    .from('scan_members')
    .select('role, scan_id, scans!inner(id, name, slug, logo_id, status)')
    .eq('user_id', locals.user.id);

  const userScans = (memberRows || []).map((m: any) => ({
    role: m.role,
    ...m.scans
  }));

  return {
    isAuthenticated: true,
    user: locals.user,
    activeRequest,
    pastRequests: requests,
    userScans
  };
};

export const actions: Actions = {
  submitApplication: async ({ request, locals, platform }) => {
    if (!locals.user) {
      return fail(401, { message: 'Conecte-se em uma conta para enviar a candidatura da sua scan.' });
    }

    const formData = await request.formData();
    const name = (formData.get('name') as string)?.trim() || '';
    const slug = (formData.get('slug') as string)?.trim().toLowerCase() || '';
    const displayPreposition = (formData.get('display_preposition') as string)?.trim() || 'de';
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

    // Check if slug is already taken by an existing scan
    const { data: existingScan } = await locals.db
      .from('scans')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existingScan) {
      return fail(400, { message: 'Este identificador (slug) já está em uso por outra scan no Project Nox.' });
    }

    // Check if user already has a pending application
    const { data: existingPending } = await locals.db
      .from('scan_partner_requests')
      .select('id')
      .eq('user_id', locals.user.id)
      .eq('status', 'PENDING')
      .maybeSingle();

    if (existingPending) {
      return fail(400, { message: 'Você já possui uma solicitação em análise pela equipe.' });
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

    // Persist in Supabase
    const { data: inserted, error: insertErr } = await locals.db
      .from('scan_partner_requests')
      .insert({
        user_id: locals.user.id,
        scan_name: name,
        scan_slug: slug,
        description: description,
        discord: discord,
        fluxer: fluxer,
        website: website,
        sample_links: serializedMeta,
        status: 'PENDING'
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Failed to insert scan_partner_request:', insertErr);
      return fail(500, { message: 'Não foi possível registrar sua solicitação no momento. Tente novamente.' });
    }

    // Sync to YSQL plane for resilience
    try {
      await executeYugabyteSql(
        `INSERT INTO public.scan_partner_requests
           (id, user_id, scan_name, scan_slug, description, discord, fluxer, website, sample_links, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')
         ON CONFLICT (id) DO NOTHING`,
        [inserted.id, locals.user.id, name, slug, description, discord, fluxer, website, serializedMeta],
        platform?.env
      );
    } catch (ysqlErr: any) {
      console.warn('YSQL partner request sync error (non-fatal):', ysqlErr?.message);
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

    // Remove from Supabase
    const { error: delErr } = await locals.db
      .from('scan_partner_requests')
      .delete()
      .eq('id', requestId)
      .eq('user_id', locals.user.id)
      .eq('status', 'PENDING');

    if (delErr) {
      return fail(500, { message: 'Erro ao cancelar a solicitação.' });
    }

    // Remove from YSQL
    try {
      await executeYugabyteSql(
        `DELETE FROM public.scan_partner_requests WHERE id = $1 AND user_id = $2 AND status = 'PENDING'`,
        [requestId, locals.user.id],
        platform?.env
      );
    } catch (e: any) {
      console.warn('YSQL cancel error:', e?.message);
    }

    return { success: true, cancelled: true };
  }
};
