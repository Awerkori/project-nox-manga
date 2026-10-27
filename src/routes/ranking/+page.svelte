<script lang="ts">
  import Empty from '$lib/components/Empty.svelte';
  import {
    Sparkles,
    Trophy,
    Calendar,
    Clock,
    ShieldCheck,
    ChevronDown,
    ChevronUp,
    ChevronLeft,
    ChevronRight,
    Search,
    X,
    Award,
    HelpCircle,
    Crosshair,
    ExternalLink,
    Lock,
    Check
  } from '@lucide/svelte';
  import UserAvatar from '$lib/components/UserAvatar.svelte';
  import {
    NOX_SEASON_ACHIEVEMENT_TITLES,
    NOX_HALL_OF_FAME_TITLES
  } from '$lib/levels';

  let { data } = $props();

  // Modals
  let showRulesModal = $state(false);
  let showTitlesModal = $state(false);

  $effect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        showRulesModal = false;
        showTitlesModal = false;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Search state
  let searchQuery = $state(data.searchQuery || '');
  let isSearching = $state(false);
  let liveSearchResults = $state<any[]>(data.searchResults || []);
  let searchDebounceTimer: any = null;

  // Season countdown
  let seasonEndTime = $derived(new Date(data.season?.ends_at || '2026-12-31T23:59:59.000Z').getTime());
  let daysLeft = $derived(Math.max(0, Math.floor((seasonEndTime - Date.now()) / (1000 * 60 * 60 * 24))));
  let hoursLeft = $derived(
    Math.max(0, Math.floor(((seasonEndTime - Date.now()) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)))
  );

  function formatDate(isoStr: string) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return isoStr;
    }
  }

  function formatNumber(num: number | string | null | undefined) {
    const val = typeof num === 'number' ? num : Number(num) || 0;
    return val.toLocaleString('pt-BR');
  }

  function handleSearchInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    searchQuery = val;
    clearTimeout(searchDebounceTimer);

    if (!val || val.trim().length < 2) {
      liveSearchResults = [];
      isSearching = false;
      return;
    }

    isSearching = true;
    searchDebounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ranking/search?q=${encodeURIComponent(val.trim())}`);
        if (res.ok) {
          const json = await res.json();
          liveSearchResults = json.results || [];
        }
      } catch (err) {
        console.error('Error fetching search results:', err);
      } finally {
        isSearching = false;
      }
    }, 250);
  }

  function clearSearch() {
    searchQuery = '';
    liveSearchResults = [];
    isSearching = false;
  }

  function scrollToMyPosition() {
    if (!data.currentUser) return;
    if (data.pagination.page === data.currentUserPage) {
      const el = document.getElementById('user-me');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      window.location.href = `/ranking?page=${data.currentUserPage}#user-me`;
    }
  }
</script>

<svelte:head>
  <title>Classificação de Leitores — Project Nox</title>
  <meta
    name="description"
    content="Classificação cósmica e ranking de leitores da Temporada 1: Despertar Cósmico no Project Nox."
  />
</svelte:head>

