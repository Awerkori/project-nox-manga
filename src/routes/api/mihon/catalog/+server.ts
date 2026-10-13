import { json } from '@sveltejs/kit';
import { verifyMihonAuth } from '$lib/server/mihon';
import { privileged } from '$lib/server/db';

export const GET = async ({ request, url }) => {
  const auth = await verifyMihonAuth(request);
  const allowAdult = auth.authenticated && auth.ageStatus === 'ADULT';

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '24', 10)));
  const search = (url.searchParams.get('query') || url.searchParams.get('search') || '').trim();
  const status = url.searchParams.get('status')?.toUpperCase();

  const db = privileged();
  let query = db
    .from('works')
    .select('id, title, aliases, slug, cover_id, kind, status, content_rating, synopsis, updated_at', { count: 'exact' })
    .eq('published', true);

  if (!allowAdult) {
    query = query.neq('content_rating', 'ADULT_18');
  }

  if (search) {
    // `search_text` is maintained by the works title/aliases trigger and has
    // a trigram index.  This keeps native/romanized aliases searchable for
    // Mihon without turning an alternate-title lookup into a table scan.
    query = query.ilike('search_text', `%${search.replace(/[%_\\]/g, '')}%`);
  }

  if (status && (status === 'ONGOING' || status === 'COMPLETED' || status === 'HIATUS')) {
    query = query.eq('status', status);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.order('updated_at', { ascending: false }).range(from, to);

  const { data: works, count, error } = await query;
  if (error) {
    return json({ error: 'Erro ao consultar catálogo' }, { status: 500 });
  }

  const origin = url.origin;
  const items = (works || []).map((w) => ({
    id: w.id,
    title: w.title,
    alternative_titles: w.aliases || [],
    slug: w.slug,
    kind: w.kind,
    status: w.status,
    content_rating: w.content_rating || 'GENERAL',
    synopsis: w.synopsis,
    cover_url: w.cover_id ? `${origin}/media/${w.cover_id}` : null,
    updated_at: w.updated_at
  }));

  const total = count ?? items.length;
  return json({
    page,
    limit,
    total,
    has_more: to < total - 1,
    works: items
  });
};
