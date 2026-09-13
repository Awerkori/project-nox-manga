<script lang="ts">
  import {
    ShieldCheck,
    Sparkles,
    BookOpen,
    Layers,
    Eye,
    Users,
    Globe,
    MessageSquare,
    ArrowRight,
    CheckCircle2,
    Settings,
    Clock,
    AlertCircle,
    Copy,
    Check,
    Plus,
    X,
    UserMinus,
    Crown,
    AlertTriangle,
    Send,
    Briefcase,
    FileText,
    Activity,
    Tag,
    Filter,
    ExternalLink,
    Edit2,
    PlayCircle,
    PauseCircle,
    UserCheck,
    Calendar,
    Pin,
    Trash2,
    Shield,
    User,
    Lock,
    Sliders
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';
  import { relativeTime, slugify } from '$lib/types';
  import UserAvatar from '$lib/components/UserAvatar.svelte';
  import {
    SCAN_ADMIN_FUNCTIONS,
    CANONICAL_EDITORIAL_ROLES,
    CANONICAL_PIPELINE_STAGES,
    canManageMembers,
    canPromoteToManager,
    canDemoteManager,
    canRemoveMember,
    normalizePositionName
  } from '$lib/scan-roles';
  import PipelineTab from './components/PipelineTab.svelte';
  import PipelineStageView from './components/PipelineStageView.svelte';
  import TasksTab from './components/TasksTab.svelte';
  import WikiTab from './components/WikiTab.svelte';
  import GlossaryTab from './components/GlossaryTab.svelte';
  import ReferencesTab from './components/ReferencesTab.svelte';
  import SettingsTab from './components/SettingsTab.svelte';
  import AnalyticsTab from './components/AnalyticsTab.svelte';
  import CalendarTab from './components/CalendarTab.svelte';
  import OnboardingTab from './components/OnboardingTab.svelte';
  import ChatTab from './components/ChatTab.svelte';
  import InboxTab from './components/InboxTab.svelte';
  import QCTab from './components/QCTab.svelte';
  import AcademiaTab from './components/AcademiaTab.svelte';
  import WorkloadTab from './components/WorkloadTab.svelte';
  import ChapterWorkspaceModal from './components/ChapterWorkspaceModal.svelte';
  import WorkspaceCommandPalette from './components/WorkspaceCommandPalette.svelte';
  import ScanSidebar from './components/ScanSidebar.svelte';
  import ScanHome from './components/ScanHome.svelte';
  import MuralTab from './components/MuralTab.svelte';
  import ChapterWorkspaceView from './components/ChapterWorkspaceView.svelte';
  import PipelineConfigTab from './components/PipelineConfigTab.svelte';
  import { page } from '$app/state';
  import { goto, invalidateAll } from '$app/navigation';
  import { getSupabaseBrowserClient } from '$lib/supabase';
  import {
    BookA,
    Link2,
    CheckSquare,
    BarChart3,
    Inbox,
    Hash,
    GraduationCap,
    Menu,
    Search
  } from '@lucide/svelte';

  let { data, form } = $props();

  let works = $derived(data.works || []);
  let chapters = $derived(data.chapters || []);
  let team = $derived(data.team || []);
  let positions = $derived(data.positions || []);
  let openings = $derived(data.openings || []);
  let applications = $derived(data.applications || []);
  let activity = $derived(data.activity || []);

  type DashTab =
    | 'works'
    | 'inbox'
    | 'chat'
    | 'pipeline'
    | 'tasks'
    | 'qc'
    | 'calendar'
    | 'team'
    | 'workload'
    | 'openings'
    | 'applications'
    | 'onboarding'
    | 'positions'
    | 'academia'
    | 'glossary'
    | 'references'
    | 'wiki'
    | 'staff_notes'
    | 'analytics'
    | 'activity'
    | 'settings';

  function normalizeTab(t: string | null): string {
    if (!t) return 'home';
    if (t === 'tarefas' || t === 'tasks') return 'minha_fila';
    if (t === 'capitulos' || t === 'works') return 'obras';
    return t;
  }

  let currentWorkspaceTab = $state<string>(normalizeTab(page.url.searchParams.get('tab')));
  let currentPipelineStage = $state<string>(page.url.searchParams.get('stage') || 'clean_redraw');
  let sidebarMobileOpen = $state(false);

  // Global Realtime synchronization across sessions
  let realtimeChannel: any = null;
  let invalidateTimer: any = null;

  function debouncedInvalidate() {
    if (invalidateTimer) clearTimeout(invalidateTimer);
    invalidateTimer = setTimeout(async () => {
      await invalidateAll();
    }, 300);
  }

  $effect(() => {
    const scanId = data.currentScan?.id;
    if (!scanId || typeof window === 'undefined') return;

    const client = getSupabaseBrowserClient();
    if (!client) return;

    if (realtimeChannel) {
      client.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }

    realtimeChannel = client
      .channel(`scan_global_sync:${scanId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scan_chapter_stages',
          filter: `scan_id=eq.${scanId}`
        },
        debouncedInvalidate
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scan_production_chapters',
          filter: `scan_id=eq.${scanId}`
        },
        debouncedInvalidate
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scan_recruitment_openings',
          filter: `scan_id=eq.${scanId}`
        },
        debouncedInvalidate
      )
      .subscribe();

    return () => {
      if (invalidateTimer) clearTimeout(invalidateTimer);
      if (realtimeChannel) {
        client.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }
    };
  });

  $effect(() => {
    const tabParam = normalizeTab(page.url.searchParams.get('tab'));
    if (tabParam && tabParam !== currentWorkspaceTab) {
      currentWorkspaceTab = tabParam;
    }
    const stageParam = page.url.searchParams.get('stage');
    if (stageParam && stageParam !== currentPipelineStage) {
      currentPipelineStage = stageParam;
    }
  });

  function handleSelectTab(tab: string, stage?: string) {
    tab = normalizeTab(tab);
    currentWorkspaceTab = tab;
    activeWorkspaceChapter = null;
    if (stage) {
      currentPipelineStage = stage;
    }
    if (typeof window !== 'undefined') {
      const url = new URL(page.url);
      url.searchParams.set('tab', tab);
      if (tab === 'pipeline') {
        url.searchParams.set('stage', currentPipelineStage);
      } else {
        url.searchParams.delete('stage');
      }
      goto(url.toString(), { replaceState: true, keepFocus: true, noScroll: true });
    }
  }

  let activeCategory = $state<'geral' | 'comunicacao' | 'producao' | 'equipe' | 'recursos' | 'gestao'>('geral');
  let activeDashTab = $state<DashTab>('works');
  let showCommandPalette = $state(false);
  let activeWorkspaceChapter = $state<any>(null);

  function handleOpenChapter(ch: any) {
    if (!ch) return;
    if (typeof ch === 'string') {
      const all = [...(data.productionChapters || []), ...(chapters || [])];
      const found = all.find((c: any) => c.id === ch || c.chapters?.id === ch || c.target_chapter_id === ch);
      activeWorkspaceChapter = found ? (found.chapters || found) : { id: ch, chapter_number: 1, chapter_title: 'Capítulo' };
    } else {
      activeWorkspaceChapter = ch.chapters || ch;
    }
  }

  function setCategory(cat: 'geral' | 'comunicacao' | 'producao' | 'equipe' | 'recursos' | 'gestao') {
    activeCategory = cat;
    if (cat === 'geral') activeDashTab = 'works';
    else if (cat === 'comunicacao') activeDashTab = 'chat';
    else if (cat === 'producao') activeDashTab = 'pipeline';
    else if (cat === 'equipe') activeDashTab = 'team';
    else if (cat === 'recursos') activeDashTab = 'academia';
    else if (cat === 'gestao') activeDashTab = 'settings';
  }

  let staffNotes = $derived(data.staffNotes || []);
  let newStaffNoteBody = $state('');
  let newStaffNotePinned = $state(false);
  let isPostingStaffNote = $state(false);

  // Application filter
  let appFilter = $state<'ALL' | 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'>('ALL');
  let filteredApplications = $derived(
    appFilter === 'ALL'
      ? applications
      : applications.filter((a: any) => a.status === appFilter)
  );
  let pendingAppsCount = $derived(
    applications.filter((a: any) => ['PENDING', 'UNDER_REVIEW'].includes(a.status)).length
  );

  let saving = $state(false);
  let showSuccess = $state(false);

  // Non-member request form state
  let reqScanName = $state('');
  let reqScanSlug = $state('');
  let reqSlugCustomized = $state(false);
  let reqSubmitting = $state(false);

  function handleReqNameChange(val: string) {
    reqScanName = val;
    if (!reqSlugCustomized) {
      reqScanSlug = slugify(val);
    }
  }

  // Active member modals state
  let showInviteModal = $state(false);
  let inviteRole = $state('MEMBER');
  let inviteHours = $state(24);
  let inviteSubmitting = $state(false);
  let copiedCode = $state<string | null>(null);

  let createdInvite = $derived(
    form && typeof form === 'object' && 'createdInvite' in form && form.createdInvite
      ? (form.createdInvite as { code: string; expires_at: string; role: string; id: string })
      : null
  );

  let showProjectModal = $state(false);
  let selectedWorkId = $state('');
  let projectMessage = $state('');
  let projectSubmitting = $state(false);

  let transferTarget = $state<any>(null);
  let transferSubmitting = $state(false);

  let removeTarget = $state<any>(null);
  let removeSubmitting = $state(false);

  // Opening modal state
  let showOpeningModal = $state(false);
  let editingOpening = $state<any>(null);
  let openingSubmitting = $state(false);
  let openingPosId = $state('');
  let openingTitle = $state('');
  let openingDesc = $state('');
  let openingReqs = $state('');
  let openingExpLevel = $state('QUALQUER');
  let openingAvail = $state('');
  let openingSlots = $state<number | null>(null);
  let openingNotes = $state('');
  let openingStatus = $state('OPEN');

  function openCreateOpeningModal() {
    editingOpening = null;
    openingPosId = positions[0]?.id || '';
    openingTitle = '';
    openingDesc = '';
    openingReqs = '';
    openingExpLevel = 'QUALQUER';
    openingAvail = '';
    openingSlots = null;
    openingNotes = '';
    openingStatus = 'OPEN';
    showOpeningModal = true;
  }

  function openEditOpeningModal(op: any) {
    editingOpening = op;
    openingPosId = op.position_id;
    openingTitle = op.title || '';
    openingDesc = op.description || '';
    openingReqs = op.requirements || '';
    openingExpLevel = op.experience_level || 'QUALQUER';
    openingAvail = op.availability || '';
    openingSlots = op.slots || null;
    openingNotes = op.notes || '';
    openingStatus = op.status || 'OPEN';
    showOpeningModal = true;
  }

  // Position modal state
  let showPositionModal = $state(false);
  let editingPosition = $state<any>(null);
  let positionSubmitting = $state(false);
  let posName = $state('');
  let posDesc = $state('');
  let posDisplayOrder = $state(0);
  let posIsActive = $state(true);

  function openCreatePositionModal() {
    editingPosition = null;
    posName = '';
    posDesc = '';
    posDisplayOrder = positions.length + 1;
    posIsActive = true;
    showPositionModal = true;
  }

  function openEditPositionModal(pos: any) {
    editingPosition = pos;
    posName = pos.name;
    posDesc = pos.description || '';
    posDisplayOrder = pos.display_order || 0;
    posIsActive = pos.is_active !== false;
    showPositionModal = true;
  }

  // Application Review modal state
  let reviewingApp = $state<any>(null);
  let reviewSubmitting = $state(false);
  let reviewAction = $state<'APPROVE' | 'REJECT' | 'UNDER_REVIEW'>('APPROVE');
  let reviewNotes = $state('');
  let reviewAddToTeam = $state(true);
  let reviewInitialRole = $state('MEMBER');

  function openReviewModal(app: any) {
    reviewingApp = app;
    reviewAction = app.status === 'PENDING' ? 'APPROVE' : (app.status as any);
    reviewNotes = app.internal_notes || '';
    reviewAddToTeam = true;
    reviewInitialRole = 'MEMBER';
  }

  function getPositionIcon(name: string): string {
    const n = normalizePositionName(name);
    if (n === 'raw_provider') return '📦';
    if (n === 'tradutor') return '🌐';
    if (n === 'clean_redraw') return '🎨';
    if (n === 'typer') return '✒️';
    if (n === 'revisor_qc') return '🔎';
    return '📝';
  }

  // Unified Member Management Modal State
  let editingMember = $state<any>(null);
  let editingRole = $state<string>('MEMBER');
  let editingPositionIds = $state<string[]>([]);
  let manageMemberSubmitting = $state(false);
  let manageMemberError = $state<string | null>(null);
  let manageMemberWarning = $state<string | null>(null);

  function openManageMemberModal(member: any) {
    editingMember = member;
    editingRole = member.role === 'ADMIN' ? 'ADMIN' : (member.role === 'OWNER' ? 'OWNER' : 'MEMBER');
    editingPositionIds = (member.positions || []).map((p: any) => p.position_id).filter(Boolean);
    manageMemberError = null;
    manageMemberWarning = null;
  }

  function togglePosition(posId: string) {
    if (editingPositionIds.includes(posId)) {
      editingPositionIds = editingPositionIds.filter(id => id !== posId);
    } else {
      editingPositionIds = [...editingPositionIds, posId];
    }
  }

  // Settings preposition state
  let settingsPreposition = $state(data.currentScan?.display_preposition || 'de');
  $effect(() => {
    if (data.currentScan?.display_preposition) {
      settingsPreposition = data.currentScan.display_preposition;
    }
  });

  function formatNumber(n: number = 0) {
    return new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short' }).format(n);
  }

  const ROLE_LABELS: Record<string, string> = {
    OWNER: 'Dono',
    ADMIN: 'Admin da Scan',
    UPLOADER: 'Uploader',
    MEMBER: 'Staff'
  };

  function copyInviteLink(code: string) {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://noxscans.com';
    navigator.clipboard.writeText(`${origin}/convite/${code}`);
    copiedCode = code;
    setTimeout(() => {
      if (copiedCode === code) copiedCode = null;
    }, 3000);
  }

  $effect(() => {
    if (form?.success) {
      showSuccess = true;
      const t = setTimeout(() => {
        showSuccess = false;
      }, 4000);
      return () => clearTimeout(t);
    }
  });
</script>

<svelte:head>
  <title>Painel de Scan Parceira | Project Nox</title>
</svelte:head>

{#if !data.authenticated || !data.isMember}
  <div class="scan-dashboard-page">
    <div class="dashboard-container">
      {#if data.incomingTransfer}
        <div class="transfer-alert-card">
          <div class="transfer-alert-left">
            <div class="transfer-icon-ring">
              <Crown size={24} />
            </div>
            <div class="transfer-alert-text">
              <h3>Proposta de Liderança Recebida</h3>
              <p>
                <strong>{data.incomingTransfer.from_user?.display_name || data.incomingTransfer.from_user?.username || 'O líder atual'}</strong>
                propôs transferir a liderança da scan <strong>{data.incomingTransfer.scans?.name}</strong> para você.
              </p>
            </div>
          </div>
          <div class="transfer-alert-actions">
            <form method="POST" action="?/respondOwnershipTransfer" use:enhance>
              <input type="hidden" name="request_id" value={data.incomingTransfer.id} />
              <input type="hidden" name="accept" value="true" />
              <button type="submit" class="btn-transfer-accept">
                <Check size={16} />
                <span>Aceitar Liderança</span>
              </button>
            </form>
            <form method="POST" action="?/respondOwnershipTransfer" use:enhance>
              <input type="hidden" name="request_id" value={data.incomingTransfer.id} />
              <input type="hidden" name="accept" value="false" />
              <button type="submit" class="btn-transfer-reject">
                <X size={16} />
                <span>Recusar</span>
              </button>
            </form>
          </div>
        </div>
      {/if}

      {#if !data.authenticated}
        <!-- Unauthenticated State -->
        <section class="onboarding-hero">
          <div class="hero-icon-ring">
            <ShieldCheck size={48} />
          </div>
          <h1 class="onboarding-title">Painel de Scan Parceira</h1>
          <p class="onboarding-sub">
            Faça login ou crie sua conta no Project Nox para acessar seu painel editorial e gerenciar suas obras.
          </p>
          <div class="onboarding-actions">
            <a href="/entrar" class="btn-primary">Entrar na Conta</a>
            <a href="/registro" class="btn-secondary">Criar Conta</a>
          </div>
        </section>
      {:else}
        <!-- Not a Scan Member State -->
        <section class="partnership-portal">
        <header class="portal-header">
          <div class="badge-partnership">
            <Sparkles size={15} />
            <span>Programa de Parcerias</span>
          </div>
          <h1 class="portal-title">Torne-se uma Scan Parceira no Project Nox</h1>
          <p class="portal-sub">
            Traga sua equipe para uma plataforma focada na melhor experiência de leitura, com respeito integral aos
            tradutores e visibilidade para a sua comunidade.
          </p>
        </header>

        {#if data.partnerRequests && data.partnerRequests.length > 0}
          <div class="my-partner-requests-card">
            <div class="requests-card-header">
              <Clock size={18} />
              <h2>Suas Solicitações de Parceria ({data.partnerRequests.length})</h2>
            </div>
            <div class="requests-track-list">
              {#each data.partnerRequests as req (req.id)}
                <div class="track-item status-{req.status.toLowerCase()}">
                  <div class="track-header">
                    <div class="track-scan-info">
                      <strong class="track-scan-name">{req.scan_name}</strong>
                      <span class="track-scan-slug font-mono">/{req.scan_slug}</span>
                    </div>
                    <div class="track-status-cell">
                      <span class="status-pill status-{req.status.toLowerCase()}">
                        {req.status === 'PENDING' ? 'Em Análise' : req.status === 'APPROVED' ? 'Aprovada' : req.status === 'CANCELLED' ? 'Cancelada' : 'Recusada'}
                      </span>
                      {#if req.status === 'PENDING'}
                        <form method="POST" action="?/cancelPartnerRequest" use:enhance>
                          <input type="hidden" name="request_id" value={req.id} />
                          <button type="submit" class="btn-cancel-req">Cancelar Solicitação</button>
                        </form>
                      {/if}
                    </div>
                  </div>

                  {#if req.description}
                    <p class="track-desc">{req.description}</p>
                  {/if}

                  {#if req.status === 'REJECTED' && req.rejection_reason}
                    <div class="track-rejection-msg">
                      <AlertTriangle size={14} />
                      <span>Motivo da recusa: {req.rejection_reason}</span>
                    </div>
                  {:else if req.status === 'APPROVED'}
                    <div class="track-approved-msg">
                      <CheckCircle2 size={14} />
                      <span>Parceria aprovada! Você foi nomeado líder. Recarregue a página para acessar seu painel.</span>
                    </div>
                  {:else if req.status === 'CANCELLED'}
                    <div class="track-cancelled-msg">
                      <X size={14} />
                      <span>Solicitação cancelada por você.</span>
                    </div>
                  {:else}
                    <div class="track-pending-msg">
                      <Clock size={14} />
                      <span>Sua solicitação está sendo revisada por nossa equipe editorial.</span>
                    </div>
                  {/if}
                  <span class="track-date">Enviado em {new Date(req.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <div class="perks-grid">
          <div class="perk-card">
            <div class="perk-icon">
              <ShieldCheck size={22} />
            </div>
            <h3>Atribuição Oficial Garantida</h3>
            <p>Seu nome e logotipo aparecem no topo de cada capítulo e na página da obra com selo de verificação.</p>
          </div>

          <div class="perk-card">
            <div class="perk-icon">
              <MessageSquare size={22} />
            </div>
            <h3>Tráfego Direto para seu Discord</h3>
            <p>Botões de atalho integrados levam os leitores diretamente para o servidor ou site da sua scan.</p>
          </div>

          <div class="perk-card">
            <div class="perk-icon">
              <Eye size={22} />
            </div>
            <h3>Métricas Reais de Audiência</h3>
            <p>Acompanhe em tempo real leituras totais, obras mais lidas e retenção de público com proteção anti-bots.</p>
          </div>

          <div class="perk-card">
            <div class="perk-icon">
              <Settings size={22} />
            </div>
            <h3>Painel Dedicado e Equipe</h3>
            <p>Gerencie membros da sua scan (Líder, Admins, Uploaders) e personalize a bio e redes do seu grupo.</p>
          </div>
        </div>

        <!-- In-Platform Partnership Request Form -->
        <div class="partner-form-card">
          <div class="partner-form-header">
            <Sparkles size={20} class="accent-icon" />
            <div>
              <h2>Solicitar Parceria Direta</h2>
              <p>Envie os dados do seu grupo para cadastro e validação pela equipe Project Nox.</p>
            </div>
          </div>

          {#if showSuccess && form?.partnerRequested}
            <div class="success-banner">
              <CheckCircle2 size={16} />
              <span>Solicitação enviada com sucesso! Nossa equipe analisará sua solicitação em breve.</span>
            </div>
          {/if}

          {#if form?.message}
            <div class="error-banner">
              <AlertCircle size={16} />
              <span>{form.message}</span>
            </div>
          {/if}

          <form
            method="POST"
            action="?/requestPartner"
            use:enhance={() => {
              reqSubmitting = true;
              return async ({ update }) => {
                reqSubmitting = false;
                await update();
              };
            }}
            class="partner-request-form"
          >
            <div class="form-row">
              <div class="form-field flex-1">
                <label for="req-name">Nome da Scan *</label>
                <input
                  id="req-name"
                  name="scan_name"
                  type="text"
                  required
                  placeholder="Ex: Hanami Scans, Moonlight Traduções"
                  value={reqScanName}
                  oninput={(e) => handleReqNameChange((e.currentTarget as HTMLInputElement).value)}
                />
              </div>

              <div class="form-field flex-1">
                <label for="req-slug">Slug da Scan (URL única) *</label>
                <input
                  id="req-slug"
                  name="scan_slug"
                  type="text"
                  required
                  class="font-mono"
                  placeholder="ex: hanami-scans"
                  value={reqScanSlug}
                  oninput={(e) => {
                    reqSlugCustomized = true;
                    reqScanSlug = (e.currentTarget as HTMLInputElement).value;
                  }}
                />
              </div>
            </div>

            <div class="form-field">
              <label for="req-desc">Descrição / Apresentação do Grupo</label>
              <textarea
                id="req-desc"
                name="description"
                rows={3}
                placeholder="Conte um pouco sobre sua scan, gêneros favoritos, histórico de projetos..."
              ></textarea>
            </div>

            <div class="form-row">
              <div class="form-field flex-1">
                <label for="req-discord">Link do Discord *</label>
                <input
                  id="req-discord"
                  name="discord"
                  type="url"
                  required
                  placeholder="https://discord.gg/seugrupo"
                />
              </div>

              <div class="form-field flex-1">
                <label for="req-fluxer">Comunidade Fluxer (opcional)</label>
                <input
                  id="req-fluxer"
                  name="fluxer"
                  type="text"
                  placeholder="Nome ou link no Fluxer"
                />
              </div>

              <div class="form-field flex-1">
                <label for="req-website">Website Oficial (opcional)</label>
                <input
                  id="req-website"
                  name="website"
                  type="url"
                  placeholder="https://suascan.com"
                />
              </div>
            </div>

            <div class="form-field">
              <label for="req-samples">Amostras de Tradução / Obras Lançadas</label>
              <textarea
                id="req-samples"
                name="sample_links"
                rows={2}
                placeholder="Links de leitores online, Mangadex, ou drive com amostras do trabalho da scan..."
              ></textarea>
            </div>

            <div class="form-actions-bar">
              <button type="submit" class="btn-submit-request" disabled={reqSubmitting}>
                {#if reqSubmitting}
                  <span>Enviando solicitação...</span>
                {:else}
                  <Send size={16} />
                  <span>Enviar Solicitação de Parceria</span>
                {/if}
              </button>
            </div>
          </form>
        </div>

        <div class="cta-box">
          <h2>Dúvidas antes de solicitar?</h2>
          <p>Entre no nosso Discord oficial e converse diretamente com a moderação na aba <strong>#parcerias-scan</strong>.</p>
          <a href="https://discord.gg/projectnox" target="_blank" rel="noopener noreferrer" class="btn-discord-cta">
            <MessageSquare size={18} />
            <span>Falar no Discord Oficial</span>
          </a>
        </div>
      </section>
      {/if}
    </div>
  </div>
{:else}
  <!-- Active Member Modern Workspace Shell -->
  <div class="workspace-app-shell">
        <ScanSidebar
          currentScan={data.currentScan}
          myScans={data.myScans}
          userRole={data.userRole}
          activeTab={currentWorkspaceTab}
          activeStage={currentPipelineStage}
          stages={data.stages}
          chapterStages={data.chapterStages}
          chapters={data.productionChapters}
          userPositions={data.userPositions || []}
          seenStages={data.seenStages || []}
          currentUserId={data.userId}
          onSelectTab={handleSelectTab}
          unreadNotifications={(data.notifications || []).filter((n: any) => !n.is_read).length}
          unreadMessages={0}
          pendingAppsCount={pendingAppsCount}
          openTasksCount={(data.tasks || []).filter((t: any) => t.status !== 'DONE' && (t.assigned_to === data.userId || t.assignee_id === data.userId)).length}
          mobileOpen={sidebarMobileOpen}
          onCloseMobile={() => (sidebarMobileOpen = false)}
          onOpenCommandPalette={() => (showCommandPalette = true)}
        />

        <div class="workspace-main-area">
          <header class="workspace-mobile-topbar">
            <button
              type="button"
              class="btn-hamburger"
              aria-label="Abrir menu de navegação"
              onclick={() => (sidebarMobileOpen = true)}
            >
              <Menu size={20} />
            </button>
            <div class="mobile-scan-brand">
              <span class="mobile-scan-title">{data.currentScan?.name}</span>
              <span class="mobile-scan-role">{ROLE_LABELS[data.userRole] || data.userRole}</span>
            </div>
            <button
              type="button"
              class="btn-search-mobile"
              aria-label="Busca rápida"
              onclick={() => (showCommandPalette = true)}
            >
              <Search size={18} />
            </button>
          </header>

          {#if data.currentScan?.emergency_mode}
            <div class="emergency-banner-alert">
              <AlertTriangle size={20} class="text-rose-500" />
              <div class="banner-text">
                <strong>MODO DE EMERGÊNCIA ATIVO NA SCAN</strong>
                <p>{data.currentScan?.emergency_reason || 'Operações e envios congelados temporariamente pela administração.'}</p>
              </div>
            </div>
          {:else if data.currentScan?.pause_uploads}
            <div class="pause-banner-alert">
              <PauseCircle size={18} class="text-amber-500" />
              <span>Uploads de capítulos estão temporariamente pausados pela administração da scan.</span>
            </div>
          {/if}

          <div class="workspace-view-content">
            {#if activeWorkspaceChapter}
              {@const activeChId = activeWorkspaceChapter.id || activeWorkspaceChapter.target_chapter_id || activeWorkspaceChapter.chapters?.id}
              <ChapterWorkspaceView
                chapterId={activeChId}
                chapters={[activeWorkspaceChapter, ...(data.productionChapters || []), ...(chapters || [])]}
                stages={data.stages || []}
                chapterStages={data.chapterStages || []}
                productionFiles={data.productionFiles || []}
                chapterTimeline={data.chapterTimeline || []}
                tasks={(data.tasks || []).filter((t: any) => t.chapter_id === activeChId || t.chapter_id === activeWorkspaceChapter.id || t.chapter_id === activeWorkspaceChapter.target_chapter_id || t.chapter_number === (activeWorkspaceChapter.number || activeWorkspaceChapter.chapter_number))}
                team={team}
                userProfile={{ id: data.userId }}
                currentUserId={data.userId}
                userRole={data.userRole}
                scanId={data.currentScan.id}
                qcIssues={(data.qcIssues || []).filter((q: any) => q.chapter_id === activeChId || q.chapter_id === activeWorkspaceChapter.id || q.chapter_id === activeWorkspaceChapter.target_chapter_id)}
                onBackToPipeline={() => (activeWorkspaceChapter = null)}
              />
            {:else if currentWorkspaceTab === 'home'}
              <ScanHome
                currentScan={data.currentScan}
                userProfile={{ id: data.userId }}
                userRole={data.userRole}
                tasks={data.tasks || []}
                stages={data.stages || []}
                chapters={data.productionChapters || []}
                chapterStages={data.chapterStages || []}
                works={works}
                muralPosts={data.muralPosts || []}
                notifications={data.notifications || []}
                qcIssues={data.qcIssues || []}
                onNavigateTab={handleSelectTab}
                onOpenChapter={handleOpenChapter}
              />
            {:else if currentWorkspaceTab === 'mural'}
              <MuralTab
                scanId={data.currentScan.id}
                userProfile={{ id: data.userId }}
                userRole={data.userRole}
                muralPosts={data.muralPosts || []}
                positions={positions}
                team={team}
              />
            {:else if currentWorkspaceTab === 'minha_fila'}
              <TasksTab
                tasks={data.tasks || []}
                stages={data.stages || []}
                chapterStages={data.chapterStages || []}
                productionChapters={data.productionChapters || []}
                productionFiles={data.productionFiles || []}
                chapterTimeline={data.chapterTimeline || []}
                workOverrides={data.workOverrides || []}
                creditSnapshots={data.creditSnapshots || []}
                team={team}
                positions={positions}
                works={works}
                currentUserId={data.userId}
                currentScanId={data.currentScan?.id || ''}
                userRole={data.userRole}
                isOwnerOrAdmin={['OWNER', 'ADMIN'].includes(data.userRole)}
                onOpenChapter={handleOpenChapter}
                initialView="MINE"
              />
            {:else if currentWorkspaceTab === 'pipeline'}
              <PipelineStageView
                currentStageSlug={currentPipelineStage}
                stages={data.stages || []}
                chapterStages={data.chapterStages || []}
                chapters={data.productionChapters || []}
                works={works}
                productionFiles={data.productionFiles || []}
                tasks={data.tasks || []}
                qcIssues={data.qcIssues || []}
                currentUserId={data.userId}
                userRole={data.userRole}
                userPositions={data.userPositions || []}
                seenStages={data.seenStages || []}
                isOwnerOrAdmin={['OWNER', 'ADMIN'].includes(data.userRole)}
                scanId={data.currentScan?.id || ''}
                onSelectStage={(slug: string) => handleSelectTab('pipeline', slug)}
                onOpenChapter={handleOpenChapter}
              />
            {:else if currentWorkspaceTab === 'pipeline_config'}
              <PipelineConfigTab
                stages={data.stages || []}
                scanId={data.currentScan.id}
                pipelineTemplates={data.pipelineTemplates || []}
                userRole={data.userRole}
              />
            {:else if currentWorkspaceTab === 'capitulos' || currentWorkspaceTab === 'works' || currentWorkspaceTab === 'obras'}
        <div class="dash-columns">
          <div class="dash-col-left">
            <section class="card-section">
              <div class="section-top space-between">
                <div class="section-title-wrap">
                  <BookOpen size={18} />
                  <h2>Obras da Scan ({works.length})</h2>
                </div>
                {#if ['OWNER', 'ADMIN', 'UPLOADER'].includes(data.userRole)}
                  <button type="button" class="btn-sm-action" onclick={() => (showProjectModal = true)}>
                    <Plus size={14} />
                    <span>Solicitar Obra</span>
                  </button>
                {/if}
              </div>

              {#if works.length > 0}
                <div class="works-list">
                  {#each works as work (work.id)}
                    <div class="dash-work-row">
                      <a href="/obra/{work.slug}" class="dash-work-item">
                        {#if work.cover_id}
                          <img src="/media/{work.cover_id}" alt={work.title} class="work-mini-cover" />
                        {:else}
                          <div class="work-mini-placeholder">NOX</div>
                        {/if}
                        <div class="work-mini-info">
                          <span class="work-mini-title">{work.title}</span>
                          <span class="work-mini-views">
                            <Eye size={12} />
                            <span>{formatNumber(work.views_total || 0)} leituras</span>
                          </span>
                        </div>
                      </a>

                      <div class="dash-work-status-cell">
                        {#if ['OWNER', 'ADMIN'].includes(data.userRole)}
                          <form method="POST" action="?/updateProjectStatus" use:enhance class="project-status-form">
                            <input type="hidden" name="scan_id" value={data.currentScan?.id} />
                            <input type="hidden" name="work_id" value={work.id} />
                            <label for="work-status-{work.id}" class="sr-only">Status do Projeto</label>
                            <select
                              id="work-status-{work.id}"
                              name="status"
                              value={work.project_status || 'ACTIVE'}
                              class="project-status-select status-{(work.project_status || 'ACTIVE').toLowerCase()}"
                              onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
                            >
                              <option value="ACTIVE">Ativo</option>
                              <option value="PAUSED">Pausado</option>
                              <option value="COMPLETED">Concluído</option>
                              <option value="ABANDONED">Abandonado</option>
                            </select>
                          </form>
                        {:else}
                          <span class="status-pill status-{(work.project_status || 'ACTIVE').toLowerCase()}">
                            {work.project_status === 'ACTIVE' ? 'Ativo' : work.project_status === 'PAUSED' ? 'Pausado' : work.project_status === 'COMPLETED' ? 'Concluído' : 'Abandonado'}
                          </span>
                        {/if}
                        <a href="/obra/{work.slug}" class="work-arrow-link" title="Abrir Obra">
                          <ArrowRight size={15} class="work-arrow" />
                        </a>
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="empty-text">Nenhuma obra atribuída a esta scan ainda.</p>
              {/if}

              {#if data.projectRequests && data.projectRequests.length > 0}
                <div class="project-requests-block">
                  <span class="sub-section-title">Solicitações de Obras ({data.projectRequests.length})</span>
                  <div class="proj-requests-list">
                    {#each data.projectRequests as req (req.id)}
                      <div class="proj-req-item status-{req.status.toLowerCase()}">
                        {#if req.works?.cover_id}
                          <img src="/media/{req.works.cover_id}" alt="" class="proj-cover-mini" />
                        {:else}
                          <div class="proj-cover-fallback">NOX</div>
                        {/if}
                        <div class="proj-info">
                          <strong class="proj-title">{req.works?.title}</strong>
                          {#if req.message}
                            <span class="proj-msg">"{req.message}"</span>
                          {/if}
                          {#if req.status === 'REJECTED' && req.rejection_reason}
                            <span class="proj-rejection-note">
                              <AlertTriangle size={12} />
                              <span>Motivo: {req.rejection_reason}</span>
                            </span>
                          {/if}
                        </div>
                        <div class="proj-actions-cell">
                          <span class="status-pill status-{req.status.toLowerCase()}">
                            {req.status === 'PENDING' ? 'Em Análise' : req.status === 'APPROVED' ? 'Aprovada' : req.status === 'CANCELLED' ? 'Cancelada' : 'Recusada'}
                          </span>
                          {#if req.status === 'PENDING' && ['OWNER', 'ADMIN'].includes(data.userRole)}
                            <form method="POST" action="?/cancelProjectRequest" use:enhance>
                              <input type="hidden" name="request_id" value={req.id} />
                              <button type="submit" class="btn-cancel-req">Cancelar Pedido</button>
                            </form>
                          {/if}
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </section>
          </div>

          <div class="dash-col-right">
            <section class="card-section">
              <div class="section-top">
                <Layers size={18} />
                <h2>Últimos Capítulos Registrados ({chapters.length})</h2>
              </div>

              {#if chapters.length > 0}
                <div class="recent-chapters-list">
                  {#each chapters as ch (ch.id)}
                    <a href="/ler/{ch.id}" class="dash-ch-item">
                      <div class="ch-left">
                        <span class="ch-work">{ch.works?.title}</span>
                        <span class="ch-num">Capítulo {ch.number}</span>
                      </div>
                      <div class="ch-right">
                        <span class="ch-views-count">
                          <Eye size={12} />
                          <span>{formatNumber(ch.views_total || 0)}</span>
                        </span>
                        <time datetime={ch.published_at}>{relativeTime(ch.published_at)}</time>
                      </div>
                    </a>
                  {/each}
                </div>
              {:else}
                <p class="empty-text">Nenhum capítulo lançado recentemente.</p>
              {/if}
            </section>
          </div>
        </div>

      <!-- TAB PANE: EQUIPE & CARGOS -->
      {:else if currentWorkspaceTab === 'membros' || activeDashTab === 'team'}
        <section class="card-section">
          <div class="section-top space-between">
            <div class="section-title-wrap">
              <Users size={18} />
              <h2>Membros da Equipe ({team.length})</h2>
            </div>
            {#if ['OWNER', 'ADMIN'].includes(data.userRole)}
              <button type="button" class="btn-sm-action" onclick={() => (showInviteModal = true)}>
                <Plus size={14} />
                <span>Gerar Convite</span>
              </button>
            {/if}
          </div>

          {#if createdInvite}
            <div class="created-invite-banner">
              <div class="invite-banner-header">
                <CheckCircle2 size={16} />
                <span>Convite gerado com sucesso!</span>
              </div>
              <div class="invite-copy-group">
                <input
                  type="text"
                  readonly
                  value={typeof window !== 'undefined' ? `${window.location.origin}/convite/${createdInvite.code}` : `/convite/${createdInvite.code}`}
                  class="invite-copy-input font-mono"
                />
                <button
                  type="button"
                  class="btn-copy-action"
                  onclick={() => copyInviteLink(createdInvite.code)}
                >
                  {#if copiedCode === createdInvite.code}
                    <Check size={14} />
                    <span>Copiado</span>
                  {:else}
                    <Copy size={14} />
                    <span>Copiar Link</span>
                  {/if}
                </button>
              </div>
              <span class="invite-hint-txt">Link de uso único válido até {createdInvite.expires_at ? new Date(createdInvite.expires_at).toLocaleString('pt-BR') : 'expirar'}.</span>
            </div>
          {/if}

          {#if data.invites && data.invites.length > 0}
            <div class="active-invites-block">
              <span class="sub-section-title">Convites Ativos ({data.invites.length})</span>
              <div class="invites-list">
                {#each data.invites as inv (inv.id)}
                  <div class="active-invite-item">
                    <div class="invite-info-left">
                      <span class="invite-role-tag">{ROLE_LABELS[inv.role] || inv.role}</span>
                      <span class="invite-exp-tag">
                        <Clock size={11} />
                        <span>Expira {relativeTime(inv.expires_at)}</span>
                      </span>
                    </div>
                    <div class="invite-actions-right">
                      <button
                        type="button"
                        class="btn-icon-sq"
                        title="Copiar Link"
                        onclick={() => copyInviteLink(inv.code)}
                      >
                        {#if copiedCode === inv.code}
                          <Check size={13} class="text-green" />
                        {:else}
                          <Copy size={13} />
                        {/if}
                      </button>
                      <form method="POST" action="?/revokeInvite" use:enhance>
                        <input type="hidden" name="scan_id" value={data.currentScan?.id} />
                        <input type="hidden" name="invite_id" value={inv.id} />
                        <button type="submit" class="btn-revoke-sq" title="Revogar Convite">
                          <X size={13} />
                        </button>
                      </form>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          {#if data.transferRequests && data.transferRequests.some((t: any) => t.status === 'PENDING')}
            <div class="pending-transfers-block">
              <span class="sub-section-title"><Crown size={14} class="inline mr-1" /> Transferência Pendente</span>
              {#each data.transferRequests.filter((t: any) => t.status === 'PENDING') as tr (tr.id)}
                <div class="pending-transfer-item">
                  <div class="transfer-to-info">
                    <span class="transfer-to-name">Proposta para <strong>{tr.to_user?.display_name || tr.to_user?.username}</strong></span>
                    <span class="transfer-to-sub">Aguardando aceite do membro</span>
                  </div>
                  {#if data.userRole === 'OWNER'}
                    <form method="POST" action="?/cancelOwnershipTransfer" use:enhance>
                      <input type="hidden" name="request_id" value={tr.id} />
                      <button type="submit" class="btn-cancel-req">Cancelar Proposta</button>
                    </form>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          <div class="team-detailed-grid">
            {#each team as member (member.id)}
              <div class="member-card">
                <div class="member-card-header">
                  <UserAvatar
                    avatarId={member.avatar_id}
                    displayName={member.display_name || member.username}
                    size={46}
                  />
                  <div class="member-card-info">
                    <div class="member-name-row">
                      <strong class="member-display">{member.display_name || member.username}</strong>
                      {#if member.role === 'OWNER'}
                        <span class="role-pill is-owner" title="Dono e Líder da Scan">
                          <Crown size={12} class="mr-1 inline text-amber" />
                          Dono
                        </span>
                      {:else if member.role === 'ADMIN'}
                        <span class="role-pill is-manager" title="Gerente da Scan">
                          <Shield size={12} class="mr-1 inline text-blue" />
                          Gerente
                        </span>
                      {:else}
                        <span class="role-pill is-staff" title="Membro da Staff">
                          <User size={12} class="mr-1 inline text-slate" />
                          Staff
                        </span>
                      {/if}
                    </div>
                    <span class="member-user">@{member.username}</span>
                  </div>
                </div>

                <!-- Editorial Positions Assigned -->
                <div class="member-card-positions">
                  <div class="member-pos-label-row">
                    <span class="pos-row-label">Cargos Editoriais:</span>
                  </div>
                  <div class="member-positions-tags">
                    {#if member.positions && member.positions.length > 0}
                      {#each member.positions as pos}
                        <span class="pos-badge" class:primary={pos.is_primary}>
                          <span class="pos-emoji">{getPositionIcon(pos.name)}</span>
                          {#if pos.is_primary}★ {/if}{pos.name}
                        </span>
                      {/each}
                    {:else}
                      <span class="pos-none-text">Nenhum cargo editorial atribuído</span>
                    {/if}
                  </div>
                </div>

                <!-- Member Visibility Controls -->
                <div class="member-card-visibility">
                  <div class="vis-status-row">
                    <span class="vis-label">Visibilidade no Perfil:</span>
                    {#if member.hidden_by_admin}
                      <span class="badge-vis-status hidden-admin" title="Ocultado pela administração global">
                        Oculto por Admin Global
                      </span>
                    {:else if !member.is_public}
                      <span class="badge-vis-status private" title="Oculto pela equipe">
                        Oculto na Equipe
                      </span>
                    {:else}
                      <span class="badge-vis-status public" title="Visível publicamente no perfil e equipe">
                        Público
                      </span>
                    {/if}
                  </div>

                  {#if canManageMembers(data.userRole) || member.id === data.userId}
                    <form method="POST" action="?/updateMemberVisibility" use:enhance class="vis-toggle-form">
                      <input type="hidden" name="scan_id" value={data.currentScan?.id} />
                      <input type="hidden" name="user_id" value={member.id} />
                      <input type="hidden" name="is_public" value={member.is_public ? 'false' : 'true'} />
                      <button
                        type="submit"
                        class="btn-vis-toggle"
                        title={member.is_public ? 'Tornar oculto' : 'Tornar público'}
                      >
                        {member.is_public ? 'Ocultar da Equipe' : 'Exibir na Equipe'}
                      </button>
                    </form>
                  {/if}
                </div>

                <!-- Member Actions -->
                {#if canManageMembers(data.userRole)}
                  <div class="member-card-actions">
                    <button
                      type="button"
                      class="btn-action-manage-member"
                      onclick={() => openManageMemberModal(member)}
                      title="Gerenciar função administrativa e cargos editoriais"
                    >
                      <Sliders size={13} />
                      <span>Gerenciar</span>
                    </button>

                    {#if data.userRole === 'OWNER' && member.id !== data.userId}
                      <button
                        type="button"
                        class="btn-icon-member crown"
                        title="Transferir Liderança da Scan"
                        onclick={() => (transferTarget = member)}
                      >
                        <Crown size={14} />
                      </button>
                    {/if}

                    {#if canRemoveMember(data.userRole, member.role)}
                      <button
                        type="button"
                        class="btn-icon-member remove"
                        title="Remover da Scan"
                        onclick={() => (removeTarget = member)}
                      >
                        <UserMinus size={14} />
                      </button>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </section>

      <!-- TAB PANE: VAGAS & RECRUTAMENTO -->
      {:else if currentWorkspaceTab === 'recrutamento' || activeDashTab === 'openings'}
        <section class="card-section">
          <div class="section-top space-between">
            <div class="section-title-wrap">
              <Briefcase size={18} />
              <h2>Vagas de Recrutamento ({openings.length})</h2>
            </div>
            {#if ['OWNER', 'ADMIN'].includes(data.userRole)}
              <button type="button" class="btn-sm-action primary" onclick={openCreateOpeningModal}>
                <Plus size={14} />
                <span>Nova Vaga</span>
              </button>
            {/if}
          </div>

          {#if openings.length > 0}
            <div class="openings-dash-grid">
              {#each openings as op (op.id)}
                <div class="opening-dash-card status-{op.status.toLowerCase()}">
                  <div class="op-card-top">
                    <div class="op-badge-cluster">
                      <span class="op-pos-tag">{op.scan_positions?.name || 'Cargo'}</span>
                      <span class="status-pill status-{op.status.toLowerCase()}">
                        {op.status === 'OPEN' ? 'Aberta' : op.status === 'PAUSED' ? 'Pausada' : 'Fechada'}
                      </span>
                    </div>
                    <div class="op-card-metrics">
                      <span class="op-candidatos-count" title="Total de candidaturas">
                        <Users size={12} /> {op.applications_count || 0}
                      </span>
                      {#if op.pending_count > 0}
                        <span class="op-pending-alert-pill" title="Candidaturas pendentes">
                          {op.pending_count} pendente{op.pending_count === 1 ? '' : 's'}
                        </span>
                      {/if}
                    </div>
                  </div>

                  <h3 class="op-card-title">{op.title}</h3>

                  {#if op.description}
                    <p class="op-card-desc">{op.description}</p>
                  {/if}

                  <div class="op-meta-specs">
                    {#if op.language}
                      <span class="op-spec-item">🌐 {op.language}</span>
                    {/if}
                    <span class="op-spec-item">🎯 Nível: {op.experience_level}</span>
                    {#if op.slots}
                      <span class="op-spec-item">👥 {op.slots} vaga{op.slots === 1 ? '' : 's'}</span>
                    {:else}
                      <span class="op-spec-item">👥 Vagas contínuas</span>
                    {/if}
                    {#if op.availability}
                      <span class="op-spec-item">⏳ {op.availability}</span>
                    {/if}
                  </div>

                  {#if op.requirements}
                    <div class="op-requirements-box">
                      <strong>Requisitos:</strong>
                      <p>{op.requirements}</p>
                    </div>
                  {/if}

                  {#if ['OWNER', 'ADMIN'].includes(data.userRole)}
                    <div class="op-card-actions-bar">
                      <button
                        type="button"
                        class="btn-op-action"
                        onclick={() => {
                          appFilter = 'ALL';
                          handleSelectTab('candidaturas');
                        }}
                      >
                        <FileText size={13} />
                        <span>Ver Candidaturas ({op.applications_count || 0})</span>
                      </button>

                      <button
                        type="button"
                        class="btn-op-action secondary"
                        onclick={() => openEditOpeningModal(op)}
                      >
                        <Edit2 size={13} />
                        <span>Editar</span>
                      </button>

                      <!-- Quick pause/resume form -->
                      <form
                        method="POST"
                        action="?/manageOpening"
                        use:enhance={() => {
                          return async ({ update }) => {
                            await update();
                          };
                        }}
                        class="inline-form"
                      >
                        <input type="hidden" name="scan_id" value={data.currentScan?.id} />
                        <input type="hidden" name="opening_id" value={op.id} />
                        <input type="hidden" name="position_id" value={op.position_id} />
                        <input type="hidden" name="title" value={op.title} />
                        <input type="hidden" name="description" value={op.description || ''} />
                        <input type="hidden" name="requirements" value={op.requirements || ''} />
                        <input type="hidden" name="language" value={op.language || 'pt-BR'} />
                        <input type="hidden" name="experience_level" value={op.experience_level || 'QUALQUER'} />
                        <input type="hidden" name="availability" value={op.availability || ''} />
                        <input type="hidden" name="slots" value={op.slots || ''} />
                        <input type="hidden" name="notes" value={op.notes || ''} />
                        <input type="hidden" name="status" value={op.status === 'OPEN' ? 'PAUSED' : 'OPEN'} />
                        <button type="submit" class="btn-op-action toggle">
                          {#if op.status === 'OPEN'}
                            <PauseCircle size={13} />
                            <span>Pausar</span>
                          {:else}
                            <PlayCircle size={13} />
                            <span>Reabrir</span>
                          {/if}
                        </button>
                      </form>

                      <!-- Delete opening form -->
                      <form
                        method="POST"
                        action="?/deleteOpening"
                        use:enhance={({ cancel }) => {
                          if (!confirm(`Tem certeza que deseja excluir a vaga "${op.title}"? Esta ação removerá a vaga permanentemente.`)) {
                            cancel();
                            return;
                          }
                          return async ({ update }) => {
                            await update();
                          };
                        }}
                        class="inline-form"
                      >
                        <input type="hidden" name="scan_id" value={data.currentScan?.id} />
                        <input type="hidden" name="opening_id" value={op.id} />
                        <button type="submit" class="btn-op-action danger" title="Excluir vaga">
                          <Trash2 size={13} />
                          <span>Excluir</span>
                        </button>
                      </form>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-tab-state">
              <Briefcase size={36} />
              <h4>Nenhuma Vaga Aberta</h4>
              <p>Sua scan ainda não publicou nenhuma vaga de recrutamento. Abra vagas para encontrar tradutores, revisores e typesetters.</p>
              {#if ['OWNER', 'ADMIN'].includes(data.userRole)}
                <button type="button" class="btn-primary mt-4" onclick={openCreateOpeningModal}>
                  <Plus size={15} />
                  <span>Criar Primeira Vaga</span>
                </button>
              {/if}
            </div>
          {/if}
        </section>

      <!-- TAB PANE: CANDIDATURAS -->
      {:else if currentWorkspaceTab === 'candidaturas' || activeDashTab === 'applications'}
        <section class="card-section">
          <div class="section-top space-between">
            <div class="section-title-wrap">
              <FileText size={18} />
              <h2>Candidaturas Recebidas ({applications.length})</h2>
            </div>
            <!-- Status Filter Tabs -->
            <div class="filter-pills-row">
              <button
                type="button"
                class="filter-pill"
                class:active={appFilter === 'ALL'}
                onclick={() => (appFilter = 'ALL')}
              >
                Todas ({applications.length})
              </button>
              <button
                type="button"
                class="filter-pill"
                class:active={appFilter === 'PENDING'}
                onclick={() => (appFilter = 'PENDING')}
              >
                Pendentes ({pendingAppsCount})
              </button>
              <button
                type="button"
                class="filter-pill"
                class:active={appFilter === 'UNDER_REVIEW'}
                onclick={() => (appFilter = 'UNDER_REVIEW')}
              >
                Em Análise
              </button>
              <button
                type="button"
                class="filter-pill"
                class:active={appFilter === 'APPROVED'}
                onclick={() => (appFilter = 'APPROVED')}
              >
                Aprovadas
              </button>
              <button
                type="button"
                class="filter-pill"
                class:active={appFilter === 'REJECTED'}
                onclick={() => (appFilter = 'REJECTED')}
              >
                Recusadas
              </button>
            </div>
          </div>

          {#if filteredApplications.length > 0}
            <div class="applications-grid">
              {#each filteredApplications as app (app.id)}
                {@const appAnswers = (data.applicationAnswers || []).filter((a: any) => a.application_id === app.id)}
                <div class="app-card status-{app.status.toLowerCase()}">
                  <div class="app-card-header">
                    <div class="applicant-profile-row">
                      <UserAvatar
                        avatarId={app.members?.avatar_id}
                        displayName={app.members?.display_name || app.members?.username}
                        size={42}
                      />
                      <div class="applicant-names">
                        <a href="/u/{app.members?.username}" target="_blank" class="applicant-link">
                          <strong>{app.members?.display_name || app.members?.username}</strong>
                          <span class="applicant-user">@{app.members?.username}</span>
                        </a>
                        <span class="app-timestamp">{relativeTime(app.created_at)}</span>
                      </div>
                    </div>

                    <div class="app-status-badge-wrap">
                      <span class="app-pos-tag">{app.scan_positions?.name || 'Cargo'}</span>
                      <span class="status-pill status-{app.status.toLowerCase()}">
                        {app.status === 'PENDING' ? 'Pendente' : app.status === 'UNDER_REVIEW' ? 'Em Análise' : app.status === 'APPROVED' ? 'Aprovado' : 'Recusado'}
                      </span>
                    </div>
                  </div>

                  <div class="app-opening-ref">
                    <span>Vaga vinculada: <strong>{app.scan_recruitment_openings?.title || app.scan_positions?.name}</strong></span>
                  </div>

                  <div class="app-card-body">
                    {#if app.presentation}
                      <div class="app-field-item">
                        <span class="app-field-label">Apresentação:</span>
                        <p class="app-field-val">{app.presentation}</p>
                      </div>
                    {/if}

                    {#if app.experience}
                      <div class="app-field-item">
                        <span class="app-field-label">Experiência:</span>
                        <p class="app-field-val">{app.experience}</p>
                      </div>
                    {/if}

                    {#if app.availability}
                      <div class="app-field-item">
                        <span class="app-field-label">Disponibilidade:</span>
                        <p class="app-field-val">{app.availability}</p>
                      </div>
                    {/if}

                    {#if app.contact_info}
                      <div class="app-field-item">
                        <span class="app-field-label">Contato / Discord:</span>
                        <p class="app-field-val font-mono">{app.contact_info}</p>
                      </div>
                    {/if}

                    {#if app.portfolio_url}
                      <div class="app-field-item">
                        <a
                          href={app.portfolio_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="portfolio-link-btn"
                        >
                          <ExternalLink size={13} />
                          <span>Ver Portfólio / Amostra de Trabalho ↗</span>
                        </a>
                      </div>
                    {/if}

                    {#if appAnswers.length > 0}
                      <div class="app-qa-answers-box">
                        <strong class="app-qa-title">Respostas ao Questionário da Vaga:</strong>
                        <div class="app-qa-list">
                          {#each appAnswers as ans}
                            <div class="app-qa-entry">
                              <span class="app-qa-question">{ans.question?.question || 'Pergunta'}:</span>
                              <span class="app-qa-answer">{ans.answer}</span>
                            </div>
                          {/each}
                        </div>
                      </div>
                    {/if}

                    {#if app.internal_notes}
                      <div class="app-internal-notes-box">
                        <strong>Anotação da Avaliação:</strong>
                        <p>{app.internal_notes}</p>
                      </div>
                    {/if}
                  </div>

                  {#if ['OWNER', 'ADMIN'].includes(data.userRole)}
                    <div class="app-card-footer">
                      <button
                        type="button"
                        class="btn-review-action"
                        onclick={() => openReviewModal(app)}
                      >
                        <UserCheck size={14} />
                        <span>{app.status === 'PENDING' ? 'Avaliar Candidatura' : 'Alterar Avaliação'}</span>
                      </button>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-tab-state">
              <FileText size={36} />
              <h4>Nenhuma Candidatura Encontrada</h4>
              <p>Não há nenhuma candidatura nesta categoria no momento.</p>
            </div>
          {/if}
        </section>

      <!-- TAB PANE: CARGOS DA SCAN -->
      {:else if currentWorkspaceTab === 'positions' || activeDashTab === 'positions'}
        <section class="card-section">
          <div class="section-top space-between">
            <div class="section-title-wrap">
              <Tag size={18} />
              <h2>Cargos Editoriais da Scan ({positions.length})</h2>
            </div>
            {#if ['OWNER', 'ADMIN'].includes(data.userRole)}
              <button type="button" class="btn-sm-action primary" onclick={openCreatePositionModal}>
                <Plus size={14} />
                <span>Novo Cargo</span>
              </button>
            {/if}
          </div>

          <div class="callout-info-box">
            <ShieldCheck size={20} class="text-purple flex-shrink-0" />
            <div>
              <strong>Cargos Editoriais vs Permissões do Sistema</strong>
              <p>
                Os cargos editoriais (ex: <em>Tradutor</em>, <em>Clean/Redraw</em>, <em>Typer</em>, <em>Revisor (QC)</em>) definem as funções públicas dos membros e são exibidos nos perfis dos usuários como "Tradutor {settingsPreposition} {data.currentScan?.name}" e nos créditos das obras. A permissão técnica de acesso (Líder, Admin, Uploader, Staff) é gerenciada separadamente na aba <strong>Equipe</strong>.
              </p>
            </div>
          </div>

          <div class="positions-grid">
            {#each positions as pos (pos.id)}
              {@const membersInPos = team.filter((m: any) => m.positions?.some((p: any) => p.position_id === pos.id || p.name === pos.name)).length}
              <div class="pos-management-card">
                <div class="pos-card-header">
                  <div class="pos-card-title-group">
                    <span class="pos-name-tag">{pos.name}</span>
                    <span class="pos-preset-pill">
                      {pos.is_preset ? 'Padrão Nox' : 'Personalizado'}
                    </span>
                  </div>
                  {#if ['OWNER', 'ADMIN'].includes(data.userRole)}
                    <button
                      type="button"
                      class="btn-icon-sq"
                      title="Editar Cargo"
                      onclick={() => openEditPositionModal(pos)}
                    >
                      <Edit2 size={13} />
                    </button>
                  {/if}
                </div>

                {#if pos.description}
                  <p class="pos-card-desc">{pos.description}</p>
                {/if}

                <div class="pos-card-footer">
                  <span class="pos-members-count">
                    <Users size={12} />
                    <span>{membersInPos} membro{membersInPos === 1 ? '' : 's'} atribuído{membersInPos === 1 ? '' : 's'}</span>
                  </span>
                </div>
              </div>
            {/each}
          </div>
        </section>

      <!-- TAB PANE: MURAL DA STAFF (INTERNAL PRIVATE NOTES) -->
      {:else if currentWorkspaceTab === 'staff_notes' || activeDashTab === 'staff_notes'}
        <section class="card-section staff-notes-section">
          <div class="section-top space-between">
            <div class="section-title-wrap">
              <MessageSquare size={18} />
              <h2>Mural da Staff ({staffNotes.length})</h2>
            </div>
            <span class="staff-isolation-pill" title="Isolamento estrito: visível apenas para membros desta scan e administradores globais">
              <ShieldCheck size={13} />
              <span>Canal Interno Privado</span>
            </span>
          </div>

          <p class="section-sub-desc">
            Área de alinhamento e notas internas exclusivas para a equipe de <strong>{data.currentScan?.name}</strong>. Compartilhe orientações de tradução, avisos de capítulos, links de RAWs e recados internos.
          </p>

          <!-- Composer Card -->
          <form
            method="POST"
            action="?/postStaffNote"
            use:enhance={() => {
              isPostingStaffNote = true;
              return async ({ update }) => {
                isPostingStaffNote = false;
                newStaffNoteBody = '';
                newStaffNotePinned = false;
                await update();
              };
            }}
            class="staff-note-composer"
          >
            <input type="hidden" name="scan_id" value={data.currentScan?.id} />
            <div class="composer-body-area">
              <textarea
                name="body"
                rows="3"
                maxlength="4000"
                bind:value={newStaffNoteBody}
                placeholder="Escreva um comunicado, aviso ou nota para a equipe..."
                required
                class="dash-form-textarea"
              ></textarea>
            </div>
            <div class="composer-controls-row">
              {#if ['OWNER', 'ADMIN'].includes(data.userRole)}
                <label class="pin-checkbox-label">
                  <input
                    type="checkbox"
                    name="is_pinned"
                    value="true"
                    bind:checked={newStaffNotePinned}
                  />
                  <span>Fixar aviso no topo do mural</span>
                </label>
              {:else}
                <span class="composer-note-hint">Visível apenas para a staff de {data.currentScan?.name}</span>
              {/if}

              <button
                type="submit"
                class="btn-primary-action"
                disabled={isPostingStaffNote || !newStaffNoteBody.trim()}
              >
                <Send size={14} />
                <span>{isPostingStaffNote ? 'Publicando...' : 'Publicar no Mural'}</span>
              </button>
            </div>
          </form>

          <!-- Notes List -->
          {#if staffNotes.length > 0}
            <div class="staff-notes-list">
              {#each staffNotes as note (note.id)}
                <div class="staff-note-card" class:is-pinned={note.is_pinned}>
                  {#if note.is_pinned}
                    <div class="staff-pinned-badge">
                      <Pin size={12} />
                      <span>Comunicado Fixado</span>
                    </div>
                  {/if}

                  <div class="staff-note-header">
                    <div class="note-author-group">
                      <UserAvatar
                        avatarId={note.author?.avatar_id}
                        displayName={note.author?.display_name || note.author?.username || 'Membro'}
                        frameId={note.author?.avatar_frame_id}
                        size={36}
                      />
                      <div class="note-author-info">
                        <strong class="note-author-name">
                          {note.author?.display_name || note.author?.username || 'Membro da Staff'}
                        </strong>
                        <span class="note-meta-line">
                          @{note.author?.username || 'membro'} · {relativeTime(note.created_at)}
                        </span>
                      </div>
                    </div>

                    {#if note.canDelete}
                      <form
                        method="POST"
                        action="?/deleteStaffNote"
                        use:enhance={() => {
                          if (!confirm('Excluir esta nota do mural da staff?')) return () => {};
                          return async ({ update }) => { await update(); };
                        }}
                      >
                        <input type="hidden" name="note_id" value={note.id} />
                        <button
                          type="submit"
                          class="btn-delete-note"
                          title="Excluir nota"
                        >
                          <Trash2 size={14} />
                        </button>
                      </form>
                    {/if}
                  </div>

                  <p class="staff-note-content">{note.body}</p>
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-state-card">
              <MessageSquare size={36} />
              <h3>Nenhuma nota no mural</h3>
              <p>O mural está limpo! Use o formulário acima para compartilhar avisos, prazos ou recados com os colegas de equipe.</p>
            </div>
          {/if}
        </section>

      <!-- TAB PANE: HISTÓRICO DE ATIVIDADE -->
      {:else if currentWorkspaceTab === 'activity' || activeDashTab === 'activity'}
        <section class="card-section">
          <div class="section-top">
            <Activity size={18} />
            <h2>Histórico de Atividade & Auditoria ({activity.length})</h2>
          </div>

          {#if activity.length > 0}
            <div class="activity-timeline">
              {#each activity as act (act.id)}
                <div class="timeline-entry">
                  <div class="timeline-icon-wrap action-{act.action.toLowerCase()}">
                    {#if act.action === 'OPENING_CREATED'}
                      <Briefcase size={16} />
                    {:else if act.action === 'APPLICATION_RECEIVED'}
                      <FileText size={16} />
                    {:else if act.action === 'APPLICATION_STATUS'}
                      <CheckCircle2 size={16} />
                    {:else if act.action === 'MEMBER_ADDED'}
                      <UserCheck size={16} />
                    {:else}
                      <Activity size={16} />
                    {/if}
                  </div>
                  <div class="timeline-content">
                    <div class="timeline-msg-row">
                      {#if act.action === 'OPENING_CREATED'}
                        <p class="timeline-text">
                          Nova vaga aberta: <strong>{act.details?.title || act.details?.position_name}</strong>
                        </p>
                      {:else if act.action === 'APPLICATION_RECEIVED'}
                        <p class="timeline-text">
                          Nova candidatura recebida de <strong>{act.details?.applicant_name}</strong> para <strong>{act.details?.position_name}</strong>
                        </p>
                      {:else if act.action === 'APPLICATION_STATUS'}
                        <p class="timeline-text">
                          Candidatura de <strong>{act.details?.applicant_name}</strong> foi marcada como <span class="status-inline status-{(act.details?.status || '').toLowerCase()}">{act.details?.status}</span> por <strong>{act.details?.reviewed_by}</strong>
                        </p>
                      {:else if act.action === 'MEMBER_ADDED'}
                        <p class="timeline-text">
                          <strong>{act.details?.user_name}</strong> ingressou na equipe como <strong>{act.details?.position_name}</strong> (Aprovado por {act.details?.approved_by})
                        </p>
                      {:else}
                        <p class="timeline-text">{act.action}</p>
                      {/if}
                    </div>
                    <span class="timeline-time">{relativeTime(act.created_at)}</span>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-tab-state">
              <Activity size={36} />
              <h4>Nenhuma Atividade Registrada</h4>
              <p>As ações da equipe, aberturas de vagas e candidaturas serão registradas aqui em tempo real.</p>
            </div>
          {/if}
        </section>

      <!-- TAB PANE: CONFIGURAÇÕES -->
      {:else if (currentWorkspaceTab === 'settings' || currentWorkspaceTab === 'canais_config' || activeDashTab === 'settings') && ['OWNER', 'ADMIN'].includes(data.userRole)}
        <section class="card-section">
          <div class="section-top">
            <Settings size={18} />
            <h2>Configurações da Scan</h2>
          </div>

          {#if showSuccess}
            <div class="success-banner">
              <CheckCircle2 size={16} />
              <span>Configurações salvas com sucesso!</span>
            </div>
          {/if}

          {#if form?.message}
            <div class="error-banner">
              <AlertCircle size={16} />
              <span>{form.message}</span>
            </div>
          {/if}

          <form
            method="POST"
            action="?/updateProfile"
            use:enhance={() => {
              saving = true;
              return async ({ update }) => {
                saving = false;
                await update();
              };
            }}
            class="settings-form"
          >
            <input type="hidden" name="scan_id" value={data.currentScan.id} />

            <div class="form-field">
              <label for="desc">Descrição / Bio da Scan:</label>
              <textarea
                id="desc"
                name="description"
                rows="4"
                maxlength="2000"
                placeholder="Apresente sua scan para os leitores, gêneros preferidos, história do grupo..."
              >{data.currentScan.description || ''}</textarea>
            </div>

            <!-- Display Preposition with Live Preview -->
            <div class="form-field">
              <label for="prep">Preposição Gramatical para Títulos e Perfis:</label>
              <select
                id="prep"
                name="display_preposition"
                bind:value={settingsPreposition}
                class="form-select"
              >
                <option value="de">de — Ex: Tradutor de {data.currentScan.name}</option>
                <option value="da">da — Ex: Tradutor da {data.currentScan.name}</option>
                <option value="do">do — Ex: Tradutor do {data.currentScan.name}</option>
              </select>
              <div class="prep-live-preview">
                <span>Prévia no Perfil dos Membros:</span>
                <strong>Tradutor {settingsPreposition} {data.currentScan.name}</strong>
              </div>
            </div>

            <div class="form-row">
              <div class="form-field flex-1">
                <label for="discord">Link de Convite do Discord:</label>
                <input
                  id="discord"
                  name="discord"
                  type="url"
                  placeholder="https://discord.gg/..."
                  value={data.currentScan.discord || ''}
                />
              </div>

              <div class="form-field flex-1">
                <label for="website">Website Oficial (opcional):</label>
                <input
                  id="website"
                  name="website"
                  type="url"
                  placeholder="https://..."
                  value={data.currentScan.website || ''}
                />
              </div>
            </div>

            <button type="submit" class="btn-save" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </form>

          <div class="settings-divider"></div>
          <SettingsTab
            currentScan={data.currentScan}
            integrations={data.integrations}
            team={data.team}
            works={data.works}
            chapters={data.chapters}
            currentUserId={data.userId}
            userRole={data.userRole}
            isOwner={data.userRole === 'OWNER'}
            isOwnerOrAdmin={['OWNER', 'ADMIN'].includes(data.userRole)}
          />
        </section>

      <!-- TAB PANE: PIPELINE -->
      {:else if activeDashTab === 'pipeline'}
        <PipelineTab
          stages={data.stages || []}
          chapterStages={data.chapterStages || []}
          chapters={data.productionChapters || []}
          works={works}
          tasks={data.tasks || []}
          qcIssues={data.qcIssues || []}
          userRole={data.userRole}
          isOwnerOrAdmin={['OWNER', 'ADMIN'].includes(data.userRole)}
          onOpenChapter={handleOpenChapter}
        />

      <!-- TAB PANE: TAREFAS -->
      {:else if currentWorkspaceTab === 'tarefas' || activeDashTab === 'tasks'}
        <TasksTab
          tasks={data.tasks || []}
          stages={data.stages || []}
          chapterStages={data.chapterStages || []}
          productionChapters={data.productionChapters || []}
          productionFiles={data.productionFiles || []}
          chapterTimeline={data.chapterTimeline || []}
          workOverrides={data.workOverrides || []}
          creditSnapshots={data.creditSnapshots || []}
          team={team}
          positions={positions}
          works={works}
          currentUserId={data.userId}
          currentScanId={data.currentScan?.id || ''}
          userRole={data.userRole}
          isOwnerOrAdmin={['OWNER', 'ADMIN'].includes(data.userRole)}
          onOpenChapter={handleOpenChapter}
          initialView="ALL"
        />

      <!-- TAB PANE: CALENDÁRIO -->
      {:else if currentWorkspaceTab === 'calendario' || activeDashTab === 'calendar'}
        <CalendarTab
          tasks={data.tasks}
          chapters={data.chapters}
          team={data.team}
        />

      <!-- TAB PANE: ONBOARDING -->
      {:else if currentWorkspaceTab === 'onboarding' || activeDashTab === 'onboarding'}
        <OnboardingTab
          team={data.team}
          isOwnerOrAdmin={['OWNER', 'ADMIN'].includes(data.userRole)}
          scanId={data.currentScan?.id}
        />

      <!-- TAB PANE: GLOSSÁRIO -->
      {:else if currentWorkspaceTab === 'glossario' || activeDashTab === 'glossary'}
        <GlossaryTab
          glossary={data.glossary}
          works={data.works}
          scanId={data.currentScan?.id}
          isOwnerOrAdmin={['OWNER', 'ADMIN'].includes(data.userRole)}
          isUploader={data.userRole === 'UPLOADER'}
        />

      <!-- TAB PANE: REFERÊNCIAS -->
      {:else if currentWorkspaceTab === 'referencias' || activeDashTab === 'references'}
        <ReferencesTab
          references={data.references}
          works={data.works}
          scanId={data.currentScan?.id}
          isOwnerOrAdmin={['OWNER', 'ADMIN'].includes(data.userRole)}
          isUploader={data.userRole === 'UPLOADER'}
        />

      <!-- TAB PANE: WIKI -->
      {:else if currentWorkspaceTab === 'wiki' || activeDashTab === 'wiki'}
        <WikiTab
          wikiPages={data.wikiPages}
          isOwnerOrAdmin={['OWNER', 'ADMIN'].includes(data.userRole)}
          scanId={data.currentScan?.id}
        />

      <!-- TAB PANE: CHAT -->
      {:else if currentWorkspaceTab === 'chat' || activeDashTab === 'chat'}
        <ChatTab
          channels={data.channels || []}
          messages={data.messages || []}
          team={team}
          positions={positions}
          channelReadStates={data.channelReadStates || []}
          currentUserId={data.userId}
          currentScanId={data.currentScan?.id}
          isOwnerOrAdmin={['OWNER', 'ADMIN'].includes(data.userRole)}
          userRole={data.userRole}
          initialChannelId={page.url.searchParams.get('channelId') || ''}
        />

      <!-- TAB PANE: INBOX -->
      {:else if currentWorkspaceTab === 'inbox' || activeDashTab === 'inbox'}
        <InboxTab
          notifications={data.notifications || []}
          tasks={data.tasks || []}
          applications={applications}
          qcIssues={data.qcIssues || []}
          currentUserId={data.userId}
          isOwnerOrAdmin={['OWNER', 'ADMIN'].includes(data.userRole)}
        />

      <!-- TAB PANE: QC -->
      {:else if currentWorkspaceTab === 'qc' || activeDashTab === 'qc'}
        <QCTab
          qcIssues={data.qcIssues || []}
          chapters={chapters}
          works={works}
          team={team}
          currentUserId={data.userId}
          isOwnerOrAdmin={['OWNER', 'ADMIN'].includes(data.userRole)}
        />

      <!-- TAB PANE: WORKLOAD -->
      {:else if currentWorkspaceTab === 'workload' || activeDashTab === 'workload'}
        <WorkloadTab
          team={team}
          tasks={data.tasks || []}
          memberPositions={data.memberPositions || []}
          currentUserId={data.userId}
          isOwnerOrAdmin={['OWNER', 'ADMIN'].includes(data.userRole)}
        />

      <!-- TAB PANE: ACADEMIA -->
      {:else if currentWorkspaceTab === 'tutoriais' || activeDashTab === 'academia'}
        <AcademiaTab
          tutorials={data.tutorials || []}
          attachments={data.attachments || []}
          positions={positions}
          isOwnerOrAdmin={['OWNER', 'ADMIN'].includes(data.userRole)}
          scanName={data.currentScan?.name || 'Scan'}
          currentScanId={data.currentScan?.id || ''}
        />

      <!-- TAB PANE: ANALYTICS -->
      {:else if currentWorkspaceTab === 'analytics' || activeDashTab === 'analytics'}
        <AnalyticsTab
          works={data.works}
          chapters={data.chapters}
          team={data.team}
          totalViews={data.totalViews}
          currentScan={data.currentScan}
        />
      {/if}

      <WorkspaceCommandPalette
        isOpen={showCommandPalette}
        works={works}
        chapters={chapters}
        tasks={data.tasks || []}
        tutorials={data.tutorials || []}
        wikiPages={data.wikiPages || []}
        channels={data.channels || []}
        team={team}
        onSelect={(type, id) => {
          if (type === 'OPEN_PALETTE') {
            showCommandPalette = true;
          } else if (type === 'action') {
            if (id === 'tab-inbox') handleSelectTab('inbox');
            else if (id === 'tab-chat') handleSelectTab('chat');
            else if (id === 'tab-pipeline') handleSelectTab('pipeline');
            else if (id === 'tab-tasks') handleSelectTab('tarefas');
            else if (id === 'tab-team') handleSelectTab('membros');
            else if (id === 'tab-academia') handleSelectTab('tutoriais');
            else if (id === 'tab-mural') handleSelectTab('mural');
            else if (id === 'tab-home') handleSelectTab('home');
            showCommandPalette = false;
          } else if (type === 'chapter') {
            const ch = (data.productionChapters || []).find((c: any) => c.id === id || c.target_chapter_id === id) || chapters.find((c: any) => c.id === id);
            if (ch) activeWorkspaceChapter = ch;
            showCommandPalette = false;
          }
        }}
        onClose={() => (showCommandPalette = false)}
      />
    </div>
  </div>
</div>
{/if}

  <!-- Modals -->
  {#if showInviteModal}
    <div class="modal-backdrop" onclick={() => (showInviteModal = false)}>
      <div class="modal-card mini-modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2 class="modal-title">Gerar Convite de Equipe</h2>
          <button class="btn-close-modal" onclick={() => (showInviteModal = false)}><X size={18} /></button>
        </div>
        <form
          method="POST"
          action="?/createInvite"
          use:enhance={() => {
            inviteSubmitting = true;
            return async ({ update }) => {
              inviteSubmitting = false;
              showInviteModal = false;
              await update();
            };
          }}
          class="modal-form"
        >
          <input type="hidden" name="scan_id" value={data.currentScan?.id} />
          <div class="form-field">
            <label for="inv-role">Cargo Concedido:</label>
            <select id="inv-role" name="role" bind:value={inviteRole} class="form-select">
              <option value="MEMBER">Membro / Tradutor</option>
              <option value="UPLOADER">Uploader / Revisor</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          <div class="form-field">
            <label for="inv-hours">Validade do Link:</label>
            <select id="inv-hours" name="hours" bind:value={inviteHours} class="form-select">
              <option value={24}>24 Horas (1 dia)</option>
              <option value={48}>48 Horas (2 dias)</option>
              <option value={168}>7 Dias</option>
              <option value={720}>30 Dias</option>
            </select>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick={() => (showInviteModal = false)}>Cancelar</button>
            <button type="submit" class="btn-primary" disabled={inviteSubmitting}>
              <Plus size={15} />
              <span>{inviteSubmitting ? 'Gerando...' : 'Gerar Convite'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  {#if showProjectModal}
    <div class="modal-backdrop" onclick={() => (showProjectModal = false)}>
      <div class="modal-card mini-modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2 class="modal-title">Solicitar Obra do Catálogo</h2>
          <button class="btn-close-modal" onclick={() => (showProjectModal = false)}><X size={18} /></button>
        </div>
        <form
          method="POST"
          action="?/requestProject"
          use:enhance={() => {
            projectSubmitting = true;
            return async ({ update }) => {
              projectSubmitting = false;
              showProjectModal = false;
              await update();
            };
          }}
          class="modal-form"
        >
          <input type="hidden" name="scan_id" value={data.currentScan?.id} />
          <div class="form-field">
            <label for="proj-work">Selecione a Obra Desejada:</label>
            <select id="proj-work" name="work_id" bind:value={selectedWorkId} required class="form-select">
              <option value="" disabled>Escolha uma obra...</option>
              {#each data.catalogWorks as w}
                <option value={w.id}>{w.title}</option>
              {/each}
            </select>
          </div>
          <div class="form-field">
            <label for="proj-msg">Mensagem / Justificativa (Opcional):</label>
            <textarea
              id="proj-msg"
              name="message"
              rows={3}
              bind:value={projectMessage}
              placeholder="Ex: Nossa equipe já traduz essa obra há 2 anos e gostaríamos de vincular nossos lançamentos..."
              class="form-textarea"
            ></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick={() => (showProjectModal = false)}>Cancelar</button>
            <button type="submit" class="btn-primary" disabled={projectSubmitting || !selectedWorkId}>
              <Send size={15} />
              <span>{projectSubmitting ? 'Enviando...' : 'Enviar Solicitação'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  {#if transferTarget}
    <div class="modal-backdrop" onclick={() => (transferTarget = null)}>
      <div class="modal-card mini-modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2 class="modal-title">Transferir Liderança</h2>
          <button class="btn-close-modal" onclick={() => (transferTarget = null)}><X size={18} /></button>
        </div>
        <form
          method="POST"
          action="?/transferOwnership"
          use:enhance={() => {
            transferSubmitting = true;
            return async ({ update }) => {
              transferSubmitting = false;
              transferTarget = null;
              await update();
            };
          }}
          class="modal-form"
        >
          <input type="hidden" name="scan_id" value={data.currentScan?.id} />
          <input type="hidden" name="target_user_id" value={transferTarget.id} />
          <div class="warning-alert-box">
            <AlertTriangle size={24} class="warning-alert-icon" />
            <div>
              <strong>Atenção: Confirmação em duas etapas</strong>
              <p>
                Você está prestes a propor a transferência de liderança da scan <strong>{data.currentScan?.name}</strong> para
                <strong>{transferTarget.display_name || transferTarget.username}</strong> (@{transferTarget.username}).
                O membro receberá um alerta e precisará aceitar a transferência para se tornar o novo Dono.
              </p>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick={() => (transferTarget = null)}>Cancelar</button>
            <button type="submit" class="btn-primary" disabled={transferSubmitting}>
              <Crown size={15} />
              <span>{transferSubmitting ? 'Enviando Proposta...' : 'Enviar Proposta de Transferência'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  {#if removeTarget}
    <div class="modal-backdrop" onclick={() => (removeTarget = null)}>
      <div class="modal-card mini-modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2 class="modal-title">Remover Membro da Scan</h2>
          <button class="btn-close-modal" onclick={() => (removeTarget = null)}><X size={18} /></button>
        </div>
        <form
          method="POST"
          action="?/removeMember"
          use:enhance={() => {
            removeSubmitting = true;
            return async ({ update }) => {
              removeSubmitting = false;
              removeTarget = null;
              await update();
            };
          }}
          class="modal-form"
        >
          <input type="hidden" name="scan_id" value={data.currentScan?.id} />
          <input type="hidden" name="user_id" value={removeTarget.id} />
          <input type="hidden" name="resolution" value="RETURN_TO_QUEUE" />
          <div class="warning-alert-box danger">
            <UserMinus size={24} class="warning-alert-icon text-red" />
            <div>
              <strong>Remover {removeTarget.display_name || removeTarget.username}?</strong>
              <p>
                Tem certeza que deseja remover <strong>{removeTarget.display_name || removeTarget.username}</strong> (@{removeTarget.username}) desta Scan?
              </p>
              <p class="mt-2 text-xs text-slate-400">
                • A conta global do usuário, histórico e créditos permanecem 100% preservados.<br/>
                • Quaisquer tarefas ativas atribuídas a ele retornarão automaticamente para a fila da Scan como <strong>Disponível</strong>, para que outro membro possa continuá-las sem perda de progresso.
              </p>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick={() => (removeTarget = null)}>Cancelar</button>
            <button type="submit" class="btn-danger-action" disabled={removeSubmitting}>
              <UserMinus size={15} />
              <span>{removeSubmitting ? 'Removendo...' : 'Confirmar Remoção'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  {#if showOpeningModal}
    <div class="modal-backdrop" onclick={() => (showOpeningModal = false)}>
      <div class="modal-card mini-modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2 class="modal-title">{editingOpening ? 'Editar Vaga de Recrutamento' : 'Nova Vaga de Recrutamento'}</h2>
          <button class="btn-close-modal" onclick={() => (showOpeningModal = false)}><X size={18} /></button>
        </div>
        <form
          method="POST"
          action="?/manageOpening"
          use:enhance={() => {
            openingSubmitting = true;
            return async ({ update }) => {
              openingSubmitting = false;
              showOpeningModal = false;
              await update();
            };
          }}
          class="modal-form"
        >
          <input type="hidden" name="scan_id" value={data.currentScan?.id} />
          {#if editingOpening}
            <input type="hidden" name="opening_id" value={editingOpening.id} />
          {/if}

          <div class="form-field">
            <label for="op-pos">Cargo da Vaga *:</label>
            <select id="op-pos" name="position_id" bind:value={openingPosId} required class="form-select">
              {#each positions as pos}
                <option value={pos.id}>{pos.name}</option>
              {/each}
            </select>
          </div>

          <div class="form-field">
            <label for="op-title">Título da Vaga (opcional):</label>
            <input
              id="op-title"
              name="title"
              type="text"
              bind:value={openingTitle}
              placeholder="Ex: Tradutor Japonês/Inglês -> PT-BR"
            />
          </div>

          <div class="form-row">
            <div class="form-field flex-1">
              <label for="op-exp">Nível de Experiência:</label>
              <select id="op-exp" name="experience_level" bind:value={openingExpLevel} class="form-select">
                <option value="QUALQUER">Qualquer Nível</option>
                <option value="INICIANTE">Iniciante (Treinamos)</option>
                <option value="INTERMEDIARIO">Intermediário</option>
                <option value="AVANCADO">Avançado / Veterano</option>
              </select>
            </div>

            <div class="form-field flex-1">
              <label for="op-slots">Número de Vagas:</label>
              <input
                id="op-slots"
                name="slots"
                type="number"
                min="1"
                bind:value={openingSlots}
                placeholder="Ex: 2 (deixe vazio para contínuas)"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-field flex-1">
              <label for="op-avail">Disponibilidade Esperada:</label>
              <input
                id="op-avail"
                name="availability"
                type="text"
                bind:value={openingAvail}
                placeholder="Ex: 2 a 3 capítulos por semana"
              />
            </div>

            <div class="form-field flex-1">
              <label for="op-status">Status da Vaga:</label>
              <select id="op-status" name="status" bind:value={openingStatus} class="form-select">
                <option value="OPEN">Aberta (Recebendo)</option>
                <option value="PAUSED">Pausada</option>
                <option value="CLOSED">Encerrada</option>
              </select>
            </div>
          </div>

          <div class="form-field">
            <label for="op-reqs">Requisitos Mínimos & Ferramentas:</label>
            <textarea
              id="op-reqs"
              name="requirements"
              rows={3}
              bind:value={openingReqs}
              placeholder="Ex: Domínio de gramática PT-BR, noções básicas de Photoshop, pontualidade..."
              class="form-textarea"
            ></textarea>
          </div>

          <div class="form-field">
            <label for="op-desc">Descrição / Atividades:</label>
            <textarea
              id="op-desc"
              name="description"
              rows={2}
              bind:value={openingDesc}
              placeholder="Descreva as responsabilidades e como a equipe trabalha..."
              class="form-textarea"
            ></textarea>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick={() => (showOpeningModal = false)}>Cancelar</button>
            <button type="submit" class="btn-primary" disabled={openingSubmitting || !openingPosId}>
              <Plus size={15} />
              <span>{openingSubmitting ? 'Salvando...' : (editingOpening ? 'Salvar Vaga' : 'Publicar Vaga')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  {#if reviewingApp}
    {@const appAnswers = (data.applicationAnswers || []).filter((a: any) => a.application_id === reviewingApp.id)}
    <div class="modal-backdrop" onclick={() => (reviewingApp = null)}>
      <div class="modal-card" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2 class="modal-title">Avaliar Candidatura</h2>
          <button class="btn-close-modal" onclick={() => (reviewingApp = null)}><X size={18} /></button>
        </div>

        <div class="review-candidate-summary">
          <div class="review-candidate-profile">
            <UserAvatar
              avatarId={reviewingApp.members?.avatar_id}
              displayName={reviewingApp.members?.display_name || reviewingApp.members?.username}
              size={44}
            />
            <div>
              <strong>{reviewingApp.members?.display_name || reviewingApp.members?.username}</strong>
              <span class="user-handle">@{reviewingApp.members?.username}</span>
            </div>
          </div>
          <div class="review-vac-badge">
            <span>Vaga:</span>
            <strong>{reviewingApp.scan_recruitment_openings?.title || reviewingApp.scan_positions?.name}</strong>
          </div>
        </div>

        <div class="review-app-body">
          {#if reviewingApp.presentation}
            <div class="review-info-item">
              <span class="item-label">Apresentação:</span>
              <p>{reviewingApp.presentation}</p>
            </div>
          {/if}

          {#if reviewingApp.experience}
            <div class="review-info-item">
              <span class="item-label">Experiência:</span>
              <p>{reviewingApp.experience}</p>
            </div>
          {/if}

          {#if reviewingApp.availability}
            <div class="review-info-item">
              <span class="item-label">Disponibilidade:</span>
              <p>{reviewingApp.availability}</p>
            </div>
          {/if}

          {#if reviewingApp.contact_info}
            <div class="review-info-item">
              <span class="item-label">Contato / Discord:</span>
              <p class="font-mono">{reviewingApp.contact_info}</p>
            </div>
          {/if}

          {#if reviewingApp.portfolio_url}
            <div class="review-info-item">
              <a
                href={reviewingApp.portfolio_url}
                target="_blank"
                rel="noopener noreferrer"
                class="portfolio-link-btn"
              >
                <ExternalLink size={13} />
                <span>Abrir Link do Portfólio / Teste ↗</span>
              </a>
            </div>
          {/if}

          {#if appAnswers.length > 0}
            <div class="review-info-item">
              <span class="item-label">Respostas ao Questionário da Vaga:</span>
              <div class="review-qa-list">
                {#each appAnswers as ans}
                  <div class="review-qa-entry">
                    <span class="qa-q-text">{ans.question?.question || 'Pergunta'}:</span>
                    <p class="qa-a-text">{ans.answer}</p>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <form
          method="POST"
          action="?/reviewApplication"
          use:enhance={() => {
            reviewSubmitting = true;
            return async ({ update }) => {
              reviewSubmitting = false;
              reviewingApp = null;
              await update();
            };
          }}
          class="modal-form review-form"
        >
          <input type="hidden" name="application_id" value={reviewingApp.id} />

          <div class="form-field">
            <label for="rev-action">Decisão da Avaliação *:</label>
            <div class="decision-radios">
              <label class="decision-radio-label approve" class:active={reviewAction === 'APPROVE'}>
                <input type="radio" name="action" value="APPROVE" bind:group={reviewAction} />
                <span>✓ Aprovar Candidato</span>
              </label>
              <label class="decision-radio-label under-review" class:active={reviewAction === 'UNDER_REVIEW'}>
                <input type="radio" name="action" value="UNDER_REVIEW" bind:group={reviewAction} />
                <span>⌛ Em Análise / Teste</span>
              </label>
              <label class="decision-radio-label reject" class:active={reviewAction === 'REJECT'}>
                <input type="radio" name="action" value="REJECT" bind:group={reviewAction} />
                <span>✗ Recusar</span>
              </label>
            </div>
          </div>

          {#if reviewAction === 'APPROVE'}
            <div class="approve-options-box">
              <label class="checkbox-container">
                <input type="checkbox" name="add_to_team" value="true" bind:checked={reviewAddToTeam} />
                <span class="checkbox-label">
                  Adicionar automaticamente à equipe da scan com o cargo <strong>{reviewingApp.scan_positions?.name}</strong>
                </span>
              </label>

              {#if reviewAddToTeam}
                <div class="form-field mt-2">
                  <label for="rev-role">Nível de Acesso Técnico:</label>
                  <select id="rev-role" name="initial_role" bind:value={reviewInitialRole} class="form-select">
                    <option value="MEMBER">Staff (Padrão editorial)</option>
                    <option value="UPLOADER">Uploader (Permissão para postar capítulos)</option>
                    <option value="ADMIN">Admin da Scan (Gestão de membros e vagas)</option>
                  </select>
                </div>
              {/if}
            </div>
          {/if}

          <div class="form-field">
            <label for="rev-notes">Feedback / Anotação Interna:</label>
            <textarea
              id="rev-notes"
              name="notes"
              rows={2}
              bind:value={reviewNotes}
              placeholder="Ex: Aprovado no teste de edição. Contato realizado pelo Discord..."
              class="form-textarea"
            ></textarea>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick={() => (reviewingApp = null)}>Cancelar</button>
            <button type="submit" class="btn-primary" disabled={reviewSubmitting}>
              <UserCheck size={15} />
              <span>{reviewSubmitting ? 'Salvando...' : 'Confirmar Avaliação'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  {#if showPositionModal}
    <div class="modal-backdrop" onclick={() => (showPositionModal = false)}>
      <div class="modal-card mini-modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2 class="modal-title">{editingPosition ? 'Editar Cargo Editorial' : 'Criar Novo Cargo Editorial'}</h2>
          <button class="btn-close-modal" onclick={() => (showPositionModal = false)}><X size={18} /></button>
        </div>
        <form
          method="POST"
          action="?/managePosition"
          use:enhance={() => {
            positionSubmitting = true;
            return async ({ update }) => {
              positionSubmitting = false;
              showPositionModal = false;
              await update();
            };
          }}
          class="modal-form"
        >
          <input type="hidden" name="scan_id" value={data.currentScan?.id} />
          {#if editingPosition}
            <input type="hidden" name="position_id" value={editingPosition.id} />
          {/if}

          <div class="form-field">
            <label for="pos-name">Nome do Cargo *:</label>
            <input
              id="pos-name"
              name="name"
              type="text"
              required
              bind:value={posName}
              placeholder="Ex: Revisor (QC), Typer, Clean/Redraw"
            />
          </div>

          <div class="form-field">
            <label for="pos-desc">Descrição das Funções:</label>
            <textarea
              id="pos-desc"
              name="description"
              rows={3}
              bind:value={posDesc}
              placeholder="Descreva o que este membro faz na equipe..."
              class="form-textarea"
            ></textarea>
          </div>

          <div class="form-field">
            <label for="pos-order">Ordem de Exibição:</label>
            <input
              id="pos-order"
              name="display_order"
              type="number"
              bind:value={posDisplayOrder}
            />
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick={() => (showPositionModal = false)}>Cancelar</button>
            <button type="submit" class="btn-primary" disabled={positionSubmitting || !posName}>
              <Plus size={15} />
              <span>{positionSubmitting ? 'Salvando...' : (editingPosition ? 'Salvar Alterações' : 'Criar Cargo')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  {#if editingMember}
    <div class="modal-backdrop" onclick={() => (editingMember = null)}>
      <div class="modal-card member-management-modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <div class="modal-header-profile">
            <UserAvatar
              avatarId={editingMember.avatar_id}
              displayName={editingMember.display_name || editingMember.username}
              size={42}
            />
            <div class="modal-header-titles">
              <h2 class="modal-title">Gerenciar Membro</h2>
              <span class="modal-subtitle">{editingMember.display_name || editingMember.username} (@{editingMember.username})</span>
            </div>
          </div>
          <button class="btn-close-modal" onclick={() => (editingMember = null)}><X size={18} /></button>
        </div>

        <form
          method="POST"
          action="?/manageScanMember"
          use:enhance={() => {
            manageMemberSubmitting = true;
            manageMemberError = null;
            return async ({ result, update }) => {
              manageMemberSubmitting = false;
              if (result.type === 'failure') {
                manageMemberError = result.data?.message || 'Erro ao atualizar membro.';
              } else if (result.type === 'success') {
                if (result.data?.requiresConfirmation) {
                  manageMemberWarning = result.data.warning;
                } else {
                  editingMember = null;
                  await update();
                }
              }
            };
          }}
          class="modal-form-body"
        >
          <input type="hidden" name="scan_id" value={data.currentScan?.id} />
          <input type="hidden" name="user_id" value={editingMember.id} />
          <input type="hidden" name="role" value={editingRole} />
          <input type="hidden" name="position_ids" value={JSON.stringify(editingPositionIds)} />
          {#if manageMemberWarning}
            <input type="hidden" name="confirm_last_manager" value="true" />
          {/if}

          {#if manageMemberError}
            <div class="modal-alert-error">
              <AlertCircle size={16} />
              <span>{manageMemberError}</span>
            </div>
          {/if}

          {#if manageMemberWarning}
            <div class="modal-alert-warning">
              <AlertTriangle size={18} class="text-amber-400" />
              <div>
                <strong>Atenção: Último Gerente da Scan</strong>
                <p>{manageMemberWarning}</p>
                <p class="text-xs text-amber-300/80 mt-1">Clique em "Salvar Alterações" novamente para confirmar o rebaixamento.</p>
              </div>
            </div>
          {/if}

          <!-- SECTION 1: FUNÇÃO ADMINISTRATIVA -->
          <div class="manage-section">
            <div class="section-label-row">
              <span class="section-num-tag">1</span>
              <div>
                <h3 class="manage-section-heading">Função na Scan (Nível Administrativo)</h3>
                <p class="manage-section-hint">Define os privilégios operacionais e administrativos da pessoa dentro da Scan.</p>
              </div>
            </div>

            {#if editingMember.role === 'OWNER' || editingMember.id === data.currentScan?.owner_id}
              <div class="func-status-card owner-mode">
                <div class="func-status-icon">👑</div>
                <div class="func-status-details">
                  <div class="func-status-title-row">
                    <strong>Dono</strong>
                    <span class="badge-role-fixed">Líder Supremo</span>
                  </div>
                  <p>Criador e líder supremo da Scan. Possui autoridade máxima, permissões totais e bypass administrativo permanente. Esta função é exclusiva e imutável.</p>
                </div>
              </div>
            {:else if data.userRole === 'OWNER'}
              <!-- Owner can promote/demote between Staff and Gerente -->
              <div class="function-selection-grid">
                <label class="function-choice-card" class:selected={editingRole === 'MEMBER'}>
                  <input
                    type="radio"
                    name="admin_role_radio"
                    value="MEMBER"
                    checked={editingRole === 'MEMBER'}
                    onchange={() => (editingRole = 'MEMBER')}
                  />
                  <div class="choice-content">
                    <div class="choice-title-row">
                      <span class="choice-emoji">👤</span>
                      <strong class="choice-title">Staff</strong>
                      {#if editingRole === 'MEMBER'}<Check size={14} class="choice-check" />{/if}
                    </div>
                    <p class="choice-desc">Membro regular da equipe. Assume e executa etapas da Pipeline estritamente de acordo com seus cargos editoriais.</p>
                  </div>
                </label>

                <label class="function-choice-card" class:selected={editingRole === 'ADMIN'}>
                  <input
                    type="radio"
                    name="admin_role_radio"
                    value="ADMIN"
                    checked={editingRole === 'ADMIN'}
                    onchange={() => (editingRole = 'ADMIN')}
                  />
                  <div class="choice-content">
                    <div class="choice-title-row">
                      <span class="choice-emoji">🛡️</span>
                      <strong class="choice-title">Gerente</strong>
                      {#if editingRole === 'ADMIN'}<Check size={14} class="choice-check" />{/if}
                    </div>
                    <p class="choice-desc">Acesso administrativo. Gerencia equipe, recrutamento, distribuição de tarefas, intervenções e aprovação de capítulos.</p>
                  </div>
                </label>
              </div>
            {:else}
              <!-- Gerente viewing Staff/Gerente (read-only for administrative function) -->
              <div class="func-status-card readonly-mode">
                <div class="func-status-icon">
                  {editingMember.role === 'ADMIN' ? '🛡️' : '👤'}
                </div>
                <div class="func-status-details">
                  <div class="func-status-title-row">
                    <strong>{editingMember.role === 'ADMIN' ? 'Gerente' : 'Staff'}</strong>
                    <span class="badge-role-readonly">Função Atual</span>
                  </div>
                  <p>Apenas o Dono da Scan possui autorização para promover membros a Gerente ou rebaixá-los para Staff.</p>
                </div>
              </div>
            {/if}
          </div>

          <!-- SECTION 2: CARGOS EDITORIAIS OFICIAIS -->
          <div class="manage-section">
            <div class="section-label-row">
              <span class="section-num-tag">2</span>
              <div>
                <h3 class="manage-section-heading">Cargos Editoriais (Trabalhos no Pipeline)</h3>
                <p class="manage-section-hint">Selecione quais trabalhos este membro pode assumir no pipeline da Scan. As permissões se somam:</p>
              </div>
            </div>

            <div class="positions-selection-list">
              {#each positions as pos}
                {@const isChecked = editingPositionIds.includes(pos.id)}
                <label class="position-checkbox-item" class:checked={isChecked}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onchange={() => togglePosition(pos.id)}
                  />
                  <div class="custom-checkbox" class:active={isChecked}>
                    {#if isChecked}<Check size={13} strokeWidth={3} />{/if}
                  </div>
                  <span class="pos-item-emoji">{getPositionIcon(pos.name)}</span>
                  <div class="pos-item-text">
                    <strong class="pos-item-name">{pos.name}</strong>
                    {#if pos.description}
                      <span class="pos-item-desc">{pos.description}</span>
                    {/if}
                  </div>
                </label>
              {/each}
            </div>
          </div>

          <!-- FOOTER ACTIONS -->
          <div class="manage-modal-footer">
            <div class="footer-left">
              {#if canRemoveMember(data.userRole, editingMember.role)}
                <button
                  type="button"
                  class="btn-modal-remove-member"
                  onclick={() => {
                    const target = editingMember;
                    editingMember = null;
                    removeTarget = target;
                  }}
                  title="Remover membro da equipe"
                >
                  <UserMinus size={14} />
                  <span>Remover da Scan</span>
                </button>
              {/if}
            </div>

            <div class="footer-right">
              <button
                type="button"
                class="btn-secondary"
                onclick={() => (editingMember = null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                class="btn-primary"
                disabled={manageMemberSubmitting}
              >
                {#if manageMemberSubmitting}
                  <span class="spinner-xs"></span>
                  <span>Salvando...</span>
                {:else}
                  <Check size={15} />
                  <span>Salvar Alterações</span>
                {/if}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  {/if}

<style>
  .scan-dashboard-page {
    min-height: 100vh;
    padding: 2.5rem 1.5rem 5rem;
    color: #e2e8f0;
  }

  .dashboard-container {
    max-width: 1440px;
    margin: 0 auto;
  }

  /* Modern Workspace App Shell */
  .workspace-app-shell {
    display: flex;
    min-height: 100vh;
    background: #05040a;
    color: #e2e8f0;
    overflow-x: hidden;
  }

  .workspace-main-area {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .workspace-mobile-topbar {
    display: none;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: #08060f;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    position: sticky;
    top: 0;
    z-index: 30;
  }

  @media (max-width: 1024px) {
    .workspace-mobile-topbar {
      display: flex;
    }
  }

  .btn-hamburger,
  .btn-search-mobile {
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #cbd5e1;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-hamburger:hover,
  .btn-search-mobile:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .mobile-scan-brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .mobile-scan-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: #f8fafc;
  }

  .mobile-scan-role {
    font-size: 0.65rem;
    font-weight: 600;
    color: #a855f7;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .workspace-view-content {
    flex: 1;
    min-width: 0;
    padding: 24px;
  }

  @media (max-width: 768px) {
    .workspace-view-content {
      padding: 14px 10px;
    }
  }

  /* Unauthenticated */
  .onboarding-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 6rem 2rem;
    background: radial-gradient(circle at top, rgba(139, 92, 246, 0.15), transparent 70%), #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
  }

  .hero-icon-ring {
    width: 90px;
    height: 90px;
    border-radius: 50%;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c4b5fd;
    margin-bottom: 1.5rem;
  }

  .onboarding-title {
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 2.4rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.75rem;
  }

  .onboarding-sub {
    font-size: 1.05rem;
    color: #94a3b8;
    max-width: 580px;
    line-height: 1.6;
    margin: 0 0 2rem;
  }

  .onboarding-actions {
    display: flex;
    gap: 1rem;
  }

  .btn-primary {
    padding: 0.85rem 2rem;
    background: #8b5cf6;
    color: #ffffff;
    border-radius: 12px;
    font-weight: 700;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-primary:hover {
    background: #7c3aed;
    box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
  }

  .btn-secondary {
    padding: 0.85rem 2rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
    border-radius: 12px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  /* Partnership Portal */
  .partnership-portal {
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
  }

  .portal-header {
    text-align: center;
    max-width: 800px;
    margin: 0 auto;
  }

  .badge-partnership {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.85rem;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.35);
    border-radius: 9999px;
    color: #dfc28d;
    font-size: 0.82rem;
    font-weight: 700;
    margin-bottom: 1rem;
  }

  .portal-title {
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 2.4rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 1rem;
    letter-spacing: -0.02em;
  }

  .portal-sub {
    font-size: 1.05rem;
    color: #94a3b8;
    line-height: 1.6;
    margin: 0;
  }

  .perks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .perk-card {
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 16px;
    padding: 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .perk-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(139, 92, 246, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c4b5fd;
    margin-bottom: 0.25rem;
  }

  .perk-card h3 {
    font-size: 1.15rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .perk-card p {
    font-size: 0.9rem;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0;
  }

  .cta-box {
    background: radial-gradient(circle at top center, rgba(139, 92, 246, 0.2), transparent 70%), #0e111d;
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 20px;
    padding: 3rem 2rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .cta-box h2 {
    font-size: 1.8rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
  }

  .cta-box p {
    font-size: 1rem;
    color: #cbd5e1;
    max-width: 600px;
    line-height: 1.6;
    margin: 0 0 0.5rem;
  }

  .btn-discord-cta {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.9rem 2.2rem;
    background: #5865f2;
    color: #ffffff;
    border-radius: 12px;
    font-weight: 700;
    font-size: 0.95rem;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-discord-cta:hover {
    background: #4752c4;
    box-shadow: 0 6px 24px rgba(88, 101, 242, 0.45);
    transform: translateY(-2px);
  }

  /* Active Dashboard */
  .dash-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1.5rem;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-wrap: wrap;
  }

  .header-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: #dfc28d;
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.4rem;
  }

  .dash-main-title {
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 2.2rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.5rem;
  }

  .dash-role-row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .role-badge {
    padding: 0.25rem 0.65rem;
    background: rgba(139, 92, 246, 0.2);
    border: 1px solid rgba(139, 92, 246, 0.35);
    border-radius: 6px;
    color: #c4b5fd;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .link-public-profile {
    font-size: 0.85rem;
    color: #94a3b8;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .link-public-profile:hover {
    color: #dfc28d;
  }

  .scan-switcher {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .scan-switcher select {
    padding: 0.5rem 1rem;
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: #ffffff;
    font-size: 0.88rem;
    outline: none;
  }

  /* Stats overview */
  .stats-overview {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1.25rem;
    margin-bottom: 2.5rem;
  }

  .stat-card {
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 1.25rem 1.5rem;
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }

  :global(.stat-icon) {
    color: #dfc28d;
  }

  .stat-meta {
    display: flex;
    flex-direction: column;
  }

  .stat-num {
    font-size: 1.6rem;
    font-weight: 800;
    color: #ffffff;
    line-height: 1.1;
  }

  .stat-desc {
    font-size: 0.8rem;
    color: #94a3b8;
    margin-top: 0.2rem;
  }

  /* Columns */
  .dash-columns {
    display: grid;
    grid-template-columns: 1fr 1.25fr;
    gap: 2rem;
  }

  .dash-col-left,
  .dash-col-right {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .card-section {
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 16px;
    padding: 1.5rem;
  }

  .section-top {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 1.25rem;
    color: #dfc28d;
  }

  .section-top h2 {
    font-size: 1.15rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .settings-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .form-field label {
    font-size: 0.85rem;
    color: #cbd5e1;
    font-weight: 600;
  }

  .form-field input,
  .form-field textarea {
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: #ffffff;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.2s ease;
  }

  .form-field input:focus,
  .form-field textarea:focus {
    border-color: #8b5cf6;
  }

  .btn-save {
    padding: 0.75rem 1.5rem;
    background: #8b5cf6;
    color: #ffffff;
    border: none;
    border-radius: 10px;
    font-weight: 700;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
    align-self: flex-start;
    margin-top: 0.5rem;
  }

  .btn-save:hover {
    background: #7c3aed;
  }

  .success-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 8px;
    color: #6ee7b7;
    font-size: 0.88rem;
    margin-bottom: 1rem;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: #fca5a5;
    font-size: 0.88rem;
    margin-bottom: 1rem;
  }

  /* Team */
  .team-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .team-member-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0.85rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 10px;
  }

  .member-text {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .member-display {
    font-size: 0.9rem;
    font-weight: 700;
    color: #ffffff;
  }

  .member-user {
    font-size: 0.75rem;
    color: #64748b;
  }

  .role-pill {
    padding: 0.2rem 0.5rem;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    font-size: 0.72rem;
    color: #cbd5e1;
  }

  /* Works List */
  .works-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .dash-work-item {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.6rem 0.85rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 10px;
    text-decoration: none;
    color: inherit;
    transition: all 0.2s ease;
  }

  .dash-work-item:hover {
    background: rgba(255, 255, 255, 0.07);
    transform: translateX(3px);
  }

  .work-mini-cover {
    width: 36px;
    height: 50px;
    border-radius: 6px;
    object-fit: cover;
  }

  .work-mini-placeholder {
    width: 36px;
    height: 50px;
    border-radius: 6px;
    background: #1e1b4b;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 700;
    color: #c4b5fd;
  }

  .work-mini-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    gap: 0.2rem;
  }

  .work-mini-title {
    font-size: 0.92rem;
    font-weight: 700;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .work-mini-views {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    color: #94a3b8;
  }

  :global(.work-arrow) {
    color: #64748b;
  }

  /* Recent Chapters */
  .recent-chapters-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .dash-ch-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    text-decoration: none;
    color: inherit;
    transition: background 0.2s ease;
  }

  .dash-ch-item:hover {
    background: rgba(255, 255, 255, 0.07);
  }

  .ch-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .ch-work {
    font-weight: 700;
    color: #ffffff;
    font-size: 0.9rem;
  }

  .ch-num {
    padding: 0.15rem 0.45rem;
    background: rgba(139, 92, 246, 0.15);
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 700;
    color: #c4b5fd;
  }

  .ch-right {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 0.78rem;
    color: #64748b;
  }

  .ch-views-count {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .empty-text {
    font-size: 0.88rem;
    color: #64748b;
    margin: 0;
  }

  .font-mono {
    font-family: monospace;
  }

  .text-green {
    color: #34d399 !important;
  }

  .text-red {
    color: #f87171 !important;
  }

  /* Non-member Request Tracking */
  .my-partner-requests-card {
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    padding: 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .requests-card-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: #dfc28d;
  }

  .requests-card-header h2 {
    font-size: 1.2rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .requests-track-list {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .track-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem 1.25rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
  }

  .track-item.status-pending {
    border-color: rgba(139, 92, 246, 0.3);
  }

  .track-item.status-approved {
    border-color: rgba(16, 185, 129, 0.3);
  }

  .track-item.status-rejected {
    border-color: rgba(239, 68, 68, 0.25);
  }

  .track-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .track-scan-info {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .track-scan-name {
    font-size: 1.05rem;
    font-weight: 800;
    color: #ffffff;
  }

  .track-scan-slug {
    font-size: 0.82rem;
    color: #8c899e;
  }

  .track-desc {
    font-size: 0.85rem;
    color: #94a3b8;
    margin: 0;
  }

  .track-rejection-msg {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: 8px;
    color: #fca5a5;
    font-size: 0.82rem;
  }

  .track-approved-msg {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 8px;
    color: #6ee7b7;
    font-size: 0.82rem;
  }

  .track-pending-msg {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: rgba(139, 92, 246, 0.1);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 8px;
    color: #c4b5fd;
    font-size: 0.82rem;
  }

  .track-date {
    font-size: 0.75rem;
    color: #64748b;
    align-self: flex-end;
  }

  /* In-Platform Application Form Card */
  .partner-form-card {
    background: radial-gradient(circle at top right, rgba(139, 92, 246, 0.1), transparent 60%), #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 2.2rem;
  }

  .partner-form-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .partner-form-header h2 {
    font-size: 1.4rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.25rem;
  }

  .partner-form-header p {
    font-size: 0.9rem;
    color: #94a3b8;
    margin: 0;
  }

  .accent-icon {
    color: #dfc28d;
    margin-top: 3px;
  }

  .partner-request-form {
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
  }

  .form-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .flex-1 {
    flex: 1;
    min-width: 220px;
  }

  .form-actions-bar {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.5rem;
  }

  .btn-submit-request {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.85rem 2rem;
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    color: #ffffff;
    border: none;
    border-radius: 12px;
    font-weight: 700;
    font-size: 0.92rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-submit-request:hover:not(:disabled) {
    background: linear-gradient(135deg, #9333ea, #8b5cf6);
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(139, 92, 246, 0.4);
  }

  .btn-submit-request:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Member Team Section Controls & Invites */
  .space-between {
    justify-content: space-between;
  }

  .section-title-wrap {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .btn-sm-action {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.9rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.35);
    color: #c4b5fd;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-sm-action:hover {
    background: rgba(139, 92, 246, 0.25);
    color: #ffffff;
  }

  .created-invite-banner {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 12px;
    padding: 1rem 1.25rem;
    margin-bottom: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .invite-banner-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #6ee7b7;
    font-weight: 700;
    font-size: 0.88rem;
  }

  .invite-copy-group {
    display: flex;
    gap: 0.5rem;
  }

  .invite-copy-input {
    flex: 1;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 0.5rem 0.8rem;
    color: #ffffff;
    font-size: 0.85rem;
    outline: none;
  }

  .btn-copy-action {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    background: #10b981;
    color: #ffffff;
    border: none;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-copy-action:hover {
    background: #059669;
  }

  .invite-hint-txt {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .active-invites-block {
    margin-bottom: 1.25rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .sub-section-title {
    display: block;
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #8c899e;
    margin-bottom: 0.75rem;
  }

  .invites-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .active-invite-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 0.85rem;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
  }

  .invite-info-left {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .invite-role-tag {
    font-size: 0.75rem;
    font-weight: 700;
    color: #c4b5fd;
    background: rgba(139, 92, 246, 0.15);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .invite-exp-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .invite-actions-right {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .btn-icon-sq {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    border: none;
    color: #cbd5e1;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-icon-sq:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .btn-revoke-sq {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: #f87171;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-revoke-sq:hover {
    background: rgba(239, 68, 68, 0.22);
  }

  .member-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .role-form {
    margin: 0;
  }

  .role-select {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    color: #cbd5e1;
    font-size: 0.75rem;
    padding: 3px 6px;
    outline: none;
  }

  .btn-icon-member {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-icon-member.crown {
    color: #dfc28d;
  }

  .btn-icon-member.crown:hover {
    background: rgba(223, 194, 141, 0.15);
    border-color: rgba(223, 194, 141, 0.35);
  }

  .btn-icon-member.remove {
    color: #f87171;
  }

  .btn-icon-member.remove:hover {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.35);
  }

  .role-pill.is-owner {
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.35);
    color: #dfc28d;
    font-weight: 700;
  }

  /* Project Requests Tracker */
  .project-requests-block {
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .proj-requests-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .proj-req-item {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 10px;
  }

  .proj-cover-mini {
    width: 36px;
    height: 50px;
    border-radius: 6px;
    object-fit: cover;
  }

  .proj-cover-fallback {
    width: 36px;
    height: 50px;
    border-radius: 6px;
    background: #1a1d2e;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 700;
    color: #8c899e;
  }

  .proj-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 0.2rem;
  }

  .proj-title {
    font-size: 0.9rem;
    font-weight: 700;
    color: #ffffff;
  }

  .proj-msg {
    font-size: 0.78rem;
    color: #94a3b8;
    font-style: italic;
  }

  .proj-rejection-note {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    color: #fca5a5;
  }

  .status-pill {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .status-pill.status-pending {
    background: rgba(139, 92, 246, 0.15);
    color: #c4b5fd;
    border: 1px solid rgba(139, 92, 246, 0.3);
  }

  .status-pill.status-approved {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .status-pill.status-rejected {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  /* Modals */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
    padding: 20px;
  }

  .modal-card {
    background: #0f121d;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 18px;
    width: 100%;
    max-width: 560px;
    padding: 24px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
  }

  .mini-modal {
    max-width: 480px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.25rem;
  }

  .modal-title {
    font-size: 1.2rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
  }

  .btn-close-modal {
    background: transparent;
    border: none;
    color: #8c899e;
    cursor: pointer;
    padding: 4px;
  }

  .btn-close-modal:hover {
    color: #ffffff;
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-select {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    color: #ffffff;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.2s ease;
  }

  .form-select:focus {
    border-color: #8b5cf6;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .btn-danger-action {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: #ef4444;
    color: #ffffff;
    border: none;
    border-radius: 10px;
    font-weight: 700;
    font-size: 0.88rem;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .btn-danger-action:hover:not(:disabled) {
    background: #dc2626;
  }

  .btn-danger-action:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .warning-alert-box {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 12px;
    color: #fde68a;
    font-size: 0.85rem;
    line-height: 1.5;
  }

  .warning-alert-box strong {
    display: block;
    font-size: 0.9rem;
    margin-bottom: 0.25rem;
    color: #fbbf24;
  }

  .warning-alert-box p {
    margin: 0;
    color: #fde68a;
  }

  .warning-alert-box.danger {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
  }

  .warning-alert-box.danger strong {
    color: #f87171;
  }

  .warning-alert-box.danger p {
    color: #fca5a5;
  }

  /* Transfer Alert Card */
  .transfer-alert-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    background: linear-gradient(135deg, rgba(223, 194, 141, 0.15) 0%, rgba(18, 20, 32, 0.95) 100%);
    border: 1px solid rgba(223, 194, 141, 0.4);
    box-shadow: 0 8px 32px rgba(223, 194, 141, 0.1);
    border-radius: 16px;
    padding: 1.25rem 1.5rem;
    margin-bottom: 2rem;
  }

  .transfer-alert-left {
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }

  .transfer-icon-ring {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(223, 194, 141, 0.2);
    border: 1px solid rgba(223, 194, 141, 0.4);
    color: #dfc28d;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .transfer-alert-text h3 {
    font-size: 1.05rem;
    font-weight: 800;
    color: #fef08a;
    margin: 0 0 0.25rem 0;
  }

  .transfer-alert-text p {
    font-size: 0.88rem;
    color: #cbd5e1;
    margin: 0;
  }

  .transfer-alert-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .btn-transfer-accept {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: #10b981;
    color: #ffffff;
    font-size: 0.85rem;
    font-weight: 700;
    padding: 0.6rem 1.1rem;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-transfer-accept:hover {
    background: #059669;
  }

  .btn-transfer-reject {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    font-size: 0.85rem;
    font-weight: 700;
    padding: 0.6rem 1.1rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-transfer-reject:hover {
    background: rgba(239, 68, 68, 0.25);
    color: #ffffff;
  }

  /* Status and Action Buttons */
  .track-status-cell,
  .proj-actions-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-cancel-req {
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.25rem 0.6rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: #fca5a5;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-cancel-req:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    color: #ffffff;
  }

  /* Pending Transfers Block */
  .pending-transfers-block {
    margin-bottom: 1.25rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .pending-transfer-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.65rem 0.85rem;
    background: rgba(223, 194, 141, 0.06);
    border: 1px solid rgba(223, 194, 141, 0.15);
    border-radius: 8px;
  }

  .transfer-to-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.82rem;
    color: #ffffff;
  }

  .transfer-to-sub {
    font-size: 0.72rem;
    color: #dfc28d;
  }

  /* Work Rows and Project Status Selector */
  .dash-work-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.65rem 0.85rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .dash-work-row .dash-work-item {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    text-decoration: none;
    background: transparent;
    padding: 0;
  }

  .dash-work-row .dash-work-item:hover {
    background: transparent;
    transform: none;
  }

  .dash-work-status-cell {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    flex-shrink: 0;
  }

  .work-arrow-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    padding: 0.25rem;
    border-radius: 4px;
    transition: color 0.15s ease;
  }

  .work-arrow-link:hover {
    color: #dfc28d;
  }

  @media (max-width: 640px) {
    .dash-work-row {
      flex-direction: column;
      align-items: stretch;
      gap: 0.65rem;
    }
    .dash-work-status-cell {
      justify-content: space-between;
      width: 100%;
    }
  }

  .project-status-select {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.35rem 0.65rem;
    border-radius: 6px;
    background: #141828;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #e2e8f0;
    cursor: pointer;
    outline: none;
    transition: all 0.15s ease;
  }

  .project-status-select:hover {
    border-color: rgba(223, 194, 141, 0.5);
  }

  .project-status-select.status-active {
    color: #6ee7b7;
    border-color: rgba(16, 185, 129, 0.3);
    background: rgba(16, 185, 129, 0.1);
  }

  .project-status-select.status-paused {
    color: #fcd34d;
    border-color: rgba(245, 158, 11, 0.3);
    background: rgba(245, 158, 11, 0.1);
  }

  .project-status-select.status-completed {
    color: #93c5fd;
    border-color: rgba(59, 130, 246, 0.3);
    background: rgba(59, 130, 246, 0.1);
  }

  .project-status-select.status-abandoned {
    color: #fca5a5;
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.1);
  }

  .status-pill.status-cancelled {
    background: rgba(100, 116, 139, 0.15);
    color: #94a3b8;
    border: 1px solid rgba(100, 116, 139, 0.3);
  }

  /* Scans 2.0 Tabs & Dashboard Elements */
  .text-purple {
    color: #c4b5fd;
  }

  .text-amber {
    color: #fbbf24;
  }

  .dash-tabs-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 2rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .dash-tabs-bar::-webkit-scrollbar {
    display: none;
  }

  .dash-tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.75rem 1.25rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 12px;
    color: #94a3b8;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s ease;
  }

  .dash-tab-btn:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.04);
  }

  .dash-tab-btn.active {
    color: #f8fafc;
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.35);
  }

  .dash-tab-pill {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.15rem 0.5rem;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
  }

  .dash-tab-pill.highlight {
    background: rgba(139, 92, 246, 0.3);
    color: #e9d5ff;
  }

  .dash-tab-pill.pending-alert {
    background: #ea580c;
    color: #ffffff;
    animation: pulse 2s infinite;
  }

  /* Team Detailed Grid */
  .team-detailed-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.25rem;
    margin-top: 1rem;
  }

  .member-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    transition: all 0.2s ease;
  }

  .member-card:hover {
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.035);
  }

  .member-card-header {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }

  .member-card-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .member-name-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .member-card-positions {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  .member-pos-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .pos-row-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
  }

  .btn-link-edit-pos {
    background: transparent;
    border: none;
    color: #dfc28d;
    font-size: 0.76rem;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0;
  }

  .btn-link-edit-pos:hover {
    text-decoration: underline;
  }

  .member-positions-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .pos-badge {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.55rem;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    color: #cbd5e1;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .pos-badge.primary {
    background: rgba(139, 92, 246, 0.18);
    color: #c4b5fd;
    border-color: rgba(139, 92, 246, 0.35);
  }

  .pos-none-text {
    font-size: 0.8rem;
    color: #64748b;
    font-style: italic;
  }

  .member-card-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }

  /* Openings Grid */
  .openings-dash-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 1.25rem;
    margin-top: 1rem;
  }

  .opening-dash-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 16px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    transition: all 0.2s ease;
  }

  .opening-dash-card:hover {
    border-color: rgba(139, 92, 246, 0.3);
    background: rgba(255, 255, 255, 0.035);
  }

  .op-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .op-badge-cluster {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .op-pos-tag {
    font-size: 0.78rem;
    font-weight: 700;
    padding: 0.25rem 0.65rem;
    border-radius: 6px;
    background: rgba(139, 92, 246, 0.15);
    color: #c4b5fd;
    border: 1px solid rgba(139, 92, 246, 0.3);
  }

  .op-card-metrics {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .op-candidatos-count {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: #94a3b8;
  }

  .op-pending-alert-pill {
    font-size: 0.72rem;
    font-weight: 700;
    background: rgba(234, 88, 12, 0.2);
    color: #fb923c;
    border: 1px solid rgba(234, 88, 12, 0.4);
    padding: 0.15rem 0.5rem;
    border-radius: 12px;
  }

  .op-card-title {
    font-size: 1.15rem;
    font-weight: 800;
    color: #f8fafc;
    margin: 0;
  }

  .op-card-desc {
    font-size: 0.88rem;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0;
  }

  .op-meta-specs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .op-spec-item {
    font-size: 0.78rem;
    font-weight: 600;
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.04);
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .op-requirements-box {
    background: rgba(0, 0, 0, 0.25);
    border-radius: 10px;
    padding: 0.85rem 1rem;
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  .op-requirements-box strong {
    display: block;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
    margin-bottom: 0.35rem;
  }

  .op-requirements-box p {
    font-size: 0.85rem;
    color: #cbd5e1;
    line-height: 1.5;
    margin: 0;
  }

  .op-card-actions-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    margin-top: auto;
    flex-wrap: wrap;
  }

  .btn-op-action {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.45rem 0.85rem;
    font-size: 0.82rem;
    font-weight: 600;
    border-radius: 8px;
    border: 1px solid rgba(139, 92, 246, 0.3);
    background: rgba(139, 92, 246, 0.1);
    color: #c4b5fd;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-op-action:hover {
    background: rgba(139, 92, 246, 0.2);
    color: #ffffff;
  }

  .btn-op-action.secondary {
    border-color: rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: #94a3b8;
  }

  .btn-op-action.secondary:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .btn-op-action.toggle {
    border-color: rgba(245, 158, 11, 0.3);
    background: rgba(245, 158, 11, 0.1);
    color: #fcd34d;
    margin-left: auto;
  }

  .btn-op-action.danger {
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.1);
    color: #f87171;
  }

  .btn-op-action.danger:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ffffff;
  }

  /* Filter Pills */
  .filter-pills-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .filter-pill {
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
    font-weight: 600;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .filter-pill:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #f1f5f9;
  }

  .filter-pill.active {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
    color: #f8fafc;
  }

  /* Applications Grid */
  .applications-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 1.25rem;
    margin-top: 1rem;
  }

  .app-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 16px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    transition: all 0.2s ease;
  }

  .app-card:hover {
    border-color: rgba(139, 92, 246, 0.3);
    background: rgba(255, 255, 255, 0.035);
  }

  .app-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .applicant-profile-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .applicant-names {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .applicant-link {
    text-decoration: none;
    color: inherit;
  }

  .applicant-link strong {
    font-size: 0.95rem;
    color: #f8fafc;
  }

  .applicant-user {
    font-size: 0.8rem;
    color: #64748b;
    display: block;
  }

  .app-timestamp {
    font-size: 0.72rem;
    color: #475569;
  }

  .app-status-badge-wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.35rem;
  }

  .app-pos-tag {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.2rem 0.55rem;
    border-radius: 6px;
    background: rgba(139, 92, 246, 0.15);
    color: #c4b5fd;
    border: 1px solid rgba(139, 92, 246, 0.3);
  }

  .app-opening-ref {
    font-size: 0.8rem;
    color: #94a3b8;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .app-opening-ref strong {
    color: #cbd5e1;
  }

  .app-card-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .app-field-item {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .app-field-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
  }

  .app-field-val {
    font-size: 0.86rem;
    color: #cbd5e1;
    line-height: 1.5;
    margin: 0;
  }

  .portfolio-link-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.8rem;
    font-size: 0.82rem;
    font-weight: 600;
    color: #dfc28d;
    background: rgba(223, 194, 141, 0.1);
    border: 1px solid rgba(223, 194, 141, 0.25);
    border-radius: 8px;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .portfolio-link-btn:hover {
    background: rgba(223, 194, 141, 0.2);
    color: #ffffff;
  }

  .app-internal-notes-box {
    background: rgba(0, 0, 0, 0.25);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .app-internal-notes-box strong {
    display: block;
    font-size: 0.72rem;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.25rem;
  }

  .app-internal-notes-box p {
    font-size: 0.84rem;
    color: #e2e8f0;
    margin: 0;
  }

  .app-qa-answers-box,
  .review-qa-answers-box {
    background: rgba(139, 92, 246, 0.06);
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 8px;
    padding: 0.75rem 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .app-qa-title {
    font-size: 0.75rem;
    font-weight: 700;
    color: #c084fc;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .app-qa-list,
  .review-qa-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .app-qa-entry,
  .review-qa-entry {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .app-qa-question,
  .qa-q-text {
    font-size: 0.75rem;
    font-weight: 600;
    color: #94a3b8;
  }

  .app-qa-answer,
  .qa-a-text {
    font-size: 0.84rem;
    color: #f1f5f9;
    background: rgba(0, 0, 0, 0.25);
    padding: 0.3rem 0.6rem;
    border-radius: 4px;
  }

  .app-card-footer {
    padding-top: 0.75rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    margin-top: auto;
  }

  .btn-review-action {
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.6rem 1rem;
    font-size: 0.86rem;
    font-weight: 700;
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(99, 102, 241, 0.25));
    border: 1px solid rgba(139, 92, 246, 0.4);
    color: #e9d5ff;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-review-action:hover {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.4), rgba(99, 102, 241, 0.4));
    color: #ffffff;
  }

  /* Positions Management Grid */
  .callout-info-box {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
    padding: 1rem 1.25rem;
    background: rgba(139, 92, 246, 0.08);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 12px;
    margin-bottom: 1.5rem;
    font-size: 0.88rem;
    line-height: 1.5;
    color: #cbd5e1;
  }

  .callout-info-box strong {
    display: block;
    color: #f1f5f9;
    font-size: 0.95rem;
    margin-bottom: 0.25rem;
  }

  .positions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.25rem;
  }

  .pos-management-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    transition: all 0.2s ease;
  }

  .pos-management-card:hover {
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.035);
  }

  .pos-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .pos-card-title-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .pos-name-tag {
    font-size: 0.95rem;
    font-weight: 700;
    color: #f8fafc;
  }

  .pos-preset-pill {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.15rem 0.45rem;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    color: #94a3b8;
  }

  .pos-card-desc {
    font-size: 0.84rem;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0;
  }

  .pos-card-footer {
    display: flex;
    align-items: center;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    margin-top: auto;
  }

  .pos-members-count {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.76rem;
    color: #64748b;
  }

  /* Activity Timeline */
  .activity-timeline {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1rem;
  }

  .timeline-entry {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
  }

  .timeline-icon-wrap {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: rgba(139, 92, 246, 0.15);
    color: #c4b5fd;
    border: 1px solid rgba(139, 92, 246, 0.25);
  }

  .timeline-icon-wrap.action-application_received {
    background: rgba(245, 158, 11, 0.15);
    color: #fcd34d;
    border-color: rgba(245, 158, 11, 0.3);
  }

  .timeline-icon-wrap.action-member_added {
    background: rgba(16, 185, 129, 0.15);
    color: #6ee7b7;
    border-color: rgba(16, 185, 129, 0.3);
  }

  .timeline-content {
    flex: 1;
    min-width: 0;
  }

  .timeline-text {
    font-size: 0.88rem;
    color: #cbd5e1;
    line-height: 1.5;
    margin: 0 0 0.25rem;
  }

  .timeline-text strong {
    color: #f8fafc;
  }

  .timeline-time {
    font-size: 0.74rem;
    color: #64748b;
  }

  .status-inline {
    font-weight: 700;
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
  }

  .status-inline.status-approved {
    background: rgba(16, 185, 129, 0.2);
    color: #6ee7b7;
  }

  .status-inline.status-rejected {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  /* Preposition Live Preview */
  .prep-live-preview {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    padding: 0.6rem 0.85rem;
    background: rgba(223, 194, 141, 0.08);
    border: 1px solid rgba(223, 194, 141, 0.2);
    border-radius: 8px;
    font-size: 0.82rem;
    color: #cbd5e1;
  }

  .prep-live-preview strong {
    color: #dfc28d;
    font-weight: 700;
  }

  /* Modals: Decision Radios & Review */
  .decision-radios {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.6rem;
    margin-top: 0.4rem;
  }

  .decision-radio-label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.75rem 0.5rem;
    border-radius: 10px;
    font-size: 0.82rem;
    font-weight: 700;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .decision-radio-label input {
    display: none;
  }

  .decision-radio-label.approve.active {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.4);
    color: #6ee7b7;
  }

  .decision-radio-label.under-review.active {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.4);
    color: #fcd34d;
  }

  .decision-radio-label.reject.active {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.4);
    color: #fca5a5;
  }

  .approve-options-box {
    background: rgba(16, 185, 129, 0.06);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 10px;
    padding: 1rem;
  }

  .review-candidate-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    margin-bottom: 1.25rem;
  }

  .review-candidate-profile {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .review-candidate-profile strong {
    display: block;
    color: #f8fafc;
    font-size: 0.95rem;
  }

  .review-candidate-profile .user-handle {
    font-size: 0.8rem;
    color: #64748b;
  }

  .review-vac-badge {
    text-align: right;
  }

  .review-vac-badge span {
    font-size: 0.72rem;
    color: #64748b;
    display: block;
  }

  .review-vac-badge strong {
    color: #c4b5fd;
    font-size: 0.9rem;
  }

  .review-app-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 250px;
    overflow-y: auto;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.25);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.04);
    margin-bottom: 1.25rem;
  }

  .review-info-item {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .review-info-item .item-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    color: #64748b;
    letter-spacing: 0.05em;
  }

  .review-info-item p {
    font-size: 0.85rem;
    color: #cbd5e1;
    line-height: 1.45;
    margin: 0;
  }

  /* Assign Member Modal */
  .current-pos-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-top: 0.5rem;
  }

  .current-pos-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
  }

  .pos-item-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-text-action {
    background: transparent;
    border: none;
    color: #dfc28d;
    font-size: 0.76rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0.2rem 0.4rem;
  }

  .btn-text-action:hover {
    text-decoration: underline;
  }

  .btn-icon-del-pos {
    background: transparent;
    border: none;
    color: #ef4444;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    border-radius: 4px;
  }

  .btn-icon-del-pos:hover {
    background: rgba(239, 68, 68, 0.15);
  }

  .empty-mini-text {
    font-size: 0.82rem;
    color: #64748b;
    font-style: italic;
    margin: 0.5rem 0 0;
  }

  .checkbox-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    margin: 0.75rem 0;
  }

  .checkbox-label {
    font-size: 0.84rem;
    color: #cbd5e1;
  }

  /* Staff Notes / Mural */
  .staff-isolation-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.85rem;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.35);
    color: #34d399;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .section-sub-desc {
    font-size: 0.88rem;
    color: #94a3b8;
    margin: 0.35rem 0 1.5rem;
    line-height: 1.5;
  }

  .staff-note-composer {
    background: rgba(13, 16, 26, 0.85);
    border: 1px solid rgba(181, 154, 245, 0.2);
    border-radius: 16px;
    padding: 1.25rem;
    margin-bottom: 2rem;
  }

  .composer-body-area {
    margin-bottom: 0.85rem;
  }

  .composer-controls-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding-top: 0.85rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .pin-checkbox-label {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: #dfc28d;
    font-weight: 600;
    cursor: pointer;
  }

  .composer-note-hint {
    font-size: 0.8rem;
    color: #64748b;
  }

  .staff-notes-list {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .staff-note-card {
    background: rgba(18, 22, 34, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 1.25rem;
    transition: border-color 0.2s ease;
  }

  .staff-note-card.is-pinned {
    border-color: rgba(223, 194, 141, 0.5);
    background: rgba(223, 194, 141, 0.04);
  }

  .staff-pinned-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.74rem;
    font-weight: 800;
    color: #dfc28d;
    background: rgba(223, 194, 141, 0.15);
    padding: 0.2rem 0.6rem;
    border-radius: 6px;
    margin-bottom: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .staff-note-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
    gap: 0.75rem;
  }

  .note-author-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .note-author-info {
    display: flex;
    flex-direction: column;
  }

  .note-author-name {
    font-size: 0.92rem;
    color: #f1f5f9;
    font-weight: 700;
  }

  .note-meta-line {
    font-size: 0.78rem;
    color: #64748b;
  }

  .btn-delete-note {
    background: transparent;
    border: none;
    color: #64748b;
    padding: 0.35rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-delete-note:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.12);
  }

  .staff-note-content {
    margin: 0;
    font-size: 0.92rem;
    color: #cbd5e1;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* Member Visibility in Team Tab */
  .member-card-visibility {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.65rem 0;
    margin: 0.65rem 0;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    flex-wrap: wrap;
  }

  .vis-status-row {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .vis-label {
    font-size: 0.78rem;
    color: #64748b;
    font-weight: 600;
  }

  .badge-vis-status {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .badge-vis-status.public {
    background: rgba(16, 185, 129, 0.12);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .badge-vis-status.private {
    background: rgba(245, 158, 11, 0.12);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .badge-vis-status.hidden-admin {
    background: rgba(239, 68, 68, 0.12);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .vis-toggle-form {
    display: inline-flex;
    margin: 0;
  }

  .btn-vis-toggle {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #cbd5e1;
    padding: 0.25rem 0.65rem;
    border-radius: 6px;
    font-size: 0.74rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-vis-toggle:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  @media (max-width: 900px) {
    .dash-columns {
      grid-template-columns: 1fr;
    }
    .transfer-alert-card {
      flex-direction: column;
      align-items: flex-start;
    }
    .decision-radios {
      grid-template-columns: 1fr;
    }
    .openings-dash-grid,
    .applications-grid,
    .team-detailed-grid {
      grid-template-columns: 1fr;
    }
  }

  .emergency-banner-alert {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: rgba(244, 63, 94, 0.12);
    border: 1px solid rgba(244, 63, 94, 0.3);
    border-radius: 12px;
    padding: 14px 18px;
    margin-bottom: 1.5rem;
    color: #fecdd3;
  }

  .emergency-banner-alert strong {
    display: block;
    color: #fda4af;
    font-size: 0.93rem;
  }

  .emergency-banner-alert p {
    margin: 4px 0 0;
    font-size: 0.85rem;
    color: #cbd5e1;
  }

  .pause-banner-alert {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 12px;
    padding: 12px 16px;
    margin-bottom: 1.5rem;
    color: #fde68a;
    font-size: 0.88rem;
    font-weight: 500;
  }

  .dash-category-selector {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 6px;
    margin-bottom: 1rem;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .dash-category-selector::-webkit-scrollbar {
    display: none;
  }

  .category-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 10px;
    background: transparent;
    border: 1px solid transparent;
    color: #94a3b8;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s ease;
  }

  .category-btn:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.05);
  }

  .category-btn.active {
    background: rgba(99, 102, 241, 0.2);
    border-color: rgba(99, 102, 241, 0.4);
    color: #c7d2fe;
    box-shadow: 0 2px 10px rgba(99, 102, 241, 0.15);
  }

  .cat-pill {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
  }

  .cat-pill.alert {
    background: #ef4444;
    color: #ffffff;
  }

  .settings-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 2rem 0;
  }

  /* Team Card Member Function Badges */
  .role-pill.is-manager {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.35);
  }

  .role-pill.is-staff {
    background: rgba(148, 163, 184, 0.12);
    color: #94a3b8;
    border: 1px solid rgba(148, 163, 184, 0.25);
  }

  .pos-badge .pos-emoji {
    font-size: 0.8rem;
    line-height: 1;
    margin-right: 2px;
  }

  .btn-action-manage-member {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.3);
    color: #c4b5fd;
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-action-manage-member:hover {
    background: rgba(139, 92, 246, 0.22);
    color: #ffffff;
    border-color: rgba(139, 92, 246, 0.5);
  }

  /* Member Management Modal */
  .member-management-modal {
    max-width: 580px;
    width: 100%;
    background: #0f0d19;
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  }

  .modal-header-profile {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .modal-header-titles {
    display: flex;
    flex-direction: column;
  }

  .modal-header-titles .modal-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .modal-subtitle {
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .modal-form-body {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.25rem 1.5rem 1.5rem;
  }

  .manage-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .section-label-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .section-num-tag {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(139, 92, 246, 0.2);
    border: 1px solid rgba(139, 92, 246, 0.4);
    color: #c4b5fd;
    font-size: 0.75rem;
    font-weight: 700;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .manage-section-heading {
    font-size: 0.92rem;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0 0 2px;
  }

  .manage-section-hint {
    font-size: 0.78rem;
    color: #94a3b8;
    margin: 0;
    line-height: 1.35;
  }

  /* Function Box / Cards */
  .func-status-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 0.875rem 1rem;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .func-status-card.owner-mode {
    background: rgba(245, 158, 11, 0.08);
    border-color: rgba(245, 158, 11, 0.25);
  }

  .func-status-card.readonly-mode {
    background: rgba(255, 255, 255, 0.02);
    border-color: rgba(255, 255, 255, 0.06);
  }

  .func-status-icon {
    font-size: 1.5rem;
    line-height: 1;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .func-status-details {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .func-status-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .func-status-title-row strong {
    font-size: 0.95rem;
    color: #ffffff;
  }

  .badge-role-fixed,
  .badge-role-readonly {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .badge-role-fixed {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.4);
  }

  .badge-role-readonly {
    background: rgba(148, 163, 184, 0.15);
    color: #cbd5e1;
    border: 1px solid rgba(148, 163, 184, 0.3);
  }

  .func-status-details p {
    font-size: 0.78rem;
    color: #94a3b8;
    margin: 0;
    line-height: 1.4;
  }

  /* Function Selection Grid (Radio Cards) */
  .function-selection-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .function-choice-card {
    display: flex;
    flex-direction: column;
    padding: 0.875rem;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
  }

  .function-choice-card input[type="radio"] {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .function-choice-card:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .function-choice-card.selected {
    background: rgba(139, 92, 246, 0.12);
    border-color: rgba(139, 92, 246, 0.5);
    box-shadow: 0 0 14px rgba(139, 92, 246, 0.18);
  }

  .choice-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .choice-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .choice-emoji {
    font-size: 1.1rem;
    line-height: 1;
  }

  .choice-title {
    font-size: 0.9rem;
    font-weight: 700;
    color: #ffffff;
  }

  .choice-check {
    margin-left: auto;
    color: #a78bfa;
  }

  .choice-desc {
    font-size: 0.74rem;
    color: #94a3b8;
    margin: 0;
    line-height: 1.35;
  }

  /* Editorial Positions Checkbox List */
  .positions-selection-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .position-checkbox-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0.65rem 0.85rem;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .position-checkbox-item input[type="checkbox"] {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .position-checkbox-item:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .position-checkbox-item.checked {
    background: rgba(139, 92, 246, 0.08);
    border-color: rgba(139, 92, 246, 0.35);
  }

  .custom-checkbox {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.12s ease;
  }

  .custom-checkbox.active {
    background: #8b5cf6;
    border-color: #8b5cf6;
    color: #ffffff;
  }

  .pos-item-emoji {
    font-size: 1.1rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .pos-item-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .pos-item-name {
    font-size: 0.85rem;
    font-weight: 700;
    color: #e2e8f0;
  }

  .pos-item-desc {
    font-size: 0.72rem;
    color: #94a3b8;
    line-height: 1.25;
  }

  /* Modal Footer */
  .manage-modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    margin-top: 0.5rem;
  }

  .manage-modal-footer .footer-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-modal-remove-member {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: #f87171;
    padding: 0.5rem 0.85rem;
    border-radius: 7px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-modal-remove-member:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ffffff;
    border-color: rgba(239, 68, 68, 0.5);
  }

  .modal-alert-error,
  .modal-alert-warning {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.8rem;
    line-height: 1.4;
  }

  .modal-alert-error {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #fca5a5;
  }

  .modal-alert-warning {
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #fde68a;
  }

</style>
