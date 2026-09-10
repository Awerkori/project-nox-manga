<script lang="ts">
  import { onMount } from 'svelte';
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import { enhance } from '$app/forms';
  import {
    Sparkles,
    User,
    BookOpen,
    Bookmark,
    Clock,
    Trophy,
    ShoppingBag,
    Download,
    Bell,
    Settings,
    Edit3,
    Crown,
    CheckCircle2,
    AlertCircle,
    Trash2,
    Eye,
    Upload,
    Check,
    Lock,
    Moon,
    Flame,
    Heart,
    Star,
    Zap,
    Shield,
    Compass,
    Award,
    Feather,
    Swords,
    Target,
    Gem,
    Coffee,
    Gift,
    Search,
    Users,
    Library
  } from '@lucide/svelte';
  import UserAvatar from '$lib/components/UserAvatar.svelte';
  import WorkCard from '$lib/components/WorkCard.svelte';
  import { relativeTime, date } from '$lib/types';
  import {
    getOfflineChapters,
    removeOfflineChapter,
    type OfflineChapter
  } from '$lib/offline-storage';

  let { data, form } = $props();

  let achStatusFilter = $state<'ALL' | 'UNLOCKED' | 'LOCKED' | 'SECRET'>('ALL');
  let achCategoryFilter = $state<string>('ALL');

  const categoryLabels: Record<string, string> = {
    ALL: 'Todas as Categorias',
    INICIACAO: 'Iniciação',
    LEITURA: 'Leitura',
    MARATONA: 'Maratonas',
    OBRAS: 'Obras',
    CONCLUSAO: 'Conclusões',
    BIBLIOTECA: 'Biblioteca',
    FAVORITOS: 'Favoritos',
    GENEROS: 'Gêneros',
    EXPLORACAO: 'Exploração',
    SCANS: 'Scans & Parcerias',
    COMUNIDADE: 'Comunidade',
    OFFLINE: 'Offline',
    PROGRESSAO: 'Progressão',
    LOJA: 'Loja',
    SECRETAS: 'Secretas'
  };

  let filteredAchievements = $derived(
    (data.achievements || []).filter((ach: any) => {
      if (achStatusFilter === 'UNLOCKED' && !ach.unlocked) return false;
      if (achStatusFilter === 'LOCKED' && (ach.unlocked || ach.is_secret)) return false;
      if (achStatusFilter === 'SECRET' && !ach.is_secret) return false;
      if (achCategoryFilter !== 'ALL' && ach.category !== achCategoryFilter) return false;
      return true;
    })
  );

  let achStats = $derived.by(() => {
    const list = data.achievements || [];
    const unlocked = list.filter((a: any) => a.unlocked);
    const totalXp = unlocked.reduce((acc: number, a: any) => acc + (a.xp_reward || 0), 0);
    const rarities = ['COMUM', 'INCOMUM', 'RARA', 'EPICA', 'LENDARIA', 'MITICA'] as const;
    const byRarity: Record<string, { total: number; unlocked: number }> = {};
    for (const r of rarities) {
      const items = list.filter((a: any) => a.rarity === r);
      const unl = items.filter((a: any) => a.unlocked);
      byRarity[r] = { total: items.length, unlocked: unl.length };
    }
    return {
      total: list.length,
      unlockedCount: unlocked.length,
      percentage: list.length ? Math.round((unlocked.length / list.length) * 100) : 0,
      totalXp,
      byRarity
    };
  });

  // Active tab synchronized with URL param
  type TabId =
    | 'overview'
    | 'library'
    | 'favorites'
    | 'history'
    | 'achievements'
    | 'inventory'
    | 'downloads'
    | 'notifications'
    | 'edit'
    | 'settings';

  const tabAliases: Record<string, TabId> = {
    overview: 'overview',
    geral: 'overview',
    library: 'library',
    biblioteca: 'library',
    favorites: 'favorites',
    favoritos: 'favorites',
    history: 'history',
    historico: 'history',
    achievements: 'achievements',
    conquistas: 'achievements',
    inventory: 'inventory',
    inventario: 'inventory',
    downloads: 'downloads',
    baixados: 'downloads',
    notifications: 'notifications',
    notificacoes: 'notifications',
    edit: 'edit',
    editar: 'edit',
    settings: 'settings',
    configuracoes: 'settings'
  };

  let activeTab = $state<TabId>('overview');

  $effect(() => {
    const rawParam = page.url.searchParams.get('tab')?.toLowerCase();
    if (rawParam && tabAliases[rawParam] && tabAliases[rawParam] !== activeTab) {
      activeTab = tabAliases[rawParam];
    }
  });

  function switchTab(t: TabId) {
    activeTab = t;
    const url = new URL(window.location.href);
    url.searchParams.set('tab', t);
    goto(url.toString(), { keepFocus: true, noScroll: true, replaceState: true });
  }

  // Library filter status
  let libStatus = $state<'ALL' | 'READING' | 'PLANNED' | 'COMPLETED'>('ALL');
  let filteredLibrary = $derived(
    (data.library || []).filter((item: any) => {
      if (libStatus === 'ALL') return true;
      return item.status === libStatus;
    })
  );

  let favorites = $derived((data.library || []).filter((item: any) => item.favorite));

  // Offline downloads state
  let offlineList = $state<OfflineChapter[]>([]);

  async function loadOfflineList() {
    try {
      offlineList = await getOfflineChapters();
    } catch {
      offlineList = [];
    }
  }

  async function handleDeleteOffline(chapterId: string) {
    await removeOfflineChapter(chapterId);
    await loadOfflineList();
  }

  onMount(() => {
    loadOfflineList();
  });

  // Level computation
  let currentXp = $derived(data.member.xp || 0);
  let userLevel = $derived(Math.floor(Math.sqrt(1 + currentXp / 50)));

  // Media upload states
  let avatarUploading = $state(false);
  let bannerUploading = $state(false);
  let uploadNotice = $state('');

  async function handleAvatarUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];

    avatarUploading = true;
    uploadNotice = '';
    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/avatar', { method: 'POST', body: fd });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Falha ao enviar avatar.');
      uploadNotice = 'Avatar atualizado com sucesso (suporta GIFs animados)!';
      await invalidateAll();
    } catch (err: any) {
      uploadNotice = err.message || 'Erro no envio do avatar.';
    } finally {
      avatarUploading = false;
    }
  }

  async function handleBannerUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];

    bannerUploading = true;
    uploadNotice = '';
    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/banner', { method: 'POST', body: fd });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Falha ao enviar banner.');
      uploadNotice = 'Banner atualizado com sucesso (suporta GIFs animados)!';
      await invalidateAll();
    } catch (err: any) {
      uploadNotice = err.message || 'Erro no envio do banner.';
    } finally {
      bannerUploading = false;
    }
  }
