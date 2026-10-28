<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import {
    Download,
    BookOpen,
    Trash2,
    CheckCircle2,
    AlertTriangle,
    ArrowLeft,
    Wifi,
    WifiOff,
    ExternalLink,
    HardDrive,
    Layers,
    ChevronRight,
    ArrowUpDown,
    Maximize2,
    Minimize2,
    X,
    Eye
  } from '@lucide/svelte';
  import {
    getOfflineChapters,
    removeOfflineChapter,
    removeOfflineWork,
    groupOfflineChaptersByWork,
    formatStorageBytes,
    estimateChapterStorageBytes,
    type OfflineChapter,
    type DownloadedWorkGroup
  } from '$lib/offline-storage';
  import { resolveCoverUrl, resolveOriginalCoverUrl } from '$lib/covers';

  // State
  let loading = $state(true);
  let allChapters = $state<OfflineChapter[]>([]);
  let groupedWorks = $state<DownloadedWorkGroup[]>([]);
  let selectedWorkId = $state<string | null>(null);
  let sortOrder = $state<'asc' | 'desc'>('asc');
  let isOnline = $state(true);

  // Modal confirmation state
  let confirmModal = $state<{
    type: 'chapter' | 'work';
    id: string;
    workId: string;
    title: string;
    message: string;
    submessage?: string;
    sizeFormatted: string;
  } | null>(null);

  // Notification Toast
  let toast = $state<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  let toastTimer: any = null;

  function showToast(message: string, type: 'success' | 'info' | 'error' = 'success') {
    if (toastTimer) clearTimeout(toastTimer);
    toast = { message, type };
    toastTimer = setTimeout(() => {
      toast = null;
    }, 4000);
  }

  // Built-in Offline Reader Viewer state
  let offlineReaderChapter = $state<OfflineChapter | null>(null);
  let offlineReaderWork = $state<DownloadedWorkGroup | null>(null);
  let readerMode = $state<'webtoon' | 'paginated'>('webtoon');
  let readerCurrentPage = $state(1);
  let readerFullscreen = $state(false);

  // Derived metrics
  let totalChaptersCount = $derived(allChapters.length);
  let totalWorksCount = $derived(groupedWorks.length);
  let totalStorageBytes = $derived(
    groupedWorks.reduce((acc, g) => acc + g.totalStorageBytes, 0)
  );

  let selectedWork = $derived.by(() => {
    if (!selectedWorkId) return null;
    return (
      groupedWorks.find(
        (w) => w.workId === selectedWorkId || w.workSlug === selectedWorkId
      ) || null
    );
  });

  let sortedChaptersForSelectedWork = $derived.by(() => {
    if (!selectedWork) return [];
    const list = [...selectedWork.chapters];
    if (sortOrder === 'desc') {
      return list.reverse();
    }
    return list;
  });

  async function loadDownloadsData() {
    try {
      loading = true;
      const chapters = await getOfflineChapters();
      allChapters = chapters;
      groupedWorks = groupOfflineChaptersByWork(chapters);

      // Check URL query param for obra
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const obraParam = urlParams.get('obra');
        if (obraParam) {
          const match = groupedWorks.find(
            (w) => w.workId === obraParam || w.workSlug === obraParam
          );
          if (match) {
            selectedWorkId = match.workId;
          }
        }
      }
    } catch (err) {
      console.error('Falha ao carregar downloads do IndexedDB:', err);
      allChapters = [];
      groupedWorks = [];
    } finally {
      loading = false;
    }
  }

  function handleSelectWork(workId: string | null) {
    selectedWorkId = workId;
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (workId) {
        const work = groupedWorks.find((w) => w.workId === workId);
        url.searchParams.set('obra', work?.workSlug || workId);
      } else {
        url.searchParams.delete('obra');
      }
      window.history.pushState({}, '', url.toString());
    }
  }

  function handlePromptDeleteChapter(e: MouseEvent, chapter: OfflineChapter, workTitle: string) {
    e.stopPropagation();
    const size = formatStorageBytes(estimateChapterStorageBytes(chapter));
    confirmModal = {
      type: 'chapter',
      id: chapter.chapterId,
      workId: chapter.workId,
      title: `Remover Capítulo ${chapter.number}?`,
      message: `Tem certeza que deseja remover o download do Capítulo ${chapter.number} de "${workTitle}"?`,
      submessage: `Isso liberará ${size} de armazenamento local no seu dispositivo. Seu histórico de leitura não será afetado.`,
      sizeFormatted: size
    };
  }

  function handlePromptDeleteWork(e: MouseEvent, work: DownloadedWorkGroup) {
    e.stopPropagation();
    const size = formatStorageBytes(work.totalStorageBytes);
    confirmModal = {
      type: 'work',
      id: work.workId,
      workId: work.workId,
      title: `Remover todos os downloads desta obra?`,
      message: `Tem certeza que deseja remover todos os ${work.chaptersCount} capítulos baixados de "${work.workTitle}"?`,
      submessage: `Esta ação liberará aproximadamente ${size} de armazenamento no seu dispositivo.`,
      sizeFormatted: size
    };
  }

  async function handleConfirmDelete() {
    if (!confirmModal) return;
    const { type, id, workId } = confirmModal;
    confirmModal = null;

    try {
      if (type === 'chapter') {
        await removeOfflineChapter(id);
        showToast('Capítulo removido do armazenamento local.', 'info');
      } else if (type === 'work') {
        const deletedCount = await removeOfflineWork(workId);
        showToast(`${deletedCount} capítulos removidos com sucesso.`, 'info');
        if (selectedWorkId === workId) {
          handleSelectWork(null);
        }
      }
      await loadDownloadsData();
    } catch (err: any) {
      showToast(`Erro ao remover: ${err.message}`, 'error');
    }
  }

  function handleCancelDelete() {
    confirmModal = null;
  }

  // Offline Reader Launcher
  function handleOpenOfflineReader(chapter: OfflineChapter, work: DownloadedWorkGroup) {
    offlineReaderChapter = chapter;
    offlineReaderWork = work;
    readerCurrentPage = 1;
    document.body.style.overflow = 'hidden';
  }

  function handleCloseOfflineReader() {
    offlineReaderChapter = null;
    offlineReaderWork = null;
    document.body.style.overflow = '';
  }

  function handleNextOfflineChapter() {
    if (!offlineReaderChapter || !offlineReaderWork) return;
    const chapters = offlineReaderWork.chapters;
    const currentIndex = chapters.findIndex((c) => c.chapterId === offlineReaderChapter!.chapterId);
    if (currentIndex !== -1 && currentIndex < chapters.length - 1) {
      offlineReaderChapter = chapters[currentIndex + 1];
      readerCurrentPage = 1;
      const readerContainer = document.querySelector('.offline-reader-body');
      if (readerContainer) readerContainer.scrollTop = 0;
    }
  }

  function handlePrevOfflineChapter() {
    if (!offlineReaderChapter || !offlineReaderWork) return;
    const chapters = offlineReaderWork.chapters;
    const currentIndex = chapters.findIndex((c) => c.chapterId === offlineReaderChapter!.chapterId);
    if (currentIndex > 0) {
      offlineReaderChapter = chapters[currentIndex - 1];
      readerCurrentPage = 1;
      const readerContainer = document.querySelector('.offline-reader-body');
      if (readerContainer) readerContainer.scrollTop = 0;
    }
  }

  function toggleReaderFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        readerFullscreen = true;
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        readerFullscreen = false;
      }).catch(() => {});
    }
  }

  function handlePopState() {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const obraParam = urlParams.get('obra');
      if (obraParam) {
        const match = groupedWorks.find(
          (w) => w.workId === obraParam || w.workSlug === obraParam
        );
        selectedWorkId = match ? match.workId : null;
      } else {
        selectedWorkId = null;
      }
    }
  }

  function handleOnlineStatus() {
    isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  function fallbackCover(node: HTMLImageElement) {
    const onError = () => {
      if (!node.src.endsWith('/brand/nox-symbol.webp')) {
        node.src = '/brand/nox-symbol.webp';
      }
    };
    node.addEventListener('error', onError);
    return {
      destroy() {
        node.removeEventListener('error', onError);
      }
    };
  }

  function formatShortDate(isoString: string): string {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  }

  onMount(() => {
    isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    window.addEventListener('popstate', handlePopState);

    loadDownloadsData();
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
      window.removeEventListener('popstate', handlePopState);
      document.body.style.overflow = '';
    }
  });
