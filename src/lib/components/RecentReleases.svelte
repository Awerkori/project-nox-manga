<script lang="ts">
  import { untrack } from "svelte";
  import {
    ArrowRight,
    BookOpen,
    Clock,
    AlertTriangle,
    RefreshCw,
    Loader2
  } from '@lucide/svelte';
  import { relativeTime } from '$lib/types';
  import { page } from '$app/state';
  import { resolveCoverUrl, resolveOriginalCoverUrl } from '$lib/covers';
  import { decodeHtmlEntities } from '$lib/html-entities';
  import { chapterDisplayNumber, compareChapterIdentity } from '$lib/chapter-identity';
  import { deferImage } from '$lib/actions/defer-image';

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
      number: number | string | null;
      display_number?: string | null;
      canonical_chapter_key?: string | null;
      chapter_order_key?: string | null;
      chapter_kind?: string | null;
      edition?: string | null;
      language?: string | null;
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
  let loadingMore = $state(false);
  let hasMore = $state(true);
  let nextCursorTime = $state<string | null>(null);
  let nextCursorId = $state<string | null>(null);

  $effect(() => {
    const current = untrack(() => currentReleases);
    if (releases && releases.length > 0 && releases[0] !== current[0]) {
      currentReleases = [...releases];
      // Seed initial cursor from the last item
      const last = releases[releases.length - 1];
      if (last) {
        nextCursorTime = last.latestPublishedAt;
        const lastCh = last.chapters[last.chapters.length - 1];
        nextCursorId = lastCh?.id || null;
      }
    }
  });

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

  async function loadMoreReleases() {
    if (loadingMore || !hasMore) return;
    loadingMore = true;

    try {
      const url = new URL('/api/releases', window.location.origin);
      url.searchParams.set('limit', '9');
      if (nextCursorTime) url.searchParams.set('cursorTime', nextCursorTime);
      if (nextCursorId) url.searchParams.set('cursorId', nextCursorId);

      const res = await fetch(url.toString(), {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!res.ok) throw new Error('Falha ao carregar lançamentos');
      const data = await res.json();
      const newItems: ReleaseItem[] = data.releases || [];

      if (newItems.length === 0) {
        hasMore = false;
      } else {
        const existingIds = new Set(currentReleases.map((r) => r.workId));
        const unique = newItems.filter((r) => !existingIds.has(r.workId));
        if (unique.length === 0 || !data.hasMore) {
          hasMore = false;
        }
        currentReleases = [...currentReleases, ...unique];
        nextCursorTime = data.nextCursorTime || null;
        nextCursorId = data.nextCursorId || null;
      }
    } catch (err) {
      console.error('Erro ao carregar mais lançamentos:', err);
    } finally {
      loadingMore = false;
    }
  }
</script>

<section id="lancamentos" class="releases-section">
  <div class="releases-header">
    <div class="title-cluster">
      <h2 class="releases-title">
        <span class="title-accent-bar"></span>
        <span>Lançamentos</span>
      </h2>
      <span class="releases-subtitle">Capítulos recém-publicados pelos scans e tradutores</span>
    </div>

    <div class="header-right-tools">
      <a href="/lancamentos" class="view-all-link">
        <span>Ver todos os lançamentos</span>
        <ArrowRight size={14} />
      </a>
    </div>
  </div>

  {#if isStale}
    <div class="stale-notice">
      <RefreshCw size={14} />
      <span>Exibindo lançamentos em cache temporário. Atualizando dados...</span>
    </div>
  {/if}

  {#if currentReleases.length > 0}
    <div class="releases-grid">
      {#each currentReleases as rel, i (rel.workId)}
        {@const isAdult = rel.contentRating === 'ADULT_18'}
        {@const effectiveBlur = isAdult && (page.data?.blurNsfw ?? true)}
        {@const displayedChapters = rel.chapters.slice().sort((a, b) => compareChapterIdentity(b, a)).slice(0, 3)}
        {@const thumbCover = resolveCoverUrl(rel.coverId, rel.workSlug, rel.workId, { size: 'thumb' })}
        {@const isEager = i < 3}
        {@const titleDecoded = decodeHtmlEntities(rel.workTitle)}

        <article class="release-row-card">
          <!-- Mini Cover Thumbnail -->
          <a href="/obra/{rel.workSlug}" class="cover-thumb-link" tabindex="-1">
            <div class="thumb-wrap">
              <img
                use:fallbackCover
                use:deferImage={{ src: isEager ? null : thumbCover }}
                src={isEager ? thumbCover : undefined}
                alt={titleDecoded}
                class="thumb-img"
                class:blurred-cover={effectiveBlur}
                width="68"
                height="94"
                loading={isEager ? "eager" : "lazy"}
                fetchpriority={isEager ? "high" : "auto"}
                decoding="async"
              />
              {#if isAdult}
                <span class="adult-badge-mini">+18</span>
              {/if}
            </div>
          </a>

          <!-- Details & Interactive Chapter Pills -->
          <div class="release-main">
            <!-- Top Row: Title, Kind Tag & Timestamp -->
            <div class="release-top-row">
              <div class="work-title-group">
                <a href="/obra/{rel.workSlug}" class="work-link" title={titleDecoded}>
                  {titleDecoded}
                </a>
                <span class="kind-tag">{rel.kind}</span>
              </div>

              <!-- Relative Update Time -->
              <div class="timestamp-box" title={new Date(rel.latestPublishedAt).toLocaleString('pt-BR')}>
                <Clock size={11} class="time-clock" />
                <time datetime={rel.latestPublishedAt}>
                  {relativeTime(rel.latestPublishedAt)}
                </time>
              </div>
            </div>

            <!-- Clickable Chapter Pills List (Newest to Oldest) -->
            <div class="chapter-pills-row">
              {#each displayedChapters as ch, idx (ch.id)}
                {@const chNum = chapterDisplayNumber(ch)}
                {@const chTitle = ch.title ? decodeHtmlEntities(ch.title) : ''}
                <a
                  href="/ler/{ch.id}"
                  class="chapter-pill"
                  class:latest-pill={idx === 0}
                  title={`Ler Capítulo ${chNum}${chTitle ? ` — ${chTitle}` : ''}`}
                >
                  {#if idx === 0}
                    <span class="pill-dot"></span>
                  {/if}
                  <span class="ch-text">Cap. {chNum}</span>
                </a>
              {/each}
            </div>
          </div>
        </article>
      {/each}
    </div>

    <!-- Progressive Load More Section Aligned with Releases Grid -->
    <div class="releases-footer-tools">
      {#if hasMore}
        <button
          type="button"
          class="btn-load-releases"
          onclick={loadMoreReleases}
          disabled={loadingMore}
        >
          {#if loadingMore}
            <Loader2 size={16} class="spin" />
            <span>Carregando mais lançamentos...</span>
          {:else}
            <span>Carregar mais lançamentos</span>
            <ArrowRight size={15} />
          {/if}
        </button>
      {:else}
        <span class="all-loaded-text">Todos os lançamentos recentes foram carregados.</span>
      {/if}
    </div>
  {:else if loadError}
    <div class="degraded-releases-alert" role="alert">
      <AlertTriangle size={36} class="alert-icon" />
      <h3>Não foi possível carregar os lançamentos agora</h3>
      <p>O catálogo continua preservado. Ocorreu uma lentidão temporária. Tente recarregar.</p>
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
    margin-bottom: 3.5rem;
    width: 100%;
    contain: layout style;
  }

  .releases-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.35rem;
    padding-bottom: 0.85rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .title-cluster {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .releases-title {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.65rem;
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 1.65rem;
    font-weight: 850;
    color: #ffffff;
    letter-spacing: -0.025em;
  }

  .title-accent-bar {
    width: 4px;
    height: 1.35rem;
    border-radius: 2px;
    background: linear-gradient(180deg, #dfc28d 0%, #b89552 100%);
    box-shadow: 0 0 10px rgba(223, 194, 141, 0.4);
  }

  .releases-subtitle {
    font-size: 0.86rem;
    font-weight: 500;
    color: #94a3b8;
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
    color: #94a3b8;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .view-all-link:hover {
    color: #dfc28d;
  }

  .stale-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.55rem 1rem;
    border-radius: 8px;
    background: rgba(223, 194, 141, 0.1);
    border: 1px solid rgba(223, 194, 141, 0.25);
    color: #dfc28d;
    font-size: 0.82rem;
    margin-bottom: 1.25rem;
  }

  /* Grid Feed: 3 columns on desktop, 2 on tablet, 1 on mobile */
  .releases-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.15rem;
    width: 100%;
  }

  /* Release Card Anatomy with Fixed Proportional Structure */
  .release-row-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.85rem 1.1rem;
    background: #0d101d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    min-height: 108px;
    width: 100%;
    box-sizing: border-box;
  }

  .release-row-card:hover {
    background: rgba(18, 22, 36, 0.95);
    border-color: rgba(223, 194, 141, 0.35);
    box-shadow:
      0 10px 28px -6px rgba(0, 0, 0, 0.75),
      0 0 16px -2px rgba(223, 194, 141, 0.15);
    transform: translateY(-3px);
  }

  /* Cover Thumbnail */
  .cover-thumb-link {
    flex-shrink: 0;
    text-decoration: none;
    outline: none;
  }

  .thumb-wrap {
    position: relative;
    width: 66px;
    height: 92px;
    aspect-ratio: 66 / 92;
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

  .adult-badge-mini {
    position: absolute;
    top: 4px;
    left: 4px;
    background: #dc2626;
    color: #ffffff;
    font-size: 8px;
    font-weight: 850;
    padding: 1px 4px;
    border-radius: 3px;
    letter-spacing: 0.04em;
    z-index: 2;
  }

  /* Release Main */
  .release-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .release-top-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.6rem;
  }

  .work-title-group {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
    flex: 1;
  }

  /* Title: Fix Truncation Bug! Uses full available space with ellipsis */
  .work-link {
    flex: 1;
    min-width: 0;
    font-size: 0.94rem;
    font-weight: 750;
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
    font-size: 0.74rem;
    color: #8c93a8;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Chapter Pills List */
  .chapter-pills-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .chapter-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.34rem 0.72rem;
    min-height: 32px;
    border-radius: 7px;
    font-size: 0.8rem;
    font-weight: 700;
    text-decoration: none;
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.09);
    transition: all 0.2s ease;
  }

  .chapter-pill:hover {
    background: rgba(223, 194, 141, 0.15);
    border-color: rgba(223, 194, 141, 0.4);
    color: #dfc28d;
    transform: translateY(-1px);
  }

  .latest-pill {
    background: rgba(223, 194, 141, 0.12);
    border-color: rgba(223, 194, 141, 0.35);
    color: #dfc28d;
    font-weight: 750;
  }

  .pill-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 6px #10b981;
  }

  /* Progressive Load More Section */
  .releases-footer-tools {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.25rem;
    margin-top: 2.25rem;
    padding-top: 1.5rem;
    border-top: 1px dashed rgba(255, 255, 255, 0.08);
    flex-wrap: wrap;
  }

  .btn-load-releases {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.75rem 1.6rem;
    border-radius: 12px;
    background: rgba(223, 194, 141, 0.14);
    border: 1px solid rgba(223, 194, 141, 0.35);
    color: #dfc28d;
    font-size: 0.88rem;
    font-weight: 750;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-load-releases:hover:not(:disabled) {
    background: rgba(223, 194, 141, 0.25);
    border-color: #dfc28d;
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(223, 194, 141, 0.2);
  }



  .all-loaded-text {
    font-size: 0.85rem;
    color: #71717a;
    font-style: italic;
  }

  @media (max-width: 1100px) {
    .releases-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 680px) {
    .releases-section {
      margin-bottom: 2.75rem;
    }

    .releases-header {
      align-items: flex-start;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
    }

    .releases-title {
      font-size: 1.35rem;
    }

    .releases-subtitle {
      font-size: 0.8rem;
    }

    .view-all-link {
      font-size: 0.8rem;
    }

    .releases-grid {
      grid-template-columns: minmax(0, 1fr);
      width: 100%;
      gap: 0.85rem;
    }

    .release-row-card {
      width: 100%;
      min-width: 0;
      max-width: 100%;
      box-sizing: border-box;
      padding: 0.85rem;
      gap: 0.9rem;
      align-items: flex-start;
      min-height: auto;
      border-radius: 14px;
    }

    .thumb-wrap {
      width: 72px;
      height: 104px;
      min-width: 72px;
      aspect-ratio: 72 / 104;
      border-radius: 10px;
    }

    .release-main {
      gap: 0.45rem;
    }

    .release-top-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.35rem;
    }

    .work-title-group {
      width: 100%;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .work-link {
      font-size: 1rem;
      font-weight: 800;
      line-height: 1.32;
      white-space: normal;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      word-break: break-word;
    }

    .kind-tag {
      font-size: 0.68rem;
      padding: 2px 6px;
    }

    .timestamp-box {
      font-size: 0.75rem;
      color: #94a3b8;
    }

    .chapter-pills-row {
      gap: 0.45rem;
      margin-top: 0.35rem;
    }

    .chapter-pill {
      min-height: 38px;
      padding: 0.42rem 0.8rem;
      font-size: 0.84rem;
      font-weight: 750;
      border-radius: 8px;
    }

    .btn-load-releases {
      width: 100%;
      justify-content: center;
      padding: 0.85rem 1.4rem;
      font-size: 0.92rem;
    }
  }

  @media (max-width: 380px) {
    .thumb-wrap {
      width: 66px;
      height: 94px;
      min-width: 66px;
    }

    .work-link {
      font-size: 0.94rem;
    }

    .chapter-pill {
      min-height: 36px;
      padding: 0.38rem 0.65rem;
      font-size: 0.8rem;
    }
  }

  /* Degraded / Empty States */
  .degraded-releases-alert,
  .empty-releases {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 2rem;
    background: #0d101d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    text-align: center;
    gap: 0.75rem;
  }

  .alert-icon {
    color: #f59e0b;
  }

  .degraded-releases-alert h3,
  .empty-releases h3 {
    margin: 0;
    color: #f1f5f9;
    font-size: 1.15rem;
    font-weight: 750;
  }

  .degraded-releases-alert p,
  .empty-releases p {
    margin: 0;
    color: #8c93a8;
    font-size: 0.88rem;
    max-width: 480px;
  }

  .btn-retry {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1.25rem;
    border-radius: 8px;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.35);
    color: #dfc28d;
    font-size: 0.84rem;
    font-weight: 700;
    cursor: pointer;
    margin-top: 0.5rem;
  }

  :global(.spin) {
    animation: spinAnimation 1s linear infinite;
  }

  @keyframes spinAnimation {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .blurred-cover {
    filter: blur(14px) brightness(0.65);
    transform: scale(1.15);
  }
</style>