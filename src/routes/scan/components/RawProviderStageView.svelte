<script lang="ts">
  import { enhance } from '$app/forms';
  import {
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    Download,
    FileArchive,
    Filter,
    FolderKanban,
    HelpCircle,
    Layers,
    Lock,
    Package,
    Plus,
    RefreshCw,
    Search,
    Sparkles,
    Trash2,
    Upload,
    X,
    Zap
  } from '@lucide/svelte';
  import { evaluateStageClaim } from '$lib/scan-roles';
  import PipelineDeliverableUpload from './PipelineDeliverableUpload.svelte';

  interface Props {
    stages?: any[];
    chapterStages?: any[];
    chapters?: any[];
    works?: any[];
    productionFiles?: any[];
    tasks?: any[];
    qcIssues?: any[];
    currentUserId?: string;
    userRole?: string;
    userPositions?: any[];
    seenStages?: string[];
    isOwnerOrAdmin?: boolean;
    scanId?: string;
    onSelectStage?: (slug: string) => void;
    onOpenChapter?: (chapter: any) => void;
  }

  let {
    stages = [],
    chapterStages = [],
    chapters = [],
    works = [],
    productionFiles = [],
    tasks = [],
    qcIssues = [],
    currentUserId = '',
    userRole = 'MEMBER',
    userPositions = [],
    seenStages = [],
    isOwnerOrAdmin = false,
    scanId = '',
    onSelectStage = () => {},
    onOpenChapter = () => {}
  }: Props = $props();

  // Evaluate Claim & Creation Permissions for RAW
  let claimEvaluation = $derived(
    evaluateStageClaim(userRole, userPositions, 'raw')
  );

  let canCreateChapter = $derived(
    isOwnerOrAdmin || claimEvaluation.canClaim
  );

  // Filters
  let searchQuery = $state('');
  let filterWorkId = $state('ALL');

  // Variant & Active Category States
  // urlVariant: 'workspace' (Concept B - Unified Workspace) or 'split' (Concept A - Side-by-side Panels)
  let urlVariant = $state<'workspace' | 'split'>('workspace');
  let activeCategory = $state<'available' | 'mine' | 'both'>('available');

  $effect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('variant') === 'split') {
        urlVariant = 'split';
      }
    }
  });

  // New Chapter Modal State (Collapsed by default per specification)
  let showNewChapterModal = $state(false);
  let newChapterWorkId = $state('');
  let newChapterNumber = $state<string>('');
  let newChapterLabel = $state('');
  let newChapterPriority = $state('NORMAL');
  let newChapterAutoClaim = $state(true);
  let isCreatingChapter = $state(false);
  let createFeedback = $state<{ type: 'error' | 'success'; text: string } | null>(null);

  // Claim State
  let isClaimingStageId = $state<string | null>(null);
  let claimFeedback = $state<{ stageId: string; type: 'error' | 'success'; text: string } | null>(null);

  // Completing State
  let isCompletingStageId = $state<string | null>(null);
  let completeFeedback = $state<{ stageId: string; type: 'error' | 'success'; text: string } | null>(null);

  // Expandable Upload Accordions in "Meus capítulos"
  let expandedUploadIds = $state<Record<string, boolean>>({});

  function toggleUploadAccordion(stageId: string) {
    expandedUploadIds[stageId] = !expandedUploadIds[stageId];
  }

  // Preselect first work if available
  $effect(() => {
    if (!newChapterWorkId && works.length > 0) {
      newChapterWorkId = works[0].id;
    }
  });

  // Extract all RAW items from chapterStages
  let rawStageItems = $derived.by(() => {
    const result: any[] = [];
    for (const cs of chapterStages) {
      const slug = (cs.stage?.slug || '').toLowerCase();
      if (slug === 'raw' || slug.includes('raw')) {
        const ch = chapters.find((c: any) => c.id === cs.production_chapter_id);
        if (ch) {
          const work = ch.work || works.find((w: any) => w.id === ch.work_id);
          result.push({ ch, cs, work });
        }
      }
    }
    return result;
  });

  // Available chapters for RAW: status is AVAILABLE or REWORK and unassigned
  let availableItems = $derived.by(() => {
    return rawStageItems
      .filter((item: any) => {
        return (item.cs.status === 'AVAILABLE' || item.cs.status === 'REWORK') && !item.cs.assigned_to;
      })
      .filter((item: any) => {
        const matchesWork = filterWorkId === 'ALL' || item.work?.id === filterWorkId;
        const q = searchQuery.trim().toLowerCase();
        if (!q) return matchesWork;
        const title = (item.work?.title || '').toLowerCase();
        const num = String(item.ch.chapter_number || '');
        const label = (item.ch.chapter_label || '').toLowerCase();
        return matchesWork && (title.includes(q) || num.includes(q) || label.includes(q));
      })
      .sort((a: any, b: any) => {
        const pOrder: Record<string, number> = { URGENT: 3, HIGH: 2, NORMAL: 1, LOW: 0 };
        const pA = pOrder[a.ch.priority || 'NORMAL'] || 1;
        const pB = pOrder[b.ch.priority || 'NORMAL'] || 1;
        if (pB !== pA) return pB - pA;
        return (a.ch.chapter_number || 0) - (b.ch.chapter_number || 0);
      });
  });

  // My chapters: assigned to current user and IN_PROGRESS or REWORK
  let myItems = $derived.by(() => {
    return rawStageItems
      .filter((item: any) => {
        return item.cs.assigned_to === currentUserId && (item.cs.status === 'IN_PROGRESS' || item.cs.status === 'REWORK');
      })
      .filter((item: any) => {
        const matchesWork = filterWorkId === 'ALL' || item.work?.id === filterWorkId;
        const q = searchQuery.trim().toLowerCase();
        if (!q) return matchesWork;
        const title = (item.work?.title || '').toLowerCase();
        const num = String(item.ch.chapter_number || '');
        const label = (item.ch.chapter_label || '').toLowerCase();
        return matchesWork && (title.includes(q) || num.includes(q) || label.includes(q));
      })
      .sort((a: any, b: any) => (a.ch.chapter_number || 0) - (b.ch.chapter_number || 0));
  });

  // Priority warning for available pool
  let hasUrgentAvailable = $derived(
    availableItems.some((i: any) => i.ch.priority === 'URGENT')
  );

  // Automatic smart default for category
  $effect.pre(() => {
    if (myItems.length > 0 && availableItems.length === 0 && activeCategory === 'available') {
      activeCategory = 'mine';
    }
  });

  // Current deliverable files for a chapter stage
  function getDeliverableFiles(cs: any, chId: string) {
    return productionFiles.filter((f: any) =>
      f.production_chapter_id === chId &&
      (f.stage_id === cs.stage_id || (f.stage_slug || f.stage?.slug || '').toLowerCase().includes('raw')) &&
      f.is_current
    );
  }

  function formatPriority(priority?: string) {
    switch (priority) {
      case 'URGENT':
        return { label: 'Urgente', class: 'priority-urgent' };
      case 'HIGH':
        return { label: 'Alta', class: 'priority-high' };
      default:
        return { label: 'Normal', class: 'priority-normal' };
    }
  }

  function attemptCloseModal() {
    const isDirty = newChapterNumber !== '' || newChapterLabel.trim() !== '';
    if (isDirty) {
      if (typeof window !== 'undefined' && window.confirm('Deseja descartar as alterações do novo capítulo?')) {
        showNewChapterModal = false;
        newChapterNumber = '';
        newChapterLabel = '';
        createFeedback = null;
      }
    } else {
      showNewChapterModal = false;
      createFeedback = null;
    }
  }

  function handleKeydownModal(e: KeyboardEvent) {
    if (e.key === 'Escape' && showNewChapterModal) {
      attemptCloseModal();
    }
  }