</script>

<svelte:head>
  <title>
    {selectedWork
      ? `${selectedWork.workTitle} — Capítulos Baixados | Project Nox`
      : 'Biblioteca de Downloads | Project Nox'}
  </title>
  <meta
    name="description"
    content="Biblioteca pessoal de capítulos baixados para leitura offline no Project Nox."
  />
</svelte:head>

<div class="downloads-page-root">
  <!-- Toast Notification -->
  {#if toast}
    <div class="toast-floating {toast.type}" role="status" aria-live="polite">
      <span>{toast.message}</span>
    </div>
  {/if}

  <div class="downloads-container">
    <!-- Header Section -->
    <header class="downloads-header">
      <div class="header-left">
        {#if selectedWork}
          <button
            type="button"
            class="btn-back-breadcrumb"
            onclick={() => handleSelectWork(null)}
          >
            <ArrowLeft size={16} />
            <span>Voltar para todas as obras</span>
          </button>
        {/if}

        <div class="title-with-badge">
          <div class="icon-halo">
            <Download size={22} class="header-icon" />
          </div>
          <div>
            <h1 class="page-title">
              {selectedWork ? selectedWork.workTitle : 'Biblioteca de Downloads'}
            </h1>
            <p class="page-subtitle">
              {selectedWork
                ? `Capítulos baixados desta obra disponíveis para leitura offline`
                : 'Capítulos salvos no seu dispositivo para ler sem internet'}
            </p>
          </div>
        </div>
      </div>

      <!-- Quick Metrics Bar -->
      <div class="header-metrics">
        <div class="metric-pill">
          <Layers size={14} class="metric-icon purple" />
          <span>
            <strong>{totalWorksCount}</strong> {totalWorksCount === 1 ? 'obra' : 'obras'}
          </span>
        </div>

        <div class="metric-pill">
          <Download size={14} class="metric-icon purple" />
          <span>
            <strong>{totalChaptersCount}</strong> {totalChaptersCount === 1 ? 'capítulo' : 'capítulos'}
          </span>
        </div>

        <div class="metric-pill">
          <HardDrive size={14} class="metric-icon gold" />
          <span>
            <strong>{formatStorageBytes(totalStorageBytes)}</strong> usados
          </span>
        </div>

        <div class="metric-pill status-pill" class:is-online={isOnline}>
          {#if isOnline}
            <Wifi size={13} class="status-icon green" />
            <span class="status-text">Conectado</span>
          {:else}
            <WifiOff size={13} class="status-icon amber" />
            <span class="status-text">Modo Offline</span>
          {/if}
        </div>
      </div>
    </header>

    <!-- Main Content Area -->
    {#if loading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Carregando sua biblioteca de capítulos salvos...</p>
      </div>
    {:else if groupedWorks.length === 0}
      <!-- Empty State -->
      <div class="empty-state-card">
        <div class="empty-icon-wrapper">
          <Download size={44} class="empty-icon" />
        </div>
        <h2 class="empty-title">Você ainda não possui capítulos baixados.</h2>
        <p class="empty-description">
          Acesse a página de qualquer obra no Project Nox e clique no botão de download para salvar capítulos no seu dispositivo e ler offline quando não tiver internet.
        </p>
        <div class="empty-actions">
          <a href="/catalogo" class="btn-primary-explore">
            <BookOpen size={16} />
            <span>Explorar Catálogo</span>
          </a>
        </div>
      </div>
    {:else if !selectedWork}
      <!-- 1. GROUPED WORKS GRID VIEW -->
      <div class="section-toolbar">
        <div class="toolbar-info">
          <span class="toolbar-heading">Obras com Capítulos Baixados</span>
          <span class="toolbar-count">({groupedWorks.length})</span>
        </div>
      </div>

      <div class="works-grid">
        {#each groupedWorks as work (work.workId)}
          <div
            class="work-card-interactive"
            onclick={() => handleSelectWork(work.workId)}
            role="button"
            tabindex="0"
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleSelectWork(work.workId);
            }}
          >
            <!-- Work Cover -->
            <div class="work-cover-wrapper">
              <img
                use:fallbackCover
                src={work.coverBlobUrl || resolveCoverUrl(work.coverId, work.workSlug, work.workId, { size: 'thumb' })}
                alt="Capa de {work.workTitle}"
                class="work-cover-img"
                loading="lazy"
                width="160"
                height="220"
              />

              <div class="cover-badge-top">
                {#if work.isFullyDownloaded}
                  <span class="badge-offline-ready">
                    <CheckCircle2 size={11} />
                    <span>Offline</span>
                  </span>
                {:else}
                  <span class="badge-offline-partial">
                    <AlertTriangle size={11} />
                    <span>Parcial</span>
                  </span>
                {/if}
              </div>

              <div class="cover-overlay-hover">
                <span class="hover-view-btn">
                  <span>Ver Capítulos</span>
                  <ChevronRight size={14} />
                </span>
              </div>
            </div>

            <!-- Work Meta -->
            <div class="work-meta">
              <h3 class="work-title" title={work.workTitle}>
                {work.workTitle}
              </h3>

              <div class="work-badges-row">
                <span class="chapters-count-tag">
                  <Download size={12} />
                  <span>{work.chaptersCount} {work.chaptersCount === 1 ? 'capítulo' : 'capítulos'}</span>
                </span>
                <span class="storage-tag">
                  {formatStorageBytes(work.totalStorageBytes)}
                </span>
              </div>

              <div class="work-footer-row">
                <span class="last-download-text">
                  Salvo em {formatShortDate(work.latestDownloadedAt)}
                </span>

                <button
                  type="button"
                  class="btn-icon-trash"
                  title="Remover todos os downloads de {work.workTitle}"
                  aria-label="Remover todos os downloads de {work.workTitle}"
                  onclick={(e) => handlePromptDeleteWork(e, work)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <!-- 2. WORK DETAIL CHAPTERS LIST VIEW -->
      <div class="work-detail-view">
        <!-- Selected Work Banner -->
        <div class="selected-work-hero">
          <div class="hero-cover-container">
            <img
              use:fallbackCover
              src={selectedWork.coverBlobUrl || resolveCoverUrl(selectedWork.coverId, selectedWork.workSlug, selectedWork.workId, { size: 'thumb' })}
              alt="Capa de {selectedWork.workTitle}"
              class="hero-cover-img"
              width="140"
              height="190"
            />
          </div>

          <div class="hero-info">
            <div class="hero-tags-row">
              <span class="badge-offline-ready">
                <CheckCircle2 size={12} />
                <span>Disponível no Dispositivo</span>
              </span>
              <span class="hero-stat-pill">
                {selectedWork.chaptersCount} {selectedWork.chaptersCount === 1 ? 'capítulo baixado' : 'capítulos baixados'}
              </span>
              <span class="hero-stat-pill">
                {formatStorageBytes(selectedWork.totalStorageBytes)} ocupados
              </span>
            </div>

            <h2 class="hero-title">{selectedWork.workTitle}</h2>

            <div class="hero-actions-row">
              {#if selectedWork.workSlug}
                <a
                  href="/obra/{selectedWork.workSlug}"
                  class="btn-secondary-link"
                >
                  <BookOpen size={15} />
                  <span>Página da Obra</span>
                  <ExternalLink size={13} />
                </a>
              {/if}

              <button
                type="button"
                class="btn-danger-outline"
                onclick={(e) => handlePromptDeleteWork(e, selectedWork!)}
              >
                <Trash2 size={15} />
                <span>Remover Todos os Downloads</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Chapters List Toolbar -->
        <div class="chapters-toolbar">
          <div class="chapters-count-info">
            <span class="chapters-list-heading">Capítulos Baixados</span>
            <span class="chapters-list-badge">({sortedChaptersForSelectedWork.length})</span>
          </div>

          <button
            type="button"
            class="btn-sort-toggle"
            onclick={() => (sortOrder = sortOrder === 'asc' ? 'desc' : 'asc')}
            title="Inverter ordem de ordenação"
          >
            <ArrowUpDown size={14} />
            <span>{sortOrder === 'asc' ? 'Ordem Crescente (1 → 100)' : 'Ordem Decrescente (100 → 1)'}</span>
          </button>
        </div>

        <!-- Chapters Table/Cards List -->
        <div class="chapters-list">
          {#each sortedChaptersForSelectedWork as chapter (chapter.chapterId)}
            {@const isComplete = chapter.pages && chapter.pages.length > 0 && chapter.pages.every((p) => !!p.blobUrl)}
            <div class="chapter-row-card">
              <div class="chapter-main-info">
                <div class="chapter-status-indicator" class:complete={isComplete} class:incomplete={!isComplete}>
                  {#if isComplete}
                    <CheckCircle2 size={17} class="status-check" />
                  {:else}
                    <AlertTriangle size={17} class="status-warn" />
                  {/if}
                </div>

                <div class="chapter-text-block">
                  <div class="chapter-title-line">
                    <span class="chapter-number-label">
                      Capítulo {chapter.number}
                    </span>
                    {#if chapter.title}
                      <span class="chapter-sub-title">— {chapter.title}</span>
                    {/if}
                  </div>

                  <div class="chapter-meta-line">
                    <span class="meta-item">{chapter.totalPages} páginas</span>
                    <span class="meta-dot">•</span>
                    <span class="meta-item">{formatStorageBytes(estimateChapterStorageBytes(chapter))}</span>
                    <span class="meta-dot">•</span>
                    <span class="meta-item">Baixado em {formatShortDate(chapter.downloadedAt)}</span>
                  </div>
                </div>
              </div>

              <!-- Chapter Actions -->
              <div class="chapter-actions-group">
                <!-- Direct Offline Reader Button -->
                <button
                  type="button"
                  class="btn-read-offline-mode"
                  title="Abrir no leitor offline independente de conexão"
                  onclick={() => handleOpenOfflineReader(chapter, selectedWork!)}
                >
                  <Eye size={14} />
                  <span>Ler Offline</span>
                </button>

                <!-- Canonical Reader Link (if online) -->
                {#if isOnline}
                  <a
                    href="/ler/{chapter.chapterId}"
                    class="btn-read-online"
                    title="Abrir no leitor completo com comentários e reações"
                  >
                    <BookOpen size={14} />
                    <span>Leitor Completo</span>
                  </a>
                {/if}

                <!-- Delete Single Chapter -->
                <button
                  type="button"
                  class="btn-icon-trash-chapter"
                  title="Remover Capítulo {chapter.number}"
                  aria-label="Remover Capítulo {chapter.number}"
                  onclick={(e) => handlePromptDeleteChapter(e, chapter, selectedWork!.workTitle)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- CONFIRMATION MODAL -->
  {#if confirmModal}
    <div
      class="modal-backdrop"
      onclick={handleCancelDelete}
      role="presentation"
    >
      <div
        class="modal-card"
        onclick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div class="modal-icon-badge danger">
          <Trash2 size={24} />
        </div>

        <h3 id="modal-title" class="modal-title">{confirmModal.title}</h3>
        <p class="modal-message">{confirmModal.message}</p>
        {#if confirmModal.submessage}
          <p class="modal-submessage">{confirmModal.submessage}</p>
        {/if}

        <div class="modal-actions">
          <button
            type="button"
            class="btn-modal-cancel"
            onclick={handleCancelDelete}
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn-modal-confirm-danger"
            onclick={handleConfirmDelete}
          >
            Confirmar Exclusão
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- BUILT-IN OFFLINE READER VIEWER -->
  {#if offlineReaderChapter && offlineReaderWork}
    <div
      class="offline-reader-modal"
      class:is-fullscreen={readerFullscreen}
      role="dialog"
      aria-label="Leitor Offline do Capítulo {offlineReaderChapter.number}"
    >
      <!-- Reader Header Bar -->
      <header class="offline-reader-nav">
        <div class="nav-left">
          <button
            type="button"
            class="btn-reader-back"
            onclick={handleCloseOfflineReader}
          >
            <ArrowLeft size={16} />
            <span>Fechar Leitor</span>
          </button>

          <div class="reader-titles">
            <span class="reader-work-title">{offlineReaderWork.workTitle}</span>
            <span class="reader-chapter-pill">Capítulo {offlineReaderChapter.number}</span>
          </div>
        </div>

        <div class="nav-right">
          <!-- Mode Switcher -->
          <div class="reader-mode-toggle">
            <button
              type="button"
              class="btn-mode"
              class:active={readerMode === 'webtoon'}
              onclick={() => (readerMode = 'webtoon')}
            >
              Webtoon
            </button>
            <button
              type="button"
              class="btn-mode"
              class:active={readerMode === 'paginated'}
              onclick={() => (readerMode = 'paginated')}
            >
              Paginado
            </button>
          </div>

          <!-- Page Indicator (for paginated mode) -->
          {#if readerMode === 'paginated'}
            <div class="page-counter-pill">
              {readerCurrentPage} / {offlineReaderChapter.totalPages}
            </div>
          {/if}

          <!-- Fullscreen Toggle -->
          <button
            type="button"
            class="btn-reader-icon"
            title="Alternar Tela Cheia"
            onclick={toggleReaderFullscreen}
          >
            {#if readerFullscreen}
              <Minimize2 size={16} />
            {:else}
              <Maximize2 size={16} />
            {/if}
          </button>

          <!-- Close Button -->
          <button
            type="button"
            class="btn-reader-icon btn-close-x"
            title="Fechar"
            onclick={handleCloseOfflineReader}
          >
            <X size={18} />
          </button>
        </div>
      </header>

      <!-- Reader Body Content -->
      <div class="offline-reader-body" class:paginated-mode={readerMode === 'paginated'}>
        {#if readerMode === 'webtoon'}
          <!-- Webtoon continuous vertical scroll -->
          <div class="webtoon-stream">
            {#each offlineReaderChapter.pages as pageItem (pageItem.position)}
              <div class="offline-page-item">
                {#if pageItem.blobUrl}
                  <img
                    src={pageItem.blobUrl}
                    alt="Página {pageItem.position}"
                    class="offline-page-img"
                    loading="lazy"
                  />
                {:else}
                  <div class="offline-page-missing">
                    <AlertTriangle size={24} />
                    <span>Página {pageItem.position} indisponível offline</span>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <!-- Paginated single page view -->
          {@const activePage = offlineReaderChapter.pages.find((p) => p.position === readerCurrentPage) || offlineReaderChapter.pages[0]}
          <div class="paginated-view">
            <button
              type="button"
              class="page-nav-zone prev"
              disabled={readerCurrentPage <= 1}
              onclick={() => (readerCurrentPage = Math.max(1, readerCurrentPage - 1))}
              aria-label="Página anterior"
            ></button>

            <div class="single-page-wrapper">
              {#if activePage?.blobUrl}
                <img
                  src={activePage.blobUrl}
                  alt="Página {readerCurrentPage}"
                  class="offline-single-img"
                />
              {:else}
                <div class="offline-page-missing">
                  <AlertTriangle size={28} />
                  <span>Página {readerCurrentPage} indisponível offline</span>
                </div>
              {/if}
            </div>

            <button
              type="button"
              class="page-nav-zone next"
              disabled={readerCurrentPage >= offlineReaderChapter.totalPages}
              onclick={() => (readerCurrentPage = Math.min(offlineReaderChapter!.totalPages, readerCurrentPage + 1))}
              aria-label="Próxima página"
            ></button>
          </div>
        {/if}
      </div>

      <!-- Reader Footer Bar with Adjacent Chapters -->
      <footer class="offline-reader-footer">
        <button
          type="button"
          class="btn-footer-step"
          onclick={handlePrevOfflineChapter}
          disabled={offlineReaderWork.chapters.findIndex((c) => c.chapterId === offlineReaderChapter!.chapterId) <= 0}
        >
          <ArrowLeft size={15} />
          <span>Capítulo Anterior</span>
        </button>

        <span class="footer-center-tag">
          {offlineReaderChapter.totalPages} páginas salvas no dispositivo
        </span>

        <button
          type="button"
          class="btn-footer-step"
          onclick={handleNextOfflineChapter}
          disabled={offlineReaderWork.chapters.findIndex((c) => c.chapterId === offlineReaderChapter!.chapterId) >= offlineReaderWork.chapters.length - 1}
        >
          <span>Próximo Capítulo</span>
          <ChevronRight size={15} />
        </button>
      </footer>
    </div>
  {/if}
</div>

<style>
  /* ----------------------------------------------------
     BASE & LAYOUT
  ---------------------------------------------------- */
  .downloads-page-root {
    min-height: 100vh;
    background: #06070c;
    color: #eceaf1;
    padding-bottom: 80px;
  }

  .downloads-container {
    max-width: 1280px;
    margin: 0 auto;
    padding: 32px 20px 48px;
  }

  /* ----------------------------------------------------
     HEADER
  ---------------------------------------------------- */
  .downloads-header {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  @media (min-width: 860px) {
    .downloads-header {
      flex-direction: row;
      align-items: flex-end;
      justify-content: space-between;
    }
  }

  .header-left {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .btn-back-breadcrumb {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: none;
    color: #b59af5;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    padding: 4px 0;
    transition: color 0.2s ease, transform 0.2s ease;
    align-self: flex-start;
  }

  .btn-back-breadcrumb:hover {
    color: #dfc28d;
    transform: translateX(-3px);
  }

  .title-with-badge {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .icon-halo {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.25), rgba(201, 170, 115, 0.15));
    border: 1px solid rgba(181, 154, 245, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 0 20px rgba(124, 58, 237, 0.25);
  }

  :global(.header-icon) {
    color: #b59af5;
  }

  .page-title {
    font-size: 26px;
    font-weight: 800;
    color: #f2f0f7;
    margin: 0;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  @media (min-width: 640px) {
    .page-title {
      font-size: 30px;
    }
  }

  .page-subtitle {
    font-size: 14px;
    color: #9d99ab;
    margin: 4px 0 0 0;
  }

  /* ----------------------------------------------------
     HEADER METRICS
  ---------------------------------------------------- */
  .header-metrics {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .metric-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 999px;
    background: rgba(13, 16, 26, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 12px;
    color: #c5c2d3;
  }

  .metric-pill strong {
    color: #f2f0f7;
    font-weight: 700;
  }

  :global(.metric-icon.purple) {
    color: #b59af5;
  }

  :global(.metric-icon.gold) {
    color: #dfc28d;
  }

  .status-pill {
    border-color: rgba(255, 255, 255, 0.12);
  }

  .status-pill.is-online {
    background: rgba(16, 185, 129, 0.12);
    border-color: rgba(16, 185, 129, 0.3);
  }

  :global(.status-icon.green) {
    color: #10b981;
  }

  :global(.status-icon.amber) {
    color: #f59e0b;
  }

  .status-text {
    font-weight: 600;
  }

  .is-online .status-text {
    color: #6ee7b7;
  }

  /* ----------------------------------------------------
     EMPTY STATE
  ---------------------------------------------------- */
  .empty-state-card {
    text-align: center;
    padding: 64px 24px;
    border-radius: 20px;
    background: rgba(11, 13, 23, 0.7);
    border: 1px dashed rgba(181, 154, 245, 0.25);
    max-width: 580px;
    margin: 40px auto;
  }

  .empty-icon-wrapper {
    width: 80px;
    height: 80px;
    margin: 0 auto 20px;
    border-radius: 24px;
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(201, 170, 115, 0.1));
    border: 1px solid rgba(181, 154, 245, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 32px rgba(124, 58, 237, 0.2);
  }

  :global(.empty-icon) {
    color: #b59af5;
  }

  .empty-title {
    font-size: 20px;
    font-weight: 750;
    color: #f2f0f7;
    margin: 0 0 10px;
  }

  .empty-description {
    font-size: 14px;
    color: #9d99ab;
    line-height: 1.6;
    margin: 0 0 24px;
  }

  .btn-primary-explore {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border-radius: 12px;
    background: linear-gradient(135deg, #7c3aed, #6d28d9);
    border: 1px solid rgba(181, 154, 245, 0.4);
    color: #ffffff;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(124, 58, 237, 0.4);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .btn-primary-explore:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(124, 58, 237, 0.55);
  }

  /* ----------------------------------------------------
     SECTION TOOLBAR
  ---------------------------------------------------- */
  .section-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .toolbar-info {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .toolbar-heading {
    font-size: 18px;
    font-weight: 750;
    color: #eceaf1;
  }

  .toolbar-count {
    font-size: 14px;
    color: #dfc28d;
    font-weight: 700;
  }

  /* ----------------------------------------------------
     WORKS GRID (MAIN VIEW)
  ---------------------------------------------------- */
  .works-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 20px;
  }

  @media (min-width: 640px) {
    .works-grid {
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 24px;
    }
  }

  @media (min-width: 1024px) {
    .works-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (min-width: 1360px) {
    .works-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .work-card-interactive {
    display: flex;
    flex-direction: column;
    background: rgba(11, 13, 23, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
                border-color 0.25s ease,
                box-shadow 0.25s ease;
    user-select: none;
  }

  .work-card-interactive:hover {
    transform: translateY(-4px);
    border-color: rgba(181, 154, 245, 0.35);
    box-shadow: 0 12px 32px rgba(10, 12, 24, 0.8), 0 0 20px rgba(124, 58, 237, 0.2);
  }

  .work-cover-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: 3 / 4;
    background: #080a12;
    overflow: hidden;
  }

  .work-cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.35s ease;
  }

  .work-card-interactive:hover .work-cover-img {
    transform: scale(1.04);
  }

  .cover-badge-top {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 2;
  }

  .badge-offline-ready {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(6, 78, 59, 0.9);
    border: 1px solid rgba(52, 211, 153, 0.4);
    color: #a7f3d0;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    backdrop-filter: blur(6px);
  }

  .badge-offline-partial {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(120, 53, 15, 0.9);
    border: 1px solid rgba(251, 191, 36, 0.4);
    color: #fde68a;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    backdrop-filter: blur(6px);
  }

  .cover-overlay-hover {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(6, 7, 12, 0.95) 0%, rgba(6, 7, 12, 0.4) 60%, transparent 100%);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 16px;
    opacity: 0;
    transition: opacity 0.25s ease;
    z-index: 3;
  }

  .work-card-interactive:hover .cover-overlay-hover {
    opacity: 1;
  }

  .hover-view-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #b59af5;
    color: #0c091f;
    font-size: 12px;
    font-weight: 750;
    padding: 6px 14px;
    border-radius: 999px;
    box-shadow: 0 4px 12px rgba(181, 154, 245, 0.4);
    transform: translateY(6px);
    transition: transform 0.25s ease;
  }

  .work-card-interactive:hover .hover-view-btn {
    transform: translateY(0);
  }

  .work-meta {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-grow: 1;
  }

  .work-title {
    font-size: 15px;
    font-weight: 750;
    color: #f2f0f7;
    margin: 0;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    min-height: 2.7em;
  }

  .work-badges-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .chapters-count-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 700;
    color: #b59af5;
  }

  .storage-tag {
    font-size: 11px;
    font-weight: 600;
    color: #9d99ab;
    background: rgba(255, 255, 255, 0.05);
    padding: 2px 7px;
    border-radius: 4px;
  }

  .work-footer-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .last-download-text {
    font-size: 11px;
    color: #7d7a8d;
  }

  .btn-icon-trash {
    background: transparent;
    border: none;
    color: #7d7a8d;
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    transition: color 0.2s ease, background 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-icon-trash:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.12);
  }

  /* ----------------------------------------------------
     WORK DETAIL VIEW
  ---------------------------------------------------- */
  .work-detail-view {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .selected-work-hero {
    display: flex;
    flex-direction: column;
    gap: 20px;
    background: rgba(11, 13, 23, 0.85);
    border: 1px solid rgba(181, 154, 245, 0.2);
    border-radius: 20px;
    padding: 20px;
  }

  @media (min-width: 680px) {
    .selected-work-hero {
      flex-direction: row;
      align-items: center;
      padding: 24px 28px;
      gap: 28px;
    }
  }

  .hero-cover-container {
    width: 120px;
    height: 160px;
    border-radius: 12px;
    overflow: hidden;
    flex-shrink: 0;
    border: 1px solid rgba(181, 154, 245, 0.3);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  }

  .hero-cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .hero-info {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex-grow: 1;
  }

  .hero-tags-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .hero-stat-pill {
    font-size: 12px;
    font-weight: 600;
    color: #dfc28d;
    background: rgba(201, 170, 115, 0.1);
    border: 1px solid rgba(201, 170, 115, 0.25);
    padding: 3px 10px;
    border-radius: 999px;
  }

  .hero-title {
    font-size: 24px;
    font-weight: 800;
    color: #f2f0f7;
    margin: 0;
    line-height: 1.25;
  }

  @media (min-width: 680px) {
    .hero-title {
      font-size: 28px;
    }
  }

  .hero-actions-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-top: 4px;
  }

  .btn-secondary-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #eceaf1;
    font-size: 13px;
    font-weight: 600;
    transition: background 0.2s ease, border-color 0.2s ease;
  }

  .btn-secondary-link:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(181, 154, 245, 0.4);
  }

  .btn-danger-outline {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 10px;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease;
  }

  .btn-danger-outline:hover {
    background: rgba(239, 68, 68, 0.18);
    border-color: rgba(239, 68, 68, 0.5);
  }

  /* ----------------------------------------------------
     CHAPTERS TOOLBAR & LIST
  ---------------------------------------------------- */
  .chapters-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12px;
    padding: 4px 0;
  }

  .chapters-count-info {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .chapters-list-heading {
    font-size: 17px;
    font-weight: 750;
    color: #f2f0f7;
  }

  .chapters-list-badge {
    font-size: 14px;
    color: #b59af5;
    font-weight: 700;
  }

  .btn-sort-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(13, 16, 26, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #c5c2d3;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: border-color 0.2s ease, color 0.2s ease;
  }

  .btn-sort-toggle:hover {
    border-color: rgba(181, 154, 245, 0.4);
    color: #f2f0f7;
  }

  .chapters-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .chapter-row-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: rgba(11, 13, 23, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 14px 16px;
    transition: border-color 0.2s ease, background 0.2s ease;
  }

  @media (min-width: 720px) {
    .chapter-row-card {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      padding: 12px 18px;
    }
  }

  .chapter-row-card:hover {
    border-color: rgba(181, 154, 245, 0.3);
    background: rgba(14, 18, 32, 0.9);
  }

  .chapter-main-info {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .chapter-status-indicator {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .chapter-status-indicator.complete {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .chapter-status-indicator.incomplete {
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  :global(.status-check) {
    color: #10b981;
  }

  :global(.status-warn) {
    color: #f59e0b;
  }

  .chapter-text-block {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .chapter-title-line {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .chapter-number-label {
    font-size: 15px;
    font-weight: 750;
    color: #f2f0f7;
  }

  .chapter-sub-title {
    font-size: 13px;
    color: #9d99ab;
  }

  .chapter-meta-line {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #7d7a8d;
  }

  .meta-dot {
    color: #4b4859;
  }

  .chapter-actions-group {
    display: flex;
    align-items: center;
    gap: 8px;
    align-self: flex-end;
  }

  @media (min-width: 720px) {
    .chapter-actions-group {
      align-self: center;
    }
  }

  .btn-read-offline-mode {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 10px;
    background: linear-gradient(135deg, #7c3aed, #6d28d9);
    border: 1px solid rgba(181, 154, 245, 0.4);
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(124, 58, 237, 0.3);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .btn-read-offline-mode:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(124, 58, 237, 0.5);
  }

  .btn-read-online {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #c5c2d3;
    font-size: 12px;
    font-weight: 600;
    transition: background 0.2s ease, color 0.2s ease;
  }

  .btn-read-online:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #f2f0f7;
  }

  .btn-icon-trash-chapter {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid transparent;
    color: #7d7a8d;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .btn-icon-trash-chapter:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.3);
  }

  /* ----------------------------------------------------
     CONFIRMATION MODAL
  ---------------------------------------------------- */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(5, 7, 12, 0.85);
    backdrop-filter: blur(8px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .modal-card {
    background: #0d0f1a;
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: 20px;
    padding: 28px;
    max-width: 440px;
    width: 100%;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8), 0 0 32px rgba(239, 68, 68, 0.15);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .modal-icon-badge.danger {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #ef4444;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-title {
    font-size: 19px;
    font-weight: 800;
    color: #f2f0f7;
    margin: 4px 0 0;
  }

  .modal-message {
    font-size: 14px;
    color: #c5c2d3;
    line-height: 1.5;
    margin: 0;
  }

  .modal-submessage {
    font-size: 12px;
    color: #9d99ab;
    line-height: 1.4;
    margin: 0;
  }

  .modal-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    margin-top: 12px;
  }

  .btn-modal-cancel {
    flex: 1;
    padding: 10px 16px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #eceaf1;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .btn-modal-cancel:hover {
    background: rgba(255, 255, 255, 0.14);
  }

  .btn-modal-confirm-danger {
    flex: 1;
    padding: 10px 16px;
    border-radius: 10px;
    background: #dc2626;
    border: 1px solid rgba(239, 68, 68, 0.6);
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);
    transition: background 0.2s ease, transform 0.2s ease;
  }

  .btn-modal-confirm-danger:hover {
    background: #b91c1c;
    transform: translateY(-1px);
  }

  /* ----------------------------------------------------
     OFFLINE READER VIEWER MODAL
  ---------------------------------------------------- */
  .offline-reader-modal {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: #06070c;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .offline-reader-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 18px;
    background: rgba(11, 13, 23, 0.95);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    z-index: 10;
  }

  .nav-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .btn-reader-back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #eceaf1;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .btn-reader-back:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .reader-titles {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .reader-work-title {
    font-size: 14px;
    font-weight: 750;
    color: #f2f0f7;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (min-width: 640px) {
    .reader-work-title {
      max-width: 380px;
    }
  }

  .reader-chapter-pill {
    font-size: 11px;
    font-weight: 700;
    background: rgba(181, 154, 245, 0.18);
    border: 1px solid rgba(181, 154, 245, 0.35);
    color: #dfc28d;
    padding: 2px 8px;
    border-radius: 6px;
  }

  .nav-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .reader-mode-toggle {
    display: flex;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 2px;
  }

  .btn-mode {
    background: transparent;
    border: none;
    color: #9d99ab;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
  }

  .btn-mode.active {
    background: #7c3aed;
    color: #ffffff;
  }

  .page-counter-pill {
    font-size: 12px;
    font-weight: 700;
    color: #dfc28d;
    background: rgba(201, 170, 115, 0.12);
    border: 1px solid rgba(201, 170, 115, 0.3);
    padding: 3px 8px;
    border-radius: 6px;
  }

  .btn-reader-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #eceaf1;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .btn-reader-icon:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .btn-close-x:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  /* ----------------------------------------------------
     READER CONTENT BODY
  ---------------------------------------------------- */
  .offline-reader-body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
    background: #05060a;
    display: flex;
    justify-content: center;
  }

  .offline-reader-body.paginated-mode {
    overflow: hidden;
    align-items: center;
  }

  .webtoon-stream {
    max-width: 850px;
    width: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    padding-bottom: 40px;
  }

  .offline-page-item {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .offline-page-img {
    width: 100%;
    height: auto;
    display: block;
    user-select: none;
  }

  .offline-page-missing {
    width: 100%;
    min-height: 280px;
    background: rgba(245, 158, 11, 0.08);
    border: 1px dashed rgba(245, 158, 11, 0.4);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: #fde68a;
    font-size: 13px;
    font-weight: 600;
  }

  /* Paginated View */
  .paginated-view {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .page-nav-zone {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 30%;
    background: transparent;
    border: none;
    cursor: pointer;
    z-index: 5;
  }

  .page-nav-zone.prev {
    left: 0;
  }

  .page-nav-zone.next {
    right: 0;
  }

  .single-page-wrapper {
    max-width: 90vw;
    max-height: 85vh;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
  }

  .offline-single-img {
    max-width: 100%;
    max-height: 85vh;
    object-fit: contain;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
    border-radius: 4px;
    user-select: none;
  }

  /* ----------------------------------------------------
     OFFLINE READER FOOTER
  ---------------------------------------------------- */
  .offline-reader-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 18px;
    background: rgba(11, 13, 23, 0.95);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    z-index: 10;
  }

  .btn-footer-step {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #eceaf1;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .btn-footer-step:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .btn-footer-step:not(:disabled):hover {
    background: rgba(181, 154, 245, 0.2);
    border-color: rgba(181, 154, 245, 0.4);
    color: #f2f0f7;
  }

  .footer-center-tag {
    font-size: 11px;
    color: #9d99ab;
  }

  /* ----------------------------------------------------
     TOAST FLOATING
  ---------------------------------------------------- */
  .toast-floating {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9999;
    padding: 12px 20px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
    animation: toastSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .toast-floating.success {
    background: #064e3b;
    border: 1px solid #10b981;
    color: #ecfdf5;
  }

  .toast-floating.info {
    background: #1e1b4b;
    border: 1px solid #818cf8;
    color: #e0e7ff;
  }

  .toast-floating.error {
    background: #7f1d1d;
    border: 1px solid #ef4444;
    color: #fef2f2;
  }

  @keyframes toastSlideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  /* ----------------------------------------------------
     LOADING STATE
  ---------------------------------------------------- */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 80px 20px;
    color: #9d99ab;
    font-size: 14px;
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(181, 154, 245, 0.2);
    border-top-color: #b59af5;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
