import { executeYugabyteSql } from '$lib/server/yugabyte';
import { createScanNotification } from './scan-notifications';

export interface StructuredScanMention {
  type: 'user' | 'position' | 'all' | 'USER' | 'ROLE' | 'ALL';
  id?: string;
  target_user_id?: string;
  target_role_id?: string;
  label: string;
}

export interface DispatchScanMentionsParams {
  locals?: any;
  text: string;
  messageId?: string | null;
  scanId: string;
  channelId?: string | null;
  authorId: string;
  title?: string;
  deepLink: string;
  contextType: 'CHAT' | 'MURAL' | 'COMMENT';
  mentionsData?: StructuredScanMention[] | null;
  platform?: any;
}

function extractMentions(text: string): string[] {
  const matches = text.match(/(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_À-ÿ-]+)/g) || [];
  return Array.from(new Set(matches.map((m: string) => m.slice(m.indexOf('@') + 1).trim().toLowerCase()).filter(Boolean)));
}

export async function dispatchScanMentions(params: DispatchScanMentionsParams) {
  const platformEnv = params.platform?.env;
  const targets = new Map<string, { username: string; mentionType: 'USER' | 'ROLE' | 'ALL'; roleId?: string | null }>();
  const persisted: Array<Record<string, string | null>> = [];

  const author = await executeYugabyteSql<{ display_name: string | null; username: string | null }>(
    'SELECT display_name, username FROM public.members WHERE id = $1 LIMIT 1',
    [params.authorId],
    platformEnv
  );
  const authorName = author.rows[0]?.display_name || author.rows[0]?.username || 'Alguém';

  for (const item of params.mentionsData || []) {
    const type = String(item.type).toUpperCase();
    const id = item.target_user_id || item.target_role_id || item.id;
    if (!id) continue;
    if (type === 'USER') {
      targets.set(id, { username: item.label.replace(/^@/, ''), mentionType: 'USER' });
      if (params.messageId) persisted.push({ message_id: params.messageId, mention_type: 'USER', target_user_id: id, target_role_id: null, mention_text: item.label });
    } else if (type === 'POSITION' || type === 'ROLE') {
      const members = await executeYugabyteSql<{ user_id: string }>(
        `SELECT user_id FROM public.scan_member_positions WHERE scan_id=$1 AND position_id=$2`,
        [params.scanId, id],
        platformEnv
      );
      for (const member of members.rows) {
        const previous = targets.get(member.user_id);
        if (!previous || previous.mentionType !== 'USER') targets.set(member.user_id, { username: item.label.replace(/^@/, ''), mentionType: 'ROLE', roleId: id });
      }
      if (params.messageId) persisted.push({ message_id: params.messageId, mention_type: 'ROLE', target_user_id: null, target_role_id: id, mention_text: item.label });
    } else if (type === 'ALL') {
      const members = await executeYugabyteSql<{ user_id: string }>(
        'SELECT user_id FROM public.scan_members WHERE scan_id=$1 AND COALESCE(hidden_by_admin,false)=false',
        [params.scanId],
        platformEnv
      );
      for (const member of members.rows) if (!targets.has(member.user_id)) targets.set(member.user_id, { username: 'todos', mentionType: 'ALL' });
      if (params.messageId) persisted.push({ message_id: params.messageId, mention_type: 'ALL', target_user_id: null, target_role_id: null, mention_text: '@todos' });
    }
  }

  const rawTags = extractMentions(params.text);
  if (rawTags.length) {
    const resolved = await executeYugabyteSql<{ user_id: string; username: string; role_id: string | null; mention_type: string; label: string }>(
      `SELECT DISTINCT m.id AS user_id, m.username,
         smp.position_id AS role_id,
         CASE WHEN lower(COALESCE(sp.name,'')) = ANY($2::text[]) THEN 'ROLE' ELSE 'USER' END AS mention_type,
         CASE WHEN lower(COALESCE(sp.name,'')) = ANY($2::text[]) THEN sp.name ELSE m.username END AS label
       FROM public.scan_members sm
       JOIN public.members m ON m.id = sm.user_id
       LEFT JOIN public.scan_member_positions smp ON smp.scan_id=sm.scan_id AND smp.user_id=sm.user_id
       LEFT JOIN public.scan_positions sp ON sp.id=smp.position_id
       WHERE sm.scan_id=$1 AND COALESCE(sm.hidden_by_admin,false)=false
         AND (lower(m.username)=ANY($2::text[]) OR lower(COALESCE(m.display_name,''))=ANY($2::text[]) OR lower(COALESCE(sp.name,''))=ANY($2::text[]))`,
      [params.scanId, rawTags],
      platformEnv
    );
    for (const row of resolved.rows) {
      const existing = targets.get(row.user_id);
      const kind = row.mention_type === 'ROLE' ? 'ROLE' : 'USER';
      if (!existing || (kind === 'USER' && existing.mentionType !== 'USER')) targets.set(row.user_id, { username: row.label, mentionType: kind, roleId: row.role_id });
      if (params.messageId && !persisted.some((entry) => entry.target_user_id === row.user_id && entry.mention_type === kind)) {
        persisted.push({ message_id: params.messageId, mention_type: kind, target_user_id: kind === 'USER' ? row.user_id : null, target_role_id: kind === 'ROLE' ? row.role_id : null, mention_text: `@${row.label}` });
      }
    }
  }

  if (params.channelId && targets.size) {
    const channel = await executeYugabyteSql<{ is_private: boolean }>(
      'SELECT is_private FROM public.scan_channels WHERE id=$1 AND scan_id=$2 LIMIT 1',
      [params.channelId, params.scanId],
      platformEnv
    );
    if (channel.rows[0]?.is_private) {
      const allowed = await executeYugabyteSql<{ user_id: string }>(
        'SELECT user_id FROM public.scan_members WHERE scan_id=$1 AND user_id = ANY($2::uuid[])',
        [params.scanId, Array.from(targets.keys())],
        platformEnv
      );
      const allowedIds = new Set(allowed.rows.map((row: { user_id: string }) => row.user_id));
      for (const userId of targets.keys()) if (!allowedIds.has(userId)) targets.delete(userId);
    }
  }

  if (params.messageId && persisted.length) {
    await executeYugabyteSql(
      `INSERT INTO public.scan_message_mentions_ysql(message_id, mention_type, target_user_id, target_role_id, mention_text)
       SELECT message_id::uuid, mention_type, target_user_id::uuid, target_role_id::uuid, mention_text
       FROM jsonb_to_recordset($1::jsonb) AS row(message_id text, mention_type text, target_user_id text, target_role_id text, mention_text text)`,
      [JSON.stringify(persisted)],
      platformEnv
    );
    const mentions = Array.from(targets.entries()).map(([userId, target]) => ({ type: target.mentionType, user_id: userId, role_id: target.roleId || null, label: `@${target.username}` }));
    await executeYugabyteSql('UPDATE public.scan_messages SET mentions=$2::jsonb, updated_at=now() WHERE id=$1 AND scan_id=$3', [params.messageId, JSON.stringify(mentions), params.scanId], platformEnv);
  }

  const snippet = params.text.length > 200 ? `${params.text.slice(0, 200)}...` : params.text;
  const notifiedUserIds: string[] = [];
  for (const [userId, target] of targets) {
    const type = target.mentionType === 'ROLE' ? 'ROLE_MENTION' : 'MENTION';
    const title = target.mentionType === 'ROLE'
      ? `Você foi mencionado pelo cargo @${target.username}`
      : (params.title || `${authorName} mencionou você no ${params.contextType === 'MURAL' ? 'Mural' : params.contextType === 'COMMENT' ? 'comentário' : 'Chat'}`);
    const result = await createScanNotification({
      recipientUserId: userId,
      actorUserId: params.authorId,
      type,
      title,
      body: snippet,
      deepLink: params.deepLink,
      scanId: params.scanId,
      priority: 'URGENT',
      dedupeKey: `mention:${userId}:${params.messageId || params.deepLink}`,
      platform: params.platform
    });
    if (result.notificationId) notifiedUserIds.push(userId);
  }
  return { count: notifiedUserIds.length, notifiedUserIds };
}
