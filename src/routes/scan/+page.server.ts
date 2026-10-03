import { fail, redirect } from '@sveltejs/kit';
import { WORK_FIELDS } from '$lib/server/db';
import { dispatchMentions } from '$lib/server/mentions';
import { createNotification, processPendingEmailOutbox } from '$lib/server/notifications';
import { withTimeout } from '$lib/server/resilience';
import { executeYugabyteSql } from '$lib/server/yugabyte';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
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

  const memberRowsRes = await withTimeout(
    locals.db
      .from('scan_members')
      .select(`
        role,
        scan_id,
        scans!inner(*)
      `)
      .eq('user_id', locals.user.id),
    2000,
    { data: [] } as any,
    'scan_member_rows'
  );

  let memberRows = memberRowsRes?.data || [];
  if (memberRows.length === 0 && locals.sessionCache?.userScans?.length) {
    memberRows = locals.sessionCache.userScans.map((us: any) => ({
      role: us.role,
      scan_id: us.scan_id,
      scans: us.scans
    }));
  }

  if (!memberRows || memberRows.length === 0) {
    const [partnerRequestsRes, incomingTransferRes] = await Promise.all([
      locals.db
        .from('scan_partner_requests')
        .select('*')
        .eq('user_id', locals.user.id)
        .order('created_at', { ascending: false }),
      locals.db
        .from('scan_transfer_requests')
        .select(`
          *,
          scans(id, name, slug),
          from_user:from_user_id(id, username, display_name)
        `)
        .eq('to_user_id', locals.user.id)
        .eq('status', 'PENDING')
        .maybeSingle()
    ]);

    return {
      authenticated: true,
      isMember: false,
      userId: locals.user.id,
      myScans: [],
      partnerRequests: partnerRequestsRes.data || [],
      incomingTransfer: incomingTransferRes.data || null,
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
  // unrelated backoffice widgets before the pipeline can render. The retired
  // PostgREST reads remain an availability fallback below, never the primary
  // source for this state.
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

  // Chat is a high-frequency workspace surface, so its read model follows the
  // same YSQL-first pattern as the editorial graph. Realtime remains in the
  // browser for now; replacing it requires an equivalent event transport, not
  // a polling regression.
  const chatSnapshotPromise = withTimeout(
    Promise.all([
      executeYugabyteSql<any>(`
        SELECT channel.*
        FROM public.scan_channels channel
        WHERE channel.scan_id = $1
        ORDER BY channel.display_order ASC
      `, [currentScan.id], platform?.env),
      executeYugabyteSql<any>(`
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
        FROM public.scan_messages message
        LEFT JOIN public.members author ON author.id = message.user_id
        LEFT JOIN public.scan_messages reply ON reply.id = message.reply_to_id
        LEFT JOIN public.members reply_author ON reply_author.id = reply.user_id
        WHERE message.scan_id = $1
        ORDER BY message.created_at ASC
        LIMIT 150
      `, [currentScan.id], platform?.env),
      executeYugabyteSql<any>(`
        SELECT read_state.*
        FROM public.scan_channel_read_states read_state
        WHERE read_state.scan_id = $1 AND read_state.user_id = $2
      `, [currentScan.id, locals.user.id], platform?.env)
    ]),
    3_500,
    null,
    'scan_chat_snapshot_ysql'
  );

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

  // Knowledge is a read-heavy workspace surface. Keep the three collections
  // on the YSQL data plane while preserving a single bounded fallback so a
  // transient database-path issue cannot mix stale and fresh documents.
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
    notificationsRes,
    notificationPrefsRes,
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
    locals.db
      .from('work_scans')
      .select(`
        is_primary,
        status,
        created_at,
        works!inner(${WORK_FIELDS})
      `)
      .eq('scan_id', currentScan.id),
    locals.db
      .from('chapter_scans')
      .select(`
        created_at,
        chapters!inner(
          id,
          number,
          title,
          published_at,
          views_total,
          works!inner(id, title, slug)
        )
      `)
      .eq('scan_id', currentScan.id)
      .order('created_at', { ascending: false })
      .limit(20),
    locals.db
      .from('scan_members')
      .select(`
        user_id,
        role,
        is_public,
        hidden_by_admin,
        availability_status,
        availability_message,
        availability_updated_at,
        created_at,
        members!inner(
          id,
          username,
          display_name,
          avatar_id,
          xp
        )
      `)
      .eq('scan_id', currentScan.id),
    locals.db
      .from('scan_invites')
      .select('*')
      .eq('scan_id', currentScan.id)
      .eq('revoked', false)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
    locals.db
      .from('scan_project_requests')
      .select(`
        *,
        works!inner(id, title, slug, cover_id)
      `)
      .eq('scan_id', currentScan.id)
      .order('created_at', { ascending: false }),
    locals.db
      .from('works')
      .select('id, title, slug, cover_id')
      .eq('published', true)
      .order('title')
      .limit(100),
    locals.db
      .from('scan_transfer_requests')
      .select(`
        *,
        from_user:from_user_id(id, username, display_name),
        to_user:to_user_id(id, username, display_name)
      `)
      .eq('scan_id', currentScan.id)
      .order('created_at', { ascending: false }),
    locals.db
      .from('scan_transfer_requests')
      .select(`
        *,
        scans(id, name, slug),
        from_user:from_user_id(id, username, display_name)
      `)
      .eq('to_user_id', locals.user.id)
      .eq('status', 'PENDING')
      .maybeSingle(),
    // Recruitment is loaded from the YSQL snapshot below. Keep its legacy
    // reads out of the healthy request path.
    Promise.resolve({ data: [] }),
    Promise.resolve({ data: [] }),
    Promise.resolve({ data: [] }),
    locals.db
      .from('scan_activity')
      .select(`
        *,
        members:user_id(id, username, display_name, avatar_id)
      `)
      .eq('scan_id', currentScan.id)
      .order('created_at', { ascending: false })
      .limit(50),
    locals.db
      .from('scan_member_positions')
      .select(`
        user_id,
        position_id,
        is_primary,
        is_public,
        hidden_by_admin,
        scan_positions!inner(id, name, description, icon, display_order)
      `)
      .eq('scan_id', currentScan.id),
    locals.db
      .from('scan_staff_notes')
      .select(`
        id,
        scan_id,
        user_id,
        parent_id,
        body,
        is_pinned,
        created_at,
        updated_at,
        members:user_id(
          id,
          username,
          display_name,
          avatar_id,
          avatar_frame_id,
          name_color
        )
      `)
      .eq('scan_id', currentScan.id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false }),
    Promise.resolve({ data: [] }),
    Promise.resolve({ data: [] }),
    // Task reads are served by the YSQL snapshot above. This placeholder
    // preserves the batch's index layout for the incremental migration.
    Promise.resolve({ data: [] }),
    // YSQL knowledge snapshot is started above. These placeholders preserve
    // the batch shape; legacy reads run only in the explicit fallback below.
    Promise.resolve({ data: [] }),
    Promise.resolve({ data: [] }),
    Promise.resolve({ data: [] }),
    locals.db
      .from('scan_integrations')
      .select('*')
      .eq('scan_id', currentScan.id)
      .order('created_at', { ascending: false }),
    locals.db
      .from('scan_work_uploaders')
      .select(`
        *,
        members:user_id(id, username, display_name),
        works:work_id(id, title)
      `)
      .eq('scan_id', currentScan.id),
    Promise.resolve({ data: [] }),
    // YSQL chat snapshot is started above. Retired reads are only used by the
    // explicit availability fallback below if that snapshot is unavailable.
    Promise.resolve({ data: [] }),
    Promise.resolve({ data: [] }),
    locals.db
      .from('scan_notifications')
      .select('*')
      .eq('scan_id', currentScan.id)
      .eq('user_id', locals.user.id)
      .order('created_at', { ascending: false })
      .limit(50),
    locals.db
      .from('scan_notification_preferences')
      .select('*')
      .eq('scan_id', currentScan.id)
      .eq('user_id', locals.user.id)
      .maybeSingle(),
    locals.db
      .from('scan_academy_tutorials')
      .select('*')
      .eq('scan_id', currentScan.id)
      .order('display_order', { ascending: true }),
    locals.db
      .from('scan_chapter_qc_issues')
      .select('*, assignee:assigned_to(id, username, display_name, avatar_id), creator:created_by(id, username, display_name)')
      .eq('scan_id', currentScan.id)
      .order('created_at', { ascending: false }),
    Promise.resolve({ data: [] }),
    locals.db
      .from('scan_pipeline_templates')
      .select('*'),
    locals.db
      .from('scan_mural_posts')
      .select('*, author:author_id(id, username, display_name, avatar_id)')
      .eq('scan_id', currentScan.id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false }),
    locals.db
      .from('scan_mural_comments')
      .select('*, author:author_id(id, username, display_name, avatar_id)')
      .eq('scan_id', currentScan.id)
      .order('created_at', { ascending: true }),
    locals.db
      .from('scan_mural_reactions')
      .select('*')
      .eq('scan_id', currentScan.id),
    locals.db
      .from('scan_attachments')
      .select('*')
      .eq('scan_id', currentScan.id)
      .order('created_at', { ascending: true }),
    locals.db
      .from('scan_production_files')
      .select('*, uploader:uploaded_by(id, username, display_name, avatar_id), stage:stage_id(id, name, slug)')
      .eq('scan_id', currentScan.id)
      .order('version', { ascending: false }),
    Promise.resolve({ data: [] }),
    locals.db
      .from('scan_work_workflow_overrides')
      .select('*')
      .eq('scan_id', currentScan.id),
    locals.db
      .from('chapter_credit_snapshots')
      .select('*')
      .eq('scan_id', currentScan.id)
      .order('role_order', { ascending: true }),
    Promise.resolve({ data: [] }),
    Promise.resolve({ data: [] }),
    locals.db
      .from('scan_pipeline_stage_seen')
      .select('chapter_stage_id, availability_version, seen_at')
      .eq('scan_id', currentScan.id)
      .eq('user_id', locals.user.id)
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
    console.warn('scan_recruitment_snapshot_ysql_fallback', {
      scanId: currentScan.id,
      message: 'ysql snapshot unavailable'
    });
    const [positionsFallback, openingsFallback, applicationsFallback, questionsFallback, answersFallback] = await withTimeout(
      Promise.all([
        locals.db
          .from('scan_positions')
          .select('*')
          .eq('scan_id', currentScan.id)
          .order('display_order', { ascending: true }),
        locals.db
          .from('scan_recruitment_openings')
          .select(`
            *,
            scan_positions(id, name, description, icon, display_order)
          `)
          .eq('scan_id', currentScan.id)
          .order('created_at', { ascending: false }),
        locals.db
          .from('scan_applications')
          .select(`
            *,
            scan_positions(id, name, description, icon, display_order),
            scan_recruitment_openings(id, title),
            members:user_id(id, username, display_name, avatar_id)
          `)
          .eq('scan_id', currentScan.id)
          .order('created_at', { ascending: false }),
        locals.db
          .from('scan_recruitment_questions')
          .select('*')
          .eq('scan_id', currentScan.id)
          .order('display_order', { ascending: true }),
        locals.db
          .from('scan_application_answers')
          .select(`
            *,
            question:question_id(id, question, question_type, display_order)
          `)
      ]),
      3_500,
      Array.from({ length: 5 }, () => ({ data: [] })) as any,
      'scan_recruitment_snapshot_legacy_fallback'
    );
    positions = positionsFallback.data || [];
    recruitmentOpenings = openingsFallback.data || [];
    applications = applicationsFallback.data || [];
    recruitmentQuestions = questionsFallback.data || [];
    applicationAnswers = answersFallback.data || [];
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

  let tasks: any[];
  const taskSnapshot = await taskSnapshotPromise;
  if (taskSnapshot) {
    tasks = taskSnapshot.rows;
  } else {
    console.warn('scan_task_snapshot_ysql_fallback', {
      scanId: currentScan.id,
      message: 'ysql snapshot unavailable'
    });
    const tasksFallback = await withTimeout(
      locals.db
        .from('scan_tasks')
        .select(`
          *,
          scan_task_comments(
            id,
            task_id,
            content,
            created_at,
            members:user_id(id, username, display_name, avatar_id)
          )
        `)
        .eq('scan_id', currentScan.id)
        .order('created_at', { ascending: false }),
      3_500,
      { data: [] } as any,
      'scan_task_snapshot_legacy_fallback'
    );
    tasks = tasksFallback.data || [];
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
    console.warn('scan_knowledge_snapshot_ysql_fallback', {
      scanId: currentScan.id,
      message: 'ysql snapshot unavailable'
    });
    const [wikiFallback, glossaryFallback, referencesFallback] = await withTimeout(
      Promise.all([
        locals.db
          .from('scan_wiki_pages')
          .select('*')
          .eq('scan_id', currentScan.id)
          .order('is_pinned', { ascending: false })
          .order('title', { ascending: true }),
        locals.db
          .from('work_glossary_entries')
          .select('*')
          .eq('scan_id', currentScan.id)
          .order('source_term', { ascending: true }),
        locals.db
          .from('work_references')
          .select('*')
          .eq('scan_id', currentScan.id)
          .order('created_at', { ascending: false })
      ]),
      3_500,
      Array.from({ length: 3 }, () => ({ data: [] })) as any,
      'scan_knowledge_snapshot_legacy_fallback'
    );
    wikiPages = wikiFallback.data || [];
    glossary = glossaryFallback.data || [];
    references = referencesFallback.data || [];
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
    console.warn('scan_pipeline_files_ysql_fallback', { message: String(error?.message || 'unknown').slice(0, 240) });
  }

  // The workflow graph is the other half of a production delivery. YSQL is
  // primary; the former data plane is queried only if the direct snapshot was
  // unavailable, preserving an explicit availability fallback during the
  // staged migration without paying for both on every healthy request.
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
    console.warn('scan_pipeline_snapshot_ysql_fallback', {
      scanId: currentScan.id,
      message: 'ysql snapshot unavailable'
    });
    const [stagesFallback, chapterStagesFallback, productionChaptersFallback, timelineFallback] = await withTimeout(
      Promise.all([
        locals.db
          .from('scan_workflow_stages')
          .select('*')
          .eq('scan_id', currentScan.id)
          .order('display_order', { ascending: true }),
        locals.db
          .from('scan_chapter_stages')
          .select(`
            *,
            stage:stage_id(id, name, slug, color, display_order, dependencies, dependency_operator, requires_output),
            assignee:assigned_to(id, username, display_name, avatar_id),
            completer:completed_by(id, username, display_name, avatar_id)
          `)
          .eq('scan_id', currentScan.id),
        locals.db
          .from('scan_production_chapters')
          .select('*, work:work_id(id, title, slug, cover_id)')
          .eq('scan_id', currentScan.id)
          .order('chapter_sort_key', { ascending: true }),
        locals.db
          .from('scan_chapter_timeline')
          .select('*')
          .eq('scan_id', currentScan.id)
          .order('created_at', { ascending: false })
          .limit(200)
      ]),
      3_500,
      Array.from({ length: 4 }, () => ({ data: [] })) as any,
      'scan_pipeline_snapshot_legacy_fallback'
    );
    workflowStages = stagesFallback.data || [];
    chapterStages = chapterStagesFallback.data || [];
    productionChapters = productionChaptersFallback.data || [];
    chapterTimeline = timelineFallback.data || [];
  }

  // Notes are a separate, editable collaboration stream. They are read from
  // the YSQL data plane rather than the retired PostgREST/RPC path; only the
  // already-authorized Scan member reaches this query.
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

  // Do not pay for PostgREST chat reads when YSQL is healthy. The fallback is
  // deliberately all-or-nothing so channels, messages and read markers stay
  // from the same data plane on a degraded request.
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
    console.warn('scan_chat_snapshot_ysql_fallback', {
      scanId: currentScan.id,
      message: 'ysql snapshot unavailable'
    });
    const [channelsFallback, messagesFallback, readStatesFallback] = await withTimeout(
      Promise.all([
        locals.db
          .from('scan_channels')
          .select('*')
          .eq('scan_id', currentScan.id)
          .order('display_order', { ascending: true }),
        locals.db
          .from('scan_messages')
          .select(`
            *,
            user:user_id(id, username, display_name, avatar_id),
            reply_to:reply_to_id(id, content, deleted_at, user:user_id(id, username, display_name)),
            reactions:scan_message_reactions(id, emoji, user_id)
          `)
          .eq('scan_id', currentScan.id)
          .order('created_at', { ascending: true })
          .limit(150),
        locals.db
          .from('scan_channel_read_states')
          .select('*')
          .eq('scan_id', currentScan.id)
          .eq('user_id', locals.user.id)
      ]),
      3_500,
      Array.from({ length: 3 }, () => ({ data: [] })) as any,
      'scan_chat_snapshot_legacy_fallback'
    );
    chatChannels = channelsFallback.data || [];
    chatMessages = messagesFallback.data || [];
    channelReadStates = readStatesFallback.data || [];
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
    notifications: notificationsRes.data || [],
    notificationPrefs: notificationPrefsRes.data || null,
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
  updateProfile: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const description = (formData.get('description') as string)?.trim() || '';
    const discord = (formData.get('discord') as string)?.trim() || '';
    const website = (formData.get('website') as string)?.trim() || '';
    const rawPrep = (formData.get('display_preposition') as string)?.trim() || 'de';
    const displayPreposition = ['de', 'da', 'do'].includes(rawPrep) ? rawPrep : 'de';

    const { data: memberRow } = await locals.db
      .from('scan_members')
      .select('role')
      .eq('scan_id', scanId)
      .eq('user_id', locals.user.id)
      .maybeSingle();

    if (!memberRow || !['OWNER', 'ADMIN'].includes(memberRow.role)) {
      return fail(403, { message: 'Permissão negada. Apenas Líderes ou Administradores podem editar as informações da scan.' });
    }

    const { error } = await locals.db
      .from('scans')
      .update({
        description: description.slice(0, 2000),
        discord: discord.slice(0, 255),
        website: website.slice(0, 255),
        display_preposition: displayPreposition,
        updated_at: new Date().toISOString()
      })
      .eq('id', scanId);

    if (error) return fail(400, { message: error.message });
    return { success: true, profileUpdated: true };
  },

  updateScanBranding: async ({ request, locals }) => {
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

    const { data: memberRow } = await locals.db
      .from('scan_members')
      .select('role')
      .eq('scan_id', scanId)
      .eq('user_id', locals.user.id)
      .maybeSingle();

    if (!memberRow || !['OWNER', 'ADMIN'].includes(memberRow.role)) {
      if (locals.role !== 'ADMIN') {
        return fail(403, { message: 'Apenas Líderes ou Administradores da scan podem editar o perfil e identidade visual.' });
      }
    }

    const updates: Record<string, any> = {
      description: description.slice(0, 2000),
      bio: bio.slice(0, 500),
      discord: discord.slice(0, 255),
      fluxer: fluxer.slice(0, 255),
      website: website.slice(0, 255),
      display_preposition: displayPreposition,
      updated_at: new Date().toISOString()
    };

    if (name) updates.name = name.slice(0, 100);
    if (logoId !== null && logoId !== undefined) updates.logo_id = logoId.trim() ? logoId.trim() : null;
    if (bannerId !== null && bannerId !== undefined) updates.banner_id = bannerId.trim() ? bannerId.trim() : null;

    const { error } = await locals.db
      .from('scans')
      .update(updates)
      .eq('id', scanId);

    if (error) return fail(400, { message: error.message });
    return { success: true, brandingUpdated: true };
  },

  removeScanLogo: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;

    const { data: memberRow } = await locals.db
      .from('scan_members')
      .select('role')
      .eq('scan_id', scanId)
      .eq('user_id', locals.user.id)
      .maybeSingle();

    if (!memberRow || !['OWNER', 'ADMIN'].includes(memberRow.role)) {
      if (locals.role !== 'ADMIN') return fail(403, { message: 'Permissão negada.' });
    }

    const { error } = await locals.db.from('scans').update({ logo_id: null, updated_at: new Date().toISOString() }).eq('id', scanId);
    if (error) return fail(400, { message: error.message });
    return { success: true, logoRemoved: true };
  },

  removeScanBanner: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;

    const { data: memberRow } = await locals.db
      .from('scan_members')
      .select('role')
      .eq('scan_id', scanId)
      .eq('user_id', locals.user.id)
      .maybeSingle();

    if (!memberRow || !['OWNER', 'ADMIN'].includes(memberRow.role)) {
      if (locals.role !== 'ADMIN') return fail(403, { message: 'Permissão negada.' });
    }

    const { error } = await locals.db.from('scans').update({ banner_id: null, updated_at: new Date().toISOString() }).eq('id', scanId);
    if (error) return fail(400, { message: error.message });
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

  requestPartner: async ({ request, locals }) => {
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

    const { error: insErr } = await locals.db
      .from('scan_partner_requests')
      .insert({
        user_id: locals.user.id,
        scan_name: scanName,
        scan_slug: scanSlug,
        description,
        discord,
        fluxer,
        website,
        sample_links: sampleLinks
      });

    if (insErr) return fail(400, { message: insErr.message });
    return { success: true, partnerRequested: true };
  },

  createInvite: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const role = (formData.get('role') as string) || 'MEMBER';
    const hours = parseInt(formData.get('hours') as string) || 24;

    const { data, error: rpcErr } = await locals.db.rpc('create_scan_invite', {
      p_scan_id: scanId,
      p_role: role,
      p_hours: hours
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, createdInvite: data };
  },

  revokeInvite: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const inviteId = formData.get('invite_id') as string;
    const scanId = formData.get('scan_id') as string;

    const { data: memberRow } = await locals.db
      .from('scan_members')
      .select('role')
      .eq('scan_id', scanId)
      .eq('user_id', locals.user.id)
      .maybeSingle();

    if (!memberRow || !['OWNER', 'ADMIN'].includes(memberRow.role)) {
      return fail(403, { message: 'Permissão negada para revogar convites.' });
    }

    const { error: updErr } = await locals.db
      .from('scan_invites')
      .update({ revoked: true })
      .eq('id', inviteId);

    if (updErr) return fail(400, { message: updErr.message });
    return { success: true, revoked: true };
  },

  manageScanMember: async ({ request, locals }) => {
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

    const { error: rpcErr } = await locals.db.rpc('manage_scan_member', {
      p_scan_id: scanId,
      p_target_user_id: targetUserId,
      p_new_role: role || null,
      p_position_ids: positionIds,
      p_confirm_last_manager: confirmLastManager
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    if (data && !data.success && data.requires_confirmation) {
      return { success: false, requiresConfirmation: true, warning: data.warning };
    }
    return { success: true, memberManaged: true, data };
  },

  updateMemberRole: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const targetUserId = formData.get('user_id') as string;
    const newRole = formData.get('role') as string;

    const { error: rpcErr } = await locals.db.rpc('manage_scan_member', {
      p_scan_id: scanId,
      p_target_user_id: targetUserId,
      p_new_role: newRole,
      p_position_ids: null,
      p_confirm_last_manager: true
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, memberUpdated: true };
  },

  removeMember: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const targetUserId = formData.get('user_id') as string;
    const resolution = formData.get('resolution') as string | null;

    const { data, error: rpcErr } = await locals.db.rpc('remove_scan_member_safe', {
      p_scan_id: scanId,
      p_target_user_id: targetUserId,
      p_resolution: resolution || null
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    if (data && !data.success && data.has_active_tasks) {
      return fail(400, {
        hasActiveTasks: true,
        activeTasksCount: data.active_tasks_count,
        message: data.message
      });
    }
    return { success: true, memberRemoved: true, tasksReleased: data?.tasks_released || 0 };
  },

  transferOwnership: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const targetUserId = formData.get('target_user_id') as string || formData.get('new_owner_id') as string;

    const { error: rpcErr } = await locals.db.rpc('request_scan_ownership_transfer', {
      p_scan_id: scanId,
      p_target_user_id: targetUserId
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, transferRequested: true };
  },

  respondOwnershipTransfer: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const requestId = formData.get('request_id') as string;
    const accept = formData.get('accept') === 'true';

    const { error: rpcErr } = await locals.db.rpc('respond_scan_ownership_transfer', {
      p_request_id: requestId,
      p_accept: accept
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, transferResponded: true, accepted: accept };
  },

  cancelOwnershipTransfer: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const requestId = formData.get('request_id') as string;

    const { error: rpcErr } = await locals.db.rpc('cancel_scan_transfer_request', {
      p_request_id: requestId
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, transferCancelled: true };
  },

  requestProject: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const workId = formData.get('work_id') as string;
    const message = (formData.get('message') as string)?.trim() || '';

    if (!scanId || !workId) {
      return fail(400, { message: 'Obra é obrigatória.' });
    }

    const { error: insErr } = await locals.db
      .from('scan_project_requests')
      .insert({
        scan_id: scanId,
        work_id: workId,
        user_id: locals.user.id,
        message
      });

    if (insErr) return fail(400, { message: insErr.message });
    return { success: true, projectRequested: true };
  },

  cancelProjectRequest: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const requestId = formData.get('request_id') as string;

    const { error: rpcErr } = await locals.db.rpc('cancel_scan_project_request', {
      p_request_id: requestId
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, projectRequestCancelled: true };
  },

  cancelPartnerRequest: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const requestId = formData.get('request_id') as string;

    const { error: rpcErr } = await locals.db.rpc('cancel_scan_partner_request', {
      p_request_id: requestId
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, partnerRequestCancelled: true };
  },

  updateProjectStatus: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const workId = formData.get('work_id') as string;
    const status = formData.get('status') as string;

    const { error: rpcErr } = await locals.db.rpc('update_work_scan_status', {
      p_scan_id: scanId,
      p_work_id: workId,
      p_status: status
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, projectStatusUpdated: true, newStatus: status };
  },

  managePosition: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const positionId = (formData.get('position_id') as string) || null;
    const name = (formData.get('name') as string)?.trim();
    const description = (formData.get('description') as string)?.trim() || '';
    const displayOrder = parseInt(formData.get('display_order') as string) || 0;
    const isActive = formData.get('is_active') !== 'false';

    if (!name) return fail(400, { message: 'Nome do cargo é obrigatório' });

    const { data, error: rpcErr } = await locals.db.rpc('manage_scan_position', {
      p_scan_id: scanId,
      p_position_id: positionId,
      p_name: name,
      p_description: description,
      p_display_order: displayOrder,
      p_is_active: isActive
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, positionManaged: true, data };
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

        await createNotification({
          recipientUserId: data.applicant_id,
          actorUserId: locals.user.id,
          type: 'APPLICATION_UPDATE',
          title: actionTitle,
          body: notes ? `${actionBody} Observações: ${notes}` : actionBody,
          deepLink: `/me`,
          scanId: data.scan_id,
          priority: 'NORMAL',
          dedupeKey: `app_review:${applicationId}:${action}:${Date.now()}`
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

  postStaffNote: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const body = (formData.get('body') as string)?.trim() || '';
    const parentId = (formData.get('parent_id') as string) || null;
    const isPinned = formData.get('is_pinned') === 'true';

    if (!scanId || !body) return fail(400, { message: 'Mensagem não pode estar vazia.' });

    const { data, error: rpcErr } = await locals.db.rpc('post_scan_staff_note', {
      p_scan_id: scanId,
      p_body: body,
      p_parent_id: parentId,
      p_pinned: isPinned
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, staffNotePosted: true, data };
  },

  deleteStaffNote: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const noteId = formData.get('note_id') as string;

    if (!noteId) return fail(400, { message: 'Nota não informada.' });

    const { error: rpcErr } = await locals.db.rpc('delete_scan_staff_note', {
      p_note_id: noteId
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, staffNoteDeleted: true };
  },

  updateMemberVisibility: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const targetUserId = formData.get('user_id') as string;
    const isPublic = formData.get('is_public') === 'true';

    if (!scanId || !targetUserId) return fail(400, { message: 'Dados insuficientes.' });

    const { error: rpcErr } = await locals.db.rpc('update_scan_member_visibility', {
      p_scan_id: scanId,
      p_user_id: targetUserId,
      p_is_public: isPublic
    });

    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, memberVisibilityUpdated: true, isPublic };
  },

  createTask: async ({ request, locals }) => {
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

    const { error } = await locals.db.from('scan_tasks').insert({
      scan_id: scanId,
      work_id: workId,
      stage_id: stageId,
      title,
      description,
      assigned_to: assignedTo,
      created_by: locals.user.id,
      priority,
      due_at: dueAt ? new Date(dueAt).toISOString() : null
    });

    if (error) return fail(400, { message: error.message });
    return { success: true, taskCreated: true };
  },

  updateTaskStatus: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const taskId = formData.get('task_id') as string;
    const status = formData.get('status') as string;

    if (!taskId || !status) return fail(400, { message: 'Dados insuficientes.' });

    const updates: any = {
      status,
      updated_at: new Date().toISOString()
    };
    if (status === 'DONE') {
      updates.completed_at = new Date().toISOString();
    } else {
      updates.completed_at = null;
    }

    const { error } = await locals.db.from('scan_tasks').update(updates).eq('id', taskId);
    if (error) return fail(400, { message: error.message });
    return { success: true, taskStatusUpdated: true };
  },

  handoffTask: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const taskId = formData.get('task_id') as string;
    const targetUserId = formData.get('target_user_id') as string;
    const reason = (formData.get('reason') as string)?.trim() || null;

    if (!taskId || !targetUserId) return fail(400, { message: 'Membro de destino obrigatório.' });

    const { data: task } = await locals.db.from('scan_tasks').select('assigned_to, scan_id').eq('id', taskId).single();
    if (!task) return fail(404, { message: 'Tarefa não encontrada.' });

    await locals.db.from('scan_tasks').update({ assigned_to: targetUserId, updated_at: new Date().toISOString() }).eq('id', taskId);

    await locals.db.from('scan_task_handoffs').insert({
      task_id: taskId,
      from_user_id: task.assigned_to,
      to_user_id: targetUserId,
      transferred_by: locals.user.id,
      reason
    });

    return { success: true, taskHandoff: true };
  },

  deleteTask: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const taskId = formData.get('task_id') as string;
    if (!taskId) return fail(400, { message: 'ID da tarefa obrigatório.' });

    const { error } = await locals.db.from('scan_tasks').delete().eq('id', taskId);
    if (error) return fail(400, { message: error.message });
    return { success: true, taskDeleted: true };
  },

  createStage: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const name = (formData.get('name') as string)?.trim();
    const color = (formData.get('color') as string)?.trim() || '#6366f1';
    const required = formData.get('required') === 'true';

    if (!scanId || !name) return fail(400, { message: 'Nome da etapa obrigatório.' });

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { error } = await locals.db.from('scan_workflow_stages').insert({
      scan_id: scanId,
      name,
      slug,
      color,
      required
    });
    if (error) return fail(400, { message: error.message });
    return { success: true, stageCreated: true };
  },

  saveGlossaryEntry: async ({ request, locals }) => {
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

    if (entryId) {
      const { error } = await locals.db.from('work_glossary_entries').update({
        work_id: workId,
        source_term: sourceTerm,
        preferred_translation: preferredTranslation,
        category,
        notes,
        updated_by: locals.user.id,
        updated_at: new Date().toISOString()
      }).eq('id', entryId);
      if (error) return fail(400, { message: error.message });
    } else {
      const { error } = await locals.db.from('work_glossary_entries').insert({
        scan_id: scanId,
        work_id: workId,
        source_term: sourceTerm,
        preferred_translation: preferredTranslation,
        category,
        notes,
        created_by: locals.user.id,
        updated_by: locals.user.id
      });
      if (error) return fail(400, { message: error.message });
    }
    return { success: true, glossarySaved: true };
  },

  deleteGlossaryEntry: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const entryId = formData.get('entry_id') as string;
    if (!entryId) return fail(400, { message: 'ID ausente.' });

    const { error } = await locals.db.from('work_glossary_entries').delete().eq('id', entryId);
    if (error) return fail(400, { message: error.message });
    return { success: true, glossaryDeleted: true };
  },

  saveReference: async ({ request, locals }) => {
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

    const { error } = await locals.db.from('work_references').insert({
      scan_id: scanId,
      work_id: workId,
      title,
      ref_type: refType,
      content,
      created_by: locals.user.id
    });
    if (error) return fail(400, { message: error.message });
    return { success: true, referenceSaved: true };
  },

  deleteReference: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const refId = formData.get('ref_id') as string;
    if (!refId) return fail(400, { message: 'ID ausente.' });

    const { error } = await locals.db.from('work_references').delete().eq('id', refId);
    if (error) return fail(400, { message: error.message });
    return { success: true, referenceDeleted: true };
  },

  createWikiPage: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const title = (formData.get('title') as string)?.trim();
    const slug = (formData.get('slug') as string)?.trim() || title?.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const category = (formData.get('category') as string)?.trim() || 'Geral';
    const content = (formData.get('content') as string)?.trim();
    const isPinned = formData.get('is_pinned') === 'true';

    if (!scanId || !title || !content) return fail(400, { message: 'Título e conteúdo obrigatórios.' });

    const { error } = await locals.db.from('scan_wiki_pages').insert({
      scan_id: scanId,
      title,
      slug,
      category,
      content,
      is_pinned: isPinned,
      created_by: locals.user.id,
      updated_by: locals.user.id
    });
    if (error) return fail(400, { message: error.message });
    return { success: true, wikiCreated: true };
  },

  updateWikiPage: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const pageId = formData.get('page_id') as string;
    const title = (formData.get('title') as string)?.trim();
    const category = (formData.get('category') as string)?.trim() || 'Geral';
    const content = (formData.get('content') as string)?.trim();
    const isPinned = formData.get('is_pinned') === 'true';

    if (!pageId || !title || !content) return fail(400, { message: 'Dados incompletos.' });

    const { error } = await locals.db.from('scan_wiki_pages').update({
      title,
      category,
      content,
      is_pinned: isPinned,
      updated_by: locals.user.id,
      updated_at: new Date().toISOString()
    }).eq('id', pageId);
    if (error) return fail(400, { message: error.message });
    return { success: true, wikiUpdated: true };
  },

  deleteWikiPage: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const pageId = formData.get('page_id') as string;
    if (!pageId) return fail(400, { message: 'ID ausente.' });

    const { error } = await locals.db.from('scan_wiki_pages').delete().eq('id', pageId);
    if (error) return fail(400, { message: error.message });
    return { success: true, wikiDeleted: true };
  },

  setMaintenance: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const pauseUploads = formData.get('pause_uploads') === 'on';
    const pauseRecruitment = formData.get('pause_recruitment') === 'on';
    const emergencyMode = formData.get('emergency_mode') === 'on';
    const emergencyReason = (formData.get('emergency_reason') as string)?.trim() || null;

    const { error } = await locals.db.from('scans').update({
      pause_uploads: pauseUploads,
      pause_recruitment: pauseRecruitment,
      emergency_mode: emergencyMode,
      emergency_reason: emergencyReason,
      updated_at: new Date().toISOString()
    }).eq('id', scanId);

    if (error) return fail(400, { message: error.message });
    return { success: true, maintenanceUpdated: true };
  },

  changeSlug: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const newSlug = (formData.get('new_slug') as string)?.trim().toLowerCase();

    if (!scanId || !newSlug) return fail(400, { message: 'Novo slug obrigatório.' });

    const { error: rpcErr } = await locals.db.rpc('change_scan_slug', {
      p_scan_id: scanId,
      p_new_slug: newSlug
    });
    if (rpcErr) return fail(400, { message: rpcErr.message });
    return { success: true, slugChanged: true };
  },

  saveIntegration: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const platform = formData.get('platform') as string;
    const name = (formData.get('name') as string)?.trim();
    const webhookUrl = (formData.get('webhook_url') as string)?.trim();

    if (!scanId || !platform || !name || !webhookUrl) {
      return fail(400, { message: 'Campos obrigatórios ausentes.' });
    }

    const { error } = await locals.db.from('scan_integrations').insert({
      scan_id: scanId,
      platform,
      name,
      webhook_url: webhookUrl
    });
    if (error) return fail(400, { message: error.message });
    return { success: true, integrationSaved: true };
  },

  deleteIntegration: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const integrationId = formData.get('integration_id') as string;
    if (!integrationId) return fail(400, { message: 'ID ausente.' });

    const { error } = await locals.db.from('scan_integrations').delete().eq('id', integrationId);
    if (error) return fail(400, { message: error.message });
    return { success: true, integrationDeleted: true };
  },

  leaveScan: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    if (!scanId) return fail(400, { message: 'Scan ausente.' });

    const { error: rpcErr } = await locals.db.rpc('leave_scan', {
      p_scan_id: scanId
    });
    if (rpcErr) return fail(400, { message: rpcErr.message });
    throw redirect(303, '/scan');
  },

  updateAvailability: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const status = formData.get('availability_status') as string;
    const message = (formData.get('availability_message') as string)?.trim() || null;

    if (!scanId || !status) return fail(400, { message: 'Dados inválidos.' });

    const { error } = await locals.db.from('scan_members').update({
      availability_status: status,
      availability_message: message,
      availability_updated_at: new Date().toISOString()
    }).eq('scan_id', scanId).eq('user_id', locals.user.id);

    if (error) return fail(400, { message: error.message });
    return { success: true, availabilityUpdated: true };
  },

  saveRecruitmentQuestion: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = formData.get('scan_id') as string;
    const openingId = formData.get('opening_id') as string;
    const question = (formData.get('question') as string)?.trim();
    const questionType = (formData.get('question_type') as string) || 'TEXT_SHORT';
    const required = formData.get('required') === 'true';

    if (!scanId || !openingId || !question) return fail(400, { message: 'Pergunta obrigatória.' });

    const { error } = await locals.db.from('scan_recruitment_questions').insert({
      scan_id: scanId,
      opening_id: openingId,
      question,
      question_type: questionType,
      required
    });
    if (error) return fail(400, { message: error.message });
    return { success: true, questionSaved: true };
  },

  deleteRecruitmentQuestion: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const questionId = formData.get('question_id') as string;
    if (!questionId) return fail(400, { message: 'ID ausente.' });

    const { error } = await locals.db.from('scan_recruitment_questions').delete().eq('id', questionId);
    if (error) return fail(400, { message: error.message });
    return { success: true, questionDeleted: true };
  },

  postMessage: async ({ request, locals, platform }: any) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const channelId = String(formData.get('channelId') || '');
    const content = String(formData.get('content') || '').trim();
    const replyToId = String(formData.get('replyToId') || '').trim() || null;
    if (!channelId || !content) return fail(400, { message: 'Mensagem obrigatória' });

    const { data: ch } = await locals.db.from('scan_channels').select('scan_id, name, type').eq('id', channelId).single();
    if (!ch) return fail(404, { message: 'Canal não encontrado' });

    if (ch.type === 'ANNOUNCEMENT') {
      const { data: mem } = await locals.db.from('scan_members').select('role').eq('scan_id', ch.scan_id).eq('user_id', locals.user.id).maybeSingle();
      if (!mem || !['OWNER', 'ADMIN'].includes(mem.role)) {
        return fail(403, { message: 'Apenas Administradores e Donos da Scan podem postar em canais de avisos.' });
      }
    }

    const { data: msg } = await locals.db.from('scan_messages').insert({
      scan_id: ch.scan_id,
      channel_id: channelId,
      user_id: locals.user.id,
      reply_to_id: replyToId,
      content
    }).select().single();

    // Reply Notification Dispatch
    if (replyToId) {
      try {
        const { data: origMsg } = await locals.db
          .from('scan_messages')
          .select('user_id, content')
          .eq('id', replyToId)
          .maybeSingle();

        if (origMsg && origMsg.user_id && origMsg.user_id !== locals.user.id) {
          const preview = origMsg.content ? `"${origMsg.content.slice(0, 50)}..."` : 'sua mensagem';
          await createNotification({
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

    await dispatchMentions({
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
      platform.context.waitUntil(processPendingEmailOutbox(10).catch(() => {}));
    }

    return { success: true, messageId: msg.id };
  },

  editMessage: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const messageId = String(formData.get('messageId') || '');
    const content = String(formData.get('content') || '').trim();
    if (!messageId || !content) return fail(400, { message: 'Conteúdo obrigatório' });

    const { data, error } = await locals.db.rpc('edit_scan_message', {
      p_message_id: messageId,
      p_new_content: content
    });
    if (error) return fail(400, { message: error.message });

    // Disparar eventuais menções novas adicionadas na edição (deduplicação evita reenvio para quem já foi notificado)
    try {
      const { data: currentMsg } = await locals.db
        .from('scan_messages')
        .select('scan_id, channel_id')
        .eq('id', messageId)
        .maybeSingle();

      if (currentMsg) {
        let editMentionsData = null;
        try {
          const rawEditMentions = formData.get('mentionsData');
          if (rawEditMentions) editMentionsData = JSON.parse(String(rawEditMentions));
        } catch {
          // Invalid optional mention metadata must not block message editing.
        }

        await dispatchMentions({
          locals,
          text: content,
          messageId,
          scanId: currentMsg.scan_id,
          channelId: currentMsg.channel_id,
          authorId: locals.user.id,
          deepLink: `/scan?id=${currentMsg.scan_id}&tab=chat&channelId=${currentMsg.channel_id}#msg-${messageId}`,
          contextType: 'CHAT',
          mentionsData: editMentionsData
        });
      }
    } catch (err) {
      console.error('Error dispatching edited mentions:', err);
    }

    return { success: true, messageEdited: true, data };
  },

  deleteMessage: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const messageId = String(formData.get('messageId') || '');
    if (!messageId) return fail(400, { message: 'Mensagem obrigatória' });

    const { data, error } = await locals.db.rpc('delete_scan_message', {
      p_message_id: messageId
    });
    if (error) return fail(400, { message: error.message });
    return { success: true, messageDeleted: true, data };
  },

  postThreadReply: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const parentMessageId = String(formData.get('parentMessageId') || '');
    const content = String(formData.get('content') || '').trim();
    if (!parentMessageId || !content) return fail(400, { message: 'Conteúdo obrigatório' });

    const { data: parent } = await locals.db
      .from('scan_messages')
      .select('scan_id, user_id, channel_id, content')
      .eq('id', parentMessageId)
      .single();
    if (!parent) return fail(404, { message: 'Mensagem original não encontrada' });

    const { error } = await locals.db.from('scan_message_threads').insert({
      scan_id: parent.scan_id,
      parent_message_id: parentMessageId,
      user_id: locals.user.id,
      content
    });
    if (error) return fail(400, { message: error.message });

    // Notify parent author
    if (parent.user_id && parent.user_id !== locals.user.id) {
      const preview = parent.content ? `"${parent.content.slice(0, 50)}..."` : 'sua mensagem';
      await createNotification({
        recipientUserId: parent.user_id,
        actorUserId: locals.user.id,
        type: 'REPLY_CHAT',
        title: `Nova resposta na sua thread (${preview})`,
        body: content,
        deepLink: `/scan?id=${parent.scan_id}&tab=chat&channelId=${parent.channel_id || ''}#msg-${parentMessageId}`,
        context: 'Thread',
        scanId: parent.scan_id,
        priority: 'NORMAL',
        dedupeKey: `thread_reply:${parentMessageId}:${locals.user.id}:${Date.now()}`
      }).catch(err => console.error('Error dispatching thread reply notification:', err));
    }

    // Dispatch mentions in thread reply
    await dispatchMentions({
      locals,
      text: content,
      scanId: parent.scan_id,
      channelId: parent.channel_id,
      authorId: locals.user.id,
      title: 'Nova menção em resposta de thread',
      deepLink: `/scan?id=${parent.scan_id}&tab=chat&channelId=${parent.channel_id || ''}#msg-${parentMessageId}`,
      contextType: 'CHAT'
    }).catch(err => console.error('Error dispatching thread mentions:', err));

    return { success: true };
  },

  togglePinMessage: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const messageId = String(formData.get('messageId') || '');
    const pinned = formData.get('pinned') === 'true';
    const { error } = await locals.db.from('scan_messages').update({ pinned }).eq('id', messageId);
    if (error) return fail(400, { message: error.message });
    return { success: true };
  },

  toggleReaction: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const messageId = String(formData.get('messageId') || '');
    const emoji = String(formData.get('emoji') || '').trim();
    if (!messageId || !emoji) return fail(400, { message: 'Dados inválidos' });

    const { data, error } = await locals.db.rpc('toggle_scan_message_reaction', {
      p_message_id: messageId,
      p_emoji: emoji
    });
    if (error) return fail(400, { message: error.message });
    return { success: true, reactionToggled: true, data };
  },

  reactMessage: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const messageId = String(formData.get('messageId') || '');
    const emoji = String(formData.get('emoji') || '👍').trim();

    const { data, error } = await locals.db.rpc('toggle_scan_message_reaction', {
      p_message_id: messageId,
      p_emoji: emoji
    });
    if (error) return fail(400, { message: error.message });
    return { success: true, reactionToggled: true, data };
  },

  markChannelRead: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = String(formData.get('scanId') || '');
    const channelId = String(formData.get('channelId') || '');
    const messageId = String(formData.get('messageId') || '') || null;
    if (!scanId || !channelId) return fail(400, { message: 'Dados inválidos' });

    const { data, error } = await locals.db.rpc('mark_scan_channel_read', {
      p_scan_id: scanId,
      p_channel_id: channelId,
      p_message_id: messageId
    });
    if (error) return fail(400, { message: error.message });
    return { success: true, channelMarkedRead: true, data };
  },

  createChannel: async ({ request, locals, url }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const name = String(formData.get('name') || '').trim();
    const category = String(formData.get('category') || 'GERAL');
    const type = String(formData.get('type') || 'CHAT');
    const description = String(formData.get('description') || '').trim();
    const scanId = url.searchParams.get('id');
    if (!scanId || !name) return fail(400, { message: 'Nome obrigatório' });

    const slug = slugify(name);
    const { error } = await locals.db.from('scan_channels').insert({
      scan_id: scanId,
      name,
      slug,
      category,
      type,
      description,
      created_by: locals.user.id
    });
    if (error) return fail(400, { message: error.message });
    return { success: true, channelCreated: true };
  },

  createQcIssue: async ({ request, locals, url }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const chapterId = String(formData.get('chapterId') || '');
    const pageNumber = Number(formData.get('pageNumber') || 1);
    const issueType = String(formData.get('issueType') || 'TYPE');
    const description = String(formData.get('description') || '').trim();
    const assignedTo = formData.get('assignedTo') ? String(formData.get('assignedTo')) : null;
    const scanId = url.searchParams.get('id');
    if (!scanId || !chapterId || !description) return fail(400, { message: 'Dados incompletos' });

    const { error } = await locals.db.from('scan_chapter_qc_issues').insert({
      scan_id: scanId,
      chapter_id: chapterId,
      page_number: pageNumber,
      issue_type: issueType,
      description,
      assigned_to: assignedTo,
      created_by: locals.user.id
    });
    if (error) return fail(400, { message: error.message });

    if (assignedTo && assignedTo !== locals.user.id) {
      await createNotification({
        recipientUserId: assignedTo,
        actorUserId: locals.user.id,
        type: 'QC_ISSUE',
        title: `Novo problema de QC apontado (Pág. ${pageNumber})`,
        body: `Tipo: ${issueType}. Descrição: ${description}`,
        deepLink: `/scan?id=${scanId}&tab=pipeline&chapterId=${chapterId}`,
        scanId,
        priority: 'URGENT',
        dedupeKey: `qc:${chapterId}:${pageNumber}:${assignedTo}:${Date.now()}`
      }).catch(err => console.error('Error dispatching QC notification:', err));
    }

    return { success: true, qcIssueCreated: true };
  },

  updateQcStatus: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const issueId = String(formData.get('issueId') || '');
    const status = String(formData.get('status') || 'OPEN');
    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (status === 'RESOLVED') {
      updateData.resolved_by = locals.user.id;
      updateData.resolved_at = new Date().toISOString();
    }
    const { error } = await locals.db.from('scan_chapter_qc_issues').update(updateData).eq('id', issueId);
    if (error) return fail(400, { message: error.message });
    return { success: true, qcStatusUpdated: true };
  },

  saveAcademyTutorial: async ({ request, locals, url }) => {
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
    if (tutorialId) {
      const { error } = await locals.db.from('scan_academy_tutorials').update({
        title,
        slug,
        category,
        content,
        status,
        is_published: isPublished,
        target_position_id: targetPositionId || null,
        updated_at: new Date().toISOString()
      }).eq('id', tutorialId);
      if (error) return fail(400, { message: error.message });
    } else {
      const { error } = await locals.db.from('scan_academy_tutorials').insert({
        scan_id: scanId,
        title,
        slug,
        category,
        content,
        status,
        is_published: isPublished,
        target_position_id: targetPositionId || null,
        created_by: locals.user.id
      });
      if (error) return fail(400, { message: error.message });
    }
    return { success: true, tutorialSaved: true };
  },

  deleteAcademyTutorial: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const tutorialId = formData.get('tutorial_id') as string;
    const scanId = formData.get('scan_id') as string;
    if (!tutorialId || !scanId) return fail(400, { message: 'ID do tutorial ausente' });

    const { data: memberRow } = await locals.db
      .from('scan_members')
      .select('role')
      .eq('scan_id', scanId)
      .eq('user_id', locals.user.id)
      .maybeSingle();

    if (!memberRow || !['OWNER', 'ADMIN'].includes(memberRow.role)) {
      if (locals.role !== 'ADMIN') return fail(403, { message: 'Permissão negada. Apenas Líderes ou Admins podem excluir tutoriais.' });
    }

    // Delete associated attachments
    await locals.db.from('scan_attachments').delete().eq('scan_id', scanId).eq('context_type', 'TUTORIAL').eq('context_id', tutorialId);
    const { error } = await locals.db.from('scan_academy_tutorials').delete().eq('id', tutorialId).eq('scan_id', scanId);
    if (error) return fail(400, { message: error.message });
    return { success: true, tutorialDeleted: true };
  },

  advanceStage: async ({ request, locals, url }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const chapterId = String(formData.get('chapterId') || '');
    const stageSlug = String(formData.get('stageSlug') || '');
    const scanId = url.searchParams.get('id');
    if (!scanId || !chapterId || !stageSlug) return fail(400, { message: 'Dados incompletos' });

    const { error } = await locals.db.from('scan_production_chapters').update({
      current_stage_slug: stageSlug,
      updated_at: new Date().toISOString()
    }).eq('id', chapterId);
    if (error) return fail(400, { message: error.message });
    return { success: true, stageAdvanced: true };
  },

  publishChapter: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const chapterId = String(formData.get('chapterId') || '');
    if (!chapterId) return fail(400, { message: 'ID do capítulo ausente' });

    // Check open QC issues
    const { count } = await locals.db.from('scan_chapter_qc_issues').select('id', { count: 'exact', head: true }).eq('chapter_id', chapterId).eq('status', 'OPEN');
    if ((count ?? 0) > 0) {
      return fail(400, { message: 'Publicação bloqueada: existem apontamentos de QC em aberto!' });
    }

    const { error } = await locals.db.from('chapters').update({
      published_at: new Date().toISOString()
    }).eq('id', chapterId);
    if (error) return fail(400, { message: error.message });

    // Update in-production chapter if exists
    await locals.db.from('scan_production_chapters').update({
      status: 'PUBLISHED',
      updated_at: new Date().toISOString()
    }).eq('target_chapter_id', chapterId);

    return { success: true, chapterPublished: true };
  },

  createMuralPost: async ({ request, locals }) => {
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

    const { data: member } = await locals.db
      .from('scan_members')
      .select('role')
      .eq('scan_id', scanId)
      .eq('user_id', locals.user.id)
      .maybeSingle();

    if (!member && locals.role !== 'ADMIN') {
      return fail(403, { message: 'Acesso negado à Scan' });
    }

    const { data: post, error } = await locals.db
      .from('scan_mural_posts')
      .insert({
        scan_id: scanId,
        author_id: locals.user.id,
        title,
        content,
        post_type: postType,
        is_pinned: isPinned,
        pinned_at: isPinned ? new Date().toISOString() : null,
        pinned_by: isPinned ? locals.user.id : null
      })
      .select()
      .single();

    if (error) return fail(400, { message: error.message });

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

        await locals.db.from('scan_attachments').insert({
          scan_id: scanId,
          context_type: 'MURAL_POST',
          context_id: post.id,
          uploaded_by: locals.user.id,
          original_filename: rawFilename,
          safe_filename: safeFilename,
          mime_type: f.type || 'application/octet-stream',
          size: f.size,
          storage_reference: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
          storage_provider: 'PRIVATE_STORAGE'
        });
      }
    }

    await dispatchMentions({
      locals,
      text: content,
      scanId,
      authorId: locals.user.id,
      title: `Nova publicação no Mural: "${title}"`,
      deepLink: `/scan?id=${scanId}&tab=mural&postId=${post.id}`,
      contextType: 'MURAL'
    }).catch(err => console.error('Error dispatching mural post mentions:', err));

    return { success: true, muralPostCreated: true };
  },

  commentMuralPost: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const postId = String(formData.get('post_id') || '');
    const content = String(formData.get('content') || '').trim();
    const parentCommentId = formData.get('parent_comment_id') ? String(formData.get('parent_comment_id')) : null;

    if (!scanId || !postId || !content) {
      return fail(400, { message: 'Comentário inválido' });
    }

    const { error } = await locals.db.from('scan_mural_comments').insert({
      scan_id: scanId,
      post_id: postId,
      author_id: locals.user.id,
      content,
      parent_comment_id: parentCommentId
    });

    if (error) return fail(400, { message: error.message });

    await dispatchMentions({
      locals,
      text: content,
      scanId,
      authorId: locals.user.id,
      title: `Novo comentário no Mural`,
      deepLink: `/scan?id=${scanId}&tab=mural&postId=${postId}`,
      contextType: 'MURAL'
    }).catch(err => console.error('Error dispatching mural comment mentions:', err));

    return { success: true, muralCommentCreated: true };
  },

  reactMuralPost: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = String(formData.get('scan_id') || '');
    const postId = formData.get('post_id') ? String(formData.get('post_id')) : null;
    const commentId = formData.get('comment_id') ? String(formData.get('comment_id')) : null;
    const emoji = String(formData.get('emoji') || '').trim();

    if (!scanId || !emoji || (!postId && !commentId)) {
      return fail(400, { message: 'Reação inválida' });
    }

    let query = locals.db
      .from('scan_mural_reactions')
      .select('id')
      .eq('scan_id', scanId)
      .eq('user_id', locals.user.id)
      .eq('emoji', emoji);

    if (postId) query = query.eq('post_id', postId);
    if (commentId) query = query.eq('comment_id', commentId);

    const { data: existing } = await query.maybeSingle();

    if (existing) {
      await locals.db.from('scan_mural_reactions').delete().eq('id', existing.id);
    } else {
      await locals.db.from('scan_mural_reactions').insert({
        scan_id: scanId,
        post_id: postId,
        comment_id: commentId,
        user_id: locals.user.id,
        emoji
      });
    }

    return { success: true, reacted: true };
  },

  togglePinMuralPost: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const postId = String(formData.get('post_id') || '');

    const { data: post } = await locals.db.from('scan_mural_posts').select('is_pinned').eq('id', postId).single();
    if (!post) return fail(404, { message: 'Post não encontrado' });

    const newPinned = !post.is_pinned;
    const { error } = await locals.db.from('scan_mural_posts').update({
      is_pinned: newPinned,
      pinned_at: newPinned ? new Date().toISOString() : null,
      pinned_by: newPinned ? locals.user.id : null
    }).eq('id', postId);

    if (error) return fail(400, { message: error.message });
    return { success: true, pinToggled: true };
  },

  deleteMuralPost: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const postId = String(formData.get('post_id') || '');

    const { error } = await locals.db.from('scan_mural_posts').delete().eq('id', postId);
    if (error) return fail(400, { message: error.message });
    return { success: true, muralPostDeleted: true };
  },

  savePipelineStage: async ({ request, locals }) => {
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
      const { error } = await locals.db.from('scan_workflow_stages').update({
        name,
        color,
        description,
        required,
        updated_at: new Date().toISOString()
      }).eq('id', stageId);
      if (error) return fail(400, { message: error.message });
    } else {
      const { data: maxRow } = await locals.db
        .from('scan_workflow_stages')
        .select('display_order')
        .eq('scan_id', scanId)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextOrder = (maxRow?.display_order || 0) + 1;

      const { error } = await locals.db.from('scan_workflow_stages').insert({
        scan_id: scanId,
        name,
        slug,
        color,
        description,
        required,
        display_order: nextOrder
      });
      if (error) return fail(400, { message: error.message });
    }

    return { success: true, stageSaved: true };
  },

  deletePipelineStage: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const stageId = String(formData.get('stage_id') || '');

    const { error } = await locals.db.from('scan_workflow_stages').delete().eq('id', stageId);
    if (error) return fail(400, { message: error.message });
    return { success: true, stageDeleted: true };
  },

  createProductionChapter: async ({ request, locals }) => {
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
    const { data: memberRow } = await locals.db
      .from('scan_members')
      .select('role')
      .eq('scan_id', scanId)
      .eq('user_id', locals.user.id)
      .maybeSingle();

    if (!memberRow) {
      return fail(403, { message: 'Acesso não autorizado a esta Scan.' });
    }

    const isLeadership = ['OWNER', 'ADMIN'].includes(memberRow.role);
    if (!isLeadership) {
      const { data: memberPositions } = await locals.db
        .from('scan_member_positions')
        .select('scan_positions(name)')
        .eq('scan_id', scanId)
        .eq('user_id', locals.user.id);

      const hasRawRole = (memberPositions || []).some((p: any) => {
        const name = (p.scan_positions?.name || '').toLowerCase();
        return name.includes('raw');
      });

      if (!hasRawRole) {
        return fail(403, {
          message: 'Você precisa do cargo Raw Provider para cadastrar novos capítulos ou iniciar a produção de RAW.'
        });
      }
    }

    const { data, error } = await locals.db.rpc('create_scan_production_chapter', {
      p_scan_id: scanId,
      p_work_id: workId,
      p_chapter_number: chapterNumber,
      p_chapter_label: chapterLabel,
      p_chapter_type: chapterType,
      p_template: template,
      p_priority: priority,
      p_auto_claim: autoClaim
    });

    if (error) return fail(400, { message: error.message });
    if (platform?.context?.waitUntil) {
      platform.context.waitUntil(processPendingEmailOutbox(20).catch(() => {}));
    }
    return { success: true, chapterId: data };
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

    const { data, error } = await locals.db.rpc('bulk_create_scan_production_chapters', {
      p_scan_id: scanId,
      p_work_id: workId,
      p_from_number: fromNumber,
      p_to_number: toNumber,
      p_template: template,
      p_priority: priority
    });

    if (error) return fail(400, { message: error.message });
    if (platform?.context?.waitUntil) {
      platform.context.waitUntil(processPendingEmailOutbox(20).catch(() => {}));
    }
    return { success: true, result: data };
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
      platform.context.waitUntil(processPendingEmailOutbox(20).catch(() => {}));
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
      platform.context.waitUntil(processPendingEmailOutbox(20).catch(() => {}));
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
      platform.context.waitUntil(processPendingEmailOutbox(20).catch(() => {}));
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
      platform.context.waitUntil(processPendingEmailOutbox(20).catch(() => {}));
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
      platform.context.waitUntil(processPendingEmailOutbox(20).catch(() => {}));
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

    const { data, error } = await locals.db.rpc('publish_scan_production_chapter', {
      p_production_chapter_id: productionChapterId
    });

    if (error) return fail(400, { message: error.message });
    if (platform?.context?.waitUntil) {
      platform.context.waitUntil(processPendingEmailOutbox(20).catch(() => {}));
    }
    return { success: true, result: data };
  },

  unpublishProductionChapter: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const productionChapterId = String(formData.get('production_chapter_id') || '');
    const reason = formData.get('reason') ? String(formData.get('reason')) : null;
    if (!productionChapterId) return fail(400, { message: 'ID do capítulo ausente.' });

    const { data, error } = await locals.db.rpc('unpublish_scan_production_chapter', {
      p_production_chapter_id: productionChapterId,
      p_reason: reason
    });

    if (error) return fail(400, { message: error.message });
    if (platform?.context?.waitUntil) {
      platform.context.waitUntil(processPendingEmailOutbox(20).catch(() => {}));
    }
    return { success: true, result: data };
  },

  saveWorkWorkflowOverride: async ({ request, locals }) => {
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

    const { error } = await locals.db
      .from('scan_work_workflow_overrides')
      .upsert({
        scan_id: scanId,
        work_id: workId,
        template,
        custom_stages: customStages,
        updated_at: new Date().toISOString()
      }, { onConflict: 'scan_id,work_id' });

    if (error) return fail(400, { message: error.message });
    return { success: true, overrideSaved: true };
  },

  deleteProductionChapter: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const productionChapterId = String(formData.get('production_chapter_id') || '');
    const confirmation = String(formData.get('confirmation') || '');
    const reason = formData.get('reason') ? String(formData.get('reason')) : 'Produção de teste/QA removida';

    if (!productionChapterId || !confirmation) {
      return fail(400, { message: 'ID da produção e confirmação são obrigatórios.' });
    }

    const { data, error } = await locals.db.rpc('delete_scan_production_chapter', {
      p_production_chapter_id: productionChapterId,
      p_confirmation: confirmation,
      p_reason: reason
    });

    if (error) return fail(400, { message: error.message });
    return { success: true, result: data };
  },

  updateProductionChapter: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const productionChapterId = String(formData.get('production_chapter_id') || '');
    const chapterLabel = formData.has('chapter_label') ? String(formData.get('chapter_label')).trim() : null;
    const priority = formData.has('priority') ? String(formData.get('priority')).trim().toUpperCase() : null;
    const notes = formData.has('notes') ? String(formData.get('notes')).trim() : null;

    if (!productionChapterId) {
      return fail(400, { message: 'ID da produção é obrigatório.' });
    }

    const { data: prodCh, error: prodErr } = await locals.db
      .from('scan_production_chapters')
      .select('id, scan_id, status')
      .eq('id', productionChapterId)
      .maybeSingle();

    if (prodErr || !prodCh) {
      return fail(404, { message: 'Capítulo de produção não encontrado.' });
    }

    const { data: memberRow } = await locals.db
      .from('scan_members')
      .select('role')
      .eq('scan_id', prodCh.scan_id)
      .eq('user_id', locals.user.id)
      .maybeSingle();

    const isPrivileged = memberRow && ['OWNER', 'ADMIN'].includes(memberRow.role);
    if (!isPrivileged) {
      return fail(403, { message: 'Permissão negada. Apenas Administradores e Donos podem editar detalhes da produção.' });
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    if (chapterLabel !== null) updatePayload.chapter_label = chapterLabel || null;
    if (priority && ['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(priority)) {
      updatePayload.priority = priority;
    }

    const { error: updateErr } = await locals.db
      .from('scan_production_chapters')
      .update(updatePayload)
      .eq('id', productionChapterId);

    if (updateErr) return fail(400, { message: updateErr.message });

    if (notes !== null) {
      await locals.db
        .from('scan_chapter_stages')
        .update({ notes: notes || null, updated_at: new Date().toISOString() })
        .eq('production_chapter_id', productionChapterId)
        .in('status', ['AVAILABLE', 'IN_PROGRESS', 'REWORK']);
    }

    return { success: true, chapterUpdated: true };
  },

  deleteOpening: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = String(formData.get('scan_id') || '');
    const openingId = String(formData.get('opening_id') || '');

    if (!scanId || !openingId) {
      return fail(400, { message: 'Dados insuficientes para excluir vaga.' });
    }

    const { data: memberRow } = await locals.db
      .from('scan_members')
      .select('role')
      .eq('scan_id', scanId)
      .eq('user_id', locals.user.id)
      .maybeSingle();

    if (!memberRow || !['OWNER', 'ADMIN'].includes(memberRow.role)) {
      return fail(403, { message: 'Apenas Administradores ou Donos podem excluir vagas de recrutamento.' });
    }

    const { error: delErr } = await locals.db
      .from('scan_recruitment_openings')
      .delete()
      .eq('id', openingId)
      .eq('scan_id', scanId);

    if (delErr) return fail(400, { message: delErr.message });
    return { success: true, openingDeleted: true };
  },

  reorderChannels: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Não autenticado' });
    const formData = await request.formData();
    const scanId = String(formData.get('scan_id') || '');
    const ordersRaw = String(formData.get('orders') || '');

    if (!scanId || !ordersRaw) {
      return fail(400, { message: 'Dados inválidos para reordenar canais.' });
    }

    const { data: memberRow } = await locals.db
      .from('scan_members')
      .select('role')
      .eq('scan_id', scanId)
      .eq('user_id', locals.user.id)
      .maybeSingle();

    if (!memberRow || !['OWNER', 'ADMIN'].includes(memberRow.role)) {
      return fail(403, { message: 'Apenas Administradores ou Donos podem reordenar os canais.' });
    }

    try {
      const orders: Array<{ id: string; display_order: number }> = JSON.parse(ordersRaw);
      await Promise.all(
        orders.map(item =>
          locals.db
            .from('scan_channels')
            .update({ display_order: item.display_order })
            .eq('id', item.id)
            .eq('scan_id', scanId)
        )
      );
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
