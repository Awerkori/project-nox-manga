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
    Check,
    Copy
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

  // Technical details accordion state per card
  let openTechnicalDetails = $state<Record<string, boolean>>({});
  function toggleTechnicalDetails(id: string) {
    openTechnicalDetails[id] = !openTechnicalDetails[id];
  }
  function isTechnicalOpen(id: string): boolean {
    return !!openTechnicalDetails[id];
  }

  // 1-click UUID copy tracking
  let copiedKey = $state<string | null>(null);
  let copyTimeout: any = null;

  async function copyToClipboard(text: string, key: string) {
    if (!text) return;
    try {
      if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (typeof document !== 'undefined') {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      copiedKey = key;
      if (copyTimeout) clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => {
        copiedKey = null;
      }, 2000);
    } catch (err) {
      console.warn('Falha ao copiar:', err);
    }
  }

  // Homologation Fixture Modes (Isolated preview testing without DB mutations)
  type FixtureMode = 'REAL' | 'ONE' | 'FIVE' | 'MULTI' | 'EMPTY';
  let fixtureMode = $state<FixtureMode>('REAL');
  let isScenariosMenuOpen = $state(false);
  let isProductionSite = $state(false);

  function getFixtureModeLabel(mode: FixtureMode): string {
    switch (mode) {
      case 'REAL': return `Dados Reais (${realPublishedItems.length})`;
      case 'ONE': return '1 Capítulo';
      case 'FIVE': return '5 Capítulos';
      case 'MULTI': return 'Dezenas (24)';
      case 'EMPTY': return 'Histórico Vazio';
      default: return 'Dados Reais';
    }
  }

  function selectFixture(mode: FixtureMode) {
    fixtureMode = mode;
    currentPage = 1;
    isScenariosMenuOpen = false;
  }

  // Horizontal stage track scrolling & scroll cues
  let stagesScrollContainer = $state<HTMLElement | null>(null);
  let canScrollLeft = $state(false);
  let canScrollRight = $state(false);

  function updateScrollCues() {
    if (!stagesScrollContainer) return;
    const { scrollLeft, scrollWidth, clientWidth } = stagesScrollContainer;
    canScrollLeft = scrollLeft > 8;
    canScrollRight = scrollLeft + clientWidth < scrollWidth - 8;
  }

  function centerActiveStage(smooth = true) {
    if (!stagesScrollContainer) return;
    const activePill = stagesScrollContainer.querySelector('.stage-tab-btn.is-active') as HTMLElement | null;
    if (!activePill) return;

    const containerWidth = stagesScrollContainer.clientWidth;
    const pillLeft = activePill.offsetLeft;
    const pillWidth = activePill.offsetWidth;

    // Center active pill with comfortable margin, leaving previous chips visible
    const targetScroll = Math.max(0, pillLeft - (containerWidth / 2) + (pillWidth / 2));
    stagesScrollContainer.scrollTo({
      left: targetScroll,
      behavior: smooth ? 'smooth' : 'auto'
    });
    updateScrollCues();
  }

  onMount(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname.toLowerCase();
      isProductionSite = host === 'projectnox.org' || host === 'www.projectnox.org';

      if (!isProductionSite) {
        const params = new URLSearchParams(window.location.search);
        const fix = params.get('fixture')?.toUpperCase();
        if (fix === 'ONE' || fix === 'SINGLE') fixtureMode = 'ONE';
        else if (fix === 'FIVE') fixtureMode = 'FIVE';
        else if (fix === 'MULTI' || fix === 'MANY') fixtureMode = 'MULTI';
        else if (fix === 'EMPTY' || fix === 'ZERO') fixtureMode = 'EMPTY';
      } else {
        fixtureMode = 'REAL';
      }
    }

    requestAnimationFrame(() => {
      centerActiveStage(false);
      setTimeout(() => {
        centerActiveStage(true);
        updateScrollCues();
      }, 150);
    });
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

</script>

