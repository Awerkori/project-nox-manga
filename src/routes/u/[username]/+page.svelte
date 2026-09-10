<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { invalidateAll } from '$app/navigation';
  import { date, memberRank } from '$lib/types';
  import { getLevelProgress } from '$lib/levels';
  import {
    Sparkles,
    BookOpen,
    BookMarked,
    Trophy,
    UserPlus,
    UserCheck,
    Settings,
    Crown,
    Calendar,
    Award,
    Lock,
    Users,
    Star,
    Palette,
    CheckCircle2,
    Flame,
    ExternalLink,
    Heart,
    Clock,
    ShieldCheck
  } from '@lucide/svelte';
  import UserAvatar from '$lib/components/UserAvatar.svelte';
  import AchievementIcon from '$lib/components/AchievementIcon.svelte';
  import WorkCard from '$lib/components/WorkCard.svelte';

  let { data } = $props();

  let rank = $derived(
    memberRank(data.member.xp, data.member.equipped_title_id, data.member.equipped_badge_id)
  );
  let progress = $derived(getLevelProgress(data.member.xp));

  let isFollowing = $state(false);
  let followersCount = $state(0);
  let followBusy = $state(false);

  // Active public profile tab
  let activeTab = $state<'favorites' | 'reading' | 'achievements' | 'cosmetics'>('favorites');
  let cosmeticFilter = $state<string>('ALL');

  $effect(() => {
    isFollowing = data.isFollowing;
    followersCount = data.followersCount;
  });

  onMount(() => {
    // Check URL query param or hash to preset tab
    const tabParam = page.url.searchParams.get('tab');
    if (tabParam === 'favoritos' || tabParam === 'favorites' || window.location.hash === '#favoritos') {
      activeTab = 'favorites';
    } else if (tabParam === 'leituras' || tabParam === 'historico' || tabParam === 'reading' || window.location.hash === '#leituras') {
      activeTab = 'reading';
    } else if (tabParam === 'cosmeticos' || tabParam === 'cosmetics' || window.location.hash === '#cosmeticos') {
      activeTab = 'cosmetics';
    } else if (tabParam === 'conquistas' || tabParam === 'achievements' || window.location.hash === '#conquistas') {
      activeTab = 'achievements';
    }
  });

  function switchTab(tab: 'favorites' | 'reading' | 'achievements' | 'cosmetics') {
    activeTab = tab;
    const anchor = document.getElementById('profile-content-anchor');
    if (anchor) {
      anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

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

  // Cosmetics helpers
  function getCosmeticKindLabel(kind: string): string {
    switch (kind) {
      case 'AVATAR_FRAME':
        return 'Moldura';
      case 'TITLE':
        return 'Título';
      case 'PROFILE_BANNER':
        return 'Banner';
      case 'NAME_COLOR':
        return 'Cor de Nome';
      default:
        return 'Cosmético';
    }
  }

  function isItemEquipped(item: any): boolean {
    if (!item) return false;
    if (item.kind === 'AVATAR_FRAME' && data.member.avatar_frame_id === item.id) return true;
    if (
      item.kind === 'TITLE' &&
      (data.member.equipped_title_id === item.id || data.member.equipped_title_id === item.name)
    )
      return true;
    if (item.kind === 'PROFILE_BANNER' && data.member.equipped_banner_id === item.id) return true;
    if (item.kind === 'NAME_COLOR') {
      const colorVal = item.style_data?.color || item.style_data?.backgroundImage || item.id;
      return data.member.name_color === colorVal;
    }
    return false;
  }

  let filteredCosmetics = $derived.by(() => {
    const list = data.cosmetics || [];
    if (cosmeticFilter === 'ALL') return list;
    return list.filter((c: any) => c.kind === cosmeticFilter);
  });

  const cosmeticCounts = $derived.by(() => {
    const list = data.cosmetics || [];
    return {
      all: list.length,
      frames: list.filter((c: any) => c.kind === 'AVATAR_FRAME').length,
      titles: list.filter((c: any) => c.kind === 'TITLE').length,
      banners: list.filter((c: any) => c.kind === 'PROFILE_BANNER').length,
      colors: list.filter((c: any) => c.kind === 'NAME_COLOR').length
    };
  });

  function getRarityBadgeInfo(rarity: string = 'COMUM') {
    switch (rarity.toUpperCase()) {
      case 'MITICA':
        return { label: 'Mítica', border: '#f43f5e', text: '#fda4af', bg: 'rgba(244, 63, 94, 0.15)', glow: '0 0 16px rgba(244, 63, 94, 0.4)' };
      case 'LENDARIA':
        return { label: 'Lendária', border: '#f59e0b', text: '#fde68a', bg: 'rgba(245, 158, 11, 0.15)', glow: '0 0 16px rgba(245, 158, 11, 0.4)' };
      case 'EPICA':
        return { label: 'Épica', border: '#a855f7', text: '#e9d5ff', bg: 'rgba(168, 85, 247, 0.15)', glow: '0 0 12px rgba(168, 85, 247, 0.3)' };
      case 'RARA':
        return { label: 'Rara', border: '#38bdf8', text: '#bae6fd', bg: 'rgba(56, 189, 248, 0.15)', glow: '0 0 10px rgba(56, 189, 248, 0.25)' };
      case 'INCOMUM':
        return { label: 'Incomum', border: '#34d399', text: '#a7f3d0', bg: 'rgba(52, 211, 153, 0.15)', glow: 'none' };
      default:
        return { label: 'Comum', border: '#64748b', text: '#cbd5e1', bg: 'rgba(148, 163, 184, 0.1)', glow: 'none' };
    }
  }

  function getOriginLabel(origin: string = 'SHOP'): { label: string; bg: string; text: string } {
    switch (origin.toUpperCase()) {
      case 'SHOP':
        return { label: 'Loja', bg: 'rgba(234, 179, 8, 0.12)', text: '#fde047' };
      case 'ACHIEVEMENT':
        return { label: 'Conquista', bg: 'rgba(168, 85, 247, 0.12)', text: '#d8b4fe' };
      case 'EVENT':
        return { label: 'Evento', bg: 'rgba(236, 72, 153, 0.12)', text: '#f472b6' };
      case 'ADMIN_SPECIAL':
        return { label: 'Especial', bg: 'rgba(59, 130, 246, 0.12)', text: '#93c5fd' };
      case 'LEGACY':
        return { label: 'Legado', bg: 'rgba(148, 163, 184, 0.12)', text: '#cbd5e1' };
      default:
        return { label: 'Coleção', bg: 'rgba(148, 163, 184, 0.12)', text: '#cbd5e1' };
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

          {#if data.scanRoles && data.scanRoles.length > 0}
            <div class="scan-badges-row">
              {#each data.scanRoles as sr}
                <a
                  href="/scans/{sr.scan.slug}"
                  class="scan-staff-badge"
                  class:owner={sr.role === 'OWNER'}
                  class:admin={sr.role === 'ADMIN'}
                  class:uploader={sr.role === 'UPLOADER'}
                  title="Membro da equipe {sr.scan.name}"
                >
                  {#if sr.scan.logo_id}
                    <img src="/media/{sr.scan.logo_id}" alt="" class="scan-badge-logo" />
                  {:else}
                    <ShieldCheck size={13} />
                  {/if}
                  <span class="scan-badge-role">
                    {sr.role === 'OWNER' ? 'Líder' : sr.role === 'ADMIN' ? 'Admin Scan' : sr.role === 'UPLOADER' ? 'Uploader' : 'Staff'}
                  </span>
                  <span class="scan-badge-dot">·</span>
                  <span class="scan-badge-name">{sr.scan.name}</span>
                </a>
              {/each}
            </div>
          {/if}

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

        <!-- Level & XP Progression Strip -->
        <div class="xp-strip">
          <div class="xp-header-row">
            <div class="xp-rank-badge">
              <span class="xp-rank-level">Nível {rank.level}</span>
              <span class="xp-rank-dot">·</span>
              <span class="xp-rank-xp">{data.member.xp.toLocaleString('pt-BR')} XP</span>
            </div>
            <div class="xp-status-text">
              {#if progress.isMaxLevel}
                <strong>✦ Maestria Máxima</strong>
              {:else}
                Faltam <strong>{progress.xpNeededForNext.toLocaleString('pt-BR')} XP</strong> para o Nível {progress.nextLevel}
              {/if}
            </div>
          </div>
          <div class="xp-bar-track">
            <div class="xp-bar-fill" style="width: {progress.progressPercent}%"></div>
          </div>
        </div>

        <!-- High-Impact Profile Stats Grid -->
        <div class="stats-grid" id="stats-summary">
          <!-- 1. Capítulos Lidos (Últimas Leituras) -->
          <button
            type="button"
            class="stat-card stat-card-interactive"
            class:active-card={activeTab === 'reading'}
            onclick={() => switchTab('reading')}
            title="Clique para ver o histórico recente de leituras"
          >
            <div class="stat-card-icon">
              <BookOpen size={20} />
            </div>
            <div class="stat-card-data">
              {#if !data.canViewReadingHistory}
                <div class="stat-private-row">
                  <Lock size={14} />
                  <span class="stat-private-txt">Privado</span>
                </div>
              {:else}
                <span class="stat-card-num">{data.stats.chapters_read.toLocaleString('pt-BR')}</span>
              {/if}
              <div class="stat-label-wrap">
                <span class="stat-card-label">Capítulos Lidos</span>
                <span class="stat-click-hint">Ver</span>
              </div>
            </div>
          </button>

          <!-- 2. Favoritos -->
          <button
            type="button"
            class="stat-card stat-card-interactive"
            class:active-card={activeTab === 'favorites'}
            onclick={() => switchTab('favorites')}
            title="Clique para ver as obras favoritas do leitor"
          >
            <div class="stat-card-icon heart-icon">
              <Heart size={20} />
            </div>
            <div class="stat-card-data">
              {#if !data.canViewFavorites}
                <div class="stat-private-row">
                  <Lock size={14} />
                  <span class="stat-private-txt">Privado</span>
                </div>
              {:else}
                <span class="stat-card-num">{data.favorites.length || data.stats.favorites || 0}</span>
              {/if}
              <div class="stat-label-wrap">
                <span class="stat-card-label">Favoritos</span>
                <span class="stat-click-hint">Ver</span>
              </div>
            </div>
          </button>

          <!-- 3. Conquistas (Desbloqueadas / Total) -->
          <button
            type="button"
            class="stat-card stat-card-interactive"
            class:active-card={activeTab === 'achievements'}
            onclick={() => switchTab('achievements')}
            title="Clique para ver a estante pública de conquistas"
          >
            <div class="stat-card-icon trophy-icon">
              <Trophy size={20} />
            </div>
            <div class="stat-card-data">
              {#if !data.canViewAchievements}
                <div class="stat-private-row">
                  <Lock size={14} />
                  <span class="stat-private-txt">Privado</span>
                </div>
              {:else}
                <div class="stat-card-num stat-num-achievement">
                  <span class="stat-unlocked">{data.stats.achievements_unlocked}</span>
                  <span class="stat-sep">/</span>
                  <span class="stat-total">{data.stats.achievements_total}</span>
                </div>
              {/if}
              <div class="stat-label-wrap">
                <span class="stat-card-label">Conquistas</span>
                <span class="stat-click-hint">Ver</span>
              </div>
            </div>
          </button>

          <!-- 4. Cosméticos -->
          <button
            type="button"
            class="stat-card stat-card-interactive"
            class:active-card={activeTab === 'cosmetics'}
            onclick={() => switchTab('cosmetics')}
            title="Clique para ver a coleção de cosméticos e molduras"
          >
            <div class="stat-card-icon sparkles-icon">
              <Sparkles size={20} />
            </div>
            <div class="stat-card-data">
              {#if !data.canViewCosmetics}
                <div class="stat-private-row">
                  <Lock size={14} />
                  <span class="stat-private-txt">Privado</span>
                </div>
              {:else}
                <span class="stat-card-num">{data.stats.cosmetics_count}</span>
              {/if}
              <div class="stat-label-wrap">
                <span class="stat-card-label">Cosméticos</span>
                <span class="stat-click-hint">Ver</span>
              </div>
            </div>
          </button>

          <!-- 5. Seguidores -->
          <div class="stat-card" title="Leitores que acompanham o perfil">
            <div class="stat-card-icon">
              <Users size={20} />
            </div>
            <div class="stat-card-data">
              <span class="stat-card-num">{followersCount.toLocaleString('pt-BR')}</span>
              <span class="stat-card-label">{followersCount === 1 ? 'Seguidor' : 'Seguidores'}</span>
            </div>
          </div>
        </div>

        <!-- Featured Achievement Card (Conquista em Destaque) -->
        {#if data.featuredAchievement && data.canViewAchievements}
          {@const rInfo = getRarityBadgeInfo(data.featuredAchievement.rarity)}
          <section class="featured-achievement-card" style="border-color: {rInfo.border}; box-shadow: {rInfo.glow};">
            <div class="featured-top-banner" style="background: {rInfo.bg};">
              <div class="featured-badge-pill">
                <Star size={13} fill="currentColor" />
                <span>CONQUISTA EM DESTAQUE</span>
              </div>
              <span class="featured-rarity-pill" style="color: {rInfo.text}; border-color: {rInfo.border}; background: rgba(0, 0, 0, 0.3);">
                {rInfo.label}
              </span>
            </div>

            <div class="featured-content-body">
              <div class="featured-icon-circle" style="background: {rInfo.bg}; border: 2px solid {rInfo.border}; color: {rInfo.text};">
                <AchievementIcon icon={data.featuredAchievement.icon} size={32} />
              </div>
              <div class="featured-text-block">
                <div class="featured-title-row">
                  <h3 class="featured-title">{data.featuredAchievement.title}</h3>
                  {#if data.featuredAchievement.xp_reward}
                    <span class="featured-xp-tag">+{data.featuredAchievement.xp_reward} XP</span>
                  {/if}
                </div>
                <p class="featured-description">{data.featuredAchievement.description}</p>
                <div class="featured-meta-row">
                  <span class="featured-unlock-date">
                    <CheckCircle2 size={13} />
                    <span>Desbloqueada em {date(data.featuredAchievement.unlocked_at)}</span>
                  </span>
                  {#if data.isSelf}
                    <a href="/me?tab=achievements" class="featured-edit-link">
                      <span>Alterar destaque</span>
                      <ExternalLink size={12} />
                    </a>
                  {/if}
                </div>
              </div>
            </div>
          </section>
        {/if}

        <div id="profile-content-anchor"></div>

        <!-- Section Navigation Tabs -->
        <div class="profile-tabs-header">
          <button
            type="button"
            class="profile-tab-btn"
            class:active={activeTab === 'favorites'}
            onclick={() => switchTab('favorites')}
          >
            <Heart size={17} />
            <span>Favoritos</span>
            <span class="tab-count-pill">
              {#if !data.canViewFavorites}
                <Lock size={11} />
              {:else}
                {data.favorites.length}
              {/if}
            </span>
          </button>

          <button
            type="button"
            class="profile-tab-btn"
            class:active={activeTab === 'reading'}
            onclick={() => switchTab('reading')}
          >
            <Clock size={17} />
            <span>Últimas Leituras</span>
            <span class="tab-count-pill">
              {#if !data.canViewReadingHistory}
                <Lock size={11} />
              {:else}
                {data.recentReadings.length}
              {/if}
            </span>
          </button>

          <button
            type="button"
            class="profile-tab-btn"
            class:active={activeTab === 'achievements'}
            onclick={() => switchTab('achievements')}
          >
            <Trophy size={17} />
            <span>Conquistas</span>
            <span class="tab-count-pill">
              {#if !data.canViewAchievements}
                <Lock size={11} />
              {:else}
                {data.stats.achievements_unlocked} / {data.stats.achievements_total}
              {/if}
            </span>
          </button>

          <button
            type="button"
            class="profile-tab-btn"
            class:active={activeTab === 'cosmetics'}
            onclick={() => switchTab('cosmetics')}
          >
            <Sparkles size={17} />
            <span>Coleção Cosmética</span>
            <span class="tab-count-pill">
              {#if !data.canViewCosmetics}
                <Lock size={11} />
              {:else}
                {data.stats.cosmetics_count}
              {/if}
            </span>
          </button>
        </div>

        <!-- TAB: FAVORITOS -->
        {#if activeTab === 'favorites'}
          <section class="tab-pane favorites-pane">
            {#if !data.canViewFavorites}
              <div class="privacy-notice-card">
                <div class="privacy-icon-wrap">
                  <Lock size={32} />
                </div>
                <h3>Favoritos Privados</h3>
                <p>Este leitor optou por manter suas obras favoritas privadas no seu perfil público.</p>
              </div>
            {:else}
              {#if data.isSelf && !data.member.privacy_show_favorites}
                <div class="self-privacy-hint">
                  <Lock size={14} />
                  <span>Seus favoritos estão configurados como privados e são visíveis apenas para você.</span>
                </div>
              {/if}

              {#if data.favorites.length > 0}
                <div class="works-cards-grid">
                  {#each data.favorites as work (work.id)}
                    <WorkCard {work} />
                  {/each}
                </div>
              {:else}
                <div class="empty-tab-state">
                  <Heart size={40} class="empty-tab-icon" />
                  <h4>Nenhuma obra favoritada</h4>
                  <p>As histórias adicionadas aos favoritos serão exibidas aqui.</p>
                </div>
              {/if}
            {/if}
          </section>

        <!-- TAB: ÚLTIMAS LEITURAS -->
        {:else if activeTab === 'reading'}
          <section class="tab-pane reading-pane">
            {#if !data.canViewReadingHistory}
              <div class="privacy-notice-card">
                <div class="privacy-icon-wrap">
                  <Lock size={32} />
                </div>
                <h3>Histórico de Leituras Privado</h3>
                <p>Este leitor optou por manter seu histórico recente de leituras privado.</p>
              </div>
            {:else}
              {#if data.isSelf && !data.member.privacy_show_reading_history}
                <div class="self-privacy-hint">
                  <Lock size={14} />
                  <span>Seu histórico de leituras está configurado como privado e é visível apenas para você.</span>
                </div>
              {/if}

              {#if data.recentReadings.length > 0}
                <div class="readings-list-grid">
                  {#each data.recentReadings as r (r.workId)}
                    <div class="reading-history-card">
                      <a href="/obra/{r.workSlug}" class="reading-cover-wrap">
                        {#if r.coverId}
                          <img
                            src="/media/{r.coverId}"
                            alt={r.workTitle}
                            class="reading-cover-img"
                            class:blurred-cover={r.contentRating === 'ADULT_18' && (page.data?.blurNsfw ?? true)}
                            loading="lazy"
                          />
                        {:else}
                          <div class="reading-cover-placeholder">NOX</div>
                        {/if}
                        {#if r.contentRating === 'ADULT_18'}
                          <span class="reading-adult-tag">+18</span>
                        {/if}
                      </a>
                      <div class="reading-details">
                        <a href="/obra/{r.workSlug}" class="reading-work-title">{r.workTitle}</a>
                        <div class="reading-ch-row">
                          <a href="/ler/{r.chapterId}" class="reading-chapter-badge">
                            <span>Capítulo {r.chapterNumber}</span>
                            <ExternalLink size={11} />
                          </a>
                          {#if r.page}
                            <span class="reading-page-info">Pág. {r.page}</span>
                          {/if}
                        </div>
                        <span class="reading-timestamp">
                          <Clock size={12} />
                          <span>Lido em {date(r.updatedAt)}</span>
                        </span>
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="empty-tab-state">
                  <Clock size={40} class="empty-tab-icon" />
                  <h4>Nenhuma leitura recente</h4>
                  <p>Os capítulos lidos pelo leitor serão listados aqui cronologicamente.</p>
                </div>
              {/if}
            {/if}
          </section>

        <!-- TAB: CONQUISTAS -->
        {:else if activeTab === 'achievements'}
          <section class="tab-pane achievements-pane">
            {#if !data.canViewAchievements}
              <div class="privacy-notice-card">
                <div class="privacy-icon-wrap">
                  <Lock size={32} />
                </div>
                <h3>Conquistas Privadas</h3>
                <p>Este leitor optou por manter suas conquistas privadas no seu perfil público.</p>
              </div>
            {:else}
              <!-- Rarity Breakdown Bar (Micro-resumo de Raridades) -->
              <div class="rarity-breakdown-bar">
                <div class="rarity-summary-label">
                  <span>Raridades Desbloqueadas:</span>
                </div>
                <div class="rarity-chips-wrap">
                  {#if data.rarityCounts.MITICA > 0}
                    <span class="rarity-chip mitica">
                      <strong>{data.rarityCounts.MITICA}</strong> Mítica{data.rarityCounts.MITICA > 1 ? 's' : ''}
                    </span>
                  {/if}
                  {#if data.rarityCounts.LENDARIA > 0}
                    <span class="rarity-chip lendaria">
                      <strong>{data.rarityCounts.LENDARIA}</strong> Lendária{data.rarityCounts.LENDARIA > 1 ? 's' : ''}
                    </span>
                  {/if}
                  {#if data.rarityCounts.EPICA > 0}
                    <span class="rarity-chip epica">
                      <strong>{data.rarityCounts.EPICA}</strong> Épica{data.rarityCounts.EPICA > 1 ? 's' : ''}
                    </span>
                  {/if}
                  {#if data.rarityCounts.RARA > 0}
                    <span class="rarity-chip rara">
                      <strong>{data.rarityCounts.RARA}</strong> Rara{data.rarityCounts.RARA > 1 ? 's' : ''}
                    </span>
                  {/if}
                  {#if data.rarityCounts.INCOMUM > 0}
                    <span class="rarity-chip incomum">
                      <strong>{data.rarityCounts.INCOMUM}</strong> Incomum{data.rarityCounts.INCOMUM > 1 ? 'ns' : ''}
                    </span>
                  {/if}
                  {#if data.rarityCounts.COMUM > 0}
                    <span class="rarity-chip comum">
                      <strong>{data.rarityCounts.COMUM}</strong> Comum{data.rarityCounts.COMUM > 1 ? 'ns' : ''}
                    </span>
                  {/if}
                  {#if data.achievements.length === 0}
                    <span class="rarity-chip zero">Nenhuma conquista desbloqueada</span>
                  {/if}
                </div>
              </div>

              {#if data.achievements.length > 0}
                <div class="achievements-catalog-grid">
                  {#each data.achievements as ach (ach.id)}
                    {@const rInfo = getRarityBadgeInfo(ach.rarity)}
                    <div
                      class="achievement-card"
                      style="border-left-color: {rInfo.border};"
                    >
                      <div
                        class="ach-icon-circle"
                        style="background: {ach.badge_color ? `${ach.badge_color}22` : rInfo.bg}; color: {ach.badge_color || rInfo.text}"
                      >
                        <AchievementIcon icon={ach.icon} size={20} />
                      </div>

                      <div class="ach-details">
                        <div class="ach-header-row">
                          <span
                            class="ach-rarity-tag"
                            style="color: {rInfo.text}; border-color: {rInfo.border}; background: {rInfo.bg};"
                          >
                            {rInfo.label}
                          </span>
                          {#if ach.xp_reward}
                            <span class="ach-xp-tag">+{ach.xp_reward} XP</span>
                          {/if}
                        </div>

                        <h4 class="ach-title">{ach.title}</h4>
                        <p class="ach-desc">{ach.description}</p>

                        <div class="ach-footer-meta">
                          <span class="ach-date">
                            <CheckCircle2 size={12} />
                            <span>Desbloqueada {ach.unlocked_at ? `em ${date(ach.unlocked_at)}` : ''}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="achievements-empty">
                  <div class="empty-icon-wrap">
                    <Trophy size={36} />
                  </div>
                  <h3>Jornada Inicial</h3>
                  <p>Este leitor ainda está desbravando os caminhos da biblioteca e forjando suas conquistas.</p>
                </div>
              {/if}
            {/if}
          </section>

        <!-- TAB 2: COLEÇÃO COSMÉTICA -->
        {:else if activeTab === 'cosmetics'}
          <section class="tab-pane cosmetics-pane">
            {#if !data.canViewCosmetics}
              <div class="privacy-notice-card">
                <div class="privacy-icon-wrap">
                  <Lock size={32} />
                </div>
                <h3>Coleção Privada</h3>
                <p>Este leitor optou por manter sua coleção de cosméticos privada no perfil público.</p>
              </div>
            {:else}
              <!-- Cosmetic Filter Pills -->
              <div class="cosmetics-toolbar">
                <div class="filter-pills-row">
                  <button
                    type="button"
                    class="filter-pill"
                    class:active={cosmeticFilter === 'ALL'}
                    onclick={() => (cosmeticFilter = 'ALL')}
                  >
                    <span>Todos</span>
                    <span class="filter-count">{cosmeticCounts.all}</span>
                  </button>
                  <button
                    type="button"
                    class="filter-pill"
                    class:active={cosmeticFilter === 'AVATAR_FRAME'}
                    onclick={() => (cosmeticFilter = 'AVATAR_FRAME')}
                  >
                    <span>Molduras</span>
                    <span class="filter-count">{cosmeticCounts.frames}</span>
                  </button>
                  <button
                    type="button"
                    class="filter-pill"
                    class:active={cosmeticFilter === 'TITLE'}
                    onclick={() => (cosmeticFilter = 'TITLE')}
                  >
                    <span>Títulos</span>
                    <span class="filter-count">{cosmeticCounts.titles}</span>
                  </button>
                  <button
                    type="button"
                    class="filter-pill"
                    class:active={cosmeticFilter === 'PROFILE_BANNER'}
                    onclick={() => (cosmeticFilter = 'PROFILE_BANNER')}
                  >
                    <span>Banners</span>
                    <span class="filter-count">{cosmeticCounts.banners}</span>
                  </button>
                  <button
                    type="button"
                    class="filter-pill"
                    class:active={cosmeticFilter === 'NAME_COLOR'}
                    onclick={() => (cosmeticFilter = 'NAME_COLOR')}
                  >
                    <span>Cores</span>
                    <span class="filter-count">{cosmeticCounts.colors}</span>
                  </button>
                </div>
              </div>

              {#if filteredCosmetics.length > 0}
                <div class="cosmetics-catalog-grid">
                  {#each filteredCosmetics as item (item.id)}
                    {@const rInfo = getRarityBadgeInfo(item.rarity)}
                    {@const equipped = isItemEquipped(item)}
                    <div
                      class="cosmetic-card"
                      class:equipped={equipped}
                      style="border-color: {equipped ? '#dfc28d' : 'rgba(255, 255, 255, 0.08)'};"
                    >
                      <!-- Live Cosmetic Preview Box -->
                      <div class="cosmetic-preview-box">
                        {#if item.kind === 'AVATAR_FRAME'}
                          <div class="preview-avatar-wrap">
                            <div class="preview-frame" style={item.style_data ? Object.entries(item.style_data).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v}`).join(';') : ''}>
                              <div class="preview-avatar-placeholder">
                                {data.member.display_name?.slice(0, 1) || 'N'}
                              </div>
                            </div>
                          </div>
                        {:else if item.kind === 'TITLE'}
                          <div class="preview-title-tag">
                            <Crown size={14} />
                            <span>{item.name}</span>
                          </div>
                        {:else if item.kind === 'PROFILE_BANNER'}
                          <div
                            class="preview-banner-strip"
                            style="background: {item.style_data?.background || 'linear-gradient(135deg, #1e1b4b, #0d101a)'};"
                          ></div>
                        {:else if item.kind === 'NAME_COLOR'}
                          <div
                            class="preview-color-name"
                            style="color: {item.style_data?.color || item.id};"
                          >
                            <span>{data.member.display_name}</span>
                          </div>
                        {:else}
                          <div class="preview-generic-icon">
                            <Sparkles size={24} />
                          </div>
                        {/if}

                        {#if equipped}
                          <div class="equipped-ribbon">
                            <CheckCircle2 size={11} />
                            <span>Em Uso</span>
                          </div>
                        {/if}
                      </div>

                      <!-- Card Details -->
                      <div class="cosmetic-card-body">
                        <div class="cosmetic-tags-row">
                          <span
                            class="cosmetic-rarity-pill"
                            style="color: {rInfo.text}; border-color: {rInfo.border}; background: {rInfo.bg};"
                          >
                            {rInfo.label}
                          </span>
                          <span class="cosmetic-kind-pill">{getCosmeticKindLabel(item.kind)}</span>
                          {#if item.origin}
                            {@const oInfo = getOriginLabel(item.origin)}
                            <span
                              class="cosmetic-origin-pill"
                              style="color: {oInfo.text}; background: {oInfo.bg};"
                            >
                              {oInfo.label}
                            </span>
                          {/if}
                        </div>

                        <h4 class="cosmetic-title">{item.name}</h4>
                        {#if item.description}
                          <p class="cosmetic-desc">{item.description}</p>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="achievements-empty">
                  <div class="empty-icon-wrap">
                    <Palette size={36} />
                  </div>
                  <h3>Nenhum Cosmético</h3>
                  <p>Nenhum cosmético encontrado para esta categoria no acervo do leitor.</p>
                </div>
              {/if}
            {/if}
          </section>
        {/if}
      </div>
    </article>
  </div>
</div>

<style>
  .profile-page {
    min-height: 100vh;
    padding: 2rem 1.5rem 5rem;
    color: #e2e8f0;
    max-width: 100%;
    overflow-x: hidden;
    box-sizing: border-box;
  }

  .profile-container {
    max-width: 900px;
    margin: 0 auto;
  }

  .profile-card {
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 16px 40px -10px rgba(0, 0, 0, 0.7);
  }

  /* Profile Banner */
  .profile-banner-wrap {
    height: 230px;
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

  /* Identity Header */
  .identity-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-top: -50px;
    margin-bottom: 1.25rem;
  }

  .avatar-holder {
    position: relative;
    z-index: 2;
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

  /* Info Block */
  .info-block {
    margin-bottom: 1.75rem;
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
    font-size: 1.85rem;
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
    margin-bottom: 0.85rem;
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

  /* XP Strip */
  .xp-strip {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 0.85rem 1.1rem;
    margin-bottom: 1.5rem;
  }

  .xp-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .xp-rank-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
  }

  .xp-rank-level {
    font-weight: 800;
    color: #dfc28d;
    background: rgba(223, 194, 141, 0.12);
    padding: 0.15rem 0.5rem;
    border-radius: 6px;
    border: 1px solid rgba(223, 194, 141, 0.25);
  }

  .xp-rank-dot {
    color: #64748b;
  }

  .xp-rank-xp {
    font-weight: 700;
    color: #cbd5e1;
  }

  .xp-status-text {
    font-size: 0.78rem;
    color: #94a3b8;
  }

  .xp-status-text strong {
    color: #dfc28d;
  }

  .xp-bar-track {
    height: 7px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 9999px;
    overflow: hidden;
  }

  .xp-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #8b5cf6, #dfc28d);
    border-radius: 9999px;
    box-shadow: 0 0 10px rgba(139, 92, 246, 0.6);
    transition: width 0.4s ease;
  }

  /* High-Impact Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.75rem;
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1rem 0.6rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    text-align: center;
    gap: 0.45rem;
    transition: all 0.2s ease;
  }

  .stat-card-interactive {
    cursor: pointer;
    background: rgba(255, 255, 255, 0.035);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .stat-card-interactive:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(223, 194, 141, 0.4);
    transform: translateY(-2px);
  }

  .stat-card-interactive.active-card {
    background: rgba(223, 194, 141, 0.08);
    border-color: #dfc28d;
    box-shadow: 0 4px 16px rgba(223, 194, 141, 0.15);
  }

  .stat-card-icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    color: #94a3b8;
  }

  .trophy-icon {
    background: rgba(245, 158, 11, 0.12);
    color: #fbbf24;
  }

  .sparkles-icon {
    background: rgba(168, 85, 247, 0.12);
    color: #c084fc;
  }

  .stat-card-data {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    width: 100%;
  }

  .stat-card-num {
    font-size: 1.3rem;
    font-weight: 800;
    color: #ffffff;
    line-height: 1.2;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .stat-num-achievement {
    display: inline-flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.2rem;
  }

  .stat-unlocked {
    color: #dfc28d;
    font-size: 1.3rem;
    font-weight: 800;
  }

  .stat-sep {
    color: #64748b;
    font-size: 0.95rem;
    font-weight: 600;
    margin: 0 0.05rem;
  }

  .stat-total {
    color: #94a3b8;
    font-size: 0.95rem;
    font-weight: 700;
  }

  .stat-card-label {
    font-size: 0.72rem;
    color: #94a3b8;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    line-height: 1.2;
  }

  .stat-label-wrap {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .stat-click-hint {
    font-size: 0.65rem;
    color: #dfc28d;
    font-weight: 700;
    text-transform: uppercase;
    background: rgba(223, 194, 141, 0.15);
    padding: 0.05rem 0.3rem;
    border-radius: 4px;
  }

  .stat-private-row {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: #94a3b8;
    font-size: 0.95rem;
    font-weight: 700;
  }

  .stat-private-txt {
    font-size: 0.85rem;
  }

  /* Featured Achievement Card */
  .featured-achievement-card {
    background: linear-gradient(135deg, rgba(20, 24, 40, 0.9), rgba(14, 17, 29, 0.95));
    border: 1.5px solid rgba(223, 194, 141, 0.3);
    border-radius: 16px;
    overflow: hidden;
    margin-bottom: 2rem;
    transition: all 0.3s ease;
  }

  .featured-top-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 1.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .featured-badge-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: #dfc28d;
  }

  .featured-rarity-pill {
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0.15rem 0.55rem;
    border-radius: 6px;
    border: 1px solid;
  }

  .featured-content-body {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 1.25rem;
  }

  .featured-icon-circle {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .featured-text-block {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    flex-grow: 1;
  }

  .featured-title-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .featured-title {
    font-size: 1.15rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
  }

  .featured-xp-tag {
    font-size: 0.75rem;
    font-weight: 700;
    color: #dfc28d;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.3);
    padding: 0.15rem 0.45rem;
    border-radius: 6px;
  }

  .featured-description {
    font-size: 0.85rem;
    color: #cbd5e1;
    line-height: 1.4;
    margin: 0;
  }

  .featured-meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: #64748b;
    flex-wrap: wrap;
  }

  .featured-unlock-date {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: #34d399;
    font-weight: 600;
  }

  .featured-edit-link {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: #94a3b8;
    text-decoration: none;
    font-weight: 600;
    transition: color 0.2s ease;
  }

  .featured-edit-link:hover {
    color: #dfc28d;
  }

  /* Tabs Header */
  .profile-tabs-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    margin-bottom: 1.5rem;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    width: 100%;
  }

  .profile-tabs-header::-webkit-scrollbar {
    display: none;
  }

  .profile-tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.85rem 1.25rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: #94a3b8;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-bottom: -1px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .profile-tab-btn:hover {
    color: #e2e8f0;
  }

  .profile-tab-btn.active {
    color: #dfc28d;
    border-bottom-color: #dfc28d;
  }

  .tab-count-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.15rem 0.55rem;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    color: #cbd5e1;
  }

  .profile-tab-btn.active .tab-count-pill {
    background: rgba(223, 194, 141, 0.2);
    color: #dfc28d;
  }

  /* Rarity Breakdown Bar */
  .rarity-breakdown-bar {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
  }

  .rarity-summary-label {
    font-size: 0.78rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .rarity-chips-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .rarity-chip {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.6rem;
    border-radius: 6px;
    border: 1px solid transparent;
  }

  .rarity-chip strong {
    font-weight: 800;
  }

  .rarity-chip.mitica {
    color: #fda4af;
    background: rgba(244, 63, 94, 0.15);
    border-color: rgba(244, 63, 94, 0.3);
  }

  .rarity-chip.lendaria {
    color: #fde68a;
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.3);
  }

  .rarity-chip.epica {
    color: #e9d5ff;
    background: rgba(168, 85, 247, 0.15);
    border-color: rgba(168, 85, 247, 0.3);
  }

  .rarity-chip.rara {
    color: #bae6fd;
    background: rgba(56, 189, 248, 0.15);
    border-color: rgba(56, 189, 248, 0.3);
  }

  .rarity-chip.incomum {
    color: #a7f3d0;
    background: rgba(52, 211, 153, 0.15);
    border-color: rgba(52, 211, 153, 0.3);
  }

  .rarity-chip.comum {
    color: #cbd5e1;
    background: rgba(148, 163, 184, 0.12);
    border-color: rgba(148, 163, 184, 0.2);
  }

  .rarity-chip.zero {
    color: #64748b;
  }

  /* Achievements Grid */
  .achievements-catalog-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 0.85rem;
  }

  .achievement-card {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
    padding: 0.95rem 1.1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-left: 3.5px solid #8b5cf6;
    border-radius: 12px;
    transition: all 0.2s ease;
  }

  .achievement-card:hover {
    background: rgba(255, 255, 255, 0.05);
    transform: translateY(-1px);
  }

  .ach-icon-circle {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .ach-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
  }

  .ach-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .ach-rarity-tag {
    font-size: 0.68rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.1rem 0.45rem;
    border-radius: 4px;
    border: 1px solid;
  }

  .ach-xp-tag {
    font-size: 0.72rem;
    font-weight: 700;
    color: #dfc28d;
  }

  .ach-title {
    font-size: 0.92rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .ach-desc {
    font-size: 0.78rem;
    color: #94a3b8;
    line-height: 1.35;
    margin: 0;
  }

  .ach-footer-meta {
    margin-top: 0.25rem;
  }

  .ach-date {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.7rem;
    color: #64748b;
  }

  /* Privacy Notice Card */
  .privacy-notice-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3.5rem 1.5rem;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    text-align: center;
    color: #94a3b8;
    gap: 0.75rem;
  }

  .privacy-icon-wrap {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
  }

  .privacy-notice-card h3 {
    font-size: 1.1rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .privacy-notice-card p {
    font-size: 0.88rem;
    margin: 0;
    max-width: 420px;
    line-height: 1.5;
  }

  /* Empty State */
  .achievements-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3.5rem 1.5rem;
    text-align: center;
    color: #64748b;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 14px;
    gap: 0.6rem;
  }

  .empty-icon-wrap {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
  }

  .achievements-empty h3 {
    font-size: 1.05rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .achievements-empty p {
    font-size: 0.85rem;
    margin: 0;
    max-width: 440px;
    line-height: 1.4;
  }

  /* Cosmetics Tab Toolbar */
  .cosmetics-toolbar {
    margin-bottom: 1.25rem;
  }

  .filter-pills-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .filter-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.8rem;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .filter-pill:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .filter-pill.active {
    background: rgba(223, 194, 141, 0.15);
    border-color: rgba(223, 194, 141, 0.4);
    color: #dfc28d;
  }

  .filter-count {
    font-size: 0.72rem;
    opacity: 0.8;
  }

  /* Cosmetics Catalog Grid */
  .cosmetics-catalog-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
  }

  .cosmetic-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: all 0.2s ease;
  }

  .cosmetic-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.5);
  }

  .cosmetic-card.equipped {
    border-color: rgba(223, 194, 141, 0.5);
    background: linear-gradient(180deg, rgba(223, 194, 141, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
  }

  .cosmetic-preview-box {
    height: 110px;
    width: 100%;
    background: #090c15;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding: 0.75rem;
  }

  .preview-avatar-wrap {
    position: relative;
  }

  .preview-frame {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-avatar-placeholder {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #1e2436;
    color: #cbd5e1;
    font-weight: 800;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-title-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.85rem;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.4);
    border-radius: 9999px;
    color: #dfc28d;
    font-size: 0.85rem;
    font-weight: 800;
  }

  .preview-banner-strip {
    width: 100%;
    height: 70px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .preview-color-name {
    font-size: 1.15rem;
    font-weight: 800;
    letter-spacing: 0.02em;
  }

  .preview-generic-icon {
    color: #dfc28d;
  }

  .equipped-ribbon {
    position: absolute;
    top: 8px;
    right: 8px;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.15rem 0.45rem;
    background: rgba(223, 194, 141, 0.2);
    border: 1px solid #dfc28d;
    border-radius: 4px;
    font-size: 0.65rem;
    font-weight: 800;
    color: #dfc28d;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .cosmetic-card-body {
    padding: 0.85rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .cosmetic-tags-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .cosmetic-rarity-pill {
    font-size: 0.65rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    border: 1px solid;
  }

  .cosmetic-kind-pill {
    font-size: 0.65rem;
    font-weight: 700;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.05);
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
  }

  .cosmetic-origin-pill {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .cosmetic-title {
    font-size: 0.92rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .cosmetic-desc {
    font-size: 0.75rem;
    color: #94a3b8;
    line-height: 1.35;
    margin: 0;
  }

  /* Responsive Media Queries */
  @media (max-width: 860px) {
    .stats-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .profile-page {
      padding: 1rem 0.75rem 4rem;
    }

    .profile-body {
      padding: 0 1rem 2rem;
    }

    .profile-banner-wrap {
      height: 160px;
    }

    .identity-row {
      margin-top: -40px;
      margin-bottom: 1rem;
    }

    .display-name {
      font-size: 1.45rem;
    }

    .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.6rem;
    }

    /* Make the interactive Conquistas card span 2 cols on mobile for ample breathing room */
    .stats-grid > button:nth-child(3) {
      grid-column: span 2;
    }

    .stat-card {
      padding: 0.85rem 0.5rem;
    }

    .stat-card-num {
      font-size: 1.15rem;
    }

    .stat-unlocked {
      font-size: 1.15rem;
    }

    .stat-sep,
    .stat-total {
      font-size: 0.85rem;
    }

    .featured-content-body {
      flex-direction: column;
      text-align: center;
      gap: 0.85rem;
    }

    .featured-title-row {
      justify-content: center;
    }

    .featured-meta-row {
      justify-content: center;
    }

    .cosmetics-catalog-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 0.75rem;
    }

    .achievements-catalog-grid {
      grid-template-columns: 1fr;
    }
  }

  .scan-badges-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .scan-staff-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.25rem 0.65rem;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 9999px;
    font-size: 0.76rem;
    color: #e2e8f0;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .scan-staff-badge:hover {
    background: rgba(139, 92, 246, 0.22);
    border-color: rgba(139, 92, 246, 0.5);
    transform: translateY(-1px);
  }

  .scan-staff-badge.owner {
    background: rgba(223, 194, 141, 0.15);
    border-color: rgba(223, 194, 141, 0.4);
    color: #fef08a;
  }

  .scan-badge-logo {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    object-fit: cover;
  }

  .scan-badge-role {
    font-weight: 700;
  }

  .scan-badge-dot {
    opacity: 0.5;
  }

  .scan-badge-name {
    font-weight: 600;
  }

  .heart-icon {
    color: #f43f5e;
  }

  .works-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1.25rem;
  }

  .readings-list-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .reading-history-card {
    display: flex;
    gap: 0.85rem;
    background: rgba(15, 18, 30, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    padding: 0.75rem;
    transition: all 0.2s ease;
  }

  .reading-history-card:hover {
    border-color: rgba(181, 154, 245, 0.3);
    transform: translateY(-2px);
  }

  .reading-cover-wrap {
    position: relative;
    width: 60px;
    height: 84px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    background: #090a12;
  }

  .reading-cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .reading-cover-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #191c32;
    font-size: 11px;
    font-weight: 800;
    color: #b59af5;
  }

  .reading-adult-tag {
    position: absolute;
    top: 4px;
    left: 4px;
    background: #dc2626;
    color: #ffffff;
    font-size: 9px;
    font-weight: 800;
    padding: 1px 4px;
    border-radius: 3px;
  }

  .reading-details {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.3rem;
    min-width: 0;
  }

  .reading-work-title {
    font-size: 0.92rem;
    font-weight: 700;
    color: #f1f5f9;
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .reading-work-title:hover {
    color: #dfc28d;
  }

  .reading-ch-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .reading-chapter-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: #c4b5fd;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    padding: 0.15rem 0.5rem;
    border-radius: 6px;
    text-decoration: none;
  }

  .reading-chapter-badge:hover {
    background: rgba(139, 92, 246, 0.25);
  }

  .reading-page-info {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .reading-timestamp {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.74rem;
    color: #64748b;
  }

  .self-privacy-hint {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(234, 179, 8, 0.1);
    border: 1px solid rgba(234, 179, 8, 0.25);
    border-radius: 8px;
    color: #fde047;
    font-size: 0.82rem;
    margin-bottom: 1.25rem;
  }

  .empty-tab-state {
    padding: 3.5rem 1.5rem;
    text-align: center;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    color: #64748b;
  }

  .empty-tab-state h4 {
    color: #f1f5f9;
    margin: 0.75rem 0 0.25rem;
    font-size: 1.05rem;
  }

  .empty-tab-state p {
    font-size: 0.85rem;
    margin: 0;
  }
</style>
