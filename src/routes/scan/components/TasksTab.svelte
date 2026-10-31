<script lang="ts">
  import {
    Clock,
    AlertCircle,
    AlertTriangle,
    X,
    Zap,
    RotateCcw,
    Search,
    BookOpen,
    Layers,
    Lock,
    Download,
    Upload,
    FileText,
    Sparkles,
    ShieldCheck,
    History,
    ArrowRight,
    ChevronDown,
    ChevronUp,
    Filter,
    CheckCircle2,
    Briefcase
  } from '@lucide/svelte';
  import { onMount, onDestroy, tick } from 'svelte';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { getSupabaseBrowserClient } from '$lib/supabase';
  import type { RealtimeChannel } from '@supabase/supabase-js';
  import { relativeTime } from '$lib/types';
  import PipelineDeliverableUpload from './PipelineDeliverableUpload.svelte';

  let {
    tasks = [],
    stages = [],
    chapterStages = [],
    productionChapters = [],
    productionFiles = [],
    chapterTimeline = [],
    team = [],
    positions = [],
    userPositions = [],
    works = [],
    currentUserId = '',
    currentScanId = '',
    userRole = 'MEMBER',
    isOwnerOrAdmin = false,
    onOpenChapter = null,
    initialView = 'MINE',
  } = $props();

  // 4 Core Queue View Modes
  type ViewMode = 'MINE' | 'AVAILABLE' | 'WAITING' | 'DONE';
  let activeView = $state<ViewMode>(initialView === 'MINE' ? 'MINE' : 'AVAILABLE');
  let hasInitializedView = $state(false);

  // Filters
  let searchQuery = $state('');
  let selectedWorkFilter = $state<string>('ALL');
  let selectedStageFilter = $state<string>('ALL');
  let selectedPriorityFilter = $state<string>('ALL');

  // Mobile Controls (V7.2 Compact Collapsed-by-Default Architecture)
  let mobileSearchOpen = $state(false);
  let showMobileFilters = $state(false);
  let mobileSearchInputEl = $state<HTMLInputElement | null>(null);

  async function openMobileSearch() {
    mobileSearchOpen = true;
    await tick();
    mobileSearchInputEl?.focus();
  }

  // Pagination for Completed history
  let doneLimit = $state(12);

  // Inline expanded item deliverable view
  let expandedItemIds = $state<Record<string, boolean>>({});
  let stagesWithOpenUploads = $state<Record<string, boolean>>({});

  function toggleExpand(id: string) {
    expandedItemIds = { ...expandedItemIds, [id]: !expandedItemIds[id] };
  }

  function setStageUploadState(chapterStageId: string, hasOpenUploads: boolean) {
    stagesWithOpenUploads = { ...stagesWithOpenUploads, [chapterStageId]: hasOpenUploads };
  }

  // Modals state
  let showTimelineModal = $state(false);
  let selectedTimelineChapter = $state<any>(null);

  let showReturnModal = $state(false);
  let returnSourceStage = $state<any>(null);
  let returnTargetSlug = $state<string>('typeset');
  let returnReason = $state<string>('');

  let showOverrideModal = $state(false);
  let overrideTargetStage = $state<any>(null);
  let overrideAction = $state<string>('FORCE_COMPLETE');
  let overrideReason = $state<string>('');
  let overrideTargetUserId = $state<string>('');

  // Realtime Supabase Channel
  let realtimeChannel: RealtimeChannel | null = null;

  onMount(() => {
    const client = getSupabaseBrowserClient();
    if (!client || !currentScanId) return;

    realtimeChannel = client
      .channel(`scan_queue_sync:${currentScanId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scan_chapter_stages',
          filter: `scan_id=eq.${currentScanId}`
        },
        async () => {
          await invalidateAll();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scan_production_chapters',
          filter: `scan_id=eq.${currentScanId}`
        },
        async () => {
          await invalidateAll();
        }
      )
      .subscribe();
  });

  onDestroy(() => {
    if (realtimeChannel) {
      realtimeChannel.unsubscribe();
    }
  });

  // Effective positions for logged-in user
  let effectivePositions = $derived(
    userPositions && userPositions.length > 0
      ? userPositions
      : (team.find((m: any) => m.id === currentUserId || m.user_id === currentUserId)?.positions || [])
  );

  let userPositionIds = $derived(
    effectivePositions.map((p: any) => p.position_id || p.id).filter(Boolean)
  );

  // Helper to check if a stage is claimable by current user
  function isUserEligibleForStage(wfStage: any): boolean {
    if (isOwnerOrAdmin) return true;
    if (!wfStage) return true;

    if (wfStage.allowed_position_ids && wfStage.allowed_position_ids.length > 0) {
      return wfStage.allowed_position_ids.some((id: string) => userPositionIds.includes(id));
    }

    const sName = (wfStage.name || wfStage.slug || '').toLowerCase();
    return effectivePositions.some((p: any) => {
      const pName = (p.name || '').toLowerCase();
      if (sName.includes('trad') && pName.includes('trad')) return true;
      if (sName.includes('clean') && (pName.includes('clean') || pName.includes('redraw'))) return true;
      if (sName.includes('type') && pName.includes('type')) return true;
      if (sName.includes('revis') && pName.includes('revis')) return true;
      if (sName.includes('qc') && (pName.includes('qc') || pName.includes('qualit'))) return true;
      if (sName.includes('raw') && pName.includes('raw')) return true;
      if ((sName.includes('upar') || sName.includes('ready')) && pName.includes('upload')) return true;
      return false;
    });
  }

  function getStageIcon(slug: string | undefined): string {
    if (!slug) return '💼';
    const s = slug.toLowerCase();
    if (s.includes('clean') || s.includes('redraw')) return '🎨';
    if (s.includes('trad') || s.includes('trans')) return '🌐';
    if (s.includes('type') || s.includes('letr')) return '✒️';
    if (s.includes('qc') || s.includes('revis')) return '🔎';
    if (s.includes('raw')) return '📦';
    return '💼';
  }

  function getStageColor(slug: string | undefined): string {
    if (!slug) return '#8b5cf6';
    const s = slug.toLowerCase();
    if (s.includes('clean') || s.includes('redraw')) return '#ec4899';
    if (s.includes('trad') || s.includes('trans')) return '#3b82f6';
    if (s.includes('type') || s.includes('letr')) return '#eab308';
    if (s.includes('qc') || s.includes('revis')) return '#a855f7';
    if (s.includes('raw')) return '#94a3b8';
    return '#8b5cf6';
  }

  function formatDueDate(dueDateStr: string | null | undefined): string | null {
    if (!dueDateStr) return null;
    const d = new Date(dueDateStr);
    if (isNaN(d.getTime())) return null;
    const diffDays = Math.ceil((d.getTime() - Date.now()) / 86400000);
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Amanhã';
    if (diffDays < 0) return `Atrasado há ${Math.abs(diffDays)} dias`;
    if (diffDays <= 5) return `Em ${diffDays} dias`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  function getDueDiffDays(dueDateStr: string | null | undefined): number {
    if (!dueDateStr) return 0;
    const d = new Date(dueDateStr);
    if (isNaN(d.getTime())) return 0;
    return Math.ceil((d.getTime() - Date.now()) / 86400000);
  }

  function formatBytes(bytes: number) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Unified Item Interface
  interface QueueItem {
    id: string;
    type: 'stage' | 'legacy';
    title: string;
    chapterNumber: number | string | null;
    chapterLabel: string | null;
    workId: string | null;
    workTitle: string;
    coverId: string | null;
    stageName: string;
    stageSlug: string;
    stageIcon: string;
    stageColor: string;
    priority: 'NORMAL' | 'HIGH' | 'URGENT' | 'LOW';
    dueDate: string | null;
    formattedDue: string | null;
    isOverdue: boolean;
    dueDiffDays: number;
    status: string;
    isRework: boolean;
    rejectionReason: string | null;
    assignedTo: string | null;
    claimedAt: string | null;
    lastActivityAt: string | null;
    isStale: boolean;
    staleDays: number;
    eligible: boolean;
    chapter: any | null;
    stage: any | null;
    chapterStage: any | null;
    task: any | null;
    currentFiles: any[];
    allFiles: any[];
    dependencyFiles: any[];
    dependencies: string[];
    completer: any | null;
    completedAt: string | null;
  }

  // Combine stages and legacy tasks
  let allQueueItems = $derived.by(() => {
    const items: QueueItem[] = [];

    // 1. Process scan_chapter_stages
    for (const cs of chapterStages) {
      const ch = productionChapters.find((c: any) => c.id === cs.production_chapter_id) || null;
      const work = ch?.work || (ch?.work_id ? works.find((w: any) => w.id === ch.work_id) : null);
      const wfStage = cs.stage || (cs.stage_id ? stages.find((s: any) => s.id === cs.stage_id) : null);

      const sSlug = wfStage?.slug || 'traducao';
      const sName = wfStage?.name || 'Etapa Editorial';
      const chNum = ch?.chapter_number || ch?.number || null;
      const prio = ch?.priority || 'NORMAL';
      const due = ch?.target_publish_at || null;
      const formattedDue = formatDueDate(due);
      const isOverdue = formattedDue ? formattedDue.includes('Atrasado') : false;

      // Files for this chapter and stage
      const chapterFiles = ch ? productionFiles.filter((f: any) => f.production_chapter_id === ch.id) : [];
      const stageFiles = cs.stage_id ? chapterFiles.filter((f: any) => f.stage_id === cs.stage_id) : [];
      const currentFiles = stageFiles.filter((f: any) => f.is_current);

      // Dependency files
      const depSlugs = wfStage?.dependencies || [];
      const dependencyFiles = chapterFiles.filter((file: any) =>
        file.is_current && depSlugs.includes(file.stage_slug || file.stage?.slug)
      );

      // Stale check
      let isStale = false;
      let staleDays = 0;
      if (cs.status === 'IN_PROGRESS' && (cs.last_activity_at || cs.claimed_at)) {
        const diffMs = Date.now() - new Date(cs.last_activity_at || cs.claimed_at).getTime();
        staleDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (staleDays >= 3) isStale = true;
      }

      items.push({
        id: cs.id,
        type: 'stage',
        title: work?.title || 'Obra em Produção',
        chapterNumber: chNum,
        chapterLabel: ch?.chapter_label || '',
        workId: ch?.work_id || work?.id || null,
        workTitle: work?.title || 'Obra em Produção',
        coverId: work?.cover_id || null,
        stageName: sName,
        stageSlug: sSlug,
        stageIcon: getStageIcon(sSlug),
        stageColor: wfStage?.color || getStageColor(sSlug),
        priority: prio,
        dueDate: due,
        formattedDue,
        isOverdue,
        dueDiffDays: getDueDiffDays(due),
        status: cs.status,
        isRework: cs.status === 'REWORK',
        rejectionReason: cs.rejection_reason || null,
        assignedTo: cs.assigned_to,
        claimedAt: cs.claimed_at,
        lastActivityAt: cs.last_activity_at,
        isStale,
        staleDays,
        eligible: isUserEligibleForStage(wfStage),
        chapter: ch,
        stage: wfStage,
        chapterStage: cs,
        task: null,
        currentFiles,
        allFiles: stageFiles,
        dependencyFiles,
        dependencies: depSlugs,
        completer: cs.completer || null,
        completedAt: cs.completed_at || cs.updated_at || null
      });
    }

    // 2. Process legacy tasks assigned to user
    for (const t of tasks) {
      const ch = t.chapter_id ? (productionChapters.find((c: any) => c.id === t.chapter_id) || null) : null;
      const work = ch ? (ch.work || works.find((w: any) => w.id === ch.work_id)) : (t.work_id ? works.find((w: any) => w.id === t.work_id) : null);
      const chNum = ch?.chapter_number || ch?.number || t.chapter_number || null;
      const sSlug = t.stage_slug || 'minha_fila';
      const isGeneral = !chNum;
      const displayTitle = isGeneral ? (t.title || work?.title || 'Tarefa Geral') : (work?.title || t.title || 'Obra em Produção');
      const due = t.due_date || t.due_at || null;
      const formattedDue = formatDueDate(due);
      const isOverdue = formattedDue ? formattedDue.includes('Atrasado') : false;

      items.push({
        id: t.id,
        type: 'legacy',
        title: displayTitle,
        chapterNumber: chNum,
        chapterLabel: ch?.chapter_label || (isGeneral ? '' : t.title),
        workId: work?.id || t.work_id || null,
        workTitle: displayTitle,
        coverId: isGeneral ? null : (work?.cover_id || null),
        stageName: t.stage_name || (isGeneral ? 'Tarefa Geral' : 'Limpeza & Redraw'),
        stageSlug: sSlug,
        stageIcon: getStageIcon(sSlug),
        stageColor: t.stage_color || getStageColor(sSlug),
        priority: t.priority || 'NORMAL',
        dueDate: due,
        formattedDue,
        isOverdue,
        dueDiffDays: getDueDiffDays(due),
        status: t.status,
        isRework: false,
        rejectionReason: null,
        assignedTo: t.assigned_to || t.assignee_id || null,
        claimedAt: t.created_at || null,
        lastActivityAt: t.updated_at || null,
        isStale: false,
        staleDays: 0,
        eligible: true,
        chapter: ch,
        stage: null,
        chapterStage: null,
        task: t,
        currentFiles: [],
        allFiles: [],
        dependencyFiles: [],
        dependencies: [],
        completer: null,
        completedAt: t.updated_at || null
      });
    }

    return items;
  });

  // Filter items by Work, Stage, Priority, and Search Query
  function applyFilters(list: QueueItem[]) {
    return list.filter((item) => {
      if (selectedWorkFilter !== 'ALL' && item.workId !== selectedWorkFilter) {
        return false;
      }
      if (selectedStageFilter !== 'ALL' && item.stageSlug !== selectedStageFilter) {
        return false;
      }
      if (selectedPriorityFilter !== 'ALL' && item.priority !== selectedPriorityFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = item.workTitle.toLowerCase().includes(q);
        const chMatch = String(item.chapterNumber || '').toLowerCase().includes(q);
        const labelMatch = (item.chapterLabel || '').toLowerCase().includes(q);
        const stageMatch = item.stageName.toLowerCase().includes(q);
        return titleMatch || chMatch || labelMatch || stageMatch;
      }
      return true;
    });
  }

  // 1. EM ANDAMENTO: Chapter stages & tasks actively assigned to logged-in user
  let rawActiveItems = $derived(
    allQueueItems
      .filter((item) => {
        if (item.type === 'stage') {
          return item.assignedTo === currentUserId && (item.status === 'IN_PROGRESS' || item.status === 'REWORK');
        } else {
          return item.assignedTo === currentUserId && item.status !== 'DONE';
        }
      })
      .sort((a, b) => {
        if (a.isRework && !b.isRework) return -1;
        if (!a.isRework && b.isRework) return 1;
        const prioOrder: Record<string, number> = { URGENT: 3, HIGH: 2, NORMAL: 1, LOW: 0 };
        return (prioOrder[b.priority] || 1) - (prioOrder[a.priority] || 1);
      })
  );

  // 2. DISPONÍVEIS PARA MIM: Stages matching user positions that can be claimed
  let rawAvailableItems = $derived(
    allQueueItems.filter((item) => {
      if (item.type !== 'stage') return false;
      if (item.status === 'AVAILABLE' && item.eligible) return true;
      if (item.status === 'REWORK' && !item.assignedTo && item.eligible) return true;
      return false;
    })
  );

  // 3. AGUARDANDO: Blocked stages waiting for predecessor deliverables
  let rawWaitingItems = $derived(
    allQueueItems.filter((item) => {
      if (item.type !== 'stage') return false;
      // Exclude automated release / publication stages (not individual editorial tasks)
      if (item.stageSlug === 'publicado' || item.stageSlug === 'published' || item.stageSlug === 'pre_aprovado') return false;

      const isBlocked = item.status === 'BLOCKED' || item.status === 'WAITING';
      if (!isBlocked) return false;

      // Personal / role criteria: directly assigned to user, OR matching user editorial position in scan
      if (item.assignedTo === currentUserId) return true;
      if (item.eligible && !item.assignedTo) return true;

      return false;
    })
  );

  // 4. CONCLUÍDAS: Tasks and stages completed by logged-in user
  let rawDoneItems = $derived(
    allQueueItems
      .filter((item) => {
        if (item.type === 'stage') {
          const isMine = item.assignedTo === currentUserId || item.completer?.id === currentUserId;
          return (item.status === 'DONE' || item.status === 'SKIPPED') && isMine;
        } else {
          return item.status === 'DONE' && item.assignedTo === currentUserId;
        }
      })
      .sort((a, b) => {
        const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return timeB - timeA;
      })
  );

  // Filtered Lists
  let myActiveItems = $derived(applyFilters(rawActiveItems));
  let availableItems = $derived(applyFilters(rawAvailableItems));
  let waitingItems = $derived(applyFilters(rawWaitingItems));
  let doneItems = $derived(applyFilters(rawDoneItems));

  // Pagination for Done
  let paginatedDoneItems = $derived(doneItems.slice(0, doneLimit));
  let hasMoreDone = $derived(doneItems.length > doneLimit);

  // Auto-select initial view based on active tasks count
  $effect(() => {
    if (!hasInitializedView) {
      if (rawActiveItems.length > 0) {
        activeView = 'MINE';
      } else {
        activeView = 'AVAILABLE';
      }
      hasInitializedView = true;
    }
  });

  // Active filters count for mobile indicator
  let activeFiltersCount = $derived(
    (selectedWorkFilter !== 'ALL' ? 1 : 0) +
    (selectedStageFilter !== 'ALL' ? 1 : 0) +
    (selectedPriorityFilter !== 'ALL' ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0)
  );

  function resetFilters() {
    searchQuery = '';
    selectedWorkFilter = 'ALL';
    selectedStageFilter = 'ALL';
    selectedPriorityFilter = 'ALL';
    showMobileFilters = false;
  }

  // Open Chapter Timeline Modal
  function openChapterTimeline(chapter: any) {
    if (!chapter) return;
    selectedTimelineChapter = chapter;
    showTimelineModal = true;
  }

  // Timeline events & files
  let chapterTimelineEvents = $derived(
    selectedTimelineChapter
      ? chapterTimeline.filter((t: any) => t.production_chapter_id === selectedTimelineChapter.id)
      : []
  );

  let chapterTimelineFiles = $derived(
    selectedTimelineChapter
      ? productionFiles.filter((f: any) => f.production_chapter_id === selectedTimelineChapter.id)
      : []
  );

  // Open Return / Rework Modal
  function openReturnModal(item: QueueItem) {
    returnSourceStage = item;
    returnTargetSlug = 'typeset';
    returnReason = '';
    showReturnModal = true;
  }

  // Open Admin Override Modal
  function openOverrideModal(item: QueueItem) {
    overrideTargetStage = item;
    overrideAction = 'FORCE_COMPLETE';
    overrideReason = '';
    overrideTargetUserId = '';
    showOverrideModal = true;
  }
</script>

<div class="tasks-tab-root">
  <!-- 1. COMPACT PREMIUM HEADER (V7.2) -->
  <header class="queue-header-bar">
    <div class="header-titles">
      <div class="header-badge">
        <Briefcase size={12} />
        <span>Área de Trabalho Pessoal</span>
      </div>
      <div class="title-row">
        <h1 class="tab-title">Minha Fila</h1>
        <span class="active-tasks-pill" class:has-tasks={rawActiveItems.length > 0}>
          <strong>{rawActiveItems.length}</strong> {rawActiveItems.length === 1 ? 'ativo' : 'ativos'}
        </span>
      </div>
      <p class="tab-desc">Gerencie seus trabalhos.</p>
    </div>
  </header>

  <!-- 2. FOUR CATEGORIES NAVIGATION STRIP -->
  <nav class="queue-nav-strip" aria-label="Abas da fila">
    <div class="queue-tabs-grid">
      <button
        type="button"
        class="queue-tab-btn"
        class:active={activeView === 'MINE'}
        onclick={() => (activeView = 'MINE')}
      >
        <div class="tab-label-group">
          <Clock size={15} class="queue-icon blue" />
          <span class="queue-tab-label">Em andamento</span>
        </div>
        <span class="queue-counter-badge count-mine">{rawActiveItems.length}</span>
      </button>

      <button
        type="button"
        class="queue-tab-btn"
        class:active={activeView === 'AVAILABLE'}
        onclick={() => (activeView = 'AVAILABLE')}
      >
        <div class="tab-label-group">
          <Zap size={15} class="queue-icon yellow" />
          <span class="queue-tab-label">Disponíveis<span class="desktop-only-inline">&nbsp;para mim</span></span>
        </div>
        <span class="queue-counter-badge count-available">{rawAvailableItems.length}</span>
      </button>

      <button
        type="button"
        class="queue-tab-btn"
        class:active={activeView === 'WAITING'}
        onclick={() => (activeView = 'WAITING')}
      >
        <div class="tab-label-group">
          <Lock size={15} class="queue-icon purple" />
          <span class="queue-tab-label">Aguardando</span>
        </div>
        <span class="queue-counter-badge count-waiting">{rawWaitingItems.length}</span>
      </button>

      <button
        type="button"
        class="queue-tab-btn"
        class:active={activeView === 'DONE'}
        onclick={() => (activeView = 'DONE')}
      >
        <div class="tab-label-group">
          <CheckCircle2 size={15} class="queue-icon green" />
          <span class="queue-tab-label">Concluídas</span>
        </div>
        <span class="queue-counter-badge count-done">{rawDoneItems.length}</span>
      </button>
    </div>
  </nav>

  <!-- 3. SEARCH & FILTERS ROW -->
  <div class="filter-controls-row">
    <!-- Desktop Search -->
    <div class="search-box desktop-search">
      <Search size={14} class="search-icon" />
      <input
        type="text"
        placeholder="Buscar por obra, capítulo ou etapa..."
        bind:value={searchQuery}
        class="filter-input"
      />
      {#if searchQuery}
        <button type="button" class="btn-clear-search" onclick={() => (searchQuery = '')} aria-label="Limpar busca">
          <X size={13} />
        </button>
      {/if}
    </div>

    <!-- Desktop Select Filters -->
    <div class="desktop-filters">
      <div class="select-wrapper">
        <select bind:value={selectedWorkFilter} class="filter-select">
          <option value="ALL">Todas as Obras ({works.length})</option>
          {#each works as w (w.id)}
            <option value={w.id}>{w.title}</option>
          {/each}
        </select>
      </div>

      <div class="select-wrapper">
        <select bind:value={selectedStageFilter} class="filter-select">
          <option value="ALL">Todas as Etapas</option>
          {#each stages as st (st.id)}
            <option value={st.slug}>{st.name}</option>
          {/each}
        </select>
      </div>

      <div class="select-wrapper">
        <select bind:value={selectedPriorityFilter} class="filter-select">
          <option value="ALL">Todas as Prioridades</option>
          <option value="URGENT">Urgente</option>
          <option value="HIGH">Alta</option>
          <option value="NORMAL">Normal</option>
          <option value="LOW">Baixa</option>
        </select>
      </div>
    </div>

    <!-- Mobile Search & Filter Actions (V7.2 Compact Collapsed-by-Default Architecture) -->
    <div class="mobile-filter-bar">
      {#if mobileSearchOpen}
        <div class="search-box mobile-expanded-search">
          <Search size={14} class="search-icon" />
          <input
            bind:this={mobileSearchInputEl}
            type="text"
            placeholder="Buscar obra, cap ou etapa..."
            bind:value={searchQuery}
            class="filter-input"
          />
          {#if searchQuery}
            <button
              type="button"
              class="btn-clear-search-inline"
              onclick={() => (searchQuery = '')}
              aria-label="Limpar termo de busca"
            >
              <X size={14} />
            </button>
          {/if}
          <button
            type="button"
            class="btn-close-mobile-search"
            onclick={() => (mobileSearchOpen = false)}
            aria-label="Fechar busca"
          >
            <span>Fechar</span>
          </button>
        </div>
      {:else}
        {#if searchQuery}
          <div class="mobile-search-active-pill">
            <button
              type="button"
              class="btn-mobile-search-toggle has-active-query"
              onclick={openMobileSearch}
              aria-label="Editar termo de busca"
            >
              <Search size={14} />
              <span class="active-query-text">"{searchQuery}"</span>
            </button>
            <button
              type="button"
              class="btn-quick-clear-search"
              onclick={() => (searchQuery = '')}
              aria-label="Limpar busca"
              title="Limpar busca"
            >
              <X size={13} />
            </button>
          </div>
        {:else}
          <button
            type="button"
            class="btn-mobile-search-toggle"
            onclick={openMobileSearch}
            aria-label="Abrir campo de busca"
          >
            <Search size={14} />
            <span>Buscar tarefas...</span>
          </button>
        {/if}

        <button
          type="button"
          class="btn-mobile-filter-toggle"
          class:has-active={activeFiltersCount > (searchQuery ? 1 : 0)}
          onclick={() => (showMobileFilters = true)}
          aria-label="Abrir filtros"
        >
          <Filter size={14} />
          <span>Filtros</span>
          {#if activeFiltersCount > (searchQuery ? 1 : 0)}
            <span class="active-badge">{activeFiltersCount - (searchQuery ? 1 : 0)}</span>
          {/if}
        </button>
      {/if}
    </div>
  </div>

  <!-- 4. MAIN QUEUE CONTENT AREA -->
  <main class="queue-content-area">
    <!-- TAB 1: EM ANDAMENTO -->
    {#if activeView === 'MINE'}
      {#if myActiveItems.length === 0}
        <div class="empty-state-box">
          <div class="empty-icon-wrap emerald">
            <CheckCircle2 size={32} />
          </div>
          <h4>Você está em dia com seus trabalhos!</h4>
          <p>Não há nenhuma tarefa em andamento atribuída a você no momento.</p>
          <button type="button" class="btn-empty-action" onclick={() => (activeView = 'AVAILABLE')}>
            <Zap size={14} />
            <span>Ver etapas disponíveis para mim</span>
          </button>
        </div>
      {:else}
        <div class="cards-vertical-list">
          {#each myActiveItems as item (item.id)}
            <article class="task-compact-card in-progress" class:is-rework={item.isRework}>
              <!-- 2-Tiered Main Card Content -->
              <div class="card-main-content">
                <!-- Top Region: Identification (Cover + Details) -->
                <div class="card-identity-region">
                  <!-- Left: 48x64px Cover / Fallback -->
                  <div class="card-visual-col">
                    {#if item.coverId}
                      <img
                        src="/media/{item.coverId}"
                        alt={item.workTitle}
                        class="task-cover-thumb"
                        loading="lazy"
                        onerror={(e) => {
                          const target = e.currentTarget as HTMLElement;
                          target.style.display = 'none';
                          if (target.nextElementSibling) {
                            (target.nextElementSibling as HTMLElement).style.display = 'flex';
                          }
                        }}
                      />
                      <div class="task-stage-icon-fallback" style="display: none;">
                        <Briefcase size={18} class="task-fallback-icon" />
                      </div>
                    {:else}
                      <div class="task-stage-icon-fallback" style="--stage-color: {item.stageColor}">
                        {#if item.stageIcon && item.stageIcon !== '💼'}
                          <span class="fallback-emoji">{item.stageIcon}</span>
                        {:else}
                          <Briefcase size={18} class="task-fallback-icon" />
                        {/if}
                      </div>
                    {/if}
                  </div>

                  <!-- Middle Details: Title, Chapter, Stage, Priority, Status -->
                  <div class="card-details-col">
                    <div class="card-title-row">
                      <h3 class="task-work-name" title={item.workTitle}>
                        {item.workTitle}
                      </h3>
                    </div>

                    <div class="card-meta-row primary-meta">
                      {#if item.chapterNumber}
                        <span class="meta-pill chapter">Capítulo {item.chapterNumber}</span>
                      {/if}

                      <span class="meta-pill stage" style="--stage-c: {item.stageColor}">
                        <span class="dot"></span>
                        {item.stageName}
                      </span>

                      {#if item.priority === 'URGENT'}
                        <span class="meta-pill urgent">Urgente</span>
                      {:else if item.priority === 'HIGH'}
                        <span class="meta-pill high">Alta prioridade</span>
                      {/if}
                    </div>

                    {#if item.isRework || item.isOverdue || item.formattedDue || item.isStale}
                      <div class="card-meta-row secondary-meta">
                        {#if item.isRework}
                          <span class="meta-pill rework">
                            <AlertTriangle size={11} />
                            Retrabalho
                          </span>
                        {/if}

                        {#if item.isOverdue}
                          <span class="meta-pill deadline is-overdue">
                            <Clock size={11} />
                            Atrasado há {Math.abs(item.dueDiffDays || 0)} dias
                          </span>
                        {:else if item.formattedDue}
                          <span class="meta-pill deadline">
                            <Clock size={11} />
                            {item.formattedDue}
                          </span>
                        {/if}

                        {#if item.isStale && !item.isOverdue}
                          <span class="meta-pill stale-inactivity">
                            Sem atividade há {item.staleDays} dias
                          </span>
                        {/if}
                      </div>
                    {/if}
                  </div>
                </div>

                <!-- Bottom Region (Mobile) / Right Column (Desktop): Action Buttons -->
                <div class="card-actions-col">
                  <button
                    type="button"
                    class="btn-action-continue"
                    onclick={() => {
                      if (onOpenChapter && item.chapter) {
                        onOpenChapter(item.chapter);
                      } else {
                        toggleExpand(item.id);
                      }
                    }}
                    title="Continuar este trabalho"
                  >
                    <span>Continuar</span>
                    <ArrowRight size={13} class="btn-arrow-icon" />
                  </button>

                  <button
                    type="button"
                    class="btn-toggle-expand"
                    class:is-expanded={expandedItemIds[item.id]}
                    onclick={() => toggleExpand(item.id)}
                    title={expandedItemIds[item.id] ? "Ocultar arquivos e entrega" : "Gerenciar arquivos e entrega"}
                    aria-label="Gerenciar arquivos e entrega"
                  >
                    <span>Arquivos</span>
                    {#if expandedItemIds[item.id]}
                      <ChevronUp size={13} />
                    {:else}
                      <ChevronDown size={13} />
                    {/if}
                  </button>
                </div>
              </div>

              <!-- Inline Expandable Deliverable / Actions Section -->
              {#if expandedItemIds[item.id]}
                <div class="card-inline-panel">
                  {#if item.rejectionReason}
                    <div class="rework-alert-banner">
                      <AlertCircle size={15} />
                      <div>
                        <strong>Motivo do Retrabalho:</strong>
                        <p>{item.rejectionReason}</p>
                      </div>
                    </div>
                  {/if}

                  <!-- Dependency Downloads -->
                  {#if item.dependencyFiles.length > 0}
                    <div class="panel-section">
                      <span class="section-title"><Download size={13} /> Materiais Pré-requisito (Entrada)</span>
                      <div class="deps-download-list">
                        {#each item.dependencyFiles as depFile (depFile.id)}
                          <a
                            href="/api/scan/production/files/{depFile.id}?download=1"
                            download={depFile.file_name}
                            class="dep-download-chip"
                          >
                            <Download size={12} />
                            <span>{depFile.stage_slug?.toUpperCase()} ({formatBytes(depFile.byte_size)})</span>
                          </a>
                        {/each}
                      </div>
                    </div>
                  {/if}

                  <!-- Deliverable Upload Component -->
                  {#if item.type === 'stage'}
                    <div class="panel-section upload-subpanel">
                      <span class="section-title"><Upload size={13} /> Enviar Arquivo de Entrega</span>
                      <PipelineDeliverableUpload
                        scanId={currentScanId}
                        productionChapterId={item.chapter?.id || item.chapterStage?.production_chapter_id}
                        stageId={item.stage?.id || item.chapterStage?.stage_id}
                        currentFiles={item.currentFiles}
                        onFilesChanged={async () => { await invalidateAll(); }}
                        onUploadStateChange={(open: boolean) => setStageUploadState(item.id, open)}
                      />
                    </div>
                  {/if}

                  <!-- Actions Footer -->
                  <div class="panel-footer-actions">
                    <div class="left-actions">
                      <form method="POST" action="?/releaseStage" use:enhance>
                        <input type="hidden" name="chapter_stage_id" value={item.id} />
                        <button type="submit" class="btn-ghost-sm" title="Liberar tarefa de volta à equipe">
                          <RotateCcw size={12} />
                          <span>Liberar Tarefa</span>
                        </button>
                      </form>

                      {#if ['revisor_qc', 'qc', 'revisao'].includes(item.stageSlug)}
                        <button
                          type="button"
                          class="btn-ghost-sm text-amber-400"
                          onclick={() => openReturnModal(item)}
                          title="Solicitar correção para etapa anterior"
                        >
                          <RotateCcw size={12} />
                          <span>Solicitar Correção</span>
                        </button>
                      {/if}

                      {#if isOwnerOrAdmin}
                        <button
                          type="button"
                          class="btn-ghost-sm text-purple-400"
                          onclick={() => openOverrideModal(item)}
                          title="Ações de Liderança"
                        >
                          <ShieldCheck size={12} />
                          <span>Override</span>
                        </button>
                      {/if}
                    </div>

                    <div class="right-actions">
                      {#if item.type === 'stage'}
                        <form method="POST" action="?/completeStageAction" use:enhance>
                          <input type="hidden" name="chapter_stage_id" value={item.id} />
                          <button
                            type="submit"
                            class="btn-complete-task"
                            disabled={item.stage?.requires_output && item.currentFiles.length === 0}
                            title={item.stage?.requires_output && item.currentFiles.length === 0 ? "Envie um arquivo para concluir" : "Concluir e avançar etapa"}
                          >
                            <CheckCircle2 size={13} />
                            <span>Concluir Etapa</span>
                          </button>
                        </form>
                      {/if}
                    </div>
                  </div>
                </div>
              {/if}
            </article>
          {/each}
        </div>
      {/if}

    <!-- TAB 2: DISPONÍVEIS PARA MIM -->
    {:else if activeView === 'AVAILABLE'}
      {#if availableItems.length === 0}
        <div class="empty-state-box">
          <div class="empty-icon-wrap purple">
            <Layers size={32} />
          </div>
          <h4>Nenhuma etapa disponível para seus cargos</h4>
          <p>Novos capítulos aparecerão aqui assim que as etapas anteriores forem concluídas pela equipe.</p>
        </div>
      {:else}
        <div class="cards-vertical-list">
          {#each availableItems as item (item.id)}
            <article class="task-compact-card available">
              <div class="card-main-content">
                <!-- Top Region: Identification (Cover + Details) -->
                <div class="card-identity-region">
                  <!-- Left: 48x64px Cover -->
                  <div class="card-visual-col">
                    {#if item.coverId}
                      <img src="/media/{item.coverId}" alt={item.workTitle} class="task-cover-thumb" loading="lazy" />
                    {:else}
                      <div class="task-stage-icon-fallback" style="--stage-color: {item.stageColor}">
                        <span class="fallback-emoji">{item.stageIcon}</span>
                      </div>
                    {/if}
                  </div>

                  <!-- Middle: Details -->
                  <div class="card-details-col">
                    <div class="card-title-row">
                      <h3 class="task-work-name" title={item.workTitle}>{item.workTitle}</h3>
                    </div>

                    <div class="card-meta-row primary-meta">
                      {#if item.chapterNumber}
                        <span class="meta-pill chapter">Capítulo {item.chapterNumber}</span>
                      {/if}

                      <span class="meta-pill stage" style="--stage-c: {item.stageColor}">
                        <span class="dot"></span>
                        {item.stageName}
                      </span>

                      {#if item.isRework}
                        <span class="meta-pill rework">
                          <AlertTriangle size={11} />
                          Retrabalho
                        </span>
                      {/if}

                      {#if item.priority === 'URGENT'}
                        <span class="meta-pill urgent">Urgente</span>
                      {:else if item.priority === 'HIGH'}
                        <span class="meta-pill high">Alta</span>
                      {/if}
                    </div>

                    <div class="card-meta-row secondary-meta">
                      {#if item.dependencies.length > 0}
                        <span class="meta-text-muted">Pré-requisito pronto: {item.dependencies.join(', ').toUpperCase()}</span>
                      {:else}
                        <span class="meta-text-muted">Etapa de entrada sem pré-requisitos</span>
                      {/if}
                    </div>
                  </div>
                </div>

                <!-- Right / Bottom: Actions -->
                <div class="card-actions-col">
                  <form method="POST" action="?/claimStage" use:enhance class="action-form-full">
                    <input type="hidden" name="chapter_stage_id" value={item.id} />
                    <button type="submit" class="btn-action-claim" title="Assumir esta etapa para trabalhar">
                      <Zap size={14} />
                      <span>Pegar Tarefa</span>
                    </button>
                  </form>

                  <button
                    type="button"
                    class="btn-timeline-ghost"
                    onclick={() => openChapterTimeline(item.chapter)}
                    title="Ver histórico do capítulo"
                  >
                    <History size={14} />
                    <span>Histórico</span>
                  </button>
                </div>
              </div>
            </article>
          {/each}
        </div>
      {/if}

    <!-- TAB 3: AGUARDANDO -->
    {:else if activeView === 'WAITING'}
      {#if waitingItems.length === 0}
        <div class="empty-state-box">
          <div class="empty-icon-wrap blue">
            <Clock size={32} />
          </div>
          <h4>Nenhuma etapa aguardando liberação</h4>
          <p>Não há capítulos bloqueados aguardando entregas anteriores no momento.</p>
        </div>
      {:else}
        <div class="cards-vertical-list">
          {#each waitingItems as item (item.id)}
            <article class="task-compact-card waiting">
              <div class="card-main-content">
                <!-- Top Region: Identification (Cover + Details) -->
                <div class="card-identity-region">
                  <div class="card-visual-col">
                    {#if item.coverId}
                      <img src="/media/{item.coverId}" alt={item.workTitle} class="task-cover-thumb" loading="lazy" />
                    {:else}
                      <div class="task-stage-icon-fallback" style="--stage-color: {item.stageColor}">
                        <span class="fallback-emoji">{item.stageIcon}</span>
                      </div>
                    {/if}
                  </div>

                  <div class="card-details-col">
                    <div class="card-title-row">
                      <h3 class="task-work-name" title={item.workTitle}>{item.workTitle}</h3>
                    </div>

                    <div class="card-meta-row primary-meta">
                      {#if item.chapterNumber}
                        <span class="meta-pill chapter">Capítulo {item.chapterNumber}</span>
                      {/if}

                      <span class="meta-pill stage" style="--stage-c: {item.stageColor}">
                        <span class="dot"></span>
                        {item.stageName}
                      </span>

                      <span class="meta-pill waiting-status">
                        <Lock size={11} />
                        {#if item.status === 'BLOCKED'}
                          Aguardando etapa anterior
                        {:else if item.assignedTo}
                          Com outro membro
                        {:else}
                          Pendente
                        {/if}
                      </span>
                    </div>

                    <div class="card-meta-row secondary-meta">
                      {#if item.dependencies.length > 0}
                        <span class="meta-text-muted">Depende de: {item.dependencies.join(', ').toUpperCase()}</span>
                      {:else}
                        <span class="meta-text-muted">Aguardando liberação operacional</span>
                      {/if}
                    </div>
                  </div>
                </div>

                <!-- Right / Bottom: Actions -->
                <div class="card-actions-col">
                  <button
                    type="button"
                    class="btn-timeline-ghost full-mobile"
                    onclick={() => openChapterTimeline(item.chapter)}
                    title="Ver linha do tempo"
                  >
                    <History size={14} />
                    <span>Ver Linha do Tempo</span>
                  </button>
                </div>
              </div>
            </article>
          {/each}
        </div>
      {/if}

    <!-- TAB 4: CONCLUÍDAS -->
    {:else if activeView === 'DONE'}
      {#if doneItems.length === 0}
        <div class="empty-state-box">
          <div class="empty-icon-wrap emerald">
            <CheckCircle2 size={32} />
          </div>
          <h4>Nenhuma etapa concluída recente</h4>
          <p>O histórico de tarefas que você finalizou nesta scan será exibido aqui.</p>
        </div>
      {:else}
        <div class="cards-vertical-list">
          {#each paginatedDoneItems as item (item.id)}
            <article class="task-compact-card done">
              <div class="card-main-content">
                <!-- Top Region: Identification (Cover + Details) -->
                <div class="card-identity-region">
                  <div class="card-visual-col">
                    {#if item.coverId}
                      <img src="/media/{item.coverId}" alt={item.workTitle} class="task-cover-thumb" loading="lazy" />
                    {:else}
                      <div class="task-stage-icon-fallback" style="--stage-color: {item.stageColor}">
                        <span class="fallback-emoji">{item.stageIcon}</span>
                      </div>
                    {/if}
                  </div>

                  <div class="card-details-col">
                    <div class="card-title-row">
                      <h3 class="task-work-name" title={item.workTitle}>{item.workTitle}</h3>
                    </div>

                    <div class="card-meta-row primary-meta">
                      {#if item.chapterNumber}
                        <span class="meta-pill chapter">Capítulo {item.chapterNumber}</span>
                      {/if}

                      <span class="meta-pill stage" style="--stage-c: {item.stageColor}">
                        <span class="dot"></span>
                        {item.stageName}
                      </span>

                      <span class="meta-pill completed-pill">
                        <CheckCircle2 size={11} />
                        Concluído
                      </span>
                    </div>

                    {#if item.completedAt}
                      <div class="card-meta-row secondary-meta">
                        <span class="meta-text-muted">Finalizado {relativeTime(item.completedAt)}</span>
                      </div>
                    {/if}
                  </div>
                </div>

                <!-- Right / Bottom: Actions -->
                <div class="card-actions-col">
                  {#if item.chapter}
                    <button
                      type="button"
                      class="btn-action-continue"
                      onclick={() => onOpenChapter && onOpenChapter(item.chapter)}
                      title="Abrir capítulo"
                    >
                      <span>Abrir Capítulo</span>
                      <ArrowRight size={13} class="btn-arrow-icon" />
                    </button>
                  {/if}

                  <button
                    type="button"
                    class="btn-timeline-ghost"
                    onclick={() => openChapterTimeline(item.chapter)}
                    title="Ver linha do tempo"
                  >
                    <History size={14} />
                    <span>Histórico</span>
                  </button>
                </div>
              </div>
            </article>
          {/each}
        </div>

        {#if hasMoreDone}
          <div class="load-more-row">
            <button type="button" class="btn-load-more" onclick={() => (doneLimit += 12)}>
              <span>Carregar mais concluídas ({doneItems.length - doneLimit} restantes)</span>
            </button>
          </div>
        {/if}
      {/if}
    {/if}
  </main>

  <!-- 5. MOBILE FILTER SHEET MODAL -->
  {#if showMobileFilters}
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <div class="modal-sheet-drawer">
        <header class="sheet-header">
          <div class="sheet-title-lockup">
            <Filter size={16} class="text-purple-400" />
            <h3>Filtrar Minha Fila</h3>
          </div>
          <button type="button" class="btn-close-modal" onclick={() => (showMobileFilters = false)} aria-label="Fechar filtros">
            <X size={16} />
          </button>
        </header>

        <div class="sheet-body">
          <div class="sheet-field">
            <label for="mob-filter-work">Obra</label>
            <select id="mob-filter-work" bind:value={selectedWorkFilter} class="modal-select">
              <option value="ALL">Todas as Obras ({works.length})</option>
              {#each works as w (w.id)}
                <option value={w.id}>{w.title}</option>
              {/each}
            </select>
          </div>

          <div class="sheet-field">
            <label for="mob-filter-stage">Etapa Editorial</label>
            <select id="mob-filter-stage" bind:value={selectedStageFilter} class="modal-select">
              <option value="ALL">Todas as Etapas</option>
              {#each stages as st (st.id)}
                <option value={st.slug}>{st.name}</option>
              {/each}
            </select>
          </div>

          <div class="sheet-field">
            <label for="mob-filter-prio">Prioridade</label>
            <select id="mob-filter-prio" bind:value={selectedPriorityFilter} class="modal-select">
              <option value="ALL">Todas as Prioridades</option>
              <option value="URGENT">Urgente</option>
              <option value="HIGH">Alta</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Baixa</option>
            </select>
          </div>
        </div>

        <footer class="sheet-footer">
          <button type="button" class="btn-cancel" onclick={resetFilters}>
            Limpar Filtros
          </button>
          <button type="button" class="btn-primary-action" onclick={() => (showMobileFilters = false)}>
            Aplicar
          </button>
        </footer>
      </div>
    </div>
  {/if}

  <!-- 6. MODAL: RETRABALHO / SOLICITAR CORREÇÃO -->
  {#if showReturnModal && returnSourceStage}
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <div class="modal-card">
        <header class="modal-header">
          <div class="modal-title-wrap">
            <RotateCcw size={18} class="text-rose-400" />
            <h3>Solicitar Correção / Retrabalho</h3>
          </div>
          <button type="button" class="btn-close-modal" onclick={() => (showReturnModal = false)}>
            <X size={16} />
          </button>
        </header>

        <form method="POST" action="?/returnStageAction" use:enhance={() => {
          return async ({ result }) => {
            if (result.type === 'success') {
              showReturnModal = false;
              await invalidateAll();
            }
          };
        }}>
          <input type="hidden" name="source_stage_id" value={returnSourceStage.id} />

          <div class="modal-body">
            <p class="modal-instruction">
              O capítulo <strong>#{returnSourceStage.chapterNumber}</strong> voltará com status <strong>REWORK</strong> para a etapa selecionada. Após corrigido, retornará para validação.
            </p>

            <div class="modal-field">
              <label for="target-stage-slug">Etapa de Destino para Correção</label>
              <select id="target-stage-slug" name="target_stage_slug" bind:value={returnTargetSlug} class="modal-select">
                <option value="raw">Raw Provider (Qualidade Original)</option>
                <option value="traducao">Tradução (Sentido / Ortografia)</option>
                <option value="clean_redraw">Clean/Redraw (Limpeza / Reconstrução)</option>
                <option value="typeset">Typeset (Diagramação / Balões / Fontes)</option>
              </select>
            </div>

            <div class="modal-field">
              <label for="return-reason">Motivo Detalhado da Correção *</label>
              <textarea
                id="return-reason"
                name="reason"
                bind:value={returnReason}
                rows="4"
                class="modal-textarea"
                placeholder="Explique o que precisa ser ajustado (ex: balão da pág. 4 cortado, fonte incorreta no grito pág. 12)..."
                required
              ></textarea>
            </div>
          </div>

          <footer class="modal-footer">
            <button type="button" class="btn-cancel" onclick={() => (showReturnModal = false)}>Cancelar</button>
            <button type="submit" class="btn-danger-action" disabled={returnReason.trim().length < 3}>
              <RotateCcw size={14} />
              <span>Enviar para Correção</span>
            </button>
          </footer>
        </form>
      </div>
    </div>
  {/if}

  <!-- 7. MODAL: ADMIN OVERRIDE -->
  {#if showOverrideModal && overrideTargetStage}
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <div class="modal-card">
        <header class="modal-header">
          <div class="modal-title-wrap">
            <ShieldCheck size={18} class="text-amber-400" />
            <h3>Ação de Liderança (Override)</h3>
          </div>
          <button type="button" class="btn-close-modal" onclick={() => (showOverrideModal = false)}>
            <X size={16} />
          </button>
        </header>

        <form method="POST" action="?/adminOverrideStage" use:enhance={() => {
          return async ({ result }) => {
            if (result.type === 'success') {
              showOverrideModal = false;
              await invalidateAll();
            }
          };
        }}>
          <input type="hidden" name="chapter_stage_id" value={overrideTargetStage.id} />

          <div class="modal-body">
            <div class="modal-field">
              <label for="override-action-select">Ação de Override</label>
              <select id="override-action-select" name="override_action" bind:value={overrideAction} class="modal-select">
                <option value="FORCE_COMPLETE">Forçar Conclusão (Marcar como Feito)</option>
                <option value="FORCE_SKIP">Pular Etapa (Autorizar sem arquivo)</option>
                <option value="REOPEN">Reabrir Etapa (Tornar Disponível)</option>
                <option value="RECLAIM">Reassumir / Liberar Tarefa (Remover responsável)</option>
                <option value="TRANSFER">Transferir para Outro Membro</option>
              </select>
            </div>

            {#if overrideAction === 'TRANSFER'}
              <div class="modal-field">
                <label for="target-user-select">Novo Membro Responsável</label>
                <select id="target-user-select" name="target_user_id" bind:value={overrideTargetUserId} class="modal-select" required>
                  <option value="">Selecione um membro...</option>
                  {#each team as m (m.id)}
                    <option value={m.id}>{m.display_name || m.username}</option>
                  {/each}
                </select>
              </div>
            {/if}

            <div class="modal-field">
              <label for="override-reason">Justificativa do Override * (Auditoria)</label>
              <textarea
                id="override-reason"
                name="reason"
                bind:value={overrideReason}
                rows="3"
                class="modal-textarea"
                placeholder="Informe o motivo desta intervenção administrativa..."
                required
              ></textarea>
            </div>
          </div>

          <footer class="modal-footer">
            <button type="button" class="btn-cancel" onclick={() => (showOverrideModal = false)}>Cancelar</button>
            <button type="submit" class="btn-primary-action" disabled={overrideReason.trim().length < 3}>
              <span>Confirmar Override</span>
            </button>
          </footer>
        </form>
      </div>
    </div>
  {/if}

  <!-- 8. MODAL: TIMELINE & VERSIONS HISTORY -->
  {#if showTimelineModal && selectedTimelineChapter}
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <div class="modal-card wide">
        <header class="modal-header">
          <div class="modal-title-wrap">
            <History size={18} class="text-blue-400" />
            <h3>Histórico: {selectedTimelineChapter.work?.title} #{selectedTimelineChapter.chapter_number}</h3>
          </div>
          <button type="button" class="btn-close-modal" onclick={() => (showTimelineModal = false)}>
            <X size={16} />
          </button>
        </header>

        <div class="modal-body">
          <section class="modal-sub-block">
            <h4>Arquivos Enviados & Versões</h4>
            {#if chapterTimelineFiles.length === 0}
              <p class="text-muted-sm">Nenhum arquivo enviado para este capítulo ainda.</p>
            {:else}
              <div class="files-table-wrapper">
                <table class="files-table">
                  <thead>
                    <tr>
                      <th>Versão</th>
                      <th>Etapa</th>
                      <th>Nome do Arquivo</th>
                      <th>Tamanho</th>
                      <th>Enviado por</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each chapterTimelineFiles as f (f.id)}
                      <tr class:is-current={f.is_current}>
                        <td>
                          <span class="version-tag" class:current={f.is_current}>v{f.version}</span>
                        </td>
                        <td><strong>{f.stage_slug?.toUpperCase() || f.stage?.name || 'RAW'}</strong></td>
                        <td>{f.file_name}</td>
                        <td>{formatBytes(f.byte_size)}</td>
                        <td>{f.uploader?.display_name || f.uploader?.username || 'Membro'}</td>
                        <td>
                          <a href="/api/scan/production/files/{f.id}?download=1" download={f.file_name} class="btn-icon-link">
                            <Download size={14} />
                          </a>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </section>

          <section class="modal-sub-block">
            <h4>Linha do Tempo de Eventos</h4>
            {#if chapterTimelineEvents.length === 0}
              <p class="text-muted-sm">Nenhum evento registrado ainda.</p>
            {:else}
              <div class="timeline-list">
                {#each chapterTimelineEvents as evt (evt.id)}
                  <div class="timeline-entry">
                    <div class="timeline-dot"></div>
                    <div class="timeline-info">
                      <div class="timeline-row">
                        <strong>{evt.event_type}</strong>
                        <span class="timeline-date">{relativeTime(evt.created_at)}</span>
                      </div>
                      <p class="timeline-actor">Por {evt.user_name || 'Sistema'}</p>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </section>
        </div>

        <footer class="modal-footer">
          <button type="button" class="btn-cancel" onclick={() => (showTimelineModal = false)}>Fechar</button>
        </footer>
      </div>
    </div>
  {/if}
</div>

<style>
  .tasks-tab-root {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 1440px;
    margin: 0 auto;
    padding-bottom: 48px;
    box-sizing: border-box;
  }

  /* 1. Header Bar (V7.2 Compact & Direct) */
  .queue-header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 72px;
    padding: 16px 22px;
    background: rgba(18, 14, 28, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    backdrop-filter: blur(12px);
  }

  .header-titles {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .header-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #a855f7;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .tab-title {
    font-size: 1.4375rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  .active-tasks-pill {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    background: rgba(255, 255, 255, 0.06);
    color: #94a3b8;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .active-tasks-pill.has-tasks {
    background: rgba(168, 85, 247, 0.12);
    color: #c084fc;
    border-color: rgba(168, 85, 247, 0.25);
  }

  .active-tasks-pill strong {
    font-weight: 700;
    margin-right: 4px;
    color: #f8fafc;
  }

  .tab-desc {
    font-size: 0.875rem;
    color: #94a3b8;
    margin: 0;
  }

  /* 2. Four Categories Navigation Bar */
  .queue-nav-strip {
    display: flex;
    align-items: center;
    width: 100%;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .queue-tabs-grid {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding-bottom: 8px;
  }

  .queue-tab-btn {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    height: 42px;
    padding: 0 18px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    user-select: none;
  }

  .tab-label-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .queue-tab-btn:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .queue-tab-btn.active {
    color: #f8fafc;
    background: rgba(168, 85, 247, 0.16);
    border-color: rgba(168, 85, 247, 0.4);
    font-weight: 600;
  }

  :global(.queue-icon.blue) {
    color: #60a5fa;
  }
  :global(.queue-icon.yellow) {
    color: #facc15;
  }
  :global(.queue-icon.purple) {
    color: #c084fc;
  }
  :global(.queue-icon.green) {
    color: #4ade80;
  }

  .queue-counter-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 7px;
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.08);
    color: #e2e8f0;
  }

  .queue-tab-btn.active .queue-counter-badge {
    background: rgba(168, 85, 247, 0.4);
    color: #ffffff;
  }

  /* 3. Search & Filter Bar */
  .filter-controls-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .desktop-search {
    flex: 1 1 280px;
    max-width: 360px;
  }

  .search-box {
    position: relative;
    display: flex;
    align-items: center;
  }

  :global(.search-icon) {
    position: absolute;
    left: 12px;
    color: #64748b;
    pointer-events: none;
  }

  .filter-input {
    width: 100%;
    height: 40px;
    padding: 0 32px 0 36px;
    background: rgba(20, 16, 32, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    font-size: 0.875rem;
    color: #f1f5f9;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .filter-input:focus {
    border-color: rgba(168, 85, 247, 0.5);
    box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.2);
  }

  .btn-clear-search {
    position: absolute;
    right: 8px;
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 4px;
    border-radius: 4px;
  }

  .desktop-filters {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .select-wrapper {
    position: relative;
  }

  .filter-select {
    height: 40px;
    padding: 0 16px;
    background: rgba(20, 16, 32, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    font-size: 0.875rem;
    color: #cbd5e1;
    outline: none;
    cursor: pointer;
    transition: border-color 0.15s ease;
  }

  .filter-select:focus {
    border-color: rgba(168, 85, 247, 0.5);
  }

  .mobile-filter-bar {
    display: none;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .btn-mobile-search-toggle,
  .btn-mobile-filter-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding: 0 14px;
    background: rgba(20, 16, 32, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    font-size: 0.8125rem;
    color: #cbd5e1;
    cursor: pointer;
  }

  .btn-mobile-search-toggle {
    flex: 1 1 0%;
  }

  .mobile-search-active-pill {
    display: flex;
    align-items: center;
    flex: 1 1 0%;
    height: 38px;
    background: rgba(168, 85, 247, 0.12);
    border: 1px solid rgba(168, 85, 247, 0.35);
    border-radius: 8px;
    padding: 0 4px 0 12px;
    gap: 6px;
  }

  .mobile-search-active-pill .btn-mobile-search-toggle {
    border: none;
    background: transparent;
    padding: 0;
    height: auto;
    color: #f1f5f9;
    font-weight: 500;
    flex: 1 1 0%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .btn-quick-clear-search {
    background: rgba(255, 255, 255, 0.08);
    border: none;
    color: #cbd5e1;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
  }

  .btn-quick-clear-search:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #ffffff;
  }

  .btn-mobile-filter-toggle.has-active {
    border-color: rgba(168, 85, 247, 0.4);
    background: rgba(168, 85, 247, 0.1);
    color: #e2e8f0;
  }

  .active-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border-radius: 9999px;
    background: #a855f7;
    color: #ffffff;
    font-size: 0.6875rem;
    font-weight: 700;
  }

  .mobile-expanded-search {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
    position: relative;
  }

  .mobile-expanded-search .filter-input {
    height: 38px;
    padding: 0 32px 0 34px;
    font-size: 0.8125rem;
  }

  .btn-close-mobile-search {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    height: 38px;
    padding: 0 12px;
    color: #cbd5e1;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    flex-shrink: 0;
  }

  .btn-clear-search-inline {
    position: absolute;
    right: 76px;
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 4px;
  }

  /* 4. Queue Cards List */
  .queue-content-area {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  .cards-vertical-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  /* Card Base (76–100px height on Desktop) */
  .task-compact-card {
    display: flex;
    flex-direction: column;
    background: rgba(20, 16, 32, 0.72);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    overflow: hidden;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .task-compact-card:hover {
    border-color: rgba(168, 85, 247, 0.35);
    box-shadow: 0 4px 20px rgba(124, 58, 237, 0.08);
  }

  .task-compact-card.is-rework {
    border-color: rgba(245, 158, 11, 0.4);
    background: rgba(28, 20, 24, 0.75);
  }

  .card-main-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 20px;
    min-height: 88px;
    box-sizing: border-box;
  }

  .card-identity-region {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1 1 0%;
    min-width: 0;
  }

  /* Left Cover (Desktop 52x70px) */
  .card-visual-col {
    flex-shrink: 0;
    width: 52px;
    height: 70px;
    border-radius: 6px;
    overflow: hidden;
    background: #140f22;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .task-cover-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .task-stage-icon-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, rgba(20, 16, 32, 0.8) 100%);
  }

  .fallback-emoji {
    font-size: 1.25rem;
  }

  :global(.task-fallback-icon) {
    color: #a855f7;
  }

  /* Middle Details */
  .card-details-col {
    flex: 1 1 0%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .card-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .task-work-name {
    font-size: 1.0625rem;
    font-weight: 650;
    color: #f8fafc;
    margin: 0;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-meta-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .meta-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1.4;
  }

  .meta-pill.chapter {
    background: rgba(255, 255, 255, 0.08);
    color: #f1f5f9;
    font-weight: 600;
  }

  .meta-pill.stage {
    background: color-mix(in srgb, var(--stage-c, #8b5cf6) 15%, transparent);
    color: color-mix(in srgb, var(--stage-c, #8b5cf6) 90%, #ffffff);
    border: 1px solid color-mix(in srgb, var(--stage-c, #8b5cf6) 30%, transparent);
  }

  .meta-pill.stage .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--stage-c, #8b5cf6);
  }

  .meta-pill.urgent {
    background: rgba(244, 63, 94, 0.15);
    color: #fb7185;
    border: 1px solid rgba(244, 63, 94, 0.3);
  }

  .meta-pill.high {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .meta-pill.rework {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.4);
    font-weight: 600;
  }

  .meta-pill.deadline {
    background: rgba(255, 255, 255, 0.05);
    color: #94a3b8;
  }

  .meta-pill.deadline.is-overdue {
    background: rgba(239, 68, 68, 0.14);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
    font-weight: 600;
  }

  .meta-pill.stale-inactivity {
    background: rgba(251, 191, 36, 0.08);
    color: #fbbf24;
    border: 1px solid rgba(251, 191, 36, 0.2);
    font-size: 0.6875rem;
    font-weight: 500;
  }

  .meta-pill.waiting-status {
    background: rgba(148, 163, 184, 0.1);
    color: #cbd5e1;
  }

  .meta-pill.completed-pill {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .meta-text-muted {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  /* Right Actions */
  .card-actions-col {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .btn-action-continue {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 40px;
    padding: 0 18px;
    background: linear-gradient(135deg, #9333ea 0%, #7c3aed 100%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    color: #ffffff;
    cursor: pointer;
    transition: transform 0.12s ease, filter 0.15s ease;
  }

  .btn-action-continue:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  :global(.btn-arrow-icon) {
    transition: transform 0.12s ease;
  }
  .btn-action-continue:hover :global(.btn-arrow-icon) {
    transform: translateX(2px);
  }

  .btn-action-claim {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 40px;
    padding: 0 18px;
    background: #a855f7;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    color: #ffffff;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.12s ease;
  }

  .btn-action-claim:hover {
    background: #9333ea;
    transform: translateY(-1px);
  }

  .btn-toggle-expand {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 40px;
    padding: 0 14px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #cbd5e1;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-toggle-expand:hover,
  .btn-toggle-expand.is-expanded {
    background: rgba(255, 255, 255, 0.1);
    color: #f8fafc;
  }

  .btn-timeline-ghost {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 36px;
    padding: 0 12px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    font-size: 0.75rem;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-timeline-ghost:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #f1f5f9;
  }

  /* Inline Expandable Panel */
  .card-inline-panel {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(14, 11, 22, 0.65);
  }

  .rework-alert-banner {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 8px;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #fde68a;
    font-size: 0.8125rem;
  }

  .rework-alert-banner strong {
    color: #fbbf24;
  }

  .rework-alert-banner p {
    margin: 2px 0 0;
    color: #fef3c7;
  }

  .panel-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #cbd5e1;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .deps-download-list {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .dep-download-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 0.75rem;
    color: #93c5fd;
    text-decoration: none;
    transition: background 0.15s ease;
  }

  .dep-download-chip:hover {
    background: rgba(59, 130, 246, 0.15);
  }

  .panel-footer-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }

  .left-actions,
  .right-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-ghost-sm {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 32px;
    padding: 0 10px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    font-size: 0.75rem;
    color: #94a3b8;
    cursor: pointer;
  }

  .btn-ghost-sm:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #f1f5f9;
  }

  .btn-complete-task {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px;
    background: #10b981;
    border: none;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #ffffff;
    cursor: pointer;
  }

  .btn-complete-task:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* Empty State */
  .empty-state-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 48px 24px;
    background: rgba(18, 14, 28, 0.5);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    margin: 12px 0;
  }

  .empty-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    margin-bottom: 16px;
  }

  .empty-icon-wrap.emerald {
    background: rgba(16, 185, 129, 0.12);
    color: #34d399;
  }

  .empty-icon-wrap.purple {
    background: rgba(168, 85, 247, 0.12);
    color: #c084fc;
  }

  .empty-icon-wrap.blue {
    background: rgba(59, 130, 246, 0.12);
    color: #60a5fa;
  }

  .empty-state-box h4 {
    font-size: 1.0625rem;
    font-weight: 600;
    color: #f1f5f9;
    margin: 0 0 6px;
  }

  .empty-state-box p {
    font-size: 0.875rem;
    color: #94a3b8;
    margin: 0 0 18px;
    max-width: 440px;
  }

  .btn-empty-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding: 0 16px;
    background: rgba(168, 85, 247, 0.15);
    border: 1px solid rgba(168, 85, 247, 0.3);
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #c084fc;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-empty-action:hover {
    background: rgba(168, 85, 247, 0.25);
    color: #ffffff;
  }

  .load-more-row {
    display: flex;
    justify-content: center;
    padding: 16px 0;
  }

  .btn-load-more {
    height: 38px;
    padding: 0 20px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    font-size: 0.8125rem;
    color: #cbd5e1;
    cursor: pointer;
  }

  .btn-load-more:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #f8fafc;
  }

  /* Modals */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 100;
  }

  .modal-card {
    background: #141022;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  }

  .modal-card.wide {
    max-width: 780px;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .modal-title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .modal-title-wrap h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #f8fafc;
    margin: 0;
  }

  .btn-close-modal {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
  }

  .modal-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .modal-instruction {
    font-size: 0.875rem;
    color: #94a3b8;
    margin: 0;
    line-height: 1.5;
  }

  .modal-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .modal-field label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #cbd5e1;
    text-transform: uppercase;
  }

  .modal-select,
  .modal-textarea {
    width: 100%;
    padding: 10px 12px;
    background: rgba(20, 16, 32, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    font-size: 0.875rem;
    color: #f1f5f9;
    outline: none;
    box-sizing: border-box;
  }

  .modal-select:focus,
  .modal-textarea:focus {
    border-color: rgba(168, 85, 247, 0.5);
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(10, 7, 18, 0.5);
  }

  .btn-cancel {
    height: 36px;
    padding: 0 16px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    font-size: 0.8125rem;
    color: #94a3b8;
    cursor: pointer;
  }

  .btn-danger-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 16px;
    background: #ef4444;
    border: none;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #ffffff;
    cursor: pointer;
  }

  .btn-primary-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 16px;
    background: #a855f7;
    border: none;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #ffffff;
    cursor: pointer;
  }

  /* Mobile Sheet Drawer */
  .modal-sheet-drawer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #141022;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px 16px 0 0;
    max-height: 85vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding: 0;
    animation: slideUpSheet 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes slideUpSheet {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .sheet-title-lockup {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sheet-title-lockup h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #f8fafc;
  }

  .sheet-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .sheet-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .sheet-field label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #cbd5e1;
    text-transform: uppercase;
  }

  .sheet-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 20px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .sheet-footer .btn-cancel,
  .sheet-footer .btn-primary-action {
    flex: 1 1 0%;
  }

  /* Table for Timeline */
  .modal-sub-block {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .modal-sub-block h4 {
    margin: 0;
    font-size: 0.875rem;
    color: #e2e8f0;
  }

  .files-table-wrapper {
    overflow-x: auto;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
  }

  .files-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.75rem;
    text-align: left;
  }

  .files-table th {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.04);
    color: #94a3b8;
    font-weight: 600;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .files-table td {
    padding: 8px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    color: #cbd5e1;
  }

  .version-tag {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    font-weight: 600;
  }

  .version-tag.current {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
  }

  .btn-icon-link {
    display: inline-flex;
    align-items: center;
    padding: 4px 8px;
    color: #93c5fd;
    text-decoration: none;
    border-radius: 4px;
    background: rgba(59, 130, 246, 0.1);
  }

  .timeline-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 200px;
    overflow-y: auto;
  }

  .timeline-entry {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 0.8125rem;
  }

  .timeline-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #a855f7;
    margin-top: 5px;
  }

  .timeline-info {
    flex: 1 1 0%;
  }

  .timeline-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .timeline-date {
    color: #64748b;
    font-size: 0.6875rem;
  }

  .timeline-actor {
    margin: 2px 0 0;
    color: #94a3b8;
    font-size: 0.75rem;
  }

  .desktop-only-inline {
    display: inline;
  }

  /* 5. Responsive Breakpoints */
  @media (max-width: 768px) {
    .tasks-tab-root {
      gap: 10px;
    }

    .queue-header-bar {
      padding: 8px 12px;
      min-height: auto;
      margin-bottom: 0px;
    }

    .header-badge {
      display: none;
    }

    .tab-title {
      font-size: 1.125rem;
      line-height: 1.2;
    }

    .active-tasks-pill {
      font-size: 0.75rem;
      padding: 2px 8px;
    }

    .tab-desc {
      font-size: 0.75rem;
      color: #94a3b8;
    }

    .desktop-search,
    .desktop-filters {
      display: none;
    }

    .mobile-filter-bar {
      display: flex;
    }

    .desktop-only-inline {
      display: none;
    }

    /* 4 Categories Navigation in 2x2 Grid (Rodada 21 V7.2) */
    .queue-nav-strip {
      border-bottom: none;
      margin-bottom: 0px;
    }

    .queue-tabs-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      width: 100%;
      padding-bottom: 0;
    }

    .queue-tab-btn {
      height: 46px;
      min-height: 46px;
      padding: 0 10px;
      box-sizing: border-box;
      font-size: 0.8125rem;
      border-radius: 8px;
      width: 100%;
    }

    .tab-label-group {
      gap: 6px;
      min-width: 0;
    }

    .queue-tab-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* 2-Tiered Mobile Card Composition (Rodada 21 V7.2 - Compact 12-15% Height Reduction) */
    .cards-vertical-list {
      gap: 8px;
    }

    .card-main-content {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
      padding: 10px 12px;
      min-height: auto;
    }

    .card-identity-region {
      align-items: flex-start;
      gap: 10px;
      width: 100%;
    }

    .card-visual-col {
      width: 44px;
      height: 58px;
      flex-shrink: 0;
      border-radius: 6px;
    }

    .card-details-col {
      gap: 3px;
    }

    .task-work-name {
      font-size: 0.9375rem;
      white-space: normal;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      line-height: 1.3;
    }

    .card-meta-row {
      gap: 4px;
      margin-top: 2px;
    }

    .meta-pill {
      padding: 2px 6px;
      font-size: 0.6875rem;
      border-radius: 4px;
    }

    .card-actions-col {
      display: flex;
      flex-direction: row;
      gap: 8px;
      width: 100%;
      padding-top: 6px;
      margin-top: 2px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      align-items: stretch;
    }

    .card-actions-col .action-form-full {
      flex: 1.2 1 0%;
      display: flex;
    }

    .btn-action-continue,
    .btn-action-claim {
      flex: 1.2 1 0%;
      height: 44px;
      min-height: 44px;
      padding: 0 12px;
      justify-content: center;
      font-size: 0.8125rem;
      width: 100%;
    }

    .btn-toggle-expand,
    .btn-timeline-ghost {
      flex: 1 1 0%;
      height: 44px;
      min-height: 44px;
      padding: 0 10px;
      justify-content: center;
      font-size: 0.8125rem;
    }

    .btn-timeline-ghost.full-mobile {
      width: 100%;
    }

    .panel-footer-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .left-actions,
    .right-actions {
      width: 100%;
      justify-content: stretch;
    }

    .btn-complete-task {
      width: 100%;
      height: 44px;
      justify-content: center;
    }
  }

  @media (max-width: 360px) {
    .queue-tab-btn {
      height: 44px;
      min-height: 44px;
      padding: 0 6px;
      font-size: 0.75rem;
    }

    .queue-counter-badge {
      padding: 1px 4px;
      font-size: 0.625rem;
    }

    .card-visual-col {
      width: 40px;
      height: 52px;
    }

    .task-work-name {
      font-size: 0.875rem;
    }

    .btn-action-continue,
    .btn-action-claim,
    .btn-toggle-expand,
    .btn-timeline-ghost {
      font-size: 0.75rem;
      padding: 0 6px;
    }
  }
</style>
