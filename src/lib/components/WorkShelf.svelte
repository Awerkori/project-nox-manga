<script lang="ts">
  import { ChevronLeft, ChevronRight, ArrowRight, AlertTriangle, Eye, ShieldCheck, Loader2 } from '@lucide/svelte';
  import type { Work } from '$lib/types';
  import { kindLabels } from '$lib/types';
  import { page } from '$app/state';

  type Props = {
    title: string;
    subtitle?: string;
    badge?: string;
    viewAllUrl?: string;
    loadMoreSort?: 'latest' | 'most_read';
    works: Work[];
  };

  let { title, subtitle, badge, viewAllUrl, loadMoreSort, works = [] }: Props = $props();

  let currentWorks = $state<Work[]>([]);
  let isExpanded = $state(false);
  let loadingMore = $state(false);
  let hasMore = $state(true);

  $effect(() => {
    currentWorks = [...works];
  });

  let scrollContainer: HTMLDivElement | null = $state(null);
  let canScrollLeft = $state(false);
  let canScrollRight = $state(true);

  function formatViews(n?: number): string {
    if (!n) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.0', '') + 'k';
    return String(n);
  }

  function getScanInfo(work: any) {
    const list = (work.work_scans || []).filter((ws: any) => ws.scans && ws.scans.name);
    if (list.length === 0) {
      if (work.primary_scan?.name) {
        return {
          name: work.primary_scan.name,
          logo_id: work.primary_scan.logo_id,
          is_official: work.primary_scan.is_official,
          extraCount: 0
        };
      }
      return null;
    }
    const primaryRow = list.find((ws: any) => ws.is_primary) || list[0];
    const primary = primaryRow.scans;
    const extraCount = list.length - 1;
    return {
      name: primary.name,
      logo_id: primary.logo_id,
      is_official: primary.is_official,
      extraCount
    };
  }

  function updateScrollState() {
    if (!scrollContainer) return;
    canScrollLeft = scrollContainer.scrollLeft > 10;
    canScrollRight =
      scrollContainer.scrollLeft < scrollContainer.scrollWidth - scrollContainer.clientWidth - 10;
  }

  function scroll(direction: 'left' | 'right') {
    if (!scrollContainer) return;
    const amount = scrollContainer.clientWidth * 0.75;
    scrollContainer.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth'
    });
  }

  async function handleLoadMore() {
    if (!loadMoreSort || loadingMore || !hasMore) return;
    isExpanded = true;
    loadingMore = true;
    try {
      const res = await fetch(`/api/works?sort=${loadMoreSort}&offset=${currentWorks.length}&limit=8`);
      if (!res.ok) throw new Error('Falha ao carregar mais obras');
      const data = await res.json();
      const newItems: Work[] = data.works || [];
      if (newItems.length === 0) {
        hasMore = false;
      } else {
        const existingIds = new Set(currentWorks.map((w) => w.id));
        const uniqueItems = newItems.filter((w) => !existingIds.has(w.id));
        if (uniqueItems.length === 0 || !data.hasMore) {
          hasMore = false;
        }
        currentWorks = [...currentWorks, ...uniqueItems];
      }
    } catch (err) {
      console.error(err);
    } finally {
      loadingMore = false;
    }
  }

  function toggleExpand() {
    if (!isExpanded) {
      handleLoadMore();
    } else {
      isExpanded = false;
    }
  }
</script>

