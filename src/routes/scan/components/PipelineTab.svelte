<script lang="ts">
  import {
    Layers,
    Search,
    Filter,
    Clock,
    User,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    FileText,
    BookOpen,
    Eye,
    MessageSquare,
    CheckSquare,
    Lock,
    RotateCcw,
    Sparkles,
    AlertTriangle,
    ChevronRight
  } from '@lucide/svelte';

  let {
    stages = [],
    chapterStages = [],
    chapters = [],
    works = [],
    tasks = [],
    qcIssues = [],
    userRole = 'MEMBER',
    isOwnerOrAdmin = false,
    onOpenChapter = (ch: any) => {}
  } = $props();

  let selectedWorkId = $state<string>('ALL');
  let selectedStatusFilter = $state<string>('ALL');
  let searchQuery = $state('');

  // 7 Canonical stages ordered by display_order
  let orderedStages = $derived(
    [...stages].sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0))
  );

  // Map of chapter_id -> array of chapter_stages ordered
  let chapterStagesMap = $derived(() => {
    const map = new Map<string, any[]>();
    for (const cs of chapterStages) {
      const chId = cs.productionChapterId;
      if (!chId) continue;
      if (!map.has(chId)) map.set(chId, []);
      map.get(chId)!.push(cs);
    }
    for (const [k, v] of map.entries()) {
      v.sort((a: any, b: any) => (a.stage?.displayOrder || 0) - (b.stage?.displayOrder || 0));
    }
    return map;
  });

  // Filtered chapters
  let filteredChapters = $derived(
    chapters.filter((c: any) => {
      const chData = c.chapters || c;
      const workId = chData.workId || chData.works?.id || chData.work?.id;
      const matchesWork = selectedWorkId === 'ALL' || workId === selectedWorkId;

      const title = chData.title || chData.chapterTitle || '';
      const workTitle = chData.works?.title || chData.work?.title || '';
      const num = String(chData.number || chData.chapterNumber || '');
      const matchesSearch =
        !searchQuery.trim() ||
        title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        workTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        num.includes(searchQuery);

      const status = chData.status || 'IN_PROGRESS';
      const matchesStatus =
        selectedStatusFilter === 'ALL' ||
        (selectedStatusFilter === 'IN_PROGRESS' && status === 'IN_PROGRESS') ||
        (selectedStatusFilter === 'READY' && (status === 'READY' || status === 'PRONTO')) ||
        (selectedStatusFilter === 'PUBLISHED' && status === 'PUBLISHED');

      return matchesWork && matchesSearch && matchesStatus;
    })
  );

  // Stats calculation
  let stats = $derived({
    total: chapters.length,
    inProgress: chapters.filter((c: any) => (c.chapters?.status || c.status) === 'IN_PROGRESS').length,
    ready: chapters.filter((c: any) => ['READY', 'PRONTO'].includes(c.chapters?.status || c.status)).length,
    published: chapters.filter((c: any) => (c.chapters?.status || c.status) === 'PUBLISHED').length
  });

  function getChapterMeta(chId: string) {
    const chTasks = tasks.filter((t: any) => t.chapterId === chId);
    const chQc = qcIssues.filter((q: any) => q.chapterId === chId && q.status === 'OPEN');
    return {
      tasksCount: chTasks.length,
      openQcCount: chQc.length
    };
  }

  function getStageState(chId: string, stageSlug: string) {
    const list = chapterStagesMap().get(chId) || [];
    const cs = list.find((s: any) => s.stage?.slug === stageSlug || s.stageSlug === stageSlug);
    if (!cs) {
      return { status: 'UNKNOWN', label: '—', assignee: null, cs: null };
    }
    return {
      status: cs.status,
      label:
        cs.status === 'DONE'
          ? 'Concluído'
          : cs.status === 'IN_PROGRESS'
            ? 'Em Andamento'
            : cs.status === 'AVAILABLE'
              ? 'Disponível'
              : cs.status === 'REWORK'
                ? 'Retrabalho'
                : 'Bloqueado',
      assignee: cs.assignee?.displayName || cs.assignee?.username || null,
      cs
    };
  }
</script>

