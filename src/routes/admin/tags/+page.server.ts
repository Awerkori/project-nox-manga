export const load = async ({ locals }) => {
  const { data } = await locals.db
    .from('tags')
    .select('id, name, slug, kind, work_tags(count)')
    .order('kind')
    .order('name');

  return {
    tags: (data || []).map((tag: any) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      kind: tag.kind,
      workCount: Number(tag.work_tags?.[0]?.count || 0)
    }))
  };
};
