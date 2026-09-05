<script lang="ts">
  import { BookOpen, Heart, Bookmark, ArrowDown, ArrowUp } from '@lucide/svelte';
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
    try {
      await action('member', 'like', { work_id: data.work.id });
      await invalidateAll();
    } catch (e) {
      notice = (e as Error).message;
    }
  }
</script>

<svelte:head
  ><title>{data.work.title} — Ler na Project Nox</title><meta
    name="description"
    content={data.work.synopsis.slice(0, 160)}
  /><meta property="og:title" content={data.work.title} /><meta
    property="og:description"
    content={data.work.synopsis.slice(0, 200)}
  />{#if data.work.cover_id}<meta property="og:image" content={data.coverUrl || ''} />{/if}<link
    rel="canonical"
    href={data.canonical}
  /><meta property="og:url" content={data.canonical} /><meta property="og:type" content="book" /></svelte:head
>
<div class="container spacer-bottom">
  <div class="page-top">
    <div class="breadcrumb"><a href="/catalogo">Catálogo</a><span>/</span><span>{data.work.title}</span></div>
  </div>
  <section class="work-hero">
    <div class="work-cover">
      <img src="/media/{data.work.cover_id}" alt="Capa de {data.work.title}" width="300" height="420" /><span
        class="cover-credit">EDIÇÃO PROJECT NOX</span
      >
    </div>
    <div>
      <div class="eyebrow">{kindLabels[data.work.kind]} <span></span> {statusLabels[data.work.status]}</div>
      <h1>{data.work.title}</h1>
      {#if data.work.aliases.length}<p class="aliases">{data.work.aliases.join(' · ')}</p>{/if}
      <div class="chips">
        {#each data.tags as tag (tag?.id)}{#if tag}<a class="chip" href="/catalogo?tag={tag.slug}"
              >{tag.name}</a
            >{/if}{/each}
      </div>
      <p class="synopsis">{data.work.synopsis}</p>
      <div class="work-meta">
        {#if data.metrics}
          <span>Favoritos <strong>{data.metrics.favorites}</strong></span>
          <span>Leitores <strong>{data.metrics.readers}</strong></span>
        {/if}
        {#if data.work.author}<span>Autor <strong>{data.work.author}</strong></span
          >{/if}{#if data.work.artist}<span>Arte <strong>{data.work.artist}</strong></span>{/if}<span
          >Capítulos <strong>{data.chapters.length}</strong></span
        >{#if data.work.year}<span>Ano <strong>{data.work.year}</strong></span>{/if}<span
          >Classificação <strong
            >{data.work.age_rating === 0 ? 'Livre' : `${data.work.age_rating} anos`}</strong
          ></span
        >
      </div>
      <div class="row work-actions">
        {#if resume}<a class="button" href="/ler/{resume}"
            ><BookOpen size={18} />{data.progress.length ? 'Continuar leitura' : 'Começar a ler'}</a
          >{/if}<button
          class="button secondary"
          onclick={() => library({ favorite: !data.library?.favorite })}
          disabled={busy}
          ><Bookmark size={18} fill={data.library?.favorite ? 'currentColor' : 'none'} />{data.library
            ?.favorite
            ? 'Favoritado'
            : 'Favoritar'}</button
        ><button class="button secondary" onclick={like}
          ><Heart
            size={18}
            fill={data.likes.some((l) => l.user_id === data.profile?.id) ? 'currentColor' : 'none'}
          />{data.likes.length}</button
        >
      </div>
      <div class="row" style="margin-top:16px">
        <select
          class="control"
          style="width:auto;font-size:12px"
          aria-label="Organizar na biblioteca"
          value={data.library?.status || ''}
          onchange={(e) => library({ status: e.currentTarget.value })}
          ><option value="" disabled>Adicionar à biblioteca</option><option value="READING">Lendo</option
          ><option value="PLANNED">Quero ler</option><option value="COMPLETED">Concluído</option></select
        >{#if data.library}<label class="small"
            ><input
              type="checkbox"
              checked={data.library.following}
              onchange={(e) => library({ following: e.currentTarget.checked })}
            /> Avisar sobre novos capítulos</label
          >{/if}
      </div>
    </div>
  </section>
  {#if notice}<div class="notice" role="status">{notice}</div>{/if}
  {#if data.work.description}<section class="panel" style="margin:32px 0">
      <h2 style="font-size:21px">Sobre esta história</h2>
      <p style="white-space:pre-wrap">{data.work.description}</p>
    </section>{/if}
  <section class="chapters-section">
    <div class="section-heading">
      <div>
        <span class="eyebrow">ENTRE NA HISTÓRIA</span>
        <h2>Capítulos</h2>
      </div>
      <span class="small muted">Atualizado em {date(data.work.updated_at)}</span>
    </div>
    <div class="filters">
      <input
        class="search-input"
        bind:value={search}
        placeholder="Buscar capítulo…"
        aria-label="Buscar capítulo"
      /><button class="button secondary" onclick={() => (ascending = !ascending)}
        >{#if ascending}<ArrowUp size={17} />{:else}<ArrowDown size={17} />{/if}{ascending
          ? 'Mais antigos'
          : 'Mais recentes'}</button
      >
    </div>
    <div class="chapter-list">
      {#each chapters as chapter (chapter.id)}<a href="/ler/{chapter.id}"
          ><div>
            <strong>Capítulo {chapter.number}</strong>{#if chapter.title}<span>{chapter.title}</span>{/if}
          </div>
          <div>
            {#if data.progress.some((p) => p.chapter_id === chapter.id && p.completed_at)}<span
                class="read-label">Lido ✓</span
              >{/if}<time>{date(chapter.published_at!)}</time><BookOpen size={17} />
          </div></a
        >{/each}{#if !chapters.length}<p>Nenhum capítulo encontrado.</p>{/if}
    </div>
  </section>
  <Comments comments={data.comments} workId={data.work.id} profile={data.profile} />
</div>

<style>
  .work-hero {
    display: grid;
    grid-template-columns: 270px 1fr;
    gap: 48px;
    align-items: start;
  }
  .work-cover img {
    width: 100%;
    aspect-ratio: 5/7;
    object-fit: cover;
    border-radius: 14px;
    border: 1px solid #ffffff16;
  }
  .cover-credit {
    font-size: 9px;
    letter-spacing: 0.2em;
    color: var(--gold);
    display: block;
    text-align: center;
    margin-top: 18px;
  }
  .work-hero h1 {
    margin: 17px 0;
    font-size: 44px;
  }
  .aliases {
    font-size: 12px;
    margin-top: -5px;
    margin-bottom: 22px;
  }
  .synopsis {
    font-size: 14px;
    white-space: pre-wrap;
    line-height: 1.9;
  }
  .work-meta {
    display: flex;
    gap: 28px;
    flex-wrap: wrap;
    margin: 28px 0;
    font-size: 10px;
    color: var(--muted);
  }
  .work-meta strong {
    display: block;
    font-size: 13px;
    color: #ddd4e8;
    margin-top: 8px;
  }
  .work-actions {
    margin-top: 25px;
  }
  .chapters-section {
    margin-top: 60px;
  }
  .chapter-list {
    border: 1px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
  }
  .chapter-list > a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    background: #121117;
    border-bottom: 1px solid var(--line);
    font-size: 13px;
    gap: 20px;
  }
  .chapter-list > a:last-child {
    border: 0;
  }
  .chapter-list > a:hover {
    background: #1d1727;
  }
  .chapter-list > a > div {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .chapter-list time,
  .chapter-list span {
    font-size: 11px;
    color: var(--muted);
  }
  .chapter-list .read-label {
    color: var(--purple);
  }
  .chapter-list > p {
    padding: 20px;
  }
  .chapter-list :global(svg) {
    color: var(--purple);
  }
  @media (max-width: 760px) {
    .work-hero {
      grid-template-columns: 1fr;
      gap: 30px;
    }
    .work-cover {
      width: 190px;
      margin: auto;
    }
    .work-hero h1 {
      font-size: 35px;
    }
    .work-hero .eyebrow {
      justify-content: center;
    }
    .work-hero h1,
    .aliases {
      text-align: center;
    }
    .work-meta {
      gap: 25px;
    }
    .work-actions .button {
      font-size: 12px;
      padding: 13px;
    }
    .chapter-list > a {
      padding: 18px 15px;
    }
    .chapter-list > a > div {
      gap: 9px;
    }
    .chapter-list time {
      font-size: 9px;
    }
    .chapter-list > a > div:first-child {
      flex-direction: column;
      align-items: start;
    }
  }
</style>
