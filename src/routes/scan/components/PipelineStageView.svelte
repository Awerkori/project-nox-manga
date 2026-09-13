<script lang="ts">
  import {
    Layers,
    Download,
    Upload,
    CheckCircle2,
    AlertTriangle,
    Clock,
    ArrowRight,
    RotateCcw,
    FileText,
    Sparkles,
    Plus,
    Eye,
    BookOpen,
    Filter,
    Search,
    Check,
    X,
    ChevronRight,
    Send,
    AlertCircle,
    ExternalLink,
    CheckSquare,
    Globe,
    FileCheck2,
    Edit2,
    Trash2,
    ChevronDown,
    ChevronUp,
    Info,
    Lock,
    Shield,
    Zap
  } from '@lucide/svelte';
  import { onMount, onDestroy } from 'svelte';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { evaluateStageClaim, normalizePositionName, CANONICAL_PIPELINE_STAGES } from '$lib/scan-roles';
  import { getSupabaseBrowserClient } from '$lib/supabase';
  import type { RealtimeChannel } from '@supabase/supabase-js';

  let {
    currentStageSlug = 'clean_redraw',
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
    onSelectStage = (slug: string) => {},
    onOpenChapter = (ch: any) => {}
  } = $props();

  let isOwnerOrAdmin = $derived(isOwnerOrAdminProp || userRole === 'OWNER' || userRole === 'ADMIN');

  // Feature flag kill-switch
  let pipelinePersonalBadgesEnabled = $state(true);

  // Optimistic seen set for immediate UI feedback on click/expansion
  let localSeenSet = $state<Set<string>>(new Set());

  // Reactive seen set: combination of server loaded seen records and local clicks
  let seenStageMap = $derived.by(() => {
    const set = new Set<string>();
    if (Array.isArray(seenStages)) {
      for (const s of seenStages) {
        if (s?.chapter_stage_id) {
          set.add(`${s.chapter_stage_id}:${s.availability_version ?? 1}`);
        }
      }
    }
    for (const key of localSeenSet) {
      set.add(key);
    }
    return set;
  });

  // Realtime Supabase Channel
  let realtimeChannel: RealtimeChannel | null = null;

  onMount(() => {
    const client = getSupabaseBrowserClient();
    if (!client || !scanId) return;

    realtimeChannel = client
      .channel(`scan_pipeline_view:${scanId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scan_chapter_stages',
          filter: `scan_id=eq.${scanId}`
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
          table: 'scan_pipeline_stage_seen',
          filter: `scan_id=eq.${scanId}`
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

  // Check if current user holds the required editorial role for a stage
  function userHoldsRoleForStage(stageSlug: string): boolean {
    if (stageSlug === 'publicado') return false;
    if (matchesStageSlug(stageSlug, 'pre_aprovado')) {
      return userRole === 'OWNER' || userRole === 'ADMIN';
    }
    const stageConfig = CANONICAL_PIPELINE_STAGES.find(s => matchesStageSlug(s.slug, stageSlug));
    if (!stageConfig || !stageConfig.requiredRoleSlug) return false;

    const normalized = userPositions.map((p: any) => {
      if (typeof p === 'string') return normalizePositionName(p);
      return normalizePositionName(p?.slug || p?.name || '');
    });
    return normalized.includes(stageConfig.requiredRoleSlug);
  }

  // Check if a stage item is available for the current user's role
  function isStageAvailableForMe(item: any): boolean {
    if (!pipelinePersonalBadgesEnabled || !item?.cs) return false;
    const stageSlug = item.cs.stage?.slug || activeCanonical.slug;
    if (item.cs.status !== 'AVAILABLE' && item.cs.status !== 'REWORK') return false;
    if (item.cs.assigned_to) return false;
    if (!userHoldsRoleForStage(stageSlug)) return false;

    // If it's QC and reserved for another user, it's not available for me
    if (matchesStageSlug(stageSlug, 'revisor_qc') && item.cs.qc_assignee_id && item.cs.qc_assignee_id !== currentUserId) {
      return false;
    }

    return true;
  }

  // Check if a stage item is newly available and unseen by current user
  function isStageNewForMe(item: any): boolean {
    if (!isStageAvailableForMe(item)) return false;
    const key = `${item.cs.id}:${item.cs.availability_version ?? 1}`;
    return !seenStageMap.has(key);
  }

  // Count of personal new tasks per canonical stage
  let stagePersonalNewCounts = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const cSt of CANONICAL_STAGES) counts[cSt.slug] = 0;

    if (!pipelinePersonalBadgesEnabled || !chapterStages || chapterStages.length === 0) {
      return counts;
    }

    for (const cs of chapterStages) {
      const slug = cs.stage?.slug || '';
      for (const cSt of CANONICAL_STAGES) {
        if (matchesStageSlug(slug, cSt.slug)) {
          if ((cs.status === 'AVAILABLE' || cs.status === 'REWORK') && !cs.assigned_to) {
            if (userHoldsRoleForStage(cSt.slug)) {
              if (matchesStageSlug(cSt.slug, 'revisor_qc') && cs.qc_assignee_id && cs.qc_assignee_id !== currentUserId) {
                continue;
              }
              const key = `${cs.id}:${cs.availability_version ?? 1}`;
              if (!seenStageMap.has(key)) {
                counts[cSt.slug]++;
              }
            }
          }
        }
      }
    }
    return counts;
  });

  // Mark a chapter stage generation as seen
  async function markStageSeen(chapterStageId: string) {
    if (!pipelinePersonalBadgesEnabled || !chapterStageId) return;
    const stageRecord = chapterStages.find((cs: any) => cs.id === chapterStageId);
    const ver = stageRecord?.availability_version ?? 1;
    const key = `${chapterStageId}:${ver}`;
    if (localSeenSet.has(key)) return;

    localSeenSet.add(key);
    localSeenSet = new Set(localSeenSet);

    try {
      await fetch('/api/scan/pipeline/seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapter_stage_id: chapterStageId })
      });
    } catch (err) {
      console.warn('Erro ao marcar etapa como visualizada:', err);
    }
  }

  // Canonical Stage Definitions & Presets (7 Official Stages in strict order)
  const CANONICAL_STAGES = [
    {
      slug: 'raw',
      name: 'Raw Provider',
      icon: '📦',
      color: '#94a3b8',
      badgeBg: 'rgba(148, 163, 184, 0.14)',
      badgeBorder: 'rgba(148, 163, 184, 0.3)',
      subtitle: 'Cadastre novos capítulos, baixe ou envie o RAW original para iniciar o fluxo.',
      aliases: ['raw', 'raw provider'],
      requiresOutput: true
    },
    {
      slug: 'traducao',
      name: 'Tradução',
      icon: '🌐',
      color: '#3b82f6',
      badgeBg: 'rgba(59, 130, 246, 0.14)',
      badgeBorder: 'rgba(59, 130, 246, 0.3)',
      subtitle: 'Baixe o RAW, faça a tradução dos textos e envie o script/arquivo final.',
      aliases: ['traducao', 'translation', 'tradutor'],
      requiresOutput: true
    },
    {
      slug: 'clean_redraw',
      name: 'Clean/Redraw',
      icon: '🎨',
      color: '#ec4899',
      badgeBg: 'rgba(236, 72, 153, 0.14)',
      badgeBorder: 'rgba(236, 72, 153, 0.3)',
      subtitle: 'Baixe o RAW, faça a limpeza dos balões e reconstrução da arte.',
      aliases: ['clean', 'clean_redraw', 'clean/redraw', 'redraw'],
      requiresOutput: true
    },
    {
      slug: 'typeset',
      name: 'Typeset',
      icon: '✒️',
      color: '#eab308',
      badgeBg: 'rgba(234, 179, 8, 0.14)',
      badgeBorder: 'rgba(234, 179, 8, 0.3)',
      subtitle: 'Insira os textos traduzidos nas páginas limpas após a conclusão de Clean/Redraw e Tradução.',
      aliases: ['typeset', 'typer'],
      requiresOutput: true
    },
    {
      slug: 'revisor_qc',
      name: 'Revisor (QC)',
      icon: '🔎',
      color: '#a855f7',
      badgeBg: 'rgba(168, 85, 247, 0.14)',
      badgeBorder: 'rgba(168, 85, 247, 0.3)',
      subtitle: 'Revisão textual e controle de qualidade minucioso. Aprove o capítulo ou aponte correções necessárias.',
      aliases: ['revisor_qc', 'revisao', 'qc', 'review', 'revisor (qc)'],
      requiresOutput: false
    },
    {
      slug: 'pre_aprovado',
      name: 'Pré Aprovado',
      icon: '✅',
      color: '#06b6d4',
      badgeBg: 'rgba(6, 182, 212, 0.14)',
      badgeBorder: 'rgba(6, 182, 212, 0.3)',
      subtitle: 'Capítulo validado e pré-aprovado. Pronto para liberação oficial no catálogo.',
      aliases: ['pre_aprovado', 'ready', 'pronto_pra_upar', 'preview', 'pré aprovado'],
      requiresOutput: false
    },
    {
      slug: 'publicado',
      name: 'Publicado',
      icon: '📚',
      color: '#22c55e',
      badgeBg: 'rgba(34, 197, 94, 0.14)',
      badgeBorder: 'rgba(34, 197, 94, 0.3)',
      subtitle: 'Histórico de capítulos concluídos e links diretos para leitura pública.',
      aliases: ['publicado', 'published'],
      requiresOutput: false
    }
  ];

  function matchesStageSlug(candidate: any, target: string): boolean {
    const s = (typeof candidate === 'string' ? candidate : candidate?.slug || '').toLowerCase().trim();
    const t = target.toLowerCase().trim();
    if (s === t) return true;
    if (t === 'clean' || t === 'clean_redraw' || t === 'clean/redraw') {
      return s === 'clean' || s === 'clean_redraw' || s === 'clean/redraw';
    }
    if (t === 'pre_aprovado' || t === 'ready' || t === 'pronto_pra_upar' || t === 'preview') {
      return s === 'pre_aprovado' || s === 'ready' || s === 'pronto_pra_upar' || s === 'preview' || s === 'pré aprovado';
    }
    if (t === 'traducao' || t === 'translation') {
      return s === 'traducao' || s === 'translation';
    }
    if (t === 'revisor_qc' || t === 'revisao' || t === 'qc') {
      return s === 'revisor_qc' || s === 'revisao' || s === 'qc' || s === 'revisor (qc)';
    }
    if (t === 'publicado' || t === 'published') {
      return s === 'publicado' || s === 'published';
    }
    return false;
  }

  // Active Canonical Stage Metadata
  let activeCanonical = $derived(
    CANONICAL_STAGES.find(st => matchesStageSlug(st.slug, currentStageSlug) || (st.aliases && st.aliases.some(a => matchesStageSlug(a, currentStageSlug)))) ||
    CANONICAL_STAGES[0] // default raw provider
  );

  // Active DB Stage Record
  let activeDbStage = $derived(
    stages.find((st: any) => matchesStageSlug(st.slug, activeCanonical.slug)) || null
  );

  // Active Stage Claim Permission & State Evaluation
  let claimEvaluation = $derived(
    evaluateStageClaim(userRole, userPositions, activeCanonical.slug)
  );

  // Filters
  let filterWorkId = $state<string>('ALL');
  let searchQuery = $state('');

  // RAW Special New Chapter Modal / Form Toggle
  let showNewChapterCard = $state(false);
  let newChapterWorkId = $state('');
  let newChapterNumber = $state<number | ''>('');
  let newChapterLabel = $state('');
  let newChapterPriority = $state('NORMAL');
  let newChapterAutoClaim = $state(true);
  let isCreatingChapter = $state(false);

  // RAW Quick Picker State (Work and Chapter selection for RAW)
  let rawSelectedWorkId = $state<string>(works[0]?.id || '');
  let rawSelectedChapterStageId = $state<string>('');

  $effect(() => {
    if (!rawSelectedWorkId && works.length > 0) {
      rawSelectedWorkId = works[0].id;
    }
  });

  // Eligible RAW chapters for the selected work (available/rework, unassigned, raw stage)
  let eligibleRawChaptersForWork = $derived.by(() => {
    if (activeCanonical.slug !== 'raw') return [];
    const targetWorkId = rawSelectedWorkId || (works[0]?.id ?? '');
    return activeStageItems.filter((item: any) =>
      (item.cs.status === 'AVAILABLE' || item.cs.status === 'REWORK') &&
      !item.cs.assigned_to &&
      (item.work?.id === targetWorkId || item.ch?.work_id === targetWorkId)
    );
  });

  $effect(() => {
    if (eligibleRawChaptersForWork.length > 0) {
      const exists = eligibleRawChaptersForWork.some((i: any) => i.cs.id === rawSelectedChapterStageId);
      if (!exists) {
        rawSelectedChapterStageId = eligibleRawChaptersForWork[0].cs.id;
      }
    } else {
      rawSelectedChapterStageId = '';
    }
  });

  let targetRawPickerItem = $derived(
    eligibleRawChaptersForWork.find((i: any) => i.cs.id === rawSelectedChapterStageId) || null
  );

  // Rework Return Modal State
  let showReworkModal = $state(false);
  let reworkSourceStageId = $state('');
  let reworkTargetSlug = $state('typeset');
  let reworkReason = $state('');
  let reworkChapterTitle = $state('');

  // Upload feedback and progress tracking per stage ID
  let uploadBusyStageId = $state<string | null>(null);
  let uploadProgress = $state(0);
  let uploadFeedback = $state<{ stageId: string; type: 'success' | 'error'; text: string } | null>(null);

  // Revision checklist state per stage ID
  let revisionNotes = $state<Record<string, string>>({});
  const revisionChecklist: Record<string, { spell: boolean; terms: boolean; formatting: boolean }> = {};

  function getRevisionChecks(stageId: string) {
    if (!revisionChecklist[stageId]) {
      revisionChecklist[stageId] = { spell: true, terms: true, formatting: true };
    }
    return revisionChecklist[stageId];
  }

  // Accordion state
  let expandedAvailable = $state<Record<string, boolean>>({});
  let expandedMyChapters = $state<Record<string, boolean>>({});

  function toggleAvailable(id: string) {
    expandedAvailable[id] = !expandedAvailable[id];
    if (expandedAvailable[id]) {
      markStageSeen(id);
    }
  }

  function toggleMyChapter(id: string) {
    expandedMyChapters[id] = !expandedMyChapters[id];
  }

  function isMyChapterOpen(id: string, idx: number): boolean {
    if (expandedMyChapters[id] !== undefined) return expandedMyChapters[id];
    return idx === 0;
  }

  // Edit Chapter Modal State
  let showEditModal = $state(false);
  let editTargetItem = $state<any>(null);
  let editChapterLabel = $state('');
  let editChapterPriority = $state('NORMAL');
  let editChapterNotes = $state('');
  let isEditingChapter = $state(false);

  function openEditModal(item: any) {
    editTargetItem = item;
    editChapterLabel = item.ch.chapter_label || '';
    editChapterPriority = item.ch.priority || 'NORMAL';
    editChapterNotes = item.cs.notes || '';
    showEditModal = true;
  }

  // Delete Chapter Confirmation Modal State
  let showDeleteModal = $state(false);
  let deleteTargetItem = $state<any>(null);
  let deleteConfirmationText = $state('');
  let deleteReason = $state('Produção removida pela equipe editorial');
  let isDeletingChapter = $state(false);
  let deleteError = $state<string | null>(null);

  function openDeleteModal(item: any) {
    deleteTargetItem = item;
    deleteConfirmationText = '';
    deleteReason = 'Produção removida pela equipe editorial';
    deleteError = null;
    showDeleteModal = true;
  }

  // Claim feedback state
  let isClaimingStageId = $state<string | null>(null);
  let claimFeedback = $state<{ stageId: string; type: 'error' | 'success'; text: string } | null>(null);

  // Format bytes helper
  function formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Calculate counts per canonical stage for quick navigation badges
  let stageCounts = $derived.by(() => {
    const counts: Record<string, { available: number; mine: number; total: number }> = {};
    for (const cSt of CANONICAL_STAGES) {
      counts[cSt.slug] = { available: 0, mine: 0, total: 0 };
    }

    if (chapterStages && chapterStages.length > 0) {
      for (const cs of chapterStages) {
        const slug = cs.stage?.slug || '';
        for (const cSt of CANONICAL_STAGES) {
          if (matchesStageSlug(slug, cSt.slug)) {
            if ((cs.status === 'AVAILABLE' || cs.status === 'REWORK') && !cs.assigned_to) {
              counts[cSt.slug].available++;
            }
            if (cs.assigned_to === currentUserId && (cs.status === 'IN_PROGRESS' || cs.status === 'REWORK')) {
              counts[cSt.slug].mine++;
            }
            counts[cSt.slug].total++;
          }
        }
      }
    }

    // Special count for publicado
    const pubCount = chapters.filter((c: any) => c.status === 'PUBLISHED').length;
    if (counts['publicado']) {
      counts['publicado'].total = pubCount;
      counts['publicado'].available = pubCount;
    }

    // Special count for preview / pre_aprovado
    const prevCount = chapters.filter((c: any) => ['READY', 'PREVIEW'].includes(c.status)).length;
    if (counts['pre_aprovado']) {
      counts['pre_aprovado'].available = prevCount;
      counts['pre_aprovado'].total = prevCount;
    }
    if (counts['preview']) {
      counts['preview'].available = prevCount;
      counts['preview'].total = prevCount;
    }

    return counts;
  });

  // Collect items for the active stage
  let activeStageItems = $derived.by(() => {
    const target = activeCanonical.slug;

    // Special case: Publicado
    if (target === 'publicado') {
      return chapters
        .filter((c: any) => c.status === 'PUBLISHED')
        .map((c: any) => ({
          ch: c,
          cs: { id: c.id, status: 'DONE', stage: { slug: 'publicado', name: 'Publicado' } },
          work: c.work || works.find((w: any) => w.id === c.work_id)
        }));
    }

    // Special case: Preview
    if (target === 'preview') {
      return chapters
        .filter((c: any) => ['READY', 'PREVIEW', 'PUBLISHED'].includes(c.status))
        .map((c: any) => ({
          ch: c,
          cs: { id: c.id, status: c.status === 'PUBLISHED' ? 'DONE' : 'AVAILABLE', stage: { slug: 'preview', name: 'Preview' } },
          work: c.work || works.find((w: any) => w.id === c.work_id)
        }));
    }

    // Standard DAG workflow stages
    const result: any[] = [];
    for (const cs of chapterStages) {
      const stageSlug = cs.stage?.slug || '';
      if (matchesStageSlug(stageSlug, target)) {
        const ch = chapters.find((c: any) => c.id === cs.production_chapter_id);
        if (ch) {
          const work = ch.work || works.find((w: any) => w.id === ch.work_id);
          result.push({ ch, cs, work });
        }
      }
    }
    return result;
  });

  // Filtered available items
  let availableItems = $derived(
    activeStageItems
      .filter((item: any) => {
        if (activeCanonical.slug === 'publicado') return false; // Publicado is historic
        if (activeCanonical.slug === 'preview') return item.cs.status === 'AVAILABLE';
        return (item.cs.status === 'AVAILABLE' || item.cs.status === 'REWORK') && !item.cs.assigned_to;
      })
      .filter((item: any) => {
        const matchesWork = filterWorkId === 'ALL' || item.work?.id === filterWorkId;
        const query = searchQuery.trim().toLowerCase();
        if (!query) return matchesWork;
        const title = (item.work?.title || '').toLowerCase();
        const num = String(item.ch.chapter_number || '');
        const label = (item.ch.chapter_label || '').toLowerCase();
        return matchesWork && (title.includes(query) || num.includes(query) || label.includes(query));
      })
  );

  // Filtered my items
  let myItems = $derived(
    activeStageItems
      .filter((item: any) => {
        if (activeCanonical.slug === 'publicado') return true; // Show all published in main view
        if (activeCanonical.slug === 'preview') return false;
        return item.cs.assigned_to === currentUserId && (item.cs.status === 'IN_PROGRESS' || item.cs.status === 'REWORK');
      })
      .filter((item: any) => {
        const matchesWork = filterWorkId === 'ALL' || item.work?.id === filterWorkId;
        const query = searchQuery.trim().toLowerCase();
        if (!query) return matchesWork;
        const title = (item.work?.title || '').toLowerCase();
        const num = String(item.ch.chapter_number || '');
        const label = (item.ch.chapter_label || '').toLowerCase();
        return matchesWork && (title.includes(query) || num.includes(query) || label.includes(query));
      })
  );

  // Get upstream files for a chapter stage
  function getUpstreamFilesForStage(cs: any, chId: string) {
    const deps: string[] = cs.stage?.dependencies || [];
    const files = productionFiles.filter((f: any) => f.production_chapter_id === chId && f.is_current);

    // If stage is Typeset, explicitly return Clean and Tradução separated
    if (matchesStageSlug(cs.stage?.slug, 'typeset')) {
      const cleanFile = files.find((f: any) => matchesStageSlug(f.stage_slug || f.stage?.slug, 'clean_redraw'));
      const tradFile = files.find((f: any) => matchesStageSlug(f.stage_slug || f.stage?.slug, 'traducao'));
      return {
        isTypeset: true,
        cleanFile,
        tradFile,
        all: [cleanFile, tradFile].filter(Boolean)
      };
    }

    if (deps.length === 0) {
      // Return raw file if exists
      const rawFile = files.find((f: any) => matchesStageSlug(f.stage_slug || f.stage?.slug, 'raw'));
      return { isTypeset: false, all: rawFile ? [rawFile] : [] };
    }

    const matched = files.filter((f: any) => {
      const slug = f.stage_slug || f.stage?.slug || '';
      return deps.some(d => matchesStageSlug(slug, d));
    });

    return { isTypeset: false, all: matched };
  }

  // Get current deliverable file for active stage
  function getCurrentDeliverableFile(cs: any, chId: string) {
    return productionFiles.find((f: any) =>
      f.production_chapter_id === chId &&
      (f.stage_id === cs.stage_id || matchesStageSlug(f.stage_slug || f.stage?.slug, cs.stage?.slug)) &&
      f.is_current
    );
  }

  // Handle file upload
  async function handleFileUpload(e: Event, item: any) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    uploadBusyStageId = item.cs.id;
    uploadProgress = 15;
    uploadFeedback = null;

    try {
      const formData = new FormData();
      formData.set('scan_id', scanId);
      formData.set('production_chapter_id', item.ch.id);
      formData.set('stage_id', item.cs.stage_id);
      formData.set('file', file);

      uploadProgress = 45;
      const res = await fetch('/api/scan/production/upload', {
        method: 'POST',
        body: formData
      });
      uploadProgress = 85;

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Falha ao enviar arquivo');
      }

      uploadProgress = 100;
      uploadFeedback = {
        stageId: item.cs.id,
        type: 'success',
        text: `Arquivo "${file.name}" enviado com sucesso (v${data.version || 1})! Etapa pronta para ser concluída.`
      };
      await invalidateAll();
    } catch (err: any) {
      uploadFeedback = {
        stageId: item.cs.id,
        type: 'error',
        text: err.message || 'Erro ao enviar arquivo'
      };
    } finally {
      uploadBusyStageId = null;
      input.value = '';
    }
  }

  // Open rework modal
  function openReworkModal(item: any) {
    reworkSourceStageId = item.cs.id;
    reworkChapterTitle = `${item.work?.title} - Cap. #${item.ch.chapter_number}`;
    reworkReason = '';
    reworkTargetSlug = activeCanonical.slug === 'qc' ? 'typeset' : 'clean_redraw';
    showReworkModal = true;
  }
</script>

<div class="pipeline-stage-view-root">
  <!-- Top Location & Stage Header -->
  <header class="stage-page-header">
    <div class="breadcrumb-trail">
      <span class="crumb-parent">Produção</span>
      <ChevronRight size={14} class="crumb-sep" />
      <span class="crumb-parent">Pipeline</span>
      <ChevronRight size={14} class="crumb-sep" />
      <span class="crumb-active" style="color: {activeCanonical.color}">
        {activeCanonical.name}
      </span>
    </div>

    <div class="stage-hero-headline">
      <div class="headline-title-lockup">
        <h1 class="stage-main-title">{activeCanonical.name}</h1>
        <span
          class="stage-hero-badge"
          style="background: {activeCanonical.badgeBg}; border-color: {activeCanonical.badgeBorder}; color: {activeCanonical.color};"
        >
          <span class="badge-dot" style="background: {activeCanonical.color};"></span>
          Etapa Editorial
        </span>
      </div>
      <p class="stage-hero-subtitle">{activeCanonical.subtitle}</p>
    </div>

    <!-- Canonical Stages Switcher Bar with Personal & Total Badges -->
    <nav class="canonical-stages-nav-bar" aria-label="Navegação entre etapas do pipeline">
      <div class="stage-pills-scroll">
        {#each CANONICAL_STAGES as st}
          {@const isSelected = matchesStageSlug(st.slug, activeCanonical.slug)}
          {@const totalAvail = stageCounts[st.slug]?.available || 0}
          {@const personalNew = stagePersonalNewCounts[st.slug] || 0}
          <button
            type="button"
            class="stage-nav-pill"
            class:selected={isSelected}
            onclick={() => onSelectStage(st.slug)}
          >
            <span class="pill-icon" aria-hidden="true">{st.icon}</span>
            <span class="pill-name">{st.name}</span>
            {#if personalNew > 0}
              <span class="pill-personal-badge" title="{personalNew} novos capítulos para seu cargo editorial">
                ✨ {personalNew} novo{personalNew > 1 ? 's' : ''}
              </span>
            {:else if totalAvail > 0}
              <span class="pill-total-badge">{totalAvail}</span>
            {/if}
          </button>
        {/each}
      </div>
    </nav>

    <!-- Filter & Search Toolbar -->
    <div class="stage-toolbar">
      <div class="toolbar-left">
        <div class="search-input-wrap">
          <Search size={16} class="search-icon" />
          <input
            type="text"
            placeholder="Buscar por obra ou número..."
            bind:value={searchQuery}
            class="search-text-field"
          />
          {#if searchQuery}
            <button type="button" class="btn-clear-search" onclick={() => (searchQuery = '')}>
              <X size={14} />
            </button>
          {/if}
        </div>

        <div class="filter-select-wrap">
          <Filter size={15} class="filter-icon" />
          <select bind:value={filterWorkId} class="work-select-field">
            <option value="ALL">Todas as Obras ({works.length})</option>
            {#each works as w}
              <option value={w.id}>{w.title}</option>
            {/each}
          </select>
        </div>
      </div>

      {#if activeCanonical.slug === 'raw' && (isOwnerOrAdmin || claimEvaluation.canClaim)}
        <div class="toolbar-right">
          <button
            type="button"
            class="btn-new-chapter-trigger"
            onclick={() => {
              showNewChapterCard = !showNewChapterCard;
              if (showNewChapterCard && !newChapterWorkId && works.length > 0) {
                newChapterWorkId = rawSelectedWorkId || works[0].id;
              }
            }}
          >
            <Plus size={16} />
            <span>{showNewChapterCard ? 'Fechar Cadastro' : 'Cadastrar Novo Capítulo'}</span>
          </button>
        </div>
      {/if}
    </div>
  </header>

  <!-- RAW SPECIAL FLOW: INICIAR NOVO CAPÍTULO -->
  {#if activeCanonical.slug === 'raw' && showNewChapterCard}
    <section class="raw-new-chapter-card">
      <div class="card-glass-header">
        <div class="card-header-icon raw-icon-box">
          <Sparkles size={18} class="text-amber-400" />
        </div>
        <div>
          <h2 class="card-headline-title">Cadastrar Novo Capítulo na Produção</h2>
          <p class="card-headline-subtitle">
            Crie o capítulo no sistema para acionar a cadeia editorial automática com as 9 etapas canônicas.
          </p>
        </div>
      </div>

      <form
        method="POST"
        action="?/createProductionChapter"
        use:enhance={() => {
          isCreatingChapter = true;
          return async ({ update }) => {
            await update();
            isCreatingChapter = false;
            showNewChapterCard = false;
            newChapterNumber = '';
            newChapterLabel = '';
          };
        }}
        class="new-chapter-form-grid"
      >
        <input type="hidden" name="scan_id" value={scanId} />

        <div class="form-field">
          <label for="raw_work_select" class="field-label">Obra *</label>
          <select id="raw_work_select" name="work_id" required bind:value={newChapterWorkId} class="field-input">
            <option value="" disabled selected>Selecione a obra...</option>
            {#each works as w}
              <option value={w.id}>{w.title}</option>
            {/each}
          </select>
        </div>

        <div class="form-field">
          <label for="raw_ch_num" class="field-label">Número do Capítulo *</label>
          <input
            id="raw_ch_num"
            type="number"
            step="any"
            name="chapter_number"
            required
            placeholder="Ex: 10 ou 10.5"
            bind:value={newChapterNumber}
            class="field-input"
          />
        </div>

        <div class="form-field">
          <label for="raw_ch_label" class="field-label">Título / Subtítulo (Opcional)</label>
          <input
            id="raw_ch_label"
            type="text"
            name="chapter_label"
            placeholder="Ex: O Despertar do Monarca"
            bind:value={newChapterLabel}
            class="field-input"
          />
        </div>

        <div class="form-field">
          <label for="raw_ch_prio" class="field-label">Prioridade Editorial</label>
          <select id="raw_ch_prio" name="priority" bind:value={newChapterPriority} class="field-input">
            <option value="NORMAL">Normal</option>
            <option value="HIGH">Alta</option>
            <option value="URGENT">Urgente</option>
          </select>
        </div>

        <div class="form-field full-width">
          <label class="auto-claim-checkbox-label">
            <input type="checkbox" name="auto_claim" value="true" bind:checked={newChapterAutoClaim} />
            <span>Assumir a etapa RAW deste capítulo imediatamente na Minha Fila</span>
          </label>
        </div>

        <div class="form-submit-row">
          <button
            type="button"
            class="btn-cancel-action"
            onclick={() => (showNewChapterCard = false)}
          >
            Cancelar
          </button>
          <button type="submit" class="btn-start-production" disabled={isCreatingChapter}>
            {#if isCreatingChapter}
              <span class="spinner-sm"></span>
              <span>Cadastrando...</span>
            {:else}
              <Plus size={16} />
              <span>Iniciar Produção</span>
            {/if}
          </button>
        </div>
      </form>
    </section>
  {/if}

  <!-- RAW SPECIAL: SELEÇÃO RÁPIDA DE OBRA E CAPÍTULO ELEGÍVEL -->
  {#if activeCanonical.slug === 'raw'}
    <section class="raw-quick-picker-card" aria-label="Entrada e Seleção Rápida de RAW">
      <div class="picker-header">
        <div class="picker-title-lockup">
          <Download size={18} class="text-amber-400" />
          <h3 class="picker-title">Entrada e Seleção de RAW</h3>
        </div>
        <p class="picker-hint">Escolha a obra e o capítulo elegível para iniciar a produção imediata.</p>
      </div>

      <div class="picker-controls">
        <div class="picker-field">
          <label for="pipeline-raw-work-select">Obra da Scan</label>
          <select
            id="pipeline-raw-work-select"
            bind:value={rawSelectedWorkId}
            class="picker-select"
          >
            {#each works as w}
              <option value={w.id}>{w.title}</option>
            {/each}
          </select>
        </div>

        <div class="picker-field">
          <label for="pipeline-raw-chapter-select">Capítulo Elegível para RAW</label>
          <select
            id="pipeline-raw-chapter-select"
            bind:value={rawSelectedChapterStageId}
            class="picker-select"
            disabled={eligibleRawChaptersForWork.length === 0}
          >
            {#if eligibleRawChaptersForWork.length === 0}
              <option value="">Não há capítulos disponíveis para Raw Provider nesta obra.</option>
            {:else}
              <option value="">Selecione o capítulo...</option>
              {#each eligibleRawChaptersForWork as item}
                <option value={item.cs.id}>
                  Capítulo #{item.ch.chapter_number} {item.ch.chapter_label ? `(${item.ch.chapter_label})` : ''}
                </option>
              {/each}
            {/if}
          </select>
        </div>

        <div class="picker-action">
          <form
            method="POST"
            action="?/claimStage"
            use:enhance={() => {
              const stageId = targetRawPickerItem?.cs.id;
              isClaimingStageId = stageId || 'picker';
              return async ({ result, update }) => {
                isClaimingStageId = null;
                if (result.type === 'failure') {
                  claimFeedback = {
                    stageId: stageId || 'picker',
                    type: 'error',
                    text: result.data?.message || 'Este capítulo acabou de ser adquirido por outro membro.'
                  };
                } else {
                  claimFeedback = null;
                  rawSelectedChapterStageId = '';
                  await update();
                }
              };
            }}
          >
            <input type="hidden" name="chapter_stage_id" value={targetRawPickerItem?.cs.id || ''} />
            <button
              type="submit"
              class="btn-claim-highlight"
              class:btn-claim-disabled={!claimEvaluation.canClaim || !targetRawPickerItem}
              disabled={!claimEvaluation.canClaim || !targetRawPickerItem || isClaimingStageId !== null}
              title={!claimEvaluation.canClaim ? 'Você precisa do cargo Raw Provider para assumir esta etapa.' : (!targetRawPickerItem ? 'Selecione um capítulo elegível' : 'Pegar este capítulo')}
            >
              {#if isClaimingStageId === targetRawPickerItem?.cs.id}
                <span class="spinner-xs"></span>
                <span>Pegando...</span>
              {:else if !claimEvaluation.canClaim}
                <Lock size={15} />
                <span>Disponível para Raw Provider</span>
              {:else}
                <Zap size={15} />
                <span>Pegar este capítulo</span>
              {/if}
            </button>
          </form>
        </div>
      </div>

      {#if !claimEvaluation.canClaim}
        <div class="picker-disabled-notice">
          <Info size={14} />
          <span>Você precisa do cargo Raw Provider para assumir esta etapa.</span>
        </div>
      {/if}
    </section>
  {/if}

  <!-- TWO PRINCIPAL SECTIONS -->
  <main class="stage-sections-layout">
    <!-- SECTION 1: CAPÍTULOS DISPONÍVEIS -->
    {#if activeCanonical.slug !== 'publicado'}
      <section class="stage-flow-card available-flow-section">
        <div class="section-top-header">
          <div class="header-titles">
            <div class="title-with-badge">
              <Clock size={18} class="section-icon text-amber-400" />
              <h2 class="section-title">Capítulos disponíveis</h2>
              <span class="count-badge available-badge">{availableItems.length}</span>
            </div>
            <p class="section-subtitle">Capítulos liberados para qualquer membro pegar e produzir</p>
          </div>
        </div>

        {#if availableItems.length === 0}
          <div class="flow-empty-state">
            <div class="empty-icon-wrap">
              <Sparkles size={28} class="empty-icon text-purple-400" />
            </div>
            <h3 class="empty-title">Nenhum capítulo disponível no momento</h3>
            <p class="empty-desc">
              Todos os capítulos nesta etapa já foram assumidos pela equipe ou aguardam a conclusão dos insumos anteriores.
            </p>
          </div>
        {:else}
          <div class="available-accordions-list">
            {#each availableItems as item (item.cs.id)}
              {@const isOpen = Boolean(expandedAvailable[item.cs.id])}
              {@const upstream = getUpstreamFilesForStage(item.cs, item.ch.id)}
              {@const isClaiming = isClaimingStageId === item.cs.id}
              {@const feedback = claimFeedback && claimFeedback.stageId === item.cs.id ? claimFeedback : null}

              <article class="available-accordion-card" class:is-open={isOpen}>
                <!-- ACCORDION CLOSED HEADER / TRIGGER BAR -->
                <div
                  class="accordion-header-bar"
                  role="button"
                  tabindex="0"
                  aria-expanded={isOpen}
                  onclick={() => toggleAvailable(item.cs.id)}
                  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAvailable(item.cs.id); } }}
                >
                  <div class="accordion-header-left">
                    <div class="work-thumbnail sm">
                      {#if item.work?.cover_id}
                        <img src="/media/{item.work.cover_id}" alt={item.work.title} class="thumbnail-img" />
                      {:else}
                        <div class="thumbnail-fallback">NOX</div>
                      {/if}
                    </div>

                    <div class="header-titles-cluster">
                      <span class="work-title-name" title={item.work?.title}>{item.work?.title || 'Obra'}</span>
                      <div class="chapter-number-row">
                        <h4 class="chapter-number-title">
                          Capítulo #{item.ch.chapter_number}
                          {#if item.ch.chapter_label}
                            <span class="chapter-sublabel">· {item.ch.chapter_label}</span>
                          {/if}
                        </h4>
                      </div>
                    </div>

                    <!-- Tags Cluster -->
                    <div class="header-tags-cluster">
                      {#if isStageNewForMe(item)}
                        <span class="personal-badge badge-new" title="Novo trabalho liberado para o seu cargo editorial">
                          <Sparkles size={11} />
                          <span class="badge-text-full">NOVO PARA VOCÊ</span>
                          <span class="badge-text-compact">NOVO</span>
                        </span>
                      {:else if isStageAvailableForMe(item)}
                        <span class="personal-badge badge-available-for-me" title="Disponível para o seu cargo editorial">
                          <Check size={11} />
                          <span class="badge-text-full">Disponível para você</span>
                          <span class="badge-text-compact">Para você</span>
                        </span>
                      {/if}

                      {#if item.cs.status === 'REWORK'}
                        <span class="status-tag tag-rework">
                          <AlertTriangle size={11} /> Retrabalho
                        </span>
                      {:else}
                        <span class="status-tag tag-available">
                          <CheckCircle2 size={11} /> Liberado
                        </span>
                      {/if}

                      {#if item.ch.priority === 'URGENT'}
                        <span class="status-tag tag-urgent">Urgente</span>
                      {:else if item.ch.priority === 'HIGH'}
                        <span class="status-tag tag-high">Alta</span>
                      {/if}

                      {#if activeCanonical.slug === 'typeset'}
                        <span class="status-tag tag-ready-deps">Clean & Tradução Prontos</span>
                      {:else if activeCanonical.slug !== 'raw'}
                        <span class="status-tag tag-ready-deps">Insumos Prontos</span>
                      {/if}
                    </div>
                  </div>

                  <div class="accordion-header-right">
                    <!-- Quick Claim Button in Header -->
                    <form
                      method="POST"
                      action="?/claimStage"
                      use:enhance={() => {
                        isClaimingStageId = item.cs.id;
                        return async ({ result, update }) => {
                          isClaimingStageId = null;
                          if (result.type === 'failure') {
                            claimFeedback = {
                              stageId: item.cs.id,
                              type: 'error',
                              text: result.data?.message || 'Este capítulo acabou de ser pego por outro membro.'
                            };
                            expandedAvailable[item.cs.id] = true;
                          } else {
                            claimFeedback = null;
                            await update();
                          }
                        };
                      }}
                      class="inline-claim-form"
                      onclick={(e) => e.stopPropagation()}
                    >
                      <input type="hidden" name="chapter_stage_id" value={item.cs.id} />
                      <button
                        type="submit"
                        class="btn-claim-primary-compact"
                        class:btn-claim-disabled={!claimEvaluation.canClaim}
                        disabled={isClaiming || !claimEvaluation.canClaim}
                        title={claimEvaluation.disabledReason || (claimEvaluation.isAdminOverride ? 'Assumir via Intervenção Administrativa' : 'Pegar etapa')}
                      >
                        {#if isClaiming}
                          <span class="spinner-xs"></span>
                          <span>Pegando...</span>
                        {:else if !claimEvaluation.canClaim}
                          <Lock size={13} />
                          <span>Bloqueado</span>
                        {:else if claimEvaluation.isAdminOverride}
                          <Shield size={13} />
                          <span>Pegar (Admin)</span>
                        {:else}
                          <CheckCircle2 size={14} />
                          <span>Pegar</span>
                        {/if}
                      </button>
                    </form>

                    <button
                      type="button"
                      class="btn-toggle-details"
                      aria-label={isOpen ? "Ocultar detalhes" : "Ver detalhes"}
                    >
                      <span>{isOpen ? 'Ocultar' : 'Ver detalhes'}</span>
                      <ChevronDown size={15} class="accordion-chevron {isOpen ? 'is-rotated' : ''}" />
                    </button>
                  </div>
                </div>

                <!-- ACCORDION EXPANDED BODY -->
                {#if isOpen}
                  <div class="accordion-expanded-body">
                    {#if feedback}
                      <div class="claim-feedback-alert {feedback.type}">
                        <AlertTriangle size={16} />
                        <span>{feedback.text}</span>
                      </div>
                    {/if}

                    {#if isStageNewForMe(item)}
                      <div class="card-personal-callout new-callout">
                        <Sparkles size={15} class="text-amber-400" />
                        <span>Este capítulo foi liberado para o seu cargo editorial (<strong>{activeCanonical.name}</strong>). Você pode assumi-lo para começar a trabalhar.</span>
                      </div>
                    {:else if isStageAvailableForMe(item)}
                      <div class="card-personal-callout available-callout">
                        <Check size={15} class="text-emerald-400" />
                        <span>Etapa disponível para o seu cargo editorial.</span>
                      </div>
                    {/if}

                    <div class="expanded-details-grid">
                      <!-- Box 1: Sinopse da Obra -->
                      <div class="detail-panel-box">
                        <div class="panel-box-head">
                          <BookOpen size={14} class="text-purple-400" />
                          <span class="box-head-label">Sinopse da Obra</span>
                        </div>
                        <p class="box-head-text synopsis-clamp">
                          {item.work?.synopsis || 'Sem sinopse cadastrada para esta obra.'}
                        </p>
                      </div>

                      <!-- Box 2: Insumos Anteriores (Download direto para inspeção) -->
                      <div class="detail-panel-box">
                        <div class="panel-box-head">
                          <Download size={14} class="text-blue-400" />
                          <span class="box-head-label">Insumos Disponíveis para Baixar</span>
                        </div>
                        {#if upstream.isTypeset}
                          <div class="upstream-pill-list">
                            {#if upstream.cleanFile}
                              <a
                                href="/api/scan/production/files/{upstream.cleanFile.id}?download=1"
                                download={upstream.cleanFile.file_name}
                                class="btn-upstream-dl-pill clean"
                              >
                                <FileText size={13} />
                                <span>Clean: {upstream.cleanFile.file_name} ({formatBytes(upstream.cleanFile.byte_size)})</span>
                              </a>
                            {/if}
                            {#if upstream.tradFile}
                              <a
                                href="/api/scan/production/files/{upstream.tradFile.id}?download=1"
                                download={upstream.tradFile.file_name}
                                class="btn-upstream-dl-pill traducao"
                              >
                                <FileText size={13} />
                                <span>Tradução: {upstream.tradFile.file_name} ({formatBytes(upstream.tradFile.byte_size)})</span>
                              </a>
                            {/if}
                          </div>
                        {:else if upstream.all.length > 0}
                          <div class="upstream-pill-list">
                            {#each upstream.all as file}
                              <a
                                href="/api/scan/production/files/{file.id}?download=1"
                                download={file.file_name}
                                class="btn-upstream-dl-pill"
                              >
                                <FileText size={13} />
                                <span>{file.file_name} (v{file.version} · {formatBytes(file.byte_size)})</span>
                              </a>
                            {/each}
                          </div>
                        {:else}
                          <span class="no-insumo-text">
                            {activeCanonical.slug === 'raw'
                              ? 'Etapa de entrada: cadastre ou envie os arquivos RAW.'
                              : 'Nenhum insumo de etapa anterior anexado.'}
                          </span>
                        {/if}
                      </div>

                      <!-- Box 3: Apontamentos / Retrabalho / Observações -->
                      {#if item.cs.status === 'REWORK' || item.cs.rejection_reason || item.cs.notes}
                        <div class="detail-panel-box alert-box">
                          <div class="panel-box-head">
                            <AlertTriangle size={14} class="text-amber-400" />
                            <span class="box-head-label">
                              {item.cs.status === 'REWORK' ? 'Instruções de Retrabalho' : 'Observações Editoriais'}
                            </span>
                          </div>
                          <p class="box-head-text rework-alert-text">
                            {item.cs.rejection_reason || item.cs.notes}
                          </p>
                        </div>
                      {/if}
                    </div>

                    <!-- FOOTER ACTIONS OF EXPANDED CARD -->
                    <div class="accordion-expanded-footer">
                      <!-- Left: Role-Gated Admin Controls -->
                      <div class="footer-admin-cluster">
                        {#if isOwnerOrAdmin}
                          <button
                            type="button"
                            class="btn-action-ghost"
                            onclick={() => openEditModal(item)}
                            title="Editar detalhes deste capítulo"
                          >
                            <Edit2 size={13} />
                            <span>Editar Capítulo</span>
                          </button>

                          {#if item.ch.status !== 'PUBLISHED'}
                            <button
                              type="button"
                              class="btn-action-ghost danger"
                              onclick={() => openDeleteModal(item)}
                              title="Excluir produção deste capítulo"
                            >
                              <Trash2 size={13} />
                              <span>Excluir Produção</span>
                            </button>
                          {/if}
                        {/if}
                      </div>

                      <!-- Right: Prominent Primary Claim CTA -->
                      <div class="footer-primary-cta">
                        <form
                          method="POST"
                          action="?/claimStage"
                          use:enhance={() => {
                            isClaimingStageId = item.cs.id;
                            return async ({ result, update }) => {
                              isClaimingStageId = null;
                              if (result.type === 'failure') {
                                claimFeedback = {
                                  stageId: item.cs.id,
                                  type: 'error',
                                  text: result.data?.message || 'Este capítulo acabou de ser pego por outro membro.'
                                };
                              } else {
                                claimFeedback = null;
                                await update();
                              }
                            };
                          }}
                        >
                          <input type="hidden" name="chapter_stage_id" value={item.cs.id} />
                          <button
                            type="submit"
                            class="btn-claim-prominent"
                            class:btn-claim-disabled={!claimEvaluation.canClaim}
                            class:btn-claim-admin-override={claimEvaluation.isAdminOverride}
                            disabled={isClaiming || !claimEvaluation.canClaim}
                            title={claimEvaluation.disabledReason}
                          >
                            {#if isClaiming}
                              <span class="spinner-sm"></span>
                              <span>Assumindo capítulo...</span>
                            {:else if !claimEvaluation.canClaim}
                              <Lock size={17} />
                              <span>{claimEvaluation.buttonLabel}</span>
                            {:else if claimEvaluation.isAdminOverride}
                              <Shield size={17} />
                              <span>{claimEvaluation.buttonLabel}</span>
                            {:else}
                              <CheckCircle2 size={17} />
                              <span>{claimEvaluation.buttonLabel}</span>
                            {/if}
                          </button>
                        </form>
                        {#if !claimEvaluation.canClaim && claimEvaluation.disabledReason}
                          <div class="claim-disabled-hint">
                            <Info size={13} />
                            <span>{claimEvaluation.disabledReason}</span>
                          </div>
                        {/if}
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

    <!-- SECTION 2: MEUS CAPÍTULOS -->
    <section class="stage-flow-card my-chapters-section">
      <div class="section-top-header">
        <div class="header-titles">
          <div class="title-with-badge">
            <CheckSquare size={18} class="section-icon text-purple-400" />
            <h2 class="section-title">
              {activeCanonical.slug === 'publicado' ? 'Capítulos Publicados' : 'Meus capítulos'}
            </h2>
            <span class="count-badge mine-badge">{myItems.length}</span>
          </div>
          <p class="section-subtitle">
            {activeCanonical.slug === 'publicado'
              ? 'Histórico completo de capítulos lançados publicamente no Project Nox.'
              : 'Capítulos sob sua responsabilidade para produzir e concluir.'}
          </p>
        </div>
      </div>

      {#if myItems.length === 0}
        <div class="flow-empty-state">
          <div class="empty-icon-wrap">
            <BookOpen size={28} class="empty-icon text-indigo-400" />
          </div>
          <h3 class="empty-title">
            {activeCanonical.slug === 'publicado'
              ? 'Nenhum capítulo publicado registrado ainda.'
              : 'Você não tem capítulos sob sua responsabilidade nesta etapa.'}
          </h3>
          <p class="empty-desc">
            {activeCanonical.slug === 'publicado'
              ? 'Quando um capítulo for concluído no Ready e publicado, ele aparecerá aqui.'
              : 'Pegue um dos capítulos disponíveis acima para começar a produzir!'}
          </p>
        </div>
      {:else}
        <div class="my-chapters-accordions-list">
          {#each myItems as item, idx (item.cs.id)}
            {@const isOpen = isMyChapterOpen(item.cs.id, idx)}
            {@const upstream = getUpstreamFilesForStage(item.cs, item.ch.id)}
            {@const deliverable = getCurrentDeliverableFile(item.cs, item.ch.id)}
            {@const checks = getRevisionChecks(item.cs.id)}
            {@const isTypesetStage = matchesStageSlug(activeCanonical.slug, 'typeset')}
            {@const isRevisorQcStage = matchesStageSlug(activeCanonical.slug, 'revisor_qc')}
            {@const isReadyStage = matchesStageSlug(activeCanonical.slug, 'pre_aprovado')}
            {@const isPublicado = matchesStageSlug(activeCanonical.slug, 'publicado')}
            {@const isBusyUploading = uploadBusyStageId === item.cs.id}
            {@const canComplete = !activeCanonical.requiresOutput || Boolean(deliverable)}

            <article class="my-chapter-accordion-card" class:is-open={isOpen}>
              <!-- CLOSED HEADER / TRIGGER BAR -->
              <div
                class="accordion-header-bar my-header"
                role="button"
                tabindex="0"
                aria-expanded={isOpen}
                onclick={() => toggleMyChapter(item.cs.id)}
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMyChapter(item.cs.id); } }}
              >
                <div class="accordion-header-left">
                  <div class="work-thumbnail sm">
                    {#if item.work?.cover_id}
                      <img src="/media/{item.work.cover_id}" alt={item.work.title} class="thumbnail-img" />
                    {:else}
                      <div class="thumbnail-fallback">NOX</div>
                    {/if}
                  </div>

                  <div class="header-titles-cluster">
                    <span class="work-title-name" title={item.work?.title}>{item.work?.title || 'Obra'}</span>
                    <h3 class="chapter-number-title">
                      Capítulo #{item.ch.chapter_number}
                      {#if item.ch.chapter_label}
                        <span class="chapter-sublabel">· {item.ch.chapter_label}</span>
                      {/if}
                    </h3>
                  </div>

                  <div class="header-tags-cluster">
                    <span class="stage-tag" style="--tag-color: {activeCanonical.color}">
                      <span class="tag-dot" style="background: {activeCanonical.color}"></span>
                      {activeCanonical.name}
                    </span>

                    {#if item.cs.status === 'REWORK'}
                      <span class="status-tag tag-rework">Retrabalho</span>
                    {:else}
                      <span class="status-tag tag-in-progress">Em Andamento</span>
                    {/if}

                    {#if item.ch.priority === 'URGENT'}
                      <span class="status-tag tag-urgent">Urgente</span>
                    {:else if item.ch.priority === 'HIGH'}
                      <span class="status-tag tag-high">Alta</span>
                    {/if}
                  </div>
                </div>

                <div class="accordion-header-right">
                  {#if isPublicado}
                    <a
                      href="/ler/{item.ch.target_chapter_id || item.ch.id}"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn-view-chapter-outline"
                      onclick={(e) => e.stopPropagation()}
                    >
                      <Globe size={14} />
                      <span>Ler no Site</span>
                    </a>
                  {:else}
                    <button
                      type="button"
                      class="btn-view-chapter-outline"
                      onclick={(e) => { e.stopPropagation(); onOpenChapter(item.ch); }}
                    >
                      <Eye size={14} />
                      <span>Ver capítulo</span>
                    </button>
                  {/if}

                  {#if isOwnerOrAdmin}
                    <button
                      type="button"
                      class="btn-icon-control"
                      title="Editar capítulo"
                      onclick={(e) => { e.stopPropagation(); openEditModal(item); }}
                    >
                      <Edit2 size={13} />
                    </button>
                    {#if item.ch.status !== 'PUBLISHED'}
                      <button
                        type="button"
                        class="btn-icon-control danger"
                        title="Excluir produção"
                        onclick={(e) => { e.stopPropagation(); openDeleteModal(item); }}
                      >
                        <Trash2 size={13} />
                      </button>
                    {/if}
                  {/if}

                  {#if !isPublicado}
                    <button type="button" class="btn-toggle-details">
                      <span>{isOpen ? 'Recolher passos' : 'Ver passos / Produzir'}</span>
                      <ChevronDown size={15} class="accordion-chevron {isOpen ? 'is-rotated' : ''}" />
                    </button>
                  {/if}
                </div>
              </div>

              <!-- EXPANDED OPERATIONAL STEPS -->
              {#if isOpen && !isPublicado}
                <div class="accordion-expanded-body my-body">
                  <!-- NUMBERED ACTION STEPS -->
                  <div class="card-steps-container">
                    <!-- PASSO 1: BAIXAR ARQUIVOS NECESSÁRIOS -->
                    <div class="numbered-step-box">
                      <div class="step-head">
                        <span class="step-badge">1</span>
                        <div class="step-head-text">
                          <h4 class="step-title">Baixar os arquivos necessários</h4>
                          <p class="step-desc">Insumos gerados pelas etapas anteriores para você trabalhar.</p>
                        </div>
                      </div>

                      <div class="step-body">
                        {#if isTypesetStage}
                          <!-- Clearly separate Clean and Tradução for Typeset -->
                          <div class="typeset-dual-downloads">
                            <div class="dual-download-card">
                              <span class="dual-label text-pink-400">Insumo: Clean / Redraw</span>
                              {#if upstream.cleanFile}
                                <div class="file-item-pill">
                                  <FileText size={16} class="text-pink-400" />
                                  <div class="file-pill-info">
                                    <span class="pill-name">{upstream.cleanFile.file_name}</span>
                                    <span class="pill-meta">v{upstream.cleanFile.version} · {formatBytes(upstream.cleanFile.byte_size)}</span>
                                  </div>
                                  <a
                                    href="/api/scan/production/files/{upstream.cleanFile.id}?download=1"
                                    download={upstream.cleanFile.file_name}
                                    class="btn-download-pill"
                                  >
                                    <Download size={14} />
                                    <span>Baixar Clean</span>
                                  </a>
                                </div>
                              {:else}
                                <div class="waiting-dep-box">Aguardando envio do arquivo Clean</div>
                              {/if}
                            </div>

                            <div class="dual-download-card">
                              <span class="dual-label text-blue-400">Insumo: Tradução</span>
                              {#if upstream.tradFile}
                                <div class="file-item-pill">
                                  <FileText size={16} class="text-blue-400" />
                                  <div class="file-pill-info">
                                    <span class="pill-name">{upstream.tradFile.file_name}</span>
                                    <span class="pill-meta">v{upstream.tradFile.version} · {formatBytes(upstream.tradFile.byte_size)}</span>
                                  </div>
                                  <a
                                    href="/api/scan/production/files/{upstream.tradFile.id}?download=1"
                                    download={upstream.tradFile.file_name}
                                    class="btn-download-pill"
                                  >
                                    <Download size={14} />
                                    <span>Baixar Tradução</span>
                                  </a>
                                </div>
                              {:else}
                                <div class="waiting-dep-box">Aguardando envio do script de Tradução</div>
                              {/if}
                            </div>
                          </div>
                        {:else if upstream.all.length > 0}
                          <div class="upstream-files-row">
                            {#each upstream.all as file}
                              <div class="file-item-pill">
                                <FileText size={16} class="text-purple-400" />
                                <div class="file-pill-info">
                                  <span class="pill-name">{file.file_name}</span>
                                  <span class="pill-meta">
                                    {file.stage?.name || file.stage_slug || 'Etapa anterior'} · v{file.version} · {formatBytes(file.byte_size)}
                                  </span>
                                </div>
                                <a
                                  href="/api/scan/production/files/{file.id}?download=1"
                                  download={file.file_name}
                                  class="btn-download-pill"
                                >
                                  <Download size={14} />
                                  <span>Baixar</span>
                                </a>
                              </div>
                            {/each}
                          </div>
                        {:else}
                          <div class="no-deps-note">
                            {#if activeCanonical.slug === 'raw'}
                              <span>Etapa inicial: Utilize os arquivos RAW originais da fonte ou anexe o pacote inicial.</span>
                            {:else}
                              <span>Nenhum arquivo anterior registrado no sistema para esta etapa.</span>
                            {/if}
                          </div>
                        {/if}
                      </div>
                    </div>

                    <!-- PASSO 2: ENVIAR ARQUIVO FINALIZADO / CONFERÊNCIA -->
                    <div class="numbered-step-box">
                      <div class="step-head">
                        <span class="step-badge">2</span>
                        <div class="step-head-text">
                          <h4 class="step-title">
                            {isRevisorQcStage
                              ? 'Conferência e Inspeção de Revisor (QC)'
                              : 'Enviar o arquivo finalizado'}
                          </h4>
                          <p class="step-desc">
                            {isRevisorQcStage
                              ? 'Revise os textos, termos, diagramação e realize a auditoria de qualidade nas páginas.'
                              : 'Envie seu arquivo pronto (ZIP, PSD, script ou imagens).'}
                          </p>
                        </div>
                      </div>

                      <div class="step-body">
                        {#if isRevisorQcStage}
                          <!-- Checklist for Revisor (QC) -->
                          <div class="revision-checklist-grid">
                            <label class="check-item-row">
                              <input type="checkbox" bind:checked={checks.spell} />
                              <span>Ortografia, concordância e pontuação conferidas</span>
                            </label>
                            <label class="check-item-row">
                              <input type="checkbox" bind:checked={checks.terms} />
                              <span>Termos e golpes alinhados com o glossário da obra</span>
                            </label>
                            <label class="check-item-row">
                              <input type="checkbox" bind:checked={checks.formatting} />
                              <span>Diagramação e controle de qualidade visual auditados</span>
                            </label>
                          </div>

                          <div class="revision-notes-field">
                            <label for="rev_notes_{item.cs.id}" class="notes-label">Notas e apontamentos de Revisão (QC) (opcional):</label>
                            <textarea
                              id="rev_notes_{item.cs.id}"
                              bind:value={revisionNotes[item.cs.id]}
                              placeholder="Apontamentos de revisão e controle de qualidade..."
                              rows="2"
                              class="notes-textarea"
                            ></textarea>
                          </div>

                          <div class="qc-inspection-action-row" style="margin-top: 0.75rem;">
                            <button
                              type="button"
                              class="btn-open-qc-inspector"
                              onclick={() => onOpenChapter(item.ch)}
                            >
                              <FileCheck2 size={16} />
                              <span>Abrir QC Inspector no Capítulo</span>
                            </button>

                            <button
                              type="button"
                              class="btn-request-rework-trigger"
                              onclick={() => openReworkModal(item)}
                            >
                              <AlertTriangle size={15} />
                              <span>Solicitar Retrabalho de Etapa</span>
                            </button>
                          </div>
                        {:else}
                          <!-- Upload Deliverable File -->
                          {#if deliverable}
                            <div class="current-uploaded-file-banner">
                              <CheckCircle2 size={18} class="text-emerald-400" />
                              <div class="uploaded-meta">
                                <strong>Arquivo pronto: {deliverable.file_name}</strong>
                                <span>Versão v{deliverable.version} · {formatBytes(deliverable.byte_size)}</span>
                              </div>
                              <label class="btn-reupload-label">
                                <input
                                  type="file"
                                  class="hidden-file-input"
                                  onchange={(e) => handleFileUpload(e, item)}
                                  disabled={isBusyUploading}
                                />
                                <span>Substituir</span>
                              </label>
                            </div>
                          {/if}

                          <div class="upload-drop-zone">
                            {#if isBusyUploading}
                              <div class="upload-progress-box">
                                <div class="progress-bar-track">
                                  <div class="progress-bar-fill" style="width: {uploadProgress}%"></div>
                                </div>
                                <span class="progress-text">Enviando arquivo ({uploadProgress}%)...</span>
                              </div>
                            {:else}
                              <label class="drop-zone-label">
                                <Upload size={22} class="upload-icon-cloud" />
                                <span class="upload-prompt-title">
                                  {deliverable ? 'Enviar nova versão do arquivo' : 'Selecionar arquivo final da etapa'}
                                </span>
                                <span class="upload-prompt-hint">Formatos suportados: ZIP, RAR, DOCX, TXT, PSD ou PNG/JPG</span>
                                <input
                                  type="file"
                                  class="hidden-file-input"
                                  onchange={(e) => handleFileUpload(e, item)}
                                />
                              </label>
                            {/if}
                          </div>

                          {#if uploadFeedback && uploadFeedback.stageId === item.cs.id}
                            <div class="upload-feedback-banner {uploadFeedback.type}">
                              {#if uploadFeedback.type === 'success'}
                                <CheckCircle2 size={16} />
                              {:else}
                                <AlertCircle size={16} />
                              {/if}
                              <span>{uploadFeedback.text}</span>
                            </div>
                          {/if}
                        {/if}
                      </div>
                    </div>

                    <!-- PASSO 3: CONCLUIR ETAPA (WITH STRICT SEPARATION OF ACTIONS) -->
                    <div class="numbered-step-box step-3-complete">
                      <div class="step-head">
                        <span class="step-badge complete">3</span>
                        <div class="step-head-text">
                          <h4 class="step-title">Concluir etapa e repassar</h4>
                          <p class="step-desc">Finalize para liberar automaticamente a próxima etapa do DAG.</p>
                        </div>
                      </div>

                      <div class="step-body-footer">
                        <div class="completion-actions-cluster">
                          <!-- Primary Complete CTA -->
                          <form method="POST" action="?/completeStageAction" use:enhance>
                            <input type="hidden" name="chapter_stage_id" value={item.cs.id} />
                            {#if isRevisorQcStage}
                              <input type="hidden" name="notes" value={revisionNotes[item.cs.id] || ''} />
                            {/if}

                            <button
                              type="submit"
                              class="btn-complete-editorial"
                              disabled={!canComplete}
                              title={!canComplete ? 'Envie o arquivo final no Passo 2 antes de concluir' : 'Concluir esta etapa'}
                            >
                              <CheckCircle2 size={16} />
                              <span>Concluir Etapa</span>
                            </button>
                          </form>

                          {#if isReadyStage && isOwnerOrAdmin}
                            <form method="POST" action="?/publishProductionChapter" use:enhance>
                              <input type="hidden" name="production_chapter_id" value={item.ch.id} />
                              <button type="submit" class="btn-publish-site">
                                <Globe size={16} />
                                <span>Publicar no Site</span>
                              </button>
                            </form>
                          {/if}

                          <div class="editorial-returns-separator"></div>

                          <!-- Action: Devolver à fila (Abandon task back to public queue) -->
                          <form
                            method="POST"
                            action="?/releaseStage"
                            use:enhance={({ cancel }) => {
                              if (!confirm('Devolver à fila: você deixará de ser o responsável por esta etapa e ela ficará disponível para qualquer membro pegar. Deseja continuar?')) {
                                cancel();
                              }
                            }}
                          >
                            <input type="hidden" name="chapter_stage_id" value={item.cs.id} />
                            <button
                              type="submit"
                              class="btn-abandon-queue"
                              title="Largar etapa e devolvê-la para a fila de capítulos disponíveis"
                            >
                              <RotateCcw size={14} />
                              <span>Devolver à fila</span>
                            </button>
                          </form>

                          <!-- Action: Devolver para Retrabalho (Editorial return with reason) -->
                          {#if isRevisorQcStage}
                            <button
                              type="button"
                              class="btn-rework-editorial"
                              onclick={() => openReworkModal(item)}
                              title="Apontar correções e devolver para uma etapa anterior"
                            >
                              <AlertTriangle size={14} />
                              <span>Devolver para Retrabalho</span>
                            </button>
                          {/if}
                        </div>

                        {#if !canComplete && activeCanonical.requiresOutput}
                          <span class="gate-warning-hint">
                            ⚠️ Envie o arquivo finalizado no Passo 2 para habilitar o botão de conclusão.
                          </span>
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
  </main>
</div>

<!-- EDIT PRODUCTION CHAPTER MODAL -->
{#if showEditModal && editTargetItem}
  <div class="modal-backdrop" onclick={() => (showEditModal = false)}>
    <div class="standard-modal-dialog" onclick={(e) => e.stopPropagation()}>
      <div class="modal-top">
        <div class="modal-title-wrap">
          <Edit2 size={18} class="text-purple-400" />
          <h3>Editar Capítulo em Produção</h3>
        </div>
        <button type="button" class="btn-close-modal" onclick={() => (showEditModal = false)}>
          <X size={18} />
        </button>
      </div>

      <p class="modal-subtitle">
        Obra: <strong>{editTargetItem.work?.title}</strong> · Capítulo #{editTargetItem.ch.chapter_number}
      </p>

      <form
        method="POST"
        action="?/updateProductionChapter"
        use:enhance={() => {
          isEditingChapter = true;
          return async ({ update }) => {
            await update();
            isEditingChapter = false;
            showEditModal = false;
          };
        }}
        class="standard-form-grid"
      >
        <input type="hidden" name="production_chapter_id" value={editTargetItem.ch.id} />

        <div class="form-field">
          <label for="edit_ch_label" class="field-label">Título / Subtítulo do Capítulo</label>
          <input
            id="edit_ch_label"
            type="text"
            name="chapter_label"
            placeholder="Ex: O Retorno do Guerreiro"
            bind:value={editChapterLabel}
            class="field-input"
          />
        </div>

        <div class="form-field">
          <label for="edit_ch_priority" class="field-label">Prioridade Editorial</label>
          <select id="edit_ch_priority" name="priority" bind:value={editChapterPriority} class="field-input">
            <option value="LOW">Baixa</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">Alta</option>
            <option value="URGENT">Urgente</option>
          </select>
        </div>

        <div class="form-field">
          <label for="edit_ch_notes" class="field-label">Notas / Observações da Equipe</label>
          <textarea
            id="edit_ch_notes"
            name="notes"
            rows="3"
            placeholder="Instruções específicas para quem pegar esta etapa..."
            bind:value={editChapterNotes}
            class="notes-textarea"
          ></textarea>
        </div>

        <div class="modal-buttons-row">
          <button type="button" class="btn-cancel-action" onclick={() => (showEditModal = false)}>
            Cancelar
          </button>
          <button type="submit" class="btn-confirm-primary" disabled={isEditingChapter}>
            {#if isEditingChapter}
              <span class="spinner-sm"></span>
              <span>Salvando...</span>
            {:else}
              <Check size={16} />
              <span>Salvar Alterações</span>
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- DELETE PRODUCTION CHAPTER CONFIRMATION MODAL -->
{#if showDeleteModal && deleteTargetItem}
  <div class="modal-backdrop" onclick={() => (showDeleteModal = false)}>
    <div class="standard-modal-dialog delete-dialog" onclick={(e) => e.stopPropagation()}>
      <div class="modal-top">
        <div class="modal-title-wrap text-rose">
          <Trash2 size={20} class="text-rose-500" />
          <h3>Excluir Produção de Capítulo</h3>
        </div>
        <button type="button" class="btn-close-modal" onclick={() => (showDeleteModal = false)}>
          <X size={18} />
        </button>
      </div>

      <div class="delete-warning-box">
        <AlertTriangle size={20} class="text-rose-400 flex-shrink-0" />
        <div>
          <strong>Atenção: Esta ação é irreversível!</strong>
          <p>
            Você está prestes a excluir toda a linha de produção do <strong>Capítulo #{deleteTargetItem.ch.chapter_number}</strong>
            {#if deleteTargetItem.ch.chapter_label}
              ({deleteTargetItem.ch.chapter_label})
            {/if}
            da obra <strong>{deleteTargetItem.work?.title}</strong>. Todos os arquivos de rascunho e etapas associadas serão removidos.
          </p>
        </div>
      </div>

      {#if deleteError}
        <div class="delete-error-banner">
          <AlertCircle size={16} />
          <span>{deleteError}</span>
        </div>
      {/if}

      <form
        method="POST"
        action="?/deleteProductionChapter"
        use:enhance={({ cancel }) => {
          const expected = String(deleteTargetItem.ch.chapter_number);
          if (deleteConfirmationText.trim() !== expected && deleteConfirmationText.trim() !== 'CONFIRMAR') {
            deleteError = `Para confirmar, digite o número do capítulo (${expected}) ou CONFIRMAR.`;
            cancel();
            return;
          }
          isDeletingChapter = true;
          return async ({ result, update }) => {
            isDeletingChapter = false;
            if (result.type === 'failure') {
              deleteError = result.data?.message || 'Falha ao excluir produção.';
            } else {
              showDeleteModal = false;
              await update();
            }
          };
        }}
        class="standard-form-grid"
      >
        <input type="hidden" name="production_chapter_id" value={deleteTargetItem.ch.id} />
        <input type="hidden" name="reason" value={deleteReason} />

        <div class="form-field">
          <label for="delete_conf_field" class="field-label">
            Digite <strong class="text-rose-400">{deleteTargetItem.ch.chapter_number}</strong> para confirmar:
          </label>
          <input
            id="delete_conf_field"
            type="text"
            name="confirmation"
            required
            autocomplete="off"
            placeholder={String(deleteTargetItem.ch.chapter_number)}
            bind:value={deleteConfirmationText}
            class="field-input delete-input"
          />
        </div>

        <div class="modal-buttons-row">
          <button type="button" class="btn-cancel-action" onclick={() => (showDeleteModal = false)}>
            Cancelar
          </button>
          <button
            type="submit"
            class="btn-confirm-danger"
            disabled={isDeletingChapter || (deleteConfirmationText.trim() !== String(deleteTargetItem.ch.chapter_number) && deleteConfirmationText.trim() !== 'CONFIRMAR')}
          >
            {#if isDeletingChapter}
              <span class="spinner-sm"></span>
              <span>Excluindo...</span>
            {:else}
              <Trash2 size={15} />
              <span>Excluir Definitivamente</span>
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- REWORK RETURN MODAL -->
{#if showReworkModal}
  <div class="modal-backdrop" onclick={() => (showReworkModal = false)}>
    <div class="rework-modal-dialog" onclick={(e) => e.stopPropagation()}>
      <div class="modal-top">
        <div class="modal-title-wrap">
          <AlertTriangle size={20} class="text-amber-400" />
          <h3>Solicitar Retrabalho de Etapa</h3>
        </div>
        <button type="button" class="btn-close-modal" onclick={() => (showReworkModal = false)}>
          <X size={18} />
        </button>
      </div>

      <p class="modal-subtitle">
        Capítulo: <strong>{reworkChapterTitle}</strong>. A etapa selecionada voltará ao status de Retrabalho com suas observações.
      </p>

      <form
        method="POST"
        action="?/returnStageAction"
        use:enhance={() => {
          return async ({ update }) => {
            await update();
            showReworkModal = false;
          };
        }}
        class="rework-form"
      >
        <input type="hidden" name="source_stage_id" value={reworkSourceStageId} />

        <div class="form-field">
          <label for="rework_target" class="field-label">Etapa de destino para correção *</label>
          <select id="rework_target" name="target_stage_slug" bind:value={reworkTargetSlug} class="field-input">
            <option value="raw">Raw Provider</option>
            <option value="traducao">Tradução</option>
            <option value="clean_redraw">Clean/Redraw</option>
            <option value="typeset">Typeset</option>
          </select>
        </div>

        <div class="form-field">
          <label for="rework_reason" class="field-label">Motivo do retrabalho / Instruções de correção *</label>
          <textarea
            id="rework_reason"
            name="reason"
            required
            minlength="3"
            rows="3"
            bind:value={reworkReason}
            placeholder="Especifique com clareza as páginas, balões ou falhas que precisam ser ajustadas..."
            class="notes-textarea"
          ></textarea>
        </div>

        <div class="modal-buttons-row">
          <button type="button" class="btn-cancel-action" onclick={() => (showReworkModal = false)}>
            Cancelar
          </button>
          <button
            type="submit"
            class="btn-confirm-rework"
            disabled={reworkReason.trim().length < 3}
          >
            <AlertTriangle size={15} />
            <span>Confirmar Retrabalho</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .pipeline-stage-view-root {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    padding-bottom: 3rem;
  }

  /* HEADER */
  .stage-page-header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: linear-gradient(180deg, rgba(20, 20, 32, 0.95) 0%, rgba(13, 13, 22, 0.98) 100%);
    border: 1px solid rgba(147, 51, 234, 0.15);
    border-radius: 14px;
    padding: 1.25rem 1.5rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
  }

  .breadcrumb-trail {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: #94a3b8;
    flex-wrap: wrap;
  }

  .crumb-parent {
    color: #94a3b8;
  }

  .crumb-sep {
    opacity: 0.5;
  }

  .crumb-active {
    font-weight: 600;
  }

  .stage-hero-headline {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .headline-title-lockup {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .stage-main-title {
    font-size: 1.75rem;
    font-weight: 800;
    color: #f8fafc;
    letter-spacing: -0.02em;
    margin: 0;
  }

  .stage-hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    border: 1px solid transparent;
  }

  .badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .stage-hero-subtitle {
    font-size: 0.9375rem;
    color: #94a3b8;
    margin: 0;
    line-height: 1.4;
  }

  /* QUICK STAGES PILL TRACK */
  .quick-stages-pill-nav {
    overflow-x: auto;
    scrollbar-width: thin;
    padding-bottom: 0.25rem;
    margin-top: 0.25rem;
  }

  .pill-nav-scroll-track {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: max-content;
  }

  .stage-pill-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 9999px;
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #cbd5e1;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .stage-pill-btn:hover {
    background: rgba(255, 255, 255, 0.07);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.15);
  }

  .stage-pill-btn.is-active {
    background: rgba(147, 51, 234, 0.15);
    border-color: var(--pill-accent, #a855f7);
    color: #ffffff;
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.25);
    font-weight: 600;
  }

  .pill-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .pill-count-chip {
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 0.1rem 0.35rem;
    background: rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
    border-radius: 6px;
  }

  .pill-count-chip.has-mine {
    background: #7c3aed;
    color: #ffffff;
  }

  /* TOOLBAR */
  .stage-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 0.5rem;
    flex-wrap: wrap;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    flex-wrap: wrap;
  }

  .search-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 200px;
    max-width: 320px;
  }

  .search-icon {
    position: absolute;
    left: 0.75rem;
    color: #64748b;
    pointer-events: none;
  }

  .search-text-field {
    width: 100%;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 0.5rem 2rem 0.5rem 2.25rem;
    color: #f8fafc;
    font-size: 0.8125rem;
  }

  .search-text-field:focus {
    outline: none;
    border-color: #a855f7;
    box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.2);
  }

  .btn-clear-search {
    position: absolute;
    right: 0.625rem;
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
  }

  .filter-select-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .filter-icon {
    position: absolute;
    left: 0.75rem;
    color: #64748b;
    pointer-events: none;
  }

  .work-select-field {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 0.5rem 1rem 0.5rem 2.25rem;
    color: #f8fafc;
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .btn-new-chapter-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: #7c3aed;
    color: #ffffff;
    border: none;
    border-radius: 8px;
    padding: 0.5rem 0.875rem;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .btn-new-chapter-trigger:hover {
    background: #6d28d9;
  }

  /* RAW SPECIAL FORM CARD */
  .raw-new-chapter-card {
    background: linear-gradient(180deg, rgba(26, 26, 42, 0.95) 0%, rgba(15, 15, 24, 0.98) 100%);
    border: 1px solid rgba(234, 179, 8, 0.3);
    border-radius: 12px;
    padding: 1.25rem 1.5rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  }

  .card-glass-header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .raw-icon-box {
    padding: 0.5rem;
    background: rgba(234, 179, 8, 0.12);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-headline-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .card-headline-subtitle {
    font-size: 0.8125rem;
    color: #94a3b8;
    margin: 0.2rem 0 0;
  }

  .new-chapter-form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .field-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #cbd5e1;
  }

  .field-input {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    color: #f8fafc;
    font-size: 0.8125rem;
  }

  .field-input:focus {
    outline: none;
    border-color: #eab308;
  }

  .form-submit-row {
    grid-column: 1 / -1;
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .btn-start-production {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: #eab308;
    color: #0f172a;
    font-weight: 700;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .btn-start-production:hover:not(:disabled) {
    background: #facc15;
  }

  .btn-cancel-action {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    border-radius: 6px;
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
    cursor: pointer;
  }

  /* RAW Quick Picker Card */
  .raw-quick-picker-card {
    background: linear-gradient(90deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 12px;
    padding: 1.15rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
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

  .picker-title {
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

  .picker-select {
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 0.55rem 0.75rem;
    color: #f8fafc;
    font-size: 0.85rem;
    width: 100%;
    min-height: 38px;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .picker-select:focus {
    border-color: #f59e0b;
  }

  .picker-select:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .picker-action {
    display: flex;
    align-items: flex-end;
  }

  .btn-claim-highlight {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: #0f172a;
    border: none;
    padding: 0.6rem 1.25rem;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 800;
    cursor: pointer;
    min-height: 38px;
    white-space: nowrap;
    transition: transform 0.15s ease, filter 0.15s ease, opacity 0.15s ease;
  }

  .btn-claim-highlight:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: brightness(1.1);
  }

  .btn-claim-highlight:disabled,
  .btn-claim-highlight.btn-claim-disabled {
    background: rgba(39, 39, 42, 0.8);
    color: #71717a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    cursor: not-allowed;
    transform: none;
    filter: none;
  }

  .picker-disabled-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.775rem;
    color: #fbbf24;
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: 6px;
    padding: 0.45rem 0.75rem;
  }

  .auto-claim-checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.8125rem;
    color: #cbd5e1;
    cursor: pointer;
    user-select: none;
  }

  .auto-claim-checkbox-label input[type="checkbox"] {
    accent-color: #f59e0b;
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .full-width {
    grid-column: 1 / -1;
  }

  /* PRINCIPAL SECTIONS LAYOUT */
  .stage-sections-layout {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .stage-flow-card {
    background: rgba(15, 15, 24, 0.8);
    border: 1px solid rgba(147, 51, 234, 0.12);
    border-radius: 14px;
    padding: 1.5rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .section-top-header {
    margin-bottom: 1.25rem;
  }

  .title-with-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .count-badge {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.15rem 0.5rem;
    border-radius: 9999px;
  }

  .count-badge.available-badge {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .count-badge.mine-badge {
    background: rgba(168, 85, 247, 0.15);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.3);
  }

  .section-subtitle {
    font-size: 0.875rem;
    color: #94a3b8;
    margin: 0.25rem 0 0;
  }

  /* EMPTY STATES */
  .flow-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1.5rem;
    text-align: center;
    background: rgba(0, 0, 0, 0.2);
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 12px;
  }

  .empty-icon-wrap {
    padding: 0.875rem;
    background: rgba(147, 51, 234, 0.1);
    border-radius: 50%;
    margin-bottom: 0.75rem;
  }

  .empty-title {
    font-size: 1rem;
    font-weight: 600;
    color: #e2e8f0;
    margin: 0;
  }

  .empty-desc {
    font-size: 0.8125rem;
    color: #64748b;
    margin: 0.375rem 0 0;
    max-width: 440px;
    line-height: 1.4;
  }

  /* ACCORDION CONTAINERS & CARDS */
  .available-accordions-list,
  .my-chapters-accordions-list {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    width: 100%;
  }

  .available-accordion-card,
  .my-chapter-accordion-card {
    width: 100%;
    box-sizing: border-box;
    background: rgba(20, 20, 32, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    overflow: hidden;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  }

  .available-accordion-card:hover,
  .my-chapter-accordion-card:hover {
    border-color: rgba(168, 85, 247, 0.25);
    background: rgba(24, 24, 38, 0.9);
  }

  .available-accordion-card.is-open,
  .my-chapter-accordion-card.is-open {
    border-color: rgba(168, 85, 247, 0.4);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
  }

  /* ACCORDION HEADER BAR (TRIGGER) */
  .accordion-header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.875rem 1.25rem;
    cursor: pointer;
    user-select: none;
    background: rgba(255, 255, 255, 0.02);
    transition: background 0.15s ease;
  }

  .accordion-header-bar:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .accordion-header-bar:focus-visible {
    outline: 2px solid #a855f7;
    outline-offset: -2px;
  }

  .accordion-header-left {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    min-width: 0;
    flex: 1;
  }

  .header-titles-cluster {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .work-title-name {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 260px;
  }

  .chapter-number-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .chapter-number-title {
    font-size: 1rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chapter-sublabel {
    font-weight: 400;
    color: #94a3b8;
    font-size: 0.8125rem;
  }

  .work-thumbnail {
    width: 48px;
    height: 64px;
    border-radius: 6px;
    overflow: hidden;
    background: #0f172a;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .work-thumbnail.sm {
    width: 38px;
    height: 52px;
  }

  .thumbnail-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumbnail-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6875rem;
    font-weight: 800;
    color: #a855f7;
    background: rgba(168, 85, 247, 0.1);
  }

  /* TAGS */
  .header-tags-cluster {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin-left: 0.5rem;
  }

  .status-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    line-height: 1;
  }

  .tag-urgent {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .tag-high {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .tag-available {
    background: rgba(16, 185, 129, 0.12);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.25);
  }

  .tag-rework {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .tag-ready-deps {
    background: rgba(147, 51, 234, 0.12);
    color: #c084fc;
    border: 1px solid rgba(147, 51, 234, 0.25);
  }

  /* Canonical stages horizontal nav bar */
  .canonical-stages-nav-bar {
    width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    padding: 0.25rem 0 0.75rem;
    margin-bottom: 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .canonical-stages-nav-bar::-webkit-scrollbar {
    display: none;
  }

  .stage-pills-scroll {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: min-content;
  }

  .stage-nav-pill {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.4rem 0.85rem;
    border-radius: 9999px;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #a1a1aa;
    background: rgba(24, 24, 27, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    text-decoration: none;
  }

  .stage-nav-pill:hover {
    color: #f4f4f5;
    background: rgba(39, 39, 42, 0.9);
    border-color: rgba(255, 255, 255, 0.18);
  }

  .stage-nav-pill.selected {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.3);
    font-weight: 700;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  }

  .pill-icon {
    font-size: 0.95rem;
    line-height: 1;
  }

  .pill-name {
    line-height: 1.2;
  }

  .pill-total-badge {
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.1);
    color: #d4d4d8;
    line-height: 1.2;
  }

  .pill-personal-badge {
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 9999px;
    background: rgba(245, 158, 11, 0.22);
    color: #fde68a;
    border: 1px solid rgba(245, 158, 11, 0.45);
    line-height: 1.2;
    box-shadow: 0 0 8px rgba(245, 158, 11, 0.25);
    animation: pulseGold 2.4s ease-in-out infinite;
  }

  /* Personal Stage Badges */
  .personal-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 0.2rem 0.55rem;
    border-radius: 5px;
    line-height: 1;
    letter-spacing: 0.02em;
    white-space: nowrap;
    text-transform: uppercase;
  }

  .personal-badge.badge-new {
    background: rgba(245, 158, 11, 0.18);
    border: 1px solid rgba(245, 158, 11, 0.5);
    color: #fbbf24;
    box-shadow: 0 0 8px rgba(245, 158, 11, 0.2);
    animation: pulseGold 2.4s ease-in-out infinite;
  }

  .personal-badge.badge-available-for-me {
    background: rgba(16, 185, 129, 0.14);
    border: 1px solid rgba(16, 185, 129, 0.4);
    color: #34d399;
  }

  .badge-text-full {
    display: inline;
  }

  .badge-text-compact {
    display: none;
  }

  .card-personal-callout {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.65rem 0.9rem;
    border-radius: 8px;
    font-size: 0.8125rem;
    line-height: 1.4;
    margin-bottom: 1rem;
  }

  .card-personal-callout.new-callout {
    background: rgba(245, 158, 11, 0.09);
    border: 1px solid rgba(245, 158, 11, 0.35);
    color: #fef3c7;
  }

  .card-personal-callout.available-callout {
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.28);
    color: #d1fae5;
  }

  @keyframes pulseGold {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.88;
      transform: scale(1.02);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pill-personal-badge,
    .personal-badge.badge-new {
      animation: none;
    }
  }

  .tag-in-progress {
    background: rgba(59, 130, 246, 0.12);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.25);
  }

  .stage-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--tag-color, #c084fc);
  }

  .stage-tag .tag-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  /* HEADER RIGHT */
  .accordion-header-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .inline-claim-form {
    margin: 0;
  }

  .btn-claim-primary-compact {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: #7c3aed;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    padding: 0.4rem 0.875rem;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .btn-claim-primary-compact:hover:not(:disabled) {
    background: #6d28d9;
  }

  .btn-claim-primary-compact:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-toggle-details {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    border-radius: 6px;
    padding: 0.4rem 0.75rem;
    font-size: 0.8125rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-toggle-details:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .accordion-chevron {
    transition: transform 0.2s ease;
    color: #94a3b8;
  }

  .accordion-chevron.is-rotated {
    transform: rotate(180deg);
    color: #a855f7;
  }

  /* ACCORDION EXPANDED BODY */
  .accordion-expanded-body {
    padding: 1.25rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(13, 13, 22, 0.6);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .claim-feedback-alert {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    padding: 0.625rem 0.875rem;
    border-radius: 6px;
  }

  .claim-feedback-alert.error {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
  }

  .expanded-details-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
  }

  .detail-panel-box {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 0.875rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .detail-panel-box.alert-box {
    border-color: rgba(245, 158, 11, 0.25);
    background: rgba(245, 158, 11, 0.03);
  }

  .panel-box-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .box-head-label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #cbd5e1;
  }

  .box-head-text {
    font-size: 0.8125rem;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0;
  }

  .synopsis-clamp {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .rework-alert-text {
    color: #fbbf24;
    font-weight: 500;
  }

  .upstream-pill-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .btn-upstream-dl-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(147, 51, 234, 0.12);
    border: 1px solid rgba(147, 51, 234, 0.3);
    color: #c084fc;
    border-radius: 6px;
    padding: 0.4rem 0.75rem;
    font-size: 0.8125rem;
    text-decoration: none;
    transition: all 0.2s ease;
    width: fit-content;
    max-width: 100%;
  }

  .btn-upstream-dl-pill.clean {
    background: rgba(236, 72, 153, 0.12);
    border-color: rgba(236, 72, 153, 0.3);
    color: #f472b6;
  }

  .btn-upstream-dl-pill.traducao {
    background: rgba(59, 130, 246, 0.12);
    border-color: rgba(59, 130, 246, 0.3);
    color: #60a5fa;
  }

  .btn-upstream-dl-pill:hover {
    filter: brightness(1.2);
  }

  .no-insumo-text {
    font-size: 0.8125rem;
    color: #64748b;
    font-style: italic;
  }

  /* EXPANDED FOOTER */
  .accordion-expanded-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    flex-wrap: wrap;
  }

  .footer-admin-cluster {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-action-ghost {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    border-radius: 6px;
    padding: 0.4rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-action-ghost:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #f8fafc;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .btn-action-ghost.danger {
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.2);
  }

  .btn-action-ghost.danger:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.4);
  }

  .btn-icon-control {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-icon-control:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .btn-icon-control.danger {
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.2);
  }

  .btn-icon-control.danger:hover {
    background: rgba(239, 68, 68, 0.15);
  }

  .footer-primary-cta {
    margin-left: auto;
  }

  .btn-claim-prominent {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
    color: #ffffff;
    border: none;
    border-radius: 8px;
    padding: 0.625rem 1.5rem;
    font-size: 0.9375rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);
    transition: all 0.2s ease;
  }

  .btn-claim-prominent:hover:not(:disabled) {
    box-shadow: 0 6px 20px rgba(124, 58, 237, 0.5);
    transform: translateY(-1px);
  }

  .btn-claim-prominent:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-claim-prominent.btn-claim-disabled {
    background: #18181b;
    color: #94a3b8;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: none;
    cursor: not-allowed;
    opacity: 0.85;
  }

  .btn-claim-prominent.btn-claim-admin-override {
    background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
    box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35);
  }

  .claim-disabled-hint {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    color: #94a3b8;
    margin-top: 6px;
  }

  .btn-claim-primary-compact.btn-claim-disabled {
    background: rgba(255, 255, 255, 0.05);
    color: #64748b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    cursor: not-allowed;
  }

  .my-card-header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
  }

  .header-work-lockup {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .work-name-sm {
    font-size: 0.8125rem;
    color: #94a3b8;
    display: block;
  }

  .chapter-name-lg {
    font-size: 1.125rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .sublabel {
    font-weight: 400;
    color: #cbd5e1;
    font-size: 0.875rem;
  }

  .btn-view-chapter-outline {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #cbd5e1;
    border-radius: 6px;
    padding: 0.4rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-view-chapter-outline:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
    border-color: #a855f7;
  }

  /* STEPS CONTAINER */
  .card-steps-container {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .numbered-step-box {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 1rem 1.25rem;
  }

  .step-head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .step-badge {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #7c3aed;
    color: #ffffff;
    font-size: 0.8125rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .step-badge.complete {
    background: #10b981;
  }

  .step-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #f8fafc;
    margin: 0;
  }

  .step-desc {
    font-size: 0.75rem;
    color: #94a3b8;
    margin: 0.1rem 0 0;
  }

  /* PASSO 1: INSUMOS */
  .typeset-dual-downloads {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 0.75rem;
  }

  .dual-download-card {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .dual-label {
    font-size: 0.75rem;
    font-weight: 700;
  }

  .upstream-files-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .file-item-pill {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    gap: 0.75rem;
  }

  .file-pill-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  .pill-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pill-meta {
    font-size: 0.6875rem;
    color: #94a3b8;
  }

  .btn-download-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(147, 51, 234, 0.2);
    border: 1px solid rgba(147, 51, 234, 0.4);
    color: #c084fc;
    border-radius: 4px;
    padding: 0.35rem 0.65rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .btn-download-pill:hover {
    background: #7c3aed;
    color: #ffffff;
  }

  .waiting-dep-box,
  .no-deps-note {
    font-size: 0.75rem;
    color: #64748b;
    font-style: italic;
    padding: 0.5rem 0;
  }

  /* PASSO 2: UPLOAD & CHECKLIST */
  .current-uploaded-file-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 8px;
    padding: 0.625rem 0.875rem;
    margin-bottom: 0.75rem;
  }

  .uploaded-meta {
    display: flex;
    flex-direction: column;
    font-size: 0.8125rem;
    color: #34d399;
    flex: 1;
  }

  .btn-reupload-label {
    font-size: 0.75rem;
    color: #cbd5e1;
    text-decoration: underline;
    cursor: pointer;
  }

  .upload-drop-zone {
    border: 1px dashed rgba(168, 85, 247, 0.3);
    border-radius: 8px;
    padding: 1.25rem;
    text-align: center;
    background: rgba(147, 51, 234, 0.03);
    transition: border-color 0.2s ease;
  }

  .upload-drop-zone:hover {
    border-color: rgba(168, 85, 247, 0.6);
  }

  .drop-zone-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    cursor: pointer;
  }

  .hidden-file-input {
    display: none;
  }

  .upload-icon-cloud {
    color: #c084fc;
    margin-bottom: 0.25rem;
  }

  .upload-prompt-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #f8fafc;
  }

  .upload-prompt-hint {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .upload-progress-box {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
  }

  .progress-bar-track {
    width: 100%;
    max-width: 280px;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 9999px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: #a855f7;
    transition: width 0.2s ease;
  }

  .progress-text {
    font-size: 0.75rem;
    color: #cbd5e1;
  }

  .upload-feedback-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    padding: 0.625rem 0.875rem;
    border-radius: 6px;
    margin-top: 0.75rem;
  }

  .upload-feedback-banner.success {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #34d399;
  }

  .upload-feedback-banner.error {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
  }

  /* REVISÃO CHECKLIST */
  .revision-checklist-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .check-item-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: #cbd5e1;
    cursor: pointer;
  }

  .notes-textarea {
    width: 100%;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    color: #f8fafc;
    font-size: 0.8125rem;
    box-sizing: border-box;
    font-family: inherit;
    resize: vertical;
  }

  .notes-textarea:focus {
    outline: none;
    border-color: #a855f7;
  }

  .notes-label {
    font-size: 0.75rem;
    color: #94a3b8;
    margin-bottom: 0.25rem;
    display: block;
  }

  /* QC ACTIONS */
  .qc-inspection-action-row {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .btn-open-qc-inspector {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: #06b6d4;
    color: #082f49;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 0.875rem;
    font-size: 0.8125rem;
    font-weight: 700;
    cursor: pointer;
  }

  .btn-open-qc-inspector:hover {
    background: #22d3ee;
  }

  .btn-request-rework-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
    border-radius: 6px;
    padding: 0.5rem 0.875rem;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-request-rework-trigger:hover {
    background: rgba(239, 68, 68, 0.25);
  }

  /* PASSO 3: CONCLUSÃO & AÇÕES EDITORIAIS */
  .step-body-footer {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .completion-actions-cluster {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .btn-complete-editorial {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: #10b981;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1.125rem;
    font-size: 0.8125rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.15s ease;
  }

  .btn-complete-editorial:hover:not(:disabled) {
    background: #059669;
    transform: translateY(-1px);
  }

  .btn-complete-editorial:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-publish-site {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: #22c55e;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .btn-publish-site:hover {
    background: #16a34a;
  }

  .editorial-returns-separator {
    width: 1px;
    height: 24px;
    background: rgba(255, 255, 255, 0.12);
    margin: 0 0.25rem;
  }

  .btn-abandon-queue {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #94a3b8;
    border-radius: 6px;
    padding: 0.45rem 0.85rem;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-abandon-queue:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #e2e8f0;
    border-color: rgba(255, 255, 255, 0.25);
  }

  .btn-rework-editorial {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #fbbf24;
    border-radius: 6px;
    padding: 0.45rem 0.85rem;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-rework-editorial:hover {
    background: rgba(245, 158, 11, 0.2);
  }

  .gate-warning-hint {
    font-size: 0.75rem;
    color: #fbbf24;
  }

  /* MODALS & DIALOGS */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
    box-sizing: border-box;
  }

  .standard-modal-dialog,
  .rework-modal-dialog {
    background: #131320;
    border: 1px solid rgba(147, 51, 234, 0.3);
    border-radius: 14px;
    padding: 1.5rem;
    width: 100%;
    max-width: 500px;
    box-shadow: 0 10px 35px rgba(0, 0, 0, 0.7);
    box-sizing: border-box;
  }

  .standard-modal-dialog.delete-dialog {
    border-color: rgba(239, 68, 68, 0.45);
  }

  .rework-modal-dialog {
    border-color: rgba(245, 158, 11, 0.4);
  }

  .modal-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .modal-title-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .modal-title-wrap h3 {
    font-size: 1.125rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .modal-title-wrap.text-rose h3 {
    color: #f87171;
  }

  .btn-close-modal {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    border-radius: 4px;
    transition: color 0.15s ease, background 0.15s ease;
  }

  .btn-close-modal:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
  }

  .modal-subtitle {
    font-size: 0.8125rem;
    color: #cbd5e1;
    margin: 0 0 1.25rem;
    line-height: 1.4;
  }

  .standard-form-grid,
  .rework-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .delete-warning-box {
    display: flex;
    gap: 0.75rem;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: 8px;
    padding: 0.875rem;
    margin-bottom: 1rem;
    font-size: 0.8125rem;
    color: #fca5a5;
    line-height: 1.4;
  }

  .delete-warning-box strong {
    color: #f87171;
    display: block;
    margin-bottom: 0.25rem;
  }

  .delete-warning-box p {
    margin: 0;
  }

  .delete-error-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.35);
    border-radius: 6px;
    padding: 0.625rem;
    margin-bottom: 1rem;
    color: #f87171;
    font-size: 0.8125rem;
  }

  .delete-input {
    border-color: rgba(239, 68, 68, 0.4) !important;
    font-family: monospace;
    font-size: 0.9375rem;
  }

  .modal-buttons-row {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .btn-confirm-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: #7c3aed;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1.125rem;
    font-size: 0.8125rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .btn-confirm-primary:hover:not(:disabled) {
    background: #6d28d9;
  }

  .btn-confirm-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-confirm-danger {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: #dc2626;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1.125rem;
    font-size: 0.8125rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .btn-confirm-danger:hover:not(:disabled) {
    background: #b91c1c;
  }

  .btn-confirm-danger:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-confirm-rework {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: #d97706;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .btn-confirm-rework:hover:not(:disabled) {
    background: #b45309;
  }

  .btn-confirm-rework:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* RESPONSIVE BREAKPOINTS (Desktop to Mobile-First 320px) */
  @media (max-width: 768px) {
    .stage-main-title {
      font-size: 1.375rem;
    }

    .stage-toolbar {
      flex-direction: column;
      align-items: stretch;
    }

    .toolbar-left {
      flex-direction: column;
      align-items: stretch;
    }

    .search-input-wrap {
      max-width: 100%;
    }

    .work-select-field {
      width: 100%;
    }

    .btn-new-chapter-trigger {
      width: 100%;
      justify-content: center;
    }

    .raw-quick-picker-card {
      padding: 1rem;
    }

    .picker-controls {
      flex-direction: column;
      align-items: stretch;
    }

    .picker-field {
      width: 100%;
      min-width: 0;
    }

    .picker-action,
    .picker-action form,
    .btn-claim-highlight {
      width: 100%;
      justify-content: center;
    }

    /* Accordion responsive rules */
    .accordion-header-bar {
      flex-direction: column;
      align-items: stretch;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
    }

    .accordion-header-left {
      width: 100%;
      flex-wrap: wrap;
      gap: 0.625rem;
    }

    .work-title-name {
      max-width: 100%;
    }

    .header-tags-cluster {
      margin-left: 0;
      width: 100%;
    }

    .accordion-header-right {
      width: 100%;
      justify-content: space-between;
      gap: 0.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 0.5rem;
    }

    .inline-claim-form {
      flex: 1;
    }

    .btn-claim-primary-compact {
      width: 100%;
      justify-content: center;
    }

    .btn-toggle-details {
      flex: 1;
      justify-content: center;
    }

    .expanded-details-grid {
      grid-template-columns: 1fr;
    }

    .accordion-expanded-footer {
      flex-direction: column;
      align-items: stretch;
      gap: 0.75rem;
    }

    .footer-admin-cluster {
      width: 100%;
      justify-content: space-between;
    }

    .footer-primary-cta {
      width: 100%;
      margin-left: 0;
    }

    .footer-primary-cta form,
    .btn-claim-prominent {
      width: 100%;
      justify-content: center;
    }

    .typeset-dual-downloads {
      grid-template-columns: 1fr;
    }

    .completion-actions-cluster {
      flex-direction: column;
      align-items: stretch;
      width: 100%;
    }

    .completion-actions-cluster form {
      width: 100%;
    }

    .btn-complete-editorial,
    .btn-publish-site,
    .btn-abandon-queue,
    .btn-rework-editorial {
      width: 100%;
      justify-content: center;
    }

    .editorial-returns-separator {
      display: none;
    }

    .badge-text-full {
      display: none;
    }

    .badge-text-compact {
      display: inline;
    }

    .personal-badge {
      font-size: 0.625rem;
      padding: 0.15rem 0.45rem;
    }

    .stage-nav-pill {
      padding: 0.35rem 0.7rem;
      font-size: 0.75rem;
    }

    .pill-personal-badge {
      font-size: 0.625rem;
      padding: 1px 5px;
    }
  }

  @media (max-width: 480px) {
    .stage-pills-scroll {
      gap: 0.35rem;
    }

    .stage-nav-pill {
      padding: 0.3rem 0.6rem;
      font-size: 0.71875rem;
    }

    .pill-icon {
      font-size: 0.85rem;
    }

    .card-personal-callout {
      font-size: 0.75rem;
      padding: 0.5rem 0.75rem;
    }
  }
</style>