</script>

<svelte:window onkeydown={handleKeydownModal} />

<!-- REUSABLE SNIPPETS: ZERO CODE DUPLICATION -->

<!-- SNIPPET 1: AVAILABLE CHAPTERS LIST -->
{#snippet availableCards()}
  {#if claimFeedback}
    <div class="claim-alert-notice error">
      <AlertCircle size={15} />
      <span>{claimFeedback.text}</span>
      <button type="button" class="btn-close-alert" onclick={() => (claimFeedback = null)} aria-label="Fechar alerta">
        <X size={13} />
      </button>
    </div>
  {/if}

  {#if availableItems.length === 0}
    {@render emptyAvailable()}
  {:else}
    <div class="raw-cards-list">
      {#each availableItems as item (item.cs.id)}
        {@const priorityMeta = formatPriority(item.ch.priority)}
        <article class="raw-card available-card">
          <div class="raw-card-cover-wrap">
            {#if item.work?.cover_url}
              <img src={item.work.cover_url} alt={item.work.title} class="raw-card-cover" loading="lazy" />
            {:else}
              <div class="raw-card-cover-fallback">
                <FileArchive size={20} class="text-slate-500" />
              </div>
            {/if}
          </div>

          <div class="raw-card-info">
            <div class="card-meta-top">
              <span class="card-work-title" title={item.work?.title || 'Obra'}>
                {item.work?.title || 'Obra sem título'}
              </span>
              <span class="card-priority-chip {priorityMeta.class}">
                {#if item.ch.priority === 'URGENT'}
                  <span class="urgent-pulse-dot"></span>
                {/if}
                {priorityMeta.label}
              </span>
            </div>

            <div class="card-chapter-row">
              <span class="chapter-badge">Cap. #{item.ch.chapter_number}</span>
              {#if item.ch.chapter_label}
                <span class="chapter-sublabel" title={item.ch.chapter_label}>{item.ch.chapter_label}</span>
              {/if}
            </div>

            <div class="card-footer-action">
              <form
                method="POST"
                action="?/claimStage"
                use:enhance={() => {
                  isClaimingStageId = item.cs.id;
                  claimFeedback = null;
                  return async ({ result, update }) => {
                    isClaimingStageId = null;
                    if (result.type === 'failure') {
                      claimFeedback = {
                        stageId: item.cs.id,
                        type: 'error',
                        text: result.data?.message || 'Não foi possível assumir o capítulo.'
                      };
                    } else {
                      await update();
                      activeCategory = 'mine';
                    }
                  };
                }}
              >
                <input type="hidden" name="chapter_stage_id" value={item.cs.id} />
                <button
                  type="submit"
                  class="btn-pegar-capitulo"
                  class:btn-disabled={!claimEvaluation.canClaim}
                  disabled={!claimEvaluation.canClaim || isClaimingStageId === item.cs.id}
                  title={!claimEvaluation.canClaim ? 'Requer o cargo Raw Provider' : 'Pegar este capítulo para produzir o RAW'}
                >
                  {#if isClaimingStageId === item.cs.id}
                    <span class="spinner-xs"></span>
                    <span>Pegando...</span>
                  {:else if !claimEvaluation.canClaim}
                    <Lock size={13} />
                    <span>Cargo RAW necessário</span>
                  {:else}
                    <Zap size={14} class="btn-zap-icon" />
                    <span>Pegar capítulo</span>
                  {/if}
                </button>
              </form>
            </div>
          </div>
        </article>
      {/each}
    </div>
  {/if}
{/snippet}

<!-- SNIPPET 2: MY CHAPTERS LIST -->
{#snippet myCards()}
  {#if completeFeedback}
    <div class="claim-alert-notice {completeFeedback.type}">
      <AlertCircle size={15} />
      <span>{completeFeedback.text}</span>
      <button type="button" class="btn-close-alert" onclick={() => (completeFeedback = null)} aria-label="Fechar alerta">
        <X size={13} />
      </button>
    </div>
  {/if}

  {#if myItems.length === 0}
    {@render emptyMine()}
  {:else}
    <div class="raw-cards-list">
      {#each myItems as item (item.cs.id)}
        {@const files = getDeliverableFiles(item.cs, item.ch.id)}
        {@const hasFiles = files.length > 0}
        {@const isExpanded = !!expandedUploadIds[item.cs.id]}

        <article class="raw-card my-card" class:is-expanded={isExpanded}>
          <div class="raw-card-top-row">
            <div class="raw-card-cover-wrap">
              {#if item.work?.cover_url}
                <img src={item.work.cover_url} alt={item.work.title} class="raw-card-cover" loading="lazy" />
              {:else}
                <div class="raw-card-cover-fallback">
                  <FileArchive size={20} class="text-slate-500" />
                </div>
              {/if}
            </div>

            <div class="raw-card-info">
              <div class="card-meta-top">
                <span class="card-work-title" title={item.work?.title || 'Obra'}>
                  {item.work?.title || 'Obra sem título'}
                </span>
                {#if hasFiles}
                  <span class="card-status-badge success">
                    <CheckCircle2 size={11} />
                    <span>{files.length} arquivo{files.length > 1 ? 's' : ''} pronto{files.length > 1 ? 's' : ''}</span>
                  </span>
                {:else}
                  <span class="card-status-badge pending">
                    <Clock size={11} />
                    <span>Aguardando envio</span>
                  </span>
                {/if}
              </div>

              <div class="card-chapter-row">
                <span class="chapter-badge">Cap. #{item.ch.chapter_number}</span>
                {#if item.ch.chapter_label}
                  <span class="chapter-sublabel" title={item.ch.chapter_label}>{item.ch.chapter_label}</span>
                {/if}
              </div>

              <div class="my-card-actions">
                <button
                  type="button"
                  class="btn-toggle-upload"
                  class:active={isExpanded}
                  class:cta-needed={!hasFiles}
                  onclick={() => toggleUploadAccordion(item.cs.id)}
                  title={isExpanded ? 'Recolher área de arquivos' : 'Gerenciar arquivos do RAW'}
                >
                  <Upload size={13} />
                  <span>{hasFiles ? 'Gerenciar arquivos' : 'Enviar RAW'}</span>
                  {#if isExpanded}
                    <ChevronUp size={13} />
                  {:else}
                    <ChevronDown size={13} />
                  {/if}
                </button>

                {#if hasFiles}
                  <form
                    method="POST"
                    action="?/completeStageAction"
                    use:enhance={() => {
                      isCompletingStageId = item.cs.id;
                      completeFeedback = null;
                      return async ({ result, update }) => {
                        isCompletingStageId = null;
                        if (result.type === 'failure') {
                          completeFeedback = {
                            stageId: item.cs.id,
                            type: 'error',
                            text: result.data?.message || 'Não foi possível concluir a etapa.'
                          };
                        } else {
                          completeFeedback = {
                            stageId: item.cs.id,
                            type: 'success',
                            text: 'Etapa RAW concluída com sucesso!'
                          };
                          await update();
                        }
                      };
                    }}
                  >
                    <input type="hidden" name="chapter_stage_id" value={item.cs.id} />
                    <button
                      type="submit"
                      class="btn-concluir-raw"
                      disabled={isCompletingStageId === item.cs.id}
                      title="Concluir etapa RAW e liberar para Tradução e Clean/Redraw"
                    >
                      {#if isCompletingStageId === item.cs.id}
                        <span class="spinner-xs"></span>
                        <span>Concluindo...</span>
                      {:else}
                        <CheckCircle2 size={13} />
                        <span>Concluir RAW</span>
                      {/if}
                    </button>
                  </form>
                {/if}
              </div>
            </div>
          </div>

          <!-- INLINE DELIVERABLE UPLOAD ACCORDION (Cleanly Integrated) -->
          {#if isExpanded}
            <div class="raw-upload-accordion">
              <div class="upload-accordion-header">
                <div class="upload-title-wrap">
                  <span class="upload-accordion-title">Arquivos do Capítulo #{item.ch.chapter_number}</span>
                  <span class="upload-format-note">Formatos: .zip, .cbz ou imagens sequenciais</span>
                </div>
                {#if !hasFiles}
                  <span class="upload-step-hint">1º Envie o RAW abaixo &bull; 2º Clique em "Concluir RAW" acima</span>
                {/if}
              </div>

              <PipelineDeliverableUpload
                scanId={scanId}
                productionChapterId={item.ch.id}
                stageId={item.cs.stage_id}
                currentFiles={files}
              />
            </div>
          {/if}
        </article>
      {/each}
    </div>
  {/if}
{/snippet}

<!-- SNIPPET 3: ELEGANT EMPTY STATE FOR AVAILABLE POOL -->
{#snippet emptyAvailable()}
  <div class="workspace-empty-card">
    <div class="empty-halo-icon">
      <CheckCircle2 size={24} class="text-emerald-400" />
    </div>
    <div class="empty-body">
      <strong class="empty-heading">Tudo em dia por aqui</strong>
      <p class="empty-subtext">Nenhum capítulo aguardando obtenção ou preparação de RAW no momento.</p>
    </div>
    {#if canCreateChapter}
      <button
        type="button"
        class="btn-empty-action"
        onclick={() => {
          showNewChapterModal = true;
          createFeedback = null;
        }}
      >
        <Plus size={14} />
        <span>Cadastrar novo capítulo</span>
      </button>
    {/if}
  </div>
{/snippet}

<!-- SNIPPET 4: ELEGANT EMPTY STATE FOR MY WORK -->
{#snippet emptyMine()}
  <div class="workspace-empty-card">
    <div class="empty-halo-icon neutral">
      <Clock size={24} class="text-slate-400" />
    </div>
    <div class="empty-body">
      <strong class="empty-heading">Sua fila de RAW está livre</strong>
      <p class="empty-subtext">Você não possui nenhum capítulo sob sua responsabilidade no momento.</p>
    </div>
    {#if availableItems.length > 0}
      <button
        type="button"
        class="btn-empty-action amber"
        onclick={() => (activeCategory = 'available')}
      >
        <Zap size={14} />
        <span>Ver {availableItems.length} capítulo{availableItems.length > 1 ? 's' : ''} disponível{availableItems.length > 1 ? 'is' : ''}</span>
      </button>
    {/if}
  </div>
{/snippet}


<!-- MAIN COMPONENT ROOT -->
<div class="raw-provider-root">
  <!-- COMPACT HEADER (Clean, Elegant, Low Height) -->
  <header class="raw-header">
    <div class="raw-header-main">
      <div class="raw-title-row">
        <span class="raw-stage-pill">
          <span class="stage-dot"></span>
          <span>Etapa 1 &bull; RAW</span>
        </span>
        <h1 class="raw-title">Raw Provider</h1>
      </div>
      <p class="raw-subtitle">Prepare os arquivos originais para a produção.</p>
    </div>

    <div class="raw-header-action">
      <button
        type="button"
        class="btn-novo-capitulo"
        onclick={() => {
          showNewChapterModal = true;
          createFeedback = null;
        }}
        title="Cadastrar um novo capítulo na scan"
      >
        <Plus size={15} />
        <span>Novo capítulo</span>
      </button>
    </div>
  </header>

  <!-- CONCEPT B: WORKSPACE UNIFICADO (DEFAULT) -->
  {#if urlVariant === 'workspace'}
    <div class="raw-workspace-container">
      <!-- WORKSPACE SEGMENTED NAV BAR -->
      <div class="workspace-nav-bar">
        <div class="segmented-control" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'available'}
            class="segment-btn"
            class:active={activeCategory === 'available'}
            onclick={() => (activeCategory = 'available')}
          >
            <Layers size={14} class="segment-icon text-amber-400" />
            <span class="segment-label">Disponíveis</span>
            <span class="segment-badge" class:urgent={hasUrgentAvailable}>
              {availableItems.length}
            </span>
            {#if hasUrgentAvailable}
              <span class="urgent-pulse-indicator" title="Capítulo urgente aguardando RAW"></span>
            {/if}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'mine'}
            class="segment-btn"
            class:active={activeCategory === 'mine'}
            onclick={() => (activeCategory = 'mine')}
          >
            <Clock size={14} class="segment-icon text-purple-400" />
            <span class="segment-label">Meus capítulos</span>
            <span class="segment-badge mine">
              {myItems.length}
            </span>
          </button>

          <!-- Desktop option: View both side-by-side -->
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'both'}
            class="segment-btn desktop-only"
            class:active={activeCategory === 'both'}
            onclick={() => (activeCategory = 'both')}
          >
            <FolderKanban size={14} class="segment-icon text-slate-400" />
            <span class="segment-label">Ambos</span>
          </button>
        </div>

        <!-- Integrated search and filter toolbar -->
        {#if works.length > 0}
          <div class="workspace-filters">
            <div class="search-mini-box">
              <Search size={13} class="search-mini-icon" />
              <input
                type="text"
                placeholder="Buscar obra ou capítulo..."
                bind:value={searchQuery}
                class="search-mini-input"
              />
              {#if searchQuery}
                <button type="button" class="btn-clear-mini" onclick={() => (searchQuery = '')} aria-label="Limpar busca">
                  <X size={12} />
                </button>
              {/if}
            </div>

            {#if works.length > 1}
              <select bind:value={filterWorkId} class="work-mini-select" aria-label="Filtrar por obra">
                <option value="ALL">Todas as obras ({works.length})</option>
                {#each works as w (w.id)}
                  <option value={w.id}>{w.title}</option>
                {/each}
              </select>
            {/if}
          </div>
        {/if}
      </div>

      <!-- WORKSPACE CONTENT PANE -->
      <div class="workspace-content-pane">
        {#if activeCategory === 'available'}
          {@render availableCards()}
        {:else if activeCategory === 'mine'}
          {@render myCards()}
        {:else if activeCategory === 'both'}
          <div class="workspace-side-by-side">
            <div class="side-panel">
              <div class="side-panel-header">
                <div class="side-title-lockup">
                  <Layers size={15} class="text-amber-400" />
                  <h2 class="side-panel-title">Capítulos disponíveis</h2>
                  <span class="segment-badge">{availableItems.length}</span>
                </div>
              </div>
              {@render availableCards()}
            </div>

            <div class="side-panel">
              <div class="side-panel-header">
                <div class="side-title-lockup">
                  <Clock size={15} class="text-purple-400" />
                  <h2 class="side-panel-title">Meus capítulos</h2>
                  <span class="segment-badge mine">{myItems.length}</span>
                </div>
              </div>
              {@render myCards()}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <!-- CONCEPT A: SPLIT PANELS (VIA ?variant=split) -->
    <!-- Integrated Search & Filter for Split Concept -->
    {#if works.length > 0 && (availableItems.length > 0 || myItems.length > 0 || searchQuery || filterWorkId !== 'ALL')}
      <div class="raw-filter-toolbar">
        <div class="search-input-box">
          <Search size={14} class="search-box-icon" />
          <input
            type="text"
            placeholder="Buscar obra ou capítulo..."
            bind:value={searchQuery}
            class="search-input-field"
          />
          {#if searchQuery}
            <button type="button" class="btn-clear-search" onclick={() => (searchQuery = '')} aria-label="Limpar">
              <X size={13} />
            </button>
          {/if}
        </div>

        {#if works.length > 1}
          <div class="work-filter-box">
            <Filter size={13} class="filter-box-icon" />
            <select bind:value={filterWorkId} class="work-filter-select" aria-label="Filtrar por obra">
              <option value="ALL">Todas as obras ({works.length})</option>
              {#each works as w (w.id)}
                <option value={w.id}>{w.title}</option>
              {/each}
            </select>
          </div>
        {/if}
      </div>
    {/if}

    <div class="raw-main-grid">
      <section class="raw-section raw-available-section">
        <div class="section-headline">
          <div class="section-title-lockup">
            <Layers size={16} class="section-icon text-amber-400" />
            <h2 class="section-title">Capítulos disponíveis</h2>
            <span class="section-counter-badge count-available">{availableItems.length}</span>
          </div>
          <span class="section-hint">Prontos para assumir</span>
        </div>
        {@render availableCards()}
      </section>

      <section class="raw-section raw-my-section">
        <div class="section-headline">
          <div class="section-title-lockup">
            <Clock size={16} class="section-icon text-purple-400" />
            <h2 class="section-title">Meus capítulos</h2>
            <span class="section-counter-badge count-mine">{myItems.length}</span>
          </div>
          <span class="section-hint">Sob sua responsabilidade</span>
        </div>
        {@render myCards()}
      </section>
    </div>
  {/if}

  <!-- MODAL: CADASTRAR NOVO CAPÍTULO (COLLAPSED BY DEFAULT) -->
  {#if showNewChapterModal}
    <div
      class="modal-backdrop"
      onclick={(e) => {
        if (e.target === e.currentTarget) attemptCloseModal();
      }}
      role="presentation"
    >
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
          <div class="modal-header-lockup">
            <div class="modal-icon-badge">
              <Package size={18} class="text-amber-400" />
            </div>
            <div>
              <h2 id="modal-title" class="modal-title">Cadastrar Novo Capítulo</h2>
              <p class="modal-subtitle">Selecione a obra e informe o capítulo para iniciar a produção.</p>
            </div>
          </div>
          <button
            type="button"
            class="btn-modal-close"
            onclick={attemptCloseModal}
            aria-label="Fechar formulário de cadastro"
            title="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {#if createFeedback && createFeedback.type === 'error'}
          <div class="modal-feedback-alert error">
            <AlertCircle size={15} />
            <span>{createFeedback.text}</span>
          </div>
        {/if}

        <form
          method="POST"
          action="?/createProductionChapter"
          class="modal-form"
          use:enhance={() => {
            isCreatingChapter = true;
            createFeedback = null;
            return async ({ result, update }) => {
              isCreatingChapter = false;
              if (result.type === 'failure') {
                createFeedback = {
                  type: 'error',
                  text: result.data?.message || 'Erro ao cadastrar capítulo.'
                };
              } else {
                createFeedback = null;
                showNewChapterModal = false;
                newChapterNumber = '';
                newChapterLabel = '';
                await update();
              }
            };
          }}
        >
          <input type="hidden" name="scan_id" value={scanId} />
          <input type="hidden" name="chapter_type" value="NUMBER" />
          <input type="hidden" name="template" value="MANHWA" />

          <!-- Campo 1: Obra da Scan -->
          <div class="form-group">
            <label for="new-chapter-work" class="form-label">Obra da Scan *</label>
            <select
              id="new-chapter-work"
              name="work_id"
              bind:value={newChapterWorkId}
              class="form-select"
              required
            >
              {#if works.length === 0}
                <option value="">Nenhuma obra disponível na scan</option>
              {:else}
                {#each works as w (w.id)}
                  <option value={w.id}>{w.title}</option>
                {/each}
              {/if}
            </select>
          </div>

          <!-- Linha com 2 colunas: Número e Subtítulo -->
          <div class="form-grid-two">
            <div class="form-group">
              <label for="new-chapter-number" class="form-label">Número do capítulo *</label>
              <input
                id="new-chapter-number"
                name="chapter_number"
                type="number"
                step="any"
                min="0"
                placeholder="Ex: 1 ou 10.5"
                bind:value={newChapterNumber}
                class="form-input"
                required
              />
            </div>

            <div class="form-group">
              <label for="new-chapter-label" class="form-label">Título / Subtítulo (opcional)</label>
              <input
                id="new-chapter-label"
                name="chapter_label"
                type="text"
                placeholder="Ex: O Início do Fim"
                bind:value={newChapterLabel}
                class="form-input"
              />
            </div>
          </div>

          <!-- Prioridade Editorial -->
          <div class="form-group">
            <label class="form-label">Prioridade editorial</label>
            <div class="priority-toggle-group">
              <label class="priority-radio-option" class:active={newChapterPriority === 'NORMAL'}>
                <input
                  type="radio"
                  name="priority"
                  value="NORMAL"
                  bind:group={newChapterPriority}
                  class="sr-only"
                />
                <span>Normal</span>
              </label>

              <label class="priority-radio-option" class:active={newChapterPriority === 'HIGH'}>
                <input
                  type="radio"
                  name="priority"
                  value="HIGH"
                  bind:group={newChapterPriority}
                  class="sr-only"
                />
                <span>Alta</span>
              </label>

              <label class="priority-radio-option urgent" class:active={newChapterPriority === 'URGENT'}>
                <input
                  type="radio"
                  name="priority"
                  value="URGENT"
                  bind:group={newChapterPriority}
                  class="sr-only"
                />
                <span>Urgente</span>
              </label>
            </div>
          </div>

          <!-- Checkbox: Assumir RAW Imediatamente -->
          <div class="form-group-checkbox">
            <label class="checkbox-container">
              <input
                type="checkbox"
                name="auto_claim"
                value="true"
                bind:checked={newChapterAutoClaim}
                class="form-checkbox"
              />
              <span class="checkbox-label-text">
                <strong>Assumir este capítulo imediatamente</strong>
                <small>O capítulo já entra na sua fila de tarefas como responsável pelo RAW.</small>
              </span>
            </label>
          </div>

          <!-- Rodapé de Ações -->
          <div class="modal-footer">
            <button
              type="button"
              class="btn-modal-cancel"
              onclick={attemptCloseModal}
            >
              Cancelar
            </button>

            <button
              type="submit"
              class="btn-modal-submit"
              disabled={isCreatingChapter || !newChapterWorkId || newChapterNumber === ''}
            >
              {#if isCreatingChapter}
                <span class="spinner-xs"></span>
                <span>Cadastrando...</span>
              {:else}
                <Plus size={15} />
                <span>Criar capítulo</span>
              {/if}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  /* ==========================================================================
     RAW PROVIDER ROOT & VARIABLES
     ========================================================================== */
  .raw-provider-root {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 1680px;
    margin: 0 auto;
    color: #f1f5f9;
    box-sizing: border-box;
  }

  /* ==========================================================================
     COMPACT HEADER (Clean, Professional, Low Profile)
     ========================================================================== */
  .raw-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 18px;
    background: #0d101d;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
  }

  .raw-header-main {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .raw-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .raw-stage-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 7px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    color: #fbbf24;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .stage-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #f59e0b;
    box-shadow: 0 0 6px rgba(245, 158, 11, 0.6);
  }

  .raw-title {
    margin: 0;
    font-size: 19px;
    font-weight: 750;
    color: #ffffff;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  .raw-subtitle {
    margin: 0;
    font-size: 12.5px;
    color: #94a3b8;
    line-height: 1.35;
  }

  .raw-header-action {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .btn-novo-capitulo {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    color: #ffffff;
    border: 1px solid rgba(139, 92, 246, 0.5);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(109, 40, 217, 0.25);
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .btn-novo-capitulo:hover {
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    border-color: rgba(167, 139, 250, 0.6);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(109, 40, 217, 0.35);
  }

  /* ==========================================================================
     CONCEPT B: WORKSPACE UNIFICADO & SEGMENTED TABS
     ========================================================================== */
  .raw-workspace-container {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
  }

  .workspace-nav-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .segmented-control {
    display: inline-flex;
    align-items: center;
    background: #090c15;
    padding: 4px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    gap: 4px;
  }

  .segment-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 14px;
    border-radius: 7px;
    background: transparent;
    border: 1px solid transparent;
    color: #94a3b8;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
    user-select: none;
  }

  .segment-btn:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.04);
  }

  .segment-btn.active {
    background: #141829;
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .segment-badge {
    padding: 1px 6px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 700;
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .segment-badge.mine {
    background: rgba(168, 85, 247, 0.15);
    color: #c084fc;
    border-color: rgba(168, 85, 247, 0.3);
  }

  .segment-badge.urgent {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
    border-color: rgba(239, 68, 68, 0.4);
  }

  .urgent-pulse-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ef4444;
    box-shadow: 0 0 8px #ef4444;
    animation: pulseDot 1.8s infinite;
  }

  @keyframes pulseDot {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.4); opacity: 0.6; }
  }

  .workspace-filters {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .search-mini-box {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: #090c15;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    min-width: 180px;
  }

  .search-mini-box:focus-within {
    border-color: rgba(139, 92, 246, 0.5);
  }

  :global(.search-mini-icon) {
    color: #64748b;
  }

  .search-mini-input {
    background: transparent;
    border: none;
    outline: none;
    color: #f1f5f9;
    font-size: 12.5px;
    width: 100%;
  }

  .search-mini-input::placeholder {
    color: #64748b;
  }

  .btn-clear-mini {
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 1px;
    display: flex;
  }

  .work-mini-select {
    padding: 6px 10px;
    background: #090c15;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #cbd5e1;
    font-size: 12.5px;
    outline: none;
    cursor: pointer;
  }

  .work-mini-select option {
    background: #0e111d;
    color: #f1f5f9;
  }

  .workspace-content-pane {
    width: 100%;
  }

  .workspace-side-by-side {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 18px;
    width: 100%;
  }

  .side-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: #0c0f1a;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    padding: 16px;
    box-sizing: border-box;
  }

  .side-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .side-title-lockup {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .side-panel-title {
    margin: 0;
    font-size: 14.5px;
    font-weight: 700;
    color: #ffffff;
  }

  /* ==========================================================================
     ELEGANT WORKSPACE EMPTY STATE (Compact Halo & Clear Action)
     ========================================================================== */
  .workspace-empty-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 32px 20px;
    background: #0a0d18;
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    gap: 10px;
    width: 100%;
    box-sizing: border-box;
  }

  .empty-halo-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    box-shadow: 0 0 20px rgba(16, 185, 129, 0.15);
  }

  .empty-halo-icon.neutral {
    background: rgba(148, 163, 184, 0.08);
    border-color: rgba(148, 163, 184, 0.15);
    box-shadow: none;
  }

  .empty-body {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .empty-heading {
    font-size: 14.5px;
    font-weight: 700;
    color: #f1f5f9;
  }

  .empty-subtext {
    margin: 0;
    font-size: 12.5px;
    color: #94a3b8;
    max-width: 380px;
    line-height: 1.4;
  }

  .btn-empty-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    margin-top: 4px;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.35);
    border-radius: 8px;
    color: #c4b5fd;
    font-size: 12.5px;
    font-weight: 650;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-empty-action:hover {
    background: rgba(139, 92, 246, 0.25);
    border-color: rgba(139, 92, 246, 0.5);
    color: #ffffff;
  }

  .btn-empty-action.amber {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.35);
    color: #fbbf24;
  }

  .btn-empty-action.amber:hover {
    background: rgba(245, 158, 11, 0.25);
    border-color: rgba(245, 158, 11, 0.5);
    color: #ffffff;
  }

  /* ==========================================================================
     CONCEPT A: SPLIT PANELS (VIA ?variant=split)
     ========================================================================== */
  .raw-filter-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .search-input-box {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    flex: 1;
    min-width: 220px;
    max-width: 360px;
  }

  .search-input-box:focus-within {
    border-color: rgba(139, 92, 246, 0.5);
  }

  :global(.search-box-icon) {
    color: #64748b;
  }

  .search-input-field {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #f1f5f9;
    font-size: 13px;
  }

  .btn-clear-search {
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 2px;
    display: flex;
  }

  .work-filter-box {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
  }

  :global(.filter-box-icon) {
    color: #64748b;
  }

  .work-filter-select {
    background: transparent;
    border: none;
    outline: none;
    color: #cbd5e1;
    font-size: 12.5px;
    cursor: pointer;
    font-weight: 500;
  }

  .work-filter-select option {
    background: #0e111d;
    color: #f1f5f9;
  }

  .raw-main-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-auto-rows: max-content;
    align-content: start;
    align-items: start;
    gap: 18px;
    width: 100%;
    min-height: 0;
  }

  @media (max-width: 1024px) {
    .raw-main-grid {
      grid-template-columns: minmax(0, 1fr);
      grid-auto-rows: max-content;
      align-content: start;
      gap: 16px;
      min-height: 0;
    }
  }

  .raw-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: #0c0f1a;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    padding: 16px 18px;
    box-sizing: border-box;
  }

  .section-headline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .section-title-lockup {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section-title {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.01em;
  }

  .section-counter-badge {
    padding: 2px 7px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 700;
  }

  .count-available {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .count-mine {
    background: rgba(168, 85, 247, 0.15);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.3);
  }

  .section-hint {
    font-size: 11.5px;
    color: #64748b;
  }

  /* ==========================================================================
     CARDS LIST & CARDS DESIGN (Proportional, Clean, Informative)
     ========================================================================== */
  .raw-cards-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  .raw-card {
    display: flex;
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 12px 14px;
    gap: 14px;
    transition: border-color 0.15s ease, background-color 0.15s ease;
    width: 100%;
    box-sizing: border-box;
  }

  .raw-card:hover {
    border-color: rgba(255, 255, 255, 0.15);
    background: #111524;
  }

  .raw-card-top-row {
    display: flex;
    gap: 14px;
    width: 100%;
    align-items: center;
  }

  .my-card {
    flex-direction: column;
    gap: 10px;
  }

  .raw-card-cover-wrap {
    width: 48px;
    height: 64px;
    border-radius: 6px;
    overflow: hidden;
    background: #171b2b;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .raw-card-cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .raw-card-cover-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .raw-card-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .card-meta-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .card-work-title {
    font-size: 14px;
    font-weight: 700;
    color: #f8fafc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-priority-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10.5px;
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    flex-shrink: 0;
  }

  .priority-urgent {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .urgent-pulse-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #ef4444;
    box-shadow: 0 0 6px #ef4444;
  }

  .priority-high {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .priority-normal {
    background: rgba(148, 163, 184, 0.1);
    color: #94a3b8;
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .card-chapter-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .chapter-badge {
    font-size: 12.5px;
    font-weight: 700;
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.1);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .chapter-sublabel {
    font-size: 12px;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }

  .card-status-badge.success {
    background: rgba(16, 185, 129, 0.12);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.25);
  }

  .card-status-badge.pending {
    background: rgba(245, 158, 11, 0.12);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.25);
  }

  .card-footer-action {
    display: flex;
    align-items: center;
    margin-top: 4px;
  }

  .btn-pegar-capitulo {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background: rgba(245, 158, 11, 0.14);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.35);
    border-radius: 6px;
    font-size: 12.5px;
    font-weight: 650;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-pegar-capitulo:hover:not(:disabled) {
    background: rgba(245, 158, 11, 0.25);
    border-color: rgba(245, 158, 11, 0.5);
    color: #ffffff;
    transform: translateY(-1px);
  }

  .btn-pegar-capitulo.btn-disabled {
    background: rgba(100, 116, 139, 0.1);
    color: #64748b;
    border-color: rgba(100, 116, 139, 0.2);
    cursor: not-allowed;
  }

  .my-card-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    flex-wrap: wrap;
  }

  .btn-toggle-upload {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #e2e8f0;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-toggle-upload:hover,
  .btn-toggle-upload.active {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.4);
    color: #c4b5fd;
  }

  .btn-toggle-upload.cta-needed {
    background: rgba(139, 92, 246, 0.18);
    border-color: rgba(139, 92, 246, 0.45);
    color: #e9d5ff;
    font-weight: 650;
  }

  .btn-toggle-upload.cta-needed:hover {
    background: rgba(139, 92, 246, 0.28);
    border-color: rgba(139, 92, 246, 0.65);
    color: #ffffff;
  }

  .btn-concluir-raw {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.35);
    border-radius: 6px;
    color: #34d399;
    font-size: 12px;
    font-weight: 650;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-concluir-raw:hover:not(:disabled) {
    background: rgba(16, 185, 129, 0.25);
    border-color: rgba(16, 185, 129, 0.5);
    color: #ffffff;
    transform: translateY(-1px);
  }

  /* Inline Deliverable Upload Accordion */
  .raw-upload-accordion {
    width: 100%;
    margin-top: 6px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .upload-accordion-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    flex-wrap: wrap;
  }

  .upload-title-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .upload-accordion-title {
    font-weight: 650;
    color: #cbd5e1;
  }

  .upload-format-note {
    font-size: 11px;
    color: #64748b;
  }

  .upload-step-hint {
    font-size: 11px;
    font-weight: 600;
    color: #a78bfa;
    background: rgba(139, 92, 246, 0.12);
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid rgba(139, 92, 246, 0.25);
  }

  /* Alerts */
  .claim-alert-notice {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12.5px;
    margin-bottom: 8px;
  }

  .claim-alert-notice.error {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .claim-alert-notice.success {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #6ee7b7;
  }

  .btn-close-alert {
    background: transparent;
    border: none;
    color: currentColor;
    cursor: pointer;
    margin-left: auto;
    display: flex;
    align-items: center;
  }

  /* ==========================================================================
     MODAL: CADASTRAR NOVO CAPÍTULO (Proportional 540px, Accessible)
     ========================================================================== */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(5px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
    box-sizing: border-box;
    animation: fadeInModal 0.15s ease-out;
  }

  @keyframes fadeInModal {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-card {
    background: #0f1322;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    width: 100%;
    max-width: 540px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: scaleInModal 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes scaleInModal {
    from { transform: scale(0.96); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 22px 14px 22px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .modal-header-lockup {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .modal-icon-badge {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .modal-title {
    margin: 0;
    font-size: 17px;
    font-weight: 750;
    color: #ffffff;
  }

  .modal-subtitle {
    margin: 2px 0 0 0;
    font-size: 12.5px;
    color: #94a3b8;
  }

  .btn-modal-close {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    border-radius: 8px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-modal-close:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    color: #f87171;
  }

  .modal-feedback-alert {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 14px 22px 0 22px;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 13px;
  }

  .modal-feedback-alert.error {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .modal-form {
    padding: 20px 24px 24px 24px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-label {
    font-size: 13px;
    font-weight: 650;
    color: #cbd5e1;
  }

  .form-select,
  .form-input {
    width: 100%;
    padding: 10px 14px;
    background: #131726;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #f8fafc;
    font-size: 13.5px;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s ease;
  }

  .form-select:focus,
  .form-input:focus {
    border-color: rgba(139, 92, 246, 0.6);
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.15);
  }

  .form-grid-two {
    display: grid;
    grid-template-columns: 1fr 1.35fr;
    gap: 14px;
  }

  /* Priority Radio Pills */
  .priority-toggle-group {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
  }

  .priority-radio-option {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 9px 12px;
    background: #131726;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 7px;
    font-size: 13px;
    font-weight: 600;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .priority-radio-option:hover {
    border-color: rgba(255, 255, 255, 0.2);
    color: #f1f5f9;
  }

  .priority-radio-option.active {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.5);
    color: #c4b5fd;
    font-weight: 700;
  }

  .priority-radio-option.urgent.active {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.5);
    color: #fca5a5;
  }

  /* Auto Claim Checkbox */
  .form-group-checkbox {
    padding: 10px 12px;
    background: rgba(245, 158, 11, 0.06);
    border: 1px solid rgba(245, 158, 11, 0.18);
    border-radius: 8px;
  }

  .checkbox-container {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    cursor: pointer;
  }

  .form-checkbox {
    margin-top: 3px;
    accent-color: #f59e0b;
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .checkbox-label-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .checkbox-label-text strong {
    font-size: 13px;
    color: #f8fafc;
  }

  .checkbox-label-text small {
    font-size: 11.5px;
    color: #94a3b8;
    line-height: 1.3;
  }

  /* Modal Footer */
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .btn-modal-cancel {
    padding: 10px 18px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: 40px;
  }

  .btn-modal-cancel:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .btn-modal-submit {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 20px;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    border: 1px solid rgba(139, 92, 246, 0.5);
    color: #ffffff;
    border-radius: 8px;
    font-size: 13.5px;
    font-weight: 650;
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: 40px;
  }

  .btn-modal-submit:hover:not(:disabled) {
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    transform: translateY(-1px);
  }

  .btn-modal-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Utility Spinner */
  .spinner-xs {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    display: inline-block;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ==========================================================================
     MOBILE RESPONSIVENESS & BREAKPOINTS
     ========================================================================== */
  @media (max-width: 768px) {
    .raw-provider-root {
      gap: 14px;
      padding-bottom: 72px; /* Bottom bar clearance */
    }

    .raw-header {
      padding: 11px 14px;
      gap: 10px;
    }

    .raw-title {
      font-size: 17px;
    }

    .raw-subtitle {
      font-size: 11.5px;
    }

    .btn-novo-capitulo {
      padding: 7px 12px;
      font-size: 12.5px;
    }

    .workspace-nav-bar {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }

    .segmented-control {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      box-sizing: border-box;
    }

    .segment-btn {
      justify-content: center;
      padding: 9px 8px;
      font-size: 12.5px;
    }

    .desktop-only {
      display: none !important;
    }

    .workspace-filters {
      width: 100%;
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
    }

    .search-mini-box {
      width: 100%;
      box-sizing: border-box;
    }

    .work-mini-select {
      width: 100%;
      box-sizing: border-box;
    }

    .raw-filter-toolbar {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }

    .search-input-box {
      max-width: 100%;
      min-width: 0;
    }

    .work-filter-box {
      width: 100%;
      box-sizing: border-box;
      justify-content: space-between;
    }

    .work-filter-select {
      width: 100%;
    }

    .raw-section {
      padding: 14px 14px 16px 14px;
    }

    .form-grid-two {
      grid-template-columns: 1fr;
    }

    .modal-backdrop {
      align-items: flex-end;
      padding: 0;
    }

    .modal-card {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      max-height: 85dvh;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding-bottom: max(20px, env(safe-area-inset-bottom, 20px));
    }

    .modal-form {
      padding: 16px 16px 20px 16px;
      gap: 16px;
    }

    .btn-modal-cancel,
    .btn-modal-submit {
      min-height: 44px;
      padding: 11px 18px;
      font-size: 14px;
    }
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
