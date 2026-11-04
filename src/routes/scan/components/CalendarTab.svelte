<script lang="ts">
  import {
    Calendar as CalendarIcon,
    Clock,
    AlertCircle,
    CheckCircle2,
    User,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
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
    Zap,
    Grid,
    ListFilter,
    Users,
    BookOpen,
    Info
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';
  import { invalidate } from '$app/navigation';
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
  let filterStatus = $state<string>('ALL'); // ALL | IN_PROGRESS | DUE_SOON | DONE | OVERDUE | EXTENDED
  let showMobileFilterSheet = $state(false);

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

  // Quick filter helper
  function toggleMineFilter() {
    if (filterAssigneeId === 'MINE') {
      filterAssigneeId = 'ALL';
    } else {
      filterAssigneeId = 'MINE';
    }
  }

  function clearAllFilters() {
    filterStageSlug = 'ALL';
    filterAssigneeId = 'ALL';
    filterStatus = 'ALL';
  }

  let hasActiveFilters = $derived(
    filterStageSlug !== 'ALL' || filterAssigneeId !== 'ALL' || filterStatus !== 'ALL'
  );

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
    typeset: '#f59e0b',
    revisor_qc: '#a855f7',
    qc: '#a855f7',
    revisao: '#a855f7',
    pre_aprovado: '#06b6d4',
    publicado: '#10b981'
  };

  function getStageColor(slug?: string, defaultColor?: string): string {
    if (defaultColor) return defaultColor;
    if (!slug) return '#8b5cf6';
    return STAGE_COLORS[slug.toLowerCase()] || '#8b5cf6';
  }

  function getCanonicalStageName(slug?: string, defaultName?: string): string {
    const s = (slug || '').toLowerCase().trim();
    if (s === 'traducao' || s === 'translation') return 'Tradução';
    if (s === 'clean_redraw' || s === 'clean' || s === 'redraw') return 'Clean/Redraw';
    if (s === 'typeset' || s === 'typer') return 'Typeset';
    if (s === 'revisor_qc' || s === 'qc' || s === 'revisao') return 'Revisor (QC)';
    if (s === 'raw') return 'Raw Provider';
    if (s === 'pre_aprovado') return 'Pré-Aprovado';
    if (s === 'publicado') return 'Publicado';
    return defaultName || 'Etapa Editorial';
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
      if (m.user_id) map.set(m.user_id, m);
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
      const stageName = getCanonicalStageName(stageSlug, stageObj?.name);
      const stageColor = getStageColor(stageSlug, stageObj?.color);

      const workTitle = pc?.work?.title || pc?.chapter_title || 'Obra';
      const workCoverId = pc?.work?.cover_id || null;
      const chapterNumber = pc?.chapter_number || '1';
      const chapterLabel = pc?.chapter_label || null;

      const assigneeObj = cs.assignee || cs.completer || (cs.assigned_to ? teamMap.get(cs.assigned_to) : (cs.completed_by ? teamMap.get(cs.completed_by) : null));

      let dueYMD = '';
      let isOverdue = false;
      let isDueSoon = false;
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
        isDueSoon = !isOverdue && cs.status === 'IN_PROGRESS' && remainingHours <= 24;

        // Extension available within 24 hours of due date or if due date is today
        const isMine = cs.assigned_to === currentUserId;
        const extensionCount = Number(cs.extension_count || 0);
        canExtend = isMine && cs.status === 'IN_PROGRESS' && extensionCount === 0 && (remainingHours <= 24 || dueYMD === todayYMD) && diffMs > -(4 * 60 * 60 * 1000);
      } else if (cs.completed_at && cs.status === 'DONE') {
        const compSp = getSaoPauloDate(cs.completed_at);
        dueYMD = formatYMD(compSp);
      }

      // Status classification
      let statusClass = 'in-progress';
      let statusColor = '#8b5cf6';
      let statusLabel = 'Em andamento';

      if (cs.status === 'DONE') {
        statusClass = 'done';
        statusColor = '#10b981';
        statusLabel = 'Concluído';
      } else if (isOverdue) {
        statusClass = 'overdue';
        statusColor = '#ef4444';
        statusLabel = 'Em atraso';
      } else if (Number(cs.extension_count || 0) > 0) {
        statusClass = 'extended';
        statusColor = '#06b6d4';
        statusLabel = 'Prorrogado (+2d)';
      } else if (isDueSoon) {
        statusClass = 'due-soon';
        statusColor = '#f59e0b';
        statusLabel = 'Vence em breve';
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
        statusClass,
        statusColor,
        statusLabel,
        claimedAt: cs.claimed_at,
        dueAt: cs.due_at,
        dueYMD,
        originalDueAt: cs.original_due_at || cs.due_at,
        extensionCount: Number(cs.extension_count || 0),
        extendedAt: cs.extended_at,
        notes: cs.notes || '',
        completedAt: cs.completed_at,
        isOverdue,
        isDueSoon,
        remainingHours,
        canExtend
      });
    }

    // 2. Generic Scan Tasks with due_at
    for (const t of tasks) {
      if (!t.due_at && !t.completed_at) continue;
      const targetDate = t.due_at || t.completed_at;
      const dueSp = getSaoPauloDate(targetDate);
      const dueYMD = formatYMD(dueSp);
      const nowMs = Date.now();
      const dueMs = new Date(targetDate).getTime();
      const diffMs = dueMs - nowMs;
      const isOverdue = diffMs < 0 && t.status !== 'DONE' && t.status !== 'CANCELLED';
      const isDueSoon = !isOverdue && t.status !== 'DONE' && Math.round(diffMs / (1000 * 60 * 60)) <= 24;

      let statusClass = 'in-progress';
      let statusColor = '#6366f1';
      let statusLabel = 'Em andamento';

      if (t.status === 'DONE') {
        statusClass = 'done';
        statusColor = '#10b981';
        statusLabel = 'Concluído';
      } else if (isOverdue) {
        statusClass = 'overdue';
        statusColor = '#ef4444';
        statusLabel = 'Em atraso';
      } else if (isDueSoon) {
        statusClass = 'due-soon';
        statusColor = '#f59e0b';
        statusLabel = 'Vence em breve';
      }

      list.push({
        id: t.id,
        kind: 'SCAN_TASK',
        stageSlug: 'tarefa',
        stageName: 'Tarefa Geral',
        stageColor: '#6366f1',
        workTitle: t.title || 'Tarefa Geral',
        workCoverId: null,
        chapterNumber: null,
        chapterLabel: null,
        assignee: t.assigned_to ? teamMap.get(t.assigned_to) : null,
        assignedTo: t.assigned_to,
        status: t.status,
        statusClass,
        statusColor,
        statusLabel,
        claimedAt: t.created_at,
        dueAt: t.due_at,
        dueYMD,
        originalDueAt: t.original_due_at || t.due_at,
        extensionCount: Number(t.extension_count || 0),
        extendedAt: t.extended_at,
        notes: t.description || '',
        completedAt: t.completed_at,
        isOverdue,
        isDueSoon,
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
      } else if (filterStatus === 'DUE_SOON') {
        if (!item.isDueSoon) return false;
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

  // Calendar Month Matrix Generation (4, 5, or 6 weeks dynamic)
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
      uniqueAssignees: any[];
      publications: any[];
      overdueCount: number;
      doneCount: number;
      inProgressCount: number;
      extendedCount: number;
    }> = [];

    // Helper to extract unique assignees for cell avatar stack
    function getUniqueAssignees(coms: any[]): any[] {
      const seen = new Set<string>();
      const list: any[] = [];
      for (const c of coms) {
        if (c.assignee && c.assignee.id && !seen.has(c.assignee.id)) {
          seen.add(c.assignee.id);
          list.push(c.assignee);
        }
      }
      return list;
    }

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
        uniqueAssignees: getUniqueAssignees(coms),
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
        uniqueAssignees: getUniqueAssignees(coms),
        publications: pubs,
        overdueCount: coms.filter((c) => c.isOverdue).length,
        doneCount: coms.filter((c) => c.status === 'DONE').length,
        inProgressCount: coms.filter((c) => c.status === 'IN_PROGRESS' && !c.isOverdue).length,
        extendedCount: coms.filter((c) => c.extensionCount > 0).length
      });
    }

    // Trailing days from next month to complete the row
    const remainder = cells.length % 7;
    if (remainder > 0) {
      const trailingCount = 7 - remainder;
      for (let day = 1; day <= trailingCount; day++) {
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
          uniqueAssignees: getUniqueAssignees(coms),
          publications: pubs,
          overdueCount: coms.filter((c) => c.isOverdue).length,
          doneCount: coms.filter((c) => c.status === 'DONE').length,
          inProgressCount: coms.filter((c) => c.status === 'IN_PROGRESS' && !c.isOverdue).length,
          extendedCount: coms.filter((c) => c.extensionCount > 0).length
        });
      }
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
    const formatted = dateObj.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  });

  // Upcoming items for current user (Minhas Próximas Entregas)
  let myUpcomingDeliveries = $derived.by(() => {
    return allCommitments
      .filter((c) => c.assignedTo === currentUserId && c.status === 'IN_PROGRESS' && c.dueAt)
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
      .slice(0, 6);
  });

  // Primary personal delivery (Hero item) and secondary list
  let primaryMyDelivery = $derived(myUpcomingDeliveries[0] || null);
  let otherMyDeliveries = $derived(myUpcomingDeliveries.slice(1));

  // Overdue items across scan
  let overdueDeliveries = $derived.by(() => {
    return allCommitments
      .filter((c) => c.isOverdue)
      .sort((a, b) => (new Date(a.dueAt || 0).getTime()) - (new Date(b.dueAt || 0).getTime()))
      .slice(0, 5);
  });

  // Upcoming items across team (excluding current user's primary delivery to avoid duplication)
  let teamUpcomingDeliveries = $derived.by(() => {
    return allCommitments
      .filter((c) => c.status === 'IN_PROGRESS' && c.dueAt && c.id !== primaryMyDelivery?.id)
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
      .slice(0, 6);
  });

  // Remaining time helper text
  function getRemainingText(item: any): string {
    if (!item?.dueAt) return '';
    const nowMs = Date.now();
    const dueMs = new Date(item.dueAt).getTime();
    const diffMs = dueMs - nowMs;
    const hours = Math.round(diffMs / (1000 * 60 * 60));
    if (diffMs < 0) return 'Prazo vencido';
    if (hours <= 2) return 'Vence em < 2h!';
    if (hours <= 24) return `Vence em ${hours}h`;
    const days = Math.ceil(hours / 24);
    if (days === 1) return 'Vence amanhã';
    return `Vence em ${days} dias`;
  }

  // Format due date for clean display
  function formatDueDisplay(dueAt?: string): string {
    if (!dueAt) return '--';
    const sp = getSaoPauloDate(dueAt);
    const day = String(sp.getDate()).padStart(2, '0');
    const month = String(sp.getMonth() + 1).padStart(2, '0');
    return `${day}/${month} às 23:59`;
  }

  // Format completed date for clean display
  function formatCompletedDisplay(completedAt?: string): string {
    if (!completedAt) return 'Concluído';
    const sp = getSaoPauloDate(completedAt);
    const day = String(sp.getDate()).padStart(2, '0');
    const month = String(sp.getMonth() + 1).padStart(2, '0');
    return `Concluído em ${day}/${month}`;
  }

  // Recent Publications across scan (Últimas Publicações)
  let recentPublications = $derived.by(() => {
    return (chapters || [])
      .filter((c: any) => c.published_at || c.created_at)
      .sort((a: any, b: any) => new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime())
      .slice(0, 5);
  });

  // Active Filter Badges for quick removal and mobile sheets
  let activeFilterChips = $derived.by(() => {
    const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];
    if (filterStageSlug !== 'ALL') {
      const stageName = filterStageSlug === 'tarefa' ? 'Tarefas Gerais' : getCanonicalStageName(filterStageSlug);
      chips.push({
        id: 'stage',
        label: `Etapa: ${stageName}`,
        onRemove: () => { filterStageSlug = 'ALL'; }
      });
    }
    if (filterAssigneeId === 'MINE') {
      chips.push({
        id: 'assignee_mine',
        label: 'Apenas minhas entregas',
        onRemove: () => { filterAssigneeId = 'ALL'; }
      });
    } else if (filterAssigneeId !== 'ALL') {
      const m = teamMap.get(filterAssigneeId);
      const name = m?.display_name || m?.username || 'Membro';
      chips.push({
        id: 'assignee',
        label: `Responsável: ${name}`,
        onRemove: () => { filterAssigneeId = 'ALL'; }
      });
    }
    if (filterStatus !== 'ALL') {
      const statusLabels: Record<string, string> = {
        IN_PROGRESS: 'Em andamento',
        DUE_SOON: 'Vence em breve',
        DONE: 'Concluídos',
        OVERDUE: 'Em atraso',
        EXTENDED: 'Prorrogados (+2d)'
      };
      chips.push({
        id: 'status',
        label: `Situação: ${statusLabels[filterStatus] || filterStatus}`,
        onRemove: () => { filterStatus = 'ALL'; }
      });
    }
    return chips;
  });

  // Handler for Day Cell Click
  function handleSelectDay(ymd: string) {
    selectedDateYMD = ymd;
    showDayDrawer = true;
  }

  // Notes editing helpers
  function startEditingNote(item: any) {
    editingNoteId = item.id;
    noteTextDraft = item.notes || '';
  }

  function cancelEditingNote() {
    editingNoteId = null;
    noteTextDraft = '';
  }

  // Extension Modal Handlers
  function openExtensionModal(item: any) {
    extensionTargetItem = item;
    extensionFeedback = null;
    showExtensionModal = true;
  }

  function closeExtensionModal() {
    showExtensionModal = false;
    extensionTargetItem = null;
    extensionFeedback = null;
    isExtending = false;
  }
