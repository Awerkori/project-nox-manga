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
    ArrowRight
  } from '@lucide/svelte';
  import { relativeTime } from '$lib/types';

  let { data, form } = $props();

  let showPrioritizeModal = $state(false);
  let selectedWorkId = $state('');
  let reasonText = $state('');
  let submitting = $state(false);
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

        {#if data.activeJobs.length > 0}
          <div class="active-jobs-list">
            {#each data.activeJobs as job (job.id)}
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
              <span class="badge-accent">{data.staffRequests.length} registradas</span>
            </div>
            <p class="panel-sub">Obras com boost de prioridade manual atribuído por editores e administradores</p>
          </div>
        </div>

        {#if data.staffRequests.length > 0}
          <div class="staff-requests-list">
            {#each data.staffRequests as req (req.id)}
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
                  </div>
                  <div class="req-details-line">
                    <span class="req-operator">Solicitado por: <strong>{req.members?.display_name || req.members?.username || 'Staff'}</strong></span>
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

        {#if data.stagedChapters.length > 0}
          <div class="staged-chapters-list">
            {#each data.stagedChapters as staged (staged.id)}
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

        {#if data.queuedJobs.length > 0}
          <div class="queued-jobs-list">
            {#each data.queuedJobs as q (q.id)}
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

<style>
  .importer-dashboard {
    display: flex;
    flex-direction: column;
    gap: 26px;
    width: 100%;
    max-width: 1360px;
    margin: 0 auto;
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
</style>
