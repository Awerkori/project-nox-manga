import { fail, redirect } from '@sveltejs/kit';
import { WORK_FIELDS } from '$lib/server/db';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    return {
      authenticated: false,
      isMember: false,
      userId: null,
      myScans: [],
      currentScan: null,
      userRole: null,
      works: [],
      chapters: [],
      team: [],
      totalViews: 0,
      invites: [],
      projectRequests: [],
      partnerRequests: [],
      catalogWorks: []
    };
  }

  const { data: memberRows } = await locals.db
    .from('scan_members')
    .select(`
      role,
      scan_id,
      scans!inner(*)
    `)
    .eq('user_id', locals.user.id);

  if (!memberRows || memberRows.length === 0) {
    const [partnerRequestsRes, incomingTransferRes] = await Promise.all([
      locals.db
        .from('scan_partner_requests')
        .select('*')
        .eq('user_id', locals.user.id)
        .order('created_at', { ascending: false }),
      locals.db
        .from('scan_transfer_requests')
        .select(`
          *,
          scans(id, name, slug),
          from_user:from_user_id(id, username, display_name)
        `)
        .eq('to_user_id', locals.user.id)
        .eq('status', 'PENDING')
        .maybeSingle()
    ]);

    return {
      authenticated: true,
      isMember: false,
      userId: locals.user.id,
      myScans: [],
      partnerRequests: partnerRequestsRes.data || [],
      incomingTransfer: incomingTransferRes.data || null,
      currentScan: null,
      userRole: null,
      works: [],
      chapters: [],
      team: [],
      totalViews: 0,
      invites: [],
      projectRequests: [],
      transferRequests: [],
      catalogWorks: []
    };
  }

  const myScans = memberRows.map((r: any) => ({
    role: r.role,
    ...r.scans
  }));

  const activeScanId = url.searchParams.get('id') || myScans[0].id;
  const currentScan = myScans.find((s: any) => s.id === activeScanId) || myScans[0];

  const [worksRes, chaptersRes, teamRes, invitesRes, projectRequestsRes, catalogWorksRes, transferRequestsRes, incomingTransferRes] = await Promise.all([
    locals.db
      .from('work_scans')
      .select(`
        is_primary,
        status,
        created_at,
        works!inner(${WORK_FIELDS})
      `)
      .eq('scan_id', currentScan.id),
    locals.db
      .from('chapter_scans')
      .select(`
        created_at,
        chapters!inner(
          id,
          number,
          title,
          published_at,
          views_total,
          works!inner(id, title, slug)
        )
      `)
      .eq('scan_id', currentScan.id)
      .order('created_at', { ascending: false })
      .limit(20),
    locals.db
      .from('scan_members')
      .select(`
        role,
        created_at,
        members!inner(
          id,
          username,
          display_name,
          avatar_id,
          xp
        )
      `)
      .eq('scan_id', currentScan.id),
    locals.db
      .from('scan_invites')
      .select('*')
      .eq('scan_id', currentScan.id)
      .eq('revoked', false)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
    locals.db
      .from('scan_project_requests')
      .select(`
        *,
        works!inner(id, title, slug, cover_id)
      `)
      .eq('scan_id', currentScan.id)
      .order('created_at', { ascending: false }),
    locals.db
      .from('works')
      .select('id, title, slug, cover_id')
      .eq('published', true)
      .order('title')
      .limit(100),
    locals.db
      .from('scan_transfer_requests')
      .select(`
        *,
        from_user:from_user_id(id, username, display_name),
        to_user:to_user_id(id, username, display_name)
      `)
      .eq('scan_id', currentScan.id)
      .order('created_at', { ascending: false }),
    locals.db
      .from('scan_transfer_requests')
      .select(`
        *,
        scans(id, name, slug),
        from_user:from_user_id(id, username, display_name)
      `)
      .eq('to_user_id', locals.user.id)
      .eq('status', 'PENDING')
      .maybeSingle()
  ]);

  const works = (worksRes.data || []).map((r: any) => ({
    ...r.works,
    project_status: r.status || 'ACTIVE',
    is_primary: r.is_primary
  })).filter(Boolean);
  const chapters = (chaptersRes.data || []).map((r: any) => r.chapters).filter(Boolean);
  const team = (teamRes.data || []).map((r: any) => ({
    role: r.role,
    ...r.members
  }));
  const invites = invitesRes.data || [];
  const projectRequests = projectRequestsRes.data || [];
  const catalogWorks = catalogWorksRes.data || [];
  const transferRequests = transferRequestsRes.data || [];
  const incomingTransfer = incomingTransferRes.data || null;

  const totalViews = works.reduce((sum: number, w: any) => sum + Number(w.views_total || 0), 0);

  return {
    authenticated: true,
    isMember: true,
    userId: locals.user.id,
    myScans,
    currentScan,
    userRole: currentScan.role,
    works,
    chapters,
    team,
    totalViews,
    invites,
    projectRequests,
    transferRequests,
    incomingTransfer,
    partnerRequests: [],
    catalogWorks
  };
};

