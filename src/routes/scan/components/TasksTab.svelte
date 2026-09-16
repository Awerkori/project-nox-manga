<script lang="ts">
  import {
    Plus,
    CheckCircle2,
    Clock,
    AlertCircle,
    AlertTriangle,
    User,
    Calendar,
    ArrowRightLeft,
    Trash2,
    Filter,
    MessageSquare,
    X,
    Zap,
    RotateCcw,
    CheckSquare,
    ChevronRight,
    ChevronDown,
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
    ExternalLink,
    Send
  } from '@lucide/svelte';
  import { onMount, onDestroy } from 'svelte';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { getSupabaseBrowserClient } from '$lib/supabase';
  import type { RealtimeChannel } from '@supabase/supabase-js';
  import UserAvatar from '$lib/components/UserAvatar.svelte';
  import { relativeTime } from '$lib/types';

  let {
    tasks = [],
    stages = [],
    chapterStages = [],
    productionChapters = [],
    productionFiles = [],
    chapterTimeline = [],
    workOverrides = [],
    creditSnapshots = [],
    team = [],
    positions = [],
    works = [],
    currentUserId = '',
    currentScanId = '',
    userRole = 'MEMBER',
    isOwnerOrAdmin = false,
    initialView = 'AVAILABLE',
    onOpenChapter = (chId: any) => {}
  } = $props();

  // Queue View Mode
  type ViewMode = 'AVAILABLE' | 'MINE' | 'WAITING' | 'DONE';
  let activeView = $state<ViewMode>(initialView === 'MINE' ? 'MINE' : 'AVAILABLE');

  // Stage Filter (e.g. ALL, raw, clean_redraw, traducao, typeset, revisao, qc, ready)
  let selectedStageFilter = $state<string>('ALL');

  // Work and Search Filter
  let selectedWorkFilter = $state<string>('ALL');
  let searchQuery = $state('');

  // Modals state
  let showCreateChapterModal = $state(false);
  let showBulkCreateModal = $state(false);
  let showTimelineModal = $state(false);
  let selectedTimelineChapter = $state<any>(null);

  // Return / Rework Modal
  let showReturnModal = $state(false);
  let returnSourceStage = $state<any>(null);
  let returnTargetSlug = $state<string>('typeset');
  let returnReason = $state<string>('');

  // Admin Override Modal
  let showOverrideModal = $state(false);
  let overrideTargetStage = $state<any>(null);
  let overrideAction = $state<string>('FORCE_COMPLETE');
  let overrideReason = $state<string>('');
  let overrideTargetUserId = $state<string>('');

  // RAW Quick Picker State
  let rawWorkId = $state<string>('');
  let rawChapterId = $state<string>('');

  // File Uploading State per stage
  let uploadBusyStageId = $state<string | null>(null);
  let uploadProgress = $state<number>(0);
  let uploadFeedback = $state<{ stageId: string; type: 'success' | 'error'; text: string } | null>(null);

  // Realtime Supabase Channel
  let realtimeChannel: RealtimeChannel | null = null;

  onMount(() => {
    const client = getSupabaseBrowserClient();
    if (!client || !currentScanId) return;

    realtimeChannel = client
      .channel(`scan_editorial:${currentScanId}`)
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

    if (works.length > 0) {
      rawWorkId = works[0].id;
    }
  });

  onDestroy(() => {
    if (realtimeChannel) {
      realtimeChannel.unsubscribe();
    }
  });

  // Current user's positions in the scan
  let userPositions = $derived(
    team.find((m: any) => m.id === currentUserId)?.positions || []
  );
  let userPositionIds = $derived(
    userPositions.map((p: any) => p.positionId || p.id).filter(Boolean)
  );

  let canCreateChapters = $derived(
    isOwnerOrAdmin || userPositions.some((p: any) => (p.name || '').toLowerCase().includes('raw'))
  );

  // Helper to check if a stage is claimable by the current user
  function isUserEligibleForStage(wfStage: any): boolean {
    if (isOwnerOrAdmin) return true;
    if (!wfStage) return true;

    if (wfStage.allowedPositionIds && wfStage.allowedPositionIds.length > 0) {
      return wfStage.allowedPositionIds.some((id: string) => userPositionIds.includes(id));
    }

    const sName = (wfStage.name || wfStage.slug || '').toLowerCase();
    return userPositions.some((p: any) => {
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

  // Combine stages with their parent production chapter
  interface UnifiedStageItem {
    id: string;
    production_chapter_id: string;
    stage_id: string;
    status: 'BLOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED' | 'REWORK' | 'PAUSED' | 'CANCELLED';
    assigned_to: string | null;
    claimed_at: string | null;
    last_activity_at: string | null;
    previous_assigned_to: string | null;
    rejection_reason: string | null;
    return_to_stage_id: string | null;
    is_override: boolean;
    override_action: string | null;
    override_reason: string | null;
    chapter: any;
    stage: any;
    assignee: any;
    completer: any;
    currentFile: any;
    allFiles: any[];
    dependencyFiles: any[];
    isStale: boolean;
    staleDays: number;
    eligible: boolean;
  }

  let unifiedItems = $derived.by(() => {
    const items: UnifiedStageItem[] = [];

    for (const cs of chapterStages) {
      const ch = productionChapters.find((c: any) => c.id === cs.productionChapterId);
      if (!ch) continue;

      const wfStage = cs.stage || stages.find((s: any) => s.id === cs.stageId);
      if (!wfStage) continue;

      // Find files for this chapter and stage
      const chapterFiles = productionFiles.filter((f: any) => f.productionChapterId === ch.id);
      const stageFiles = chapterFiles.filter((f: any) => f.stageId === cs.stageId);
      const currentFile = stageFiles.find((f: any) => f.isCurrent) || stageFiles[0] || null;

      // Find files for dependency stages
      const depSlugs = wfStage.dependencies || [];
      const dependencyFiles: any[] = [];
      for (const dSlug of depSlugs) {
        const dFile = chapterFiles.find((f: any) => (f.stageSlug === dSlug || f.stage?.slug === dSlug) && f.isCurrent);
        if (dFile) {
          dependencyFiles.push(dFile);
        }
      }

      // Check stale status
      let isStale = false;
      let staleDays = 0;
      if (cs.status === 'IN_PROGRESS' && (cs.lastActivityAt || cs.claimedAt)) {
        const diffMs = Date.now() - new Date(cs.lastActivityAt || cs.claimedAt).getTime();
        staleDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (staleDays >= 3) {
          isStale = true;
        }
      }

      items.push({
        id: cs.id,
        production_chapter_id: cs.productionChapterId,
        stage_id: cs.stageId,
        status: cs.status,
        assigned_to: cs.assignedTo,
        claimed_at: cs.claimedAt,
        last_activity_at: cs.lastActivityAt,
        previous_assigned_to: cs.previousAssignedTo,
        rejection_reason: cs.rejectionReason,
        return_to_stage_id: cs.returnToStageId,
        is_override: cs.isOverride,
        override_action: cs.overrideAction,
        override_reason: cs.overrideReason,
        chapter: ch,
        stage: wfStage,
        assignee: cs.assignee,
        completer: cs.completer,
        currentFile,
        allFiles: stageFiles,
        dependencyFiles,
        isStale,
        staleDays,
        eligible: isUserEligibleForStage(wfStage)
      });
    }

    return items;
  });

  // Filter items by Stage, Work, and Search Query
  function applyFilters(list: UnifiedStageItem[]) {
    return list.filter((item) => {
      if (selectedStageFilter !== 'ALL' && item.stage?.slug !== selectedStageFilter) {
        return false;
      }
      if (selectedWorkFilter !== 'ALL' && item.chapter?.workId !== selectedWorkFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const workTitle = (item.chapter?.work?.title || '').toLowerCase();
        const chNum = String(item.chapter?.chapterNumber || '');
        const chLabel = (item.chapter?.chapterLabel || '').toLowerCase();
        const stageName = (item.stage?.name || '').toLowerCase();
        return workTitle.includes(q) || chNum.includes(q) || chLabel.includes(q) || stageName.includes(q);
      }
      return true;
    });
  }

  // Queue 1: Disponíveis para Você (AVAILABLE or REWORK without assignee)
  let availableItems = $derived(
    applyFilters(
      unifiedItems.filter((item) => {
        if (item.status === 'AVAILABLE') {
          return item.eligible;
        }
        if (item.status === 'REWORK' && !item.assignedTo) {
          return item.eligible;
        }
        return false;
      })
    )
  );

  // Queue 2: Meus Trabalhos (IN_PROGRESS or REWORK assigned to current user)
  let myItems = $derived(
    applyFilters(
      unifiedItems.filter((item) => {
        return (item.status === 'IN_PROGRESS' || item.status === 'REWORK') && item.assignedTo === currentUserId;
      })
    )
  );

  // Queue 3: Aguardando Outra Etapa (BLOCKED or in progress by others)
  let waitingItems = $derived(
    applyFilters(
      unifiedItems.filter((item) => {
        if (item.status === 'BLOCKED') return true;
        if ((item.status === 'IN_PROGRESS' || item.status === 'REWORK') && item.assignedTo !== currentUserId) return true;
        if (item.status === 'AVAILABLE' && !item.eligible) return true;
        return false;
      })
    )
  );

  // Queue 4: Concluídos (DONE or SKIPPED)
  let doneItems = $derived(
    applyFilters(
      unifiedItems.filter((item) => item.status === 'DONE' || item.status === 'SKIPPED')
    )
  );

  // Available RAW chapters for Quick Picker
  let rawAvailableChapters = $derived.by(() => {
    if (!rawWorkId) return [];
    return unifiedItems
      .filter((item) => item.stage?.slug === 'raw' && item.status === 'AVAILABLE' && item.chapter?.workId === rawWorkId)
      .map((item) => item.chapter);
  });

  let targetRawStageItem = $derived(
    rawChapterId ? unifiedItems.find(i => i.productionChapterId === rawChapterId && i.stage?.slug === 'raw' && i.status === 'AVAILABLE') : null
  );

  // Handle file upload for a stage
  async function handleFileUpload(stageItem: UnifiedStageItem, file: File) {
    if (!file) return;
    uploadBusyStageId = stageItem.id;
    uploadProgress = 10;
    uploadFeedback = null;

    try {
      const formData = new FormData();
      formData.set('scan_id', currentScanId);
      formData.set('production_chapter_id', stageItem.productionChapterId);
      formData.set('stage_id', stageItem.stageId);
      formData.set('file', file);

      uploadProgress = 40;
      const res = await fetch('/api/scan/production/upload', {
        method: 'POST',
        body: formData
      });
      uploadProgress = 80;

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Falha no upload do arquivo');
      }

      uploadProgress = 100;
      uploadFeedback = {
        stageId: stageItem.id,
        type: 'success',
        text: `Arquivo enviado com sucesso (Versão v${json.version}). Agora você pode concluir a etapa!`
      };

      await invalidateAll();
    } catch (err: any) {
      uploadFeedback = {
        stageId: stageItem.id,
        type: 'error',
        text: err.message || 'Erro ao enviar arquivo.'
      };
    } finally {
      uploadBusyStageId = null;
    }
  }

  // Open Chapter Timeline
  function openChapterTimeline(chapter: any) {
    selectedTimelineChapter = chapter;
    showTimelineModal = true;
  }

  // Timeline events for selected chapter
  let chapterTimelineEvents = $derived(
    selectedTimelineChapter
      ? chapterTimeline.filter((t: any) => t.productionChapterId === selectedTimelineChapter.id)
      : []
  );

  // Files for selected chapter
  let chapterTimelineFiles = $derived(
    selectedTimelineChapter
      ? productionFiles.filter((f: any) => f.productionChapterId === selectedTimelineChapter.id)
      : []
  );

  // Open Return / Rework Modal
  function openReturnModal(item: UnifiedStageItem) {
    returnSourceStage = item;
    // Default target stage is previous upstream stage (e.g. typeset or clean)
    returnTargetSlug = 'typeset';
    returnReason = '';
    showReturnModal = true;
  }

  // Open Admin Override Modal
  function openOverrideModal(item: UnifiedStageItem) {
    overrideTargetStage = item;
    overrideAction = 'FORCE_COMPLETE';
    overrideReason = '';
    overrideTargetUserId = '';
    showOverrideModal = true;
  }

  function formatBytes(bytes: number) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
</script>

<div class="tasks-tab-root">
  <!-- Header Bar -->
  <header class="tasks-header-bar">
    <div class="header-titles">
      <div class="header-badge">
        <Zap size={14} />
        <span>CENTRAL DE PRODUÇÃO & FLUXO EDITORIAL</span>
      </div>
      <h2 class="tab-title">Produção Operacional</h2>
      <p class="tab-desc">Fluxo descomplicado para a equipe: pegue um capítulo, baixe o material pré-requisito, envie seu trabalho e avance a etapa.</p>
    </div>

    <div class="header-actions">
      {#if isOwnerOrAdmin}
        <button type="button" class="btn-secondary-sm" onclick={() => (showBulkCreateModal = true)}>
          <Layers size={14} />
          <span>Criação em Lote</span>
        </button>
      {/if}
      {#if canCreateChapters}
        <button type="button" class="btn-primary-sm" onclick={() => (showCreateChapterModal = true)}>
          <Plus size={14} />
          <span>Novo Capítulo</span>
        </button>
      {/if}
    </div>
  </header>

  <!-- Stage Quick Selector Bar -->
  <section class="stage-filter-strip" aria-label="Filtrar por etapa editorial">
    <button
      type="button"
      class="stage-filter-pill"
      class:active={selectedStageFilter === 'ALL'}
      onclick={() => (selectedStageFilter = 'ALL')}
    >
      Todas as Etapas
    </button>
    {#each stages as st}
      <button
        type="button"
        class="stage-filter-pill"
        class:active={selectedStageFilter === st.slug}
        style="--pill-accent: {st.color || '#6366f1'}"
        onclick={() => (selectedStageFilter = st.slug)}
      >
        <span class="stage-color-dot" style="background: {st.color || '#6366f1'}"></span>
        <span>{st.name}</span>
      </button>
    {/each}
  </section>

  <!-- Queue Selector Navigation Strip -->
  <nav class="queue-nav-strip">
    <button
      type="button"
      class="queue-tab-btn"
      class:active={activeView === 'AVAILABLE'}
      onclick={() => (activeView = 'AVAILABLE')}
    >
      <Zap size={15} class="queue-icon yellow" />
      <span class="queue-tab-label">Disponíveis para Você</span>
      <span class="queue-counter-badge count-available">{availableItems.length}</span>
    </button>

    <button
      type="button"
      class="queue-tab-btn"
      class:active={activeView === 'MINE'}
      onclick={() => (activeView = 'MINE')}
    >
      <Clock size={15} class="queue-icon blue" />
      <span class="queue-tab-label">Meus Trabalhos</span>
      <span class="queue-counter-badge count-mine">{myItems.length}</span>
    </button>

    <button
      type="button"
      class="queue-tab-btn"
      class:active={activeView === 'WAITING'}
      onclick={() => (activeView = 'WAITING')}
    >
      <Lock size={15} class="queue-icon purple" />
      <span class="queue-tab-label">Aguardando Outra Etapa</span>
      <span class="queue-counter-badge count-waiting">{waitingItems.length}</span>
    </button>

    <button
      type="button"
      class="queue-tab-btn"
      class:active={activeView === 'DONE'}
      onclick={() => (activeView = 'DONE')}
    >
      <CheckCircle2 size={15} class="queue-icon green" />
      <span class="queue-tab-label">Concluídos</span>
      <span class="queue-counter-badge count-done">{doneItems.length}</span>
    </button>
  </nav>

  <!-- Global Filters (Work & Search) -->
  <div class="filter-controls-row">
    <div class="search-box">
      <Search size={14} class="search-icon" />
      <input
        type="text"
        placeholder="Buscar por obra ou número de capítulo..."
        bind:value={searchQuery}
        class="filter-input"
      />
    </div>

    <div class="work-filter-select-wrapper">
      <select bind:value={selectedWorkFilter} class="filter-select">
        <option value="ALL">Todas as Obras ({works.length})</option>
        {#each works as w}
          <option value={w.id}>{w.title}</option>
        {/each}
      </select>
    </div>
  </div>

  <!-- RAW QUICK PICKER (Reference: Old Scan Staff RawQueue) -->
  {#if selectedStageFilter === 'raw' || selectedStageFilter === 'ALL'}
    <section class="raw-quick-picker-card">
      <div class="picker-header">
        <div class="picker-title-lockup">
          <Download size={18} class="text-amber-400" />
          <h3>Entrada Rápida de RAW</h3>
        </div>
        <p class="picker-hint">Escolha a obra e o capítulo para iniciar a produção imediata.</p>
      </div>

      <div class="picker-controls">
        <div class="picker-field">
          <label for="raw-work-select">Obra</label>
          <select id="raw-work-select" bind:value={rawWorkId} class="picker-select">
            {#each works as w}
              <option value={w.id}>{w.title}</option>
            {/each}
          </select>
        </div>

        <div class="picker-field">
          <label for="raw-chapter-select">Capítulo Disponível</label>
          <select
            id="raw-chapter-select"
            bind:value={rawChapterId}
            class="picker-select"
            disabled={rawAvailableChapters.length === 0}
          >
            {#if rawAvailableChapters.length === 0}
              <option value="">Nenhum capítulo aguardando RAW</option>
            {:else}
              <option value="">Selecione o capítulo...</option>
              {#each rawAvailableChapters as ch}
                <option value={ch.id}>
                  Capítulo #{ch.chapterNumber} {ch.chapterLabel ? `(${ch.chapterLabel})` : ''}
                </option>
              {/each}
            {/if}
          </select>
        </div>

        <div class="picker-action">
          {#if targetRawStageItem}
            {@const canClaimRaw = isOwnerOrAdmin || isUserEligibleForStage(targetRawStageItem.stage)}
            {#if canClaimRaw}
              <form method="POST" action="?/claimStage" use:enhance>
                <input type="hidden" name="chapter_stage_id" value={targetRawStageItem.id} />
                <button type="submit" class="btn-claim-highlight">
                  <Zap size={14} />
                  <span>Pegar este capítulo</span>
                </button>
              </form>
            {:else}
              <button type="button" class="btn-claim-highlight" disabled title="Você precisa do cargo Raw Provider para assumir esta etapa.">
                <Lock size={14} />
                <span>Disponível para Raw Provider</span>
              </button>
            {/if}
          {:else}
            <button type="button" class="btn-claim-highlight" disabled>
              <span>Pegar este capítulo</span>
            </button>
          {/if}
        </div>
      </div>
    </section>
  {/if}

  <!-- MAIN QUEUE VIEWS -->
  <main class="queue-content-area">
    <!-- 1. DISPONÍVEIS PARA VOCÊ -->
    {#if activeView === 'AVAILABLE'}
      {#if availableItems.length === 0}
        <div class="empty-state-box">
          <CheckCircle2 size={44} class="text-emerald-400" />
          <h4>Nenhuma etapa disponível para o seu cargo no momento!</h4>
          <p>Você está em dia. Novas etapas aparecerão assim que os pré-requisitos anteriores forem entregues.</p>
        </div>
      {:else}
        <div class="cards-grid">
          {#each availableItems as item (item.id)}
            <article class="editorial-card available">
              <header class="card-header">
                <div class="badge-row">
                  <span class="stage-tag" style="background: {item.stage?.color || '#3b82f6'}20; color: {item.stage?.color || '#60a5fa'}; border-color: {item.stage?.color || '#3b82f6'}50;">
                    {item.stage?.name}
                  </span>
                  {#if item.status === 'REWORK'}
                    <span class="rework-tag">RETRABALHO</span>
                  {/if}
                  <span class="prio-tag prio-{(item.chapter.priority || 'NORMAL').toLowerCase()}">
                    {item.chapter.priority}
                  </span>
                </div>

                <div class="work-meta">
                  <span class="work-name">{item.chapter.work?.title}</span>
                  <h3 class="chapter-number-heading">
                    Capítulo #{item.chapter.chapterNumber}
                    {#if item.chapter.chapterLabel}
                      <small class="chapter-label-pill">{item.chapter.chapterLabel}</small>
                    {/if}
                  </h3>
                </div>
              </header>

              {#if item.rejectionReason}
                <div class="card-alert-banner rework">
                  <AlertTriangle size={14} />
                  <span>Motivo do retorno: {item.rejectionReason}</span>
                </div>
              {/if}

              <div class="card-dependencies-info">
                {#if item.stage?.dependencies?.length > 0}
                  <span class="deps-label">Pré-requisitos concluídos:</span>
                  <div class="deps-tags">
                    {#each item.stage.dependencies as dep}
                      <span class="dep-done-tag">✓ {dep.toUpperCase()}</span>
                    {/each}
                  </div>
                {:else}
                  <span class="deps-label">Etapa de entrada: sem pré-requisitos</span>
                {/if}
              </div>

              <footer class="card-footer">
                <button
                  type="button"
                  class="btn-timeline-ghost"
                  onclick={() => openChapterTimeline(item.chapter)}
                  title="Ver linha do tempo do capítulo"
                >
                  <History size={14} />
                  <span>Histórico</span>
                </button>

                <form method="POST" action="?/claimStage" use:enhance>
                  <input type="hidden" name="chapter_stage_id" value={item.id} />
                  <button type="submit" class="btn-claim-primary">
                    <Zap size={14} />
                    <span>Pegar Tarefa</span>
                  </button>
                </form>
              </footer>
            </article>
          {/each}
        </div>
      {/if}

    <!-- 2. MEUS TRABALHOS -->
    {:else if activeView === 'MINE'}
      {#if myItems.length === 0}
        <div class="empty-state-box">
          <BookOpen size={44} class="text-blue-400" />
          <h4>Você não possui tarefas em andamento</h4>
          <p>Acesse a aba <strong>Disponíveis para Você</strong> para assumir um novo capítulo da equipe.</p>
        </div>
      {:else}
        <div class="cards-grid">
          {#each myItems as item (item.id)}
            <article class="editorial-card in-progress" class:is-rework={item.status === 'REWORK'}>
              <header class="card-header">
                <div class="badge-row">
                  <span class="stage-tag" style="background: {item.stage?.color || '#3b82f6'}25; color: {item.stage?.color || '#60a5fa'}; border-color: {item.stage?.color || '#3b82f6'}60;">
                    {item.stage?.name} · COM VOCÊ
                  </span>
                  {#if item.status === 'REWORK'}
                    <span class="rework-tag pulse">CORREÇÃO SOLICITADA</span>
                  {/if}
                  {#if item.isStale}
                    <span class="stale-tag">⚠️ Parado há {item.staleDays} dias</span>
                  {/if}
                </div>

                <div class="work-meta">
                  <span class="work-name">{item.chapter.work?.title}</span>
                  <h3 class="chapter-number-heading">
                    Capítulo #{item.chapter.chapterNumber}
                    {#if item.chapter.chapterLabel}
                      <small class="chapter-label-pill">{item.chapter.chapterLabel}</small>
                    {/if}
                  </h3>
                </div>
              </header>

              {#if item.rejectionReason}
                <div class="card-alert-banner rework-prominent">
                  <AlertCircle size={16} />
                  <div>
                    <strong>Atenção: Correção Solicitada pelo QC/Revisão</strong>
                    <p>{item.rejectionReason}</p>
                  </div>
                </div>
              {/if}

              <!-- STEP 1: DOWNLOAD DEPENDENCY DELIVERABLES -->
              {#if item.dependencyFiles.length > 0}
                <section class="card-section-box">
                  <div class="section-title-sm">
                    <Download size={13} />
                    <span>Materiais de Entrada (Pré-requisitos)</span>
                  </div>
                  <div class="download-artifacts-row">
                    {#each item.dependencyFiles as depFile}
                      <a
                        href="/api/scan/production/files/{depFile.id}?download=1"
                        download={depFile.fileName}
                        class="btn-download-artifact"
                      >
                        <Download size={13} />
                        <div class="artifact-info">
                          <strong>Baixar {depFile.stageSlug?.toUpperCase()} (v{depFile.version})</strong>
                          <small>{depFile.fileName} · {formatBytes(depFile.byteSize)}</small>
                        </div>
                      </a>
                    {/each}
                  </div>
                </section>
              {/if}

              <!-- STEP 2: DELIVERABLE UPLOAD SECTION -->
              <section class="card-section-box upload-box">
                <div class="section-title-sm">
                  <Upload size={13} />
                  <span>Enviar Seu Arquivo ({item.stage?.name})</span>
                </div>

                {#if item.currentFile}
                  <div class="current-file-badge">
                    <FileText size={15} class="text-emerald-400 flex-shrink-0" />
                    <div class="file-meta">
                      <strong>{item.currentFile.fileName} (v{item.currentFile.version})</strong>
                      <small>{formatBytes(item.currentFile.byteSize)} · Enviado por {item.currentFile.uploader?.displayName || item.currentFile.uploader?.username || 'Você'}</small>
                    </div>
                    <a
                      href="/api/scan/production/files/{item.currentFile.id}?download=1"
                      download={item.currentFile.fileName}
                      class="btn-icon-download"
                      title="Baixar versão enviada"
                    >
                      <Download size={14} />
                    </a>
                  </div>
                {/if}

                <!-- File Input Drag-and-drop / selector -->
                <label class="file-upload-dropzone">
                  <input
                    type="file"
                    class="sr-only"
                    disabled={uploadBusyStageId === item.id}
                    onchange={(e) => {
                      const files = (e.target as HTMLInputElement).files;
                      if (files && files[0]) {
                        handleFileUpload(item, files[0]);
                      }
                    }}
                  />
                  <div class="dropzone-content">
                    <Upload size={18} class="text-purple-400" />
                    {#if uploadBusyStageId === item.id}
                      <span class="uploading-text">Enviando arquivo... {uploadProgress}%</span>
                    {:else if item.currentFile}
                      <span>Clique para enviar uma <strong>nova versão (v{(item.currentFile.version || 1) + 1})</strong></span>
                    {:else}
                      <span>Clique para selecionar o <strong>arquivo pronto</strong> para esta etapa</span>
                    {/if}
                  </div>
                </label>

                {#if uploadFeedback && uploadFeedback.stageId === item.id}
                  <div class="upload-feedback {uploadFeedback.type}">
                    {uploadFeedback.text}
                  </div>
                {/if}
              </section>

              <!-- STEP 3: ACTIONS & COMPLETION -->
              <footer class="card-footer actions-grid">
                <div class="footer-left">
                  <form method="POST" action="?/releaseStage" use:enhance>
                    <input type="hidden" name="chapter_stage_id" value={item.id} />
                    <button type="submit" class="btn-release-task" title="Liberar tarefa de volta à fila">
                      <RotateCcw size={13} />
                      <span>Liberar</span>
                    </button>
                  </form>

                  {#if ['revisor_qc', 'qc', 'revisao'].includes(item.stage?.slug)}
                    <button
                      type="button"
                      class="btn-return-rework"
                      onclick={() => openReturnModal(item)}
                      title="Solicitar correção para uma etapa anterior"
                    >
                      <RotateCcw size={13} />
                      <span>Solicitar Correção</span>
                    </button>
                  {/if}

                  {#if isOwnerOrAdmin}
                    <button
                      type="button"
                      class="btn-override-sm"
                      onclick={() => openOverrideModal(item)}
                      title="Ações Administrativas de Líder"
                    >
                      <span>Override</span>
                    </button>
                  {/if}
                </div>

                <div class="footer-right">
                  <form method="POST" action="?/completeStageAction" use:enhance>
                    <input type="hidden" name="chapter_stage_id" value={item.id} />
                    {#if item.stage?.requiresOutput && !item.currentFile}
                      <button type="button" class="btn-complete-disabled" disabled title="Envie o arquivo antes de concluir">
                        <Lock size={14} />
                        <span>Concluir (Envie Arquivo)</span>
                      </button>
                    {:else}
                      <button type="submit" class="btn-complete-primary">
                        <CheckCircle2 size={15} />
                        <span>Concluir {item.stage?.name}</span>
                      </button>
                    {/if}
                  </form>
                </div>
              </footer>
            </article>
          {/each}
        </div>
      {/if}

    <!-- 3. AGUARDANDO OUTRA ETAPA -->
    {:else if activeView === 'WAITING'}
      {#if waitingItems.length === 0}
        <div class="empty-state-box">
          <CheckCircle2 size={44} class="text-purple-400" />
          <h4>Nenhum capítulo aguardando outras etapas no momento</h4>
        </div>
      {:else}
        <div class="cards-grid">
          {#each waitingItems as item (item.id)}
            <article class="editorial-card waiting">
              <header class="card-header">
                <div class="badge-row">
                  <span class="stage-tag waiting-tag">
                    <Lock size={11} />
                    <span>{item.stage?.name}</span>
                  </span>
                  <span class="waiting-reason-pill">
                    {#if item.status === 'BLOCKED'}
                      BLOQUEADO POR PRÉ-REQUISITOS
                    {:else if item.assignedTo}
                      EM ANDAMENTO COM {item.assignee?.displayName || item.assignee?.username || 'MEMBRO'}
                    {:else}
                      AGUARDANDO CARGO CORRESPONDENTE
                    {/if}
                  </span>
                </div>

                <div class="work-meta">
                  <span class="work-name">{item.chapter.work?.title}</span>
                  <h3 class="chapter-number-heading">
                    Capítulo #{item.chapter.chapterNumber}
                    {#if item.chapter.chapterLabel}
                      <small class="chapter-label-pill">{item.chapter.chapterLabel}</small>
                    {/if}
                  </h3>
                </div>
              </header>

              <div class="waiting-details-box">
                {#if item.stage?.slug === 'typeset'}
                  <p class="waiting-hint">
                    O Typeset requer que tanto <strong>Clean/Redraw</strong> quanto <strong>Tradução</strong> estejam concluídos com seus arquivos anexados.
                  </p>
                {:else if item.stage?.dependencies?.length > 0}
                  <p class="waiting-hint">
                    Aguardando conclusão de: <strong>{item.stage.dependencies.join(', ').toUpperCase()}</strong>.
                  </p>
                {/if}

                {#if item.isStale && isOwnerOrAdmin}
                  <div class="card-alert-banner warning">
                    <AlertTriangle size={14} />
                    <span>Membro inativo há {item.staleDays} dias. Você pode reassumir a tarefa.</span>
                  </div>
                {/if}
              </div>

              <footer class="card-footer">
                <button
                  type="button"
                  class="btn-timeline-ghost"
                  onclick={() => openChapterTimeline(item.chapter)}
                >
                  <History size={14} />
                  <span>Histórico</span>
                </button>

                {#if isOwnerOrAdmin}
                  <button
                    type="button"
                    class="btn-override-sm"
                    onclick={() => openOverrideModal(item)}
                  >
                    <span>Override Líder</span>
                  </button>
                {/if}
              </footer>
            </article>
          {/each}
        </div>
      {/if}

    <!-- 4. CONCLUÍDOS & PRONTO PRA UPAR -->
    {:else if activeView === 'DONE'}
      {#if doneItems.length === 0}
        <div class="empty-state-box">
          <Layers size={44} class="text-slate-400" />
          <h4>Nenhuma etapa concluída ainda</h4>
        </div>
      {:else}
        <div class="cards-grid">
          {#each doneItems as item (item.id)}
            <article class="editorial-card done">
              <header class="card-header">
                <div class="badge-row">
                  <span class="stage-tag done-tag">
                    <CheckCircle2 size={12} />
                    <span>{item.stage?.name}</span>
                  </span>
                  {#if item.status === 'SKIPPED'}
                    <span class="skipped-tag">PULADO (OVERRIDE)</span>
                  {/if}
                  {#if item.chapter.status === 'READY'}
                    <span class="ready-tag">PRONTO PRA UPAR</span>
                  {:else if item.chapter.status === 'PUBLISHED'}
                    <span class="published-tag">PUBLICADO</span>
                  {/if}
                </div>

                <div class="work-meta">
                  <span class="work-name">{item.chapter.work?.title}</span>
                  <h3 class="chapter-number-heading">
                    Capítulo #{item.chapter.chapterNumber}
                    {#if item.chapter.chapterLabel}
                      <small class="chapter-label-pill">{item.chapter.chapterLabel}</small>
                    {/if}
                  </h3>
                </div>
              </header>

              {#if item.currentFile}
                <div class="current-file-badge done-file">
                  <FileText size={14} class="text-emerald-400 flex-shrink-0" />
                  <div class="file-meta">
                    <strong>{item.currentFile.fileName} (v{item.currentFile.version})</strong>
                    <small>{formatBytes(item.currentFile.byteSize)} · Concluído por {item.completer?.displayName || item.completer?.username || 'Membro'}</small>
                  </div>
                  <a
                    href="/api/scan/production/files/{item.currentFile.id}?download=1"
                    download={item.currentFile.fileName}
                    class="btn-icon-download"
                  >
                    <Download size={13} />
                  </a>
                </div>
              {/if}

              <footer class="card-footer space-between">
                <button
                  type="button"
                  class="btn-timeline-ghost"
                  onclick={() => openChapterTimeline(item.chapter)}
                >
                  <History size={14} />
                  <span>Histórico</span>
                </button>

                {#if item.chapter.status === 'READY' && ['OWNER', 'ADMIN', 'UPLOADER'].includes(userRole)}
                  <form method="POST" action="?/publishProductionChapter" use:enhance>
                    <input type="hidden" name="production_chapter_id" value={item.chapter.id} />
                    <button type="submit" class="btn-publish-highlight">
                      <Sparkles size={14} />
                      <span>Publicar Capítulo</span>
                    </button>
                  </form>
                {:else if item.chapter.status === 'PUBLISHED' && isOwnerOrAdmin}
                  <form method="POST" action="?/unpublishProductionChapter" use:enhance>
                    <input type="hidden" name="production_chapter_id" value={item.chapter.id} />
                    <button type="submit" class="btn-unpublish-ghost">
                      <span>Despublicar</span>
                    </button>
                  </form>
                {/if}
              </footer>
            </article>
          {/each}
        </div>
      {/if}
    {/if}
  </main>

  <!-- MODAL: RETRABALHO / SOLICITAR CORREÇÃO -->
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
              O capítulo <strong>#{returnSourceStage.chapter?.chapterNumber}</strong> voltará com status <strong>REWORK</strong> para a etapa selecionada. Após corrigido, retornará diretamente para a sua validação.
            </p>

            <div class="modal-field">
              <label for="target-stage-slug">Etapa de Destino para Correção</label>
              <select id="target-stage-slug" name="target_stage_slug" bind:value={returnTargetSlug} class="modal-select">
                <option value="raw">Raw Provider (Qualidade de Imagem Original)</option>
                <option value="traducao">Tradução (Sentido ou Ortografia)</option>
                <option value="clean_redraw">Clean/Redraw (Limpeza ou Reconstrução)</option>
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
                placeholder="Explique exatamente o que precisa ser corrigido (ex: Balão da pág. 4 cortado, fonte incorreta no grito pág. 12)..."
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

  <!-- MODAL: ADMIN OVERRIDE -->
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
                  {#each team as m}
                    <option value={m.id}>{m.displayName || m.username}</option>
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
            <button type="submit" class="btn-primary-sm" disabled={overrideReason.trim().length < 3}>
              <span>Confirmar Override</span>
            </button>
          </footer>
        </form>
      </div>
    </div>
  {/if}

  <!-- MODAL: NOVO CAPÍTULO -->
  {#if showCreateChapterModal}
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <div class="modal-card">
        <header class="modal-header">
          <div class="modal-title-wrap">
            <Plus size={18} class="text-emerald-400" />
            <h3>Novo Capítulo em Produção</h3>
          </div>
          <button type="button" class="btn-close-modal" onclick={() => (showCreateChapterModal = false)}>
            <X size={16} />
          </button>
        </header>

        <form method="POST" action="?/createProductionChapter" use:enhance={() => {
          return async ({ result }) => {
            if (result.type === 'success') {
              showCreateChapterModal = false;
              await invalidateAll();
            }
          };
        }}>
          <input type="hidden" name="scan_id" value={currentScanId} />

          <div class="modal-body">
            <div class="modal-field">
              <label for="new-ch-work">Obra *</label>
              <select id="new-ch-work" name="work_id" class="modal-select" required>
                {#each works as w}
                  <option value={w.id}>{w.title}</option>
                {/each}
              </select>
            </div>

            <div class="modal-grid-2">
              <div class="modal-field">
                <label for="new-ch-num">Número do Capítulo *</label>
                <input id="new-ch-num" type="number" step="0.1" name="chapter_number" placeholder="Ex: 85" class="modal-input" required />
              </div>
              <div class="modal-field">
                <label for="new-ch-label">Rótulo / Especial (Opcional)</label>
                <input id="new-ch-label" type="text" name="chapter_label" placeholder="Ex: 12.5, Prólogo, Extra 1" class="modal-input" />
              </div>
            </div>

            <div class="modal-grid-2">
              <div class="modal-field">
                <label for="new-ch-template">Template Editorial</label>
                <select id="new-ch-template" name="template" class="modal-select">
                  <option value="MANHWA">Manhwa Completo (9 etapas)</option>
                  <option value="MANGA">Mangá Japonês</option>
                  <option value="WEBTOON">Webtoon Rápido</option>
                  <option value="NOVEL">Novel / Literatura</option>
                </select>
              </div>
              <div class="modal-field">
                <label for="new-ch-priority">Prioridade</label>
                <select id="new-ch-priority" name="priority" class="modal-select">
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                  <option value="LOW">Baixa</option>
                </select>
              </div>
            </div>
          </div>

          <footer class="modal-footer">
            <button type="button" class="btn-cancel" onclick={() => (showCreateChapterModal = false)}>Cancelar</button>
            <button type="submit" class="btn-primary-sm">Criar e Liberar RAW</button>
          </footer>
        </form>
      </div>
    </div>
  {/if}

  <!-- MODAL: CRIAÇÃO EM LOTE -->
  {#if showBulkCreateModal}
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <div class="modal-card">
        <header class="modal-header">
          <div class="modal-title-wrap">
            <Layers size={18} class="text-purple-400" />
            <h3>Criação de Capítulos em Lote</h3>
          </div>
          <button type="button" class="btn-close-modal" onclick={() => (showBulkCreateModal = false)}>
            <X size={16} />
          </button>
        </header>

        <form method="POST" action="?/bulkCreateProductionChapters" use:enhance={() => {
          return async ({ result }) => {
            if (result.type === 'success') {
              showBulkCreateModal = false;
              await invalidateAll();
            }
          };
        }}>
          <input type="hidden" name="scan_id" value={currentScanId} />

          <div class="modal-body">
            <div class="modal-field">
              <label for="bulk-work-select">Obra *</label>
              <select id="bulk-work-select" name="work_id" class="modal-select" required>
                {#each works as w}
                  <option value={w.id}>{w.title}</option>
                {/each}
              </select>
            </div>

            <div class="modal-grid-2">
              <div class="modal-field">
                <label for="bulk-from">Do Capítulo Número *</label>
                <input id="bulk-from" type="number" name="from_number" placeholder="Ex: 85" class="modal-input" required />
              </div>
              <div class="modal-field">
                <label for="bulk-to">Até o Capítulo Número *</label>
                <input id="bulk-to" type="number" name="to_number" placeholder="Ex: 100" class="modal-input" required />
              </div>
            </div>

            <p class="modal-hint-text">Capítulos que já existirem serão ignorados automaticamente sem gerar duplicatas.</p>
          </div>

          <footer class="modal-footer">
            <button type="button" class="btn-cancel" onclick={() => (showBulkCreateModal = false)}>Cancelar</button>
            <button type="submit" class="btn-primary-sm">Gerar Lote</button>
          </footer>
        </form>
      </div>
    </div>
  {/if}

  <!-- MODAL: LINHA DO TEMPO & HISTÓRICO DE VERSÕES -->
  {#if showTimelineModal && selectedTimelineChapter}
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <div class="modal-card wide">
        <header class="modal-header">
          <div class="modal-title-wrap">
            <History size={18} class="text-blue-400" />
            <h3>Histórico: {selectedTimelineChapter.work?.title} #{selectedTimelineChapter.chapterNumber}</h3>
          </div>
          <button type="button" class="btn-close-modal" onclick={() => (showTimelineModal = false)}>
            <X size={16} />
          </button>
        </header>

        <div class="modal-body">
          <section class="modal-sub-block">
            <h4>Arquivos Staged & Versões</h4>
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
                    {#each chapterTimelineFiles as f}
                      <tr class:is-current={f.isCurrent}>
                        <td>
                          <span class="version-tag" class:current={f.isCurrent}>v{f.version}</span>
                        </td>
                        <td><strong>{f.stageSlug?.toUpperCase() || f.stage?.name || 'RAW'}</strong></td>
                        <td>{f.fileName}</td>
                        <td>{formatBytes(f.byteSize)}</td>
                        <td>{f.uploader?.displayName || f.uploader?.username || 'Membro'}</td>
                        <td>
                          <a href="/api/scan/production/files/{f.id}?download=1" download={f.fileName} class="btn-icon-link">
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
                {#each chapterTimelineEvents as evt}
                  <div class="timeline-entry">
                    <div class="timeline-dot"></div>
                    <div class="timeline-info">
                      <div class="timeline-row">
                        <strong>{evt.eventType}</strong>
                        <span class="timeline-date">{relativeTime(evt.createdAt)}</span>
                      </div>
                      <p class="timeline-actor">Por {evt.userName || 'Sistema'}</p>
                      {#if evt.details && Object.keys(evt.details).length > 0}
                        <pre class="timeline-details">{JSON.stringify(evt.details, null, 2)}</pre>
                      {/if}
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
    gap: 1.25rem;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow-x: hidden;
  }

  /* Header */
  .tasks-header-bar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    background: linear-gradient(180deg, rgba(30, 27, 75, 0.4) 0%, rgba(15, 23, 42, 0.4) 100%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1.25rem;
  }

  .header-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: #f59e0b;
    margin-bottom: 0.35rem;
  }

  .tab-title {
    font-size: 1.4rem;
    font-weight: 800;
    color: #f8fafc;
    margin: 0;
  }

  .tab-desc {
    font-size: 0.85rem;
    color: #94a3b8;
    margin: 0.25rem 0 0;
    max-width: 700px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  /* Stage Filter Strip */
  .stage-filter-strip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    overflow-x: auto;
    padding: 0.25rem 0;
    scrollbar-width: thin;
    max-width: 100%;
  }

  .stage-filter-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.85rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 9999px;
    font-size: 0.78rem;
    font-weight: 600;
    color: #cbd5e1;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .stage-filter-pill:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .stage-filter-pill.active {
    background: var(--pill-accent, rgba(223, 194, 141, 0.15));
    border-color: var(--pill-accent, #dfc28d);
    color: #fff;
    font-weight: 700;
  }

  .stage-color-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  /* Queue Navigation Strip */
  .queue-nav-strip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 0.5rem;
    overflow-x: auto;
    scrollbar-width: thin;
    max-width: 100%;
  }

  .queue-tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.55rem 0.95rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    color: #94a3b8;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .queue-tab-btn:hover {
    background: rgba(255, 255, 255, 0.04);
    color: #e2e8f0;
  }

  .queue-tab-btn.active {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.12);
    color: #f8fafc;
  }

  .queue-counter-badge {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.15rem 0.45rem;
    border-radius: 9999px;
  }

  .count-available { background: rgba(245, 158, 11, 0.2); color: #fcd34d; }
  .count-mine { background: rgba(59, 130, 246, 0.2); color: #93c5fd; }
  .count-waiting { background: rgba(168, 85, 247, 0.2); color: #d8b4fe; }
  .count-done { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }

  /* Filters */
  .filter-controls-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .search-box {
    position: relative;
    flex: 1;
    min-width: 220px;
  }

  :global(.search-icon) {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: #64748b;
  }

  .filter-input {
    width: 100%;
    box-sizing: border-box;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 0.5rem 0.75rem 0.5rem 2.2rem;
    font-size: 0.85rem;
    color: #f8fafc;
    outline: none;
  }

  .filter-select, .picker-select, .modal-select, .modal-input, .modal-textarea {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
    color: #f8fafc;
    outline: none;
    box-sizing: border-box;
  }

  /* RAW Quick Picker Card */
  .raw-quick-picker-card {
    background: linear-gradient(90deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 10px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .picker-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .picker-title-lockup {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .picker-title-lockup h3 {
    font-size: 1rem;
    font-weight: 700;
    color: #fcd34d;
    margin: 0;
  }

  .picker-hint {
    font-size: 0.8rem;
    color: #94a3b8;
    margin: 0;
  }

  .picker-controls {
    display: flex;
    align-items: flex-end;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .picker-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    flex: 1;
    min-width: 200px;
  }

  .picker-field label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #cbd5e1;
  }

  .btn-claim-highlight {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: #0f172a;
    border: none;
    padding: 0.55rem 1.25rem;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 800;
    cursor: pointer;
    transition: transform 0.15s ease, filter 0.15s ease;
  }

  .btn-claim-highlight:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: brightness(1.1);
  }

  .btn-claim-highlight:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Cards Grid */
  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1rem;
  }

  @media (max-width: 640px) {
    .cards-grid {
      grid-template-columns: 1fr;
    }
  }

  .editorial-card {
    background: #111827;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    box-sizing: border-box;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    overflow: hidden;
  }

  .editorial-card:hover {
    border-color: rgba(255, 255, 255, 0.16);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  }

  .editorial-card.in-progress {
    border-color: rgba(59, 130, 246, 0.35);
    background: linear-gradient(180deg, #131d38 0%, #0f172a 100%);
  }

  .editorial-card.is-rework {
    border-color: rgba(244, 63, 94, 0.5);
    background: linear-gradient(180deg, #24111e 0%, #0f172a 100%);
  }

  .card-header {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .badge-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .stage-tag {
    font-size: 0.72rem;
    font-weight: 800;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    border: 1px solid;
    letter-spacing: 0.03em;
  }

  .rework-tag {
    font-size: 0.68rem;
    font-weight: 800;
    background: #e11d48;
    color: #fff;
    padding: 0.2rem 0.45rem;
    border-radius: 4px;
  }

  .pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .stale-tag {
    font-size: 0.68rem;
    font-weight: 700;
    background: rgba(245, 158, 11, 0.2);
    color: #fcd34d;
    border: 1px solid rgba(245, 158, 11, 0.4);
    padding: 0.2rem 0.45rem;
    border-radius: 4px;
  }

  .prio-tag {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    margin-left: auto;
  }
  .prio-urgent { background: rgba(239, 68, 68, 0.2); color: #f87171; }
  .prio-high { background: rgba(249, 115, 22, 0.2); color: #fb923c; }
  .prio-normal { background: rgba(148, 163, 184, 0.15); color: #94a3b8; }
  .prio-low { background: rgba(100, 116, 139, 0.15); color: #64748b; }

  .work-name {
    font-size: 0.78rem;
    color: #94a3b8;
    font-weight: 600;
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chapter-number-heading {
    font-size: 1.15rem;
    font-weight: 800;
    color: #f8fafc;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .chapter-label-pill {
    font-size: 0.75rem;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.08);
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
    color: #cbd5e1;
  }

  /* Alerts */
  .card-alert-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.55rem 0.75rem;
    border-radius: 6px;
    font-size: 0.78rem;
  }

  .card-alert-banner.rework {
    background: rgba(225, 29, 72, 0.15);
    border: 1px solid rgba(225, 29, 72, 0.3);
    color: #fda4af;
  }

  .card-alert-banner.rework-prominent {
    background: rgba(225, 29, 72, 0.2);
    border: 1px solid rgba(225, 29, 72, 0.4);
    color: #ffe4e6;
    align-items: flex-start;
  }

  .card-alert-banner.warning {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #fde68a;
  }

  /* Dependencies */
  .card-dependencies-info {
    font-size: 0.75rem;
    color: #94a3b8;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .deps-tags {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .dep-done-tag {
    font-size: 0.7rem;
    font-weight: 700;
    background: rgba(16, 185, 129, 0.15);
    color: #6ee7b7;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
  }

  /* Section Boxes inside cards */
  .card-section-box {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 0.65rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-title-sm {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    font-weight: 700;
    color: #cbd5e1;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .download-artifacts-row {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .btn-download-artifact {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(59, 130, 246, 0.12);
    border: 1px solid rgba(59, 130, 246, 0.25);
    padding: 0.45rem 0.65rem;
    border-radius: 6px;
    color: #93c5fd;
    text-decoration: none;
    font-size: 0.75rem;
    transition: background 0.15s ease;
  }

  .btn-download-artifact:hover {
    background: rgba(59, 130, 246, 0.22);
  }

  .artifact-info {
    display: flex;
    flex-direction: column;
  }

  .current-file-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.2);
    padding: 0.4rem 0.65rem;
    border-radius: 6px;
  }

  .file-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .file-meta strong {
    font-size: 0.78rem;
    color: #f8fafc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-meta small {
    font-size: 0.68rem;
    color: #94a3b8;
  }

  .file-upload-dropzone {
    border: 1px dashed rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    padding: 0.75rem;
    text-align: center;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.02);
    transition: border-color 0.15s ease;
  }

  .file-upload-dropzone:hover {
    border-color: #a855f7;
    background: rgba(168, 85, 247, 0.05);
  }

  .dropzone-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    color: #cbd5e1;
  }

  .uploading-text {
    color: #d8b4fe;
    font-weight: 700;
  }

  .upload-feedback {
    font-size: 0.72rem;
    padding: 0.35rem 0.5rem;
    border-radius: 4px;
  }
  .upload-feedback.success { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }
  .upload-feedback.error { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }

  /* Card Footers */
  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-top: auto;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    flex-wrap: wrap;
  }

  .actions-grid {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
  }

  .footer-left {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .footer-right {
    display: flex;
    align-items: center;
    margin-left: auto;
  }

  .btn-timeline-ghost {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 0.75rem;
    cursor: pointer;
    padding: 0.35rem 0.5rem;
    border-radius: 4px;
    transition: color 0.15s ease;
  }

  .btn-timeline-ghost:hover {
    color: #f8fafc;
    background: rgba(255, 255, 255, 0.05);
  }

  .btn-claim-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: #2563eb;
    color: #fff;
    border: none;
    padding: 0.45rem 0.85rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-claim-primary:hover {
    background: #1d4ed8;
  }

  .btn-complete-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: #10b981;
    color: #064e3b;
    border: none;
    padding: 0.45rem 0.95rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 800;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-complete-primary:hover {
    background: #059669;
    color: #fff;
  }

  .btn-complete-disabled {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(255, 255, 255, 0.06);
    color: #64748b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.45rem 0.85rem;
    border-radius: 6px;
    font-size: 0.75rem;
    cursor: not-allowed;
  }

  .btn-release-task {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 0.72rem;
    padding: 0.35rem 0.55rem;
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-release-task:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .btn-return-rework {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: rgba(225, 29, 72, 0.15);
    border: 1px solid rgba(225, 29, 72, 0.3);
    color: #fda4af;
    font-size: 0.72rem;
    padding: 0.35rem 0.55rem;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
  }

  .btn-return-rework:hover {
    background: rgba(225, 29, 72, 0.25);
  }

  .btn-override-sm {
    font-size: 0.7rem;
    font-weight: 700;
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #fcd34d;
    padding: 0.35rem 0.5rem;
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-override-sm:hover {
    background: rgba(245, 158, 11, 0.25);
  }

  .btn-publish-highlight {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: #fff;
    border: none;
    padding: 0.45rem 0.85rem;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 800;
    cursor: pointer;
  }

  .btn-publish-highlight:hover {
    filter: brightness(1.1);
  }

  .btn-unpublish-ghost {
    background: transparent;
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
    font-size: 0.72rem;
    padding: 0.35rem 0.55rem;
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-unpublish-ghost:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .btn-icon-download, .btn-icon-link {
    color: #94a3b8;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
    display: inline-flex;
  }

  .btn-icon-download:hover, .btn-icon-link:hover {
    color: #fff;
  }

  /* Empty state */
  .empty-state-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 3.5rem 1rem;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    gap: 0.75rem;
  }

  .empty-state-box h4 {
    font-size: 1.1rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .empty-state-box p {
    font-size: 0.85rem;
    color: #94a3b8;
    margin: 0;
    max-width: 480px;
  }

  /* Modals */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
    box-sizing: border-box;
  }

  .modal-card {
    background: #111827;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    width: 100%;
    max-width: 500px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
  }

  .modal-card.wide {
    max-width: 720px;
    max-height: 85vh;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .modal-title-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .modal-title-wrap h3 {
    font-size: 1.05rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .btn-close-modal {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 0.25rem;
  }

  .btn-close-modal:hover { color: #fff; }

  .modal-body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow-y: auto;
  }

  .modal-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .modal-field label {
    font-size: 0.78rem;
    font-weight: 600;
    color: #cbd5e1;
  }

  .modal-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.2);
  }

  .btn-primary-sm {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: #7c3aed;
    color: #fff;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
  }

  .btn-primary-sm:hover:not(:disabled) {
    background: #6d28d9;
  }

  .btn-primary-sm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary-sm {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #cbd5e1;
    padding: 0.5rem 0.9rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-secondary-sm:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .btn-cancel {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0.5rem 0.75rem;
  }

  .btn-danger-action {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: #e11d48;
    color: #fff;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
  }

  .btn-danger-action:hover:not(:disabled) {
    background: #be123c;
  }

  .btn-danger-action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .modal-instruction {
    font-size: 0.82rem;
    color: #cbd5e1;
    margin: 0;
    line-height: 1.4;
  }

  .modal-hint-text {
    font-size: 0.75rem;
    color: #94a3b8;
    margin: 0;
  }

  /* Timeline modal table */
  .files-table-wrapper {
    overflow-x: auto;
  }

  .files-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
  }

  .files-table th, .files-table td {
    padding: 0.5rem 0.65rem;
    text-align: left;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .files-table th {
    color: #94a3b8;
    font-weight: 600;
  }

  .version-tag {
    font-size: 0.7rem;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.08);
    padding: 0.15rem 0.35rem;
    border-radius: 4px;
    color: #94a3b8;
  }

  .version-tag.current {
    background: rgba(16, 185, 129, 0.2);
    color: #6ee7b7;
  }

  .timeline-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    position: relative;
    padding-left: 1rem;
    border-left: 2px solid rgba(255, 255, 255, 0.08);
  }

  .timeline-entry {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .timeline-dot {
    position: absolute;
    left: -1.35rem;
    top: 0.25rem;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #a855f7;
    border: 2px solid #111827;
  }

  .timeline-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .timeline-date {
    font-size: 0.7rem;
    color: #64748b;
  }

  .timeline-actor {
    font-size: 0.75rem;
    color: #94a3b8;
    margin: 0;
  }

  .timeline-details {
    background: rgba(0, 0, 0, 0.3);
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
    font-size: 0.7rem;
    color: #cbd5e1;
    overflow-x: auto;
    margin: 0.25rem 0 0;
  }
</style>
