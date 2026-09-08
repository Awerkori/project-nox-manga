<script lang="ts">
  import { ArrowRight, Clock } from '@lucide/svelte';
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
  <!-- 1. Editorial Hero Carousel (Large Cover on Left + Full-Bleed Atmospheric Backdrop) -->
  <HeroCarousel works={data.featuredList} continueReading={data.recent} />

  <div class="home-content">
    <!-- 2. Continue Reading (Strictly for authenticated readers with active reading progress) -->
    {#if data.recent && data.recent.length > 0}
      <section class="section-block continue-section">
        <div class="section-header">
          <div class="title-cluster">
            <h2 class="section-title">CONTINUAR LENDO</h2>
            <span class="section-subtitle">De onde você parou</span>
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

    <!-- 3. Novas Obras (Horizontal Shelf of Proportional Covers) -->
    {#if data.works && data.works.length > 0}
      <WorkShelf
        title="Novas Obras"
        subtitle="Adicionadas recentemente ao catálogo"
        works={data.works}
        viewAllUrl="/catalogo"
      />
    {/if}

    <!-- 4. Mais Bem Avaliados (Strictly conditional, requires verified real engagement) -->
    {#if data.popularWorks && data.popularWorks.length >= 2}
      <WorkShelf
        title="Mais Bem Avaliados"
        subtitle="Obras com maior engajamento dos leitores"
        works={data.popularWorks}
      />
    {/if}

    <!-- 5. Lançamentos (Single Wide Column High-Density Feed) -->
    <RecentReleases releases={data.recentReleases} />

    <!-- 6. Explore Catalog CTA -->
    <div class="explore-catalog-banner">
      <div class="explore-copy">
        <span class="eyebrow">TODO O UNIVERSO NOX</span>
        <h2>Encontre sua próxima grande leitura</h2>
        <p class="small muted">
          Explore o catálogo completo com filtros detalhados de formato, status e dezenas de gêneros.
        </p>
      </div>
      <a href="/catalogo" class="button primary explore-cta">
        <span>Encontrar minha próxima leitura</span>
        <ArrowRight size={16} />
      </a>
    </div>
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
    max-width: 1440px;
    margin: 0 auto;
    padding: 1.5rem 2rem 4rem;
    width: 100%;
  }

  .section-block {
    margin-bottom: 3rem;
  }

  .explore-catalog-banner {
    margin-top: 3rem;
    background: linear-gradient(135deg, rgba(29, 19, 46, 0.7) 0%, rgba(14, 10, 22, 0.9) 100%);
    border: 1px solid rgba(168, 85, 247, 0.2);
    border-radius: 16px;
    padding: 2.25rem 2.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
    flex-wrap: wrap;
  }

  .explore-copy h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0.25rem 0 0.5rem;
  }

  .explore-cta {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0.85rem 1.75rem;
    font-weight: 600;
    white-space: nowrap;
    text-decoration: none;
  }

  .section-header {
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

  .section-title {
    margin: 0;
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 1.6rem;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.02em;
  }

  .section-subtitle {
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

  /* Continue Reading Cards */
  .continue-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
    gap: 1rem;
  }

  .continue-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.85rem;
    background: rgba(14, 16, 26, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    text-decoration: none;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .continue-card:hover {
    background: rgba(20, 24, 38, 0.85);
    border-color: rgba(223, 194, 141, 0.35);
    box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.7), 0 0 16px -2px rgba(223, 194, 141, 0.15);
    transform: translateY(-2px);
  }

  .continue-thumb {
    flex-shrink: 0;
    width: 62px;
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
  }

  .thumb-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Manrope', sans-serif;
    font-size: 0.8rem;
    font-weight: 800;
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
    color: #ffffff;
    font-size: 0.96rem;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .continue-ch-info {
    color: #8f97aa;
    font-size: 0.82rem;
    font-weight: 500;
  }

  .continue-cta {
    color: #dfc28d;
    font-size: 0.8rem;
    font-weight: 650;
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
      padding: 1.8rem 1rem 3.5rem;
    }

    .continue-grid {
      grid-template-columns: 1fr;
    }

    .section-title {
      font-size: 1.35rem;
    }
  }
</style>
