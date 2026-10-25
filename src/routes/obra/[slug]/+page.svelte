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
    Loader2,
    Search,
    Calendar,
    Share2,
    Tag,
    Languages,
    SlidersHorizontal
  } from '@lucide/svelte';
  import { invalidateAll, goto } from '$app/navigation';
  import { action } from '$lib/actions';
  import { kindLabels, statusLabels, date } from '$lib/types';
  import { resolveCoverUrl } from '$lib/covers';
  import { decodeHtmlEntities } from '$lib/html-entities';
  import { chapterDisplayNumber, chapterIdentityLabel } from '$lib/chapter-identity';
  import Comments from '$lib/components/Comments.svelte';
  import ReportModal from '$lib/components/ReportModal.svelte';
  import WorkRating from '$lib/components/WorkRating.svelte';
  import {
    getOfflineChapters,
    saveChapterOffline,
    removeOfflineChapter,
    isOfflineSupported
  } from '$lib/offline-storage';

  let { data } = $props();

  let decodedTitle = $derived(decodeHtmlEntities(data.work.title));
  let decodedSynopsis = $derived(decodeHtmlEntities(data.work.synopsis || data.work.description || ''));
  let obraCover = $derived(resolveCoverUrl(data.work.cover_id, data.work.slug, data.work.id));

  let notice = $state(''),
    busy = $state(false),
    ascending = $state(false),
    search = $state(''),
    synopsisExpanded = $state(false),
    aliasesExpanded = $state(false),
    tagsExpanded = $state(false),
    showReportModal = $state(false);

  // Bindable rating state initialized from SSR
  let currentRating = $state(data.rating || {
    average: null,
    count: 0,
    userRating: null,
    distribution: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  });

  let downloadedChapterIds = new SvelteSet<string>();
  let downloadingChapterIds = $state<Record<string, number>>({});
  let batchDownloading = $state(false);
  let batchProgress = $state({ current: 0, total: 0 });

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

  let previewAliases = $derived(alternativeTitles.slice(0, 3));
  let visibleTags = $derived(tagsExpanded ? data.tags.filter(Boolean) : data.tags.filter(Boolean).slice(0, 8));

  let legitimateAuthor = $derived.by(() => {
    const author = (data.work.author || '').trim();
    if (!author) return null;
    // Check if author looks like a scan team (ends with scan/scans/scanlator or contains scan)
    if (/\b(scan|scans|scanlator|scanlation)\b/i.test(author) || /(scan|scans|scanlator)$/i.test(author)) {
      return null;
    }
    return author;
  });

  let legitimateArtist = $derived.by(() => {
    const artist = (data.work.artist || '').trim();
    if (!artist) return null;
    if (/\b(scan|scans|scanlator|scanlation)\b/i.test(artist) || /(scan|scans|scanlator)$/i.test(artist)) {
      return null;
    }
    return artist;
  });

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
      notice = 'Biblioteca atualizada com sucesso.';
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

  function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: decodedTitle,
        url: window.location.href
      }).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      notice = 'Link copiado para a área de transferência!';
    }
  }
</script>

<svelte:head>
  <title>{decodedTitle} — Ler na Project Nox</title>
  <meta name="description" content={decodedSynopsis ? decodedSynopsis.slice(0, 160) : `Leia ${decodedTitle} online na Project Nox.`} />
  <meta property="og:title" content={decodedTitle} />
  <meta property="og:description" content={decodedSynopsis ? decodedSynopsis.slice(0, 200) : `Leia ${decodedTitle} online na Project Nox.`} />
  <meta property="og:image" content={data.metaImage} />
  <meta property="og:image:alt" content="Capa de {decodedTitle}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content={data.metaImage} />
  <meta name="twitter:title" content="{decodedTitle} — Ler na Project Nox" />
  <meta name="twitter:description" content={decodedSynopsis ? decodedSynopsis.slice(0, 200) : `Leia ${decodedTitle} online na Project Nox.`} />
  <link rel="canonical" href={data.canonical} />
  <meta property="og:url" content={data.canonical} />
  <meta property="og:type" content="book" />
  <meta property="og:site_name" content="Project Nox" />
  <meta property="og:locale" content="pt_BR" />
  <!-- Only the server-generated, HTML-escaped JSON-LD envelope is allowed here. -->
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html data.structuredData}
</svelte:head>

<!-- Cinematic Ambient Backdrop -->
<div class="work-backdrop" aria-hidden="true">
  <img src={obraCover} alt="" class="backdrop-img" />
  <div class="backdrop-gradient"></div>
</div>