<div class="container ranking-page spacer-bottom">
  <!-- Top Navigation Sub-Bar -->
  <header class="ranking-header">
    <div class="ranking-header-left">
      <div class="header-pill">
        <Sparkles size={13} class="icon-sparkle" />
        <span>TEMPORADA 1 — DESPERTAR CÓSMICO</span>
      </div>
      <h1 class="ranking-title">Classificação de Leitores</h1>
      <p class="ranking-desc">
        A corrida cósmica pelo topo da temporada. Ganhe XP em leituras e conquiste novos títulos de prestígio.
      </p>
    </div>

    <div class="ranking-header-actions">
      <a href="/ranking/hall-da-fama" class="header-action-btn btn-hall-fame" title="Conhecer o Hall da Fama">
        <Trophy size={16} class="text-gold" />
        <span class="action-btn-text">Hall da Fama</span>
        <span class="action-btn-chip gold">Eterno</span>
      </a>
      <button
        type="button"
        class="header-action-btn btn-rules"
        onclick={() => (showRulesModal = true)}
        title="Ver regras do ciclo de 90 dias e reset sazonal"
      >
        <HelpCircle size={16} class="text-violet" />
        <span class="action-btn-text">Regras do Ciclo</span>
        <span class="action-btn-chip violet">90 dias</span>
      </button>
    </div>
  </header>

  <!-- Season Closure Notice Banner -->
  <section class="season-notice-banner" aria-label="Aviso de Encerramento da Temporada 1">
    <div class="notice-top-row">
      <div class="notice-title-wrap">
        <Sparkles size={16} class="text-gold" />
        <h2 class="notice-main-heading">Encerramento da Temporada 1 — Despertar Cósmico</h2>
      </div>
      <div class="notice-countdown-pill" title="Contagem regressiva até o encerramento oficial">
        <Clock size={13} class="text-violet" />
        <span class="countdown-label">Tempo Restante:</span>
        <strong class="countdown-digits">{daysLeft}d {hoursLeft}h</strong>
      </div>
    </div>

    <div class="notice-dates-grid">
      <div class="notice-date-card">
        <span class="date-card-label"><Calendar size={12} /> Início</span>
        <strong class="date-card-value">01/10/2026</strong>
      </div>
      <div class="notice-date-card">
        <span class="date-card-label"><Clock size={12} /> Encerramento</span>
        <strong class="date-card-value">31/12/2026 às 23h59</strong>
      </div>
      <div class="notice-date-card highlight-reset">
        <span class="date-card-label"><Sparkles size={12} /> Reset de XP e Nível</span>
        <strong class="date-card-value">01/01/2027 às 00h00 <small>(Horário de Brasília)</small></strong>
      </div>
    </div>

    <div class="notice-explanation-box">
      <p class="notice-text-main">
        Ao terminar a temporada, seu XP e nível serão reiniciados. Cosméticos comprados e títulos permanentes do Hall da Fama serão preservados.
      </p>
      <p class="notice-text-advisory">
        ✦ <strong>Aviso importante:</strong> Gaste seu saldo de XP na <a href="/loja" class="notice-inline-link">Loja Cósmica</a> antes do encerramento, pois o saldo restante será perdido no reset.
      </p>
    </div>
  </section>



  <!-- Section 1: Personal Reader Progress (Clean Card) -->
  {#if data.currentUser && data.currentUserProgress}
    {@const prog = data.currentUserProgress}
    {@const currentAchievement = prog.currentAchievementTitle}
    {@const nextAchievement = prog.nextAchievementTitle}

    <section class="personal-progress-card" aria-label="Meu Progresso na Temporada">
      <div class="personal-card-header">
        <div class="personal-identity">
          <UserAvatar
            avatarId={data.currentUser.avatar_id}
            crop={data.currentUser.avatar_crop}
            displayName={data.currentUser.display_name}
            frameId={data.currentUser.avatar_frame_id}
            size={52}
          />
          <div class="personal-names">
            <div class="personal-name-line">
              <strong
                class="personal-display-name"
                style={data.currentUser.name_color ? `color: ${data.currentUser.name_color};` : ''}
              >
                {data.currentUser.display_name}
              </strong>
              <span class="personal-handle">@{data.currentUser.username}</span>
            </div>

            <!-- Achievement Title & Level Badge -->
            <div class="personal-badges-line">
              <span class="achievement-pill" title="Título de conquista desbloqueado pelo seu nível atual na temporada">
                <Sparkles size={12} />
                <span>{currentAchievement.name}</span>
              </span>
              <span class="level-pill">Nível {prog.currentLevel}</span>
              {#if data.currentUserRank}
                <span class="rank-pill">
                  <Trophy size={12} />
                  Posição <strong>#{data.currentUserRank}</strong>
                </span>
              {/if}
            </div>
          </div>
        </div>

        <div class="personal-actions-group">
          <button
            type="button"
            class="btn-locate-me"
            onclick={scrollToMyPosition}
            title="Localizar minha linha na classificação"
          >
            <Crosshair size={14} />
            <span>Minha Posição</span>
          </button>
          <button
            type="button"
            class="btn-open-milestones"
            onclick={() => (showTitlesModal = true)}
            title="Ver todos os 11 marcos de títulos de conquista"
          >
            <Award size={14} />
            <span>Trilha de Títulos</span>
          </button>
        </div>
      </div>

      <!-- Progression Bar -->
      <div class="personal-bar-block">
        <div class="bar-labels">
          <span class="bar-current">
            <strong>Nível {prog.currentLevel}</strong>
            <small>({formatNumber(prog.currentXp)} XP)</small>
          </span>
          <span class="bar-percent">{prog.progressPercent}%</span>
          <span class="bar-target">
            {#if prog.isMaxLevel}
              <strong class="text-gold">★ NÍVEL MÁXIMO (100)</strong>
            {:else}
              <span>Próximo: <strong>Nv. {prog.nextLevel}</strong></span>
              <small>(Faltam {formatNumber(prog.xpNeededForNext)} XP)</small>
            {/if}
          </span>
        </div>

        <div class="progress-track" role="progressbar" aria-valuenow={prog.progressPercent} aria-valuemin={0} aria-valuemax={100}>
          <div class="progress-fill" style="width: {prog.progressPercent}%;">
            <div class="progress-glow"></div>
          </div>
        </div>

        {#if nextAchievement}
          <div class="next-title-hint">
            <span>Próximo Título de Conquista:</span>
            <strong>{nextAchievement.name}</strong>
            <small>(no Nível {nextAchievement.minLevel})</small>
          </div>
        {/if}
      </div>
    </section>
  {/if}

  <!-- Section 2: Olympic Podium Top 3 (Page 1 Highlight) -->
  {#if data.top3 && data.top3.length > 0}
    <section class="podium-section" aria-label="Pódio Cósmico Top 3">
      <div class="podium-grid">
        <!-- 1st Place (Gold - Cosmic Champion) -->
        {#if data.top3.length >= 1}
          {@const gold = data.top3[0]}
          <a href="/u/{gold.username}" class="podium-box gold-tier">
            <div class="podium-crown-cap">
              <span class="crown-tag gold-tag">
                <Sparkles size={13} />
                <span>1º LUGAR CÓSMICO</span>
              </span>
              <span class="crown-emoji">👑</span>
            </div>

            <div class="podium-avatar-stage gold-stage">
              <UserAvatar
                avatarId={gold.avatar_id}
                crop={gold.avatar_crop}
                displayName={gold.display_name}
                frameId={gold.avatar_frame_id}
                size={78}
              />
            </div>

            <strong
              class="podium-name gold-name"
              style={gold.name_color ? `color: ${gold.name_color};` : ''}
            >
              {gold.display_name}
            </strong>
            <span class="podium-handle">@{gold.username}</span>

            <!-- Compact, Balanced Trio: Title | Level | Season XP -->
            <div class="podium-trio-row" aria-label="Indicadores do Campeão">
              <span class="podium-trio-badge gold-title" title="Título de Conquista Atual">
                <Sparkles size={11} />
                <span>{gold.title}</span>
              </span>
              <span class="podium-trio-badge gold-level" title="Nível na Temporada">
                <span>Nv. {gold.level}</span>
              </span>
              <span class="podium-trio-badge gold-xp" title="XP Conquistado na Temporada">
                <strong>{formatNumber(gold.season_xp)}</strong>
                <small>XP</small>
              </span>
            </div>
          </a>
        {/if}

        <!-- 2nd Place (Silver - Vice-Champion) -->
        {#if data.top3.length >= 2}
          {@const silver = data.top3[1]}
          <a href="/u/{silver.username}" class="podium-box silver-tier">
            <div class="podium-medal-cap">
              <span class="medal-tag silver-tag">2º LUGAR</span>
              <span class="medal-emoji">🥈</span>
            </div>

            <div class="podium-avatar-stage">
              <UserAvatar
                avatarId={silver.avatar_id}
                crop={silver.avatar_crop}
                displayName={silver.display_name}
                frameId={silver.avatar_frame_id}
                size={66}
              />
            </div>

            <strong
              class="podium-name"
              style={silver.name_color ? `color: ${silver.name_color};` : ''}
            >
              {silver.display_name}
            </strong>
            <span class="podium-handle">@{silver.username}</span>

            <!-- Compact, Balanced Trio: Title | Level | Season XP -->
            <div class="podium-trio-row" aria-label="Indicadores do Leitor">
              <span class="podium-trio-badge silver-title" title="Título de Conquista Atual">
                <Sparkles size={11} />
                <span>{silver.title}</span>
              </span>
              <span class="podium-trio-badge silver-level" title="Nível na Temporada">
                <span>Nv. {silver.level}</span>
              </span>
              <span class="podium-trio-badge silver-xp" title="XP Conquistado na Temporada">
                <strong>{formatNumber(silver.season_xp)}</strong>
                <small>XP</small>
              </span>
            </div>
          </a>
        {/if}

        <!-- 3rd Place (Bronze - Third Place) -->
        {#if data.top3.length >= 3}
          {@const bronze = data.top3[2]}
          <a href="/u/{bronze.username}" class="podium-box bronze-tier">
            <div class="podium-medal-cap">
              <span class="medal-tag bronze-tag">3º LUGAR</span>
              <span class="medal-emoji">🥉</span>
            </div>

            <div class="podium-avatar-stage">
              <UserAvatar
                avatarId={bronze.avatar_id}
                crop={bronze.avatar_crop}
                displayName={bronze.display_name}
                frameId={bronze.avatar_frame_id}
                size={64}
              />
            </div>

            <strong
              class="podium-name"
              style={bronze.name_color ? `color: ${bronze.name_color};` : ''}
            >
              {bronze.display_name}
            </strong>
            <span class="podium-handle">@{bronze.username}</span>

            <!-- Compact, Balanced Trio: Title | Level | Season XP -->
            <div class="podium-trio-row" aria-label="Indicadores do Leitor">
              <span class="podium-trio-badge bronze-title" title="Título de Conquista Atual">
                <Sparkles size={11} />
                <span>{bronze.title}</span>
              </span>
              <span class="podium-trio-badge bronze-level" title="Nível na Temporada">
                <span>Nv. {bronze.level}</span>
              </span>
              <span class="podium-trio-badge bronze-xp" title="XP Conquistado na Temporada">
                <strong>{formatNumber(bronze.season_xp)}</strong>
                <small>XP</small>
              </span>
            </div>
          </a>
        {/if}
      </div>
    </section>
  {/if}

  <!-- Section 3: Search & Filter Bar -->
  <section class="ranking-search-bar" aria-label="Buscar leitor no ranking">
    <div class="search-input-box">
      <Search size={18} class="search-icon" />
      <input
        type="text"
        class="search-input"
        placeholder="Buscar qualquer leitor por nome ou @username para ver a posição real..."
        value={searchQuery}
        oninput={handleSearchInput}
      />
      {#if searchQuery}
        <button type="button" class="btn-clear-search" onclick={clearSearch} aria-label="Limpar busca">
          <X size={16} />
        </button>
      {/if}
    </div>

    <!-- Live Search Dropdown Results -->
    {#if searchQuery.trim().length >= 2}
      <div class="search-dropdown-panel">
        <div class="dropdown-header">
          <span>Resultados para "{searchQuery}"</span>
          {#if isSearching}
            <small>Buscando...</small>
          {:else}
            <small>{liveSearchResults.length} encontrado(s)</small>
          {/if}
        </div>

        {#if liveSearchResults.length > 0}
          <div class="dropdown-list">
            {#each liveSearchResults as res (res.id)}
              <a href="/u/{res.username}" class="dropdown-item">
                <div class="dropdown-rank">#{res.rank}</div>
                <UserAvatar
                  avatarId={res.avatar_id}
                  crop={res.avatar_crop}
                  displayName={res.display_name}
                  frameId={res.avatar_frame_id}
                  size={36}
                />
                <div class="dropdown-info">
                  <strong style={res.name_color ? `color: ${res.name_color};` : ''}>
                    {res.display_name}
                  </strong>
                  <span class="dropdown-handle">@{res.username}</span>
                </div>
                <div class="dropdown-achievement">
                  <span class="chip-title-mini">{res.title}</span>
                  <span class="chip-level-mini">Nv. {res.level}</span>
                </div>
                <div class="dropdown-xp">
                  <strong>{formatNumber(res.season_xp)}</strong>
                  <small>XP</small>
                </div>
              </a>
            {/each}
          </div>
        {:else if !isSearching}
          <div class="dropdown-empty">
            <p>Nenhum leitor encontrado com "{searchQuery}".</p>
          </div>
        {/if}
      </div>
    {/if}
  </section>

  <!-- Section 4: Paginated Leaderboard (20 Per Page) -->
  {#if data.members && data.members.length > 0}
    <section class="leaderboard-section" aria-label="Tabela de Classificação">
      <div class="leaderboard-header-row">
        <div class="leaderboard-title-group">
          <Trophy size={18} class="text-gold" />
          <h2 class="leaderboard-heading">Classificação Geral</h2>
          <span class="leaderboard-count">
            (Página {data.pagination.page} de {data.pagination.totalPages} — 20 leitores por página)
          </span>
        </div>

        <div class="leaderboard-legend">
          <small>✦ O título exibido reflete o marco de nível alcançado na temporada</small>
        </div>
      </div>

      <!-- Desktop Table (clean & spaced) -->
      <div class="leaderboard-card desktop-only">
        <table class="leaderboard-table">
          <thead>
            <tr>
              <th style="width: 80px;">Posição</th>
              <th>Leitor</th>
              <th>Título de Conquista Sazonal</th>
              <th style="text-align: center; width: 140px;">Nível de Temporada</th>
              <th style="text-align: right; width: 160px;">XP da Temporada</th>
            </tr>
          </thead>
          <tbody>
            {#each data.members as member (member.id)}
              {@const isMe = data.currentUser?.id === member.id}
              <tr
                id={isMe ? 'user-me' : undefined}
                class="leaderboard-row"
                class:is-me={isMe}
                class:top-row={member.rank <= 3}
              >
                <td class="col-rank">
                  {#if member.rank === 1}
                    <span class="rank-badge gold">01</span>
                  {:else if member.rank === 2}
                    <span class="rank-badge silver">02</span>
                  {:else if member.rank === 3}
                    <span class="rank-badge bronze">03</span>
                  {:else}
                    <span class="rank-badge standard">{String(member.rank).padStart(2, '0')}</span>
                  {/if}
                </td>
                <td class="col-user">
                  <div class="user-inline">
                    <UserAvatar
                      avatarId={member.avatar_id}
                      crop={member.avatar_crop}
                      displayName={member.display_name}
                      frameId={member.avatar_frame_id}
                      size={40}
                    />
                    <div class="user-inline-details">
                      <div class="user-name-line">
                        <a href="/u/{member.username}" class="user-link">
                          <strong style={member.name_color ? `color: ${member.name_color};` : ''}>
                            {member.display_name}
                          </strong>
                        </a>
                        {#if isMe}
                          <span class="badge-you">Você</span>
                        {/if}
                      </div>
                      <span class="user-sub-handle">@{member.username}</span>
                    </div>
                  </div>
                </td>
                <td class="col-title">
                  <span class="achievement-table-chip">
                    <Sparkles size={12} class="chip-sparkle" />
                    <span>{member.title}</span>
                  </span>
                </td>
                <td class="col-level" style="text-align: center;">
                  <span class="level-indicator-pill" class:is-max={member.level >= 100}>
                    Nv. {member.level}
                  </span>
                </td>
                <td class="col-xp" style="text-align: right;">
                  <strong class="xp-val">{formatNumber(member.season_xp)}</strong>
                  <small class="xp-label">XP</small>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Mobile Cards (clean & non-overlapping) -->
      <div class="leaderboard-mobile mobile-only">
        {#each data.members as member (member.id)}
          {@const isMe = data.currentUser?.id === member.id}
          <a
            href="/u/{member.username}"
            id={isMe ? 'user-me' : undefined}
            class="mobile-rank-card"
            class:is-me={isMe}
            class:top-card={member.rank <= 3}
          >
            <div class="mobile-rank-col">
              {#if member.rank === 1}
                <span class="rank-badge gold">01</span>
              {:else if member.rank === 2}
                <span class="rank-badge silver">02</span>
              {:else if member.rank === 3}
                <span class="rank-badge bronze">03</span>
              {:else}
                <span class="rank-badge standard">{String(member.rank).padStart(2, '0')}</span>
              {/if}
            </div>

            <UserAvatar
              avatarId={member.avatar_id}
              crop={member.avatar_crop}
              displayName={member.display_name}
              frameId={member.avatar_frame_id}
              size={42}
            />

            <div class="mobile-info-col">
              <div class="mobile-name-row">
                <strong style={member.name_color ? `color: ${member.name_color};` : ''}>
                  {member.display_name}
                </strong>
                {#if isMe}
                  <span class="badge-you-mobile">Você</span>
                {/if}
              </div>
              <div class="mobile-achievement-row">
                <span class="mobile-title-tag">{member.title}</span>
                <span class="mobile-level-tag">Nv. {member.level}</span>
              </div>
            </div>

            <div class="mobile-xp-col">
              <strong>{formatNumber(member.season_xp)}</strong>
              <small>XP</small>
            </div>
          </a>
        {/each}
      </div>

      <!-- Real Backend Pagination Bar -->
      {#if data.pagination.totalPages > 1}
        <nav class="pagination-bar" aria-label="Navegação entre páginas do ranking">
          <div class="pagination-info">
            Exibindo <strong>{(data.pagination.page - 1) * data.pagination.pageSize + 1}–{Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.totalMembers)}</strong> de <strong>{data.pagination.totalMembers}</strong> leitores
          </div>

          <div class="pagination-controls">
            <!-- Previous Button -->
            <a
              href="?page={data.pagination.page - 1}"
              class="btn-page-nav"
              class:disabled={!data.pagination.hasPrevPage}
              aria-disabled={!data.pagination.hasPrevPage}
            >
              <ChevronLeft size={16} />
              <span>Anterior</span>
            </a>

            <!-- Page Number Pills -->
            <div class="page-pills">
              {#each Array(data.pagination.totalPages) as _, i}
                {@const pNum = i + 1}
                {#if pNum === 1 || pNum === data.pagination.totalPages || Math.abs(pNum - data.pagination.page) <= 1}
                  <a
                    href="?page={pNum}"
                    class="page-num-pill"
                    class:active={pNum === data.pagination.page}
                  >
                    {pNum}
                  </a>
                {:else if pNum === 2 && data.pagination.page > 3}
                  <span class="page-ellipsis">…</span>
                {:else if pNum === data.pagination.totalPages - 1 && data.pagination.page < data.pagination.totalPages - 2}
                  <span class="page-ellipsis">…</span>
                {/if}
              {/each}
            </div>

            <!-- Next Button -->
            <a
              href="?page={data.pagination.page + 1}"
              class="btn-page-nav"
              class:disabled={!data.pagination.hasNextPage}
              aria-disabled={!data.pagination.hasNextPage}
            >
              <span>Próxima</span>
              <ChevronRight size={16} />
            </a>
          </div>
        </nav>
      {/if}
    </section>
  {:else}
    <Empty
      title="Nenhum leitor ranqueado nesta página"
      description="Inicie suas leituras no Project Nox para ganhar XP e subir na classificação cósmica."
    />
  {/if}
</div>

<!-- Modal: Trilha Completa dos 11 Títulos de Conquista -->
{#if showTitlesModal}
  <div class="modal-backdrop" onclick={() => (showTitlesModal = false)} role="dialog" aria-modal="true">
    <div class="modal-box" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div class="modal-header-titles">
          <Sparkles size={20} class="text-gold" />
          <div>
            <h3>Trilha de Conquistas — 11 Títulos Cósmicos</h3>
            <p>Desbloqueados automaticamente conforme seu nível sobe durante a temporada.</p>
          </div>
        </div>
        <button type="button" class="btn-close-modal" onclick={() => (showTitlesModal = false)} aria-label="Fechar">
          <X size={18} />
        </button>
      </div>

      <div class="modal-body">
        <div class="titles-roadmap">
          {#each NOX_SEASON_ACHIEVEMENT_TITLES as t (t.id)}
            {@const userLevel = data.currentUserProgress?.currentLevel || 1}
            {@const isUnlocked = userLevel >= t.minLevel}
            {@const isCurrent = data.currentUserProgress?.currentAchievementTitle?.id === t.id}

            <div
              class="roadmap-row"
              class:is-unlocked={isUnlocked}
              class:is-current={isCurrent}
            >
              <div class="roadmap-badge-col">
                <span class="roadmap-level-pill">Nv. {t.minLevel}</span>
              </div>

              <div class="roadmap-content">
                <div class="roadmap-title-line">
                  <strong class="roadmap-title-name" style={t.color ? `color: ${t.color};` : ''}>
                    {t.name}
                  </strong>
                  {#if isCurrent}
                    <span class="tag-current">Título Atual no Ranking</span>
                  {:else if isUnlocked}
                    <span class="tag-unlocked"><Check size={12} /> Desbloqueado</span>
                  {:else}
                    <span class="tag-locked"><Lock size={12} /> Bloqueado</span>
                  {/if}
                </div>
                <p class="roadmap-desc">{t.description}</p>
              </div>

              <div class="roadmap-opt-col">
                {#if isUnlocked}
                  <a href="/perfil" class="link-equip-opt" title="Equipar no perfil público se desejar">
                    Equipável no Perfil
                  </a>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        <!-- Section: Top 3 Permanent Hall of Fame Titles Preview -->
        <div class="modal-hof-section">
          <div class="hof-section-title">
            <Trophy size={16} class="text-gold" />
            <h4>Títulos Honoríficos Permanentes (Pódio ao Fim da Temporada)</h4>
          </div>
          <div class="hof-titles-grid">
            {#each NOX_HALL_OF_FAME_TITLES as hof (hof.id)}
              <div class="hof-title-card">
                <strong style={hof.color ? `color: ${hof.color};` : ''}>{hof.name}</strong>
                <p>{hof.description}</p>
                <span class="hof-perm-badge">★ Imortal no Hall da Fama</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Modal: Regras do Ciclo Competitivo & Reset Sazonal -->
{#if showRulesModal}
  <div class="modal-backdrop" onclick={() => (showRulesModal = false)} role="dialog" aria-modal="true" aria-labelledby="modal-rules-heading">
    <div class="modal-box modal-box-rules" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div class="modal-header-titles">
          <ShieldCheck size={22} class="text-violet" />
          <div>
            <h3 id="modal-rules-heading">Regras do Ciclo e Temporadas Cósmicas</h3>
            <p>Entenda o funcionamento dos ciclos trimestrais de 90 dias e do reset de XP.</p>
          </div>
        </div>
        <button type="button" class="btn-close-modal" onclick={() => (showRulesModal = false)} aria-label="Fechar">
          <X size={18} />
        </button>
      </div>

      <div class="modal-body rules-modal-body">
        <!-- Rule 1: Ciclo de 90 dias -->
        <div class="rules-modal-card">
          <div class="rules-card-icon">
            <Clock size={20} class="text-violet" />
          </div>
          <div class="rules-card-content">
            <h4>Ciclo Competitivo Trimestral (90 Dias)</h4>
            <p>
              Cada temporada no Project Nox possui duração exata de 90 dias. Todos os leitores competem em igualdade de condições para alcançar o topo do ranking cósmico e registrar seus nomes no Hall da Fama perpétuo.
            </p>
            <div class="rules-dates-chip-row">
              <span class="dates-chip"><Calendar size={13} /> Início: <strong>01/10/2026</strong></span>
              <span class="dates-chip"><Clock size={13} /> Encerramento: <strong>31/12/2026 às 23h59</strong></span>
              <span class="dates-chip highlight"><Sparkles size={13} /> Reset: <strong>01/01/2027 às 00h00</strong></span>
            </div>
          </div>
        </div>

        <!-- Rule 2: O que é Permanente vs O que é Resetado -->
        <div class="rules-modal-card">
          <div class="rules-card-icon">
            <Award size={20} class="text-gold" />
          </div>
          <div class="rules-card-content">
            <h4>O que é Permanente vs. O que é Resetado</h4>
            <div class="rules-comparison-grid">
              <div class="comparison-column col-permanent">
                <span class="column-badge badge-permanent">✦ 100% Permanente</span>
                <ul>
                  <li><strong>Cosméticos da Loja:</strong> Todas as molduras, banners, cores de nome e títulos adquiridos na Loja Cósmica ficam salvos para sempre no seu inventário.</li>
                  <li><strong>Hall da Fama Eterno:</strong> Os 3 primeiros colocados da temporada recebem títulos exclusivos e lugar de honra perpétuo no Hall da Fama.</li>
                  <li><strong>Histórico de Obras:</strong> Sua biblioteca, favoritos, curtidas e avaliações permanecem intactos.</li>
                </ul>
              </div>
              <div class="comparison-column col-seasonal">
                <span class="column-badge badge-seasonal">↺ Resetado no Fim da Temporada</span>
                <ul>
                  <li><strong>Saldo de XP:</strong> O saldo de XP é zerado para o início da nova temporada.</li>
                  <li><strong>Nível Competitivo:</strong> O nível de leitor reinicia no Nível 1 (0 XP) para garantir disputa justa a novos e veteranos.</li>
                  <li><strong>Trilha de Conquistas:</strong> Os 11 títulos por marco da temporada são reabertos para novas conquistas.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- Rule 3: Gaste seu XP na Loja Cósmica -->
        <div class="rules-modal-card alert-card">
          <div class="rules-card-icon">
            <Sparkles size={20} class="text-gold" />
          </div>
          <div class="rules-card-content">
            <h4>Aviso Crucial: Gaste seu XP antes do Reset!</h4>
            <p>
              Como o saldo de XP zera ao término dos 90 dias, <strong>utilize seu XP acumulado na Loja Cósmica</strong> antes de 31/12/2026. Todos os itens comprados são seus para sempre!
            </p>
            <div class="rules-cta-row">
              <a href="/loja" class="btn-rules-cta primary">
                <Sparkles size={15} />
                <span>Explorar Loja Cósmica →</span>
              </a>
              <button
                type="button"
                class="btn-rules-cta secondary"
                onclick={() => {
                  showRulesModal = false;
                  showTitlesModal = true;
                }}
              >
                <Award size={15} />
                <span>Ver Trilha dos 11 Títulos →</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn-modal-done" onclick={() => (showRulesModal = false)}>
          Entendido
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ==========================================================================
     PROJECT NOX — CLEAN RANKING & PROGRESSION THEME
     ========================================================================== */
  .ranking-page {
    max-width: 1140px;
    margin: 0 auto;
    padding: 24px 16px 80px;
  }

  /* Header */
  .ranking-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 24px;
    padding-bottom: 18px;
    border-bottom: 1px solid rgba(139, 92, 246, 0.15);
  }

  .header-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(167, 139, 250, 0.28);
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    color: #c4b5fd;
    letter-spacing: 0.08em;
    margin-bottom: 8px;
  }

  .icon-sparkle {
    color: #facc15;
  }

  .ranking-title {
    font-size: 1.95rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 6px;
    letter-spacing: -0.02em;
    text-shadow: 0 2px 14px rgba(167, 139, 250, 0.25);
  }

  /* Prominent Hall of Fame Button */
  /* Balanced Header Action Buttons */
  .ranking-header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 42px;
    padding: 0 16px;
    border-radius: 10px;
    font-size: 0.86rem;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    white-space: nowrap;
    box-sizing: border-box;
  }

  .header-action-btn.btn-hall-fame {
    background: linear-gradient(135deg, rgba(35, 26, 68, 0.75) 0%, rgba(20, 16, 42, 0.95) 100%);
    border: 1px solid rgba(250, 204, 21, 0.35);
    color: #f8fafc;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(254, 240, 138, 0.15);
  }

  .header-action-btn.btn-hall-fame:hover {
    transform: translateY(-2px);
    border-color: rgba(250, 204, 21, 0.65);
    box-shadow: 0 6px 18px rgba(250, 204, 21, 0.18), inset 0 1px 0 rgba(254, 240, 138, 0.3);
    background: linear-gradient(135deg, rgba(45, 34, 85, 0.85) 0%, rgba(26, 20, 54, 0.98) 100%);
  }

  .header-action-btn.btn-rules {
    background: linear-gradient(135deg, rgba(28, 24, 58, 0.7) 0%, rgba(18, 14, 38, 0.9) 100%);
    border: 1px solid rgba(139, 92, 246, 0.3);
    color: #f8fafc;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(192, 132, 252, 0.15);
  }

  .header-action-btn.btn-rules:hover {
    transform: translateY(-2px);
    border-color: rgba(167, 139, 250, 0.6);
    box-shadow: 0 6px 18px rgba(139, 92, 246, 0.2), inset 0 1px 0 rgba(192, 132, 252, 0.3);
    background: linear-gradient(135deg, rgba(38, 30, 75, 0.85) 0%, rgba(22, 18, 48, 0.98) 100%);
  }

  .action-btn-text {
    font-size: 0.86rem;
    font-weight: 700;
  }

  .action-btn-chip {
    font-size: 0.68rem;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .action-btn-chip.gold {
    background: rgba(250, 204, 21, 0.15);
    border: 1px solid rgba(250, 204, 21, 0.35);
    color: #facc15;
  }

  .action-btn-chip.violet {
    background: rgba(139, 92, 246, 0.18);
    border: 1px solid rgba(139, 92, 246, 0.35);
    color: #c4b5fd;
  }

  /* Season Closure Notice Banner */
  .season-notice-banner {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px 20px;
    margin-bottom: 24px;
    background: linear-gradient(135deg, rgba(22, 17, 46, 0.9) 0%, rgba(13, 10, 30, 0.98) 100%);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 14px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
    position: relative;
    overflow: hidden;
  }

  .season-notice-banner::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, #7c3aed 0%, #facc15 50%, #38bdf8 100%);
  }

  .notice-top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }

  .notice-title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .notice-main-heading {
    font-size: 1.05rem;
    font-weight: 800;
    color: #f8fafc;
    letter-spacing: -0.01em;
    margin: 0;
  }

  .notice-countdown-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    background: rgba(139, 92, 246, 0.16);
    border: 1px solid rgba(167, 139, 250, 0.35);
    border-radius: 999px;
  }

  .countdown-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: #cbd5e1;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .countdown-digits {
    font-size: 0.92rem;
    font-weight: 800;
    color: #facc15;
    letter-spacing: 0.02em;
  }

  .notice-dates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }

  .notice-date-card {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 10px 14px;
    background: rgba(15, 12, 32, 0.6);
    border: 1px solid rgba(139, 92, 246, 0.18);
    border-radius: 8px;
  }

  .notice-date-card.highlight-reset {
    background: rgba(45, 34, 18, 0.35);
    border-color: rgba(250, 204, 21, 0.4);
  }

  .date-card-label {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.7rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .date-card-value {
    font-size: 0.9rem;
    font-weight: 700;
    color: #f1f5f9;
  }

  .notice-date-card.highlight-reset .date-card-value {
    color: #facc15;
  }

  .notice-date-card.highlight-reset small {
    font-size: 0.74rem;
    color: #e2e8f0;
    font-weight: 500;
  }

  .notice-explanation-box {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 10px;
    border-top: 1px solid rgba(139, 92, 246, 0.16);
  }

  .notice-text-main {
    font-size: 0.82rem;
    color: #cbd5e1;
    margin: 0;
    line-height: 1.45;
  }

  .notice-text-advisory {
    font-size: 0.8rem;
    color: #fde047;
    margin: 0;
    line-height: 1.45;
    background: rgba(250, 204, 21, 0.08);
    padding: 6px 10px;
    border-radius: 6px;
    border-left: 3px solid #facc15;
  }

  .notice-inline-link {
    color: #ffffff;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .notice-inline-link:hover {
    color: #c084fc;
  }

  .ranking-desc {
    font-size: 0.92rem;
    color: #94a3b8;
    margin: 0;
    max-width: 600px;
  }



  .text-violet {
    color: #a78bfa;
  }

  .text-gold {
    color: #facc15;
  }

  /* Personal Progress Card */
  .personal-progress-card {
    background: linear-gradient(135deg, rgba(30, 24, 60, 0.7) 0%, rgba(18, 14, 38, 0.85) 100%);
    border: 1px solid rgba(139, 92, 246, 0.32);
    border-radius: 14px;
    padding: 20px 24px;
    margin-bottom: 28px;
    backdrop-filter: blur(12px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .personal-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 18px;
  }

  .personal-identity {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .personal-names {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .personal-name-line {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }

  .personal-display-name {
    font-size: 1.15rem;
    font-weight: 700;
    color: #f8fafc;
  }

  .personal-handle {
    font-size: 0.82rem;
    color: #64748b;
  }

  .personal-badges-line {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .achievement-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    background: rgba(139, 92, 246, 0.22);
    border: 1px solid rgba(167, 139, 250, 0.4);
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 700;
    color: #e9d5ff;
    box-shadow: 0 0 10px rgba(139, 92, 246, 0.2);
  }

  .level-pill {
    display: inline-flex;
    padding: 3px 9px;
    background: rgba(56, 189, 248, 0.15);
    border: 1px solid rgba(56, 189, 248, 0.35);
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 700;
    color: #38bdf8;
  }

  .rank-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    background: rgba(250, 204, 21, 0.12);
    border: 1px solid rgba(250, 204, 21, 0.35);
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 600;
    color: #fef08a;
  }

  .personal-actions-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-locate-me,
  .btn-open-milestones {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(167, 139, 250, 0.3);
    border-radius: 8px;
    color: #ddd6fe;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-locate-me:hover,
  .btn-open-milestones:hover {
    background: rgba(139, 92, 246, 0.3);
    color: #ffffff;
    border-color: rgba(167, 139, 250, 0.5);
  }

  /* Progress Track */
  .personal-bar-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .bar-labels {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.82rem;
    color: #cbd5e1;
  }

  .bar-percent {
    font-weight: 700;
    color: #a78bfa;
  }

  .progress-track {
    width: 100%;
    height: 10px;
    background: rgba(15, 12, 35, 0.8);
    border-radius: 999px;
    overflow: hidden;
    position: relative;
    border: 1px solid rgba(139, 92, 246, 0.25);
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #7c3aed 0%, #a855f7 50%, #38bdf8 100%);
    border-radius: 999px;
    position: relative;
    transition: width 0.4s ease;
  }

  .progress-glow {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 12px;
    background: #ffffff;
    filter: blur(2px);
    opacity: 0.8;
  }

  .next-title-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    color: #94a3b8;
    margin-top: 2px;
  }

  .next-title-hint strong {
    color: #c084fc;
  }

  /* Olympic Top 3 Podium */
  .podium-section {
    margin-bottom: 36px;
  }

  .podium-grid {
    display: grid;
    grid-template-columns: 1fr 1.15fr 1fr;
    gap: 16px;
    align-items: end;
  }

  @media (max-width: 768px) {
    .podium-grid {
      grid-template-columns: 1fr;
      gap: 14px;
    }
    .gold-tier,
    .silver-tier,
    .bronze-tier {
      grid-column: auto;
      grid-row: auto;
    }
  }

  .podium-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 16px 20px;
    background: linear-gradient(180deg, rgba(28, 24, 56, 0.7) 0%, rgba(15, 12, 30, 0.9) 100%);
    border-radius: 16px;
    border: 1px solid rgba(139, 92, 246, 0.2);
    text-decoration: none;
    position: relative;
    transition: transform 0.25s ease, box-shadow 0.25s ease;
  }

  .podium-box:hover {
    transform: translateY(-4px);
  }

  .silver-tier {
    border-color: rgba(148, 163, 184, 0.35);
    box-shadow: 0 8px 24px rgba(148, 163, 184, 0.08);
  }

  .gold-tier {
    background: linear-gradient(180deg, rgba(42, 32, 70, 0.85) 0%, rgba(20, 15, 42, 0.95) 100%);
    border-color: rgba(250, 204, 21, 0.4);
    box-shadow: 0 12px 36px rgba(250, 204, 21, 0.12);
    padding-top: 28px;
    padding-bottom: 24px;
  }

  .bronze-tier {
    border-color: rgba(217, 119, 6, 0.35);
    box-shadow: 0 8px 24px rgba(217, 119, 6, 0.08);
  }

  /* Desktop Olympic Positioning: 2º (col 1), 1º (col 2), 3º (col 3) */
  @media (min-width: 769px) {
    .silver-tier {
      grid-column: 1;
      grid-row: 1;
    }
    .gold-tier {
      grid-column: 2;
      grid-row: 1;
    }
    .bronze-tier {
      grid-column: 3;
      grid-row: 1;
    }
  }

  /* Cap headers for Crown and Medals */
  .podium-crown-cap,
  .podium-medal-cap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    margin-bottom: 12px;
    z-index: 5;
  }

  .crown-emoji,
  .medal-emoji {
    font-size: 1.8rem;
    line-height: 1;
    filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.5));
  }

  .crown-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.06em;
  }

  .gold-tag {
    background: rgba(250, 204, 21, 0.18);
    border: 1px solid rgba(250, 204, 21, 0.45);
    color: #facc15;
  }

  .medal-tag {
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.06em;
  }

  .silver-tag {
    background: rgba(148, 163, 184, 0.15);
    border: 1px solid rgba(148, 163, 184, 0.35);
    color: #cbd5e1;
  }

  .bronze-tag {
    background: rgba(217, 119, 6, 0.15);
    border: 1px solid rgba(217, 119, 6, 0.35);
    color: #fb923c;
  }

  /* Staged Avatar */
  .podium-avatar-stage {
    padding: 24px 14px 14px;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    min-height: 104px;
  }

  .gold-stage {
    min-height: 118px;
    padding-top: 28px;
  }

  .podium-name {
    font-size: 1.05rem;
    font-weight: 700;
    color: #f8fafc;
    text-align: center;
    margin-top: 6px;
    margin-bottom: 2px;
  }

  .gold-name {
    font-size: 1.2rem;
    color: #fef08a;
    text-shadow: 0 0 14px rgba(250, 204, 21, 0.3);
  }

  .podium-handle {
    font-size: 0.78rem;
    color: #64748b;
    margin-bottom: 10px;
  }

  /* Unified Trio Row: Title | Level | Season XP */
  .podium-trio-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 6px;
    margin-bottom: 2px;
    width: 100%;
    max-width: 96%;
  }

  .podium-trio-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.74rem;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    line-height: 1.25;
    white-space: nowrap;
    transition: all 0.2s ease;
  }

  /* Gold Trio Badges (1º Lugar) */
  .gold-title {
    background: rgba(250, 204, 21, 0.15);
    border: 1px solid rgba(250, 204, 21, 0.45);
    color: #fef08a;
  }

  .gold-level {
    background: rgba(245, 158, 11, 0.18);
    border: 1px solid rgba(245, 158, 11, 0.4);
    color: #fbbf24;
  }

  .gold-xp {
    background: rgba(250, 204, 21, 0.12);
    border: 1px solid rgba(250, 204, 21, 0.35);
    color: #fef9c3;
  }

  .gold-xp strong {
    font-weight: 800;
    color: #ffffff;
  }

  .gold-xp small {
    font-size: 0.64rem;
    color: #fde047;
    font-weight: 700;
  }

  /* Silver Trio Badges (2º Lugar) */
  .silver-title {
    background: rgba(148, 163, 184, 0.14);
    border: 1px solid rgba(203, 213, 225, 0.35);
    color: #e2e8f0;
  }

  .silver-level {
    background: rgba(56, 189, 248, 0.14);
    border: 1px solid rgba(56, 189, 248, 0.35);
    color: #38bdf8;
  }

  .silver-xp {
    background: rgba(226, 232, 240, 0.1);
    border: 1px solid rgba(203, 213, 225, 0.3);
    color: #f8fafc;
  }

  .silver-xp strong {
    font-weight: 800;
    color: #ffffff;
  }

  .silver-xp small {
    font-size: 0.64rem;
    color: #cbd5e1;
    font-weight: 700;
  }

  /* Bronze Trio Badges (3º Lugar) */
  .bronze-title {
    background: rgba(217, 119, 6, 0.14);
    border: 1px solid rgba(251, 146, 60, 0.35);
    color: #fed7aa;
  }

  .bronze-level {
    background: rgba(249, 115, 22, 0.14);
    border: 1px solid rgba(249, 115, 22, 0.35);
    color: #fb923c;
  }

  .bronze-xp {
    background: rgba(217, 119, 6, 0.1);
    border: 1px solid rgba(251, 146, 60, 0.3);
    color: #ffedd5;
  }

  .bronze-xp strong {
    font-weight: 800;
    color: #ffffff;
  }

  .bronze-xp small {
    font-size: 0.64rem;
    color: #fdba74;
    font-weight: 700;
  }

  .podium-box:hover .podium-trio-badge {
    transform: translateY(-1px);
  }

  @media (prefers-reduced-motion: reduce) {
    .podium-box:hover .podium-trio-badge {
      transform: none;
    }
  }

  /* Search Bar */
  .ranking-search-bar {
    position: relative;
    margin-bottom: 28px;
  }

  .search-input-box {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(24, 20, 50, 0.65);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 12px;
    padding: 10px 16px;
    transition: all 0.2s;
  }

  .search-input-box:focus-within {
    border-color: rgba(167, 139, 250, 0.6);
    box-shadow: 0 0 16px rgba(139, 92, 246, 0.25);
    background: rgba(28, 22, 60, 0.85);
  }

  .search-icon {
    color: #94a3b8;
  }

  .search-input {
    flex: 1;
    background: none;
    border: none;
    color: #f8fafc;
    font-size: 0.9rem;
    outline: none;
  }

  .search-input::placeholder {
    color: #64748b;
  }

  .btn-clear-search {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-clear-search:hover {
    color: #ffffff;
  }

  /* Search Dropdown */
  .search-dropdown-panel {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    background: rgba(20, 16, 45, 0.96);
    border: 1px solid rgba(139, 92, 246, 0.35);
    border-radius: 12px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(14px);
    z-index: 50;
    overflow: hidden;
  }

  .dropdown-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(139, 92, 246, 0.15);
    font-size: 0.78rem;
    color: #94a3b8;
  }

  .dropdown-list {
    max-height: 320px;
    overflow-y: auto;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(139, 92, 246, 0.08);
    text-decoration: none;
    color: inherit;
    transition: background 0.15s;
  }

  .dropdown-item:hover {
    background: rgba(139, 92, 246, 0.15);
  }

  .dropdown-rank {
    font-size: 0.95rem;
    font-weight: 800;
    color: #facc15;
    min-width: 38px;
  }

  .dropdown-info {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .dropdown-info strong {
    font-size: 0.88rem;
    color: #f8fafc;
  }

  .dropdown-handle {
    font-size: 0.76rem;
    color: #64748b;
  }

  .dropdown-achievement {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .chip-title-mini {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 2px 6px;
    background: rgba(139, 92, 246, 0.2);
    border: 1px solid rgba(167, 139, 250, 0.3);
    border-radius: 4px;
    color: #c4b5fd;
  }

  .chip-level-mini {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 2px 5px;
    background: rgba(56, 189, 248, 0.15);
    border-radius: 4px;
    color: #38bdf8;
  }

  .dropdown-xp {
    text-align: right;
  }

  .dropdown-xp strong {
    font-size: 0.92rem;
    color: #ffffff;
  }

  .dropdown-xp small {
    display: block;
    font-size: 0.68rem;
    color: #94a3b8;
  }

  .dropdown-empty {
    padding: 20px;
    text-align: center;
    color: #94a3b8;
    font-size: 0.86rem;
  }

  /* Leaderboard Section */
  .leaderboard-section {
    margin-bottom: 40px;
  }

  .leaderboard-header-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
  }

  .leaderboard-title-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .leaderboard-heading {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 800;
    color: #f8fafc;
  }

  .leaderboard-count {
    font-size: 0.82rem;
    color: #94a3b8;
  }

  .leaderboard-legend small {
    font-size: 0.78rem;
    color: #a78bfa;
  }

  /* Leaderboard Table (Desktop) */
  .leaderboard-card {
    background: linear-gradient(180deg, rgba(24, 20, 50, 0.7) 0%, rgba(16, 13, 34, 0.85) 100%);
    border: 1px solid rgba(139, 92, 246, 0.22);
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
  }

  .leaderboard-table {
    width: 100%;
    border-collapse: collapse;
  }

  .leaderboard-table th {
    padding: 14px 18px;
    font-size: 0.75rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid rgba(139, 92, 246, 0.18);
    background: rgba(15, 12, 32, 0.6);
  }

  .leaderboard-row {
    border-bottom: 1px solid rgba(139, 92, 246, 0.08);
    transition: background 0.15s ease;
  }

  .leaderboard-row:hover {
    background: rgba(139, 92, 246, 0.08);
  }

  .leaderboard-row.is-me {
    background: rgba(139, 92, 246, 0.16);
    box-shadow: inset 3px 0 0 #a78bfa;
  }

  .leaderboard-table td {
    padding: 12px 18px;
    vertical-align: middle;
  }

  /* Rank Badge */
  .rank-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    font-size: 0.88rem;
    font-weight: 800;
  }

  .rank-badge.gold {
    background: rgba(250, 204, 21, 0.2);
    border: 1px solid rgba(250, 204, 21, 0.45);
    color: #facc15;
  }

  .rank-badge.silver {
    background: rgba(148, 163, 184, 0.2);
    border: 1px solid rgba(148, 163, 184, 0.4);
    color: #cbd5e1;
  }

  .rank-badge.bronze {
    background: rgba(217, 119, 6, 0.2);
    border: 1px solid rgba(217, 119, 6, 0.4);
    color: #fb923c;
  }

  .rank-badge.standard {
    background: rgba(30, 27, 75, 0.4);
    border: 1px solid rgba(139, 92, 246, 0.15);
    color: #94a3b8;
  }

  /* User Cell */
  .user-inline {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .user-inline-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .user-name-line {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .user-link {
    text-decoration: none;
    color: inherit;
  }

  .user-link strong {
    font-size: 0.92rem;
    color: #f8fafc;
    transition: color 0.15s;
  }

  .user-link:hover strong {
    color: #c4b5fd;
  }

  .user-sub-handle {
    font-size: 0.76rem;
    color: #64748b;
  }

  .badge-you {
    padding: 1px 7px;
    background: #7c3aed;
    color: #ffffff;
    border-radius: 4px;
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  /* Achievement Title Chip in Table */
  .achievement-table-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: rgba(139, 92, 246, 0.14);
    border: 1px solid rgba(167, 139, 250, 0.28);
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 700;
    color: #e9d5ff;
  }

  .chip-sparkle {
    color: #c084fc;
  }

  .level-indicator-pill {
    display: inline-flex;
    padding: 3px 9px;
    border-radius: 6px;
    background: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.28);
    font-size: 0.8rem;
    font-weight: 700;
    color: #38bdf8;
  }

  .level-indicator-pill.is-max {
    background: rgba(250, 204, 21, 0.15);
    border-color: rgba(250, 204, 21, 0.35);
    color: #facc15;
  }

  .xp-val {
    font-size: 1rem;
    color: #ffffff;
  }

  .xp-label {
    font-size: 0.72rem;
    color: #94a3b8;
    margin-left: 2px;
  }

  /* Mobile Leaderboard */
  .leaderboard-mobile {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .mobile-rank-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: rgba(24, 20, 50, 0.65);
    border: 1px solid rgba(139, 92, 246, 0.18);
    border-radius: 12px;
    text-decoration: none;
    color: inherit;
    transition: background 0.15s;
  }

  .mobile-rank-card.is-me {
    background: rgba(139, 92, 246, 0.18);
    border-color: rgba(167, 139, 250, 0.4);
  }

  .mobile-rank-col {
    min-width: 32px;
  }

  .mobile-info-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .mobile-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .mobile-name-row strong {
    font-size: 0.9rem;
    color: #f8fafc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .badge-you-mobile {
    padding: 1px 6px;
    background: #7c3aed;
    color: #ffffff;
    border-radius: 4px;
    font-size: 0.65rem;
    font-weight: 700;
  }

  .mobile-achievement-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .mobile-title-tag {
    font-size: 0.72rem;
    font-weight: 700;
    color: #c4b5fd;
    background: rgba(139, 92, 246, 0.2);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .mobile-level-tag {
    font-size: 0.72rem;
    font-weight: 700;
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.15);
    padding: 1px 5px;
    border-radius: 4px;
  }

  .mobile-xp-col {
    text-align: right;
    white-space: nowrap;
  }

  .mobile-xp-col strong {
    font-size: 0.95rem;
    color: #ffffff;
  }

  .mobile-xp-col small {
    display: block;
    font-size: 0.66rem;
    color: #94a3b8;
  }

  /* Real Backend Pagination Controls */
  .pagination-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid rgba(139, 92, 246, 0.15);
  }

  .pagination-info {
    font-size: 0.84rem;
    color: #94a3b8;
  }

  .pagination-info strong {
    color: #e2e8f0;
  }

  .pagination-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-page-nav {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: rgba(30, 26, 65, 0.6);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 8px;
    color: #e2e8f0;
    font-size: 0.82rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s;
  }

  .btn-page-nav:not(.disabled):hover {
    background: rgba(139, 92, 246, 0.25);
    border-color: rgba(167, 139, 250, 0.45);
    color: #ffffff;
  }

  .btn-page-nav.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  .page-pills {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .page-num-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 34px;
    height: 34px;
    padding: 0 6px;
    background: rgba(30, 26, 65, 0.45);
    border: 1px solid rgba(139, 92, 246, 0.18);
    border-radius: 8px;
    color: #cbd5e1;
    font-size: 0.82rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.15s;
  }

  .page-num-pill:hover {
    background: rgba(139, 92, 246, 0.2);
    color: #ffffff;
  }

  .page-num-pill.active {
    background: #7c3aed;
    border-color: #a78bfa;
    color: #ffffff;
    font-weight: 700;
    box-shadow: 0 0 12px rgba(124, 58, 237, 0.4);
  }

  .page-ellipsis {
    color: #64748b;
    padding: 0 4px;
  }

  /* Modal Styles */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 100;
  }

  .modal-box {
    background: linear-gradient(135deg, rgba(28, 24, 56, 0.98) 0%, rgba(16, 13, 36, 0.98) 100%);
    border: 1px solid rgba(139, 92, 246, 0.35);
    border-radius: 16px;
    width: 100%;
    max-width: 720px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 20px 24px;
    border-bottom: 1px solid rgba(139, 92, 246, 0.18);
  }

  .modal-header-titles {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .modal-header-titles h3 {
    margin: 0 0 4px;
    font-size: 1.15rem;
    font-weight: 800;
    color: #f8fafc;
  }

  .modal-header-titles p {
    margin: 0;
    font-size: 0.82rem;
    color: #94a3b8;
  }

  .btn-close-modal {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-close-modal:hover {
    color: #ffffff;
  }

  .modal-body {
    padding: 20px 24px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .titles-roadmap {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .roadmap-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 14px;
    background: rgba(20, 16, 42, 0.5);
    border: 1px solid rgba(139, 92, 246, 0.12);
    border-radius: 10px;
    transition: all 0.15s;
  }

  .roadmap-row.is-unlocked {
    background: rgba(30, 24, 60, 0.65);
    border-color: rgba(139, 92, 246, 0.28);
  }

  .roadmap-row.is-current {
    background: rgba(124, 58, 237, 0.18);
    border-color: rgba(167, 139, 250, 0.5);
    box-shadow: 0 0 16px rgba(124, 58, 237, 0.2);
  }

  .roadmap-badge-col {
    min-width: 60px;
  }

  .roadmap-level-pill {
    display: inline-block;
    padding: 3px 8px;
    background: rgba(56, 189, 248, 0.15);
    border: 1px solid rgba(56, 189, 248, 0.3);
    border-radius: 6px;
    font-size: 0.76rem;
    font-weight: 700;
    color: #38bdf8;
  }

  .roadmap-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .roadmap-title-line {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .roadmap-title-name {
    font-size: 0.92rem;
    font-weight: 700;
    color: #e2e8f0;
  }

  .tag-current {
    font-size: 0.68rem;
    font-weight: 700;
    background: #7c3aed;
    color: #ffffff;
    padding: 2px 7px;
    border-radius: 4px;
  }

  .tag-unlocked {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.68rem;
    font-weight: 700;
    color: #4ade80;
  }

  .tag-locked {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.68rem;
    font-weight: 600;
    color: #64748b;
  }

  .roadmap-desc {
    margin: 0;
    font-size: 0.78rem;
    color: #94a3b8;
  }

  .roadmap-opt-col {
    white-space: nowrap;
  }

  .link-equip-opt {
    font-size: 0.74rem;
    font-weight: 600;
    color: #c4b5fd;
    text-decoration: none;
    padding: 3px 8px;
    border: 1px solid rgba(167, 139, 250, 0.3);
    border-radius: 6px;
    transition: all 0.15s;
  }

  .link-equip-opt:hover {
    background: rgba(139, 92, 246, 0.25);
    color: #ffffff;
  }

  .modal-hof-section {
    padding-top: 16px;
    border-top: 1px solid rgba(139, 92, 246, 0.15);
  }

  .hof-section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .hof-section-title h4 {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 700;
    color: #f8fafc;
  }

  .hof-titles-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .hof-title-card {
    padding: 10px 14px;
    background: rgba(250, 204, 21, 0.05);
    border: 1px solid rgba(250, 204, 21, 0.2);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .hof-title-card strong {
    font-size: 0.88rem;
  }

  .hof-title-card p {
    margin: 0;
    font-size: 0.76rem;
    color: #94a3b8;
  }

  .hof-perm-badge {
    align-self: flex-start;
    font-size: 0.68rem;
    font-weight: 700;
    color: #facc15;
    margin-top: 3px;
  }

  /* Rules Modal Specific Styles */
  .modal-box-rules {
    max-width: 760px;
  }

  .rules-modal-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px 24px;
    overflow-y: auto;
  }

  .rules-modal-card {
    display: flex;
    gap: 16px;
    padding: 16px 18px;
    background: rgba(20, 16, 42, 0.55);
    border: 1px solid rgba(139, 92, 246, 0.18);
    border-radius: 12px;
  }

  .rules-modal-card.alert-card {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(20, 16, 42, 0.75) 100%);
    border-color: rgba(245, 158, 11, 0.35);
  }

  .rules-card-icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .rules-modal-card.alert-card .rules-card-icon {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.35);
  }

  .rules-card-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .rules-card-content h4 {
    margin: 0;
    font-size: 0.96rem;
    font-weight: 700;
    color: #f8fafc;
  }

  .rules-card-content p {
    margin: 0;
    font-size: 0.85rem;
    color: #94a3b8;
    line-height: 1.5;
  }

  .rules-dates-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
  }

  .dates-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    font-size: 0.76rem;
    color: #cbd5e1;
  }

  .dates-chip.highlight {
    background: rgba(245, 158, 11, 0.12);
    border-color: rgba(245, 158, 11, 0.3);
    color: #fbbf24;
  }

  .rules-comparison-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 4px;
  }

  .comparison-column {
    padding: 12px 14px;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .comparison-column.col-permanent {
    background: rgba(74, 222, 128, 0.05);
    border: 1px solid rgba(74, 222, 128, 0.22);
  }

  .comparison-column.col-seasonal {
    background: rgba(244, 63, 94, 0.05);
    border: 1px solid rgba(244, 63, 94, 0.22);
  }

  .column-badge {
    align-self: flex-start;
    font-size: 0.7rem;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .column-badge.badge-permanent {
    background: rgba(74, 222, 128, 0.15);
    color: #4ade80;
  }

  .column-badge.badge-seasonal {
    background: rgba(244, 63, 94, 0.15);
    color: #f43f5e;
  }

  .comparison-column ul {
    margin: 0;
    padding-left: 16px;
    font-size: 0.8rem;
    color: #cbd5e1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    line-height: 1.4;
  }

  .rules-cta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 6px;
  }

  .btn-rules-cta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-rules-cta.primary {
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    border: 1px solid rgba(192, 132, 252, 0.4);
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
  }

  .btn-rules-cta.primary:hover {
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    transform: translateY(-1px);
  }

  .btn-rules-cta.secondary {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #e2e8f0;
  }

  .btn-rules-cta.secondary:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
    transform: translateY(-1px);
  }

  /* Utility Display Classes */
  .desktop-only {
    display: block;
  }

  .mobile-only {
    display: none;
  }

  @media (max-width: 768px) {
    .desktop-only {
      display: none;
    }
    .mobile-only {
      display: flex;
    }
    .ranking-page {
      padding: 16px 12px 60px;
    }
    .ranking-title {
      font-size: 1.5rem;
    }
    .ranking-header-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      width: 100%;
      gap: 8px;
    }
    .header-action-btn {
      width: 100%;
      justify-content: center;
      padding: 0 8px;
      font-size: 0.78rem;
    }
    .action-btn-text {
      font-size: 0.78rem;
    }
    .action-btn-chip {
      font-size: 0.62rem;
      padding: 1px 4px;
    }
    .rules-comparison-grid {
      grid-template-columns: 1fr;
    }
    .season-notice-banner {
      padding: 14px 14px;
    }
    .notice-top-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }
    .notice-dates-grid {
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .podium-trio-row {
      gap: 4px;
    }
    .podium-trio-badge {
      font-size: 0.7rem;
      padding: 2.5px 6px;
    }
  }
</style>
