<script lang="ts">
  import { date, memberRank } from '$lib/types';
  import { getLevelProgress } from '$lib/levels';
  import {
    Sparkles,
    BookOpen,
    Bookmark,
    Trophy,
    UserPlus,
    UserCheck,
    Settings,
    Crown,
    Calendar,
    Award
  } from '@lucide/svelte';
  import UserAvatar from '$lib/components/UserAvatar.svelte';
  import { invalidateAll } from '$app/navigation';

  let { data } = $props();

  let rank = $derived(memberRank(data.member.xp, data.member.equipped_title_id, data.member.equipped_badge_id));
  let progress = $derived(getLevelProgress(data.member.xp));

  let isFollowing = $state(false);
  let followersCount = $state(0);
  let followBusy = $state(false);

  $effect(() => {
    isFollowing = data.isFollowing;
    followersCount = data.followersCount;
  });

  async function toggleFollow() {
    if (!data.viewerAuthenticated) {
      window.location.href = '/entrar';
      return;
    }
    if (followBusy) return;
    followBusy = true;

    // Optimistic update
    const willFollow = !isFollowing;
    isFollowing = willFollow;
    followersCount += willFollow ? 1 : -1;

    try {
      const res = await fetch('/api/social/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: data.member.id })
      });
      if (!res.ok) {
        // Revert on error
        isFollowing = !willFollow;
        followersCount += willFollow ? -1 : 1;
      } else {
        await invalidateAll();
      }
    } catch {
      isFollowing = !willFollow;
      followersCount += willFollow ? -1 : 1;
    } finally {
      followBusy = false;
    }
  }
</script>

<svelte:head>
  <title>{data.member.display_name} (@{data.member.username}) — Project Nox</title>
  <meta
    name="description"
    content={data.member.bio || `Perfil de ${data.member.display_name} no Project Nox.`}
  />
</svelte:head>

