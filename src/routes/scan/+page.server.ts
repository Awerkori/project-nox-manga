import { fail, redirect } from '@sveltejs/kit';
import { dispatchScanMentions } from '$lib/server/scan-mentions';
import { createScanNotification } from '$lib/server/scan-notifications';
import { processPendingEmailOutbox } from '$lib/server/notifications';
import { withTimeout } from '$lib/server/resilience';
import { executeYugabyteSql } from '$lib/server/yugabyte';
import type { PageServerLoad, Actions } from './$types';

type YsqlCollection<T = any> = { data: T[]; error: null };

/**
 * Scan workspace reads are served by the authoritative YSQL plane.  Keeping
 * this tiny adapter local to the route lets the existing view-model mapping
 * stay stable while making the data source explicit and typed.
 */
const ysqlCollection = async <T = any>(
  query: string,
  params: any[],
  platform: any,
  operation: string,
  timeoutMs = 5_000
): Promise<YsqlCollection<T>> => {
  const result = await withTimeout(
    executeYugabyteSql<T>(query, params, platform?.env),
    timeoutMs,
    { rows: [], rowCount: 0 },
    operation,
    'YUGABYTE'
  );
  return { data: result.rows, error: null };
};

export const load: PageServerLoad = async ({ locals, url, platform }: any) => {
  if (!locals.user) {
    return {
      authenticated: false,
      isMember: false,
      userId: null,
      myScans: [],
      currentScan: null,
      userRole: null,
      userPositions: [],
      works: [],
      chapters: [],
      team: [],
      totalViews: 0,
      invites: [],
      projectRequests: [],
      partnerRequests: [],
      catalogWorks: [],
      stages: [],
      chapterStages: [],
      tasks: [],
      wikiPages: [],
      glossary: [],
      references: [],
      integrations: [],
      workUploaders: [],
      recruitmentQuestions: [],
      channels: [],
      messages: [],
      channelReadStates: [],
      applicationAnswers: [],
      notifications: [],
      notificationPrefs: null,
      tutorials: [],
      qcIssues: [],
      productionChapters: [],
      pipelineTemplates: [],
      muralPosts: [],
      attachments: [],
      chapterNotes: []
    };
  }

  // Resolve workspace membership exclusively from the authoritative YSQL
  // plane.  Authentication still uses the existing identity provider, but
  // Scan data never falls back to a second database on a degraded request.
  const memberRowsYsql = await withTimeout(
    executeYugabyteSql<any>(`
      SELECT scan_member.role, scan_member.scan_id, to_jsonb(scan) AS scans
      FROM public.scan_members scan_member
      JOIN public.scans scan ON scan.id = scan_member.scan_id
      WHERE scan_member.user_id = $1
      ORDER BY scan.is_official DESC, scan.name ASC
    `, [locals.user.id], platform?.env),
    2000,
    null,
    'scan_member_rows_ysql',
    'YUGABYTE'
  );

  const memberRows = memberRowsYsql?.rows?.map((row: any) => ({
    role: row.role,
    scan_id: row.scan_id,
    scans: row.scans
  })) || [];

  if (!memberRows || memberRows.length === 0) {
    const [partnerRequestsRes, incomingTransferRes] = await Promise.all([
      ysqlCollection<any>(
        `SELECT request.* FROM public.scan_partner_requests request
         WHERE request.user_id = $1 ORDER BY request.created_at DESC`,
        [locals.user.id], platform, 'scan_partner_requests_ysql'
      ),
      ysqlCollection<any>(
        `SELECT transfer_request.*,
           jsonb_build_object('id', scan.id, 'name', scan.name, 'slug', scan.slug) AS scans,
           jsonb_build_object('id', sender.id, 'username', sender.username, 'display_name', sender.display_name) AS from_user
         FROM public.scan_transfer_requests transfer_request
         JOIN public.scans scan ON scan.id = transfer_request.scan_id
         LEFT JOIN public.members sender ON sender.id = transfer_request.from_user_id
         WHERE transfer_request.to_user_id = $1 AND transfer_request.status = 'PENDING'
         ORDER BY transfer_request.created_at DESC LIMIT 1`,
        [locals.user.id], platform, 'scan_incoming_transfer_ysql'
      )
    ]);

    return {
      authenticated: true,
      isMember: false,
      userId: locals.user.id,
      myScans: [],
      partnerRequests: partnerRequestsRes.data || [],
      incomingTransfer: incomingTransferRes.data?.[0] || null,
      currentScan: null,
      userRole: null,
      userPositions: [],
      works: [],
      chapters: [],
      team: [],
      totalViews: 0,
      invites: [],
      projectRequests: [],
      transferRequests: [],
      catalogWorks: [],
      stages: [],
      chapterStages: [],
      tasks: [],
      wikiPages: [],
      glossary: [],
      references: [],
      integrations: [],
      workUploaders: [],
      recruitmentQuestions: [],
      channels: [],
      messages: [],
      channelReadStates: [],
      applicationAnswers: [],
      notifications: [],
      notificationPrefs: null,
      tutorials: [],
      qcIssues: [],
      productionChapters: [],
      pipelineTemplates: [],
      muralPosts: [],
      attachments: [],
      chapterNotes: []
    };
  }

  const myScans = memberRows.map((r: any) => ({
    role: r.role,
    ...r.scans
  }));

  const activeScanId = url.searchParams.get('id') || myScans[0].id;
  const currentScan = myScans.find((s: any) => s.id === activeScanId) || myScans[0];
  const isScanLeader = ['OWNER', 'ADMIN'].includes(currentScan.role);
  const isGlobalEditor = ['ADMIN', 'EDITOR', 'STAFF_SITE'].includes(locals.role || '');
  const canManageRecruitment = isScanLeader || isGlobalEditor;
  // This is intentionally narrower than management. The historical policy
  // exposes free-form candidate answers to scan leaders and global ADMIN only.
  const canReadAllApplicationAnswers = isScanLeader || locals.role === 'ADMIN';

  // Start the authoritative editorial graph immediately. It deliberately runs
  // beside the rest of the workspace batch: a member should not wait for
  // unrelated backoffice widgets before the pipeline can render.
  const pipelineSnapshotPromise = withTimeout(
    Promise.all([
      executeYugabyteSql<any>(`
        SELECT workflow_stage.*
        FROM public.scan_workflow_stages workflow_stage
        WHERE workflow_stage.scan_id = $1
        ORDER BY workflow_stage.display_order ASC
      `, [currentScan.id], platform?.env),
      executeYugabyteSql<any>(`
        SELECT chapter_stage.*,
          CASE WHEN workflow_stage.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', workflow_stage.id, 'name', workflow_stage.name, 'slug', workflow_stage.slug,
            'color', workflow_stage.color, 'display_order', workflow_stage.display_order,
            'dependencies', workflow_stage.dependencies,
            'dependency_operator', workflow_stage.dependency_operator,
            'requires_output', workflow_stage.requires_output
          ) END AS stage,
          CASE WHEN assignee.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', assignee.id, 'username', assignee.username,
            'display_name', assignee.display_name, 'avatar_id', assignee.avatar_id
          ) END AS assignee,
          CASE WHEN completer.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', completer.id, 'username', completer.username,
            'display_name', completer.display_name, 'avatar_id', completer.avatar_id
          ) END AS completer
        FROM public.scan_chapter_stages chapter_stage
        LEFT JOIN public.scan_workflow_stages workflow_stage ON workflow_stage.id = chapter_stage.stage_id
        LEFT JOIN public.members assignee ON assignee.id = chapter_stage.assigned_to
        LEFT JOIN public.members completer ON completer.id = chapter_stage.completed_by
        WHERE chapter_stage.scan_id = $1
        ORDER BY chapter_stage.created_at ASC
      `, [currentScan.id], platform?.env),
      executeYugabyteSql<any>(`
        SELECT production_chapter.*,
          CASE WHEN work.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', work.id, 'title', work.title, 'slug', work.slug, 'cover_id', work.cover_id
          ) END AS work
        FROM public.scan_production_chapters production_chapter
        LEFT JOIN public.works work ON work.id = production_chapter.work_id
        WHERE production_chapter.scan_id = $1
        ORDER BY production_chapter.chapter_sort_key ASC
      `, [currentScan.id], platform?.env),
      executeYugabyteSql<any>(`
        SELECT timeline.*
        FROM public.scan_chapter_timeline timeline
        WHERE timeline.scan_id = $1
        ORDER BY timeline.created_at DESC
        LIMIT 200
      `, [currentScan.id], platform?.env)
    ]),
    3_500,
    null,
    'scan_pipeline_snapshot_ysql'
  );

  // Chat is loaded by its dedicated endpoint when the Chat tab mounts. This
  // keeps every other workspace tab independent from the chat read model.
  const chatSnapshotPromise = Promise.resolve(null);
  /* const requestedTab = url.searchParams.get('tab');
  const legacyChatSnapshotPromise = requestedTab === 'chat' ? withTimeout(
    Promise.all([
      executeYugabyteSql<any>(`
        SELECT channel.*
        FROM public.scan_channels channel
        WHERE channel.scan_id = $1
        ORDER BY channel.display_order ASC
      `, [currentScan.id], platform?.env),
      executeYugabyteSql<any>(`
        WITH recent_messages AS (
          SELECT message.*
          FROM public.scan_messages message
          WHERE message.scan_id = $1
          ORDER BY message.created_at DESC
          LIMIT 150
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
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', reaction.id, 'emoji', reaction.emoji, 'user_id', reaction.user_id
            ) ORDER BY reaction.created_at ASC)
            FROM public.scan_message_reactions reaction
            WHERE reaction.message_id = message.id
          ), '[]'::jsonb) AS reactions
        FROM recent_messages message
        LEFT JOIN public.members author ON author.id = message.user_id
        LEFT JOIN public.scan_messages reply ON reply.id = message.reply_to_id
        LEFT JOIN public.members reply_author ON reply_author.id = reply.user_id
        ORDER BY message.created_at ASC
      `, [currentScan.id], platform?.env),
      executeYugabyteSql<any>(`
        SELECT read_state.*
        FROM public.scan_channel_read_states_ysql read_state
        WHERE read_state.scan_id = $1 AND read_state.user_id = $2
      `, [currentScan.id, locals.user.id], platform?.env)
    ]),
    3_500,
    null,
    'scan_chat_snapshot_ysql'
  ) : Promise.resolve(null); */

  // The recruitment board contains both public vacancy data and private
  // candidate answers. Fetch it directly from YSQL, but carry the legacy RLS
  // visibility rules into the query: ordinary members can inspect scan
  // applications, while only the applicant, a scan leader, or global ADMIN
  // receives the answer text.
  const recruitmentSnapshotPromise = withTimeout(
    Promise.all([
      executeYugabyteSql<any>(`
        SELECT position.*
        FROM public.scan_positions position
        WHERE position.scan_id = $1
          AND (position.is_active = true OR $2::boolean)
        ORDER BY position.display_order ASC
      `, [currentScan.id, canManageRecruitment], platform?.env),
      executeYugabyteSql<any>(`
        SELECT opening.*,
          CASE WHEN position.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', position.id, 'name', position.name, 'description', position.description,
            'icon', position.icon, 'display_order', position.display_order
          ) END AS scan_positions
        FROM public.scan_recruitment_openings opening
        LEFT JOIN public.scan_positions position ON position.id = opening.position_id
        WHERE opening.scan_id = $1
          AND (opening.status = 'OPEN' OR $2::boolean)
        ORDER BY opening.created_at DESC
      `, [currentScan.id, canManageRecruitment], platform?.env),
      executeYugabyteSql<any>(`
        SELECT application.*,
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
        WHERE application.scan_id = $1
        ORDER BY application.created_at DESC
      `, [currentScan.id], platform?.env),
      executeYugabyteSql<any>(`
        SELECT question.*
        FROM public.scan_recruitment_questions question
        WHERE question.scan_id = $1
        ORDER BY question.display_order ASC
      `, [currentScan.id], platform?.env),
      executeYugabyteSql<any>(`
        SELECT answer.*,
          CASE WHEN question.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', question.id, 'question', question.question,
            'question_type', question.question_type, 'display_order', question.display_order
          ) END AS question
        FROM public.scan_application_answers answer
        JOIN public.scan_applications application ON application.id = answer.application_id
        LEFT JOIN public.scan_recruitment_questions question ON question.id = answer.question_id
        WHERE application.scan_id = $1
          AND ($2::boolean OR application.user_id = $3)
        ORDER BY answer.created_at ASC
      `, [currentScan.id, canReadAllApplicationAnswers, locals.user.id], platform?.env)
    ]),
    3_500,
    null,
    'scan_recruitment_snapshot_ysql'
  );

  // Knowledge is a read-heavy workspace surface. Keep all three collections
  // on the YSQL data plane and fail closed to empty state on a transient error.
  const knowledgeSnapshotPromise = withTimeout(
    Promise.all([
      executeYugabyteSql<any>(`
        SELECT wiki_page.*
        FROM public.scan_wiki_pages wiki_page
        WHERE wiki_page.scan_id = $1
        ORDER BY wiki_page.is_pinned DESC, wiki_page.title ASC
      `, [currentScan.id], platform?.env),
      executeYugabyteSql<any>(`
        SELECT glossary_entry.*
        FROM public.work_glossary_entries glossary_entry
        WHERE glossary_entry.scan_id = $1
        ORDER BY glossary_entry.source_term ASC
      `, [currentScan.id], platform?.env),
      executeYugabyteSql<any>(`
        SELECT work_reference.*
        FROM public.work_references work_reference
        WHERE work_reference.scan_id = $1
        ORDER BY work_reference.created_at DESC
      `, [currentScan.id], platform?.env)
    ]),
    3_500,
    null,
    'scan_knowledge_snapshot_ysql'
  );

  // Task transitions already run through YSQL transactions. Keep the queue
  // itself on that same data plane, including its historical comments, so a
  // refresh cannot combine an authoritative claim with a stale task list.
  const taskSnapshotPromise = withTimeout(
    executeYugabyteSql<any>(`
      SELECT task.*,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', comment.id,
            'task_id', comment.task_id,
            'content', comment.content,
            'created_at', comment.created_at,
            'members', CASE WHEN author.id IS NULL THEN NULL ELSE jsonb_build_object(
              'id', author.id,
              'username', author.username,
              'display_name', author.display_name,
              'avatar_id', author.avatar_id
            ) END
          ) ORDER BY comment.created_at ASC)
          FROM public.scan_task_comments comment
          LEFT JOIN public.members author ON author.id = comment.user_id
          WHERE comment.task_id = task.id
        ), '[]'::jsonb) AS scan_task_comments
      FROM public.scan_tasks task
      WHERE task.scan_id = $1
      ORDER BY task.created_at DESC
    `, [currentScan.id], platform?.env),
    3_500,
    null,
    'scan_task_snapshot_ysql'
  );

  // Personal inbox reads stay on the same authoritative data plane as task
  // transitions. Both queries are scoped to the authenticated Scan member.
  const notificationSnapshotPromise = withTimeout(
    Promise.all([
      executeYugabyteSql<any>(`
        SELECT notification.*
        FROM public.scan_notifications notification
        WHERE notification.scan_id = $1 AND notification.user_id = $2
        ORDER BY notification.created_at DESC
        LIMIT 50
      `, [currentScan.id, locals.user.id], platform?.env),
      executeYugabyteSql<any>(`
        SELECT preference.*
        FROM public.scan_notification_preferences preference
        WHERE preference.scan_id = $1 AND preference.user_id = $2
        LIMIT 1
      `, [currentScan.id, locals.user.id], platform?.env)
    ]),
    3_500,
    null,
    'scan_notification_snapshot_ysql'
  );

  const emptyScanBatchFallback = Array.from({ length: 42 }, () => ({ data: [] }));
  const [
    worksRes,
    chaptersRes,
    teamRes,
    invitesRes,
    projectRequestsRes,
    catalogWorksRes,
    transferRequestsRes,
    incomingTransferRes,
    ,
    ,
    ,
    activityRes,
    memberPositionsRes,
    staffNotesRes,
    ,
    ,
    ,
    ,
    ,
    ,
    integrationsRes,
    uploadersRes,
    ,
    ,
    ,
    ,
    ,
    tutorialsRes,
    qcIssuesRes,
    ,
    pipelineTemplatesRes,
    muralPostsRes,
    muralCommentsRes,
    muralReactionsRes,
    attachmentsRes,
    productionFilesRes,
    ,
    workOverridesRes,
    creditSnapshotsRes,
    ,
    ,
    seenStagesRes
  ] = await withTimeout(
    Promise.all([
    ysqlCollection<any>(
      `SELECT work_scan.is_primary, work_scan.status, work_scan.created_at,
         to_jsonb(work) AS works
       FROM public.work_scans work_scan
       JOIN public.works work ON work.id = work_scan.work_id
       WHERE work_scan.scan_id = $1`,
      [currentScan.id], platform, 'scan_work_scans_ysql'
    ),
    ysqlCollection<any>(
      `SELECT chapter_scan.created_at,
         jsonb_build_object('id', chapter.id, 'number', chapter.number,
           'title', chapter.title, 'published_at', chapter.published_at,
           'views_total', chapter.views_total,
           'works', jsonb_build_object('id', work.id, 'title', work.title, 'slug', work.slug)) AS chapters
       FROM public.chapter_scans chapter_scan
       JOIN public.chapters chapter ON chapter.id = chapter_scan.chapter_id
       JOIN public.works work ON work.id = chapter.work_id
       WHERE chapter_scan.scan_id = $1
       ORDER BY chapter_scan.created_at DESC LIMIT 20`,
      [currentScan.id], platform, 'scan_chapter_scans_ysql'
    ),
    ysqlCollection<any>(
      `SELECT scan_member.user_id, scan_member.role, scan_member.is_public,
         scan_member.hidden_by_admin, scan_member.availability_status,
         scan_member.availability_message, scan_member.availability_updated_at,
         scan_member.created_at, to_jsonb(member) AS members
       FROM public.scan_members scan_member
       JOIN public.members member ON member.id = scan_member.user_id
       WHERE scan_member.scan_id = $1`,
      [currentScan.id], platform, 'scan_team_ysql'
    ),
    ysqlCollection<any>(
      `SELECT invite.* FROM public.scan_invites invite
       WHERE invite.scan_id = $1 AND invite.revoked = false
         AND invite.used_at IS NULL AND invite.expires_at > now()
       ORDER BY invite.created_at DESC`,
      [currentScan.id], platform, 'scan_invites_ysql'
    ),
    ysqlCollection<any>(
      `SELECT request.*, to_jsonb(work) AS works
       FROM public.scan_project_requests request
       JOIN public.works work ON work.id = request.work_id
       WHERE request.scan_id = $1 ORDER BY request.created_at DESC`,
      [currentScan.id], platform, 'scan_project_requests_ysql'
    ),
    ysqlCollection<any>(
      `SELECT id, title, slug, cover_id FROM public.works
       WHERE published = true ORDER BY title LIMIT 100`,
      [], platform, 'scan_catalog_works_ysql'
    ),
    ysqlCollection<any>(
      `SELECT transfer_request.*,
         jsonb_build_object('id', sender.id, 'username', sender.username, 'display_name', sender.display_name) AS from_user,
         jsonb_build_object('id', receiver.id, 'username', receiver.username, 'display_name', receiver.display_name) AS to_user
       FROM public.scan_transfer_requests transfer_request
       LEFT JOIN public.members sender ON sender.id = transfer_request.from_user_id
       LEFT JOIN public.members receiver ON receiver.id = transfer_request.to_user_id
       WHERE transfer_request.scan_id = $1 ORDER BY transfer_request.created_at DESC`,
      [currentScan.id], platform, 'scan_transfer_requests_ysql'
    ),
    ysqlCollection<any>(
      `SELECT transfer_request.*,
         jsonb_build_object('id', scan.id, 'name', scan.name, 'slug', scan.slug) AS scans,
         jsonb_build_object('id', sender.id, 'username', sender.username, 'display_name', sender.display_name) AS from_user
       FROM public.scan_transfer_requests transfer_request
       JOIN public.scans scan ON scan.id = transfer_request.scan_id
       LEFT JOIN public.members sender ON sender.id = transfer_request.from_user_id
       WHERE transfer_request.to_user_id = $1 AND transfer_request.status = 'PENDING'
       ORDER BY transfer_request.created_at DESC LIMIT 1`,
      [locals.user.id], platform, 'scan_incoming_transfer_ysql'
    ),
    // Recruitment is loaded from the YSQL snapshot below. Keep its legacy
    // reads out of the healthy request path.
    Promise.resolve({ data: [] }),
    Promise.resolve({ data: [] }),
    Promise.resolve({ data: [] }),
    ysqlCollection<any>(
      `SELECT activity.*, jsonb_build_object('id', member.id, 'username', member.username,
         'display_name', member.display_name, 'avatar_id', member.avatar_id) AS members
       FROM public.scan_activity activity
       LEFT JOIN public.members member ON member.id = activity.user_id
       WHERE activity.scan_id = $1 ORDER BY activity.created_at DESC LIMIT 50`,
      [currentScan.id], platform, 'scan_activity_ysql'
    ),
    ysqlCollection<any>(
      `SELECT member_position.user_id, member_position.position_id,
         member_position.is_primary, member_position.is_public, member_position.hidden_by_admin,
         jsonb_build_object('id', position.id, 'name', position.name,
           'description', position.description, 'icon', position.icon,
           'display_order', position.display_order) AS scan_positions
       FROM public.scan_member_positions member_position
       JOIN public.scan_positions position ON position.id = member_position.position_id
       WHERE member_position.scan_id = $1`,
      [currentScan.id], platform, 'scan_member_positions_ysql'
    ),
    ysqlCollection<any>(
      `SELECT note.id, note.scan_id, note.user_id, note.parent_id, note.body,
         note.is_pinned, note.created_at, note.updated_at,
         jsonb_build_object('id', member.id, 'username', member.username,
           'display_name', member.display_name, 'avatar_id', member.avatar_id,
           'avatar_frame_id', member.avatar_frame_id, 'name_color', member.name_color) AS members
       FROM public.scan_staff_notes note
       LEFT JOIN public.members member ON member.id = note.user_id
       WHERE note.scan_id = $1
       ORDER BY note.is_pinned DESC, note.created_at DESC`,
      [currentScan.id], platform, 'scan_staff_notes_ysql'
    ),
    Promise.resolve({ data: [] }),
    Promise.resolve({ data: [] }),
    // Task reads are served by the YSQL snapshot above. This placeholder
    // preserves the batch's index layout for the incremental migration.
    Promise.resolve({ data: [] }),
    // YSQL knowledge snapshot is started above. These placeholders preserve
    // the batch shape while that snapshot resolves.
    Promise.resolve({ data: [] }),
    Promise.resolve({ data: [] }),
    Promise.resolve({ data: [] }),
    ysqlCollection<any>(
      `SELECT integration.* FROM public.scan_integrations integration
       WHERE integration.scan_id = $1 ORDER BY integration.created_at DESC`,
      [currentScan.id], platform, 'scan_integrations_ysql'
    ),
    ysqlCollection<any>(
      `SELECT uploader.*,
         jsonb_build_object('id', member.id, 'username', member.username, 'display_name', member.display_name) AS members,
         jsonb_build_object('id', work.id, 'title', work.title) AS works
       FROM public.scan_work_uploaders uploader
       LEFT JOIN public.members member ON member.id = uploader.user_id
       LEFT JOIN public.works work ON work.id = uploader.work_id
       WHERE uploader.scan_id = $1`,
      [currentScan.id], platform, 'scan_work_uploaders_ysql'
    ),
    Promise.resolve({ data: [] }),
    // YSQL chat snapshot is started above. These placeholders preserve the
    // batch shape while that snapshot resolves.
    Promise.resolve({ data: [] }),
    Promise.resolve({ data: [] }),
    // Personal inbox reads are served by the YSQL snapshot above. These
    // placeholders preserve the existing batch index during the migration.
    Promise.resolve({ data: [] }),
    Promise.resolve({ data: null }),
    ysqlCollection<any>(
      `SELECT tutorial.* FROM public.scan_academy_tutorials tutorial
       WHERE tutorial.scan_id = $1 ORDER BY tutorial.display_order ASC`,
      [currentScan.id], platform, 'scan_tutorials_ysql'
    ),
    ysqlCollection<any>(
      `SELECT issue.*,
         jsonb_build_object('id', assignee.id, 'username', assignee.username,
           'display_name', assignee.display_name, 'avatar_id', assignee.avatar_id) AS assignee,
         jsonb_build_object('id', creator.id, 'username', creator.username,
           'display_name', creator.display_name) AS creator
       FROM public.scan_chapter_qc_issues issue
       LEFT JOIN public.members assignee ON assignee.id = issue.assigned_to
       LEFT JOIN public.members creator ON creator.id = issue.created_by
       WHERE issue.scan_id = $1 ORDER BY issue.created_at DESC`,
      [currentScan.id], platform, 'scan_qc_issues_ysql'
    ),
    Promise.resolve({ data: [] }),
    ysqlCollection<any>(
      `SELECT template.* FROM public.scan_pipeline_templates template`,
      [], platform, 'scan_pipeline_templates_ysql'
    ),
    ysqlCollection<any>(
      `SELECT post.*, jsonb_build_object('id', author.id, 'username', author.username,
         'display_name', author.display_name, 'avatar_id', author.avatar_id) AS author
       FROM public.scan_mural_posts post
       LEFT JOIN public.members author ON author.id = post.author_id
       WHERE post.scan_id = $1 ORDER BY post.is_pinned DESC, post.created_at DESC`,
      [currentScan.id], platform, 'scan_mural_posts_ysql'
    ),
    ysqlCollection<any>(
      `SELECT comment.*, jsonb_build_object('id', author.id, 'username', author.username,
         'display_name', author.display_name, 'avatar_id', author.avatar_id) AS author
       FROM public.scan_mural_comments comment
       LEFT JOIN public.members author ON author.id = comment.author_id
       WHERE comment.scan_id = $1 ORDER BY comment.created_at ASC`,
      [currentScan.id], platform, 'scan_mural_comments_ysql'
    ),
    ysqlCollection<any>(
      `SELECT reaction.* FROM public.scan_mural_reactions reaction
       WHERE reaction.scan_id = $1`,
      [currentScan.id], platform, 'scan_mural_reactions_ysql'
    ),
    ysqlCollection<any>(
      `SELECT attachment.* FROM public.scan_attachments attachment
       WHERE attachment.scan_id = $1 ORDER BY attachment.created_at ASC`,
      [currentScan.id], platform, 'scan_attachments_ysql'
    ),
    // Production files are loaded by the dedicated YSQL query immediately
    // below; keep this slot for the historical batch shape only.
    Promise.resolve({ data: [] }),
    Promise.resolve({ data: [] }),
    ysqlCollection<any>(
      `SELECT override.* FROM public.scan_work_workflow_overrides override
       WHERE override.scan_id = $1`,
      [currentScan.id], platform, 'scan_workflow_overrides_ysql'
    ),
    ysqlCollection<any>(
      `SELECT credit.* FROM public.chapter_credit_snapshots credit
       WHERE credit.scan_id = $1 ORDER BY credit.role_order ASC`,
      [currentScan.id], platform, 'scan_credit_snapshots_ysql'
    ),
    Promise.resolve({ data: [] }),
    Promise.resolve({ data: [] }),
    ysqlCollection<any>(
      `SELECT seen.chapter_stage_id, seen.availability_version, seen.seen_at
       FROM public.scan_pipeline_stage_seen seen
       WHERE seen.scan_id = $1 AND seen.user_id = $2`,
      [currentScan.id, locals.user.id], platform, 'scan_pipeline_seen_ysql'
    )
    ]),
    5000,
    emptyScanBatchFallback as any,
    'scan_dashboard_batch'
  );

  const memberPosMap = new Map<string, any[]>();
  for (const mp of (memberPositionsRes.data || [])) {
    if (!memberPosMap.has(mp.user_id)) memberPosMap.set(mp.user_id, []);
    memberPosMap.get(mp.user_id)!.push({
      position_id: mp.position_id,
      name: mp.scan_positions?.name,
      description: mp.scan_positions?.description,
      icon: mp.scan_positions?.icon,
      is_primary: mp.is_primary,
      is_public: mp.is_public ?? true,
      hidden_by_admin: mp.hidden_by_admin ?? false
    });
  }

  const works = (worksRes.data || []).map((r: any) => ({
    ...r.works,
    project_status: r.status || 'ACTIVE',
    is_primary: r.is_primary
  })).filter(Boolean);
  const chapters = (chaptersRes.data || []).map((r: any) => r.chapters).filter(Boolean);
  const team = (teamRes.data || []).map((r: any) => ({
    role: r.role,
    is_public: r.is_public ?? true,
    hidden_by_admin: r.hidden_by_admin ?? false,
    availability_status: r.availability_status || 'ACTIVE',
    availability_message: r.availability_message || '',
    availability_updated_at: r.availability_updated_at || null,
    created_at: r.created_at,
    ...r.members,
    positions: memberPosMap.get(r.members.id) || []
  }));
  const invites = invitesRes.data || [];
  const projectRequests = projectRequestsRes.data || [];
  const catalogWorks = catalogWorksRes.data || [];
  const transferRequests = transferRequestsRes.data || [];
  const incomingTransfer = incomingTransferRes.data || null;
  let positions: any[];
  let recruitmentOpenings: any[];
  let applications: any[];
  let recruitmentQuestions: any[];
  let applicationAnswers: any[];
  const recruitmentSnapshot = await recruitmentSnapshotPromise;
  if (recruitmentSnapshot) {
    const [positionsResult, openingsResult, applicationsResult, questionsResult, answersResult] = recruitmentSnapshot;
    positions = positionsResult.rows;
    recruitmentOpenings = openingsResult.rows;
    applications = applicationsResult.rows;
    recruitmentQuestions = questionsResult.rows;
    applicationAnswers = answersResult.rows;
  } else {
    console.warn('scan_recruitment_snapshot_ysql_unavailable', {
      scanId: currentScan.id,
      message: 'ysql snapshot unavailable'
    });
    positions = [];
    recruitmentOpenings = [];
    applications = [];
    recruitmentQuestions = [];
    applicationAnswers = [];
  }

  const openings = recruitmentOpenings.map((op: any) => {
    const apps = applications.filter((a: any) => a.opening_id === op.id);
    return {
      ...op,
      applications_count: apps.length,
      pending_count: apps.filter((a: any) => ['PENDING', 'UNDER_REVIEW'].includes(a.status)).length
    };
  });
  const activity = activityRes.data || [];

  let notifications: any[];
  let notificationPrefs: any;
  const notificationSnapshot = await notificationSnapshotPromise;
  if (notificationSnapshot) {
    const [notificationsResult, preferencesResult] = notificationSnapshot;
    notifications = notificationsResult.rows;
    notificationPrefs = preferencesResult.rows[0] || null;
  } else {
    console.warn('scan_notification_snapshot_ysql_unavailable', {
      scanId: currentScan.id,
      userId: locals.user.id,
      message: 'ysql snapshot unavailable'
    });
    notifications = [];
    notificationPrefs = null;
  }

  let tasks: any[];
  const taskSnapshot = await taskSnapshotPromise;
  if (taskSnapshot) {
    tasks = taskSnapshot.rows;
  } else {
    console.warn('scan_task_snapshot_ysql_unavailable', {
      scanId: currentScan.id,
      message: 'ysql snapshot unavailable'
    });
    tasks = [];
  }

  let wikiPages: any[];
  let glossary: any[];
  let references: any[];
  const knowledgeSnapshot = await knowledgeSnapshotPromise;
  if (knowledgeSnapshot) {
    const [wikiResult, glossaryResult, referencesResult] = knowledgeSnapshot;
    wikiPages = wikiResult.rows;
    glossary = glossaryResult.rows;
    references = referencesResult.rows;
  } else {
    console.warn('scan_knowledge_snapshot_ysql_unavailable', {
      scanId: currentScan.id,
      message: 'ysql snapshot unavailable'
    });
    wikiPages = [];
    glossary = [];
    references = [];
  }

  const staffNotes = (staffNotesRes.data || []).map((n: any) => ({
    id: n.id,
    scan_id: n.scan_id,
    user_id: n.user_id,
    parent_id: n.parent_id,
    body: n.body,
    is_pinned: !!n.is_pinned,
    created_at: n.created_at,
    updated_at: n.updated_at,
    author: n.members || { username: 'desconhecido', display_name: 'Membro' },
    canDelete: n.user_id === locals.user.id || isScanLeader || isGlobalEditor
  }));

  const totalViews = works.reduce((sum: number, w: any) => sum + Number(w.views_total || 0), 0);

  const postCommentsMap = new Map<string, any[]>();
  for (const c of (muralCommentsRes.data || [])) {
    if (!postCommentsMap.has(c.post_id)) postCommentsMap.set(c.post_id, []);
    postCommentsMap.get(c.post_id)!.push(c);
  }

  const postReactionsMap = new Map<string, any[]>();
  for (const r of (muralReactionsRes.data || [])) {
    if (r.post_id) {
      if (!postReactionsMap.has(r.post_id)) postReactionsMap.set(r.post_id, []);
      postReactionsMap.get(r.post_id)!.push(r);
    }
  }

  const postAttachmentsMap = new Map<string, any[]>();
  for (const a of (attachmentsRes.data || [])) {
    if (a.context_type === 'MURAL_POST') {
      if (!postAttachmentsMap.has(a.context_id)) postAttachmentsMap.set(a.context_id, []);
      postAttachmentsMap.get(a.context_id)!.push(a);
    }
  }

  const muralPosts = (muralPostsRes.data || []).map((p: any) => {
    const comments = postCommentsMap.get(p.id) || [];
    const reactions = postReactionsMap.get(p.id) || [];
    const attachments = postAttachmentsMap.get(p.id) || [];
    return {
      ...p,
      comments,
      scan_mural_comments: comments,
      reactions,
      scan_mural_reactions: reactions,
      attachments,
      scan_attachments: attachments
    };
  });

  // Pipeline delivery state is authoritative in Yugabyte/YSQL. Keep the rest
  // of this incremental Scan workspace migration intact while ensuring a new
  // multi-file upload is visible immediately after invalidation.
  let productionFiles = productionFilesRes.data || [];
  try {
    const ysqlFiles = await withTimeout(
      executeYugabyteSql<any>(`
        SELECT file.*,
          jsonb_build_object('id', member.id, 'username', member.username,
            'display_name', member.display_name, 'avatar_id', member.avatar_id) AS uploader,
          jsonb_build_object('id', stage.id, 'name', stage.name, 'slug', stage.slug) AS stage
        FROM public.scan_production_files file
        LEFT JOIN public.members member ON member.id = file.uploaded_by
        LEFT JOIN public.scan_workflow_stages stage ON stage.id = file.stage_id
        WHERE file.scan_id = $1
        ORDER BY file.version DESC, file.created_at DESC
      `, [currentScan.id], platform?.env),
      2_000,
      { rows: [], rowCount: 0 },
      'scan_pipeline_files_ysql'
    );
    productionFiles = ysqlFiles.rows;
  } catch (error: any) {
    console.warn('scan_pipeline_files_ysql_unavailable', { message: String(error?.message || 'unknown').slice(0, 240) });
  }

  // The workflow graph is the other half of a production delivery. YSQL is
  // the only data plane used by this workspace.
  let workflowStages: any[];
  let chapterStages: any[];
  let productionChapters: any[];
  let chapterTimeline: any[];
  const pipelineSnapshot = await pipelineSnapshotPromise;
  if (pipelineSnapshot) {
    const [workflowResult, chapterStageResult, productionChapterResult, timelineResult] = pipelineSnapshot;
    workflowStages = workflowResult.rows;
    chapterStages = chapterStageResult.rows;
    productionChapters = productionChapterResult.rows;
    chapterTimeline = timelineResult.rows;
  } else {
    console.warn('scan_pipeline_snapshot_ysql_unavailable', {
      scanId: currentScan.id,
      message: 'ysql snapshot unavailable'
    });
    workflowStages = [];
    chapterStages = [];
    productionChapters = [];
    chapterTimeline = [];
  }

  // Notes are a separate, editable collaboration stream read from the
  // authoritative YSQL data plane.
  let chapterNotes: any[] = [];
  try {
    const ysqlNotes = await withTimeout(
      executeYugabyteSql<any>(`
        SELECT note.*,
          jsonb_build_object(
            'id', author.id, 'username', author.username,
            'display_name', author.display_name, 'avatar_id', author.avatar_id
          ) AS author,
          CASE WHEN workflow_stage.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', workflow_stage.id, 'name', workflow_stage.name, 'slug', workflow_stage.slug
          ) END AS stage
        FROM public.scan_chapter_notes note
        JOIN public.members author ON author.id = note.author_id
        LEFT JOIN public.scan_workflow_stages workflow_stage ON workflow_stage.id = note.stage_id
        WHERE note.scan_id = $1 AND note.deleted_at IS NULL
        ORDER BY note.is_pinned DESC, note.created_at ASC
      `, [currentScan.id], platform?.env),
      2_000,
      { rows: [], rowCount: 0 },
      'scan_chapter_notes_ysql'
    );
    chapterNotes = ysqlNotes.rows.map((note: any) => ({
      ...note,
      canEdit: note.author_id === locals.user!.id || isScanLeader || isGlobalEditor,
      canDelete: note.author_id === locals.user!.id || isScanLeader || isGlobalEditor,
      canPin: isScanLeader || isGlobalEditor
    }));
  } catch (error: any) {
    console.warn('scan_chapter_notes_ysql_unavailable', {
      scanId: currentScan.id,
      message: String(error?.message || 'unknown').slice(0, 240)
    });
  }

  // Keep channels, messages and read markers from one authoritative data plane.
  let chatChannels: any[];
  let chatMessages: any[];
  let channelReadStates: any[];
  const chatSnapshot = await chatSnapshotPromise;
  if (chatSnapshot) {
    const [channelsResult, messagesResult, readStatesResult] = chatSnapshot;
    chatChannels = channelsResult.rows;
    chatMessages = messagesResult.rows;
    channelReadStates = readStatesResult.rows;
  } else {
    console.warn('scan_chat_snapshot_ysql_unavailable', {
      scanId: currentScan.id,
      message: 'ysql snapshot unavailable'
    });
    chatChannels = [];
    chatMessages = [];
    channelReadStates = [];
  }

  return {
    authenticated: true,
    isMember: true,
    userId: locals.user.id,
    myScans,
    currentScan,
    userRole: currentScan.role,
    userPositions: memberPosMap.get(locals.user.id) || [],
    works,
    chapters,
    team,
    totalViews,
    invites,
    projectRequests,
    transferRequests,
    incomingTransfer,
    partnerRequests: [],
    catalogWorks,
    positions,
    openings,
    applications,
    activity,
    staffNotes,
    stages: workflowStages,
    chapterStages,
    tasks,
    wikiPages,
    glossary,
    references,
    integrations: integrationsRes.data || [],
    workUploaders: uploadersRes.data || [],
    recruitmentQuestions,
    channels: chatChannels,
    messages: chatMessages,
    channelReadStates,
    applicationAnswers,
    notifications,
    notificationPrefs,
    tutorials: tutorialsRes.data || [],
    qcIssues: qcIssuesRes.data || [],
    productionChapters,
    pipelineTemplates: pipelineTemplatesRes.data || [],
    muralPosts,
    attachments: attachmentsRes.data || [],
    productionFiles,
    chapterNotes,
    chapterTimeline,
    workOverrides: workOverridesRes.data || [],
    creditSnapshots: creditSnapshotsRes.data || [],
    seenStages: seenStagesRes.data || []
  };
};

