<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import {
    Ticket,
    Flag,
    FileCheck,
    ShieldAlert,
    ShieldCheck,
    Clock,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    AlertCircle,
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
    Layers,
    MapPin,
    CornerDownRight,
    Quote,
    ArrowRight
  } from '@lucide/svelte';
  import UserAvatar from '$lib/components/UserAvatar.svelte';

  let { data } = $props();

  let activeTab = $derived(data.activeTab || 'relatorios');
  let currentStatus = $derived(data.statusFilter || (activeTab === 'scans' ? 'PENDING' : 'NOVO'));
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
    goto(url.toString(), { keepFocus: true });
  }

  function setStatusFilter(status: string) {
    const url = new URL(page.url);
    url.searchParams.set('status', status);
    goto(url.toString(), { keepFocus: true, noScroll: true });
  }

  function setTypeFilter(t: string) {
    const url = new URL(page.url);
    url.searchParams.set('type', t);
    goto(url.toString(), { keepFocus: true, noScroll: true });
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
  <!-- Dynamic Top Header Cluster -->
  <header class="tickets-header" class:reports-theme={activeTab === 'relatorios'} class:scans-theme={activeTab === 'scans'} class:moderation-theme={activeTab === 'moderacao'}>
    <div class="header-main">
      {#if activeTab === 'relatorios'}
        <div class="header-badge amber-badge">
          <Flag size={14} />
          <span>SUPORTE EDITORIAL</span>
        </div>
        <h1 class="header-title">Relatórios de Conteúdo</h1>
        <p class="header-desc">
          Triagem e atendimento de inconsistências, capítulos quebrados e defeitos relatados em obras e páginas.
        </p>
      {:else if activeTab === 'scans'}
        <div class="header-badge gold-badge">
          <FileCheck size={14} />
          <span>ADMISSÃO DE PARCEIROS</span>
        </div>
        <h1 class="header-title">Inscrições de Scans</h1>
        <p class="header-desc">
          Avaliação de candidaturas, conformidade de material e concessão de permissões de publicação.
        </p>
      {:else}
        <div class="header-badge crimson-badge">
          <ShieldAlert size={14} />
          <span>SENTINEL — MODERAÇÃO</span>
        </div>
        <h1 class="header-title">Moderação Comunitária</h1>
        <p class="header-desc">
          Monitoramento e ações disciplinares sobre comentários denunciados, visibilidade e aplicação de suspensões.
        </p>
      {/if}
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

  <!-- Metric Highlights Bar (Specific to the Active Section) -->
  <section class="stats-grid" aria-label="Indicadores da área">
    {#if activeTab === 'relatorios'}
      <div class="stat-card" class:stat-alert={data.contentStatusCounts.NOVO > 0}>
        <div class="stat-icon-wrapper reports">
          <Flag size={20} />
        </div>
        <div class="stat-meta">
          <span class="stat-label">Novos / Abertos</span>
          <span class="stat-value">{data.contentStatusCounts.NOVO}</span>
        </div>
        <span class="stat-pill {data.contentStatusCounts.NOVO > 0 ? 'warning' : 'clean'}">
          {data.contentStatusCounts.NOVO > 0 ? 'Triagem Pendente' : 'Em Dia'}
        </span>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper reports-analise">
          <Clock size={20} />
        </div>
        <div class="stat-meta">
          <span class="stat-label">Em Análise</span>
          <span class="stat-value">{data.contentStatusCounts.EM_ANALISE}</span>
        </div>
        <span class="stat-pill {data.contentStatusCounts.EM_ANALISE > 0 ? 'info' : 'clean'}">
          {data.contentStatusCounts.EM_ANALISE} em atendimento
        </span>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper reports-resolvido">
          <CheckCircle2 size={20} />
        </div>
        <div class="stat-meta">
          <span class="stat-label">Resolvidos</span>
          <span class="stat-value">{data.contentStatusCounts.RESOLVIDO}</span>
        </div>
        <span class="stat-pill clean">
          {data.contentStatusCounts.RESOLVIDO} corrigidos
        </span>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper total">
          <Ticket size={20} />
        </div>
        <div class="stat-meta">
          <span class="stat-label">Total de Relatórios</span>
          <span class="stat-value">{data.contentStatusCounts.ALL}</span>
        </div>
        <span class="stat-pill clean">Histórico</span>
      </div>
    {:else if activeTab === 'scans'}
      <div class="stat-card" class:stat-alert={data.partnerStatusCounts.PENDING > 0}>
        <div class="stat-icon-wrapper scans">
          <FileCheck size={20} />
        </div>
        <div class="stat-meta">
          <span class="stat-label">Pendentes de Avaliação</span>
          <span class="stat-value">{data.partnerStatusCounts.PENDING}</span>
        </div>
        <span class="stat-pill {data.partnerStatusCounts.PENDING > 0 ? 'gold' : 'clean'}">
          {data.partnerStatusCounts.PENDING > 0 ? 'Aguardando Análise' : 'Em Dia'}
        </span>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper reports-resolvido">
          <CheckCircle2 size={20} />
        </div>
        <div class="stat-meta">
          <span class="stat-label">Aprovadas</span>
          <span class="stat-value">{data.partnerStatusCounts.APPROVED}</span>
        </div>
        <span class="stat-pill clean">
          {data.partnerStatusCounts.APPROVED} parceiras
        </span>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper reports-rejeitado">
          <XCircle size={20} />
        </div>
        <div class="stat-meta">
          <span class="stat-label">Recusadas</span>
          <span class="stat-value">{data.partnerStatusCounts.REJECTED}</span>
        </div>
        <span class="stat-pill clean">
          {data.partnerStatusCounts.REJECTED} indeferidas
        </span>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper total">
          <Ticket size={20} />
        </div>
        <div class="stat-meta">
          <span class="stat-label">Total de Candidaturas</span>
          <span class="stat-value">{data.partnerStatusCounts.ALL}</span>
        </div>
        <span class="stat-pill clean">Histórico</span>
      </div>
    {:else}
      <div class="stat-card" class:stat-alert={data.moderationStatusCounts.NOVO > 0}>
        <div class="stat-icon-wrapper moderation">
          <ShieldAlert size={20} />
        </div>
        <div class="stat-meta">
          <span class="stat-label">Novas Denúncias</span>
          <span class="stat-value">{data.moderationStatusCounts.NOVO}</span>
        </div>
        <span class="stat-pill {data.moderationStatusCounts.NOVO > 0 ? 'alert' : 'clean'}">
          {data.moderationStatusCounts.NOVO > 0 ? 'Ação Necessária' : 'Em Dia'}
        </span>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper reports-analise">
          <Clock size={20} />
        </div>
        <div class="stat-meta">
          <span class="stat-label">Em Análise</span>
          <span class="stat-value">{data.moderationStatusCounts.EM_ANALISE}</span>
        </div>
        <span class="stat-pill {data.moderationStatusCounts.EM_ANALISE > 0 ? 'info' : 'clean'}">
          {data.moderationStatusCounts.EM_ANALISE} investigando
        </span>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper reports-resolvido">
          <CheckCircle2 size={20} />
        </div>
        <div class="stat-meta">
          <span class="stat-label">Resolvidas</span>
          <span class="stat-value">{data.moderationStatusCounts.RESOLVIDO}</span>
        </div>
        <span class="stat-pill clean">
          {data.moderationStatusCounts.RESOLVIDO} tratadas
        </span>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper total">
          <Ticket size={20} />
        </div>
        <div class="stat-meta">
          <span class="stat-label">Total no Histórico</span>
          <span class="stat-value">{data.moderationStatusCounts.ALL}</span>
        </div>
        <span class="stat-pill clean">Registros</span>
      </div>
    {/if}
  </section>

  <!-- TAB 1: RELATÓRIOS DE CONTEÚDO -->
  {#if activeTab === 'relatorios'}
    <section class="tab-panel" aria-label="Relatórios de Conteúdo">
      <!-- Filter Controls Toolbar -->
      <div class="toolbar-bar">
        <div class="filter-pills-row">
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
            Dispensados ({data.contentStatusCounts.REJEITADO})
          </button>
          <button
            type="button"
            class="filter-pill"
            class:active={currentStatus === 'ALL'}
            onclick={() => setStatusFilter('ALL')}
          >
            Todos ({data.contentStatusCounts.ALL})
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
          {#if currentStatus === 'NOVO'}
            <CheckCircle2 size={42} class="empty-icon text-amber" />
            <h3>Nenhuma nova pendência. Tudo em dia!</h3>
            <p>Não há novos relatórios de conteúdo aguardando atendimento inicial.</p>
            {#if data.contentStatusCounts.EM_ANALISE > 0}
              <button type="button" class="btn-empty-shortcut" onclick={() => setStatusFilter('EM_ANALISE')}>
                <span>Ver {data.contentStatusCounts.EM_ANALISE} {data.contentStatusCounts.EM_ANALISE === 1 ? 'relatório em análise' : 'relatórios em análise'}</span>
                <ArrowRight size={14} />
              </button>
            {/if}
          {:else}
            <CheckCircle2 size={40} class="empty-icon" />
            <h3>Nenhum relatório encontrado</h3>
            <p>Não há relatórios de conteúdo correspondentes aos filtros selecionados.</p>
          {/if}
        </div>
      {:else}
        <div class="reports-feed">
          {#each data.clusters as cluster (cluster.clusterKey)}
            {@const leadRep = cluster.reports[0]}
            <article class="report-ticket-card" class:has-new={cluster.newCount > 0}>
              <!-- Header Strip: Target Work, Chapter & Page Badges -->
              <div class="ticket-top-row">
                <div class="ticket-target-info">
                  {#if cluster.coverId}
                    <img
                      src="/media/{cluster.coverId}"
                      alt="Capa de {cluster.workTitle}"
                      class="ticket-work-cover"
                      loading="lazy"
                    />
                  {:else}
                    <div class="ticket-work-cover-fallback">
                      <BookOpen size={20} />
                    </div>
                  {/if}

                  <div class="ticket-title-hierarchy">
                    <div class="ticket-badges-row">
                      <span class="type-pill">{cluster.targetType === 'CHAPTER' ? 'CAPÍTULO' : 'OBRA'}</span>
                      {#if cluster.chapterDisplay}
                        <span class="chapter-highlight-pill">Cap. {cluster.chapterDisplay}</span>
                      {/if}
                      {#if leadRep?.pageNumber}
                        <span class="page-highlight-pill">
                          <Layers size={11} />
                          Página {leadRep.pageNumber}
                        </span>
                      {/if}
                    </div>

                    <h3 class="ticket-work-title">
                      {#if leadRep?.workSlug}
                        <a href="/obra/{leadRep.workSlug}" target="_blank" rel="noopener noreferrer" class="work-link">
                          {cluster.workTitle}
                        </a>
                      {:else}
                        {cluster.workTitle}
                      {/if}
                    </h3>
                  </div>
                </div>

                <div class="ticket-status-box">
                  <span class="status-badge status-{cluster.status.toLowerCase()}">
                    {cluster.status === 'NOVO' ? 'ABERTO / NOVO' : cluster.status === 'EM_ANALISE' ? 'EM ANÁLISE' : cluster.status === 'RESOLVIDO' ? 'RESOLVIDO' : 'REJEITADO'}
                  </span>
                  <span class="ticket-date">{new Date(cluster.latestCreatedAt).toLocaleString('pt-BR')}</span>
                </div>
              </div>

              <!-- Defect Summary & Details -->
              <div class="ticket-body-section">
                <div class="problem-category-strip">
                  <span class="problem-label">Problema:</span>
                  <div class="reasons-pills-list">
                    {#each cluster.reasons as reason}
                      <span class="reason-pill-amber">
                        <AlertTriangle size={12} />
                        {reason}
                      </span>
                    {/each}
                  </div>
                </div>

                {#if leadRep?.cleanDetails}
                  <div class="report-quote-block">
                    <Quote size={15} class="quote-icon" />
                    <p class="report-quote-text">"{leadRep.cleanDetails}"</p>
                  </div>
                {/if}

                {#if leadRep?.resolution_notes}
                  <div class="resolution-notes-callout">
                    <CheckCircle2 size={14} class="res-icon" />
                    <div>
                      <strong>Nota da Resolução:</strong>
                      <span>{leadRep.resolution_notes}</span>
                    </div>
                  </div>
                {/if}
              </div>

              <!-- Reporter Meta Row -->
              <div class="ticket-reporter-strip">
                <div class="reporter-info-pill">
                  <UserAvatar
                    avatarId={leadRep?.reporter?.avatar_id}
                    crop={leadRep?.reporter?.avatar_crop}
                    displayName={leadRep?.reporter?.display_name || leadRep?.reporter?.username || 'Leitor'}
                    size={22}
                  />
                  <span>Reportado por: <strong>{leadRep?.reporter?.display_name || leadRep?.reporter?.username || 'Leitor anônimo'}</strong></span>
                </div>

                {#if cluster.count > 1}
                  <button
                    type="button"
                    class="btn-cluster-toggle"
                    onclick={() => toggleCluster(cluster.clusterKey)}
                  >
                    {#if expandedClusters[cluster.clusterKey]}
                      <ChevronDown size={14} />
                      <span>Ocultar outras denúncias</span>
                    {:else}
                      <ChevronRight size={14} />
                      <span>Ver todas as denúncias deste item ({cluster.count})</span>
                    {/if}
                  </button>
                {/if}
              </div>

              <!-- Expanded Detailed Reports for Clusters with >1 report -->
              {#if expandedClusters[cluster.clusterKey] && cluster.reports.length > 1}
                <div class="cluster-subreports-drawer">
                  <h4 class="subreports-title">Outros reportes agrupados nesta mesma obra/capítulo:</h4>
                  <div class="subreports-list">
                    {#each cluster.reports.slice(1) as subRep}
                      <div class="subreport-card">
                        <div class="subreport-header">
                          <div class="subreport-reporter">
                            <UserAvatar
                              avatarId={subRep.reporter?.avatar_id}
                              crop={subRep.reporter?.avatar_crop}
                              displayName={subRep.reporter?.display_name || subRep.reporter?.username || 'Leitor'}
                              size={20}
                            />
                            <span>{subRep.reporter?.display_name || subRep.reporter?.username || 'Leitor'}</span>
                            <span class="subreport-date">{new Date(subRep.created_at).toLocaleString('pt-BR')}</span>
                          </div>
                          {#if subRep.pageNumber}
                            <span class="page-pill-mini">Página {subRep.pageNumber}</span>
                          {/if}
                        </div>
                        <div class="subreport-content">
                          <span class="subreport-reason">{subRep.reason}</span>
                          {#if subRep.cleanDetails}
                            <p class="subreport-text">"{subRep.cleanDetails}"</p>
                          {/if}
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Actions Strip -->
              <div class="ticket-actions-bar">
                <!-- MANDATORY PRIMARY ACTION: Ir para o Problema -->
                {#if cluster.targetLink}
                  <a
                    href={cluster.targetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-primary-problem"
                  >
                    <ExternalLink size={15} />
                    <span>Ir para o Problema</span>
                  </a>
                {/if}

                <div class="ticket-workflow-actions">
                  {#if cluster.status === 'NOVO'}
                    <button
                      type="button"
                      class="btn-action-warning"
                      disabled={busy}
                      onclick={() => quickUpdateReportStatus(cluster.reportIds[0], 'EM_ANALISE')}
                      title="Atribuir a si mesmo e iniciar atendimento"
                    >
                      <Clock size={14} />
                      <span>Em Análise</span>
                    </button>
                  {/if}

                  {#if cluster.status !== 'RESOLVIDO'}
                    <button
                      type="button"
                      class="btn-action-success"
                      disabled={busy}
                      onclick={() => openResolveModal(cluster.reportIds[0], 'RESOLVIDO')}
                    >
                      <Check size={14} />
                      <span>Resolver</span>
                    </button>
                  {/if}

                  {#if cluster.status !== 'REJEITADO'}
                    <button
                      type="button"
                      class="btn-action-danger"
                      disabled={busy}
                      onclick={() => openResolveModal(cluster.reportIds[0], 'REJEITADO')}
                    >
                      <X size={14} />
                      <span>Rejeitar</span>
                    </button>
                  {/if}
                </div>
              </div>
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
          <button
            type="button"
            class="filter-pill"
            class:active={currentStatus === 'ALL'}
            onclick={() => setStatusFilter('ALL')}
          >
            Todas ({data.partnerStatusCounts.ALL})
          </button>
        </div>
      </div>

      <!-- Scans List -->
      {#if data.partnerRequests.length === 0}
        <div class="empty-state">
          {#if currentStatus === 'PENDING'}
            <FileCheck size={42} class="empty-icon text-gold" />
            <h3>Nenhuma nova pendência. Tudo em dia!</h3>
            <p>Todas as candidaturas de scans parceiras foram avaliadas.</p>
          {:else}
            <FileCheck size={40} class="empty-icon" />
            <h3>Nenhuma inscrição encontrada</h3>
            <p>Nenhuma inscrição de scan parceira encontrada para o filtro selecionado.</p>
          {/if}
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
          <button
            type="button"
            class="filter-pill"
            class:active={currentStatus === 'ALL'}
            onclick={() => setStatusFilter('ALL')}
          >
            Todas ({data.moderationStatusCounts.ALL})
          </button>
        </div>
      </div>

      <!-- Moderation Items List -->
      {#if data.moderationReports.length === 0}
        <div class="empty-state">
          {#if currentStatus === 'NOVO'}
            <ShieldCheck size={42} class="empty-icon text-violet" />
            <h3>Nenhuma nova pendência. Tudo em dia!</h3>
            <p>Nenhuma nova ocorrência ou denúncia pendente de triagem no momento.</p>
            {#if data.moderationStatusCounts.EM_ANALISE > 0}
              <button type="button" class="btn-empty-shortcut" onclick={() => setStatusFilter('EM_ANALISE')}>
                <span>Ver {data.moderationStatusCounts.EM_ANALISE} {data.moderationStatusCounts.EM_ANALISE === 1 ? 'ocorrência em análise' : 'ocorrências em análise'}</span>
                <ArrowRight size={14} />
              </button>
            {/if}
          {:else}
            <ShieldAlert size={40} class="empty-icon text-rose" />
            <h3>Nenhuma ocorrência encontrada</h3>
            <p>Nenhuma denúncia de comentário corresponde ao filtro selecionado.</p>
          {/if}
        </div>
      {:else}
        <div class="moderation-feed">
          {#each data.moderationReports as rep (rep.id)}
            <article class="mod-sentinel-card" class:is-new={rep.status === 'NOVO'}>
              <!-- Header Bar: Author, Suspension Status & Visibility Pill -->
              <div class="mod-header-row">
                <div class="mod-author-group">
                  <UserAvatar
                    avatarId={rep.comment?.author?.avatar_id}
                    crop={rep.comment?.author?.avatar_crop}
                    displayName={rep.comment?.author?.display_name || rep.comment?.author?.username || 'Autor'}
                    size={38}
                  />
                  <div class="mod-author-meta">
                    <div class="mod-author-name-line">
                      <strong class="mod-author-name">
                        {rep.comment?.author?.display_name || rep.comment?.author?.username || 'Usuário Desconhecido'}
                      </strong>
                      {#if rep.comment?.author?.username}
                        <span class="mod-author-handle">@{rep.comment.author.username}</span>
                      {/if}
                      {#if rep.isAuthorSuspended}
                        <span class="badge-author-suspended">
                          <UserX size={11} />
                          SUSPENSO
                        </span>
                      {/if}
                    </div>

                    <!-- Location info with link -->
                    <div class="mod-location-line">
                      <MapPin size={12} class="pin-icon" />
                      <span>Publicado em:</span>
                      {#if rep.siteLink}
                        <a href={rep.siteLink} target="_blank" rel="noopener noreferrer" class="mod-location-link">
                          {rep.locationLabel}
                        </a>
                      {:else}
                        <span class="mod-location-text">{rep.locationLabel}</span>
                      {/if}
                    </div>
                  </div>
                </div>

                <div class="mod-status-group">
                  <!-- Visibility Status Pill -->
                  <div class="mod-visibility-pill {rep.visibilityStatus.toLowerCase()}">
                    {#if rep.visibilityStatus === 'VISIBLE'}
                      <Eye size={13} />
                      <span>Visível no site</span>
                    {:else if rep.visibilityStatus === 'HIDDEN'}
                      <EyeOff size={13} />
                      <span>Ocultado pela moderação</span>
                    {:else}
                      <Trash2 size={13} />
                      <span>Excluído</span>
                    {/if}
                  </div>

                  <span class="status-badge status-{rep.status.toLowerCase()}">
                    {rep.status === 'NOVO' ? 'ABERTO / NOVO' : rep.status === 'EM_ANALISE' ? 'EM ANÁLISE' : rep.status === 'RESOLVIDO' ? 'RESOLVIDO' : 'DISPENSADO'}
                  </span>
                </div>
              </div>

              <!-- Context & Reported Content Block -->
              <div class="mod-content-stage">
                <!-- If it was a reply to another comment, show parent comment context -->
                {#if rep.parentComment}
                  <div class="parent-comment-context-box">
                    <div class="parent-context-label">
                      <CornerDownRight size={13} />
                      <span>Em resposta a <strong>@{rep.parentComment.author?.username || 'leitor'}</strong>:</span>
                    </div>
                    <blockquote class="parent-quote-body">
                      "{rep.parentComment.body}"
                    </blockquote>
                  </div>
                {/if}

                <!-- The Reported Comment Body -->
                <div class="reported-quote-card" class:card-hidden={rep.visibilityStatus === 'HIDDEN'}>
                  <div class="quote-header">
                    <Quote size={18} class="quote-icon-crimson" />
                    <span class="quote-header-title">CONTEÚDO DENUNCIADO:</span>
                  </div>
                  {#if rep.comment}
                    <blockquote class="reported-quote-text">
                      {rep.comment.body}
                    </blockquote>
                  {:else}
                    <p class="reported-comment-deleted">[Este comentário foi excluído do banco de dados.]</p>
                  {/if}
                </div>
              </div>

              <!-- Ticket Audit / Reporter Meta -->
              <div class="mod-audit-strip">
                <div class="mod-reason-badge">
                  <ShieldAlert size={13} />
                  <span>Motivo: <strong>{rep.reason}</strong></span>
                </div>

                {#if rep.details}
                  <div class="mod-reporter-note">
                    <span class="note-label">Observação:</span>
                    <span class="note-body">"{rep.details}"</span>
                  </div>
                {/if}

                <div class="mod-reporter-chip">
                  <User size={13} />
                  <span>Denunciado por <strong>@{rep.reporter?.username || 'anônimo'}</strong> em {new Date(rep.created_at).toLocaleString('pt-BR')}</span>
                </div>
              </div>

              {#if rep.resolution_notes}
                <div class="resolution-notes-callout crimson-tint">
                  <CheckCircle2 size={14} class="res-icon" />
                  <div>
                    <strong>Anotação da Moderação:</strong>
                    <span>{rep.resolution_notes}</span>
                  </div>
                </div>
              {/if}

              <!-- Actions Strip: Primary Visualizar no Site + Moderation Actions Suite -->
              <div class="mod-action-footer">
                <!-- PRIMARY ACTION: Visualizar no Site (Disabled with label if deleted) -->
                {#if rep.visibilityStatus !== 'DELETED' && rep.siteLink}
                  <a
                    href={rep.siteLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-primary-site-view"
                    title="Abrir o comentário diretamente na obra ou capítulo"
                  >
                    <ExternalLink size={15} />
                    <span>Visualizar no Site</span>
                  </a>
                {:else}
                  <span class="btn-primary-site-view btn-site-view-disabled" title="Comentário excluído não está mais acessível no site público">
                    <EyeOff size={15} />
                    <span>Removido do Site</span>
                  </span>
                {/if}

                <div class="mod-buttons-cluster">
                  {#if rep.visibilityStatus === 'DELETED'}
                    <span class="mod-status-text alert-text">
                      <Trash2 size={13} />
                      <span>Comentário já excluído</span>
                    </span>
                    <button
                      type="button"
                      class="btn-mod-action btn-restore"
                      disabled={busy}
                      onclick={() => moderate('unhide', { reportId: rep.id, commentId: rep.comment?.id })}
                      title="Restaurar visibilidade do comentário"
                    >
                      <Eye size={14} />
                      <span>Restaurar</span>
                    </button>
                  {:else if rep.comment}
                    {#if rep.comment.removed}
                      <button
                        type="button"
                        class="btn-mod-action btn-restore"
                        disabled={busy}
                        onclick={() => moderate('unhide', { reportId: rep.id, commentId: rep.comment.id })}
                        title="Restaurar comentário ocultado"
                      >
                        <Eye size={14} />
                        <span>Restaurar</span>
                      </button>
                    {:else}
                      <button
                        type="button"
                        class="btn-mod-action btn-hide"
                        disabled={busy}
                        onclick={() => moderate('hide', { reportId: rep.id, commentId: rep.comment.id })}
                        title="Ocultar comentário do site público"
                      >
                        <EyeOff size={14} />
                        <span>Ocultar Comentário</span>
                      </button>
                    {/if}

                    <button
                      type="button"
                      class="btn-mod-action btn-delete"
                      disabled={busy}
                      onclick={() => moderate('delete', { reportId: rep.id, commentId: rep.comment.id })}
                      title="Excluir comentário permanentemente e resolver denúncia"
                    >
                      <Trash2 size={14} />
                      <span>Excluir</span>
                    </button>

                    {#if rep.comment.author?.id && !rep.isAuthorSuspended}
                      <button
                        type="button"
                        class="btn-mod-action btn-suspend"
                        disabled={busy}
                        onclick={() => moderate('suspend_user', { reportId: rep.id, targetUserId: rep.comment.author.id })}
                        title="Suspender este usuário do Project Nox"
                      >
                        <UserX size={14} />
                        <span>Suspender Autor</span>
                      </button>
                    {/if}
                  {/if}

                  {#if rep.status !== 'RESOLVIDO'}
                    <button
                      type="button"
                      class="btn-mod-action btn-resolve"
                      disabled={busy}
                      onclick={() => moderate('resolve_report', { reportId: rep.id })}
                    >
                      <Check size={14} />
                      <span>Resolver</span>
                    </button>
                  {/if}

                  {#if rep.status !== 'REJEITADO'}
                    <button
                      type="button"
                      class="btn-mod-action btn-dismiss"
                      disabled={busy}
                      onclick={() => moderate('dismiss_report', { reportId: rep.id })}
                    >
                      <X size={14} />
                      <span>Dispensar</span>
                    </button>
                  {/if}
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

  /* ========================================================
     RELATÓRIOS (EDITORIAL CONTENT TICKETS)
     ======================================================== */
  .reports-feed {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .report-ticket-card {
    background: rgba(18, 22, 34, 0.92);
    border: 1px solid rgba(223, 194, 141, 0.16);
    border-radius: 16px;
    padding: 20px 22px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
  }
  .report-ticket-card:hover {
    border-color: rgba(223, 194, 141, 0.35);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
  }
  .report-ticket-card.has-new {
    border-left: 4px solid #f59e0b;
  }

  .ticket-top-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .ticket-target-info {
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
    flex: 1;
  }
  .ticket-work-cover {
    width: 52px;
    height: 72px;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    flex-shrink: 0;
  }
  .ticket-work-cover-fallback {
    width: 52px;
    height: 72px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #dfc28d;
    flex-shrink: 0;
  }
  .ticket-title-hierarchy {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .ticket-badges-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .type-pill {
    font-size: 10px;
    font-weight: 850;
    letter-spacing: 0.05em;
    padding: 2px 7px;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.08);
    color: #94a3b8;
  }
  .chapter-highlight-pill {
    font-size: 11px;
    font-weight: 800;
    padding: 2px 9px;
    border-radius: 6px;
    background: rgba(245, 158, 11, 0.18);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.38);
    letter-spacing: 0.02em;
  }
  .page-highlight-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 800;
    padding: 2px 9px;
    border-radius: 6px;
    background: rgba(223, 194, 141, 0.2);
    color: #dfc28d;
    border: 1px solid rgba(223, 194, 141, 0.4);
  }
  .ticket-work-title {
    font-size: 17.5px;
    font-weight: 850;
    color: #f8fafc;
    margin: 0;
    line-height: 1.3;
  }
  .work-link {
    color: #f8fafc;
    text-decoration: none;
    transition: color 0.15s ease;
  }
  .work-link:hover {
    color: #dfc28d;
    text-decoration: underline;
  }

  .ticket-status-box {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }
  .ticket-date {
    font-size: 11px;
    color: #64748b;
  }

  .ticket-body-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: rgba(0, 0, 0, 0.22);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 14px 16px;
  }
  .problem-category-strip {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .problem-label {
    font-size: 12px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .reasons-pills-list {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .reason-pill-amber {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 750;
    padding: 3px 10px;
    border-radius: 999px;
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.35);
  }
  .report-quote-block {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: rgba(245, 158, 11, 0.04);
    border-left: 3px solid #f59e0b;
    padding: 10px 14px;
    border-radius: 0 8px 8px 0;
  }
  .quote-icon {
    color: #fbbf24;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .report-quote-text {
    margin: 0;
    font-size: 13.5px;
    color: #e2e8f0;
    line-height: 1.5;
    font-style: italic;
  }
  .resolution-notes-callout {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.25);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 12.5px;
    color: #86efac;
  }
  .res-icon {
    color: #4ade80;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .ticket-reporter-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 12px;
    color: #94a3b8;
  }
  .reporter-info-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .reporter-info-pill strong {
    color: #f1f5f9;
  }
  .btn-cluster-toggle {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: transparent;
    border: none;
    color: #dfc28d;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }
  .btn-cluster-toggle:hover {
    text-decoration: underline;
  }

  .cluster-subreports-drawer {
    background: rgba(0, 0, 0, 0.35);
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .subreports-title {
    font-size: 11.5px;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #94a3b8;
    margin: 0;
  }
  .subreports-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .subreport-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .subreport-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11.5px;
  }
  .subreport-reporter {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #f1f5f9;
  }
  .subreport-date {
    color: #64748b;
    margin-left: 6px;
  }
  .page-pill-mini {
    font-size: 10px;
    font-weight: 750;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(223, 194, 141, 0.15);
    color: #dfc28d;
    border: 1px solid rgba(223, 194, 141, 0.3);
  }
  .subreport-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .subreport-reason {
    font-size: 12px;
    font-weight: 700;
    color: #fbbf24;
  }
  .subreport-text {
    margin: 0;
    font-size: 12px;
    color: #cbd5e1;
    font-style: italic;
  }

  .ticket-actions-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding-top: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
  .btn-primary-problem {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 10px;
    background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
    border: 1px solid #f59e0b;
    color: #ffffff;
    font-size: 13.5px;
    font-weight: 800;
    text-decoration: none;
    box-shadow: 0 4px 16px rgba(217, 119, 6, 0.4);
    transition: all 0.18s ease;
    cursor: pointer;
  }
  .btn-primary-problem:hover {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    box-shadow: 0 6px 22px rgba(245, 158, 11, 0.55);
    transform: translateY(-1px);
    color: #ffffff;
  }
  .ticket-workflow-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
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

  /* ========================================================
     MODERAÇÃO (COMMUNITY SENTINEL TICKETS)
     ======================================================== */
  .moderation-feed {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .mod-sentinel-card {
    background: rgba(18, 22, 34, 0.92);
    border: 1px solid rgba(244, 63, 94, 0.18);
    border-radius: 16px;
    padding: 20px 22px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
  }
  .mod-sentinel-card:hover {
    border-color: rgba(244, 63, 94, 0.35);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
  }
  .mod-sentinel-card.is-new {
    border-left: 4px solid #f43f5e;
  }

  .mod-header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .mod-author-group {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
    flex: 1;
  }
  .mod-author-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .mod-author-name-line {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .mod-author-name {
    font-size: 16px;
    font-weight: 800;
    color: #f8fafc;
  }
  .mod-author-handle {
    font-size: 12.5px;
    color: #94a3b8;
  }
  .badge-author-suspended {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 850;
    padding: 2px 7px;
    border-radius: 4px;
    background: rgba(239, 68, 68, 0.25);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.45);
    letter-spacing: 0.05em;
  }

  .mod-location-line {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #94a3b8;
    flex-wrap: wrap;
  }
  .pin-icon {
    color: #a855f7;
    flex-shrink: 0;
  }
  .mod-location-link {
    color: #c084fc;
    font-weight: 700;
    text-decoration: none;
    transition: color 0.15s ease;
  }
  .mod-location-link:hover {
    color: #dfc28d;
    text-decoration: underline;
  }
  .mod-location-text {
    color: #e2e8f0;
    font-weight: 650;
  }

  .mod-status-group {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .mod-visibility-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 800;
    padding: 3px 9px;
    border-radius: 999px;
    letter-spacing: 0.02em;
  }
  .mod-visibility-pill.visible {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.35);
  }
  .mod-visibility-pill.hidden {
    background: rgba(245, 158, 11, 0.18);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.38);
  }
  .mod-visibility-pill.deleted {
    background: rgba(239, 68, 68, 0.18);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.38);
  }

  .mod-content-stage {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .parent-comment-context-box {
    background: rgba(168, 85, 247, 0.06);
    border: 1px solid rgba(168, 85, 247, 0.2);
    border-radius: 10px;
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .parent-context-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    color: #c084fc;
    font-weight: 700;
  }
  .parent-quote-body {
    margin: 0;
    font-size: 12.5px;
    color: #cbd5e1;
    font-style: italic;
    line-height: 1.4;
    padding-left: 8px;
    border-left: 2px solid rgba(168, 85, 247, 0.3);
  }

  .reported-quote-card {
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(244, 63, 94, 0.25);
    border-radius: 12px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    position: relative;
  }
  .reported-quote-card.card-hidden {
    border-style: dashed;
    border-color: rgba(245, 158, 11, 0.35);
    background: rgba(245, 158, 11, 0.04);
  }
  .quote-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .quote-icon-crimson {
    color: #f43f5e;
  }
  .quote-header-title {
    font-size: 11px;
    font-weight: 850;
    letter-spacing: 0.06em;
    color: #f43f5e;
  }
  .reported-quote-text {
    margin: 0;
    font-size: 14.5px;
    color: #f8fafc;
    line-height: 1.5;
    font-weight: 550;
  }
  .reported-comment-deleted {
    margin: 0;
    font-size: 13px;
    color: #94a3b8;
    font-style: italic;
  }

  .mod-audit-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 12px;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }
  .mod-reason-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: #fb7185;
  }
  .mod-reason-badge strong {
    color: #f8fafc;
  }
  .mod-reporter-note {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #cbd5e1;
    font-style: italic;
  }
  .note-label {
    color: #94a3b8;
    font-style: normal;
  }
  .mod-reporter-chip {
    color: #64748b;
  }
  .mod-reporter-chip strong {
    color: #94a3b8;
  }

  .resolution-notes-callout.crimson-tint {
    background: rgba(244, 63, 94, 0.08);
    border-color: rgba(244, 63, 94, 0.25);
    color: #fda4af;
  }

  .mod-action-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding-top: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
  .btn-primary-site-view {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 10px;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    border: 1px solid #8b5cf6;
    color: #ffffff;
    font-size: 13.5px;
    font-weight: 800;
    text-decoration: none;
    box-shadow: 0 4px 16px rgba(124, 58, 237, 0.4);
    transition: all 0.18s ease;
    cursor: pointer;
  }
  .btn-primary-site-view:hover {
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    box-shadow: 0 6px 22px rgba(139, 92, 246, 0.55);
    transform: translateY(-1px);
    color: #ffffff;
  }
  .btn-primary-site-view.btn-site-view-disabled {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
    color: #6d758d;
    box-shadow: none;
    cursor: not-allowed;
  }
  .btn-primary-site-view.btn-site-view-disabled:hover {
    transform: none;
    background: rgba(255, 255, 255, 0.05);
    color: #6d758d;
  }
  .header-badge.amber-badge {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.35);
    color: #fbbf24;
  }
  .header-badge.gold-badge {
    background: rgba(223, 194, 141, 0.15);
    border-color: rgba(223, 194, 141, 0.35);
    color: #dfc28d;
  }
  .header-badge.crimson-badge {
    background: rgba(225, 29, 72, 0.15);
    border-color: rgba(225, 29, 72, 0.35);
    color: #fb7185;
  }
  .stat-icon-wrapper.reports-analise {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
  }
  .stat-icon-wrapper.reports-resolvido {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }
  .stat-icon-wrapper.reports-rejeitado {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }
  .mod-status-text.alert-text {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
    color: #f87171;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.25);
    padding: 6px 12px;
    border-radius: 8px;
  }
  .btn-empty-shortcut {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
    padding: 9px 18px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: #d1d5db;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .btn-empty-shortcut:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
    color: #ffffff;
    transform: translateY(-1px);
  }
  .mod-buttons-cluster {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .btn-mod-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 13px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
    border: 1px solid transparent;
  }
  .btn-mod-action.btn-hide {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.35);
    color: #fbbf24;
  }
  .btn-mod-action.btn-hide:hover {
    background: rgba(245, 158, 11, 0.25);
  }
  .btn-mod-action.btn-restore {
    background: rgba(148, 163, 184, 0.15);
    border-color: rgba(148, 163, 184, 0.3);
    color: #f1f5f9;
  }
  .btn-mod-action.btn-restore:hover {
    background: rgba(148, 163, 184, 0.25);
  }
  .btn-mod-action.btn-delete {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.35);
    color: #f87171;
  }
  .btn-mod-action.btn-delete:hover {
    background: rgba(239, 68, 68, 0.25);
  }
  .btn-mod-action.btn-suspend {
    background: rgba(159, 18, 57, 0.3);
    border-color: rgba(244, 63, 94, 0.4);
    color: #fda4af;
  }
  .btn-mod-action.btn-suspend:hover {
    background: rgba(159, 18, 57, 0.45);
  }
  .btn-mod-action.btn-resolve {
    background: rgba(34, 197, 94, 0.18);
    border-color: rgba(34, 197, 94, 0.4);
    color: #4ade80;
  }
  .btn-mod-action.btn-resolve:hover {
    background: rgba(34, 197, 94, 0.28);
  }
  .btn-mod-action.btn-dismiss {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
  }
  .btn-mod-action.btn-dismiss:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
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
    .ticket-top-row, .mod-header-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
    .ticket-status-box {
      align-items: flex-start;
      flex-direction: row;
      gap: 10px;
    }
    .ticket-actions-bar, .mod-action-footer {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }
    .btn-primary-problem, .btn-primary-site-view {
      width: 100%;
      justify-content: center;
    }
    .ticket-workflow-actions, .mod-buttons-cluster {
      width: 100%;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .btn-mod-action, .btn-action-warning, .btn-action-success, .btn-action-danger {
      flex: 1;
      min-width: 120px;
      justify-content: center;
      text-align: center;
    }
    .partner-cards-grid {
      grid-template-columns: 1fr;
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

  @media (max-width: 480px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }
    .ticket-target-info, .mod-author-group {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }
    .ticket-top-row, .mod-header-row {
      gap: 10px;
    }
    .ticket-badges-row, .mod-author-name-line {
      flex-wrap: wrap;
    }
  }
</style>
