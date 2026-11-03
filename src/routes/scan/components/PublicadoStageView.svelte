<script lang="ts">
  import { onMount } from 'svelte';
  import {
    BookOpen,
    ExternalLink,
    ChevronDown,
    ChevronUp,
    Search,
    Filter,
    Calendar,
    User,
    Clock,
    ArrowUpDown,
    CheckCircle2,
    Layers,
    Globe,
    X,
    ChevronLeft,
    ChevronRight,
    Info,
    Sparkles,
    Check
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
    chapterTimeline?: any[];
    currentUserId?: string;
    userRole?: string;
    userPositions?: any[];
    seenStages?: any[];
    isOwnerOrAdmin?: boolean;
    scanId?: string;
    scanName?: string;
    onSelectStage?: (slug: string) => void;
    onOpenChapter?: (chapter: any) => void;
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
    chapterTimeline = [],
    currentUserId = '',
    userRole = 'MEMBER',
    userPositions = [],
    seenStages = [],
    isOwnerOrAdmin = false,
    scanId = '',
    scanName = 'Project Nox',
    onSelectStage = () => {},
    onOpenChapter = () => {}
  }: Props = $props();

  // Canonical stages in editorial pipeline order
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

  // Calculate discrete counts for operational stages only (NEVER for publicado)
  let canonicalCounts = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const st of CANONICAL_STAGES) counts[st.slug] = 0;

    if (chapterStages && chapterStages.length > 0) {
      for (const cs of chapterStages) {
        const slug = cs.stage?.slug || '';
        for (const st of CANONICAL_STAGES) {
          // Never count publicado
          if (st.slug === 'publicado') continue;
          if (matchesStageSlug(slug, st.slug)) {
            if ((cs.status === 'AVAILABLE' || cs.status === 'REWORK') && !cs.assigned_to) {
              counts[st.slug]++;
            }
          }
        }
      }
    }

    // Pré-aprovado count
    if (chapters && chapters.length > 0) {
      const readyCount = chapters.filter((c: any) =>
        c.status === 'IN_PRODUCTION' &&
        matchesStageSlug(c.current_stage_slug || '', 'pre_aprovado')
      ).length;
      counts['pre_aprovado'] = readyCount;
    }

    // Explicitly zero for publicado
    counts['publicado'] = 0;
    return counts;
  });

  const OFFICIAL_SITE_ORIGIN = 'https://projectnox.org';

  function isValidChapterUuid(id?: string | null): boolean {
    if (!id || typeof id !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  }

  function getOfficialReaderUrl(item: any): string | null {
    const targetId = item?.targetChapterId || (isValidChapterUuid(item?.id) ? item.id : null);
    if (targetId && isValidChapterUuid(targetId)) {
      return `${OFFICIAL_SITE_ORIGIN}/ler/${targetId}`;
    }
    return null;
  }

  // Query, filter, sort and pagination state
  let searchQuery = $state('');
  let filterWorkId = $state<string>('ALL');
  let sortOption = $state<'NEWEST' | 'OLDEST' | 'NUMBER_DESC' | 'NUMBER_ASC'>('NEWEST');
  let currentPage = $state(1);
  const itemsPerPage = 8;

  // Expanded card tracking
  let expandedCards = $state<Record<string, boolean>>({});

  function toggleCard(id: string) {
    expandedCards[id] = !expandedCards[id];
  }

  // Homologation Fixture Modes (Isolated preview testing without DB mutations)
  type FixtureMode = 'REAL' | 'ONE' | 'FIVE' | 'MULTI' | 'EMPTY';
  let fixtureMode = $state<FixtureMode>('REAL');

  onMount(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const fix = params.get('fixture')?.toUpperCase();
      if (fix === 'ONE' || fix === 'SINGLE') fixtureMode = 'ONE';
      else if (fix === 'FIVE') fixtureMode = 'FIVE';
      else if (fix === 'MULTI' || fix === 'MANY') fixtureMode = 'MULTI';
      else if (fix === 'EMPTY' || fix === 'ZERO') fixtureMode = 'EMPTY';
    }
  });

  // Demo fixture dataset for preview visual homologation
  const DEMO_FIXTURES: Record<Exclude<FixtureMode, 'REAL'>, any[]> = {
    ONE: [
      {
        id: 'demo-ch-84',
        productionChapterId: '9cb8d2dd-d009-478f-ad0f-01db3661a1dd',
        targetChapterId: 'e9f6bcb6-d84d-4294-ae8a-cfdbddfbbcbc',
        chapterNumber: 84,
        chapterTitle: 'Homologação Editorial Concluída',
        workId: 'c08a2531-7bf3-4324-979a-f7de0e66a62d',
        workTitle: 'Céu Distante',
        workSlug: 'distant-sky',
        coverId: '851717ba-9e13-4c54-84b7-225d652c25f0',
        publishedAt: '2026-10-30T23:49:07.030Z',
        publishedBy: 'Awerkori (Admin)',
        typesetVersion: 2,
        conferenceConfirmedBy: 'Awerkori',
        conferenceConfirmedAt: '2026-10-30T23:45:00.000Z',
        isDemo: true,
        originType: 'PRODUCTION_PIPELINE'
      }
    ],
    FIVE: [
      {
        id: 'demo-ch-84',
        productionChapterId: '9cb8d2dd-d009-478f-ad0f-01db3661a1dd',
        targetChapterId: 'e9f6bcb6-d84d-4294-ae8a-cfdbddfbbcbc',
        chapterNumber: 84,
        chapterTitle: 'Homologação Editorial Concluída',
        workId: 'c08a2531-7bf3-4324-979a-f7de0e66a62d',
        workTitle: 'Céu Distante',
        workSlug: 'distant-sky',
        coverId: '851717ba-9e13-4c54-84b7-225d652c25f0',
        publishedAt: '2026-10-30T23:49:07.030Z',
        publishedBy: 'Awerkori (Admin)',
        typesetVersion: 2,
        conferenceConfirmedBy: 'Awerkori',
        conferenceConfirmedAt: '2026-10-30T23:45:00.000Z',
        isDemo: true,
        originType: 'PRODUCTION_PIPELINE'
      },
      {
        id: 'demo-ch-83',
        productionChapterId: null,
        targetChapterId: '9f1064fe-6f24-4681-a72e-b49f8b76266e',
        chapterNumber: 83,
        chapterTitle: 'O Retorno das Sombras',
        workId: 'c08a2531-7bf3-4324-979a-f7de0e66a62d',
        workTitle: 'Céu Distante',
        workSlug: 'distant-sky',
        coverId: '851717ba-9e13-4c54-84b7-225d652c25f0',
        publishedAt: '2026-09-22T21:20:04.846Z',
        publishedBy: 'Thiago (Líder)',
        typesetVersion: 1,
        conferenceConfirmedBy: null,
        conferenceConfirmedAt: null,
        isDemo: true,
        originType: 'CATALOG_DIRECT'
      },
      {
        id: 'demo-sl-179',
        productionChapterId: 'prod-sl-179',
        targetChapterId: 'cat-sl-179',
        chapterNumber: 179,
        chapterTitle: 'O Monarca das Sombras Desperta Completamente Para a Batalha Final',
        workId: 'solo-leveling-id',
        workTitle: 'Solo Leveling',
        workSlug: 'solo-leveling',
        coverId: 'cov-sl',
        publishedAt: '2026-09-15T18:30:00.000Z',
        publishedBy: 'Pristam (QC Lead)',
        typesetVersion: 3,
        conferenceConfirmedBy: 'Pristam',
        conferenceConfirmedAt: '2026-09-15T18:15:00.000Z',
        isDemo: true,
        originType: 'PRODUCTION_PIPELINE'
      },
      {
        id: 'demo-sl-178',
        productionChapterId: 'prod-sl-178',
        targetChapterId: 'cat-sl-178',
        chapterNumber: 178,
        chapterTitle: 'Reunião dos Caçadores',
        workId: 'solo-leveling-id',
        workTitle: 'Solo Leveling',
        workSlug: 'solo-leveling',
        coverId: 'cov-sl',
        publishedAt: '2026-09-08T14:10:00.000Z',
        publishedBy: 'Awerkori (Admin)',
        typesetVersion: 1,
        conferenceConfirmedBy: 'Awerkori',
        conferenceConfirmedAt: '2026-09-08T13:55:00.000Z',
        isDemo: true,
        originType: 'PRODUCTION_PIPELINE'
      },
      {
        id: 'demo-orv-120',
        productionChapterId: 'prod-orv-120',
        targetChapterId: 'cat-orv-120',
        chapterNumber: 120,
        chapterTitle: 'Ponto de Vista do Leitor Onisciente — O Quinto Cenário Principal',
        workId: 'orv-id',
        workTitle: 'Omniscient Reader',
        workSlug: 'omniscient-reader',
        coverId: 'cov-orv',
        publishedAt: '2026-08-30T11:00:00.000Z',
        publishedBy: 'Miakasan',
        typesetVersion: 2,
        conferenceConfirmedBy: 'Miakasan',
        conferenceConfirmedAt: '2026-08-30T10:40:00.000Z',
        isDemo: true,
        originType: 'PRODUCTION_PIPELINE'
      }
    ],
    MULTI: Array.from({ length: 24 }, (_, i) => {
      const chNum = 100 - i;
      const isDistantSky = i % 3 === 0;
      const isSoloLeveling = i % 3 === 1;
      const workTitle = isDistantSky ? 'Céu Distante' : isSoloLeveling ? 'Solo Leveling' : 'Omniscient Reader';
      const workSlug = isDistantSky ? 'distant-sky' : isSoloLeveling ? 'solo-leveling' : 'omniscient-reader';
      const coverId = isDistantSky ? '851717ba-9e13-4c54-84b7-225d652c25f0' : 'cover-mock';
      const daysAgo = i * 4 + 1;
      const date = new Date(Date.now() - daysAgo * 86400000).toISOString();
      return {
        id: `demo-multi-${chNum}`,
        productionChapterId: `prod-${chNum}`,
        targetChapterId: `cat-${chNum}`,
        chapterNumber: chNum,
        chapterTitle: i % 2 === 0 ? `Capítulo Especial de Lançamento #${chNum} — Arco da Conclusão e Revelações` : `Capítulo ${chNum}`,
        workId: `work-${workSlug}`,
        workTitle,
        workSlug,
        coverId,
        publishedAt: date,
        publishedBy: i % 4 === 0 ? 'Awerkori (Admin)' : i % 4 === 1 ? 'Thiago (Líder)' : 'Pristam (QC)',
        typesetVersion: (i % 3) + 1,
        conferenceConfirmedBy: 'Awerkori',
        conferenceConfirmedAt: date,
        isDemo: true,
        originType: i % 5 === 0 ? 'CATALOG_DIRECT' : 'PRODUCTION_PIPELINE'
      };
    }),
    EMPTY: []
  };

  // Compile real published chapters from database props
  let realPublishedItems = $derived.by(() => {
    const list: any[] = [];
    const seenTargetIds = new Set<string>();

    // 1. From scan_production_chapters with status = 'PUBLISHED'
    for (const ch of chapters) {
      if (ch.status === 'PUBLISHED') {
        const targetId = ch.target_chapter_id || ch.id;
        seenTargetIds.add(targetId);

        // Find work details
        const work = ch.work || works.find((w: any) => w.id === ch.work_id);

        // Find publication timeline event
        const pubEvent = chapterTimeline.find((tl: any) =>
          tl.production_chapter_id === ch.id &&
          (tl.event_type === 'CHAPTER_PUBLISHED' || tl.event_type === 'CHAPTER_PUBLISHED_SIMULATION')
        );

        // Find conference in checklist state
        const confState = ch.checklist_state?.editorial_conference;

        list.push({
          id: ch.id,
          productionChapterId: ch.id,
          targetChapterId: targetId,
          chapterNumber: Number(ch.chapter_number),
          chapterTitle: ch.chapter_label || ch.chapter_title || '',
          workId: work?.id || ch.work_id,
          workTitle: work?.title || 'Obra Desconhecida',
          workSlug: work?.slug || '',
          coverId: work?.cover_id || null,
          publishedAt: ch.updated_at || ch.created_at || new Date().toISOString(),
          publishedBy: pubEvent?.user_name || 'Equipe Editorial',
          typesetVersion: ch.publication_version || pubEvent?.details?.version || 1,
          conferenceConfirmedBy: confState?.confirmed_by_name || (confState?.confirmed_at ? 'Administrador' : null),
          conferenceConfirmedAt: confState?.confirmed_at || null,
          isDemo: false,
          originType: 'PRODUCTION_PIPELINE'
        });
      }
    }

    // 2. From catalogChapters (chapter_scans) not already matched by a production chapter
    for (const cat of catalogChapters) {
      if (!seenTargetIds.has(cat.id)) {
        const work = cat.works || works.find((w: any) => w.id === cat.work_id);
        list.push({
          id: cat.id,
          productionChapterId: null,
          targetChapterId: cat.id,
          chapterNumber: Number(cat.number),
          chapterTitle: cat.title || '',
          workId: work?.id || cat.work_id,
          workTitle: work?.title || 'Obra Desconhecida',
          workSlug: work?.slug || '',
          coverId: work?.cover_id || null,
          publishedAt: cat.published_at || cat.created_at || new Date().toISOString(),
          publishedBy: 'Catálogo Oficial',
          typesetVersion: 1,
          conferenceConfirmedBy: null,
          conferenceConfirmedAt: null,
          isDemo: false,
          originType: 'CATALOG_DIRECT'
        });
        seenTargetIds.add(cat.id);
      }
    }

    return list;
  });

  // Active items derived from selected mode
  let rawActiveItems = $derived.by(() => {
    if (fixtureMode === 'REAL') {
      return realPublishedItems;
    }
    return DEMO_FIXTURES[fixtureMode] || [];
  });

  // Filter and Search
  let filteredItems = $derived.by(() => {
    let result = [...rawActiveItems];

    // Filter by work
    if (filterWorkId !== 'ALL') {
      result = result.filter(item => item.workId === filterWorkId || item.workSlug === filterWorkId);
    }

    // Search by work title, chapter number, or chapter title
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item => {
        const matchWork = item.workTitle.toLowerCase().includes(q);
        const matchNum = String(item.chapterNumber).includes(q) || `cap. ${item.chapterNumber}`.includes(q) || `cap ${item.chapterNumber}`.includes(q);
        const matchTitle = (item.chapterTitle || '').toLowerCase().includes(q);
        return matchWork || matchNum || matchTitle;
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortOption === 'NEWEST') {
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      }
      if (sortOption === 'OLDEST') {
        return new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
      }
      if (sortOption === 'NUMBER_DESC') {
        return b.chapterNumber - a.chapterNumber;
      }
      if (sortOption === 'NUMBER_ASC') {
        return a.chapterNumber - b.chapterNumber;
      }
      return 0;
    });

    return result;
  });

  // Pagination
  let totalPages = $derived(Math.max(1, Math.ceil(filteredItems.length / itemsPerPage)));
  let paginatedItems = $derived.by(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  });

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  // Work options for filter dropdown
  let distinctWorks = $derived.by(() => {
    const map = new Map<string, string>();
    for (const w of works) {
      if (w?.id && w?.title) map.set(w.id, w.title);
    }
    for (const it of rawActiveItems) {
      if (it?.workId && it?.workTitle && !map.has(it.workId)) {
        map.set(it.workId, it.workTitle);
      }
    }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  });

  function formatDateTime(iso: string): string {
    if (!iso) return 'Data não informada';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  }

  function formatRelativeDate(iso: string): string {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diffSec < 60) return 'Agora mesmo';
      if (diffSec < 3600) return `Há ${Math.floor(diffSec / 60)} min`;
      if (diffSec < 86400) return `Há ${Math.floor(diffSec / 3600)} h`;
      const days = Math.floor(diffSec / 86400);
      if (days === 1) return 'Ontem';
      if (days < 30) return `Há ${days} dias`;
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch {
      return '';
    }
  }

  let stagesScrollContainer: HTMLElement | null = $state(null);
