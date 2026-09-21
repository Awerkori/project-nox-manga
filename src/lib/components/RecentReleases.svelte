<script lang="ts">
  import { untrack } from "svelte";
  import { ArrowRight, ArrowUp, BookOpen, Clock, ChevronDown, AlertTriangle, RefreshCw } from '@lucide/svelte';
  import { relativeTime } from '$lib/types';
  import { page } from '$app/state';
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

  type Props = {
    releases: ReleaseItem[];
    loadError?: boolean;
    isStale?: boolean;
  };

  let { releases = [], loadError = false, isStale = false }: Props = $props();

  let currentReleases = $state<ReleaseItem[]>(releases);

  $effect(() => {
    const current = untrack(() => currentReleases);
    if (releases && releases.length > 0 && releases[0] !== current[0]) {
      currentReleases = [...releases];
    }
  });

  function fallbackCover(node: HTMLImageElement) {
    const onError = () => {
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
</script>

<section id="lancamentos" class="releases-section">
  <div class="releases-header">
    <div class="title-cluster">
      <h2 class="releases-title">LANÇAMENTOS</h2>
      <span class="releases-subtitle">Capítulos recém-publicados</span>
    </div>

    <div class="header-right-tools">
      <a href="/lancamentos" class="view-all-link">
        <span>Ver mais lançamentos</span>
        <ArrowRight size={14} />
      </a>
    </div>
  </div>

  {#if releases.length > 0}
    <div class="releases-grid">
      {#each currentReleases as rel, i (rel.workId)}
        {@const isAdult = rel.contentRating === 'ADULT_18'}
        {@const effectiveBlur = isAdult && (page.data?.blurNsfw ?? true)}
        {@const sortedChapters = rel.chapters.slice().sort((a, b) => b.number - a.number)}
        {@const thumbCover = resolveCoverUrl(rel.coverId, rel.workSlug, rel.workId)}
        <article class="release-row-card">
          <!-- Mini Cover Thumbnail -->
          <a href="/obra/{rel.workSlug}" class="cover-thumb-link" tabindex="-1">
            <div class="thumb-wrap">
              <img
                use:fallbackCover
                src={thumbCover}
                alt={rel.workTitle}
                class="thumb-img"
                class:blurred-cover={effectiveBlur}
                width="64"
                height="90"
                loading={i < 3 ? "eager" : "lazy"}
                fetchpriority={i < 3 ? "high" : "auto"}
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
                  title={`Ler Capítulo ${ch.number}${ch.title ? ` — ${decodeHtmlEntities(ch.title)}` : ''}`}
                >
                  <span class="ch-text">Cap. {ch.number}</span>
                </a>
              {/each}
            </div>
          </div>
        </article>
      {/each}
    </div>
  {:else if loadError}
    <div class="degraded-releases-alert" role="alert">
      <AlertTriangle size={36} class="alert-icon" />
      <h3>Não foi possível carregar os lançamentos agora</h3>
      <p>O catálogo e os capítulos continuam preservados no banco de dados, mas ocorreu uma lentidão temporária na conexão. Tente recarregar.</p>
      <button type="button" class="btn-retry" onclick={() => window.location.reload()}>
        <RefreshCw size={16} />
        <span>Recarregar lançamentos</span>
      </button>
    </div>
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
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
  }

  .view-all-link:hover:not(:disabled) {
    color: #dfc28d;
  }
  
  .view-all-link:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Grid Feed - 3 columns on desktop, 2 on tablet, 1 on mobile */
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

  .spin {
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
    aspect-ratio: 64 / 88;
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

  .stale-notice {
    margin-bottom: 1rem;
    padding: 0.5rem 0.85rem;
    background: rgba(234, 179, 8, 0.08);
    border: 1px solid rgba(234, 179, 8, 0.2);
    border-radius: 8px;
    font-size: 0.82rem;
    color: #fde047;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .degraded-releases-alert {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 3.5rem 1.5rem;
    text-align: center;
    background: rgba(239, 68, 68, 0.04);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 12px;
  }

  .degraded-releases-alert :global(.alert-icon) {
    color: #f87171;
  }

  .degraded-releases-alert h3 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
    color: #f87171;
  }

  .degraded-releases-alert p {
    margin: 0;
    font-size: 0.88rem;
    color: #94a3b8;
    max-width: 480px;
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
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-retry:hover {
    background: rgba(239, 68, 68, 0.25);
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
