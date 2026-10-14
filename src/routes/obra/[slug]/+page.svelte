<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
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
    Flag,
    Eye,
    Users,
    Download,
    Loader2
  } from '@lucide/svelte';
  import { invalidateAll } from '$app/navigation';
  import { goto } from '$app/navigation';
  import { action } from '$lib/actions';
  import { kindLabels, statusLabels, date } from '$lib/types';
  import { resolveCoverUrl } from '$lib/covers';
  import { decodeHtmlEntities } from '$lib/html-entities';
  import { chapterDisplayNumber, chapterIdentityLabel } from '$lib/chapter-identity';
  import Comments from '$lib/components/Comments.svelte';
  import ReportModal from '$lib/components/ReportModal.svelte';
  import {
    getOfflineChapters,
    saveChapterOffline,
    removeOfflineChapter,
    isOfflineSupported
  } from '$lib/offline-storage';

  let { data } = $props();
  let decodedTitle = $derived(decodeHtmlEntities(data.work.title));
  let decodedSynopsis = $derived(decodeHtmlEntities(data.work.synopsis || data.work.description));
  let obraCover = $derived(resolveCoverUrl(data.work.cover_id, data.work.slug, data.work.id));
  let notice = $state(''),
    busy = $state(false),
    ascending = $state(false),
    search = $state(''),
    synopsisExpanded = $state(false),
    aliasesExpanded = $state(false),
    tagsExpanded = $state(false),
    showReportModal = $state(false);

  let downloadedChapterIds = new SvelteSet<string>();
  let downloadingChapterIds = $state<Record<string, number>>({});
  let batchDownloading = $state(false);
  let batchProgress = $state({ current: 0, total: 0 });

  // Reader identity keeps language and edition, but the public PT-BR list must
  // not repeat the site's default language on every row. Keep non-default
  // qualifiers visible so distinct editions/locales remain unambiguous.
  function chapterPresentationLabel(chapter: any): string {
    const qualifiers = [chapter.edition, chapter.language]
      .map((value) => String(value ?? '').trim())
      .filter((value) => !['', 'default', 'und', 'pt-br'].includes(value.toLocaleLowerCase('pt-BR')));
    const number = chapterDisplayNumber(chapter);
    return qualifiers.length ? `${number} · ${qualifiers.join(' · ')}` : number;
  }

  onMount(async () => {
    if (isOfflineSupported()) {
      try {
        const offlineList = await getOfflineChapters();
        const currentWorkOffline = offlineList.filter((oc) => oc.workId === data.work.id);
        downloadedChapterIds.clear();
        for (const chapter of currentWorkOffline) downloadedChapterIds.add(chapter.chapterId);
      } catch (err) {
        console.error('Falha ao carregar capítulos offline:', err);
      }
    }
  });

  async function handleToggleDownload(chapter: any, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (downloadingChapterIds[chapter.id] !== undefined) return;

    if (downloadedChapterIds.has(chapter.id)) {
      if (confirm(`Remover capítulo ${chapterIdentityLabel(chapter)} do armazenamento offline?`)) {
        await removeOfflineChapter(chapter.id);
        downloadedChapterIds.delete(chapter.id);
        notice = `Capítulo ${chapterIdentityLabel(chapter)} removido do armazenamento offline.`;
      }
      return;
    }

    try {
      downloadingChapterIds = { ...downloadingChapterIds, [chapter.id]: 0 };
      const res = await fetch(`/api/chapters/${chapter.id}/pages`);
      if (!res.ok) throw new Error('Não foi possível obter páginas do capítulo');
      const payload = await res.json();
      if (!payload.pages || !payload.pages.length) throw new Error('Capítulo não contém páginas');

      await saveChapterOffline(
        { id: chapter.id, work_id: data.work.id, number: chapterIdentityLabel(chapter), title: chapter.title },
        { title: data.work.title, slug: data.work.slug, cover_id: data.work.cover_id },
        payload.pages,
        (loaded, total) => {
          const pct = Math.round((loaded / total) * 100);
          downloadingChapterIds = { ...downloadingChapterIds, [chapter.id]: pct };
        }
      );

      downloadedChapterIds.add(chapter.id);
      notice = `Capítulo ${chapterIdentityLabel(chapter)} salvo com sucesso para leitura offline!`;
    } catch (err: any) {
      notice = `Erro ao baixar capítulo ${chapterIdentityLabel(chapter)}: ${err.message}`;
    } finally {
      const copy = { ...downloadingChapterIds };
      delete copy[chapter.id];
      downloadingChapterIds = copy;
    }
  }

  async function handleBatchDownload() {
    if (batchDownloading || !data.chapters.length) return;
    const toDownload = data.chapters.filter((c) => !downloadedChapterIds.has(c.id));
    if (!toDownload.length) {
      notice = 'Todos os capítulos já estão disponíveis offline!';
      return;
    }

    batchDownloading = true;
    batchProgress = { current: 0, total: toDownload.length };

    try {
      for (let i = 0; i < toDownload.length; i++) {
        const chapter = toDownload[i];
        batchProgress = { current: i + 1, total: toDownload.length };
        downloadingChapterIds = { ...downloadingChapterIds, [chapter.id]: 0 };

        try {
          const res = await fetch(`/api/chapters/${chapter.id}/pages`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const payload = await res.json();
          if (payload.pages && payload.pages.length) {
            await saveChapterOffline(
              { id: chapter.id, work_id: data.work.id, number: chapterIdentityLabel(chapter), title: chapter.title },
              { title: data.work.title, slug: data.work.slug, cover_id: data.work.cover_id },
              payload.pages,
              (loaded, total) => {
                const pct = Math.round((loaded / total) * 100);
                downloadingChapterIds = { ...downloadingChapterIds, [chapter.id]: pct };
              }
            );
            downloadedChapterIds.add(chapter.id);
          }
        } catch (e: any) {
          console.error(`Erro ao baixar capítulo ${chapterIdentityLabel(chapter)}:`, e);
        } finally {
          const copy = { ...downloadingChapterIds };
          delete copy[chapter.id];
          downloadingChapterIds = copy;
        }
      }
      notice = 'Download dos capítulos concluído!';
    } catch (err: any) {
      notice = `Erro no download em lote: ${err.message}`;
    } finally {
      batchDownloading = false;
    }
  }

  function formatViews(n: number = 0) {
    return new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short' }).format(n);
  }

  let isAdult = $derived(data.work.content_rating === 'ADULT_18');
  let alternativeTitles = $derived.by(() => {
    const primary = decodeHtmlEntities(data.work.title || '')
      .normalize('NFKC')
      .replace(/\s+/g, ' ')
      .trim()
      .toLocaleLowerCase('pt-BR');
    const seen = new SvelteSet<string>();

    return (data.work.aliases || []).filter((alias: string) => {
      const key = decodeHtmlEntities(alias || '')
        .normalize('NFKC')
        .replace(/\s+/g, ' ')
        .trim()
        .toLocaleLowerCase('pt-BR');
      if (!key || key === primary || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
  let visibleAliases = $derived(aliasesExpanded ? alternativeTitles : alternativeTitles.slice(0, 3));
  let visibleTags = $derived(tagsExpanded ? data.tags.filter(Boolean) : data.tags.filter(Boolean).slice(0, 8));
  // Unblur automatically when visiting the individual work page per UX requirements
  let effectiveBlur = false;

  let chapters = $derived(
    (ascending ? [...data.chapters].reverse() : data.chapters).filter((c) => {
      const term = search.trim().toLowerCase();
      if (!term) return true;
      const matchNum = chapterIdentityLabel(c).toLowerCase().includes(term);
      const matchTitle = (c.title || '').toLowerCase().includes(term);
      return matchNum || matchTitle;
    })
  );

  let visibleLimit = $state(150);
  let visibleChapters = $derived(
    search.trim() ? chapters : chapters.slice(0, visibleLimit)
  );

  let readChapterIds = $derived(
    new Set((data.progress || []).filter((p: any) => p?.completed_at).map((p: any) => p?.chapter_id))
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
  <title>{decodedTitle} — Ler na Project Nox</title>
  <meta name="description" content={decodedSynopsis.slice(0, 160)} />
  <meta property="og:title" content={decodedTitle} />
  <meta property="og:description" content={decodedSynopsis.slice(0, 200)} />
  <meta property="og:image" content={data.metaImage} />
  <meta property="og:image:alt" content="Capa de {decodedTitle}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content={data.metaImage} />
  <meta name="twitter:title" content="{decodedTitle} — Ler na Project Nox" />
  <meta name="twitter:description" content={decodedSynopsis.slice(0, 200)} />
  <link rel="canonical" href={data.canonical} />
  <meta property="og:url" content={data.canonical} />
  <meta property="og:type" content="book" />
  <meta property="og:site_name" content="Project Nox" />
  <meta property="og:locale" content="pt_BR" />
  <!-- Only the server-generated, HTML-escaped JSON-LD envelope is allowed here. -->
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html data.structuredData}
</svelte:head>

<div class="work-redesign-backdrop" aria-hidden="true">
  <img src={obraCover} alt="" />
</div>

<main class="container work-redesign spacer-bottom">
  <nav class="work-breadcrumb" aria-label="Navegação estrutural">
    <a href="/catalogo">Catálogo</a>
    <span aria-hidden="true">/</span>
    <span>{decodedTitle}</span>
  </nav>

  <section class="work-hero" aria-labelledby="work-title">
    <div class="work-cover-frame">
      <img
        src={obraCover}
        alt="Capa de {decodedTitle}"
        width="320"
        height="448"
        class="work-cover-image"
        class:blurred-cover={effectiveBlur}
      />
      {#if isAdult}<span class="work-adult-badge">+18</span>{/if}
    </div>

    <div class="work-hero-copy">
      <div class="work-statuses" aria-label="Classificações da obra">
        <span class="work-kind">{kindLabels[data.work.kind] || data.work.kind || 'Mangá'}</span>
        <span class="work-status">{statusLabels[data.work.status] || data.work.status}</span>
        {#if data.work.featured}<span class="work-featured"><Sparkles size={13} /> Destaque</span>{/if}
        {#if isAdult}<span class="work-rating">+18</span>{/if}
      </div>

      <h1 id="work-title">{decodedTitle}</h1>

      {#if data.work.author || data.work.artist}
        <dl class="creator-list">
          {#if data.work.author}
            <div><dt>Autor</dt><dd>{data.work.author}</dd></div>
          {/if}
          {#if data.work.artist}
            <div><dt>Artista</dt><dd>{data.work.artist}</dd></div>
          {/if}
        </dl>
      {/if}

      <dl class="work-quick-stats" aria-label="Resumo da obra">
        <div><dt>Capítulos</dt><dd>{data.chapters.length}</dd></div>
        <div><dt>Leitores</dt><dd>{formatViews(data.metrics?.readers ?? 0)}</dd></div>
        {#if data.work.year}<div><dt>Ano</dt><dd>{data.work.year}</dd></div>{/if}
        {#if isAdult}<div><dt>Classificação</dt><dd>Adulto</dd></div>{:else if data.work.age_rating}<div><dt>Classificação</dt><dd>{data.work.age_rating} anos</dd></div>{/if}
      </dl>

      <div class="work-primary-actions">
        {#if resume}
          <a class="read-work-button" href="/ler/{resume}">
            <BookOpen size={19} />
            {data.progress.length ? 'Continuar leitura' : 'Começar a ler'}
          </a>
        {/if}
        <button
          type="button"
          class="work-action"
          class:is-active={data.library?.favorite}
          onclick={() => library({ favorite: !data.library?.favorite })}
          disabled={busy}
        >
          <Bookmark size={17} fill={data.library?.favorite ? 'currentColor' : 'none'} />
          {data.library?.favorite ? 'Favoritado' : 'Favoritar'}
        </button>
        <button
          type="button"
          class="work-action icon-action"
          class:is-active={data.likes.some((like: any) => like.user_id === data.profile?.id)}
          onclick={like}
          disabled={busy}
          aria-label={data.likes.some((like: any) => like.user_id === data.profile?.id) ? 'Remover curtida' : 'Curtir obra'}
        >
          <Heart size={17} fill={data.likes.some((like: any) => like.user_id === data.profile?.id) ? 'currentColor' : 'none'} />
          <span>{data.likes.length}</span>
        </button>
      </div>

      <div class="work-secondary-actions">
        <select
          class="work-library-select"
          aria-label="Organizar na biblioteca"
          value={data.library?.status || ''}
          onchange={(event) => library({ status: event.currentTarget.value })}
        >
          <option value="" disabled>Adicionar à biblioteca…</option>
          <option value="READING">Lendo atualmente</option>
          <option value="PLANNED">Quero ler</option>
          <option value="COMPLETED">Concluído</option>
        </select>
        <button type="button" class="text-action" onclick={() => (showReportModal = true)}>
          <Flag size={15} /> Reportar
        </button>
        {#if data.library}
          <label class="notify-toggle">
            <input
              type="checkbox"
              checked={data.library.following}
              onchange={(event) => library({ following: event.currentTarget.checked })}
            />
            Avisar novos capítulos
          </label>
        {/if}
      </div>
    </div>
  </section>

  {#if notice}<div class="work-notice" role="status">{notice}</div>{/if}

  <div class="work-information-layout">
    <div class="work-reading-column">
      {#if alternativeTitles.length}
        <section class="work-panel aliases-panel" aria-labelledby="alternative-titles-heading">
          <div class="section-heading-row">
            <div>
              <p class="eyebrow">Identidade</p>
              <h2 id="alternative-titles-heading">Títulos alternativos</h2>
            </div>
            <span class="section-count">{alternativeTitles.length}</span>
          </div>
          <ul class="alias-list">
            {#each visibleAliases as alias (alias)}
              <li>{decodeHtmlEntities(alias)}</li>
            {/each}
          </ul>
          {#if alternativeTitles.length > 3}
            <button type="button" class="expand-text" onclick={() => (aliasesExpanded = !aliasesExpanded)} aria-expanded={aliasesExpanded}>
              {aliasesExpanded ? 'Ver menos' : `Ver todos (${alternativeTitles.length})`}
              {#if aliasesExpanded}<ChevronUp size={15} />{:else}<ChevronDown size={15} />{/if}
            </button>
          {/if}
        </section>
      {/if}

      {#if visibleTags.length}
        <section class="work-panel tags-panel" aria-labelledby="work-tags-heading">
          <div class="section-heading-row">
            <div>
              <p class="eyebrow">Classificação</p>
              <h2 id="work-tags-heading">Gêneros e tags</h2>
            </div>
            <span class="section-count">{data.tags.filter(Boolean).length}</span>
          </div>
          <div class="work-tag-list">
            {#each visibleTags as tag (tag.id)}
              <a href="/catalogo?tag={tag.slug}">{tag.name}</a>
            {/each}
          </div>
          {#if data.tags.filter(Boolean).length > 8}
            <button type="button" class="expand-text" onclick={() => (tagsExpanded = !tagsExpanded)} aria-expanded={tagsExpanded}>
              {tagsExpanded ? 'Ver menos' : 'Ver todas as tags'}
              {#if tagsExpanded}<ChevronUp size={15} />{:else}<ChevronDown size={15} />{/if}
            </button>
          {/if}
        </section>
      {/if}

      {#if decodedSynopsis}
        {@const synopsisIsLong = decodedSynopsis.length > 420}
        <section class="work-panel synopsis-panel" aria-labelledby="synopsis-heading">
          <p class="eyebrow">Sobre a obra</p>
          <h2 id="synopsis-heading">Sinopse</h2>
          <p class:clamped-synopsis={synopsisIsLong && !synopsisExpanded}>{decodedSynopsis}</p>
          {#if synopsisIsLong}
            <button type="button" class="expand-text" onclick={() => (synopsisExpanded = !synopsisExpanded)} aria-expanded={synopsisExpanded}>
              {synopsisExpanded ? 'Ver menos' : 'Ler sinopse completa'}
              {#if synopsisExpanded}<ChevronUp size={15} />{:else}<ChevronDown size={15} />{/if}
            </button>
          {/if}
        </section>
      {/if}
    </div>

    <aside class="work-panel work-facts" aria-label="Informações da obra">
      <p class="eyebrow">Ficha técnica</p>
      <h2>Informações</h2>
      <dl>
        <div><dt>Tipo</dt><dd>{kindLabels[data.work.kind] || data.work.kind || 'Mangá'}</dd></div>
        <div><dt>Status</dt><dd>{statusLabels[data.work.status] || data.work.status}</dd></div>
        {#if data.work.year}<div><dt>Lançamento</dt><dd>{data.work.year}</dd></div>{/if}
        {#if data.work.author}<div><dt>Autor</dt><dd>{data.work.author}</dd></div>{/if}
        {#if data.work.artist}<div><dt>Artista</dt><dd>{data.work.artist}</dd></div>{/if}
        {#if data.scans?.length}
          <div class="fact-scans">
            <dt>{data.scans.length > 1 ? 'Scans parceiras' : 'Scan parceira'}</dt>
            <dd>
              {#each data.scans as scan, index (scan.id || scan.slug || index)}
                <a href="/scans/{scan.slug}">{scan.name}</a>{#if index < data.scans.length - 1}<span> · </span>{/if}
              {/each}
            </dd>
          </div>
        {/if}
      </dl>
    </aside>
  </div>

  <section class="work-chapters" aria-labelledby="chapters-heading">
    <div class="chapters-title-row">
      <div>
        <p class="eyebrow">Leitura</p>
        <h2 id="chapters-heading">Capítulos</h2>
        <p>{chapters.length} disponíveis · Atualizado em {date(data.work.updated_at)}</p>
      </div>
      {#if resume}
        <a class="chapters-read-link" href="/ler/{resume}"><BookOpen size={17} /> {data.progress.length ? 'Continuar' : 'Ler agora'}</a>
      {/if}
    </div>

    <div class="chapters-controls">
      <input bind:value={search} placeholder="Buscar capítulo ou título" aria-label="Buscar capítulo" />
      <button type="button" class="chapter-control" onclick={() => (ascending = !ascending)}>
        {#if ascending}<ArrowUp size={16} /> Mais antigos{:else}<ArrowDown size={16} /> Mais recentes{/if}
      </button>
      <button
        type="button"
        class="chapter-control download-all"
        class:is-busy={batchDownloading}
        onclick={handleBatchDownload}
        disabled={batchDownloading || !data.chapters.length}
      >
        {#if batchDownloading}<Loader2 size={16} class="spin" /> Baixando {batchProgress.current}/{batchProgress.total}{:else}<Download size={16} /> Offline{/if}
      </button>
    </div>

    <div class="chapter-list" aria-live="polite">
      {#each visibleChapters as chapter (chapter.id)}
        {@const isRead = readChapterIds.has(chapter.id)}
        {@const isNew = chapter.published_at && Date.now() - new Date(chapter.published_at).getTime() < 7 * 24 * 60 * 60 * 1000}
        {@const isDownloaded = downloadedChapterIds.has(chapter.id)}
        {@const downloadProgress = downloadingChapterIds[chapter.id]}
        <div class="chapter-row" class:is-read={isRead}>
          <a href="/ler/{chapter.id}" class="chapter-main-link">
            <span class="chapter-index">{chapterPresentationLabel(chapter)}</span>
            <span class="chapter-copy">
              <span class="chapter-name">Capítulo {chapterPresentationLabel(chapter)}</span>
              {#if chapter.title && chapter.title.trim() && chapter.title.trim().toLocaleLowerCase('pt-BR') !== `capítulo ${chapterPresentationLabel(chapter)}`.toLocaleLowerCase('pt-BR')}
                <span class="chapter-subtitle">{chapter.title}</span>
              {/if}
            </span>
          </a>
          <span class="chapter-details">
            {#if isNew}<span class="new-chapter">Novo</span>{/if}
            {#if isRead}<span class="chapter-read"><CheckCircle2 size={14} /> Lido</span>{/if}
            {#if chapter.published_at}<time>{date(chapter.published_at)}</time>{/if}
            <button
              type="button"
              class="chapter-download"
              class:is-downloaded={isDownloaded}
              onclick={(event) => handleToggleDownload(chapter, event)}
              title={isDownloaded ? 'Remover do offline' : 'Baixar para leitura offline'}
            >
              {#if downloadProgress !== undefined}<Loader2 size={15} class="spin" /><span>{downloadProgress}%</span>{:else if isDownloaded}<CheckCircle2 size={15} /><span>Offline</span>{:else}<Download size={15} /><span>Offline</span>{/if}
            </button>
            <a href="/ler/{chapter.id}" class="chapter-open-link" aria-label="Ler capítulo {chapterPresentationLabel(chapter)}"><BookOpen size={17} class="chapter-open" /></a>
          </span>
        </div>
      {/each}

      {#if !search.trim() && chapters.length > visibleLimit}
        <div class="chapter-more-actions">
          <button type="button" onclick={() => (visibleLimit += 150)}>Carregar mais ({chapters.length - visibleLimit})</button>
          <button type="button" class="secondary" onclick={() => (visibleLimit = chapters.length)}>Mostrar todos</button>
        </div>
      {/if}
      {#if !chapters.length}
        <div class="chapter-empty">{search ? `Nenhum capítulo encontrado para “${search}”.` : 'Nenhum capítulo disponível no momento.'}</div>
      {/if}
    </div>
  </section>

  <Comments comments={data.comments} workId={data.work.id} profile={data.profile} />

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
</main>

{#if false}
<!-- Cinematic Backdrop Banner -->
<div class="work-backdrop" aria-hidden="true">
  <img src={obraCover} alt="" class="backdrop-img" />
  <div class="backdrop-mask"></div>
</div>

<div class="container work-page-container spacer-bottom">
  <div class="page-top">
    <nav class="breadcrumb" aria-label="Navegação estrutural">
      <a href="/catalogo">Catálogo</a>
      <span>/</span>
      <span class="active-crumb">{decodedTitle}</span>
    </nav>
  </div>

  <div class="kuro-layout-grid">
    <!-- LEFT SIDEBAR: Cover + INFORMAÇÕES (Under Cover on Desktop) -->
    <aside class="kuro-sidebar">
      <div class="work-cover-wrap">
        <img
          src={obraCover}
          alt="Capa de {decodedTitle}"
          width="320"
          height="440"
          class="work-cover"
          class:blurred-cover={effectiveBlur}
        />
        {#if isAdult}
          <span class="adult-badge-work">+18</span>
        {/if}
        {#if data.scans && data.scans.length > 0}
          <div class="cover-scan-seal">
            <Users size={12} />
            {#each data.scans as scan, i (scan.id || scan.slug || i)}
              {#if i > 0}<span class="seal-sep">×</span>{/if}
              <a href="/scans/{scan.slug}" class="seal-link" title="Ver perfil de {scan.name}">{scan.name}</a>
            {/each}
          </div>
        {/if}
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
          {#if data.scans && data.scans.length > 0}
            <div class="meta-item full-width row-style">
              <span class="meta-label">Scan {data.scans.length > 1 ? 'Parceiras' : 'Parceira'}</span>
              <div class="meta-scans-val">
                {#each data.scans as scan, i (scan.id || scan.slug || i)}
                  {#if i > 0}<span class="scan-comma">·</span>{/if}
                  <a href="/scans/{scan.slug}" class="meta-scan-link">
                    {#if scan.logo_id}
                      <img src="/media/{scan.logo_id}" alt={scan.name} class="scan-meta-thumb" />
                    {/if}
                    <span>{scan.name}</span>
                  </a>
                {/each}
              </div>
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
          {#if data.scans && data.scans.length > 0}
            {#each data.scans as scan (scan.id || scan.slug)}
              <a
                href="/scans/{scan.slug}"
                class="badge-scan-partner"
                title="Scan {scan.is_official ? 'Oficial' : 'Parceira'}: {scan.name}"
              >
                <Users size={11} />
                <span>{scan.name}</span>
              </a>
            {/each}
          {/if}
        </div>

        <h1 class="work-title">{decodedTitle}</h1>

        {#if data.work.aliases.length}
          <p class="aliases"><strong>Títulos alternativos:</strong> {data.work.aliases.join(' · ')}</p>
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
        {#if decodedSynopsis}
          {@const fullText = decodedSynopsis}
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
            {#if data.scans && data.scans.length > 0}
              <div class="meta-item full-width row-style">
                <span class="meta-label">Scan {data.scans.length > 1 ? 'Parceiras' : 'Parceira'}</span>
                <div class="meta-scans-val">
                  {#each data.scans as scan, i (scan.id || scan.slug || i)}
                    {#if i > 0}<span class="scan-comma">·</span>{/if}
                    <a href="/scans/{scan.slug}" class="meta-scan-link">
                      {#if scan.logo_id}
                        <img src="/media/{scan.logo_id}" alt={scan.name} class="scan-meta-thumb" />
                      {/if}
                      <span>{scan.name}</span>
                    </a>
                  {/each}
                </div>
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
              <span>Reportar</span>
            </button>
          </div>

          {#if resume}
            <a class="btn-read-hero mobile-only" href="/ler/{resume}">
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
          <div class="chapters-header-info">
            <span class="badge-mini">CONTEÚDO</span>
            <h2 class="chapters-heading">Capítulos Disponíveis ({chapters.length})</h2>
          </div>
          <div class="chapters-header-right">
            {#if resume}
              <a class="btn-read-chapters-desktop desktop-only" href="/ler/{resume}">
                <BookOpen size={18} />
                <span>{data.progress.length ? 'Continuar Leitura' : 'Começar a Ler'}</span>
              </a>
            {/if}
            <span class="small muted">Atualizado em {date(data.work.updated_at)}</span>
          </div>
        </div>

        <div class="chapters-toolbar">
          <input
            class="search-chapters-input"
            bind:value={search}
            placeholder="Buscar por número ou título…"
            aria-label="Buscar capítulo"
          />
          <div class="toolbar-actions">
            <button class="btn-sort" onclick={() => (ascending = !ascending)}>
              {#if ascending}<ArrowUp size={16} />{:else}<ArrowDown size={16} />{/if}
              <span>{ascending ? 'Mais antigos' : 'Mais recentes'}</span>
            </button>
            <button
              class="btn-batch-dl"
              class:is-busy={batchDownloading}
              onclick={handleBatchDownload}
              disabled={batchDownloading || !data.chapters.length}
              title="Baixar todos os capítulos para leitura offline"
            >
              {#if batchDownloading}
                <Loader2 size={15} class="spin" />
                <span>Baixando ({batchProgress.current}/{batchProgress.total})</span>
              {:else}
                <Download size={15} />
                <span>Baixar Todos</span>
              {/if}
            </button>
          </div>
        </div>

        <div class="chapters-list-card">
          {#each visibleChapters as chapter (chapter.id)}
            {@const isRead = readChapterIds.has(chapter.id)}
            {@const isNew = chapter.published_at && (Date.now() - new Date(chapter.published_at).getTime()) < 7 * 24 * 60 * 60 * 1000}
            {@const scanLabel = (chapter.chapter_scans || []).map((cs: any) => cs.scans?.name).filter(Boolean).join(' × ') || (data.scans?.length ? data.scans.map((s: any) => s.name).join(' × ') : '')}
            {@const isDl = downloadedChapterIds.has(chapter.id)}
            {@const dlProgress = downloadingChapterIds[chapter.id]}
            <a href="/ler/{chapter.id}" class="chapter-item" class:is-read={isRead}>
              <div class="chapter-left">
                <div class="chapter-primary-row">
                  <span class="chapter-num">Cap. {chapterIdentityLabel(chapter)}</span>
                  {#if isNew}
                    <span class="chapter-badge-new">NOVO</span>
                  {/if}
                  {#if chapter.title}
                    <span class="chapter-title">{chapter.title}</span>
                  {/if}
                </div>
                <div class="chapter-meta-row">
                  <span class="chapter-meta-views"><Eye size={12} /> {formatViews(chapter.views_total || 0)}</span>
                  {#if scanLabel}
                    {@const chScanSlug = (chapter.chapter_scans?.[0]?.scans?.slug) || (data.scans?.[0]?.slug) || null}
                    <span class="chapter-meta-dot">·</span>
                    {#if chScanSlug}
                      <button
                        type="button"
                        class="chapter-meta-scan-btn"
                        title="Ver perfil da scan {scanLabel}"
                        onclick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          window.location.href = `/scans/${chScanSlug}`;
                        }}
                      >
                        {scanLabel}
                      </button>
                    {:else}
                      <span class="chapter-meta-scan">{scanLabel}</span>
                    {/if}
                  {/if}
                  {#if chapter.published_at}
                    <span class="chapter-meta-dot">·</span>
                    <time class="chapter-meta-date">{date(chapter.published_at)}</time>
                  {/if}
                </div>
              </div>
              <div class="chapter-right">
                <button
                  type="button"
                  class="btn-chapter-dl"
                  class:is-downloaded={isDl}
                  class:is-downloading={dlProgress !== undefined}
                  onclick={(e) => handleToggleDownload(chapter, e)}
                  title={isDl ? 'Disponível offline (clique para remover)' : 'Baixar capítulo'}
                >
                  {#if dlProgress !== undefined}
                    <Loader2 size={13} class="spin" />
                    <span>{dlProgress}%</span>
                  {:else if isDl}
                    <CheckCircle2 size={13} class="icon-success" />
                    <span>Baixado</span>
                  {:else}
                    <Download size={13} />
                    <span>Baixar</span>
                  {/if}
                </button>

                {#if isRead}
                  <span class="read-indicator">
                    <CheckCircle2 size={14} />
                    <span>Lido</span>
                  </span>
                {/if}
                <BookOpen size={16} class="read-arrow" />
              </div>
            </a>
          {/each}

          {#if !search.trim() && chapters.length > visibleLimit}
            <div class="chapters-load-more-bar">
              <button
                type="button"
                class="btn-load-more"
                onclick={() => (visibleLimit += 150)}
              >
                Carregar mais capítulos ({chapters.length - visibleLimit} restantes)
              </button>
              <button
                type="button"
                class="btn-load-all"
                onclick={() => (visibleLimit = chapters.length)}
              >
                Mostrar todos ({chapters.length})
              </button>
            </div>
          {/if}

          {#if !chapters.length}
            <div class="empty-chapters">
              {#if search}
                <p>Nenhum capítulo encontrado para "{search}".</p>
              {:else}
                <p>Nenhum capítulo disponível no momento.</p>
              {/if}
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

{/if}

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
    left: 12px;
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

  .cover-scan-seal {
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #dfc28d;
    background: rgba(8, 10, 18, 0.92);
    backdrop-filter: blur(10px);
    padding: 4px 14px;
    border-radius: 999px;
    white-space: nowrap;
    border: 1px solid rgba(223, 194, 141, 0.4);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.7);
    z-index: 3;
  }

  .cover-scan-seal .seal-link {
    color: #dfc28d;
    text-decoration: none;
    transition: color 0.15s ease, text-shadow 0.15s ease;
  }

  .cover-scan-seal .seal-link:hover {
    color: #f7e0b5;
    text-shadow: 0 0 8px rgba(223, 194, 141, 0.6);
  }

  .cover-scan-seal .seal-sep {
    opacity: 0.6;
    margin: 0 1px;
  }

  .work-type-badges {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .badge-scan-partner {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #dfc28d;
    background: rgba(223, 194, 141, 0.12);
    border: 1px solid rgba(223, 194, 141, 0.35);
    padding: 3px 9px;
    border-radius: 6px;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .badge-scan-partner:hover {
    background: rgba(223, 194, 141, 0.22);
    border-color: rgba(223, 194, 141, 0.65);
    color: #fff;
    transform: translateY(-1px);
    box-shadow: 0 2px 10px rgba(223, 194, 141, 0.2);
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

  .aliases strong {
    color: #c2bed4;
    font-weight: 650;
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

  .meta-scans-val {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  .meta-scan-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #dfc28d;
    text-decoration: none;
    font-size: 13.5px;
    font-weight: 700;
    transition: color 0.15s ease, text-decoration 0.15s ease;
  }

  .meta-scan-link:hover {
    color: #f7e0b5;
    text-decoration: underline;
  }

  .scan-meta-thumb {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    object-fit: cover;
    border: 1px solid rgba(223, 194, 141, 0.4);
  }

  .scan-comma {
    color: #7b788a;
    font-size: 12px;
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
    gap: 16px;
    flex-wrap: wrap;
  }

  .chapters-header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .btn-read-chapters-desktop {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 22px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 750;
    color: #ffffff;
    background: linear-gradient(135deg, #8b5cf6, #6d28d9);
    box-shadow: 0 4px 16px rgba(109, 40, 217, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.2);
    text-decoration: none;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    white-space: nowrap;
  }

  .btn-read-chapters-desktop:hover {
    transform: translateY(-2px);
    background: linear-gradient(135deg, #9333ea, #7c3aed);
    box-shadow: 0 8px 24px rgba(139, 92, 246, 0.55), inset 0 1px 1px rgba(255, 255, 255, 0.4);
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
    transition: all 0.2s ease;
  }

  .btn-sort:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #ffffff;
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn-batch-dl {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 18px;
    border-radius: 12px;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.3);
    color: #c4b5fd;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-batch-dl:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.22);
    border-color: rgba(139, 92, 246, 0.5);
    color: #ffffff;
  }

  .btn-batch-dl:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-chapter-dl {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #a7a3b8;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 2;
  }

  .btn-chapter-dl:hover {
    background: rgba(181, 154, 245, 0.15);
    border-color: rgba(181, 154, 245, 0.35);
    color: #ffffff;
  }

  .btn-chapter-dl.is-downloaded {
    background: rgba(52, 211, 153, 0.12);
    border-color: rgba(52, 211, 153, 0.35);
    color: #34d399;
  }

  .btn-chapter-dl.is-downloading {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.4);
    color: #c4b5fd;
  }

  :global(.icon-success) {
    color: #34d399;
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
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
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .chapter-primary-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .chapter-num {
    font-size: 15px;
    font-weight: 700;
    color: #ffffff;
  }

  .chapter-title {
    font-size: 13.5px;
    color: #b5b1c7;
  }

  .chapter-meta-row {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #8c899a;
  }

  .chapter-meta-views {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: #a78bfa;
    font-weight: 600;
  }

  .chapter-meta-scan {
    color: #dfc28d;
    font-weight: 600;
  }

  .chapter-meta-scan-btn {
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    font-family: inherit;
    font-size: inherit;
    font-weight: 600;
    color: #dfc28d;
    cursor: pointer;
    transition: color 0.15s ease, text-decoration 0.15s ease;
    display: inline-flex;
    align-items: center;
  }

  .chapter-meta-scan-btn:hover {
    color: #f7e0b5;
    text-decoration: underline;
  }

  .chapter-meta-date {
    color: #7b788a;
  }

  .chapter-meta-dot {
    color: #4b4859;
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

  .chapters-load-more-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: center;
    padding: 20px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
  }

  .btn-load-more,
  .btn-load-all {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 20px;
    border-radius: 10px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
  }

  .btn-load-more {
    background: #a855f7;
    color: #ffffff;
  }

  .btn-load-more:hover {
    background: #9333ea;
  }

  .btn-load-all {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .btn-load-all:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #ffffff;
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

    .kuro-sidebar {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      margin: 0 auto;
    }

    .work-cover-wrap {
      max-width: 170px;
      width: 170px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: center;
      align-self: center;
    }

    .work-cover {
      width: 100%;
      margin: 0 auto;
      display: block;
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

  /* Work page redesign: intentionally mobile-first. All selectors are scoped
     to the new composition so the legacy markup above can be removed safely
     after the rollout without changing the visual contract. */
  .work-redesign-backdrop {
    position: absolute;
    inset: 0 0 auto;
    height: 380px;
    overflow: hidden;
    pointer-events: none;
    z-index: 0;
    background: #090a10;
  }

  .work-redesign-backdrop::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(7, 8, 13, 0.38), #090a10 88%);
  }

  .work-redesign-backdrop img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.38;
    filter: blur(36px) saturate(1.15);
    transform: scale(1.1);
  }

  .work-redesign {
    position: relative;
    z-index: 1;
    padding-top: 1.25rem;
    padding-bottom: 4rem;
  }

  .work-breadcrumb {
    display: flex;
    min-width: 0;
    gap: 0.45rem;
    overflow: hidden;
    color: #aaa7b7;
    font-size: 0.78rem;
    margin-bottom: 1rem;
  }

  .work-breadcrumb a { color: #d1c6ff; text-decoration: none; white-space: nowrap; }
  .work-breadcrumb a:hover { color: #fff; text-decoration: underline; }
  .work-breadcrumb span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .work-hero,
  .work-panel,
  .chapter-list {
    border: 1px solid rgba(255, 255, 255, 0.09);
    background: rgba(16, 17, 27, 0.78);
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.2);
  }

  .work-hero {
    display: grid;
    grid-template-columns: minmax(105px, 31vw) minmax(0, 1fr);
    gap: 1rem;
    padding: 0.9rem;
    border-radius: 1.25rem;
  }

  .work-cover-frame {
    position: relative;
    align-self: start;
    overflow: hidden;
    border-radius: 0.9rem;
    box-shadow: 0 14px 26px rgba(0, 0, 0, 0.45);
    aspect-ratio: 5 / 7;
  }

  .work-cover-image { width: 100%; height: 100%; object-fit: cover; display: block; }
  .work-adult-badge {
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.34);
    border-radius: 999px;
    background: #be334d;
    color: #fff;
    padding: 0.2rem 0.45rem;
    font-size: 0.69rem;
    font-weight: 800;
  }

  .work-hero-copy { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; }
  .work-statuses, .work-primary-actions, .work-secondary-actions, .work-tag-list, .chapter-details, .chapter-more-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .work-statuses { margin-bottom: 0.7rem; }
  .work-statuses > span, .new-chapter, .chapter-read, .section-count {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border-radius: 999px;
    padding: 0.25rem 0.5rem;
    font-size: 0.66rem;
    font-weight: 750;
    line-height: 1;
  }

  .work-kind { color: #d5c8ff; background: rgba(149, 104, 255, 0.16); border: 1px solid rgba(149, 104, 255, 0.3); }
  .work-status { color: #f6d795; background: rgba(210, 160, 63, 0.12); border: 1px solid rgba(210, 160, 63, 0.25); }
  .work-featured { color: #fff; background: linear-gradient(135deg, #7b4ed4, #5730a8); }
  .work-rating { color: #ffd1d8; background: rgba(222, 68, 93, 0.22); border: 1px solid rgba(239, 104, 125, 0.35); }

  .work-hero h1 {
    max-width: 22ch;
    color: #fff;
    font-size: clamp(1.45rem, 7vw, 3rem);
    line-height: 1.06;
    letter-spacing: -0.04em;
    margin: 0 0 0.85rem;
    overflow-wrap: anywhere;
  }

  .creator-list { display: flex; flex-wrap: wrap; gap: 0.55rem 1.25rem; margin: 0 0 0.85rem; }
  .creator-list div { display: grid; gap: 0.1rem; }
  .creator-list dt, .work-quick-stats dt, .work-facts dt, .eyebrow {
    color: #8d899d;
    font-size: 0.65rem;
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .creator-list dd { margin: 0; color: #e9e6f1; font-size: 0.83rem; font-weight: 650; overflow-wrap: anywhere; }

  .work-quick-stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
    margin: 0 0 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }
  .work-quick-stats div { padding: 0.58rem 0.5rem; min-width: 0; }
  .work-quick-stats div:nth-child(odd) { border-right: 1px solid rgba(255, 255, 255, 0.07); }
  .work-quick-stats dd { color: #fff; font-size: 0.83rem; font-weight: 720; margin: 0.15rem 0 0; overflow-wrap: anywhere; }

  .work-primary-actions { width: 100%; }
  .read-work-button, .work-action, .chapter-control, .chapters-read-link, .chapter-more-actions button {
    min-height: 2.55rem;
    border-radius: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.12);
    font: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
    transition: transform 150ms ease, background 150ms ease, border-color 150ms ease;
  }
  .read-work-button {
    flex: 1 1 10rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    padding: 0.65rem 0.8rem;
    color: #fff;
    background: linear-gradient(135deg, #8153e7, #5a31b6);
    border-color: rgba(216, 198, 255, 0.42);
  }
  .work-action { display: inline-flex; align-items: center; justify-content: center; gap: 0.42rem; padding: 0.55rem 0.7rem; color: #e9e6f1; background: rgba(255,255,255,0.045); }
  .work-action.icon-action { min-width: 2.75rem; }
  .work-action.is-active { color: #e0d3ff; border-color: rgba(173, 133, 255, 0.58); background: rgba(140, 89, 238, 0.16); }
  .read-work-button:hover, .work-action:hover, .chapter-control:hover:not(:disabled), .chapters-read-link:hover, .chapter-more-actions button:hover { transform: translateY(-1px); border-color: rgba(197, 174, 255, 0.66); }
  .work-action:focus-visible, .read-work-button:focus-visible, .chapter-control:focus-visible, .chapters-read-link:focus-visible, .chapter-main-link:focus-visible, .chapter-open-link:focus-visible, .work-tag-list a:focus-visible, .alias-list li:focus-visible { outline: 3px solid rgba(185, 154, 255, 0.55); outline-offset: 2px; }

  .work-secondary-actions { width: 100%; margin-top: 0.65rem; }
  .work-library-select, .text-action { min-height: 2.25rem; border: 0; background: transparent; color: #b9b4c9; font: inherit; font-size: 0.76rem; }
  .work-library-select { max-width: 100%; padding: 0 0.1rem; }
  .text-action { display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; }
  .text-action:hover { color: #fff; }
  .notify-toggle { display: inline-flex; align-items: center; gap: 0.4rem; color: #aaa6b7; font-size: 0.74rem; cursor: pointer; }
  .notify-toggle input { accent-color: #9568ff; }

  .work-notice { margin: 0.9rem 0; padding: 0.75rem 0.9rem; border-radius: 0.75rem; border: 1px solid rgba(178, 150, 255, 0.35); color: #ddd2ff; background: rgba(116, 77, 197, 0.15); font-size: 0.82rem; }
  .work-information-layout { display: grid; gap: 0.85rem; margin-top: 0.85rem; }
  .work-reading-column { display: grid; gap: 0.85rem; }
  .work-panel { border-radius: 1rem; padding: 1rem; }
  .section-heading-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 0.8rem; }
  .work-panel h2, .chapters-title-row h2 { margin: 0.15rem 0 0; color: #fff; font-size: 1.15rem; letter-spacing: -0.02em; }
  .section-count { color: #c8b4ff; background: rgba(149, 104, 255, 0.13); }
  .alias-list { display: flex; flex-wrap: wrap; gap: 0.45rem; margin: 0; padding: 0; list-style: none; }
  .alias-list li { padding: 0.45rem 0.6rem; border-radius: 0.55rem; color: #d7d3e2; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); font-size: 0.8rem; overflow-wrap: anywhere; }
  .expand-text { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0; margin-top: 0.75rem; border: 0; background: none; color: #cbb9ff; font: inherit; font-size: 0.78rem; font-weight: 700; cursor: pointer; }
  .expand-text:hover { color: #fff; text-decoration: underline; }
  .work-tag-list a { padding: 0.38rem 0.6rem; border: 1px solid rgba(186, 162, 255, 0.22); border-radius: 999px; color: #d8cefb; background: rgba(126, 87, 212, 0.08); font-size: 0.76rem; text-decoration: none; }
  .work-tag-list a:hover { color: #fff; background: rgba(135, 91, 233, 0.22); border-color: rgba(195, 174, 255, 0.55); }
  .synopsis-panel > p:last-of-type { margin: 0.75rem 0 0; color: #c3c0ce; font-size: 0.88rem; line-height: 1.7; white-space: pre-line; }
  .clamped-synopsis { display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }

  .work-facts dl { margin: 0.85rem 0 0; }
  .work-facts dl > div { display: grid; grid-template-columns: minmax(5.5rem, 40%) minmax(0, 1fr); gap: 0.75rem; padding: 0.65rem 0; border-bottom: 1px solid rgba(255,255,255,0.07); }
  .work-facts dl > div:last-child { border-bottom: 0; padding-bottom: 0; }
  .work-facts dd { margin: 0; color: #f1eff5; font-size: 0.82rem; font-weight: 600; overflow-wrap: anywhere; }
  .fact-scans a { color: #ddc28e; text-decoration: none; }
  .fact-scans a:hover { color: #fff0cc; text-decoration: underline; }

  .work-chapters { margin-top: 2.1rem; }
  .chapters-title-row { display: flex; justify-content: space-between; gap: 1rem; align-items: end; margin-bottom: 0.8rem; }
  .chapters-title-row p:last-child { margin: 0.35rem 0 0; color: #9995a7; font-size: 0.77rem; }
  .chapters-read-link { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.55rem 0.75rem; color: #f5f2ff; background: rgba(135, 89, 232, 0.2); white-space: nowrap; }
  .chapters-controls { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.5rem; margin-bottom: 0.75rem; }
  .chapters-controls input { min-width: 0; min-height: 2.6rem; border: 1px solid rgba(255,255,255,0.12); border-radius: 0.75rem; padding: 0 0.8rem; background: rgba(15,16,25,0.86); color: #fff; font: inherit; font-size: 0.82rem; }
  .chapters-controls input:focus { outline: 0; border-color: #b99aff; box-shadow: 0 0 0 3px rgba(163,121,255,0.16); }
  .chapter-control { display: inline-flex; align-items: center; justify-content: center; gap: 0.38rem; padding: 0.5rem 0.65rem; color: #d7d2e3; background: rgba(255,255,255,0.045); }
  .chapter-control.download-all { grid-column: 1 / -1; }
  .chapter-control:disabled { opacity: 0.55; cursor: not-allowed; }
  .chapter-list { overflow: hidden; border-radius: 1rem; }
  .chapter-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 0.65rem; min-height: 4.4rem; padding: 0.68rem 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.06); transition: background 150ms ease; }
  .chapter-row:last-child { border-bottom: 0; }
  .chapter-row:hover { background: rgba(148, 104, 237, 0.1); }
  .chapter-row.is-read { background: rgba(91, 75, 136, 0.1); }
  .chapter-main-link { display: grid; grid-template-columns: 2.25rem minmax(0, 1fr); align-items: center; gap: 0.65rem; min-width: 0; color: inherit; text-decoration: none; }
  .chapter-index { display: grid; place-items: center; width: 2.25rem; height: 2.25rem; border-radius: 0.7rem; color: #cbb9ff; background: rgba(151, 105, 248, 0.12); font-size: 0.72rem; font-weight: 800; }
  .chapter-copy { min-width: 0; display: grid; gap: 0.15rem; }
  .chapter-name { color: #f7f5fa; font-size: 0.87rem; font-weight: 720; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chapter-subtitle { color: #aaa6b8; font-size: 0.75rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chapter-details { justify-content: flex-end; color: #9995a7; font-size: 0.7rem; }
  .chapter-details time { display: none; }
  .new-chapter { color: #ffe09d; background: rgba(221, 160, 47, 0.15); border: 1px solid rgba(221,160,47,0.28); text-transform: uppercase; }
  .chapter-read { color: #bba1ff; }
  .chapter-download { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.36rem 0.45rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 0.55rem; background: rgba(255,255,255,0.04); color: #bbb7c9; font: inherit; font-size: 0.7rem; font-weight: 650; cursor: pointer; }
  .chapter-download:hover { color: #fff; border-color: rgba(190,165,255,0.55); }
  .chapter-download.is-downloaded { color: #81e0ba; border-color: rgba(95,207,165,0.38); }
  .chapter-open-link { display: inline-flex; color: #c2aaff; opacity: 0.76; }
  .chapter-open-link:hover { color: #fff; opacity: 1; }
  :global(.chapter-open) { color: currentColor; }
  .chapter-more-actions { justify-content: center; padding: 1rem; border-top: 1px solid rgba(255,255,255,0.06); }
  .chapter-more-actions button { padding: 0.55rem 0.8rem; color: #fff; background: #6f43cf; }
  .chapter-more-actions .secondary { color: #d5cfdf; background: rgba(255,255,255,0.06); }
  .chapter-empty { padding: 2.5rem 1rem; color: #aaa6b7; text-align: center; font-size: 0.84rem; }

  @media (min-width: 600px) {
    .work-hero { grid-template-columns: 180px minmax(0, 1fr); padding: 1.25rem; gap: 1.4rem; }
    .work-quick-stats { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .work-quick-stats div:nth-child(odd) { border-right: 0; }
    .work-quick-stats div + div { border-left: 1px solid rgba(255, 255, 255, 0.07); }
    .chapters-controls { grid-template-columns: minmax(0, 1fr) auto auto; }
    .chapter-control.download-all { grid-column: auto; }
    .chapter-row { padding: 0.75rem 1rem; }
    .chapter-main-link { grid-template-columns: 2.5rem minmax(0, 1fr); }
    .chapter-details time { display: inline; }
  }

  @media (min-width: 900px) {
    .work-redesign { padding-top: 2rem; }
    .work-redesign-backdrop { height: 500px; }
    .work-hero { grid-template-columns: 250px minmax(0, 1fr); padding: 1.5rem; gap: 2rem; border-radius: 1.5rem; }
    .work-hero h1 { font-size: clamp(2rem, 4vw, 3.45rem); }
    .work-information-layout { grid-template-columns: minmax(0, 1fr) minmax(15rem, 23rem); align-items: start; margin-top: 1rem; }
    .work-facts { position: sticky; top: 5.5rem; }
    .work-panel { padding: 1.25rem; }
    .work-chapters { margin-top: 2.75rem; }
    .chapter-row { min-height: 4.75rem; padding: 0.8rem 1.15rem; }
  }

  @media (max-width: 359px) {
    .work-hero { grid-template-columns: 96px minmax(0, 1fr); padding: 0.7rem; gap: 0.7rem; }
    .work-hero h1 { font-size: 1.3rem; }
    .work-statuses { gap: 0.35rem; }
    .work-statuses > span { font-size: 0.6rem; padding: 0.22rem 0.4rem; }
    .work-quick-stats { font-size: 0.85rem; }
    .chapter-row { gap: 0.45rem; padding: 0.65rem; }
    .chapter-main-link { grid-template-columns: 2rem minmax(0, 1fr); gap: 0.45rem; }
    .chapter-index { width: 2rem; height: 2rem; font-size: 0.65rem; }
    .chapter-download span, :global(.chapter-open) { display: none; }
  }
</style>
