<script lang="ts">
  import {
    Briefcase,
    Sparkles,
    Bell,
    CheckCircle2,
    Clock,
    AlertCircle,
    ArrowRight,
    ExternalLink,
    Pin,
    Shield,
    Users,
    Layers,
    AlertTriangle,
    Inbox,
    Calendar,
    ChevronRight,
    BookOpen,
    Check
  } from '@lucide/svelte';
  import { relativeTime } from '$lib/types';

  let {
    currentScan,
    userProfile,
    userRole = 'MEMBER',
    userPositions = [],
    tasks = [],
    chapters = [],
    chapterStages = [],
    works = [],
    muralPosts = [],
    notifications = [],
    stages = [],
    qcIssues = [],
    onNavigateTab,
    onOpenChapter
  } = $props();

  // 5 Canonical Production Stages that map to Scan Positions
  const PRODUCTION_STAGES = [
    {
      slug: 'traducao',
      name: 'Tradução',
      shortName: 'Tradução',
      icon: '🌐',
      color: '#3b82f6',
      keywords: ['trad', 'trans']
    },
    {
      slug: 'clean_redraw',
      name: 'Clean / Redraw',
      shortName: 'Clean & Redraw',
      icon: '🎨',
      color: '#ec4899',
      keywords: ['clean', 'redraw', 'edição', 'edicao']
    },
    {
      slug: 'typeset',
      name: 'Typeset',
      shortName: 'Typeset',
      icon: '✒️',
      color: '#eab308',
      keywords: ['type', 'letr']
    },
    {
      slug: 'revisor_qc',
      name: 'Revisão / QC',
      shortName: 'Revisor (QC)',
      icon: '🔎',
      color: '#a855f7',
      keywords: ['revis', 'qc', 'quality']
    },
    {
      slug: 'raw',
      name: 'Raw Provider',
      shortName: 'RAW',
      icon: '📦',
      color: '#94a3b8',
      keywords: ['raw']
    }
  ];

  function matchesStageSlug(sourceSlug: string | undefined, targetSlug: string): boolean {
    if (!sourceSlug) return false;
    const s = sourceSlug.toLowerCase().trim();
    const t = targetSlug.toLowerCase().trim();
    if (s === t) return true;
    if (t === 'clean_redraw' || t === 'clean') {
      return s === 'clean' || s === 'clean_redraw' || s === 'clean/redraw';
    }
    if (t === 'revisor_qc' || t === 'qc') {
      return s === 'revisor_qc' || s === 'revisao' || s === 'qc' || s === 'revisor (qc)';
    }
    if (t === 'traducao') return s === 'traducao' || s === 'translation';
    if (t === 'typeset') return s === 'typeset' || s === 'letrista';
    if (t === 'raw') return s === 'raw' || s === 'raw_provider';
    return false;
  }

  function getStageIcon(slug: string | undefined): string {
    if (!slug) return '💼';
    const s = slug.toLowerCase();
    if (s.includes('clean') || s.includes('redraw')) return '🎨';
    if (s.includes('trad') || s.includes('trans')) return '🌐';
    if (s.includes('type') || s.includes('letr')) return '✒️';
    if (s.includes('qc') || s.includes('revis')) return '🔎';
    if (s.includes('raw')) return '📦';
    return '💼';
  }

  function getStageColor(slug: string | undefined): string {
    if (!slug) return '#8b5cf6';
    const s = slug.toLowerCase();
    if (s.includes('clean') || s.includes('redraw')) return '#ec4899';
    if (s.includes('trad') || s.includes('trans')) return '#3b82f6';
    if (s.includes('type') || s.includes('letr')) return '#eab308';
    if (s.includes('qc') || s.includes('revis')) return '#a855f7';
    if (s.includes('raw')) return '#94a3b8';
    return '#8b5cf6';
  }

  function formatDueDate(dueDateStr: string | null | undefined): string | null {
    if (!dueDateStr) return null;
    const d = new Date(dueDateStr);
    if (isNaN(d.getTime())) return null;
    const diffDays = Math.ceil((d.getTime() - Date.now()) / 86400000);
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Amanhã';
    if (diffDays < 0) return `Atrasado há ${Math.abs(diffDays)}d`;
    if (diffDays <= 5) return `Em ${diffDays}d`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  // 1. SEU TRABALHO: Active tasks assigned to the logged-in user
  let myActiveTasks = $derived.by(() => {
    const list: any[] = [];
    const myId = userProfile?.id;
    if (!myId) return list;

    // A) Chapter stages assigned in pipeline
    if (chapterStages && chapterStages.length > 0) {
      for (const cs of chapterStages) {
        if (cs.assigned_to === myId && (cs.status === 'IN_PROGRESS' || cs.status === 'REWORK')) {
          const ch = chapters.find((c: any) => c.id === cs.production_chapter_id);
          const work = ch?.work || works.find((w: any) => w.id === ch?.work_id);
          const stage = stages.find((s: any) => s.id === cs.stage_id) || cs.stage;
          const sSlug = stage?.slug || 'traducao';
          const chNum = ch?.chapter_number || ch?.number || null;

          list.push({
            type: 'stage',
            id: cs.id,
            chapterStage: cs,
            chapter: ch,
            work,
            workTitle: work?.title || 'Obra em Produção',
            coverId: work?.cover_id || null,
            chapterNumber: chNum,
            chapterLabel: ch?.chapter_label || '',
            stageName: stage?.name || 'Etapa Editorial',
            stageSlug: sSlug,
            stageIcon: getStageIcon(sSlug),
            stageColor: stage?.color || getStageColor(sSlug),
            status: cs.status,
            isRework: cs.status === 'REWORK',
            priority: ch?.priority || 'NORMAL',
            dueDate: ch?.target_publish_at || null
          });
        }
      }
    }

    // B) Legacy tasks assigned to user
    if (tasks && tasks.length > 0) {
      for (const t of tasks) {
        if (t.assigned_to === myId && t.status !== 'DONE') {
          // Resolve linked chapter and work if present
          const ch = t.chapter_id ? (chapters.find((c: any) => c.id === t.chapter_id) || null) : null;
          const work = ch ? (ch.work || works.find((w: any) => w.id === ch.work_id)) : (t.work_id ? works.find((w: any) => w.id === t.work_id) : null);
          const chNum = ch?.chapter_number || ch?.number || t.chapter_number || null;
          const sSlug = t.stage_slug || 'minha_fila';

          // If task does not have a chapter number, it's a general editorial task
          const isGeneralTask = !chNum;
          const displayTitle = isGeneralTask
            ? (t.title || work?.title || 'Tarefa Geral')
            : (work?.title || t.title || 'Obra em Produção');

          list.push({
            type: 'legacy',
            id: t.id,
            task: t,
            work,
            workTitle: displayTitle,
            // For general task, do not arbitrarily show a manga cover if it's a general editorial task
            coverId: isGeneralTask ? null : (work?.cover_id || null),
            chapterNumber: chNum,
            chapterLabel: ch?.chapter_label || (isGeneralTask ? '' : t.title),
            stageName: t.stage_name || (isGeneralTask ? 'Limpeza & Redraw' : 'Tarefa Geral'),
            stageSlug: sSlug,
            stageIcon: getStageIcon(sSlug),
            stageColor: t.stage_color || getStageColor(sSlug),
            status: t.status,
            isRework: false,
            priority: t.priority || 'NORMAL',
            dueDate: t.due_date || t.due_at || null
          });
        }
      }
    }

    // Sort: Retrabalho first, then Urgent/High, then regular
    return list.sort((a, b) => {
      if (a.isRework && !b.isRework) return -1;
      if (!a.isRework && b.isRework) return 1;
      const prioOrder: Record<string, number> = { URGENT: 3, HIGH: 2, NORMAL: 1, LOW: 0 };
      const pA = prioOrder[a.priority] || 1;
      const pB = prioOrder[b.priority] || 1;
      return pB - pA;
    });
  });

  // Display top 3 active tasks in the hero section
  let displayedMyTasks = $derived(myActiveTasks.slice(0, 3));
  let remainingMyTasksCount = $derived(Math.max(0, myActiveTasks.length - 3));
  let hasActiveTasks = $derived(myActiveTasks.length > 0);

  // 2. DISPONÍVEL PARA VOCÊ: Filtered strictly to > 0 chapters
  let availableStagesData = $derived.by(() => {
    const isLeadership = userRole === 'OWNER' || userRole === 'ADMIN';
    const posList = userPositions || [];
    const posNames = posList.map((p: any) => (p.name || '').toLowerCase().trim());

    // Match positions to canonical production stages
    const matched = PRODUCTION_STAGES.filter((st) => {
      return posNames.some((pName: string) => st.keywords.some((kw) => pName.includes(kw)));
    });

    // Calculate real available count for a stage
    const countAvailable = (stageSlug: string) => {
      if (!chapterStages || chapterStages.length === 0) return 0;
      return chapterStages.filter((cs: any) => {
        const sSlug = (cs.stage?.slug || '').toLowerCase();
        const matches = matchesStageSlug(sSlug, stageSlug);
        const isFree = (cs.status === 'AVAILABLE' || cs.status === 'REWORK') && !cs.assigned_to;
        return matches && isFree;
      }).length;
    };

    let stagesToEvaluate = matched.length > 0 ? matched : (isLeadership ? PRODUCTION_STAGES : []);

    // Evaluate counts
    const evaluated = stagesToEvaluate.map((st) => ({
      ...st,
      count: countAvailable(st.slug)
    }));

    // Filter to ONLY stages that have work available (> 0) to avoid showing empty cards
    const activeStages = evaluated.filter((st) => st.count > 0);
    const totalAvailableCount = evaluated.reduce((acc, curr) => acc + curr.count, 0);

    return {
      isLeadership,
      hasPositions: posList.length > 0,
      mode: matched.length > 0 ? 'MATCHED_POSITIONS' : (isLeadership ? 'LEADERSHIP_COORDINATION' : 'NO_POSITIONS'),
      totalCount: totalAvailableCount,
      activeStages,
      allStagesEmpty: activeStages.length === 0,
      hasConfiguredPositions: stagesToEvaluate.length > 0
    };
  });

  // 3. AVISOS IMPORTANTES: Sleek, single-line discreet alerts
  let importantAlerts = $derived.by(() => {
    const list: any[] = [];

    // A) Unread notifications count
    const unreadCount = (notifications || []).filter((n: any) => !n.is_read).length;
    if (unreadCount > 0) {
      list.push({
        type: 'notifications',
        id: 'notif-unread',
        icon: 'bell',
        text: `${unreadCount} ${unreadCount === 1 ? 'notificação não lida' : 'notificações não lidas'} na caixa de entrada`,
        actionLabel: 'Abrir',
        tab: 'inbox',
        badge: 'Novo',
        color: '#a855f7'
      });
    }

    // B) Open QC issues
    const openQc = (qcIssues || []).filter((q: any) => q.status === 'OPEN').length;
    if (openQc > 0) {
      list.push({
        type: 'qc',
        id: 'qc-open',
        icon: 'qc',
        text: `${openQc} ${openQc === 1 ? 'apontamento de QC aberto' : 'apontamentos de QC abertos'} aguardando revisão`,
        actionLabel: 'Ver Pipeline',
        tab: 'pipeline',
        badge: 'Atenção',
        color: '#f59e0b'
      });
    }

    // C) Pinned Mural Announcement (top 1)
    const pinnedMural = (muralPosts || []).find((p: any) => p.is_pinned) || (muralPosts || [])[0];
    if (pinnedMural) {
      list.push({
        type: 'mural',
        id: `mural-${pinnedMural.id}`,
        icon: 'pin',
        text: `Mural: ${pinnedMural.title || 'Comunicado da Staff'}`,
        actionLabel: 'Ler Recado',
        tab: 'mural',
        badge: pinnedMural.is_pinned ? 'Fixado' : 'Mural',
        color: '#ec4899'
      });
    }

    // D) Nearest Deadline
    const now = Date.now();
    const upcoming = (tasks || [])
      .filter((t: any) => {
        const d = t.due_date || t.due_at;
        if (!d || t.status === 'DONE') return false;
        const diff = new Date(d).getTime() - now;
        return diff > -86400000 && diff < 5 * 86400000;
      })
      .sort((a: any, b: any) => new Date(a.due_date || a.due_at).getTime() - new Date(b.due_date || b.due_at).getTime())[0];

    if (upcoming) {
      const dDate = new Date(upcoming.due_date || upcoming.due_at);
      list.push({
        type: 'deadline',
        id: `due-${upcoming.id}`,
        icon: 'clock',
        text: `Prazo próximo: ${upcoming.title} (${dDate.toLocaleDateString('pt-BR')})`,
        actionLabel: 'Ver Agenda',
        tab: 'calendario',
        badge: 'Prazo',
        color: '#06b6d4'
      });
    }

    return list.slice(0, 3);
  });
</script>

<div class="workspace-overview-container">
  <!-- 0. WORKSPACE HEADER: Ultra-compact, informative production bar -->
  <header class="workspace-header">
    <div class="header-main">
      <div class="header-greeting-row">
        <span class="header-purple-accent"></span>
        <h1 class="header-title">
          <span class="desktop-only-inline">Sua área de trabalho</span>
          <span class="mobile-only-inline">Sua produção</span>
        </h1>
        {#if userProfile?.display_name}
          <span class="user-greeting-inline desktop-only-inline">· {userProfile.display_name}</span>
        {/if}
      </div>

      <div class="header-stats-row">
        {#if hasActiveTasks}
          <span class="stat-indicator active">
            <span class="pulse-dot"></span>
            <strong>{myActiveTasks.length}</strong> em andamento
          </span>
        {:else}
          <span class="stat-indicator clear">
            <CheckCircle2 size={12} class="text-emerald-400" />
            <span>Nenhum em andamento</span>
          </span>
        {/if}

        {#if availableStagesData.totalCount > 0}
          <span class="stat-divider">·</span>
          <span class="stat-indicator available">
            <strong>{availableStagesData.totalCount}</strong> {availableStagesData.totalCount === 1 ? 'disponível' : 'disponíveis'}
          </span>
        {/if}

        {#if importantAlerts.length > 0}
          <span class="stat-divider">·</span>
          <button
            type="button"
            class="stat-indicator alert-stat-btn"
            onclick={() => onNavigateTab(importantAlerts[0].tab)}
            title="Ver {importantAlerts.length} {importantAlerts.length === 1 ? 'aviso prioritário' : 'avisos prioritários'}"
          >
            <Bell size={11} class="alert-stat-icon" />
            <strong>{importantAlerts.length}</strong>
            <span class="alert-stat-text">{importantAlerts.length === 1 ? 'aviso' : 'avisos'}</span>
          </button>
        {/if}
      </div>
    </div>

    <div class="header-action-col">
      <button
        type="button"
        class="btn-queue-cta"
        onclick={() => onNavigateTab('minha_fila')}
        title="Abrir Minha Fila completa de tarefas"
      >
        <Briefcase size={14} />
        <span class="desktop-only-inline">Minha Fila</span>
        <span class="mobile-only-inline">Minha Fila →</span>
        {#if myActiveTasks.length > 0}
          <span class="queue-counter-chip">{myActiveTasks.length}</span>
        {/if}
      </button>
    </div>
  </header>

  <!-- DYNAMIC STUDIO WORKSPACE (Adaptive Layout based on user's active load) -->
  <div class="workspace-grid-layout" class:has-active={hasActiveTasks}>
    <!-- ========================================================
         PRIMARY COLUMN:
         - When has active tasks: Hero is "Seus Trabalhos"
         - When NO active tasks: Hero is PROMOTED to "Oportunidades de Produção"
         ======================================================== -->
    <div class="grid-primary-col">
      {#if hasActiveTasks}
        <!-- SCENARIO A: MEMBER WITH ACTIVE TASKS -->
        <section class="overview-section hero-section" aria-labelledby="section-seu-trabalho">
          <div class="section-title-bar">
            <div class="title-with-icon">
              <div class="icon-bubble purple">
                <Briefcase size={16} />
              </div>
              <div class="title-text-group">
                <h2 id="section-seu-trabalho" class="section-heading">
                  <span class="desktop-only-inline">Seus Trabalhos</span>
                  <span class="mobile-only-inline">Em andamento</span>
                </h2>
                <span class="section-caption">
                  {myActiveTasks.length} {myActiveTasks.length === 1 ? 'trabalho sob sua responsabilidade' : 'trabalhos sob sua responsabilidade'}
                </span>
              </div>
            </div>

            <span class="badge-count-active">
              {myActiveTasks.length}
            </span>
          </div>

          <div class="active-tasks-list">
            {#each displayedMyTasks as task (task.id)}
              {@const formattedDue = formatDueDate(task.dueDate)}
              <article class="task-compact-card" class:is-rework={task.isRework}>
                <!-- Left: Manga-proportioned cover thumbnail (3:4 ratio) or stylized fallback -->
                <div class="task-visual-col">
                  {#if task.coverId}
                    <img
                      src="/media/{task.coverId}"
                      alt={task.workTitle}
                      class="task-cover-thumb"
                      loading="lazy"
                      onerror={(e) => {
                        const target = e.currentTarget as HTMLElement;
                        target.style.display = 'none';
                        if (target.nextElementSibling) {
                          (target.nextElementSibling as HTMLElement).style.display = 'flex';
                        }
                      }}
                    />
                    <div class="task-stage-icon-fallback" style="display: none;">
                      <Briefcase size={18} class="task-fallback-icon" />
                    </div>
                  {:else}
                    <div class="task-stage-icon-fallback" style="--stage-color: {task.stageColor}">
                      {#if task.stageIcon && task.stageIcon !== '💼'}
                        <span>{task.stageIcon}</span>
                      {:else}
                        <Briefcase size={18} class="task-fallback-icon" />
                      {/if}
                    </div>
                  {/if}
                </div>

                <!-- Middle: Title and clean, proportional metadata -->
                <div class="task-details-col">
                  <div class="task-title-row">
                    <h3 class="task-work-name" title={task.workTitle}>
                      {task.workTitle}
                    </h3>
                  </div>

                  <!-- Primary metadata row: Chapter / Stage / Priority (No redundant 'Em andamento'!) -->
                  <div class="task-meta-row primary-meta">
                    {#if task.chapterNumber}
                      <span class="meta-pill chapter">Capítulo {task.chapterNumber}</span>
                    {/if}

                    <span class="meta-pill stage" style="--stage-c: {task.stageColor}">
                      <span class="dot"></span>
                      {task.stageName}
                    </span>

                    {#if task.priority === 'URGENT'}
                      <span class="meta-pill urgent">
                        <span class="desktop-only-inline">Urgente</span>
                        <span class="mobile-only-inline">Urgente</span>
                      </span>
                    {:else if task.priority === 'HIGH'}
                      <span class="meta-pill high">
                        <span class="desktop-only-inline">Alta prioridade</span>
                        <span class="mobile-only-inline">Alta</span>
                      </span>
                    {/if}
                  </div>

                  <!-- Secondary metadata row: Retrabalho or Deadline/Overdue -->
                  {#if task.isRework || formattedDue}
                    <div class="task-meta-row secondary-meta">
                      {#if task.isRework}
                        <span class="meta-pill rework">
                          <AlertTriangle size={11} />
                          Retrabalho
                        </span>
                      {/if}

                      {#if formattedDue}
                        <span class="meta-pill deadline" class:is-overdue={formattedDue.includes('Atrasado')}>
                          <Clock size={11} />
                          {formattedDue}
                        </span>
                      {/if}
                    </div>
                  {/if}
                </div>

                <!-- Right: Sleek, proportional touch action button -->
                <div class="task-action-col">
                  <button
                    type="button"
                    class="btn-continue-task"
                    onclick={() => {
                      if (task.type === 'stage' && task.chapter) {
                        if (onOpenChapter) onOpenChapter(task.chapter);
                        else onNavigateTab('pipeline', task.stageSlug);
                      } else {
                        onNavigateTab('minha_fila');
                      }
                    }}
                    title="Continuar este trabalho agora"
                  >
                    <span>Continuar</span>
                    <ArrowRight size={13} class="btn-arrow-icon" />
                  </button>
                </div>
              </article>
            {/each}
          </div>

          {#if remainingMyTasksCount > 0}
            <div class="more-tasks-wrapper">
              <button
                type="button"
                class="btn-view-all-queue"
                onclick={() => onNavigateTab('minha_fila')}
              >
                <span>Ver mais {remainingMyTasksCount} {remainingMyTasksCount === 1 ? 'trabalho' : 'trabalhos'} na Minha Fila</span>
                <ChevronRight size={14} />
              </button>
            </div>
          {/if}
        </section>
      {:else}
        <!-- SCENARIO B: MEMBER WITHOUT ACTIVE TASKS (PROMOTED AVAILABLE WORK HERO) -->
        <section class="overview-section promoted-available-section" aria-labelledby="section-oportunidades">
          <!-- Subtle, friendly empty state chip (No giant awkward card!) -->
          <div class="subtle-status-banner">
            <div class="banner-icon-bubble">
              <Sparkles size={16} class="text-amber-400" />
            </div>
            <div class="banner-text-wrap">
              <strong>Sua fila pessoal está zerada!</strong>
              <span>Escolha um dos capítulos disponíveis abaixo para assumir e começar a produzir.</span>
            </div>
          </div>

          <div class="section-title-bar">
            <div class="title-with-icon">
              <div class="icon-bubble gold">
                <Sparkles size={16} />
              </div>
              <div class="title-text-group">
                <h2 id="section-oportunidades" class="section-heading">Oportunidades de Produção</h2>
                {#if availableStagesData.mode === 'MATCHED_POSITIONS'}
                  <span class="section-caption">Capítulos prontos para assumir nos seus cargos</span>
                {:else if availableStagesData.isLeadership}
                  <span class="section-caption">Coordenação da Scan · Demanda pronta em todas as etapas</span>
                {:else}
                  <span class="section-caption">Capítulos prontos para produção na equipe</span>
                {/if}
              </div>
            </div>

            {#if availableStagesData.totalCount > 0}
              <span class="badge-count-available">
                {availableStagesData.totalCount} {availableStagesData.totalCount === 1 ? 'disponível' : 'disponíveis'}
              </span>
            {/if}
          </div>

          {#if availableStagesData.activeStages.length > 0}
            <!-- Promoted rich stage cards: High visual appeal and instant action -->
            <div class="promoted-stages-grid">
              {#each availableStagesData.activeStages as stage}
                <div
                  class="promoted-stage-card"
                  onclick={() => onNavigateTab('pipeline', stage.slug)}
                  onkeydown={(e) => { if (e.key === 'Enter') onNavigateTab('pipeline', stage.slug); }}
                  role="button"
                  tabindex="0"
                  title="Abrir etapa {stage.name} na pipeline"
                >
                  <div class="promoted-stage-header">
                    <div class="promoted-icon-wrap" style="--st-color: {stage.color}">
                      <span class="stage-emoji">{stage.icon}</span>
                    </div>
                    <span class="promoted-count-pill">
                      {stage.count} {stage.count === 1 ? 'capítulo' : 'capítulos'}
                    </span>
                  </div>

                  <div class="promoted-stage-body">
                    <h3 class="promoted-stage-title">{stage.name}</h3>
                    <p class="promoted-stage-desc">
                      Capítulos revisados e liberados aguardando responsável na produção.
                    </p>
                  </div>

                  <div class="promoted-stage-footer">
                    <span class="btn-claim-action">
                      <span>Assumir Capítulo</span>
                      <ArrowRight size={13} />
                    </span>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <!-- SCENARIO C: ZERO CHAPTERS AVAILABLE (Small, pleasant empty state) -->
            <div class="all-clear-studio-card">
              <div class="all-clear-icon-wrap">
                <CheckCircle2 size={24} class="text-emerald-400" />
              </div>
              <div class="all-clear-content">
                <h3 class="all-clear-heading">Nenhum capítulo disponível no momento</h3>
                <p class="all-clear-sub">
                  Toda a produção está em dia ou com responsáveis atribuídos. Novos capítulos entrarão automaticamente conforme forem liberados na produção.
                </p>
                <button
                  type="button"
                  class="btn-open-pipeline-cta"
                  onclick={() => onNavigateTab('pipeline')}
                >
                  <Layers size={14} />
                  <span>Acessar Área de Produção</span>
                </button>
              </div>
            </div>
          {/if}
        </section>
      {/if}
    </div>

    <!-- ========================================================
         SECONDARY COLUMN:
         - Contextual availability, discreet alerts, and quick-access studio tools
         ======================================================== -->
    <aside class="grid-secondary-col">
      <!-- 2. DISPONIBILIDADE: Either 'Disponibilidade da Equipe' (Admin) or 'Disponível para Você' (Member) -->
      {#if hasActiveTasks}
        <section class="overview-section" aria-labelledby="section-disponivel">
          <div class="section-title-bar">
            <div class="title-with-icon">
              <div class="icon-bubble gold">
                <Sparkles size={16} />
              </div>
              <div class="title-text-group">
                <h2 id="section-disponivel" class="section-heading">
                  {#if availableStagesData.isLeadership}
                    Disponibilidade da Equipe
                  {:else}
                    Disponível para Você
                  {/if}
                </h2>
                {#if availableStagesData.isLeadership}
                  <span class="section-caption">Visão da gestão · Demandas ativas da produção</span>
                {:else if availableStagesData.mode === 'MATCHED_POSITIONS'}
                  <span class="section-caption">Capítulos prontos para seus cargos</span>
                {:else}
                  <span class="section-caption">Capítulos prontos na equipe</span>
                {/if}
              </div>
            </div>

            {#if availableStagesData.isLeadership}
              <span class="badge-role-context" title="Visão administrativa de coordenação">Gestão</span>
            {/if}
          </div>

          {#if availableStagesData.mode === 'NO_POSITIONS'}
            <!-- Member with no positions assigned -->
            <div class="no-positions-card">
              <div class="no-pos-icon">
                <Users size={20} />
              </div>
              <div class="no-pos-content">
                <h3 class="no-pos-title">Nenhum cargo de produção vinculado</h3>
                <p class="no-pos-desc">
                  Peça à administração para vincular seus cargos de produção (ex: Tradução, Typeset ou QC) para ver trabalhos específicos.
                </p>
                <button
                  type="button"
                  class="btn-pipeline-general"
                  onclick={() => onNavigateTab('pipeline')}
                >
                  <Layers size={13} />
                  <span>Ver Produção Geral</span>
                </button>
              </div>
            </div>
          {:else if availableStagesData.activeStages.length > 0}
            <!-- ONLY stages that actually have available chapters (> 0) -->
            <div class="available-stages-list">
              {#each availableStagesData.activeStages as stage}
                <div
                  class="available-stage-pill"
                  onclick={() => onNavigateTab('pipeline', stage.slug)}
                  onkeydown={(e) => { if (e.key === 'Enter') onNavigateTab('pipeline', stage.slug); }}
                  role="button"
                  tabindex="0"
                  title="Abrir etapa {stage.name} na produção"
                >
                  <div class="avail-stage-left">
                    <span class="avail-stage-icon">{stage.icon}</span>
                    <div class="avail-stage-meta">
                      <span class="avail-stage-name">{stage.name}</span>
                      <span class="avail-stage-count-text">
                        {stage.count} {stage.count === 1 ? 'capítulo disponível' : 'capítulos disponíveis'}
                      </span>
                    </div>
                  </div>

                  <div class="avail-stage-right">
                    <span class="btn-avail-action">
                      <span>Ver tarefas</span>
                      <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <!-- Clean all-clear state matching exact specification -->
            <div class="all-stages-clear-card">
              <div class="clear-top-row">
                <div class="clear-icon-wrap">
                  <CheckCircle2 size={16} class="text-emerald-400" />
                </div>
                <div class="clear-text-wrap">
                  <h4 class="clear-title">Tudo em dia!</h4>
                  <p class="clear-desc">Nenhum capítulo disponível para assumir.</p>
                </div>
              </div>
              <div class="clear-bottom-row">
                <button
                  type="button"
                  class="btn-open-pipeline-link"
                  onclick={() => onNavigateTab('pipeline')}
                  title="Abrir Área de Produção"
                >
                  <span class="desktop-only-inline">Ver Área de Produção →</span>
                  <span class="mobile-only-inline">Ver Produção →</span>
                </button>
              </div>
            </div>
          {/if}
        </section>
      {/if}

      <!-- 3. AVISOS: Ultra-discreet, informative alerts -->
      <section class="overview-section alerts-section" aria-labelledby="section-avisos">
        <div class="section-title-bar">
          <div class="title-with-icon">
            <div class="icon-bubble red">
              <Bell size={16} />
            </div>
            <div class="title-text-group">
              <h2 id="section-avisos" class="section-heading">Avisos</h2>
              <span class="section-caption">Notificações e recados prioritários</span>
            </div>
          </div>

          <button
            type="button"
            class="link-mural-nav"
            onclick={() => onNavigateTab('mural')}
            title="Abrir o mural da scan"
          >
            <span>Mural</span>
            <ChevronRight size={12} />
          </button>
        </div>

        {#if importantAlerts.length > 0}
          <div class="alerts-compact-list">
            {#each importantAlerts as alert (alert.id)}
              <div
                class="alert-compact-line"
                onclick={() => onNavigateTab(alert.tab)}
                onkeydown={(e) => { if (e.key === 'Enter') onNavigateTab(alert.tab); }}
                role="button"
                tabindex="0"
                title="Clique para ir para {alert.actionLabel}"
              >
                <div class="alert-line-left">
                  <div class="alert-mini-icon" style="--ac: {alert.color}">
                    {#if alert.icon === 'bell'}
                      <Bell size={13} />
                    {:else if alert.icon === 'qc'}
                      <AlertCircle size={13} />
                    {:else if alert.icon === 'pin'}
                      <Pin size={13} />
                    {:else}
                      <Clock size={13} />
                    {/if}
                  </div>
                  <span class="alert-line-text">{alert.text}</span>
                </div>

                <div class="alert-line-right">
                  <span class="alert-link-label">{alert.actionLabel}</span>
                  <ChevronRight size={13} />
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <!-- Zero alerts clean state -->
          <div class="all-clear-compact-chip">
            <CheckCircle2 size={15} class="text-emerald-400" />
            <span>Tudo em ordem! Sem comunicados urgentes ou notificações pendentes.</span>
          </div>
        {/if}
      </section>

      <!-- 4. ACESSO RÁPIDO AO STUDIO: Essential production workspace shortcuts -->
      <section class="overview-section shortcuts-section" aria-labelledby="section-atalhos">
        <div class="section-title-bar">
          <div class="title-with-icon">
            <div class="icon-bubble purple-subtle">
              <Layers size={15} />
            </div>
            <div class="title-text-group">
              <h2 id="section-atalhos" class="section-heading">Acesso Rápido</h2>
              <span class="section-caption">Ferramentas essenciais da produção</span>
            </div>
          </div>
        </div>

        <div class="shortcuts-grid">
          <button
            type="button"
            class="shortcut-tile shortcut-prod"
            onclick={() => onNavigateTab('pipeline')}
            title="Abrir a Área de Produção da scan"
          >
            <div class="shortcut-icon-bubble">
              <Layers size={16} class="text-purple-400" />
            </div>
            <div class="shortcut-text">
              <span class="shortcut-name">Área de Produção</span>
              <span class="shortcut-hint">Fluxo editorial</span>
            </div>
          </button>

          <button
            type="button"
            class="shortcut-tile shortcut-queue"
            onclick={() => onNavigateTab('minha_fila')}
            title="Abrir sua fila de trabalho"
          >
            <div class="shortcut-icon-bubble">
              <Briefcase size={16} class="text-indigo-400" />
            </div>
            <div class="shortcut-text">
              <span class="shortcut-name">Minha Fila</span>
              <span class="shortcut-hint">Tarefas atribuídas</span>
            </div>
          </button>

          <button
            type="button"
            class="shortcut-tile shortcut-mural"
            onclick={() => onNavigateTab('mural')}
            title="Abrir o mural da scan"
          >
            <div class="shortcut-icon-bubble">
              <Pin size={16} class="text-amber-400" />
            </div>
            <div class="shortcut-text">
              <span class="shortcut-name">Mural da Scan</span>
              <span class="shortcut-hint">Avisos e comunicados</span>
            </div>
          </button>

          <button
            type="button"
            class="shortcut-tile shortcut-cal"
            onclick={() => onNavigateTab('calendario')}
            title="Abrir o calendário editorial"
          >
            <div class="shortcut-icon-bubble">
              <Calendar size={16} class="text-cyan-400" />
            </div>
            <div class="shortcut-text">
              <span class="shortcut-name">Calendário</span>
              <span class="shortcut-hint">Cronograma de lançamentos</span>
            </div>
          </button>
        </div>
      </section>
    </aside>
  </div>
</div>

<style>
  /* ========================================================
     PROJECT NOX — RODADA 21 V6.3: FINAL POLISH STUDIO DASHBOARD
     Premium Density, Zero Waste, Dynamic Scenario Balancing, Mobile First
     ======================================================== */

  .workspace-overview-container {
    width: 100%;
    max-width: 1560px;
    margin: 0 auto;
    padding: 0 0 calc(84px + env(safe-area-inset-bottom, 24px)) 0;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    color: #f4f4f5;
    box-sizing: border-box;
    overflow-x: clip;
    min-width: 0;
  }

  @media (min-width: 768px) {
    .workspace-overview-container {
      padding: 0.5rem 0.85rem 3rem 0.85rem;
      gap: 1.15rem;
    }
  }

  @media (min-width: 1024px) {
    .workspace-overview-container {
      padding: 0.75rem 1.25rem 3.5rem 1.25rem;
      gap: 1.35rem;
    }
  }

  /* 0. ULTRA-COMPACT WORKSPACE HEADER (~76-92px desktop, ~72-88px mobile) */
  .workspace-header {
    background: linear-gradient(135deg, rgba(22, 23, 35, 0.94) 0%, rgba(14, 15, 23, 0.98) 100%);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(139, 92, 246, 0.22);
    border-radius: 12px;
    padding: 0.75rem 0.9rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    min-width: 0;
  }

  @media (min-width: 640px) {
    .workspace-header {
      padding: 0.85rem 1.25rem;
      border-radius: 14px;
      gap: 1.1rem;
      min-height: 80px;
    }
  }

  .header-main {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
    flex: 1;
  }

  .header-greeting-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    overflow: hidden;
  }

  .header-purple-accent {
    width: 7px;
    height: 7px;
    border-radius: 9999px;
    background: #a855f7;
    box-shadow: 0 0 8px rgba(168, 85, 247, 0.75);
    display: inline-block;
    flex-shrink: 0;
  }

  .header-title {
    font-size: 1.02rem;
    font-weight: 800;
    letter-spacing: -0.025em;
    color: #ffffff;
    margin: 0;
    line-height: 1.2;
    white-space: nowrap;
    flex-shrink: 0;
  }

  @media (min-width: 360px) {
    .header-title {
      font-size: 1.15rem;
    }
  }

  @media (min-width: 640px) {
    .header-title {
      font-size: 1.35rem;
    }
  }

  .user-greeting-inline {
    font-size: 0.85rem;
    color: #a1a1aa;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .header-stats-row {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.78rem;
    color: #71717a;
    min-width: 0;
  }

  .stat-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    white-space: nowrap;
  }

  .stat-indicator.active {
    color: #c084fc;
  }

  .stat-indicator.clear {
    color: #34d399;
  }

  .stat-indicator.available {
    color: #fbbf24;
  }

  .stat-indicator.alert-stat-btn {
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    color: #f87171;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.22rem;
    font-size: 0.78rem;
    transition: color 0.15s ease, opacity 0.15s ease;
    border-radius: 4px;
  }

  .stat-indicator.alert-stat-btn:hover {
    color: #fca5a5;
    text-decoration: underline;
  }

  .alert-stat-icon {
    color: #f87171;
    flex-shrink: 0;
  }

  .stat-indicator strong {
    font-weight: 700;
  }

  .stat-divider {
    color: #3f3f46;
  }

  .pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 9999px;
    background: #a855f7;
    box-shadow: 0 0 6px rgba(168, 85, 247, 0.7);
    display: inline-block;
  }

  .header-action-col {
    flex-shrink: 0;
  }

  /* Sleek, compact Minha Fila pill with 38px touch target */
  .btn-queue-cta {
    background: rgba(139, 92, 246, 0.16);
    border: 1px solid rgba(139, 92, 246, 0.35);
    color: #e9d5ff;
    font-size: 0.74rem;
    font-weight: 600;
    padding: 0.38rem 0.65rem;
    border-radius: 8px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
    white-space: nowrap;
    min-height: 36px;
    flex-shrink: 0;
  }

  @media (min-width: 360px) {
    .btn-queue-cta {
      font-size: 0.8rem;
      padding: 0.45rem 0.85rem;
      gap: 0.4rem;
      min-height: 38px;
    }
  }

  @media (min-width: 640px) {
    .btn-queue-cta {
      padding: 0.48rem 0.95rem;
      border-radius: 9px;
      font-size: 0.85rem;
      min-height: 38px;
    }
  }

  .btn-queue-cta:hover {
    background: rgba(139, 92, 246, 0.3);
    border-color: rgba(139, 92, 246, 0.55);
    color: #ffffff;
    transform: translateY(-1px);
  }

  .btn-queue-cta:active {
    transform: scale(0.97);
  }

  .queue-counter-chip {
    background: #8b5cf6;
    color: #ffffff;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.05rem 0.42rem;
    border-radius: 9999px;
    min-width: 14px;
    text-align: center;
  }

  /* Responsive Text Visibility Helpers */
  .desktop-only-inline {
    display: none;
  }
  @media (min-width: 640px) {
    .desktop-only-inline {
      display: inline;
    }
  }

  .mobile-only-inline {
    display: inline;
  }
  @media (min-width: 640px) {
    .mobile-only-inline {
      display: none;
    }
  }

  /* ========================================================
     DESKTOP 2-COLUMN STUDIO LAYOUT
     Primary column (~65%), Secondary column (~35%), gap ~22px
     ======================================================== */
  .workspace-grid-layout {
    display: flex;
    flex-direction: column;
    gap: 1.15rem;
    min-width: 0;
  }

  @media (min-width: 1024px) {
    .workspace-grid-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.85fr) minmax(330px, 1fr);
      gap: 1.35rem;
      align-items: start;
    }
  }

  .grid-primary-col {
    display: flex;
    flex-direction: column;
    gap: 1.15rem;
    min-width: 0;
    min-height: 0;
  }

  @media (min-width: 1024px) {
    .grid-primary-col {
      gap: 1.35rem;
    }
  }

  .grid-secondary-col {
    display: flex;
    flex-direction: column;
    gap: 1.15rem;
    min-width: 0;
    min-height: 0;
  }

  @media (min-width: 1024px) {
    .grid-secondary-col {
      gap: 1.35rem;
    }
  }

  /* SECTION TITLE BARS */
  .overview-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }

  .section-title-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0 0.2rem;
    min-width: 0;
  }

  .title-with-icon {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    min-width: 0;
    flex: 1;
  }

  .title-text-group {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  .icon-bubble {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .icon-bubble.purple {
    background: rgba(139, 92, 246, 0.16);
    color: #c084fc;
    border: 1px solid rgba(139, 92, 246, 0.28);
  }

  .icon-bubble.purple-subtle {
    background: rgba(99, 102, 241, 0.14);
    color: #a5b4fc;
    border: 1px solid rgba(99, 102, 241, 0.25);
  }

  .icon-bubble.gold {
    background: rgba(245, 158, 11, 0.16);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.28);
  }

  .icon-bubble.red {
    background: rgba(239, 68, 68, 0.16);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.28);
  }

  .section-heading {
    font-size: 1.05rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
    letter-spacing: -0.01em;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (min-width: 640px) {
    .section-heading {
      font-size: 1.15rem;
    }
  }

  .section-caption {
    font-size: 0.76rem;
    color: #94a3b8;
    display: block;
    margin-top: 0.08rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .badge-count-active {
    font-size: 0.74rem;
    font-weight: 700;
    background: rgba(139, 92, 246, 0.2);
    color: #c084fc;
    padding: 0.16rem 0.55rem;
    border-radius: 9999px;
    border: 1px solid rgba(139, 92, 246, 0.35);
    flex-shrink: 0;
  }

  .badge-count-available {
    font-size: 0.74rem;
    font-weight: 700;
    background: rgba(245, 158, 11, 0.16);
    color: #fbbf24;
    padding: 0.16rem 0.55rem;
    border-radius: 9999px;
    border: 1px solid rgba(245, 158, 11, 0.32);
    flex-shrink: 0;
  }

  .badge-role-context {
    font-size: 0.68rem;
    font-weight: 700;
    background: rgba(245, 158, 11, 0.14);
    color: #fbbf24;
    padding: 0.14rem 0.45rem;
    border-radius: 5px;
    border: 1px solid rgba(245, 158, 11, 0.28);
    text-transform: uppercase;
    flex-shrink: 0;
  }

  /* ========================================================
     1. SEUS TRABALHOS: REFINED STUDIO TASK CARDS (Target Height ~90-115px)
     Proportional 3:4 thumbnail, 2-line title, clean 2-row metadata, balanced CTA
     ======================================================== */
  .active-tasks-list {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    min-width: 0;
  }

  .task-compact-card {
    background: #141520;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 0.75rem 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transition: border-color 0.18s ease, background 0.18s ease, transform 0.12s ease, box-shadow 0.18s ease;
    box-sizing: border-box;
    min-width: 0;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.02);
  }

  @media (min-width: 640px) {
    .task-compact-card {
      padding: 0.85rem 1.15rem;
      gap: 1rem;
      border-radius: 14px;
    }
  }

  @media (max-width: 350px) {
    .task-compact-card {
      flex-wrap: wrap;
      padding: 0.72rem 0.78rem;
      gap: 0.65rem;
    }
    .task-details-col {
      min-width: calc(100% - 54px);
    }
    .task-action-col {
      width: 100%;
      display: flex;
      justify-content: flex-end;
      margin-top: 0.2rem;
    }
    .btn-continue-task {
      width: auto;
      min-height: 32px;
      padding: 0.30rem 0.62rem;
      font-size: 0.74rem;
    }
  }

  .task-compact-card:hover {
    background: #181a28;
    border-color: rgba(139, 92, 246, 0.4);
    transform: translateY(-1px);
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.38), 0 0 10px rgba(139, 92, 246, 0.1);
  }

  .task-compact-card.is-rework {
    border-color: rgba(245, 158, 11, 0.45);
    background: linear-gradient(135deg, rgba(28, 20, 16, 0.75) 0%, rgba(20, 21, 30, 0.98) 100%);
  }

  /* Proportional cover thumbnail (exact 3:4 ratio) */
  .task-visual-col {
    width: 42px;
    height: 56px;
    border-radius: 7px;
    overflow: hidden;
    background: #242533;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  @media (min-width: 640px) {
    .task-visual-col {
      width: 48px;
      height: 64px;
      border-radius: 8px;
    }
  }

  .task-cover-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Editorial stylized fallback in matching 3:4 ratio and subtle tone */
  .task-stage-icon-fallback {
    width: 42px;
    height: 56px;
    border-radius: 7px;
    background: linear-gradient(135deg, rgba(24, 26, 38, 0.95) 0%, rgba(16, 17, 26, 0.98) 100%);
    border: 1px solid rgba(139, 92, 246, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.15rem;
    color: var(--stage-color, #c084fc);
    flex-shrink: 0;
  }

  @media (min-width: 640px) {
    .task-stage-icon-fallback {
      width: 48px;
      height: 64px;
      border-radius: 8px;
      font-size: 1.25rem;
    }
  }

  .task-fallback-icon {
    color: #c084fc;
    opacity: 0.85;
  }

  .task-details-col {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .task-title-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
  }

  /* Support up to 2 full lines of title with zero premature clipping */
  .task-work-name {
    font-size: 0.92rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.3;
    word-break: break-word;
  }

  @media (min-width: 360px) {
    .task-work-name {
      font-size: 0.96rem;
      line-height: 1.32;
    }
  }

  @media (min-width: 640px) {
    .task-work-name {
      font-size: 1.05rem;
      line-height: 1.35;
    }
  }

  .task-meta-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
    min-width: 0;
  }

  .task-meta-row.primary-meta {
    margin-top: 0.05rem;
  }

  .task-meta-row.secondary-meta {
    margin-top: 0.05rem;
  }

  .meta-pill {
    font-size: 0.70rem;
    font-weight: 600;
    padding: 0.12rem 0.42rem;
    border-radius: 5px;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    white-space: nowrap;
    line-height: 1.2;
  }

  @media (min-width: 640px) {
    .meta-pill {
      font-size: 0.78rem;
      padding: 0.14rem 0.52rem;
      border-radius: 6px;
    }
  }

  .meta-pill.chapter {
    background: rgba(255, 255, 255, 0.08);
    color: #e4e4e7;
    font-weight: 700;
  }

  .meta-pill.stage {
    color: var(--stage-c, #c084fc);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .meta-pill.stage .dot {
    width: 5px;
    height: 5px;
    border-radius: 9999px;
    background: var(--stage-c, #c084fc);
  }

  .meta-pill.rework {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.4);
    font-weight: 700;
  }

  .meta-pill.urgent {
    background: rgba(239, 68, 68, 0.18);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
    font-weight: 700;
  }

  .meta-pill.high {
    background: rgba(249, 115, 22, 0.18);
    color: #fb923c;
    border: 1px solid rgba(249, 115, 22, 0.3);
  }

  .meta-pill.deadline {
    background: rgba(6, 182, 212, 0.14);
    color: #67e8f9;
    border: 1px solid rgba(6, 182, 212, 0.25);
    font-size: 0.68rem;
  }

  @media (min-width: 640px) {
    .meta-pill.deadline {
      font-size: 0.74rem;
    }
  }

  .meta-pill.deadline.is-overdue {
    background: rgba(239, 68, 68, 0.14);
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .task-action-col {
    flex-shrink: 0;
  }

  /* Well-proportioned, balanced button: comfortable tap area, no oversized dominance */
  .btn-continue-task {
    position: relative;
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.34rem 0.65rem;
    border-radius: 7px;
    border: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    transition: background 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease;
    min-height: 34px;
    white-space: nowrap;
    box-shadow: 0 1px 5px rgba(124, 58, 237, 0.22);
  }

  /* Extended interactive touch target (44x44px minimum) on mobile devices without layout distortion */
  .btn-continue-task::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    min-width: 44px;
    min-height: 44px;
    width: 100%;
    height: 100%;
    z-index: 1;
  }

  @media (min-width: 640px) {
    .btn-continue-task {
      padding: 0.44rem 0.92rem;
      font-size: 0.84rem;
      border-radius: 8px;
      min-height: 38px;
    }
  }

  .btn-continue-task:hover {
    background: linear-gradient(135deg, #9333ea 0%, #6d28d9 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
  }

  .btn-continue-task:active {
    transform: scale(0.97);
  }

  .btn-continue-task:hover .btn-arrow-icon {
    transform: translateX(2px);
  }

  .btn-arrow-icon {
    transition: transform 0.12s ease;
  }

  .more-tasks-wrapper {
    display: flex;
    justify-content: center;
    padding-top: 0.2rem;
  }

  .btn-view-all-queue {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.09);
    color: #c084fc;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0.45rem 0.95rem;
    border-radius: 8px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    transition: background 0.15s ease, border-color 0.15s ease;
    min-height: 36px;
  }

  .btn-view-all-queue:hover {
    background: rgba(139, 92, 246, 0.12);
    border-color: rgba(139, 92, 246, 0.35);
  }

  /* ========================================================
     SCENARIO B: PROMOTED OPPORTUNITIES (When user has 0 active tasks)
     ======================================================== */
  .subtle-status-banner {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.22);
    border-radius: 11px;
    padding: 0.65rem 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .banner-icon-bubble {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    background: rgba(245, 158, 11, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .banner-text-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    font-size: 0.78rem;
    color: #d4d4d8;
  }

  .banner-text-wrap strong {
    color: #fbbf24;
    font-weight: 700;
  }

  .promoted-stages-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  @media (min-width: 640px) {
    .promoted-stages-grid {
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 0.9rem;
    }
  }

  .promoted-stage-card {
    background: #141520;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 13px;
    padding: 1rem 1.15rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    cursor: pointer;
    transition: background 0.18s ease, border-color 0.18s ease, transform 0.12s ease;
  }

  .promoted-stage-card:hover {
    background: #191b28;
    border-color: rgba(139, 92, 246, 0.4);
    transform: translateY(-2px);
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
  }

  .promoted-stage-card:active {
    transform: scale(0.98);
  }

  .promoted-stage-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .promoted-icon-wrap {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--st-color, rgba(139, 92, 246, 0.3));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
  }

  .promoted-count-pill {
    font-size: 0.76rem;
    font-weight: 700;
    color: #c084fc;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    padding: 0.15rem 0.55rem;
    border-radius: 9999px;
  }

  .promoted-stage-body {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .promoted-stage-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .promoted-stage-desc {
    font-size: 0.78rem;
    color: #a1a1aa;
    margin: 0;
    line-height: 1.4;
  }

  .promoted-stage-footer {
    display: flex;
    align-items: center;
    padding-top: 0.3rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .btn-claim-action {
    color: #c084fc;
    font-size: 0.8rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    transition: color 0.15s ease;
  }

  .promoted-stage-card:hover .btn-claim-action {
    color: #e9d5ff;
  }

  /* All Clear Studio Banner (Scenario C) */
  .all-clear-studio-card {
    background: rgba(20, 21, 32, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 13px;
    padding: 1.25rem 1.4rem;
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .all-clear-icon-wrap {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .all-clear-content {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .all-clear-heading {
    font-size: 0.98rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .all-clear-sub {
    font-size: 0.8rem;
    color: #a1a1aa;
    margin: 0;
    line-height: 1.45;
  }

  .btn-open-pipeline-cta {
    align-self: flex-start;
    margin-top: 0.5rem;
    background: rgba(139, 92, 246, 0.14);
    border: 1px solid rgba(139, 92, 246, 0.3);
    color: #c084fc;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0.4rem 0.85rem;
    border-radius: 7px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 34px;
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .btn-open-pipeline-cta:hover {
    background: rgba(139, 92, 246, 0.25);
    border-color: rgba(139, 92, 246, 0.45);
    color: #ffffff;
  }

  /* ========================================================
     2. DISPONÍVEL PARA VOCÊ: SECONDARY COMPONENT (When active tasks exist)
     ======================================================== */
  .available-stages-list {
    display: flex;
    flex-direction: column;
    gap: 0.48rem;
    min-width: 0;
  }

  .available-stage-pill {
    background: #141520;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 0.65rem 0.85rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
    user-select: none;
    min-height: 48px;
    min-width: 0;
  }

  .available-stage-pill:hover {
    background: #191b28;
    border-color: rgba(139, 92, 246, 0.38);
    transform: translateY(-1px);
  }

  .available-stage-pill:active {
    transform: scale(0.98);
  }

  .avail-stage-left {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    min-width: 0;
    flex: 1;
  }

  .avail-stage-icon {
    font-size: 1.15rem;
    flex-shrink: 0;
  }

  .avail-stage-meta {
    display: flex;
    flex-direction: column;
    gap: 0.06rem;
    min-width: 0;
  }

  .avail-stage-name {
    font-size: 0.86rem;
    font-weight: 700;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .avail-stage-count-text {
    font-size: 0.74rem;
    color: #a1a1aa;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .avail-stage-right {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
  }

  .badge-count-pill {
    background: rgba(139, 92, 246, 0.2);
    color: #c084fc;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 0.1rem 0.5rem;
    border-radius: 9999px;
    border: 1px solid rgba(139, 92, 246, 0.35);
    min-width: 16px;
    text-align: center;
  }

  .avail-chevron {
    color: #71717a;
    transition: transform 0.12s ease;
  }

  .available-stage-pill:hover .avail-chevron {
    color: #c084fc;
    transform: translateX(2px);
  }

  /* Single clean all-clear banner */
  .all-stages-clear-card {
    background: rgba(20, 21, 32, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 0.85rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    min-width: 0;
  }

  .clear-top-row {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    min-width: 0;
  }

  .clear-icon-wrap {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .clear-text-wrap {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .clear-title {
    font-size: 0.88rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
    line-height: 1.3;
  }

  .clear-desc {
    font-size: 0.76rem;
    color: #a1a1aa;
    margin: 0;
    line-height: 1.35;
  }

  .clear-bottom-row {
    display: flex;
    justify-content: flex-end;
  }

  .btn-open-pipeline-link {
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.3);
    color: #c084fc;
    font-size: 0.76rem;
    font-weight: 600;
    padding: 0.38rem 0.75rem;
    border-radius: 7px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    white-space: nowrap;
    min-height: 32px;
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .btn-open-pipeline-link:hover {
    background: rgba(139, 92, 246, 0.24);
    border-color: rgba(139, 92, 246, 0.45);
    color: #ffffff;
  }

  /* NO POSITIONS CARD */
  .no-positions-card {
    background: rgba(20, 21, 32, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 11px;
    padding: 0.85rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .no-pos-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: rgba(139, 92, 246, 0.12);
    color: #c084fc;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .no-pos-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.18rem;
  }

  .no-pos-title {
    font-size: 0.86rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .no-pos-desc {
    font-size: 0.74rem;
    color: #a1a1aa;
    margin: 0;
    line-height: 1.35;
  }

  .btn-pipeline-general {
    align-self: flex-start;
    margin-top: 0.3rem;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.28);
    color: #c084fc;
    font-size: 0.74rem;
    font-weight: 600;
    padding: 0.3rem 0.65rem;
    border-radius: 6px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 30px;
    transition: background 0.15s ease;
  }

  .btn-pipeline-general:hover {
    background: rgba(139, 92, 246, 0.24);
  }

  /* ========================================================
     3. AVISOS E LEMBRETES: ULTRA-DISCREET SINGLE LINES
     ======================================================== */
  .alerts-section {
    padding-top: 0.1rem;
    min-width: 0;
  }

  .link-mural-nav {
    background: transparent;
    border: none;
    color: #71717a;
    font-size: 0.74rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    cursor: pointer;
    transition: color 0.15s ease;
    padding: 0.18rem 0.4rem;
    border-radius: 5px;
    min-height: 28px;
    flex-shrink: 0;
  }

  .link-mural-nav:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.05);
  }

  .alerts-compact-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    min-width: 0;
  }

  .alert-compact-line {
    background: #141520;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 9px;
    padding: 0.52rem 0.8rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.55rem;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
    min-height: 42px;
    user-select: none;
    min-width: 0;
  }

  .alert-compact-line:hover {
    background: #191b28;
    border-color: rgba(255, 255, 255, 0.16);
  }

  .alert-compact-line:active {
    transform: scale(0.98);
  }

  .alert-line-left {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-width: 0;
    flex: 1;
  }

  .alert-mini-icon {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
    color: var(--ac, #c084fc);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .alert-line-text {
    font-size: 0.78rem;
    color: #d4d4d8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .alert-line-right {
    display: inline-flex;
    align-items: center;
    gap: 0.22rem;
    color: #a1a1aa;
    font-size: 0.72rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  .alert-compact-line:hover .alert-line-right {
    color: #c084fc;
  }

  .all-clear-compact-chip {
    background: rgba(20, 21, 32, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 9px;
    padding: 0.65rem 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.76rem;
    color: #a1a1aa;
    min-width: 0;
  }

  /* ========================================================
     4. ACESSO RÁPIDO AO STUDIO: 4 TILES (Solves desktop empty void)
     ======================================================== */
  .shortcuts-section {
    padding-top: 0.15rem;
    min-width: 0;
  }

  .shortcuts-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem;
  }

  .shortcut-tile {
    background: #141520;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 10px;
    padding: 0.6rem 0.65rem;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
    min-height: 52px;
  }

  @media (min-width: 640px) {
    .shortcut-tile {
      padding: 0.65rem 0.8rem;
      gap: 0.65rem;
    }
  }

  .shortcut-tile:hover {
    background: #181928;
    border-color: rgba(139, 92, 246, 0.35);
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3), 0 0 10px rgba(139, 92, 246, 0.08);
  }

  .shortcut-tile.shortcut-prod:hover {
    border-color: rgba(168, 85, 247, 0.45);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3), 0 0 10px rgba(168, 85, 247, 0.12);
  }

  .shortcut-tile.shortcut-queue:hover {
    border-color: rgba(99, 102, 241, 0.45);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3), 0 0 10px rgba(99, 102, 241, 0.12);
  }

  .shortcut-tile.shortcut-mural:hover {
    border-color: rgba(245, 158, 11, 0.45);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3), 0 0 10px rgba(245, 158, 11, 0.12);
  }

  .shortcut-tile.shortcut-cal:hover {
    border-color: rgba(6, 182, 212, 0.45);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3), 0 0 10px rgba(6, 182, 212, 0.12);
  }

  .shortcut-tile:active {
    transform: scale(0.98);
  }

  .shortcut-icon-bubble {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .shortcut-text {
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
    min-width: 0;
    overflow: hidden;
  }

  .shortcut-name {
    font-size: 0.79rem;
    font-weight: 700;
    letter-spacing: -0.015em;
    color: #f4f4f5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (min-width: 640px) {
    .shortcut-name {
      font-size: 0.85rem;
      letter-spacing: 0;
    }
  }

  .shortcut-hint {
    font-size: 0.72rem;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: 639px) {
    .shortcuts-grid {
      gap: 0.45rem;
    }
    .shortcut-tile {
      min-height: 40px;
      padding: 0.42rem 0.6rem;
      gap: 0.5rem;
    }
    .shortcut-icon-bubble {
      width: 26px;
      height: 26px;
      border-radius: 6px;
    }
    .shortcut-icon-bubble :global(svg) {
      width: 14px;
      height: 14px;
    }
    .shortcut-name {
      font-size: 0.76rem;
    }
    .shortcut-hint {
      display: none;
    }
  }

  /* ========================================================
     DESKTOP SCALE CALIBRATION (Linear/Notion Studio Grade)
     Enhances legibility and proportions on >= 1024px
     ======================================================== */
  @media (min-width: 1024px) {
    .header-title {
      font-size: 1.45rem;
    }
    .section-heading {
      font-size: 1.18rem;
    }
    .section-caption {
      font-size: 0.84rem;
    }
    .task-compact-card {
      padding: 0.95rem 1.25rem;
      gap: 1.15rem;
      min-height: 86px;
    }
    .task-visual-col,
    .task-stage-icon-fallback {
      width: 50px;
      height: 67px;
      border-radius: 8px;
    }
    .task-work-name {
      font-size: 1.10rem;
      line-height: 1.35;
    }
    .meta-pill {
      font-size: 0.82rem;
      padding: 0.16rem 0.55rem;
    }
    .btn-continue-task {
      font-size: 0.86rem;
      padding: 0.46rem 0.95rem;
      min-height: 38px;
    }
    .avail-stage-name {
      font-size: 0.94rem;
    }
    .avail-stage-count-text {
      font-size: 0.80rem;
    }
    .available-stage-pill {
      min-height: 54px;
      padding: 0.75rem 1rem;
    }
    .clear-title {
      font-size: 0.94rem;
    }
    .clear-desc {
      font-size: 0.82rem;
    }
    .alert-compact-line {
      min-height: 46px;
      padding: 0.65rem 0.95rem;
    }
    .alert-line-text {
      font-size: 0.84rem;
    }
    .shortcut-tile {
      min-height: 62px;
      padding: 0.75rem 0.95rem;
      gap: 0.75rem;
    }
    .shortcut-icon-bubble {
      width: 36px;
      height: 36px;
      border-radius: 9px;
    }
    .shortcut-name {
      font-size: 0.90rem;
    }
    .shortcut-hint {
      font-size: 0.76rem;
    }
  }

  /* Accessibility & System Preferences */
  button:focus-visible,
  [role="button"]:focus-visible {
    outline: 2px solid #a855f7;
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
</style>