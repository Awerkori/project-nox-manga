import { json } from '@sveltejs/kit';
import { executeYugabyteSql } from '$lib/server/yugabyte';
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

  // 1. Verify membership and role in this scan
  const memberRes = await executeYugabyteSql<{ role: string }>(
    `SELECT role FROM public.scan_members WHERE scan_id = $1 AND user_id = $2`,
    [scanId, locals.user.id],
    platform?.env
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
          platform?.env
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
          platform?.env
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
          platform?.env
        ),
        executeYugabyteSql(
          `SELECT question.* FROM public.scan_recruitment_questions question
           WHERE question.scan_id = $1 ORDER BY question.display_order ASC`,
          [scanId],
          platform?.env
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
          platform?.env
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
          platform?.env
        ),
        executeYugabyteSql(
          `SELECT glossary_entry.* FROM public.work_glossary_entries glossary_entry
           WHERE glossary_entry.scan_id = $1 ORDER BY glossary_entry.source_term ASC`,
          [scanId],
          platform?.env
        ),
        executeYugabyteSql(
          `SELECT work_reference.* FROM public.work_references work_reference
           WHERE work_reference.scan_id = $1 ORDER BY work_reference.created_at DESC`,
          [scanId],
          platform?.env
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
        platform?.env
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
        platform?.env
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
        platform?.env
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
          platform?.env
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
          platform?.env
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
          platform?.env
        )
      ]);
      return json({
        integrations: intRes.rows,
        transferRequests: trRes.rows,
        incomingTransfer: incRes.rows[0] || null
      });
    }

    case 'catalog_works': {
      const res = await executeYugabyteSql(
        `SELECT id, title, slug, cover_id FROM public.works
         WHERE published = true ORDER BY title LIMIT 100`,
        [],
        platform?.env
      );
      return json({ catalogWorks: res.rows });
    }

    default:
      return json({ error: 'Unknown module' }, { status: 400 });
  }
};
