<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import {
    Ticket,
    Flag,
    FileCheck,
    ShieldAlert,
    Clock,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Eye,
    EyeOff,
    Trash2,
    UserX,
    ExternalLink,
    Filter,
    Search,
    ChevronRight,
    ChevronDown,
    Building2,
    Globe,
    MessageSquare,
    Send,
    Check,
    X,
    Sparkles,
    User,
    BookOpen,
    Layers
  } from '@lucide/svelte';
  import UserAvatar from '$lib/components/UserAvatar.svelte';

  let { data } = $props();

  let activeTab = $derived(data.activeTab || 'relatorios');
  let currentStatus = $derived(data.statusFilter || 'ALL');
  let currentType = $derived(data.typeFilter || 'ALL');
  let searchQuery = $state(data.searchQuery || '');

  // UI state
  let busy = $state(false);
  let feedbackMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

  // Resolution modal state
  let resolveModalOpen = $state(false);
  let resolveReportId = $state<string | null>(null);
  let resolveNewStatus = $state<'RESOLVIDO' | 'REJEITADO' | 'EM_ANALISE'>('RESOLVIDO');
  let resolveNotes = $state('');

  // Scan Partner Rejection modal state
  let rejectScanModalOpen = $state(false);
  let rejectScanRequestId = $state<string | null>(null);
  let rejectScanName = $state('');
  let rejectScanReason = $state('');

  // Scan Partner Realistic Preview modal state
  let previewPartnerReq = $state<any>(null);

  // Selected reports for batch action
  let selectedReportIds = $state<string[]>([]);

  // Expanded cluster tracking
  let expandedClusters = $state<Record<string, boolean>>({});

  function setTab(tabName: string) {
    const url = new URL(page.url);
    url.searchParams.set('tab', tabName);
    url.searchParams.delete('status');
    url.searchParams.delete('type');
    url.searchParams.delete('q');
    window.location.href = url.toString();
  }

  function setStatusFilter(status: string) {
    const url = new URL(page.url);
    url.searchParams.set('status', status);
    window.location.href = url.toString();
  }

  function setTypeFilter(t: string) {
    const url = new URL(page.url);
    url.searchParams.set('type', t);
    window.location.href = url.toString();
  }

  function toggleCluster(key: string) {
    expandedClusters[key] = !expandedClusters[key];
  }

  function showFeedback(type: 'success' | 'error', text: string) {
    feedbackMessage = { type, text };
    setTimeout(() => {
      if (feedbackMessage?.text === text) feedbackMessage = null;
    }, 4500);
  }

  // --- ACTIONS ---

  async function quickUpdateReportStatus(reportId: string, status: string, notes = '') {
    busy = true;
    try {
      const fd = new FormData();
      fd.append('reportId', reportId);
      fd.append('status', status);
      if (notes) fd.append('notes', notes);

      const res = await fetch('?/updateReportStatus', {
        method: 'POST',
        body: fd
      });
      if (!res.ok) throw new Error('Falha ao atualizar relatório');
      showFeedback('success', `Relatório atualizado para ${status === 'RESOLVIDO' ? 'Resolvido' : status === 'REJEITADO' ? 'Rejeitado' : 'Em Análise'}`);
      await invalidateAll();
    } catch (e: any) {
      showFeedback('error', e.message || 'Erro ao processar');
    } finally {
      busy = false;
      resolveModalOpen = false;
    }
  }

  function openResolveModal(reportId: string, status: 'RESOLVIDO' | 'REJEITADO') {
    resolveReportId = reportId;
    resolveNewStatus = status;
    resolveNotes = '';
    resolveModalOpen = true;
  }

  async function submitResolveModal(event: SubmitEvent) {
    event.preventDefault();
    if (!resolveReportId) return;
    await quickUpdateReportStatus(resolveReportId, resolveNewStatus, resolveNotes);
  }

  // --- SCAN ACTIONS ---

  function openRejectScanModal(req: any) {
    rejectScanRequestId = req.id;
    rejectScanName = req.scan_name;
    rejectScanReason = '';
    rejectScanModalOpen = true;
  }

  async function approveScan(req: any) {
    if (!confirm(`Confirmar aprovação da scan "${req.scan_name}"? A scan será criada imediatamente e o candidato receberá a posse de OWNER.`)) {
      return;
    }
    busy = true;
    try {
      const fd = new FormData();
      fd.append('request_id', req.id);
      fd.append('action', 'APPROVE');

      const res = await fetch('?/reviewScanPartner', {
        method: 'POST',
        body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Falha ao aprovar scan');
      showFeedback('success', `Scan "${req.scan_name}" aprovada com sucesso!`);
      await invalidateAll();
    } catch (e: any) {
      showFeedback('error', e.message || 'Erro ao aprovar scan');
    } finally {
      busy = false;
    }
  }

  async function submitRejectScan(event: SubmitEvent) {
    event.preventDefault();
    if (!rejectScanRequestId) return;
    busy = true;
    try {
      const fd = new FormData();
      fd.append('request_id', rejectScanRequestId);
      fd.append('action', 'REJECT');
      if (rejectScanReason) fd.append('reason', rejectScanReason);

      const res = await fetch('?/reviewScanPartner', {
        method: 'POST',
        body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Falha ao recusar solicitação');
      showFeedback('success', `Solicitação de "${rejectScanName}" recusada.`);
      rejectScanModalOpen = false;
      await invalidateAll();
    } catch (e: any) {
      showFeedback('error', e.message || 'Erro ao recusar scan');
    } finally {
      busy = false;
    }
  }

  // --- MODERATION ACTIONS ---

  async function moderate(actionType: string, params: { reportId?: string; commentId?: string; targetUserId?: string; notes?: string }) {
    if (actionType === 'delete' && !confirm('Tem certeza de que deseja excluir este comentário permanentemente?')) {
      return;
    }
    if (actionType === 'suspend_user' && !confirm('Confirmar suspensão deste usuário do Project Nox?')) {
      return;
    }

    busy = true;
    try {
      const fd = new FormData();
      fd.append('action', actionType);
      if (params.reportId) fd.append('report_id', params.reportId);
      if (params.commentId) fd.append('comment_id', params.commentId);
      if (params.targetUserId) fd.append('target_user_id', params.targetUserId);
      if (params.notes) fd.append('notes', params.notes);

      const res = await fetch('?/moderateComment', {
        method: 'POST',
        body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Falha na moderação');
      showFeedback('success', 'Ação de moderação aplicada com sucesso.');
      await invalidateAll();
    } catch (e: any) {
      showFeedback('error', e.message || 'Erro ao moderar');
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Central de Tickets — Project Nox Admin</title>
</svelte:head>

<div class="tickets-workspace">
  <!-- Top Header Cluster -->
  <header class="tickets-header">
    <div class="header-main">
      <div class="header-badge">
        <Ticket size={14} />
        <span>CENTRAL DE OPERAÇÕES</span>
      </div>
      <h1 class="header-title">Central de Tickets</h1>
      <p class="header-desc">
        Gestão unificada de relatórios de conteúdo, candidaturas de scans e moderação da comunidade.
      </p>
    </div>

    {#if feedbackMessage}
      <div class="feedback-banner {feedbackMessage.type}">
        {#if feedbackMessage.type === 'success'}
          <CheckCircle2 size={16} />
        {:else}
          <AlertTriangle size={16} />
        {/if}
        <span>{feedbackMessage.text}</span>
      </div>
    {/if}
  </header>

  <!-- Metric Highlights Bar -->
  <section class="stats-grid" aria-label="Resumo de tickets pendentes">
    <div class="stat-card stat-total">
      <div class="stat-icon-wrapper total">
        <Ticket size={22} />
      </div>
      <div class="stat-meta">
        <span class="stat-label">Total Pendente</span>
        <span class="stat-value">{data.ticketStats.totalTicketsCount}</span>
      </div>
      <span class="stat-pill {data.ticketStats.totalTicketsCount > 0 ? 'alert' : 'clean'}">
        {data.ticketStats.totalTicketsCount > 0 ? 'Atenção Necessária' : 'Em Dia'}
      </span>
    </div>

    <div class="stat-card">
      <div class="stat-icon-wrapper reports">
        <Flag size={20} />
      </div>
      <div class="stat-meta">
        <span class="stat-label">Relatórios de Conteúdo</span>
        <span class="stat-value">{data.ticketStats.pendingReportsCount}</span>
      </div>
      <span class="stat-pill {data.ticketStats.pendingReportsCount > 0 ? 'warning' : 'clean'}">
        {data.ticketStats.pendingReportsCount} abertos
      </span>
    </div>

    {#if data.isAdmin}
      <div class="stat-card">
        <div class="stat-icon-wrapper scans">
          <FileCheck size={20} />
        </div>
        <div class="stat-meta">
          <span class="stat-label">Inscrições de Scans</span>
          <span class="stat-value">{data.ticketStats.pendingScansCount}</span>
        </div>
        <span class="stat-pill {data.ticketStats.pendingScansCount > 0 ? 'gold' : 'clean'}">
          {data.ticketStats.pendingScansCount} para análise
        </span>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper moderation">
          <ShieldAlert size={20} />
        </div>
        <div class="stat-meta">
          <span class="stat-label">Moderação Comunitária</span>
          <span class="stat-value">{data.ticketStats.pendingModerationCount}</span>
        </div>
        <span class="stat-pill {data.ticketStats.pendingModerationCount > 0 ? 'alert' : 'clean'}">
          {data.ticketStats.pendingModerationCount} ocorrências
        </span>
      </div>
    {/if}
  </section>

  <!-- Tab Switcher Bar -->
  <div class="tabs-nav-bar">
    <div class="tabs-cluster" role="tablist">
      <button
        type="button"
        role="tab"
        class="tab-btn"
        class:active={activeTab === 'relatorios'}
        aria-selected={activeTab === 'relatorios'}
        onclick={() => setTab('relatorios')}
      >
        <Flag size={16} />
        <span>Relatórios de Conteúdo</span>
        {#if data.ticketStats.pendingReportsCount > 0}
          <span class="tab-badge">{data.ticketStats.pendingReportsCount}</span>
        {/if}
      </button>

      {#if data.isAdmin}
        <button
          type="button"
          role="tab"
          class="tab-btn"
          class:active={activeTab === 'scans'}
          aria-selected={activeTab === 'scans'}
          onclick={() => setTab('scans')}
        >
          <FileCheck size={16} />
          <span>Inscrições de Scans</span>
          {#if data.ticketStats.pendingScansCount > 0}
            <span class="tab-badge gold">{data.ticketStats.pendingScansCount}</span>
          {/if}
        </button>

        <button
          type="button"
          role="tab"
          class="tab-btn"
          class:active={activeTab === 'moderacao'}
          aria-selected={activeTab === 'moderacao'}
          onclick={() => setTab('moderacao')}
        >
          <ShieldAlert size={16} />
          <span>Moderação</span>
          {#if data.ticketStats.pendingModerationCount > 0}
            <span class="tab-badge alert">{data.ticketStats.pendingModerationCount}</span>
          {/if}
        </button>
      {/if}
    </div>
  </div>

  <!-- TAB 1: RELATÓRIOS DE CONTEÚDO -->
  {#if activeTab === 'relatorios'}
    <section class="tab-panel" aria-label="Relatórios de Conteúdo">
      <!-- Filter Controls Toolbar -->
      <div class="toolbar-bar">
        <div class="filter-pills-row">
          <button
            type="button"
            class="filter-pill"
            class:active={currentStatus === 'ALL'}
            onclick={() => setStatusFilter('ALL')}
          >
            Todos ({data.contentStatusCounts.ALL})
          </button>
          <button
            type="button"
            class="filter-pill pill-alert"
            class:active={currentStatus === 'NOVO'}
            onclick={() => setStatusFilter('NOVO')}
          >
            Novos ({data.contentStatusCounts.NOVO})
          </button>
          <button
            type="button"
            class="filter-pill pill-warn"
            class:active={currentStatus === 'EM_ANALISE'}
            onclick={() => setStatusFilter('EM_ANALISE')}
          >
            Em Análise ({data.contentStatusCounts.EM_ANALISE})
          </button>
          <button
            type="button"
            class="filter-pill pill-success"
            class:active={currentStatus === 'RESOLVIDO'}
            onclick={() => setStatusFilter('RESOLVIDO')}
          >
            Resolvidos ({data.contentStatusCounts.RESOLVIDO})
          </button>
          <button
            type="button"
            class="filter-pill"
            class:active={currentStatus === 'REJEITADO'}
            onclick={() => setStatusFilter('REJEITADO')}
          >
            Rejeitados ({data.contentStatusCounts.REJEITADO})
          </button>
        </div>

        <div class="toolbar-secondary">
          <select
            class="filter-select"
            value={currentType}
            onchange={(e) => setTypeFilter((e.target as HTMLSelectElement).value)}
            aria-label="Filtrar por tipo de conteúdo"
          >
            <option value="ALL">Todos os Tipos</option>
            <option value="CHAPTER">Capítulos</option>
            <option value="WORK">Obras</option>
          </select>
        </div>
      </div>

      <!-- Clusters / List of Content Issues -->
      {#if data.clusters.length === 0}
        <div class="empty-state">
          <CheckCircle2 size={40} class="empty-icon" />
          <h3>Nenhum relatório pendente</h3>
          <p>Tudo certo! Não há relatórios de conteúdo correspondentes aos filtros selecionados.</p>
        </div>
      {:else}
        <div class="clusters-list">
          {#each data.clusters as cluster (cluster.clusterKey)}
            <article class="cluster-card" class:has-new={cluster.newCount > 0}>
              <div class="cluster-header">
                <div class="cluster-target-group">
                  {#if cluster.coverId}
                    <img
                      src="/media/{cluster.coverId}"
                      alt=""
                      class="target-cover"
                      loading="lazy"
                    />
                  {:else}
                    <div class="target-cover-fallback">
                      <BookOpen size={18} />
                    </div>
                  {/if}

                  <div class="target-meta">
                    <div class="target-sub-row">
                      <span class="target-type-badge">{cluster.targetType === 'CHAPTER' ? 'CAPÍTULO' : 'OBRA'}</span>
                      <span class="target-date">Último reporte: {new Date(cluster.latestCreatedAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <h3 class="target-title">{cluster.targetTitle}</h3>
                    <div class="reasons-wrap">
                      {#each cluster.reasons as reason}
                        <span class="reason-pill">{reason}</span>
                      {/each}
                    </div>
                  </div>
                </div>

                <div class="cluster-status-cluster">
                  <span class="status-badge status-{cluster.status.toLowerCase()}">
                    {cluster.status === 'NOVO' ? 'NOVO' : cluster.status === 'EM_ANALISE' ? 'EM ANÁLISE' : cluster.status === 'RESOLVIDO' ? 'RESOLVIDO' : 'REJEITADO'}
                  </span>
                  <span class="reports-count-pill">{cluster.count} {cluster.count === 1 ? 'denúncia' : 'denúncias'}</span>
                </div>
              </div>

              <!-- Quick Action Bar -->
              <div class="cluster-actions-bar">
                <div class="left-actions">
                  {#if cluster.targetLink}
                    <a
                      href={cluster.targetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn-action-ghost"
                    >
                      <ExternalLink size={14} />
                      <span>Ver no Leitor / Obra</span>
                    </a>
                  {/if}
                  <button
                    type="button"
                    class="btn-action-ghost"
                    onclick={() => toggleCluster(cluster.clusterKey)}
                  >
                    {#if expandedClusters[cluster.clusterKey]}
                      <ChevronDown size={14} />
                      <span>Ocultar Detalhes</span>
                    {:else}
                      <ChevronRight size={14} />
                      <span>Ver Detalhes ({cluster.count})</span>
                    {/if}
                  </button>
                </div>

                <div class="right-actions">
                  {#if cluster.status === 'NOVO'}
                    <button
                      type="button"
                      class="btn-action-warning"
                      disabled={busy}
                      onclick={() => quickUpdateReportStatus(cluster.reportIds[0], 'EM_ANALISE')}
                    >
                      <Clock size={14} />
                      <span>Assumir / Em Análise</span>
                    </button>
                  {/if}
                  <button
                    type="button"
                    class="btn-action-success"
                    disabled={busy}
                    onclick={() => openResolveModal(cluster.reportIds[0], 'RESOLVIDO')}
                  >
                    <Check size={14} />
                    <span>Resolver</span>
                  </button>
                  <button
                    type="button"
                    class="btn-action-danger"
                    disabled={busy}
                    onclick={() => openResolveModal(cluster.reportIds[0], 'REJEITADO')}
                  >
                    <X size={14} />
                    <span>Rejeitar</span>
                  </button>
                </div>
              </div>

              <!-- Expanded Detailed Reports -->
              {#if expandedClusters[cluster.clusterKey]}
                <div class="cluster-expanded-body">
                  <h4 class="expanded-heading">Relatórios individuais agrupados neste item:</h4>
                  <div class="expanded-reports-grid">
                    {#each cluster.reports as rep}
                      <div class="individual-report-item">
                        <div class="report-user-row">
                          <UserAvatar
                            avatarId={rep.reporter?.avatar_id}
                            crop={rep.reporter?.avatar_crop}
                            displayName={rep.reporter?.display_name || rep.reporter?.username || 'Leitor'}
                            size={24}
                          />
                          <span class="reporter-name">
                            {rep.reporter?.display_name || rep.reporter?.username || 'Anônimo'}
                          </span>
                          <span class="report-time">{new Date(rep.created_at).toLocaleString('pt-BR')}</span>
                        </div>
                        <div class="report-reason-row">
                          <strong class="report-reason-tag">{rep.reason}</strong>
                          {#if rep.details}
                            <p class="report-details-text">"{rep.details}"</p>
                          {/if}
                        </div>
                        {#if rep.resolution_notes}
                          <div class="resolution-notes-box">
                            <strong>Nota da Equipe:</strong> {rep.resolution_notes}
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </article>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  <!-- TAB 2: INSCRIÇÕES DE SCANS (ADMIN ONLY) -->
  {#if activeTab === 'scans' && data.isAdmin}
    <section class="tab-panel" aria-label="Inscrições de Scans">
      <!-- Status Filters -->
      <div class="toolbar-bar">
        <div class="filter-pills-row">
          <button
            type="button"
            class="filter-pill"
            class:active={currentStatus === 'ALL'}
            onclick={() => setStatusFilter('ALL')}
          >
            Todas ({data.partnerStatusCounts.ALL})
          </button>
          <button
            type="button"
            class="filter-pill pill-gold"
            class:active={currentStatus === 'PENDING'}
            onclick={() => setStatusFilter('PENDING')}
          >
            Pendentes ({data.partnerStatusCounts.PENDING})
          </button>
          <button
            type="button"
            class="filter-pill pill-success"
            class:active={currentStatus === 'APPROVED'}
            onclick={() => setStatusFilter('APPROVED')}
          >
            Aprovadas ({data.partnerStatusCounts.APPROVED})
          </button>
          <button
            type="button"
            class="filter-pill pill-alert"
            class:active={currentStatus === 'REJECTED'}
            onclick={() => setStatusFilter('REJECTED')}
          >
            Recusadas ({data.partnerStatusCounts.REJECTED})
          </button>
        </div>
      </div>

      <!-- Scans List -->
      {#if data.partnerRequests.length === 0}
        <div class="empty-state">
          <FileCheck size={40} class="empty-icon" />
          <h3>Nenhuma solicitação de scan</h3>
          <p>Nenhuma inscrição de scan parceira encontrada para o filtro atual.</p>
        </div>
      {:else}
        <div class="partner-cards-grid">
          {#each data.partnerRequests as req (req.id)}
            <article class="partner-card" class:pending-card={req.status === 'PENDING'}>
              <!-- Header with Banner Strip -->
              <div class="partner-card-media-banner">
                {#if req.meta?.banner_id}
                  <img
                    src="/media/{req.meta.banner_id}"
                    alt="Banner de {req.scan_name}"
                    class="partner-banner-img"
                    loading="lazy"
                  />
                {:else}
                  <div class="partner-banner-fallback">
                    <Sparkles size={24} />
                  </div>
                {/if}
              </div>

              <div class="partner-card-body">
                <div class="partner-identity-row">
                  <div class="partner-logo-cluster">
                    {#if req.meta?.logo_id}
                      <img
                        src="/media/{req.meta.logo_id}"
                        alt="Logo {req.scan_name}"
                        class="partner-logo-img"
                      />
                    {:else}
                      <div class="partner-logo-fallback">
                        {req.scan_name.slice(0, 2).toUpperCase()}
                      </div>
                    {/if}
                    <div class="partner-name-col">
                      <div class="partner-badge-row">
                        <span class="partner-slug-badge">/scans/{req.scan_slug}</span>
                        <span class="status-pill-scan {req.status.toLowerCase()}">
                          {req.status === 'PENDING' ? 'PENDENTE' : req.status === 'APPROVED' ? 'APROVADA' : 'RECUSADA'}
                        </span>
                      </div>
                      <h3 class="partner-scan-name">{req.scan_name}</h3>
                    </div>
                  </div>
                </div>

                <!-- Applicant Meta -->
                <div class="applicant-box">
                  <div class="applicant-user">
                    <UserAvatar
                      avatarId={req.applicant?.avatar_id}
                      crop={req.applicant?.avatar_crop}
                      displayName={req.applicant?.display_name || req.applicant?.username || 'Candidato'}
                      size={28}
                    />
                    <div class="applicant-info">
                      <span class="applicant-label">Candidato:</span>
                      <strong class="applicant-name">{req.applicant?.display_name || req.applicant?.username}</strong>
                      <span class="applicant-date">em {new Date(req.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                </div>

                <!-- Description & Links -->
                {#if req.description}
                  <p class="partner-desc">{req.description}</p>
                {/if}

                {#if req.meta?.message}
                  <div class="partner-message-quote">
                    <strong>Mensagem da Scan:</strong>
                    <p>"{req.meta.message}"</p>
                  </div>
                {/if}

                <div class="partner-chips-row">
                  {#if req.discord}
                    <a href={req.discord} target="_blank" rel="noopener noreferrer" class="link-badge">
                      <MessageSquare size={12} />
                      <span>Discord</span>
                    </a>
                  {/if}
                  {#if req.website}
                    <a href={req.website} target="_blank" rel="noopener noreferrer" class="link-badge">
                      <Globe size={12} />
                      <span>Website</span>
                    </a>
                  {/if}
                  {#if req.fluxer}
                    <span class="link-badge">Fluxer: {req.fluxer}</span>
                  {/if}
                  {#if req.meta?.sample_links}
                    <span class="link-badge sample" title={req.meta.sample_links}>
                      Obras de Amostra Informadas
                    </span>
                  {/if}
                </div>

                {#if req.rejection_reason}
                  <div class="rejection-box">
                    <strong>Motivo da recusa:</strong> {req.rejection_reason}
                  </div>
                {/if}

                <!-- Actions -->
                <div class="partner-card-actions">
                  <button
                    type="button"
                    class="btn-action-preview"
                    onclick={() => (previewPartnerReq = req)}
                  >
                    <Eye size={14} />
                    <span>Pré-Visualizar Página</span>
                  </button>

                  {#if req.status === 'PENDING'}
                    <div class="review-btn-group">
                      <button
                        type="button"
                        class="btn-action-success"
                        disabled={busy}
                        onclick={() => approveScan(req)}
                      >
                        <Check size={14} />
                        <span>Aprovar Scan</span>
                      </button>
                      <button
                        type="button"
                        class="btn-action-danger"
                        disabled={busy}
                        onclick={() => openRejectScanModal(req)}
                      >
                        <X size={14} />
                        <span>Recusar</span>
                      </button>
                    </div>
                  {/if}
                </div>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  <!-- TAB 3: MODERAÇÃO (ADMIN ONLY) -->
  {#if activeTab === 'moderacao' && data.isAdmin}
    <section class="tab-panel" aria-label="Moderação da Comunidade">
      <!-- Status Filters -->
      <div class="toolbar-bar">
        <div class="filter-pills-row">
          <button
            type="button"
            class="filter-pill"
            class:active={currentStatus === 'ALL'}
            onclick={() => setStatusFilter('ALL')}
          >
            Todas ({data.moderationStatusCounts.ALL})
          </button>
          <button
            type="button"
            class="filter-pill pill-alert"
            class:active={currentStatus === 'NOVO'}
            onclick={() => setStatusFilter('NOVO')}
          >
            Novas ({data.moderationStatusCounts.NOVO})
          </button>
          <button
            type="button"
            class="filter-pill pill-warn"
            class:active={currentStatus === 'EM_ANALISE'}
            onclick={() => setStatusFilter('EM_ANALISE')}
          >
            Em Análise ({data.moderationStatusCounts.EM_ANALISE})
          </button>
          <button
            type="button"
            class="filter-pill pill-success"
            class:active={currentStatus === 'RESOLVIDO'}
            onclick={() => setStatusFilter('RESOLVIDO')}
          >
            Resolvidas ({data.moderationStatusCounts.RESOLVIDO})
          </button>
          <button
            type="button"
            class="filter-pill"
            class:active={currentStatus === 'REJEITADO'}
            onclick={() => setStatusFilter('REJEITADO')}
          >
            Dispensadas ({data.moderationStatusCounts.REJEITADO})
          </button>
        </div>
      </div>

      <!-- Moderation Items List -->
      {#if data.moderationReports.length === 0}
        <div class="empty-state">
          <ShieldAlert size={40} class="empty-icon" />
          <h3>Nenhuma ocorrência de moderação</h3>
          <p>Nenhuma denúncia de comentário ou usuário aguardando intervenção.</p>
        </div>
      {:else}
        <div class="moderation-cards-list">
          {#each data.moderationReports as rep (rep.id)}
            <article class="mod-card">
              <div class="mod-card-header">
                <div class="mod-target-cluster">
                  <span class="mod-type-pill">{rep.target_type === 'COMMENT' ? 'COMENTÁRIO' : 'USUÁRIO'}</span>
                  <span class="mod-reason-tag">{rep.reason}</span>
                  {#if rep.details}
                    <span class="mod-details-preview">"{rep.details}"</span>
                  {/if}
                </div>

                <div class="mod-status-cluster">
                  <span class="status-badge status-{rep.status.toLowerCase()}">
                    {rep.status === 'NOVO' ? 'NOVO' : rep.status === 'EM_ANALISE' ? 'EM ANÁLISE' : rep.status === 'RESOLVIDO' ? 'RESOLVIDO' : 'DISPENSADO'}
                  </span>
                  <span class="mod-date">{new Date(rep.created_at).toLocaleString('pt-BR')}</span>
                </div>
              </div>

              <!-- Reported Comment Body -->
              {#if rep.comment}
                <div class="mod-content-box" class:comment-removed={rep.comment.removed}>
                  <div class="comment-author-strip">
                    <UserAvatar
                      avatarId={rep.comment.author?.avatar_id}
                      crop={rep.comment.author?.avatar_crop}
                      displayName={rep.comment.author?.display_name || rep.comment.author?.username || 'Autor'}
                      size={26}
                    />
                    <div class="comment-author-meta">
                      <strong>{rep.comment.author?.display_name || rep.comment.author?.username || 'Usuário'}</strong>
                      <span class="comment-created">em {new Date(rep.comment.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                    <span class="comment-vis-badge {rep.comment.removed ? 'removed' : 'visible'}">
                      {rep.comment.removed ? 'Ocultado' : 'Visível no Site'}
                    </span>
                  </div>

                  <blockquote class="comment-quote-text">
                    {rep.comment.body}
                  </blockquote>
                </div>
              {/if}

              <!-- Reporter Meta -->
              <div class="mod-reporter-footer">
                <div class="reporter-chip">
                  <User size={13} />
                  <span>Denunciado por <strong>{rep.reporter?.display_name || rep.reporter?.username || 'Anônimo'}</strong></span>
                </div>

                <!-- Moderation Actions -->
                <div class="mod-actions-cluster">
                  {#if rep.comment}
                    {#if rep.comment.removed}
                      <button
                        type="button"
                        class="btn-action-ghost"
                        disabled={busy}
                        onclick={() => moderate('unhide', { reportId: rep.id, commentId: rep.comment.id })}
                      >
                        <Eye size={14} />
                        <span>Restaurar</span>
                      </button>
                    {:else}
                      <button
                        type="button"
                        class="btn-action-warning"
                        disabled={busy}
                        onclick={() => moderate('hide', { reportId: rep.id, commentId: rep.comment.id })}
                      >
                        <EyeOff size={14} />
                        <span>Ocultar Comentário</span>
                      </button>
                    {/if}

                    <button
                      type="button"
                      class="btn-action-danger"
                      disabled={busy}
                      onclick={() => moderate('delete', { reportId: rep.id, commentId: rep.comment.id })}
                    >
                      <Trash2 size={14} />
                      <span>Excluir</span>
                    </button>

                    {#if rep.comment.author?.id}
                      <button
                        type="button"
                        class="btn-action-danger"
                        disabled={busy}
                        onclick={() => moderate('suspend_user', { reportId: rep.id, targetUserId: rep.comment.author.id })}
                      >
                        <UserX size={14} />
                        <span>Suspender Autor</span>
                      </button>
                    {/if}
                  {/if}

                  <button
                    type="button"
                    class="btn-action-success"
                    disabled={busy}
                    onclick={() => moderate('resolve_report', { reportId: rep.id })}
                  >
                    <Check size={14} />
                    <span>Concluir</span>
                  </button>

                  <button
                    type="button"
                    class="btn-action-ghost"
                    disabled={busy}
                    onclick={() => moderate('dismiss_report', { reportId: rep.id })}
                  >
                    <X size={14} />
                    <span>Dispensar</span>
                  </button>
                </div>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</div>

<!-- MODAL: Resolução de Relatório -->
{#if resolveModalOpen}
  <div class="modal-backdrop" onclick={() => (resolveModalOpen = false)}></div>
  <div class="modal-dialog">
    <div class="modal-header">
      <h3>{resolveNewStatus === 'RESOLVIDO' ? 'Resolver Relatório' : 'Rejeitar Relatório'}</h3>
      <button type="button" class="btn-close" onclick={() => (resolveModalOpen = false)}><X size={18} /></button>
    </div>
    <form onsubmit={submitResolveModal} class="modal-form">
      <p class="modal-desc">
        Adicione uma anotação sobre a ação tomada. O denunciante receberá uma notificação atualizando o estado do ticket.
      </p>
      <div class="form-group">
        <label for="resolve-notes">Nota de Resolução (opcional):</label>
        <textarea
          id="resolve-notes"
          bind:value={resolveNotes}
          placeholder="Ex: Capítulo corrigido / Página recolocada / Imagens re-upadas."
          rows={4}
        ></textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick={() => (resolveModalOpen = false)}>Cancelar</button>
        <button type="submit" class="btn-primary" disabled={busy}>
          {busy ? 'Processando...' : resolveNewStatus === 'RESOLVIDO' ? 'Marcar como Resolvido' : 'Confirmar Rejeição'}
        </button>
      </div>
    </form>
  </div>
{/if}

<!-- MODAL: Recusa de Inscrição de Scan -->
{#if rejectScanModalOpen}
  <div class="modal-backdrop" onclick={() => (rejectScanModalOpen = false)}></div>
  <div class="modal-dialog">
    <div class="modal-header">
      <h3>Recusar Candidatura: {rejectScanName}</h3>
      <button type="button" class="btn-close" onclick={() => (rejectScanModalOpen = false)}><X size={18} /></button>
    </div>
    <form onsubmit={submitRejectScan} class="modal-form">
      <p class="modal-desc">
        Informe o motivo da recusa. O candidato receberá este feedback diretamente no painel e por notificação.
      </p>
      <div class="form-group">
        <label for="reject-reason">Motivo da Recusa:</label>
        <textarea
          id="reject-reason"
          bind:value={rejectScanReason}
          placeholder="Ex: Obras já vinculadas a outra equipe parceira / Falta de amostras válidas / Links indisponíveis."
          rows={4}
          required
        ></textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick={() => (rejectScanModalOpen = false)}>Voltar</button>
        <button type="submit" class="btn-danger-solid" disabled={busy}>
          {busy ? 'Processando...' : 'Confirmar Recusa'}
        </button>
      </div>
    </form>
  </div>
{/if}

<!-- MODAL: Pré-Visualização Realista da Scan (Idêntica ao Hub & Perfil Público) -->
{#if previewPartnerReq}
  <div class="modal-backdrop preview-backdrop" onclick={() => (previewPartnerReq = null)}></div>
  <div class="modal-dialog preview-dialog" role="dialog" aria-modal="true">
    <div class="preview-modal-header">
      <div class="preview-title-box">
        <span class="preview-tag">PRÉ-VISUALIZAÇÃO DA PÁGINA PÚBLICA</span>
        <h3>{previewPartnerReq.scan_name}</h3>
      </div>
      <button type="button" class="btn-close" onclick={() => (previewPartnerReq = null)}><X size={20} /></button>
    </div>

    <div class="preview-modal-body">
      <!-- Simulated Scan Banner & Profile -->
      <div class="mock-scan-page">
        <div class="mock-banner-container">
          {#if previewPartnerReq.meta?.banner_id}
            <img
              src="/media/{previewPartnerReq.meta.banner_id}"
              alt="Banner {previewPartnerReq.scan_name}"
              class="mock-banner-img"
            />
          {:else}
            <div class="mock-banner-empty">
              <span>Sem banner customizado</span>
            </div>
          {/if}
          <div class="mock-banner-overlay"></div>
        </div>

        <div class="mock-profile-strip">
          <div class="mock-logo-wrapper">
            {#if previewPartnerReq.meta?.logo_id}
              <img
                src="/media/{previewPartnerReq.meta.logo_id}"
                alt="Logo {previewPartnerReq.scan_name}"
                class="mock-logo-img"
              />
            {:else}
              <div class="mock-logo-empty">
                {previewPartnerReq.scan_name.slice(0, 2).toUpperCase()}
              </div>
            {/if}
          </div>

          <div class="mock-profile-meta">
            <h2 class="mock-scan-title">{previewPartnerReq.scan_name}</h2>
            <span class="mock-scan-slug">/scans/{previewPartnerReq.scan_slug}</span>
            <p class="mock-scan-desc">{previewPartnerReq.description || 'Nenhuma descrição fornecida.'}</p>
          </div>
        </div>

        <!-- Candidate Dossier Details -->
        <div class="mock-dossier-box">
          <h4>Dados da Inscrição Enviada:</h4>
          <dl class="dossier-dl">
            <dt>Candidato Responsável:</dt>
            <dd>{previewPartnerReq.applicant?.display_name || previewPartnerReq.applicant?.username} (@{previewPartnerReq.applicant?.username})</dd>

            {#if previewPartnerReq.discord}
              <dt>Discord:</dt>
              <dd><a href={previewPartnerReq.discord} target="_blank" rel="noopener noreferrer">{previewPartnerReq.discord}</a></dd>
            {/if}

            {#if previewPartnerReq.website}
              <dt>Website:</dt>
              <dd><a href={previewPartnerReq.website} target="_blank" rel="noopener noreferrer">{previewPartnerReq.website}</a></dd>
            {/if}

            {#if previewPartnerReq.fluxer}
              <dt>Fluxer:</dt>
              <dd>{previewPartnerReq.fluxer}</dd>
            {/if}

            {#if previewPartnerReq.meta?.sample_links}
              <dt>Amostras de Tradução:</dt>
              <dd>{previewPartnerReq.meta.sample_links}</dd>
            {/if}

            {#if previewPartnerReq.meta?.message}
              <dt>Mensagem à Administração:</dt>
              <dd class="dossier-message">"{previewPartnerReq.meta.message}"</dd>
            {/if}
          </dl>
        </div>
      </div>
    </div>

    <div class="preview-modal-footer">
      <button type="button" class="btn-secondary" onclick={() => (previewPartnerReq = null)}>Fechar Prévia</button>
      {#if previewPartnerReq.status === 'PENDING'}
        <button
          type="button"
          class="btn-action-success"
          disabled={busy}
          onclick={() => {
            const req = previewPartnerReq;
            previewPartnerReq = null;
            approveScan(req);
          }}
        >
          <Check size={16} />
          <span>Aprovar Scan</span>
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .tickets-workspace {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-bottom: 60px;
  }

  /* Header */
  .tickets-header {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .header-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(223, 194, 141, 0.12);
    border: 1px solid rgba(223, 194, 141, 0.28);
    color: #dfc28d;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 750;
    letter-spacing: 0.05em;
    width: fit-content;
  }
  .header-title {
    font-size: 26px;
    font-weight: 850;
    color: #f8fafc;
    margin: 0;
    letter-spacing: -0.02em;
  }
  .header-desc {
    font-size: 14px;
    color: #94a3b8;
    margin: 0;
    max-width: 720px;
  }

  /* Feedback Banner */
  .feedback-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 10px;
    font-size: 13.5px;
    font-weight: 650;
  }
  .feedback-banner.success {
    background: rgba(34, 197, 94, 0.14);
    border: 1px solid rgba(34, 197, 94, 0.35);
    color: #4ade80;
  }
  .feedback-banner.error {
    background: rgba(239, 68, 68, 0.14);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #f87171;
  }

  /* Stats Highlights */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }
  .stat-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 18px;
    background: rgba(18, 22, 34, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    position: relative;
    backdrop-filter: blur(8px);
  }
  .stat-card.stat-total {
    border-color: rgba(223, 194, 141, 0.3);
    background: linear-gradient(135deg, rgba(223, 194, 141, 0.08) 0%, rgba(18, 22, 34, 0.95) 100%);
  }
  .stat-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    flex-shrink: 0;
  }
  .stat-icon-wrapper.total {
    background: rgba(223, 194, 141, 0.18);
    color: #dfc28d;
  }
  .stat-icon-wrapper.reports {
    background: rgba(245, 158, 11, 0.18);
    color: #fbbf24;
  }
  .stat-icon-wrapper.scans {
    background: rgba(168, 85, 247, 0.18);
    color: #c084fc;
  }
  .stat-icon-wrapper.moderation {
    background: rgba(239, 68, 68, 0.18);
    color: #f87171;
  }

  .stat-meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .stat-label {
    font-size: 11.5px;
    color: #94a3b8;
    font-weight: 600;
  }
  .stat-value {
    font-size: 22px;
    font-weight: 850;
    color: #f8fafc;
    line-height: 1.1;
  }
  .stat-pill {
    position: absolute;
    top: 14px;
    right: 14px;
    font-size: 10px;
    font-weight: 750;
    padding: 2px 7px;
    border-radius: 999px;
  }
  .stat-pill.alert {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.35);
  }
  .stat-pill.warning {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.35);
  }
  .stat-pill.gold {
    background: rgba(223, 194, 141, 0.2);
    color: #dfc28d;
    border: 1px solid rgba(223, 194, 141, 0.35);
  }
  .stat-pill.clean {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  /* Tabs Nav */
  .tabs-nav-bar {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .tabs-cluster {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 2px;
  }
  .tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border: none;
    background: transparent;
    color: #94a3b8;
    font-size: 13.5px;
    font-weight: 650;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s ease;
    white-space: nowrap;
  }
  .tab-btn:hover {
    color: #f1f5f9;
  }
  .tab-btn.active {
    color: #dfc28d;
    border-bottom-color: #dfc28d;
  }
  .tab-badge {
    padding: 1px 6px;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 750;
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.35);
  }
  .tab-badge.gold {
    background: rgba(223, 194, 141, 0.2);
    color: #dfc28d;
    border-color: rgba(223, 194, 141, 0.35);
  }
  .tab-badge.alert {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.35);
  }

  /* Toolbar */
  .toolbar-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 18px;
  }
  .filter-pills-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .filter-pill {
    padding: 5px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
    color: #94a3b8;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.14s ease;
  }
  .filter-pill:hover {
    color: #f1f5f9;
    border-color: rgba(255, 255, 255, 0.18);
  }
  .filter-pill.active {
    background: rgba(223, 194, 141, 0.15);
    border-color: rgba(223, 194, 141, 0.4);
    color: #dfc28d;
    font-weight: 750;
  }
  .filter-pill.pill-alert.active {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.4);
    color: #f87171;
  }
  .filter-pill.pill-warn.active {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.4);
    color: #fbbf24;
  }
  .filter-pill.pill-success.active {
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.4);
    color: #4ade80;
  }
  .filter-pill.pill-gold.active {
    background: rgba(223, 194, 141, 0.18);
    border-color: rgba(223, 194, 141, 0.4);
    color: #dfc28d;
  }

  .filter-select {
    padding: 6px 12px;
    border-radius: 8px;
    background: #141824;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #f1f5f9;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 64px 24px;
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    background: rgba(18, 22, 34, 0.4);
  }
  .empty-icon {
    color: #22c55e;
    margin-bottom: 12px;
  }
  .empty-state h3 {
    font-size: 17px;
    font-weight: 750;
    color: #f8fafc;
    margin: 0 0 6px 0;
  }
  .empty-state p {
    font-size: 13.5px;
    color: #94a3b8;
    margin: 0;
  }

  /* Clusters List */
  .clusters-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .cluster-card {
    background: rgba(18, 22, 34, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    transition: border-color 0.16s ease;
  }
  .cluster-card.has-new {
    border-left: 3px solid #f87171;
  }
  .cluster-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .cluster-target-group {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
    flex: 1;
  }
  .target-cover {
    width: 44px;
    height: 60px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }
  .target-cover-fallback {
    width: 44px;
    height: 60px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    flex-shrink: 0;
  }
  .target-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .target-sub-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .target-type-badge {
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.05em;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    color: #94a3b8;
  }
  .target-date {
    font-size: 11px;
    color: #64748b;
  }
  .target-title {
    font-size: 15px;
    font-weight: 750;
    color: #f1f5f9;
    margin: 0;
    line-height: 1.3;
  }
  .reasons-wrap {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 2px;
  }
  .reason-pill {
    font-size: 11px;
    font-weight: 650;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(239, 68, 68, 0.14);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.28);
  }

  .cluster-status-cluster {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .status-badge {
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.04em;
  }
  .status-badge.status-novo {
    background: rgba(239, 68, 68, 0.16);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.35);
  }
  .status-badge.status-em_analise {
    background: rgba(245, 158, 11, 0.16);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.35);
  }
  .status-badge.status-resolvido {
    background: rgba(34, 197, 94, 0.16);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.35);
  }
  .status-badge.status-rejeitado {
    background: rgba(148, 163, 184, 0.16);
    color: #94a3b8;
    border: 1px solid rgba(148, 163, 184, 0.3);
  }
  .reports-count-pill {
    font-size: 11.5px;
    color: #94a3b8;
    font-weight: 600;
  }

  .cluster-actions-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }
  .left-actions, .right-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .btn-action-ghost {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
    font-size: 12.5px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .btn-action-ghost:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }
  .btn-action-warning {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 7px;
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.35);
    color: #fbbf24;
    font-size: 12.5px;
    font-weight: 650;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .btn-action-warning:hover {
    background: rgba(245, 158, 11, 0.25);
  }
  .btn-action-success {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 7px;
    background: rgba(34, 197, 94, 0.18);
    border: 1px solid rgba(34, 197, 94, 0.4);
    color: #4ade80;
    font-size: 12.5px;
    font-weight: 650;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .btn-action-success:hover {
    background: rgba(34, 197, 94, 0.28);
  }
  .btn-action-danger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 7px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #f87171;
    font-size: 12.5px;
    font-weight: 650;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .btn-action-danger:hover {
    background: rgba(239, 68, 68, 0.25);
  }

  /* Expanded individual reports */
  .cluster-expanded-body {
    padding-top: 12px;
    border-top: 1px dashed rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .expanded-heading {
    font-size: 12px;
    color: #94a3b8;
    margin: 0;
    font-weight: 700;
  }
  .expanded-reports-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .individual-report-item {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .report-user-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .reporter-name {
    font-size: 12.5px;
    font-weight: 700;
    color: #f1f5f9;
  }
  .report-time {
    font-size: 11px;
    color: #64748b;
    margin-left: auto;
  }
  .report-reason-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .report-reason-tag {
    font-size: 12px;
    color: #fbbf24;
  }
  .report-details-text {
    font-size: 12px;
    color: #cbd5e1;
    margin: 0;
    font-style: italic;
  }
  .resolution-notes-box {
    background: rgba(34, 197, 94, 0.08);
    border: 1px solid rgba(34, 197, 94, 0.2);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 11.5px;
    color: #86efac;
  }

  /* Scan Partner Cards Grid */
  .partner-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 20px;
  }
  .partner-card {
    background: rgba(18, 22, 34, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: transform 0.16s ease, border-color 0.16s ease;
  }
  .partner-card.pending-card {
    border-color: rgba(223, 194, 141, 0.35);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  }
  .partner-card-media-banner {
    height: 100px;
    position: relative;
    background: #0d1117;
  }
  .partner-banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .partner-banner-fallback {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, rgba(223, 194, 141, 0.15) 0%, rgba(13, 17, 23, 0.9) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #dfc28d;
  }

  .partner-card-body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
  }
  .partner-identity-row {
    margin-top: -36px;
    position: relative;
    z-index: 2;
  }
  .partner-logo-cluster {
    display: flex;
    align-items: flex-end;
    gap: 12px;
  }
  .partner-logo-img {
    width: 60px;
    height: 60px;
    border-radius: 12px;
    border: 3px solid #121622;
    background: #0d1117;
    object-fit: cover;
    flex-shrink: 0;
  }
  .partner-logo-fallback {
    width: 60px;
    height: 60px;
    border-radius: 12px;
    border: 3px solid #121622;
    background: #1e293b;
    color: #dfc28d;
    font-weight: 850;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .partner-name-col {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    padding-bottom: 2px;
  }
  .partner-badge-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .partner-slug-badge {
    font-size: 10.5px;
    color: #94a3b8;
    font-weight: 600;
  }
  .status-pill-scan {
    font-size: 9.5px;
    font-weight: 800;
    padding: 1px 6px;
    border-radius: 4px;
    letter-spacing: 0.04em;
  }
  .status-pill-scan.pending {
    background: rgba(223, 194, 141, 0.2);
    color: #dfc28d;
    border: 1px solid rgba(223, 194, 141, 0.35);
  }
  .status-pill-scan.approved {
    background: rgba(34, 197, 94, 0.2);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.35);
  }
  .status-pill-scan.rejected {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.35);
  }
  .partner-scan-name {
    font-size: 16px;
    font-weight: 800;
    color: #f8fafc;
    margin: 0;
  }

  .applicant-box {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 8px 10px;
  }
  .applicant-user {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .applicant-info {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
    font-size: 12px;
  }
  .applicant-label {
    color: #64748b;
  }
  .applicant-name {
    color: #f1f5f9;
  }
  .applicant-date {
    color: #64748b;
  }

  .partner-desc {
    font-size: 12.5px;
    color: #94a3b8;
    margin: 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .partner-message-quote {
    background: rgba(223, 194, 141, 0.05);
    border-left: 2px solid #dfc28d;
    padding: 8px 10px;
    border-radius: 4px;
    font-size: 12px;
    color: #cbd5e1;
  }
  .partner-message-quote strong {
    color: #dfc28d;
    display: block;
    margin-bottom: 2px;
  }
  .partner-message-quote p {
    margin: 0;
    font-style: italic;
  }

  .partner-chips-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .link-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 11px;
    color: #94a3b8;
    text-decoration: none;
    font-weight: 600;
  }
  .link-badge:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.08);
  }
  .link-badge.sample {
    color: #c084fc;
    background: rgba(168, 85, 247, 0.1);
    border-color: rgba(168, 85, 247, 0.25);
  }

  .rejection-box {
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 12px;
    color: #fca5a5;
  }

  .partner-card-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: auto;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    flex-wrap: wrap;
  }
  .btn-action-preview {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 7px;
    background: rgba(223, 194, 141, 0.12);
    border: 1px solid rgba(223, 194, 141, 0.3);
    color: #dfc28d;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .btn-action-preview:hover {
    background: rgba(223, 194, 141, 0.22);
  }
  .review-btn-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Moderation Cards */
  .moderation-cards-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .mod-card {
    background: rgba(18, 22, 34, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .mod-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .mod-target-cluster {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .mod-type-pill {
    font-size: 9.5px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(239, 68, 68, 0.18);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.35);
  }
  .mod-reason-tag {
    font-size: 12.5px;
    font-weight: 750;
    color: #f1f5f9;
  }
  .mod-details-preview {
    font-size: 12px;
    color: #94a3b8;
    font-style: italic;
  }
  .mod-status-cluster {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .mod-date {
    font-size: 11px;
    color: #64748b;
  }

  .mod-content-box {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mod-content-box.comment-removed {
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.05);
  }
  .comment-author-strip {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .comment-author-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }
  .comment-created {
    font-size: 11px;
    color: #64748b;
  }
  .comment-vis-badge {
    margin-left: auto;
    font-size: 9.5px;
    font-weight: 800;
    padding: 1px 6px;
    border-radius: 4px;
  }
  .comment-vis-badge.visible {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
  }
  .comment-vis-badge.removed {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }
  .comment-quote-text {
    margin: 0;
    font-size: 13.5px;
    color: #cbd5e1;
    line-height: 1.5;
    padding-left: 10px;
    border-left: 2px solid rgba(255, 255, 255, 0.15);
  }

  .mod-reporter-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    flex-wrap: wrap;
  }
  .reporter-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    color: #64748b;
  }
  .reporter-chip strong {
    color: #94a3b8;
  }
  .mod-actions-cluster {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  /* Modals */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(6px);
    z-index: 1000;
  }
  .modal-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(500px, calc(100vw - 32px));
    background: #111420;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px;
    padding: 24px;
    z-index: 1001;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .modal-header h3 {
    margin: 0;
    font-size: 17px;
    font-weight: 750;
    color: #f8fafc;
  }
  .btn-close {
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;
  }
  .btn-close:hover {
    color: #f1f5f9;
  }
  .modal-desc {
    font-size: 13px;
    color: #94a3b8;
    margin: 0 0 12px 0;
  }
  .modal-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .form-group label {
    font-size: 12px;
    font-weight: 650;
    color: #cbd5e1;
  }
  .form-group textarea {
    background: #0d101a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 10px 12px;
    color: #f1f5f9;
    font-size: 13px;
    resize: vertical;
  }
  .modal-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }
  .btn-secondary {
    padding: 8px 16px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
  }
  .btn-primary {
    padding: 8px 18px;
    border-radius: 8px;
    background: #dfc28d;
    border: 1px solid #dfc28d;
    color: #0b0e14;
    font-size: 13px;
    font-weight: 750;
    cursor: pointer;
  }
  .btn-danger-solid {
    padding: 8px 18px;
    border-radius: 8px;
    background: #ef4444;
    border: 1px solid #ef4444;
    color: #ffffff;
    font-size: 13px;
    font-weight: 750;
    cursor: pointer;
  }

  /* Realistic Scan Preview Modal */
  .preview-dialog {
    width: min(840px, calc(100vw - 32px));
    max-height: 90vh;
    overflow-y: auto;
    padding: 0;
  }
  .preview-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .preview-tag {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: #dfc28d;
  }
  .preview-title-box h3 {
    margin: 2px 0 0 0;
    font-size: 18px;
    color: #f8fafc;
  }
  .preview-modal-body {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .mock-scan-page {
    background: #0b0d14;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    overflow: hidden;
  }
  .mock-banner-container {
    height: 180px;
    position: relative;
    background: #07090e;
  }
  .mock-banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .mock-banner-empty {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #475569;
    font-size: 13px;
  }
  .mock-banner-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(7, 9, 14, 0.1) 0%, rgba(7, 9, 14, 0.9) 100%);
  }
  .mock-profile-strip {
    display: flex;
    align-items: flex-end;
    gap: 18px;
    padding: 0 24px 20px 24px;
    margin-top: -50px;
    position: relative;
    z-index: 2;
  }
  .mock-logo-wrapper {
    flex-shrink: 0;
  }
  .mock-logo-img {
    width: 90px;
    height: 90px;
    border-radius: 18px;
    border: 4px solid #0b0d14;
    object-fit: cover;
    background: #111420;
  }
  .mock-logo-empty {
    width: 90px;
    height: 90px;
    border-radius: 18px;
    border: 4px solid #0b0d14;
    background: #1e293b;
    color: #dfc28d;
    font-size: 28px;
    font-weight: 850;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mock-profile-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .mock-scan-title {
    font-size: 22px;
    font-weight: 850;
    color: #f8fafc;
    margin: 0;
  }
  .mock-scan-slug {
    font-size: 12px;
    color: #94a3b8;
  }
  .mock-scan-desc {
    font-size: 13px;
    color: #cbd5e1;
    margin: 6px 0 0 0;
    line-height: 1.4;
  }

  .mock-dossier-box {
    background: rgba(255, 255, 255, 0.02);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    padding: 18px 24px;
  }
  .mock-dossier-box h4 {
    margin: 0 0 12px 0;
    font-size: 13px;
    color: #dfc28d;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .dossier-dl {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 10px 16px;
    margin: 0;
    font-size: 13px;
  }
  .dossier-dl dt {
    color: #64748b;
    font-weight: 600;
  }
  .dossier-dl dd {
    margin: 0;
    color: #e2e8f0;
  }
  .dossier-dl dd a {
    color: #dfc28d;
    text-decoration: underline;
  }
  .dossier-message {
    font-style: italic;
    color: #cbd5e1;
  }

  .preview-modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  @media (max-width: 768px) {
    .stats-grid {
      grid-template-columns: 1fr 1fr;
    }
    .cluster-header {
      flex-direction: column;
    }
    .cluster-actions-bar {
      flex-direction: column;
      align-items: stretch;
    }
    .left-actions, .right-actions {
      justify-content: stretch;
    }
    .btn-action-ghost, .btn-action-warning, .btn-action-success, .btn-action-danger {
      flex: 1;
      justify-content: center;
    }
    .mock-profile-strip {
      flex-direction: column;
      align-items: flex-start;
      margin-top: -30px;
    }
    .dossier-dl {
      grid-template-columns: 1fr;
      gap: 4px;
    }
    .dossier-dl dt {
      margin-top: 8px;
    }
  }
</style>