<div class="profile-page">
  <div class="profile-container">
    <!-- Profile Card Container -->
    <article class="profile-card">
      <!-- Profile Banner -->
      <div class="profile-banner-wrap">
        {#if data.member.banner_id}
          <img
            src="/media/{data.member.banner_id}"
            alt="Banner de {data.member.display_name}"
            class="profile-banner-img"
          />
        {:else if data.cosmetic_banner?.background}
          <div
            class="profile-banner-fallback"
            style="background: {data.cosmetic_banner.background};"
          ></div>
        {:else}
          <div class="profile-banner-fallback"></div>
        {/if}
      </div>

      <!-- Profile Header Body -->
      <div class="profile-body">
        <div class="identity-row">
          <!-- Avatar with cosmetic frame -->
          <div class="avatar-holder">
            <UserAvatar
              avatarId={data.member.avatar_id}
              frameId={data.member.frame_id}
              displayName={data.member.display_name}
              size={96}
            />
          </div>

          <!-- Actions: Follow / Edit -->
          <div class="action-buttons">
            {#if data.isSelf}
              <a href="/me" class="btn-profile-action self">
                <Settings size={16} />
                <span>Meu Espaço</span>
              </a>
            {:else}
              <button
                type="button"
                class="btn-profile-action follow"
                class:following={isFollowing}
                disabled={followBusy}
                onclick={toggleFollow}
              >
                {#if isFollowing}
                  <UserCheck size={16} />
                  <span>Seguindo</span>
                {:else}
                  <UserPlus size={16} />
                  <span>Seguir</span>
                {/if}
              </button>
            {/if}
          </div>
        </div>

        <!-- Name & Details -->
        <div class="info-block">
          <div class="name-line">
            <h1
              class="display-name"
              style={data.member.name_color ? `color: ${data.member.name_color}` : ''}
            >
              {data.member.display_name}
            </h1>

            {#if data.member.equipped_title_id}
              <span class="cosmetic-title-pill">
                <Crown size={13} />
                <span>{data.member.equipped_title_id}</span>
              </span>
            {:else if rank.title}
              <span class="rank-title-pill">{rank.title}</span>
            {/if}
          </div>

          <div class="meta-line">
            <span class="username-tag">@{data.member.username}</span>
            <span class="meta-dot">·</span>
            <span class="join-date">
              <Calendar size={13} />
              <span>Na Nox desde {date(data.member.created_at)}</span>
            </span>
          </div>

          <!-- Social Counts -->
          <div class="social-counts-row">
            <div class="social-count-item">
              <strong>{followersCount}</strong>
              <span>{followersCount === 1 ? 'Seguidor' : 'Seguidores'}</span>
            </div>
            <div class="social-count-item">
              <strong>{data.followingCount}</strong>
              <span>Seguindo</span>
            </div>
          </div>

          {#if data.member.bio}
            <p class="bio-text">{data.member.bio}</p>
          {/if}
        </div>

        <!-- Stats Strip -->
        <div class="stats-strip">
          <div class="stat-cell">
            <span class="stat-num">{rank.level}</span>
            <span class="stat-txt">Nível</span>
          </div>
          <div class="stat-cell gold">
            <span class="stat-num">{data.member.xp}</span>
            <span class="stat-txt">XP Total</span>
          </div>
          <div class="stat-cell">
            <span class="stat-num">{data.stats.chapters_read}</span>
            <span class="stat-txt">Capítulos</span>
          </div>
          <div class="stat-cell">
            <span class="stat-num">{data.stats.completed_works}</span>
            <span class="stat-txt">Concluídas</span>
          </div>
          <div class="stat-cell">
            <span class="stat-num">{data.stats.favorites}</span>
            <span class="stat-txt">Favoritos</span>
          </div>
        </div>

        <!-- Level Progress -->
        <div class="xp-progress-section">
          <div class="xp-bar-track">
            <div class="xp-bar-fill" style="width: {progress.progressPercent}%"></div>
          </div>
          <p class="xp-status-text">
            {#if progress.isMaxLevel}
              <strong>✦ Nível Máximo de Maestria Alcançado (100)</strong>
            {:else}
              Faltam <strong>{progress.xpNeededForNext} XP</strong> para o Nível {progress.nextLevel}
            {/if}
          </p>
        </div>

        <!-- Achievements Shelf -->
        <section class="achievements-section">
          <div class="achievements-header">
            <div class="sec-title-wrap">
              <Trophy size={18} class="sec-icon" />
              <h2>Conquistas Desbloqueadas</h2>
            </div>
            <span class="achievements-count">{data.achievements.length}</span>
          </div>

          {#if data.achievements.length > 0}
            <div class="achievements-grid">
              {#each data.achievements as ach (ach.id)}
                <div class="achievement-card" style="border-left-color: {ach.badge_color || '#8b5cf6'}">
                  <div class="ach-icon-circle" style="background: {ach.badge_color ? `${ach.badge_color}22` : 'rgba(139, 92, 246, 0.15)'}; color: {ach.badge_color || '#c4b5fd'}">
                    <Award size={18} />
                  </div>
                  <div class="ach-details">
                    <h3 class="ach-title">{ach.title}</h3>
                    <p class="ach-desc">{ach.description}</p>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="achievements-empty">
              <Sparkles size={28} />
              <p>Este leitor ainda está desbravando o catálogo e forjando suas conquistas.</p>
            </div>
          {/if}
        </section>
      </div>
    </article>
  </div>
</div>

<style>
  .profile-page {
    min-height: 100vh;
    padding: 2rem 1.5rem 5rem;
    color: #e2e8f0;
  }

  .profile-container {
    max-width: 860px;
    margin: 0 auto;
  }

  .profile-card {
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 12px 36px -8px rgba(0, 0, 0, 0.6);
  }

  .profile-banner-wrap {
    height: 220px;
    width: 100%;
    position: relative;
    background: #141724;
    overflow: hidden;
  }

  .profile-banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .profile-banner-fallback {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #1e1b4b 0%, #0d101a 100%);
  }

  .profile-body {
    padding: 0 2rem 2.5rem;
  }

  .identity-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-top: -48px;
    margin-bottom: 1.25rem;
  }

  .avatar-holder {
    position: relative;
  }

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .btn-profile-action {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1.4rem;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-profile-action.self {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #e2e8f0;
  }

  .btn-profile-action.self:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
  }

  .btn-profile-action.follow {
    background: #8b5cf6;
    border: none;
    color: #ffffff;
  }

  .btn-profile-action.follow:hover {
    background: #7c3aed;
    box-shadow: 0 4px 16px rgba(139, 92, 246, 0.4);
  }

  .btn-profile-action.follow.following {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #cbd5e1;
  }

  .btn-profile-action.follow.following:hover {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  /* Info */
  .info-block {
    margin-bottom: 2rem;
  }

  .name-line {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    flex-wrap: wrap;
    margin-bottom: 0.35rem;
  }

  .display-name {
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 1.8rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
  }

  .cosmetic-title-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.65rem;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.4);
    border-radius: 9999px;
    color: #dfc28d;
    font-size: 0.78rem;
    font-weight: 700;
  }

  .rank-title-pill {
    padding: 0.25rem 0.65rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 9999px;
    color: #c4b5fd;
    font-size: 0.78rem;
    font-weight: 600;
  }

  .meta-line {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 0.85rem;
  }

  .username-tag {
    font-weight: 600;
    color: #94a3b8;
  }

  .join-date {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .social-counts-row {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    margin-bottom: 1rem;
  }

  .social-count-item {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.88rem;
    color: #94a3b8;
  }

  .social-count-item strong {
    color: #ffffff;
  }

  .bio-text {
    font-size: 0.95rem;
    color: #cbd5e1;
    line-height: 1.6;
    margin: 0;
    max-width: 680px;
  }

  /* Stats Strip */
  .stats-strip {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.75rem;
    padding: 1.25rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    margin-bottom: 1.75rem;
    text-align: center;
  }

  .stat-cell {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .stat-num {
    font-size: 1.4rem;
    font-weight: 800;
    color: #ffffff;
  }

  .stat-txt {
    font-size: 0.75rem;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .stat-cell.gold .stat-num {
    color: #dfc28d;
  }

  /* Level Progress */
  .xp-progress-section {
    margin-bottom: 2.5rem;
  }

  .xp-bar-track {
    height: 8px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 9999px;
    overflow: hidden;
    margin-bottom: 0.6rem;
  }

  .xp-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #8b5cf6, #dfc28d);
    border-radius: 9999px;
    box-shadow: 0 0 10px rgba(139, 92, 246, 0.6);
    transition: width 0.4s ease;
  }

  .xp-status-text {
    font-size: 0.82rem;
    color: #94a3b8;
    margin: 0;
    text-align: right;
  }

  .xp-status-text strong {
    color: #dfc28d;
  }

  /* Achievements */
  .achievements-section {
    padding-top: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .achievements-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.25rem;
  }

  .sec-title-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  :global(.sec-icon) {
    color: #dfc28d;
  }

  .achievements-header h2 {
    font-size: 1.2rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .achievements-count {
    padding: 0.2rem 0.6rem;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 9999px;
    font-size: 0.78rem;
    font-weight: 700;
    color: #cbd5e1;
  }

  .achievements-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 0.85rem;
  }

  .achievement-card {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.85rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-left: 3px solid #8b5cf6;
    border-radius: 10px;
  }

  .ach-icon-circle {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .ach-details {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .ach-title {
    font-size: 0.88rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .ach-desc {
    font-size: 0.75rem;
    color: #94a3b8;
    line-height: 1.3;
    margin: 0;
  }

  .achievements-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 1.5rem;
    text-align: center;
    color: #64748b;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 12px;
    gap: 0.75rem;
  }

  .achievements-empty p {
    font-size: 0.9rem;
    margin: 0;
  }

  @media (max-width: 640px) {
    .stats-strip {
      grid-template-columns: repeat(3, 1fr);
    }

    .profile-banner-wrap {
      height: 150px;
    }

    .identity-row {
      margin-top: -36px;
    }
  }
</style>
