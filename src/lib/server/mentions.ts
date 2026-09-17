import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, inArray, or, ilike, and } from 'drizzle-orm';
import { createNotification } from './notifications';
export interface MentionTarget {
  userId: string;
  username: string;
  email: string | null;
  mentionType: 'USER' | 'ROLE' | 'ALL';
  roleId?: string | null;
}

export interface StructuredMentionInput {type: 'user' | 'position' | 'all' | 'USER' | 'ROLE' | 'ALL';
  id?: string;
  targetUserId?: string;
  targetRoleId?: string;
  label: string;}

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
  const matches = text.match(/(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_\-]+)/g);
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
 * - Persistncia estruturada em public.scan_message_mentions e scan_messages.mentions
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
  const targetUserMap = new Map<string, MentionTarget>();
  const structuredMentionsToPersist: Array<{
    messageId: string;
    mentionType: 'USER' | 'ROLE' | 'ALL';
    targetUserId: string | null;
    targetRoleId: string | null;
    mentionText: string;}> = [];

  // Obter nome do autor para mensagens personalizadas
  let authorName = 'Algum';
  try {
    const { data: authorMem } = await safeQuerySingle(db.select({ displayName: schema.members.displayName, username: schema.members.username }).from(schema.members).where(eq(schema.members.id, authorId)));
    if (authorMem) {
      authorName = authorMem.displayName || authorMem.username || 'Algum';
    }
  } catch (err) {
    console.warn('[MENTIONS] Erro ao buscar nome do autor:', err);
  }

  // 1. Processar dados estruturados enviados do autocomplete (se disponveis)
  if (mentionsData && Array.isArray(mentionsData) && mentionsData.length > 0) {
    for (const item of mentionsData) {
      const normalizedType = item.type.toUpperCase();
      if (normalizedType === 'USER') {
        const uid = item.targetUserId || item.id;
        if (uid) {
          targetUserMap.set(uid, {
            userId: uid,
            username: item.label.replace(/^@/, ''),
            email: null,
            mentionType: 'USER'
          });
          if (messageId) {structuredMentionsToPersist.push({
              messageId: messageId,
              mentionType: 'USER',
              targetUserId: uid,
              targetRoleId: null,
              mentionText: item.label});
          }
        }
      } else if (normalizedType === 'POSITION' || normalizedType === 'ROLE') {
        const roleId = item.targetRoleId || item.id;
        if (roleId && scanId) {
          // Buscar todos os membros que possuem essa posio na Scan
          const { data: roleMembers } = await safeQuery(db
            .select({ userId: schema.scanMemberPositions.userId })
            .from(schema.scanMemberPositions)
            .where(eq(schema.scanMemberPositions.positionId, roleId)));

          if (roleMembers && roleMembers.length > 0) {
            for (const rm of roleMembers) {
              // Se j foi adicionado como USER, manter USER (prioridade)
              const existing = targetUserMap.get(rm.userId);
              if (!existing || existing.mentionType !== 'USER') {
                targetUserMap.set(rm.userId, {
                  userId: rm.userId,
                  username: item.label.replace(/^@/, ''),
                  email: null,
                  mentionType: 'ROLE',
                  roleId: roleId
                });
              }
            }
          }

          if (messageId) {structuredMentionsToPersist.push({
              messageId: messageId,
              mentionType: 'ROLE',
              targetUserId: null,
              targetRoleId: roleId,
              mentionText: item.label});
          }
        }
      } else if (normalizedType === 'ALL') {
        if (scanId) {
          const { data: allMembers } = await safeQuery(db
            .select({ userId: schema.scanMembers.userId })
            .from(schema.scanMembers)
            .where(eq(schema.scanMembers.scanId, scanId)));

          if (allMembers && allMembers.length > 0) {
            for (const am of allMembers) {
              if (!targetUserMap.has(am.userId)) {
                targetUserMap.set(am.userId, {
                  userId: am.userId,
                  username: 'todos',
                  email: null,
                  mentionType: 'ALL'
                });
              }
            }
          }

          if (messageId) {structuredMentionsToPersist.push({
              messageId: messageId,
              mentionType: 'ALL',
              targetUserId: null,
              targetRoleId: null,
              mentionText: '@todos'});
          }
        }
      }
    }
  }

  // 2. Complementar via anlise de texto (caso menes tenham sido digitadas manualmente)
  const rawTags = extractMentions(text);
  if (scanId && rawTags.length > 0) {
    let isPrivateChannel = false;
    let channelName = '';
    if (channelId) {
      const { data: ch } = await safeQuerySingle(db
        .select({ isPrivate: schema.scanChannels.isPrivate, name: schema.scanChannels.name })
        .from(schema.scanChannels)
        .where(eq(schema.scanChannels.id, channelId)));
      if (ch) {
        if (ch.isPrivate) isPrivateChannel = true;
        if (ch.name) channelName = ch.name;
      }
    }

    const { data: resolved } = await (db as any).execute('resolve_scan_mentions', {
      p_scan_id: scanId,
      p_text: text
    });

    if (resolved && resolved.length > 0) {
      for (const r of resolved) {
        const uid = r.targetUserId;
        if (uid) {
          const resolvedType = r.mentionType === 'POSITION' ? 'ROLE' : (r.mentionType as any) || 'USER';
          const existing = targetUserMap.get(uid);

          // Se no existe ou se o novo  USER e o anterior era ROLE/ALL, atualizar para USER
          if (!existing || (resolvedType === 'USER' && existing.mentionType !== 'USER')) {
            targetUserMap.set(uid, {
              userId: uid,
              username: r.mention_label || 'membro',
              email: null,
              mentionType: resolvedType
            });
          }

          if (messageId && !structuredMentionsToPersist.some(s => s.targetUserId === uid && s.mentionType === resolvedType)) {structuredMentionsToPersist.push({
              messageId: messageId,
              mentionType: resolvedType,
              targetUserId: resolvedType === 'USER' ? uid : null,
              targetRoleId: null,
              mentionText: '@' + (r.mention_label || 'membro')});
          }
        }
      }
    }

    if (isPrivateChannel && targetUserMap.size > 0) {
      const uids = Array.from(targetUserMap.keys());
      const { data: members } = await safeQuery(db
        .select({ userId: schema.scanMembers.userId })
        .from(schema.scanMembers)
        .where(and(eq(schema.scanMembers.scanId, scanId), inArray(schema.scanMembers.userId, uids))));
      const allowedSet = new Set((members || []).map((m: any) => m.userId));
      for (const uid of uids) {
        if (!allowedSet.has(uid)) {
          targetUserMap.delete(uid);
        }
      }
    }
  } else if (!scanId && rawTags.length > 0) {
    // Public Platform Context (Work or Chapter Comments)
    const orFilter = rawTags.map(t => `username.ilike.${t}`).join(',');
    const { data: members } = await safeQuery(db
      .select({ id: schema.members.id, username: schema.members.username })
      .from(schema.members)
      .where(or(...rawTags.map(t => ilike(schema.members.username, `%${t}%`)))));

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

  // 3. Persistir menes estruturadas no banco
  if (messageId && structuredMentionsToPersist.length > 0) {try {
      await db.insert(schema.scanMessageMentions).values(structuredMentionsToPersist);
      const mentionsJson = Array.from(targetUserMap.values()).map(t => ({
        type: t.mentionType,
        userId: t.userId,
        role_id: t.roleId || null,
        label: '@' + t.username}));
      await db.update(schema.scanMessages).set({ mentions: JSON.stringify(mentionsJson) }).where(eq(schema.scanMessages.id, messageId));
    } catch (err) {
      console.warn('[MENTIONS] Erro ao persistir scan_message_mentions:', err);
    }
  }

  if (targetUserMap.size === 0) {
    return { count: 0, notifiedUserIds: [] };
  }

  // 4. Disparar notificaes e e-mails unificados
  const snippet = text.length > 200 ? text.slice(0, 200) + '...' : text;
  const notifiedUserIds: string[] = [];

  for (const [uid, target] of targetUserMap.entries()) {
    const notifType = target.mentionType === 'ROLE' ? 'ROLE_MENTION' : 'MENTION';
    const notifTitle = target.mentionType === 'ROLE'
      ? `Voc foi mencionado pelo cargo @${target.username}`
      : (title || (contextType === 'COMMENT' ? `${authorName} mencionou voc em um comentrio` : contextType === 'MURAL' ? `${authorName} mencionou voc no Mural` : `${authorName} mencionou voc no Chat`));

    // Dedupe key estrita por usurio e mensagem (ou URL) para garantir EXATAMENTE 1 notificao e 1 email
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
