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
      <span class="releases-badge">CAPÍTULOS RECÉM-SAÍDOS</span>
      <h2 class="releases-title">Lançamentos Recentes</h2>
    </div>

    <a href="/catalogo" class="view-all-link">
      <span>Ver catálogo completo</span>
      <ArrowRight size={14} />
    </a>
  </div>

  {#if releases.length > 0}
    <div class="releases-grid">
      {#each releases as rel (rel.workId)}
        <article class="release-row-card">
          <!-- Cover Thumbnail -->
          <a href="/obra/{rel.workSlug}" class="cover-thumb-link" tabindex="-1">
            {#if rel.coverId}
              <img
                src="/media/{rel.coverId}"
                alt={rel.workTitle}
                class="thumb-img"
                width="64"
                height="88"
                loading="lazy"
                decoding="async"
              />
            {:else}
              <div class="thumb-placeholder">NOX</div>
            {/if}
          </a>

          <!-- Details & Direct Chapter Buttons -->
          <div class="release-body">
            <div class="work-headline">
              <a href="/obra/{rel.workSlug}" class="work-link" title={rel.workTitle}>
                {rel.workTitle}
              </a>
              <span class="kind-tag">{rel.kind}</span>
            </div>

            <!-- Clickable Chapter Pills (Direct to reader) -->
            <div class="chapter-pills-list">
              {#each rel.chapters as ch}
                <a
                  href="/ler/{ch.id}"
                  class="chapter-pill"
                  title={`Ler Capítulo ${ch.number}${ch.title ? ` — ${ch.title}` : ''}`}
                >
                  <span class="ch-text">Cap. {ch.number}</span>
                </a>
              {/each}
            </div>

            <!-- Timestamp -->
            <div class="timestamp-row">
              <Clock size={11} class="time-icon" />
              <time datetime={rel.latestPublishedAt}>
                {relativeTime(rel.latestPublishedAt)}
              </time>
            </div>
          </div>
        </article>
      {/each}
    </div>
  {:else}
    <div class="empty-releases">
      <BookOpen size={36} class="empty-icon" />
      <h3>Nenhum capítulo lançado recentemente</h3>
      <p>Novos lançamentos aparecerão aqui assim que forem publicados.</p>
    </div>
  {/if}
</section>

<style>
  .releases-section {
    position: relative;
    margin-bottom: 3.5rem;
  }

  .releases-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.4rem;
    padding-bottom: 0.8rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .title-cluster {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .releases-badge {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #dfc28d;
  }

  .releases-title {
    margin: 0;
    font-family: 'Cinzel', serif;
    font-size: 1.5rem;
    font-weight: 700;
    color: #f1f3f9;
    letter-spacing: -0.01em;
  }

  .view-all-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: #8e95a5;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .view-all-link:hover {
    color: #dfc28d;
  }

  /* 2-column density grid */
  .releases-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .release-row-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.85rem;
    background: rgba(14, 16, 24, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .release-row-card:hover {
    background: rgba(20, 23, 35, 0.75);
    border-color: rgba(181, 154, 245, 0.2);
    box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.6);
    transform: translateY(-2px);
  }

  .cover-thumb-link {
    flex-shrink: 0;
    text-decoration: none;
    outline: none;
  }

  .thumb-img {
    width: 64px;
    height: 88px;
    object-fit: cover;
    border-radius: 8px;
    display: block;
    background: #11131c;
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition: border-color 0.2s ease, transform 0.2s ease;
  }

  .cover-thumb-link:hover .thumb-img {
    border-color: rgba(223, 194, 141, 0.4);
    transform: scale(1.03);
  }

  .thumb-placeholder {
    width: 64px;
    height: 88px;
    border-radius: 8px;
    background: #161826;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Cinzel', serif;
    font-size: 0.8rem;
    font-weight: 700;
    color: #dfc28d;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .release-body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
    flex: 1;
  }

  .work-headline {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
  }

  .work-link {
    color: #e5e8f0;
    font-size: 0.95rem;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.2s ease;
  }

  .work-link:hover {
    color: #dfc28d;
  }

  .kind-tag {
    flex-shrink: 0;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.05);
    color: #a0a7ba;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .chapter-pills-list {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
  }

  .chapter-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.28rem 0.65rem;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #cbd3e2;
    font-size: 0.78rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .chapter-pill:hover {
    background: rgba(223, 194, 141, 0.12);
    border-color: rgba(223, 194, 141, 0.4);
    color: #dfc28d;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(223, 194, 141, 0.15);
  }

  .timestamp-row {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: #6c7487;
    font-size: 0.72rem;
  }

  .empty-releases {
    padding: 3rem 1.5rem;
    text-align: center;
    background: rgba(14, 16, 24, 0.4);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
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

  @media (max-width: 860px) {
    .releases-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .releases-title {
      font-size: 1.25rem;
    }

    .release-row-card {
      gap: 0.75rem;
      padding: 0.75rem;
    }

    .thumb-img, .thumb-placeholder {
      width: 52px;
      height: 72px;
    }

    .work-link {
      font-size: 0.88rem;
    }

    .chapter-pill {
      font-size: 0.72rem;
      padding: 0.22rem 0.5rem;
    }
  }
</style>
