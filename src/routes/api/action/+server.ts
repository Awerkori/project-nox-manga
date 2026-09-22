import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';

import { eq, sql } from 'drizzle-orm';
import { dispatchMentions } from '$lib/server/mentions';
import { createNotification, processPendingEmailOutbox } from '$lib/server/notifications';
import { performCacheInvalidation } from '$lib/server/cache-invalidation';
import type { Json } from '$lib/database.types';

declare module 'drizzle-orm/libsql' {
  interface LibSQLDatabase {
    execute<T = unknown>(query: any): Promise<T>;
  }
}

export const POST = async ({ request, locals, platform }: any) => {
  
  const text = await request.text();
  if (text.length > 60_000) error(413, 'Solicitação muito grande');
  let body;
  try {
    body = z
      .object({
        scope: z.enum(['member', 'editor', 'owner']),
        action: z.string().max(40),
        data: z.record(z.string(), z.unknown())
      })
      .parse(JSON.parse(text));
  } catch {
    error(400, 'Solicitação inválida');
  }

  // Direct TypeScript handler for member reading progress
  if (body.scope === 'member' && (body.action === 'read_start' || body.action === 'read_page')) {
    const userId = locals.user?.id;
    const chapterId = body.data.chapterId ? String(body.data.chapterId) : null;
    const pageNum = Math.max(1, Number(body.data.page) || 1);
    const completed = Boolean(body.data.completed);

    if (userId && chapterId) {
      const nowIso = new Date().toISOString();
      try {
        await safeQuery(
          db.insert(schema.reading)
            .values({
              userId,
              chapterId,
              page: pageNum,
              maxPage: pageNum,
              startedAt: nowIso,
              updatedAt: nowIso,
              completedAt: completed ? nowIso : null
            })
            .onConflictDoUpdate({
              target: [schema.reading.userId, schema.reading.chapterId],
              set: {
                page: pageNum,
                maxPage: sql`GREATEST(${schema.reading.maxPage}, ${pageNum})`,
                updatedAt: nowIso,
                completedAt: completed
                  ? sql`COALESCE(${schema.reading.completedAt}, ${nowIso}::timestamptz)`
                  : schema.reading.completedAt
              }
            })
        );
      } catch (err) {
        console.error('[ACTION] read_page sync error:', err);
      }
    }
    return json({ ok: true });
  }

  // Direct TypeScript handler for editor scope
  if (body.scope === 'editor') {
    const userRole = String(locals.role || locals.profile?.role || '').toUpperCase();
    const isEditor = Boolean(locals.user && ['ADMIN', 'STAFF_SITE', 'EDITOR', 'OWNER'].includes(userRole));
    if (!isEditor) {
      error(403, 'Acesso editorial negado');
    }

    const nowIso = new Date().toISOString();

    if (body.action === 'work') {
      const p = body.data;
      const workId = (p.id && typeof p.id === 'string' && p.id.trim()) ? p.id.trim() : crypto.randomUUID();

      // Query existing record to preserve fields in case of partial update
      const existingRes = await safeQuerySingle(
        db.select({
          id: schema.works.id,
          title: schema.works.title,
          slug: schema.works.slug,
          aliases: schema.works.aliases,
          synopsis: schema.works.synopsis,
          description: schema.works.description,
          author: schema.works.author,
          artist: schema.works.artist,
          kind: schema.works.kind,
          status: schema.works.status,
          year: schema.works.year,
          ageRating: schema.works.ageRating,
          published: schema.works.published,
          coverId: schema.works.coverId,
          contentRating: schema.works.contentRating
        })
        .from(schema.works)
        .where(eq(schema.works.id, workId))
      );
      const existing = existingRes?.data;

      const title = p.title !== undefined ? String(p.title).trim() : (existing?.title || '');
      const slug = p.slug !== undefined ? String(p.slug).trim().toLowerCase() : (existing?.slug || '');

      if (!title) error(400, 'Título da obra é obrigatório');
      if (!slug) error(400, 'Slug da obra é obrigatório');

      const synopsis = p.synopsis !== undefined ? String(p.synopsis).trim() : (existing?.synopsis || '');
      const description = p.description !== undefined ? String(p.description).trim() : (existing?.description || '');
      const author = p.author !== undefined ? String(p.author).trim() : (existing?.author || '');
      const artist = p.artist !== undefined ? String(p.artist).trim() : (existing?.artist || '');
      const kind = p.kind !== undefined ? String(p.kind).toUpperCase() : (existing?.kind || 'MANHWA');
      const status = p.status !== undefined ? String(p.status).toUpperCase() : (existing?.status || 'ONGOING');

      const rawYear = p.year !== undefined ? p.year : existing?.year;
      const year = (rawYear !== null && rawYear !== undefined && rawYear !== '') ? Number(rawYear) : null;

      // Handle coverId / cover_id interchangeably
      const rawCoverId = p.coverId ?? p.cover_id;
      const coverId = rawCoverId !== undefined
        ? (rawCoverId && typeof rawCoverId === 'string' && rawCoverId.trim() ? rawCoverId.trim() : null)
        : (existing?.coverId || null);

      // Handle content_rating / contentRating & age_rating / ageRating
      const rawContentRating = p.content_rating ?? p.contentRating;
      const rawAgeRating = p.age_rating ?? p.ageRating;
      const contentRating = rawContentRating !== undefined
        ? ((rawContentRating === 'ADULT_18' || Number(rawAgeRating) >= 18) ? 'ADULT_18' : 'GENERAL')
        : (existing?.contentRating || 'GENERAL');

      const ageRating = rawAgeRating !== undefined
        ? (contentRating === 'ADULT_18' ? 18 : Number(rawAgeRating || 12))
        : (existing?.ageRating ?? (contentRating === 'ADULT_18' ? 18 : 12));

      // Aliases handling
      let aliases: string[] = existing?.aliases || [];
      if (p.aliases !== undefined) {
        if (Array.isArray(p.aliases)) {
          aliases = p.aliases.map((a: any) => String(a).trim()).filter(Boolean);
        } else if (typeof p.aliases === 'string') {
          aliases = p.aliases.split('\n').map((a: string) => a.trim()).filter(Boolean);
        }
      }

      const searchText = [title, slug, ...aliases].filter(Boolean).join(' ').toLowerCase();

      const aliasesSql = aliases.length > 0
        ? sql`ARRAY[${sql.join(aliases.map(a => sql`${a}`), sql`, `)}]::text[]`
        : sql`ARRAY[]::text[]`;

      const metaProv = JSON.stringify({
        source: 'admin_editor',
        editor_id: locals.user.id,
        updated_at: nowIso
      });

      if (existing) {
        await safeQuery(
          db.execute(sql`
            UPDATE works SET
              title = ${title},
              slug = ${slug},
              aliases = ${aliasesSql},
              synopsis = ${synopsis},
              description = ${description},
              author = ${author},
              artist = ${artist},
              kind = ${kind},
              status = ${status},
              year = ${year},
              age_rating = ${ageRating},
              content_rating = ${contentRating},
              cover_id = ${coverId ? sql`${coverId}::uuid` : sql`NULL`},
              search_text = ${searchText},
              metadata_provenance = ${metaProv}::jsonb,
              updated_at = ${nowIso}::timestamptz
            WHERE id = ${workId}::uuid
          `)
        );
      } else {
        await safeQuery(
          db.execute(sql`
            INSERT INTO works (
              id, title, slug, aliases, synopsis, description, author, artist,
              kind, status, year, age_rating, content_rating, cover_id,
              published, featured, search_text, metadata_provenance,
              views_total, created_at, updated_at
            ) VALUES (
              ${workId}::uuid, ${title}, ${slug}, ${aliasesSql}, ${synopsis}, ${description}, ${author}, ${artist},
              ${kind}, ${status}, ${year}, ${ageRating}, ${contentRating}, ${coverId ? sql`${coverId}::uuid` : sql`NULL`},
              false, false, ${searchText}, ${metaProv}::jsonb,
              0, ${nowIso}::timestamptz, ${nowIso}::timestamptz
            )
          `)
        );
      }

      // Handle tags
      if (Array.isArray(p.tags)) {
        const tagIds = p.tags.map((t: any) => String(t).trim()).filter(Boolean);
        await safeQuery(
          db.execute(sql`DELETE FROM work_tags WHERE work_id = ${workId}::uuid AND system_generated = false`)
        );
        for (const tid of tagIds) {
          await safeQuery(
            db.execute(sql`
              INSERT INTO work_tags (work_id, tag_id, system_generated)
              VALUES (${workId}::uuid, ${tid}::uuid, false)
              ON CONFLICT DO NOTHING
            `)
          );
        }
      }

      // Handle system tags for content rating
      const adultTagRes = await safeQuerySingle(
        db.select({ id: schema.tags.id }).from(schema.tags).where(eq(schema.tags.slug, 'adulto-18'))
      );
      const pornhwaTagRes = await safeQuerySingle(
        db.select({ id: schema.tags.id }).from(schema.tags).where(eq(schema.tags.slug, 'pornhwa'))
      );
      const adultTagId = adultTagRes?.data?.id;
      const pornhwaTagId = pornhwaTagRes?.data?.id;

      if (contentRating === 'ADULT_18') {
        if (adultTagId) {
          await safeQuery(
            db.execute(sql`
              INSERT INTO work_tags (work_id, tag_id, system_generated)
              VALUES (${workId}::uuid, ${adultTagId}::uuid, true)
              ON CONFLICT DO NOTHING
            `)
          );
        }
        if (kind === 'MANHWA' && pornhwaTagId) {
          await safeQuery(
            db.execute(sql`
              INSERT INTO work_tags (work_id, tag_id, system_generated)
              VALUES (${workId}::uuid, ${pornhwaTagId}::uuid, true)
              ON CONFLICT DO NOTHING
            `)
          );
        } else if (pornhwaTagId) {
          await safeQuery(
            db.execute(sql`
              DELETE FROM work_tags
              WHERE work_id = ${workId}::uuid AND system_generated = true AND tag_id = ${pornhwaTagId}::uuid
            `)
          );
        }
      } else {
        if (adultTagId) {
          await safeQuery(
            db.execute(sql`
              DELETE FROM work_tags
              WHERE work_id = ${workId}::uuid AND system_generated = true AND tag_id = ${adultTagId}::uuid
            `)
          );
        }
        if (pornhwaTagId) {
          await safeQuery(
            db.execute(sql`
              DELETE FROM work_tags
              WHERE work_id = ${workId}::uuid AND system_generated = true AND tag_id = ${pornhwaTagId}::uuid
            `)
          );
        }
      }

      // Handle scans
      if (Array.isArray(p.scans)) {
        await safeQuery(
          db.execute(sql`DELETE FROM work_scans WHERE work_id = ${workId}::uuid`)
        );
        for (const s of p.scans) {
          const scanId = s.scanId || s.scan_id;
          const isPrimary = Boolean(s.isPrimary ?? s.is_primary);
          if (scanId) {
            await safeQuery(
              db.execute(sql`
                INSERT INTO work_scans (work_id, scan_id, is_primary, created_at, status)
                VALUES (${workId}::uuid, ${scanId}::uuid, ${isPrimary}, ${nowIso}::timestamptz, 'ACTIVE')
                ON CONFLICT DO NOTHING
              `)
            );
          }
        }

        const applyToChapters = Boolean(p.apply_to_chapters ?? p.applyToChapters);
        if (applyToChapters) {
          await safeQuery(
            db.execute(sql`
              DELETE FROM chapter_scans
              WHERE chapter_id IN (SELECT id FROM chapters WHERE work_id = ${workId}::uuid)
            `)
          );
          await safeQuery(
            db.execute(sql`
              INSERT INTO chapter_scans (chapter_id, scan_id, created_at)
              SELECT c.id, ws.scan_id, ${nowIso}::timestamptz
              FROM chapters c
              CROSS JOIN work_scans ws
              WHERE c.work_id = ${workId}::uuid AND ws.work_id = ${workId}::uuid
              ON CONFLICT DO NOTHING
            `)
          );
        }
      }

      // Audit Log
      try {
        await safeQuery(
          db.execute(sql`
            INSERT INTO audit_log (actor_id, action, target_id, metadata, created_at)
            VALUES (${locals.user.id}::uuid, ${body.action}, ${workId}::uuid, ${JSON.stringify(body.data)}::jsonb, ${nowIso}::timestamptz)
          `)
        );
      } catch (auditErr) {
        console.warn('[AUDIT LOG] Failed to record audit log:', auditErr);
      }

      // Cache Invalidation
      const previousSlug = existing?.slug;
      try {
        await performCacheInvalidation({
          workId,
          workSlug: slug
        });
        if (previousSlug && previousSlug !== slug) {
          await performCacheInvalidation({
            workId,
            workSlug: previousSlug
          });
        }
      } catch (cacheErr) {
        console.warn('[ACTION] Cache invalidation warning:', cacheErr);
      }

      return json({ ok: true, id: workId, slug, title });
    }

    if (body.action === 'archive') {
      const targetId = body.data.id ? String(body.data.id).trim() : null;
      if (!targetId) error(400, 'ID da obra é obrigatório');
      await safeQuery(
        db.execute(sql`
          UPDATE works
          SET published = false, updated_at = ${nowIso}::timestamptz
          WHERE id = ${targetId}::uuid
        `)
      );
      await performCacheInvalidation({ workId: targetId });
      return json({ ok: true, id: targetId, archived: true });
    }

    if (body.action === 'tag') {
      const tagId = (body.data.id && typeof body.data.id === 'string' && body.data.id.trim()) ? body.data.id.trim() : crypto.randomUUID();
      const name = String(body.data.name || '').trim();
      const slug = String(body.data.slug || '').trim().toLowerCase();
      const kind = String(body.data.kind || 'GENRE').toUpperCase();
      if (!name || !slug) error(400, 'Nome e slug da tag são obrigatórios');

      await safeQuery(
        db.execute(sql`
          INSERT INTO tags (id, name, slug, kind)
          VALUES (${tagId}::uuid, ${name}, ${slug}, ${kind})
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            slug = EXCLUDED.slug,
            kind = EXCLUDED.kind
        `)
      );
      return json({ ok: true, id: tagId });
    }

    if (body.action === 'scan') {
      const scanId = (body.data.id && typeof body.data.id === 'string' && body.data.id.trim()) ? body.data.id.trim() : crypto.randomUUID();
      const name = String(body.data.name || '').trim();
      const slug = String(body.data.slug || '').trim().toLowerCase();
      const description = String(body.data.description || '').trim();
      const website = String(body.data.website || '').trim();
      const discord = String(body.data.discord || '').trim();
      const status = String(body.data.status || 'ACTIVE').toUpperCase();
      const isOfficial = Boolean(body.data.is_official ?? body.data.isOfficial);

      await safeQuery(
        db.execute(sql`
          INSERT INTO scans (id, name, slug, description, website, discord, status, is_official, updated_at)
          VALUES (${scanId}::uuid, ${name}, ${slug}, ${description}, ${website}, ${discord}, ${status}, ${isOfficial}, ${nowIso}::timestamptz)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            slug = EXCLUDED.slug,
            description = EXCLUDED.description,
            website = EXCLUDED.website,
            discord = EXCLUDED.discord,
            status = EXCLUDED.status,
            is_official = EXCLUDED.is_official,
            updated_at = ${nowIso}::timestamptz
        `)
      );
      return json({ ok: true, id: scanId });
    }

    if (body.action === 'delete_scan') {
      const scanId = String(body.data.id || '').trim();
      if (!scanId) error(400, 'ID da scan é obrigatório');
      const scanRes = await safeQuerySingle(
        db.select({ isOfficial: schema.scans.isOfficial }).from(schema.scans).where(eq(schema.scans.id, scanId))
      );
      if (scanRes?.data?.isOfficial) {
        error(400, 'A scan oficial Project Nox não pode ser removida.');
      }
      await safeQuery(db.execute(sql`DELETE FROM chapter_scans WHERE scan_id = ${scanId}::uuid`));
      await safeQuery(db.execute(sql`DELETE FROM work_scans WHERE scan_id = ${scanId}::uuid`));
      await safeQuery(db.execute(sql`DELETE FROM scan_members WHERE scan_id = ${scanId}::uuid`));
      await safeQuery(db.execute(sql`DELETE FROM scans WHERE id = ${scanId}::uuid`));
      return json({ ok: true, id: scanId, deleted: true });
    }

    if (body.action === 'apply_work_scans_to_chapters') {
      const targetId = String(body.data.work_id || body.data.workId || '').trim();
      if (!targetId) error(400, 'ID da obra é obrigatório');
      await safeQuery(
        db.execute(sql`
          DELETE FROM chapter_scans
          WHERE chapter_id IN (SELECT id FROM chapters WHERE work_id = ${targetId}::uuid)
        `)
      );
      await safeQuery(
        db.execute(sql`
          INSERT INTO chapter_scans (chapter_id, scan_id, created_at)
          SELECT c.id, ws.scan_id, ${nowIso}::timestamptz
          FROM chapters c
          CROSS JOIN work_scans ws
          WHERE c.work_id = ${targetId}::uuid AND ws.work_id = ${targetId}::uuid
          ON CONFLICT DO NOTHING
        `)
      );
      return json({ ok: true, workId: targetId });
    }

    if (body.action === 'chapter') {
      const p = body.data;
      const chapterId = (p.id && typeof p.id === 'string' && p.id.trim()) ? p.id.trim() : crypto.randomUUID();
      const workId = String(p.work_id || p.workId || '').trim();
      const number = Number(p.number);
      const title = String(p.title || '').trim();

      if (!workId) error(400, 'Obra é obrigatória');
      if (isNaN(number)) error(400, 'Número do capítulo é obrigatório');

      await safeQuery(
        db.execute(sql`
          INSERT INTO chapters (id, work_id, number, title)
          VALUES (${chapterId}::uuid, ${workId}::uuid, ${number}, ${title})
          ON CONFLICT (id) DO UPDATE SET
            number = EXCLUDED.number,
            title = EXCLUDED.title
        `)
      );

      if (Array.isArray(p.pages)) {
        await safeQuery(db.execute(sql`DELETE FROM pages WHERE chapter_id = ${chapterId}::uuid`));
        for (let i = 0; i < p.pages.length; i++) {
          const mediaId = String(p.pages[i]);
          await safeQuery(
            db.execute(sql`
              INSERT INTO pages (chapter_id, position, media_id)
              VALUES (${chapterId}::uuid, ${i + 1}, ${mediaId}::uuid)
            `)
          );
        }
      }

      if (Array.isArray(p.scans)) {
        await safeQuery(db.execute(sql`DELETE FROM chapter_scans WHERE chapter_id = ${chapterId}::uuid`));
        for (const sid of p.scans) {
          await safeQuery(
            db.execute(sql`
              INSERT INTO chapter_scans (chapter_id, scan_id, created_at)
              VALUES (${chapterId}::uuid, ${sid}::uuid, ${nowIso}::timestamptz)
              ON CONFLICT DO NOTHING
            `)
          );
        }
      }

      return json({ ok: true, id: chapterId });
    }

    if (body.action === 'publish') {
      const chapterId = String(body.data.id || '').trim();
      if (!chapterId) error(400, 'ID do capítulo é obrigatório');
      const chapRes = await safeQuerySingle(
        db.select({ workId: schema.chapters.workId, publishedAt: schema.chapters.publishedAt })
          .from(schema.chapters)
          .where(eq(schema.chapters.id, chapterId))
      );
      if (!chapRes?.data) error(404, 'Capítulo inexistente');
      const wid = chapRes.data.workId;

      await safeQuery(
        db.execute(sql`UPDATE chapters SET published_at = ${nowIso}::timestamptz WHERE id = ${chapterId}::uuid`)
      );
      await safeQuery(
        db.execute(sql`
          UPDATE works
          SET published = true, latest_chapter_published_at = ${nowIso}::timestamptz, updated_at = ${nowIso}::timestamptz
          WHERE id = ${wid}::uuid
        `)
      );
      await performCacheInvalidation({ workId: wid, chapterId });
      return json({ ok: true, id: chapterId });
    }

    if (body.action === 'unpublish') {
      const chapterId = String(body.data.id || '').trim();
      if (!chapterId) error(400, 'ID do capítulo é obrigatório');
      await safeQuery(
        db.execute(sql`UPDATE chapters SET published_at = NULL WHERE id = ${chapterId}::uuid`)
      );
      return json({ ok: true, id: chapterId });
    }

    if (body.action === 'shop_item') {
      const p = body.data;
      const id = String(p.id || '').trim();
      const name = String(p.name || '').trim();
      const desc = String(p.description || '').trim();
      const kind = String(p.kind || 'FRAME');
      const priceXp = Number(p.price_xp || p.priceXp || 0);
      const rarity = String(p.rarity || 'COMUM');
      const isAnimated = Boolean(p.is_animated ?? p.isAnimated);
      const minLevel = Number(p.min_level || p.minLevel || 1);
      const isActive = Boolean(p.is_active ?? p.isActive ?? true);
      const status = String(p.status || 'ACTIVE');
      const orderIndex = Number(p.order_index || p.orderIndex || 99);
      const assetUrl = String(p.asset_url || p.assetUrl || '');
      const styleData = typeof p.style_data === 'object' ? JSON.stringify(p.style_data) : String(p.style_data || '{}');

      await safeQuery(
        db.execute(sql`
          INSERT INTO shop_items (id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
          VALUES (${id}, ${name}, ${desc}, ${kind}, ${priceXp}, ${rarity}, ${isAnimated ? 1 : 0}, ${minLevel}, ${isActive}, ${status}, ${orderIndex}, ${assetUrl}, ${styleData})
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            kind = EXCLUDED.kind,
            price_xp = EXCLUDED.price_xp,
            rarity = EXCLUDED.rarity,
            is_animated = EXCLUDED.is_animated,
            min_level = EXCLUDED.min_level,
            is_active = EXCLUDED.is_active,
            status = EXCLUDED.status,
            order_index = EXCLUDED.order_index,
            asset_url = EXCLUDED.asset_url,
            style_data = EXCLUDED.style_data
        `)
      );
      return json({ ok: true, id });
    }

    if (body.action === 'delete_shop_item') {
      const id = String(body.data.id || '').trim();
      if (!id) error(400, 'ID do item é obrigatório');
      const invCount = await safeQuery(
        db.execute(sql`SELECT count(*) as count FROM member_inventory WHERE item_id = ${id}`)
      );
      if (Number((invCount.data as any)?.[0]?.count || 0) > 0) {
        await safeQuery(
          db.execute(sql`UPDATE shop_items SET is_active = false, status = 'ARCHIVED' WHERE id = ${id}`)
        );
        return json({ ok: true, archived: true, message: 'Item arquivado para proteger inventários de usuários.' });
      } else {
        await safeQuery(db.execute(sql`DELETE FROM shop_items WHERE id = ${id}`));
        return json({ ok: true, deleted: true });
      }
    }

    error(400, `Ação editorial desconhecida: ${body.action}`);
  }

  const { data: rpcData, error: problem } = await safeQuery(
    db.execute(sql`SELECT ${sql.raw(body.scope + '_action')}(${body.action}, ${JSON.stringify(body.data)}) as result`)
  );
  const data = (rpcData as any[])?.[0]?.result;
  if (problem) error((problem as any).code === '42501' ? 403 : 400, (problem as any).message);

  if (body.scope === 'member' && body.action === 'comment' && locals.user) {
    const commentBody = String(body.data.body || '');
    const chapterId = body.data.chapterId ? String(body.data.chapterId) : null;
    const workId = body.data.workId ? String(body.data.workId) : null;
    const parentId = body.data.parentId ? String(body.data.parentId) : null;
    const commentId = (data as any)?.id;

    let workSlug = workId || '';
    let workTitle = 'Obra';
    let chapterNumber = '';

    if (workId) {
      const { data: w } = await safeQuerySingle(
        db.select({ slug: schema.works.slug, title: schema.works.title })
          .from(schema.works)
          .where(eq(schema.works.id, workId))
      );
      if (w?.slug) workSlug = w.slug;
      if (w?.title) workTitle = w.title;
    }

    if (chapterId) {
      const { data: chap } = await safeQuerySingle(
        db.select({
          number: schema.chapters.number,
          slug: schema.works.slug,
          title: schema.works.title
        })
        .from(schema.chapters)
        .leftJoin(schema.works, eq(schema.chapters.workId, schema.works.id))
        .where(eq(schema.chapters.id, chapterId))
      );
      if (chap?.number !== undefined && chap?.number !== null) chapterNumber = ` #${chap.number}`;
      if (chap?.slug) workSlug = chap.slug;
      if (chap?.title) workTitle = chap.title;

    }

    const hash = commentId ? `#comment-${commentId}` : '';
    const deepLink = chapterId ? `/ler/${chapterId}${hash}` : `/obra/${workSlug}${hash}`;

    // Buscar nome do autor
    let authorName = 'Algum';
    const { data: member } = await safeQuerySingle(
      db.select({
        displayName: schema.members.displayName,
        username: schema.members.username
      })
      .from(schema.members)
      .where(eq(schema.members.id, locals.user!.id))
    );
    if (member) {
      authorName = member.displayName || member.username || 'Algum';
    }

    // Notify parent comment author if replying
    if (parentId) {
      try {
        const { data: parent } = await safeQuerySingle(
          db.select({ userId: schema.comments.userId, body: schema.comments.body })
            .from(schema.comments)
            .where(eq(schema.comments.id, parentId))
        );

        if (parent && parent.userId && parent.userId !== locals.user!.id) {
          const replyDeepLink = chapterId
            ? `/ler/${chapterId}#comment-${parentId}`
            : `/obra/${workSlug}#comment-${parentId}`;

          await createNotification({
            recipientUserId: parent.userId,
            actorUserId: locals.user!.id,
            type: 'REPLY_COMMENT',
            title: chapterId
              ? `${authorName} respondeu ao seu comentário no capítulo${chapterNumber}`
              : `${authorName} respondeu ao seu comentário em ${workTitle}`,
            body: commentBody,
            deepLink: replyDeepLink,
            context: workTitle,
            priority: 'NORMAL',
            dedupeKey: `comm_reply:${parentId}:${commentId || Date.now()}`,
            platform
          });
        }
      } catch (err) {
        console.error('[ACTION] Error notifying comment reply:', err);
      }
    }

    // Centralized Mention Dispatch
    let mentionsData = null;
    if (Array.isArray(body.data.mentionsData)) {
      mentionsData = body.data.mentionsData;
    }

    try {
      await dispatchMentions({
        locals,
        text: commentBody,
        authorId: locals.user!.id,
        title: chapterId
          ? `${authorName} mencionou você no capítulo${chapterNumber} de ${workTitle}`
          : `${authorName} mencionou você em ${workTitle}`,
        deepLink,
        contextType: 'COMMENT',
        workId,
        chapterId,
        mentionsData,
        platform
      });
    } catch (err) {
      console.error('[ACTION] Error dispatching comment mentions:', err);
    }

    if ((platform as any)?.context?.waitUntil) {
      (platform as any).context.waitUntil(processPendingEmailOutbox(10).catch(() => {}));
    }
  }

  return json(data);
};
