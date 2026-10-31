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
        // High/Urgent priority first, then chapter number ascending
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

  function handleKeydownModal(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      showNewChapterModal = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydownModal} />

<div class="raw-provider-root">
  <!-- COMPACT HEADER (Clean, Elegant, No High Banner) -->
  <header class="raw-header">
    <div class="raw-header-left">
      <div class="raw-stage-badge">
        <span class="raw-badge-dot"></span>
        <span class="raw-badge-text">Etapa 1 · Raw Provider</span>
      </div>
      <h1 class="raw-page-title">Raw Provider</h1>
      <p class="raw-page-subtitle">
        <span class="desktop-subtitle">Cadastre capítulos e envie os arquivos originais para iniciar a produção.</span>
        <span class="mobile-subtitle">Cadastre ou providencie o RAW de um capítulo.</span>
      </p>
    </div>

    <div class="raw-header-right">
      <button
        type="button"
        class="btn-novo-capitulo"
        onclick={() => {
          showNewChapterModal = true;
          createFeedback = null;
        }}
        title="Cadastrar um novo capítulo na scan"
      >
        <Plus size={16} class="btn-icon" />
        <span>Novo capítulo</span>
      </button>
    </div>
  </header>

  <!-- DISCREET SEARCH & FILTER BAR (Only if works exist) -->
  {#if works.length > 0 && (availableItems.length > 0 || myItems.length > 0 || searchQuery || filterWorkId !== 'ALL')}
    <div class="raw-filter-toolbar">
      <div class="search-input-box">
        <Search size={15} class="search-box-icon" />
        <input
          type="text"
          placeholder="Buscar obra ou capítulo..."
          bind:value={searchQuery}
          class="search-input-field"
        />
        {#if searchQuery}
          <button type="button" class="btn-clear-search" onclick={() => (searchQuery = '')} aria-label="Limpar busca">
            <X size={14} />
          </button>
        {/if}
      </div>

      {#if works.length > 1}
        <div class="work-filter-box">
          <Filter size={14} class="filter-box-icon" />
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

  <!-- MAIN SECTIONS COMPOSITION (Side-by-side on wide screens, stacked on mobile) -->
  <main class="raw-main-grid">
    <!-- SECTION 1: CAPÍTULOS DISPONÍVEIS (Central Pool of Chapters awaiting RAW) -->
    <section class="raw-section raw-available-section">
      <div class="section-headline">
        <div class="section-title-lockup">
          <Layers size={17} class="section-icon text-amber-400" />
          <h2 class="section-title">Capítulos disponíveis</h2>
          <span class="section-counter-badge count-available">{availableItems.length}</span>
        </div>
        <span class="section-hint">Prontos para assumir</span>
      </div>

      {#if claimFeedback}
        <div class="claim-alert-notice error">
          <AlertCircle size={15} />
          <span>{claimFeedback.text}</span>
          <button type="button" class="btn-close-alert" onclick={() => (claimFeedback = null)}>
            <X size={13} />
          </button>
        </div>
      {/if}

      {#if availableItems.length === 0}
        <div class="raw-empty-compact">
          <div class="empty-icon-pill">
            <CheckCircle2 size={16} class="text-emerald-400" />
          </div>
          <div class="empty-text-wrap">
            <strong class="empty-title">Tudo em dia por aqui.</strong>
            <span class="empty-desc">Nenhum capítulo aguardando RAW no momento.</span>
          </div>
        </div>
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
    </section>

    <!-- SECTION 2: MEUS CAPÍTULOS (Assigned to Current User, Upload & Completion) -->
    <section class="raw-section raw-my-section">
      <div class="section-headline">
        <div class="section-title-lockup">
          <Clock size={17} class="section-icon text-purple-400" />
          <h2 class="section-title">Meus capítulos</h2>
          <span class="section-counter-badge count-mine">{myItems.length}</span>
        </div>
        <span class="section-hint">Sob sua responsabilidade</span>
      </div>

      {#if completeFeedback}
        <div class="claim-alert-notice {completeFeedback.type}">
          <AlertCircle size={15} />
          <span>{completeFeedback.text}</span>
          <button type="button" class="btn-close-alert" onclick={() => (completeFeedback = null)}>
            <X size={13} />
          </button>
        </div>
      {/if}

      {#if myItems.length === 0}
        <div class="raw-empty-compact my-empty">
          <div class="empty-icon-pill neutral">
            <Clock size={16} class="text-slate-400" />
          </div>
          <div class="empty-text-wrap">
            <span class="empty-desc">Você não possui capítulos RAW em andamento.</span>
          </div>
        </div>
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
                        <span>{files.length} arquivo{files.length > 1 ? 's' : ''}</span>
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
                    <span class="upload-accordion-title">Arquivos originais do Capítulo #{item.ch.chapter_number}</span>
                    <span class="upload-format-note">Formatos: .zip, .cbz ou imagens sequenciais</span>
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
    </section>
  </main>

  <!-- MODAL: CADASTRAR NOVO CAPÍTULO (COLLAPSED BY DEFAULT) -->
  {#if showNewChapterModal}
    <div
      class="modal-backdrop"
      onclick={(e) => {
        if (e.target === e.currentTarget) showNewChapterModal = false;
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
            onclick={() => (showNewChapterModal = false)}
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
              onclick={() => (showNewChapterModal = false)}
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
     RAW PROVIDER ROOT & RESET
     ========================================================================== */
  .raw-provider-root {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    max-width: 1680px;
    margin: 0 auto;
    color: #f1f5f9;
    box-sizing: border-box;
  }

  /* ==========================================================================
     COMPACT HEADER (Clean, Professional, No Giant Banners)
     ========================================================================== */
  .raw-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 20px;
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
  }

  .raw-header-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .raw-stage-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 20px;
    width: fit-content;
  }

  .raw-badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #f59e0b;
    box-shadow: 0 0 6px rgba(245, 158, 11, 0.6);
  }

  .raw-badge-text {
    font-size: 11px;
    font-weight: 600;
    color: #fbbf24;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .raw-page-title {
    margin: 0;
    font-size: 22px;
    font-weight: 750;
    letter-spacing: -0.02em;
    color: #ffffff;
    line-height: 1.2;
  }

  .raw-page-subtitle {
    margin: 0;
    font-size: 13px;
    color: #94a3b8;
    line-height: 1.4;
  }

  .raw-page-subtitle .mobile-subtitle {
    display: none;
  }

  .raw-header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .btn-novo-capitulo {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 18px;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    color: #ffffff;
    border: 1px solid rgba(139, 92, 246, 0.5);
    border-radius: 8px;
    font-size: 13.5px;
    font-weight: 650;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(109, 40, 217, 0.25);
    transition: all 0.15s ease;
  }

  .btn-novo-capitulo:hover {
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    border-color: rgba(167, 139, 250, 0.6);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(109, 40, 217, 0.35);
  }

  .btn-novo-capitulo:active {
    transform: translateY(0);
  }

  /* ==========================================================================
     DISCREET FILTER TOOLBAR
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
    flex-shrink: 0;
  }

  .search-input-field {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #f1f5f9;
    font-size: 13px;
  }

  .search-input-field::placeholder {
    color: #64748b;
  }

  .btn-clear-search {
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
  }

  .btn-clear-search:hover {
    color: #f1f5f9;
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

  /* ==========================================================================
     MAIN GRID COMPOSITION (Side-by-side balanced cards)
     ========================================================================== */
  .raw-main-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 20px;
    align-items: start;
    width: 100%;
  }

  @media (max-width: 1024px) {
    .raw-main-grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 20px;
    }
  }

  .raw-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: #0c0f1a;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    padding: 18px 18px 20px 18px;
    box-sizing: border-box;
  }

  .section-headline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .section-title-lockup {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section-title {
    margin: 0;
    font-size: 15.5px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.01em;
  }

  .section-counter-badge {
    padding: 2px 7px;
    border-radius: 12px;
    font-size: 11.5px;
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
     COMPACT EMPTY STATES (Discreet, No 300px Giant Boxes)
     ========================================================================== */
  .raw-empty-compact {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: rgba(14, 17, 29, 0.6);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 9px;
  }

  .empty-icon-pill {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(16, 185, 129, 0.12);
    flex-shrink: 0;
  }

  .empty-icon-pill.neutral {
    background: rgba(148, 163, 184, 0.1);
  }

  .empty-text-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .empty-title {
    font-size: 13px;
    font-weight: 650;
    color: #e2e8f0;
  }

  .empty-desc {
    font-size: 12px;
    color: #94a3b8;
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
    border-color: rgba(255, 255, 255, 0.14);
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
    background: rgba(245, 158, 11, 0.15);
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
    gap: 8px;
    font-size: 12px;
  }

  .upload-accordion-title {
    font-weight: 650;
    color: #cbd5e1;
  }

  .upload-format-note {
    font-size: 11px;
    color: #64748b;
  }

  /* Alerts */
  .claim-alert-notice {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12.5px;
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
     MODAL: CADASTRAR NOVO CAPÍTULO (Clean, Focused, Accessible)
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
    max-width: 520px;
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
    padding: 18px 20px 14px 20px;
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
    margin: 14px 20px 0 20px;
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
    padding: 18px 20px 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-label {
    font-size: 12.5px;
    font-weight: 650;
    color: #cbd5e1;
  }

  .form-select,
  .form-input {
    width: 100%;
    padding: 9px 12px;
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
    grid-template-columns: 1fr 1.4fr;
    gap: 12px;
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
    padding: 8px;
    background: #131726;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 7px;
    font-size: 12.5px;
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
    gap: 10px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .btn-modal-cancel {
    padding: 9px 16px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-modal-cancel:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .btn-modal-submit {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 18px;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    border: 1px solid rgba(139, 92, 246, 0.5);
    color: #ffffff;
    border-radius: 8px;
    font-size: 13.5px;
    font-weight: 650;
    cursor: pointer;
    transition: all 0.15s ease;
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
     MOBILE RESPONSIVENESS (Android Standard 10/10)
     ========================================================================== */
  @media (max-width: 768px) {
    .raw-provider-root {
      gap: 16px;
      padding-bottom: 72px; /* Bottom bar clearance */
    }

    .raw-header {
      flex-direction: column;
      align-items: stretch;
      padding: 14px 16px;
      gap: 12px;
    }

    .raw-page-title {
      font-size: 20px;
    }

    .raw-page-subtitle .desktop-subtitle {
      display: none;
    }

    .raw-page-subtitle .mobile-subtitle {
      display: inline;
    }

    .raw-header-right {
      width: 100%;
    }

    .btn-novo-capitulo {
      width: 100%;
      justify-content: center;
      padding: 11px;
      font-size: 14px;
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
      max-height: 90vh;
      overflow-y: auto;
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
