<script lang="ts">
  import {
    Flag,
    CheckCircle2,
    Clock,
    User,
    BookOpen,
    MessageSquare,
    AlertTriangle,
    XCircle,
    ArrowUpRight,
    Search,
    Shield,
    ChevronDown,
    ChevronUp,
    Layers,
    List
  } from '@lucide/svelte';
  import { relativeTime } from '$lib/types';
  import { enhance } from '$app/forms';

  let { data } = $props();

  let resolvingId = $state<string | null>(null);
  let resolveAction = $state<'RESOLVIDO' | 'REJEITADO'>('RESOLVIDO');
  let resolutionNotes = $state('');

  let viewMode = $state<'CLUSTERED' | 'LIST'>('CLUSTERED');
  let expandedClusters = $state<Record<string, boolean>>({});
  let batchResolvingCluster = $state<any | null>(null);
  let batchAction = $state<'RESOLVIDO' | 'REJEITADO'>('RESOLVIDO');
  let batchNotes = $state('');

  function toggleCluster(key: string) {
    expandedClusters[key] = !expandedClusters[key];
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'NOVO':
        return { label: 'Novo', class: 'badge-novo' };
      case 'EM_ANALISE':
        return { label: 'Em Análise', class: 'badge-analise' };
      case 'ATRIBUIDO':
        return { label: 'Atribuído', class: 'badge-atribuido' };
      case 'RESOLVIDO':
        return { label: 'Resolvido', class: 'badge-resolvido' };
      case 'REJEITADO':
        return { label: 'Rejeitado', class: 'badge-rejeitado' };
      default:
        return { label: status, class: '' };
    }
  }

  function getTargetIcon(type: string) {
    switch (type) {
      case 'WORK':
        return BookOpen;
      case 'CHAPTER':
        return Clock;
      case 'COMMENT':
        return MessageSquare;
      case 'USER':
        return User;
      default:
        return Flag;
    }
  }

  function getTargetLabel(type: string) {
    switch (type) {
      case 'WORK':
        return 'Obra';
      case 'CHAPTER':
        return 'Capítulo';
      case 'COMMENT':
        return 'Comentário';
      case 'USER':
        return 'Usuário';
      default:
        return type;
    }
  }
</script>

<svelte:head>
  <title>Central de Denúncias — Painel Editorial Project Nox</title>
</svelte:head>

