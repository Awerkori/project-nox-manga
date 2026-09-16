<script lang="ts">
  import {
    BarChart3,
    Eye,
    BookOpen,
    FileText,
    Users,
    TrendingUp,
    Sparkles,
    Calendar
  } from '@lucide/svelte';

  let {
    works = [],
    chapters = [],
    team = [],
    totalViews = 0,
    currentScan
  } = $props();

  let activeWorks = $derived(works.filter((w: any) => w.project_status === 'ACTIVE'));
  let sortedByViews = $derived([...works].sort((a: any, b: any) => (b.viewsTotal || 0) - (a.viewsTotal || 0)));

  // Calculate views for last 30 days vs earlier (simple heuristic based on chapter published dates)
  let now = new Date();
  let thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let recentChapters = $derived(
    chapters.filter((c: any) => c.publishedAt && new Date(c.publishedAt) >= thirtyDaysAgo)
  );
</script>

<div class="analytics-tab">
  <div class="tab-header">
    <div>
      <h2 class="title">Métricas & Desempenho da Scan</h2>
      <p class="subtitle">Estatísticas exclusivas de alcance, produtividade e leitura da equipe {currentScan?.name}.</p>
    </div>
  </div>

  <!-- KPI Grid -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-icon-wrap blue">
        <Eye size={22} />
      </div>
      <div class="kpi-info">
        <span class="kpi-label">Visualizações Totais</span>
        <span class="kpi-val">{totalViews.toLocaleString('pt-BR')}</span>
        <span class="kpi-sub">Acumulado em todas as obras</span>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrap purple">
        <FileText size={22} />
      </div>
      <div class="kpi-info">
        <span class="kpi-label">Capítulos Publicados</span>
        <span class="kpi-val">{chapters.length}</span>
        <span class="kpi-sub">+{recentChapters.length} nos últimos 30 dias</span>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrap green">
        <BookOpen size={22} />
      </div>
      <div class="kpi-info">
        <span class="kpi-label">Obras Ativas</span>
        <span class="kpi-val">{activeWorks.length} / {works.length}</span>
        <span class="kpi-sub">Em tradução contínua</span>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrap orange">
        <Users size={22} />
      </div>
      <div class="kpi-info">
        <span class="kpi-label">Membros na Staff</span>
        <span class="kpi-val">{team.length}</span>
        <span class="kpi-sub">Tradutores, revisores & editores</span>
      </div>
    </div>
  </div>

  <!-- Ranking of Works by Views -->
  <div class="analytics-section">
    <div class="section-title-row">
      <TrendingUp size={20} class="section-icon indigo" />
      <div>
        <h3>Obras Mais Populares da Scan</h3>
        <p>Ranking de engajamento do público com os projetos da sua equipe.</p>
      </div>
    </div>

    {#if sortedByViews.length === 0}
      <div class="empty-state">
        <p>Nenhuma obra vinculada ainda.</p>
      </div>
    {:else}
      <div class="works-ranking-list">
        {#each sortedByViews as work, i}
          {@const pct = totalViews > 0 ? Math.round(((work.viewsTotal || 0) / totalViews) * 100) : 0}
          <div class="ranking-row">
            <div class="rank-num">#{i + 1}</div>
            <div class="work-info">
              <span class="work-title">{work.title}</span>
              <span class="work-status {work.project_status.toLowerCase()}">{work.project_status}</span>
            </div>
            <div class="progress-col">
              <div class="progress-bar">
                <div class="progress-fill" style="width: {pct}%"></div>
              </div>
              <span class="pct-text">{pct}% do total</span>
            </div>
            <div class="views-col">
              <Eye size={14} class="eye-icon" />
              <span>{(work.viewsTotal || 0).toLocaleString('pt-BR')}</span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Team Activity Overview -->
  <div class="analytics-section">
    <div class="section-title-row">
      <Users size={20} class="section-icon pink" />
      <div>
        <h3>Distribuição da Equipe por Função</h3>
        <p>Visão geral de disponibilidade e papéis na scan.</p>
      </div>
    </div>

    <div class="team-dist-grid">
      <div class="dist-card">
        <span class="dist-label">Liderança & Coordenação</span>
        <span class="dist-val">{team.filter((m: any) => ['OWNER', 'ADMIN'].includes(m.role)).length}</span>
        <span class="dist-sub">Donos e Administradores</span>
      </div>
      <div class="dist-card">
        <span class="dist-label">Uploaders Autorizados</span>
        <span class="dist-val">{team.filter((m: any) => m.role === 'UPLOADER').length}</span>
        <span class="dist-sub">Envio direto de capítulos</span>
      </div>
      <div class="dist-card">
        <span class="dist-label">Membros Staff</span>
        <span class="dist-val">{team.filter((m: any) => m.role === 'MEMBER').length}</span>
        <span class="dist-sub">Tradutores, revisores e editores</span>
      </div>
      <div class="dist-card">
        <span class="dist-label">Disponibilidade Ativa</span>
        <span class="dist-val">{team.filter((m: any) => m.availabilityStatus === 'ACTIVE' || !m.availabilityStatus).length}</span>
        <span class="dist-sub">Prontos para assumir capítulos</span>
      </div>
    </div>
  </div>
</div>

<style>
  .analytics-tab {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .tab-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  .title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .subtitle {
    font-size: 0.875rem;
    color: #94a3b8;
    margin: 0.25rem 0 0;
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
  }

  .kpi-card {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1rem;
    padding: 1.25rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .kpi-icon-wrap {
    width: 48px;
    height: 48px;
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .kpi-icon-wrap.blue { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
  .kpi-icon-wrap.purple { background: rgba(168, 85, 247, 0.15); color: #c084fc; }
  .kpi-icon-wrap.green { background: rgba(16, 185, 129, 0.15); color: #34d399; }
  .kpi-icon-wrap.orange { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }

  .kpi-info {
    display: flex;
    flex-direction: column;
  }

  .kpi-label {
    font-size: 0.75rem;
    color: #94a3b8;
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .kpi-val {
    font-size: 1.5rem;
    font-weight: 800;
    color: #f8fafc;
    line-height: 1.2;
    margin: 0.2rem 0;
  }

  .kpi-sub {
    font-size: 0.75rem;
    color: #64748b;
  }

  .analytics-section {
    background: rgba(15, 23, 42, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1rem;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .section-title-row {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  :global(.section-icon) {
    flex-shrink: 0;
    margin-top: 0.2rem;
  }

  :global(.section-icon.indigo) { color: #818cf8; }
  :global(.section-icon.pink) { color: #f472b6; }

  .section-title-row h3 {
    font-size: 1.05rem;
    font-weight: 600;
    color: #f1f5f9;
    margin: 0;
  }

  .section-title-row p {
    font-size: 0.8125rem;
    color: #94a3b8;
    margin: 0.2rem 0 0;
  }

  .works-ranking-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .ranking-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.05);
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
  }

  .rank-num {
    font-size: 1.1rem;
    font-weight: 800;
    color: #6366f1;
    width: 32px;
  }

  .work-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    flex: 1.5;
    min-width: 140px;
  }

  .work-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #f1f5f9;
  }

  .work-status {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .work-status.active { color: #10b981; }
  .work-status.dropped { color: #ef4444; }
  .work-status.hiatus { color: #f59e0b; }

  .progress-col {
    flex: 2;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .progress-bar {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 9999px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #a855f7);
    border-radius: 9999px;
  }

  .pct-text {
    font-size: 0.75rem;
    color: #64748b;
  }

  .views-col {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #38bdf8;
    min-width: 80px;
    justify-content: flex-end;
  }

  :global(.eye-icon) {
    color: #64748b;
  }

  .team-dist-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .dist-card {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 0.75rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
  }

  .dist-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #cbd5e1;
  }

  .dist-val {
    font-size: 1.5rem;
    font-weight: 800;
    color: #f8fafc;
    margin: 0.35rem 0;
  }

  .dist-sub {
    font-size: 0.75rem;
    color: #64748b;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: #64748b;
    font-size: 0.875rem;
  }
</style>