</script>

<svelte:head>
  <title>Meu Espaço | Project Nox</title>
</svelte:head>

<div class="me-page">
  <div class="me-container">
    <!-- Top Identity Strip -->
    <header class="me-header-strip">
      <div class="header-avatar-col">
        <UserAvatar
          avatarId={data.member.avatar_id}
          frameId={data.member.frame_id}
          displayName={data.member.display_name || data.member.username}
          size={72}
        />
      </div>

      <div class="header-details-col">
        <div class="title-row">
          <h1
            class="me-display-name"
            style={data.member.name_color ? `color: ${data.member.name_color}` : ''}
          >
            {data.member.display_name || data.member.username}
          </h1>
          <span class="level-pill">
            <Crown size={13} />
            <span>Nível {userLevel}</span>
          </span>
          {#if data.member.equipped_title_id}
            <span class="cosmetic-title">{data.member.equipped_title_id}</span>
          {/if}
        </div>

        <div class="meta-row">
          <span class="user-handle">@{data.member.username}</span>
          <span class="dot">·</span>
          <span class="xp-chip">
            <Sparkles size={13} />
            <span>{new Intl.NumberFormat('pt-BR').format(currentXp)} XP</span>
          </span>
          <span class="dot">·</span>
          <a href="/u/{data.member.username}" class="public-link">
            <span>Ver perfil público ↗</span>
          </a>
        </div>
      </div>
    </header>

    <!-- Main Tabs Layout -->
    <div class="me-layout">
      <!-- Navigation Sidebar / Tabs -->
      <nav class="me-nav-sidebar" aria-label="Navegação do Meu Espaço">
        <button
          type="button"
          class="me-nav-item"
          class:active={activeTab === 'overview'}
          onclick={() => switchTab('overview')}
        >
          <Sparkles size={17} />
          <span>Visão Geral</span>
        </button>

        <button
          type="button"
          class="me-nav-item"
          class:active={activeTab === 'library'}
          onclick={() => switchTab('library')}
        >
          <BookOpen size={17} />
          <span>Biblioteca</span>
          <span class="count-badge">{data.library.length}</span>
        </button>

        <button
          type="button"
          class="me-nav-item"
          class:active={activeTab === 'favorites'}
          onclick={() => switchTab('favorites')}
        >
          <Bookmark size={17} />
          <span>Favoritos</span>
          <span class="count-badge">{favorites.length}</span>
        </button>

        <button
          type="button"
          class="me-nav-item"
          class:active={activeTab === 'history'}
          onclick={() => switchTab('history')}
        >
          <Clock size={17} />
          <span>Histórico</span>
        </button>

        <button
          type="button"
          class="me-nav-item"
          class:active={activeTab === 'achievements'}
          onclick={() => switchTab('achievements')}
        >
          <Trophy size={17} />
          <span>Conquistas</span>
        </button>

        <button
          type="button"
          class="me-nav-item"
          class:active={activeTab === 'inventory'}
          onclick={() => switchTab('inventory')}
        >
          <ShoppingBag size={17} />
          <span>Cosméticos</span>
        </button>

        <button
          type="button"
          class="me-nav-item"
          class:active={activeTab === 'downloads'}
          onclick={() => switchTab('downloads')}
        >
          <Download size={17} />
          <span>Downloads</span>
          {#if offlineList.length > 0}
            <span class="count-badge highlight">{offlineList.length}</span>
          {/if}
        </button>

        <button
          type="button"
          class="me-nav-item"
          class:active={activeTab === 'notifications'}
          onclick={() => switchTab('notifications')}
        >
          <Bell size={17} />
          <span>Notificações</span>
          <span class="count-badge">{data.notifications.filter((n: any) => !n.read_at).length}</span>
        </button>

        <div class="nav-separator"></div>

        <button
          type="button"
          class="me-nav-item"
          class:active={activeTab === 'edit'}
          onclick={() => switchTab('edit')}
        >
          <Edit3 size={17} />
          <span>Editar Perfil</span>
        </button>

        <button
          type="button"
          class="me-nav-item"
          class:active={activeTab === 'settings'}
          onclick={() => switchTab('settings')}
        >
          <Settings size={17} />
          <span>Configurações</span>
        </button>
      </nav>

      <!-- Tab View Pane -->
      <main class="me-content-pane">
        {#if activeTab === 'overview'}
          <!-- 1. Overview -->
          <div class="pane-section">
            <h2 class="pane-title">Visão Geral</h2>

            <div class="overview-stats-grid">
              <div class="ov-card">
                <span class="ov-num">{data.library.length}</span>
                <span class="ov-lbl">Obras na Biblioteca</span>
              </div>
              <div class="ov-card">
                <span class="ov-num">{favorites.length}</span>
                <span class="ov-lbl">Obras Favoritadas</span>
              </div>
              <div class="ov-card">
                <span class="ov-num">{data.history.length}</span>
                <span class="ov-lbl">Capítulos Lidos</span>
              </div>
              <div class="ov-card">
                <span class="ov-num">{data.achievements.filter((a: any) => a.unlocked).length}</span>
                <span class="ov-lbl">Conquistas Desbloqueadas</span>
              </div>
            </div>

            <!-- Quick Continue Reading -->
            {#if data.history.length > 0}
              <div class="sub-block">
                <div class="sub-header">
                  <h3>Leituras Recentes</h3>
                  <button type="button" class="btn-text" onclick={() => switchTab('history')}>
                    Ver histórico completo ↗
                  </button>
                </div>

                <div class="recent-history-list">
                  {#each data.history.slice(0, 5) as item (item.chapter_id)}
                    <a href="/ler/{item.chapter_id}" class="history-item-row">
                      {#if item.chapters?.works?.cover_id}
                        <img
                          src="/media/{item.chapters.works.cover_id}"
                          alt={item.chapters.works.title}
                          class="h-mini-cover"
                        />
                      {/if}
                      <div class="h-meta">
                        <span class="h-work">{item.chapters?.works?.title}</span>
                        <span class="h-ch">Capítulo {item.chapters?.number} · Pág. {item.page}</span>
                      </div>
                      <span class="h-time">{relativeTime(item.updated_at)}</span>
                    </a>
                  {/each}
                </div>
              </div>
            {/if}
          </div>

        {:else if activeTab === 'library'}
          <!-- 2. Library -->
          <div class="pane-section">
            <div class="sub-header">
              <h2 class="pane-title">Minha Biblioteca ({filteredLibrary.length})</h2>
              <div class="filter-pills">
                <button
                  type="button"
                  class="pill-btn"
                  class:active={libStatus === 'ALL'}
                  onclick={() => (libStatus = 'ALL')}
                >
                  Todas
                </button>
                <button
                  type="button"
                  class="pill-btn"
                  class:active={libStatus === 'READING'}
                  onclick={() => (libStatus = 'READING')}
                >
                  Lendo
                </button>
                <button
                  type="button"
                  class="pill-btn"
                  class:active={libStatus === 'PLANNED'}
                  onclick={() => (libStatus = 'PLANNED')}
                >
                  Para Ler
                </button>
                <button
                  type="button"
                  class="pill-btn"
                  class:active={libStatus === 'COMPLETED'}
                  onclick={() => (libStatus = 'COMPLETED')}
                >
                  Concluídas
                </button>
              </div>
            </div>

            {#if filteredLibrary.length > 0}
              <div class="works-grid">
                {#each filteredLibrary as item (item.work_id)}
                  <WorkCard work={item.works} />
                {/each}
              </div>
            {:else}
              <div class="empty-state">
                <BookOpen size={36} />
                <p>Nenhuma obra nesta categoria.</p>
              </div>
            {/if}
          </div>

        {:else if activeTab === 'favorites'}
          <!-- 3. Favorites -->
          <div class="pane-section">
            <h2 class="pane-title">Obras Favoritas ({favorites.length})</h2>
            {#if favorites.length > 0}
              <div class="works-grid">
                {#each favorites as item (item.work_id)}
                  <WorkCard work={item.works} />
                {/each}
              </div>
            {:else}
              <div class="empty-state">
                <Bookmark size={36} />
                <p>Você ainda não favoritou nenhuma obra.</p>
              </div>
            {/if}
          </div>

        {:else if activeTab === 'history'}
          <!-- 4. History -->
          <div class="pane-section">
            <h2 class="pane-title">Histórico de Leitura ({data.history.length})</h2>
            {#if data.history.length > 0}
              <div class="history-table">
                {#each data.history as item (item.chapter_id)}
                  <a href="/ler/{item.chapter_id}" class="history-item-row">
                    {#if item.chapters?.works?.cover_id}
                      <img
                        src="/media/{item.chapters.works.cover_id}"
                        alt={item.chapters.works.title}
                        class="h-mini-cover"
                      />
                    {/if}
                    <div class="h-meta">
                      <span class="h-work">{item.chapters?.works?.title}</span>
                      <span class="h-ch">Capítulo {item.chapters?.number} {item.completed_at ? '✓ Concluído' : `· Pág. ${item.page}`}</span>
                    </div>
                    <span class="h-time">{relativeTime(item.updated_at)}</span>
                  </a>
                {/each}
              </div>
            {:else}
              <div class="empty-state">
                <Clock size={36} />
                <p>Seu histórico de leitura está vazio.</p>
              </div>
            {/if}
          </div>

        {:else if activeTab === 'achievements'}
          <!-- 5. Achievements (Redesigned) -->
          <div class="pane-section achievements-pane">
            <div class="ach-header-block">
              <div class="ach-header-title-row">
                <div>
                  <h2 class="pane-title">Conquistas & Distintivos Cósmicos</h2>
                  <p class="ach-header-sub">
                    {achStats.unlockedCount} de {achStats.total} desbloqueadas ({achStats.percentage}%) · <strong>+{achStats.totalXp} XP</strong> conquistados
                  </p>
                </div>
                <div class="ach-progress-pill">
                  <div class="ach-progress-fill" style="width: {achStats.percentage}%"></div>
                  <span class="ach-progress-num">{achStats.percentage}%</span>
                </div>
              </div>

              <!-- Rarity counters row -->
              <div class="ach-rarity-breakdown">
                <div class="rarity-stat-chip rarity-comum">
                  <span class="r-dot"></span>
                  <span class="r-name">Comum</span>
                  <span class="r-count">{achStats.byRarity['COMUM']?.unlocked || 0}/{achStats.byRarity['COMUM']?.total || 0}</span>
                </div>
                <div class="rarity-stat-chip rarity-incomum">
                  <span class="r-dot"></span>
                  <span class="r-name">Incomum</span>
                  <span class="r-count">{achStats.byRarity['INCOMUM']?.unlocked || 0}/{achStats.byRarity['INCOMUM']?.total || 0}</span>
                </div>
                <div class="rarity-stat-chip rarity-rara">
                  <span class="r-dot"></span>
                  <span class="r-name">Rara</span>
                  <span class="r-count">{achStats.byRarity['RARA']?.unlocked || 0}/{achStats.byRarity['RARA']?.total || 0}</span>
                </div>
                <div class="rarity-stat-chip rarity-epica">
                  <span class="r-dot"></span>
                  <span class="r-name">Épica</span>
                  <span class="r-count">{achStats.byRarity['EPICA']?.unlocked || 0}/{achStats.byRarity['EPICA']?.total || 0}</span>
                </div>
                <div class="rarity-stat-chip rarity-lendaria">
                  <span class="r-dot"></span>
                  <span class="r-name">Lendária</span>
                  <span class="r-count">{achStats.byRarity['LENDARIA']?.unlocked || 0}/{achStats.byRarity['LENDARIA']?.total || 0}</span>
                </div>
                <div class="rarity-stat-chip rarity-mitica">
                  <span class="r-dot"></span>
                  <span class="r-name">Mítica</span>
                  <span class="r-count">{achStats.byRarity['MITICA']?.unlocked || 0}/{achStats.byRarity['MITICA']?.total || 0}</span>
                </div>
              </div>
            </div>

            <!-- Filter Controls -->
            <div class="ach-toolbar">
              <div class="ach-status-chips">
                <button
                  type="button"
                  class="ach-tab-chip"
                  class:active={achStatusFilter === 'ALL'}
                  onclick={() => (achStatusFilter = 'ALL')}
                >
                  Todas ({achStats.total})
                </button>
                <button
                  type="button"
                  class="ach-tab-chip"
                  class:active={achStatusFilter === 'UNLOCKED'}
                  onclick={() => (achStatusFilter = 'UNLOCKED')}
                >
                  Desbloqueadas ({achStats.unlockedCount})
                </button>
                <button
                  type="button"
                  class="ach-tab-chip"
                  class:active={achStatusFilter === 'LOCKED'}
                  onclick={() => (achStatusFilter = 'LOCKED')}
                >
                  Bloqueadas ({achStats.total - achStats.unlockedCount})
                </button>
                <button
                  type="button"
                  class="ach-tab-chip"
                  class:active={achStatusFilter === 'SECRET'}
                  onclick={() => (achStatusFilter = 'SECRET')}
                >
                  Secretas ({data.achievements.filter((a: any) => a.is_secret).length})
                </button>
              </div>

              <div class="ach-category-select-wrap">
                <select class="ach-category-select" bind:value={achCategoryFilter}>
                  {#each Object.entries(categoryLabels) as [catKey, catLabel]}
                    <option value={catKey}>{catLabel}</option>
                  {/each}
                </select>
              </div>
            </div>

            <!-- Achievements Cards Grid -->
            <div class="achievements-catalog-grid">
              {#each filteredAchievements as ach (ach.id)}
                {@const isSecretLocked = ach.is_secret && !ach.unlocked}
                {@const rarityClass = `rarity-${ach.rarity.toLowerCase()}`}
                <div
                  class="ach-catalog-card {rarityClass}"
                  class:unlocked={ach.unlocked}
                  class:is-secret-locked={isSecretLocked}
                >
                  <div
                    class="ach-icon-circle"
                    style="background: {ach.unlocked ? `${ach.badge_color || '#8b5cf6'}22` : 'rgba(255, 255, 255, 0.04)'}; color: {ach.unlocked ? (ach.badge_color || '#c4b5fd') : '#64748b'}"
                  >
                    {#if isSecretLocked}
                      <Lock size={18} />
                    {:else if ach.icon === 'Moon'}
                      <Moon size={18} />
                    {:else if ach.icon === 'Flame'}
                      <Flame size={18} />
                    {:else if ach.icon === 'Heart'}
                      <Heart size={18} />
                    {:else if ach.icon === 'Eye'}
                      <Eye size={18} />
                    {:else if ach.icon === 'Download'}
                      <Download size={18} />
                    {:else if ach.icon === 'Crown'}
                      <Crown size={18} />
                    {:else if ach.icon === 'Star'}
                      <Star size={18} />
                    {:else if ach.icon === 'Zap'}
                      <Zap size={18} />
                    {:else if ach.icon === 'Shield'}
                      <Shield size={18} />
                    {:else if ach.icon === 'Compass'}
                      <Compass size={18} />
                    {:else if ach.icon === 'Award'}
                      <Award size={18} />
                    {:else if ach.icon === 'Feather'}
                      <Feather size={18} />
                    {:else if ach.icon === 'Swords'}
                      <Swords size={18} />
                    {:else if ach.icon === 'Target'}
                      <Target size={18} />
                    {:else if ach.icon === 'Gem'}
                      <Gem size={18} />
                    {:else if ach.icon === 'Coffee'}
                      <Coffee size={18} />
                    {:else if ach.icon === 'Gift'}
                      <Gift size={18} />
                    {:else if ach.icon === 'Search'}
                      <Search size={18} />
                    {:else if ach.icon === 'Users'}
                      <Users size={18} />
                    {:else if ach.icon === 'CheckCircle2'}
                      <CheckCircle2 size={18} />
                    {:else if ach.icon === 'Library'}
                      <Library size={18} />
                    {:else if ach.icon === 'Sparkles'}
                      <Sparkles size={18} />
                    {:else if ach.icon === 'BookOpen'}
                      <BookOpen size={18} />
                    {:else}
                      <Trophy size={18} />
                    {/if}
                  </div>

                  <div class="ach-content">
                    <div class="ach-top">
                      <div class="ach-tags-row">
                        <span class="ach-rarity-badge">{ach.rarity}</span>
                        <span class="ach-category-tag">{categoryLabels[ach.category] || ach.category}</span>
                      </div>
                      <span class="ach-xp">+{ach.xp_reward} XP</span>
                    </div>

                    <h4 class="ach-title">
                      {#if isSecretLocked}
                        ???
                      {:else}
                        {ach.title}
                      {/if}
                    </h4>

                    <p class="ach-desc">
                      {#if isSecretLocked}
                        Conquista secreta oculta nas sombras. Continue explorando o Project Nox para desvendá-la.
                      {:else}
                        {ach.description}
                      {/if}
                    </p>

                    <div class="ach-footer">
                      {#if ach.unlocked}
                        <span class="unlocked-tag">
                          <CheckCircle2 size={12} />
                          <span>Desbloqueada {ach.unlocked_at ? `em ${date(ach.unlocked_at)}` : ''}</span>
                        </span>
                      {:else if isSecretLocked}
                        <span class="secret-tag">
                          <Lock size={12} />
                          <span>Conquista Secreta</span>
                        </span>
                      {:else}
                        <span class="locked-tag">
                          <Lock size={12} />
                          <span>Bloqueada</span>
                        </span>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}

              {#if !filteredAchievements.length}
                <div class="empty-state col-span-all">
                  <Trophy size={36} class="muted" />
                  <p>Nenhuma conquista encontrada com os filtros selecionados.</p>
                </div>
              {/if}
            </div>
          </div>

        {:else if activeTab === 'inventory'}
          <!-- 6. Inventory -->
          <div class="pane-section">
            <div class="sub-header">
              <h2 class="pane-title">Meus Cosméticos ({data.inventory.length})</h2>
              <a href="/loja" class="btn-primary-subtle">Ir para a Loja Nox ↗</a>
            </div>

            {#if data.inventory.length > 0}
              <div class="inventory-grid">
                {#each data.inventory as item (item.id)}
                  <div class="inv-card">
                    <h4>{item.name}</h4>
                    <p>{item.description}</p>
                    <span class="inv-kind">{item.kind}</span>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="empty-state">
                <ShoppingBag size={36} />
                <p>Você ainda não possui itens cosméticos. Visite a Loja Nox para adquirir molduras e cores!</p>
                <a href="/loja" class="btn-primary">Visitar Loja Nox</a>
              </div>
            {/if}
          </div>

        {:else if activeTab === 'downloads'}
          <!-- 7. Offline Downloads -->
          <div class="pane-section">
            <div class="sub-header">
              <h2 class="pane-title">Capítulos Salvos Offline ({offlineList.length})</h2>
            </div>

            {#if offlineList.length > 0}
              <div class="offline-chapters-list">
                {#each offlineList as ch (ch.chapterId)}
                  <div class="offline-row">
                    <div class="off-info">
                      <span class="off-work">{ch.workTitle}</span>
                      <span class="off-ch">Capítulo {ch.number} ({ch.totalPages} páginas)</span>
                    </div>
                    <div class="off-actions">
                      <a href="/ler/{ch.chapterId}" class="btn-read-offline">Ler</a>
                      <button
                        type="button"
                        class="btn-trash"
                        aria-label="Excluir download"
                        onclick={() => handleDeleteOffline(ch.chapterId)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="empty-state">
                <Download size={36} />
                <p>Nenhum capítulo baixado para leitura offline no momento.</p>
              </div>
            {/if}
          </div>

        {:else if activeTab === 'notifications'}
          <!-- 8. Notifications -->
          <div class="pane-section">
            <div class="sub-header">
              <h2 class="pane-title">Notificações</h2>
              {#if data.notifications.some((n: any) => !n.read_at)}
                <form method="POST" action="?/markAllNotificationsRead" use:enhance>
                  <button type="submit" class="btn-text">Marcar todas como lidas</button>
                </form>
              {/if}
            </div>

            {#if data.notifications.length > 0}
              <div class="notifs-list">
                {#each data.notifications as n (n.id)}
                  <div class="notif-item" class:unread={!n.read_at}>
                    <div class="notif-content">
                      <p class="notif-body">{n.body || 'Notificação'}</p>
                      <span class="notif-time">{relativeTime(n.created_at)}</span>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="empty-state">
                <Bell size={36} />
                <p>Nenhuma notificação recebida.</p>
              </div>
            {/if}
          </div>

        {:else if activeTab === 'edit'}
          <!-- 9. Edit Profile -->
          <div class="pane-section">
            <h2 class="pane-title">Editar Perfil</h2>

            {#if uploadNotice}
              <div class="info-toast">
                <CheckCircle2 size={16} />
                <span>{uploadNotice}</span>
              </div>
            {/if}

            <!-- Avatar & Banner Uploaders -->
            <div class="media-uploaders-grid">
              <!-- Avatar Upload -->
              <div class="uploader-box">
                <span class="upload-label">Foto de Perfil (Suporta GIFs)</span>
                <div class="avatar-preview-wrap">
                  <UserAvatar
                    avatarId={data.member.avatar_id}
                    frameId={data.member.frame_id}
                    displayName={data.member.display_name || data.member.username}
                    size={80}
                  />
                </div>
                <label class="btn-file-upload">
                  <Upload size={14} />
                  <span>{avatarUploading ? 'Enviando GIF...' : 'Escolher Avatar (GIF/PNG)'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onchange={handleAvatarUpload}
                    disabled={avatarUploading}
                    hidden
                  />
                </label>
              </div>

              <!-- Banner Upload -->
              <div class="uploader-box">
                <span class="upload-label">Banner de Perfil (Suporta GIFs)</span>
                <div class="banner-preview-box">
                  {#if data.member.banner_id}
                    <img src="/media/{data.member.banner_id}" alt="Banner atual" class="banner-preview-img" />
                  {:else}
                    <div class="banner-preview-placeholder">Nenhum banner</div>
                  {/if}
                </div>
                <label class="btn-file-upload">
                  <Upload size={14} />
                  <span>{bannerUploading ? 'Enviando GIF...' : 'Escolher Banner (GIF/PNG)'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onchange={handleBannerUpload}
                    disabled={bannerUploading}
                    hidden
                  />
                </label>
              </div>
            </div>

            <!-- Profile Info Form -->
            <form method="POST" action="?/updateProfile" use:enhance class="profile-form">
              {#if form?.success && form?.action === 'profile'}
                <div class="success-banner">
                  <CheckCircle2 size={16} />
                  <span>Informações do perfil salvas com sucesso!</span>
                </div>
              {/if}
              {#if (form as any)?.message && (form as any)?.action === 'profile'}
                <div class="error-banner">
                  <AlertCircle size={16} />
                  <span>{(form as any).message}</span>
                </div>
              {/if}

              <div class="form-field">
                <label for="display_name">Nome de Exibição</label>
                <input
                  id="display_name"
                  name="display_name"
                  type="text"
                  value={data.member.display_name}
                  required
                  minlength="2"
                  maxlength="50"
                />
              </div>

              <div class="form-field">
                <label for="bio">Biografia</label>
                <textarea
                  id="bio"
                  name="bio"
                  rows="4"
                  maxlength="500"
                  placeholder="Escreva algo sobre seus gostos de mangás..."
                >{data.member.bio || ''}</textarea>
              </div>

              <button type="submit" class="btn-primary">Salvar Alterações</button>
            </form>
          </div>

        {:else if activeTab === 'settings'}
          <!-- 10. Settings -->
          <div class="pane-section">
            <h2 class="pane-title">Configurações da Conta</h2>

            <form method="POST" action="?/updateSettings" use:enhance class="settings-form">
              {#if form?.success && form?.action === 'settings'}
                <div class="success-banner">
                  <CheckCircle2 size={16} />
                  <span>Preferências salvas!</span>
                </div>
              {/if}

              <div class="settings-row">
                <div>
                  <h4>Ocultar capas adultas (+18)</h4>
                  <p>Aplica efeito de desfoque nas capas de obras adultas em listas e catálogo.</p>
                </div>
                <input
                  type="checkbox"
                  name="blur_nsfw"
                  checked={data.member.blur_nsfw}
                  class="toggle-input"
                />
              </div>

              <button type="submit" class="btn-primary">Salvar Configurações</button>
            </form>
          </div>
        {/if}
      </main>
    </div>
  </div>
</div>

<style>
  .me-page {
    min-height: 100vh;
    padding: 2rem 1.5rem 5rem;
    color: #e2e8f0;
  }

  .me-container {
    max-width: 1360px;
    margin: 0 auto;
  }

  /* Identity Strip */
  .me-header-strip {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    padding: 1.5rem 2rem;
    margin-bottom: 2rem;
  }

  .header-details-col {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .me-display-name {
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 1.6rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
  }

  .level-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2rem 0.6rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    color: #c4b5fd;
  }

  .cosmetic-title {
    padding: 0.2rem 0.6rem;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.4);
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    color: #dfc28d;
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.85rem;
    color: #94a3b8;
  }

  .xp-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: #dfc28d;
    font-weight: 700;
  }

  .public-link {
    color: #c4b5fd;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .public-link:hover {
    color: #ffffff;
  }

  /* Layout */
  .me-layout {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 2rem;
  }

  .me-nav-sidebar {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .me-nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 12px;
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
  }

  .me-nav-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #ffffff;
  }

  .me-nav-item.active {
    background: rgba(139, 92, 246, 0.18);
    color: #ffffff;
    font-weight: 700;
  }

  .count-badge {
    margin-left: auto;
    padding: 0.15rem 0.45rem;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 9999px;
    font-size: 0.72rem;
  }

  .count-badge.highlight {
    background: #8b5cf6;
    color: #ffffff;
  }

  .nav-separator {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 0.75rem 0;
  }

  /* Panes */
  .me-content-pane {
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 2rem;
  }

  .pane-title {
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 1.4rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 1.5rem;
  }

  .sub-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  .overview-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .ov-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .ov-num {
    font-size: 1.5rem;
    font-weight: 800;
    color: #ffffff;
  }

  .ov-lbl {
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .filter-pills {
    display: flex;
    gap: 0.4rem;
  }

  .pill-btn {
    padding: 0.35rem 0.8rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #94a3b8;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }

  .pill-btn.active {
    background: rgba(139, 92, 246, 0.2);
    border-color: #8b5cf6;
    color: #ffffff;
  }

  .works-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 1.25rem;
  }

  /* History list */
  .history-item-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 10px;
    text-decoration: none;
    color: inherit;
    transition: background 0.2s ease;
    margin-bottom: 0.5rem;
  }

  .history-item-row:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .h-mini-cover {
    width: 38px;
    height: 52px;
    object-fit: cover;
    border-radius: 6px;
  }

  .h-meta {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .h-work {
    font-weight: 700;
    color: #ffffff;
  }

  .h-ch {
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .h-time {
    font-size: 0.78rem;
    color: #64748b;
  }

  /* Achievements Pane & Catalog */
  .achievements-pane {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .ach-header-block {
    background: rgba(13, 16, 26, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    backdrop-filter: blur(12px);
  }

  .ach-header-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .ach-header-sub {
    font-size: 0.85rem;
    color: #94a3b8;
    margin: 0.25rem 0 0;
  }

  .ach-header-sub strong {
    color: #dfc28d;
  }

  .ach-progress-pill {
    position: relative;
    width: 140px;
    height: 24px;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ach-progress-fill {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: linear-gradient(90deg, #8b5cf6, #c084fc);
    border-radius: 12px;
    transition: width 0.4s ease;
  }

  .ach-progress-num {
    position: relative;
    z-index: 2;
    font-size: 0.72rem;
    font-weight: 800;
    color: #ffffff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }

  .ach-rarity-breakdown {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .rarity-stat-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.65rem;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    font-size: 0.72rem;
  }

  .r-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .rarity-comum .r-dot { background: #94a3b8; }
  .rarity-incomum .r-dot { background: #34d399; }
  .rarity-rara .r-dot { background: #60a5fa; }
  .rarity-epica .r-dot { background: #c084fc; }
  .rarity-lendaria .r-dot { background: #fbbf24; }
  .rarity-mitica .r-dot { background: #f43f5e; box-shadow: 0 0 6px #f43f5e; }

  .r-name {
    color: #cbd5e1;
    font-weight: 600;
  }

  .r-count {
    color: #8c899e;
    font-weight: 700;
  }

  /* Toolbar */
  .ach-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .ach-status-chips {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .ach-tab-chip {
    padding: 0.45rem 0.85rem;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    color: #94a3b8;
    font-size: 0.76rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .ach-tab-chip:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #ffffff;
  }

  .ach-tab-chip.active {
    background: rgba(139, 92, 246, 0.18);
    border-color: rgba(139, 92, 246, 0.45);
    color: #ffffff;
  }

  .ach-category-select-wrap {
    min-width: 180px;
  }

  .ach-category-select {
    width: 100%;
    padding: 0.45rem 0.85rem;
    border-radius: 8px;
    background: rgba(13, 16, 26, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
    font-size: 0.78rem;
    outline: none;
    cursor: pointer;
  }

  .ach-category-select:focus {
    border-color: #8b5cf6;
  }

  /* Cards Grid */
  .achievements-catalog-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
    gap: 1rem;
  }

  .ach-catalog-card {
    display: flex;
    gap: 1rem;
    padding: 1.1rem;
    background: rgba(13, 16, 26, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 14px;
    opacity: 0.65;
    transition: all 0.2s ease;
    backdrop-filter: blur(8px);
  }

  .ach-catalog-card:hover {
    opacity: 0.85;
    border-color: rgba(255, 255, 255, 0.12);
    transform: translateY(-2px);
  }

  .ach-catalog-card.unlocked {
    opacity: 1;
    background: rgba(18, 22, 34, 0.85);
  }

  .ach-catalog-card.unlocked.rarity-comum {
    border-color: rgba(148, 163, 184, 0.3);
  }

  .ach-catalog-card.unlocked.rarity-incomum {
    border-color: rgba(52, 211, 153, 0.4);
    box-shadow: 0 4px 16px rgba(52, 211, 153, 0.08);
  }

  .ach-catalog-card.unlocked.rarity-rara {
    border-color: rgba(96, 165, 250, 0.4);
    box-shadow: 0 4px 18px rgba(96, 165, 250, 0.1);
  }

  .ach-catalog-card.unlocked.rarity-epica {
    border-color: rgba(192, 132, 252, 0.45);
    box-shadow: 0 4px 22px rgba(192, 132, 252, 0.15);
  }

  .ach-catalog-card.unlocked.rarity-lendaria {
    border-color: rgba(251, 191, 36, 0.5);
    box-shadow: 0 4px 26px rgba(251, 191, 36, 0.18);
    background: linear-gradient(180deg, rgba(251, 191, 36, 0.05) 0%, rgba(18, 22, 34, 0.85) 100%);
  }

  .ach-catalog-card.unlocked.rarity-mitica {
    border-color: rgba(244, 63, 94, 0.6);
    box-shadow: 0 4px 30px rgba(244, 63, 94, 0.25);
    background: linear-gradient(180deg, rgba(244, 63, 94, 0.08) 0%, rgba(18, 22, 34, 0.9) 100%);
  }

  .ach-catalog-card.is-secret-locked {
    border-style: dashed;
    background: rgba(10, 12, 20, 0.4);
  }

  .ach-icon-circle {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .ach-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    gap: 0.35rem;
  }

  .ach-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .ach-tags-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .ach-rarity-badge {
    font-size: 0.65rem;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 4px;
    letter-spacing: 0.05em;
  }

  .rarity-comum .ach-rarity-badge { background: rgba(148, 163, 184, 0.15); color: #94a3b8; }
  .rarity-incomum .ach-rarity-badge { background: rgba(52, 211, 153, 0.15); color: #34d399; }
  .rarity-rara .ach-rarity-badge { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
  .rarity-epica .ach-rarity-badge { background: rgba(192, 132, 252, 0.15); color: #c084fc; }
  .rarity-lendaria .ach-rarity-badge { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
  .rarity-mitica .ach-rarity-badge { background: rgba(244, 63, 94, 0.15); color: #f43f5e; }

  .ach-category-tag {
    font-size: 0.65rem;
    color: #64748b;
    font-weight: 600;
  }

  .ach-xp {
    font-size: 0.72rem;
    font-weight: 800;
    color: #dfc28d;
    flex-shrink: 0;
  }

  .ach-title {
    font-size: 0.92rem;
    font-weight: 750;
    color: #ffffff;
    margin: 0;
  }

  .ach-desc {
    font-size: 0.78rem;
    color: #94a3b8;
    line-height: 1.35;
    margin: 0;
  }

  .ach-footer {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: auto;
    padding-top: 0.35rem;
  }

  .unlocked-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
    color: #34d399;
    font-weight: 700;
  }

  .secret-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
    color: #c084fc;
    font-weight: 600;
  }

  .locked-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
    color: #64748b;
    font-weight: 600;
  }

  .col-span-all {
    grid-column: 1 / -1;
  }

  /* Offline Downloads */
  .offline-chapters-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .offline-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 1.25rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 10px;
  }

  .off-info {
    display: flex;
    flex-direction: column;
  }

  .off-work {
    font-weight: 700;
    color: #ffffff;
  }

  .off-ch {
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .off-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .btn-read-offline {
    padding: 0.45rem 1rem;
    background: #8b5cf6;
    color: #ffffff;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 700;
    text-decoration: none;
  }

  .btn-trash {
    padding: 0.45rem;
    background: rgba(239, 68, 68, 0.15);
    border: none;
    border-radius: 8px;
    color: #ef4444;
    cursor: pointer;
  }

  /* Edit Profile Media */
  .media-uploaders-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .uploader-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    text-align: center;
  }

  .upload-label {
    font-size: 0.85rem;
    font-weight: 700;
    color: #cbd5e1;
  }

  .banner-preview-box {
    width: 100%;
    height: 80px;
    border-radius: 10px;
    overflow: hidden;
    background: #141724;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .banner-preview-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .banner-preview-placeholder {
    font-size: 0.8rem;
    color: #64748b;
  }

  .btn-file-upload {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1.25rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.35);
    border-radius: 10px;
    color: #c4b5fd;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-file-upload:hover {
    background: rgba(139, 92, 246, 0.25);
    color: #ffffff;
  }

  .profile-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    max-width: 540px;
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
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1.5rem;
    background: #8b5cf6;
    color: #ffffff;
    border: none;
    border-radius: 10px;
    font-weight: 700;
    font-size: 0.9rem;
    cursor: pointer;
    text-decoration: none;
    width: fit-content;
  }

  .btn-primary:hover {
    background: #7c3aed;
  }

  .empty-state {
    padding: 4rem 2rem;
    text-align: center;
    color: #64748b;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .empty-state p {
    margin: 0;
    font-size: 0.95rem;
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
  }

  .info-toast {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 8px;
    color: #c4b5fd;
    font-size: 0.88rem;
    margin-bottom: 1.5rem;
  }

  .settings-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    margin-bottom: 1.5rem;
  }

  .settings-row h4 {
    margin: 0 0 0.25rem;
    font-size: 0.95rem;
    color: #ffffff;
  }

  .settings-row p {
    margin: 0;
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .toggle-input {
    width: 20px;
    height: 20px;
    accent-color: #8b5cf6;
    cursor: pointer;
  }

  @media (max-width: 900px) {
    .me-layout {
      grid-template-columns: 1fr;
    }

    .me-nav-sidebar {
      flex-direction: row;
      overflow-x: auto;
      padding-bottom: 0.5rem;
    }

    .me-nav-item {
      white-space: nowrap;
    }

    .media-uploaders-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
