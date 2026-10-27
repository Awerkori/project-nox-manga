<script lang="ts">
  import { Search, Globe, ShieldCheck, BookOpen, Layers, ArrowRight, Sparkles, Star, UserPlus, Users } from "@lucide/svelte";
  import DiscordIcon from "$lib/components/icons/DiscordIcon.svelte";
  import FluxerIcon from "$lib/components/icons/FluxerIcon.svelte";

  let { data } = $props();

  let searchQuery = $state("");
  let filterTab = $state<"all" | "official" | "partner" | "recruiting">("all");

  let filteredScans = $derived(
    (data.scans || []).filter((s: any) => {
      // Filter tab
      if (filterTab === "official" && !s.is_official) return false;
      if (filterTab === "partner" && s.is_official) return false;
      if (filterTab === "recruiting" && !s.isRecruiting) return false;

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchName = s.name.toLowerCase().includes(q);
      const matchDesc = s.description && s.description.toLowerCase().includes(q);
      const matchPositions = (s.recruitingPositions || []).some((p: string) => p.toLowerCase().includes(q));
      return matchName || matchDesc || matchPositions;
    })
  );

  let totalScans = $derived((data.scans || []).length);
  let officialCount = $derived((data.scans || []).filter((s: any) => s.is_official).length);
  let partnerCount = $derived((data.scans || []).filter((s: any) => !s.is_official).length);
  let recruitingCount = $derived((data.scans || []).filter((s: any) => s.isRecruiting).length);
</script>

<svelte:head>
  <title>Scans & Grupos de Tradução | Project Nox</title>
  <meta
    name="description"
    content="Conheça os grupos parceiros e a equipe editorial oficial responsável pelas traduções e lançamentos no Project Nox."
  />
</svelte:head>

