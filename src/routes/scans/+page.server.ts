export const load = async ({ locals }) => {
  const { data: scans } = await locals.db
    .from('scans')
    .select(`
      id,
      name,
      slug,
      description,
      logo_id,
      banner_id,
      website,
      discord,
      fluxer,
      is_official,
      status,
      created_at,
      work_scans(count),
      chapter_scans(count)
    `)
    .eq('status', 'ACTIVE')
    .order('is_official', { ascending: false })
    .order('name', { ascending: true });

  const formattedScans = (scans || []).map((s: any) => ({
    ...s,
    worksCount: s.work_scans?.[0]?.count ?? 0,
    chaptersCount: s.chapter_scans?.[0]?.count ?? 0
  }));

  return {
    scans: formattedScans
  };
};
