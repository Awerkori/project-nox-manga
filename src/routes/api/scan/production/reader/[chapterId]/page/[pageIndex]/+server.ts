import { json } from '@sveltejs/kit';
import { getQcChapterPage } from '$lib/server/qc-reader-service';

export const GET = async ({ locals, params, platform }) => {
  if (!locals.user) {
    return json({ error: 'Autenticação necessária' }, { status: 401 });
  }

  const chapterId = params.chapterId;
  const pageIndex = parseInt(params.pageIndex || '0', 10);

  if (!chapterId || isNaN(pageIndex) || pageIndex < 1) {
    return json({ error: 'Parâmetros de página inválidos' }, { status: 400 });
  }

  try {
    const page = await getQcChapterPage(
      platform,
      chapterId,
      pageIndex,
      locals.user.id,
      locals.role === 'ADMIN'
    );

    const headers = {
      'Content-Type': page.mimeType,
      'Content-Length': String(page.buffer.length),
      'Cache-Control': 'private, no-transform, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'X-Page-Name': encodeURIComponent(page.name),
      'X-Page-Index': String(pageIndex)
    };

    return new Response(page.buffer as any, { status: 200, headers });
  } catch (error: any) {
    const msg = error?.message || '';
    if (msg.includes('FORBIDDEN')) {
      return json({ error: 'Acesso negado' }, { status: 403 });
    }
    if (msg.includes('PAGE_INDEX_OUT_OF_BOUNDS') || msg.includes('CHAPTER_NOT_FOUND')) {
      return json({ error: 'Página não encontrada' }, { status: 404 });
    }

    console.error('qc_reader_page_stream_error:', error);
    return json({ error: 'Não foi possível carregar a imagem da página.', details: msg }, { status: 500 });
  }
};