<div class="reports-workspace">
  <!-- Header -->
  <header class="workspace-header">
    <div class="header-text-block">
      <div class="eyebrow-line">
        <span class="eyebrow-tag">MODERAÇÃO</span>
        <span class="eyebrow-sep">·</span>
        <span class="eyebrow-date">CENTRAL DE DENÚNCIAS</span>
      </div>
      <h1 class="heading">Denúncias da Comunidade</h1>
      <p class="subheading">
        Gerencie e analise denúncias de obras, capítulos, comentários e usuários com fluxo formal de resolução.
      </p>
    </div>
  </header>

  <!-- Filter Navigation Tabs -->
  <div class="filters-bar">
    <div class="status-tabs">
      <a href="?status=ALL" class="tab-btn" class:active={data.statusFilter === 'ALL'}>
        <span>Todas</span>
        <span class="tab-count">{data.statusCounts.ALL}</span>
      </a>
      <a href="?status=NOVO" class="tab-btn tab-novo" class:active={data.statusFilter === 'NOVO'}>
        <span>Novas</span>
        <span class="tab-count count-novo">{data.statusCounts.NOVO}</span>
      </a>
      <a href="?status=EM_ANALISE" class="tab-btn" class:active={data.statusFilter === 'EM_ANALISE'}>
        <span>Em Análise</span>
        <span class="tab-count">{data.statusCounts.EM_ANALISE}</span>
      </a>
      <a href="?status=ATRIBUIDO" class="tab-btn" class:active={data.statusFilter === 'ATRIBUIDO'}>
        <span>Atribuídas</span>
        <span class="tab-count">{data.statusCounts.ATRIBUIDO}</span>
      </a>
      <a href="?status=RESOLVIDO" class="tab-btn" class:active={data.statusFilter === 'RESOLVIDO'}>
        <span>Resolvidas</span>
        <span class="tab-count">{data.statusCounts.RESOLVIDO}</span>
      </a>
      <a href="?status=REJEITADO" class="tab-btn" class:active={data.statusFilter === 'REJEITADO'}>
        <span>Rejeitadas</span>
        <span class="tab-count">{data.statusCounts.REJEITADO}</span>
      </a>
    </div>

    <!-- Type Pills -->
    <div class="type-pills">
      <a
        href="?status={data.statusFilter}&type=ALL"
        class="type-pill"
        class:active={data.typeFilter === 'ALL'}
      >
        Todos os Tipos
      </a>
      <a
        href="?status={data.statusFilter}&type=WORK"
        class="type-pill"
        class:active={data.typeFilter === 'WORK'}
      >
        Obras
      </a>
      <a
        href="?status={data.statusFilter}&type=CHAPTER"
        class="type-pill"
        class:active={data.typeFilter === 'CHAPTER'}
      >
        Capítulos
      </a>
      <a
        href="?status={data.statusFilter}&type=COMMENT"
        class="type-pill"
        class:active={data.typeFilter === 'COMMENT'}
      >
        Comentários
      </a>
      <a
        href="?status={data.statusFilter}&type=USER"
        class="type-pill"
        class:active={data.typeFilter === 'USER'}
      >
        Usuários
      </a>
    </div>
  </div>

  <!-- View Mode Switcher -->
  <div class="view-mode-bar">
    <div class="view-mode-tabs">
      <button
        type="button"
        class="view-mode-btn"
        class:active={viewMode === 'CLUSTERED'}
        onclick={() => (viewMode = 'CLUSTERED')}
      >
        <Layers size={14} />
        <span>Agrupado por Alvo ({data.clusters.length})</span>
      </button>
      <button
        type="button"
        class="view-mode-btn"
        class:active={viewMode === 'LIST'}
        onclick={() => (viewMode = 'LIST')}
      >
        <List size={14} />
        <span>Lista Detalhada ({data.reports.length})</span>
      </button>
    </div>
    <span class="view-mode-hint">
      {viewMode === 'CLUSTERED'
        ? 'Denúncias sobre o mesmo alvo são unificadas para resolução rápida em lote.'
        : 'Exibindo cada registro de denúncia individualmente.'}
    </span>
  </div>

  <!-- Reports Display -->
  {#if viewMode === 'CLUSTERED'}
    {#if data.clusters.length > 0}
      <div class="clusters-list">
        {#each data.clusters as cluster (cluster.clusterKey)}
          {@const statusMeta = getStatusBadge(cluster.status)}
          {@const TargetIcon = getTargetIcon(cluster.targetType)}
          {@const isExpanded = expandedClusters[cluster.clusterKey]}

          <div class="cluster-card" class:card-novo={cluster.status === 'NOVO'}>
            <div class="cluster-card-header">
              <div class="target-badge-cluster">
                <span class="target-type-badge">
                  <TargetIcon size={12} />
                  <span>{getTargetLabel(cluster.targetType)}</span>
                </span>
                <span class="report-status-badge {statusMeta.class}">
                  {statusMeta.label}
                </span>
                {#if cluster.count > 1}
                  <span class="cluster-count-badge" class:has-new={cluster.newCount > 0}>
                    {cluster.count} denúncias acumuladas
                  </span>
                {/if}
              </div>

              <span class="report-timestamp">
                <Clock size={12} />
                <span>Última {relativeTime(cluster.latestCreatedAt)}</span>
              </span>
            </div>

            <!-- Target Title and Link -->
            <div class="cluster-target-title-block">
              {#if cluster.targetLink}
                <a href={cluster.targetLink} class="cluster-target-link" target="_blank">
                  <h3 class="cluster-target-heading">{cluster.targetTitle}</h3>
                  <ArrowUpRight size={14} />
                </a>
              {:else}
                <h3 class="cluster-target-heading">{cluster.targetTitle}</h3>
              {/if}
            </div>

            <!-- Reasons Tags -->
            <div class="cluster-reasons-wrap">
              <span class="cluster-reasons-label">Motivos apontados:</span>
              <div class="cluster-reasons-list">
                {#each cluster.reasons as r}
                  <span class="cluster-reason-pill">{r}</span>
                {/each}
              </div>
            </div>

            <!-- Action Bar -->
            <div class="cluster-action-bar">
              <div class="cluster-primary-actions">
                {#if cluster.status === 'NOVO'}
                  <form method="POST" action="?/resolveBatch" use:enhance>
                    <input type="hidden" name="reportIds" value={cluster.reportIds.join(',')} />
                    <input type="hidden" name="status" value="EM_ANALISE" />
                    <button type="submit" class="btn-action btn-analise">
                      <Clock size={13} />
                      <span>Assumir Análise ({cluster.count})</span>
                    </button>
                  </form>
                {/if}

                {#if cluster.status !== 'RESOLVIDO' && cluster.status !== 'REJEITADO'}
                  <button
                    type="button"
                    class="btn-action btn-resolvido"
                    onclick={() => {
                      batchResolvingCluster = cluster;
                      batchAction = 'RESOLVIDO';
                      batchNotes = '';
                    }}
                  >
                    <CheckCircle2 size={13} />
                    <span>Resolver Alvo ({cluster.count})</span>
                  </button>

                  <button
                    type="button"
                    class="btn-action btn-rejeitado"
                    onclick={() => {
                      batchResolvingCluster = cluster;
                      batchAction = 'REJEITADO';
                      batchNotes = '';
                    }}
                  >
                    <XCircle size={13} />
                    <span>Rejeitar</span>
                  </button>
                {/if}
              </div>

              <button
                type="button"
                class="btn-expand-cluster"
                onclick={() => toggleCluster(cluster.clusterKey)}
              >
                <span>{isExpanded ? 'Ocultar' : 'Inspecionar'} {cluster.count} denúncia{cluster.count > 1 ? 's' : ''}</span>
                {#if isExpanded}
                  <ChevronUp size={14} />
                {:else}
                  <ChevronDown size={14} />
                {/if}
              </button>
            </div>

            <!-- Inline Batch Resolution Panel -->
            {#if batchResolvingCluster?.clusterKey === cluster.clusterKey}
              <div class="inline-resolve-panel">
                <form
                  method="POST"
                  action="?/resolveBatch"
                  use:enhance={() => {
                    return async ({ result }) => {
                      if (result.type === 'success') {
                        batchResolvingCluster = null;
                      }
                    };
                  }}
                >
                  <input type="hidden" name="reportIds" value={cluster.reportIds.join(',')} />
                  <input type="hidden" name="status" value={batchAction} />

                  <label for="cluster-notes-{cluster.clusterKey}" class="resolve-label">
                    Parecer da Moderação ({batchAction === 'RESOLVIDO' ? `Resolução das ${cluster.count} denúncias` : 'Motivo da Rejeição'}):
                  </label>
                  <textarea
                    id="cluster-notes-{cluster.clusterKey}"
                    name="notes"
                    bind:value={batchNotes}
                    class="resolve-textarea"
                    rows="2"
                    placeholder="Explique sucintamente a medida tomada (ex: imagens reupadas, numeração corrigida)..."
                    required
                  ></textarea>

                  <div class="resolve-form-btns">
                    <button
                      type="submit"
                      class="btn-resolve-submit"
                      class:btn-resolvido-solid={batchAction === 'RESOLVIDO'}
                      class:btn-rejeitado-solid={batchAction === 'REJEITADO'}
                    >
                      Confirmar {batchAction === 'RESOLVIDO' ? 'Resolução em Lote' : 'Rejeição em Lote'}
                    </button>
                    <button
                      type="button"
                      class="btn-cancel"
                      onclick={() => (batchResolvingCluster = null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            {/if}

            <!-- Expanded Drawer with individual report records -->
            {#if isExpanded}
              <div class="cluster-expanded-drawer">
                <h4 class="drawer-heading">Denúncias registradas para este alvo ({cluster.reports.length})</h4>
                <div class="drawer-reports-list">
                  {#each cluster.reports as rep (rep.id)}
                    <div class="drawer-report-row">
                      <div class="drawer-report-header">
                        <div class="drawer-reporter-meta">
                          <User size={12} />
                          <strong class="drawer-reporter-name">
                            {rep.reporter?.display_name || rep.reporter?.username || 'Usuário anônimo'}
                          </strong>
                          <span class="drawer-dot">·</span>
                          <span class="drawer-time">{relativeTime(rep.created_at)}</span>
                        </div>
                        <span class="report-status-badge {getStatusBadge(rep.status).class}">
                          {getStatusBadge(rep.status).label}
                        </span>
                      </div>

                      <div class="drawer-report-reason">
                        <strong>Motivo:</strong> {rep.reason}
                      </div>

                      {#if rep.details}
                        <div class="drawer-report-details">
                          "{rep.details}"
                        </div>
                      {/if}

                      {#if rep.resolution_notes}
                        <div class="drawer-report-notes">
                          <strong>Parecer da Staff:</strong> {rep.resolution_notes}
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="reports-empty">
        <div class="empty-icon-circle">
          <CheckCircle2 size={32} />
        </div>
        <h3 class="empty-heading">Nenhuma denúncia encontrada</h3>
        <p class="empty-paragraph">
          {data.statusFilter !== 'ALL'
            ? `Não há denúncias com o filtro "${data.statusFilter}".`
            : 'A comunidade está pacífica e nenhuma infração foi reportada no momento.'}
        </p>
        {#if data.statusFilter !== 'ALL' || data.typeFilter !== 'ALL'}
          <a href="/admin/reports" class="btn-clear-filters">Limpar filtros</a>
        {/if}
      </div>
    {/if}
  {:else}
    <!-- Detailed Flat List View -->
    {#if data.reports.length > 0}
      <div class="reports-list">
        {#each data.reports as report (report.id)}
          {@const statusMeta = getStatusBadge(report.status)}
          {@const TargetIcon = getTargetIcon(report.target_type)}
          <div class="report-card" class:card-novo={report.status === 'NOVO'}>
            <div class="report-card-header">
              <div class="target-badge-cluster">
                <span class="target-type-badge">
                  <TargetIcon size={12} />
                  <span>{getTargetLabel(report.target_type)}</span>
                </span>
                <span class="report-status-badge {statusMeta.class}">
                  {statusMeta.label}
                </span>
              </div>

              <span class="report-timestamp">
                <Clock size={12} />
                <span>{relativeTime(report.created_at)}</span>
              </span>
            </div>

            <!-- Target context -->
            <div class="target-context">
              {#if report.target_type === 'WORK' && report.work}
                <div class="target-item">
                  <span class="target-label">Obra:</span>
                  <a href="/admin/obras/{report.work.id}" class="target-link" target="_blank">
                    <strong>{report.work.title}</strong>
                    <ArrowUpRight size={12} />
                  </a>
                </div>
              {:else if report.target_type === 'CHAPTER' && report.chapter}
                <div class="target-item">
                  <span class="target-label">Capítulo:</span>
                  <span class="target-text">
                    Capítulo {report.chapter.number} {report.chapter.title ? `— ${report.chapter.title}` : ''}
                  </span>
                </div>
              {:else if report.target_type === 'COMMENT' && report.comment}
                <div class="target-item comment-preview">
                  <span class="target-label">Comentário:</span>
                  <blockquote class="target-quote">"{report.comment.body}"</blockquote>
                </div>
              {/if}
            </div>

            <!-- Report Reason & Details -->
            <div class="report-body">
              <div class="reason-block">
                <span class="reason-label">Motivo:</span>
                <span class="reason-text">{report.reason}</span>
              </div>
              {#if report.details}
                <p class="details-text">{report.details}</p>
              {/if}
            </div>

            <!-- Reporter & Assigned meta -->
            <div class="report-actors">
              <div class="actor-info">
                <User size={13} />
                <span>Denunciado por: <strong>{report.reporter?.display_name || report.reporter?.username || 'Usuário'}</strong></span>
              </div>
              {#if report.assigned}
                <div class="actor-info assigned">
                  <Shield size={13} />
                  <span>Atribuído a: <strong>{report.assigned.display_name || report.assigned.username}</strong></span>
                </div>
              {/if}
            </div>

            <!-- Resolution notes (if already resolved or rejected) -->
            {#if report.resolution_notes}
              <div class="resolution-notes-box">
                <span class="notes-label">Parecer da moderação:</span>
                <p class="notes-text">{report.resolution_notes}</p>
              </div>
            {/if}

            <!-- Action bar -->
            <div class="report-actions">
              {#if report.status === 'NOVO'}
                <form method="POST" action="?/updateStatus" use:enhance>
                  <input type="hidden" name="reportId" value={report.id} />
                  <input type="hidden" name="status" value="EM_ANALISE" />
                  <button type="submit" class="btn-action btn-analise">
                    <Clock size={13} />
                    <span>Assumir Análise</span>
                  </button>
                </form>
              {/if}

              {#if report.status !== 'RESOLVIDO' && report.status !== 'REJEITADO'}
                <button
                  type="button"
                  class="btn-action btn-resolvido"
                  onclick={() => {
                    resolvingId = report.id;
                    resolveAction = 'RESOLVIDO';
                    resolutionNotes = '';
                  }}
                >
                  <CheckCircle2 size={13} />
                  <span>Concluir / Resolver</span>
                </button>

                <button
                  type="button"
                  class="btn-action btn-rejeitado"
                  onclick={() => {
                    resolvingId = report.id;
                    resolveAction = 'REJEITADO';
                    resolutionNotes = '';
                  }}
                >
                  <XCircle size={13} />
                  <span>Rejeitar</span>
                </button>
              {/if}
            </div>

            <!-- Inline resolution dialog -->
            {#if resolvingId === report.id}
              <div class="inline-resolve-panel">
                <form
                  method="POST"
                  action="?/updateStatus"
                  use:enhance={() => {
                    return async ({ result }) => {
                      if (result.type === 'success') {
                        resolvingId = null;
                      }
                    };
                  }}
                >
                  <input type="hidden" name="reportId" value={report.id} />
                  <input type="hidden" name="status" value={resolveAction} />
                  
                  <label for="notes-{report.id}" class="resolve-label">
                    Parecer da Moderação ({resolveAction === 'RESOLVIDO' ? 'Resolução' : 'Motivo da Rejeição'}):
                  </label>
                  <textarea
                    id="notes-{report.id}"
                    name="notes"
                    bind:value={resolutionNotes}
                    class="resolve-textarea"
                    rows="2"
                    placeholder="Explique sucintamente a medida tomada ou o motivo..."
                    required
                  ></textarea>

                  <div class="resolve-form-btns">
                    <button
                      type="submit"
                      class="btn-resolve-submit"
                      class:btn-resolvido-solid={resolveAction === 'RESOLVIDO'}
                      class:btn-rejeitado-solid={resolveAction === 'REJEITADO'}
                    >
                      Confirmar {resolveAction === 'RESOLVIDO' ? 'Resolução' : 'Rejeição'}
                    </button>
                    <button
                      type="button"
                      class="btn-cancel"
                      onclick={() => (resolvingId = null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="reports-empty">
        <div class="empty-icon-circle">
          <CheckCircle2 size={32} />
        </div>
        <h3 class="empty-heading">Nenhuma denúncia encontrada</h3>
        <p class="empty-paragraph">
          {data.statusFilter !== 'ALL'
            ? `Não há denúncias com o filtro "${data.statusFilter}".`
            : 'A comunidade está pacífica e nenhuma infração foi reportada no momento.'}
        </p>
        {#if data.statusFilter !== 'ALL' || data.typeFilter !== 'ALL'}
          <a href="/admin/reports" class="btn-clear-filters">Limpar filtros</a>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .reports-workspace {
    padding: 32px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .workspace-header {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .eyebrow-line {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 750;
    letter-spacing: 0.08em;
    color: #dfc28d;
  }

  .heading {
    font-size: 26px;
    font-weight: 850;
    color: #ffffff;
    letter-spacing: -0.02em;
    margin: 4px 0 0;
  }

  .subheading {
    font-size: 14px;
    color: #98a2b8;
    max-width: 680px;
    line-height: 1.5;
    margin: 0;
  }

  /* Filters */
  .filters-bar {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: rgba(14, 17, 26, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 12px 16px;
  }

  .status-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: #98a2b8;
    font-size: 12.5px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .tab-btn:hover {
    background: rgba(255, 255, 255, 0.07);
    color: #ffffff;
  }

  .tab-btn.active {
    background: rgba(223, 194, 141, 0.12);
    border-color: rgba(223, 194, 141, 0.35);
    color: #dfc28d;
    font-weight: 750;
  }

  .tab-btn.tab-novo.active {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.4);
    color: #fca5a5;
  }

  .tab-count {
    font-size: 10.5px;
    font-weight: 750;
    padding: 1px 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: inherit;
  }

  .count-novo {
    background: rgba(239, 68, 68, 0.25);
    color: #fca5a5;
  }

  .type-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    padding-top: 10px;
  }

  .type-pill {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    color: #7b8396;
    text-decoration: none;
    background: transparent;
    transition: all 0.15s ease;
  }

  .type-pill:hover {
    color: #e2e7f2;
    background: rgba(255, 255, 255, 0.04);
  }

  .type-pill.active {
    background: rgba(181, 154, 245, 0.15);
    color: #cbb4ff;
    font-weight: 700;
  }

  /* View Mode Switcher */
  .view-mode-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .view-mode-tabs {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 9px;
  }

  .view-mode-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 14px;
    border-radius: 7px;
    background: transparent;
    border: none;
    color: #8c93a8;
    font-size: 12px;
    font-weight: 650;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .view-mode-btn:hover {
    color: #ffffff;
  }

  .view-mode-btn.active {
    background: rgba(223, 194, 141, 0.14);
    color: #dfc28d;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .view-mode-hint {
    font-size: 12px;
    color: #7b8396;
  }

  /* Clusters List */
  .clusters-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .cluster-card {
    background: rgba(18, 22, 34, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    transition: border-color 0.2s ease;
  }

  .cluster-card.card-novo {
    border-left: 4px solid #ef4444;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.04) 0%, rgba(18, 22, 34, 0.7) 100%);
  }

  .cluster-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .cluster-count-badge {
    font-size: 11px;
    font-weight: 750;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.07);
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .cluster-count-badge.has-new {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    color: #fca5a5;
  }

  .cluster-target-title-block {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cluster-target-heading {
    margin: 0;
    font-size: 16px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.01em;
  }

  .cluster-target-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #ffffff;
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .cluster-target-link:hover {
    color: #dfc28d;
  }

  .cluster-reasons-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 8px;
    padding: 8px 12px;
  }

  .cluster-reasons-label {
    font-size: 11px;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #7b8396;
  }

  .cluster-reasons-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .cluster-reason-pill {
    font-size: 11.5px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 5px;
    background: rgba(223, 194, 141, 0.1);
    color: #dfc28d;
    border: 1px solid rgba(223, 194, 141, 0.25);
  }

  .cluster-action-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .cluster-primary-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .btn-expand-cluster {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #c9cddb;
    font-size: 12px;
    font-weight: 650;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-expand-cluster:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .cluster-expanded-drawer {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.06);
    margin-top: 4px;
  }

  .drawer-heading {
    margin: 0 0 4px;
    font-size: 12px;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #dfc28d;
  }

  .drawer-reports-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .drawer-report-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  .drawer-report-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .drawer-reporter-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #94a3b8;
  }

  .drawer-reporter-name {
    color: #ffffff;
  }

  .drawer-dot {
    color: #4b5266;
  }

  .drawer-time {
    color: #646b80;
    font-size: 11px;
  }

  .drawer-report-reason {
    font-size: 12.5px;
    color: #e2e8f0;
  }

  .drawer-report-details {
    font-size: 12px;
    color: #94a3b8;
    font-style: italic;
    background: rgba(255, 255, 255, 0.02);
    padding: 6px 10px;
    border-radius: 5px;
  }

  .drawer-report-notes {
    font-size: 11.5px;
    color: #6ee7b7;
    background: rgba(16, 185, 129, 0.08);
    padding: 6px 10px;
    border-radius: 5px;
  }

  /* Reports List */
  .reports-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .report-card {
    background: rgba(18, 22, 34, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    transition: border-color 0.2s ease;
  }

  .report-card.card-novo {
    border-left: 3px solid #ef4444;
    background: rgba(239, 68, 68, 0.02);
  }

  .report-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .target-badge-cluster {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .target-type-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 700;
    color: #cbb4ff;
    background: rgba(181, 154, 245, 0.12);
    border: 1px solid rgba(181, 154, 245, 0.25);
    padding: 3px 8px;
    border-radius: 6px;
  }

  .report-status-badge {
    font-size: 10.5px;
    font-weight: 750;
    padding: 3px 8px;
    border-radius: 6px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .badge-novo {
    background: rgba(239, 68, 68, 0.18);
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.35);
  }

  .badge-analise {
    background: rgba(245, 158, 11, 0.18);
    color: #fcd34d;
    border: 1px solid rgba(245, 158, 11, 0.35);
  }

  .badge-atribuido {
    background: rgba(59, 130, 246, 0.18);
    color: #93c5fd;
    border: 1px solid rgba(59, 130, 246, 0.35);
  }

  .badge-resolvido {
    background: rgba(16, 185, 129, 0.18);
    color: #6ee7b7;
    border: 1px solid rgba(16, 185, 129, 0.35);
  }

  .badge-rejeitado {
    background: rgba(100, 116, 139, 0.18);
    color: #94a3b8;
    border: 1px solid rgba(100, 116, 139, 0.35);
  }

  .report-timestamp {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11.5px;
    color: #646b80;
  }

  .target-context {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 8px;
    padding: 10px 14px;
  }

  .target-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }

  .target-label {
    font-size: 11px;
    font-weight: 700;
    color: #7b8396;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .target-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #dfc28d;
    text-decoration: none;
  }

  .target-link:hover {
    text-decoration: underline;
  }

  .target-quote {
    margin: 0;
    font-style: italic;
    color: #e2e7f2;
  }

  .report-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .reason-block {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 13.5px;
  }

  .reason-label {
    font-size: 11.5px;
    font-weight: 750;
    color: #dfc28d;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .reason-text {
    color: #f1f5f9;
    font-weight: 600;
  }

  .details-text {
    font-size: 13px;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0;
    background: rgba(255, 255, 255, 0.02);
    padding: 8px 12px;
    border-radius: 6px;
  }

  .report-actors {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    font-size: 12px;
    color: #7b8396;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .actor-info {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .actor-info strong {
    color: #cbd5e1;
  }

  .resolution-notes-box {
    background: rgba(16, 185, 129, 0.05);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 8px;
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .notes-label {
    font-size: 10.5px;
    font-weight: 750;
    color: #6ee7b7;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .notes-text {
    font-size: 12.5px;
    color: #e2e8f0;
    line-height: 1.4;
    margin: 0;
  }

  .report-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding-top: 8px;
  }

  .btn-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 650;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s ease;
  }

  .btn-analise {
    background: rgba(245, 158, 11, 0.12);
    border-color: rgba(245, 158, 11, 0.3);
    color: #fcd34d;
  }

  .btn-analise:hover {
    background: rgba(245, 158, 11, 0.22);
  }

  .btn-resolvido {
    background: rgba(16, 185, 129, 0.12);
    border-color: rgba(16, 185, 129, 0.3);
    color: #6ee7b7;
  }

  .btn-resolvido:hover {
    background: rgba(16, 185, 129, 0.22);
  }

  .btn-rejeitado {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.25);
    color: #fca5a5;
  }

  .btn-rejeitado:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  .inline-resolve-panel {
    background: rgba(10, 13, 20, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 14px;
    margin-top: 4px;
  }

  .resolve-label {
    display: block;
    font-size: 11.5px;
    font-weight: 700;
    color: #cbd5e1;
    margin-bottom: 6px;
  }

  .resolve-textarea {
    width: 100%;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #ffffff;
    padding: 8px 10px;
    font-size: 13px;
    resize: vertical;
    outline: none;
    margin-bottom: 10px;
  }

  .resolve-textarea:focus {
    border-color: #dfc28d;
  }

  .resolve-form-btns {
    display: flex;
    gap: 8px;
  }

  .btn-resolve-submit {
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    border: none;
  }

  .btn-resolvido-solid {
    background: #10b981;
    color: #000000;
  }

  .btn-rejeitado-solid {
    background: #ef4444;
    color: #ffffff;
  }

  .btn-cancel {
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    cursor: pointer;
  }

  /* Empty state */
  .reports-empty {
    text-align: center;
    padding: 60px 20px;
    background: rgba(18, 22, 34, 0.4);
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .empty-icon-circle {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #10b981;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .empty-heading {
    font-size: 17px;
    font-weight: 750;
    color: #f1f5f9;
    margin: 0;
  }

  .empty-paragraph {
    font-size: 13.5px;
    color: #7b8396;
    max-width: 440px;
    margin: 0;
    line-height: 1.5;
  }

  .btn-clear-filters {
    margin-top: 6px;
    font-size: 12px;
    font-weight: 700;
    color: #dfc28d;
    text-decoration: underline;
  }
</style>
