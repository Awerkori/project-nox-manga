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
    ChevronUp,
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
    Users,
    Info,
    CalendarCheck,
    Lock
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

  // Modals & Bottom Sheets State
  let showBottomSheet = $state(false);
  let bottomSheetItem = $state<any>(null);
  let showExtensionModal = $state(false);
  let extensionTargetItem = $state<any>(null);
  let isExtending = $state(false);
  let extensionFeedback = $state<{ type: 'success' | 'error'; message: string } | null>(null);

  // Contextual Panel expanded accordion state (on desktop)
  let contextPanelExpandedId = $state<string | null>(null);

  // Notes editing state
  let editingNoteId = $state<string | null>(null);
  let noteTextDraft = $state('');
  let isSavingNote = $state(false);

  // Quick filter helpers
  function toggleMineFilter() {
    filterAssigneeId = filterAssigneeId === 'MINE' ? 'ALL' : 'MINE';
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

  // Canonical Stage Colors & Names
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
    const nowMs = Date.now();

    // 1. Editorial Pipeline Stages
    for (const cs of chapterStages) {
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
      let extensionState: 'LOCKED' | 'AVAILABLE' | 'EXTENDED' | 'EXPIRED' | 'NONE' = 'NONE';
      let unlockDateTimeStr = '';
      let extendedDateTimeStr = '';
      let isMine = cs.assigned_to === currentUserId;
      let canUserExtend = isMine || ['ADMIN', 'OWNER'].includes(userRole);

      if (cs.due_at) {
        const dueSp = getSaoPauloDate(cs.due_at);
        dueYMD = formatYMD(dueSp);
        const dueMs = new Date(cs.due_at).getTime();
        const diffMs = dueMs - nowMs;
        remainingHours = Math.round(diffMs / (1000 * 60 * 60));
        isOverdue = diffMs < 0 && cs.status !== 'DONE';
        isDueSoon = !isOverdue && cs.status === 'IN_PROGRESS' && remainingHours <= 24;

        const extensionCount = Number(cs.extension_count || 0);

        if (cs.status === 'DONE') {
          extensionState = 'NONE';
        } else if (extensionCount > 0) {
          // Estado C: Prorrogação utilizada
          extensionState = 'EXTENDED';
          const day = String(dueSp.getDate()).padStart(2, '0');
          const month = String(dueSp.getMonth() + 1).padStart(2, '0');
          const hours = String(dueSp.getHours()).padStart(2, '0');
          const minutes = String(dueSp.getMinutes()).padStart(2, '0');
          extendedDateTimeStr = `${day}/${month} às ${hours}:${minutes}`;
        } else if (diffMs < -(4 * 60 * 60 * 1000)) {
          extensionState = 'EXPIRED';
        } else if (remainingHours <= 24 || dueYMD === todayYMD) {
          // Estado B: Nas últimas 24 horas (ou vencendo hoje)
          extensionState = 'AVAILABLE';
        } else {
          // Estado A: Antes das últimas 24 horas
          extensionState = 'LOCKED';
          const unlockMs = dueMs - 24 * 60 * 60 * 1000;
          const unlockSp = getSaoPauloDate(unlockMs);
          const ud = String(unlockSp.getDate()).padStart(2, '0');
          const um = String(unlockSp.getMonth() + 1).padStart(2, '0');
          const uh = String(unlockSp.getHours()).padStart(2, '0');
          const umin = String(unlockSp.getMinutes()).padStart(2, '0');
          unlockDateTimeStr = `${ud}/${um} às ${uh}:${umin}`;
        }
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
        status: cs.status,
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
        extensionState,
        unlockDateTimeStr,
        extendedDateTimeStr,
        isMine,
        canUserExtend
      });
    }

    // 2. Generic Scan Tasks with due_at
    for (const t of tasks) {
      if (!t.due_at && !t.completed_at) continue;
      const targetDate = t.due_at || t.completed_at;
      const dueSp = getSaoPauloDate(targetDate);
      const dueYMD = formatYMD(dueSp);
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
        extensionCount: 0,
        extendedAt: null,
        notes: t.description || '',
        completedAt: t.completed_at,
        isOverdue,
        isDueSoon,
        remainingHours: Math.round(diffMs / (1000 * 60 * 60)),
        extensionState: 'NONE',
        unlockDateTimeStr: '',
        extendedDateTimeStr: '',
        isMine: t.assigned_to === currentUserId,
        canUserExtend: false
      });
    }

    return list;
  });

  // Filtered commitments based on active filters
  let filteredCommitments = $derived.by(() => {
    return allCommitments.filter((item) => {
      // Stage filter
      if (filterStageSlug !== 'ALL' && item.stageSlug !== filterStageSlug) {
        return false;
      }
      // Assignee filter
      if (filterAssigneeId === 'MINE') {
        if (item.assignedTo !== currentUserId) return false;
      } else if (filterAssigneeId !== 'ALL') {
        if (item.assignedTo !== filterAssigneeId) return false;
      }
      // Status filter
      if (filterStatus === 'IN_PROGRESS' && item.status !== 'IN_PROGRESS') return false;
      if (filterStatus === 'DUE_SOON' && !item.isDueSoon) return false;
      if (filterStatus === 'DONE' && item.status !== 'DONE') return false;
      if (filterStatus === 'OVERDUE' && !item.isOverdue) return false;
      if (filterStatus === 'EXTENDED' && item.extensionCount === 0) return false;

      return true;
    });
  });

  // Group commitments by YMD date
  let commitmentsByDateMap = $derived.by(() => {
    const map = new Map<string, any[]>();
    for (const item of filteredCommitments) {
      if (!item.dueYMD) continue;
      if (!map.has(item.dueYMD)) map.set(item.dueYMD, []);
      map.get(item.dueYMD)!.push(item);
    }
    return map;
  });

  // Group site publications by YMD date
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

  // Dynamic Month Matrix (4, 5, or 6 weeks)
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
    }> = [];

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

    // Leading days
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
        publications: pubs
      });
    }

    // Current month days
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
        publications: pubs
      });
    }

    // Trailing days
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
          publications: pubs
        });
      }
    }

    return cells;
  });

  // Selected Day Commitments
  let selectedDayCommitments = $derived(commitmentsByDateMap.get(selectedDateYMD) || []);

  // Formatted date header for selected day
  let formattedSelectedDayHeader = $derived.by(() => {
    if (!selectedDateYMD) return '';
    const [y, m, d] = selectedDateYMD.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const formatted = dateObj.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  });

  // Next relevant delivery (Fallback for Contextual Panel when selected date has no commitments)
  let nextRelevantDelivery = $derived.by(() => {
    const nowMs = Date.now();
    // 1. Current user's closest upcoming delivery
    const myUpcoming = allCommitments
      .filter((c) => c.assignedTo === currentUserId && c.status === 'IN_PROGRESS' && c.dueAt)
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

    if (myUpcoming.length > 0) {
      const futureOrToday = myUpcoming.find((c) => new Date(c.dueAt).getTime() >= nowMs - (24 * 60 * 60 * 1000));
      return futureOrToday || myUpcoming[0];
    }

    // 2. Scan's closest upcoming delivery
    const teamUpcoming = allCommitments
      .filter((c) => c.status === 'IN_PROGRESS' && c.dueAt)
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

    if (teamUpcoming.length > 0) {
      const futureOrToday = teamUpcoming.find((c) => new Date(c.dueAt).getTime() >= nowMs - (24 * 60 * 60 * 1000));
      return futureOrToday || teamUpcoming[0];
    }

    // 3. Any pending item
    return allCommitments.find((c) => c.status === 'IN_PROGRESS') || null;
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

  // Format proposed new date (+2 days at 23:59 SP)
  function formatProposedExtendedDisplay(dueAt?: string): string {
    if (!dueAt) return '--';
    const sp = getSaoPauloDate(dueAt);
    const target = new Date(sp);
    target.setDate(target.getDate() + 2);
    const day = String(target.getDate()).padStart(2, '0');
    const month = String(target.getMonth() + 1).padStart(2, '0');
    return `${day}/${month} às 23:59`;
  }

  // Active filter chips for quick removal
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
        label: `Membro: ${name}`,
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
    const dayCommitments = commitmentsByDateMap.get(ymd) || [];
    if (dayCommitments.length === 1) {
      contextPanelExpandedId = dayCommitments[0].id;
    } else if (dayCommitments.length > 1) {
      contextPanelExpandedId = dayCommitments[0].id;
    } else {
      contextPanelExpandedId = null;
    }
  }

  // Handler for Mobile Delivery Click -> Opens Bottom Sheet
  function handleOpenDeliveryBottomSheet(item: any) {
    bottomSheetItem = item;
    showBottomSheet = true;
  }

  function toggleContextPanelExpansion(itemId: string) {
    contextPanelExpandedId = contextPanelExpandedId === itemId ? null : itemId;
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
  <!-- 1. COMPACT TOP HEADER -->
  <header class="calendar-top-header">
    <div class="header-branding-block">
      <div class="calendar-icon-orb">
        <CalendarIcon size={18} />
      </div>
      <div class="branding-text">
        <h1 class="calendar-title">Calendário da Scan</h1>
      </div>
    </div>

    <!-- Month Navigation + Today + View Mode Segmented Control -->
    <div class="month-nav-cluster">
      <div class="nav-btn-group">
        <button
          type="button"
          class="btn-month-nav"
          onclick={prevMonth}
          aria-label="Mês anterior"
          title="Mês anterior"
        >
          <ChevronLeft size={15} />
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
          <ChevronRight size={15} />
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

      <!-- View Switcher: Mês / Agenda -->
      <div class="view-toggle-segmented" role="radiogroup" aria-label="Visualização">
        <button
          type="button"
          class="toggle-opt-btn"
          class:active={activeViewMode === 'MONTH'}
          onclick={() => (activeViewMode = 'MONTH')}
          title="Visão Mensal"
        >
          <Grid size={13} />
          <span>Mês</span>
        </button>
        <button
          type="button"
          class="toggle-opt-btn"
          class:active={activeViewMode === 'AGENDA'}
          onclick={() => (activeViewMode = 'AGENDA')}
          title="Visão Agenda"
        >
          <Layers size={13} />
          <span>Agenda</span>
        </button>
      </div>
    </div>
  </header>

  <!-- 2. STREAMLINED HORIZONTAL FILTER BAR -->
  <section class="calendar-filters-bar" aria-label="Filtros do Calendário">
    <!-- Desktop Filter Dropdowns (>= 768px) -->
    <div class="filters-left-group desktop-only-filters">
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
          <option value="DUE_SOON">Vence em breve (&le;24h)</option>
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
          <X size={12} />
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
            <X size={11} />
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

    <!-- Total Commitments Counter (Desktop) -->
    <div class="filters-right-meta desktop-only-filters">
      <span class="commitments-stat-pill">
        <strong>{filteredCommitments.length}</strong> compromisso{filteredCommitments.length === 1 ? '' : 's'}
      </span>
    </div>
  </section>

  <!-- 3. UNIFIED DESKTOP & MOBILE WORKSPACE -->
  <div class="calendar-workspace-layout">
    <!-- LEFT / MAIN: MONTH GRID OR AGENDA VIEW -->
    <main class="calendar-primary-container">
      {#if activeViewMode === 'MONTH'}
        <div class="calendar-monthly-card">
          <!-- Weekday Labels Header -->
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
                <!-- Day Cell Top Bar -->
                <div class="cell-top-bar">
                  <span class="cell-day-num">{cell.dayNumber}</span>
                  {#if cell.isToday}
                    <span class="cell-today-pill">Hoje</span>
                  {/if}
                </div>

                <!-- DESKTOP EVENT CARDS (Level 1 Essential Info) -->
                <div class="desktop-events-stack">
                  {#each cell.commitments.slice(0, 2) as item}
                    <div
                      class="day-event-card {item.statusClass}"
                      style="--stage-accent: {item.stageColor}"
                      title="{item.workTitle} #{item.chapterNumber} • {item.stageName} • {item.assignee?.display_name || item.assignee?.username || 'Membro'}"
                      onclick={(e) => { e.stopPropagation(); handleSelectDay(cell.ymd); contextPanelExpandedId = item.id; }}
                      role="button"
                      tabindex="0"
                      onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleSelectDay(cell.ymd); contextPanelExpandedId = item.id; } }}
                    >
                      <div class="event-card-top-row">
                        <span class="event-stage-tag">{item.stageName}</span>
                        <span class="event-work-text">{item.workTitle} #{item.chapterNumber}</span>
                        {#if item.extensionCount > 0 && item.status !== 'DONE'}
                          <span class="event-ext-tag">+2d</span>
                        {/if}
                        {#if item.status === 'DONE'}
                          <Check size={10} class="event-done-icon" />
                        {/if}
                      </div>
                      <div class="event-card-sub-row">
                        <div class="event-avatar-wrap">
                          <UserAvatar user={item.assignee} size={15} />
                        </div>
                        <span class="event-user-text">
                          {item.assignee?.display_name || item.assignee?.username || 'Membro'}
                        </span>
                      </div>
                    </div>
                  {/each}

                  <!-- Overflow indicator if > 2 items -->
                  {#if cell.commitments.length > 2}
                    <div class="event-overflow-pill">
                      <span>+{cell.commitments.length - 2} entregas</span>
                    </div>
                  {/if}

                  <!-- Site publication indicator -->
                  {#each cell.publications.slice(0, 1) as pub}
                    <div class="publication-badge-pill" title="Publicado: {pub.works?.title || 'Obra'} #{pub.number}">
                      <Sparkles size={9} />
                      <span>Pub. #{pub.number}</span>
                    </div>
                  {/each}
                </div>

                <!-- ANDROID / MOBILE CELL CONTENT: CLEAN DOTS / AVATAR LOCKUP -->
                <div class="mobile-day-cell-content">
                  {#if cell.uniqueAssignees.length > 0}
                    <div class="mobile-avatar-lockup">
                      <div class="mobile-cell-avatar">
                        <UserAvatar user={cell.uniqueAssignees[0]} size={20} />
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

          <!-- ANDROID / MOBILE: COMPACT DAY PREVIEW DIRECTLY BELOW GRID -->
          <div class="mobile-day-preview-strip">
            <div class="preview-strip-header">
              <div class="preview-header-left">
                <CalendarIcon size={14} class="text-purple-400" />
                <span class="preview-day-title">Compromissos ({selectedDayCommitments.length})</span>
                <span class="preview-date-sub">{formattedSelectedDayHeader}</span>
              </div>
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
                    onclick={() => handleOpenDeliveryBottomSheet(item)}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) => { if (e.key === 'Enter') handleOpenDeliveryBottomSheet(item); }}
                  >
                    <div class="preview-card-avatar">
                      <UserAvatar user={item.assignee} size={24} />
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
        <!-- AGENDA VIEW: ULTRA-COMPACT HIGH-DENSITY CHRONOLOGICAL LIST -->
        <div class="agenda-view-wrapper">
          <div class="agenda-header-strip">
            <div class="agenda-header-left">
              <Layers size={16} class="text-cyan-400" />
              <h2 class="agenda-heading">Compromissos em Ordem Cronológica</h2>
            </div>
            <span class="agenda-count-badge">{filteredCommitments.length} entregas</span>
          </div>

          {#if filteredCommitments.length === 0}
            <div class="agenda-empty-state">
              <CheckCircle2 size={32} class="text-emerald-400" />
              <p>Nenhuma entrega encontrada para os filtros selecionados.</p>
            </div>
          {:else}
            <div class="agenda-list-stack">
              {#each filteredCommitments as item}
                <article
                  class="agenda-compact-row {item.statusClass}"
                  onclick={() => {
                    handleSelectDay(item.dueYMD || todayYMD);
                    contextPanelExpandedId = item.id;
                    if (typeof window !== 'undefined' && window.innerWidth < 768) {
                      handleOpenDeliveryBottomSheet(item);
                    }
                  }}
                  role="button"
                  tabindex="0"
                  onkeydown={(e) => { if (e.key === 'Enter') handleSelectDay(item.dueYMD || todayYMD); }}
                >
                  <div class="agenda-date-badge">
                    <span class="agenda-date-day">{item.dueYMD ? item.dueYMD.split('-')[2] : '--'}</span>
                    <span class="agenda-date-mon">{item.dueYMD ? MONTH_NAMES[Number(item.dueYMD.split('-')[1]) - 1].slice(0, 3) : ''}</span>
                  </div>

                  <div class="agenda-info-cluster">
                    <div class="agenda-title-line">
                      <strong class="agenda-work-name">{item.workTitle}</strong>
                      {#if item.chapterNumber}
                        <span class="agenda-ch-tag">#{item.chapterNumber}</span>
                      {/if}
                      <span class="agenda-stage-tag" style="--st-c: {item.stageColor}">
                        <span class="st-dot"></span>
                        {item.stageName}
                      </span>
                    </div>

                    <div class="agenda-sub-meta">
                      {#if item.assignee}
                        <div class="agenda-user-mini">
                          <UserAvatar user={item.assignee} size={15} />
                          <span>{item.assignee.display_name || item.assignee.username}</span>
                        </div>
                      {/if}
                      <span class="agenda-status-tag {item.statusClass}">{item.statusLabel}</span>
                      {#if item.extensionCount > 0}
                        <span class="agenda-ext-pill">+2d</span>
                      {/if}
                    </div>
                  </div>

                  <div class="agenda-action-zone">
                    <span class="agenda-arrow"><ArrowRight size={13} /></span>
                  </div>
                </article>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </main>

    <!-- RIGHT: SINGLE UNIFIED CONTEXTUAL PANEL (Desktop >= 1024px) -->
    <aside class="calendar-contextual-panel" aria-label="Painel Contextual do Dia">
      <header class="context-panel-header">
        <div class="context-header-titles">
          <CalendarIcon size={16} class="text-purple-400" />
          <h2 class="context-title">{formattedSelectedDayHeader}</h2>
        </div>
        <span class="context-count-tag">
          {selectedDayCommitments.length} {selectedDayCommitments.length === 1 ? 'entrega' : 'entregas'}
        </span>
      </header>

      <div class="context-panel-body">
        {#if selectedDayCommitments.length > 0}
          <!-- COMMITMENTS FOR SELECTED DAY -->
          <div class="context-commitments-stack">
            {#each selectedDayCommitments as item}
              {@const isExpanded = selectedDayCommitments.length === 1 || contextPanelExpandedId === item.id}
              <div class="context-delivery-card {item.statusClass}" class:is-expanded={isExpanded}>
                <!-- Accordion Header when multiple items exist -->
                {#if selectedDayCommitments.length > 1}
                  <button
                    type="button"
                    class="context-accordion-bar"
                    onclick={() => toggleContextPanelExpansion(item.id)}
                  >
                    <div class="accordion-bar-left">
                      <UserAvatar user={item.assignee} size={20} />
                      <div class="accordion-bar-text">
                        <strong class="accordion-work">{item.workTitle} #{item.chapterNumber}</strong>
                        <span class="accordion-stage" style="--st-c: {item.stageColor}">{item.stageName}</span>
                      </div>
                    </div>
                    <div class="accordion-bar-right">
                      <span class="accordion-status {item.statusClass}">{item.statusLabel}</span>
                      <span class="accordion-chevron">
                        {#if isExpanded}<ChevronUp size={14} />{:else}<ChevronDown size={14} />{/if}
                      </span>
                    </div>
                  </button>
                {/if}

                <!-- Expanded Delivery Details (Level 2 Contextual) -->
                {#if isExpanded}
                  <div class="context-expanded-content">
                    <!-- Section 1: Obra, Capítulo e Etapa -->
                    <div class="ctx-header-cluster">
                      <div class="ctx-cover-box">
                        {#if item.workCoverId}
                          <img src="/media/{item.workCoverId}" alt={item.workTitle} class="ctx-cover-img" loading="lazy" />
                        {:else}
                          <div class="ctx-cover-fallback"><Briefcase size={14} /></div>
                        {/if}
                      </div>
                      <div class="ctx-titles-col">
                        <h3 class="ctx-work-title">{item.workTitle}</h3>
                        <div class="ctx-badges-row">
                          {#if item.chapterNumber}
                            <span class="ctx-chapter-badge">Capítulo #{item.chapterNumber}</span>
                          {/if}
                          <span class="ctx-stage-badge" style="--st-c: {item.stageColor}">
                            <span class="st-dot"></span>
                            {item.stageName}
                          </span>
                        </div>
                      </div>
                    </div>

                    <!-- Section 2: Responsável e Status -->
                    <div class="ctx-meta-grid">
                      <div class="ctx-meta-cell">
                        <span class="ctx-label">Responsável</span>
                        <div class="ctx-user-lockup">
                          <UserAvatar user={item.assignee} size={18} />
                          <span class="ctx-username">{item.assignee?.display_name || item.assignee?.username || 'Membro da equipe'}</span>
                        </div>
                      </div>
                      <div class="ctx-meta-cell">
                        <span class="ctx-label">Situação</span>
                        <span class="ctx-status-pill {item.statusClass}">
                          {#if item.status === 'DONE'}<Check size={11} />{:else if item.isOverdue}<AlertTriangle size={11} />{:else}<Clock size={11} />{/if}
                          {item.statusLabel}
                        </span>
                      </div>
                    </div>

                    <!-- Section 3: Prazo e Tempo Restante -->
                    <div class="ctx-deadline-row">
                      <div class="ctx-deadline-col">
                        <span class="ctx-label">Prazo vigente</span>
                        <strong class="ctx-due-val">{formatDueDisplay(item.dueAt)}</strong>
                      </div>
                      {#if item.status !== 'DONE'}
                        <span class="ctx-remaining-badge {item.statusClass}">
                          {getRemainingText(item)}
                        </span>
                      {/if}
                    </div>

                    <!-- Section 4: Ação de Prorrogação de Prazo (Strictly States A, B, C) -->
                    {#if item.kind === 'EDITORIAL_STAGE'}
                      <div class="ctx-extension-section">
                        {#if item.extensionState === 'EXTENDED'}
                          <!-- Estado C: Prorrogação utilizada -->
                          <div class="ext-discreet-confirmation">
                            <Check size={13} class="text-emerald-400" />
                            <span>Prazo prorrogado até {item.extendedDateTimeStr || formatDueDisplay(item.dueAt)}.</span>
                          </div>
                        {:else if item.extensionState === 'AVAILABLE'}
                          <!-- Estado B: Nas últimas 24 horas (Habilitado) -->
                          <button
                            type="button"
                            class="btn-extension-action available"
                            onclick={() => openExtensionModal(item)}
                            title="Prorrogar prazo em +2 dias"
                          >
                            <Zap size={14} />
                            <span>⚡ Prorrogar +2 dias</span>
                          </button>
                        {:else if item.extensionState === 'LOCKED'}
                          <!-- Estado A: Antes das últimas 24 horas (Desabilitado + Info) -->
                          <div class="ext-locked-cluster">
                            <button
                              type="button"
                              class="btn-extension-action locked"
                              disabled
                              title="Disponível a partir de {item.unlockDateTimeStr}"
                            >
                              <Lock size={13} />
                              <span>Prorrogar prazo em +2 dias</span>
                            </button>
                            <p class="ext-helper-note">
                              <Info size={11} class="text-cyan-400" />
                              <span>Disponível a partir de {item.unlockDateTimeStr}.</span>
                            </p>
                          </div>
                        {/if}
                      </div>
                    {/if}

                    <!-- Section 5: Observações com Edição Inline -->
                    <div class="ctx-notes-section">
                      <div class="ctx-notes-header">
                        <span class="ctx-label">Observações</span>
                        {#if item.canUserExtend && editingNoteId !== item.id}
                          <button
                            type="button"
                            class="btn-edit-note"
                            onclick={() => startEditingNote(item)}
                          >
                            <Edit3 size={11} />
                            <span>{item.notes ? 'Editar' : 'Adicionar'}</span>
                          </button>
                        {/if}
                      </div>

                      {#if editingNoteId === item.id}
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
                          class="ctx-note-form"
                        >
                          <input type="hidden" name="chapter_stage_id" value={item.id} />
                          <textarea
                            name="notes"
                            bind:value={noteTextDraft}
                            maxlength="500"
                            rows="2"
                            class="ctx-note-textarea"
                            placeholder="Adicione anotações sobre o andamento..."
                          ></textarea>
                          <div class="ctx-note-actions">
                            <button type="button" class="btn-note-cancel" onclick={cancelEditingNote} disabled={isSavingNote}>
                              Cancelar
                            </button>
                            <button type="submit" class="btn-note-save" disabled={isSavingNote}>
                              {#if isSavingNote}<span>Salvando...</span>{:else}<Check size={11} /><span>Salvar</span>{/if}
                            </button>
                          </div>
                        </form>
                      {:else}
                        <p class="ctx-notes-body" class:is-empty={!item.notes}>
                          {item.notes ? `"${item.notes}"` : 'Nenhuma observação registrada.'}
                        </p>
                      {/if}
                    </div>

                    <!-- Section 6: Ação Principal e Metadados Secundários -->
                    <div class="ctx-actions-footer">
                      {#if item.productionChapter && onOpenChapter}
                        <button
                          type="button"
                          class="btn-open-in-prod"
                          onclick={() => onOpenChapter(item.productionChapter)}
                        >
                          <span>Abrir na Produção</span>
                          <ArrowRight size={12} />
                        </button>
                      {/if}
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <!-- EMPTY STATE FOR SELECTED DAY + PROXIMA ENTREGA RELEVANTE -->
          <div class="context-empty-wrapper">
            <div class="context-empty-notice">
              <CalendarCheck size={28} class="text-slate-500" />
              <p class="empty-headline">Nenhum compromisso para este dia.</p>
              <p class="empty-subline">Selecione outra data no calendário para ver as entregas agendadas.</p>
            </div>

            {#if nextRelevantDelivery}
              <div class="next-relevant-card">
                <span class="next-relevant-eyebrow">Próxima entrega relevante:</span>
                <div class="next-relevant-box">
                  <div class="next-relevant-top">
                    <strong class="next-work-title">{nextRelevantDelivery.workTitle} #{nextRelevantDelivery.chapterNumber}</strong>
                    <span class="ctx-stage-badge" style="--st-c: {nextRelevantDelivery.stageColor}">
                      {nextRelevantDelivery.stageName}
                    </span>
                  </div>
                  <div class="next-relevant-meta">
                    <span class="next-due-txt">Prazo: {formatDueDisplay(nextRelevantDelivery.dueAt)}</span>
                    <span class="ctx-status-pill {nextRelevantDelivery.statusClass}">{nextRelevantDelivery.statusLabel}</span>
                  </div>
                  <button
                    type="button"
                    class="btn-jump-to-date"
                    onclick={() => handleSelectDay(nextRelevantDelivery.dueYMD || todayYMD)}
                  >
                    <span>Ver no calendário</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </aside>
  </div>
</div>

<!-- ========================================================================= -->
<!-- 4. DEDICATED ANDROID BOTTOM SHEET (Organized into 6 Strict Sections)       -->
<!-- ========================================================================= -->
{#if showBottomSheet && bottomSheetItem}
  <div
    class="bottom-sheet-backdrop"
    onclick={(e) => {
      if (e.target === e.currentTarget) showBottomSheet = false;
    }}
    role="dialog"
    aria-modal="true"
    aria-label="Detalhes da entrega"
  >
    <div class="bottom-sheet-panel">
      <!-- Drag handle -->
      <div class="sheet-drag-handle"></div>

      <!-- Sheet Header -->
      <header class="sheet-header">
        <div class="sheet-title-col">
          <span class="sheet-eyebrow">Detalhes do Compromisso</span>
          <h3 class="sheet-title">{bottomSheetItem.workTitle} #{bottomSheetItem.chapterNumber}</h3>
        </div>
        <button
          type="button"
          class="btn-close-sheet"
          onclick={() => (showBottomSheet = false)}
          aria-label="Fechar"
        >
          <X size={16} />
        </button>
      </header>

      <!-- Sheet Scrollable Content (6 Organized Sections) -->
      <div class="sheet-scroll-body">
        <!-- 1. Obra, capítulo e etapa -->
        <section class="sheet-section">
          <div class="sheet-work-banner">
            <div class="sheet-cover-box">
              {#if bottomSheetItem.workCoverId}
                <img src="/media/{bottomSheetItem.workCoverId}" alt={bottomSheetItem.workTitle} class="sheet-cover-img" loading="lazy" />
              {:else}
                <div class="sheet-cover-fallback"><Briefcase size={16} /></div>
              {/if}
            </div>
            <div class="sheet-work-meta">
              <span class="sheet-work-name">{bottomSheetItem.workTitle}</span>
              <div class="sheet-pills-row">
                {#if bottomSheetItem.chapterNumber}
                  <span class="sheet-ch-pill">Capítulo #{bottomSheetItem.chapterNumber}</span>
                {/if}
                <span class="sheet-stage-pill" style="--st-c: {bottomSheetItem.stageColor}">
                  <span class="st-dot"></span>
                  {bottomSheetItem.stageName}
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- 2. Responsável e status -->
        <section class="sheet-section">
          <div class="sheet-grid-two">
            <div class="sheet-meta-cell">
              <span class="sheet-label">Responsável</span>
              <div class="sheet-user-lockup">
                <UserAvatar user={bottomSheetItem.assignee} size={18} />
                <span class="sheet-username">{bottomSheetItem.assignee?.display_name || bottomSheetItem.assignee?.username || 'Membro'}</span>
              </div>
            </div>
            <div class="sheet-meta-cell">
              <span class="sheet-label">Situação</span>
              <span class="sheet-status-pill {bottomSheetItem.statusClass}">
                {#if bottomSheetItem.status === 'DONE'}<Check size={11} />{:else if bottomSheetItem.isOverdue}<AlertTriangle size={11} />{:else}<Clock size={11} />{/if}
                {bottomSheetItem.statusLabel}
              </span>
            </div>
          </div>
        </section>

        <!-- 3. Prazo e tempo restante -->
        <section class="sheet-section">
          <div class="sheet-deadline-banner">
            <div class="sheet-deadline-left">
              <span class="sheet-label">Prazo vigente</span>
              <strong class="sheet-due-text">{formatDueDisplay(bottomSheetItem.dueAt)}</strong>
            </div>
            {#if bottomSheetItem.status !== 'DONE'}
              <span class="sheet-time-badge {bottomSheetItem.statusClass}">
                {getRemainingText(bottomSheetItem)}
              </span>
            {/if}
          </div>
        </section>

        <!-- 4. Ação de prorrogação (Strictly States A, B, C) -->
        {#if bottomSheetItem.kind === 'EDITORIAL_STAGE'}
          <section class="sheet-section">
            <span class="sheet-label">Prorrogação de prazo (+2 dias)</span>
            <div class="sheet-extension-box">
              {#if bottomSheetItem.extensionState === 'EXTENDED'}
                <!-- Estado C: Prorrogação utilizada -->
                <div class="sheet-ext-confirmation">
                  <Check size={14} class="text-emerald-400" />
                  <span>Prazo prorrogado até {bottomSheetItem.extendedDateTimeStr || formatDueDisplay(bottomSheetItem.dueAt)}.</span>
                </div>
              {:else if bottomSheetItem.extensionState === 'AVAILABLE'}
                <!-- Estado B: Nas últimas 24 horas -->
                <button
                  type="button"
                  class="btn-sheet-extend available"
                  onclick={() => openExtensionModal(bottomSheetItem)}
                >
                  <Zap size={14} />
                  <span>⚡ Prorrogar +2 dias</span>
                </button>
              {:else if bottomSheetItem.extensionState === 'LOCKED'}
                <!-- Estado A: Antes das últimas 24 horas -->
                <div class="sheet-ext-locked">
                  <button type="button" class="btn-sheet-extend locked" disabled>
                    <Lock size={13} />
                    <span>Prorrogar prazo em +2 dias</span>
                  </button>
                  <p class="sheet-ext-note">
                    <Info size={11} class="text-cyan-400" />
                    <span>Disponível a partir de {bottomSheetItem.unlockDateTimeStr}.</span>
                  </p>
                </div>
              {/if}
            </div>
          </section>
        {/if}

        <!-- 5. Observações com edição inline -->
        <section class="sheet-section">
          <div class="sheet-notes-bar">
            <span class="sheet-label">Observações</span>
            {#if bottomSheetItem.canUserExtend && editingNoteId !== bottomSheetItem.id}
              <button
                type="button"
                class="btn-edit-note"
                onclick={() => startEditingNote(bottomSheetItem)}
              >
                <Edit3 size={11} />
                <span>{bottomSheetItem.notes ? 'Editar' : 'Adicionar'}</span>
              </button>
            {/if}
          </div>

          {#if editingNoteId === bottomSheetItem.id}
            <form
              method="POST"
              action="?/updateStageNotes"
              use:enhance={() => {
                isSavingNote = true;
                return async ({ result, update }) => {
                  isSavingNote = false;
                  if (result.type === 'success') {
                    bottomSheetItem.notes = noteTextDraft;
                    editingNoteId = null;
                    await update();
                    invalidate('scan:workspace');
                  }
                };
              }}
              class="ctx-note-form"
            >
              <input type="hidden" name="chapter_stage_id" value={bottomSheetItem.id} />
              <textarea
                name="notes"
                bind:value={noteTextDraft}
                maxlength="500"
                rows="2"
                class="ctx-note-textarea"
                placeholder="Adicione anotações sobre o andamento..."
              ></textarea>
              <div class="ctx-note-actions">
                <button type="button" class="btn-note-cancel" onclick={cancelEditingNote} disabled={isSavingNote}>
                  Cancelar
                </button>
                <button type="submit" class="btn-note-save" disabled={isSavingNote}>
                  {#if isSavingNote}<span>Salvando...</span>{:else}<Check size={11} /><span>Salvar</span>{/if}
                </button>
              </div>
            </form>
          {:else}
            <p class="sheet-notes-text" class:is-empty={!bottomSheetItem.notes}>
              {bottomSheetItem.notes ? `"${bottomSheetItem.notes}"` : 'Nenhuma observação registrada.'}
            </p>
          {/if}
        </section>

        <!-- 6. Histórico e informações secundárias -->
        <section class="sheet-section">
          {#if bottomSheetItem.productionChapter && onOpenChapter}
            <button
              type="button"
              class="btn-sheet-production"
              onclick={() => {
                showBottomSheet = false;
                onOpenChapter(bottomSheetItem.productionChapter);
              }}
            >
              <span>Abrir na Produção</span>
              <ArrowRight size={13} />
            </button>
          {/if}
        </section>
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
            <Zap size={16} />
          </div>
          <div>
            <h3 id="ext-modal-title" class="ext-modal-title">Prorrogar prazo em +2 dias</h3>
            <p class="ext-modal-subtitle">Adicione 2 dias corridos ao prazo vigente desta etapa.</p>
          </div>
        </div>
        <button
          type="button"
          class="btn-close-modal"
          onclick={closeExtensionModal}
          disabled={isExtending}
          aria-label="Fechar"
        >
          <X size={15} />
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
            <AlertCircle size={13} />
            <span>{extensionFeedback.message}</span>
          </div>
        {/if}

        <div class="ext-context-box">
          <strong class="ext-work-title">
            {extensionTargetItem.workTitle} — Cap. #{extensionTargetItem.chapterNumber}
          </strong>
          <span class="ext-stage-pill" style="--st-c: {extensionTargetItem.stageColor}">
            {extensionTargetItem.stageName}
          </span>
        </div>

        <!-- Proposed Dates Comparison -->
        <div class="ext-dates-compare">
          <div class="date-compare-row">
            <span class="date-compare-label">Data atual:</span>
            <strong class="date-compare-val old">{formatDueDisplay(extensionTargetItem.dueAt)}</strong>
          </div>
          <div class="date-compare-row">
            <span class="date-compare-label">Nova data proposta:</span>
            <strong class="date-compare-val new">{formatProposedExtendedDisplay(extensionTargetItem.dueAt)} (+2 dias)</strong>
          </div>
        </div>

        <div class="ext-rules-card">
          <div class="rule-line">
            <Check size={13} class="text-emerald-400" />
            <span>Prorrogação automática sem necessidade de aprovação.</span>
          </div>
          <div class="rule-line info">
            <Info size={13} class="text-cyan-400" />
            <span>Permitido apenas 1 vez por etapa atribuída.</span>
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
              <Zap size={14} />
              <span>Confirmar +2 dias</span>
            {/if}
          </button>
        </footer>
      </form>
    </div>
  </div>
{/if}

<!-- ========================================================================= -->
<!-- 6. MOBILE FILTER BOTTOM SHEET                                             -->
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
          <Sliders size={15} class="text-purple-400" />
          <h3 class="sheet-heading">Filtros do Calendário</h3>
        </div>
        <button
          type="button"
          class="btn-close-filter-sheet"
          onclick={() => (showMobileFilterSheet = false)}
          aria-label="Fechar filtros"
        >
          <X size={16} />
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
          onclick={() => clearAllFilters()}
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
    gap: 0.75rem;
    width: 100%;
    color: #f1f5f9;
  }

  /* 1. COMPACT TOP HEADER */
  .calendar-top-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.65rem 1rem;
    background: #090d16;
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 0.85rem;
    gap: 0.85rem;
    flex-wrap: wrap;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.4);
  }

  .header-branding-block {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .calendar-icon-orb {
    width: 32px;
    height: 32px;
    border-radius: 0.55rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(139, 92, 246, 0.15);
    color: #c084fc;
    border: 1px solid rgba(139, 92, 246, 0.35);
    flex-shrink: 0;
  }

  .branding-text {
    display: flex;
    flex-direction: column;
  }

  .calendar-title {
    font-size: 1rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  .month-nav-cluster {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .nav-btn-group {
    display: inline-flex;
    align-items: center;
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.5rem;
    padding: 0.12rem;
  }

  .btn-month-nav {
    background: transparent;
    border: none;
    color: #94a3b8;
    width: 26px;
    height: 26px;
    border-radius: 0.35rem;
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
    padding: 0 0.55rem;
    font-size: 0.82rem;
    font-weight: 700;
    color: #f1f5f9;
  }

  .current-month-display .year-num {
    color: #8b5cf6;
    font-weight: 600;
  }

  .btn-today-pill {
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.3);
    color: #c084fc;
    font-size: 0.74rem;
    font-weight: 700;
    padding: 0.3rem 0.65rem;
    border-radius: 0.45rem;
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
    border-radius: 0.5rem;
    padding: 0.12rem;
  }

  .toggle-opt-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 0.74rem;
    font-weight: 600;
    padding: 0.28rem 0.55rem;
    border-radius: 0.38rem;
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
    padding: 0.45rem 0.85rem;
    background: #090d16;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 0.7rem;
    gap: 0.65rem;
    flex-wrap: wrap;
  }

  .desktop-only-filters {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .mobile-filter-controls {
    display: none;
  }

  .filters-left-group {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
  }

  .chip-filter-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 0.74rem;
    font-weight: 600;
    padding: 0.28rem 0.55rem;
    border-radius: 0.4rem;
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
    font-size: 0.74rem;
    font-weight: 500;
    padding: 0.28rem 0.55rem;
    border-radius: 0.4rem;
    outline: none;
    cursor: pointer;
  }

  .filter-native-select:focus {
    border-color: rgba(139, 92, 246, 0.5);
  }

  .btn-clear-filters {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.25rem 0.45rem;
    border-radius: 0.35rem;
    cursor: pointer;
  }

  .btn-clear-filters:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .commitments-stat-pill {
    font-size: 0.72rem;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.04);
    padding: 0.22rem 0.55rem;
    border-radius: 0.35rem;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .commitments-stat-pill strong {
    color: #c084fc;
  }

  /* 3. WORKSPACE LAYOUT: CALENDAR + SINGLE CONTEXTUAL PANEL */
  .calendar-workspace-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 370px;
    gap: 0.75rem;
    align-items: start;
  }

  .calendar-primary-container {
    min-width: 0;
  }

  /* Month Grid */
  .calendar-monthly-card {
    background: #090d16;
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 0.85rem;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  }

  .weekday-labels-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: rgba(15, 23, 42, 0.9);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .weekday-label-cell {
    padding: 0.45rem 0.35rem;
    text-align: center;
    font-size: 0.72rem;
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
    min-height: 100px;
    max-height: 130px;
    padding: 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    text-align: left;
    border: none;
    cursor: pointer;
    transition: background 0.12s ease;
    overflow: hidden;
  }

  .matrix-day-cell:hover {
    background: rgba(139, 92, 246, 0.08);
  }

  .matrix-day-cell.is-other-month {
    background: #060910;
    opacity: 0.4;
  }

  .matrix-day-cell.is-today {
    background: rgba(139, 92, 246, 0.1);
    box-shadow: inset 0 0 0 1px rgba(139, 92, 246, 0.4);
  }

  .matrix-day-cell.is-selected {
    box-shadow: inset 0 0 0 2px #a855f7;
    background: rgba(139, 92, 246, 0.16);
  }

  .cell-top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .cell-day-num {
    font-size: 0.78rem;
    font-weight: 700;
    color: #cbd5e1;
    line-height: 1;
  }

  .matrix-day-cell.is-today .cell-day-num {
    color: #c084fc;
  }

  .cell-today-pill {
    font-size: 0.58rem;
    font-weight: 700;
    background: #7c3aed;
    color: #fff;
    padding: 0.08rem 0.3rem;
    border-radius: 0.25rem;
    text-transform: uppercase;
  }

  /* Desktop Events Stack in Cells */
  .desktop-events-stack {
    display: flex;
    flex-direction: column;
    gap: 0.22rem;
    width: 100%;
    overflow: hidden;
  }

  .day-event-card {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    background: rgba(15, 23, 42, 0.88);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-left: 3px solid var(--stage-accent, #8b5cf6);
    border-radius: 0.32rem;
    padding: 0.18rem 0.3rem;
    overflow: hidden;
    transition: transform 0.1s ease;
  }

  .day-event-card:hover {
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.18);
  }

  .day-event-card.in-progress { background: rgba(139, 92, 246, 0.1); }
  .day-event-card.due-soon { background: rgba(245, 158, 11, 0.12); border-left-color: #f59e0b; }
  .day-event-card.done { background: rgba(16, 185, 129, 0.1); border-left-color: #10b981; }
  .day-event-card.overdue { background: rgba(239, 68, 68, 0.12); border-left-color: #ef4444; }
  .day-event-card.extended { background: rgba(6, 182, 212, 0.1); border-left-color: #06b6d4; }

  .event-card-top-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    width: 100%;
    min-width: 0;
  }

  .event-stage-tag {
    font-size: 0.58rem;
    font-weight: 700;
    color: var(--stage-accent, #c084fc);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .event-work-text {
    font-size: 0.62rem;
    font-weight: 600;
    color: #e2e8f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .event-ext-tag {
    font-size: 0.55rem;
    font-weight: 700;
    background: rgba(6, 182, 212, 0.25);
    color: #22d3ee;
    padding: 0.04rem 0.2rem;
    border-radius: 0.2rem;
    flex-shrink: 0;
  }

  .event-done-icon {
    color: #10b981;
    flex-shrink: 0;
  }

  .event-card-sub-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    width: 100%;
    min-width: 0;
  }

  .event-avatar-wrap {
    flex-shrink: 0;
  }

  .event-user-text {
    font-size: 0.58rem;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .event-overflow-pill {
    font-size: 0.58rem;
    font-weight: 700;
    color: #a855f7;
    background: rgba(139, 92, 246, 0.15);
    padding: 0.08rem 0.35rem;
    border-radius: 0.25rem;
    text-align: center;
  }

  .publication-badge-pill {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.56rem;
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.12);
    padding: 0.06rem 0.25rem;
    border-radius: 0.2rem;
  }

  /* Mobile Day Content inside cell */
  .mobile-day-cell-content {
    display: none;
  }

  .mobile-day-preview-strip {
    display: none;
  }

  /* Agenda View Stack */
  .agenda-view-wrapper {
    background: #090d16;
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 0.85rem;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .agenda-header-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 0.45rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .agenda-header-left {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .agenda-heading {
    font-size: 0.88rem;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0;
  }

  .agenda-count-badge {
    font-size: 0.7rem;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.04);
    padding: 0.2rem 0.5rem;
    border-radius: 0.35rem;
  }

  .agenda-list-stack {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .agenda-compact-row {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 0.5rem;
    padding: 0.4rem 0.65rem;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .agenda-compact-row:hover {
    background: rgba(139, 92, 246, 0.12);
    border-color: rgba(139, 92, 246, 0.3);
  }

  .agenda-date-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 0.4rem;
    background: rgba(255, 255, 255, 0.05);
    flex-shrink: 0;
  }

  .agenda-date-day {
    font-size: 0.82rem;
    font-weight: 800;
    color: #f1f5f9;
    line-height: 1;
  }

  .agenda-date-mon {
    font-size: 0.58rem;
    color: #94a3b8;
    text-transform: uppercase;
    line-height: 1;
  }

  .agenda-info-cluster {
    display: flex;
    flex-direction: column;
    gap: 0.12rem;
    flex: 1;
    min-width: 0;
  }

  .agenda-title-line {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
  }

  .agenda-work-name {
    font-size: 0.8rem;
    color: #f8fafc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .agenda-ch-tag {
    font-size: 0.68rem;
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.08);
    padding: 0.04rem 0.25rem;
    border-radius: 0.2rem;
  }

  .agenda-stage-tag {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--st-c, #a855f7);
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
  }

  .st-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
  }

  .agenda-sub-meta {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .agenda-user-mini {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.68rem;
    color: #94a3b8;
  }

  .agenda-status-tag {
    font-size: 0.64rem;
    font-weight: 600;
    padding: 0.05rem 0.35rem;
    border-radius: 0.25rem;
  }

  .agenda-status-tag.in-progress { color: #c084fc; background: rgba(139, 92, 246, 0.15); }
  .agenda-status-tag.due-soon { color: #fbbf24; background: rgba(245, 158, 11, 0.18); }
  .agenda-status-tag.done { color: #34d399; background: rgba(16, 185, 129, 0.15); }
  .agenda-status-tag.overdue { color: #fca5a5; background: rgba(239, 68, 68, 0.18); }
  .agenda-status-tag.extended { color: #22d3ee; background: rgba(6, 182, 212, 0.18); }

  .agenda-ext-pill {
    font-size: 0.62rem;
    font-weight: 700;
    color: #22d3ee;
    background: rgba(6, 182, 212, 0.2);
    padding: 0.05rem 0.25rem;
    border-radius: 0.2rem;
  }

  .agenda-action-zone {
    color: #64748b;
    flex-shrink: 0;
  }

  /* ========================================================================= */
  /* SINGLE CONTEXTUAL PANEL (Desktop)                                         */
  /* ========================================================================= */
  .calendar-contextual-panel {
    background: #090d16;
    border: 1px solid rgba(139, 92, 246, 0.22);
    border-radius: 0.85rem;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  }

  .context-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 0.95rem;
    background: rgba(15, 23, 42, 0.85);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .context-header-titles {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
  }

  .context-title {
    font-size: 0.86rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .context-count-tag {
    font-size: 0.7rem;
    color: #c084fc;
    background: rgba(139, 92, 246, 0.16);
    padding: 0.15rem 0.45rem;
    border-radius: 0.35rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .context-panel-body {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .context-commitments-stack {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .context-delivery-card {
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.65rem;
    overflow: hidden;
    transition: border-color 0.15s ease;
  }

  .context-delivery-card.is-expanded {
    border-color: rgba(139, 92, 246, 0.35);
  }

  .context-accordion-bar {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.7rem;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
  }

  .accordion-bar-left {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
  }

  .accordion-bar-text {
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
    min-width: 0;
  }

  .accordion-work {
    font-size: 0.78rem;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .accordion-stage {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--st-c, #a855f7);
  }

  .accordion-bar-right {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-shrink: 0;
  }

  .accordion-status {
    font-size: 0.64rem;
    font-weight: 700;
    padding: 0.08rem 0.35rem;
    border-radius: 0.25rem;
  }

  .accordion-status.in-progress { color: #c084fc; background: rgba(139, 92, 246, 0.15); }
  .accordion-status.due-soon { color: #fbbf24; background: rgba(245, 158, 11, 0.18); }
  .accordion-status.done { color: #34d399; background: rgba(16, 185, 129, 0.15); }
  .accordion-status.overdue { color: #fca5a5; background: rgba(239, 68, 68, 0.18); }
  .accordion-status.extended { color: #22d3ee; background: rgba(6, 182, 212, 0.18); }

  .accordion-chevron {
    color: #94a3b8;
  }

  /* Expanded Delivery Details inside Context Panel */
  .context-expanded-content {
    padding: 0.7rem 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .ctx-header-cluster {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  .ctx-cover-box {
    width: 36px;
    height: 48px;
    border-radius: 0.35rem;
    overflow: hidden;
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  .ctx-cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .ctx-cover-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
  }

  .ctx-titles-col {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
    flex: 1;
  }

  .ctx-work-title {
    font-size: 0.88rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ctx-badges-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .ctx-chapter-badge {
    font-size: 0.68rem;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
    padding: 0.05rem 0.3rem;
    border-radius: 0.25rem;
  }

  .ctx-stage-badge {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--st-c, #a855f7);
    background: color-mix(in srgb, var(--st-c, #a855f7) 14%, transparent);
    padding: 0.05rem 0.35rem;
    border-radius: 0.25rem;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .ctx-meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    background: rgba(0, 0, 0, 0.25);
    padding: 0.45rem 0.6rem;
    border-radius: 0.45rem;
  }

  .ctx-meta-cell {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .ctx-label {
    font-size: 0.66rem;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .ctx-user-lockup {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    min-width: 0;
  }

  .ctx-username {
    font-size: 0.74rem;
    color: #e2e8f0;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ctx-status-pill {
    font-size: 0.68rem;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.08rem 0.35rem;
    border-radius: 0.25rem;
    width: fit-content;
  }

  .ctx-status-pill.in-progress { color: #c084fc; background: rgba(139, 92, 246, 0.18); }
  .ctx-status-pill.due-soon { color: #fbbf24; background: rgba(245, 158, 11, 0.2); }
  .ctx-status-pill.done { color: #34d399; background: rgba(16, 185, 129, 0.18); }
  .ctx-status-pill.overdue { color: #fca5a5; background: rgba(239, 68, 68, 0.22); }
  .ctx-status-pill.extended { color: #22d3ee; background: rgba(6, 182, 212, 0.2); }

  .ctx-deadline-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.45rem 0.6rem;
    background: rgba(139, 92, 246, 0.06);
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 0.45rem;
  }

  .ctx-deadline-col {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .ctx-due-val {
    font-size: 0.8rem;
    font-weight: 700;
    color: #38bdf8;
  }

  .ctx-remaining-badge {
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.15rem 0.45rem;
    border-radius: 0.35rem;
  }

  .ctx-remaining-badge.in-progress { background: rgba(139, 92, 246, 0.2); color: #c084fc; }
  .ctx-remaining-badge.due-soon { background: rgba(245, 158, 11, 0.25); color: #fbbf24; }
  .ctx-remaining-badge.overdue { background: rgba(239, 68, 68, 0.25); color: #f87171; }
  .ctx-remaining-badge.extended { background: rgba(6, 182, 212, 0.25); color: #22d3ee; }

  /* Extension Section */
  .ctx-extension-section {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .btn-extension-action {
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0.42rem 0.75rem;
    border-radius: 0.45rem;
    font-size: 0.76rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-extension-action.available {
    background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
    border: 1px solid rgba(6, 182, 212, 0.4);
    color: #fff;
    box-shadow: 0 2px 10px rgba(6, 182, 212, 0.3);
  }

  .btn-extension-action.available:hover {
    box-shadow: 0 4px 14px rgba(6, 182, 212, 0.45);
    transform: translateY(-1px);
  }

  .btn-extension-action.locked {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #64748b;
    cursor: not-allowed;
  }

  .ext-helper-note {
    font-size: 0.68rem;
    color: #94a3b8;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin: 0;
  }

  .ext-discreet-confirmation {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: #34d399;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.35rem 0.55rem;
    border-radius: 0.4rem;
  }

  /* Notes Section */
  .ctx-notes-section {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .ctx-notes-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .btn-edit-note {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    background: transparent;
    border: none;
    color: #c084fc;
    font-size: 0.68rem;
    font-weight: 600;
    cursor: pointer;
  }

  .ctx-notes-body {
    font-size: 0.74rem;
    color: #cbd5e1;
    background: rgba(0, 0, 0, 0.25);
    padding: 0.35rem 0.55rem;
    border-radius: 0.35rem;
    margin: 0;
    line-height: 1.35;
  }

  .ctx-notes-body.is-empty {
    color: #64748b;
    font-style: italic;
  }

  .ctx-note-form {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .ctx-note-textarea {
    width: 100%;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(139, 92, 246, 0.4);
    border-radius: 0.35rem;
    padding: 0.35rem 0.5rem;
    color: #f1f5f9;
    font-size: 0.74rem;
    resize: none;
    outline: none;
  }

  .ctx-note-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.35rem;
  }

  .btn-note-cancel {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    font-size: 0.68rem;
    padding: 0.2rem 0.45rem;
    border-radius: 0.3rem;
    cursor: pointer;
  }

  .btn-note-save {
    background: #7c3aed;
    border: none;
    color: #fff;
    font-size: 0.68rem;
    font-weight: 600;
    padding: 0.2rem 0.55rem;
    border-radius: 0.3rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .ctx-actions-footer {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding-top: 0.25rem;
  }

  .btn-open-in-prod {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.35);
    color: #c084fc;
    font-size: 0.74rem;
    font-weight: 700;
    padding: 0.4rem 0.75rem;
    border-radius: 0.45rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-open-in-prod:hover {
    background: rgba(139, 92, 246, 0.25);
    color: #fff;
  }

  /* Empty State & Proxima Entrega Relevante */
  .context-empty-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding: 0.5rem 0;
  }

  .context-empty-notice {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.3rem;
    padding: 1.25rem 0.75rem;
  }

  .empty-headline {
    font-size: 0.82rem;
    font-weight: 700;
    color: #cbd5e1;
    margin: 0;
  }

  .empty-subline {
    font-size: 0.72rem;
    color: #64748b;
    margin: 0;
    line-height: 1.35;
  }

  .next-relevant-card {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 0.65rem;
    padding: 0.65rem 0.75rem;
  }

  .next-relevant-eyebrow {
    font-size: 0.68rem;
    font-weight: 700;
    color: #c084fc;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .next-relevant-box {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .next-relevant-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem;
  }

  .next-work-title {
    font-size: 0.82rem;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .next-relevant-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem;
  }

  .next-due-txt {
    font-size: 0.72rem;
    color: #38bdf8;
    font-weight: 600;
  }

  .btn-jump-to-date {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.35);
    color: #c084fc;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.35rem 0.65rem;
    border-radius: 0.4rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-jump-to-date:hover {
    background: rgba(139, 92, 246, 0.25);
    color: #fff;
  }

  /* ========================================================================= */
  /* ANDROID BOTTOM SHEET (Organized into 6 Strict Sections)                   */
  /* ========================================================================= */
  .bottom-sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(4, 7, 18, 0.82);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .bottom-sheet-panel {
    background: #090d16;
    border-top: 1px solid rgba(139, 92, 246, 0.35);
    border-radius: 1.15rem 1.15rem 0 0;
    width: 100%;
    max-width: 500px;
    max-height: min(86vh, 640px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.8);
    animation: sheetUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes sheetUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  .sheet-drag-handle {
    width: 36px;
    height: 4px;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.2);
    margin: 0.45rem auto 0.2rem;
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.45rem 1rem 0.65rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .sheet-title-col {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .sheet-eyebrow {
    font-size: 0.65rem;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .sheet-title {
    font-size: 0.92rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .btn-close-sheet {
    background: transparent;
    border: none;
    color: #64748b;
    padding: 0.35rem;
    cursor: pointer;
    border-radius: 0.35rem;
  }

  .sheet-scroll-body {
    padding: 0.75rem 1rem max(1.5rem, env(safe-area-inset-bottom, 1.5rem));
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .sheet-section {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .sheet-label {
    font-size: 0.66rem;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  /* 1. Obra, capítulo e etapa */
  .sheet-work-banner {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    background: rgba(15, 23, 42, 0.7);
    padding: 0.55rem 0.75rem;
    border-radius: 0.55rem;
    border: 1px solid rgba(255, 255, 255, 0.07);
  }

  .sheet-cover-box {
    width: 36px;
    height: 48px;
    border-radius: 0.35rem;
    overflow: hidden;
    background: #1e293b;
    flex-shrink: 0;
  }

  .sheet-cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .sheet-cover-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
  }

  .sheet-work-meta {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
    flex: 1;
  }

  .sheet-work-name {
    font-size: 0.88rem;
    font-weight: 700;
    color: #f8fafc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sheet-pills-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .sheet-ch-pill {
    font-size: 0.68rem;
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.08);
    padding: 0.05rem 0.3rem;
    border-radius: 0.25rem;
  }

  .sheet-stage-pill {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--st-c, #a855f7);
    background: color-mix(in srgb, var(--st-c, #a855f7) 14%, transparent);
    padding: 0.05rem 0.35rem;
    border-radius: 0.25rem;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  /* 2. Responsável e status */
  .sheet-grid-two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    background: rgba(15, 23, 42, 0.5);
    padding: 0.45rem 0.65rem;
    border-radius: 0.45rem;
  }

  .sheet-meta-cell {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .sheet-user-lockup {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .sheet-username {
    font-size: 0.74rem;
    color: #e2e8f0;
    font-weight: 600;
  }

  .sheet-status-pill {
    font-size: 0.68rem;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.08rem 0.35rem;
    border-radius: 0.25rem;
    width: fit-content;
  }

  .sheet-status-pill.in-progress { color: #c084fc; background: rgba(139, 92, 246, 0.18); }
  .sheet-status-pill.due-soon { color: #fbbf24; background: rgba(245, 158, 11, 0.2); }
  .sheet-status-pill.done { color: #34d399; background: rgba(16, 185, 129, 0.18); }
  .sheet-status-pill.overdue { color: #fca5a5; background: rgba(239, 68, 68, 0.22); }
  .sheet-status-pill.extended { color: #22d3ee; background: rgba(6, 182, 212, 0.2); }

  /* 3. Prazo e tempo restante */
  .sheet-deadline-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(139, 92, 246, 0.08);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 0.45rem;
    padding: 0.45rem 0.65rem;
  }

  .sheet-deadline-left {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .sheet-due-text {
    font-size: 0.8rem;
    font-weight: 700;
    color: #38bdf8;
  }

  .sheet-time-badge {
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.15rem 0.45rem;
    border-radius: 0.35rem;
  }

  .sheet-time-badge.in-progress { background: rgba(139, 92, 246, 0.2); color: #c084fc; }
  .sheet-time-badge.due-soon { background: rgba(245, 158, 11, 0.25); color: #fbbf24; }
  .sheet-time-badge.overdue { background: rgba(239, 68, 68, 0.25); color: #f87171; }
  .sheet-time-badge.extended { background: rgba(6, 182, 212, 0.25); color: #22d3ee; }

  /* 4. Ação de prorrogação */
  .sheet-extension-box {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .btn-sheet-extend {
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0.45rem 0.75rem;
    border-radius: 0.45rem;
    font-size: 0.76rem;
    font-weight: 700;
    cursor: pointer;
  }

  .btn-sheet-extend.available {
    background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
    border: 1px solid rgba(6, 182, 212, 0.4);
    color: #fff;
    box-shadow: 0 2px 10px rgba(6, 182, 212, 0.3);
  }

  .btn-sheet-extend.locked {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #64748b;
    cursor: not-allowed;
  }

  .sheet-ext-note {
    font-size: 0.68rem;
    color: #94a3b8;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin: 0;
  }

  .sheet-ext-confirmation {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: #34d399;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.35rem 0.55rem;
    border-radius: 0.4rem;
  }

  /* 5. Observações */
  .sheet-notes-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .sheet-notes-text {
    font-size: 0.74rem;
    color: #cbd5e1;
    background: rgba(15, 23, 42, 0.5);
    padding: 0.4rem 0.6rem;
    border-radius: 0.4rem;
    margin: 0;
    line-height: 1.35;
  }

  .sheet-notes-text.is-empty {
    color: #64748b;
    font-style: italic;
  }

  /* 6. Histórico / Produção */
  .btn-sheet-production {
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    background: rgba(139, 92, 246, 0.18);
    border: 1px solid rgba(139, 92, 246, 0.4);
    color: #c084fc;
    font-size: 0.76rem;
    font-weight: 700;
    padding: 0.45rem 0.8rem;
    border-radius: 0.45rem;
    cursor: pointer;
  }

  /* ========================================================================= */
  /* EXTENSION CONFIRMATION MODAL                                              */
  /* ========================================================================= */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(4, 7, 18, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem;
  }

  .extension-modal-card {
    background: #090d16;
    border: 1px solid rgba(6, 182, 212, 0.4);
    border-radius: 0.95rem;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(6, 182, 212, 0.15);
    width: 100%;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: modalPop 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .ext-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem 0.65rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .ext-header-left {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .ext-icon-orb {
    width: 32px;
    height: 32px;
    border-radius: 0.5rem;
    background: rgba(6, 182, 212, 0.18);
    color: #22d3ee;
    border: 1px solid rgba(6, 182, 212, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ext-modal-title {
    font-size: 0.92rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .ext-modal-subtitle {
    font-size: 0.7rem;
    color: #94a3b8;
    margin: 0;
  }

  .ext-modal-body {
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .ext-context-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    background: rgba(15, 23, 42, 0.7);
    padding: 0.45rem 0.65rem;
    border-radius: 0.45rem;
  }

  .ext-work-title {
    font-size: 0.8rem;
    color: #f1f5f9;
  }

  .ext-stage-pill {
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--st-c, #a855f7);
    background: rgba(255, 255, 255, 0.06);
    padding: 0.08rem 0.35rem;
    border-radius: 0.25rem;
  }

  .ext-dates-compare {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    background: rgba(6, 182, 212, 0.06);
    border: 1px solid rgba(6, 182, 212, 0.2);
    border-radius: 0.45rem;
    padding: 0.55rem 0.7rem;
  }

  .date-compare-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .date-compare-label {
    font-size: 0.72rem;
    color: #94a3b8;
  }

  .date-compare-val.old {
    font-size: 0.76rem;
    color: #cbd5e1;
  }

  .date-compare-val.new {
    font-size: 0.82rem;
    color: #22d3ee;
    font-weight: 700;
  }

  .ext-rules-card {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    background: rgba(15, 23, 42, 0.5);
    padding: 0.45rem 0.65rem;
    border-radius: 0.45rem;
  }

  .rule-line {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.7rem;
    color: #cbd5e1;
  }

  .ext-modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    padding-top: 0.35rem;
  }

  .btn-confirm-extend {
    background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
    border: 1px solid rgba(6, 182, 212, 0.5);
    color: #fff;
    font-size: 0.76rem;
    font-weight: 700;
    padding: 0.45rem 0.95rem;
    border-radius: 0.45rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .btn-confirm-extend:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ========================================================================= */
  /* MOBILE FILTER BOTTOM SHEET                                                */
  /* ========================================================================= */
  .filter-sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(4, 7, 18, 0.82);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .filter-sheet-panel {
    background: #090d16;
    border-top: 1px solid rgba(139, 92, 246, 0.35);
    border-radius: 1.15rem 1.15rem 0 0;
    width: 100%;
    max-width: 500px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .filter-sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem 0.65rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .sheet-title-cluster {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .sheet-heading {
    font-size: 0.9rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .btn-close-filter-sheet {
    background: transparent;
    border: none;
    color: #64748b;
    padding: 0.35rem;
    cursor: pointer;
  }

  .filter-sheet-body {
    padding: 0.75rem 1rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .filter-section-block {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .filter-section-title {
    font-size: 0.72rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
  }

  .filter-pills-flow {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .filter-chip-option {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.28rem 0.55rem;
    border-radius: 0.4rem;
    cursor: pointer;
  }

  .filter-chip-option.is-chosen {
    background: rgba(139, 92, 246, 0.25);
    border-color: rgba(139, 92, 246, 0.6);
    color: #c084fc;
  }

  .filter-sheet-select {
    width: 100%;
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #f1f5f9;
    font-size: 0.78rem;
    padding: 0.45rem 0.65rem;
    border-radius: 0.45rem;
  }

  .filter-sheet-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    padding: 0.65rem 1rem max(0.65rem, env(safe-area-inset-bottom, 0.65rem));
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .btn-sheet-clear {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    font-size: 0.76rem;
    font-weight: 600;
    padding: 0.45rem 0.85rem;
    border-radius: 0.45rem;
    cursor: pointer;
  }

  .btn-sheet-apply {
    flex: 1;
    background: #7c3aed;
    border: none;
    color: #fff;
    font-size: 0.76rem;
    font-weight: 700;
    padding: 0.45rem 0.85rem;
    border-radius: 0.45rem;
    cursor: pointer;
  }

  .btn-open-filter-sheet {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.4);
    color: #c084fc;
    font-size: 0.74rem;
    font-weight: 700;
    padding: 0.3rem 0.6rem;
    border-radius: 0.45rem;
    cursor: pointer;
  }

  .sheet-count-pip {
    font-size: 0.62rem;
    background: #7c3aed;
    color: #fff;
    padding: 0.05rem 0.3rem;
    border-radius: 9999px;
  }

  .btn-clear-mobile-quick {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
    font-size: 0.7rem;
    padding: 0.28rem 0.45rem;
    border-radius: 0.35rem;
    cursor: pointer;
  }

  .mobile-stat-count {
    margin-left: auto;
    font-size: 0.7rem;
    color: #94a3b8;
  }

  .mobile-stat-count strong { color: #c084fc; }

  .mobile-active-chips-scroll {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .mobile-active-chips-scroll::-webkit-scrollbar { display: none; }

  .active-chip-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    background: rgba(139, 92, 246, 0.2);
    border: 1px solid rgba(139, 92, 246, 0.4);
    color: #e2e8f0;
    font-size: 0.68rem;
    padding: 0.18rem 0.45rem;
    border-radius: 0.35rem;
    white-space: nowrap;
    cursor: pointer;
  }

  .mobile-filters-top-strip {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    width: 100%;
  }

  .btn-cancel {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 0.76rem;
    font-weight: 600;
    padding: 0.45rem 0.85rem;
    border-radius: 0.45rem;
    cursor: pointer;
  }

  .spinner-mini {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .alert-banner {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.45rem 0.65rem;
    border-radius: 0.4rem;
    font-size: 0.72rem;
  }

  .alert-banner.error {
    background: rgba(239, 68, 68, 0.16);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #fca5a5;
  }

  /* ========================================================================= */
  /* RESPONSIVE DESIGN (Android 320px - 430px & Tablets)                       */
  /* ========================================================================= */
  @media (max-width: 1024px) {
    .calendar-workspace-layout {
      grid-template-columns: 1fr;
    }

    .calendar-contextual-panel {
      display: none; /* Contextual panel collapses on tablet/mobile in favor of compact strip + bottom sheet */
    }
  }

  @media (max-width: 768px) {
    .scan-calendar-hub {
      gap: 0.5rem;
    }

    .calendar-top-header {
      padding: 0.55rem 0.75rem;
      flex-direction: column;
      align-items: stretch;
      gap: 0.55rem;
    }

    .calendar-title {
      font-size: 0.92rem;
    }

    .month-nav-cluster {
      justify-content: space-between;
      width: 100%;
    }

    .current-month-display {
      padding: 0 0.35rem;
      font-size: 0.78rem;
    }

    .desktop-only-filters {
      display: none !important;
    }

    .mobile-filter-controls {
      display: flex;
      flex-direction: column;
      width: 100%;
      gap: 0.3rem;
    }

    .calendar-filters-bar {
      padding: 0.4rem 0.6rem;
    }

    /* Grid for Mobile */
    .matrix-day-cell {
      min-height: 50px;
      max-height: 68px;
      padding: 0.22rem 0.18rem;
      gap: 0.12rem;
    }

    .cell-day-num {
      font-size: 0.7rem;
    }

    .cell-today-pill {
      font-size: 0.52rem;
      padding: 0.04rem 0.2rem;
    }

    .desktop-events-stack {
      display: none;
    }

    /* Mobile Day Content inside cell */
    .mobile-day-cell-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.15rem;
      width: 100%;
      margin-top: auto;
    }

    .mobile-avatar-lockup {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.1rem;
    }

    .mobile-cell-avatar {
      flex-shrink: 0;
    }

    .mobile-overflow-count {
      font-size: 0.55rem;
      font-weight: 700;
      color: #c084fc;
    }

    .mobile-status-dot-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .mobile-status-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
    }

    .mobile-status-dot.in-progress { background: #c084fc; }
    .mobile-status-dot.due-soon { background: #fbbf24; }
    .mobile-status-dot.done { background: #34d399; }
    .mobile-status-dot.overdue { background: #ef4444; }
    .mobile-status-dot.extended { background: #06b6d4; }

    /* Mobile Day Preview Strip */
    .mobile-day-preview-strip {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      padding: 0.55rem 0.65rem;
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
      gap: 0.35rem;
      flex-wrap: wrap;
    }

    .preview-day-title {
      font-size: 0.74rem;
      font-weight: 700;
      color: #f1f5f9;
    }

    .preview-date-sub {
      font-size: 0.68rem;
      color: #94a3b8;
    }

    .preview-empty-note {
      font-size: 0.7rem;
      color: #64748b;
      font-style: italic;
      line-height: 1.3;
    }

    .preview-items-row {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    .preview-mini-card {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 0.4rem;
      padding: 0.35rem 0.5rem;
      cursor: pointer;
      text-align: left;
    }

    .preview-mini-card:active {
      background: rgba(139, 92, 246, 0.15);
    }

    .preview-card-avatar {
      flex-shrink: 0;
    }

    .preview-card-text {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      min-width: 0;
      flex: 1;
    }

    .preview-work-line {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      min-width: 0;
    }

    .preview-work-name {
      font-size: 0.74rem;
      font-weight: 700;
      color: #f8fafc;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .preview-chapter-badge {
      font-size: 0.62rem;
      color: #cbd5e1;
      background: rgba(255, 255, 255, 0.08);
      padding: 0.04rem 0.25rem;
      border-radius: 0.2rem;
    }

    .preview-stage-tag {
      font-size: 0.64rem;
      font-weight: 600;
      color: var(--st-c, #a855f7);
    }

    .preview-meta-line {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .preview-assignee-text {
      font-size: 0.66rem;
      color: #94a3b8;
    }

    .preview-sep {
      color: #475569;
      font-size: 0.6rem;
    }

    .preview-status-pill {
      font-size: 0.6rem;
      font-weight: 700;
      padding: 0.04rem 0.25rem;
      border-radius: 0.2rem;
    }

    .preview-status-pill.in-progress { background: rgba(139, 92, 246, 0.15); color: #c084fc; }
    .preview-status-pill.due-soon { background: rgba(245, 158, 11, 0.18); color: #fbbf24; }
    .preview-status-pill.done { background: rgba(16, 185, 129, 0.15); color: #34d399; }
    .preview-status-pill.overdue { background: rgba(239, 68, 68, 0.18); color: #fca5a5; }
    .preview-status-pill.extended { background: rgba(6, 182, 212, 0.18); color: #22d3ee; }

    .preview-due-text {
      font-size: 0.64rem;
      color: #38bdf8;
    }

    .preview-card-chevron {
      color: #64748b;
      flex-shrink: 0;
    }
  }

  @media (max-width: 360px) {
    .matrix-day-cell {
      min-height: 46px;
      padding: 0.18rem 0.12rem;
    }

    .cell-day-num {
      font-size: 0.66rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *, ::before, ::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
</style>