<div class="pipeline-view-root">
  <!-- Top Header & Stats -->
  <header class="pipeline-header">
    <div class="header-left">
      <div class="title-lockup">
        <div class="icon-bubble">
          <Layers size={22} class="text-purple-400" />
        </div>
        <div>
          <h1 class="page-title">Pipeline Operacional de Produção</h1>
          <p class="page-subtitle">
            Acompanhamento contínuo dos capítulos ao longo das 7 etapas editoriais do Project Nox.
          </p>
        </div>
      </div>
    </div>

    <!-- Quick Stats Pills -->
    <div class="pipeline-stats-chips">
      <button
        type="button"
        class="stat-chip"
        class:active={selectedStatusFilter === 'ALL'}
        onclick={() => (selectedStatusFilter = 'ALL')}
      >
        <span class="stat-num">{stats.total}</span>
        <span class="stat-lbl">Total</span>
      </button>
      <button
        type="button"
        class="stat-chip"
        class:active={selectedStatusFilter === 'IN_PROGRESS'}
        onclick={() => (selectedStatusFilter = 'IN_PROGRESS')}
      >
        <span class="stat-num text-amber-400">{stats.inProgress}</span>
        <span class="stat-lbl">Em Produção</span>
      </button>
      <button
        type="button"
        class="stat-chip"
        class:active={selectedStatusFilter === 'READY'}
        onclick={() => (selectedStatusFilter = 'READY')}
      >
        <span class="stat-num text-sky-400">{stats.ready}</span>
        <span class="stat-lbl">Prontos</span>
      </button>
      <button
        type="button"
        class="stat-chip"
        class:active={selectedStatusFilter === 'PUBLISHED'}
        onclick={() => (selectedStatusFilter = 'PUBLISHED')}
      >
        <span class="stat-num text-emerald-400">{stats.published}</span>
        <span class="stat-lbl">Publicados</span>
      </button>
    </div>
  </header>

  <!-- Filter Controls Toolbar -->
  <div class="pipeline-controls-bar">
    <div class="search-box">
      <Search size={15} class="search-icon" />
      <input
        type="text"
        placeholder="Buscar capítulo, número ou obra..."
        bind:value={searchQuery}
        class="search-field"
      />
      {#if searchQuery}
        <button type="button" class="clear-search-btn" onclick={() => (searchQuery = '')}>×</button>
      {/if}
    </div>

    <div class="filter-actions">
      <div class="select-wrapper">
        <BookOpen size={14} class="select-icon" />
        <select bind:value={selectedWorkId} class="filter-select">
          <option value="ALL">Todas as Obras ({works.length})</option>
          {#each works as w}
            <option value={w.id}>{w.title}</option>
          {/each}
        </select>
      </div>

      <div class="select-wrapper">
        <Filter size={14} class="select-icon" />
        <select bind:value={selectedStatusFilter} class="filter-select">
          <option value="ALL">Todos os Status</option>
          <option value="IN_PROGRESS">Em Produção</option>
          <option value="READY">Pronto p/ Upar</option>
          <option value="PUBLISHED">Publicado</option>
        </select>
      </div>
    </div>
  </div>

  <!-- Chapters Vertical List Feed -->
  <div class="pipeline-chapters-container">
    {#if filteredChapters.length > 0}
      <div class="chapters-vertical-list">
        {#each filteredChapters as c (c.id || c.chapters?.id)}
          {@const chData = c.chapters || c}
          {@const chId = chData.id || chData.targetChapterId || c.id}
          {@const meta = getChapterMeta(chId)}
          {@const work = chData.work || chData.works || {}}
          {@const chNum = chData.chapterNumber || chData.number || '—'}
          {@const chTitle = chData.chapterTitle || chData.title || ''}
          {@const chStatus = chData.status || 'IN_PROGRESS'}

          <article class="chapter-pipeline-card">
            <!-- Top Row: Work info & Primary Action -->
            <div class="card-main-header">
              <div class="work-badge-cluster">
                <div class="work-thumb-mini">
                  {#if work.coverId}
                    <img src="/media/{work.coverId}" alt={work.title} class="work-thumb-img" />
                  {:else}
                    <BookOpen size={14} class="text-purple-300" />
                  {/if}
                </div>

                <div class="work-details-text">
                  <div class="work-title-row">
                    <span class="work-series-name">{work.title || 'Obra'}</span>
                    <span class="chapter-tag">Capítulo #{chNum}</span>
                  </div>
                  {#if chTitle}
                    <h2 class="chapter-sub-heading">{chTitle}</h2>
                  {/if}
                </div>
              </div>

              <!-- Right Actions & Status Badges -->
              <div class="card-top-actions">
                <div class="status-indicator-tag status-{chStatus.toLowerCase()}">
                  <span class="status-dot"></span>
                  <span>{chStatus === 'PUBLISHED' ? 'Publicado' : chStatus === 'READY' ? 'Pronto p/ Upar' : 'Em Produção'}</span>
                </div>

                <button
                  type="button"
                  class="btn-open-workspace"
                  onclick={() => onOpenChapter(chData)}
                  title="Abrir o Workspace completo deste capítulo"
                >
                  <span>Abrir Workspace</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <!-- Compact 7-Stage Stepper Track -->
            <div class="stages-stepper-viewport">
              <div class="stages-stepper-track">
                {#each orderedStages as st, idx}
                  {@const state = getStageState(chId, st.slug)}
                  {@const isDone = state.status === 'DONE'}
                  {@const isProgress = state.status === 'IN_PROGRESS'}
                  {@const isAvail = state.status === 'AVAILABLE'}
                  {@const isBlocked = state.status === 'BLOCKED'}
                  {@const isRework = state.status === 'REWORK'}

                  <div
                    class="stepper-step"
                    class:is-done={isDone}
                    class:is-progress={isProgress}
                    class:is-available={isAvail}
                    class:is-blocked={isBlocked}
                    class:is-rework={isRework}
                    title="{st.name}: {state.label}{state.assignee ? ` (${state.assignee})` : ''}"
                  >
                    <!-- Stage Node Circle -->
                    <div class="step-node-bubble">
                      {#if isDone}
                        <CheckCircle2 size={13} class="node-icon" />
                      {:else if isProgress}
                        <span class="pulse-dot"></span>
                      {:else if isAvail}
                        <span class="open-circle"></span>
                      {:else if isRework}
                        <RotateCcw size={11} class="node-icon" />
                      {:else}
                        <Lock size={10} class="node-icon-locked" />
                      {/if}
                    </div>

                    <!-- Stage Meta Label -->
                    <div class="step-meta-box">
                      <span class="step-name">{st.name}</span>
                      {#if state.assignee}
                        <span class="step-assignee truncate">{state.assignee}</span>
                      {:else}
                        <span class="step-status-sub">{state.label}</span>
                      {/if}
                    </div>

                    <!-- Connector Line (except last) -->
                    {#if idx < orderedStages.length - 1}
                      <div class="step-line" class:line-filled={isDone}></div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>

            <!-- Card Bottom Footer / Metadata -->
            <div class="card-footer-meta">
              <div class="meta-tags-left">
                {#if meta.openQcCount > 0}
                  <span class="meta-tag qc-tag">
                    <AlertTriangle size={12} />
                    <span>QC: {meta.openQcCount} pendência{meta.openQcCount > 1 ? 's' : ''}</span>
                  </span>
                {/if}

                {#if meta.tasksCount > 0}
                  <span class="meta-tag tasks-tag">
                    <CheckSquare size={12} />
                    <span>{meta.tasksCount} tarefa{meta.tasksCount > 1 ? 's' : ''}</span>
                  </span>
                {/if}

                <span class="meta-tag scan-tag">
                  <Clock size={12} />
                  <span>Prioridade: Alta</span>
                </span>
              </div>

              <button
                type="button"
                class="mobile-open-link"
                onclick={() => onOpenChapter(chData)}
              >
                <span>Ver Detalhes do Capítulo</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </article>
        {/each}
      </div>
    {:else}
      <!-- Empty State -->
      <div class="pipeline-empty-state">
        <div class="empty-icon-circle">
          <Layers size={36} class="text-purple-400" />
        </div>
        <h3 class="empty-title">Nenhum capítulo encontrado</h3>
        <p class="empty-desc">
          {#if searchQuery || selectedWorkId !== 'ALL' || selectedStatusFilter !== 'ALL'}
            Nenhum capítulo corresponde aos filtros atuais. Tente limpar a busca ou selecionar outra obra.
          {:else}
            Não há capítulos em produção ativos nesta scan no momento. Crie um novo capítulo na aba Produção.
          {/if}
        </p>
      </div>
    {/if}
  </div>
</div>

<style>
  .pipeline-view-root {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    box-sizing: border-box;
  }

  /* Header */
  .pipeline-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding-bottom: 18px;
  }

  .title-lockup {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .icon-bubble {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .page-title {
    font-size: 20px;
    font-weight: 800;
    color: #f8fafc;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .page-subtitle {
    font-size: 13px;
    color: #94a3b8;
    margin: 4px 0 0;
  }

  /* Stats Chips */
  .pipeline-stats-chips {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .stat-chip {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 6px 12px;
    display: flex;
    align-items: baseline;
    gap: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .stat-chip:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .stat-chip.active {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.4);
  }

  .stat-num {
    font-size: 14px;
    font-weight: 800;
    color: #f1f5f9;
  }

  .stat-lbl {
    font-size: 11.5px;
    color: #94a3b8;
    font-weight: 600;
  }

  /* Controls Bar */
  .pipeline-controls-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .search-box {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 260px;
    max-width: 480px;
  }

  .search-icon {
    position: absolute;
    left: 12px;
    color: #64748b;
    pointer-events: none;
  }

  .search-field {
    width: 100%;
    background: #0d0a18;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 8px 32px 8px 36px;
    font-size: 13px;
    color: #f1f5f9;
    outline: none;
    transition: border-color 0.15s;
  }

  .search-field:focus {
    border-color: #8b5cf6;
  }

  .clear-search-btn {
    position: absolute;
    right: 10px;
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 16px;
    cursor: pointer;
  }

  .filter-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .select-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .select-icon {
    position: absolute;
    left: 10px;
    color: #64748b;
    pointer-events: none;
  }

  .filter-select {
    background: #0d0a18;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 8px 12px 8px 32px;
    font-size: 13px;
    color: #f1f5f9;
    outline: none;
    cursor: pointer;
  }

  .filter-select:focus {
    border-color: #8b5cf6;
  }

  /* Chapters List */
  .pipeline-chapters-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .chapters-vertical-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  /* Chapter Card */
  .chapter-pipeline-card {
    background: #0b0816;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
  }

  .chapter-pipeline-card:hover {
    border-color: rgba(139, 92, 246, 0.35);
    background: #0f0b1e;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  /* Card Header */
  .card-main-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .work-badge-cluster {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .work-thumb-mini {
    width: 36px;
    height: 48px;
    border-radius: 6px;
    overflow: hidden;
    background: #141026;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .work-thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .work-details-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .work-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .work-series-name {
    font-size: 13.5px;
    font-weight: 700;
    color: #e2e8f0;
  }

  .chapter-tag {
    font-size: 11.5px;
    font-weight: 800;
    color: #dfc28d;
    background: rgba(223, 194, 141, 0.12);
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid rgba(223, 194, 141, 0.25);
  }

  .chapter-sub-heading {
    font-size: 13px;
    font-weight: 600;
    color: #94a3b8;
    margin: 0;
  }

  .card-top-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .status-indicator-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 6px;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .status-indicator-tag.status-in_progress {
    background: rgba(245, 158, 11, 0.12);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.25);
  }
  .status-indicator-tag.status-in_progress .status-dot {
    background: #fbbf24;
  }

  .status-indicator-tag.status-ready {
    background: rgba(56, 189, 248, 0.12);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.25);
  }
  .status-indicator-tag.status-ready .status-dot {
    background: #38bdf8;
  }

  .status-indicator-tag.status-published {
    background: rgba(16, 185, 129, 0.12);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.25);
  }
  .status-indicator-tag.status-published .status-dot {
    background: #34d399;
  }

  .btn-open-workspace {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.3);
    color: #c4b5fd;
    font-size: 12px;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-open-workspace:hover {
    background: #8b5cf6;
    color: #ffffff;
    border-color: #8b5cf6;
  }

  /* Compact 9-Stage Stepper */
  .stages-stepper-viewport {
    width: 100%;
    overflow-x: auto;
    padding: 8px 0;
  }

  .stages-stepper-track {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 720px;
  }

  .stepper-step {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    position: relative;
  }

  .step-node-bubble {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: #141026;
    border: 1.5px solid #334155;
    color: #64748b;
    transition: all 0.15s;
  }

  .stepper-step.is-done .step-node-bubble {
    background: rgba(16, 185, 129, 0.18);
    border-color: #10b981;
    color: #34d399;
  }

  .stepper-step.is-progress .step-node-bubble {
    background: rgba(245, 158, 11, 0.18);
    border-color: #f59e0b;
    color: #fbbf24;
    box-shadow: 0 0 10px rgba(245, 158, 11, 0.4);
  }

  .pulse-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #fbbf24;
    animation: pulse 1.8s infinite;
  }

  .open-circle {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 2px solid #38bdf8;
  }

  .stepper-step.is-available .step-node-bubble {
    background: rgba(56, 189, 248, 0.12);
    border-color: #38bdf8;
    color: #38bdf8;
  }

  .stepper-step.is-rework .step-node-bubble {
    background: rgba(239, 68, 68, 0.18);
    border-color: #ef4444;
    color: #f87171;
  }

  .stepper-step.is-blocked .step-node-bubble {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.1);
    color: #475569;
  }

  .step-meta-box {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .step-name {
    font-size: 11px;
    font-weight: 800;
    color: #cbd5e1;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .stepper-step.is-done .step-name {
    color: #34d399;
  }

  .stepper-step.is-progress .step-name {
    color: #fbbf24;
  }

  .stepper-step.is-rework .step-name {
    color: #f87171;
  }

  .step-assignee {
    font-size: 10px;
    color: #c4b5fd;
    font-weight: 600;
    max-width: 70px;
  }

  .step-status-sub {
    font-size: 9.5px;
    color: #64748b;
  }

  .step-line {
    flex: 1;
    height: 2px;
    background: rgba(255, 255, 255, 0.08);
    margin: 0 4px;
    border-radius: 1px;
  }

  .step-line.line-filled {
    background: #10b981;
  }

  /* Card Footer Meta */
  .card-footer-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    padding-top: 10px;
    flex-wrap: wrap;
  }

  .meta-tags-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .meta-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.03);
    padding: 3px 7px;
    border-radius: 4px;
  }

  .meta-tag.qc-tag {
    background: rgba(239, 68, 68, 0.12);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.25);
    font-weight: 700;
  }

  .meta-tag.tasks-tag {
    background: rgba(139, 92, 246, 0.12);
    color: #c4b5fd;
    font-weight: 600;
  }

  .mobile-open-link {
    display: none;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
    color: #8b5cf6;
    background: transparent;
    border: none;
    cursor: pointer;
  }

  /* Empty State */
  .pipeline-empty-state {
    padding: 48px 24px;
    background: #090712;
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .empty-icon-circle {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: rgba(139, 92, 246, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .empty-title {
    font-size: 16px;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0;
  }

  .empty-desc {
    font-size: 13px;
    color: #94a3b8;
    max-width: 440px;
    margin: 0;
    line-height: 1.5;
  }

  @keyframes pulse {
    0% { transform: scale(0.95); opacity: 0.8; }
    50% { transform: scale(1.15); opacity: 1; }
    100% { transform: scale(0.95); opacity: 0.8; }
  }

  /* Mobile Responsiveness */
  @media (max-width: 768px) {
    .pipeline-view-root {
      padding: 14px;
      gap: 14px;
    }

    .pipeline-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .pipeline-controls-bar {
      flex-direction: column;
      align-items: stretch;
    }

    .search-box {
      max-width: 100%;
      min-width: 100%;
    }

    .filter-actions {
      width: 100%;
      justify-content: space-between;
    }

    .filter-select {
      flex: 1;
    }

    .chapter-pipeline-card {
      padding: 14px;
    }

    .card-top-actions .btn-open-workspace {
      display: none;
    }

    .mobile-open-link {
      display: inline-flex;
      width: 100%;
      justify-content: flex-end;
      padding-top: 4px;
    }
  }
</style>