<main class="container work-page-root spacer-bottom">
  <!-- Breadcrumb Navigation -->
  <nav class="work-breadcrumb" aria-label="Navegação estrutural">
    <a href="/catalogo">Catálogo</a>
    <span class="crumb-separator" aria-hidden="true">/</span>
    <span class="crumb-current">{decodedTitle}</span>
  </nav>

  <!-- Hero Presentation Section -->
  <section class="work-hero-section" aria-labelledby="work-title">
    <!-- Left Column on Desktop / Centered Top on Mobile: Cover Only -->
    <div class="work-cover-column">
      <div class="work-cover-wrapper">
        <img
          src={obraCover}
          alt="Capa de {decodedTitle}"
          width="280"
          height="392"
          class="work-cover-img"
        />
        {#if isAdult}
          <span class="badge-adult-seal">+18</span>
        {/if}
        {#if data.work.featured}
          <span class="badge-featured-seal">
            <Sparkles size={13} /> Destaque
          </span>
        {/if}
      </div>
    </div>

    <!-- Right Column on Desktop / Below Cover on Mobile: Full Work Details -->
    <div class="work-details-column">
      <!-- Badges Row -->
      <div class="work-badges-row" aria-label="Classificações da obra">
        <span class="badge-kind">{kindLabels[data.work.kind] || data.work.kind || 'Mangá'}</span>
        <span class="badge-status">{statusLabels[data.work.status] || data.work.status}</span>
        {#if data.work.year}
          <span class="badge-year">{data.work.year}</span>
        {/if}
        {#if isAdult}
          <span class="badge-rating-adult">+18 Adulto</span>
        {:else if data.work.age_rating}
          <span class="badge-rating-age">{data.work.age_rating} anos</span>
        {/if}
      </div>

      <!-- Main Title -->
      <h1 id="work-title" class="work-title">{decodedTitle}</h1>

      <!-- Star Rating Component (1 to 5 Stars) -->
      <WorkRating
        workId={data.work.id}
        bind:rating={currentRating}
        profile={data.profile}
        onNotice={(msg) => (notice = msg)}
      />

      <!-- Interactive Controls Group (40-44px Height Reference) -->
      <div class="work-hero-actions" aria-label="Controles de interação">
        <div class="actions-buttons-cluster">
          <button
            type="button"
            class="btn-action-control"
            class:is-active={data.library?.favorite}
            onclick={() => library({ favorite: !data.library?.favorite })}
            disabled={busy}
            title={data.library?.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <Bookmark size={18} fill={data.library?.favorite ? 'currentColor' : 'none'} />
            <span>{data.library?.favorite ? 'Favoritado' : 'Favoritar'}</span>
          </button>

          <button
            type="button"
            class="btn-action-control btn-like"
            class:is-active={data.likes.some((like: any) => like.user_id === data.profile?.id)}
            onclick={like}
            disabled={busy}
            title={data.likes.some((like: any) => like.user_id === data.profile?.id) ? 'Descurtir obra' : 'Curtir obra'}
          >
            <Heart size={18} fill={data.likes.some((like: any) => like.user_id === data.profile?.id) ? 'currentColor' : 'none'} />
            <span>{data.likes.length}</span>
          </button>

          <button
            type="button"
            class="btn-action-control"
            onclick={handleShare}
            title="Compartilhar obra"
          >
            <Share2 size={18} />
            <span class="btn-text-desktop">Compartilhar</span>
          </button>

          <button
            type="button"
            class="btn-action-control btn-report"
            onclick={() => (showReportModal = true)}
            title="Reportar problema nesta obra"
          >
            <Flag size={18} />
            <span class="btn-text-desktop">Reportar</span>
          </button>
        </div>

        <!-- Library Status Selector -->
        <div class="library-dropdown-wrap">
          <select
            class="library-select-hero"
            aria-label="Organizar na biblioteca"
            value={data.library?.status || ''}
            onchange={(e) => library({ status: e.currentTarget.value })}
            disabled={busy}
          >
            <option value="" disabled>Adicionar à biblioteca…</option>
            <option value="READING">Lendo atualmente</option>
            <option value="PLANNED">Quero ler</option>
            <option value="COMPLETED">Concluído</option>
          </select>
        </div>
      </div>

      <!-- Essential Metrics Inline (Clean, unbloated, high-contrast) -->
      <div class="work-metrics-inline" aria-label="Estatísticas da obra">
        <span class="metric-inline-item" title="{data.work.views_total || 0} visualizações totais auditadas">
          <Eye size={14} class="metric-icon" />
          <strong>{formatViews(data.work.views_total || 0)}</strong>
          <span class="metric-lbl">views</span>
        </span>
        <span class="metric-dot" aria-hidden="true">•</span>
        <span class="metric-inline-item" title="{data.metrics?.readers || 0} leitores que concluíram capítulos">
          <Users size={14} class="metric-icon" />
          <strong>{formatViews(data.metrics?.readers || 0)}</strong>
          <span class="metric-lbl">leitores</span>
        </span>
        <span class="metric-dot" aria-hidden="true">•</span>
        <span class="metric-inline-item" title="{data.chapters.length} capítulos disponíveis">
          <BookOpen size={14} class="metric-icon" />
          <strong>{data.chapters.length}</strong>
          <span class="metric-lbl">caps</span>
        </span>
        <span class="metric-dot" aria-hidden="true">•</span>
        <span class="metric-inline-item" title="{data.likes.length} curtidas na comunidade">
          <Heart size={14} class="metric-icon" />
          <strong>{data.likes.length}</strong>
          <span class="metric-lbl">curtidas</span>
        </span>
      </div>

      <!-- Synopsis Section (Integrated, editorial readability, without heavy box) -->
      {#if decodedSynopsis}
        {@const synopsisIsLong = decodedSynopsis.length > 360}
        <div class="work-synopsis-clean">
          <h2 class="synopsis-heading">Sinopse</h2>
          <p class="synopsis-paragraph" class:clamped={synopsisIsLong && !synopsisExpanded}>
            {decodedSynopsis}
          </p>
          {#if synopsisIsLong}
            <button
              type="button"
              class="btn-expand-synopsis"
              onclick={() => (synopsisExpanded = !synopsisExpanded)}
              aria-expanded={synopsisExpanded}
            >
              <span>{synopsisExpanded ? 'Ler menos' : 'Ler sinopse completa'}</span>
              {#if synopsisExpanded}<ChevronUp size={14} />{:else}<ChevronDown size={14} />{/if}
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </section>

  <!-- Notice Feedback Toast -->
  {#if notice}
    <div class="work-notice-bar" role="status">
      <span>{notice}</span>
      <button type="button" class="btn-notice-dismiss" onclick={() => (notice = '')} aria-label="Fechar aviso">
        ×
      </button>
    </div>
  {/if}

  <!-- Redesigned Editorial Ficha Técnica (Single Unified Panel) -->
  <section class="work-specs-section work-specs-editorial work-sidebar" aria-label="Ficha técnica e detalhes da obra">
    <div class="specs-section-header">
      <div class="specs-heading-wrap">
        <SlidersHorizontal size={18} class="specs-header-icon" />
        <h2 class="specs-main-title">Ficha Técnica & Detalhes</h2>
      </div>
      <span class="specs-subtext">Informações editoriais, créditos e catalogação da obra</span>
    </div>

    <!-- Single Unified Panel with True 2x2 Grid on Desktop -->
    <div class="specs-unified-panel">
      <!-- Subseção 1 (Row 1, Col 1): Informações da Obra -->
      <div class="specs-subpanel" id="subpanel-info">
        <div class="subpanel-header">
          <BookOpen size={16} class="subpanel-icon" />
          <h3 class="subpanel-title">Informações da Obra</h3>
        </div>
        <dl class="specs-table">
          <div class="specs-row">
            <dt>Formato</dt>
            <dd>{kindLabels[data.work.kind] || data.work.kind || 'Mangá'}</dd>
          </div>
          <div class="specs-row">
            <dt>Status de Publicação</dt>
            <dd>
              <span class="status-indicator-dot" class:is-ongoing={data.work.status !== 'COMPLETED'}></span>
              {statusLabels[data.work.status] || data.work.status}
            </dd>
          </div>
          {#if data.work.year}
            <div class="specs-row">
              <dt>Ano de Lançamento</dt>
              <dd>{data.work.year}</dd>
            </div>
          {/if}
          <div class="specs-row">
            <dt>Classificação Indicativa</dt>
            <dd>
              {#if isAdult}
                <span class="age-pill adult">+18 Adulto</span>
              {:else if data.work.age_rating}
                <span class="age-pill">{data.work.age_rating} anos</span>
              {:else}
                <span class="age-pill free">Livre</span>
              {/if}
            </dd>
          </div>
          <div class="specs-row">
            <dt>Capítulos Catalogados</dt>
            <dd>{data.chapters.length} {data.chapters.length === 1 ? 'capítulo' : 'capítulos'}</dd>
          </div>
        </dl>
      </div>

      <!-- Subseção 2 (Row 1, Col 2): Equipe & Créditos -->
      <div class="specs-subpanel" id="subpanel-credits">
        <div class="subpanel-header">
          <Users size={16} class="subpanel-icon" />
          <h3 class="subpanel-title">Equipe & Créditos</h3>
        </div>
        <dl class="specs-table">
          <div class="specs-row">
            <dt>Roteiro / História</dt>
            <dd>
              {#if legitimateAuthor}
                <strong>{legitimateAuthor}</strong>
              {:else}
                <span class="unassigned-spec" title="Autor não identificado">?</span>
              {/if}
            </dd>
          </div>
          <div class="specs-row">
            <dt>Arte / Ilustração</dt>
            <dd>
              {#if legitimateArtist}
                <strong>{legitimateArtist}</strong>
              {:else if legitimateAuthor}
                <span>{legitimateAuthor}</span>
              {:else}
                <span class="unassigned-spec" title="Artista não identificado">?</span>
              {/if}
            </dd>
          </div>
          <div class="specs-row scans-row">
            <dt>Tradução / Scanlator</dt>
            <dd class="scans-chips-wrap">
              {#if data.scans && data.scans.length > 0}
                {#each data.scans as scan (scan.id || scan.slug)}
                  <a href="/scans/{scan.slug}" class="scan-pill-link" title="Visitar perfil da scan parceira">
                    <Users size={12} />
                    <span>{scan.name}</span>
                  </a>
                {/each}
              {:else}
                <span class="unassigned-spec" title="Tradução não atribuída a uma scan parceira">?</span>
              {/if}
            </dd>
          </div>
          <div class="specs-row">
            <dt>Idioma</dt>
            <dd>Português (Brasil)</dd>
          </div>
        </dl>
      </div>

      <!-- Subseção 3 (Row 2, Col 1): Gêneros & Temas -->
      <div class="specs-subpanel" id="subpanel-genres">
        <div class="subpanel-header">
          <Tag size={16} class="subpanel-icon" />
          <h3 class="subpanel-title">Gêneros & Temas</h3>
          {#if data.tags?.length}
            <span class="subpanel-count-badge">{data.tags.filter(Boolean).length}</span>
          {/if}
        </div>
        {#if visibleTags.length}
          <div class="editorial-tags-wrap">
            {#each visibleTags as tag (tag.id)}
              <a href="/catalogo?tag={tag.slug}" class="editorial-tag-pill">
                {tag.name}
              </a>
            {/each}
          </div>
          {#if data.tags.filter(Boolean).length > 8}
            <button
              type="button"
              class="btn-toggle-subpanel"
              onclick={() => (tagsExpanded = !tagsExpanded)}
              aria-expanded={tagsExpanded}
            >
              <span>{tagsExpanded ? 'Mostrar menos gêneros' : `Ver todos (${data.tags.filter(Boolean).length})`}</span>
              {#if tagsExpanded}<ChevronUp size={13} />{:else}<ChevronDown size={13} />{/if}
            </button>
          {/if}
        {:else}
          <p class="empty-spec-text">Nenhum gênero catalogado para esta obra.</p>
        {/if}
      </div>

      <!-- Subseção 4 (Row 2, Col 2): Títulos Alternativos (Prévia Compacta de 3) -->
      <div class="specs-subpanel" id="subpanel-aliases">
        <div class="subpanel-header">
          <Languages size={16} class="subpanel-icon" />
          <h3 class="subpanel-title">Títulos Alternativos</h3>
          {#if alternativeTitles.length}
            <span class="subpanel-count-badge">{alternativeTitles.length}</span>
          {/if}
        </div>
        {#if alternativeTitles.length}
          <ul class="aliases-editorial-list">
            {#each previewAliases as alias, i (alias)}
              <li class="alias-editorial-row">
                <span class="alias-index-num">#{i + 1}</span>
                <span class="alias-text">{decodeHtmlEntities(alias)}</span>
              </li>
            {/each}
          </ul>
          {#if alternativeTitles.length > 3}
            <button
              type="button"
              class="btn-toggle-subpanel"
              onclick={() => (aliasesExpanded = !aliasesExpanded)}
              aria-expanded={aliasesExpanded}
            >
              <span>{aliasesExpanded ? 'Recolher títulos' : `Ver todos os ${alternativeTitles.length} títulos`}</span>
              {#if aliasesExpanded}<ChevronUp size={13} />{:else}<ChevronDown size={13} />{/if}
            </button>
          {/if}
        {:else}
          <p class="empty-spec-text">Esta obra não possui outros títulos registrados.</p>
        {/if}
      </div>

      <!-- Subseção 5: Painel Expansível de Largura Total (Row 3, Spans 1 / -1) -->
      {#if aliasesExpanded && alternativeTitles.length > 3}
        <div class="specs-aliases-drawer" id="aliases-expanded-drawer">
          <div class="drawer-header">
            <div class="drawer-title-wrap">
              <Languages size={15} class="drawer-icon" />
              <h4 class="drawer-title">Todos os {alternativeTitles.length} Títulos Alternativos</h4>
            </div>
            <button
              type="button"
              class="btn-drawer-close"
              onclick={() => (aliasesExpanded = false)}
              aria-label="Recolher lista de títulos alternativos"
            >
              <span>Recolher</span>
              <ChevronUp size={14} />
            </button>
          </div>
          <div class="drawer-aliases-grid">
            {#each alternativeTitles as alias, i (alias)}
              <div class="drawer-alias-item">
                <span class="alias-index-num">#{i + 1}</span>
                <span class="alias-text">{decodeHtmlEntities(alias)}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </section>

  <!-- Chapter List Section (Wide, Full-Width Reading Area) -->
  <section class="work-chapters-section" aria-labelledby="chapters-heading">
      <div class="chapters-header">
        <div class="chapters-title-wrap">
          <h2 id="chapters-heading" class="chapters-title">Capítulos</h2>
          <p class="chapters-subtitle">
            {chapters.length} disponíveis · Atualizado em {date(data.work.updated_at)}
          </p>
        </div>
        {#if resume}
          <a class="btn-read-primary" href="/ler/{resume}">
            <BookOpen size={18} />
            <span>{data.progress.length ? 'Continuar leitura' : 'Começar a ler'}</span>
          </a>
        {/if}
      </div>

      <!-- Chapter Search & Filter Controls -->
      <div class="chapters-toolbar">
        <div class="search-input-wrap">
          <Search size={16} class="search-icon" />
          <input
            bind:value={search}
            placeholder="Buscar número ou título do capítulo…"
            aria-label="Buscar capítulo"
            class="chapters-search-input"
          />
          {#if search}
            <button type="button" class="btn-clear-search" onclick={() => (search = '')} aria-label="Limpar busca">
              ×
            </button>
          {/if}
        </div>

        <div class="toolbar-buttons">
          <button
            type="button"
            class="btn-toolbar"
            onclick={() => (ascending = !ascending)}
            title="Alternar ordem dos capítulos"
          >
            {#if ascending}
              <ArrowUp size={16} />
              <span>Mais antigos</span>
            {:else}
              <ArrowDown size={16} />
              <span>Mais recentes</span>
            {/if}
          </button>

          <button
            type="button"
            class="btn-toolbar download-batch-btn"
            class:is-busy={batchDownloading}
            onclick={handleBatchDownload}
            disabled={batchDownloading || !data.chapters.length}
            title="Baixar todos os capítulos para leitura offline"
          >
            {#if batchDownloading}
              <Loader2 size={16} class="spin" />
              <span>{batchProgress.current}/{batchProgress.total}</span>
            {:else}
              <Download size={16} />
              <span>Offline</span>
            {/if}
          </button>
        </div>
      </div>

      <!-- Chapter Cards List -->
      <div class="chapter-list-wrap" aria-live="polite">
        {#each visibleChapters as chapter (chapter.id)}
          {@const isRead = readChapterIds.has(chapter.id)}
          {@const isNew = chapter.published_at && Date.now() - new Date(chapter.published_at).getTime() < 7 * 24 * 60 * 60 * 1000}
          {@const isDownloaded = downloadedChapterIds.has(chapter.id)}
          {@const downloadProgress = downloadingChapterIds[chapter.id]}

          <div class="chapter-card" class:is-read={isRead}>
            <a href="/ler/{chapter.id}" class="chapter-card-link">
              <span class="chapter-number-badge">
                {chapterPresentationLabel(chapter)}
              </span>

              <div class="chapter-info-col">
                <div class="chapter-name-line">
                  <span class="chapter-label">Capítulo {chapterPresentationLabel(chapter)}</span>
                  {#if isNew}
                    <span class="badge-new-pill">Novo</span>
                  {/if}
                  {#if isRead}
                    <span class="badge-read-pill"><CheckCircle2 size={12} /> Lido</span>
                  {/if}
                </div>

                {#if chapter.title && chapter.title.trim() && chapter.title.trim().toLocaleLowerCase('pt-BR') !== `capítulo ${chapterPresentationLabel(chapter)}`.toLocaleLowerCase('pt-BR')}
                  <span class="chapter-sub-title">{chapter.title}</span>
                {/if}

                <!-- Restored Chapter Views & Date Meta Line -->
                <div class="chapter-card-meta">
                  <span class="chapter-meta-views" title="{(chapter.views_total ?? 0)} visualizações">
                    <Eye size={12} />
                    <span>{formatViews(chapter.views_total ?? 0)}</span>
                  </span>
                  {#if chapter.published_at}
                    <span class="meta-dot" aria-hidden="true">·</span>
                    <time class="chapter-meta-date" datetime={chapter.published_at}>
                      <Calendar size={12} />
                      <span>{date(chapter.published_at)}</span>
                    </time>
                  {/if}
                </div>
              </div>
            </a>

            <div class="chapter-actions-col">
              <!-- Offline Download Button -->
              <button
                type="button"
                class="btn-chapter-download"
                class:is-downloaded={isDownloaded}
                onclick={(e) => handleToggleDownload(chapter, e)}
                title={isDownloaded ? 'Remover do armazenamento offline' : 'Baixar para ler offline'}
                aria-label="{isDownloaded ? 'Remover' : 'Baixar'} capítulo {chapterPresentationLabel(chapter)} offline"
              >
                {#if downloadProgress !== undefined}
                  <Loader2 size={15} class="spin" />
                  <span class="download-pct">{downloadProgress}%</span>
                {:else if isDownloaded}
                  <CheckCircle2 size={16} class="icon-downloaded" />
                {:else}
                  <Download size={16} class="icon-download" />
                {/if}
              </button>

              <a
                href="/ler/{chapter.id}"
                class="btn-chapter-read-icon"
                aria-label="Ler capítulo {chapterPresentationLabel(chapter)}"
              >
                <BookOpen size={17} />
              </a>
            </div>
          </div>
        {/each}

        {#if !search.trim() && chapters.length > visibleLimit}
          <div class="chapter-pagination-actions">
            <button
              type="button"
              class="btn-load-more"
              onclick={() => (visibleLimit += 150)}
            >
              Carregar mais ({chapters.length - visibleLimit} restantes)
            </button>
            <button
              type="button"
              class="btn-show-all"
              onclick={() => (visibleLimit = chapters.length)}
            >
              Mostrar todos os {chapters.length}
            </button>
          </div>
        {/if}

        {#if !chapters.length}
          <div class="chapter-empty-state">
            <BookOpen size={36} class="empty-icon" />
            <p>{search ? `Nenhum capítulo encontrado para “${search}”.` : 'Nenhum capítulo disponível no momento.'}</p>
          </div>
        {/if}
      </div>
    </section>

  <!-- Comments Section -->
  <Comments comments={data.comments} workId={data.work.id} profile={data.profile} />

  <!-- Report Modal -->
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

<style>
  /* Ambient Cinematic Backdrop */
  .work-backdrop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 520px;
    overflow: hidden;
    pointer-events: none;
    z-index: 0;
    opacity: 0.35;
    -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.4) 60%, transparent 100%);
    mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.4) 60%, transparent 100%);
  }

  .backdrop-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 20%;
    filter: blur(60px) brightness(0.35) saturate(1.3);
    transform: scale(1.2);
  }

  .backdrop-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(13, 10, 28, 0.35) 0%,
      rgba(7, 6, 17, 0.55) 60%,
      transparent 100%
    );
  }

  /* Page Root */
  .work-page-root {
    position: relative;
    max-width: 1220px;
    margin: 0 auto;
    padding-top: 1.25rem;
  }

  /* Breadcrumb */
  .work-breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.88rem;
    color: rgba(226, 232, 240, 0.6);
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .work-breadcrumb a {
    color: rgba(226, 232, 240, 0.7);
    text-decoration: none;
    transition: color 0.15s;
  }

  .work-breadcrumb a:hover {
    color: #a78bfa;
  }

  .crumb-separator {
    color: rgba(181, 154, 245, 0.3);
  }

  .crumb-current {
    color: #f1f5f9;
    font-weight: 500;
  }

  /* Hero Section */
  .work-hero-section {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 36px;
    align-items: start;
    margin-bottom: 40px;
  }

  /* Cover Column */
  .work-cover-column {
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: sticky;
    top: 90px;
  }

  .work-cover-wrapper {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(181, 154, 245, 0.18);
    background: #090b14;
    aspect-ratio: 280 / 392;
  }

  .work-cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.3s ease;
  }

  .work-cover-wrapper:hover .work-cover-img {
    transform: scale(1.025);
  }

  .badge-adult-seal {
    position: absolute;
    top: 12px;
    left: 12px;
    background: #ef4444;
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.5);
  }

  .badge-featured-seal {
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(167, 139, 250, 0.85);
    backdrop-filter: blur(8px);
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(167, 139, 250, 0.4);
  }

  /* Details Column */
  .work-details-column {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  /* Badges Row */
  .work-badges-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .badge-kind {
    font-size: 0.78rem;
    font-weight: 700;
    color: #e2e8f0;
    background: rgba(167, 139, 250, 0.16);
    border: 1px solid rgba(167, 139, 250, 0.3);
    padding: 3px 9px;
    border-radius: 6px;
  }

  .badge-status {
    font-size: 0.78rem;
    font-weight: 600;
    color: #34d399;
    background: rgba(52, 211, 153, 0.12);
    border: 1px solid rgba(52, 211, 153, 0.25);
    padding: 3px 9px;
    border-radius: 6px;
  }

  .badge-year {
    font-size: 0.78rem;
    font-weight: 600;
    color: rgba(226, 232, 240, 0.65);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 3px 9px;
    border-radius: 6px;
  }

  .badge-rating-adult {
    font-size: 0.78rem;
    font-weight: 700;
    color: #f87171;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.28);
    padding: 3px 9px;
    border-radius: 6px;
  }

  .badge-rating-age {
    font-size: 0.78rem;
    font-weight: 600;
    color: #fbbf24;
    background: rgba(251, 191, 36, 0.12);
    border: 1px solid rgba(251, 191, 36, 0.25);
    padding: 3px 9px;
    border-radius: 6px;
  }

  .badge-scan-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.78rem;
    font-weight: 600;
    color: #a78bfa;
    background: rgba(167, 139, 250, 0.08);
    border: 1px solid rgba(167, 139, 250, 0.2);
    padding: 3px 9px;
    border-radius: 6px;
    text-decoration: none;
    transition: background 0.15s;
  }

  .badge-scan-chip:hover {
    background: rgba(167, 139, 250, 0.18);
  }

  /* Title */
  .work-title {
    font-size: clamp(1.75rem, 3.2vw, 2.5rem);
    font-weight: 800;
    line-height: 1.18;
    color: #f8fafc;
    letter-spacing: -0.02em;
    margin: 0;
    word-break: break-word;
  }

  /* Interactions Row: Height 42px reference, balanced and elegant */
  .work-hero-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin: 4px 0 12px;
  }

  .actions-buttons-cluster {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .btn-action-control {
    height: 42px;
    min-height: 42px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0 14px;
    font-size: 0.88rem;
    font-weight: 600;
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(181, 154, 245, 0.16);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    text-decoration: none;
    box-sizing: border-box;
  }

  .btn-action-control:hover:not(:disabled) {
    background: rgba(181, 154, 245, 0.12);
    border-color: rgba(181, 154, 245, 0.35);
    color: #ffffff;
    transform: translateY(-1px);
  }

  .btn-action-control:focus-visible {
    outline: 2px solid #a78bfa;
    outline-offset: 2px;
  }

  .btn-action-control.is-active {
    color: #ffd154;
    background: rgba(255, 209, 84, 0.12);
    border-color: rgba(255, 209, 84, 0.38);
  }

  .btn-action-control.btn-like.is-active {
    color: #fb7185;
    background: rgba(244, 63, 94, 0.12);
    border-color: rgba(244, 63, 94, 0.38);
  }

  .library-dropdown-wrap {
    min-width: 190px;
    flex: 1;
    max-width: 250px;
  }

  .library-select-hero {
    width: 100%;
    height: 42px;
    min-height: 42px;
    padding: 0 14px;
    background: rgba(18, 14, 28, 0.85);
    border: 1px solid rgba(181, 154, 245, 0.18);
    border-radius: 10px;
    color: #e2e8f0;
    font-size: 0.86rem;
    font-weight: 600;
    outline: none;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    box-sizing: border-box;
  }

  .library-select-hero:hover:not(:disabled) {
    border-color: rgba(181, 154, 245, 0.35);
  }

  .library-select-hero:focus {
    border-color: #a78bfa;
    box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.25);
  }

  /* Inline Essential Metrics (Clean, unbloated, high-contrast) */
  .work-metrics-inline {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin: 6px 0 10px;
  }

  .metric-inline-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.84rem;
    color: rgba(226, 232, 240, 0.7);
  }

  .metric-inline-item strong {
    color: #f1f5f9;
    font-weight: 700;
  }

  .metric-inline-item .metric-lbl {
    color: rgba(226, 232, 240, 0.5);
    font-size: 0.78rem;
  }

  .metric-dot {
    color: rgba(181, 154, 245, 0.35);
    font-size: 0.8rem;
  }

  /* Clean Integrated Synopsis (No heavy box) */
  .work-synopsis-clean {
    margin-top: 14px;
    text-align: left;
  }

  .synopsis-heading {
    font-size: 0.82rem;
    font-weight: 700;
    color: #a78bfa;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 6px;
  }

  .synopsis-paragraph {
    font-size: 0.92rem;
    line-height: 1.65;
    color: rgba(226, 232, 240, 0.82);
    margin: 0;
    white-space: pre-line;
  }

  .synopsis-paragraph.clamped {
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .btn-expand-synopsis {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
    font-size: 0.82rem;
    font-weight: 700;
    color: #a78bfa;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: color 0.15s;
  }

  .btn-expand-synopsis:hover {
    color: #c4b5fd;
  }

  /* Notice Bar */
  .work-notice-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 18px;
    background: rgba(124, 58, 237, 0.2);
    border: 1px solid rgba(167, 139, 250, 0.4);
    border-radius: 12px;
    color: #f1f5f9;
    font-size: 0.9rem;
    font-weight: 500;
    margin: 20px 0;
  }

  /* Redesigned Thematic Editorial Ficha Técnica (4 Balanced Thematic Cards) */
  .work-specs-section {
    margin: 32px 0 42px;
  }

  .specs-section-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(181, 154, 245, 0.1);
  }

  .specs-heading-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  :global(.specs-header-icon) {
    color: #a78bfa;
  }

  .specs-main-title {
    font-size: 1.15rem;
    font-weight: 800;
    color: #f8fafc;
    margin: 0;
    letter-spacing: -0.01em;
  }

  .specs-subtext {
    font-size: 0.82rem;
    color: rgba(226, 232, 240, 0.55);
  }

  /* Single Unified Editorial Panel (True 2x2 Grid on Desktop) */
  .specs-unified-panel {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
    background: rgba(11, 13, 24, 0.65);
    border: 1px solid rgba(181, 154, 245, 0.16);
    border-radius: 16px;
    padding: 22px;
    backdrop-filter: blur(10px);
    width: 100%;
    box-sizing: border-box;
  }

  /* Subpanel: Defined internal identity with subtle contrast & discrete border */
  .specs-subpanel {
    display: flex;
    flex-direction: column;
    background: rgba(18, 16, 32, 0.55);
    border: 1px solid rgba(181, 154, 245, 0.12);
    border-radius: 12px;
    padding: 20px 22px;
    min-height: 0;
    box-sizing: border-box;
    transition: border-color 0.2s ease, background 0.2s ease;
  }

  .specs-subpanel:hover {
    border-color: rgba(181, 154, 245, 0.24);
    background: rgba(22, 19, 40, 0.65);
  }

  #subpanel-info {
    grid-column: 1;
    grid-row: 1;
  }

  #subpanel-credits {
    grid-column: 2;
    grid-row: 1;
  }

  #subpanel-genres {
    grid-column: 1;
    grid-row: 2;
  }

  #subpanel-aliases {
    grid-column: 2;
    grid-row: 2;
  }

  .subpanel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(181, 154, 245, 0.08);
  }

  :global(.subpanel-icon) {
    color: #a78bfa;
    flex-shrink: 0;
  }

  .subpanel-title {
    font-size: 0.88rem;
    font-weight: 700;
    color: #f1f5f9;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0;
  }

  .subpanel-count-badge {
    margin-left: auto;
    font-size: 0.72rem;
    font-weight: 700;
    color: #c4b5fd;
    background: rgba(167, 139, 250, 0.15);
    border: 1px solid rgba(167, 139, 250, 0.25);
    padding: 1px 7px;
    border-radius: 999px;
  }

  .unassigned-spec {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    font-size: 0.82rem;
    font-weight: 700;
    color: rgba(226, 232, 240, 0.5);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
  }

  .specs-table {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    flex: 1;
  }

  .specs-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    padding-bottom: 8px;
    border-bottom: 1px dashed rgba(181, 154, 245, 0.08);
  }

  .specs-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .specs-row dt {
    font-size: 0.86rem;
    font-weight: 500;
    color: #94a3b8;
    margin: 0;
    white-space: nowrap;
  }

  .specs-row dd {
    font-size: 0.92rem;
    font-weight: 600;
    color: #f1f5f9;
    margin: 0;
    text-align: right;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-indicator-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #34d399;
    box-shadow: 0 0 8px rgba(52, 211, 153, 0.6);
    display: inline-block;
  }

  .status-indicator-dot.is-ongoing {
    background: #60a5fa;
    box-shadow: 0 0 8px rgba(96, 165, 250, 0.6);
  }

  .age-pill {
    font-size: 0.76rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.08);
    color: #e2e8f0;
  }

  .age-pill.adult {
    background: rgba(239, 68, 68, 0.18);
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.35);
  }

  .age-pill.free {
    background: rgba(16, 185, 129, 0.15);
    color: #6ee7b7;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .scans-chips-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .scan-pill-link {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.8rem;
    font-weight: 600;
    color: #c4b5fd;
    background: rgba(167, 139, 250, 0.12);
    border: 1px solid rgba(167, 139, 250, 0.24);
    padding: 2px 8px;
    border-radius: 6px;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .scan-pill-link:hover {
    background: rgba(167, 139, 250, 0.22);
    color: #ffffff;
  }

  .muted-spec {
    font-size: 0.84rem;
    color: rgba(226, 232, 240, 0.5);
    font-weight: 400;
  }

  /* Genres Tags Wrap */
  .editorial-tags-wrap {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    align-items: flex-start;
    gap: 8px;
    margin: 2px 0 8px;
  }

  .editorial-tag-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 30px;
    padding: 0 12px;
    font-size: 0.82rem;
    font-weight: 600;
    line-height: 1;
    color: #e2e8f0;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(181, 154, 245, 0.16);
    border-radius: 8px;
    text-decoration: none;
    white-space: nowrap;
    width: auto;
    flex: 0 0 auto;
    box-sizing: border-box;
    transition: all 0.15s ease;
  }

  .editorial-tag-pill:hover {
    color: #ffffff;
    background: rgba(167, 139, 250, 0.2);
    border-color: rgba(167, 139, 250, 0.45);
    transform: translateY(-1px);
  }

  /* Alternative Titles List (Prominent, High Legibility) */
  .aliases-editorial-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    list-style: none;
    padding: 0;
    margin: 0;
    flex: 1;
  }

  .alias-editorial-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(181, 154, 245, 0.08);
    border-radius: 8px;
  }

  .alias-index-num {
    font-size: 0.72rem;
    font-weight: 700;
    color: #a78bfa;
    font-family: monospace;
    flex-shrink: 0;
  }

  .alias-text {
    font-size: 0.88rem;
    font-weight: 500;
    color: #f1f5f9;
    line-height: 1.45;
    word-break: break-word;
  }

  .btn-toggle-subpanel {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: auto;
    padding-top: 12px;
    align-self: flex-start;
    font-size: 0.82rem;
    font-weight: 600;
    color: #a78bfa;
    background: none;
    border: none;
    padding-left: 0;
    padding-right: 0;
    cursor: pointer;
    transition: color 0.15s ease;
  }

  .btn-toggle-subpanel:hover {
    color: #c4b5fd;
  }

  /* Full-width aliases drawer below the 2x2 grid */
  .specs-aliases-drawer {
    grid-column: 1 / -1;
    grid-row: 3;
    background: rgba(16, 14, 30, 0.75);
    border: 1px solid rgba(181, 154, 245, 0.16);
    border-radius: 12px;
    padding: 18px 22px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    animation: drawerFadeIn 0.2s ease-out;
  }

  @keyframes drawerFadeIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(181, 154, 245, 0.1);
  }

  .drawer-title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  :global(.drawer-icon) {
    color: #a78bfa;
    flex-shrink: 0;
  }

  .drawer-title {
    font-size: 0.84rem;
    font-weight: 700;
    color: #c4b5fd;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0;
  }

  .btn-drawer-close {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.78rem;
    font-weight: 600;
    color: #a78bfa;
    background: rgba(167, 139, 250, 0.1);
    border: 1px solid rgba(167, 139, 250, 0.2);
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-drawer-close:hover {
    background: rgba(167, 139, 250, 0.2);
    color: #ffffff;
  }

  .drawer-aliases-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 16px;
  }

  @media (min-width: 1200px) {
    .drawer-aliases-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .drawer-alias-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(181, 154, 245, 0.08);
    border-radius: 8px;
    min-width: 0;
  }

  .empty-spec-text {
    font-size: 0.85rem;
    color: rgba(226, 232, 240, 0.45);
    font-style: italic;
    margin: 0;
  }

  /* Chapters Section (Full Width, Reading Centered) */
  .work-chapters-section {
    width: 100%;
    min-width: 0;
    contain: layout style;
    margin-bottom: 48px;
  }

  .chapters-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 12px;
  }

  .chapters-title-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .chapters-title {
    font-size: 1.35rem;
    font-weight: 800;
    color: #f8fafc;
    margin: 0 0 4px;
    letter-spacing: -0.01em;
  }

  .chapters-subtitle {
    font-size: 0.82rem;
    color: rgba(226, 232, 240, 0.55);
    margin: 0;
  }

  .btn-read-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 44px;
    padding: 10px 22px;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    color: #ffffff;
    font-weight: 700;
    font-size: 0.95rem;
    border-radius: 12px;
    text-decoration: none;
    box-shadow: 0 8px 24px rgba(124, 58, 237, 0.35);
    transition: all 0.2s ease;
    white-space: nowrap;
    box-sizing: border-box;
  }

  .btn-read-primary:hover {
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    box-shadow: 0 10px 28px rgba(124, 58, 237, 0.48);
    transform: translateY(-1px);
  }

  /* Chapters Toolbar */
  .chapters-toolbar {
    display: flex;
    gap: 10px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .search-input-wrap {
    flex: 1;
    min-width: 220px;
    position: relative;
    display: flex;
    align-items: center;
  }

  :global(.search-icon) {
    position: absolute;
    left: 12px;
    color: rgba(226, 232, 240, 0.4);
    pointer-events: none;
  }

  .chapters-search-input {
    width: 100%;
    min-height: 42px;
    padding: 8px 36px 8px 36px;
    background: rgba(18, 14, 28, 0.8);
    border: 1px solid rgba(181, 154, 245, 0.16);
    border-radius: 10px;
    color: #f1f5f9;
    font-size: 0.88rem;
    outline: none;
    transition: border-color 0.2s;
  }

  .chapters-search-input:focus {
    border-color: #a78bfa;
  }

  .btn-clear-search {
    position: absolute;
    right: 10px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    font-size: 1.2rem;
    cursor: pointer;
    line-height: 1;
  }

  .toolbar-buttons {
    display: flex;
    gap: 8px;
  }

  .btn-toolbar {
    min-height: 42px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(181, 154, 245, 0.14);
    border-radius: 10px;
    color: #cbd5e1;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .btn-toolbar:hover {
    background: rgba(181, 154, 245, 0.12);
    color: #ffffff;
  }

  /* Chapter Cards */
  .chapter-list-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .chapter-card {
    min-height: 54px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    background: rgba(14, 16, 26, 0.6);
    border: 1px solid rgba(181, 154, 245, 0.1);
    border-radius: 12px;
    transition: all 0.15s ease;
  }

  .chapter-card:hover {
    background: rgba(22, 25, 40, 0.8);
    border-color: rgba(167, 139, 250, 0.25);
    transform: translateX(2px);
  }

  .chapter-card.is-read {
    opacity: 0.72;
    background: rgba(10, 11, 18, 0.4);
  }

  .chapter-card-link {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    min-width: 0;
  }

  .chapter-number-badge {
    min-width: 44px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    font-weight: 800;
    color: #a78bfa;
    background: rgba(167, 139, 250, 0.12);
    border-radius: 8px;
    padding: 0 8px;
    flex-shrink: 0;
  }

  .chapter-info-col {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .chapter-name-line {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .chapter-label {
    font-size: 0.92rem;
    font-weight: 600;
    color: #f1f5f9;
  }

  .badge-new-pill {
    font-size: 0.68rem;
    font-weight: 800;
    color: #10b981;
    background: rgba(16, 185, 129, 0.14);
    border: 1px solid rgba(16, 185, 129, 0.3);
    padding: 1px 6px;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .badge-read-pill {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.68rem;
    font-weight: 700;
    color: rgba(226, 232, 240, 0.6);
    background: rgba(255, 255, 255, 0.05);
    padding: 1px 6px;
    border-radius: 999px;
  }

  .chapter-sub-title {
    font-size: 0.78rem;
    color: rgba(226, 232, 240, 0.55);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chapter-actions-col {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    margin-left: 8px;
  }

  .chapter-card-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.74rem;
    color: rgba(226, 232, 240, 0.55);
    margin-top: 2px;
  }

  .chapter-meta-views {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #c4b5fd;
    font-weight: 600;
  }

  .chapter-meta-date {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: rgba(226, 232, 240, 0.5);
  }

  .meta-dot {
    color: rgba(181, 154, 245, 0.35);
  }

  .btn-chapter-download {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(181, 154, 245, 0.12);
    border-radius: 8px;
    color: rgba(226, 232, 240, 0.6);
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-chapter-download:hover {
    color: #ffffff;
    background: rgba(167, 139, 250, 0.16);
  }

  .btn-chapter-download.is-downloaded {
    color: #34d399;
    border-color: rgba(52, 211, 153, 0.3);
    background: rgba(52, 211, 153, 0.1);
  }

  .btn-chapter-read-icon {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(167, 139, 250, 0.1);
    border: 1px solid rgba(167, 139, 250, 0.2);
    border-radius: 8px;
    color: #c4b5fd;
    text-decoration: none;
    transition: all 0.15s;
  }

  .btn-chapter-read-icon:hover {
    background: rgba(167, 139, 250, 0.25);
    color: #ffffff;
  }

  .chapter-pagination-actions {
    display: flex;
    gap: 10px;
    margin-top: 14px;
  }

  .btn-load-more {
    flex: 1;
    min-height: 44px;
    background: rgba(167, 139, 250, 0.12);
    border: 1px solid rgba(167, 139, 250, 0.25);
    border-radius: 10px;
    color: #e2e8f0;
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-load-more:hover {
    background: rgba(167, 139, 250, 0.22);
    color: #ffffff;
  }

  .btn-show-all {
    min-height: 44px;
    padding: 0 18px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(181, 154, 245, 0.14);
    border-radius: 10px;
    color: rgba(226, 232, 240, 0.7);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
  }

  .chapter-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 40px 20px;
    background: rgba(14, 16, 26, 0.4);
    border-radius: 12px;
    color: rgba(226, 232, 240, 0.6);
    text-align: center;
  }

  :global(.empty-icon) {
    color: rgba(181, 154, 245, 0.3);
  }

  /* ========================================================================= */
  /* RESPONSIVE DESIGN: TABLET & MOBILE REORGANIZATION */
  /* ========================================================================= */

  @media (max-width: 991px) {
    .specs-unified-panel {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 14px;
    }

    .specs-subpanel {
      padding: 16px 16px;
    }

    #subpanel-info {
      order: 1;
    }

    #subpanel-credits {
      order: 2;
    }

    #subpanel-genres {
      order: 3;
    }

    #subpanel-aliases {
      order: 4;
    }

    .specs-aliases-drawer {
      order: 5;
      padding: 14px;
    }

    .drawer-aliases-grid {
      grid-template-columns: 1fr;
      gap: 8px;
    }
  }

  @media (max-width: 768px) {
    .work-page-root {
      padding-top: 0.5rem;
    }

    /* Transform Hero to Single Vertical Flow */
    .work-hero-section {
      grid-template-columns: 1fr;
      gap: 20px;
      margin-bottom: 24px;
      text-align: center;
    }

    .work-cover-column {
      position: static;
      align-items: center;
    }

    /* Centered, proportional cover on mobile */
    .work-cover-wrapper {
      width: 160px;
      height: 224px;
      aspect-ratio: auto;
      margin: 0 auto;
    }

    /* Hero actions on mobile: full width, comfortable touch targets >= 44px */
    .work-hero-actions {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
      margin: 12px 0 14px;
    }

    .actions-buttons-cluster {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      width: 100%;
    }

    .btn-action-control {
      min-height: 48px;
      height: 48px;
      padding: 0 4px;
      font-size: 0.74rem;
      gap: 4px;
      flex-direction: column;
    }

    .btn-action-control :global(svg) {
      width: 18px;
      height: 18px;
    }

    .btn-text-desktop {
      display: block;
      font-size: 0.7rem;
    }

    .library-dropdown-wrap {
      width: 100%;
      max-width: 100%;
      min-width: 100%;
    }

    .library-select-hero {
      height: 46px;
      min-height: 46px;
      font-size: 0.9rem;
    }

    /* Center badges, title, metrics on mobile */
    .work-badges-row {
      justify-content: center;
    }

    .work-title {
      font-size: 1.55rem;
      line-height: 1.25;
      text-align: center;
    }

    .work-metrics-inline {
      justify-content: center;
    }

    /* Chapter Header adjustments */
    .chapters-header {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .btn-read-primary {
      width: 100%;
      justify-content: center;
    }

    /* Chapter list adjustments */
    .chapters-toolbar {
      flex-direction: column;
    }

    .toolbar-buttons {
      width: 100%;
    }

    .toolbar-buttons .btn-toolbar {
      flex: 1;
      justify-content: center;
    }

    .chapter-card {
      padding: 8px 10px;
    }
  }

  @media (max-width: 380px) {
    .work-cover-wrapper {
      width: 140px;
      height: 196px;
    }

    .work-title {
      font-size: 1.35rem;
    }

    .actions-buttons-cluster {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
