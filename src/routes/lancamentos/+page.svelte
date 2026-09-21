<script lang="ts">
  import { ArrowRight, BookOpen, Clock, RefreshCw, AlertTriangle, Filter } from '@lucide/svelte';
  import { relativeTime, kindLabels } from '$lib/types';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { resolveCoverUrl } from '$lib/covers';
  import { decodeHtmlEntities } from '$lib/html-entities';

  type ReleaseItem = {
    workId: string;
    workSlug: string;
    workTitle: string;
    coverId: string | null;
    kind: string;
    contentRating?: string;
    latestPublishedAt: string;
    chapters: Array<{
      id: string;
      number: number;
      title: string | null;
      publishedAt: string;
    }>;
  };

  let { data } = $props();

  let selectedKind = $state<string>(data.selectedKind || 'ALL');
  let currentReleases = $state<ReleaseItem[]>(data.releases || []);
  let hasMore = $state<boolean>(data.hasMore);
  let nextCursorTime = $state<string | null>(data.nextCursorTime);
  let nextCursorId = $state<string | null>(data.nextCursorId);
  let loadingMore = $state<boolean>(false);
  let expandedCards = $state<Record<string, boolean>>({});

  function toggleCardExpand(workId: string) {
    expandedCards[workId] = !expandedCards[workId];
  }

  // Sync state when page data updates (e.g. filter change via navigation)
  $effect(() => {
    selectedKind = data.selectedKind || 'ALL';
    currentReleases = data.releases || [];
    hasMore = data.hasMore;
    nextCursorTime = data.nextCursorTime;
    nextCursorId = data.nextCursorId;
  });

  const filterTabs = [
    { key: 'ALL', label: 'Todos' },
    { key: 'MANGA', label: 'Mangá' },
    { key: 'MANHWA', label: 'Manhwa' },
    { key: 'MANHUA', label: 'Manhua' }
  ];

  function handleFilterClick(key: string) {
    if (selectedKind === key) return;
    selectedKind = key;
    const url = new URL(window.location.href);
    if (key === 'ALL') {
      url.searchParams.delete('kind');
    } else {
      url.searchParams.set('kind', key);
    }
    goto(url.toString(), { keepFocus: true, noScroll: true });
  }

  async function handleLoadMore() {
    if (loadingMore || !hasMore || !nextCursorTime) return;
    loadingMore = true;
    try {
      let endpoint = `/api/releases?cursorTime=${encodeURIComponent(nextCursorTime)}&cursorId=${encodeURIComponent(nextCursorId || '')}&limit=24`;
      if (selectedKind !== 'ALL') {
        endpoint += `&kind=${encodeURIComponent(selectedKind)}`;
      }
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Falha ao carregar');
      const json = await res.json();
      const newItems: ReleaseItem[] = json.releases || [];

      if (newItems.length === 0) {
        hasMore = false;
      } else {
        const existingIds = new Set(currentReleases.map((r) => r.workId));
        const uniqueItems = newItems.filter((r) => !existingIds.has(r.workId));
        currentReleases = [...currentReleases, ...uniqueItems];
        nextCursorTime = json.nextCursorTime;
        nextCursorId = json.nextCursorId;
        hasMore = Boolean(json.hasMore && uniqueItems.length > 0);
      }
    } catch (err) {
      console.error('[LOAD MORE ERROR]:', err);
    } finally {
      loadingMore = false;
    }
  }
</script>

<svelte:head>
  <title>Lançamentos — Capítulos Recentes | Project Nox</title>
  <meta name="description" content="Acompanhe os capítulos recém-publicados no Project Nox. Mangás, Manhwas e Manhuas atualizados em tempo real." />
  <link rel="canonical" href="{page.url.origin}/lancamentos" />
</svelte:head>

