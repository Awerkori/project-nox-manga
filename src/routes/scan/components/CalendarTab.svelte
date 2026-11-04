<script lang="ts">
  import {
    Calendar as CalendarIcon,
    Clock,
    AlertCircle,
    CheckCircle2,
    User,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    Briefcase,
    Filter,
    Layers,
    ArrowRight,
    Sliders,
    Eye,
    FileText,
    Edit3,
    Check,
    X,
    RotateCcw,
    AlertTriangle,
    Zap
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';
  import UserAvatar from '$lib/components/UserAvatar.svelte';

  interface Props {
    tasks?: any[];
    chapters?: any[];
    chapterStages?: any[];
    productionChapters?: any[];
    stages?: any[];
    works?: any[];
    team?: any[];
    currentUserId?: string;
    userRole?: string;
    currentScan?: any;
    onOpenChapter?: (chapter: any) => void;
  }

  let {
    tasks = [],
    chapters = [],
    chapterStages = [],
    productionChapters = [],
    stages = [],
    works = [],
    team = [],
    currentUserId = '',
    userRole = 'MEMBER',
    currentScan = null,
    onOpenChapter
  }: Props = $props();

  const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Timezone helper for America/Sao_Paulo
  function getSaoPauloDate(dateInput?: string | Date | number): Date {
    const d = dateInput ? new Date(dateInput) : new Date();
    const spStr = d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    return new Date(spStr);
  }

  function formatYMD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const todaySP = getSaoPauloDate();
  const todayYMD = formatYMD(todaySP);

  // Calendar View State
  let currentMonth = $state(todaySP.getMonth());
  let currentYear = $state(todaySP.getFullYear());
  let selectedDateYMD = $state(todayYMD);
  let activeViewMode = $state<'MONTH' | 'AGENDA'>('MONTH');

  // Filters State
  let filterStageSlug = $state<string>('ALL');
  let filterAssigneeId = $state<string>('ALL');
  let filterStatus = $state<string>('ALL'); // ALL | IN_PROGRESS | DONE | OVERDUE | EXTENDED

  // Modals & Panels State
  let showDayDrawer = $state(false);
  let showExtensionModal = $state(false);
  let extensionTargetItem = $state<any>(null);
  let isExtending = $state(false);
  let extensionFeedback = $state<{ type: 'success' | 'error'; message: string } | null>(null);

  // Notes editing state
  let editingNoteId = $state<string | null>(null);
  let noteTextDraft = $state('');
  let isSavingNote = $state(false);

  // Month navigation
  function prevMonth() {
    if (currentMonth === 0) {
      currentMonth = 11;
      currentYear--;
    } else {
      currentMonth--;
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      currentMonth = 0;
      currentYear++;
    } else {
      currentMonth++;
    }
  }

  function goToToday() {
    const now = getSaoPauloDate();
    currentMonth = now.getMonth();
    currentYear = now.getFullYear();
    selectedDateYMD = formatYMD(now);
  }

  // Stage Color & Icon Helpers
  const STAGE_COLORS: Record<string, string> = {
    raw: '#64748b',
    traducao: '#38bdf8',
    clean_redraw: '#34d399',
    clean: '#34d399',
    typeset: '#a855f7',
    revisor_qc: '#f59e0b',
    qc: '#f59e0b',
    revisao: '#f59e0b',
    pre_aprovado: '#ec4899',
    publicado: '#10b981'
  };

  function getStageColor(slug?: string, defaultColor?: string): string {
    if (defaultColor) return defaultColor;
    if (!slug) return '#8b5cf6';
    return STAGE_COLORS[slug.toLowerCase()] || '#8b5cf6';
  }

  // Map of production chapters by ID
  let prodChaptersMap = $derived.by(() => {
    const map = new Map<string, any>();
    for (const pc of productionChapters) {
      map.set(pc.id, pc);
    }
    return map;
  });

  // Map of team members by ID
  let teamMap = $derived.by(() => {
    const map = new Map<string, any>();
    for (const m of team) {
      map.set(m.id, m);
    }
    return map;
  });

  // Build Unified Editorial Commitments List
  let allCommitments = $derived.by(() => {
    const list: any[] = [];

    // 1. Editorial Pipeline Stages
    for (const cs of chapterStages) {
      // Must have an assignee or be done
      if (!cs.assigned_to && cs.status !== 'DONE') {
        continue;
      }

      const prodChId = cs.production_chapter_id || cs.chapter_id;
      const pc = prodChaptersMap.get(prodChId);
      const stageObj = cs.stage || stages.find((s: any) => s.id === cs.stage_id);
      const stageSlug = stageObj?.slug || 'etapa';
      const stageName = stageObj?.name || 'Etapa Editorial';
      const stageColor = getStageColor(stageSlug, stageObj?.color);

      const workTitle = pc?.work?.title || pc?.chapter_title || 'Obra';
      const workCoverId = pc?.work?.cover_id || null;
      const chapterNumber = pc?.chapter_number || '1';
      const chapterLabel = pc?.chapter_label || null;

      const assigneeObj = cs.assignee || (cs.assigned_to ? teamMap.get(cs.assigned_to) : null);

      let dueYMD = '';
      let isOverdue = false;
      let remainingHours = 0;
      let canExtend = false;

      if (cs.due_at) {
        const dueSp = getSaoPauloDate(cs.due_at);
        dueYMD = formatYMD(dueSp);
        const nowMs = Date.now();
        const dueMs = new Date(cs.due_at).getTime();
        const diffMs = dueMs - nowMs;
        remainingHours = Math.round(diffMs / (1000 * 60 * 60));
        isOverdue = diffMs < 0 && cs.status !== 'DONE';

        // Extension is available within 24 hours of due date (or if due date was chosen as today)
        // Only if currently in progress, assigned to current user, and extensionCount === 0
        const isMine = cs.assigned_to === currentUserId;
        const extensionCount = Number(cs.extension_count || 0);
        canExtend = isMine && cs.status === 'IN_PROGRESS' && extensionCount === 0 && (remainingHours <= 24 || dueYMD === todayYMD) && diffMs > -(4 * 60 * 60 * 1000);
      }

      list.push({
        id: cs.id,
        kind: 'EDITORIAL_STAGE',
        stageId: cs.stage_id,
        stageSlug,
        stageName,
        stageColor,
        chapterStage: cs,
        productionChapter: pc,
        workTitle,
        workCoverId,
        chapterNumber,
        chapterLabel,
        assignee: assigneeObj,
        assignedTo: cs.assigned_to,
        status: cs.status, // AVAILABLE, IN_PROGRESS, REWORK, DONE
        claimedAt: cs.claimed_at,
        dueAt: cs.due_at,
        dueYMD,
        originalDueAt: cs.original_due_at || cs.due_at,
        extensionCount: Number(cs.extension_count || 0),
        extendedAt: cs.extended_at,
        notes: cs.notes || '',
        completedAt: cs.completed_at,
        isOverdue,
        remainingHours,
        canExtend
      });
    }

    // 2. Generic Scan Tasks with due_at
    for (const t of tasks) {
      if (!t.due_at) continue;
      const dueSp = getSaoPauloDate(t.due_at);
      const dueYMD = formatYMD(dueSp);
      const nowMs = Date.now();
      const dueMs = new Date(t.due_at).getTime();
      const diffMs = dueMs - nowMs;
      const isOverdue = diffMs < 0 && t.status !== 'DONE' && t.status !== 'CANCELLED';

      list.push({
        id: t.id,
        kind: 'SCAN_TASK',
        stageSlug: 'tarefa',
        stageName: 'Tarefa Geral',
        stageColor: '#6366f1',
        workTitle: t.title,
        workCoverId: null,
        chapterNumber: null,
        chapterLabel: null,
        assignee: t.assigned_to ? teamMap.get(t.assigned_to) : null,
        assignedTo: t.assigned_to,
        status: t.status,
        claimedAt: t.created_at,
        dueAt: t.due_at,
        dueYMD,
        originalDueAt: t.original_due_at || t.due_at,
        extensionCount: Number(t.extension_count || 0),
        extendedAt: t.extended_at,
        notes: t.description || '',
        completedAt: t.completed_at,
        isOverdue,
        remainingHours: Math.round(diffMs / (1000 * 60 * 60)),
        canExtend: false
      });
    }

    return list;
  });

  // Filtered Commitments based on user filters
  let filteredCommitments = $derived.by(() => {
    return allCommitments.filter((item) => {
      // Stage filter
      if (filterStageSlug !== 'ALL') {
        if (item.stageSlug !== filterStageSlug) return false;
      }
      // Assignee filter
      if (filterAssigneeId === 'MINE') {
        if (item.assignedTo !== currentUserId) return false;
      } else if (filterAssigneeId !== 'ALL') {
        if (item.assignedTo !== filterAssigneeId) return false;
      }
      // Status filter
      if (filterStatus === 'IN_PROGRESS') {
        if (item.status !== 'IN_PROGRESS') return false;
      } else if (filterStatus === 'DONE') {
        if (item.status !== 'DONE') return false;
      } else if (filterStatus === 'OVERDUE') {
        if (!item.isOverdue) return false;
      } else if (filterStatus === 'EXTENDED') {
        if (item.extensionCount === 0) return false;
      }
      return true;
    });
  });

  // Group filtered commitments by YMD date
  let commitmentsByDateMap = $derived.by(() => {
    const map = new Map<string, any[]>();
    for (const item of filteredCommitments) {
      if (!item.dueYMD) continue;
      if (!map.has(item.dueYMD)) map.set(item.dueYMD, []);
      map.get(item.dueYMD)!.push(item);
    }
    return map;
  });

  // Real Publications by YMD date
  let publicationsByDateMap = $derived.by(() => {
    const map = new Map<string, any[]>();
    for (const ch of chapters) {
      if (!ch.published_at) continue;
      const pubSp = getSaoPauloDate(ch.published_at);
      const ymd = formatYMD(pubSp);
      if (!map.has(ymd)) map.set(ymd, []);
      map.get(ymd)!.push(ch);
    }
    return map;
  });

  // Calendar Month Matrix Generation
  let monthGridCells = $derived.by(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells: Array<{
      dayNumber: number;
      ymd: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      commitments: any[];
      publications: any[];
      overdueCount: number;
      doneCount: number;
      inProgressCount: number;
      extendedCount: number;
    }> = [];

    // Leading days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const prevDate = new Date(currentYear, currentMonth - 1, day);
      const ymd = formatYMD(prevDate);
      const coms = commitmentsByDateMap.get(ymd) || [];
      const pubs = publicationsByDateMap.get(ymd) || [];
      cells.push({
        dayNumber: day,
        ymd,
        isCurrentMonth: false,
        isToday: ymd === todayYMD,
        isSelected: ymd === selectedDateYMD,
        commitments: coms,
        publications: pubs,
        overdueCount: coms.filter((c) => c.isOverdue).length,
        doneCount: coms.filter((c) => c.status === 'DONE').length,
        inProgressCount: coms.filter((c) => c.status === 'IN_PROGRESS' && !c.isOverdue).length,
        extendedCount: coms.filter((c) => c.extensionCount > 0).length
      });
    }

    // Days in current month
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const curDate = new Date(currentYear, currentMonth, day);
      const ymd = formatYMD(curDate);
      const coms = commitmentsByDateMap.get(ymd) || [];
      const pubs = publicationsByDateMap.get(ymd) || [];
      cells.push({
        dayNumber: day,
        ymd,
        isCurrentMonth: true,
        isToday: ymd === todayYMD,
        isSelected: ymd === selectedDateYMD,
        commitments: coms,
        publications: pubs,
        overdueCount: coms.filter((c) => c.isOverdue).length,
        doneCount: coms.filter((c) => c.status === 'DONE').length,
        inProgressCount: coms.filter((c) => c.status === 'IN_PROGRESS' && !c.isOverdue).length,
        extendedCount: coms.filter((c) => c.extensionCount > 0).length
      });
    }

    // Trailing days from next month
    const totalSlots = cells.length <= 35 ? 35 : 42;
    const remaining = totalSlots - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const nextDate = new Date(currentYear, currentMonth + 1, day);
      const ymd = formatYMD(nextDate);
      const coms = commitmentsByDateMap.get(ymd) || [];
      const pubs = publicationsByDateMap.get(ymd) || [];
      cells.push({
        dayNumber: day,
        ymd,
        isCurrentMonth: false,
        isToday: ymd === todayYMD,
        isSelected: ymd === selectedDateYMD,
        commitments: coms,
        publications: pubs,
        overdueCount: coms.filter((c) => c.isOverdue).length,
        doneCount: coms.filter((c) => c.status === 'DONE').length,
        inProgressCount: coms.filter((c) => c.status === 'IN_PROGRESS' && !c.isOverdue).length,
        extendedCount: coms.filter((c) => c.extensionCount > 0).length
      });
    }

    return cells;
  });

  // Selected Day Commitments & Publications
  let selectedDayCommitments = $derived(commitmentsByDateMap.get(selectedDateYMD) || []);
  let selectedDayPublications = $derived(publicationsByDateMap.get(selectedDateYMD) || []);

  let formattedSelectedDayHeader = $derived.by(() => {
    if (!selectedDateYMD) return '';
    const [y, m, d] = selectedDateYMD.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  });

  // Upcoming items for current user (Minhas Próximas Entregas)
  let myUpcomingDeliveries = $derived.by(() => {
    return allCommitments
      .filter((c) => c.assignedTo === currentUserId && c.status === 'IN_PROGRESS' && c.dueAt)
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
      .slice(0, 5);
  });

  // Overdue items across scan
  let overdueDeliveries = $derived.by(() => {
    return allCommitments
      .filter((c) => c.isOverdue)
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
      .slice(0, 6);
  });

  // Selection handler
  function handleSelectDay(ymd: string) {
    selectedDateYMD = ymd;
    showDayDrawer = true;
  }

  // Extension Modal Handler
  function openExtensionModal(item: any) {
    extensionTargetItem = item;
    extensionFeedback = null;
    showExtensionModal = true;
  }

  function closeExtensionModal() {
    showExtensionModal = false;
    extensionTargetItem = null;
    extensionFeedback = null;
  }

  // Calculate projected new due date for modal
  let projectedExtensionDate = $derived.by(() => {
    if (!extensionTargetItem?.dueAt) return '';
    const curDue = getSaoPauloDate(extensionTargetItem.dueAt);
    curDue.setDate(curDue.getDate() + 2);
    return curDue.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  });

  let currentDueFormatted = $derived.by(() => {
    if (!extensionTargetItem?.dueAt) return '';
    const curDue = getSaoPauloDate(extensionTargetItem.dueAt);
    return curDue.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long'
    });
  });

  // Notes editing trigger
  function startEditingNote(item: any) {
    editingNoteId = item.id;
    noteTextDraft = item.notes || '';
  }

  function cancelEditingNote() {
    editingNoteId = null;
    noteTextDraft = '';
  }
