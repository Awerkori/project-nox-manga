<script lang="ts">
  import { enhance } from '$app/forms';
  import {
    AlertCircle,
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    Download,
    Eye,
    FileArchive,
    FileCheck,
    FileText,
    Filter,
    FolderKanban,
    HelpCircle,
    Layers,
    Lock,
    Package,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    Sparkles,
    Trash2,
    Upload,
    X,
    Zap
  } from '@lucide/svelte';
  import { evaluateStageClaim, normalizePositionName } from '$lib/scan-roles';
  import PipelineDeliverableUpload from './PipelineDeliverableUpload.svelte';

  interface Props {
    stageSlug?: string;
    activeCanonical?: any;
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
    stageSlug = 'traducao',
    activeCanonical = null,
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
    isOwnerOrAdmin: isOwnerOrAdminProp = false,
    scanId = '',
    onSelectStage = (_slug: string) => {},
    onOpenChapter = (_chapter: any) => {}
  }: Props = $props();

  let isOwnerOrAdmin = $derived(isOwnerOrAdminProp || userRole === 'OWNER' || userRole === 'ADMIN');

  // Helper to match stage slugs robustly
  function matchesStageSlug(candidate: any, target: string): boolean {
    const s = (typeof candidate === 'string' ? candidate : candidate?.slug || '').toLowerCase().trim();
    const t = target.toLowerCase().trim();
    if (s === t) return true;
    if (t === 'clean' || t === 'clean_redraw' || t === 'clean/redraw') {
      return s === 'clean' || s === 'clean_redraw' || s === 'clean/redraw';
    }
    if (t === 'traducao' || t === 'translation') {
      return s === 'traducao' || s === 'translation';
    }
    if (t === 'typeset' || t === 'typer') {
      return s === 'typeset' || s === 'typer';
    }
    if (t === 'raw') {
      return s === 'raw' || s === 'raw_provider';
    }
    return false;
  }

  // Canonical Stage Identifier (normalized)
  let canonicalSlug = $derived.by(() => {
    const slug = stageSlug || activeCanonical?.slug || 'traducao';
    if (matchesStageSlug(slug, 'traducao')) return 'traducao';
    if (matchesStageSlug(slug, 'clean_redraw')) return 'clean_redraw';
    if (matchesStageSlug(slug, 'typeset')) return 'typeset';
    return slug;
  });

  // Stage Specific Presentation & Operational Configuration
  interface StagePreset {
    title: string;
    pillLabel: string;
    pillBg: string;
    pillBorder: string;
    accentColor: string;
    accentLight: string;
    accentGlow: string;
    subtitle: string;
    mobileSubtitle: string;
    roleRequiredSlug: string;
    roleRequiredName: string;
    claimActionLabel: string;
    completeActionLabel: string;
    emptyAvailableTitle: string;
    emptyAvailableDesc: string;
    emptyMineTitle: string;
    emptyMineDesc: string;
    uploadTitle: string;
    uploadFormatHint: string;
    uploadStepHint: string;
  }

  const STAGE_PRESETS: Record<string, StagePreset> = {
    traducao: {
      title: 'Tradução',
      pillLabel: 'ETAPA 2',
      pillBg: 'rgba(59, 130, 246, 0.12)',
      pillBorder: 'rgba(59, 130, 246, 0.3)',
      accentColor: '#3b82f6',
      accentLight: '#60a5fa',
      accentGlow: 'rgba(59, 130, 246, 0.25)',
      subtitle: 'Traduza os capítulos com RAW disponível.',
      mobileSubtitle: 'Traduza os capítulos disponíveis.',
      roleRequiredSlug: 'tradutor',
      roleRequiredName: 'Tradutor',
      claimActionLabel: 'Assumir tradução',
      completeActionLabel: 'Concluir Tradução',
      emptyAvailableTitle: 'Tudo em dia por aqui',
      emptyAvailableDesc: 'Não há capítulos disponíveis para tradução no momento.',
      emptyMineTitle: 'Nenhum capítulo em andamento',
      emptyMineDesc: 'Quando você assumir uma tradução, ela aparecerá aqui.',
      uploadTitle: 'Minha tradução',
      uploadFormatHint: 'Formatos aceitos: .docx, .doc, .txt ou arquivo de script',
      uploadStepHint: '1º Envie sua tradução abaixo • 2º Clique em "Concluir Tradução" ao final'
    },
    clean_redraw: {
      title: 'Clean/Redraw',
      pillLabel: 'ETAPA 3',
      pillBg: 'rgba(236, 72, 153, 0.12)',
      pillBorder: 'rgba(236, 72, 153, 0.3)',
      accentColor: '#ec4899',
      accentLight: '#f472b6',
      accentGlow: 'rgba(236, 72, 153, 0.25)',
      subtitle: 'Prepare as páginas limpas e reconstrua a arte.',
      mobileSubtitle: 'Limpeza e reconstrução de páginas.',
      roleRequiredSlug: 'clean_redraw',
      roleRequiredName: 'Clean/Redraw',
      claimActionLabel: 'Assumir Clean/Redraw',
      completeActionLabel: 'Concluir Clean/Redraw',
      emptyAvailableTitle: 'Tudo em dia por aqui',
      emptyAvailableDesc: 'Não há capítulos disponíveis para Clean/Redraw no momento.',
      emptyMineTitle: 'Nenhum capítulo em andamento',
      emptyMineDesc: 'Quando você assumir um Clean/Redraw, ele aparecerá aqui.',
      uploadTitle: 'Minhas páginas limpas',
      uploadFormatHint: 'Formatos aceitos: .zip, .cbz ou páginas limpas sequenciais',
      uploadStepHint: '1º Envie as páginas limpas abaixo • 2º Clique em "Concluir Clean/Redraw" ao final'
    },
    typeset: {
      title: 'Typeset',
      pillLabel: 'ETAPA 4',
      pillBg: 'rgba(245, 158, 11, 0.12)',
      pillBorder: 'rgba(245, 158, 11, 0.3)',
      accentColor: '#f59e0b',
      accentLight: '#fbbf24',
      accentGlow: 'rgba(245, 158, 11, 0.25)',
      subtitle: 'Combine tradução e arte para finalizar as páginas.',
      mobileSubtitle: 'Diagramação e finalização das páginas.',
      roleRequiredSlug: 'typer',
      roleRequiredName: 'Typer',
      claimActionLabel: 'Assumir Typeset',
      completeActionLabel: 'Concluir Typeset',
      emptyAvailableTitle: 'Tudo em dia por aqui',
      emptyAvailableDesc: 'Não há capítulos disponíveis para Typeset no momento.',
      emptyMineTitle: 'Nenhum capítulo em andamento',
      emptyMineDesc: 'Quando você assumir um Typeset, ele aparecerá aqui.',
      uploadTitle: 'Minha entrega finalizada',
      uploadFormatHint: 'Formatos aceitos: .zip, .cbz ou páginas diagramadas finalizadas',
      uploadStepHint: '1º Baixe Tradução e Clean • 2º Envie as páginas diagramadas • 3º Conclua o Typeset'
    }
  };

  let stageConfig = $derived(STAGE_PRESETS[canonicalSlug] || STAGE_PRESETS.traducao);

  // Active Stage Claim Evaluation based on user role and permissions
  let claimEvaluation = $derived(
    evaluateStageClaim(userRole, userPositions, canonicalSlug)
  );

  // Filter & Search Controls
  let searchQuery = $state('');
  let filterWorkId = $state<string>('ALL');
  let activeCategory = $state<'available' | 'mine' | 'both'>('available');
  let userSelectedCategory = $state(false);

  function selectCategory(cat: 'available' | 'mine' | 'both') {
    activeCategory = cat;
    userSelectedCategory = true;
  }

  // Expanded Chapter Workspaces
  let expandedChapterIds = $state<Record<string, boolean>>({});
  let mobileAccordionState = $state<Record<string, { inputs: boolean; delivery: boolean }>>({});

  // Action Pending States & User Feedback
  let isClaimingStageId = $state<string | null>(null);
  let isCompletingStageId = $state<string | null>(null);
  let isReleasingStageId = $state<string | null>(null);
  let claimFeedback = $state<{ stageId: string; type: 'error' | 'success'; text: string } | null>(null);
  let completeFeedback = $state<{ stageId: string; type: 'error' | 'success'; text: string } | null>(null);

  // Helper to reliably retrieve work cover url
  function getWorkCoverUrl(work: any): string | null {
    if (!work) return null;
    const coverId = work.cover_id || work.cover_image_id || work.coverId;
    if (coverId) return `/media/${coverId}?size=thumb&v=3`;
    if (work.cover_url) return work.cover_url;
    return null;
  }

  // Format bytes helper
  function formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Format priority tags
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

  // Retrieve deliverable files for a specific chapter stage
  function getDeliverableFiles(cs: any, chId: string) {
    return productionFiles.filter(
      (f: any) =>
        f.production_chapter_id === chId &&
        (f.stage_id === cs.stage_id || matchesStageSlug(f.stage_slug || f.stage?.slug, canonicalSlug)) &&
        f.is_current
    );
  }

  // Retrieve upstream dependency files for this stage
  function getUpstreamInputs(chId: string) {
    const files = productionFiles.filter((f: any) => f.production_chapter_id === chId && f.is_current);

    if (canonicalSlug === 'typeset') {
      const cleanFiles = files.filter((f: any) => matchesStageSlug(f.stage_slug || f.stage?.slug, 'clean_redraw'));
      const tradFiles = files.filter((f: any) => matchesStageSlug(f.stage_slug || f.stage?.slug, 'traducao'));
      return {
        isTypeset: true,
        cleanFiles,
        tradFiles,
        hasClean: cleanFiles.length > 0,
        hasTrad: tradFiles.length > 0,
        all: [...cleanFiles, ...tradFiles]
      };
    }

    // Tradução and Clean/Redraw both rely on RAW
    const rawFiles = files.filter((f: any) => matchesStageSlug(f.stage_slug || f.stage?.slug, 'raw'));
    return {
      isTypeset: false,
      rawFiles,
      hasRaw: rawFiles.length > 0,
      all: rawFiles
    };
  }

  // Strict check on Typeset Prerequisites:
  // Typeset REQUIRES BOTH Tradução AND Clean/Redraw to be completed with valid deliverables!
  function checkTypesetPrerequisites(chId: string) {
    const tradStage = chapterStages.find(
      (cs: any) => cs.production_chapter_id === chId && matchesStageSlug(cs.stage?.slug, 'traducao')
    );
    const cleanStage = chapterStages.find(
      (cs: any) => cs.production_chapter_id === chId && matchesStageSlug(cs.stage?.slug, 'clean_redraw')
    );

    const inputs = getUpstreamInputs(chId);
    const cleanReady = inputs.hasClean && (cleanStage?.status === 'DONE' || !cleanStage);
    const tradReady = inputs.hasTrad && (tradStage?.status === 'DONE' || !tradStage);
    const isEligible = cleanReady && tradReady;

    let blockedReason = '';
    if (!cleanReady && !tradReady) {
      blockedReason = 'Aguardando Tradução e Clean/Redraw serem concluídos com arquivos válidos.';
    } else if (!cleanReady) {
      blockedReason = 'Aguardando Clean/Redraw ser concluído com páginas limpas entregues.';
    } else if (!tradReady) {
      blockedReason = 'Aguardando Tradução ser concluída com script ou arquivo entregue.';
    }

    return {
      isEligible,
      blockedReason,
      cleanReady,
      tradReady,
      cleanCount: inputs.cleanFiles.length,
      tradCount: inputs.tradFiles.length
    };
  }

  // Check upstream readiness for Tradução & Clean/Redraw (RAW readiness)
  function checkRawPrerequisites(chId: string) {
    const rawStage = chapterStages.find(
      (cs: any) => cs.production_chapter_id === chId && matchesStageSlug(cs.stage?.slug, 'raw')
    );
    const inputs = getUpstreamInputs(chId);
    const rawReady = inputs.hasRaw || rawStage?.status === 'DONE';
    return {
      rawReady,
      rawCount: inputs.rawFiles?.length || 0,
      blockedReason: rawReady ? '' : 'Aguardando upload do arquivo RAW original.'
    };
  }

  // Filter all items belonging to current stage
  let activeStageItems = $derived.by(() => {
    const result: any[] = [];
    for (const cs of chapterStages) {
      const slug = cs.stage?.slug || '';
      if (matchesStageSlug(slug, canonicalSlug)) {
        const ch = chapters.find((c: any) => c.id === cs.production_chapter_id);
        if (ch) {
          const work = ch.work || works.find((w: any) => w.id === ch.work_id);
          result.push({ ch, cs, work });
        }
      }
    }
    return result;
  });

  // Filtered available items (pool of chapters ready to be claimed)
  let availableItems = $derived.by(() => {
    return activeStageItems
      .filter((item: any) => {
        const isFree = (item.cs.status === 'AVAILABLE' || item.cs.status === 'REWORK') && !item.cs.assigned_to;
        return isFree;
      })
      .filter((item: any) => {
        const matchesWork = filterWorkId === 'ALL' || item.work?.id === filterWorkId;
        const query = searchQuery.trim().toLowerCase();
        if (!query) return matchesWork;
        const title = (item.work?.title || '').toLowerCase();
        const num = String(item.ch.chapter_number || '');
        const label = (item.ch.chapter_label || '').toLowerCase();
        return matchesWork && (title.includes(query) || num.includes(query) || label.includes(query));
      });
  });

  // Filtered my items (chapters currently assigned to the logged user)
  let myItems = $derived.by(() => {
    return activeStageItems
      .filter((item: any) => {
        return (
          item.cs.assigned_to === currentUserId &&
          (item.cs.status === 'IN_PROGRESS' || item.cs.status === 'REWORK')
        );
      })
      .filter((item: any) => {
        const matchesWork = filterWorkId === 'ALL' || item.work?.id === filterWorkId;
        const query = searchQuery.trim().toLowerCase();
        if (!query) return matchesWork;
        const title = (item.work?.title || '').toLowerCase();
        const num = String(item.ch.chapter_number || '');
        const label = (item.ch.chapter_label || '').toLowerCase();
        return matchesWork && (title.includes(query) || num.includes(query) || label.includes(query));
      });
  });

  // Automatically select 'mine' initially if available is 0 and user has active work
  $effect(() => {
    if (!userSelectedCategory && myItems.length > 0 && availableItems.length === 0 && activeCategory === 'available') {
      activeCategory = 'mine';
    }
  });

  // Toggle chapter workspace expansion
  function toggleChapterWorkspace(stageId: string) {
    expandedChapterIds[stageId] = !expandedChapterIds[stageId];
    if (expandedChapterIds[stageId] && !mobileAccordionState[stageId]) {
      mobileAccordionState[stageId] = { inputs: true, delivery: true };
    }
  }

  // Toggle mobile accordion sub-sections
  function toggleMobileSection(stageId: string, section: 'inputs' | 'delivery') {
    if (!mobileAccordionState[stageId]) {
      mobileAccordionState[stageId] = { inputs: true, delivery: true };
    }
    mobileAccordionState[stageId][section] = !mobileAccordionState[stageId][section];
  }

  // Quick helper to check urgent items
  let hasUrgentAvailable = $derived(
    availableItems.some((item: any) => item.ch.priority === 'URGENT')
  );
