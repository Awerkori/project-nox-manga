<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { SvelteSet } from 'svelte/reactivity';
  import {
    ArrowLeft,
    ArrowRight,
    Settings2,
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
    Smile,
    PartyPopper
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

  // Expressive Chapter Reactions configuration (100% DB compatible keys)
  const REACTION_CONFIG = [
    { id: 'heart', emoji: '❤️', label: 'Amei', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)' },
    { id: 'fire', emoji: '🔥', label: 'Épico', bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.4)' },
    { id: 'shock', emoji: '😱', label: 'Chocado', bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.4)' },
    { id: 'laugh', emoji: '😂', label: 'Hilário', bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.4)' },
    { id: 'cry', emoji: '😭', label: 'Emocionante', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)' }
  ];

  let reactionCounts = $state<Record<string, number>>({});
  let userReactions = new SvelteSet<string>();
  let reactionsLoading = $state(false);
  let justReactedEmoji = $state<string | null>(null);

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

  // Offline Download handling
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

  // Controls Visibility & Hide Timer
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  function resetHideTimer() {
    uiVisible = true;
    if (hideTimer) clearTimeout(hideTimer);
    if (!showSettingsModal && !showChaptersDrawer && readerSettings.autoHideControls) {
      hideTimer = setTimeout(() => {
        uiVisible = false;
      }, 3500);
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

  // Preloading System
  const preloadedMedia = new SvelteSet<string>();
  const inFlightPreloads = new SvelteSet<string>();
  let readerSessionGen = 0;

  function preloadBudget() {
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (connection?.saveData || connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') {
      return { concurrent: 1, lookahead: 2 };
    }
    if (typeof window !== 'undefined' && (matchMedia('(max-width: 767px)').matches || connection?.effectiveType === '3g')) {
      return { concurrent: 2, lookahead: 3 };
    }
    return { concurrent: 3, lookahead: 5 };
  }

  function pumpPreload() {
    if (readerSettings.preload !== 'full' || typeof window === 'undefined' || !data.pages?.length) return;
    const budget = preloadBudget();
    if (inFlightPreloads.size >= budget.concurrent) return;

    const currentGen = readerSessionGen;
    const startIdx = current <= 2 ? current : Math.max(0, current - 1);
    const ordered = data.pages.slice(startIdx, startIdx + budget.lookahead);

    for (const page of ordered) {
      if (inFlightPreloads.size >= budget.concurrent) break;
      const id = page.media_id;
      if (!id || preloadedMedia.has(id) || inFlightPreloads.has(id)) continue;

      inFlightPreloads.add(id);
      const img = new Image();
      const onDone = () => {
        img.onload = null;
        img.onerror = null;
        if (currentGen !== readerSessionGen) return;
        inFlightPreloads.delete(id);
        preloadedMedia.add(id);
        pumpPreload();
      };
      img.onload = onDone;
      img.onerror = onDone;
      img.src = `/media/${id}`;
    }
  }

  // Reading Progress, Completion & XP
  let xpAwardConfirmed = $state(false);
  let previousChapterId = $state('');
  let chapterStartTime = Date.now();
  let viewRecorded = false;
  let completionClaimInFlight = false;
  let completionAwardAttempted = false;

  function recordViewOnce() {
    if (viewRecorded || data.preview) return;
    viewRecorded = true;
    fetch(`/api/chapters/${data.chapter.id}/view`, { method: 'POST' }).catch(() => {});
  }

  async function completeChapter() {
    if (completionAwardAttempted || completionClaimInFlight || !((data as any).profile || (data as any).user) || data.preview) return;

    completionClaimInFlight = true;
    try {
      const res = (await action('member', 'read_page', {
        work_id: data.chapter.work_id,
        chapter_id: data.chapter.id,
        page: data.pages.length,
        total_pages: data.pages.length,
        completed: true
      })) as { ok?: boolean; completed?: boolean; xp_award?: any } | null;

      completionAwardAttempted = true;
      chapterCompleted = true;

      if (res?.xp_award?.awarded && typeof window !== 'undefined') {
        xpAwardConfirmed = true;
        window.dispatchEvent(
          new CustomEvent('nox-xp-awarded', {
            detail: {
              amount: res.xp_award.amount,
              total_xp: res.xp_award.total_xp,
              title: 'Capítulo concluído',
              kind: 'READ_CHAPTER'
            }
          })
        );
        if (typeof (window as any).__noxTriggerXpReward === 'function') {
          (window as any).__noxTriggerXpReward(res.xp_award.amount, 'Capítulo concluído');
        }
      } else if (res?.xp_award?.reason === 'already_awarded') {
        xpAwardConfirmed = true;
      }
    } catch {
      completionAwardAttempted = false;
    } finally {
      completionClaimInFlight = false;
    }
  }

  function seen(page: number, isVisible: boolean) {
    if (isVisible) {
      visible.add(page);
      if (page > maxSeenPage) maxSeenPage = page;
    } else {
      visible.delete(page);
    }
    if (visible.size) {
      current = Math.min(...visible);
      pumpPreload();
    }
    if (page >= 2 || (data.pages.length === 1 && isVisible)) {
      recordViewOnce();
    }
    if (page >= data.pages.length && isVisible && !chapterCompleted) {
      void completeChapter();
    }
  }

  function jump(page: number) {
    if (readerSettings.mode === 'paginated') {
      current = Math.min(data.pages.length, Math.max(1, page));
      return;
    }
    const el = document.getElementById(`pagina-${page}`) || document.getElementById(`page-${page}`);
    el?.scrollIntoView({ behavior: 'instant' });
  }

  function prevPaginated() {
    if (current > 1) {
      current--;
      jump(current);
    } else if (data.previous?.id) {
      goto(`/ler/${data.previous.id}`);
    }
  }

  function nextPaginated() {
    if (current < data.pages.length) {
      current++;
      jump(current);
      if (current === data.pages.length) {
        void completeChapter();
      }
    } else if (data.next?.id) {
      void completeChapter();
      goto(`/ler/${data.next.id}`);
    } else {
      document.getElementById('chapter-end')?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      notice = 'Tela cheia indisponível neste navegador.';
    }
  }

  // Filtered chapters for Drawer
  let filteredSiblings = $derived.by(() => {
    if (!data.siblings?.length) return [];
    if (!chapterFilter.trim()) return data.siblings;
    const query = chapterFilter.toLowerCase().trim();
    return data.siblings.filter((s) => {
      const label = `capítulo ${chapterIdentityLabel(s)} ${s.title || ''}`.toLowerCase();
      return label.includes(query);
    });
  });

  // Effective max-width for page stack
  let effectiveStackWidth = $derived.by(() => {
    if (readerSettings.fit === 'full') return '100%';
    if (readerSettings.fit === 'container') return '1000px';
    return `${readerSettings.width}px`;
  });

  let endObserver: IntersectionObserver | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  function saveOnExit() {
    const pageToSave = current;
    savePreference(`nox-page:${data.chapter.id}`, String(pageToSave));
    saveReaderSettings(readerSettings);

    if (data.profile && !data.preview) {
      void fetch('/api/action', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'member',
          action: 'read_page',
          data: {
            work_id: data.chapter.work_id,
            chapter_id: data.chapter.id,
            page: pageToSave,
            completed: maxSeenPage >= data.pages.length || pageToSave >= data.pages.length
          }
        })
      }).catch(() => {});
    }
  }

  $effect(() => {
    if (data.chapter?.id && data.chapter.id !== previousChapterId) {
      previousChapterId = data.chapter.id;
      readerSessionGen++;
      visible.clear();
      preloadedMedia.clear();
      inFlightPreloads.clear();

      for (const page of data.pages.slice(0, 2)) {
        if (page.media_id) preloadedMedia.add(page.media_id);
      }
      loadReactions(data.chapter.id);
      const saved = data.progress?.page || Number(readPreference(`nox-page:${data.chapter.id}`)) || 1;
      current = saved;
      maxSeenPage = saved;
      chapterCompleted = !!data.progress?.completed_at;
      xpAwardConfirmed = chapterCompleted;

      requestAnimationFrame(() => {
        jump(Math.min(data.pages.length, Math.max(1, saved)));
        pumpPreload();
      });
      chapterStartTime = Date.now();
      viewRecorded = false;
      setTimeout(recordViewOnce, 4500);
      resetHideTimer();
    }
  });

  onMount(() => {
    chapterCompleted = !!data.progress?.completed_at;
    previousChapterId = data.chapter.id;
    resetHideTimer();

    if (data.chapter?.id) {
      getOfflineChapter(data.chapter.id).then((off) => {
        if (off && off.pages?.length) {
          isDownloadedOffline = true;
          data.pages = data.pages.map((p) => {
            const match = off.pages.find((op) => op.position === p.position);
            return match?.blobUrl ? { ...p, blobUrl: match.blobUrl } : p;
          });
        }
      }).catch(() => {});
    }

    fullscreen = !!document.documentElement.requestFullscreen;

    const pageFromUrl = typeof window !== 'undefined'
      ? (Number(new URLSearchParams(window.location.search).get('page')) ||
         Number(window.location.hash.match(/pagina-(\d+)|page-(\d+)/)?.[1] || window.location.hash.match(/pagina-(\d+)|page-(\d+)/)?.[2]) || 0)
      : 0;
    const saved = pageFromUrl || data.progress?.page || Number(readPreference(`nox-page:${data.chapter.id}`)) || 1;
    maxSeenPage = Math.max(1, saved);
    requestAnimationFrame(() => {
      jump(Math.min(data.pages.length, Math.max(1, saved)));
      pumpPreload();
    });

    if (data.profile && !data.preview) {
      action('member', 'read_start', {
        work_id: data.chapter.work_id,
        chapter_id: data.chapter.id,
        total_pages: data.pages.length,
        completed: false
      }).catch(() => {});
    }

    const endEl = document.querySelector('.reader-end');
    if (endEl && typeof IntersectionObserver !== 'undefined') {
      endObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            const hasScrolledDown = typeof window !== 'undefined' && window.scrollY > 200;
            const reachedFinalPages = maxSeenPage >= Math.max(1, data.pages.length - 1);
            if (hasScrolledDown && reachedFinalPages) {
              maxSeenPage = data.pages.length;
              current = data.pages.length;
              void completeChapter();
            }
          }
        },
        { threshold: 0.05 }
      );
      endObserver.observe(endEl);
    }

    timer = setInterval(async () => {
      if (document.visibilityState !== 'visible' || sending) return;
      const pageToSave = current;
      savePreference(`nox-page:${data.chapter.id}`, String(pageToSave));
      saveReaderSettings(readerSettings);

      if (data.profile && !data.preview) {
        sending = true;
        try {
          await action('member', 'read_page', {
            work_id: data.chapter.work_id,
            chapter_id: data.chapter.id,
            page: pageToSave,
            total_pages: data.pages.length,
            completed: false
          });
          notice = '';
        } catch {
          // Silent local fallback
        } finally {
          sending = false;
        }
      }
    }, 3500);

    window.addEventListener('pagehide', saveOnExit);
  });

  onDestroy(() => {
    readerSessionGen++;
    if (hideTimer) clearTimeout(hideTimer);
    if (timer) clearInterval(timer);
    endObserver?.disconnect();
    preloadedMedia.clear();
    inFlightPreloads.clear();
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', saveOnExit);
    }
    saveOnExit();
  });
