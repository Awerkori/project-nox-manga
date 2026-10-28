<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { SvelteSet } from 'svelte/reactivity';
  import {
    ArrowLeft,
    ArrowRight,
    Maximize,
    ChevronUp,
    ChevronDown,
    Sparkles,
    Flag,
    List,
    X,
    BookOpen,
    Download,
    CheckCircle2,
    Loader2,
    Search,
    ChevronLeft,
    Sliders,
    Heart,
    Flame,
    Zap,
    Smile,
    PartyPopper,
    AlertTriangle
  } from '@lucide/svelte';
  import ReaderPage from '$lib/components/ReaderPage.svelte';
  import Comments from '$lib/components/Comments.svelte';
  import ReportModal from '$lib/components/ReportModal.svelte';
  import ReadingProgressBar from '$lib/components/ReadingProgressBar.svelte';
  import ReaderSettingsModal from '$lib/components/ReaderSettingsModal.svelte';
  import { action } from '$lib/actions';
  import { readPreference, savePreference } from '$lib/preferences';
  import {
    saveChapterOffline,
    getOfflineChapter,
    registerDownloadController,
    unregisterDownloadController
  } from '$lib/offline-storage';
  import { chapterIdentityLabel } from '$lib/chapter-identity';
  import {
    loadReaderSettings,
    saveReaderSettings,
    type ReaderSettings
  } from '$lib/reader-settings';
  import type { PageData } from '../../routes/ler/[id]/$types';

  let { data }: { data: PageData } = $props();

  // Settings State
  let readerSettings = $state<ReaderSettings>(loadReaderSettings());
  let showSettingsModal = $state(false);

  // Reader UI State
  let current = $state(1);
  let notice = $state('');
  let fullscreen = $state(false);
  let uiVisible = $state(true);
  let showReportModal = $state(false);
  let showChaptersDrawer = $state(false);
  let chapterFilter = $state('');

  const visible = new SvelteSet<number>();
  let sending = false;
  let maxSeenPage = $state(1);
  let chapterCompleted = $state(false);

  // =========================================================================
  // INTELLIGENT AGGRESSIVE ADAPTIVE PRELOADER (TURBO ENGINE V3)
  // =========================================================================
  let preloadedCount = $state(0);
  let preloadProgressPct = $state(0);
  let turboActive = $state(false);
  let turboFinished = $state(false);
  const preloadedUrls = new SvelteSet<string>();
  let activePreloadWorkers = 0;
  let preloadAbortController: AbortController | null = null;

  function getAdaptiveConcurrency(): number {
    if (typeof window === 'undefined') return 2;
    if (readerSettings.preloadMode === 'eco') return 1;

    const nav = navigator as any;
    const connection = nav?.connection || nav?.mozConnection || nav?.webkitConnection;
    const isSaveData = connection?.saveData;
    const isSlowConn = connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g' || connection?.effectiveType === '3g';
    const isMobile = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)').matches;
    const cores = nav?.hardwareConcurrency || 4;
    const ram = nav?.deviceMemory || 4;

    if (isSaveData || isSlowConn) return 1;
    if (isMobile || cores <= 4 || ram <= 3) return 2;
    if (cores >= 8 && ram >= 6) return 5;
    return 3;
  }

  function startTurboPreloader() {
    if (typeof window === 'undefined' || !data.pages?.length) return;
    preloadAbortController?.abort();
    preloadAbortController = new AbortController();
    const signal = preloadAbortController.signal;

    const isEco = readerSettings.preloadMode === 'eco';
    const maxConcurrency = getAdaptiveConcurrency();

    turboActive = true;
    turboFinished = false;

    // Prioritize pages: current & immediate next first, then entire rest of chapter
    function buildQueue() {
      const q: any[] = [];
      const total = data.pages.length;
      // Current and next 2 pages first
      for (let i = current - 1; i < Math.min(total, current + 2); i++) {
        if (i >= 0 && !preloadedUrls.has(data.pages[i].media_id)) {
          q.push(data.pages[i]);
        }
      }
      // Remaining pages of chapter
      for (let i = 0; i < total; i++) {
        if (!q.includes(data.pages[i]) && !preloadedUrls.has(data.pages[i].media_id)) {
          q.push(data.pages[i]);
        }
      }
      return isEco ? q.slice(0, 3) : q;
    }

    let queue = buildQueue();

    function spawnWorker() {
      if (signal.aborted) return;
      if (queue.length === 0) {
        if (activePreloadWorkers === 0) {
          turboFinished = true;
          preloadProgressPct = 100;
        }
        return;
      }

      const page = queue.shift();
      if (!page || !page.media_id || preloadedUrls.has(page.media_id)) {
        spawnWorker();
        return;
      }

      activePreloadWorkers++;
      const mediaUrl = `/media/${page.media_id}`;

      const finish = () => {
        activePreloadWorkers--;
        preloadedUrls.add(page.media_id);
        preloadedCount = preloadedUrls.size;
        preloadProgressPct = Math.min(100, Math.round((preloadedCount / data.pages.length) * 100));
        spawnWorker();
      };

      const pageIndex = data.pages.indexOf(page);
      const isNearViewport = pageIndex >= current - 1 && pageIndex <= current + 2;

      if (typeof fetch === 'function' && !isNearViewport) {
        fetch(mediaUrl, { signal, priority: 'low' as any })
          .then(finish)
          .catch(finish);
      } else {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          if (isNearViewport && 'decode' in img) {
            img.decode().then(finish).catch(finish);
          } else {
            finish();
          }
        };
        img.onerror = finish;
        img.src = mediaUrl;
      }
    }

    const initialWorkers = Math.min(maxConcurrency, queue.length);
    for (let i = 0; i < initialWorkers; i++) {
      spawnWorker();
    }
  }

  // =========================================================================
  // REINVENTED CHAPTER REACTIONS ("VIBE DO CAPÍTULO")
  // =========================================================================
  const REACTION_CONFIG = [
    { id: 'fire', emoji: '🔥', label: 'Épico', vibe: 'Cenas insanas', color: '#f97316' },
    { id: 'heart', emoji: '❤️', label: 'Amei', vibe: 'Coração quentinho', color: '#ef4444' },
    { id: 'shock', emoji: '😱', label: 'Chocado', vibe: 'Plot twist brutal', color: '#a855f7' },
    { id: 'laugh', emoji: '😂', label: 'Hilário', vibe: 'Morri de rir', color: '#eab308' },
    { id: 'cry', emoji: '😭', label: 'Emocionante', vibe: 'Lágrimas reais', color: '#3b82f6' }
  ];

  let reactionCounts = $state<Record<string, number>>({});
  let userReactions = new SvelteSet<string>();
  let reactionsLoading = $state(false);
  let justReactedEmoji = $state<string | null>(null);

  let totalReactionVotes = $derived(
    Object.values(reactionCounts).reduce((acc, v) => acc + (v || 0), 0)
  );

  function getReactionPercentage(emojiId: string): number {
    if (totalReactionVotes <= 0) return 0;
    return Math.round(((reactionCounts[emojiId] || 0) / totalReactionVotes) * 100);
  }

  async function loadReactions(chapterId: string) {
    if (!chapterId || typeof window === 'undefined') return;
    try {
      const res = await fetch(`/api/chapter-reactions?chapterId=${encodeURIComponent(chapterId)}`);
      if (res.ok) {
        const d = await res.json();
        reactionCounts = d.counts || {};
        userReactions = new SvelteSet(d.userReactions || []);
      }
    } catch {
      // silent fallback
    }
  }

  async function toggleReaction(emoji: string) {
    if (!data.chapter?.id || reactionsLoading || typeof window === 'undefined') return;
    reactionsLoading = true;
    const had = userReactions.has(emoji);
    const newSet = new SvelteSet(userReactions);
    const newCounts = { ...reactionCounts };

    if (had) {
      newSet.delete(emoji);
      newCounts[emoji] = Math.max(0, (newCounts[emoji] || 1) - 1);
    } else {
      newSet.add(emoji);
      newCounts[emoji] = (newCounts[emoji] || 0) + 1;
      justReactedEmoji = emoji;
      setTimeout(() => { justReactedEmoji = null; }, 1000);
    }
    userReactions = newSet;
    reactionCounts = newCounts;

    try {
      const res = await fetch('/api/chapter-reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterId: data.chapter.id, emoji })
      });
      if (res.ok) {
        const d = await res.json();
        reactionCounts = d.counts || {};
        userReactions = new SvelteSet(d.userReactions || []);
      }
    } catch {
      // Keep optimistic state
    } finally {
      reactionsLoading = false;
    }
  }

  // =========================================================================
  // OFFLINE DOWNLOAD HANDLING (RODADA 19 PRESERVED)
  // =========================================================================
  let downloadingOffline = $state(false);
  let isDownloadedOffline = $state(false);
  let downloadController: AbortController | null = null;

  async function handleDownloadChapter() {
    if (downloadingOffline || !data.chapter || !data.pages?.length) return;
    downloadingOffline = true;
    downloadController = new AbortController();
    registerDownloadController(data.chapter.id, downloadController);
    notice = 'Iniciando download do capítulo para leitura offline...';

    try {
      await saveChapterOffline(
        data.chapter,
        data.chapter.works || { title: 'Obra', slug: '' },
        data.pages,
        (loaded, total) => {
          notice = `Baixando para offline: ${loaded}/${total} páginas... (toque para cancelar)`;
        },
        downloadController.signal
      );
      isDownloadedOffline = true;
      notice = '✓ Capítulo salvo com sucesso na sua Biblioteca de Downloads!';
      setTimeout(() => { notice = ''; }, 4000);
    } catch (err: any) {
      if (err?.name === 'AbortError' || downloadController?.signal.aborted) {
        notice = 'Download cancelado.';
      } else {
        notice = err?.message || 'Falha ao salvar capítulo para leitura offline.';
      }
      setTimeout(() => { notice = ''; }, 3500);
    } finally {
      if (data.chapter) unregisterDownloadController(data.chapter.id);
      downloadingOffline = false;
      downloadController = null;
    }
  }

  function handleCancelDownload() {
    if (downloadController) {
      notice = 'Cancelando download...';
      downloadController.abort();
    }
  }

  // =========================================================================
  // CONTROLS VISIBILITY & TIMERS
  // =========================================================================
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  function resetHideTimer() {
    uiVisible = true;
    if (hideTimer) clearTimeout(hideTimer);
    if (!showSettingsModal && !showChaptersDrawer && readerSettings.autoHideControls) {
      hideTimer = setTimeout(() => {
        uiVisible = false;
      }, 2500);
    }
  }

  function toggleUi() {
    if (uiVisible) {
      uiVisible = false;
      if (hideTimer) clearTimeout(hideTimer);
    } else {
      resetHideTimer();
    }
  }

  // =========================================================================
  // READING PROGRESS, COMPLETION & XP
  // =========================================================================
  let xpAwardConfirmed = $state(false);
  let viewRecorded = false;
  let completionClaimInFlight = false;
  let completionAwardAttempted = false;

  function recordViewOnce() {
    if (viewRecorded || data.preview) return;
    viewRecorded = true;
    void action('public', 'view', { work_id: data.chapter.work_id, chapter_id: data.chapter.id });
  }

  async function completeChapter() {
    if (completionClaimInFlight || completionAwardAttempted || data.preview) return;
    completionClaimInFlight = true;
    completionAwardAttempted = true;
    chapterCompleted = true;

    try {
      // 1. Mark reading progress as completed via read_page
      let res = (await action('member', 'read_page', {
        work_id: data.chapter.work_id,
        chapter_id: data.chapter.id,
        page: data.pages.length,
        total_pages: data.pages.length,
        completed: true
      })) as any;

      // 2. If read_page did not award XP (e.g. read session timing requirement), invoke claim_xp
      if (!res?.xp_award?.awarded && res?.xp_award?.reason !== 'already_awarded') {
        const claimRes = (await action('member', 'claim_xp', {
          work_id: data.chapter.work_id,
          chapter_id: data.chapter.id
        })) as any;
        if (claimRes?.xp_award) {
          res = claimRes;
        }
      }

      if (res?.xp_award?.awarded && typeof window !== 'undefined') {
        xpAwardConfirmed = true;
        const amount = res.xp_award.amount || 150;
        const rewardTitle = `Capítulo ${chapterIdentityLabel(data.chapter)} concluído!`;
        window.dispatchEvent(
          new CustomEvent('nox-xp-awarded', {
            detail: {
              amount,
              total_xp: res.xp_award.total_xp,
              title: rewardTitle,
              kind: 'CHAPTER_COMPLETION'
            }
          })
        );
        if (typeof (window as any).__noxTriggerXpReward === 'function') {
          (window as any).__noxTriggerXpReward(amount, rewardTitle);
        }
      } else if (res?.xp_award?.reason === 'already_awarded') {
        xpAwardConfirmed = true;
      }
    } catch {
      // Non-blocking
    } finally {
      completionClaimInFlight = false;
    }
  }

  async function saveProgress(pageNumber: number) {
    if (sending || data.preview) return;
    sending = true;
    try {
      await action('member', 'read_page', {
        work_id: data.chapter.work_id,
        chapter_id: data.chapter.id,
        page: pageNumber,
        total_pages: data.pages.length
      });
    } catch {
      // Non-blocking
    } finally {
      sending = false;
    }
  }

  function handleSeen(page: number, isVis: boolean) {
    if (isVis) {
      visible.add(page);
      if (page > maxSeenPage) maxSeenPage = page;
      recordViewOnce();
    } else {
      visible.delete(page);
    }
    const arr = Array.from(visible).sort((a, b) => a - b);
    if (arr.length) {
      current = arr[0];
      void saveProgress(current);
    }

    if (data.pages?.length && maxSeenPage >= data.pages.length && !chapterCompleted) {
      void completeChapter();
    }
  }

  // =========================================================================
  // PAGINATED NAVIGATION
  // =========================================================================
  function nextPaginatedPage() {
    if (current < data.pages.length) {
      current++;
      handleSeen(current, true);
    } else if (data.next) {
      void completeChapter();
      goto(`/ler/${data.next.id}`);
    }
  }

  function prevPaginatedPage() {
    if (current > 1) {
      current--;
      handleSeen(current, true);
    } else if (data.previous) {
      goto(`/ler/${data.previous.id}`);
    }
  }

  function handleCanvasClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('.settings-sheet') || target.closest('.drawer-panel')) {
      return;
    }

    if (readerSettings.mode === 'paginated') {
      const clickX = e.clientX;
      const screenWidth = window.innerWidth;
      const threshold = screenWidth * 0.3;

      if (readerSettings.pagedDirection === 'rtl') {
        if (clickX < threshold) nextPaginatedPage();
        else if (clickX > screenWidth - threshold) prevPaginatedPage();
        else toggleUi();
      } else {
        if (clickX > screenWidth - threshold) nextPaginatedPage();
        else if (clickX < threshold) prevPaginatedPage();
        else toggleUi();
      }
    } else {
      toggleUi();
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => (fullscreen = true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => (fullscreen = false)).catch(() => {});
    }
  }

  // Sibling chapters search filter
  let filteredSiblings = $derived(
    chapterFilter
      ? (data.siblings || []).filter((s: any) =>
          chapterIdentityLabel(s).toLowerCase().includes(chapterFilter.toLowerCase()) ||
          (s.title || '').toLowerCase().includes(chapterFilter.toLowerCase())
        )
      : data.siblings || []
  );

  onMount(async () => {
    // Check offline status
    const off = await getOfflineChapter(data.chapter.id);
    if (off) isDownloadedOffline = true;

    // Load reactions
    loadReactions(data.chapter.id);

    // Initial Progress
    if (data.progress?.page && data.progress.page > 1) {
      current = Math.min(data.progress.page, data.pages.length);
    }

    // Start Turbo Preloader
    startTurboPreloader();

    // Keydown handler
    const handleKeydown = (e: KeyboardEvent) => {
      if (showSettingsModal || showChaptersDrawer) {
        if (e.key === 'Escape') {
          showSettingsModal = false;
          showChaptersDrawer = false;
        }
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'KeyD') {
        if (readerSettings.mode === 'paginated') {
          readerSettings.pagedDirection === 'rtl' ? prevPaginatedPage() : nextPaginatedPage();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'KeyA') {
        if (readerSettings.mode === 'paginated') {
          readerSettings.pagedDirection === 'rtl' ? nextPaginatedPage() : prevPaginatedPage();
        }
      } else if (e.key === 'KeyM') {
        showSettingsModal = !showSettingsModal;
      }
    };
    window.addEventListener('keydown', handleKeydown);

    return () => {
      window.removeEventListener('keydown', handleKeydown);
      preloadAbortController?.abort();
      if (hideTimer) clearTimeout(hideTimer);
    };
  });
</script>

<svelte:window
  onscroll={() => {
    if (readerSettings.autoHideControls && uiVisible && !showSettingsModal && !showChaptersDrawer) {
      resetHideTimer();
    }
  }}
/>

<svelte:head>
  <title>{data.chapter.works?.title} — Capítulo {chapterIdentityLabel(data.chapter)} | Project Nox</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="reader-viewport theme-{readerSettings.theme}"
  class:is-paginated={readerSettings.mode === 'paginated'}
  onclick={handleCanvasClick}
  role="region"
  aria-label="Leitor de Capítulos Project Nox"
>
  <!-- ======================================================================= -->
  <!-- 1. RECONSTRUCTED PREMIER GLASS HEADER                                   -->
  <!-- ======================================================================= -->
  <header
    class="reader-glass-header"
    class:ui-hidden={!uiVisible && !showSettingsModal && !showChaptersDrawer}
    role="banner"
  >
    <!-- Left: Back to Work & Work Meta -->
    <div class="header-left-col">
      <a
        href={data.preview ? `/admin/obras/${data.chapter.work_id}` : (data.chapter.works?.slug ? `/obra/${data.chapter.works.slug}` : `/obra/${data.chapter.work_id}`)}
        class="btn-glass-back"
        aria-label="Voltar para a obra"
        title="Voltar para a obra"
      >
        <ChevronLeft size={20} />
        <span class="btn-back-text">Voltar</span>
      </a>

      <div class="header-work-info">
        <a
          href={data.preview ? `/admin/obras/${data.chapter.work_id}` : (data.chapter.works?.slug ? `/obra/${data.chapter.works.slug}` : `/obra/${data.chapter.work_id}`)}
          class="header-work-title-link"
          title={data.chapter.works?.title}
        >
          <span class="header-work-title">{data.chapter.works?.title}</span>
        </a>
        <div class="header-sub-meta">
          <span class="header-chapter-badge">Capítulo {chapterIdentityLabel(data.chapter)}</span>
          {#if data.preview}
            <span class="preview-tag">Prévia</span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Center: Chapter Navigation Quick Shortcuts, Page Counter & Turbo Status -->
    <div class="header-center-col">
      <!-- Chapter Switching Controls -->
      <div class="chapter-nav-cluster">
        {#if data.previous}
          <a
            href="/ler/{data.previous.id}"
            class="chapter-quick-btn prev"
            title="Capítulo Anterior ({chapterIdentityLabel(data.previous)})"
            aria-label="Capítulo Anterior"
          >
            <ChevronLeft size={16} />
          </a>
        {:else}
          <span class="chapter-quick-btn prev disabled" aria-disabled="true" title="Primeiro capítulo">
            <ChevronLeft size={16} />
          </span>
        {/if}

        <button
          type="button"
          class="chapter-selector-pill"
          onclick={() => { showChaptersDrawer = true; uiVisible = true; }}
          title="Ver todos os capítulos desta obra"
          aria-label="Selecionar capítulo"
        >
          <List size={13} class="text-purple-400 shrink-0" />
          <span class="chapter-selector-label">Cap. {chapterIdentityLabel(data.chapter)}</span>
          <ChevronDown size={13} class="opacity-60 shrink-0" />
        </button>

        {#if data.next}
          <a
            href="/ler/{data.next.id}"
            class="chapter-quick-btn next"
            title="Próximo Capítulo ({chapterIdentityLabel(data.next)})"
            aria-label="Próximo Capítulo"
          >
            <ChevronRight size={16} />
          </a>
        {:else}
          <span class="chapter-quick-btn next disabled" aria-disabled="true" title="Último capítulo lançado">
            <ChevronRight size={16} />
          </span>
        {/if}
      </div>

      <div class="header-meta-divider"></div>

      <!-- Page Counter & Turbo Badge -->
      <div class="reading-meta-cluster">
        <div class="page-counter-pill" title="Página atual / Total">
          <BookOpen size={12} class="text-slate-400 mr-1.5" />
          <span class="current-page-num">{current}</span>
          <span class="page-sep">/</span>
          <span class="total-pages-num">{data.pages.length}</span>
        </div>

        {#if turboActive}
          <div
            class="turbo-status-pill"
            class:complete={turboFinished}
            title={turboFinished ? 'Turbo Inteligente ativo: todas as páginas estão em cache para leitura imediata' : 'Turbo em andamento: baixando todas as páginas antecipadamente'}
          >
            <Zap size={12} class="zap-icon" />
            {#if turboFinished}
              <span class="turbo-text">Turbo Pronto</span>
            {:else}
              <span class="turbo-text">Turbo {preloadedCount}/{data.pages.length}</span>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <!-- Right: Drawer, Offline Download, Settings, Fullscreen -->
    <div class="header-right-col">
      <!-- Chapter Drawer Button -->
      {#if data.siblings && data.siblings.length > 1}
        <button
          type="button"
          class="header-action-btn btn-drawer"
          aria-label="Lista de capítulos"
          title="Ver todos os capítulos ({data.siblings.length})"
          onclick={() => {
            showChaptersDrawer = true;
            uiVisible = true;
          }}
        >
          <List size={18} />
          <span class="action-btn-text">Capítulos</span>
        </button>
      {/if}

      <!-- Offline Download Button -->
      <button
        type="button"
        class="header-action-btn btn-offline"
        class:downloaded={isDownloadedOffline}
        class:loading={downloadingOffline}
        aria-label={isDownloadedOffline ? 'Capítulo salvo offline' : 'Baixar capítulo'}
        title={isDownloadedOffline ? 'Capítulo salvo offline' : 'Baixar capítulo para ler sem internet'}
        onclick={downloadingOffline ? handleCancelDownload : handleDownloadChapter}
      >
        {#if downloadingOffline}
          <Loader2 size={18} class="spin-anim" />
        {:else if isDownloadedOffline}
          <CheckCircle2 size={18} class="text-emerald-400" />
        {:else}
          <Download size={18} />
        {/if}
        <span class="action-btn-text">{isDownloadedOffline ? 'Salvo' : 'Baixar'}</span>
      </button>

      <!-- Settings Button -->
      <button
        type="button"
        class="header-action-btn btn-settings"
        class:active={showSettingsModal}
        aria-label="Ajustes de leitura"
        title="Ajustes de leitura e preferências"
        onclick={() => {
          showSettingsModal = !showSettingsModal;
          resetHideTimer();
        }}
      >
        <Sliders size={18} />
        <span class="action-btn-text">Ajustes</span>
      </button>

      <!-- Fullscreen Button -->
      {#if fullscreen}
        <button
          type="button"
          class="header-action-btn btn-fullscreen"
          aria-label="Alternar tela cheia"
          title="Alternar tela cheia"
          onclick={toggleFullscreen}
        >
          <Maximize size={18} />
        </button>
      {/if}
    </div>
  </header>

  <!-- Notice Banner Toast -->
  {#if notice}
    <div class="notice-toast" role="status">
      <span>{notice}</span>
    </div>
  {/if}

  <!-- ======================================================================= -->
  <!-- 2. NOX READING PROGRESS BAR (DISABLED BY DEFAULT)                       -->
  <!-- ======================================================================= -->
  {#if readerSettings.progressPosition !== 'off'}
    <ReadingProgressBar
      mode={readerSettings.mode}
      currentPage={current}
      totalPages={data.pages.length}
      position={readerSettings.progressPosition}
      display={readerSettings.progressDisplay}
      uiVisible={uiVisible}
      onPageJump={(p) => {
        current = p;
        if (readerSettings.mode === 'webtoon') {
          const el = document.getElementById(`pagina-${p}`);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }
      }}
    />
  {/if}

  <!-- ======================================================================= -->
  <!-- 3. READING CANVAS (WEBTOON & PAGINATED)                                -->
  <!-- ======================================================================= -->
  <main class="reading-canvas">
    {#if readerSettings.mode === 'webtoon'}
      <!-- MODE 1: WEBTOON CASCATA VERTICAL -->
      <div
        class="webtoon-stack"
        class:has-gap={readerSettings.gap}
        style={readerSettings.fit === 'full' ? 'max-width: 100%;' : `max-width: ${readerSettings.width}px;`}
      >
        {#each data.pages as page, index (page.position)}
          <ReaderPage
            {page}
            onSeen={handleSeen}
            eager={index < 2}
          />
        {/each}
      </div>
    {:else}
      <!-- MODE 2: MODO PAGINADO -->
      <div
        class="paginated-stage"
        style={readerSettings.fit === 'full' ? 'max-width: 100%;' : `max-width: ${readerSettings.width}px;`}
      >
        {#if data.pages[current - 1]}
          <div class="paginated-page-wrap">
            <ReaderPage
              page={data.pages[current - 1]}
              onSeen={handleSeen}
              eager={true}
            />
          </div>
        {/if}

        <!-- Paged Controls Navigation Overlay -->
        <div class="paginated-nav-overlay" class:ui-hidden={!uiVisible}>
          <button
            type="button"
            class="paginated-arrow-btn left"
            onclick={(e) => { e.stopPropagation(); readerSettings.pagedDirection === 'rtl' ? nextPaginatedPage() : prevPaginatedPage(); }}
            aria-label="Página anterior"
          >
            <ChevronLeft size={28} />
          </button>
          <button
            type="button"
            class="paginated-arrow-btn right"
            onclick={(e) => { e.stopPropagation(); readerSettings.pagedDirection === 'rtl' ? prevPaginatedPage() : nextPaginatedPage(); }}
            aria-label="Próxima página"
          >
            <ChevronRight size={28} />
          </button>
        </div>
      </div>
    {/if}
  </main>

  <!-- ======================================================================= -->
  <!-- 4. RECONSTRUCTED COMPACT END OF CHAPTER EXPERIENCE                      -->
  <!-- ======================================================================= -->
  <section
    class="reader-conclusion-section"
    id="chapter-end"
    style={readerSettings.fit === 'full' ? 'max-width: 100%;' : `max-width: ${readerSettings.width}px;`}
  >
    <!-- UNIFIED NEXT CHAPTER HERO (COMPACT & DIRECT) -->
    <div class="compact-completion-card">
      <div class="completion-eyebrow">
        <span class="conclusion-badge">Fim do Capítulo {chapterIdentityLabel(data.chapter)}</span>
        {#if data.chapter.works?.title}
          <span class="work-dot">·</span>
          <span class="work-label">{data.chapter.works.title}</span>
        {/if}
      </div>

      {#if data.next}
        <div class="next-chapter-core">
          <div class="next-info">
            <span class="next-tag">A SEGUIR</span>
            <h2 class="next-title">Capítulo {chapterIdentityLabel(data.next)}</h2>
          </div>
          <a
            class="btn-primary-next"
            href="/ler/{data.next.id}"
            onclick={() => void completeChapter()}
          >
            <span>Ler Próximo Capítulo</span>
            <ArrowRight size={17} class="arrow-bounce" />
          </a>
        </div>
      {:else}
        <div class="caught-up-compact">
          <PartyPopper size={22} class="text-amber-400 shrink-0" />
          <div>
            <strong>Você está em dia com a obra!</strong>
            <p>Este é o capítulo mais recente lançado. Novos capítulos serão lançados em breve.</p>
          </div>
        </div>
      {/if}

      <!-- DISCREET SECONDARY NAVIGATION BAR -->
      <nav class="secondary-nav-row" aria-label="Navegação secundária">
        {#if data.previous}
          <a class="nav-sub-btn" href="/ler/{data.previous.id}">
            <ArrowLeft size={14} />
            <span>Capítulo Anterior</span>
          </a>
        {/if}

        {#if data.siblings && data.siblings.length > 1}
          <button
            type="button"
            class="nav-sub-btn"
            onclick={() => { showChaptersDrawer = true; uiVisible = true; }}
          >
            <List size={14} />
            <span>Capítulos ({data.siblings.length})</span>
          </button>
        {/if}

        <a
          class="nav-sub-btn"
          href={data.preview ? `/admin/obras/${data.chapter.work_id}` : (data.chapter.works?.slug ? `/obra/${data.chapter.works.slug}` : `/obra/${data.chapter.work_id}`)}
        >
          <BookOpen size={14} />
          <span>Sobre a Obra</span>
        </a>
      </nav>
    </div>

    <!-- 1. BALANCED SENTIMENT REACTIONS DOCK (ZERO GAPS ON MOBILE) -->
    <div class="reactions-dock-card">
      <div class="reactions-dock-header">
        <span class="reactions-badge">REAÇÃO DOS LEITORES</span>
        <h3 class="reactions-title">Qual foi a vibe da leitura?</h3>
      </div>

      <!-- Balanced Capsules Flex Container: 5 items cleanly centered on mobile without orphan slots -->
      <div class="reactions-capsules-wrap">
        {#each REACTION_CONFIG as item (item.id)}
          {@const isActive = userReactions.has(item.id)}
          {@const count = reactionCounts[item.id] || 0}
          <button
            type="button"
            class="reaction-capsule"
            class:active={isActive}
            class:pop-anim={justReactedEmoji === item.id}
            onclick={() => toggleReaction(item.id)}
            style="--vibe-accent: {item.color};"
            aria-label={`${item.label} (${count} votos)`}
          >
            <span class="reaction-emoji">{item.emoji}</span>
            <span class="reaction-name">{item.label}</span>
            <span class="reaction-count" class:has-votes={count > 0}>{count}</span>
          </button>
        {/each}
      </div>

      <!-- Collective Sentiment Spectrum Bar -->
      {#if totalReactionVotes > 0}
        <div class="spectrum-bar-wrap">
          <div class="spectrum-track">
            {#each REACTION_CONFIG as item}
              {@const pct = getReactionPercentage(item.id)}
              {#if pct > 0}
                <div
                  class="spectrum-slice"
                  style="width: {pct}%; background-color: {item.color};"
                  title="{item.label}: {pct}% ({reactionCounts[item.id]} votos)"
                ></div>
              {/if}
            {/each}
          </div>
          <span class="spectrum-count-label">Sentimento coletivo de {totalReactionVotes} leitores</span>
        </div>
      {/if}
    </div>

    <!-- 2. HIGH-VISIBILITY COMPACT RED REPORT CARD (BELOW REACTIONS) -->
    <div class="report-problem-card">
      <div class="report-card-inner">
        <div class="report-left">
          <div class="report-alert-icon">
            <AlertTriangle size={18} class="text-rose-400" />
          </div>
          <div class="report-text">
            <h4>Encontrou algum problema nas páginas?</h4>
            <p>Páginas cortadas, em branco, fora de ordem ou erro de tradução.</p>
          </div>
        </div>
        <button
          type="button"
          class="btn-report-red"
          onclick={() => (showReportModal = true)}
        >
          <Flag size={13} />
          <span>Reportar Problema</span>
        </button>
      </div>
    </div>

    <!-- COMMENTS SECTION INTEGRATION -->
    <div class="reader-comments-wrap">
      {#if !data.preview}
        <Comments
          comments={data.comments}
          workId={data.chapter.work_id}
          chapterId={data.chapter.id}
          profile={data.profile}
        />
      {/if}
    </div>
  </section>

  <!-- ======================================================================= -->
  <!-- 5. CHAPTERS DRAWER (SLIDE-OVER QUICK PICKER)                            -->
  <!-- ======================================================================= -->
  {#if showChaptersDrawer}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="drawer-backdrop"
      onclick={() => (showChaptersDrawer = false)}
      role="button"
      tabindex="0"
      aria-label="Fechar lista de capítulos"
    ></div>

    <aside class="chapters-drawer-panel" role="dialog" aria-modal="true" aria-label="Todos os Capítulos">
      <div class="drawer-header">
        <div class="drawer-title-group">
          <List size={18} class="text-purple-400" />
          <h3>Todos os Capítulos ({data.siblings.length})</h3>
        </div>
        <button
          type="button"
          class="btn-close-drawer"
          onclick={() => (showChaptersDrawer = false)}
          aria-label="Fechar"
        >
          <X size={18} />
        </button>
      </div>

      <div class="drawer-search-bar">
        <Search size={15} class="search-icon" />
        <input
          type="text"
          placeholder="Buscar capítulo..."
          bind:value={chapterFilter}
          class="search-input"
        />
      </div>

      <div class="drawer-chapters-list">
        {#each filteredSiblings as sibling}
          {@const isCurrent = sibling.id === data.chapter.id}
          <a
            href="/ler/{sibling.id}"
            class="drawer-chapter-item"
            class:active={isCurrent}
            onclick={() => (showChaptersDrawer = false)}
          >
            <div class="chapter-item-meta">
              <strong class="chapter-item-num">Capítulo {chapterIdentityLabel(sibling)}</strong>
              {#if sibling.title}
                <span class="chapter-item-title">{sibling.title}</span>
              {/if}
            </div>
            {#if isCurrent}
              <span class="badge-reading">Lendo</span>
            {/if}
          </a>
        {/each}
      </div>
    </aside>
  {/if}

  <!-- ======================================================================= -->
  <!-- 6. READER SETTINGS MODAL / SHEET                                        -->
  <!-- ======================================================================= -->
  {#if showSettingsModal}
    <ReaderSettingsModal
      settings={readerSettings}
      totalPages={data.pages.length}
      currentPage={current}
      onClose={() => (showSettingsModal = false)}
      onUpdate={(s) => {
        readerSettings = s;
        saveReaderSettings(s);
      }}
      onJumpPage={(p) => {
        current = p;
        if (readerSettings.mode === 'webtoon') {
          const el = document.getElementById(`pagina-${p}`);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }
      }}
    />
  {/if}

  <!-- REPORT PROBLEM MODAL -->
  {#if showReportModal}
    <ReportModal
      workId={data.chapter.work_id}
      chapterId={data.chapter.id}
      page={current}
      onclose={() => (showReportModal = false)}
    />
  {/if}
</div>

<style>
  /* ==========================================================================
     PROJECT NOX — SIGNATURE READER EXPERIENCE (RECONSTRUCTED)
     ========================================================================== */

  .reader-viewport {
    min-height: 100vh;
    width: 100%;
    position: relative;
    user-select: none;
    -webkit-user-select: none;
    transition: background-color 0.3s ease;
    overflow-x: hidden;
  }

  /* Themes */
  .reader-viewport.theme-dark {
    background-color: #06070c;
    color: #e2e8f0;
  }

  .reader-viewport.theme-oled {
    background-color: #000000;
    color: #e2e8f0;
  }

  .reader-viewport.theme-sepia {
    background-color: #1c1917;
    color: #fef3c7;
  }

  /* --------------------------------------------------------------------------
     1. PREMIER GLASS HEADER
     -------------------------------------------------------------------------- */
  .reader-glass-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 62px;
    background: rgba(7, 8, 14, 0.88);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.09);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.55);
    z-index: 80;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    padding-top: env(safe-area-inset-top, 0px);
    transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
  }

  .reader-glass-header.ui-hidden {
    transform: translateY(-100%);
    opacity: 0;
    pointer-events: none;
  }

  /* Left: Brand / Work Info */
  .header-left-col {
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 32%;
    overflow: hidden;
  }

  .btn-glass-back {
    height: 40px;
    padding: 0 12px 0 8px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.09);
    color: #ffffff;
    display: flex;
    align-items: center;
    gap: 6px;
    text-decoration: none;
    flex-shrink: 0;
    transition: all 0.2s ease;
  }

  .btn-glass-back:hover {
    background: rgba(168, 85, 247, 0.2);
    border-color: rgba(168, 85, 247, 0.4);
    transform: translateX(-1px);
  }

  .btn-back-text {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .header-work-info {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .header-work-title-link {
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-work-title {
    font-size: 13.5px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.01em;
    transition: color 0.18s ease;
  }

  .header-work-title-link:hover .header-work-title {
    color: #c084fc;
  }

  .header-sub-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 1px;
  }

  .header-chapter-badge {
    font-size: 11px;
    font-weight: 600;
    color: #c084fc;
  }

  .preview-tag {
    font-size: 9px;
    font-weight: 800;
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.15);
    padding: 1px 5px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* Center: Navigation Shortcuts + Reading Meta */
  .header-center-col {
    display: flex;
    align-items: center;
    gap: 14px;
    justify-content: center;
    flex: 1;
    max-width: 44%;
  }

  .chapter-nav-cluster {
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 3px;
    gap: 2px;
  }

  .chapter-quick-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #cbd5e1;
    text-decoration: none;
    transition: all 0.18s ease;
  }

  .chapter-quick-btn:hover:not(.disabled) {
    background: rgba(168, 85, 247, 0.2);
    color: #ffffff;
  }

  .chapter-quick-btn.disabled {
    opacity: 0.25;
    pointer-events: none;
  }

  .chapter-selector-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 10px;
    height: 32px;
    border: none;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 7px;
    color: #f1f5f9;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .chapter-selector-pill:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .header-meta-divider {
    width: 1px;
    height: 24px;
    background: rgba(255, 255, 255, 0.1);
  }

  .reading-meta-cluster {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .page-counter-pill {
    display: flex;
    align-items: center;
    padding: 5px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 9999px;
    font-size: 11.5px;
    font-weight: 700;
    color: #f1f5f9;
    letter-spacing: 0.02em;
    font-variant-numeric: tabular-nums;
  }

  .page-slash {
    margin: 0 3px;
    color: #64748b;
  }

  .total-pages-num {
    color: #94a3b8;
  }

  .turbo-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 9999px;
    font-size: 10.5px;
    font-weight: 700;
    color: #f59e0b;
    letter-spacing: 0.02em;
  }

  .turbo-status-pill.complete {
    background: rgba(16, 185, 129, 0.12);
    border-color: rgba(16, 185, 129, 0.35);
    color: #34d399;
  }

  .zap-icon {
    color: currentColor;
  }

  /* Right: Actions */
  .header-right-col {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: flex-end;
    max-width: 32%;
  }

  .header-action-btn {
    height: 40px;
    padding: 0 12px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.09);
    color: #cbd5e1;
    display: flex;
    align-items: center;
    gap: 7px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .header-action-btn:hover {
    background: rgba(255, 255, 255, 0.09);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.16);
  }

  .action-btn-text {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .header-action-btn.btn-settings.active,
  .header-action-btn.btn-settings:hover {
    background: rgba(168, 85, 247, 0.18);
    border-color: rgba(168, 85, 247, 0.4);
    color: #d8b4fe;
  }

  .header-action-btn.downloaded {
    border-color: rgba(16, 185, 129, 0.4);
    color: #34d399;
  }

  .header-action-btn.btn-fullscreen {
    padding: 0;
    width: 40px;
    justify-content: center;
  }

  .spin-anim {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Responsive header */
  @media (max-width: 900px) {
    .btn-back-text,
    .action-btn-text,
    .header-meta-divider {
      display: none;
    }

    .btn-glass-back,
    .header-action-btn {
      padding: 0;
      width: 40px;
      justify-content: center;
    }

    .header-center-col {
      gap: 8px;
    }
  }

  @media (max-width: 640px) {
    .reader-glass-header {
      height: 58px;
      padding: 0 12px;
    }

    .header-left-col {
      max-width: 42%;
      gap: 8px;
    }

    .header-work-title {
      font-size: 12px;
    }

    .chapter-nav-cluster {
      display: none;
    }

    .turbo-status-pill .turbo-text {
      display: none;
    }

    .turbo-status-pill {
      padding: 5px;
    }
  }

  /* --------------------------------------------------------------------------
     2. READING CANVAS
     -------------------------------------------------------------------------- */
  .reading-canvas {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 56px;
    min-height: calc(100vh - 56px);
  }

  .webtoon-stack {
    width: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    transition: max-width 0.2s ease;
  }

  .webtoon-stack.has-gap {
    gap: 12px;
  }

  /* Paginated Stage */
  .paginated-stage {
    width: 100%;
    margin: 0 auto;
    min-height: calc(100vh - 56px);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .paginated-page-wrap {
    width: 100%;
  }

  .paginated-nav-overlay {
    position: fixed;
    inset: 56px 0 0 0;
    pointer-events: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 16px;
    transition: opacity 0.25s ease;
  }

  .paginated-nav-overlay.ui-hidden {
    opacity: 0;
  }

  .paginated-arrow-btn {
    pointer-events: auto;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(6, 7, 12, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    transition: all 0.2s ease;
  }

  .paginated-arrow-btn:hover {
    background: rgba(168, 85, 247, 0.4);
    border-color: #a855f7;
    transform: scale(1.1);
  }

  /* --------------------------------------------------------------------------
     3. COMPACT RECONSTRUCTED CONCLUSION SECTION
     -------------------------------------------------------------------------- */
  .reader-conclusion-section {
    width: 100%;
    margin: 36px auto 0 auto;
    padding: 0 16px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 20px;
    transition: max-width 0.2s ease;
  }

  /* Compact Next Chapter Hero Card */
  .compact-completion-card {
    position: relative;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(147, 51, 234, 0.08) 0%, rgba(13, 10, 20, 0.95) 100%);
    border: 1px solid rgba(168, 85, 247, 0.28);
    padding: 18px 20px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .completion-eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 12px;
  }

  .conclusion-badge {
    font-size: 11px;
    font-weight: 700;
    color: #c084fc;
    background: rgba(168, 85, 247, 0.15);
    padding: 2px 8px;
    border-radius: 6px;
  }

  .work-dot {
    color: #64748b;
  }

  .work-label {
    color: #94a3b8;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 260px;
  }

  .next-chapter-core {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 6px 0 14px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .next-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .next-tag {
    font-size: 10px;
    font-weight: 800;
    color: #fbbf24;
    letter-spacing: 0.06em;
  }

  .next-title {
    font-size: 20px;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
  }

  .btn-primary-next {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 11px 22px;
    border-radius: 9999px;
    background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
    color: #ffffff;
    font-size: 14px;
    font-weight: 800;
    text-decoration: none;
    box-shadow: 0 4px 16px rgba(168, 85, 247, 0.4);
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .btn-primary-next:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(168, 85, 247, 0.7);
  }

  .arrow-bounce {
    animation: bounceRight 1.5s ease-in-out infinite;
  }

  @keyframes bounceRight {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(4px); }
  }

  .caught-up-compact {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 14px;
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 10px;
  }

  .caught-up-compact strong {
    display: block;
    font-size: 14px;
    color: #ffffff;
  }

  .caught-up-compact p {
    font-size: 12px;
    color: #94a3b8;
    margin: 2px 0 0 0;
  }

  .secondary-nav-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .nav-sub-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 9999px;
    color: #cbd5e1;
    font-size: 11.5px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .nav-sub-btn:hover {
    background: rgba(168, 85, 247, 0.12);
    border-color: rgba(168, 85, 247, 0.35);
    color: #ffffff;
  }

  /* --------------------------------------------------------------------------
     BALANCED SENTIMENT REACTIONS DOCK
     -------------------------------------------------------------------------- */
  .reactions-dock-card {
    background: #090a12;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .reactions-dock-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .reactions-badge {
    font-size: 9.5px;
    font-weight: 800;
    color: #a855f7;
    letter-spacing: 0.08em;
  }

  .reactions-title {
    font-size: 15px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .reactions-capsules-wrap {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }

  .reaction-capsule {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 9999px;
    color: #cbd5e1;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .reaction-capsule:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #ffffff;
    transform: translateY(-1px);
  }

  .reaction-capsule.active {
    background: rgba(168, 85, 247, 0.15);
    border-color: var(--vibe-accent, #a855f7);
    color: #ffffff;
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.25);
  }

  .reaction-capsule.pop-anim {
    animation: pulsePop 0.35s ease;
  }

  @keyframes pulsePop {
    0% { transform: scale(1); }
    50% { transform: scale(1.12); }
    100% { transform: scale(1); }
  }

  .reaction-emoji {
    font-size: 16px;
    line-height: 1;
  }

  .reaction-name {
    font-size: 12px;
    font-weight: 700;
  }

  .reaction-count {
    font-size: 10.5px;
    font-weight: 700;
    color: #64748b;
    padding-left: 2px;
  }

  .reaction-count.has-votes {
    color: #c084fc;
  }

  .spectrum-bar-wrap {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 4px;
  }

  .spectrum-track {
    flex: 1;
    height: 6px;
    border-radius: 9999px;
    overflow: hidden;
    display: flex;
    background: rgba(255, 255, 255, 0.05);
  }

  .spectrum-slice {
    height: 100%;
    transition: width 0.3s ease;
  }

  .spectrum-count-label {
    font-size: 10.5px;
    color: #64748b;
    white-space: nowrap;
  }

  /* --------------------------------------------------------------------------
     HIGH-VISIBILITY COMPACT RED REPORT CARD
     -------------------------------------------------------------------------- */
  .report-problem-card {
    background: rgba(220, 38, 38, 0.09);
    border: 1px solid rgba(239, 68, 68, 0.35);
    border-radius: 12px;
    padding: 12px 16px;
    box-shadow: 0 4px 14px rgba(220, 38, 38, 0.08);
  }

  .report-card-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
  }

  .report-left {
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 65%;
  }

  .report-alert-icon {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .report-text h4 {
    margin: 0 0 1px 0;
    font-size: 13px;
    font-weight: 700;
    color: #fca5a5;
  }

  .report-text p {
    margin: 0;
    font-size: 11px;
    color: #94a3b8;
    line-height: 1.3;
  }

  .btn-report-red {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 7px;
    background: rgba(239, 68, 68, 0.18);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #fecaca;
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-report-red:hover {
    background: #ef4444;
    color: #ffffff;
    box-shadow: 0 0 12px rgba(239, 68, 68, 0.45);
  }

  /* --------------------------------------------------------------------------
     CHAPTERS DRAWER
     -------------------------------------------------------------------------- */
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 90;
  }

  .chapters-drawer-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(380px, 90vw);
    background: #090b14;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    z-index: 95;
    display: flex;
    flex-direction: column;
    animation: drawerIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes drawerIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .drawer-title-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .drawer-title-group h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: #ffffff;
  }

  .btn-close-drawer {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
  }

  .drawer-search-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .search-icon {
    color: #64748b;
  }

  .search-input {
    background: transparent;
    border: none;
    color: #ffffff;
    font-size: 13px;
    width: 100%;
    outline: none;
  }

  .drawer-chapters-list {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .drawer-chapter-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-radius: 8px;
    color: #cbd5e1;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .drawer-chapter-item:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #ffffff;
  }

  .drawer-chapter-item.active {
    background: rgba(168, 85, 247, 0.18);
    border: 1px solid rgba(168, 85, 247, 0.35);
    color: #d8b4fe;
  }

  .badge-reading {
    font-size: 10px;
    font-weight: 800;
    color: #a855f7;
    background: rgba(168, 85, 247, 0.2);
    padding: 2px 6px;
    border-radius: 4px;
  }

  /* Notice Toast */
  .notice-toast {
    position: fixed;
    top: 68px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(14, 11, 22, 0.95);
    border: 1px solid rgba(168, 85, 247, 0.4);
    color: #f1f5f9;
    padding: 8px 18px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 600;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
    z-index: 100;
  }

  /* Mobile responsiveness */
  @media (max-width: 640px) {
    .reader-glass-header {
      height: 48px;
      padding: 0 10px;
    }

    .header-left-col {
      max-width: 50%;
      gap: 8px;
    }

    .header-work-title {
      font-size: 12px;
    }

    .page-counter-pill {
      font-size: 10px;
      padding: 4px 8px;
    }

    .turbo-status-pill {
      display: none;
    }

    .btn-glass-back,
    .header-action-btn {
      width: 32px;
      height: 32px;
    }

    .btn-fullscreen {
      display: none;
    }

    .compact-completion-card {
      padding: 14px 16px;
    }

    .next-chapter-core {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .btn-primary-next {
      width: 100%;
      justify-content: center;
      padding: 12px 18px;
    }

    .secondary-nav-row {
      flex-direction: column;
      width: 100%;
    }

    .nav-sub-btn {
      width: 100%;
      justify-content: center;
    }

    .report-left {
      max-width: 100%;
    }

    .btn-report-red {
      width: 100%;
      justify-content: center;
    }

    .reactions-capsules-wrap {
      gap: 6px;
    }

    .reaction-capsule {
      padding: 7px 11px;
      font-size: 11.5px;
    }
  }
</style>
