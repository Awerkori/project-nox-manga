<script lang="ts">
  import { ChevronLeft, ChevronRight, ArrowRight } from '@lucide/svelte';
  import type { Work } from '$lib/types';

  type Props = {
    title: string;
    subtitle?: string;
    badge?: string;
    viewAllUrl?: string;
    works: Work[];
  };

  let { title, subtitle, badge, viewAllUrl, works = [] }: Props = $props();

  let scrollContainer: HTMLDivElement | null = $state(null);
  let canScrollLeft = $state(false);
  let canScrollRight = $state(true);

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
</script>

{#if works.length > 0}
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
        {#if viewAllUrl}
          <a href={viewAllUrl} class="view-all-link">
            <span>Ver catálogo</span>
            <ArrowRight size={14} />
          </a>
        {/if}

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
      </div>
    </div>

    <div
      class="shelf-scroll-container"
      bind:this={scrollContainer}
      onscroll={updateScrollState}
    >
      <div class="shelf-track">
        {#each works as work (work.id)}
          <a href="/obra/{work.slug}" class="shelf-card">
            <div class="card-cover-box">
              {#if work.cover_id}
                <img
                  src="/media/{work.cover_id}"
                  alt={work.title}
                  class="card-img"
                  width="200"
                  height="285"
                  loading="lazy"
                  decoding="async"
                />
              {:else}
                <div class="card-placeholder">NOX</div>
              {/if}
              <div class="card-glow"></div>
              <span class="card-kind-badge">{work.kind}</span>
            </div>
            <div class="card-info">
              <strong class="card-work-title" title={work.title}>{work.title}</strong>
              {#if work.author}
                <span class="card-author">{work.author}</span>
              {/if}
            </div>
          </a>
        {/each}
      </div>
    </div>
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
  }
</style>
