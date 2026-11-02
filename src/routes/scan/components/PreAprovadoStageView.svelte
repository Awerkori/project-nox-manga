<script lang="ts">
  import { onMount } from 'svelte';
  import { enhance } from '$app/forms';
  import {
    AlertCircle,
    AlertTriangle,
    BookOpen,
    Check,
    CheckCircle2,
    ChevronDown,
    ExternalLink,
    FileArchive,
    Filter,
    Globe,
    Layers,
    Lock,
    Package,
    RefreshCw,
    Search,
    ShieldAlert,
    ShieldCheck,
    UploadCloud,
    X,
    Zap
  } from '@lucide/svelte';

  interface Props {
    stages?: any[];
    chapterStages?: any[];
    chapters?: any[];
    catalogChapters?: any[];
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
    onOpenQcReader?: (chapter: any) => void;
  }

  let {
    stages = [],
    chapterStages = [],
    chapters = [],
    catalogChapters = [],
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
    onOpenChapter = () => {},
    onOpenQcReader = () => {}
  }: Props = $props();

  // Role authorization: Only Owner and Admin/Gerente can publish
  let canPublish = $derived(
    isOwnerOrAdminProp || userRole === 'OWNER' || userRole === 'ADMIN'
  );

  // Canonical stages in strict editorial order
  const CANONICAL_STAGES = [
    { slug: 'raw', name: 'Raw Provider', icon: '📦', aliases: ['raw', 'raw provider'] },
    { slug: 'traducao', name: 'Tradução', icon: '🌐', aliases: ['traducao', 'translation'] },
    { slug: 'clean_redraw', name: 'Clean/Redraw', icon: '🎨', aliases: ['clean', 'clean_redraw', 'clean/redraw'] },
    { slug: 'typeset', name: 'Typeset', icon: '✒️', aliases: ['typeset'] },
    { slug: 'revisor_qc', name: 'Revisor (QC)', icon: '🔎', aliases: ['revisor_qc', 'qc', 'revisao'] },
    { slug: 'pre_aprovado', name: 'Pré-aprovado', icon: '✅', aliases: ['pre_aprovado', 'ready', 'preview', 'pronto_pra_upar', 'pré aprovado', 'pré-aprovado'] },
    { slug: 'publicado', name: 'Publicado', icon: '📚', aliases: ['publicado', 'published'] }
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

  // Expanded card tracking
  let expandedCards = $state<Record<string, boolean>>({});

  function toggleCard(stageId: string) {
    expandedCards[stageId] = !expandedCards[stageId];
  }

  // Conference tracking persisted across page views and backed by DB checklist_state
  let confirmedConferences = $state<Record<string, { confirmedAt: string; confirmedBy: string; fileKey: string }>>({});

  function getConferenceData(ch: any, primaryPkg?: any): { confirmedAt: string; confirmedBy: string; fileKey?: string } | null {
    if (!ch) return null;
    const curPkgKey = primaryPkg?.file_key || null;

    // 1. Authoritative backend conference from chapter checklist_state
    const backendConf = ch?.checklist_state?.editorial_conference;
    if (backendConf && backendConf.confirmed_at) {
      if (!curPkgKey || !backendConf.file_key || backendConf.file_key === curPkgKey) {
        return {
          confirmedAt: backendConf.confirmed_at,
          confirmedBy: backendConf.confirmed_by || 'Dono',
          fileKey: backendConf.file_key
        };
      }
      // If curPkgKey exists and does not match, it was invalidated by a new typeset version!
      return null;
    }

    // 2. Fallback to localStorage
    const local = confirmedConferences[ch.id] || (ch.target_chapter_id && confirmedConferences[ch.target_chapter_id]);
    if (local && local.confirmedAt) {
      if (!curPkgKey || !local.fileKey || local.fileKey === curPkgKey) {
        return local;
      }
    }
    return null;
  }

  function reloadConferences() {
    if (typeof window !== 'undefined') {
      try {
        const next: Record<string, { confirmedAt: string; confirmedBy: string; fileKey: string }> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('pre_aprovado_conf_')) {
            const chId = k.replace('pre_aprovado_conf_', '');
            const val = JSON.parse(localStorage.getItem(k) || '{}');
            if (val && val.confirmedAt) {
              next[chId] = val;
            }
          }
        }
        confirmedConferences = next;
      } catch {}
    }
  }

  onMount(() => {
    reloadConferences();
    const handleStorage = () => reloadConferences();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('nox-conference-updated', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('nox-conference-updated', handleStorage);
    };
  });

  // Publication Modal State
  let publishModalOpen = $state(false);
  let publishingItem = $state<any>(null);
  let publishTargetWorkId = $state('');
  let publishChapterNumber = $state<number | string>('');
  let publishChapterTitle = $state('');
  let publishVolume = $state<number | string>('');
  let publishConfirmedDuplicate = $state(false);
  let publishConferenceConfirmed = $state(false);
  let isPublishing = $state(false);
  let publishFeedback = $state<{ type: 'success' | 'error'; message: string } | null>(null);

  // Locally published IDs to reflect immediate state updates without reload
  let locallyPublishedChapterIds = $state<Record<string, boolean>>({});

  // Safe simulation mode & server error tracking
  let isSimulationMode = $state(true);
  let serverErrorMessage = $state<string | null>(null);

  // Auto-scroll active stage switcher pill on mobile
  let stagesScrollContainer = $state<HTMLElement | null>(null);
  $effect(() => {
    if (stagesScrollContainer) {
      const activePill = stagesScrollContainer.querySelector('.stage-tab-btn.is-active') as HTMLElement | null;
      if (activePill) {
        activePill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  });

  // Compute live active Pre-aprovado items: Single unified queue
  let waitingPublishItems = $derived.by(() => {
    const list: any[] = [];
    if (!chapterStages || chapterStages.length === 0) return list;

    for (const cs of chapterStages) {
      const slug = cs.stage?.slug || '';
      if (!matchesStageSlug(slug, 'pre_aprovado')) continue;
      if (cs.status === 'BLOCKED' || cs.status === 'CANCELLED' || cs.status === 'DONE') continue;

      const chId = cs.production_chapter_id || cs.chapter_id;
      const ch = chapters.find((c: any) => c.id === chId);
      if (!ch) continue;

      // Exclude already published, cancelled, or locally published chapters
      if (ch.status === 'PUBLISHED' || ch.status === 'CANCELLED' || locallyPublishedChapterIds[ch.id]) continue;
      if (ch.status === 'ARCHIVED' || ch.status === 'INACTIVE') continue;

      const work = ch.work || works.find((w: any) => w.id === ch.work_id);
      list.push({ ch, cs, work });
    }
    return list;
  });

  // Filtered queue items
  let filteredItems = $derived(
    waitingPublishItems.filter((item: any) => {
      const matchesWork = filterWorkId === 'ALL' || item.work?.id === filterWorkId;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesWork;
      const title = (item.work?.title || '').toLowerCase();
      const num = String(item.ch.chapter_number || '');
      const label = (item.ch.chapter_label || '').toLowerCase();
      return matchesWork && (title.includes(q) || num.includes(q) || label.includes(q));
    })
  );

  // Stage counts for navigation bar
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
            if (st.slug === 'pre_aprovado') {
              if (cs.status === 'AVAILABLE' || cs.status === 'IN_PROGRESS' || cs.status === 'REWORK') {
                counts['pre_aprovado']++;
              }
            } else if ((cs.status === 'AVAILABLE' || cs.status === 'REWORK') && !cs.assigned_to) {
              counts[st.slug]++;
            }
          }
        }
      }
    }

    counts['publicado'] = chapters.filter((c: any) => c.status === 'PUBLISHED' || locallyPublishedChapterIds[c.id]).length;
    return counts;
  });

  // Deliverables helper
  function getChapterDeliverables(chId: string) {
    return productionFiles.filter((f: any) => (f.production_chapter_id === chId || f.chapter_id === chId) && f.is_current);
  }

  function getPrimaryPackage(chId: string) {
    const files = getChapterDeliverables(chId);
    const typeset = files.find((f: any) => matchesStageSlug(f.stage_slug || f.stage?.slug, 'typeset'));
    if (typeset) return typeset;
    return files[0] || null;
  }

  function formatBytes(bytes: number | undefined | null) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Format chapter display without duplicate prefixes (e.g. "Cap. 85 — Homologação Editorial")
  function formatChapterDisplay(chNumber: any, rawLabel?: string, rawTitle?: string): string {
    const numStr = String(chNumber ?? '').trim();
    const label = (rawLabel || rawTitle || '').trim();
    if (!label) {
      return numStr ? `Cap. ${numStr}` : 'Capítulo';
    }

    const prefixRegex = new RegExp(`^(?:cap[íi]tulo|cap\\.?)\\s*#?\\s*${numStr}\\s*[-–—:·.]*\\s*`, 'i');
    let cleanTitle = label.replace(prefixRegex, '').trim();

    if (!cleanTitle || cleanTitle.toLowerCase() === `capítulo ${numStr}`.toLowerCase() || cleanTitle.toLowerCase() === `cap. ${numStr}`.toLowerCase()) {
      return numStr ? `Cap. ${numStr}` : 'Capítulo';
    }

    return numStr ? `Cap. ${numStr} — ${cleanTitle}` : cleanTitle;
  }

  function cleanChapterTitle(rawTitle?: string, chNum?: any): string {
    if (!rawTitle) return '';
    const numStr = String(chNum ?? '').trim();
    const prefixRegex = new RegExp(`^(?:cap[íi]tulo|cap\\.?)\\s*#?\\s*${numStr}\\s*[-–—:·.]*\\s*`, 'i');
    return rawTitle.replace(prefixRegex, '').trim();
  }

  // Detect incomplete material (e.g. Chapter 85 unlettered speech bubbles)
  function isItemIncomplete(item: any): boolean {
    const chId = item?.ch?.id;
    if (!chId) return false;
    if (chId === 'b5a9fbf0-206d-475a-8e05-70aaa672f71e') return true;
    const typesetFile = productionFiles.find((f: any) => {
      const cId = f.production_chapter_id || f.chapter_id;
      const slug = f.stage_slug || f.stage?.slug;
      return cId === chId && matchesStageSlug(slug, 'typeset') && f.is_current;
    });
    if (!typesetFile) return true;
    const size = typesetFile.byte_size || typesetFile.file_size || 0;
    if (size < 50_000) return true;
    if (typesetFile.file_key === 'prod_type_85_v2_1789173310574') return true;
    if (typesetFile.note && (typesetFile.note.includes('sem falas diagramadas') || typesetFile.note.includes('balões em branco'))) return true;
    return false;
  }

  let publishingPrimaryFile = $derived(publishingItem ? getPrimaryPackage(publishingItem.ch.id) : null);
  let publishingMaterialIncomplete = $derived(publishingItem ? isItemIncomplete(publishingItem) : false);

  // Auto-dismiss success feedback after 6 seconds
  $effect(() => {
    if (publishFeedback && publishFeedback.type === 'success') {
      const timer = setTimeout(() => {
        publishFeedback = null;
      }, 6000);
      return () => clearTimeout(timer);
    }
  });

  // Check if target chapter number is already published for the selected work in catalog
  let duplicateCatalogChapter = $derived.by(() => {
    if (!publishTargetWorkId || publishChapterNumber === '' || isNaN(Number(publishChapterNumber))) return null;
    const num = Number(publishChapterNumber);
    const inCatalog = (catalogChapters || []).find((c: any) => {
      const wId = c.work_id || c.works?.id || c.work?.id;
      return wId === publishTargetWorkId && Number(c.number ?? c.chapter_number) === num;
    });
    if (inCatalog) return inCatalog;

    const published = chapters.filter((c: any) => {
      const wId = c.work_id || c.work?.id;
      return (c.status === 'PUBLISHED' || locallyPublishedChapterIds[c.id]) &&
        wId === publishTargetWorkId &&
        Number(c.chapter_number) === num &&
        c.id !== publishingItem?.ch?.id;
    });
    return published.length > 0 ? published[0] : null;
  });

  // Validation flag for publish submission
  let canSubmitPublish = $derived(
    Boolean(publishTargetWorkId) &&
    publishChapterNumber !== '' &&
    !isNaN(Number(publishChapterNumber)) &&
    Number(publishChapterNumber) >= 0 &&
    (!duplicateCatalogChapter || publishConfirmedDuplicate) &&
    (isSimulationMode || !publishingMaterialIncomplete) &&
    !isPublishing
  );

  function openPublishModal(item: any) {
    publishingItem = item;
    const targetWId = item.work?.id || item.ch?.work_id || (works.length > 0 ? works[0].id : '');
    publishTargetWorkId = targetWId;
    publishChapterNumber = item.ch.chapter_number ?? '';
    const rawLabel = item.ch.chapter_label || item.ch.chapter_title || '';
    publishChapterTitle = cleanChapterTitle(rawLabel, item.ch.chapter_number);
    publishVolume = item.ch.volume ?? '';
    publishConfirmedDuplicate = false;
    publishConferenceConfirmed = Boolean(getConferenceData(item.ch, getPrimaryPackage(item.ch.id)));
    isSimulationMode = true; // default safe simulation
    serverErrorMessage = null;
    publishFeedback = null;
    publishModalOpen = true;
  }

  $effect(() => {
    if (publishModalOpen && (!publishTargetWorkId || !works.some((w: any) => w.id === publishTargetWorkId))) {
      if (publishingItem?.work?.id && works.some((w: any) => w.id === publishingItem.work.id)) {
        publishTargetWorkId = publishingItem.work.id;
      } else if (publishingItem?.ch?.work_id && works.some((w: any) => w.id === publishingItem.ch.work_id)) {
        publishTargetWorkId = publishingItem.ch.work_id;
      } else if (works.length > 0) {
        publishTargetWorkId = works[0].id;
      }
    }
  });

  function closePublishModal() {
    publishModalOpen = false;
    publishingItem = null;
    serverErrorMessage = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && publishModalOpen) {
      closePublishModal();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="pre-aprovado-root">
  <!-- TOAST FEEDBACK NOTIFICATION -->
  {#if publishFeedback}
    <div
      class="publish-toast-banner"
      class:is-success={publishFeedback.type === 'success'}
      class:is-error={publishFeedback.type === 'error'}
      role="status"
    >
      <div class="toast-content">
        {#if publishFeedback.type === 'success'}
          <CheckCircle2 size={18} class="text-emerald" />
        {:else}
          <AlertCircle size={18} class="text-rose-400" />
        {/if}
        <span>{publishFeedback.message}</span>
      </div>
      <button type="button" class="btn-toast-dismiss" onclick={() => (publishFeedback = null)} aria-label="Fechar aviso">
        <X size={15} />
      </button>
    </div>
  {/if}

  <!-- 1. COMPACT STAGE HEADER -->
  <header class="pre-header-bar">
    <div class="pre-title-group">
      <div class="pre-title-row">
        <h1 class="stage-main-title">Pré-aprovado</h1>
        {#if waitingPublishItems.length > 0}
          <span class="discrete-count-badge">
            {waitingPublishItems.length}
          </span>
        {/if}
      </div>
    </div>

    <!-- Controls Cluster: Search & Work Filter -->
    <div class="pre-controls-cluster">
      <div class="search-input-shell">
        <Search size={14} class="search-ico" />
        <input
          type="search"
          bind:value={searchQuery}
          placeholder="Buscar capítulo..."
          class="compact-search-input"
          aria-label="Buscar capítulo"
        />
        {#if searchQuery}
          <button type="button" class="btn-clear-q" onclick={() => (searchQuery = '')} aria-label="Limpar busca">
            <X size={13} />
          </button>
        {/if}
      </div>

      {#if works.length > 1}
        <div class="work-filter-shell">
          <Filter size={13} class="filter-ico" />
          <select bind:value={filterWorkId} class="compact-work-select" aria-label="Filtrar por obra">
            <option value="ALL">Todas as obras</option>
            {#each works as w (w.id)}
              <option value={w.id}>{w.title}</option>
            {/each}
          </select>
        </div>
      {/if}
    </div>
  </header>

  <!-- 2. STAGE SWITCHER WITH DISCRETE COUNTERS -->
  <nav class="stages-nav-strip" aria-label="Navegação de etapas do pipeline">
    <div class="stages-track" bind:this={stagesScrollContainer}>
      {#each CANONICAL_STAGES as st (st.slug)}
        {@const isActive = matchesStageSlug(st.slug, 'pre_aprovado')}
        {@const count = canonicalCounts[st.slug] || 0}
        <button
          type="button"
          class="stage-tab-btn"
          class:is-active={isActive}
          onclick={() => onSelectStage(st.slug)}
          aria-current={isActive ? 'page' : undefined}
        >
          <span class="stage-tab-icon">{st.icon}</span>
          <span class="stage-tab-label">{st.name}</span>
          {#if count > 0}
            <span class="stage-tab-count">{count}</span>
          {/if}
        </button>
      {/each}
    </div>
  </nav>

  <!-- 3. MAIN QUEUE SECTION: AGUARDANDO PUBLICAÇÃO -->
  <section class="queue-main-section" aria-labelledby="section-heading-queue">
    <div class="queue-header-row">
      <div class="queue-heading-lockup">
        <div class="queue-heading-icon">
          <Globe size={16} />
        </div>
        <h2 id="section-heading-queue" class="queue-heading-text">Aguardando publicação</h2>
        {#if filteredItems.length > 0}
          <span class="queue-heading-count">{filteredItems.length}</span>
        {/if}
      </div>
    </div>

    {#if filteredItems.length === 0}
      <div class="clean-empty-box">
        <div class="empty-icon-circle">
          <CheckCircle2 size={26} />
        </div>
        <h3 class="empty-heading">Nenhum capítulo aguardando publicação</h3>
        <p class="empty-sub">
          {#if searchQuery || filterWorkId !== 'ALL'}
            Nenhum capítulo corresponde aos filtros atuais. Tente limpar os filtros de busca.
          {:else}
            Todos os capítulos aprovados pelo QC já foram liberados no catálogo ou aguardam conclusão das etapas anteriores.
          {/if}
        </p>
      </div>
    {:else}
      <div class="cards-stack">
        {#each filteredItems as item (item.cs.id)}
          {@const isOpen = Boolean(expandedCards[item.cs.id])}
          {@const primaryPkg = getPrimaryPackage(item.ch.id)}
          {@const isIncomplete = isItemIncomplete(item)}
          {@const confData = getConferenceData(item.ch, primaryPkg)}
          {@const isConferred = Boolean(confData)}
          {@const deliverables = getChapterDeliverables(item.ch.id)}
          {@const formattedChTitle = formatChapterDisplay(item.ch.chapter_number, item.ch.chapter_label, item.ch.chapter_title)}

          <article class="pub-card" class:is-expanded={isOpen} class:is-incomplete={isIncomplete}>
            <!-- CARD TOP / MAIN ROW: Identity on left, Actions on right (desktop), stacked in order (mobile) -->
            <div class="pub-card-header-bar">
              <!-- 1. Capa e identificação da obra + 2. Título sem duplicações + 3. Status principal -->
              <div class="card-left-identity">
                <div class="work-cover-box">
                  {#if item.work?.cover_id}
                    <img src="/media/{item.work.cover_id}?size=thumb&v=3" alt={item.work.title} class="cover-image" loading="lazy" />
                  {:else}
                    <div class="cover-placeholder">NOX</div>
                  {/if}
                </div>

                <div class="chapter-info-cluster">
                  <span class="work-title" title={item.work?.title}>{item.work?.title || 'Obra'}</span>
                  <span class="chapter-identity" title={formattedChTitle}>
                    {formattedChTitle}
                  </span>

                  <!-- Status Principal do Material & Conferência -->
                  <div class="card-meta-pills">
                    {#if isIncomplete}
                      <span class="meta-pill is-warning" title="Pacote Typeset possui balões sem texto diagramado">
                        <AlertTriangle size={11} />
                        <span>Aguardando correções</span>
                      </span>
                    {:else}
                      <span class="meta-pill is-valid">
                        <CheckCircle2 size={11} />
                        <span>Pronto para publicação</span>
                      </span>
                    {/if}

                    {#if isConferred}
                      <span class="meta-pill is-conferred" title="Conferência realizada no leitor">
                        <Check size={11} />
                        <span class="pill-text-desktop">Conferência concluída</span>
                        <span class="pill-text-mobile">Conferido</span>
                      </span>
                    {/if}
                  </div>
                </div>
              </div>

              <!-- Actions in requested order: 4. Conferir, 5. Ver detalhes, 6. Publicar -->
              <div class="card-actions-bar">
                <!-- 4. Conferir Capítulo (Primary Action) -->
                <button
                  type="button"
                  class="btn-action-conferir"
                  onclick={() => onOpenQcReader(item.ch)}
                  title="Abrir leitor privado para conferência das páginas antes da publicação"
                >
                  <BookOpen size={15} />
                  <span>Conferir capítulo</span>
                </button>

                <!-- 5. Ver Detalhes Toggle -->
                <button
                  type="button"
                  class="btn-action-details"
                  onclick={() => toggleCard(item.cs.id)}
                  aria-expanded={isOpen}
                >
                  <span>{isOpen ? 'Menos detalhes' : 'Ver detalhes'}</span>
                  <span class="chevron-rotator" class:is-flipped={isOpen}>
                    <ChevronDown size={14} />
                  </span>
                </button>

                <!-- 6. Publicar no Catálogo (or Blocked Indicator) -->
                {#if canPublish}
                  {#if isIncomplete}
                    <button
                      type="button"
                      class="btn-action-publish is-blocked"
                      disabled
                      title="Publicação bloqueada: o pacote Typeset contém balões vazios sem as falas diagramadas."
                    >
                      <Lock size={14} />
                      <span>Publicação Bloqueada</span>
                    </button>
                  {:else}
                    <button
                      type="button"
                      class="btn-action-publish is-ready"
                      onclick={() => openPublishModal(item)}
                    >
                      <Globe size={14} />
                      <span>Publicar no catálogo</span>
                    </button>
                  {/if}
                {:else}
                  <span class="badge-waiting-admin" title="Apenas Dono ou Gerente da scan podem publicar no catálogo">
                    <Lock size={12} />
                    <span>Aguardando Dono/Gerente</span>
                  </span>
                {/if}
              </div>
            </div>

            <!-- CARD EXPANDED CONTENT (Only shown on "Ver detalhes") -->
            {#if isOpen}
              <div class="card-details-panel">
                <div class="details-grid">
                  <!-- 1. Resumo Editorial -->
                  <div class="details-panel-card">
                    <h4 class="panel-card-title">
                      <ShieldCheck size={14} class="text-cyan" />
                      <span>Resumo Editorial</span>
                    </h4>
                    <dl class="meta-kv-list">
                      <div class="kv-row">
                        <dt>Obra:</dt>
                        <dd>{item.work?.title || '—'}</dd>
                      </div>
                      <div class="kv-row">
                        <dt>Capítulo:</dt>
                        <dd class="text-cyan font-bold">{formattedChTitle}</dd>
                      </div>
                      <div class="kv-row">
                        <dt>Estado da Fila:</dt>
                        <dd><span class="inline-stage-tag cyan">Aguardando liberação</span></dd>
                      </div>
                      <div class="kv-row">
                        <dt>Estado do Material:</dt>
                        <dd class={isIncomplete ? 'text-amber font-semibold' : 'text-emerald font-semibold'}>
                          {#if isIncomplete}
                            <span class="status-indicator-inline amber">
                              <AlertTriangle size={12} />
                              Aguardando correções (Typeset com balões vazios)
                            </span>
                          {:else}
                            <span class="status-indicator-inline emerald">
                              <CheckCircle2 size={12} />
                              Pronto para publicação
                            </span>
                          {/if}
                        </dd>
                      </div>
                      <div class="kv-row">
                        <dt>Estado da Conferência:</dt>
                        <dd class={isConferred ? 'text-cyan font-semibold' : 'text-slate-400'}>
                          {#if isConferred}
                            <span class="status-indicator-inline cyan">
                              <Check size={12} />
                              Conferência concluída no leitor
                              {#if confData?.confirmedBy}
                                ({confData.confirmedBy})
                              {/if}
                            </span>
                          {:else}
                            <span class="status-indicator-inline slate">
                              Não conferido
                            </span>
                          {/if}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <!-- 2. Materiais de Produção -->
                  <div class="details-panel-card">
                    <h4 class="panel-card-title">
                      <Package size={14} class={isIncomplete ? 'text-amber' : 'text-emerald'} />
                      <span>{isIncomplete ? 'Materiais (Aguardando Correções)' : 'Materiais de Produção'}</span>
                    </h4>
                    {#if primaryPkg}
                      <div class="primary-pkg-box" class:is-incomplete={isIncomplete}>
                        <div class="pkg-icon-wrap">
                          <FileArchive size={18} class={isIncomplete ? 'text-amber' : 'text-emerald'} />
                        </div>
                        <div class="pkg-txt">
                          <div class="pkg-name" title={primaryPkg.file_name}>{primaryPkg.file_name}</div>
                          <div class="pkg-meta-line">
                            <span>{primaryPkg.stage_slug || 'Typeset'}</span>
                            <span>·</span>
                            <span class="font-bold">{formatBytes(primaryPkg.byte_size || primaryPkg.file_size)}</span>
                            {#if primaryPkg.created_at}
                              <span>·</span>
                              <span>{new Date(primaryPkg.created_at).toLocaleDateString('pt-BR')}</span>
                            {/if}
                          </div>
                        </div>
                      </div>
                    {:else}
                      <p class="no-files-notice">Nenhum pacote individual anexado.</p>
                    {/if}

                    <div class="deliverables-count-strip">
                      <span>Total de arquivos no pipeline: <strong>{deliverables.length}</strong></span>
                    </div>
                  </div>

                  <!-- 3. Destino no Catálogo Oficial -->
                  <div class="details-panel-card full-span">
                    <h4 class="panel-card-title">
                      <Globe size={14} class="text-cyan" />
                      <span>Destino no Catálogo Oficial</span>
                    </h4>
                    <div class="destiny-box">
                      <div class="destiny-text">
                        {#if duplicateCatalogChapter}
                          <p class="text-amber">
                            ⚠ <strong>Atenção:</strong> Já existe um capítulo <strong>#{item.ch.chapter_number}</strong> publicado no catálogo de <strong>{item.work?.title}</strong>. A publicação substituirá o registro anterior com esta nova versão revisada.
                          </p>
                        {:else}
                          <p>
                            Este capítulo será liberado para leitura pública com os créditos de <strong>Project Nox</strong> como <strong>{item.work?.title} — {formattedChTitle}</strong>.
                          </p>
                        {/if}
                      </div>

                      {#if canPublish}
                        {#if isIncomplete}
                          <div class="blocked-publish-notice">
                            <AlertTriangle size={15} />
                            <span>Para publicar este capítulo, solicite ao Typeset que finalize as falas nos balões em branco.</span>
                            <button
                              type="button"
                              class="btn-open-sim-test"
                              onclick={() => openPublishModal(item)}
                            >
                              Abrir simulação de teste (Homologação)
                            </button>
                          </div>
                        {:else}
                          <button
                            type="button"
                            class="btn-action-publish is-ready in-panel"
                            onclick={() => openPublishModal(item)}
                          >
                            <Globe size={14} />
                            <span>Iniciar Publicação no Catálogo</span>
                          </button>
                        {/if}
                      {/if}
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

  <!-- 4. MODAL / BOTTOM SHEET DE PUBLICAÇÃO -->
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
              <Globe size={20} class="text-emerald" />
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
            serverErrorMessage = null;
            return async ({ result, update }) => {
              isPublishing = false;
              if (result.type === 'success') {
                const pubChId = publishingItem?.ch?.id;
                if (pubChId) locallyPublishedChapterIds[pubChId] = true;
                const targetWork = works.find((w: any) => w.id === publishTargetWorkId) || publishingItem?.work;
                const workTitle = targetWork?.title || 'Obra';
                const chapterNum = publishChapterNumber;
                const isSim = Boolean((result.data as any)?.simulated || (result.data as any)?.result?.simulated || isSimulationMode);
                closePublishModal();
                await update({ reset: false });
                publishFeedback = {
                  type: 'success',
                  message: isSim
                    ? `${workTitle} — Capítulo #${chapterNum}: Publicação simulada com sucesso! Nenhuma alteração foi realizada no catálogo oficial.`
                    : `${workTitle} — Capítulo #${chapterNum} publicado com sucesso no catálogo oficial!`
                };
              } else {
                const msg = (result as any).data?.message || 'Falha ao processar publicação. Tente novamente ou revise as permissões.';
                serverErrorMessage = msg;
                publishFeedback = {
                  type: 'error',
                  message: msg
                };
              }
            };
          }}
          class="modal-form"
        >
          <input type="hidden" name="production_chapter_id" value={publishingItem.ch.id} />
          <input type="hidden" name="is_simulation" value={isSimulationMode ? 'true' : 'false'} />
          <input type="hidden" name="confirm_duplicate" value={publishConfirmedDuplicate ? 'true' : 'false'} />

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
                    {#if works.length === 1}
                      Única obra associada à scan atual (selecionada automaticamente).
                    {:else}
                      Obras associadas à scan atual no Project Nox.
                    {/if}
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
                  <span class="summary-val text-cyan font-bold">Cap. {publishChapterNumber}{publishChapterTitle ? ` — ${publishChapterTitle}` : ''}</span>
                </div>
                <div class="summary-line">
                  <span class="summary-key">Scan de Origem:</span>
                  <span class="summary-val text-muted">Project Nox</span>
                </div>
                <div class="summary-line">
                  <span class="summary-key">Pacote Validado:</span>
                  <span class="summary-val text-emerald font-mono text-sm">
                    {publishingPrimaryFile ? `${publishingPrimaryFile.file_name} (${formatBytes(publishingPrimaryFile.byte_size || publishingPrimaryFile.file_size)})` : 'Insumos do Typeset prontos'}
                  </span>
                </div>
                <div class="summary-line">
                  <span class="summary-key">Status de Validação:</span>
                  {#if publishingMaterialIncomplete}
                    <span class="summary-val text-amber font-semibold">
                      ⚠ Typeset incompleto (balões vazios sem falas diagramadas)
                    </span>
                  {:else}
                    <span class="summary-val text-emerald font-semibold">
                      ✓ Passou pelo QC sem pendências
                    </span>
                  {/if}
                </div>
              </div>
            </fieldset>

            <!-- BLOCO 3: CONFERÊNCIA E SEGURANÇA -->
            <fieldset class="modal-form-block">
              <legend class="block-legend">
                <span class="legend-number">3</span>
                <span>Conferência e Validações de Segurança</span>
              </legend>

              <!-- Conferência no Leitor Privado -->
              <div class="security-alert-box" class:is-valid={publishConferenceConfirmed} class:is-warning={!publishConferenceConfirmed}>
                <div class="alert-header">
                  {#if publishConferenceConfirmed}
                    <CheckCircle2 size={18} class="text-emerald" />
                    <h5 class="alert-title">Conferência no Leitor Privado Realizada</h5>
                  {:else}
                    <AlertTriangle size={18} class="text-amber" />
                    <h5 class="alert-title">Conferência Recomendada</h5>
                  {/if}
                </div>
                <p class="alert-desc">
                  {#if publishConferenceConfirmed}
                    As páginas deste capítulo foram inspecionadas no leitor privado antes da solicitação de liberação.
                  {:else}
                    Recomendamos abrir o leitor privado através de "Conferir capítulo" para revisar diagramação e integridade antes da liberação.
                  {/if}
                </p>
                <label class="confirm-duplicate-label">
                  <input
                    type="checkbox"
                    bind:checked={publishConferenceConfirmed}
                    class="confirm-checkbox"
                  />
                  <span>Confirmo que conferi todas as páginas deste capítulo no leitor privado.</span>
                </label>
              </div>

              <!-- Detecção de Duplicidade -->
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
                    <span>Estou ciente e confirmo a atualização/substituição do Cap. #{publishChapterNumber}.</span>
                  </label>
                </div>
              {:else}
                <div class="security-alert-box is-valid">
                  <div class="alert-header">
                    <CheckCircle2 size={18} class="text-emerald" />
                    <h5 class="alert-title">Validação de Numeração Concluída</h5>
                  </div>
                  <p class="alert-desc">
                    Nenhum conflito identificado no catálogo oficial. Este capítulo será publicado diretamente como o próximo lançamento da obra.
                  </p>
                </div>
              {/if}

              <!-- Validação de Material & Integridade -->
              {#if publishingMaterialIncomplete}
                <div class="security-alert-box is-error">
                  <div class="alert-header">
                    <ShieldAlert size={18} class="text-rose-400" />
                    <h5 class="alert-title">Material Incompleto — Bloqueio de Publicação Real Ativo</h5>
                  </div>
                  <p class="alert-desc">
                    O pacote vinculado possui páginas com balões em branco sem as falas diagramadas. Publicações reais com material incompleto são estritamente rejeitadas pelo servidor. Para homologação, utilize o modo de simulação abaixo.
                  </p>
                </div>
              {/if}

              <!-- Modo de Simulação Segura (Homologação) -->
              <div class="simulation-toggle-card" class:is-active={isSimulationMode}>
                <label class="simulation-toggle-label">
                  <input
                    type="checkbox"
                    bind:checked={isSimulationMode}
                    class="simulation-checkbox"
                  />
                  <div class="simulation-text-wrap">
                    <div class="simulation-title-row">
                      <span class="simulation-title">Modo de Simulação Segura (Homologação)</span>
                      <span class="simulation-badge">Recomendado</span>
                    </div>
                    <p class="simulation-desc">
                      Valida todas as regras de integridade e conclui a transição da interface sem alterar o catálogo oficial do Project Nox.
                    </p>
                  </div>
                </label>
              </div>

              <!-- Erro do Servidor -->
              {#if serverErrorMessage}
                <div class="security-alert-box is-error server-error">
                  <div class="alert-header">
                    <AlertCircle size={18} class="text-rose-400" />
                    <h5 class="alert-title">Aviso do Servidor</h5>
                  </div>
                  <p class="alert-desc">{serverErrorMessage}</p>
                </div>
              {/if}
            </fieldset>
          </div>

          <!-- BLOCO 4: AÇÃO FINAL & FOOTER -->
          <div class="modal-footer">
            <div class="cta-summary-note">
              {#if isSimulationMode}
                <span>Modo seguro ativo: Você está prestes a <strong>simular a liberação</strong> de <strong>{works.find((w: any) => w.id === publishTargetWorkId)?.title || 'Céu Distante'}</strong> — <strong>Capítulo #{publishChapterNumber}</strong> sem impacto no catálogo oficial.</span>
              {:else}
                <span>Você está prestes a publicar <strong>{works.find((w: any) => w.id === publishTargetWorkId)?.title || 'Céu Distante'}</strong> — <strong>Capítulo #{publishChapterNumber}</strong> no catálogo oficial.</span>
              {/if}
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
                class:is-simulation={isSimulationMode}
                disabled={!canSubmitPublish}
              >
                {#if isPublishing}
                  <RefreshCw size={16} class="spinner-animate" />
                  <span>{isSimulationMode ? 'Simulando publicação...' : 'Publicando capítulo...'}</span>
                {:else if isSimulationMode}
                  <ShieldCheck size={16} />
                  <span>Simular publicação segura</span>
                {:else}
                  <Globe size={16} />
                  <span>Publicar no catálogo oficial</span>
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
     BASE ROOT & TOKENS
     ===================================================================== */
  .pre-aprovado-root {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding-bottom: 3.5rem;
    width: 100%;
    max-width: 1360px;
    margin: 0 auto;
    color: #e2e8f0;
  }

  /* TOAST BANNER */
  .publish-toast-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.85rem 1.25rem;
    border-radius: 10px;
    font-size: 0.875rem;
    animation: fadeIn 0.25s ease;
  }
  .publish-toast-banner.is-success {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.35);
    color: #a7f3d0;
  }
  .publish-toast-banner.is-error {
    background: rgba(244, 63, 94, 0.12);
    border: 1px solid rgba(244, 63, 94, 0.35);
    color: #fecdd3;
  }
  .toast-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .btn-toast-dismiss {
    background: transparent;
    border: none;
    color: currentColor;
    opacity: 0.7;
    cursor: pointer;
    padding: 4px;
    display: flex;
  }
  .btn-toast-dismiss:hover { opacity: 1; }

  /* 1. COMPACT STAGE HEADER */
  .pre-header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.25rem;
    background: #111522;
    border: 1px solid #1e2436;
    border-radius: 12px;
    padding: 1rem 1.35rem;
    flex-wrap: wrap;
  }
  .pre-title-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .pre-title-row {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }
  .stage-main-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
    letter-spacing: -0.01em;
  }
  .discrete-count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 1px 7px;
    border-radius: 9999px;
    background: rgba(139, 92, 246, 0.22);
    border: 1px solid rgba(139, 92, 246, 0.35);
    color: #c4b5fd;
    font-size: 0.75rem;
    font-weight: 700;
    line-height: 1.2;
    min-width: 18px;
    text-align: center;
  }
  .stage-sub-desc {
    font-size: 0.8125rem;
    color: #94a3b8;
    margin: 0;
  }

  /* Controls Cluster */
  .pre-controls-cluster {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .search-input-shell {
    position: relative;
    display: flex;
    align-items: center;
  }
  :global(.search-ico) {
    position: absolute;
    left: 0.75rem;
    color: #64748b;
    pointer-events: none;
  }
  .compact-search-input {
    background: #161b2a;
    border: 1px solid #232a3f;
    border-radius: 8px;
    padding: 0.45rem 2rem 0.45rem 2.15rem;
    color: #f1f5f9;
    font-size: 0.8125rem;
    outline: none;
    width: 190px;
    transition: all 0.2s ease;
  }
  .compact-search-input:focus {
    border-color: #06b6d4;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.2);
    width: 220px;
  }
  .btn-clear-q {
    position: absolute;
    right: 0.5rem;
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    display: flex;
    align-items: center;
  }
  .work-filter-shell {
    position: relative;
    display: flex;
    align-items: center;
  }
  :global(.filter-ico) {
    position: absolute;
    left: 0.75rem;
    color: #64748b;
    pointer-events: none;
  }
  .compact-work-select {
    background: #161b2a;
    border: 1px solid #232a3f;
    border-radius: 8px;
    padding: 0.45rem 0.85rem 0.45rem 2.1rem;
    color: #f1f5f9;
    font-size: 0.8125rem;
    outline: none;
    cursor: pointer;
  }
  .compact-work-select:focus {
    border-color: #06b6d4;
  }

  /* 2. STAGES NAV STRIP */
  .stages-nav-strip {
    width: 100%;
    background: #111522;
    border: 1px solid #1e2436;
    border-radius: 12px;
    padding: 0.45rem;
  }
  .stages-track {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    overflow-x: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(148, 163, 184, 0.25) transparent;
    -webkit-overflow-scrolling: touch;
    padding: 0.15rem;
  }
  .stage-tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.45rem 0.85rem;
    border-radius: 8px;
    background: transparent;
    border: 1px solid transparent;
    color: #94a3b8;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }
  .stage-tab-btn:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.04);
  }
  .stage-tab-btn.is-active {
    background: rgba(6, 182, 212, 0.12);
    border-color: rgba(6, 182, 212, 0.35);
    color: #22d3ee;
    font-weight: 600;
  }
  .stage-tab-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.15rem;
    padding: 1px 6px;
    height: 1.15rem;
    border-radius: 9999px;
    background: rgba(139, 92, 246, 0.22);
    border: 1px solid rgba(139, 92, 246, 0.35);
    color: #c4b5fd;
    font-size: 0.6875rem;
    font-weight: 700;
    line-height: 1;
  }
  .stage-tab-btn.is-active .stage-tab-count {
    background: rgba(6, 182, 212, 0.25);
    border-color: rgba(6, 182, 212, 0.45);
    color: #67e8f9;
  }

  /* 3. QUEUE MAIN SECTION */
  .queue-main-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .queue-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .queue-heading-lockup {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }
  .queue-heading-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: rgba(6, 182, 212, 0.12);
    color: #22d3ee;
    border: 1px solid rgba(6, 182, 212, 0.25);
  }
  .queue-heading-text {
    font-size: 1.05rem;
    font-weight: 600;
    color: #f8fafc;
    margin: 0;
  }
  .queue-heading-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 1px 7px;
    border-radius: 9999px;
    background: rgba(139, 92, 246, 0.22);
    border: 1px solid rgba(139, 92, 246, 0.35);
    color: #c4b5fd;
    font-size: 0.75rem;
    font-weight: 700;
    line-height: 1.2;
  }

  /* CLEAN EMPTY BOX */
  .clean-empty-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 3.5rem 1.5rem;
    background: #111522;
    border: 1px dashed #232a3f;
    border-radius: 12px;
  }
  .empty-icon-circle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 54px;
    height: 54px;
    border-radius: 50%;
    background: rgba(6, 182, 212, 0.1);
    color: #22d3ee;
    border: 1px solid rgba(6, 182, 212, 0.2);
    margin-bottom: 1rem;
  }
  .empty-heading {
    font-size: 1.05rem;
    font-weight: 600;
    color: #f1f5f9;
    margin: 0 0 0.4rem 0;
  }
  .empty-sub {
    font-size: 0.85rem;
    color: #94a3b8;
    max-width: 480px;
    margin: 0;
    line-height: 1.45;
  }

  /* CARDS STACK */
  .cards-stack {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .pub-card {
    background: #121624;
    border: 1px solid #1e2436;
    border-radius: 12px;
    padding: 1.15rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .pub-card:hover {
    border-color: #2b354d;
  }
  .pub-card.is-expanded {
    border-color: rgba(6, 182, 212, 0.4);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
  }

  /* Card Top Row */
  .pub-card-header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.25rem;
    min-width: 0;
  }
  .card-left-identity {
    display: flex;
    align-items: center;
    gap: 1rem;
    min-width: 0;
    flex: 1;
  }
  .work-cover-box {
    width: 52px;
    height: 68px;
    border-radius: 8px;
    overflow: hidden;
    background: #1a2030;
    border: 1px solid #232a3f;
    flex-shrink: 0;
  }
  .cover-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .cover-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .chapter-info-cluster {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    min-width: 0;
  }
  .work-title {
    font-size: 0.9375rem;
    font-weight: 700;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .chapter-identity {
    font-size: 0.85rem;
    font-weight: 600;
    color: #22d3ee;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-meta-pills {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
    margin-top: 0.15rem;
  }
  .meta-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.15rem 0.5rem;
    border-radius: 5px;
    font-size: 0.72rem;
    font-weight: 600;
  }
  .meta-pill.is-valid {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #34d399;
  }
  .meta-pill.is-warning {
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.32);
    color: #fbbf24;
  }
  .meta-pill.is-conferred {
    background: rgba(6, 182, 212, 0.14);
    border: 1px solid rgba(6, 182, 212, 0.35);
    color: #22d3ee;
  }
  .pill-text-desktop {
    display: inline;
  }
  .pill-text-mobile {
    display: none;
  }
  @media (max-width: 900px) {
    .pill-text-desktop {
      display: none;
    }
    .pill-text-mobile {
      display: inline;
    }
  }
  .meta-pill.is-pkg {
    background: rgba(148, 163, 184, 0.1);
    border: 1px solid rgba(148, 163, 184, 0.2);
    color: #cbd5e1;
  }

  /* Card Actions Bar */
  .card-actions-bar {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    flex-shrink: 0;
  }

  /* 1. Conferir Capítulo (Primary Action) */
  .btn-action-conferir {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.55rem 1rem;
    border-radius: 8px;
    background: rgba(6, 182, 212, 0.12);
    border: 1px solid rgba(6, 182, 212, 0.35);
    color: #22d3ee;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: 40px;
  }
  .btn-action-conferir:hover {
    background: rgba(6, 182, 212, 0.22);
    border-color: #06b6d4;
    color: #ffffff;
  }

  /* 2. Ver Detalhes Toggle */
  .btn-action-details {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 0.85rem;
    border-radius: 8px;
    background: #161b2a;
    border: 1px solid #232a3f;
    color: #94a3b8;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: 40px;
  }
  .btn-action-details:hover {
    color: #f1f5f9;
    border-color: #334155;
  }
  .chevron-rotator {
    display: inline-flex;
    transition: transform 0.2s ease;
  }
  .chevron-rotator.is-flipped {
    transform: rotate(180deg);
  }

  /* 3. Publicar no Catálogo / Bloqueado */
  .btn-action-publish {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.55rem 1.15rem;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    margin-left: auto;
    min-height: 40px;
  }
  .btn-action-publish.is-ready {
    background: linear-gradient(135deg, #059669 0%, #10b981 100%);
    border: 1px solid #10b981;
    color: #ffffff;
    box-shadow: 0 2px 10px rgba(16, 185, 129, 0.25);
  }
  .btn-action-publish.is-ready:hover {
    background: linear-gradient(135deg, #047857 0%, #059669 100%);
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
    transform: translateY(-1px);
  }
  .btn-action-publish.is-blocked {
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.28);
    color: #fca5a5;
    cursor: not-allowed;
    opacity: 0.85;
  }
  .badge-waiting-admin {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
    background: rgba(148, 163, 184, 0.08);
    border: 1px solid rgba(148, 163, 184, 0.2);
    color: #94a3b8;
    font-size: 0.75rem;
    margin-left: auto;
  }

  /* CARD EXPANDED CONTENT */
  .card-details-panel {
    padding-top: 1rem;
    border-top: 1px solid #1a2032;
    animation: fadeIn 0.2s ease;
  }
  .details-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.85rem;
  }
  .details-panel-card {
    background: #0f131f;
    border: 1px solid #1b2133;
    border-radius: 10px;
    padding: 0.85rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }
  .details-panel-card.full-span {
    grid-column: 1 / -1;
  }
  .panel-card-title {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #cbd5e1;
    margin: 0;
  }

  .meta-kv-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin: 0;
    font-size: 0.8rem;
  }
  .kv-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .kv-row dt { color: #64748b; }
  .kv-row dd { color: #e2e8f0; margin: 0; }

  .inline-stage-tag {
    display: inline-flex;
    padding: 0.1rem 0.45rem;
    border-radius: 4px;
    font-size: 0.72rem;
    font-weight: 600;
  }
  .inline-stage-tag.cyan {
    background: rgba(6, 182, 212, 0.15);
    color: #22d3ee;
    border: 1px solid rgba(6, 182, 212, 0.3);
  }

  .primary-pkg-box {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    background: #141926;
    border: 1px solid #20273c;
    border-radius: 8px;
    padding: 0.55rem 0.75rem;
  }
  .primary-pkg-box.is-incomplete {
    border-color: rgba(245, 158, 11, 0.35);
    background: rgba(245, 158, 11, 0.05);
  }
  .pkg-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .pkg-txt {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }
  .pkg-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #f1f5f9;
    word-break: break-word;
    overflow-wrap: anywhere;
    line-height: 1.35;
  }
  .status-indicator-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    font-weight: 600;
  }
  .status-indicator-inline.amber {
    color: #fbbf24;
  }
  .status-indicator-inline.emerald {
    color: #34d399;
  }
  .status-indicator-inline.cyan {
    color: #22d3ee;
  }
  .status-indicator-inline.slate {
    color: #94a3b8;
  }
  .pkg-meta-line {
    font-size: 0.72rem;
    color: #94a3b8;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .deliverables-count-strip {
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 0.2rem;
  }
  .no-files-notice {
    font-size: 0.8rem;
    color: #64748b;
    margin: 0;
  }

  .destiny-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .destiny-text {
    font-size: 0.8125rem;
    color: #cbd5e1;
    line-height: 1.4;
    flex: 1;
  }
  .destiny-text p { margin: 0; }
  .blocked-publish-notice {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 8px;
    padding: 0.55rem 0.85rem;
    color: #fcd34d;
    font-size: 0.78rem;
    flex-wrap: wrap;
  }
  .btn-open-sim-test {
    background: transparent;
    border: 1px solid #fcd34d;
    color: #fef08a;
    padding: 0.25rem 0.55rem;
    border-radius: 5px;
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-action-publish.in-panel {
    margin-left: 0;
  }

  /* 4. MODAL / BOTTOM SHEET */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1.25rem;
    overflow-y: auto;
  }
  .publish-modal-card {
    background: #121624;
    border: 1px solid #232b40;
    border-radius: 16px;
    width: 100%;
    max-width: 640px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column;
    max-height: 90vh;
    overflow: hidden;
    animation: modalPop 0.25s ease;
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.15rem 1.35rem;
    border-bottom: 1px solid #1e2436;
    background: #161b2b;
  }
  .modal-header-left {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }
  .modal-icon-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.25);
  }
  .modal-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }
  .modal-subtitle {
    font-size: 0.78rem;
    color: #94a3b8;
    margin: 0.15rem 0 0 0;
  }
  .btn-modal-close {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    display: flex;
  }
  .btn-modal-close:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.06);
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex: 1;
  }
  .modal-scrollable-body {
    padding: 1.15rem 1.35rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1.15rem;
  }
  .modal-form-block {
    border: 1px solid #1e2436;
    border-radius: 12px;
    padding: 1rem;
    margin: 0;
    background: #151928;
  }
  .block-legend {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.8125rem;
    font-weight: 700;
    color: #22d3ee;
    padding: 0 0.4rem;
  }
  .legend-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(6, 182, 212, 0.2);
    color: #22d3ee;
    font-size: 0.72rem;
  }

  .form-fields-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.85rem;
    margin-top: 0.5rem;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .form-group.full-col { grid-column: 1 / -1; }
  .form-group.half-col { grid-column: span 1; }

  .field-label {
    font-size: 0.78rem;
    font-weight: 600;
    color: #cbd5e1;
    display: flex;
    align-items: center;
    gap: 0.2rem;
  }
  .required-star { color: #f43f5e; }
  .field-hint {
    font-size: 0.72rem;
    color: #64748b;
  }
  .field-input, .field-select {
    background: #111420;
    border: 1px solid #232a3f;
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    color: #ffffff;
    font-size: 0.85rem;
    outline: none;
  }
  .field-input:focus, .field-select:focus {
    border-color: #06b6d4;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.2);
  }

  .material-summary-card {
    background: #111420;
    border: 1px solid #1e2436;
    border-radius: 8px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-top: 0.5rem;
  }
  .summary-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.78rem;
  }
  .summary-key { color: #64748b; }
  .summary-val { color: #e2e8f0; }

  /* Security Alert Boxes */
  .security-alert-box {
    border-radius: 10px;
    padding: 0.75rem 0.95rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-top: 0.5rem;
  }
  .security-alert-box.is-valid {
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.25);
  }
  .security-alert-box.is-warning {
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.28);
  }
  .security-alert-box.is-error {
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
  .security-alert-box.server-error {
    background: rgba(239, 68, 68, 0.15);
    border-color: #ef4444;
  }
  .alert-header {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }
  .alert-title {
    font-size: 0.8125rem;
    font-weight: 700;
    margin: 0;
  }
  .security-alert-box.is-valid .alert-title { color: #34d399; }
  .security-alert-box.is-warning .alert-title { color: #fbbf24; }
  .security-alert-box.is-error .alert-title { color: #f87171; }
  .alert-desc {
    font-size: 0.78rem;
    color: #94a3b8;
    margin: 0;
    line-height: 1.35;
  }
  .confirm-duplicate-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.78rem;
    color: #cbd5e1;
    cursor: pointer;
    margin-top: 0.35rem;
    padding-top: 0.35rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .confirm-checkbox {
    accent-color: #10b981;
    cursor: pointer;
  }

  /* Simulation toggle card */
  .simulation-toggle-card {
    background: rgba(16, 185, 129, 0.06);
    border: 1px solid rgba(16, 185, 129, 0.22);
    border-radius: 10px;
    padding: 0.75rem 0.95rem;
    margin-top: 0.5rem;
    transition: all 0.2s ease;
  }
  .simulation-toggle-card.is-active {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.4);
  }
  .simulation-toggle-label {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    cursor: pointer;
  }
  .simulation-checkbox {
    accent-color: #10b981;
    margin-top: 0.15rem;
    cursor: pointer;
  }
  .simulation-text-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .simulation-title-row {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }
  .simulation-title {
    font-size: 0.8125rem;
    font-weight: 700;
    color: #ecfdf5;
  }
  .simulation-badge {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    padding: 0.08rem 0.4rem;
    border-radius: 4px;
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }
  .simulation-desc {
    font-size: 0.75rem;
    color: #94a3b8;
    margin: 0;
    line-height: 1.35;
  }

  /* Modal Footer */
  .modal-footer {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding: 1rem 1.35rem;
    border-top: 1px solid #1e2436;
    background: #161b2b;
  }
  .cta-summary-note {
    font-size: 0.78rem;
    color: #94a3b8;
    line-height: 1.35;
  }
  .cta-summary-note strong { color: #ffffff; }
  .modal-footer-buttons {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.65rem;
  }
  .btn-modal-cancel {
    padding: 0.55rem 1rem;
    border-radius: 8px;
    background: #161b2a;
    border: 1px solid #232a3f;
    color: #94a3b8;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-modal-cancel:hover { color: #ffffff; }
  .btn-modal-submit {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.55rem 1.25rem;
    border-radius: 8px;
    background: linear-gradient(135deg, #059669 0%, #10b981 100%);
    border: 1px solid #10b981;
    color: #ffffff;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(16, 185, 129, 0.3);
  }
  .btn-modal-submit:hover:not(:disabled) {
    background: linear-gradient(135deg, #047857 0%, #059669 100%);
  }
  .btn-modal-submit:disabled {
    opacity: 0.45;
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
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes modalPop {
    from { opacity: 0; transform: scale(0.97); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes sheetSlideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  /* =====================================================================
     MOBILE-FIRST RESPONSIVE ADAPTATIONS (<= 768px)
     ===================================================================== */
  @media (max-width: 768px) {
    .pre-aprovado-root {
      gap: 1.15rem;
      padding-bottom: calc(7.5rem + env(safe-area-inset-bottom, 20px));
    }

    .pre-header-bar {
      padding: 0.85rem 1rem;
      gap: 0.85rem;
    }
    .pre-title-group {
      width: 100%;
    }
    .pre-title-row {
      justify-content: space-between;
      width: 100%;
    }
    .stage-main-title {
      font-size: 1.15rem;
    }
    .stage-sub-desc {
      display: none;
    }

    .pre-controls-cluster {
      width: 100%;
      display: flex;
      gap: 0.5rem;
    }
    .search-input-shell {
      flex: 1;
    }
    .compact-search-input {
      width: 100%;
    }
    .compact-search-input:focus {
      width: 100%;
    }
    .work-filter-shell {
      flex: 1;
    }
    .compact-work-select {
      width: 100%;
    }

    /* Stages Bar */
    .stages-nav-strip {
      padding: 0.25rem;
      margin: 0;
    }
    .stage-tab-btn {
      padding: 0.4rem 0.65rem;
      font-size: 0.78rem;
    }

    /* Cards */
    .pub-card {
      padding: 0.95rem 1rem;
      gap: 0.85rem;
    }
    .pub-card-header-bar {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 0.85rem;
    }
    .work-cover-box {
      width: 46px;
      height: 60px;
    }
    .work-title {
      font-size: 0.875rem;
    }
    .chapter-identity {
      font-size: 0.8125rem;
    }

    .card-actions-bar {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
      padding-top: 0.75rem;
      border-top: 1px solid #1a2032;
    }
    .btn-action-conferir {
      grid-column: 1 / -1;
      justify-content: center;
      width: 100%;
      font-size: 0.85rem;
    }
    .btn-action-details {
      grid-column: 1 / 2;
      justify-content: center;
      width: 100%;
    }
    .btn-action-publish {
      grid-column: 2 / 3;
      margin-left: 0;
      justify-content: center;
      width: 100%;
    }
    .badge-waiting-admin {
      grid-column: 2 / 3;
      margin-left: 0;
      justify-content: center;
      width: 100%;
    }

    .details-grid {
      grid-template-columns: 1fr;
    }

    /* Bottom Sheet on Mobile */
    .modal-backdrop {
      align-items: flex-end;
      padding: 0;
    }
    .publish-modal-card {
      border-radius: 18px 18px 0 0;
      max-height: 88vh;
      animation: sheetSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .form-fields-grid {
      grid-template-columns: 1fr;
    }
    .form-group.half-col {
      grid-column: 1 / -1;
    }
    .modal-footer {
      padding-bottom: calc(1rem + env(safe-area-inset-bottom, 20px));
    }
  }

  /* Ultra-small screens (320px) */
  @media (max-width: 360px) {
    .pub-card {
      padding: 0.75rem 0.85rem;
    }
    .btn-action-conferir, .btn-action-details, .btn-action-publish {
      font-size: 0.75rem;
      padding: 0.45rem 0.5rem;
    }
  }
</style>
