<script lang="ts">
  import {
    Activity,
    Database,
    Cpu,
    HardDrive,
    Smartphone,
    Globe,
    CheckCircle2,
    AlertTriangle,
    AlertOctagon,
    RefreshCw,
    ShieldCheck,
    Zap,
    History,
    TrendingUp,
    Layers,
    BookOpen,
    Mail,
    ChevronDown,
    ChevronUp,
    Info,
    Check
  } from '@lucide/svelte';
  import { invalidateAll } from '$app/navigation';

  let { data } = $props();
  let refreshing = $state(false);
  let openCards = $state<Record<string, boolean>>({});

  function toggleCard(id: string) {
    openCards[id] = !openCards[id];
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'OTIMO':
      case 'BOM':
        return '●';
      case 'ATENCAO':
        return '▲';
      case 'RUIM':
        return '■';
      case 'CRITICO':
        return '✕';
      default:
        return '○';
    }
  }

  function getStatusClass(status: string) {
    switch (status) {
      case 'OTIMO':
        return 'status-otimo';
      case 'BOM':
        return 'status-bom';
      case 'ATENCAO':
        return 'status-atencao';
      case 'RUIM':
        return 'status-ruim';
      case 'CRITICO':
        return 'status-critico';
      default:
        return 'status-sem-dados';
    }
  }

  async function handleRefresh() {
    refreshing = true;
    try {
      await invalidateAll();
    } finally {
      refreshing = false;
    }
  }
</script>

