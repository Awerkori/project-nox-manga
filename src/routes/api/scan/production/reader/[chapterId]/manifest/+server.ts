import { json } from '@sveltejs/kit';
import { getQcChapterManifest } from '$lib/server/qc-reader-service';

export const GET = async ({ locals, params, platform }) => {
  if (!locals.user) {
    return json({ error: 'Autenticação necessária' }, { status: 401 });
  }

  const chapterId = params.chapterId;
  if (!chapterId) {
    return json({ error: 'ID do capítulo ausente' }, { status: 400 });
  }

  try {
    const manifest = await getQcChapterManifest(
      platform,
      chapterId,
      locals.user.id,
      locals.role === 'ADMIN'
    );

    return json(manifest, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error: any) {
    const msg = error?.message || '';
    if (msg.includes('FORBIDDEN')) {
      return json({ error: 'Acesso negado. Apenas membros desta Scan podem revisar este capítulo.' }, { status: 403 });
    }
    if (msg.includes('CHAPTER_NOT_FOUND')) {
      return json({ error: 'Capítulo não encontrado.' }, { status: 404 });
    }
    if (msg.includes('MATERIAL_INVALIDO_PLACEHOLDER')) {
      return json({ error: msg.replace('Error: ', '') }, { status: 422 });
    }
    if (msg.includes('NO_DELIVERABLES_FOUND')) {
      return json({ error: 'Nenhum pacote de imagens ou entrega do Typeset foi localizado para este capítulo.' }, { status: 404 });
    }
    if (msg.includes('STORAGE_DOWNLOAD_FAILED')) {
      return json({ error: 'Não foi possível carregar o arquivo do armazenamento no momento.' }, { status: 502 });
    }

    console.error('qc_reader_manifest_error:', error);
    return json({ error: 'Falha interna ao gerar o leitor de revisão.', details: msg }, { status: 500 });
  }
};
