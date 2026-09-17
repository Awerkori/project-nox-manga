<script lang="ts">
  import { Search, Globe, ShieldCheck, BookOpen, Layers, ArrowRight, Sparkles, MessageSquare, Star, UserPlus } from "@lucide/svelte";
  import DiscordIcon from "$lib/components/icons/DiscordIcon.svelte";
  import FluxerIcon from "$lib/components/icons/FluxerIcon.svelte";

  let { data } = $props();

  let searchQuery = $state("");
  let filterTab = $state<"all" | "official" | "partner" | "recruiting">("all");

  let filteredScans = $derived(
    (data.scans || []).filter((s: any) => {
      // Filter tab
      if (filterTab === "official" && !s.isOfficial) return false;
      if (filterTab === "partner" && s.isOfficial) return false;
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
  let recruitingCount = $derived((data.scans || []).filter((s: any) => s.isRecruiting).length);
</script>

<svelte:head>
  <title>Scans & Grupos de Traduo | Project Nox</title>
  <meta
    name="description"
    content="Conhea os grupos parceiros e a equipe editorial oficial responsvel pelas tradues e lanamentos no Project Nox."
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
          Descubra as equipes editoriais e os grupos independentes que trazem as melhores tradues para a comunidade do Project Nox.
        </p>

        <!-- Search Bar -->
        <div class="search-box">
          <Search size={18} class="search-icon" />
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Buscar por nome, descrio ou vaga aberta..."
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
            class="filter-chip"
            class:active={filterTab === "official"}
            onclick={() => (filterTab = "official")}
          >
            <Star size={13} />
            <span>Oficiais</span>
          </button>
          <button
            type="button"
            class="filter-chip"
            class:active={filterTab === "partner"}
            onclick={() => (filterTab = "partner")}
          >
            <span>Parceiras</span>
          </button>
          <button
            type="button"
            class="filter-chip"
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
          <div class="cta-icon-wrap">
            <ShieldCheck size={26} />
          </div>
          <h2 class="cta-title">Tem um grupo de scan?</h2>
          <p class="cta-text">
            Publique suas obras com atribuio real de direitos, pgina dedicada, mtricas e sistema prprio de recrutamento.
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
            <article class="scan-card" class:official={scan.isOfficial}>
              <!-- Card Banner Header -->
              <div class="card-banner">
                {#if scan.bannerId}
                  <img src="/media/{scan.bannerId}" alt="Banner de {scan.name}" class="banner-img" loading="lazy" />
                  <div class="banner-gradient"></div>
                {:else}
                  <div class="banner-placeholder" class:official-bg={scan.isOfficial}></div>
                {/if}
              </div>

              <!-- Card Body (z-index: 2 ensures logo never gets clipped by banner) -->
              <div class="card-body">
                <!-- Avatar Row -->
                <div class="avatar-row">
                  <div class="logo-wrap" class:official-border={scan.isOfficial}>
                    {#if scan.logoId}
                      <img src="/media/{scan.logoId}" alt="Logo de {scan.name}" class="logo-img" />
                    {:else}
                      <div class="logo-placeholder" class:official-logo={scan.isOfficial}>
                        {scan.name.charAt(0).toUpperCase()}
                      </div>
                    {/if}
                  </div>

                  <div class="badges-cluster">
                    {#if scan.isOfficial}
                      <span class="badge-official">
                        <Star size={12} fill="#dfc28d" />
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
                    {scan.description || (scan.isOfficial ? "Scan oficial e ncleo editorial do Project Nox." : "Grupo parceiro de traduo e edio no Project Nox.")}
                  </p>
                </div>

                <!-- Open Vacancies Tags if recruiting -->
                {#if scan.isRecruiting && scan.recruitingPositions.length > 0}
                  <div class="recruiting-positions-wrap">
                    <div class="recruiting-label">
                      <UserPlus size={13} />
                      <span>Vagas abertas:</span>
                    </div>
                    <div class="recruiting-tags">
                      {#each scan.recruitingPositions.slice(0, 3) as pos}
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
                  <div class="stat-item" title="Total de obras com participao desta scan">
                    <BookOpen size={14} />
                    <span><strong>{scan.worksCount}</strong> {scan.worksCount === 1 ? "obra" : "obras"}</span>
                  </div>
                  <div class="stat-dot">·</div>
                  <div class="stat-item" title="Total de captulos lanados">
                    <Layers size={14} />
                    <span><strong>{scan.chaptersCount}</strong> {scan.chaptersCount === 1 ? "captulo" : "captulos"}</span>
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
                      <a href="/scans/{scan.slug}#recrutamento" class="btn-apply" title="Ver vagas disponveis">
                        <UserPlus size={13} />
                        <span>Candidatar-se</span>
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
          <h3>No foi possvel carregar as scans agora</h3>
          <p>As equipes e grupos parceiros continuam registrados na plataforma, mas ocorreu uma lentido temporria na conexo. Tente recarregar.</p>
          <button type="button" class="btn-retry" onclick={() => window.location.reload()} style="margin-top: 1rem; padding: 0.5rem 1rem; background: #6366f1; border: none; border-radius: 6px; color: #fff; cursor: pointer;">
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
    padding: 2rem 1.5rem 5rem;
    color: #e2e8f0;
  }

  .scans-container {
    max-width: 1440px;
    margin: 0 auto;
  }

  /* Hero Section */
  .scans-hero {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 2rem;
    align-items: stretch;
    background: radial-gradient(circle at top left, rgba(139, 92, 246, 0.1), transparent 65%),
      linear-gradient(180deg, rgba(17, 21, 37, 0.85) 0%, rgba(10, 13, 23, 0.95) 100%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 2.5rem;
    margin-bottom: 2.5rem;
    backdrop-filter: blur(16px);
  }

  .hero-left {
    display: flex;
    flex-direction: column;
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
    margin-bottom: 0.85rem;
    align-self: flex-start;
  }

  .hero-title {
    font-family: "Manrope", -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 2.25rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.6rem;
    letter-spacing: -0.025em;
  }

  .hero-subtitle {
    font-size: 0.95rem;
    color: #94a3b8;
    line-height: 1.6;
    margin: 0 0 1.5rem;
    max-width: 680px;
  }

  /* Search Box */
  .search-box {
    position: relative;
    display: flex;
    align-items: center;
    max-width: 620px;
    margin-bottom: 1.25rem;
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
    padding: 0.45rem 0.95rem;
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
  }

  .filter-chip.active {
    color: #ffffff;
    background: rgba(139, 92, 246, 0.25);
    border-color: rgba(139, 92, 246, 0.5);
    box-shadow: 0 2px 10px rgba(139, 92, 246, 0.2);
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
    background: linear-gradient(145deg, rgba(30, 27, 75, 0.45) 0%, rgba(17, 21, 37, 0.9) 100%);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 16px;
    padding: 1.6rem;
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

  .cta-icon-wrap {
    width: 46px;
    height: 46px;
    border-radius: 12px;
    background: rgba(139, 92, 246, 0.2);
    border: 1px solid rgba(139, 92, 246, 0.35);
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
    line-height: 1.55;
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

  /* Grid & Cards */
  .scans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 1.75rem;
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
  }

  .scan-card:hover {
    transform: translateY(-4px);
    border-color: rgba(139, 92, 246, 0.4);
    box-shadow: 0 16px 36px -10px rgba(0, 0, 0, 0.8), 0 0 24px -4px rgba(139, 92, 246, 0.2);
  }

  .scan-card.official {
    border-color: rgba(223, 194, 141, 0.35);
    background: radial-gradient(circle at top right, rgba(223, 194, 141, 0.06), transparent 70%), #0d101a;
  }

  .scan-card.official:hover {
    border-color: rgba(223, 194, 141, 0.65);
    box-shadow: 0 16px 36px -10px rgba(0, 0, 0, 0.8), 0 0 24px -4px rgba(223, 194, 141, 0.2);
  }

  /* Banner */
  .card-banner {
    height: 110px;
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
    background: linear-gradient(135deg, #171b2d 0%, #0d101b 100%);
  }

  .banner-placeholder.official-bg {
    background: linear-gradient(135deg, rgba(60, 48, 25, 0.4) 0%, #0d101b 100%);
  }

  /* Card Body - CRITICAL FIX: relative with z-index: 2 prevents banner clipping the avatar */
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
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(223, 194, 141, 0.4);
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
    gap: 0.4rem;
  }

  .badge-official {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.65rem;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.35);
    border-radius: 8px;
    color: #dfc28d;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.03em;
  }

  .badge-partner {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.65rem;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 8px;
    color: #c4b5fd;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  .badge-recruiting {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.65rem;
    background: rgba(168, 85, 247, 0.16);
    border: 1px solid rgba(168, 85, 247, 0.4);
    border-radius: 8px;
    color: #e9d5ff;
    font-size: 0.72rem;
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

  .scan-card.official .scan-name a:hover {
    color: #dfc28d;
  }

  .scan-desc {
    font-size: 0.86rem;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Recruiting Tags */
  .recruiting-positions-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.65rem 0.85rem;
    background: rgba(168, 85, 247, 0.08);
    border: 1px solid rgba(168, 85, 247, 0.2);
    border-radius: 10px;
    margin-bottom: 0.85rem;
  }

  .recruiting-label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: #d8b4fe;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .recruiting-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .pos-tag {
    font-size: 0.75rem;
    font-weight: 600;
    color: #f3e8ff;
    background: rgba(147, 51, 234, 0.25);
    border: 1px solid rgba(147, 51, 234, 0.4);
    padding: 0.15rem 0.5rem;
    border-radius: 6px;
  }

  .pos-tag.more {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
    color: #cbd5e1;
  }

  /* Stats Bar */
  .stats-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.85rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 10px;
    margin-bottom: 1rem;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
    color: #94a3b8;
  }

  .stat-item strong {
    color: #f1f5f9;
  }

  .stat-dot {
    color: #475569;
    font-size: 0.85rem;
  }

  /* Card Footer */
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
    gap: 0.35rem;
  }

  .social-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    color: #94a3b8;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .social-btn:hover {
    color: #ffffff;
    background: rgba(139, 92, 246, 0.25);
  }

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-apply {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.45rem 0.8rem;
    background: rgba(168, 85, 247, 0.2);
    border: 1px solid rgba(168, 85, 247, 0.4);
    border-radius: 8px;
    color: #e9d5ff;
    font-size: 0.8rem;
    font-weight: 700;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-apply:hover {
    background: rgba(168, 85, 247, 0.35);
    color: #ffffff;
  }

  .btn-view-works {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.45rem 0.85rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #f1f5f9;
    font-size: 0.8rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-view-works:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
    color: #ffffff;
    transform: translateX(2px);
  }

  .scan-card.official .btn-view-works:hover {
    background: rgba(223, 194, 141, 0.2);
    border-color: rgba(223, 194, 141, 0.5);
    color: #dfc28d;
  }

  /* Empty State */
  .empty-state {
    padding: 4.5rem 2rem;
    text-align: center;
    color: #64748b;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 18px;
  }

  .empty-state h3 {
    color: #f1f5f9;
    margin: 1rem 0 0.5rem;
    font-size: 1.15rem;
  }

  /* Responsiveness */
  @media (max-width: 992px) {
    .scans-hero {
      grid-template-columns: 1fr;
      padding: 2rem 1.5rem;
      gap: 1.75rem;
    }
  }

  @media (max-width: 640px) {
    .scans-page {
      padding: 1.25rem 1rem 4rem;
    }

    .hero-title {
      font-size: 1.75rem;
    }

    .hero-subtitle {
      font-size: 0.88rem;
    }

    .scans-grid {
      grid-template-columns: 1fr;
    }

    .avatar-row {
      margin-top: -30px;
    }

    .logo-wrap {
      width: 56px;
      height: 56px;
      border-radius: 14px;
    }

    .action-buttons {
      width: 100%;
      justify-content: flex-end;
    }
  }
</style>
