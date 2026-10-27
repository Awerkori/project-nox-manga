<script lang="ts">
  import {
    Search,
    Globe,
    ShieldCheck,
    BookOpen,
    Layers,
    ArrowRight,
    Sparkles,
    Star,
    UserPlus,
    Users,
    Compass,
    Briefcase,
    ChevronRight,
    X
  } from "@lucide/svelte";
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

  function getRoleDepartment(roleName: string): string {
    const r = roleName.toLowerCase();
    if (r.includes("trad") || r.includes("trans")) return "Tradução & Localização";
    if (r.includes("rev") || r.includes("proof")) return "Revisão Editorial";
    if (r.includes("clean") || r.includes("redr") || r.includes("raw")) return "Limpeza & Reconstrução";
    if (r.includes("type") || r.includes("diag") || r.includes("letra")) return "Diagramação & Letras";
    if (r.includes("qual") || r.includes("qc")) return "Controle de Qualidade";
    return "Equipe Editorial";
  }
</script>

<svelte:head>
  <title>Scans & Grupos de Tradução | Project Nox</title>
  <meta
    name="description"
    content="Vitrine oficial das equipes de tradução e grupos parceiros que publicam mangás, manhwas e webtoons no Project Nox."
  />
</svelte:head>

<div class="scans-showcase-page">
  <div class="showcase-container">
    <!-- HERO HEADER: Vitrine Editorial de Scans -->
    <header class="showcase-hero">
      <div class="hero-content">
        <div class="hero-top-badge">
          <Sparkles size={13} class="badge-sparkle" />
          <span>HUB EDITORIAL DE SCANS</span>
        </div>

        <h1 class="hero-headline">
          Scans & Grupos <span class="gradient-accent">Parceiros</span>
        </h1>

        <p class="hero-lead">
          Conheça as equipes independentes e o núcleo editorial oficial que dão vida às histórias no Project Nox. Explore catálogos dedicados, acompanhe novos lançamentos e candidate-se às vagas abertas.
        </p>

        <!-- Search & Filter Dock -->
        <div class="command-dock">
          <!-- Search Field -->
          <div class="search-field">
            <Search size={18} class="search-icon" />
            <input
              type="text"
              bind:value={searchQuery}
              placeholder="Buscar por nome, sinopse ou função de vaga..."
              class="search-input"
            />
            {#if searchQuery}
              <button
                class="search-clear-btn"
                onclick={() => (searchQuery = "")}
                type="button"
                aria-label="Limpar busca"
              >
                <X size={15} />
              </button>
            {/if}
          </div>

          <!-- Filter Pills -->
          <nav class="filter-pills" aria-label="Filtros de scans">
            <button
              type="button"
              class="pill-btn"
              class:is-active={filterTab === "all"}
              onclick={() => (filterTab = "all")}
            >
              <Compass size={14} />
              <span>Todas</span>
              <span class="pill-count">{totalScans}</span>
            </button>

            <button
              type="button"
              class="pill-btn pill-official"
              class:is-active={filterTab === "official"}
              onclick={() => (filterTab = "official")}
            >
              <Star size={13} fill={filterTab === "official" ? "#f59e0b" : "currentColor"} />
              <span>Oficiais</span>
              <span class="pill-count">{officialCount}</span>
            </button>

            <button
              type="button"
              class="pill-btn pill-partner"
              class:is-active={filterTab === "partner"}
              onclick={() => (filterTab = "partner")}
            >
              <ShieldCheck size={14} />
              <span>Parceiras</span>
              <span class="pill-count">{partnerCount}</span>
            </button>

            <button
              type="button"
              class="pill-btn pill-recruiting"
              class:is-active={filterTab === "recruiting"}
              onclick={() => (filterTab = "recruiting")}
            >
              <span class="pulse-beacon"></span>
              <span>Com Vagas</span>
              <span class="pill-count">{recruitingCount}</span>
            </button>
          </nav>
        </div>
      </div>

      <!-- Side Card: Para Criadores e Equipes -->
      <aside class="affiliate-card">
        <div class="affiliate-badge">
          <Briefcase size={14} />
          <span>Para Equipes de Tradução</span>
        </div>
        <h2 class="affiliate-title">Tem uma scan e quer publicar no Project Nox?</h2>
        <p class="affiliate-desc">
          Integre sua equipe ao ecossistema do Project Nox. Tenha perfil público oficial, proteção autoral de lançamentos, estatísticas consolidadas e sistema integrado de recrutamento.
        </p>
        <a href="/scan" class="affiliate-action">
          <span>Acessar Painel de Scan</span>
          <ArrowRight size={15} />
        </a>
      </aside>
    </header>

    <!-- MAIN SHOWCASE CONTENT -->
    <main class="showcase-content">
      {#if filteredScans.length > 0}
        <!-- Single Scan Spotlight Showcase (quando há 1 scan ou filtro isolado) -->
        {#if filteredScans.length === 1}
          {@const scan = filteredScans[0]}
          <div class="spotlight-wrapper">
            <div class="spotlight-label-row">
              <span class="spotlight-tag">
                <Star size={13} fill="#f59e0b" color="#f59e0b" />
                <span>SCAN EM DESTAQUE</span>
              </span>
              <span class="spotlight-caption">Página oficial e núcleo de lançamentos</span>
            </div>

            <article class="spotlight-card" class:is-official={scan.is_official}>
              <!-- Banner Header with integrated depth -->
              <div class="spotlight-banner-hero">
                {#if scan.banner_id}
                  <img src="/media/{scan.banner_id}" alt="Banner de {scan.name}" class="spotlight-banner-img" />
                {:else}
                  <div class="spotlight-banner-fallback" class:official-gradient={scan.is_official}></div>
                {/if}
                <div class="spotlight-banner-overlay"></div>

                <!-- Floating Emblem inside Banner -->
                <div class="spotlight-emblem-cluster">
                  <div class="spotlight-logo-frame" class:official-frame={scan.is_official}>
                    {#if scan.logo_id}
                      <img src="/media/{scan.logo_id}" alt="Logo de {scan.name}" class="spotlight-logo-img" />
                    {:else}
                      <div class="spotlight-logo-fallback">
                        {scan.name.charAt(0).toUpperCase()}
                      </div>
                    {/if}
                  </div>

                  <div class="spotlight-header-meta">
                    <div class="spotlight-badge-row">
                      {#if scan.is_official}
                        <span class="seal-official">
                          <Star size={12} fill="#f59e0b" color="#f59e0b" />
                          <span>NÚCLEO OFICIAL DO PROJECT NOX</span>
                        </span>
                      {:else}
                        <span class="seal-partner">
                          <ShieldCheck size={12} />
                          <span>GRUPO PARCEIRO VERIFICADO</span>
                        </span>
                      {/if}

                      {#if scan.isRecruiting}
                        <span class="seal-recruiting">
                          <span class="pulse-beacon green"></span>
                          <span>RECRUTAMENTO ATIVO</span>
                        </span>
                      {/if}
                    </div>

                    <h2 class="spotlight-name">
                      <a href="/scans/{scan.slug}">{scan.name}</a>
                    </h2>
                  </div>
                </div>
              </div>

              <!-- Spotlight Details Body -->
              <div class="spotlight-body">
                <!-- Bio & Socials Row -->
                <div class="spotlight-about-section">
                  <p class="spotlight-bio">
                    {scan.description || (scan.is_official ? "Scan oficial e núcleo editorial de traduções, revisões e diagramação do Project Nox. Responsável por grandes obras e lançamentos diários." : "Grupo independente de tradução e edição associado ao Project Nox.")}
                  </p>

                  <!-- Social Links Bar -->
                  <div class="spotlight-social-bar">
                    <span class="social-label">Canais Oficiais:</span>
                    <div class="social-pills">
                      {#if scan.discord}
                        <a href={scan.discord} target="_blank" rel="noopener noreferrer" class="social-pill discord" title="Discord oficial">
                          <DiscordIcon size={14} />
                          <span>Discord</span>
                        </a>
                      {/if}
                      {#if scan.fluxer}
                        <a href={scan.fluxer} target="_blank" rel="noopener noreferrer" class="social-pill fluxer" title="Fluxer oficial">
                          <FluxerIcon size={14} />
                          <span>Fluxer</span>
                        </a>
                      {/if}
                      {#if scan.website}
                        <a href={scan.website} target="_blank" rel="noopener noreferrer" class="social-pill website" title="Website oficial">
                          <Globe size={14} />
                          <span>Website</span>
                        </a>
                      {/if}
                    </div>
                  </div>
                </div>

                <!-- REDESIGNED RECRUITMENT SECTION: Vagas com estrutura profissional -->
                {#if scan.isRecruiting && scan.recruitingPositions.length > 0}
                  <div class="recruitment-showcase-box">
                    <div class="recruitment-showcase-header">
                      <div class="recruitment-header-left">
                        <div class="beacon-icon-wrap">
                          <Briefcase size={16} />
                        </div>
                        <div>
                          <h3 class="recruitment-showcase-title">Oportunidades em Aberto</h3>
                          <p class="recruitment-showcase-sub">Faça parte da equipe editorial de {scan.name}</p>
                        </div>
                      </div>

                      <a href="/scans/{scan.slug}#recrutamento" class="recruitment-view-all-link">
                        <span>Ver requisitos completos</span>
                        <ChevronRight size={14} />
                      </a>
                    </div>

                    <!-- Grid de Vagas Redesenhado -->
                    <div class="roles-opportunity-grid">
                      {#each scan.recruitingPositions as positionName (positionName)}
                        <a href="/scans/{scan.slug}#recrutamento" class="role-opportunity-card">
                          <div class="role-card-top">
                            <span class="role-dept-tag">{getRoleDepartment(positionName)}</span>
                            <span class="role-status-badge">Vaga Aberta</span>
                          </div>
                          <h4 class="role-card-title">{positionName}</h4>
                          <div class="role-card-bottom">
                            <span class="role-apply-hint">Candidatar-se à vaga</span>
                            <ArrowRight size={13} class="role-arrow-icon" />
                          </div>
                        </a>
                      {/each}
                    </div>
                  </div>
                {/if}

                <!-- Stats & Actions Bar -->
                <div class="spotlight-footer">
                  <!-- Integrated Stats Strip -->
                  <div class="stats-counter-strip">
                    <div class="stat-pill-box">
                      <BookOpen size={16} class="stat-icon" />
                      <div class="stat-meta">
                        <span class="stat-number">{scan.worksCount}</span>
                        <span class="stat-desc">{scan.worksCount === 1 ? "Obra no Catálogo" : "Obras no Catálogo"}</span>
                      </div>
                    </div>

                    <div class="stat-pill-box">
                      <Layers size={16} class="stat-icon" />
                      <div class="stat-meta">
                        <span class="stat-number">{scan.chaptersCount}</span>
                        <span class="stat-desc">{scan.chaptersCount === 1 ? "Capítulo Lançado" : "Capítulos Lançados"}</span>
                      </div>
                    </div>

                    <div class="stat-pill-box">
                      <Users size={16} class="stat-icon" />
                      <div class="stat-meta">
                        <span class="stat-number">{scan.membersCount}</span>
                        <span class="stat-desc">{scan.membersCount === 1 ? "Membro Ativo" : "Membros Ativos"}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Primary Action CTA -->
                  <div class="spotlight-cta-dock">
                    {#if scan.isRecruiting}
                      <a href="/scans/{scan.slug}#recrutamento" class="btn-secondary-vagas">
                        <UserPlus size={15} />
                        <span>Quadro de Vagas</span>
                      </a>
                    {/if}
                    <a href="/scans/{scan.slug}" class="btn-primary-explore">
                      <span>Explorar Perfil & Obras</span>
                      <ArrowRight size={16} />
                    </a>
                  </div>
                </div>
              </div>
            </article>
          </div>

        <!-- Multi-scan grid quando houver 2 ou mais scans -->
        {:else}
          <div class="scans-catalog-grid">
            {#each filteredScans as scan (scan.id)}
              <article class="scan-catalog-card" class:is-official={scan.is_official}>
                <!-- Card Banner -->
                <div class="card-banner-wrap">
                  {#if scan.banner_id}
                    <img src="/media/{scan.banner_id}" alt="Banner de {scan.name}" class="card-banner-img" loading="lazy" />
                  {:else}
                    <div class="card-banner-fallback" class:official-bg={scan.is_official}></div>
                  {/if}
                  <div class="card-banner-overlay"></div>

                  <!-- Badges Top Right -->
                  <div class="card-banner-badges">
                    {#if scan.is_official}
                      <span class="seal-official-small">
                        <Star size={11} fill="#f59e0b" color="#f59e0b" />
                        <span>OFICIAL</span>
                      </span>
                    {:else}
                      <span class="seal-partner-small">
                        <span>PARCEIRA</span>
                      </span>
                    {/if}

                    {#if scan.isRecruiting}
                      <span class="seal-recruiting-small">
                        <span class="pulse-beacon green"></span>
                        <span>VAGAS</span>
                      </span>
                    {/if}
                  </div>
                </div>

                <!-- Card Body -->
                <div class="card-content-body">
                  <!-- Logo Row -->
                  <div class="card-logo-row">
                    <div class="card-logo-frame" class:official-frame={scan.is_official}>
                      {#if scan.logo_id}
                        <img src="/media/{scan.logo_id}" alt="Logo de {scan.name}" class="card-logo-img" />
                      {:else}
                        <div class="card-logo-fallback">
                          {scan.name.charAt(0).toUpperCase()}
                        </div>
                      {/if}
                    </div>

                    <div class="card-title-wrap">
                      <h3 class="card-scan-title">
                        <a href="/scans/{scan.slug}">{scan.name}</a>
                      </h3>
                      <span class="card-type-label">
                        {scan.is_official ? "Scan Oficial do Project Nox" : "Grupo Parceiro de Tradução"}
                      </span>
                    </div>
                  </div>

                  <!-- Bio Text -->
                  <p class="card-bio-text">
                    {scan.description || (scan.is_official ? "Scan oficial responsável por traduções de alta qualidade e lançamentos contínuos." : "Equipe independente parceira de tradução no Project Nox.")}
                  </p>

                  <!-- Redesigned Recruiting Preview -->
                  {#if scan.isRecruiting && scan.recruitingPositions.length > 0}
                    <div class="card-recruiting-strip">
                      <div class="card-recruiting-label">
                        <Briefcase size={13} />
                        <span>Vagas Abertas:</span>
                      </div>
                      <div class="card-roles-list">
                        {#each scan.recruitingPositions.slice(0, 3) as pos (pos)}
                          <a href="/scans/{scan.slug}#recrutamento" class="card-role-chip">{pos}</a>
                        {/each}
                        {#if scan.recruitingPositions.length > 3}
                          <a href="/scans/{scan.slug}#recrutamento" class="card-role-chip more">
                            +{scan.recruitingPositions.length - 3}
                          </a>
                        {/if}
                      </div>
                    </div>
                  {/if}

                  <!-- Stats Strip -->
                  <div class="card-stats-strip">
                    <div class="stat-cell">
                      <span class="stat-val">{scan.worksCount}</span>
                      <span class="stat-lbl">{scan.worksCount === 1 ? "Obra" : "Obras"}</span>
                    </div>
                    <div class="stat-divider"></div>
                    <div class="stat-cell">
                      <span class="stat-val">{scan.chaptersCount}</span>
                      <span class="stat-lbl">{scan.chaptersCount === 1 ? "Capítulo" : "Capítulos"}</span>
                    </div>
                    <div class="stat-divider"></div>
                    <div class="stat-cell">
                      <span class="stat-val">{scan.membersCount}</span>
                      <span class="stat-lbl">{scan.membersCount === 1 ? "Membro" : "Membros"}</span>
                    </div>
                  </div>

                  <!-- Card Footer Actions -->
                  <div class="card-actions-footer">
                    <div class="card-social-icons">
                      {#if scan.discord}
                        <a href={scan.discord} target="_blank" rel="noopener noreferrer" class="social-icon-btn discord" title="Discord oficial">
                          <DiscordIcon size={14} />
                        </a>
                      {/if}
                      {#if scan.fluxer}
                        <a href={scan.fluxer} target="_blank" rel="noopener noreferrer" class="social-icon-btn fluxer" title="Fluxer oficial">
                          <FluxerIcon size={14} />
                        </a>
                      {/if}
                      {#if scan.website}
                        <a href={scan.website} target="_blank" rel="noopener noreferrer" class="social-icon-btn website" title="Website oficial">
                          <Globe size={14} />
                        </a>
                      {/if}
                    </div>

                    <a href="/scans/{scan.slug}" class="card-primary-cta">
                      <span>Ver Scan</span>
                      <ArrowRight size={14} />
                    </a>
                  </div>
                </div>
              </article>
            {/each}
          </div>
        {/if}

      {:else if data.loadError}
        <div class="state-message-card error-state" role="alert">
          <BookOpen size={44} class="state-icon" />
          <h3 class="state-title">Falha ao sincronizar catálogo de scans</h3>
          <p class="state-desc">Os grupos parceiros continuam registrados na plataforma, mas ocorreu uma lentidão temporária. Tente recarregar a página.</p>
          <button type="button" class="btn-retry-action" onclick={() => window.location.reload()}>
            Recarregar Catálogo
          </button>
        </div>
      {:else}
        <div class="state-message-card empty-state">
          <Compass size={44} class="state-icon" />
          <h3 class="state-title">Nenhum grupo encontrado com estes critérios</h3>
          <p class="state-desc">Tente ajustar o termo digitado na barra de busca ou selecione a categoria "Todas".</p>
          <button type="button" class="btn-reset-filters" onclick={() => { searchQuery = ""; filterTab = "all"; }}>
            Ver Todas as Scans
          </button>
        </div>
      {/if}
    </main>
  </div>
</div>

<style>
  /* ==========================================================================
     PAGE LAYOUT & CONTAINER
     ========================================================================== */
  .scans-showcase-page {
    min-height: 100vh;
    padding: 2.5rem 1.5rem 6rem;
    color: #e2e8f0;
    background: radial-gradient(circle at 50% 0%, rgba(30, 27, 75, 0.35) 0%, rgba(9, 11, 20, 0) 65%);
  }

  .showcase-container {
    max-width: 1320px;
    margin: 0 auto;
  }

  /* ==========================================================================
     HERO & COMMAND DOCK
     ========================================================================== */
  .showcase-hero {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 2.25rem;
    align-items: stretch;
    background: linear-gradient(135deg, rgba(17, 21, 38, 0.95) 0%, rgba(10, 13, 24, 0.98) 100%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    padding: 2.5rem;
    margin-bottom: 2.75rem;
    box-shadow: 0 24px 48px -16px rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(20px);
  }

  .hero-content {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .hero-top-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.85rem;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.28);
    border-radius: 9999px;
    font-size: 0.72rem;
    font-weight: 800;
    color: #c4b5fd;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 0.85rem;
    align-self: flex-start;
  }

  .badge-sparkle {
    color: #a78bfa;
  }

  .hero-headline {
    font-family: "Manrope", -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 2.45rem;
    font-weight: 850;
    line-height: 1.15;
    color: #ffffff;
    margin: 0 0 0.75rem;
    letter-spacing: -0.03em;
  }

  .gradient-accent {
    background: linear-gradient(135deg, #c084fc 0%, #818cf8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .hero-lead {
    font-size: 0.96rem;
    color: #94a3b8;
    line-height: 1.65;
    margin: 0 0 1.75rem;
    max-width: 680px;
  }

  /* Command Dock: Search + Filters */
  .command-dock {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: rgba(13, 17, 30, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    padding: 0.85rem 1rem;
  }

  .search-field {
    position: relative;
    display: flex;
    align-items: center;
  }

  :global(.search-icon) {
    position: absolute;
    left: 1rem;
    color: #64748b;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    background: rgba(18, 24, 43, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 0.75rem 2.75rem 0.75rem 2.85rem;
    color: #ffffff;
    font-size: 0.92rem;
    transition: all 0.2s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: rgba(168, 85, 247, 0.5);
    box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.15);
  }

  .search-clear-btn {
    position: absolute;
    right: 0.85rem;
    background: rgba(255, 255, 255, 0.08);
    border: none;
    color: #94a3b8;
    border-radius: 9999px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s;
  }

  .search-clear-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #ffffff;
  }

  /* Filter Pills */
  .filter-pills {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
  }

  .pill-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 9999px;
    padding: 0.42rem 0.9rem;
    font-size: 0.82rem;
    font-weight: 600;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .pill-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.12);
  }

  .pill-btn.is-active {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.45);
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.2);
  }

  .pill-official.is-active {
    background: rgba(245, 158, 11, 0.16);
    border-color: rgba(245, 158, 11, 0.45);
    color: #fde68a;
  }

  .pill-partner.is-active {
    background: rgba(14, 165, 233, 0.16);
    border-color: rgba(14, 165, 233, 0.45);
    color: #bae6fd;
  }

  .pill-recruiting.is-active {
    background: rgba(16, 185, 129, 0.16);
    border-color: rgba(16, 185, 129, 0.45);
    color: #a7f3d0;
  }

  .pill-count {
    background: rgba(0, 0, 0, 0.35);
    padding: 0.1rem 0.45rem;
    border-radius: 9999px;
    font-size: 0.72rem;
    font-weight: 700;
    color: inherit;
  }

  .pulse-beacon {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 8px #10b981;
  }

  .pulse-beacon.green {
    background: #10b981;
    box-shadow: 0 0 8px #10b981;
  }

  /* Affiliate Sidebar Card */
  .affiliate-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: radial-gradient(circle at top right, rgba(139, 92, 246, 0.18), transparent 70%),
      linear-gradient(180deg, rgba(20, 26, 46, 0.9) 0%, rgba(13, 17, 30, 0.95) 100%);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 20px;
    padding: 1.75rem;
  }

  .affiliate-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.35);
    border-radius: 9999px;
    padding: 0.3rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: #c4b5fd;
    align-self: flex-start;
    margin-bottom: 0.85rem;
  }

  .affiliate-title {
    font-family: "Manrope", sans-serif;
    font-size: 1.15rem;
    font-weight: 800;
    color: #ffffff;
    line-height: 1.35;
    margin: 0 0 0.65rem;
  }

  .affiliate-desc {
    font-size: 0.84rem;
    color: #94a3b8;
    line-height: 1.6;
    margin: 0 0 1.25rem;
  }

  .affiliate-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
    color: #ffffff;
    font-size: 0.86rem;
    font-weight: 700;
    border-radius: 12px;
    padding: 0.75rem 1.25rem;
    text-decoration: none;
    box-shadow: 0 8px 16px -4px rgba(124, 58, 237, 0.45);
    transition: all 0.2s ease;
  }

  .affiliate-action:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px -4px rgba(124, 58, 237, 0.6);
  }

  /* ==========================================================================
     SPOTLIGHT CARD (VITRINE DE DESTAQUE - 1 SCAN)
     ========================================================================== */
  .spotlight-wrapper {
    margin-top: 0.5rem;
  }

  .spotlight-label-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
    padding-left: 0.5rem;
  }

  .spotlight-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.35);
    border-radius: 9999px;
    padding: 0.3rem 0.75rem;
    font-size: 0.72rem;
    font-weight: 800;
    color: #fbbf24;
    letter-spacing: 0.05em;
  }

  .spotlight-caption {
    font-size: 0.84rem;
    color: #64748b;
  }

  .spotlight-card {
    background: linear-gradient(180deg, rgba(16, 20, 36, 0.98) 0%, rgba(10, 13, 23, 0.99) 100%);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 24px;
    overflow: hidden;
    box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.7);
    transition: border-color 0.3s ease;
  }

  .spotlight-card.is-official {
    border-color: rgba(245, 158, 11, 0.3);
  }

  /* Spotlight Banner Hero */
  .spotlight-banner-hero {
    position: relative;
    height: 240px;
    width: 100%;
    overflow: hidden;
    background: #0d111e;
  }

  .spotlight-banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 35%;
  }

  .spotlight-banner-fallback {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
  }

  .spotlight-banner-fallback.official-gradient {
    background: radial-gradient(circle at 70% 30%, rgba(245, 158, 11, 0.25), transparent 60%),
      linear-gradient(135deg, #1e1b4b 0%, #17153a 50%, #0f172a 100%);
  }

  .spotlight-banner-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(10, 13, 24, 0.1) 0%, rgba(10, 13, 24, 0.6) 60%, rgba(10, 13, 24, 0.98) 100%);
  }

  /* Floating Emblem inside Banner */
  .spotlight-emblem-cluster {
    position: absolute;
    bottom: 1.5rem;
    left: 2rem;
    right: 2rem;
    display: flex;
    align-items: flex-end;
    gap: 1.5rem;
    z-index: 2;
  }

  .spotlight-logo-frame {
    width: 96px;
    height: 96px;
    border-radius: 20px;
    overflow: hidden;
    background: #0b0e19;
    border: 3px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 16px 32px rgba(0, 0, 0, 0.6);
    flex-shrink: 0;
  }

  .spotlight-logo-frame.official-frame {
    border-color: #f59e0b;
    box-shadow: 0 0 24px rgba(245, 158, 11, 0.35), 0 16px 32px rgba(0, 0, 0, 0.6);
  }

  .spotlight-logo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .spotlight-logo-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.5rem;
    font-weight: 900;
    background: linear-gradient(135deg, #7c3aed 0%, #4338ca 100%);
    color: #ffffff;
  }

  .spotlight-header-meta {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .spotlight-badge-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .seal-official {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(245, 158, 11, 0.2);
    border: 1px solid rgba(245, 158, 11, 0.45);
    border-radius: 6px;
    padding: 0.2rem 0.6rem;
    font-size: 0.7rem;
    font-weight: 800;
    color: #fbbf24;
    letter-spacing: 0.04em;
  }

  .seal-partner {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(14, 165, 233, 0.18);
    border: 1px solid rgba(14, 165, 233, 0.45);
    border-radius: 6px;
    padding: 0.2rem 0.6rem;
    font-size: 0.7rem;
    font-weight: 800;
    color: #38bdf8;
    letter-spacing: 0.04em;
  }

  .seal-recruiting {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.4);
    border-radius: 6px;
    padding: 0.2rem 0.6rem;
    font-size: 0.7rem;
    font-weight: 800;
    color: #34d399;
    letter-spacing: 0.04em;
  }

  .spotlight-name {
    font-family: "Manrope", sans-serif;
    font-size: 2.1rem;
    font-weight: 850;
    margin: 0;
    line-height: 1.15;
  }

  .spotlight-name a {
    color: #ffffff;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .spotlight-name a:hover {
    color: #c084fc;
  }

  /* Spotlight Body */
  .spotlight-body {
    padding: 1.85rem 2rem 2.25rem;
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  .spotlight-about-section {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2rem;
    align-items: center;
  }

  .spotlight-bio {
    font-size: 0.98rem;
    color: #cbd5e1;
    line-height: 1.65;
    margin: 0;
    max-width: 820px;
  }

  .spotlight-social-bar {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
  }

  .social-label {
    font-size: 0.74rem;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .social-pills {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .social-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 9999px;
    padding: 0.4rem 0.85rem;
    font-size: 0.82rem;
    font-weight: 600;
    color: #cbd5e1;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .social-pill:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
    transform: translateY(-1px);
  }

  .social-pill.discord:hover {
    background: rgba(88, 101, 242, 0.25);
    border-color: rgba(88, 101, 242, 0.5);
    color: #c7d2fe;
  }

  .social-pill.fluxer:hover {
    background: rgba(14, 165, 233, 0.25);
    border-color: rgba(14, 165, 233, 0.5);
    color: #bae6fd;
  }

  .social-pill.website:hover {
    background: rgba(168, 85, 247, 0.25);
    border-color: rgba(168, 85, 247, 0.5);
    color: #f3e8ff;
  }

  /* ==========================================================================
     RECRUITMENT SHOWCASE BOX (TOTALMENTE REDESENHADO)
     ========================================================================== */
  .recruitment-showcase-box {
    background: linear-gradient(135deg, rgba(20, 26, 44, 0.85) 0%, rgba(13, 17, 30, 0.95) 100%);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 18px;
    padding: 1.5rem;
    position: relative;
    overflow: hidden;
  }

  .recruitment-showcase-box::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: linear-gradient(180deg, #10b981 0%, #06b6d4 100%);
  }

  .recruitment-showcase-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.25rem;
  }

  .recruitment-header-left {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }

  .beacon-icon-wrap {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #34d399;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .recruitment-showcase-title {
    font-family: "Manrope", sans-serif;
    font-size: 1.1rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
    line-height: 1.2;
  }

  .recruitment-showcase-sub {
    font-size: 0.82rem;
    color: #94a3b8;
    margin: 0.2rem 0 0;
  }

  .recruitment-view-all-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.82rem;
    font-weight: 700;
    color: #34d399;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .recruitment-view-all-link:hover {
    color: #6ee7b7;
    text-decoration: underline;
  }

  /* Grid of role opportunity cards */
  .roles-opportunity-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1rem;
  }

  .role-opportunity-card {
    background: rgba(11, 15, 26, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 1.15rem;
    text-decoration: none;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 110px;
    transition: all 0.25s ease;
  }

  .role-opportunity-card:hover {
    background: rgba(18, 24, 42, 0.95);
    border-color: rgba(16, 185, 129, 0.4);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px -6px rgba(0, 0, 0, 0.5);
  }

  .role-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .role-dept-tag {
    font-size: 0.72rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .role-status-badge {
    font-size: 0.7rem;
    font-weight: 700;
    color: #34d399;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 4px;
    padding: 0.15rem 0.45rem;
  }

  .role-card-title {
    font-family: "Manrope", sans-serif;
    font-size: 1.05rem;
    font-weight: 750;
    color: #ffffff;
    margin: 0 0 0.75rem;
  }

  .role-card-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.78rem;
    font-weight: 600;
    color: #38bdf8;
  }

  :global(.role-arrow-icon) {
    transition: transform 0.2s ease;
  }

  .role-opportunity-card:hover :global(.role-arrow-icon) {
    transform: translateX(4px);
  }

  /* Spotlight Footer: Stats + CTAs */
  .spotlight-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    padding-top: 1.5rem;
  }

  .stats-counter-strip {
    display: flex;
    align-items: center;
    gap: 1.75rem;
  }

  .stat-pill-box {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  :global(.stat-icon) {
    color: #a78bfa;
  }

  .stat-meta {
    display: flex;
    flex-direction: column;
  }

  .stat-number {
    font-family: "Manrope", sans-serif;
    font-size: 1.25rem;
    font-weight: 850;
    color: #ffffff;
    line-height: 1;
  }

  .stat-desc {
    font-size: 0.76rem;
    color: #64748b;
    margin-top: 0.2rem;
  }

  .spotlight-cta-dock {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }

  .btn-secondary-vagas {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.35);
    border-radius: 12px;
    padding: 0.7rem 1.15rem;
    font-size: 0.88rem;
    font-weight: 700;
    color: #34d399;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-secondary-vagas:hover {
    background: rgba(16, 185, 129, 0.22);
    transform: translateY(-1px);
  }

  .btn-primary-explore {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
    border-radius: 12px;
    padding: 0.75rem 1.5rem;
    font-size: 0.92rem;
    font-weight: 800;
    color: #ffffff;
    text-decoration: none;
    box-shadow: 0 8px 20px -4px rgba(124, 58, 237, 0.5);
    transition: all 0.2s ease;
  }

  .btn-primary-explore:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 28px -4px rgba(124, 58, 237, 0.7);
  }

  /* ==========================================================================
     CATALOG GRID (QUANDO HOUVER MÚLTIPLAS SCANS)
     ========================================================================== */
  .scans-catalog-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 1.75rem;
  }

  .scan-catalog-card {
    background: linear-gradient(180deg, rgba(17, 21, 38, 0.95) 0%, rgba(10, 13, 23, 0.98) 100%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
    transition: all 0.25s ease;
  }

  .scan-catalog-card:hover {
    transform: translateY(-3px);
    border-color: rgba(168, 85, 247, 0.35);
    box-shadow: 0 24px 48px -15px rgba(0, 0, 0, 0.65);
  }

  .scan-catalog-card.is-official {
    border-color: rgba(245, 158, 11, 0.25);
  }

  .card-banner-wrap {
    position: relative;
    height: 120px;
    background: #0d111e;
  }

  .card-banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .card-banner-fallback {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
  }

  .card-banner-fallback.official-bg {
    background: linear-gradient(135deg, #3b2a1a 0%, #1e1b4b 100%);
  }

  .card-banner-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 0%, rgba(17, 21, 38, 0.9) 100%);
  }

  .card-banner-badges {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    display: flex;
    gap: 0.4rem;
  }

  .seal-official-small {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: rgba(0, 0, 0, 0.65);
    border: 1px solid rgba(245, 158, 11, 0.5);
    border-radius: 4px;
    padding: 0.2rem 0.5rem;
    font-size: 0.68rem;
    font-weight: 800;
    color: #fbbf24;
    backdrop-filter: blur(8px);
  }

  .seal-partner-small {
    background: rgba(0, 0, 0, 0.65);
    border: 1px solid rgba(14, 165, 233, 0.5);
    border-radius: 4px;
    padding: 0.2rem 0.5rem;
    font-size: 0.68rem;
    font-weight: 800;
    color: #38bdf8;
    backdrop-filter: blur(8px);
  }

  .seal-recruiting-small {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: rgba(0, 0, 0, 0.65);
    border: 1px solid rgba(16, 185, 129, 0.5);
    border-radius: 4px;
    padding: 0.2rem 0.5rem;
    font-size: 0.68rem;
    font-weight: 800;
    color: #34d399;
    backdrop-filter: blur(8px);
  }

  .card-content-body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .card-logo-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: -2.25rem;
    margin-bottom: 0.85rem;
    position: relative;
    z-index: 2;
  }

  .card-logo-frame {
    width: 60px;
    height: 60px;
    border-radius: 14px;
    overflow: hidden;
    background: #0b0e19;
    border: 2px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.5);
    flex-shrink: 0;
  }

  .card-logo-frame.official-frame {
    border-color: #f59e0b;
  }

  .card-logo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .card-logo-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: 800;
    background: #4338ca;
    color: #ffffff;
  }

  .card-title-wrap {
    display: flex;
    flex-direction: column;
  }

  .card-scan-title {
    font-family: "Manrope", sans-serif;
    font-size: 1.2rem;
    font-weight: 800;
    margin: 0;
  }

  .card-scan-title a {
    color: #ffffff;
    text-decoration: none;
  }

  .card-type-label {
    font-size: 0.74rem;
    color: #94a3b8;
  }

  .card-bio-text {
    font-size: 0.86rem;
    color: #94a3b8;
    line-height: 1.55;
    margin: 0 0 1rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-recruiting-strip {
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 10px;
    padding: 0.65rem 0.85rem;
    margin-bottom: 1rem;
  }

  .card-recruiting-label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    font-weight: 700;
    color: #34d399;
    margin-bottom: 0.4rem;
    text-transform: uppercase;
  }

  .card-roles-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .card-role-chip {
    font-size: 0.74rem;
    font-weight: 600;
    background: rgba(16, 185, 129, 0.15);
    color: #a7f3d0;
    border-radius: 6px;
    padding: 0.2rem 0.5rem;
    text-decoration: none;
    transition: background 0.2s;
  }

  .card-role-chip:hover {
    background: rgba(16, 185, 129, 0.3);
  }

  .card-role-chip.more {
    background: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
  }

  .card-stats-strip {
    display: flex;
    align-items: center;
    justify-content: space-around;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 0.65rem;
    margin-top: auto;
    margin-bottom: 1rem;
  }

  .stat-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .stat-val {
    font-family: "Manrope", sans-serif;
    font-size: 0.95rem;
    font-weight: 800;
    color: #ffffff;
  }

  .stat-lbl {
    font-size: 0.7rem;
    color: #64748b;
  }

  .stat-divider {
    width: 1px;
    height: 24px;
    background: rgba(255, 255, 255, 0.08);
  }

  .card-actions-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .card-social-icons {
    display: flex;
    gap: 0.4rem;
  }

  .social-icon-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    transition: all 0.2s;
  }

  .social-icon-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #ffffff;
  }

  .card-primary-cta {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(139, 92, 246, 0.2);
    border: 1px solid rgba(139, 92, 246, 0.4);
    border-radius: 10px;
    padding: 0.5rem 1rem;
    font-size: 0.84rem;
    font-weight: 700;
    color: #c4b5fd;
    text-decoration: none;
    transition: all 0.2s;
  }

  .card-primary-cta:hover {
    background: rgba(139, 92, 246, 0.35);
    color: #ffffff;
  }

  /* ==========================================================================
     EMPTY / ERROR STATES
     ========================================================================== */
  .state-message-card {
    text-align: center;
    padding: 4rem 2rem;
    background: rgba(15, 19, 32, 0.6);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    max-width: 580px;
    margin: 2rem auto;
  }

  :global(.state-icon) {
    color: #64748b;
    margin-bottom: 1rem;
  }

  .state-title {
    font-size: 1.25rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.5rem;
  }

  .state-desc {
    font-size: 0.9rem;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0 0 1.5rem;
  }

  .btn-retry-action,
  .btn-reset-filters {
    background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
    border: none;
    border-radius: 10px;
    padding: 0.65rem 1.35rem;
    color: #ffffff;
    font-weight: 700;
    font-size: 0.88rem;
    cursor: pointer;
  }

  /* ==========================================================================
     RESPONSIVE BREAKPOINTS
     ========================================================================== */
  @media (max-width: 1024px) {
    .showcase-hero {
      grid-template-columns: 1fr;
      padding: 2rem;
    }

    .spotlight-about-section {
      grid-template-columns: 1fr;
      gap: 1.25rem;
    }

    .spotlight-social-bar {
      align-items: flex-start;
    }
  }

  @media (max-width: 768px) {
    .scans-showcase-page {
      padding: 1.5rem 1rem 5rem;
    }

    .showcase-hero {
      padding: 1.5rem;
      border-radius: 18px;
    }

    .hero-headline {
      font-size: 1.85rem;
    }

    .spotlight-banner-hero {
      height: 180px;
    }

    .spotlight-emblem-cluster {
      bottom: 1rem;
      left: 1rem;
      right: 1rem;
      gap: 1rem;
    }

    .spotlight-logo-frame {
      width: 72px;
      height: 72px;
      border-radius: 16px;
    }

    .spotlight-name {
      font-size: 1.5rem;
    }

    .spotlight-body {
      padding: 1.25rem 1rem 1.5rem;
      gap: 1.25rem;
    }

    .roles-opportunity-grid {
      grid-template-columns: 1fr;
    }

    .spotlight-footer {
      flex-direction: column;
      align-items: stretch;
      gap: 1.25rem;
    }

    .stats-counter-strip {
      justify-content: space-between;
      gap: 1rem;
    }

    .spotlight-cta-dock {
      flex-direction: column;
    }

    .btn-secondary-vagas,
    .btn-primary-explore {
      width: 100%;
      justify-content: center;
    }
  }
</style>
