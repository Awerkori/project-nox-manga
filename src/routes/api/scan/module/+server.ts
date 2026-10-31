import { json } from '@sveltejs/kit';
import { executeYugabyteSql, withYugabyteLkg, withYugabyteReadSession } from '$lib/server/yugabyte';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url, platform }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const scanId = url.searchParams.get('scan_id');
  const moduleName = url.searchParams.get('module');

  if (!scanId || !moduleName) {
    return json({ error: 'Missing scan_id or module' }, { status: 400 });
  }

  return withYugabyteReadSession(platform?.env, async (sessionEnv) => {
  // 1. Verify membership and role in this scan
  const memberRes = await executeYugabyteSql<{ role: string }>(
    `SELECT role FROM public.scan_members WHERE scan_id = $1 AND user_id = $2`,
    [scanId, locals.user.id],
    sessionEnv
  );

  if (!memberRes.rows.length) {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const userRole = memberRes.rows[0].role;
  const isScanLeader = ['OWNER', 'ADMIN'].includes(userRole);
  const isGlobalEditor = ['ADMIN', 'EDITOR', 'STAFF_SITE'].includes(locals.role || '');
  const canManageRecruitment = isScanLeader || isGlobalEditor;
  const canReadAllApplicationAnswers = isScanLeader || locals.role === 'ADMIN';

  switch (moduleName) {
    case 'recruitment': {
      const [posRes, openRes, appRes, qRes, aRes] = await Promise.all([
        executeYugabyteSql(
          `SELECT position.* FROM public.scan_positions position
           WHERE position.scan_id = $1 AND (position.is_active = true OR $2::boolean)
           ORDER BY position.display_order ASC`,
          [scanId, canManageRecruitment],
          sessionEnv
        ),
        executeYugabyteSql(
          `SELECT opening.*,
             CASE WHEN position.id IS NULL THEN NULL ELSE jsonb_build_object(
               'id', position.id, 'name', position.name, 'description', position.description,
               'icon', position.icon, 'display_order', position.display_order
             ) END AS scan_positions
           FROM public.scan_recruitment_openings opening
           LEFT JOIN public.scan_positions position ON position.id = opening.position_id
           WHERE opening.scan_id = $1 AND (opening.status = 'OPEN' OR $2::boolean)
           ORDER BY opening.created_at DESC`,
          [scanId, canManageRecruitment],
          sessionEnv
        ),
        executeYugabyteSql(
          `SELECT application.*,
             CASE WHEN position.id IS NULL THEN NULL ELSE jsonb_build_object(
               'id', position.id, 'name', position.name, 'description', position.description,
               'icon', position.icon, 'display_order', position.display_order
             ) END AS scan_positions,
             CASE WHEN opening.id IS NULL THEN NULL ELSE jsonb_build_object(
               'id', opening.id, 'title', opening.title
             ) END AS scan_recruitment_openings,
             CASE WHEN applicant.id IS NULL THEN NULL ELSE jsonb_build_object(
               'id', applicant.id, 'username', applicant.username,
               'display_name', applicant.display_name, 'avatar_id', applicant.avatar_id
             ) END AS members
           FROM public.scan_applications application
           LEFT JOIN public.scan_positions position ON position.id = application.position_id
           LEFT JOIN public.scan_recruitment_openings opening ON opening.id = application.opening_id
           LEFT JOIN public.members applicant ON applicant.id = application.user_id
           WHERE application.scan_id = $1 ORDER BY application.created_at DESC`,
          [scanId],
          sessionEnv
        ),
        executeYugabyteSql(
          `SELECT question.* FROM public.scan_recruitment_questions question
           WHERE question.scan_id = $1 ORDER BY question.display_order ASC`,
          [scanId],
          sessionEnv
        ),
        executeYugabyteSql(
          `SELECT answer.*,
             CASE WHEN question.id IS NULL THEN NULL ELSE jsonb_build_object(
               'id', question.id, 'question', question.question,
               'question_type', question.question_type, 'display_order', question.display_order
             ) END AS question
           FROM public.scan_application_answers answer
           JOIN public.scan_applications application ON application.id = answer.application_id
           LEFT JOIN public.scan_recruitment_questions question ON question.id = answer.question_id
           WHERE application.scan_id = $1 AND ($2::boolean OR application.user_id = $3)
           ORDER BY answer.created_at ASC`,
          [scanId, canReadAllApplicationAnswers, locals.user.id],
          sessionEnv
        )
      ]);

      const applications = appRes.rows;
      const openings = openRes.rows.map((op: any) => {
        const apps = applications.filter((a: any) => a.opening_id === op.id);
        return {
          ...op,
          applications_count: apps.length,
          pending_count: apps.filter((a: any) => ['PENDING', 'UNDER_REVIEW'].includes(a.status)).length
        };
      });

      return json({
        positions: posRes.rows,
        openings,
        applications,
        recruitmentQuestions: qRes.rows,
        applicationAnswers: aRes.rows
      });
    }

    case 'knowledge': {
      const [wikiRes, glossRes, refRes] = await Promise.all([
        executeYugabyteSql(
          `SELECT wiki_page.* FROM public.scan_wiki_pages wiki_page
           WHERE wiki_page.scan_id = $1 ORDER BY wiki_page.is_pinned DESC, wiki_page.title ASC`,
          [scanId],
          sessionEnv
        ),
        executeYugabyteSql(
          `SELECT glossary_entry.* FROM public.work_glossary_entries glossary_entry
           WHERE glossary_entry.scan_id = $1 ORDER BY glossary_entry.source_term ASC`,
          [scanId],
          sessionEnv
        ),
        executeYugabyteSql(
          `SELECT work_reference.* FROM public.work_references work_reference
           WHERE work_reference.scan_id = $1 ORDER BY work_reference.created_at DESC`,
          [scanId],
          sessionEnv
        )
      ]);
      return json({
        wikiPages: wikiRes.rows,
        glossary: glossRes.rows,
        references: refRes.rows
      });
    }

    case 'academy': {
      const res = await executeYugabyteSql(
        `SELECT tutorial.* FROM public.scan_academy_tutorials tutorial
         WHERE tutorial.scan_id = $1 ORDER BY tutorial.display_order ASC`,
        [scanId],
        sessionEnv
      );
      return json({ tutorials: res.rows });
    }

    case 'activity': {
      const res = await executeYugabyteSql(
        `SELECT activity.*, jsonb_build_object('id', member.id, 'username', member.username,
           'display_name', member.display_name, 'avatar_id', member.avatar_id) AS members
         FROM public.scan_activity activity
         LEFT JOIN public.members member ON member.id = activity.user_id
         WHERE activity.scan_id = $1 ORDER BY activity.created_at DESC LIMIT 50`,
        [scanId],
        sessionEnv
      );
      return json({ activity: res.rows });
    }

    case 'staff_notes': {
      const res = await executeYugabyteSql(
        `SELECT note.id, note.scan_id, note.user_id, note.parent_id, note.body,
           note.is_pinned, note.created_at, note.updated_at,
           jsonb_build_object('id', member.id, 'username', member.username,
             'display_name', member.display_name, 'avatar_id', member.avatar_id,
             'avatar_frame_id', member.avatar_frame_id, 'name_color', member.name_color) AS members
         FROM public.scan_staff_notes note
         LEFT JOIN public.members member ON member.id = note.user_id
         WHERE note.scan_id = $1
         ORDER BY note.is_pinned DESC, note.created_at DESC`,
        [scanId],
        sessionEnv
      );
      const staffNotes = res.rows.map((n: any) => ({
        ...n,
        author: n.members || { username: 'desconhecido', display_name: 'Membro' },
        canDelete: n.user_id === locals.user!.id || isScanLeader || isGlobalEditor
      }));
      return json({ staffNotes });
    }

    case 'settings': {
      const [intRes, trRes, incRes] = await Promise.all([
        executeYugabyteSql(
          `SELECT integration.* FROM public.scan_integrations integration
           WHERE integration.scan_id = $1 ORDER BY integration.created_at DESC`,
          [scanId],
          sessionEnv
        ),
        executeYugabyteSql(
          `SELECT transfer_request.*,
             jsonb_build_object('id', sender.id, 'username', sender.username, 'display_name', sender.display_name) AS from_user,
             jsonb_build_object('id', receiver.id, 'username', receiver.username, 'display_name', receiver.display_name) AS to_user
           FROM public.scan_transfer_requests transfer_request
           LEFT JOIN public.members sender ON sender.id = transfer_request.from_user_id
           LEFT JOIN public.members receiver ON receiver.id = transfer_request.to_user_id
           WHERE transfer_request.scan_id = $1 ORDER BY transfer_request.created_at DESC`,
          [scanId],
          sessionEnv
        ),
        executeYugabyteSql(
          `SELECT transfer_request.*,
             jsonb_build_object('id', scan.id, 'name', scan.name, 'slug', scan.slug) AS scans,
             jsonb_build_object('id', sender.id, 'username', sender.username, 'display_name', sender.display_name) AS from_user
           FROM public.scan_transfer_requests transfer_request
           JOIN public.scans scan ON scan.id = transfer_request.scan_id
           LEFT JOIN public.members sender ON sender.id = transfer_request.from_user_id
           WHERE transfer_request.to_user_id = $1 AND transfer_request.status = 'PENDING'
           ORDER BY transfer_request.created_at DESC LIMIT 1`,
          [locals.user.id],
          sessionEnv
        )
      ]);
      return json({
        integrations: intRes.rows,
        transferRequests: trRes.rows,
        incomingTransfer: incRes.rows[0] || null
      });
    }

    case 'catalog_works': {
      const res = await withYugabyteLkg(
        'scan_catalog_works_top100',
        () =>
          executeYugabyteSql(
            `SELECT id, title, slug, cover_id FROM public.works
             WHERE published = true ORDER BY title LIMIT 100`,
            [],
            sessionEnv
          ),
        { rows: [], rowCount: 0 },
        300_000
      );
      return json({ catalogWorks: res.rows });
    }

    case 'team_invites': {
      const res = await executeYugabyteSql(
        `SELECT invite.* FROM public.scan_invites invite
         WHERE invite.scan_id = $1 AND invite.revoked = false
           AND invite.used_at IS NULL AND invite.expires_at > now()
         ORDER BY invite.created_at DESC`,
        [scanId],
        sessionEnv
      );
      return json({ invites: res.rows });
    }

    case 'obras_metadata': {
      const [projRes, catRes] = await Promise.all([
        executeYugabyteSql(
          `SELECT request.*,
                  jsonb_build_object(
                    'id', work.id,
                    'title', work.title,
                    'slug', work.slug,
                    'cover_id', work.cover_id
                  ) AS works
           FROM public.scan_project_requests request
           JOIN public.works work ON work.id = request.work_id
           WHERE request.scan_id = $1 ORDER BY request.created_at DESC`,
          [scanId],
          sessionEnv
        ),
        withYugabyteLkg(
          'scan_catalog_works_top100',
          () =>
            executeYugabyteSql(
              `SELECT id, title, slug, cover_id FROM public.works
               WHERE published = true ORDER BY title LIMIT 100`,
              [],
              sessionEnv
            ),
          { rows: [], rowCount: 0 },
          300_000
        )
      ]);
      return json({ projectRequests: projRes.rows, catalogWorks: catRes.rows });
    }

    case 'mural': {
      const [postsRes, commentsRes, reactionsRes, attachmentsRes] = await Promise.all([
        executeYugabyteSql(
          `SELECT post.*, jsonb_build_object('id', author.id, 'username', author.username,
             'display_name', author.display_name, 'avatar_id', author.avatar_id) AS author
           FROM public.scan_mural_posts post
           LEFT JOIN public.members author ON author.id = post.author_id
           WHERE post.scan_id = $1 ORDER BY post.is_pinned DESC, post.created_at DESC LIMIT 50`,
          [scanId],
          sessionEnv
        ),
        executeYugabyteSql(
          `SELECT comment.*, jsonb_build_object('id', author.id, 'username', author.username,
             'display_name', author.display_name, 'avatar_id', author.avatar_id) AS author
           FROM public.scan_mural_comments comment
           LEFT JOIN public.members author ON author.id = comment.author_id
           WHERE comment.scan_id = $1 ORDER BY comment.created_at ASC`,
          [scanId],
          sessionEnv
        ),
        executeYugabyteSql(
          `SELECT reaction.* FROM public.scan_mural_reactions reaction
           WHERE reaction.scan_id = $1`,
          [scanId],
          sessionEnv
        ),
        executeYugabyteSql(
          `SELECT attachment.* FROM public.scan_attachments attachment
           WHERE attachment.scan_id = $1 ORDER BY attachment.created_at ASC`,
          [scanId],
          sessionEnv
        )
      ]);
      return json({
        posts: postsRes.rows,
        comments: commentsRes.rows,
        reactions: reactionsRes.rows,
        attachments: attachmentsRes.rows
      });
    }

    case 'queue_metadata': {
      const [overridesRes, creditsRes] = await Promise.all([
        executeYugabyteSql(
          `SELECT override.* FROM public.scan_work_workflow_overrides override
           WHERE override.scan_id = $1`,
          [scanId],
          sessionEnv
        ),
        executeYugabyteSql(
          `SELECT credit.* FROM public.chapter_credit_snapshots credit
           WHERE credit.scan_id = $1 ORDER BY credit.role_order ASC`,
          [scanId],
          sessionEnv
        )
      ]);
      return json({
        workOverrides: overridesRes.rows,
        creditSnapshots: creditsRes.rows
      });
    }

    default:
      return json({ error: 'Unknown module' }, { status: 400 });
  }
  }, 4);
};
