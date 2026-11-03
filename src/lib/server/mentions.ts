import { executeYugabyteSql } from './yugabyte';
import { createNotification } from './notifications';
import { stripSpoilers } from '$lib/comments';

export interface MentionTarget {
  userId: string;
  username: string;
  email: string | null;
  mentionType: 'USER' | 'ROLE' | 'ALL';
  roleId?: string | null;
}

export interface StructuredMentionInput {
  type: 'user' | 'position' | 'all' | 'USER' | 'ROLE' | 'ALL';
  id?: string;
  target_user_id?: string;
  target_role_id?: string;
  label: string;
}

export interface DispatchMentionsParams {
  locals: App.Locals;
  text: string;
  messageId?: string | null;
  scanId?: string | null;
  channelId?: string | null;
  authorId: string;
  title?: string;
  deepLink: string;
  contextType: 'CHAT' | 'MURAL' | 'COMMENT';
  workId?: string | null;
  chapterId?: string | null;
  mentionsData?: StructuredMentionInput[] | null;
  excludeUserIds?: string[];
  platform?: any;
}

/**
 * Extracts distinct @mentions from text.
 * Matches @username or @cargo or @todos.
 */
export function extractMentions(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_À-ÿ-]+)/g);
  if (!matches) return [];
  const set = new Set<string>();
  for (const m of matches) {
    const atIndex = m.indexOf('@');
    if (atIndex !== -1) {
      const tag = m.slice(atIndex + 1).trim().toLowerCase();
      if (tag) set.add(tag);
    }
  }
  return Array.from(set);
}

/**
 * Resolves mentioned users and dispatches in-app notifications and email outbox records
 * using the unified createNotification service.
 */
