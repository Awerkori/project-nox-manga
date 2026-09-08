<script lang="ts">
  import { ArrowRight, BookOpen, Clock } from '@lucide/svelte';
  import { relativeTime } from '$lib/types';

  type ReleaseItem = {
    workId: string;
    workSlug: string;
    workTitle: string;
    coverId: string | null;
    kind: string;
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
</script>

<section id="lancamentos" class="releases-section">
  <div class="releases-header">
    <div class="title-cluster">
      <h2 class="releases-title">LANÇAMENTOS</h2>
      <span class="releases-subtitle">Capítulos recém-publicados</span>
    </div>

    <a href="/catalogo" class="view-all-link">
      <span>Ver catálogo completo</span>
      <ArrowRight size={14} />
    </a>
  </div>

  {#if releases.length > 0}
    <div class="releases-feed">
      {#each releases as rel (rel.workId)}
        <article class="release-row-card">
          <!-- Mini Cover Thumbnail -->
          <a href="/obra/{rel.workSlug}" class="cover-thumb-link" tabindex="-1">
            {#if rel.coverId}
              <img
                src="/media/{rel.coverId}"
                alt={rel.workTitle}
                class="thumb-img"
                width="68"
                height="96"
                loading="lazy"
                decoding="async"
              />
            {:else}
              <div class="thumb-placeholder">NOX</div>
            {/if}
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

              <!-- Relative Update Time in Upper Right Corner (Kuro Style) -->
              <div class="timestamp-box">
                <Clock size={12} class="time-clock" />
                <time datetime={rel.latestPublishedAt}>
                  {relativeTime(rel.latestPublishedAt)}
                </time>
              </div>
            </div>

            <!-- Clickable Chapter Pills List -->
            <div class="chapter-pills-list">
              {#each rel.chapters as ch, i}
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

  /* Single Wide Column Feed (Kuro Mangás Standard) */
  .releases-feed {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }

  .release-row-card {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 0.85rem 1.25rem;
    background: rgba(14, 16, 26, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    min-height: 106px;
  }

  .release-row-card:hover {
    background: rgba(20, 24, 38, 0.85);
    border-color: rgba(223, 194, 141, 0.25);
    box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.7), 0 0 16px -2px rgba(223, 194, 141, 0.1);
    transform: translateY(-2px);
  }

  .cover-thumb-link {
    flex-shrink: 0;
    text-decoration: none;
    outline: none;
  }

  .thumb-img {
    width: 68px;
    height: 96px;
    object-fit: cover;
    border-radius: 8px;
    display: block;
    background: #11131c;
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition: border-color 0.2s ease, transform 0.2s ease;
  }

  .cover-thumb-link:hover .thumb-img {
    border-color: rgba(223, 194, 141, 0.45);
    transform: scale(1.03);
  }

  .thumb-placeholder {
    width: 68px;
    height: 96px;
    border-radius: 8px;
    background: #161826;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Manrope', sans-serif;
    font-size: 0.85rem;
    font-weight: 800;
    color: #dfc28d;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .release-main {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
    flex: 1;
  }

  .release-top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    min-width: 0;
  }

  .work-title-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
    flex-wrap: wrap;
  }

  .work-link {
    color: #ffffff;
    font-size: 1.05rem;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.2s ease;
    letter-spacing: -0.01em;
  }

  .work-link:hover {
    color: #dfc28d;
  }

  .kind-tag {
    flex-shrink: 0;
    padding: 0.2rem 0.55rem;
    border-radius: 5px;
    background: rgba(181, 154, 245, 0.1);
    border: 1px solid rgba(181, 154, 245, 0.25);
    color: #cbb4ff;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .timestamp-box {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: #7b8396;
    font-size: 0.8rem;
    font-weight: 500;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .chapter-pills-list {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .chapter-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.32rem 0.8rem;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.09);
    color: #d2d8e6;
    font-size: 0.82rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .chapter-pill:hover {
    background: rgba(223, 194, 141, 0.14);
    border-color: rgba(223, 194, 141, 0.45);
    color: #dfc28d;
    transform: translateY(-1px);
    box-shadow: 0 2px 10px rgba(223, 194, 141, 0.18);
  }

  .chapter-pill.latest-pill {
    background: rgba(223, 194, 141, 0.09);
    border-color: rgba(223, 194, 141, 0.32);
    color: #dfc28d;
    font-weight: 700;
  }

  .chapter-pill.latest-pill:hover {
    background: rgba(223, 194, 141, 0.2);
    border-color: rgba(223, 194, 141, 0.6);
    box-shadow: 0 2px 14px rgba(223, 194, 141, 0.28);
  }

  .empty-releases {
    padding: 3rem 1.5rem;
    text-align: center;
    background: rgba(14, 16, 26, 0.4);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: #555c6e;
  }

  .empty-releases h3 {
    margin: 0;
    font-size: 1.1rem;
    color: #c5cbd8;
  }

  .empty-releases p {
    margin: 0;
    color: #7b8396;
    font-size: 0.85rem;
  }

  /* Mobile Rules */
  @media (max-width: 640px) {
    .releases-title {
      font-size: 1.35rem;
    }

    .release-row-card {
      gap: 0.9rem;
      padding: 0.75rem;
      align-items: flex-start;
    }

    .thumb-img,
    .thumb-placeholder {
      width: 56px;
      height: 78px;
    }

    .release-top-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }

    .work-link {
      font-size: 0.95rem;
    }

    .timestamp-box {
      font-size: 0.72rem;
      color: #6a7185;
    }

    .chapter-pill {
      font-size: 0.75rem;
      padding: 0.25rem 0.6rem;
    }
  }
</style>
