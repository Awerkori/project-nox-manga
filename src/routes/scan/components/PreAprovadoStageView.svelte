<script lang="ts">
  import { enhance } from '$app/forms';
  import {
    AlertCircle,
    AlertTriangle,
    ArrowRight,
    BookOpen,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Clock,
    ExternalLink,
    FileArchive,
    FileText,
    Filter,
    Globe,
    Layers,
    Lock,
    Package,
    RefreshCw,
    Search,
    ShieldCheck,
    Sparkles,
    Trash2,
    UploadCloud,
    User,
    X,
    Zap
  } from '@lucide/svelte';

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
    seenStages?: any[];
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
    isOwnerOrAdmin: isOwnerOrAdminProp = false,
    scanId = '',
    onSelectStage = () => {},
    onOpenChapter = () => {}
  }: Props = $props();

  let isOwnerOrAdmin = $derived(isOwnerOrAdminProp || userRole === 'OWNER' || userRole === 'ADMIN');

  // 7 Canonical stages in strict editorial order
  const CANONICAL_STAGES = [
    { slug: 'raw', name: 'Raw Provider', icon: '📦', color: '#94a3b8', badgeBg: 'rgba(148, 163, 184, 0.12)', badgeBorder: 'rgba(148, 163, 184, 0.28)', aliases: ['raw', 'raw provider'] },
    { slug: 'traducao', name: 'Tradução', icon: '🌐', color: '#3b82f6', badgeBg: 'rgba(59, 130, 246, 0.12)', badgeBorder: 'rgba(59, 130, 246, 0.28)', aliases: ['traducao', 'translation'] },
    { slug: 'clean_redraw', name: 'Clean/Redraw', icon: '🎨', color: '#ec4899', badgeBg: 'rgba(236, 72, 153, 0.12)', badgeBorder: 'rgba(236, 72, 153, 0.28)', aliases: ['clean', 'clean_redraw', 'clean/redraw'] },
    { slug: 'typeset', name: 'Typeset', icon: '✒️', color: '#eab308', badgeBg: 'rgba(234, 179, 8, 0.12)', badgeBorder: 'rgba(234, 179, 8, 0.28)', aliases: ['typeset'] },
    { slug: 'revisor_qc', name: 'Revisor (QC)', icon: '🔎', color: '#a855f7', badgeBg: 'rgba(168, 85, 247, 0.12)', badgeBorder: 'rgba(168, 85, 247, 0.28)', aliases: ['revisor_qc', 'qc', 'revisao'] },
    { slug: 'pre_aprovado', name: 'Pré-aprovado', icon: '✅', color: '#06b6d4', badgeBg: 'rgba(6, 182, 212, 0.14)', badgeBorder: 'rgba(6, 182, 212, 0.35)', aliases: ['pre_aprovado', 'ready', 'preview', 'pronto_pra_upar', 'pré aprovado', 'pré-aprovado'] },
    { slug: 'publicado', name: 'Publicado', icon: '📚', color: '#22c55e', badgeBg: 'rgba(34, 197, 94, 0.12)', badgeBorder: 'rgba(34, 197, 94, 0.28)', aliases: ['publicado', 'published'] }
  ];

  function matchesStageSlug(candidate: any, target: string): boolean {
    const s = (typeof candidate === 'string' ? candidate : candidate?.slug || '').toLowerCase().trim();
    const t = target.toLowerCase().trim();
    if (s === t) return true;
    if (t === 'clean_redraw' || t === 'clean') return s === 'clean' || s === 'clean_redraw' || s === 'clean/redraw';
    if (t === 'pre_aprovado' || t === 'ready' || t === 'preview' || t === 'pronto_pra_upar' || t === 'pré aprovado' || t === 'pré-aprovado') {
      return s === 'pre_aprovado' || s === 'ready' || s === 'pronto_pra_upar' || s === 'preview' || s === 'pré aprovado' || s === 'pré-aprovado';
    }
    if (t === 'traducao' || t === 'translation') return s === 'traducao' || s === 'translation';
    if (t === 'revisor_qc' || t === 'qc') return s === 'revisor_qc' || s === 'revisao' || s === 'qc' || s === 'revisor (qc)';
    if (t === 'publicado' || t === 'published') return s === 'publicado' || s === 'published';
    if (t === 'raw') return s === 'raw' || s === 'raw provider';
    return false;
  }

  // Filter and search state
  let searchQuery = $state('');
  let filterWorkId = $state<string>('ALL');
  let filterQueueTab = $state<'ALL' | 'AVAILABLE' | 'MINE' | 'TEAM'>('ALL');

  // Expanded card tracking
  let expandedCards = $state<Record<string, boolean>>({});

  function toggleCard(stageId: string) {
    expandedCards[stageId] = !expandedCards[stageId];
  }

  // Publication Modal State
  let publishModalOpen = $state(false);
  let publishingItem = $state<any>(null);
  let publishTargetWorkId = $state('');
  let publishChapterNumber = $state<number | string>('');
  let publishChapterTitle = $state('');
  let publishVolume = $state<number | string>('');
  let publishConfirmedDuplicate = $state(false);
  let isPublishing = $state(false);
  let publishFeedback = $state<{ type: 'success' | 'error'; message: string } | null>(null);

  // Locally published IDs to reflect immediate state updates without reload
  let locallyPublishedChapterIds = $state<Record<string, boolean>>({});

  // Compute live valid Pre-aprovado items
  let preAprovadoItems = $derived.by(() => {
    const list: any[] = [];
    if (!chapterStages || chapterStages.length === 0) return list;

    for (const cs of chapterStages) {
      const slug = cs.stage?.slug || '';
      if (!matchesStageSlug(slug, 'pre_aprovado')) continue;

      // Filter out non-active stage statuses
      if (cs.status === 'BLOCKED' || cs.status === 'CANCELLED' || cs.status === 'DONE') continue;

      const chId = cs.production_chapter_id || cs.chapter_id;
      const ch = chapters.find((c: any) => c.id === chId);
      if (!ch) continue;

      // Rule: Do NOT include published, cancelled, archived or locally published items
      if (ch.status === 'PUBLISHED' || ch.status === 'CANCELLED' || locallyPublishedChapterIds[ch.id]) continue;
      if (ch.status === 'ARCHIVED' || ch.status === 'INACTIVE') continue;

      const work = ch.work || works.find((w: any) => w.id === ch.work_id);
      list.push({ ch, cs, work });
    }
    return list;
  });

  // Capítulos disponíveis (unassigned, AVAILABLE or REWORK)
  let availableItems = $derived(
    preAprovadoItems.filter((item: any) => {
      return (item.cs.status === 'AVAILABLE' || item.cs.status === 'REWORK') && !item.cs.assigned_to;
    })
  );

  // Meus capítulos (assigned to current user, IN_PROGRESS or REWORK)
  let myItems = $derived(
    preAprovadoItems.filter((item: any) => {
      return item.cs.assigned_to === currentUserId && (item.cs.status === 'IN_PROGRESS' || item.cs.status === 'REWORK');
    })
  );

  // Capítulos atribuídos à equipe (assigned to other team members, IN_PROGRESS or REWORK)
  let teamItems = $derived(
    preAprovadoItems.filter((item: any) => {
      return item.cs.assigned_to && item.cs.assigned_to !== currentUserId && (item.cs.status === 'IN_PROGRESS' || item.cs.status === 'REWORK');
    })
  );

  // Filtered available items (matching work and search)
  let filteredAvailableItems = $derived(
    availableItems.filter((item: any) => {
      if (filterQueueTab === 'MINE' || filterQueueTab === 'TEAM') return false;
      const matchesWork = filterWorkId === 'ALL' || item.work?.id === filterWorkId;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesWork;
      const title = (item.work?.title || '').toLowerCase();
      const num = String(item.ch.chapter_number || '');
      const label = (item.ch.chapter_label || '').toLowerCase();
      return matchesWork && (title.includes(q) || num.includes(q) || label.includes(q));
    })
  );

  // Filtered my items (matching work and search)
  let filteredMyItems = $derived(
    myItems.filter((item: any) => {
      if (filterQueueTab === 'AVAILABLE' || filterQueueTab === 'TEAM') return false;
      const matchesWork = filterWorkId === 'ALL' || item.work?.id === filterWorkId;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesWork;
      const title = (item.work?.title || '').toLowerCase();
      const num = String(item.ch.chapter_number || '');
      const label = (item.ch.chapter_label || '').toLowerCase();
      return matchesWork && (title.includes(q) || num.includes(q) || label.includes(q));
    })
  );

  // Filtered team items (matching work and search)
  let filteredTeamItems = $derived(
    teamItems.filter((item: any) => {
      if (filterQueueTab === 'AVAILABLE' || filterQueueTab === 'MINE') return false;
      const matchesWork = filterWorkId === 'ALL' || item.work?.id === filterWorkId;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesWork;
      const title = (item.work?.title || '').toLowerCase();
      const num = String(item.ch.chapter_number || '');
      const label = (item.ch.chapter_label || '').toLowerCase();
      return matchesWork && (title.includes(q) || num.includes(q) || label.includes(q));
    })
  );

  // Calculate live counts for the 7 canonical stage switcher pills
  let canonicalCounts = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const st of CANONICAL_STAGES) counts[st.slug] = 0;

    if (chapterStages && chapterStages.length > 0) {
      for (const cs of chapterStages) {
        const chId = cs.production_chapter_id || cs.chapter_id;
        const ch = chapters.find((c: any) => c.id === chId);
        if (!ch || ch.status === 'PUBLISHED' || ch.status === 'CANCELLED' || locallyPublishedChapterIds[ch.id]) continue;
        if (ch.status === 'ARCHIVED' || ch.status === 'INACTIVE') continue;

        const slug = cs.stage?.slug || '';
        for (const st of CANONICAL_STAGES) {
          if (matchesStageSlug(slug, st.slug)) {
            if ((cs.status === 'AVAILABLE' || cs.status === 'REWORK') && !cs.assigned_to) {
              counts[st.slug]++;
            }
          }
        }
      }
    }

    // Publicado shows historic count
    counts['publicado'] = chapters.filter((c: any) => c.status === 'PUBLISHED' || locallyPublishedChapterIds[c.id]).length;
    return counts;
  });

  // Personal new count for Pré-aprovado
  let personalNewCount = $derived.by(() => {
    if (!isOwnerOrAdmin) return 0;
    const seenMap: Record<string, boolean> = {};
    if (Array.isArray(seenStages)) {
      for (const s of seenStages) {
        if (s?.chapter_stage_id) {
          seenMap[`${s.chapter_stage_id}:${s.availability_version ?? 1}`] = true;
        }
      }
    }

    let c = 0;
    for (const item of availableItems) {
      const key = `${item.cs.id}:${item.cs.availability_version ?? 1}`;
      if (!seenMap[key]) {
        c++;
      }
    }
    return c;
  });

  // Get deliverables for a chapter
  function getChapterDeliverables(chId: string) {
    return productionFiles.filter((f: any) => f.production_chapter_id === chId && f.is_current);
  }

  function getPrimaryPackage(chId: string) {
    const files = getChapterDeliverables(chId);
    // Typeset or latest package is the primary publishing package
    const typeset = files.find((f: any) => matchesStageSlug(f.stage_slug, 'typeset'));
    if (typeset) return typeset;
    return files[0] || null;
  }

  let publishingPrimaryFile = $derived(publishingItem ? getPrimaryPackage(publishingItem.ch.id) : null);

  function formatBytes(bytes: number) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Open Publish Modal
  function openPublishModal(item: any) {
    publishingItem = item;
    // Auto-select associated work: default to item's work or first associated work
    publishTargetWorkId = item.work?.id || (works.length > 0 ? works[0].id : '');
    publishChapterNumber = item.ch.chapter_number ?? '';
    publishChapterTitle = item.ch.chapter_label || item.ch.chapter_title || '';
    publishVolume = item.ch.volume ?? '';
    publishConfirmedDuplicate = false;
    publishFeedback = null;
    publishModalOpen = true;
  }

  function closePublishModal() {
    publishModalOpen = false;
    publishingItem = null;
    // Keep publishFeedback intact so the page toast banner displays the result
  }

  // Auto-dismiss success feedback after 7 seconds
  $effect(() => {
    if (publishFeedback && publishFeedback.type === 'success') {
      const timer = setTimeout(() => {
        publishFeedback = null;
      }, 7000);
      return () => clearTimeout(timer);
    }
  });

  // Check if target chapter number is already published for the selected work
  let duplicateCatalogChapter = $derived.by(() => {
    if (!publishTargetWorkId || publishChapterNumber === '') return null;
    const num = Number(publishChapterNumber);
    // Look up in published chapters
    const published = chapters.filter((c: any) => {
      const wId = c.work_id || c.work?.id;
      return (c.status === 'PUBLISHED' || locallyPublishedChapterIds[c.id]) && wId === publishTargetWorkId && Number(c.chapter_number) === num;
    });
    return published.length > 0 ? published[0] : null;
  });

  // Can submit publication
  let canSubmitPublish = $derived(
    Boolean(publishTargetWorkId) &&
    publishChapterNumber !== '' &&
    !isNaN(Number(publishChapterNumber)) &&
    Number(publishChapterNumber) >= 0 &&
    (!duplicateCatalogChapter || publishConfirmedDuplicate) &&
    !isPublishing
  );

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && publishModalOpen) {
      closePublishModal();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="pre-aprovado-root">
  <!-- Feedback Toast / Banner -->
  {#if publishFeedback}
    <div class="publish-toast-banner" class:is-success={publishFeedback.type === 'success'} class:is-error={publishFeedback.type === 'error'}>
      <div class="toast-content">
        {#if publishFeedback.type === 'success'}
          <CheckCircle2 size={18} class="toast-icon text-emerald" />
        {:else}
          <AlertCircle size={18} class="toast-icon text-amber" />
        {/if}
        <span>{publishFeedback.message}</span>
      </div>
      <button type="button" class="btn-toast-close" onclick={() => (publishFeedback = null)}>
        <X size={14} />
      </button>
    </div>
  {/if}

  <!-- 1. HERO & ETAPA EDITORIAL -->
  <header class="pre-hero-card">
    <div class="hero-top-row">
      <nav class="breadcrumb-nav" aria-label="Navegação estrutural">
        <span class="crumb-parent">Produção</span>
        <ChevronRight size={14} class="crumb-sep" />
        <span class="crumb-parent">Pipeline</span>
        <ChevronRight size={14} class="crumb-sep" />
        <span class="crumb-current">Pré-aprovado</span>
      </nav>

      <div class="hero-stage-badge">
        <span class="badge-dot"></span>
        <span class="badge-text">Etapa Editorial · Liberação Final</span>
      </div>
    </div>

    <div class="hero-main-headline">
      <div class="hero-title-lockup">
        <div class="hero-stage-icon-wrap" aria-hidden="true">
          <ShieldCheck size={28} class="hero-icon-cyan" />
        </div>
        <div>
          <h1 class="hero-title">Pré-aprovado</h1>
          <p class="hero-description">
            Capítulo validado e pré-aprovado. Pronto para liberação oficial no catálogo.
          </p>
        </div>
      </div>
    </div>

    <!-- 7 Canonical Stages Switcher Bar -->
    <nav class="stages-switcher-bar" aria-label="Navegação entre etapas do pipeline">
      <div class="stages-pills-scroll">
        {#each CANONICAL_STAGES as st (st.slug)}
          {@const isActive = st.slug === 'pre_aprovado'}
          {@const count = canonicalCounts[st.slug] || 0}
          {@const isPreAprovado = st.slug === 'pre_aprovado'}
          {@const showPersonal = isPreAprovado && personalNewCount > 0}
          <button
            type="button"
            class="stage-pill-btn"
            class:is-active={isActive}
            onclick={() => onSelectStage(st.slug)}
          >
            <span class="pill-icon" aria-hidden="true">{st.icon}</span>
            <span class="pill-name">{st.name}</span>

            {#if showPersonal}
              <span class="pill-badge-personal" title="{personalNewCount} novos capítulos pré-aprovados">
                ✨ {personalNewCount} novo{personalNewCount > 1 ? 's' : ''}
              </span>
            {:else if count > 0}
              <span class="pill-badge-total">{count}</span>
            {/if}
          </button>
        {/each}
      </div>
    </nav>
  </header>

  <!-- 2. BARRA DE CONTROLE & FILTROS -->
  <section class="control-toolbar" aria-label="Controles e filtros da etapa">
    <div class="toolbar-left">
      <!-- Search Input -->
      <div class="search-box">
        <Search size={16} class="search-icon" />
        <input
          type="text"
          placeholder="Buscar por obra ou número..."
          bind:value={searchQuery}
          class="search-input"
        />
        {#if searchQuery}
          <button type="button" class="btn-clear-search" onclick={() => (searchQuery = '')} aria-label="Limpar busca">
            <X size={14} />
          </button>
        {/if}
      </div>

      <!-- Work Filter Select -->
      <div class="filter-select-wrap">
        <Filter size={15} class="filter-icon" />
        <select bind:value={filterWorkId} class="filter-select" aria-label="Filtrar por obra associada">
          <option value="ALL">Todas as obras ({works.length})</option>
          {#each works as w (w.id)}
            <option value={w.id}>{w.title}</option>
          {/each}
        </select>
      </div>
    </div>

    <!-- Queue Segment Buttons -->
    <div class="toolbar-right">
      <div class="queue-segment-control" role="tablist">
        <button
          type="button"
          class="segment-btn"
          class:is-active={filterQueueTab === 'ALL'}
          onclick={() => (filterQueueTab = 'ALL')}
        >
          <span>Todos</span>
          <span class="segment-pill">{filteredAvailableItems.length + filteredMyItems.length + filteredTeamItems.length}</span>
        </button>
        <button
          type="button"
          class="segment-btn"
          class:is-active={filterQueueTab === 'AVAILABLE'}
          onclick={() => (filterQueueTab = 'AVAILABLE')}
        >
          <span>Disponíveis</span>
          <span class="segment-pill cyan">{filteredAvailableItems.length}</span>
        </button>
        <button
          type="button"
          class="segment-btn"
          class:is-active={filterQueueTab === 'MINE'}
          onclick={() => (filterQueueTab = 'MINE')}
        >
          <span>Meus</span>
          <span class="segment-pill purple">{filteredMyItems.length}</span>
        </button>
        {#if teamItems.length > 0}
          <button
            type="button"
            class="segment-btn"
            class:is-active={filterQueueTab === 'TEAM'}
            onclick={() => (filterQueueTab = 'TEAM')}
          >
            <span>Equipe</span>
            <span class="segment-pill amber">{filteredTeamItems.length}</span>
          </button>
        {/if}
      </div>
    </div>
  </section>

  <!-- 3. SEÇÃO: CAPÍTULOS DISPONÍVEIS -->
  {#if filterQueueTab === 'ALL' || filterQueueTab === 'AVAILABLE'}
    <section class="queue-section" aria-labelledby="heading-available">
      <div class="section-header">
        <div class="section-title-lockup">
          <div class="section-icon-box text-cyan">
            <Clock size={18} />
          </div>
          <div>
            <div class="section-title-row">
              <h2 id="heading-available" class="section-heading">Capítulos disponíveis</h2>
              <span class="section-counter-badge available-badge">{filteredAvailableItems.length}</span>
            </div>
            <p class="section-subtext">
              Capítulos validados pelo QC e prontos para liberação no catálogo oficial.
            </p>
          </div>
        </div>
      </div>

      {#if filteredAvailableItems.length === 0}
        <div class="empty-state-box">
          <div class="empty-icon-wrap">
            <Sparkles size={28} class="empty-icon text-cyan" />
          </div>
          <h3 class="empty-title">Nenhum capítulo disponível no momento</h3>
          <p class="empty-desc">
            {#if searchQuery || filterWorkId !== 'ALL'}
              Nenhum capítulo disponível corresponde aos filtros atuais. Tente limpar os filtros de busca.
            {:else}
              Todos os capítulos nesta etapa já foram assumidos pela equipe ou aguardam conclusão das etapas anteriores no pipeline.
            {/if}
          </p>
        </div>
      {:else}
        <div class="cards-grid">
          {#each filteredAvailableItems as item (item.cs.id)}
            {@const isOpen = Boolean(expandedCards[item.cs.id])}
            {@const primaryPkg = getPrimaryPackage(item.ch.id)}
            {@const deliverables = getChapterDeliverables(item.ch.id)}

            <article class="pre-card" class:is-expanded={isOpen}>
              <!-- CARD TOP ROW -->
              <div class="card-top-bar">
                <div class="card-left-identity">
                  <div class="work-thumbnail">
                    {#if item.work?.cover_id}
                      <img src="/media/{item.work.cover_id}?size=thumb&v=3" alt={item.work.title} class="thumb-img" loading="lazy" />
                    {:else}
                      <div class="thumb-fallback">NOX</div>
                    {/if}
                  </div>

                  <div class="titles-cluster">
                    <span class="work-name" title={item.work?.title}>{item.work?.title || 'Obra sem título'}</span>
                    <h3 class="chapter-title">
                      Capítulo #{item.ch.chapter_number}
                      {#if item.ch.chapter_label}
                        <span class="chapter-label-pill">· {item.ch.chapter_label}</span>
                      {/if}
                    </h3>
                    <p class="context-subtitle">Capítulo {item.ch.chapter_number} — Pronto para publicação</p>
                  </div>
                </div>

                <div class="card-right-status">
                  <span class="badge-status-ready">
                    <CheckCircle2 size={13} />
                    <span>Pronto para publicar</span>
                  </span>
                  <span class="badge-status-test">
                    <Zap size={11} />
                    <span>Teste interno</span>
                  </span>
                </div>
              </div>

              <!-- CARD ACTIONS BAR -->
              <div class="card-actions-bar">
                <div class="actions-group-left">
                  <button
                    type="button"
                    class="btn-toggle-work"
                    onclick={() => toggleCard(item.cs.id)}
                    aria-expanded={isOpen}
                  >
                    <span>{isOpen ? 'Recolher trabalho' : 'Abrir trabalho'}</span>
                    <span class="chevron-rotator" class:is-flipped={isOpen}>
                      <ChevronDown size={15} />
                    </span>
                  </button>

                  <button
                    type="button"
                    class="btn-details-secondary"
                    onclick={() => onOpenChapter(item.ch)}
                  >
                    <BookOpen size={14} />
                    <span>Ver detalhes</span>
                  </button>
                </div>

                <div class="actions-group-right">
                  <button
                    type="button"
                    class="btn-publish-highlight"
                    onclick={() => openPublishModal(item)}
                  >
                    <Globe size={15} />
                    <span>Publicar no catálogo</span>
                  </button>
                </div>
              </div>

              <!-- CARD EXPANDED CONTENT -->
              {#if isOpen}
                <div class="card-expanded-content">
                  <div class="expanded-grid">
                    <!-- BLOCO 1: RESUMO EDITORIAL -->
                    <div class="expanded-panel">
                      <div class="panel-header">
                        <ShieldCheck size={16} class="text-purple-400" />
                        <h4 class="panel-title">Resumo Editorial</h4>
                      </div>
                      <dl class="meta-definition-list">
                        <div class="meta-row">
                          <dt>Obra Associada:</dt>
                          <dd class="text-white">{item.work?.title || '—'}</dd>
                        </div>
                        <div class="meta-row">
                          <dt>Capítulo:</dt>
                          <dd class="text-cyan font-bold">#{item.ch.chapter_number}</dd>
                        </div>
                        <div class="meta-row">
                          <dt>Etapa Atual:</dt>
                          <dd><span class="inline-badge cyan">Pré-aprovado</span></dd>
                        </div>
                        <div class="meta-row">
                          <dt>Validação QC:</dt>
                          <dd class="text-emerald font-semibold">✓ Aprovado pelo Revisor</dd>
                        </div>
                        <div class="meta-row">
                          <dt>Responsável:</dt>
                          <dd class="text-muted">Fila geral (disponível)</dd>
                        </div>
                      </dl>
                    </div>

                    <!-- BLOCO 2: MATERIAIS PRONTOS -->
                    <div class="expanded-panel">
                      <div class="panel-header">
                        <Package size={16} class="text-emerald" />
                        <h4 class="panel-title">Materiais Prontos</h4>
                      </div>

                      {#if primaryPkg}
                        <div class="primary-deliverable-card">
                          <div class="pkg-icon-wrap">
                            <FileArchive size={20} class="text-emerald" />
                          </div>
                          <div class="pkg-details">
                            <div class="pkg-filename" title={primaryPkg.file_name}>{primaryPkg.file_name}</div>
                            <div class="pkg-meta">
                              <span>Pacote final para o site</span>
                              <span>·</span>
                              <span>{formatBytes(primaryPkg.file_size)}</span>
                            </div>
                          </div>
                        </div>
                      {:else}
                        <div class="missing-deliverable-alert">
                          <AlertTriangle size={15} />
                          <span>Nenhum pacote individual anexado. O sistema usará os insumos de Typeset.</span>
                        </div>
                      {/if}

                      <div class="deliverables-summary-list">
                        <div class="deliverables-count-label">
                          Total de arquivos na produção: <strong>{deliverables.length}</strong>
                        </div>
                        <div class="files-mini-scroll">
                          {#each deliverables as f (f.id)}
                            <div class="mini-file-item">
                              <span class="file-stage-tag">{f.stage_slug || 'arquivo'}</span>
                              <span class="mini-filename" title={f.file_name}>{f.file_name}</span>
                              <span class="mini-filesize">{formatBytes(f.file_size)}</span>
                            </div>
                          {/each}
                        </div>
                      </div>
                    </div>

                    <!-- BLOCO 3: DESTINO DE PUBLICAÇÃO -->
                    <div class="expanded-panel full-width">
                      <div class="panel-header">
                        <Globe size={16} class="text-cyan" />
                        <h4 class="panel-title">Destino no Catálogo Oficial</h4>
                      </div>
                      <div class="destiny-callout">
                        <div class="destiny-info">
                          <p class="destiny-text">
                            Este capítulo será vinculado à obra <strong>{item.work?.title || 'Obra'}</strong> com a numeração <strong>#{item.ch.chapter_number}</strong> e liberado para leitura pública com os créditos desta scan.
                          </p>
                        </div>
                        <button
                          type="button"
                          class="btn-publish-highlight in-expanded"
                          onclick={() => openPublishModal(item)}
                        >
                          <UploadCloud size={16} />
                          <span>Iniciar Publicação no Catálogo</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
            </article>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  <!-- 4. SEÇÃO: MEUS CAPÍTULOS -->
  {#if filterQueueTab === 'ALL' || filterQueueTab === 'MINE'}
    <section class="queue-section" aria-labelledby="heading-mine">
      <div class="section-header">
        <div class="section-title-lockup">
          <div class="section-icon-box text-purple">
            <User size={18} />
          </div>
          <div>
            <div class="section-title-row">
              <h2 id="heading-mine" class="section-heading">Meus capítulos</h2>
              <span class="section-counter-badge mine-badge">{filteredMyItems.length}</span>
            </div>
            <p class="section-subtext">
              Capítulos sob sua responsabilidade para revisão editorial e liberação no catálogo.
            </p>
          </div>
        </div>
      </div>

      {#if filteredMyItems.length === 0}
        <div class="empty-state-box">
          <div class="empty-icon-wrap purple">
            <CheckCircle2 size={28} class="empty-icon text-purple" />
          </div>
          <h3 class="empty-title">Você não tem capítulos sob sua responsabilidade nesta etapa</h3>
          <p class="empty-desc">
            Assuma um capítulo disponível na seção acima ou utilize o botão de publicação para liberar capítulos pré-aprovados.
          </p>
        </div>
      {:else}
        <div class="cards-grid">
          {#each filteredMyItems as item (item.cs.id)}
            {@const isOpen = Boolean(expandedCards[item.cs.id])}
            {@const primaryPkg = getPrimaryPackage(item.ch.id)}
            {@const deliverables = getChapterDeliverables(item.ch.id)}

            <article class="pre-card" class:is-expanded={isOpen}>
              <!-- CARD TOP ROW -->
              <div class="card-top-bar">
                <div class="card-left-identity">
                  <div class="work-thumbnail">
                    {#if item.work?.cover_id}
                      <img src="/media/{item.work.cover_id}?size=thumb&v=3" alt={item.work.title} class="thumb-img" loading="lazy" />
                    {:else}
                      <div class="thumb-fallback">NOX</div>
                    {/if}
                  </div>

                  <div class="titles-cluster">
                    <span class="work-name" title={item.work?.title}>{item.work?.title || 'Obra sem título'}</span>
                    <h3 class="chapter-title">
                      Capítulo #{item.ch.chapter_number}
                      {#if item.ch.chapter_label}
                        <span class="chapter-label-pill">· {item.ch.chapter_label}</span>
                      {/if}
                    </h3>
                    <p class="context-subtitle">Capítulo {item.ch.chapter_number} — Atribuído a você para publicação</p>
                  </div>
                </div>

                <div class="card-right-status">
                  <span class="badge-status-mine">
                    <User size={13} />
                    <span>Em suas mãos</span>
                  </span>
                  <span class="badge-status-test">
                    <Zap size={11} />
                    <span>Teste interno</span>
                  </span>
                </div>
              </div>

              <!-- CARD ACTIONS BAR -->
              <div class="card-actions-bar">
                <div class="actions-group-left">
                  <button
                    type="button"
                    class="btn-toggle-work"
                    onclick={() => toggleCard(item.cs.id)}
                    aria-expanded={isOpen}
                  >
                    <span>{isOpen ? 'Recolher trabalho' : 'Abrir trabalho'}</span>
                    <span class="chevron-rotator" class:is-flipped={isOpen}>
                      <ChevronDown size={15} />
                    </span>
                  </button>

                  <button
                    type="button"
                    class="btn-details-secondary"
                    onclick={() => onOpenChapter(item.ch)}
                  >
                    <BookOpen size={14} />
                    <span>Ver detalhes</span>
                  </button>
                </div>

                <div class="actions-group-right">
                  <button
                    type="button"
                    class="btn-publish-highlight"
                    onclick={() => openPublishModal(item)}
                  >
                    <Globe size={15} />
                    <span>Publicar no catálogo</span>
                  </button>
                </div>
              </div>

              <!-- CARD EXPANDED CONTENT -->
              {#if isOpen}
                <div class="card-expanded-content">
                  <div class="expanded-grid">
                    <div class="expanded-panel">
                      <div class="panel-header">
                        <ShieldCheck size={16} class="text-purple-400" />
                        <h4 class="panel-title">Resumo Editorial</h4>
                      </div>
                      <dl class="meta-definition-list">
                        <div class="meta-row">
                          <dt>Obra:</dt>
                          <dd class="text-white">{item.work?.title || '—'}</dd>
                        </div>
                        <div class="meta-row">
                          <dt>Capítulo:</dt>
                          <dd class="text-cyan font-bold">#{item.ch.chapter_number}</dd>
                        </div>
                        <div class="meta-row">
                          <dt>Etapa Atual:</dt>
                          <dd><span class="inline-badge cyan">Pré-aprovado</span></dd>
                        </div>
                        <div class="meta-row">
                          <dt>Responsável:</dt>
                          <dd class="text-emerald font-semibold">Você</dd>
                        </div>
                      </dl>
                    </div>

                    <div class="expanded-panel">
                      <div class="panel-header">
                        <Package size={16} class="text-emerald" />
                        <h4 class="panel-title">Materiais Prontos</h4>
                      </div>
                      {#if primaryPkg}
                        <div class="primary-deliverable-card">
                          <div class="pkg-icon-wrap">
                            <FileArchive size={20} class="text-emerald" />
                          </div>
                          <div class="pkg-details">
                            <div class="pkg-filename">{primaryPkg.file_name}</div>
                            <div class="pkg-meta">
                              <span>Pacote validado</span>
                              <span>·</span>
                              <span>{formatBytes(primaryPkg.file_size)}</span>
                            </div>
                          </div>
                        </div>
                      {/if}
                    </div>

                    <div class="expanded-panel full-width">
                      <div class="panel-header">
                        <Globe size={16} class="text-cyan" />
                        <h4 class="panel-title">Ação de Publicação</h4>
                      </div>
                      <div class="destiny-callout">
                        <p class="destiny-text">
                          Tudo pronto para publicação no site. Clique no botão abaixo para confirmar os dados.
                        </p>
                        <button
                          type="button"
                          class="btn-publish-highlight in-expanded"
                          onclick={() => openPublishModal(item)}
                        >
                          <Globe size={16} />
                          <span>Publicar no Catálogo</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
            </article>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  <!-- 4.1. SEÇÃO: CAPÍTULOS DA EQUIPE -->
  {#if teamItems.length > 0 && (filterQueueTab === 'ALL' || filterQueueTab === 'TEAM')}
    <section class="queue-section" aria-labelledby="heading-team">
      <div class="section-header">
        <div class="section-title-lockup">
          <div class="section-icon-box text-amber">
            <User size={18} />
          </div>
          <div>
            <div class="section-title-row">
              <h2 id="heading-team" class="section-heading">Capítulos em andamento pela equipe</h2>
              <span class="section-counter-badge mine-badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border-color: rgba(245, 158, 11, 0.3);">{filteredTeamItems.length}</span>
            </div>
            <p class="section-subtext">
              Capítulos sob responsabilidade de outros membros da equipe para publicação.
            </p>
          </div>
        </div>
      </div>

      {#if filteredTeamItems.length === 0}
        <div class="empty-state-box">
          <div class="empty-icon-wrap" style="background: rgba(245, 158, 11, 0.08); border-color: rgba(245, 158, 11, 0.2);">
            <CheckCircle2 size={28} class="empty-icon" style="color: #f59e0b;" />
          </div>
          <h3 class="empty-title">Nenhum capítulo atribuído a outros membros</h3>
          <p class="empty-desc">
            Todos os capítulos em Pré-aprovado estão na fila geral ou em suas mãos.
          </p>
        </div>
      {:else}
        <div class="cards-grid">
          {#each filteredTeamItems as item (item.cs.id)}
            {@const isOpen = Boolean(expandedCards[item.cs.id])}
            {@const primaryPkg = getPrimaryPackage(item.ch.id)}
            {@const deliverables = getChapterDeliverables(item.ch.id)}
            {@const assigneeName = item.cs.assignee?.display_name || item.cs.assignee?.username || 'Outro membro'}

            <article class="pre-card" class:is-expanded={isOpen}>
              <!-- CARD TOP BAR -->
              <div class="card-top-bar">
                <div class="card-left-identity">
                  <div class="work-thumbnail">
                    {#if item.work?.cover_id}
                      <img src="/media/{item.work.cover_id}?size=thumb&v=3" alt={item.work.title} class="thumb-img" loading="lazy" />
                    {:else}
                      <div class="thumb-fallback">NOX</div>
                    {/if}
                  </div>

                  <div class="titles-cluster">
                    <span class="work-name" title={item.work?.title}>{item.work?.title || 'Obra sem título'}</span>
                    <h3 class="chapter-title">
                      Capítulo #{item.ch.chapter_number}
                      {#if item.ch.chapter_label}
                        <span class="chapter-label-pill">· {item.ch.chapter_label}</span>
                      {/if}
                    </h3>
                    <p class="context-subtitle">Capítulo {item.ch.chapter_number} — Atribuído a {assigneeName}</p>
                  </div>
                </div>

                <div class="card-right-status">
                  <span class="badge-status-mine" style="background: rgba(245, 158, 11, 0.12); color: #f59e0b; border-color: rgba(245, 158, 11, 0.28);">
                    <User size={13} />
                    <span>Com {assigneeName}</span>
                  </span>
                  <span class="badge-status-test">
                    <Zap size={11} />
                    <span>Teste interno</span>
                  </span>
                </div>
              </div>

              <!-- CARD ACTIONS BAR -->
              <div class="card-actions-bar">
                <div class="actions-group-left">
                  <button
                    type="button"
                    class="btn-toggle-work"
                    onclick={() => toggleCard(item.cs.id)}
                    aria-expanded={isOpen}
                  >
                    <span>{isOpen ? 'Recolher trabalho' : 'Abrir trabalho'}</span>
                    <span class="chevron-rotator" class:is-flipped={isOpen}>
                      <ChevronDown size={15} />
                    </span>
                  </button>

                  <button
                    type="button"
                    class="btn-details-secondary"
                    onclick={() => onOpenChapter(item.ch)}
                  >
                    <BookOpen size={14} />
                    <span>Ver detalhes</span>
                  </button>
                </div>

                <div class="actions-group-right">
                  <button
                    type="button"
                    class="btn-publish-highlight"
                    onclick={() => openPublishModal(item)}
                  >
                    <Globe size={15} />
                    <span>Publicar no catálogo</span>
                  </button>
                </div>
              </div>

              <!-- CARD EXPANDED CONTENT -->
              {#if isOpen}
                <div class="card-expanded-content">
                  <div class="expanded-grid">
                    <div class="expanded-panel">
                      <div class="panel-header">
                        <ShieldCheck size={16} class="text-purple-400" />
                        <h4 class="panel-title">Resumo Editorial</h4>
                      </div>
                      <dl class="meta-definition-list">
                        <div class="meta-row">
                          <dt>Obra:</dt>
                          <dd class="text-white">{item.work?.title || '—'}</dd>
                        </div>
                        <div class="meta-row">
                          <dt>Capítulo:</dt>
                          <dd class="text-cyan font-bold">#{item.ch.chapter_number}</dd>
                        </div>
                        <div class="meta-row">
                          <dt>Etapa Atual:</dt>
                          <dd><span class="inline-badge cyan">Pré-aprovado</span></dd>
                        </div>
                        <div class="meta-row">
                          <dt>Responsável:</dt>
                          <dd class="text-amber font-semibold">{assigneeName}</dd>
                        </div>
                      </dl>
                    </div>

                    <div class="expanded-panel">
                      <div class="panel-header">
                        <Package size={16} class="text-emerald" />
                        <h4 class="panel-title">Materiais Prontos</h4>
                      </div>
                      {#if primaryPkg}
                        <div class="primary-deliverable-card">
                          <div class="pkg-icon-wrap">
                            <FileArchive size={20} class="text-emerald" />
                          </div>
                          <div class="pkg-details">
                            <div class="pkg-filename">{primaryPkg.file_name}</div>
                            <div class="pkg-meta">
                              <span>Pacote validado</span>
                              <span>·</span>
                              <span>{formatBytes(primaryPkg.file_size)}</span>
                            </div>
                          </div>
                        </div>
                      {/if}
                    </div>

                    <div class="expanded-panel full-width">
                      <div class="panel-header">
                        <Globe size={16} class="text-cyan" />
                        <h4 class="panel-title">Ação de Publicação</h4>
                      </div>
                      <div class="destiny-callout">
                        <p class="destiny-text">
                          Pronto para publicação no catálogo oficial. Como líder/administrador, você pode liberar este capítulo diretamente.
                        </p>
                        <button
                          type="button"
                          class="btn-publish-highlight in-expanded"
                          onclick={() => openPublishModal(item)}
                        >
                          <Globe size={16} />
                          <span>Publicar no Catálogo</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
            </article>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  <!-- 5. MODAL / BOTTOM SHEET DE PUBLICAÇÃO -->
  {#if publishModalOpen && publishingItem}
    <div class="modal-backdrop" onclick={closePublishModal} role="presentation">
      <div
        class="publish-modal-card"
        onclick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-publish-title"
      >
        <!-- MODAL HEADER -->
        <div class="modal-header">
          <div class="modal-header-left">
            <div class="modal-icon-badge">
              <Globe size={22} class="text-emerald" />
            </div>
            <div>
              <h3 id="modal-publish-title" class="modal-title">Publicar no Catálogo Oficial</h3>
              <p class="modal-subtitle">
                Revise os dados antes de liberar este capítulo para todos os leitores do site.
              </p>
            </div>
          </div>
          <button type="button" class="btn-modal-close" onclick={closePublishModal} aria-label="Fechar janela">
            <X size={18} />
          </button>
        </div>

        <!-- MODAL FORM BODY -->
        <form
          method="POST"
          action="?/publishProductionChapter"
          use:enhance={() => {
            isPublishing = true;
            return async ({ result, update }) => {
              isPublishing = false;
              if (result.type === 'success') {
                const pubChId = publishingItem?.ch?.id;
                if (pubChId) locallyPublishedChapterIds[pubChId] = true;
                const targetWork = works.find((w: any) => w.id === publishTargetWorkId) || publishingItem?.work;
                const workTitle = targetWork?.title || 'Obra';
                const chapterNum = publishChapterNumber;
                closePublishModal();
                await update({ reset: false });
                publishFeedback = {
                  type: 'success',
                  message: `${workTitle} — Capítulo #${chapterNum} publicado com sucesso no catálogo oficial!`
                };
              } else {
                publishFeedback = {
                  type: 'error',
                  message: 'Falha ao publicar capítulo. Tente novamente ou revise as permissões.'
                };
              }
            };
          }}
          class="modal-form"
        >
          <input type="hidden" name="production_chapter_id" value={publishingItem.ch.id} />

          <div class="modal-scrollable-body">
            <!-- BLOCO 1: DESTINO NO CATÁLOGO -->
            <fieldset class="modal-form-block">
              <legend class="block-legend">
                <span class="legend-number">1</span>
                <span>Destino no Catálogo</span>
              </legend>

              <div class="form-fields-grid">
                <!-- Obra Associada -->
                <div class="form-group full-col">
                  <label for="publish_work_select" class="field-label">
                    <span>Obra associada</span>
                    <span class="required-star">*</span>
                  </label>
                  <select
                    id="publish_work_select"
                    name="work_id"
                    bind:value={publishTargetWorkId}
                    class="field-select"
                    required
                  >
                    {#each works as w (w.id)}
                      <option value={w.id}>{w.title}</option>
                    {/each}
                  </select>
                  <span class="field-hint">
                    Obras associadas à scan atual no Project Nox.
                  </span>
                </div>

                <!-- Número do Capítulo -->
                <div class="form-group half-col">
                  <label for="publish_chapter_num" class="field-label">
                    <span>Número do capítulo</span>
                    <span class="required-star">*</span>
                  </label>
                  <input
                    id="publish_chapter_num"
                    name="chapter_number"
                    type="number"
                    step="any"
                    bind:value={publishChapterNumber}
                    class="field-input"
                    required
                  />
                  <span class="field-hint">Ex: 85 ou 85.5</span>
                </div>

                <!-- Volume (opcional) -->
                <div class="form-group half-col">
                  <label for="publish_volume" class="field-label">
                    <span>Volume (opcional)</span>
                  </label>
                  <input
                    id="publish_volume"
                    name="volume"
                    type="number"
                    step="any"
                    bind:value={publishVolume}
                    placeholder="Ex: 1"
                    class="field-input"
                  />
                  <span class="field-hint">Deixe em branco se não aplicável</span>
                </div>

                <!-- Título do Capítulo (opcional) -->
                <div class="form-group full-col">
                  <label for="publish_chapter_title" class="field-label">
                    <span>Título do capítulo (opcional)</span>
                  </label>
                  <input
                    id="publish_chapter_title"
                    name="chapter_title"
                    type="text"
                    bind:value={publishChapterTitle}
                    placeholder="Ex: O Confronto no Vazio"
                    class="field-input"
                  />
                  <span class="field-hint">Nome especial do capítulo para exibição pública</span>
                </div>
              </div>
            </fieldset>

            <!-- BLOCO 2: RESUMO DO MATERIAL -->
            <fieldset class="modal-form-block">
              <legend class="block-legend">
                <span class="legend-number">2</span>
                <span>Resumo do Material que Será Publicado</span>
              </legend>

              <div class="material-summary-card">
                <div class="summary-line">
                  <span class="summary-key">Obra Selecionada:</span>
                  <span class="summary-val text-white">{works.find((w: any) => w.id === publishTargetWorkId)?.title || publishingItem.work?.title || 'Obra'}</span>
                </div>
                <div class="summary-line">
                  <span class="summary-key">Capítulo Selecionado:</span>
                  <span class="summary-val text-cyan font-bold">Capítulo #{publishChapterNumber}</span>
                </div>
                <div class="summary-line">
                  <span class="summary-key">Scan de Origem:</span>
                  <span class="summary-val text-muted">Project Nox</span>
                </div>
                <div class="summary-line">
                  <span class="summary-key">Pacote Aprovado:</span>
                  <span class="summary-val text-emerald font-mono text-sm">{publishingPrimaryFile ? publishingPrimaryFile.file_name : 'Insumos do Typeset prontos'}</span>
                </div>
                <div class="summary-line">
                  <span class="summary-key">Status de Validação:</span>
                  <span class="summary-val text-emerald font-semibold">✓ Passou pelo QC sem pendências</span>
                </div>
              </div>
            </fieldset>

            <!-- BLOCO 3: VALIDAÇÕES DE SEGURANÇA -->
            <fieldset class="modal-form-block">
              <legend class="block-legend">
                <span class="legend-number">3</span>
                <span>Validações de Segurança</span>
              </legend>

              {#if duplicateCatalogChapter}
                <div class="security-alert-box is-warning">
                  <div class="alert-header">
                    <AlertTriangle size={18} class="text-amber" />
                    <h5 class="alert-title">Capítulo já existe no catálogo oficial</h5>
                  </div>
                  <p class="alert-desc">
                    Já existe um capítulo publicado com o número <strong>#{publishChapterNumber}</strong> para esta obra. A publicação criará uma nova versão revisada deste capítulo.
                  </p>
                  <label class="confirm-duplicate-label">
                    <input
                      type="checkbox"
                      bind:checked={publishConfirmedDuplicate}
                      class="confirm-checkbox"
                    />
                    <span>Estou ciente e confirmo a atualização/substituição do Capítulo #{publishChapterNumber}.</span>
                  </label>
                </div>
              {:else}
                <div class="security-alert-box is-valid">
                  <div class="alert-header">
                    <CheckCircle2 size={18} class="text-emerald" />
                    <h5 class="alert-title">Validação Concluída com Sucesso</h5>
                  </div>
                  <p class="alert-desc">
                    Nenhum conflito identificado no catálogo oficial. Este capítulo será publicado diretamente como o próximo lançamento da obra.
                  </p>
                </div>
              {/if}
            </fieldset>
          </div>

          <!-- BLOCO 4: AÇÃO FINAL & FOOTER -->
          <div class="modal-footer">
            <div class="cta-summary-note">
              Você está prestes a publicar <strong>{works.find((w: any) => w.id === publishTargetWorkId)?.title || 'Distante Sky'}</strong> — <strong>Capítulo #{publishChapterNumber}</strong> no catálogo oficial.
            </div>

            <div class="modal-footer-buttons">
              <button
                type="button"
                class="btn-modal-cancel"
                onclick={closePublishModal}
                disabled={isPublishing}
              >
                Cancelar
              </button>

              <button
                type="submit"
                class="btn-modal-submit"
                disabled={!canSubmitPublish}
              >
                {#if isPublishing}
                  <RefreshCw size={16} class="spinner-animate" />
                  <span>Publicando capítulo...</span>
                {:else}
                  <Globe size={16} />
                  <span>Publicar no catálogo</span>
                {/if}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  /* =====================================================================
     THEME VARIABLES & BASE TOKENS
     ===================================================================== */
  .pre-aprovado-root {
    --bg-page: #0b0d13;
    --bg-card: #121622;
    --bg-card-hover: #171c2c;
    --bg-card-subtle: #151928;
    --border-card: #1e2436;
    --border-card-hover: #2d3652;
    --border-accent-cyan: rgba(6, 182, 212, 0.4);

    --color-purple: #a855f7;
    --color-purple-hover: #9333ea;
    --color-cyan: #06b6d4;
    --color-cyan-glow: rgba(6, 182, 212, 0.18);
    --color-emerald: #10b981;
    --color-emerald-hover: #059669;
    --color-amber: #f59e0b;

    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
    padding-bottom: 3rem;
  }

  /* =====================================================================
     FEEDBACK BANNER
     ===================================================================== */
  .publish-toast-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 1.25rem;
    border-radius: 10px;
    background: #131c24;
    border: 1px solid rgba(16, 185, 129, 0.4);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
  }
  .publish-toast-banner.is-success {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.35);
    color: #a7f3d0;
  }
  .publish-toast-banner.is-error {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.35);
    color: #fca5a5;
  }
  .toast-content {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    font-size: 0.925rem;
    font-weight: 500;
  }
  .btn-toast-close {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    border-radius: 6px;
  }
  .btn-toast-close:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.1);
  }

  /* =====================================================================
     HERO & STAGE BAR
     ===================================================================== */
  .pre-hero-card {
    background: linear-gradient(180deg, #131726 0%, #101320 100%);
    border: 1px solid var(--border-card);
    border-radius: 14px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
  }

  .hero-top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .breadcrumb-nav {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.825rem;
    color: #64748b;
  }
  .crumb-parent {
    color: #94a3b8;
  }
  :global(.crumb-sep) {
    color: #475569;
  }
  .crumb-current {
    color: var(--color-cyan);
    font-weight: 600;
  }

  .hero-stage-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    background: rgba(6, 182, 212, 0.12);
    border: 1px solid rgba(6, 182, 212, 0.3);
    padding: 0.3rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #22d3ee;
  }
  .badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #06b6d4;
    box-shadow: 0 0 8px #06b6d4;
  }

  .hero-main-headline {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .hero-title-lockup {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .hero-stage-icon-wrap {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background: rgba(6, 182, 212, 0.1);
    border: 1px solid rgba(6, 182, 212, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  :global(.hero-icon-cyan) {
    color: #22d3ee;
  }

  .hero-title {
    font-size: 1.65rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
    line-height: 1.2;
    letter-spacing: -0.02em;
  }

  .hero-description {
    font-size: 0.925rem;
    color: #94a3b8;
    margin: 0.35rem 0 0 0;
    line-height: 1.45;
  }

  /* 7 Canonical Stages Switcher */
  .stages-switcher-bar {
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    padding-top: 1rem;
  }

  .stages-pills-scroll {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    overflow-x: auto;
    padding-bottom: 0.25rem;
    scrollbar-width: thin;
  }

  .stage-pill-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    background: #141826;
    border: 1px solid #1e2436;
    padding: 0.45rem 0.85rem;
    border-radius: 8px;
    font-size: 0.825rem;
    color: #94a3b8;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
    min-height: 38px;
  }
  .stage-pill-btn:hover {
    background: #192033;
    border-color: #2f3a55;
    color: #e2e8f0;
  }
  .stage-pill-btn.is-active {
    background: rgba(6, 182, 212, 0.16);
    border-color: #06b6d4;
    color: #ffffff;
    font-weight: 600;
    box-shadow: 0 0 14px rgba(6, 182, 212, 0.25);
  }
  .pill-icon {
    font-size: 0.95rem;
  }
  .pill-badge-personal {
    background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
    color: #ffffff;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.15rem 0.45rem;
    border-radius: 9999px;
    line-height: 1;
  }
  .pill-badge-total {
    background: #252e46;
    color: #cbd5e1;
    font-size: 0.725rem;
    font-weight: 600;
    padding: 0.15rem 0.45rem;
    border-radius: 9999px;
  }
  .stage-pill-btn.is-active .pill-badge-total {
    background: #06b6d4;
    color: #0b0d13;
    font-weight: 700;
  }

  /* =====================================================================
     CONTROL TOOLBAR
     ===================================================================== */
  .control-toolbar {
    background: #111420;
    border: 1px solid var(--border-card);
    border-radius: 12px;
    padding: 0.85rem 1.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 260px;
    flex-wrap: wrap;
  }

  .search-box {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 200px;
  }
  :global(.search-icon) {
    position: absolute;
    left: 0.85rem;
    color: #64748b;
    pointer-events: none;
  }
  .search-input {
    width: 100%;
    background: #0d101a;
    border: 1px solid #1e2436;
    border-radius: 8px;
    padding: 0.55rem 2.2rem 0.55rem 2.4rem;
    font-size: 0.875rem;
    color: #ffffff;
    outline: none;
    transition: border-color 0.15s;
  }
  .search-input:focus {
    border-color: #06b6d4;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.2);
  }
  .search-input::placeholder {
    color: #64748b;
  }
  .btn-clear-search {
    position: absolute;
    right: 0.65rem;
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    display: flex;
  }

  .filter-select-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }
  :global(.filter-icon) {
    position: absolute;
    left: 0.75rem;
    color: #64748b;
    pointer-events: none;
  }
  .filter-select {
    background: #0d101a;
    border: 1px solid #1e2436;
    border-radius: 8px;
    padding: 0.55rem 1rem 0.55rem 2.2rem;
    font-size: 0.875rem;
    color: #e2e8f0;
    outline: none;
    cursor: pointer;
    min-height: 38px;
  }
  .filter-select:focus {
    border-color: #06b6d4;
  }

  .queue-segment-control {
    display: flex;
    align-items: center;
    background: #0d101a;
    border: 1px solid #1e2436;
    border-radius: 8px;
    padding: 0.2rem;
    gap: 0.2rem;
  }
  .segment-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: none;
    border: none;
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    font-size: 0.825rem;
    color: #94a3b8;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.15s;
    min-height: 32px;
  }
  .segment-btn:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.05);
  }
  .segment-btn.is-active {
    background: #1a2032;
    color: #ffffff;
    font-weight: 600;
  }
  .segment-pill {
    background: #232a3f;
    padding: 0.1rem 0.45rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    color: #94a3b8;
  }
  .segment-pill.cyan {
    background: rgba(6, 182, 212, 0.2);
    color: #22d3ee;
  }
  .segment-pill.purple {
    background: rgba(168, 85, 247, 0.2);
    color: #c084fc;
  }

  /* =====================================================================
     QUEUE SECTIONS
     ===================================================================== */
  .queue-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .section-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }
  .section-title-lockup {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }
  .section-icon-box {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: #141826;
    border: 1px solid #1e2436;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .section-title-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .section-heading {
    font-size: 1.15rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }
  .section-counter-badge {
    padding: 0.15rem 0.55rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    line-height: 1.2;
  }
  .section-counter-badge.available-badge {
    background: rgba(6, 182, 212, 0.18);
    border: 1px solid rgba(6, 182, 212, 0.35);
    color: #22d3ee;
  }
  .section-counter-badge.mine-badge {
    background: rgba(168, 85, 247, 0.18);
    border: 1px solid rgba(168, 85, 247, 0.35);
    color: #d8b4fe;
  }
  .section-subtext {
    font-size: 0.85rem;
    color: #94a3b8;
    margin: 0.2rem 0 0 0;
  }

  /* =====================================================================
     EMPTY STATES
     ===================================================================== */
  .empty-state-box {
    background: #0f121d;
    border: 1px dashed #20273c;
    border-radius: 14px;
    padding: 3rem 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .empty-icon-wrap {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
  }
  .empty-icon-wrap.purple {
    background: rgba(168, 85, 247, 0.08);
    border-color: rgba(168, 85, 247, 0.2);
  }
  .empty-title {
    font-size: 1.05rem;
    font-weight: 600;
    color: #ffffff;
    margin: 0 0 0.4rem 0;
  }
  .empty-desc {
    font-size: 0.875rem;
    color: #94a3b8;
    max-width: 440px;
    line-height: 1.5;
    margin: 0;
  }

  /* =====================================================================
     CHAPTER CARDS
     ===================================================================== */
  .cards-grid {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .pre-card {
    background: var(--bg-card);
    border: 1px solid var(--border-card);
    border-radius: 12px;
    overflow: hidden;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .pre-card:hover {
    border-color: var(--border-card-hover);
  }
  .pre-card.is-expanded {
    border-color: var(--border-accent-cyan);
    box-shadow: 0 4px 20px rgba(6, 182, 212, 0.1);
  }

  .card-top-bar {
    padding: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    background: #111522;
  }

  .card-left-identity {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .work-thumbnail {
    width: 48px;
    height: 64px;
    border-radius: 6px;
    overflow: hidden;
    background: #090b12;
    border: 1px solid #1e2436;
    flex-shrink: 0;
  }
  .thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .thumb-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    color: #64748b;
  }

  .titles-cluster {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .work-name {
    font-size: 0.8rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .chapter-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
  }
  .chapter-label-pill {
    font-size: 0.85rem;
    font-weight: 500;
    color: #cbd5e1;
  }
  .context-subtitle {
    font-size: 0.825rem;
    color: #64748b;
    margin: 0;
  }

  .card-right-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .badge-status-ready {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(6, 182, 212, 0.12);
    border: 1px solid rgba(6, 182, 212, 0.3);
    color: #22d3ee;
    padding: 0.3rem 0.65rem;
    border-radius: 9999px;
    font-size: 0.775rem;
    font-weight: 600;
  }
  .badge-status-mine {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(168, 85, 247, 0.12);
    border: 1px solid rgba(168, 85, 247, 0.3);
    color: #d8b4fe;
    padding: 0.3rem 0.65rem;
    border-radius: 9999px;
    font-size: 0.775rem;
    font-weight: 600;
  }
  .badge-status-test {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #fcd34d;
    padding: 0.25rem 0.55rem;
    border-radius: 9999px;
    font-size: 0.725rem;
    font-weight: 600;
  }

  /* Actions Bar */
  .card-actions-bar {
    padding: 0.75rem 1.25rem;
    border-top: 1px solid #1a2030;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    background: #0e121c;
  }
  .actions-group-left {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .actions-group-right {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .btn-toggle-work {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: #181d2c;
    border: 1px solid #283149;
    color: #ffffff;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 0.5rem 0.95rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
    min-height: 40px;
  }
  .btn-toggle-work:hover {
    background: #20273a;
    border-color: #3b4768;
  }
  .chevron-rotator {
    display: inline-flex;
    align-items: center;
    transition: transform 0.2s ease;
  }
  .chevron-rotator.is-flipped {
    transform: rotate(180deg);
  }

  .btn-details-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: transparent;
    border: 1px solid #242c42;
    color: #94a3b8;
    font-size: 0.85rem;
    font-weight: 500;
    padding: 0.5rem 0.85rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
    min-height: 40px;
  }
  .btn-details-secondary:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.05);
    border-color: #3b4768;
  }

  .btn-publish-highlight {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border: 1px solid #34d399;
    color: #ffffff;
    font-size: 0.875rem;
    font-weight: 700;
    padding: 0.55rem 1.15rem;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
    transition: all 0.15s ease;
    min-height: 40px;
  }
  .btn-publish-highlight:hover {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    box-shadow: 0 4px 18px rgba(16, 185, 129, 0.45);
    transform: translateY(-1px);
  }
  .btn-publish-highlight.in-expanded {
    font-size: 0.925rem;
    padding: 0.65rem 1.35rem;
  }

  /* Expanded Workspace */
  .card-expanded-content {
    padding: 1.25rem;
    border-top: 1px solid #1a2030;
    background: #0d1018;
  }
  .expanded-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
  }
  .expanded-panel {
    background: #131724;
    border: 1px solid #1e2538;
    border-radius: 10px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .expanded-panel.full-width {
    grid-column: 1 / -1;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding-bottom: 0.5rem;
  }
  .panel-title {
    font-size: 0.875rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .meta-definition-list {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    margin: 0;
    font-size: 0.85rem;
  }
  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }
  .meta-row dt {
    color: #64748b;
  }
  .meta-row dd {
    margin: 0;
    text-align: right;
  }
  .inline-badge.cyan {
    background: rgba(6, 182, 212, 0.15);
    color: #22d3ee;
    padding: 0.15rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  /* Primary Deliverable */
  .primary-deliverable-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 8px;
    padding: 0.65rem 0.85rem;
  }
  .pkg-icon-wrap {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: rgba(16, 185, 129, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .pkg-details {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    overflow: hidden;
  }
  .pkg-filename {
    font-size: 0.85rem;
    font-weight: 600;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pkg-meta {
    font-size: 0.75rem;
    color: #a7f3d0;
    display: flex;
    gap: 0.35rem;
  }

  .missing-deliverable-alert {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.25);
    color: #fcd34d;
    padding: 0.65rem;
    border-radius: 8px;
    font-size: 0.8rem;
  }

  .deliverables-summary-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .deliverables-count-label {
    font-size: 0.775rem;
    color: #94a3b8;
  }
  .files-mini-scroll {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    max-height: 110px;
    overflow-y: auto;
  }
  .mini-file-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    background: #0e121a;
    border: 1px solid #1a202e;
    border-radius: 6px;
    padding: 0.35rem 0.55rem;
    font-size: 0.775rem;
  }
  .file-stage-tag {
    background: #1c2333;
    color: #94a3b8;
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    font-size: 0.7rem;
    text-transform: uppercase;
  }
  .mini-filename {
    color: #cbd5e1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }
  .mini-filesize {
    color: #64748b;
    font-size: 0.7rem;
  }

  /* Destiny Callout */
  .destiny-callout {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.25rem;
    flex-wrap: wrap;
    background: rgba(6, 182, 212, 0.06);
    border: 1px solid rgba(6, 182, 212, 0.2);
    border-radius: 8px;
    padding: 0.85rem 1rem;
  }
  .destiny-text {
    font-size: 0.875rem;
    color: #e2e8f0;
    margin: 0;
    line-height: 1.5;
  }

  /* =====================================================================
     PUBLICATION MODAL & BOTTOM SHEET
     ===================================================================== */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(3, 7, 18, 0.82);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: calc(78px + 1.25rem) 1rem 1.5rem 1rem;
    overflow-y: auto;
  }

  .publish-modal-card {
    background: #121624;
    border: 1px solid #232b40;
    border-radius: 16px;
    width: 100%;
    max-width: 680px;
    max-height: calc(100vh - 110px);
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(6, 182, 212, 0.15);
    overflow: hidden;
    animation: modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    margin: auto;
  }

  @keyframes modalPop {
    from {
      opacity: 0;
      transform: scale(0.96) translateY(10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .modal-header {
    padding: 0.9rem 1.25rem;
    border-bottom: 1px solid #1e263a;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #141828;
    flex-shrink: 0;
  }
  .modal-header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .modal-icon-badge {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .modal-title {
    font-size: 1.15rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
    line-height: 1.2;
  }
  .modal-subtitle {
    font-size: 0.8rem;
    color: #94a3b8;
    margin: 0.2rem 0 0 0;
  }
  .btn-modal-close {
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 0.35rem;
    border-radius: 8px;
    display: flex;
  }
  .btn-modal-close:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
  }

  .modal-scrollable-body {
    padding: 0.9rem 1.25rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex: 1 1 auto;
    min-height: 0;
  }

  .modal-form-block {
    border: 1px solid #1e263a;
    border-radius: 10px;
    background: #0f121d;
    padding: 0.75rem 1rem;
    margin: 0;
  }
  .block-legend {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0 0.5rem;
    font-size: 0.8rem;
    font-weight: 700;
    color: #22d3ee;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .legend-number {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #06b6d4;
    color: #0b0d13;
    font-size: 0.7rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .form-fields-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem;
    margin-top: 0.35rem;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .form-group.full-col {
    grid-column: 1 / -1;
  }
  .form-group.half-col {
    grid-column: span 1;
  }

  .field-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #cbd5e1;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .required-star {
    color: #f43f5e;
  }
  .field-input, .field-select {
    background: #141826;
    border: 1px solid #232c40;
    border-radius: 8px;
    padding: 0.45rem 0.75rem;
    font-size: 0.85rem;
    color: #ffffff;
    outline: none;
    transition: border-color 0.15s;
    min-height: 38px;
  }
  .field-input:focus, .field-select:focus {
    border-color: #06b6d4;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.2);
  }
  .field-hint {
    font-size: 0.725rem;
    color: #64748b;
  }

  /* Material summary card in modal */
  .material-summary-card {
    background: #131726;
    border: 1px solid #1e2538;
    border-radius: 8px;
    padding: 0.65rem 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.825rem;
    margin-top: 0.35rem;
  }
  .summary-line {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }
  .summary-key {
    color: #64748b;
  }
  .summary-val {
    text-align: right;
  }

  /* Security alerts in modal */
  .security-alert-box {
    border-radius: 8px;
    padding: 0.65rem 0.85rem;
    margin-top: 0.35rem;
  }
  .security-alert-box.is-valid {
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.3);
  }
  .security-alert-box.is-warning {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.35);
  }
  .alert-header {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin-bottom: 0.25rem;
  }
  .alert-title {
    font-size: 0.85rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }
  .alert-desc {
    font-size: 0.8rem;
    color: #cbd5e1;
    margin: 0 0 0.35rem 0;
    line-height: 1.4;
  }
  .confirm-duplicate-label {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: #fef08a;
    cursor: pointer;
    padding-top: 0.35rem;
    border-top: 1px solid rgba(245, 158, 11, 0.2);
  }
  .confirm-checkbox {
    margin-top: 0.15rem;
    cursor: pointer;
  }

  /* Modal Footer */
  .modal-footer {
    padding: 0.85rem 1.25rem;
    border-top: 1px solid #1e263a;
    background: #141828;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }
  .cta-summary-note {
    font-size: 0.8rem;
    color: #94a3b8;
    text-align: center;
    line-height: 1.4;
  }
  .modal-footer-buttons {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
  }
  .btn-modal-cancel {
    background: transparent;
    border: 1px solid #232c40;
    color: #cbd5e1;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 0.55rem 1.15rem;
    border-radius: 8px;
    cursor: pointer;
    min-height: 40px;
  }
  .btn-modal-cancel:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #ffffff;
  }
  .btn-modal-submit {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border: 1px solid #34d399;
    color: #ffffff;
    font-size: 0.925rem;
    font-weight: 700;
    padding: 0.65rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.35);
    transition: all 0.15s;
    min-height: 44px;
  }
  .btn-modal-submit:hover:not(:disabled) {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    box-shadow: 0 4px 20px rgba(16, 185, 129, 0.5);
  }
  .btn-modal-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }
  :global(.spinner-animate) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* =====================================================================
     MOBILE ADAPTATIONS (<= 768px)
     ===================================================================== */
  @media (max-width: 768px) {
    .pre-aprovado-root {
      gap: 1.25rem;
      padding-bottom: calc(6.5rem + env(safe-area-inset-bottom, 0px));
    }

    .pre-hero-card {
      padding: 1.15rem;
      gap: 1rem;
    }
    .hero-top-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }
    .hero-title-lockup {
      gap: 0.75rem;
    }
    .hero-stage-icon-wrap {
      width: 44px;
      height: 44px;
    }
    .hero-title {
      font-size: 1.35rem;
    }
    .hero-description {
      font-size: 0.85rem;
    }

    .control-toolbar {
      padding: 1rem;
      flex-direction: column;
      align-items: stretch;
      gap: 0.85rem;
    }
    .toolbar-left {
      flex-direction: column;
      align-items: stretch;
      min-width: 100%;
    }
    .filter-select-wrap {
      width: 100%;
    }
    .filter-select {
      width: 100%;
    }
    .queue-segment-control {
      width: 100%;
      justify-content: stretch;
    }
    .segment-btn {
      flex: 1;
      justify-content: center;
    }

    /* Mobile Cards: Primary expander button on top, Details & Publish on row below */
    .card-top-bar {
      padding: 1rem;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }
    .card-left-identity {
      width: 100%;
    }
    .card-right-status {
      width: 100%;
    }

    .card-actions-bar {
      padding: 0.85rem 1rem;
      display: grid;
      grid-template-columns: 1fr 1.3fr;
      gap: 0.65rem;
    }
    .actions-group-left {
      display: contents;
    }
    .actions-group-right {
      display: contents;
    }
    .btn-toggle-work {
      grid-column: 1 / -1;
      width: 100%;
      justify-content: center;
      padding: 0.75rem 1rem;
      font-size: 0.9rem;
    }
    .btn-details-secondary {
      grid-column: 1;
      width: 100%;
      justify-content: center;
      padding: 0.75rem 0.5rem;
    }
    .btn-publish-highlight {
      grid-column: 2;
      width: 100%;
      justify-content: center;
      padding: 0.75rem 0.5rem;
    }

    /* Bottom Sheet on Mobile */
    .modal-backdrop {
      align-items: flex-end;
      padding: 0;
      overflow-y: hidden;
    }
    .publish-modal-card {
      border-radius: 20px 20px 0 0;
      max-height: 88vh;
      margin: 0;
      animation: sheetSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes sheetSlideUp {
      from {
        transform: translateY(100%);
      }
      to {
        transform: translateY(0);
      }
    }
    .form-fields-grid {
      grid-template-columns: 1fr;
    }
    .form-group.half-col {
      grid-column: 1 / -1;
    }
    .modal-footer {
      padding: 1rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom, 0px));
    }
    .modal-footer-buttons {
      flex-direction: column;
      width: 100%;
    }
    .btn-modal-cancel, .btn-modal-submit {
      width: 100%;
      justify-content: center;
    }
  }
</style>