</script>

<div class="publicado-view-root">
  <!-- HOMOLOGATION PREVIEW BAR (Isolated testing fixture) -->
  <aside class="homologation-toolbar" aria-label="Controles de homologação preview">
    <div class="homologation-inner">
      <div class="homologation-tag">
        <Sparkles size={13} class="sparkle-ico" />
        <span class="homologation-lbl">Homologação Visual:</span>
      </div>
      <div class="homologation-modes" role="group" aria-label="Modos de exibição">
        <button
          type="button"
          class="mode-btn"
          class:is-selected={fixtureMode === 'REAL'}
          onclick={() => { fixtureMode = 'REAL'; currentPage = 1; }}
          title="Exibir registros reais do banco da scan"
        >
          Dados Reais ({realPublishedItems.length})
        </button>
        <button
          type="button"
          class="mode-btn"
          class:is-selected={fixtureMode === 'ONE'}
          onclick={() => { fixtureMode = 'ONE'; currentPage = 1; }}
          title="Simular 1 capítulo publicado de teste"
        >
          1 Capítulo
        </button>
        <button
          type="button"
          class="mode-btn"
          class:is-selected={fixtureMode === 'FIVE'}
          onclick={() => { fixtureMode = 'FIVE'; currentPage = 1; }}
          title="Simular 5 capítulos com múltiplas obras"
        >
          5 Capítulos
        </button>
        <button
          type="button"
          class="mode-btn"
          class:is-selected={fixtureMode === 'MULTI'}
          onclick={() => { fixtureMode = 'MULTI'; currentPage = 1; }}
          title="Simular dezenas de capítulos com paginação"
        >
          Dezenas (24)
        </button>
        <button
          type="button"
          class="mode-btn"
          class:is-selected={fixtureMode === 'EMPTY'}
          onclick={() => { fixtureMode = 'EMPTY'; currentPage = 1; }}
          title="Simular histórico vazio"
        >
          Vazio
        </button>
      </div>
    </div>
  </aside>

  <!-- 1. COMPACT STAGE HEADER -->
  <header class="publicado-header-bar">
    <div class="publicado-title-group">
      <div class="title-with-stat">
        <h1 class="stage-main-title">Publicado</h1>
        <span class="discrete-stat-pill">
          {rawActiveItems.length} {rawActiveItems.length === 1 ? 'capítulo lançado' : 'capítulos lançados'}
        </span>
      </div>
      <p class="stage-sub-desc">Histórico de capítulos lançados pela scan.</p>
    </div>

    <!-- Controls Cluster: Search, Work Filter, Sort -->
    <div class="publicado-controls-cluster">
      <div class="search-input-shell">
        <Search size={14} class="search-ico" />
        <input
          type="search"
          bind:value={searchQuery}
          placeholder="Buscar por obra ou capítulo..."
          class="compact-search-input"
          aria-label="Buscar capítulo publicado"
        />
        {#if searchQuery}
          <button
            type="button"
            class="btn-clear-q"
            onclick={() => (searchQuery = '')}
            aria-label="Limpar busca"
          >
            <X size={13} />
          </button>
        {/if}
      </div>

      {#if distinctWorks.length > 1}
        <div class="work-filter-shell">
          <Filter size={13} class="filter-ico" />
          <select
            bind:value={filterWorkId}
            class="compact-work-select"
            aria-label="Filtrar por obra"
          >
            <option value="ALL">Todas as obras</option>
            {#each distinctWorks as w (w.id)}
              <option value={w.id}>{w.title}</option>
            {/each}
          </select>
        </div>
      {/if}

      <div class="sort-select-shell">
        <ArrowUpDown size={13} class="sort-ico" />
        <select
          bind:value={sortOption}
          class="compact-sort-select"
          aria-label="Ordenar publicações"
        >
          <option value="NEWEST">Mais recentes</option>
          <option value="OLDEST">Mais antigos</option>
          <option value="NUMBER_DESC">Maior capítulo</option>
          <option value="NUMBER_ASC">Menor capítulo</option>
        </select>
      </div>
    </div>
  </header>

  <!-- 2. STAGE SWITCHER WITH DISCRETE COUNTERS (NO BADGE ON PUBLICADO) -->
  <nav class="stages-nav-strip" aria-label="Navegação de etapas do pipeline">
    <div class="stages-track" bind:this={stagesScrollContainer}>
      {#each CANONICAL_STAGES as st (st.slug)}
        {@const isActive = matchesStageSlug(st.slug, 'publicado')}
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
          <!-- Strictly omit any count badge for Publicado -->
          {#if count > 0 && !matchesStageSlug(st.slug, 'publicado')}
            <span class="stage-tab-count">{count}</span>
          {/if}
        </button>
      {/each}
    </div>
  </nav>

  <!-- 3. MAIN HISTORY SECTION -->
  <section class="history-main-section" aria-labelledby="section-heading-history">
    <div class="history-header-row">
      <div class="history-heading-lockup">
        <div class="history-heading-icon">
          <BookOpen size={16} />
        </div>
        <h2 id="section-heading-history" class="history-heading-text">Histórico de Publicações</h2>
        {#if filteredItems.length > 0}
          <span class="history-heading-count">{filteredItems.length}</span>
        {/if}
      </div>

      {#if searchQuery || filterWorkId !== 'ALL'}
        <div class="active-filter-tag">
          <span>Filtrado: {filteredItems.length} de {rawActiveItems.length}</span>
          <button
            type="button"
            class="btn-reset-filters"
            onclick={() => { searchQuery = ''; filterWorkId = 'ALL'; }}
          >
            Limpar
          </button>
        </div>
      {/if}
    </div>

    <!-- CARDS LIST -->
    {#if paginatedItems.length > 0}
      <div class="published-cards-list">
        {#each paginatedItems as item (item.id)}
          {@const isExpanded = !!expandedCards[item.id]}
          <article class="published-card" class:is-expanded={isExpanded}>
            <div class="card-summary-row">
              <!-- Cover image thumbnail -->
              <div class="cover-thumb-wrapper">
                {#if item.coverId && item.coverId !== 'cover-mock'}
                  <img
                    src="/media/{item.coverId}"
                    alt="Capa de {item.workTitle}"
                    class="cover-thumb-img"
                    loading="lazy"
                  />
                {:else}
                  <div class="cover-thumb-fallback">
                    <BookOpen size={20} class="fallback-book-ico" />
                  </div>
                {/if}
              </div>

              <!-- Main Card Information -->
              <div class="card-body-col">
                <div class="work-and-status-row">
                  <span class="work-title-text" title={item.workTitle}>{item.workTitle}</span>
                  <div class="status-badge-wrapper">
                    <span class="published-status-badge">
                      <Check size={11} class="check-ico" />
                      Publicado
                    </span>
                    {#if item.isDemo}
                      <span class="demo-pill-badge" title="Material isolado para homologação visual">Homologação</span>
                    {/if}
                  </div>
                </div>

                <div class="chapter-headline-row">
                  <h3 class="chapter-display-title">
                    <span class="cap-number-tag">Cap. {item.chapterNumber}</span>
                    {#if item.chapterTitle}
                      <span class="cap-sep">—</span>
                      <span class="cap-label-text">{item.chapterTitle}</span>
                    {/if}
                  </h3>
                </div>

                <div class="meta-inline-strip">
                  <span class="meta-item" title="Data da publicação">
                    <Calendar size={12} class="meta-ico" />
                    <span>{formatDateTime(item.publishedAt)}</span>
                    <span class="meta-rel-time">({formatRelativeDate(item.publishedAt)})</span>
                  </span>
                  {#if item.publishedBy}
                    <span class="meta-sep" aria-hidden="true">•</span>
                    <span class="meta-item" title="Responsável pela publicação">
                      <User size={12} class="meta-ico" />
                      <span>{item.publishedBy}</span>
                    </span>
                  {/if}
                  {#if item.originType === 'CATALOG_DIRECT'}
                    <span class="meta-sep" aria-hidden="true">•</span>
                    <span class="meta-origin-badge" title="Publicação registrada no catálogo">Catálogo Direto</span>
                  {/if}
                </div>
              </div>

              <!-- Action Cluster -->
              <div class="card-actions-cluster">
                <!-- Primary Action: Ler no site oficial (projectnox.org) -->
                {#if getOfficialReaderUrl(item)}
                  <a
                    href={getOfficialReaderUrl(item)}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-read-chapter"
                    title="Abrir capítulo no leitor oficial do catálogo em projectnox.org"
                  >
                    <BookOpen size={14} class="action-ico" />
                    <span>Ler capítulo</span>
                    <ExternalLink size={12} class="ext-ico" />
                  </a>
                {:else}
                  <button
                    type="button"
                    class="btn-read-chapter is-demo-disabled"
                    disabled
                    title="Capítulo demonstrativo em homologação — não publicado no catálogo oficial"
                  >
                    <BookOpen size={14} class="action-ico" />
                    <span>Demonstração</span>
                  </button>
                {/if}

                <!-- Secondary Action: Ver detalhes históricos -->
                <button
                  type="button"
                  class="btn-toggle-details"
                  class:is-active={isExpanded}
                  onclick={() => toggleCard(item.id)}
                  aria-expanded={isExpanded}
                  aria-controls="details-{item.id}"
                >
                  <span>{isExpanded ? 'Ocultar' : 'Ver detalhes'}</span>
                  {#if isExpanded}
                    <ChevronUp size={14} />
                  {:else}
                    <ChevronDown size={14} />
                  {/if}
                </button>
              </div>
            </div>

            <!-- EXPANDED DETAILS ACCORDION -->
            {#if isExpanded}
              <div id="details-{item.id}" class="card-expanded-panel">
                <div class="details-grid">
                  <!-- Col 1: Publicação -->
                  <div class="details-section">
                    <h4 class="details-section-title">
                      <Globe size={13} class="section-title-ico" />
                      Publicação
                    </h4>
                    <dl class="details-dl">
                      <div class="dl-row">
                        <dt>Data e Horário:</dt>
                        <dd>{formatDateTime(item.publishedAt)}</dd>
                      </div>
                      <div class="dl-row">
                        <dt>Responsável:</dt>
                        <dd>{item.publishedBy || 'Não especificado'}</dd>
                      </div>
                      <div class="dl-row">
                        <dt>Obra Associada:</dt>
                        <dd>
                          {#if item.workSlug && !item.isDemo}
                            <a
                              href="https://projectnox.org/obra/{item.workSlug}"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="catalog-link-work"
                              title="Ver obra no catálogo oficial de projectnox.org"
                            >
                              {item.workTitle}
                              <ExternalLink size={10} />
                            </a>
                          {:else}
                            <span>{item.workTitle}</span>
                          {/if}
                        </dd>
                      </div>
                      <div class="dl-row">
                        <dt>Número Efetivo:</dt>
                        <dd>Capítulo #{item.chapterNumber}</dd>
                      </div>
                      <div class="dl-row">
                        <dt>Link no Catálogo:</dt>
                        <dd>
                          {#if getOfficialReaderUrl(item)}
                            <a
                              href={getOfficialReaderUrl(item)}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="catalog-link-mono"
                              title="Abrir URL oficial em projectnox.org"
                            >
                              https://projectnox.org/ler/{item.targetChapterId || item.id}
                              <ExternalLink size={10} />
                            </a>
                          {:else}
                            <span class="catalog-link-mono is-demo-label" title="Item de demonstração visual isolada">
                              Demonstração (sem publicação no catálogo oficial)
                            </span>
                          {/if}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <!-- Col 2: Origem Editorial -->
                  <div class="details-section">
                    <h4 class="details-section-title">
                      <Layers size={13} class="section-title-ico" />
                      Origem Editorial
                    </h4>
                    <dl class="details-dl">
                      <div class="dl-row">
                        <dt>Scan Responsável:</dt>
                        <dd>{scanName}</dd>
                      </div>
                      <div class="dl-row">
                        <dt>ID da Produção:</dt>
                        <dd class="mono-text">{item.productionChapterId || 'Lançamento Catálogo'}</dd>
                      </div>
                      <div class="dl-row">
                        <dt>Versão Typeset:</dt>
                        <dd>v{item.typesetVersion || 1} {item.typesetVersion > 1 ? '(Revisada)' : '(Original)'}</dd>
                      </div>
                      <div class="dl-row">
                        <dt>Conferência Final:</dt>
                        <dd>
                          {#if item.conferenceConfirmedBy}
                            <span class="conf-badge-ok">
                              <CheckCircle2 size={11} />
                              Concluída por {item.conferenceConfirmedBy}
                            </span>
                          {:else if item.originType === 'CATALOG_DIRECT'}
                            <span class="conf-badge-neutral">Histórico de Catálogo</span>
                          {:else}
                            <span class="conf-badge-neutral">Conferência Editorial Realizada</span>
                          {/if}
                        </dd>
                      </div>
                      <div class="dl-row">
                        <dt>Status no Sistema:</dt>
                        <dd class="status-verified-text">
                          <Check size={12} />
                          Disponível no Leitor Oficial
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            {/if}
          </article>
        {/each}
      </div>

      <!-- PAGINATION CONTROLS -->
      {#if totalPages > 1}
        <nav class="pagination-bar" aria-label="Navegação de páginas do histórico">
          <div class="pagination-info">
            Página <span class="page-current">{currentPage}</span> de <span class="page-total">{totalPages}</span>
            <span class="pagination-range">
              ({(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredItems.length)} de {filteredItems.length})
            </span>
          </div>
          <div class="pagination-buttons">
            <button
              type="button"
              class="page-nav-btn"
              disabled={currentPage <= 1}
              onclick={() => goToPage(currentPage - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft size={14} />
              <span class="nav-btn-text">Anterior</span>
            </button>

            <div class="page-number-strip">
              {#each Array.from({ length: totalPages }, (_, i) => i + 1) as p}
                {#if p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)}
                  <button
                    type="button"
                    class="page-number-btn"
                    class:is-active={p === currentPage}
                    onclick={() => goToPage(p)}
                  >
                    {p}
                  </button>
                {:else if p === currentPage - 2 || p === currentPage + 2}
                  <span class="page-ellipsis" aria-hidden="true">…</span>
                {/if}
              {/each}
            </div>

            <button
              type="button"
              class="page-nav-btn"
              disabled={currentPage >= totalPages}
              onclick={() => goToPage(currentPage + 1)}
              aria-label="Próxima página"
            >
              <span class="nav-btn-text">Próxima</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </nav>
      {/if}
    {:else}
      <!-- COMPACT EMPTY STATE -->
      <div class="empty-history-box">
        <div class="empty-icon-circle">
          <BookOpen size={24} />
        </div>
        {#if searchQuery || filterWorkId !== 'ALL'}
          <h3 class="empty-title">Nenhum capítulo encontrado com esses filtros</h3>
          <p class="empty-desc">Tente alterar o termo de busca ou selecionar todas as obras.</p>
          <button
            type="button"
            class="btn-empty-clear"
            onclick={() => { searchQuery = ''; filterWorkId = 'ALL'; }}
          >
            Limpar filtros de busca
          </button>
        {:else}
          <h3 class="empty-title">Nenhum capítulo publicado registrado ainda</h3>
          <p class="empty-desc">
            Quando um capítulo for conferido no Pré-aprovado e publicado no catálogo oficial, ele aparecerá aqui com seu histórico completo.
          </p>
        {/if}
      </div>
    {/if}
  </section>
</div>

<style>
  /* -------------------------------------------------------------
     ROOT CONTAINER & RESET
     ------------------------------------------------------------- */
  .publicado-view-root {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    width: 100%;
    max-width: 1380px;
    margin: 0 auto;
    padding: 0 1rem 3rem;
    box-sizing: border-box;
    color: #e2e8f0;
    font-family: inherit;
  }

  /* -------------------------------------------------------------
     HOMOLOGATION PREVIEW BAR
     ------------------------------------------------------------- */
  .homologation-toolbar {
    background: rgba(15, 23, 42, 0.7);
    border: 1px dashed rgba(59, 130, 246, 0.4);
    border-radius: 8px;
    padding: 0.5rem 0.85rem;
    backdrop-filter: blur(8px);
  }

  .homologation-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.6rem;
  }

  .homologation-tag {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: #60a5fa;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .homologation-modes {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .mode-btn {
    background: rgba(30, 41, 59, 0.8);
    border: 1px solid rgba(71, 85, 105, 0.6);
    color: #94a3b8;
    font-size: 0.72rem;
    font-weight: 500;
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mode-btn:hover {
    background: rgba(51, 65, 85, 0.9);
    color: #f1f5f9;
  }

  .mode-btn.is-selected {
    background: #1e3a8a;
    border-color: #3b82f6;
    color: #ffffff;
    font-weight: 600;
  }

  /* -------------------------------------------------------------
     1. COMPACT HEADER BAR
     ------------------------------------------------------------- */
  .publicado-header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.25rem;
    padding-bottom: 0.25rem;
    flex-wrap: wrap;
  }

  .publicado-title-group {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .title-with-stat {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  .stage-main-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #f8fafc;
    letter-spacing: -0.02em;
    margin: 0;
    line-height: 1.2;
  }

  .discrete-stat-pill {
    background: rgba(34, 197, 94, 0.12);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #4ade80;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.55rem;
    border-radius: 9999px;
  }

  .stage-sub-desc {
    font-size: 0.85rem;
    color: #94a3b8;
    margin: 0;
  }

  /* Controls Cluster */
  .publicado-controls-cluster {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .search-input-shell,
  .work-filter-shell,
  .sort-select-shell {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-ico,
  .filter-ico,
  .sort-ico {
    position: absolute;
    left: 0.65rem;
    color: #64748b;
    pointer-events: none;
  }

  .compact-search-input {
    background: #0f172a;
    border: 1px solid #334155;
    color: #f1f5f9;
    font-size: 0.82rem;
    padding: 0.45rem 2rem 0.45rem 2.1rem;
    border-radius: 8px;
    min-width: 200px;
    height: 36px;
    box-sizing: border-box;
    transition: border-color 0.15s ease;
  }

  .compact-search-input:focus {
    border-color: #3b82f6;
    outline: none;
  }

  .btn-clear-q {
    position: absolute;
    right: 0.5rem;
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 0.2rem;
    display: flex;
    align-items: center;
  }

  .compact-work-select,
  .compact-sort-select {
    background: #0f172a;
    border: 1px solid #334155;
    color: #cbd5e1;
    font-size: 0.82rem;
    padding: 0.45rem 1.6rem 0.45rem 2rem;
    border-radius: 8px;
    height: 36px;
    cursor: pointer;
    box-sizing: border-box;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.6rem center;
  }

  .compact-work-select:focus,
  .compact-sort-select:focus {
    border-color: #3b82f6;
    outline: none;
  }

  /* -------------------------------------------------------------
     2. STAGE SWITCHER WITH DISCRETE COUNTERS
     ------------------------------------------------------------- */
  .stages-nav-strip {
    width: 100%;
    border-bottom: 1px solid rgba(51, 65, 85, 0.6);
    padding-bottom: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .stages-track {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    overflow-x: auto;
    padding: 0.15rem 0.1rem;
    scrollbar-width: thin;
    scrollbar-color: #334155 transparent;
  }

  .stage-tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    background: transparent;
    border: 1px solid transparent;
    color: #94a3b8;
    font-size: 0.82rem;
    font-weight: 500;
    padding: 0.45rem 0.85rem;
    border-radius: 8px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
    user-select: none;
  }

  .stage-tab-btn:hover {
    background: rgba(30, 41, 59, 0.7);
    color: #e2e8f0;
  }

  .stage-tab-btn.is-active {
    background: rgba(34, 197, 94, 0.12);
    border-color: rgba(34, 197, 94, 0.4);
    color: #4ade80;
    font-weight: 600;
  }

  .stage-tab-icon {
    font-size: 0.95rem;
    line-height: 1;
  }

  .stage-tab-count {
    background: rgba(51, 65, 85, 0.9);
    color: #f1f5f9;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.1rem 0.45rem;
    border-radius: 9999px;
  }

  /* -------------------------------------------------------------
     3. MAIN HISTORY SECTION
     ------------------------------------------------------------- */
  .history-main-section {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .history-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.25rem 0;
  }

  .history-heading-lockup {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .history-heading-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    background: rgba(34, 197, 94, 0.12);
    color: #22c55e;
  }

  .history-heading-text {
    font-size: 1.05rem;
    font-weight: 600;
    color: #f1f5f9;
    margin: 0;
  }

  .history-heading-count {
    background: rgba(51, 65, 85, 0.7);
    color: #94a3b8;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.15rem 0.45rem;
    border-radius: 9999px;
  }

  .active-filter-tag {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.78rem;
    color: #94a3b8;
  }

  .btn-reset-filters {
    background: none;
    border: none;
    color: #60a5fa;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
  }

  /* -------------------------------------------------------------
     4. PUBLISHED CARDS LIST & CARD ITEM
     ------------------------------------------------------------- */
  .published-cards-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .published-card {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 10px;
    overflow: hidden;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .published-card:hover {
    border-color: rgba(59, 130, 246, 0.4);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  }

  .published-card.is-expanded {
    border-color: rgba(34, 197, 94, 0.4);
  }

  .card-summary-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.85rem 1rem;
  }

  /* Cover Thumbnail */
  .cover-thumb-wrapper {
    width: 52px;
    height: 72px;
    border-radius: 6px;
    overflow: hidden;
    background: #1e293b;
    flex-shrink: 0;
    border: 1px solid rgba(51, 65, 85, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cover-thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .cover-thumb-fallback {
    color: #475569;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Body Column */
  .card-body-col {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .work-and-status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .work-title-text {
    font-size: 0.82rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status-badge-wrapper {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
  }

  .published-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: rgba(34, 197, 94, 0.12);
    border: 1px solid rgba(34, 197, 94, 0.35);
    color: #4ade80;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 9999px;
  }

  .demo-pill-badge {
    background: rgba(234, 179, 8, 0.12);
    border: 1px solid rgba(234, 179, 8, 0.35);
    color: #facc15;
    font-size: 0.68rem;
    font-weight: 600;
    padding: 0.15rem 0.45rem;
    border-radius: 9999px;
  }

  .chapter-headline-row {
    display: flex;
    align-items: baseline;
    min-width: 0;
  }

  .chapter-display-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  .cap-number-tag {
    color: #f8fafc;
  }

  .cap-sep {
    margin: 0 0.35rem;
    color: #64748b;
  }

  .cap-label-text {
    color: #cbd5e1;
    font-weight: 500;
  }

  .meta-inline-strip {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.75rem;
    color: #94a3b8;
    flex-wrap: wrap;
  }

  .meta-item {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .meta-rel-time {
    color: #64748b;
  }

  .meta-sep {
    color: #475569;
  }

  .meta-origin-badge {
    background: rgba(148, 163, 184, 0.1);
    color: #94a3b8;
    font-size: 0.68rem;
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
  }

  /* Actions Cluster */
  .card-actions-cluster {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .btn-read-chapter {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: #15803d;
    color: #ffffff;
    font-size: 0.82rem;
    font-weight: 600;
    padding: 0.5rem 0.9rem;
    border-radius: 8px;
    text-decoration: none;
    transition: all 0.15s ease;
    border: 1px solid rgba(34, 197, 94, 0.4);
    min-height: 38px;
    box-sizing: border-box;
  }

  .btn-read-chapter:hover {
    background: #16a34a;
    box-shadow: 0 2px 10px rgba(34, 197, 94, 0.3);
  }

  .btn-read-chapter.is-demo-disabled {
    background: #1e293b;
    border: 1px dashed rgba(148, 163, 184, 0.3);
    color: #94a3b8;
    cursor: not-allowed;
    opacity: 0.85;
  }

  .btn-read-chapter.is-demo-disabled:hover {
    background: #1e293b;
    box-shadow: none;
  }

  .btn-toggle-details {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: #1e293b;
    border: 1px solid #334155;
    color: #cbd5e1;
    font-size: 0.8rem;
    font-weight: 500;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: 38px;
    box-sizing: border-box;
  }

  .btn-toggle-details:hover {
    background: #334155;
    color: #ffffff;
  }

  .btn-toggle-details.is-active {
    background: #334155;
    border-color: #64748b;
    color: #ffffff;
  }

  /* -------------------------------------------------------------
     5. EXPANDED DETAILS ACCORDION
     ------------------------------------------------------------- */
  .card-expanded-panel {
    background: rgba(15, 23, 42, 0.95);
    border-top: 1px solid #1e293b;
    padding: 1rem 1.25rem;
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .details-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.25rem;
  }

  .details-section {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .details-section-title {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
    padding-bottom: 0.35rem;
    border-bottom: 1px solid rgba(51, 65, 85, 0.4);
  }

  .details-dl {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    margin: 0;
  }

  .dl-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.75rem;
    font-size: 0.8rem;
  }

  .dl-row dt {
    color: #64748b;
    font-weight: 500;
    flex-shrink: 0;
  }

  .dl-row dd {
    color: #e2e8f0;
    font-weight: 500;
    margin: 0;
    text-align: right;
    word-break: break-all;
  }

  .catalog-link-mono {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: #60a5fa;
    font-family: monospace;
    font-size: 0.75rem;
    text-decoration: underline;
  }

  .catalog-link-mono.is-demo-label {
    text-decoration: none;
    color: #94a3b8;
    font-style: italic;
  }

  .catalog-link-work {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: #38bdf8;
    text-decoration: none;
    font-weight: 500;
  }

  .catalog-link-work:hover {
    text-decoration: underline;
  }

  .mono-text {
    font-family: monospace;
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .conf-badge-ok {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: #4ade80;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .conf-badge-neutral {
    color: #94a3b8;
    font-size: 0.75rem;
  }

  .status-verified-text {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: #4ade80;
    font-size: 0.78rem;
    font-weight: 600;
  }

  /* -------------------------------------------------------------
     6. PAGINATION BAR
     ------------------------------------------------------------- */
  .pagination-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.85rem 0.25rem 0;
    border-top: 1px solid rgba(51, 65, 85, 0.4);
    flex-wrap: wrap;
  }

  .pagination-info {
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .page-current {
    font-weight: 700;
    color: #f1f5f9;
  }

  .pagination-range {
    color: #64748b;
    margin-left: 0.35rem;
  }

  .pagination-buttons {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .page-nav-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: #1e293b;
    border: 1px solid #334155;
    color: #cbd5e1;
    font-size: 0.78rem;
    font-weight: 500;
    padding: 0.4rem 0.65rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .page-nav-btn:hover:not(:disabled) {
    background: #334155;
    color: #ffffff;
  }

  .page-nav-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .page-number-strip {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .page-number-btn {
    background: transparent;
    border: 1px solid transparent;
    color: #94a3b8;
    font-size: 0.78rem;
    font-weight: 600;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .page-number-btn:hover {
    background: #1e293b;
    color: #f1f5f9;
  }

  .page-number-btn.is-active {
    background: #22c55e;
    color: #ffffff;
    font-weight: 700;
  }

  .page-ellipsis {
    color: #64748b;
    padding: 0 0.2rem;
    font-size: 0.8rem;
  }

  /* -------------------------------------------------------------
     7. COMPACT EMPTY STATE
     ------------------------------------------------------------- */
  .empty-history-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    background: #0f172a;
    border: 1px dashed #334155;
    border-radius: 12px;
    padding: 2.5rem 1.5rem;
    gap: 0.65rem;
    max-width: 520px;
    margin: 1.5rem auto;
  }

  .empty-icon-circle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(51, 65, 85, 0.4);
    color: #94a3b8;
    margin-bottom: 0.25rem;
  }

  .empty-title {
    font-size: 1.05rem;
    font-weight: 600;
    color: #f1f5f9;
    margin: 0;
  }

  .empty-desc {
    font-size: 0.82rem;
    color: #94a3b8;
    line-height: 1.45;
    margin: 0;
  }

  .btn-empty-clear {
    background: #1e293b;
    border: 1px solid #334155;
    color: #60a5fa;
    font-size: 0.78rem;
    font-weight: 600;
    padding: 0.45rem 0.9rem;
    border-radius: 6px;
    cursor: pointer;
    margin-top: 0.5rem;
    transition: all 0.15s ease;
  }

  .btn-empty-clear:hover {
    background: #334155;
    color: #93c5fd;
  }

  /* -------------------------------------------------------------
     MOBILE OPTIMIZATIONS (ANDROID: 320px - 430px)
     ------------------------------------------------------------- */
  @media (max-width: 768px) {
    .publicado-view-root {
      padding: 0 0.5rem 4.5rem;
      gap: 1rem;
    }

    .publicado-header-bar {
      flex-direction: column;
      align-items: stretch;
      gap: 0.85rem;
    }

    .publicado-controls-cluster {
      flex-direction: column;
      align-items: stretch;
      gap: 0.5rem;
    }

    .compact-search-input,
    .compact-work-select,
    .compact-sort-select {
      width: 100%;
      min-width: 0;
      height: 42px; /* Minimum touch target */
      font-size: 0.88rem;
    }

    .search-input-shell,
    .work-filter-shell,
    .sort-select-shell {
      width: 100%;
    }

    /* Summary Card on Mobile */
    .card-summary-row {
      flex-direction: column;
      align-items: stretch;
      gap: 0.85rem;
      padding: 0.85rem;
    }

    /* Horizontal layout for top section of mobile card */
    .card-summary-row > .cover-thumb-wrapper {
      display: none; /* Hide top standalone wrapper to merge inside horizontal header */
    }

    .published-card {
      position: relative;
    }

    /* Reconstruct card content for mobile */
    .card-body-col {
      width: 100%;
    }

    .chapter-display-title {
      font-size: 0.98rem;
      white-space: normal;
      word-break: break-word;
    }

    .card-actions-cluster {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }

    .btn-read-chapter,
    .btn-toggle-details {
      width: 100%;
      justify-content: center;
      min-height: 44px; /* Ergonomic 44px touch target */
      font-size: 0.85rem;
    }

    .details-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .dl-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.15rem;
    }

    .dl-row dd {
      text-align: left;
    }

    .pagination-bar {
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }

    .pagination-buttons {
      width: 100%;
      justify-content: space-between;
    }

    .nav-btn-text {
      display: none;
    }

    .page-nav-btn {
      min-height: 40px;
      padding: 0.4rem 0.8rem;
    }
  }

  /* Ultra-compact screens (320px - 360px) */
  @media (max-width: 360px) {
    .stage-main-title {
      font-size: 1.3rem;
    }

    .card-actions-cluster {
      grid-template-columns: 1fr;
    }
  }
</style>
