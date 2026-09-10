import { fail, redirect } from '@sveltejs/kit';
import { WORK_FIELDS } from '$lib/server/db';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    return {
      authenticated: false,
      isMember: false,
      myScans: [],
      currentScan: null,
      userRole: null,
      works: [],
      chapters: [],
      team: [],
      totalViews: 0
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
    return {
      authenticated: true,
      isMember: false,
      myScans: [],
      currentScan: null,
      userRole: null,
      works: [],
      chapters: [],
      team: [],
      totalViews: 0
    };
  }

  const myScans = memberRows.map((r: any) => ({
    role: r.role,
    ...r.scans
  }));

  const activeScanId = url.searchParams.get('id') || myScans[0].id;
  const currentScan = myScans.find((s: any) => s.id === activeScanId) || myScans[0];

  const [worksRes, chaptersRes, teamRes] = await Promise.all([
    locals.db
      .from('work_scans')
      .select(`
        is_primary,
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
      .eq('scan_id', currentScan.id)
  ]);

  const works = (worksRes.data || []).map((r: any) => r.works).filter(Boolean);
  const chapters = (chaptersRes.data || []).map((r: any) => r.chapters).filter(Boolean);
  const team = (teamRes.data || []).map((r: any) => ({
    role: r.role,
    ...r.members
  }));

  const totalViews = works.reduce((sum: number, w: any) => sum + Number(w.views_total || 0), 0);

  return {
    authenticated: true,
    isMember: true,
    myScans,
    currentScan,
    userRole: currentScan.role,
    works,
    chapters,
    team,
    totalViews
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
    return { success: true };
  }
};
