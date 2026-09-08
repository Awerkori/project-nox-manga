<script lang="ts">
  import { date, memberRank } from '$lib/types';
  import { Award, BookOpen, Bookmark, Trophy, Sparkles } from '@lucide/svelte';
  let { data } = $props();
  let rank = $derived(memberRank(data.member.xp));
</script>

<svelte:head>
  <title>{data.member.display_name} (@{data.member.username}) — Project Nox</title>
</svelte:head>

<div class="container profile-container spacer-bottom">
  <div class="page-top">
    <div class="badge-tag">
      <Sparkles size={12} />
      <span>LEITOR NOX</span>
    </div>
    <h1 class="profile-header-title">Perfil do Leitor</h1>
  </div>

  <section class="profile-glass-card">
    <div class="profile-header-row">
      <div class="profile-avatar-wrap">
        {#if data.member.avatar_id}
          <img
            src="/media/{data.member.avatar_id}"
            alt="Avatar de {data.member.display_name}"
            width="88"
            height="88"
            class="profile-avatar-img"
          />
        {:else}
          <span class="profile-avatar-fallback">
            {(data.member.display_name[0] || 'N').toUpperCase()}
          </span>
        {/if}
        <div class="avatar-glow"></div>
      </div>

      <div class="profile-main-meta">
        <div class="name-and-title">
          <h2 class="profile-display-name">{data.member.display_name}</h2>
          <span class="honorific-chip">{rank.title}</span>
        </div>
        <p class="profile-handle-row">
          @{data.member.username} · Na Nox desde {date(data.member.created_at)}
        </p>
      </div>
    </div>

    {#if data.member.bio}
      <p class="profile-bio">{data.member.bio}</p>
    {/if}

    <div class="stats-counter-row">
      <div class="stat-box">
        <span class="stat-box-val">{rank.level}</span>
        <span class="stat-box-label">Nível</span>
      </div>
      <div class="stat-box">
        <span class="stat-box-val highlight-gold">{data.member.xp}</span>
        <span class="stat-box-label">XP Total</span>
      </div>
      <div class="stat-box">
        <span class="stat-box-val">{data.stats.chapters_read}</span>
        <span class="stat-box-label">Capítulos</span>
      </div>
      <div class="stat-box">
        <span class="stat-box-val">{data.stats.completed_works}</span>
        <span class="stat-box-label">Concluídas</span>
      </div>
      <div class="stat-box">
        <span class="stat-box-val">{data.stats.favorites}</span>
        <span class="stat-box-label">Favoritos</span>
      </div>
    </div>

    <div class="xp-level-bar-section">
      <div class="xp-progress-track">
        <div
          class="xp-progress-fill"
          style="width: {((data.member.xp % 250) / 250) * 100}%"
        ></div>
      </div>
      <p class="xp-needed-text">
        Faltam <strong>{250 - (data.member.xp % 250)} XP</strong> para o nível {rank.level + 1}
      </p>
    </div>

    <div class="achievements-section">
      <h3 class="achievements-title">Conquistas na Nox</h3>
      <div class="achievements-chips">
        {#if data.stats.chapters_read > 0}
          <span class="achievement-pill">
            <BookOpen size={14} />
            <span>Primeiro Capítulo</span>
          </span>
        {/if}
        {#if data.stats.chapters_read >= 5}
          <span class="achievement-pill gold">
            <Trophy size={14} />
            <span>Leitor Dedicado</span>
          </span>
        {/if}
        {#if data.stats.completed_works > 0}
          <span class="achievement-pill">
            <Award size={14} />
            <span>Obra Concluída</span>
          </span>
        {/if}
        {#if data.stats.favorites > 0}
          <span class="achievement-pill">
            <Bookmark size={14} />
            <span>Colecionador</span>
          </span>
        {/if}
        {#if data.member.xp >= 250}
          <span class="achievement-pill purple">
            <span>✦ Nível {rank.level}</span>
          </span>
        {/if}
        {#if data.stats.chapters_read === 0 && data.member.xp === 0}
          <span class="small muted">A jornada deste leitor está apenas começando.</span>
        {/if}
      </div>
    </div>
  </section>
</div>

<style>
  .profile-container {
    max-width: 780px;
    margin: 0 auto;
  }

  .badge-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: #c9aa73;
    margin-bottom: 8px;
  }

  .profile-header-title {
    font-size: clamp(32px, 4vw, 44px);
    font-weight: 800;
    margin: 0 0 32px;
    color: #ffffff;
  }

  .profile-glass-card {
    padding: 36px 32px;
    border-radius: 24px;
    background: rgba(13, 16, 26, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(20px);
    box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.6);
  }

  .profile-header-row {
    display: flex;
    align-items: center;
    gap: 24px;
    margin-bottom: 24px;
  }

  .profile-avatar-wrap {
    position: relative;
    width: 88px;
    height: 88px;
    flex-shrink: 0;
  }

  .profile-avatar-img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    border: 2.5px solid #b59af5;
    position: relative;
    z-index: 2;
  }

  .profile-avatar-fallback {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: #1a1d33;
    color: #b59af5;
    font-size: 38px;
    font-weight: 800;
    display: grid;
    place-items: center;
    border: 2.5px solid #b59af5;
    position: relative;
    z-index: 2;
    line-height: 1;
    text-transform: uppercase;
    user-select: none;
  }

  .avatar-glow {
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(181, 154, 245, 0.4), transparent 70%);
    filter: blur(10px);
    z-index: 1;
  }

  .profile-main-meta {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .name-and-title {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .profile-display-name {
    font-size: 26px;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
  }

  .honorific-chip {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #c9aa73;
    padding: 4px 12px;
    border-radius: 999px;
    background: rgba(201, 170, 115, 0.12);
    border: 1px solid rgba(201, 170, 115, 0.3);
  }

  .profile-handle-row {
    font-size: 13px;
    color: #8c899a;
    margin: 0;
  }

  .profile-bio {
    font-size: 14px;
    line-height: 1.65;
    color: #d1cde0;
    margin: 0 0 28px;
    white-space: pre-wrap;
    padding: 14px 18px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  .stats-counter-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 12px;
    margin-bottom: 24px;
  }

  .stat-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 14px 10px;
    border-radius: 14px;
    background: rgba(18, 22, 36, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .stat-box-val {
    font-size: 20px;
    font-weight: 800;
    color: #ffffff;
  }

  .stat-box-val.highlight-gold {
    color: #c9aa73;
  }

  .stat-box-label {
    font-size: 11px;
    color: #7b788a;
    margin-top: 2px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .xp-level-bar-section {
    margin-bottom: 32px;
  }

  .xp-progress-track {
    width: 100%;
    height: 8px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .xp-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #8b5cf6, #c9aa73);
    border-radius: 999px;
    box-shadow: 0 0 10px rgba(181, 154, 245, 0.5);
    transition: width 0.4s ease;
  }

  .xp-needed-text {
    font-size: 12px;
    color: #8c899a;
    margin: 0;
  }

  .xp-needed-text strong {
    color: #c9aa73;
  }

  .achievements-section {
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    padding-top: 24px;
  }

  .achievements-title {
    font-size: 15px;
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 14px;
  }

  .achievements-chips {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .achievement-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #d1cde0;
  }

  .achievement-pill.gold {
    color: #c9aa73;
    border-color: rgba(201, 170, 115, 0.3);
    background: rgba(201, 170, 115, 0.08);
  }

  .achievement-pill.purple {
    color: #b59af5;
    border-color: rgba(181, 154, 245, 0.3);
    background: rgba(181, 154, 245, 0.08);
  }

  @media (max-width: 600px) {
    .profile-glass-card {
      padding: 24px 20px;
    }

    .profile-header-row {
      flex-direction: column;
      text-align: center;
      gap: 16px;
    }

    .name-and-title {
      justify-content: center;
    }

    .stats-counter-row {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