export async function dispatchMentions({
  locals,
  text,
  messageId = null,
  scanId = null,
  channelId = null,
  authorId,
  title,
  deepLink,
  contextType,
  workId = null,
  chapterId = null,
  mentionsData = null,
  excludeUserIds = [],
  platform
}: DispatchMentionsParams): Promise<{ count: number; notifiedUserIds: string[] }> {
  const targetUserMap = new Map<string, MentionTarget>();
  const structuredMentionsToPersist: Array<{
    message_id: string;
    mention_type: 'USER' | 'ROLE' | 'ALL';
    target_user_id: string | null;
    target_role_id: string | null;
    mention_text: string;
  }> = [];

  // Obter nome do autor para mensagens personalizadas
  let authorName = 'Alguém';
  try {
    const authorRes = await executeYugabyteSql(
      `SELECT display_name, username FROM public.members WHERE id = $1 LIMIT 1;`,
      [authorId],
      platform?.env
    );
    const authorMem = authorRes.rows[0];
    if (authorMem) {
      authorName = authorMem.display_name || authorMem.username || 'Alguém';
    }
  } catch (err) {
    console.warn('[MENTIONS] Erro ao buscar nome do autor:', err);
  }

  // 1. Processar dados estruturados enviados do autocomplete (se disponíveis)
  if (mentionsData && Array.isArray(mentionsData) && mentionsData.length > 0) {
    for (const item of mentionsData) {
      const normalizedType = item.type.toUpperCase();
      if (normalizedType === 'USER') {
        const uid = item.target_user_id || item.id;
        if (uid) {
          targetUserMap.set(uid, {
            userId: uid,
            username: item.label.replace(/^@/, ''),
            email: null,
            mentionType: 'USER'
          });
          if (messageId) {
            structuredMentionsToPersist.push({
              message_id: messageId,
              mention_type: 'USER',
              target_user_id: uid,
              target_role_id: null,
              mention_text: item.label
            });
          }
        }
      } else if (normalizedType === 'POSITION' || normalizedType === 'ROLE') {
        const roleId = item.target_role_id || item.id;
        if (roleId && scanId) {
          // Buscar todos os membros que possuem essa posição na Scan
          const roleRes = await executeYugabyteSql(
            `SELECT user_id FROM public.scan_member_positions WHERE position_id = $1;`,
            [roleId],
            platform?.env
          );
          const roleMembers = roleRes.rows;

          if (roleMembers && roleMembers.length > 0) {
            for (const rm of roleMembers) {
              const existing = targetUserMap.get(rm.user_id);
              if (!existing || existing.mentionType !== 'USER') {
                targetUserMap.set(rm.user_id, {
                  userId: rm.user_id,
                  username: item.label.replace(/^@/, ''),
                  email: null,
                  mentionType: 'ROLE',
                  roleId: roleId
                });
              }
            }
          }

          if (messageId) {
            structuredMentionsToPersist.push({
              message_id: messageId,
              mention_type: 'ROLE',
              target_user_id: null,
              target_role_id: roleId,
              mention_text: item.label
            });
          }
        }
      } else if (normalizedType === 'ALL') {
        if (scanId) {
          const allRes = await executeYugabyteSql(
            `SELECT user_id FROM public.scan_members WHERE scan_id = $1;`,
            [scanId],
            platform?.env
          );
          const allMembers = allRes.rows;

          if (allMembers && allMembers.length > 0) {
            for (const am of allMembers) {
              if (!targetUserMap.has(am.user_id)) {
                targetUserMap.set(am.user_id, {
                  userId: am.user_id,
                  username: 'todos',
                  email: null,
                  mentionType: 'ALL'
                });
              }
            }
          }

          if (messageId) {
            structuredMentionsToPersist.push({
              message_id: messageId,
              mention_type: 'ALL',
              target_user_id: null,
              target_role_id: null,
              mention_text: '@todos'
            });
          }
        }
      }
    }
  }

  // 2. Complementar via análise de texto (caso menções tenham sido digitadas manualmente)
  const rawTags = extractMentions(text);
  if (scanId && rawTags.length > 0) {
    let isPrivateChannel = false;
    if (channelId) {
      const chRes = await executeYugabyteSql(
        `SELECT is_private, name FROM public.scan_channels WHERE id = $1 LIMIT 1;`,
        [channelId],
        platform?.env
      );
      const ch = chRes.rows[0];
      if (ch && ch.is_private) {
        isPrivateChannel = true;
      }
    }

    try {
      const resolvedRes = await executeYugabyteSql(
        `SELECT * FROM public.resolve_scan_mentions($1, $2);`,
        [scanId, text],
        platform?.env
      );
      const resolved = resolvedRes.rows;

      if (resolved && resolved.length > 0) {
        for (const r of resolved) {
          const uid = r.target_user_id;
          if (uid) {
            const resolvedType = r.mention_type === 'POSITION' ? 'ROLE' : (r.mention_type as any) || 'USER';
            const existing = targetUserMap.get(uid);

            if (!existing || (resolvedType === 'USER' && existing.mentionType !== 'USER')) {
              targetUserMap.set(uid, {
                userId: uid,
                username: r.mention_label || 'membro',
                email: null,
                mentionType: resolvedType
              });
            }

            if (messageId && !structuredMentionsToPersist.some(s => s.target_user_id === uid && s.mention_type === resolvedType)) {
              structuredMentionsToPersist.push({
                message_id: messageId,
                mention_type: resolvedType,
                target_user_id: resolvedType === 'USER' ? uid : null,
                target_role_id: null,
                mention_text: '@' + (r.mention_label || 'membro')
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('[MENTIONS] resolve_scan_mentions error:', e);
    }

    if (isPrivateChannel && targetUserMap.size > 0) {
      const uids = Array.from(targetUserMap.keys());
      const membersRes = await executeYugabyteSql(
        `SELECT user_id FROM public.scan_members WHERE scan_id = $1 AND user_id = ANY($2::uuid[]);`,
        [scanId, uids],
        platform?.env
      );
      const allowedSet = new Set((membersRes.rows || []).map((m: any) => m.user_id));
      for (const uid of uids) {
        if (!allowedSet.has(uid)) {
          targetUserMap.delete(uid);
        }
      }
    }
  } else if (!scanId && rawTags.length > 0) {
    // Public Platform Context (Work or Chapter Comments)
    const membersRes = await executeYugabyteSql(
      `SELECT id, username FROM public.members WHERE LOWER(username) = ANY($1::text[]);`,
      [rawTags],
      platform?.env
    );
    const members = membersRes.rows;

    if (members && members.length > 0) {
      for (const m of members) {
        if (!targetUserMap.has(m.id)) {
          targetUserMap.set(m.id, {
            userId: m.id,
            username: m.username,
            email: null,
            mentionType: 'USER'
          });
        }
      }
    }
  }

  // 3. Persistir menções estruturadas no banco
  if (messageId && structuredMentionsToPersist.length > 0) {
    try {
      for (const sm of structuredMentionsToPersist) {
        await executeYugabyteSql(
          `INSERT INTO public.scan_message_mentions (message_id, mention_type, target_user_id, target_role_id, mention_text)
           VALUES ($1, $2, $3, $4, $5);`,
          [sm.message_id, sm.mention_type, sm.target_user_id, sm.target_role_id, sm.mention_text],
          platform?.env
        );
      }
      const mentionsJson = Array.from(targetUserMap.values()).map(t => ({
        type: t.mentionType,
        user_id: t.userId,
        role_id: t.roleId || null,
        label: '@' + t.username
      }));
      await executeYugabyteSql(
        `UPDATE public.scan_messages SET mentions = $1::jsonb WHERE id = $2;`,
        [JSON.stringify(mentionsJson), messageId],
        platform?.env
      );
    } catch (err) {
      console.warn('[MENTIONS] Erro ao persistir scan_message_mentions:', err);
    }
  }

  if (targetUserMap.size === 0) {
    return { count: 0, notifiedUserIds: [] };
  }

  // 4. Disparar notificações e e-mails unificados
  const safeText = stripSpoilers(text);
  const snippet = safeText.length > 200 ? safeText.slice(0, 200) + '...' : safeText;
  const notifiedUserIds: string[] = [];

  for (const [uid, target] of targetUserMap.entries()) {
    if (uid === authorId) {
      continue;
    }

    if (excludeUserIds && excludeUserIds.includes(uid)) {
      continue;
    }

    const notifType = target.mentionType === 'ROLE' ? 'ROLE_MENTION' : 'MENTION';
    const notifTitle = target.mentionType === 'ROLE'
      ? `Você foi mencionado pelo cargo @${target.username}`
      : (title || (contextType === 'COMMENT' ? `${authorName} mencionou você em um comentário` : contextType === 'MURAL' ? `${authorName} mencionou você no Mural` : `${authorName} mencionou você no Chat`));

    const dedupeKey = `mention:${uid}:${messageId || deepLink}`;

    const res = await createNotification({
      recipientUserId: uid,
      actorUserId: authorId,
      type: notifType,
      title: notifTitle,
      body: snippet,
      deepLink,
      scanId,
      priority: 'NORMAL',
      dedupeKey,
      skipEmail: true,
      platform
    });

    if (res.notificationId) {
      notifiedUserIds.push(uid);
    }
  }

  return { count: notifiedUserIds.length, notifiedUserIds };
}
