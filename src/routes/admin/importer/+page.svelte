<script lang="ts">
  import { onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { enhance } from '$app/forms';
  import {
    Activity,
    Server,
    Clock,
    CheckCircle2,
    AlertTriangle,
    Shield,
    RotateCw,
    X,
    Plus,
    Flame,
    Zap,
    Cpu,
    ArrowRight,
    Link2,
    Search,
    ExternalLink,
    GitCompare,
    Layers,
    FileText,
    Check,
    HelpCircle,
    AlertOctagon,
    Split
  } from '@lucide/svelte';
  import { relativeTime } from '$lib/types';

  let { data, form } = $props();

  // Catalog Health & Manifest state
  let healthSearchQuery = $state('');
  let healthFilter = $state<'ALL' | 'INCOMPLETE' | 'HEALTHY' | 'RECONCILING' | 'UNRESOLVED'>('ALL');
  let showManifestModal = $state(false);
  let selectedManifestWork = $state<any>(null);
  let manifestLoading = $state(false);
  let manifestChapters = $state<any[]>([]);
  let reconcilingWorkId = $state<string | null>(null);

  async function openManifestModal(workHealthItem: any) {
    selectedManifestWork = workHealthItem;
    showManifestModal = true;
    manifestLoading = true;
    try {
      const res = await fetch(`/api/internal/importer/manifest?workId=${workHealthItem.work_id}`);
      if (res.ok) {
        const json = await res.json();
        manifestChapters = json.chapters || [];
      } else {
        manifestChapters = (data.chapterManifest || []).filter((m: any) => m.work_id === workHealthItem.work_id);
      }
    } catch {
      manifestChapters = (data.chapterManifest || []).filter((m: any) => m.work_id === workHealthItem.work_id);
    } finally {
      manifestLoading = false;
    }
  }

  const filteredWorkHealth = $derived(
    (data.workHealth || []).filter((item: any) => {
      const matchesSearch =
        !healthSearchQuery.trim() ||
        (item.work?.title || '').toLowerCase().includes(healthSearchQuery.toLowerCase()) ||
        (item.work?.slug || '').toLowerCase().includes(healthSearchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (healthFilter === 'HEALTHY') return item.health_status === 'HEALTHY';
      if (healthFilter === 'INCOMPLETE') return item.health_status === 'INCOMPLETE' || item.missing_start || (item.gaps && item.gaps.length > 0);
      if (healthFilter === 'RECONCILING') return item.health_status === 'RECONCILING';
      if (healthFilter === 'UNRESOLVED') return Array.isArray(item.unresolved_gaps) && item.unresolved_gaps.length > 0;

      return true;
    })
  );

  let showPrioritizeModal = $state(false);
  let selectedWorkId = $state('');
  let reasonText = $state('');
  let showConflictModal = $state(false);
  let showCancelConfirmModal = $state(false);
  let submitting = $state(false);

  // Search & Candidate state
  let searchQuery = $state('');
  let candidateResults = $state<any[]>([]);
  let searchLoading = $state(false);
  let searchDone = $state(false);
  let isUrlQuery = $state(false);
  let detectedProvider = $state<string | null>(null);
  let searchDebounceTimeout: any = null;

  function detectProvider(val: string): string | null {
    const lower = val.toLowerCase();
    if (lower.includes('kuro')) return 'kuro';
    if (lower.includes('nexus')) return 'nexus';
    if (lower.includes('mangaflix')) return 'mangaflix';
    if (lower.includes('manhastro')) return 'manhastro';
    if (lower.includes('mangotoons')) return 'mangotoons';
    return null;
  }

  function handleSearchInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    searchQuery = val;
    clearTimeout(searchDebounceTimeout);
    detectedProvider = detectProvider(val);
    isUrlQuery = val.trim().startsWith('http') || val.includes('.com') || val.includes('.org');

    if (val.trim().length < 2) {
      candidateResults = [];
      searchLoading = false;
      searchDone = false;
      return;
    }

    searchLoading = true;
    searchDebounceTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/internal/importer/search-candidates?q=${encodeURIComponent(val.trim())}`);
        if (res.ok) {
          const json = await res.json();
          candidateResults = json.candidates || [];
          isUrlQuery = Boolean(json.isUrl);
        }
      } catch {
        candidateResults = [];
      } finally {
        searchLoading = false;
        searchDone = true;
      }
    }, isUrlQuery ? 100 : 300);
  }

  function clearSearch() {
    searchQuery = '';
    candidateResults = [];
    searchLoading = false;
    searchDone = false;
    isUrlQuery = false;
    detectedProvider = null;
  }

  $effect(() => {
    if (form?.conflict) {
      showConflictModal = true;
    }
  });

  let pollInterval: ReturnType<typeof setInterval> | null = null;

  // Real-time live polling every 5s while tab is visible
  onMount(() => {
    pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        invalidateAll();
      }
    }, 5000);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  });

  // Calculate worker health
  let isWorkerActive = $derived(() => {
    if (!data.telemetry?.created_at) return false;
    const diffMs = Date.now() - new Date(data.telemetry.created_at).getTime();
    return diffMs < 180_000; // < 3 minutes
  });
</script>

<svelte:head>
  <title>Monitor do Importer — Painel Editorial Project Nox</title>
</svelte:head>

<div class="importer-dashboard">
  <!-- Header: Live Worker Status & Action -->
  <header class="importer-header">
    <div class="header-main-info">
      <div class="header-badge-row">
        <span class="importer-tag">PROJECT NOX IMPORTER</span>
        <span class="header-sep">·</span>
        <div class="worker-status-badge" class:online={isWorkerActive()} class:offline={!isWorkerActive()}>
          <div class="status-dot" class:pulsing={isWorkerActive()}></div>
          <span>{isWorkerActive() ? 'Worker Online' : 'Worker Offline / Aguardando'}</span>
        </div>
        {#if data.telemetry?.worker_id}
          <span class="worker-id-tag">({data.telemetry.worker_id})</span>
        {/if}
      </div>

      <h1 class="importer-title">Central de Operações do Importer</h1>
      <p class="importer-subtitle">
        Monitoramento em tempo real do processamento contínuo 24/7 e gestão de prioridades da Staff.
      </p>

      <!-- Telemetry Quick Pills -->
      {#if data.telemetry}
        <div class="telemetry-pills-row">
          <div class="telemetry-pill">
            <Cpu size={12} />
            <span>RSS: <strong>{data.telemetry.rss_mb} MB</strong></span>
          </div>
          <div class="telemetry-pill">
            <Zap size={12} />
            <span>Lag: <strong>{data.telemetry.event_loop_lag_ms} ms</strong></span>
          </div>
          <div class="telemetry-pill">
            <Activity size={12} />
            <span>Concorrência: <strong>{data.telemetry.concurrency}</strong></span>
          </div>
          <div class="telemetry-pill">
            <Clock size={12} />
            <span>Heartbeat: <strong>{relativeTime(data.telemetry.created_at)}</strong></span>
          </div>
        </div>
      {/if}
    </div>

    <!-- Header Actions -->
    <div class="header-action-wrap">
      <button
        type="button"
        class="btn-prioritize"
        onclick={() => (showPrioritizeModal = true)}
      >
        <Flame size={15} />
        <span>Priorizar Obra</span>
      </button>
    </div>
  </header>

  <!-- Notification Banner -->
  {#if form?.error}
    <div class="alert-banner error">
      <AlertTriangle size={16} />
      <span>{form.error}</span>
    </div>
  {:else if form?.message}
    <div class="alert-banner success">
      <CheckCircle2 size={16} />
      <span>{form.message}</span>
    </div>
  {/if}

  <!-- Hero: Prioridade Absoluta Ativa (Modo Foco) -->
  {#if data.activeFocus}
    <section class="priority-hero-card" aria-label="Prioridade Absoluta Ativa">
      <div class="hero-left-accent"></div>
      <div class="hero-content">
        <div class="hero-work-row">
          <div class="hero-cover-wrap">
            {#if data.activeFocus.works?.cover_id}
              <img src="/media/{data.activeFocus.works.cover_id}" alt="" class="hero-cover-img" />
            {:else}
              <div class="hero-cover-placeholder">NOX</div>
            {/if}
            <div class="hero-flame-badge" title="Foco Total">
              <Flame size={14} />
            </div>
          </div>

          <div class="hero-meta">
            <div class="hero-badge-line">
              {#if data.activeFocus.status === 'RETRYING'}
                <span class="focus-pill retrying">
                  <RotateCw size={13} class="spin-icon" />
                  PRIORIDADE ABSOLUTA (RETRYING)
                </span>
                <span class="focus-pause-badge retry-badge">
                  Aguardando retry técnico · Fila normal pausada
                </span>
              {:else if data.activeFocus.status === 'BLOCKED'}
                <span class="focus-pill blocked">
                  <AlertTriangle size={13} />
                  PRIORIDADE BLOQUEADA
                </span>
                <span class="focus-pause-badge error-badge">
                  Falha persistente na ingestão
                </span>
              {:else}
                <span class="focus-pill">
                  <span class="focus-pulse-dot"></span>
                  PRIORIDADE ABSOLUTA ATIVA
                </span>
                <span class="focus-pause-badge">
                  Fila regular pausada (Modo Foco)
                </span>
              {/if}
            </div>

            <h2 class="hero-work-title">
              {#if data.activeFocus.works?.slug}
                <a href="/obra/{data.activeFocus.works.slug}" class="hero-work-link">
                  {data.activeFocus.works?.title || 'Obra Priorizada'}
                </a>
              {:else}
                {data.activeFocus.works?.title || 'Obra Priorizada'}
              {/if}
            </h2>

            {#if data.activeFocus.reason}
              <p class="hero-reason">
                <strong>Motivo:</strong> {data.activeFocus.reason}
              </p>
            {/if}

            <div class="hero-requester">
              Solicitado por @{data.activeFocus.requester?.username || 'staff'} · {relativeTime(data.activeFocus.created_at)}
            </div>
          </div>

          <!-- Hero Action -->
          <div class="hero-actions">
            {#if data.activeFocus.status === 'BLOCKED'}
              <form method="POST" action="?/retryBlocked" use:enhance={() => {
                submitting = true;
                return async ({ update }) => {
                  submitting = false;
                  await update();
                };
              }}>
                <input type="hidden" name="request_id" value={data.activeFocus.id} />
                <input type="hidden" name="work_id" value={data.activeFocus.work_id} />
                <button type="submit" class="btn-retry-priority" disabled={submitting}>
                  <RotateCw size={14} />
                  <span>Tentar Novamente</span>
                </button>
              </form>
            {/if}
            <button
              type="button"
              class="btn-cancel-priority"
              onclick={() => (showCancelConfirmModal = true)}
            >
              <X size={14} />
              <span>Cancelar prioridade</span>
            </button>
          </div>
        </div>

        {#if data.activeFocus.status === 'RETRYING' || data.activeFocus.last_error}
          <div class="hero-retry-info-card">
            <div class="retry-header">
              <AlertTriangle size={15} class="retry-icon" />
              <span class="retry-label">Status da Prioridade:</span>
              <strong class="status-badge-val {data.activeFocus.status.toLowerCase()}">{data.activeFocus.status}</strong>
            </div>
            <div class="retry-details-grid">
              <div class="retry-detail-item wide">
                <span class="detail-label">Motivo do Erro:</span>
                <span class="detail-value error-text">{data.activeFocus.last_error || 'Aguardando recuperação técnica'}</span>
              </div>
              <div class="retry-detail-item">
                <span class="detail-label">Tentativas:</span>
                <span class="detail-value">{data.activeFocus.attempt_count || 1}</span>
              </div>
              <div class="retry-detail-item">
                <span class="detail-label">Última tentativa:</span>
                <span class="detail-value">{relativeTime(data.activeFocus.last_attempt_at || data.activeFocus.updated_at)}</span>
              </div>
              <div class="retry-detail-item">
                <span class="detail-label">Próxima tentativa:</span>
                <span class="detail-value highlight">{data.activeFocus.next_attempt_at ? relativeTime(data.activeFocus.next_attempt_at) : 'Em instantes'}</span>
              </div>
            </div>
          </div>
        {/if}

        {#if data.activeFocus.status === 'BLOCKED' && data.activeFocus.failure}
          <div class="hero-blocker-alert">
            <div class="blocker-alert-header">
              <AlertTriangle size={15} class="blocker-icon" />
              <strong>Motivo do Bloqueio:</strong>
              <span class="blocker-error-msg">{data.activeFocus.failure.lastError || 'Falha persistente na fonte remota.'}</span>
            </div>
            <div class="blocker-meta-row">
              {#if data.activeFocus.failure.source}<span><strong>Fonte:</strong> {data.activeFocus.failure.source.toUpperCase()}</span>{/if}
              {#if data.activeFocus.failure.chapterNumber}<span><strong>Capítulo:</strong> {data.activeFocus.failure.chapterNumber}</span>{/if}
              {#if data.activeFocus.failure.attempts}<span><strong>Tentativas:</strong> {data.activeFocus.failure.attempts}</span>{/if}
              {#if data.activeFocus.failure.updatedAt}<span><strong>Última tentativa:</strong> {relativeTime(data.activeFocus.failure.updatedAt)}</span>{/if}
            </div>
          </div>
        {/if}

        <!-- Progress Bar & Stats -->
        {#if data.activeFocus.stats}
          <div class="hero-progress-section">
            <div class="hero-progress-labels">
              <span class="progress-left-label">
                {#if data.activeFocus.stats.currentChapter}
                  <strong>Processando:</strong> Capítulo {data.activeFocus.stats.currentChapter}
                {:else if data.activeFocus.stats.pending > 0}
                  <strong>Sincronizando capítulos...</strong>
                {:else}
                  <strong>Finalizando sincronização...</strong>
                {/if}
              </span>
              <span class="progress-right-label">
                {data.activeFocus.stats.completed} de {data.activeFocus.stats.totalDiscovered} capítulos ({data.activeFocus.stats.percent}%)
              </span>
            </div>

            <div class="hero-progress-track">
              <div class="hero-progress-fill" style="width: {Math.max(4, Math.min(100, data.activeFocus.stats.percent))}%;"></div>
            </div>

            <div class="hero-stats-chips">
              <span class="hero-chip done">
                <CheckCircle2 size={12} />
                {data.activeFocus.stats.completed} concluídos
              </span>
              {#if data.activeFocus.stats.staged > 0}
                <span class="hero-chip staged">
                  <Shield size={12} />
                  {data.activeFocus.stats.staged} em STAGED
                </span>
              {/if}
              {#if data.activeFocus.stats.pending > 0}
                <span class="hero-chip pending">
                  <RotateCw size={12} class="spin-icon" />
                  {data.activeFocus.stats.pending} pendentes
                </span>
              {/if}
              <span class="hero-chip info">
                {data.activeFocus.stats.published} publicados no catálogo
              </span>
            </div>
          </div>
        {/if}
      </div>
    </section>
  {/if}

  <!-- Card Principal: Busca e Entrada da Prioridade Absoluta -->
  <section class="priority-entry-card" aria-label="Iniciar Prioridade Absoluta">
    <div class="priority-entry-header">
      <div class="priority-entry-title-wrap">
        <div class="flame-pulse-icon">
          <Flame size={18} />
        </div>
        <div>
          <h2 class="priority-entry-heading">Prioridade Absoluta</h2>
          <p class="priority-entry-desc">
            Cole a URL de qualquer fonte suportada (Nexus, Kuro, MangaFlix, Manhastro, MangoToons) ou busque pelo título para dedicar 100% da capacidade do Importer à obra selecionada.
          </p>
        </div>
      </div>
    </div>

    <div class="priority-search-box">
      <div class="search-input-wrap">
        {#if isUrlQuery}
          <Link2 size={18} class="input-mode-icon link-mode" />
        {:else}
          <Search size={18} class="input-mode-icon" />
        {/if}
        <input
          type="text"
          class="priority-search-input"
          placeholder="Cole o link da obra ou digite o nome (ex: Vingança do Cão de Caça)..."
          bind:value={searchQuery}
          oninput={handleSearchInput}
        />
        {#if searchLoading}
          <RotateCw size={16} class="search-spin-icon" />
        {:else if searchQuery}
          <button type="button" class="btn-clear-search" onclick={clearSearch} aria-label="Limpar busca">
            <X size={16} />
          </button>
        {/if}
      </div>

      {#if detectedProvider}
        <div class="provider-detected-tag">
          <span>Fonte detectada:</span>
          <strong class="provider-name">{detectedProvider.toUpperCase()}</strong>
        </div>
      {/if}
    </div>

    <!-- Candidate Results / Preview -->
    {#if candidateResults.length > 0}
      <div class="candidates-container">
        <div class="candidates-header-line">
          <span class="candidates-count-tag">
            {candidateResults.length} {candidateResults.length === 1 ? 'obra encontrada' : 'obras encontradas'}
          </span>
          {#if isUrlQuery}
            <span class="url-mode-badge">Resolução de URL Direta</span>
          {/if}
        </div>

        <div class="candidates-grid">
          {#each candidateResults as candidate (candidate.sourceWorkId || candidate.slug)}
            <div class="candidate-card" class:is-direct-url={isUrlQuery}>
              <div class="candidate-cover-box">
                {#if candidate.coverId}
                  <img src="/media/{candidate.coverId}" alt="" class="candidate-cover-img" />
                {:else}
                  <div class="candidate-cover-placeholder">NOX</div>
                {/if}
                <span class="candidate-provider-badge provider-{candidate.provider}">
                  {candidate.provider}
                </span>
              </div>

              <div class="candidate-info">
                <strong class="candidate-title">{candidate.title}</strong>
                <div class="candidate-sub-tags">
                  {#if candidate.existsInNox}
                    <span class="status-pill in-nox">No Catálogo Nox</span>
                  {:else}
                    <span class="status-pill new-work">Nova Obra</span>
                  {/if}

                  {#if candidate.chapterCount}
                    <span class="status-pill ch-count">{candidate.chapterCount} capítulos</span>
                  {/if}
                </div>

                {#if candidate.sourceUrl}
                  <span class="candidate-source-url" title={candidate.sourceUrl}>
                    {candidate.sourceUrl}
                  </span>
                {/if}
              </div>

              <div class="candidate-action-wrap">
                <form method="POST" action="?/prioritize" use:enhance={() => {
                  submitting = true;
                  return async ({ update }) => {
                    submitting = false;
                    clearSearch();
                    await update();
                  };
                }}>
                  {#if candidate.workId}
                    <input type="hidden" name="work_id" value={candidate.workId} />
                  {:else}
                    <input type="hidden" name="candidate_title" value={candidate.title} />
                    <input type="hidden" name="source" value={candidate.provider} />
                    <input type="hidden" name="source_work_id" value={candidate.sourceWorkId} />
                    {#if candidate.sourceUrl}
                      <input type="hidden" name="source_url" value={candidate.sourceUrl} />
                    {/if}
                  {/if}
                  <input type="hidden" name="reason" value="Prioridade Absoluta solicitada via Central do Importer" />

                  <button type="submit" class="btn-prioritize-card" disabled={submitting}>
                    <Flame size={14} />
                    <span>Priorizar Obra</span>
                  </button>
                </form>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {:else if searchQuery && !searchLoading && searchDone}
      <div class="search-empty-state">
        <AlertTriangle size={18} />
        <span>Nenhuma obra correspondente encontrada para "{searchQuery}". Tente colar o link direto da obra na fonte de origem.</span>
      </div>
    {/if}
  </section>

  <!-- Metric Summary Pills -->
  <section class="counts-pills-bar" aria-label="Métricas da Fila">
    <div class="count-pill">
      <div class="dot blue pulse"></div>
      <span class="label">Importando:</span>
      <strong class="value">{data.counts.importing}</strong>
    </div>

    <div class="count-pill">
      <div class="dot gold"></div>
      <span class="label">Na Fila:</span>
      <strong class="value">{data.counts.queued}</strong>
    </div>

    <div class="count-pill">
      <div class="dot amber"></div>
      <span class="label">Retries:</span>
      <strong class="value">{data.counts.retry}</strong>
    </div>

    <div class="count-pill" class:staged-alert={data.counts.staged > 0}>
      <div class="dot purple"></div>
      <span class="label">STAGED (Barreira):</span>
      <strong class="value">{data.counts.staged}</strong>
    </div>

    <div class="count-pill">
      <div class="dot green"></div>
      <span class="label">Concluídos:</span>
      <strong class="value">{data.counts.completed}</strong>
    </div>

    <div class="count-pill" class:has-failures={data.counts.failed1h > 0}>
      <div class="dot red"></div>
      <span class="label">Falhas (1h / 24h):</span>
      <strong class="value">{data.counts.failed1h} / {data.counts.failed24h}</strong>
      {#if data.counts.failed > 0}
        <span class="sub-val" title="Total histórico">({data.counts.failed})</span>
      {/if}
    </div>
  </section>

  <!-- 3. Saúde do Catálogo & Reconciliação Multi-Fonte -->
  <section class="catalog-health-panel" aria-label="Saúde do Catálogo & Reconciliação Multi-Fonte">
    <div class="health-header">
      <div class="health-title-group">
        <div class="health-icon-box">
          <GitCompare size={22} class="text-crimson" />
        </div>
        <div>
          <h2 class="health-title">Saúde do Catálogo & Reconciliação Multi-Fonte</h2>
          <p class="health-subtitle">
            Auditoria contínua de completude, descoberta cross-provider (Nexus, Kuro, MangaFlix, MangoToons, Manhastro) e eliminação determinística de lacunas sem duplicações.
          </p>
        </div>
      </div>
      <div class="health-actions-top">
        <span class="coverage-badge">
          <Layers size={13} />
          {data.healthMetrics?.totalImportedChapters || 0} / {data.healthMetrics?.totalKnownChapters || 0} Capítulos Sincronizados
        </span>
      </div>
    </div>

    <!-- 4 KPI Health Cards -->
    <div class="health-kpi-grid">
      <div class="kpi-card card-healthy">
        <div class="kpi-top">
          <span class="kpi-label">100% Saudáveis</span>
          <CheckCircle2 size={18} class="text-emerald" />
        </div>
        <div class="kpi-value text-emerald">{data.healthMetrics?.healthyCount || 0}</div>
        <div class="kpi-sub">Obras sem lacunas nem início ausente</div>
      </div>

      <div class="kpi-card card-incomplete">
        <div class="kpi-top">
          <span class="kpi-label">Com Lacunas Detectadas</span>
          <AlertTriangle size={18} class="text-amber" />
        </div>
        <div class="kpi-value text-amber">{data.healthMetrics?.incompleteCount || 0}</div>
        <div class="kpi-sub">{data.healthMetrics?.totalGaps || 0} lacunas identificadas para backfill</div>
      </div>

      <div class="kpi-card card-reconciling">
        <div class="kpi-top">
          <span class="kpi-label">Em Reconciliação Ativa</span>
          <RotateCw size={18} class="text-cyan animate-spin-slow" />
        </div>
        <div class="kpi-value text-cyan">{data.healthMetrics?.reconcilingCount || 0}</div>
        <div class="kpi-sub">Cruzando provedores e baixando gaps</div>
      </div>

      <div class="kpi-card card-unresolved">
        <div class="kpi-top">
          <span class="kpi-label">Gaps Irresolvíveis</span>
          <AlertOctagon size={18} class="text-purple" />
        </div>
        <div class="kpi-value text-purple">{data.healthMetrics?.totalUnresolvedGaps || 0}</div>
        <div class="kpi-sub">Nenhum provedor possui esses capítulos</div>
      </div>
    </div>

    <!-- Filter & Search Toolbar -->
    <div class="health-toolbar">
      <div class="health-search-wrap">
        <Search size={16} class="health-search-icon" />
        <input
          type="text"
          placeholder="Filtrar obras auditadas por título ou slug..."
          value={healthSearchQuery}
          oninput={(e) => (healthSearchQuery = (e.target as HTMLInputElement).value)}
          class="health-search-input"
        />
        {#if healthSearchQuery}
          <button type="button" class="btn-clear-search" onclick={() => (healthSearchQuery = '')}>
            <X size={14} />
          </button>
        {/if}
      </div>

      <div class="health-filter-chips">
        <button
          type="button"
          class="filter-chip"
          class:active={healthFilter === 'ALL'}
          onclick={() => (healthFilter = 'ALL')}
        >
          Todas ({data.workHealth?.length || 0})
        </button>
        <button
          type="button"
          class="filter-chip chip-incomplete"
          class:active={healthFilter === 'INCOMPLETE'}
          onclick={() => (healthFilter = 'INCOMPLETE')}
        >
          Com Lacunas ({data.healthMetrics?.incompleteCount || 0})
        </button>
        <button
          type="button"
          class="filter-chip chip-healthy"
          class:active={healthFilter === 'HEALTHY'}
          onclick={() => (healthFilter = 'HEALTHY')}
        >
          Saudáveis ({data.healthMetrics?.healthyCount || 0})
        </button>
        <button
          type="button"
          class="filter-chip chip-reconciling"
          class:active={healthFilter === 'RECONCILING'}
          onclick={() => (healthFilter = 'RECONCILING')}
        >
          Reconciliando ({data.healthMetrics?.reconcilingCount || 0})
        </button>
        {#if (data.healthMetrics?.totalUnresolvedGaps || 0) > 0}
          <button
            type="button"
            class="filter-chip chip-unresolved"
            class:active={healthFilter === 'UNRESOLVED'}
            onclick={() => (healthFilter = 'UNRESOLVED')}
          >
            Gaps Irresolvíveis ({data.healthMetrics?.totalUnresolvedGaps || 0})
          </button>
        {/if}
      </div>
    </div>

    <!-- Works Health Table / Grid -->
    {#if filteredWorkHealth.length > 0}
      <div class="health-works-table-wrap">
        <table class="health-table">
          <thead>
            <tr>
              <th>Obra</th>
              <th>Status de Saúde</th>
              <th>Início</th>
              <th>Cobertura de Capítulos</th>
              <th>Fontes Mapeadas (Cross-Provider)</th>
              <th>Lacunas Detectadas</th>
              <th class="th-actions">Ações</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredWorkHealth as item (item.work_id)}
              <tr class="health-row">
                <!-- Obra -->
                <td class="td-work">
                  <div class="health-work-info">
                    <div class="health-cover-box">
                      {#if item.work?.cover_id}
                        <img src="/media/{item.work.cover_id}" alt="" width="34" height="48" class="health-cover-img" />
                      {:else}
                        <div class="health-cover-fallback">NOX</div>
                      {/if}
                    </div>
                    <div class="health-work-text">
                      <a href="/obra/{item.work?.slug || ''}" target="_blank" class="health-work-link">
                        {item.work?.title || 'Obra Desconhecida'}
                        <ExternalLink size={12} />
                      </a>
                      <span class="health-work-slug">slug: {item.work?.slug || item.work_id.slice(0, 8)}</span>
                    </div>
                  </div>
                </td>

                <!-- Status de Saúde -->
                <td class="td-status">
                  {#if item.health_status === 'HEALTHY'}
                    <span class="health-status-badge status-healthy">
                      <CheckCircle2 size={13} />
                      100% Saudável
                    </span>
                  {:else if item.health_status === 'RECONCILING' || reconcilingWorkId === item.work_id}
                    <span class="health-status-badge status-reconciling">
                      <RotateCw size={13} class="animate-spin" />
                      Reconciliando
                    </span>
                  {:else if item.health_status === 'INCOMPLETE'}
                    <span class="health-status-badge status-incomplete">
                      <AlertTriangle size={13} />
                      Lacunas Detectadas
                    </span>
                  {:else}
                    <span class="health-status-badge status-unverified">
                      <HelpCircle size={13} />
                      Pendente Auditoria
                    </span>
                  {/if}
                </td>

                <!-- Início -->
                <td class="td-start">
                  {#if item.missing_start}
                    <span class="start-badge badge-missing-start" title="Faltam capítulos anteriores ao primeiro conhecido">
                      <AlertTriangle size={12} />
                      Inicia no Cap. {item.first_chapter_number}
                    </span>
                  {:else}
                    <span class="start-badge badge-start-ok">
                      <Check size={12} />
                      Início OK (Cap. {item.first_chapter_number || 1})
                    </span>
                  {/if}
                </td>

                <!-- Cobertura -->
                <td class="td-coverage">
                  <div class="coverage-cell">
                    <div class="coverage-bar-track">
                      <div
                        class="coverage-bar-fill"
                        class:fill-complete={item.total_imported_chapters >= item.total_known_chapters && item.total_known_chapters > 0}
                        style="width: {Math.min(100, Math.round((item.total_imported_chapters / Math.max(1, item.total_known_chapters)) * 100))}%"
                      ></div>
                    </div>
                    <div class="coverage-text">
                      <strong>{item.total_imported_chapters}</strong> / {item.total_known_chapters} caps
                      <span class="coverage-percent">
                        ({Math.round((item.total_imported_chapters / Math.max(1, item.total_known_chapters)) * 100)}%)
                      </span>
                    </div>
                  </div>
                </td>

                <!-- Fontes Mapeadas -->
                <td class="td-providers">
                  <div class="provider-badges-list">
                    {#if Array.isArray(item.providers_summary) && item.providers_summary.length > 0}
                      {#each item.providers_summary as prov}
                        <span class="prov-tag prov-{prov.provider.toLowerCase()}" class:inactive={!prov.active}>
                          <span class="prov-dot"></span>
                          <span class="prov-name">{prov.provider}</span>
                          <span class="prov-count">{prov.chaptersAvailable}c</span>
                        </span>
                      {/each}
                    {:else}
                      <span class="prov-empty">1 fonte</span>
                    {/if}
                  </div>
                </td>

                <!-- Lacunas Detectadas -->
                <td class="td-gaps">
                  <div class="gaps-list">
                    {#if Array.isArray(item.gaps) && item.gaps.length > 0}
                      {#each item.gaps as gap}
                        <span class="gap-pill" class:gap-start={gap.type === 'MISSING_START'}>
                          {#if gap.type === 'MISSING_START'}
                            Falta 1..{gap.to}
                          {:else}
                            Falta {gap.from}..{gap.to}
                          {/if}
                        </span>
                      {/each}
                    {/if}
                    {#if Array.isArray(item.unresolved_gaps) && item.unresolved_gaps.length > 0}
                      <span class="gap-pill gap-unresolved" title="Nenhum provedor disponível possui estes capítulos">
                        Irresolvível: {item.unresolved_gaps.slice(0, 3).join(', ')}{item.unresolved_gaps.length > 3 ? '…' : ''}
                      </span>
                    {/if}
                    {#if (!item.gaps || item.gaps.length === 0) && (!item.unresolved_gaps || item.unresolved_gaps.length === 0) && !item.missing_start}
                      <span class="gaps-none text-emerald">
                        <Check size={12} />
                        Sem lacunas
                      </span>
                    {/if}
                  </div>
                </td>

                <!-- Ações -->
                <td class="td-actions">
                  <div class="action-btn-group">
                    <form
                      method="POST"
                      action="?/reconcile"
                      use:enhance={() => {
                        reconcilingWorkId = item.work_id;
                        return async ({ update }) => {
                          await update();
                          reconcilingWorkId = null;
                        };
                      }}
                    >
                      <input type="hidden" name="work_id" value={item.work_id} />
                      <button
                        type="submit"
                        class="btn-reconcile-action"
                        disabled={reconcilingWorkId === item.work_id || item.health_status === 'RECONCILING'}
                        title="Executar reconciliação imediata em todas as fontes (Kuro, MangaFlix, Nexus, Manhastro, MangoToons)"
                      >
                        <RotateCw size={13} class={reconcilingWorkId === item.work_id || item.health_status === 'RECONCILING' ? 'animate-spin' : ''} />
                        <span>{reconcilingWorkId === item.work_id ? 'Reconciliando...' : 'Reconciliar'}</span>
                      </button>
                    </form>

                    <button
                      type="button"
                      class="btn-manifest-action"
                      onclick={() => openManifestModal(item)}
                      title="Abrir manifesto canônico unificado e proveniência de capítulos"
                    >
                      <FileText size={13} />
                      <span>Manifesto</span>
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <div class="health-empty-state">
        <GitCompare size={36} class="text-zinc-500" />
        <p class="empty-title">Nenhuma obra encontrada para este filtro</p>
        <p class="empty-sub">Tente ajustar o termo de pesquisa ou selecionar a categoria "Todas".</p>
      </div>
    {/if}
  </section>

  <!-- Main Grid Layout -->
  <div class="importer-grid">
    <!-- Left Column: Active Jobs, Staff Priorities, STAGED Blockers -->
    <div class="grid-primary-col">
      <!-- 1. Importando Agora -->
      <section class="panel-card">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Importando Agora</h2>
            <p class="panel-sub">Jobs em execução ativa ou aguardando próximo intervalo de retry</p>
          </div>
          <span class="live-tag">
            <span class="live-dot"></span>
            LIVE
          </span>
        </div>

        {#if (data.activeJobs || []).length > 0}
          <div class="active-jobs-list">
            {#each (data.activeJobs || []) as job (job.id)}
              <div class="active-job-row" class:is-retry={job.status === 'RETRY'}>
                <!-- Work Thumb -->
                <div class="job-thumb">
                  {#if job.work?.cover_id}
                    <img src="/media/{job.work.cover_id}" alt="" width="36" height="50" class="thumb-img" />
                  {:else}
                    <div class="thumb-placeholder">NOX</div>
                  {/if}
                </div>

                <!-- Job Details -->
                <div class="job-info">
                  <div class="job-line-top">
                    <strong class="job-work-title">{job.work?.title || (job.payload as any)?.workTitle || 'Obra Sincronizando'}</strong>
                    <span class="job-status-chip status-{job.status.toLowerCase()}">{job.status}</span>
                  </div>
                  <div class="job-line-sub">
                    <span class="job-source-tag">{job.source}</span>
                    {#if job.chapter_sort_key}
                      <span class="job-chapter-num">Cap. {job.chapter_sort_key}</span>
                    {/if}
                    <span class="job-priority-pill" class:boosted={job.priority >= 80}>
                      {job.priority >= 90 ? 'P:90 BLOCKER' : job.priority >= 85 ? 'P:85 STAFF' : job.priority >= 80 ? 'P:80 NOVO' : job.priority >= 70 ? 'P:70 GAP' : 'P:' + job.priority}
                    </span>
                  </div>
                  {#if job.status === 'RETRY' && job.next_run_at}
                    <div class="job-retry-note">
                      <Clock size={11} />
                      <span>Tentativa {job.attempts}/{job.max_attempts} · Retry {relativeTime(job.next_run_at)}</span>
                    </div>
                  {/if}
                  {#if job.last_error}
                    <div class="job-error-preview" title={job.last_error}>
                      {job.last_error.slice(0, 100)}…
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-panel-notice">
            <CheckCircle2 size={24} class="empty-icon" />
            <p>Nenhum job em execução concorrente no exato momento. O worker consulta a fila continuamente.</p>
          </div>
        {/if}
      </section>

      <!-- 2. Prioridades da Staff -->
      <section class="panel-card" style="margin-top: 24px;">
        <div class="panel-header">
          <div>
            <div class="title-with-badge">
              <h2 class="panel-title">Prioridades da Staff</h2>
              <span class="badge-accent">{(data.staffRequests || []).length} registradas</span>
            </div>
            <p class="panel-sub">Obras com boost de prioridade manual atribuído por editores e administradores</p>
          </div>
        </div>

        {#if (data.staffRequests || []).length > 0}
          <div class="staff-requests-list">
            {#each (data.staffRequests || []) as req (req.id)}
              <div class="staff-request-row">
                <div class="req-work-thumb">
                  {#if req.works?.cover_id}
                    <img src="/media/{req.works.cover_id}" alt="" width="34" height="46" class="thumb-img" />
                  {:else}
                    <div class="thumb-placeholder">NOX</div>
                  {/if}
                </div>

                <div class="req-main-meta">
                  <div class="req-header-line">
                    <strong class="req-work-title">{req.works?.title || 'Obra'}</strong>
                    <span class="req-status-pill status-{req.status.toLowerCase()}">{req.status}</span>
                    {#if req.cancel_reason}
                      <span class="req-cancel-reason-tag">
                        {req.cancel_reason === 'STAFF_CANCELLED' ? 'Cancelado pela Staff' : req.cancel_reason === 'REPLACED_BY_STAFF' ? 'Substituído pela Staff' : req.cancel_reason}
                      </span>
                    {/if}
                    {#if req.status === 'RETRYING' && req.last_error}
                      <span class="req-error-tag" title={req.last_error}>Retry: {req.last_error}</span>
                    {/if}
                  </div>
                  <div class="req-details-line">
                    <span class="req-operator">Solicitado por: <strong>{req.requester?.display_name || req.requester?.username || 'Staff'}</strong></span>
                    <span class="req-date">· {relativeTime(req.created_at)}</span>
                    <span class="req-boost-tag">Boost +{req.priority_boost}</span>
                  </div>
                  {#if req.reason}
                    <p class="req-reason">"{req.reason}"</p>
                  {/if}
                </div>

                {#if req.status === 'QUEUED'}
                  <form method="POST" action="?/cancel" use:enhance>
                    <input type="hidden" name="request_id" value={req.id} />
                    <button type="submit" class="btn-cancel-req" title="Cancelar priorização">
                      Cancelar
                    </button>
                  </form>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-panel-notice">
            <p>Nenhuma priorização manual ativa no momento. Use o botão <strong>Priorizar Obra</strong> para acelerar uma série.</p>
          </div>
        {/if}
      </section>

      <!-- 3. STAGED / Barreira Canônica -->
      <section class="panel-card" style="margin-top: 24px;">
        <div class="panel-header">
          <div>
            <div class="title-with-badge">
              <h2 class="panel-title">STAGED · Barreira Canônica</h2>
              {#if data.counts.staged > 0}
                <span class="badge-purple">{data.counts.staged} capítulos retidos</span>
              {/if}
            </div>
            <p class="panel-sub">
              Capítulos baixados e verificados aguardando publicação sequencial de seus predecessores
            </p>
          </div>
        </div>

        {#if (data.stagedChapters || []).length > 0}
          <div class="staged-chapters-list">
            {#each (data.stagedChapters || []) as staged (staged.id)}
              <div class="staged-row">
                <div class="staged-info">
                  <strong class="staged-work">{staged.works?.title || 'Obra'}</strong>
                  <span class="staged-ch">Capítulo {staged.chapter_sort_key}</span>
                  <span class="staged-source-chip">{staged.source}</span>
                </div>
                <div class="staged-barrier-tag">
                  <Shield size={12} />
                  <span>Aguardando antecessor</span>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-panel-notice">
            <p>Nenhum capítulo retido na Barreira Canônica. Todas as publicações estão em ordem contínua.</p>
          </div>
        {/if}
      </section>
    </div>

    <!-- Right Column: Próximos na Fila & Saúde das Fontes -->
    <div class="grid-secondary-col">
      <!-- 1. Próximos da Fila -->
      <section class="panel-card">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Próximos da Fila</h2>
            <p class="panel-sub">Ordenados por prioridade operacional e sort key canônica</p>
          </div>
        </div>

        {#if (data.queuedJobs || []).length > 0}
          <div class="queued-jobs-list">
            {#each (data.queuedJobs || []) as q (q.id)}
              <div class="queued-row">
                <div class="queued-meta">
                  <strong class="queued-title">{q.work?.title || (q.payload as any)?.workTitle || q.task_type}</strong>
                  <div class="queued-sub">
                    <span class="source-tag">{q.source}</span>
                    {#if q.chapter_sort_key}
                      <span class="ch-tag">Cap. {q.chapter_sort_key}</span>
                    {/if}
                    <span class="prio-tag" class:high={q.priority >= 80}>
                      {q.priority >= 90 ? 'P:90 BLOCKER' : q.priority >= 85 ? 'P:85 STAFF' : q.priority >= 80 ? 'P:80 NOVO' : q.priority >= 70 ? 'P:70 GAP' : 'P:' + q.priority}
                    </span>
                  </div>
                </div>
                <span class="queued-badge">Aguardando</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="empty-simple-text">Fila de jobs vazia no momento.</p>
        {/if}
      </section>

      <!-- 2. Saúde das Fontes -->
      <section class="panel-card" style="margin-top: 24px;">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Saúde das Fontes</h2>
            <p class="panel-sub">Estado operacional e conectividade dos provedores</p>
          </div>
        </div>

        <div class="sources-list">
          {#each data.sources as src (src.id)}
            <div class="source-card">
              <div class="source-top">
                <strong class="source-name">{src.name}</strong>
                <span class="source-status-tag status-{src.status.toLowerCase()}">
                  {src.status}
                </span>
              </div>
              <div class="source-details">
                <span class="source-rate">Taxa: {src.rate_limit_per_second} req/s</span>
                <span class="source-sync">Ciclo: {src.sync_interval_minutes}m</span>
              </div>
              {#if src.last_sync_at}
                <div class="source-time">
                  <Clock size={11} />
                  <span>Último sync {relativeTime(src.last_sync_at)}</span>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </section>

      <!-- 3. Diagnóstico Avançado & Falhas Recentes -->
      <section class="panel-card" style="margin-top: 24px;">
        <details class="diagnosis-accordion">
          <summary class="diagnosis-summary">
            <div class="diag-header-wrap">
              <Activity size={16} />
              <h2 class="panel-title-inline">Diagnóstico Avançado & Falhas</h2>
            </div>
            {#if data.counts.failed1h > 0}
              <span class="badge-red-mini">{data.counts.failed1h} falhas recentes</span>
            {:else}
              <span class="badge-green-mini">Estável</span>
            {/if}
          </summary>

          <div class="diagnosis-body">
            <!-- Telemetry Stats -->
            {#if data.telemetry}
              <div class="diag-meta-grid">
                <div class="diag-stat">
                  <span class="diag-label">Heap Usado</span>
                  <strong class="diag-val">{data.telemetry.heap_used_mb} MB / {data.telemetry.heap_total_mb} MB</strong>
                </div>
                <div class="diag-stat">
                  <span class="diag-label">Array Buffers</span>
                  <strong class="diag-val">{data.telemetry.array_buffers_mb} MB</strong>
                </div>
                <div class="diag-stat">
                  <span class="diag-label">Ação do Ciclo</span>
                  <strong class="diag-val">{data.telemetry.cycle_action}</strong>
                </div>
                <div class="diag-stat">
                  <span class="diag-label">Jobs Ativos</span>
                  <strong class="diag-val">{data.telemetry.active_jobs}</strong>
                </div>
              </div>
            {/if}

            <!-- Recent Failures List -->
            {#if data.recentFailures?.length > 0}
              <h4 class="diag-sub-heading">Últimas Falhas Registradas</h4>
              <div class="recent-failures-list">
                {#each data.recentFailures as fail (fail.id)}
                  <div class="recent-failure-item">
                    <div class="fail-top">
                      <span class="fail-source">{fail.source}</span>
                      {#if fail.chapter_sort_key}
                        <span class="fail-ch">Cap. {fail.chapter_sort_key}</span>
                      {/if}
                      <span class="fail-time">{relativeTime(fail.updated_at)}</span>
                    </div>
                    {#if fail.last_error}
                      <code class="fail-err-msg">{fail.last_error}</code>
                    {/if}
                  </div>
                {/each}
              </div>
            {:else}
              <p class="diag-empty">Nenhuma falha recente registrada no sistema.</p>
            {/if}
          </div>
        </details>
      </section>
    </div>
  </div>
</div>

<!-- Modal: Priorizar Obra Manualmente -->
{#if showPrioritizeModal}
  <div
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={() => (showPrioritizeModal = false)}
    onkeydown={(e) => { if (e.key === 'Escape') showPrioritizeModal = false; }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="modal-card"
      role="document"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <div class="modal-title-wrap">
          <Flame size={18} class="flame-icon" />
          <h3 class="modal-title">Priorizar Obra no Importer</h3>
        </div>
        <button
          type="button"
          class="modal-close-btn"
          onclick={() => (showPrioritizeModal = false)}
        >
          <X size={18} />
        </button>
      </div>

      <p class="modal-desc">
        A obra selecionada receberá prioridade operacional Staff (P: 85), ultrapassando a fila de rotina sem quebrar a Barreira Canônica.
      </p>

      <form method="POST" action="?/prioritize" use:enhance={() => {
        submitting = true;
        return async ({ update }) => {
          submitting = false;
          showPrioritizeModal = false;
          await update();
        };
      }}>
        <div class="modal-field">
          <label for="work-select" class="field-label">Selecione a Obra</label>
          <select
            id="work-select"
            name="work_id"
            class="field-select"
            required
            bind:value={selectedWorkId}
          >
            <option value="" disabled selected>Escolha uma obra do catálogo...</option>
            {#each data.catalogWorks as w (w.id)}
              <option value={w.id}>{w.title}</option>
            {/each}
          </select>
        </div>

        <div class="modal-field">
          <label for="reason-input" class="field-label">Motivo da priorização (opcional)</label>
          <input
            id="reason-input"
            name="reason"
            type="text"
            class="field-input"
            placeholder="Ex: Novo arco lançado, pedido de assinante, etc."
            bind:value={reasonText}
            maxlength="150"
          />
        </div>

        <div class="modal-actions">
          <button
            type="button"
            class="btn-modal-cancel"
            onclick={() => (showPrioritizeModal = false)}
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="btn-modal-submit"
            disabled={!selectedWorkId || submitting}
          >
            {#if submitting}
              <span>Priorizando…</span>
            {:else}
              <Flame size={14} />
              <span>Priorizar Imediatamente</span>
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Modal: Conflito de Prioridade Absoluta -->
{#if form?.conflict && showConflictModal}
  <div
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={() => (showConflictModal = false)}
    onkeydown={(e) => { if (e.key === 'Escape') showConflictModal = false; }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="modal-card conflict-card"
      role="document"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <div class="modal-title-wrap">
          <AlertTriangle size={20} class="conflict-alert-icon" />
          <h3 class="modal-title">Substituir Prioridade Absoluta?</h3>
        </div>
        <button
          type="button"
          class="modal-close-btn"
          onclick={() => (showConflictModal = false)}
        >
          <X size={18} />
        </button>
      </div>

      <p class="modal-desc">
        Já existe uma prioridade absoluta ativa: <strong>{form.activeWorkTitle}</strong>.
      </p>

      <p class="conflict-prompt">
        Deseja substituir a prioridade atual por esta nova obra?
      </p>

      <div class="modal-actions">
        <button
          type="button"
          class="btn-modal-cancel"
          onclick={() => (showConflictModal = false)}
        >
          Não
        </button>
        <form method="POST" action="?/prioritize" use:enhance={() => {
          submitting = true;
          return async ({ update }) => {
            submitting = false;
            showConflictModal = false;
            await update();
          };
        }}>
          <input type="hidden" name="work_id" value={form.workId} />
          <input type="hidden" name="force_replace" value="true" />
          <button
            type="submit"
            class="btn-modal-submit replace-btn"
            disabled={submitting}
          >
            {#if submitting}
              <span>Substituindo…</span>
            {:else}
              <Flame size={14} />
              <span>Substituir prioridade</span>
            {/if}
          </button>
        </form>
      </div>
    </div>
  </div>
{/if}

<!-- Modal: Confirmação de Cancelamento de Prioridade Absoluta -->
{#if showCancelConfirmModal && data.activeFocus}
  <div
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={() => (showCancelConfirmModal = false)}
    onkeydown={(e) => { if (e.key === 'Escape') showCancelConfirmModal = false; }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="modal-card cancel-confirm-card"
      role="document"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <div class="modal-title-wrap">
          <AlertTriangle size={20} class="cancel-alert-icon" />
          <h3 class="modal-title">Cancelar prioridade?</h3>
        </div>
        <button
          type="button"
          class="modal-close-btn"
          onclick={() => (showCancelConfirmModal = false)}
        >
          <X size={18} />
        </button>
      </div>

      <p class="modal-desc">
        A obra <strong>{data.activeFocus.works?.title || 'atual'}</strong> deixará de receber prioridade absoluta e o Importer retomará a fila normal.
      </p>

      <div class="modal-actions">
        <button
          type="button"
          class="btn-modal-cancel"
          onclick={() => (showCancelConfirmModal = false)}
        >
          Voltar
        </button>
        <form method="POST" action="?/cancel" use:enhance={() => {
          submitting = true;
          return async ({ update }) => {
            submitting = false;
            showCancelConfirmModal = false;
            await update();
          };
        }}>
          <input type="hidden" name="request_id" value={data.activeFocus.id} />
          <button
            type="submit"
            class="btn-modal-danger"
            disabled={submitting}
          >
            {#if submitting}
              <span>Cancelando…</span>
            {:else}
              <X size={14} />
              <span>Cancelar prioridade</span>
            {/if}
          </button>
        </form>
      </div>
    </div>
  </div>
{/if}

<!-- Modal: Manifesto Canônico Multi-Fonte -->
{#if showManifestModal && selectedManifestWork}
  <div
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={() => (showManifestModal = false)}
    onkeydown={(e) => {
      if (e.key === 'Escape') showManifestModal = false;
    }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="modal-card manifest-modal-card"
      role="document"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <div class="manifest-modal-title-wrap">
          <div class="manifest-icon-badge">
            <FileText size={20} class="text-crimson" />
          </div>
          <div>
            <h3 class="modal-title">{selectedManifestWork.work?.title || 'Manifesto Canônico'}</h3>
            <p class="manifest-sub-text">
              Manifesto unificado de capítulos e proveniência multi-fonte (Zero duplicações na plataforma)
            </p>
          </div>
        </div>
        <button type="button" class="btn-modal-close" onclick={() => (showManifestModal = false)}>
          <X size={18} />
        </button>
      </div>

      <div class="manifest-modal-body">
        <div class="manifest-summary-strip">
          <div class="manifest-kpi">
            <span class="kpi-title">Capítulos Conhecidos:</span>
            <strong class="kpi-num">{selectedManifestWork.total_known_chapters || 0}</strong>
          </div>
          <div class="manifest-kpi">
            <span class="kpi-title">Importados:</span>
            <strong class="kpi-num text-emerald">{selectedManifestWork.total_imported_chapters || 0}</strong>
          </div>
          <div class="manifest-kpi">
            <span class="kpi-title">Status da Obra:</span>
            <span class="health-status-badge status-{selectedManifestWork.health_status?.toLowerCase()}">
              {selectedManifestWork.health_status}
            </span>
          </div>
          {#if selectedManifestWork.missing_start}
            <div class="manifest-kpi alert">
              <AlertTriangle size={13} class="text-amber" />
              <span class="text-amber">Falta início (1..{selectedManifestWork.first_chapter_number - 1})</span>
            </div>
          {/if}
        </div>

        {#if manifestLoading}
          <div class="manifest-loading-box">
            <RotateCw size={28} class="animate-spin text-crimson" />
            <p>Carregando manifesto canônico da obra...</p>
          </div>
        {:else if manifestChapters.length > 0}
          <div class="manifest-table-wrap">
            <table class="manifest-table">
              <thead>
                <tr>
                  <th>Capítulo</th>
                  <th>Status Canônico</th>
                  <th>Fonte Primária</th>
                  <th>Fontes Disponíveis (Fallback)</th>
                  <th>Páginas</th>
                  <th>Verificado</th>
                </tr>
              </thead>
              <tbody>
                {#each manifestChapters as ch}
                  <tr class="manifest-row status-{ch.status?.toLowerCase()}">
                    <td class="td-ch-num">
                      <strong>Cap. {ch.chapter_sort_key ?? ch.chapter_number}</strong>
                    </td>
                    <td class="td-ch-status">
                      <span class="ch-badge ch-{ch.status?.toLowerCase()}">
                        {#if ch.status === 'PUBLISHED'}
                          <CheckCircle2 size={12} />
                          PUBLISHED
                        {:else if ch.status === 'STAGED'}
                          <Clock size={12} />
                          STAGED
                        {:else if ch.status === 'QUEUED'}
                          <RotateCw size={12} class="animate-spin-slow" />
                          QUEUED
                        {:else if ch.status === 'UNRESOLVED_GAP'}
                          <AlertOctagon size={12} />
                          UNRESOLVED GAP
                        {:else}
                          {ch.status}
                        {/if}
                      </span>
                    </td>
                    <td class="td-ch-source">
                      {#if ch.selected_source}
                        <span class="source-tag source-{ch.selected_source}">
                          {ch.selected_source}
                        </span>
                      {:else}
                        <span class="source-none">—</span>
                      {/if}
                    </td>
                    <td class="td-ch-fallbacks">
                      <div class="fallback-sources-list">
                        {#if Array.isArray(ch.available_sources) && ch.available_sources.length > 0}
                          {#each ch.available_sources as s}
                            <span class="fallback-tag" class:is-selected={s.source === ch.selected_source}>
                              {s.source} ({s.page_count || '?'}p)
                            </span>
                          {/each}
                        {:else}
                          <span class="fallback-empty">Nenhum</span>
                        {/if}
                      </div>
                    </td>
                    <td class="td-ch-pages">
                      {ch.page_count > 0 ? ch.page_count + ' páginas' : '—'}
                    </td>
                    <td class="td-ch-time">
                      {ch.last_checked_at ? relativeTime(ch.last_checked_at) : '—'}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <div class="manifest-empty-box">
            <FileText size={32} class="text-zinc-500" />
            <p>Nenhum capítulo cadastrado no manifesto desta obra ainda.</p>
            <p class="sub">Execute uma reconciliação para descobrir todos os capítulos nas fontes cadastradas.</p>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button type="button" class="btn-cancel" onclick={() => (showManifestModal = false)}>
          Fechar
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Hero Priority Card */
  .priority-hero-card {
    position: relative;
    display: flex;
    overflow: hidden;
    background: linear-gradient(135deg, rgba(239, 107, 74, 0.08) 0%, rgba(20, 24, 38, 0.95) 45%, rgba(139, 92, 246, 0.06) 100%);
    border: 1px solid rgba(239, 107, 74, 0.35);
    border-radius: 16px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45), 0 0 24px rgba(239, 107, 74, 0.12);
  }

  .hero-left-accent {
    width: 6px;
    background: linear-gradient(180deg, #ef6b4a 0%, #dfc28d 50%, #8b5cf6 100%);
    flex-shrink: 0;
  }

  .hero-content {
    flex: 1;
    min-width: 0;
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .hero-work-row {
    display: flex;
    align-items: center;
    gap: 18px;
    flex-wrap: wrap;
  }

  .hero-cover-wrap {
    position: relative;
    width: 54px;
    height: 76px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .hero-cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .hero-cover-placeholder {
    width: 100%;
    height: 100%;
    background: #1c2132;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
    color: #dfc28d;
  }

  .hero-flame-badge {
    position: absolute;
    bottom: 3px;
    right: 3px;
    background: #ef6b4a;
    color: #fff;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
  }

  .hero-meta {
    flex: 1;
    min-width: 220px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .hero-badge-line {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .focus-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(239, 107, 74, 0.18);
    border: 1px solid rgba(239, 107, 74, 0.45);
    color: #ff9b82;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.08em;
    padding: 3px 10px;
    border-radius: 999px;
  }

  .focus-pill.retrying {
    background: rgba(245, 158, 11, 0.18);
    border-color: rgba(245, 158, 11, 0.45);
    color: #fbbf24;
  }

  .focus-pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ef6b4a;
    box-shadow: 0 0 8px #ef6b4a;
    animation: pulse-dot 1.4s ease-in-out infinite alternate;
  }

  .focus-pause-badge {
    font-size: 11px;
    color: #dfc28d;
    background: rgba(223, 194, 141, 0.1);
    padding: 3px 8px;
    border-radius: 6px;
    border: 1px solid rgba(223, 194, 141, 0.2);
  }

  .focus-pause-badge.retry-badge {
    color: #fbbf24;
    background: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.25);
  }

  /* Hero Retry Info Card */
  .hero-retry-info-card {
    background: rgba(15, 18, 29, 0.85);
    border: 1px solid rgba(245, 158, 11, 0.35);
    border-radius: 10px;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .retry-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }

  .retry-icon {
    color: #fbbf24;
    flex-shrink: 0;
  }

  .retry-label {
    color: #94a3b8;
    font-size: 12px;
  }

  .status-badge-val {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 750;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .status-badge-val.retrying {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.4);
  }

  .retry-details-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 10px 16px;
  }

  .retry-detail-item {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .retry-detail-item.wide {
    grid-column: 1 / -1;
  }

  .detail-label {
    font-size: 11px;
    color: #64748b;
    font-weight: 600;
  }

  .detail-value {
    font-size: 12.5px;
    color: #cbd5e1;
    font-weight: 500;
  }

  .detail-value.error-text {
    color: #f87171;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    word-break: break-word;
    background: rgba(239, 68, 68, 0.08);
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .detail-value.highlight {
    color: #dfc28d;
    font-weight: 700;
  }

  .hero-work-title {
    margin: 0;
    font-size: 18px;
    font-weight: 750;
    color: #f1f3fa;
    line-height: 1.25;
  }

  .hero-work-link {
    color: inherit;
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .hero-work-link:hover {
    color: #dfc28d;
  }

  .hero-reason {
    margin: 0;
    font-size: 12px;
    color: #a0a6be;
  }

  .hero-requester {
    font-size: 11px;
    color: #6d7592;
  }

  .hero-actions {
    display: flex;
    align-items: center;
  }

  .btn-cancel-priority {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
    font-size: 12px;
    font-weight: 600;
    padding: 8px 14px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .focus-pill.blocked {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
    color: #fca5a5;
  }

  .focus-pause-badge.error-badge {
    color: #f87171;
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
  }

  .btn-retry-priority {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid rgba(34, 197, 94, 0.4);
    color: #86efac;
    font-size: 12px;
    font-weight: 600;
    padding: 8px 14px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    margin-right: 8px;
  }

  .btn-retry-priority:hover:not(:disabled) {
    background: rgba(34, 197, 94, 0.25);
    border-color: rgba(34, 197, 94, 0.6);
    color: #ffffff;
  }

  .hero-blocker-alert {
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: 10px;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .blocker-alert-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #fca5a5;
  }

  :global(.blocker-icon) {
    color: #ef4444;
    flex-shrink: 0;
  }

  .blocker-error-msg {
    color: #fee2e2;
    font-weight: 500;
  }

  .blocker-meta-row {
    display: flex;
    gap: 16px;
    font-size: 11.5px;
    color: #9d98b3;
    flex-wrap: wrap;
  }

  .blocker-meta-row span strong {
    color: #cbd2e8;
  }

  .btn-cancel-priority:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.22);
    border-color: rgba(239, 68, 68, 0.5);
    color: #fca5a5;
  }

  .hero-progress-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .hero-progress-labels {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .progress-left-label {
    color: #cbd2e8;
  }

  .progress-right-label {
    color: #dfc28d;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .hero-progress-track {
    width: 100%;
    height: 8px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    overflow: hidden;
  }

  .hero-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #ef6b4a 0%, #dfc28d 60%, #10b981 100%);
    border-radius: 999px;
    transition: width 0.4s ease;
  }

  .hero-stats-chips {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .hero-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 9px;
    border-radius: 6px;
  }

  .hero-chip.done {
    background: rgba(16, 185, 129, 0.12);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.25);
  }

  .hero-chip.staged {
    background: rgba(139, 92, 246, 0.12);
    color: #c084fc;
    border: 1px solid rgba(139, 92, 246, 0.25);
  }

  .hero-chip.pending {
    background: rgba(245, 158, 11, 0.12);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.25);
  }

  .hero-chip.info {
    background: rgba(255, 255, 255, 0.05);
    color: #94a3b8;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .spin-icon {
    animation: spin 2s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .conflict-alert-icon {
    color: #f59e0b;
  }

  .conflict-prompt {
    font-size: 13px;
    color: #cbd2e8;
    font-weight: 600;
    margin: 8px 0 0 0;
  }

  .btn-modal-submit.replace-btn {
    background: linear-gradient(135deg, #ef6b4a 0%, #dc2626 100%);
    box-shadow: 0 4px 14px rgba(239, 68, 68, 0.35);
  }
  .importer-dashboard {
    display: flex;
    flex-direction: column;
    gap: 26px;
    width: 100%;
    max-width: 1360px;
    margin: 0 auto;
    min-width: 0;
    box-sizing: border-box;
  }

  /* Header */
  .importer-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 24px;
    padding-bottom: 22px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-wrap: wrap;
  }

  .header-main-info {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .header-badge-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .importer-tag {
    font-size: 11px;
    font-weight: 750;
    letter-spacing: 0.12em;
    color: #dfc28d;
    text-transform: uppercase;
  }

  .header-sep {
    color: #4b5266;
  }

  .worker-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 700;
  }

  .worker-status-badge.online {
    background: rgba(16, 185, 129, 0.12);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .worker-status-badge.offline {
    background: rgba(239, 68, 68, 0.12);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .status-dot {
    width: 6.5px;
    height: 6.5px;
    border-radius: 50%;
    background: currentColor;
  }

  .status-dot.pulsing {
    box-shadow: 0 0 8px currentColor;
    animation: pulse 1.8s infinite ease-in-out;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.3); opacity: 0.6; }
  }

  .worker-id-tag {
    font-size: 11px;
    color: #7b8396;
    font-family: monospace;
  }

  .importer-title {
    margin: 0;
    font-family: var(--font-heading, 'Manrope', sans-serif);
    font-size: clamp(1.8rem, 3vw, 2.3rem);
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.025em;
  }

  .importer-subtitle {
    margin: 0;
    color: #8c93a8;
    font-size: 0.92rem;
    max-width: 640px;
    line-height: 1.5;
  }

  .telemetry-pills-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    flex-wrap: wrap;
  }

  .telemetry-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: #8c93a8;
    font-size: 11px;
  }

  .telemetry-pill strong {
    color: #ffffff;
  }

  .btn-prioritize {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 9px;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: #0c0d14;
    font-size: 13px;
    font-weight: 750;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(245, 158, 11, 0.25);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .btn-prioritize:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 22px rgba(245, 158, 11, 0.4);
  }

  /* Alert Banners */
  .alert-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
  }

  .alert-banner.error {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .alert-banner.success {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #6ee7b7;
  }

  /* Metric Summary Pills */
  .counts-pills-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .count-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 14px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.06);
    font-size: 12px;
    color: #8c93a8;
  }

  .count-pill.staged-alert {
    background: rgba(167, 139, 250, 0.08);
    border-color: rgba(167, 139, 250, 0.3);
  }

  .count-pill .value {
    color: #ffffff;
    font-weight: 750;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .dot.blue { background: #38bdf8; }
  .dot.gold { background: #dfc28d; }
  .dot.amber { background: #f59e0b; }
  .dot.purple { background: #c084fc; }
  .dot.green { background: #10b981; }
  .dot.red { background: #ef4444; }

  /* Importer Layout Grid */
  .importer-grid {
    display: grid;
    grid-template-columns: 1.6fr 1fr;
    gap: 28px;
    align-items: flex-start;
    min-width: 0;
    width: 100%;
  }

  @media (max-width: 1024px) {
    .importer-grid {
      grid-template-columns: 1fr;
    }
  }

  .panel-card {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 14px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .panel-title {
    font-size: 1.15rem;
    font-weight: 750;
    color: #ffffff;
    margin: 0;
  }

  .title-with-badge {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .badge-accent {
    font-size: 10.5px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 999px;
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .badge-purple {
    font-size: 10.5px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 999px;
    background: rgba(167, 139, 250, 0.15);
    color: #c084fc;
    border: 1px solid rgba(167, 139, 250, 0.3);
  }

  .panel-sub {
    font-size: 0.82rem;
    color: #7b8396;
    margin: 3px 0 0;
  }

  .live-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: #10b981;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
  }

  .live-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 6px #10b981;
    animation: pulse 1.5s infinite ease-in-out;
  }

  /* Active Jobs List */
  .active-jobs-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .active-job-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.2s ease;
  }

  .active-job-row:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .active-job-row.is-retry {
    border-color: rgba(245, 158, 11, 0.3);
    background: rgba(245, 158, 11, 0.03);
  }

  .job-thumb {
    width: 36px;
    height: 50px;
    border-radius: 6px;
    overflow: hidden;
    background: #111420;
    flex-shrink: 0;
    display: grid;
    place-items: center;
  }

  .thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumb-placeholder {
    font-size: 9px;
    font-weight: 800;
    color: #4b5266;
  }

  .job-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .job-line-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .job-work-title {
    font-size: 13.5px;
    font-weight: 700;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .job-status-chip {
    font-size: 10px;
    font-weight: 750;
    padding: 1px 7px;
    border-radius: 999px;
    text-transform: uppercase;
  }

  .job-status-chip.status-importing {
    background: rgba(56, 189, 248, 0.15);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.3);
  }

  .job-status-chip.status-retry {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .job-line-sub {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }

  .job-source-tag {
    color: #a78bfa;
    font-weight: 600;
    text-transform: capitalize;
  }

  .job-chapter-num {
    color: #dfc28d;
    font-weight: 600;
  }

  .job-priority-pill {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    color: #8c93a8;
  }

  .job-priority-pill.boosted {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
  }

  .job-retry-note {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #fbbf24;
  }

  .job-error-preview {
    font-size: 10.5px;
    color: #f87171;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Staff Requests */
  .staff-requests-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .staff-request-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .req-work-thumb {
    width: 34px;
    height: 46px;
    border-radius: 5px;
    overflow: hidden;
    background: #111420;
    flex-shrink: 0;
    display: grid;
    place-items: center;
  }

  .req-main-meta {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .req-header-line {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .req-work-title {
    font-size: 13px;
    color: #ffffff;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .req-status-pill {
    font-size: 9.5px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 999px;
    text-transform: uppercase;
  }

  .req-status-pill.status-queued {
    background: rgba(245, 158, 11, 0.12);
    color: #fbbf24;
  }

  .req-status-pill.status-importing {
    background: rgba(56, 189, 248, 0.12);
    color: #38bdf8;
  }

  .req-status-pill.status-completed {
    background: rgba(16, 185, 129, 0.12);
    color: #10b981;
  }

  .req-status-pill.status-cancelled {
    background: rgba(255, 255, 255, 0.06);
    color: #7b8396;
  }

  .req-details-line {
    font-size: 11.5px;
    color: #8c93a8;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .req-operator strong {
    color: #dfc28d;
  }

  .req-boost-tag {
    font-size: 10px;
    font-weight: 750;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .req-reason {
    font-size: 11px;
    color: #a5abbc;
    margin: 2px 0 0;
    font-style: italic;
  }

  .btn-cancel-req {
    padding: 5px 11px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 650;
    color: #f87171;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.25);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-cancel-req:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
  }

  /* STAGED Chapters List */
  .staged-chapters-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .staged-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 9px 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
    gap: 8px;
  }

  .staged-info {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .staged-work {
    font-size: 12.5px;
    color: #ffffff;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .staged-ch {
    font-size: 12px;
    color: #c084fc;
    font-weight: 600;
  }

  .staged-source-chip {
    font-size: 10px;
    color: #7b8396;
    text-transform: capitalize;
  }

  .staged-barrier-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10.5px;
    color: #c084fc;
    background: rgba(167, 139, 250, 0.08);
    padding: 3px 8px;
    border-radius: 4px;
    white-space: nowrap;
  }

  /* Right Column: Queued Jobs */
  .queued-jobs-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .queued-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  .queued-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .queued-title {
    font-size: 12px;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .queued-sub {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
  }

  .source-tag { color: #8c93a8; text-transform: capitalize; }
  .ch-tag { color: #dfc28d; }
  .prio-tag { color: #7b8396; font-weight: 700; }
  .prio-tag.high { color: #fbbf24; }

  .queued-badge {
    font-size: 10px;
    color: #7b8396;
  }

  /* Sources List */
  .sources-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .source-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  .source-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .source-name {
    font-size: 13px;
    color: #ffffff;
  }

  .source-status-tag {
    font-size: 9.5px;
    font-weight: 750;
    padding: 2px 7px;
    border-radius: 999px;
  }

  .source-status-tag.status-active {
    background: rgba(16, 185, 129, 0.12);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .source-status-tag.status-paused {
    background: rgba(245, 158, 11, 0.12);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .source-details {
    display: flex;
    gap: 12px;
    font-size: 11px;
    color: #8c93a8;
  }

  .source-time {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10.5px;
    color: #656d82;
  }

  .empty-panel-notice {
    padding: 24px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.015);
    border: 1px dashed rgba(255, 255, 255, 0.06);
    text-align: center;
    font-size: 12.5px;
    color: #7b8396;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .empty-icon {
    color: #10b981;
  }

  .empty-simple-text {
    font-size: 12px;
    color: #656d82;
    margin: 8px 0;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: grid;
    place-items: center;
    z-index: 1000;
    padding: 16px;
  }

  .modal-card {
    width: 100%;
    max-width: 500px;
    background: #111422;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    padding: 24px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .modal-title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .flame-icon {
    color: #f59e0b;
  }

  .modal-title {
    font-size: 1.15rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
  }

  .modal-close-btn {
    background: none;
    border: none;
    color: #7b8396;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    transition: color 0.15s ease;
  }

  .modal-close-btn:hover {
    color: #ffffff;
  }

  .modal-desc {
    font-size: 12.5px;
    color: #8c93a8;
    line-height: 1.5;
    margin: 0 0 20px;
  }

  .modal-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
  }

  .field-label {
    font-size: 12px;
    font-weight: 650;
    color: #d1cde0;
  }

  .field-select,
  .field-input {
    width: 100%;
    padding: 10px 14px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #ffffff;
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s ease;
  }

  .field-select:focus,
  .field-input:focus {
    border-color: #dfc28d;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 24px;
  }

  .btn-modal-cancel {
    padding: 9px 16px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #8c93a8;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-modal-submit {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 18px;
    border-radius: 8px;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    border: none;
    color: #0c0d14;
    font-size: 12.5px;
    font-weight: 750;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-modal-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-modal-danger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #ef4444;
    color: #ffffff;
    border: none;
    padding: 9px 18px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 750;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-modal-danger:hover:not(:disabled) {
    background: #dc2626;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.35);
  }

  .btn-modal-danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .cancel-confirm-card {
    max-width: 460px;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .cancel-alert-icon {
    color: #ef4444;
  }

  .req-cancel-reason-tag {
    font-size: 11px;
    color: #94a3b8;
    background: rgba(148, 163, 184, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: 6px;
    font-weight: 500;
  }

  .count-pill.has-failures {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.35);
  }

  .count-pill .sub-val {
    font-size: 11px;
    color: #6b7280;
    margin-left: 2px;
  }

  /* Diagnosis Accordion */
  .diagnosis-accordion {
    width: 100%;
  }

  .diagnosis-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    list-style: none;
    user-select: none;
  }

  .diagnosis-summary::-webkit-details-marker {
    display: none;
  }

  .diag-header-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #dfc28d;
  }

  .panel-title-inline {
    font-size: 15px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .badge-red-mini {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(239, 68, 68, 0.15);
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .badge-green-mini {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(16, 185, 129, 0.15);
    color: #6ee7b7;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .diagnosis-body {
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .diag-meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 10px;
  }

  .diag-stat {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    padding: 10px 12px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .diag-label {
    font-size: 10.5px;
    color: #8c93a8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .diag-val {
    font-size: 13.5px;
    color: #f3f4f6;
  }

  .diag-sub-heading {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #8c93a8;
    margin: 0;
  }

  .recent-failures-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .recent-failure-item {
    background: rgba(239, 68, 68, 0.04);
    border: 1px solid rgba(239, 68, 68, 0.15);
    padding: 10px 12px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .fail-top {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11.5px;
  }

  .fail-source {
    font-weight: 700;
    color: #b59af5;
  }

  .fail-ch {
    color: #d1cde0;
  }

  .fail-time {
    color: #6b7280;
    margin-left: auto;
  }

  .fail-err-msg {
    font-size: 11px;
    color: #fca5a5;
    background: rgba(0, 0, 0, 0.3);
    padding: 4px 8px;
    border-radius: 4px;
    word-break: break-word;
    font-family: monospace;
  }

  .diag-empty {
    font-size: 12.5px;
    color: #8c93a8;
    margin: 0;
  }

  /* Priority Search & Entry Card */
  .priority-entry-card {
    background: linear-gradient(180deg, rgba(26, 18, 42, 0.7) 0%, rgba(13, 15, 24, 0.9) 100%);
    border: 1px solid rgba(249, 115, 22, 0.25);
    border-radius: 16px;
    padding: 22px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45), 0 0 24px rgba(249, 115, 22, 0.08);
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-sizing: border-box;
    width: 100%;
  }

  .priority-entry-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .priority-entry-title-wrap {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }

  .flame-pulse-icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: rgba(249, 115, 22, 0.15);
    border: 1px solid rgba(249, 115, 22, 0.4);
    color: #f97316;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 0 16px rgba(249, 115, 22, 0.2);
  }

  .priority-entry-heading {
    font-size: 18px;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 4px;
    letter-spacing: -0.01em;
  }

  .priority-entry-desc {
    font-size: 13px;
    color: #9d98b3;
    margin: 0;
    line-height: 1.45;
  }

  .priority-search-box {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .search-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
  }

  :global(.input-mode-icon) {
    position: absolute;
    left: 16px;
    color: #8c889f;
    pointer-events: none;
  }

  :global(.input-mode-icon.link-mode) {
    color: #f97316;
  }

  .priority-search-input {
    width: 100%;
    padding: 14px 44px 14px 46px;
    background: rgba(10, 12, 20, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    color: #ffffff;
    font-size: 14px;
    outline: none;
    box-sizing: border-box;
    transition: all 0.2s ease;
  }

  .priority-search-input:focus {
    border-color: #f97316;
    background: rgba(14, 16, 28, 0.95);
    box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.15);
  }

  .priority-search-input::placeholder {
    color: #6b6680;
  }

  :global(.search-spin-icon) {
    position: absolute;
    right: 16px;
    color: #f97316;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .btn-clear-search {
    position: absolute;
    right: 12px;
    background: transparent;
    border: none;
    color: #8c889f;
    padding: 6px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-clear-search:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.1);
  }

  .provider-detected-tag {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #9d98b3;
    padding: 4px 12px;
    background: rgba(249, 115, 22, 0.08);
    border: 1px solid rgba(249, 115, 22, 0.25);
    border-radius: 999px;
    width: fit-content;
  }

  .provider-name {
    color: #f97316;
    letter-spacing: 0.06em;
  }

  /* Candidates List */
  .candidates-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 4px;
  }

  .candidates-header-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
  }

  .candidates-count-tag {
    color: #8c889f;
    font-weight: 600;
  }

  .url-mode-badge {
    color: #f97316;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 11px;
    background: rgba(249, 115, 22, 0.1);
    border: 1px solid rgba(249, 115, 22, 0.3);
    padding: 2px 8px;
    border-radius: 999px;
  }

  .candidates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 12px;
  }

  .candidate-card {
    background: rgba(14, 16, 26, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: all 0.2s ease;
    box-sizing: border-box;
  }

  .candidate-card:hover {
    border-color: rgba(249, 115, 22, 0.4);
    background: rgba(20, 22, 36, 0.95);
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  }

  .candidate-card.is-direct-url {
    border-color: rgba(249, 115, 22, 0.45);
    background: rgba(26, 20, 36, 0.95);
  }

  .candidate-cover-box {
    position: relative;
    width: 44px;
    height: 60px;
    border-radius: 6px;
    overflow: hidden;
    background: #080910;
    flex-shrink: 0;
  }

  .candidate-cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .candidate-cover-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 800;
    color: #4a455a;
    background: rgba(255, 255, 255, 0.03);
  }

  .candidate-provider-badge {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    font-size: 8.5px;
    font-weight: 800;
    text-align: center;
    text-transform: uppercase;
    padding: 1px 0;
    color: #ffffff;
    background: rgba(0, 0, 0, 0.8);
  }

  .candidate-provider-badge.provider-kuro { background: rgba(124, 58, 237, 0.95); }
  .candidate-provider-badge.provider-nexus { background: rgba(37, 99, 235, 0.95); }
  .candidate-provider-badge.provider-mangaflix { background: rgba(217, 119, 6, 0.95); }
  .candidate-provider-badge.provider-manhastro { background: rgba(5, 150, 105, 0.95); }
  .candidate-provider-badge.provider-mangotoons { background: rgba(225, 29, 72, 0.95); }

  .candidate-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .candidate-title {
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .candidate-sub-tags {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .status-pill {
    font-size: 10.5px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
  }

  .status-pill.in-nox {
    background: rgba(16, 185, 129, 0.12);
    color: #6ee7b7;
    border: 1px solid rgba(16, 185, 129, 0.25);
  }

  .status-pill.new-work {
    background: rgba(249, 115, 22, 0.12);
    color: #fb923c;
    border: 1px solid rgba(249, 115, 22, 0.25);
  }

  .status-pill.ch-count {
    background: rgba(255, 255, 255, 0.06);
    color: #d1cde0;
  }

  .candidate-source-url {
    font-size: 11px;
    color: #6b6680;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  }

  .candidate-action-wrap {
    flex-shrink: 0;
  }

  .btn-prioritize-card {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #ffffff;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(234, 88, 12, 0.35);
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .btn-prioritize-card:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(234, 88, 12, 0.5);
  }

  .btn-prioritize-card:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .search-empty-state {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 18px;
    background: rgba(239, 68, 68, 0.06);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 10px;
    color: #fca5a5;
    font-size: 13px;
  }

  @media (max-width: 640px) {
    .candidates-grid {
      grid-template-columns: 1fr;
    }

    .candidate-card {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }

    .candidate-card > .candidate-cover-box {
      align-self: flex-start;
    }

    .btn-prioritize-card {
      width: 100%;
      justify-content: center;
    }

    .importer-header {
      flex-direction: column;
      align-items: stretch;
      gap: 14px;
    }

    .header-action-wrap {
      width: 100%;
    }

    .btn-prioritize {
      width: 100%;
      justify-content: center;
      box-sizing: border-box;
    }

    .telemetry-pills-row {
      gap: 6px;
    }

    .telemetry-pill {
      flex: 1 1 calc(50% - 6px);
      justify-content: center;
      box-sizing: border-box;
    }

    .counts-pills-bar {
      gap: 8px;
    }

    .count-pill {
      flex: 1 1 calc(50% - 8px);
      justify-content: center;
      box-sizing: border-box;
    }
  }

  /* Catalog Health & Cross-Provider Reconciler Panel */
  .catalog-health-panel {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 24px;
    background: linear-gradient(135deg, rgba(16, 20, 32, 0.95) 0%, rgba(26, 17, 34, 0.85) 100%);
    border: 1px solid rgba(220, 38, 38, 0.25);
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(220, 38, 38, 0.08);
    margin-bottom: 24px;
  }

  .health-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    padding-bottom: 16px;
  }

  .health-title-group {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }

  .health-icon-box {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(220, 38, 38, 0.15);
    border: 1px solid rgba(220, 38, 38, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .health-title {
    font-size: 1.25rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 4px 0;
    letter-spacing: -0.02em;
  }

  .health-subtitle {
    font-size: 0.85rem;
    color: #9ca3af;
    margin: 0;
    max-width: 800px;
    line-height: 1.45;
  }

  .coverage-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 999px;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.35);
    color: #c4b5fd;
    font-size: 0.82rem;
    font-weight: 650;
  }

  .health-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
  }

  @media (max-width: 1024px) {
    .health-kpi-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 640px) {
    .health-kpi-grid {
      grid-template-columns: 1fr;
    }
  }

  .kpi-card {
    padding: 16px;
    border-radius: 12px;
    background: rgba(15, 18, 28, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .kpi-card.card-healthy {
    border-color: rgba(16, 185, 129, 0.3);
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 18, 28, 0.8) 100%);
  }

  .kpi-card.card-incomplete {
    border-color: rgba(245, 158, 11, 0.3);
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 18, 28, 0.8) 100%);
  }

  .kpi-card.card-reconciling {
    border-color: rgba(6, 182, 212, 0.3);
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(15, 18, 28, 0.8) 100%);
  }

  .kpi-card.card-unresolved {
    border-color: rgba(168, 85, 247, 0.3);
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(15, 18, 28, 0.8) 100%);
  }

  .kpi-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .kpi-label {
    font-size: 0.8rem;
    font-weight: 650;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .kpi-value {
    font-size: 1.85rem;
    font-weight: 850;
    line-height: 1.1;
  }

  .kpi-sub {
    font-size: 0.76rem;
    color: #6b7280;
  }

  .health-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
  }

  .health-search-wrap {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1 1 320px;
    max-width: 440px;
  }

  :global(.health-search-icon) {
    position: absolute;
    left: 14px;
    color: #6b7280;
    pointer-events: none;
  }

  .health-search-input {
    width: 100%;
    padding: 10px 38px 10px 38px;
    background: rgba(10, 12, 20, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: #ffffff;
    font-size: 0.85rem;
    outline: none;
    box-sizing: border-box;
    transition: all 0.2s ease;
  }

  .health-search-input:focus {
    border-color: #ef4444;
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.15);
  }

  .health-filter-chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .filter-chip {
    padding: 6px 14px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #9ca3af;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-chip:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .filter-chip.active {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
    color: #fca5a5;
  }

  .filter-chip.chip-healthy.active {
    background: rgba(16, 185, 129, 0.2);
    border-color: rgba(16, 185, 129, 0.5);
    color: #6ee7b7;
  }

  .filter-chip.chip-incomplete.active {
    background: rgba(245, 158, 11, 0.2);
    border-color: rgba(245, 158, 11, 0.5);
    color: #fcd34d;
  }

  .filter-chip.chip-reconciling.active {
    background: rgba(6, 182, 212, 0.2);
    border-color: rgba(6, 182, 212, 0.5);
    color: #67e8f9;
  }

  .filter-chip.chip-unresolved.active {
    background: rgba(168, 85, 247, 0.2);
    border-color: rgba(168, 85, 247, 0.5);
    color: #d8b4fe;
  }

  .health-works-table-wrap {
    overflow-x: auto;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    background: rgba(10, 12, 18, 0.6);
  }

  .health-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.83rem;
  }

  .health-table th {
    text-align: left;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    color: #9ca3af;
    font-weight: 650;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  .health-table td {
    padding: 12px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    vertical-align: middle;
  }

  .health-row:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .health-work-info {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 220px;
  }

  .health-cover-box {
    width: 34px;
    height: 48px;
    border-radius: 6px;
    overflow: hidden;
    background: #141724;
    border: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  .health-cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .health-cover-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 800;
    color: #6b7280;
  }

  .health-work-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .health-work-link {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-weight: 700;
    color: #ffffff;
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .health-work-link:hover {
    color: #f97316;
  }

  .health-work-slug {
    font-size: 0.72rem;
    color: #6b7280;
    font-family: monospace;
  }

  .health-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .status-healthy {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.35);
  }

  .status-incomplete {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.35);
  }

  .status-reconciling {
    background: rgba(6, 182, 212, 0.15);
    color: #22d3ee;
    border: 1px solid rgba(6, 182, 212, 0.35);
  }

  .status-unverified {
    background: rgba(107, 114, 128, 0.15);
    color: #9ca3af;
    border: 1px solid rgba(107, 114, 128, 0.35);
  }

  .start-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 0.74rem;
    font-weight: 650;
    white-space: nowrap;
  }

  .badge-missing-start {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .badge-start-ok {
    background: rgba(16, 185, 129, 0.1);
    color: #6ee7b7;
    border: 1px solid rgba(16, 185, 129, 0.2);
  }

  .coverage-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 140px;
  }

  .coverage-bar-track {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    overflow: hidden;
  }

  .coverage-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #f59e0b, #ef4444);
    border-radius: 999px;
    transition: width 0.3s ease;
  }

  .coverage-bar-fill.fill-complete {
    background: linear-gradient(90deg, #10b981, #059669);
  }

  .coverage-text {
    font-size: 0.75rem;
    color: #d1d5db;
  }

  .coverage-percent {
    color: #9ca3af;
    font-size: 0.72rem;
  }

  .provider-badges-list {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    min-width: 150px;
  }

  .prov-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 650;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e5e7eb;
  }

  .prov-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
  }

  .prov-tag.inactive .prov-dot {
    background: #ef4444;
  }

  .prov-count {
    color: #fbbf24;
    font-weight: 750;
  }

  .gaps-list {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    min-width: 160px;
  }

  .gap-pill {
    padding: 2px 7px;
    border-radius: 4px;
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #fbbf24;
    font-size: 0.71rem;
    font-weight: 650;
  }

  .gap-pill.gap-start {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.35);
    color: #f87171;
  }

  .gap-pill.gap-unresolved {
    background: rgba(168, 85, 247, 0.15);
    border-color: rgba(168, 85, 247, 0.35);
    color: #d8b4fe;
  }

  .gaps-none {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.74rem;
    font-weight: 600;
  }

  .action-btn-group {
    display: flex;
    gap: 6px;
    align-items: center;
    white-space: nowrap;
  }

  .btn-reconcile-action {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 11px;
    border-radius: 7px;
    background: rgba(6, 182, 212, 0.12);
    border: 1px solid rgba(6, 182, 212, 0.3);
    color: #22d3ee;
    font-size: 0.76rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-reconcile-action:hover:not(:disabled) {
    background: rgba(6, 182, 212, 0.25);
    border-color: #22d3ee;
  }

  .btn-reconcile-action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-manifest-action {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 11px;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #d1d5db;
    font-size: 0.76rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-manifest-action:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  /* Manifest Modal */
  .manifest-modal-card {
    max-width: 840px;
    width: 95%;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
  }

  .manifest-modal-title-wrap {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .manifest-icon-badge {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .manifest-sub-text {
    font-size: 0.78rem;
    color: #9ca3af;
    margin: 2px 0 0 0;
  }

  .manifest-modal-body {
    padding: 16px 24px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .manifest-summary-strip {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    flex-wrap: wrap;
  }

  .manifest-kpi {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
  }

  .manifest-kpi .kpi-title {
    color: #9ca3af;
  }

  .manifest-table-wrap {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    overflow-x: auto;
  }

  .manifest-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }

  .manifest-table th {
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.04);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    color: #9ca3af;
    text-align: left;
    font-weight: 650;
    white-space: nowrap;
  }

  .manifest-table td {
    padding: 9px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    vertical-align: middle;
  }

  .ch-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 0.72rem;
    font-weight: 700;
  }

  .ch-published {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .ch-staged {
    background: rgba(168, 85, 247, 0.15);
    color: #c084fc;
  }

  .ch-queued {
    background: rgba(6, 182, 212, 0.15);
    color: #22d3ee;
  }

  .ch-unresolved_gap {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .fallback-sources-list {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .fallback-tag {
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.05);
    font-size: 0.69rem;
    color: #9ca3af;
  }

  .fallback-tag.is-selected {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
  }

  .manifest-loading-box,
  .manifest-empty-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 36px 16px;
    color: #9ca3af;
    text-align: center;
  }

  .animate-spin-slow {
    animation: spin 3s linear infinite;
  }

  .text-crimson { color: #ef4444; }
  .text-emerald { color: #10b981; }
  .text-amber { color: #f59e0b; }
  .text-cyan { color: #06b6d4; }
  .text-purple { color: #a855f7; }
</style>