</script>

<div class="scan-calendar-hub">
  <!-- 1. COMPACT PREMIUM HEADER -->
  <header class="calendar-top-header">
    <div class="header-branding-block">
      <div class="calendar-icon-orb">
        <CalendarIcon size={20} />
      </div>
      <div class="branding-text">
        <h1 class="calendar-title">Calendário da Scan</h1>
        <p class="calendar-subtitle">Acompanhe os prazos e compromissos editoriais da equipe.</p>
      </div>
    </div>

    <!-- Month Navigation Lockup (Compact & Central) -->
    <div class="month-nav-cluster">
      <div class="nav-btn-group">
        <button
          type="button"
          class="btn-month-nav"
          onclick={prevMonth}
          aria-label="Mês anterior"
          title="Mês anterior"
        >
          <ChevronLeft size={16} />
        </button>

        <span class="current-month-display">
          {MONTH_NAMES[currentMonth]} <span class="year-num">{currentYear}</span>
        </span>

        <button
          type="button"
          class="btn-month-nav"
          onclick={nextMonth}
          aria-label="Próximo mês"
          title="Próximo mês"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <button
        type="button"
        class="btn-today-pill"
        onclick={goToToday}
        title="Voltar para a data de hoje"
      >
        Hoje
      </button>

      <!-- View Mode Switch: Month Grid vs Agenda List -->
      <div class="view-toggle-segmented" role="radiogroup" aria-label="Visualização">
        <button
          type="button"
          class="toggle-opt-btn"
          class:active={activeViewMode === 'MONTH'}
          onclick={() => (activeViewMode = 'MONTH')}
          title="Visão Mensal"
        >
          <Grid size={14} />
          <span class="desktop-only-txt">Mês</span>
        </button>
        <button
          type="button"
          class="toggle-opt-btn"
          class:active={activeViewMode === 'AGENDA'}
          onclick={() => (activeViewMode = 'AGENDA')}
          title="Visão Agenda / Lista"
        >
          <Layers size={14} />
          <span class="desktop-only-txt">Agenda</span>
        </button>
      </div>
    </div>
  </header>

  <!-- 2. STREAMLINED HORIZONTAL FILTER BAR (Desktop & Mobile Chips) -->
  <section class="calendar-filters-bar" aria-label="Filtros do Calendário">
    <!-- Desktop Filter Controls (>= 768px) -->
    <div class="filters-left-group desktop-only-filters">
      <!-- Quick Filter: Minhas Entregas -->
      <button
        type="button"
        class="chip-filter-btn"
        class:is-active={filterAssigneeId === 'MINE'}
        onclick={toggleMineFilter}
      >
        <User size={13} />
        <span>Minhas entregas</span>
      </button>

      <!-- Stage Filter -->
      <div class="filter-select-wrapper">
        <select
          bind:value={filterStageSlug}
          class="filter-native-select"
          aria-label="Filtrar por etapa"
        >
          <option value="ALL">Todas as etapas</option>
          <option value="traducao">Tradução</option>
          <option value="clean_redraw">Clean/Redraw</option>
          <option value="typeset">Typeset</option>
          <option value="revisor_qc">Revisor (QC)</option>
          <option value="tarefa">Tarefas gerais</option>
        </select>
      </div>

      <!-- Assignee Filter -->
      <div class="filter-select-wrapper">
        <select
          bind:value={filterAssigneeId}
          class="filter-native-select"
          aria-label="Filtrar por responsável"
        >
          <option value="ALL">Toda a equipe</option>
          <option value="MINE">Apenas minhas entregas</option>
          {#each team as member}
            <option value={member.id}>{member.display_name || member.username}</option>
          {/each}
        </select>
      </div>

      <!-- Status Filter -->
      <div class="filter-select-wrapper">
        <select
          bind:value={filterStatus}
          class="filter-native-select"
          aria-label="Filtrar por situação"
        >
          <option value="ALL">Todas as situações</option>
          <option value="IN_PROGRESS">Em andamento</option>
          <option value="DUE_SOON">Próximo do vencimento (&le;24h)</option>
          <option value="DONE">Concluídos</option>
          <option value="OVERDUE">Em atraso</option>
          <option value="EXTENDED">Prorrogados (+2d)</option>
        </select>
      </div>

      {#if hasActiveFilters}
        <button
          type="button"
          class="btn-clear-filters"
          onclick={clearAllFilters}
          title="Limpar todos os filtros"
        >
          <X size={13} />
          <span>Limpar</span>
        </button>
      {/if}
    </div>

    <!-- Mobile Filter Controls (< 768px) -->
    <div class="mobile-filter-controls">
      <div class="mobile-filters-top-strip">
        <button
          type="button"
          class="chip-filter-btn"
          class:is-active={filterAssigneeId === 'MINE'}
          onclick={toggleMineFilter}
        >
          <User size={13} />
          <span>Minhas</span>
        </button>

        <button
          type="button"
          class="btn-open-filter-sheet"
          class:has-filters={activeFilterChips.length > 0}
          onclick={() => (showMobileFilterSheet = true)}
          aria-label="Abrir painel de filtros"
        >
          <Sliders size={13} />
          <span>Filtros</span>
          {#if activeFilterChips.length > 0}
            <span class="sheet-count-pip">{activeFilterChips.length}</span>
          {/if}
        </button>

        {#if hasActiveFilters}
          <button
            type="button"
            class="btn-clear-mobile-quick"
            onclick={clearAllFilters}
            title="Limpar filtros"
          >
            <X size={12} />
            <span>Limpar</span>
          </button>
        {/if}

        <span class="mobile-stat-count">
          <strong>{filteredCommitments.length}</strong> {filteredCommitments.length === 1 ? 'item' : 'itens'}
        </span>
      </div>

      {#if activeFilterChips.length > 0}
        <div class="mobile-active-chips-scroll">
          {#each activeFilterChips as chip}
            <button
              type="button"
              class="active-chip-pill"
              onclick={chip.onRemove}
              title="Remover filtro"
            >
              <span>{chip.label}</span>
              <X size={10} />
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Active Count Counter (Desktop) -->
    <div class="filters-right-meta desktop-only-filters">
      <span class="commitments-stat-pill">
        <strong>{filteredCommitments.length}</strong> compromisso{filteredCommitments.length === 1 ? '' : 's'}
      </span>
    </div>
  </section>

  <!-- 3. MAIN WORKSPACE SPLIT LAYOUT -->
  <div class="calendar-workspace-layout">
    <!-- LEFT / MAIN: MONTH GRID OR AGENDA VIEW -->
    <main class="calendar-primary-container">
      {#if activeViewMode === 'MONTH'}
        <div class="calendar-monthly-card">
          <!-- Weekday Headers -->
          <div class="weekday-labels-row">
            {#each WEEK_DAYS as wd, idx}
              <div class="weekday-label-cell" class:weekend={idx === 0 || idx === 6}>
                <span>{wd}</span>
              </div>
            {/each}
          </div>

          <!-- 7-Column Days Grid -->
          <div class="monthly-days-grid">
            {#each monthGridCells as cell}
              <button
                type="button"
                class="matrix-day-cell"
                class:is-other-month={!cell.isCurrentMonth}
                class:is-today={cell.isToday}
                class:is-selected={cell.isSelected}
                class:has-deliveries={cell.commitments.length > 0}
                onclick={() => handleSelectDay(cell.ymd)}
              >
                <!-- Day Cell Header: Number + "Hoje" Badge -->
                <div class="cell-top-bar">
                  <span class="cell-day-num">{cell.dayNumber}</span>
                  {#if cell.isToday}
                    <span class="cell-today-pill">Hoje</span>
                  {/if}
                </div>

                <!-- DESKTOP EVENT CARDS (Real Avatars + Member Name + Stage + Chapter) -->
                <div class="desktop-events-stack">
                  {#each cell.commitments.slice(0, 2) as item}
                    <div
                      class="day-event-card {item.statusClass}"
                      style="--stage-accent: {item.stageColor}"
                      title="{item.workTitle} #{item.chapterNumber} • {item.stageName} • {item.assignee?.display_name || item.assignee?.username || 'Membro'}"
                    >
                      <div class="event-card-top-row">
                        <div class="event-card-avatar-wrap">
                          <UserAvatar user={item.assignee} size={18} />
                        </div>
                        <span class="event-card-user-name">
                          {item.assignee?.display_name || item.assignee?.username || 'Membro'}
                        </span>
                        {#if item.extensionCount > 0 && item.status !== 'DONE'}
                          <span class="event-card-ext-badge">+2d</span>
                        {/if}
                        {#if item.status === 'DONE'}
                          <Check size={11} class="event-card-done-ico" />
                        {/if}
                      </div>

                      <div class="event-card-bottom-row">
                        <span class="event-card-stage-pill">{item.stageName}</span>
                        <span class="event-card-work-line">{item.workTitle} #{item.chapterNumber}</span>
                      </div>
                    </div>
                  {/each}

                  <!-- Overflow indicator if > 2 items -->
                  {#if cell.commitments.length > 2}
                    <div class="event-overflow-badge" onclick={(e) => { e.stopPropagation(); handleSelectDay(cell.ymd); }}>
                      <span>+{cell.commitments.length - 2} entregas</span>
                    </div>
                  {/if}

                  <!-- Publication pill (if chapter was published on this day) -->
                  {#each cell.publications.slice(0, 1) as pub}
                    <div class="publication-badge-pill" title="Publicado: {pub.works?.title || 'Obra'} #{pub.number}">
                      <Sparkles size={10} />
                      <span>Pub. #{pub.number}</span>
                    </div>
                  {/each}
                </div>

                <!-- ANDROID / MOBILE CELL CONTENT: CLEAN UNCLUTTERED DENSITY -->
                <div class="mobile-day-cell-content">
                  {#if cell.uniqueAssignees.length > 0}
                    <div class="mobile-avatar-lockup">
                      <div class="mobile-cell-avatar">
                        <UserAvatar user={cell.uniqueAssignees[0]} size={22} />
                      </div>
                      {#if cell.commitments.length > 1}
                        <span class="mobile-overflow-count">+{cell.commitments.length - 1}</span>
                      {/if}
                    </div>
                  {/if}

                  {#if cell.commitments.length > 0}
                    <div class="mobile-status-dot-wrap">
                      <span class="mobile-status-dot {cell.commitments[0]?.statusClass}"></span>
                    </div>
                  {/if}
                </div>
              </button>
            {/each}
          </div>

          <!-- ANDROID / MOBILE: NÍVEL 1 — RESUMO RÁPIDO DO DIA SELECIONADO -->
          <div class="mobile-day-preview-strip">
            <div class="preview-strip-header">
              <div class="preview-header-left">
                <CalendarIcon size={14} class="text-purple-400" />
                <div class="preview-title-col">
                  <span class="preview-day-title">Compromissos do dia ({selectedDayCommitments.length})</span>
                  <span class="preview-date-sub">{formattedSelectedDayHeader}</span>
                </div>
              </div>
              {#if selectedDayCommitments.length > 0}
                <button
                  type="button"
                  class="btn-view-drawer-trigger"
                  onclick={() => (showDayDrawer = true)}
                >
                  <span>Ver detalhes</span>
                  <ArrowRight size={12} />
                </button>
              {/if}
            </div>

            {#if selectedDayCommitments.length === 0}
              <div class="preview-empty-note">
                <span>Nenhum compromisso agendado para esta data. Toque em um dia no calendário para ver as entregas.</span>
              </div>
            {:else}
              <div class="preview-items-row">
                {#each selectedDayCommitments as item}
                  <div
                    class="preview-mini-card {item.statusClass}"
                    onclick={() => (showDayDrawer = true)}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) => { if (e.key === 'Enter') showDayDrawer = true; }}
                  >
                    <div class="preview-card-avatar">
                      <UserAvatar user={item.assignee} size={28} />
                    </div>
                    <div class="preview-card-text">
                      <div class="preview-work-line">
                        <strong class="preview-work-name">{item.workTitle}</strong>
                        {#if item.chapterNumber}
                          <span class="preview-chapter-badge">#{item.chapterNumber}</span>
                        {/if}
                        <span class="preview-stage-tag" style="--st-c: {item.stageColor}">{item.stageName}</span>
                      </div>
                      <div class="preview-meta-line">
                        <span class="preview-assignee-text">{item.assignee?.display_name || item.assignee?.username || 'Membro'}</span>
                        <span class="preview-sep">•</span>
                        <span class="preview-status-pill {item.statusClass}">{item.statusLabel}</span>
                        <span class="preview-sep">•</span>
                        <span class="preview-due-text">
                          {item.status === 'DONE' ? (item.completedAt ? formatCompletedDisplay(item.completedAt) : 'Concluído') : formatDueDisplay(item.dueAt)}
                        </span>
                      </div>
                    </div>
                    <div class="preview-card-chevron">
                      <ArrowRight size={13} />
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {:else}
        <!-- AGENDA / CHRONOLOGICAL VIEW -->
        <div class="agenda-view-wrapper">
          <div class="agenda-header-strip">
            <div class="agenda-header-left">
              <Layers size={17} class="text-cyan-400" />
              <h2 class="agenda-heading">Próximos Compromissos em Ordem Cronológica</h2>
            </div>
            <span class="agenda-count-badge">{filteredCommitments.length} entregas</span>
          </div>

          {#if filteredCommitments.length === 0}
            <div class="agenda-empty-state">
              <CheckCircle2 size={36} class="text-emerald-400" />
              <p>Nenhuma entrega encontrada para os filtros selecionados.</p>
            </div>
          {:else}
            <div class="agenda-list-stack">
              {#each filteredCommitments as item}
                <article
                  class="agenda-item-card {item.statusClass}"
                  onclick={() => handleSelectDay(item.dueYMD || todayYMD)}
                >
                  <div class="agenda-date-block">
                    <span class="agenda-date-day">{item.dueYMD ? item.dueYMD.split('-')[2] : '--'}</span>
                    <span class="agenda-date-month">
                      {item.dueYMD ? MONTH_NAMES[Number(item.dueYMD.split('-')[1]) - 1].slice(0, 3) : ''}
                    </span>
                  </div>

                  <div class="agenda-item-body">
                    <div class="agenda-work-head">
                      <span class="agenda-work-title">{item.workTitle}</span>
                      {#if item.chapterNumber}
                        <span class="agenda-chapter-badge">Cap. #{item.chapterNumber}</span>
                      {/if}
                      <span class="agenda-stage-badge" style="--st-c: {item.stageColor}">
                        <span class="st-dot"></span>
                        {item.stageName}
                      </span>
                    </div>

                    <div class="agenda-meta-row">
                      {#if item.assignee}
                        <div class="agenda-user-lockup">
                          <UserAvatar user={item.assignee} size={18} />
                          <span class="agenda-username">{item.assignee.display_name || item.assignee.username}</span>
                        </div>
                      {/if}

                      <span class="agenda-status-pill {item.statusClass}">
                        {item.statusLabel}
                      </span>

                      {#if item.extensionCount > 0}
                        <span class="agenda-ext-pill">Prorrogado (+2d)</span>
                      {/if}
                    </div>

                    {#if item.notes}
                      <p class="agenda-note-excerpt">"{item.notes}"</p>
                    {/if}
                  </div>

                  <div class="agenda-action-cell">
                    {#if item.canExtend}
                      <button
                        type="button"
                        class="btn-agenda-extend"
                        onclick={(e) => {
                          e.stopPropagation();
                          openExtensionModal(item);
                        }}
                        title="Prorrogar prazo +2 dias sem necessidade de aprovação"
                      >
                        <Zap size={13} />
                        <span>+2 dias</span>
                      </button>
                    {/if}

                    <span class="agenda-arrow-icon">
                      <ArrowRight size={14} />
                    </span>
                  </div>
                </article>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </main>

    <!-- RIGHT: COMPLEMENTARY SIDE PANELS (Desktop) -->
    <aside class="calendar-side-column">
      <!-- NÍVEL 3 — BLOCO PRINCIPAL: Minha Próxima Entrega -->
      <section class="side-widget-card hero-my-delivery-card">
        <header class="widget-header">
          <Clock size={15} class="text-cyan-400" />
          <h3 class="widget-title">Minha Próxima Entrega</h3>
        </header>

        {#if primaryMyDelivery}
          <div class="hero-delivery-box">
            <div class="hero-delivery-top">
              <div class="hero-cover-wrap">
                {#if primaryMyDelivery.workCoverId}
                  <img src="/media/{primaryMyDelivery.workCoverId}" alt={primaryMyDelivery.workTitle} class="hero-cover-img" />
                {:else}
                  <div class="hero-cover-fallback"><Briefcase size={14} /></div>
                {/if}
              </div>
              <div class="hero-delivery-meta">
                <span class="hero-delivery-title" title="{primaryMyDelivery.workTitle} #{primaryMyDelivery.chapterNumber}">
                  {primaryMyDelivery.workTitle} #{primaryMyDelivery.chapterNumber}
                </span>
                <div class="hero-delivery-badges">
                  <span class="delivery-stage-tag" style="--st-c: {primaryMyDelivery.stageColor}">
                    {primaryMyDelivery.stageName}
                  </span>
                  <span class="countdown-pill {primaryMyDelivery.statusClass}">
                    {getRemainingText(primaryMyDelivery)}
                  </span>
                </div>
              </div>
            </div>

            <!-- Prazo e Estado da Prorrogação -->
            <div class="hero-deadline-strip">
              <span class="hero-due-label">Prazo:</span>
              <strong class="hero-due-val">{formatDueDisplay(primaryMyDelivery.dueAt)}</strong>
            </div>

            <!-- Ação de Prorrogação Contextual -->
            {#if primaryMyDelivery.kind === 'EDITORIAL_STAGE'}
              {#if primaryMyDelivery.canExtend}
                <button
                  type="button"
                  class="btn-prominent-extend"
                  onclick={() => openExtensionModal(primaryMyDelivery)}
                  title="Prorrogar prazo em +2 dias sem necessidade de aprovação"
                >
                  <Zap size={14} />
                  <span>Prorrogar +2 dias</span>
                </button>
              {:else if primaryMyDelivery.remainingHours > 24 && primaryMyDelivery.extensionCount === 0}
                <div class="extension-hero-info">
                  <Info size={12} class="text-cyan-400" />
                  <span>Prorrogação de +2 dias disponível nas últimas 24h do prazo.</span>
                </div>
              {:else if primaryMyDelivery.extensionCount > 0}
                <div class="extension-hero-extended">
                  <Check size={12} class="text-emerald-400" />
                  <span>Prazo prorrogado (+2d aplicados)</span>
                </div>
              {/if}
            {/if}

            <button
              type="button"
              class="btn-hero-focus-day"
              onclick={() => handleSelectDay(primaryMyDelivery.dueYMD)}
            >
              <span>Ver detalhes na data</span>
              <ArrowRight size={12} />
            </button>
          </div>

          <!-- Outras entregas pessoais compactas -->
          {#if otherMyDeliveries.length > 0}
            <div class="other-personal-block">
              <span class="other-personal-heading">Outras entregas ({otherMyDeliveries.length})</span>
              <div class="other-personal-stack">
                {#each otherMyDeliveries as item}
                  <div
                    class="other-personal-row"
                    onclick={() => handleSelectDay(item.dueYMD)}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) => { if (e.key === 'Enter') handleSelectDay(item.dueYMD); }}
                  >
                    <div class="other-row-info">
                      <span class="other-row-title">{item.workTitle} #{item.chapterNumber}</span>
                      <span class="delivery-stage-tag" style="--st-c: {item.stageColor}">{item.stageName}</span>
                    </div>
                    <div class="other-row-due">
                      <span class="other-due-text">{item.dueYMD.split('-')[2]}/{item.dueYMD.split('-')[1]}</span>
                      {#if item.canExtend}
                        <button
                          type="button"
                          class="btn-widget-extend"
                          onclick={(e) => { e.stopPropagation(); openExtensionModal(item); }}
                          title="Prorrogar +2 dias"
                        >
                          <Zap size={11} />
                        </button>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {:else}
          <div class="widget-empty-box">
            <CheckCircle2 size={20} class="text-emerald-400" />
            <p>Você não possui entregas pendentes.</p>
          </div>
        {/if}
      </section>

      <!-- NÍVEL 3 — BLOCO SECUNDÁRIO: Compromissos da Equipe -->
      <section class="side-widget-card">
        <header class="widget-header">
          <div class="widget-header-title-wrap">
            <Users size={15} class="text-indigo-400" />
            <h3 class="widget-title">Compromissos da Equipe ({teamUpcomingDeliveries.length})</h3>
          </div>
          {#if overdueDeliveries.length > 0}
            <span class="team-alert-pill" title="Entregas em atraso na scan">
              ⚠️ {overdueDeliveries.length} em atraso
            </span>
          {/if}
        </header>

        {#if teamUpcomingDeliveries.length === 0}
          <div class="widget-empty-box">
            <CheckCircle2 size={20} class="text-emerald-400" />
            <p>Nenhuma entrega pendente na equipe.</p>
          </div>
        {:else}
          <div class="widget-items-stack">
            {#each teamUpcomingDeliveries as item}
              <div
                class="widget-delivery-item"
                class:is-overdue={item.isOverdue}
                onclick={() => handleSelectDay(item.dueYMD)}
                role="button"
                tabindex="0"
                onkeydown={(e) => { if (e.key === 'Enter') handleSelectDay(item.dueYMD); }}
              >
                <div class="delivery-item-left">
                  <div class="delivery-header-line">
                    <span class="delivery-work-title">{item.workTitle} #{item.chapterNumber}</span>
                    <span class="delivery-status-pill {item.statusClass}">{item.statusLabel}</span>
                  </div>
                  <div class="delivery-tags-row">
                    <div class="delivery-assignee-chip" title="{item.assignee?.display_name || item.assignee?.username || 'Membro'}">
                      <UserAvatar user={item.assignee} size={15} />
                      <span>{item.assignee?.display_name || item.assignee?.username || 'Membro'}</span>
                    </div>
                    <span class="delivery-stage-tag" style="--st-c: {item.stageColor}">{item.stageName}</span>
                    <span class="delivery-due-tag">
                      Prazo: {item.dueYMD.split('-')[2]}/{item.dueYMD.split('-')[1]}
                    </span>
                  </div>
                </div>

                <div class="delivery-item-right">
                  <span class="widget-arrow"><ArrowRight size={13} /></span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>

      <!-- INFORMAÇÕES ADICIONAIS: Seção Recolhível (Equipe & Publicações) -->
      <details class="side-collapsible-card">
        <summary class="side-collapsible-summary">
          <div class="summary-left">
            <Layers size={14} class="text-purple-400" />
            <span>Equipe & Publicações</span>
          </div>
          <ChevronDown size={14} class="collapsible-chevron-icon" />
        </summary>

        <div class="side-collapsible-content">
          <!-- Sub-bloco 1: Disponibilidade dos Membros -->
          <div class="collapsible-sub-section">
            <span class="sub-section-title">Disponibilidade ({team.length})</span>
            <div class="team-avail-grid">
              {#each team.slice(0, 6) as member}
                <div class="team-avail-row">
                  <div class="member-lockup">
                    <UserAvatar user={member} size={16} />
                    <span class="member-name">{member.display_name || member.username}</span>
                  </div>
                  <span class="avail-badge {member.availability_status?.toLowerCase() || 'active'}">
                    {member.availability_status === 'BUSY' ? 'Ocupado' :
                     member.availability_status === 'AWAY' ? 'Ausente' :
                     member.availability_status === 'HIATUS' ? 'Hiato' : 'Disponível'}
                  </span>
                </div>
              {/each}
            </div>
          </div>

          <!-- Sub-bloco 2: Últimas Publicações -->
          <div class="collapsible-sub-section">
            <span class="sub-section-title">Últimas Publicações ({recentPublications.length})</span>
            {#if recentPublications.length === 0}
              <p class="sub-empty-text">Nenhuma publicação recente.</p>
            {:else}
              <div class="collapsible-pubs-stack">
                {#each recentPublications.slice(0, 3) as pub}
                  <div class="pub-mini-row">
                    <div class="pub-mini-left">
                      <span class="pub-mini-title">{pub.works?.title || 'Obra'} #{pub.number}</span>
                    </div>
                    <a
                      href="/ler/{pub.id}"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn-pub-mini-read"
                      title="Ler capítulo publicado"
                    >
                      <span>Ler</span>
                      <ArrowRight size={10} />
                    </a>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </details>
    </aside>
  </div>
</div>

<!-- ========================================================================= -->
<!-- 4. DAY DETAILS DRAWER / BOTTOM SHEET (Desktop Drawer & Android Sheet)     -->
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
        <div class="drawer-header-left">
          <span class="drawer-header-eyebrow">Compromissos e Entregas</span>
          <h3 class="drawer-date-title">{formattedSelectedDayHeader}</h3>
        </div>
        <button
          type="button"
          class="btn-close-drawer"
          onclick={() => (showDayDrawer = false)}
          aria-label="Fechar gaveta"
        >
          <X size={18} />
        </button>
      </header>

      <!-- Drawer Content -->
      <div class="drawer-scroll-body">
        <!-- Commitments Section (Fixed semantic title to 'Compromissos do dia') -->
        <section class="drawer-section">
          <div class="section-title-strip">
            <Clock size={15} class="text-cyan-400" />
            <h4 class="section-heading">Compromissos do dia ({selectedDayCommitments.length})</h4>
          </div>

          {#if selectedDayCommitments.length === 0}
            <div class="drawer-empty-placeholder">
              <CheckCircle2 size={30} class="text-emerald-400" />
              <p>Nenhum compromisso agendado para esta data.</p>
            </div>
          {:else}
            <div class="drawer-cards-stack">
              {#each selectedDayCommitments as item}
                <article class="drawer-commitment-card {item.statusClass}">
                  <!-- Card Header: Cover + Work + Stage + Status -->
                  <div class="card-hero-row">
                    <div class="work-cover-thumb-box">
                      {#if item.workCoverId}
                        <img
                          src="/media/{item.workCoverId}"
                          alt={item.workTitle}
                          class="work-cover-img"
                          loading="lazy"
                        />
                      {:else}
                        <div class="work-cover-img fallback">
                          <Briefcase size={16} />
                        </div>
                      {/if}
                    </div>

                    <div class="hero-text-col">
                      <span class="hero-work-title">{item.workTitle}</span>
                      <div class="hero-pills-row">
                        {#if item.chapterNumber}
                          <span class="hero-chapter-pill">Capítulo #{item.chapterNumber}</span>
                        {/if}
                        <span class="hero-stage-pill" style="--st-c: {item.stageColor}">
                          <span class="st-dot"></span>
                          {item.stageName}
                        </span>
                      </div>
                    </div>

                    <!-- Status Pill -->
                    <div class="hero-status-box">
                      <span class="hero-status-tag {item.statusClass}">
                        {#if item.status === 'DONE'}
                          <Check size={11} />
                        {:else if item.isOverdue}
                          <AlertTriangle size={11} />
                        {:else}
                          <Clock size={11} />
                        {/if}
                        {item.statusLabel}
                      </span>
                    </div>
                  </div>

                  <!-- Assignee + Due Date Details (Correct semantic dates) -->
                  <div class="card-details-grid">
                    <div class="detail-cell">
                      <span class="detail-label">Responsável:</span>
                      <div class="detail-user-pill">
                        <UserAvatar user={item.assignee} size={20} />
                        <span class="detail-user-name">
                          {item.assignee?.display_name || item.assignee?.username || 'Membro da equipe'}
                        </span>
                      </div>
                    </div>

                    <div class="detail-cell">
                      {#if item.status === 'DONE'}
                        <span class="detail-label">Data de conclusão:</span>
                        <strong class="detail-due-val text-emerald-400">
                          {item.completedAt ? formatCompletedDisplay(item.completedAt) : 'Concluído'}
                        </strong>
                      {:else}
                        <span class="detail-label">Prazo vigente:</span>
                        <strong class="detail-due-val text-cyan-400">
                          {item.dueYMD ? `${item.dueYMD.split('-')[2]}/${item.dueYMD.split('-')[1]}/${item.dueYMD.split('-')[0]}` : '--'} às 23:59
                        </strong>
                      {/if}
                    </div>

                    {#if item.originalDueAt && item.extensionCount > 0}
                      <div class="detail-cell">
                        <span class="detail-label">Prazo original:</span>
                        <span class="detail-orig-due">
                          {formatYMD(getSaoPauloDate(item.originalDueAt)).split('-')[2]}/{formatYMD(getSaoPauloDate(item.originalDueAt)).split('-')[1]}
                        </span>
                      </div>
                    {/if}
                  </div>

                  <!-- Notes & Inline Note Editing -->
                  <div class="notes-block">
                    <div class="notes-header-row">
                      <span class="notes-label-text">
                        <FileText size={12} />
                        <span>Observações do Responsável:</span>
                      </span>
                      {#if (item.assignedTo === currentUserId || ['OWNER', 'ADMIN'].includes(userRole)) && editingNoteId !== item.id}
                        <button
                          type="button"
                          class="btn-edit-note-trigger"
                          onclick={() => startEditingNote(item)}
                        >
                          <Edit3 size={11} />
                          <span>{item.notes ? 'Editar nota' : 'Adicionar nota'}</span>
                        </button>
                      {/if}
                    </div>

                    {#if editingNoteId === item.id}
                      <!-- Form to edit note with YSQL persistence -->
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
                              invalidate('scan:workspace');
                            }
                          };
                        }}
                        class="note-editor-form"
                      >
                        <input type="hidden" name="chapter_stage_id" value={item.id} />
                        <textarea
                          name="notes"
                          bind:value={noteTextDraft}
                          maxlength="500"
                          rows="2"
                          class="note-editor-textarea"
                          placeholder="Digite anotações sobre o andamento..."
                        ></textarea>
                        <div class="note-editor-buttons">
                          <button
                            type="button"
                            class="btn-note-cancel"
                            onclick={cancelEditingNote}
                            disabled={isSavingNote}
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            class="btn-note-save"
                            disabled={isSavingNote}
                          >
                            {#if isSavingNote}
                              <span>Salvando...</span>
                            {:else}
                              <Check size={12} />
                              <span>Salvar nota</span>
                            {/if}
                          </button>
                        </div>
                      </form>
                    {:else}
                      <p class="notes-body-text" class:is-empty={!item.notes}>
                        {item.notes ? `"${item.notes}"` : 'Nenhuma observação registrada.'}
                      </p>
                    {/if}
                  </div>

                  <!-- Actions: Extend +2 days / Open in Production -->
                  <div class="card-actions-bar">
                    {#if item.kind === 'EDITORIAL_STAGE'}
                      {#if item.canExtend}
                        <button
                          type="button"
                          class="btn-extend-action"
                          onclick={() => openExtensionModal(item)}
                          title="Prorrogar prazo +2 dias sem aprovação"
                        >
                          <Zap size={13} />
                          <span>Prorrogar prazo +2 dias</span>
                        </button>
                      {:else if item.remainingHours > 24 && item.extensionCount === 0 && item.status === 'IN_PROGRESS'}
                        <div class="drawer-ext-note info">
                          <Info size={12} class="text-cyan-400" />
                          <span>Prorrogação de +2 dias disponível nas últimas 24h do prazo.</span>
                        </div>
                      {:else if item.extensionCount > 0}
                        <div class="drawer-ext-note extended">
                          <Check size={12} class="text-emerald-400" />
                          <span>Prazo prorrogado (+2 dias concedidos)</span>
                        </div>
                      {/if}
                    {/if}

                    {#if item.productionChapter && onOpenChapter}
                      <button
                        type="button"
                        class="btn-open-production"
                        onclick={() => {
                          showDayDrawer = false;
                          onOpenChapter(item.productionChapter);
                        }}
                      >
                        <span>Abrir na Produção</span>
                        <ArrowRight size={13} />
                      </button>
                    {/if}
                  </div>
                </article>
              {/each}
            </div>
          {/if}
        </section>

        <!-- Publications Section -->
        {#if selectedDayPublications.length > 0}
          <section class="drawer-section mt-pub">
            <div class="section-title-strip">
              <Sparkles size={15} class="text-cyan-400" />
              <h4 class="section-heading">Publicações no Site ({selectedDayPublications.length})</h4>
            </div>

            <div class="publications-list-stack">
              {#each selectedDayPublications as pub}
                <div class="pub-row-card">
                  <div class="pub-icon-cell">
                    <Sparkles size={15} />
                  </div>
                  <div class="pub-info-cell">
                    <span class="pub-work-name">{pub.works?.title || 'Obra'}</span>
                    <span class="pub-ch-num">Capítulo #{pub.number} {pub.title ? `— ${pub.title}` : ''}</span>
                  </div>
                  <a
                    href="/ler/{pub.id}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-open-reader"
                  >
                    <span>Ler</span>
                    <ArrowRight size={12} />
                  </a>
                </div>
              {/each}
            </div>
          </section>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- ========================================================================= -->
<!-- 5. EXTENSION CONFIRMATION MODAL (+2 DIAS)                                 -->
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
    <div class="extension-modal-card">
      <header class="ext-modal-header">
        <div class="ext-header-left">
          <div class="ext-icon-orb">
            <Zap size={18} />
          </div>
          <div>
            <h3 id="ext-modal-title" class="ext-modal-title">Prorrogar prazo em +2 dias</h3>
            <p class="ext-modal-subtitle">Adicione 2 dias corridos à sua data limite atual.</p>
          </div>
        </div>
        <button
          type="button"
          class="btn-close-modal"
          onclick={closeExtensionModal}
          disabled={isExtending}
          aria-label="Fechar"
        >
          <X size={16} />
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
              invalidate('scan:workspace');
              closeExtensionModal();
            }
          };
        }}
        class="ext-modal-body"
      >
        <input type="hidden" name="chapter_stage_id" value={extensionTargetItem.id} />

        {#if extensionFeedback}
          <div class="alert-banner {extensionFeedback.type}" role="alert">
            <AlertCircle size={14} />
            <span>{extensionFeedback.message}</span>
          </div>
        {/if}

        <div class="ext-context-box">
          <span class="ext-work-title">
            {extensionTargetItem.workTitle} — Cap. #{extensionTargetItem.chapterNumber}
          </span>
          <span class="ext-stage-pill" style="--st-c: {extensionTargetItem.stageColor}">
            {extensionTargetItem.stageName}
          </span>
        </div>

        <div class="ext-rules-card">
          <div class="rule-line">
            <Check size={14} class="text-emerald-400" />
            <span>Prorrogação automática sem necessidade de aprovação.</span>
          </div>
          <div class="rule-line">
            <Check size={14} class="text-emerald-400" />
            <span>Acrescenta 2 dias corridos ao prazo vigente.</span>
          </div>
          <div class="rule-line info">
            <Info size={14} class="text-cyan-400" />
            <span>Permitido apenas 1 vez por atribuição.</span>
          </div>
        </div>

        <footer class="ext-modal-footer">
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
            class="btn-confirm-extend"
            disabled={isExtending}
          >
            {#if isExtending}
              <span class="spinner-mini"></span>
              <span>Prorrogando...</span>
            {:else}
              <Zap size={15} />
              <span>Confirmar +2 dias</span>
            {/if}
          </button>
        </footer>
      </form>
    </div>
  </div>
{/if}

<!-- ========================================================================= -->
<!-- 6. MOBILE FILTER BOTTOM SHEET (Android & Mobile Screens)                  -->
<!-- ========================================================================= -->
{#if showMobileFilterSheet}
  <div
    class="filter-sheet-backdrop"
    onclick={(e) => {
      if (e.target === e.currentTarget) showMobileFilterSheet = false;
    }}
    role="dialog"
    aria-modal="true"
    aria-label="Filtros do Calendário"
  >
    <div class="filter-sheet-panel">
      <header class="filter-sheet-header">
        <div class="sheet-title-cluster">
          <Sliders size={16} class="text-purple-400" />
          <h3 class="sheet-heading">Filtros do Calendário</h3>
        </div>
        <button
          type="button"
          class="btn-close-filter-sheet"
          onclick={() => (showMobileFilterSheet = false)}
          aria-label="Fechar filtros"
        >
          <X size={18} />
        </button>
      </header>

      <div class="filter-sheet-body">
        <!-- Stage section -->
        <div class="filter-section-block">
          <span class="filter-section-title">Etapa Editorial</span>
          <div class="filter-pills-flow">
            {#each [
              { slug: 'ALL', label: 'Todas as etapas' },
              { slug: 'traducao', label: 'Tradução' },
              { slug: 'clean_redraw', label: 'Clean/Redraw' },
              { slug: 'typeset', label: 'Typeset' },
              { slug: 'revisor_qc', label: 'Revisor (QC)' },
              { slug: 'tarefa', label: 'Tarefas gerais' }
            ] as opt}
              <button
                type="button"
                class="filter-chip-option"
                class:is-chosen={filterStageSlug === opt.slug}
                onclick={() => (filterStageSlug = opt.slug)}
              >
                {opt.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Status section -->
        <div class="filter-section-block">
          <span class="filter-section-title">Situação do Prazo</span>
          <div class="filter-pills-flow">
            {#each [
              { key: 'ALL', label: 'Todas' },
              { key: 'IN_PROGRESS', label: 'Em andamento' },
              { key: 'DUE_SOON', label: 'Vence em breve (≤24h)' },
              { key: 'DONE', label: 'Concluídos' },
              { key: 'OVERDUE', label: 'Em atraso' },
              { key: 'EXTENDED', label: 'Prorrogados (+2d)' }
            ] as opt}
              <button
                type="button"
                class="filter-chip-option"
                class:is-chosen={filterStatus === opt.key}
                onclick={() => (filterStatus = opt.key)}
              >
                {opt.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Assignee section -->
        <div class="filter-section-block">
          <span class="filter-section-title">Responsável</span>
          <select bind:value={filterAssigneeId} class="filter-sheet-select">
            <option value="ALL">Toda a equipe</option>
            <option value="MINE">Apenas minhas entregas</option>
            {#each team as member}
              <option value={member.id}>{member.display_name || member.username}</option>
            {/each}
          </select>
        </div>
      </div>

      <footer class="filter-sheet-footer">
        <button
          type="button"
          class="btn-sheet-clear"
          onclick={() => {
            clearAllFilters();
          }}
        >
          Limpar Tudo
        </button>
        <button
          type="button"
          class="btn-sheet-apply"
          onclick={() => (showMobileFilterSheet = false)}
        >
          Ver {filteredCommitments.length} compromisso{filteredCommitments.length === 1 ? '' : 's'}
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  /* ========================================================================= */
  /* DESIGN SYSTEM: PROJECT NOX PREMIUM EDITORIAL CALENDAR                     */
  /* ========================================================================= */
  .scan-calendar-hub {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    width: 100%;
    color: #f1f5f9;
  }

  /* 1. TOP HEADER */
  .calendar-top-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 1.15rem;
    background: #090d16;
    border: 1px solid rgba(139, 92, 246, 0.22);
    border-radius: 0.95rem;
    gap: 1rem;
    flex-wrap: wrap;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  }

  .header-branding-block {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .calendar-icon-orb {
    width: 36px;
    height: 36px;
    border-radius: 0.65rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(139, 92, 246, 0.16);
    color: #c084fc;
    border: 1px solid rgba(139, 92, 246, 0.35);
    flex-shrink: 0;
  }

  .branding-text {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .calendar-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    line-height: 1.25;
    letter-spacing: -0.01em;
  }

  .calendar-subtitle {
    font-size: 0.78rem;
    color: #94a3b8;
    margin: 0;
    line-height: 1.25;
  }

  .month-nav-cluster {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .nav-btn-group {
    display: inline-flex;
    align-items: center;
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.55rem;
    padding: 0.15rem;
  }

  .btn-month-nav {
    background: transparent;
    border: none;
    color: #94a3b8;
    width: 28px;
    height: 28px;
    border-radius: 0.4rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-month-nav:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .current-month-display {
    padding: 0 0.65rem;
    font-size: 0.875rem;
    font-weight: 700;
    color: #f1f5f9;
    letter-spacing: -0.01em;
  }

  .current-month-display .year-num {
    color: #8b5cf6;
    font-weight: 600;
  }

  .btn-today-pill {
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.3);
    color: #c084fc;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 0.35rem 0.75rem;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-today-pill:hover {
    background: rgba(139, 92, 246, 0.22);
    color: #fff;
  }

  .view-toggle-segmented {
    display: inline-flex;
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.55rem;
    padding: 0.15rem;
  }

  .toggle-opt-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 0.76rem;
    font-weight: 600;
    padding: 0.3rem 0.6rem;
    border-radius: 0.4rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toggle-opt-btn.active {
    background: #7c3aed;
    color: #fff;
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.4);
  }

  /* 2. HORIZONTAL FILTER BAR */
  .calendar-filters-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.55rem 0.95rem;
    background: #090d16;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 0.75rem;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .desktop-only-filters {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .mobile-filter-controls {
    display: none;
  }

  .filters-left-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .chip-filter-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 0.76rem;
    font-weight: 600;
    padding: 0.32rem 0.65rem;
    border-radius: 0.45rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .chip-filter-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .chip-filter-btn.is-active {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.5);
    color: #c084fc;
  }

  .filter-select-wrapper {
    position: relative;
  }

  .filter-native-select {
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 0.76rem;
    font-weight: 500;
    padding: 0.32rem 0.65rem;
    border-radius: 0.45rem;
    outline: none;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-native-select:focus {
    border-color: rgba(139, 92, 246, 0.5);
  }

  .btn-clear-filters {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.3rem 0.5rem;
    border-radius: 0.35rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-clear-filters:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .commitments-stat-pill {
    font-size: 0.75rem;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.04);
    padding: 0.25rem 0.6rem;
    border-radius: 0.4rem;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .commitments-stat-pill strong {
    color: #c084fc;
  }

  /* Mobile Filter Top Strip & Pills */
  .mobile-filters-top-strip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
  }

  .btn-open-filter-sheet {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.4);
    color: #c084fc;
    font-size: 0.76rem;
    font-weight: 700;
    padding: 0.35rem 0.65rem;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-open-filter-sheet:hover {
    background: rgba(139, 92, 246, 0.25);
    color: #fff;
  }

  .sheet-count-pip {
    font-size: 0.65rem;
    background: #7c3aed;
    color: #fff;
    padding: 0.05rem 0.35rem;
    border-radius: 9999px;
    font-weight: 800;
  }

  .btn-clear-mobile-quick {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.3rem 0.5rem;
    border-radius: 0.4rem;
    cursor: pointer;
  }

  .mobile-stat-count {
    margin-left: auto;
    font-size: 0.72rem;
    color: #94a3b8;
  }

  .mobile-stat-count strong {
    color: #c084fc;
  }

  .mobile-active-chips-scroll {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    overflow-x: auto;
    padding-top: 0.35rem;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .mobile-active-chips-scroll::-webkit-scrollbar {
    display: none;
  }

  .active-chip-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: rgba(139, 92, 246, 0.2);
    border: 1px solid rgba(139, 92, 246, 0.4);
    color: #e2e8f0;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.2rem 0.5rem;
    border-radius: 0.4rem;
    white-space: nowrap;
    cursor: pointer;
  }

  /* 3. WORKSPACE LAYOUT (Main Grid + Side Widgets) */
  .calendar-workspace-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 0.85rem;
    align-items: start;
  }

  .calendar-primary-container {
    min-width: 0;
  }

  /* Monthly Grid Card */
  .calendar-monthly-card {
    background: #090d16;
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 0.95rem;
    overflow: hidden;
    box-shadow: 0 4px 25px rgba(0, 0, 0, 0.4);
  }

  .weekday-labels-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: rgba(15, 23, 42, 0.9);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .weekday-label-cell {
    padding: 0.55rem 0.4rem;
    text-align: center;
    font-size: 0.74rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .weekday-label-cell.weekend {
    color: #64748b;
  }

  .monthly-days-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: rgba(255, 255, 255, 0.05);
    gap: 1px;
  }

  .matrix-day-cell {
    background: #090d16;
    min-height: 105px;
    max-height: 135px;
    padding: 0.45rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    text-align: left;
    border: none;
    cursor: pointer;
    transition: background 0.15s ease;
    overflow: hidden;
  }

  .matrix-day-cell:hover {
    background: rgba(139, 92, 246, 0.08);
  }

  .matrix-day-cell.is-other-month {
    background: #060910;
    opacity: 0.45;
  }

  .matrix-day-cell.is-today {
    background: rgba(139, 92, 246, 0.12);
    box-shadow: inset 0 0 0 1px rgba(139, 92, 246, 0.45);
  }

  .matrix-day-cell.is-selected {
    box-shadow: inset 0 0 0 2px #a855f7;
    background: rgba(139, 92, 246, 0.18);
  }

  .cell-top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .cell-day-num {
    font-size: 0.8rem;
    font-weight: 700;
    color: #cbd5e1;
    line-height: 1;
  }

  .matrix-day-cell.is-today .cell-day-num {
    color: #c084fc;
  }

  .cell-today-pill {
    font-size: 0.62rem;
    font-weight: 700;
    background: #7c3aed;
    color: #fff;
    padding: 0.1rem 0.35rem;
    border-radius: 0.3rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* Desktop Events Stack: Real Avatars + Stage + Chapter */
  .desktop-events-stack {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
    overflow: hidden;
  }

  .day-event-card {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    background: rgba(15, 23, 42, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-left: 3px solid var(--stage-accent, #8b5cf6);
    border-radius: 0.35rem;
    padding: 0.22rem 0.35rem;
    overflow: hidden;
    transition: transform 0.1s ease, border-color 0.1s ease;
  }

  .day-event-card:hover {
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .day-event-card.in-progress {
    background: rgba(139, 92, 246, 0.1);
  }

  .day-event-card.due-soon {
    background: rgba(245, 158, 11, 0.12);
    border-left-color: #f59e0b;
  }

  .day-event-card.done {
    background: rgba(16, 185, 129, 0.1);
    border-left-color: #10b981;
  }

  .day-event-card.overdue {
    background: rgba(239, 68, 68, 0.12);
    border-left-color: #ef4444;
  }

  .day-event-card.extended {
    background: rgba(6, 182, 212, 0.1);
    border-left-color: #06b6d4;
  }

  .event-card-top-row {
    display: flex;
    align-items: center;
    gap: 0.28rem;
    width: 100%;
    min-width: 0;
  }

  .event-card-avatar-wrap {
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .event-card-user-name {
    font-size: 0.64rem;
    font-weight: 600;
    color: #e2e8f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .event-card-bottom-row {
    display: flex;
    align-items: center;
    gap: 0.28rem;
    width: 100%;
    min-width: 0;
  }

  .event-card-stage-pill {
    font-size: 0.58rem;
    font-weight: 700;
    color: var(--stage-accent, #c084fc);
    background: rgba(255, 255, 255, 0.06);
    padding: 0.04rem 0.25rem;
    border-radius: 0.25rem;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .event-card-work-line {
    font-size: 0.64rem;
    font-weight: 600;
    color: #cbd5e1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .event-card-ext-badge {
    font-size: 0.58rem;
    font-weight: 700;
    background: rgba(6, 182, 212, 0.25);
    color: #22d3ee;
    padding: 0.05rem 0.25rem;
    border-radius: 0.25rem;
    flex-shrink: 0;
  }

  .event-card-done-ico {
    color: #10b981;
    flex-shrink: 0;
  }

  .event-overflow-badge {
    font-size: 0.62rem;
    font-weight: 600;
    color: #a855f7;
    background: rgba(168, 85, 247, 0.12);
    border: 1px solid rgba(168, 85, 247, 0.25);
    padding: 0.1rem 0.35rem;
    border-radius: 0.3rem;
    text-align: center;
  }

  .publication-badge-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #34d399;
    font-size: 0.62rem;
    font-weight: 600;
    padding: 0.1rem 0.35rem;
    border-radius: 0.3rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Mobile Day Content: Avatars + Pips (Hidden on desktop, shown on mobile) */
  .mobile-day-cell-content {
    display: none;
  }

  /* Agenda View Styling */
  .agenda-view-wrapper {
    background: #090d16;
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 0.95rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    box-shadow: 0 4px 25px rgba(0, 0, 0, 0.4);
  }

  .agenda-header-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 0.65rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .agenda-header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .agenda-heading {
    font-size: 0.925rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .agenda-count-badge {
    font-size: 0.72rem;
    font-weight: 600;
    background: rgba(139, 92, 246, 0.15);
    color: #c084fc;
    padding: 0.2rem 0.55rem;
    border-radius: 0.4rem;
  }

  .agenda-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    gap: 0.6rem;
    color: #94a3b8;
    text-align: center;
  }

  .agenda-list-stack {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .agenda-item-card {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    background: rgba(15, 23, 42, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.65rem;
    padding: 0.75rem 0.95rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .agenda-item-card:hover {
    background: rgba(15, 23, 42, 0.95);
    border-color: rgba(139, 92, 246, 0.35);
    transform: translateX(2px);
  }

  .agenda-item-card.overdue {
    border-left: 3px solid #ef4444;
  }

  .agenda-item-card.done {
    border-left: 3px solid #10b981;
  }

  .agenda-item-card.extended {
    border-left: 3px solid #06b6d4;
  }

  .agenda-date-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 0.5rem;
    flex-shrink: 0;
  }

  .agenda-date-day {
    font-size: 1rem;
    font-weight: 700;
    color: #f1f5f9;
    line-height: 1;
  }

  .agenda-date-month {
    font-size: 0.62rem;
    font-weight: 700;
    color: #c084fc;
    text-transform: uppercase;
  }

  .agenda-item-body {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    flex: 1;
  }

  .agenda-work-head {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
  }

  .agenda-work-title {
    font-size: 0.9rem;
    font-weight: 700;
    color: #f8fafc;
  }

  .agenda-chapter-badge {
    font-size: 0.72rem;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
    padding: 0.1rem 0.4rem;
    border-radius: 0.3rem;
  }

  .agenda-stage-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.72rem;
    font-weight: 600;
    background: color-mix(in srgb, var(--st-c, #a855f7) 16%, transparent);
    color: var(--st-c, #a855f7);
    border: 1px solid color-mix(in srgb, var(--st-c, #a855f7) 35%, transparent);
    padding: 0.1rem 0.45rem;
    border-radius: 0.3rem;
  }

  .agenda-stage-badge .st-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
  }

  .agenda-meta-row {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    font-size: 0.75rem;
    color: #94a3b8;
    flex-wrap: wrap;
  }

  .agenda-user-lockup {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: #e2e8f0;
    font-weight: 500;
  }

  .agenda-status-pill {
    font-size: 0.68rem;
    font-weight: 600;
    padding: 0.1rem 0.4rem;
    border-radius: 0.3rem;
  }

  .agenda-status-pill.in-progress {
    background: rgba(139, 92, 246, 0.15);
    color: #c084fc;
  }

  .agenda-status-pill.due-soon {
    background: rgba(245, 158, 11, 0.18);
    color: #fbbf24;
  }

  .agenda-status-pill.done {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .agenda-status-pill.overdue {
    background: rgba(239, 68, 68, 0.18);
    color: #fca5a5;
  }

  .agenda-ext-pill {
    font-size: 0.68rem;
    font-weight: 700;
    background: rgba(6, 182, 212, 0.2);
    color: #22d3ee;
    padding: 0.1rem 0.4rem;
    border-radius: 0.3rem;
  }

  .agenda-note-excerpt {
    font-size: 0.74rem;
    color: #94a3b8;
    font-style: italic;
    margin: 0.15rem 0 0;
  }

  .agenda-action-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .btn-agenda-extend {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: rgba(6, 182, 212, 0.15);
    border: 1px solid rgba(6, 182, 212, 0.35);
    color: #22d3ee;
    font-size: 0.74rem;
    font-weight: 700;
    padding: 0.3rem 0.6rem;
    border-radius: 0.4rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-agenda-extend:hover {
    background: rgba(6, 182, 212, 0.25);
    color: #fff;
  }

  .agenda-arrow-icon {
    color: #64748b;
  }

  /* SIDEBAR PANELS (Widgets) */
  .calendar-side-column {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .side-widget-card {
    background: #090d16;
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 0.85rem;
    padding: 0.85rem 0.95rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .hero-my-delivery-card {
    border-color: rgba(6, 182, 212, 0.35);
    background: linear-gradient(180deg, rgba(6, 182, 212, 0.05) 0%, rgba(9, 13, 22, 1) 100%);
  }

  .widget-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.45rem;
    padding-bottom: 0.45rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .widget-header-title-wrap {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .widget-title {
    font-size: 0.825rem;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0;
  }

  .team-alert-pill {
    font-size: 0.65rem;
    font-weight: 700;
    color: #fca5a5;
    background: rgba(239, 68, 68, 0.18);
    border: 1px solid rgba(239, 68, 68, 0.35);
    padding: 0.1rem 0.4rem;
    border-radius: 0.3rem;
  }

  /* Hero Delivery Box */
  .hero-delivery-box {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.65rem;
    padding: 0.75rem;
  }

  .hero-delivery-top {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  .hero-cover-wrap {
    width: 38px;
    height: 52px;
    border-radius: 0.4rem;
    overflow: hidden;
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  .hero-cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .hero-cover-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
  }

  .hero-delivery-meta {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
    flex: 1;
  }

  .hero-delivery-title {
    font-size: 0.85rem;
    font-weight: 700;
    color: #f8fafc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hero-delivery-badges {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .countdown-pill {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.1rem 0.4rem;
    border-radius: 0.3rem;
    background: rgba(6, 182, 212, 0.18);
    color: #22d3ee;
    border: 1px solid rgba(6, 182, 212, 0.3);
  }

  .countdown-pill.due-soon {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    border-color: rgba(245, 158, 11, 0.4);
  }

  .countdown-pill.overdue {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
    border-color: rgba(239, 68, 68, 0.4);
  }

  .countdown-pill.extended {
    background: rgba(6, 182, 212, 0.22);
    color: #38bdf8;
    border-color: rgba(6, 182, 212, 0.45);
  }

  .hero-deadline-strip {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.74rem;
    padding-top: 0.35rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .hero-due-label {
    color: #94a3b8;
  }

  .hero-due-val {
    color: #38bdf8;
    font-weight: 700;
  }

  .btn-prominent-extend {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
    border: 1px solid rgba(6, 182, 212, 0.5);
    color: #fff;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 0.45rem 0.85rem;
    border-radius: 0.45rem;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(6, 182, 212, 0.35);
    transition: all 0.15s ease;
  }

  .btn-prominent-extend:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(6, 182, 212, 0.5);
  }

  .extension-hero-info {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.68rem;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.03);
    padding: 0.35rem 0.5rem;
    border-radius: 0.35rem;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .extension-hero-extended {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.7rem;
    color: #34d399;
    background: rgba(16, 185, 129, 0.1);
    padding: 0.35rem 0.5rem;
    border-radius: 0.35rem;
    border: 1px solid rgba(16, 185, 129, 0.25);
    font-weight: 600;
  }

  .btn-hero-focus-day {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.35rem 0.65rem;
    border-radius: 0.4rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-hero-focus-day:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  /* Other Personal Commitments */
  .other-personal-block {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding-top: 0.4rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .other-personal-heading {
    font-size: 0.7rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .other-personal-stack {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .other-personal-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(15, 23, 42, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 0.4rem;
    padding: 0.35rem 0.55rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .other-personal-row:hover {
    background: rgba(15, 23, 42, 0.9);
    border-color: rgba(139, 92, 246, 0.3);
  }

  .other-row-info {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
  }

  .other-row-title {
    font-size: 0.74rem;
    font-weight: 600;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 140px;
  }

  .other-row-due {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .other-due-text {
    font-size: 0.68rem;
    color: #94a3b8;
  }

  /* Collapsible Widget (Equipe & Publicações) */
  .side-collapsible-card {
    background: #090d16;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.85rem;
    overflow: hidden;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.25);
  }

  .side-collapsible-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 0.95rem;
    cursor: pointer;
    list-style: none;
    user-select: none;
    font-size: 0.8rem;
    font-weight: 700;
    color: #cbd5e1;
    transition: background 0.15s ease;
  }

  .side-collapsible-summary::-webkit-details-marker {
    display: none;
  }

  .side-collapsible-summary:hover {
    background: rgba(255, 255, 255, 0.04);
    color: #fff;
  }

  .summary-left {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .collapsible-chevron-icon {
    transition: transform 0.2s ease;
    color: #64748b;
  }

  .side-collapsible-card[open] .collapsible-chevron-icon {
    transform: rotate(180deg);
  }

  .side-collapsible-content {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding: 0.75rem 0.95rem 0.95rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(15, 23, 42, 0.4);
  }

  .collapsible-sub-section {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .sub-section-title {
    font-size: 0.68rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .sub-empty-text {
    font-size: 0.72rem;
    color: #64748b;
    margin: 0;
  }

  .collapsible-pubs-stack {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .pub-mini-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(16, 185, 129, 0.06);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 0.4rem;
    padding: 0.35rem 0.55rem;
  }

  .pub-mini-title {
    font-size: 0.72rem;
    font-weight: 600;
    color: #f1f5f9;
  }

  .btn-pub-mini-read {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.35);
    color: #34d399;
    font-size: 0.66rem;
    font-weight: 700;
    padding: 0.15rem 0.4rem;
    border-radius: 0.3rem;
    text-decoration: none;
  }

  .btn-pub-mini-read:hover {
    background: rgba(16, 185, 129, 0.28);
    color: #fff;
  }

  .widget-empty-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1.25rem 0.5rem;
    gap: 0.45rem;
    color: #94a3b8;
    text-align: center;
    font-size: 0.78rem;
  }

  .widget-items-stack {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .widget-delivery-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 0.5rem;
    padding: 0.5rem 0.65rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .widget-delivery-item:hover {
    background: rgba(15, 23, 42, 0.95);
    border-color: rgba(139, 92, 246, 0.3);
  }

  .widget-delivery-item.is-overdue {
    border-left: 3px solid #ef4444;
  }

  .delivery-item-left {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .delivery-work-title {
    font-size: 0.78rem;
    font-weight: 700;
    color: #f8fafc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .delivery-header-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem;
  }

  .delivery-status-pill {
    font-size: 0.62rem;
    font-weight: 700;
    padding: 0.08rem 0.35rem;
    border-radius: 0.25rem;
  }

  .delivery-status-pill.in-progress {
    background: rgba(139, 92, 246, 0.15);
    color: #c084fc;
  }

  .delivery-status-pill.due-soon {
    background: rgba(245, 158, 11, 0.18);
    color: #fbbf24;
  }

  .delivery-status-pill.done {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .delivery-status-pill.overdue {
    background: rgba(239, 68, 68, 0.18);
    color: #fca5a5;
  }

  .delivery-status-pill.extended {
    background: rgba(6, 182, 212, 0.18);
    color: #22d3ee;
  }

  .delivery-tags-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .delivery-assignee-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.66rem;
    color: #cbd5e1;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .delivery-stage-tag {
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--st-c, #a855f7);
  }

  .delivery-due-tag {
    font-size: 0.68rem;
    color: #94a3b8;
  }

  .delivery-item-right {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .btn-widget-extend {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    background: rgba(6, 182, 212, 0.2);
    border: 1px solid rgba(6, 182, 212, 0.4);
    color: #22d3ee;
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.15rem 0.35rem;
    border-radius: 0.3rem;
    cursor: pointer;
  }

  .widget-arrow {
    color: #64748b;
  }

  .team-avail-grid {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .team-avail-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.25rem 0.35rem;
  }

  .member-lockup {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
  }

  .member-name {
    font-size: 0.74rem;
    color: #cbd5e1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .avail-badge {
    font-size: 0.64rem;
    font-weight: 600;
    padding: 0.1rem 0.35rem;
    border-radius: 0.3rem;
    flex-shrink: 0;
  }

  .avail-badge.active {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .avail-badge.busy {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .avail-badge.away, .avail-badge.hiatus {
    background: rgba(100, 116, 139, 0.15);
    color: #94a3b8;
  }

  /* ========================================================================= */
  /* 4. DAY DETAILS DRAWER (DESKTOP) & BOTTOM SHEET (MOBILE)                    */
  /* ========================================================================= */
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9998;
    background: rgba(4, 7, 18, 0.75);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    display: flex;
    justify-content: flex-end;
  }

  .day-drawer-panel {
    background: #090d16;
    border-left: 1px solid rgba(139, 92, 246, 0.3);
    box-shadow: -15px 0 45px rgba(0, 0, 0, 0.7);
    width: 100%;
    max-width: 480px;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: drawerSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes drawerSlideIn {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.15rem 1.25rem 0.95rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    gap: 0.75rem;
  }

  .drawer-header-left {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .drawer-header-eyebrow {
    font-size: 0.7rem;
    font-weight: 700;
    color: #8b5cf6;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .drawer-date-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .btn-close-drawer {
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 0.45rem;
    border-radius: 0.45rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .btn-close-drawer:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .drawer-scroll-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.15rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .drawer-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .section-title-strip {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .section-heading {
    font-size: 0.85rem;
    font-weight: 700;
    color: #e2e8f0;
    margin: 0;
  }

  .drawer-empty-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2.5rem 1rem;
    gap: 0.5rem;
    color: #94a3b8;
    text-align: center;
    font-size: 0.82rem;
    background: rgba(15, 23, 42, 0.45);
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 0.75rem;
  }

  .drawer-cards-stack {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .drawer-commitment-card {
    background: rgba(15, 23, 42, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.85rem;
    padding: 0.95rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    transition: border-color 0.15s ease;
  }

  .drawer-commitment-card:hover {
    border-color: rgba(139, 92, 246, 0.35);
  }

  .drawer-commitment-card.overdue {
    border-left: 3px solid #ef4444;
  }

  .drawer-commitment-card.done {
    border-left: 3px solid #10b981;
  }

  .drawer-commitment-card.extended {
    border-left: 3px solid #06b6d4;
  }

  .card-hero-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .work-cover-thumb-box {
    width: 44px;
    height: 60px;
    border-radius: 0.45rem;
    overflow: hidden;
    background: #1e293b;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .work-cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .work-cover-img.fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
  }

  .hero-text-col {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    flex: 1;
  }

  .hero-work-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: #f8fafc;
    line-height: 1.25;
  }

  .hero-pills-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .hero-chapter-pill {
    font-size: 0.72rem;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
    padding: 0.1rem 0.45rem;
    border-radius: 0.35rem;
  }

  .hero-stage-pill {
    font-size: 0.72rem;
    font-weight: 600;
    background: color-mix(in srgb, var(--st-c, #a855f7) 16%, transparent);
    color: var(--st-c, #a855f7);
    border: 1px solid color-mix(in srgb, var(--st-c, #a855f7) 35%, transparent);
    padding: 0.1rem 0.45rem;
    border-radius: 0.35rem;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .hero-stage-pill .st-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
  }

  .hero-status-box {
    flex-shrink: 0;
  }

  .hero-status-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.2rem 0.55rem;
    border-radius: 0.4rem;
  }

  .hero-status-tag.in-progress {
    background: rgba(139, 92, 246, 0.15);
    color: #c084fc;
    border: 1px solid rgba(139, 92, 246, 0.3);
  }

  .hero-status-tag.due-soon {
    background: rgba(245, 158, 11, 0.18);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.35);
  }

  .hero-status-tag.done {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .hero-status-tag.overdue {
    background: rgba(239, 68, 68, 0.18);
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.35);
  }

  .hero-status-tag.extended {
    background: rgba(6, 182, 212, 0.18);
    color: #22d3ee;
    border: 1px solid rgba(6, 182, 212, 0.35);
  }

  .card-details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
    background: rgba(0, 0, 0, 0.25);
    padding: 0.65rem 0.75rem;
    border-radius: 0.55rem;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .detail-cell {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .detail-label {
    font-size: 0.68rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .detail-user-pill {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
  }

  .detail-user-name {
    font-size: 0.78rem;
    font-weight: 600;
    color: #e2e8f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .detail-due-val {
    font-size: 0.8rem;
    font-weight: 700;
  }

  .detail-orig-due {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  /* Notes Block */
  .notes-block {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 0.55rem;
    padding: 0.65rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .notes-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .notes-label-text {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.72rem;
    font-weight: 600;
    color: #94a3b8;
  }

  .btn-edit-note-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: transparent;
    border: none;
    color: #a855f7;
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-edit-note-trigger:hover {
    color: #c084fc;
    text-decoration: underline;
  }

  .notes-body-text {
    font-size: 0.78rem;
    color: #e2e8f0;
    font-style: italic;
    line-height: 1.35;
    margin: 0;
  }

  .notes-body-text.is-empty {
    color: #64748b;
    font-style: normal;
  }

  .note-editor-form {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    margin-top: 0.25rem;
  }

  .note-editor-textarea {
    width: 100%;
    background: #060910;
    border: 1px solid rgba(139, 92, 246, 0.4);
    border-radius: 0.45rem;
    padding: 0.45rem 0.6rem;
    color: #f1f5f9;
    font-size: 0.78rem;
    line-height: 1.35;
    resize: none;
    outline: none;
  }

  .note-editor-buttons {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.45rem;
  }

  .btn-note-cancel {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
    font-size: 0.74rem;
    font-weight: 600;
    padding: 0.3rem 0.6rem;
    border-radius: 0.4rem;
    cursor: pointer;
  }

  .btn-note-save {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: #7c3aed;
    border: none;
    color: #fff;
    font-size: 0.74rem;
    font-weight: 700;
    padding: 0.3rem 0.7rem;
    border-radius: 0.4rem;
    cursor: pointer;
  }

  /* Actions Bar */
  .card-actions-bar {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    flex-wrap: wrap;
  }

  .btn-extend-action {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(6, 182, 212, 0.15);
    border: 1px solid rgba(6, 182, 212, 0.4);
    color: #22d3ee;
    font-size: 0.76rem;
    font-weight: 700;
    padding: 0.4rem 0.75rem;
    border-radius: 0.45rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-extend-action:hover {
    background: rgba(6, 182, 212, 0.25);
    color: #fff;
  }

  .btn-open-production {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.3);
    color: #c084fc;
    font-size: 0.76rem;
    font-weight: 600;
    padding: 0.4rem 0.75rem;
    border-radius: 0.45rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-open-production:hover {
    background: rgba(139, 92, 246, 0.22);
    color: #fff;
  }

  /* Publications List in Drawer */
  .publications-list-stack {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .pub-row-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 0.55rem;
    padding: 0.55rem 0.75rem;
    gap: 0.65rem;
  }

  .pub-icon-cell {
    color: #34d399;
  }

  .pub-info-cell {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  .pub-work-name {
    font-size: 0.8rem;
    font-weight: 700;
    color: #f1f5f9;
  }

  .pub-ch-num {
    font-size: 0.72rem;
    color: #94a3b8;
  }

  .btn-open-reader {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: rgba(16, 185, 129, 0.2);
    border: 1px solid rgba(16, 185, 129, 0.4);
    color: #34d399;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.25rem 0.55rem;
    border-radius: 0.35rem;
    text-decoration: none;
  }

  .btn-open-reader:hover {
    background: rgba(16, 185, 129, 0.35);
    color: #fff;
  }

  /* ========================================================================= */
  /* 5. EXTENSION CONFIRMATION MODAL (+2 DIAS)                                 */
  /* ========================================================================= */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(4, 7, 18, 0.82);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .extension-modal-card {
    background: #090d16;
    border: 1px solid rgba(6, 182, 212, 0.35);
    border-radius: 1.15rem;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.75), 0 0 30px rgba(6, 182, 212, 0.15);
    width: 100%;
    max-width: 440px;
    overflow: hidden;
    animation: modalPopIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .ext-modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 1.1rem 1.15rem 0.85rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    gap: 0.75rem;
  }

  .ext-header-left {
    display: flex;
    align-items: flex-start;
    gap: 0.7rem;
  }

  .ext-icon-orb {
    width: 36px;
    height: 36px;
    border-radius: 0.65rem;
    background: rgba(6, 182, 212, 0.18);
    color: #22d3ee;
    border: 1px solid rgba(6, 182, 212, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .ext-modal-title {
    font-size: 1rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .ext-modal-subtitle {
    font-size: 0.76rem;
    color: #94a3b8;
    margin: 0.15rem 0 0;
  }

  .ext-modal-body {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding: 1rem 1.15rem 1.15rem;
  }

  .ext-context-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(15, 23, 42, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.55rem;
    padding: 0.65rem 0.85rem;
    gap: 0.5rem;
  }

  .ext-work-title {
    font-size: 0.84rem;
    font-weight: 700;
    color: #f1f5f9;
  }

  .ext-stage-pill {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--st-c, #a855f7);
    background: color-mix(in srgb, var(--st-c, #a855f7) 16%, transparent);
    padding: 0.12rem 0.45rem;
    border-radius: 0.35rem;
    border: 1px solid color-mix(in srgb, var(--st-c, #a855f7) 35%, transparent);
  }

  .ext-rules-card {
    background: rgba(6, 182, 212, 0.06);
    border: 1px solid rgba(6, 182, 212, 0.2);
    border-radius: 0.6rem;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .rule-line {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.76rem;
    color: #cbd5e1;
  }

  .rule-line.info {
    color: #94a3b8;
  }

  .ext-modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.55rem;
    margin-top: 0.25rem;
  }

  .btn-confirm-extend {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
    border: 1px solid rgba(6, 182, 212, 0.4);
    color: #fff;
    font-size: 0.82rem;
    font-weight: 700;
    padding: 0.55rem 1.15rem;
    border-radius: 0.55rem;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(6, 182, 212, 0.35);
    transition: all 0.15s ease;
  }

  .btn-confirm-extend:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(6, 182, 212, 0.5);
  }

  .btn-confirm-extend:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner-mini {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  /* Default state for mobile preview strip (hidden on desktop) */
  .mobile-day-preview-strip {
    display: none;
  }

  /* ========================================================================= */
  /* 6. MOBILE FILTER BOTTOM SHEET (Android & Mobile Screens)                  */
  /* ========================================================================= */
  .filter-sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(4, 7, 18, 0.78);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .filter-sheet-panel {
    background: #090d16;
    border-top: 1px solid rgba(139, 92, 246, 0.35);
    border-radius: 1.15rem 1.15rem 0 0;
    width: 100%;
    max-width: 520px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.85);
    animation: filterSheetUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes filterSheetUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  .filter-sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.15rem 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .sheet-title-cluster {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .sheet-heading {
    font-size: 0.95rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .btn-close-filter-sheet {
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 0.35rem;
    border-radius: 0.4rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .btn-close-filter-sheet:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .filter-sheet-body {
    padding: 1rem 1.15rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }

  .filter-section-block {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .filter-section-title {
    font-size: 0.72rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .filter-pills-flow {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .filter-chip-option {
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 0.74rem;
    font-weight: 600;
    padding: 0.35rem 0.65rem;
    border-radius: 0.45rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-chip-option.is-chosen {
    background: rgba(139, 92, 246, 0.25);
    border-color: rgba(139, 92, 246, 0.6);
    color: #c084fc;
  }

  .filter-sheet-select {
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #f1f5f9;
    font-size: 0.8rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    outline: none;
    width: 100%;
  }

  .filter-sheet-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 1.15rem max(0.85rem, env(safe-area-inset-bottom, 0.85rem));
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: #090d16;
    gap: 0.75rem;
  }

  .btn-sheet-clear {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #94a3b8;
    font-size: 0.76rem;
    font-weight: 600;
    padding: 0.5rem 0.85rem;
    border-radius: 0.5rem;
    cursor: pointer;
  }

  .btn-sheet-apply {
    background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
    border: 1px solid rgba(168, 85, 247, 0.4);
    color: #fff;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 0.5rem 1.15rem;
    border-radius: 0.5rem;
    cursor: pointer;
    flex: 1;
  }

  /* ========================================================================= */
  /* RESPONSIVE DESIGN (Android 320px - 430px & Tablets)                       */
  /* ========================================================================= */
  @media (max-width: 1024px) {
    .calendar-workspace-layout {
      grid-template-columns: 1fr;
    }

    .calendar-side-column {
      display: none; /* Complementary widgets collapse on tablet/mobile */
    }
  }

  @media (max-width: 768px) {
    .scan-calendar-hub {
      gap: 0.55rem;
    }

    .calendar-top-header {
      padding: 0.65rem 0.85rem;
      flex-direction: column;
      align-items: stretch;
      gap: 0.65rem;
    }

    .header-branding-block {
      justify-content: space-between;
    }

    .calendar-subtitle {
      display: none; /* Hide subtitle on mobile for maximum vertical efficiency */
    }

    .calendar-icon-orb {
      width: 30px;
      height: 30px;
    }

    .calendar-title {
      font-size: 0.95rem;
    }

    .month-nav-cluster {
      justify-content: space-between;
      width: 100%;
    }

    .desktop-only-txt {
      display: none;
    }

    .current-month-display {
      padding: 0 0.4rem;
      font-size: 0.82rem;
    }

    /* Filters: Mobile dedicated controls */
    .desktop-only-filters {
      display: none !important;
    }

    .mobile-filter-controls {
      display: flex;
      flex-direction: column;
      width: 100%;
      gap: 0.35rem;
    }

    .calendar-filters-bar {
      padding: 0.45rem 0.65rem;
      flex-wrap: wrap;
    }

    /* Grid adjustments for mobile */
    .matrix-day-cell {
      min-height: 52px;
      max-height: 70px;
      padding: 0.25rem 0.2rem;
      gap: 0.15rem;
    }

    .cell-day-num {
      font-size: 0.72rem;
    }

    .cell-today-pill {
      font-size: 0.55rem;
      padding: 0.05rem 0.25rem;
    }

    /* Hide desktop multi-line cards on mobile */
    .desktop-events-stack {
      display: none;
    }

    /* SHOW MOBILE AVATARS STRIP ON MOBILE */
    .mobile-day-cell-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2rem;
      width: 100%;
      margin-top: auto;
    }

    .mobile-avatars-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.15rem;
    }

    .mobile-cell-avatar {
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }

    .mobile-overflow-count {
      font-size: 0.58rem;
      font-weight: 700;
      color: #c084fc;
      line-height: 1;
    }

    .mobile-pips-strip {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.15rem;
    }

    .mobile-stage-pip {
      width: 4px;
      height: 4px;
      border-radius: 50%;
    }

    /* Mobile Day Active Preview Strip */
    .mobile-day-preview-strip {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      padding: 0.65rem 0.75rem;
      background: rgba(15, 23, 42, 0.85);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }

    .preview-strip-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .preview-header-left {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .preview-day-title {
      font-size: 0.76rem;
      font-weight: 700;
      color: #f1f5f9;
    }

    .btn-view-drawer-trigger {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      background: transparent;
      border: none;
      color: #a855f7;
      font-size: 0.72rem;
      font-weight: 600;
      cursor: pointer;
    }

    .preview-empty-note {
      font-size: 0.72rem;
      color: #64748b;
      font-style: italic;
      line-height: 1.35;
    }

    .preview-items-row {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .preview-mini-card {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 0.45rem;
      padding: 0.4rem 0.55rem;
      cursor: pointer;
      text-align: left;
    }

    .preview-mini-card:active {
      background: rgba(139, 92, 246, 0.15);
    }

    .preview-card-avatar {
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }

    .preview-card-text {
      display: flex;
      flex-direction: column;
      gap: 0.12rem;
      min-width: 0;
      flex: 1;
    }

    .preview-work-line {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      min-width: 0;
    }

    .preview-work-name {
      font-size: 0.76rem;
      font-weight: 700;
      color: #f8fafc;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .preview-chapter-badge {
      font-size: 0.65rem;
      color: #cbd5e1;
      background: rgba(255, 255, 255, 0.08);
      padding: 0.05rem 0.3rem;
      border-radius: 0.25rem;
      font-weight: 600;
    }

    .preview-meta-line {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .preview-stage-tag {
      font-size: 0.66rem;
      font-weight: 600;
      color: var(--st-c, #a855f7);
    }

    .preview-status-pill {
      font-size: 0.62rem;
      font-weight: 700;
      padding: 0.05rem 0.3rem;
      border-radius: 0.25rem;
    }

    .preview-status-pill.in-progress {
      background: rgba(139, 92, 246, 0.15);
      color: #c084fc;
    }

    .preview-status-pill.due-soon {
      background: rgba(245, 158, 11, 0.18);
      color: #fbbf24;
    }

    .preview-status-pill.done {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
    }

    .preview-status-pill.overdue {
      background: rgba(239, 68, 68, 0.18);
      color: #fca5a5;
    }

    .preview-status-pill.extended {
      background: rgba(6, 182, 212, 0.18);
      color: #22d3ee;
    }

    /* Day Drawer becomes Bottom Sheet on Android */
    .drawer-backdrop {
      align-items: flex-end;
    }

    .day-drawer-panel {
      max-width: 100%;
      height: auto;
      max-height: 85vh;
      border-left: none;
      border-top: 1px solid rgba(139, 92, 246, 0.35);
      border-radius: 1.15rem 1.15rem 0 0;
      animation: sheetSlideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes sheetSlideUp {
      from {
        transform: translateY(100%);
      }
      to {
        transform: translateY(0);
      }
    }

    .drawer-header {
      padding: 1rem 1rem 0.75rem;
    }

    .drawer-scroll-body {
      padding: 0.85rem 1rem max(1rem, env(safe-area-inset-bottom, 1rem));
    }

    .card-details-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 360px) {
    .matrix-day-cell {
      min-height: 48px;
      padding: 0.2rem 0.15rem;
    }

    .cell-day-num {
      font-size: 0.68rem;
    }
  }
</style>
