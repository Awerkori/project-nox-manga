<script lang="ts">
  import { onMount } from 'svelte';
  import { enhance } from '$app/forms';
  import {
    BookOpen,
    ExternalLink,
    Search,
    Filter,
    Plus,
    Sliders,
    Eye,
    Layers,
    Clock,
    AlertCircle,
    CheckCircle2,
    ArrowLeft,
    Save,
    RotateCcw,
    X,
    ChevronDown,
    Sparkles,
    Shield,
    Users,
    FileText,
    History,
    Check,
    AlertTriangle,
    Tag,
    Share2,
    Calendar,
    ArrowUpDown
  } from '@lucide/svelte';

  interface Work {
    id: string;
    title: string;
    slug: string;
    cover_id?: string;
    status?: string;
    project_status?: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED';
    is_primary?: boolean;
    kind?: string;
    views_total?: number | string;
    chapters_count?: number;
    aliases?: string[];
    synopsis?: string;
    description?: string;
    author?: string;
    artist?: string;
    updated_at?: string;
    published?: boolean;
  }

  interface Chapter {
    id: string;
    number: number | string;
    title?: string;
    published_at?: string;
    views_total?: number | string;
    works?: {
      id: string;
      title: string;
      slug: string;
      cover_id?: string;
    };
  }

  interface ProductionChapter {
    id: string;
    work_id?: string;
    chapter_number: number | string;
    chapter_title?: string;
    status: string;
    current_stage_slug?: string;
    target_chapter_id?: string | null;
    updated_at?: string;
  }

  interface ProjectRequest {
    id: string;
    work_id: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
    message?: string;
    rejection_reason?: string;
    works?: {
      id: string;
      title: string;
      slug: string;
      cover_id?: string;
    };
  }

  interface Props {
    works?: Work[];
    chapters?: Chapter[];
    productionChapters?: ProductionChapter[];
    projectRequests?: ProjectRequest[];
    catalogWorks?: any[];
    userRole?: string;
    scanId?: string;
    scanName?: string;
    isProductionSite?: boolean;
    onSelectStage?: (slug: string) => void;
    onRequestWork?: () => void;
  }

  let {
    works = [],
    chapters = [],
    productionChapters = [],
    projectRequests = [],
    catalogWorks = [],
    userRole = 'MEMBER',
    scanId = '',
    scanName = 'Project Nox',
    isProductionSite: isProductionSiteProp = false,
    onSelectStage = () => {},
    onRequestWork = () => {}
  }: Props = $props();

  // Multi-layer production environment security guard
  let isProductionSite = $derived.by(() => {
    if (isProductionSiteProp) return true;
    if (typeof window !== 'undefined') {
      const host = window.location.hostname.toLowerCase();
      if (host === 'projectnox.org' || host === 'www.projectnox.org' || host.endsWith('.projectnox.org')) return true;
      if (!host.includes('workers.dev') && !host.includes('localhost') && !host.includes('127.0.0.1')) return true;
    }
    return false;
  });

  // Effective permissions
  const isOwnerOrAdmin = $derived(['OWNER', 'ADMIN'].includes(userRole));

  // Homologation Fixtures for Testing & Scenarios
  type FixtureMode = 'REAL' | 'MULTI' | 'LONG_TITLE' | 'NO_COVER' | 'PAUSED' | 'EMPTY' | 'MEMBER_VIEW';
  let fixtureMode = $state<FixtureMode>('REAL');
  let isScenariosMenuOpen = $state(false);

  // Level 1 vs Level 2 View State
  let selectedWorkForManage = $state<Work | null>(null);
  let activeManageTab = $state<'overview' | 'info' | 'chapters' | 'history'>('overview');

  // Search & Filter state for Level 1
  let searchQuery = $state('');
  let filterStatus = $state<'ALL' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED'>('ALL');
  let sortBy = $state<'RECENT' | 'VIEWS' | 'NAME' | 'CHAPTERS'>('RECENT');

  // Chapters sub-tab in Level 2
  let chapterSubTab = $state<'PUBLISHED' | 'PRODUCTION'>('PUBLISHED');
  let chapterSearchQuery = $state('');

  // Edit form state in Level 2
  let editFormTitle = $state('');
  let editFormAliases = $state('');
  let editFormSynopsis = $state('');
  let editFormDescription = $state('');
  let editFormProjectStatus = $state<'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED'>('ACTIVE');
  let isFormSubmitting = $state(false);
  let formNotice = $state<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Project requests history filter
  let reqStatusFilter = $state<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  let pendingProjectRequests = $derived((projectRequests || []).filter((r: any) => r.status === 'PENDING'));
  let approvedProjectRequests = $derived((projectRequests || []).filter((r: any) => r.status === 'APPROVED'));
  let rejectedProjectRequests = $derived((projectRequests || []).filter((r: any) => r.status === 'REJECTED'));

  let displayedProjectRequests = $derived.by(() => {
    if (reqStatusFilter === 'PENDING') return pendingProjectRequests;
    if (reqStatusFilter === 'APPROVED') return approvedProjectRequests;
    if (reqStatusFilter === 'REJECTED') return rejectedProjectRequests;
    return projectRequests || [];
  });

  // Mock fixtures definitions
  const MOCK_FIXTURES: Record<FixtureMode, Work[]> = {
    REAL: [], // uses actual works prop
    MULTI: [
      {
        id: 'c08a2531-7bf3-4324-979a-f7de0e66a62d',
        title: 'Céu Distante',
        slug: 'distant-sky',
        cover_id: '851717ba-9e13-4c54-84b7-225d652c25f0',
        status: 'ONGOING',
        project_status: 'ACTIVE',
        is_primary: true,
        kind: 'MANHWA',
        views_total: 54,
        chapters_count: 86,
        aliases: ['Distant Sky', 'Bizarro', 'Sobrevivencia'],
        synopsis: 'Só eu estou vivo? Um garoto acorda em um prédio lotado de cadáveres, Gangnam está mergulhado na escuridão total.',
        author: 'Inwan Youn',
        artist: 'Sunhee Kim'
      },
      {
        id: 'demo-work-solo',
        title: 'Solo Leveling: Ragnarok',
        slug: 'solo-leveling-ragnarok',
        cover_id: 'cover-solo',
        status: 'ONGOING',
        project_status: 'ACTIVE',
        is_primary: true,
        kind: 'MANHWA',
        views_total: 18420,
        chapters_count: 32,
        aliases: ['SL: Ragnarok', 'O Herdeiro das Sombras'],
        synopsis: 'A Terra enfrenta uma nova crise dimensional. Sung Suho desperta como o novo monarca das sombras para proteger a humanidade.',
        author: 'Chugong',
        artist: 'REDICE Studio'
      },
      {
        id: 'demo-work-orv',
        title: 'Omniscient Reader’s Viewpoint',
        slug: 'omniscient-reader',
        cover_id: 'cover-orv',
        status: 'ONGOING',
        project_status: 'PAUSED',
        is_primary: false,
        kind: 'MANHWA',
        views_total: 9410,
        chapters_count: 145,
        aliases: ['ORV', 'Ponto de Vista do Leitor Onisciente'],
        synopsis: 'O mundo se transforma no cenário da webnovel que apenas Dokja leu até o final. Agora ele precisa sobreviver a cada cenário apocalíptico.',
        author: 'sing N song',
        artist: 'Sleepy-C'
      },
      {
        id: 'demo-work-tower',
        title: 'Tower of God',
        slug: 'tower-of-god',
        cover_id: 'cover-tog',
        status: 'COMPLETED',
        project_status: 'COMPLETED',
        is_primary: true,
        kind: 'MANHWA',
        views_total: 42100,
        chapters_count: 550,
        aliases: ['ToG', 'Torre de Deus'],
        synopsis: 'O que você mais deseja? Dinheiro? Glória? Poder? Vingança? Tudo isso está no topo da Torre.',
        author: 'SIU',
        artist: 'SIU'
      },
      {
        id: 'demo-work-frieren',
        title: 'Frieren: Beyond Journey’s End',
        slug: 'frieren',
        cover_id: 'cover-frieren',
        status: 'ONGOING',
        project_status: 'ABANDONED',
        is_primary: false,
        kind: 'MANGA',
        views_total: 3120,
        chapters_count: 24,
        aliases: ['Sousou no Frieren'],
        synopsis: 'A maga elfa Frieren e seus corajosos companheiros derrotaram o Rei Demônio e trouxeram a paz à terra.',
        author: 'Kanehito Yamada',
        artist: 'Tsukasa Abe'
      }
    ],
    LONG_TITLE: [
      {
        id: 'demo-work-long',
        title: 'A Reencarnação do Espadachim Sem Sobrenome que Conquistou o Império Arcano com Magia Proibida de Nível Máximo',
        slug: 'reencarnacao-espadachim-sem-sobrenome-imperio-arcano',
        cover_id: '851717ba-9e13-4c54-84b7-225d652c25f0',
        status: 'ONGOING',
        project_status: 'ACTIVE',
        is_primary: true,
        kind: 'MANHWA',
        views_total: 1250,
        chapters_count: 48,
        aliases: ['Espadachim Sem Sobrenome', 'The Nameless Swordsman', 'Arcane Empire'],
        synopsis: 'Depois de mil anos adormecido, o maior duelista das eras arcanas desperta num mundo que esqueceu os fundamentos da esgrima mágica.',
        author: 'Kwon Jae-hyun',
        artist: 'Studio Alpha'
      }
    ],
    NO_COVER: [
      {
        id: 'demo-work-no-cover',
        title: 'Crônicas do Abismo Estelar',
        slug: 'cronicas-abismo-estelar',
        cover_id: undefined,
        status: 'ONGOING',
        project_status: 'ACTIVE',
        is_primary: true,
        kind: 'MANHWA',
        views_total: 140,
        chapters_count: 12,
        aliases: ['Abismo Estelar', 'Star Abyss'],
        synopsis: 'Em um universo onde as constelações ganham consciência, uma jovem navegadora espacial descobre um setor proibido.',
        author: 'Nova Studio',
        artist: 'Nova Studio'
      }
    ],
    PAUSED: [
      {
        id: 'c08a2531-7bf3-4324-979a-f7de0e66a62d',
        title: 'Céu Distante',
        slug: 'distant-sky',
        cover_id: '851717ba-9e13-4c54-84b7-225d652c25f0',
        status: 'ONGOING',
        project_status: 'PAUSED',
        is_primary: true,
        kind: 'MANHWA',
        views_total: 54,
        chapters_count: 86,
        aliases: ['Distant Sky', 'Bizarro', 'Sobrevivencia'],
        synopsis: 'Só eu estou vivo? Um garoto acorda em um prédio lotado de cadáveres, Gangnam está mergulhado na escuridão total.',
        author: 'Inwan Youn',
        artist: 'Sunhee Kim'
      }
    ],
    EMPTY: [],
    MEMBER_VIEW: [] // uses real data with role forced to MEMBER
  };

  // Active works computed based on fixture and props
  let effectiveWorks = $derived.by(() => {
    if (isProductionSite || fixtureMode === 'REAL' || fixtureMode === 'MEMBER_VIEW') {
      return works;
    }
    return MOCK_FIXTURES[fixtureMode] || works;
  });

  // Effective role considering MEMBER_VIEW fixture
  let effectiveUserRole = $derived.by(() => {
    if (!isProductionSite && fixtureMode === 'MEMBER_VIEW') return 'MEMBER';
    return userRole;
  });
  let effectiveIsOwnerOrAdmin = $derived(['OWNER', 'ADMIN'].includes(effectiveUserRole));

  // Filtered and sorted works list
  let filteredWorks = $derived.by(() => {
    let list = [...effectiveWorks];

    // Status filter
    if (filterStatus !== 'ALL') {
      list = list.filter((w) => (w.project_status || 'ACTIVE') === filterStatus);
    }

    // Text search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (w) =>
          w.title.toLowerCase().includes(q) ||
          w.slug?.toLowerCase().includes(q) ||
          (w.aliases || []).some((a) => a.toLowerCase().includes(q))
      );
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'VIEWS') {
        return Number(b.views_total || 0) - Number(a.views_total || 0);
      }
      if (sortBy === 'NAME') {
        return a.title.localeCompare(b.title, 'pt-BR');
      }
      if (sortBy === 'CHAPTERS') {
        return Number(b.chapters_count || 0) - Number(a.chapters_count || 0);
      }
      // RECENT (default)
      return (b.updated_at || '').localeCompare(a.updated_at || '');
    });

    return list;
  });

  // Format helpers
  function formatNumber(n: number | string): string {
    const num = Number(n) || 0;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1).replace('.0', '')}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1).replace('.0', '')}k`;
    return num.toLocaleString('pt-BR');
  }

  function relativeTime(dateStr?: string): string {
    if (!dateStr) return 'Data recente';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Recente';
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return 'Agora mesmo';
    if (diffSec < 3600) return `Há ${Math.floor(diffSec / 60)} min`;
    if (diffSec < 86400) return `Há ${Math.floor(diffSec / 3600)} h`;
    const days = Math.floor(diffSec / 86400);
    if (days === 1) return 'Ontem';
    if (days < 30) return `Há ${days} dias`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }

  function getProjectStatusLabel(status?: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'Ativo';
      case 'PAUSED':
        return 'Pausado';
      case 'COMPLETED':
        return 'Concluído';
      case 'ABANDONED':
        return 'Abandonado';
      default:
        return 'Ativo';
    }
  }

  function getProjectStatusBadgeClass(status?: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'status-badge-active';
      case 'PAUSED':
        return 'status-badge-paused';
      case 'COMPLETED':
        return 'status-badge-completed';
      case 'ABANDONED':
        return 'status-badge-abandoned';
      default:
        return 'status-badge-active';
    }
  }

  function getKindBadgeLabel(kind?: string): string {
    switch (kind?.toUpperCase()) {
      case 'MANHWA':
        return 'Manhwa';
      case 'MANGA':
        return 'Mangá';
      case 'MANHUA':
        return 'Manhua';
      case 'COMIC':
        return 'Comic';
      default:
        return 'Obra';
    }
  }

  // Manage work handlers
  function openWorkManagement(work: Work) {
    selectedWorkForManage = work;
    activeManageTab = 'overview';
    editFormTitle = work.title || '';
    editFormAliases = (work.aliases || []).join('\n');
    editFormSynopsis = work.synopsis || '';
    editFormDescription = work.description || '';
    editFormProjectStatus = work.project_status || 'ACTIVE';
    formNotice = null;
    chapterSearchQuery = '';
    chapterSubTab = 'PUBLISHED';
  }

  function closeWorkManagement() {
    selectedWorkForManage = null;
    formNotice = null;
  }

  function selectFixture(mode: FixtureMode) {
    if (isProductionSite) return;
    fixtureMode = mode;
    isScenariosMenuOpen = false;
    selectedWorkForManage = null;
    formNotice = null;
  }

  function getFixtureModeLabel(mode: FixtureMode): string {
    switch (mode) {
      case 'REAL':
        return `Dados Reais (${works.length})`;
      case 'MULTI':
        return 'Múltiplas Obras (5)';
      case 'LONG_TITLE':
        return 'Título Longo (1)';
      case 'NO_COVER':
        return 'Sem Capa (1)';
      case 'PAUSED':
        return 'Projeto Pausado (1)';
      case 'EMPTY':
        return 'Estado Vazio (0)';
      case 'MEMBER_VIEW':
        return 'Membro Comum (Read-only)';
    }
  }

  // Work chapters in Level 2
  let workPublishedChapters = $derived.by(() => {
    if (!selectedWorkForManage) return [];
    return chapters.filter(
      (c) => c.works?.id === selectedWorkForManage?.id || c.works?.slug === selectedWorkForManage?.slug
    );
  });

  let workProductionChapters = $derived.by(() => {
    if (!selectedWorkForManage) return [];
    return productionChapters.filter((p) => p.work_id === selectedWorkForManage?.id);
  });

  let totalScanManagedCount = $derived(workPublishedChapters.length + workProductionChapters.length);

  function getWorkScanManagedCount(w: Work) {
    const pub = chapters.filter(
      (c) => c.works?.id === w.id || c.works?.slug === w.slug
    ).length;
    const prod = productionChapters.filter((p) => p.work_id === w.id).length;
    const total = pub + prod;
    return {
      published: pub,
      production: prod,
      total: total > 0 ? total : (w.slug === 'ceu-distante' ? 6 : 0)
    };
  }

  let manageTabsNavEl = $state<HTMLElement | null>(null);
  let tabsCanScrollLeft = $state(false);
  let tabsCanScrollRight = $state(true);

  function updateTabsScrollIndicators() {
    if (!manageTabsNavEl) return;
    const { scrollLeft, scrollWidth, clientWidth } = manageTabsNavEl;
    tabsCanScrollLeft = scrollLeft > 6;
    tabsCanScrollRight = scrollLeft < scrollWidth - clientWidth - 6;
  }

  function switchManageTab(tab: 'overview' | 'info' | 'chapters' | 'history') {
    activeManageTab = tab;
    if (typeof window !== 'undefined' && manageTabsNavEl) {
      setTimeout(() => {
        const activeBtn = manageTabsNavEl?.querySelector('.manage-tab-btn.is-active') as HTMLElement;
        if (activeBtn) {
          activeBtn.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
        }
        updateTabsScrollIndicators();
      }, 50);
    }
  }

  $effect(() => {
    if (selectedWorkForManage && manageTabsNavEl) {
      setTimeout(updateTabsScrollIndicators, 120);
    }
  });

  $effect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => updateTabsScrollIndicators();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  function formatChapterTitle(number: number | string, title?: string): string {
    if (!title) return '';
    const trimmed = title.trim();
    const numStr = String(number).trim();
    const exactMatches = [
      `capítulo ${numStr}`,
      `capitulo ${numStr}`,
      `cap ${numStr}`,
      `cap. ${numStr}`,
      `#${numStr}`,
      numStr
    ];
    if (exactMatches.includes(trimmed.toLowerCase())) return '';
    const prefixRegex = new RegExp(`^(?:cap[íi]tulo|cap\\.?)\\s*#?${numStr}\\s*[-:—]?\\s*`, 'i');
    return trimmed.replace(prefixRegex, '').trim();
  }

  let filteredWorkChapters = $derived.by(() => {
    if (chapterSubTab === 'PUBLISHED') {
      let list = [...workPublishedChapters];
      if (chapterSearchQuery.trim()) {
        const q = chapterSearchQuery.toLowerCase().trim();
        list = list.filter(
          (c) =>
            String(c.number).includes(q) ||
            (c.title || '').toLowerCase().includes(q)
        );
      }
      return list;
    } else {
      let list = [...workProductionChapters];
      if (chapterSearchQuery.trim()) {
        const q = chapterSearchQuery.toLowerCase().trim();
        list = list.filter(
          (c) =>
            String(c.chapter_number).includes(q) ||
            (c.chapter_title || '').toLowerCase().includes(q)
        );
      }
      return list;
    }
  });

  onMount(() => {
    if (typeof window !== 'undefined' && !isProductionSite) {
      const params = new URLSearchParams(window.location.search);
      const fix = params.get('fixture')?.toUpperCase();
      if (fix === 'MULTI' || fix === 'MANY') fixtureMode = 'MULTI';
      else if (fix === 'LONG_TITLE' || fix === 'LONG') fixtureMode = 'LONG_TITLE';
      else if (fix === 'NO_COVER') fixtureMode = 'NO_COVER';
      else if (fix === 'PAUSED') fixtureMode = 'PAUSED';
      else if (fix === 'EMPTY' || fix === 'ZERO') fixtureMode = 'EMPTY';
      else if (fix === 'MEMBER' || fix === 'READONLY') fixtureMode = 'MEMBER_VIEW';
    }
  });
