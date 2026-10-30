import { json, error as kitError } from '@sveltejs/kit';
import { storeImage, RateLimitError } from '$lib/server/media';
import { inspectImage } from '$lib/media-validation';
import type { RequestHandler } from './$types';

// Maximum sizes: 8MB for GIF animations, 5MB for static images
const MAX_GIF_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw kitError(401, 'Faça login para enviar imagens ou GIFs nos comentários.');
  }

  // Clone request to inspect file buffer before storage
  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof Blob)) {
    throw kitError(400, 'Nenhum arquivo de imagem ou GIF foi enviado.');
  }

  const rawBytes = new Uint8Array(await file.arrayBuffer());
  if (rawBytes.length < 24) {
    throw kitError(400, 'Arquivo inválido ou vazio.');
  }

  let info;
  try {
    info = inspectImage(rawBytes);
  } catch (err) {
    throw kitError(400, (err as Error).message || 'Formato não permitido. Use JPG, PNG, WebP, GIF ou AVIF.');
  }

  // Validate allowed MIME types
  const allowedMimes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];
  if (!allowedMimes.includes(info.mime)) {
    throw kitError(400, 'Formato de imagem não suportado. Use JPG, PNG, WebP, GIF ou AVIF.');
  }

  // Enforce size limits: 8MB for GIFs, 5MB for static images
  if (info.mime === 'image/gif' && rawBytes.length > MAX_GIF_BYTES) {
    throw kitError(413, 'O arquivo GIF não pode ultrapassar 8 MB.');
  } else if (info.mime !== 'image/gif' && rawBytes.length > MAX_IMAGE_BYTES) {
    throw kitError(413, 'A imagem não pode ultrapassar 5 MB.');
  }

  // Construct new FormData with the validated file and purpose
  const uploadForm = new FormData();
  uploadForm.append('file', new Blob([rawBytes], { type: info.mime }), file.name || 'comment-attachment');
  uploadForm.append('purpose', 'comment_media');

  try {
    const result = await storeImage(uploadForm, locals.user.id, 'comment_media');
    return json({
      success: true,
      id: result.id,
      url: `/media/${result.id}`,
      mime: info.mime,
      width: info.width,
      height: info.height,
      isAnimated: Boolean(info.isAnimated)
    });
  } catch (failure: any) {
    if (failure instanceof RateLimitError) {
      return json({ error: 'Muitos uploads simultâneos. Aguarde alguns segundos.' }, { status: 429 });
    }
    console.error('[COMMENT_MEDIA_UPLOAD] Storage error:', failure);
    return json(
      { error: 'Não foi possível salvar a imagem. Tente novamente ou use outro arquivo.' },
      { status: 500 }
    );
  }
};
