<script lang="ts">
  import Empty from '$lib/components/Empty.svelte';
  import { memberRank } from '$lib/types';
  import { Sparkles, Trophy, Calendar, Clock, Info, ShieldCheck, X } from '@lucide/svelte';
  import UserAvatar from '$lib/components/UserAvatar.svelte';

  let { data } = $props();

  let showHallOfFame = $state(false);

  // Calculate countdown for current season
  let seasonEndTime = $derived(new Date(data.season?.ends_at || '2026-12-31T23:59:59.000Z').getTime());
  let daysLeft = $derived(Math.max(0, Math.floor((seasonEndTime - Date.now()) / (1000 * 60 * 60 * 24))));
  let hoursLeft = $derived(Math.max(0, Math.floor(((seasonEndTime - Date.now()) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))));

  function formatDate(isoStr: string) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return isoStr;
    }
  }

  function formatNumber(num: number) {
    return Number(num || 0).toLocaleString('pt-BR');
  }
</script>

<svelte:head>
  <title>Classificação Cósmica — Project Nox</title>
</svelte:head>

<div class="container ranking-container spacer-bottom">
  <!-- Top Header -->
  <div class="page-top">
    <div class="badge-tag">
      <Sparkles size={13} />
      <span>CLASSIFICAÇÃO CÓSMICA</span>
    </div>
    <h1 class="ranking-title">Mestres da Leitura</h1>
    <p class="ranking-subtitle">
      Acompanhe os maiores leitores da Project Nox. Conclua capítulos, participe da comunidade e suba no pódio cósmico.
    </p>
  </div>

  <!-- Season Notification Banner -->
  <section class="season-banner-card" aria-label="Informações da Temporada">
    <div class="season-banner-header">
      <div class="season-badge-group">
        <span class="season-status-pill active">
          <span class="live-dot" aria-hidden="true"></span>
          TEMPORADA ATIVA
        </span>
        <h2 class="season-title">{data.season?.name || 'Temporada 1 — Despertar Cósmico'}</h2>
      </div>

      <div class="season-meta-group">
        <div class="season-meta-item" title="Período de duração da temporada">
          <Calendar size={15} />
          <span>{formatDate(data.season?.starts_at)} — {formatDate(data.season?.ends_at)}</span>
        </div>
        <div class="season-meta-item countdown-pill" title="Tempo restante nesta temporada">
          <Clock size={15} />
          <span><strong>{daysLeft}d {hoursLeft}h</strong> restantes</span>
        </div>
        <button
          type="button"
          class="btn-hall-fame"
          onclick={() => (showHallOfFame = true)}
          title="Ver vencedores de temporadas anteriores"
        >
          <Trophy size={14} />
          <span>Hall da Fama</span>
        </button>
      </div>
    </div>

    <!-- Season Fair-Play & Rules Disclaimer -->
    <div class="season-rules-callout">
      <div class="rules-callout-icon" aria-hidden="true">
        <ShieldCheck size={18} />
      </div>
      <div class="rules-callout-body">
        <strong>Ciclo Trimestral (90 dias) e Progressão Eterna:</strong>
        <p>
          O ranking é sazonal e renovado a cada 90 dias para dar chances justas a todos os leitores.
          <strong>Seu Nível Permanente de Leitor e os cosméticos comprados na Loja Cósmica são eternos e NUNCA são perdidos no reset!</strong>
        </p>
      </div>
    </div>
  </section>

  <!-- User Progress Bar Card (Logged-in Readers) -->
  {#if data.currentUser && data.currentUserProgress}
    {@const prog = data.currentUserProgress}
    {@const currentRank = memberRank(
      data.currentUser.lifetime_xp || data.currentUser.xp,
      data.currentUser.equipped_title_id,
      data.currentUser.equipped_badge_id
    )}
    <section class="user-progress-card" aria-label="Seu Progresso de Leitor">
      <div class="user-progress-top">
        <div class="user-profile-identity">
          <UserAvatar
            avatarId={data.currentUser.avatar_id}
            crop={data.currentUser.avatar_crop}
            displayName={data.currentUser.display_name}
            frameId={data.currentUser.avatar_frame_id}
            size={52}
          />
          <div class="user-profile-details">
            <div class="user-name-row">
              <strong
                class="user-display-name"
                style={data.currentUser.name_color
                  ? `color: ${data.currentUser.name_color}; text-shadow: 0 0 10px ${data.currentUser.name_color}55;`
                  : ''}
              >
                {data.currentUser.display_name}
              </strong>
              <span class="user-handle">@{data.currentUser.username}</span>
            </div>
            <div class="user-badges-row">
              <span class="user-title-chip">{currentRank.title}</span>
              <span class="user-level-chip">Nível {prog.currentLevel}</span>
              {#if data.currentUserRank}
                <span class="user-rank-position-chip">
                  <Trophy size={12} />
                  Sua Posição: <strong>#{data.currentUserRank}</strong>
                </span>
              {/if}
            </div>
          </div>
        </div>

        <div class="user-season-stats">
          <div class="stat-box">
            <span class="stat-label">Pontos da Temporada</span>
            <span class="stat-val highlight">{formatNumber(data.currentUser.season_xp || 0)} <small>XP</small></span>
          </div>
          <div class="stat-box">
            <span class="stat-label">Saldo na Loja</span>
            <span class="stat-val">{formatNumber(data.currentUser.xp || 0)} <small>XP</small></span>
          </div>
        </div>
      </div>

      <!-- Level Progression Bar -->
      <div class="level-progress-track-wrapper">
        <div class="level-progress-labels">
          {#if prog.isMaxLevel}
            <span class="level-label max-level">
              <Sparkles size={14} />
              NÍVEL MÁXIMO ALCANÇADO (100)
            </span>
            <span class="xp-progress-count">
              ✦ XP Infinito: {formatNumber(prog.currentXp)} XP Acumulados
            </span>
          {:else}
            <span class="level-label">
              Nível {prog.currentLevel} ➔ Nível {prog.nextLevel}
            </span>
            <span class="xp-progress-count">
              <strong>{formatNumber(prog.xpInLevel)}</strong> / {formatNumber(prog.xpInLevel + prog.xpNeededForNext)} XP ({prog.progressPercent}%)
            </span>
          {/if}
        </div>

        <div class="level-bar-container" class:is-max={prog.isMaxLevel}>
          <div
            class="level-bar-fill"
            style="width: {prog.progressPercent}%;"
            role="progressbar"
            aria-valuenow={prog.progressPercent}
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div class="bar-shine-sweep"></div>
          </div>
        </div>
      </div>
    </section>
  {/if}

  <!-- Leaderboard Section -->
  {#if data.members.length}
    <div
      class="podium-section"
      class:is-single={data.members.length === 1}
      class:is-double={data.members.length === 2}
      class:is-olympic={data.members.length >= 3}
    >
      {#if data.members.length >= 3}
        <!-- Olympic Order: #2 Silver (Left), #1 Gold (Center, Dominant), #3 Bronze (Right) -->
        {@const silver = data.members[1]}
        {@const gold = data.members[0]}
        {@const bronze = data.members[2]}

        <!-- Silver #2 -->
        {@const r2 = memberRank(silver.lifetime_xp || silver.xp, silver.equipped_title_id, silver.equipped_badge_id)}
        <a href="/u/{silver.username}" class="podium-card podium-tier-2 olympic-silver">
          <div class="podium-rank-ribbon ribbon-silver">
            <span>2º LUGAR</span>
          </div>
          <div class="podium-medal">🥈</div>
          <div class="podium-avatar-wrap">
            <UserAvatar
              avatarId={silver.avatar_id}
              crop={silver.avatar_crop}
              displayName={silver.display_name}
              frameId={silver.avatar_frame_id}
              size={66}
            />
          </div>
          <strong
            class="podium-user-name"
            style={silver.name_color ? `color: ${silver.name_color}; text-shadow: 0 0 10px ${silver.name_color}55;` : ''}
          >
            {silver.display_name}
          </strong>
          <span class="podium-user-handle">@{silver.username}</span>
          <div class="podium-tags">
            <span class="rank-title-chip silver-chip">{r2.title}</span>
            <span class="level-badge-pill">Nv. {r2.level}</span>
          </div>
          <div class="podium-xp-banner silver-xp">
            <span>{formatNumber(silver.season_xp || silver.xp)} XP</span>
            <small>da Temporada</small>
          </div>
        </a>

        <!-- Gold #1 (Dominant Center, Crown & Aura) -->
        {@const r1 = memberRank(gold.lifetime_xp || gold.xp, gold.equipped_title_id, gold.equipped_badge_id)}
        <a href="/u/{gold.username}" class="podium-card podium-tier-1 olympic-gold">
          <div class="gold-crown-tag">
            <Sparkles size={14} />
            <span>1º LUGAR CÓSMICO</span>
          </div>
          <div class="podium-medal gold-medal">👑</div>
          <div class="podium-avatar-wrap gold-avatar-halo">
            <UserAvatar
              avatarId={gold.avatar_id}
              crop={gold.avatar_crop}
              displayName={gold.display_name}
              frameId={gold.avatar_frame_id}
              size={76}
            />
          </div>
          <strong
            class="podium-user-name gold-name"
            style={gold.name_color ? `color: ${gold.name_color}; text-shadow: 0 0 14px ${gold.name_color}77;` : ''}
          >
            {gold.display_name}
          </strong>
          <span class="podium-user-handle">@{gold.username}</span>
          <div class="podium-tags">
            <span class="rank-title-chip gold-chip">{r1.title}</span>
            <span class="level-badge-pill gold-level">Nv. {r1.level}</span>
          </div>
          <div class="podium-xp-banner gold-xp">
            <span>{formatNumber(gold.season_xp || gold.xp)} XP</span>
            <small>Líder da Temporada</small>
          </div>
        </a>

        <!-- Bronze #3 -->
        {@const r3 = memberRank(bronze.lifetime_xp || bronze.xp, bronze.equipped_title_id, bronze.equipped_badge_id)}
        <a href="/u/{bronze.username}" class="podium-card podium-tier-3 olympic-bronze">
          <div class="podium-rank-ribbon ribbon-bronze">
            <span>3º LUGAR</span>
          </div>
          <div class="podium-medal">🥉</div>
          <div class="podium-avatar-wrap">
            <UserAvatar
              avatarId={bronze.avatar_id}
              crop={bronze.avatar_crop}
              displayName={bronze.display_name}
              frameId={bronze.avatar_frame_id}
              size={64}
            />
          </div>
          <strong
            class="podium-user-name"
            style={bronze.name_color ? `color: ${bronze.name_color}; text-shadow: 0 0 10px ${bronze.name_color}55;` : ''}
          >
            {bronze.display_name}
          </strong>
          <span class="podium-user-handle">@{bronze.username}</span>
          <div class="podium-tags">
            <span class="rank-title-chip bronze-chip">{r3.title}</span>
            <span class="level-badge-pill">Nv. {r3.level}</span>
          </div>
          <div class="podium-xp-banner bronze-xp">
            <span>{formatNumber(bronze.season_xp || bronze.xp)} XP</span>
            <small>da Temporada</small>
          </div>
        </a>

      {:else if data.members.length === 2}
        <!-- 2 Readers: Gold & Silver side-by-side -->
        {@const gold = data.members[0]}
        {@const silver = data.members[1]}
        {@const r1 = memberRank(gold.lifetime_xp || gold.xp, gold.equipped_title_id, gold.equipped_badge_id)}
        {@const r2 = memberRank(silver.lifetime_xp || silver.xp, silver.equipped_title_id, silver.equipped_badge_id)}

        <a href="/u/{gold.username}" class="podium-card podium-tier-1">
          <div class="gold-crown-tag">
            <Sparkles size={14} />
            <span>1º LUGAR</span>
          </div>
          <div class="podium-medal gold-medal">👑</div>
          <div class="podium-avatar-wrap gold-avatar-halo">
            <UserAvatar
              avatarId={gold.avatar_id}
              crop={gold.avatar_crop}
              displayName={gold.display_name}
              frameId={gold.avatar_frame_id}
              size={72}
            />
          </div>
          <strong
            class="podium-user-name gold-name"
            style={gold.name_color ? `color: ${gold.name_color};` : ''}
          >
            {gold.display_name}
          </strong>
          <span class="podium-user-handle">@{gold.username}</span>
          <div class="podium-tags">
            <span class="rank-title-chip gold-chip">{r1.title}</span>
            <span class="level-badge-pill gold-level">Nv. {r1.level}</span>
          </div>
          <div class="podium-xp-banner gold-xp">
            <span>{formatNumber(gold.season_xp || gold.xp)} XP</span>
          </div>
        </a>

        <a href="/u/{silver.username}" class="podium-card podium-tier-2">
          <div class="podium-medal">🥈</div>
          <div class="podium-avatar-wrap">
            <UserAvatar
              avatarId={silver.avatar_id}
              crop={silver.avatar_crop}
              displayName={silver.display_name}
              frameId={silver.avatar_frame_id}
              size={66}
            />
          </div>
          <strong
            class="podium-user-name"
            style={silver.name_color ? `color: ${silver.name_color};` : ''}
          >
            {silver.display_name}
          </strong>
          <span class="podium-user-handle">@{silver.username}</span>
          <div class="podium-tags">
            <span class="rank-title-chip silver-chip">{r2.title}</span>
            <span class="level-badge-pill">Nv. {r2.level}</span>
          </div>
          <div class="podium-xp-banner silver-xp">
            <span>{formatNumber(silver.season_xp || silver.xp)} XP</span>
          </div>
        </a>

      {:else if data.members.length === 1}
        <!-- 1 Reader: Single Dominant Card -->
        {@const gold = data.members[0]}
        {@const r1 = memberRank(gold.lifetime_xp || gold.xp, gold.equipped_title_id, gold.equipped_badge_id)}

        <a href="/u/{gold.username}" class="podium-card podium-tier-1 single-gold-card">
          <div class="gold-crown-tag">
            <Sparkles size={14} />
            <span>LÍDER DA NOX</span>
          </div>
          <div class="podium-medal gold-medal">👑</div>
          <div class="podium-avatar-wrap gold-avatar-halo">
            <UserAvatar
              avatarId={gold.avatar_id}
              crop={gold.avatar_crop}
              displayName={gold.display_name}
              frameId={gold.avatar_frame_id}
              size={76}
            />
          </div>
          <strong
            class="podium-user-name gold-name"
            style={gold.name_color ? `color: ${gold.name_color};` : ''}
          >
            {gold.display_name}
          </strong>
          <span class="podium-user-handle">@{gold.username}</span>
          <div class="podium-tags">
            <span class="rank-title-chip gold-chip">{r1.title}</span>
            <span class="level-badge-pill gold-level">Nv. {r1.level}</span>
          </div>
          <div class="podium-xp-banner gold-xp">
            <span>{formatNumber(gold.season_xp || gold.xp)} XP</span>
          </div>
        </a>
      {/if}
    </div>

    <!-- 4th Place and Beyond — Leaderboard Table (Desktop) -->
    <section class="leaderboard-table-card desktop-only" aria-label="Tabela de Classificação Completa">
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th style="width: 84px">Posição</th>
            <th>Leitor</th>
            <th>Título Honorífico</th>
            <th style="text-align: center; width: 110px;">Nível Permanente</th>
            <th style="text-align: right; width: 150px;">XP da Temporada</th>
          </tr>
        </thead>
        <tbody>
          {#each data.members as member, i (member.id)}
            {@const r = memberRank(member.lifetime_xp || member.xp, member.equipped_title_id, member.equipped_badge_id)}
            {@const isCurrentUser = data.currentUser?.id === member.id}
            <tr
              class="leaderboard-row"
              class:is-top-three={i < 3}
              class:is-current-user={isCurrentUser}
            >
              <td class="rank-col">
                {#if i === 0}
                  <span class="medal-num gold">01</span>
                {:else if i === 1}
                  <span class="medal-num silver">02</span>
                {:else if i === 2}
                  <span class="medal-num bronze">03</span>
                {:else}
                  <span class="medal-num standard">{String(i + 1).padStart(2, '0')}</span>
                {/if}
              </td>
              <td>
                <div class="user-cell">
                  <UserAvatar
                    avatarId={member.avatar_id}
                    crop={member.avatar_crop}
                    displayName={member.display_name}
                    frameId={member.avatar_frame_id}
                    size={38}
                  />
                  <div class="user-titles">
                    <a href="/u/{member.username}" class="user-link">
                      <strong
                        style={member.name_color
                          ? `color: ${member.name_color}; text-shadow: 0 0 8px ${member.name_color}44;`
                          : ''}
                      >
                        {member.display_name}
                      </strong>
                      {#if isCurrentUser}
                        <span class="you-badge">Você</span>
                      {/if}
                    </a>
                    <span class="user-slug">@{member.username}</span>
                  </div>
                </div>
              </td>
              <td>
                <span class="chip-rank">{r.title}</span>
              </td>
              <td style="text-align: center">
                <span class="level-badge" class:max-level={r.level >= 100}>
                  Nv. {r.level}
                </span>
              </td>
              <td style="text-align: right" class="xp-col">
                <strong>{formatNumber(member.season_xp || member.xp)}</strong>
                <small>XP</small>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>

    <!-- Mobile Leaderboard Cards (Responsive) -->
    <section class="ranking-mobile-list mobile-only" aria-label="Lista de Classificação Mobile">
      {#each data.members as member, i (member.id)}
        {@const r = memberRank(member.lifetime_xp || member.xp, member.equipped_title_id, member.equipped_badge_id)}
        {@const isCurrentUser = data.currentUser?.id === member.id}
        <a
          href="/u/{member.username}"
          class="ranking-mobile-card"
          class:top-card={i < 3}
          class:current-user-card={isCurrentUser}
        >
          <div class="ranking-mobile-pos">
            {#if i === 0}
              <span class="medal-num gold">01</span>
            {:else if i === 1}
              <span class="medal-num silver">02</span>
            {:else if i === 2}
              <span class="medal-num bronze">03</span>
            {:else}
              <span class="medal-num standard">{String(i + 1).padStart(2, '0')}</span>
            {/if}
          </div>

          <UserAvatar
            avatarId={member.avatar_id}
            crop={member.avatar_crop}
            displayName={member.display_name}
            frameId={member.avatar_frame_id}
            size={40}
          />

          <div class="ranking-mobile-body">
            <div class="mobile-name-row">
              <strong
                class="mobile-user-name"
                style={member.name_color
                  ? `color: ${member.name_color}; text-shadow: 0 0 8px ${member.name_color}44;`
                  : ''}
              >
                {member.display_name}
              </strong>
              {#if isCurrentUser}
                <span class="you-badge-mobile">Você</span>
              {/if}
            </div>
            <div class="mobile-tags-row">
              <span class="chip-rank-mini">{r.title}</span>
              <span class="level-badge-mini">Nv. {r.level}</span>
            </div>
          </div>

          <div class="ranking-mobile-xp">
            <strong>{formatNumber(member.season_xp || member.xp)}</strong>
            <small>XP</small>
          </div>
        </a>
      {/each}
    </section>

  {:else}
    <Empty
      title="Nenhum leitor pontuado na temporada"
      description="Comece a ler capítulos na Project Nox para ser o primeiro a subir no pódio desta temporada!"
    />
  {/if}
</div>

<!-- Hall of Fame Modal -->
{#if showHallOfFame}
  <div class="modal-backdrop" onclick={() => (showHallOfFame = false)} role="dialog" aria-modal="true">
    <div class="modal-card hall-of-fame-modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div class="modal-header-title">
          <Trophy size={20} class="trophy-gold" />
          <h2>Hall da Fama Cósmico</h2>
        </div>
        <button
          type="button"
          class="btn-close-modal"
          onclick={() => (showHallOfFame = false)}
          aria-label="Fechar"
        >
          <X size={18} />
        </button>
      </div>

      <div class="modal-body">
        <p class="hall-subtitle">
          Os mestres da leitura imortalizados nas temporadas anteriores da Project Nox.
        </p>

        {#if data.pastWinners && data.pastWinners.length > 0}
          <div class="past-winners-grid">
            {#each data.pastWinners as winner}
              <div class="past-winner-card place-{winner.place}">
                <div class="winner-place-pill">
                  {#if winner.place === 1}🥇 1º Lugar{:else if winner.place === 2}🥈 2º Lugar{:else}🥉 3º Lugar{/if}
                </div>
                <UserAvatar
                  avatarId={winner.avatar_id}
                  crop={winner.avatar_crop}
                  displayName={winner.display_name}
                  frameId={winner.avatar_frame_id}
                  size={52}
                />
                <strong
                  class="winner-name"
                  style={winner.name_color ? `color: ${winner.name_color};` : ''}
                >
                  {winner.display_name}
                </strong>
                <span class="winner-title">{winner.equipped_title || 'Mestre da Leitura'}</span>
                <span class="winner-xp">{formatNumber(winner.season_xp)} XP</span>
              </div>
            {/each}
          </div>
        {:else}
          <div class="hall-empty-state">
            <Sparkles size={36} class="hall-empty-sparkle" />
            <h3>A Temporada 1 está em andamento!</h3>
            <p>
              Ao final deste ciclo trimestral de 90 dias, os 3 primeiros colocados serão eternizados com honras aqui no Hall da Fama.
            </p>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button
          type="button"
          class="btn-modal-done"
          onclick={() => (showHallOfFame = false)}
        >
          Entendido
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .ranking-container {
    max-width: 1040px;
    margin: 0 auto;
    padding: 32px 16px 80px;
  }

  .page-top {
    text-align: center;
    margin-bottom: 28px;
  }

  .badge-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 14px;
    background: rgba(168, 85, 247, 0.12);
    border: 1px solid rgba(168, 85, 247, 0.35);
    border-radius: 9999px;
    color: #c084fc;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 12px;
  }

  .ranking-title {
    font-size: clamp(28px, 4.5vw, 40px);
    font-weight: 900;
    color: #f8fafc;
    letter-spacing: -0.5px;
    margin: 0 0 10px;
  }

  .ranking-subtitle {
    font-size: 15px;
    color: #94a3b8;
    max-width: 600px;
    margin: 0 auto;
    line-height: 1.5;
  }

  /* Season Banner Card */
  .season-banner-card {
    background: linear-gradient(135deg, rgba(26, 16, 44, 0.95), rgba(18, 10, 32, 0.98));
    border: 1px solid rgba(168, 85, 247, 0.3);
    border-radius: 16px;
    padding: 22px 24px;
    margin-bottom: 24px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(12px);
  }

  .season-banner-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 16px;
  }

  .season-badge-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .season-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.5px;
    padding: 2px 10px;
    border-radius: 9999px;
    width: fit-content;
  }

  .season-status-pill.active {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.35);
  }

  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #4ade80;
    box-shadow: 0 0 8px #4ade80;
    animation: livePulse 1.8s infinite;
  }

  @keyframes livePulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.85); }
  }

  .season-title {
    font-size: 20px;
    font-weight: 800;
    color: #f8fafc;
    margin: 0;
  }

  .season-meta-group {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .season-meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 6px 12px;
    border-radius: 8px;
  }

  .countdown-pill {
    background: rgba(245, 158, 11, 0.12);
    border-color: rgba(245, 158, 11, 0.3);
    color: #fbbf24;
  }

  .btn-hall-fame {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(126, 34, 206, 0.35));
    border: 1px solid rgba(168, 85, 247, 0.45);
    border-radius: 8px;
    color: #e9d5ff;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-hall-fame:hover {
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(126, 34, 206, 0.5));
    transform: translateY(-1px);
    border-color: rgba(168, 85, 247, 0.7);
  }

  .season-rules-callout {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(168, 85, 247, 0.18);
    border-radius: 10px;
    padding: 12px 16px;
  }

  .rules-callout-icon {
    color: #a855f7;
    margin-top: 2px;
    flex-shrink: 0;
  }

  .rules-callout-body {
    font-size: 13px;
    line-height: 1.5;
    color: #cbd5e1;
  }

  .rules-callout-body strong {
    color: #e2e8f0;
  }

  .rules-callout-body p {
    margin: 4px 0 0;
  }

  /* User Progress Card */
  .user-progress-card {
    background: linear-gradient(135deg, rgba(20, 12, 34, 0.95), rgba(30, 16, 52, 0.95));
    border: 1px solid rgba(168, 85, 247, 0.4);
    border-radius: 16px;
    padding: 20px 24px;
    margin-bottom: 28px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
  }

  .user-progress-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 18px;
  }

  .user-profile-identity {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .user-name-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }

  .user-display-name {
    font-size: 17px;
    font-weight: 800;
    color: #f8fafc;
  }

  .user-handle {
    font-size: 13px;
    color: #64748b;
  }

  .user-badges-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    flex-wrap: wrap;
  }

  .user-title-chip {
    font-size: 11px;
    font-weight: 700;
    background: rgba(168, 85, 247, 0.15);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.3);
    padding: 2px 8px;
    border-radius: 6px;
  }

  .user-level-chip {
    font-size: 11px;
    font-weight: 800;
    background: rgba(251, 191, 36, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(251, 191, 36, 0.35);
    padding: 2px 8px;
    border-radius: 6px;
  }

  .user-rank-position-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.28);
    padding: 2px 8px;
    border-radius: 6px;
  }

  .user-season-stats {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .stat-box {
    display: flex;
    flex-direction: column;
    text-align: right;
  }

  .stat-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: #64748b;
    letter-spacing: 0.5px;
  }

  .stat-val {
    font-size: 16px;
    font-weight: 800;
    color: #e2e8f0;
  }

  .stat-val.highlight {
    color: #c084fc;
  }

  .stat-val small {
    font-size: 11px;
    color: #94a3b8;
  }

  /* Level Progress Bar */
  .level-progress-labels {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12.5px;
    margin-bottom: 8px;
    font-weight: 700;
  }

  .level-label {
    color: #cbd5e1;
  }

  .level-label.max-level {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #fbbf24;
    text-shadow: 0 0 10px rgba(251, 191, 36, 0.4);
  }

  .xp-progress-count {
    color: #94a3b8;
  }

  .xp-progress-count strong {
    color: #f8fafc;
  }

  .level-bar-container {
    height: 10px;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 9999px;
    overflow: hidden;
    position: relative;
  }

  .level-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #9333ea, #c084fc, #f59e0b);
    border-radius: 9999px;
    position: relative;
    transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .level-bar-container.is-max .level-bar-fill {
    background: linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b);
    box-shadow: 0 0 16px rgba(251, 191, 36, 0.6);
  }

  .bar-shine-sweep {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
    animation: shineSweep 2.2s infinite;
  }

  @keyframes shineSweep {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(200%); }
  }

  /* Olympic Podium Section */
  .podium-section {
    display: grid;
    gap: 16px;
    margin-bottom: 36px;
    align-items: end;
  }

  .podium-section.is-olympic {
    grid-template-columns: 1fr 1.15fr 1fr;
  }

  .podium-section.is-double {
    grid-template-columns: 1fr 1fr;
  }

  .podium-section.is-single {
    grid-template-columns: minmax(0, 420px);
    justify-content: center;
  }

  .podium-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    border-radius: 20px;
    padding: 24px 16px 20px;
    text-decoration: none;
    transition: transform 0.25s ease, box-shadow 0.25s ease;
    backdrop-filter: blur(12px);
  }

  .podium-card:hover {
    transform: translateY(-4px);
  }

  /* Tier 1 Gold (Highest, Dominant) */
  .podium-tier-1 {
    background: linear-gradient(180deg, rgba(42, 28, 12, 0.95) 0%, rgba(24, 14, 38, 0.98) 100%);
    border: 2px solid rgba(245, 158, 11, 0.65);
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.6),
      0 0 35px rgba(245, 158, 11, 0.25),
      inset 0 0 20px rgba(245, 158, 11, 0.1);
    min-height: 310px;
    z-index: 2;
  }

  .gold-crown-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(90deg, #f59e0b, #d97706);
    color: #000;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.5px;
    padding: 4px 12px;
    border-radius: 9999px;
    margin-bottom: 8px;
    box-shadow: 0 0 12px rgba(245, 158, 11, 0.5);
  }

  .podium-medal {
    font-size: 28px;
    margin-bottom: 4px;
  }

  .podium-medal.gold-medal {
    font-size: 32px;
  }

  .gold-avatar-halo {
    position: relative;
    filter: drop-shadow(0 0 18px rgba(245, 158, 11, 0.45));
  }

  .gold-name {
    font-size: 18px !important;
    color: #fbbf24 !important;
  }

  /* Tier 2 Silver */
  .podium-tier-2 {
    background: linear-gradient(180deg, rgba(28, 30, 42, 0.95) 0%, rgba(18, 14, 30, 0.98) 100%);
    border: 1px solid rgba(148, 163, 184, 0.45);
    box-shadow:
      0 8px 30px rgba(0, 0, 0, 0.5),
      0 0 20px rgba(148, 163, 184, 0.15);
    min-height: 270px;
  }

  /* Tier 3 Bronze */
  .podium-tier-3 {
    background: linear-gradient(180deg, rgba(38, 22, 18, 0.95) 0%, rgba(18, 14, 30, 0.98) 100%);
    border: 1px solid rgba(217, 119, 6, 0.35);
    box-shadow:
      0 8px 30px rgba(0, 0, 0, 0.5),
      0 0 20px rgba(217, 119, 6, 0.12);
    min-height: 255px;
  }

  .podium-rank-ribbon {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.5px;
    padding: 2px 10px;
    border-radius: 9999px;
    margin-bottom: 6px;
  }

  .ribbon-silver {
    background: rgba(148, 163, 184, 0.18);
    color: #e2e8f0;
    border: 1px solid rgba(148, 163, 184, 0.35);
  }

  .ribbon-bronze {
    background: rgba(217, 119, 6, 0.18);
    color: #fdba74;
    border: 1px solid rgba(217, 119, 6, 0.35);
  }

  .podium-avatar-wrap {
    margin-bottom: 10px;
  }

  .podium-user-name {
    font-size: 16px;
    font-weight: 800;
    color: #f8fafc;
    margin-bottom: 2px;
    max-width: 90%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .podium-user-handle {
    font-size: 12px;
    color: #64748b;
    margin-bottom: 10px;
  }

  .podium-tags {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: center;
    margin-bottom: 14px;
  }

  .rank-title-chip {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 6px;
  }

  .gold-chip {
    background: rgba(245, 158, 11, 0.18);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.35);
  }

  .silver-chip {
    background: rgba(148, 163, 184, 0.18);
    color: #e2e8f0;
    border: 1px solid rgba(148, 163, 184, 0.35);
  }

  .bronze-chip {
    background: rgba(217, 119, 6, 0.18);
    color: #fdba74;
    border: 1px solid rgba(217, 119, 6, 0.35);
  }

  .level-badge-pill {
    font-size: 11px;
    font-weight: 800;
    background: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
    padding: 2px 6px;
    border-radius: 6px;
  }

  .level-badge-pill.gold-level {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
  }

  .podium-xp-banner {
    width: 100%;
    padding: 8px 12px;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .podium-xp-banner span {
    font-size: 16px;
    font-weight: 900;
  }

  .podium-xp-banner small {
    font-size: 11px;
    opacity: 0.8;
  }

  .gold-xp {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .silver-xp {
    background: rgba(148, 163, 184, 0.15);
    color: #e2e8f0;
    border: 1px solid rgba(148, 163, 184, 0.25);
  }

  .bronze-xp {
    background: rgba(217, 119, 6, 0.15);
    color: #fdba74;
    border: 1px solid rgba(217, 119, 6, 0.25);
  }

  /* Desktop Table */
  .leaderboard-table-card {
    background: linear-gradient(135deg, rgba(20, 10, 36, 0.95), rgba(12, 8, 22, 0.98));
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
  }

  .leaderboard-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  .leaderboard-table th {
    padding: 14px 18px;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #64748b;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(0, 0, 0, 0.2);
    text-align: left;
  }

  .leaderboard-row {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    transition: background 0.15s ease;
  }

  .leaderboard-row:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .leaderboard-row.is-current-user {
    background: rgba(168, 85, 247, 0.08);
    box-shadow: inset 3px 0 0 #a855f7;
  }

  .leaderboard-table td {
    padding: 12px 18px;
    vertical-align: middle;
  }

  .medal-num {
    font-size: 14px;
    font-weight: 900;
    display: inline-block;
    width: 28px;
    text-align: center;
  }

  .medal-num.gold {
    color: #fbbf24;
  }

  .medal-num.silver {
    color: #cbd5e1;
  }

  .medal-num.bronze {
    color: #f97316;
  }

  .medal-num.standard {
    color: #64748b;
  }

  .user-cell {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .user-titles {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .user-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: #f8fafc;
    text-decoration: none;
    font-weight: 700;
  }

  .user-link:hover strong {
    color: #c084fc;
  }

  .you-badge {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    background: #a855f7;
    color: #fff;
    padding: 1px 6px;
    border-radius: 4px;
  }

  .user-slug {
    font-size: 12px;
    color: #64748b;
  }

  .chip-rank {
    display: inline-block;
    font-size: 11.5px;
    font-weight: 700;
    background: rgba(168, 85, 247, 0.12);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.25);
    padding: 2px 8px;
    border-radius: 6px;
  }

  .level-badge {
    display: inline-block;
    font-size: 12px;
    font-weight: 800;
    color: #e2e8f0;
    background: rgba(255, 255, 255, 0.08);
    padding: 2px 10px;
    border-radius: 6px;
  }

  .level-badge.max-level {
    background: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(251, 191, 36, 0.4);
  }

  .xp-col strong {
    font-size: 15px;
    color: #f8fafc;
  }

  .xp-col small {
    font-size: 11px;
    color: #94a3b8;
    margin-left: 2px;
  }

  /* Mobile Leaderboard */
  .ranking-mobile-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ranking-mobile-card {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(20, 10, 36, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    padding: 10px 14px;
    text-decoration: none;
    color: inherit;
    transition: background 0.15s ease;
  }

  .ranking-mobile-card.current-user-card {
    background: rgba(168, 85, 247, 0.1);
    border-color: rgba(168, 85, 247, 0.4);
  }

  .ranking-mobile-pos {
    width: 24px;
    text-align: center;
    flex-shrink: 0;
  }

  .ranking-mobile-body {
    flex: 1;
    min-width: 0;
  }

  .mobile-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .mobile-user-name {
    font-size: 14px;
    font-weight: 800;
    color: #f8fafc;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .you-badge-mobile {
    font-size: 9px;
    font-weight: 800;
    background: #a855f7;
    color: #fff;
    padding: 1px 5px;
    border-radius: 4px;
  }

  .mobile-tags-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 3px;
  }

  .chip-rank-mini {
    font-size: 10.5px;
    font-weight: 700;
    color: #c084fc;
  }

  .level-badge-mini {
    font-size: 10.5px;
    font-weight: 800;
    color: #fbbf24;
    background: rgba(251, 191, 36, 0.12);
    padding: 1px 5px;
    border-radius: 4px;
  }

  .ranking-mobile-xp {
    text-align: right;
    flex-shrink: 0;
  }

  .ranking-mobile-xp strong {
    font-size: 14px;
    color: #f8fafc;
  }

  .ranking-mobile-xp small {
    font-size: 10px;
    color: #94a3b8;
    margin-left: 2px;
  }

  /* Modals */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .modal-card.hall-of-fame-modal {
    background: linear-gradient(135deg, rgba(24, 14, 40, 0.98), rgba(14, 8, 26, 0.98));
    border: 1px solid rgba(168, 85, 247, 0.4);
    border-radius: 18px;
    max-width: 540px;
    width: 100%;
    padding: 24px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.7);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .modal-header-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .trophy-gold {
    color: #fbbf24;
  }

  .modal-header-title h2 {
    font-size: 20px;
    font-weight: 800;
    color: #f8fafc;
    margin: 0;
  }

  .btn-close-modal {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
  }

  .btn-close-modal:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
  }

  .hall-subtitle {
    font-size: 13.5px;
    color: #94a3b8;
    margin: 0 0 20px;
    line-height: 1.4;
  }

  .hall-empty-state {
    text-align: center;
    padding: 30px 16px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 12px;
    border: 1px dashed rgba(168, 85, 247, 0.25);
  }

  .hall-empty-sparkle {
    color: #fbbf24;
    margin-bottom: 12px;
  }

  .hall-empty-state h3 {
    font-size: 16px;
    font-weight: 800;
    color: #f8fafc;
    margin: 0 0 8px;
  }

  .hall-empty-state p {
    font-size: 13px;
    color: #94a3b8;
    margin: 0;
    line-height: 1.5;
  }

  .past-winners-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 12px;
  }

  .past-winner-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 16px 12px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
  }

  .past-winner-card.place-1 {
    border: 1px solid rgba(245, 158, 11, 0.5);
    background: rgba(245, 158, 11, 0.08);
  }

  .winner-place-pill {
    font-size: 10px;
    font-weight: 800;
    margin-bottom: 8px;
  }

  .winner-name {
    font-size: 13px;
    color: #f8fafc;
    margin-top: 6px;
  }

  .winner-title {
    font-size: 11px;
    color: #c084fc;
  }

  .winner-xp {
    font-size: 12px;
    font-weight: 800;
    color: #fbbf24;
    margin-top: 4px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
  }

  .btn-modal-done {
    padding: 8px 20px;
    background: #a855f7;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-modal-done:hover {
    background: #9333ea;
  }

  /* Responsive Display Utilities */
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

    .ranking-container {
      padding: 20px 12px 60px;
    }

    .season-banner-card {
      padding: 16px;
    }

    .season-banner-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .user-progress-card {
      padding: 16px;
    }

    .user-progress-top {
      flex-direction: column;
      align-items: flex-start;
      gap: 14px;
    }

    .user-season-stats {
      width: 100%;
      justify-content: space-between;
    }

    .stat-box {
      text-align: left;
    }

    /* Mobile Podium */
    .podium-section.is-olympic {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .podium-tier-1 {
      order: 1;
      min-height: auto;
      padding: 20px 16px;
    }

    .podium-tier-2 {
      order: 2;
      min-height: auto;
      padding: 16px;
    }

    .podium-tier-3 {
      order: 3;
      min-height: auto;
      padding: 16px;
    }
  }
</style>
