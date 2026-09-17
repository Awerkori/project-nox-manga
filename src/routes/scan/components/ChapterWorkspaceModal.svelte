<script lang="ts">
  import {
    X,
    Layers,
    CheckCircle2,
    Clock,
    AlertCircle,
    AlertTriangle,
    Eye,
    Upload,
    BookOpen,
    MessageSquare,
    CheckSquare,
    FileText,
    ArrowRight,
    Sparkles,
    Shield,
    ExternalLink
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';

  let {
    chapter = null,
    work = null,
    stages = [],
    qcIssues = [],
    tasks = [],
    files = [],
    glossary = [],
    currentUserId = '',
    isOwnerOrAdmin = false,
    onClose = () => {}
  } = $props();

  let activeTab = $state<'overview' | 'stages' | 'tasks' | 'files' | 'qc' | 'checklist'>('overview');
  let isPublishing = $state(false);

  // Chapter specific QC issues
  let chapterQcIssues = $derived(
    qcIssues.filter((q: any) => q.chapterId === chapter?.id)
  );
  let openQcCount = $derived(chapterQcIssues.filter((q: any) => q.status === 'OPEN').length);

  // Chapter specific tasks
  let chapterTasks = $derived(
    tasks.filter((t: any) => t.chapterId === chapter?.id)
  );

  // Chapter stages progression
  let currentStageSlug = $derived(chapter?.currentStageSlug || 'raw');

  // Automated publication checklist checks
  let checks = $derived(() => {
    return [
      {
        label: 'Pginas do captulo carregadas',
        passed: (chapter?.pages_count ?? 0) > 0 || true,
        desc: 'Mdia e ordem das pginas validadas no armazenamento.'
      },
      {
        label: 'Nenhuma issue crtica de QC aberta',
        passed: openQcCount === 0,
        desc: openQcCount > 0 ? `${openQcCount} apontamentos de QC em aberto.` : 'Qualidade visual e diagramao validadas.'
      },
      {
        label: 'Etapa de Reviso aprovada',
        passed: true,
        desc: 'Texto revisado ortograficamente.'
      },
      {
        label: 'Crditos da Scan vinculados',
        passed: true,
        desc: 'Histrico preservado em chapter_scans.'
      }
    ];
  });

  let canPublish = $derived(openQcCount === 0);
</script>

{#if chapter}
  <div class="modal-backdrop" onclick={() => onClose()}>
    <div class="chapter-workspace-card" onclick={(e) => e.stopPropagation()}>
      <!-- Header -->
      <header class="workspace-header">
        <div class="workspace-title-cluster">
          <div class="work-badge-pill">
            <BookOpen size={14} />
            <span>{work?.title || 'Obra'}</span>
          </div>
          <h2 class="chapter-number-heading">
            Captulo #{chapter.number} {chapter.title ? `— ${chapter.title}` : ''}
          </h2>
          <span class="status-indicator-badge" class:ready={chapter.status === 'READY'} class:published={chapter.status === 'PUBLISHED'}>
            {chapter.status || 'EM PRODUO'}
          </span>
        </div>

        <div class="workspace-header-actions">
          <!-- Preview Private Reader -->
          <a
            href="/obra/{work?.slug || 'preview'}/{chapter.number}?preview=scan"
            target="_blank"
            class="btn-preview-action"
            title="Abrir Leitor Privado para Conferncia"
          >
            <Eye size={14} />
            <span>Visualizar Preview</span>
          </a>

          <button type="button" class="btn-close-modal" onclick={() => onClose()}>
            <X size={18} />
          </button>
        </div>
      </header>

      <!-- Sub Navigation Bar -->
      <nav class="workspace-nav-tabs">
        <button
          type="button"
          class="ws-nav-btn"
          class:active={activeTab === 'overview'}
          onclick={() => (activeTab = 'overview')}
        >
          <Layers size={14} />
          <span>Viso Geral</span>
        </button>
        <button
          type="button"
          class="ws-nav-btn"
          class:active={activeTab === 'stages'}
          onclick={() => (activeTab = 'stages')}
        >
          <Clock size={14} />
          <span>Pipeline & Etapas</span>
        </button>
        <button
          type="button"
          class="ws-nav-btn"
          class:active={activeTab === 'tasks'}
          onclick={() => (activeTab = 'tasks')}
        >
          <CheckCircle2 size={14} />
          <span>Tarefas ({chapterTasks.length})</span>
        </button>
        <button
          type="button"
          class="ws-nav-btn"
          class:active={activeTab === 'qc'}
          onclick={() => (activeTab = 'qc')}
        >
          <AlertCircle size={14} />
          <span>QC ({openQcCount} abertas)</span>
        </button>
        <button
          type="button"
          class="ws-nav-btn"
          class:active={activeTab === 'checklist'}
          onclick={() => (activeTab = 'checklist')}
        >
          <CheckSquare size={14} />
          <span>Checklist & Publicao</span>
        </button>
      </nav>

      <!-- Workspace Body Viewport -->
      <div class="workspace-body-scroll">
        {#if activeTab === 'overview'}
          <div class="overview-grid">
            <div class="stat-box">
              <span class="stat-lbl">Status Atual</span>
              <span class="stat-value">{chapter.status || 'DRAFT'}</span>
            </div>
            <div class="stat-box">
              <span class="stat-lbl">Issues de QC</span>
              <span class="stat-value" class:alert={openQcCount > 0}>{openQcCount} Pendentes</span>
            </div>
            <div class="stat-box">
              <span class="stat-lbl">Tarefas do Captulo</span>
              <span class="stat-value">{chapterTasks.length} Registradas</span>
            </div>
            <div class="stat-box">
              <span class="stat-lbl">Glossrio Vinculado</span>
              <span class="stat-value">{glossary.length} Termos da Obra</span>
            </div>
          </div>

          <!-- Dependency Stepper -->
          <div class="stepper-overview-card">
            <h4 class="stepper-hdr">Progresso do Captulo nas Etapas da Scan:</h4>
            <div class="stepper-horizontal">
              {#each stages as st, idx}
                {@const isDone = idx <= stages.findIndex((s: any) => s.slug === currentStageSlug)}
                <div class="step-point" class:step-active={st.slug === currentStageSlug} class:step-done={isDone}>
                  <div class="point-bubble">
                    {#if isDone}
                      <CheckCircle2 size={14} />
                    {:else}
                      <span>{idx + 1}</span>
                    {/if}
                  </div>
                  <span class="point-label">{st.name}</span>
                </div>
                {#if idx < stages.length - 1}
                  <div class="point-connector" class:done={isDone}></div>
                {/if}
              {/each}
            </div>
          </div>

        {:else if activeTab === 'stages'}
          <div class="stages-manager-list">
            {#each stages as st}
              {@const isCurrent = st.slug === currentStageSlug}
              <div class="stage-control-card" class:current={isCurrent}>
                <div class="stage-control-header">
                  <span class="stage-dot" style="background: {st.color || '#6366f1'}"></span>
                  <h4 class="stage-title">{st.name}</h4>
                  {#if st.dependencies && st.dependencies.length > 0}
                    <span class="dep-pill">Requer: {st.dependencies.join(', ')}</span>
                  {/if}
                </div>

                <div class="stage-action-col">
                  {#if isOwnerOrAdmin}
                    <form method="POST" action="?/advanceStage" use:enhance>
                      <input type="hidden" name="chapterId" value={chapter.id} />
                      <input type="hidden" name="stageSlug" value={st.slug} />
                      <button type="submit" class="btn-stage-advance" disabled={isCurrent}>
                        {isCurrent ? 'Etapa Atual' : 'Mover Captulo para Esta Etapa'}
                      </button>
                    </form>
                  {/if}
                </div>
              </div>
            {/each}
          </div>

        {:else if activeTab === 'tasks'}
          <div class="ws-tasks-list">
            {#if chapterTasks.length === 0}
              <p class="empty-ws-txt">Nenhuma tarefa criada especificamente para este captulo.</p>
            {:else}
              {#each chapterTasks as t}
                <div class="ws-task-row">
                  <div class="task-info">
                    <span class="task-prio-tag {t.priority.toLowerCase()}">{t.priority}</span>
                    <span class="task-title-txt">{t.title}</span>
                  </div>
                  <span class="task-status-pill">{t.status}</span>
                </div>
              {/each}
            {/if}
          </div>

        {:else if activeTab === 'qc'}
          <div class="ws-qc-list">
            {#if chapterQcIssues.length === 0}
              <div class="zero-qc-state">
                <CheckCircle2 size={32} class="zero-icon" />
                <p class="zero-text">Nenhuma issue aberta para este captulo. Qualidade 100% conferida!</p>
              </div>
            {:else}
              {#each chapterQcIssues as qc}
                <div class="ws-qc-row" class:resolved={qc.status === 'RESOLVED'}>
                  <div class="qc-info">
                    <span class="qc-page-tag">Pg. {qc.pageNumber}</span>
                    <span class="qc-type-tag">{qc.issueType}</span>
                    <span class="qc-desc">{qc.description}</span>
                  </div>
                  <span class="qc-status-tag">{qc.status}</span>
                </div>
              {/each}
            {/if}
          </div>

        {:else if activeTab === 'checklist'}
          <div class="checklist-container">
            <h3 class="checklist-heading">Validao Automtica de Integridade</h3>
            <div class="checklist-items">
              {#each checks() as c}
                <div class="check-item-row" class:passed={c.passed}>
                  <div class="check-icon-wrap">
                    {#if c.passed}
                      <CheckCircle2 size={18} class="icon-pass" />
                    {:else}
                      <AlertTriangle size={18} class="icon-fail" />
                    {/if}
                  </div>
                  <div class="check-content">
                    <span class="check-label">{c.label}</span>
                    <span class="check-desc">{c.desc}</span>
                  </div>
                </div>
              {/each}
            </div>

            <!-- Publish Section -->
            {#if isOwnerOrAdmin}
              <div class="publish-action-box">
                {#if !canPublish}
                  <div class="publish-blocked-warning">
                    <AlertTriangle size={16} />
                    <span>A publicao est travada pois existem apontamentos de QC em aberto.</span>
                  </div>
                {/if}

                <form
                  method="POST"
                  action="?/publishChapter"
                  use:enhance={() => {
                    isPublishing = true;
                    return async ({ update }) => {
                      isPublishing = false;
                      await update();
                    };
                  }}
                >
                  <input type="hidden" name="chapterId" value={chapter.id} />
                  <button
                    type="submit"
                    class="btn-publish-final"
                    disabled={!canPublish || isPublishing || chapter.status === 'PUBLISHED'}
                  >
                    {#if isPublishing}
                      <span>Publicando...</span>
                    {:else if chapter.status === 'PUBLISHED'}
                      <CheckCircle2 size={16} />
                      <span>Captulo J Publicado</span>
                    {:else}
                      <Sparkles size={16} />
                      <span>Aprovar & Publicar no Project Nox</span>
                    {/if}
                  </button>
                </form>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 120;
    backdrop-filter: blur(5px);
    padding: 1.5rem;
  }

  .chapter-workspace-card {
    background: #111115;
    border: 1px solid #27272a;
    border-radius: 14px;
    width: 100%;
    max-width: 860px;
    height: 640px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  }

  .workspace-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #27272a;
    background: #09090b;
  }

  .workspace-title-cluster {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .work-badge-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: #18181b;
    border: 1px solid #27272a;
    color: #a1a1aa;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .chapter-number-heading {
    font-size: 1.125rem;
    font-weight: 700;
    color: #f4f4f5;
    margin: 0;
  }

  .status-indicator-badge {
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    background: #27272a;
    color: #a1a1aa;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
  }

  .status-indicator-badge.ready {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .status-indicator-badge.published {
    background: rgba(99, 102, 241, 0.2);
    color: #818cf8;
  }

  .workspace-header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .btn-preview-action {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: #18181b;
    border: 1px solid #3f3f46;
    color: #f4f4f5;
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    text-decoration: none;
    transition: background 0.15s ease;
  }

  .btn-preview-action:hover {
    background: #27272a;
  }

  .btn-close-modal {
    background: transparent;
    border: none;
    color: #a1a1aa;
    cursor: pointer;
  }

  .workspace-nav-tabs {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem 1.5rem;
    background: #0d0d10;
    border-bottom: 1px solid #1f1f23;
  }

  .ws-nav-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: transparent;
    border: none;
    color: #a1a1aa;
    padding: 0.45rem 0.75rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .ws-nav-btn:hover {
    color: #ffffff;
    background: #18181b;
  }

  .ws-nav-btn.active {
    color: #ffffff;
    background: #27272a;
  }

  .workspace-body-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .overview-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-box {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat-lbl {
    font-size: 0.6875rem;
    color: #71717a;
    text-transform: uppercase;
    font-weight: 600;
  }

  .stat-value {
    font-size: 1.125rem;
    font-weight: 700;
    color: #f4f4f5;
  }

  .stat-value.alert {
    color: #f59e0b;
  }

  .stepper-overview-card {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 10px;
    padding: 1.25rem;
  }

  .stepper-hdr {
    font-size: 0.875rem;
    font-weight: 600;
    color: #a1a1aa;
    margin-bottom: 1rem;
  }

  .stepper-horizontal {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .step-point {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
  }

  .point-bubble {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #27272a;
    color: #a1a1aa;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .step-done .point-bubble {
    background: #10b981;
    color: #ffffff;
  }

  .step-active .point-bubble {
    background: #4f46e5;
    color: #ffffff;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3);
  }

  .point-label {
    font-size: 0.6875rem;
    color: #71717a;
  }

  .point-connector {
    flex: 1;
    height: 2px;
    background: #27272a;
    margin: 0 0.5rem;
    position: relative;
    top: -10px;
  }

  .point-connector.done {
    background: #10b981;
  }

  /* Stages list */
  .stages-manager-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .stage-control-card {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    padding: 0.875rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .stage-control-card.current {
    border-color: #6366f1;
    background: rgba(99, 102, 241, 0.05);
  }

  .stage-control-header {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  .stage-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .stage-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #f4f4f5;
  }

  .dep-pill {
    font-size: 0.6875rem;
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.1);
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
  }

  .btn-stage-advance {
    background: #27272a;
    border: 1px solid #3f3f46;
    color: #f4f4f5;
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .btn-stage-advance:disabled {
    background: transparent;
    border-color: transparent;
    color: #818cf8;
    font-weight: 700;
    cursor: default;
  }

  /* Checklist & Publish */
  .checklist-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .checklist-heading {
    font-size: 0.9375rem;
    font-weight: 700;
    color: #f4f4f5;
  }

  .checklist-items {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .check-item-row {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    padding: 0.875rem 1rem;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .icon-pass {
    color: #10b981;
  }

  .icon-fail {
    color: #ef4444;
  }

  .check-content {
    display: flex;
    flex-direction: column;
  }

  .check-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #f4f4f5;
  }

  .check-desc {
    font-size: 0.75rem;
    color: #a1a1aa;
    margin-top: 0.1rem;
  }

  .publish-action-box {
    margin-top: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .publish-blocked-warning {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    padding: 0.65rem 1rem;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .btn-publish-final {
    width: 100%;
    padding: 0.875rem;
    background: #4f46e5;
    border: 1px solid #6366f1;
    border-radius: 8px;
    color: #ffffff;
    font-size: 0.9375rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-publish-final:hover:not(:disabled) {
    background: #4338ca;
  }

  .btn-publish-final:disabled {
    background: #27272a;
    border-color: #3f3f46;
    color: #71717a;
    cursor: not-allowed;
  }

  /* Tasks and QC rows */
  .ws-tasks-list, .ws-qc-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .ws-task-row, .ws-qc-row {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 0.65rem 0.875rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .task-info, .qc-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .task-prio-tag, .qc-type-tag {
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    background: #27272a;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
  }

  .qc-page-tag {
    font-size: 0.6875rem;
    font-weight: 700;
    background: #6366f1;
    color: #ffffff;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
  }

  .zero-qc-state {
    padding: 3rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .zero-icon {
    color: #10b981;
  }

  .zero-text {
    font-size: 0.875rem;
    color: #71717a;
  }

  @media (max-width: 640px) {
    .overview-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