</script>

<!-- REUSABLE SNIPPETS: ZERO CODE DUPLICATION -->

<!-- SNIPPET 1: AVAILABLE CHAPTERS POOL -->
{#snippet availableCards()}
  {#if claimFeedback}
    <div class="editorial-alert-banner {claimFeedback.type}">
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
    <div class="editorial-cards-grid">
      {#each availableItems as item (item.cs.id)}
        {@const priorityMeta = formatPriority(item.ch.priority)}
        {@const coverUrl = getWorkCoverUrl(item.work)}
        {@const isTypeset = canonicalSlug === 'typeset'}
        {@const typesetPrereqs = isTypeset ? checkTypesetPrerequisites(item.ch.id) : null}
        {@const rawPrereqs = !isTypeset ? checkRawPrerequisites(item.ch.id) : null}
        {@const canClaimStrict = isTypeset
          ? claimEvaluation.canClaim && typesetPrereqs?.isEligible
          : claimEvaluation.canClaim}

        <article class="editorial-card available-card" class:prereqs-blocked={isTypeset && !typesetPrereqs?.isEligible}>
          <div class="card-top-cluster">
            <!-- Real work cover image or elegant stage-colored fallback -->
            <div class="card-cover-container">
              {#if coverUrl}
                <img
                  src={coverUrl}
                  alt={item.work?.title || 'Obra'}
                  class="card-cover-image"
                  loading="lazy"
                  decoding="async"
                />
              {:else}
                <div class="card-cover-fallback" style="--accent-color: {stageConfig.accentColor}">
                  <span class="fallback-nox-text">NOX</span>
                </div>
              {/if}
            </div>

            <!-- Metadata info -->
            <div class="card-details-block">
              <div class="card-meta-line">
                <span class="card-work-title" title={item.work?.title || 'Obra'}>
                  {item.work?.title || 'Obra sem título'}
                </span>
                <span class="card-priority-pill {priorityMeta.class}">
                  {#if item.ch.priority === 'URGENT'}
                    <span class="urgent-pulse-dot"></span>
                  {/if}
                  {priorityMeta.label}
                </span>
              </div>

              <div class="card-chapter-identity">
                <span class="chapter-number-badge">Cap. #{item.ch.chapter_number}</span>
                {#if item.ch.chapter_label}
                  <span class="chapter-label-text" title={item.ch.chapter_label}>{item.ch.chapter_label}</span>
                {/if}
              </div>

              <!-- Upstream Inputs Availability Indicator -->
              <div class="upstream-status-indicator">
                {#if isTypeset}
                  {#if typesetPrereqs?.isEligible}
                    <span class="status-indicator-tag ready">
                      <CheckCircle2 size={11} class="text-emerald-400" />
                      <span>Clean ({typesetPrereqs.cleanCount}) &bull; Tradução ({typesetPrereqs.tradCount}) prontos</span>
                    </span>
                  {:else}
                    <span class="status-indicator-tag waiting">
                      <Clock size={11} class="text-amber-400" />
                      <span>{typesetPrereqs?.blockedReason || 'Aguardando insumos'}</span>
                    </span>
                  {/if}
                {:else}
                  {#if rawPrereqs?.rawReady}
                    <span class="status-indicator-tag ready">
                      <CheckCircle2 size={11} class="text-emerald-400" />
                      <span>RAW original disponível ({rawPrereqs.rawCount} arq.)</span>
                    </span>
                  {:else}
                    <span class="status-indicator-tag waiting">
                      <Clock size={11} class="text-amber-400" />
                      <span>Aguardando RAW original</span>
                    </span>
                  {/if}
                {/if}
              </div>
            </div>
          </div>

          <!-- Card Action Footer -->
          <div class="card-action-footer">
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
                      text: result.data?.message || 'Não foi possível assumir este capítulo.'
                    };
                  } else {
                    await update();
                    selectCategory('mine');
                    expandedChapterIds[item.cs.id] = true;
                  }
                };
              }}
              class="claim-form-full"
            >
              <input type="hidden" name="chapter_stage_id" value={item.cs.id} />
              <button
                type="submit"
                class="btn-editorial-claim"
                class:btn-disabled={!canClaimStrict}
                disabled={!canClaimStrict || isClaimingStageId === item.cs.id}
                title={!claimEvaluation.canClaim
                  ? `Requer o cargo ${stageConfig.roleRequiredName}`
                  : isTypeset && !typesetPrereqs?.isEligible
                    ? typesetPrereqs?.blockedReason
                    : stageConfig.claimActionLabel}
              >
                {#if isClaimingStageId === item.cs.id}
                  <span class="spinner-editorial-xs"></span>
                  <span>Assumindo...</span>
                {:else if !claimEvaluation.canClaim}
                  <Lock size={13} />
                  <span>Cargo {stageConfig.roleRequiredName} necessário</span>
                {:else if isTypeset && !typesetPrereqs?.isEligible}
                  <Clock size={13} />
                  <span>Pré-requisitos pendentes</span>
                {:else}
                  <Zap size={14} class="btn-icon-zap" />
                  <span>{stageConfig.claimActionLabel}</span>
                {/if}
              </button>
            </form>

            <button
              type="button"
              class="btn-action-view-details available-details"
              onclick={() => onOpenChapter(item.ch)}
              title="Ver ficha técnica, equipe e comentários deste capítulo"
            >
              <span>Ver detalhes</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </article>
      {/each}
    </div>
  {/if}
{/snippet}

<!-- SNIPPET 2: MY CHAPTERS POOL (ACTIVE WORKSPACE) -->
{#snippet myCards()}
  {#if completeFeedback}
    <div class="editorial-alert-banner {completeFeedback.type}">
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
    <div class="editorial-cards-grid">
      {#each myItems as item (item.cs.id)}
        {@const deliverables = getDeliverableFiles(item.cs, item.ch.id)}
        {@const hasDeliverables = deliverables.length > 0}
        {@const coverUrl = getWorkCoverUrl(item.work)}
        {@const upstream = getUpstreamInputs(item.ch.id)}
        {@const isExpanded = !!expandedChapterIds[item.cs.id]}
        {@const isRework = item.cs.status === 'REWORK'}
        {@const isTypeset = canonicalSlug === 'typeset'}
        {@const accordion = mobileAccordionState[item.cs.id] || { inputs: true, delivery: true }}

        <article class="editorial-card my-work-card" class:is-expanded={isExpanded} class:is-rework={isRework}>
          <!-- Rework Notice Banner if returned by QC -->
          {#if isRework}
            <div class="card-rework-banner">
              <div class="rework-banner-head">
                <AlertTriangle size={14} class="text-amber-400" />
                <span class="rework-banner-title">Correção solicitada pelo QC</span>
              </div>
              {#if item.cs.notes}
                <p class="rework-banner-text">{item.cs.notes}</p>
              {/if}
            </div>
          {/if}

          <!-- Card Header Cluster -->
          <div class="card-top-cluster">
            <!-- Real work cover image or fallback -->
            <div class="card-cover-container">
              {#if coverUrl}
                <img
                  src={coverUrl}
                  alt={item.work?.title || 'Obra'}
                  class="card-cover-image"
                  loading="lazy"
                  decoding="async"
                />
              {:else}
                <div class="card-cover-fallback" style="--accent-color: {stageConfig.accentColor}">
                  <span class="fallback-nox-text">NOX</span>
                </div>
              {/if}
            </div>

            <div class="card-details-block">
              <div class="card-meta-line">
                <span class="card-work-title" title={item.work?.title || 'Obra'}>
                  {item.work?.title || 'Obra sem título'}
                </span>

                {#if isRework}
                  <span class="card-status-badge rework">
                    <AlertTriangle size={11} />
                    <span>Correção solicitada</span>
                  </span>
                {:else if hasDeliverables}
                  <span class="card-status-badge ready">
                    <CheckCircle2 size={11} />
                    <span>Pronto para concluir &bull; {deliverables.length} {deliverables.length === 1 ? 'arq.' : 'arqs.'}</span>
                  </span>
                {:else}
                  <span class="card-status-badge in-progress" style="--accent-color: {stageConfig.accentColor}">
                    <Clock size={11} />
                    <span>Em andamento</span>
                  </span>
                {/if}
              </div>

              <div class="card-chapter-identity">
                <span class="chapter-number-badge">Cap. #{item.ch.chapter_number}</span>
                {#if item.ch.chapter_label}
                  <span class="chapter-label-text" title={item.ch.chapter_label}>{item.ch.chapter_label}</span>
                {/if}
              </div>

              <!-- REFINED ACTION HIERARCHY (NO BUTTON COMPETITION) -->
              <div class="my-card-actions-row">
                {#if isExpanded}
                  <!-- STATE EXPANDED: Workspace is open below; top controls toggle collapse or view details -->
                  <button
                    type="button"
                    class="btn-action-open-work primary-row-btn active"
                    onclick={() => toggleChapterWorkspace(item.cs.id)}
                    title="Recolher área de trabalho"
                  >
                    <FolderKanban size={13} />
                    <span>Recolher trabalho</span>
                    <ChevronUp size={13} />
                  </button>

                  <div class="secondary-actions-row is-single">
                    <button
                      type="button"
                      class="btn-action-view-details"
                      onclick={() => onOpenChapter(item.ch)}
                      title="Abrir página de detalhes, equipe e comentários deste capítulo"
                    >
                      <span>Ver detalhes</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                {:else if hasDeliverables}
                  <!-- STATE COLLAPSED & READY: Primary highlight is Concluir, secondary is Abrir and Detalhes -->
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
                            text: `Etapa ${stageConfig.title} concluída com sucesso!`
                          };
                          await update();
                        }
                      };
                    }}
                    class="complete-form-primary"
                  >
                    <input type="hidden" name="chapter_stage_id" value={item.cs.id} />
                    <button
                      type="submit"
                      class="btn-action-complete-prominent primary-row-btn"
                      disabled={isCompletingStageId === item.cs.id}
                      title="Concluir etapa e avançar no pipeline"
                    >
                      {#if isCompletingStageId === item.cs.id}
                        <span class="spinner-editorial-xs"></span>
                        <span>Concluindo...</span>
                      {:else}
                        <CheckCircle2 size={14} />
                        <span>{stageConfig.completeActionLabel}</span>
                      {/if}
                    </button>
                  </form>

                  <div class="secondary-actions-row">
                    <!-- Secondary Action: Abrir trabalho -->
                    <button
                      type="button"
                      class="btn-action-open-work"
                      onclick={() => toggleChapterWorkspace(item.cs.id)}
                      title="Abrir materiais e arquivos"
                    >
                      <FolderKanban size={13} />
                      <span>Abrir trabalho</span>
                      <ChevronDown size={13} />
                    </button>

                    <!-- Dedicated Secondary Action: Ver detalhes da página do capítulo -->
                    <button
                      type="button"
                      class="btn-action-view-details"
                      onclick={() => onOpenChapter(item.ch)}
                      title="Abrir página de detalhes, equipe e comentários deste capítulo"
                    >
                      <span>Ver detalhes</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                {:else}
                  <!-- STATE COLLAPSED & IN PROGRESS (PRIMARY NOX PURPLE ACTION) -->
                  <button
                    type="button"
                    class="btn-action-open-work primary-row-btn"
                    onclick={() => toggleChapterWorkspace(item.cs.id)}
                    title="Abrir materiais e arquivos"
                  >
                    <FolderKanban size={13} />
                    <span>Abrir trabalho</span>
                    <ChevronDown size={13} />
                  </button>

                  <div class="secondary-actions-row">
                    <!-- Secondary Action: Arquivos -->
                    <button
                      type="button"
                      class="btn-action-secondary"
                      onclick={() => {
                        expandedChapterIds[item.cs.id] = true;
                        if (!mobileAccordionState[item.cs.id]) {
                          mobileAccordionState[item.cs.id] = { inputs: true, delivery: true };
                        }
                      }}
                      title="Acessar arquivos e entregas"
                    >
                      <Upload size={13} />
                      <span>Arquivos</span>
                    </button>

                    <!-- Dedicated Secondary Action: Ver detalhes da página do capítulo -->
                    <button
                      type="button"
                      class="btn-action-view-details"
                      onclick={() => onOpenChapter(item.ch)}
                      title="Abrir página de detalhes, equipe e comentários deste capítulo"
                    >
                      <span>Ver detalhes</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                {/if}
              </div>
            </div>
          </div>

          <!-- INTEGRATED EDITORIAL WORKSPACE (EXPANDED ACCORDION) -->
          {#if isExpanded}
            <div class="editorial-expanded-workspace">
              <!-- SUB-SECTION 1: MATERIAIS DE ENTRADA (INPUTS) -->
              <section class="workspace-subpanel inputs-panel">
                <button
                  type="button"
                  class="subpanel-header-toggle"
                  onclick={() => toggleMobileSection(item.cs.id, 'inputs')}
                  aria-expanded={accordion.inputs}
                >
                  <div class="subpanel-title-lockup">
                    <Download size={14} class="subpanel-icon" style="color: {stageConfig.accentLight}" />
                    <span class="subpanel-title">Materiais de entrada</span>
                    <span class="subpanel-count-tag">{upstream.all.length} arq.</span>
                  </div>
                  <span class="subpanel-chevron">
                    {#if accordion.inputs}
                      <ChevronUp size={14} />
                    {:else}
                      <ChevronDown size={14} />
                    {/if}
                  </span>
                </button>

                {#if accordion.inputs}
                  <div class="subpanel-body">
                    {#if isTypeset}
                      <!-- TYPESET DUAL DOWNLOADS: CLEAN/REDRAW + TRADUÇÃO DISTINCT CARDS -->
                      <div class="typeset-dual-grid">
                        <!-- Clean / Redraw Input Box -->
                        <div class="dual-input-card clean-box">
                          <div class="dual-box-header">
                            <span class="dual-dot pink"></span>
                            <span class="dual-box-title">Insumo: Clean / Redraw</span>
                            <span class="dual-badge pink">{upstream.cleanFiles.length} arq.</span>
                          </div>

                          {#if upstream.cleanFiles.length > 0}
                            <div class="files-pill-list">
                              {#each upstream.cleanFiles as file (file.id)}
                                <div class="file-download-item">
                                  <FileText size={15} class="text-pink-400" />
                                  <div class="file-item-info">
                                    <span class="file-item-name" title={file.file_name}>{file.file_name}</span>
                                    <span class="file-item-sub">v{file.version} &bull; {formatBytes(file.byte_size)}</span>
                                  </div>
                                  <a
                                    href="/api/scan/production/files/{file.id}?download=1"
                                    download={file.file_name}
                                    class="btn-file-download pink"
                                    title="Baixar arquivos de Clean"
                                  >
                                    <Download size={13} />
                                    <span>Baixar Clean</span>
                                  </a>
                                </div>
                              {/each}
                            </div>
                          {:else}
                            <div class="dep-waiting-box">
                              <Clock size={13} class="text-pink-400" />
                              <span>Aguardando envio das páginas limpas pelo Clean/Redraw</span>
                            </div>
                          {/if}
                        </div>

                        <!-- Tradução Input Box -->
                        <div class="dual-input-card trad-box">
                          <div class="dual-box-header">
                            <span class="dual-dot blue"></span>
                            <span class="dual-box-title">Insumo: Tradução</span>
                            <span class="dual-badge blue">{upstream.tradFiles.length} arq.</span>
                          </div>

                          {#if upstream.tradFiles.length > 0}
                            <div class="files-pill-list">
                              {#each upstream.tradFiles as file (file.id)}
                                <div class="file-download-item">
                                  <FileText size={15} class="text-blue-400" />
                                  <div class="file-item-info">
                                    <span class="file-item-name" title={file.file_name}>{file.file_name}</span>
                                    <span class="file-item-sub">v{file.version} &bull; {formatBytes(file.byte_size)}</span>
                                  </div>
                                  <a
                                    href="/api/scan/production/files/{file.id}?download=1"
                                    download={file.file_name}
                                    class="btn-file-download blue"
                                    title="Baixar script de tradução"
                                  >
                                    <Download size={13} />
                                    <span>Baixar Tradução</span>
                                  </a>
                                </div>
                              {/each}
                            </div>
                          {:else}
                            <div class="dep-waiting-box">
                              <Clock size={13} class="text-blue-400" />
                              <span>Aguardando envio do script de tradução</span>
                            </div>
                          {/if}
                        </div>
                      </div>
                    {:else}
                      <!-- TRADUÇÃO & CLEAN/REDRAW: RAW ORIGINAL DOWNLOAD -->
                      {#if upstream.rawFiles && upstream.rawFiles.length > 0}
                        <div class="files-pill-list">
                          {#each upstream.rawFiles as file (file.id)}
                            <div class="file-download-item">
                              <FileArchive size={16} class="text-purple-400" />
                              <div class="file-item-info">
                                <span class="file-item-name" title={file.file_name}>{file.file_name}</span>
                                <span class="file-item-sub">RAW original &bull; v{file.version} &bull; {formatBytes(file.byte_size)}</span>
                              </div>
                              <a
                                href="/api/scan/production/files/{file.id}?download=1"
                                download={file.file_name}
                                class="btn-file-download purple"
                                title="Baixar RAW original do capítulo"
                              >
                                <Download size={13} />
                                <span>Baixar RAW</span>
                              </a>
                            </div>
                          {/each}
                        </div>
                      {:else}
                        <div class="dep-waiting-box">
                          <Clock size={13} class="text-slate-400" />
                          <span>Nenhum arquivo RAW original anexado a este capítulo no momento.</span>
                        </div>
                      {/if}
                    {/if}
                  </div>
                {/if}
              </section>

              <!-- SUB-SECTION 2: MINHA ENTREGA (OUTPUTS) -->
              <section class="workspace-subpanel delivery-panel">
                <button
                  type="button"
                  class="subpanel-header-toggle"
                  onclick={() => toggleMobileSection(item.cs.id, 'delivery')}
                  aria-expanded={accordion.delivery}
                >
                  <div class="subpanel-title-lockup">
                    <Upload size={14} class="subpanel-icon" style="color: {stageConfig.accentLight}" />
                    <span class="subpanel-title">{stageConfig.uploadTitle}</span>
                    <span class="subpanel-count-tag mine">{deliverables.length} arq.</span>
                  </div>
                  <span class="subpanel-chevron">
                    {#if accordion.delivery}
                      <ChevronUp size={14} />
                    {:else}
                      <ChevronDown size={14} />
                    {/if}
                  </span>
                </button>

                {#if accordion.delivery}
                  <div class="subpanel-body">
                    <div class="upload-guidance-bar">
                      <span class="upload-format-label">{stageConfig.uploadFormatHint}</span>
                      <span class="upload-step-hint">{stageConfig.uploadStepHint}</span>
                    </div>

                    <!-- Pipeline Deliverable Upload Component -->
                    <div class="upload-component-embed">
                      <PipelineDeliverableUpload
                        scanId={scanId}
                        productionChapterId={item.ch.id}
                        stageId={item.cs.stage_id}
                        currentFiles={deliverables}
                      />
                    </div>
                  </div>
                {/if}
              </section>

              <!-- SUB-SECTION 3: AÇÕES DA ETAPA (CONCLUSÃO & DEVOLVER À FILA) -->
              <div class="workspace-actions-footer">
                <div class="footer-actions-left">
                  <!-- Action: Devolver à fila -->
                  <form
                    method="POST"
                    action="?/releaseStage"
                    use:enhance={({ cancel }) => {
                      if (
                        !confirm(
                          'Devolver à fila: você deixará de ser o responsável por esta etapa e ela voltará a ficar disponível para qualquer membro pegar. Deseja continuar?'
                        )
                      ) {
                        cancel();
                      }
                      isReleasingStageId = item.cs.id;
                      return async ({ update }) => {
                        isReleasingStageId = null;
                        await update();
                      };
                    }}
                  >
                    <input type="hidden" name="chapter_stage_id" value={item.cs.id} />
                    <button
                      type="submit"
                      class="btn-release-queue"
                      disabled={isReleasingStageId === item.cs.id}
                      title="Largar etapa e devolvê-la para a fila de capítulos disponíveis"
                    >
                      <RotateCcw size={13} />
                      <span>Devolver à fila</span>
                    </button>
                  </form>
                </div>

                <div class="footer-actions-right">
                  <!-- Action: Concluir etapa -->
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
                            text: `Etapa ${stageConfig.title} concluída com sucesso!`
                          };
                          await update();
                        }
                      };
                    }}
                  >
                    <input type="hidden" name="chapter_stage_id" value={item.cs.id} />
                    <button
                      type="submit"
                      class="btn-concluir-workspace"
                      disabled={!hasDeliverables || isCompletingStageId === item.cs.id}
                      title={!hasDeliverables ? 'Envie ao menos um arquivo válido antes de concluir' : 'Concluir esta etapa'}
                    >
                      {#if isCompletingStageId === item.cs.id}
                        <span class="spinner-editorial-xs"></span>
                        <span>Concluindo...</span>
                      {:else}
                        <CheckCircle2 size={14} />
                        <span>{stageConfig.completeActionLabel}</span>
                      {/if}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          {/if}
        </article>
      {/each}
    </div>
  {/if}
{/snippet}

<!-- SNIPPET 3: COMPACT CONTEXTUAL EMPTY STATE FOR AVAILABLE POOL -->
{#snippet emptyAvailable()}
  <div class="editorial-empty-card">
    <div class="empty-icon-halo" style="--halo-glow: {stageConfig.accentGlow}">
      <CheckCircle2 size={18} style="color: {stageConfig.accentLight}" />
    </div>
    <div class="empty-text-group">
      <strong class="empty-card-heading">{stageConfig.emptyAvailableTitle}</strong>
      <p class="empty-card-subtext">{stageConfig.emptyAvailableDesc}</p>
    </div>
    {#if myItems.length > 0}
      <button
        type="button"
        class="btn-empty-switch"
        onclick={() => selectCategory('mine')}
        title="Ver meus capítulos em andamento"
      >
        <Clock size={13} />
        <span>Ver meus capítulos ({myItems.length})</span>
      </button>
    {/if}
  </div>
{/snippet}

<!-- SNIPPET 4: COMPACT CONTEXTUAL EMPTY STATE FOR MY WORK -->
{#snippet emptyMine()}
  <div class="editorial-empty-card">
    <div class="empty-icon-halo neutral">
      <Clock size={18} class="text-slate-400" />
    </div>
    <div class="empty-text-group">
      <strong class="empty-card-heading">{stageConfig.emptyMineTitle}</strong>
      <p class="empty-card-subtext">{stageConfig.emptyMineDesc}</p>
    </div>
    {#if availableItems.length > 0}
      <button
        type="button"
        class="btn-empty-switch accent"
        style="--accent-color: {stageConfig.accentColor}"
        onclick={() => selectCategory('available')}
        title="Ver capítulos disponíveis para assumir"
      >
        <Zap size={13} />
        <span>Ver {availableItems.length} capítulo{availableItems.length > 1 ? 's' : ''} disponível{availableItems.length > 1 ? 'is' : ''}</span>
      </button>
    {/if}
  </div>
{/snippet}

<!-- MAIN COMPONENT ROOT -->
<div class="editorial-workspace-root">
  <!-- COMPACT EDITORIAL HEADER (70–85px, Sleek lockup, 0 redundant breadcrumbs or 7 stage buttons) -->
  <header class="editorial-header">
    <div class="editorial-header-info">
      <div class="editorial-title-row">
        <h1 class="editorial-title">{stageConfig.title}</h1>
        <span
          class="stage-pill-badge"
          style="background: {stageConfig.pillBg}; border-color: {stageConfig.pillBorder}; color: {stageConfig.accentLight};"
        >
          <span class="stage-dot" style="background: {stageConfig.accentColor}"></span>
          <span>{stageConfig.pillLabel}</span>
        </span>
      </div>
      <p class="editorial-subtitle desktop-sub">{stageConfig.subtitle}</p>
      <p class="editorial-subtitle mobile-sub">{stageConfig.mobileSubtitle}</p>
    </div>

    <div class="editorial-header-meta">
      <div class="header-stat-pill" title="Capítulos disponíveis e sob sua responsabilidade">
        <span class="stat-count-available">{availableItems.length} disponíveis</span>
        <span class="stat-divider">&bull;</span>
        <span class="stat-count-mine">{myItems.length} em andamento</span>
      </div>
    </div>
  </header>

  <!-- WORKSPACE CONTAINER WITH SEGMENTED TABS & FILTERS -->
  <div class="editorial-workspace-container">
    <!-- NAVIGATION & FILTER TOOLBAR -->
    <div class="editorial-nav-bar">
      <!-- Segmented Tab Control -->
      <div class="segmented-control" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeCategory === 'available'}
          class="segment-btn"
          class:active={activeCategory === 'available'}
          onclick={() => selectCategory('available')}
        >
          <Layers size={14} class="segment-icon" style="color: {stageConfig.accentLight}" />
          <span class="segment-label">Disponíveis</span>
          <span class="segment-badge" class:urgent={hasUrgentAvailable}>
            {availableItems.length}
          </span>
          {#if hasUrgentAvailable}
            <span class="urgent-dot-halo" title="Capítulo urgente aguardando esta etapa"></span>
          {/if}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeCategory === 'mine'}
          class="segment-btn"
          class:active={activeCategory === 'mine'}
          onclick={() => selectCategory('mine')}
        >
          <Clock size={14} class="segment-icon text-purple-400" />
          <span class="segment-label">Meus capítulos</span>
          <span class="segment-badge mine">
            {myItems.length}
          </span>
        </button>

        <!-- Desktop Option: View Both Pools Side by Side -->
        <button
          type="button"
          role="tab"
          aria-selected={activeCategory === 'both'}
          class="segment-btn desktop-only"
          class:active={activeCategory === 'both'}
          onclick={() => selectCategory('both')}
        >
          <FolderKanban size={14} class="segment-icon text-slate-400" />
          <span class="segment-label">Ambos</span>
        </button>
      </div>

      <!-- Integrated Search & Filter Controls -->
      {#if works.length > 0}
        <div class="editorial-filters-toolbar">
          <div class="mini-search-box">
            <Search size={13} class="mini-search-icon" />
            <input
              type="text"
              placeholder="Buscar obra ou capítulo..."
              bind:value={searchQuery}
              class="mini-search-input"
            />
            {#if searchQuery}
              <button
                type="button"
                class="btn-clear-search-mini"
                onclick={() => (searchQuery = '')}
                aria-label="Limpar busca"
              >
                <X size={12} />
              </button>
            {/if}
          </div>

          {#if works.length > 1}
            <select bind:value={filterWorkId} class="mini-work-select" aria-label="Filtrar por obra">
              <option value="ALL">Todas as obras ({works.length})</option>
              {#each works as w (w.id)}
                <option value={w.id}>{w.title}</option>
              {/each}
            </select>
          {/if}
        </div>
      {/if}
    </div>

    <!-- WORKSPACE CONTENT AREA -->
    <div class="editorial-content-area">
      {#if activeCategory === 'available'}
        {@render availableCards()}
      {:else if activeCategory === 'mine'}
        {@render myCards()}
      {:else if activeCategory === 'both'}
        <div class="editorial-side-by-side">
          <div class="side-pool-column">
            <div class="side-column-header">
              <div class="side-column-title-wrap">
                <Layers size={15} style="color: {stageConfig.accentLight}" />
                <h2 class="side-column-heading">Capítulos disponíveis</h2>
                <span class="segment-badge">{availableItems.length}</span>
              </div>
            </div>
            {@render availableCards()}
          </div>

          <div class="side-pool-column">
            <div class="side-column-header">
              <div class="side-column-title-wrap">
                <Clock size={15} class="text-purple-400" />
                <h2 class="side-column-heading">Meus capítulos</h2>
                <span class="segment-badge mine">{myItems.length}</span>
              </div>
            </div>
            {@render myCards()}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  /* ==========================================================================
     PROJECT NOX — EDITORIAL WORKSPACE UNIFIED STYLES
     Tradução (Blue), Clean/Redraw (Pink), Typeset (Amber)
     ========================================================================== */

  .editorial-workspace-root {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 100%;
    margin: 0;
    color: #e2e8f0;
    box-sizing: border-box;
  }

  /* --------------------------------------------------------------------------
     1. COMPACT EDITORIAL HEADER (70–85px Desktop, 60–80px Android)
     -------------------------------------------------------------------------- */
  .editorial-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 76px;
    padding: 16px 22px;
    background: rgba(14, 17, 29, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    backdrop-filter: blur(8px);
    gap: 16px;
    box-sizing: border-box;
  }

  .editorial-header-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .editorial-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .editorial-title {
    font-size: 23px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.02em;
    margin: 0;
    line-height: 1.2;
  }

  .stage-pill-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 6px;
    border-width: 1px;
    border-style: solid;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .stage-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .editorial-subtitle {
    font-size: 13.5px;
    color: #94a3b8;
    margin: 0;
    line-height: 1.4;
  }

  .mobile-sub {
    display: none;
  }

  .editorial-header-meta {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .header-stat-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 6px 13px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 500;
    color: #cbd5e1;
  }

  .stat-count-available {
    color: #f8fafc;
    font-weight: 600;
  }

  .stat-divider {
    color: #475569;
  }

  .stat-count-mine {
    color: #c084fc;
    font-weight: 600;
  }

  /* --------------------------------------------------------------------------
     2. WORKSPACE CONTAINER, NAV TABS & FILTERS
     -------------------------------------------------------------------------- */
  .editorial-workspace-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
  }

  .editorial-nav-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
    background: rgba(14, 17, 29, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 8px 14px;
    box-sizing: border-box;
  }

  .segmented-control {
    display: inline-flex;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 3px;
    gap: 3px;
  }

  .segment-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 13.5px;
    font-weight: 600;
    color: #94a3b8;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .segment-btn:hover {
    color: #e2e8f0;
    background: rgba(255, 255, 255, 0.05);
  }

  .segment-btn.active {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.12);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .segment-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 19px;
    height: 19px;
    padding: 0 5px;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.08);
    font-size: 11px;
    font-weight: 700;
    color: #e2e8f0;
  }

  .segment-btn.active .segment-badge {
    background: rgba(255, 255, 255, 0.2);
    color: #ffffff;
  }

  .segment-badge.urgent {
    background: rgba(239, 68, 68, 0.25);
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.4);
  }

  .segment-badge.mine {
    background: rgba(168, 85, 247, 0.2);
    color: #d8b4fe;
  }

  .urgent-dot-halo {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ef4444;
    box-shadow: 0 0 6px rgba(239, 68, 68, 0.8);
    animation: pulse-dot 1.5s infinite;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.85); }
  }

  /* Filters Toolbar */
  .editorial-filters-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .mini-search-box {
    position: relative;
    display: flex;
    align-items: center;
  }

  .mini-search-icon {
    position: absolute;
    left: 11px;
    color: #64748b;
    pointer-events: none;
  }

  .mini-search-input {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 0 32px 0 34px;
    height: 42px;
    font-size: 13px;
    color: #f1f5f9;
    width: 220px;
    outline: none;
    transition: all 0.15s ease;
    box-sizing: border-box;
  }

  .mini-search-input:focus {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(168, 85, 247, 0.4);
    box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.15);
    width: 260px;
  }

  .mini-search-input::placeholder {
    color: #64748b;
  }

  .btn-clear-search-mini {
    position: absolute;
    right: 8px;
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mini-work-select {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 0 12px;
    height: 42px;
    font-size: 13px;
    color: #f1f5f9;
    outline: none;
    cursor: pointer;
    max-width: 220px;
    box-sizing: border-box;
  }

  .mini-work-select:focus {
    border-color: rgba(168, 85, 247, 0.4);
  }

  .mini-work-select option {
    background: #0f1322;
    color: #f1f5f9;
  }

  /* --------------------------------------------------------------------------
     3. EDITORIAL CARDS 2-COLUMN GRID (DESKTOP) & 1-COLUMN (MOBILE)
     -------------------------------------------------------------------------- */
  .editorial-content-area {
    width: 100%;
  }

  .editorial-cards-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 16px;
    width: 100%;
    box-sizing: border-box;
  }

  /* Restrain single card from stretching across entire width */
  .editorial-cards-grid > :only-child:not(.is-expanded) {
    max-width: 760px;
  }

  .editorial-card.is-expanded {
    grid-column: 1 / -1;
    max-width: 860px !important;
  }

  .editorial-card {
    display: flex;
    flex-direction: column;
    background: rgba(14, 17, 29, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 15px;
    gap: 12px;
    box-sizing: border-box;
    transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
  }

  .editorial-card:hover {
    border-color: rgba(255, 255, 255, 0.16);
    background: rgba(18, 22, 38, 0.9);
  }

  .editorial-card.prereqs-blocked {
    opacity: 0.85;
    border-color: rgba(245, 158, 11, 0.2);
  }

  .editorial-card.is-rework {
    border-color: rgba(245, 158, 11, 0.35);
  }

  /* Rework Banner on Card */
  .card-rework-banner {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.28);
    border-radius: 8px;
    padding: 9px 12px;
  }

  .rework-banner-head {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .rework-banner-title {
    font-size: 12px;
    font-weight: 700;
    color: #fbbf24;
  }

  .rework-banner-text {
    font-size: 12px;
    color: #fef3c7;
    margin: 0;
    line-height: 1.4;
  }

  /* Card Top Cluster */
  .card-top-cluster {
    display: flex;
    gap: 14px;
    width: 100%;
    align-items: flex-start;
  }

  .card-cover-container {
    width: 60px;
    height: 84px;
    flex-shrink: 0;
    border-radius: 8px;
    overflow: hidden;
    background: #111422;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .card-cover-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .card-cover-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.03);
  }

  .fallback-nox-text {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--accent-color, #a855f7);
    opacity: 0.7;
  }

  .card-details-block {
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex: 1;
    min-width: 0;
  }

  .card-meta-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }

  .card-work-title {
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.01em;
    min-width: 0;
  }

  .card-priority-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 6px;
    flex-shrink: 0;
  }

  .priority-urgent {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #fca5a5;
  }

  .priority-high {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.35);
    color: #fcd34d;
  }

  .priority-normal {
    background: rgba(148, 163, 184, 0.1);
    border: 1px solid rgba(148, 163, 184, 0.2);
    color: #cbd5e1;
  }

  .urgent-pulse-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #ef4444;
    box-shadow: 0 0 5px #ef4444;
    animation: pulse-dot 1.5s infinite;
  }

  .card-chapter-identity {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .chapter-number-badge {
    font-size: 13.5px;
    font-weight: 700;
    color: #f1f5f9;
  }

  .chapter-label-text {
    font-size: 12px;
    color: #94a3b8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Upstream Inputs Indicator */
  .upstream-status-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
  }

  .status-indicator-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    font-weight: 500;
    padding: 2px 7px;
    border-radius: 5px;
  }

  .status-indicator-tag.ready {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: #6ee7b7;
  }

  .status-indicator-tag.waiting {
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.25);
    color: #fcd34d;
  }

  /* Status Badges on My Chapters */
  .card-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 6px;
    flex-shrink: 0;
  }

  .card-status-badge.rework {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.35);
    color: #fbbf24;
  }

  .card-status-badge.ready {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.35);
    color: #6ee7b7;
  }

  .card-status-badge.in-progress {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: var(--accent-color, #c084fc);
  }

  /* Card Action Row & Buttons */
  .card-action-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    margin-top: 2px;
  }

  .claim-form-full {
    flex: 1;
    min-width: 0;
  }

  .btn-editorial-claim {
    width: 100%;
    height: 42px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.25);
  }

  .btn-editorial-claim:hover:not(:disabled) {
    background: linear-gradient(135deg, #8b5cf6 0%, #4f46e5 100%);
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.35);
    transform: translateY(-1px);
  }

  .btn-editorial-claim.btn-disabled,
  .btn-editorial-claim:disabled {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.08);
    color: #64748b;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }

  .btn-icon-zap {
    color: #fbbf24;
  }

  .my-card-actions-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 6px;
  }

  .secondary-actions-row {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  /* State A: Complete form takes primary focus */
  .complete-form-primary {
    display: inline-flex;
  }

  .btn-action-complete-prominent {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding: 0 16px;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 600;
    background: linear-gradient(135deg, #059669 0%, #10b981 100%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #ffffff;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
  }

  .btn-action-complete-prominent:hover:not(:disabled) {
    background: linear-gradient(135deg, #047857 0%, #059669 100%);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
  }

  .btn-action-complete-prominent:disabled {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.08);
    color: #64748b;
    cursor: not-allowed;
    box-shadow: none;
  }

  /* State B: Open work takes primary purple focus */
  .btn-action-open-work {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding: 0 14px;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 600;
    background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #ffffff;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.25);
  }

  .btn-action-open-work:hover {
    background: linear-gradient(135deg, #8b5cf6 0%, #4f46e5 100%);
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.35);
  }

  .btn-action-open-work.active {
    background: rgba(124, 58, 237, 0.25);
    border-color: rgba(124, 58, 237, 0.5);
    color: #d8b4fe;
    box-shadow: none;
  }

  .btn-action-secondary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding: 0 12px;
    border-radius: 7px;
    font-size: 12.5px;
    font-weight: 500;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-action-secondary:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .btn-action-secondary.active {
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
  }

  .btn-action-view-details {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding: 0 12px;
    border-radius: 7px;
    font-size: 12.5px;
    font-weight: 500;
    background: rgba(139, 92, 246, 0.08);
    border: 1px solid rgba(139, 92, 246, 0.25);
    color: #c4b5fd;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    text-decoration: none;
  }

  .btn-action-view-details:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.45);
    color: #ffffff;
  }

  .btn-action-view-details.available-details {
    height: 42px;
  }

  /* --------------------------------------------------------------------------
     4. INTEGRATED EXPANDED WORKSPACE ACCORDION
     -------------------------------------------------------------------------- */
  .editorial-expanded-workspace {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    width: 100%;
    animation: fade-in-panel 0.15s ease;
  }

  @keyframes fade-in-panel {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .workspace-subpanel {
    display: flex;
    flex-direction: column;
    background: rgba(10, 13, 24, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 9px;
    overflow: hidden;
  }

  .subpanel-header-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.02);
    border: none;
    width: 100%;
    cursor: pointer;
    color: #f1f5f9;
    transition: background-color 0.15s ease;
  }

  .subpanel-header-toggle:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .subpanel-title-lockup {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .subpanel-title {
    font-size: 13px;
    font-weight: 600;
    color: #ffffff;
  }

  .subpanel-count-tag {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.06);
    color: #cbd5e1;
  }

  .subpanel-count-tag.mine {
    background: rgba(168, 85, 247, 0.15);
    color: #d8b4fe;
  }

  .subpanel-chevron {
    color: #94a3b8;
  }

  .subpanel-body {
    padding: 12px 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Typeset Dual Grid */
  .typeset-dual-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    width: 100%;
  }

  .dual-input-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border-radius: 8px;
    background: rgba(15, 19, 32, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .dual-input-card.clean-box {
    border-color: rgba(236, 72, 153, 0.2);
  }

  .dual-input-card.trad-box {
    border-color: rgba(59, 130, 246, 0.2);
  }

  .dual-box-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .dual-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .dual-dot.pink { background: #ec4899; }
  .dual-dot.blue { background: #3b82f6; }

  .dual-box-title {
    font-size: 12px;
    font-weight: 600;
    color: #e2e8f0;
    flex: 1;
  }

  .dual-badge {
    font-size: 10.5px;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 600;
  }

  .dual-badge.pink {
    background: rgba(236, 72, 153, 0.15);
    color: #f472b6;
  }

  .dual-badge.blue {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
  }

  .files-pill-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .file-download-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
  }

  .file-item-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .file-item-name {
    font-size: 12px;
    color: #f1f5f9;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-item-sub {
    font-size: 10.5px;
    color: #94a3b8;
  }

  .btn-file-download {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 9px;
    border-radius: 5px;
    font-size: 11.5px;
    font-weight: 600;
    text-decoration: none;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }

  .btn-file-download.pink {
    background: rgba(236, 72, 153, 0.15);
    border: 1px solid rgba(236, 72, 153, 0.3);
    color: #f472b6;
  }

  .btn-file-download.blue {
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #60a5fa;
  }

  .btn-file-download.purple {
    background: rgba(168, 85, 247, 0.15);
    border: 1px solid rgba(168, 85, 247, 0.3);
    color: #d8b4fe;
  }

  .btn-file-download:hover {
    filter: brightness(1.15);
  }

  .dep-waiting-box {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    font-size: 11.5px;
    color: #94a3b8;
  }

  .upload-guidance-bar {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 4px;
  }

  .upload-format-label {
    font-size: 12px;
    font-weight: 600;
    color: #cbd5e1;
  }

  .upload-step-hint {
    font-size: 11.5px;
    color: #94a3b8;
  }

  .upload-component-embed {
    width: 100%;
  }

  .workspace-actions-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 8px;
  }

  .btn-release-queue {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 500;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-release-queue:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.25);
    color: #fca5a5;
  }

  .btn-concluir-workspace {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 600;
    background: linear-gradient(135deg, #059669 0%, #10b981 100%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #ffffff;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
  }

  .btn-concluir-workspace:hover:not(:disabled) {
    background: linear-gradient(135deg, #047857 0%, #059669 100%);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
  }

  .btn-concluir-workspace:disabled {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.08);
    color: #64748b;
    cursor: not-allowed;
    box-shadow: none;
  }

  /* --------------------------------------------------------------------------
     5. CONTEXTUAL COMPACT EMPTY STATES (140–159px)
     -------------------------------------------------------------------------- */
  .editorial-empty-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 24px 20px;
    background: rgba(14, 17, 29, 0.6);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    min-height: 140px;
    max-height: 160px;
    gap: 8px;
    box-sizing: border-box;
    width: 100%;
    max-width: 680px;
  }

  .empty-icon-halo {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.04);
    box-shadow: 0 0 16px var(--halo-glow, rgba(168, 85, 247, 0.2));
  }

  .empty-icon-halo.neutral {
    box-shadow: 0 0 12px rgba(148, 163, 184, 0.15);
  }

  .empty-text-group {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .empty-card-heading {
    font-size: 14.5px;
    font-weight: 700;
    color: #f1f5f9;
  }

  .empty-card-subtext {
    font-size: 12.5px;
    color: #94a3b8;
    margin: 0;
    max-width: 380px;
  }

  .btn-empty-switch {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
    cursor: pointer;
    margin-top: 4px;
    transition: all 0.15s ease;
  }

  .btn-empty-switch.accent {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--accent-color, #c084fc);
    color: #ffffff;
  }

  .btn-empty-switch:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  /* --------------------------------------------------------------------------
     6. SIDE-BY-SIDE DESKTOP WORKSPACE (WHEN "AMBOS" SELECTED)
     -------------------------------------------------------------------------- */
  .editorial-side-by-side {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    width: 100%;
    align-items: start;
  }

  .editorial-side-by-side .editorial-cards-grid {
    grid-template-columns: 1fr;
  }

  .editorial-side-by-side .editorial-cards-grid > :only-child {
    max-width: 100%;
  }

  .side-pool-column {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  .side-column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 4px;
  }

  .side-column-title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .side-column-heading {
    font-size: 14px;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0;
  }

  /* Alert Banners */
  .editorial-alert-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 12.5px;
    margin-bottom: 8px;
  }

  .editorial-alert-banner.error {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .editorial-alert-banner.success {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #6ee7b7;
  }

  .btn-close-alert {
    margin-left: auto;
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 2px;
  }

  /* Spinner */
  .spinner-editorial-xs {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.25);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ==========================================================================
     MOBILE RESPONSIVENESS & BREAKPOINTS (ANDROID FIRST)
     ========================================================================== */
  @media (max-width: 1024px) {
    .editorial-cards-grid {
      grid-template-columns: 1fr;
    }

    .editorial-side-by-side {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .editorial-workspace-root {
      gap: 12px;
      padding-bottom: calc(110px + env(safe-area-inset-bottom, 24px)); /* Clearance for fixed mobile bottom navigation */
    }

    .editorial-header {
      padding: 11px 14px;
      gap: 8px;
      min-height: auto;
    }

    .editorial-title {
      font-size: 18px;
    }

    .editorial-subtitle.desktop-sub {
      display: none;
    }

    .editorial-subtitle.mobile-sub {
      display: block;
      font-size: 12px;
    }

    .stage-pill-badge {
      font-size: 10px;
      padding: 2px 7px;
    }

    .editorial-header-meta {
      display: none; /* Hide quick stats on mobile to keep header ultra-compact */
    }

    .editorial-nav-bar {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
      padding: 8px 10px;
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
      min-height: 44px; /* Touch target */
    }

    .desktop-only {
      display: none !important;
    }

    .editorial-filters-toolbar {
      width: 100%;
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
    }

    .mini-search-box {
      width: 100%;
    }

    .mini-search-input {
      width: 100%;
      box-sizing: border-box;
      min-height: 44px;
    }

    .mini-search-input:focus {
      width: 100%;
    }

    .mini-work-select {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      min-height: 44px;
    }

    .editorial-cards-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .editorial-card {
      padding: 13px;
      gap: 10px;
      width: 100%;
    }

    .card-cover-container {
      width: 52px;
      height: 70px;
    }

    .card-work-title {
      font-size: 15px;
      white-space: normal;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      line-height: 1.3;
    }

    .typeset-dual-grid {
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .my-card-actions-row {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .primary-row-btn {
      width: 100%;
      justify-content: center;
      min-height: 44px;
    }

    .complete-form-primary {
      width: 100%;
    }

    .btn-action-complete-prominent {
      width: 100%;
      justify-content: center;
      min-height: 44px;
    }

    .secondary-actions-row {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .secondary-actions-row.is-single {
      grid-template-columns: 1fr;
    }

    .secondary-actions-row .btn-action-open-work,
    .secondary-actions-row .btn-action-secondary,
    .secondary-actions-row .btn-action-view-details {
      width: 100%;
      justify-content: center;
      min-height: 44px;
    }

    .btn-editorial-claim {
      min-height: 44px; /* Touch friendly on mobile */
    }

    .workspace-actions-footer {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }

    .footer-actions-left,
    .footer-actions-right {
      width: 100%;
    }

    .btn-release-queue,
    .btn-concluir-workspace {
      width: 100%;
      justify-content: center;
      min-height: 44px;
    }
  }

  @media (max-width: 480px) {
    .editorial-header {
      padding: 10px 12px;
    }

    .editorial-title {
      font-size: 17px;
    }

    .editorial-card {
      padding: 11px;
    }

    .card-cover-container {
      width: 50px;
      height: 68px;
    }
  }
</style>
