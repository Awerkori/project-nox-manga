<script lang="ts">
  import UserAvatar from '$lib/components/UserAvatar.svelte';
  import { Sparkles, Trophy, Award, Shield, ArrowLeft, Calendar, ExternalLink } from '@lucide/svelte';
  import { NOX_HALL_OF_FAME_TITLES } from '$lib/levels';

  let { data }: { data: any } = $props();

  function formatNumber(n: number | string | null | undefined): string {
    const val = typeof n === 'number' ? n : Number(n) || 0;
    return new Intl.NumberFormat('pt-BR').format(val);
  }

  function formatDate(d: string): string {
    try {
      return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d));
    } catch {
      return d;
    }
  }
</script>

<svelte:head>
  <title>Hall da Fama Cósmico — Project Nox</title>
  <meta
    name="description"
    content="O Panteão dos Campeões Imortais do Project Nox. Registros históricos dos vencedores de cada temporada."
  />
</svelte:head>

<div class="hof-page">
  <div class="hof-container">
    <!-- Top Bar Navigation -->
    <div class="hof-nav">
      <a href="/ranking" class="btn-back">
        <ArrowLeft size={16} />
        <span>Voltar ao Ranking Ativo</span>
      </a>
      <div class="season-pill">
        <span class="live-dot"></span>
        <span>{data.activeSeason.name} em andamento</span>
      </div>
    </div>

    <!-- Hero Banner -->
    <header class="hof-hero">
      <div class="hero-badge">
        <Trophy size={16} class="trophy-icon" />
        <span>PANTEÃO CÓSMICO</span>
      </div>
      <h1 class="hero-title">Hall da Fama</h1>
      <p class="hero-subtitle">
        O registro perpétuo das maiores lendas e conquistadores do Project Nox. Aqueles que alcançaram o topo
        têm seus nomes e títulos imortalizados para sempre na história da comunidade.
      </p>
    </header>

    <!-- Concluded Seasons or Elegant Empty State -->
    {#if data.concludedSeasons.length === 0}
      <!-- Empty State for Active Season 1 -->
      <section class="hof-empty-state">
        <div class="empty-glow"></div>
        <div class="empty-icon-wrap">
          <span class="cosmic-podium-emoji">🏛️</span>
        </div>
        <h2 class="empty-title">A 1ª Temporada Está em Pleno Despertar</h2>
        <p class="empty-desc">
          O Panteão Supremo do Hall da Fama aguarda seus primeiros conquistadores. A <strong>Temporada 1 — Despertar Cósmico</strong>
          será concluída oficialmente em <strong>31 de dezembro de 2026</strong>.
        </p>

        <!-- Preview of the Top 3 Permanent Titles -->
        <div class="rewards-preview-box">
          <div class="preview-header">
            <Sparkles size={18} class="sparkle-icon" />
            <h3>Títulos Lendários Permanentes do Pódio</h3>
          </div>
          <p class="preview-note">
            Ao encerramento oficial da temporada, os três primeiros colocados receberão títulos exclusivos que nunca são
            perdidos em resets futuros.
          </p>

          <div class="preview-grid">
            <!-- 1st Place -->
            <div class="reward-preview-card tier-1">
              <div class="reward-badge gold">🥇 1º LUGAR</div>
              <div class="reward-icon">👑</div>
              <strong class="reward-title">{NOX_HALL_OF_FAME_TITLES[0].name}</strong>
              <p class="reward-desc">{NOX_HALL_OF_FAME_TITLES[0].description}</p>
              <div class="reward-tag">Eterno & Imutável</div>
            </div>

            <!-- 2nd Place -->
            <div class="reward-preview-card tier-2">
              <div class="reward-badge silver">🥈 2º LUGAR</div>
              <div class="reward-icon">🥈</div>
              <strong class="reward-title">{NOX_HALL_OF_FAME_TITLES[1].name}</strong>
              <p class="reward-desc">{NOX_HALL_OF_FAME_TITLES[1].description}</p>
              <div class="reward-tag">Eterno & Imutável</div>
            </div>

            <!-- 3rd Place -->
            <div class="reward-preview-card tier-3">
              <div class="reward-badge bronze">🥉 3º LUGAR</div>
              <div class="reward-icon">🥉</div>
              <strong class="reward-title">{NOX_HALL_OF_FAME_TITLES[2].name}</strong>
              <p class="reward-desc">{NOX_HALL_OF_FAME_TITLES[2].description}</p>
              <div class="reward-tag">Eterno & Imutável</div>
            </div>
          </div>
        </div>

        <div class="empty-cta">
          <a href="/ranking" class="btn-cta">
            <Trophy size={18} />
            <span>Competir no Ranking Ativo Agora</span>
          </a>
        </div>
      </section>
    {:else}
      <!-- Historical Seasons Listing -->
      <div class="seasons-history-list">
        {#each data.concludedSeasons as season (season.id)}
          {@const winners = data.winnersBySeason[season.id] || []}
          <section class="season-archive-card">
            <div class="season-header">
              <div class="season-meta">
                <span class="season-number">TEMPORADA #{season.number}</span>
                <h2 class="season-name">{season.name}</h2>
                <div class="season-dates">
                  <Calendar size={14} />
                  <span>{formatDate(season.starts_at)} até {formatDate(season.ends_at)}</span>
                </div>
              </div>
            </div>

            {#if winners.length >= 3}
              {@const wGold = winners.find((w: any) => w.place === 1) || winners[0]}
              {@const wSilver = winners.find((w: any) => w.place === 2) || winners[1]}
              {@const wBronze = winners.find((w: any) => w.place === 3) || winners[2]}

              <div class="hof-podium-grid">
                <!-- Silver #2 -->
                <div class="hof-podium-card tier-2">
                  <div class="podium-badge">🥈 2º LUGAR</div>
                  <div class="hof-avatar-wrap">
                    <UserAvatar
                      avatarId={wSilver.avatar_id}
                      crop={wSilver.avatar_crop}
                      displayName={wSilver.display_name}
                      frameId={wSilver.avatar_frame_id}
                      size={66}
                    />
                  </div>
                  <strong class="winner-name">{wSilver.display_name}</strong>
                  <span class="winner-handle">@{wSilver.username}</span>
                  <div class="winner-title-badge">{wSilver.equipped_title || 'Vice-Campeão'}</div>
                  <div class="winner-xp-stat">
                    <span>{formatNumber(wSilver.season_xp)} XP</span>
                    <small>Pontuação Final</small>
                  </div>
                </div>

                <!-- Gold #1 -->
                <div class="hof-podium-card tier-1">
                  <div class="podium-badge gold">👑 CAMPEÃO SUPREMO</div>
                  <div class="hof-avatar-wrap gold-halo">
                    <UserAvatar
                      avatarId={wGold.avatar_id}
                      crop={wGold.avatar_crop}
                      displayName={wGold.display_name}
                      frameId={wGold.avatar_frame_id}
                      size={80}
                    />
                  </div>
                  <strong class="winner-name gold">{wGold.display_name}</strong>
                  <span class="winner-handle">@{wGold.username}</span>
                  <div class="winner-title-badge gold">{wGold.equipped_title || 'Campeão Cósmico'}</div>
                  <div class="winner-xp-stat gold">
                    <span>{formatNumber(wGold.season_xp)} XP</span>
                    <small>Pontuação Campeã</small>
                  </div>
                </div>

                <!-- Bronze #3 -->
                <div class="hof-podium-card tier-3">
                  <div class="podium-badge">🥉 3º LUGAR</div>
                  <div class="hof-avatar-wrap">
                    <UserAvatar
                      avatarId={wBronze.avatar_id}
                      crop={wBronze.avatar_crop}
                      displayName={wBronze.display_name}
                      frameId={wBronze.avatar_frame_id}
                      size={64}
                    />
                  </div>
                  <strong class="winner-name">{wBronze.display_name}</strong>
                  <span class="winner-handle">@{wBronze.username}</span>
                  <div class="winner-title-badge">{wBronze.equipped_title || 'Terceiro Colocado'}</div>
                  <div class="winner-xp-stat">
                    <span>{formatNumber(wBronze.season_xp)} XP</span>
                    <small>Pontuação Final</small>
                  </div>
                </div>
              </div>
            {/if}
          </section>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .hof-page {
    min-height: 100vh;
    background: radial-gradient(circle at 50% 0%, rgba(30, 20, 50, 0.45) 0%, rgba(9, 7, 15, 0.98) 60%), #05040a;
    color: #f1f5f9;
    padding: 32px 16px 80px;
  }

  .hof-container {
    max-width: 1100px;
    margin: 0 auto;
  }

  /* Nav */
  .hof-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    gap: 16px;
    flex-wrap: wrap;
  }

  .btn-back {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #cbd5e1;
    font-size: 13px;
    font-weight: 600;
    padding: 8px 16px;
    border-radius: 9999px;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-back:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    border-color: rgba(255, 255, 255, 0.25);
    transform: translateX(-2px);
  }

  .season-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(168, 85, 247, 0.12);
    border: 1px solid rgba(168, 85, 247, 0.3);
    color: #c084fc;
    font-size: 12px;
    font-weight: 700;
    padding: 6px 14px;
    border-radius: 9999px;
  }

  .live-dot {
    width: 8px;
    height: 8px;
    background: #22c55e;
    border-radius: 50%;
    box-shadow: 0 0 8px #22c55e;
  }

  /* Hero */
  .hof-hero {
    text-align: center;
    margin-bottom: 40px;
    padding: 0 16px;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(90deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.1));
    border: 1px solid rgba(245, 158, 11, 0.4);
    color: #fbbf24;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1px;
    padding: 4px 14px;
    border-radius: 9999px;
    margin-bottom: 14px;
  }

  .hero-title {
    font-size: 40px;
    font-weight: 900;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 50%, #fbbf24 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 12px;
  }

  .hero-subtitle {
    font-size: 15px;
    color: #94a3b8;
    max-width: 680px;
    margin: 0 auto;
    line-height: 1.6;
  }

  /* Empty State */
  .hof-empty-state {
    position: relative;
    background: linear-gradient(180deg, rgba(24, 18, 36, 0.8) 0%, rgba(15, 11, 24, 0.95) 100%);
    border: 1px solid rgba(168, 85, 247, 0.25);
    border-radius: 24px;
    padding: 48px 24px;
    text-align: center;
    overflow: hidden;
    box-shadow: 0 16px 50px rgba(0, 0, 0, 0.6);
  }

  .empty-glow {
    position: absolute;
    top: -80px;
    left: 50%;
    transform: translateX(-50%);
    width: 340px;
    height: 180px;
    background: radial-gradient(circle, rgba(168, 85, 247, 0.25) 0%, transparent 70%);
    pointer-events: none;
  }

  .empty-icon-wrap {
    font-size: 54px;
    margin-bottom: 16px;
    filter: drop-shadow(0 0 20px rgba(168, 85, 247, 0.5));
  }

  .empty-title {
    font-size: 24px;
    font-weight: 900;
    color: #f8fafc;
    margin-bottom: 10px;
  }

  .empty-desc {
    font-size: 14px;
    color: #cbd5e1;
    max-width: 580px;
    margin: 0 auto 36px;
    line-height: 1.6;
  }

  /* Rewards Preview */
  .rewards-preview-box {
    background: rgba(10, 8, 16, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 28px 20px;
    margin-bottom: 32px;
  }

  .preview-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: #fbbf24;
    margin-bottom: 6px;
  }

  .preview-header h3 {
    font-size: 16px;
    font-weight: 800;
    color: #f8fafc;
  }

  .preview-note {
    font-size: 13px;
    color: #94a3b8;
    margin-bottom: 24px;
  }

  .preview-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  .reward-preview-card {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 16px;
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    transition: transform 0.2s ease;
  }

  .reward-preview-card:hover {
    transform: translateY(-3px);
  }

  .reward-preview-card.tier-1 {
    background: linear-gradient(180deg, rgba(42, 28, 12, 0.6) 0%, rgba(20, 14, 30, 0.8) 100%);
    border: 1px solid rgba(245, 158, 11, 0.4);
    box-shadow: 0 8px 24px rgba(245, 158, 11, 0.15);
  }

  .reward-preview-card.tier-2 {
    background: linear-gradient(180deg, rgba(28, 30, 42, 0.6) 0%, rgba(20, 14, 30, 0.8) 100%);
    border: 1px solid rgba(148, 163, 184, 0.3);
  }

  .reward-preview-card.tier-3 {
    background: linear-gradient(180deg, rgba(38, 22, 18, 0.6) 0%, rgba(20, 14, 30, 0.8) 100%);
    border: 1px solid rgba(217, 119, 6, 0.25);
  }

  .reward-badge {
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.5px;
    padding: 3px 10px;
    border-radius: 9999px;
    margin-bottom: 12px;
  }

  .reward-badge.gold {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.4);
  }

  .reward-badge.silver {
    background: rgba(148, 163, 184, 0.2);
    color: #e2e8f0;
    border: 1px solid rgba(148, 163, 184, 0.4);
  }

  .reward-badge.bronze {
    background: rgba(217, 119, 6, 0.2);
    color: #fdba74;
    border: 1px solid rgba(217, 119, 6, 0.4);
  }

  .reward-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }

  .reward-title {
    font-size: 13px;
    font-weight: 800;
    color: #f1f5f9;
    margin-bottom: 6px;
    line-height: 1.4;
  }

  .reward-desc {
    font-size: 11px;
    color: #94a3b8;
    line-height: 1.5;
    margin-bottom: 14px;
    flex: 1;
  }

  .reward-tag {
    font-size: 10px;
    font-weight: 800;
    color: #a855f7;
    background: rgba(168, 85, 247, 0.15);
    padding: 2px 8px;
    border-radius: 9999px;
  }

  .empty-cta {
    display: flex;
    justify-content: center;
  }

  .btn-cta {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
    color: #ffffff;
    font-size: 14px;
    font-weight: 800;
    padding: 12px 28px;
    border-radius: 9999px;
    text-decoration: none;
    box-shadow: 0 4px 20px rgba(168, 85, 247, 0.4);
    transition: all 0.2s ease;
  }

  .btn-cta:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(168, 85, 247, 0.6);
  }

  /* Archived Seasons */
  .seasons-history-list {
    display: flex;
    flex-direction: column;
    gap: 36px;
  }

  .season-archive-card {
    background: rgba(16, 12, 26, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 24px;
    padding: 32px 24px;
  }

  .season-header {
    margin-bottom: 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 16px;
  }

  .season-number {
    font-size: 11px;
    font-weight: 900;
    color: #a855f7;
    letter-spacing: 1px;
  }

  .season-name {
    font-size: 22px;
    font-weight: 900;
    color: #f8fafc;
    margin: 4px 0 6px;
  }

  .season-dates {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #64748b;
  }

  .hof-podium-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    align-items: end;
  }

  .hof-podium-card {
    background: rgba(255, 255, 255, 0.02);
    border-radius: 20px;
    padding: 24px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .hof-podium-card.tier-1 {
    background: linear-gradient(180deg, rgba(42, 28, 12, 0.8) 0%, rgba(20, 14, 30, 0.95) 100%);
    border: 2px solid rgba(245, 158, 11, 0.5);
    box-shadow: 0 12px 35px rgba(245, 158, 11, 0.2);
  }

  .hof-podium-card.tier-2 {
    background: linear-gradient(180deg, rgba(28, 30, 42, 0.8) 0%, rgba(20, 14, 30, 0.95) 100%);
    border: 1px solid rgba(148, 163, 184, 0.35);
  }

  .hof-podium-card.tier-3 {
    background: linear-gradient(180deg, rgba(38, 22, 18, 0.8) 0%, rgba(20, 14, 30, 0.95) 100%);
    border: 1px solid rgba(217, 119, 6, 0.3);
  }

  .podium-badge {
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.5px;
    padding: 3px 10px;
    border-radius: 9999px;
    margin-bottom: 16px;
    background: rgba(255, 255, 255, 0.08);
  }

  .podium-badge.gold {
    background: linear-gradient(90deg, #f59e0b, #d97706);
    color: #000;
    box-shadow: 0 0 10px rgba(245, 158, 11, 0.4);
  }

  .hof-avatar-wrap {
    margin-bottom: 14px;
  }

  .gold-halo {
    filter: drop-shadow(0 0 16px rgba(245, 158, 11, 0.45));
  }

  .winner-name {
    font-size: 16px;
    font-weight: 800;
    color: #f8fafc;
    margin-bottom: 2px;
  }

  .winner-name.gold {
    color: #fbbf24;
    font-size: 18px;
  }

  .winner-handle {
    font-size: 12px;
    color: #64748b;
    margin-bottom: 10px;
  }

  .winner-title-badge {
    font-size: 11px;
    font-weight: 800;
    color: #e2e8f0;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    padding: 3px 10px;
    border-radius: 9999px;
    margin-bottom: 14px;
    max-width: 90%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .winner-title-badge.gold {
    color: #fbbf24;
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.35);
  }

  .winner-xp-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .winner-xp-stat span {
    font-size: 16px;
    font-weight: 900;
    color: #f1f5f9;
  }

  .winner-xp-stat.gold span {
    color: #fbbf24;
    font-size: 18px;
  }

  .winner-xp-stat small {
    font-size: 10px;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  @media (max-width: 768px) {
    .preview-grid,
    .hof-podium-grid {
      grid-template-columns: 1fr;
      gap: 20px;
    }

    .hero-title {
      font-size: 30px;
    }
  }
</style>
