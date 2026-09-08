<script lang="ts">
  import { ArrowRight, BookOpen, Clock } from '@lucide/svelte';
  import HeroCarousel from '$lib/components/HeroCarousel.svelte';
  import WorkShelf from '$lib/components/WorkShelf.svelte';
  import RecentReleases from '$lib/components/RecentReleases.svelte';

  let { data } = $props();
</script>

<svelte:head>
  <title>Project Nox — Plataforma de Leitura de Mangás e Manhwas</title>
  <meta
    name="description"
    content="Leia seus mangás e manhwas favoritos no Project Nox com a melhor experiência de leitura, alta densidade e qualidade visual."
  />
</svelte:head>

<div class="home-wrapper">
  <!-- Editorial Hero Carousel (Subtle 3D Cover + Atmospheric Backdrop) -->
  <HeroCarousel works={data.featuredList} continueReading={data.recent} />

  <div class="container home-content">
    <!-- Continue Reading (Only for logged-in readers with active progress) -->
    {#if data.recent && data.recent.length > 0}
      <section class="section-block continue-section">
        <div class="section-header">
          <div class="title-cluster">
            <span class="section-badge"><Clock size={12} /> DE ONDE VOCÊ PAROU</span>
            <h2 class="section-title">Continuar Lendo</h2>
          </div>
          <a href="/historico" class="view-all-link">
            <span>Histórico</span>
            <ArrowRight size={14} />
          </a>
        </div>

        <div class="continue-grid">
          {#each data.recent as item (item.workId)}
            <a href={item.destinationUrl} class="continue-card">
              <div class="continue-thumb">
                {#if item.coverId}
                  <img
                    src="/media/{item.coverId}"
                    alt={item.workTitle}
                    width="64"
                    height="90"
                    class="thumb-img"
                    loading="lazy"
                  />
                {:else}
                  <div class="thumb-placeholder">NOX</div>
                {/if}
              </div>
              <div class="continue-meta">
                <strong class="continue-work-title">{item.workTitle}</strong>
                <span class="continue-ch-info">{item.progressText}</span>
                <span class="continue-cta">{item.actionLabel}</span>
              </div>
            </a>
          {/each}
        </div>
      </section>
    {/if}

    <!-- High Density Recent Releases (Kuro Mangás Style) -->
    <RecentReleases releases={data.recentReleases} />

    <!-- Novas Obras Shelf -->
    {#if data.works && data.works.length > 0}
      <WorkShelf
        title="Obras em Destaque"
        badge="EXPLORE O CATÁLOGO"
        works={data.works}
        viewAllUrl="/catalogo"
      />
    {/if}

    <!-- Popular Works (Strictly shown only if real engagement metrics exist) -->
    {#if data.popularWorks && data.popularWorks.length >= 2}
      <WorkShelf
        title="Mais Populares"
        badge="PREFERIDOS DOS LEITORES"
        works={data.popularWorks}
      />
    {/if}
  </div>
</div>

<style>
  .home-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 100vh;
  }

  .home-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 4rem;
    width: 100%;
  }

  .section-block {
    margin-bottom: 3.5rem;
  }

  .section-header {
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

  .section-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #dfc28d;
  }

  .section-title {
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

  /* Continue Reading Cards */
  .continue-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .continue-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.8rem;
    background: rgba(14, 16, 24, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    text-decoration: none;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .continue-card:hover {
    background: rgba(20, 23, 35, 0.85);
    border-color: rgba(223, 194, 141, 0.3);
    box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.7), 0 0 16px -2px rgba(223, 194, 141, 0.15);
    transform: translateY(-2px);
  }

  .continue-thumb {
    flex-shrink: 0;
    width: 60px;
    height: 84px;
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
  }

  .thumb-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Cinzel', serif;
    font-size: 0.75rem;
    font-weight: 700;
    color: #dfc28d;
    background: #161826;
  }

  .continue-meta {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;
    flex: 1;
  }

  .continue-work-title {
    color: #f1f3f9;
    font-size: 0.95rem;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .continue-ch-info {
    color: #8f97aa;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .continue-cta {
    color: #dfc28d;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    margin-top: 0.1rem;
    display: inline-flex;
    align-items: center;
  }

  .continue-card:hover .continue-cta {
    color: #f1dfba;
  }

  @media (max-width: 640px) {
    .home-content {
      padding: 1.5rem 1rem 3rem;
    }

    .continue-grid {
      grid-template-columns: 1fr;
    }

    .section-title {
      font-size: 1.25rem;
    }
  }
</style>
