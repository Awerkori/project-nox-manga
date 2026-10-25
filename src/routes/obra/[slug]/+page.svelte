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
    Layers
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

  let visibleAliases = $derived(aliasesExpanded ? alternativeTitles : alternativeTitles.slice(0, 3));
  let visibleTags = $derived(tagsExpanded ? data.tags.filter(Boolean) : data.tags.filter(Boolean).slice(0, 8));

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
    <!-- Left Column on Desktop / Centered Top on Mobile: Cover & Quick CTAs -->
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

      <!-- Desktop Under-Cover Action Buttons -->
      <div class="desktop-cover-actions">
        {#if resume}
          <a class="btn-read-primary" href="/ler/{resume}">
            <BookOpen size={18} />
            <span>{data.progress.length ? 'Continuar leitura' : 'Começar a ler'}</span>
          </a>
        {/if}

        <div class="desktop-action-row">
          <button
            type="button"
            class="btn-action-pill"
            class:is-active={data.library?.favorite}
            onclick={() => library({ favorite: !data.library?.favorite })}
            disabled={busy}
            title={data.library?.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <Bookmark size={16} fill={data.library?.favorite ? 'currentColor' : 'none'} />
            <span>{data.library?.favorite ? 'Favoritado' : 'Favoritar'}</span>
          </button>

          <button
            type="button"
            class="btn-action-pill icon-only"
            class:is-active={data.likes.some((like: any) => like.user_id === data.profile?.id)}
            onclick={like}
            disabled={busy}
            title={data.likes.some((like: any) => like.user_id === data.profile?.id) ? 'Descurtir' : 'Curtir obra'}
          >
            <Heart size={16} fill={data.likes.some((like: any) => like.user_id === data.profile?.id) ? 'currentColor' : 'none'} />
            <span>{data.likes.length}</span>
          </button>

          <button
            type="button"
            class="btn-action-pill icon-only"
            onclick={handleShare}
            title="Compartilhar obra"
          >
            <Share2 size={16} />
          </button>
        </div>

        <!-- Library Status Selector -->
        <div class="library-dropdown-wrap">
          <select
            class="library-select"
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
        {#if data.scans && data.scans.length > 0}
          {#each data.scans as scan (scan.id || scan.slug)}
            <a href="/scans/{scan.slug}" class="badge-scan-chip">
              <Users size={12} />
              <span>{scan.name}</span>
            </a>
          {/each}
        {/if}
      </div>

      <!-- Main Title -->
      <h1 id="work-title" class="work-title">{decodedTitle}</h1>

      <!-- Creators Attribution -->
      {#if data.work.author || data.work.artist}
        <div class="work-creators">
          {#if data.work.author}
            <span class="creator-item">
              <span class="creator-label">Roteiro:</span>
              <strong class="creator-name">{data.work.author}</strong>
            </span>
          {/if}
          {#if data.work.author && data.work.artist && data.work.author !== data.work.artist}
            <span class="creator-sep" aria-hidden="true">•</span>
          {/if}
          {#if data.work.artist && data.work.author !== data.work.artist}
            <span class="creator-item">
              <span class="creator-label">Arte:</span>
              <strong class="creator-name">{data.work.artist}</strong>
            </span>
          {/if}
        </div>
      {/if}

      <!-- Star Rating Component (0 to 5 Stars) -->
      <WorkRating
        workId={data.work.id}
        bind:rating={currentRating}
        profile={data.profile}
        onNotice={(msg) => (notice = msg)}
      />

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

      <!-- Mobile Dedicated CTAs (Full Width Touch Target) -->
      <div class="mobile-cover-actions">
        {#if resume}
          <a class="btn-read-primary" href="/ler/{resume}">
            <BookOpen size={19} />
            <span>{data.progress.length ? 'Continuar leitura' : 'Começar a ler'}</span>
          </a>
        {/if}

        <div class="mobile-actions-grid">
          <button
            type="button"
            class="btn-action-pill"
            class:is-active={data.library?.favorite}
            onclick={() => library({ favorite: !data.library?.favorite })}
            disabled={busy}
          >
            <Bookmark size={17} fill={data.library?.favorite ? 'currentColor' : 'none'} />
            <span>{data.library?.favorite ? 'Favoritado' : 'Favoritar'}</span>
          </button>

          <button
            type="button"
            class="btn-action-pill"
            class:is-active={data.likes.some((like: any) => like.user_id === data.profile?.id)}
            onclick={like}
            disabled={busy}
          >
            <Heart size={17} fill={data.likes.some((like: any) => like.user_id === data.profile?.id) ? 'currentColor' : 'none'} />
            <span>{data.likes.length}</span>
          </button>

          <button
            type="button"
            class="btn-action-pill"
            onclick={handleShare}
          >
            <Share2 size={17} />
            <span>Compartilhar</span>
          </button>

          <button
            type="button"
            class="btn-action-pill"
            onclick={() => (showReportModal = true)}
          >
            <Flag size={17} />
            <span>Reportar</span>
          </button>
        </div>

        <div class="library-dropdown-wrap">
          <select
            class="library-select"
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

  <!-- Unified Editorial Ficha Técnica & Metadados (Positioned BEFORE chapters on Desktop AND Mobile) -->
  <section class="work-specs-editorial work-sidebar" aria-label="Ficha técnica da obra">
    <div class="specs-editorial-header">
      <div class="specs-editorial-title">
        <Layers size={17} class="icon-violet" />
        <h2>Ficha Técnica & Detalhes</h2>
      </div>
      {#if data.scans && data.scans.length > 0}
        <div class="specs-scans-chips">
          {#each data.scans as scan (scan.id || scan.slug)}
            <a href="/scans/{scan.slug}" class="scan-editorial-chip" title="Scan parceira oficial">
              <Users size={12} />
              <span>{scan.name}</span>
            </a>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Cohesive Editorial Grid -->
    <div class="specs-editorial-grid">
      <!-- Publicação & Formato -->
      <div class="specs-group">
        <h3 class="specs-group-title">Publicação</h3>
        <dl class="specs-list">
          <div class="spec-item">
            <dt>Tipo</dt>
            <dd>{kindLabels[data.work.kind] || data.work.kind || 'Mangá'}</dd>
          </div>
          <div class="spec-item">
            <dt>Status</dt>
            <dd>{statusLabels[data.work.status] || data.work.status}</dd>
          </div>
          {#if data.work.year}
            <div class="spec-item">
              <dt>Lançamento</dt>
              <dd>{data.work.year}</dd>
            </div>
          {/if}
          <div class="spec-item">
            <dt>Classificação</dt>
            <dd>{isAdult ? '+18 Adulto' : (data.work.age_rating ? `${data.work.age_rating} anos` : 'Livre')}</dd>
          </div>
        </dl>
      </div>

      <!-- Produção & Autoria -->
      <div class="specs-group">
        <h3 class="specs-group-title">Produção</h3>
        <dl class="specs-list">
          <div class="spec-item">
            <dt>Roteiro</dt>
            <dd>{data.work.author || 'Não informado'}</dd>
          </div>
          {#if data.work.artist && data.work.artist !== data.work.author}
            <div class="spec-item">
              <dt>Arte</dt>
              <dd>{data.work.artist}</dd>
            </div>
          {/if}
          {#if data.scans && data.scans.length > 0}
            <div class="spec-item">
              <dt>{data.scans.length > 1 ? 'Scans Parceiras' : 'Scan Parceira'}</dt>
              <dd class="scans-inline-list">
                {#each data.scans as scan, i (scan.id || scan.slug || i)}
                  <a href="/scans/{scan.slug}" class="scan-link">{scan.name}</a>
                  {#if i < data.scans.length - 1}<span class="sep">·</span>{/if}
                {/each}
              </dd>
            </div>
          {/if}
        </dl>
      </div>

      <!-- Gêneros e Tags (Integrado) -->
      {#if visibleTags.length}
        <div class="specs-group tags-group">
          <div class="specs-group-header-row">
            <h3 class="specs-group-title">Gêneros & Tags</h3>
            <span class="count-badge">{data.tags.filter(Boolean).length}</span>
          </div>
          <div class="editorial-tags-cloud">
            {#each visibleTags as tag (tag.id)}
              <a href="/catalogo?tag={tag.slug}" class="editorial-tag-pill">
                {tag.name}
              </a>
            {/each}
          </div>
          {#if data.tags.filter(Boolean).length > 8}
            <button
              type="button"
              class="btn-expand-editorial"
              onclick={() => (tagsExpanded = !tagsExpanded)}
              aria-expanded={tagsExpanded}
            >
              <span>{tagsExpanded ? 'Menos tags' : `Todas as ${data.tags.filter(Boolean).length} tags`}</span>
              {#if tagsExpanded}<ChevronUp size={14} />{:else}<ChevronDown size={14} />{/if}
            </button>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Títulos Alternativos integrado na base da Ficha Técnica -->
    {#if alternativeTitles.length}
      <div class="specs-aliases-subrow">
        <div class="aliases-header-row">
          <span class="aliases-title">Títulos Alternativos ({alternativeTitles.length})</span>
          {#if alternativeTitles.length > 3}
            <button
              type="button"
              class="btn-expand-aliases"
              onclick={() => (aliasesExpanded = !aliasesExpanded)}
              aria-expanded={aliasesExpanded}
            >
              <span>{aliasesExpanded ? 'Recolher' : 'Expandir todos'}</span>
              {#if aliasesExpanded}<ChevronUp size={13} />{:else}<ChevronDown size={13} />{/if}
            </button>
          {/if}
        </div>
        <div class="aliases-inline-wrap">
          {#each visibleAliases as alias, i (alias)}
            <span class="alias-pill-text">{decodeHtmlEntities(alias)}</span>
            {#if i < visibleAliases.length - 1}<span class="alias-sep">·</span>{/if}
          {/each}
        </div>
      </div>
    {/if}
  </section>

  <!-- Chapter List Section (Wide, Full-Width Reading Area) -->
  <section class="work-chapters-section" aria-labelledby="chapters-heading">
      <div class="chapters-header">
        <div>
          <h2 id="chapters-heading" class="chapters-title">Capítulos</h2>
          <p class="chapters-subtitle">
            {chapters.length} disponíveis · Atualizado em {date(data.work.updated_at)}
          </p>
        </div>
        {#if resume}
          <a class="btn-quick-read" href="/ler/{resume}">
            <BookOpen size={16} />
            <span>{data.progress.length ? 'Continuar lendo' : 'Ler agora'}</span>
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
  }

  .backdrop-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 20%;
    filter: blur(56px) brightness(0.2) saturate(1.4);
    transform: scale(1.15);
  }

  .backdrop-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(6, 7, 12, 0.45) 0%,
      rgba(6, 7, 12, 0.85) 60%,
      #06070c 100%
    );
  }

  /* Page Root */
  .work-page-root {
    position: relative;
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

  /* Desktop Cover Actions */
  .desktop-cover-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .btn-read-primary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 46px;
    padding: 10px 20px;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    color: #ffffff;
    font-weight: 700;
    font-size: 0.95rem;
    border-radius: 12px;
    text-decoration: none;
    box-shadow: 0 8px 24px rgba(124, 58, 237, 0.35);
    transition: all 0.2s ease;
  }

  .btn-read-primary:hover {
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    box-shadow: 0 10px 28px rgba(124, 58, 237, 0.48);
    transform: translateY(-1px);
  }

  .desktop-action-row {
    display: flex;
    gap: 8px;
  }

  .btn-action-pill {
    flex: 1;
    min-height: 42px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(181, 154, 245, 0.16);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-action-pill:hover {
    background: rgba(181, 154, 245, 0.12);
    border-color: rgba(181, 154, 245, 0.3);
    color: #ffffff;
  }

  .btn-action-pill.icon-only {
    flex: 0 0 46px;
    padding: 0 8px;
  }

  .btn-action-pill.is-active {
    color: #ffd154;
    background: rgba(255, 209, 84, 0.12);
    border-color: rgba(255, 209, 84, 0.35);
  }

  .library-dropdown-wrap {
    width: 100%;
  }

  .library-select {
    width: 100%;
    min-height: 40px;
    padding: 8px 12px;
    background: rgba(18, 14, 28, 0.8);
    border: 1px solid rgba(181, 154, 245, 0.16);
    border-radius: 10px;
    color: #cbd5e1;
    font-size: 0.85rem;
    font-weight: 500;
    outline: none;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .library-select:focus {
    border-color: #a78bfa;
  }

  /* Mobile Actions (Hidden on Desktop) */
  .mobile-cover-actions {
    display: none;
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

  /* Creators Attribution */
  .work-creators {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.92rem;
    color: rgba(226, 232, 240, 0.75);
    flex-wrap: wrap;
  }

  .creator-label {
    color: rgba(226, 232, 240, 0.5);
    margin-right: 4px;
  }

  .creator-name {
    color: #e2e8f0;
    font-weight: 600;
  }

  .creator-sep {
    color: rgba(181, 154, 245, 0.3);
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

  /* Unified Editorial Ficha Técnica & Metadados (Positioned BEFORE chapters on Desktop AND Mobile) */
  .work-specs-editorial {
    margin: 30px 0 38px;
    padding: 22px 26px;
    background: rgba(14, 12, 24, 0.45);
    border: 1px solid rgba(181, 154, 245, 0.12);
    border-radius: 16px;
    backdrop-filter: blur(12px);
  }

  .specs-editorial-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 20px;
    padding-bottom: 14px;
    border-bottom: 1px solid rgba(181, 154, 245, 0.1);
  }

  .specs-editorial-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .specs-editorial-title h2 {
    font-size: 1.05rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    letter-spacing: -0.01em;
  }

  :global(.icon-violet) {
    color: #a78bfa;
  }

  .specs-scans-chips {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .scan-editorial-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.78rem;
    font-weight: 600;
    color: #c4b5fd;
    background: rgba(167, 139, 250, 0.1);
    border: 1px solid rgba(167, 139, 250, 0.22);
    border-radius: 6px;
    padding: 3px 8px;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .scan-editorial-chip:hover {
    background: rgba(167, 139, 250, 0.2);
    color: #ffffff;
  }

  .specs-editorial-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 28px;
    align-items: start;
  }

  .specs-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .specs-group-header-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .specs-group-title {
    font-size: 0.78rem;
    font-weight: 700;
    color: #a78bfa;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }

  .count-badge {
    font-size: 0.7rem;
    font-weight: 700;
    color: #c4b5fd;
    background: rgba(167, 139, 250, 0.14);
    padding: 1px 6px;
    border-radius: 999px;
  }

  .specs-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
  }

  .spec-item {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    padding-bottom: 6px;
    border-bottom: 1px dashed rgba(181, 154, 245, 0.07);
  }

  .spec-item:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .spec-item dt {
    font-size: 0.8rem;
    font-weight: 500;
    color: rgba(226, 232, 240, 0.55);
    margin: 0;
  }

  .spec-item dd {
    font-size: 0.86rem;
    font-weight: 600;
    color: #e2e8f0;
    margin: 0;
    text-align: right;
  }

  .scans-inline-list {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .scan-link {
    color: #a78bfa;
    text-decoration: none;
    transition: color 0.15s;
  }

  .scan-link:hover {
    color: #c4b5fd;
    text-decoration: underline;
  }

  .editorial-tags-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .editorial-tag-pill {
    font-size: 0.76rem;
    font-weight: 600;
    color: rgba(226, 232, 240, 0.85);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(181, 154, 245, 0.14);
    padding: 4px 9px;
    border-radius: 6px;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .editorial-tag-pill:hover {
    color: #ffffff;
    background: rgba(167, 139, 250, 0.16);
    border-color: rgba(167, 139, 250, 0.35);
  }

  .btn-expand-editorial {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    font-size: 0.78rem;
    font-weight: 700;
    color: #a78bfa;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: color 0.15s;
  }

  .btn-expand-editorial:hover {
    color: #c4b5fd;
  }

  .specs-aliases-subrow {
    margin-top: 20px;
    padding-top: 14px;
    border-top: 1px solid rgba(181, 154, 245, 0.08);
  }

  .aliases-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .aliases-title {
    font-size: 0.78rem;
    font-weight: 700;
    color: #a78bfa;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .btn-expand-aliases {
    font-size: 0.74rem;
    font-weight: 600;
    color: rgba(226, 232, 240, 0.6);
    background: none;
    border: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .btn-expand-aliases:hover {
    color: #a78bfa;
  }

  .aliases-inline-wrap {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  .alias-pill-text {
    font-size: 0.8rem;
    color: rgba(226, 232, 240, 0.7);
  }

  .alias-sep {
    color: rgba(181, 154, 245, 0.3);
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

  .btn-quick-read {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: rgba(167, 139, 250, 0.12);
    border: 1px solid rgba(167, 139, 250, 0.28);
    border-radius: 10px;
    color: #c4b5fd;
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.15s;
  }

  .btn-quick-read:hover {
    background: rgba(167, 139, 250, 0.22);
    color: #ffffff;
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

  @media (max-width: 1024px) {
    .specs-editorial-grid {
      grid-template-columns: 1fr;
      gap: 22px;
    }

    .work-specs-editorial {
      padding: 20px 22px;
      margin: 24px 0 32px;
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

    /* Hide desktop actions on mobile */
    .desktop-cover-actions {
      display: none;
    }

    /* Show mobile dedicated actions */
    .mobile-cover-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 12px 0;
      text-align: left;
    }

    .mobile-actions-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }

    .mobile-actions-grid .btn-action-pill {
      min-height: 48px;
      flex-direction: column;
      gap: 4px;
      font-size: 0.72rem;
      padding: 6px 4px;
    }

    /* Center badges, title, creators on mobile */
    .work-badges-row {
      justify-content: center;
    }

    .work-title {
      font-size: 1.55rem;
      line-height: 1.25;
      text-align: center;
    }

    .work-creators {
      justify-content: center;
      font-size: 0.88rem;
    }

    .work-metrics-bar {
      justify-content: center;
      gap: 8px;
    }

    .metric-chip {
      padding: 5px 9px;
      font-size: 0.8rem;
    }

    /* Synopsis and sections align naturally on mobile */
    .work-section-block {
      text-align: left;
      padding: 14px 16px;
    }

    .tags-cloud {
      justify-content: flex-start;
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

    .mobile-actions-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
