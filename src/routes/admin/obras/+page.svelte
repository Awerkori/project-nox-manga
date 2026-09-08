<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import {
    Plus,
    Search,
    X,
    RefreshCw,
    ExternalLink,
    ArrowRight,
    BookOpen,
    Clock,
    AlertCircle,
    CheckCircle2
  } from '@lucide/svelte';
  import { kindLabels, date } from '$lib/types';

  let { data } = $props();

  let search = $state('');
  let selectedKind = $state('ALL');
  let selectedStatus = $state('ALL');
  let notice = $state('');
  let noticeType = $state<'info' | 'success' | 'error'>('info');
  let syncing = $state(false);

  let filteredWorks = $derived(
    data.works.filter((w: any) => {
      const matchesSearch =
        !search ||
        w.title.toLowerCase().includes(search.toLowerCase()) ||
        w.slug.toLowerCase().includes(search.toLowerCase()) ||
        (w.author && w.author.toLowerCase().includes(search.toLowerCase()));

      const matchesKind = selectedKind === 'ALL' || w.kind === selectedKind;

      const matchesStatus =
        selectedStatus === 'ALL' ||
        (selectedStatus === 'PUBLISHED' && w.published) ||
        (selectedStatus === 'DRAFT' && !w.published);

      return matchesSearch && matchesKind && matchesStatus;
    })
  );

  async function sync() {
    syncing = true;
    notice = '';
    try {
      const response = await fetch('/api/staff', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Erro ao sincronizar.');
      notice = result.message;
      noticeType = 'success';
      await invalidateAll();
    } catch (e) {
      notice = (e as Error).message;
      noticeType = 'error';
    } finally {
      syncing = false;
    }
  }

  function clearFilters() {
    search = '';
    selectedKind = 'ALL';
    selectedStatus = 'ALL';
  }
</script>

<svelte:head>
  <title>Obras do Catálogo — Nox Editorial</title>
</svelte:head>

<div class="works-manager-shell">
  <!-- Header with Actions -->
  <header class="page-header">
    <div class="header-titles">
      <span class="eyebrow">CATÁLOGO EDITORIAL</span>
      <h1 class="page-title">Obras Cadastradas</h1>
      <p class="page-subtitle">
        Gerencie as histórias, adicione capítulos, defina metadados e publique no catálogo público.
      </p>
    </div>

    <div class="header-actions">
      <!-- Unidirectional read-only staff sync button -->
      <button
        type="button"
        class="btn-secondary-sync"
        onclick={sync}
        disabled={syncing}
        title="Consultar novas obras aprovadas na central (estritamente unidirecional/leitura)"
      >
        <RefreshCw size={15} class={syncing ? 'spin-icon' : ''} />
        <span>{syncing ? 'Importando…' : 'Importar da Central'}</span>
      </button>

      <a href="/admin/obras/nova" class="btn-primary-add">
        <Plus size={16} />
        <span>Cadastrar Nova Obra</span>
      </a>
    </div>
  </header>

  <!-- Feedback Notice Banner -->
  {#if notice}
    <div class="notice-banner" class:notice-success={noticeType === 'success'} class:notice-error={noticeType === 'error'} role="status">
      {#if noticeType === 'success'}
        <CheckCircle2 size={16} class="notice-icon" />
      {:else if noticeType === 'error'}
        <AlertCircle size={16} class="notice-icon" />
      {/if}
      <span>{notice}</span>
      <button type="button" class="notice-close" onclick={() => (notice = '')} aria-label="Fechar aviso">
        <X size={14} />
      </button>
    </div>
  {/if}

  <!-- Filters & Search Toolbar -->
  <div class="filters-toolbar">
    <!-- Search Input -->
    <div class="search-box">
      <Search size={16} class="search-icon" />
      <input
        type="text"
        class="search-input"
        placeholder="Buscar por título, slug ou autor…"
        aria-label="Buscar obras"
        bind:value={search}
      />
      {#if search}
        <button type="button" class="search-clear" onclick={() => (search = '')} aria-label="Limpar busca">
          <X size={14} />
        </button>
      {/if}
    </div>

    <!-- Filter Pills Row -->
    <div class="filter-pills-row">
      <!-- Status Pills -->
      <div class="filter-group">
        <span class="filter-group-label">Status:</span>
        <button
          type="button"
          class="pill-btn"
          class:active={selectedStatus === 'ALL'}
          onclick={() => (selectedStatus = 'ALL')}
        >
          Todas
        </button>
        <button
          type="button"
          class="pill-btn"
          class:active={selectedStatus === 'PUBLISHED'}
          onclick={() => (selectedStatus = 'PUBLISHED')}
        >
          <span class="dot-pub"></span>
          No ar
        </button>
        <button
          type="button"
          class="pill-btn"
          class:active={selectedStatus === 'DRAFT'}
          onclick={() => (selectedStatus = 'DRAFT')}
        >
          <span class="dot-draft"></span>
          Rascunho
        </button>
      </div>

      <!-- Format Pills -->
      <div class="filter-group">
        <span class="filter-group-label">Formato:</span>
        <button
          type="button"
          class="pill-btn"
          class:active={selectedKind === 'ALL'}
          onclick={() => (selectedKind = 'ALL')}
        >
          Todos
        </button>
        <button
          type="button"
          class="pill-btn"
          class:active={selectedKind === 'MANHWA'}
          onclick={() => (selectedKind = 'MANHWA')}
        >
          Manhwa
        </button>
        <button
          type="button"
          class="pill-btn"
          class:active={selectedKind === 'MANGA'}
          onclick={() => (selectedKind = 'MANGA')}
        >
          Mangá
        </button>
      </div>
    </div>

    <!-- Results Count -->
    <div class="results-count">
      <span>Mostrando <strong>{filteredWorks.length}</strong> de {data.works.length} obras</span>
    </div>
  </div>

  <!-- Works Container -->
  {#if filteredWorks.length > 0}
    <!-- 1. Desktop Rich Table -->
    <div class="desktop-table-card">
      <table class="works-table">
        <thead>
          <tr>
            <th class="th-cover">Capa</th>
            <th class="th-work">Obra & Endereço</th>
            <th class="th-kind">Formato</th>
            <th class="th-status">Situação</th>
            <th class="th-date">Atualizada em</th>
            <th class="th-actions">Ações</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredWorks as work (work.id)}
            <tr class="work-table-row">
              <!-- Cover Column -->
              <td class="td-cover">
                <a href="/admin/obras/{work.id}" class="cover-mini-frame" tabindex="-1">
                  {#if work.cover_id}
                    <img
                      src="/media/{work.cover_id}"
                      alt=""
                      width="44"
                      height="62"
                      class="table-cover-img"
                      loading="lazy"
                    />
                  {:else}
                    <div class="table-cover-placeholder">NOX</div>
                  {/if}
                </a>
              </td>

              <!-- Title & Slug Column -->
              <td class="td-work">
                <div class="work-title-cluster">
                  <a href="/admin/obras/{work.id}" class="work-title-link">
                    {work.title}
                  </a>
                  <span class="work-slug-label">/obra/{work.slug}</span>
                </div>
              </td>

              <!-- Kind Column -->
              <td class="td-kind">
                <span class="kind-chip">{kindLabels[work.kind] || work.kind}</span>
              </td>

              <!-- Status Column -->
              <td class="td-status">
                {#if work.published}
                  <span class="status-badge status-live">
                    <span class="status-dot-live"></span>
                    <span>No ar</span>
                  </span>
                {:else}
                  <span class="status-badge status-draft">
                    <span class="status-dot-draft"></span>
                    <span>Rascunho</span>
                  </span>
                {/if}
              </td>

              <!-- Updated At Column -->
              <td class="td-date">
                <span class="date-text">{date(work.updated_at || work.created_at)}</span>
              </td>

              <!-- Actions Column -->
              <td class="td-actions">
                <div class="action-buttons-group">
                  <a href="/admin/obras/{work.id}" class="btn-manage-work">
                    <span>Gerenciar</span>
                    <ArrowRight size={13} />
                  </a>

                  {#if work.published}
                    <a
                      href="/obra/{work.slug}"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn-view-site"
                      title="Ver obra no site público"
                    >
                      <ExternalLink size={13} />
                    </a>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- 2. Mobile Responsive Cards (< 820px) -->
    <div class="mobile-cards-feed">
      {#each filteredWorks as work (work.id)}
        <div class="mobile-work-card">
          <!-- Mini Cover -->
          <a href="/admin/obras/{work.id}" class="mobile-cover-wrap" tabindex="-1">
            {#if work.cover_id}
              <img
                src="/media/{work.cover_id}"
                alt=""
                width="56"
                height="78"
                class="mobile-cover-img"
                loading="lazy"
              />
            {:else}
              <div class="mobile-cover-placeholder">NOX</div>
            {/if}
          </a>

          <!-- Info -->
          <div class="mobile-card-content">
            <div class="mobile-card-top">
              <a href="/admin/obras/{work.id}" class="mobile-card-title">
                {work.title}
              </a>
              {#if work.published}
                <span class="status-badge status-live">
                  <span class="status-dot-live"></span>
                  <span>No ar</span>
                </span>
              {:else}
                <span class="status-badge status-draft">
                  <span class="status-dot-draft"></span>
                  <span>Rascunho</span>
                </span>
              {/if}
            </div>

            <div class="mobile-card-mid">
              <span class="kind-chip">{kindLabels[work.kind] || work.kind}</span>
              <span class="mobile-date">{date(work.updated_at || work.created_at)}</span>
            </div>

            <div class="mobile-card-actions">
              <a href="/admin/obras/{work.id}" class="btn-manage-work mobile-btn">
                <span>Gerenciar</span>
                <ArrowRight size={13} />
              </a>
              {#if work.published}
                <a
                  href="/obra/{work.slug}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn-view-site"
                  title="Ver no site público"
                >
                  <ExternalLink size={14} />
                </a>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <!-- Empty State -->
    <div class="empty-catalog-card">
      <div class="empty-icon-circle">
        <BookOpen size={34} />
      </div>
      {#if search || selectedKind !== 'ALL' || selectedStatus !== 'ALL'}
        <h3>Nenhuma obra encontrada</h3>
        <p>Nenhuma história corresponde aos filtros ou busca selecionados.</p>
        <button type="button" class="btn-reset-filters" onclick={clearFilters}>
          Limpar filtros de busca
        </button>
      {:else}
        <h3>Catálogo de obras vazio</h3>
        <p>Comece adicionando a primeira obra ou importe rascunhos da central.</p>
        <div class="empty-buttons-row">
          <a href="/admin/obras/nova" class="btn-primary-add">
            <Plus size={16} />
            <span>Cadastrar Primeira Obra</span>
          </a>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .works-manager-shell {
    display: flex;
    flex-direction: column;
    gap: 24px;
    width: 100%;
    max-width: 1280px;
  }

  /* Header */
  .page-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .header-titles {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .eyebrow {
    font-size: 11px;
    font-weight: 750;
    color: #dfc28d;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .page-title {
    margin: 0;
    font-family: var(--font-heading, 'Manrope', sans-serif);
    font-size: clamp(1.8rem, 3.2vw, 2.3rem);
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.02em;
    line-height: 1.15;
  }

  .page-subtitle {
    margin: 0;
    color: #8c93a8;
    font-size: 0.92rem;
    max-width: 600px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .btn-primary-add {
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

  .btn-primary-add:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(223, 194, 141, 0.5);
  }

  .btn-secondary-sync {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 10px 16px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #d5d9e6;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .btn-secondary-sync:hover:not(:disabled) {
    background: rgba(181, 154, 245, 0.12);
    border-color: rgba(181, 154, 245, 0.35);
    color: #ffffff;
  }

  .btn-secondary-sync:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :global(.spin-icon) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Notice Banner */
  .notice-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 10px;
    background: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56, 189, 248, 0.3);
    color: #7dd3fc;
    font-size: 13px;
    font-weight: 500;
  }

  .notice-banner.notice-success {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.35);
    color: #6ee7b7;
  }

  .notice-banner.notice-error {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.35);
    color: #fca5a5;
  }

  :global(.notice-icon) {
    flex-shrink: 0;
  }

  .notice-close {
    margin-left: auto;
    background: none;
    border: none;
    color: inherit;
    opacity: 0.7;
    cursor: pointer;
    padding: 2px;
  }

  .notice-close:hover {
    opacity: 1;
  }

  /* Filters Toolbar */
  .filters-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
    padding: 14px 18px;
    background: rgba(13, 16, 26, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    backdrop-filter: blur(12px);
  }

  .search-box {
    position: relative;
    display: flex;
    align-items: center;
    min-width: 280px;
    flex: 1;
    max-width: 420px;
  }

  :global(.search-icon) {
    position: absolute;
    left: 12px;
    color: #646b80;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 9px 36px 9px 36px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #ffffff;
    font-size: 13px;
    outline: none;
    transition: all 0.2s ease;
  }

  .search-input:focus {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(223, 194, 141, 0.4);
    box-shadow: 0 0 12px rgba(223, 194, 141, 0.15);
  }

  .search-clear {
    position: absolute;
    right: 10px;
    background: none;
    border: none;
    color: #7b8396;
    cursor: pointer;
    padding: 2px;
  }

  .search-clear:hover {
    color: #ffffff;
  }

  .filter-pills-row {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .filter-group-label {
    font-size: 11px;
    font-weight: 600;
    color: #6b7280;
  }

  .pill-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 11px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #98a2b8;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .pill-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .pill-btn.active {
    background: rgba(181, 154, 245, 0.14);
    border-color: rgba(181, 154, 245, 0.35);
    color: #ffffff;
  }

  .dot-pub {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
  }

  .dot-draft {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #f59e0b;
  }

  .results-count {
    font-size: 11.5px;
    color: #7b8396;
  }

  .results-count strong {
    color: #dfc28d;
  }

  /* Desktop Table Card */
  .desktop-table-card {
    background: rgba(13, 16, 26, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    overflow: hidden;
    backdrop-filter: blur(14px);
  }

  .works-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .works-table th {
    background: rgba(18, 22, 34, 0.6);
    padding: 12px 18px;
    text-align: left;
    font-size: 11px;
    font-weight: 700;
    color: #7b8396;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .work-table-row {
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    transition: background 0.15s ease;
  }

  .work-table-row:hover {
    background: rgba(22, 28, 44, 0.5);
  }

  .work-table-row:last-child {
    border-bottom: none;
  }

  .works-table td {
    padding: 14px 18px;
    vertical-align: middle;
  }

  .th-cover,
  .td-cover {
    width: 64px;
    padding-right: 0 !important;
  }

  .cover-mini-frame {
    display: block;
    width: 44px;
    height: 62px;
    border-radius: 6px;
    overflow: hidden;
    text-decoration: none;
  }

  .table-cover-img {
    width: 44px;
    height: 62px;
    object-fit: cover;
    display: block;
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition: transform 0.2s ease;
  }

  .cover-mini-frame:hover .table-cover-img {
    transform: scale(1.05);
  }

  .table-cover-placeholder {
    width: 44px;
    height: 62px;
    border-radius: 6px;
    background: #171926;
    font-size: 9px;
    font-weight: 800;
    color: #dfc28d;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .work-title-cluster {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .work-title-link {
    font-size: 13.5px;
    font-weight: 750;
    color: #ffffff;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .work-title-link:hover {
    color: #dfc28d;
  }

  .work-slug-label {
    font-size: 11px;
    color: #646b80;
    font-family: monospace;
  }

  .kind-chip {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 5px;
    background: rgba(181, 154, 245, 0.1);
    border: 1px solid rgba(181, 154, 245, 0.25);
    color: #cbb4ff;
    font-size: 10.5px;
    font-weight: 650;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 650;
  }

  .status-live {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #6ee7b7;
  }

  .status-dot-live {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 6px #10b981;
  }

  .status-draft {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #fbbf24;
  }

  .status-dot-draft {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #f59e0b;
  }

  .date-text {
    font-size: 12px;
    color: #8c93a8;
  }

  .action-buttons-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-manage-work {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 7px;
    background: rgba(223, 194, 141, 0.1);
    border: 1px solid rgba(223, 194, 141, 0.28);
    color: #dfc28d;
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-manage-work:hover {
    background: rgba(223, 194, 141, 0.2);
    border-color: rgba(223, 194, 141, 0.5);
    transform: translateX(2px);
  }

  .btn-view-site {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #98a2b8;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-view-site:hover {
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.2);
  }

  /* Mobile Responsive Cards (< 820px) */
  .mobile-cards-feed {
    display: none;
    flex-direction: column;
    gap: 12px;
  }

  .mobile-work-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px;
    background: rgba(13, 16, 26, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    backdrop-filter: blur(12px);
  }

  .mobile-cover-wrap {
    flex-shrink: 0;
    text-decoration: none;
  }

  .mobile-cover-img {
    width: 56px;
    height: 78px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .mobile-cover-placeholder {
    width: 56px;
    height: 78px;
    border-radius: 6px;
    background: #171926;
    font-size: 10px;
    font-weight: 800;
    color: #dfc28d;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mobile-card-content {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .mobile-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .mobile-card-title {
    font-size: 13.5px;
    font-weight: 750;
    color: #ffffff;
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mobile-card-mid {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .mobile-date {
    font-size: 11px;
    color: #7b8396;
  }

  .mobile-card-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 2px;
  }

  .mobile-btn {
    flex: 1;
    justify-content: center;
  }

  /* Empty Catalog Card */
  .empty-catalog-card {
    padding: 50px 20px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    border-radius: 14px;
    background: rgba(13, 16, 26, 0.4);
    border: 1px dashed rgba(255, 255, 255, 0.1);
  }

  .empty-icon-circle {
    color: #dfc28d;
  }

  .empty-catalog-card h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 750;
    color: #ffffff;
  }

  .empty-catalog-card p {
    margin: 0;
    font-size: 13px;
    color: #7b8396;
    max-width: 440px;
  }

  .btn-reset-filters {
    padding: 8px 16px;
    border-radius: 8px;
    background: rgba(223, 194, 141, 0.12);
    border: 1px solid rgba(223, 194, 141, 0.35);
    color: #dfc28d;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-reset-filters:hover {
    background: rgba(223, 194, 141, 0.25);
  }

  /* Responsive Display Rules */
  @media (max-width: 820px) {
    .desktop-table-card {
      display: none;
    }

    .mobile-cards-feed {
      display: flex;
    }

    .page-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
    }

    .header-actions {
      width: 100%;
    }

    .btn-primary-add,
    .btn-secondary-sync {
      flex: 1;
      justify-content: center;
    }
  }
</style>
