<script lang="ts">
  import {
    ArrowLeft,
    CheckCircle2,
    Clock,
    User,
    AlertTriangle,
    Eye,
    ExternalLink,
    BookOpen,
    Send,
    Pin,
    Pencil,
    Trash2,
    Copy,
    Check,
    FileText,
    Download,
    Layers,
    Users,
    MessageSquare,
    Lock,
    Sparkles,
    ShieldAlert,
    RotateCcw,
    Globe
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';
  import { relativeTime } from '$lib/types';
  import UserAvatar from '$lib/components/UserAvatar.svelte';

  let {
    chapterId,
    chapter = null,
    scan = null,
    chapters = [],
    stages = [],
    chapterStages = [],
    productionFiles = [],
    chapterTimeline = [],
    chapterNotes = [],
    team = [],
    currentUserId = '',
    userRole = 'MEMBER',
    userPositions = [],
    scanId = '',
    qcIssues = [],
    fromStage = 'traducao',
    onBackToPipeline = () => {}
  } = $props();

  // Find canonical chapter item
  let chapterItem = $derived(
    chapter ||
    chapters.find((c: any) => (c.chapters?.id || c.id) === chapterId || c.target_chapter_id === chapterId) ||
    chapters[0] ||
    null
  );

  let chapterData = $derived(chapterItem?.chapters || chapterItem || {});
  let workData = $derived(chapterData?.works || chapterData?.work || {});
  let actualChapterId = $derived(chapterData.id || chapterId);
  let previewId = $derived(chapterData.target_chapter_id || actualChapterId);

  // Active navigation tab
  let activeTab = $state<'overview' | 'team' | 'comments'>('overview');

  // Stages for this chapter sorted by display_order
  let currentChapterStages = $derived(
    chapterStages
      .filter((cs: any) => cs.production_chapter_id === actualChapterId)
      .sort((a: any, b: any) => (a.stage?.display_order || 0) - (b.stage?.display_order || 0))
  );

  // Canonical stages map
  function getStageBySlug(slug: string) {
    return currentChapterStages.find((cs: any) => {
      const s = (cs.stage?.slug || '').toLowerCase().trim();
      if (slug === 'qc' || slug === 'revisor_qc') return s === 'revisor_qc' || s === 'qc' || s === 'revisao';
      if (slug === 'clean_redraw') return s === 'clean_redraw' || s === 'clean' || s === 'redraw';
      return s === slug;
    });
  }

  let rawStage = $derived(getStageBySlug('raw'));
  let traducaoStage = $derived(getStageBySlug('traducao'));
  let cleanStage = $derived(getStageBySlug('clean_redraw'));
  let typesetStage = $derived(getStageBySlug('typeset'));
  let qcStage = $derived(getStageBySlug('revisor_qc'));
  let preAprovadoStage = $derived(getStageBySlug('pre_aprovado'));
  let publicadoStage = $derived(getStageBySlug('publicado'));

  // Calculate current active overall stage
  let currentActiveStage = $derived(() => {
    const inProgress = currentChapterStages.filter((s: any) => s.status === 'IN_PROGRESS');
    if (inProgress.length > 0) return inProgress.map((s: any) => s.stage?.name).join(' & ');
    const rework = currentChapterStages.filter((s: any) => s.status === 'REWORK');
    if (rework.length > 0) return `Retrabalho em ${rework.map((s: any) => s.stage?.name).join(' & ')}`;
    const avail = currentChapterStages.filter((s: any) => s.status === 'AVAILABLE');
    if (avail.length > 0) return `Disponível (${avail.map((s: any) => s.stage?.name).join(', ')})`;
    if (chapterData.status === 'PUBLISHED') return 'Publicado';
    if (chapterData.status === 'READY') return 'Pronto para publicação';
    return rawStage?.stage?.name || 'RAW';
  });

  // Files for this chapter
  let currentChapterFiles = $derived(
    productionFiles
      .filter((f: any) => f.production_chapter_id === actualChapterId)
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  );

  // Timeline for this chapter
  let currentChapterTimeline = $derived(
    chapterTimeline
      .filter((t: any) => t.production_chapter_id === actualChapterId)
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  );

  // Notes for this chapter
  let currentChapterNotes = $derived(
    chapterNotes
      .filter((note: any) => note.production_chapter_id === actualChapterId)
      .sort((a: any, b: any) => Number(b.is_pinned) - Number(a.is_pinned) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  );

  // Open QC count
  let currentQcIssues = $derived(
    qcIssues.filter((q: any) => q.chapter_id === actualChapterId || q.chapter_id === chapterId)
  );
  let openQcCount = $derived(currentQcIssues.filter((q: any) => q.status === 'OPEN').length);

  // Ready to publish evaluation
  let isReadyToPublish = $derived(
    chapterData.status === 'READY' ||
    (currentChapterStages.length > 0 &&
      currentChapterStages.every((s: any) => s.status === 'DONE' || s.stage?.slug === 'publicado'))
  );

  // Catalog publication status vs Internal Scan Production status
  let isCatalogPublished = $derived(
    chapterData.status === 'PUBLISHED' || Boolean(chapterData.target_chapter_id)
  );

  let chapterWorkflowStatusText = $derived(() => {
    if (chapterData.status === 'PUBLISHED' && currentChapterStages.every((s: any) => s.status === 'DONE')) {
      return 'Concluída';
    }
    return currentActiveStage();
  });

  // Pre-approved evaluation: QC done and no open issues, or chapter already marked ready/published
  let isPreApproved = $derived(
    chapterData.status === 'PUBLISHED' ||
    chapterData.status === 'READY' ||
    (qcStage?.status === 'DONE' && openQcCount === 0)
  );

  // Work cover resolution
  let coverUrl = $derived(
    workData.cover_id
      ? `/media/${workData.cover_id}?size=thumb&v=3`
      : workData.cover_url || ''
  );

  // Human stage label for back button
  let fromStageLabel = $derived(() => {
    if (fromStage === 'traducao') return 'Tradução';
    if (fromStage === 'clean_redraw') return 'Clean/Redraw';
    if (fromStage === 'typeset') return 'Typeset';
    if (fromStage === 'raw') return 'Raw Provider';
    if (fromStage === 'qc' || fromStage === 'revisor_qc') return 'Revisor (QC)';
    return 'Pipeline';
  });

  // Comments composer state
  let newNoteBody = $state('');
  let newNoteKind = $state<'NORMAL' | 'IMPORTANT' | 'PENDING'>('NORMAL');
  let isSubmittingNote = $state(false);
  let noteFeedback = $state<{ type: 'success' | 'error'; text: string } | null>(null);

  // Editing state
  let editingNoteId = $state<string | null>(null);
  let editingNoteBody = $state('');
  let editingNoteKind = $state<'NORMAL' | 'IMPORTANT' | 'PENDING'>('NORMAL');

  function beginNoteEdit(note: any) {
    editingNoteId = note.id;
    editingNoteBody = note.body || '';
    editingNoteKind = note.kind || 'NORMAL';
  }

  function cancelNoteEdit() {
    editingNoteId = null;
    editingNoteBody = '';
    editingNoteKind = 'NORMAL';
  }

  // Copy Credits Sheet state
  let copiedCredits = $state(false);

  function formatStageAssignee(cs: any): { name: string; avatar: any; isAssigned: boolean } {
    if (!cs) return { name: 'Ainda não definido', avatar: null, isAssigned: false };
    if (cs.assignee?.display_name || cs.assignee?.username) {
      return {
        name: `@${cs.assignee.display_name || cs.assignee.username}`,
        avatar: cs.assignee,
        isAssigned: true
      };
    }
    if (cs.status === 'DONE' && (cs.completer?.display_name || cs.completer?.username)) {
      return {
        name: `@${cs.completer.display_name || cs.completer.username}`,
        avatar: cs.completer,
        isAssigned: true
      };
    }
    return { name: 'Ainda não definido', avatar: null, isAssigned: false };
  }

  let rawAssignee = $derived(formatStageAssignee(rawStage));
  let tradAssignee = $derived(formatStageAssignee(traducaoStage));
  let cleanAssignee = $derived(formatStageAssignee(cleanStage));
  let typesetAssignee = $derived(formatStageAssignee(typesetStage));
  let qcAssignee = $derived(formatStageAssignee(qcStage));

  function copyCreditsToClipboard() {
    const rawName = formatStageAssignee(rawStage).name;
    const tradName = formatStageAssignee(traducaoStage).name;
    const cleanName = formatStageAssignee(cleanStage).name;
    const typesetName = formatStageAssignee(typesetStage).name;
    const qcName = formatStageAssignee(qcStage).name;
    const scanName = scan?.name || 'Project Nox';

    const text = [
      `== FICHA TÉCNICA — ${workData.title || 'Obra'} ==`,
      `Capítulo: #${chapterData.chapter_number || chapterData.number || '—'}${chapterData.chapter_title ? ' — ' + chapterData.chapter_title : ''}`,
      `RAW Provider: ${rawName}`,
      `Tradução: ${tradName}`,
      `Clean / Redraw: ${cleanName}`,
      `Typeset: ${typesetName}`,
      `Revisor (QC): ${qcName}`,
      `Scan: ${scanName}`
    ].join('\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        copiedCredits = true;
        setTimeout(() => { copiedCredits = false; }, 3000);
      });
    }
  }

  function formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'DONE': return 'Concluída';
      case 'IN_PROGRESS': return 'Em andamento';
      case 'AVAILABLE': return 'Disponível';
      case 'REWORK': return 'Retrabalho';
      case 'WAITING': return 'Aguardando';
      default: return 'Pendente';
    }
  }
