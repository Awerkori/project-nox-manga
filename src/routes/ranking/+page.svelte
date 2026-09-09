<script lang="ts">
  import Empty from '$lib/components/Empty.svelte';
  import { memberRank } from '$lib/types';
  import { Sparkles } from '@lucide/svelte';
  let { data } = $props();
</script>

<svelte:head>
  <title>Classificação Oficial — Project Nox</title>
</svelte:head>

<div class="container ranking-container spacer-bottom">
  <div class="page-top">
    <div class="badge-tag">
      <Sparkles size={12} />
      <span>CLASSIFICAÇÃO OFICIAL</span>
    </div>
    <h1 class="ranking-title">Mestres da Leitura</h1>
    <p class="ranking-subtitle">
      Cada capítulo concluído rende 25 XP. Acompanhe a jornada dos maiores leitores da Project Nox.
    </p>
  </div>

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
        {@const r2 = memberRank(silver.xp, silver.equipped_title_id, silver.equipped_badge_id)}
        <a href="/u/{silver.username}" class="podium-card podium-tier-2 olympic-silver">
          <div class="podium-medal">🥈</div>
          <div class="podium-avatar-wrap">
            {#if silver.avatar_id}
              <img src="/media/{silver.avatar_id}" alt="" width="64" height="64" class="podium-avatar-img" />
            {:else}
              <span class="podium-avatar-fallback">{(silver.display_name[0] || 'N').toUpperCase()}</span>
            {/if}
          </div>
          <strong class="podium-user-name">{silver.display_name}</strong>
          <span class="podium-user-handle">@{silver.username}</span>
          <div class="podium-tags">
            {#if r2.badgeSvg}
              <img src={r2.badgeSvg} alt={r2.badge} width="20" height="20" class="podium-badge-vector" />
            {/if}
            <span class="rank-title-chip silver-chip">{r2.title}</span>
            <span class="xp-chip">{silver.xp} XP</span>
          </div>
        </a>

        <!-- Gold #1 (Dominant Center) -->
        {@const r1 = memberRank(gold.xp, gold.equipped_title_id, gold.equipped_badge_id)}
        <a href="/u/{gold.username}" class="podium-card podium-tier-1 olympic-gold">
          <div class="gold-crown-tag">
            <Sparkles size={13} />
            <span>1º LUGAR</span>
          </div>
          <div class="podium-medal">🥇</div>
          <div class="podium-avatar-wrap gold-avatar-halo">
            {#if gold.avatar_id}
              <img src="/media/{gold.avatar_id}" alt="" width="76" height="76" class="podium-avatar-img" />
            {:else}
              <span class="podium-avatar-fallback gold-fallback">{(gold.display_name[0] || 'N').toUpperCase()}</span>
            {/if}
          </div>
          <strong class="podium-user-name gold-name">{gold.display_name}</strong>
          <span class="podium-user-handle">@{gold.username}</span>
          <div class="podium-tags">
            {#if r1.badgeSvg}
              <img src={r1.badgeSvg} alt={r1.badge} width="22" height="22" class="podium-badge-vector" />
            {/if}
            <span class="rank-title-chip gold-chip">{r1.title}</span>
            <span class="xp-chip gold-xp">{gold.xp} XP</span>
          </div>
        </a>

        <!-- Bronze #3 -->
        {@const r3 = memberRank(bronze.xp, bronze.equipped_title_id, bronze.equipped_badge_id)}
        <a href="/u/{bronze.username}" class="podium-card podium-tier-3 olympic-bronze">
          <div class="podium-medal">🥉</div>
          <div class="podium-avatar-wrap">
            {#if bronze.avatar_id}
              <img src="/media/{bronze.avatar_id}" alt="" width="64" height="64" class="podium-avatar-img" />
            {:else}
              <span class="podium-avatar-fallback">{(bronze.display_name[0] || 'N').toUpperCase()}</span>
            {/if}
          </div>
          <strong class="podium-user-name">{bronze.display_name}</strong>
          <span class="podium-user-handle">@{bronze.username}</span>
          <div class="podium-tags">
            {#if r3.badgeSvg}
              <img src={r3.badgeSvg} alt={r3.badge} width="20" height="20" class="podium-badge-vector" />
            {/if}
            <span class="rank-title-chip bronze-chip">{r3.title}</span>
            <span class="xp-chip">{bronze.xp} XP</span>
          </div>
        </a>

      {:else if data.members.length === 2}
        <!-- 2 Readers: Gold & Silver side-by-side -->
        {@const gold = data.members[0]}
        {@const silver = data.members[1]}
        {@const r1 = memberRank(gold.xp, gold.equipped_title_id, gold.equipped_badge_id)}
        {@const r2 = memberRank(silver.xp, silver.equipped_title_id, silver.equipped_badge_id)}

        <a href="/u/{gold.username}" class="podium-card podium-tier-1">
          <div class="gold-crown-tag">
            <Sparkles size={13} />
            <span>1º LUGAR</span>
          </div>
          <div class="podium-medal">🥇</div>
          <div class="podium-avatar-wrap gold-avatar-halo">
            {#if gold.avatar_id}
              <img src="/media/{gold.avatar_id}" alt="" width="72" height="72" class="podium-avatar-img" />
            {:else}
              <span class="podium-avatar-fallback gold-fallback">{(gold.display_name[0] || 'N').toUpperCase()}</span>
            {/if}
          </div>
          <strong class="podium-user-name">{gold.display_name}</strong>
          <span class="podium-user-handle">@{gold.username}</span>
          <div class="podium-tags">
            <span class="rank-title-chip gold-chip">{r1.title}</span>
            <span class="xp-chip gold-xp">{gold.xp} XP</span>
          </div>
        </a>

        <a href="/u/{silver.username}" class="podium-card podium-tier-2">
          <div class="podium-medal">🥈</div>
          <div class="podium-avatar-wrap">
            {#if silver.avatar_id}
              <img src="/media/{silver.avatar_id}" alt="" width="64" height="64" class="podium-avatar-img" />
            {:else}
              <span class="podium-avatar-fallback">{(silver.display_name[0] || 'N').toUpperCase()}</span>
            {/if}
          </div>
          <strong class="podium-user-name">{silver.display_name}</strong>
          <span class="podium-user-handle">@{silver.username}</span>
          <div class="podium-tags">
            <span class="rank-title-chip silver-chip">{r2.title}</span>
            <span class="xp-chip">{silver.xp} XP</span>
          </div>
        </a>

      {:else if data.members.length === 1}
        <!-- 1 Reader: Single Dominant Card -->
        {@const gold = data.members[0]}
        {@const r1 = memberRank(gold.xp, gold.equipped_title_id, gold.equipped_badge_id)}

        <a href="/u/{gold.username}" class="podium-card podium-tier-1 single-gold-card">
          <div class="gold-crown-tag">
            <Sparkles size={13} />
            <span>LÍDER DA NOX</span>
          </div>
          <div class="podium-medal">🥇</div>
          <div class="podium-avatar-wrap gold-avatar-halo">
            {#if gold.avatar_id}
              <img src="/media/{gold.avatar_id}" alt="" width="80" height="80" class="podium-avatar-img" />
            {:else}
              <span class="podium-avatar-fallback gold-fallback">{(gold.display_name[0] || 'N').toUpperCase()}</span>
            {/if}
          </div>
          <strong class="podium-user-name gold-name">{gold.display_name}</strong>
          <span class="podium-user-handle">@{gold.username}</span>
          <div class="podium-tags">
            <span class="rank-title-chip gold-chip">{r1.title}</span>
            <span class="xp-chip gold-xp">{gold.xp} XP</span>
          </div>
        </a>
      {/if}
    </div>

    <!-- Desktop Leaderboard Table -->
    <section class="leaderboard-table-card desktop-only">
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th style="width: 80px">Posição</th>
            <th>Leitor</th>
            <th>Título Honorífico</th>
            <th style="text-align: center">Nível</th>
            <th style="text-align: right">Total XP</th>
          </tr>
        </thead>
        <tbody>
          {#each data.members as member, i (member.id)}
            {@const r = memberRank(member.xp, member.equipped_title_id, member.equipped_badge_id)}
            <tr class="leaderboard-row" class:is-top-three={i < 3}>
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
                  {#if member.avatar_id}
                    <img
                      src="/media/{member.avatar_id}"
                      alt=""
                      width="38"
                      height="38"
                      class="row-avatar-img"
                    />
                  {:else}
                    <span class="row-avatar-fallback">{member.display_name[0] || 'N'}</span>
                  {/if}
                  <div class="user-titles">
                    <a href="/u/{member.username}" class="user-link">
                      <strong>{member.display_name}</strong>
                    </a>
                    <span class="user-slug">@{member.username}</span>
                  </div>
                </div>
              </td>
              <td>
                <span class="chip-rank">{r.title}</span>
              </td>
              <td style="text-align: center">
                <span class="level-badge">{r.level}</span>
              </td>
              <td style="text-align: right" class="xp-col">
                <strong>{member.xp}</strong>
                <small>XP</small>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>

    <!-- Mobile Leaderboard Cards -->
    <section class="ranking-mobile-list mobile-only">
      {#each data.members as member, i (member.id)}
        {@const r = memberRank(member.xp, member.equipped_title_id, member.equipped_badge_id)}
        <a href="/u/{member.username}" class="ranking-mobile-card" class:top-card={i < 3}>
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

          <div class="ranking-mobile-avatar">
            {#if member.avatar_id}
              <img
                src="/media/{member.avatar_id}"
                alt=""
                width="42"
                height="42"
                class="row-avatar-img"
              />
            {:else}
              <span class="row-avatar-fallback">{member.display_name[0] || 'N'}</span>
            {/if}
          </div>

          <div class="ranking-mobile-info">
            <div class="ranking-mobile-name-row">
              <strong class="ranking-mobile-name">{member.display_name}</strong>
            </div>
            <span class="ranking-mobile-handle">@{member.username}</span>
            <div class="ranking-mobile-chips">
              <span class="chip-rank-mini">{r.title}</span>
            </div>
          </div>

          <div class="ranking-mobile-stats">
            <div class="ranking-mobile-level">Nv. {r.level}</div>
            <div class="ranking-mobile-xp">
              <strong>{member.xp}</strong> <small>XP</small>
            </div>
          </div>
        </a>
      {/each}
    </section>
  {:else}
    <Empty
      title="Toda comunidade tem um primeiro leitor."
      text="O ranking ganha vida conforme os capítulos são lidos. Sua história na Nox pode começar agora."
      href="/catalogo"
      label="Encontrar uma leitura"
    />
  {/if}
</div>

<style>
  .ranking-container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .badge-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: #dfc28d;
    margin-bottom: 8px;
    background: rgba(201, 170, 115, 0.12);
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid rgba(201, 170, 115, 0.25);
  }

  .ranking-title {
    font-size: clamp(32px, 4.5vw, 48px);
    font-weight: 800;
    margin: 0 0 10px;
    color: #ffffff;
  }

  .ranking-subtitle {
    font-size: 15px;
    color: #9d99ab;
    max-width: 580px;
    margin: 0 0 36px;
    line-height: 1.6;
  }

  /* Podium */
  .podium-section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 20px;
    margin-bottom: 48px;
  }

  .podium-section.is-single {
    grid-template-columns: 1fr;
    max-width: 360px;
    margin-left: auto;
    margin-right: auto;
  }

  .podium-section.is-double {
    grid-template-columns: repeat(2, 1fr);
    max-width: 680px;
    margin-left: auto;
    margin-right: auto;
  }

  .podium-section.is-olympic {
    grid-template-columns: 1fr 1.15fr 1fr;
    align-items: end;
  }

  .podium-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 32px 20px 24px;
    border-radius: 20px;
    background: rgba(13, 16, 26, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(16px);
    text-decoration: none;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .podium-card:hover {
    transform: translateY(-4px);
  }

  .podium-tier-1 {
    border-color: rgba(201, 170, 115, 0.55);
    box-shadow: 0 16px 42px -10px rgba(201, 170, 115, 0.25), 0 0 20px rgba(201, 170, 115, 0.08);
  }

  .olympic-gold {
    padding-top: 42px;
    padding-bottom: 30px;
    transform: translateY(-14px);
    border-color: rgba(201, 170, 115, 0.65);
    background: linear-gradient(180deg, rgba(201, 170, 115, 0.08) 0%, rgba(13, 16, 26, 0.85) 100%);
  }

  .olympic-gold:hover {
    transform: translateY(-18px);
  }

  .gold-crown-tag {
    position: absolute;
    top: -12px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 12px;
    border-radius: 999px;
    background: linear-gradient(135deg, #dfc28d, #c9aa73);
    color: #120f06;
    font-size: 10px;
    font-weight: 850;
    letter-spacing: 0.12em;
    box-shadow: 0 4px 16px rgba(201, 170, 115, 0.45);
  }

  .gold-avatar-halo {
    border-color: #dfc28d !important;
    box-shadow: 0 0 20px rgba(201, 170, 115, 0.35);
  }

  .gold-name {
    font-size: 18px !important;
    color: #ffffff;
  }

  .gold-chip {
    background: rgba(201, 170, 115, 0.18) !important;
    color: #f0daae !important;
    border-color: rgba(201, 170, 115, 0.4) !important;
  }

  .gold-xp {
    color: #dfc28d !important;
  }

  .silver-chip {
    background: rgba(188, 193, 207, 0.14) !important;
    color: #e2e5ee !important;
    border-color: rgba(188, 193, 207, 0.35) !important;
  }

  .bronze-chip {
    background: rgba(184, 130, 92, 0.14) !important;
    color: #f0c5a3 !important;
    border-color: rgba(184, 130, 92, 0.35) !important;
  }

  .podium-tier-2 {
    border-color: rgba(188, 193, 207, 0.4);
    box-shadow: 0 12px 32px -10px rgba(188, 193, 207, 0.15);
  }

  .podium-tier-3 {
    border-color: rgba(184, 130, 92, 0.4);
    box-shadow: 0 12px 32px -10px rgba(184, 130, 92, 0.15);
  }

  .podium-medal {
    font-size: 28px;
    margin-bottom: 12px;
  }

  .podium-avatar-wrap {
    width: 68px;
    height: 68px;
    border-radius: 50%;
    overflow: hidden;
    margin-bottom: 12px;
    border: 2px solid rgba(181, 154, 245, 0.4);
    display: grid;
    place-items: center;
  }

  .podium-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .podium-avatar-fallback {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    background: #191c32;
    color: #b59af5;
    font-size: 26px;
    font-weight: 800;
    line-height: 1;
    text-transform: uppercase;
    user-select: none;
  }

  .podium-user-name {
    font-size: 17px;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 2px;
  }

  .podium-user-handle {
    font-size: 12px;
    color: #8c899a;
    margin-bottom: 14px;
  }

  .podium-tags {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
  }

  .rank-title-chip {
    font-size: 11px;
    font-weight: 600;
    color: #c9aa73;
    padding: 3px 10px;
    border-radius: 999px;
    background: rgba(201, 170, 115, 0.12);
    border: 1px solid rgba(201, 170, 115, 0.25);
  }

  .xp-chip {
    font-size: 11px;
    font-weight: 700;
    color: #b59af5;
  }

  /* Desktop Table */
  .desktop-only {
    display: block;
  }

  .mobile-only {
    display: none;
  }

  .leaderboard-table-card {
    border-radius: 20px;
    background: rgba(13, 16, 26, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.07);
    overflow: hidden;
    backdrop-filter: blur(16px);
  }

  .leaderboard-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  .leaderboard-table th {
    padding: 16px 20px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #7b788a;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    text-align: left;
  }

  .leaderboard-row {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    transition: background 0.15s ease;
  }

  .leaderboard-row:hover {
    background: rgba(181, 154, 245, 0.06);
  }

  .leaderboard-row:last-child {
    border-bottom: none;
  }

  .leaderboard-table td {
    padding: 14px 20px;
  }

  .medal-num {
    font-weight: 800;
    font-size: 14px;
    letter-spacing: 0.04em;
    font-variant-numeric: tabular-nums;
  }

  .medal-num.gold { color: #c9aa73; text-shadow: 0 0 10px rgba(201, 170, 115, 0.4); }
  .medal-num.silver { color: #bcc1cf; }
  .medal-num.bronze { color: #b8825c; }
  .medal-num.standard { color: #5c596b; }

  .user-cell {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .row-avatar-img {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .row-avatar-fallback {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: #191c32;
    color: #b59af5;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 14px;
    line-height: 1;
    text-transform: uppercase;
    user-select: none;
    flex-shrink: 0;
    border: 1px solid rgba(181, 154, 245, 0.25);
  }

  .user-titles {
    display: flex;
    flex-direction: column;
  }

  .user-link {
    color: #ffffff;
    text-decoration: none;
    font-size: 14px;
  }

  .user-link:hover {
    color: #b59af5;
  }

  .user-slug {
    font-size: 12px;
    color: #7b788a;
  }

  .chip-rank {
    font-size: 11px;
    font-weight: 600;
    color: #c9aa73;
    padding: 4px 10px;
    border-radius: 6px;
    background: rgba(201, 170, 115, 0.1);
    border: 1px solid rgba(201, 170, 115, 0.2);
  }

  .level-badge {
    font-weight: 700;
    color: #ffffff;
  }

  .xp-col strong {
    color: #c9aa73;
    font-size: 15px;
  }

  .xp-col small {
    color: #7b788a;
    font-size: 11px;
    margin-left: 3px;
  }

  /* Mobile Leaderboard Cards */
  @media (max-width: 680px) {
    .desktop-only {
      display: none !important;
    }

    .mobile-only {
      display: flex !important;
      flex-direction: column;
      gap: 10px;
    }

    .podium-section,
    .podium-section.is-olympic,
    .podium-section.is-double,
    .podium-section.is-single {
      grid-template-columns: 1fr;
      gap: 14px;
      margin-bottom: 28px;
      max-width: 100%;
    }

    .olympic-gold {
      order: 1;
      transform: none;
      padding-top: 32px;
    }

    .olympic-silver {
      order: 2;
    }

    .olympic-bronze {
      order: 3;
    }

    .podium-card {
      padding: 20px 16px;
    }

    .ranking-mobile-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 16px;
      background: rgba(13, 16, 26, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.07);
      text-decoration: none;
      backdrop-filter: blur(14px);
      transition: all 0.2s ease;
    }

    .ranking-mobile-card:active {
      transform: scale(0.99);
      background: rgba(25, 29, 45, 0.85);
    }

    .ranking-mobile-card.top-card {
      border-color: rgba(201, 170, 115, 0.3);
      background: linear-gradient(90deg, rgba(201, 170, 115, 0.05) 0%, rgba(13, 16, 26, 0.8) 100%);
    }

    .ranking-mobile-pos {
      width: 28px;
      text-align: center;
      flex-shrink: 0;
    }

    .ranking-mobile-avatar {
      flex-shrink: 0;
    }

    .ranking-mobile-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .ranking-mobile-name-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .ranking-mobile-name {
      font-size: 14px;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ranking-mobile-handle {
      font-size: 11px;
      color: #7b788a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ranking-mobile-chips {
      margin-top: 2px;
    }

    .chip-rank-mini {
      display: inline-block;
      font-size: 10px;
      font-weight: 600;
      color: #c9aa73;
      padding: 1px 6px;
      border-radius: 4px;
      background: rgba(201, 170, 115, 0.12);
    }

    .ranking-mobile-stats {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      flex-shrink: 0;
      gap: 2px;
    }

    .ranking-mobile-level {
      font-size: 11px;
      font-weight: 700;
      color: #b59af5;
      background: rgba(181, 154, 245, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
    }

    .ranking-mobile-xp strong {
      font-size: 13px;
      font-weight: 800;
      color: #c9aa73;
    }

    .ranking-mobile-xp small {
      font-size: 10px;
      color: #7b788a;
    }
  }
</style>