{#if currentWorks.length > 0}
  <section class="shelf-section">
    <div class="shelf-header">
      <div class="title-cluster">
        {#if badge}
          <span class="shelf-badge">{badge}</span>
        {/if}
        <h2 class="shelf-title">{title}</h2>
        {#if subtitle}
          <span class="shelf-subtitle">{subtitle}</span>
        {/if}
      </div>

      <div class="shelf-actions">
        {#if loadMoreSort}
          <button
            type="button"
            class="expand-inline-btn"
            onclick={toggleExpand}
            disabled={loadingMore}
            aria-label={isExpanded ? 'Recolher estante' : 'Carregar mais obras nesta seção'}
          >
            {#if loadingMore}
              <Loader2 size={13} class="spin" />
              <span>Carregando...</span>
            {:else if isExpanded}
              <span>Recolher</span>
            {:else}
              <span>Ver mais</span>
              <ArrowRight size={13} />
            {/if}
          </button>
        {/if}

        {#if viewAllUrl && !isExpanded}
          <a href={viewAllUrl} class="view-all-link">
            <span>Ver catálogo</span>
            <ArrowRight size={14} />
          </a>
        {/if}

        {#if !isExpanded}
          <div class="shelf-nav-arrows">
            <button
              class="shelf-arrow"
              disabled={!canScrollLeft}
              onclick={() => scroll('left')}
              aria-label="Rolar para a esquerda"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              class="shelf-arrow"
              disabled={!canScrollRight}
              onclick={() => scroll('right')}
              aria-label="Rolar para a direita"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        {/if}
      </div>
    </div>

    <div
      class="shelf-scroll-container"
      class:is-expanded={isExpanded}
      bind:this={scrollContainer}
      onscroll={updateScrollState}
    >
      <div class="shelf-track" class:is-expanded={isExpanded}>
        {#each currentWorks as work (work.id)}
          {@const isAdult = work.content_rating === 'ADULT_18'}
          {@const effectiveBlur = isAdult && (page.data?.blurNsfw ?? true)}
          {@const scanInfo = getScanInfo(work)}
          <a href="/obra/{work.slug}" class="shelf-card">
            <div class="card-cover-box">
              {#if work.cover_id}
                <img
                  src="/media/{work.cover_id}"
                  alt={work.title}
                  class="card-img"
                  class:blurred-cover={effectiveBlur}
                  width="200"
                  height="285"
                  loading="lazy"
                  decoding="async"
                />
              {:else}
                <div class="card-placeholder">NOX</div>
              {/if}
              <div class="card-glow"></div>

              <!-- 1. Views: Superior Esquerdo (Top-Left) -->
              <div class="card-views-badge" title="{work.views_total || 0} visualizações">
                <Eye size={10} />
                <span>{formatViews(work.views_total)}</span>
              </div>

              <!-- 2. Type: Superior Direito (Top-Right) -->
              <span class="card-kind-badge">{kindLabels[work.kind] || work.kind || 'Mangá'}</span>

              <!-- 3. +18: Inferior Esquerdo (Bottom-Left) - Único indicador de +18 -->
              {#if isAdult}
                <span class="adult-badge-bottom-left">+18</span>
              {/if}

              <!-- 4. Scan: Inferior Direito (Bottom-Right - sem fallback, múltiplos compactos) -->
              {#if scanInfo}
                <div class="card-scan-badge" title="Traduzido por {scanInfo.name}{scanInfo.extraCount > 0 ? ` (+${scanInfo.extraCount} scans)` : ''}">
                  {#if scanInfo.logo_id}
                    <img src="/media/{scanInfo.logo_id}" alt="" class="scan-badge-logo" />
                  {:else if scanInfo.is_official}
                    <ShieldCheck size={10} />
                  {/if}
                  <span class="scan-badge-name">
                    {scanInfo.name}
                    {#if scanInfo.extraCount > 0}
                      <span class="scan-extra-tag">× +{scanInfo.extraCount}</span>
                    {/if}
                  </span>
                </div>
              {/if}
            </div>
            <div class="card-info">
              <strong class="card-work-title" title={work.title}>{work.title}</strong>
              {#if work.author}
                <span class="card-author">{work.author}</span>
              {/if}
            </div>
          </a>
        {/each}

        {#if !isExpanded && loadMoreSort && hasMore}
          <button
            type="button"
            class="shelf-card-view-more btn-reset"
            onclick={handleLoadMore}
            disabled={loadingMore}
            title="Carregar mais obras e expandir estante"
          >
            <div class="view-more-box">
              <div class="view-more-icon-circle">
                {#if loadingMore}
                  <Loader2 size={20} class="spin" />
                {:else}
                  <ArrowRight size={20} />
                {/if}
              </div>
              <span class="view-more-text">
                {#if loadingMore}
                  Carregando...
                {:else}
                  Ver Mais
                {/if}
              </span>
            </div>
          </button>
        {/if}
      </div>
    </div>

    {#if isExpanded}
      <div class="expanded-footer">
        {#if hasMore}
          <button
            type="button"
            class="btn-load-more-inline"
            onclick={handleLoadMore}
            disabled={loadingMore}
          >
            {#if loadingMore}
              <Loader2 size={16} class="spin" />
              <span>Carregando mais obras...</span>
            {:else}
              <span>Carregar mais obras</span>
              <ArrowRight size={16} />
            {/if}
          </button>
        {:else}
          <span class="all-loaded-text">Todas as obras desta seção foram carregadas.</span>
        {/if}
        <button
          type="button"
          class="btn-collapse"
          onclick={() => (isExpanded = false)}
        >
          Recolher estante ↑
        </button>
      </div>
    {/if}
  </section>
{/if}

<style>
  .shelf-section {
    position: relative;
    margin-bottom: 3.5rem;
    width: 100%;
  }

  .shelf-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.25rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .title-cluster {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .shelf-badge {
    font-size: 0.72rem;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #dfc28d;
  }

  .shelf-title {
    margin: 0;
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 1.6rem;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.02em;
  }

  .shelf-subtitle {
    font-size: 0.85rem;
    font-weight: 500;
    color: #8c93a8;
  }

  .shelf-actions {
    display: flex;
    align-items: center;
    gap: 1.2rem;
  }

  .view-all-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.88rem;
    font-weight: 600;
    color: #8e95a5;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .view-all-link:hover {
    color: #dfc28d;
  }

  .expand-inline-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.8rem;
    border-radius: 8px;
    background: rgba(223, 194, 141, 0.1);
    border: 1px solid rgba(223, 194, 141, 0.3);
    color: #dfc28d;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .expand-inline-btn:hover:not(:disabled) {
    background: rgba(223, 194, 141, 0.2);
    border-color: #dfc28d;
    transform: translateY(-1px);
  }

  .expand-inline-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-reset {
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
    text-align: inherit;
  }

  .view-more-box.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    border-style: solid;
    border-color: rgba(255, 255, 255, 0.05);
  }

  :global(.spin) {
    animation: spinAnimation 1s linear infinite;
  }

  @keyframes spinAnimation {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .shelf-nav-arrows {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .shelf-arrow {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.09);
    color: #c5cbd8;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .shelf-arrow:hover:not(:disabled) {
    background: rgba(223, 194, 141, 0.12);
    border-color: rgba(223, 194, 141, 0.35);
    color: #dfc28d;
  }

  .shelf-arrow:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }

  .shelf-scroll-container {
    overflow-x: auto;
    scroll-behavior: smooth;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    -ms-overflow-style: none;
    margin: 0 -0.5rem;
    padding: 0.5rem;
  }

  .shelf-scroll-container::-webkit-scrollbar {
    display: none;
  }

  .shelf-track {
    display: flex;
    gap: 1.4rem;
    width: max-content;
  }

  .shelf-scroll-container.is-expanded {
    overflow-x: visible;
    scroll-snap-type: none;
    margin: 0;
    padding: 0;
  }

  .shelf-track.is-expanded {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1.25rem;
    width: 100%;
  }

  .shelf-track.is-expanded .shelf-card {
    width: 100%;
  }

  .shelf-track.is-expanded .card-cover-box {
    width: 100%;
    height: auto;
    aspect-ratio: 200 / 285;
  }

  .shelf-track.is-expanded .card-img {
    width: 100%;
    height: 100%;
  }

  .shelf-card {
    display: flex;
    flex-direction: column;
    width: 200px;
    scroll-snap-align: start;
    text-decoration: none;
    outline: none;
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .shelf-card:hover {
    transform: translateY(-5px);
  }

  .card-cover-box {
    position: relative;
    width: 200px;
    height: 285px;
    border-radius: 12px;
    overflow: hidden;
    background: #11131c;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.65);
    transition: border-color 0.25s ease, box-shadow 0.25s ease;
  }

  .shelf-card:hover .card-cover-box {
    border-color: rgba(223, 194, 141, 0.4);
    box-shadow: 0 12px 28px -4px rgba(0, 0, 0, 0.85), 0 0 20px -2px rgba(223, 194, 141, 0.22);
  }

  .card-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .card-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Manrope', sans-serif;
    font-weight: 800;
    color: #dfc28d;
    background: #161826;
  }

  .card-glow {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 60%, rgba(6, 7, 12, 0.85) 100%);
    pointer-events: none;
  }

  .card-views-badge {
    position: absolute;
    top: 9px;
    left: 9px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    background: rgba(6, 7, 12, 0.82);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: #cbd5e1;
    font-size: 0.68rem;
    font-weight: 700;
    z-index: 4;
  }

  .card-kind-badge {
    position: absolute;
    top: 9px;
    right: 9px;
    padding: 0.22rem 0.55rem;
    border-radius: 6px;
    background: rgba(6, 7, 12, 0.82);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: #dfc28d;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    z-index: 4;
  }

  .adult-badge-bottom-left {
    position: absolute;
    bottom: 9px;
    left: 9px;
    padding: 0.2rem 0.48rem;
    border-radius: 5px;
    background: #dc2626;
    color: #ffffff;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    box-shadow: 0 2px 8px rgba(220, 38, 38, 0.6);
    z-index: 4;
  }

  .card-scan-badge {
    position: absolute;
    bottom: 9px;
    right: 9px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    background: rgba(6, 7, 12, 0.88);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(139, 92, 246, 0.35);
    color: #c4b5fd;
    font-size: 0.66rem;
    font-weight: 600;
    max-width: 120px;
    z-index: 4;
  }

  .scan-badge-logo {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    object-fit: cover;
    flex-shrink: 0;
  }

  .scan-badge-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .shelf-card-view-more {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 140px;
    text-decoration: none;
    outline: none;
    scroll-snap-align: start;
    flex-shrink: 0;
  }

  .view-more-box {
    width: 100%;
    height: 285px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.12);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: #94a3b8;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .view-more-box:hover {
    background: rgba(223, 194, 141, 0.06);
    border-color: rgba(223, 194, 141, 0.35);
    color: #dfc28d;
    transform: translateY(-4px);
  }

  .view-more-icon-circle {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.25s ease;
  }

  .view-more-box:hover .view-more-icon-circle {
    transform: translateX(3px);
    background: rgba(223, 194, 141, 0.2);
  }

  .view-more-text {
    font-size: 0.85rem;
    font-weight: 700;
  }

  .card-info {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-top: 0.8rem;
  }

  .card-work-title {
    color: #eef1f8;
    font-size: 0.96rem;
    font-weight: 700;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.2s ease;
  }

  .shelf-card:hover .card-work-title {
    color: #dfc28d;
  }

  .card-author {
    color: #7b8396;
    font-size: 0.8rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: 640px) {
    .shelf-card {
      width: 145px;
    }

    .card-cover-box {
      width: 145px;
      height: 206px;
    }

    .shelf-title {
      font-size: 1.3rem;
    }

    .shelf-nav-arrows {
      display: none;
    }

    .shelf-track.is-expanded {
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
    }

    .shelf-track.is-expanded .card-cover-box {
      width: 100%;
      height: auto;
      aspect-ratio: 145 / 206;
    }
  }

  .scan-extra-tag {
    font-size: 0.6rem;
    color: #dfc28d;
    font-weight: 700;
    margin-left: 2px;
  }

  .expanded-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px dashed rgba(255, 255, 255, 0.08);
  }

  .btn-load-more-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1.4rem;
    border-radius: 999px;
    background: rgba(223, 194, 141, 0.14);
    border: 1px solid rgba(223, 194, 141, 0.35);
    color: #dfc28d;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-load-more-inline:hover:not(:disabled) {
    background: rgba(223, 194, 141, 0.25);
    border-color: #dfc28d;
    color: #fff;
    transform: translateY(-1px);
  }

  .btn-collapse {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0.3rem 0.6rem;
    transition: color 0.15s ease;
  }

  .btn-collapse:hover {
    color: #e2e8f0;
    text-decoration: underline;
  }

  .all-loaded-text {
    font-size: 0.8rem;
    color: #64748b;
    font-style: italic;
  }

  .blurred-cover {
    filter: blur(18px) brightness(0.65);
    transform: scale(1.12);
  }
</style>
