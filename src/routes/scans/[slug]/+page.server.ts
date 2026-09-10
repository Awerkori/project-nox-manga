import { error } from '@sveltejs/kit';
import { WORK_FIELDS } from '$lib/server/db';

export const load = async ({ locals, params }) => {
  const { data: scan } = await locals.db
    .from('scans')
    .select('*')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!scan) {
    error(404, 'Scan não encontrada');
  }

  const [worksRes, chaptersRes, membersRes] = await Promise.all([
    locals.db
      .from('work_scans')
      .select(`
        is_primary,
        status,
        works!inner(${WORK_FIELDS})
      `)
      .eq('scan_id', scan.id)
      .eq('works.published', true),
    locals.db
      .from('chapter_scans')
      .select(`
        chapters!inner(
          id,
          number,
          title,
          published_at,
          work_id,
          views_total,
          works!inner(id, slug, title, cover_id, content_rating)
        )
      `)
      .eq('scan_id', scan.id)
      .not('chapters.published_at', 'is', null)
      .order('chapters(published_at)', { ascending: false })
      .limit(30),
    locals.db
      .from('scan_members')
      .select(`
        role,
        members!inner(
          id,
          username,
          display_name,
          avatar_id,
          xp,
          avatar_frame_id,
          name_color
        )
      `)
      .eq('scan_id', scan.id)
      .order('role', { ascending: true })
  ]);

  const works = (worksRes.data || []).map((row: any) => ({
    ...row.works,
    scan_status: row.status || 'ACTIVE',
    is_primary: row.is_primary
  })).filter(Boolean);
  const chapters = (chaptersRes.data || []).map((row: any) => row.chapters).filter(Boolean);
  const members = (membersRes.data || []).map((row: any) => ({
    role: row.role,
    ...row.members,
    frame_id: row.members?.avatar_frame_id
  }));

  // Calculate total views for this scan's works
  const totalViews = works.reduce((sum: number, w: any) => sum + Number(w.views_total || 0), 0);

  return {
    scan,
    works,
    chapters,
    members,
    totalViews
  };
};