<div class="scans-page">
  <div class="scans-container">
    <!-- Header Hero Section -->
    <header class="scans-hero">
      <div class="hero-left">
        <div class="badge-tag">
          <Sparkles size={14} />
          <span>Comunidade & Equipes</span>
        </div>
        <h1 class="hero-title">Scans & Grupos Parceiros</h1>
        <p class="hero-subtitle">
          Conheça as equipes editoriais e os grupos independentes que trazem as melhores traduções para a comunidade do Project Nox.
        </p>

        <!-- Search Bar -->
        <div class="search-box">
          <Search size={18} class="search-icon" />
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Buscar por nome, descrição ou vaga aberta..."
            class="search-input"
          />
          {#if searchQuery}
            <button class="btn-clear" onclick={() => (searchQuery = "")} type="button">Limpar</button>
          {/if}
        </div>

        <!-- Filter Chips -->
        <div class="filter-chips">
          <button
            type="button"
            class="filter-chip"
            class:active={filterTab === "all"}
            onclick={() => (filterTab = "all")}
          >
            Todas ({totalScans})
          </button>
          <button
            type="button"
            class="filter-chip chip-official"
            class:active={filterTab === "official"}
            onclick={() => (filterTab = "official")}
          >
            <Star size={13} fill={filterTab === "official" ? "#dfc28d" : "currentColor"} />
            <span>Oficiais ({officialCount})</span>
          </button>
          <button
            type="button"
            class="filter-chip"
            class:active={filterTab === "partner"}
            onclick={() => (filterTab = "partner")}
          >
            <span>Parceiras ({partnerCount})</span>
          </button>
          <button
            type="button"
            class="filter-chip chip-recruiting"
            class:active={filterTab === "recruiting"}
            onclick={() => (filterTab = "recruiting")}
          >
            <span class="pulse-dot"></span>
            <span>Recrutando ({recruitingCount})</span>
          </button>
        </div>
      </div>

      <!-- Partner CTA Card -->
      <aside class="partner-cta-card">
        <div class="cta-inner">
          <div class="cta-header-line">
            <div class="cta-icon-wrap">
              <ShieldCheck size={24} />
            </div>
            <span class="cta-badge">Para Equipes</span>
          </div>
          <h2 class="cta-title">Tem um grupo de scan?</h2>
          <p class="cta-text">
            Publique suas obras com atribuição de direitos, página dedicada, métricas reais e ferramentas de recrutamento.
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
        <div class="scans-grid" class:single-item={filteredScans.length === 1}>
          {#each filteredScans as scan (scan.id)}
            <article class="scan-card" class:official={scan.is_official}>
              <!-- Card Banner Header -->
              <div class="card-banner">
                {#if scan.banner_id}
                  <img src="/media/{scan.banner_id}" alt="Banner de {scan.name}" class="banner-img" loading="lazy" />
                  <div class="banner-gradient"></div>
                {:else}
                  <div class="banner-placeholder" class:official-bg={scan.is_official}>
                    <div class="banner-grid-overlay"></div>
                  </div>
                {/if}
              </div>

              <!-- Card Body -->
              <div class="card-body">
                <!-- Avatar Row -->
                <div class="avatar-row">
                  <div class="logo-wrap" class:official-border={scan.is_official}>
                    {#if scan.logo_id}
                      <img src="/media/{scan.logo_id}" alt="Logo de {scan.name}" class="logo-img" />
                    {:else}
                      <div class="logo-placeholder" class:official-logo={scan.is_official}>
                        {scan.name.charAt(0).toUpperCase()}
                      </div>
                    {/if}
                  </div>

                  <div class="badges-cluster">
                    {#if scan.is_official}
                      <span class="badge-official">
                        <Star size={11} fill="#dfc28d" />
                        <span>OFICIAL</span>
                      </span>
                    {:else}
                      <span class="badge-partner">
                        <span>PARCEIRA</span>
                      </span>
                    {/if}

                    {#if scan.isRecruiting}
                      <span class="badge-recruiting" title="Equipe com vagas abertas para novos membros">
                        <span class="pulse-dot"></span>
                        <span>RECRUTANDO</span>
                      </span>
                    {/if}
                  </div>
                </div>

                <!-- Identity Info -->
                <div class="info-cluster">
                  <h3 class="scan-name">
                    <a href="/scans/{scan.slug}">{scan.name}</a>
                  </h3>
                  <p class="scan-desc">
                    {scan.description || (scan.is_official ? "Scan oficial e núcleo editorial do Project Nox." : "Grupo parceiro de tradução e edição no Project Nox.")}
                  </p>
                </div>

                <!-- Open Vacancies Tags if recruiting -->
                {#if scan.isRecruiting && scan.recruitingPositions.length > 0}
                  <div class="recruiting-positions-wrap">
                    <div class="recruiting-label">
                      <UserPlus size={12} />
                      <span>Vagas abertas:</span>
                    </div>
                    <div class="recruiting-tags">
                      {#each scan.recruitingPositions.slice(0, 3) as pos (pos)}
                        <span class="pos-tag">{pos}</span>
                      {/each}
                      {#if scan.recruitingPositions.length > 3}
                        <span class="pos-tag more">+{scan.recruitingPositions.length - 3}</span>
                      {/if}
                    </div>
                  </div>
                {/if}

                <!-- Stats Bar -->
                <div class="stats-row">
                  <div class="stat-item" title="Total de obras com participação desta scan">
                    <BookOpen size={14} />
                    <span><strong>{scan.worksCount}</strong> {scan.worksCount === 1 ? "obra" : "obras"}</span>
                  </div>
                  <div class="stat-dot">·</div>
                  <div class="stat-item" title="Total de capítulos lançados">
                    <Layers size={14} />
                    <span><strong>{scan.chaptersCount}</strong> {scan.chaptersCount === 1 ? "capítulo" : "capítulos"}</span>
                  </div>
                  <div class="stat-dot">·</div>
                  <div class="stat-item" title="Membros da equipe">
                    <Users size={14} />
                    <span><strong>{scan.membersCount}</strong> {scan.membersCount === 1 ? "membro" : "membros"}</span>
                  </div>
                </div>

                <!-- Card Actions Footer -->
                <div class="card-footer">
                  <div class="social-links">
                    {#if scan.discord}
                      <a href={scan.discord} target="_blank" rel="noopener noreferrer" class="social-btn discord" title="Discord oficial">
                        <DiscordIcon size={14} />
                      </a>
                    {/if}
                    {#if scan.fluxer}
                      <a href={scan.fluxer} target="_blank" rel="noopener noreferrer" class="social-btn fluxer" title="Fluxer oficial">
                        <FluxerIcon size={14} />
                      </a>
                    {/if}
                    {#if scan.website}
                      <a href={scan.website} target="_blank" rel="noopener noreferrer" class="social-btn website" title="Website oficial">
                        <Globe size={14} />
                      </a>
                    {/if}
                  </div>

                  <div class="action-buttons">
                    {#if scan.isRecruiting}
                      <a href="/scans/{scan.slug}#recrutamento" class="btn-apply" title="Ver vagas disponíveis">
                        <UserPlus size={13} />
                        <span>Vagas</span>
                      </a>
                    {/if}
                    <a href="/scans/{scan.slug}" class="btn-view-works">
                      <span>Ver Scan</span>
                      <ArrowRight size={13} />
                    </a>
                  </div>
                </div>
              </div>
            </article>
          {/each}
        </div>
      {:else if data.loadError}
        <div class="empty-state degraded-state" role="alert">
          <BookOpen size={42} />
          <h3>Não foi possível carregar as scans agora</h3>
          <p>As equipes e grupos parceiros continuam registrados na plataforma, mas ocorreu uma lentidão temporária na conexão. Tente recarregar.</p>
          <button type="button" class="btn-retry" onclick={() => window.location.reload()}>
            Recarregar scans
          </button>
        </div>
      {:else}
        <div class="empty-state">
          <BookOpen size={42} />
          <h3>Nenhuma scan encontrada</h3>
          <p>Tente ajustar os filtros ou termos da sua busca.</p>
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
    max-width: 1360px;
    margin: 0 auto;
  }

  /* Hero Section */
  .scans-hero {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 2rem;
    align-items: stretch;
    background: radial-gradient(circle at top left, rgba(139, 92, 246, 0.12), transparent 70%),
      linear-gradient(180deg, rgba(19, 23, 39, 0.95) 0%, rgba(11, 14, 25, 0.98) 100%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 2.25rem;
    margin-bottom: 2.5rem;
    backdrop-filter: blur(16px);
    box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
  }

  .hero-left {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .badge-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.85rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 9999px;
    font-size: 0.78rem;
    font-weight: 700;
    color: #c4b5fd;
    margin-bottom: 0.75rem;
    align-self: flex-start;
    letter-spacing: 0.02em;
  }

  .hero-title {
    font-family: "Manrope", -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 2.15rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.5rem;
    letter-spacing: -0.025em;
  }

  .hero-subtitle {
    font-size: 0.95rem;
    color: #94a3b8;
    line-height: 1.6;
    margin: 0 0 1.35rem;
    max-width: 650px;
  }

  /* Search Box */
  .search-box {
    position: relative;
    display: flex;
    align-items: center;
    max-width: 580px;
    margin-bottom: 1.15rem;
  }

  :global(.search-icon) {
    position: absolute;
    left: 14px;
    color: #64748b;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 0.8rem 1rem 0.8rem 2.65rem;
    background: rgba(9, 11, 20, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: #f8fafc;
    font-size: 0.9rem;
    outline: none;
    transition: all 0.2s ease;
  }

  .search-input:focus {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
    background: rgba(13, 16, 28, 0.95);
  }

  .btn-clear {
    position: absolute;
    right: 12px;
    padding: 0.25rem 0.55rem;
    font-size: 0.72rem;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.08);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-clear:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #ffffff;
  }

  /* Filter Chips */
  .filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.42rem 0.9rem;
    border-radius: 10px;
    font-size: 0.82rem;
    font-weight: 600;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .filter-chip:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.14);
  }

  .filter-chip.active {
    color: #ffffff;
    background: rgba(139, 92, 246, 0.22);
    border-color: rgba(139, 92, 246, 0.5);
    box-shadow: 0 2px 10px rgba(139, 92, 246, 0.2);
  }

  .filter-chip.chip-official.active {
    background: rgba(223, 194, 141, 0.16);
    border-color: rgba(223, 194, 141, 0.45);
    color: #dfc28d;
  }

  /* Pulse Dot */
  .pulse-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #a855f7;
    box-shadow: 0 0 8px #a855f7;
    animation: pulse 1.6s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.85); }
  }

  /* Partner CTA Card */
  .partner-cta-card {
    background: linear-gradient(145deg, rgba(30, 27, 75, 0.5) 0%, rgba(15, 18, 32, 0.95) 100%);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 16px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .cta-inner {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    height: 100%;
    justify-content: space-between;
  }

  .cta-header-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .cta-icon-wrap {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(139, 92, 246, 0.18);
    border: 1px solid rgba(139, 92, 246, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c4b5fd;
  }

  .cta-badge {
    font-size: 0.72rem;
    font-weight: 700;
    color: #a78bfa;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: rgba(139, 92, 246, 0.12);
    padding: 0.25rem 0.55rem;
    border-radius: 6px;
  }

  .cta-title {
    font-size: 1.15rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .cta-text {
    font-size: 0.83rem;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0;
  }

  .cta-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.7rem 1.15rem;
    background: #8b5cf6;
    color: #ffffff;
    border-radius: 10px;
    font-size: 0.86rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
    margin-top: 0.4rem;
  }

  .cta-button:hover {
    background: #7c3aed;
    box-shadow: 0 4px 16px rgba(139, 92, 246, 0.4);
    transform: translateY(-1px);
  }

  /* Grid & Cards */
  .scans-grid-wrap {
    width: 100%;
  }

  .scans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 420px));
    gap: 1.75rem;
    justify-content: start;
  }

  /* When only 1 scan is active, prevent it from floating weirdly or stretching to billboard size */
  .scans-grid.single-item {
    max-width: 440px;
  }

  .scan-card {
    background: #0d101a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    position: relative;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .scan-card:hover {
    transform: translateY(-4px);
    border-color: rgba(139, 92, 246, 0.4);
    box-shadow: 0 16px 36px -10px rgba(0, 0, 0, 0.8), 0 0 24px -4px rgba(139, 92, 246, 0.2);
  }

  .scan-card.official {
    border-color: rgba(223, 194, 141, 0.32);
    background: radial-gradient(circle at top right, rgba(223, 194, 141, 0.06), transparent 70%), #0d101a;
  }

  .scan-card.official:hover {
    border-color: rgba(223, 194, 141, 0.6);
    box-shadow: 0 16px 36px -10px rgba(0, 0, 0, 0.8), 0 0 24px -4px rgba(223, 194, 141, 0.2);
  }

  /* Banner */
  .card-banner {
    height: 115px;
    width: 100%;
    position: relative;
    background: #141829;
    overflow: hidden;
  }

  .banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .banner-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 40%, rgba(13, 16, 26, 0.95) 100%);
  }

  .banner-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #161a2e 0%, #0d101b 100%);
    position: relative;
  }

  .banner-placeholder.official-bg {
    background: linear-gradient(135deg, rgba(65, 52, 28, 0.4) 0%, #0d101b 100%);
  }

  .banner-grid-overlay {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px);
    background-size: 16px 16px;
    opacity: 0.6;
  }

  /* Card Body */
  .card-body {
    position: relative;
    z-index: 2;
    padding: 0 1.35rem 1.35rem;
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  /* Avatar Row */
  .avatar-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-top: -34px;
    margin-bottom: 0.85rem;
    gap: 0.75rem;
  }

  .logo-wrap {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: #131728;
    border: 3px solid #0d101a;
    overflow: hidden;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.65);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo-wrap.official-border {
    border-color: #0d101a;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.65), 0 0 0 1.5px rgba(223, 194, 141, 0.5);
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
    color: #f1f5f9;
    font-size: 1.5rem;
    font-weight: 800;
    line-height: 1;
  }

  .logo-placeholder.official-logo {
    background: linear-gradient(135deg, #422006, #1c1917);
    color: #dfc28d;
  }

  .badges-cluster {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.35rem;
  }

  .badge-official {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.22rem 0.6rem;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.35);
    border-radius: 8px;
    color: #dfc28d;
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.03em;
  }

  .badge-partner {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.22rem 0.6rem;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 8px;
    color: #c4b5fd;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  .badge-recruiting {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.22rem 0.6rem;
    background: rgba(168, 85, 247, 0.16);
    border: 1px solid rgba(168, 85, 247, 0.4);
    border-radius: 8px;
    color: #e9d5ff;
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.03em;
  }

  /* Identity */
  .info-cluster {
    margin-bottom: 0.85rem;
    flex: 1;
  }

  .scan-name {
    margin: 0 0 0.35rem;
    font-size: 1.25rem;
    font-weight: 800;
    letter-spacing: -0.01em;
  }

  .scan-name a {
    color: #ffffff;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .scan-name a:hover {
    color: #c4b5fd;
  }

  .scan-desc {
    font-size: 0.85rem;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Recruiting Positions */
  .recruiting-positions-wrap {
    margin-bottom: 0.85rem;
    padding: 0.5rem 0.65rem;
    background: rgba(168, 85, 247, 0.08);
    border: 1px dashed rgba(168, 85, 247, 0.3);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .recruiting-label {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.73rem;
    font-weight: 700;
    color: #d8b4fe;
  }

  .recruiting-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }

  .pos-tag {
    font-size: 0.7rem;
    padding: 0.18rem 0.5rem;
    background: rgba(255, 255, 255, 0.07);
    border-radius: 6px;
    color: #f3e8ff;
    font-weight: 500;
  }

  .pos-tag.more {
    background: rgba(168, 85, 247, 0.2);
    color: #e9d5ff;
    font-weight: 700;
  }

  /* Stats Row */
  .stats-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.65rem 0.85rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    margin-bottom: 1rem;
    font-size: 0.78rem;
    color: #94a3b8;
  }

  .stat-item {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .stat-item strong {
    color: #f1f5f9;
  }

  .stat-dot {
    color: #475569;
    font-weight: 700;
  }

  /* Footer */
  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .social-links {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .social-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .social-btn:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-1px);
  }

  .social-btn.discord:hover {
    color: #5865f2;
    border-color: rgba(88, 101, 242, 0.4);
  }

  .social-btn.fluxer:hover {
    color: #38bdf8;
    border-color: rgba(56, 189, 248, 0.4);
  }

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-apply {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.45rem 0.8rem;
    border-radius: 8px;
    background: rgba(168, 85, 247, 0.18);
    border: 1px solid rgba(168, 85, 247, 0.35);
    color: #e9d5ff;
    font-size: 0.78rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .btn-apply:hover {
    background: rgba(168, 85, 247, 0.3);
    color: #ffffff;
  }

  .btn-view-works {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.45rem 0.95rem;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #f8fafc;
    font-size: 0.82rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-view-works:hover {
    background: #8b5cf6;
    border-color: #8b5cf6;
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  }

  /* Empty / Degraded States */
  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    background: rgba(13, 16, 26, 0.6);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    color: #64748b;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .empty-state h3 {
    font-size: 1.25rem;
    font-weight: 700;
    color: #e2e8f0;
    margin: 0;
  }

  .empty-state p {
    font-size: 0.9rem;
    color: #94a3b8;
    margin: 0;
    max-width: 480px;
  }

  .empty-state.degraded-state {
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.05);
  }

  .btn-retry {
    margin-top: 1rem;
    padding: 0.55rem 1.15rem;
    background: #6366f1;
    border: none;
    border-radius: 8px;
    color: #ffffff;
    font-weight: 600;
    font-size: 0.88rem;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-retry:hover {
    background: #4f46e5;
  }

  /* Responsive Rules */
  @media (max-width: 1024px) {
    .scans-hero {
      grid-template-columns: 1fr;
      padding: 1.75rem;
    }

    .partner-cta-card {
      margin-top: 0.5rem;
    }

    .scans-grid {
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    }
  }

  @media (max-width: 640px) {
    .scans-page {
      padding: 1.25rem 1rem 4rem;
    }

    .scans-hero {
      padding: 1.25rem;
      border-radius: 16px;
      margin-bottom: 1.5rem;
    }

    .hero-title {
      font-size: 1.65rem;
    }

    .hero-subtitle {
      font-size: 0.88rem;
    }

    .scans-grid {
      grid-template-columns: 1fr;
      gap: 1.25rem;
    }

    .scans-grid.single-item {
      max-width: 100%;
    }
  }
</style>