</script>

<svelte:window
  onmousemove={(e) => {
    if (e.clientY <= 70) {
      resetHideTimer();
    }
  }}
  onclick={(e) => {
    const target = e.target as HTMLElement | null;
    if (
      target?.closest('.reader-bar') ||
      target?.closest('.reader-settings-sheet') ||
      target?.closest('.settings-sheet') ||
      target?.closest('.drawer-panel') ||
      target?.closest('.reader-end') ||
      target?.closest('.reader-comments') ||
      target?.closest('.bottom-quick-bar') ||
      target?.closest('button') ||
      target?.closest('a') ||
      target?.closest('input') ||
      target?.closest('select') ||
      target?.closest('textarea')
    ) {
      return;
    }
    toggleUi();
  }}
  onkeydown={(e) => {
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
      return;
    }
    if (e.key === 'Escape') {
      showSettingsModal = false;
      showChaptersDrawer = false;
      showReportModal = false;
      resetHideTimer();
    } else if (e.key === 'ArrowUp' || e.key === 'Home') {
      if (!showChaptersDrawer && !showReportModal && !showSettingsModal) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else if (e.key === 'ArrowDown' || e.key === 'End') {
      if (!showChaptersDrawer && !showReportModal && !showSettingsModal) {
        e.preventDefault();
        document.getElementById('chapter-end')?.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (e.key === 'ArrowLeft') {
      if (!showChaptersDrawer && !showReportModal && !showSettingsModal) {
        e.preventDefault();
        if (readerSettings.mode === 'paginated') prevPaginated();
        else if (data.previous?.id) goto(`/ler/${data.previous.id}`);
      }
    } else if (e.key === 'ArrowRight') {
      if (!showChaptersDrawer && !showReportModal && !showSettingsModal) {
        e.preventDefault();
        if (readerSettings.mode === 'paginated') nextPaginated();
        else if (data.next?.id) goto(`/ler/${data.next.id}`);
      }
    }
  }}
/>

<svelte:head>
  <title>{data.chapter.works?.title} — Capítulo {chapterIdentityLabel(data.chapter)} | Project Nox</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div
  class="reader-shell theme-{readerSettings.theme}"
  class:is-paginated={readerSettings.mode === 'paginated'}
>
  <!-- FLOATING TOP BAR -->
  <header
    class="reader-bar"
    class:ui-hidden={!uiVisible && !showSettingsModal && !showChaptersDrawer}
  >
    <a
      href={data.preview ? `/admin/obras/${data.chapter.work_id}` : (data.chapter.works?.slug ? `/obra/${data.chapter.works.slug}` : `/obra/${data.chapter.work_id}`)}
      class="btn-back-work"
      aria-label="Voltar para a obra"
      title="Voltar para a obra"
    >
      <ArrowLeft size={18} />
    </a>

    <div class="reader-header-meta">
      <strong class="work-header-title">{data.chapter.works?.title}</strong>
      <div class="chapter-badge-row">
        <span class="chapter-header-badge">Capítulo {chapterIdentityLabel(data.chapter)}</span>
        {#if data.preview}
          <span class="preview-tag">Prévia Editorial</span>
        {/if}
      </div>
    </div>

    <div class="reader-tools">
      <!-- Page Indicator Badge -->
      <div class="pages-count-pill" title="Página atual / Total">
        <span>{current} / {data.pages.length}</span>
      </div>

      <!-- Chapters Drawer Button -->
      {#if data.siblings && data.siblings.length > 1}
        <button
          type="button"
          class="icon-button"
          aria-label="Lista de capítulos"
          title="Ver todos os capítulos desta obra"
          onclick={() => {
            showChaptersDrawer = true;
            uiVisible = true;
          }}
        >
          <List size={18} />
        </button>
      {/if}

      <!-- Offline Download Button -->
      <button
        type="button"
        class="icon-button"
        class:is-downloaded={isDownloadedOffline}
        class:is-downloading={downloadingOffline}
        aria-label={downloadingOffline ? 'Cancelar download do capítulo' : isDownloadedOffline ? 'Capítulo salvo offline' : 'Baixar capítulo para ler offline'}
        title={downloadingOffline ? 'Cancelar download' : isDownloadedOffline ? 'Capítulo disponível offline' : 'Baixar capítulo para ler offline'}
        onclick={downloadingOffline ? handleCancelDownload : handleDownloadChapter}
      >
        {#if downloadingOffline}
          <Loader2 size={17} class="spin text-amber-400" />
        {:else if isDownloadedOffline}
          <CheckCircle2 size={17} class="text-emerald-400" />
        {:else}
          <Download size={17} />
        {/if}
      </button>

      <!-- Report Button -->
      <button
        type="button"
        class="icon-button"
        aria-label="Reportar problema"
        title="Reportar problema neste capítulo"
        onclick={() => {
          showReportModal = true;
          uiVisible = true;
        }}
      >
        <Flag size={17} />
      </button>

      <!-- Settings Button -->
      <button
        type="button"
        class="icon-button btn-settings-trigger"
        class:active={showSettingsModal}
        aria-label="Ajustes de leitura"
        title="Ajustes de leitura e preferências"
        onclick={() => {
          showSettingsModal = !showSettingsModal;
          resetHideTimer();
        }}
      >
        <Settings2 size={19} />
      </button>

      <!-- Fullscreen Button -->
      {#if fullscreen}
        <button
          type="button"
          class="icon-button"
          aria-label="Alternar tela cheia"
          title="Alternar tela cheia"
          onclick={toggleFullscreen}
        >
          <Maximize size={18} />
        </button>
      {/if}
    </div>
  </header>

  <!-- NOTICE BANNER -->
  {#if notice}
    <div class="notice-toast" role="status">
      <span>{notice}</span>
    </div>
  {/if}

  <!-- MIHON-INSPIRED READING PROGRESS BAR -->
  <ReadingProgressBar
    mode={readerSettings.mode}
    currentPage={current}
    totalPages={data.pages.length}
    position={readerSettings.progressPosition}
    display={readerSettings.progressDisplay}
    visible={readerSettings.progressBar}
    uiVisible={uiVisible}
    onPageJump={jump}
  />

  <!-- MAIN READING CANVAS -->
  {#if readerSettings.mode === 'webtoon'}
    <!-- WEBTOON CONTINUOUS VERTICAL STACK -->
    <div
      class="page-stack"
      style="max-width: {effectiveStackWidth}; gap: {readerSettings.gap ? '20px' : '0'};"
    >
      {#each data.pages as page, index (page.media_id + ':' + page.position)}
        <ReaderPage {page} eager={index < 2} onSeen={seen} />
      {/each}
    </div>
  {:else}
    <!-- PAGINATED MODE (Single Page Flip with Tap Zones) -->
    <div
      class="paginated-canvas"
      style="max-width: {effectiveStackWidth};"
    >
      <!-- Left Tap Zone (Prev Page) -->
      <button
        type="button"
        class="paginated-tap-zone zone-left"
        onclick={prevPaginated}
        aria-label="Página anterior"
      >
        <span class="tap-hint"><ChevronLeft size={24} /></span>
      </button>

      <!-- Center Active Page -->
      <div class="paginated-page-wrapper">
        {#if data.pages[current - 1]}
          {@const activePage = data.pages[current - 1]}
          <ReaderPage page={activePage} eager={true} onSeen={seen} />
        {/if}
      </div>

      <!-- Right Tap Zone (Next Page) -->
      <button
        type="button"
        class="paginated-tap-zone zone-right"
        onclick={nextPaginated}
        aria-label="Próxima página"
      >
        <span class="tap-hint"><ChevronLeft size={24} style="transform: rotate(180deg);" /></span>
      </button>

      <!-- Bottom Paginated Bar -->
      <div class="paginated-controls-footer" class:ui-hidden={!uiVisible}>
        <button
          type="button"
          class="btn-page-nav"
          onclick={prevPaginated}
          disabled={current <= 1 && !data.previous}
        >
          <ChevronLeft size={16} />
          <span>Anterior</span>
        </button>

        <span class="page-indicator-pill">{current} de {data.pages.length}</span>

        <button
          type="button"
          class="btn-page-nav"
          onclick={nextPaginated}
        >
          <span>Próxima</span>
          <ChevronLeft size={16} style="transform: rotate(180deg);" />
        </button>
      </div>
    </div>
  {/if}

  <!-- REDESIGNED END OF CHAPTER SECTION -->
  <div class="reader-end" id="chapter-end">
    <!-- Celebration Seal -->
    <div class="celebration-seal">
      <Sparkles size={16} class="text-amber-400" />
      <span>CAPÍTULO CONCLUÍDO</span>
    </div>

    <h2 class="end-heading">Fim do Capítulo {chapterIdentityLabel(data.chapter)}</h2>
    <p class="end-sub">
      {data.chapter.works?.title}{data.scans && data.scans.length > 0 ? ` · Tradução por ${data.scans.map((s) => s.name).join(' × ')}` : ''}
    </p>

    <!-- PROMINENT NEXT CHAPTER HERO CARD -->
    {#if data.next}
      <div class="next-chapter-hero-card">
        <div class="next-hero-info">
          <span class="next-eyebrow">CONTINUAR LEITURA</span>
          <h3 class="next-title">Capítulo {chapterIdentityLabel(data.next)}{data.next.title ? `: ${data.next.title}` : ''}</h3>
        </div>
        <a
          class="btn-hero-next-large"
          href="/ler/{data.next.id}"
          onclick={() => void completeChapter()}
        >
          <span>Ler Próximo Capítulo</span>
          <ArrowRight size={18} class="arrow-glow-anim" />
        </a>
      </div>
    {:else}
      <div class="all-caught-up-card">
        <PartyPopper size={28} class="text-amber-400" />
        <div class="caught-up-text">
          <h3>Você está em dia com a obra!</h3>
          <p>Este é o capítulo mais recente publicado no Project Nox.</p>
        </div>
      </div>
    {/if}

    <!-- EXPRESSIVE CHAPTER REACTIONS OVERHAUL -->
    <div class="chapter-reactions-box">
      <div class="reactions-header">
        <span class="reactions-title">O que achou deste capítulo?</span>
        <span class="reactions-sub">Deixe sua reação para apoiar a equipe de tradução</span>
      </div>

      <div class="chapter-reactions-cluster">
        {#each REACTION_CONFIG as item (item.id)}
          {@const isActive = userReactions.has(item.id)}
          {@const count = reactionCounts[item.id] || 0}
          <button
            type="button"
            class="reaction-btn-premium"
            class:active={isActive}
            class:pop-anim={justReactedEmoji === item.id}
            onclick={() => toggleReaction(item.id)}
            title={item.label}
            aria-label={`${item.label} (${count} reações)`}
          >
            <span class="reaction-emoji-box">{item.emoji}</span>
            <div class="reaction-text-box">
              <span class="reaction-label-name">{item.label}</span>
              {#if count > 0}
                <span class="reaction-badge-count">{count}</span>
              {/if}
            </div>
          </button>
        {/each}
      </div>
    </div>

    <!-- SECONDARY NAVIGATION ACTIONS -->
    <div class="end-nav-cluster">
      <div class="secondary-actions-row">
        {#if data.previous}
          <a class="btn-secondary-action" href="/ler/{data.previous.id}">
            <ArrowLeft size={16} />
            <span>Capítulo Anterior</span>
          </a>
        {/if}

        {#if data.siblings && data.siblings.length > 0}
          <button
            type="button"
            class="btn-secondary-action"
            onclick={() => (showChaptersDrawer = true)}
            aria-label="Ver todos os capítulos"
          >
            <List size={16} />
            <span>Todos os Capítulos ({data.siblings.length})</span>
          </button>
        {/if}

        <a class="btn-secondary-action" href="/obra/{data.chapter.works?.slug || data.chapter.work_id}">
          <BookOpen size={16} />
          <span>Página da Obra</span>
        </a>
      </div>
    </div>

    <!-- Subtle Report Link -->
    <div class="end-report-wrap">
      <button
        type="button"
        class="btn-report-subtle"
        onclick={() => (showReportModal = true)}
      >
        <Flag size={13} />
        <span>Reportar problema neste capítulo (páginas cortadas ou fora de ordem)</span>
      </button>
    </div>
  </div>

  <!-- CHAPTER COMMENTS SECTION -->
  <div class="reader-comments">
    {#if !data.preview}
      <Comments
        comments={data.comments}
        workId={data.chapter.work_id}
        chapterId={data.chapter.id}
        profile={data.profile}
      />
    {/if}
  </div>

  <!-- FLOATING BOTTOM CONTROLS & SCROLL UTILITY -->
  <div class="scroll-nav-cluster" class:ui-hidden={!uiVisible && !showSettingsModal && !showChaptersDrawer}>
    <button
      type="button"
      class="scroll-nav-btn icon-button"
      aria-label="Voltar ao topo"
      title="Voltar ao topo (↑ ou Home)"
      onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <ChevronUp size={19} />
    </button>
    <button
      type="button"
      class="scroll-nav-btn icon-button"
      aria-label="Ir ao fim do capítulo"
      title="Ir ao fim do capítulo (↓ ou End)"
      onclick={() => document.getElementById('chapter-end')?.scrollIntoView({ behavior: 'smooth' })}
    >
      <ChevronDown size={19} />
    </button>
  </div>

  <!-- SETTINGS MODAL / SHEET -->
  {#if showSettingsModal}
    <ReaderSettingsModal
      settings={readerSettings}
      totalPages={data.pages.length}
      currentPage={current}
      onClose={() => { showSettingsModal = false; resetHideTimer(); }}
      onUpdate={(updated) => {
        readerSettings = updated;
        saveReaderSettings(updated);
      }}
      onJumpPage={(p) => {
        jump(p);
        showSettingsModal = false;
      }}
    />
  {/if}

  <!-- CHAPTERS DRAWER WITH SEARCH & FILTER -->
  {#if showChaptersDrawer}
    <div
      class="drawer-backdrop"
      onclick={() => (showChaptersDrawer = false)}
      onkeydown={(e) => { if (e.key === 'Escape') showChaptersDrawer = false; }}
      role="button"
      tabindex="0"
      aria-label="Fechar lista de capítulos"
    ></div>
    <aside class="drawer-panel" role="dialog" aria-modal="true" aria-label="Navegação de Capítulos">
      <div class="drawer-header">
        <div class="drawer-title-box">
          <BookOpen size={18} class="text-purple-400" />
          <span class="drawer-title">Capítulos</span>
          <span class="drawer-count">{data.siblings?.length || 0}</span>
        </div>
        <button
          type="button"
          class="btn-drawer-close"
          onclick={() => (showChaptersDrawer = false)}
          aria-label="Fechar lista de capítulos"
        >
          <X size={18} />
        </button>
      </div>

      <div class="drawer-work-info">
        <span class="work-label">Obra:</span>
        <strong class="work-name">{data.chapter.works?.title}</strong>
      </div>

      <!-- Quick Search Filter -->
      <div class="drawer-search-box">
        <Search size={14} class="drawer-search-icon" />
        <input
          type="text"
          placeholder="Buscar capítulo..."
          bind:value={chapterFilter}
          class="drawer-search-input"
          aria-label="Filtrar capítulos"
        />
        {#if chapterFilter}
          <button
            type="button"
            class="btn-clear-search"
            onclick={() => (chapterFilter = '')}
            aria-label="Limpar busca"
          >
            <X size={13} />
          </button>
        {/if}
      </div>

      <div class="drawer-list">
        {#each filteredSiblings as sibling (sibling.id)}
          {@const isCurrent = sibling.id === data.chapter.id}
          <a
            href="/ler/{sibling.id}"
            class="drawer-item"
            class:current={isCurrent}
            onclick={() => (showChaptersDrawer = false)}
          >
            <div class="drawer-item-left">
              <span class="drawer-item-number">Capítulo {chapterIdentityLabel(sibling)}</span>
              {#if sibling.title && sibling.title !== `Capítulo ${sibling.number}`}
                <span class="drawer-item-title">{sibling.title}</span>
              {/if}
            </div>
            {#if isCurrent}
              <span class="drawer-current-badge">Lendo agora</span>
            {/if}
          </a>
        {/each}
        {#if filteredSiblings.length === 0}
          <div class="drawer-empty-search">
            <span>Nenhum capítulo encontrado para "{chapterFilter}"</span>
          </div>
        {/if}
      </div>
    </aside>
  {/if}

  <!-- REPORT MODAL -->
  {#if showReportModal}
    <ReportModal
      targetType="CHAPTER"
      chapterId={data.chapter.id}
      workId={data.chapter.work_id || data.chapter.works?.id}
      targetTitle={`${data.chapter.works?.title || 'Obra'} — Cap. ${chapterIdentityLabel(data.chapter)}`}
      pageNumber={current}
      onclose={() => (showReportModal = false)}
      onsuccess={() => {
        showReportModal = false;
        notice = '✓ Reporte enviado com sucesso para a moderação.';
        setTimeout(() => { notice = ''; }, 4000);
      }}
    />
  {/if}
</div>

<style>
  /* ----------------------------------------------------
     BASE SHELL & THEMES
  ---------------------------------------------------- */
  .reader-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    user-select: none;
    transition: background 0.3s ease;
  }

  .theme-dark {
    background: #06070c;
    color: #f2f0f7;
  }

  .theme-oled {
    background: #000000;
    color: #ffffff;
  }

  .theme-sepia {
    background: #141118;
    color: #f5f0eb;
  }

  /* ----------------------------------------------------
     FLOATING HEADER (GLASSMORPHISM)
  ---------------------------------------------------- */
  .reader-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: rgba(8, 10, 18, 0.88);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(181, 154, 245, 0.15);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    z-index: 80;
    transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  }

  .reader-bar.ui-hidden {
    transform: translateY(-100%);
    opacity: 0;
    pointer-events: none;
  }

  .btn-back-work {
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e2dfec;
    transition: background 0.2s, color 0.2s, border-color 0.2s;
    flex-shrink: 0;
  }

  .btn-back-work:hover {
    background: rgba(168, 85, 247, 0.2);
    border-color: rgba(192, 132, 252, 0.4);
    color: #fff;
  }

  .reader-header-meta {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    flex-grow: 1;
    min-width: 0;
    padding: 0 12px;
  }

  .work-header-title {
    font-size: 14px;
    font-weight: 750;
    color: #f2f0f7;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 380px;
    line-height: 1.25;
  }

  .chapter-badge-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
  }

  .chapter-header-badge {
    font-size: 11px;
    color: #c4b5fd;
    font-weight: 600;
  }

  .preview-tag {
    font-size: 10px;
    background: rgba(234, 179, 8, 0.2);
    border: 1px solid rgba(234, 179, 8, 0.4);
    color: #fde047;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 700;
  }

  .reader-tools {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .pages-count-pill {
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    color: #dfc28d;
    letter-spacing: 0.02em;
  }

  .icon-button {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #d1cddc;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.2s, color 0.2s, border-color 0.2s, transform 0.15s;
  }

  .icon-button:hover {
    background: rgba(168, 85, 247, 0.2);
    border-color: rgba(192, 132, 252, 0.4);
    color: #fff;
    transform: translateY(-1px);
  }

  .icon-button.active, .icon-button.btn-settings-trigger.active {
    background: rgba(168, 85, 247, 0.35);
    border-color: #c084fc;
    color: #fff;
  }

  .icon-button.is-downloaded {
    border-color: rgba(52, 211, 153, 0.5);
    background: rgba(16, 185, 129, 0.15);
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* ----------------------------------------------------
     NOTICE TOAST
  ---------------------------------------------------- */
  .notice-toast {
    position: fixed;
    top: 72px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(11, 13, 23, 0.92);
    border: 1px solid rgba(168, 85, 247, 0.4);
    color: #e9d5ff;
    padding: 8px 16px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    backdrop-filter: blur(12px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
    z-index: 85;
    animation: fadeInDown 0.25s ease-out;
  }

  @keyframes fadeInDown {
    from { opacity: 0; transform: translate(-50%, -10px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }

  /* ----------------------------------------------------
     WEBTOON CANVAS (PAGE STACK)
  ---------------------------------------------------- */
  .page-stack {
    width: 100%;
    margin: 60px auto 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  /* ----------------------------------------------------
     PAGINATED CANVAS
  ---------------------------------------------------- */
  .paginated-canvas {
    width: 100%;
    margin: 60px auto 0 auto;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: calc(100vh - 60px);
  }

  .paginated-tap-zone {
    position: absolute;
    top: 0;
    bottom: 60px;
    width: 25%;
    background: transparent;
    border: none;
    cursor: pointer;
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s, background 0.2s;
  }

  .paginated-tap-zone:hover {
    opacity: 1;
    background: rgba(168, 85, 247, 0.04);
  }

  .zone-left { left: 0; }
  .zone-right { right: 0; }

  .tap-hint {
    background: rgba(11, 13, 23, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 50%;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #e9d5ff;
    backdrop-filter: blur(8px);
  }

  .paginated-page-wrapper {
    width: 100%;
    display: flex;
    justify-content: center;
    padding: 12px 0 70px 0;
  }

  .paginated-controls-footer {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(11, 13, 23, 0.88);
    border: 1px solid rgba(181, 154, 245, 0.25);
    padding: 6px 14px;
    border-radius: 999px;
    backdrop-filter: blur(12px);
    z-index: 60;
    transition: opacity 0.25s, transform 0.25s;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
  }

  .paginated-controls-footer.ui-hidden {
    opacity: 0;
    transform: translate(-50%, 20px);
    pointer-events: none;
  }

  .btn-page-nav {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: none;
    color: #c4b5fd;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: background 0.2s, color 0.2s;
  }

  .btn-page-nav:hover:not(:disabled) {
    background: rgba(168, 85, 247, 0.2);
    color: #fff;
  }

  .btn-page-nav:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .page-indicator-pill {
    font-size: 12px;
    font-weight: 700;
    color: #dfc28d;
    padding: 0 6px;
  }

  /* ----------------------------------------------------
     REDESIGNED END OF CHAPTER SECTION
  ---------------------------------------------------- */
  .reader-end {
    width: 100%;
    max-width: 760px;
    margin: 40px auto 30px auto;
    padding: 32px 24px;
    background: rgba(11, 13, 23, 0.85);
    border: 1px solid rgba(181, 154, 245, 0.2);
    border-radius: 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .celebration-seal {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 4px 12px;
    background: rgba(201, 170, 115, 0.12);
    border: 1px solid rgba(201, 170, 115, 0.3);
    border-radius: 999px;
    color: #dfc28d;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.06em;
    margin-bottom: 12px;
  }

  .end-heading {
    font-size: 26px;
    font-weight: 800;
    color: #f2f0f7;
    margin: 0;
    line-height: 1.25;
  }

  .end-sub {
    font-size: 13px;
    color: #8c899a;
    margin: 6px 0 24px 0;
  }

  /* Next Chapter Hero Card */
  .next-chapter-hero-card {
    width: 100%;
    background: linear-gradient(135deg, rgba(35, 20, 60, 0.8) 0%, rgba(20, 14, 38, 0.9) 100%);
    border: 1px solid rgba(168, 85, 247, 0.4);
    border-radius: 18px;
    padding: 20px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    box-shadow: 0 8px 24px rgba(124, 58, 237, 0.25);
    margin-bottom: 28px;
    text-align: left;
  }

  .next-hero-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .next-eyebrow {
    font-size: 11px;
    font-weight: 800;
    color: #c084fc;
    letter-spacing: 0.05em;
  }

  .next-title {
    font-size: 18px;
    font-weight: 750;
    color: #ffffff;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .btn-hero-next-large {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: linear-gradient(135deg, #7c3aed, #9333ea);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #fff;
    padding: 12px 22px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 750;
    cursor: pointer;
    box-shadow: 0 4px 18px rgba(124, 58, 237, 0.5);
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .btn-hero-next-large:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(124, 58, 237, 0.7);
  }

  .arrow-glow-anim {
    transition: transform 0.2s;
  }

  .btn-hero-next-large:hover .arrow-glow-anim {
    transform: translateX(4px);
  }

  .all-caught-up-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 22px;
    background: rgba(234, 179, 8, 0.08);
    border: 1px solid rgba(234, 179, 8, 0.25);
    border-radius: 16px;
    margin-bottom: 28px;
    width: 100%;
    text-align: left;
  }

  .caught-up-text h3 {
    font-size: 15px;
    font-weight: 750;
    color: #fef08a;
    margin: 0 0 2px 0;
  }

  .caught-up-text p {
    font-size: 12px;
    color: #d1cddc;
    margin: 0;
  }

  /* ----------------------------------------------------
     EXPRESSIVE CHAPTER REACTIONS OVERHAUL
  ---------------------------------------------------- */
  .chapter-reactions-box {
    width: 100%;
    background: rgba(16, 18, 30, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 18px;
    padding: 20px;
    margin-bottom: 24px;
  }

  .reactions-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 16px;
  }

  .reactions-title {
    font-size: 15px;
    font-weight: 750;
    color: #f2f0f7;
  }

  .reactions-sub {
    font-size: 11px;
    color: #8c899a;
  }

  .chapter-reactions-cluster {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
  }

  .reaction-btn-premium {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 10px 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    user-select: none;
  }

  .reaction-btn-premium:hover {
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(168, 85, 247, 0.4);
  }

  .reaction-btn-premium.active {
    background: rgba(168, 85, 247, 0.2);
    border-color: #a855f7;
    box-shadow: 0 4px 14px rgba(168, 85, 247, 0.3);
  }

  .reaction-btn-premium.pop-anim {
    animation: bouncePop 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes bouncePop {
    0% { transform: scale(1); }
    50% { transform: scale(1.22); }
    100% { transform: scale(1); }
  }

  .reaction-emoji-box {
    font-size: 22px;
    line-height: 1;
  }

  .reaction-text-box {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .reaction-label-name {
    font-size: 11px;
    font-weight: 650;
    color: #d1cddc;
  }

  .reaction-btn-premium.active .reaction-label-name {
    color: #e9d5ff;
  }

  .reaction-badge-count {
    font-size: 10px;
    font-weight: 750;
    color: #dfc28d;
    background: rgba(201, 170, 115, 0.15);
    border-radius: 999px;
    padding: 1px 5px;
  }

  /* ----------------------------------------------------
     SECONDARY NAVIGATION ACTIONS
  ---------------------------------------------------- */
  .end-nav-cluster {
    width: 100%;
    margin-bottom: 8px;
  }

  .secondary-actions-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  .btn-secondary-action {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: #d1cddc;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary-action:hover {
    background: rgba(168, 85, 247, 0.15);
    border-color: rgba(192, 132, 252, 0.35);
    color: #fff;
  }

  .end-report-wrap {
    margin-top: 14px;
  }

  .btn-report-subtle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    color: #716e7e;
    font-size: 11px;
    cursor: pointer;
    transition: color 0.2s;
  }

  .btn-report-subtle:hover {
    color: #a7a3b6;
  }

  /* ----------------------------------------------------
     COMMENTS CONTAINER
  ---------------------------------------------------- */
  .reader-comments {
    width: 100%;
    max-width: 820px;
    padding: 0 16px;
    margin-bottom: 60px;
  }

  /* ----------------------------------------------------
     FLOATING SCROLL CLUSTER
  ---------------------------------------------------- */
  .scroll-nav-cluster {
    position: fixed;
    right: 20px;
    bottom: 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 70;
    transition: opacity 0.28s, transform 0.28s;
  }

  .scroll-nav-cluster.ui-hidden {
    opacity: 0;
    transform: translateY(20px);
    pointer-events: none;
  }

  .scroll-nav-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(11, 13, 23, 0.85);
    border: 1px solid rgba(181, 154, 245, 0.25);
    color: #c4b5fd;
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  }

  .scroll-nav-btn:hover {
    background: rgba(124, 58, 237, 0.3);
    border-color: #a855f7;
    color: #fff;
  }

  /* ----------------------------------------------------
     CHAPTERS DRAWER
  ---------------------------------------------------- */
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 100;
    cursor: pointer;
  }

  .drawer-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-width: 420px;
    background: #090b14;
    border-left: 1px solid rgba(181, 154, 245, 0.2);
    box-shadow: -10px 0 35px rgba(0, 0, 0, 0.85);
    z-index: 101;
    display: flex;
    flex-direction: column;
    animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(11, 13, 23, 0.95);
  }

  .drawer-title-box {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .drawer-title {
    font-size: 16px;
    font-weight: 750;
    color: #f2f0f7;
  }

  .drawer-count {
    font-size: 11px;
    font-weight: 750;
    color: #c084fc;
    background: rgba(168, 85, 247, 0.15);
    padding: 2px 7px;
    border-radius: 999px;
  }

  .btn-drawer-close {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #9d9aa9;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
  }

  .btn-drawer-close:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  .drawer-work-info {
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }

  .work-label {
    color: #8c899a;
  }

  .work-name {
    color: #e2dfec;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .drawer-search-box {
    margin: 12px 16px 6px 16px;
    position: relative;
    display: flex;
    align-items: center;
  }

  .drawer-search-icon {
    position: absolute;
    left: 12px;
    color: #8c899a;
  }

  .drawer-search-input {
    width: 100%;
    padding: 8px 32px 8px 34px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #fff;
    font-size: 12px;
    outline: none;
    transition: border-color 0.2s;
  }

  .drawer-search-input:focus {
    border-color: #a855f7;
  }

  .btn-clear-search {
    position: absolute;
    right: 8px;
    background: transparent;
    border: none;
    color: #8c899a;
    cursor: pointer;
    padding: 4px;
  }

  .drawer-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .drawer-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid transparent;
    color: #d1cddc;
    text-decoration: none;
    transition: all 0.2s;
  }

  .drawer-item:hover {
    background: rgba(168, 85, 247, 0.12);
    border-color: rgba(192, 132, 252, 0.3);
    color: #fff;
  }

  .drawer-item.current {
    background: rgba(124, 58, 237, 0.22);
    border-color: rgba(168, 85, 247, 0.6);
    color: #e9d5ff;
  }

  .drawer-item-left {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .drawer-item-number {
    font-size: 13px;
    font-weight: 700;
  }

  .drawer-item-title {
    font-size: 11px;
    color: #8c899a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .drawer-current-badge {
    font-size: 10px;
    font-weight: 750;
    color: #c084fc;
    background: rgba(168, 85, 247, 0.2);
    border: 1px solid rgba(168, 85, 247, 0.4);
    padding: 2px 7px;
    border-radius: 999px;
    white-space: nowrap;
  }

  .drawer-empty-search {
    padding: 24px;
    text-align: center;
    color: #8c899a;
    font-size: 12px;
  }

  /* ----------------------------------------------------
     RESPONSIVE BREAKPOINTS (MOBILE REFINEMENTS)
  ---------------------------------------------------- */
  @media (max-width: 640px) {
    .reader-bar {
      height: 54px;
      padding: 0 10px;
    }

    .btn-back-work {
      width: 32px;
      height: 32px;
    }

    .work-header-title {
      font-size: 12px;
      max-width: 140px;
    }

    .chapter-header-badge {
      font-size: 10px;
    }

    .pages-count-pill {
      display: none;
    }

    .icon-button {
      width: 32px;
      height: 32px;
    }

    .page-stack {
      margin-top: 54px;
    }

    .paginated-canvas {
      margin-top: 54px;
    }

    .reader-end {
      padding: 24px 16px;
      border-radius: 18px;
    }

    .end-heading {
      font-size: 20px;
    }

    .next-chapter-hero-card {
      flex-direction: column;
      align-items: stretch;
      padding: 16px;
      gap: 12px;
    }

    .btn-hero-next-large {
      justify-content: center;
      width: 100%;
    }

    .chapter-reactions-cluster {
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }

    .chapter-reactions-cluster button:nth-child(4),
    .chapter-reactions-cluster button:nth-child(5) {
      grid-column: span 1;
    }

    .reaction-emoji-box {
      font-size: 18px;
    }

    .reaction-label-name {
      font-size: 10px;
    }

    .secondary-actions-row {
      flex-direction: column;
      width: 100%;
    }

    .btn-secondary-action {
      width: 100%;
      justify-content: center;
    }

    .scroll-nav-cluster {
      right: 12px;
      bottom: 16px;
    }

    .scroll-nav-btn {
      width: 36px;
      height: 36px;
    }
  }
</style>
