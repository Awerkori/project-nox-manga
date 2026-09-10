<script lang="ts">
  import { Search, Globe, ShieldCheck, BookOpen, Layers, ArrowRight, Sparkles, MessageSquare } from '@lucide/svelte';

  let { data } = $props();

  let searchQuery = $state('');

  let filteredScans = $derived(
    (data.scans || []).filter((s: any) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) || (s.description && s.description.toLowerCase().includes(q));
    })
  );
</script>

<svelte:head>
  <title>Scans & Grupos de Tradução | Project Nox</title>
  <meta
    name="description"
    content="Conheça os grupos parceiros e a equipe editorial oficial responsável pelas traduções no Project Nox."
  />
</svelte:head>

<div class="scans-page">
  <div class="scans-container">
    <!-- Header Banner -->
    <header class="scans-hero">
      <div class="hero-content">
        <div class="badge-tag">
          <Sparkles size={14} />
          <span>Comunidade & Tradução</span>
        </div>
        <h1 class="hero-title">Scans & Grupos Parceiros</h1>
        <p class="hero-subtitle">
          Conheça as equipes e os tradutores independentes que tornam as obras disponíveis no Project Nox com
          qualidade e dedicação.
        </p>

        <!-- Search Bar -->
        <div class="search-box">
          <Search size={18} class="search-icon" />
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Buscar por nome do grupo ou descrição..."
            class="search-input"
          />
          {#if searchQuery}
            <button class="btn-clear" onclick={() => (searchQuery = '')} type="button">Limpar</button>
          {/if}
        </div>
      </div>

      <!-- Partner CTA -->
      <aside class="partner-cta-card">
        <div class="cta-inner">
          <div class="cta-icon-wrap">
            <ShieldCheck size={24} />
          </div>
          <h2 class="cta-title">Tem um grupo de scan?</h2>
          <p class="cta-text">
            Publique suas obras com atribuição real de direitos, página dedicada e métricas de audiência em tempo real.
          </p>
          <a href="/scan" class="cta-button">
            <span>Acessar Painel de Scan</span>
            <ArrowRight size={15} />
          </a>
        </div>
      </aside>
    </header>

    <!-- Scans Grid -->
    <main class="scans-grid-wrap">
      {#if filteredScans.length > 0}
        <div class="scans-grid">
          {#each filteredScans as scan (scan.id)}
            <article class="scan-card" class:official={scan.is_official}>
              <!-- Card Header / Banner -->
              <div class="card-banner">
                {#if scan.banner_id}
                  <img src="/media/{scan.banner_id}" alt="Banner de {scan.name}" class="banner-img" loading="lazy" />
                {:else}
                  <div class="banner-placeholder"></div>
                {/if}
              </div>

              <!-- Card Body -->
              <div class="card-body">
                <!-- Avatar & Badges -->
                <div class="avatar-row">
                  <div class="logo-wrap">
                    {#if scan.logo_id}
                      <img src="/media/{scan.logo_id}" alt="Logo de {scan.name}" class="logo-img" />
                    {:else}
                      <div class="logo-placeholder">
                        {scan.name.charAt(0).toUpperCase()}
                      </div>
                    {/if}
                  </div>

                  <div class="badges-cluster">
                    {#if scan.is_official}
                      <span class="badge-official">
                        <ShieldCheck size={13} />
                        <span>Oficial</span>
                      </span>
                    {:else}
                      <span class="badge-partner">
                        <Sparkles size={13} />
                        <span>Parceira</span>
                      </span>
                    {/if}
                  </div>
                </div>

                <!-- Info -->
                <div class="info-cluster">
                  <h3 class="scan-name">
                    <a href="/scans/{scan.slug}">{scan.name}</a>
                  </h3>
                  <p class="scan-desc">
                    {scan.description || 'Grupo de tradução ativo no catálogo do Project Nox.'}
                  </p>
                </div>

                <!-- Stats Bar -->
                <div class="stats-row">
                  <div class="stat-item" title="Total de obras traduzidas">
                    <BookOpen size={14} />
                    <span><strong>{scan.worksCount}</strong> {scan.worksCount === 1 ? 'obra' : 'obras'}</span>
                  </div>
                  <div class="stat-item" title="Total de capítulos lançados">
                    <Layers size={14} />
                    <span><strong>{scan.chaptersCount}</strong> {scan.chaptersCount === 1 ? 'cap.' : 'caps.'}</span>
                  </div>
                </div>

                <!-- Footer & Action -->
                <div class="card-footer">
                  <div class="social-links">
                    {#if scan.discord}
                      <a href={scan.discord} target="_blank" rel="noopener noreferrer" class="social-btn" title="Discord">
                        <MessageSquare size={15} />
                      </a>
                    {/if}
                    {#if scan.website}
                      <a href={scan.website} target="_blank" rel="noopener noreferrer" class="social-btn" title="Website">
                        <Globe size={15} />
                      </a>
                    {/if}
                  </div>

                  <a href="/scans/{scan.slug}" class="btn-view-works">
                    <span>Ver Traduções</span>
                    <ArrowRight size={14} />
                  </a>
                </div>
              </div>
            </article>
          {/each}
        </div>
      {:else}
        <div class="empty-state">
          <BookOpen size={40} />
          <h3>Nenhuma scan encontrada</h3>
          <p>Tente ajustar os termos da sua pesquisa.</p>
        </div>
      {/if}
    </main>
  </div>
</div>

<style>
  .scans-page {
    min-height: 100vh;
    padding: 2.5rem 1.5rem 5rem;
    color: #e2e8f0;
  }

  .scans-container {
    max-width: 1440px;
    margin: 0 auto;
  }

  .scans-hero {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 2rem;
    align-items: center;
    background: radial-gradient(circle at top left, rgba(139, 92, 246, 0.12), transparent 70%),
      rgba(14, 17, 29, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 2.5rem;
    margin-bottom: 3rem;
    backdrop-filter: blur(16px);
  }

  .badge-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.85rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 9999px;
    font-size: 0.8rem;
    font-weight: 700;
    color: #c4b5fd;
    margin-bottom: 1rem;
  }

  .hero-title {
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 2.2rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.75rem;
    letter-spacing: -0.02em;
  }

  .hero-subtitle {
    font-size: 1rem;
    color: #94a3b8;
    line-height: 1.6;
    margin: 0 0 1.75rem;
    max-width: 680px;
  }

  .search-box {
    position: relative;
    display: flex;
    align-items: center;
    max-width: 580px;
  }

  :global(.search-icon) {
    position: absolute;
    left: 14px;
    color: #64748b;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 0.85rem 1rem 0.85rem 2.75rem;
    background: rgba(10, 12, 22, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    color: #f8fafc;
    font-size: 0.92rem;
    outline: none;
    transition: all 0.2s ease;
  }

  .search-input:focus {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
  }

  .btn-clear {
    position: absolute;
    right: 12px;
    padding: 0.3rem 0.6rem;
    font-size: 0.75rem;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.08);
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .partner-cta-card {
    background: linear-gradient(135deg, rgba(30, 27, 75, 0.4), rgba(20, 24, 42, 0.8));
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 16px;
    padding: 1.5rem;
  }

  .cta-inner {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .cta-icon-wrap {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: rgba(139, 92, 246, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c4b5fd;
  }

  .cta-title {
    font-size: 1.15rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .cta-text {
    font-size: 0.85rem;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0;
  }

  .cta-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: #8b5cf6;
    color: #ffffff;
    border-radius: 10px;
    font-size: 0.88rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
    margin-top: 0.5rem;
  }

  .cta-button:hover {
    background: #7c3aed;
    box-shadow: 0 4px 16px rgba(139, 92, 246, 0.4);
    transform: translateY(-1px);
  }

  /* Scans Grid */
  .scans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 1.5rem;
  }

  .scan-card {
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .scan-card:hover {
    transform: translateY(-3px);
    border-color: rgba(139, 92, 246, 0.4);
    box-shadow: 0 12px 30px -8px rgba(0, 0, 0, 0.7), 0 0 20px -2px rgba(139, 92, 246, 0.15);
  }

  .scan-card.official {
    border-color: rgba(223, 194, 141, 0.3);
  }

  .scan-card.official:hover {
    border-color: rgba(223, 194, 141, 0.6);
    box-shadow: 0 12px 30px -8px rgba(0, 0, 0, 0.7), 0 0 20px -2px rgba(223, 194, 141, 0.15);
  }

  .card-banner {
    height: 100px;
    width: 100%;
    position: relative;
    background: #141724;
    overflow: hidden;
  }

  .banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .banner-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #181d30 0%, #0d101a 100%);
  }

  .card-body {
    padding: 0 1.25rem 1.25rem;
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .avatar-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-top: -36px;
    margin-bottom: 0.75rem;
  }

  .logo-wrap {
    width: 64px;
    height: 64px;
    border-radius: 14px;
    background: #111422;
    border: 3px solid #0e111d;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    flex-shrink: 0;
  }

  .logo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .logo-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #2e1065, #1e1b4b);
    color: #e2e8f0;
    font-size: 1.5rem;
    font-weight: 800;
  }

  .badges-cluster {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .badge-official {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.6rem;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.35);
    border-radius: 6px;
    color: #dfc28d;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .badge-partner {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.6rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 6px;
    color: #c4b5fd;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .info-cluster {
    margin-bottom: 1rem;
    flex: 1;
  }

  .scan-name {
    margin: 0 0 0.4rem;
    font-size: 1.2rem;
    font-weight: 700;
  }

  .scan-name a {
    color: #ffffff;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .scan-name a:hover {
    color: #dfc28d;
  }

  .scan-desc {
    font-size: 0.85rem;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .stats-row {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 0.65rem 0.85rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
    color: #cbd5e1;
  }

  .stat-item strong {
    color: #ffffff;
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .social-links {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .social-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    color: #94a3b8;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .social-btn:hover {
    color: #ffffff;
    background: rgba(139, 92, 246, 0.25);
  }

  .btn-view-works {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.9rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #e2e8f0;
    font-size: 0.82rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-view-works:hover {
    background: rgba(223, 194, 141, 0.15);
    border-color: rgba(223, 194, 141, 0.4);
    color: #dfc28d;
    transform: translateX(2px);
  }

  .empty-state {
    padding: 4rem 2rem;
    text-align: center;
    color: #64748b;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 16px;
  }

  .empty-state h3 {
    color: #f1f5f9;
    margin: 1rem 0 0.5rem;
  }

  @media (max-width: 960px) {
    .scans-hero {
      grid-template-columns: 1fr;
      padding: 2rem 1.5rem;
    }
  }

  @media (max-width: 640px) {
    .scans-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
