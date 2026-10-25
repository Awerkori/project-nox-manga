<script lang="ts">
  import {
    ArrowRight,
    BookOpen,
    Clock,
    AlertTriangle,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Home
  } from '@lucide/svelte';
  import { SvelteURLSearchParams } from 'svelte/reactivity';
  import { relativeTime, kindLabels } from '$lib/types';
  import { page } from '$app/state';
  import { resolveCoverUrl, resolveOriginalCoverUrl } from '$lib/covers';
  import { decodeHtmlEntities } from '$lib/html-entities';
  import { chapterDisplayNumber, compareChapterIdentity } from '$lib/chapter-identity';
  import { deferImage } from '$lib/actions/defer-image';

  type ChapterItem = {
    id: string;
    number: number | string | null;
    display_number?: string | null;
    canonical_chapter_key?: string | null;
    chapter_order_key?: string | null;
    chapter_kind?: string | null;
    edition?: string | null;
    language?: string | null;
    title: string | null;
    publishedAt: string;
  };

  type ReleaseItem = {
    workId: string;
    workSlug: string;
    workTitle: string;
    coverId: string | null;
    kind: string;
    contentRating?: string | null;
    latestPublishedAt: string;
    chapters: ChapterItem[];
  };

  type PageData = {
    releases: ReleaseItem[];
    totalWorks: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
    selectedKind: string;
    loadError: boolean;
  };

  let { data }: { data: PageData } = $props();

  const filterTabs = [
    { key: 'ALL', label: 'Todos' },
    { key: 'MANGA', label: 'Mangá' },
    { key: 'MANHWA', label: 'Manhwa' },
    { key: 'MANHUA', label: 'Manhua' },
    { key: 'WEBTOON', label: 'Webtoon' }
  ];

  function fallbackCover(node: HTMLImageElement) {
    const onError = () => {
      if (node.src.includes('size=thumb') || node.src.includes('size=hero')) {
        node.src = resolveOriginalCoverUrl(node.src);
        return;
      }
      if (!node.src.endsWith('/brand/nox-symbol.webp')) {
        node.src = '/brand/nox-symbol.webp';
      }
    };
    node.addEventListener('error', onError);
    return {
      destroy() {
        node.removeEventListener('error', onError);
      }
    };
  }

  function getPageUrl(targetPage: number, targetKind?: string): string {
    const params = new SvelteURLSearchParams();
    const effectiveKind = targetKind !== undefined ? targetKind : (data.selectedKind || 'ALL');
    if (effectiveKind && effectiveKind !== 'ALL') {
      params.set('kind', effectiveKind);
    }
    if (targetPage > 1) {
      params.set('page', targetPage.toString());
    }
    const qs = params.toString();
    return `/lancamentos${qs ? `?${qs}` : ''}`;
  }

  function getPaginationRange(current: number, total: number): (number | string)[] {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 4) {
      return [1, 2, 3, 4, 5, '...', total];
    }
    if (current >= total - 3) {
      return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, '...', current - 1, current, current + 1, '...', total];
  }

  let paginationPages = $derived(getPaginationRange(data.currentPage, data.totalPages));
</script>

<svelte:head>
  <title>
    {data.currentPage > 1
      ? `Lançamentos (Página ${data.currentPage}) — Project Nox`
      : 'Lançamentos — Capítulos Recentes | Project Nox'}
  </title>
  <meta
    name="description"
    content="Acompanhe os capítulos recém-publicados no Project Nox. Mangás, Manhwas e Manhuas atualizados em ordem cronológica com paginação."
  />
  <link rel="canonical" href="{page.url.origin}/lancamentos{data.currentPage > 1 ? `?page=${data.currentPage}` : ''}" />
</svelte:head>

