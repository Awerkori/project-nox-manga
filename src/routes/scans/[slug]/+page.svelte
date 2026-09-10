<script lang="ts">
  import {
    ShieldCheck,
    Sparkles,
    BookOpen,
    Layers,
    Eye,
    Users,
    Globe,
    MessageSquare,
    ArrowLeft,
    Clock
  } from '@lucide/svelte';
  import WorkCard from '$lib/components/WorkCard.svelte';
  import UserAvatar from '$lib/components/UserAvatar.svelte';
  import { relativeTime } from '$lib/types';

  let { data } = $props();

  let activeTab = $state<'works' | 'chapters' | 'members'>('works');

  function formatNumber(n: number = 0) {
    return new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short' }).format(n);
  }

  const ROLE_LABELS: Record<string, string> = {
    OWNER: 'Líder & Fundador',
    ADMIN: 'Administrador',
    UPLOADER: 'Uploader / Revisor',
    MEMBER: 'Tradutor / Membro'
  };
</script>

<svelte:head>
  <title>{data.scan.name} — Scan Parceira | Project Nox</title>
  <meta
    name="description"
    content={data.scan.description || `Página oficial de traduções de ${data.scan.name} no Project Nox.`}
  />
</svelte:head>

<div class="scan-profile-page">
  <div class="profile-container">
    <!-- Back Link -->
    <nav class="back-nav">
      <a href="/scans" class="back-link">
        <ArrowLeft size={16} />
        <span>Voltar para todas as scans</span>
      </a>
    </nav>

    <!-- Hero Card -->
    <header class="scan-hero">
      <div class="hero-banner">
        {#if data.scan.banner_id}
          <img src="/media/{data.scan.banner_id}" alt="Banner de {data.scan.name}" class="banner-img" />
        {:else}
          <div class="banner-placeholder"></div>
        {/if}
      </div>

      <div class="hero-body">
        <div class="hero-identity-row">
          <div class="scan-logo-wrap">
            {#if data.scan.logo_id}
              <img src="/media/{data.scan.logo_id}" alt="Logo de {data.scan.name}" class="logo-img" />
            {:else}
              <div class="logo-placeholder">
                {data.scan.name.charAt(0).toUpperCase()}
              </div>
            {/if}
          </div>

          <div class="identity-meta">
            <div class="name-line">
              <h1 class="scan-title">{data.scan.name}</h1>
              {#if data.scan.is_official}
                <span class="badge-official">
                  <ShieldCheck size={14} />
                  <span>Scan Oficial</span>
                </span>
              {:else}
                <span class="badge-partner">
                  <Sparkles size={14} />
                  <span>Scan Parceira</span>
                </span>
              {/if}
            </div>

            <p class="scan-bio">
              {data.scan.description || 'Grupo independente de tradução e edição no catálogo do Project Nox.'}
            </p>
          </div>

          <!-- Socials -->
          <div class="hero-actions">
            {#if data.scan.discord}
              <a href={data.scan.discord} target="_blank" rel="noopener noreferrer" class="btn-social discord">
                <MessageSquare size={16} />
                <span>Discord</span>
              </a>
            {/if}
            {#if data.scan.website}
              <a href={data.scan.website} target="_blank" rel="noopener noreferrer" class="btn-social website">
                <Globe size={16} />
                <span>Website</span>
              </a>
            {/if}
          </div>
        </div>

        <!-- Metrics Strip -->
        <div class="metrics-strip">
          <div class="metric-card">
            <BookOpen size={18} class="metric-icon" />
            <div class="metric-info">
              <span class="metric-val">{data.works.length}</span>
              <span class="metric-label">{data.works.length === 1 ? 'Obra Ativa' : 'Obras Ativas'}</span>
            </div>
          </div>

          <div class="metric-card">
            <Layers size={18} class="metric-icon" />
            <div class="metric-info">
              <span class="metric-val">{data.chapters.length}</span>
              <span class="metric-label">{data.chapters.length === 1 ? 'Capítulo' : 'Capítulos'}</span>
            </div>
          </div>

          <div class="metric-card">
            <Eye size={18} class="metric-icon" />
            <div class="metric-info">
              <span class="metric-val">{formatNumber(data.totalViews)}</span>
              <span class="metric-label">Leituras Totais</span>
            </div>
          </div>

          <div class="metric-card">
            <Users size={18} class="metric-icon" />
            <div class="metric-info">
              <span class="metric-val">{data.members.length || 1}</span>
              <span class="metric-label">{data.members.length === 1 ? 'Membro' : 'Membros'}</span>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Navigation Tabs -->
    <div class="tabs-bar">
      <button
        type="button"
        class="tab-btn"
        class:active={activeTab === 'works'}
        onclick={() => (activeTab = 'works')}
      >
        <BookOpen size={16} />
        <span>Obras ({data.works.length})</span>
      </button>

      <button
        type="button"
        class="tab-btn"
        class:active={activeTab === 'chapters'}
        onclick={() => (activeTab = 'chapters')}
      >
        <Layers size={16} />
        <span>Últimos Capítulos ({data.chapters.length})</span>
      </button>

      {#if data.members.length > 0}
        <button
          type="button"
          class="tab-btn"
          class:active={activeTab === 'members'}
          onclick={() => (activeTab = 'members')}
        >
          <Users size={16} />
          <span>Equipe ({data.members.length})</span>
        </button>
      {/if}
    </div>

    <!-- Tab Contents -->
    <main class="tab-pane">
      {#if activeTab === 'works'}
        {#if data.works.length > 0}
          <div class="works-grid">
            {#each data.works as work (work.id)}
              <WorkCard {work} />
            {/each}
          </div>
        {:else}
          <div class="empty-box">
            <BookOpen size={36} />
            <h3>Nenhuma obra associada no momento</h3>
            <p>Em breve novos títulos serão vinculados a esta scan.</p>
          </div>
        {/if}
      {:else if activeTab === 'chapters'}
        {#if data.chapters.length > 0}
          <div class="chapters-table">
            {#each data.chapters as ch (ch.id)}
              <a href="/ler/{ch.id}" class="chapter-row">
                <div class="ch-work-info">
                  <span class="ch-work-title">{ch.works?.title}</span>
                  <span class="ch-num-badge">Capítulo {ch.number}</span>
                  {#if ch.title}
                    <span class="ch-name">— {ch.title}</span>
                  {/if}
                </div>

                <div class="ch-meta-right">
                  <span class="ch-views" title="Visualizações">
                    <Eye size={13} />
                    <span>{formatNumber(ch.views_total || 0)}</span>
                  </span>
                  <span class="ch-date">
                    <Clock size={13} />
                    <time datetime={ch.published_at}>{relativeTime(ch.published_at)}</time>
                  </span>
                </div>
              </a>
            {/each}
          </div>
        {:else}
          <div class="empty-box">
            <Layers size={36} />
            <h3>Nenhum capítulo publicado recentemente</h3>
          </div>
        {/if}
      {:else if activeTab === 'members'}
        <div class="members-grid">
          {#each data.members as m (m.id)}
            <div class="member-card">
              <UserAvatar
                avatarId={m.avatar_id}
                frameId={m.frame_id}
                displayName={m.display_name || m.username}
                size={48}
              />
              <div class="member-meta">
                <span class="member-name" style={m.name_color ? `color: ${m.name_color}` : ''}>
                  {m.display_name || m.username}
                </span>
                <span class="member-handle">@{m.username}</span>
                <span class="member-role-chip">{ROLE_LABELS[m.role] || m.role}</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </main>
  </div>
</div>

<style>
  .scan-profile-page {
    min-height: 100vh;
    padding: 1.5rem 1.5rem 5rem;
    color: #e2e8f0;
  }

  .profile-container {
    max-width: 1440px;
    margin: 0 auto;
  }

  .back-nav {
    margin-bottom: 1.25rem;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: #94a3b8;
    text-decoration: none;
    font-size: 0.88rem;
    font-weight: 600;
    transition: color 0.2s ease;
  }

  .back-link:hover {
    color: #dfc28d;
  }

  .scan-hero {
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    overflow: hidden;
    margin-bottom: 2rem;
  }

  .hero-banner {
    height: 200px;
    width: 100%;
    position: relative;
    background: #141724;
  }

  .banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .banner-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #1e1b4b 0%, #0d101a 100%);
  }

  .hero-body {
    padding: 0 2rem 2rem;
  }

  .hero-identity-row {
    display: flex;
    align-items: flex-end;
    gap: 1.75rem;
    margin-top: -50px;
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }

  .scan-logo-wrap {
    width: 100px;
    height: 100px;
    border-radius: 20px;
    background: #111422;
    border: 4px solid #0e111d;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
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
    background: linear-gradient(135deg, #4338ca, #1e1b4b);
    color: #ffffff;
    font-size: 2.2rem;
    font-weight: 800;
  }

  .identity-meta {
    flex: 1;
    min-width: 260px;
  }

  .name-line {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.4rem;
  }

  .scan-title {
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 1.8rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
  }

  .badge-official {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.75rem;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.4);
    border-radius: 8px;
    color: #dfc28d;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .badge-partner {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.75rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.4);
    border-radius: 8px;
    color: #c4b5fd;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .scan-bio {
    font-size: 0.95rem;
    color: #94a3b8;
    line-height: 1.6;
    margin: 0;
    max-width: 800px;
  }

  .hero-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .btn-social {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1.25rem;
    border-radius: 10px;
    font-size: 0.88rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-social.discord {
    background: #5865f2;
    color: #ffffff;
  }

  .btn-social.discord:hover {
    background: #4752c4;
    box-shadow: 0 4px 16px rgba(88, 101, 242, 0.4);
  }

  .btn-social.website {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #e2e8f0;
  }

  .btn-social.website:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #ffffff;
  }

  .metrics-strip {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .metric-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  :global(.metric-icon) {
    color: #dfc28d;
  }

  .metric-info {
    display: flex;
    flex-direction: column;
  }

  .metric-val {
    font-size: 1.25rem;
    font-weight: 800;
    color: #ffffff;
  }

  .metric-label {
    font-size: 0.78rem;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Tabs Bar */
  .tabs-bar {
    display: flex;
    gap: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    margin-bottom: 2rem;
  }

  .tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.85rem 1.25rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: #94a3b8;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .tab-btn:hover {
    color: #ffffff;
  }

  .tab-btn.active {
    color: #dfc28d;
    border-bottom-color: #dfc28d;
  }

  /* Panes */
  .works-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1.5rem;
  }

  .chapters-table {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .chapter-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 1.25rem;
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    text-decoration: none;
    color: inherit;
    transition: all 0.2s ease;
  }

  .chapter-row:hover {
    background: rgba(20, 24, 40, 0.8);
    border-color: rgba(223, 194, 141, 0.3);
    transform: translateX(4px);
  }

  .ch-work-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .ch-work-title {
    font-weight: 700;
    color: #ffffff;
  }

  .ch-num-badge {
    padding: 0.2rem 0.5rem;
    background: rgba(139, 92, 246, 0.15);
    border-radius: 4px;
    font-size: 0.78rem;
    font-weight: 700;
    color: #c4b5fd;
  }

  .ch-name {
    font-size: 0.85rem;
    color: #94a3b8;
  }

  .ch-meta-right {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    font-size: 0.82rem;
    color: #64748b;
  }

  .ch-views,
  .ch-date {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .members-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .member-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
  }

  .member-meta {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .member-name {
    font-size: 0.95rem;
    font-weight: 700;
    color: #ffffff;
  }

  .member-handle {
    font-size: 0.78rem;
    color: #64748b;
  }

  .member-role-chip {
    display: inline-block;
    padding: 0.15rem 0.45rem;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    font-size: 0.72rem;
    font-weight: 600;
    color: #cbd5e1;
    margin-top: 0.2rem;
    width: fit-content;
  }

  .empty-box {
    padding: 4rem 2rem;
    text-align: center;
    color: #64748b;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 16px;
  }

  .empty-box h3 {
    color: #f1f5f9;
    margin: 1rem 0 0.5rem;
  }

  @media (max-width: 768px) {
    .hero-banner {
      height: 140px;
    }

    .hero-identity-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
      margin-top: -40px;
    }

    .hero-actions {
      width: 100%;
    }

    .btn-social {
      flex: 1;
      justify-content: center;
    }

    .chapter-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }
  }
</style>
