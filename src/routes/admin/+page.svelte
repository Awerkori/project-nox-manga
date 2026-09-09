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
    Activity,
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

<div class="editorial-workspace">
  <!-- 1. Header: Greeting & Date -->
  <header class="workspace-header">
    <div class="header-text-block">
      <div class="eyebrow-line">
        <span class="eyebrow-tag">PAINEL EDITORIAL</span>
        <span class="eyebrow-sep">·</span>
        <span class="eyebrow-date">{capitalizedToday}</span>
      </div>
      <h1 class="greeting-heading">Olá, {firstName}</h1>
      <p class="greeting-sub">
        Acompanhe a mesa de edição, publique novos capítulos e monitore o fluxo de importação.
      </p>
    </div>

    <!-- Quick High-Level Actions -->
    <div class="header-action-group">
      <a href="/admin/obras/nova" class="btn-primary-action">
        <Plus size={16} />
        <span>Nova Obra</span>
      </a>
      <a href="/admin/importer" class="btn-secondary-action">
        <Activity size={15} />
        <span>Importer</span>
      </a>
    </div>
  </header>

  <!-- 2. Light Metric Summary Bar (Spacious Pills) -->
  <section class="metrics-summary-bar" aria-label="Resumo do Catálogo">
    <a href="/admin/obras" class="metric-pill">
      <div class="pill-dot gold"></div>
      <span class="pill-label">Obras:</span>
      <strong class="pill-value">{data.works}</strong>
    </a>

    <div class="metric-pill">
      <div class="pill-dot purple"></div>
      <span class="pill-label">Capítulos no ar:</span>
      <strong class="pill-value">{data.chapters}</strong>
    </div>

    <a href="#mesa-de-edicao" class="metric-pill" class:has-alert={data.draftsCount > 0}>
      <div class="pill-dot amber" class:pulse={data.draftsCount > 0}></div>
      <span class="pill-label">Na Mesa:</span>
      <strong class="pill-value">{data.draftsCount}</strong>
      {#if data.draftsCount > 0}
        <span class="pill-badge">pendentes</span>
      {/if}
    </a>

    <a href="/admin/importer" class="metric-pill">
      <div class="pill-dot green pulse"></div>
      <span class="pill-label">Importer:</span>
      <strong class="pill-value">{data.importerActiveCount}</strong>
      <span class="pill-badge">em fila</span>
    </a>
  </section>

  <!-- 3. Primary Focused Workspace Grid -->
  <div class="workspace-layout">
    <!-- Left / Primary: Mesa de Edição -->
    <main class="primary-editorial-col">
      <section id="mesa-de-edicao" class="workspace-section">
        <div class="section-title-bar">
          <div>
            <div class="section-title-row">
              <h2 class="section-heading">Mesa de Edição</h2>
              {#if data.draftsCount > 0}
                <span class="drafts-count-tag">{data.draftsCount} em preparo</span>
              {/if}
            </div>
            <p class="section-subheading">Capítulos em rascunho aguardando revisão e publicação</p>
          </div>

          <a href="/admin/obras" class="section-corner-link">
            <span>Ver todas as obras</span>
            <ArrowRight size={13} />
          </a>
        </div>

        {#if data.drafts.length > 0}
          <div class="clean-drafts-list">
            {#each data.drafts as draft (draft.id)}
              <div class="draft-list-row">
                <!-- Cover thumbnail -->
                <a
                  href="/admin/obras/{draft.works?.id}/capitulos/{draft.id}"
                  class="draft-cover-thumb"
                  tabindex="-1"
                >
                  {#if draft.works?.cover_id}
                    <img
                      src="/media/{draft.works.cover_id}"
                      alt=""
                      width="42"
                      height="58"
                      class="thumb-img"
                    />
                  {:else}
                    <div class="thumb-empty">NOX</div>
                  {/if}
                </a>

                <!-- Meta Details -->
                <div class="draft-row-meta">
                  <div class="draft-title-line">
                    <a href="/admin/obras/{draft.works?.id}" class="draft-work-name">
                      {draft.works?.title || 'Obra sem título'}
                    </a>
                    <span class="status-chip-draft">Rascunho</span>
                  </div>
                  <div class="draft-ch-line">
                    <span class="draft-ch-number">Capítulo {draft.number}</span>
                    {#if draft.title}
                      <span class="draft-ch-subtitle">— {draft.title}</span>
                    {/if}
                  </div>
                  {#if draft.created_at}
                    <div class="draft-timestamp">
                      <Clock size={11} />
                      <span>Criado {relativeTime(draft.created_at)}</span>
                    </div>
                  {/if}
                </div>

                <!-- Action Button -->
                <a
                  href="/admin/obras/{draft.works?.id}/capitulos/{draft.id}"
                  class="btn-edit-action"
                >
                  <span>Editar</span>
                  <ArrowRight size={13} />
                </a>
              </div>
            {/each}
          </div>
        {:else}
          <!-- Elegant Clean Empty State -->
          <div class="mesa-clean-empty">
            <div class="empty-icon-circle">
              <CheckCircle2 size={28} />
            </div>
            <h3 class="empty-heading">Mesa de edição limpa</h3>
            <p class="empty-paragraph">
              Não há capítulos pendentes de revisão ou rascunhos abertos no momento.
            </p>
            <a href="/admin/obras" class="btn-empty-action">
              <BookOpen size={14} />
              <span>Explorar Obras para Novo Capítulo</span>
            </a>
          </div>
        {/if}
      </section>
    </main>

    <!-- Right / Secondary Column: Últimas Publicações & Radar -->
    <aside class="secondary-editorial-col">
      <!-- Section: Últimas Publicações -->
      <section class="workspace-section">
        <div class="section-title-bar">
          <div>
            <h2 class="section-heading">Últimas Publicações</h2>
            <p class="section-subheading">Capítulos recém-lançados no ar</p>
          </div>
        </div>

        {#if data.recentPublished.length > 0}
          <div class="clean-published-list">
            {#each data.recentPublished as pub (pub.id)}
              <div class="pub-row">
                <div class="pub-main-info">
                  <span class="pub-work">{pub.works?.title}</span>
                  <span class="pub-ch">Capítulo {pub.number}</span>
                  {#if pub.published_at}
                    <span class="pub-time">{relativeTime(pub.published_at)}</span>
                  {/if}
                </div>

                <a
                  href="/admin/obras/{pub.works?.id}/capitulos/{pub.id}"
                  class="btn-review-pub"
                  title="Revisar capítulo publicado"
                >
                  <span>Revisar</span>
                </a>
              </div>
            {/each}
          </div>
        {:else}
          <p class="empty-state-hint">Nenhum capítulo publicado recentemente.</p>
        {/if}
      </section>

      <!-- Section: Obras no Radar -->
      {#if data.recentWorks.length > 0}
        <section class="workspace-section" style="margin-top: 24px;">
          <div class="section-title-bar">
            <div>
              <h2 class="section-heading">Obras no Radar</h2>
              <p class="section-subheading">Atualizadas recentemente</p>
            </div>
            <a href="/admin/obras" class="section-corner-link">
              <span>Todas</span>
              <ArrowRight size={12} />
            </a>
          </div>

          <div class="radar-works-list">
            {#each data.recentWorks as work (work.id)}
              <a href="/admin/obras/{work.id}" class="radar-work-row">
                <div class="radar-thumb">
                  {#if work.cover_id}
                    <img src="/media/{work.cover_id}" alt="" width="32" height="44" class="radar-img" />
                  {:else}
                    <div class="radar-placeholder">NOX</div>
                  {/if}
                </div>
                <div class="radar-meta">
                  <strong class="radar-title">{work.title}</strong>
                  <div class="radar-tags">
                    <span class="radar-kind">{kindLabels[work.kind] || work.kind}</span>
                    <span class="radar-status" class:is-published={work.published}>
                      {work.published ? 'No ar' : 'Rascunho'}
                    </span>
                  </div>
                </div>
                <span class="radar-arrow">
                  <ArrowRight size={13} />
                </span>
              </a>
            {/each}
          </div>
        </section>
      {/if}
    </aside>
  </div>
</div>

<style>
  .editorial-workspace {
    display: flex;
    flex-direction: column;
    gap: 28px;
    width: 100%;
    max-width: 1360px;
    margin: 0 auto;
    min-width: 0;
    box-sizing: border-box;
  }

  /* 1. Header */
  .workspace-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    padding-bottom: 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-wrap: wrap;
  }

  .header-text-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .eyebrow-line {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #dfc28d;
    text-transform: uppercase;
  }

  .eyebrow-sep {
    color: #4b5266;
  }

  .eyebrow-date {
    color: #7b8396;
    font-weight: 500;
    text-transform: none;
    letter-spacing: normal;
  }

  .greeting-heading {
    margin: 0;
    font-family: var(--font-heading, 'Manrope', sans-serif);
    font-size: clamp(1.8rem, 3vw, 2.3rem);
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.025em;
    line-height: 1.15;
  }

  .greeting-sub {
    margin: 0;
    color: #8c93a8;
    font-size: 0.92rem;
    max-width: 620px;
    line-height: 1.5;
  }

  .header-action-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .btn-primary-action {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 9px;
    background: linear-gradient(135deg, #dfc28d 0%, #c49c5e 100%);
    color: #0c0d14;
    font-size: 13px;
    font-weight: 750;
    text-decoration: none;
    box-shadow: 0 4px 18px rgba(223, 194, 141, 0.25);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    white-space: nowrap;
  }

  .btn-primary-action:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(223, 194, 141, 0.4);
  }

  .btn-secondary-action {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 10px 16px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #ffffff;
    font-size: 13px;
    font-weight: 650;
    text-decoration: none;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .btn-secondary-action:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.16);
    transform: translateY(-1px);
  }

  /* 2. Light Metric Summary Bar */
  .metrics-summary-bar {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
  }

  .metric-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    text-decoration: none;
    color: #8c93a8;
    font-size: 12.5px;
    transition: all 0.2s ease;
  }

  .metric-pill:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.12);
    color: #ffffff;
  }

  .metric-pill.has-alert {
    background: rgba(245, 158, 11, 0.08);
    border-color: rgba(245, 158, 11, 0.25);
  }

  .pill-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .pill-dot.gold { background: #dfc28d; }
  .pill-dot.purple { background: #a78bfa; }
  .pill-dot.amber { background: #f59e0b; }
  .pill-dot.green { background: #10b981; }

  .pill-dot.pulse {
    box-shadow: 0 0 8px currentColor;
    animation: pulseGlow 2s infinite ease-in-out;
  }

  @keyframes pulseGlow {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.2); }
  }

  .pill-label {
    font-weight: 500;
  }

  .pill-value {
    color: #ffffff;
    font-weight: 750;
  }

  .pill-badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 1px 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: #dfc28d;
  }

  /* 3. Primary Workspace Grid */
  .workspace-layout {
    display: grid;
    grid-template-columns: 1.6fr 1fr;
    gap: 28px;
    align-items: flex-start;
    min-width: 0;
    width: 100%;
  }

  @media (max-width: 1024px) {
    .workspace-layout {
      grid-template-columns: 1fr;
    }
  }

  .primary-editorial-col,
  .secondary-editorial-col {
    min-width: 0;
    width: 100%;
  }

  .workspace-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
    width: 100%;
  }

  .section-title-bar {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-wrap: wrap;
    min-width: 0;
    width: 100%;
  }

  .section-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .section-heading {
    font-size: 1.15rem;
    font-weight: 750;
    color: #ffffff;
    margin: 0;
    letter-spacing: -0.01em;
  }

  .drafts-count-tag {
    font-size: 11px;
    font-weight: 750;
    padding: 2px 9px;
    border-radius: 999px;
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .section-subheading {
    font-size: 0.82rem;
    color: #7b8396;
    margin: 3px 0 0;
  }

  .section-corner-link {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: #dfc28d;
    text-decoration: none;
    font-weight: 600;
    transition: color 0.15s ease;
  }

  .section-corner-link:hover {
    color: #ffffff;
  }

  /* Mesa de Edição: Clean List */
  .clean-drafts-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .draft-list-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 16px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
  }

  .draft-list-row:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(223, 194, 141, 0.25);
    transform: translateX(2px);
  }

  .draft-cover-thumb {
    width: 42px;
    height: 58px;
    border-radius: 6px;
    overflow: hidden;
    background: #111420;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumb-empty {
    font-size: 10px;
    font-weight: 800;
    color: #4c5366;
  }

  .draft-row-meta {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .draft-title-line {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .draft-work-name {
    font-size: 13.5px;
    font-weight: 700;
    color: #ffffff;
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .draft-work-name:hover {
    color: #dfc28d;
  }

  .status-chip-draft {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 999px;
    background: rgba(245, 158, 11, 0.12);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.25);
  }

  .draft-ch-line {
    font-size: 12.5px;
    color: #c9cddb;
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .draft-ch-number {
    font-weight: 650;
    color: #dfc28d;
  }

  .draft-ch-subtitle {
    color: #8c93a8;
  }

  .draft-timestamp {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #656d82;
    margin-top: 1px;
  }

  .btn-edit-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 8px;
    background: rgba(223, 194, 141, 0.12);
    border: 1px solid rgba(223, 194, 141, 0.3);
    color: #dfc28d;
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .btn-edit-action:hover {
    background: #dfc28d;
    color: #0c0d14;
  }

  /* Mesa Clean Empty State */
  .mesa-clean-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 42px 24px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.015);
    border: 1px dashed rgba(255, 255, 255, 0.08);
  }

  .empty-icon-circle {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
    margin-bottom: 14px;
  }

  .empty-heading {
    font-size: 15px;
    font-weight: 750;
    color: #ffffff;
    margin: 0 0 6px;
  }

  .empty-paragraph {
    font-size: 12.5px;
    color: #7b8396;
    max-width: 380px;
    margin: 0 0 18px;
    line-height: 1.5;
  }

  .btn-empty-action {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 16px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #ffffff;
    font-size: 12px;
    font-weight: 650;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .btn-empty-action:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  /* Right Column: Clean Published List */
  .clean-published-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .pub-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
    gap: 12px;
  }

  .pub-main-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .pub-work {
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pub-ch {
    font-size: 12px;
    color: #dfc28d;
    font-weight: 600;
  }

  .pub-time {
    font-size: 10.5px;
    color: #656d82;
  }

  .btn-review-pub {
    padding: 5px 11px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 650;
    color: #c9cddb;
    text-decoration: none;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .btn-review-pub:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  /* Radar Works List */
  .radar-works-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .radar-work-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .radar-work-row:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .radar-thumb {
    width: 32px;
    height: 44px;
    border-radius: 5px;
    overflow: hidden;
    background: #111420;
    flex-shrink: 0;
    display: grid;
    place-items: center;
  }

  .radar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .radar-placeholder {
    font-size: 9px;
    font-weight: 800;
    color: #4b5266;
  }

  .radar-meta {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .radar-title {
    font-size: 12.5px;
    color: #ffffff;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .radar-tags {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .radar-kind {
    font-size: 10px;
    color: #8c93a8;
  }

  .radar-status {
    font-size: 9.5px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    color: #8c93a8;
  }

  .radar-status.is-published {
    background: rgba(16, 185, 129, 0.12);
    color: #10b981;
  }

  .radar-arrow {
    color: #4b5266;
    transition: color 0.15s ease;
  }

  .radar-work-row:hover .radar-arrow {
    color: #dfc28d;
  }

  .empty-state-hint {
    font-size: 12px;
    color: #656d82;
    margin: 8px 0;
  }

  @media (max-width: 640px) {
    .workspace-header {
      flex-direction: column;
      align-items: stretch;
      gap: 16px;
    }

    .header-action-group {
      display: flex;
      flex-direction: column;
      width: 100%;
      gap: 8px;
    }

    .btn-primary-action,
    .btn-secondary-action {
      width: 100%;
      justify-content: center;
      box-sizing: border-box;
    }

    .metrics-summary-bar {
      gap: 8px;
    }

    .metric-pill {
      flex: 1 1 calc(50% - 8px);
      justify-content: center;
      box-sizing: border-box;
    }

    .section-title-bar {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }

    .section-corner-link {
      align-self: flex-start;
    }

    .draft-list-row {
      display: grid;
      grid-template-columns: 42px 1fr;
      grid-template-areas:
        "thumb meta"
        "action action";
      gap: 12px;
      padding: 12px;
    }

    .draft-cover-thumb {
      grid-area: thumb;
    }

    .draft-row-meta {
      grid-area: meta;
    }

    .btn-edit-action {
      grid-area: action;
      justify-content: center;
      width: 100%;
      box-sizing: border-box;
    }
  }
</style>