<div class="lancamentos-wrapper">
  <div class="lancamentos-container">
    <!-- Breadcrumb Navigation -->
    <nav class="breadcrumb-nav" aria-label="Navegação estrutural">
      <a href="/" class="breadcrumb-link">
        <Home size={14} class="breadcrumb-icon" />
        <span>Início</span>
      </a>
      <span class="breadcrumb-separator">/</span>
      <span class="breadcrumb-current">Lançamentos</span>
      {#if data.selectedKind && data.selectedKind !== 'ALL'}
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-category">{kindLabels[data.selectedKind] || data.selectedKind}</span>
      {/if}
      {#if data.currentPage > 1}
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-page">Pág. {data.currentPage}</span>
      {/if}
    </nav>

    <!-- Page Header Section -->
    <header class="page-header">
      <div class="header-titles">
        <div class="title-with-bar">
          <span class="title-accent-bar" aria-hidden="true"></span>
          <h1 class="page-title">LANÇAMENTOS</h1>
        </div>
        <p class="page-subtitle">Capítulos mais recentes publicados pelos scans e tradutores</p>
      </div>

      <!-- Category Filter Tabs (Native SSR Links) -->
      <nav class="filter-bar" aria-label="Filtros de categoria">
        {#each filterTabs as tab (tab.key)}
          <a
            href={getPageUrl(1, tab.key)}
            class="filter-pill"
            class:active={data.selectedKind === tab.key}
            aria-current={data.selectedKind === tab.key ? 'page' : undefined}
          >
            {tab.label}
          </a>
        {/each}
      </nav>
    </header>

    <!-- Meta Information Bar -->
    {#if data.totalWorks > 0}
      <div class="results-meta-bar">
        <span class="meta-count">
          Exibindo <strong>{(data.currentPage - 1) * data.pageSize + 1}–{Math.min(data.currentPage * data.pageSize, data.totalWorks)}</strong> de <strong>{data.totalWorks.toLocaleString('pt-BR')}</strong> obras
        </span>
        <span class="meta-pages">
          Página {data.currentPage} de {data.totalPages}
        </span>
      </div>
    {/if}

    <!-- Releases Grid -->
    {#if data.releases.length > 0}
      <div class="releases-grid">
        {#each data.releases as rel, index (rel.workId)}
          {@const isAdult = rel.contentRating === 'ADULT_18'}
          {@const effectiveBlur = isAdult && (page.data?.blurNsfw ?? true)}
          {@const sortedChapters = rel.chapters.slice().sort((a, b) => compareChapterIdentity(b, a))}
          {@const thumbCover = resolveCoverUrl(rel.coverId, rel.workSlug, rel.workId, { size: 'thumb' })}
          <article class="release-row-card">
            <!-- Mini Cover Thumbnail -->
            <a href="/obra/{rel.workSlug}" class="cover-thumb-link" tabindex="-1">
              <div class="thumb-wrap">
                <img
                  use:fallbackCover
                  use:deferImage={{ src: index < 6 ? null : thumbCover }}
                  src={index < 6 ? thumbCover : undefined}
                  alt={rel.workTitle}
                  class="thumb-img"
                  class:blurred-cover={effectiveBlur}
                  width="68"
                  height="96"
                  loading={index < 6 ? 'eager' : 'lazy'}
                  fetchpriority={index < 3 ? 'high' : 'auto'}
                  decoding="async"
                />
                {#if isAdult}
                  <span class="adult-badge-mini">+18</span>
                {/if}
              </div>
            </a>

            <!-- Details & Interactive Chapter Pills -->
            <div class="release-main">
              <div class="release-top-row">
                <div class="work-title-group">
                  <a href="/obra/{rel.workSlug}" class="work-link" title={decodeHtmlEntities(rel.workTitle)}>
                    {decodeHtmlEntities(rel.workTitle)}
                  </a>
                  <span class="kind-tag">{kindLabels[rel.kind] || rel.kind}</span>
                </div>

                <!-- Relative Update Time -->
                <div class="timestamp-box">
                  <Clock size={12} class="time-clock" />
                  <time datetime={rel.latestPublishedAt}>
                    {relativeTime(rel.latestPublishedAt)}
                  </time>
                </div>
              </div>

              <!-- Clickable Chapter Pills List (Newest to Oldest) -->
              <div class="chapter-pills-list">
                {#each sortedChapters as ch, idx (ch.id)}
                  {@const chNum = chapterDisplayNumber(ch)}
                  {@const chTitle = ch.title ? decodeHtmlEntities(ch.title) : ''}
                  <a
                    href="/ler/{ch.id}"
                    class="chapter-pill"
                    class:latest-pill={idx === 0}
                    title={`Ler Capítulo ${chNum}${chTitle ? ` — ${chTitle}` : ''}`}
                  >
                    {#if idx === 0}
                      <span class="pill-dot" aria-hidden="true"></span>
                    {/if}
                    <span class="ch-text">Cap. {chNum}</span>
                  </a>
                {/each}
              </div>
            </div>
          </article>
        {/each}
      </div>

      <!-- Numbered Pagination Section -->
      {#if data.totalPages > 1}
        <nav class="pagination-section" aria-label="Paginação dos lançamentos">
          <div class="pagination-controls">
            <!-- Previous Button -->
            {#if data.currentPage > 1}
              <a
                href={getPageUrl(data.currentPage - 1)}
                class="btn-page-nav prev"
                rel="prev"
                title="Página anterior"
              >
                <ChevronLeft size={16} />
                <span>Anterior</span>
              </a>
            {:else}
              <span class="btn-page-nav prev disabled" aria-disabled="true">
                <ChevronLeft size={16} />
                <span>Anterior</span>
              </span>
            {/if}

            <!-- Numbered Buttons Cluster -->
            <div class="page-numbers-cluster">
              {#each paginationPages as item, idx (`${item}-${idx}`)}
                {#if typeof item === 'number'}
                  {#if item === data.currentPage}
                    <span class="btn-page-num active" aria-current="page">
                      {item}
                    </span>
                  {:else}
                    <a
                      href={getPageUrl(item)}
                      class="btn-page-num"
                      title="Ir para página {item}"
                    >
                      {item}
                    </a>
                  {/if}
                {:else}
                  <span class="page-ellipsis" aria-hidden="true">{item}</span>
                {/if}
              {/each}
            </div>

            <!-- Next Button -->
            {#if data.currentPage < data.totalPages}
              <a
                href={getPageUrl(data.currentPage + 1)}
                class="btn-page-nav next"
                rel="next"
                title="Próxima página"
              >
                <span>Próxima</span>
                <ChevronRight size={16} />
              </a>
            {:else}
              <span class="btn-page-nav next disabled" aria-disabled="true">
                <span>Próxima</span>
                <ChevronRight size={16} />
              </span>
            {/if}
          </div>

          <div class="pagination-meta">
            Página {data.currentPage} de {data.totalPages}
          </div>
        </nav>
      {/if}
    {:else if data.loadError}
      <!-- Error Degraded State -->
      <div class="error-box" role="alert">
        <AlertTriangle size={36} class="alert-icon" />
        <h3>Não foi possível carregar os lançamentos</h3>
        <p>Houve uma instabilidade temporária ao consultar os dados. Tente recarregar a página.</p>
        <button type="button" class="btn-retry" onclick={() => window.location.reload()}>
          <RefreshCw size={16} />
          <span>Tentar novamente</span>
        </button>
      </div>
    {:else}
      <!-- Empty State -->
      <div class="empty-box">
        <BookOpen size={40} class="empty-icon" />
        <h3>Nenhum lançamento encontrado</h3>
        <p>Não há capítulos publicados recentemente nesta categoria.</p>
        {#if data.selectedKind !== 'ALL'}
          <a href="/lancamentos" class="btn-reset-filters">
            <span>Ver todas as categorias</span>
            <ArrowRight size={15} />
          </a>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .lancamentos-wrapper {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    min-height: 100vh;
  }

  .lancamentos-container {
    max-width: 1440px;
    margin: 0 auto;
    padding: 2rem 2rem 5rem;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  /* Breadcrumb Navigation */
  .breadcrumb-nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
    font-size: 0.82rem;
    color: #64748b;
    flex-wrap: wrap;
  }

  .breadcrumb-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: #94a3b8;
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .breadcrumb-link:hover {
    color: #a78bfa;
  }

  .breadcrumb-separator {
    color: #475569;
    user-select: none;
  }

  .breadcrumb-current {
    color: #cbd5e1;
    font-weight: 600;
  }

  .breadcrumb-category,
  .breadcrumb-page {
    color: #a78bfa;
    font-weight: 600;
  }

  /* Header Section */
  .page-header {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  @media (min-width: 768px) {
    .page-header {
      flex-direction: row;
      align-items: flex-end;
      justify-content: space-between;
    }
  }

  .header-titles {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .title-with-bar {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  .title-accent-bar {
    width: 4px;
    height: 1.75rem;
    border-radius: 2px;
    background: linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%);
    box-shadow: 0 0 12px rgba(167, 139, 250, 0.45);
  }

  .page-title {
    margin: 0;
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 1.95rem;
    font-weight: 850;
    color: #ffffff;
    letter-spacing: -0.025em;
  }

  .page-subtitle {
    margin: 0;
    font-size: 0.92rem;
    font-weight: 500;
    color: #8c93a8;
  }

  /* Category Filter Bar */
  .filter-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .filter-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.45rem 1.1rem;
    font-size: 0.86rem;
    font-weight: 650;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .filter-pill:hover {
    background: rgba(124, 58, 237, 0.15);
    border-color: rgba(167, 139, 250, 0.3);
    color: #f1f5f9;
    transform: translateY(-1px);
  }

  .filter-pill.active {
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    color: #ffffff;
    border-color: #8b5cf6;
    font-weight: 750;
    box-shadow: 0 3px 14px rgba(124, 58, 237, 0.4);
  }

  /* Results Meta Bar */
  .results-meta-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.82rem;
    color: #71717a;
    margin-bottom: 1.25rem;
    padding: 0 0.25rem;
  }

  .results-meta-bar strong {
    color: #cbd5e1;
    font-weight: 600;
  }

  /* Releases Grid - 3 cols desktop, 2 tablet, 1 mobile */
  .releases-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.1rem;
    width: 100%;
    min-width: 0;
  }

  @media (max-width: 1100px) {
    .releases-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 680px) {
    .releases-grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 0.85rem;
    }
  }

  /* Release Card */
  .release-row-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.85rem 1rem;
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    min-height: 110px;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .release-row-card:hover {
    background: rgba(18, 22, 36, 0.95);
    border-color: rgba(167, 139, 250, 0.35);
    box-shadow:
      0 10px 28px -6px rgba(0, 0, 0, 0.75),
      0 0 16px -2px rgba(124, 58, 237, 0.18);
    transform: translateY(-2px);
  }

  /* Thumbnail Wrap */
  .cover-thumb-link {
    flex-shrink: 0;
    text-decoration: none;
    outline: none;
  }

  .thumb-wrap {
    position: relative;
    width: 66px;
    height: 94px;
    aspect-ratio: 66 / 94;
    border-radius: 9px;
    overflow: hidden;
    background: #111422;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }

  .thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.25s ease;
  }

  .release-row-card:hover .thumb-img {
    transform: scale(1.05);
  }

  .blurred-cover {
    filter: blur(14px) brightness(0.65);
    transform: scale(1.15);
  }

  .adult-badge-mini {
    position: absolute;
    top: 4px;
    left: 4px;
    background: #dc2626;
    color: #ffffff;
    font-size: 8.5px;
    font-weight: 850;
    padding: 1px 4px;
    border-radius: 4px;
    letter-spacing: 0.04em;
    z-index: 2;
  }

  /* Release Main Content */
  .release-main {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.55rem;
    flex: 1;
    min-width: 0;
  }

  .release-top-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
    min-width: 0;
  }

  .work-title-group {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
    flex: 1;
  }

  .work-link {
    font-size: 0.95rem;
    font-weight: 750;
    color: #f1f5f9;
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    flex: 1 1 auto;
    transition: color 0.15s ease;
  }

  .work-link:hover {
    color: #a78bfa;
  }

  .kind-tag {
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #d8b4fe;
    background: rgba(181, 154, 245, 0.12);
    border: 1px solid rgba(181, 154, 245, 0.25);
    padding: 1px 5px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .timestamp-box {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.73rem;
    font-weight: 500;
    color: #8c93a8;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .timestamp-box :global(.time-clock) {
    color: #64748b;
  }

  /* Chapter Pills List */
  .chapter-pills-list {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
    min-width: 0;
  }

  .chapter-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.32rem 0.68rem;
    min-height: 30px;
    border-radius: 7px;
    font-size: 0.78rem;
    font-weight: 700;
    text-decoration: none;
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.09);
    transition: all 0.2s ease;
  }

  .chapter-pill:hover {
    background: rgba(124, 58, 237, 0.22);
    border-color: rgba(167, 139, 250, 0.45);
    color: #ffffff;
    transform: translateY(-1px);
  }

  .chapter-pill.latest-pill {
    background: rgba(124, 58, 237, 0.14);
    border-color: rgba(139, 92, 246, 0.35);
    color: #e2e8f0;
    font-weight: 750;
  }

  .pill-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 6px #10b981;
  }

  /* Numbered Pagination Section */
  .pagination-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.85rem;
    margin-top: 3.5rem;
    padding-top: 1.5rem;
    border-top: 1px dashed rgba(255, 255, 255, 0.08);
    width: 100%;
  }

  .pagination-controls {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .btn-page-nav {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.55rem 1rem;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.09);
    color: #cbd5e1;
    font-size: 0.86rem;
    font-weight: 650;
    text-decoration: none;
    transition: all 0.2s ease;
    min-height: 38px;
    box-sizing: border-box;
  }

  .btn-page-nav:hover:not(.disabled) {
    background: rgba(124, 58, 237, 0.2);
    border-color: rgba(167, 139, 250, 0.4);
    color: #ffffff;
    transform: translateY(-1px);
  }

  .btn-page-nav.disabled {
    opacity: 0.35;
    pointer-events: none;
    cursor: not-allowed;
    color: #64748b;
  }

  .page-numbers-cluster {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .btn-page-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 38px;
    height: 38px;
    padding: 0 0.45rem;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.09);
    color: #cbd5e1;
    font-size: 0.88rem;
    font-weight: 650;
    text-decoration: none;
    transition: all 0.2s ease;
    box-sizing: border-box;
  }

  .btn-page-num:hover:not(.active) {
    background: rgba(124, 58, 237, 0.2);
    border-color: rgba(167, 139, 250, 0.4);
    color: #ffffff;
    transform: translateY(-1px);
  }

  .btn-page-num.active {
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    border-color: #8b5cf6;
    color: #ffffff;
    font-weight: 800;
    box-shadow: 0 3px 14px rgba(124, 58, 237, 0.4);
    cursor: default;
  }

  .page-ellipsis {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 38px;
    color: #64748b;
    font-weight: 700;
    font-size: 0.95rem;
    user-select: none;
  }

  .pagination-meta {
    font-size: 0.8rem;
    color: #71717a;
  }

  /* Degraded / Error Box */
  .error-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3.5rem 2rem;
    background: #0d101d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    text-align: center;
    gap: 0.75rem;
  }

  .alert-icon {
    color: #f59e0b;
  }

  .error-box h3,
  .empty-box h3 {
    margin: 0;
    color: #f1f5f9;
    font-size: 1.2rem;
    font-weight: 750;
  }

  .error-box p,
  .empty-box p {
    margin: 0;
    color: #8c93a8;
    font-size: 0.9rem;
    max-width: 480px;
  }

  .btn-retry {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1.4rem;
    border-radius: 10px;
    background: rgba(124, 58, 237, 0.2);
    border: 1px solid rgba(139, 92, 246, 0.4);
    color: #c4b5fd;
    font-size: 0.86rem;
    font-weight: 700;
    cursor: pointer;
    margin-top: 0.5rem;
    transition: all 0.2s ease;
  }

  .btn-retry:hover {
    background: #7c3aed;
    color: #ffffff;
    border-color: #8b5cf6;
  }

  /* Empty Box */
  .empty-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    background: #0d101d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    text-align: center;
    gap: 0.85rem;
  }

  .empty-icon {
    color: #64748b;
  }

  .btn-reset-filters {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1.4rem;
    border-radius: 10px;
    background: rgba(124, 58, 237, 0.2);
    border: 1px solid rgba(139, 92, 246, 0.4);
    color: #c4b5fd;
    font-size: 0.86rem;
    font-weight: 700;
    text-decoration: none;
    margin-top: 0.5rem;
    transition: all 0.2s ease;
  }

  .btn-reset-filters:hover {
    background: #7c3aed;
    color: #ffffff;
    border-color: #8b5cf6;
  }

  /* Responsive Rules for Mobile */
  @media (max-width: 680px) {
    .lancamentos-container {
      padding: 1.25rem 1rem calc(5rem + env(safe-area-inset-bottom));
    }

    .breadcrumb-nav {
      font-size: 0.78rem;
      margin-bottom: 0.85rem;
    }

    .page-header {
      gap: 1rem;
      margin-bottom: 1.25rem;
      padding-bottom: 1rem;
    }

    .title-accent-bar {
      height: 1.45rem;
    }

    .page-title {
      font-size: 1.55rem;
    }

    .page-subtitle {
      font-size: 0.84rem;
    }

    .filter-bar {
      flex-wrap: nowrap;
      overflow-x: auto;
      overscroll-behavior-x: contain;
      scrollbar-width: none;
      padding-bottom: 0.25rem;
      width: 100%;
    }

    .filter-bar::-webkit-scrollbar {
      display: none;
    }

    .filter-pill {
      flex: 0 0 auto;
      min-height: 38px;
      padding: 0.4rem 0.95rem;
      font-size: 0.82rem;
    }

    .results-meta-bar {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
      font-size: 0.78rem;
    }

    .release-row-card {
      align-items: flex-start;
      gap: 0.85rem;
      min-height: auto;
      padding: 0.85rem;
      border-radius: 14px;
    }

    .thumb-wrap {
      width: 60px;
      height: 86px;
      min-width: 60px;
      border-radius: 8px;
    }

    .release-main {
      gap: 0.45rem;
      min-width: 0;
      padding-top: 0.05rem;
    }

    .release-top-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.35rem;
    }

    .work-title-group {
      width: 100%;
      flex-wrap: wrap;
      gap: 0.35rem;
    }

    .work-link {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      white-space: normal;
      font-size: 0.95rem;
      line-height: 1.28;
    }

    .kind-tag {
      font-size: 0.62rem;
    }

    .timestamp-box {
      font-size: 0.72rem;
    }

    .chapter-pills-list {
      gap: 0.35rem;
      margin-top: 0.2rem;
    }

    .chapter-pill {
      min-height: 32px;
      padding: 0.28rem 0.55rem;
      font-size: 0.75rem;
    }

    .pagination-controls {
      gap: 0.25rem;
      width: 100%;
    }

    .btn-page-nav {
      padding: 0.45rem 0.75rem;
      font-size: 0.8rem;
      min-height: 36px;
    }

    .btn-page-num {
      min-width: 34px;
      height: 36px;
      font-size: 0.82rem;
    }

    .page-ellipsis {
      min-width: 20px;
      height: 36px;
      font-size: 0.85rem;
    }
  }

  @media (max-width: 380px) {
    .thumb-wrap {
      width: 54px;
      height: 76px;
      min-width: 54px;
    }

    .btn-page-nav span {
      display: none;
    }

    .btn-page-nav {
      padding: 0.45rem 0.6rem;
    }
  }
</style>
