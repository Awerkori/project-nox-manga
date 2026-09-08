<script lang="ts">
  import { ArrowRight, BookOpen, Clock, Trophy } from '@lucide/svelte';
  import Hero from '$lib/components/Hero.svelte';
  import WorkCard from '$lib/components/WorkCard.svelte';
  import { memberRank } from '$lib/types';

  let { data } = $props();
</script>

<svelte:head>
  <title>Project Nox — Histórias que nascem nas sombras e conquistam a noite</title>
</svelte:head>

<div class="home-wrapper">
  <!-- Cinematographic Hero with Official Brand Emblem & Spotlight -->
  <Hero featuredWork={data.featured} />

  <div class="container home-content">
    <!-- Continue Reading (Logged in members with progress) -->
    {#if data.recent.length}
      <section class="section-block">
        <div class="section-title-row">
          <div class="title-with-badge">
            <span class="sub-badge"><Clock size={12} /> CONTINUAR</span>
            <h2 class="section-title">De Onde Você Parou</h2>
          </div>
          <a href="/historico" class="view-all-link">
            <span>Histórico</span>
            <ArrowRight size={14} />
          </a>
        </div>

        <div class="continue-grid">
          {#each data.recent as item (item.workId)}
            <a href={item.destinationUrl} class="continue-card">
              <div class="continue-thumb">
                {#if item.coverId}
                  <img
                    src="/media/{item.coverId}"
                    alt=""
                    width="64"
                    height="90"
                    class="thumb-img"
                  />
                {:else}
                  <div class="thumb-placeholder">NOX</div>
                {/if}
              </div>
              <div class="continue-meta">
                <strong class="continue-work-title">{item.workTitle}</strong>
                <span class="continue-ch-info">{item.progressText}</span>
                <span class="continue-cta">{item.actionLabel}</span>
              </div>
            </a>
          {/each}
        </div>
      </section>
    {/if}

    <!-- Recent Releases Grid -->
    <section id="lancamentos" class="section-block">
      <div class="section-title-row">
        <div class="title-with-badge">
          <span class="sub-badge"><BookOpen size={12} /> CATÁLOGO</span>
          <h2 class="section-title">Lançamentos Recentes</h2>
        </div>
        <a href="/catalogo" class="view-all-link">
          <span>Ver catálogo completo</span>
          <ArrowRight size={14} />
        </a>
      </div>

      {#if data.works.length}
        <div class="works-grid">
          {#each data.works as work, index (work.id)}
            <WorkCard {work} {index} />
          {/each}
        </div>
      {:else}
        <div class="empty-releases">
          <BookOpen size={36} class="empty-icon" />
          <h3>Os primeiros lançamentos estão sendo preparados</h3>
          <p>Nossa equipe editorial está organizando os próximos capítulos.</p>
        </div>
      {/if}
    </section>

    <!-- Community Top Readers Preview -->
    {#if data.topReaders.length}
      <section class="section-block">
        <div class="section-title-row">
          <div class="title-with-badge">
            <span class="sub-badge"><Trophy size={12} /> COMUNIDADE</span>
            <h2 class="section-title">Mestres da Leitura</h2>
          </div>
          <a href="/ranking" class="view-all-link">
            <span>Ranking completo</span>
            <ArrowRight size={14} />
          </a>
        </div>

        <div class="top-readers-podium">
          {#each data.topReaders as reader, i (reader.id)}
            {@const rank = memberRank(reader.xp)}
            <a href="/u/{reader.username}" class="reader-podium-card podium-rank-{i + 1}">
              <div class="podium-badge">
                {#if i === 0}🥇{:else if i === 1}🥈{:else}🥉{/if}
              </div>
              <div class="podium-avatar">
                {#if reader.avatar_id}
                  <img
                    src="/media/{reader.avatar_id}"
                    alt=""
                    width="54"
                    height="54"
                    class="avatar-img"
                  />
                {:else}
                  <span class="avatar-fallback">{(reader.display_name[0] || 'N').toUpperCase()}</span>
                {/if}
              </div>
              <div class="podium-details">
                <strong class="reader-name">{reader.display_name}</strong>
                <span class="reader-rank-title">{rank.title}</span>
                <span class="reader-xp-tag">{reader.xp} XP</span>
              </div>
            </a>
          {/each}
        </div>
      </section>
    {/if}
  </div>
</div>

<style>
  .home-wrapper {
    position: relative;
    z-index: 1;
  }

  .home-content {
    display: flex;
    flex-direction: column;
    gap: 52px;
    padding-bottom: 72px;
  }

  /* Sections */
  .section-block {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .section-title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
  }

  .title-with-badge {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .sub-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    color: #b59af5;
  }

  .section-title {
    font-size: clamp(22px, 2.8vw, 30px);
    font-weight: 750;
    letter-spacing: -0.03em;
    margin: 0;
    color: #ffffff;
  }

  .view-all-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: #c9aa73;
    transition: all 0.2s ease;
    padding-bottom: 4px;
  }

  .view-all-link:hover {
    color: #e5c58a;
    gap: 10px;
  }

  /* Continue Reading Cards */
  .continue-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
  }

  .continue-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px;
    border-radius: 14px;
    background: rgba(13, 16, 26, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(12px);
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .continue-card:hover {
    transform: translateY(-3px);
    border-color: rgba(181, 154, 245, 0.35);
    box-shadow: 0 12px 28px -6px rgba(109, 40, 217, 0.25);
  }

  .continue-thumb {
    width: 60px;
    height: 84px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    background: #0d0f1a;
  }

  .thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumb-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #151829;
    color: #b59af5;
    font-weight: 800;
    font-size: 12px;
  }

  .continue-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: hidden;
  }

  .continue-work-title {
    font-size: 14px;
    font-weight: 700;
    color: #f2f0f7;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .continue-ch-info {
    font-size: 12px;
    color: #8c899a;
  }

  .continue-cta {
    font-size: 11px;
    font-weight: 600;
    color: #b59af5;
    margin-top: 2px;
  }

  /* Works Grid */
  .works-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 24px;
  }

  @media (max-width: 600px) {
    .works-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
    }
  }

  .empty-releases {
    padding: 48px 24px;
    text-align: center;
    border-radius: 16px;
    background: rgba(13, 16, 26, 0.4);
    border: 1px dashed rgba(255, 255, 255, 0.08);
  }

  :global(.empty-icon) {
    color: #b59af5;
    margin-bottom: 12px;
  }

  .empty-releases h3 {
    font-size: 18px;
    color: #ffffff;
    margin: 0 0 6px;
  }

  .empty-releases p {
    font-size: 14px;
    color: #8c899a;
    margin: 0;
  }

  /* Top Readers Podium */
  .top-readers-podium {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
  }

  .reader-podium-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    border-radius: 16px;
    background: rgba(13, 16, 26, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(12px);
    position: relative;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .reader-podium-card:hover {
    transform: translateY(-4px);
  }

  .podium-rank-1 {
    border-color: rgba(201, 170, 115, 0.4);
    box-shadow: 0 8px 24px -6px rgba(201, 170, 115, 0.15);
  }

  .podium-rank-2 {
    border-color: rgba(190, 195, 210, 0.35);
  }

  .podium-rank-3 {
    border-color: rgba(180, 130, 95, 0.35);
  }

  .podium-badge {
    font-size: 24px;
    flex-shrink: 0;
  }

  .podium-avatar {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    border: 2px solid rgba(181, 154, 245, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .podium-avatar .avatar-fallback {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    background: #191c32;
    color: #b59af5;
    font-size: 20px;
    font-weight: 800;
    line-height: 1;
    text-transform: uppercase;
    user-select: none;
  }

  .podium-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
  }

  .reader-name {
    font-size: 15px;
    font-weight: 700;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .reader-rank-title {
    font-size: 11px;
    color: #c9aa73;
    font-weight: 600;
  }

  .reader-xp-tag {
    font-size: 11px;
    color: #b59af5;
    font-weight: 700;
  }
</style>
