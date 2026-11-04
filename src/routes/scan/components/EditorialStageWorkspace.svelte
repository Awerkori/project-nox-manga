<script lang="ts">
  import { enhance } from '$app/forms';
  import {
    AlertCircle,
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    Download,
    Eye,
    EyeOff,
    FileArchive,
    FileCheck,
    FileText,
    Filter,
    FolderKanban,
    HelpCircle,
    Layers,
    Lock,
    Package,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    Sparkles,
    Trash2,
    Upload,
    X,
    Zap
  } from '@lucide/svelte';
  import { evaluateStageClaim, normalizePositionName } from '$lib/scan-roles';
  import PipelineDeliverableUpload from './PipelineDeliverableUpload.svelte';
  import ClaimStageModal from './ClaimStageModal.svelte';

  interface Props {
    stageSlug?: string;
    activeCanonical?: any;
    stages?: any[];
    chapterStages?: any[];
    chapters?: any[];
    works?: any[];
    productionFiles?: any[];
    tasks?: any[];
    qcIssues?: any[];
    team?: any[];
    currentUserId?: string;
    userRole?: string;
    userPositions?: any[];
    seenStages?: string[];
    isOwnerOrAdmin?: boolean;
    scanId?: string;
    onSelectStage?: (slug: string) => void;
    onOpenChapter?: (chapter: any) => void;
    onOpenQcReader?: (chapter: any) => void;
  }

  let {
    stageSlug = 'traducao',
    activeCanonical = null,
    stages = [],
    chapterStages = [],
    chapters = [],
    works = [],
    productionFiles = [],
    tasks = [],
    qcIssues = [],
    team = [],
    currentUserId = '',
    userRole = 'MEMBER',
    userPositions = [],
    seenStages = [],
    isOwnerOrAdmin: isOwnerOrAdminProp = false,
    scanId = '',
    onSelectStage = (_slug: string) => {},
    onOpenChapter = (_chapter: any) => {},
    onOpenQcReader = (_chapter: any) => {}
  }: Props = $props();

  let isOwnerOrAdmin = $derived(isOwnerOrAdminProp || userRole === 'OWNER' || userRole === 'ADMIN');

  // Helper to match stage slugs robustly
  function matchesStageSlug(candidate: any, target: string): boolean {
    const s = (typeof candidate === 'string' ? candidate : candidate?.slug || '').toLowerCase().trim();
    const t = target.toLowerCase().trim();
    if (s === t) return true;
    if (t === 'clean' || t === 'clean_redraw' || t === 'clean/redraw') {
      return s === 'clean' || s === 'clean_redraw' || s === 'clean/redraw';
    }
    if (t === 'traducao' || t === 'translation') {
      return s === 'traducao' || s === 'translation';
    }
    if (t === 'typeset' || t === 'typer') {
      return s === 'typeset' || s === 'typer';
    }
    if (t === 'revisor_qc' || t === 'revisao' || t === 'qc') {
      return s === 'revisor_qc' || s === 'revisao' || s === 'qc' || s === 'revisor (qc)';
    }
    if (t === 'raw') {
      return s === 'raw' || s === 'raw_provider';
    }
    return false;
  }

  // Canonical Stage Identifier (normalized)
  let canonicalSlug = $derived.by(() => {
    const slug = stageSlug || activeCanonical?.slug || 'traducao';
    if (matchesStageSlug(slug, 'traducao')) return 'traducao';
    if (matchesStageSlug(slug, 'clean_redraw')) return 'clean_redraw';
    if (matchesStageSlug(slug, 'typeset')) return 'typeset';
    if (matchesStageSlug(slug, 'revisor_qc')) return 'revisor_qc';
    return slug;
  });

  // Stage Specific Presentation & Operational Configuration
  interface StagePreset {
    title: string;
    pillLabel: string;
    pillBg: string;
    pillBorder: string;
    accentColor: string;
    accentLight: string;
    accentGlow: string;
    subtitle: string;
    mobileSubtitle: string;
    roleRequiredSlug: string;
    roleRequiredName: string;
    claimActionLabel: string;
    completeActionLabel: string;
    emptyAvailableTitle: string;
    emptyAvailableDesc: string;
    emptyMineTitle: string;
    emptyMineDesc: string;
    uploadTitle: string;
    uploadFormatHint: string;
    uploadStepHint: string;
  }

  const STAGE_PRESETS: Record<string, StagePreset> = {
    traducao: {
      title: 'Tradução',
      pillLabel: 'ETAPA 2',
      pillBg: 'rgba(59, 130, 246, 0.12)',
      pillBorder: 'rgba(59, 130, 246, 0.3)',
      accentColor: '#3b82f6',
      accentLight: '#60a5fa',
      accentGlow: 'rgba(59, 130, 246, 0.25)',
      subtitle: 'Traduza os capítulos com RAW disponível.',
      mobileSubtitle: 'Traduza os capítulos disponíveis.',
      roleRequiredSlug: 'tradutor',
      roleRequiredName: 'Tradutor',
      claimActionLabel: 'Assumir tradução',
      completeActionLabel: 'Concluir Tradução',
      emptyAvailableTitle: 'Tudo em dia por aqui',
      emptyAvailableDesc: 'Não há capítulos disponíveis para tradução no momento.',
      emptyMineTitle: 'Nenhum capítulo em andamento',
      emptyMineDesc: 'Quando você assumir uma tradução, ela aparecerá aqui.',
      uploadTitle: 'Minha tradução',
      uploadFormatHint: 'Formatos aceitos: .docx, .doc, .txt ou arquivo de script',
      uploadStepHint: '1º Envie sua tradução abaixo • 2º Clique em "Concluir Tradução" ao final'
    },
    clean_redraw: {
      title: 'Clean/Redraw',
      pillLabel: 'ETAPA 3',
      pillBg: 'rgba(236, 72, 153, 0.12)',
      pillBorder: 'rgba(236, 72, 153, 0.3)',
      accentColor: '#ec4899',
      accentLight: '#f472b6',
      accentGlow: 'rgba(236, 72, 153, 0.25)',
      subtitle: 'Prepare as páginas limpas e reconstrua a arte.',
      mobileSubtitle: 'Limpeza e reconstrução de páginas.',
      roleRequiredSlug: 'clean_redraw',
      roleRequiredName: 'Clean/Redraw',
      claimActionLabel: 'Assumir Clean/Redraw',
      completeActionLabel: 'Concluir Clean/Redraw',
      emptyAvailableTitle: 'Tudo em dia por aqui',
      emptyAvailableDesc: 'Não há capítulos disponíveis para Clean/Redraw no momento.',
      emptyMineTitle: 'Nenhum capítulo em andamento',
      emptyMineDesc: 'Quando você assumir um Clean/Redraw, ele aparecerá aqui.',
      uploadTitle: 'Minhas páginas limpas',
      uploadFormatHint: 'Formatos aceitos: .zip, .cbz ou páginas limpas sequenciais',
      uploadStepHint: '1º Envie as páginas limpas abaixo • 2º Clique em "Concluir Clean/Redraw" ao final'
    },
    typeset: {
      title: 'Typeset',
      pillLabel: 'ETAPA 4',
      pillBg: 'rgba(245, 158, 11, 0.12)',
      pillBorder: 'rgba(245, 158, 11, 0.3)',
      accentColor: '#f59e0b',
      accentLight: '#fbbf24',
      accentGlow: 'rgba(245, 158, 11, 0.25)',
      subtitle: 'Combine tradução e arte para finalizar as páginas.',
      mobileSubtitle: 'Diagramação e finalização das páginas.',
      roleRequiredSlug: 'typer',
      roleRequiredName: 'Typer',
      claimActionLabel: 'Assumir Typeset',
      completeActionLabel: 'Concluir Typeset',
      emptyAvailableTitle: 'Tudo em dia por aqui',
      emptyAvailableDesc: 'Não há capítulos disponíveis para Typeset no momento.',
      emptyMineTitle: 'Nenhum capítulo em andamento',
      emptyMineDesc: 'Quando você assumir um Typeset, ele aparecerá aqui.',
      uploadTitle: 'Minha entrega finalizada',
      uploadFormatHint: 'Formatos aceitos: .zip, .cbz ou páginas diagramadas finalizadas',
      uploadStepHint: '1º Baixe Tradução e Clean • 2º Envie as páginas diagramadas • 3º Conclua o Typeset'
    },
    revisor_qc: {
      title: 'Revisor (QC)',
      pillLabel: 'ETAPA 5',
      pillBg: 'rgba(168, 85, 247, 0.12)',
      pillBorder: 'rgba(168, 85, 247, 0.3)',
      accentColor: '#a855f7',
      accentLight: '#c084fc',
      accentGlow: 'rgba(168, 85, 247, 0.25)',
      subtitle: 'Revisão textual e controle de qualidade minucioso. Aprove o capítulo ou aponte correções necessárias.',
      mobileSubtitle: 'Controle de qualidade e revisão final.',
      roleRequiredSlug: 'revisor_qc',
      roleRequiredName: 'Revisor (QC)',
      claimActionLabel: 'Assumir revisão',
      completeActionLabel: 'Aprovar Capítulo',
      emptyAvailableTitle: 'Tudo em dia por aqui',
      emptyAvailableDesc: 'Não há capítulos disponíveis para revisão no momento.',
      emptyMineTitle: 'Nenhum capítulo em andamento',
      emptyMineDesc: 'Quando você assumir uma revisão, ela aparecerá aqui.',
      uploadTitle: 'Minha revisão',
      uploadFormatHint: 'Revisão das páginas diagramadas pelo Typeset',
      uploadStepHint: '1º Abra o Leitor QC • 2º Aponte erros ou aprove o capítulo'
    }
  };

  let stageConfig = $derived(STAGE_PRESETS[canonicalSlug] || STAGE_PRESETS.traducao);

  // Active Stage Claim Evaluation based on user role and permissions
  let claimEvaluation = $derived(
    evaluateStageClaim(userRole, userPositions, canonicalSlug)
  );

  // Filter & Search Controls
  let searchQuery = $state('');
  let filterWorkId = $state<string>('ALL');
  let activeCategory = $state<'available' | 'mine' | 'both'>('available');
  let userSelectedCategory = $state(false);

  function selectCategory(cat: 'available' | 'mine' | 'both') {
    activeCategory = cat;
    userSelectedCategory = true;
  }

  // Expanded Chapter Workspaces
  let expandedChapterIds = $state<Record<string, boolean>>({});
  let mobileAccordionState = $state<Record<string, { inputs: boolean; delivery: boolean }>>({});

  // Action Pending States & User Feedback
  let isClaimingStageId = $state<string | null>(null);
  let isCompletingStageId = $state<string | null>(null);
  let isReleasingStageId = $state<string | null>(null);
  let claimFeedback = $state<{ stageId: string; type: 'error' | 'success'; text: string } | null>(null);
  let completeFeedback = $state<{ stageId: string; type: 'error' | 'success'; text: string } | null>(null);

  // Claim Stage with Deadline Modal
  let claimModalOpen = $state(false);
  let claimModalStageItem = $state<any>(null);

  function isDeadlineMandatory(slug?: string | null): boolean {
    if (!slug) return false;
    const s = slug.toLowerCase().trim();
    return ['traducao', 'clean_redraw', 'clean', 'typeset', 'revisor_qc', 'qc', 'revisao'].includes(s);
  }

  function handleOpenClaimModal(cs: any, ch: any, work: any, config: any, cSlug: string) {
    claimModalStageItem = {
      id: cs.id,
      stage: {
        name: config?.title || config?.name || (stageConfig as any)[cSlug]?.title || 'Etapa Editorial',
        slug: cSlug,
        color: config?.accentColor || config?.color || '#8b5cf6'
      },
      chapter: {
        chapter_number: ch?.chapter_number || '1',
        chapter_label: ch?.chapter_label || '',
        work: {
          title: work?.title || 'Obra',
          cover_id: work?.cover_id || null
        }
      }
    };
    claimModalOpen = true;
  }

  // Helper to reliably retrieve work cover url
  function getWorkCoverUrl(work: any): string | null {
    if (!work) return null;
    const coverId = work.cover_id || work.cover_image_id || work.coverId;
    if (coverId) return `/media/${coverId}?size=thumb&v=3`;
    if (work.cover_url) return work.cover_url;
    return null;
  }

  // Format bytes helper
  function formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Format priority tags
  function formatPriority(priority?: string) {
    switch (priority) {
      case 'URGENT':
        return { label: 'Urgente', class: 'priority-urgent' };
      case 'HIGH':
        return { label: 'Alta', class: 'priority-high' };
      default:
        return { label: 'Normal', class: 'priority-normal' };
    }
  }

  // Retrieve deliverable files for a specific chapter stage
  function getDeliverableFiles(cs: any, chId: string) {
    return productionFiles.filter(
      (f: any) =>
        f.production_chapter_id === chId &&
        (f.stage_id === cs.stage_id || matchesStageSlug(f.stage_slug || f.stage?.slug, canonicalSlug)) &&
        f.is_current
    );
  }

  // Retrieve upstream dependency files for this stage
  function getUpstreamInputs(chId: string, targetChId?: string) {
    const chObj = !targetChId ? chapters.find((c: any) => c.id === chId || c.target_chapter_id === chId) : null;
    const resolvedTargetId = targetChId || chObj?.target_chapter_id || null;

    const files = productionFiles.filter((f: any) =>
      (f.production_chapter_id === chId ||
       (resolvedTargetId && f.production_chapter_id === resolvedTargetId) ||
       (f.chapter_id && (f.chapter_id === chId || (resolvedTargetId && f.chapter_id === resolvedTargetId)))) &&
      f.is_current
    );

    if (canonicalSlug === 'typeset') {
      const cleanFiles = files.filter((f: any) => matchesStageSlug(f.stage_slug || f.stage?.slug, 'clean_redraw'));
      const tradFiles = files.filter((f: any) => matchesStageSlug(f.stage_slug || f.stage?.slug, 'traducao'));
      return {
        isTypeset: true,
        isRevisorQc: false,
        cleanFiles,
        tradFiles,
        typesetFiles: [],
        rawFiles: [],
        hasClean: cleanFiles.length > 0,
        hasTrad: tradFiles.length > 0,
        hasTypeset: false,
        hasRaw: false,
        all: [...cleanFiles, ...tradFiles]
      };
    }

    if (canonicalSlug === 'revisor_qc') {
      const rawTypesetFiles = files.filter((f: any) => matchesStageSlug(f.stage_slug || f.stage?.slug, 'typeset'));
      const typesetFiles = rawTypesetFiles.map((f: any) => {
        const isInvalid = (f.byte_size && f.byte_size < 50_000) || f.file_key === 'prod_type_85_v1_1789173275882' || f.is_invalid;
        const isIncomplete = !isInvalid && (f.is_incomplete_typeset || (f.note && f.note.includes('sem falas diagramadas')));
        return {
          ...f,
          is_invalid: isInvalid,
          invalid_reason: isInvalid ? 'Arquivo de teste antigo (placeholder de 4.5 KB)' : '',
          is_incomplete: isIncomplete,
          incomplete_reason: isIncomplete ? 'Páginas limpas do Clean/Redraw sem falas diagramadas' : ''
        };
      });
      const validTypesetFiles = typesetFiles.filter((f: any) => !f.is_invalid);
      const hasIncompleteTypeset = validTypesetFiles.some((f: any) => f.is_incomplete);
      const cleanFiles = files.filter((f: any) => matchesStageSlug(f.stage_slug || f.stage?.slug, 'clean_redraw'));
      const tradFiles = files.filter((f: any) => matchesStageSlug(f.stage_slug || f.stage?.slug, 'traducao'));
      const rawFiles = files.filter((f: any) => matchesStageSlug(f.stage_slug || f.stage?.slug, 'raw'));
      return {
        isTypeset: false,
        isRevisorQc: true,
        cleanFiles,
        tradFiles,
        typesetFiles,
        validTypesetFiles,
        hasIncompleteTypeset,
        rawFiles,
        hasClean: cleanFiles.length > 0,
        hasTrad: tradFiles.length > 0,
        hasTypeset: validTypesetFiles.length > 0,
        hasRaw: rawFiles.length > 0,
        all: [...typesetFiles, ...cleanFiles, ...tradFiles]
      };
    }

    // Tradução and Clean/Redraw both rely on RAW
    const rawFiles = files.filter((f: any) => matchesStageSlug(f.stage_slug || f.stage?.slug, 'raw'));
    return {
      isTypeset: false,
      isRevisorQc: false,
      rawFiles,
      cleanFiles: [],
      tradFiles: [],
      typesetFiles: [],
      hasRaw: rawFiles.length > 0,
      hasClean: false,
      hasTrad: false,
      hasTypeset: false,
      all: rawFiles
    };
  }

  // Strict check on Typeset Prerequisites:
  // Typeset REQUIRES BOTH Tradução AND Clean/Redraw to be completed with valid deliverables!
  function checkTypesetPrerequisites(chId: string) {
    const tradStage = chapterStages.find(
      (cs: any) => cs.production_chapter_id === chId && matchesStageSlug(cs.stage?.slug, 'traducao')
    );
    const cleanStage = chapterStages.find(
      (cs: any) => cs.production_chapter_id === chId && matchesStageSlug(cs.stage?.slug, 'clean_redraw')
    );

    const inputs = getUpstreamInputs(chId);
    const cleanReady = inputs.hasClean && (cleanStage?.status === 'DONE' || !cleanStage);
    const tradReady = inputs.hasTrad && (tradStage?.status === 'DONE' || !tradStage);
    const isEligible = cleanReady && tradReady;

    let blockedReason = '';
    if (!cleanReady && !tradReady) {
      blockedReason = 'Aguardando Tradução e Clean/Redraw serem concluídos com arquivos válidos.';
    } else if (!cleanReady) {
      blockedReason = 'Aguardando Clean/Redraw ser concluído com páginas limpas entregues.';
    } else if (!tradReady) {
      blockedReason = 'Aguardando Tradução ser concluída com script ou arquivo entregue.';
    }

    return {
      isEligible,
      blockedReason,
      cleanReady,
      tradReady,
      cleanCount: inputs.cleanFiles.length,
      tradCount: inputs.tradFiles.length
    };
  }

  // Strict check on Revisor (QC) Prerequisites:
  // QC REQUIRES Typeset deliverable package to be ready!
  function checkQcPrerequisites(chId: string) {
    const typesetStage = chapterStages.find(
      (cs: any) => cs.production_chapter_id === chId && matchesStageSlug(cs.stage?.slug, 'typeset')
    );
    const inputs = getUpstreamInputs(chId);
    const typesetReady = inputs.hasTypeset && (typesetStage?.status === 'DONE' || !typesetStage);
    return {
      isEligible: typesetReady && !inputs.hasIncompleteTypeset,
      blockedReason: !typesetReady
        ? 'Aguardando entrega de pacote válido pelo Typeset.'
        : inputs.hasIncompleteTypeset
          ? 'Material do Typeset contém apenas páginas limpas sem falas diagramadas.'
          : '',
      typesetReady,
      hasIncompleteTypeset: inputs.hasIncompleteTypeset,
      typesetCount: inputs.validTypesetFiles?.length || 0
    };
  }

  // Check upstream readiness for Tradução & Clean/Redraw (RAW readiness)
  function checkRawPrerequisites(chId: string) {
    const rawStage = chapterStages.find(
      (cs: any) => cs.production_chapter_id === chId && matchesStageSlug(cs.stage?.slug, 'raw')
    );
    const inputs = getUpstreamInputs(chId);
    const rawReady = inputs.hasRaw || rawStage?.status === 'DONE';
    return {
      rawReady,
      rawCount: inputs.rawFiles?.length || 0,
      blockedReason: rawReady ? '' : 'Aguardando upload do arquivo RAW original.'
    };
  }

  // Reader Navigation & QC Issues Helper Functions
  function handleOpenReader(chapter: any) {
    if (onOpenQcReader) {
      onOpenQcReader(chapter);
    } else if (typeof window !== 'undefined') {
      window.location.href = `/scan?tab=qc_leitor&id=${chapter.id}`;
    }
  }

  function getChapterQcIssues(chId: string) {
    return qcIssues.filter((q: any) => q.chapter_id === chId || q.production_chapter_id === chId);
  }

  function getOpenQcIssues(chId: string) {
    return getChapterQcIssues(chId).filter((q: any) => q.status === 'OPEN');
  }

  // --- REVISOR (QC) MODALS STATE ---
  // 1. Rework Modal
  let isReworkModalOpen = $state(false);
  let reworkTargetItem = $state<any>(null);
  let reworkSelectedStages = $state<{ traducao: boolean; clean_redraw: boolean; typeset: boolean }>({
    traducao: false,
    clean_redraw: false,
    typeset: true
  });
  let reworkIssues = $state<Record<'traducao' | 'clean_redraw' | 'typeset', Array<{ page: number | null; region: string; description: string }>>>({
    traducao: [{ page: null, region: '', description: '' }],
    clean_redraw: [{ page: null, region: '', description: '' }],
    typeset: [{ page: null, region: '', description: '' }]
  });
  let isSubmittingRework = $state(false);
  let reworkFeedback = $state<{ type: 'error' | 'success'; text: string } | null>(null);

  function openReworkModal(item: any) {
    reworkTargetItem = item;
    reworkFeedback = null;
    const itemUpstream = getUpstreamInputs(item.ch.id);
    const hasIncomplete = itemUpstream.hasIncompleteTypeset;
    reworkSelectedStages = { traducao: false, clean_redraw: false, typeset: true };
    reworkIssues = {
      traducao: [{ page: null, region: '', description: '' }],
      clean_redraw: [{ page: null, region: '', description: '' }],
      typeset: hasIncomplete
        ? [{ page: null, region: 'Todas as páginas', description: 'O pacote anexado contém apenas páginas limpas do Clean/Redraw com balões em branco. As falas da tradução não foram inseridas nos balões. Necessário enviar o pacote com as falas diagramadas antes da aprovação.' }]
        : [{ page: null, region: '', description: '' }]
    };
    isReworkModalOpen = true;
  }

  function closeReworkModal() {
    isReworkModalOpen = false;
    reworkTargetItem = null;
    reworkFeedback = null;
  }

  function addReworkIssueRow(stage: 'traducao' | 'clean_redraw' | 'typeset') {
    reworkIssues[stage] = [...reworkIssues[stage], { page: null, region: '', description: '' }];
  }

  function removeReworkIssueRow(stage: 'traducao' | 'clean_redraw' | 'typeset', idx: number) {
    if (reworkIssues[stage].length > 1) {
      reworkIssues[stage] = reworkIssues[stage].filter((_, i) => i !== idx);
    }
  }

  let reworkPayloadJson = $derived.by(() => {
    const payload: any[] = [];
    const stages: Array<'traducao' | 'clean_redraw' | 'typeset'> = ['traducao', 'clean_redraw', 'typeset'];
    for (const st of stages) {
      if (reworkSelectedStages[st]) {
        const validIssues = reworkIssues[st]
          .filter(iss => iss.description.trim().length > 0)
          .map(iss => ({
            page_number: iss.page,
            region: iss.region.trim(),
            description: iss.description.trim()
          }));
        payload.push({
          stage: st,
          issues: validIssues
        });
      }
    }
    return JSON.stringify(payload);
  });

  let isReworkValid = $derived.by(() => {
    const anySelected = reworkSelectedStages.traducao || reworkSelectedStages.clean_redraw || reworkSelectedStages.typeset;
    if (!anySelected) return false;
    const stages: Array<'traducao' | 'clean_redraw' | 'typeset'> = ['traducao', 'clean_redraw', 'typeset'];
    for (const st of stages) {
      if (reworkSelectedStages[st]) {
        const hasDesc = reworkIssues[st].some(iss => iss.description.trim().length >= 3);
        if (!hasDesc) return false;
      }
    }
    return true;
  });

  let reworkButtonLabel = $derived.by(() => {
    const selected = [];
    if (reworkSelectedStages.traducao) selected.push('Tradução');
    if (reworkSelectedStages.clean_redraw) selected.push('Clean/Redraw');
    if (reworkSelectedStages.typeset) selected.push('Typeset');
    if (selected.length === 0) return 'Selecione ao menos uma etapa';
    if (selected.length === 1) return `Devolver à ${selected[0]}`;
    return `Enviar para correções (${selected.length} etapas)`;
  });

  // 2. Approval Modal
  let isApproveModalOpen = $state(false);
  let approveTargetItem = $state<any>(null);
  let approveNotes = $state('Capítulo revisado e aprovado pelo QC.');
  let isSubmittingApprove = $state(false);
  let approveFeedback = $state<{ type: 'error' | 'success'; text: string } | null>(null);

  function openApproveModal(item: any) {
    approveTargetItem = item;
    approveNotes = 'Capítulo revisado e aprovado pelo QC.';
    approveFeedback = null;
    isApproveModalOpen = true;
  }

  function closeApproveModal() {
    isApproveModalOpen = false;
    approveTargetItem = null;
    approveFeedback = null;
  }

  // 3. Quick Add Issue Modal
  let isAddIssueModalOpen = $state(false);
  let addIssueTargetItem = $state<any>(null);
  let newIssuePage = $state<number>(1);
  let newIssueRegion = $state('');
  let newIssueType = $state<'TYPE' | 'CLEAN' | 'TRANSLATION' | 'OTHER'>('TYPE');
  let newIssueDescription = $state('');
  let isSubmittingAddIssue = $state(false);
  let addIssueFeedback = $state<{ type: 'error' | 'success'; text: string } | null>(null);

  function openAddIssueModal(item: any) {
    addIssueTargetItem = item;
    newIssuePage = 1;
    newIssueRegion = '';
    newIssueType = 'TYPE';
    newIssueDescription = '';
    addIssueFeedback = null;
    isAddIssueModalOpen = true;
  }

  function closeAddIssueModal() {
    isAddIssueModalOpen = false;
    addIssueTargetItem = null;
    addIssueFeedback = null;
  }

  // Filter all items belonging to current stage
  let activeStageItems = $derived.by(() => {
    const result: any[] = [];
    for (const cs of chapterStages) {
      const slug = cs.stage?.slug || '';
      if (matchesStageSlug(slug, canonicalSlug)) {
        const ch = chapters.find((c: any) => c.id === cs.production_chapter_id);
        if (ch) {
          const work = ch.work || works.find((w: any) => w.id === ch.work_id);
          result.push({ ch, cs, work });
        }
      }
    }
    return result;
  });

  // Filtered available items (pool of chapters ready to be claimed)
  let availableItems = $derived.by(() => {
    return activeStageItems
      .filter((item: any) => {
        const isFree = (item.cs.status === 'AVAILABLE' || item.cs.status === 'REWORK') && !item.cs.assigned_to;
        return isFree;
      })
      .filter((item: any) => {
        const matchesWork = filterWorkId === 'ALL' || item.work?.id === filterWorkId;
        const query = searchQuery.trim().toLowerCase();
        if (!query) return matchesWork;
        const title = (item.work?.title || '').toLowerCase();
        const num = String(item.ch.chapter_number || '');
        const label = (item.ch.chapter_label || '').toLowerCase();
        return matchesWork && (title.includes(query) || num.includes(query) || label.includes(query));
      });
  });

  // Filtered my items (chapters currently assigned to the logged user)
  let myItems = $derived.by(() => {
    return activeStageItems
      .filter((item: any) => {
        return (
          item.cs.assigned_to === currentUserId &&
          (item.cs.status === 'IN_PROGRESS' || item.cs.status === 'REWORK')
        );
      })
      .filter((item: any) => {
        const matchesWork = filterWorkId === 'ALL' || item.work?.id === filterWorkId;
        const query = searchQuery.trim().toLowerCase();
        if (!query) return matchesWork;
        const title = (item.work?.title || '').toLowerCase();
        const num = String(item.ch.chapter_number || '');
        const label = (item.ch.chapter_label || '').toLowerCase();
        return matchesWork && (title.includes(query) || num.includes(query) || label.includes(query));
      });
  });

  // Automatically default to 'mine' initially if user has active work in this stage
  $effect(() => {
    if (!userSelectedCategory) {
      if (myItems.length > 0 && activeCategory !== 'mine') {
        activeCategory = 'mine';
      } else if (myItems.length === 0 && availableItems.length > 0 && activeCategory !== 'available') {
        activeCategory = 'available';
      }
    }
  });

  // Toggle chapter workspace expansion
  function toggleChapterWorkspace(stageId: string) {
    expandedChapterIds[stageId] = !expandedChapterIds[stageId];
    if (expandedChapterIds[stageId] && !mobileAccordionState[stageId]) {
      mobileAccordionState[stageId] = { inputs: true, delivery: true };
    }
  }

  // Toggle mobile accordion sub-sections
  function toggleMobileSection(stageId: string, section: 'inputs' | 'delivery') {
    if (!mobileAccordionState[stageId]) {
      mobileAccordionState[stageId] = { inputs: true, delivery: true };
    }
    mobileAccordionState[stageId][section] = !mobileAccordionState[stageId][section];
  }

  // Quick helper to check urgent items
  let hasUrgentAvailable = $derived(
    availableItems.some((item: any) => item.ch.priority === 'URGENT')
  );