<div class="lancamentos-wrapper">
  <div class="lancamentos-container">
    <!-- Header Section -->
    <header class="page-header">
      <div class="header-titles">
        <h1 class="page-title">LANÇAMENTOS</h1>
        <p class="page-subtitle">Capítulos publicados recentemente</p>
      </div>

      <!-- Category Filter Tabs -->
      <nav class="filter-bar" aria-label="Filtros de tipo de obra">
        {#each filterTabs as tab}
          <button
            type="button"
            class="filter-pill"
            class:active={selectedKind === tab.key}
            onclick={() => handleFilterClick(tab.key)}
          >
            {tab.label}
          </button>
        {/each}
      </nav>
    </header>

    <!-- Releases Grid -->
    {#if currentReleases.length > 0}
      <div class="releases-grid">
        {#each currentReleases as rel (rel.workId)}
          {@const isAdult = rel.contentRating === 'ADULT_18'}
          {@const effectiveBlur = isAdult && (page.data?.blurNsfw ?? true)}
          {@const sortedChapters = rel.chapters.slice().sort((a, b) => b.number - a.number)}
          {@const isExpanded = Boolean(expandedCards[rel.workId])}
          {@const visibleChapters = isExpanded ? sortedChapters : sortedChapters.slice(0, 3)}
          {@const remainingCount = sortedChapters.length - 3}
          {@const thumbCover = resolveCoverUrl(rel.coverId, rel.workSlug, rel.workId)}
          <article class="release-row-card">
            <!-- Mini Cover Thumbnail -->
            <a href="/obra/{rel.workSlug}" class="cover-thumb-link" tabindex="-1">
              <div class="thumb-wrap">
                <img
                  src={thumbCover}
                  alt={rel.workTitle}
                  class="thumb-img"
                  class:blurred-cover={effectiveBlur}
                  width="64"
                  height="90"
                  loading="lazy"
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
                  <Clock size={11} class="time-clock" />
                  <time datetime={rel.latestPublishedAt}>
                    {relativeTime(rel.latestPublishedAt)}
                  </time>
                </div>
              </div>

              <!-- Clickable Chapter Pills List (Newest to Oldest) -->
              <div class="chapter-pills-list">
                {#each visibleChapters as ch, idx}
                  <a
                    href="/ler/{ch.id}"
                    class="chapter-pill"
                    class:latest-pill={idx === 0}
                    title={`Ler Capítulo ${ch.number}${ch.title ? ` — ${decodeHtmlEntities(ch.title)}` : ''}`}
                  >
                    <span class="ch-text">Cap. {ch.number}</span>
                  </a>
                {/each}
                {#if sortedChapters.length > 3}
                  <button
                    type="button"
                    class="chapter-pill expand-pill"
                    onclick={(e) => { e.preventDefault(); toggleCardExpand(rel.workId); }}
                    title={isExpanded ? "Mostrar menos capítulos" : `Ver mais ${remainingCount} capítulos lançados`}
                  >
                    <span class="ch-text">{isExpanded ? "Menos" : `+${remainingCount} caps`}</span>
                  </button>
                {/if}
              </div>
            </div>
          </article>
        {/each}
      </div>

      <!-- Load More Button -->
      <div class="load-more-container">
        {#if hasMore}
          <button
            type="button"
            class="btn-load-more"
            onclick={handleLoadMore}
            disabled={loadingMore}
          >
            {#if loadingMore}
              <RefreshCw size={16} class="spin" />
              <span>Carregando mais...</span>
            {:else}
              <span>Carregar mais lançamentos</span>
              <ArrowRight size={16} />
            {/if}
          </button>
        {:else if currentReleases.length >= 24}
          <div class="end-indicator">
            <span>Você visualizou todos os lançamentos recentes desta categoria</span>
          </div>
        {/if}
      </div>
    {:else if data.loadError}
      <div class="error-box" role="alert">
        <AlertTriangle size={36} class="alert-icon" />
        <h3>Não foi possível carregar os lançamentos</h3>
        <p>Houve uma instabilidade temporária. Tente recarregar a página em instantes.</p>
        <button type="button" class="btn-retry" onclick={() => window.location.reload()}>
          <RefreshCw size={16} />
          <span>Tentar novamente</span>
        </button>
      </div>
    {:else}
      <div class="empty-box">
        <BookOpen size={40} />
        <h3>Nenhum lançamento encontrado</h3>
        <p>Não há capítulos publicados recentemente nesta categoria.</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .lancamentos-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 100vh;
  }

  .lancamentos-container {
    max-width: 1440px;
    margin: 0 auto;
    padding: 2rem 2rem 5rem;
    width: 100%;
    box-sizing: border-box;
  }

  .page-header {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin-bottom: 2rem;
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
    gap: 0.35rem;
  }

  .page-title {
    margin: 0;
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 2rem;
    font-weight: 850;
    color: #ffffff;
    letter-spacing: -0.02em;
  }

  .page-subtitle {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 500;
    color: #8c93a8;
  }

  /* Filter Navigation Pills */
  .filter-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .filter-pill {
    padding: 0.5rem 1.15rem;
    font-size: 0.88rem;
    font-weight: 600;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .filter-pill:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.15);
  }

  .filter-pill.active {
    background: #dfc28d;
    color: #0b0e17;
    border-color: #dfc28d;
    font-weight: 750;
    box-shadow: 0 2px 10px rgba(223, 194, 141, 0.25);
  }

  /* Grid Layout - 3 columns desktop, 2 tablet, 1 mobile */
  .releases-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    width: 100%;
  }

  @media (max-width: 1024px) {
    .releases-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .releases-grid {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }
  }

  .release-row-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    min-height: 102px;
    width: 100%;
    box-sizing: border-box;
  }

  .release-row-card:hover {
    background: rgba(20, 24, 38, 0.9);
    border-color: rgba(223, 194, 141, 0.3);
    box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.7), 0 0 16px -2px rgba(223, 194, 141, 0.1);
    transform: translateY(-2px);
  }

  .cover-thumb-link {
    flex-shrink: 0;
    text-decoration: none;
    outline: none;
  }

  .thumb-wrap {
    position: relative;
    width: 64px;
    height: 88px;
    border-radius: 8px;
    overflow: hidden;
    background: #11131c;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.2s ease;
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
    font-size: 9px;
    font-weight: 800;
    padding: 1px 4px;
    border-radius: 3px;
    letter-spacing: 0.04em;
    z-index: 2;
  }

  .release-main {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  .release-top-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
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
    font-weight: 700;
    color: #f1f5f9;
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.15s ease;
  }

  .work-link:hover {
    color: #dfc28d;
  }

  .kind-tag {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    color: #94a3b8;
    letter-spacing: 0.02em;
    flex-shrink: 0;
  }

  .timestamp-box {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.72rem;
    font-weight: 500;
    color: #71717a;
    flex-shrink: 0;
  }

  .timestamp-box :global(.time-clock) {
    color: #64748b;
  }

  /* Chapter Pills */
  .chapter-pills-list {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .chapter-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.28rem 0.6rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    text-decoration: none;
    font-size: 0.78rem;
    font-weight: 600;
    color: #cbd5e1;
    transition: all 0.15s ease;
  }

  .chapter-pill:hover {
    background: rgba(223, 194, 141, 0.12);
    border-color: rgba(223, 194, 141, 0.35);
    color: #dfc28d;
    transform: translateY(-1px);
  }

  .chapter-pill.expand-pill {
    cursor: pointer;
    background: rgba(223, 194, 141, 0.1);
    border-color: rgba(223, 194, 141, 0.3);
    color: #dfc28d;
    font-size: 0.74rem;
  }

  .chapter-pill.expand-pill:hover {
    background: rgba(223, 194, 141, 0.22);
    border-color: rgba(223, 194, 141, 0.5);
    color: #fff;
  }

  .chapter-pill.latest-pill {
    background: rgba(223, 194, 141, 0.08);
    border-color: rgba(223, 194, 141, 0.22);
    color: #f1f5f9;
  }

  /* Load More Section */
  .load-more-container {
    display: flex;
    justify-content: center;
    margin-top: 3rem;
    width: 100%;
  }

  .btn-load-more {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.85rem 2rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    color: #f1f5f9;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-load-more:hover:not(:disabled) {
    background: #dfc28d;
    color: #0b0e17;
    border-color: #dfc28d;
    box-shadow: 0 4px 20px rgba(223, 194, 141, 0.25);
    transform: translateY(-2px);
  }

  .btn-load-more:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .end-indicator {
    font-size: 0.88rem;
    color: #64748b;
    font-weight: 500;
    padding: 1rem 0;
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Degraded / Error Box */
  .error-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 3rem 2rem;
    text-align: center;
    background: rgba(239, 68, 68, 0.04);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 16px;
    max-width: 600px;
    margin: 2rem auto;
  }

  .error-box :global(.alert-icon) {
    color: #f87171;
  }

  .error-box h3 {
    margin: 0;
    font-size: 1.25rem;
    color: #f87171;
  }

  .error-box p {
    margin: 0;
    font-size: 0.9rem;
    color: #94a3b8;
  }

  .btn-retry {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    padding: 0.6rem 1.25rem;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: #fca5a5;
    font-weight: 600;
    cursor: pointer;
  }

  .empty-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 4rem 2rem;
    text-align: center;
    color: #64748b;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    margin: 2rem 0;
  }

  .empty-box h3 {
    margin: 0;
    color: #94a3b8;
    font-size: 1.2rem;
  }

  .empty-box p {
    margin: 0;
    font-size: 0.9rem;
  }
</style>