</script>

<div class="calendar-workspace-tab">
  <!-- 1. TOP HEADER & FILTER BAR -->
  <header class="calendar-main-header">
    <div class="header-titles">
      <div class="header-icon-badge purple">
        <CalendarIcon size={22} />
      </div>
      <div>
        <h2 class="calendar-title">Calendário & Prazos da Equipe</h2>
        <p class="calendar-subtitle">
          Gerenciamento inteligente de entregas editoriais, compromissos, notas e prorrogações automáticas.
        </p>
      </div>
    </div>

    <!-- Navigation Bar: Month/Year Controls + Today + View Switcher -->
    <div class="calendar-controls-row">
      <div class="month-selector-group">
        <button type="button" class="btn-ctrl-arrow" onclick={prevMonth} aria-label="Mês anterior" title="Mês anterior">
          <ChevronLeft size={18} />
        </button>

        <h3 class="current-month-display">
          {MONTH_NAMES[currentMonth]} {currentYear}
        </h3>

        <button type="button" class="btn-ctrl-arrow" onclick={nextMonth} aria-label="Próximo mês" title="Próximo mês">
          <ChevronRight size={18} />
        </button>

        <button type="button" class="btn-today-pill" onclick={goToToday} title="Ir para a data de hoje">
          Hoje
        </button>
      </div>

      <!-- View Switcher (Mês / Agenda) -->
      <div class="view-mode-toggle" role="group" aria-label="Modo de visualização">
        <button
          type="button"
          class="btn-toggle-view"
          class:active={activeViewMode === 'MONTH'}
          onclick={() => (activeViewMode = 'MONTH')}
        >
          <CalendarIcon size={14} />
          <span>Mês</span>
        </button>
        <button
          type="button"
          class="btn-toggle-view"
          class:active={activeViewMode === 'AGENDA'}
          onclick={() => (activeViewMode = 'AGENDA')}
        >
          <Layers size={14} />
          <span>Agenda</span>
        </button>
      </div>
    </div>

    <!-- 2. QUICK FILTER STRIP -->
    <div class="filters-action-strip">
      <div class="filter-group">
        <span class="filter-label">
          <Filter size={13} />
          Etapa:
        </span>
        <select bind:value={filterStageSlug} class="filter-select">
          <option value="ALL">Todas as etapas</option>
          <option value="traducao">Tradução</option>
          <option value="clean_redraw">Clean / Redraw</option>
          <option value="typeset">Typeset</option>
          <option value="revisor_qc">Revisor (QC)</option>
          <option value="raw">Raw Provider</option>
          <option value="pre_aprovado">Pré-Aprovado</option>
        </select>
      </div>

      <div class="filter-group">
        <span class="filter-label">Responsável:</span>
        <select bind:value={filterAssigneeId} class="filter-select">
          <option value="ALL">Toda a equipe</option>
          <option value="MINE">Minhas entregas</option>
          {#each team as member}
            <option value={member.id}>{member.display_name || member.username}</option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <span class="filter-label">Situação:</span>
        <select bind:value={filterStatus} class="filter-select">
          <option value="ALL">Todas as situações</option>
          <option value="IN_PROGRESS">Em andamento</option>
          <option value="DONE">Concluídos</option>
          <option value="OVERDUE">Em atraso</option>
          <option value="EXTENDED">Prorrogados (+2d)</option>
        </select>
      </div>
    </div>
  </header>

  <!-- 3. MAIN WORKSPACE SPLIT LAYOUT -->
  <div class="calendar-workspace-grid">
    <!-- LEFT / MAIN: MONTH GRID OR AGENDA VIEW -->
    <div class="calendar-primary-pane">
      {#if activeViewMode === 'MONTH'}
        <div class="calendar-grid-card">
          <!-- Weekday Headers -->
          <div class="weekday-header-row">
            {#each WEEK_DAYS as wd, idx}
              <div class="weekday-header-cell" class:weekend={idx === 0 || idx === 6}>
                <span>{wd}</span>
              </div>
            {/each}
          </div>

          <!-- 7-Column Days Grid -->
          <div class="days-matrix-grid">
            {#each monthGridCells as cell}
              {@const hasItems = cell.commitments.length > 0 || cell.publications.length > 0}
              <button
                type="button"
                class="matrix-day-cell"
                class:is-other-month={!cell.isCurrentMonth}
                class:is-today={cell.isToday}
                class:is-selected={cell.isSelected}
                class:has-deliveries={cell.commitments.length > 0}
                onclick={() => handleSelectDay(cell.ymd)}
              >
                <!-- Day Cell Header: Number + Status Dots -->
                <div class="day-cell-header">
                  <span class="day-cell-number">{cell.dayNumber}</span>
                  {#if cell.isToday}
                    <span class="badge-today-label">Hoje</span>
                  {/if}

                  <!-- Mobile Status Dots (visible under 768px) -->
                  <div class="mobile-dots-strip">
                    {#if cell.overdueCount > 0}
                      <span class="m-dot overdue" title="{cell.overdueCount} em atraso"></span>
                    {/if}
                    {#if cell.inProgressCount > 0}
                      <span class="m-dot in-progress" title="{cell.inProgressCount} em andamento"></span>
                    {/if}
                    {#if cell.extendedCount > 0}
                      <span class="m-dot extended" title="{cell.extendedCount} prorrogado"></span>
                    {/if}
                    {#if cell.doneCount > 0}
                      <span class="m-dot done" title="{cell.doneCount} concluído"></span>
                    {/if}
                    {#if cell.publications.length > 0}
                      <span class="m-dot publication" title="{cell.publications.length} publicado"></span>
                    {/if}
                  </div>
                </div>

                <!-- Desktop Commitments Event Pills -->
                <div class="cell-events-list">
                  {#each cell.commitments.slice(0, 3) as item}
                    <div
                      class="event-pill"
                      class:overdue={item.isOverdue}
                      class:done={item.status === 'DONE'}
                      class:extended={item.extensionCount > 0 && item.status !== 'DONE'}
                      style="--pill-color: {item.stageColor}"
                      title="{item.workTitle} - Cap. #{item.chapterNumber} ({item.stageName}) - {item.assignee?.display_name || 'Membro'}"
                    >
                      <span class="pill-dot" style="background: {item.stageColor}"></span>
                      <span class="pill-text">
                        {item.workTitle.slice(0, 14)} #{item.chapterNumber} • {item.stageName}
                      </span>
                      {#if item.extensionCount > 0 && item.status !== 'DONE'}
                        <span class="pill-ext-badge">+2d</span>
                      {/if}
                      {#if item.status === 'DONE'}
                        <Check size={10} class="pill-done-ico" />
                      {/if}
                    </div>
                  {/each}

                  <!-- Overflow Counter if > 3 items -->
                  {#if cell.commitments.length > 3}
                    <div class="event-overflow-pill">
                      <span>+{cell.commitments.length - 3} mais</span>
                    </div>
                  {/if}

                  <!-- Publications Indicator -->
                  {#each cell.publications.slice(0, 1) as pub}
                    <div class="publication-pill" title="Publicado no site: {pub.works?.title || 'Obra'} #{pub.number}">
                      <Sparkles size={10} />
                      <span>Pub. #{pub.number}</span>
                    </div>
                  {/each}
                </div>
              </button>
            {/each}
          </div>
        </div>
      {:else}
        <!-- AGENDA / CHRONOLOGICAL VIEW -->
        <div class="agenda-view-card calendar-agenda-view">
          <div class="agenda-header">
            <Layers size={18} class="cyan" />
            <h3>Próximas Entregas em Ordem Cronológica ({filteredCommitments.length})</h3>
          </div>

          {#if filteredCommitments.length === 0}
            <div class="empty-state-box">
              <CheckCircle2 size={36} class="emerald" />
              <p>Nenhuma entrega encontrada para os filtros selecionados.</p>
            </div>
          {:else}
            <div class="agenda-items-list">
              {#each filteredCommitments as item}
                <div
                  class="agenda-row-card"
                  class:is-overdue={item.isOverdue}
                  class:is-done={item.status === 'DONE'}
                  class:is-extended={item.extensionCount > 0}
                >
                  <div class="agenda-date-badge">
                    <span class="badge-day">{item.dueYMD ? item.dueYMD.split('-')[2] : '--'}</span>
                    <span class="badge-month">
                      {item.dueYMD ? MONTH_NAMES[Number(item.dueYMD.split('-')[1]) - 1].slice(0, 3) : ''}
                    </span>
                  </div>

                  <div class="agenda-details-col">
                    <div class="agenda-top-line">
                      <span class="agenda-work-name">{item.workTitle}</span>
                      {#if item.chapterNumber}
                        <span class="agenda-ch-pill">Cap. #{item.chapterNumber}</span>
                      {/if}
                      <span class="agenda-stage-pill" style="--stage-c: {item.stageColor}">
                        <span class="dot"></span>
                        {item.stageName}
                      </span>
                    </div>

                    <div class="agenda-meta-line">
                      {#if item.assignee}
                        <div class="agenda-user-inline">
                          <UserAvatar user={item.assignee} size={16} />
                          <span>{item.assignee.display_name || item.assignee.username}</span>
                        </div>
                      {/if}

                      {#if item.isOverdue}
                        <span class="status-tag overdue">Atrasado</span>
                      {:else if item.status === 'DONE'}
                        <span class="status-tag done">Concluído</span>
                      {:else}
                        <span class="status-tag in-progress">Em andamento ({item.remainingHours}h)</span>
                      {/if}

                      {#if item.extensionCount > 0}
                        <span class="status-tag extended">Prorrogado (+2 dias)</span>
                      {/if}
                    </div>

                    {#if item.notes}
                      <p class="agenda-notes-quote">"{item.notes}"</p>
                    {/if}
                  </div>

                  <div class="agenda-actions-col">
                    {#if item.canExtend}
                      <button
                        type="button"
                        class="btn-quick-extend"
                        onclick={() => openExtensionModal(item)}
                        title="Prorrogar prazo +2 dias sem aprovação"
                      >
                        <Zap size={13} />
                        <span>+2 dias</span>
                      </button>
                    {/if}

                    <button
                      type="button"
                      class="btn-open-detail"
                      onclick={() => handleSelectDay(item.dueYMD || todayYMD)}
                    >
                      <span>Detalhes</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- RIGHT: COMPLEMENTARY SIDE PANELS -->
    <aside class="calendar-sidebar-pane">
      <!-- Panel 1: Minhas Próximas Entregas (Quick Access) -->
      <div class="side-panel-card">
        <div class="panel-header">
          <Clock size={16} class="cyan" />
          <h4>Minhas Próximas Entregas ({myUpcomingDeliveries.length})</h4>
        </div>

        {#if myUpcomingDeliveries.length === 0}
          <div class="side-empty-state">
            <CheckCircle2 size={24} class="emerald" />
            <p>Você não possui entregas pendentes no momento.</p>
          </div>
        {:else}
          <div class="side-deliveries-list">
            {#each myUpcomingDeliveries as item}
              <div class="my-delivery-item" class:is-overdue={item.isOverdue}>
                <div class="my-item-info">
                  <span class="my-item-work">{item.workTitle} #{item.chapterNumber}</span>
                  <div class="my-item-meta">
                    <span class="my-stage-badge" style="--stage-c: {item.stageColor}">{item.stageName}</span>
                    <span class="my-due-text">Prazo: {item.dueYMD.split('-')[2]}/{item.dueYMD.split('-')[1]} às 23:59</span>
                  </div>
                </div>

                <div class="my-item-actions">
                  {#if item.canExtend}
                    <button
                      type="button"
                      class="btn-extend-badge"
                      onclick={() => openExtensionModal(item)}
                      title="Prorrogar prazo +2 dias automaticamente"
                    >
                      <Zap size={12} />
                      <span>Prorrogar +2d</span>
                    </button>
                  {/if}
                  <button
                    type="button"
                    class="btn-mini-view"
                    onclick={() => handleSelectDay(item.dueYMD)}
                    title="Ver no calendário"
                  >
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Panel 2: Entregas em Atraso (se houver) -->
      {#if overdueDeliveries.length > 0}
        <div class="side-panel-card alert-panel">
          <div class="panel-header">
            <AlertTriangle size={16} class="red" />
            <h4 class="text-red">Entregas em Atraso ({overdueDeliveries.length})</h4>
          </div>

          <div class="side-deliveries-list">
            {#each overdueDeliveries as item}
              <div class="overdue-item-row">
                <div class="overdue-info">
                  <span class="overdue-work">{item.workTitle} #{item.chapterNumber} • {item.stageName}</span>
                  <span class="overdue-assignee">Resp: {item.assignee?.display_name || item.assignee?.username || 'Membro'}</span>
                </div>
                <button
                  type="button"
                  class="btn-mini-view"
                  onclick={() => handleSelectDay(item.dueYMD || todayYMD)}
                  title="Ver detalhes"
                >
                  <ArrowRight size={13} />
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Panel 3: Disponibilidade dos Membros -->
      <div class="side-panel-card">
        <div class="panel-header">
          <User size={16} class="purple" />
          <h4>Disponibilidade da Equipe</h4>
        </div>

        <div class="team-avail-list">
          {#each team.slice(0, 8) as member}
            <div class="avail-member-row">
              <div class="avail-user-group">
                <span class="avail-dot {member.availability_status?.toLowerCase() || 'active'}"></span>
                <span class="avail-name">{member.display_name || member.username}</span>
              </div>
              <span class="avail-badge {member.availability_status?.toLowerCase() || 'active'}">
                {member.availability_status === 'BUSY' ? 'Ocupado' :
                 member.availability_status === 'AWAY' ? 'Ausente' :
                 member.availability_status === 'HIATUS' ? 'Em Hiato' : 'Disponível'}
              </span>
            </div>
          {/each}
        </div>
      </div>
    </aside>
  </div>
</div>

<!-- ========================================================================= -->
<!-- 4. DAY DETAILS DRAWER / MODAL (Opens on date click, Desktop & Android)    -->
<!-- ========================================================================= -->
{#if showDayDrawer}
  <div
    class="drawer-backdrop"
    onclick={(e) => {
      if (e.target === e.currentTarget) showDayDrawer = false;
    }}
    role="dialog"
    aria-modal="true"
    aria-label="Detalhes do dia selecionado"
  >
    <div class="day-drawer-panel">
      <!-- Drawer Header -->
      <header class="drawer-header">
        <div class="drawer-header-info">
          <span class="drawer-header-kicker">Compromissos e Entregas</span>
          <h3 class="drawer-date-title">{formattedSelectedDayHeader}</h3>
        </div>
        <button
          type="button"
          class="btn-close-drawer"
          onclick={() => (showDayDrawer = false)}
          aria-label="Fechar gaveta de detalhes"
        >
          <X size={20} />
        </button>
      </header>

      <!-- Drawer Content -->
      <div class="drawer-body">
        <!-- 4.1 Commitments on this Day -->
        <div class="drawer-section">
          <h4 class="section-title">
            <Clock size={16} class="cyan" />
            <span>Prazos e Entregas Deste Dia ({selectedDayCommitments.length})</span>
          </h4>

          {#if selectedDayCommitments.length === 0}
            <div class="drawer-empty-box">
              <CheckCircle2 size={32} class="emerald" />
              <p>Nenhuma entrega agendada para esta data.</p>
            </div>
          {:else}
            <div class="commitments-cards-stack">
              {#each selectedDayCommitments as item}
                <article
                  class="commitment-detail-card"
                  class:is-overdue={item.isOverdue}
                  class:is-done={item.status === 'DONE'}
                  class:is-extended={item.extensionCount > 0}
                >
                  <!-- Card Header: Work + Stage + Status -->
                  <div class="card-head-row">
                    <div class="work-thumb-cluster">
                      {#if item.workCoverId}
                        <img src="/media/{item.workCoverId}" alt={item.workTitle} class="work-mini-cover" />
                      {:else}
                        <div class="work-mini-cover fallback">
                          <Briefcase size={16} />
                        </div>
                      {/if}

                      <div class="work-identity">
                        <span class="work-title-text">{item.workTitle}</span>
                        <div class="pills-cluster">
                          {#if item.chapterNumber}
                            <span class="pill-ch">Capítulo #{item.chapterNumber}</span>
                          {/if}
                          <span class="pill-stage" style="--stage-color: {item.stageColor}">
                            <span class="dot"></span>
                            {item.stageName}
                          </span>
                        </div>
                      </div>
                    </div>

                    <!-- Status Tag -->
                    <div class="status-badge-wrap">
                      {#if item.status === 'DONE'}
                        <span class="detail-badge done">
                          <Check size={12} />
                          Concluído
                        </span>
                      {:else if item.isOverdue}
                        <span class="detail-badge overdue">
                          <AlertTriangle size={12} />
                          Atrasado
                        </span>
                      {:else}
                        <span class="detail-badge in-progress">
                          <Clock size={12} />
                          Em Andamento
                        </span>
                      {/if}

                      {#if item.extensionCount > 0}
                        <span class="detail-badge extended">
                          <Sparkles size={11} />
                          Prorrogado (+2d)
                        </span>
                      {/if}
                    </div>
                  </div>

                  <!-- Assignee + Deadlines Meta Row -->
                  <div class="card-meta-grid">
                    <div class="meta-field">
                      <span class="meta-field-label">Responsável:</span>
                      <div class="meta-user-wrap">
                        <UserAvatar user={item.assignee} size={20} />
                        <span class="meta-user-name">{item.assignee?.display_name || item.assignee?.username || 'Membro da equipe'}</span>
                      </div>
                    </div>

                    <div class="meta-field">
                      <span class="meta-field-label">Prazo vigente:</span>
                      <span class="meta-due-val cyan">
                        {item.dueYMD ? `${item.dueYMD.split('-')[2]}/${item.dueYMD.split('-')[1]}/${item.dueYMD.split('-')[0]}` : '--'} às 23:59
                      </span>
                    </div>

                    {#if item.originalDueAt && item.extensionCount > 0}
                      <div class="meta-field">
                        <span class="meta-field-label">Prazo original:</span>
                        <span class="meta-due-orig">
                          {formatYMD(getSaoPauloDate(item.originalDueAt)).split('-')[2]}/{formatYMD(getSaoPauloDate(item.originalDueAt)).split('-')[1]}
                        </span>
                      </div>
                    {/if}
                  </div>

                  <!-- Observations / Notes Section -->
                  <div class="notes-display-box">
                    <div class="notes-header">
                      <span class="notes-title">
                        <FileText size={13} />
                        Observações do Responsável:
                      </span>
                      {#if (item.assignedTo === currentUserId || ['OWNER', 'ADMIN'].includes(userRole)) && editingNoteId !== item.id}
                        <button
                          type="button"
                          class="btn-edit-note"
                          onclick={() => startEditingNote(item)}
                        >
                          <Edit3 size={12} />
                          <span>{item.notes ? 'Editar nota' : 'Adicionar nota'}</span>
                        </button>
                      {/if}
                    </div>

                    {#if editingNoteId === item.id}
                      <!-- Inline Note Edit Form -->
                      <form
                        method="POST"
                        action="?/updateStageNotes"
                        use:enhance={() => {
                          isSavingNote = true;
                          return async ({ result, update }) => {
                            isSavingNote = false;
                            if (result.type === 'success') {
                              item.notes = noteTextDraft;
                              editingNoteId = null;
                              await update();
                            }
                          };
                        }}
                        class="note-edit-form"
                      >
                        <input type="hidden" name="chapter_stage_id" value={item.id} />
                        <textarea
                          name="notes"
                          bind:value={noteTextDraft}
                          maxlength="500"
                          rows="2"
                          class="note-textarea"
                          placeholder="Digite anotações ou atualizações do progresso..."
                        ></textarea>
                        <div class="note-edit-actions">
                          <button
                            type="button"
                            class="btn-cancel-note"
                            onclick={cancelEditingNote}
                            disabled={isSavingNote}
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            class="btn-save-note"
                            disabled={isSavingNote}
                          >
                            {#if isSavingNote}
                              <span>Salvando...</span>
                            {:else}
                              <Check size={13} />
                              <span>Salvar nota</span>
                            {/if}
                          </button>
                        </div>
                      </form>
                    {:else}
                      <p class="notes-content-text" class:empty={!item.notes}>
                        {item.notes ? `"${item.notes}"` : 'Nenhuma observação registrada.'}
                      </p>
                    {/if}
                  </div>

                  <!-- Card Action Buttons -->
                  <div class="card-footer-actions">
                    <!-- Extension Action (+2 Days) -->
                    {#if item.canExtend}
                      <button
                        type="button"
                        class="btn-trigger-extension"
                        onclick={() => openExtensionModal(item)}
                        title="Prorrogar prazo +2 dias corridos sem necessidade de aprovação"
                      >
                        <Zap size={14} />
                        <span>Prorrogar prazo +2 dias</span>
                      </button>
                    {/if}

                    <!-- Jump to Stage / Chapter Workspace -->
                    {#if item.productionChapter && onOpenChapter}
                      <button
                        type="button"
                        class="btn-jump-chapter"
                        onclick={() => {
                          showDayDrawer = false;
                          onOpenChapter(item.productionChapter);
                        }}
                      >
                        <span>Abrir na Produção</span>
                        <ArrowRight size={14} />
                      </button>
                    {/if}
                  </div>
                </article>
              {/each}
            </div>
          {/if}
        </div>

        <!-- 4.2 Publications on this Day -->
        {#if selectedDayPublications.length > 0}
          <div class="drawer-section mt">
            <h4 class="section-title">
              <Sparkles size={16} class="cyan" />
              <span>Capítulos Publicados no Site ({selectedDayPublications.length})</span>
            </h4>

            <div class="publications-cards-list">
              {#each selectedDayPublications as pub}
                <div class="pub-card-row">
                  <div class="pub-icon-orb">
                    <Sparkles size={16} />
                  </div>
                  <div class="pub-info-col">
                    <span class="pub-work-title">{pub.works?.title || 'Obra'}</span>
                    <span class="pub-sub-desc">
                      Capítulo #{pub.number} {pub.title ? `— ${pub.title}` : ''}
                    </span>
                  </div>
                  <a
                    href="/ler/{pub.id}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-view-reader"
                  >
                    <Eye size={13} />
                    <span>Ver no site</span>
                  </a>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- ========================================================================= -->
<!-- 5. AUTOMATIC 2-DAY EXTENSION CONFIRMATION MODAL                           -->
<!-- ========================================================================= -->
{#if showExtensionModal && extensionTargetItem}
  <div
    class="modal-backdrop"
    onclick={(e) => {
      if (e.target === e.currentTarget && !isExtending) closeExtensionModal();
    }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="ext-modal-title"
  >
    <div class="modal-card-small">
      <header class="ext-modal-header">
        <div class="ext-orb amber">
          <Zap size={22} />
        </div>
        <div>
          <h3 id="ext-modal-title" class="ext-modal-title">Prorrogar prazo +2 dias</h3>
          <p class="ext-modal-sub">Prorrogação automática instantânea, sem aprovação e sem justificativa.</p>
        </div>
        <button type="button" class="btn-close-modal" onclick={closeExtensionModal} disabled={isExtending}>
          <X size={18} />
        </button>
      </header>

      <form
        method="POST"
        action="?/extendStageDeadline"
        use:enhance={() => {
          isExtending = true;
          extensionFeedback = null;
          return async ({ result, update }) => {
            isExtending = false;
            if (result.type === 'failure') {
              extensionFeedback = {
                type: 'error',
                message: (result.data as any)?.message || 'Não foi possível prorrogar o prazo.'
              };
            } else if (result.type === 'success') {
              await update();
              closeExtensionModal();
            }
          };
        }}
        class="ext-form-body"
      >
        <input type="hidden" name="chapter_stage_id" value={extensionTargetItem.id} />

        {#if extensionFeedback}
          <div class="alert-banner error">
            <AlertCircle size={15} />
            <span>{extensionFeedback.message}</span>
          </div>
        {/if}

        <div class="ext-projection-box">
          <div class="ext-flow-row">
            <div class="ext-point">
              <span class="ext-point-label">Prazo Atual</span>
              <strong class="ext-point-val">{currentDueFormatted}</strong>
            </div>
            <div class="ext-arrow">
              <ArrowRight size={18} />
              <span class="plus-days">+2 dias</span>
            </div>
            <div class="ext-point">
              <span class="ext-point-label">Novo Prazo Final</span>
              <strong class="ext-point-val emerald">{projectedExtensionDate}</strong>
            </div>
          </div>
          <p class="ext-hint-text">
            O novo prazo de entrega será registrado até 23h59min59s (horário de Brasília).
            Lembre-se: é permitida <strong>uma única prorrogação automática</strong> por atribuição.
          </p>
        </div>

        <footer class="ext-actions-footer">
          <button
            type="button"
            class="btn-cancel"
            onclick={closeExtensionModal}
            disabled={isExtending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="btn-confirm-extension"
            disabled={isExtending}
          >
            {#if isExtending}
              <span class="spinner"></span>
              <span>Prorrogando...</span>
            {:else}
              <Zap size={15} />
              <span>Confirmar Prorrogação</span>
            {/if}
          </button>
        </footer>
      </form>
    </div>
  </div>
{/if}

<style>
  .calendar-workspace-tab {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    width: 100%;
  }

  /* 1. Header & Controls */
  .calendar-main-header {
    background: rgba(15, 23, 42, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1.25rem;
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  }

  .header-titles {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .header-icon-badge {
    width: 44px;
    height: 44px;
    border-radius: 0.85rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(139, 92, 246, 0.15);
    color: #c084fc;
    border: 1px solid rgba(139, 92, 246, 0.3);
    flex-shrink: 0;
  }

  .calendar-title {
    font-size: 1.35rem;
    font-weight: 800;
    color: #f8fafc;
    margin: 0;
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  .calendar-subtitle {
    font-size: 0.85rem;
    color: #94a3b8;
    margin: 0.25rem 0 0;
  }

  .calendar-controls-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .month-selector-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .current-month-display {
    font-size: 1.15rem;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0 0.5rem;
    min-width: 170px;
    text-align: center;
  }

  .btn-ctrl-arrow {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    width: 34px;
    height: 34px;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-ctrl-arrow:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .btn-today-pill {
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    color: #c084fc;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 0.4rem 0.85rem;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-today-pill:hover {
    background: rgba(139, 92, 246, 0.25);
    color: #fff;
  }

  .view-mode-toggle {
    display: flex;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.6rem;
    padding: 0.2rem;
    gap: 0.2rem;
  }

  .btn-toggle-view {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.85rem;
    border-radius: 0.45rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: #94a3b8;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-toggle-view.active {
    background: #8b5cf6;
    color: #fff;
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.35);
  }

  /* Filters */
  .filters-action-strip {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.05);
    padding: 0.6rem 0.9rem;
    border-radius: 0.75rem;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.8rem;
  }

  .filter-label {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    color: #94a3b8;
    font-weight: 500;
  }

  .filter-select {
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #f1f5f9;
    padding: 0.35rem 0.65rem;
    border-radius: 0.45rem;
    font-size: 0.8rem;
    font-family: inherit;
    outline: none;
    cursor: pointer;
    transition: border-color 0.15s ease;
  }

  .filter-select:focus {
    border-color: #8b5cf6;
  }

  /* 2. Primary Layout Grid */
  .calendar-workspace-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  @media (min-width: 1080px) {
    .calendar-workspace-grid {
      grid-template-columns: 1fr 340px;
    }
  }

  /* 3. Monthly Calendar Grid Card */
  .calendar-grid-card {
    background: rgba(15, 23, 42, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1.25rem;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  }

  .weekday-header-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    text-align: center;
  }

  .weekday-header-cell {
    padding: 0.75rem 0.25rem;
    font-size: 0.78rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .weekday-header-cell.weekend {
    color: #64748b;
  }

  .days-matrix-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
    background: rgba(255, 255, 255, 0.05);
  }

  .matrix-day-cell {
    background: #080c16;
    min-height: 100px;
    display: flex;
    flex-direction: column;
    padding: 0.45rem;
    text-align: left;
    border: none;
    cursor: pointer;
    transition: all 0.15s ease;
    outline: none;
    position: relative;
  }

  .matrix-day-cell:hover {
    background: #0f172a;
  }

  .matrix-day-cell.is-other-month {
    background: rgba(6, 10, 19, 0.5);
    opacity: 0.4;
  }

  .matrix-day-cell.is-today {
    background: rgba(139, 92, 246, 0.06);
    border: 1px solid rgba(139, 92, 246, 0.35);
  }

  .matrix-day-cell.is-selected {
    box-shadow: inset 0 0 0 2px #8b5cf6;
    background: rgba(139, 92, 246, 0.12);
  }

  .day-cell-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.35rem;
  }

  .day-cell-number {
    font-size: 0.85rem;
    font-weight: 700;
    color: #cbd5e1;
  }

  .matrix-day-cell.is-today .day-cell-number {
    color: #c084fc;
  }

  .badge-today-label {
    font-size: 0.62rem;
    font-weight: 700;
    background: #8b5cf6;
    color: #fff;
    padding: 0.1rem 0.35rem;
    border-radius: 0.3rem;
  }

  /* Mobile Dots Strip */
  .mobile-dots-strip {
    display: none;
    align-items: center;
    gap: 3px;
  }

  .m-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .m-dot.overdue { background: #ef4444; }
  .m-dot.in-progress { background: #38bdf8; }
  .m-dot.extended { background: #a855f7; }
  .m-dot.done { background: #10b981; }
  .m-dot.publication { background: #06b6d4; }

  /* Cell Events List (Desktop) */
  .cell-events-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    overflow: hidden;
    flex: 1;
  }

  .event-pill {
    background: rgba(255, 255, 255, 0.05);
    border-left: 3px solid var(--pill-color, #8b5cf6);
    border-radius: 0.3rem;
    padding: 0.2rem 0.35rem;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.7rem;
    color: #e2e8f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: transform 0.1s ease;
  }

  .event-pill:hover {
    transform: scale(1.02);
  }

  .event-pill.overdue {
    background: rgba(239, 68, 68, 0.15);
    border-left-color: #ef4444;
    color: #fca5a5;
  }

  .event-pill.done {
    background: rgba(16, 185, 129, 0.12);
    border-left-color: #10b981;
    color: #6ee7b7;
  }

  .event-pill.extended {
    border-left-color: #a855f7;
  }

  .pill-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .pill-text {
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .pill-ext-badge {
    font-size: 0.6rem;
    font-weight: 700;
    color: #c084fc;
    background: rgba(139, 92, 246, 0.25);
    padding: 0.05rem 0.25rem;
    border-radius: 0.25rem;
  }

  :global(.pill-done-ico) {
    color: #10b981;
    flex-shrink: 0;
  }

  .event-overflow-pill {
    font-size: 0.65rem;
    font-weight: 700;
    color: #94a3b8;
    padding: 0.1rem 0.25rem;
    border-radius: 0.25rem;
  }

  .publication-pill {
    background: rgba(6, 182, 212, 0.12);
    border-left: 3px solid #06b6d4;
    color: #22d3ee;
    border-radius: 0.3rem;
    padding: 0.2rem 0.35rem;
    font-size: 0.68rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  /* Agenda View */
  .agenda-view-card {
    background: rgba(15, 23, 42, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1.25rem;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .agenda-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    color: #f1f5f9;
  }

  .agenda-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
  }

  .agenda-items-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .agenda-row-card {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 0.85rem;
    padding: 0.9rem 1.15rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: all 0.15s ease;
  }

  .agenda-row-card:hover {
    border-color: rgba(255, 255, 255, 0.15);
    background: rgba(0, 0, 0, 0.4);
  }

  .agenda-row-card.is-overdue {
    border-color: rgba(239, 68, 68, 0.35);
    background: rgba(239, 68, 68, 0.05);
  }

  .agenda-row-card.is-done {
    border-color: rgba(16, 185, 129, 0.3);
  }

  .agenda-date-badge {
    width: 48px;
    height: 48px;
    border-radius: 0.6rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .badge-day {
    font-size: 1.15rem;
    font-weight: 800;
    color: #f8fafc;
    line-height: 1;
  }

  .badge-month {
    font-size: 0.65rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
  }

  .agenda-details-col {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    flex: 1;
    min-width: 0;
  }

  .agenda-top-line {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
  }

  .agenda-work-name {
    font-size: 0.92rem;
    font-weight: 700;
    color: #f1f5f9;
  }

  .agenda-ch-pill {
    font-size: 0.72rem;
    background: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
    padding: 0.1rem 0.4rem;
    border-radius: 0.3rem;
  }

  .agenda-stage-pill {
    font-size: 0.72rem;
    font-weight: 600;
    background: rgba(139, 92, 246, 0.15);
    color: var(--stage-c, #a855f7);
    border: 1px solid color-mix(in srgb, var(--stage-c, #a855f7) 35%, transparent);
    padding: 0.1rem 0.45rem;
    border-radius: 0.3rem;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .agenda-stage-pill .dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
  }

  .agenda-meta-line {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
    font-size: 0.78rem;
  }

  .agenda-user-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: #cbd5e1;
  }

  .status-tag {
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.1rem 0.4rem;
    border-radius: 0.3rem;
  }

  .status-tag.in-progress { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
  .status-tag.overdue { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
  .status-tag.done { background: rgba(16, 185, 129, 0.15); color: #10b981; }
  .status-tag.extended { background: rgba(168, 85, 247, 0.15); color: #c084fc; }

  .agenda-notes-quote {
    font-size: 0.78rem;
    color: #94a3b8;
    margin: 0.2rem 0 0;
    font-style: italic;
  }

  .agenda-actions-col {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .btn-quick-extend {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.35);
    color: #fbbf24;
    padding: 0.4rem 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-quick-extend:hover {
    background: rgba(245, 158, 11, 0.25);
    color: #fff;
  }

  .btn-open-detail {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
    padding: 0.4rem 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-open-detail:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  /* 4. Side Panels */
  .calendar-sidebar-pane {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .side-panel-card {
    background: rgba(15, 23, 42, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1.25rem;
    padding: 1.15rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  }

  .side-panel-card.alert-panel {
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.04);
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .panel-header h4 {
    margin: 0;
    font-size: 0.88rem;
    font-weight: 700;
    color: #f1f5f9;
  }

  .text-red { color: #f87171 !important; }

  .side-deliveries-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .my-delivery-item {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 0.75rem;
    padding: 0.65rem 0.8rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .my-delivery-item.is-overdue {
    border-color: rgba(239, 68, 68, 0.3);
  }

  .my-item-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .my-item-work {
    font-size: 0.82rem;
    font-weight: 700;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .my-item-meta {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .my-stage-badge {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--stage-c, #a855f7);
  }

  .my-due-text {
    font-size: 0.68rem;
    color: #94a3b8;
  }

  .my-item-actions {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .btn-extend-badge {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #fbbf24;
    padding: 0.25rem 0.5rem;
    border-radius: 0.4rem;
    font-size: 0.68rem;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-extend-badge:hover {
    background: rgba(245, 158, 11, 0.25);
    color: #fff;
  }

  .btn-mini-view {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    width: 26px;
    height: 26px;
    border-radius: 0.4rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .btn-mini-view:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .overdue-item-row {
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 0.65rem;
    padding: 0.55rem 0.75rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .overdue-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .overdue-work {
    font-size: 0.8rem;
    font-weight: 700;
    color: #fca5a5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .overdue-assignee {
    font-size: 0.68rem;
    color: #94a3b8;
  }

  /* Team Availability */
  .team-avail-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .avail-member-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.78rem;
  }

  .avail-user-group {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .avail-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .avail-dot.active { background: #10b981; }
  .avail-dot.busy { background: #f59e0b; }
  .avail-dot.away { background: #64748b; }
  .avail-dot.hiatus { background: #ef4444; }

  .avail-name { color: #e2e8f0; font-weight: 500; }

  .avail-badge {
    font-size: 0.7rem;
    font-weight: 600;
  }

  .avail-badge.active { color: #10b981; }
  .avail-badge.busy { color: #f59e0b; }
  .avail-badge.away { color: #64748b; }
  .avail-badge.hiatus { color: #ef4444; }

  .side-empty-state {
    text-align: center;
    padding: 1.5rem 0.5rem;
    color: #94a3b8;
    font-size: 0.8rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  /* ========================================================================= */
  /* DAY DETAIL DRAWER / MODAL (Desktop & Android)                             */
  /* ========================================================================= */
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9998;
    background: rgba(4, 7, 18, 0.75);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .day-drawer-panel {
    background: #090e1a;
    border-left: 1px solid rgba(139, 92, 246, 0.25);
    width: 100%;
    max-width: 520px;
    height: 100%;
    display: flex;
    flex-direction: column;
    box-shadow: -15px 0 45px rgba(0, 0, 0, 0.6);
    animation: drawerSlide 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes drawerSlide {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(15, 23, 42, 0.6);
  }

  .drawer-header-kicker {
    font-size: 0.72rem;
    font-weight: 700;
    color: #a855f7;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .drawer-date-title {
    font-size: 1.15rem;
    font-weight: 800;
    color: #f8fafc;
    margin: 0.15rem 0 0;
    text-transform: capitalize;
  }

  .btn-close-drawer {
    background: transparent;
    border: none;
    color: #64748b;
    padding: 0.5rem;
    border-radius: 0.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .btn-close-drawer:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .drawer-body {
    padding: 1.5rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    flex: 1;
  }

  .drawer-section {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0;
  }

  .commitments-cards-stack {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .commitment-detail-card {
    background: rgba(15, 23, 42, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1rem;
    padding: 1.15rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  }

  .commitment-detail-card.is-overdue {
    border-color: rgba(239, 68, 68, 0.35);
    background: rgba(239, 68, 68, 0.05);
  }

  .commitment-detail-card.is-done {
    border-color: rgba(16, 185, 129, 0.35);
  }

  .card-head-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .work-thumb-cluster {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .work-mini-cover {
    width: 40px;
    height: 52px;
    border-radius: 0.4rem;
    object-fit: cover;
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  .work-mini-cover.fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
  }

  .work-identity {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  .work-title-text {
    font-size: 0.95rem;
    font-weight: 700;
    color: #f8fafc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pills-cluster {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .pill-ch {
    font-size: 0.7rem;
    background: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
    padding: 0.1rem 0.4rem;
    border-radius: 0.3rem;
  }

  .pill-stage {
    font-size: 0.7rem;
    font-weight: 600;
    background: rgba(139, 92, 246, 0.15);
    color: var(--stage-color, #a855f7);
    border: 1px solid color-mix(in srgb, var(--stage-color, #a855f7) 35%, transparent);
    padding: 0.1rem 0.45rem;
    border-radius: 0.3rem;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .pill-stage .dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
  }

  .status-badge-wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.25rem;
  }

  .detail-badge {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    border-radius: 0.35rem;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .detail-badge.in-progress { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
  .detail-badge.overdue { background: rgba(239, 68, 68, 0.2); color: #f87171; }
  .detail-badge.done { background: rgba(16, 185, 129, 0.15); color: #10b981; }
  .detail-badge.extended { background: rgba(168, 85, 247, 0.2); color: #c084fc; }

  /* Meta Grid */
  .card-meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 0.75rem;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.05);
    padding: 0.75rem;
    border-radius: 0.65rem;
  }

  .meta-field {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .meta-field-label {
    font-size: 0.68rem;
    color: #94a3b8;
    text-transform: uppercase;
    font-weight: 600;
  }

  .meta-user-wrap {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .meta-user-name {
    font-size: 0.8rem;
    font-weight: 600;
    color: #f1f5f9;
  }

  .meta-due-val.cyan {
    font-size: 0.82rem;
    font-weight: 700;
    color: #22d3ee;
  }

  .meta-due-orig {
    font-size: 0.78rem;
    color: #64748b;
    text-decoration: line-through;
  }

  /* Notes */
  .notes-display-box {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 0.65rem;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .notes-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .notes-title {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: #cbd5e1;
  }

  .btn-edit-note {
    background: transparent;
    border: none;
    color: #a855f7;
    font-size: 0.72rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    cursor: pointer;
    padding: 0.15rem 0.4rem;
    border-radius: 0.3rem;
  }

  .btn-edit-note:hover {
    background: rgba(168, 85, 247, 0.15);
  }

  .notes-content-text {
    font-size: 0.8rem;
    color: #f1f5f9;
    margin: 0;
    font-style: italic;
    line-height: 1.4;
  }

  .notes-content-text.empty {
    color: #64748b;
    font-style: normal;
  }

  .note-edit-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.3rem;
  }

  .note-textarea {
    width: 100%;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0.5rem;
    padding: 0.5rem 0.65rem;
    font-size: 0.8rem;
    color: #f1f5f9;
    box-sizing: border-box;
    font-family: inherit;
    resize: none;
  }

  .note-edit-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .btn-cancel-note {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    padding: 0.3rem 0.65rem;
    border-radius: 0.4rem;
    font-size: 0.72rem;
    cursor: pointer;
  }

  .btn-save-note {
    background: #8b5cf6;
    border: none;
    color: #fff;
    padding: 0.3rem 0.75rem;
    border-radius: 0.4rem;
    font-size: 0.72rem;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    cursor: pointer;
  }

  /* Card Footer Actions */
  .card-footer-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    flex-wrap: wrap;
  }

  .btn-trigger-extension {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.2));
    border: 1px solid rgba(245, 158, 11, 0.4);
    color: #fbbf24;
    padding: 0.55rem 0.95rem;
    border-radius: 0.55rem;
    font-size: 0.78rem;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15);
    transition: all 0.15s ease;
  }

  .btn-trigger-extension:hover {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.3), rgba(217, 119, 6, 0.3));
    color: #fff;
    transform: translateY(-1px);
  }

  .btn-jump-chapter {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #f1f5f9;
    padding: 0.55rem 0.95rem;
    border-radius: 0.55rem;
    font-size: 0.78rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-jump-chapter:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .drawer-empty-box {
    text-align: center;
    padding: 2.5rem 1rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 0.85rem;
    color: #94a3b8;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.85rem;
  }

  /* Publications in Drawer */
  .publications-cards-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .pub-card-row {
    background: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.25);
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .pub-icon-orb {
    width: 34px;
    height: 34px;
    border-radius: 0.5rem;
    background: rgba(6, 182, 212, 0.15);
    color: #06b6d4;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .pub-info-col {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
    flex: 1;
  }

  .pub-work-title {
    font-size: 0.88rem;
    font-weight: 700;
    color: #f1f5f9;
  }

  .pub-sub-desc {
    font-size: 0.75rem;
    color: #22d3ee;
  }

  .btn-view-reader {
    background: rgba(6, 182, 212, 0.15);
    border: 1px solid rgba(6, 182, 212, 0.3);
    color: #22d3ee;
    padding: 0.35rem 0.65rem;
    border-radius: 0.45rem;
    font-size: 0.72rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .btn-view-reader:hover {
    background: rgba(6, 182, 212, 0.25);
    color: #fff;
  }

  /* ========================================================================= */
  /* EXTENSION MODAL STYLES                                                    */
  /* ========================================================================= */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(4, 7, 18, 0.8);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: max(1rem, env(safe-area-inset-top, 1rem)) 1rem max(1rem, env(safe-area-inset-bottom, 1rem));
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .modal-card-small {
    background: #0b0f19;
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 1.25rem;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(245, 158, 11, 0.15);
    width: 100%;
    max-width: 440px;
    margin: auto 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .ext-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.25rem 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .ext-orb {
    width: 42px;
    height: 42px;
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.35);
    flex-shrink: 0;
  }

  .ext-modal-title {
    font-size: 1.05rem;
    font-weight: 800;
    color: #f8fafc;
    margin: 0;
  }

  .ext-modal-sub {
    font-size: 0.78rem;
    color: #94a3b8;
    margin: 0.15rem 0 0;
  }

  .ext-form-body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1.15rem;
  }

  .ext-projection-box {
    background: rgba(245, 158, 11, 0.06);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 0.85rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .ext-flow-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-align: center;
  }

  .ext-point {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .ext-point-label {
    font-size: 0.7rem;
    color: #94a3b8;
    text-transform: uppercase;
    font-weight: 600;
  }

  .ext-point-val {
    font-size: 0.88rem;
    color: #f1f5f9;
  }

  .ext-point-val.emerald {
    color: #10b981;
    font-size: 0.95rem;
  }

  .ext-arrow {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: #fbbf24;
    gap: 0.1rem;
  }

  .plus-days {
    font-size: 0.68rem;
    font-weight: 800;
    color: #fbbf24;
  }

  .ext-hint-text {
    font-size: 0.75rem;
    color: #94a3b8;
    line-height: 1.4;
    margin: 0;
  }

  .ext-actions-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 0.75rem;
  }

  .btn-confirm-extension {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    border: none;
    color: #fff;
    padding: 0.6rem 1.15rem;
    border-radius: 0.6rem;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    box-shadow: 0 4px 15px rgba(245, 158, 11, 0.35);
    transition: all 0.15s ease;
  }

  .btn-confirm-extension:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(245, 158, 11, 0.45);
  }

  .btn-confirm-extension:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Global utility classes */
  .cyan { color: #06b6d4 !important; }
  .purple { color: #a855f7 !important; }
  .emerald { color: #10b981 !important; }
  .amber { color: #f59e0b !important; }
  .red { color: #ef4444 !important; }

  /* Responsive Mobile Overrides */
  @media (max-width: 768px) {
    .calendar-main-header {
      padding: 1rem;
      gap: 1rem;
      border-radius: 1rem;
    }
    .calendar-title {
      font-size: 1.15rem;
    }
    .calendar-subtitle {
      font-size: 0.78rem;
    }
    .current-month-display {
      font-size: 1rem;
      min-width: 140px;
    }
    .cell-events-list {
      display: none; /* Hide bulky pills on mobile */
    }
    .mobile-dots-strip {
      display: flex; /* Show dots on mobile */
    }
    .matrix-day-cell {
      min-height: 48px;
      padding: 0.25rem 0.2rem;
      align-items: center;
    }
    .day-cell-header {
      flex-direction: column;
      gap: 0.2rem;
      align-items: center;
      margin: 0;
    }
    .day-drawer-panel {
      max-width: 100%;
      height: 85vh;
      border-radius: 1.25rem 1.25rem 0 0;
      border-left: none;
      border-top: 1px solid rgba(139, 92, 246, 0.3);
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      animation: drawerSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes drawerSlideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
    .agenda-row-card {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }
    .agenda-actions-col {
      width: 100%;
      justify-content: flex-end;
    }
  }

  @media (max-width: 480px) {
    .calendar-controls-row {
      flex-direction: column;
      align-items: stretch;
    }
    .month-selector-group {
      justify-content: space-between;
    }
    .view-mode-toggle {
      width: 100%;
      justify-content: center;
    }
    .filters-action-strip {
      flex-direction: column;
      align-items: stretch;
    }
    .filter-group {
      justify-content: space-between;
    }
    .matrix-day-cell {
      min-height: 42px;
    }
    .day-cell-number {
      font-size: 0.75rem;
    }
    .weekday-header-cell {
      font-size: 0.68rem;
      padding: 0.5rem 0.1rem;
    }
    .modal-card-small {
      border-radius: 1rem;
      max-width: 100%;
    }
    .ext-actions-footer {
      flex-direction: column-reverse;
      gap: 0.5rem;
    }
    .btn-cancel, .btn-confirm-extension {
      width: 100%;
      justify-content: center;
    }
  }
</style>
