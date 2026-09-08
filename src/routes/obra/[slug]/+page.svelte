<script lang="ts">
  import { BookOpen, Heart, Bookmark, ArrowDown, ArrowUp, Sparkles, CheckCircle2 } from '@lucide/svelte';
  import { invalidateAll } from '$app/navigation';
  import { goto } from '$app/navigation';
  import { action } from '$lib/actions';
  import { kindLabels, statusLabels, date } from '$lib/types';
  import Comments from '$lib/components/Comments.svelte';

  let { data } = $props();
  let notice = $state(''),
    busy = $state(false),
    ascending = $state(false),
    search = $state('');

  let chapters = $derived(
    (ascending ? [...data.chapters].reverse() : data.chapters).filter(
      (c) => String(c.number).includes(search) || c.title.toLowerCase().includes(search.toLowerCase())
    )
  );

  let resume = $derived(data.progress[0]?.chapter_id || data.chapters.at(-1)?.id);

  async function library(update: Record<string, unknown>) {
    if (!data.profile) {
      goto('/entrar');
      return;
    }
    busy = true;
    try {
      await action('member', 'library', {
        work_id: data.work.id,
        status: data.library?.status || 'READING',
        favorite: data.library?.favorite || false,
        following: data.library?.following ?? true,
        ...update
      });
      await invalidateAll();
      notice = 'Biblioteca atualizada.';
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function like() {
    if (!data.profile) {
      goto('/entrar');
      return;
    }
    if (busy) return;
    busy = true;
    try {
      await action('member', 'like', { work_id: data.work.id });
      await invalidateAll();
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>{data.work.title} — Ler na Project Nox</title>
  <meta name="description" content={data.work.synopsis.slice(0, 160)} />
  <meta property="og:title" content={data.work.title} />
  <meta property="og:description" content={data.work.synopsis.slice(0, 200)} />
  {#if data.work.cover_id}
    <meta property="og:image" content={data.coverUrl || ''} />
  {/if}
  <link rel="canonical" href={data.canonical} />
  <meta property="og:url" content={data.canonical} />
  <meta property="og:type" content="book" />
  <meta property="og:site_name" content="Project Nox" />
  <meta property="og:locale" content="pt_BR" />
  <!-- Only the server-generated, HTML-escaped JSON-LD envelope is allowed here. -->
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html data.structuredData}
</svelte:head>

<!-- Cinematic Backdrop Banner -->
{#if data.work.cover_id}
  <div class="work-backdrop" aria-hidden="true">
    <img src="/media/{data.work.cover_id}" alt="" class="backdrop-img" />
    <div class="backdrop-mask"></div>
  </div>
{/if}

<div class="container work-page-container spacer-bottom">
  <div class="page-top">
    <nav class="breadcrumb" aria-label="Navegação estrutural">
      <a href="/catalogo">Catálogo</a>
      <span>/</span>
      <span class="active-crumb">{data.work.title}</span>
    </nav>
  </div>

  <section class="work-hero">
    <div class="work-cover-wrap">
      {#if data.work.cover_id}
        <img
          src="/media/{data.work.cover_id}"
          alt="Capa de {data.work.title}"
          width="320"
          height="440"
          class="work-cover"
        />
      {:else}
        <div class="work-cover-fallback">
          <span>PROJECT NOX</span>
          <strong>{data.work.title}</strong>
        </div>
      {/if}
      <span class="cover-edition-seal">EDIÇÃO PROJECT NOX</span>
    </div>

    <div class="work-info">
      <div class="work-type-badges">
        <span class="badge-kind">{kindLabels[data.work.kind] || 'Mangá'}</span>
        <span class="badge-status">{statusLabels[data.work.status] || data.work.status}</span>
        {#if data.work.featured}
          <span class="badge-featured"><Sparkles size={12} /> Destaque</span>
        {/if}
      </div>

      <h1 class="work-title">{data.work.title}</h1>

      {#if data.work.aliases.length}
        <p class="aliases">{data.work.aliases.join(' · ')}</p>
      {/if}

      <div class="chips-row">
        {#each data.tags as tag (tag?.id)}
          {#if tag}
            <a class="chip-glass" href="/catalogo?tag={tag.slug}">{tag.name}</a>
          {/if}
        {/each}
      </div>

      <p class="synopsis">{data.work.synopsis}</p>

      <div class="stats-glass-grid">
        <div class="stat-cell">
          <span class="stat-label">Capítulos</span>
          <strong class="stat-value">{data.chapters.length}</strong>
        </div>
        {#if data.metrics}
          <div class="stat-cell">
            <span class="stat-label">Favoritos</span>
            <strong class="stat-value">{data.metrics.favorites}</strong>
          </div>
          <div class="stat-cell">
            <span class="stat-label">Leitores</span>
            <strong class="stat-value">{data.metrics.readers}</strong>
          </div>
        {/if}
        {#if data.work.author}
          <div class="stat-cell">
            <span class="stat-label">Autor</span>
            <strong class="stat-value">{data.work.author}</strong>
          </div>
        {/if}
        {#if data.work.artist}
          <div class="stat-cell">
            <span class="stat-label">Arte</span>
            <strong class="stat-value">{data.work.artist}</strong>
          </div>
        {/if}
        {#if data.work.year}
          <div class="stat-cell">
            <span class="stat-label">Lançamento</span>
            <strong class="stat-value">{data.work.year}</strong>
          </div>
        {/if}
      </div>

      <div class="actions-toolbar">
        {#if resume}
          <a class="btn-read-hero" href="/ler/{resume}">
            <BookOpen size={18} />
            <span>{data.progress.length ? 'Continuar Leitura' : 'Começar a Ler'}</span>
          </a>
        {/if}

        <button
          class="btn-glass-action"
          class:is-active={data.library?.favorite}
          onclick={() => library({ favorite: !data.library?.favorite })}
          disabled={busy}
        >
          <Bookmark size={18} fill={data.library?.favorite ? 'currentColor' : 'none'} />
          <span>{data.library?.favorite ? 'Favoritado' : 'Favoritar'}</span>
        </button>

        <button
          class="btn-glass-action"
          class:is-active={data.likes.some((l) => l.user_id === data.profile?.id)}
          onclick={like}
          disabled={busy}
          aria-label={data.likes.some((l) => l.user_id === data.profile?.id)
            ? 'Remover curtida da obra'
            : 'Curtir obra'}
        >
          <Heart
            size={18}
            fill={data.likes.some((l) => l.user_id === data.profile?.id) ? 'currentColor' : 'none'}
          />
          <span>{data.likes.length}</span>
        </button>
      </div>

      <div class="library-select-row">
        <select
          class="library-dropdown"
          aria-label="Organizar na biblioteca"
          value={data.library?.status || ''}
          onchange={(e) => library({ status: e.currentTarget.value })}
        >
          <option value="" disabled>Status na biblioteca…</option>
          <option value="READING">Lendo atualmente</option>
          <option value="PLANNED">Quero ler</option>
          <option value="COMPLETED">Concluído</option>
        </select>

        {#if data.library}
          <label class="notification-check">
            <input
              type="checkbox"
              checked={data.library.following}
              onchange={(e) => library({ following: e.currentTarget.checked })}
            />
            <span>Avisar sobre novos capítulos</span>
          </label>
        {/if}
      </div>
    </div>
  </section>

  {#if notice}
    <div class="notice" role="status">{notice}</div>
  {/if}

  {#if data.work.description}
    <section class="description-panel">
      <h2>Sobre a Obra</h2>
      <p>{data.work.description}</p>
    </section>
  {/if}

  <!-- Chapters Section -->
  <section class="chapters-section">
    <div class="chapters-header">
      <div>
        <span class="badge-mini">CONTEÚDO</span>
        <h2 class="chapters-heading">Capítulos Disponíveis ({chapters.length})</h2>
      </div>
      <span class="small muted">Atualizado em {date(data.work.updated_at)}</span>
    </div>

    <div class="chapters-toolbar">
      <input
        class="search-chapters-input"
        bind:value={search}
        placeholder="Buscar por número ou título…"
        aria-label="Buscar capítulo"
      />
      <button class="btn-sort" onclick={() => (ascending = !ascending)}>
        {#if ascending}<ArrowUp size={16} />{:else}<ArrowDown size={16} />{/if}
        <span>{ascending ? 'Mais antigos primeiro' : 'Mais recentes primeiro'}</span>
      </button>
    </div>

    <div class="chapters-list-card">
      {#each chapters as chapter (chapter.id)}
        {@const isRead = data.progress.some((p) => p.chapter_id === chapter.id && p.completed_at)}
        <a href="/ler/{chapter.id}" class="chapter-item" class:is-read={isRead}>
          <div class="chapter-left">
            <span class="chapter-num">Capítulo {chapter.number}</span>
            {#if chapter.title}
              <span class="chapter-title">{chapter.title}</span>
            {/if}
          </div>
          <div class="chapter-right">
            {#if isRead}
              <span class="read-indicator">
                <CheckCircle2 size={14} />
                <span>Lido</span>
              </span>
            {/if}
            <time>{date(chapter.published_at!)}</time>
            <BookOpen size={16} class="read-arrow" />
          </div>
        </a>
      {/each}

      {#if !chapters.length}
        <div class="empty-chapters">
          <p>Nenhum capítulo encontrado para "{search}".</p>
        </div>
      {/if}
    </div>
  </section>

  <Comments comments={data.comments} workId={data.work.id} profile={data.profile} />
</div>

<style>
  /* Cinematic Backdrop */
  .work-backdrop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 480px;
    overflow: hidden;
    pointer-events: none;
    z-index: 0;
  }

  .backdrop-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    filter: blur(48px) brightness(0.25) saturate(1.4);
    transform: scale(1.1);
  }

  .backdrop-mask {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(6, 7, 12, 0.4) 0%,
      rgba(6, 7, 12, 0.85) 60%,
      #06070c 100%
    );
  }

  .work-page-container {
    position: relative;
    z-index: 1;
  }

  .work-hero {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 52px;
    align-items: start;
    margin-top: 16px;
  }

  .work-cover-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .work-cover {
    width: 100%;
    height: auto;
    aspect-ratio: 5 / 7;
    object-fit: cover;
    border-radius: 18px;
    border: 1px solid rgba(181, 154, 245, 0.25);
    box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(181, 154, 245, 0.12);
  }

  .work-cover-fallback {
    width: 100%;
    height: auto;
    aspect-ratio: 5 / 7;
    background: #111422;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .cover-edition-seal {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    color: #c9aa73;
    margin-top: 14px;
  }

  /* Info */
  .work-info {
    display: flex;
    flex-direction: column;
  }

  .work-type-badges {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .badge-kind {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #b59af5;
    background: rgba(181, 154, 245, 0.12);
    border: 1px solid rgba(181, 154, 245, 0.25);
    padding: 4px 10px;
    border-radius: 6px;
    text-transform: uppercase;
  }

  .badge-status {
    font-size: 11px;
    font-weight: 600;
    color: #c9aa73;
    background: rgba(201, 170, 115, 0.12);
    border: 1px solid rgba(201, 170, 115, 0.25);
    padding: 4px 10px;
    border-radius: 6px;
  }

  .badge-featured {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 700;
    color: #ffffff;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.85), rgba(109, 40, 217, 0.85));
    padding: 4px 10px;
    border-radius: 6px;
  }

  .work-title {
    font-size: clamp(32px, 4vw, 48px);
    font-weight: 800;
    letter-spacing: -0.03em;
    margin: 0 0 10px;
    color: #ffffff;
    line-height: 1.15;
  }

  .aliases {
    font-size: 13px;
    color: #8c899a;
    margin: 0 0 16px;
  }

  .chips-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 20px;
  }

  .chip-glass {
    font-size: 12px;
    padding: 5px 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #c2bed4;
    transition: all 0.2s ease;
  }

  .chip-glass:hover {
    background: rgba(181, 154, 245, 0.15);
    border-color: rgba(181, 154, 245, 0.35);
    color: #ffffff;
  }

  .synopsis {
    font-size: 15px;
    line-height: 1.7;
    color: #d1cde0;
    white-space: pre-wrap;
    margin: 0 0 28px;
  }

  /* Stats Grid */
  .stats-glass-grid {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
    padding: 16px 20px;
    border-radius: 14px;
    background: rgba(13, 16, 26, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(12px);
    margin-bottom: 28px;
  }

  .stat-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-label {
    font-size: 11px;
    font-weight: 500;
    color: #7b788a;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .stat-value {
    font-size: 15px;
    font-weight: 700;
    color: #ffffff;
  }

  /* Actions Toolbar */
  .actions-toolbar {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }

  .btn-read-hero {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 14px 28px;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 700;
    color: #ffffff;
    background: linear-gradient(135deg, #8b5cf6, #6d28d9);
    box-shadow: 0 6px 28px rgba(109, 40, 217, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.2);
    transition: all 0.25s ease;
  }

  .btn-read-hero:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 36px rgba(139, 92, 246, 0.6);
  }

  .btn-glass-action {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    color: #d1cde0;
    background: rgba(18, 22, 36, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(14px);
    transition: all 0.2s ease;
  }

  .btn-glass-action:hover {
    background: rgba(28, 33, 54, 0.75);
    color: #ffffff;
    border-color: rgba(181, 154, 245, 0.3);
  }

  .btn-glass-action.is-active {
    color: #b59af5;
    border-color: rgba(181, 154, 245, 0.5);
    background: rgba(181, 154, 245, 0.12);
  }

  .library-select-row {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .library-dropdown {
    padding: 10px 16px;
    border-radius: 10px;
    background: rgba(13, 16, 26, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #d1cde0;
    font-size: 13px;
    font-weight: 500;
  }

  .notification-check {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #8c899a;
    cursor: pointer;
  }

  .description-panel {
    margin: 40px 0;
    padding: 24px 28px;
    border-radius: 16px;
    background: rgba(13, 16, 26, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .description-panel h2 {
    font-size: 20px;
    color: #ffffff;
    margin: 0 0 12px;
  }

  .description-panel p {
    font-size: 14px;
    line-height: 1.75;
    color: #a6a3b8;
    margin: 0;
    white-space: pre-wrap;
  }

  /* Chapters List */
  .chapters-section {
    margin-top: 56px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .chapters-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }

  .badge-mini {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    color: #b59af5;
  }

  .chapters-heading {
    font-size: 24px;
    font-weight: 750;
    color: #ffffff;
    margin: 4px 0 0;
  }

  .chapters-toolbar {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .search-chapters-input {
    flex: 1;
    min-width: 220px;
    padding: 12px 18px;
    border-radius: 12px;
    background: rgba(13, 16, 26, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #ffffff;
    font-size: 14px;
  }

  .search-chapters-input:focus {
    outline: none;
    border-color: #b59af5;
  }

  .btn-sort {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border-radius: 12px;
    background: rgba(18, 22, 36, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #d1cde0;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }

  .chapters-list-card {
    border-radius: 16px;
    background: rgba(13, 16, 26, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.06);
    overflow: hidden;
    backdrop-filter: blur(12px);
  }

  .chapter-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .chapter-item:last-child {
    border-bottom: none;
  }

  .chapter-item:hover {
    background: rgba(181, 154, 245, 0.08);
  }

  .chapter-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .chapter-num {
    font-size: 15px;
    font-weight: 700;
    color: #ffffff;
  }

  .chapter-title {
    font-size: 13px;
    color: #8c899a;
  }

  .chapter-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .read-indicator {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #b59af5;
  }

  .chapter-right time {
    font-size: 12px;
    color: #676475;
  }

  :global(.read-arrow) {
    color: #b59af5;
    opacity: 0.6;
    transition: transform 0.2s ease, opacity 0.2s ease;
  }

  .chapter-item:hover :global(.read-arrow) {
    transform: translateX(3px);
    opacity: 1;
  }

  .empty-chapters {
    padding: 32px;
    text-align: center;
    color: #7b788a;
  }

  @media (max-width: 860px) {
    .work-hero {
      grid-template-columns: 1fr;
      gap: 32px;
    }

    .work-cover-wrap {
      max-width: 240px;
      margin: 0 auto;
    }

    .work-info {
      text-align: center;
      align-items: center;
    }

    .chips-row {
      justify-content: center;
    }

    .stats-glass-grid {
      justify-content: center;
    }

    .actions-toolbar {
      justify-content: center;
    }

    .library-select-row {
      justify-content: center;
    }

    .chapter-item {
      padding: 14px 18px;
    }

    .chapter-left {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
  }
</style>
