import { privileged } from '$lib/server/db';
import { createNotification } from './notifications';

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
 * Enforces:
 * - Auto-mention PERMITIDA (direta ou por cargo)
 * - Deduplication (1 user = 1 notification + 1 email mesmo se mencionado 2x ou por cargo + user)
 * - Persistência estruturada em public.scan_message_mentions e scan_messages.mentions
 * - Privacy preservation for private channels
 * - Realtime broadcast & Brevo dispatch via outbox imediata
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
  platform
}: DispatchMentionsParams): Promise<{ count: number; notifiedUserIds: string[] }> {
  const db = privileged();
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
    const { data: authorMem } = await db.from('members').select('display_name, username').eq('id', authorId).maybeSingle();
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
          const { data: roleMembers } = await db
            .from('scan_member_positions')
            .select('user_id')
            .eq('position_id', roleId);

          if (roleMembers && roleMembers.length > 0) {
            for (const rm of roleMembers) {
              // Se já foi adicionado como USER, manter USER (prioridade)
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
          const { data: allMembers } = await db
            .from('scan_members')
            .select('user_id')
            .eq('scan_id', scanId);

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
    let channelName = '';
    if (channelId) {
      const { data: ch } = await db
        .from('scan_channels')
        .select('is_private, name')
        .eq('id', channelId)
        .maybeSingle();
      if (ch) {
        if (ch.is_private) isPrivateChannel = true;
        if (ch.name) channelName = ch.name;
      }
    }

    const { data: resolved } = await db.rpc('resolve_scan_mentions', {
      p_scan_id: scanId,
      p_text: text
    });

    if (resolved && resolved.length > 0) {
      for (const r of resolved) {
        const uid = r.target_user_id;
        if (uid) {
          const resolvedType = r.mention_type === 'POSITION' ? 'ROLE' : (r.mention_type as any) || 'USER';
          const existing = targetUserMap.get(uid);

          // Se não existe ou se o novo é USER e o anterior era ROLE/ALL, atualizar para USER
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

    if (isPrivateChannel && targetUserMap.size > 0) {
      const uids = Array.from(targetUserMap.keys());
      const { data: members } = await db
        .from('scan_members')
        .select('user_id')
        .eq('scan_id', scanId)
        .in('user_id', uids);
      const allowedSet = new Set((members || []).map((m: any) => m.user_id));
      for (const uid of uids) {
        if (!allowedSet.has(uid)) {
          targetUserMap.delete(uid);
        }
      }
    }
  } else if (!scanId && rawTags.length > 0) {
    // Public Platform Context (Work or Chapter Comments)
    const orFilter = rawTags.map(t => `username.ilike.${t}`).join(',');
    const { data: members } = await db
      .from('members')
      .select('id, username')
      .or(orFilter);

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
      await db.from('scan_message_mentions').insert(structuredMentionsToPersist);
      const mentionsJson = Array.from(targetUserMap.values()).map(t => ({
        type: t.mentionType,
        user_id: t.userId,
        role_id: t.roleId || null,
        label: '@' + t.username
      }));
      await db.from('scan_messages').update({ mentions: mentionsJson }).eq('id', messageId);
    } catch (err) {
      console.warn('[MENTIONS] Erro ao persistir scan_message_mentions:', err);
    }
  }

  if (targetUserMap.size === 0) {
    return { count: 0, notifiedUserIds: [] };
  }

  // 4. Disparar notificações e e-mails unificados
  const snippet = text.length > 200 ? text.slice(0, 200) + '...' : text;
  const notifiedUserIds: string[] = [];

  for (const [uid, target] of targetUserMap.entries()) {
    const notifType = target.mentionType === 'ROLE' ? 'ROLE_MENTION' : 'MENTION';
    const notifTitle = target.mentionType === 'ROLE'
      ? `Você foi mencionado pelo cargo @${target.username}`
      : (title || (contextType === 'COMMENT' ? `${authorName} mencionou você em um comentário` : contextType === 'MURAL' ? `${authorName} mencionou você no Mural` : `${authorName} mencionou você no Chat`));

    // Dedupe key estrita por usuário e mensagem (ou URL) para garantir EXATAMENTE 1 notificação e 1 email
    const dedupeKey = `mention:${uid}:${messageId || deepLink}`;

    const res = await createNotification({
      recipientUserId: uid,
      actorUserId: authorId,
      type: notifType,
      title: notifTitle,
      body: snippet,
      deepLink,
      scanId,
      priority: 'URGENT',
      dedupeKey,
      platform
    });

    if (res.notificationId) {
      notifiedUserIds.push(uid);
    }
  }

  return { count: notifiedUserIds.length, notifiedUserIds };
}