</script>

<div class="chapter-details-root">
  <!-- Top Navigation & Action Header -->
  <header class="chapter-nav-header">
    <div class="header-left-cluster">
      <button
        type="button"
        class="btn-back-stage"
        onclick={onBackToPipeline}
        title="Retornar à lista anterior"
      >
        <ArrowLeft size={16} />
        <span class="btn-back-text-full">Voltar para {fromStageLabel()}</span>
        <span class="btn-back-text-short">Voltar</span>
      </button>

      <div class="header-breadcrumbs">
        <span class="crumb-scan">{scan?.name || 'Project Nox'}</span>
        <span class="crumb-sep">/</span>
        <span class="crumb-work">{workData.title || 'Obra em Produção'}</span>
        <span class="crumb-sep">/</span>
        <span class="crumb-current">Cap. #{chapterData.chapter_number || chapterData.number || '—'}</span>
      </div>
    </div>

    <div class="header-right-actions">
      <a
        href="/ler/{previewId}?preview=1"
        target="_blank"
        rel="noopener noreferrer"
        class="btn-action-preview"
        title="Visualizar no Leitor de Preview interno"
      >
        <Eye size={14} />
        <span class="btn-preview-text-full">Leitor de Preview</span>
        <span class="btn-preview-text-short">Preview</span>
        <ExternalLink size={12} class="icon-subtle icon-preview-external" />
      </a>
    </div>
  </header>

  <!-- Chapter Hero Banner -->
  <section class="chapter-hero-card">
    <div class="hero-cover-wrap">
      {#if coverUrl}
        <img
          src={coverUrl}
          alt={workData.title || 'Capa'}
          class="hero-cover-img"
          loading="eager"
        />
      {:else}
        <div class="hero-cover-fallback">
          <BookOpen size={28} class="text-purple-400" />
        </div>
      {/if}
    </div>

    <div class="hero-info-stack">
      <div class="hero-title-group">
        <span class="hero-series-title">{workData.title || 'Obra em Produção'}</span>
        <h1 class="hero-chapter-title">
          Capítulo #{chapterData.chapter_number || chapterData.number || '—'}
          {#if chapterData.chapter_title || chapterData.title}
            <span class="hero-title-separator">—</span>
            <span class="hero-chapter-sub">{chapterData.chapter_title || chapterData.title}</span>
          {/if}
        </h1>
      </div>

      <!-- Summary Metadata Badges -->
      <div class="hero-badges-row">
        <!-- 1. Catálogo status (No site) -->
        <div class="badge-item catalog-status-badge" class:is-published={isCatalogPublished}>
          <span class="badge-dot" class:dot-green={isCatalogPublished} class:dot-amber={!isCatalogPublished}></span>
          <span class="badge-label">Catálogo:</span>
          <strong>{isCatalogPublished ? 'Publicado no site' : 'Não publicado'}</strong>
        </div>

        <!-- 2. Workflow status (Na scan) -->
        <div class="badge-item current-stage-badge">
          <span class="badge-dot pulse-purple"></span>
          <span class="badge-label">Produção:</span>
          <strong>{chapterWorkflowStatusText()}</strong>
        </div>

        <!-- 3. Prioridade -->
        <div class="badge-item priority-badge">
          <Clock size={12} class="badge-icon-subtle" />
          <span class="badge-label">Prioridade:</span>
          <strong>{chapterData.priority || 'Normal'}</strong>
        </div>

        <!-- 4. Scan -->
        <div class="badge-item scan-badge">
          <span class="badge-label">Scan:</span>
          <strong>{scan?.name || 'Project Nox'}</strong>
        </div>

        <!-- 5. QC Alert if open -->
        {#if openQcCount > 0}
          <div class="badge-item qc-alert-badge">
            <AlertTriangle size={12} />
            <strong>QC: {openQcCount} pendência{openQcCount > 1 ? 's' : ''}</strong>
          </div>
        {/if}

        <!-- 6. Action button: Publicar capítulo (Dedicated position inside info row) -->
        {#if ['OWNER', 'ADMIN', 'UPLOADER'].includes(userRole) && !isCatalogPublished && isReadyToPublish}
          <form method="POST" action="?/publishProductionChapter" use:enhance class="publish-form-inline">
            <input type="hidden" name="production_chapter_id" value={actualChapterId} />
            <input type="hidden" name="scan_id" value={scanId} />
            <button
              type="submit"
              class="btn-badge-publish"
              title="Aprovar e publicar este capítulo no catálogo público"
            >
              <CheckCircle2 size={13} />
              <span>Publicar Capítulo</span>
            </button>
          </form>
        {/if}
      </div>
    </div>
  </section>

  <!-- Segmented Primary Navigation Tabs -->
  <nav class="chapter-details-tabs" aria-label="Navegação da página do capítulo">
    <button
      type="button"
      class="details-tab-btn"
      class:is-active={activeTab === 'overview'}
      onclick={() => (activeTab = 'overview')}
    >
      <Layers size={15} />
      <span>Visão Geral</span>
    </button>

    <button
      type="button"
      class="details-tab-btn"
      class:is-active={activeTab === 'team'}
      onclick={() => (activeTab = 'team')}
    >
      <Users size={15} />
      <span class="tab-label-full">Créditos e Equipe</span>
      <span class="tab-label-short">Equipe</span>
    </button>

    <button
      type="button"
      class="details-tab-btn"
      class:is-active={activeTab === 'comments'}
      onclick={() => (activeTab = 'comments')}
    >
      <MessageSquare size={15} />
      <span>Comentários</span>
      {#if currentChapterNotes.length > 0}
        <span class="tab-count-pill">{currentChapterNotes.length}</span>
      {/if}
    </button>
  </nav>

  <!-- TAB 1: VISÃO GERAL (COMPACT PIPELINE WITH PARALLEL TRADUÇÃO + CLEAN/REDRAW) -->
  {#if activeTab === 'overview'}
    <div class="tab-pane-overview">
      <div class="overview-section-header">
        <h2 class="overview-heading">Fluxo Editorial da Produção</h2>
        <p class="overview-subtitle">
          Acompanhe o estado de cada etapa em tempo real. Tradução e Clean/Redraw ocorrem em paralelo após a disponibilização do RAW.
        </p>
      </div>

      <!-- DESKTOP PIPELINE FLOW: RAW -> [ Tradução // Clean ] -> Typeset -> QC -> Pré -> Pub -->
      <div class="desktop-pipeline-flow" aria-label="Diagrama do fluxo da pipeline">
        <!-- 1. RAW PROVIDER -->
        <div class="flow-stage-node status-{rawStage?.status?.toLowerCase() || 'waiting'}">
          <div class="node-header">
            <span class="node-step-tag">Etapa 1</span>
            <span class="node-status-pill">{getStatusLabel(rawStage?.status || 'WAITING')}</span>
          </div>
          <div class="node-title">RAW Provider</div>
          <div class="node-assignee">
            <User size={12} />
            <span>{formatStageAssignee(rawStage).name}</span>
          </div>
        </div>

        <!-- Connector: RAW to Parallel Branch -->
        <div class="flow-connector split-fork">
          <svg viewBox="0 0 40 120" class="fork-svg">
            <path d="M 0 60 L 20 60 L 20 25 L 40 25 M 20 60 L 20 95 L 40 95" fill="none" stroke="rgba(139, 92, 246, 0.4)" stroke-width="2" />
          </svg>
        </div>

        <!-- 2. PARALLEL BLOCK: TRADUÇÃO & CLEAN/REDRAW -->
        <div class="flow-parallel-column">
          <div class="parallel-block-label">Etapas Paralelas</div>

          <!-- Upper Branch: Tradução -->
          <div class="flow-stage-node parallel-node status-{traducaoStage?.status?.toLowerCase() || 'waiting'}">
            <div class="node-header">
              <span class="node-step-tag">Etapa 2</span>
              <span class="node-status-pill">{getStatusLabel(traducaoStage?.status || 'WAITING')}</span>
            </div>
            <div class="node-title">Tradução</div>
            <div class="node-assignee">
              <User size={12} />
              <span>{formatStageAssignee(traducaoStage).name}</span>
            </div>
          </div>

          <!-- Lower Branch: Clean/Redraw -->
          <div class="flow-stage-node parallel-node status-{cleanStage?.status?.toLowerCase() || 'waiting'}">
            <div class="node-header">
              <span class="node-step-tag">Etapa 3</span>
              <span class="node-status-pill">{getStatusLabel(cleanStage?.status || 'WAITING')}</span>
            </div>
            <div class="node-title">Clean / Redraw</div>
            <div class="node-assignee">
              <User size={12} />
              <span>{formatStageAssignee(cleanStage).name}</span>
            </div>
          </div>
        </div>

        <!-- Connector: Parallel Join into Typeset -->
        <div class="flow-connector join-fork">
          <svg viewBox="0 0 40 120" class="fork-svg">
            <path d="M 0 25 L 20 25 L 20 60 L 40 60 M 0 95 L 20 95 L 20 60" fill="none" stroke="rgba(139, 92, 246, 0.4)" stroke-width="2" />
          </svg>
        </div>

        <!-- 3. TYPESET -->
        <div class="flow-stage-node status-{typesetStage?.status?.toLowerCase() || 'waiting'}">
          <div class="node-header">
            <span class="node-step-tag">Etapa 4</span>
            <span class="node-status-pill">{getStatusLabel(typesetStage?.status || 'WAITING')}</span>
          </div>
          <div class="node-title">Typeset</div>
          <div class="node-assignee">
            <User size={12} />
            <span>{formatStageAssignee(typesetStage).name}</span>
          </div>
        </div>

        <!-- Arrow Connector -->
        <div class="flow-connector straight-arrow">
          <div class="arrow-line"></div>
        </div>

        <!-- 4. REVISOR (QC) -->
        <div class="flow-stage-node status-{qcStage?.status?.toLowerCase() || 'waiting'}">
          <div class="node-header">
            <span class="node-step-tag">Etapa 5</span>
            <span class="node-status-pill">{getStatusLabel(qcStage?.status || 'WAITING')}</span>
          </div>
          <div class="node-title">Revisor (QC)</div>
          <div class="node-assignee">
            <User size={12} />
            <span>{formatStageAssignee(qcStage).name}</span>
          </div>
        </div>

        <!-- Arrow Connector -->
        <div class="flow-connector straight-arrow">
          <div class="arrow-line"></div>
        </div>

        <!-- 5. PRÉ-APROVADO -->
        <div class="flow-stage-node status-{isPreApproved ? 'done' : qcStage?.status === 'IN_PROGRESS' ? 'in_progress' : isReadyToPublish ? 'available' : 'waiting'}">
          <div class="node-header">
            <span class="node-step-tag">Etapa 6</span>
            <span class="node-status-pill">{isPreApproved ? 'Aprovado' : qcStage?.status === 'IN_PROGRESS' ? 'Em validação' : isReadyToPublish ? 'Pronto' : 'Aguardando'}</span>
          </div>
          <div class="node-title">Pré-aprovado</div>
          <div class="node-assignee">
            <CheckCircle2 size={12} />
            <span>Validação final e build</span>
          </div>
        </div>

        <!-- Arrow Connector -->
        <div class="flow-connector straight-arrow">
          <div class="arrow-line"></div>
        </div>

        <!-- 6. PUBLICADO -->
        <div class="flow-stage-node status-{isCatalogPublished ? 'done' : isReadyToPublish ? 'available' : 'waiting'}">
          <div class="node-header">
            <span class="node-step-tag">Etapa 7</span>
            <span class="node-status-pill">{isCatalogPublished ? 'No Ar' : isReadyToPublish ? 'Pronto' : 'Pendente'}</span>
          </div>
          <div class="node-title">Publicado</div>
          <div class="node-assignee">
            <Globe size={12} />
            <span>Catálogo Project Nox</span>
          </div>
        </div>
      </div>

      <!-- MOBILE VERTICAL COMPACT TIMELINE (CLEAN, NO HORIZONTAL SCROLL) -->
      <div class="mobile-vertical-timeline">
        <!-- 1. RAW -->
        <div class="mobile-timeline-card status-{rawStage?.status?.toLowerCase() || 'waiting'}">
          <div class="card-timeline-left">
            <span class="timeline-step-bubble">1</span>
            <div class="timeline-vertical-spine"></div>
          </div>
          <div class="card-timeline-content">
            <div class="timeline-card-top">
              <span class="timeline-stage-title">RAW Provider</span>
              <span class="timeline-status-tag">{getStatusLabel(rawStage?.status || 'WAITING')}</span>
            </div>
            <div class="timeline-card-assignee">
              <User size={12} />
              <span>{formatStageAssignee(rawStage).name}</span>
            </div>
          </div>
        </div>

        <!-- 2. PARALLEL CONTAINER (TRADUÇÃO + CLEAN/REDRAW) -->
        <div class="mobile-parallel-container">
          <div class="parallel-spine-indicator">
            <span class="parallel-spine-tag">Etapas Paralelas</span>
          </div>

          <div class="mobile-parallel-subcards">
            <!-- Tradução -->
            <div class="mobile-timeline-card sub-parallel status-{traducaoStage?.status?.toLowerCase() || 'waiting'}">
              <div class="card-timeline-left">
                <span class="timeline-step-bubble">2</span>
              </div>
              <div class="card-timeline-content">
                <div class="timeline-card-top">
                  <span class="timeline-stage-title">Tradução</span>
                  <span class="timeline-status-tag">{getStatusLabel(traducaoStage?.status || 'WAITING')}</span>
                </div>
                <div class="timeline-card-assignee">
                  <User size={12} />
                  <span>{formatStageAssignee(traducaoStage).name}</span>
                </div>
              </div>
            </div>

            <!-- Clean / Redraw -->
            <div class="mobile-timeline-card sub-parallel status-{cleanStage?.status?.toLowerCase() || 'waiting'}">
              <div class="card-timeline-left">
                <span class="timeline-step-bubble">3</span>
              </div>
              <div class="card-timeline-content">
                <div class="timeline-card-top">
                  <span class="timeline-stage-title">Clean / Redraw</span>
                  <span class="timeline-status-tag">{getStatusLabel(cleanStage?.status || 'WAITING')}</span>
                </div>
                <div class="timeline-card-assignee">
                  <User size={12} />
                  <span>{formatStageAssignee(cleanStage).name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. TYPESET -->
        <div class="mobile-timeline-card status-{typesetStage?.status?.toLowerCase() || 'waiting'}">
          <div class="card-timeline-left">
            <span class="timeline-step-bubble">4</span>
            <div class="timeline-vertical-spine"></div>
          </div>
          <div class="card-timeline-content">
            <div class="timeline-card-top">
              <span class="timeline-stage-title">Typeset</span>
              <span class="timeline-status-tag">{getStatusLabel(typesetStage?.status || 'WAITING')}</span>
            </div>
            <div class="timeline-card-assignee">
              <User size={12} />
              <span>{formatStageAssignee(typesetStage).name}</span>
            </div>
          </div>
        </div>

        <!-- 4. REVISOR (QC) -->
        <div class="mobile-timeline-card status-{qcStage?.status?.toLowerCase() || 'waiting'}">
          <div class="card-timeline-left">
            <span class="timeline-step-bubble">5</span>
            <div class="timeline-vertical-spine"></div>
          </div>
          <div class="card-timeline-content">
            <div class="timeline-card-top">
              <span class="timeline-stage-title">Revisor (QC)</span>
              <span class="timeline-status-tag">{getStatusLabel(qcStage?.status || 'WAITING')}</span>
            </div>
            <div class="timeline-card-assignee">
              <User size={12} />
              <span>{formatStageAssignee(qcStage).name}</span>
            </div>
          </div>
        </div>

        <!-- 6. PRÉ-APROVADO -->
        <div class="mobile-timeline-card status-{isPreApproved ? 'done' : qcStage?.status === 'IN_PROGRESS' ? 'in_progress' : isReadyToPublish ? 'available' : 'waiting'}">
          <div class="card-timeline-left">
            <span class="timeline-step-bubble">6</span>
            <div class="timeline-vertical-spine"></div>
          </div>
          <div class="card-timeline-content">
            <div class="timeline-card-top">
              <span class="timeline-stage-title">Pré-aprovado</span>
              <span class="timeline-status-tag">{isPreApproved ? 'Aprovado' : qcStage?.status === 'IN_PROGRESS' ? 'Em validação' : isReadyToPublish ? 'Pronto' : 'Aguardando'}</span>
            </div>
            <div class="timeline-card-assignee">
              <CheckCircle2 size={12} />
              <span>Validação final e build aprovados</span>
            </div>
          </div>
        </div>

        <!-- 7. PUBLICADO -->
        <div class="mobile-timeline-card status-{isCatalogPublished ? 'done' : isReadyToPublish ? 'available' : 'waiting'}">
          <div class="card-timeline-left">
            <span class="timeline-step-bubble final">✓</span>
          </div>
          <div class="card-timeline-content">
            <div class="timeline-card-top">
              <span class="timeline-stage-title">Publicado no Site</span>
              <span class="timeline-status-tag">{isCatalogPublished ? 'No Ar' : isReadyToPublish ? 'Pronto' : 'Pendente'}</span>
            </div>
            <div class="timeline-card-assignee">
              <Globe size={12} />
              <span>Catálogo oficial do Project Nox</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ARQUIVOS E ENTREGAS REGISTRADOS DESTE CAPÍTULO -->
      <section class="overview-deliverables-panel">
        <h3 class="deliverables-panel-title">
          <FileText size={16} class="text-purple-400" />
          <span>Arquivos e Entregas deste Capítulo ({currentChapterFiles.length})</span>
        </h3>

        {#if currentChapterFiles.length > 0}
          <div class="deliverables-list-grid">
            {#each currentChapterFiles as file (file.id)}
              <div class="deliverable-file-card">
                <div class="file-icon-box">
                  <FileText size={18} class="text-purple-400" />
                </div>
                <div class="file-meta-col">
                  <span class="file-card-name" title={file.file_name}>{file.file_name}</span>
                  <div class="file-card-tags">
                    <span class="stage-tag">{file.stage?.name || file.stage_slug || 'Arquivo'}</span>
                    <span class="version-tag">v{file.version}</span>
                    <span class="size-tag">{formatBytes(file.byte_size)}</span>
                  </div>
                </div>
                <a
                  href="/api/scan/production/files/{file.id}?download=1"
                  download={file.file_name}
                  class="btn-file-download"
                  title="Baixar arquivo"
                >
                  <Download size={14} />
                  <span>Baixar</span>
                </a>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-deliverables-box">
            <Sparkles size={20} class="text-purple-400" />
            <p>Nenhum arquivo ou pacote de entrega registrado ainda neste capítulo.</p>
          </div>
        {/if}
      </section>
    </div>
  {/if}

  <!-- TAB 2: CRÉDITOS E EQUIPE (FICHA TÉCNICA EDITORIAL COMPLETA) -->
  {#if activeTab === 'team'}
    <div class="tab-pane-team">
      <div class="team-sheet-header">
        <div class="team-header-left">
          <h2 class="team-heading">Equipe do Capítulo #{chapterData.chapter_number || chapterData.number || '—'}</h2>
          <p class="team-subheading">
            Ficha técnica oficial para consulta dos créditos da scan e registro de atribuições editoriais.
          </p>
        </div>

        <button
          type="button"
          class="btn-copy-credits"
          onclick={copyCreditsToClipboard}
          title="Copiar créditos formatados para colar na página de créditos"
        >
          {#if copiedCredits}
            <Check size={14} class="text-emerald-400" />
            <span>Copiado!</span>
          {:else}
            <Copy size={14} />
            <span>Copiar Créditos em Texto</span>
          {/if}
        </button>
      </div>

      <!-- EDITORIAL TECHNICAL SHEET CARDS -->
      <div class="team-roles-grid">
        <!-- 1. RAW PROVIDER -->
        <div class="role-sheet-card" class:has-assignee={rawAssignee.isAssigned}>
          <div class="role-top-row">
            <span class="role-name-tag">RAW Provider</span>
            <span class="role-status-badge status-{rawStage?.status?.toLowerCase() || 'waiting'}">
              {getStatusLabel(rawStage?.status || 'WAITING')}
            </span>
          </div>
          <div class="role-member-row">
            <UserAvatar user={rawAssignee.avatar} size={38} />
            <div class="role-member-info">
              <strong class="member-display-name">{rawAssignee.name}</strong>
              <span class="member-role-desc">Responsável pelos arquivos brutos originais</span>
            </div>
          </div>
        </div>

        <!-- 2. TRADUÇÃO -->
        <div class="role-sheet-card" class:has-assignee={tradAssignee.isAssigned}>
          <div class="role-top-row">
            <span class="role-name-tag">Tradução</span>
            <span class="role-status-badge status-{traducaoStage?.status?.toLowerCase() || 'waiting'}">
              {getStatusLabel(traducaoStage?.status || 'WAITING')}
            </span>
          </div>
          <div class="role-member-row">
            <UserAvatar user={tradAssignee.avatar} size={38} />
            <div class="role-member-info">
              <strong class="member-display-name">{tradAssignee.name}</strong>
              <span class="member-role-desc">Tradução e adaptação textual do capítulo</span>
            </div>
          </div>
        </div>

        <!-- 3. CLEAN / REDRAW -->
        <div class="role-sheet-card" class:has-assignee={cleanAssignee.isAssigned}>
          <div class="role-top-row">
            <span class="role-name-tag">Clean / Redraw</span>
            <span class="role-status-badge status-{cleanStage?.status?.toLowerCase() || 'waiting'}">
              {getStatusLabel(cleanStage?.status || 'WAITING')}
            </span>
          </div>
          <div class="role-member-row">
            <UserAvatar user={cleanAssignee.avatar} size={38} />
            <div class="role-member-info">
              <strong class="member-display-name">{cleanAssignee.name}</strong>
              <span class="member-role-desc">Limpeza de balões e reconstrução artística</span>
            </div>
          </div>
        </div>

        <!-- 4. TYPESET -->
        <div class="role-sheet-card" class:has-assignee={typesetAssignee.isAssigned}>
          <div class="role-top-row">
            <span class="role-name-tag">Typeset</span>
            <span class="role-status-badge status-{typesetStage?.status?.toLowerCase() || 'waiting'}">
              {getStatusLabel(typesetStage?.status || 'WAITING')}
            </span>
          </div>
          <div class="role-member-row">
            <UserAvatar user={typesetAssignee.avatar} size={38} />
            <div class="role-member-info">
              <strong class="member-display-name">{typesetAssignee.name}</strong>
              <span class="member-role-desc">Diagramação, fontes e pós-produção</span>
            </div>
          </div>
        </div>

        <!-- 5. REVISOR (QC) -->
        <div class="role-sheet-card" class:has-assignee={qcAssignee.isAssigned}>
          <div class="role-top-row">
            <span class="role-name-tag">Revisor (QC)</span>
            <span class="role-status-badge status-{qcStage?.status?.toLowerCase() || 'waiting'}">
              {getStatusLabel(qcStage?.status || 'WAITING')}
            </span>
          </div>
          <div class="role-member-row">
            <UserAvatar user={qcAssignee.avatar} size={38} />
            <div class="role-member-info">
              <strong class="member-display-name">{qcAssignee.name}</strong>
              <span class="member-role-desc">Controle de qualidade e validação final</span>
            </div>
          </div>
        </div>
      </div>

      <!-- HISTÓRICO DE ATRIBUIÇÕES E EVENTOS DESTE CAPÍTULO -->
      <section class="team-history-section">
        <h3 class="team-history-title">
          <Clock size={16} class="text-purple-400" />
          <span>Histórico de Atribuições e Entregas</span>
        </h3>

        {#if currentChapterTimeline.length > 0}
          <div class="timeline-events-list">
            {#each currentChapterTimeline as ev (ev.id)}
              <div class="timeline-event-item">
                <span class="event-time" title={new Date(ev.created_at).toLocaleString('pt-BR')}>
                  {relativeTime(ev.created_at)}
                </span>
                <span class="event-type-badge">{ev.event_type}</span>
                <span class="event-desc">
                  <strong>{ev.user_name || 'Membro'}</strong>: {ev.stage_slug ? `Etapa ${ev.stage_slug}` : 'Ação editorial'}
                </span>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-history-box">
            <p>Nenhuma transferência ou evento registrado até o momento.</p>
          </div>
        {/if}
      </section>
    </div>
  {/if}

  <!-- TAB 3: COMENTÁRIOS INTERNOS (LINHA DO TEMPO PERMANENTE DO CAPÍTULO) -->
  {#if activeTab === 'comments'}
    <div class="tab-pane-comments">
      <div class="comments-section-header">
        <div>
          <h2 class="comments-heading">Comunicação Interna do Capítulo</h2>
          <p class="comments-subheading">
            Histórico permanente do capítulo. Observações deixadas aqui acompanham a produção através de todas as etapas (Tradução, Clean, Typeset e QC).
          </p>
        </div>
      </div>

      {#if noteFeedback}
        <div class="comment-alert-banner {noteFeedback.type}">
          <span>{noteFeedback.text}</span>
          <button type="button" class="btn-close-alert" onclick={() => (noteFeedback = null)}>×</button>
        </div>
      {/if}

      <!-- CHAT / NOTES THREAD TIMELINE -->
      <div class="comments-thread-container" aria-live="polite">
        {#if currentChapterNotes.length > 0}
          {#each currentChapterNotes as note (note.id)}
            <article
              id="chapter-note-{note.id}"
              class="comment-card kind-{note.kind.toLowerCase()}"
              class:is-pinned={note.is_pinned}
            >
              <div class="comment-author-avatar">
                <UserAvatar user={note.author} size={36} />
              </div>

              <div class="comment-body-wrapper">
                <header class="comment-card-topline">
                  <div class="comment-meta-left">
                    <strong class="comment-author-name">
                      {note.author?.display_name || note.author?.username || 'Membro'}
                    </strong>
                    {#if note.stage?.name}
                      <span class="comment-stage-tag">{note.stage.name}</span>
                    {/if}
                    {#if note.is_pinned}
                      <span class="comment-badge-pinned">
                        <Pin size={11} />
                        Fixada
                      </span>
                    {/if}
                    {#if note.kind === 'IMPORTANT'}
                      <span class="comment-badge-important">Importante</span>
                    {:else if note.kind === 'PENDING'}
                      <span class="comment-badge-pending">Pendência</span>
                    {/if}
                  </div>

                  <time class="comment-timestamp" datetime={note.created_at} title={new Date(note.created_at).toLocaleString('pt-BR')}>
                    {relativeTime(note.created_at)}
                  </time>
                </header>

                {#if editingNoteId === note.id}
                  <!-- Inline Edit Form -->
                  <form
                    method="POST"
                    action="?/editChapterNote"
                    use:enhance={() => {
                      return async ({ result, update }) => {
                        if (result.type === 'success') cancelNoteEdit();
                        await update();
                      };
                    }}
                    class="comment-edit-form"
                  >
                    <input type="hidden" name="note_id" value={note.id} />
                    <div class="edit-form-top">
                      <select name="kind" bind:value={editingNoteKind} class="edit-kind-select" aria-label="Tipo de observação">
                        <option value="NORMAL">Normal</option>
                        <option value="IMPORTANT">Importante</option>
                        <option value="PENDING">Pendência</option>
                      </select>
                    </div>
                    <textarea
                      name="body"
                      bind:value={editingNoteBody}
                      maxlength="3000"
                      class="edit-body-textarea"
                      required
                    ></textarea>
                    <div class="edit-form-actions">
                      <button type="submit" class="btn-edit-save">Salvar</button>
                      <button type="button" class="btn-edit-cancel" onclick={cancelNoteEdit}>Cancelar</button>
                    </div>
                  </form>
                {:else}
                  <div class="comment-text-content">
                    {note.body}
                  </div>
                {/if}

                {#if note.canEdit || note.canDelete || note.canPin}
                  <div class="comment-actions-bar">
                    {#if note.canEdit}
                      <button type="button" class="btn-note-action" onclick={() => beginNoteEdit(note)}>
                        <Pencil size={12} />
                        <span>Editar</span>
                      </button>
                    {/if}

                    {#if note.canPin}
                      <form method="POST" action="?/pinChapterNote" use:enhance class="inline-action-form">
                        <input type="hidden" name="note_id" value={note.id} />
                        <input type="hidden" name="pinned" value={note.is_pinned ? 'false' : 'true'} />
                        <button type="submit" class="btn-note-action">
                          <Pin size={12} />
                          <span>{note.is_pinned ? 'Desafixar' : 'Fixar'}</span>
                        </button>
                      </form>
                    {/if}

                    {#if note.canDelete}
                      <form method="POST" action="?/deleteChapterNote" use:enhance class="inline-action-form">
                        <input type="hidden" name="note_id" value={note.id} />
                        <button type="submit" class="btn-note-action delete-action">
                          <Trash2 size={12} />
                          <span>Remover</span>
                        </button>
                      </form>
                    {/if}
                  </div>
                {/if}
              </div>
            </article>
          {/each}
        {:else}
          <div class="empty-comments-card">
            <MessageSquare size={32} class="text-purple-400" />
            <h3>Nenhuma observação interna registrada</h3>
            <p>
              Use este espaço para registrar termos específicos de tradução, balões complexos, onomatopeias ou orientações para quem assumir as próximas etapas.
            </p>
          </div>
        {/if}
      </div>

      <!-- BOTTOM COMMENT COMPOSER -->
      <div class="comment-composer-dock">
        <form
          method="POST"
          action="?/createChapterNote"
          use:enhance={() => {
            isSubmittingNote = true;
            noteFeedback = null;
            return async ({ result, update }) => {
              isSubmittingNote = false;
              if (result.type === 'failure') {
                noteFeedback = {
                  type: 'error',
                  text: result.data?.message || 'Não foi possível salvar a observação.'
                };
              } else {
                newNoteBody = '';
                newNoteKind = 'NORMAL';
                await update();
              }
            };
          }}
          class="chapter-note-form"
        >
          <input type="hidden" name="scan_id" value={scanId} />
          <input type="hidden" name="production_chapter_id" value={actualChapterId} />
          <input type="hidden" name="stage_id" value={traducaoStage?.stage_id || cleanStage?.stage_id || typesetStage?.stage_id || ''} />

          <div class="composer-top-controls">
            <label for="chapter-note-input" class="composer-label">
              Deixar observação para a equipe:
            </label>
            <div class="composer-kind-selector">
              <select id="chapter-note-kind" name="kind" bind:value={newNoteKind} class="kind-select" aria-label="Tipo de observação">
                <option value="NORMAL">Normal</option>
                <option value="IMPORTANT">Importante</option>
                <option value="PENDING">Pendência</option>
              </select>
            </div>
          </div>

          <div class="composer-input-row">
            <textarea
              id="chapter-note-input"
              name="body"
              bind:value={newNoteBody}
              maxlength="3000"
              class="composer-textarea"
              placeholder="Ex: Na página 12 deixei uma expressão ambígua sinalizada, confiram antes de finalizar..."
              required
              rows="3"
            ></textarea>
          </div>

          <div class="composer-bottom-row">
            <span class="composer-hint">
              Visível permanentemente para todos os membros desta scan que abrirem este capítulo.
            </span>
            <button
              type="submit"
              class="btn-send-note"
              disabled={isSubmittingNote || !newNoteBody.trim()}
            >
              {#if isSubmittingNote}
                <span class="spinner-xs"></span>
                <span>Enviando...</span>
              {:else}
                <Send size={14} />
                <span>Enviar Observação</span>
              {/if}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  /* --------------------------------------------------------------------------
     ROOT & BASE CONTAINER
     -------------------------------------------------------------------------- */
  .chapter-details-root {
    width: 100%;
    max-width: 100%;
    margin: 0;
    padding: 24px 32px 64px 32px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 20px;
    color: #f1f5f9;
  }

  /* --------------------------------------------------------------------------
     HEADER & BREADCRUMBS
     -------------------------------------------------------------------------- */
  .chapter-nav-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .header-left-cluster {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }

  .btn-back-stage {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    color: #e2e8f0;
    font-size: 0.84rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: all 0.2s ease;
  }

  .btn-back-stage:hover {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.35);
    color: #fff;
  }

  .btn-back-text-full {
    display: inline;
  }

  .btn-back-text-short {
    display: none;
  }

  .header-breadcrumbs {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .crumb-sep {
    color: #475569;
  }

  .crumb-scan {
    color: #a78bfa;
    font-weight: 500;
  }

  .crumb-work {
    color: #cbd5e1;
    font-weight: 500;
  }

  .crumb-current {
    color: #f8fafc;
    font-weight: 600;
  }

  .header-right-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .btn-action-preview {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 13px;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 8px;
    color: #c4b5fd;
    font-size: 0.84rem;
    font-weight: 500;
    text-decoration: none;
    white-space: nowrap;
    transition: all 0.2s ease;
  }

  .btn-action-preview:hover {
    background: rgba(139, 92, 246, 0.22);
    border-color: rgba(139, 92, 246, 0.45);
    color: #fff;
  }

  .btn-preview-text-full {
    display: inline;
  }

  .btn-preview-text-short {
    display: none;
  }

  .publish-form-inline {
    margin: 0;
  }

  .btn-action-publish {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: #10b981;
    border: 1px solid #059669;
    border-radius: 8px;
    color: #fff;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-action-publish:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
    color: #64748b;
  }

  .btn-action-publish.is-published {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.3);
    color: #34d399;
  }

  /* --------------------------------------------------------------------------
     HERO CARD (COVER & TITLE CLUSTER)
     -------------------------------------------------------------------------- */
  .chapter-hero-card {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 16px 20px;
    background: linear-gradient(135deg, rgba(26, 20, 48, 0.7) 0%, rgba(15, 15, 22, 0.9) 100%);
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 12px;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.3);
  }

  .hero-cover-wrap {
    width: 62px;
    height: 88px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    background: #1e1b2e;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .hero-cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .hero-cover-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .hero-info-stack {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  .hero-title-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .hero-series-title {
    font-size: 0.82rem;
    font-weight: 500;
    color: #a78bfa;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .hero-chapter-title {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 700;
    color: #fff;
    line-height: 1.25;
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }

  .hero-title-separator {
    color: #64748b;
    font-weight: 400;
  }

  .hero-chapter-sub {
    font-size: 1.1rem;
    font-weight: 500;
    color: #cbd5e1;
  }

  .hero-badges-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .badge-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    font-size: 0.76rem;
    color: #94a3b8;
  }

  .badge-item strong {
    color: #f1f5f9;
    font-weight: 600;
  }

  .catalog-status-badge {
    background: rgba(255, 255, 255, 0.03);
  }

  .catalog-status-badge.is-published {
    background: rgba(16, 185, 129, 0.12);
    border-color: rgba(16, 185, 129, 0.28);
    color: #a7f3d0;
  }

  .dot-green {
    background: #10b981;
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
  }

  .dot-amber {
    background: #f59e0b;
    box-shadow: 0 0 6px rgba(245, 158, 11, 0.5);
  }

  .badge-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .pulse-purple {
    background: #8b5cf6;
    box-shadow: 0 0 8px #8b5cf6;
  }

  .current-stage-badge {
    background: rgba(139, 92, 246, 0.12);
    border-color: rgba(139, 92, 246, 0.28);
    color: #c4b5fd;
  }

  .current-stage-badge strong {
    color: #fff;
  }

  .qc-alert-badge {
    background: rgba(245, 158, 11, 0.12);
    border-color: rgba(245, 158, 11, 0.3);
    color: #fbbf24;
  }

  .btn-badge-publish {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    background: #10b981;
    border: 1px solid #059669;
    border-radius: 6px;
    color: #fff;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-badge-publish:hover {
    background: #059669;
  }

  /* --------------------------------------------------------------------------
     SEGMENTED TABS
     -------------------------------------------------------------------------- */
  .chapter-details-tabs {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px;
    background: rgba(15, 15, 24, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    width: fit-content;
  }

  .details-tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 7px;
    background: transparent;
    border: 1px solid transparent;
    color: #94a3b8;
    font-size: 0.86rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .details-tab-btn:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.03);
  }

  .details-tab-btn.is-active {
    background: rgba(147, 51, 234, 0.18);
    border-color: rgba(168, 85, 247, 0.4);
    color: #f3e8ff;
    font-weight: 600;
    box-shadow: none;
  }

  .tab-label-full {
    display: inline;
  }

  .tab-label-short {
    display: none;
  }

  .tab-count-pill {
    padding: 1px 7px;
    background: rgba(255, 255, 255, 0.18);
    border-radius: 10px;
    font-size: 0.72rem;
    font-weight: 700;
    color: #fff;
  }

  /* --------------------------------------------------------------------------
     TAB 1: VISÃO GERAL (DESKTOP PIPELINE FLOW)
     -------------------------------------------------------------------------- */
  .tab-pane-overview {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .overview-section-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .overview-heading {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 600;
    color: #f8fafc;
  }

  .overview-subtitle {
    margin: 0;
    font-size: 0.85rem;
    color: #94a3b8;
  }

  .desktop-pipeline-flow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 8px;
    padding: 22px 20px;
    background: rgba(18, 18, 28, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
  }

  .flow-stage-node {
    flex: 1 1 0;
    min-width: 0;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: all 0.2s ease;
  }

  .flow-parallel-column {
    flex: 1.25 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    position: relative;
  }

  .flow-stage-node.parallel-node {
    width: 100%;
  }

  .flow-stage-node.status-done {
    border-color: rgba(16, 185, 129, 0.35);
    background: rgba(16, 185, 129, 0.06);
  }

  .flow-stage-node.status-in_progress {
    border-color: rgba(139, 92, 246, 0.45);
    background: rgba(139, 92, 246, 0.1);
    box-shadow: 0 0 12px rgba(139, 92, 246, 0.18);
  }

  .flow-stage-node.status-available {
    border-color: rgba(59, 130, 246, 0.35);
    background: rgba(59, 130, 246, 0.06);
  }

  .flow-stage-node.status-rework {
    border-color: rgba(245, 158, 11, 0.4);
    background: rgba(245, 158, 11, 0.08);
  }

  .flow-stage-node.status-waiting {
    opacity: 0.6;
    background: rgba(255, 255, 255, 0.015);
  }

  .node-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
  }

  .node-step-tag {
    font-size: 0.68rem;
    font-weight: 700;
    color: #a78bfa;
    text-transform: uppercase;
  }

  .node-status-pill {
    font-size: 0.68rem;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    color: #e2e8f0;
  }

  .status-done .node-status-pill {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
  }

  .status-in_progress .node-status-pill {
    background: rgba(139, 92, 246, 0.25);
    color: #c4b5fd;
  }

  .status-rework .node-status-pill {
    background: rgba(245, 158, 11, 0.2);
    color: #fcd34d;
  }

  .status-available .node-status-pill {
    background: rgba(59, 130, 246, 0.2);
    color: #93c5fd;
  }

  .node-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: #fff;
  }

  .node-assignee {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.75rem;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .flow-connector {
    width: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .fork-svg {
    width: 100%;
    height: 100px;
  }

  .straight-arrow {
    position: relative;
    height: 2px;
  }

  .arrow-line {
    width: 100%;
    height: 2px;
    background: rgba(139, 92, 246, 0.4);
    position: relative;
  }

  .arrow-line::after {
    content: '';
    position: absolute;
    right: 0;
    top: -3px;
    width: 0;
    height: 0;
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
    border-left: 6px solid rgba(139, 92, 246, 0.7);
  }

  .flow-parallel-column {
    display: flex;
    flex-direction: column;
    gap: 12px;
    position: relative;
  }

  .parallel-block-label {
    position: absolute;
    top: -18px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.65rem;
    font-weight: 700;
    color: #c084fc;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* --------------------------------------------------------------------------
     MOBILE VERTICAL TIMELINE
     -------------------------------------------------------------------------- */
  .mobile-vertical-timeline {
    display: none;
    flex-direction: column;
    gap: 8px;
  }

  .mobile-timeline-card {
    display: flex;
    align-items: stretch;
    gap: 12px;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    transition: all 0.2s ease;
  }

  .mobile-timeline-card.status-done {
    border-color: rgba(16, 185, 129, 0.35);
    background: rgba(16, 185, 129, 0.06);
  }

  .mobile-timeline-card.status-in_progress {
    border-color: rgba(139, 92, 246, 0.45);
    background: rgba(139, 92, 246, 0.1);
  }

  .mobile-timeline-card.status-rework {
    border-color: rgba(245, 158, 11, 0.4);
    background: rgba(245, 158, 11, 0.08);
  }

  .mobile-timeline-card.status-available {
    border-color: rgba(59, 130, 246, 0.35);
    background: rgba(59, 130, 246, 0.06);
  }

  .card-timeline-left {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 24px;
    flex-shrink: 0;
  }

  .timeline-step-bubble {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(139, 92, 246, 0.2);
    border: 1px solid rgba(139, 92, 246, 0.4);
    color: #c4b5fd;
    font-size: 0.72rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .timeline-step-bubble.final {
    background: rgba(16, 185, 129, 0.2);
    border-color: rgba(16, 185, 129, 0.4);
    color: #34d399;
  }

  .timeline-vertical-spine {
    width: 2px;
    flex: 1;
    background: rgba(255, 255, 255, 0.08);
    margin-top: 4px;
  }

  .card-timeline-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .timeline-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .timeline-stage-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: #fff;
  }

  .timeline-status-tag {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
  }

  .status-done .timeline-status-tag {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
  }

  .status-in_progress .timeline-status-tag {
    background: rgba(139, 92, 246, 0.25);
    color: #c4b5fd;
  }

  .status-rework .timeline-status-tag {
    background: rgba(245, 158, 11, 0.2);
    color: #fcd34d;
  }

  .status-available .timeline-status-tag {
    background: rgba(59, 130, 246, 0.2);
    color: #93c5fd;
  }

  .timeline-card-assignee {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    color: #94a3b8;
  }

  .mobile-parallel-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    background: rgba(139, 92, 246, 0.04);
    border: 1px dashed rgba(139, 92, 246, 0.25);
    border-radius: 10px;
  }

  .parallel-spine-indicator {
    padding-left: 6px;
  }

  .parallel-spine-tag {
    font-size: 0.68rem;
    font-weight: 700;
    color: #a78bfa;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .mobile-parallel-subcards {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mobile-timeline-card.sub-parallel {
    background: rgba(255, 255, 255, 0.02);
  }

  /* --------------------------------------------------------------------------
     DELIVERABLES PANEL
     -------------------------------------------------------------------------- */
  .overview-deliverables-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px 20px;
    background: rgba(18, 18, 28, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
  }

  .deliverables-panel-title {
    margin: 0;
    font-size: 0.98rem;
    font-weight: 600;
    color: #f1f5f9;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .deliverables-list-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }

  .deliverable-file-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
  }

  .file-icon-box {
    width: 34px;
    height: 34px;
    border-radius: 7px;
    background: rgba(139, 92, 246, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .file-meta-col {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .file-card-name {
    font-size: 0.82rem;
    font-weight: 500;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-card-tags {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    color: #94a3b8;
  }

  .stage-tag {
    color: #a78bfa;
    font-weight: 500;
  }

  .btn-file-download {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    color: #e2e8f0;
    font-size: 0.78rem;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-file-download:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
    color: #fff;
  }

  .empty-deliverables-box {
    padding: 24px;
    text-align: center;
    color: #94a3b8;
    font-size: 0.85rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  /* --------------------------------------------------------------------------
     TAB 2: CRÉDITOS E EQUIPE (EDITORIAL TECHNICAL SHEET)
     -------------------------------------------------------------------------- */
  .tab-pane-team {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .team-sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .team-heading {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 600;
    color: #fff;
  }

  .team-subheading {
    margin: 0;
    font-size: 0.85rem;
    color: #94a3b8;
  }

  .btn-copy-credits {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.35);
    border-radius: 8px;
    color: #c4b5fd;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-copy-credits:hover {
    background: rgba(139, 92, 246, 0.25);
    border-color: rgba(139, 92, 246, 0.5);
    color: #fff;
  }

  .team-roles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 14px;
  }

  .role-sheet-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: rgba(18, 18, 28, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    transition: all 0.2s ease;
  }

  .role-sheet-card.has-assignee {
    border-color: rgba(139, 92, 246, 0.25);
  }

  .role-top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .role-name-tag {
    font-size: 0.85rem;
    font-weight: 700;
    color: #a78bfa;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .role-status-badge {
    font-size: 0.72rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    color: #cbd5e1;
  }

  .role-status-badge.status-done {
    background: rgba(16, 185, 129, 0.18);
    color: #34d399;
  }

  .role-status-badge.status-in_progress {
    background: rgba(139, 92, 246, 0.22);
    color: #c4b5fd;
  }

  .role-member-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .role-member-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .member-display-name {
    font-size: 0.95rem;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .member-role-desc {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .team-history-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px 20px;
    background: rgba(18, 18, 28, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
  }

  .team-history-title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: #f1f5f9;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .timeline-events-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .timeline-event-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.8rem;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 6px;
    color: #cbd5e1;
  }

  .event-time {
    color: #64748b;
    font-size: 0.75rem;
    min-width: 90px;
  }

  .event-type-badge {
    font-size: 0.68rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(139, 92, 246, 0.15);
    color: #c4b5fd;
  }

  .event-desc strong {
    color: #fff;
  }

  .empty-history-box {
    padding: 16px;
    text-align: center;
    font-size: 0.85rem;
    color: #64748b;
  }

  /* --------------------------------------------------------------------------
     TAB 3: COMENTÁRIOS INTERNOS
     -------------------------------------------------------------------------- */
  .tab-pane-comments {
    max-width: 780px;
    margin: 0 auto;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 24px;
  }

  .comments-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .comments-heading {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 600;
    color: #fff;
  }

  .comments-subheading {
    margin: 0;
    font-size: 0.85rem;
    color: #94a3b8;
  }

  .comment-alert-banner {
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .comment-alert-banner.error {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .btn-close-alert {
    background: transparent;
    border: none;
    color: inherit;
    font-size: 1.1rem;
    cursor: pointer;
  }

  .comments-thread-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .comment-card {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 14px;
    background: rgba(18, 18, 28, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    transition: all 0.2s ease;
    height: auto;
    min-height: 0;
    box-sizing: border-box;
  }

  .comment-card.is-pinned {
    border-color: rgba(139, 92, 246, 0.4);
    background: rgba(139, 92, 246, 0.08);
  }

  .comment-card.kind-important {
    border-left: 3px solid #f59e0b;
  }

  .comment-card.kind-pending {
    border-left: 3px solid #ef4444;
  }

  .comment-author-avatar {
    flex-shrink: 0;
    padding-top: 1px;
  }

  .comment-body-wrapper {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    height: auto;
    min-height: 0;
  }

  .comment-card-topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    flex-wrap: wrap;
  }

  .comment-meta-left {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .comment-author-name {
    font-size: 0.88rem;
    font-weight: 600;
    color: #fff;
    line-height: 1.2;
  }

  .comment-stage-tag {
    font-size: 0.68rem;
    font-weight: 500;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(139, 92, 246, 0.18);
    color: #c4b5fd;
  }

  .comment-badge-pinned {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.66rem;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(139, 92, 246, 0.25);
    color: #e9d5ff;
  }

  .comment-badge-important {
    font-size: 0.66rem;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(245, 158, 11, 0.2);
    color: #fcd34d;
  }

  .comment-badge-pending {
    font-size: 0.66rem;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  .comment-timestamp {
    font-size: 0.72rem;
    color: #64748b;
  }

  .comment-text-content {
    font-size: 0.86rem;
    color: #e2e8f0;
    line-height: 1.42;
    white-space: pre-wrap;
    word-break: break-word;
    margin: 2px 0 0 0;
    padding: 0;
  }

  .comment-actions-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 !important;
    margin: 4px 0 0 0;
    background: transparent !important;
    border: none !important;
    min-height: 0 !important;
  }

  .inline-action-form {
    margin: 0;
    padding: 0;
    display: inline-flex;
  }

  .btn-note-action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 5px;
    margin: -2px -3px;
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 0.74rem;
    font-weight: 500;
    cursor: pointer;
    border-radius: 4px;
    transition: color 0.15s ease, background 0.15s ease;
  }

  .btn-note-action:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.06);
  }

  .btn-note-action.delete-action:hover {
    color: #f87171;
    background: rgba(248, 113, 113, 0.1);
  }

  .comment-edit-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 0;
  }

  .edit-kind-select {
    padding: 4px 8px;
    background: #1e1e2d;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    color: #fff;
    font-size: 0.78rem;
  }

  .edit-body-textarea {
    width: 100%;
    min-height: 80px;
    padding: 8px 12px;
    background: #14141e;
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 8px;
    color: #fff;
    font-size: 0.85rem;
    font-family: inherit;
    resize: vertical;
    box-sizing: border-box;
  }

  .edit-form-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-edit-save {
    padding: 5px 12px;
    background: #8b5cf6;
    border: 1px solid #7c3aed;
    border-radius: 6px;
    color: #fff;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-edit-cancel {
    padding: 5px 12px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    color: #cbd5e1;
    font-size: 0.78rem;
    cursor: pointer;
  }

  .empty-comments-card {
    padding: 36px 20px;
    text-align: center;
    background: rgba(18, 18, 28, 0.5);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .empty-comments-card h3 {
    margin: 0;
    font-size: 1rem;
    color: #f1f5f9;
  }

  .empty-comments-card p {
    margin: 0;
    font-size: 0.85rem;
    color: #94a3b8;
    max-width: 480px;
  }

  /* --------------------------------------------------------------------------
     BOTTOM COMPOSER DOCK
     -------------------------------------------------------------------------- */
  .comment-composer-dock {
    margin-top: 10px;
    padding: 16px 20px;
    background: #14141e;
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
  }

  .chapter-note-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
  }

  .composer-top-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .composer-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: #f1f5f9;
  }

  .kind-select {
    padding: 4px 10px;
    background: #1f1f2e;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    color: #e2e8f0;
    font-size: 0.78rem;
    cursor: pointer;
  }

  .composer-input-row {
    width: 100%;
  }

  .composer-textarea {
    width: 100%;
    min-height: 80px;
    padding: 10px 14px;
    background: #0d0d14;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #fff;
    font-size: 0.88rem;
    font-family: inherit;
    line-height: 1.45;
    box-sizing: border-box;
    resize: vertical;
    transition: border-color 0.2s ease;
  }

  .composer-textarea:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.25);
  }

  .composer-bottom-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .composer-hint {
    font-size: 0.75rem;
    color: #64748b;
  }

  .btn-send-note {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 18px;
    background: #8b5cf6;
    border: 1px solid #7c3aed;
    border-radius: 8px;
    color: #fff;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-send-note:hover:not(:disabled) {
    background: #7c3aed;
    box-shadow: 0 2px 10px rgba(139, 92, 246, 0.4);
  }

  .btn-send-note:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .spinner-xs {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* --------------------------------------------------------------------------
     RESPONSIVE BREAKPOINTS (ANDROID & MOBILE VIEWPORTS)
     -------------------------------------------------------------------------- */
  @media (max-width: 900px) {
    .chapter-details-root {
      padding: 10px 12px calc(110px + env(safe-area-inset-bottom, 24px)) 12px;
      gap: 10px;
    }

    .desktop-pipeline-flow {
      display: none;
    }

    .mobile-vertical-timeline {
      display: flex;
    }

    .hero-series-title {
      font-size: 0.72rem;
      margin-bottom: 1px;
    }

    .hero-chapter-title {
      font-size: 1.05rem;
      line-height: 1.25;
    }

    .chapter-hero-card {
      padding: 10px 12px;
      gap: 10px;
      border-radius: 10px;
    }

    .hero-cover-wrap {
      width: 44px;
      height: 62px;
      border-radius: 6px;
    }

    .hero-badges-row {
      gap: 4px;
      margin-top: 4px;
    }

    .badge-item {
      font-size: 0.7rem;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .chapter-details-tabs {
      width: 100%;
      justify-content: space-between;
      padding: 3px;
      gap: 4px;
      border-radius: 8px;
      margin-top: 2px;
    }

    .details-tab-btn {
      flex: 1;
      justify-content: center;
      padding: 7px 6px;
      font-size: 0.78rem;
      min-height: 38px;
    }

    .tab-label-full {
      display: none;
    }

    .tab-label-short {
      display: inline;
    }

    .tab-pane-comments {
      padding-bottom: calc(110px + env(safe-area-inset-bottom, 24px)); /* Virtual keyboard clearance & safe area */
    }

    .comment-composer-dock {
      /* Android keyboard safety clearance */
      padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    }
  }

  @media (max-width: 640px) {
    .header-breadcrumbs {
      display: none;
    }

    .btn-back-text-full {
      display: none;
    }

    .btn-back-text-short {
      display: inline;
    }

    .btn-preview-text-full {
      display: none;
    }

    .btn-preview-text-short {
      display: inline;
    }

    .icon-preview-external {
      display: none;
    }

    .btn-back-stage,
    .btn-action-preview {
      min-height: 38px;
      padding: 6px 12px;
      font-size: 0.82rem;
    }

    .hero-badges-row {
      gap: 4px;
    }

    .badge-item {
      font-size: 0.7rem;
      padding: 2px 6px;
    }

    .deliverables-list-grid {
      grid-template-columns: 1fr;
    }

    .team-roles-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