export const actions: Actions = {
  updateProfile: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const description = (formData.get('description') as string)?.trim() || '';
    const discord = (formData.get('discord') as string)?.trim() || '';
    const website = (formData.get('website') as string)?.trim() || '';

    const { data: memberRow } = await locals.db
      .from('scan_members')
      .select('role')
      .eq('scan_id', scanId)
      .eq('user_id', locals.user.id)
      .maybeSingle();

    if (!memberRow || !['OWNER', 'ADMIN'].includes(memberRow.role)) {
      return fail(403, { message: 'Permissão negada. Apenas Líderes ou Administradores podem editar as informações da scan.' });
    }

    const { error } = await locals.db
      .from('scans')
      .update({
        description: description.slice(0, 2000),
        discord: discord.slice(0, 255),
        website: website.slice(0, 255),
        updated_at: new Date().toISOString()
      })
      .eq('id', scanId);

    if (error) return fail(400, { message: error.message });
    return { success: true, profileUpdated: true };
  },

  requestPartner: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanName = (formData.get('scan_name') as string)?.trim();
    const scanSlug = (formData.get('scan_slug') as string)?.trim();
    const description = (formData.get('description') as string)?.trim() || '';
    const discord = (formData.get('discord') as string)?.trim() || '';
    const fluxer = (formData.get('fluxer') as string)?.trim() || '';
    const website = (formData.get('website') as string)?.trim() || '';
    const sampleLinks = (formData.get('sample_links') as string)?.trim() || '';

    if (!scanName || !scanSlug) {
      return fail(400, { message: 'Nome da scan e slug são obrigatórios.' });
    }

    const { error: insErr } = await locals.db
      .from('scan_partner_requests')
      .insert({
        user_id: locals.user.id,
        scan_name: scanName,
        scan_slug: scanSlug,
        description,
        discord,
        fluxer,
        website,
        sample_links: sampleLinks
      });

    if (insErr) return fail(400, { message: insErr.message });
    return { success: true, partnerRequested: true };
  },

  createInvite: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const role = (formData.get('role') as string) || 'MEMBER';
    const hours = parseInt(formData.get('hours') as string) || 24;

    const { data, error: rpcErr } = await locals.db.rpc('create_scan_invite', {
      p_scan_id: scanId,
      p_role: role,
      p_hours: hours
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, createdInvite: data };
  },

  revokeInvite: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const inviteId = formData.get('invite_id') as string;
    const scanId = formData.get('scan_id') as string;

    const { data: memberRow } = await locals.db
      .from('scan_members')
      .select('role')
      .eq('scan_id', scanId)
      .eq('user_id', locals.user.id)
      .maybeSingle();

    if (!memberRow || !['OWNER', 'ADMIN'].includes(memberRow.role)) {
      return fail(403, { message: 'Permissão negada para revogar convites.' });
    }

    const { error: updErr } = await locals.db
      .from('scan_invites')
      .update({ revoked: true })
      .eq('id', inviteId);

    if (updErr) return fail(400, { message: updErr.message });
    return { success: true, revoked: true };
  },

  updateMemberRole: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const targetUserId = formData.get('user_id') as string;
    const newRole = formData.get('role') as string;

    const { data: myRow } = await locals.db
      .from('scan_members')
      .select('role')
      .eq('scan_id', scanId)
      .eq('user_id', locals.user.id)
      .maybeSingle();

    if (!myRow || myRow.role !== 'OWNER') {
      return fail(403, { message: 'Apenas o líder pode alterar cargos de membros.' });
    }

    if (targetUserId === locals.user.id) {
      return fail(400, { message: 'Use transferência de liderança para alterar o cargo de líder.' });
    }

    const { error: updErr } = await locals.db
      .from('scan_members')
      .update({ role: newRole })
      .eq('scan_id', scanId)
      .eq('user_id', targetUserId);

    if (updErr) return fail(400, { message: updErr.message });
    return { success: true, memberUpdated: true };
  },

  removeMember: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const targetUserId = formData.get('user_id') as string;

    const { data: myRow } = await locals.db
      .from('scan_members')
      .select('role')
      .eq('scan_id', scanId)
      .eq('user_id', locals.user.id)
      .maybeSingle();

    if (!myRow || !['OWNER', 'ADMIN'].includes(myRow.role)) {
      return fail(403, { message: 'Permissão negada para remover membros.' });
    }

    const { data: targetRow } = await locals.db
      .from('scan_members')
      .select('role')
      .eq('scan_id', scanId)
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (!targetRow || targetRow.role === 'OWNER') {
      return fail(400, { message: 'O líder da scan não pode ser removido.' });
    }

    if (myRow.role === 'ADMIN' && targetRow.role === 'ADMIN') {
      return fail(403, { message: 'Administradores não podem remover outros administradores.' });
    }

    const { error: delErr } = await locals.db
      .from('scan_members')
      .delete()
      .eq('scan_id', scanId)
      .eq('user_id', targetUserId);

    if (delErr) return fail(400, { message: delErr.message });
    return { success: true, memberRemoved: true };
  },

  transferOwnership: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const targetUserId = formData.get('target_user_id') as string || formData.get('new_owner_id') as string;

    const { data, error: rpcErr } = await locals.db.rpc('request_scan_ownership_transfer', {
      p_scan_id: scanId,
      p_target_user_id: targetUserId
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, transferRequested: true };
  },

  respondOwnershipTransfer: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const requestId = formData.get('request_id') as string;
    const accept = formData.get('accept') === 'true';

    const { data, error: rpcErr } = await locals.db.rpc('respond_scan_ownership_transfer', {
      p_request_id: requestId,
      p_accept: accept
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, transferResponded: true, accepted: accept };
  },

  cancelOwnershipTransfer: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const requestId = formData.get('request_id') as string;

    const { data, error: rpcErr } = await locals.db.rpc('cancel_scan_transfer_request', {
      p_request_id: requestId
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, transferCancelled: true };
  },

  requestProject: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const workId = formData.get('work_id') as string;
    const message = (formData.get('message') as string)?.trim() || '';

    if (!scanId || !workId) {
      return fail(400, { message: 'Obra é obrigatória.' });
    }

    const { error: insErr } = await locals.db
      .from('scan_project_requests')
      .insert({
        scan_id: scanId,
        work_id: workId,
        user_id: locals.user.id,
        message
      });

    if (insErr) return fail(400, { message: insErr.message });
    return { success: true, projectRequested: true };
  },

  cancelProjectRequest: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const requestId = formData.get('request_id') as string;

    const { data, error: rpcErr } = await locals.db.rpc('cancel_scan_project_request', {
      p_request_id: requestId
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, projectRequestCancelled: true };
  },

  cancelPartnerRequest: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const requestId = formData.get('request_id') as string;

    const { data, error: rpcErr } = await locals.db.rpc('cancel_scan_partner_request', {
      p_request_id: requestId
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, partnerRequestCancelled: true };
  },

  updateProjectStatus: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const workId = formData.get('work_id') as string;
    const status = formData.get('status') as string;

    const { data, error: rpcErr } = await locals.db.rpc('update_work_scan_status', {
      p_scan_id: scanId,
      p_work_id: workId,
      p_status: status
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, projectStatusUpdated: true, newStatus: status };
  }
};