<svelte:head>
  <title>Sade do Sistema | Project Nox Admin</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="health-dashboard">
  <!-- Header with Global Status Banner -->
  <header class="health-header">
    <div class="header-main">
      <div class="header-icon-wrap">
        <Activity size={28} class="text-purple" />
      </div>
      <div>
        <div class="badge-row">
          <span class="status-pill {getStatusClass(data.overall.status)}">
            {#if data.overall.status === 'OTIMO' || data.overall.status === 'BOM'}
              <CheckCircle2 size={15} /> 🟢 SADE GERAL: {data.overall.statusLabel}
            {:else if data.overall.status === 'ATENCAO'}
              <AlertTriangle size={15} /> 🟡 SADE GERAL: {data.overall.statusLabel}
            {:else}
              <AlertOctagon size={15} /> 🔴 SADE GERAL: {data.overall.statusLabel}
            {/if}
          </span>
          <span class="trend-chip">24h: {data.overall.trend24h}</span>
          <span class="trend-chip">7d: {data.overall.trend7d}</span>
          <span class="timestamp-label">Atualizado: {new Date(data.fetchedAt).toLocaleTimeString()}</span>
        </div>
        <h1 class="health-title">Sade do Sistema</h1>
        <p class="health-subtitle">{(data.overall as any).message}</p>
      </div>
    </div>
    <div class="header-actions">
      <button class="btn-refresh" onclick={handleRefresh} disabled={refreshing}>
        <span class:spinning={refreshing}><RefreshCw size={16} /></span>
        <span>{refreshing ? 'Atualizando...' : 'Atualizar'}</span>
      </button>
    </div>
  </header>

  <!-- Attention / Alert Banner -->
  <div class="attention-box {data.overall.criticalIssues.length > 0 ? 'critical-box' : data.overall.attentionIssues.length > 0 ? 'warning-box' : 'healthy-box'}">
    {#if data.overall.criticalIssues.length > 0}
      <div class="attention-header">
        <AlertOctagon size={18} class="text-red" />
        <strong>Pontos Crticos Requerendo Ateno Imediata</strong>
      </div>
      <ul>
        {#each data.overall.criticalIssues as issue}
          <li>{issue}</li>
        {/each}
      </ul>
    {:else if data.overall.attentionIssues.length > 0}
      <div class="attention-header">
        <AlertTriangle size={18} class="text-yellow" />
        <strong>Pontos de Ateno Detectados</strong>
      </div>
      <ul>
        {#each data.overall.attentionIssues as issue}
          <li>{issue}</li>
        {/each}
      </ul>
    {:else}
      <div class="healthy-statement">
        <Check size={18} class="text-green" />
        <span>Nenhum ponto crtico ou gargalo detectado no momento. Todos os servios operando em condies nominais.</span>
      </div>
    {/if}
  </div>

  <!-- Subsystems Grid with Human Status First -->
  <div class="subsystems-grid">
    <!-- 1. PostgreSQL & Pool -->
    <div class="metric-card">
      <div class="card-header">
        <div class="icon-bubble"><Database size={18} /></div>
        <h3>{data.components.database.title}</h3>
      </div>
      <div class="human-headline">
        <span class="human-badge {getStatusClass(data.components.database.status)}">
          {getStatusIcon(data.components.database.status)} {data.components.database.statusLabel}
        </span>
      </div>
      <p class="human-summary">{data.components.database.summary}</p>
      <div class="trend-row">
        <span class="trend-text">ltimas 24h: {data.components.database.trend24h}</span>
      </div>
      <button class="btn-details-toggle" onclick={() => toggleCard('database')}>
        <span>{openCards['database'] ? 'Ocultar detalhes' : 'Ver detalhes'}</span>
        {#if openCards['database']}<ChevronUp size={15} />{:else}<ChevronDown size={15} />{/if}
      </button>
      {#if openCards['database']}
        <div class="card-details">
          <p class="derivation-hint"><Info size={13} class="inline-icon" /> {data.components.database.derivation}</p>
          {#each Object.entries(data.components.database.details) as [k, v]}
            <div class="detail-row">
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- 2. Web & Desktop -->
    <div class="metric-card">
      <div class="card-header">
        <div class="icon-bubble"><Globe size={18} /></div>
        <h3>{data.components.web.title}</h3>
      </div>
      <div class="human-headline">
        <span class="human-badge {getStatusClass(data.components.web.status)}">
          {getStatusIcon(data.components.web.status)} {data.components.web.statusLabel}
        </span>
      </div>
      <p class="human-summary">{data.components.web.summary}</p>
      <div class="trend-row">
        <span class="trend-text">ltimas 24h: {data.components.web.trend24h}</span>
      </div>
      <button class="btn-details-toggle" onclick={() => toggleCard('web')}>
        <span>{openCards['web'] ? 'Ocultar detalhes' : 'Ver detalhes'}</span>
        {#if openCards['web']}<ChevronUp size={15} />{:else}<ChevronDown size={15} />{/if}
      </button>
      {#if openCards['web']}
        <div class="card-details">
          <p class="derivation-hint"><Info size={13} class="inline-icon" /> {data.components.web.derivation}</p>
          {#each Object.entries(data.components.web.details) as [k, v]}
            <div class="detail-row">
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- 3. Experincia Mobile -->
    <div class="metric-card">
      <div class="card-header">
        <div class="icon-bubble"><Smartphone size={18} /></div>
        <h3>{data.components.mobile.title}</h3>
      </div>
      <div class="human-headline">
        <span class="human-badge {getStatusClass(data.components.mobile.status)}">
          {getStatusIcon(data.components.mobile.status)} {data.components.mobile.statusLabel}
        </span>
      </div>
      <p class="human-summary">{data.components.mobile.summary}</p>
      <div class="trend-row">
        <span class="trend-text">ltimas 24h: {data.components.mobile.trend24h}</span>
      </div>
      <button class="btn-details-toggle" onclick={() => toggleCard('mobile')}>
        <span>{openCards['mobile'] ? 'Ocultar detalhes' : 'Ver detalhes'}</span>
        {#if openCards['mobile']}<ChevronUp size={15} />{:else}<ChevronDown size={15} />{/if}
      </button>
      {#if openCards['mobile']}
        <div class="card-details">
          <p class="derivation-hint"><Info size={13} class="inline-icon" /> {data.components.mobile.derivation}</p>
          {#each Object.entries(data.components.mobile.details) as [k, v]}
            <div class="detail-row">
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- 4. Importer Engine -->
    <div class="metric-card">
      <div class="card-header">
        <div class="icon-bubble"><Cpu size={18} /></div>
        <h3>{data.components.importer.title}</h3>
      </div>
      <div class="human-headline">
        <span class="human-badge {getStatusClass(data.components.importer.status)}">
          {getStatusIcon(data.components.importer.status)} {data.components.importer.statusLabel}
        </span>
      </div>
      <p class="human-summary">{data.components.importer.summary}</p>
      <div class="trend-row">
        <span class="trend-text">ltimas 24h: {data.components.importer.trend24h}</span>
      </div>
      <button class="btn-details-toggle" onclick={() => toggleCard('importer')}>
        <span>{openCards['importer'] ? 'Ocultar detalhes' : 'Ver detalhes'}</span>
        {#if openCards['importer']}<ChevronUp size={15} />{:else}<ChevronDown size={15} />{/if}
      </button>
      {#if openCards['importer']}
        <div class="card-details">
          <p class="derivation-hint"><Info size={13} class="inline-icon" /> {data.components.importer.derivation}</p>
          {#each Object.entries(data.components.importer.details) as [k, v]}
            <div class="detail-row">
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- 5. Manga Storage -->
    <div class="metric-card">
      <div class="card-header">
        <div class="icon-bubble"><HardDrive size={18} /></div>
        <h3>{data.components.storage.title}</h3>
      </div>
      <div class="human-headline">
        <span class="human-badge {getStatusClass(data.components.storage.status)}">
          {getStatusIcon(data.components.storage.status)} {data.components.storage.statusLabel}
        </span>
      </div>
      <p class="human-summary">{data.components.storage.summary}</p>
      <div class="trend-row">
        <span class="trend-text">ltimas 24h: {data.components.storage.trend24h}</span>
      </div>
      <button class="btn-details-toggle" onclick={() => toggleCard('storage')}>
        <span>{openCards['storage'] ? 'Ocultar detalhes' : 'Ver detalhes'}</span>
        {#if openCards['storage']}<ChevronUp size={15} />{:else}<ChevronDown size={15} />{/if}
      </button>
      {#if openCards['storage']}
        <div class="card-details">
          <p class="derivation-hint"><Info size={13} class="inline-icon" /> {data.components.storage.derivation}</p>
          {#each Object.entries(data.components.storage.details) as [k, v]}
            <div class="detail-row">
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- 6. Fontes de Mdia (Sources) -->
    <div class="metric-card">
      <div class="card-header">
        <div class="icon-bubble"><Layers size={18} /></div>
        <h3>{data.components.sources.title}</h3>
      </div>
      <div class="human-headline">
        <span class="human-badge {getStatusClass(data.components.sources.status)}">
          {getStatusIcon(data.components.sources.status)} {data.components.sources.statusLabel}
        </span>
      </div>
      <p class="human-summary">{data.components.sources.summary}</p>
      <div class="trend-row">
        <span class="trend-text">ltimas 24h: {data.components.sources.trend24h}</span>
      </div>
      <button class="btn-details-toggle" onclick={() => toggleCard('sources')}>
        <span>{openCards['sources'] ? 'Ocultar detalhes' : 'Ver detalhes'}</span>
        {#if openCards['sources']}<ChevronUp size={15} />{:else}<ChevronDown size={15} />{/if}
      </button>
      {#if openCards['sources']}
        <div class="card-details">
          <p class="derivation-hint"><Info size={13} class="inline-icon" /> {data.components.sources.derivation}</p>
          {#each Object.entries(data.components.sources.details) as [k, v]}
            <div class="detail-row">
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- 7. Autenticao & Sesses -->
    <div class="metric-card">
      <div class="card-header">
        <div class="icon-bubble"><ShieldCheck size={18} /></div>
        <h3>{data.components.auth.title}</h3>
      </div>
      <div class="human-headline">
        <span class="human-badge {getStatusClass(data.components.auth.status)}">
          {getStatusIcon(data.components.auth.status)} {data.components.auth.statusLabel}
        </span>
      </div>
      <p class="human-summary">{data.components.auth.summary}</p>
      <div class="trend-row">
        <span class="trend-text">ltimas 24h: {data.components.auth.trend24h}</span>
      </div>
      <button class="btn-details-toggle" onclick={() => toggleCard('auth')}>
        <span>{openCards['auth'] ? 'Ocultar detalhes' : 'Ver detalhes'}</span>
        {#if openCards['auth']}<ChevronUp size={15} />{:else}<ChevronDown size={15} />{/if}
      </button>
      {#if openCards['auth']}
        <div class="card-details">
          <p class="derivation-hint"><Info size={13} class="inline-icon" /> {data.components.auth.derivation}</p>
          {#each Object.entries(data.components.auth.details) as [k, v]}
            <div class="detail-row">
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- 8. Leitor de Captulos -->
    <div class="metric-card">
      <div class="card-header">
        <div class="icon-bubble"><BookOpen size={18} /></div>
        <h3>{data.components.reader.title}</h3>
      </div>
      <div class="human-headline">
        <span class="human-badge {getStatusClass(data.components.reader.status)}">
          {getStatusIcon(data.components.reader.status)} {data.components.reader.statusLabel}
        </span>
      </div>
      <p class="human-summary">{data.components.reader.summary}</p>
      <div class="trend-row">
        <span class="trend-text">ltimas 24h: {data.components.reader.trend24h}</span>
      </div>
      <button class="btn-details-toggle" onclick={() => toggleCard('reader')}>
        <span>{openCards['reader'] ? 'Ocultar detalhes' : 'Ver detalhes'}</span>
        {#if openCards['reader']}<ChevronUp size={15} />{:else}<ChevronDown size={15} />{/if}
      </button>
      {#if openCards['reader']}
        <div class="card-details">
          <p class="derivation-hint"><Info size={13} class="inline-icon" /> {data.components.reader.derivation}</p>
          {#each Object.entries(data.components.reader.details) as [k, v]}
            <div class="detail-row">
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- 9. API / PostgREST -->
    <div class="metric-card">
      <div class="card-header">
        <div class="icon-bubble"><Zap size={18} /></div>
        <h3>{data.components.postgrest.title}</h3>
      </div>
      <div class="human-headline">
        <span class="human-badge {getStatusClass(data.components.postgrest.status)}">
          {getStatusIcon(data.components.postgrest.status)} {data.components.postgrest.statusLabel}
        </span>
      </div>
      <p class="human-summary">{data.components.postgrest.summary}</p>
      <div class="trend-row">
        <span class="trend-text">ltimas 24h: {data.components.postgrest.trend24h}</span>
      </div>
      <button class="btn-details-toggle" onclick={() => toggleCard('postgrest')}>
        <span>{openCards['postgrest'] ? 'Ocultar detalhes' : 'Ver detalhes'}</span>
        {#if openCards['postgrest']}<ChevronUp size={15} />{:else}<ChevronDown size={15} />{/if}
      </button>
      {#if openCards['postgrest']}
        <div class="card-details">
          <p class="derivation-hint"><Info size={13} class="inline-icon" /> {data.components.postgrest.derivation}</p>
          {#each Object.entries(data.components.postgrest.details) as [k, v]}
            <div class="detail-row">
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- 10. Servio de Emails -->
    <div class="metric-card">
      <div class="card-header">
        <div class="icon-bubble"><Mail size={18} /></div>
        <h3>{data.components.emails.title}</h3>
      </div>
      <div class="human-headline">
        <span class="human-badge {getStatusClass(data.components.emails.status)}">
          {getStatusIcon(data.components.emails.status)} {data.components.emails.statusLabel}
        </span>
      </div>
      <p class="human-summary">{data.components.emails.summary}</p>
      <div class="trend-row">
        <span class="trend-text">ltimas 24h: {data.components.emails.trend24h}</span>
      </div>
      <button class="btn-details-toggle" onclick={() => toggleCard('emails')}>
        <span>{openCards['emails'] ? 'Ocultar detalhes' : 'Ver detalhes'}</span>
        {#if openCards['emails']}<ChevronUp size={15} />{:else}<ChevronDown size={15} />{/if}
      </button>
      {#if openCards['emails']}
        <div class="card-details">
          <p class="derivation-hint"><Info size={13} class="inline-icon" /> {data.components.emails.derivation}</p>
          {#each Object.entries(data.components.emails.details) as [k, v]}
            <div class="detail-row">
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- 11. Capacidade & Expanso de Fontes -->
    <div class="metric-card">
      <div class="card-header">
        <div class="icon-bubble"><TrendingUp size={18} /></div>
        <h3>{data.components.readiness.title}</h3>
      </div>
      <div class="human-headline">
        <span class="human-badge {getStatusClass(data.components.readiness.status)}">
          {getStatusIcon(data.components.readiness.status)} {data.components.readiness.statusLabel}
        </span>
      </div>
      <p class="human-summary">{data.components.readiness.summary}</p>
      <div class="trend-row">
        <span class="trend-text">ltimas 24h: {data.components.readiness.trend24h}</span>
      </div>
      <button class="btn-details-toggle" onclick={() => toggleCard('readiness')}>
        <span>{openCards['readiness'] ? 'Ocultar detalhes' : 'Ver detalhes'}</span>
        {#if openCards['readiness']}<ChevronUp size={15} />{:else}<ChevronDown size={15} />{/if}
      </button>
      {#if openCards['readiness']}
        <div class="card-details">
          <p class="derivation-hint"><Info size={13} class="inline-icon" /> {data.components.readiness.derivation}</p>
          {#each Object.entries(data.components.readiness.details) as [k, v]}
            <div class="detail-row">
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Technical Telemetry Section: Top Slow Queries -->
  <section class="health-section">
    <div class="section-title-row">
      <h2><Zap size={20} class="text-purple" /> Detalhes Tcnicos: Top Queries (pg_stat_statements)</h2>
      <span class="section-badge">Telemetria Real</span>
    </div>
    <div class="table-container">
      <table class="health-table">
        <thead>
          <tr>
            <th>Query (Sanitizada)</th>
            <th class="text-right">Chamadas</th>
            <th class="text-right">Tempo Mdio</th>
            <th class="text-right">Tempo Mximo</th>
          </tr>
        </thead>
        <tbody>
          {#each data.slowQueries as q}
            <tr>
              <td class="query-cell"><code>{q.query}</code></td>
              <td class="text-right font-mono">{q.calls.toLocaleString()}</td>
              <td class="text-right font-mono">{q.mean_ms} ms</td>
              <td class="text-right font-mono">{q.max_ms} ms</td>
            </tr>
          {:else}
            <tr>
              <td colspan="4" class="text-center empty-cell">Nenhuma query lenta registrada.</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <!-- Incident History Section -->
  <section class="health-section">
    <div class="section-title-row">
      <h2><History size={20} class="text-purple" /> Histrico de Incidentes e Resolues</h2>
    </div>
    <div class="incident-list">
      {#each data.incidents as inc}
        <div class="incident-card">
          <div class="incident-badge-col">
            <span class="incident-status resolved">{inc.status}</span>
            <span class="incident-time">{inc.timestamp}</span>
          </div>
          <div class="incident-content">
            <h4>{inc.title}</h4>
            <p><strong>Causa Raiz:</strong> {inc.rootCause}</p>
            <p><strong>Resoluo:</strong> {inc.resolution}</p>
          </div>
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  .health-dashboard {
    max-width: 1300px;
    margin: 0 auto;
    padding: 24px;
    color: #e2e8f0;
  }

  .health-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    background: rgba(14, 18, 30, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 20px;
    backdrop-filter: blur(12px);
  }

  .header-main {
    display: flex;
    gap: 18px;
    align-items: center;
  }

  .header-icon-wrap {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: rgba(181, 154, 245, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .badge-row {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 6px;
    flex-wrap: wrap;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .trend-chip {
    font-size: 0.75rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    padding: 2px 8px;
    border-radius: 6px;
  }

  .timestamp-label {
    font-size: 0.78rem;
    color: #64748b;
  }

  .health-title {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 700;
    color: #ffffff;
  }

  .health-subtitle {
    margin: 4px 0 0 0;
    font-size: 0.88rem;
    color: #94a3b8;
  }

  .btn-refresh {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #ffffff;
    padding: 9px 16px;
    border-radius: 10px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-refresh:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Attention Banner */
  .attention-box {
    border-radius: 12px;
    padding: 14px 18px;
    margin-bottom: 24px;
    font-size: 0.88rem;
  }

  .healthy-box {
    background: rgba(34, 197, 94, 0.08);
    border: 1px solid rgba(34, 197, 94, 0.2);
    color: #86efac;
  }

  .healthy-statement {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .warning-box {
    background: rgba(234, 179, 8, 0.1);
    border: 1px solid rgba(234, 179, 8, 0.25);
    color: #fde047;
  }

  .critical-box {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .attention-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  /* Subsystems Grid */
  .subsystems-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 18px;
    margin-bottom: 28px;
  }

  .metric-card {
    background: rgba(13, 16, 26, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 18px;
    backdrop-filter: blur(8px);
    display: flex;
    flex-direction: column;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .icon-bubble {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #b59af5;
  }

  .card-header h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: #e2e8f0;
    flex: 1;
  }

  .human-headline {
    margin-bottom: 8px;
  }

  .human-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 0.92rem;
    font-weight: 700;
  }

  /* Human status standard palette */
  .status-otimo {
    background: rgba(34, 197, 94, 0.16);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.35);
  }

  .status-bom {
    background: rgba(16, 185, 129, 0.14);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .status-atencao {
    background: rgba(234, 179, 8, 0.16);
    color: #facc15;
    border: 1px solid rgba(234, 179, 8, 0.35);
  }

  .status-ruim {
    background: rgba(249, 115, 22, 0.16);
    color: #fb923c;
    border: 1px solid rgba(249, 115, 22, 0.35);
  }

  .status-critico {
    background: rgba(239, 68, 68, 0.18);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.4);
  }

  .status-sem-dados {
    background: rgba(148, 163, 184, 0.12);
    color: #94a3b8;
    border: 1px solid rgba(148, 163, 184, 0.25);
  }

  .human-summary {
    margin: 0 0 10px 0;
    font-size: 0.85rem;
    color: #94a3b8;
    line-height: 1.4;
    min-height: 2.8em;
  }

  .trend-row {
    margin-bottom: 12px;
  }

  .trend-text {
    font-size: 0.75rem;
    color: #64748b;
  }

  .btn-details-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
    padding: 7px 12px;
    border-radius: 8px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-top: auto;
  }

  .btn-details-toggle:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .card-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    padding-top: 12px;
    margin-top: 12px;
    font-size: 0.82rem;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .derivation-hint {
    margin: 0 0 6px 0;
    font-size: 0.74rem;
    color: #64748b;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .detail-row span {
    color: #94a3b8;
  }

  .detail-row strong {
    color: #f1f5f9;
    font-family: monospace;
    font-size: 0.82rem;
  }

  /* Technical Details & Table */
  .health-section {
    background: rgba(13, 16, 26, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 20px;
    margin-bottom: 24px;
  }

  .section-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
  }

  .section-title-row h2 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section-badge {
    font-size: 0.75rem;
    background: rgba(255, 255, 255, 0.06);
    padding: 3px 8px;
    border-radius: 6px;
    color: #94a3b8;
  }

  .table-container {
    overflow-x: auto;
  }

  .health-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }

  .health-table th {
    text-align: left;
    padding: 8px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    font-weight: 600;
  }

  .health-table td {
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .query-cell code {
    font-family: monospace;
    font-size: 0.78rem;
    color: #cbd5e1;
    background: rgba(0, 0, 0, 0.25);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .text-right { text-align: right; }
  .font-mono { font-family: monospace; }
  .text-green { color: #4ade80; }
  .text-yellow { color: #facc15; }
  .text-red { color: #f87171; }
  .text-purple { color: #b59af5; }
  .inline-icon { vertical-align: middle; }

  .incident-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .incident-card {
    display: flex;
    gap: 16px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    padding: 14px;
  }

  .incident-badge-col {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 110px;
  }

  .incident-status.resolved {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.72rem;
    font-weight: 700;
    text-align: center;
  }

  .incident-time {
    font-size: 0.72rem;
    color: #64748b;
  }

  .incident-content h4 {
    margin: 0 0 4px 0;
    font-size: 0.92rem;
    color: #f8fafc;
  }

  .incident-content p {
    margin: 3px 0;
    font-size: 0.8rem;
    color: #94a3b8;
  }

  @media (max-width: 768px) {
    .health-header {
      flex-direction: column;
      gap: 16px;
    }
    .subsystems-grid {
      grid-template-columns: 1fr;
    }
    .incident-card {
      flex-direction: column;
    }
    .metric-card {
      backdrop-filter: none !important;
      background: rgba(14, 17, 28, 0.95) !important;
    }
  }
</style>
