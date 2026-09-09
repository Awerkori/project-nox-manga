<script lang="ts">
  import {
    BookOpen,
    Heart,
    Bookmark,
    ArrowDown,
    ArrowUp,
    Sparkles,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    AlertTriangle,
    Flag
  } from '@lucide/svelte';
  import { invalidateAll } from '$app/navigation';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { action } from '$lib/actions';
  import { kindLabels, statusLabels, date } from '$lib/types';
  import Comments from '$lib/components/Comments.svelte';
  import ReportModal from '$lib/components/ReportModal.svelte';

  let { data } = $props();
  let notice = $state(''),
    busy = $state(false),
    ascending = $state(false),
    search = $state(''),
    synopsisExpanded = $state(false),
    showReportModal = $state(false);

  let isAdult = $derived(data.work.content_rating === 'ADULT_18');
  let effectiveBlur = $derived(isAdult && (page.data?.blurNsfw ?? true));

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
  <meta property="og:image" content={data.metaImage} />
  <meta property="og:image:alt" content="Capa de {data.work.title}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content={data.metaImage} />
  <meta name="twitter:title" content="{data.work.title} — Ler na Project Nox" />
  <meta name="twitter:description" content={data.work.synopsis.slice(0, 200)} />
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

  <div class="kuro-layout-grid">
    <!-- LEFT SIDEBAR: Cover + INFORMAÇÕES (Under Cover on Desktop) -->
    <aside class="kuro-sidebar">
      <div class="work-cover-wrap">
        {#if data.work.cover_id}
          <img
            src="/media/{data.work.cover_id}"
            alt="Capa de {data.work.title}"
            width="320"
            height="440"
            class="work-cover"
            class:blurred-cover={effectiveBlur}
          />
        {:else}
          <div class="work-cover-fallback">
            <span>PROJECT NOX</span>
            <strong>{data.work.title}</strong>
          </div>
        {/if}
        {#if isAdult}
          <span class="adult-badge-work">+18</span>
        {/if}
        {#if effectiveBlur}
          <div class="nsfw-overlay-work">
            <div class="nsfw-tag-work">
              <AlertTriangle size={14} />
              <span>CONTEÚDO ADULTO</span>
            </div>
          </div>
        {/if}
        <span class="cover-edition-seal">EDIÇÃO PROJECT NOX</span>
      </div>

      <!-- INFORMAÇÕES Card (Under Cover on Desktop) -->
      <div class="work-metadata-card sidebar-info desktop-only">
        <h3 class="metadata-heading">INFORMAÇÕES</h3>
        <div class="metadata-grid">
          <div class="meta-item">
            <span class="meta-label">Tipo</span>
            <span class="meta-value">{kindLabels[data.work.kind] || data.work.kind || 'Mangá'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Status</span>
            <span class="meta-value meta-status">{statusLabels[data.work.status] || data.work.status}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Capítulos</span>
            <span class="meta-value">{data.chapters.length}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Leitores</span>
            <span class="meta-value">{data.metrics?.readers ?? 0}</span>
          </div>
          {#if data.work.year}
            <div class="meta-item">
              <span class="meta-label">Lançamento</span>
              <span class="meta-value">{data.work.year}</span>
            </div>
          {/if}
          {#if isAdult}
            <div class="meta-item" class:full-width={!data.work.year} class:row-style={!data.work.year}>
              <span class="meta-label">Classificação</span>
              <span class="meta-value adult-meta-val">+18 Adulto</span>
            </div>
          {:else if data.work.age_rating}
            <div class="meta-item" class:full-width={!data.work.year} class:row-style={!data.work.year}>
              <span class="meta-label">Classificação</span>
              <span class="meta-value">{data.work.age_rating} anos</span>
            </div>
          {/if}
          {#if data.work.author}
            <div class="meta-item full-width row-style">
              <span class="meta-label">Autor</span>
              <span class="meta-value">{data.work.author}</span>
            </div>
          {/if}
          {#if data.work.artist}
            <div class="meta-item full-width row-style">
              <span class="meta-label">Arte</span>
              <span class="meta-value">{data.work.artist}</span>
            </div>
          {/if}
        </div>
      </div>
    </aside>

    <!-- RIGHT MAIN CONTENT: Badges + Title + Author/Artist + Tags + Sinopse + Actions + Chapters -->
    <main class="kuro-main">
      <div class="work-header-details">
        <div class="work-type-badges">
          <span class="badge-kind">{kindLabels[data.work.kind] || 'Mangá'}</span>
          <span class="badge-status">{statusLabels[data.work.status] || data.work.status}</span>
          {#if data.work.featured}
            <span class="badge-featured"><Sparkles size={12} /> Destaque</span>
          {/if}
          {#if isAdult}
            <span class="badge-adult">+18 Adulto</span>
          {/if}
        </div>

        <h1 class="work-title">{data.work.title}</h1>

        {#if data.work.aliases.length}
          <p class="aliases">{data.work.aliases.join(' · ')}</p>
        {/if}

        {#if data.work.author || data.work.artist}
          <div class="author-artist-line">
            {#if data.work.author}
              <span><strong>Autor:</strong> {data.work.author}</span>
            {/if}
            {#if data.work.author && data.work.artist}
              <span class="meta-dot">·</span>
            {/if}
            {#if data.work.artist}
              <span><strong>Arte:</strong> {data.work.artist}</span>
            {/if}
          </div>
        {/if}

        <!-- Tags Row -->
        <div class="chips-row">
          {#each data.tags as tag (tag?.id)}
            {#if tag}
              <a class="chip-glass" href="/catalogo?tag={tag.slug}">{tag.name}</a>
            {/if}
          {/each}
        </div>

        <!-- Sinopse (collapsible Ver mais / Ver menos) -->
        {#if data.work.synopsis || data.work.description}
          {@const fullText = data.work.synopsis || data.work.description || ''}
          {@const isLong = fullText.length > 280}
          <div class="synopsis-box">
            <h3 class="synopsis-heading">Sinopse</h3>
            <p class="synopsis-text" class:clamped={isLong && !synopsisExpanded}>
              {fullText}
            </p>
            {#if isLong}
              <button
                type="button"
                class="btn-toggle-synopsis"
                onclick={() => (synopsisExpanded = !synopsisExpanded)}
                aria-expanded={synopsisExpanded}
              >
                <span>{synopsisExpanded ? 'Ver menos' : 'Ver mais'}</span>
                {#if synopsisExpanded}
                  <ChevronUp size={14} />
                {:else}
                  <ChevronDown size={14} />
                {/if}
              </button>
            {/if}
          </div>
        {/if}

        <!-- INFORMAÇÕES Card (Mobile between Synopsis and Actions) -->
        <div class="work-metadata-card mobile-info mobile-only">
          <h3 class="metadata-heading">INFORMAÇÕES</h3>
          <div class="metadata-grid">
            <div class="meta-item">
              <span class="meta-label">Tipo</span>
              <span class="meta-value">{kindLabels[data.work.kind] || data.work.kind || 'Mangá'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Status</span>
              <span class="meta-value meta-status">{statusLabels[data.work.status] || data.work.status}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Capítulos</span>
              <span class="meta-value">{data.chapters.length}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Leitores</span>
              <span class="meta-value">{data.metrics?.readers ?? 0}</span>
            </div>
            {#if data.work.year}
              <div class="meta-item">
                <span class="meta-label">Lançamento</span>
                <span class="meta-value">{data.work.year}</span>
              </div>
            {/if}
            {#if isAdult}
              <div class="meta-item" class:full-width={!data.work.year} class:row-style={!data.work.year}>
                <span class="meta-label">Classificação</span>
                <span class="meta-value adult-meta-val">+18 Adulto</span>
              </div>
            {:else if data.work.age_rating}
              <div class="meta-item" class:full-width={!data.work.year} class:row-style={!data.work.year}>
                <span class="meta-label">Classificação</span>
                <span class="meta-value">{data.work.age_rating} anos</span>
              </div>
            {/if}
            {#if data.work.author}
              <div class="meta-item full-width row-style">
                <span class="meta-label">Autor</span>
                <span class="meta-value">{data.work.author}</span>
              </div>
            {/if}
            {#if data.work.artist}
              <div class="meta-item full-width row-style">
                <span class="meta-label">Arte</span>
                <span class="meta-value">{data.work.artist}</span>
              </div>
            {/if}
          </div>
        </div>

        <!-- Actions -->
        <div class="work-actions-block">
          <div class="actions-secondary-row">
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
              class="btn-glass-action btn-like"
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

            <select
              class="library-dropdown"
              aria-label="Organizar na biblioteca"
              value={data.library?.status || ''}
              onchange={(e) => library({ status: e.currentTarget.value })}
            >
              <option value="" disabled>Biblioteca…</option>
              <option value="READING">Lendo atualmente</option>
              <option value="PLANNED">Quero ler</option>
              <option value="COMPLETED">Concluído</option>
            </select>

            <button
              type="button"
              class="btn-glass-action btn-report"
              onclick={() => (showReportModal = true)}
              title="Reportar problema nesta obra"
            >
              <Flag size={18} />
              <span>Denunciar</span>
            </button>
          </div>

          {#if resume}
            <a class="btn-read-hero" href="/ler/{resume}">
              <BookOpen size={20} />
              <span>{data.progress.length ? 'Continuar Leitura' : 'Começar a Ler'}</span>
            </a>
          {/if}

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

      {#if notice}
        <div class="notice" role="status">{notice}</div>
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
            {@const isNew = chapter.published_at && (Date.now() - new Date(chapter.published_at).getTime()) < 7 * 24 * 60 * 60 * 1000}
            <a href="/ler/{chapter.id}" class="chapter-item" class:is-read={isRead}>
              <div class="chapter-left">
                <span class="chapter-num">Capítulo {chapter.number}</span>
                {#if isNew}
                  <span class="chapter-badge-new">NOVO</span>
                {/if}
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
    </main>
  </div>

  {#if showReportModal}
    <ReportModal
      targetType="WORK"
      workId={data.work.id}
      targetTitle={data.work.title}
      onclose={() => (showReportModal = false)}
      onsuccess={() => {
        showReportModal = false;
        notice = 'Denúncia enviada com sucesso para a moderação.';
      }}
    />
  {/if}
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

  .kuro-layout-grid {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 48px;
    align-items: start;
    margin-top: 16px;
  }

  .kuro-sidebar {
    display: flex;
    flex-direction: column;
    gap: 24px;
    position: sticky;
    top: 90px;
  }

  .kuro-main {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .work-cover-wrap {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(181, 154, 245, 0.12);
  }

  .work-cover {
    width: 100%;
    height: auto;
    aspect-ratio: 5 / 7;
    object-fit: cover;
    display: block;
    border: 1px solid rgba(181, 154, 245, 0.25);
    border-radius: 18px;
  }

  .adult-badge-work {
    position: absolute;
    top: 12px;
    right: 12px;
    background: rgba(239, 68, 68, 0.9);
    backdrop-filter: blur(4px);
    color: #fff;
    font-size: 11px;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    z-index: 2;
  }

  .nsfw-overlay-work {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.45);
    z-index: 2;
  }

  .nsfw-tag-work {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(239, 68, 68, 0.9);
    backdrop-filter: blur(6px);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
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
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    color: #dfc28d;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    padding: 2px 10px;
    border-radius: 999px;
    white-space: nowrap;
    border: 1px solid rgba(223, 194, 141, 0.3);
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

  .badge-adult {
    font-size: 11px;
    font-weight: 700;
    color: #fca5a5;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.35);
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
    margin: 0 0 14px;
  }

  .author-artist-line {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #c2bed4;
    margin-bottom: 14px;
  }

  .author-artist-line strong {
    color: #ffffff;
  }

  .meta-dot {
    color: #635f73;
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

  /* Synopsis Box (Collapsible) */
  .synopsis-box {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    padding: 16px 20px;
    margin-bottom: 24px;
  }

  .synopsis-heading {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #b59af5;
    margin: 0 0 8px;
  }

  .synopsis-text {
    font-size: 14px;
    line-height: 1.65;
    color: #b3afc2;
    margin: 0;
    white-space: pre-line;
  }

  .synopsis-text.clamped {
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .btn-toggle-synopsis {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    padding: 0;
    background: none;
    border: none;
    color: #b59af5;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-toggle-synopsis:hover {
    text-decoration: underline;
  }


  /* Work Actions Block */
  .work-actions-block {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 24px;
  }

  .btn-read-hero {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px 36px;
    border-radius: 14px;
    font-size: 16px;
    font-weight: 750;
    color: #ffffff;
    background: linear-gradient(135deg, #8b5cf6, #6d28d9);
    box-shadow: 0 8px 32px rgba(109, 40, 217, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.2);
    text-decoration: none;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    width: fit-content;
  }

  .btn-read-hero:hover {
    transform: translateY(-2px);
    background: linear-gradient(135deg, #9333ea, #7c3aed);
    box-shadow: 0 12px 40px rgba(139, 92, 246, 0.65), inset 0 1px 1px rgba(255, 255, 255, 0.4);
  }

  .actions-secondary-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .btn-glass-action {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 18px;
    border-radius: 12px;
    font-size: 13.5px;
    font-weight: 600;
    color: #d1cde0;
    background: rgba(18, 22, 36, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(14px);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-glass-action:hover {
    background: rgba(28, 33, 54, 0.8);
    color: #ffffff;
    border-color: rgba(181, 154, 245, 0.3);
  }

  .btn-glass-action.is-active {
    color: #b59af5;
    border-color: rgba(181, 154, 245, 0.5);
    background: rgba(181, 154, 245, 0.12);
  }

  .btn-like.is-active {
    color: #ff4d6d;
    border-color: rgba(255, 77, 109, 0.4);
    background: rgba(255, 77, 109, 0.12);
  }

  .library-dropdown {
    padding: 11px 16px;
    border-radius: 12px;
    background: rgba(13, 16, 26, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #d1cde0;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    outline: none;
  }

  .library-dropdown:focus {
    border-color: #b59af5;
  }

  .notification-check {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #8c899a;
    cursor: pointer;
  }

  .desktop-only {
    display: block;
  }

  .mobile-only {
    display: none;
  }

  /* Metadata Card (INFORMAÇÕES) */
  .work-metadata-card {
    padding: 18px 22px;
    border-radius: 14px;
    background: rgba(13, 16, 26, 0.6);
    border: 1px solid rgba(181, 154, 245, 0.16);
    backdrop-filter: blur(16px);
    box-shadow: 0 10px 28px -6px rgba(0, 0, 0, 0.5);
  }

  .sidebar-info {
    width: 100%;
    max-width: none;
    margin-bottom: 0;
  }

  .mobile-info {
    width: 100%;
    max-width: 620px;
    margin: 0 0 24px;
  }

  .adult-meta-val {
    color: #f87171 !important;
    font-weight: 700 !important;
  }

  .metadata-heading {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.16em;
    color: #dfc28d;
    margin: 0 0 14px;
    text-transform: uppercase;
  }

  .metadata-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    align-items: stretch;
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    min-width: 0;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 10px;
  }

  .meta-item.full-width {
    grid-column: 1 / -1;
  }

  .meta-item.row-style {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .meta-label {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #8c899e;
  }

  .meta-value {
    font-size: 13.5px;
    font-weight: 700;
    color: #f2f0f7;
    word-break: break-word;
    overflow-wrap: break-word;
    white-space: normal;
    line-height: 1.35;
  }

  .meta-status {
    color: #dfc28d;
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

  .chapter-badge-new {
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: #dfc28d;
    background: rgba(201, 170, 115, 0.15);
    border: 1px solid rgba(201, 170, 115, 0.35);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .empty-chapters {
    padding: 32px;
    text-align: center;
    color: #7b788a;
  }

  @media (max-width: 860px) {
    .desktop-only {
      display: none !important;
    }

    .mobile-only {
      display: block !important;
    }

    .kuro-layout-grid {
      display: flex;
      flex-direction: column;
      gap: 28px;
    }

    .kuro-sidebar {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: static;
      gap: 0;
    }

    .work-cover-wrap {
      max-width: 240px;
      margin: 0 auto;
    }

    .kuro-main {
      width: 100%;
    }

    .work-header-details {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .author-artist-line {
      justify-content: center;
    }

    .chips-row {
      justify-content: center;
    }

    .work-actions-block {
      align-items: center;
    }

    .actions-secondary-row {
      justify-content: center;
    }

    .chapter-item {
      padding: 14px 18px;
    }
  }

  @media (max-width: 680px) {
    .kuro-layout-grid {
      gap: 20px;
    }

    .work-cover-wrap {
      max-width: 170px;
    }

    .work-title {
      font-size: 25px;
      line-height: 1.15;
    }

    .work-type-badges {
      justify-content: center;
      margin-bottom: 8px;
    }

    .chips-row {
      justify-content: center;
      margin-bottom: 16px;
    }

    .work-actions-block {
      width: 100%;
      margin-bottom: 24px;
      gap: 12px;
    }

    .actions-secondary-row {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .btn-glass-action {
      width: 100%;
      justify-content: center;
      padding: 12px 14px;
      font-size: 13px;
    }

    .library-dropdown {
      width: 100%;
      text-align: center;
      padding: 12px 14px;
      font-size: 13px;
    }

    .btn-read-hero {
      width: 100%;
      padding: 16px 20px;
      font-size: 16px;
      font-weight: 800;
      justify-content: center;
      margin-top: 4px;
      box-shadow: 0 8px 30px -4px rgba(139, 92, 246, 0.55);
    }

    .sidebar-info {
      width: 100%;
      padding: 16px;
      margin-bottom: 20px;
    }

    .sidebar-info .metadata-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .chapter-left {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
  }
</style>