<div class="publicado-view-root">
  <!-- HOMOLOGATION PREVIEW UTILITY BAR (Discrete control for test scenarios) -->
  {#if !isProductionSite}
    <aside class="homologation-utility-bar" aria-label="Controle de homologação visual">
      <div class="homologation-inner-row">
        <div class="preview-env-badge" title="Ambiente isolado de testes e homologação Cloudflare Preview">
          <span class="preview-pulse-dot"></span>
          <span class="preview-env-label">Cloudflare Preview</span>
        </div>

        <div class="scenarios-dropdown-root">
          <button
            type="button"
            class="btn-scenarios-toggle"
            class:is-active={isScenariosMenuOpen}
            onclick={() => (isScenariosMenuOpen = !isScenariosMenuOpen)}
            aria-expanded={isScenariosMenuOpen}
            aria-haspopup="true"
            title="Alterar cenário visual de teste"
          >
            <Sparkles size={12} class="sparkle-ico" />
            <span class="scenarios-lbl-text">Cenários de teste:</span>
            <span class="scenarios-val-text">{getFixtureModeLabel(fixtureMode)}</span>
            <ChevronDown size={12} class="chevron-arrow {isScenariosMenuOpen ? 'is-flipped' : ''}" />
          </button>

          {#if isScenariosMenuOpen}
            <div
              class="scenarios-backdrop"
              onclick={() => (isScenariosMenuOpen = false)}
              onkeydown={(e) => e.key === 'Escape' && (isScenariosMenuOpen = false)}
              role="presentation"
            ></div>
            <div class="scenarios-popover-menu" role="menu">
              <div class="popover-menu-header">
                <Sparkles size={12} />
                <span>Cenários de Homologação</span>
              </div>
              <button
                type="button"
                class="popover-item"
                class:is-active={fixtureMode === 'REAL'}
                onclick={() => selectFixture('REAL')}
              >
                <div class="popover-item-content">
                  <span class="item-title">Dados Reais ({realPublishedItems.length})</span>
                  <span class="item-desc">Registros oficiais da scan no YugabyteDB</span>
                </div>
                {#if fixtureMode === 'REAL'}
                  <Check size={14} class="check-selected-ico" />
                {/if}
              </button>
              <button
                type="button"
                class="popover-item"
                class:is-active={fixtureMode === 'ONE'}
                onclick={() => selectFixture('ONE')}
              >
                <div class="popover-item-content">
                  <span class="item-title">1 Capítulo</span>
                  <span class="item-desc">Simula publicação única no histórico</span>
                </div>
                {#if fixtureMode === 'ONE'}
                  <Check size={14} class="check-selected-ico" />
                {/if}
              </button>
              <button
                type="button"
                class="popover-item"
                class:is-active={fixtureMode === 'FIVE'}
                onclick={() => selectFixture('FIVE')}
              >
                <div class="popover-item-content">
                  <span class="item-title">5 Capítulos</span>
                  <span class="item-desc">Múltiplas obras e filtros combinados</span>
                </div>
                {#if fixtureMode === 'FIVE'}
                  <Check size={14} class="check-selected-ico" />
                {/if}
              </button>
              <button
                type="button"
                class="popover-item"
                class:is-active={fixtureMode === 'MULTI'}
                onclick={() => selectFixture('MULTI')}
              >
                <div class="popover-item-content">
                  <span class="item-title">Dezenas (24)</span>
                  <span class="item-desc">Teste de paginação e títulos longos</span>
                </div>
                {#if fixtureMode === 'MULTI'}
                  <Check size={14} class="check-selected-ico" />
                {/if}
              </button>
              <button
                type="button"
                class="popover-item"
                class:is-active={fixtureMode === 'EMPTY'}
                onclick={() => selectFixture('EMPTY')}
              >
                <div class="popover-item-content">
                  <span class="item-title">Histórico Vazio</span>
                  <span class="item-desc">Simulação de estado sem publicações</span>
                </div>
                {#if fixtureMode === 'EMPTY'}
                  <Check size={14} class="check-selected-ico" />
                {/if}
              </button>
            </div>
          {/if}
        </div>
      </div>
    </aside>
  {/if}

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
  <div class="stages-nav-shell">
    <div class="stages-scroll-cue-left" class:is-visible={canScrollLeft} aria-hidden="true"></div>
    <nav class="stages-nav-strip" aria-label="Navegação de etapas do pipeline">
      <div
        class="stages-track"
        bind:this={stagesScrollContainer}
        onscroll={updateScrollCues}
      >
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
    <div class="stages-scroll-cue-right" class:is-visible={canScrollRight} aria-hidden="true"></div>
  </div>

  <!-- 3. MAIN HISTORY SECTION -->
  <section class="history-main-section" aria-labelledby="section-heading-history">
    <div class="history-header-row">
      <div class="history-heading-lockup">
        <div class="history-heading-icon">
          <BookOpen size={16} />
        </div>
        <h2 id="section-heading-history" class="history-heading-text">Histórico de Publicações</h2>
      </div>

      {#if searchQuery || filterWorkId !== 'ALL'}
        <div class="active-filter-tag">
          <span>Mostrando {filteredItems.length} de {rawActiveItems.length} capítulos</span>
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
              <!-- Main Info Group (Cover Thumbnail + Title & Meta) -->
              <div class="card-main-info-group">
                <!-- Cover image thumbnail (Desktop 52×74, Mobile 44×62) -->
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
                      <BookOpen size={18} class="fallback-book-ico" />
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
                <!-- TIER 1: Informações principais -->
                <div class="tier1-main-info">
                  <div class="tier-section-badge">
                    <Info size={13} class="tier-badge-ico" />
                    <span>Informações Principais</span>
                  </div>

                  <div class="main-info-grid">
                    <div class="info-kv-cell">
                      <span class="info-kv-label">Publicado em:</span>
                      <span class="info-kv-value highlight-value">
                        {formatDateTime(item.publishedAt)}
                        <span class="rel-time-sub">({formatRelativeDate(item.publishedAt)})</span>
                      </span>
                    </div>

                    <div class="info-kv-cell">
                      <span class="info-kv-label">Publicado por:</span>
                      <span class="info-kv-value">{item.publishedBy || 'Não especificado'}</span>
                    </div>

                    <div class="info-kv-cell">
                      <span class="info-kv-label">Obra:</span>
                      <span class="info-kv-value">
                        {#if item.workSlug && !item.isDemo}
                          <a
                            href="https://projectnox.org/obra/{item.workSlug}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="friendly-catalog-link"
                            title="Ver obra no catálogo oficial de projectnox.org"
                          >
                            <span>{item.workTitle}</span>
                            <ExternalLink size={11} />
                          </a>
                        {:else}
                          <span>{item.workTitle}</span>
                        {/if}
                      </span>
                    </div>

                    <div class="info-kv-cell">
                      <span class="info-kv-label">Capítulo:</span>
                      <span class="info-kv-value">Capítulo #{item.chapterNumber}</span>
                    </div>

                    <div class="info-kv-cell">
                      <span class="info-kv-label">Situação no Catálogo:</span>
                      <span class="info-kv-value">
                        {#if getOfficialReaderUrl(item)}
                          <span class="status-pill-ok">
                            <CheckCircle2 size={12} />
                            Disponível no leitor público
                          </span>
                        {:else}
                          <span class="status-pill-demo">
                            <Sparkles size={12} />
                            Capítulo de Homologação
                          </span>
                        {/if}
                      </span>
                    </div>

                    <div class="info-kv-cell">
                      <span class="info-kv-label">Leitura Pública:</span>
                      <span class="info-kv-value">
                        {#if getOfficialReaderUrl(item)}
                          <a
                            href={getOfficialReaderUrl(item)}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="friendly-catalog-link"
                            title="Abrir capítulo no leitor oficial em projectnox.org"
                          >
                            <span>Abrir no catálogo</span>
                            <ExternalLink size={11} />
                          </a>
                        {:else}
                          <span class="demo-disabled-note">Item de homologação (sem link público)</span>
                        {/if}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- TIER 2: Informações técnicas (Collapsible Sub-Accordion) -->
                <div class="tier2-technical-wrapper">
                  <button
                    type="button"
                    class="tier2-toggle-btn"
                    class:is-open={isTechnicalOpen(item.id)}
                    onclick={() => toggleTechnicalDetails(item.id)}
                    aria-expanded={isTechnicalOpen(item.id)}
                  >
                    <div class="toggle-btn-left">
                      <Layers size={13} class="tier-ico" />
                      <span class="toggle-title">Informações técnicas</span>
                      <span class="toggle-sub">(IDs, versão e conferência)</span>
                    </div>
                    <div class="toggle-btn-right">
                      <span class="toggle-action-hint">{isTechnicalOpen(item.id) ? 'Recolher' : 'Expandir'}</span>
                      <ChevronDown size={14} class="tech-chevron {isTechnicalOpen(item.id) ? 'is-flipped' : ''}" />
                    </div>
                  </button>

                  {#if isTechnicalOpen(item.id)}
                    <div class="tier2-technical-content">
                      <div class="tech-grid">
                        <div class="tech-kv-row">
                          <span class="tech-kv-label">Scan Responsável:</span>
                          <span class="tech-kv-value">{scanName}</span>
                        </div>

                        <div class="tech-kv-row">
                          <span class="tech-kv-label">ID da Produção:</span>
                          <div class="tech-kv-value">
                            {#if item.productionChapterId}
                              <div class="uuid-copy-group">
                                <code class="uuid-code-text" title={item.productionChapterId}>{item.productionChapterId}</code>
                                <button
                                  type="button"
                                  class="btn-copy-uuid"
                                  onclick={() => copyToClipboard(item.productionChapterId, `prod-${item.id}`)}
                                  title="Copiar ID da Produção"
                                  aria-label="Copiar ID da Produção"
                                >
                                  {#if copiedKey === `prod-${item.id}`}
                                    <Check size={12} class="copy-success-ico" />
                                    <span class="copied-pill">Copiado!</span>
                                  {:else}
                                    <Copy size={12} />
                                  {/if}
                                </button>
                              </div>
                            {:else}
                              <span class="tech-fallback-val">Lançamento Direto no Catálogo</span>
                            {/if}
                          </div>
                        </div>

                        <div class="tech-kv-row">
                          <span class="tech-kv-label">ID Público do Capítulo:</span>
                          <div class="tech-kv-value">
                            {#if item.targetChapterId || (isValidChapterUuid(item.id) ? item.id : null)}
                              {@const targetId = item.targetChapterId || item.id}
                              <div class="uuid-copy-group">
                                <code class="uuid-code-text" title={targetId}>{targetId}</code>
                                <button
                                  type="button"
                                  class="btn-copy-uuid"
                                  onclick={() => copyToClipboard(targetId, `cat-${item.id}`)}
                                  title="Copiar ID Público do Capítulo"
                                  aria-label="Copiar ID Público do Capítulo"
                                >
                                  {#if copiedKey === `cat-${item.id}`}
                                    <Check size={12} class="copy-success-ico" />
                                    <span class="copied-pill">Copiado!</span>
                                  {:else}
                                    <Copy size={12} />
                                  {/if}
                                </button>
                              </div>
                            {:else}
                              <span class="tech-fallback-val">Não disponível</span>
                            {/if}
                          </div>
                        </div>

                        <div class="tech-kv-row">
                          <span class="tech-kv-label">Versão Typeset:</span>
                          <span class="tech-kv-value">v{item.typesetVersion || 1} {item.typesetVersion > 1 ? '(Revisada)' : '(Original)'}</span>
                        </div>

                        <div class="tech-kv-row">
                          <span class="tech-kv-label">Conferência Editorial:</span>
                          <span class="tech-kv-value">
                            {#if item.conferenceConfirmedBy}
                              <span class="conf-pill-ok">
                                <CheckCircle2 size={11} />
                                Concluída por {item.conferenceConfirmedBy}
                                {#if item.conferenceConfirmedAt}
                                  em {formatDateTime(item.conferenceConfirmedAt)}
                                {/if}
                              </span>
                            {:else if item.originType === 'CATALOG_DIRECT'}
                              <span class="conf-pill-neutral">Histórico de Catálogo</span>
                            {:else}
                              <span class="conf-pill-neutral">Conferência Editorial Realizada</span>
                            {/if}
                          </span>
                        </div>
                      </div>
                    </div>
                  {/if}
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
     HOMOLOGATION PREVIEW UTILITY BAR (Item 1)
     ------------------------------------------------------------- */
  .homologation-utility-bar {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(59, 130, 246, 0.25);
    border-radius: 8px;
    padding: 0.35rem 0.65rem;
    backdrop-filter: blur(8px);
  }

  .homologation-inner-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    position: relative;
  }

  .preview-env-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.73rem;
    color: #94a3b8;
    font-weight: 500;
  }

  .preview-pulse-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #3b82f6;
    box-shadow: 0 0 8px #3b82f6;
    animation: pulseGlow 2s infinite ease-in-out;
  }

  @keyframes pulseGlow {
    0%, 100% { opacity: 0.6; transform: scale(0.95); }
    50% { opacity: 1; transform: scale(1.1); }
  }

  .preview-env-label {
    letter-spacing: 0.02em;
  }

  /* Scenarios Dropdown */
  .scenarios-dropdown-root {
    position: relative;
  }

  .btn-scenarios-toggle {
    position: relative;
    z-index: 95;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(30, 41, 59, 0.9);
    border: 1px solid rgba(71, 85, 105, 0.6);
    color: #e2e8f0;
    font-size: 0.74rem;
    font-weight: 500;
    padding: 0.3rem 0.65rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-scenarios-toggle:hover {
    background: #334155;
    border-color: #60a5fa;
  }

  .btn-scenarios-toggle.is-active {
    background: #1e3a8a;
    border-color: #3b82f6;
    color: #ffffff;
  }

  .sparkle-ico {
    color: #60a5fa;
    flex-shrink: 0;
  }

  .scenarios-lbl-text {
    color: #94a3b8;
  }

  .scenarios-val-text {
    font-weight: 600;
    color: #f1f5f9;
  }

  .chevron-arrow {
    color: #94a3b8;
    transition: transform 0.2s ease;
  }

  .chevron-arrow.is-flipped {
    transform: rotate(180deg);
  }

  .scenarios-backdrop {
    position: fixed;
    inset: 0;
    z-index: 90;
    background: transparent;
  }

  .scenarios-popover-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    width: 260px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 10px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
    padding: 0.4rem;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    animation: menuFadeIn 0.15s ease;
  }

  @keyframes menuFadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .popover-menu-header {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.7rem;
    font-weight: 700;
    color: #60a5fa;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.35rem 0.5rem 0.25rem;
    border-bottom: 1px solid rgba(51, 65, 85, 0.4);
    margin-bottom: 0.2rem;
  }

  .popover-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    background: transparent;
    border: none;
    padding: 0.45rem 0.55rem;
    border-radius: 6px;
    text-align: left;
    cursor: pointer;
    transition: background 0.12s ease;
    width: 100%;
    box-sizing: border-box;
  }

  .popover-item:hover {
    background: rgba(51, 65, 85, 0.6);
  }

  .popover-item.is-active {
    background: rgba(30, 58, 138, 0.5);
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .popover-item-content {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }

  .item-title {
    font-size: 0.78rem;
    font-weight: 600;
    color: #f1f5f9;
  }

  .item-desc {
    font-size: 0.68rem;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .check-selected-ico {
    color: #3b82f6;
    flex-shrink: 0;
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
     2. STAGE SWITCHER WITH SCROLL CUES (Item 2)
     ------------------------------------------------------------- */
  .stages-nav-shell {
    position: relative;
    width: 100%;
    margin-bottom: 0.25rem;
  }

  .stages-scroll-cue-left,
  .stages-scroll-cue-right {
    position: absolute;
    top: 0;
    bottom: 0.5rem;
    width: 28px;
    pointer-events: none;
    z-index: 5;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .stages-scroll-cue-left {
    left: 0;
    background: linear-gradient(to right, rgba(15, 23, 42, 0.95), transparent);
  }

  .stages-scroll-cue-right {
    right: 0;
    background: linear-gradient(to left, rgba(15, 23, 42, 0.95), transparent);
  }

  .stages-scroll-cue-left.is-visible,
  .stages-scroll-cue-right.is-visible {
    opacity: 1;
  }

  .stages-nav-strip {
    width: 100%;
    border-bottom: 1px solid rgba(51, 65, 85, 0.6);
    padding-bottom: 0.5rem;
  }

  .stages-track {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    overflow-x: auto;
    padding: 0.15rem 0.1rem;
    scrollbar-width: thin;
    scrollbar-color: #334155 transparent;
    scroll-behavior: smooth;
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
    flex-shrink: 0;
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
     3. MAIN HISTORY SECTION (Item 4)
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

  .active-filter-tag {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.78rem;
    color: #94a3b8;
    background: rgba(30, 41, 59, 0.6);
    padding: 0.2rem 0.55rem;
    border-radius: 6px;
    border: 1px solid rgba(51, 65, 85, 0.5);
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
     4. PUBLISHED CARDS LIST & CARD ITEM (Item 3 & Item 7)
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
    justify-content: space-between;
    gap: 1rem;
    padding: 0.85rem 1rem;
  }

  .card-main-info-group {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
    min-width: 0;
  }

  /* Cover Thumbnail (Item 3) */
  .cover-thumb-wrapper {
    width: 52px;
    height: 74px;
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
     5. EXPANDED DETAILS ACCORDION (Item 5)
     ------------------------------------------------------------- */
  .card-expanded-panel {
    background: rgba(15, 23, 42, 0.95);
    border-top: 1px solid #1e293b;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* TIER 1: Informações principais */
  .tier1-main-info {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .tier-section-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.74rem;
    font-weight: 700;
    color: #38bdf8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .tier-badge-ico {
    color: #38bdf8;
  }

  .main-info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 0.75rem 1.25rem;
    background: rgba(30, 41, 59, 0.35);
    border: 1px solid rgba(51, 65, 85, 0.4);
    border-radius: 8px;
    padding: 0.85rem 1rem;
  }

  .info-kv-cell {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .info-kv-label {
    font-size: 0.72rem;
    color: #64748b;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .info-kv-value {
    font-size: 0.82rem;
    color: #f1f5f9;
    font-weight: 500;
  }

  .highlight-value {
    color: #f8fafc;
  }

  .rel-time-sub {
    color: #94a3b8;
    font-size: 0.75rem;
    margin-left: 0.25rem;
  }

  .friendly-catalog-link {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: #38bdf8;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.12s ease;
  }

  .friendly-catalog-link:hover {
    color: #7dd3fc;
    text-decoration: underline;
  }

  .status-pill-ok {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: #4ade80;
    font-size: 0.78rem;
    font-weight: 600;
  }

  .status-pill-demo {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: #facc15;
    font-size: 0.78rem;
    font-weight: 600;
  }

  .demo-disabled-note {
    font-size: 0.78rem;
    color: #94a3b8;
    font-style: italic;
  }

  /* TIER 2: Informações técnicas (Collapsible Sub-Accordion) */
  .tier2-technical-wrapper {
    border: 1px solid rgba(51, 65, 85, 0.5);
    border-radius: 8px;
    overflow: hidden;
    background: rgba(15, 23, 42, 0.5);
  }

  .tier2-toggle-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.55rem 0.85rem;
    background: rgba(30, 41, 59, 0.5);
    border: none;
    color: #cbd5e1;
    font-size: 0.78rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
    text-align: left;
  }

  .tier2-toggle-btn:hover {
    background: rgba(51, 65, 85, 0.6);
  }

  .tier2-toggle-btn.is-open {
    border-bottom: 1px solid rgba(51, 65, 85, 0.4);
  }

  .toggle-btn-left {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .tier-ico {
    color: #a855f7;
    flex-shrink: 0;
  }

  .toggle-title {
    font-weight: 600;
    color: #e2e8f0;
  }

  .toggle-sub {
    font-size: 0.72rem;
    color: #64748b;
  }

  .toggle-btn-right {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .toggle-action-hint {
    font-size: 0.72rem;
    color: #94a3b8;
  }

  .tech-chevron {
    color: #94a3b8;
    transition: transform 0.2s ease;
  }

  .tech-chevron.is-flipped {
    transform: rotate(180deg);
  }

  .tier2-technical-content {
    padding: 0.75rem 0.85rem;
    background: rgba(15, 23, 42, 0.4);
    animation: fadeIn 0.15s ease;
  }

  .tech-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .tech-kv-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    font-size: 0.78rem;
  }

  .tech-kv-label {
    color: #64748b;
    font-weight: 500;
    flex-shrink: 0;
  }

  .tech-kv-value {
    color: #e2e8f0;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .tech-fallback-val {
    color: #94a3b8;
    font-style: italic;
  }

  /* UUID 1-Click Copy Group */
  .uuid-copy-group {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    max-width: 100%;
  }

  .uuid-code-text {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.74rem;
    color: #93c5fd;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(59, 130, 246, 0.3);
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
    max-width: 260px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .btn-copy-uuid {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: rgba(30, 41, 59, 0.8);
    border: 1px solid rgba(71, 85, 105, 0.5);
    color: #cbd5e1;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.7rem;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .btn-copy-uuid:hover {
    background: #334155;
    color: #ffffff;
    border-color: #60a5fa;
  }

  .copy-success-ico {
    color: #22c55e;
  }

  .copied-pill {
    color: #4ade80;
    font-weight: 600;
    font-size: 0.68rem;
  }

  .conf-pill-ok {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: #4ade80;
    font-size: 0.76rem;
    font-weight: 500;
  }

  .conf-pill-neutral {
    color: #94a3b8;
    font-size: 0.76rem;
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
     MOBILE OPTIMIZATIONS (ANDROID: 320px - 430px) (Item 8)
     ------------------------------------------------------------- */
  @media (max-width: 768px) {
    .publicado-view-root {
      padding: 0 0.5rem 4.5rem;
      gap: 0.85rem;
    }

    .publicado-header-bar {
      flex-direction: column;
      align-items: stretch;
      gap: 0.75rem;
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
      height: 42px; /* Minimum ergonomic touch target */
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
      gap: 0.75rem;
      padding: 0.75rem;
    }

    /* Main Info Group: Cover on left, Title & details on right (Item 3) */
    .card-main-info-group {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      width: 100%;
    }

    /* Work Cover on Mobile (44×62px) */
    .cover-thumb-wrapper {
      width: 44px;
      height: 62px;
      border-radius: 6px;
      flex-shrink: 0;
    }

    .card-body-col {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .work-and-status-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.4rem;
      flex-wrap: wrap;
    }

    .chapter-display-title {
      font-size: 0.94rem;
      white-space: normal;
      word-break: break-word;
      line-height: 1.3;
    }

    .meta-inline-strip {
      flex-wrap: wrap;
      gap: 0.25rem 0.45rem;
      font-size: 0.73rem;
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
      font-size: 0.84rem;
    }

    .card-expanded-panel {
      padding: 0.85rem;
      gap: 0.85rem;
    }

    .main-info-grid {
      grid-template-columns: 1fr;
      gap: 0.65rem;
      padding: 0.75rem;
    }

    .tech-kv-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.2rem;
    }

    .tech-kv-value {
      justify-content: flex-start;
      width: 100%;
    }

    .uuid-copy-group {
      width: 100%;
      justify-content: space-between;
    }

    .uuid-code-text {
      max-width: 200px;
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
      font-size: 1.25rem;
    }

    .card-actions-cluster {
      grid-template-columns: 1fr;
      gap: 0.45rem;
    }

    .uuid-code-text {
      max-width: 160px;
    }

    .scenarios-popover-menu {
      width: 230px;
    }
  }
</style>