export const actions: Actions = {
  updateProfile: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const description = (formData.get('description') as string)?.trim() || '';
    const discord = (formData.get('discord') as string)?.trim() || '';
    const website = (formData.get('website') as string)?.trim() || '';
    const rawPrep = (formData.get('display_preposition') as string)?.trim() || 'de';
    const displayPreposition = ['de', 'da', 'do'].includes(rawPrep) ? rawPrep : 'de';

    const memberResult = await executeYugabyteSql<{ role: string }>(
      'SELECT role FROM public.scan_members WHERE scan_id = $1 AND user_id = $2 LIMIT 1',
      [scanId, locals.user.id], platform?.env
    );
    const memberRow = memberResult.rows[0] || null;

    if (!memberRow || !['OWNER', 'ADMIN'].includes(memberRow.role)) {
      return fail(403, { message: 'Permissão negada. Apenas Líderes ou Administradores podem editar as informações da scan.' });
    }

    const result = await executeYugabyteSql(
      `UPDATE public.scans SET description = $2, discord = $3, website = $4,
         display_preposition = $5, updated_at = now()
       WHERE id = $1 AND ($6::text = 'ADMIN' OR EXISTS (
         SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $7 AND role IN ('OWNER', 'ADMIN')
       ))`,
      [scanId, description.slice(0, 2000), discord.slice(0, 255), website.slice(0, 255), displayPreposition, locals.role, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Permissão negada ou scan inexistente.' });
    return { success: true, profileUpdated: true };
  },

  updateScanBranding: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const name = (formData.get('name') as string)?.trim();
    const description = (formData.get('description') as string)?.trim() || '';
    const bio = (formData.get('bio') as string)?.trim() || '';
    const discord = (formData.get('discord') as string)?.trim() || '';
    const fluxer = (formData.get('fluxer') as string)?.trim() || '';
    const website = (formData.get('website') as string)?.trim() || '';
    const rawPrep = (formData.get('display_preposition') as string)?.trim() || 'de';
    const displayPreposition = ['de', 'da', 'do'].includes(rawPrep) ? rawPrep : 'de';
    const logoId = formData.get('logo_id') as string | null;
    const bannerId = formData.get('banner_id') as string | null;

    const memberResult = await executeYugabyteSql<{ role: string }>(
      'SELECT role FROM public.scan_members WHERE scan_id = $1 AND user_id = $2 LIMIT 1',
      [scanId, locals.user.id], platform?.env
    );
    const memberRow = memberResult.rows[0] || null;

    if (!memberRow || !['OWNER', 'ADMIN'].includes(memberRow.role)) {
      if (locals.role !== 'ADMIN') {
        return fail(403, { message: 'Apenas Líderes ou Administradores da scan podem editar o perfil e identidade visual.' });
      }
    }

    const result = await executeYugabyteSql(
      `UPDATE public.scans SET name = COALESCE(NULLIF($2, ''), name),
         description = $3, bio = $4, discord = $5, fluxer = $6, website = $7,
         display_preposition = $8,
         logo_id = CASE WHEN $9::boolean THEN NULLIF($10, '')::uuid ELSE logo_id END,
         banner_id = CASE WHEN $11::boolean THEN NULLIF($12, '')::uuid ELSE banner_id END,
         updated_at = now()
       WHERE id = $1 AND ($13::text = 'ADMIN' OR EXISTS (
         SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $14 AND role IN ('OWNER', 'ADMIN')
       ))`,
      [scanId, name?.slice(0, 100) || '', description.slice(0, 2000), bio.slice(0, 500), discord.slice(0, 255), fluxer.slice(0, 255), website.slice(0, 255), displayPreposition,
        logoId !== null && logoId !== undefined, logoId?.trim() || '', bannerId !== null && bannerId !== undefined, bannerId?.trim() || '', locals.role, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Permissão negada ou scan inexistente.' });
    return { success: true, brandingUpdated: true };
  },

  removeScanLogo: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;

    const memberResult = await executeYugabyteSql<{ role: string }>(
      'SELECT role FROM public.scan_members WHERE scan_id = $1 AND user_id = $2 LIMIT 1',
      [scanId, locals.user.id], platform?.env
    );
    const memberRow = memberResult.rows[0] || null;

    if (!memberRow || !['OWNER', 'ADMIN'].includes(memberRow.role)) {
      if (locals.role !== 'ADMIN') return fail(403, { message: 'Permissão negada.' });
    }

    const result = await executeYugabyteSql(
      `UPDATE public.scans SET logo_id = NULL, updated_at = now()
       WHERE id = $1 AND ($2::text = 'ADMIN' OR EXISTS (
         SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $3 AND role IN ('OWNER', 'ADMIN')
       ))`,
      [scanId, locals.role, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Permissão negada ou scan inexistente.' });
    return { success: true, logoRemoved: true };
  },

  removeScanBanner: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;

    const memberResult = await executeYugabyteSql<{ role: string }>(
      'SELECT role FROM public.scan_members WHERE scan_id = $1 AND user_id = $2 LIMIT 1',
      [scanId, locals.user.id], platform?.env
    );
    const memberRow = memberResult.rows[0] || null;

    if (!memberRow || !['OWNER', 'ADMIN'].includes(memberRow.role)) {
      if (locals.role !== 'ADMIN') return fail(403, { message: 'Permissão negada.' });
    }

    const result = await executeYugabyteSql(
      `UPDATE public.scans SET banner_id = NULL, updated_at = now()
       WHERE id = $1 AND ($2::text = 'ADMIN' OR EXISTS (
         SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $3 AND role IN ('OWNER', 'ADMIN')
       ))`,
      [scanId, locals.role, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Permissão negada ou scan inexistente.' });
    return { success: true, bannerRemoved: true };
  },

  claimTask: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const taskId = (formData.get('task_id') || formData.get('taskId')) as string;
    if (!taskId) return fail(400, { message: 'ID da tarefa ausente' });

    try {
      const result = await executeYugabyteSql<{ result: any }>(
        'SELECT public.claim_scan_task_ysql($1, $2, $3) AS result',
        [taskId, locals.user.id, locals.role === 'ADMIN'], platform?.env
      );
      return { success: true, taskClaimed: result.rows[0]?.result || true };
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      console.error('scan_task_claim_ysql_failed', { taskId, actorId: locals.user.id, message: detail.slice(0, 240) });
      const expected = /TASK_(NOT_FOUND|NOT_CLAIMABLE|ALREADY_CLAIMED|POSITION_REQUIRED|WORKFLOW_STAGE_NOT_FOUND)|SCAN_MEMBERSHIP_REQUIRED/.test(detail);
      return fail(expected ? 409 : 503, { message: expected ? 'A tarefa foi alterada ou você não pode assumi-la. Atualize a página.' : 'Não foi possível assumir a tarefa com segurança agora.' });
    }
  },

  releaseTask: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const taskId = formData.get('task_id') as string;
    const reason = (formData.get('reason') as string)?.trim() || null;
    if (!taskId) return fail(400, { message: 'ID da tarefa ausente' });

    try {
      const result = await executeYugabyteSql<{ result: any }>(
        'SELECT public.release_scan_task_ysql($1, $2, $3, $4) AS result',
        [taskId, locals.user.id, locals.role === 'ADMIN', reason], platform?.env
      );
      return { success: true, taskReleased: result.rows[0]?.result };
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      console.error('scan_task_release_ysql_failed', { taskId, actorId: locals.user.id, message: detail.slice(0, 240) });
      const expected = /TASK_(NOT_FOUND|NOT_RELEASABLE|RELEASE_FORBIDDEN)|SCAN_MEMBERSHIP_REQUIRED/.test(detail);
      return fail(expected ? 409 : 503, { message: expected ? 'A tarefa foi alterada ou você não pode devolvê-la. Atualize a página.' : 'Não foi possível devolver a tarefa com segurança agora.' });
    }
  },

  completeStage: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const taskId = formData.get('task_id') as string;
    const note = (formData.get('note') as string)?.trim() || null;
    const fileId = (formData.get('file_id') as string)?.trim() || null;
    if (!taskId) return fail(400, { message: 'ID da tarefa ausente' });

    try {
      const result = await executeYugabyteSql<{ result: any }>(
        'SELECT public.complete_scan_task_ysql($1, $2, $3, $4, $5) AS result',
        [taskId, locals.user.id, locals.role === 'ADMIN', note, fileId], platform?.env
      );
      return { success: true, stageCompleted: result.rows[0]?.result };
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      console.error('scan_task_completion_ysql_failed', { taskId, actorId: locals.user.id, message: detail.slice(0, 240) });
      const expected = /TASK_(NOT_FOUND|NOT_COMPLETABLE|COMPLETION_FORBIDDEN|WORKFLOW_STAGE_NOT_FOUND)|SCAN_MEMBERSHIP_REQUIRED/.test(detail);
      return fail(expected ? 409 : 503, { message: expected ? 'A tarefa foi alterada ou você não pode concluí-la. Atualize a página.' : 'Não foi possível concluir a tarefa com segurança agora.' });
    }
  },

  requestPartner: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanName = (formData.get('scan_name') as string)?.trim();
    const scanSlug = (formData.get('scan_slug') as string)?.trim();
    const description = (formData.get('description') as string)?.trim() || '';
    const discord = (formData.get('discord') as string)?.trim() || '';
    const fluxer = (formData.get('fluxer') as string)?.trim() || '';
    const website = (formData.get('website') as string)?.trim() || '';
    const sampleLinks = (formData.get('sample_links') as string)?.trim() || '';

    if (!scanName || !scanSlug) {
      return fail(400, { message: 'Nome da scan e slug são obrigatórios.' });
    }

    await executeYugabyteSql(
      `INSERT INTO public.scan_partner_requests
       (user_id, scan_name, scan_slug, description, discord, fluxer, website, sample_links)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [locals.user.id, scanName, scanSlug, description, discord, fluxer, website, sampleLinks], platform?.env
    );
    return { success: true, partnerRequested: true };
  },

  createInvite: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const role = (formData.get('role') as string) || 'MEMBER';
    const hours = parseInt(formData.get('hours') as string) || 24;

    try {
      const result = await executeYugabyteSql<{ result: any }>(
        `SELECT public.create_scan_invite_ysql($1, $2, $3, $4) AS result`,
        [scanId, locals.user.id, role, hours], platform?.env
      );
      return { success: true, createdInvite: result.rows[0]?.result };
    } catch (error: any) {
      return fail(403, { message: String(error?.message || 'Não foi possível criar o convite.').slice(0, 240) });
    }
  },

  revokeInvite: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const inviteId = formData.get('invite_id') as string;
    const scanId = formData.get('scan_id') as string;

    const memberResult = await executeYugabyteSql<{ role: string }>(
      'SELECT role FROM public.scan_members WHERE scan_id = $1 AND user_id = $2 LIMIT 1',
      [scanId, locals.user.id], platform?.env
    );
    const memberRow = memberResult.rows[0] || null;

    if (!memberRow || !['OWNER', 'ADMIN'].includes(memberRow.role)) {
      return fail(403, { message: 'Permissão negada para revogar convites.' });
    }

    const result = await executeYugabyteSql(
      `UPDATE public.scan_invites SET revoked = true
       WHERE id = $1 AND scan_id = $2`,
      [inviteId, scanId], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Convite não encontrado.' });
    return { success: true, revoked: true };
  },

  manageScanMember: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const targetUserId = formData.get('user_id') as string;
    const role = formData.get('role') as string | null;
    const positionIdsRaw = formData.get('position_ids') as string | null;
    const confirmLastManager = formData.get('confirm_last_manager') === 'true';

    let positionIds: string[] = [];
    if (positionIdsRaw) {
      try {
        positionIds = JSON.parse(positionIdsRaw);
      } catch {
        positionIds = positionIdsRaw.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    const roles = await executeYugabyteSql<{ actor_role: string; target_role: string }>(
      `SELECT actor.role AS actor_role, target.role AS target_role
       FROM public.scan_members actor
       LEFT JOIN public.scan_members target ON target.scan_id = actor.scan_id AND target.user_id = $2
       WHERE actor.scan_id = $1 AND actor.user_id = $3 LIMIT 1`,
      [scanId, targetUserId, locals.user.id], platform?.env
    );
    const actorRole = roles.rows[0]?.actor_role;
    const targetRole = roles.rows[0]?.target_role;
    const canManage = locals.role === 'ADMIN' || ['OWNER', 'ADMIN'].includes(actorRole || '');
    if (!canManage || !targetRole) return fail(403, { message: 'Membro inexistente ou sem permissão.' });
    if (role && role !== targetRole) {
      if (targetRole === 'OWNER' || role === 'OWNER' || (actorRole !== 'OWNER' && locals.role !== 'ADMIN')) {
        return fail(403, { message: 'A alteração de função exige o Dono da Scan.' });
      }
      if (targetRole === 'ADMIN' && role === 'MEMBER' && !confirmLastManager) {
        const managers = await executeYugabyteSql<{ count: number }>(
          `SELECT count(*)::int AS count FROM public.scan_members WHERE scan_id = $1 AND role = 'ADMIN'`,
          [scanId], platform?.env
        );
        if (Number(managers.rows[0]?.count || 0) <= 1) {
          return { success: false, requiresConfirmation: true, warning: 'Esta Scan ficará sem Gerentes. Deseja continuar?' };
        }
      }
      await executeYugabyteSql(
        `UPDATE public.scan_members SET role = $3 WHERE scan_id = $1 AND user_id = $2`,
        [scanId, targetUserId, role], platform?.env
      );
    }
    if (positionIdsRaw !== null) {
      await executeYugabyteSql(
        `DELETE FROM public.scan_member_positions WHERE scan_id = $1 AND user_id = $2
           AND NOT (position_id = ANY($3::uuid[]))`,
        [scanId, targetUserId, positionIds], platform?.env
      );
      if (positionIds.length) {
        await executeYugabyteSql(
          `INSERT INTO public.scan_member_positions (scan_id, user_id, position_id, is_primary)
           SELECT $1, $2, position_id, false FROM unnest($3::uuid[]) AS position_id
           ON CONFLICT (scan_id, user_id, position_id) DO NOTHING`,
          [scanId, targetUserId, positionIds], platform?.env
        );
      }
    }
    return { success: true, memberManaged: true };
  },

  updateMemberRole: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const targetUserId = formData.get('user_id') as string;
    const newRole = formData.get('role') as string;

    const result = await executeYugabyteSql(
      `UPDATE public.scan_members target SET role = $3
       WHERE target.scan_id = $1 AND target.user_id = $2 AND target.role <> 'OWNER'
         AND ($4::text = 'ADMIN' OR EXISTS (
           SELECT 1 FROM public.scan_members actor WHERE actor.scan_id = $1 AND actor.user_id = $5 AND actor.role = 'OWNER'
         ))`,
      [scanId, targetUserId, newRole, locals.role, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Membro inexistente ou sem permissão.' });
    return { success: true, memberUpdated: true };
  },

  removeMember: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const targetUserId = formData.get('user_id') as string;
    const resolution = formData.get('resolution') as string | null;

    const roles = await executeYugabyteSql<{ actor_role: string; target_role: string }>(
      `SELECT actor.role AS actor_role, target.role AS target_role
       FROM public.scan_members actor LEFT JOIN public.scan_members target
         ON target.scan_id = actor.scan_id AND target.user_id = $2
       WHERE actor.scan_id = $1 AND actor.user_id = $3 LIMIT 1`,
      [scanId, targetUserId, locals.user.id], platform?.env
    );
    const actorRole = roles.rows[0]?.actor_role;
    const targetRole = roles.rows[0]?.target_role;
    if (!targetRole || !['OWNER', 'ADMIN'].includes(actorRole || '') && locals.role !== 'ADMIN') return fail(403, { message: 'Membro inexistente ou sem permissão.' });
    if (targetRole === 'OWNER' || (actorRole === 'ADMIN' && targetRole === 'ADMIN')) return fail(403, { message: 'Este membro não pode ser removido por este fluxo.' });
    const activeTasks = await executeYugabyteSql<{ count: number }>(
      `SELECT count(*)::int AS count FROM public.scan_chapter_stages
       WHERE scan_id = $1 AND assigned_to = $2 AND status IN ('IN_PROGRESS','REWORK')`,
      [scanId, targetUserId], platform?.env
    );
    const activeCount = Number(activeTasks.rows[0]?.count || 0);
    if (activeCount > 0 && !resolution) {
      return fail(400, {
        hasActiveTasks: true,
        activeTasksCount: activeCount,
        message: `Este membro possui ${activeCount} tarefas em andamento.`
      });
    }
    if (activeCount > 0 && resolution === 'RETURN_TO_QUEUE') {
      await executeYugabyteSql(
        `UPDATE public.scan_chapter_stages SET assigned_to = NULL, status = 'AVAILABLE', updated_at = now()
         WHERE scan_id = $1 AND assigned_to = $2 AND status IN ('IN_PROGRESS','REWORK')`,
        [scanId, targetUserId], platform?.env
      );
    }
    const result = await executeYugabyteSql(
      `DELETE FROM public.scan_members WHERE scan_id = $1 AND user_id = $2`,
      [scanId, targetUserId], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Membro não encontrado.' });
    return { success: true, memberRemoved: true, tasksReleased: activeCount };
  },

  transferOwnership: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const targetUserId = formData.get('target_user_id') as string || formData.get('new_owner_id') as string;

    const result = await executeYugabyteSql(
      `WITH authorized AS (
         SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $3 AND role = 'OWNER'
       ), cancelled AS (
         UPDATE public.scan_transfer_requests SET status = 'CANCELLED', responded_at = now()
         WHERE scan_id = $1 AND status = 'PENDING' AND EXISTS (SELECT 1 FROM authorized)
       ) INSERT INTO public.scan_transfer_requests (scan_id, from_user_id, to_user_id, status)
       SELECT $1,$3,$2,'PENDING' WHERE EXISTS (SELECT 1 FROM authorized)
         AND EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $2)
       RETURNING id`,
      [scanId, targetUserId, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Apenas o Dono pode transferir a posse para outro membro.' });
    return { success: true, transferRequested: true };
  },

  respondOwnershipTransfer: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const requestId = formData.get('request_id') as string;
    const accept = formData.get('accept') === 'true';

    const req = await executeYugabyteSql<{ scan_id: string; from_user_id: string; to_user_id: string; status: string }>(
      'SELECT scan_id, from_user_id, to_user_id, status FROM public.scan_transfer_requests WHERE id = $1 FOR UPDATE',
      [requestId], platform?.env
    );
    const transfer = req.rows[0];
    if (!transfer || transfer.to_user_id !== locals.user.id || transfer.status !== 'PENDING') return fail(409, { message: 'Transferência inexistente ou já respondida.' });
    if (accept) {
      await executeYugabyteSql(`UPDATE public.scan_members SET role = 'ADMIN' WHERE scan_id = $1 AND user_id = $2`, [transfer.scan_id, transfer.from_user_id], platform?.env);
      await executeYugabyteSql(`UPDATE public.scan_members SET role = 'OWNER' WHERE scan_id = $1 AND user_id = $2`, [transfer.scan_id, transfer.to_user_id], platform?.env);
    }
    await executeYugabyteSql(
      `UPDATE public.scan_transfer_requests SET status = $2, responded_at = now() WHERE id = $1`,
      [requestId, accept ? 'ACCEPTED' : 'REJECTED'], platform?.env
    );
    return { success: true, transferResponded: true, accepted: accept };
  },

  cancelOwnershipTransfer: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const requestId = formData.get('request_id') as string;

    const result = await executeYugabyteSql(
      `UPDATE public.scan_transfer_requests transfer SET status = 'CANCELLED', responded_at = now()
       WHERE transfer.id = $1 AND transfer.status = 'PENDING' AND EXISTS (
         SELECT 1 FROM public.scan_members member WHERE member.scan_id = transfer.scan_id AND member.user_id = $2 AND member.role = 'OWNER'
       )`,
      [requestId, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Transferência inexistente ou sem permissão.' });
    return { success: true, transferCancelled: true };
  },

  requestProject: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const workId = formData.get('work_id') as string;
    const message = (formData.get('message') as string)?.trim() || '';

    if (!scanId || !workId) {
      return fail(400, { message: 'Obra é obrigatória.' });
    }

    await executeYugabyteSql(
      `INSERT INTO public.scan_project_requests (scan_id, work_id, user_id, message)
       SELECT $1, $2, $3, $4
       WHERE EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $3)`,
      [scanId, workId, locals.user.id, message], platform?.env
    );
    return { success: true, projectRequested: true };
  },

  cancelProjectRequest: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const requestId = formData.get('request_id') as string;

    const result = await executeYugabyteSql(
      `DELETE FROM public.scan_project_requests request
       WHERE request.id = $1 AND request.user_id = $2`,
      [requestId, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Solicitação inexistente ou sem permissão.' });
    return { success: true, projectRequestCancelled: true };
  },

  cancelPartnerRequest: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const requestId = formData.get('request_id') as string;

    const result = await executeYugabyteSql(
      `DELETE FROM public.scan_partner_requests request
       WHERE request.id = $1 AND request.user_id = $2`,
      [requestId, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Solicitação inexistente ou sem permissão.' });
    return { success: true, partnerRequestCancelled: true };
  },

  updateProjectStatus: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const workId = formData.get('work_id') as string;
    const status = formData.get('status') as string;

    const result = await executeYugabyteSql(
      `UPDATE public.work_scans work_scan SET status = $3
       WHERE work_scan.scan_id = $1 AND work_scan.work_id = $2 AND EXISTS (
         SELECT 1 FROM public.scan_members member WHERE member.scan_id = $1 AND member.user_id = $4 AND member.role IN ('OWNER','ADMIN')
       )`,
      [scanId, workId, status, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Obra não encontrada ou sem permissão.' });
    return { success: true, projectStatusUpdated: true, newStatus: status };
  },

  managePosition: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const positionId = (formData.get('position_id') as string) || null;
    const name = (formData.get('name') as string)?.trim();
    const description = (formData.get('description') as string)?.trim() || '';
    const displayOrder = parseInt(formData.get('display_order') as string) || 0;
    const isActive = formData.get('is_active') !== 'false';

    if (!name) return fail(400, { message: 'Nome do cargo é obrigatório' });

    const result = positionId
      ? await executeYugabyteSql(
        `UPDATE public.scan_positions position SET name = $2, description = $3,
           display_order = $4, is_active = $5, updated_at = now()
         WHERE position.id = $1 AND position.scan_id = $6 AND EXISTS (
           SELECT 1 FROM public.scan_members member WHERE member.scan_id = $6 AND member.user_id = $7 AND member.role IN ('OWNER','ADMIN')
         ) RETURNING *`,
        [positionId, name, description, displayOrder, isActive, scanId, locals.user.id], platform?.env
      )
      : await executeYugabyteSql(
        `INSERT INTO public.scan_positions (scan_id, name, description, display_order, is_active)
         SELECT $1,$2,$3,$4,$5 WHERE EXISTS (
           SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $6 AND role IN ('OWNER','ADMIN')
         ) RETURNING *`,
        [scanId, name, description, displayOrder, isActive, locals.user.id], platform?.env
      );
    if (result.rowCount === 0) return fail(403, { message: 'Você não pode gerenciar cargos nesta Scan.' });
    return { success: true, positionManaged: true, data: result.rows[0] };
  },

  manageOpening: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const openingId = (formData.get('opening_id') as string) || null;
    const positionId = formData.get('position_id') as string;
    const title = (formData.get('title') as string)?.trim();
    const description = (formData.get('description') as string)?.trim() || '';
    const requirements = (formData.get('requirements') as string)?.trim() || '';
    const language = (formData.get('language') as string)?.trim() || 'pt-BR';
    const experienceLevel = (formData.get('experience_level') as string)?.trim() || 'QUALQUER';
    const availability = (formData.get('availability') as string)?.trim() || '';
    const slotsRaw = formData.get('slots') as string;
    const slots = slotsRaw && parseInt(slotsRaw) > 0 ? parseInt(slotsRaw) : null;
    const notes = (formData.get('notes') as string)?.trim() || '';
    const status = (formData.get('status') as string) || 'OPEN';

    if (!positionId) return fail(400, { message: 'Cargo é obrigatório' });

    let data: any;
    try {
      const result = await executeYugabyteSql<{ result: any }>(
        `SELECT public.manage_scan_opening_ysql($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) AS result`,
        [
          scanId, locals.user.id, ['ADMIN', 'EDITOR', 'STAFF_SITE'].includes(locals.role || ''), openingId,
          positionId, title || '', description, requirements, language, experienceLevel, availability, slots, notes, status
        ],
        platform?.env
      );
      data = result.rows[0]?.result;
      if (!data?.success) throw new Error('YSQL_OPENING_EMPTY_RESULT');
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      console.error('scan_recruitment_manage_opening_ysql_failed', {
        scanId, openingId, actorId: locals.user.id,
        code: typeof error?.code === 'string' ? error.code : null,
        message: detail.slice(0, 240)
      });
      const clientError = /RECRUITMENT_MANAGEMENT_FORBIDDEN|OPENING_(ARGUMENT_INVALID|STATUS_INVALID|SLOTS_INVALID|POSITION_NOT_FOUND|NOT_FOUND)/.test(detail);
      return fail(clientError ? 403 : 503, {
        message: clientError
          ? 'A vaga foi alterada, o cargo é inválido ou você não tem permissão para administrá-la.'
          : 'Não foi possível salvar a vaga com segurança agora. Nenhuma alteração foi aplicada.'
      });
    }
    return { success: true, openingManaged: true, data };
  },

  reviewApplication: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const applicationId = formData.get('application_id') as string;
    const action = formData.get('action') as string; // 'APPROVE' | 'REJECT' | 'UNDER_REVIEW'
    const notes = (formData.get('notes') as string)?.trim() || null;
    const addToTeam = formData.get('add_to_team') === 'true';
    const initialRole = (formData.get('initial_role') as string) || 'MEMBER';

    let data: any;
    try {
      const result = await executeYugabyteSql<{ result: any }>(
        `SELECT public.review_scan_application_ysql($1, $2, $3, $4, $5, $6, $7) AS result`,
        [applicationId, locals.user.id, ['ADMIN', 'EDITOR', 'STAFF_SITE'].includes(locals.role || ''), action, notes, addToTeam, initialRole],
        platform?.env
      );
      data = result.rows[0]?.result;
      if (!data?.success) throw new Error('YSQL_APPLICATION_REVIEW_EMPTY_RESULT');
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      console.error('scan_recruitment_review_ysql_failed', {
        applicationId, actorId: locals.user.id,
        code: typeof error?.code === 'string' ? error.code : null,
        message: detail.slice(0, 240)
      });
      const conflict = /APPLICATION_ALREADY_FINALIZED/.test(detail);
      const clientError = /APPLICATION_(NOT_FOUND|REVIEW_FORBIDDEN|ACTION_INVALID|MEMBER_ROLE_INVALID)|AUTHENTICATION_REQUIRED/.test(detail);
      return fail(conflict ? 409 : clientError ? 403 : 503, {
        message: conflict
          ? 'Esta candidatura já foi concluída por outra pessoa. Atualize a página.'
          : clientError
            ? 'A candidatura foi alterada ou você não tem permissão para avaliá-la.'
            : 'Não foi possível avaliar a candidatura com segurança agora. Nenhuma alteração foi aplicada.'
      });
    }

    try {
      if (data.applicant_id && data.applicant_id !== locals.user.id) {
        const scanName = data.scan_name || 'Scan';
        const opTitle = data.opening_title || 'Vaga';
        const actionTitle = action === 'APPROVE' ? 'Candidatura Aprovada!' : action === 'REJECT' ? 'Atualização sobre sua candidatura' : 'Candidatura em análise';
        const actionBody = action === 'APPROVE'
          ? `Parabéns! Sua candidatura para ${opTitle} na scan ${scanName} foi aprovada.`
          : action === 'REJECT'
          ? `Agradecemos seu interesse na vaga de ${opTitle} na scan ${scanName}. No momento optamos por outro perfil.`
          : `Sua candidatura para ${opTitle} na scan ${scanName} foi colocada sob análise pela liderança.`;

        await createScanNotification({
          recipientUserId: data.applicant_id,
          actorUserId: locals.user.id,
          type: 'APPLICATION_UPDATE',
          title: actionTitle,
          body: notes ? `${actionBody} Observações: ${notes}` : actionBody,
          deepLink: `/me`,
          scanId: data.scan_id,
          priority: 'NORMAL',
          dedupeKey: `app_review:${applicationId}:${action}:${Date.now()}`,
          platform
        }).catch(err => console.error('Error notifying applicant:', err));
      }
    } catch (e) {
      console.error('Error in reviewApplication notification:', e);
    }

    return { success: true, applicationReviewed: true, data };
  },

  assignPosition: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const userId = formData.get('user_id') as string;
    const positionId = formData.get('position_id') as string;
    const isPrimary = formData.get('is_primary') === 'true';

    try {
      const result = await executeYugabyteSql<{ result: any }>(
        `SELECT public.manage_scan_member_position_ysql('ASSIGN', $1, $2, $3, $4, $5, $6) AS result`,
        [scanId, locals.user.id, ['ADMIN', 'EDITOR', 'STAFF_SITE'].includes(locals.role || ''), userId, positionId, isPrimary],
        platform?.env
      );
      return { success: true, positionAssigned: true, data: result.rows[0]?.result };
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      console.error('scan_member_position_assign_ysql_failed', { scanId, userId, positionId, actorId: locals.user.id, message: detail.slice(0, 240) });
      const expected = /MEMBER_POSITION_(FORBIDDEN|TARGET_NOT_MEMBER|NOT_FOUND|ARGUMENT_INVALID)/.test(detail);
      return fail(expected ? 403 : 503, { message: expected ? 'O membro, cargo ou sua permissão mudou. Atualize a página.' : 'Não foi possível atribuir o cargo com segurança agora.' });
    }
  },

  removePosition: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const userId = formData.get('user_id') as string;
    const positionId = formData.get('position_id') as string;

    try {
      const result = await executeYugabyteSql<{ result: any }>(
        `SELECT public.manage_scan_member_position_ysql('REMOVE', $1, $2, $3, $4, $5, false) AS result`,
        [scanId, locals.user.id, ['ADMIN', 'EDITOR', 'STAFF_SITE'].includes(locals.role || ''), userId, positionId],
        platform?.env
      );
      return { success: true, positionRemoved: true, data: result.rows[0]?.result };
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      console.error('scan_member_position_remove_ysql_failed', { scanId, userId, positionId, actorId: locals.user.id, message: detail.slice(0, 240) });
      const expected = /MEMBER_POSITION_(FORBIDDEN|TARGET_NOT_MEMBER|NOT_FOUND|NOT_ASSIGNED|ARGUMENT_INVALID)/.test(detail);
      return fail(expected ? 409 : 503, { message: expected ? 'O cargo já foi alterado ou você não tem permissão. Atualize a página.' : 'Não foi possível remover o cargo com segurança agora.' });
    }
  },

  setPrimaryPosition: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const userId = formData.get('user_id') as string;
    const positionId = formData.get('position_id') as string;

    try {
      const result = await executeYugabyteSql<{ result: any }>(
        `SELECT public.manage_scan_member_position_ysql('SET_PRIMARY', $1, $2, $3, $4, $5, true) AS result`,
        [scanId, locals.user.id, ['ADMIN', 'EDITOR', 'STAFF_SITE'].includes(locals.role || ''), userId, positionId],
        platform?.env
      );
      return { success: true, primaryPositionSet: true, data: result.rows[0]?.result };
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      console.error('scan_member_position_primary_ysql_failed', { scanId, userId, positionId, actorId: locals.user.id, message: detail.slice(0, 240) });
      const expected = /MEMBER_POSITION_(FORBIDDEN|TARGET_NOT_MEMBER|NOT_FOUND|NOT_ASSIGNED|ARGUMENT_INVALID)/.test(detail);
      return fail(expected ? 409 : 503, { message: expected ? 'O cargo já foi alterado ou você não tem permissão. Atualize a página.' : 'Não foi possível definir o cargo principal com segurança agora.' });
    }
  },

  postStaffNote: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const body = (formData.get('body') as string)?.trim() || '';
    const parentId = (formData.get('parent_id') as string) || null;
    const isPinned = formData.get('is_pinned') === 'true';

    if (!scanId || !body) return fail(400, { message: 'Mensagem não pode estar vazia.' });

    const result = await executeYugabyteSql<any>(
      `INSERT INTO public.scan_staff_notes (scan_id, user_id, parent_id, body, is_pinned)
       SELECT $1, $2, $3, $4, $5
       WHERE EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $2)
       RETURNING *`,
      [scanId, locals.user.id, parentId, body, isPinned], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Você não pertence a esta Scan.' });
    return { success: true, staffNotePosted: true, data: result.rows[0] };
  },

  deleteStaffNote: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const noteId = formData.get('note_id') as string;

    if (!noteId) return fail(400, { message: 'Nota não informada.' });

    const result = await executeYugabyteSql(
      `DELETE FROM public.scan_staff_notes note
       WHERE note.id = $1 AND (note.user_id = $2 OR EXISTS (
         SELECT 1 FROM public.scan_members member
         WHERE member.scan_id = note.scan_id AND member.user_id = $2 AND member.role IN ('OWNER', 'ADMIN')
       ))`,
      [noteId, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Nota inexistente ou sem permissão.' });
    return { success: true, staffNoteDeleted: true };
  },

  updateMemberVisibility: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const targetUserId = formData.get('user_id') as string;
    const isPublic = formData.get('is_public') === 'true';

    if (!scanId || !targetUserId) return fail(400, { message: 'Dados insuficientes.' });

    const result = await executeYugabyteSql(
      `UPDATE public.scan_members target_member SET is_public = $3
       WHERE target_member.scan_id = $1 AND target_member.user_id = $2
         AND EXISTS (SELECT 1 FROM public.scan_members actor
           WHERE actor.scan_id = $1 AND actor.user_id = $4 AND actor.role IN ('OWNER', 'ADMIN'))`,
      [scanId, targetUserId, isPublic, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Membro inexistente ou sem permissão.' });
    return { success: true, memberVisibilityUpdated: true, isPublic };
  },

  createTask: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const workId = (formData.get('work_id') as string) || null;
    const stageId = (formData.get('stage_id') as string) || null;
    const title = (formData.get('title') as string)?.trim();
    const description = (formData.get('description') as string)?.trim() || null;
    const assignedTo = (formData.get('assigned_to') as string) || null;
    const priority = (formData.get('priority') as string) || 'NORMAL';
    const dueAt = (formData.get('due_at') as string) || null;

    if (!scanId || !title) return fail(400, { message: 'Título da tarefa é obrigatório.' });

    const result = await executeYugabyteSql(
      `INSERT INTO public.scan_tasks
       (scan_id, work_id, stage_id, title, description, assigned_to, created_by, priority, due_at)
       SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9
       WHERE EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $7)
       RETURNING id`,
      [scanId, workId, stageId, title, description, assignedTo, locals.user.id, priority, dueAt ? new Date(dueAt).toISOString() : null], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Você não pertence a esta Scan.' });
    return { success: true, taskCreated: true };
  },

  updateTaskStatus: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const taskId = formData.get('task_id') as string;
    const status = formData.get('status') as string;

    if (!taskId || !status) return fail(400, { message: 'Dados insuficientes.' });

    const result = await executeYugabyteSql(
      `UPDATE public.scan_tasks task SET status = $2,
         completed_at = CASE WHEN $2 = 'DONE' THEN now() ELSE NULL END,
         updated_at = now()
       WHERE task.id = $1 AND EXISTS (
         SELECT 1 FROM public.scan_members member WHERE member.scan_id = task.scan_id AND member.user_id = $3
       )`,
      [taskId, status, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Tarefa não encontrada ou sem permissão.' });
    return { success: true, taskStatusUpdated: true };
  },

  handoffTask: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const taskId = formData.get('task_id') as string;
    const targetUserId = formData.get('target_user_id') as string;
    const reason = (formData.get('reason') as string)?.trim() || null;

    if (!taskId || !targetUserId) return fail(400, { message: 'Membro de destino obrigatório.' });

    const result = await executeYugabyteSql<{ handoff_task: any }>(
      `WITH current_task AS (
         SELECT task.id, task.scan_id, task.assigned_to
         FROM public.scan_tasks task
         WHERE task.id = $1 AND EXISTS (
           SELECT 1 FROM public.scan_members member WHERE member.scan_id = task.scan_id AND member.user_id = $4
         ) AND EXISTS (
           SELECT 1 FROM public.scan_members target_member WHERE target_member.scan_id = task.scan_id AND target_member.user_id = $2
         ) FOR UPDATE
       ), updated AS (
         UPDATE public.scan_tasks task SET assigned_to = $2, updated_at = now()
         FROM current_task WHERE task.id = current_task.id
         RETURNING task.id
       )
       INSERT INTO public.scan_task_handoffs (task_id, from_user_id, to_user_id, transferred_by, reason)
       SELECT current_task.id, current_task.assigned_to, $2, $4, $3 FROM current_task JOIN updated ON updated.id = current_task.id
       RETURNING task_id AS handoff_task`,
      [taskId, targetUserId, reason, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Tarefa não encontrada, destino inválido ou sem permissão.' });

    return { success: true, taskHandoff: true };
  },

  deleteTask: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const taskId = formData.get('task_id') as string;
    if (!taskId) return fail(400, { message: 'ID da tarefa obrigatório.' });

    const result = await executeYugabyteSql(
      `DELETE FROM public.scan_tasks task
       WHERE task.id = $1 AND EXISTS (
         SELECT 1 FROM public.scan_members member WHERE member.scan_id = task.scan_id AND member.user_id = $2 AND member.role IN ('OWNER','ADMIN')
       )`,
      [taskId, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Tarefa não encontrada ou sem permissão.' });
    return { success: true, taskDeleted: true };
  },

  createStage: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const name = (formData.get('name') as string)?.trim();
    const color = (formData.get('color') as string)?.trim() || '#6366f1';
    const required = formData.get('required') === 'true';

    if (!scanId || !name) return fail(400, { message: 'Nome da etapa obrigatório.' });

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const result = await executeYugabyteSql(
      `INSERT INTO public.scan_workflow_stages (scan_id, name, slug, color, required)
       SELECT $1,$2,$3,$4,$5
       WHERE EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $6 AND role IN ('OWNER','ADMIN'))
       RETURNING id`,
      [scanId, name, slug, color, required, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Você não pode criar etapas nesta Scan.' });
    return { success: true, stageCreated: true };
  },

  saveGlossaryEntry: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const entryId = formData.get('entry_id') as string;
    const scanId = formData.get('scan_id') as string;
    const workId = formData.get('work_id') as string;
    const sourceTerm = (formData.get('source_term') as string)?.trim();
    const preferredTranslation = (formData.get('preferred_translation') as string)?.trim();
    const category = (formData.get('category') as string)?.trim() || 'Geral';
    const notes = (formData.get('notes') as string)?.trim() || null;

    if (!scanId || !workId || !sourceTerm || !preferredTranslation) {
      return fail(400, { message: 'Campos obrigatórios ausentes.' });
    }

    const result = entryId
      ? await executeYugabyteSql(
        `UPDATE public.work_glossary_entries entry SET work_id = $2, source_term = $3,
           preferred_translation = $4, category = $5, notes = $6, updated_by = $7, updated_at = now()
         WHERE entry.id = $1 AND entry.scan_id = $8 AND EXISTS (
           SELECT 1 FROM public.scan_members member WHERE member.scan_id = entry.scan_id AND member.user_id = $7
         )`,
        [entryId, workId, sourceTerm, preferredTranslation, category, notes, locals.user.id, scanId], platform?.env
      )
      : await executeYugabyteSql(
        `INSERT INTO public.work_glossary_entries
           (scan_id, work_id, source_term, preferred_translation, category, notes, created_by, updated_by)
         SELECT $1,$2,$3,$4,$5,$6,$7,$7
         WHERE EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $7)
         RETURNING id`,
        [scanId, workId, sourceTerm, preferredTranslation, category, notes, locals.user.id], platform?.env
      );
    if (result.rowCount === 0) return fail(403, { message: 'Entrada inexistente ou sem permissão.' });
    return { success: true, glossarySaved: true };
  },

  deleteGlossaryEntry: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const entryId = formData.get('entry_id') as string;
    if (!entryId) return fail(400, { message: 'ID ausente.' });

    const result = await executeYugabyteSql(
      `DELETE FROM public.work_glossary_entries entry
       WHERE entry.id = $1 AND EXISTS (
         SELECT 1 FROM public.scan_members member WHERE member.scan_id = entry.scan_id AND member.user_id = $2
       )`,
      [entryId, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Entrada inexistente ou sem permissão.' });
    return { success: true, glossaryDeleted: true };
  },

  saveReference: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const workId = formData.get('work_id') as string;
    const title = (formData.get('title') as string)?.trim();
    const refType = (formData.get('ref_type') as string) || 'LINK';
    const content = (formData.get('content') as string)?.trim();

    if (!scanId || !workId || !title || !content) {
      return fail(400, { message: 'Preencha todos os campos obrigatórios.' });
    }

    const result = await executeYugabyteSql(
      `INSERT INTO public.work_references (scan_id, work_id, title, ref_type, content, created_by)
       SELECT $1,$2,$3,$4,$5,$6
       WHERE EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $6)
       RETURNING id`,
      [scanId, workId, title, refType, content, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Você não pertence a esta Scan.' });
    return { success: true, referenceSaved: true };
  },

  deleteReference: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const refId = formData.get('ref_id') as string;
    if (!refId) return fail(400, { message: 'ID ausente.' });

    const result = await executeYugabyteSql(
      `DELETE FROM public.work_references reference
       WHERE reference.id = $1 AND EXISTS (
         SELECT 1 FROM public.scan_members member WHERE member.scan_id = reference.scan_id AND member.user_id = $2
       )`,
      [refId, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Referência inexistente ou sem permissão.' });
    return { success: true, referenceDeleted: true };
  },

  createWikiPage: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const title = (formData.get('title') as string)?.trim();
    const slug = (formData.get('slug') as string)?.trim() || title?.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const category = (formData.get('category') as string)?.trim() || 'Geral';
    const content = (formData.get('content') as string)?.trim();
    const isPinned = formData.get('is_pinned') === 'true';

    if (!scanId || !title || !content) return fail(400, { message: 'Título e conteúdo obrigatórios.' });

    const result = await executeYugabyteSql(
      `INSERT INTO public.scan_wiki_pages
       (scan_id, title, slug, category, content, is_pinned, created_by, updated_by)
       SELECT $1,$2,$3,$4,$5,$6,$7,$7
       WHERE EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $7)
       RETURNING id`,
      [scanId, title, slug, category, content, isPinned, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Você não pertence a esta Scan.' });
    return { success: true, wikiCreated: true };
  },

  updateWikiPage: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const pageId = formData.get('page_id') as string;
    const title = (formData.get('title') as string)?.trim();
    const category = (formData.get('category') as string)?.trim() || 'Geral';
    const content = (formData.get('content') as string)?.trim();
    const isPinned = formData.get('is_pinned') === 'true';

    if (!pageId || !title || !content) return fail(400, { message: 'Dados incompletos.' });

    const result = await executeYugabyteSql(
      `UPDATE public.scan_wiki_pages page SET title = $2, category = $3, content = $4,
         is_pinned = $5, updated_by = $6, updated_at = now()
       WHERE page.id = $1 AND EXISTS (
         SELECT 1 FROM public.scan_members member WHERE member.scan_id = page.scan_id AND member.user_id = $6
       )`,
      [pageId, title, category, content, isPinned, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Página inexistente ou sem permissão.' });
    return { success: true, wikiUpdated: true };
  },

  deleteWikiPage: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const pageId = formData.get('page_id') as string;
    if (!pageId) return fail(400, { message: 'ID ausente.' });

    const result = await executeYugabyteSql(
      `DELETE FROM public.scan_wiki_pages page
       WHERE page.id = $1 AND EXISTS (
         SELECT 1 FROM public.scan_members member WHERE member.scan_id = page.scan_id AND member.user_id = $2
       )`,
      [pageId, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Página inexistente ou sem permissão.' });
    return { success: true, wikiDeleted: true };
  },

  setMaintenance: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const pauseUploads = formData.get('pause_uploads') === 'on';
    const pauseRecruitment = formData.get('pause_recruitment') === 'on';
    const emergencyMode = formData.get('emergency_mode') === 'on';
    const emergencyReason = (formData.get('emergency_reason') as string)?.trim() || null;

    const result = await executeYugabyteSql(
      `UPDATE public.scans SET pause_uploads = $2, pause_recruitment = $3,
         emergency_mode = $4, emergency_reason = $5, updated_at = now()
       WHERE id = $1 AND ($6::text = 'ADMIN' OR EXISTS (
         SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $7 AND role IN ('OWNER','ADMIN')
       ))`,
      [scanId, pauseUploads, pauseRecruitment, emergencyMode, emergencyReason, locals.role, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Permissão negada ou scan inexistente.' });
    return { success: true, maintenanceUpdated: true };
  },

  changeSlug: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const newSlug = (formData.get('new_slug') as string)?.trim().toLowerCase();

    if (!scanId || !newSlug) return fail(400, { message: 'Novo slug obrigatório.' });

    const result = await executeYugabyteSql(
      `UPDATE public.scans SET slug = $2, updated_at = now()
       WHERE id = $1 AND ($3::text = 'ADMIN' OR EXISTS (
         SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $4 AND role = 'OWNER'
       ))`,
      [scanId, newSlug, locals.role, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Apenas o Dono ou ADMIN pode alterar o slug.' });
    return { success: true, slugChanged: true };
  },

  saveIntegration: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const integrationPlatform = formData.get('platform') as string;
    const name = (formData.get('name') as string)?.trim();
    const webhookUrl = (formData.get('webhook_url') as string)?.trim();

    if (!scanId || !integrationPlatform || !name || !webhookUrl) {
      return fail(400, { message: 'Campos obrigatórios ausentes.' });
    }

    const result = await executeYugabyteSql(
      `INSERT INTO public.scan_integrations (scan_id, platform, name, webhook_url)
       SELECT $1,$2,$3,$4
       WHERE EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $5 AND role IN ('OWNER','ADMIN'))
       RETURNING id`,
      [scanId, integrationPlatform, name, webhookUrl, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Você não pode configurar integrações nesta Scan.' });
    return { success: true, integrationSaved: true };
  },

  deleteIntegration: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const integrationId = formData.get('integration_id') as string;
    if (!integrationId) return fail(400, { message: 'ID ausente.' });

    const result = await executeYugabyteSql(
      `DELETE FROM public.scan_integrations integration
       WHERE integration.id = $1 AND EXISTS (
         SELECT 1 FROM public.scan_members member WHERE member.scan_id = integration.scan_id AND member.user_id = $2 AND member.role IN ('OWNER','ADMIN')
       )`,
      [integrationId, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Integração inexistente ou sem permissão.' });
    return { success: true, integrationDeleted: true };
  },

  leaveScan: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    if (!scanId) return fail(400, { message: 'Scan ausente.' });

    const result = await executeYugabyteSql(
      `DELETE FROM public.scan_members member
       WHERE member.scan_id = $1 AND member.user_id = $2 AND member.role <> 'OWNER'`,
      [scanId, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Você não pode sair desta Scan.' });
    throw redirect(303, '/scan');
  },

  updateAvailability: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const status = formData.get('availability_status') as string;
    const message = (formData.get('availability_message') as string)?.trim() || null;

    if (!scanId || !status) return fail(400, { message: 'Dados inválidos.' });

    const result = await executeYugabyteSql(
      `UPDATE public.scan_members SET availability_status = $3,
         availability_message = $4, availability_updated_at = now()
       WHERE scan_id = $1 AND user_id = $2`,
      [scanId, locals.user.id, status, message], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Membro não encontrado nesta Scan.' });
    return { success: true, availabilityUpdated: true };
  },

  saveRecruitmentQuestion: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const openingId = formData.get('opening_id') as string;
    const question = (formData.get('question') as string)?.trim();
    const questionType = (formData.get('question_type') as string) || 'TEXT_SHORT';
    const required = formData.get('required') === 'true';

    if (!scanId || !openingId || !question) return fail(400, { message: 'Pergunta obrigatória.' });

    const result = await executeYugabyteSql(
      `INSERT INTO public.scan_recruitment_questions (scan_id, opening_id, question, question_type, required)
       SELECT $1,$2,$3,$4,$5
       WHERE EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $6 AND role IN ('OWNER','ADMIN'))
       RETURNING id`,
      [scanId, openingId, question, questionType, required, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Você não pode editar perguntas desta Scan.' });
    return { success: true, questionSaved: true };
  },

  deleteRecruitmentQuestion: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const questionId = formData.get('question_id') as string;
    if (!questionId) return fail(400, { message: 'ID ausente.' });

    const result = await executeYugabyteSql(
      `DELETE FROM public.scan_recruitment_questions question
       WHERE question.id = $1 AND EXISTS (
         SELECT 1 FROM public.scan_members member WHERE member.scan_id = question.scan_id AND member.user_id = $2 AND member.role IN ('OWNER','ADMIN')
       )`,
      [questionId, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Pergunta inexistente ou sem permissão.' });
    return { success: true, questionDeleted: true };
  },

  postMessage: async ({ request, locals, platform }: any) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const channelId = String(formData.get('channelId') || '');
    const content = String(formData.get('content') || '').trim();
    const replyToId = String(formData.get('replyToId') || '').trim() || null;
    if (!channelId || !content) return fail(400, { message: 'Mensagem obrigatória' });

    const channelResult = await executeYugabyteSql<{ scan_id: string; name: string; type: string }>(
      `SELECT channel.scan_id, channel.name, channel.type
       FROM public.scan_channels channel
       WHERE channel.id = $1 AND EXISTS (
         SELECT 1 FROM public.scan_members member WHERE member.scan_id = channel.scan_id AND member.user_id = $2
       )`,
      [channelId, locals.user.id], platform?.env
    );
    const ch = channelResult.rows[0] || null;
    if (!ch) return fail(404, { message: 'Canal não encontrado' });

    if (ch.type === 'ANNOUNCEMENT') {
      const memberResult = await executeYugabyteSql<{ role: string }>(
        'SELECT role FROM public.scan_members WHERE scan_id = $1 AND user_id = $2 LIMIT 1',
        [ch.scan_id, locals.user.id], platform?.env
      );
      const mem = memberResult.rows[0] || null;
      if (!mem || !['OWNER', 'ADMIN'].includes(mem.role)) {
        return fail(403, { message: 'Apenas Administradores e Donos da Scan podem postar em canais de avisos.' });
      }
    }

    const messageResult = await executeYugabyteSql<any>(
      `INSERT INTO public.scan_messages (scan_id, channel_id, user_id, reply_to_id, content)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [ch.scan_id, channelId, locals.user.id, replyToId, content], platform?.env
    );
    const msg = messageResult.rows[0];
    if (!msg) return fail(503, { message: 'Não foi possível publicar a mensagem agora.' });

    // Reply Notification Dispatch
    if (replyToId) {
      try {
        const originalResult = await executeYugabyteSql<{ user_id: string; content: string }>(
          'SELECT user_id, content FROM public.scan_messages WHERE id = $1 AND scan_id = $2 LIMIT 1',
          [replyToId, ch.scan_id], platform?.env
        );
        const origMsg = originalResult.rows[0] || null;

        if (origMsg && origMsg.user_id && origMsg.user_id !== locals.user.id) {
          const preview = origMsg.content ? `"${origMsg.content.slice(0, 50)}..."` : 'sua mensagem';
          await createScanNotification({
            recipientUserId: origMsg.user_id,
            actorUserId: locals.user.id,
            type: 'REPLY_CHAT',
            title: `Respondeu ${preview} em #${ch.name || 'canal'}`,
            body: content,
            deepLink: `/scan?id=${ch.scan_id}&tab=chat&channelId=${channelId}#msg-${msg.id}`,
            context: `#${ch.name || 'chat'}`,
            scanId: ch.scan_id,
            priority: 'NORMAL',
            dedupeKey: `reply:${replyToId}:${msg.id}`,
            platform
          });
        }
      } catch (err) {
        console.error('Error dispatching reply notification:', err);
      }
    }

    // Centralized Mention Dispatch (In-App notification + Scan Email Outbox)
    let mentionsData = null;
    try {
      const rawMentions = formData.get('mentionsData');
      if (rawMentions) {
        mentionsData = JSON.parse(String(rawMentions));
      }
    } catch (e) {
      console.warn('Failed to parse mentionsData:', e);
    }

    await dispatchScanMentions({
      locals,
      text: content,
      messageId: msg.id,
      scanId: ch.scan_id,
      channelId,
      authorId: locals.user.id,
      title: `Nova menção em #${ch.name || 'canal'}`,
      deepLink: `/scan?id=${ch.scan_id}&tab=chat&channelId=${channelId}#msg-${msg.id}`,
      contextType: 'CHAT',
      mentionsData,
      platform
    }).catch(err => console.error('Error dispatching chat mentions:', err));

    if (platform?.context?.waitUntil) {
      platform.context.waitUntil(processPendingEmailOutbox(10, undefined, platform?.env).catch(() => {}));
    }

    return { success: true, messageId: msg.id };
  },

  editMessage: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const messageId = String(formData.get('messageId') || '');
    const content = String(formData.get('content') || '').trim();
    if (!messageId || !content) return fail(400, { message: 'Conteúdo obrigatório' });

    const messageResult = await executeYugabyteSql<any>(
      `UPDATE public.scan_messages message SET content = $2, edited_at = now()
       WHERE message.id = $1 AND message.user_id = $3 AND message.deleted_at IS NULL
       RETURNING message.*`,
      [messageId, content, locals.user.id], platform?.env
    );
    const data = messageResult.rows[0];
    if (!data) return fail(403, { message: 'Mensagem inexistente ou sem permissão.' });

    // Disparar eventuais menções novas adicionadas na edição (deduplicação evita reenvio para quem já foi notificado)
    try {
      const currentMsg = data;

      if (currentMsg) {
        let editMentionsData = null;
        try {
          const rawEditMentions = formData.get('mentionsData');
          if (rawEditMentions) editMentionsData = JSON.parse(String(rawEditMentions));
        } catch {
          // Invalid optional mention metadata must not block message editing.
        }

        await dispatchScanMentions({
          locals,
          text: content,
          messageId,
          scanId: currentMsg.scan_id,
          channelId: currentMsg.channel_id,
          authorId: locals.user.id,
          deepLink: `/scan?id=${currentMsg.scan_id}&tab=chat&channelId=${currentMsg.channel_id}#msg-${messageId}`,
          contextType: 'CHAT',
          mentionsData: editMentionsData,
          platform
        });
      }
    } catch (err) {
      console.error('Error dispatching edited mentions:', err);
    }

    return { success: true, messageEdited: true, data };
  },

  deleteMessage: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const messageId = String(formData.get('messageId') || '');
    if (!messageId) return fail(400, { message: 'Mensagem obrigatória' });

    const result = await executeYugabyteSql(
      `UPDATE public.scan_messages message SET deleted_at = now(), content = '[mensagem removida]'
       WHERE message.id = $1 AND (message.user_id = $2 OR EXISTS (
         SELECT 1 FROM public.scan_members member WHERE member.scan_id = message.scan_id AND member.user_id = $2 AND member.role IN ('OWNER','ADMIN')
       ))`,
      [messageId, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Mensagem inexistente ou sem permissão.' });
    const data = { deleted: true };
    return { success: true, messageDeleted: true, data };
  },

  postThreadReply: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const parentMessageId = String(formData.get('parentMessageId') || '');
    const content = String(formData.get('content') || '').trim();
    if (!parentMessageId || !content) return fail(400, { message: 'Conteúdo obrigatório' });

    const parentResult = await executeYugabyteSql<{ scan_id: string; user_id: string; channel_id: string; content: string }>(
      'SELECT scan_id, user_id, channel_id, content FROM public.scan_messages WHERE id = $1 LIMIT 1',
      [parentMessageId], platform?.env
    );
    const parent = parentResult.rows[0] || null;
    if (!parent) return fail(404, { message: 'Mensagem original não encontrada' });

    const threadResult = await executeYugabyteSql(
      `INSERT INTO public.scan_message_threads (scan_id, parent_message_id, user_id, content)
       SELECT $1,$2,$3,$4 WHERE EXISTS (
         SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $3
       )`,
      [parent.scan_id, parentMessageId, locals.user.id, content], platform?.env
    );
    if (threadResult.rowCount === 0) return fail(403, { message: 'Você não pertence a esta Scan.' });

    // Notify parent author
    if (parent.user_id && parent.user_id !== locals.user.id) {
      const preview = parent.content ? `"${parent.content.slice(0, 50)}..."` : 'sua mensagem';
      await createScanNotification({
        recipientUserId: parent.user_id,
        actorUserId: locals.user.id,
        type: 'REPLY_CHAT',
        title: `Nova resposta na sua thread (${preview})`,
        body: content,
        deepLink: `/scan?id=${parent.scan_id}&tab=chat&channelId=${parent.channel_id || ''}#msg-${parentMessageId}`,
        context: 'Thread',
        scanId: parent.scan_id,
        priority: 'NORMAL',
        dedupeKey: `thread_reply:${parentMessageId}:${locals.user.id}:${Date.now()}`,
        platform
      }).catch(err => console.error('Error dispatching thread reply notification:', err));
    }

    // Dispatch mentions in thread reply
    await dispatchScanMentions({
      locals,
      text: content,
      scanId: parent.scan_id,
      channelId: parent.channel_id,
      authorId: locals.user.id,
      title: 'Nova menção em resposta de thread',
      deepLink: `/scan?id=${parent.scan_id}&tab=chat&channelId=${parent.channel_id || ''}#msg-${parentMessageId}`,
      contextType: 'CHAT',
      platform
    }).catch(err => console.error('Error dispatching thread mentions:', err));

    return { success: true };
  },

  togglePinMessage: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const messageId = String(formData.get('messageId') || '');
    const pinned = formData.get('pinned') === 'true';
    const result = await executeYugabyteSql(
      `UPDATE public.scan_messages message SET pinned = $2
       WHERE message.id = $1 AND EXISTS (
         SELECT 1 FROM public.scan_members member WHERE member.scan_id = message.scan_id AND member.user_id = $3 AND member.role IN ('OWNER','ADMIN')
       )`,
      [messageId, pinned, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Mensagem inexistente ou sem permissão.' });
    return { success: true };
  },

  toggleReaction: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const messageId = String(formData.get('messageId') || '');
    const emoji = String(formData.get('emoji') || '').trim();
    if (!messageId || !emoji) return fail(400, { message: 'Dados inválidos' });

    const existing = await executeYugabyteSql<{ id: string }>(
      `SELECT reaction.id FROM public.scan_message_reactions reaction
       JOIN public.scan_messages message ON message.id = reaction.message_id
       WHERE reaction.message_id = $1 AND reaction.user_id = $2 AND reaction.emoji = $3`,
      [messageId, locals.user.id, emoji], platform?.env
    );
    if (existing.rows[0]) {
      await executeYugabyteSql('DELETE FROM public.scan_message_reactions WHERE id = $1', [existing.rows[0].id], platform?.env);
    } else {
      await executeYugabyteSql(
        `INSERT INTO public.scan_message_reactions (message_id, user_id, emoji)
         SELECT $1,$2,$3 WHERE EXISTS (SELECT 1 FROM public.scan_messages WHERE id = $1)`,
        [messageId, locals.user.id, emoji], platform?.env
      );
    }
    const data = { toggled: true };
    return { success: true, reactionToggled: true, data };
  },

  reactMessage: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const messageId = String(formData.get('messageId') || '');
    const emoji = String(formData.get('emoji') || '👍').trim();

    const existing = await executeYugabyteSql<{ id: string }>(
      `SELECT reaction.id FROM public.scan_message_reactions reaction
       WHERE reaction.message_id = $1 AND reaction.user_id = $2 AND reaction.emoji = $3`,
      [messageId, locals.user.id, emoji], platform?.env
    );
    if (existing.rows[0]) await executeYugabyteSql('DELETE FROM public.scan_message_reactions WHERE id = $1', [existing.rows[0].id], platform?.env);
    else await executeYugabyteSql('INSERT INTO public.scan_message_reactions (message_id, user_id, emoji) VALUES ($1,$2,$3)', [messageId, locals.user.id, emoji], platform?.env);
    const data = { toggled: true };
    return { success: true, reactionToggled: true, data };
  },

  markChannelRead: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = String(formData.get('scanId') || '');
    const channelId = String(formData.get('channelId') || '');
    const messageId = String(formData.get('messageId') || '') || null;
    if (!scanId || !channelId) return fail(400, { message: 'Dados inválidos' });

    const result = await executeYugabyteSql(
      `INSERT INTO public.scan_channel_read_states_ysql (scan_id, channel_id, user_id, last_read_message_id, last_read_at)
       VALUES ($1,$2,$3,$4,now())
       ON CONFLICT (scan_id, channel_id, user_id) DO UPDATE SET last_read_message_id = EXCLUDED.last_read_message_id, last_read_at = now()`,
      [scanId, channelId, locals.user.id, messageId], platform?.env
    );
    const data = { updated: result.rowCount >= 0 };
    return { success: true, channelMarkedRead: true, data };
  },

  createChannel: async ({ request, locals, url, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const name = String(formData.get('name') || '').trim();
    const category = String(formData.get('category') || 'GERAL');
    const type = String(formData.get('type') || 'CHAT');
    const description = String(formData.get('description') || '').trim();
    const scanId = url.searchParams.get('id');
    if (!scanId || !name) return fail(400, { message: 'Nome obrigatório' });

    const slug = slugify(name);
    const result = await executeYugabyteSql(
      `INSERT INTO public.scan_channels (scan_id, name, slug, category, type, description, created_by)
       SELECT $1,$2,$3,$4,$5,$6,$7 WHERE EXISTS (
         SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $7 AND role IN ('OWNER','ADMIN')
       ) RETURNING id`,
      [scanId, name, slug, category, type, description, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Você não pode criar canais nesta Scan.' });
    return { success: true, channelCreated: true };
  },

  createQcIssue: async ({ request, locals, url, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const chapterId = String(formData.get('chapterId') || '');
    const pageNumber = Number(formData.get('pageNumber') || 1);
    const issueType = String(formData.get('issueType') || 'TYPE');
    const description = String(formData.get('description') || '').trim();
    const assignedTo = formData.get('assignedTo') ? String(formData.get('assignedTo')) : null;
    const scanId = url.searchParams.get('id');
    if (!scanId || !chapterId || !description) return fail(400, { message: 'Dados incompletos' });

    const result = await executeYugabyteSql(
      `INSERT INTO public.scan_chapter_qc_issues
       (scan_id, chapter_id, page_number, issue_type, description, assigned_to, created_by)
       SELECT $1,$2,$3,$4,$5,$6,$7 WHERE EXISTS (
         SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $7
       ) RETURNING id`,
      [scanId, chapterId, pageNumber, issueType, description, assignedTo, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Você não pertence a esta Scan.' });

    if (assignedTo && assignedTo !== locals.user.id) {
      await createScanNotification({
        recipientUserId: assignedTo,
        actorUserId: locals.user.id,
        type: 'QC_ISSUE',
        title: `Novo problema de QC apontado (Pág. ${pageNumber})`,
        body: `Tipo: ${issueType}. Descrição: ${description}`,
        deepLink: `/scan?id=${scanId}&tab=pipeline&chapterId=${chapterId}`,
        scanId,
        priority: 'URGENT',
        dedupeKey: `qc:${chapterId}:${pageNumber}:${assignedTo}:${Date.now()}`,
        platform
      }).catch(err => console.error('Error dispatching QC notification:', err));
    }

    return { success: true, qcIssueCreated: true };
  },

  updateQcStatus: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const issueId = String(formData.get('issueId') || '');
    const status = String(formData.get('status') || 'OPEN');
    const result = await executeYugabyteSql(
      `UPDATE public.scan_chapter_qc_issues issue SET status = $2,
         resolved_by = CASE WHEN $2 = 'RESOLVED' THEN $3 ELSE resolved_by END,
         resolved_at = CASE WHEN $2 = 'RESOLVED' THEN now() ELSE NULL END,
         updated_at = now()
       WHERE issue.id = $1 AND EXISTS (
         SELECT 1 FROM public.scan_members member WHERE member.scan_id = issue.scan_id AND member.user_id = $3
       )`,
      [issueId, status, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Apontamento inexistente ou sem permissão.' });
    return { success: true, qcStatusUpdated: true };
  },

  saveAcademyTutorial: async ({ request, locals, url, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const tutorialId = formData.get('tutorialId') ? String(formData.get('tutorialId')) : null;
    const title = String(formData.get('title') || '').trim();
    const category = String(formData.get('category') || 'Tradução');
    const content = String(formData.get('content') || '').trim();
    const status = String(formData.get('status') || 'PUBLISHED');
    const targetPositionId = formData.get('target_position_id') ? String(formData.get('target_position_id')) : null;
    const isPublished = status === 'PUBLISHED';
    const scanId = url.searchParams.get('id') || (formData.get('scan_id') as string);
    if (!scanId || !title || !content) return fail(400, { message: 'Título e conteúdo são obrigatórios' });

    const slug = slugify(title) || 'tutorial';
    const result = tutorialId
      ? await executeYugabyteSql(
        `UPDATE public.scan_academy_tutorials tutorial SET title = $2, slug = $3,
           category = $4, content = $5, status = $6, is_published = $7,
           target_position_id = $8, updated_at = now()
         WHERE tutorial.id = $1 AND tutorial.scan_id = $9 AND EXISTS (
           SELECT 1 FROM public.scan_members member WHERE member.scan_id = tutorial.scan_id AND member.user_id = $10 AND member.role IN ('OWNER','ADMIN')
         )`,
        [tutorialId, title, slug, category, content, status, isPublished, targetPositionId || null, scanId, locals.user.id], platform?.env
      )
      : await executeYugabyteSql(
        `INSERT INTO public.scan_academy_tutorials
           (scan_id, title, slug, category, content, status, is_published, target_position_id, created_by)
         SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9 WHERE EXISTS (
           SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $9 AND role IN ('OWNER','ADMIN')
         ) RETURNING id`,
        [scanId, title, slug, category, content, status, isPublished, targetPositionId || null, locals.user.id], platform?.env
      );
    if (result.rowCount === 0) return fail(403, { message: 'Você não pode editar tutoriais nesta Scan.' });
    return { success: true, tutorialSaved: true };
  },

  deleteAcademyTutorial: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const tutorialId = formData.get('tutorial_id') as string;
    const scanId = formData.get('scan_id') as string;
    if (!tutorialId || !scanId) return fail(400, { message: 'ID do tutorial ausente' });

    const memberResult = await executeYugabyteSql<{ role: string }>(
      'SELECT role FROM public.scan_members WHERE scan_id = $1 AND user_id = $2 LIMIT 1',
      [scanId, locals.user.id], platform?.env
    );
    const memberRow = memberResult.rows[0] || null;

    if (!memberRow || !['OWNER', 'ADMIN'].includes(memberRow.role)) {
      if (locals.role !== 'ADMIN') return fail(403, { message: 'Permissão negada. Apenas Líderes ou Admins podem excluir tutoriais.' });
    }

    await executeYugabyteSql(
      `DELETE FROM public.scan_attachments WHERE scan_id = $1 AND context_type = 'TUTORIAL' AND context_id = $2`,
      [scanId, tutorialId], platform?.env
    );
    const result = await executeYugabyteSql(
      `DELETE FROM public.scan_academy_tutorials WHERE id = $1 AND scan_id = $2`,
      [tutorialId, scanId], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Tutorial não encontrado.' });
    return { success: true, tutorialDeleted: true };
  },

  advanceStage: async ({ request, locals, url, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const chapterId = String(formData.get('chapterId') || '');
    const stageSlug = String(formData.get('stageSlug') || '');
    const scanId = url.searchParams.get('id');
    if (!scanId || !chapterId || !stageSlug) return fail(400, { message: 'Dados incompletos' });

    const result = await executeYugabyteSql(
      `UPDATE public.scan_production_chapters chapter SET current_stage_slug = $2, updated_at = now()
       WHERE chapter.id = $1 AND chapter.scan_id = $3 AND EXISTS (
         SELECT 1 FROM public.scan_members member WHERE member.scan_id = $3 AND member.user_id = $4
       )`,
      [chapterId, stageSlug, scanId, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Capítulo inexistente ou sem permissão.' });
    return { success: true, stageAdvanced: true };
  },

  publishChapter: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const chapterId = String(formData.get('chapterId') || '');
    if (!chapterId) return fail(400, { message: 'ID do capítulo ausente' });

    const qcResult = await executeYugabyteSql<{ open_count: number }>(
      `SELECT count(*)::int AS open_count FROM public.scan_chapter_qc_issues
       WHERE chapter_id = $1 AND status = 'OPEN'`,
      [chapterId], platform?.env
    );
    if (Number(qcResult.rows[0]?.open_count || 0) > 0) {
      return fail(400, { message: 'Publicação bloqueada: existem apontamentos de QC em aberto!' });
    }

    const result = await executeYugabyteSql(
      `WITH published AS (
         UPDATE public.chapters SET published_at = now() WHERE id = $1 RETURNING id
       ) UPDATE public.scan_production_chapters production SET status = 'PUBLISHED', updated_at = now()
       WHERE production.target_chapter_id = $1 AND EXISTS (SELECT 1 FROM published)
         AND EXISTS (SELECT 1 FROM public.scan_members member WHERE member.scan_id = production.scan_id AND member.user_id = $2)`,
      [chapterId, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Capítulo inexistente ou sem permissão.' });

    return { success: true, chapterPublished: true };
  },

  createMuralPost: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = String(formData.get('scan_id') || '');
    const title = String(formData.get('title') || '').trim();
    const content = String(formData.get('content') || '').trim();
    const postType = String(formData.get('post_type') || 'GERAL');
    const isPinned = formData.get('is_pinned') === 'true';

    if (!scanId || !title || !content) {
      return fail(400, { message: 'Título e conteúdo são obrigatórios' });
    }

    const memberResult = await executeYugabyteSql<{ role: string }>(
      'SELECT role FROM public.scan_members WHERE scan_id = $1 AND user_id = $2 LIMIT 1',
      [scanId, locals.user.id], platform?.env
    );
    const member = memberResult.rows[0] || null;

    if (!member && locals.role !== 'ADMIN') {
      return fail(403, { message: 'Acesso negado à Scan' });
    }

    const postResult = await executeYugabyteSql<any>(
      `INSERT INTO public.scan_mural_posts
       (scan_id, author_id, title, content, post_type, is_pinned, pinned_at, pinned_by)
       SELECT $1,$2,$3,$4,$5,$6,CASE WHEN $6 THEN now() ELSE NULL END,CASE WHEN $6 THEN $2 ELSE NULL END
       RETURNING *`,
      [scanId, locals.user.id, title, content, postType, isPinned], platform?.env
    );
    const post = postResult.rows[0];
    if (!post) return fail(503, { message: 'Não foi possível publicar no mural agora.' });

    const files = formData.getAll('files') as File[];
    const BLOCKED_EXTENSIONS = ['.exe', '.apk', '.bat', '.cmd', '.sh', '.bin', '.dll', '.msi'];

    for (const f of files) {
      if (f && f instanceof Blob && f.size > 0) {
        const rawFilename = f.name || 'anexo';
        const ext = rawFilename.lastIndexOf('.') !== -1 ? rawFilename.slice(rawFilename.lastIndexOf('.')).toLowerCase() : '';
        if (BLOCKED_EXTENSIONS.includes(ext)) continue;

        const safeFilename = rawFilename
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .toLowerCase();

        await executeYugabyteSql(
          `INSERT INTO public.scan_attachments
           (scan_id, context_type, context_id, uploaded_by, original_filename, safe_filename, mime_type, size, storage_reference, storage_provider)
           VALUES ($1,'MURAL_POST',$2,$3,$4,$5,$6,$7,$8,'PRIVATE_STORAGE')`,
          [scanId, post.id, locals.user.id, rawFilename, safeFilename, f.type || 'application/octet-stream', f.size, 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8)], platform?.env
        );
      }
    }

    await dispatchScanMentions({
      locals,
      text: content,
      scanId,
      authorId: locals.user.id,
      title: `Nova publicação no Mural: "${title}"`,
      deepLink: `/scan?id=${scanId}&tab=mural&postId=${post.id}`,
      contextType: 'MURAL',
      platform
    }).catch(err => console.error('Error dispatching mural post mentions:', err));

    return { success: true, muralPostCreated: true };
  },

  commentMuralPost: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const postId = String(formData.get('post_id') || '');
    const content = String(formData.get('content') || '').trim();
    const parentCommentId = formData.get('parent_comment_id') ? String(formData.get('parent_comment_id')) : null;

    const postResult = await executeYugabyteSql<{ scan_id: string }>(
      'SELECT scan_id FROM public.scan_mural_posts WHERE id = $1 LIMIT 1',
      [postId], platform?.env
    );
    const scanId = postResult.rows[0]?.scan_id || '';
    if (!scanId || !postId || !content) {
      return fail(400, { message: 'Comentário inválido' });
    }

    const result = await executeYugabyteSql(
      `INSERT INTO public.scan_mural_comments (scan_id, post_id, author_id, content, parent_comment_id)
       SELECT $1,$2,$3,$4,$5 WHERE EXISTS (
         SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $3
       )`,
      [scanId, postId, locals.user.id, content, parentCommentId], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Você não pertence a esta Scan.' });

    await dispatchScanMentions({
      locals,
      text: content,
      scanId,
      authorId: locals.user.id,
      title: `Novo comentário no Mural`,
      deepLink: `/scan?id=${scanId}&tab=mural&postId=${postId}`,
      contextType: 'MURAL',
      platform
    }).catch(err => console.error('Error dispatching mural comment mentions:', err));

    return { success: true, muralCommentCreated: true };
  },

  reactMuralPost: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = String(formData.get('scan_id') || '');
    const postId = formData.get('post_id') ? String(formData.get('post_id')) : null;
    const commentId = formData.get('comment_id') ? String(formData.get('comment_id')) : null;
    const emoji = String(formData.get('emoji') || '').trim();

    if (!scanId || !emoji || (!postId && !commentId)) {
      return fail(400, { message: 'Reação inválida' });
    }

    const existingResult = await executeYugabyteSql<{ id: string }>(
      `SELECT id FROM public.scan_mural_reactions
       WHERE scan_id = $1 AND user_id = $2 AND emoji = $3
         AND (($4::uuid IS NOT NULL AND post_id = $4) OR ($5::uuid IS NOT NULL AND comment_id = $5)) LIMIT 1`,
      [scanId, locals.user.id, emoji, postId, commentId], platform?.env
    );
    const existing = existingResult.rows[0] || null;

    if (existing) {
      await executeYugabyteSql('DELETE FROM public.scan_mural_reactions WHERE id = $1', [existing.id], platform?.env);
    } else {
      await executeYugabyteSql(
        `INSERT INTO public.scan_mural_reactions (scan_id, post_id, comment_id, user_id, emoji)
         VALUES ($1,$2,$3,$4,$5)`,
        [scanId, postId, commentId, locals.user.id, emoji], platform?.env
      );
    }

    return { success: true, reacted: true };
  },

  togglePinMuralPost: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const postId = String(formData.get('post_id') || '');

    const postResult = await executeYugabyteSql<{ is_pinned: boolean; scan_id: string }>(
      'SELECT is_pinned, scan_id FROM public.scan_mural_posts WHERE id = $1 LIMIT 1',
      [postId], platform?.env
    );
    const post = postResult.rows[0] || null;
    if (!post) return fail(404, { message: 'Post não encontrado' });

    const newPinned = !post.is_pinned;
    const result = await executeYugabyteSql(
      `UPDATE public.scan_mural_posts post SET is_pinned = $2,
         pinned_at = CASE WHEN $2 THEN now() ELSE NULL END,
         pinned_by = CASE WHEN $2 THEN $3 ELSE NULL END
       WHERE post.id = $1 AND EXISTS (
         SELECT 1 FROM public.scan_members member WHERE member.scan_id = post.scan_id AND member.user_id = $3 AND member.role IN ('OWNER','ADMIN')
       )`,
      [postId, newPinned, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(403, { message: 'Sem permissão para fixar este post.' });
    return { success: true, pinToggled: true };
  },

  deleteMuralPost: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const postId = String(formData.get('post_id') || '');

    const result = await executeYugabyteSql(
      `DELETE FROM public.scan_mural_posts post
       WHERE post.id = $1 AND (post.author_id = $2 OR EXISTS (
         SELECT 1 FROM public.scan_members member WHERE member.scan_id = post.scan_id AND member.user_id = $2 AND member.role IN ('OWNER','ADMIN')
       ))`,
      [postId, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Post inexistente ou sem permissão.' });
    return { success: true, muralPostDeleted: true };
  },

  savePipelineStage: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = String(formData.get('scan_id') || '');
    const stageId = formData.get('stage_id') ? String(formData.get('stage_id')) : null;
    const name = String(formData.get('name') || '').trim();
    const color = String(formData.get('color') || '#8b5cf6').trim();
    const description = String(formData.get('description') || '').trim();
    const required = formData.get('required') === 'true';

    if (!scanId || !name) return fail(400, { message: 'Nome da etapa é obrigatório' });

    const slug = slugify(name);

    if (stageId) {
      const result = await executeYugabyteSql(
        `UPDATE public.scan_workflow_stages stage SET name = $2, color = $3,
           description = $4, required = $5, updated_at = now()
         WHERE stage.id = $1 AND stage.scan_id = $6 AND EXISTS (
           SELECT 1 FROM public.scan_members member WHERE member.scan_id = $6 AND member.user_id = $7 AND member.role IN ('OWNER','ADMIN')
         )`,
        [stageId, name, color, description, required, scanId, locals.user.id], platform?.env
      );
      if (result.rowCount === 0) return fail(404, { message: 'Etapa inexistente ou sem permissão.' });
    } else {
      const result = await executeYugabyteSql(
        `INSERT INTO public.scan_workflow_stages (scan_id, name, slug, color, description, required, display_order)
         SELECT $1,$2,$3,$4,$5,$6,COALESCE((SELECT max(display_order) + 1 FROM public.scan_workflow_stages WHERE scan_id = $1), 1)
         WHERE EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = $1 AND user_id = $7 AND role IN ('OWNER','ADMIN'))`,
        [scanId, name, slug, color, description, required, locals.user.id], platform?.env
      );
      if (result.rowCount === 0) return fail(403, { message: 'Você não pode criar etapas nesta Scan.' });
    }

    return { success: true, stageSaved: true };
  },

  deletePipelineStage: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const stageId = String(formData.get('stage_id') || '');

    const result = await executeYugabyteSql(
      `DELETE FROM public.scan_workflow_stages stage
       WHERE stage.id = $1 AND EXISTS (
         SELECT 1 FROM public.scan_members member WHERE member.scan_id = stage.scan_id AND member.user_id = $2 AND member.role IN ('OWNER','ADMIN')
       )`,
      [stageId, locals.user.id], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Etapa inexistente ou sem permissão.' });
    return { success: true, stageDeleted: true };
  },

  createProductionChapter: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = String(formData.get('scan_id') || '');
    const workId = String(formData.get('work_id') || '');
    const chapterNumber = Number(formData.get('chapter_number'));
    const chapterLabel = formData.get('chapter_label') ? String(formData.get('chapter_label')) : null;
    const chapterType = String(formData.get('chapter_type') || 'NUMBER');
    const template = String(formData.get('template') || 'MANHWA');
    const priority = String(formData.get('priority') || 'NORMAL');
    const autoClaim = formData.get('auto_claim') !== 'false' && formData.get('auto_claim') !== null;

    if (!scanId || !workId || isNaN(chapterNumber)) {
      return fail(400, { message: 'Scan, obra e número do capítulo são obrigatórios.' });
    }

    // Role-gating check: Dono/Gerente have leadership bypass. Staff MUST hold Raw Provider role.
    const { rows: memberRows } = await executeYugabyteSql<{ role: string }>(
      `SELECT role FROM public.scan_members WHERE scan_id = $1 AND user_id = $2 AND COALESCE(hidden_by_admin, false) = false LIMIT 1`,
      [scanId, locals.user.id], platform?.env
    );
    const memberRow = memberRows[0] || null;

    if (!memberRow) {
      return fail(403, { message: 'Acesso não autorizado a esta Scan.' });
    }

    const isLeadership = ['OWNER', 'ADMIN'].includes(memberRow.role);
    if (!isLeadership) {
      const { rows: memberPositions } = await executeYugabyteSql<{ name: string }>(
        `SELECT position.name FROM public.scan_member_positions assignment
         JOIN public.scan_positions position ON position.id = assignment.position_id
         WHERE assignment.scan_id = $1 AND assignment.user_id = $2`,
        [scanId, locals.user.id], platform?.env
      );

      const hasRawRole = (memberPositions || []).some((p: any) => {
        const name = (p.name || '').toLowerCase();
        return name.includes('raw');
      });

      if (!hasRawRole) {
        return fail(403, {
          message: 'Você precisa do cargo Raw Provider para cadastrar novos capítulos ou iniciar a produção de RAW.'
        });
      }
    }

    let chapterId: string;
    try {
      const result = await executeYugabyteSql<{ id: string }>(
        `SELECT public.create_scan_production_chapter_ysql($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS id`,
        [scanId, workId, chapterNumber, chapterLabel, chapterType, template, priority, locals.user.id, locals.role === 'ADMIN', autoClaim], platform?.env
      );
      chapterId = result.rows[0]?.id;
      if (!chapterId) throw new Error('CREATE_PRODUCTION_CHAPTER_EMPTY_RESULT');
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      const expected = /CHAPTER_ALREADY_EXISTS|SCAN_MEMBERSHIP_REQUIRED|RAW_PROVIDER_REQUIRED/.test(detail);
      return fail(expected ? 409 : 503, { message: expected ? 'O capítulo já existe ou você não tem o cargo necessário.' : 'Não foi possível criar o capítulo com segurança agora.' });
    }
    if (platform?.context?.waitUntil) {
      platform.context.waitUntil(processPendingEmailOutbox(20, undefined, platform?.env).catch(() => {}));
    }
    return { success: true, chapterId };
  },

  bulkCreateProductionChapters: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = String(formData.get('scan_id') || '');
    const workId = String(formData.get('work_id') || '');
    const fromNumber = Number(formData.get('from_number'));
    const toNumber = Number(formData.get('to_number'));
    const template = String(formData.get('template') || 'MANHWA');
    const priority = String(formData.get('priority') || 'NORMAL');

    if (!scanId || !workId || isNaN(fromNumber) || isNaN(toNumber)) {
      return fail(400, { message: 'Parâmetros de criação em lote inválidos.' });
    }

    let resultData: any;
    try {
      const result = await executeYugabyteSql<{ result: any }>(
        `SELECT public.bulk_create_scan_production_chapters_ysql($1,$2,$3,$4,$5,$6,$7,$8) AS result`,
        [scanId, workId, fromNumber, toNumber, template, priority, locals.user.id, locals.role === 'ADMIN'], platform?.env
      );
      resultData = result.rows[0]?.result;
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      return fail(/BULK_RANGE_INVALID|SCAN_MEMBERSHIP_REQUIRED|RAW_PROVIDER_REQUIRED/.test(detail) ? 400 : 503, { message: 'Não foi possível criar os capítulos em lote com segurança.' });
    }
    if (platform?.context?.waitUntil) {
      platform.context.waitUntil(processPendingEmailOutbox(20, undefined, platform?.env).catch(() => {}));
    }
    return { success: true, result: resultData };
  },

  claimStage: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const stageId = String(formData.get('chapter_stage_id') || '');
    if (!stageId) return fail(400, { message: 'ID da etapa ausente.' });

    let data: any;
    try {
      const result = await executeYugabyteSql<{ result: any }>(`
        SELECT public.claim_scan_chapter_stage_ysql($1, $2, $3) AS result
      `, [stageId, locals.user.id, locals.role === 'ADMIN'], platform?.env);
      data = result.rows[0]?.result;
      if (!data?.success) throw new Error('YSQL_STAGE_CLAIM_EMPTY_RESULT');
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      console.error('scan_pipeline_stage_claim_ysql_failed', {
        chapterStageId: stageId, actorId: locals.user.id,
        code: typeof error?.code === 'string' ? error.code : null,
        message: detail.slice(0, 240)
      });
      const conflict = /STAGE_ALREADY_CLAIMED/.test(detail);
      const actionable = /CHAPTER_STAGE_NOT_FOUND|SCAN_MEMBERSHIP_REQUIRED|WORKFLOW_STAGE_NOT_FOUND|FINAL_STAGE_NOT_CLAIMABLE|LEADERSHIP_CLAIM_REQUIRED|STAGE_POSITION_REQUIRED/.test(detail);
      return fail(conflict || actionable ? 409 : 503, {
        message: conflict
          ? 'Esta etapa acabou de ser assumida por outro membro. Atualize a página.'
          : actionable
            ? 'A etapa foi alterada ou você não tem o cargo necessário para assumi-la.'
            : 'Não foi possível assumir a etapa com segurança agora. Nenhuma alteração foi aplicada.'
      });
    }
    if (platform?.context?.waitUntil) {
      platform.context.waitUntil(processPendingEmailOutbox(20, undefined, platform?.env).catch(() => {}));
    }
    return { success: true, result: data };
  },

  releaseStage: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const stageId = String(formData.get('chapter_stage_id') || '');
    const reason = formData.get('reason') ? String(formData.get('reason')) : null;
    if (!stageId) return fail(400, { message: 'ID da etapa ausente.' });

    let data: any;
    try {
      const result = await executeYugabyteSql<{ result: any }>(
        `SELECT public.release_scan_chapter_stage_ysql($1, $2, $3, $4) AS result`,
        [stageId, locals.user.id, locals.role === 'ADMIN', reason], platform?.env
      );
      data = result.rows[0]?.result;
      if (!data?.success) throw new Error('YSQL_STAGE_RELEASE_EMPTY_RESULT');
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      console.error('scan_pipeline_stage_release_ysql_failed', {
        chapterStageId: stageId, actorId: locals.user.id,
        code: typeof error?.code === 'string' ? error.code : null,
        message: detail.slice(0, 240)
      });
      const expected = /CHAPTER_STAGE_NOT_FOUND|SCAN_MEMBERSHIP_REQUIRED|STAGE_RELEASE_FORBIDDEN|WORKFLOW_STAGE_NOT_FOUND/.test(detail);
      return fail(expected ? 409 : 503, {
        message: expected
          ? 'A etapa foi alterada ou você não tem mais permissão para liberá-la. Atualize a página.'
          : 'Não foi possível liberar a etapa com segurança agora. Nenhuma alteração foi aplicada.'
      });
    }
    if (platform?.context?.waitUntil) {
      platform.context.waitUntil(processPendingEmailOutbox(20, undefined, platform?.env).catch(() => {}));
    }
    return { success: true, result: data };
  },

  completeStageAction: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const stageId = String(formData.get('chapter_stage_id') || '');
    const notes = formData.get('notes') ? String(formData.get('notes')) : null;
    if (!stageId) return fail(400, { message: 'ID da etapa ausente.' });

    // Completion must share the same YSQL transaction boundary as the
    // multi-file finalizer. The legacy RPC cannot see upload attempts or the
    // complete per-file lineage, which could allow a stage to close while a
    // sibling upload was still pending.
    let data: any;
    try {
      const result = await executeYugabyteSql<{ result: any }>(`
        SELECT public.complete_scan_chapter_stage_ysql($1, $2, $3, $4) AS result
      `, [stageId, locals.user.id, locals.role === 'ADMIN', notes], platform?.env);
      data = result.rows[0]?.result;
      if (!data?.success) throw new Error('YSQL_STAGE_COMPLETION_EMPTY_RESULT');
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      console.error('scan_pipeline_stage_completion_ysql_failed', {
        chapterStageId: stageId,
        code: typeof error?.code === 'string' ? error.code : null,
        message: detail.slice(0, 240)
      });
      const actionable = /CHAPTER_STAGE_NOT_FOUND|SCAN_MEMBERSHIP_REQUIRED|STAGE_COMPLETION_NOT_ALLOWED|WORKFLOW_STAGE_NOT_FOUND|UPLOADS_PENDING|STAGE_OUTPUT_REQUIRED/.test(detail);
      return fail(actionable ? 409 : 503, {
        message: detail.includes('UPLOADS_PENDING')
          ? 'Aguarde os uploads pendentes terminarem ou corrija os arquivos que falharam.'
          : detail.includes('STAGE_OUTPUT_REQUIRED')
            ? 'Envie pelo menos um arquivo válido antes de concluir esta etapa.'
            : actionable
              ? 'A etapa foi alterada ou você não tem mais permissão para concluí-la. Atualize a página.'
              : 'Não foi possível concluir a etapa com segurança agora. Nenhuma alteração foi aplicada.'
      });
    }
    if (platform?.context?.waitUntil) {
      platform.context.waitUntil(processPendingEmailOutbox(20, undefined, platform?.env).catch(() => {}));
    }
    return { success: true, result: data };
  },

  returnStageAction: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const sourceStageId = String(formData.get('source_stage_id') || '');
    const targetStageSlug = String(formData.get('target_stage_slug') || '');
    const reason = String(formData.get('reason') || '').trim();

    if (!sourceStageId || !targetStageSlug || reason.length < 3) {
      return fail(400, { message: 'Etapa de origem, destino e motivo (mín. 3 caracteres) são obrigatórios.' });
    }

    let data: any;
    try {
      const result = await executeYugabyteSql<{ result: any }>(
        `SELECT public.return_scan_chapter_stage_ysql($1, $2, $3, $4, $5) AS result`,
        [sourceStageId, locals.user.id, locals.role === 'ADMIN', targetStageSlug, reason], platform?.env
      );
      data = result.rows[0]?.result;
      if (!data?.success) throw new Error('YSQL_STAGE_REWORK_EMPTY_RESULT');
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      console.error('scan_pipeline_stage_rework_ysql_failed', {
        sourceStageId, actorId: locals.user.id,
        code: typeof error?.code === 'string' ? error.code : null,
        message: detail.slice(0, 240)
      });
      const expected = /CHAPTER_STAGE_NOT_FOUND|SCAN_MEMBERSHIP_REQUIRED|REWORK_(REASON_REQUIRED|TARGET_NOT_FOUND)|WORKFLOW_STAGE_NOT_FOUND/.test(detail);
      return fail(expected ? 409 : 503, {
        message: expected
          ? 'A etapa de destino foi alterada ou você não tem mais permissão. Atualize a página.'
          : 'Não foi possível solicitar retrabalho com segurança agora. Nenhuma alteração foi aplicada.'
      });
    }
    if (platform?.context?.waitUntil) {
      platform.context.waitUntil(processPendingEmailOutbox(20, undefined, platform?.env).catch(() => {}));
    }
    return { success: true, result: data };
  },

  adminOverrideStage: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const stageId = String(formData.get('chapter_stage_id') || '');
    const action = String(formData.get('override_action') || '');
    const reason = String(formData.get('reason') || '').trim();
    const targetUserId = formData.get('target_user_id') ? String(formData.get('target_user_id')) : null;

    if (!stageId || !action || reason.length < 3) {
      return fail(400, { message: 'Etapa, ação e justificativa (mín. 3 caracteres) são obrigatórios.' });
    }

    let data: any;
    try {
      const result = await executeYugabyteSql<{ result: any }>(
        `SELECT public.admin_override_scan_stage_ysql($1, $2, $3, $4, $5, $6) AS result`,
        [stageId, locals.user.id, locals.role === 'ADMIN', action, reason, targetUserId], platform?.env
      );
      data = result.rows[0]?.result;
      if (!data?.success) throw new Error('YSQL_STAGE_OVERRIDE_EMPTY_RESULT');
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      console.error('scan_pipeline_stage_override_ysql_failed', {
        chapterStageId: stageId, actorId: locals.user.id,
        code: typeof error?.code === 'string' ? error.code : null,
        message: detail.slice(0, 240)
      });
      const expected = /CHAPTER_STAGE_NOT_FOUND|STAGE_OVERRIDE_FORBIDDEN|OVERRIDE_(ACTION_INVALID|REASON_REQUIRED|TRANSFER_TARGET_REQUIRED|TRANSFER_TARGET_NOT_MEMBER)|WORKFLOW_STAGE_NOT_FOUND/.test(detail);
      return fail(expected ? 409 : 503, {
        message: expected
          ? 'A etapa, o membro de destino ou sua permissão mudou. Atualize a página.'
          : 'Não foi possível aplicar o override com segurança agora. Nenhuma alteração foi aplicada.'
      });
    }
    if (platform?.context?.waitUntil) {
      platform.context.waitUntil(processPendingEmailOutbox(20, undefined, platform?.env).catch(() => {}));
    }
    return { success: true, result: data };
  },

  createChapterNote: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = String(formData.get('scan_id') || '');
    const productionChapterId = String(formData.get('production_chapter_id') || '');
    const stageId = formData.get('stage_id') ? String(formData.get('stage_id')) : null;
    const body = String(formData.get('body') || '').trim();
    const kind = String(formData.get('kind') || 'NORMAL').toUpperCase();
    if (!scanId || !productionChapterId || !body) return fail(400, { message: 'Escreva uma observação para o capítulo.' });
    try {
      const result = await executeYugabyteSql<{ result: any }>(
        'SELECT public.create_scan_chapter_note_ysql($1, $2, $3, $4, $5, $6, $7) AS result',
        [scanId, productionChapterId, locals.user.id, locals.role === 'ADMIN', stageId, body, kind], platform?.env
      );
      return { success: true, chapterNote: result.rows[0]?.result };
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      console.error('scan_chapter_note_create_ysql_failed', { scanId, productionChapterId, actorId: locals.user.id, message: detail.slice(0, 240) });
      const expected = /CHAPTER_NOTE_(BODY_INVALID|KIND_INVALID|STAGE_INVALID)|PRODUCTION_CHAPTER_NOT_FOUND|SCAN_MEMBERSHIP_REQUIRED/.test(detail);
      return fail(expected ? 409 : 503, { message: expected ? 'O capítulo, etapa ou sua permissão mudou. Atualize a página.' : 'Não foi possível salvar a observação com segurança agora.' });
    }
  },

  editChapterNote: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const noteId = String(formData.get('note_id') || '');
    const body = String(formData.get('body') || '').trim();
    const kind = String(formData.get('kind') || '').toUpperCase() || null;
    if (!noteId || !body) return fail(400, { message: 'A observação não pode ficar vazia.' });
    try {
      const result = await executeYugabyteSql<{ result: any }>(
        'SELECT public.edit_scan_chapter_note_ysql($1, $2, $3, $4, $5) AS result',
        [noteId, locals.user.id, locals.role === 'ADMIN', body, kind], platform?.env
      );
      return { success: true, chapterNote: result.rows[0]?.result };
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      console.error('scan_chapter_note_edit_ysql_failed', { noteId, actorId: locals.user.id, message: detail.slice(0, 240) });
      const expected = /CHAPTER_NOTE_(NOT_FOUND|BODY_INVALID|KIND_INVALID|EDIT_FORBIDDEN)|SCAN_MEMBERSHIP_REQUIRED/.test(detail);
      return fail(expected ? 409 : 503, { message: expected ? 'A observação foi alterada ou você não pode editá-la. Atualize a página.' : 'Não foi possível editar a observação com segurança agora.' });
    }
  },

  deleteChapterNote: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const noteId = String(formData.get('note_id') || '');
    if (!noteId) return fail(400, { message: 'Observação ausente.' });
    try {
      const result = await executeYugabyteSql<{ result: any }>(
        'SELECT public.delete_scan_chapter_note_ysql($1, $2, $3) AS result',
        [noteId, locals.user.id, locals.role === 'ADMIN'], platform?.env
      );
      return { success: true, chapterNote: result.rows[0]?.result };
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      console.error('scan_chapter_note_delete_ysql_failed', { noteId, actorId: locals.user.id, message: detail.slice(0, 240) });
      const expected = /CHAPTER_NOTE_(NOT_FOUND|DELETE_FORBIDDEN)|SCAN_MEMBERSHIP_REQUIRED/.test(detail);
      return fail(expected ? 409 : 503, { message: expected ? 'A observação foi alterada ou você não pode removê-la. Atualize a página.' : 'Não foi possível remover a observação com segurança agora.' });
    }
  },

  pinChapterNote: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const noteId = String(formData.get('note_id') || '');
    const pinned = String(formData.get('pinned') || '') === 'true';
    if (!noteId) return fail(400, { message: 'Observação ausente.' });
    try {
      const result = await executeYugabyteSql<{ result: any }>(
        'SELECT public.pin_scan_chapter_note_ysql($1, $2, $3, $4) AS result',
        [noteId, locals.user.id, locals.role === 'ADMIN', pinned], platform?.env
      );
      return { success: true, chapterNote: result.rows[0]?.result };
    } catch (error: any) {
      const detail = String(error?.message || 'unknown');
      console.error('scan_chapter_note_pin_ysql_failed', { noteId, actorId: locals.user.id, message: detail.slice(0, 240) });
      const expected = /CHAPTER_NOTE_(NOT_FOUND|PIN_FORBIDDEN)|SCAN_MEMBERSHIP_REQUIRED/.test(detail);
      return fail(expected ? 409 : 503, { message: expected ? 'A observação foi alterada ou você não pode fixá-la. Atualize a página.' : 'Não foi possível atualizar o destaque com segurança agora.' });
    }
  },

  publishProductionChapter: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const productionChapterId = String(formData.get('production_chapter_id') || '');
    if (!productionChapterId) return fail(400, { message: 'ID do capítulo ausente.' });

    let data: any;
    try {
      const result = await executeYugabyteSql<{ result: any }>(
        `SELECT public.publish_scan_production_chapter_ysql($1,$2,$3) AS result`,
        [productionChapterId, locals.user.id, locals.role === 'ADMIN'], platform?.env
      );
      data = result.rows[0]?.result;
    } catch {
      return fail(503, { message: 'Não foi possível publicar o capítulo com segurança agora.' });
    }
    if (platform?.context?.waitUntil) {
      platform.context.waitUntil(processPendingEmailOutbox(20, undefined, platform?.env).catch(() => {}));
    }
    return { success: true, result: data };
  },

  unpublishProductionChapter: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const productionChapterId = String(formData.get('production_chapter_id') || '');
    const reason = formData.get('reason') ? String(formData.get('reason')) : null;
    if (!productionChapterId) return fail(400, { message: 'ID do capítulo ausente.' });

    let data: any;
    try {
      const result = await executeYugabyteSql<{ result: any }>(
        `SELECT public.unpublish_scan_production_chapter_ysql($1,$2,$3,$4) AS result`,
        [productionChapterId, locals.user.id, locals.role === 'ADMIN', reason], platform?.env
      );
      data = result.rows[0]?.result;
    } catch {
      return fail(503, { message: 'Não foi possível retirar o capítulo do público com segurança agora.' });
    }
    if (platform?.context?.waitUntil) {
      platform.context.waitUntil(processPendingEmailOutbox(20, undefined, platform?.env).catch(() => {}));
    }
    return { success: true, result: data };
  },

  saveWorkWorkflowOverride: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = String(formData.get('scan_id') || '');
    const workId = String(formData.get('work_id') || '');
    const template = String(formData.get('template') || 'MANHWA');
    const customStagesRaw = String(formData.get('custom_stages') || '[]');

    let customStages: unknown[];
    try {
      const parsed = JSON.parse(customStagesRaw);
      customStages = Array.isArray(parsed) ? parsed : [];
    } catch {
      customStages = [];
    }

    try {
      await executeYugabyteSql(
        `INSERT INTO public.scan_work_workflow_overrides (scan_id, work_id, template, custom_stages, updated_at)
         VALUES ($1,$2,$3,$4::jsonb,now())
         ON CONFLICT (scan_id, work_id) DO UPDATE SET template = EXCLUDED.template, custom_stages = EXCLUDED.custom_stages, updated_at = now()`,
        [scanId, workId, template, JSON.stringify(customStages)], platform?.env
      );
    } catch {
      return fail(503, { message: 'Não foi possível salvar o fluxo desta obra agora.' });
    }
    return { success: true, overrideSaved: true };
  },

  deleteProductionChapter: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const productionChapterId = String(formData.get('production_chapter_id') || '');
    const confirmation = String(formData.get('confirmation') || '');
    const reason = formData.get('reason') ? String(formData.get('reason')) : 'Produção de teste/QA removida';

    if (!productionChapterId || !confirmation) {
      return fail(400, { message: 'ID da produção e confirmação são obrigatórios.' });
    }

    let data: any;
    try {
      const result = await executeYugabyteSql<{ result: any }>(
        `SELECT public.delete_scan_production_chapter_ysql($1,$2,$3,$4,$5) AS result`,
        [productionChapterId, confirmation, reason, locals.user.id, locals.role === 'ADMIN'], platform?.env
      );
      data = result.rows[0]?.result;
    } catch {
      return fail(409, { message: 'O capítulo não pôde ser excluído: confirme os dados e sua permissão.' });
    }
    return { success: true, result: data };
  },

  updateProductionChapter: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const productionChapterId = String(formData.get('production_chapter_id') || '');
    const chapterLabel = formData.has('chapter_label') ? String(formData.get('chapter_label')).trim() : null;
    const priority = formData.has('priority') ? String(formData.get('priority')).trim().toUpperCase() : null;
    const notes = formData.has('notes') ? String(formData.get('notes')).trim() : null;

    if (!productionChapterId) {
      return fail(400, { message: 'ID da produção é obrigatório.' });
    }

    const { rows: prodRows } = await executeYugabyteSql<{ id: string; scan_id: string; status: string }>(
      `SELECT id, scan_id, status FROM public.scan_production_chapters WHERE id = $1 LIMIT 1`,
      [productionChapterId], platform?.env
    );
    const prodCh = prodRows[0] || null;

    if (!prodCh) {
      return fail(404, { message: 'Capítulo de produção não encontrado.' });
    }

    const { rows: memberRows } = await executeYugabyteSql<{ role: string }>(
      `SELECT role FROM public.scan_members WHERE scan_id = $1 AND user_id = $2 LIMIT 1`,
      [prodCh.scan_id, locals.user.id], platform?.env
    );
    const memberRow = memberRows[0] || null;

    const isPrivileged = memberRow && ['OWNER', 'ADMIN'].includes(memberRow.role);
    if (!isPrivileged) {
      return fail(403, { message: 'Permissão negada. Apenas Administradores e Donos podem editar detalhes da produção.' });
    }

    await executeYugabyteSql(
      `UPDATE public.scan_production_chapters SET
         chapter_label = COALESCE($2, chapter_label),
         priority = CASE WHEN $3::text IN ('LOW','NORMAL','HIGH','URGENT') THEN $3 ELSE priority END,
         updated_at = now()
       WHERE id = $1`,
      [productionChapterId, chapterLabel, priority], platform?.env
    );

    if (notes !== null) {
      await executeYugabyteSql(
        `UPDATE public.scan_chapter_stages SET notes = $2, updated_at = now()
         WHERE production_chapter_id = $1 AND status IN ('AVAILABLE','IN_PROGRESS','REWORK')`,
        [productionChapterId, notes || null], platform?.env
      );
    }

    return { success: true, chapterUpdated: true };
  },

  deleteOpening: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = String(formData.get('scan_id') || '');
    const openingId = String(formData.get('opening_id') || '');

    if (!scanId || !openingId) {
      return fail(400, { message: 'Dados insuficientes para excluir vaga.' });
    }

    const { rows: memberRows } = await executeYugabyteSql<{ role: string }>(
      `SELECT role FROM public.scan_members WHERE scan_id = $1 AND user_id = $2 LIMIT 1`,
      [scanId, locals.user.id], platform?.env
    );
    const memberRow = memberRows[0] || null;

    if (!memberRow || !['OWNER', 'ADMIN'].includes(memberRow.role)) {
      return fail(403, { message: 'Apenas Administradores ou Donos podem excluir vagas de recrutamento.' });
    }

    const result = await executeYugabyteSql(
      `DELETE FROM public.scan_recruitment_openings WHERE id = $1 AND scan_id = $2`,
      [openingId, scanId], platform?.env
    );
    if (result.rowCount === 0) return fail(404, { message: 'Vaga não encontrada.' });
    return { success: true, openingDeleted: true };
  },

  reorderChannels: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = String(formData.get('scan_id') || '');
    const ordersRaw = String(formData.get('orders') || '');

    if (!scanId || !ordersRaw) {
      return fail(400, { message: 'Dados inválidos para reordenar canais.' });
    }

    const { rows: memberRows } = await executeYugabyteSql<{ role: string }>(
      `SELECT role FROM public.scan_members WHERE scan_id = $1 AND user_id = $2 LIMIT 1`,
      [scanId, locals.user.id], platform?.env
    );
    const memberRow = memberRows[0] || null;

    if (!memberRow || !['OWNER', 'ADMIN'].includes(memberRow.role)) {
      return fail(403, { message: 'Apenas Administradores ou Donos podem reordenar os canais.' });
    }

    try {
      const orders: Array<{ id: string; display_order: number }> = JSON.parse(ordersRaw);
      for (const item of orders) {
        await executeYugabyteSql(
          `UPDATE public.scan_channels SET display_order = $3 WHERE id = $1 AND scan_id = $2`,
          [item.id, scanId, item.display_order], platform?.env
        );
      }
      return { success: true, channelsReordered: true };
    } catch (e: any) {
      return fail(400, { message: e.message || 'Erro ao processar ordens dos canais.' });
    }
  }
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
