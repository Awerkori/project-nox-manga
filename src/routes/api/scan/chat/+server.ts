import { json } from '@sveltejs/kit';
import { executeYugabyteSql } from '$lib/server/yugabyte';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function logChatFailure(operation: string, error: unknown) {
  const value = error as { code?: unknown; message?: unknown };
  console.error('scan_chat_snapshot_ysql_failed', {
    operation,
    code: typeof value?.code === 'string' ? value.code : null,
    message: String(value?.message || 'unknown').slice(0, 240)
  });
}

export const GET = async ({ locals, url, platform }) => {
  if (!locals.user) return json({ error: 'Não autenticado' }, { status: 401 });
  const scanId = url.searchParams.get('scan_id') || '';
  if (!UUID.test(scanId)) return json({ error: 'Scan inválida' }, { status: 400 });

  try {
    if (locals.role !== 'ADMIN') {
      const membership = await executeYugabyteSql(
        'SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $2 LIMIT 1',
        [scanId, locals.user.id], platform?.env
      );
      if (!membership.rows[0]) return json({ error: 'Acesso não autorizado' }, { status: 403 });
    }

    const [channelsResult, messagesResult, readStatesResult] = await Promise.all([
      executeYugabyteSql<any>(`
        SELECT channel.* FROM public.scan_channels channel
        WHERE channel.scan_id = $1 ORDER BY channel.display_order ASC
      `, [scanId], platform?.env),
      executeYugabyteSql<any>(`
        WITH recent_messages AS (
          SELECT message.* FROM public.scan_messages message
          WHERE message.scan_id = $1
          ORDER BY message.created_at DESC LIMIT 150
        )
        SELECT message.*,
          CASE WHEN author.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', author.id, 'username', author.username,
            'display_name', author.display_name, 'avatar_id', author.avatar_id
          ) END AS user,
          CASE WHEN reply.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', reply.id, 'content', reply.content, 'deleted_at', reply.deleted_at,
            'user', CASE WHEN reply_author.id IS NULL THEN NULL ELSE jsonb_build_object(
              'id', reply_author.id, 'username', reply_author.username,
              'display_name', reply_author.display_name
            ) END
          ) END AS reply_to,
          COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'id', reaction.id, 'emoji', reaction.emoji, 'user_id', reaction.user_id
          ) ORDER BY reaction.created_at ASC)
          FROM public.scan_message_reactions reaction
          WHERE reaction.message_id = message.id), '[]'::jsonb) AS reactions
        FROM recent_messages message
        LEFT JOIN public.members author ON author.id = message.user_id
        LEFT JOIN public.scan_messages reply ON reply.id = message.reply_to_id
        LEFT JOIN public.members reply_author ON reply_author.id = reply.user_id
        ORDER BY message.created_at ASC
      `, [scanId], platform?.env),
      executeYugabyteSql<any>(`
        SELECT read_state.* FROM public.scan_channel_read_states_ysql read_state
        WHERE read_state.scan_id = $1 AND read_state.user_id = $2
      `, [scanId, locals.user.id], platform?.env)
    ]);

    return json({ channels: channelsResult.rows, messages: messagesResult.rows, channelReadStates: readStatesResult.rows }, {
      headers: { 'Cache-Control': 'private, no-store' }
    });
  } catch (error) {
    logChatFailure('snapshot', error);
    return json({ error: 'O chat está temporariamente indisponível. Tente novamente.' }, { status: 503 });
  }
};
