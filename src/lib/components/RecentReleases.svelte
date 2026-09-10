<script lang="ts">
  import { ArrowRight, BookOpen, Clock, ChevronDown } from '@lucide/svelte';
  import { relativeTime } from '$lib/types';
  import { page } from '$app/state';

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

  type Props = {
    releases: ReleaseItem[];
  };

  let { releases = [] }: Props = $props();

  let visibleCount = $state(12);
  let displayedReleases = $derived(releases.slice(0, visibleCount));
  let hasMore = $derived(releases.length > visibleCount);

  function loadMore() {
    visibleCount += 12;
  }
</script>

<section id="lancamentos" class="releases-section">
  <div class="releases-header">
    <div class="title-cluster">
      <h2 class="releases-title">LANÇAMENTOS</h2>
      <span class="releases-subtitle">Capítulos recém-publicados</span>
    </div>

    <div class="header-right-tools">
      <a href="/catalogo" class="view-all-link">
        <span>Ver catálogo completo</span>
        <ArrowRight size={14} />
      </a>
    </div>
  </div>

  {#if releases.length > 0}
    <div class="releases-grid">
      {#each displayedReleases as rel (rel.workId)}
        {@const isAdult = rel.contentRating === 'ADULT_18'}
        {@const effectiveBlur = isAdult && (page.data?.blurNsfw ?? true)}
        {@const sortedChapters = rel.chapters.slice().sort((a, b) => b.number - a.number)}
        <article class="release-row-card">
          <!-- Mini Cover Thumbnail -->
          <a href="/obra/{rel.workSlug}" class="cover-thumb-link" tabindex="-1">
            <div class="thumb-wrap">
              {#if rel.coverId}
                <img
                  src="/media/{rel.coverId}"
                  alt={rel.workTitle}
                  class="thumb-img"
                  class:blurred-cover={effectiveBlur}
                  width="64"
                  height="90"
                  loading="lazy"
                  decoding="async"
                />
              {:else}
                <div class="thumb-placeholder">NOX</div>
              {/if}
              {#if isAdult}
                <span class="adult-badge-mini">+18</span>
              {/if}
            </div>
          </a>

          <!-- Details & Interactive Chapter Pills -->
          <div class="release-main">
            <div class="release-top-row">
              <div class="work-title-group">
                <a href="/obra/{rel.workSlug}" class="work-link" title={rel.workTitle}>
                  {rel.workTitle}
                </a>
                <span class="kind-tag">{rel.kind}</span>
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
              {#each sortedChapters as ch, i}
                <a
                  href="/ler/{ch.id}"
                  class="chapter-pill"
                  class:latest-pill={i === 0}
                  title={`Ler Capítulo ${ch.number}${ch.title ? ` — ${ch.title}` : ''}`}
                >
                  <span class="ch-text">Cap. {ch.number}</span>
                </a>
              {/each}
            </div>
          </div>
        </article>
      {/each}
    </div>

    {#if hasMore}
      <div class="load-more-wrap">
        <button type="button" class="btn-load-more" onclick={loadMore}>
          <span>Carregar mais lançamentos</span>
          <ChevronDown size={16} />
        </button>
      </div>
    {/if}
  {:else}
    <div class="empty-releases">
      <BookOpen size={36} />
      <h3>Nenhum capítulo lançado recentemente</h3>
      <p>Novos lançamentos aparecerão aqui assim que forem publicados.</p>
    </div>
  {/if}
</section>

<style>
  .releases-section {
    position: relative;
    margin-bottom: 3rem;
    width: 100%;
  }

  .releases-header {
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

  .releases-title {
    margin: 0;
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 1.6rem;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.02em;
  }

  .releases-subtitle {
    font-size: 0.85rem;
    font-weight: 500;
    color: #8c93a8;
  }

  .header-right-tools {
    display: flex;
    align-items: center;
    gap: 1.25rem;
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

  /* Grid Feed */
  .releases-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 1rem;
    width: 100%;
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

  .load-more-wrap {
    display: flex;
    justify-content: center;
    margin-top: 2rem;
  }

  .btn-load-more {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.75rem;
    background: rgba(22, 27, 44, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 9999px;
    color: #e2e8f0;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-load-more:hover {
    background: rgba(30, 36, 60, 0.95);
    border-color: rgba(223, 194, 141, 0.4);
    color: #ffffff;
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
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

  .thumb-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #151828;
    color: #64748b;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.05em;
  }

  .release-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
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
    gap: 0.4rem;
    min-width: 0;
    flex-wrap: wrap;
  }

  .work-link {
    font-size: 0.92rem;
    font-weight: 700;
    color: #f1f5f9;
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
    transition: color 0.15s ease;
  }

  .work-link:hover {
    color: #dfc28d;
  }

  .kind-tag {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #b59af5;
    background: rgba(181, 154, 245, 0.1);
    border: 1px solid rgba(181, 154, 245, 0.2);
    padding: 1px 5px;
    border-radius: 4px;
  }

  .timestamp-box {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.74rem;
    color: #8c93a8;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .timestamp-box :global(svg) {
    color: #71717a;
  }

  .chapter-pills-list {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .chapter-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 600;
    text-decoration: none;
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition: all 0.15s ease;
  }

  .chapter-pill:hover {
    background: rgba(223, 194, 141, 0.12);
    border-color: rgba(223, 194, 141, 0.3);
    color: #dfc28d;
    transform: translateY(-1px);
  }

  .chapter-pill.latest-pill {
    background: rgba(139, 92, 246, 0.12);
    border-color: rgba(139, 92, 246, 0.28);
    color: #c4b5fd;
    font-weight: 700;
  }

  .chapter-pill.latest-pill:hover {
    background: rgba(139, 92, 246, 0.22);
    border-color: #8b5cf6;
    color: #ffffff;
  }

  .empty-releases {
    padding: 3rem 1.5rem;
    text-align: center;
    color: #71717a;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 12px;
  }

  @media (max-width: 640px) {
    .releases-grid {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }
  }
</style>
