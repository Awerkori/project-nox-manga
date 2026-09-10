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
    ArrowRight,
    CheckCircle2,
    Settings,
    Clock,
    AlertCircle
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';
  import { relativeTime } from '$lib/types';
  import UserAvatar from '$lib/components/UserAvatar.svelte';

  let { data, form } = $props();

  let works = $derived(data.works || []);
  let chapters = $derived(data.chapters || []);
  let team = $derived(data.team || []);

  let saving = $state(false);
  let showSuccess = $state(false);

  function formatNumber(n: number = 0) {
    return new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short' }).format(n);
  }

  const ROLE_LABELS: Record<string, string> = {
    OWNER: 'Líder / Proprietário',
    ADMIN: 'Administrador',
    UPLOADER: 'Uploader / Revisor',
    MEMBER: 'Tradutor / Membro'
  };

  $effect(() => {
    if (form?.success) {
      showSuccess = true;
      const t = setTimeout(() => {
        showSuccess = false;
      }, 4000);
      return () => clearTimeout(t);
    }
  });
</script>

<svelte:head>
  <title>Painel de Scan Parceira | Project Nox</title>
</svelte:head>

<div class="scan-dashboard-page">
  <div class="dashboard-container">
    {#if !data.authenticated}
      <!-- Unauthenticated State -->
      <section class="onboarding-hero">
        <div class="hero-icon-ring">
          <ShieldCheck size={48} />
        </div>
        <h1 class="onboarding-title">Painel de Scan Parceira</h1>
        <p class="onboarding-sub">
          Faça login ou crie sua conta no Project Nox para acessar seu painel editorial e gerenciar suas obras.
        </p>
        <div class="onboarding-actions">
          <a href="/entrar" class="btn-primary">Entrar na Conta</a>
          <a href="/registro" class="btn-secondary">Criar Conta</a>
        </div>
      </section>
    {:else if !data.isMember}
      <!-- Not a Scan Member State -->
      <section class="partnership-portal">
        <header class="portal-header">
          <div class="badge-partnership">
            <Sparkles size={15} />
            <span>Programa de Parcerias</span>
          </div>
          <h1 class="portal-title">Torne-se uma Scan Parceira no Project Nox</h1>
          <p class="portal-sub">
            Traga sua equipe para uma plataforma focada na melhor experiência de leitura, com respeito integral aos
            tradutores e visibilidade para a sua comunidade.
          </p>
        </header>

        <div class="perks-grid">
          <div class="perk-card">
            <div class="perk-icon">
              <ShieldCheck size={22} />
            </div>
            <h3>Atribuição Oficial Garantida</h3>
            <p>Seu nome e logotipo aparecem no topo de cada capítulo e na página da obra com selo de verificação.</p>
          </div>

          <div class="perk-card">
            <div class="perk-icon">
              <MessageSquare size={22} />
            </div>
            <h3>Tráfego Direto para seu Discord</h3>
            <p>Botões de atalho integrados levam os leitores diretamente para o servidor ou site da sua scan.</p>
          </div>

          <div class="perk-card">
            <div class="perk-icon">
              <Eye size={22} />
            </div>
            <h3>Métricas Reais de Audiência</h3>
            <p>Acompanhe em tempo real leituras totais, obras mais lidas e retenção de público com proteção anti-bots.</p>
          </div>

          <div class="perk-card">
            <div class="perk-icon">
              <Settings size={22} />
            </div>
            <h3>Painel Dedicado e Equipe</h3>
            <p>Gerencie membros da sua scan (Líder, Admins, Uploaders) e personalize a bio e redes do seu grupo.</p>
          </div>
        </div>

        <div class="cta-box">
          <h2>Pronto para fazer parte?</h2>
          <p>Entre no nosso Discord oficial e abra um ticket na aba <strong>#parcerias-scan</strong> com o link do seu grupo.</p>
          <a href="https://discord.gg/projectnox" target="_blank" rel="noopener noreferrer" class="btn-discord-cta">
            <MessageSquare size={18} />
            <span>Solicitar Parceria no Discord</span>
          </a>
        </div>
      </section>
    {:else}
      <!-- Active Member Dashboard -->
      <header class="dash-header">
        <div class="dash-title-cluster">
          <div class="header-tag">
            <ShieldCheck size={14} />
            <span>Painel Editorial de Scan</span>
          </div>
          <h1 class="dash-main-title">{data.currentScan.name}</h1>
          <div class="dash-role-row">
            <span class="role-badge">{ROLE_LABELS[data.userRole] || data.userRole}</span>
            <a href="/scans/{data.currentScan.slug}" class="link-public-profile">
              <span>Ver página pública ↗</span>
            </a>
          </div>
        </div>

        {#if data.myScans.length > 1}
          <div class="scan-switcher">
            <label for="switch-scan">Alternar Scan:</label>
            <select
              id="switch-scan"
              value={data.currentScan.id}
              onchange={(e) => {
                const target = e.target as HTMLSelectElement;
                window.location.href = `/scan?id=${target.value}`;
              }}
            >
              {#each data.myScans as s}
                <option value={s.id}>{s.name} ({ROLE_LABELS[s.role] || s.role})</option>
              {/each}
            </select>
          </div>
        {/if}
      </header>

      <!-- Stats Grid -->
      <div class="stats-overview">
        <div class="stat-card">
          <BookOpen size={20} class="stat-icon" />
          <div class="stat-meta">
            <span class="stat-num">{works.length}</span>
            <span class="stat-desc">Obras Vinculadas</span>
          </div>
        </div>

        <div class="stat-card">
          <Layers size={20} class="stat-icon" />
          <div class="stat-meta">
            <span class="stat-num">{chapters.length}</span>
            <span class="stat-desc">Capítulos Atribuídos</span>
          </div>
        </div>

        <div class="stat-card">
          <Eye size={20} class="stat-icon" />
          <div class="stat-meta">
            <span class="stat-num">{formatNumber(data.totalViews)}</span>
            <span class="stat-desc">Leituras Registradas</span>
          </div>
        </div>

        <div class="stat-card">
          <Users size={20} class="stat-icon" />
          <div class="stat-meta">
            <span class="stat-num">{team.length}</span>
            <span class="stat-desc">Membros na Equipe</span>
          </div>
        </div>
      </div>

      <!-- Main Columns -->
      <div class="dash-columns">
        <!-- Left: Settings & Team -->
        <div class="dash-col-left">
          {#if ['OWNER', 'ADMIN'].includes(data.userRole)}
            <section class="card-section">
              <div class="section-top">
                <Settings size={18} />
                <h2>Informações da Scan</h2>
              </div>

              {#if showSuccess}
                <div class="success-banner">
                  <CheckCircle2 size={16} />
                  <span>Configurações salvas com sucesso!</span>
                </div>
              {/if}

              {#if form?.message}
                <div class="error-banner">
                  <AlertCircle size={16} />
                  <span>{form.message}</span>
                </div>
              {/if}

              <form
                method="POST"
                action="?/updateProfile"
                use:enhance={() => {
                  saving = true;
                  return async ({ update }) => {
                    saving = false;
                    await update();
                  };
                }}
                class="settings-form"
              >
                <input type="hidden" name="scan_id" value={data.currentScan.id} />

                <div class="form-field">
                  <label for="desc">Descrição / Bio:</label>
                  <textarea
                    id="desc"
                    name="description"
                    rows="3"
                    maxlength="2000"
                    placeholder="Apresente sua scan para os leitores..."
                  >{data.currentScan.description || ''}</textarea>
                </div>

                <div class="form-field">
                  <label for="discord">Link de Convite do Discord:</label>
                  <input
                    id="discord"
                    name="discord"
                    type="url"
                    placeholder="https://discord.gg/..."
                    value={data.currentScan.discord || ''}
                  />
                </div>

                <div class="form-field">
                  <label for="website">Website Oficial:</label>
                  <input
                    id="website"
                    name="website"
                    type="url"
                    placeholder="https://..."
                    value={data.currentScan.website || ''}
                  />
                </div>

                <button type="submit" class="btn-save" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </form>
            </section>
          {/if}

          <!-- Team Section -->
          <section class="card-section">
            <div class="section-top">
              <Users size={18} />
              <h2>Membros da Equipe ({team.length})</h2>
            </div>

            <div class="team-list">
              {#each team as member (member.id)}
                <div class="team-member-item">
                  <UserAvatar
                    avatarId={member.avatar_id}
                    displayName={member.display_name || member.username}
                    size={38}
                  />
                  <div class="member-text">
                    <span class="member-display">{member.display_name || member.username}</span>
                    <span class="member-user">@{member.username}</span>
                  </div>
                  <span class="role-pill">{ROLE_LABELS[member.role] || member.role}</span>
                </div>
              {/each}
            </div>
          </section>
        </div>

        <!-- Right: Works & Chapters -->
        <div class="dash-col-right">
          <!-- Works Section -->
          <section class="card-section">
            <div class="section-top">
              <BookOpen size={18} />
              <h2>Obras Atribuídas ({works.length})</h2>
            </div>

            {#if works.length > 0}
              <div class="works-list">
                {#each works as work (work.id)}
                  <a href="/obra/{work.slug}" class="dash-work-item">
                    {#if work.cover_id}
                      <img src="/media/{work.cover_id}" alt={work.title} class="work-mini-cover" />
                    {:else}
                      <div class="work-mini-placeholder">NOX</div>
                    {/if}
                    <div class="work-mini-info">
                      <span class="work-mini-title">{work.title}</span>
                      <span class="work-mini-views">
                        <Eye size={12} />
                        <span>{formatNumber(work.views_total || 0)} leituras</span>
                      </span>
                    </div>
                    <ArrowRight size={15} class="work-arrow" />
                  </a>
                {/each}
              </div>
            {:else}
              <p class="empty-text">Nenhuma obra atribuída a esta scan ainda.</p>
            {/if}
          </section>

          <!-- Recent Chapters -->
          <section class="card-section">
            <div class="section-top">
              <Layers size={18} />
              <h2>Últimos Capítulos Registrados</h2>
            </div>

            {#if chapters.length > 0}
              <div class="recent-chapters-list">
                {#each chapters as ch (ch.id)}
                  <a href="/ler/{ch.id}" class="dash-ch-item">
                    <div class="ch-left">
                      <span class="ch-work">{ch.works?.title}</span>
                      <span class="ch-num">Capítulo {ch.number}</span>
                    </div>
                    <div class="ch-right">
                      <span class="ch-views-count">
                        <Eye size={12} />
                        <span>{formatNumber(ch.views_total || 0)}</span>
                      </span>
                      <time datetime={ch.published_at}>{relativeTime(ch.published_at)}</time>
                    </div>
                  </a>
                {/each}
              </div>
            {:else}
              <p class="empty-text">Nenhum capítulo lançado recentemente.</p>
            {/if}
          </section>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .scan-dashboard-page {
    min-height: 100vh;
    padding: 2.5rem 1.5rem 5rem;
    color: #e2e8f0;
  }

  .dashboard-container {
    max-width: 1440px;
    margin: 0 auto;
  }

  /* Unauthenticated */
  .onboarding-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 6rem 2rem;
    background: radial-gradient(circle at top, rgba(139, 92, 246, 0.15), transparent 70%), #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
  }

  .hero-icon-ring {
    width: 90px;
    height: 90px;
    border-radius: 50%;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c4b5fd;
    margin-bottom: 1.5rem;
  }

  .onboarding-title {
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 2.4rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.75rem;
  }

  .onboarding-sub {
    font-size: 1.05rem;
    color: #94a3b8;
    max-width: 580px;
    line-height: 1.6;
    margin: 0 0 2rem;
  }

  .onboarding-actions {
    display: flex;
    gap: 1rem;
  }

  .btn-primary {
    padding: 0.85rem 2rem;
    background: #8b5cf6;
    color: #ffffff;
    border-radius: 12px;
    font-weight: 700;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-primary:hover {
    background: #7c3aed;
    box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
  }

  .btn-secondary {
    padding: 0.85rem 2rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
    border-radius: 12px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  /* Partnership Portal */
  .partnership-portal {
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
  }

  .portal-header {
    text-align: center;
    max-width: 800px;
    margin: 0 auto;
  }

  .badge-partnership {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.85rem;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.35);
    border-radius: 9999px;
    color: #dfc28d;
    font-size: 0.82rem;
    font-weight: 700;
    margin-bottom: 1rem;
  }

  .portal-title {
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 2.4rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 1rem;
    letter-spacing: -0.02em;
  }

  .portal-sub {
    font-size: 1.05rem;
    color: #94a3b8;
    line-height: 1.6;
    margin: 0;
  }

  .perks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .perk-card {
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 16px;
    padding: 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .perk-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(139, 92, 246, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c4b5fd;
    margin-bottom: 0.25rem;
  }

  .perk-card h3 {
    font-size: 1.15rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .perk-card p {
    font-size: 0.9rem;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0;
  }

  .cta-box {
    background: radial-gradient(circle at top center, rgba(139, 92, 246, 0.2), transparent 70%), #0e111d;
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 20px;
    padding: 3rem 2rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .cta-box h2 {
    font-size: 1.8rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
  }

  .cta-box p {
    font-size: 1rem;
    color: #cbd5e1;
    max-width: 600px;
    line-height: 1.6;
    margin: 0 0 0.5rem;
  }

  .btn-discord-cta {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.9rem 2.2rem;
    background: #5865f2;
    color: #ffffff;
    border-radius: 12px;
    font-weight: 700;
    font-size: 0.95rem;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-discord-cta:hover {
    background: #4752c4;
    box-shadow: 0 6px 24px rgba(88, 101, 242, 0.45);
    transform: translateY(-2px);
  }

  /* Active Dashboard */
  .dash-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1.5rem;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-wrap: wrap;
  }

  .header-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: #dfc28d;
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.4rem;
  }

  .dash-main-title {
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 2.2rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.5rem;
  }

  .dash-role-row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .role-badge {
    padding: 0.25rem 0.65rem;
    background: rgba(139, 92, 246, 0.2);
    border: 1px solid rgba(139, 92, 246, 0.35);
    border-radius: 6px;
    color: #c4b5fd;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .link-public-profile {
    font-size: 0.85rem;
    color: #94a3b8;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .link-public-profile:hover {
    color: #dfc28d;
  }

  .scan-switcher {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .scan-switcher select {
    padding: 0.5rem 1rem;
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: #ffffff;
    font-size: 0.88rem;
    outline: none;
  }

  /* Stats overview */
  .stats-overview {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1.25rem;
    margin-bottom: 2.5rem;
  }

  .stat-card {
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 1.25rem 1.5rem;
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }

  :global(.stat-icon) {
    color: #dfc28d;
  }

  .stat-meta {
    display: flex;
    flex-direction: column;
  }

  .stat-num {
    font-size: 1.6rem;
    font-weight: 800;
    color: #ffffff;
    line-height: 1.1;
  }

  .stat-desc {
    font-size: 0.8rem;
    color: #94a3b8;
    margin-top: 0.2rem;
  }

  /* Columns */
  .dash-columns {
    display: grid;
    grid-template-columns: 1fr 1.25fr;
    gap: 2rem;
  }

  .dash-col-left,
  .dash-col-right {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .card-section {
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 16px;
    padding: 1.5rem;
  }

  .section-top {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 1.25rem;
    color: #dfc28d;
  }

  .section-top h2 {
    font-size: 1.15rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .settings-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .form-field label {
    font-size: 0.85rem;
    color: #cbd5e1;
    font-weight: 600;
  }

  .form-field input,
  .form-field textarea {
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: #ffffff;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.2s ease;
  }

  .form-field input:focus,
  .form-field textarea:focus {
    border-color: #8b5cf6;
  }

  .btn-save {
    padding: 0.75rem 1.5rem;
    background: #8b5cf6;
    color: #ffffff;
    border: none;
    border-radius: 10px;
    font-weight: 700;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
    align-self: flex-start;
    margin-top: 0.5rem;
  }

  .btn-save:hover {
    background: #7c3aed;
  }

  .success-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 8px;
    color: #6ee7b7;
    font-size: 0.88rem;
    margin-bottom: 1rem;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: #fca5a5;
    font-size: 0.88rem;
    margin-bottom: 1rem;
  }

  /* Team */
  .team-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .team-member-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0.85rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 10px;
  }

  .member-text {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .member-display {
    font-size: 0.9rem;
    font-weight: 700;
    color: #ffffff;
  }

  .member-user {
    font-size: 0.75rem;
    color: #64748b;
  }

  .role-pill {
    padding: 0.2rem 0.5rem;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    font-size: 0.72rem;
    color: #cbd5e1;
  }

  /* Works List */
  .works-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .dash-work-item {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.6rem 0.85rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 10px;
    text-decoration: none;
    color: inherit;
    transition: all 0.2s ease;
  }

  .dash-work-item:hover {
    background: rgba(255, 255, 255, 0.07);
    transform: translateX(3px);
  }

  .work-mini-cover {
    width: 36px;
    height: 50px;
    border-radius: 6px;
    object-fit: cover;
  }

  .work-mini-placeholder {
    width: 36px;
    height: 50px;
    border-radius: 6px;
    background: #1e1b4b;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 700;
    color: #c4b5fd;
  }

  .work-mini-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 0.2rem;
  }

  .work-mini-title {
    font-size: 0.92rem;
    font-weight: 700;
    color: #ffffff;
  }

  .work-mini-views {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    color: #94a3b8;
  }

  :global(.work-arrow) {
    color: #64748b;
  }

  /* Recent Chapters */
  .recent-chapters-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .dash-ch-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    text-decoration: none;
    color: inherit;
    transition: background 0.2s ease;
  }

  .dash-ch-item:hover {
    background: rgba(255, 255, 255, 0.07);
  }

  .ch-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .ch-work {
    font-weight: 700;
    color: #ffffff;
    font-size: 0.9rem;
  }

  .ch-num {
    padding: 0.15rem 0.45rem;
    background: rgba(139, 92, 246, 0.15);
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 700;
    color: #c4b5fd;
  }

  .ch-right {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 0.78rem;
    color: #64748b;
  }

  .ch-views-count {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .empty-text {
    font-size: 0.88rem;
    color: #64748b;
    margin: 0;
  }

  @media (max-width: 900px) {
    .dash-columns {
      grid-template-columns: 1fr;
    }
  }
</style>