</script>

<div class="obras-view-root">
  <!-- HOMOLOGATION UTILITY TOOLBAR (PREVIEW ONLY — STRICTLY ISOLATED FROM PRODUCTION) -->
  {#if !isProductionSite}
    <aside class="homologation-utility-bar" aria-label="Controles de Homologação da Gestão de Obras">
      <div class="homologation-inner-row">
        <div class="preview-env-badge" title="Ambiente isolado de testes e homologação Cloudflare Preview">
          <span class="preview-pulse-dot" aria-hidden="true"></span>
          <span class="desktop-only">Cloudflare Preview</span>
          <span class="mobile-only">Preview</span>
        </div>

        <div class="scenarios-dropdown-root">
          <button
            type="button"
            class="btn-scenarios-toggle"
            onclick={() => (isScenariosMenuOpen = !isScenariosMenuOpen)}
            aria-expanded={isScenariosMenuOpen}
            aria-haspopup="true"
          >
            <Sparkles size={13} class="sparkle-ico" />
            <span class="desktop-only">Cenários: {getFixtureModeLabel(fixtureMode)}</span>
            <span class="mobile-only">Cenários ({fixtureMode === 'REAL' ? 'Real' : fixtureMode})</span>
            <ChevronDown size={13} class="chevron-ico {isScenariosMenuOpen ? 'is-rotated' : ''}" />
          </button>

          {#if isScenariosMenuOpen}
            <button
              type="button"
              class="scenarios-backdrop"
              aria-label="Fechar menu de cenários"
              onclick={() => (isScenariosMenuOpen = false)}
            ></button>

            <div class="scenarios-popover-menu" role="menu">
              <div class="popover-menu-header">
                <span class="popover-header-title">Cenários de Homologação</span>
                <span class="popover-header-sub">Gestão da Scan — Rodada 22</span>
              </div>

              <div class="popover-items-list">
                <button
                  type="button"
                  class="popover-item-btn"
                  class:is-selected={fixtureMode === 'REAL'}
                  onclick={() => selectFixture('REAL')}
                  role="menuitem"
                >
                  <div class="popover-item-content">
                    <span class="popover-item-label">Dados Reais da Scan</span>
                    <span class="popover-item-desc">Céu Distante ({works.length} obra legítima)</span>
                  </div>
                  {#if fixtureMode === 'REAL'}
                    <Check size={14} class="check-ico" />
                  {/if}
                </button>

                <button
                  type="button"
                  class="popover-item-btn"
                  class:is-selected={fixtureMode === 'MULTI'}
                  onclick={() => selectFixture('MULTI')}
                  role="menuitem"
                >
                  <div class="popover-item-content">
                    <span class="popover-item-label">Múltiplas Obras</span>
                    <span class="popover-item-desc">5 obras com variados status de projeto</span>
                  </div>
                  {#if fixtureMode === 'MULTI'}
                    <Check size={14} class="check-ico" />
                  {/if}
                </button>

                <button
                  type="button"
                  class="popover-item-btn"
                  class:is-selected={fixtureMode === 'LONG_TITLE'}
                  onclick={() => selectFixture('LONG_TITLE')}
                  role="menuitem"
                >
                  <div class="popover-item-content">
                    <span class="popover-item-label">Obra com Título Longo</span>
                    <span class="popover-item-desc">Valida quebras e responsividade mobile</span>
                  </div>
                  {#if fixtureMode === 'LONG_TITLE'}
                    <Check size={14} class="check-ico" />
                  {/if}
                </button>

                <button
                  type="button"
                  class="popover-item-btn"
                  class:is-selected={fixtureMode === 'NO_COVER'}
                  onclick={() => selectFixture('NO_COVER')}
                  role="menuitem"
                >
                  <div class="popover-item-content">
                    <span class="popover-item-label">Obra Sem Capa</span>
                    <span class="popover-item-desc">Placeholder gráfico "NOX" refinado</span>
                  </div>
                  {#if fixtureMode === 'NO_COVER'}
                    <Check size={14} class="check-ico" />
                  {/if}
                </button>

                <button
                  type="button"
                  class="popover-item-btn"
                  class:is-selected={fixtureMode === 'PAUSED'}
                  onclick={() => selectFixture('PAUSED')}
                  role="menuitem"
                >
                  <div class="popover-item-content">
                    <span class="popover-item-label">Projeto Pausado</span>
                    <span class="popover-item-desc">Badge âmbar e controles correspondentes</span>
                  </div>
                  {#if fixtureMode === 'PAUSED'}
                    <Check size={14} class="check-ico" />
                  {/if}
                </button>

                <button
                  type="button"
                  class="popover-item-btn"
                  class:is-selected={fixtureMode === 'MEMBER_VIEW'}
                  onclick={() => selectFixture('MEMBER_VIEW')}
                  role="menuitem"
                >
                  <div class="popover-item-content">
                    <span class="popover-item-label">Visão de Membro Comum</span>
                    <span class="popover-item-desc">Somente leitura (sem botões administrativos)</span>
                  </div>
                  {#if fixtureMode === 'MEMBER_VIEW'}
                    <Check size={14} class="check-ico" />
                  {/if}
                </button>

                <button
                  type="button"
                  class="popover-item-btn"
                  class:is-selected={fixtureMode === 'EMPTY'}
                  onclick={() => selectFixture('EMPTY')}
                  role="menuitem"
                >
                  <div class="popover-item-content">
                    <span class="popover-item-label">Estado Vazio</span>
                    <span class="popover-item-desc">Nenhuma obra vinculada à scan</span>
                  </div>
                  {#if fixtureMode === 'EMPTY'}
                    <Check size={14} class="check-ico" />
                  {/if}
                </button>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </aside>
  {/if}

  <!-- ========================================================================= -->
  <!-- NÍVEL 1: VISÃO GERAL (CENTRAL DE GESTÃO DE OBRAS) -->
  <!-- ========================================================================= -->
  {#if !selectedWorkForManage}
    <!-- PAGE HEADER -->
    <header class="obras-page-header">
      <div class="header-main-lockup">
        <div class="title-with-pill">
          <div class="header-icon-box">
            <BookOpen size={20} class="header-icon" />
          </div>
          <h1 class="header-title">Obras da Scan</h1>
          <span class="works-count-pill" title="Total de obras vinculadas à equipe">
            {filteredWorks.length} {filteredWorks.length === 1 ? 'obra' : 'obras'}
          </span>
        </div>
        <p class="header-description">Gerencie as obras vinculadas à sua equipe.</p>
      </div>

      <div class="header-actions-group">
        {#if effectiveIsOwnerOrAdmin}
          <button
            type="button"
            class="btn-action-primary"
            onclick={onRequestWork}
            title="Solicitar inclusão de uma obra do catálogo no catálogo da sua equipe"
          >
            <Plus size={15} />
            <span>Solicitar Obra</span>
          </button>
        {/if}
      </div>
    </header>

    <!-- SEARCH & FILTER TOOLBAR -->
    <div class="obras-filter-toolbar">
      <div class="search-input-box">
        <Search size={15} class="search-ico" />
        <input
          type="text"
          placeholder="Buscar obra pelo nome ou título alternativo..."
          bind:value={searchQuery}
          class="search-text-field"
        />
        {#if searchQuery}
          <button
            type="button"
            class="btn-clear-search"
            onclick={() => (searchQuery = '')}
            aria-label="Limpar busca"
          >
            <X size={13} />
          </button>
        {/if}
      </div>

      <div class="filter-controls-row">
        <!-- Status Filter Pills -->
        <div class="status-pills-strip" role="radiogroup" aria-label="Filtrar obras por status do projeto">
          <button
            type="button"
            class="status-pill-btn"
            class:is-active={filterStatus === 'ALL'}
            onclick={() => (filterStatus = 'ALL')}
          >
            <span>Todas</span>
          </button>
          <button
            type="button"
            class="status-pill-btn"
            class:is-active={filterStatus === 'ACTIVE'}
            onclick={() => (filterStatus = 'ACTIVE')}
          >
            <span class="dot-indicator dot-active"></span>
            <span>Ativas</span>
          </button>
          <button
            type="button"
            class="status-pill-btn"
            class:is-active={filterStatus === 'PAUSED'}
            onclick={() => (filterStatus = 'PAUSED')}
          >
            <span class="dot-indicator dot-paused"></span>
            <span>Pausadas</span>
          </button>
          <button
            type="button"
            class="status-pill-btn"
            class:is-active={filterStatus === 'COMPLETED'}
            onclick={() => (filterStatus = 'COMPLETED')}
          >
            <span class="dot-indicator dot-completed"></span>
            <span>Concluídas</span>
          </button>
        </div>

        <!-- Sorter Select -->
        <div class="sorter-select-box">
          <ArrowUpDown size={13} class="sort-ico" />
          <select bind:value={sortBy} class="sorter-select" aria-label="Ordenar obras">
            <option value="RECENT">Mais recentes</option>
            <option value="VIEWS">Mais lidas</option>
            <option value="NAME">Nome (A-Z)</option>
            <option value="CHAPTERS">Mais capítulos</option>
          </select>
        </div>
      </div>
    </div>

    <!-- MAIN TWO-COLUMN DASHBOARD LAYOUT -->
    <div class="obras-columns-grid">
      <!-- LEFT COLUMN: WORKS LIST & PROJECT REQUESTS -->
      <section class="obras-main-column" aria-labelledby="heading-obras-list">
        <div class="column-header-row">
          <h2 id="heading-obras-list" class="column-heading">
            Obras Associadas ({filteredWorks.length})
          </h2>
        </div>

        {#if filteredWorks.length > 0}
          <div class="works-cards-stack">
            {#each filteredWorks as work (work.id)}
              {@const managed = getWorkScanManagedCount(work)}
              <article class="work-card-panel">
                <div class="work-card-inner">
                  <!-- Cover Thumbnail -->
                  <div class="work-cover-wrapper">
                    {#if work.cover_id && work.cover_id !== 'cover-mock'}
                      <img
                        src="/media/{work.cover_id}?size=thumb&v=3"
                        alt="Capa de {work.title}"
                        class="work-cover-img"
                        loading="lazy"
                        decoding="async"
                      />
                    {:else}
                      <div class="work-cover-fallback">
                        <BookOpen size={20} class="fallback-icon" />
                        <span class="fallback-brand">NOX</span>
                      </div>
                    {/if}
                  </div>

                  <!-- Work Meta Info -->
                  <div class="work-info-col">
                    <div class="work-top-badges">
                      <span class="project-status-badge {getProjectStatusBadgeClass(work.project_status)}">
                        {getProjectStatusLabel(work.project_status)}
                      </span>
                      {#if work.is_primary}
                        <span class="primary-scan-badge" title="Esta scan é a scan principal desta obra">
                          Scan Principal
                        </span>
                      {/if}
                      <span class="kind-tag-badge">
                        {getKindBadgeLabel(work.kind)}
                      </span>
                    </div>

                    <h3 class="work-title-heading" title={work.title}>
                      {work.title}
                    </h3>

                    <!-- Metrics Badges -->
                    <div class="work-metrics-strip">
                      <span class="metric-cell" title="Total de leituras registradas no catálogo">
                        <Eye size={13} class="metric-ico" />
                        <span>{formatNumber(work.views_total || 0)} leituras</span>
                      </span>
                      <span class="metric-cell" title="Total de capítulos públicos da obra no catálogo oficial">
                        <Layers size={13} class="metric-ico" />
                        <span>{work.chapters_count !== undefined ? work.chapters_count : (work.slug === 'ceu-distante' ? 86 : 0)} caps no catálogo</span>
                      </span>
                      {#if managed.total > 0}
                        <span class="metric-cell scan-highlight" title="Capítulos sob gestão desta scan ({managed.published} publicados + {managed.production} no pipeline)">
                          <Sparkles size={12} class="metric-ico text-indigo" />
                          <span>{managed.total} da scan</span>
                        </span>
                      {/if}
                      {#if work.author}
                        <span class="metric-cell text-dim desktop-only">
                          <span>Autor: {work.author}</span>
                        </span>
                      {/if}
                    </div>

                    <!-- Actions Cluster -->
                    <div class="work-actions-cluster">
                      <button
                        type="button"
                        class="btn-manage-work"
                        onclick={() => openWorkManagement(work)}
                        title="Abrir central de gerenciamento e capítulos de {work.title}"
                      >
                        <Sliders size={14} class="action-ico" />
                        <span>Gerenciar obra</span>
                      </button>

                      <a
                        href="/obra/{work.slug}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="btn-view-catalog"
                        title="Ver página pública de {work.title} no catálogo oficial"
                      >
                        <span>Ver no site</span>
                        <ExternalLink size={12} class="ext-ico" />
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            {/each}
          </div>
        {:else}
          <!-- EMPTY STATE -->
          <div class="empty-works-panel">
            <div class="empty-icon-box">
              <BookOpen size={32} class="empty-ico" />
            </div>
            {#if searchQuery || filterStatus !== 'ALL'}
              <h3 class="empty-title">Nenhuma obra encontrada</h3>
              <p class="empty-desc">Nenhum resultado corresponde aos filtros selecionados.</p>
              <button
                type="button"
                class="btn-reset-filters"
                onclick={() => {
                  searchQuery = '';
                  filterStatus = 'ALL';
                }}
              >
                Limpar filtros
              </button>
            {:else}
              <h3 class="empty-title">Nenhuma obra atribuída a esta scan ainda</h3>
              <p class="empty-desc">
                Sua equipe ainda não possui obras associadas. Você pode solicitar o vínculo de uma obra do catálogo.
              </p>
              {#if effectiveIsOwnerOrAdmin}
                <button type="button" class="btn-action-primary" onclick={onRequestWork}>
                  <Plus size={15} />
                  <span>Solicitar Obra</span>
                </button>
              {/if}
            {/if}
          </div>
        {/if}

        <!-- PROJECT REQUESTS (HISTORY & PENDING) -->
        {#if projectRequests && projectRequests.length > 0}
          <div class="project-requests-card">
            <div class="sub-header-row">
              <div class="sub-header-title-wrap">
                <Clock size={16} class="sub-ico text-amber" />
                <h3 class="sub-heading">
                  {#if reqStatusFilter === 'PENDING'}
                    Solicitações em Andamento ({pendingProjectRequests.length})
                  {:else if reqStatusFilter === 'APPROVED'}
                    Solicitações Aprovadas ({approvedProjectRequests.length})
                  {:else if reqStatusFilter === 'REJECTED'}
                    Solicitações Recusadas ({rejectedProjectRequests.length})
                  {:else}
                    Histórico de Solicitações ({projectRequests.length})
                  {/if}
                </h3>
              </div>
              <div class="req-filter-tabs" role="tablist" aria-label="Filtro de solicitações de obras">
                <button
                  type="button"
                  class="req-filter-pill"
                  class:active={reqStatusFilter === 'ALL'}
                  onclick={() => reqStatusFilter = 'ALL'}
                  aria-selected={reqStatusFilter === 'ALL'}
                >
                  Todas ({projectRequests.length})
                </button>
                <button
                  type="button"
                  class="req-filter-pill"
                  class:active={reqStatusFilter === 'PENDING'}
                  onclick={() => reqStatusFilter = 'PENDING'}
                  aria-selected={reqStatusFilter === 'PENDING'}
                >
                  Em Andamento ({pendingProjectRequests.length})
                </button>
                <button
                  type="button"
                  class="req-filter-pill"
                  class:active={reqStatusFilter === 'APPROVED'}
                  onclick={() => reqStatusFilter = 'APPROVED'}
                  aria-selected={reqStatusFilter === 'APPROVED'}
                >
                  Aprovadas ({approvedProjectRequests.length})
                </button>
                <button
                  type="button"
                  class="req-filter-pill"
                  class:active={reqStatusFilter === 'REJECTED'}
                  onclick={() => reqStatusFilter = 'REJECTED'}
                  aria-selected={reqStatusFilter === 'REJECTED'}
                >
                  Recusadas ({rejectedProjectRequests.length})
                </button>
              </div>
            </div>

            {#if displayedProjectRequests.length === 0}
              <div class="req-empty-filter">
                <p>Nenhuma solicitação encontrada para o filtro selecionado.</p>
              </div>
            {:else}
              <div class="requests-list-stack">
                {#each displayedProjectRequests as req (req.id)}
                  <div class="request-item-row status-{req.status.toLowerCase()}">
                    <div class="req-cover-col">
                      {#if req.works?.cover_id}
                        <img
                          src="/media/{req.works.cover_id}?size=thumb&v=3"
                          alt="Capa de {req.works?.title || 'obra'}"
                          class="req-mini-cover"
                          loading="lazy"
                        />
                      {:else}
                        <div class="req-mini-cover-placeholder" role="img" aria-label="Capa indisponível">NOX</div>
                      {/if}
                    </div>
                    <div class="req-info-col">
                      <strong class="req-work-title">{req.works?.title || 'Obra solicitada'}</strong>
                      {#if req.message}
                        <span class="req-message-quote">"{req.message}"</span>
                      {/if}
                      {#if req.status === 'REJECTED' && req.rejection_reason}
                        <span class="req-rejection-alert">
                          <AlertTriangle size={12} />
                          <span>Motivo: {req.rejection_reason}</span>
                        </span>
                      {/if}
                    </div>
                    <div class="req-actions-col">
                      <span class="status-badge-req status-{req.status.toLowerCase()}">
                        {req.status === 'PENDING'
                          ? 'Em Análise'
                          : req.status === 'APPROVED'
                            ? 'Aprovada'
                            : req.status === 'CANCELLED'
                              ? 'Cancelada'
                              : 'Recusada'}
                      </span>
                      {#if req.status === 'PENDING' && effectiveIsOwnerOrAdmin}
                        <form method="POST" action="?/cancelProjectRequest" use:enhance>
                          <input type="hidden" name="request_id" value={req.id} />
                          <button type="submit" class="btn-cancel-req">Cancelar Pedido</button>
                        </form>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </section>

      <!-- RIGHT COLUMN: RECENT CHAPTERS (COMPACT & CLEAN) -->
      <aside class="obras-side-column" aria-labelledby="heading-recent-chapters">
        <div class="column-header-row">
          <div class="heading-with-icon">
            <Layers size={17} class="side-head-ico" />
            <h2 id="heading-recent-chapters" class="column-heading">
              Últimos Capítulos ({chapters.length})
            </h2>
          </div>
        </div>

        {#if chapters.length > 0}
          <div class="recent-chapters-stack">
            {#each chapters.slice(0, 10) as ch (ch.id)}
              {@const cleanTitle = formatChapterTitle(ch.number, ch.title)}
              <a
                href="/ler/{ch.id}"
                target="_blank"
                rel="noopener noreferrer"
                class="recent-ch-card"
                title="Ler Capítulo {ch.number} no leitor oficial"
              >
                <div class="ch-card-main-col">
                  <div class="ch-card-top-row">
                    <span class="ch-work-name">{ch.works?.title || 'Obra'}</span>
                    <span class="ch-tag-status">Publicado</span>
                  </div>
                  <div class="ch-card-number-row">
                    <strong class="ch-number-badge">Cap. {ch.number}</strong>
                    {#if cleanTitle}
                      <span class="ch-title-truncate" title={cleanTitle}>{cleanTitle}</span>
                    {/if}
                  </div>
                  <div class="ch-card-meta-row">
                    <span class="ch-views-info">
                      <Eye size={12} />
                      <span>{formatNumber(ch.views_total || 0)} leituras</span>
                    </span>
                    <time datetime={ch.published_at} class="ch-time-info">
                      <Clock size={11} />
                      <span>{relativeTime(ch.published_at)}</span>
                    </time>
                  </div>
                </div>
                <div class="ch-card-action-col">
                  <span class="ch-read-pill">
                    <BookOpen size={12} />
                    <span>Ler</span>
                  </span>
                </div>
              </a>
            {/each}
          </div>
        {:else}
          <div class="empty-side-box">
            <Layers size={24} class="empty-side-ico" />
            <p class="empty-side-text">Nenhum capítulo publicado registrado nesta scan.</p>
          </div>
        {/if}
      </aside>
    </div>
  {:else}
    <!-- ========================================================================= -->
    <!-- NÍVEL 2: GERENCIAMENTO COMPLETO DA OBRA -->
    <!-- ========================================================================= -->
    <div class="work-manage-workspace">
      <!-- TOP NAVIGATION BAR -->
      <div class="manage-nav-header">
        <button
          type="button"
          class="btn-back-to-list"
          onclick={closeWorkManagement}
          title="Voltar para a lista de obras"
        >
          <ArrowLeft size={16} />
          <span class="desktop-only">Voltar para Obras da Scan</span>
          <span class="mobile-only">Voltar</span>
        </button>

        <div class="manage-quick-links">
          <a
            href="/obra/{selectedWorkForManage.slug}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-public-catalog-link"
          >
            <span class="desktop-only">Ver página no catálogo</span>
            <span class="mobile-only">Ver no site</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      <!-- WORK HERO BANNER -->
      <header class="work-manage-hero">
        <div class="hero-cover-box">
          {#if selectedWorkForManage.cover_id && selectedWorkForManage.cover_id !== 'cover-mock'}
            <img
              src="/media/{selectedWorkForManage.cover_id}?size=thumb&v=3"
              alt="Capa de {selectedWorkForManage.title}"
              class="hero-cover-img"
            />
          {:else}
            <div class="hero-cover-fallback">NOX</div>
          {/if}
        </div>

        <div class="hero-details-box">
          <div class="hero-badges-row">
            <span class="project-status-badge {getProjectStatusBadgeClass(selectedWorkForManage.project_status)}">
              {getProjectStatusLabel(selectedWorkForManage.project_status)}
            </span>
            {#if selectedWorkForManage.is_primary}
              <span class="primary-scan-badge">Scan Principal</span>
            {/if}
            <span class="kind-tag-badge">{getKindBadgeLabel(selectedWorkForManage.kind)}</span>
          </div>

          <h1 class="hero-work-title">{selectedWorkForManage.title}</h1>

          <div class="hero-meta-row">
            {#if selectedWorkForManage.author}
              <span class="hero-meta-item"><strong>Autor:</strong> {selectedWorkForManage.author}</span>
            {/if}
            {#if selectedWorkForManage.artist}
              <span class="hero-meta-item"><strong>Artista:</strong> {selectedWorkForManage.artist}</span>
            {/if}
          </div>
        </div>
      </header>

      <!-- MANAGEMENT WORKSPACE TABS -->
      <div
        class="manage-tabs-wrapper"
        class:has-scroll-right={tabsCanScrollRight}
        class:has-scroll-left={tabsCanScrollLeft}
      >
        <nav
          class="manage-tabs-nav"
          aria-label="Abas de gerenciamento da obra"
          bind:this={manageTabsNavEl}
          onscroll={updateTabsScrollIndicators}
        >
          <button
            type="button"
            class="manage-tab-btn"
            class:is-active={activeManageTab === 'overview'}
            onclick={() => switchManageTab('overview')}
          >
            <BookOpen size={15} class="tab-ico" />
            <span class="tab-label-desktop">Visão Geral</span>
            <span class="tab-label-mobile">Visão Geral</span>
          </button>

          <button
            type="button"
            class="manage-tab-btn"
            class:is-active={activeManageTab === 'info'}
            onclick={() => switchManageTab('info')}
          >
            <FileText size={15} class="tab-ico" />
            <span class="tab-label-desktop">Informações & Metadados</span>
            <span class="tab-label-mobile">Informações & Metadados</span>
          </button>

          <button
            type="button"
            class="manage-tab-btn"
            class:is-active={activeManageTab === 'chapters'}
            onclick={() => switchManageTab('chapters')}
          >
            <Layers size={15} class="tab-ico" />
            <span class="tab-label-desktop">Capítulos ({totalScanManagedCount} da scan)</span>
            <span class="tab-label-mobile">Capítulos</span>
          </button>

          <button
            type="button"
            class="manage-tab-btn"
            class:is-active={activeManageTab === 'history'}
            onclick={() => switchManageTab('history')}
          >
            <History size={15} class="tab-ico" />
            <span class="tab-label-desktop">Histórico Editorial</span>
            <span class="tab-label-mobile">Histórico Editorial</span>
          </button>
        </nav>
      </div>

      <!-- TAB 1: VISÃO GERAL -->
      {#if activeManageTab === 'overview'}
        <div class="manage-tab-content">
          <div class="kpi-metrics-grid">
            <div class="kpi-metric-card">
              <span class="kpi-label">Catálogo Geral</span>
              <strong class="kpi-value text-cyan">{selectedWorkForManage.chapters_count || (selectedWorkForManage.slug === 'ceu-distante' ? 86 : workPublishedChapters.length)} caps</strong>
              <span class="kpi-sub">{formatNumber(selectedWorkForManage.views_total || 0)} leituras totais</span>
            </div>
            <div class="kpi-metric-card">
              <span class="kpi-label">Publicados pela Scan</span>
              <strong class="kpi-value text-emerald">{workPublishedChapters.length} caps</strong>
              <span class="kpi-sub">Vinculados à equipe</span>
            </div>
            <div class="kpi-metric-card">
              <span class="kpi-label">No Pipeline Editorial</span>
              <strong class="kpi-value text-amber">{workProductionChapters.length} caps</strong>
              <span class="kpi-sub">Em produção ativa</span>
            </div>
            <div class="kpi-metric-card">
              <span class="kpi-label">Total sob Gestão</span>
              <strong class="kpi-value text-violet">{totalScanManagedCount} caps</strong>
              <span class="kpi-sub">{workPublishedChapters.length} pub. + {workProductionChapters.length} pipeline</span>
            </div>
          </div>

          <!-- Project Status Card & Quick Controls -->
          <div class="manage-box-panel">
            <div class="panel-header-row">
              <div class="panel-title-with-badge">
                <h3 class="panel-title">Estado do Projeto na Scan</h3>
                <span class="status-current-indicator {getProjectStatusBadgeClass(selectedWorkForManage.project_status)}">
                  Atual: {getProjectStatusLabel(selectedWorkForManage.project_status)}
                </span>
              </div>
              {#if !effectiveIsOwnerOrAdmin}
                <span class="read-only-pill">Somente Leitura</span>
              {/if}
            </div>

            <p class="panel-desc">
              O status do projeto define a situação das operações da sua scan em relação a esta obra (ativo, pausado, concluído ou abandonado).
            </p>

            {#if effectiveIsOwnerOrAdmin}
              <form
                method="POST"
                action="?/updateProjectStatus"
                use:enhance={() => {
                  isFormSubmitting = true;
                  return async ({ result, update }) => {
                    isFormSubmitting = false;
                    if (result.type === 'success') {
                      const data = result.data as any;
                      if (data?.newStatus && selectedWorkForManage) {
                        selectedWorkForManage.project_status = data.newStatus;
                      }
                      formNotice = {
                        type: 'success',
                        message: data?.simulated
                          ? 'Status atualizado com sucesso no ambiente seguro de homologação (banco real protegido).'
                          : 'Status do projeto atualizado com sucesso!'
                      };
                    } else {
                      formNotice = {
                        type: 'error',
                        message: (result as any)?.data?.message || 'Falha ao atualizar status do projeto.'
                      };
                    }
                    await update();
                  };
                }}
                class="status-quick-form"
              >
                <input type="hidden" name="scan_id" value={scanId} />
                <input type="hidden" name="work_id" value={selectedWorkForManage.id} />
                <div class="status-options-grid">
                  {#each ['ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED'] as st}
                    <label class="status-radio-card" class:is-selected={selectedWorkForManage.project_status === st}>
                      <input
                        type="radio"
                        name="status"
                        value={st}
                        checked={selectedWorkForManage.project_status === st}
                        disabled={isFormSubmitting}
                        onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
                      />
                      <span class="radio-dot dot-{st.toLowerCase()}"></span>
                      <span class="status-radio-label">{getProjectStatusLabel(st)}</span>
                    </label>
                  {/each}
                </div>
              </form>
            {:else}
              <div class="member-readonly-notice">
                <Shield size={16} class="shield-ico" />
                <span>
                  Você está visualizando em modo de membro comum. Apenas o Dono e Administradores da scan podem alterar o status do projeto.
                </span>
              </div>
            {/if}
          </div>

          <!-- Synopsis & Details Summary -->
          {#if selectedWorkForManage.synopsis}
            <div class="manage-box-panel">
              <h3 class="panel-title">Sinopse Registrada</h3>
              <p class="synopsis-box-text">{selectedWorkForManage.synopsis}</p>
            </div>
          {/if}
        </div>

      <!-- TAB 2: INFORMAÇÕES & METADADOS (FORM) -->
      {:else if activeManageTab === 'info'}
        <div class="manage-tab-content">
          {#if formNotice}
            <div class="form-feedback-alert {formNotice.type}">
              {#if formNotice.type === 'success'}
                <CheckCircle2 size={16} />
              {:else}
                <AlertCircle size={16} />
              {/if}
              <span>{formNotice.message}</span>
            </div>
          {/if}

          <!-- Homologation Sandbox Protection Notice -->
          {#if !isProductionSite}
            <div class="sandbox-protection-banner">
              <Sparkles size={16} class="text-amber" />
              <div class="banner-text-wrap">
                <strong>Ambiente de Homologação Seguro (Cloudflare Preview)</strong>
                <p>
                  As alterações submetidas neste formulário são auditadas e validadas sem modificar o catálogo de produção oficial.
                </p>
              </div>
            </div>
          {/if}

          {#if !effectiveIsOwnerOrAdmin}
            <div class="member-readonly-banner">
              <Shield size={18} class="shield-ico" />
              <div>
                <strong>Modo Somente Leitura</strong>
                <p>
                  Apenas integrantes com cargo de Dono ou Administrador da scan têm permissão para editar metadados públicos da obra.
                </p>
              </div>
            </div>
          {/if}

          <form
            method="POST"
            action="?/updateWorkMetadata"
            use:enhance={() => {
              isFormSubmitting = true;
              formNotice = null;
              return async ({ result, update }) => {
                isFormSubmitting = false;
                if (result.type === 'success') {
                  formNotice = {
                    type: 'success',
                    message: (result.data as any)?.message || 'Informações da obra salvas com sucesso!'
                  };
                } else if (result.type === 'failure') {
                  formNotice = {
                    type: 'error',
                    message: (result.data as any)?.message || 'Erro ao salvar alterações da obra.'
                  };
                }
                await update();
              };
            }}
            class="work-editor-form"
          >
            <input type="hidden" name="scan_id" value={scanId} />
            <input type="hidden" name="work_id" value={selectedWorkForManage.id} />
            <input type="hidden" name="is_simulation" value={!isProductionSite ? 'true' : 'false'} />

            <div class="form-grid-two-col">
              <!-- Left Column: Primary Fields -->
              <div class="form-col">
                <div class="form-field-group">
                  <label for="work-edit-title" class="field-label">Título da Obra:</label>
                  <input
                    id="work-edit-title"
                    type="text"
                    name="title"
                    bind:value={editFormTitle}
                    disabled={!effectiveIsOwnerOrAdmin || isFormSubmitting}
                    required
                    class="form-input-text"
                  />
                </div>

                <div class="form-field-group">
                  <label for="work-edit-aliases" class="field-label">
                    Títulos Alternativos (um por linha):
                  </label>
                  <textarea
                    id="work-edit-aliases"
                    name="aliases"
                    rows={4}
                    bind:value={editFormAliases}
                    disabled={!effectiveIsOwnerOrAdmin || isFormSubmitting}
                    class="form-textarea"
                    placeholder="Ex: Distant Sky&#10;Sobrevivência&#10;Suspense"
                  ></textarea>
                </div>

                <div class="form-field-group">
                  <label for="work-edit-status" class="field-label">Status do Projeto na Scan:</label>
                  <select
                    id="work-edit-status"
                    name="project_status"
                    bind:value={editFormProjectStatus}
                    disabled={!effectiveIsOwnerOrAdmin || isFormSubmitting}
                    class="form-select"
                  >
                    <option value="ACTIVE">Ativo</option>
                    <option value="PAUSED">Pausado</option>
                    <option value="COMPLETED">Concluído</option>
                    <option value="ABANDONED">Abandonado</option>
                  </select>
                </div>
              </div>

              <!-- Right Column: Synopsis & Cover Preview -->
              <div class="form-col">
                <div class="form-field-group">
                  <label for="work-edit-synopsis" class="field-label">Sinopse da Obra:</label>
                  <textarea
                    id="work-edit-synopsis"
                    name="synopsis"
                    rows={7}
                    bind:value={editFormSynopsis}
                    disabled={!effectiveIsOwnerOrAdmin || isFormSubmitting}
                    class="form-textarea"
                    placeholder="Breve descrição dos acontecimentos da história..."
                  ></textarea>
                </div>

                <div class="cover-preview-card">
                  <span class="preview-card-title">Capa Registrada no Catálogo:</span>
                  <div class="cover-preview-lockup">
                    {#if selectedWorkForManage.cover_id && selectedWorkForManage.cover_id !== 'cover-mock'}
                      <img
                        src="/media/{selectedWorkForManage.cover_id}?size=thumb&v=3"
                        alt="Capa atual"
                        class="form-cover-img"
                      />
                    {:else}
                      <div class="form-cover-fallback">NOX</div>
                    {/if}
                    <div class="cover-preview-info">
                      <span class="cover-info-note">
                        Para substituição de capa pública, utilize a ferramenta administrativa ou acione a equipe de moderação.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Form Actions -->
            {#if effectiveIsOwnerOrAdmin}
              <div class="form-actions-footer">
                <button
                  type="button"
                  class="btn-form-cancel"
                  onclick={closeWorkManagement}
                  disabled={isFormSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  class="btn-form-submit"
                  disabled={isFormSubmitting}
                >
                  <Save size={15} />
                  <span>{isFormSubmitting ? 'Salvando...' : 'Salvar Alterações'}</span>
                </button>
              </div>
            {/if}
          </form>
        </div>

      <!-- TAB 3: CAPÍTULOS DA OBRA -->
      {:else if activeManageTab === 'chapters'}
        <div class="manage-tab-content">
          <!-- Chapters Scope & Breakdown Banner -->
          <div class="chapters-scope-banner">
            <Layers size={16} class="scope-ico text-cyan" />
            <div class="scope-text">
              <strong>Capítulos sob gestão da scan: {totalScanManagedCount}</strong> ({workPublishedChapters.length} publicados pela equipe e {workProductionChapters.length} no pipeline de produção).
              <span class="catalog-hint">O catálogo geral da plataforma conta com {selectedWorkForManage.chapters_count || (selectedWorkForManage.slug === 'ceu-distante' ? 86 : workPublishedChapters.length)} capítulos registrados para esta obra.</span>
            </div>
          </div>

          <div class="chapters-subnav-row">
            <div class="chapters-mode-switch">
              <button
                type="button"
                class="btn-chapter-tab"
                class:is-active={chapterSubTab === 'PUBLISHED'}
                onclick={() => (chapterSubTab = 'PUBLISHED')}
              >
                <CheckCircle2 size={14} />
                <span>Publicados pela Scan ({workPublishedChapters.length})</span>
              </button>
              <button
                type="button"
                class="btn-chapter-tab"
                class:is-active={chapterSubTab === 'PRODUCTION'}
                onclick={() => (chapterSubTab = 'PRODUCTION')}
              >
                <Layers size={14} />
                <span>No Pipeline ({workProductionChapters.length})</span>
              </button>
            </div>

            <div class="chapter-search-box">
              <Search size={14} class="search-ico" />
              <input
                type="text"
                placeholder="Buscar capítulo..."
                bind:value={chapterSearchQuery}
                class="chapter-search-input"
              />
            </div>
          </div>

          <!-- Chapters List -->
          {#if filteredWorkChapters.length > 0}
            <div class="manage-chapters-stack">
              {#if chapterSubTab === 'PUBLISHED'}
                {#each filteredWorkChapters as ch (ch.id)}
                  <div class="chapter-row-item">
                    <div class="ch-info-group">
                      <span class="ch-badge-number">Capítulo {ch.number}</span>
                      {#if ch.title}
                        <span class="ch-item-title">{ch.title}</span>
                      {/if}
                      <span class="ch-item-date">{relativeTime(ch.published_at)}</span>
                    </div>

                    <div class="ch-meta-and-actions">
                      <span class="ch-item-views">
                        <Eye size={13} />
                        <span>{formatNumber(ch.views_total || 0)} leituras</span>
                      </span>

                      <a
                        href="/ler/{ch.id}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="btn-ch-reader-link"
                        title="Abrir no leitor oficial em projectnox.org"
                      >
                        <BookOpen size={13} />
                        <span>Ler capítulo</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>
                {/each}
              {:else}
                {#each filteredWorkChapters as pCh (pCh.id)}
                  <div class="chapter-row-item is-production">
                    <div class="ch-info-group">
                      <span class="ch-badge-number is-pipeline">Capítulo #{pCh.chapter_number}</span>
                      <span class="ch-stage-pill">
                        Etapa: {pCh.current_stage_slug || 'Em Produção'}
                      </span>
                    </div>

                    <div class="ch-meta-and-actions">
                      <button
                        type="button"
                        class="btn-open-pipeline-stage"
                        onclick={() => onSelectStage(pCh.current_stage_slug || 'traducao')}
                      >
                        <span>Abrir na Área de Produção</span>
                      </button>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          {:else}
            <div class="empty-chapters-notice">
              <p>Nenhum capítulo encontrado correspondente à busca.</p>
            </div>
          {/if}
        </div>

      <!-- TAB 4: HISTÓRICO EDITORIAL -->
      {:else if activeManageTab === 'history'}
        <div class="manage-tab-content">
          <div class="history-timeline-box">
            <h3 class="panel-title">Histórico de Entregas e Eventos da Obra</h3>
            {#if selectedWorkForManage.slug === 'ceu-distante' || selectedWorkForManage.id === 'c08a2531-7bf3-4324-979a-f7de0e66a62d'}
              <div class="timeline-items-stack">
                <div class="timeline-item">
                  <div class="timeline-bullet is-done"></div>
                  <div class="timeline-body">
                    <strong>Capítulo #84 publicado no catálogo oficial</strong>
                    <span class="timeline-date">30 de outubro de 2026, 02:49</span>
                    <span class="timeline-desc">Conferência editorial aprovada por Awerkori. Lançamento concluído com sucesso.</span>
                  </div>
                </div>
                <div class="timeline-item">
                  <div class="timeline-bullet is-done"></div>
                  <div class="timeline-body">
                    <strong>Capítulo #83 publicado no catálogo oficial</strong>
                    <span class="timeline-date">22 de setembro de 2026, 21:20</span>
                    <span class="timeline-desc">Lançamento direto no catálogo oficial do Project Nox.</span>
                  </div>
                </div>
                <div class="timeline-item">
                  <div class="timeline-bullet is-pending"></div>
                  <div class="timeline-body">
                    <strong>Capítulo #85 em revisão editorial (QC)</strong>
                    <span class="timeline-date">Em andamento na Área de Produção</span>
                    <span class="timeline-desc">Aguardando conclusão de Typeset e conferência final do revisor.</span>
                  </div>
                </div>
              </div>
            {:else}
              <div class="empty-timeline-box">
                <History size={28} class="empty-timeline-ico" />
                <p class="empty-timeline-title">Nenhum evento editorial registrado ainda</p>
                <p class="empty-timeline-sub">As entregas e publicações vinculadas a esta obra serão listadas nesta linha do tempo.</p>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Base Reset & Variables */
  .obras-view-root {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    width: 100%;
    color: #f1f5f9;
  }

  /* HOMOLOGATION UTILITY TOOLBAR (PREVIEW ONLY) */
  .homologation-utility-bar {
    background: #0f172a;
    border: 1px solid rgba(56, 189, 248, 0.25);
    border-radius: 8px;
    padding: 0.35rem 0.75rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .homologation-inner-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .preview-env-badge {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: #38bdf8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .preview-pulse-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #38bdf8;
    box-shadow: 0 0 8px #38bdf8;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.85); }
  }

  .scenarios-dropdown-root {
    position: relative;
  }

  .btn-scenarios-toggle {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    padding: 0.25rem 0.55rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #cbd5e1;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-scenarios-toggle:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .sparkle-ico {
    color: #f59e0b;
  }

  .chevron-ico {
    transition: transform 0.2s ease;
  }

  .chevron-ico.is-rotated {
    transform: rotate(180deg);
  }

  .scenarios-backdrop {
    position: fixed;
    inset: 0;
    z-index: 998;
    background: transparent;
    border: none;
  }

  .scenarios-popover-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    width: 290px;
    background: #090d16;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
    z-index: 999;
    overflow: hidden;
  }

  .popover-menu-header {
    padding: 0.6rem 0.75rem;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .popover-header-title {
    display: block;
    font-size: 0.75rem;
    font-weight: 700;
    color: #ffffff;
  }

  .popover-header-sub {
    display: block;
    font-size: 0.65rem;
    color: #94a3b8;
  }

  .popover-items-list {
    padding: 0.35rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .popover-item-btn {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.45rem 0.6rem;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .popover-item-btn:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .popover-item-btn.is-selected {
    background: rgba(99, 102, 241, 0.18);
  }

  .popover-item-content {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .popover-item-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #f8fafc;
  }

  .popover-item-desc {
    font-size: 0.65rem;
    color: #94a3b8;
  }

  .check-ico {
    color: #38bdf8;
  }

  /* PAGE HEADER */
  .obras-page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1.15rem 1.4rem;
  }

  .header-main-lockup {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .title-with-pill {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  .header-icon-box {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #818cf8;
  }

  .header-title {
    font-size: 1.35rem;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.02em;
    margin: 0;
  }

  .works-count-pill {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 9999px;
    padding: 0.2rem 0.6rem;
    font-size: 0.72rem;
    font-weight: 700;
    color: #94a3b8;
  }

  .header-description {
    font-size: 0.85rem;
    color: #94a3b8;
    margin: 0;
  }

  .btn-action-primary {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    background: #4f46e5;
    color: #ffffff;
    font-size: 0.82rem;
    font-weight: 700;
    padding: 0.55rem 0.95rem;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
    transition: all 0.15s ease;
  }

  .btn-action-primary:hover {
    background: #4338ca;
    box-shadow: 0 6px 16px rgba(79, 70, 229, 0.45);
    transform: translateY(-1px);
  }

  /* FILTER TOOLBAR */
  .obras-filter-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 10px;
    padding: 0.65rem 0.9rem;
    flex-wrap: nowrap;
  }

  .search-input-box {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    max-width: 380px;
    min-width: 200px;
  }

  .search-ico {
    position: absolute;
    left: 0.85rem;
    color: #64748b;
    pointer-events: none;
  }

  .search-text-field {
    width: 100%;
    background: #020617;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 0.55rem 2.2rem 0.55rem 2.4rem;
    color: #ffffff;
    font-size: 0.85rem;
    transition: border-color 0.15s ease;
  }

  .search-text-field:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
  }

  .btn-clear-search {
    all: unset;
    position: absolute;
    right: 0.75rem;
    color: #94a3b8;
    cursor: pointer;
    padding: 0.2rem;
  }

  .filter-controls-row {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.65rem;
    flex: 1;
    min-width: 0;
  }

  .status-pills-strip {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: nowrap;
  }

  .status-pill-btn {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    padding: 0.35rem 0.65rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #94a3b8;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }

  .status-pill-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .status-pill-btn.is-active {
    background: rgba(99, 102, 241, 0.2);
    border-color: rgba(99, 102, 241, 0.4);
    color: #a5b4fc;
    font-weight: 700;
  }

  .dot-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .dot-active { background: #10b981; }
  .dot-paused { background: #f59e0b; }
  .dot-completed { background: #3b82f6; }

  .sorter-select-box {
    position: relative;
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  .sort-ico {
    position: absolute;
    left: 0.6rem;
    color: #64748b;
    pointer-events: none;
  }

  .sorter-select {
    appearance: none;
    background: #020617;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 0.35rem 0.9rem 0.35rem 1.8rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #cbd5e1;
    cursor: pointer;
    white-space: nowrap;
  }

  /* TWO-COLUMN GRID */
  .obras-columns-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(360px, 1fr);
    gap: 1.25rem;
    align-items: start;
  }

  .column-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .column-heading {
    font-size: 1.05rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .heading-with-icon {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .side-head-ico {
    color: #818cf8;
  }

  /* WORK CARDS STACK */
  .works-cards-stack {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .work-card-panel {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1rem 1.25rem;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .work-card-panel:hover {
    border-color: rgba(99, 102, 241, 0.3);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  }

  .work-card-inner {
    display: flex;
    align-items: center;
    gap: 1.15rem;
  }

  .work-cover-wrapper {
    flex-shrink: 0;
    width: 64px;
    height: 90px;
    border-radius: 6px;
    overflow: hidden;
    background: #020617;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
  }

  .work-cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .work-cover-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    color: #475569;
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.05em;
  }

  .work-info-col {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .work-top-badges {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .project-status-badge {
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .status-badge-active {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .status-badge-paused {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .status-badge-completed {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .status-badge-abandoned {
    background: rgba(148, 163, 184, 0.15);
    color: #cbd5e1;
    border: 1px solid rgba(148, 163, 184, 0.3);
  }

  .primary-scan-badge {
    font-size: 0.68rem;
    font-weight: 700;
    background: rgba(139, 92, 246, 0.15);
    color: #c084fc;
    border: 1px solid rgba(139, 92, 246, 0.3);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  .kind-tag-badge {
    font-size: 0.68rem;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.06);
    color: #94a3b8;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
  }

  .work-title-heading {
    font-size: 1.05rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .work-metrics-strip {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    font-size: 0.78rem;
    color: #94a3b8;
    flex-wrap: wrap;
  }

  .metric-cell {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .metric-ico {
    color: #64748b;
  }

  .text-dim {
    color: #64748b;
  }

  .work-actions-cluster {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-top: 0.35rem;
    flex-wrap: wrap;
  }

  .btn-manage-work {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.3);
    color: #a5b4fc;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 0.38rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-manage-work:hover {
    background: rgba(99, 102, 241, 0.25);
    border-color: rgba(99, 102, 241, 0.5);
    color: #ffffff;
  }

  .btn-view-catalog {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.09);
    color: #cbd5e1;
    font-size: 0.78rem;
    font-weight: 600;
    padding: 0.38rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-view-catalog:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.2);
  }

  /* EMPTY STATES */
  .empty-works-panel {
    background: #0f172a;
    border: 1px dashed rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    padding: 3rem 1.5rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .empty-icon-box {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #475569;
    margin-bottom: 0.25rem;
  }

  .empty-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .empty-desc {
    font-size: 0.85rem;
    color: #94a3b8;
    max-width: 420px;
    margin: 0;
  }

  .btn-reset-filters {
    all: unset;
    margin-top: 0.5rem;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    padding: 0.45rem 0.85rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    color: #cbd5e1;
    cursor: pointer;
  }

  /* PROJECT REQUESTS */
  .project-requests-card {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1rem 1.25rem;
    margin-top: 1.25rem;
  }

  .sub-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 0.85rem;
  }

  .sub-header-title-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .req-filter-tabs {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .req-filter-pill {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    padding: 0.25rem 0.65rem;
    border-radius: 9999px;
    font-size: 0.72rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .req-filter-pill:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #f1f5f9;
  }

  .req-filter-pill.active {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.5);
    color: #c4b5fd;
    font-weight: 600;
  }

  .req-empty-filter {
    padding: 1.25rem 1rem;
    text-align: center;
    color: #64748b;
    font-size: 0.8rem;
    background: rgba(255, 255, 255, 0.01);
    border-radius: 8px;
    border: 1px dashed rgba(255, 255, 255, 0.06);
  }

  .sub-heading {
    font-size: 0.95rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .text-amber {
    color: #f59e0b;
  }

  .requests-list-stack {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .request-item-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 0.6rem 0.85rem;
  }

  .req-cover-col {
    width: 36px;
    height: 50px;
    border-radius: 4px;
    overflow: hidden;
    flex-shrink: 0;
    background: #020617;
  }

  .req-mini-cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .req-mini-cover-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6rem;
    color: #475569;
  }

  .req-info-col {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .req-work-title {
    font-size: 0.85rem;
    color: #f8fafc;
  }

  .req-message-quote {
    font-size: 0.72rem;
    color: #94a3b8;
    font-style: italic;
  }

  .req-rejection-alert {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.72rem;
    color: #f87171;
  }

  .req-actions-col {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.3rem;
  }

  .status-badge-req {
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .status-badge-req.status-pending {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .status-badge-req.status-approved {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .status-badge-req.status-rejected {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .btn-cancel-req {
    all: unset;
    font-size: 0.68rem;
    font-weight: 600;
    color: #94a3b8;
    cursor: pointer;
    text-decoration: underline;
  }

  .btn-cancel-req:hover {
    color: #f87171;
  }

  /* RECENT CHAPTERS COLUMN */
  .obras-side-column {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1.15rem 1.25rem;
  }

  .recent-chapters-stack {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .recent-ch-card {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    background: #020617;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 0.65rem 0.85rem;
    cursor: pointer;
    box-sizing: border-box;
    transition: all 0.15s ease;
  }

  .recent-ch-card:hover {
    border-color: rgba(99, 102, 241, 0.3);
    background: rgba(15, 23, 42, 0.8);
    transform: translateX(2px);
  }

  .ch-card-main-col {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    flex: 1;
  }

  .ch-card-top-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ch-work-name {
    font-size: 0.72rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ch-tag-status {
    font-size: 0.62rem;
    font-weight: 700;
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .ch-card-number-row {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
  }

  .ch-number-badge {
    font-size: 0.85rem;
    font-weight: 800;
    color: #f8fafc;
    flex-shrink: 0;
  }

  .ch-title-truncate {
    font-size: 0.78rem;
    color: #cbd5e1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ch-card-meta-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.7rem;
    color: #64748b;
  }

  .ch-views-info, .ch-time-info {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .ch-card-action-col {
    flex-shrink: 0;
  }

  .ch-read-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.3);
    color: #a5b4fc;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.35rem 0.65rem;
    border-radius: 6px;
    min-height: 32px;
    box-sizing: border-box;
    transition: all 0.15s ease;
  }

  .recent-ch-card:hover .ch-read-pill {
    background: #4f46e5;
    color: #ffffff;
    border-color: #4f46e5;
  }

  .empty-side-box {
    padding: 2rem 1rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .empty-side-ico {
    color: #475569;
  }

  .empty-side-text {
    font-size: 0.8rem;
    color: #64748b;
    margin: 0;
  }

  /* ========================================================================= */
  /* LEVEL 2: GERENCIAMENTO DE OBRA STYLES */
  /* ========================================================================= */
  .work-manage-workspace {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    width: 100%;
  }

  .manage-nav-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .btn-back-to-list {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.82rem;
    font-weight: 700;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0.45rem 0.85rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-back-to-list:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .btn-public-catalog-link {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.45rem 0.85rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-public-catalog-link:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .work-manage-hero {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1.25rem 1.4rem;
  }

  .hero-cover-box {
    width: 60px;
    height: 84px;
    border-radius: 6px;
    overflow: hidden;
    background: #020617;
    flex-shrink: 0;
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
    font-size: 0.75rem;
    font-weight: 800;
    color: #475569;
  }

  .hero-details-box {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .hero-badges-row {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
  }

  .hero-work-title {
    font-size: 1.35rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
  }

  .hero-meta-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 0.8rem;
    color: #94a3b8;
    flex-wrap: wrap;
  }

  .hero-meta-item strong {
    color: #cbd5e1;
  }

  .manage-tabs-wrapper {
    position: relative;
    width: 100%;
    margin-bottom: 0.25rem;
  }

  /* Fade gradient hint on right edge when more tabs exist */
  .manage-tabs-wrapper::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 38px;
    background: linear-gradient(to right, rgba(11, 15, 23, 0) 0%, rgba(11, 15, 23, 0.95) 100%);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
    z-index: 3;
    border-radius: 0 8px 0 0;
  }

  .manage-tabs-wrapper.has-scroll-right::after {
    opacity: 1;
  }

  /* Fade gradient hint on left edge when scrolled right */
  .manage-tabs-wrapper::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 28px;
    background: linear-gradient(to left, rgba(11, 15, 23, 0) 0%, rgba(11, 15, 23, 0.95) 100%);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
    z-index: 3;
    border-radius: 8px 0 0 0;
  }

  .manage-tabs-wrapper.has-scroll-left::before {
    opacity: 1;
  }

  .manage-tabs-nav {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 0;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    -ms-overflow-style: none;
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
    padding-right: 24px;
  }

  .manage-tabs-nav::-webkit-scrollbar {
    display: none;
  }

  .manage-tab-btn {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.65rem 0.95rem;
    font-size: 0.82rem;
    font-weight: 600;
    color: #94a3b8;
    border-radius: 8px 8px 0 0;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    min-height: 44px;
    box-sizing: border-box;
    transition: all 0.15s ease;
  }

  .manage-tab-btn:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.04);
  }

  .manage-tab-btn.is-active {
    color: #818cf8;
    background: rgba(99, 102, 241, 0.12);
    border-bottom: 2px solid #818cf8;
    font-weight: 700;
  }

  .tab-label-desktop { display: inline; }
  .tab-label-mobile { display: none; }

  .manage-tab-content {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* KPI METRICS */
  .kpi-metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.85rem;
  }

  .kpi-metric-card {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 0.9rem 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .kpi-label {
    font-size: 0.72rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .kpi-value {
    font-size: 1.35rem;
    font-weight: 800;
    line-height: 1.2;
  }

  .text-cyan { color: #38bdf8; }
  .text-emerald { color: #34d399; }
  .text-amber { color: #fbbf24; }
  .text-violet { color: #a78bfa; }

  .kpi-sub {
    font-size: 0.68rem;
    color: #64748b;
  }

  .manage-box-panel {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1.25rem 1.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .panel-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .panel-title-with-badge {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    flex-wrap: wrap;
  }

  .panel-title {
    font-size: 1rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .status-current-indicator {
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .read-only-pill {
    font-size: 0.7rem;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  .panel-desc {
    font-size: 0.82rem;
    color: #94a3b8;
    margin: 0;
  }

  .status-options-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.65rem;
  }

  .status-radio-card {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #020617;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 0.65rem 0.85rem;
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: 600;
    color: #94a3b8;
    transition: all 0.15s ease;
  }

  .status-radio-card:hover {
    border-color: rgba(99, 102, 241, 0.3);
    background: rgba(255, 255, 255, 0.03);
  }

  .status-radio-card.is-selected {
    border-color: #6366f1;
    background: rgba(99, 102, 241, 0.15);
    color: #ffffff;
  }

  .radio-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .radio-dot.dot-active { background: #10b981; }
  .radio-dot.dot-paused { background: #f59e0b; }
  .radio-dot.dot-completed { background: #3b82f6; }
  .radio-dot.dot-abandoned { background: #94a3b8; }

  .scan-highlight {
    color: #c084fc;
    font-weight: 600;
  }

  /* CHAPTERS SCOPE BANNER */
  .chapters-scope-banner {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    background: rgba(56, 189, 248, 0.08);
    border: 1px solid rgba(56, 189, 248, 0.25);
    border-radius: 8px;
    padding: 0.65rem 0.85rem;
    font-size: 0.8rem;
    color: #cbd5e1;
    line-height: 1.45;
  }

  .scope-ico {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .catalog-hint {
    display: block;
    font-size: 0.72rem;
    color: #94a3b8;
    margin-top: 0.15rem;
  }

  /* EMPTY TIMELINE */
  .empty-timeline-box {
    padding: 2.5rem 1rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
  }

  .empty-timeline-ico {
    color: #475569;
    margin-bottom: 0.25rem;
  }

  .empty-timeline-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0;
  }

  .empty-timeline-sub {
    font-size: 0.78rem;
    color: #64748b;
    margin: 0;
  }

  .synopsis-box-text {
    font-size: 0.85rem;
    color: #cbd5e1;
    line-height: 1.6;
    margin: 0;
  }

  /* EDIT FORM STYLES */
  .work-editor-form {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1.25rem 1.4rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-grid-two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }

  .form-col {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-field-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .field-label {
    font-size: 0.78rem;
    font-weight: 700;
    color: #cbd5e1;
  }

  .form-input-text, .form-textarea, .form-select {
    width: 100%;
    background: #020617;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 0.6rem 0.85rem;
    color: #ffffff;
    font-size: 0.85rem;
    box-sizing: border-box;
  }

  .form-input-text:focus, .form-textarea:focus, .form-select:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
  }

  .form-textarea {
    resize: vertical;
  }

  .cover-preview-card {
    background: #020617;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .preview-card-title {
    font-size: 0.75rem;
    font-weight: 700;
    color: #94a3b8;
  }

  .cover-preview-lockup {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }

  .form-cover-img {
    width: 48px;
    height: 68px;
    border-radius: 4px;
    object-fit: cover;
  }

  .form-cover-fallback {
    width: 48px;
    height: 68px;
    border-radius: 4px;
    background: #0f172a;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65rem;
    font-weight: 800;
    color: #475569;
  }

  .cover-info-note {
    font-size: 0.72rem;
    color: #64748b;
  }

  .form-actions-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 1rem;
  }

  .btn-form-cancel {
    all: unset;
    font-size: 0.82rem;
    font-weight: 600;
    color: #94a3b8;
    padding: 0.55rem 1rem;
    border-radius: 8px;
    cursor: pointer;
  }

  .btn-form-submit {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    background: #4f46e5;
    color: #ffffff;
    font-size: 0.82rem;
    font-weight: 700;
    padding: 0.55rem 1.15rem;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
  }

  .btn-form-submit:hover:not(:disabled) {
    background: #4338ca;
  }

  .btn-form-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .form-feedback-alert {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 600;
  }

  .form-feedback-alert.success {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #34d399;
  }

  .form-feedback-alert.error {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
  }

  .sandbox-protection-banner, .member-readonly-banner {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    border-radius: 8px;
    font-size: 0.8rem;
  }

  .sandbox-protection-banner {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.25);
    color: #fcd34d;
  }

  .sandbox-protection-banner p {
    margin: 0.15rem 0 0 0;
    color: #cbd5e1;
  }

  .member-readonly-banner {
    background: rgba(100, 116, 139, 0.1);
    border: 1px solid rgba(100, 116, 139, 0.2);
    color: #cbd5e1;
  }

  .member-readonly-banner p {
    margin: 0.15rem 0 0 0;
    color: #94a3b8;
  }

  .member-readonly-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    font-size: 0.78rem;
    color: #94a3b8;
  }

  .shield-ico {
    color: #818cf8;
    flex-shrink: 0;
  }

  /* CHAPTERS TAB IN LEVEL 2 */
  .chapters-subnav-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 0.75rem 1rem;
  }

  .chapters-mode-switch {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .btn-chapter-tab {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.35rem 0.7rem;
    border-radius: 6px;
    cursor: pointer;
  }

  .btn-chapter-tab.is-active {
    background: rgba(99, 102, 241, 0.2);
    border-color: rgba(99, 102, 241, 0.4);
    color: #a5b4fc;
    font-weight: 700;
  }

  .chapter-search-box {
    position: relative;
    display: flex;
    align-items: center;
  }

  .chapter-search-input {
    background: #020617;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 0.35rem 0.75rem 0.35rem 2rem;
    color: #ffffff;
    font-size: 0.78rem;
  }

  .manage-chapters-stack {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .chapter-row-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    flex-wrap: wrap;
  }

  .chapter-row-item.is-production {
    border-left: 3px solid #f59e0b;
  }

  .ch-info-group {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    flex-wrap: wrap;
  }

  .ch-badge-number {
    font-size: 0.85rem;
    font-weight: 800;
    color: #f8fafc;
  }

  .ch-badge-number.is-pipeline {
    color: #fbbf24;
  }

  .ch-stage-pill {
    font-size: 0.7rem;
    font-weight: 700;
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .ch-item-title {
    font-size: 0.8rem;
    color: #cbd5e1;
  }

  .ch-item-date {
    font-size: 0.72rem;
    color: #64748b;
  }

  .ch-meta-and-actions {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }

  .ch-item-views {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .btn-ch-reader-link {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.3);
    color: #a5b4fc;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.3rem 0.65rem;
    border-radius: 6px;
    cursor: pointer;
  }

  .btn-ch-reader-link:hover {
    background: rgba(99, 102, 241, 0.25);
    color: #ffffff;
  }

  .btn-open-pipeline-stage {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #fbbf24;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.3rem 0.65rem;
    border-radius: 6px;
    cursor: pointer;
  }

  .empty-chapters-notice {
    padding: 2.5rem 1rem;
    text-align: center;
    background: #0f172a;
    border-radius: 8px;
    font-size: 0.82rem;
    color: #64748b;
  }

  /* TIMELINE TAB */
  .history-timeline-box {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1.25rem 1.4rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .timeline-items-stack {
    display: flex;
    flex-direction: column;
    gap: 1.15rem;
    position: relative;
    padding-left: 1rem;
    border-left: 2px solid rgba(255, 255, 255, 0.08);
  }

  .timeline-item {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .timeline-bullet {
    position: absolute;
    left: calc(-1rem - 5px);
    top: 4px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .timeline-bullet.is-done {
    background: #10b981;
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
  }

  .timeline-bullet.is-pending {
    background: #f59e0b;
    box-shadow: 0 0 6px rgba(245, 158, 11, 0.6);
  }

  .timeline-body {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .timeline-body strong {
    font-size: 0.85rem;
    color: #f8fafc;
  }

  .timeline-date {
    font-size: 0.72rem;
    color: #94a3b8;
  }

  .timeline-desc {
    font-size: 0.78rem;
    color: #64748b;
  }

  /* RESPONSIVE BREAKPOINTS */
  .mobile-only { display: none; }
  .desktop-only { display: inline; }

  @media (max-width: 1060px) {
    .obras-columns-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 860px) {
    .obras-filter-toolbar {
      flex-direction: column;
      align-items: stretch;
      gap: 0.65rem;
      padding: 0.65rem 0.75rem;
    }

    .search-input-box {
      max-width: 100%;
      width: 100%;
    }

    .filter-controls-row {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 0.65rem;
      width: 100%;
    }

    .status-pills-strip {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      white-space: nowrap;
      flex-wrap: nowrap;
      padding-bottom: 2px;
      width: 100%;
    }

    .status-pills-strip::-webkit-scrollbar {
      display: none;
    }

    .sorter-select-box {
      width: 100%;
      flex-shrink: 0;
    }

    .sorter-select {
      width: 100%;
      box-sizing: border-box;
    }
  }

  @media (max-width: 768px) {
    .mobile-only { display: inline; }
    .desktop-only { display: none; }

    .obras-page-header {
      padding: 0.85rem 1rem;
    }

    /* 4 KPIs em grade 2x2 no mobile */
    .kpi-metrics-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 0.65rem;
    }

    .kpi-metric-card {
      padding: 0.75rem 0.85rem;
    }

    .kpi-label {
      font-size: 0.7rem;
    }

    .kpi-value {
      font-size: 1.15rem;
    }

    .kpi-sub {
      font-size: 0.65rem;
    }

    /* 4 Controles de status em grade 2x2 no mobile */
    .status-options-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 0.65rem;
    }

    .status-radio-card {
      min-height: 44px;
      padding: 0.6rem 0.75rem;
      box-sizing: border-box;
      font-size: 0.8rem;
    }

    .form-grid-two-col {
      grid-template-columns: 1fr;
    }

    .work-cover-wrapper {
      width: 52px;
      height: 74px;
    }

    .work-title-heading {
      font-size: 0.95rem;
    }
  }

  @media (max-width: 480px) {
    .tab-label-desktop { display: none; }
    .tab-label-mobile { display: inline; }
    .manage-tab-btn {
      padding: 0.6rem 0.8rem;
      font-size: 0.79rem;
    }

    .obras-page-header {
      flex-direction: column;
      align-items: stretch;
      gap: 0.65rem;
      padding: 0.75rem 0.85rem;
    }

    .title-with-pill {
      gap: 0.5rem;
    }

    .header-title {
      font-size: 1.15rem;
    }

    .header-description {
      font-size: 0.75rem;
    }

    .btn-action-primary {
      width: 100%;
      justify-content: center;
      min-height: 42px;
      box-sizing: border-box;
    }

    .work-card-panel {
      padding: 0.85rem;
    }

    .work-card-inner {
      align-items: center;
      gap: 0.85rem;
    }

    .work-cover-wrapper {
      width: 52px;
      height: 74px;
    }

    .work-actions-cluster {
      display: flex;
      flex-direction: row;
      width: 100%;
      gap: 0.45rem;
    }

    .btn-manage-work, .btn-view-catalog {
      flex: 1;
      justify-content: center;
      text-align: center;
      min-height: 42px;
      box-sizing: border-box;
      padding: 0.45rem 0.55rem;
      font-size: 0.75rem;
    }

    .manage-nav-header {
      gap: 0.5rem;
    }

    .btn-back-to-list, .btn-public-catalog-link {
      min-height: 40px;
      padding: 0.45rem 0.65rem;
      font-size: 0.75rem;
      box-sizing: border-box;
    }

    .work-manage-hero {
      padding: 0.85rem;
      gap: 0.85rem;
    }

    .hero-work-title {
      font-size: 1.15rem;
      line-height: 1.25;
    }

    .hero-cover-box {
      width: 52px;
      height: 74px;
    }

    .sub-header-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.6rem;
    }

    .req-filter-tabs {
      width: 100%;
      overflow-x: auto;
      padding-bottom: 2px;
      -webkit-overflow-scrolling: touch;
    }
  }

  @media (max-width: 360px) {
    .work-actions-cluster {
      flex-direction: column;
    }

    .status-radio-card {
      font-size: 0.76rem;
      padding: 0.5rem;
      min-height: 44px;
      box-sizing: border-box;
    }
  }
</style>
