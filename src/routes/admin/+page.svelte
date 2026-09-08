<script lang="ts">
  import {
    BookOpen,
    Sparkles,
    FileEdit,
    Tags,
    ArrowRight,
    ArrowUpRight,
    Plus,
    Clock,
    CheckCircle2,
    Users,
    Layers
  } from '@lucide/svelte';
  import { relativeTime, kindLabels } from '$lib/types';

  let { data } = $props();

  let operatorName = $derived(
    data.profile?.display_name || (data.role === 'ADMIN' ? 'Administrador' : 'Editor Nox')
  );
  let firstName = $derived(operatorName.split(' ')[0]);

  const todayStr = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date());
  const capitalizedToday = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);
</script>

<svelte:head>
  <title>Visão Geral — Painel Editorial Project Nox</title>
</svelte:head>

<div class="dashboard-shell">
  <!-- Dashboard Welcome Header -->
  <header class="dash-header">
    <div class="header-intro">
      <div class="eyebrow-row">
        <span class="eyebrow">CENTRAL EDITORIAL NOX</span>
        <span class="header-date">· {capitalizedToday}</span>
      </div>
      <h1 class="dash-title">Olá, {firstName}</h1>
      <p class="dash-subtitle">
        Acompanhe a mesa de edição, publique novos capítulos e gerencie o catálogo da Project Nox.
      </p>
    </div>

    <div class="header-actions">
      <a href="/admin/obras/nova" class="btn-primary-admin">
        <Plus size={16} />
        <span>Cadastrar Nova Obra</span>
      </a>
    </div>
  </header>

  <!-- 1. Real Metrics Stat Cards (4 Columns) -->
  <section class="stat-grid" aria-label="Métricas do catálogo">
    <!-- Stat 1: Obras -->
    <a href="/admin/obras" class="stat-card">
      <div class="stat-icon-box icon-gold">
        <BookOpen size={20} />
      </div>
      <div class="stat-meta">
        <span class="stat-label">Obras Cadastradas</span>
        <strong class="stat-value">{data.works}</strong>
        <span class="stat-hint">No catálogo público</span>
      </div>
      <ArrowRight size={14} class="stat-corner-arrow" />
    </a>

    <!-- Stat 2: Capítulos Publicados -->
    <div class="stat-card stat-card-static">
      <div class="stat-icon-box icon-purple">
        <Sparkles size={20} />
      </div>
      <div class="stat-meta">
        <span class="stat-label">Capítulos Publicados</span>
        <strong class="stat-value">{data.chapters}</strong>
        <span class="stat-hint">Disponíveis para leitura</span>
      </div>
    </div>

    <!-- Stat 3: Mesa de Edição / Rascunhos -->
    <a href="#mesa-de-edicao" class="stat-card" class:stat-alert={data.draftsCount > 0}>
      <div class="stat-icon-box icon-amber">
        <FileEdit size={20} />
      </div>
      <div class="stat-meta">
        <span class="stat-label">Mesa de Edição</span>
        <div class="stat-value-row">
          <strong class="stat-value">{data.draftsCount}</strong>
          {#if data.draftsCount > 0}
            <span class="stat-badge-pulse">Pendente</span>
          {/if}
        </div>
        <span class="stat-hint">{data.draftsCount === 1 ? '1 rascunho em preparo' : `${data.draftsCount} rascunhos em preparo`}</span>
      </div>
      <ArrowRight size={14} class="stat-corner-arrow" />
    </a>

    <!-- Stat 4: Gêneros e Tags -->
    <a href="/admin/tags" class="stat-card">
      <div class="stat-icon-box icon-blue">
        <Tags size={20} />
      </div>
      <div class="stat-meta">
        <span class="stat-label">Gêneros e Tags</span>
        <strong class="stat-value">{data.tagsCount}</strong>
        <span class="stat-hint">Taxonomia ativa</span>
      </div>
      <ArrowRight size={14} class="stat-corner-arrow" />
    </a>
  </section>

  <!-- 2. Hub de Ações Rápidas (Tactile Action Pills) -->
  <section class="quick-actions-bar" aria-label="Ações Rápidas">
    <span class="section-label">AÇÕES RÁPIDAS</span>
    <div class="actions-grid">
      <a href="/admin/obras/nova" class="action-btn">
        <div class="action-btn-icon icon-add">
          <Plus size={16} />
        </div>
        <div class="action-btn-text">
          <strong>Adicionar Obra</strong>
          <span>Nova série</span>
        </div>
      </a>

      <a href="/admin/obras" class="action-btn">
        <div class="action-btn-icon icon-works">
          <Layers size={16} />
        </div>
        <div class="action-btn-text">
          <strong>Gerenciar Obras</strong>
          <span>Ver catálogo completo</span>
        </div>
      </a>

      <a href="/admin/tags" class="action-btn">
        <div class="action-btn-icon icon-tags">
          <Tags size={16} />
        </div>
        <div class="action-btn-text">
          <strong>Gêneros & Tags</strong>
          <span>Organizar categorias</span>
        </div>
      </a>

      {#if data.role === 'ADMIN'}
        <a href="/admin/gestao" class="action-btn">
          <div class="action-btn-icon icon-users">
            <Users size={16} />
          </div>
          <div class="action-btn-text">
            <strong>Membros & Cargos</strong>
            <span>Equipe e permissões</span>
          </div>
        </a>
      {/if}

      <a href="/" target="_blank" rel="noopener noreferrer" class="action-btn action-btn-ext">
        <div class="action-btn-icon icon-site">
          <ArrowUpRight size={16} />
        </div>
        <div class="action-btn-text">
          <strong>Site Público</strong>
          <span>Visão dos leitores</span>
        </div>
      </a>
    </div>
  </section>

  <!-- 3. Split Main Workspace (Mesa de Edição + Atividade Recente) -->
  <div class="workspace-grid">
    <!-- Left Column: Na Mesa de Edição (Rascunhos em Preparo) -->
    <section id="mesa-de-edicao" class="panel-section drafts-panel">
      <div class="panel-header">
        <div class="panel-title-cluster">
          <div class="panel-title-row">
            <h2 class="panel-title">Na Mesa de Edição</h2>
            {#if data.draftsCount > 0}
              <span class="count-pill amber-pill">{data.draftsCount}</span>
            {/if}
          </div>
          <span class="panel-subtitle">Capítulos em preparação aguardando revisão e publicação final</span>
        </div>

        <a href="/admin/obras" class="panel-link">
          <span>Todas as obras</span>
          <ArrowRight size={13} />
        </a>
      </div>

      {#if data.drafts.length > 0}
        <div class="drafts-stack">
          {#each data.drafts as draft (draft.id)}
            <div class="draft-row-card">
              <!-- Mini cover or fallback -->
              <a
                href="/admin/obras/{draft.works?.id}/capitulos/{draft.id}"
                class="draft-thumb-link"
                tabindex="-1"
              >
                {#if draft.works?.cover_id}
                  <img
                    src="/media/{draft.works.cover_id}"
                    alt=""
                    width="44"
                    height="62"
                    class="draft-thumb-img"
                  />
                {:else}
                  <div class="draft-thumb-placeholder">NOX</div>
                {/if}
              </a>

              <!-- Chapter Info -->
              <div class="draft-info">
                <div class="draft-top">
                  <a href="/admin/obras/{draft.works?.id}" class="draft-work-title">
                    {draft.works?.title || 'Obra'}
                  </a>
                  <span class="status-chip draft-chip">Rascunho</span>
                </div>
                <div class="draft-detail">
                  <span class="draft-ch-number">Capítulo {draft.number}</span>
                  {#if draft.title}
                    <span class="draft-ch-title">— {draft.title}</span>
                  {/if}
                </div>
                {#if draft.created_at}
                  <div class="draft-time">
                    <Clock size={11} />
                    <span>Iniciado {relativeTime(draft.created_at)}</span>
                  </div>
                {/if}
              </div>

              <!-- Action Link -->
              <a
                href="/admin/obras/{draft.works?.id}/capitulos/{draft.id}"
                class="btn-edit-draft"
              >
                <span>Editar</span>
                <ArrowRight size={13} />
              </a>
            </div>
          {/each}
        </div>
      {:else}
        <!-- Elegant, Instructive Empty State -->
        <div class="editorial-empty-state">
          <div class="empty-icon-box">
            <CheckCircle2 size={32} />
          </div>
          <h3 class="empty-title">Mesa de edição em dia</h3>
          <p class="empty-desc">
            Nenhum capítulo pendente em rascunho. Todas as páginas cadastradas já foram publicadas ou não há novos uploads em andamento.
          </p>
          <div class="empty-actions">
            <a href="/admin/obras" class="btn-empty-primary">
              <BookOpen size={14} />
              <span>Ver Obras para Novo Capítulo</span>
            </a>
          </div>
        </div>
      {/if}
    </section>

    <!-- Right Column: Últimos Capítulos Publicados & Obras Recentes -->
    <div class="sidebar-activity-col">
      <!-- Recent Published Chapters -->
      <section class="panel-section published-panel">
        <div class="panel-header">
          <div class="panel-title-cluster">
            <h2 class="panel-title">Últimas Publicações</h2>
            <span class="panel-subtitle">Capítulos recém-disponibilizados no ar</span>
          </div>
        </div>

        {#if data.recentPublished.length > 0}
          <div class="published-list">
            {#each data.recentPublished as pub (pub.id)}
              <div class="published-item">
                <div class="pub-info">
                  <div class="pub-line-1">
                    <strong class="pub-work-title">{pub.works?.title}</strong>
                    <span class="pub-ch-num">Cap. {pub.number}</span>
                  </div>
                  {#if pub.published_at}
                    <div class="pub-time">
                      <Clock size={11} />
                      <span>{relativeTime(pub.published_at)}</span>
                    </div>
                  {/if}
                </div>

                <a
                  href="/admin/obras/{pub.works?.id}/capitulos/{pub.id}"
                  class="pub-action-btn"
                  title="Revisar capítulo"
                >
                  <span>Revisar</span>
                </a>
              </div>
            {/each}
          </div>
        {:else}
          <p class="empty-simple-text">Nenhum capítulo publicado recentemente.</p>
        {/if}
      </section>

      <!-- Recent Updated Works -->
      <section class="panel-section works-recent-panel">
        <div class="panel-header">
          <div class="panel-title-cluster">
            <h2 class="panel-title">Obras no Radar</h2>
            <span class="panel-subtitle">Títulos com atividade recente</span>
          </div>
          <a href="/admin/obras" class="panel-link">
            <span>Ver todas</span>
            <ArrowRight size={13} />
          </a>
        </div>

        {#if data.recentWorks.length > 0}
          <div class="mini-works-list">
            {#each data.recentWorks as work (work.id)}
              <a href="/admin/obras/{work.id}" class="mini-work-card">
                <div class="mini-work-thumb">
                  {#if work.cover_id}
                    <img src="/media/{work.cover_id}" alt="" width="36" height="50" class="mini-work-img" />
                  {:else}
                    <div class="mini-work-placeholder">NOX</div>
                  {/if}
                </div>
                <div class="mini-work-meta">
                  <strong class="mini-title">{work.title}</strong>
                  <div class="mini-badges">
                    <span class="mini-kind-tag">{kindLabels[work.kind] || work.kind}</span>
                    <span class="mini-status-tag" class:published={work.published}>
                      {work.published ? 'No ar' : 'Rascunho'}
                    </span>
                  </div>
                </div>
                <ArrowRight size={13} class="mini-work-arrow" />
              </a>
            {/each}
          </div>
        {/if}
      </section>
    </div>
  </div>
</div>

<style>
  .dashboard-shell {
    display: flex;
    flex-direction: column;
    gap: 28px;
    width: 100%;
    max-width: 1280px;
  }

  /* Header Section */
  .dash-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
    padding-bottom: 22px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .header-intro {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .eyebrow-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .eyebrow {
    font-size: 11px;
    font-weight: 750;
    color: #dfc28d;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .header-date {
    font-size: 11px;
    color: #7b8396;
    font-weight: 500;
  }

  .dash-title {
    margin: 0;
    font-family: var(--font-heading, 'Manrope', sans-serif);
    font-size: clamp(1.8rem, 3.2vw, 2.3rem);
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.02em;
    line-height: 1.15;
  }

  .dash-subtitle {
    margin: 0;
    color: #8c93a8;
    font-size: 0.92rem;
    max-width: 600px;
  }

  .btn-primary-admin {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 9px;
    background: linear-gradient(135deg, #dfc28d 0%, #c49c5e 100%);
    color: #0d0c14;
    font-size: 13px;
    font-weight: 750;
    text-decoration: none;
    box-shadow: 0 4px 18px rgba(223, 194, 141, 0.35);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    white-space: nowrap;
  }

  .btn-primary-admin:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(223, 194, 141, 0.5);
  }

  /* Metric Stat Grid */
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px;
    border-radius: 12px;
    background: rgba(13, 16, 26, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.07);
    text-decoration: none;
    position: relative;
    backdrop-filter: blur(12px);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .stat-card:hover {
    background: rgba(20, 24, 38, 0.85);
    border-color: rgba(223, 194, 141, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6);
  }

  .stat-card-static {
    cursor: default;
  }

  .stat-card-static:hover {
    border-color: rgba(255, 255, 255, 0.07);
    transform: none;
    box-shadow: none;
  }

  .stat-card.stat-alert {
    border-color: rgba(245, 158, 11, 0.35);
    background: rgba(26, 20, 14, 0.7);
  }

  .stat-icon-box {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .icon-gold {
    background: rgba(223, 194, 141, 0.12);
    color: #dfc28d;
    border: 1px solid rgba(223, 194, 141, 0.25);
  }

  .icon-purple {
    background: rgba(181, 154, 245, 0.12);
    color: #b59af5;
    border: 1px solid rgba(181, 154, 245, 0.25);
  }

  .icon-amber {
    background: rgba(245, 158, 11, 0.12);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.25);
  }

  .icon-blue {
    background: rgba(56, 189, 248, 0.12);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.25);
  }

  .stat-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .stat-label {
    font-size: 11px;
    font-weight: 600;
    color: #7b8396;
    letter-spacing: 0.02em;
  }

  .stat-value-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .stat-value {
    font-family: var(--font-heading, 'Manrope', sans-serif);
    font-size: 24px;
    font-weight: 800;
    color: #ffffff;
    line-height: 1.1;
  }

  .stat-badge-pulse {
    font-size: 9px;
    font-weight: 750;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .stat-hint {
    font-size: 10.5px;
    color: #555c6e;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(.stat-corner-arrow) {
    position: absolute;
    top: 14px;
    right: 14px;
    color: #4b5263;
    transition: all 0.2s ease;
  }

  .stat-card:hover :global(.stat-corner-arrow) {
    color: #dfc28d;
    transform: translateX(2px);
  }

  /* Quick Actions Bar */
  .quick-actions-bar {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-label {
    font-size: 10.5px;
    font-weight: 750;
    color: #646b80;
    letter-spacing: 0.08em;
  }

  .actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(14, 18, 28, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.06);
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    background: rgba(22, 28, 44, 0.8);
    border-color: rgba(223, 194, 141, 0.25);
    transform: translateY(-1px);
  }

  .action-btn-ext {
    border-style: dashed;
  }

  .action-btn-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .icon-add {
    background: rgba(223, 194, 141, 0.15);
    color: #dfc28d;
  }

  .icon-works {
    background: rgba(181, 154, 245, 0.15);
    color: #b59af5;
  }

  .icon-tags {
    background: rgba(56, 189, 248, 0.15);
    color: #38bdf8;
  }

  .icon-users {
    background: rgba(168, 85, 247, 0.15);
    color: #c084fc;
  }

  .icon-site {
    background: rgba(255, 255, 255, 0.06);
    color: #9ba3b8;
  }

  .action-btn-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .action-btn-text strong {
    font-size: 12px;
    color: #ffffff;
    font-weight: 700;
  }

  .action-btn-text span {
    font-size: 10px;
    color: #7b8396;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Main Workspace Split (2 Columns) */
  .workspace-grid {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 24px;
    align-items: flex-start;
  }

  .panel-section {
    background: rgba(13, 16, 26, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 22px;
    backdrop-filter: blur(14px);
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .panel-title-cluster {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .panel-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .panel-title {
    margin: 0;
    font-family: var(--font-heading, 'Manrope', sans-serif);
    font-size: 16.5px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.01em;
  }

  .panel-subtitle {
    font-size: 11.5px;
    color: #7b8396;
    font-weight: 500;
  }

  .count-pill {
    font-size: 11px;
    font-weight: 750;
    padding: 2px 7px;
    border-radius: 999px;
  }

  .count-pill.amber-pill {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.35);
  }

  .panel-link {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    font-weight: 600;
    color: #8c93a8;
    text-decoration: none;
    white-space: nowrap;
    transition: color 0.2s ease;
  }

  .panel-link:hover {
    color: #dfc28d;
  }

  /* Drafts Stack */
  .drafts-stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .draft-row-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 14px;
    border-radius: 10px;
    background: rgba(18, 22, 34, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.2s ease;
  }

  .draft-row-card:hover {
    background: rgba(24, 30, 48, 0.8);
    border-color: rgba(245, 158, 11, 0.3);
  }

  .draft-thumb-link {
    flex-shrink: 0;
    text-decoration: none;
  }

  .draft-thumb-img {
    width: 44px;
    height: 62px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .draft-thumb-placeholder {
    width: 44px;
    height: 62px;
    border-radius: 6px;
    background: #171926;
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 800;
    color: #dfc28d;
  }

  .draft-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
  }

  .draft-top {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .draft-work-title {
    font-size: 13px;
    font-weight: 750;
    color: #ffffff;
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .draft-work-title:hover {
    color: #dfc28d;
  }

  .status-chip {
    font-size: 9.5px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .status-chip.draft-chip {
    background: rgba(245, 158, 11, 0.12);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .draft-detail {
    font-size: 12px;
    color: #c5cbd8;
    font-weight: 600;
  }

  .draft-ch-number {
    color: #dfc28d;
  }

  .draft-ch-title {
    color: #8c93a8;
    font-weight: 400;
  }

  .draft-time {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10.5px;
    color: #646b80;
  }

  .btn-edit-draft {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 7px 12px;
    border-radius: 7px;
    background: rgba(223, 194, 141, 0.1);
    border: 1px solid rgba(223, 194, 141, 0.28);
    color: #dfc28d;
    font-size: 11.5px;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
    transition: all 0.2s ease;
  }

  .btn-edit-draft:hover {
    background: rgba(223, 194, 141, 0.2);
    border-color: rgba(223, 194, 141, 0.5);
    transform: translateX(2px);
  }

  /* Empty State */
  .editorial-empty-state {
    padding: 36px 20px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    border-radius: 10px;
    background: rgba(18, 22, 34, 0.3);
    border: 1px dashed rgba(255, 255, 255, 0.08);
  }

  .empty-icon-box {
    color: #10b981;
    margin-bottom: 2px;
  }

  .empty-title {
    margin: 0;
    font-size: 14.5px;
    font-weight: 750;
    color: #ffffff;
  }

  .empty-desc {
    margin: 0;
    font-size: 12px;
    color: #7b8396;
    max-width: 440px;
    line-height: 1.5;
  }

  .empty-actions {
    margin-top: 6px;
  }

  .btn-empty-primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #ffffff;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-empty-primary:hover {
    background: rgba(223, 194, 141, 0.15);
    border-color: rgba(223, 194, 141, 0.35);
    color: #dfc28d;
  }

  /* Right Column: Activity Sidebar */
  .sidebar-activity-col {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .published-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .published-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(18, 22, 34, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  .pub-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .pub-line-1 {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }

  .pub-work-title {
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pub-ch-num {
    color: #b59af5;
    font-weight: 700;
    white-space: nowrap;
  }

  .pub-time {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: #646b80;
  }

  .pub-action-btn {
    font-size: 11px;
    font-weight: 600;
    color: #8c93a8;
    text-decoration: none;
    padding: 4px 8px;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    transition: all 0.2s ease;
  }

  .pub-action-btn:hover {
    color: #dfc28d;
    border-color: rgba(223, 194, 141, 0.3);
  }

  /* Mini Works List */
  .mini-works-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mini-work-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(18, 22, 34, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.04);
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .mini-work-card:hover {
    background: rgba(24, 30, 48, 0.7);
    border-color: rgba(223, 194, 141, 0.25);
  }

  .mini-work-thumb {
    flex-shrink: 0;
  }

  .mini-work-img {
    width: 34px;
    height: 48px;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .mini-work-placeholder {
    width: 34px;
    height: 48px;
    border-radius: 4px;
    background: #161826;
    font-size: 9px;
    font-weight: 800;
    color: #dfc28d;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mini-work-meta {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
  }

  .mini-title {
    font-size: 12px;
    font-weight: 700;
    color: #e5e0f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mini-badges {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .mini-kind-tag {
    font-size: 9px;
    font-weight: 600;
    color: #9ba3b8;
    text-transform: uppercase;
  }

  .mini-status-tag {
    font-size: 9px;
    font-weight: 600;
    color: #fbbf24;
  }

  .mini-status-tag.published {
    color: #10b981;
  }

  :global(.mini-work-arrow) {
    color: #4b5263;
    transition: all 0.2s ease;
  }

  .mini-work-card:hover :global(.mini-work-arrow) {
    color: #dfc28d;
    transform: translateX(2px);
  }

  .empty-simple-text {
    margin: 0;
    font-size: 12px;
    color: #646b80;
    text-align: center;
    padding: 14px 0;
  }

  /* Responsive Rules */
  @media (max-width: 1120px) {
    .stat-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .workspace-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .dash-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 14px;
    }

    .btn-primary-admin {
      width: 100%;
      justify-content: center;
    }

    .stat-grid {
      grid-template-columns: 1fr;
    }

    .actions-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