</script>

<!-- REUSABLE SNIPPETS: ZERO CODE DUPLICATION -->

<!-- SNIPPET 1: AVAILABLE CHAPTERS POOL -->
{#snippet availableCards()}
  {#if claimFeedback}
    <div class="editorial-alert-banner {claimFeedback.type}">
      <AlertCircle size={15} />
      <span>{claimFeedback.text}</span>
      <button type="button" class="btn-close-alert" onclick={() => (claimFeedback = null)} aria-label="Fechar alerta">
        <X size={13} />
      </button>
    </div>
  {/if}

  {#if availableItems.length === 0}
    {@render emptyAvailable()}
  {:else}
    <div class="editorial-cards-grid">
      {#each availableItems as item (item.cs.id)}
        {@const priorityMeta = formatPriority(item.ch.priority)}
        {@const coverUrl = getWorkCoverUrl(item.work)}
        {@const isTypeset = canonicalSlug === 'typeset'}
        {@const isRevisorQc = canonicalSlug === 'revisor_qc'}
        {@const typesetPrereqs = isTypeset ? checkTypesetPrerequisites(item.ch.id) : null}
        {@const qcPrereqs = isRevisorQc ? checkQcPrerequisites(item.ch.id) : null}
        {@const rawPrereqs = (!isTypeset && !isRevisorQc) ? checkRawPrerequisites(item.ch.id) : null}
        {@const canClaimStrict = isTypeset
          ? claimEvaluation.canClaim && typesetPrereqs?.isEligible
          : isRevisorQc
            ? claimEvaluation.canClaim && qcPrereqs?.isEligible
            : claimEvaluation.canClaim}

        <article class="editorial-card available-card" class:prereqs-blocked={(isTypeset && !typesetPrereqs?.isEligible) || (isRevisorQc && !qcPrereqs?.isEligible)}>
          <div class="card-top-cluster">
            <!-- Real work cover image or elegant stage-colored fallback -->
            <div class="card-cover-container">
              {#if coverUrl}
                <img
                  src={coverUrl}
                  alt={item.work?.title || 'Obra'}
                  class="card-cover-image"
                  loading="lazy"
                  decoding="async"
                />
              {:else}
                <div class="card-cover-fallback" style="--accent-color: {stageConfig.accentColor}">
                  <span class="fallback-nox-text">NOX</span>
                </div>
              {/if}
            </div>

            <!-- Metadata info -->
            <div class="card-details-block">
              <div class="card-meta-line">
                <span class="card-work-title" title={item.work?.title || 'Obra'}>
                  {item.work?.title || 'Obra sem título'}
                </span>
                <span class="card-priority-pill {priorityMeta.class}">
                  {#if item.ch.priority === 'URGENT'}
                    <span class="urgent-pulse-dot"></span>
                  {/if}
                  {priorityMeta.label}
                </span>
              </div>

              <div class="card-chapter-identity">
                <span class="chapter-number-badge">Cap. #{item.ch.chapter_number}</span>
                {#if item.ch.chapter_label}
                  <span class="chapter-label-text" title={item.ch.chapter_label}>{item.ch.chapter_label}</span>
                {/if}
              </div>

              <!-- Upstream Inputs Availability Indicator -->
              <div class="upstream-status-indicator">
                {#if isRevisorQc}
                  {#if qcPrereqs?.isEligible}
                    <span class="status-indicator-tag ready">
                      <CheckCircle2 size={11} class="text-emerald-400" />
                      <span>Pacote Typeset disponível ({qcPrereqs.typesetCount} arq.)</span>
                    </span>
                  {:else}
                    <span class="status-indicator-tag waiting">
                      <Clock size={11} class="text-amber-400" />
                      <span>{qcPrereqs?.blockedReason || 'Aguardando entrega do Typeset'}</span>
                    </span>
                  {/if}
                {:else if isTypeset}
                  {#if typesetPrereqs?.isEligible}
                    <span class="status-indicator-tag ready">
                      <CheckCircle2 size={11} class="text-emerald-400" />
                      <span>Clean ({typesetPrereqs.cleanCount}) &bull; Tradução ({typesetPrereqs.tradCount}) prontos</span>
                    </span>
                  {:else}
                    <span class="status-indicator-tag waiting">
                      <Clock size={11} class="text-amber-400" />
                      <span>{typesetPrereqs?.blockedReason || 'Aguardando insumos'}</span>
                    </span>
                  {/if}
                {:else}
                  {#if rawPrereqs?.rawReady}
                    <span class="status-indicator-tag ready">
                      <CheckCircle2 size={11} class="text-emerald-400" />
                      <span>RAW original disponível ({rawPrereqs.rawCount} arq.)</span>
                    </span>
                  {:else}
                    <span class="status-indicator-tag waiting">
                      <Clock size={11} class="text-amber-400" />
                      <span>Aguardando RAW original</span>
                    </span>
                  {/if}
                {/if}
              </div>
            </div>
          </div>

          <!-- Card Action Footer -->
          <div class="card-action-footer">
            {#if isDeadlineMandatory(canonicalSlug)}
              <button
                type="button"
                class="btn-editorial-claim"
                class:btn-disabled={!canClaimStrict}
                disabled={!canClaimStrict}
                onclick={() => handleOpenClaimModal(item.cs, item.ch, item.work, stageConfig, canonicalSlug)}
                title={!claimEvaluation.canClaim
                  ? `Requer o cargo ${stageConfig.roleRequiredName}`
                  : isTypeset && !typesetPrereqs?.isEligible
                    ? typesetPrereqs?.blockedReason
                    : isRevisorQc && !qcPrereqs?.isEligible
                      ? qcPrereqs?.blockedReason
                      : stageConfig.claimActionLabel}
              >
                {#if !claimEvaluation.canClaim}
                  <Lock size={13} />
                  <span>Cargo {stageConfig.roleRequiredName} necessário</span>
                {:else if isTypeset && !typesetPrereqs?.isEligible}
                  <Clock size={13} />
                  <span>Pré-requisitos pendentes</span>
                {:else if isRevisorQc && !qcPrereqs?.isEligible}
                  <Clock size={13} />
                  <span>Aguardando Typeset</span>
                {:else}
                  <Zap size={14} class="btn-icon-zap" />
                  <span>{stageConfig.claimActionLabel}</span>
                {/if}
              </button>
            {:else}
              <form
                method="POST"
                action="?/claimStage"
                use:enhance={() => {
                  isClaimingStageId = item.cs.id;
                  claimFeedback = null;
                  return async ({ result, update }) => {
                    isClaimingStageId = null;
                    if (result.type === 'failure') {
                      claimFeedback = {
                        stageId: item.cs.id,
                        type: 'error',
                        text: result.data?.message || 'Não foi possível assumir este capítulo.'
                      };
                    } else {
                      await update();
                      selectCategory('mine');
                      expandedChapterIds[item.cs.id] = true;
                    }
                  };
                }}
                class="claim-form-full"
              >
                <input type="hidden" name="chapter_stage_id" value={item.cs.id} />
                <button
                  type="submit"
                  class="btn-editorial-claim"
                  class:btn-disabled={!canClaimStrict}
                  disabled={!canClaimStrict || isClaimingStageId === item.cs.id}
                  title={!claimEvaluation.canClaim
                    ? `Requer o cargo ${stageConfig.roleRequiredName}`
                    : isTypeset && !typesetPrereqs?.isEligible
                      ? typesetPrereqs?.blockedReason
                      : isRevisorQc && !qcPrereqs?.isEligible
                        ? qcPrereqs?.blockedReason
                        : stageConfig.claimActionLabel}
                >
                  {#if isClaimingStageId === item.cs.id}
                    <span class="spinner-editorial-xs"></span>
                    <span>Assumindo...</span>
                  {:else if !claimEvaluation.canClaim}
                    <Lock size={13} />
                    <span>Cargo {stageConfig.roleRequiredName} necessário</span>
                  {:else if isTypeset && !typesetPrereqs?.isEligible}
                    <Clock size={13} />
                    <span>Pré-requisitos pendentes</span>
                  {:else if isRevisorQc && !qcPrereqs?.isEligible}
                    <Clock size={13} />
                    <span>Aguardando Typeset</span>
                  {:else}
                    <Zap size={14} class="btn-icon-zap" />
                    <span>{stageConfig.claimActionLabel}</span>
                  {/if}
                </button>
              </form>
            {/if}

            <button
              type="button"
              class="btn-action-view-details available-details"
              onclick={() => onOpenChapter(item.ch)}
              title="Ver ficha técnica, equipe e comentários deste capítulo"
            >
              <span>Ver detalhes</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </article>
      {/each}
    </div>
  {/if}
{/snippet}

<!-- SNIPPET 2: MY CHAPTERS POOL (ACTIVE WORKSPACE) -->
{#snippet myCards()}
  {#if completeFeedback}
    <div class="editorial-alert-banner {completeFeedback.type}">
      <AlertCircle size={15} />
      <span>{completeFeedback.text}</span>
      <button type="button" class="btn-close-alert" onclick={() => (completeFeedback = null)} aria-label="Fechar alerta">
        <X size={13} />
      </button>
    </div>
  {/if}

  {#if myItems.length === 0}
    {@render emptyMine()}
  {:else}
    <div class="editorial-cards-grid">
      {#each myItems as item (item.cs.id)}
        {@const deliverables = getDeliverableFiles(item.cs, item.ch.id)}
        {@const hasDeliverables = deliverables.length > 0}
        {@const coverUrl = getWorkCoverUrl(item.work)}
        {@const upstream = getUpstreamInputs(item.ch.id)}
        {@const isExpanded = !!expandedChapterIds[item.cs.id]}
        {@const isRework = item.cs.status === 'REWORK'}
        {@const isTypeset = canonicalSlug === 'typeset'}
        {@const isRevisorQc = canonicalSlug === 'revisor_qc'}
        {@const itemIssues = isRevisorQc ? getChapterQcIssues(item.ch.id) : []}
        {@const itemOpenIssues = isRevisorQc ? getOpenQcIssues(item.ch.id) : []}
        {@const canApproveQc = isRevisorQc && upstream.hasTypeset && !upstream.hasIncompleteTypeset && itemOpenIssues.length === 0}
        {@const accordion = mobileAccordionState[item.cs.id] || { inputs: true, delivery: true }}

        <article class="editorial-card my-work-card" class:is-expanded={isExpanded} class:is-rework={isRework}>
          <!-- Rework Notice Banner if returned by QC -->
          {#if isRework}
            <div class="card-rework-banner">
              <div class="rework-banner-head">
                <AlertTriangle size={14} class="text-amber-400" />
                <span class="rework-banner-title">Correção solicitada pelo QC</span>
              </div>
              {#if item.cs.notes || item.cs.rejection_reason}
                <p class="rework-banner-text">{item.cs.notes || item.cs.rejection_reason}</p>
              {/if}
            </div>
          {/if}

          <!-- Card Header Cluster -->
          <div class="card-top-cluster">
            <!-- Real work cover image or fallback -->
            <div class="card-cover-container">
              {#if coverUrl}
                <img
                  src={coverUrl}
                  alt={item.work?.title || 'Obra'}
                  class="card-cover-image"
                  loading="lazy"
                  decoding="async"
                />
              {:else}
                <div class="card-cover-fallback" style="--accent-color: {stageConfig.accentColor}">
                  <span class="fallback-nox-text">NOX</span>
                </div>
              {/if}
            </div>

            <div class="card-details-block">
              <div class="card-meta-line">
                <span class="card-work-title" title={item.work?.title || 'Obra'}>
                  {item.work?.title || 'Obra sem título'}
                </span>

                {#if isRework}
                  <span class="card-status-badge rework">
                    <AlertTriangle size={11} />
                    <span>Correção solicitada</span>
                  </span>
                {:else if isRevisorQc}
                  {#if itemOpenIssues.length > 0}
                    <span class="card-status-badge qc-has-issues">
                      <AlertTriangle size={11} />
                      <span>{itemOpenIssues.length} erro{itemOpenIssues.length === 1 ? '' : 's'} apontado{itemOpenIssues.length === 1 ? '' : 's'}</span>
                    </span>
                  {:else if upstream.hasIncompleteTypeset}
                    <span class="card-status-badge qc-waiting-material" title="O pacote de Typeset contém páginas sem falas diagramadas">
                      <AlertTriangle size={11} />
                      <span>Aguardando correção do material</span>
                    </span>
                  {:else if upstream.hasTypeset}
                    <span class="card-status-badge ready">
                      <CheckCircle2 size={11} />
                      <span>Pronto para revisão</span>
                    </span>
                  {:else}
                    <span class="card-status-badge in-progress" style="--accent-color: {stageConfig.accentColor}">
                      <Clock size={11} />
                      <span>Em andamento</span>
                    </span>
                  {/if}
                {:else if hasDeliverables}
                  <span class="card-status-badge ready">
                    <CheckCircle2 size={11} />
                    <span>Pronto para concluir &bull; {deliverables.length} {deliverables.length === 1 ? 'arq.' : 'arqs.'}</span>
                  </span>
                {:else}
                  <span class="card-status-badge in-progress" style="--accent-color: {stageConfig.accentColor}">
                    <Clock size={11} />
                    <span>Em andamento</span>
                  </span>
                {/if}
              </div>

              <div class="card-chapter-identity">
                <span class="chapter-number-badge">Cap. #{item.ch.chapter_number}</span>
                {#if item.ch.chapter_label}
                  <span class="chapter-label-text" title={item.ch.chapter_label}>{item.ch.chapter_label}</span>
                {/if}
              </div>

              <!-- REFINED ACTION HIERARCHY (NO BUTTON COMPETITION) -->
              <div class="my-card-actions-row">
                {#if isRevisorQc}
                  <!-- REVISOR (QC) ACTIONS: IDENTICAL HEIGHT, PROPORTIONS & ANCHORS TO TYPESET -->
                  <button
                    type="button"
                    class="btn-action-open-work primary-row-btn"
                    class:active={isExpanded}
                    onclick={() => toggleChapterWorkspace(item.cs.id)}
                    title={isExpanded ? 'Recolher área de revisão' : 'Abrir área de revisão e materiais'}
                  >
                    <FolderKanban size={13} />
                    <span>{isExpanded ? 'Recolher trabalho' : 'Abrir trabalho'}</span>
                    {#if isExpanded}<ChevronUp size={13} />{:else}<ChevronDown size={13} />{/if}
                  </button>

                  <div class="secondary-actions-row">
                    <!-- Extra Action: Abrir leitor QC -->
                    <button
                      type="button"
                      class="btn-action-secondary qc-reader-btn"
                      onclick={() => handleOpenReader(item.ch)}
                      title="Abrir o leitor privado de revisão do QC"
                    >
                      <Eye size={13} class="text-purple-400" />
                      <span>Abrir leitor QC</span>
                    </button>

                    <!-- Dedicated Secondary Action: Ver detalhes da página do capítulo -->
                    <button
                      type="button"
                      class="btn-action-view-details"
                      onclick={() => onOpenChapter(item.ch)}
                      title="Abrir página de detalhes, equipe e comentários deste capítulo"
                    >
                      <span>Ver detalhes</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                {:else if isExpanded}
                  <!-- STATE EXPANDED: Workspace is open below; top controls toggle collapse or view details -->
                  <button
                    type="button"
                    class="btn-action-open-work primary-row-btn active"
                    onclick={() => toggleChapterWorkspace(item.cs.id)}
                    title="Recolher área de trabalho"
                  >
                    <FolderKanban size={13} />
                    <span>Recolher trabalho</span>
                    <ChevronUp size={13} />
                  </button>

                  <div class="secondary-actions-row is-single">
                    <button
                      type="button"
                      class="btn-action-view-details"
                      onclick={() => onOpenChapter(item.ch)}
                      title="Abrir página de detalhes, equipe e comentários deste capítulo"
                    >
                      <span>Ver detalhes</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                {:else if hasDeliverables}
                  <!-- STATE COLLAPSED & READY: Primary highlight is Concluir, secondary is Abrir and Detalhes -->
                  <form
                    method="POST"
                    action="?/completeStageAction"
                    use:enhance={() => {
                      isCompletingStageId = item.cs.id;
                      completeFeedback = null;
                      return async ({ result, update }) => {
                        isCompletingStageId = null;
                        if (result.type === 'failure') {
                          completeFeedback = {
                            stageId: item.cs.id,
                            type: 'error',
                            text: result.data?.message || 'Não foi possível concluir a etapa.'
                          };
                        } else {
                          completeFeedback = {
                            stageId: item.cs.id,
                            type: 'success',
                            text: `Etapa ${stageConfig.title} concluída com sucesso!`
                          };
                          await update();
                        }
                      };
                    }}
                    class="complete-form-primary"
                  >
                    <input type="hidden" name="chapter_stage_id" value={item.cs.id} />
                    <button
                      type="submit"
                      class="btn-action-complete-prominent primary-row-btn"
                      disabled={isCompletingStageId === item.cs.id}
                      title="Concluir etapa e avançar no pipeline"
                    >
                      {#if isCompletingStageId === item.cs.id}
                        <span class="spinner-editorial-xs"></span>
                        <span>Concluindo...</span>
                      {:else}
                        <CheckCircle2 size={14} />
                        <span>{stageConfig.completeActionLabel}</span>
                      {/if}
                    </button>
                  </form>

                  <div class="secondary-actions-row">
                    <!-- Secondary Action: Abrir trabalho -->
                    <button
                      type="button"
                      class="btn-action-open-work"
                      onclick={() => toggleChapterWorkspace(item.cs.id)}
                      title="Abrir materiais e arquivos"
                    >
                      <FolderKanban size={13} />
                      <span>Abrir trabalho</span>
                      <ChevronDown size={13} />
                    </button>

                    <!-- Dedicated Secondary Action: Ver detalhes da página do capítulo -->
                    <button
                      type="button"
                      class="btn-action-view-details"
                      onclick={() => onOpenChapter(item.ch)}
                      title="Abrir página de detalhes, equipe e comentários deste capítulo"
                    >
                      <span>Ver detalhes</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                {:else}
                  <!-- STATE COLLAPSED & IN PROGRESS (PRIMARY NOX PURPLE ACTION) -->
                  <button
                    type="button"
                    class="btn-action-open-work primary-row-btn"
                    onclick={() => toggleChapterWorkspace(item.cs.id)}
                    title="Abrir materiais e arquivos"
                  >
                    <FolderKanban size={13} />
                    <span>Abrir trabalho</span>
                    <ChevronDown size={13} />
                  </button>

                  <div class="secondary-actions-row">
                    <!-- Secondary Action: Arquivos -->
                    <button
                      type="button"
                      class="btn-action-secondary"
                      onclick={() => {
                        expandedChapterIds[item.cs.id] = true;
                        if (!mobileAccordionState[item.cs.id]) {
                          mobileAccordionState[item.cs.id] = { inputs: true, delivery: true };
                        }
                      }}
                      title="Acessar arquivos e entregas"
                    >
                      <Upload size={13} />
                      <span>Arquivos</span>
                    </button>

                    <!-- Dedicated Secondary Action: Ver detalhes da página do capítulo -->
                    <button
                      type="button"
                      class="btn-action-view-details"
                      onclick={() => onOpenChapter(item.ch)}
                      title="Abrir página de detalhes, equipe e comentários deste capítulo"
                    >
                      <span>Ver detalhes</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                {/if}
              </div>
            </div>
          </div>

          <!-- INTEGRATED EDITORIAL WORKSPACE (EXPANDED ACCORDION) -->
          {#if isExpanded}
            <div class="editorial-expanded-workspace">
              <!-- SUB-SECTION 1: MATERIAIS DE ENTRADA (INPUTS) -->
              <section class="workspace-subpanel inputs-panel">
                <button
                  type="button"
                  class="subpanel-header-toggle"
                  onclick={() => toggleMobileSection(item.cs.id, 'inputs')}
                  aria-expanded={accordion.inputs}
                >
                  <div class="subpanel-title-lockup">
                    <Download size={14} class="subpanel-icon" style="color: {stageConfig.accentLight}" />
                    <span class="subpanel-title">{isRevisorQc ? 'Materiais para revisão' : 'Materiais de entrada'}</span>
                    <span class="subpanel-count-tag">{upstream.all.length} arq.</span>
                  </div>
                  <span class="subpanel-chevron">
                    {#if accordion.inputs}
                      <ChevronUp size={14} />
                    {:else}
                      <ChevronDown size={14} />
                    {/if}
                  </span>
                </button>

                {#if accordion.inputs}
                  <div class="subpanel-body">
                    {#if isRevisorQc}
                      <!-- QC REVISION MATERIALS -->
                      <div class="qc-materials-container">
                        <!-- Typeset Primary Deliverable Box -->
                        <div class="qc-typeset-primary-card">
                          <div class="qc-typeset-card-header">
                            <span class="dual-dot amber"></span>
                            <span class="qc-typeset-title">Pacote Final do Typeset (Material de Revisão)</span>
                            <span class="dual-badge amber">{upstream.typesetFiles.length} arq.</span>
                          </div>

                          {#if upstream.typesetFiles.length > 0}
                            <div class="files-pill-list">
                              {#each upstream.typesetFiles as file (file.id)}
                                <div class="file-download-item qc-typeset-item" class:is-invalid-file={file.is_invalid} class:is-incomplete-file={file.is_incomplete}>
                                  <div class="file-main-row">
                                    <FileArchive size={16} class="{file.is_invalid ? 'text-zinc-500' : file.is_incomplete ? 'text-amber-400' : 'text-emerald-400'} flex-shrink-0" />
                                    <div class="file-item-info">
                                      <div class="file-title-wrap">
                                        <span class="file-item-name" title={file.file_name}>{file.file_name}</span>
                                        {#if file.is_invalid}
                                          <span class="file-status-badge invalid" title="Arquivo de teste antigo com imagens placeholder">Inválido / Teste</span>
                                        {:else if file.is_incomplete}
                                          <span class="file-status-badge incomplete" title="Páginas limpas do Clean/Redraw sem falas diagramadas">Balões Vazios</span>
                                        {/if}
                                      </div>
                                      <span class="file-item-sub">
                                        {#if file.is_invalid}
                                          Versão antiga obsoleta &bull; {formatBytes(file.byte_size)}
                                        {:else}
                                          Entregável v{file.version} &bull; {formatBytes(file.byte_size)}
                                        {/if}
                                      </span>
                                    </div>
                                  </div>
                                  <div class="qc-file-actions">
                                    <a
                                      href="/api/scan/production/files/{file.id}?download=1"
                                      download={file.file_name}
                                      class="btn-file-download {file.is_invalid ? 'zinc' : 'amber'}"
                                      title="Baixar {file.file_name}"
                                    >
                                      <Download size={13} />
                                      <span>Baixar {file.is_invalid ? 'Arquivo' : 'Typeset'}</span>
                                    </a>
                                    {#if file.is_invalid}
                                      <button
                                        type="button"
                                        class="btn-action-leitor-inline disabled"
                                        disabled
                                        title="Versão de teste antiga inválida. O leitor QC prioriza automaticamente a versão válida mais recente (v2)."
                                      >
                                        <EyeOff size={13} />
                                        <span>Inválido</span>
                                      </button>
                                    {:else}
                                      <button
                                        type="button"
                                        class="btn-action-leitor-inline"
                                        onclick={() => handleOpenReader(item.ch)}
                                        title="Abrir no Leitor de Revisão Privado"
                                      >
                                        <Eye size={13} />
                                        <span>Ler no QC</span>
                                      </button>
                                    {/if}
                                  </div>
                                </div>
                              {/each}
                            </div>

                            {#if upstream.hasIncompleteTypeset}
                              <div class="qc-typeset-incomplete-banner">
                                <AlertTriangle size={15} class="text-amber-400 flex-shrink-0" />
                                <div class="incomplete-banner-text">
                                  <strong>Material Incompleto:</strong> O pacote do Typeset contém apenas páginas limpas do Clean/Redraw com balões em branco. As falas da tradução não foram diagramadas. A aprovação está bloqueada até o envio do material diagramado.
                                </div>
                              </div>
                            {/if}
                          {:else}
                            <div class="dep-waiting-box">
                              <Clock size={13} class="text-amber-400" />
                              <span>Aguardando envio do pacote de páginas diagramadas pelo Typeset.</span>
                            </div>
                          {/if}
                        </div>

                        <!-- Auxiliary Inputs: Clean / Redraw & Tradução -->
                        <div class="typeset-dual-grid">
                          <div class="dual-input-card clean-box">
                            <div class="dual-box-header">
                              <div class="dual-box-title-wrap">
                                <span class="dual-dot pink"></span>
                                <span class="dual-box-title">Insumo: Clean / Redraw</span>
                              </div>
                              <span class="dual-badge pink">{upstream.cleanFiles.length} arq.</span>
                            </div>
                            {#if upstream.cleanFiles.length > 0}
                              <div class="files-pill-list">
                                {#each upstream.cleanFiles as file (file.id)}
                                  <div class="file-download-item">
                                    <div class="file-main-row">
                                      <FileText size={15} class="text-pink-400 flex-shrink-0" />
                                      <div class="file-item-info">
                                        <span class="file-item-name" title={file.file_name}>{file.file_name}</span>
                                        <span class="file-item-sub">v{file.version} &bull; {formatBytes(file.byte_size)}</span>
                                      </div>
                                    </div>
                                    <a
                                      href="/api/scan/production/files/{file.id}?download=1"
                                      download={file.file_name}
                                      class="btn-file-download pink"
                                      title="Baixar arquivos de Clean"
                                    >
                                      <Download size={13} />
                                      <span>Baixar Clean</span>
                                    </a>
                                  </div>
                                {/each}
                              </div>
                            {:else}
                              <div class="dep-waiting-box">
                                <Clock size={13} class="text-pink-400" />
                                <span>Nenhum arquivo de Clean anexado</span>
                              </div>
                            {/if}
                          </div>

                          <div class="dual-input-card trad-box">
                            <div class="dual-box-header">
                              <div class="dual-box-title-wrap">
                                <span class="dual-dot blue"></span>
                                <span class="dual-box-title">Insumo: Tradução</span>
                              </div>
                              <span class="dual-badge blue">{upstream.tradFiles.length} arq.</span>
                            </div>
                            {#if upstream.tradFiles.length > 0}
                              <div class="files-pill-list">
                                {#each upstream.tradFiles as file (file.id)}
                                  <div class="file-download-item">
                                    <div class="file-main-row">
                                      <FileText size={15} class="text-blue-400 flex-shrink-0" />
                                      <div class="file-item-info">
                                        <span class="file-item-name" title={file.file_name}>{file.file_name}</span>
                                        <span class="file-item-sub">v{file.version} &bull; {formatBytes(file.byte_size)}</span>
                                      </div>
                                    </div>
                                    <a
                                      href="/api/scan/production/files/{file.id}?download=1"
                                      download={file.file_name}
                                      class="btn-file-download blue"
                                      title="Baixar script de tradução"
                                    >
                                      <Download size={13} />
                                      <span>Baixar Tradução</span>
                                    </a>
                                  </div>
                                {/each}
                              </div>
                            {:else}
                              <div class="dep-waiting-box">
                                <Clock size={13} class="text-blue-400" />
                                <span>Nenhum script de tradução anexado</span>
                              </div>
                            {/if}
                          </div>
                        </div>
                      </div>
                    {:else if isTypeset}
                      <!-- TYPESET DUAL DOWNLOADS: CLEAN/REDRAW + TRADUÇÃO DISTINCT CARDS -->
                      <div class="typeset-dual-grid">
                        <!-- Clean / Redraw Input Box -->
                        <div class="dual-input-card clean-box">
                          <div class="dual-box-header">
                            <div class="dual-box-title-wrap">
                              <span class="dual-dot pink"></span>
                              <span class="dual-box-title">Insumo: Clean / Redraw</span>
                            </div>
                            <span class="dual-badge pink">{upstream.cleanFiles.length} arq.</span>
                          </div>

                          {#if upstream.cleanFiles.length > 0}
                            <div class="files-pill-list">
                              {#each upstream.cleanFiles as file (file.id)}
                                <div class="file-download-item">
                                  <div class="file-main-row">
                                    <FileText size={15} class="text-pink-400 flex-shrink-0" />
                                    <div class="file-item-info">
                                      <span class="file-item-name" title={file.file_name}>{file.file_name}</span>
                                      <span class="file-item-sub">v{file.version} &bull; {formatBytes(file.byte_size)}</span>
                                    </div>
                                  </div>
                                  <a
                                    href="/api/scan/production/files/{file.id}?download=1"
                                    download={file.file_name}
                                    class="btn-file-download pink"
                                    title="Baixar arquivos de Clean"
                                  >
                                    <Download size={13} />
                                    <span>Baixar Clean</span>
                                  </a>
                                </div>
                              {/each}
                            </div>
                          {:else}
                            <div class="dep-waiting-box">
                              <Clock size={13} class="text-pink-400" />
                              <span>Aguardando envio das páginas limpas pelo Clean/Redraw</span>
                            </div>
                          {/if}
                        </div>

                        <!-- Tradução Input Box -->
                        <div class="dual-input-card trad-box">
                          <div class="dual-box-header">
                            <div class="dual-box-title-wrap">
                              <span class="dual-dot blue"></span>
                              <span class="dual-box-title">Insumo: Tradução</span>
                            </div>
                            <span class="dual-badge blue">{upstream.tradFiles.length} arq.</span>
                          </div>

                          {#if upstream.tradFiles.length > 0}
                            <div class="files-pill-list">
                              {#each upstream.tradFiles as file (file.id)}
                                <div class="file-download-item">
                                  <div class="file-main-row">
                                    <FileText size={15} class="text-blue-400 flex-shrink-0" />
                                    <div class="file-item-info">
                                      <span class="file-item-name" title={file.file_name}>{file.file_name}</span>
                                      <span class="file-item-sub">v{file.version} &bull; {formatBytes(file.byte_size)}</span>
                                    </div>
                                  </div>
                                  <a
                                    href="/api/scan/production/files/{file.id}?download=1"
                                    download={file.file_name}
                                    class="btn-file-download blue"
                                    title="Baixar script de tradução"
                                  >
                                    <Download size={13} />
                                    <span>Baixar Tradução</span>
                                  </a>
                                </div>
                              {/each}
                            </div>
                          {:else}
                            <div class="dep-waiting-box">
                              <Clock size={13} class="text-blue-400" />
                              <span>Aguardando envio do script de tradução</span>
                            </div>
                          {/if}
                        </div>
                      </div>
                    {:else}
                      <!-- TRADUÇÃO & CLEAN/REDRAW: RAW ORIGINAL DOWNLOAD -->
                      {#if upstream.rawFiles && upstream.rawFiles.length > 0}
                        <div class="files-pill-list">
                          {#each upstream.rawFiles as file (file.id)}
                            <div class="file-download-item">
                              <div class="file-main-row">
                                <FileArchive size={16} class="text-purple-400 flex-shrink-0" />
                                <div class="file-item-info">
                                  <span class="file-item-name" title={file.file_name}>{file.file_name}</span>
                                  <span class="file-item-sub">RAW original &bull; v{file.version} &bull; {formatBytes(file.byte_size)}</span>
                                </div>
                              </div>
                              <a
                                href="/api/scan/production/files/{file.id}?download=1"
                                download={file.file_name}
                                class="btn-file-download purple"
                                title="Baixar RAW original do capítulo"
                              >
                                <Download size={13} />
                                <span>Baixar RAW</span>
                              </a>
                            </div>
                          {/each}
                        </div>
                      {:else}
                        <div class="dep-waiting-box">
                          <Clock size={13} class="text-slate-400" />
                          <span>Nenhum arquivo RAW original anexado a este capítulo no momento.</span>
                        </div>
                      {/if}
                    {/if}
                  </div>
                {/if}
              </section>

              <!-- SUB-SECTION 2: MINHA ENTREGA / MINHA REVISÃO -->
              <section class="workspace-subpanel delivery-panel">
                <button
                  type="button"
                  class="subpanel-header-toggle"
                  onclick={() => toggleMobileSection(item.cs.id, 'delivery')}
                  aria-expanded={accordion.delivery}
                >
                  <div class="subpanel-title-lockup">
                    {#if isRevisorQc}
                      <CheckCircle2 size={14} class="subpanel-icon" style="color: {stageConfig.accentLight}" />
                      <span class="subpanel-title">Minha revisão</span>
                      <span class="subpanel-count-tag mine">{itemIssues.length} apontamento{itemIssues.length === 1 ? '' : 's'}</span>
                    {:else}
                      <Upload size={14} class="subpanel-icon" style="color: {stageConfig.accentLight}" />
                      <span class="subpanel-title">{stageConfig.uploadTitle}</span>
                      <span class="subpanel-count-tag mine">{deliverables.length} arq.</span>
                    {/if}
                  </div>
                  <span class="subpanel-chevron">
                    {#if accordion.delivery}
                      <ChevronUp size={14} />
                    {:else}
                      <ChevronDown size={14} />
                    {/if}
                  </span>
                </button>

                {#if accordion.delivery}
                  <div class="subpanel-body">
                    {#if isRevisorQc}
                      <!-- QC REVIEW BODY -->
                      <div class="qc-review-panel-content">
                        <div class="qc-review-header-bar">
                          <div class="qc-review-status-text">
                            {#if itemOpenIssues.length === 0}
                              {#if upstream.hasIncompleteTypeset}
                                <AlertTriangle size={15} class="text-amber-400" />
                                <span>Nenhum apontamento pendente, mas o material ainda precisa ser finalizado pelo Typeset.</span>
                              {:else}
                                <CheckCircle2 size={15} class="text-emerald-400" />
                                <span>Nenhum erro pendente registrado. O capítulo pode ser aprovado.</span>
                              {/if}
                            {:else}
                              <AlertTriangle size={15} class="text-amber-400" />
                              <span>{itemOpenIssues.length} apontamento{itemOpenIssues.length === 1 ? '' : 's'} em aberto aguardando correção.</span>
                            {/if}
                          </div>

                          <div class="qc-review-actions-quick">
                            <button
                              type="button"
                              class="btn-qc-quick-read"
                              onclick={() => handleOpenReader(item.ch)}
                              title="Abrir o leitor para inspecionar página a página"
                            >
                              <Eye size={13} />
                              <span>Abrir leitor QC</span>
                            </button>

                            <button
                              type="button"
                              class="btn-qc-add-issue"
                              onclick={() => openAddIssueModal(item)}
                              title="Apontar novo problema neste capítulo"
                            >
                              <Plus size={13} />
                              <span>Novo apontamento</span>
                            </button>
                          </div>
                        </div>

                        <!-- List of QC issues -->
                        {#if itemIssues.length > 0}
                          <div class="qc-issues-grid">
                            {#each itemIssues as issue (issue.id)}
                              {@const isResolved = issue.status === 'RESOLVED'}
                              <div class="qc-issue-card" class:is-resolved={isResolved}>
                                <div class="qc-issue-card-top">
                                  <div class="qc-issue-badges">
                                    <span class="qc-page-badge">Pág. {issue.page_number}</span>
                                    <span class="qc-type-badge {issue.issue_type?.toLowerCase() || 'other'}">
                                      {issue.issue_type === 'TRANSLATION' ? 'Tradução' : issue.issue_type === 'CLEAN' ? 'Clean' : issue.issue_type === 'TYPE' ? 'Typeset' : 'Geral'}
                                    </span>
                                    {#if isResolved}
                                      <span class="qc-status-tag resolved">Resolvido</span>
                                    {:else}
                                      <span class="qc-status-tag open">Pendente</span>
                                    {/if}
                                  </div>

                                  <form
                                    method="POST"
                                    action="?/deleteQcIssue"
                                    use:enhance={() => {
                                      return async ({ update }) => {
                                        await update();
                                      };
                                    }}
                                  >
                                    <input type="hidden" name="issueId" value={issue.id} />
                                    <button
                                      type="submit"
                                      class="btn-delete-issue"
                                      title="Remover apontamento"
                                      aria-label="Excluir apontamento"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </form>
                                </div>

                                <p class="qc-issue-description">{issue.description}</p>
                              </div>
                            {/each}
                          </div>
                        {:else}
                          <div class="qc-empty-issues-box">
                            <CheckCircle2 size={16} class="text-slate-400" />
                            <span>Nenhum problema registrado até o momento. Use o <strong>Leitor QC</strong> para navegar ou clique em <strong>Novo apontamento</strong>.</span>
                          </div>
                        {/if}
                      </div>
                    {:else}
                      <!-- Pipeline Deliverable Upload Component (Tradução, Clean, Typeset) -->
                      <div class="upload-guidance-bar">
                        <span class="upload-format-label">{stageConfig.uploadFormatHint}</span>
                        <span class="upload-step-hint">{stageConfig.uploadStepHint}</span>
                      </div>

                      <div class="upload-component-embed">
                        <PipelineDeliverableUpload
                          scanId={scanId}
                          productionChapterId={item.ch.id}
                          stageId={item.cs.stage_id}
                          currentFiles={deliverables}
                        />
                      </div>
                    {/if}
                  </div>
                {/if}
              </section>

              <!-- SUB-SECTION 3: AÇÕES DA ETAPA (CONCLUSÃO & DEVOLVER À FILA) -->
              <div class="workspace-actions-footer">
                <div class="footer-actions-left">
                  <!-- Action: Devolver à fila -->
                  <form
                    method="POST"
                    action="?/releaseStage"
                    use:enhance={({ cancel }) => {
                      if (
                        !confirm(
                          'Devolver à fila: você deixará de ser o responsável por esta etapa e ela voltará a ficar disponível para qualquer membro pegar. Deseja continuar?'
                        )
                      ) {
                        cancel();
                      }
                      isReleasingStageId = item.cs.id;
                      return async ({ update }) => {
                        isReleasingStageId = null;
                        await update();
                      };
                    }}
                  >
                    <input type="hidden" name="chapter_stage_id" value={item.cs.id} />
                    <button
                      type="submit"
                      class="btn-release-queue"
                      disabled={isReleasingStageId === item.cs.id}
                      title="Largar etapa e devolvê-la para a fila de capítulos disponíveis"
                    >
                      <RotateCcw size={13} />
                      <span>Devolver à fila</span>
                    </button>
                  </form>
                </div>

                <div class="footer-actions-right">
                  {#if isRevisorQc}
                    <!-- QC ACTIONS: SOLICITAR CORREÇÕES (AMBER) & APROVAR CAPÍTULO (GREEN) -->
                    <button
                      type="button"
                      class="btn-qc-rework-trigger"
                      onclick={() => openReworkModal(item)}
                      title="Solicitar correções para as etapas anteriores"
                    >
                      <AlertTriangle size={14} />
                      <span>Solicitar correções</span>
                    </button>

                    <button
                      type="button"
                      class="btn-qc-approve-trigger"
                      class:btn-disabled={!canApproveQc}
                      disabled={!canApproveQc}
                      onclick={() => openApproveModal(item)}
                      title={upstream.hasIncompleteTypeset
                        ? 'Aprovação bloqueada: O material do Typeset contém apenas páginas limpas sem diagramação de falas. Solicite correções.'
                        : itemOpenIssues.length > 0
                          ? `Existem ${itemOpenIssues.length} correções pendentes. Resolva-as antes de aprovar.`
                          : !upstream.hasTypeset
                            ? 'Aguardando pacote final do Typeset'
                            : 'Aprovar capítulo e encaminhar para Pré-aprovado'}
                    >
                      <CheckCircle2 size={14} />
                      <span>Aprovar capítulo</span>
                    </button>
                  {:else}
                    <!-- Action: Concluir etapa (Tradução, Clean, Typeset) -->
                    <form
                      method="POST"
                      action="?/completeStageAction"
                      use:enhance={() => {
                        isCompletingStageId = item.cs.id;
                        completeFeedback = null;
                        return async ({ result, update }) => {
                          isCompletingStageId = null;
                          if (result.type === 'failure') {
                            completeFeedback = {
                              stageId: item.cs.id,
                              type: 'error',
                              text: result.data?.message || 'Não foi possível concluir a etapa.'
                            };
                          } else {
                            completeFeedback = {
                              stageId: item.cs.id,
                              type: 'success',
                              text: `Etapa ${stageConfig.title} concluída com sucesso!`
                            };
                            await update();
                          }
                        };
                      }}
                    >
                      <input type="hidden" name="chapter_stage_id" value={item.cs.id} />
                      <button
                        type="submit"
                        class="btn-concluir-workspace"
                        disabled={!hasDeliverables || isCompletingStageId === item.cs.id}
                        title={!hasDeliverables ? 'Envie ao menos um arquivo válido antes de concluir' : 'Concluir esta etapa'}
                      >
                        {#if isCompletingStageId === item.cs.id}
                          <span class="spinner-editorial-xs"></span>
                          <span>Concluindo...</span>
                        {:else}
                          <CheckCircle2 size={14} />
                          <span>{stageConfig.completeActionLabel}</span>
                        {/if}
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
{/snippet}

<!-- SNIPPET 3: COMPACT CONTEXTUAL EMPTY STATE FOR AVAILABLE POOL -->
{#snippet emptyAvailable()}
  <div class="editorial-empty-card">
    <div class="empty-icon-halo" style="--halo-glow: {stageConfig.accentGlow}">
      <CheckCircle2 size={18} style="color: {stageConfig.accentLight}" />
    </div>
    <div class="empty-text-group">
      <strong class="empty-card-heading">{stageConfig.emptyAvailableTitle}</strong>
      <p class="empty-card-subtext">{stageConfig.emptyAvailableDesc}</p>
    </div>
    {#if myItems.length > 0}
      <button
        type="button"
        class="btn-empty-switch"
        onclick={() => selectCategory('mine')}
        title="Ver meus capítulos em andamento"
      >
        <Clock size={13} />
        <span>Ver meus capítulos ({myItems.length})</span>
      </button>
    {/if}
  </div>
{/snippet}

<!-- SNIPPET 4: COMPACT CONTEXTUAL EMPTY STATE FOR MY WORK -->
{#snippet emptyMine()}
  <div class="editorial-empty-card">
    <div class="empty-icon-halo neutral">
      <Clock size={18} class="text-slate-400" />
    </div>
    <div class="empty-text-group">
      <strong class="empty-card-heading">{stageConfig.emptyMineTitle}</strong>
      <p class="empty-card-subtext">{stageConfig.emptyMineDesc}</p>
    </div>
    {#if availableItems.length > 0}
      <button
        type="button"
        class="btn-empty-switch accent"
        style="--accent-color: {stageConfig.accentColor}"
        onclick={() => selectCategory('available')}
        title="Ver capítulos disponíveis para assumir"
      >
        <Zap size={13} />
        <span>Ver {availableItems.length} capítulo{availableItems.length > 1 ? 's' : ''} disponível{availableItems.length > 1 ? 'is' : ''}</span>
      </button>
    {/if}
  </div>
{/snippet}

<!-- MAIN COMPONENT ROOT -->
<div class="editorial-workspace-root">
  <!-- COMPACT EDITORIAL HEADER (70–85px, Sleek lockup, 0 redundant breadcrumbs or 7 stage buttons) -->
  <header class="editorial-header">
    <div class="editorial-header-info">
      <div class="editorial-title-row">
        <h1 class="editorial-title">{stageConfig.title}</h1>
        <span
          class="stage-pill-badge"
          style="background: {stageConfig.pillBg}; border-color: {stageConfig.pillBorder}; color: {stageConfig.accentLight};"
        >
          <span class="stage-dot" style="background: {stageConfig.accentColor}"></span>
          <span>{stageConfig.pillLabel}</span>
        </span>
      </div>
      <p class="editorial-subtitle desktop-sub">{stageConfig.subtitle}</p>
      <p class="editorial-subtitle mobile-sub">{stageConfig.mobileSubtitle}</p>
    </div>

    <div class="editorial-header-meta">
      <div class="header-stat-pill" title="Capítulos disponíveis e sob sua responsabilidade">
        <span class="stat-count-available">{availableItems.length} disponíveis</span>
        <span class="stat-divider">&bull;</span>
        <span class="stat-count-mine">{myItems.length} em andamento</span>
      </div>
    </div>
  </header>

  <!-- WORKSPACE CONTAINER WITH SEGMENTED TABS & FILTERS -->
  <div class="editorial-workspace-container">
    <!-- NAVIGATION & FILTER TOOLBAR -->
    <div class="editorial-nav-bar">
      <!-- Segmented Tab Control -->
      <div class="segmented-control" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeCategory === 'available'}
          class="segment-btn"
          class:active={activeCategory === 'available'}
          onclick={() => selectCategory('available')}
        >
          <Layers size={14} class="segment-icon" style="color: {stageConfig.accentLight}" />
          <span class="segment-label">Disponíveis</span>
          <span class="segment-badge" class:urgent={hasUrgentAvailable}>
            {availableItems.length}
          </span>
          {#if hasUrgentAvailable}
            <span class="urgent-dot-halo" title="Capítulo urgente aguardando esta etapa"></span>
          {/if}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeCategory === 'mine'}
          class="segment-btn"
          class:active={activeCategory === 'mine'}
          onclick={() => selectCategory('mine')}
        >
          <Clock size={14} class="segment-icon text-purple-400" />
          <span class="segment-label">Meus capítulos</span>
          <span class="segment-badge mine">
            {myItems.length}
          </span>
        </button>

        <!-- Desktop Option: View Both Pools Side by Side -->
        <button
          type="button"
          role="tab"
          aria-selected={activeCategory === 'both'}
          class="segment-btn desktop-only"
          class:active={activeCategory === 'both'}
          onclick={() => selectCategory('both')}
        >
          <FolderKanban size={14} class="segment-icon text-slate-400" />
          <span class="segment-label">Ambos</span>
        </button>
      </div>

      <!-- Integrated Search & Filter Controls -->
      {#if works.length > 0}
        <div class="editorial-filters-toolbar">
          <div class="mini-search-box">
            <span class="mini-search-icon-wrap" aria-hidden="true">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Buscar obra ou capítulo..."
              bind:value={searchQuery}
              class="mini-search-input"
            />
            {#if searchQuery}
              <button
                type="button"
                class="btn-clear-search-mini"
                onclick={() => (searchQuery = '')}
                aria-label="Limpar busca"
              >
                <X size={12} />
              </button>
            {/if}
          </div>

          {#if works.length > 1}
            <select bind:value={filterWorkId} class="mini-work-select" aria-label="Filtrar por obra">
              <option value="ALL">Todas as obras ({works.length})</option>
              {#each works as w (w.id)}
                <option value={w.id}>{w.title}</option>
              {/each}
            </select>
          {/if}
        </div>
      {/if}
    </div>

    <!-- WORKSPACE CONTENT AREA -->
    <div class="editorial-content-area">
      {#if activeCategory === 'available'}
        {@render availableCards()}
      {:else if activeCategory === 'mine'}
        {@render myCards()}
      {:else if activeCategory === 'both'}
        <div class="editorial-side-by-side">
          <div class="side-pool-column">
            <div class="side-column-header">
              <div class="side-column-title-wrap">
                <Layers size={15} style="color: {stageConfig.accentLight}" />
                <h2 class="side-column-heading">Capítulos disponíveis</h2>
                <span class="segment-badge">{availableItems.length}</span>
              </div>
            </div>
            {@render availableCards()}
          </div>

          <div class="side-pool-column">
            <div class="side-column-header">
              <div class="side-column-title-wrap">
                <Clock size={15} class="text-purple-400" />
                <h2 class="side-column-heading">Meus capítulos</h2>
                <span class="segment-badge mine">{myItems.length}</span>
              </div>
            </div>
            {@render myCards()}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- =========================================================================
     REVISOR (QC) INTERACTIVE MODALS
     ========================================================================= -->

<!-- MODAL 1: SOLICITAR CORREÇÕES (MULTI-STAGE REWORK) -->
{#if isReworkModalOpen && reworkTargetItem}
  <div
    class="editorial-modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-rework-title"
  >
    <div class="editorial-modal-dialog rework-dialog">
      <header class="modal-header">
        <div class="modal-header-title-lockup">
          <div class="modal-icon-bubble amber">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h3 id="modal-rework-title" class="modal-title">
              Solicitar Correções &bull; Cap. #{reworkTargetItem.ch.chapter_number}
            </h3>
            <p class="modal-subtitle">
              Para quais etapas o capítulo precisa voltar?
            </p>
          </div>
        </div>
        <button
          type="button"
          class="btn-modal-close"
          onclick={closeReworkModal}
          aria-label="Fechar modal"
        >
          <X size={16} />
        </button>
      </header>

      {#if reworkFeedback}
        <div class="editorial-alert-banner {reworkFeedback.type}">
          <AlertCircle size={15} />
          <span>{reworkFeedback.text}</span>
        </div>
      {/if}

      <form
        method="POST"
        action="?/requestQcRework"
        use:enhance={() => {
          isSubmittingRework = true;
          reworkFeedback = null;
          return async ({ result, update }) => {
            isSubmittingRework = false;
            if (result.type === 'failure') {
              reworkFeedback = {
                type: 'error',
                text: result.data?.message || 'Falha ao solicitar correções.'
              };
            } else {
              closeReworkModal();
              await update();
            }
          };
        }}
        class="rework-form-container"
      >
        <input type="hidden" name="qc_stage_id" value={reworkTargetItem.cs.id} />
        <input type="hidden" name="rework_payload" value={reworkPayloadJson} />

        <div class="modal-body-scroll">
          <!-- STAGE CHECKBOX SELECTORS -->
          <div class="rework-selection-section">
            <label class="section-label">Selecione uma ou mais etapas afetadas:</label>
            <div class="rework-stage-checkboxes">
              <!-- Tradução Checkbox -->
              <label class="stage-checkbox-card" class:is-checked={reworkSelectedStages.traducao}>
                <input
                  type="checkbox"
                  bind:checked={reworkSelectedStages.traducao}
                  class="sr-only"
                />
                <span class="custom-chk-box blue">
                  {#if reworkSelectedStages.traducao}&check;{/if}
                </span>
                <div class="chk-label-group">
                  <span class="chk-stage-name">Tradução</span>
                  <span class="chk-stage-desc">Texto, diálogos, nomes ou erros gramaticais</span>
                </div>
              </label>

              <!-- Clean/Redraw Checkbox -->
              <label class="stage-checkbox-card" class:is-checked={reworkSelectedStages.clean_redraw}>
                <input
                  type="checkbox"
                  bind:checked={reworkSelectedStages.clean_redraw}
                  class="sr-only"
                />
                <span class="custom-chk-box pink">
                  {#if reworkSelectedStages.clean_redraw}&check;{/if}
                </span>
                <div class="chk-label-group">
                  <span class="chk-stage-name">Clean / Redraw</span>
                  <span class="chk-stage-desc">Limpeza de balões, arte incompleta ou corte</span>
                </div>
              </label>

              <!-- Typeset Checkbox -->
              <label class="stage-checkbox-card" class:is-checked={reworkSelectedStages.typeset}>
                <input
                  type="checkbox"
                  bind:checked={reworkSelectedStages.typeset}
                  class="sr-only"
                />
                <span class="custom-chk-box amber">
                  {#if reworkSelectedStages.typeset}&check;{/if}
                </span>
                <div class="chk-label-group">
                  <span class="chk-stage-name">Typeset</span>
                  <span class="chk-stage-desc">Posicionamento, fonte, quebra de linha ou balão</span>
                </div>
              </label>
            </div>
          </div>

          <!-- DETAILED INPUTS PER SELECTED STAGE -->
          {#if reworkSelectedStages.traducao}
            <div class="stage-issues-block blue-theme">
              <div class="stage-issues-header">
                <span class="stage-dot-badge blue"></span>
                <span class="stage-block-title">Apontamentos para Tradução</span>
                <span class="stage-flow-hint">O Typeset receberá os novos textos para atualizar as páginas.</span>
              </div>

              <div class="issue-rows-list">
                {#each reworkIssues.traducao as issueRow, idx}
                  <div class="issue-input-row">
                    <div class="issue-field-page">
                      <label for="trad_page_{idx}" class="field-label-mini">Página</label>
                      <input
                        id="trad_page_{idx}"
                        type="number"
                        min="1"
                        placeholder="Ex: 12"
                        bind:value={issueRow.page}
                        class="modal-input-compact"
                      />
                    </div>

                    <div class="issue-field-region">
                      <label for="trad_reg_{idx}" class="field-label-mini">Balão / Região</label>
                      <input
                        id="trad_reg_{idx}"
                        type="text"
                        placeholder="Ex: Balão 3, topo..."
                        bind:value={issueRow.region}
                        class="modal-input-compact"
                      />
                    </div>

                    <div class="issue-field-desc">
                      <label for="trad_desc_{idx}" class="field-label-mini">Problema encontrado (obrigatório)</label>
                      <input
                        id="trad_desc_{idx}"
                        type="text"
                        placeholder="Ex: A fala deste personagem está traduzida incorretamente."
                        bind:value={issueRow.description}
                        class="modal-input-compact"
                        required
                      />
                    </div>

                    {#if reworkIssues.traducao.length > 1}
                      <button
                        type="button"
                        class="btn-remove-row"
                        onclick={() => removeReworkIssueRow('traducao', idx)}
                        title="Remover este apontamento"
                        aria-label="Remover linha de apontamento"
                      >
                        <Trash2 size={13} />
                      </button>
                    {/if}
                  </div>
                {/each}
              </div>

              <button
                type="button"
                class="btn-add-issue-row"
                onclick={() => addReworkIssueRow('traducao')}
              >
                <Plus size={13} />
                <span>Adicionar outro apontamento para Tradução</span>
              </button>
            </div>
          {/if}

          {#if reworkSelectedStages.clean_redraw}
            <div class="stage-issues-block pink-theme">
              <div class="stage-issues-header">
                <span class="stage-dot-badge pink"></span>
                <span class="stage-block-title">Apontamentos para Clean / Redraw</span>
                <span class="stage-flow-hint">O Typeset receberá as novas páginas para rediagramar.</span>
              </div>

              <div class="issue-rows-list">
                {#each reworkIssues.clean_redraw as issueRow, idx}
                  <div class="issue-input-row">
                    <div class="issue-field-page">
                      <label for="clean_page_{idx}" class="field-label-mini">Página</label>
                      <input
                        id="clean_page_{idx}"
                        type="number"
                        min="1"
                        placeholder="Ex: 8"
                        bind:value={issueRow.page}
                        class="modal-input-compact"
                      />
                    </div>

                    <div class="issue-field-region">
                      <label for="clean_reg_{idx}" class="field-label-mini">Balão / Região</label>
                      <input
                        id="clean_reg_{idx}"
                        type="text"
                        placeholder="Ex: Quadro central..."
                        bind:value={issueRow.region}
                        class="modal-input-compact"
                      />
                    </div>

                    <div class="issue-field-desc">
                      <label for="clean_desc_{idx}" class="field-label-mini">Problema encontrado (obrigatório)</label>
                      <input
                        id="clean_desc_{idx}"
                        type="text"
                        placeholder="Ex: Balão não limpo corretamente ou arte cortada."
                        bind:value={issueRow.description}
                        class="modal-input-compact"
                        required
                      />
                    </div>

                    {#if reworkIssues.clean_redraw.length > 1}
                      <button
                        type="button"
                        class="btn-remove-row"
                        onclick={() => removeReworkIssueRow('clean_redraw', idx)}
                        title="Remover este apontamento"
                        aria-label="Remover linha de apontamento"
                      >
                        <Trash2 size={13} />
                      </button>
                    {/if}
                  </div>
                {/each}
              </div>

              <button
                type="button"
                class="btn-add-issue-row"
                onclick={() => addReworkIssueRow('clean_redraw')}
              >
                <Plus size={13} />
                <span>Adicionar outro apontamento para Clean/Redraw</span>
              </button>
            </div>
          {/if}

          {#if reworkSelectedStages.typeset}
            <div class="stage-issues-block amber-theme">
              <div class="stage-issues-header">
                <span class="stage-dot-badge amber"></span>
                <span class="stage-block-title">Apontamentos para Typeset</span>
                <span class="stage-flow-hint">O diagramador corrigirá e enviará diretamente para nova revisão QC.</span>
              </div>

              <div class="issue-rows-list">
                {#each reworkIssues.typeset as issueRow, idx}
                  <div class="issue-input-row">
                    <div class="issue-field-page">
                      <label for="type_page_{idx}" class="field-label-mini">Página</label>
                      <input
                        id="type_page_{idx}"
                        type="number"
                        min="1"
                        placeholder="Ex: 18"
                        bind:value={issueRow.page}
                        class="modal-input-compact"
                      />
                    </div>

                    <div class="issue-field-region">
                      <label for="type_reg_{idx}" class="field-label-mini">Balão / Região</label>
                      <input
                        id="type_reg_{idx}"
                        type="text"
                        placeholder="Ex: Balão 2..."
                        bind:value={issueRow.region}
                        class="modal-input-compact"
                      />
                    </div>

                    <div class="issue-field-desc">
                      <label for="type_desc_{idx}" class="field-label-mini">Problema encontrado (obrigatório)</label>
                      <input
                        id="type_desc_{idx}"
                        type="text"
                        placeholder="Ex: O texto está ultrapassando o limite do balão."
                        bind:value={issueRow.description}
                        class="modal-input-compact"
                        required
                      />
                    </div>

                    {#if reworkIssues.typeset.length > 1}
                      <button
                        type="button"
                        class="btn-remove-row"
                        onclick={() => removeReworkIssueRow('typeset', idx)}
                        title="Remover este apontamento"
                        aria-label="Remover linha de apontamento"
                      >
                        <Trash2 size={13} />
                      </button>
                    {/if}
                  </div>
                {/each}
              </div>

              <button
                type="button"
                class="btn-add-issue-row"
                onclick={() => addReworkIssueRow('typeset')}
              >
                <Plus size={13} />
                <span>Adicionar outro apontamento para Typeset</span>
              </button>
            </div>
          {/if}

          <!-- AFFECTED AREAS SUMMARY -->
          {#if isReworkValid}
            <div class="rework-summary-box">
              <CheckCircle2 size={14} class="text-emerald-400" />
              <span>
                O capítulo será devolvido com apontamentos estruturados preservando versões e arquivos anteriores.
              </span>
            </div>
          {/if}
        </div>

        <footer class="modal-footer">
          <button
            type="button"
            class="btn-modal-cancel"
            onclick={closeReworkModal}
            disabled={isSubmittingRework}
          >
            Cancelar
          </button>

          <button
            type="submit"
            class="btn-modal-confirm-rework"
            disabled={!isReworkValid || isSubmittingRework}
            title={!isReworkValid ? 'Selecione ao menos uma etapa e preencha a descrição do erro' : reworkButtonLabel}
          >
            {#if isSubmittingRework}
              <span class="spinner-editorial-xs"></span>
              <span>Enviando...</span>
            {:else}
              <RotateCcw size={14} />
              <span>{reworkButtonLabel}</span>
            {/if}
          </button>
        </footer>
      </form>
    </div>
  </div>
{/if}

<!-- MODAL 2: APROVAR CAPÍTULO -->
{#if isApproveModalOpen && approveTargetItem}
  {@const modalUpstream = getUpstreamInputs(approveTargetItem.ch.id)}
  {@const modalOpenIssues = getOpenQcIssues(approveTargetItem.ch.id)}
  {@const modalCanApprove = modalUpstream.hasTypeset && !modalUpstream.hasIncompleteTypeset && modalOpenIssues.length === 0}

  <div
    class="editorial-modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-approve-title"
  >
    <div class="editorial-modal-dialog approve-dialog">
      <header class="modal-header">
        <div class="modal-header-title-lockup">
          <div class="modal-icon-bubble green">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <h3 id="modal-approve-title" class="modal-title">
              Aprovar Capítulo &bull; Cap. #{approveTargetItem.ch.chapter_number}
            </h3>
            <p class="modal-subtitle">
              Confirmação de Controle de Qualidade
            </p>
          </div>
        </div>
        <button
          type="button"
          class="btn-modal-close"
          onclick={closeApproveModal}
          aria-label="Fechar modal"
        >
          <X size={16} />
        </button>
      </header>

      {#if approveFeedback}
        <div class="editorial-alert-banner {approveFeedback.type}">
          <AlertCircle size={15} />
          <span>{approveFeedback.text}</span>
        </div>
      {/if}

      <form
        method="POST"
        action="?/approveQcStage"
        use:enhance={() => {
          isSubmittingApprove = true;
          approveFeedback = null;
          return async ({ result, update }) => {
            isSubmittingApprove = false;
            if (result.type === 'failure') {
              approveFeedback = {
                type: 'error',
                text: result.data?.message || 'Falha ao aprovar capítulo.'
              };
            } else {
              closeApproveModal();
              await update();
            }
          };
        }}
        class="approve-form-container"
      >
        <input type="hidden" name="chapter_stage_id" value={approveTargetItem.cs.id} />

        <div class="modal-body-scroll">
          <!-- VERIFICATION CHECKLIST -->
          <div class="approve-checklist">
            <div class="checklist-item" class:is-ok={modalUpstream.hasTypeset} class:is-fail={!modalUpstream.hasTypeset}>
              {#if modalUpstream.hasTypeset}
                <CheckCircle2 size={15} class="text-emerald-400" />
                <span>Pacote diagramado do Typeset validado ({modalUpstream.validTypesetFiles.length} arq.)</span>
              {:else}
                <AlertTriangle size={15} class="text-rose-400" />
                <span>Nenhum pacote diagramado válido do Typeset encontrado</span>
              {/if}
            </div>

            <div class="checklist-item" class:is-ok={!modalUpstream.hasIncompleteTypeset} class:is-fail={modalUpstream.hasIncompleteTypeset}>
              {#if !modalUpstream.hasIncompleteTypeset}
                <CheckCircle2 size={15} class="text-emerald-400" />
                <span>Diagramação de falas e balões validada</span>
              {:else}
                <AlertTriangle size={15} class="text-rose-400" />
                <span>Material incompleto: páginas limpas sem falas diagramadas (balões vazios)</span>
              {/if}
            </div>

            <div class="checklist-item" class:is-ok={modalOpenIssues.length === 0} class:is-fail={modalOpenIssues.length > 0}>
              {#if modalOpenIssues.length === 0}
                <CheckCircle2 size={15} class="text-emerald-400" />
                <span>Nenhum apontamento pendente em aberto</span>
              {:else}
                <AlertTriangle size={15} class="text-rose-400" />
                <span>{modalOpenIssues.length} erro(s) pendente(s) necessita(m) de resolução antes de aprovar</span>
              {/if}
            </div>
          </div>

          <!-- STAGE PROGRESSION CALLOUT -->
          <div class="approve-info-callout">
            <span class="callout-lead">&bull; Destino:</span>
            <span>O capítulo avançará para o status <strong>Pré-aprovado</strong> na esteira da scan.</span>
            <span class="callout-secondary">Ele <strong>NÃO</strong> será publicado no catálogo até a etapa de publicação dedicada.</span>
          </div>

          <!-- NOTES FIELD -->
          <div class="approve-notes-block">
            <label for="approve_notes" class="field-label-mini">Observações finais da revisão (opcional):</label>
            <textarea
              id="approve_notes"
              name="notes"
              bind:value={approveNotes}
              rows="2"
              class="modal-textarea"
              placeholder="Ex: Tradução e diagramação revisadas com perfeição."
            ></textarea>
          </div>
        </div>

        <footer class="modal-footer">
          <button
            type="button"
            class="btn-modal-cancel"
            onclick={closeApproveModal}
            disabled={isSubmittingApprove}
          >
            Cancelar
          </button>

          <button
            type="submit"
            class="btn-modal-confirm-approve"
            disabled={!modalCanApprove || isSubmittingApprove}
            title={modalUpstream.hasIncompleteTypeset ? 'Aprovação bloqueada: páginas sem falas diagramadas' : !modalCanApprove ? 'Resolva os erros pendentes antes de aprovar' : 'Confirmar aprovação do capítulo'}
          >
            {#if isSubmittingApprove}
              <span class="spinner-editorial-xs"></span>
              <span>Aprovando...</span>
            {:else}
              <CheckCircle2 size={14} />
              <span>Confirmar Aprovação</span>
            {/if}
          </button>
        </footer>
      </form>
    </div>
  </div>
{/if}

<!-- MODAL 3: NOVO APONTAMENTO RÁPIDO (DIRETO DO WORKSPACE) -->
{#if isAddIssueModalOpen && addIssueTargetItem}
  <div
    class="editorial-modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-add-issue-title"
  >
    <div class="editorial-modal-dialog add-issue-dialog">
      <header class="modal-header">
        <div class="modal-header-title-lockup">
          <div class="modal-icon-bubble purple">
            <Plus size={18} />
          </div>
          <div>
            <h3 id="modal-add-issue-title" class="modal-title">
              Novo Apontamento &bull; Cap. #{addIssueTargetItem.ch.chapter_number}
            </h3>
            <p class="modal-subtitle">
              Sinalize um erro ou observação neste capítulo:
            </p>
          </div>
        </div>
        <button
          type="button"
          class="btn-modal-close"
          onclick={closeAddIssueModal}
          aria-label="Fechar modal"
        >
          <X size={16} />
        </button>
      </header>

      {#if addIssueFeedback}
        <div class="editorial-alert-banner {addIssueFeedback.type}">
          <AlertCircle size={15} />
          <span>{addIssueFeedback.text}</span>
        </div>
      {/if}

      <form
        method="POST"
        action="?/createQcIssue"
        use:enhance={() => {
          isSubmittingAddIssue = true;
          addIssueFeedback = null;
          return async ({ result, update }) => {
            isSubmittingAddIssue = false;
            if (result.type === 'failure') {
              addIssueFeedback = {
                type: 'error',
                text: result.data?.message || 'Falha ao registrar apontamento.'
              };
            } else {
              closeAddIssueModal();
              await update();
            }
          };
        }}
        class="add-issue-form"
      >
        <input type="hidden" name="chapterId" value={addIssueTargetItem.ch.id} />

        <div class="modal-body-scroll">
          <div class="add-issue-fields-grid">
            <div class="issue-field-group">
              <label for="new_issue_page" class="field-label-mini">Página</label>
              <input
                id="new_issue_page"
                type="number"
                name="pageNumber"
                min="1"
                bind:value={newIssuePage}
                class="modal-input-compact"
                required
              />
            </div>

            <div class="issue-field-group">
              <label for="new_issue_type" class="field-label-mini">Tipo de Problema</label>
              <select
                id="new_issue_type"
                name="issueType"
                bind:value={newIssueType}
                class="modal-input-compact select"
              >
                <option value="TYPE">Typeset (Diagramação)</option>
                <option value="CLEAN">Clean / Redraw (Arte / Limpeza)</option>
                <option value="TRANSLATION">Tradução (Texto / Diálogos)</option>
                <option value="OTHER">Outro / Geral</option>
              </select>
            </div>

            <div class="issue-field-group full-width">
              <label for="new_issue_region" class="field-label-mini">Balão / Região (opcional)</label>
              <input
                id="new_issue_region"
                type="text"
                name="region"
                placeholder="Ex: Balão 2, quadro superior, onomatopeia..."
                bind:value={newIssueRegion}
                class="modal-input-compact"
              />
            </div>

            <div class="issue-field-group full-width">
              <label for="new_issue_desc" class="field-label-mini">Descrição do problema (obrigatório)</label>
              <textarea
                id="new_issue_desc"
                name="description"
                bind:value={newIssueDescription}
                rows="3"
                placeholder="Descreva detalhadamente o que precisa ser corrigido..."
                class="modal-textarea"
                required
              ></textarea>
            </div>
          </div>
        </div>

        <footer class="modal-footer">
          <button
            type="button"
            class="btn-modal-cancel"
            onclick={closeAddIssueModal}
            disabled={isSubmittingAddIssue}
          >
            Cancelar
          </button>

          <button
            type="submit"
            class="btn-modal-confirm-purple"
            disabled={newIssueDescription.trim().length < 2 || isSubmittingAddIssue}
          >
            {#if isSubmittingAddIssue}
              <span class="spinner-editorial-xs"></span>
              <span>Salvando...</span>
            {:else}
              <Plus size={14} />
              <span>Salvar Apontamento</span>
            {/if}
          </button>
        </footer>
      </form>
    </div>
  </div>
{/if}

<!-- Claim Stage with Deadline Modal -->
<ClaimStageModal
  isOpen={claimModalOpen}
  stageItem={claimModalStageItem}
  currentUser={team.find((m: any) => m.id === currentUserId || m.user_id === currentUserId) || { id: currentUserId }}
  onClose={() => {
    claimModalOpen = false;
    claimModalStageItem = null;
  }}
  onSuccess={() => {
    claimFeedback = null;
    selectCategory('mine');
  }}
/>

<style>
  /* ==========================================================================
     PROJECT NOX — EDITORIAL WORKSPACE UNIFIED STYLES
     Tradução (Blue), Clean/Redraw (Pink), Typeset (Amber)
     ========================================================================== */

  .editorial-workspace-root {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 100%;
    margin: 0;
    color: #e2e8f0;
    box-sizing: border-box;
  }

  /* --------------------------------------------------------------------------
     1. COMPACT EDITORIAL HEADER (70–85px Desktop, 60–80px Android)
     -------------------------------------------------------------------------- */
  .editorial-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 76px;
    padding: 16px 22px;
    background: rgba(14, 17, 29, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    backdrop-filter: blur(8px);
    gap: 16px;
    box-sizing: border-box;
  }

  .editorial-header-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .editorial-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .editorial-title {
    font-size: 23px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.02em;
    margin: 0;
    line-height: 1.2;
  }

  .stage-pill-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 6px;
    border-width: 1px;
    border-style: solid;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .stage-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .editorial-subtitle {
    font-size: 13.5px;
    color: #94a3b8;
    margin: 0;
    line-height: 1.4;
  }

  .mobile-sub {
    display: none;
  }

  .editorial-header-meta {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .header-stat-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 6px 13px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 500;
    color: #cbd5e1;
  }

  .stat-count-available {
    color: #f8fafc;
    font-weight: 600;
  }

  .stat-divider {
    color: #475569;
  }

  .stat-count-mine {
    color: #c084fc;
    font-weight: 600;
  }

  /* --------------------------------------------------------------------------
     2. WORKSPACE CONTAINER, NAV TABS & FILTERS
     -------------------------------------------------------------------------- */
  .editorial-workspace-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
  }

  .editorial-nav-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
    background: rgba(14, 17, 29, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 8px 14px;
    box-sizing: border-box;
  }

  .segmented-control {
    display: inline-flex;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 3px;
    gap: 3px;
  }

  .segment-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 13.5px;
    font-weight: 600;
    color: #94a3b8;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .segment-btn:hover {
    color: #e2e8f0;
    background: rgba(255, 255, 255, 0.05);
  }

  .segment-btn.active {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.12);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .segment-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 19px;
    height: 19px;
    padding: 0 5px;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.08);
    font-size: 11px;
    font-weight: 700;
    color: #e2e8f0;
  }

  .segment-btn.active .segment-badge {
    background: rgba(255, 255, 255, 0.2);
    color: #ffffff;
  }

  .segment-badge.urgent {
    background: rgba(239, 68, 68, 0.25);
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.4);
  }

  .segment-badge.mine {
    background: rgba(168, 85, 247, 0.2);
    color: #d8b4fe;
  }

  .urgent-dot-halo {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ef4444;
    box-shadow: 0 0 6px rgba(239, 68, 68, 0.8);
    animation: pulse-dot 1.5s infinite;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.85); }
  }

  /* Filters Toolbar */
  .editorial-filters-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .mini-search-box {
    position: relative;
    display: flex;
    align-items: center;
    width: 220px;
    transition: width 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .mini-search-box:focus-within {
    width: 260px;
  }

  .mini-search-icon-wrap {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    pointer-events: none;
    z-index: 2;
    line-height: 0;
    transition: color 0.15s ease;
  }

  .mini-search-box:focus-within .mini-search-icon-wrap {
    color: #a855f7;
  }

  .mini-search-input {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 0 32px 0 36px;
    height: 40px;
    font-size: 13px;
    color: #f1f5f9;
    width: 100%;
    outline: none;
    transition: all 0.15s ease;
    box-sizing: border-box;
  }

  .mini-search-input:focus {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(168, 85, 247, 0.4);
    box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.15);
  }

  .mini-search-input::placeholder {
    color: #64748b;
  }

  .btn-clear-search-mini {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: color 0.15s ease;
    z-index: 2;
  }

  .btn-clear-search-mini:hover {
    color: #f1f5f9;
  }

  .mini-work-select {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 0 12px;
    height: 42px;
    font-size: 13px;
    color: #f1f5f9;
    outline: none;
    cursor: pointer;
    max-width: 220px;
    box-sizing: border-box;
  }

  .mini-work-select:focus {
    border-color: rgba(168, 85, 247, 0.4);
  }

  .mini-work-select option {
    background: #0f1322;
    color: #f1f5f9;
  }

  /* --------------------------------------------------------------------------
     3. EDITORIAL CARDS 2-COLUMN GRID (DESKTOP) & 1-COLUMN (MOBILE)
     -------------------------------------------------------------------------- */
  .editorial-content-area {
    width: 100%;
  }

  .editorial-cards-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 16px;
    width: 100%;
    box-sizing: border-box;
  }

  /* Restrain single card from stretching across entire width */
  .editorial-cards-grid > :only-child:not(.is-expanded) {
    max-width: 760px;
  }

  .editorial-card.is-expanded {
    grid-column: 1 / -1;
    max-width: 860px !important;
  }

  .editorial-card {
    display: flex;
    flex-direction: column;
    background: rgba(14, 17, 29, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 15px;
    gap: 12px;
    box-sizing: border-box;
    transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
  }

  .editorial-card:hover {
    border-color: rgba(255, 255, 255, 0.16);
    background: rgba(18, 22, 38, 0.9);
  }

  .editorial-card.prereqs-blocked {
    opacity: 0.85;
    border-color: rgba(245, 158, 11, 0.2);
  }

  .editorial-card.is-rework {
    border-color: rgba(245, 158, 11, 0.35);
  }

  /* Rework Banner on Card */
  .card-rework-banner {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.28);
    border-radius: 8px;
    padding: 9px 12px;
  }

  .rework-banner-head {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .rework-banner-title {
    font-size: 12px;
    font-weight: 700;
    color: #fbbf24;
  }

  .rework-banner-text {
    font-size: 12px;
    color: #fef3c7;
    margin: 0;
    line-height: 1.4;
  }

  /* Card Top Cluster */
  .card-top-cluster {
    display: flex;
    gap: 14px;
    width: 100%;
    align-items: flex-start;
  }

  .card-cover-container {
    width: 60px;
    height: 84px;
    flex-shrink: 0;
    border-radius: 8px;
    overflow: hidden;
    background: #111422;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .card-cover-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .card-cover-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.03);
  }

  .fallback-nox-text {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--accent-color, #a855f7);
    opacity: 0.7;
  }

  .card-details-block {
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex: 1;
    min-width: 0;
  }

  .card-meta-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }

  .card-work-title {
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.01em;
    min-width: 0;
  }

  .card-priority-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 6px;
    flex-shrink: 0;
  }

  .priority-urgent {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #fca5a5;
  }

  .priority-high {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.35);
    color: #fcd34d;
  }

  .priority-normal {
    background: rgba(148, 163, 184, 0.1);
    border: 1px solid rgba(148, 163, 184, 0.2);
    color: #cbd5e1;
  }

  .urgent-pulse-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #ef4444;
    box-shadow: 0 0 5px #ef4444;
    animation: pulse-dot 1.5s infinite;
  }

  .card-chapter-identity {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .chapter-number-badge {
    font-size: 13.5px;
    font-weight: 700;
    color: #f1f5f9;
  }

  .chapter-label-text {
    font-size: 12px;
    color: #94a3b8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Upstream Inputs Indicator */
  .upstream-status-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
  }

  .status-indicator-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    font-weight: 500;
    padding: 2px 7px;
    border-radius: 5px;
  }

  .status-indicator-tag.ready {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: #6ee7b7;
  }

  .status-indicator-tag.waiting {
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.25);
    color: #fcd34d;
  }

  /* Status Badges on My Chapters */
  .card-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 6px;
    flex-shrink: 0;
  }

  .card-status-badge.rework {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.35);
    color: #fbbf24;
  }

  .card-status-badge.ready {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.35);
    color: #6ee7b7;
  }

  .card-status-badge.in-progress {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: var(--accent-color, #c084fc);
  }

  /* Card Action Row & Buttons */
  .card-action-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    margin-top: 2px;
  }

  .claim-form-full {
    flex: 1;
    min-width: 0;
  }

  .btn-editorial-claim {
    width: 100%;
    height: 42px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.25);
  }

  .btn-editorial-claim:hover:not(:disabled) {
    background: linear-gradient(135deg, #8b5cf6 0%, #4f46e5 100%);
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.35);
    transform: translateY(-1px);
  }

  .btn-editorial-claim.btn-disabled,
  .btn-editorial-claim:disabled {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.08);
    color: #64748b;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }

  .btn-icon-zap {
    color: #fbbf24;
  }

  .my-card-actions-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 6px;
  }

  .secondary-actions-row {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  /* State A: Complete form takes primary focus */
  .complete-form-primary {
    display: inline-flex;
  }

  .btn-action-complete-prominent {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding: 0 16px;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 600;
    background: linear-gradient(135deg, #059669 0%, #10b981 100%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #ffffff;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
  }

  .btn-action-complete-prominent:hover:not(:disabled) {
    background: linear-gradient(135deg, #047857 0%, #059669 100%);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
  }

  .btn-action-complete-prominent:disabled {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.08);
    color: #64748b;
    cursor: not-allowed;
    box-shadow: none;
  }

  /* State B: Open work takes primary purple focus */
  .btn-action-open-work {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding: 0 14px;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 600;
    background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #ffffff;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.25);
  }

  .btn-action-open-work:hover {
    background: linear-gradient(135deg, #8b5cf6 0%, #4f46e5 100%);
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.35);
  }

  .btn-action-open-work.active {
    background: rgba(124, 58, 237, 0.25);
    border-color: rgba(124, 58, 237, 0.5);
    color: #d8b4fe;
    box-shadow: none;
  }

  .btn-action-secondary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding: 0 12px;
    border-radius: 7px;
    font-size: 12.5px;
    font-weight: 500;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-action-secondary:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .btn-action-secondary.active {
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
  }

  .btn-action-view-details {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding: 0 12px;
    border-radius: 7px;
    font-size: 12.5px;
    font-weight: 500;
    background: rgba(139, 92, 246, 0.08);
    border: 1px solid rgba(139, 92, 246, 0.25);
    color: #c4b5fd;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    text-decoration: none;
  }

  .btn-action-view-details:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.45);
    color: #ffffff;
  }

  .btn-action-view-details.available-details {
    height: 42px;
  }

  /* --------------------------------------------------------------------------
     4. INTEGRATED EXPANDED WORKSPACE ACCORDION
     -------------------------------------------------------------------------- */
  .editorial-expanded-workspace {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    width: 100%;
    animation: fade-in-panel 0.15s ease;
  }

  @keyframes fade-in-panel {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .workspace-subpanel {
    display: flex;
    flex-direction: column;
    background: rgba(10, 13, 24, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 9px;
    overflow: hidden;
  }

  .subpanel-header-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.02);
    border: none;
    width: 100%;
    cursor: pointer;
    color: #f1f5f9;
    transition: background-color 0.15s ease;
  }

  .subpanel-header-toggle:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .subpanel-title-lockup {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .subpanel-title {
    font-size: 13px;
    font-weight: 600;
    color: #ffffff;
  }

  .subpanel-count-tag {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.06);
    color: #cbd5e1;
  }

  .subpanel-count-tag.mine {
    background: rgba(168, 85, 247, 0.15);
    color: #d8b4fe;
  }

  .subpanel-chevron {
    color: #94a3b8;
  }

  .subpanel-body {
    padding: 12px 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Typeset Dual Grid */
  .typeset-dual-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    width: 100%;
  }

  .dual-input-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border-radius: 8px;
    background: rgba(15, 19, 32, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.06);
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
  }

  .dual-input-card.clean-box {
    border-color: rgba(236, 72, 153, 0.2);
  }

  .dual-input-card.trad-box {
    border-color: rgba(59, 130, 246, 0.2);
  }

  .dual-box-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    box-sizing: border-box;
    min-width: 0;
  }

  .dual-box-title-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1;
  }

  .dual-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .dual-dot.pink { background: #ec4899; }
  .dual-dot.blue { background: #3b82f6; }

  .dual-box-title {
    font-size: 12px;
    font-weight: 600;
    color: #e2e8f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .dual-badge {
    font-size: 10.5px;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 600;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .dual-badge.pink {
    background: rgba(236, 72, 153, 0.15);
    color: #f472b6;
  }

  .dual-badge.blue {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
  }

  .files-pill-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    box-sizing: border-box;
  }

  .file-download-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
  }

  .file-main-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  .file-item-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .file-item-name {
    font-size: 12px;
    color: #f1f5f9;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: block;
    max-width: 100%;
  }

  .file-item-sub {
    font-size: 10.5px;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .btn-file-download {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 9px;
    border-radius: 5px;
    font-size: 11.5px;
    font-weight: 600;
    text-decoration: none;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }

  .btn-file-download.pink {
    background: rgba(236, 72, 153, 0.15);
    border: 1px solid rgba(236, 72, 153, 0.3);
    color: #f472b6;
  }

  .btn-file-download.blue {
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #60a5fa;
  }

  .btn-file-download.purple {
    background: rgba(168, 85, 247, 0.15);
    border: 1px solid rgba(168, 85, 247, 0.3);
    color: #d8b4fe;
  }

  .btn-file-download:hover {
    filter: brightness(1.15);
  }

  .dep-waiting-box {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    font-size: 11.5px;
    color: #94a3b8;
  }

  .upload-guidance-bar {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 4px;
  }

  .upload-format-label {
    font-size: 12px;
    font-weight: 600;
    color: #cbd5e1;
  }

  .upload-step-hint {
    font-size: 11.5px;
    color: #94a3b8;
  }

  .upload-component-embed {
    width: 100%;
  }

  .workspace-actions-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 8px;
  }

  .btn-release-queue {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 500;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-release-queue:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.25);
    color: #fca5a5;
  }

  .btn-concluir-workspace {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 600;
    background: linear-gradient(135deg, #059669 0%, #10b981 100%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #ffffff;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
  }

  .btn-concluir-workspace:hover:not(:disabled) {
    background: linear-gradient(135deg, #047857 0%, #059669 100%);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
  }

  .btn-concluir-workspace:disabled {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.08);
    color: #64748b;
    cursor: not-allowed;
    box-shadow: none;
  }

  /* --------------------------------------------------------------------------
     5. CONTEXTUAL COMPACT EMPTY STATES (140–159px)
     -------------------------------------------------------------------------- */
  .editorial-empty-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 24px 20px;
    background: rgba(14, 17, 29, 0.6);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    min-height: 140px;
    max-height: 160px;
    gap: 8px;
    box-sizing: border-box;
    width: 100%;
    max-width: 680px;
  }

  .empty-icon-halo {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.04);
    box-shadow: 0 0 16px var(--halo-glow, rgba(168, 85, 247, 0.2));
  }

  .empty-icon-halo.neutral {
    box-shadow: 0 0 12px rgba(148, 163, 184, 0.15);
  }

  .empty-text-group {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .empty-card-heading {
    font-size: 14.5px;
    font-weight: 700;
    color: #f1f5f9;
  }

  .empty-card-subtext {
    font-size: 12.5px;
    color: #94a3b8;
    margin: 0;
    max-width: 380px;
  }

  .btn-empty-switch {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
    cursor: pointer;
    margin-top: 4px;
    transition: all 0.15s ease;
  }

  .btn-empty-switch.accent {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--accent-color, #c084fc);
    color: #ffffff;
  }

  .btn-empty-switch:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  /* --------------------------------------------------------------------------
     6. SIDE-BY-SIDE DESKTOP WORKSPACE (WHEN "AMBOS" SELECTED)
     -------------------------------------------------------------------------- */
  .editorial-side-by-side {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    width: 100%;
    align-items: start;
  }

  .editorial-side-by-side .editorial-cards-grid {
    grid-template-columns: 1fr;
  }

  .editorial-side-by-side .editorial-cards-grid > :only-child {
    max-width: 100%;
  }

  .side-pool-column {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  .side-column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 4px;
  }

  .side-column-title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .side-column-heading {
    font-size: 14px;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0;
  }

  /* Alert Banners */
  .editorial-alert-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 12.5px;
    margin-bottom: 8px;
  }

  .editorial-alert-banner.error {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .editorial-alert-banner.success {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #6ee7b7;
  }

  .btn-close-alert {
    margin-left: auto;
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 2px;
  }

  /* Spinner */
  .spinner-editorial-xs {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.25);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ==========================================================================
     MOBILE RESPONSIVENESS & BREAKPOINTS (ANDROID FIRST)
     ========================================================================== */
  @media (max-width: 1024px) {
    .editorial-cards-grid {
      grid-template-columns: 1fr;
    }

    .editorial-side-by-side {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .editorial-workspace-root {
      gap: 12px;
      padding-bottom: calc(110px + env(safe-area-inset-bottom, 24px)); /* Clearance for fixed mobile bottom navigation */
    }

    .editorial-header {
      padding: 11px 14px;
      gap: 8px;
      min-height: auto;
    }

    .editorial-title {
      font-size: 18px;
    }

    .editorial-subtitle.desktop-sub {
      display: none;
    }

    .editorial-subtitle.mobile-sub {
      display: block;
      font-size: 12px;
    }

    .stage-pill-badge {
      font-size: 10px;
      padding: 2px 7px;
    }

    .editorial-header-meta {
      display: none; /* Hide quick stats on mobile to keep header ultra-compact */
    }

    .editorial-nav-bar {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
      padding: 8px 10px;
    }

    .segmented-control {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      box-sizing: border-box;
    }

    .segment-btn {
      justify-content: center;
      padding: 9px 8px;
      font-size: 12.5px;
      min-height: 44px; /* Touch target */
    }

    .desktop-only {
      display: none !important;
    }

    .editorial-filters-toolbar {
      width: 100%;
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
    }

    .mini-search-box {
      width: 100% !important;
    }

    .mini-search-box:focus-within {
      width: 100% !important;
    }

    .mini-search-input {
      width: 100%;
      box-sizing: border-box;
      min-height: 44px;
      font-size: 14px;
    }

    .mini-search-input:focus {
      width: 100%;
    }

    .mini-work-select {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      min-height: 44px;
    }

    .editorial-cards-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .editorial-card {
      padding: 13px;
      gap: 10px;
      width: 100%;
      max-width: 100% !important;
      box-sizing: border-box;
      min-width: 0;
    }

    .editorial-card.is-expanded {
      max-width: 100% !important;
      width: 100%;
      box-sizing: border-box;
      min-width: 0;
    }

    .card-cover-container {
      width: 52px;
      height: 70px;
    }

    .card-work-title {
      font-size: 15px;
      white-space: normal;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      line-height: 1.3;
    }

    .typeset-dual-grid {
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .my-card-actions-row {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .primary-row-btn {
      width: 100%;
      justify-content: center;
      min-height: 44px;
    }

    .complete-form-primary {
      width: 100%;
    }

    .btn-action-complete-prominent {
      width: 100%;
      justify-content: center;
      min-height: 44px;
    }

    .secondary-actions-row {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .secondary-actions-row.is-single {
      grid-template-columns: 1fr;
    }

    .secondary-actions-row .btn-action-open-work,
    .secondary-actions-row .btn-action-secondary,
    .secondary-actions-row .btn-action-view-details {
      width: 100%;
      justify-content: center;
      min-height: 44px;
    }

    .btn-editorial-claim {
      min-height: 44px; /* Touch friendly on mobile */
    }

    .workspace-actions-footer {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }

    .footer-actions-left,
    .footer-actions-right {
      width: 100%;
    }

    .btn-release-queue,
    .btn-concluir-workspace {
      width: 100%;
      justify-content: center;
      min-height: 44px;
    }
  }

  @media (max-width: 480px) {
    .editorial-header {
      padding: 10px 12px;
    }

    .editorial-title {
      font-size: 17px;
    }

    .editorial-card {
      padding: 11px;
    }

    .card-cover-container {
      width: 50px;
      height: 68px;
    }
  }

  /* ==========================================================================
     REVISOR (QC) SPECIFIC STYLES & INTERACTIVE MODALS
     ========================================================================== */

  .btn-action-secondary.qc-reader-btn {
    border-color: rgba(168, 85, 247, 0.35);
    color: #c084fc;
    background: rgba(168, 85, 247, 0.08);
  }

  .btn-action-secondary.qc-reader-btn:hover {
    background: rgba(168, 85, 247, 0.16);
    border-color: rgba(168, 85, 247, 0.5);
  }

  .card-status-badge.qc-has-issues,
  .card-status-badge.qc-waiting-material {
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #fbbf24;
  }

  .qc-materials-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .qc-typeset-primary-card {
    background: rgba(245, 158, 11, 0.04);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .qc-typeset-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .qc-typeset-title {
    font-size: 13px;
    font-weight: 700;
    color: #fef3c7;
    flex: 1;
  }

  .file-download-item.qc-typeset-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
  }

  .qc-file-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .btn-file-download.amber {
    background: rgba(245, 158, 11, 0.14);
    border: 1px solid rgba(245, 158, 11, 0.35);
    color: #fbbf24;
  }

  .btn-file-download.amber:hover {
    background: rgba(245, 158, 11, 0.22);
  }

  .btn-action-leitor-inline {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(168, 85, 247, 0.14);
    border: 1px solid rgba(168, 85, 247, 0.35);
    color: #c084fc;
    padding: 6px 11px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-file-download.zinc {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #a1a1aa;
  }

  .btn-file-download.zinc:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.22);
    color: #f4f4f5;
  }

  .btn-action-leitor-inline.disabled {
    opacity: 0.45;
    cursor: not-allowed;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #71717a;
    pointer-events: none;
  }

  .file-title-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .file-status-badge {
    display: inline-flex;
    align-items: center;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    white-space: nowrap;
    line-height: 1.4;
    box-sizing: border-box;
  }

  .file-status-badge.invalid {
    background: rgba(239, 68, 68, 0.12);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .file-status-badge.incomplete {
    background: rgba(245, 158, 11, 0.12);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .qc-typeset-incomplete-banner {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 8px;
    padding: 9px 12px;
    margin-top: 10px;
    font-size: 12px;
    line-height: 1.45;
    color: #fbbf24;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
  }

  .incomplete-banner-text {
    flex: 1;
    min-width: 0;
  }

  .qc-review-panel-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .qc-review-header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 10px 14px;
  }

  .qc-review-status-text {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #cbd5e1;
    font-weight: 500;
  }

  .qc-review-actions-quick {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .btn-qc-quick-read {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(168, 85, 247, 0.12);
    border: 1px solid rgba(168, 85, 247, 0.3);
    color: #c084fc;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-qc-quick-read:hover {
    background: rgba(168, 85, 247, 0.22);
    border-color: rgba(168, 85, 247, 0.5);
  }

  .btn-qc-add-issue {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #e2e8f0;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-qc-add-issue:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .qc-issues-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .qc-issue-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .qc-issue-card.is-resolved {
    opacity: 0.6;
    border-color: rgba(16, 185, 129, 0.2);
  }

  .qc-issue-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .qc-issue-badges {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .qc-page-badge {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 11px;
    font-weight: 700;
    color: #f1f5f9;
  }

  .qc-type-badge {
    border-radius: 4px;
    padding: 2px 7px;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .qc-type-badge.translation {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .qc-type-badge.clean,
  .qc-type-badge.redraw {
    background: rgba(236, 72, 153, 0.15);
    color: #f472b6;
    border: 1px solid rgba(236, 72, 153, 0.3);
  }

  .qc-type-badge.type {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .qc-type-badge.other {
    background: rgba(148, 163, 184, 0.15);
    color: #94a3b8;
    border: 1px solid rgba(148, 163, 184, 0.3);
  }

  .qc-status-tag {
    font-size: 10.5px;
    font-weight: 600;
    border-radius: 4px;
    padding: 1px 6px;
  }

  .qc-status-tag.open {
    color: #fbbf24;
    background: rgba(245, 158, 11, 0.1);
  }

  .qc-status-tag.resolved {
    color: #34d399;
    background: rgba(16, 185, 129, 0.1);
  }

  .btn-delete-issue {
    background: transparent;
    border: none;
    color: #64748b;
    padding: 4px;
    cursor: pointer;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .btn-delete-issue:hover {
    color: #f87171;
    background: rgba(239, 68, 68, 0.1);
  }

  .qc-issue-description {
    font-size: 13px;
    color: #e2e8f0;
    margin: 0;
    line-height: 1.45;
  }

  .qc-empty-issues-box {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    font-size: 13px;
    color: #94a3b8;
  }

  .btn-qc-rework-trigger {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.35);
    color: #fbbf24;
    border-radius: 8px;
    padding: 8px 15px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-qc-rework-trigger:hover {
    background: rgba(245, 158, 11, 0.22);
    border-color: rgba(245, 158, 11, 0.55);
  }

  .btn-qc-approve-trigger {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: linear-gradient(135deg, #059669 0%, #10b981 100%);
    border: none;
    color: #ffffff;
    border-radius: 8px;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 10px rgba(16, 185, 129, 0.25);
  }

  .btn-qc-approve-trigger:hover:not(:disabled) {
    background: linear-gradient(135deg, #047857 0%, #059669 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
  }

  .btn-qc-approve-trigger.btn-disabled,
  .btn-qc-approve-trigger:disabled {
    opacity: 0.45 !important;
    cursor: not-allowed !important;
    background: rgba(255, 255, 255, 0.08) !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    color: #71717a !important;
    box-shadow: none !important;
    transform: none !important;
  }

  /* --------------------------------------------------------------------------
     MODALS: REWORK, APPROVE, ADD ISSUE
     -------------------------------------------------------------------------- */
  .editorial-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(4, 7, 16, 0.82);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    box-sizing: border-box;
  }

  .editorial-modal-dialog {
    background: #0f1322;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 14px;
    box-shadow: 0 24px 56px rgba(0, 0, 0, 0.7);
    width: 100%;
    max-width: 680px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
  }

  .modal-header-title-lockup {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .modal-icon-bubble {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .modal-icon-bubble.amber {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .modal-icon-bubble.green {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .modal-icon-bubble.purple {
    background: rgba(168, 85, 247, 0.15);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.3);
  }

  .modal-title {
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .modal-subtitle {
    font-size: 12.5px;
    color: #94a3b8;
    margin: 2px 0 0;
  }

  .btn-modal-close {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .btn-modal-close:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
  }

  .modal-body-scroll {
    padding: 18px 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-sizing: border-box;
  }

  .rework-selection-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-label {
    font-size: 13px;
    font-weight: 600;
    color: #e2e8f0;
  }

  .rework-stage-checkboxes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .stage-checkbox-card {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 11px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 9px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .stage-checkbox-card:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.18);
  }

  .stage-checkbox-card.is-checked {
    background: rgba(168, 85, 247, 0.08);
    border-color: rgba(168, 85, 247, 0.45);
  }

  .custom-chk-box {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: bold;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .custom-chk-box.blue {
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.4);
    color: #60a5fa;
  }

  .custom-chk-box.pink {
    background: rgba(236, 72, 153, 0.15);
    border: 1px solid rgba(236, 72, 153, 0.4);
    color: #f472b6;
  }

  .custom-chk-box.amber {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.4);
    color: #fbbf24;
  }

  .chk-label-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .chk-stage-name {
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
  }

  .chk-stage-desc {
    font-size: 11px;
    color: #94a3b8;
    line-height: 1.35;
  }

  .stage-issues-block {
    border-radius: 10px;
    padding: 13px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .stage-issues-block.blue-theme {
    background: rgba(59, 130, 246, 0.04);
    border: 1px solid rgba(59, 130, 246, 0.25);
  }

  .stage-issues-block.pink-theme {
    background: rgba(236, 72, 153, 0.04);
    border: 1px solid rgba(236, 72, 153, 0.25);
  }

  .stage-issues-block.amber-theme {
    background: rgba(245, 158, 11, 0.04);
    border: 1px solid rgba(245, 158, 11, 0.25);
  }

  .stage-issues-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .stage-dot-badge {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .stage-dot-badge.blue { background: #3b82f6; }
  .stage-dot-badge.pink { background: #ec4899; }
  .stage-dot-badge.amber { background: #f59e0b; }

  .stage-block-title {
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
  }

  .stage-flow-hint {
    font-size: 11.5px;
    color: #94a3b8;
    margin-left: auto;
  }

  .issue-rows-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .issue-input-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  .issue-field-page {
    width: 70px;
    flex-shrink: 0;
  }

  .issue-field-region {
    width: 140px;
    flex-shrink: 0;
  }

  .issue-field-desc {
    flex: 1;
    min-width: 0;
  }

  .field-label-mini {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
    margin-bottom: 3px;
  }

  .modal-input-compact {
    width: 100%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    color: #ffffff;
    padding: 7px 10px;
    font-size: 12.5px;
    box-sizing: border-box;
    transition: all 0.15s ease;
  }

  .modal-input-compact:focus {
    outline: none;
    border-color: #a855f7;
    background: rgba(255, 255, 255, 0.08);
  }

  .modal-input-compact.select {
    cursor: pointer;
    background-color: #1a1e30;
  }

  .modal-textarea {
    width: 100%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    color: #ffffff;
    padding: 8px 10px;
    font-size: 12.5px;
    font-family: inherit;
    resize: vertical;
    box-sizing: border-box;
  }

  .modal-textarea:focus {
    outline: none;
    border-color: #a855f7;
    background: rgba(255, 255, 255, 0.08);
  }

  .btn-remove-row {
    background: transparent;
    border: none;
    color: #64748b;
    padding: 7px;
    cursor: pointer;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .btn-remove-row:hover {
    color: #f87171;
    background: rgba(239, 68, 68, 0.1);
  }

  .btn-add-issue-row {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: transparent;
    border: 1px dashed rgba(255, 255, 255, 0.18);
    color: #cbd5e1;
    padding: 5px 11px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-add-issue-row:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.3);
    color: #ffffff;
  }

  .rework-summary-box {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 8px;
    padding: 9px 12px;
    font-size: 12.5px;
    color: #6ee7b7;
  }

  .approve-checklist {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 11px 13px;
  }

  .checklist-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 500;
  }

  .checklist-item.is-ok {
    color: #e2e8f0;
  }

  .checklist-item.is-fail {
    color: #fca5a5;
  }

  .approve-info-callout {
    background: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.25);
    border-radius: 8px;
    padding: 11px 13px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12.5px;
    color: #a5f3fc;
    line-height: 1.4;
  }

  .callout-lead {
    font-weight: 700;
    color: #38bdf8;
  }

  .callout-secondary {
    color: #94a3b8;
    font-size: 11.5px;
  }

  .add-issue-fields-grid {
    display: grid;
    grid-template-columns: 100px 1fr;
    gap: 12px;
  }

  .add-issue-fields-grid .full-width {
    grid-column: span 2;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
  }

  .btn-modal-cancel {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #e2e8f0;
    padding: 7px 14px;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-modal-cancel:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .btn-modal-confirm-rework {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);
    border: none;
    color: #ffffff;
    padding: 7px 16px;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-modal-confirm-rework:hover:not(:disabled) {
    background: linear-gradient(135deg, #b45309 0%, #d97706 100%);
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
  }

  .btn-modal-confirm-rework:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn-modal-confirm-approve {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: linear-gradient(135deg, #059669 0%, #10b981 100%);
    border: none;
    color: #ffffff;
    padding: 7px 16px;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
  }

  .btn-modal-confirm-approve:hover:not(:disabled) {
    background: linear-gradient(135deg, #047857 0%, #059669 100%);
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
  }

  .btn-modal-confirm-approve:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn-modal-confirm-purple {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
    border: none;
    color: #ffffff;
    padding: 7px 16px;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-modal-confirm-purple:hover:not(:disabled) {
    background: linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%);
    box-shadow: 0 4px 14px rgba(168, 85, 247, 0.35);
  }

  .btn-modal-confirm-purple:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    /* Prevent QC and all editorial materials horizontal overflow */
    .dual-input-card {
      width: 100%;
      box-sizing: border-box;
      min-width: 0;
    }

    .dual-box-header {
      flex-wrap: wrap;
      gap: 6px;
    }

    .file-download-item {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
      padding: 8px 10px;
      width: 100%;
      box-sizing: border-box;
      min-width: 0;
    }

    .file-main-row {
      width: 100%;
      min-width: 0;
    }

    .file-download-item .file-item-info {
      width: 100%;
      min-width: 0;
    }

    .file-download-item .file-item-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
      display: block;
    }

    .file-download-item .btn-file-download {
      width: 100%;
      justify-content: center;
      min-height: 38px;
      box-sizing: border-box;
      text-align: center;
    }

    .typeset-dual-grid {
      grid-template-columns: 1fr;
      width: 100%;
      box-sizing: border-box;
      gap: 8px;
    }

    .file-download-item.qc-typeset-item {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
      width: 100%;
      box-sizing: border-box;
      min-width: 0;
    }

    .file-download-item.qc-typeset-item .file-item-info {
      width: 100%;
      min-width: 0;
    }

    .file-download-item.qc-typeset-item .file-item-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
      display: block;
    }

    .qc-file-actions {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .btn-file-download.amber,
    .btn-action-leitor-inline {
      width: 100%;
      justify-content: center;
      min-height: 40px;
      box-sizing: border-box;
    }

    /* QC review header and quick actions */
    .qc-review-header-bar {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
      padding: 10px 12px;
      width: 100%;
      box-sizing: border-box;
      min-width: 0;
    }

    .qc-review-status-text {
      width: 100%;
      min-width: 0;
      font-size: 12.5px;
    }

    .qc-review-actions-quick {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      flex-shrink: 1;
    }

    .btn-qc-quick-read,
    .btn-qc-add-issue {
      width: 100%;
      justify-content: center;
      min-height: 40px;
      box-sizing: border-box;
      font-size: 12px;
    }

    /* QC expanded footer actions */
    .footer-actions-right {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
    }

    .btn-qc-rework-trigger,
    .btn-qc-approve-trigger {
      width: 100%;
      justify-content: center;
      min-height: 44px;
      box-sizing: border-box;
    }

    .qc-typeset-primary-card {
      padding: 10px 12px;
      width: 100%;
      box-sizing: border-box;
      min-width: 0;
    }

    .qc-typeset-card-header {
      flex-wrap: wrap;
      gap: 6px;
    }

    .qc-typeset-title {
      font-size: 12px;
      min-width: 0;
    }

    .qc-materials-container {
      width: 100%;
      box-sizing: border-box;
      min-width: 0;
    }

    .workspace-subpanel {
      width: 100%;
      box-sizing: border-box;
      min-width: 0;
    }

    .subpanel-header-toggle,
    .subpanel-body {
      width: 100%;
      box-sizing: border-box;
      min-width: 0;
    }

    .rework-stage-checkboxes {
      grid-template-columns: 1fr;
    }

    .issue-input-row {
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
    }

    .issue-field-page,
    .issue-field-region,
    .issue-field-desc {
      width: 100%;
    }

    .add-issue-fields-grid {
      grid-template-columns: 1fr;
    }

    .add-issue-fields-grid .full-width {
      grid-column: span 1;
    }

    .modal-footer {
      flex-direction: column;
      align-items: stretch;
    }

    .btn-modal-cancel,
    .btn-modal-confirm-rework,
    .btn-modal-confirm-approve,
    .btn-modal-confirm-purple {
      width: 100%;
      justify-content: center;
    }
  }
</style>
